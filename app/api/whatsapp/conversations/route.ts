import { NextRequest, NextResponse } from 'next/server'
import { whatsappServiceClient, requireCoordinator } from '@/lib/whatsapp-server'
import { bodyLabel } from '@/lib/whatsapp'

// GET /api/whatsapp/conversations — the conversation list for the coordinator
// screen. Read with the service role: the anon key can't see these tables
// under RLS, and every real check (is this caller a coordinator/admin?) is
// done here against admin_roles, not left to the client.

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const admin = whatsappServiceClient()
  if (!admin) {
    console.error('[whatsapp/conversations] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: 'השרת לא מוגדר נכון' }, { status: 500 })
  }

  const auth = await requireCoordinator(req, admin)
  if (!auth.ok) return auth.response

  const { data, error } = await admin
    .from('whatsapp_conversations')
    .select('id, wa_id, display_name, last_message_at, last_inbound_at, unread_count')
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (error) {
    console.error('[whatsapp/conversations] query failed:', error.message)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }

  const conversations = data ?? []

  // The list needs a one-line preview of the last message, but that text lives
  // in whatsapp_messages, not on the conversation row. One query for every
  // conversation's messages, newest first, then keep only the first (= latest)
  // per conversation — cheaper than N round trips, and there's no per-row
  // LIMIT in PostgREST to fetch "just the latest" directly.
  const ids = conversations.map(c => c.id)
  const previews = new Map<string, string>()
  if (ids.length > 0) {
    const { data: recent, error: msgErr } = await admin
      .from('whatsapp_messages')
      .select('conversation_id, msg_type, body, created_at')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false })
    if (msgErr) {
      console.error('[whatsapp/conversations] preview query failed:', msgErr.message)
    } else {
      for (const m of recent ?? []) {
        if (!previews.has(m.conversation_id)) previews.set(m.conversation_id, bodyLabel(m.msg_type, m.body))
      }
    }
  }

  return NextResponse.json({
    conversations: conversations.map(c => ({ ...c, last_message_preview: previews.get(c.id) ?? '' })),
  })
}
