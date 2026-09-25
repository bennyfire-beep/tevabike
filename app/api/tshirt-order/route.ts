// app/api/tshirt-order/route.ts — קליטת הזמנת חולצות מ-/shop (טאב "חולצות").
//
// שונה מ-/api/shop-order: אין דרופשיפינג/ספק, אז אין שלב "שלח לספק" — החולצות
// מודפסות במרוכז ומחולקות באיסוף עצמי מהמועדון, או במשלוח עד הבית (דמי
// משלוח קבועים פעם אחת להזמנה, בקישור Arbox נפרד מ-tshirt_shop_settings). גם אין קישור Arbox יחיד
// לכל "צירוף" אפשרי (כמו באביזרים) כי כאן כל אחד יכול להזמין כמות חופשית
// לפי מידות — אז מחזירים ללקוח קישור תשלום נפרד לכל סוג מוצר שהוזמן, לפי
// מצב ה-preorder הנוכחי (נשלף מה-DB, לא מהלקוח).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { tshirtOrderHtml, sendEmail, BENNY_EMAIL, type TshirtLine } from '@/lib/tshirt-order-email'
import { HIDDEN_TSHIRT_SLUGS } from '@/lib/tshirt-hidden'

export const dynamic = 'force-dynamic'

const VALID_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
const MAX_LINES = 20
const MAX_QTY = 30
const MAX_SHORT = 100
const MAX_PHONE = 30
const MAX_EMAIL = 200
const MAX_BACK_NAME = 40
const MAX_ADDRESS = 200

function clean(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, max)
  return s.length ? s : null
}

type RawLine = { product_slug: string; size: string; back_name: string | null; quantity: number }

type ProductRow = {
  slug: string
  name: string
  requires_back_name: boolean
  preorder_price: number
  regular_price: number
  preorder_active: boolean
  preorder_arbox_link: string | null
  regular_arbox_link: string | null
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const rawLines = Array.isArray(body.lines) ? body.lines : []
  const lines: RawLine[] = []
  for (const raw of rawLines.slice(0, MAX_LINES)) {
    if (typeof raw !== 'object' || raw === null) continue
    const r = raw as Record<string, unknown>
    const product_slug = clean(r.product_slug, 40)
    const size = clean(r.size, 10)
    const back_name = clean(r.back_name, MAX_BACK_NAME)
    const quantity = Math.floor(Number(r.quantity))
    if (!product_slug || !size || !VALID_SIZES.includes(size)) continue
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QTY) continue
    lines.push({ product_slug, size, back_name, quantity })
  }
  if (lines.length === 0) {
    return NextResponse.json({ error: 'no_items' }, { status: 400 })
  }

  const customer_name = clean(body.customer_name, MAX_SHORT)
  const customer_phone = clean(body.customer_phone, MAX_PHONE)
  const customer_email = clean(body.customer_email, MAX_EMAIL)
  if (!customer_name || !customer_phone || !customer_email) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }
  const fulfillment = body.fulfillment === 'delivery' ? 'delivery' : 'pickup'
  const delivery_address = fulfillment === 'delivery' ? clean(body.delivery_address, MAX_ADDRESS) : null
  if (fulfillment === 'delivery' && !delivery_address) {
    return NextResponse.json({ error: 'missing_address' }, { status: 400 })
  }
  // קוד הפניה (שגריר) — רשות, בלי הנחה. נבדק מול הטבלה אחרי יצירת הלקוח.
  const rawReferral = clean(body.referral_code, 30)
  const referral_code_input = rawReferral ? rawReferral.toUpperCase().replace(/\s+/g, '') : null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  const supabase = createClient(url, serviceKey)

  // אף פעם לא סומכים על מחיר/מצב-preorder שמגיע מהלקוח — שולפים מהמקור.
  const slugs = Array.from(new Set(lines.map((l) => l.product_slug)))
  const { data: products, error: productsError } = await supabase
    .from('tshirt_products')
    .select('slug, name, requires_back_name, preorder_price, regular_price, preorder_active, preorder_arbox_link, regular_arbox_link, sizes')
    .in('slug', slugs)

  if (productsError || !products) {
    return NextResponse.json({ error: 'products_lookup_failed' }, { status: 500 })
  }
  if (slugs.some((s) => HIDDEN_TSHIRT_SLUGS.includes(s))) {
    return NextResponse.json({ error: 'unknown_product' }, { status: 400 })
  }
  const bySlug = new Map((products as (ProductRow & { sizes: string[] })[]).map((p) => [p.slug, p]))
  if (bySlug.size !== slugs.length) {
    return NextResponse.json({ error: 'unknown_product' }, { status: 400 })
  }

  let referral_code: string | null = null
  if (referral_code_input) {
    const { data: ref } = await supabase
      .from('tshirt_referral_codes')
      .select('code')
      .eq('code', referral_code_input)
      .eq('is_active', true)
      .maybeSingle()
    if (!ref) return NextResponse.json({ error: 'bad_referral' }, { status: 400 })
    referral_code = ref.code as string
  }

  // דמי המשלוח ומבצע הכובע נשלפים מההגדרות, לא מהלקוח
  const { data: settings } = await supabase
    .from('tshirt_shop_settings')
    .select('shipping_price, shipping_arbox_link, hat_promo_active, hat_promo_min_total, hat_promo_limit')
    .eq('id', true)
    .maybeSingle()
  const shipping_fee = fulfillment === 'delivery' ? Number(settings?.shipping_price ?? 25) : 0

  const orderRows: Array<{
    order_group: string
    product_slug: string
    product_name: string
    size: string
    back_name: string | null
    quantity: number
    unit_price: number
    is_preorder: boolean
    line_total: number
    customer_name: string
    customer_phone: string
    customer_email: string | null
    fulfillment: string
    delivery_address: string | null
    shipping_fee: number
    referral_code: string | null
  }> = []
  const emailLines: TshirtLine[] = []
  let total = 0

  for (const line of lines) {
    const product = bySlug.get(line.product_slug)!
    if (!product.sizes.includes(line.size)) {
      return NextResponse.json({ error: 'bad_size' }, { status: 400 })
    }
    if (product.requires_back_name && !line.back_name) {
      return NextResponse.json({ error: 'missing_back_name' }, { status: 400 })
    }
    const is_preorder = product.preorder_active
    const unit_price = is_preorder ? product.preorder_price : product.regular_price
    const line_total = unit_price * line.quantity
    total += line_total
    const back_name = product.requires_back_name ? line.back_name : null
    orderRows.push({
      order_group: '', // מולא אחרי שנקבע groupKey
      product_slug: product.slug,
      product_name: product.name,
      size: line.size,
      back_name,
      quantity: line.quantity,
      unit_price,
      is_preorder,
      line_total,
      customer_name,
      customer_phone,
      customer_email,
      fulfillment,
      delivery_address,
      shipping_fee,
      referral_code,
    })
    emailLines.push({
      product_name: product.name,
      size: line.size,
      back_name,
      quantity: line.quantity,
      unit_price,
      is_preorder,
      line_total,
    })
  }

  // זכאות לכובע: סכום הפריטים (בלי משלוח) מעל הסף. הכובע ניתן בפועל רק
  // ל-X הראשונים ששילמו — זה נקבע בעמוד הניהול, כאן רק מודיעים ללקוח.
  const itemsTotal = total
  const hatEligible =
    !!settings?.hat_promo_active && itemsTotal >= Number(settings?.hat_promo_min_total ?? 400)
  const hatLimit = Number(settings?.hat_promo_limit ?? 30)
  total += shipping_fee

  const groupKey = `${customer_phone}-${Date.now()}`
  for (const row of orderRows) row.order_group = groupKey

  const { data: inserted, error: insertError } = await supabase
    .from('tshirt_orders')
    .insert(orderRows)
    .select('id')

  if (insertError || !inserted || inserted.length === 0) {
    console.error('tshirt-order insert failed:', insertError?.message)
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
  }

  const orderId = inserted[0].id as string

  // קישור תשלום נפרד לכל סוג מוצר שהוזמן (לא ניתן לאחד לקישור אחד — הסכום
  // משתנה לפי כמות/מידה חופשית, וב-Arbox אין תמיכה בסכום דינמי כרגע).
  const paymentLinks = Array.from(bySlug.values()).map((p) => ({
    slug: p.slug,
    name: p.name,
    link: p.preorder_active ? p.preorder_arbox_link : p.regular_arbox_link,
  }))
  if (fulfillment === 'delivery') {
    paymentLinks.push({
      slug: 'shipping',
      name: `משלוח עד הבית (${shipping_fee} ₪)`,
      link: (settings?.shipping_arbox_link as string | null) ?? null,
    })
  }

  // התראה פנימית לבני — תמיד.
  await sendEmail(
    BENNY_EMAIL,
    undefined,
    `הזמנת חולצה חדשה — ${customer_name}`,
    tshirtOrderHtml(orderId, {
      lines: emailLines,
      customer_name,
      customer_phone,
      total,
      fulfillment,
      delivery_address,
      shipping_fee,
      paymentLinks,
      referral_code,
      hatEligible,
      hatLimit,
      internalNote: 'הזמנה חדשה — יש לתאם תשלום מול הלקוח ולעדכן סטטוס במסך "הזמנות חולצות".',
    })
  )

  // אישור ללקוח — רק אם השאיר אימייל, עם עותק (CC) לבני.
  if (customer_email) {
    await sendEmail(
      customer_email,
      BENNY_EMAIL,
      `אישור הזמנת חולצות #${orderId.slice(0, 8)} — טבע בייק`,
      tshirtOrderHtml(orderId, {
        lines: emailLines, customer_name, customer_phone, total, fulfillment, delivery_address, shipping_fee,
        paymentLinks, referral_code, hatEligible, hatLimit, forCustomer: true,
      })
    )
  }

  return NextResponse.json({ ok: true, id: orderId, total, paymentLinks, hatEligible })
}
