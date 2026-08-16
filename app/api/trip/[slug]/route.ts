  import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// נתיב: app/api/trip/[slug]/route.ts
// מחזיר את פרטי הטיול רק אם קוד הגישה נכון
// ============================================================

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const key = req.nextUrl.searchParams.get('k') ?? ''

  const db = admin()

  const { data: trip, error } = await db
    .from('trips')
    .select('*')
    .eq('slug', slug)
    .eq('is_open', true)
    .maybeSingle()

  if (error || !trip) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  // constant-time-ish compare
  if (!key || key !== trip.access_code) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // how many have registered so far — this drives the price shown
  const { count } = await db
    .from('trip_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', trip.id)
    .neq('payment_status', 'cancelled')

  const registered = count ?? 0

  // up to size_small registrations  → higher price
  // above size_small                → lower price, for everyone
  const currentPrice =
    registered > trip.size_small
      ? Number(trip.price_large_group)
      : Number(trip.price_small_group)

  // never send the access code back to the browser
  const { access_code, ...safe } = trip
  return NextResponse.json(
    { trip: safe, registered, currentPrice },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
