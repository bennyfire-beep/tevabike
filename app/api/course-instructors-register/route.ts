// app/api/course-instructors-register/route.ts — הרשמה לקורס מדריכי רכיבה טכנית
//
// Public lead intake for the instructors-course landing page. Inserts into the
// shared `leads` table with the SERVICE ROLE (anon never touches it), then
// fires a confirmation email inviting the registrant to complete the official
// registration via the college's link, plus an internal alert to Benny. Both
// emails are fire-and-forget — they never block or fail the lead insert.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { whatsappOptinFields } from '@/lib/whatsapp-optin'
import { COURSE_DATES_LABEL, COLLEGE_REGISTRATION_LINK, COLLEGE_PHONE } from '@/lib/instructors-course'

export const dynamic = 'force-dynamic'

const FROM = 'טבע בייק <info@mail.tevabike.com>'
const REPLY_TO = 'bennyfire@gmail.com'
const ADMIN_EMAIL = 'bennyfire@gmail.com'
const INTEREST = 'קורס מדריכי רכיבה טכנית'

const MAX_NAME = 100
const MAX_PHONE = 30
const MAX_EMAIL = 150
const MAX_UTM = 120

function clean(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, max)
  return s.length ? s : null
}

function confirmationHtml(name: string) {
  const linkBlock = COLLEGE_REGISTRATION_LINK
    ? `<a href="${COLLEGE_REGISTRATION_LINK}" style="display:block;background:#f0b90b;color:#0C1814;text-decoration:none;text-align:center;padding:14px;border-radius:12px;font-size:17px;font-weight:bold;margin:12px 0 20px">
        להשלמת ההרשמה במכללת משגב 🎓
      </a>`
    : `<p style="font-size:15px;color:#D8E2DC">
        נשלח לך כאן, בהודעה נפרדת, את קישור ההרשמה הרשמי של מכללת משגב ברגע שיתפרסם.
      </p>`

  return `
  <div dir="rtl" style="font-family:Heebo,Arial,sans-serif;background:#0C1814;color:#F5F2EE;padding:32px 24px;border-radius:16px;max-width:560px;margin:0 auto">
    <h1 style="color:#f0b90b;font-size:26px;margin:0 0 8px">תודה על ההתעניינות, ${name}! 🎓</h1>
    <p style="font-size:16px;line-height:1.8;color:#D8E2DC">
      קיבלנו את הפרטים שלך לקורס מדריכי רכיבה טכנית באופני הרים של טבע בייק ומכללת משגב.
    </p>

    <div style="background:#152A1E;border:1px solid #1F3D2A;border-radius:12px;padding:16px 18px;margin:20px 0">
      <p style="margin:0 0 6px"><b style="color:#f0b90b">📅 מועד הקורס:</b> ${COURSE_DATES_LABEL}</p>
      <p style="margin:0"><b style="color:#f0b90b">📍 איפה:</b> מועדון טבע בייק, משגב</p>
    </div>

    ${linkBlock}

    <p style="font-size:14px;color:#D8E2DC">
      לפרטים נוספים ולהרשמה ניתן גם לפנות טלפונית למכללת משגב: <b style="color:#f0b90b">${COLLEGE_PHONE}</b>
    </p>

    <p style="font-size:16px;color:#F5F2EE;margin-top:24px">
      נתראה בשטח!<br/>
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

  const first_name = clean(body.first_name, MAX_NAME)
  const last_name = clean(body.last_name, MAX_NAME)
  const phone = clean(body.phone, MAX_PHONE)
  const email = clean(body.email, MAX_EMAIL)

  if (!first_name || !last_name || !phone || !email) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  const full_name = `${first_name} ${last_name}`

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  const supabase = createClient(url, serviceKey)

  const utm_source = clean(body.utm_source, MAX_UTM)
  const { error } = await supabase.from('leads').insert({
    full_name,
    phone,
    email,
    interest: INTEREST,
    source: (utm_source ?? 'website').toLowerCase(),
    utm_source,
    utm_medium: clean(body.utm_medium, MAX_UTM),
    utm_campaign: clean(body.utm_campaign, MAX_UTM),
    ...whatsappOptinFields(body.whatsapp_optin === true, 'instructors_course'),
  })

  if (error) {
    console.error('course-instructors-register insert failed:', error.message)
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
  }

  // Confirmation to registrant + internal alert to Benny.
  // Must be awaited: on Vercel the function freezes right after the response
  // is returned, so un-awaited sends silently die.
  await sendEmail(
    email,
    'קיבלנו את הפרטים שלך — קורס מדריכי רכיבה טכנית 🎓 טבע בייק',
    confirmationHtml(full_name)
  )
  await sendEmail(
    ADMIN_EMAIL,
    `🆕 מתעניין/ת בקורס מדריכים: ${full_name}`,
    `<div dir="rtl" style="font-family:Arial,sans-serif">
      <p><b>שם:</b> ${full_name}</p>
      <p><b>טלפון:</b> ${phone}</p>
      <p><b>מייל:</b> ${email}</p>
      <p><b>מקור:</b> ${utm_source ?? 'אורגני'}</p>
    </div>`
  )

  return NextResponse.json({ ok: true })
}
