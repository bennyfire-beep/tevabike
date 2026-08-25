// app/api/shop-order/route.ts — קליטת הזמנה מדף /shop + מייל לספק (גרסה 2 — עלות משלוח)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Public shop order intake. Inserts with the SERVICE ROLE, then fires a
// notification email with the order details. Email is awaited — on Vercel
// the function freezes right after the response returns, so an un-awaited
// send silently dies (same lesson as workshop-register).

export const dynamic = 'force-dynamic'

const FROM = 'טבע בייק <info@mail.tevabike.com>'
const REPLY_TO = 'bennyfire@gmail.com'

// TODO אחרי הפגישה: להחליף בכתובת המייל האמיתית שדודי נותן לך להזמנות.
// עד אז ההזמנות מגיעות אליך, בדיוק בפורמט שדודי יקבל בעתיד.
const SUPPLIER_EMAIL = 'bennyfire@gmail.com'

const VALID_SLUGS = ['spank-spoon-35', 'spank-spike-33-grip', 'spank-spoon-pedals']
const VALID_FULFILLMENT = ['pickup', 'delivery']

// מחירים ועלות משלוח מחושבים בשרת (לא סומכים על מה שהלקוח שלח) — חייבים
// להישאר זהים למה שמוצג ב-app/shop/page.tsx.
const PRODUCT_PRICES: Record<string, number> = {
  'spank-spoon-35': 399,
  'spank-spike-33-grip': 139,
  'spank-spoon-pedals': 449,
}
const SHIPPING_COST = 50
const FREE_SHIPPING_THRESHOLD = 600

const MAX_SHORT = 100
const MAX_PHONE = 30
const MAX_ADDRESS = 300

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
      body: JSON.stringify({ from: FROM, to, reply_to: REPLY_TO, subject, html }),
    })
  } catch {
    // fire-and-forget
  }
}

function orderHtml(orderId: string, p: {
  product_name: string; color: string; quantity: number; customer_name: string;
  customer_phone: string; fulfillment: string; delivery_address: string | null;
  subtotal: number; shipping: number; total: number;
}) {
  const fulfillmentLabel = p.fulfillment === 'delivery' ? 'משלוח ללקוח' : 'איסוף מטבע בייק'
  return `
  <div dir="rtl" style="font-family:Heebo,Arial,sans-serif;background:#0C1814;color:#F5F2EE;padding:32px 24px;border-radius:16px;max-width:520px;margin:0 auto">
    <h1 style="color:#D4288A;font-size:22px;margin:0 0 4px">הזמנה חדשה מטבע בייק</h1>
    <p style="color:#7E948A;font-size:13px;margin:0 0 20px">מס' הזמנה: ${orderId.slice(0, 8)}</p>
    <div style="background:#152A1E;border:1px solid #1F3D2A;border-radius:12px;padding:16px 18px">
      <p style="margin:0 0 8px"><b style="color:#D4288A">מוצר:</b> ${p.product_name}</p>
      <p style="margin:0 0 8px"><b style="color:#D4288A">גוון/דגם:</b> ${p.color}</p>
      <p style="margin:0 0 8px"><b style="color:#D4288A">כמות:</b> ${p.quantity}</p>
      <p style="margin:0 0 8px"><b style="color:#D4288A">לקוח:</b> ${p.customer_name} · ${p.customer_phone}</p>
      <p style="margin:0 0 8px"><b style="color:#D4288A">אופן קבלה:</b> ${fulfillmentLabel}${p.delivery_address ? ' — ' + p.delivery_address : ''}</p>
      <p style="margin:0"><b style="color:#D4288A">סה"כ לגבייה:</b> ${p.subtotal} ₪ + משלוח ${p.shipping === 0 ? 'חינם' : p.shipping + ' ₪'} = <b>${p.total} ₪</b></p>
    </div>
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

  const product_slug = clean(body.product_slug, 60)
  const product_name = clean(body.product_name, MAX_SHORT)
  const color = clean(body.color, MAX_SHORT)
  const quantityRaw = clean(body.quantity, 5)
  const quantity = quantityRaw && /^\d{1,3}$/.test(quantityRaw) ? parseInt(quantityRaw, 10) : 1
  const customer_name = clean(body.customer_name, MAX_SHORT)
  const customer_phone = clean(body.customer_phone, MAX_PHONE)
  const fulfillment = clean(body.fulfillment, 20) || 'pickup'
  const delivery_address = clean(body.delivery_address, MAX_ADDRESS)

  if (!product_slug || !VALID_SLUGS.includes(product_slug)) {
    return NextResponse.json({ error: 'bad_product' }, { status: 400 })
  }

  const unitPrice = PRODUCT_PRICES[product_slug]
  const subtotal = unitPrice * quantity
  const shipping = fulfillment === 'delivery' && subtotal < FREE_SHIPPING_THRESHOLD ? SHIPPING_COST : 0
  const total = subtotal + shipping
  if (!product_name || !color || !customer_name || !customer_phone) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }
  if (!VALID_FULFILLMENT.includes(fulfillment)) {
    return NextResponse.json({ error: 'bad_fulfillment' }, { status: 400 })
  }
  if (fulfillment === 'delivery' && !delivery_address) {
    return NextResponse.json({ error: 'missing_address' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  const supabase = createClient(url, serviceKey)

  const { data, error } = await supabase
    .from('shop_orders')
    .insert({
      product_slug,
      product_name,
      color,
      quantity,
      customer_name,
      customer_phone,
      fulfillment,
      delivery_address,
      shipping_amount: shipping,
      total_amount: total,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('shop-order insert failed:', error?.message)
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
  }

  await sendEmail(
    SUPPLIER_EMAIL,
    `הזמנה חדשה מטבע בייק — ${product_name}`,
    orderHtml(data.id, {
      product_name, color, quantity, customer_name, customer_phone, fulfillment, delivery_address,
      subtotal, shipping, total,
    })
  )

  return NextResponse.json({ ok: true, id: data.id, total })
}
