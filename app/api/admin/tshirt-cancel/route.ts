import { NextRequest, NextResponse } from 'next/server'
import { adminDb, requireCoordinator } from '@/lib/admin-api'
import { sendEmail } from '@/lib/tshirt-order-email'

// ביטול הזמנת ביגוד מפאנל הניהול. רק רכז או אדמין מחובר.
//
// POST { order_group, undo? }
//   בלי undo — מסמן cancelled_at על כל שורות ההזמנה ושולח ללקוח מייל
//              שההזמנה בוטלה (אם השאיר אימייל).
//   undo: true — מחזיר את ההזמנה לפעילה, בלי מייל.
// החזר כספי (אם כבר שולם) נעשה ידנית ב-Arbox — אין לנו גישה לזיכוי מכאן.

export const dynamic = 'force-dynamic'

type Row = {
  id: string
  product_name: string
  size: string
  quantity: number
  customer_name: string
  customer_email: string | null
  payment_status: string
  cancelled_at: string | null
}

function escape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function cancelHtml(rows: Row[]) {
  const items = rows
    .map((r) => `<p style="margin:0 0 6px"><b style="color:#D4288A">${escape(r.product_name)}</b> — מידה ${escape(r.size)} × ${r.quantity}</p>`)
    .join('')
  const paid = rows.some((r) => r.payment_status === 'confirmed')
  return `
  <div dir="rtl" style="font-family:Heebo,Arial,sans-serif;background:#0C1814;color:#F5F2EE;padding:32px 24px;border-radius:16px;max-width:520px;margin:0 auto">
    <h1 style="color:#D4288A;font-size:22px;margin:0 0 16px">ההזמנה שלך בוטלה</h1>
    <p style="margin:0 0 14px">היי ${escape(rows[0].customer_name)},</p>
    <p style="line-height:1.8;margin:0 0 14px">הזמנת הביגוד שלך מטבע בייק בוטלה.</p>
    <div style="background:#152A1E;border:1px solid #1F3D2A;border-radius:12px;padding:16px 18px;margin:0 0 16px">
      <p style="margin:0 0 10px;color:#7E948A;font-size:13px">הפריטים שבוטלו:</p>
      ${items}
    </div>
    ${paid ? '<p style="line-height:1.8;margin:0 0 14px">התשלום שלך יוחזר, ונעדכן אותך כשההחזר יבוצע.</p>' : ''}
    <p style="line-height:1.8;margin:0 0 14px">יש שאלה? אפשר פשוט להשיב למייל הזה.</p>
    <p style="margin:0">טבע בייק</p>
    <p style="font-size:12px;color:#7E948A;margin-top:20px">טבע בייק · tevabike.com</p>
  </div>`
}

export async function POST(req: NextRequest) {
  const db = adminDb()
  if (!db) return NextResponse.json({ ok: false, error: 'server_misconfigured' }, { status: 500 })
  const denied = await requireCoordinator(req, db)
  if (denied) return denied

  const body = await req.json().catch(() => ({}))
  const order_group = typeof body.order_group === 'string' ? body.order_group : ''
  const undo = body.undo === true
  if (!order_group) return NextResponse.json({ ok: false, error: 'חסר מזהה הזמנה' }, { status: 400 })

  const { data, error } = await db
    .from('tshirt_orders')
    .select('id, product_name, size, quantity, customer_name, customer_email, payment_status, cancelled_at')
    .eq('order_group', order_group)
  const rows = (data ?? []) as Row[]
  if (error || rows.length === 0) return NextResponse.json({ ok: false, error: 'ההזמנה לא נמצאה' }, { status: 404 })

  const cancelled_at = undo ? null : new Date().toISOString()
  const { error: updErr } = await db
    .from('tshirt_orders')
    .update({ cancelled_at })
    .eq('order_group', order_group)
  if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 })

  // מייל רק בביטול ראשון (לא אם כבר הייתה מבוטלת, ולא בשחזור)
  let emailed = false
  const wasCancelled = rows.every((r) => r.cancelled_at)
  if (!undo && !wasCancelled && rows[0].customer_email) {
    emailed = await sendEmail(rows[0].customer_email, undefined, 'הזמנת הביגוד שלך בוטלה — טבע בייק', cancelHtml(rows))
  }

  return NextResponse.json({ ok: true, cancelled_at, emailed })
}
