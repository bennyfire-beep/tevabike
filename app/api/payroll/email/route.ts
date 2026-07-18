import { NextRequest, NextResponse } from 'next/server'

// Email the monthly payroll report (per-instructor totals + session breakdown).
//
// Uses Resend, the same email service the monthly salary cron already uses
// (RESEND_API_KEY, from admin@tevbike.com). If the key isn't configured (e.g.
// local dev), we return { ok:false, reason:'no_email_service' } so the client
// can fall back to a mailto: link instead.

export const dynamic = 'force-dynamic'

// Report recipients — extend this array to add more.
const RECIPIENTS = ['bennyfire@gmail.com', 'shirkobi8@gmail.com']

type Item = { date: string | null; label: string; isSpecial: boolean; isBase?: boolean; present: number | null; pay: number }
type Group = { name: string; totalSessions: number; totalPresent: number; totalPay: number; items: Item[] }
type Payload = {
  month: string
  monthLabel: string
  grand: { sessions: number; present: number; pay: number }
  groups: Group[]
}

const fmtDate = (d: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('he-IL') : '—')

function tag(it: Item): string {
  if (it.isBase) return ' <span style="background:#fef6da;color:#b8860b;border-radius:8px;padding:1px 6px;font-size:11px">💼 קבוע</span>'
  if (it.isSpecial) return ' <span style="background:#f3e8ff;color:#a855f7;border-radius:8px;padding:1px 6px;font-size:11px">★ מיוחדת</span>'
  return ''
}

function buildHtml(p: Payload): string {
  const groupBlocks = p.groups.map(g => {
    const rows = g.items.map(it => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666">${fmtDate(it.date)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${it.label}${tag(it)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${it.present ?? '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;font-weight:700;color:#16A34A">₪${it.pay.toLocaleString()}</td>
      </tr>`).join('')
    return `
      <div style="margin-bottom:20px;border:1px solid #eee;border-radius:10px;overflow:hidden">
        <div style="background:#faf7ff;padding:12px 14px;display:flex;justify-content:space-between;align-items:center">
          <strong style="font-size:15px">${g.name}</strong>
          <span style="color:#666;font-size:13px">${g.totalSessions} פעילויות · ${g.totalPresent} נוכחים · <strong style="color:#16A34A">₪${g.totalPay.toLocaleString()}</strong></span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#f7f5f2">
            <th style="padding:6px 10px;text-align:right;color:#6b7a72;font-size:11px">תאריך</th>
            <th style="padding:6px 10px;text-align:right;color:#6b7a72;font-size:11px">פעילות</th>
            <th style="padding:6px 10px;text-align:center;color:#6b7a72;font-size:11px">נוכחים</th>
            <th style="padding:6px 10px;text-align:center;color:#6b7a72;font-size:11px">תשלום</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
  }).join('')

  return `<!DOCTYPE html>
<html dir="rtl" lang="he"><head><meta charset="UTF-8"><title>דוח שכר – ${p.monthLabel}</title></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f3;margin:0;padding:20px">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <div style="background:#1a1320;padding:24px 28px;color:#fff">
      <div style="font-size:22px;font-weight:900;margin-bottom:4px">🚵 טבע בייק</div>
      <div style="color:rgba(255,255,255,.7);font-size:14px">דוח שכר מדריכים — ${p.monthLabel}</div>
    </div>
    <div style="padding:24px 28px">
      <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap">
        <div style="background:#faf7ff;border-radius:8px;padding:12px 16px;flex:1"><div style="font-size:11px;color:#6b7a72">מדריכים</div><div style="font-size:22px;font-weight:900;color:#a855f7">${p.groups.length}</div></div>
        <div style="background:#f0f9f4;border-radius:8px;padding:12px 16px;flex:1"><div style="font-size:11px;color:#6b7a72">פעילויות</div><div style="font-size:22px;font-weight:900;color:#0ea5e9">${p.grand.sessions}</div></div>
        <div style="background:#fef3fb;border-radius:8px;padding:12px 16px;flex:1"><div style="font-size:11px;color:#6b7a72">סה&quot;כ לתשלום</div><div style="font-size:22px;font-weight:900;color:#D4288A">₪${p.grand.pay.toLocaleString()}</div></div>
      </div>
      ${groupBlocks}
      <div style="margin-top:8px;padding:14px;background:#f7f5f2;border-radius:8px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:700">סה"כ לתשלום</span>
        <span style="font-size:22px;font-weight:900;color:#16A34A">₪${p.grand.pay.toLocaleString()}</span>
      </div>
    </div>
    <div style="padding:16px 28px;background:#f7f5f2;color:#9ca3af;font-size:11px;border-top:1px solid #eee">
      הופק מטבע בייק • ${new Date().toLocaleDateString('he-IL')}
    </div>
  </div>
</body></html>`
}

export async function POST(req: NextRequest) {
  let p: Payload
  try {
    p = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!p?.monthLabel || !Array.isArray(p.groups)) {
    return NextResponse.json({ ok: false, error: 'Missing report data' }, { status: 400 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    // Signal the client to fall back to a mailto: link.
    return NextResponse.json({ ok: false, reason: 'no_email_service' })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'TevaBike Admin <admin@tevbike.com>',
      to: RECIPIENTS,
      subject: `🚵 טבע בייק — דוח שכר מדריכים ${p.monthLabel}`,
      html: buildHtml(p),
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    console.error('[payroll/email] Resend send failed:', detail || res.statusText)
    return NextResponse.json({ ok: false, error: detail || res.statusText }, { status: 502 })
  }
  return NextResponse.json({ ok: true, recipients: RECIPIENTS })
}
