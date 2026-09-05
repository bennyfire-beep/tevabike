// app/api/shop-order/route.ts — קליטת הזמנה מדף /shop (גרסה 4 — לא שולח
// לפאן רייד אוטומטית!)
//
// חשוב: אין webhook מארבוקס שמאשר תשלום, אז בעבר המייל לספק יצא כאן מיד
// עם שליחת הטופס — לפני שידוע בכלל אם הלקוח באמת שילם. כל הזמנת בדיקה
// גרמה למייל אמיתי אצל פאן רייד. עכשיו הראוט הזה רק שומר את ההזמנה ושולח
// התראה פנימית לבני (לא לספק) שיש הזמנה חדשה לבדוק בארבוקס. השליחה בפועל
// לפאן רייד קורית ידנית מ-/admin/coordinator/shop-orders (route.ts תחת
// notify-supplier/) אחרי שבני מוודא שהתשלום אכן עבר.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BENNY_EMAIL, orderHtml, sendEmail } from '@/lib/shop-order-email'

export const dynamic = 'force-dynamic'

const VALID_SLUGS = ['spank-spoon-35', 'spank-spike-33-grip', 'spank-spoon-pedals']
// אין יותר איסוף עצמי — כל הזמנה יוצאת במשלוח.
const VALID_FULFILLMENT = ['delivery']

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
const MAX_EMAIL = 200
const MAX_ITEMS = 3

function clean(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, max)
  return s.length ? s : null
}

// מוסיף/מעדכן ליד ב-community_contacts (מאגר המידע השיווקי, מסונכרן ל-Resend
// ע"י תהליך חיצוני שלא חלק מהריפו — ראה resend_contact_id) כשלקוח מסמן
// שהוא רוצה לקבל מבצעים במייל. best-effort בלבד — לעולם לא נכשיל את
// ההזמנה בגללו, ולא דורסים unsubscribed/interests קיימים.
async function upsertCommunityContact(
  supabase: ReturnType<typeof createClient>,
  p: { full_name: string; email: string; phone: string }
) {
  try {
    const { data: existing } = await supabase
      .from('community_contacts')
      .select('id, interests')
      .eq('email', p.email)
      .maybeSingle()
    if (existing) {
      const interests = Array.from(new Set([...(((existing as any).interests as string[]) || []), 'חנות']))
      await supabase
        .from('community_contacts')
        .update({ full_name: p.full_name, phone: p.phone, interests })
        .eq('id', (existing as any).id)
    } else {
      await supabase
        .from('community_contacts')
        .insert({ full_name: p.full_name, email: p.email, phone: p.phone, source: 'shop', interests: ['חנות'] })
    }
  } catch (err) {
    console.error('community_contacts upsert failed:', err)
  }
}

type Item = { product_slug: string; product_name: string; variant: string }

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
  const customer_email = clean(body.customer_email, MAX_EMAIL)
  const marketing_optin = body.marketing_optin === true
  const fulfillment = clean(body.fulfillment, 20) || 'delivery'
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
  if (!delivery_city || !delivery_street) {
    return NextResponse.json({ error: 'missing_address' }, { status: 400 })
  }
  if (marketing_optin && !customer_email) {
    return NextResponse.json({ error: 'missing_email' }, { status: 400 })
  }

  const subtotal = items.reduce((sum, it) => sum + (PRODUCT_PRICES[it.product_slug] || 0), 0)
  const shipping = subtotal < FREE_SHIPPING_THRESHOLD ? SHIPPING_COST : 0
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

  if (marketing_optin && customer_email) {
    await upsertCommunityContact(supabase, { full_name: customer_name, email: customer_email, phone: customer_phone })
  }

  // התראה פנימית בלבד — לבני, לא לפאן רייד. השליחה לספק קורית ידנית
  // מ-/admin/coordinator/shop-orders אחרי אימות תשלום בארבוקס (ראו
  // notify-supplier/route.ts). supplier_notified נשאר false עד אז.
  await sendEmail(
    BENNY_EMAIL,
    undefined,
    `הזמנה חדשה ממתינה לאישור תשלום — ${items.map((i) => i.product_name).join(' + ')}`,
    orderHtml(data[0].id, {
      items, customer_name, customer_phone, fulfillment, delivery_address,
      subtotal, shipping, total,
      internalNote: '⚠️ טרם נשלח לפאן רייד — יש לוודא שהתשלום עבר בארבוקס, ואז לשלוח ידנית ממסך "הזמנות חנות".',
    })
  )

  return NextResponse.json({ ok: true, id: data[0].id, total })
}
