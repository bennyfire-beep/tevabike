import { NextRequest, NextResponse } from 'next/server'
import { saveAttendanceAndPay, type SaveSession, type SaveRider } from '@/lib/attendance'
import { resolveCaller } from '@/lib/instructor-identity'

// Attendance save for the instructor mobile page.
//
// The attendance / class_sessions writes are already coordinator-permitted by
// RLS, but pay needs the instructor's rates from staff_pay, which is not
// staff-readable. So the mobile page posts here and we run the shared save
// logic with a service-role client. That keeps staff pay off the instructor's
// own session while still computing the amount correctly.
//
// Authorization is deliberately just "is this a real, signed-in instructor" —
// not "is this THEIR session". Instructors cover each other's groups all the
// time (see /api/instructor/open-session), and a covered session keeps its
// original instructor_id/instructor_ids on purpose, so tying this route to
// those fields would block the exact covering flow the rest of the page is
// built around. What resolveCaller closes is the real hole: before this,
// anyone with no login at all could call this route.

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await resolveCaller(req.headers.get('authorization'), 'instructor')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { db } = auth.identity

  let body: { session?: SaveSession; riders?: SaveRider[]; attendance?: Record<string, boolean> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { session, riders, attendance } = body
  if (!session?.id || !Array.isArray(riders)) {
    return NextResponse.json({ error: 'Missing session or riders' }, { status: 400 })
  }

  const res = await saveAttendanceAndPay(session, riders, attendance ?? {}, db)
  if (res.error) return NextResponse.json({ error: res.error }, { status: 500 })

  // Only the present count is returned — pay stays server-side.
  return NextResponse.json({ presentCount: res.presentCount })
}
