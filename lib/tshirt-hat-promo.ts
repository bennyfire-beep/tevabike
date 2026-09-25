// lib/tshirt-hat-promo.ts — מבצע הכובע: X ההזמנות הראשונות ששולמו, שסכום
// הפריטים בהן (בלי משלוח) לפחות minTotal, מקבלות כובע אחד להזמנה.
// "ראשונות" לפי paid_at (מתי סומנו כשולמו), ואם חסר — לפי זמן ההזמנה.
// פונקציה טהורה, משותפת לעמוד הניהול ולראוט הציבורי שמחזיר כמה נשארו.

export type HatPromoSettings = { active: boolean; minTotal: number; limit: number }

export type HatPromoRow = {
  order_group: string
  line_total: number | string
  payment_status: string
  cancelled_at: string | null
  paid_at: string | null
  created_at: string
}

// מחזיר את מזהי ההזמנות הזוכות, לפי הסדר (אינדקס 0 = כובע מס' 1)
export function hatWinners(rows: HatPromoRow[], s: HatPromoSettings): string[] {
  if (!s.active) return []
  const groups = new Map<string, { subtotal: number; paid: boolean; cancelled: boolean; at: string }>()
  for (const r of rows) {
    const g = groups.get(r.order_group) ?? { subtotal: 0, paid: true, cancelled: false, at: r.paid_at ?? r.created_at }
    g.subtotal += Number(r.line_total) || 0
    if (r.payment_status !== 'confirmed') g.paid = false
    if (r.cancelled_at) g.cancelled = true
    const at = r.paid_at ?? r.created_at
    if (at < g.at) g.at = at
    groups.set(r.order_group, g)
  }
  return [...groups.entries()]
    .filter(([, g]) => g.paid && !g.cancelled && g.subtotal >= s.minTotal)
    .sort((a, b) => a[1].at.localeCompare(b[1].at))
    .slice(0, s.limit)
    .map(([key]) => key)
}
