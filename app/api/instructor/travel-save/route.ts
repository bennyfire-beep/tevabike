import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// One day's travel report from the no-login instructor mobile page.
//
// instructor_travel_days is writable only by the salary admins under RLS, so
// the write runs with the service role — the same arrangement as
// /api/instructor/save. Because the page has no login, the instructor_id is
// checked against admin_roles before anything is written under it.
//
// One row per instructor per day (unique on instructor_id + travel_date), so a
// second report for the same day corrects the first rather than adding to it.

export const dynamic = 'force-dynamic'

const MAX_KM = 1000

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('[instructor/travel-save] SUPABASE_SERVICE_ROLE_KEY or URL not set — instructor_travel_days is not writable without it.')
    return NextResponse.json({ error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 500 })
  }

  let body: { instructor_id?: string; travel_date?: string; origin?: string; km?: number | string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const instructorId = String(body.instructor_id ?? '').trim()
  const travelDate   = String(body.travel_date ?? '').trim()
  const origin       = String(body.origin ?? '').trim()
  const km           = Math.round(Number(body.km) * 100) / 100

  if (!instructorId) return NextResponse.json({ error: 'חסר מזהה מדריך' }, { status: 400 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) return NextResponse.json({ error: 'תאריך לא תקין' }, { status: 400 })
  if (!origin) return NextResponse.json({ error: 'צריך למלא מאיפה הגעת' }, { status: 400 })
  if (origin.length > 120) return NextResponse.json({ error: 'שם המקום ארוך מדי' }, { status: 400 })
  if (!Number.isFinite(km) || km < 0 || km > MAX_KM) {
    return NextResponse.json({ error: `מספר ק״מ לא תקין (0–${MAX_KM})` }, { status: 400 })
  }

  const db = createClient(url, serviceKey)

  // No login on this page — make sure the id really belongs to an instructor
  // before writing a travel day under it.
  const { data: role, error: roleErr } = await db
    .from('admin_roles')
    .select('id')
    .eq('id', instructorId)
    .eq('role', 'instructor')
    .maybeSingle()
  if (roleErr) {
    console.error('[instructor/travel-save] admin_roles lookup failed:', roleErr.message)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
  if (!role) return NextResponse.json({ error: 'מדריך לא נמצא' }, { status: 404 })

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
