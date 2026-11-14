import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BENNY_EMAIL, sendEmail } from '@/lib/shop-order-email'
import { SETTLEMENT, SETTLED_STATUSES, SLOT_BY_ID, PROTECTION_PRICE, type SlotId } from '@/lib/rental'

// רץ ב-1 לכל חודש דרך Vercel Cron (vercel.json) ושולח לטימו פאן (עם העתק לבני)
// דוח התחשבנות על ההשכרות של החודש שעבר: עמלת Arbox יורדת קודם, היתרה
// מתחלקת חצי-חצי כולל מע"מ, וטימו מוציא חשבונית מס על החלק שלו.
//
// ידני: ?month=2026-11 לחודש מסוים, ?dry=1 מחזיר את ה-HTML בלי לשלוח.
// Authorization: Bearer CRON_SECRET (Vercel Cron שולח אותו אוטומטית).

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type Row = {
  rent_date: string
  slot: SlotId
  renter_name: string
  total: number
  status: string
  rental_booking_items: { protection: boolean; rental_bikes: { name: string } | null }[]
}

const ils = (n: number) => `${n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₪`
const round2 = (n: number) => Math.round(n * 100) / 100
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Previous calendar month in Israel time, as YYYY-MM. */
function lastMonth() {
  const [y, m] = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }).split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const month = req.nextUrl.searchParams.get('month') ?? lastMonth()
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ ok: false, error: 'bad_month' }, { status: 400 })
  const dry = req.nextUrl.searchParams.get('dry') === '1'

  const [y, m] = month.split('-').map(Number)
  const from = `${month}-01`
  const to = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const { data, error } = await db
    .from('rental_bookings')
    .select('rent_date, slot, renter_name, total, status, rental_booking_items(protection, rental_bikes(name))')
    .in('status', [...SETTLED_STATUSES])
    .gte('rent_date', from)
    .lt('rent_date', to)
    .order('rent_date')
  if (error) {
    console.error('[rental-monthly-report] select failed:', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  const rows = (data ?? []) as unknown as Row[]

  const gross = rows.reduce((s, r) => s + Number(r.total), 0)
  const protectedBikes = rows.reduce((s, r) => s + r.rental_booking_items.filter((i) => i.protection).length, 0)
  const protectionGross = protectedBikes * PROTECTION_PRICE
  const bikeCount = rows.reduce((s, r) => s + r.rental_booking_items.length, 0)
  const fee = round2(gross * SETTLEMENT.arboxFeePct)
  const splitGross = SETTLEMENT.protectionInSplit ? gross : gross - protectionGross
  const splitBase = round2(splitGross * (1 - SETTLEMENT.arboxFeePct))
  const timo = round2(splitBase * SETTLEMENT.timoShare)
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })

  const tableRows = rows
    .map((r) => {
      const bikes = r.rental_booking_items.map((i) => (i.rental_bikes?.name ?? '?') + (i.protection ? ' 🛡️' : '')).join(', ')
      return `<tr><td>${r.rent_date.split('-').reverse().join('/')}</td><td>${esc(SLOT_BY_ID[r.slot]?.label ?? r.slot)}</td><td>${esc(r.renter_name)}</td><td>${esc(bikes)}</td><td style="text-align:left">${ils(Number(r.total))}</td></tr>`
    })
    .join('')

  const td = 'padding:6px 8px;border-bottom:1px solid #eee'
  const html = `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif;padding:20px;max-width:720px">
  <h2 style="margin:0 0 4px">התחשבנות השכרות אופניים – ${monthLabel}</h2>
  <p style="color:#555;font-size:13px;margin:0 0 16px">טבע בייק × טימו פאן · ${rows.length} הזמנות · ${bikeCount} אופניים</p>
  ${
    rows.length
      ? `<table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr style="background:#f5f5f5">
      <th style="${td};text-align:right">תאריך</th><th style="${td};text-align:right">משך</th><th style="${td};text-align:right">שוכר</th><th style="${td};text-align:right">אופניים</th><th style="${td};text-align:left">סכום</th>
    </tr></thead><tbody>${tableRows.replaceAll('<td', `<td style="${td}"`)}</tbody></table>`
      : '<p>לא היו השכרות בחודש הזה.</p>'
  }
  <table style="border-collapse:collapse;margin-top:20px;font-size:14px;min-width:340px">
    <tr><td style="${td}">סה״כ שולם על ידי לקוחות (כולל מע״מ)</td><td style="${td};text-align:left">${ils(gross)}</td></tr>
    ${SETTLEMENT.protectionInSplit ? '' : `<tr><td style="${td}">פחות מסלולי הגנה (${protectedBikes} × ${PROTECTION_PRICE} ₪, לא בחלוקה)</td><td style="${td};text-align:left">−${ils(protectionGross)}</td></tr>`}
    <tr><td style="${td}">פחות עמלת סליקה Arbox (${(SETTLEMENT.arboxFeePct * 100).toLocaleString('he-IL')}%)</td><td style="${td};text-align:left">−${ils(round2(splitGross * SETTLEMENT.arboxFeePct))}</td></tr>
    <tr><td style="${td}"><b>סכום לחלוקה</b></td><td style="${td};text-align:left"><b>${ils(splitBase)}</b></td></tr>
    <tr style="background:#eef7e0"><td style="${td}"><b>החלק של טימו פאן (${SETTLEMENT.timoShare * 100}%, כולל מע״מ)</b></td><td style="${td};text-align:left"><b>${ils(timo)}</b></td></tr>
  </table>
  <p style="font-size:13px;margin-top:16px">טימו – אנא הוצא חשבונית מס לטבע בייק על <b>${ils(timo)}</b> (כולל מע״מ), והתשלום יועבר לאחר קבלתה.</p>
  <p style="color:#888;font-size:11px">נספרות הזמנות בסטטוס שולם / נמסר / הוחזר, לפי תאריך ההשכרה.</p>
</div>`

  if (dry) return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })

  const to_ = SETTLEMENT.timoEmail ?? BENNY_EMAIL
  const cc = SETTLEMENT.timoEmail ? BENNY_EMAIL : undefined
  const sent = await sendEmail(to_, cc, `התחשבנות השכרות – ${monthLabel} – ${ils(timo)} לטימו פאן`, html)

  return NextResponse.json({ ok: true, month, bookings: rows.length, gross, fee, timo, to: SETTLEMENT.timoEmail ? 'timo+benny' : 'benny', sent })
}
