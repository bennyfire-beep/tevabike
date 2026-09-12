import { NextRequest, NextResponse } from 'next/server'
import { travelConfigOf } from '@/lib/travel'
import { resolveCaller } from '@/lib/instructor-identity'

// Daily travel status for the instructor mobile page.
//
// Two things the page needs and cannot read for itself: whether this instructor
// is on the per_km arrangement (that lives on staff_pay, which is not
// anon-readable), and what they have already reported. instructor_travel_days
// is restricted to the salary admins by RLS, so both reads run with the service
// role here — but WHICH instructor is resolved from the caller's own verified
// token (resolveCaller), never from a client-supplied id, so nobody can read
// another instructor's travel arrangement or reported km by guessing their
// admin_roles id.
//
// What comes back is deliberately thin: a yes/no and the instructor's own
// origin + km. No rate, no amount, nothing else off staff_pay ever reaches the
// public page.

export const dynamic = 'force-dynamic'

type DayRow = { origin: string | null; km: number | null }

const shape = (r: DayRow | null | undefined) =>
  r ? { origin: r.origin ?? '', km: Number(r.km ?? 0) } : null

export async function GET(req: NextRequest) {
  const result = await resolveCaller(req.headers.get('authorization'), 'instructor')
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  const { db, adminRoleId: instructorId } = result.identity

  const date = (req.nextUrl.searchParams.get('date') ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Missing or malformed date' }, { status: 400 })

  const [{ data: pay }, { data: today }, { data: recent }] = await Promise.all([
    db.from('staff_pay')
      .select('travel_type, travel_km, travel_rate, travel_monthly_amount')
      .eq('admin_role_id', instructorId)
      .maybeSingle(),
    db.from('instructor_travel_days')
      .select('origin, km')
      .eq('instructor_id', instructorId)
      .eq('travel_date', date)
      .maybeSingle(),
    // The last report of any day, so a returning instructor gets their usual
    // origin and distance filled in rather than an empty form.
    db.from('instructor_travel_days')
      .select('origin, km')
      .eq('instructor_id', instructorId)
      .order('travel_date', { ascending: false })
      .limit(1),
  ])

  // travelConfigOf keeps "which arrangement is this" in one place; only the
  // yes/no crosses to the public page.
  return NextResponse.json({
    is_per_km: travelConfigOf(pay).type === 'per_km',
    today: shape(today),
    last:  shape(recent?.[0]),
  })
}
