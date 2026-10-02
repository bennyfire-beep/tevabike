import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { sendRideReminder } from '@/lib/ride-emails'
import { SESSIONS, todayInIsrael, RIDER_TYPE_LABEL, LEVEL_LABEL, type RiderType } from '@/lib/ride-sessions'

// ============================================================
// נתיב: app/api/cron/ride-reminders/route.ts
// רץ פעם ביום (vercel.json). לכל טיול רכיבה שמתקיים בעוד DAYS_BEFORE ימים:
//   1. מייל תזכורת לכל נרשם עם אימייל (נקודת מפגש, ציוד, .ics) —
//      פעם אחת בלבד לנרשם (reminder_sent_at).
//   2. מייל סיכום לבני: מי מגיע, מי עוד לא שילם, מי צריך אופניים ובאיזה גובה.
// ============================================================

export const runtime = 'nodejs'
export const maxDuration = 60

const DAYS_BEFORE = 2
const SUMMARY_TO = ['bennyfire@gmail.com']
const FROM = 'טבע בייק <info@mail.tevabike.com>'

const STATUS_LABEL: Record<string, string> = { pending: 'ממתין לתשלום', paid: 'שולם' }

type Reg = {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
  level: string
  rider_type: RiderType
  price_ils: number
  status: string
  wants_rental: boolean
  rental_height_cm: number | null
  reminder_sent_at: string | null
}

/** YYYY-MM-DD plus n days (calendar arithmetic, no time zone involved). */
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const esc = (v: string) =>
  v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

export async function GET(req: NextRequest) {
  // Fail closed, like the other crons that email real people: no CRON_SECRET
  // means nobody gets in. Vercel Cron sends it as a Bearer token.
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[ride-reminders] CRON_SECRET is not set — refusing to run.')
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ ok: false, error: 'env missing' }, { status: 500 })
  const db = createClient(url, key, { auth: { persistSession: false } })

  const target = addDays(todayInIsrael(), DAYS_BEFORE)
  const trips = SESSIONS.filter((s) => s.date === target)
  const report: { slug: string; riders: number; reminded: number; noEmail: number }[] = []

  for (const s of trips) {
    const { data, error } = await db
      .from('ride_session_registrations')
      .select('id, first_name, last_name, phone, email, level, rider_type, price_ils, status, wants_rental, rental_height_cm, reminder_sent_at')
      .eq('session_slug', s.slug)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true })

    if (error) {
      console.error(`[ride-reminders] query failed for ${s.slug}:`, error)
      continue
    }
    const regs = (data ?? []) as Reg[]

    // 1. reminders to riders
    let reminded = 0
    for (const r of regs) {
      if (!r.email || r.reminder_sent_at) continue
      const ok = await sendRideReminder(s, { email: r.email, first_name: r.first_name, wants_rental: r.wants_rental })
      if (ok) {
        reminded++
        await db.from('ride_session_registrations').update({ reminder_sent_at: new Date().toISOString() }).eq('id', r.id)
      }
    }
    const noEmail = regs.filter((r) => !r.email).length
    report.push({ slug: s.slug, riders: regs.length, reminded, noEmail })

    // 2. summary to Benny
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      const unpaid = regs.filter((r) => r.status !== 'paid' && Number(r.price_ils) > 0)
      const rentals = regs.filter((r) => r.wants_rental)
      const rows = regs
        .map((r) => {
          const pay = Number(r.price_ils) === 0 ? 'כלול במנוי' : STATUS_LABEL[r.status] ?? r.status
          return `<tr>
            <td style="padding:5px 8px">${esc(r.first_name)} ${esc(r.last_name)}</td>
            <td style="padding:5px 8px;direction:ltr;text-align:right">${esc(r.phone)}</td>
            <td style="padding:5px 8px">${RIDER_TYPE_LABEL[r.rider_type] ?? r.rider_type}</td>
            <td style="padding:5px 8px">${LEVEL_LABEL[r.level] ?? r.level}</td>
            <td style="padding:5px 8px;${r.status !== 'paid' && Number(r.price_ils) > 0 ? 'color:#b45309;font-weight:700' : ''}">${pay}</td>
            <td style="padding:5px 8px">${r.wants_rental ? `🚲 ${r.rental_height_cm ?? '?'} ס״מ` : ''}</td>
            <td style="padding:5px 8px">${r.email ? '' : 'אין מייל — לא קיבל תזכורת'}</td>
          </tr>`
        })
        .join('')
      try {
        await new Resend(resendKey).emails.send({
          from: FROM,
          to: SUMMARY_TO,
          subject: `בעוד ${DAYS_BEFORE} ימים: ${s.title} — ${regs.length} רוכבים, ${unpaid.length} לא שילמו, ${rentals.length} השכרות`,
          html: `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px">
            <h2 style="margin:0 0 8px">🚵 ${esc(s.title)} · ${esc(s.dateLabel)} · ${esc(s.hours)}</h2>
            <p>${regs.length} / ${s.capacity} רוכבים · ${unpaid.length} עוד לא שילמו · ${rentals.length} אופניים חשמליים בהשכרה ·
               נשלחו ${reminded} תזכורות${noEmail ? ` · ${noEmail} בלי מייל (כדאי לתזכר בוואטסאפ)` : ''}</p>
            ${regs.length
              ? `<table style="border-collapse:collapse" border="1" cellspacing="0">
                  <tr style="background:#f5f5f4"><th style="padding:5px 8px">שם</th><th style="padding:5px 8px">טלפון</th><th style="padding:5px 8px">סוג</th><th style="padding:5px 8px">רמה</th><th style="padding:5px 8px">תשלום</th><th style="padding:5px 8px">השכרה</th><th style="padding:5px 8px"></th></tr>
                  ${rows}
                </table>`
              : '<p>אין נרשמים לטיול הזה.</p>'}
            <p><a href="https://tevabike.com/admin/coordinator/rides">למסך הניהול</a></p>
          </div>`,
        })
      } catch (e) {
        console.error('[ride-reminders] summary email failed:', e)
      }
    }
  }

  return NextResponse.json({ ok: true, target, trips: report })
}
