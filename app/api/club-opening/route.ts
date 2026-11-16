import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { whatsappOptinFields } from '@/lib/whatsapp-optin'
import {
  EVENT_DATE, EVENT_DATE_LABEL, PARTICIPATION_VALUES, PARTICIPATION_LABEL,
  GROUP_VALUES, FOOD_VALUES, FOOD_LABEL, MAX_RIDERS, MAX_ATTENDEES,
} from '@/lib/club-opening'

// ============================================================
// נתיב: app/api/club-opening/route.ts
// חנוכת מועדון — הגדרות ב-lib/club-opening.ts. ללא עלות, ללא הגבלה.
// GET  — מונים ציבוריים (כמה נרשמו, מי מביא מה) — בלי פרטים אישיים
// POST — הרשמה חדשה
// ============================================================

export const dynamic = 'force-dynamic'

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function GET() {
  const { data, error } = await admin()
    .from('club_opening_registrations')
    .select('attendees, riders_count, bringing')
    .eq('event_date', EVENT_DATE)

  if (error) {
    console.error('[club-opening] GET failed:', error)
    return NextResponse.json({ families: 0, people: 0, riders: 0, food: {} })
  }

  const food: Record<string, number> = {}
  let people = 0
  let riders = 0
  for (const r of data ?? []) {
    people += r.attendees ?? 0
    riders += r.riders_count ?? 0
    for (const f of (r.bringing as string[] | null) ?? []) food[f] = (food[f] ?? 0) + 1
  }
  return NextResponse.json({ families: data?.length ?? 0, people, riders, food })
}

type Reg = {
  contact_name: string
  phone: string
  group_name: string
  participation: string
  rider_names: string
  riders_count: number
  attendees: number
  bringing: string[]
  bringing_other: string
  notes: string
}

async function notifyBenny(r: Reg) {
  const key = process.env.RESEND_API_KEY
  if (!key) return // not configured — skip silently, registration is already saved

  const food = r.bringing.map((f) => FOOD_LABEL[f] ?? f).join(', ') + (r.bringing_other ? ` (${esc(r.bringing_other)})` : '')
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 12px;font-weight:700">${k}</td><td style="padding:6px 12px">${v}</td></tr>`

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Teva Bike <leads@mail.tevabike.com>',
        to: ['bennyfire@gmail.com', 'talmatoki@gmail.com'],
        subject: `הרשמה לחנוכת המועדון — ${r.contact_name} (${r.attendees})`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif">
          <h2 style="margin:0 0 12px">🎉 הרשמה חדשה לחנוכת המועדון — ${EVENT_DATE_LABEL}</h2>
          <table style="border-collapse:collapse;font-size:15px">
            ${row('שם', esc(r.contact_name))}
            ${row('טלפון', esc(r.phone))}
            ${row('קבוצה', esc(r.group_name))}
            ${row('השתתפות', PARTICIPATION_LABEL[r.participation] ?? r.participation)}
            ${r.riders_count ? row('רוכבים בתחרות', `${r.riders_count} — ${esc(r.rider_names)}`) : ''}
            ${row('מספר מגיעים', String(r.attendees))}
            ${row('מביאים', food || '—')}
            ${r.notes ? row('הערות', esc(r.notes)) : ''}
          </table>
        </div>`,
      }),
    })
  } catch (e) {
    console.error('[club-opening] notification failed (registration was still saved):', e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const contact_name = String(body.contact_name ?? '').trim().slice(0, 80)
    const phone = String(body.phone ?? '').trim().slice(0, 20)
    const group_name = String(body.group_name ?? '')
    const participation = String(body.participation ?? '')
    const riders_count = participation === 'activity' ? Number(body.riders_count) : 0
    const rider_names = participation === 'activity' ? String(body.rider_names ?? '').trim().slice(0, 200) : ''
    const attendees = Number(body.attendees)
    const bringing = Array.isArray(body.bringing)
      ? [...new Set((body.bringing as unknown[]).map(String))].filter((f) => FOOD_VALUES.includes(f))
      : []
    const bringing_other = bringing.includes('other') ? String(body.bringing_other ?? '').trim().slice(0, 120) : ''
    const notes = String(body.notes ?? '').trim().slice(0, 500)

    if (!contact_name) return NextResponse.json({ error: 'חסר שם' }, { status: 400 })
    if (!phone || phone.replace(/\D/g, '').length < 9) {
      return NextResponse.json({ error: 'מספר טלפון לא תקין' }, { status: 400 })
    }
    if (!GROUP_VALUES.includes(group_name)) {
      return NextResponse.json({ error: 'יש לבחור קבוצה' }, { status: 400 })
    }
    if (!PARTICIPATION_VALUES.includes(participation)) {
      return NextResponse.json({ error: 'יש לבחור למה מגיעים' }, { status: 400 })
    }
    if (participation === 'activity') {
      if (!Number.isInteger(riders_count) || riders_count < 1 || riders_count > MAX_RIDERS) {
        return NextResponse.json({ error: 'יש לבחור כמה רוכבים משתתפים בתחרות' }, { status: 400 })
      }
      if (!rider_names) return NextResponse.json({ error: 'חסרים שמות הרוכבים' }, { status: 400 })
    }
    if (!Number.isInteger(attendees) || attendees < 1 || attendees > MAX_ATTENDEES || attendees < riders_count) {
      return NextResponse.json({ error: 'יש לבחור כמה מגיעים בסך הכול' }, { status: 400 })
    }

    const reg: Reg = {
      contact_name, phone, group_name, participation, rider_names, riders_count,
      attendees, bringing, bringing_other, notes,
    }

    const { error: insErr } = await admin()
      .from('club_opening_registrations')
      .insert({
        event_date: EVENT_DATE,
        ...reg,
        rider_names: rider_names || null,
        bringing_other: bringing_other || null,
        notes: notes || null,
        ...whatsappOptinFields(body.whatsapp_optin === true, 'club_opening'),
      })

    if (insErr) {
      console.error('[club-opening] insert failed:', insErr)
      return NextResponse.json({ error: 'לא הצלחנו לשמור. נסו שוב.' }, { status: 500 })
    }

    void notifyBenny(reg)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[club-opening] POST error:', e)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}
