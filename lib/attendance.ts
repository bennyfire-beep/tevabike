import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

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
//     authenticated, so RLS lets it read admin_roles.pay_multiplier);
//   • the instructor mobile page has no login, so it saves via an API route
//     that passes a service-role client here — that keeps admin_roles (which
//     holds staff PII) off the public anon key while still applying the
//     correct multiplier.
//
// Pay model — regular sessions (type 'regular'):
//   • present_count = riders marked present for the session
//   • base amount   = matching row in `pay_rates`
//                     (present_count between min_riders and max_riders,
//                      max_riders NULL = no upper cap)
//   • instructor_pay = base amount × the session instructor's pay_multiplier
//
// Pay model — special activities / camps (type 'special'):
//   • pay does NOT depend on attendance; it is duration_hours × hourly_rate.
//   • a special activity can have several instructors (session.instructor_ids);
//     each is paid duration × their own admin_roles.hourly_rate. The value we
//     store in class_sessions.instructor_pay is the activity total (the sum
//     across instructors); the payroll report splits it back per instructor.
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
 * Resolve the base pay amount for a present-count from the `pay_rates` table,
 * then scale it by the instructor's multiplier. Returns 0 if no rate matches.
 */
export async function computePay(
  presentCount: number,
  multiplier: number,
  client: SupabaseClient = supabase,
): Promise<number> {
  const { data } = await client
    .from('pay_rates')
    .select('min_riders, max_riders, amount')
  const rows = data ?? []
  const match = rows.find(
    r => presentCount >= r.min_riders && (r.max_riders == null || presentCount <= r.max_riders),
  )
  const amount = match ? Number(match.amount) : 0
  const m = multiplier != null && !Number.isNaN(multiplier) ? multiplier : 1
  return Math.round(amount * m * 100) / 100
}

/**
 * Total pay for a special activity = duration_hours × Σ hourly_rate over its
 * instructors. Instructors with no hourly_rate set contribute 0 (shows as ₪0 in
 * the report, prompting the coordinator to fill the rate in).
 */
export async function computeSpecialPay(
  durationHours: number,
  instructorIds: string[],
  client: SupabaseClient = supabase,
): Promise<number> {
  if (!instructorIds.length) return 0
  const { data } = await client
    .from('admin_roles')
    .select('id, hourly_rate')
    .in('id', instructorIds)
  const sumRates = (data ?? []).reduce((s, r) => s + Number(r.hourly_rate ?? 0), 0)
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
  let pay: number
  if (session.type === 'special') {
    // Special activity: pay is duration × hourly_rate, independent of attendance.
    const instructorIds = (session.instructor_ids && session.instructor_ids.length)
      ? session.instructor_ids
      : (session.instructor_id ? [session.instructor_id] : [])
    pay = await computeSpecialPay(session.duration ?? 0, instructorIds, client)
  } else {
    // Regular session: pay_rates bracket × the instructor's pay multiplier.
    let multiplier = 1
    if (session.instructor_id) {
      const { data: role } = await client
        .from('admin_roles')
        .select('pay_multiplier')
        .eq('id', session.instructor_id)
        .maybeSingle()
      if (role?.pay_multiplier != null) multiplier = Number(role.pay_multiplier)
    }
    pay = await computePay(presentCount, multiplier, client)
  }

  const { error: sessErr } = await client
    .from('class_sessions')
    .update({ present_count: presentCount, instructor_pay: pay })
    .eq('id', session.id)
  if (sessErr) return { presentCount, pay, error: sessErr.message }

  return { presentCount, pay }
}
