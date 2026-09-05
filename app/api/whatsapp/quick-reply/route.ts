import { NextRequest, NextResponse } from 'next/server'
import { whatsappServiceClient, requireCoordinator, canAccessConversation } from '@/lib/whatsapp-server'
import { suggestWhatsAppReply } from '@/lib/gemini'
import { WHATSAPP_KNOWLEDGE_BASE } from '@/lib/whatsapp-knowledge'
import { fetchDynamicSiteContent } from '@/lib/site-content'
import { formatReplyExamples } from '@/lib/whatsapp-reply-examples'
import { QUICK_REPLIES, QUICK_REPLY_KEYS, type QuickReplyKey } from '@/lib/whatsapp-quick-replies'

// POST /api/whatsapp/quick-reply — { conversation_id, key }.
//
// The "always-on default" buttons in the coordinator inbox: one click drafts
// an answer for a common category (price/dates/hours/registration/overview)
// without waiting for the customer to actually ask. Same suggest-only
// contract as app/api/whatsapp/suggest — never sent on its own, the
// coordinator still reviews and hits שליחה — this just saves typing the
// question out by hand to trigger a draft.
//
// Implementation: append the button's canned question as a synthetic last
// turn onto the real recent history, then run the exact same
// suggestWhatsAppReply pipeline as a genuine inbound message would get. That
// reuses every rule already hardened by real production bugs this quarter
// (iron rule, freshness, formatting, shop-marketing, date-order) instead of a
// second hand-written copy of the same facts that could drift out of sync.

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HISTORY_LIMIT = 8
const EXAMPLES_LIMIT = 8

export async function POST(req: NextRequest) {
  const admin = whatsappServiceClient()
  if (!admin) return NextResponse.json({ error: 'השרת לא מוגדר נכון' }, { status: 500 })

  const auth = await requireCoordinator(req, admin)
  if (!auth.ok) return auth.response
  const { caller } = auth

  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'הצעת תשובה לא מוגדרת בשרת (חסרים GEMINI_API_KEY/GROQ_API_KEY)' }, { status: 500 })
  }

  let body: { conversation_id?: string; key?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }) }

  const conversationId = (body.conversation_id ?? '').trim()
  if (!UUID.test(conversationId)) return NextResponse.json({ error: 'מזהה שיחה לא תקין' }, { status: 400 })

  const key = (body.key ?? '') as QuickReplyKey
  if (!QUICK_REPLY_KEYS.includes(key)) return NextResponse.json({ error: 'תבנית לא מוכרת' }, { status: 400 })

  const { data: conversation, error: convErr } = await admin
    .from('whatsapp_conversations')
    .select('id, assigned_to')
    .eq('id', conversationId)
    .maybeSingle()

  if (convErr) {
    console.error('[whatsapp/quick-reply] conversation read failed:', convErr.message)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
  if (!conversation) return NextResponse.json({ error: 'השיחה לא נמצאה' }, { status: 404 })
  if (!canAccessConversation(caller, conversation.assigned_to)) {
    return NextResponse.json({ error: 'השיחה משויכת לרכז אחר' }, { status: 403 })
  }

  const { data: recent, error: msgErr } = await admin
    .from('whatsapp_messages')
    .select('direction, body, msg_type, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)

  if (msgErr) {
    console.error('[whatsapp/quick-reply] messages read failed:', msgErr.message)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }

  const history = (recent ?? [])
    .slice()
    .reverse()
    .map(m => ({ direction: m.direction as 'inbound' | 'outbound', body: m.body ?? `[${m.msg_type ?? 'הודעה'}]` }))
  // The button's canned question, appended as if the customer had just asked
  // it — gives suggestWhatsAppReply a real inbound turn to answer.
  history.push({ direction: 'inbound', body: QUICK_REPLIES[key].prompt })

  const { data: examples, error: examplesErr } = await admin
    .from('whatsapp_reply_examples')
    .select('question_text, answer_text')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(EXAMPLES_LIMIT)
  if (examplesErr) console.error('[whatsapp/quick-reply] examples read failed:', examplesErr.message)

  let suggestion
  try {
    const dynamicContext = await fetchDynamicSiteContent(admin)
    const styleExamples = formatReplyExamples(examples ?? [])
    suggestion = await suggestWhatsAppReply(history, WHATSAPP_KNOWLEDGE_BASE, dynamicContext, styleExamples)
  } catch (e) {
    console.error('[whatsapp/quick-reply] suggestion call failed:', (e as Error).message)
    return NextResponse.json({ error: 'הצעת התשובה נכשלה' }, { status: 502 })
  }

  // Logged like any other suggestion, just with no inbound_message_id — this
  // was triggered by a button, not a real customer message.
  const { data: saved, error: insertErr } = await admin
    .from('whatsapp_suggestions')
    .insert({
      conversation_id: conversationId,
      inbound_message_id: null,
      suggested_text: suggestion.text,
      category: suggestion.category,
      unsure: suggestion.unsure,
    })
    .select('id')
    .single()
  if (insertErr) console.error('[whatsapp/quick-reply] suggestion log insert failed:', insertErr.message)

  return NextResponse.json({
    id: saved?.id ?? null,
    text: suggestion.text,
    unsure: suggestion.unsure,
    category: suggestion.category,
  })
}
