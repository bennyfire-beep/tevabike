import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Gravity Camp — ימי שיא, אוגוסט 2026
//
// GET  → מחזיר כמה נרשמו לכל יום (למונה המקומות ביעד)
// POST → שומר הרשמה, שולח מייל אישור להורה + התראה לבני, ומחזיר קישור תשלום

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'bennyfire@gmail.com'
const FROM = 'טבע בייק <info@mail.tevabike.com>'

const DAY_IDS = ['yaad', 'yarden', 'misgav'] as const
type DayId = (typeof DAY_IDS)[number]

const DAYS: Record<DayId, { label: string; date: string; capacity: number | null }> = {
  yaad:   { label: "יום א' | יעד — אנדורו + אייר באג", date: '16.8', capacity: 16 },
  yarden: { label: "יום ג' | ירדן — קפיצות למים",      date: '18.8', capacity: null },
  misgav: { label: "יום ה' | משגב — סשן אייר באג",     date: '20.8', capacity: null },
}

const PRICE_PER_DAY = 300
const PAYMENT_LINKS: Record<number, string> = {
  1: 'https://arbox.link/KOJLpy0l',
  2: 'https://arbox.link/bqMY7327',
  3: 'https://arbox.link/0pi7_seM',
}

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey)
}

async function sendEmail(to: string[], subject: string, html: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) { console.error('[camp] RESEND_API_KEY not set'); return }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    })
    if (!res.ok) console.error('[camp] resend failed:', res.status, await res.text())
  } catch (err) {
    console.error('[camp] resend error:', err)
  }
}

// ---------- GET: מקומות פנויים ----------

export async function GET() {
  const supabase = db()
  const taken: Record<string, number> = { yaad: 0, yarden: 0, misgav: 0 }

  if (supabase) {
    const { data } = await supabase.from('camp_registrations').select('days')
    for (const row of data ?? []) {
      for (const d of (row.days ?? []) as string[]) {
        if (d in taken) taken[d] += 1
      }
    }
  }

  return NextResponse.json({
    ok: true,
    days: DAY_IDS.map(id => ({
      id,
      label: DAYS[id].label,
      date: DAYS[id].date,
      capacity: DAYS[id].capacity,
      taken: taken[id],
      remaining: DAYS[id].capacity === null ? null : Math.max(0, DAYS[id].capacity! - taken[id]),
    })),
  })
}

// ---------- POST: הרשמה ----------

type Body = {
  riderFirstName?: string
  riderLastName?: string
  groupName?: string
  parentName?: string
  parentPhone?: string
  childPhone?: string
  parentEmail?: string
  city?: string
  healthNotes?: string
  days?: string[]
  consentParentName?: string
  consentApproved?: boolean
}

export async function POST(req: NextRequest) {
  const supabase = db()
  if (!supabase) {
    console.error('[camp] Supabase env missing')
    return NextResponse.json({ ok: false, error: 'תקלה בשרת. נסו שוב או התקשרו 052-5708084' }, { status: 500 })
  }

  let body: Body
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'בקשה לא תקינה' }, { status: 400 }) }

  const riderFirstName = (body.riderFirstName ?? '').trim()
  const riderLastName  = (body.riderLastName ?? '').trim()
  const parentName     = (body.parentName ?? '').trim()
  const parentPhone    = (body.parentPhone ?? '').trim()
  const parentEmail    = (body.parentEmail ?? '').trim()
  const childPhone     = (body.childPhone ?? '').trim()
  const city           = (body.city ?? '').trim()
  const groupName      = (body.groupName ?? '').trim()
  const healthNotes    = (body.healthNotes ?? '').trim()
  const consentName    = (body.consentParentName ?? '').trim()
  const days = (body.days ?? []).filter((d): d is DayId => (DAY_IDS as readonly string[]).includes(d))

  if (!riderFirstName || !riderLastName || !parentName || !parentPhone || !parentEmail)
    return NextResponse.json({ ok: false, error: 'חסרים שדות חובה' }, { status: 400 })
  if (days.length === 0)
    return NextResponse.json({ ok: false, error: 'בחרו לפחות יום אחד' }, { status: 400 })
  if (!body.consentApproved || !consentName)
    return NextResponse.json({ ok: false, error: 'יש לאשר את הצהרת ההורה' }, { status: 400 })

  // בדיקת מקומות ליעד — נעשית בשרת כדי שלא יירשמו מעבר למכסה
  if (days.includes('yaad')) {
    const { count } = await supabase
      .from('camp_registrations')
      .select('id', { count: 'exact', head: true })
      .contains('days', ['yaad'])
    if ((count ?? 0) >= DAYS.yaad.capacity!) {
      return NextResponse.json({ ok: false, error: 'יום יעד מלא. אפשר להירשם לימים האחרים.' }, { status: 409 })
    }
  }

  const daysCount = days.length
  const total = daysCount * PRICE_PER_DAY
  const paymentLink = PAYMENT_LINKS[daysCount] ?? PAYMENT_LINKS[1]

  const { error } = await supabase.from('camp_registrations').insert({
    rider_first_name: riderFirstName,
    rider_last_name: riderLastName,
    group_name: groupName || null,
    parent_name: parentName,
    parent_phone: parentPhone,
    child_phone: childPhone || null,
    parent_email: parentEmail,
    city: city || null,
    health_notes: healthNotes || null,
    days,
    days_count: daysCount,
    total_amount: total,
    payment_link: paymentLink,
    payment_status: 'pending',
    consent_parent_name: consentName,
    consent_approved: true,
  })

  if (error) {
    console.error('[camp] insert failed:', error.message)
    return NextResponse.json({ ok: false, error: 'ההרשמה לא נשמרה. נסו שוב.' }, { status: 500 })
  }

  const daysList = days.map(d => `<li>${DAYS[d].label} — ${DAYS[d].date}</li>`).join('')

  // מייל אישור להורה
  await sendEmail(
    [parentEmail],
    `נרשמת לימי שיא — ${riderFirstName} ${riderLastName}`,
    `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif;color:#1a1a1a;max-width:600px">
      <h2 style="margin:0 0 4px">ההרשמה נקלטה 🚵</h2>
      <p style="margin:0 0 18px;color:#555">ימי שיא — Gravity Camp, אוגוסט 2026</p>

      <p><b>רוכב:</b> ${riderFirstName} ${riderLastName}</p>
      <p style="margin-bottom:4px"><b>הימים שנרשמת אליהם:</b></p>
      <ul style="margin-top:0">${daysList}</ul>

      <p style="font-size:18px"><b>סה"כ לתשלום: ${total} ₪</b> (${daysCount} × 300 ₪)</p>
      <p style="margin:18px 0">
        <a href="${paymentLink}" style="background:#b5e853;color:#0d0f0e;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">
          לתשלום
        </a>
      </p>
      <p style="color:#666;font-size:13px">המקום נשמר לאחר התשלום.</p>

      <hr style="border:none;border-top:1px solid #ddd;margin:24px 0">

      <h3 style="margin:0 0 8px">רשימת ציוד — חובה</h3>
      <ul style="margin-top:0;line-height:1.8">
        <li>אופני שטח תקינים</li>
        <li>קסדת פול־פייס — חובה להקפצות ולאייר באג</li>
        <li>כפפות רכיבה</li>
        <li>מגיני ברכיים</li>
        <li>נעליים סגורות</li>
        <li>בקבוק מים / שלוקר</li>
        <li>פנימית ספייר, משאבה או CO₂, מולטי־טול</li>
        <li>כובע, קרם הגנה, תכשיר נגד יתושים</li>
        <li>ארוחת עשר + כלי אוכל אישיים וסכו"ם</li>
      </ul>
      <p style="color:#666;font-size:13px">מומלץ בנוסף: מגן חזה/גב.</p>

      <h3 style="margin:20px 0 8px">מדיניות ביטול</h3>
      <p style="margin:0;line-height:1.8">
        ביטול עד 14 יום לפני תחילת המחנה — החזר של 50%.<br>
        ביטול פחות מ־3 ימים לפני — ללא החזר.
      </p>

      <p style="margin-top:24px;color:#666;font-size:13px">
        שאלות? בני 052-5708084 · טל 050-5358071
      </p>
    </div>`,
  )

  // התראה לבני
  await sendEmail(
    [ADMIN_EMAIL],
    `הרשמה לימי שיא: ${riderFirstName} ${riderLastName} — ${daysCount} ימים`,
    `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif">
      <h2>הרשמה חדשה לימי שיא</h2>
      <p><b>רוכב:</b> ${riderFirstName} ${riderLastName}${groupName ? ` (${groupName})` : ''}</p>
      <p><b>הורה:</b> ${parentName} · ${parentPhone}</p>
      <p><b>נייד ילד:</b> ${childPhone || '—'}</p>
      <p><b>ישוב:</b> ${city || '—'}</p>
      <p><b>מייל:</b> ${parentEmail}</p>
      <p><b>ימים:</b></p><ul>${daysList}</ul>
      <p><b>סכום:</b> ${total} ₪</p>
      <p><b>מגבלה בריאותית:</b> ${healthNotes || 'לא צוינה'}</p>
    </div>`,
  )

  return NextResponse.json({ ok: true, total, daysCount, paymentLink })
}
