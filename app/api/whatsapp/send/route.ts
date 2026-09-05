import { NextRequest, NextResponse } from 'next/server'
import { whatsappServiceClient, requireCoordinator, canAccessConversation } from '@/lib/whatsapp-server'
import { WINDOW_CLOSED_MESSAGE, isReplyWindowOpen } from '@/lib/whatsapp'
import { sendWhatsAppText } from '@/lib/whatsapp-send'

// POST /api/whatsapp/send — a coordinator's reply, sent through the Meta Cloud
// API and logged the same way an inbound message would be. Templates and
// media are out of scope: this only ever sends a free-form text message,
// which Meta only allows inside the 24h window since the customer's last
// inbound message.

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Conversation = {
  id: string
  wa_id: string
  last_inbound_at: string | null
  assigned_to: string | null
}

export async function POST(req: NextRequest) {
  const admin = whatsappServiceClient()
  if (!admin) {
    console.error('[whatsapp/send] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: 'השרת לא מוגדר נכון' }, { status: 500 })
  }

  const auth = await requireCoordinator(req, admin)
  if (!auth.ok) return auth.response
  const { caller } = auth

  let body: {
    conversation_id?: string
    wa_id?: string
    text?: string
    // Set by the coordinator screen's suggestion card — see lib/gemini.ts and
    // supabase/migrations/20260906_whatsapp_suggestions.sql. 'sent_as_is' is
    // the "שלח" button; 'edited' is "ערוך" followed by שליחה. Both optional —
    // a normal, suggestion-free send omits them entirely.
    suggestion_id?: string
    suggestion_outcome?: 'sent_as_is' | 'edited'
  }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }) }

  const text = (body.text ?? '').trim()
  if (!text) return NextResponse.json({ error: 'אין טקסט לשליחה' }, { status: 400 })

  const conversationId = (body.conversation_id ?? '').trim()
  const waId = (body.wa_id ?? '').trim()
  if (!conversationId && !waId) {
    return NextResponse.json({ error: 'חסר מזהה שיחה' }, { status: 400 })
  }

  // ── 1. Load the conversation, check ownership and the 24h reply window ──
  let query = admin.from('whatsapp_conversations').select('id, wa_id, last_inbound_at, assigned_to')
  query = conversationId && UUID.test(conversationId) ? query.eq('id', conversationId) : query.eq('wa_id', waId)
  const { data: conversation, error: convErr } = await query.maybeSingle<Conversation>()

  if (convErr) {
    console.error('[whatsapp/send] conversation read failed:', convErr.message)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
  if (!conversation) return NextResponse.json({ error: 'השיחה לא נמצאה' }, { status: 404 })
  if (!canAccessConversation(caller, conversation.assigned_to)) {
    return NextResponse.json({ error: 'השיחה משויכת לרכז אחר' }, { status: 403 })
  }

  if (!isReplyWindowOpen(conversation.last_inbound_at)) {
    return NextResponse.json({ error: WINDOW_CLOSED_MESSAGE }, { status: 400 })
  }

  // Every outbound message is signed — the customer sees who they're talking
  // to when more than one person answers the same inbox.
  const signedText = `${text}\n\n— ${caller.name}`

  // ── 2. Send via the Graph API, log it, bump the conversation ──
  // (shared with the automatic bot reply — lib/whatsapp-autoreply.ts — so both
  // paths behave identically here)
  const result = await sendWhatsAppText(admin, {
    conversationId: conversation.id,
    waId: conversation.wa_id,
    text: signedText,
    sentBy: caller.name,
  })
  if (!result.ok) {
    console.error('[whatsapp/send] send failed:', result.error)
    return NextResponse.json({ error: `שליחת ההודעה נכשלה: ${result.error}` }, { status: 502 })
  }

  const now = new Date().toISOString()
  const { data: saved } = await admin
    .from('whatsapp_messages')
    .select('id, wa_message_id, direction, msg_type, body, status, error_detail, sent_by, created_at')
    .eq('id', result.messageId ?? '')
    .maybeSingle()

  // ── 3. Tag the suggestion this came from, if any (stage-3 accuracy tracking) ──
  const suggestionId = (body.suggestion_id ?? '').trim()
  if (suggestionId && UUID.test(suggestionId) && body.suggestion_outcome) {
    const { error: decideErr } = await admin
      .from('whatsapp_suggestions')
      .update({
        outcome: body.suggestion_outcome,
        final_text: text,
        outbound_message_id: result.messageId,
        decided_by: caller.name,
        decided_at: now,
      })
      .eq('id', suggestionId)
    if (decideErr) console.error('[whatsapp/send] suggestion outcome update failed:', decideErr.message)
  }

  return NextResponse.json({ message: saved ?? null })
}
