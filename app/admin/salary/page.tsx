'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAdminAuth } from '@/lib/use-admin-auth'

// ─── Brand ────────────────────────────────────────────────────────────────────
const PINK  = '#D4288A'
const DARK  = '#0C1814'
const GREEN = '#16A34A'

// ─── Types ────────────────────────────────────────────────────────────────────
type InstructorRow = {
  adminRoleId: string
  name:        string
  branch:      string | null
  hourlyRate:  number
  totalHours:  number
  totalSalary: number
  sessions:    number
  hoursDetail: HoursDetail[]
  workdays:     number
  travelMode:   'none' | 'pass' | 'car'
  travelKm:     number
  travelAmount: number
}

type HoursDetail = {
  date:       string
  class_name: string
  branch:     string
  hours:      number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function monthOptions() {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  return new Date(parseInt(y), parseInt(m) - 1, 1)
    .toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
}

function firstLastDay(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const first = `${ym}-01`
  const last  = new Date(y, m, 0).toISOString().split('T')[0]
  return { first, last }
}

// ─── Print payslip ────────────────────────────────────────────────────────────
function printPayslip(row: InstructorRow, ym: string) {
  const label = monthLabel(ym)
  const rows  = row.hoursDetail
  const html  = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<title>תלוש שכר – ${row.name} – ${label}</title>
<style>
  @page { margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #111; font-size: 14px; }
  h1  { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #555; margin: 0 0 20px; font-size: 13px; }
  .info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; background: #f7f7f5; padding: 14px; border-radius: 8px; }
  .info dt { color: #777; font-size: 12px; }
  .info dd { font-weight: 700; margin: 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #ddd; padding: 7px 10px; text-align: right; }
  th { background: #f0f0f0; font-weight: 700; font-size: 12px; }
  tfoot td { font-weight: 700; background: #f7f7f5; }
  .total-box { border: 2px solid #111; border-radius: 8px; padding: 14px 18px; display: inline-block; margin-top: 8px; }
  .total-box .amount { font-size: 28px; font-weight: 900; }
  .footer { margin-top: 32px; border-top: 1px solid #ddd; padding-top: 12px; color: #888; font-size: 11px; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>🚵 טבע בייק — תלוש שכר</h1>
  <p class="sub">הופק ב-${new Date().toLocaleDateString('he-IL')}</p>

  <dl class="info">
    <div><dt>שם מדריך</dt><dd>${row.name}</dd></div>
    <div><dt>חודש</dt><dd>${label}</dd></div>
    <div><dt>סניף</dt><dd>${row.branch ?? 'כל הסניפים'}</dd></div>
    <div><dt>שכר לשעה</dt><dd>₪${row.hourlyRate}</dd></div>
  </dl>

  <table>
    <thead>
      <tr>
        <th>תאריך</th><th>קבוצה</th><th>סניף</th><th>שעות</th><th>תשלום</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => `<tr>
        <td>${new Date(r.date).toLocaleDateString('he-IL')}</td>
        <td>${r.class_name}</td>
        <td>${r.branch}</td>
        <td>${r.hours}</td>
        <td>₪${(r.hours * row.hourlyRate).toFixed(0)}</td>
      </tr>`).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3">סה"כ</td>
        <td>${row.totalHours}</td>
        <td>₪${row.totalSalary.toLocaleString()}</td>
      </tr>
    </tfoot>
  </table>

  <div class="total-box">
    ${row.travelAmount > 0 ? `<div style="font-size:13px;color:#555;margin-bottom:8px">שכר עבודה: ₪${row.totalSalary.toLocaleString()} &nbsp;·&nbsp; החזר נסיעות: ₪${row.travelAmount.toLocaleString()}</div>` : ''}
    <div style="font-size:12px;color:#555;margin-bottom:4px">סה"כ לתשלום</div>
    <div class="amount">₪${(row.totalSalary + row.travelAmount).toLocaleString()}</div>
  </div>

  <div class="footer">
    טבע בייק | bennyfire@gmail.com | מסמך זה הופק אוטומטית
  </div>

  <script>window.onload = () => window.print()</script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=820,height=700')
  if (win) { win.document.write(html); win.document.close() }
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SalaryPage() {
  const { user, loading, logout } = useAdminAuth()
  const router = useRouter()

  const [month, setMonth]           = useState(() => monthOptions()[0])
  const [rows, setRows]             = useState<InstructorRow[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [editingRate, setEditingRate] = useState<string | null>(null)  // adminRoleId
  const [rateInput, setRateInput]   = useState('')
  const [savingRate, setSavingRate] = useState(false)
  const [sending, setSending]       = useState(false)
  const [sentMsg, setSentMsg]       = useState('')

  // Redirect instructors to their own page
  useEffect(() => {
    if (!loading && user?.role === 'instructor') {
      router.replace('/admin/instructor')
    }
  }, [loading, user, router])

  const loadData = useCallback(async () => {
    if (!user || user.role === 'instructor') return
    setDataLoading(true)

    const { first, last } = firstLastDay(month)

    const [{ data: instructors }, { data: sessionRows }, { data: travelRows }] = await Promise.all([
      supabase.from('admin_roles').select('id, name, branch, hourly_rate').eq('role', 'instructor').order('name'),
      supabase.from('class_sessions').select('instructor_id, session_date, class_name, branch, duration').not('instructor_id', 'is', null).gte('session_date', first).lte('session_date', last).order('session_date'),
      supabase.from('instructor_travel').select('instructor_id, mode, km, amount').eq('month', month),
    ])

    const compiled: InstructorRow[] = (instructors ?? []).map(inst => {
      const detail = (sessionRows ?? []).filter(h => h.instructor_id === inst.id)
      const totalHours  = detail.reduce((s, h) => s + Number(h.duration ?? 0), 0)
      const hourlyRate  = inst.hourly_rate ?? 60
      const workdays    = new Set(detail.map(h => h.session_date)).size
      const tr          = (travelRows ?? []).find(t => t.instructor_id === inst.id)
      return {
        adminRoleId: inst.id,
        name:        inst.name,
        branch:      inst.branch ?? null,
        hourlyRate,
        totalHours:  Math.round(totalHours * 10) / 10,
        totalSalary: Math.round(totalHours * hourlyRate),
        sessions:    detail.length,
        hoursDetail: detail.map(h => ({ date: h.session_date, class_name: h.class_name, branch: h.branch, hours: Number(h.duration ?? 0) })),
        workdays,
        travelMode:   (tr?.mode as 'none' | 'pass' | 'car') ?? 'none',
        travelKm:     Number(tr?.km ?? 0),
        travelAmount: Number(tr?.amount ?? 0),
      }
    })

    setRows(compiled)
    setDataLoading(false)
  }, [user, month])

  useEffect(() => { loadData() }, [loadData])

  async function saveRate(adminRoleId: string) {
    const rate = parseFloat(rateInput)
    if (isNaN(rate) || rate <= 0) return
    setSavingRate(true)
    const { error } = await supabase.from('admin_roles').update({ hourly_rate: rate }).eq('id', adminRoleId)
    if (!error) {
      setRows(prev => prev.map(r => r.adminRoleId === adminRoleId ? { ...r, hourlyRate: rate, totalSalary: Math.round(r.totalHours * rate) } : r))
      setEditingRate(null)
    } else alert('שגיאה: ' + error.message)
    setSavingRate(false)
  }

  async function updateTravel(adminRoleId: string, mode: 'none' | 'pass' | 'car', km: number, amount: number) {
    setRows(prev => prev.map(r => r.adminRoleId === adminRoleId ? { ...r, travelMode: mode, travelKm: km, travelAmount: amount } : r))
    await supabase.from('instructor_travel').upsert(
      { instructor_id: adminRoleId, month, mode, km, amount },
      { onConflict: 'instructor_id,month' }
    )
  }

  async function sendReport() {
    setSending(true)
    try {
      const res  = await fetch(`/api/salary/report?month=${month}&send=true`)
      const data = await res.json()
      setSentMsg(data.sent ? '✓ הדוח נשלח לבני!' : `שגיאה: ${data.error ?? 'unknown'}`)
      setTimeout(() => setSentMsg(''), 4000)
    } catch (e) {
      setSentMsg('שגיאה בשליחה')
    }
    setSending(false)
  }

  if (loading || (!loading && user?.role === 'instructor')) return (
    <div style={{ background: DARK, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7a8f7d', fontFamily: 'Heebo, Arial, sans-serif' }}>
      טוען...
    </div>
  )

  const totalHours  = rows.reduce((s, r) => s + r.totalHours,  0)
  const totalSalary = rows.reduce((s, r) => s + r.totalSalary, 0)
  const totalTravel = rows.reduce((s, r) => s + r.travelAmount, 0)
  const totalPay    = totalSalary + totalTravel
  const canEditRate = user?.role === 'coordinator'

  return (
    <div dir="rtl" style={{ fontFamily: 'Heebo, Arial, sans-serif', background: DARK, minHeight: '100vh', color: '#e8efe9' }}>

      {/* ── Header ── */}
      <div style={{ background: '#141716', borderBottom: '1px solid #252b27', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <img src="/logo.png" alt="Tev Bike" style={{ height: 36, borderRadius: 6 }} />
        <span style={{ background: '#1a1a2e', color: '#c0bfff', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>שכר מדריכים</span>
        <span style={{ color: '#e8efe9', fontWeight: 700, fontSize: 14 }}>{user?.name}</span>

        <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Month selector */}
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            style={{ background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 8, color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 13, padding: '6px 12px', outline: 'none' }}
          >
            {monthOptions().map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>

          {/* Send report */}
          <button
            onClick={sendReport}
            disabled={sending}
            style={{ background: '#1a2e1a', color: '#b5e853', border: '1px solid #b5e85344', borderRadius: 8, padding: '6px 14px', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            {sending ? '...' : '📧 שלח דוח לבני'}
          </button>
          {sentMsg && <span style={{ color: '#4cdb7a', fontSize: 13 }}>{sentMsg}</span>}

          <button onClick={logout} style={{ background: 'transparent', border: '1px solid #252b27', color: '#7a8f7d', borderRadius: 8, padding: '6px 14px', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 12, cursor: 'pointer' }}>
            יציאה
          </button>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 1080, margin: '0 auto' }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 6px' }}>דוח שכר מדריכים</h2>
        <p style={{ color: '#7a8f7d', fontSize: 13, margin: '0 0 24px' }}>{monthLabel(month)}</p>

        {/* ── KPI cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 28 }}>
          {[
            { icon: '👥', label: 'מדריכים',       value: rows.length,                        color: '#81d4fa' },
            { icon: '⏱️', label: 'סה"כ שעות',     value: `${Math.round(totalHours * 10) / 10}ש'`, color: '#b5e853' },
            { icon: '💰', label: 'סה"כ לתשלום',   value: `₪${totalPay.toLocaleString()}`, color: '#4cdb7a' },
            { icon: '🗓️', label: 'שיעורים החודש', value: rows.reduce((s, r) => s + r.sessions, 0), color: PINK },
          ].map(c => (
            <div key={c.label} style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{c.icon}</div>
              <div style={{ fontSize: 11, color: '#7a8f7d', marginBottom: 3 }}>{c.label}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* ── Table ── */}
        <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', padding: '11px 20px', borderBottom: '1px solid #252b27', fontSize: 11, color: '#7a8f7d', fontWeight: 700 }}>
            <span>שם מדריך</span><span>שיעורים</span><span>שעות</span>
            <span>שכר לשעה {canEditRate && <span style={{ color: PINK, fontSize: 9 }}>✎</span>}</span>
            <span>סה"כ לתשלום</span><span>פעולות</span>
          </div>

          {dataLoading ? (
            <div style={{ padding: 32, color: '#7a8f7d', textAlign: 'center' }}>טוען...</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 32, color: '#7a8f7d', textAlign: 'center' }}>אין נתונים לחודש זה</div>
          ) : (
            rows.map((row, i) => (
              <div key={row.adminRoleId}>
                {/* Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', padding: '14px 20px', borderBottom: i < rows.length - 1 ? '1px solid #1a1e1c' : 'none', alignItems: 'center' }}>
                  {/* Name + branch */}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{row.name}</div>
                    {row.branch && <div style={{ color: '#7a8f7d', fontSize: 11 }}>📍 {row.branch}</div>}
                  </div>

                  {/* Sessions */}
                  <span style={{ color: '#81d4fa', fontWeight: 600 }}>{row.sessions}</span>

                  {/* Hours */}
                  <span style={{ color: '#b5e853', fontWeight: 600 }}>{row.totalHours}ש'</span>

                  {/* Hourly rate — editable by coordinator */}
                  <div>
                    {canEditRate && editingRate === row.adminRoleId ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          type="number" min="1" step="5"
                          value={rateInput}
                          onChange={e => setRateInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveRate(row.adminRoleId)}
                          style={{ width: 64, background: '#0d0f0e', border: `1px solid ${PINK}`, borderRadius: 6, color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 13, padding: '4px 8px', outline: 'none' }}
                          autoFocus
                        />
                        <button onClick={() => saveRate(row.adminRoleId)} disabled={savingRate} style={{ background: '#b5e853', color: '#0d0f0e', border: 'none', borderRadius: 6, padding: '4px 8px', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✓</button>
                        <button onClick={() => setEditingRate(null)} style={{ background: '#1a1e1c', color: '#7a8f7d', border: 'none', borderRadius: 6, padding: '4px 8px', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 12, cursor: 'pointer' }}>✕</button>
                      </div>
                    ) : (
                      <span
                        style={{ color: '#e8efe9', cursor: canEditRate ? 'pointer' : 'default' }}
                        onClick={() => canEditRate && (setEditingRate(row.adminRoleId), setRateInput(String(row.hourlyRate)))}
                        title={canEditRate ? 'לחץ לעריכה' : ''}
                      >
                        ₪{row.hourlyRate}/ש'
                        {canEditRate && <span style={{ color: '#7a8f7d', fontSize: 10, marginRight: 4 }}>✎</span>}
                      </span>
                    )}
                  </div>

                  {/* Total salary + travel */}
                  <span style={{ color: '#4cdb7a', fontWeight: 900, fontSize: 17 }}>
                    ₪{(row.totalSalary + row.travelAmount).toLocaleString()}
                    {row.travelAmount > 0 && <span style={{ display: 'block', color: '#7a8f7d', fontSize: 10, fontWeight: 600 }}>שכר ₪{row.totalSalary.toLocaleString()} + נסיעות ₪{row.travelAmount.toLocaleString()}</span>}
                  </span>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => printPayslip(row, month)}
                      disabled={row.sessions === 0}
                      style={{ background: row.sessions > 0 ? PINK : '#1a1e1c', color: row.sessions > 0 ? '#fff' : '#7a8f7d', border: 'none', borderRadius: 8, padding: '6px 14px', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 12, fontWeight: 700, cursor: row.sessions > 0 ? 'pointer' : 'default' }}
                    >
                      📄 הפק תלוש
                    </button>
                  </div>
                </div>

                {/* Travel reimbursement strip */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 20px', borderBottom: '1px solid #1a1e1c', background: '#10130f' }}>
                  <span style={{ color: '#7a8f7d', fontSize: 12, fontWeight: 600 }}>🚌 החזר נסיעות:</span>
                  {([['none', 'ללא'], ['pass', 'חופשי חודשי'], ['car', 'רכב']] as const).map(([m, lbl]) => (
                    <button
                      key={m}
                      onClick={() => {
                        const km = m === 'car' ? row.travelKm : 0
                        const amount = m === 'pass' ? 7 * row.workdays : m === 'car' ? row.travelKm * 1 : 0
                        updateTravel(row.adminRoleId, m, km, amount)
                      }}
                      style={{ background: row.travelMode === m ? '#b5e853' : '#1a1e1c', color: row.travelMode === m ? '#0d0f0e' : '#7a8f7d', border: 'none', borderRadius: 14, padding: '3px 12px', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >{lbl}</button>
                  ))}
                  {row.travelMode === 'pass' && (
                    <span style={{ color: '#7a8f7d', fontSize: 11 }}>הצעה: 7₪ × {row.workdays} ימים</span>
                  )}
                  {row.travelMode === 'car' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: '#7a8f7d', fontSize: 11 }}>ק&quot;מ:</span>
                      <input
                        type="number" min="0" value={row.travelKm || ''}
                        onChange={e => { const km = parseFloat(e.target.value) || 0; updateTravel(row.adminRoleId, 'car', km, km * 1) }}
                        style={{ width: 70, background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 6, color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 12, padding: '3px 8px', outline: 'none' }}
                      />
                    </span>
                  )}
                  {row.travelMode !== 'none' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: '#7a8f7d', fontSize: 11 }}>סכום ₪:</span>
                      <input
                        type="number" min="0" value={row.travelAmount || ''}
                        onChange={e => updateTravel(row.adminRoleId, row.travelMode, row.travelKm, parseFloat(e.target.value) || 0)}
                        style={{ width: 80, background: '#0d0f0e', border: `1px solid ${PINK}`, borderRadius: 6, color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 12, fontWeight: 700, padding: '3px 8px', outline: 'none' }}
                      />
                    </span>
                  )}
                  {row.travelAmount > 0 && (
                    <span style={{ color: '#4cdb7a', fontSize: 12, fontWeight: 700, marginRight: 'auto' }}>+₪{row.travelAmount.toLocaleString()}</span>
                  )}
                </div>

                {/* Detail rows for this instructor (collapsible-like mini table) */}
                {row.hoursDetail.length > 0 && (
                  <div style={{ background: '#0f1412', borderBottom: i < rows.length - 1 ? '1px solid #1a1e1c' : 'none', padding: '0 20px 12px 60px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 100px 60px 80px', fontSize: 11, color: '#7a8f7d', fontWeight: 600, padding: '8px 0 4px' }}>
                      <span>תאריך</span><span>קבוצה</span><span>סניף</span><span>שעות</span><span>תשלום</span>
                    </div>
                    {row.hoursDetail.map((d, di) => (
                      <div key={di} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 100px 60px 80px', fontSize: 12, color: '#9ca3af', padding: '3px 0' }}>
                        <span>{new Date(d.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}</span>
                        <span>{d.class_name}</span>
                        <span>{d.branch}</span>
                        <span>{d.hours}ש'</span>
                        <span>₪{(d.hours * row.hourlyRate).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Grand total row */}
          {rows.length > 0 && !dataLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', padding: '14px 20px', borderTop: '1px solid #252b27', background: '#1a1e1c', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: '#7a8f7d' }}>סה"כ</span>
              <span style={{ color: '#81d4fa', fontWeight: 700 }}>{rows.reduce((s, r) => s + r.sessions, 0)}</span>
              <span style={{ color: '#b5e853', fontWeight: 700 }}>{Math.round(totalHours * 10) / 10}ש'</span>
              <span />
              <span style={{ color: '#4cdb7a', fontWeight: 900, fontSize: 18 }}>₪{totalPay.toLocaleString()}</span>
              <span />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
