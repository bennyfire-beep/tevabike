import { NextRequest, NextResponse } from 'next/server'
import { whatsappServiceClient, requireCoordinator, canAccessConversation } from '@/lib/whatsapp-server'
import { suggestWhatsAppReply } from '@/lib/gemini'
import { WHATSAPP_KNOWLEDGE_BASE } from '@/lib/whatsapp-knowledge'
import { fetchDynamicSiteContent } from '@/lib/site-content'

// POST /api/whatsapp/suggest — { conversation_id }.
//
// Suggest-only: drafts a reply for the coordinator's composer, never sends
// anything itself. Same auth/ownership rule as the rest of /api/whatsapp/*.

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HISTORY_LIMIT = 15

export async function POST(req: NextRequest) {
  const admin = whatsappServiceClient()
  if (!admin) return NextResponse.json({ error: 'השרת לא מוגדר נכון' }, { status: 500 })

  const auth = await requireCoordinator(req, admin)
  if (!auth.ok) return auth.response
  const { caller } = auth

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'הצעת תשובה לא מוגדרת בשרת (חסר GEMINI_API_KEY)' }, { status: 500 })
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
    .select('direction, body, msg_type, created_at')
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

  try {
    const dynamicContext = await fetchDynamicSiteContent(admin)
    const suggestion = await suggestWhatsAppReply(history, WHATSAPP_KNOWLEDGE_BASE, dynamicContext)
    if (!suggestion) return NextResponse.json({ error: 'לא התקבלה הצעה מ-Gemini' }, { status: 502 })
    return NextResponse.json({ suggestion })
  } catch (e) {
    console.error('[whatsapp/suggest] Gemini call failed:', (e as Error).message)
    return NextResponse.json({ error: 'הצעת התשובה נכשלה' }, { status: 502 })
  }
}
