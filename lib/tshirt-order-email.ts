// lib/tshirt-order-email.ts — emails for the /shop t-shirt pre-order section.
// Two emails per order (mirrors the ask in the spec, unlike shop-order-email.ts
// which only notifies Benny): an internal notification to Benny so he knows to
// coordinate payment/printing, and — only if the customer left an email — a
// confirmation to the customer with Benny CC'd. No supplier email exists here;
// shirts are printed in one batch and picked up at the club, not dropshipped.
import { FROM, REPLY_TO, BENNY_EMAIL, sendEmail } from './shop-order-email'

export { sendEmail, BENNY_EMAIL, FROM, REPLY_TO }

export type TshirtLine = {
  product_name: string
  size: string
  back_name: string | null
  quantity: number
  unit_price: number
  is_preorder: boolean
  line_total: number
}

function linesHtml(lines: TshirtLine[]) {
  return lines
    .map((l) => {
      const nameSuffix = l.back_name ? ` — שם על הגב: "${l.back_name}"` : ''
      const preorderTag = l.is_preorder
        ? ' <span style="color:#7ee787">(מחיר הזמנה מוקדמת)</span>'
        : ''
      return `<p style="margin:0 0 6px"><b style="color:#D4288A">${l.product_name}</b> — מידה ${l.size} × ${l.quantity}${nameSuffix}${preorderTag} — ${l.line_total} ₪</p>`
    })
    .join('')
}

export function tshirtOrderHtml(orderId: string, p: {
  lines: TshirtLine[]
  customer_name: string
  customer_phone: string
  total: number
  /** כשמוגדר, מוצג באנר עליון — משמש להתראה הפנימית לבני. */
  internalNote?: string
  /** true כשזה המייל שיוצא ללקוח (מנוסח בגוף שני, בלי הערות פנימיות). */
  forCustomer?: boolean
}) {
  const noteHtml = p.internalNote
    ? `<div style="background:#3a1a1a;border:1px solid #5a2a2a;border-radius:10px;padding:10px 14px;margin-bottom:16px;color:#ff8f6b;font-size:13px;font-weight:700">${p.internalNote}</div>`
    : ''
  const title = p.forCustomer ? 'תודה על ההזמנה — חולצות טבע בייק' : 'הזמנת חולצה חדשה מטבע בייק'
  const pickupLine = p.forCustomer
    ? `<p style="margin:0"><b style="color:#D4288A">איסוף:</b> עצמאי מהמועדון — ניצור איתך קשר לתיאום כשהחולצות יגיעו.</p>`
    : `<p style="margin:0"><b style="color:#D4288A">איסוף:</b> עצמי מהמועדון — יש לתאם עם הלקוח.</p>`
  return `
  <div dir="rtl" style="font-family:Heebo,Arial,sans-serif;background:#0C1814;color:#F5F2EE;padding:32px 24px;border-radius:16px;max-width:520px;margin:0 auto">
    ${noteHtml}
    <h1 style="color:#D4288A;font-size:22px;margin:0 0 4px">${title}</h1>
    <p style="color:#7E948A;font-size:13px;margin:0 0 20px">מס' הזמנה: ${orderId.slice(0, 8)}</p>
    <div style="background:#152A1E;border:1px solid #1F3D2A;border-radius:12px;padding:16px 18px">
      ${linesHtml(p.lines)}
      <p style="margin:12px 0 8px"><b style="color:#D4288A">לקוח:</b> ${p.customer_name} · ${p.customer_phone}</p>
      <p style="margin:0 0 8px"><b style="color:#D4288A">סה"כ לתשלום:</b> ${p.total} ₪</p>
      ${pickupLine}
    </div>
    <p style="font-size:12px;color:#7E948A;margin-top:20px">טבע בייק · tevabike.com</p>
  </div>`
}
