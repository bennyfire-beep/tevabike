import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { whatsappOptinFields } from '@/lib/whatsapp-optin'
import { RIDE_SEATS, TRANSPORT, type Transport } from '@/lib/sovev-ramon'

// ============================================================
// נתיב: app/api/sovev-ramon/route.ts
// סובב מצפה רמון 27.10 — הרכב מוגבל ל-RIDE_SEATS רוכבים, הגעה עצמאית ללא הגבלה.
// GET  — כמה מקומות נתפסו ברכב
// POST — הרשמה (שם, טלפון, אופן הגעה); מחזיר את קישור התשלום המתאים
// ============================================================

export const dynamic = 'force-dynamic'

const TABLE = 'sovev_ramon_registrations'

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

async function rideTaken(db: ReturnType<typeof admin>) {
  const { count, error } = await db
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('transport', 'ride')
    .neq('status', 'cancelled')
  // a missing table answers a HEAD count with no error and a null count — treat that as a failure, not "0 taken"
  if (error || count === null) throw error ?? new Error('seat count unavailable')
  return count
}

export async function GET() {
  try {
    const taken = await rideTaken(admin())
    return NextResponse.json(
      { seats: RIDE_SEATS, taken, full: taken >= RIDE_SEATS },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    console.error('[sovev-ramon] GET failed:', e)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}

async function notifyBenny(r: { first_name: string; last_name: string; phone: string; transport: Transport; taken: number | null }) {
  const key = process.env.RESEND_API_KEY
  if (!key) return // not configured — skip silently, registration is already saved

  const how = TRANSPORT[r.transport].label + (r.taken != null ? ` (${r.taken}/${RIDE_SEATS} ברכב)` : '')
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Teva Bike <leads@mail.tevabike.com>',
        to: ['bennyfire@gmail.com'],
        subject: `סובב מצפה רמון — ${r.first_name} ${r.last_name} · ${how}`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif">
          <h2 style="margin:0 0 12px">🚲 הרשמה חדשה: סובב מצפה רמון</h2>
          <table style="border-collapse:collapse;font-size:15px">
            <tr><td style="padding:6px 12px;font-weight:700">שם</td><td style="padding:6px 12px">${r.first_name} ${r.last_name}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700">טלפון</td><td style="padding:6px 12px">${r.phone}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700">הגעה</td><td style="padding:6px 12px">${how}</td></tr>
          </table>
        </div>`,
      }),
    })
  } catch (e) {
    console.error('[sovev-ramon] notification failed (registration was still saved):', e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const first_name = String(body.first_name ?? '').trim().slice(0, 60)
    const last_name = String(body.last_name ?? '').trim().slice(0, 60)
    const phone = String(body.phone ?? '').trim().slice(0, 20)
    const transport = body.transport as Transport
    const consent = body.consent === true

    if (!first_name || !last_name) {
      return NextResponse.json({ error: 'חסרים שם פרטי ושם משפחה' }, { status: 400 })
    }
    if (!phone || phone.replace(/\D/g, '').length < 9) {
      return NextResponse.json({ error: 'מספר טלפון לא תקין' }, { status: 400 })
    }
    if (transport !== 'ride' && transport !== 'self') {
      return NextResponse.json({ error: 'יש לבחור איך מגיעים' }, { status: 400 })
    }
    if (!consent) {
      return NextResponse.json({ error: 'יש לאשר את תנאי הביטול והאחריות' }, { status: 400 })
    }

    const db = admin()

    // Refuse up front if the car is visibly full — the rank check below is
    // what actually protects against two people racing for the last seat.
    if (transport === 'ride' && (await rideTaken(db)) >= RIDE_SEATS) {
      return NextResponse.json({ error: 'המקומות ברכב נתפסו. אפשר עדיין להירשם בהגעה עצמאית.', full: true }, { status: 409 })
    }

    const optin = whatsappOptinFields(body.whatsapp_optin === true, 'sovev_ramon')
    const { data: reg, error: insErr } = await db
      .from(TABLE)
      .insert({ first_name, last_name, phone, transport, consent, ...optin })
      .select('id, created_at')
      .single()

    if (insErr || !reg) {
      console.error('[sovev-ramon] insert failed:', insErr)
      return NextResponse.json({ error: 'לא הצלחנו לשמור. נסו שוב.' }, { status: 500 })
    }

    let taken: number | null = null
    if (transport === 'ride') {
      // Rank by insertion order, so of two sign-ups racing for the last seat
      // exactly one (the earlier created_at) keeps it.
      const { count: rank } = await db
        .from(TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('transport', 'ride')
        .neq('status', 'cancelled')
        .lte('created_at', reg.created_at)
      if ((rank ?? 0) > RIDE_SEATS) {
        await db.from(TABLE).delete().eq('id', reg.id)
        return NextResponse.json(
          { error: 'המקום האחרון ברכב נתפס ממש עכשיו. אפשר עדיין להירשם בהגעה עצמאית.', full: true },
          { status: 409 }
        )
      }
      taken = rank ?? null
    }

    void notifyBenny({ first_name, last_name, phone, transport, taken })

    return NextResponse.json({ ok: true, payUrl: TRANSPORT[transport].payUrl })
  } catch (e) {
    console.error('[sovev-ramon] POST error:', e)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}
