// app/api/shop-order/notify-supplier/route.ts — שליחה ידנית של הזמנה
// לפאן רייד, מ-/admin/coordinator/shop-orders. נקרא רק אחרי שבני מוודא
// בעצמו שהתשלום עבר בארבוקס (אין webhook שמאשר את זה אוטומטית).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BENNY_EMAIL, SUPPLIER_EMAIL, orderHtml, sendEmail } from '@/lib/shop-order-email'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  // ── מוודא שהקורא הוא רכז/אדמין מחובר, כמו app/api/admin/add-staff ──
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const { data: caller, error: callerErr } = await admin.auth.getUser(token)
  if (callerErr || !caller?.user) {
    return NextResponse.json({ error: 'ההזדהות נכשלה, התחבר מחדש' }, { status: 401 })
  }
  const { data: callerRoles } = await admin.from('admin_roles').select('role').eq('user_id', caller.user.id)
  const roles = (callerRoles ?? []).map((r) => r.role)
  if (!roles.some((r) => r === 'coordinator' || r === 'admin')) {
    return NextResponse.json({ error: 'אין לך הרשאה' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  const order_group = typeof body.order_group === 'string' ? body.order_group.trim() : ''
  if (!order_group) return NextResponse.json({ error: 'missing_order_group' }, { status: 400 })

  const { data: rows, error } = await admin
    .from('shop_orders')
    .select('id, product_name, color, customer_name, customer_phone, fulfillment, delivery_address, shipping_amount, total_amount')
    .eq('order_group', order_group)

  if (error || !rows || rows.length === 0) {
    return NextResponse.json({ error: 'order_not_found' }, { status: 404 })
  }

  const first = rows[0] as any
  const shipping = Number(first.shipping_amount) || 0
  const total = Number(first.total_amount) || 0
  const items = rows.map((r: any) => ({ product_slug: '', product_name: r.product_name, variant: r.color || '—' }))

  const sent = await sendEmail(
    SUPPLIER_EMAIL,
    BENNY_EMAIL,
    `הזמנה חדשה מטבע בייק — ${items.map((i) => i.product_name).join(' + ')}`,
    orderHtml(rows[0].id, {
      items,
      customer_name: first.customer_name,
      customer_phone: first.customer_phone,
      fulfillment: first.fulfillment,
      delivery_address: first.delivery_address,
      subtotal: total - shipping,
      shipping,
      total,
    })
  )

  if (!sent) {
    return NextResponse.json({ error: 'send_failed' }, { status: 502 })
  }

  const ids = rows.map((r: any) => r.id)
  await admin.from('shop_orders').update({ supplier_notified: true }).in('id', ids)

  return NextResponse.json({ ok: true })
}
