import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_HOURLY_RATE, DEFAULT_RATE_PER_LESSON } from '@/lib/attendance'
import { computeTravel, TRAVEL_LABEL, travelConfigOf } from '@/lib/travel'
import { lessonPayFor, coTaughtPresent } from '@/lib/lesson-pay'
import { activityPayTotal } from '@/lib/activity-logs'

// ─── Vercel Cron: runs at 08:00 on the 1st of every month ────────────────────
// Add to vercel.json:  { "crons": [{ "path": "/api/salary/report", "schedule": "0 6 1 * *" }] }
// The Vercel cron calls GET /api/salary/report?send=true automatically.

const BENNY_EMAIL = 'bennyfire@gmail.com'

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function prevMonth() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  return new Date(parseInt(y), parseInt(m) - 1, 1)
    .toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
}

function firstLastDay(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return {
    first: `${ym}-01`,
    last:  new Date(y, m, 0).toISOString().split('T')[0],
  }
}

// ─── Generate HTML email body ─────────────────────────────────────────────────
function buildHtml(report: ReportRow[], ym: string, totalHours: number, totalSalary: number): string {
  const label = monthLabel(ym)
  const rows  = report.map(r => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd">${r.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;text-align:center">${r.lessons} × ₪${r.ratePerLesson}<br><b>₪${r.lessonPay.toLocaleString()}</b></td>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;text-align:center">${r.totalHours > 0 ? `${r.totalHours}ש' × ₪${r.hourlyRate}<br><b>₪${r.specialPay.toLocaleString()}</b>` : '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;text-align:center">${r.travelPay > 0 ? `₪${r.travelPay.toLocaleString()}<br><span style="font-size:11px;color:#6b7a72">${r.travelLabel}</span>` : '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;text-align:center">${r.activityPay > 0 ? `₪${r.activityPay.toLocaleString()}` : '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;font-weight:700;color:#16A34A;text-align:center">₪${r.totalSalary.toLocaleString()}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><title>דוח שכר – ${label}</title></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f3;margin:0;padding:20px">
  <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <div style="background:#0C1814;padding:24px 28px;color:#fff">
      <div style="font-size:22px;font-weight:900;margin-bottom:4px">🚵 טבע בייק</div>
      <div style="color:rgba(255,255,255,.6);font-size:14px">דוח שכר מדריכים — ${label}</div>
    </div>
    <div style="padding:24px 28px">
      <div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap">
        <div style="background:#f0f9f4;border-radius:8px;padding:12px 16px;flex:1">
          <div style="font-size:11px;color:#6b7a72">סה&quot;כ שעות</div>
          <div style="font-size:24px;font-weight:900;color:#16A34A">${Math.round(totalHours * 10) / 10}ש'</div>
        </div>
        <div style="background:#fef3fb;border-radius:8px;padding:12px 16px;flex:1">
          <div style="font-size:11px;color:#6b7a72">סה&quot;כ לתשלום</div>
          <div style="font-size:24px;font-weight:900;color:#D4288A">₪${totalSalary.toLocaleString()}</div>
        </div>
        <div style="background:#f0f4ff;border-radius:8px;padding:12px 16px;flex:1">
          <div style="font-size:11px;color:#6b7a72">מדריכים פעילים</div>
          <div style="font-size:24px;font-weight:900;color:#4444cc">${report.filter(r => r.lessons > 0 || r.totalHours > 0 || r.activityPay > 0).length}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f7f5f2">
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7a72">שם מדריך</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7a72">שיעורים רגילים</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7a72">★ פעילויות מיוחדות</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7a72">🚗 נסיעות</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7a72">➕ פעילויות נוספות</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7a72">סה"כ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:16px;padding:14px;background:#f7f5f2;border-radius:8px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:700">סה"כ לתשלום</span>
        <span style="font-size:22px;font-weight:900;color:#16A34A">₪${totalSalary.toLocaleString()}</span>
      </div>
    </div>
    <div style="padding:16px 28px;background:#f7f5f2;color:#9ca3af;font-size:11px;border-top:1px solid #eee">
      הודעה זו נשלחה אוטומטית מטבע בייק • ${new Date().toLocaleDateString('he-IL')} • bennyfire@gmail.com
    </div>
  </div>
</body>
</html>`
}

type ReportRow = {
  name:          string
  lessons:       number   // ordinary weekly lessons
  ratePerLesson: number
  lessonPay:     number
  totalHours:    number   // hours across special activities
  hourlyRate:    number
  specialPay:    number
  travelPay:     number
  travelLabel:   string
  activityPay:   number   // approved "פעילות אחרת" reports this month
  totalSalary:   number
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const url    = new URL(request.url)
  const month  = url.searchParams.get('month') ?? prevMonth()   // cron reports prev month
  const doSend = url.searchParams.get('send') === 'true'

  // ── Authorisation: the cron secret is mandatory ──────────────────────────
  // This route runs with the service-role key and returns every instructor's
  // name, personal rates and pay. It previously only checked CRON_SECRET when
  // that variable happened to be set — and it was not set in production, so the
  // whole report was readable by anyone on the internet. Fail closed instead:
  // no secret configured means nobody gets in, including the cron.
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[salary/report] CRON_SECRET is not set — refusing to serve the salary report.')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supaUrl || !supaKey) return NextResponse.json({ error: 'Supabase env vars missing' }, { status: 500 })

  const db = createClient(supaUrl, supaKey)
  const { first, last } = firstLastDay(month)

  // Rates live on staff_pay (admin_roles carries neither), and the lesson log is
  // class_sessions — the previous `instructor_hours` table does not exist, which
  // is why this report came out empty.
  const [{ data: instructors }, { data: pay }, { data: sessions }, { data: travelRows }, { data: travelDays }, { data: activityRows }] = await Promise.all([
    db.from('admin_roles').select('id, name').eq('role', 'instructor').order('name'),
    db.from('staff_pay')
      .select('admin_role_id, rate_per_lesson, hourly_rate, lesson_pay_model, attendance_rate_low, attendance_rate_mid, attendance_rate_high, attendance_threshold, attendance_threshold_2, travel_type, travel_km, travel_rate, travel_monthly_amount'),
    db.from('class_sessions')
      .select('instructor_id, instructor_ids, type, duration, session_date, present_count')
      .gte('session_date', first).lte('session_date', last),
    db.from('instructor_travel').select('instructor_id, amount').eq('month', month),
    db.from('instructor_travel_days').select('instructor_id, km').gte('travel_date', first).lte('travel_date', last),
    // Approved "פעילות אחרת" reports only — pending/rejected never reach pay.
    db.from('instructor_activity_logs')
      .select('instructor_id, hours, hourly_rate')
      .eq('status', 'approved')
      .gte('activity_date', first).lte('activity_date', last),
  ])

  // Tally per instructor; co-taught sessions count for everyone listed.
  // One entry per ordinary lesson, holding its attendance — the by_attendance
  // model prices each lesson on its own, so a count is not enough.
  const lessonPresents = new Map<string, number[]>()
  const specialHours = new Map<string, number>()
  const workDays     = new Map<string, Set<string>>()
  for (const s of sessions ?? []) {
    const ids = new Set<string>()
    if (s.instructor_id) ids.add(s.instructor_id)
    for (const extra of (s.instructor_ids ?? []) as string[]) ids.add(extra)
    // Band lookup only, divided by everyone who taught it — see coTaughtPresent.
    const bandPresent = coTaughtPresent(s.present_count, ids.size)
    for (const id of ids) {
      if (!workDays.has(id)) workDays.set(id, new Set())
      workDays.get(id)!.add(s.session_date)
      if (s.type === 'special') {
        specialHours.set(id, (specialHours.get(id) ?? 0) + (Number(s.duration) || 0))
      } else {
        if (!lessonPresents.has(id)) lessonPresents.set(id, [])
        lessonPresents.get(id)!.push(bandPresent)
      }
    }
  }

  const payOf      = new Map((pay ?? []).map(p => [p.admin_role_id, p]))
  const overrideOf = new Map((travelRows ?? []).map(t => [t.instructor_id, Number(t.amount)]))

  // Km the per_km instructors reported themselves. Absent from the map means
  // "reported nothing this month" — a reported 0 is a real figure.
  const reportedOf = new Map<string, number>()
  for (const d of travelDays ?? []) {
    reportedOf.set(d.instructor_id, (reportedOf.get(d.instructor_id) ?? 0) + (Number(d.km) || 0))
  }

  // Approved activity reports, grouped per instructor — priced on their own
  // (hours × the rate set at approval), never off staff_pay.
  const activityByInstructor = new Map<string, Array<{ hours: number | null; hourly_rate: number | null }>>()
  for (const a of activityRows ?? []) {
    if (!activityByInstructor.has(a.instructor_id)) activityByInstructor.set(a.instructor_id, [])
    activityByInstructor.get(a.instructor_id)!.push(a)
  }

  const report: ReportRow[] = (instructors ?? []).map(inst => {
    const p             = payOf.get(inst.id)
    const ratePerLesson = p?.rate_per_lesson == null ? DEFAULT_RATE_PER_LESSON : Number(p.rate_per_lesson)
    const hourlyRate    = p?.hourly_rate     == null ? DEFAULT_HOURLY_RATE     : Number(p.hourly_rate)

    const presents    = lessonPresents.get(inst.id) ?? []
    const n           = presents.length
    const hours       = Math.round((specialHours.get(inst.id) ?? 0) * 10) / 10
    const workingDays = workDays.get(inst.id)?.size ?? 0
    const lessonPay   = lessonPayFor(p, presents)
    const specialPay  = hours * hourlyRate
    const reportedKm  = reportedOf.has(inst.id) ? Math.round(reportedOf.get(inst.id)! * 100) / 100 : null
    const travelPay   = computeTravel(p, workingDays, overrideOf.has(inst.id) ? overrideOf.get(inst.id)! : null, reportedKm)
    const activityPay = activityPayTotal(activityByInstructor.get(inst.id) ?? [])

    return {
      name:        inst.name,
      lessons:     n,
      ratePerLesson,
      lessonPay:   Math.round(lessonPay),
      totalHours:  hours,
      hourlyRate,
      specialPay:  Math.round(specialPay),
      travelPay:   Math.round(travelPay),
      travelLabel: TRAVEL_LABEL[travelConfigOf(p).type],
      activityPay: Math.round(activityPay),
      totalSalary: Math.round(lessonPay + specialPay + travelPay + activityPay),
    }
  })

  const totalHours  = report.reduce((s, r) => s + r.totalHours,  0)
  const totalSalary = report.reduce((s, r) => s + r.totalSalary, 0)

  // ── Send email via Resend if requested ────────────────────────────────────
  let sent  = false
  let emailError: string | undefined

  if (doSend) {
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      emailError = 'RESEND_API_KEY not set'
    } else {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:    'TevaBike Admin <admin@tevbike.com>',
          to:      [BENNY_EMAIL],
          subject: `🚵 טבע בייק — דוח שכר מדריכים ${monthLabel(month)}`,
          html:    buildHtml(report, month, totalHours, totalSalary),
        }),
      })
      sent = emailRes.ok
      if (!emailRes.ok) emailError = await emailRes.text()
    }
  }

  return NextResponse.json({ report, totalHours, totalSalary, month, sent, error: emailError })
}
