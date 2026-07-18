import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Active instructors for the no-login instructor mobile page.
// admin_roles is only readable by authenticated users under RLS (and holds
// staff PII), so we MUST read it with the service role. We deliberately do NOT
// fall back to the anon key here: the anon key can't read admin_roles under RLS
// and would silently return an empty list (this was the production bug —
// the mobile page showed "לא נמצאו מדריכים פעילים"). Instead we fail loudly and log.

export const dynamic = 'force-dynamic'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    console.error('[instructor/list] NEXT_PUBLIC_SUPABASE_URL is not set')
    return NextResponse.json({ error: 'Supabase URL not configured', instructors: [] }, { status: 500 })
  }
  if (!serviceKey) {
    console.error('[instructor/list] SUPABASE_SERVICE_ROLE_KEY is not set — cannot read admin_roles under RLS. Set it in the deployment environment (e.g. Vercel).')
    return NextResponse.json(
      { error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY missing', instructors: [] },
      { status: 500 },
    )
  }

  const db = createClient(url, serviceKey)
  const { data, error } = await db
    .from('admin_roles')
    .select('id, name, branch')
    .eq('role', 'instructor')
    .eq('active', true)
    .order('name')

  if (error) {
    console.error('[instructor/list] admin_roles query failed:', error.message)
    return NextResponse.json({ error: error.message, instructors: [] }, { status: 500 })
  }
  if (!data || data.length === 0) {
    console.warn('[instructor/list] query succeeded but returned 0 active instructors (role=instructor, active=true)')
  }
  return NextResponse.json({ instructors: data ?? [] })
}
