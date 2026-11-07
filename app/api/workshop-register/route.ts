// app/api/workshop-register/route.ts — גרסה 3: סשן איר באג 13.11 (9:00–13:00, 180 ₪, מגיל 11, קפיצה חופשית — מדריך בשטח ללא הדרכה, עד 25)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { whatsappOptinFields } from '@/lib/whatsapp-optin'
import { CLUB_GROUPS, FREE_STATUS } from '@/lib/workshop-payment'

export const dynamic = 'force-dynamic'

const PAYMENT_LINK = 'https://arbox.link/IdCW6--f' // Arbox: "סשיין air bag" — 180 ₪
const PRICE = 180
const MIN_AGE = 11
const FROM = 'טבע בייק <info@mail.tevabike.com>'
const REPLY_TO = 'bennyfire@gmail.com'
const ADMIN_EMAIL = 'bennyfire@gmail.com'

const MAX_NAME = 100
const MAX_PHONE = 30
const MAX_EMAIL = 150
const MAX_NOTES = 1000
const MAX_UTM = 120

const VALID_DATES = ['2026-11-13']
const DATE_LABEL: Record<string, string> = {
  '2026-11-13': 'יום שישי, 13 בנובמבר 2026',
}

function clean(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, max)
  return s.length ? s : null
}

function confirmationHtml(name: string, dateLabel: string, free: boolean) {
  const timeRange = '9:00–13:00'
  const scheduleRows = [
    ['9:00', 'התכנסות וכללי בטיחות בשטח'],
    ['9:15', 'קפיצה חופשית על הארבג הקטנה והגדולה'],
    ['13:00', 'סיום'],
  ]
  return `
  <div dir="rtl" style="font-family:Heebo,Arial,sans-serif;background:#0C1814;color:#F5F2EE;padding:32px 24px;border-radius:16px;max-width:560px;margin:0 auto">
    <h1 style="color:#D4288A;font-size:26px;margin:0 0 8px">תודה על הרישום, ${name}! 🚵</h1>
    <p style="font-size:16px;line-height:1.8;color:#D8E2DC">
      כמה כיף שאתה איתנו!<br/>
      אנחנו שמחים לעזור לך לקבל ביטחון בזמן אוויר.
    </p>

    <div style="background:#152A1E;border:1px solid #1F3D2A;border-radius:12px;padding:16px 18px;margin:20px 0">
      <p style="margin:0 0 6px"><b style="color:#D4288A">📅 מתי:</b> ${dateLabel} · ${timeRange}</p>
      <p style="margin:0 0 6px"><b style="color:#D4288A">📍 איפה:</b> פארק אוסטרליה, משגב (חפשו "פארק אוסטרליה" בוויז)</p>
      <p style="margin:0 0 6px"><b style="color:#D4288A">⛑️ חובה:</b> קסדת פול פייס וצב — בלי פול פייס וצב לא קופצים!</p>
      <p style="margin:0 0 6px"><b style="color:#D4288A">🚲 להביא:</b> אופניים תקינים ומים</p>
      <p style="margin:0"><b style="color:#D4288A">ℹ️ חשוב:</b> סשן קפיצה חופשי מגיל 11 — מדריך נמצא בשטח לאורך כל הסשן, ללא הדרכה.</p>
    </div>

    <div style="background:#152A1E;border:1px solid #1F3D2A;border-radius:12px;padding:16px 18px;margin:20px 0">
      <p style="margin:0 0 8px;font-weight:bold;color:#F5F2EE">הלו"ז שלנו:</p>
      ${scheduleRows
        .map(
          ([time, label]) =>
            `<p style="margin:0 0 4px;color:#D8E2DC"><b style="color:#D4288A">${time}</b> — ${label}</p>`
        )
        .join('\n      ')}
    </div>

    ${free
      ? `<p style="font-size:15px;color:#D8E2DC">המקום שלך שמור — כרוכב/ת טבע בייק ההשתתפות ללא עלות. 💚</p>`
      : `<p style="font-size:15px;color:#D8E2DC">כדי לשריין את מקומך, נשאר רק להשלים את התשלום (${PRICE} ₪):</p>
    <a href="${PAYMENT_LINK}" style="display:block;background:#D4288A;color:#ffffff;text-decoration:none;text-align:center;padding:14px;border-radius:12px;font-size:17px;font-weight:bold;margin:12px 0 20px">
      לתשלום מאובטח 💳
    </a>`}

    <p style="font-size:12px;color:#7E948A;line-height:1.7">
      תנאי ביטול: ביטול עד 14 יום לפני הסשן — החזר של 50%. פחות מ־3 ימים לפני הסשן — ללא החזר.
    </p>

    <p style="font-size:16px;color:#F5F2EE;margin-top:24px">
      נתראה בסשן!<br/>
      <b>בני וצוות טבע בייק</b> 💚
    </p>
  </div>`
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) return
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, reply_to: REPLY_TO, subject, html }),
    })
  } catch {
    // fire-and-forget
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const full_name = clean(body.full_name, MAX_NAME)
  const phone = clean(body.phone, MAX_PHONE)
  const email = clean(body.email, MAX_EMAIL)
  const workshop_date = clean(body.workshop_date, 20)
  const bike_brand = clean(body.bike_brand, 20)
  const notes = clean(body.notes, MAX_NOTES)
  const ageRaw = clean(body.age, 5)
  const age = ageRaw && /^\d{1,3}$/.test(ageRaw) ? parseInt(ageRaw, 10) : null
  const waiver_accepted = body.waiver_accepted === true
  const groupRaw = clean(body.club_group, 40)
  const club_group = groupRaw && (CLUB_GROUPS as readonly string[]).includes(groupRaw) ? groupRaw : null
  const free = club_group !== null

  if (!full_name || !phone || !email || !workshop_date) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }
  if (age === null) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }
  if (age < MIN_AGE) {
    return NextResponse.json({ error: 'too_young' }, { status: 400 })
  }
  if (!VALID_DATES.includes(workshop_date)) {
    return NextResponse.json({ error: 'bad_date' }, { status: 400 })
  }
  if (!waiver_accepted) {
    return NextResponse.json({ error: 'waiver_required' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  const supabase = createClient(url, serviceKey)

  const { error } = await supabase.from('workshop_registrations').insert({
    full_name,
    phone,
    email,
    age,
    workshop_date,
    bike_brand,
    notes: free ? [`רוכב/ת טבע בייק — ${club_group} · ללא חיוב`, notes].filter(Boolean).join(' | ') : notes,
    payment_status: free ? FREE_STATUS : 'pending',
    waiver_accepted: true,
    waiver_accepted_at: new Date().toISOString(),
    utm_source: clean(body.utm_source, MAX_UTM),
    utm_medium: clean(body.utm_medium, MAX_UTM),
    utm_campaign: clean(body.utm_campaign, MAX_UTM),
    ...whatsappOptinFields(body.whatsapp_optin === true, 'workshop_airbag'),
  })

  if (error) {
    if (error.message?.includes('workshop_full')) {
      return NextResponse.json({ error: 'workshop_full' }, { status: 409 })
    }
    console.error('workshop-register insert failed:', error.message)
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
  }

  const dateLabel = DATE_LABEL[workshop_date] ?? workshop_date

  await sendEmail(
    email,
    'הרישום לסשן האיר באג התקבל! 🚵 טבע בייק',
    confirmationHtml(full_name, dateLabel, free)
  )
  await sendEmail(
    ADMIN_EMAIL,
    `🆕 רישום לסשן איר באג: ${full_name} (${dateLabel})`,
    `<div dir="rtl" style="font-family:Arial,sans-serif">
      <p><b>שם:</b> ${full_name}</p>
      <p><b>טלפון:</b> ${phone}</p>
      <p><b>מייל:</b> ${email}</p>
      <p><b>גיל:</b> ${age ?? '—'}</p>
      <p><b>תאריך:</b> ${dateLabel}</p>
      <p><b>קבוצה:</b> ${free ? `${club_group} — רוכב/ת טבע בייק, ללא חיוב` : 'רוכב/ת מבחוץ — 180 ₪'}</p>
      <p><b>הערות:</b> ${notes ?? '—'}</p>
      <p><b>מקור:</b> ${clean(body.utm_source, MAX_UTM) ?? 'אורגני'}</p>
    </div>`
  )

  return NextResponse.json({ ok: true, free })
}
