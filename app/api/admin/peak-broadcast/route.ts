import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// שליחת הודעה לנרשמים לימי שיא.
// רק רכז או אדמין מחובר יכול להפעיל את זה.
//
// GET  → מחזיר כמה נמענים יש בכל קהל (לתצוגה מקדימה)
// POST → שולח את ההודעה בפועל
//
// בשונה ממחנה סוכות — כאן אפשר לסנן גם לפי יום ספציפי.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FROM = 'טבע בייק <info@mail.tevabike.com>'
const EVENT_NAME = 'ימי שיא — אוגוסט 2026'

const DAY_IDS = ['yaad', 'yarden', 'misgav'] as const
type DayId = (typeof DAY_IDS)[number]

const DAY_LABEL: Record<DayId, string> = {
  yaad: "יום א' | יעד — 16.8",
  yarden: "יום ג' | ירדן — 18.8",
  misgav: "יום ה' | משגב — 20.8",
}

const FALLBACK_PAY_URL = 'https://arbox.link/KOJLpy0l'

type Audience = 'all' | 'paid' | 'pending'
type DayFilter = 'all' | DayId

type Reg = {
  id: string
  rider_first_name: string
  rider_last_name: string
  parent_name: string
  parent_email: string
  payment_status: string
  days: string[] | null
  payment_link: string | null
}

type Db = ReturnType<typeof createClient>

function admin(): Db | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// מוודא שהקורא הוא רכז מחובר. מחזיר null אם הכל תקין, או תשובת שגיאה.
async function guard(req: NextRequest, db: Db) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return NextResponse.json({ ok: false, error: 'לא מחובר' }, { status: 401 })

  const { data: caller, error } = await db.auth.getUser(token)
  if (error || !caller?.user)
    return NextResponse.json({ ok: false, error: 'ההזדהות נכשלה, התחבר מחדש' }, { status: 401 })

  const { data: roleRow } = await db
    .from('admin_roles')
    .select('role')
    .eq('user_id', caller.user.id)
    .single()

  const role = (roleRow as { role?: string } | null)?.role
  if (!role || !['coordinator', 'admin'].includes(role))
    return NextResponse.json({ ok: false, error: 'אין לך הרשאה לשלוח הודעות' }, { status: 403 })

  return null
}

function pick(regs: Reg[], audience: Audience, day: DayFilter) {
  let out = regs
  if (day !== 'all') out = out.filter(r => (r.days ?? []).includes(day))
  if (audience === 'paid') out = out.filter(r => r.payment_status === 'paid')
  if (audience === 'pending') out = out.filter(r => r.payment_status === 'pending')
  return out
}

function html(r: Reg, title: string, bodyText: string, showPayButton: boolean, day: DayFilter) {
  // הטקסט מגיע כטקסט חופשי — הופכים שורות ריקות לפסקאות ושורה בודדת ל-<br>
  const escaped = bodyText
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const paragraphs = escaped
    .split(/\n\s*\n/)
    .map(p => `<p style="line-height:1.9;margin:0 0 14px">${p.replace(/\n/g, '<br>')}</p>`)
    .join('')

  const greeting = r.parent_name ? `<p style="margin:0 0 14px">היי ${r.parent_name},</p>` : ''

  // איזה ימים מוצגים בכותרת — היום שנבחר בסינון, או כל הימים שההורה רשום אליהם
  const shownDays = day !== 'all'
    ? [DAY_LABEL[day]]
    : (r.days ?? []).map(d => DAY_LABEL[d as DayId] ?? d)

  const daysLine = shownDays.length
    ? `<p style="margin:0 0 18px;color:#555">${shownDays.join(' · ')}</p>`
    : ''

  const payUrl = r.payment_link || FALLBACK_PAY_URL
  const pay = showPayButton
    ? `<p style="margin:22px 0">
         <a href="${payUrl}" style="background:#b5e853;color:#0d0f0e;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">להשלמת התשלום</a>
       </p>`
    : ''

  return `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif;color:#1a1a1a;max-width:600px">
    <h2 style="margin:0 0 4px">${title.replace(/</g, '&lt;')}</h2>
    <p style="margin:0 0 4px;color:#555">${EVENT_NAME}</p>
    ${daysLine}
    ${greeting}
    ${paragraphs}
    ${pay}
    <p style="margin-top:26px;color:#666;font-size:13px">שאלות? בני 052-5708084 · טל 050-5358071</p>
  </div>`
}

async function sendEmail(to: string[], subject: string, body: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html: body }),
    })
    if (!res.ok) { console.error('[peak-broadcast] resend failed:', res.status, await res.text()); return false }
    return true
  } catch (err) {
    console.error('[peak-broadcast] resend error:', err)
    return false
  }
}

// ---------- GET: כמה נמענים בכל קהל ----------

export async function GET(req: NextRequest) {
  const db = admin()
  if (!db) return NextResponse.json({ ok: false, error: 'השרת לא מוגדר נכון (חסר מפתח שירות)' }, { status: 500 })

  const denied = await guard(req, db)
  if (denied) return denied

  const { data } = await db
    .from('camp_registrations')
    .select('payment_status, days')
    .neq('payment_status', 'cancelled')

  const rows = (data ?? []) as { payment_status: string; days: string[] | null }[]

  const byDay: Record<string, { all: number; paid: number; pending: number }> = {}
  for (const d of DAY_IDS) {
    const inDay = rows.filter(r => (r.days ?? []).includes(d))
    byDay[d] = {
      all: inDay.length,
      paid: inDay.filter(r => r.payment_status === 'paid').length,
      pending: inDay.filter(r => r.payment_status === 'pending').length,
    }
  }

  return NextResponse.json({
    ok: true,
    counts: {
      all: rows.length,
      paid: rows.filter(r => r.payment_status === 'paid').length,
      pending: rows.filter(r => r.payment_status === 'pending').length,
    },
    byDay,
  })
}

// ---------- POST: שליחה ----------

export async function POST(req: NextRequest) {
  const db = admin()
  if (!db) return NextResponse.json({ ok: false, error: 'השרת לא מוגדר נכון (חסר מפתח שירות)' }, { status: 500 })

  const denied = await guard(req, db)
  if (denied) return denied

  let body: { subject?: string; message?: string; audience?: string; day?: string; includePayButton?: boolean; testTo?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'בקשה לא תקינה' }, { status: 400 }) }

  const subject = (body.subject ?? '').trim()
  const message = (body.message ?? '').trim()
  const audience = (['all', 'paid', 'pending'].includes(body.audience ?? '') ? body.audience : 'all') as Audience
  const day = ((DAY_IDS as readonly string[]).includes(body.day ?? '') ? body.day : 'all') as DayFilter
  const showPay = body.includePayButton === true
  const testTo = (body.testTo ?? '').trim()

  if (!subject) return NextResponse.json({ ok: false, error: 'חסרה כותרת להודעה' }, { status: 400 })
  if (message.length < 5) return NextResponse.json({ ok: false, error: 'ההודעה קצרה מדי' }, { status: 400 })

  const { data, error } = await db
    .from('camp_registrations')
    .select('id, rider_first_name, rider_last_name, parent_name, parent_email, payment_status, days, payment_link')
    .neq('payment_status', 'cancelled')

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const regs = (data ?? []) as Reg[]

  // מצב בדיקה — שולח עותק אחד בלבד לכתובת שנבחרה, בלי לגעת בנרשמים
  if (testTo) {
    const sample: Reg = pick(regs, audience, day)[0] ?? {
      id: 'test', rider_first_name: 'ישראל', rider_last_name: 'ישראלי',
      parent_name: 'הורה לדוגמה', parent_email: testTo, payment_status: 'pending',
      days: day === 'all' ? [...DAY_IDS] : [day], payment_link: FALLBACK_PAY_URL,
    }
    const ok = await sendEmail([testTo], `[בדיקה] ${subject}`, html(sample, subject, message, showPay, day))
    return NextResponse.json({ ok, test: true, sent: ok ? 1 : 0 })
  }

  const targets = pick(regs, audience, day)
  if (targets.length === 0)
    return NextResponse.json({ ok: false, error: 'אין נמענים בקהל שנבחר' }, { status: 400 })

  // הורה אחד עם כמה ילדים לא יקבל את אותה הודעה פעמיים
  const seen = new Set<string>()
  const unique = targets.filter(r => {
    const key = (r.parent_email ?? '').trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })

  let sent = 0
  const failed: string[] = []

  for (const r of unique) {
    const ok = await sendEmail([r.parent_email], subject, html(r, subject, message, showPay, day))
    if (ok) sent += 1
    else failed.push(`${r.rider_first_name} ${r.rider_last_name} (${r.parent_email})`)
  }

  return NextResponse.json({ ok: true, sent, total: unique.length, failed })
}
