import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;text-align:center">${r.sessions}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;text-align:center">${r.totalHours}ש'</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;text-align:center">₪${r.hourlyRate}</td>
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
          <div style="font-size:24px;font-weight:900;color:#4444cc">${report.filter(r => r.sessions > 0).length}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f7f5f2">
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7a72">שם מדריך</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7a72">שיעורים</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7a72">שעות</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7a72">₪/שעה</th>
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
  name:       string
  sessions:   number
  totalHours: number
  hourlyRate: number
  totalSalary: number
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const url    = new URL(request.url)
  const month  = url.searchParams.get('month') ?? prevMonth()   // cron reports prev month
  const doSend = url.searchParams.get('send') === 'true'

  // Verify cron secret (set CRON_SECRET in env; Vercel passes it automatically)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supaUrl || !supaKey) return NextResponse.json({ error: 'Supabase env vars missing' }, { status: 500 })

  const db = createClient(supaUrl, supaKey)
  const { first, last } = firstLastDay(month)

  const [{ data: instructors }, { data: hoursRows }] = await Promise.all([
    db.from('admin_roles').select('id, name, hourly_rate').eq('role', 'instructor').order('name'),
    db.from('instructor_hours').select('instructor_id, hours').gte('date', first).lte('date', last),
  ])

  const report: ReportRow[] = (instructors ?? []).map(inst => {
    const detail     = (hoursRows ?? []).filter(h => h.instructor_id === inst.id)
    const totalHours = detail.reduce((s, h) => s + Number(h.hours), 0)
    const rate       = inst.hourly_rate ?? 60
    return {
      name:        inst.name,
      sessions:    detail.length,
      totalHours:  Math.round(totalHours * 10) / 10,
      hourlyRate:  rate,
      totalSalary: Math.round(totalHours * rate),
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
