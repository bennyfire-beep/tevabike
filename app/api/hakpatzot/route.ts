import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { whatsappOptinFields } from '@/lib/whatsapp-optin'
import { CAPACITY, DATE_VALUES, DATE_LABEL, GROUP_LABEL, AREA_LABEL } from '@/lib/hakpatzot'

// ============================================================
// נתיב: app/api/hakpatzot/route.ts
// ימי הקפצות — כל תאריך מוגבל ל-CAPACITY רוכבים (lib/hakpatzot.ts).
// GET  — מצב נוכחי לכל תאריך (כמה נרשמו, האם סגור, מי כבר נרשם)
// POST — הרשמה חדשה לתאריך אחד או יותר
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
    .from('hakpatzot_registrations')
    .select('first_name, last_name, group_type, area, event_date')
    .in('event_date', DATE_VALUES)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[hakpatzot] GET failed:', error)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }

  const dates = DATE_VALUES.map((date) => {
    const mine = (rows ?? []).filter((r) => r.event_date === date)
    return {
      date,
      count: mine.length,
      closed: mine.length >= CAPACITY,
      roster: mine.map((r) => ({
        first_name: r.first_name,
        last_initial: (r.last_name || '').trim().charAt(0),
        group_type: r.group_type,
        area: r.area,
      })),
    }
  })

  return NextResponse.json({ capacity: CAPACITY, dates }, { headers: { 'Cache-Control': 'no-store' } })
}

async function notifyBenny(r: {
  first_name: string
  last_name: string
  phone: string
  group_type: string
  area: string
  counts: { date: string; count: number }[]
}) {
  const key = process.env.RESEND_API_KEY
  if (!key) return // not configured — skip silently, registration is already saved

  const datesText = r.counts.map((c) => `${DATE_LABEL[c.date]} (${c.count}/${CAPACITY})`).join(' · ')

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Teva Bike <leads@mail.tevabike.com>',
        to: ['bennyfire@gmail.com', 'talmatoki@gmail.com'],
        subject: `הרשמה להקפצות — ${r.first_name} ${r.last_name} · ${datesText}`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif">
          <h2 style="margin:0 0 12px">🚐 הרשמה חדשה להקפצות</h2>
          <table style="border-collapse:collapse;font-size:15px">
            <tr><td style="padding:6px 12px;font-weight:700">שם</td><td style="padding:6px 12px">${r.first_name} ${r.last_name}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700">טלפון</td><td style="padding:6px 12px">${r.phone}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700">קבוצה</td><td style="padding:6px 12px">${GROUP_LABEL[r.group_type] ?? r.group_type}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700">אזור</td><td style="padding:6px 12px">${AREA_LABEL[r.area] ?? r.area}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700">תאריכים (נרשמו עד כה)</td><td style="padding:6px 12px">${datesText}</td></tr>
          </table>
        </div>`,
      }),
    })
  } catch (e) {
    console.error('[hakpatzot] notification failed (registration was still saved):', e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const first_name = String(body.first_name ?? '').trim().slice(0, 60)
    const last_name = String(body.last_name ?? '').trim().slice(0, 60)
    const phone = String(body.phone ?? '').trim().slice(0, 20)
    const group_type = String(body.group_type ?? '')
    const area = String(body.area ?? '')
    const consent = body.consent === true
    const dates = Array.isArray(body.dates)
      ? DATE_VALUES.filter((d) => body.dates.includes(d))
      : []

    if (!first_name || !last_name) {
      return NextResponse.json({ error: 'חסרים שם פרטי ושם משפחה' }, { status: 400 })
    }
    if (!phone || phone.replace(/\D/g, '').length < 9) {
      return NextResponse.json({ error: 'מספר טלפון לא תקין' }, { status: 400 })
    }
    if (dates.length === 0) {
      return NextResponse.json({ error: 'יש לבחור תאריך' }, { status: 400 })
    }
    if (!['mini', 'full'].includes(group_type)) {
      return NextResponse.json({ error: 'יש לבחור קבוצה' }, { status: 400 })
    }
    if (!['misgav', 'mata_asher', 'biriya'].includes(area)) {
      return NextResponse.json({ error: 'יש לבחור אזור' }, { status: 400 })
    }
    if (!consent) {
      return NextResponse.json({ error: 'יש לאשר את סעיף האחריות והסיכונים' }, { status: 400 })
    }

    const db = admin()

    // Refuse up front if any chosen date is already visibly full — the rank
    // check below is what actually protects against a last-slot race.
    for (const date of dates) {
      const { count: before } = await db
        .from('hakpatzot_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('event_date', date)
        .neq('status', 'cancelled')

      if ((before ?? 0) >= CAPACITY) {
        return NextResponse.json(
          { error: `המקומות ל${DATE_LABEL[date]} נתפסו. בחרו תאריך אחר.`, closed: true },
          { status: 409 }
        )
      }
    }

    const optin = whatsappOptinFields(body.whatsapp_optin === true, 'hakpatzot')
    const { data: regs, error: insErr } = await db
      .from('hakpatzot_registrations')
      .insert(dates.map((event_date) => ({ first_name, last_name, phone, group_type, area, consent, event_date, ...optin })))
      .select('id, created_at, event_date')

    if (insErr || !regs || regs.length !== dates.length) {
      console.error('[hakpatzot] insert failed:', insErr)
      return NextResponse.json({ error: 'לא הצלחנו לשמור. נסו שוב.' }, { status: 500 })
    }

    // Rank by insertion order within the date (not a raw recount) so that of
    // two registrations racing for the last spot, exactly one — the earlier
    // created_at — keeps it; the other is rolled back here.
    const ranks: { id: string; date: string; count: number }[] = []
    for (const reg of regs) {
      const { count: rank } = await db
        .from('hakpatzot_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('event_date', reg.event_date)
        .neq('status', 'cancelled')
        .lte('created_at', reg.created_at)
      ranks.push({ id: reg.id, date: reg.event_date, count: rank ?? 0 })
    }

    const lost = ranks.filter((r) => r.count > CAPACITY)
    if (lost.length > 0) {
      // All-or-nothing: someone who asked for both dates shouldn't silently
      // end up with only one.
      await db.from('hakpatzot_registrations').delete().in('id', regs.map((r) => r.id))
      return NextResponse.json(
        { error: `המקום האחרון ל${DATE_LABEL[lost[0].date]} נתפס ממש עכשיו.`, closed: true },
        { status: 409 }
      )
    }

    const counts = ranks.map((r) => ({ date: r.date, count: r.count }))
    void notifyBenny({ first_name, last_name, phone, group_type, area, counts })

    return NextResponse.json({ ok: true, counts })
  } catch (e) {
    console.error('[hakpatzot] POST error:', e)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}
