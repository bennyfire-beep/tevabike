// lib/shop-order-email.ts — בונה ושולח את מייל ההזמנה לפאן רייד. שותף בין
// app/api/shop-order/route.ts (ההתראה הפנימית לבני, לא הספק) ובין
// app/api/shop-order/notify-supplier/route.ts (השליחה בפועל לפאן רייד,
// אחרי שבני מוודא ידנית שהתשלום עבר בארבוקס — אין webhook שמאשר תשלום).
export const FROM = 'טבע בייק <info@mail.tevabike.com>'
export const REPLY_TO = 'bennyfire@gmail.com'

export const SUPPLIER_EMAIL = 'orderfunride@gmail.com'
export const BENNY_EMAIL = 'bennyfire@gmail.com'

export const ESTIMATED_DELIVERY = 'כ-7-10 ימי עסקים (יתכנו שינויים בשל עומסים שאינם תלויים בנו)'
export const RETURNS_PHONE = '0509446696'
export const SUPPORT_HOURS =
  "מענה טלפוני להחלפות/החזרות ולבירורי משלוח: ימים א'–ה' 08:00–16:00. בימי שישי ושבת אין מענה."

export type Item = { product_slug: string; product_name: string; variant: string }

export async function sendEmail(to: string, cc: string | undefined, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, cc, reply_to: REPLY_TO, subject, html }),
    })
    return res.ok
  } catch {
    return false
  }
}

export function orderHtml(orderId: string, p: {
  items: Item[]; customer_name: string; customer_phone: string;
  fulfillment: string; delivery_address: string | null;
  subtotal: number; shipping: number; total: number;
  /** כשמוגדר, מוצג באנר עליון — משמש להתראה הפנימית לבני לפני שנשלח לספק. */
  internalNote?: string;
}) {
  const fulfillmentLabel = p.fulfillment === 'delivery' ? 'משלוח ללקוח' : 'איסוף מטבע בייק'
  const itemsHtml = p.items
    .map(
      (it) =>
        `<p style="margin:0 0 6px"><b style="color:#D4288A">${it.product_name}</b> — ${it.variant}</p>`
    )
    .join('')
  const noteHtml = p.internalNote
    ? `<div style="background:#3a1a1a;border:1px solid #5a2a2a;border-radius:10px;padding:10px 14px;margin-bottom:16px;color:#ff8f6b;font-size:13px;font-weight:700">${p.internalNote}</div>`
    : ''
  return `
  <div dir="rtl" style="font-family:Heebo,Arial,sans-serif;background:#0C1814;color:#F5F2EE;padding:32px 24px;border-radius:16px;max-width:520px;margin:0 auto">
    ${noteHtml}
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
