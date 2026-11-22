import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { whatsappOptinFields } from '@/lib/whatsapp-optin'
import {
  MISGAV_DAYS, MISGAV_PAY_LINKS, MISGAV_PRICE_PER_DAY, MISGAV_MIN_PER_DAY, MISGAV_RAIN_NOTE,
  isMisgavDay, misgavDayLabel,
} from '@/lib/camp-misgav'

// מחנה חנוכה במשגב — 6–7.12, 08:30–13:00, הרשמה לפי יום.
//
// GET  → כמה נרשמו לכל יום (כדי להראות אם היום כבר עבר את המינימום)
// POST → שומר הרשמה, שולח מייל אישור להורה (אם השאיר מייל) + התראה לבני וטל,
//        ומחזיר קישור תשלום לכל יום שנבחר

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = ['bennyfire@gmail.com', 'talmatoki@gmail.com']
const FROM = 'טבע בייק <info@mail.tevabike.com>'
const TABLE = 'hanukkah_misgav_registrations'

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey)
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

async function sendEmail(to: string[], subject: string, html: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) { console.error('[misgav] RESEND_API_KEY not set'); return }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    })
    if (!res.ok) console.error('[misgav] resend failed:', res.status, await res.text())
  } catch (err) {
    console.error('[misgav] resend error:', err)
  }
}

type Db = NonNullable<ReturnType<typeof db>>

async function countsPerDay(supabase: Db) {
  const { data } = await supabase.from(TABLE).select('days').neq('payment_status', 'cancelled')
  const counts: Record<string, number> = Object.fromEntries(MISGAV_DAYS.map(d => [d.key, 0]))
  for (const row of (data ?? []) as Array<{ days: string[] | null }>)
    for (const d of row.days ?? []) if (d in counts) counts[d]++
  return counts
}

// ---------- GET ----------

export async function GET() {
  const supabase = db()
  const counts = supabase ? await countsPerDay(supabase) : Object.fromEntries(MISGAV_DAYS.map(d => [d.key, 0]))
  return NextResponse.json({ ok: true, counts, minPerDay: MISGAV_MIN_PER_DAY, pricePerDay: MISGAV_PRICE_PER_DAY })
}

// ---------- POST ----------

type Body = {
  riderFirstName?: string
  riderLastName?: string
  age?: string
  groupName?: string
  days?: string[]
  parentName?: string
  parentPhone?: string
  parentEmail?: string
  city?: string
  healthNotes?: string
  consentParentName?: string
  consentApproved?: boolean
  whatsappOptin?: boolean
}

export async function POST(req: NextRequest) {
  const supabase = db()
  if (!supabase) {
    console.error('[misgav] Supabase env missing')
    return NextResponse.json({ ok: false, error: 'תקלה בשרת. נסו שוב או התקשרו 052-5708084' }, { status: 500 })
  }

  let body: Body
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'בקשה לא תקינה' }, { status: 400 }) }

  const t = (v?: string) => (v ?? '').trim()
  const riderFirstName = t(body.riderFirstName)
  const riderLastName  = t(body.riderLastName)
  const age            = t(body.age)
  const groupName      = t(body.groupName)
  const parentName     = t(body.parentName)
  const parentPhone    = t(body.parentPhone)
  const parentEmail    = t(body.parentEmail)
  const city           = t(body.city)
  const healthNotes    = t(body.healthNotes)
  const consentName    = t(body.consentParentName)

  // keep the calendar order and drop anything that isn't a camp day
  const chosen = new Set((Array.isArray(body.days) ? body.days : []).filter(d => typeof d === 'string' && isMisgavDay(d)))
  const days = MISGAV_DAYS.map(d => d.key).filter(k => chosen.has(k))

  if (!riderFirstName || !riderLastName || !parentName || !parentPhone || !city)
    return NextResponse.json({ ok: false, error: 'חסרים שדות חובה' }, { status: 400 })
  if (days.length === 0)
    return NextResponse.json({ ok: false, error: 'בחרו לפחות יום אחד' }, { status: 400 })
  if (parentPhone.replace(/\D/g, '').length < 9)
    return NextResponse.json({ ok: false, error: 'מספר הטלפון לא תקין' }, { status: 400 })
  if (parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail))
    return NextResponse.json({ ok: false, error: 'כתובת המייל לא תקינה' }, { status: 400 })
  if (!body.consentApproved || !consentName)
    return NextResponse.json({ ok: false, error: 'יש לאשר את הצהרת ההורה' }, { status: 400 })

  const total = days.length * MISGAV_PRICE_PER_DAY

  const { error } = await supabase.from(TABLE).insert({
    rider_first_name: riderFirstName,
    rider_last_name: riderLastName,
    age: age || null,
    group_name: groupName || null,
    days,
    parent_name: parentName,
    parent_phone: parentPhone,
    parent_email: parentEmail || null,
    city,
    health_notes: healthNotes || null,
    total_amount: total,
    payment_status: 'pending',
    consent_parent_name: consentName,
    consent_approved: true,
    ...whatsappOptinFields(body.whatsappOptin === true, 'camp_hanukkah_misgav'),
  })

  if (error) {
    console.error('[misgav] insert failed:', error.message)
    return NextResponse.json({ ok: false, error: 'ההרשמה לא נשמרה. נסו שוב.' }, { status: 500 })
  }

  const payments = days.map(d => ({ day: d, label: misgavDayLabel(d), link: MISGAV_PAY_LINKS[d] || '' }))
  const counts = await countsPerDay(supabase)
  const rider = esc(`${riderFirstName} ${riderLastName}`)

  // מייל אישור להורה
  if (parentEmail) {
    const payRows = payments.map(p => p.link
      ? `<p style="margin:8px 0"><a href="${p.link}" style="background:#b5e853;color:#0d0f0e;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">לתשלום — ${p.label} (${MISGAV_PRICE_PER_DAY} ₪)</a></p>`
      : `<p style="margin:8px 0">${p.label} — קישור לתשלום יישלח אליכם בנפרד</p>`).join('')

    await sendEmail(
      [parentEmail],
      `נרשמת למחנה חנוכה במשגב — ${riderFirstName} ${riderLastName}`,
      `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif;color:#1a1a1a;max-width:600px">
        <h2 style="margin:0 0 4px">ההרשמה נקלטה 🌲</h2>
        <p style="margin:0 0 18px;color:#555">מחנה חנוכה במשגב · 08:30–13:00 · מועדון טבע בייק</p>

        <p><b>רוכב/ת:</b> ${rider}</p>
        <p><b>ימים:</b> ${payments.map(p => p.label).join(' · ')}</p>
        <p style="font-size:18px"><b>סה"כ לתשלום: ${total} ₪</b></p>
        ${payRows}
        <p style="color:#666;font-size:13px">
          המקום נשמר רק לאחר התשלום. כל יום יוצא לפועל בכפוף למינימום ${MISGAV_MIN_PER_DAY} נרשמים.
        </p>

        <hr style="border:none;border-top:1px solid #ddd;margin:24px 0">

        <h3 style="margin:0 0 8px">לוח זמנים</h3>
        <p style="margin:0;line-height:1.8">
          08:30–10:30 פעילות ורכיבה ביער<br>
          10:30–11:00 הפסקת בוקר<br>
          11:00–13:00 המשך פעילות וסיום
        </p>

        <h3 style="margin:20px 0 8px">נקודת מפגש</h3>
        <p style="margin:0;line-height:1.8">
          מועדון טבע בייק — בוויז: "טבע בייק".<br>
          הגעה ופיזור עצמאיים.
        </p>

        <h3 style="margin:20px 0 8px">להביא</h3>
        <ul style="margin-top:0;line-height:1.8">
          <li>אופניים תקינים</li>
          <li>קסדה תקנית וכפפות</li>
          <li>בקבוק מים</li>
          <li>ארוחת בוקר קלה להפסקה</li>
          <li>בגדים להחלפה</li>
        </ul>

        <h3 style="margin:20px 0 8px">מדיניות ביטול</h3>
        <p style="margin:0;line-height:1.8">ניתן לבטל עד 3 ימים לפני יום הפעילות.</p>

        <h3 style="margin:20px 0 8px">גשם</h3>
        <p style="margin:0;line-height:1.8">${MISGAV_RAIN_NOTE}</p>

        <p style="margin-top:24px;color:#666;font-size:13px">
          שאלות? בני 052-5708084 · טל 050-5358071
        </p>
      </div>`,
    )
  }

  // התראה לבני וטל
  await sendEmail(
    ADMIN_EMAILS,
    `הרשמה למחנה חנוכה משגב: ${riderFirstName} ${riderLastName}`,
    `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif">
      <h2>הרשמה חדשה — מחנה חנוכה משגב</h2>
      <p><b>רוכב/ת:</b> ${rider}${groupName ? ` (${esc(groupName)})` : ''}${age ? ` · גיל ${esc(age)}` : ''}</p>
      <p><b>ימים:</b> ${payments.map(p => p.label).join(' · ')} · <b>${total} ₪</b></p>
      <p><b>הורה:</b> ${esc(parentName)} · ${esc(parentPhone)}</p>
      <p><b>ישוב:</b> ${esc(city)}</p>
      <p><b>מייל:</b> ${parentEmail ? esc(parentEmail) : '—'}</p>
      <p><b>מגבלה בריאותית:</b> ${healthNotes ? esc(healthNotes) : 'לא צוינה'}</p>
      <p><b>וואטסאפ:</b> ${body.whatsappOptin ? 'אישר/ה' : 'לא אישר/ה'}</p>
      <p><b>נרשמים עד כה:</b> ${MISGAV_DAYS.map(d => `${d.short}: ${counts[d.key]}`).join(' · ')} (מינימום ${MISGAV_MIN_PER_DAY} ליום)</p>
    </div>`,
  )

  return NextResponse.json({ ok: true, total, payments })
}
