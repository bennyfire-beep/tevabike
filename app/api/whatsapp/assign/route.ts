import { NextRequest, NextResponse } from 'next/server'
import { whatsappServiceClient, requireCoordinator, canAccessConversation } from '@/lib/whatsapp-server'

// POST /api/whatsapp/assign — { conversation_id, assigned_to: email|null }.
//
// admin can assign to anyone (or unassign). A coordinator can only take an
// unassigned conversation for herself, or hand her own back to unassigned —
// she can never assign it to someone else or take someone else's. This is
// the real enforcement (the RLS policy is the backstop, see the migration).

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  const admin = whatsappServiceClient()
  if (!admin) return NextResponse.json({ error: 'השרת לא מוגדר נכון' }, { status: 500 })

  const auth = await requireCoordinator(req, admin)
  if (!auth.ok) return auth.response
  const { caller } = auth

  let body: { conversation_id?: string; assigned_to?: string | null }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }) }

  const conversationId = (body.conversation_id ?? '').trim()
  if (!UUID.test(conversationId)) return NextResponse.json({ error: 'מזהה שיחה לא תקין' }, { status: 400 })

  const nextAssignee = body.assigned_to ? body.assigned_to.trim().toLowerCase() : null

  const { data: conversation, error: readErr } = await admin
    .from('whatsapp_conversations')
    .select('id, assigned_to')
    .eq('id', conversationId)
    .maybeSingle()

  if (readErr) {
    console.error('[whatsapp/assign] read failed:', readErr.message)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
  if (!conversation) return NextResponse.json({ error: 'השיחה לא נמצאה' }, { status: 404 })
  if (!canAccessConversation(caller, conversation.assigned_to)) {
    return NextResponse.json({ error: 'השיחה משויכת לרכז אחר' }, { status: 403 })
  }

  if (caller.role !== 'admin') {
    const current = conversation.assigned_to ? conversation.assigned_to.toLowerCase() : null
    const claiming = current === null && nextAssignee === caller.email
    const releasing = current === caller.email && nextAssignee === null
    if (!claiming && !releasing) {
      return NextResponse.json({ error: 'ניתן רק לקחת שיחה לא משויכת אליך, או להחזיר שיחה שלך' }, { status: 403 })
    }
  } else if (nextAssignee) {
    // Admin assigning to someone else — that person has to actually be a
    // coordinator/admin, or the conversation vanishes from everyone's inbox.
    const { data: target } = await admin
      .from('admin_roles')
      .select('user_id')
      .in('role', ['admin', 'coordinator'])
    const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 200 })
    const validEmails = new Set(
      (target ?? [])
        .map(t => usersPage?.users.find(u => u.id === t.user_id)?.email?.toLowerCase())
        .filter((e): e is string => Boolean(e))
    )
    if (!validEmails.has(nextAssignee)) {
      return NextResponse.json({ error: 'האימייל שנבחר אינו רכז/אדמין' }, { status: 400 })
    }
  }

  const { data: updated, error: updateErr } = await admin
    .from('whatsapp_conversations')
    .update({ assigned_to: nextAssignee, assigned_at: nextAssignee ? new Date().toISOString() : null })
    .eq('id', conversationId)
    .select('id, assigned_to, assigned_at')
    .single()

  if (updateErr) {
    console.error('[whatsapp/assign] update failed:', updateErr.message)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }

  return NextResponse.json({ conversation: updated })
}
