import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Fallbacks for instructors with no staff_pay row yet.
//   hourly_rate     → special activities (camps, ימי שיא), paid per hour
//   rate_per_lesson → ordinary weekly lessons, paid a flat rate per lesson
export const DEFAULT_HOURLY_RATE = 90
export const DEFAULT_RATE_PER_LESSON = 150

/**
 * Both instructor rates live in `staff_pay`, keyed by admin_roles.id.
 * They are NOT columns on admin_roles — reading them from there returns a
 * PostgREST error and a null payload, which is how special activities silently
 * came out at ₪0.
 */
async function ratesFor(
  instructorIds: string[],
  client: SupabaseClient,
): Promise<Map<string, { hourly: number; perLesson: number }>> {
  const out = new Map<string, { hourly: number; perLesson: number }>()
  if (!instructorIds.length) return out

  const { data } = await client
    .from('staff_pay')
    .select('admin_role_id, hourly_rate, rate_per_lesson')
    .in('admin_role_id', instructorIds)

  for (const id of instructorIds) {
    const row = (data ?? []).find(r => r.admin_role_id === id)
    out.set(id, {
      hourly:    row?.hourly_rate     == null ? DEFAULT_HOURLY_RATE     : Number(row.hourly_rate),
      perLesson: row?.rate_per_lesson == null ? DEFAULT_RATE_PER_LESSON : Number(row.rate_per_lesson),
    })
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared attendance-save + automatic pay calculation.
//
// Both the coordinator desktop attendance page and the instructor mobile page
// save attendance through `saveAttendanceAndPay`, so the pay logic lives in one
// place and stays identical everywhere. Pay is recomputed on every (re-)save,
// so editing attendance updates the session's pay.
//
// The `client` argument lets callers pass a specific Supabase client:
//   • the desktop page passes the default browser client (the coordinator is
//     authenticated, so RLS lets it read staff_pay);
//   • the instructor mobile page has no login, so it saves via an API route
//     that passes a service-role client here — that keeps staff pay off the
//     public anon key while still applying the correct rates.
//
// Instructors have TWO rates, both on `staff_pay` (keyed by admin_roles.id):
//   • rate_per_lesson — an ordinary weekly lesson, flat per lesson
//   • hourly_rate     — a special activity (camp / ימי שיא), per hour
//
// Pay model — regular sessions (type 'regular'):
//   • instructor_pay = Σ rate_per_lesson over the session's instructors.
//     Attendance no longer scales it: a lesson is a lesson.
//
// Pay model — special activities / camps (type 'special'):
//   • pay does NOT depend on attendance; it is duration_hours × hourly_rate.
//   • a special activity can have several instructors (session.instructor_ids);
//     each is paid duration × their own hourly_rate. The value stored in
//     class_sessions.instructor_pay is the activity total (the sum across
//     instructors); the payroll report splits it back per instructor.
// ─────────────────────────────────────────────────────────────────────────────

export interface SaveSession {
  id: string
  instructor_id: string | null
  group_id: string | null
  session_date: string
  // Present for special activities; absent/'regular' behaves as before.
  type?: 'regular' | 'special' | null
  duration?: number | null
  instructor_ids?: string[] | null
}

export interface SaveRider {
  id: string
  full_name: string
}

export interface SaveResult {
  presentCount: number
  pay: number
  error?: string
}

/**
 * Pay for an ordinary lesson = the instructor's flat rate_per_lesson.
 * Co-taught lessons pay each listed instructor their own rate.
 */
export async function computeRegularPay(
  instructorIds: string[],
  client: SupabaseClient = supabase,
): Promise<number> {
  if (!instructorIds.length) return 0
  const rates = await ratesFor(instructorIds, client)
  const total = instructorIds.reduce(
    (s, id) => s + (rates.get(id)?.perLesson ?? DEFAULT_RATE_PER_LESSON), 0,
  )
  return Math.round(total * 100) / 100
}

/**
 * Total pay for a special activity = duration_hours × Σ hourly_rate over its
 * instructors. Independent of how many riders showed up.
 */
export async function computeSpecialPay(
  durationHours: number,
  instructorIds: string[],
  client: SupabaseClient = supabase,
): Promise<number> {
  if (!instructorIds.length) return 0
  const rates = await ratesFor(instructorIds, client)
  const sumRates = instructorIds.reduce(
    (s, id) => s + (rates.get(id)?.hourly ?? DEFAULT_HOURLY_RATE), 0,
  )
  const hours = Number(durationHours) || 0
  return Math.round(hours * sumRates * 100) / 100
}

/**
 * Upsert the attendance rows for a session, then recompute and persist the
 * session's present_count and instructor_pay. Safe to call repeatedly — every
 * call re-derives the count from the freshly saved rows.
 */
export async function saveAttendanceAndPay(
  session: SaveSession,
  riders: SaveRider[],
  attendance: Record<string, boolean>,
  client: SupabaseClient = supabase,
): Promise<SaveResult> {
  // 1. Persist attendance rows (default present when unset, matching the UI).
  const records = riders.map(r => {
    const present = attendance[r.id] ?? true
    return {
      session_id: session.id,
      rider_id:   r.id,
      rider_name: r.full_name,
      present,
      status:     present ? 'present' : 'absent',
      group_id:   session.group_id,
      date:       session.session_date,
    }
  })

  const { error: attErr } = await client
    .from('attendance')
    .upsert(records, { onConflict: 'session_id,rider_id' })
  if (attErr) return { presentCount: 0, pay: 0, error: attErr.message }

  // 2. Authoritative present count straight from the DB (handles re-saves).
  const { count } = await client
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', session.id)
    .eq('status', 'present')
  const presentCount = count ?? 0

  // 3 + 4. Compute pay depending on the session type, then store it.
  const instructorIds = (session.instructor_ids && session.instructor_ids.length)
    ? session.instructor_ids
    : (session.instructor_id ? [session.instructor_id] : [])

  const pay = session.type === 'special'
    // Special activity: duration × hourly_rate, independent of attendance.
    ? await computeSpecialPay(session.duration ?? 0, instructorIds, client)
    // Ordinary lesson: the instructor's flat per-lesson rate.
    : await computeRegularPay(instructorIds, client)

  const { error: sessErr } = await client
    .from('class_sessions')
    .update({ present_count: presentCount, instructor_pay: pay })
    .eq('id', session.id)
  if (sessErr) return { presentCount, pay, error: sessErr.message }

  return { presentCount, pay }
}
