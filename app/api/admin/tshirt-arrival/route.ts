import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, BENNY_EMAIL } from '@/lib/tshirt-order-email'

// מייל "החולצות הגיעו" לכל מי ששילם על הזמנת ביגוד.
// רק רכז או אדמין מחובר יכול להפעיל את זה.
//
// POST → שולח. עם testTo — מייל בדיקה אחד לכתובת הזו, בלי לסמן כלום.
//        בלי testTo — שולח לכל מי ששילם ועוד לא קיבל, ומסמן arrival_notified_at
//        כדי שלחיצה חוזרת לא תשלח שוב לאותם אנשים.

export const dynamic = 'force-dynamic'
export const maxDuration = 60


type Db = NonNullable<ReturnType<typeof admin>>

type Row = {
  id: string
  order_group: string
  product_name: string
  size: string
  quantity: number
  customer_name: string
  customer_email: string | null
  fulfillment: string
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function guard(req: NextRequest, db: Db) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return NextResponse.json({ ok: false, error: 'לא מחובר' }, { status: 401 })

  const { data: caller, error } = await db.auth.getUser(token)
  if (error || !caller?.user)
    return NextResponse.json({ ok: false, error: 'ההזדהות נכשלה, התחבר מחדש' }, { status: 401 })

  const { data: roleRows } = await db.from('admin_roles').select('role').eq('user_id', caller.user.id)
  const roles = ((roleRows ?? []) as Array<{ role?: string }>).map((r) => r.role)
  if (!roles.some((r) => r === 'coordinator' || r === 'admin'))
    return NextResponse.json({ ok: false, error: 'אין לך הרשאה לשלוח הודעות' }, { status: 403 })

  return null
}

// הזמנות ששולמו, עם אימייל, שעוד לא קיבלו הודעת הגעה — מקובצות לפי הזמנה
async function pendingGroups(db: Db) {
  const { data, error } = await db
    .from('tshirt_orders')
    .select('id, order_group, product_name, size, quantity, customer_name, customer_email, fulfillment')
    .eq('payment_status', 'confirmed')
    .is('arrival_notified_at', null)
    .not('customer_email', 'is', null)
  if (error) return { error: error.message, groups: [] as Row[][] }
  const map = new Map<string, Row[]>()
  for (const r of (data ?? []) as Row[]) {
    const list = map.get(r.order_group) ?? []
    list.push(r)
    map.set(r.order_group, list)
  }
  return { error: null, groups: [...map.values()] }
}

function escape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function arrivalHtml(rows: Row[], note: string) {
  const items = rows
    .map((r) => `<p style="margin:0 0 6px"><b style="color:#D4288A">${escape(r.product_name)}</b> — מידה ${escape(r.size)} × ${r.quantity}</p>`)
    .join('')
  const noteHtml = note.trim()
    ? escape(note.trim())
        .split(/\n\s*\n/)
        .map((p) => `<p style="line-height:1.8;margin:0 0 12px">${p.replace(/\n/g, '<br>')}</p>`)
        .join('')
    : ''
  return `
  <div dir="rtl" style="font-family:Heebo,Arial,sans-serif;background:#0C1814;color:#F5F2EE;padding:32px 24px;border-radius:16px;max-width:520px;margin:0 auto">
    <h1 style="color:#D4288A;font-size:22px;margin:0 0 16px">החולצות הגיעו! 🎉</h1>
    <p style="margin:0 0 14px">היי ${escape(rows[0].customer_name)},</p>
    <p style="line-height:1.8;margin:0 0 14px">${rows[0].fulfillment === 'delivery'
      ? 'הקולקציה של טבע בייק הגיעה! ההזמנה שלך יוצאת אליך במשלוח לכתובת שמסרת.'
      : 'הקולקציה של טבע בייק הגיעה, וההזמנה שלך מחכה לך לאיסוף במועדון.'}</p>
    <div style="background:#152A1E;border:1px solid #1F3D2A;border-radius:12px;padding:16px 18px;margin:0 0 16px">
      <p style="margin:0 0 10px;color:#7E948A;font-size:13px">מה הזמנת:</p>
      ${items}
    </div>
    ${noteHtml}
    <p style="margin:0">נתראה בשטח!<br>טבע בייק</p>
    <p style="font-size:12px;color:#7E948A;margin-top:20px">טבע בייק · tevabike.com</p>
  </div>`
}

const SUBJECT = 'החולצות של טבע בייק הגיעו!'

export async function POST(req: NextRequest) {
  const db = admin()
  if (!db) return NextResponse.json({ ok: false, error: 'server_misconfigured' }, { status: 500 })
  const denied = await guard(req, db)
  if (denied) return denied

  const body = await req.json().catch(() => ({}))
  const note = typeof body.note === 'string' ? body.note.slice(0, 2000) : ''
  const testTo = typeof body.testTo === 'string' ? body.testTo.trim() : ''

  const { error, groups } = await pendingGroups(db)
  if (error) return NextResponse.json({ ok: false, error }, { status: 500 })

  if (testTo) {
    const sample: Row[] = groups[0] ?? [
      { id: '', order_group: '', product_name: 'חולצה קצרה', size: 'M', quantity: 1, customer_name: 'בדיקה', customer_email: testTo, fulfillment: 'pickup' },
    ]
    const ok = await sendEmail(testTo, undefined, `[בדיקה] ${SUBJECT}`, arrivalHtml(sample, note))
    return ok
      ? NextResponse.json({ ok: true, test: true })
      : NextResponse.json({ ok: false, error: 'שליחת מייל הבדיקה נכשלה' }, { status: 502 })
  }

  let sent = 0
  const failed: string[] = []
  for (const rows of groups) {
    const to = rows[0].customer_email!
    const ok = await sendEmail(to, undefined, SUBJECT, arrivalHtml(rows, note))
    if (!ok) { failed.push(rows[0].customer_name); continue }
    sent++
    await db
      .from('tshirt_orders')
      .update({ arrival_notified_at: new Date().toISOString() })
      .in('id', rows.map((r) => r.id))
  }

  if (sent > 0) {
    await sendEmail(
      BENNY_EMAIL, undefined, `נשלחה הודעת הגעת חולצות ל-${sent} לקוחות`,
      `<div dir="rtl" style="font-family:Arial,sans-serif">נשלחה הודעת "החולצות הגיעו" ל-${sent} הזמנות.${failed.length ? `<br>נכשלו: ${failed.map(escape).join(', ')}` : ''}</div>`
    )
  }

  return NextResponse.json({ ok: true, sent, total: groups.length, failed })
}
