import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const isKids = body.registration_type === 'kids'

    if (!body.full_name || !body.phone || !body.branch || (isKids && !body.child_name)) {
      return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Campaign attribution — optional, capped, and never allowed to block a
    // registration. `source` is the coarse channel used for grouping.
    const utm = (v: unknown) =>
      typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : null
    const utm_source   = utm(body.utm_source)
    const utm_medium   = utm(body.utm_medium)
    const utm_campaign = utm(body.utm_campaign)

    const { error } = await supabase.from('registrations').insert({
      full_name: body.full_name,
      phone: body.phone,
      email: body.email || null,
      branch: body.branch,
      city: body.city || null,
      class_type: body.class_type || null,
      registration_type: body.registration_type === 'adults' ? 'annual_adults' : 'annual_kids',
      membership_plan: body.membership_plan || null,
      promo_code: body.promo_code || null,
      child_name: body.child_name || null,
      child_age: body.child_age ? parseInt(body.child_age, 10) : null,
      notes: body.notes || null,
      status: 'pending',
      source: (utm_source ?? 'website').toLowerCase(),
      utm_source,
      utm_medium,
      utm_campaign,
    })

    if (error) {
      console.error('registration insert failed:', error)
      return NextResponse.json({ error: 'שמירת ההרשמה נכשלה' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}
