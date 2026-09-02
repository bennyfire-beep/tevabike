import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// נתיב: app/api/morzine-youth-register/route.ts
// הרשמה לחופשת רכיבה לנוער במורזין 2027
//
// שומר את ההרשמה בטבלה המשותפת trip_registrations, תחת ה-trip
// שסלאגו morzine-2027-youth — כך שהיא נכנסת אוטומטית למערכת
// התזכורות (app/api/cron/trip-reminders/route.ts) בדיוק כמו
// נרשמי מורזין מבוגרים, בלי קוד נוסף.
// ============================================================

export const runtime = 'nodejs'
export const maxDuration = 30

const SLUG = 'morzine-2027-youth'
const ADMIN_EMAILS = ['bennyfire@gmail.com', 'talmatoki@gmail.com']
const FROM = 'טבע בייק <info@mail.tevabike.com>'

const MAX_FILE = 10 * 1024 * 1024 // 10MB
const OK_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf']

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey)
}

async function sendEmail(to: string[], subject: string, text: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) { console.error('[morzine-youth] RESEND_API_KEY not set'); return }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, text }),
    })
    if (!res.ok) console.error('[morzine-youth] resend failed:', res.status, await res.text())
  } catch (err) {
    console.error('[morzine-youth] resend error:', err)
  }
}

// ---------- GET: פרטי הטיול (מחיר/מקדמה) לצורך תצוגה בדף ----------

export async function GET() {
  const supabase = db()
  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 })

  const { data: trip } = await supabase
    .from('trips')
    .select('price_small_group, deposit_ils, trip_start, trip_end, is_open')
    .eq('slug', SLUG)
    .maybeSingle()

  if (!trip) return NextResponse.json({ ok: false }, { status: 404 })

  return NextResponse.json({
    ok: true,
    price: Number(trip.price_small_group),
    deposit: Number(trip.deposit_ils),
    tripStart: trip.trip_start,
    tripEnd: trip.trip_end,
    isOpen: trip.is_open,
  })
}

// ---------- POST: הרשמה ----------

export async function POST(req: NextRequest) {
  const supabase = db()
  if (!supabase) {
    console.error('[morzine-youth] Supabase env missing')
    return NextResponse.json({ ok: false, error: 'תקלה בשרת. נסו שוב או התקשרו 052-5708084' }, { status: 500 })
  }

  const { data: trip } = await supabase
    .from('trips')
    .select('id, title, deposit_ils, bank_details, payment_note, is_open')
    .eq('slug', SLUG)
    .maybeSingle()

  if (!trip || !trip.is_open) {
    return NextResponse.json({ ok: false, error: 'ההרשמה סגורה כרגע' }, { status: 404 })
  }

  const fd = await req.formData().catch(() => null)
  if (!fd) return NextResponse.json({ ok: false, error: 'בקשה לא תקינה' }, { status: 400 })

  const s = (k: string) => String(fd.get(k) ?? '').trim()

  const riderNameHe = s('rider_name_he')
  const riderNameEn = s('rider_name_en')
  const birthDate   = s('birth_date')
  const idNumber    = s('id_number')
  const riderPhone  = s('rider_phone')
  const parentPhone = s('parent_phone')
  const email       = s('email')
  const address     = s('address')
  const notes       = s('address') ? `כתובת מגורים: ${address}` : ''
  const termsAccepted      = s('terms_accepted') === 'true'
  const healthDeclared     = s('health_declared') === 'true'
  const insuranceCommitted = s('insurance_committed') === 'true'

  if (!riderNameHe || !riderNameEn || !birthDate || !idNumber || !riderPhone || !parentPhone || !email || !address)
    return NextResponse.json({ ok: false, error: 'חסרים שדות חובה' }, { status: 400 })
  if (!termsAccepted || !healthDeclared || !insuranceCommitted)
    return NextResponse.json({ ok: false, error: 'יש לאשר את כל ההצהרות כדי להירשם' }, { status: 400 })

  // ---- passport upload ----
  let passportPath: string | null = null
  const file = fd.get('passport')
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE)
      return NextResponse.json({ ok: false, error: 'הקובץ גדול מדי (מקסימום 10MB)' }, { status: 400 })
    if (!OK_TYPES.includes(file.type))
      return NextResponse.json({ ok: false, error: 'סוג קובץ לא נתמך' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const safeName = riderNameEn.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 40)
    passportPath = `${SLUG}/${Date.now()}-${safeName}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('passports')
      .upload(passportPath, file, { contentType: file.type, upsert: false })

    if (upErr) {
      console.error('[morzine-youth] passport upload failed:', upErr)
      passportPath = null // שומרים את ההרשמה גם אם ההעלאה נכשלה
    }
  } else {
    return NextResponse.json({ ok: false, error: 'יש להעלות צילום דרכון בתוקף' }, { status: 400 })
  }

  const { error } = await supabase.from('trip_registrations').insert({
    trip_id: trip.id,
    name_he: riderNameHe,
    name_passport: riderNameEn,
    birth_date: birthDate,
    phone: riderPhone,
    parent_phone: parentPhone,
    id_number: idNumber,
    email,
    passport_file: passportPath,
    notes,
    terms_accepted: termsAccepted,
    terms_accepted_at: new Date().toISOString(),
    health_declared: healthDeclared,
    insurance_committed: insuranceCommitted,
    payment_status: 'pending',
  })

  if (error) {
    console.error('[morzine-youth] insert failed:', error.message)
    return NextResponse.json({ ok: false, error: 'ההרשמה לא נשמרה. נסו שוב.' }, { status: 500 })
  }

  const deposit = Number(trip.deposit_ils)

  // מייל אישור לרוכב/הורה
  await sendEmail(
    [email],
    `נרשמת ל${trip.title} — ${riderNameHe}`,
    [
      `היי,`,
      ``,
      `ההרשמה של ${riderNameHe} ל${trip.title} התקבלה.`,
      ``,
      `--------------------------------------------`,
      `מקדמה: ${deposit.toLocaleString()} ש"ח (אינה ניתנת להחזר)`,
      `--------------------------------------------`,
      ``,
      trip.bank_details ? `להעברה בנקאית:\n${trip.bank_details}` : `פרטי ההעברה יישלחו בוואטסאפ.`,
      ``,
      trip.payment_note || '',
      ``,
      `המקום נשמר סופית רק לאחר קבלת המקדמה.`,
      ``,
      `שאלות — אני זמין.`,
      ``,
      `בני`,
      `טבע בייק`,
      `052-5708084`,
    ].filter(l => l !== '').join('\n'),
  )

  // התראה לבני וטל
  await sendEmail(
    ADMIN_EMAILS,
    `הרשמה חדשה — ${trip.title}: ${riderNameHe}`,
    [
      trip.title,
      ``,
      `רוכב/ת: ${riderNameHe} (${riderNameEn})`,
      `תאריך לידה: ${birthDate} · ת"ז: ${idNumber}`,
      `נייד הרוכב/ת: ${riderPhone}`,
      `נייד ההורה הרשום: ${parentPhone}`,
      `מייל: ${email}`,
      `כתובת מגורים: ${address}`,
      `צילום דרכון: ${passportPath ? 'הועלה' : 'לא הועלה'}`,
      `הצהרות: תנאים כלליים ${termsAccepted ? '✔' : '✘'} · בריאות ${healthDeclared ? '✔' : '✘'} · התחייבות ביטוח ${insuranceCommitted ? '✔' : '✘'}`,
      ``,
      `לשלוח פרטי העברה למקדמה של ₪${deposit}`,
    ].join('\n'),
  )

  return NextResponse.json({ ok: true, deposit })
}
