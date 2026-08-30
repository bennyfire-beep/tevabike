'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'
import { isSalaryAdmin } from '@/lib/salary-access'
import { ACTIVITY_STATUS_LABEL, ACTIVITY_STATUS_COLOR, activityLabel, type ActivityStatus } from '@/lib/activity-logs'

// ─────────────────────────────────────────────────────────────────────────────
// "פעילויות ממתינות לאישור" — every instructor's "פעילות אחרת" report
// (צילום, תיקון אופניים, ...), for a salary admin to price and decide on.
//
// Gated the same way /admin/coordinator/payroll is: is_salary_admin() is the
// real enforcement (RLS on instructor_activity_logs, and the API routes below
// re-check it server-side via lib/salary-admin-identity.ts) — this screen-
// level check only decides whether to render the "no access" message instead
// of an empty table.
//
// Approving sets the hourly rate typed into that row and hands the amount to
// every pay report as "פעילויות נוספות" (see /api/instructor/my-salary and
// /admin/coordinator/payroll). Rejecting needs no rate at all.
// ─────────────────────────────────────────────────────────────────────────────

type Log = {
  id: string
  instructor_id: string
  instructor_name: string
  activity_date: string
  activity_type: string
  activity_type_other: string | null
  description: string | null
  hours: number
  hourly_rate: number | null
  status: ActivityStatus
  created_at: string
}

type Filter = ActivityStatus | 'all'

const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })

async function authHeaders(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session ? { Authorization: `Bearer ${session.access_token}` } : null
}

export default function ActivityLogsPage() {
  const user = useCoordinator()
  const canSeeSalary = isSalaryAdmin(user?.email)

  const [filter, setFilter]   = useState<Filter>('pending')
  const [logs, setLogs]       = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [rates, setRates]     = useState<Record<string, string>>({})
  const [busyId, setBusyId]   = useState<string | null>(null)
  const [rowMsg, setRowMsg]   = useState<Record<string, string>>({})

  const load = useCallback(async (f: Filter) => {
    setLoading(true)
    setError('')
    try {
      const headers = await authHeaders()
      if (!headers) { setError('החיבור פג — יש להתחבר מחדש'); return }
      const r = await fetch(`/api/coordinator/activity-logs?status=${f}`, { headers })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(d.error ?? 'טעינת הדיווחים נכשלה'); return }
      setLogs((d.logs ?? []) as Log[])
    } catch (e) {
      setError('טעינת הדיווחים נכשלה: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user || !canSeeSalary) return
    load(filter)
  }, [user, canSeeSalary, filter, load])

  async function approve(log: Log) {
    const raw = rates[log.id] ?? ''
    const rate = Number(raw)
    if (raw.trim() === '' || !Number.isFinite(rate) || rate <= 0) {
      setRowMsg(p => ({ ...p, [log.id]: 'צריך להזין תעריף שעתי תקין' }))
      return
    }
    setBusyId(log.id)
    setRowMsg(p => ({ ...p, [log.id]: '' }))
    try {
      const headers = await authHeaders()
      if (!headers) { setRowMsg(p => ({ ...p, [log.id]: 'החיבור פג — יש להתחבר מחדש' })); return }
      const r = await fetch(`/api/coordinator/activity-logs/${log.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ hourly_rate: rate }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setRowMsg(p => ({ ...p, [log.id]: d.error ?? 'האישור נכשל' })); return }
      setLogs(p => p.filter(x => x.id !== log.id))
    } catch (e) {
      setRowMsg(p => ({ ...p, [log.id]: 'האישור נכשל: ' + (e as Error).message }))
    } finally {
      setBusyId(null)
    }
  }

  async function reject(log: Log) {
    if (!window.confirm(`לדחות את הדיווח של ${log.instructor_name} (${activityLabel(log.activity_type, log.activity_type_other)})?`)) return
    setBusyId(log.id)
    setRowMsg(p => ({ ...p, [log.id]: '' }))
    try {
      const headers = await authHeaders()
      if (!headers) { setRowMsg(p => ({ ...p, [log.id]: 'החיבור פג — יש להתחבר מחדש' })); return }
      const r = await fetch(`/api/coordinator/activity-logs/${log.id}/reject`, { method: 'POST', headers })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setRowMsg(p => ({ ...p, [log.id]: d.error ?? 'הדחייה נכשלה' })); return }
      setLogs(p => p.filter(x => x.id !== log.id))
    } catch (e) {
      setRowMsg(p => ({ ...p, [log.id]: 'הדחייה נכשלה: ' + (e as Error).message }))
    } finally {
      setBusyId(null)
    }
  }

  if (!user) return null

  if (!canSeeSalary) {
    return (
      <div dir="rtl" style={{ padding: 60, textAlign: 'center', color: '#a8a29e' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e7e5e4' }}>אין הרשאה</h1>
        <p style={{ marginTop: 8 }}>המסך הזה זמין להנהלה בלבד.</p>
      </div>
    )
  }

  const FILTERS: Array<{ id: Filter; label: string }> = [
    { id: 'pending',  label: 'ממתינות' },
    { id: 'approved', label: 'אושרו' },
    { id: 'rejected', label: 'נדחו' },
    { id: 'all',      label: 'הכול' },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>➕ פעילויות נוספות</h2>
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>דיווחי מדריכים על פעילות שאינה שיעור — צילום, תיקון אופניים וכו׳.</p>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 6 }}>
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                minHeight: 36, background: filter === f.id ? '#D4288A' : '#141716',
                color: filter === f.id ? '#fff' : '#7a8f7d',
                border: `1px solid ${filter === f.id ? '#D4288A' : '#252b27'}`,
                borderRadius: 8, padding: '6px 14px', fontFamily: 'Heebo, Arial, sans-serif',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: '#2a1414', border: '1px solid #ff808066', color: '#ff8080', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 130px 1fr 70px 130px 170px', padding: '11px 16px', borderBottom: '1px solid #252b27', fontSize: 11, color: '#7a8f7d', fontWeight: 700 }}>
          <span>מדריך</span><span>תאריך</span><span>סוג</span><span>תיאור</span><span>שעות</span><span>תעריף/שעה</span><span></span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#7a8f7d' }}>טוען...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#7a8f7d' }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>🗒️</div>
            אין דיווחים להצגה
          </div>
        ) : (
          logs.map((l, i) => (
            <div key={l.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #1a1e1c', padding: '12px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 130px 1fr 70px 130px 170px', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{l.instructor_name}</span>
                <span style={{ color: '#7a8f7d', fontSize: 13 }}>{fmtDate(l.activity_date)}</span>
                <span>
                  <span style={{ background: `${ACTIVITY_STATUS_COLOR[l.status]}22`, color: ACTIVITY_STATUS_COLOR[l.status], borderRadius: 10, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>
                    {activityLabel(l.activity_type, l.activity_type_other)}
                  </span>
                </span>
                <span style={{ color: '#c9d1cb', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.description ?? ''}>
                  {l.description || '—'}
                </span>
                <span style={{ color: '#b5e853', fontWeight: 700 }}>{l.hours}</span>

                {l.status === 'pending' ? (
                  <input
                    value={rates[l.id] ?? ''}
                    onChange={e => setRates(p => ({ ...p, [l.id]: e.target.value }))}
                    type="number" inputMode="decimal" dir="ltr" placeholder="₪ לשעה"
                    style={{ width: '100%', boxSizing: 'border-box', background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 8, color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 13, padding: '7px 10px' }}
                  />
                ) : (
                  <span style={{ color: '#4cdb7a', fontWeight: 700 }}>
                    {l.hourly_rate != null ? `₪${l.hourly_rate} · ₪${(l.hours * l.hourly_rate).toLocaleString()}` : '—'}
                  </span>
                )}

                {l.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => approve(l)}
                      disabled={busyId === l.id}
                      style={{ minHeight: 32, background: '#1f3d2a', color: '#4cdb7a', border: '1px solid #2a5a3a', borderRadius: 8, padding: '0 12px', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 12.5, cursor: busyId === l.id ? 'default' : 'pointer' }}
                    >
                      ✓ אשר
                    </button>
                    <button
                      onClick={() => reject(l)}
                      disabled={busyId === l.id}
                      style={{ minHeight: 32, background: '#3a1414', color: '#ff8080', border: '1px solid #5a2020', borderRadius: 8, padding: '0 12px', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 12.5, cursor: busyId === l.id ? 'default' : 'pointer' }}
                    >
                      ✕ דחה
                    </button>
                  </div>
                ) : (
                  <span style={{ textAlign: 'end', color: '#7a8f7d', fontSize: 12 }}>{ACTIVITY_STATUS_LABEL[l.status]}</span>
                )}
              </div>
              {rowMsg[l.id] && (
                <p style={{ margin: '8px 0 0', color: '#ff8080', fontSize: 12.5 }}>{rowMsg[l.id]}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
