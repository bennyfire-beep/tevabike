import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BENNY_EMAIL, sendEmail } from '@/lib/shop-order-email'
import { SETTLEMENT, SLOT_BY_ID, type SlotId } from '@/lib/rental'
import { CHECKLIST, CHECKLIST_IDS } from '@/lib/rental-checklist'

// ============================================================
// נתיב: app/api/rent/checklist/route.ts — בדיקת אופניים לפני יציאה
// GET  ?b=<booking id>  — פרטי ההזמנה והאופניים, עם סטטוס הבדיקה
// POST { b, item_id, answers, note } — שמירת בדיקה לאופניים אחד.
// מזהה ההזמנה (UUID אקראי) הוא המפתח: מי שקיבל את הקישור במייל.
// "לא" בסעיף כלשהו → התראה במייל לבני (ולטימו כשהמייל שלו מוגדר).
// ============================================================

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

type ItemRow = {
  id: string
  rider_name: string
  checklist: Record<string, unknown> | null
  checklist_ok: boolean | null
  checklist_at: string | null
  rental_bikes: { name: string } | null
}

async function loadBooking(b: string) {
  const { data, error } = await admin()
    .from('rental_bookings')
    .select('id, rent_date, slot, status, renter_name, renter_phone, rental_booking_items(id, rider_name, checklist, checklist_ok, checklist_at, rental_bikes(name))')
    .eq('id', b)
    .maybeSingle()
  if (error) throw error
  return data as null | {
    id: string; rent_date: string; slot: SlotId; status: string; renter_name: string; renter_phone: string
    rental_booking_items: ItemRow[]
  }
}

export async function GET(req: NextRequest) {
  const b = req.nextUrl.searchParams.get('b') ?? ''
  if (!UUID_RE.test(b)) return NextResponse.json({ error: 'קישור לא תקין' }, { status: 400 })
  try {
    const bk = await loadBooking(b)
    if (!bk || bk.status === 'cancelled') return NextResponse.json({ error: 'ההזמנה לא נמצאה' }, { status: 404 })
    return NextResponse.json(
      {
        rent_date: bk.rent_date,
        slot: SLOT_BY_ID[bk.slot]?.label ?? bk.slot,
        first_name: bk.renter_name.split(' ')[0],
        items: bk.rental_booking_items.map((i) => ({
          id: i.id, rider_name: i.rider_name, bike_name: i.rental_bikes?.name ?? '',
          checklist: i.checklist, checklist_ok: i.checklist_ok, checklist_at: i.checklist_at,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    console.error('[rent/checklist] GET error:', e)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const b = String(body.b ?? '')
    const itemId = String(body.item_id ?? '')
    const answers = (body.answers ?? {}) as Record<string, unknown>
    const note = String(body.note ?? '').trim().slice(0, 500)
    if (!UUID_RE.test(b) || !UUID_RE.test(itemId)) return NextResponse.json({ error: 'קישור לא תקין' }, { status: 400 })
    for (const id of CHECKLIST_IDS) {
      if (typeof answers[id] !== 'boolean') return NextResponse.json({ error: 'יש לענות על כל הסעיפים' }, { status: 400 })
    }
    const ok = CHECKLIST_IDS.every((id) => answers[id] === true)
    if (!ok && note.length < 3) return NextResponse.json({ error: 'יש לפרט מה לא תקין' }, { status: 400 })

    const bk = await loadBooking(b)
    if (!bk || bk.status === 'cancelled') return NextResponse.json({ error: 'ההזמנה לא נמצאה' }, { status: 404 })
    const item = bk.rental_booking_items.find((i) => i.id === itemId)
    if (!item) return NextResponse.json({ error: 'האופניים לא שייכים להזמנה' }, { status: 404 })

    const checklist = { ...Object.fromEntries(CHECKLIST_IDS.map((id) => [id, answers[id] === true])), ...(note ? { note } : {}) }
    const checklist_at = new Date().toISOString()
    const { error } = await admin()
      .from('rental_booking_items')
      .update({ checklist, checklist_ok: ok, checklist_at })
      .eq('id', itemId)
      .eq('booking_id', b)
    if (error) throw error

    if (!ok) {
      const bike = item.rental_bikes?.name ?? 'אופניים'
      const failed = CHECKLIST.filter((c) => answers[c.id] !== true).map((c) => `<li>${esc(c.label)}</li>`).join('')
      const html = `<div dir="rtl" style="font-family:Arial,sans-serif">
        <h2 style="margin:0 0 8px">⚠️ בדיקת אופניים לפני יציאה – יש ליקוי</h2>
        <p><b>${esc(bike)}</b> · רוכב: ${esc(item.rider_name)} · שוכר: ${esc(bk.renter_name)} ${esc(bk.renter_phone)}<br>
        ${esc(bk.rent_date)} · ${esc(SLOT_BY_ID[bk.slot]?.label ?? bk.slot)}</p>
        <p>סעיפים שסומנו "לא תקין":</p><ul>${failed}</ul>
        <p>פירוט מהרוכב: ${esc(note)}</p>
        <p>הרוכב הופנה לחנות טימו פאן לתיקון לפני היציאה.</p>
      </div>`
      const timo = SETTLEMENT.timoEmail
      await sendEmail(timo ?? BENNY_EMAIL, timo ? BENNY_EMAIL : undefined, `⚠️ ליקוי באופניים ${bike} – ${bk.rent_date}`, html)
    }

    return NextResponse.json({ ok: true, checklist_ok: ok, checklist_at })
  } catch (e) {
    console.error('[rent/checklist] POST error:', e)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}
