import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { saveAttendanceAndPay, type SaveSession, type SaveRider } from '@/lib/attendance'

// Attendance save for the no-login instructor mobile page.
//
// The attendance / class_sessions writes are already anon-permitted by RLS, but
// applying the correct pay multiplier requires reading admin_roles, which is not
// anon-readable. So the mobile page posts here and we run the shared save logic
// with a service-role client. That keeps the multiplier (and the rest of
// admin_roles PII) off the public anon key while still computing pay correctly.

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.json({ error: 'Supabase env vars missing' }, { status: 500 })

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

  const db = createClient(url, key)
  const res = await saveAttendanceAndPay(session, riders, attendance ?? {}, db)
  if (res.error) return NextResponse.json({ error: res.error }, { status: 500 })

  // Only the present count is returned — pay stays server-side.
  return NextResponse.json({ presentCount: res.presentCount })
}
