import { NextRequest, NextResponse } from 'next/server'
import { whatsappServiceClient, requireCoordinator, canAccessConversation } from '@/lib/whatsapp-server'
import { suggestWhatsAppReply } from '@/lib/gemini'
import { WHATSAPP_KNOWLEDGE_BASE } from '@/lib/whatsapp-knowledge'
import { fetchDynamicSiteContent } from '@/lib/site-content'
import { formatReplyExamples } from '@/lib/whatsapp-reply-examples'

// POST /api/whatsapp/suggest — { conversation_id }.
//
// Suggest-only: drafts a reply for the coordinator's composer, never sends
// anything itself. Same auth/ownership rule as the rest of /api/whatsapp/*.

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Kept in sync with lib/whatsapp-autoreply.ts — see its comment: trimmed from
// 15/15 after a measured Groq 429 (TPM limit) from a burst of full-size calls.
const HISTORY_LIMIT = 8
const EXAMPLES_LIMIT = 8

export async function POST(req: NextRequest) {
  const admin = whatsappServiceClient()
  if (!admin) return NextResponse.json({ error: 'השרת לא מוגדר נכון' }, { status: 500 })

  const auth = await requireCoordinator(req, admin)
  if (!auth.ok) return auth.response
  const { caller } = auth

  // suggestWhatsAppReply tries Groq first, Gemini second — either being
  // configured is enough, this must not gate on Gemini alone.
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'הצעת תשובה לא מוגדרת בשרת (חסרים GEMINI_API_KEY/GROQ_API_KEY)' }, { status: 500 })
  }

  let body: { conversation_id?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }) }

  const conversationId = (body.conversation_id ?? '').trim()
  if (!UUID.test(conversationId)) return NextResponse.json({ error: 'מזהה שיחה לא תקין' }, { status: 400 })

  const { data: conversation, error: convErr } = await admin
    .from('whatsapp_conversations')
    .select('id, assigned_to')
    .eq('id', conversationId)
    .maybeSingle()

  if (convErr) {
    console.error('[whatsapp/suggest] conversation read failed:', convErr.message)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
  if (!conversation) return NextResponse.json({ error: 'השיחה לא נמצאה' }, { status: 404 })
  if (!canAccessConversation(caller, conversation.assigned_to)) {
    return NextResponse.json({ error: 'השיחה משויכת לרכז אחר' }, { status: 403 })
  }

  const { data: recent, error: msgErr } = await admin
    .from('whatsapp_messages')
    .select('id, direction, body, msg_type, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)

  if (msgErr) {
    console.error('[whatsapp/suggest] messages read failed:', msgErr.message)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
  if (!recent || recent.length === 0) {
    return NextResponse.json({ error: 'אין עדיין הודעות בשיחה הזו להציע לפיהן תשובה' }, { status: 400 })
  }

  const history = recent
    .slice()
    .reverse()
    .map(m => ({ direction: m.direction as 'inbound' | 'outbound', body: m.body ?? `[${m.msg_type ?? 'הודעה'}]` }))

  const { data: examples, error: examplesErr } = await admin
    .from('whatsapp_reply_examples')
    .select('question_text, answer_text')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(EXAMPLES_LIMIT)
  if (examplesErr) {
    // Style examples are a nice-to-have, not a hard requirement — a broken
    // read here shouldn't block the suggestion itself.
    console.error('[whatsapp/suggest] examples read failed:', examplesErr.message)
  }

  let suggestion
  try {
    const dynamicContext = await fetchDynamicSiteContent(admin)
    const styleExamples = formatReplyExamples(examples ?? [])
    suggestion = await suggestWhatsAppReply(history, WHATSAPP_KNOWLEDGE_BASE, dynamicContext, styleExamples)
  } catch (e) {
    console.error('[whatsapp/suggest] Gemini call failed:', (e as Error).message)
    return NextResponse.json({ error: 'הצעת התשובה נכשלה' }, { status: 502 })
  }

  // recent[0] is the newest message (desc order) — if it's inbound, this
  // suggestion is a draft reply to it; that's the id the coordinator's "שלח
  // כמו שהיא"/"ערוך"/"דחה" outcome (app/api/whatsapp/send, .../suggestions/reject)
  // eventually gets tagged against for stage-3 accuracy tracking.
  const latest = recent[0]
  const inboundMessageId = latest?.direction === 'inbound' ? latest.id : null

  const { data: saved, error: insertErr } = await admin
    .from('whatsapp_suggestions')
    .insert({
      conversation_id: conversationId,
      inbound_message_id: inboundMessageId,
      suggested_text: suggestion.text,
      category: suggestion.category,
      unsure: suggestion.unsure,
    })
    .select('id')
    .single()
  if (insertErr) {
    // Logging the suggestion is for stage-3 accuracy tracking, not a
    // requirement for handing the draft back — don't fail the request over it.
    console.error('[whatsapp/suggest] suggestion log insert failed:', insertErr.message)
  }

  return NextResponse.json({
    id: saved?.id ?? null,
    text: suggestion.text,
    unsure: suggestion.unsure,
    category: suggestion.category,
  })
}
