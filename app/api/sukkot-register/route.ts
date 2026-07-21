import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// מחנה סוכות — משמר העמק, 27.09–01.10
//
// GET  → כמה נרשמו / כמה מקומות נשארו
// POST → שומר הרשמה, שולח מייל אישור להורה + התראה לבני, ומחזיר קישור תשלום

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = ['bennyfire@gmail.com', 'talmatoki@gmail.com']
const FROM = 'טבע בייק <info@mail.tevabike.com>'

const PRICE = 2900
const CAPACITY = 20            // ← שנה כאן את מספר המקומות במחנה
const MIN_PARTICIPANTS = 8
const PAY_URL = 'https://arbox.link/yYdvre3J'

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey)
}

async function sendEmail(to: string[], subject: string, html: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) { console.error('[sukkot] RESEND_API_KEY not set'); return }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    })
    if (!res.ok) console.error('[sukkot] resend failed:', res.status, await res.text())
  } catch (err) {
    console.error('[sukkot] resend error:', err)
  }
}

// ---------- GET: מקומות פנויים ----------

export async function GET() {
  const supabase = db()
  let taken = 0

  if (supabase) {
    const { count } = await supabase
      .from('sukkot_registrations')
      .select('id', { count: 'exact', head: true })
      .neq('payment_status', 'cancelled')
    taken = count ?? 0
  }

  return NextResponse.json({
    ok: true,
    capacity: CAPACITY,
    taken,
    remaining: Math.max(0, CAPACITY - taken),
    minParticipants: MIN_PARTICIPANTS,
    price: PRICE,
  })
}

// ---------- POST: הרשמה ----------

type Body = {
  riderFirstName?: string
  riderLastName?: string
  birthDate?: string
  grade?: string
  groupName?: string
  ridingLevel?: string
  parentName?: string
  parentPhone?: string
  secondParentPhone?: string
  childPhone?: string
  parentEmail?: string
  city?: string
  healthNotes?: string
  foodNotes?: string
  consentParentName?: string
  consentApproved?: boolean
}

export async function POST(req: NextRequest) {
  const supabase = db()
  if (!supabase) {
    console.error('[sukkot] Supabase env missing')
    return NextResponse.json({ ok: false, error: 'תקלה בשרת. נסו שוב או התקשרו 052-5708084' }, { status: 500 })
  }

  let body: Body
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'בקשה לא תקינה' }, { status: 400 }) }

  const t = (v?: string) => (v ?? '').trim()

  const riderFirstName = t(body.riderFirstName)
  const riderLastName  = t(body.riderLastName)
  const birthDate      = t(body.birthDate)
  const grade          = t(body.grade)
  const groupName      = t(body.groupName)
  const ridingLevel    = t(body.ridingLevel)
  const parentName     = t(body.parentName)
  const parentPhone    = t(body.parentPhone)
  const secondPhone    = t(body.secondParentPhone)
  const childPhone     = t(body.childPhone)
  const parentEmail    = t(body.parentEmail)
  const city           = t(body.city)
  const healthNotes    = t(body.healthNotes)
  const foodNotes      = t(body.foodNotes)
  const consentName    = t(body.consentParentName)

  if (!riderFirstName || !riderLastName || !parentName || !parentPhone || !parentEmail)
    return NextResponse.json({ ok: false, error: 'חסרים שדות חובה' }, { status: 400 })
  if (!body.consentApproved || !consentName)
    return NextResponse.json({ ok: false, error: 'יש לאשר את הצהרת ההורה' }, { status: 400 })

  // בדיקת מקומות בשרת כדי שלא יירשמו מעבר למכסה
  const { count } = await supabase
    .from('sukkot_registrations')
    .select('id', { count: 'exact', head: true })
    .neq('payment_status', 'cancelled')
  if ((count ?? 0) >= CAPACITY) {
    return NextResponse.json({ ok: false, error: 'המחנה מלא. התקשרו אלינו לרשימת המתנה: 052-5708084' }, { status: 409 })
  }

  const { error } = await supabase.from('sukkot_registrations').insert({
    rider_first_name: riderFirstName,
    rider_last_name: riderLastName,
    birth_date: birthDate || null,
    grade: grade || null,
    group_name: groupName || null,
    riding_level: ridingLevel || null,
    parent_name: parentName,
    parent_phone: parentPhone,
    second_parent_phone: secondPhone || null,
    child_phone: childPhone || null,
    parent_email: parentEmail,
    city: city || null,
    health_notes: healthNotes || null,
    food_notes: foodNotes || null,
    total_amount: PRICE,
    payment_status: 'pending',
    consent_parent_name: consentName,
    consent_approved: true,
  })

  if (error) {
    console.error('[sukkot] insert failed:', error.message)
    return NextResponse.json({ ok: false, error: 'ההרשמה לא נשמרה. נסו שוב.' }, { status: 500 })
  }

  // מייל אישור להורה
  await sendEmail(
    [parentEmail],
    `נרשמת למחנה סוכות — ${riderFirstName} ${riderLastName}`,
    `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif;color:#1a1a1a;max-width:600px">
      <h2 style="margin:0 0 4px">ההרשמה נקלטה 🚵</h2>
      <p style="margin:0 0 18px;color:#555">מחנה סוכות — משמר העמק, 27.09–01.10</p>

      <p><b>רוכב:</b> ${riderFirstName} ${riderLastName}</p>
      <p><b>המחנה כולל:</b> חמישה ימי רכיבה, ארוחות ולינה.</p>

      <p style="font-size:18px"><b>סה"כ לתשלום: ${PRICE} ₪</b></p>
      <p style="margin:18px 0">
        <a href="${PAY_URL}" style="background:#b5e853;color:#0d0f0e;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">
          לתשלום
        </a>
      </p>
      <p style="color:#666;font-size:13px">
        המקום נשמר לאחר התשלום. המחנה ייפתח בכפוף למינימום ${MIN_PARTICIPANTS} משתתפים.
      </p>

      <hr style="border:none;border-top:1px solid #ddd;margin:24px 0">

      <h3 style="margin:0 0 8px">רשימת ציוד — חובה</h3>
      <ul style="margin-top:0;line-height:1.8">
        <li>אופני שטח תקינים</li>
        <li>קסדת פול־פייס</li>
        <li>כפפות רכיבה</li>
        <li>מגיני ברכיים</li>
        <li>נעליים סגורות</li>
        <li>בקבוק מים / שלוקר</li>
        <li>פנימית ספייר, משאבה או CO₂, מולטי־טול</li>
        <li>שק שינה ומזרן, כלי רחצה ומגבת</li>
        <li>בגדים להחלפה לחמישה ימים, בגד ים</li>
        <li>כובע, קרם הגנה, תכשיר נגד יתושים</li>
      </ul>
      <p style="color:#666;font-size:13px">מומלץ בנוסף: מגן חזה/גב, פנס ראש.</p>

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
    ADMIN_EMAILS,
    `הרשמה למחנה סוכות: ${riderFirstName} ${riderLastName}`,
    `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif">
      <h2>הרשמה חדשה למחנה סוכות</h2>
      <p><b>רוכב:</b> ${riderFirstName} ${riderLastName}${groupName ? ` (${groupName})` : ''}</p>
      <p><b>תאריך לידה:</b> ${birthDate || '—'} · <b>כיתה:</b> ${grade || '—'}</p>
      <p><b>רמת רכיבה:</b> ${ridingLevel || '—'}</p>
      <p><b>הורה:</b> ${parentName} · ${parentPhone}</p>
      <p><b>טלפון הורה נוסף:</b> ${secondPhone || '—'}</p>
      <p><b>נייד ילד:</b> ${childPhone || '—'}</p>
      <p><b>ישוב:</b> ${city || '—'}</p>
      <p><b>מייל:</b> ${parentEmail}</p>
      <p><b>מגבלה בריאותית:</b> ${healthNotes || 'לא צוינה'}</p>
      <p><b>רגישות/העדפה באוכל:</b> ${foodNotes || 'לא צוינה'}</p>
      <p><b>נרשמים עד כה:</b> ${(count ?? 0) + 1} מתוך ${CAPACITY}</p>
    </div>`,
  )

  return NextResponse.json({ ok: true, total: PRICE, paymentLink: PAY_URL })
}
