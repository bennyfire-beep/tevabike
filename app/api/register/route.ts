import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Summer 2026 tracks, for the coordinator alert email.
const TRACK_LABEL: Record<string, string> = {
  once_weekly:  'פעם בשבוע — ₪300',
  twice_weekly: 'פעמיים בשבוע — ₪550',
}
const DAY_LABEL = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

/**
 * Fire-and-forget email alert on a new registration.
 * Never blocks or fails the registration itself — if the mail fails, the row
 * is already safely stored and the coordinator dashboard still shows it.
 */
async function notifyRegistration(r: {
  full_name: string
  phone: string
  branch: string
  registration_type: string
  child_name: string | null
  child_age: string | null
  city: string | null
  membership_plan: string | null
  track: string | null
  chosen_day: number | null
  promo_code: string | null
  source: string
  utm_campaign: string | null
}) {
  const key = process.env.RESEND_API_KEY
  if (!key) return // not configured — skip silently

  const isKids = r.registration_type === 'annual_kids'
  const rows: [string, string][] = [
    ['סוג', isKids ? 'ילדים' : 'מבוגרים'],
    ...(isKids ? ([['שם הרוכב', `${r.child_name ?? '—'}${r.child_age ? ` (גיל ${r.child_age})` : ''}`]] as [string, string][]) : []),
    [isKids ? 'שם ההורה' : 'שם מלא', r.full_name],
    ['טלפון', r.phone],
    ['סניף', r.branch],
    ['יישוב', r.city ?? '—'],
    ['מסלול', r.track ? TRACK_LABEL[r.track] ?? r.track : r.membership_plan ?? '—'],
    ...(r.chosen_day !== null ? ([['יום קבוע', DAY_LABEL[r.chosen_day] ?? '—']] as [string, string][]) : []),
    ['קוד מבצע', r.promo_code ?? '—'],
    ['מקור', r.source],
    ['קמפיין', r.utm_campaign ?? '—'],
  ]

  const html = rows
    .map(([k, v]) => `<tr><td style="padding:6px 12px;font-weight:700">${k}</td><td style="padding:6px 12px">${v}</td></tr>`)
    .join('')

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Teva Bike <leads@mail.tevabike.com>',
        to: ['bennyfire@gmail.com'],
        subject: `הרשמה חדשה — ${r.branch} — ${isKids ? r.child_name ?? r.full_name : r.full_name}`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif">
          <h2 style="margin:0 0 12px">🎉 הרשמה שנתית חדשה</h2>
          <table style="border-collapse:collapse;font-size:15px">${html}</table>
          <p style="margin-top:16px">
            <a href="https://wa.me/972${r.phone.replace(/\D/g, '').replace(/^0/, '')}"
               style="background:#25D366;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700">
              פתיחת וואטסאפ
            </a>
            &nbsp;
            <a href="https://tevabike.com/admin/coordinator/registrations"
               style="background:#7c3aed;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700">
              לדשבורד
            </a>
          </p>
        </div>`,
      }),
    })
  } catch (e) {
    console.error('[register] notification failed (registration was still saved):', e)
  }
}

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
      track: body.track || null,
      chosen_day:
        body.chosen_day === '' || body.chosen_day === null || body.chosen_day === undefined
          ? null
          : parseInt(String(body.chosen_day), 10),
      amount_monthly: body.amount_monthly ?? null,
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

    // Best-effort alert — the registration is already stored either way.
    await notifyRegistration({
      full_name: body.full_name,
      phone: body.phone,
      branch: body.branch,
      registration_type: body.registration_type === 'adults' ? 'annual_adults' : 'annual_kids',
      child_name: body.child_name || null,
      child_age: body.child_age || null,
      city: body.city || null,
      membership_plan: body.membership_plan || null,
      track: body.track || null,
      chosen_day:
        body.chosen_day === '' || body.chosen_day === null || body.chosen_day === undefined
          ? null
          : parseInt(String(body.chosen_day), 10),
      promo_code: body.promo_code || null,
      source: (utm_source ?? 'website').toLowerCase(),
      utm_campaign,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}
