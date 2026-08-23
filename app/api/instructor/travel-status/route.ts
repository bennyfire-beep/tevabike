import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { travelConfigOf } from '@/lib/travel'

// Daily travel status for the no-login instructor mobile page.
//
// Two things the page needs and cannot read for itself: whether this instructor
// is on the per_km arrangement (that lives on staff_pay, which is not
// anon-readable), and what they have already reported. instructor_travel_days
// is restricted to the salary admins by RLS, so both reads run with the service
// role here.
//
// What comes back is deliberately thin: a yes/no and the instructor's own
// origin + km. No rate, no amount, nothing else off staff_pay ever reaches the
// public page.

export const dynamic = 'force-dynamic'

type DayRow = { origin: string | null; km: number | null }

const shape = (r: DayRow | null | undefined) =>
  r ? { origin: r.origin ?? '', km: Number(r.km ?? 0) } : null

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('[instructor/travel-status] SUPABASE_SERVICE_ROLE_KEY or URL not set — staff_pay and instructor_travel_days are not readable without it.')
    return NextResponse.json({ error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 500 })
  }

  const instructorId = (req.nextUrl.searchParams.get('instructor_id') ?? '').trim()
  const date         = (req.nextUrl.searchParams.get('date') ?? '').trim()
  if (!instructorId) return NextResponse.json({ error: 'Missing instructor_id' }, { status: 400 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Missing or malformed date' }, { status: 400 })

  const db = createClient(url, serviceKey)

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
