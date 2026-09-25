import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/admin-api'
import { hatWinners, type HatPromoRow } from '@/lib/tshirt-hat-promo'

// מצב מבצע הכובע לתצוגה בחנות: פעיל? מאיזה סכום? כמה כובעים נשארו?
// ציבורי — מחזיר רק מספרים, בלי פרטי לקוחות.

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = adminDb()
  if (!db) return NextResponse.json({ active: false })
  const [{ data: s }, { data: rows }] = await Promise.all([
    db.from('tshirt_shop_settings').select('hat_promo_active, hat_promo_min_total, hat_promo_limit').eq('id', true).maybeSingle(),
    db.from('tshirt_orders').select('order_group, line_total, payment_status, cancelled_at, paid_at, created_at'),
  ])
  const settings = {
    active: !!s?.hat_promo_active,
    minTotal: Number(s?.hat_promo_min_total ?? 400),
    limit: Number(s?.hat_promo_limit ?? 30),
  }
  const claimed = hatWinners((rows ?? []) as HatPromoRow[], settings).length
  const remaining = Math.max(settings.limit - claimed, 0)
  return NextResponse.json({ ...settings, active: settings.active && remaining > 0, claimed, remaining })
}
