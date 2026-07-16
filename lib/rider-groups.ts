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
