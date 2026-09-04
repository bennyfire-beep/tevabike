import { NextRequest, NextResponse } from 'next/server'
import { whatsappServiceClient, requireCoordinator, canAccessConversation } from '@/lib/whatsapp-server'

// POST /api/whatsapp/suggestions/reject — { suggestion_id }.
//
// The "דחה" button on the coordinator screen's suggestion card: the
// coordinator dismissed the draft without sending it (writing their own
// reply instead). Just a stage-3 outcome flag — see
// supabase/migrations/20260906_whatsapp_suggestions.sql — never sends or
// deletes anything.

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  const admin = whatsappServiceClient()
  if (!admin) return NextResponse.json({ error: 'השרת לא מוגדר נכון' }, { status: 500 })

  const auth = await requireCoordinator(req, admin)
  if (!auth.ok) return auth.response
  const { caller } = auth

  let body: { suggestion_id?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }) }

  const suggestionId = (body.suggestion_id ?? '').trim()
  if (!UUID.test(suggestionId)) return NextResponse.json({ error: 'מזהה הצעה לא תקין' }, { status: 400 })

  const { data: suggestion, error: readErr } = await admin
    .from('whatsapp_suggestions')
    .select('id, conversation_id')
    .eq('id', suggestionId)
    .maybeSingle()
  if (readErr) {
    console.error('[whatsapp/suggestions/reject] suggestion read failed:', readErr.message)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
  if (!suggestion) return NextResponse.json({ error: 'ההצעה לא נמצאה' }, { status: 404 })

  const { data: conversation, error: convErr } = await admin
    .from('whatsapp_conversations')
    .select('assigned_to')
    .eq('id', suggestion.conversation_id)
    .maybeSingle()
  if (convErr) {
    console.error('[whatsapp/suggestions/reject] conversation read failed:', convErr.message)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
  if (!conversation || !canAccessConversation(caller, conversation.assigned_to)) {
    return NextResponse.json({ error: 'השיחה משויכת לרכז אחר' }, { status: 403 })
  }

  const { error: updateErr } = await admin
    .from('whatsapp_suggestions')
    .update({ outcome: 'rejected', decided_by: caller.name, decided_at: new Date().toISOString() })
    .eq('id', suggestionId)
  if (updateErr) {
    console.error('[whatsapp/suggestions/reject] update failed:', updateErr.message)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
