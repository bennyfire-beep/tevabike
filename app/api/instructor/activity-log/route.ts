import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/instructor-identity'
import { ACTIVITY_TYPES, OTHER_ACTIVITY_TYPE, isActivityType } from '@/lib/activity-logs'

// ─────────────────────────────────────────────────────────────────────────────
// "פעילות אחרת" — an instructor reporting hours on something that isn't a
// lesson (צילום, תיקון אופניים, ...), for pay once a salary admin approves it.
//
// Same arrangement as /api/instructor/travel-save: instructor_activity_logs is
// RLS-locked to salary admins only, so this runs with the service role and the
// caller is resolved from their access token via lib/instructor-identity.ts —
// the request can never write a row under anyone else's instructor_id, and GET
// can never read anyone else's.
//
// A report always lands as status='pending' with hourly_rate left null — the
// rate is a salary admin's call at approval time, not something this route
// accepts from the instructor.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

const MAX_HOURS = 24
const MAX_TEXT = 500

const LOG_COLS = 'id, activity_date, activity_type, activity_type_other, description, hours, hourly_rate, status, created_at'

export async function POST(req: NextRequest) {
  const auth = await resolveCaller(req.headers.get('authorization'), 'instructor')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { db, adminRoleId } = auth.identity

  let body: {
    activity_date?: unknown
    activity_type?: unknown
    activity_type_other?: unknown
    description?: unknown
    hours?: unknown
  }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }) }

  const activityDate = typeof body.activity_date === 'string' ? body.activity_date.trim() : ''
  const activityType = typeof body.activity_type === 'string' ? body.activity_type.trim() : ''
  const activityTypeOther = typeof body.activity_type_other === 'string' ? body.activity_type_other.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const hours = Math.round(Number(body.hours) * 100) / 100

  if (!/^\d{4}-\d{2}-\d{2}$/.test(activityDate)) {
    return NextResponse.json({ error: 'תאריך לא תקין' }, { status: 400 })
  }
  if (!isActivityType(activityType)) {
    return NextResponse.json({ error: 'סוג פעילות לא תקין' }, { status: 400 })
  }
  if (activityType === OTHER_ACTIVITY_TYPE && !activityTypeOther) {
    return NextResponse.json({ error: 'צריך לפרט מה בדיוק נעשה' }, { status: 400 })
  }
  if (activityTypeOther.length > MAX_TEXT || description.length > MAX_TEXT) {
    return NextResponse.json({ error: 'הטקסט ארוך מדי' }, { status: 400 })
  }
  if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_HOURS) {
    return NextResponse.json({ error: `מספר שעות לא תקין (0–${MAX_HOURS})` }, { status: 400 })
  }

  const { data, error } = await db
    .from('instructor_activity_logs')
    .insert({
      instructor_id:        adminRoleId,
      activity_date:        activityDate,
      activity_type:        activityType,
      activity_type_other:  activityType === OTHER_ACTIVITY_TYPE ? activityTypeOther : null,
      description:          description || null,
      hours,
      status:                'pending',
    })
    .select(LOG_COLS)
    .single()

  if (error || !data) {
    console.error('[instructor/activity-log] insert failed:', error?.message)
    return NextResponse.json({ error: 'שמירת הדיווח נכשלה' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, log: data })
}

export async function GET(req: NextRequest) {
  const auth = await resolveCaller(req.headers.get('authorization'), 'instructor')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { db, adminRoleId } = auth.identity

  const { data, error } = await db
    .from('instructor_activity_logs')
    .select(LOG_COLS)
    .eq('instructor_id', adminRoleId)
    .order('activity_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[instructor/activity-log] list failed:', error.message)
    return NextResponse.json({ error: 'טעינת הדיווחים נכשלה' }, { status: 500 })
  }

  return NextResponse.json({ logs: data ?? [], activityTypes: ACTIVITY_TYPES })
}
