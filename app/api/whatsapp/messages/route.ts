import { NextRequest, NextResponse } from 'next/server'
import { whatsappServiceClient, requireCoordinator } from '@/lib/whatsapp-server'

// GET /api/whatsapp/messages?conversation_id=... — the open conversation's
// messages, oldest first. Opening a conversation is what "reading" it means
// here, so this also zeroes unread_count for it (per the spec: reset happens
// on entering the conversation, not on send).

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const admin = whatsappServiceClient()
  if (!admin) {
    console.error('[whatsapp/messages] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: 'השרת לא מוגדר נכון' }, { status: 500 })
  }

  const auth = await requireCoordinator(req, admin)
  if (!auth.ok) return auth.response

  const conversationId = (req.nextUrl.searchParams.get('conversation_id') ?? '').trim()
  if (!UUID.test(conversationId)) {
    return NextResponse.json({ error: 'מזהה שיחה לא תקין' }, { status: 400 })
  }

  const { data: conversation, error: convErr } = await admin
    .from('whatsapp_conversations')
    .select('id, wa_id, display_name, last_message_at, last_inbound_at, unread_count')
    .eq('id', conversationId)
    .maybeSingle()

  if (convErr) {
    console.error('[whatsapp/messages] conversation read failed:', convErr.message)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
  if (!conversation) return NextResponse.json({ error: 'השיחה לא נמצאה' }, { status: 404 })

  const { data: messages, error: msgErr } = await admin
    .from('whatsapp_messages')
    .select('id, wa_message_id, direction, msg_type, body, status, error_detail, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (msgErr) {
    console.error('[whatsapp/messages] messages read failed:', msgErr.message)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }

  if ((conversation.unread_count ?? 0) > 0) {
    const { error: resetErr } = await admin
      .from('whatsapp_conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId)
    if (resetErr) console.error('[whatsapp/messages] unread reset failed:', resetErr.message)
    else conversation.unread_count = 0
  }

  return NextResponse.json({ conversation, messages: messages ?? [] })
}
