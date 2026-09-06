// app/api/cron/shop-supplier-followup/route.ts — רץ פעם בשבוע (ראה
// vercel.json). אין webhook/פענוח אוטומטי של מיילי פאן רייד — התשובות שלהם
// מגיעות לתיבה האישית של בני (bennyfire@gmail.com, reply-to על מייל
// ההזמנה). הראוט הזה רק מזכיר: אילו הזמנות כבר נשלחו לפאן רייד ועדיין
// מחכות לעדכון סטטוס/מחיר סופי במסך "הזמנות חנות", כדי שלא יישכחו.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BENNY_EMAIL, sendEmail } from '@/lib/shop-order-email'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  ordered: 'הוזמן',
  shipped: 'נשלח',
  delayed: 'עוכב',
  cancelled: 'בוטל',
}

export async function GET(req: NextRequest) {
  const isCron = req.headers.get('x-vercel-cron') !== null
  const secret = req.nextUrl.searchParams.get('secret')
  if (!isCron && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // כל השורות שכבר נשלחו לפאן רייד — מסננים בקוד (לא ב-SQL) כדי לתפוס גם
  // את מי ש-supplier_status עוד null (טרם נבדק בכלל), לא רק delayed.
  const { data: rows } = await admin
    .from('shop_orders')
    .select('order_group, product_name, color, customer_name, total_amount, final_price, supplier_status, created_at')
    .eq('supplier_notified', true)
    .order('created_at', { ascending: true })
  const openRows = (rows ?? []).filter((r: any) => r.supplier_status !== 'shipped' && r.supplier_status !== 'cancelled')

  const groups = new Map<string, { customer_name: string; items: string[]; total_amount: number | null; final_price: number | null; supplier_status: string | null; created_at: string }>()
  for (const r of openRows as any[]) {
    const key = r.order_group || r.customer_name
    const g = groups.get(key)
    const item = r.product_name + (r.color ? ` — ${r.color}` : '')
    if (g) g.items.push(item)
    else groups.set(key, { customer_name: r.customer_name, items: [item], total_amount: r.total_amount, final_price: r.final_price, supplier_status: r.supplier_status, created_at: r.created_at })
  }

  if (groups.size === 0) {
    return NextResponse.json({ ok: true, open: 0, sent: false })
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })
  const lines = Array.from(groups.values()).map((g) => {
    const status = g.supplier_status ? STATUS_LABELS[g.supplier_status] ?? g.supplier_status : 'טרם נבדק'
    const price = g.final_price ?? g.total_amount ?? '?'
    return `• ${g.customer_name} (${fmtDate(g.created_at)}) — ${g.items.join(' + ')} — ${price} ₪ — סטטוס: ${status}`
  })

  const sent = await sendEmail(
    BENNY_EMAIL,
    undefined,
    `תזכורת שבועית — ${groups.size} הזמנות ממתינות לעדכון מול פאן רייד`,
    `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif;padding:20px">
      <h2 style="margin:0 0 12px">הזמנות שממתינות לעדכון סטטוס</h2>
      <p style="color:#555;font-size:13px;margin:0 0 16px">
        אלה הוזמנו מפאן רייד אבל עדיין לא סומנו כ"נשלח" או "בוטל". תבדוק את התשובות שלהם במייל
        ותעדכן סטטוס/מחיר סופי במסך "הזמנות חנות", כדי שהמערכת תכין הודעת עדכון ללקוח.
      </p>
      <pre style="white-space:pre-wrap;font-family:Heebo,Arial,sans-serif;font-size:13px;background:#f5f5f5;padding:12px;border-radius:8px">${lines.join('\n')}</pre>
    </div>`
  )

  return NextResponse.json({ ok: true, open: groups.size, sent })
}
