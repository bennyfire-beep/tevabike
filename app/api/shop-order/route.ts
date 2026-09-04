// app/api/shop-order/route.ts — קליטת הזמנה מדף /shop + מייל לספק (גרסה 3 — בחירה מרובה + CC לבני)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const FROM = 'טבע בייק <info@mail.tevabike.com>'
const REPLY_TO = 'bennyfire@gmail.com'

const SUPPLIER_EMAIL = 'orderfunride@gmail.com'
const BENNY_CC = 'bennyfire@gmail.com'

const ESTIMATED_DELIVERY = 'כ-7-10 ימי עסקים (יתכנו שינויים בשל עומסים שאינם תלויים בנו)'
const RETURNS_PHONE = '0509446696'
const SUPPORT_HOURS =
  "מענה טלפוני להחלפות/החזרות ולבירורי משלוח: ימים א'–ה' 08:00–16:00. בימי שישי ושבת אין מענה."

const VALID_SLUGS = ['spank-spoon-35', 'spank-spike-33-grip', 'spank-spoon-pedals']
const VALID_FULFILLMENT = ['pickup', 'delivery']

const PRODUCT_PRICES: Record<string, number> = {
  'spank-spoon-35': 399,
  'spank-spike-33-grip': 139,
  'spank-spoon-pedals': 449,
}
const SHIPPING_COST = 35
const FREE_SHIPPING_THRESHOLD = 600

const MAX_SHORT = 100
const MAX_PHONE = 30
const MAX_ADDRESS_PART = 150
const MAX_ITEMS = 3

function clean(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, max)
  return s.length ? s : null
}

async function sendEmail(to: string, cc: string | undefined, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) return
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, cc, reply_to: REPLY_TO, subject, html }),
    })
  } catch {
    // fire-and-forget
  }
}

type Item = { product_slug: string; product_name: string; variant: string }

function orderHtml(orderId: string, p: {
  items: Item[]; customer_name: string; customer_phone: string;
  fulfillment: string; delivery_address: string | null;
  subtotal: number; shipping: number; total: number;
}) {
  const fulfillmentLabel = p.fulfillment === 'delivery' ? 'משלוח ללקוח' : 'איסוף מטבע בייק'
  const itemsHtml = p.items
    .map(
      (it) =>
        `<p style="margin:0 0 6px"><b style="color:#D4288A">${it.product_name}</b> — ${it.variant}</p>`
    )
    .join('')
  return `
  <div dir="rtl" style="font-family:Heebo,Arial,sans-serif;background:#0C1814;color:#F5F2EE;padding:32px 24px;border-radius:16px;max-width:520px;margin:0 auto">
    <h1 style="color:#D4288A;font-size:22px;margin:0 0 4px">הזמנה חדשה מטבע בייק</h1>
    <p style="color:#7E948A;font-size:13px;margin:0 0 20px">מס' הזמנה: ${orderId.slice(0, 8)}</p>
    <div style="background:#152A1E;border:1px solid #1F3D2A;border-radius:12px;padding:16px 18px">
      ${itemsHtml}
      <p style="margin:12px 0 8px"><b style="color:#D4288A">לקוח:</b> ${p.customer_name} · ${p.customer_phone}</p>
      <p style="margin:0 0 8px"><b style="color:#D4288A">אופן קבלה:</b> ${fulfillmentLabel}${p.delivery_address ? ' — ' + p.delivery_address : ''}</p>
      <p style="margin:0 0 8px"><b style="color:#D4288A">סה"כ לגבייה:</b> ${p.subtotal} ₪ + משלוח ${p.shipping === 0 ? 'חינם' : p.shipping + ' ₪'} = <b>${p.total} ₪</b></p>
      <p style="margin:0"><b style="color:#D4288A">זמן אספקה משוער:</b> ${ESTIMATED_DELIVERY}</p>
    </div>
    <p style="font-size:12px;color:#9FB3A8;margin-top:16px;line-height:1.6">
      האחריות על המוצרים ועל המשלוח היא באחריות פאן רייד. החלפות והחזרות בתיאום מראש מול
      מחסני החברה — טלפון ${RETURNS_PHONE}.
    </p>
    <p style="font-size:12px;color:#7E948A;margin-top:8px">${SUPPORT_HOURS}</p>
    <p style="font-size:12px;color:#7E948A;margin-top:20px">טבע בייק · tevabike.com</p>
  </div>`
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const rawItems = Array.isArray(body.items) ? body.items : []
  const items: Item[] = []
  for (const raw of rawItems.slice(0, MAX_ITEMS)) {
    if (typeof raw !== 'object' || raw === null) continue
    const r = raw as Record<string, unknown>
    const product_slug = clean(r.product_slug, 60)
    const product_name = clean(r.product_name, MAX_SHORT)
    const variant = clean(r.variant, MAX_SHORT)
    if (!product_slug || !VALID_SLUGS.includes(product_slug) || !product_name || !variant) continue
    items.push({ product_slug, product_name, variant })
  }
  if (items.length === 0) {
    return NextResponse.json({ error: 'no_items' }, { status: 400 })
  }
  const uniqueSlugs = new Set(items.map((i) => i.product_slug))
  if (uniqueSlugs.size !== items.length) {
    return NextResponse.json({ error: 'duplicate_item' }, { status: 400 })
  }

  const customer_name = clean(body.customer_name, MAX_SHORT)
  const customer_phone = clean(body.customer_phone, MAX_PHONE)
  const fulfillment = clean(body.fulfillment, 20) || 'pickup'
  const delivery_city = clean(body.delivery_city, MAX_ADDRESS_PART)
  const delivery_street = clean(body.delivery_street, MAX_ADDRESS_PART)
  const delivery_address =
    delivery_street && delivery_city ? `${delivery_street}, ${delivery_city}` : delivery_street || delivery_city

  if (!customer_name || !customer_phone) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }
  if (!VALID_FULFILLMENT.includes(fulfillment)) {
    return NextResponse.json({ error: 'bad_fulfillment' }, { status: 400 })
  }
  if (fulfillment === 'delivery' && (!delivery_city || !delivery_street)) {
    return NextResponse.json({ error: 'missing_address' }, { status: 400 })
  }

  const subtotal = items.reduce((sum, it) => sum + (PRODUCT_PRICES[it.product_slug] || 0), 0)
  const shipping = fulfillment === 'delivery' && subtotal < FREE_SHIPPING_THRESHOLD ? SHIPPING_COST : 0
  const total = subtotal + shipping

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  const supabase = createClient(url, serviceKey)

  const groupKey = `${customer_phone}-${Date.now()}`
  const rows = items.map((it) => ({
    product_slug: it.product_slug,
    product_name: it.product_name,
    color: it.variant,
    quantity: 1,
    customer_name,
    customer_phone,
    fulfillment,
    delivery_address,
    shipping_amount: shipping,
    total_amount: total,
    order_group: groupKey,
  }))

  const { data, error } = await supabase.from('shop_orders').insert(rows).select('id')

  if (error || !data || data.length === 0) {
    console.error('shop-order insert failed:', error?.message)
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
  }

  await sendEmail(
    SUPPLIER_EMAIL,
    BENNY_CC,
    `הזמנה חדשה מטבע בייק — ${items.map((i) => i.product_name).join(' + ')}`,
    orderHtml(data[0].id, {
      items, customer_name, customer_phone, fulfillment, delivery_address,
      subtotal, shipping, total,
    })
  )

  return NextResponse.json({ ok: true, id: data[0].id, total })
}
