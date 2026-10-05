import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { whatsappOptinFields } from '@/lib/whatsapp-optin'
import { MEETING_DATE, MEETING_DATE_LABEL, SESSION_VALUES, SESSION_LABEL, MAX_ATTENDEES } from '@/lib/parent-meeting'

// ============================================================
// נתיב: app/api/parent-meeting/route.ts
// אסיפת הורים — תאריך ומפגשים ב-lib/parent-meeting.ts. ללא עלות, ללא הגבלה.
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

async function notifyBenny(r: {
  parent_name: string
  phone: string
  rider_name: string
  session: string
  attendees: number
  notes: string
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
        subject: `הרשמה לאסיפת הורים — ${r.parent_name} (${r.rider_name})`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif">
          <h2 style="margin:0 0 12px">💜 הרשמה חדשה לאסיפת הורים — ${MEETING_DATE_LABEL}</h2>
          <table style="border-collapse:collapse;font-size:15px">
            <tr><td style="padding:6px 12px;font-weight:700">הורה</td><td style="padding:6px 12px">${esc(r.parent_name)}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700">טלפון</td><td style="padding:6px 12px">${esc(r.phone)}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700">רוכב/ת</td><td style="padding:6px 12px">${esc(r.rider_name)}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700">מפגש</td><td style="padding:6px 12px">${SESSION_LABEL[r.session] ?? r.session}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700">מספר משתתפים</td><td style="padding:6px 12px">${r.attendees}</td></tr>
            ${r.notes ? `<tr><td style="padding:6px 12px;font-weight:700">הערות</td><td style="padding:6px 12px">${esc(r.notes)}</td></tr>` : ''}
          </table>
        </div>`,
      }),
    })
  } catch (e) {
    console.error('[parent-meeting] notification failed (registration was still saved):', e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parent_name = String(body.parent_name ?? '').trim().slice(0, 80)
    const phone = String(body.phone ?? '').trim().slice(0, 20)
    const rider_name = String(body.rider_name ?? '').trim().slice(0, 120)
    const session = String(body.session ?? '')
    const attendees = Number(body.attendees)
    const notes = String(body.notes ?? '').trim().slice(0, 500)

    if (!parent_name) {
      return NextResponse.json({ error: 'חסר שם ההורה' }, { status: 400 })
    }
    if (!phone || phone.replace(/\D/g, '').length < 9) {
      return NextResponse.json({ error: 'מספר טלפון לא תקין' }, { status: 400 })
    }
    if (!rider_name) {
      return NextResponse.json({ error: 'חסר שם הרוכב/ת' }, { status: 400 })
    }
    if (!SESSION_VALUES.includes(session)) {
      return NextResponse.json({ error: 'יש לבחור מפגש' }, { status: 400 })
    }
    if (!Number.isInteger(attendees) || attendees < 1 || attendees > MAX_ATTENDEES) {
      return NextResponse.json({ error: 'יש לבחור כמה תגיעו' }, { status: 400 })
    }

    const { error: insErr } = await admin()
      .from('parent_meeting_registrations')
      .insert({
        meeting_date: MEETING_DATE,
        session,
        parent_name,
        phone,
        rider_name,
        attendees,
        notes: notes || null,
        ...whatsappOptinFields(body.whatsapp_optin === true, 'parent_meeting'),
      })

    if (insErr) {
      console.error('[parent-meeting] insert failed:', insErr)
      return NextResponse.json({ error: 'לא הצלחנו לשמור. נסו שוב.' }, { status: 500 })
    }

    void notifyBenny({ parent_name, phone, rider_name, session, attendees, notes })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[parent-meeting] POST error:', e)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}
