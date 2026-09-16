import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { whatsappOptinFields } from '@/lib/whatsapp-optin'

// ============================================================
// נתיב: app/api/hakpatzot/route.ts
// יום הקפצות (משגב-יעד, יום שישי) — מוגבל ל-15 רוכבים.
// GET  — מצב נוכחי (כמה נרשמו, האם ההרשמה סגורה, מי כבר נרשם)
// POST — הרשמה חדשה
// ============================================================

export const dynamic = 'force-dynamic'

// Single source of truth for the hard cap — keep in sync with the check
// constraint comment in supabase/migrations/20260913_hakpatzot_registrations.sql.
const CAPACITY = 15

const GROUP_LABEL: Record<string, string> = { mini: 'מיני גרביטי', full: 'גרביטי' }
const AREA_LABEL: Record<string, string> = { misgav: 'משגב', mata_asher: 'מטה אשר', biriya: 'ביריה' }

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
    .select('first_name, last_name, group_type, area')
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[hakpatzot] GET failed:', error)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }

  const count = rows?.length ?? 0
  const roster = (rows ?? []).map((r) => ({
    first_name: r.first_name,
    last_initial: (r.last_name || '').trim().charAt(0),
    group_type: r.group_type,
    area: r.area,
  }))

  return NextResponse.json(
    { count, capacity: CAPACITY, closed: count >= CAPACITY, roster },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

async function notifyBenny(r: {
  first_name: string
  last_name: string
  phone: string
  group_type: string
  area: string
  count: number
}) {
  const key = process.env.RESEND_API_KEY
  if (!key) return // not configured — skip silently, registration is already saved

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Teva Bike <leads@mail.tevabike.com>',
        to: ['bennyfire@gmail.com', 'talmatoki@gmail.com'],
        subject: `הרשמה להקפצות — ${r.first_name} ${r.last_name} (${r.count}/${CAPACITY})`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif">
          <h2 style="margin:0 0 12px">🚐 הרשמה חדשה ליום ההקפצות</h2>
          <table style="border-collapse:collapse;font-size:15px">
            <tr><td style="padding:6px 12px;font-weight:700">שם</td><td style="padding:6px 12px">${r.first_name} ${r.last_name}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700">טלפון</td><td style="padding:6px 12px">${r.phone}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700">קבוצה</td><td style="padding:6px 12px">${GROUP_LABEL[r.group_type] ?? r.group_type}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700">אזור</td><td style="padding:6px 12px">${AREA_LABEL[r.area] ?? r.area}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700">נרשמו עד כה</td><td style="padding:6px 12px">${r.count} / ${CAPACITY}</td></tr>
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

    if (!first_name || !last_name) {
      return NextResponse.json({ error: 'חסרים שם פרטי ושם משפחה' }, { status: 400 })
    }
    if (!phone || phone.replace(/\D/g, '').length < 9) {
      return NextResponse.json({ error: 'מספר טלפון לא תקין' }, { status: 400 })
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

    // Refuse up front if the cap is already visibly full — the rank check
    // below is what actually protects against a last-slot race.
    const { count: before } = await db
      .from('hakpatzot_registrations')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'cancelled')

    if ((before ?? 0) >= CAPACITY) {
      return NextResponse.json({ error: 'המקומות התפוסו. ההרשמה סגורה.', closed: true }, { status: 409 })
    }

    const { data: reg, error: insErr } = await db
      .from('hakpatzot_registrations')
      .insert({
        first_name,
        last_name,
        phone,
        group_type,
        area,
        consent,
        ...whatsappOptinFields(body.whatsapp_optin === true, 'hakpatzot'),
      })
      .select('id, created_at')
      .single()

    if (insErr || !reg) {
      console.error('[hakpatzot] insert failed:', insErr)
      return NextResponse.json({ error: 'לא הצלחנו לשמור. נסו שוב.' }, { status: 500 })
    }

    // Rank by insertion order (not a raw recount) so that of two
    // registrations racing for the last spot, exactly one — the earlier
    // created_at — keeps it; the other is rolled back here.
    const { count: rank } = await db
      .from('hakpatzot_registrations')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'cancelled')
      .lte('created_at', reg.created_at)

    if ((rank ?? 0) > CAPACITY) {
      await db.from('hakpatzot_registrations').delete().eq('id', reg.id)
      return NextResponse.json({ error: 'המקום האחרון נתפס ממש עכשיו. ההרשמה סגורה.', closed: true }, { status: 409 })
    }

    void notifyBenny({ first_name, last_name, phone, group_type, area, count: rank ?? 0 })

    return NextResponse.json({ ok: true, count: rank ?? 0, closed: (rank ?? 0) >= CAPACITY })
  } catch (e) {
    console.error('[hakpatzot] POST error:', e)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}
