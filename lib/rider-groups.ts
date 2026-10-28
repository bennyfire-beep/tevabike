import { supabase } from './supabase'

// Group membership lives in the `rider_groups` junction table (many-to-many
// between riders and groups). These helpers centralise reads against it so the
// various role pages stay consistent.

/**
 * Resolve a group's id. Coordinator-created sessions carry a `group_id`
 * directly; legacy or instructor-created ones only have `class_name` + `branch`,
 * so fall back to a name/branch lookup against the `groups` table.
 */
export async function resolveGroupId(
  groupId: string | null | undefined,
  className: string,
  branch: string,
): Promise<string | null> {
  if (groupId) return groupId
  const { data } = await supabase
    .from('groups')
    .select('id')
    .eq('name', className)
    .eq('branch', branch)
    .maybeSingle()
  return data?.id ?? null
}

/** Rider ids linked to a group. */
export async function groupRiderIds(groupId: string): Promise<string[]> {
  const { data } = await supabase
    .from('rider_groups')
    .select('rider_id')
    .eq('group_id', groupId)
  return (data ?? []).map(r => r.rider_id)
}

/** Group ids a rider is linked to. */
export async function riderGroupIds(riderId: string): Promise<string[]> {
  const { data } = await supabase
    .from('rider_groups')
    .select('group_id')
    .eq('rider_id', riderId)
  return (data ?? []).map(r => r.group_id)
}

export interface RegisterSession {
  id: string
  group_id: string | null
  class_name: string
  branch: string
  session_date: string
}

/**
 * Load a regular session's register: the riders to list and their present /
 * absent marks.
 *
 * The `attendance` table is the source of truth. Once a register has been saved
 * its rows are what the screen shows and counts — not the group's current
 * membership, which drifts (riders join or leave after the lesson, or a rider
 * from a sibling group trains as a guest and is never in rider_groups). Rows
 * are matched by session_id, plus legacy rows for the same group and date that
 * were saved without a session_id.
 *
 * Only a register with no attendance rows yet falls back to the group roster
 * (rider_groups), everyone defaulted to present, ready to be marked.
 */
export async function loadRegister<R extends { id: string; full_name: string }>(
  s: RegisterSession,
  riderCols: string,
): Promise<{ riders: R[]; attendance: Record<string, boolean> }> {
  const groupId = await resolveGroupId(s.group_id, s.class_name, s.branch)

  const [bySession, byDate] = await Promise.all([
    supabase.from('attendance').select('rider_id, present').eq('session_id', s.id),
    groupId
      ? supabase.from('attendance').select('rider_id, present')
          .eq('group_id', groupId).eq('date', s.session_date).is('session_id', null)
      : Promise.resolve({ data: [] as Array<{ rider_id: string; present: boolean }> }),
  ])

  const marks: Record<string, boolean> = {}
  // session_id rows win over legacy date-only rows for the same rider.
  for (const a of byDate.data ?? []) if (a.rider_id) marks[a.rider_id] = !!a.present
  for (const a of bySession.data ?? []) if (a.rider_id) marks[a.rider_id] = !!a.present

  let ids = Object.keys(marks)
  if (ids.length === 0) {
    if (groupId) {
      ids = await groupRiderIds(groupId)
    } else {
      // Legacy fallback when no matching group row exists.
      const { data } = await supabase
        .from('riders').select('id')
        .eq('group_name', s.class_name).eq('branch', s.branch).eq('is_regular', true)
      ids = (data ?? []).map(r => r.id)
    }
    for (const id of ids) marks[id] = true
  }

  let riders: R[] = []
  if (ids.length) {
    const { data } = await supabase.from('riders').select(riderCols).in('id', ids).order('full_name')
    riders = (data ?? []) as unknown as R[]
  }
  return { riders, attendance: marks }
}
