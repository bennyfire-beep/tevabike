import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { LEAD_INTERESTS } from '@/lib/leads'

// Public leads intake.
//
// The public contact form posts here and we insert with the SERVICE ROLE, so
// the anon key never touches the leads table directly and no admin data is ever
// exposed to anon. RLS still allows anon INSERT as defence-in-depth, but reads
// require authentication. We require the service role and fail loudly if it's
// missing (rather than silently degrading).

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('[leads] SUPABASE_SERVICE_ROLE_KEY or URL not set — cannot save lead. Configure it in the deployment environment.')
    return NextResponse.json({ ok: false, error: 'Server misconfigured' }, { status: 500 })
  }

  let body: { full_name?: string; phone?: string; interest?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const full_name = (body.full_name ?? '').trim()
  const phone     = (body.phone ?? '').trim()
  const interest  = (body.interest ?? '').trim()
  const message   = (body.message ?? '').trim()

  if (!full_name || !phone || !interest) {
    return NextResponse.json({ ok: false, error: 'חסרים שדות חובה' }, { status: 400 })
  }
  if (!(LEAD_INTERESTS as readonly string[]).includes(interest)) {
    return NextResponse.json({ ok: false, error: 'תחום עניין לא תקין' }, { status: 400 })
  }

  const db = createClient(url, serviceKey)
  const { error } = await db.from('leads').insert({
    full_name,
    phone,
    interest,
    message: message || null,
    // status defaults to 'new' in the DB
  })

  if (error) {
    console.error('[leads] insert failed:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
