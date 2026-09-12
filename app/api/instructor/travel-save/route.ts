import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/instructor-identity'

// One day's travel report from the instructor mobile page.
//
// instructor_travel_days is writable only by the salary admins under RLS, so
// the write runs with the service role — the same arrangement as
// /api/instructor/save. The instructor_id it writes under comes from the
// caller's own verified token (resolveCaller), never from the request body —
// otherwise anyone who learned another instructor's admin_roles id could file
// travel/km under their name.
//
// One row per instructor per day (unique on instructor_id + travel_date), so a
// second report for the same day corrects the first rather than adding to it.

export const dynamic = 'force-dynamic'

const MAX_KM = 1000

export async function POST(req: NextRequest) {
  const result = await resolveCaller(req.headers.get('authorization'), 'instructor')
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  const { db, adminRoleId: instructorId } = result.identity

  let body: { travel_date?: string; origin?: string; km?: number | string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const travelDate = String(body.travel_date ?? '').trim()
  const origin     = String(body.origin ?? '').trim()
  const km         = Math.round(Number(body.km) * 100) / 100

  if (!/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) return NextResponse.json({ error: 'תאריך לא תקין' }, { status: 400 })
  if (!origin) return NextResponse.json({ error: 'צריך למלא מאיפה הגעת' }, { status: 400 })
  if (origin.length > 120) return NextResponse.json({ error: 'שם המקום ארוך מדי' }, { status: 400 })
  if (!Number.isFinite(km) || km < 0 || km > MAX_KM) {
    return NextResponse.json({ error: `מספר ק״מ לא תקין (0–${MAX_KM})` }, { status: 400 })
  }

  const { error } = await db
    .from('instructor_travel_days')
    .upsert(
      { instructor_id: instructorId, travel_date: travelDate, origin, km, updated_at: new Date().toISOString() },
      { onConflict: 'instructor_id,travel_date' },
    )

  if (error) {
    console.error('[instructor/travel-save] upsert failed:', error.message)
    return NextResponse.json({ error: 'שמירת הנסיעות נכשלה' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, saved: { origin, km } })
}
