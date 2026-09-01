import { NextRequest, NextResponse } from 'next/server'
import { whatsappServiceClient, requireCoordinator } from '@/lib/whatsapp-server'
import { normalizeToWaId } from '@/lib/whatsapp'

// POST /api/whatsapp/find-or-create — { phone, display_name? }.
//
// Called from the leads screen's "וואטסאפ API" action: a lead has no
// whatsapp_conversations row until they've actually messaged in, but the
// coordinator wants to jump straight to /admin/coordinator/whatsapp for that
// number anyway (to send once they write in, or because they already have
// and this just wasn't linked up). Finds the row by wa_id, or creates an
// empty unassigned one — same table, same service-role-only write as every
// other whatsapp_conversations mutation.

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const admin = whatsappServiceClient()
  if (!admin) return NextResponse.json({ error: 'השרת לא מוגדר נכון' }, { status: 500 })

  const auth = await requireCoordinator(req, admin)
  if (!auth.ok) return auth.response

  let body: { phone?: string; display_name?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }) }

  const waId = normalizeToWaId(body.phone ?? '')
  if (!waId || waId.length < 11) {
    return NextResponse.json({ error: 'מספר טלפון לא תקין' }, { status: 400 })
  }
  const displayName = (body.display_name ?? '').trim() || null

  const { data: existing, error: readErr } = await admin
    .from('whatsapp_conversations')
    .select('id')
    .eq('wa_id', waId)
    .maybeSingle()

  if (readErr) {
    console.error('[whatsapp/find-or-create] read failed:', readErr.message)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
  if (existing) return NextResponse.json({ id: existing.id, created: false })

  const { data: created, error: insertErr } = await admin
    .from('whatsapp_conversations')
    .insert({ wa_id: waId, display_name: displayName, unread_count: 0 })
    .select('id')
    .single()

  if (insertErr) {
    console.error('[whatsapp/find-or-create] insert failed:', insertErr.message)
    return NextResponse.json({ error: 'יצירת השיחה נכשלה' }, { status: 500 })
  }
  return NextResponse.json({ id: created.id, created: true })
}
