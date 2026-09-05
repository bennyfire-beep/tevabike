import { NextRequest, NextResponse } from 'next/server'
import { whatsappServiceClient, requireCoordinator, canAccessConversation } from '@/lib/whatsapp-server'

// POST /api/whatsapp/tags — { conversation_id, tags: string[] }.
//
// Full replace, not append/remove — the page always sends the complete next
// list (same shape as /api/whatsapp/assign's single next value). Free-form:
// no fixed vocabulary table, see the migration's comment. Same ownership
// rule as the rest of /api/whatsapp/*: a coordinator can only tag her own or
// an unassigned conversation, never someone else's.

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_TAGS = 10
const MAX_TAG_LEN = 30

export async function POST(req: NextRequest) {
  const admin = whatsappServiceClient()
  if (!admin) return NextResponse.json({ error: 'השרת לא מוגדר נכון' }, { status: 500 })

  const auth = await requireCoordinator(req, admin)
  if (!auth.ok) return auth.response
  const { caller } = auth

  let body: { conversation_id?: string; tags?: unknown }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }) }

  const conversationId = (body.conversation_id ?? '').trim()
  if (!UUID.test(conversationId)) return NextResponse.json({ error: 'מזהה שיחה לא תקין' }, { status: 400 })

  if (!Array.isArray(body.tags) || !body.tags.every(t => typeof t === 'string')) {
    return NextResponse.json({ error: 'רשימת תגיות לא תקינה' }, { status: 400 })
  }
  const tags = Array.from(new Set(
    (body.tags as string[]).map(t => t.trim()).filter(t => t.length > 0 && t.length <= MAX_TAG_LEN)
  )).slice(0, MAX_TAGS)

  const { data: conversation, error: readErr } = await admin
    .from('whatsapp_conversations')
    .select('id, assigned_to')
    .eq('id', conversationId)
    .maybeSingle()

  if (readErr) {
    console.error('[whatsapp/tags] read failed:', readErr.message)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
  if (!conversation) return NextResponse.json({ error: 'השיחה לא נמצאה' }, { status: 404 })
  if (!canAccessConversation(caller, conversation.assigned_to)) {
    return NextResponse.json({ error: 'השיחה משויכת לרכז אחר' }, { status: 403 })
  }

  const { data: updated, error: updateErr } = await admin
    .from('whatsapp_conversations')
    .update({ tags })
    .eq('id', conversationId)
    .select('id, tags')
    .single()

  if (updateErr) {
    console.error('[whatsapp/tags] update failed:', updateErr.message)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }

  return NextResponse.json({ conversation: updated })
}
