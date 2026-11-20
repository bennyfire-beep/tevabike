import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Who may log hours for the "גפן" special activity, and how a session for it
// gets created. Two entry points share this: the "★ גפן" tab on the instructor
// screen (app/admin/instructor/page.tsx) and the "★ גפן" button next to
// "★ פעילות מיוחדת" on the coordinator attendance screen
// (app/admin/coordinator/attendance/page.tsx).
//
// Deliberately separate from SALARY_ADMINS (lib/salary-access.ts): that list
// decides who may SEE pay; this one decides who may fill in the Gefen form at
// all. Benny is on both lists for different reasons — here because he logs his
// own (unpaid) Gefen hours, there because he is a salary admin.
//
// UI-only gating, same as the rest of this app's per-person screens (e.g.
// isBenny) — the real payroll enforcement is that only a salary admin can ever
// read staff_pay or the pay reports. A stray insert from someone not on this
// list would just be an ordinary special-activity session, priced at their own
// rate rather than the fixed Gefen one, since it would come in with
// is_gefen unset from a screen these two are the only ones shown.
// ─────────────────────────────────────────────────────────────────────────────

export const GEFEN_PEOPLE = [
  { email: 'bennyfire@gmail.com', name: 'בני להט' },
  { email: 'talmatoki@gmail.com', name: 'טל ברקן' },
] as const

export const GEFEN_USERS = GEFEN_PEOPLE.map(p => p.email)

// The coordinator screen picks WHICH instructor a Gefen session is credited to
// from the same admin_roles instructor list every session uses — matched by
// name, since that list carries no email. Not a security boundary (the button
// itself is already gated by isGefenUser); just which names the picker offers.
//
// A separate list from GEFEN_PEOPLE: Benny and Tal are still the only ones who
// fill in the form, but they also log hours on behalf of instructors who don't
// (Ofir Cohen, paid at his own staff_pay.gefen_hourly_rate). If Ofir should
// log his own hours, add him to GEFEN_PEOPLE (ofiros396@gmail.com) — that also
// shows him the "★ גפן" tab on the instructor screen.
export const GEFEN_LOGGER_NAMES = GEFEN_PEOPLE.map(p => p.name)
export const GEFEN_INSTRUCTOR_NAMES: readonly string[] = [...GEFEN_LOGGER_NAMES, 'אופיר כהן']

export function isGefenUser(email: string | null | undefined): boolean {
  if (!email) return false
  return (GEFEN_USERS as readonly string[]).includes(email.trim().toLowerCase())
}

export interface CreateGefenSessionInput {
  /** admin_roles.id of the INSTRUCTOR row this session is credited to — not
   *  a coordinator row's id, even when the caller is a coordinator, or the
   *  pay reports (which key off the instructor row) will never see it. */
  instructorId: string
  /** School name — stored in `branch`, same free-text field a regular
   *  session's location lives in. */
  school: string
  hours: number
  /** yyyy-mm-dd, local — the day the activity happened. */
  date: string
}

export interface GefenSessionRow {
  id: string
  session_date: string
  branch: string | null
  duration: number | null
  created_at: string | null
}

/**
 * Create one גפן session. No participant roster, unlike an ordinary special
 * activity — a school class isn't in `riders` — and is_gefen: true so the
 * payroll code prices it at the credited instructor's Gefen rate (gefenRateOf in
 * lib/attendance.ts: staff_pay.gefen_hourly_rate, else GEFEN_HOURLY_RATE)
 * instead of the instructor's own staff_pay.hourly_rate.
 */
export async function createGefenSession(
  { instructorId, school, hours, date }: CreateGefenSessionInput,
  client: SupabaseClient = supabase,
): Promise<{ data: GefenSessionRow | null; error: string | null }> {
  const { data, error } = await client
    .from('class_sessions')
    .insert({
      type: 'special',
      is_gefen: true,
      activity_name: 'גפן',
      class_name: 'גפן',   // keep class_name populated for pages that read it
      branch: school,
      session_date: date,
      duration: hours,
      instructor_id: instructorId,
      instructor_ids: [instructorId],
      status: 'open',
    })
    .select('id, session_date, branch, duration, created_at')
    .single()

  return { data: data as GefenSessionRow | null, error: error?.message ?? null }
}
