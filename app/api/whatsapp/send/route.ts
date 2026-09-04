import { NextRequest, NextResponse } from 'next/server'
import { whatsappServiceClient, requireCoordinator, canAccessConversation } from '@/lib/whatsapp-server'
import { WHATSAPP_GRAPH_VERSION, WINDOW_CLOSED_MESSAGE, isReplyWindowOpen } from '@/lib/whatsapp'

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

  // ── 2. Send via the Graph API ──
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_TOKEN
  if (!phoneNumberId || !token) {
    console.error('[whatsapp/send] missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_TOKEN')
    return NextResponse.json({ error: 'השרת לא מוגדר נכון (חסרים פרטי WhatsApp API)' }, { status: 500 })
  }

  let waMessageId: string | null = null
  try {
    const res = await fetch(`https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: conversation.wa_id,
        text: { body: signedText },
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const detail = data?.error?.message || res.statusText
      console.error('[whatsapp/send] Graph API rejected the message:', detail)
      return NextResponse.json({ error: `שליחת ההודעה נכשלה: ${detail}` }, { status: 502 })
    }
    waMessageId = data?.messages?.[0]?.id ?? null
  } catch (e) {
    console.error('[whatsapp/send] Graph API request failed:', (e as Error).message)
    return NextResponse.json({ error: 'שליחת ההודעה נכשלה — בעיית תקשורת' }, { status: 502 })
  }

  // ── 3. Log the outbound message and bump the conversation ──
  const now = new Date().toISOString()
  const { data: saved, error: insertErr } = await admin
    .from('whatsapp_messages')
    .insert({
      conversation_id: conversation.id,
      wa_message_id: waMessageId,
      direction: 'outbound',
      msg_type: 'text',
      body: signedText,
      status: 'sent',
      sent_by: caller.name,
      created_at: now,
    })
    .select('id, wa_message_id, direction, msg_type, body, status, error_detail, sent_by, created_at')
    .single()

  if (insertErr) console.error('[whatsapp/send] message insert failed:', insertErr.message)

  const { error: updateErr } = await admin
    .from('whatsapp_conversations')
    .update({ last_message_at: now })
    .eq('id', conversation.id)
  if (updateErr) console.error('[whatsapp/send] conversation update failed:', updateErr.message)

  // ── 4. Tag the suggestion this came from, if any (stage-3 accuracy tracking) ──
  const suggestionId = (body.suggestion_id ?? '').trim()
  if (suggestionId && UUID.test(suggestionId) && body.suggestion_outcome) {
    const { error: decideErr } = await admin
      .from('whatsapp_suggestions')
      .update({
        outcome: body.suggestion_outcome,
        final_text: text,
        outbound_message_id: saved?.id ?? null,
        decided_by: caller.name,
        decided_at: now,
      })
      .eq('id', suggestionId)
    if (decideErr) console.error('[whatsapp/send] suggestion outcome update failed:', decideErr.message)
  }

  return NextResponse.json({ message: saved ?? null })
}
