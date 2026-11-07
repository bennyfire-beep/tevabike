import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import { whatsappOptinFields } from '@/lib/whatsapp-optin'
import {
  RENTAL_OPEN, SLOT_BY_ID, isSlot, slotPrice, PROTECTION_PRICE, bookingTotal, paymentLines,
  bikeFits, MAX_BIKES_PER_BOOKING, AGREED_VALUE_DEFAULT, type Bike, type SlotId,
} from '@/lib/rental'
import { CONTRACT_VERSION, CONSENTS, contractText } from '@/lib/rental-contract'

// ============================================================
// נתיב: app/api/rent/route.ts — השכרת אופניים (lib/rental.ts)
// GET  ?date=YYYY-MM-DD — האופניים הפעילים + מה תפוס בתאריך
// POST — הזמנה חדשה עם חוזה חתום (נשמר דרך rental_book, נעילה לכל אופניים+תאריך)
// ============================================================

export const dynamic = 'force-dynamic'

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

// Fields safe to show the public — never frame_number or agreed_value.
const PUBLIC_BIKE = 'id, name, model, size, height_min, height_max, description, photos, active, sort_order'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_DAYS_AHEAD = 180

const todayIL = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })

function validDate(d: string) {
  if (!DATE_RE.test(d)) return false
  const t = Date.parse(d + 'T00:00:00Z')
  if (Number.isNaN(t)) return false
  const today = Date.parse(todayIL() + 'T00:00:00Z')
  return t >= today && t <= today + MAX_DAYS_AHEAD * 86400000
}

/** Israeli ID number check digit. */
function validIsraeliId(raw: string) {
  const id = raw.replace(/\D/g, '')
  if (id.length < 5 || id.length > 9) return false
  const p = id.padStart(9, '0')
  let sum = 0
  for (let i = 0; i < 9; i++) {
    let n = Number(p[i]) * ((i % 2) + 1)
    if (n > 9) n -= 9
    sum += n
  }
  return sum % 10 === 0
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export async function GET(req: NextRequest) {
  const db = admin()
  const date = req.nextUrl.searchParams.get('date') ?? ''

  const { data: bikes, error } = await db
    .from('rental_bikes')
    .select(PUBLIC_BIKE)
    .eq('active', true)
    .order('sort_order')
    .order('name')
  if (error) {
    console.error('[rent] GET bikes failed:', error)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }

  let busy: { bike_id: string; slot: SlotId }[] = []
  if (date && DATE_RE.test(date)) {
    const { data: rows, error: busyErr } = await db
      .from('rental_booking_items')
      .select('bike_id, slot, rental_bookings!inner(status)')
      .eq('rent_date', date)
      .neq('rental_bookings.status', 'cancelled')
    if (busyErr) {
      console.error('[rent] GET busy failed:', busyErr)
      return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
    }
    busy = (rows ?? []).map((r) => ({ bike_id: r.bike_id as string, slot: r.slot as SlotId }))
  }

  return NextResponse.json({ open: RENTAL_OPEN, bikes, busy }, { headers: { 'Cache-Control': 'no-store' } })
}

type ItemIn = { bike_id?: unknown; rider_name?: unknown; rider_height_cm?: unknown; protection?: unknown }

async function sendEmails(p: {
  id: string
  renter_name: string
  renter_phone: string
  renter_email: string
  date: string
  slotLabel: string
  total: number
  text: string
  hash: string
}) {
  const key = process.env.RESEND_API_KEY
  if (!key) return

  const send = (to: string[], subject: string, html: string) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Teva Bike <leads@mail.tevabike.com>', to, subject, html }),
    })

  const contractHtml = `<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;background:#f6f6f6;padding:14px;border-radius:8px">${esc(p.text)}</pre>
    <p style="font-size:11px;color:#888">מזהה הזמנה: ${p.id}<br>טביעת אצבע של המסמך (SHA-256): ${p.hash}</p>`

  try {
    await send(
      ['bennyfire@gmail.com'],
      `🚲 הזמנת השכרה — ${p.renter_name} · ${p.date} · ${p.slotLabel} · ${p.total} ₪`,
      `<div dir="rtl" style="font-family:Arial,sans-serif">
        <h2 style="margin:0 0 12px">הזמנת השכרה חדשה (ממתינה לתשלום)</h2>
        <p>${esc(p.renter_name)} · ${esc(p.renter_phone)} · ${esc(p.renter_email)}</p>
        ${contractHtml}
      </div>`,
    )
  } catch (e) {
    console.error('[rent] staff email failed (booking saved):', e)
  }

  try {
    await send(
      [p.renter_email],
      'טבע בייק · ההזמנה וההסכם החתום שלך',
      `<div dir="rtl" style="font-family:Arial,sans-serif">
        <h2 style="margin:0 0 12px">תודה ${esc(p.renter_name)}!</h2>
        <p>ההזמנה נקלטה ל-${esc(p.date)} · ${esc(p.slotLabel)} · סה״כ ${p.total} ₪.</p>
        <p>ההזמנה תאושר אחרי התשלום. מצורף עותק ההסכם שחתמת עליו:</p>
        ${contractHtml}
      </div>`,
    )
  } catch (e) {
    console.error('[rent] customer email failed (booking saved):', e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // ── Input ──
    const rent_date = String(body.rent_date ?? '')
    const slot = body.slot
    const renter_name = String(body.renter_name ?? '').trim().slice(0, 80)
    const renter_id_number = String(body.renter_id_number ?? '').replace(/\D/g, '').slice(0, 9)
    const renter_phone = String(body.renter_phone ?? '').trim().slice(0, 20)
    const renter_email = String(body.renter_email ?? '').trim().slice(0, 120)
    const signed_name = String(body.signed_name ?? '').trim().slice(0, 80)
    const signature = String(body.signature ?? '')
    const idPhoto = String(body.id_photo ?? '')
    const rawItems: ItemIn[] = Array.isArray(body.items) ? body.items : []
    const consents = (body.consents ?? {}) as Record<string, unknown>

    if (!validDate(rent_date)) return bad('תאריך לא תקין')
    if (!isSlot(slot)) return bad('יש לבחור משך השכרה')
    if (renter_name.length < 2) return bad('חסר שם מלא')
    if (!validIsraeliId(renter_id_number)) return bad('מספר תעודת זהות לא תקין')
    if (renter_phone.replace(/\D/g, '').length < 9) return bad('מספר טלפון לא תקין')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(renter_email)) return bad('כתובת מייל לא תקינה')
    if (body.adult !== true) return bad('יש לאשר שהשוכר בגיר')
    if (rawItems.length < 1 || rawItems.length > MAX_BIKES_PER_BOOKING) return bad('מספר אופניים לא תקין')
    for (const c of CONSENTS) if (consents[c.id] !== true) return bad('יש לסמן את כל האישורים בהסכם')
    if (signed_name.replace(/\s+/g, ' ') !== renter_name.replace(/\s+/g, ' ')) {
      return bad('השם בחתימה חייב להיות זהה לשם השוכר')
    }
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signature) || signature.length > 400_000) {
      return bad('חסרה חתימה')
    }
    // The browser shrinks the ID photo to a JPEG before sending (app/rent);
    // ~3 MB of base64 is far above that and well under Vercel's body limit.
    if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(idPhoto) || idPhoto.length > 3_000_000) {
      return bad('חסר צילום תעודת זהות')
    }

    const items = rawItems.map((i) => ({
      bike_id: String(i.bike_id ?? ''),
      rider_name: String(i.rider_name ?? '').trim().slice(0, 60),
      rider_height_cm: Math.round(Number(i.rider_height_cm)),
      protection: i.protection === true,
    }))
    if (new Set(items.map((i) => i.bike_id)).size !== items.length) return bad('אותם אופניים נבחרו פעמיים')
    for (const i of items) {
      if (!i.rider_name) return bad('חסר שם רוכב')
      if (!(i.rider_height_cm >= 120 && i.rider_height_cm <= 220)) return bad(`גובה לא תקין עבור ${i.rider_name}`)
    }

    const db = admin()

    // ── Bikes: exist, active, fit the rider ──
    const { data: bikeRows, error: bikeErr } = await db
      .from('rental_bikes')
      .select(PUBLIC_BIKE)
      .in('id', items.map((i) => i.bike_id))
    if (bikeErr) throw bikeErr
    const bikeById = new Map((bikeRows as Bike[]).map((b) => [b.id, b]))

    // Replacement value per bike for the contract snapshot (staff-set column,
    // so it is read here rather than sent to the public GET).
    const { data: valueRows, error: valueErr } = await db
      .from('rental_bikes')
      .select('id, agreed_value')
      .in('id', items.map((i) => i.bike_id))
    if (valueErr) throw valueErr
    const valueById = new Map((valueRows ?? []).map((v) => [v.id as string, (v.agreed_value as number | null) ?? AGREED_VALUE_DEFAULT]))
    for (const i of items) {
      const b = bikeById.get(i.bike_id)
      if (!b || !b.active) return bad('אחד האופניים כבר לא זמין. רעננו את הדף ובחרו שוב.', 409)
      if (!bikeFits(b, i.rider_height_cm)) return bad(`${b.name} לא מתאימים לגובה של ${i.rider_name}`)
    }

    // ── Prices are always computed here, never taken from the browser ──
    const priced = items.map((i) => ({
      ...i,
      price: slotPrice(slot) + (i.protection ? PROTECTION_PRICE : 0),
    }))
    const total = bookingTotal(items.map((i) => ({ slot, protection: i.protection })))

    // ── Contract snapshot + hash ──
    const slotLabel = `${SLOT_BY_ID[slot].label} (${SLOT_BY_ID[slot].hours})`
    const text = contractText({
      renter_name, renter_id_number, renter_phone, rent_date, slot_label: slotLabel, total,
      items: priced.map((i) => ({
        rider_name: i.rider_name, bike_name: bikeById.get(i.bike_id)!.name, bike_value: valueById.get(i.bike_id) ?? AGREED_VALUE_DEFAULT,
        protection: i.protection, price: i.price,
      })),
    })
    const signed_at = new Date().toISOString()
    const signer_ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null
    const signer_user_agent = (req.headers.get('user-agent') ?? '').slice(0, 300) || null
    const sigBytes = Buffer.from(signature.split(',')[1], 'base64')
    const idBytes = Buffer.from(idPhoto.split(',')[1], 'base64')
    const idHash = createHash('sha256').update(idBytes).digest('hex')
    const hash = createHash('sha256')
      .update(text)
      .update('\n--\n')
      .update(`${signed_name}|${signed_at}|${signer_ip ?? ''}|${idHash}|`)
      .update(sigBytes)
      .digest('hex')

    // ── ID photo first: no booking may exist without one. The path is random
    // (the booking id doesn't exist yet) and is removed again if booking fails.
    const idPath = `id/${rent_date}/${randomUUID()}.jpg`
    const { error: idUpErr } = await db.storage
      .from('rental-contracts')
      .upload(idPath, idBytes, { contentType: 'image/jpeg', upsert: false })
    if (idUpErr) {
      console.error('[rent] ID photo upload failed:', idUpErr)
      return bad('לא הצלחנו לשמור את צילום תעודת הזהות. נסו שוב.', 500)
    }
    const dropIdPhoto = () => db.storage.from('rental-contracts').remove([idPath])

    const { data: bookingId, error: rpcErr } = await db.rpc('rental_book', {
      p_booking: {
        rent_date, slot, renter_name, renter_id_number, renter_phone, renter_email, total,
        contract_version: CONTRACT_VERSION, contract_text: text, contract_sha256: hash,
        consents: { ...Object.fromEntries(CONSENTS.map((c) => [c.id, true])), adult: true, signed_at },
        signed_name, signer_ip, signer_user_agent,
        ...whatsappOptinFields(body.whatsapp_optin === true, 'rental'),
      },
      p_items: priced,
    })
    if (rpcErr) {
      await dropIdPhoto()
      if (/bike_taken|bike_unavailable/.test(rpcErr.message)) {
        return bad('אחד האופניים נתפס ממש עכשיו. רעננו ובחרו אופניים אחרים.', 409)
      }
      throw rpcErr
    }
    const id = String(bookingId)

    const { error: idRowErr } = await db
      .from('rental_bookings')
      .update({ id_photo_path: idPath, id_photo_sha256: idHash })
      .eq('id', id)
    if (idRowErr) console.error('[rent] could not link ID photo to booking', id, idPath, idRowErr)

    // ── Signature image (private bucket). The hash above already covers it. ──
    const path = `${rent_date}/${id}.png`
    const { error: upErr } = await db.storage
      .from('rental-contracts')
      .upload(path, sigBytes, { contentType: 'image/png', upsert: false })
    if (upErr) console.error('[rent] signature upload failed (booking saved):', upErr)
    else await db.from('rental_bookings').update({ signature_path: path }).eq('id', id)

    await sendEmails({
      id, renter_name, renter_phone, renter_email, date: rent_date, slotLabel, total, text, hash,
    })

    return NextResponse.json({
      ok: true,
      id,
      total,
      lines: paymentLines(items.map((i) => ({ slot, protection: i.protection }))),
    })
  } catch (e) {
    console.error('[rent] POST error:', e)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}
