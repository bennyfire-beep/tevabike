import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Fallbacks for instructors with no staff_pay row yet.
//   hourly_rate     → special activities (camps, ימי שיא), paid per hour
//   rate_per_lesson → ordinary weekly lessons, paid a flat rate per lesson
// The pay reports import these; they are constants, not pay data.
export const DEFAULT_HOURLY_RATE = 90
export const DEFAULT_RATE_PER_LESSON = 150

// ─────────────────────────────────────────────────────────────────────────────
// Shared attendance save.
//
// Both the coordinator desktop attendance page and the instructor mobile page
// save through `saveAttendance`, so the behaviour stays identical everywhere.
//
// This function deliberately does NOT touch pay. Marking a register is an
// everyday job for any coordinator or instructor, while pay is restricted to
// the salary admins — computing it here meant reading staff_pay as whoever
// happened to be saving, and echoing the amount back to them on screen. RLS now
// refuses that read anyway. The pay reports derive every amount live from
// staff_pay (see lib/travel.ts and the report screens), so nothing depends on a
// stored figure.
//
// The `client` argument lets callers pass a specific Supabase client: the
// instructor mobile page has no login and saves via an API route that supplies
// a service-role client.
// ─────────────────────────────────────────────────────────────────────────────

export interface SaveSession {
  id: string
  instructor_id: string | null
  group_id: string | null
  session_date: string
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
  error?: string
}

/**
 * Upsert the attendance rows for a session and refresh its present_count.
 * Safe to call repeatedly — every call re-derives the count from the rows
 * that were just saved.
 */
export async function saveAttendance(
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
  if (attErr) return { presentCount: 0, error: attErr.message }

  // 2. Authoritative present count straight from the DB (handles re-saves).
  const { count } = await client
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', session.id)
    .eq('status', 'present')
  const presentCount = count ?? 0

  const { error: sessErr } = await client
    .from('class_sessions')
    .update({ present_count: presentCount })
    .eq('id', session.id)
  if (sessErr) return { presentCount, error: sessErr.message }

  return { presentCount }
}

/** @deprecated Use saveAttendance — kept so existing imports keep compiling. */
export const saveAttendanceAndPay = saveAttendance
