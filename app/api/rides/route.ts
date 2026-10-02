import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { whatsappOptinFields } from '@/lib/whatsapp-optin'
import { sendRegistrationConfirmation } from '@/lib/whatsapp-templates'
import { sendRideConfirmation } from '@/lib/ride-emails'
import {
  SESSIONS, SESSION_SLUGS, sessionBySlug, isPast, priceFor, phoneKey, RENTAL_PRICE, RENTAL_PAY_URL, RIDER_TYPES, PAY_URL,
  monthOf, monthLabel, TRIPS_PER_MONTH,
  LEVEL_VALUES, LEVEL_LABEL, RIDER_TYPE_LABEL, type RiderType, type RideSession,
} from '@/lib/ride-sessions'

// ============================================================
// נתיב: app/api/rides/route.ts
// טיולי רכיבה בארץ — מנוי חודשי ₪200 (שני טיולים, פתוח לכולם), או טיול
// בודד לרוכבי טבע בייק ₪90 (lib/ride-sessions.ts).
// GET  — מצב נוכחי לכל טיול (כמה נרשמו, האם סגורה)
// POST — הרשמה לטיול. המחיר נקבע כאן לפי הטלפון מול טבלת riders.
// ============================================================

export const dynamic = 'force-dynamic'

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

export async function GET() {
  const db = admin()

  const { data: rows, error } = await db
    .from('ride_session_registrations')
    .select('session_slug')
    .in('session_slug', SESSION_SLUGS)
    .neq('status', 'cancelled')

  if (error) {
    console.error('[rides] GET failed:', error)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }

  const sessions = SESSIONS.map((s) => {
    const count = (rows ?? []).filter((r) => r.session_slug === s.slug).length
    return { slug: s.slug, count, closed: count >= s.capacity || isPast(s) }
  })

  return NextResponse.json({ sessions }, { headers: { 'Cache-Control': 'no-store' } })
}

/** True when the phone belongs to a rider (or a rider's parent) in `riders`. */
async function isTevaBikeRider(db: ReturnType<typeof admin>, phone: string): Promise<boolean> {
  const key = phoneKey(phone)
  if (!key) return false

  // Phones are stored in whatever format the coordinator typed them, so match
  // on the last 9 digits rather than the raw string. The table is small
  // (~160 rows) — fetching the two phone columns is cheaper than a fragile
  // SQL normalisation.
  const { data, error } = await db.from('riders').select('phone, parent_phone')
  if (error) {
    console.error('[rides] riders lookup failed:', error)
    return false
  }
  return (data ?? []).some((r) => phoneKey(r.phone) === key || phoneKey(r.parent_phone) === key)
}

async function notifyBenny(session: RideSession, r: {
  first_name: string
  last_name: string
  phone: string
  email: string | null
  level: string
  rider_type: RiderType
  price: number
  included: boolean
  notes: string | null
  wants_rental: boolean
  rental_height_cm: number | null
  count: number
}) {
  const key = process.env.RESEND_API_KEY
  if (!key) return // not configured — skip silently, registration is already saved

  const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
  const rows: [string, string][] = [
    ['טיול', `${session.title} · ${session.dateLabel}`],
    ['שם', `${r.first_name} ${r.last_name}`],
    ['טלפון', r.phone],
    ['אימייל', r.email ?? '—'],
    ['רמה', LEVEL_LABEL[r.level] ?? r.level],
    ['סוג', `${RIDER_TYPE_LABEL[r.rider_type]} · ${r.included ? `כלול במנוי של ${monthLabel(monthOf(session.date))}` : `₪${r.price}`}`],
    ['השכרת אופניים חשמליים', r.wants_rental ? `כן — גובה ${r.rental_height_cm} ס״מ · ₪${RENTAL_PRICE}` : 'לא'],
    ['הערות', r.notes ?? '—'],
    ['נרשמו עד כה', `${r.count} / ${session.capacity}`],
  ]

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Teva Bike <leads@mail.tevabike.com>',
        to: ['bennyfire@gmail.com'],
        subject: `הרשמה לטיול רכיבה — ${r.first_name} ${r.last_name} · ${RIDER_TYPE_LABEL[r.rider_type]} (${r.count}/${session.capacity})`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif">
          <h2 style="margin:0 0 12px">🚵 הרשמה חדשה לטיול רכיבה</h2>
          <table style="border-collapse:collapse;font-size:15px">
            ${rows.map(([k, v]) => `<tr><td style="padding:6px 12px;font-weight:700">${k}</td><td style="padding:6px 12px">${esc(v)}</td></tr>`).join('')}
          </table>
        </div>`,
      }),
    })
  } catch (e) {
    console.error('[rides] notification failed (registration was still saved):', e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const slug = String(body.slug ?? '')
    const first_name = String(body.first_name ?? '').trim().slice(0, 60)
    const last_name = String(body.last_name ?? '').trim().slice(0, 60)
    const phone = String(body.phone ?? '').trim().slice(0, 20)
    const email = String(body.email ?? '').trim().slice(0, 120) || null
    const level = String(body.level ?? '')
    const notes = String(body.notes ?? '').trim().slice(0, 500) || null
    const wants_rental = body.wants_rental === true
    const rental_height_cm = wants_rental ? Math.round(Number(body.rental_height_cm)) : null
    const rider_type: RiderType = RIDER_TYPES.includes(body.rider_type) ? body.rider_type : 'subscriber'
    const consent = body.consent === true

    const session = sessionBySlug(slug)
    if (!session) {
      return NextResponse.json({ error: 'הטיול לא נמצא' }, { status: 404 })
    }
    if (isPast(session)) {
      return NextResponse.json({ error: 'ההרשמה לטיול הזה נסגרה', closed: true }, { status: 409 })
    }
    if (!first_name || !last_name) {
      return NextResponse.json({ error: 'חסרים שם פרטי ושם משפחה' }, { status: 400 })
    }
    if (phone.replace(/\D/g, '').length < 9) {
      return NextResponse.json({ error: 'מספר טלפון לא תקין' }, { status: 400 })
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'כתובת אימייל לא תקינה' }, { status: 400 })
    }
    if (!LEVEL_VALUES.includes(level)) {
      return NextResponse.json({ error: 'יש לבחור רמת רכיבה' }, { status: 400 })
    }
    if (wants_rental && !(rental_height_cm && rental_height_cm >= 100 && rental_height_cm <= 220)) {
      return NextResponse.json({ error: 'לשכירת אופניים צריך גובה בס״מ (100–220)' }, { status: 400 })
    }
    if (!consent) {
      return NextResponse.json({ error: 'יש לאשר את הצהרת הבריאות והאחריות' }, { status: 400 })
    }

    const db = admin()

    // The member price is never taken on trust: it applies only when the phone
    // is one we already know from `riders`.
    if (rider_type === 'member') {
      if (!(await isTevaBikeRider(db, phone))) {
        return NextResponse.json(
          {
            error: 'לא מצאנו את מספר הטלפון ברשימת רוכבי טבע בייק. נסו את המספר שאיתו נרשמתם לחוג (או של ההורה), או הירשמו למנוי החודשי.',
            notMember: true,
          },
          { status: 400 }
        )
      }
    }

    // A subscription covers TRIPS_PER_MONTH trips in the month. If this phone
    // already holds a (non-cancelled) subscription registration for another
    // trip this month, this one is included and costs nothing more — up to
    // the monthly allowance; beyond it they join as a single trip.
    const subscription_month = rider_type === 'subscriber' ? monthOf(session.date) : null
    let included = false
    if (subscription_month) {
      const sameMonth = SESSIONS.filter((s) => monthOf(s.date) === subscription_month).map((s) => s.slug)
      const { data: subs } = await db
        .from('ride_session_registrations')
        .select('phone, session_slug')
        .eq('rider_type', 'subscriber')
        .eq('subscription_month', subscription_month)
        .in('session_slug', sameMonth)
        .neq('status', 'cancelled')
      const key = phoneKey(phone)
      const mine = (subs ?? []).filter((r) => phoneKey(r.phone) === key)
      if (mine.some((r) => r.session_slug === slug)) {
        return NextResponse.json({ error: 'מספר הטלפון הזה כבר רשום לטיול הזה' }, { status: 409 })
      }
      if (mine.length >= TRIPS_PER_MONTH) {
        return NextResponse.json(
          { error: `המנוי כולל ${TRIPS_PER_MONTH} טיולים בחודש וכבר נרשמת לכולם. לטיול נוסף כתבו לנו בוואטסאפ.` },
          { status: 409 }
        )
      }
      included = mine.length > 0
    }
    const price = included ? 0 : priceFor(rider_type)

    const { count: before } = await db
      .from('ride_session_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('session_slug', slug)
      .neq('status', 'cancelled')

    if ((before ?? 0) >= session.capacity) {
      return NextResponse.json({ error: 'כל המקומות בטיול נתפסו', closed: true }, { status: 409 })
    }

    const optin = whatsappOptinFields(body.whatsapp_optin === true, 'ride_sessions')
    const { data: reg, error: insErr } = await db
      .from('ride_session_registrations')
      .insert({
        session_slug: slug, first_name, last_name, phone, email, level,
        rider_type, price_ils: price, subscription_month, notes, consent, ...optin,
        wants_rental, rental_height_cm, rental_price_ils: wants_rental ? RENTAL_PRICE : null,
      })
      .select('id, created_at')
      .single()

    if (insErr || !reg) {
      console.error('[rides] insert failed:', insErr)
      return NextResponse.json({ error: 'לא הצלחנו לשמור. נסו שוב.' }, { status: 500 })
    }

    // Rank by insertion order (not a raw recount) so of two registrations
    // racing for the last spot, exactly one — the earlier one — keeps it.
    const { count: rank } = await db
      .from('ride_session_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('session_slug', slug)
      .neq('status', 'cancelled')
      .lte('created_at', reg.created_at)

    if ((rank ?? 0) > session.capacity) {
      await db.from('ride_session_registrations').delete().eq('id', reg.id)
      return NextResponse.json({ error: 'המקום האחרון נתפס ממש עכשיו', closed: true }, { status: 409 })
    }

    const count = rank ?? 0
    const payUrl = included ? null : PAY_URL[rider_type]

    // Awaited rather than fire-and-forget: on Vercel an un-awaited promise can
    // be cut off once the response is sent. Each of these swallows its own
    // errors, so none of them can fail the registration.
    await Promise.allSettled([
      notifyBenny(session, { first_name, last_name, phone, email, level, rider_type, price, included, notes, wants_rental, rental_height_cm, count }),
      email
        ? sendRideConfirmation(session, { email, first_name, rider_type, price, included, payUrl, wants_rental })
        : Promise.resolve(false),
      // No-op until Meta approves the registration_confirmation template.
      sendRegistrationConfirmation(phone, first_name, `טיול רכיבה ${session.title}`, session.dateLabel),
    ])

    return NextResponse.json({
      ok: true, rider_type, price, included, wants_rental, count,
      month: subscription_month ? monthLabel(subscription_month) : null,
      payUrl,
      rentalPayUrl: wants_rental ? RENTAL_PAY_URL : null,
    })
  } catch (e) {
    console.error('[rides] POST error:', e)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}
