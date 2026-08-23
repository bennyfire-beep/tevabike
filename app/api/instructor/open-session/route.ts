import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/instructor-identity'

// ─────────────────────────────────────────────────────────────────────────────
// "Open today's register for this group."
//
// Instructors cover for each other, so the group list on the instructor screen
// is every group in the club, not only the ones the caller usually teaches.
// Picking a group that has no session scheduled for the day has to produce one
// to hang the attendance rows off, which is what this route does.
//
// Two rules worth stating, because both are about pay:
//
//   • An existing session is returned untouched. In particular the substitute
//     is NOT added to instructor_id / instructor_ids — that would silently move
//     the lesson's pay from the scheduled instructor to whoever opened the
//     register. Who gets paid for a covered lesson is a management decision,
//     made on the coordinator screens.
//   • A session this route creates is credited to its creator, because there is
//     nobody else it could belong to.
//
// The caller is resolved from their access token; the request cannot name an
// instructor.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

const SESSION_COLS =
  'id, class_name, branch, session_date, instructor_id, group_id, start_time, duration, type, instructor_ids'

export async function POST(req: NextRequest) {
  const auth = await resolveCaller(req.headers.get('authorization'))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { db, adminRoleId } = auth.identity

  let body: { group_id?: unknown; date?: unknown }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }) }

  const groupId = typeof body.group_id === 'string' ? body.group_id.trim() : ''
  const date    = typeof body.date === 'string' ? body.date.trim() : ''
  if (!groupId) return NextResponse.json({ error: 'חסר מזהה קבוצה' }, { status: 400 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'תאריך לא תקין' }, { status: 400 })

  // ── An existing register for that group and day wins ──────────────────────
  const { data: existing, error: findErr } = await db
    .from('class_sessions')
    .select(SESSION_COLS)
    .eq('group_id', groupId)
    .eq('session_date', date)
    .order('start_time', { nullsFirst: true })
    .limit(1)

  if (findErr) {
    console.error('[instructor/open-session] lookup failed:', findErr.message)
    return NextResponse.json({ error: 'שגיאה בטעינת האימון' }, { status: 500 })
  }
  const found = existing?.[0]
  if (found) return NextResponse.json({ session: found, created: false })

  // ── Otherwise open one from the group's standing details ──────────────────
  const { data: group, error: groupErr } = await db
    .from('groups')
    .select('id, name, branch, start_time, end_time')
    .eq('id', groupId)
    .maybeSingle()

  if (groupErr) {
    console.error('[instructor/open-session] groups lookup failed:', groupErr.message)
    return NextResponse.json({ error: 'שגיאה בטעינת הקבוצה' }, { status: 500 })
  }
  if (!group) return NextResponse.json({ error: 'הקבוצה לא נמצאה' }, { status: 404 })

  const { data: created, error: insertErr } = await db
    .from('class_sessions')
    .insert({
      group_id:      group.id,
      class_name:    group.name,
      branch:        group.branch,
      session_date:  date,
      start_time:    group.start_time,
      end_time:      group.end_time,
      instructor_id: adminRoleId,
      duration:      1.5,
      type:          'regular',
      status:        'open',
    })
    .select(SESSION_COLS)
    .single()

  if (insertErr || !created) {
    console.error('[instructor/open-session] insert failed:', insertErr?.message)
    return NextResponse.json({ error: 'פתיחת האימון נכשלה' }, { status: 500 })
  }

  return NextResponse.json({ session: created, created: true })
}
