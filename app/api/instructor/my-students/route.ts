import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/instructor-identity'

// ─────────────────────────────────────────────────────────────────────────────
// "התלמידים שלי" — the riders in the groups the signed-in instructor teaches.
//
// Which groups those are is not stored anywhere directly: `groups` carries no
// instructor column. The link is class_sessions — a group is "mine" when I am
// credited with one of its sessions, as the lead instructor (instructor_id) or
// as one of several (instructor_ids).
//
// The instructor is resolved from their access token (see lib/instructor-
// identity.ts), never from anything the request names, so this route can only
// ever answer with the caller's own groups.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

// How far back a session still counts as "a group I teach". Long enough to
// survive a between-seasons gap, short enough that groups from two years ago
// don't come back. If nothing at all falls in the window we widen to all time,
// so a returning instructor still sees their roster.
const RECENT_DAYS = 180

type SessionRow = {
  group_id: string | null
  class_name: string | null
  branch: string | null
  session_date: string
  type: 'regular' | 'special' | null
}

type Student = {
  id: string
  name: string
  group: string
  branch: string | null
  parentPhone: string | null
  phone: string | null
}

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export async function GET(req: NextRequest) {
  const auth = await resolveCaller(req.headers.get('authorization'), 'instructor')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { db, adminRoleId } = auth.identity

  // ── 1. Sessions this instructor is credited with ──────────────────────────
  const credited = `instructor_id.eq.${adminRoleId},instructor_ids.cs.{${adminRoleId}}`
  const selectCols = 'group_id, class_name, branch, session_date, type'

  const { data: recent, error: sessErr } = await db
    .from('class_sessions')
    .select(selectCols)
    .or(credited)
    .gte('session_date', daysAgo(RECENT_DAYS))

  if (sessErr) {
    console.error('[instructor/my-students] class_sessions query failed:', sessErr.message)
    return NextResponse.json({ error: 'שגיאה בטעינת הקבוצות' }, { status: 500 })
  }

  // Special activities (מחנה, ימי שיא) are one-off and not group-bound, so they
  // say nothing about which groups are mine. `type` is null on older rows, and
  // null means regular — hence filtering here rather than with a .neq(), which
  // in Postgres would silently drop every null too.
  const regular = (rows: SessionRow[]) => rows.filter(s => s.type !== 'special')

  let sessions = regular((recent ?? []) as SessionRow[])
  if (sessions.length === 0) {
    const { data: all } = await db
      .from('class_sessions')
      .select(selectCols)
      .or(credited)
    sessions = regular((all ?? []) as SessionRow[])
  }

  if (sessions.length === 0) return NextResponse.json({ students: [], groups: 0 })

  // ── 2. Turn those sessions into a set of groups ───────────────────────────
  // A session either carries group_id outright or only a name + branch, the
  // same two shapes the attendance screens handle (see lib/rider-groups.ts).
  const byId = new Map<string, { name: string; branch: string | null }>()
  const byName = new Map<string, { name: string; branch: string | null }>()
  for (const s of sessions) {
    const name = s.class_name ?? ''
    if (s.group_id) {
      if (!byId.has(s.group_id)) byId.set(s.group_id, { name, branch: s.branch })
    } else if (name) {
      const key = `${name}|${s.branch ?? ''}`
      if (!byName.has(key)) byName.set(key, { name, branch: s.branch })
    }
  }

  // Resolve the name-only ones against `groups`, so they can use the junction
  // table too; whatever stays unresolved falls back to riders.group_name.
  const unresolved: Array<{ name: string; branch: string | null }> = []
  if (byName.size > 0) {
    const names = [...new Set([...byName.values()].map(g => g.name))]
    const { data: groupRows } = await db
      .from('groups')
      .select('id, name, branch')
      .in('name', names)
    const found = new Map(
      ((groupRows ?? []) as Array<{ id: string; name: string; branch: string | null }>)
        .map(g => [`${g.name}|${g.branch ?? ''}`, g]),
    )
    for (const [key, g] of byName) {
      const hit = found.get(key)
      if (hit) { if (!byId.has(hit.id)) byId.set(hit.id, { name: g.name, branch: g.branch }) }
      else unresolved.push(g)
    }
  }

  // ── 3. Riders of those groups ─────────────────────────────────────────────
  const students: Student[] = []
  const seen = new Set<string>()

  const groupIds = [...byId.keys()]
  if (groupIds.length > 0) {
    const { data: links } = await db
      .from('rider_groups')
      .select('rider_id, group_id')
      .in('group_id', groupIds)

    const memberships = (links ?? []) as Array<{ rider_id: string; group_id: string }>
    const riderIds = [...new Set(memberships.map(m => m.rider_id))]

    if (riderIds.length > 0) {
      const { data: riderRows } = await db
        .from('riders')
        .select('id, full_name, phone, parent_phone')
        .in('id', riderIds)
      const riderOf = new Map(
        ((riderRows ?? []) as Array<{ id: string; full_name: string; phone: string | null; parent_phone: string | null }>)
          .map(r => [r.id, r]),
      )

      for (const m of memberships) {
        const r = riderOf.get(m.rider_id)
        const g = byId.get(m.group_id)
        if (!r || !g) continue
        const key = `${r.id}|${m.group_id}`
        if (seen.has(key)) continue
        seen.add(key)
        students.push({
          id: r.id,
          name: r.full_name,
          group: g.name,
          branch: g.branch,
          parentPhone: r.parent_phone,
          phone: r.phone,
        })
      }
    }
  }

  // Legacy groups with no row in `groups`: riders carry the group name directly.
  for (const g of unresolved) {
    let q = db
      .from('riders')
      .select('id, full_name, phone, parent_phone')
      .eq('group_name', g.name)
      .eq('is_regular', true)
    if (g.branch) q = q.eq('branch', g.branch)
    const { data: riderRows } = await q

    for (const r of (riderRows ?? []) as Array<{ id: string; full_name: string; phone: string | null; parent_phone: string | null }>) {
      const key = `${r.id}|${g.name}`
      if (seen.has(key)) continue
      seen.add(key)
      students.push({
        id: r.id, name: r.full_name, group: g.name, branch: g.branch,
        parentPhone: r.parent_phone, phone: r.phone,
      })
    }
  }

  students.sort((a, b) =>
    a.group.localeCompare(b.group, 'he') || a.name.localeCompare(b.name, 'he'))

  const groupCount = new Set(students.map(s => s.group)).size
  return NextResponse.json({ students, groups: groupCount })
}
