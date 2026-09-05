// app/api/shop-cancel-request/route.ts — קליטת בקשת ביטול הזמנה מדף /shop/cancel
//
// לא מבצע שום זיכוי בפועל — התשלום עובר דרך קישורי תשלום קבועים של ארבוקס
// (לא checkout מחובר ל-API), אז אין לנו webhook שמאשר תשלום ואין דרך
// להחזיר כסף אוטומטית מהשרת שלנו. מה שהראוט הזה כן עושה: שומר רשומת בקשה
// מתויגת בזמן, מנסה להתאים אותה להזמנה קיימת ב-shop_orders (לפי טלפון)
// כדי לחשב אוטומטית אם זה בתוך 14 יום ומה דמי הביטול הצפויים, ושולח
// התראה במייל לבני כדי שיבצע את הביטול בפועל בפאנל של ארבוקס.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const FROM = 'טבע בייק <info@mail.tevabike.com>'
const ALERT_TO = 'bennyfire@gmail.com'

const VALID_REASONS = ['not_wanted', 'defective', 'other']
const ELIGIBLE_WINDOW_DAYS = 14
const CANCELLATION_FEE_PCT = 0.05
const CANCELLATION_FEE_CAP = 100

const MAX_SHORT = 100
const MAX_PHONE = 30
const MAX_REFERENCE = 100
const MAX_DETAILS = 1000

function clean(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, max)
  return s.length ? s : null
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) return
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    })
  } catch {
    // fire-and-forget
  }
}

const REASON_LABELS: Record<string, string> = {
  not_wanted: 'לא רוצה יותר / הוזמן בטעות',
  defective: 'מוצר פגום / לא תקין',
  other: 'אחר',
}

function alertHtml(p: {
  customer_name: string; customer_phone: string; order_reference: string | null;
  reason: string; reason_details: string | null;
  matchedOrderId: string | null; matchedOrderCreatedAt: string | null; matchedOrderTotal: number | null;
  daysSinceOrder: number | null; eligible: boolean | null; estimatedFee: number | null;
}) {
  const eligibleLine =
    p.eligible === null
      ? 'לא נמצאה הזמנה תואמת לפי הטלפון — לבדוק ידנית.'
      : p.eligible
        ? `כן (${p.daysSinceOrder} ימים מההזמנה)`
        : `לא — עברו ${p.daysSinceOrder} ימים (מעל 14 יום)`
  const feeLine =
    p.estimatedFee === null ? 'לא ידוע (אין הזמנה תואמת)' : p.estimatedFee === 0 ? 'ללא (פגם — זיכוי מלא)' : `${p.estimatedFee} ₪`
  return `
  <div dir="rtl" style="font-family:Heebo,Arial,sans-serif;background:#0C1814;color:#F5F2EE;padding:32px 24px;border-radius:16px;max-width:520px;margin:0 auto">
    <h1 style="color:#D4288A;font-size:22px;margin:0 0 4px">בקשת ביטול הזמנה — טבע בייק</h1>
    <div style="background:#152A1E;border:1px solid #1F3D2A;border-radius:12px;padding:16px 18px">
      <p style="margin:0 0 8px"><b style="color:#D4288A">לקוח:</b> ${p.customer_name} · ${p.customer_phone}</p>
      <p style="margin:0 0 8px"><b style="color:#D4288A">מס' הזמנה שהוזן:</b> ${p.order_reference || '—'}</p>
      <p style="margin:0 0 8px"><b style="color:#D4288A">סיבה:</b> ${REASON_LABELS[p.reason] || p.reason}${p.reason_details ? ' — ' + p.reason_details : ''}</p>
      <p style="margin:0 0 8px"><b style="color:#D4288A">בתוך 14 יום:</b> ${eligibleLine}</p>
      <p style="margin:0 0 8px"><b style="color:#D4288A">דמי ביטול משוערים:</b> ${feeLine}</p>
      ${p.matchedOrderId ? `<p style="margin:0"><b style="color:#D4288A">הזמנה תואמת:</b> ${p.matchedOrderId.slice(0, 8)} · ${p.matchedOrderCreatedAt ? new Date(p.matchedOrderCreatedAt).toLocaleDateString('he-IL') : ''} · ${p.matchedOrderTotal ?? '?'} ₪</p>` : ''}
    </div>
    <p style="font-size:12px;color:#7E948A;margin-top:16px">
      זכור: אין זיכוי אוטומטי — יש לבצע את הביטול ידנית בפאנל ארבוקס אחרי אימות מול הלקוח.
    </p>
  </div>`
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const customer_name = clean(body.customer_name, MAX_SHORT)
  const customer_phone = clean(body.customer_phone, MAX_PHONE)
  const order_reference = clean(body.order_reference, MAX_REFERENCE)
  const reason = clean(body.reason, 20)
  const reason_details = clean(body.reason_details, MAX_DETAILS)

  if (!customer_name || !customer_phone) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }
  if (!reason || !VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: 'bad_reason' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  const supabase = createClient(url, serviceKey)

  // התאמה best-effort להזמנה קיימת לפי טלפון — הכי עדכנית קודם.
  const { data: matches } = await supabase
    .from('shop_orders')
    .select('id, created_at, total_amount')
    .eq('customer_phone', customer_phone)
    .order('created_at', { ascending: false })
    .limit(1)

  const matched = matches && matches.length > 0 ? matches[0] : null
  const matchedOrderId: string | null = matched?.id ?? null
  const matchedOrderCreatedAt: string | null = matched?.created_at ?? null
  const matchedOrderTotal: number | null = matched?.total_amount ?? null

  let daysSinceOrder: number | null = null
  let eligible: boolean | null = null
  if (matchedOrderCreatedAt) {
    const ms = Date.now() - new Date(matchedOrderCreatedAt).getTime()
    daysSinceOrder = Math.floor(ms / (1000 * 60 * 60 * 24))
    eligible = daysSinceOrder <= ELIGIBLE_WINDOW_DAYS
  }

  let estimatedFee: number | null = null
  if (reason === 'defective') {
    estimatedFee = 0
  } else if (matchedOrderTotal !== null) {
    estimatedFee = Math.min(Math.round(matchedOrderTotal * CANCELLATION_FEE_PCT), CANCELLATION_FEE_CAP)
  }

  const { data: inserted, error } = await supabase
    .from('shop_cancellation_requests')
    .insert({
      customer_name,
      customer_phone,
      order_reference,
      reason,
      reason_details,
      matched_order_id: matchedOrderId,
      matched_order_created_at: matchedOrderCreatedAt,
      matched_order_total: matchedOrderTotal,
      days_since_order: daysSinceOrder,
      eligible_14_day_window: eligible,
      estimated_fee: estimatedFee,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    console.error('shop-cancel-request insert failed:', error?.message)
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
  }

  await sendEmail(
    ALERT_TO,
    `בקשת ביטול הזמנה — ${customer_name}`,
    alertHtml({
      customer_name, customer_phone, order_reference, reason, reason_details,
      matchedOrderId, matchedOrderCreatedAt, matchedOrderTotal,
      daysSinceOrder, eligible, estimatedFee,
    })
  )

  return NextResponse.json({
    ok: true,
    id: inserted.id,
    matchedOrder: !!matchedOrderId,
    eligible14Days: eligible,
    estimatedFee,
  })
}
