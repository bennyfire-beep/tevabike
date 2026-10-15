import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/instructor-identity'

// ─────────────────────────────────────────────────────────────────────────────
// "דיווח שעות עבודה" — an instructor logs their own non-lesson work hours
// (עבודה במועדון, מחסן, בניה, הכנת ציוד, ...) without a coordinator.
//
// The row is a class_sessions special activity in exactly the shape the
// coordinator's createSpecialActivity (app/admin/coordinator/attendance) makes,
// so every pay report (my-salary, payroll, salaries, accountant) prices it as
// duration × staff_pay.hourly_rate with no change. No participant roster:
// special-activity pay never looks at attendance, and the גפן sessions already
// live without one.
//
// Security, the whole of it:
//   • The instructor is resolveCaller(…, 'instructor') — derived from the
//     verified access token. Nothing in the request body can name an
//     instructor; an instructor_id sent in the body is simply never read.
//   • Edit/delete only touch rows that are this caller's own (instructor_id),
//     type='special', not group-bound, not גפן, AND created_via =
//     'instructor_self_report'. Sessions a coordinator created in the
//     instructor's name have created_via null and are refused, so an
//     instructor cannot remove hours management entered for them.
//   • Edit/delete are allowed only while the session is in the current or the
//     previous month (Israel time). There is no payroll-approval flag in the
//     system, so "the previous month that hasn't been approved yet" is
//     approximated by "the previous month".
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

const CREATED_VIA = 'instructor_self_report'
const MAX_DAYS_BACK = 14
const MIN_HOURS = 0.25
const MAX_HOURS = 16
const MAX_NAME = 60
const MAX_NOTES = 500

const COLS = 'id, session_date, activity_name, class_name, duration, notes, created_via, created_at, instructor_id, group_id, type, is_gefen'

type Row = {
  id: string
  session_date: string
  activity_name: string | null
  class_name: string | null
  duration: number | null
  notes: string | null
  created_via: string | null
  created_at: string | null
  instructor_id: string | null
  group_id: string | null
  type: string | null
  is_gefen: boolean | null
}

// ── Dates, in Israel time ───────────────────────────────────────────────────
// Vercel runs in UTC; between midnight and 02:00/03:00 Israel time the server's
// own date is still yesterday, so "today" must be computed for Asia/Jerusalem
// or an instructor reporting just after midnight would be told it's the future.
function israelToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())
}

/** yyyy-mm-dd shifted by whole days — pure calendar math, no timezone. */
function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return t.toISOString().slice(0, 10)
}

function isRealDate(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false
  const [y, m, d] = ymd.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/** First day of the previous month — the oldest date still editable. */
function editableFrom(today: string): string {
  const [y, m] = today.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 2, 1))
  return t.toISOString().slice(0, 10)
}

const json = (body: unknown, status = 200) => NextResponse.json(body, { status })

type Fields = { date: string; name: string; hours: number; notes: string | null }

/** Validate the user-editable fields. Never reads an instructor from the body. */
function parseFields(body: Record<string, unknown>, today: string): { ok: true; f: Fields } | { ok: false; error: string } {
  const date  = typeof body.date === 'string' ? body.date.trim() : ''
  const name  = typeof body.activity_name === 'string' ? body.activity_name.trim() : ''
  const hours = typeof body.hours === 'number' ? body.hours : Number(body.hours)
  const notesRaw = typeof body.notes === 'string' ? body.notes.trim() : ''

  if (!isRealDate(date)) return { ok: false, error: 'תאריך לא תקין' }
  if (date > today) return { ok: false, error: 'אי אפשר לדווח על תאריך עתידי' }
  if (date < addDays(today, -MAX_DAYS_BACK)) return { ok: false, error: `אפשר לדווח עד ${MAX_DAYS_BACK} יום אחורה` }
  if (!name) return { ok: false, error: 'צריך למלא שם פעילות' }
  if (name.length > MAX_NAME) return { ok: false, error: `שם הפעילות ארוך מדי (עד ${MAX_NAME} תווים)` }
  if (!Number.isFinite(hours) || hours < MIN_HOURS || hours > MAX_HOURS) {
    return { ok: false, error: `מספר השעות חייב להיות בין ${MIN_HOURS} ל-${MAX_HOURS}` }
  }
  if (notesRaw.length > MAX_NOTES) return { ok: false, error: `ההערות ארוכות מדי (עד ${MAX_NOTES} תווים)` }

  return { ok: true, f: { date, name, hours: Math.round(hours * 100) / 100, notes: notesRaw || null } }
}

function toEntry(r: Row, adminRoleId: string, from: string) {
  return {
    id: r.id,
    session_date: r.session_date,
    activity_name: r.activity_name ?? r.class_name ?? 'פעילות מיוחדת',
    duration: Number(r.duration ?? 0),
    notes: r.notes,
    created_at: r.created_at,
    self_reported: r.created_via === CREATED_VIA,
    editable: isOwnSelfReport(r, adminRoleId) && r.session_date >= from,
  }
}

function isOwnSelfReport(r: Row, adminRoleId: string): boolean {
  return r.created_via === CREATED_VIA
    && r.instructor_id === adminRoleId
    && r.type === 'special'
    && r.group_id === null
    && r.is_gefen !== true
}

/**
 * Load a row for edit/delete and check it is the caller's own, self-reported,
 * still-open hours entry. 404 for anything that isn't theirs, so the route
 * doesn't confirm other people's session ids exist.
 */
async function loadOwn(
  db: import('@supabase/supabase-js').SupabaseClient,
  id: string,
  adminRoleId: string,
  today: string,
): Promise<{ ok: true; row: Row } | { ok: false; status: number; error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, status: 400, error: 'מזהה לא תקין' }
  const { data, error } = await db.from('class_sessions').select(COLS).eq('id', id).maybeSingle()
  if (error) {
    console.error('[instructor/report-hours] lookup failed:', error.message)
    return { ok: false, status: 500, error: 'שגיאה בטעינת הדיווח' }
  }
  const row = data as Row | null
  if (!row || row.instructor_id !== adminRoleId) return { ok: false, status: 404, error: 'הדיווח לא נמצא' }
  if (!isOwnSelfReport(row, adminRoleId)) {
    return { ok: false, status: 403, error: 'אפשר לשנות רק דיווח שעות שמילאת בעצמך' }
  }
  if (row.session_date < editableFrom(today)) {
    return { ok: false, status: 403, error: 'הדיווח שייך לחודש שכבר נסגר — פנה/י לרכז' }
  }
  return { ok: true, row }
}

// ── GET: this month's work hours, plus last month's own still-editable reports
export async function GET(req: NextRequest) {
  const auth = await resolveCaller(req.headers.get('authorization'), 'instructor')
  if (!auth.ok) return json({ error: auth.error }, auth.status)
  const { db, adminRoleId } = auth.identity

  const today = israelToday()
  const from  = editableFrom(today)
  const monthStart = today.slice(0, 7) + '-01'

  // Every non-גפן special activity credited to this instructor (led or
  // co-led) since the start of last month. Same credit rule as my-salary.
  const { data, error } = await db
    .from('class_sessions')
    .select(COLS + ', instructor_ids')
    .or(`instructor_id.eq.${adminRoleId},instructor_ids.cs.{${adminRoleId}}`)
    .eq('type', 'special')
    .not('is_gefen', 'is', true)
    .gte('session_date', from)
    .order('session_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[instructor/report-hours] list failed:', error.message)
    return json({ error: 'טעינת הדיווחים נכשלה' }, 500)
  }

  const rows = (data ?? []) as unknown as Row[]
  // Current month: everything. Previous month: only what's still theirs to fix.
  const entries = rows
    .filter(r => r.session_date >= monthStart || isOwnSelfReport(r, adminRoleId))
    .map(r => toEntry(r, adminRoleId, from))

  return json({
    today,
    minDate: addDays(today, -MAX_DAYS_BACK),
    monthStart,
    entries,
  })
}

// ── POST: create a report for the signed-in instructor ────────────────────
export async function POST(req: NextRequest) {
  const auth = await resolveCaller(req.headers.get('authorization'), 'instructor')
  if (!auth.ok) return json({ error: auth.error }, auth.status)
  const { db, adminRoleId } = auth.identity

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'בקשה לא תקינה' }, 400) }
  if (!body || typeof body !== 'object') return json({ error: 'בקשה לא תקינה' }, 400)

  const today = israelToday()
  const parsed = parseFields(body, today)
  if (!parsed.ok) return json({ error: parsed.error }, 400)
  const { date, name, hours, notes } = parsed.f

  const { data, error } = await db
    .from('class_sessions')
    .insert({
      type: 'special',
      activity_name: name,
      class_name: name,          // keep class_name populated for pages that read it
      branch: null,
      session_date: date,
      duration: hours,
      instructor_id: adminRoleId,          // from the token — never from the body
      instructor_ids: [adminRoleId],
      status: 'open',
      notes,
      created_via: CREATED_VIA,
    })
    .select(COLS)
    .single()

  if (error || !data) {
    console.error('[instructor/report-hours] insert failed:', error?.message)
    return json({ error: 'השמירה נכשלה' }, 500)
  }
  return json({ entry: toEntry(data as Row, adminRoleId, editableFrom(today)) })
}

// ── PATCH: fix one of my own reports ──────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const auth = await resolveCaller(req.headers.get('authorization'), 'instructor')
  if (!auth.ok) return json({ error: auth.error }, auth.status)
  const { db, adminRoleId } = auth.identity

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'בקשה לא תקינה' }, 400) }
  if (!body || typeof body !== 'object') return json({ error: 'בקשה לא תקינה' }, 400)

  const today = israelToday()
  const own = await loadOwn(db, typeof body.id === 'string' ? body.id : '', adminRoleId, today)
  if (!own.ok) return json({ error: own.error }, own.status)

  const parsed = parseFields(body, today)
  if (!parsed.ok) return json({ error: parsed.error }, 400)
  const { date, name, hours, notes } = parsed.f

  const { data, error } = await db
    .from('class_sessions')
    .update({ session_date: date, activity_name: name, class_name: name, duration: hours, notes })
    .eq('id', own.row.id)
    .eq('instructor_id', adminRoleId)
    .eq('created_via', CREATED_VIA)
    .select(COLS)
    .single()

  if (error || !data) {
    console.error('[instructor/report-hours] update failed:', error?.message)
    return json({ error: 'העדכון נכשל' }, 500)
  }
  return json({ entry: toEntry(data as Row, adminRoleId, editableFrom(today)) })
}

// ── DELETE ?id=… : remove one of my own reports ──────────────────────────
export async function DELETE(req: NextRequest) {
  const auth = await resolveCaller(req.headers.get('authorization'), 'instructor')
  if (!auth.ok) return json({ error: auth.error }, auth.status)
  const { db, adminRoleId } = auth.identity

  const id = req.nextUrl.searchParams.get('id') ?? ''
  const own = await loadOwn(db, id, adminRoleId, israelToday())
  if (!own.ok) return json({ error: own.error }, own.status)

  // A self-report has no roster, but clear any attendance rows first in case
  // one was ever attached, so no orphans point at a deleted session.
  await db.from('attendance').delete().eq('session_id', own.row.id)

  const { error } = await db
    .from('class_sessions')
    .delete()
    .eq('id', own.row.id)
    .eq('instructor_id', adminRoleId)
    .eq('created_via', CREATED_VIA)

  if (error) {
    console.error('[instructor/report-hours] delete failed:', error.message)
    return json({ error: 'המחיקה נכשלה' }, 500)
  }
  return json({ ok: true })
}
