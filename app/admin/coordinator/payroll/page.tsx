'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'

// ─────────────────────────────────────────────────────────────────────────────
// Monthly pay report (coordinator).
//
// Pay is computed and stored on each session when attendance is saved
// (class_sessions.present_count / instructor_pay — see lib/attendance.ts). This
// report simply reads those stored values for the selected month, so "only
// sessions with saved attendance count": we filter to present_count IS NOT NULL,
// which is set exactly when attendance is saved.
// ─────────────────────────────────────────────────────────────────────────────

const BRANCH_COLOR: Record<string, string> = {
  'משגב':  '#b5e853',
  'מצובה': '#81d4fa',
  'ביריה': '#ff8f6b',
  'אמירים': '#c084fc',
}

type SessionRow = {
  id: string
  instructor_id: string | null
  class_name: string
  branch: string
  session_date: string
  present_count: number
  instructor_pay: number | null
}
type InstructorGroup = {
  instructorId: string
  name: string
  sessions: SessionRow[]
  totalPresent: number
  totalPay: number
}

const currentYm = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function PayrollPage() {
  const user = useCoordinator()
  const [month, setMonth]       = useState(currentYm)
  const [groups, setGroups]     = useState<InstructorGroup[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const load = useCallback(async (ym: string) => {
    setLoading(true)
    const [y, m] = ym.split('-').map(Number)
    const first  = `${ym}-01`
    const last   = new Date(y, m, 0).toISOString().split('T')[0]

    // Instructor names (active + inactive, so past sessions still resolve).
    const { data: roles } = await supabase
      .from('admin_roles')
      .select('id, name')
      .eq('role', 'instructor')
    const nameOf: Record<string, string> = {}
    for (const r of roles ?? []) nameOf[r.id] = r.name

    // Only sessions with saved attendance (present_count populated on save).
    const { data: sessions } = await supabase
      .from('class_sessions')
      .select('id, instructor_id, class_name, branch, session_date, present_count, instructor_pay')
      .gte('session_date', first)
      .lte('session_date', last)
      .not('present_count', 'is', null)
      .order('session_date')

    const map: Record<string, InstructorGroup> = {}
    for (const s of (sessions ?? []) as SessionRow[]) {
      const key = s.instructor_id ?? 'unassigned'
      if (!map[key]) {
        map[key] = {
          instructorId: key,
          name: s.instructor_id ? (nameOf[s.instructor_id] ?? 'מדריך לא ידוע') : 'ללא מדריך',
          sessions: [], totalPresent: 0, totalPay: 0,
        }
      }
      map[key].sessions.push(s)
      map[key].totalPresent += s.present_count ?? 0
      map[key].totalPay     += Number(s.instructor_pay ?? 0)
    }

    setGroups(Object.values(map).sort((a, b) => b.totalPay - a.totalPay))
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) return
    load(month)
  }, [user, month, load])

  if (!user) return null

  const grandSessions = groups.reduce((s, g) => s + g.sessions.length, 0)
  const grandPresent  = groups.reduce((s, g) => s + g.totalPresent, 0)
  const grandPay      = groups.reduce((s, g) => s + g.totalPay, 0)
  const monthLabel = new Date(Number(month.split('-')[0]), Number(month.split('-')[1]) - 1, 1)
    .toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })

  const cell: React.CSSProperties = { padding: '14px 16px', fontSize: 14 }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      {/* Header + month picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>דוח שכר מדריכים</h2>
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>תשלום לפי נוכחות · {monthLabel}</p>
        </div>
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          style={{ marginRight: 'auto', background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 8, color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 13, padding: '8px 12px', outline: 'none' }}
        >
          {Array.from({ length: 12 }, (_, i) => {
            const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            return <option key={ym} value={ym}>{d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}</option>
          })}
        </select>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'מדריכים',       value: groups.length,                       color: '#c084fc', icon: '🧑‍🏫' },
          { label: 'אימונים',       value: grandSessions,                       color: '#81d4fa', icon: '🗓️' },
          { label: 'סה"כ נוכחים',   value: grandPresent,                        color: '#b5e853', icon: '🚵' },
          { label: 'סה"כ לתשלום',   value: `₪${grandPay.toLocaleString()}`,     color: '#4cdb7a', icon: '💰' },
        ].map(c => (
          <div key={c.label} style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontSize: 11, color: '#7a8f7d', marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 120px 40px', padding: '11px 16px', borderBottom: '1px solid #252b27', fontSize: 11, color: '#7a8f7d', fontWeight: 700 }}>
          <span>מדריך</span><span>אימונים</span><span>נוכחים</span><span>סה"כ לתשלום</span><span />
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#7a8f7d' }}>טוען...</div>
        ) : groups.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#7a8f7d' }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>💸</div>
            אין אימונים עם נוכחות שמורה לחודש זה
          </div>
        ) : (
          groups.map((g, gi) => {
            const open = !!expanded[g.instructorId]
            return (
              <div key={g.instructorId} style={{ borderBottom: gi < groups.length - 1 ? '1px solid #1a1e1c' : 'none' }}>
                <button
                  onClick={() => setExpanded(p => ({ ...p, [g.instructorId]: !p[g.instructorId] }))}
                  aria-expanded={open}
                  style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 90px 110px 120px 40px', alignItems: 'center', padding: '14px 16px', background: open ? '#1a1e1c' : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Heebo, Arial, sans-serif', textAlign: 'right', color: '#e8efe9' }}
                >
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{g.name}</span>
                  <span style={{ color: '#81d4fa', fontWeight: 700 }}>{g.sessions.length}</span>
                  <span style={{ color: '#b5e853', fontWeight: 700 }}>{g.totalPresent}</span>
                  <span style={{ color: '#4cdb7a', fontWeight: 900, fontSize: 16 }}>₪{g.totalPay.toLocaleString()}</span>
                  <span aria-hidden="true" style={{ color: '#7a8f7d', fontSize: 14, textAlign: 'center' }}>{open ? '▲' : '▼'}</span>
                </button>

                {open && (
                  <div style={{ background: '#0d0f0e', borderTop: '1px solid #252b27' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px 120px', padding: '9px 16px', fontSize: 11, color: '#5f6f62', fontWeight: 600 }}>
                      <span>תאריך</span><span>קבוצה</span><span>נוכחים</span><span>תשלום</span>
                    </div>
                    {g.sessions.map(s => (
                      <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px 120px', ...cell, borderTop: '1px solid #141716', alignItems: 'center' }}>
                        <span style={{ color: '#7a8f7d' }}>{new Date(s.session_date + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}</span>
                        <span>
                          <span style={{ fontWeight: 600 }}>{s.class_name}</span>
                          <span style={{ marginRight: 6, background: (BRANCH_COLOR[s.branch] ?? '#7a8f7d') + '22', color: BRANCH_COLOR[s.branch] ?? '#7a8f7d', borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>{s.branch}</span>
                        </span>
                        <span style={{ color: '#b5e853' }}>{s.present_count}</span>
                        <span style={{ color: '#4cdb7a', fontWeight: 700 }}>₪{Number(s.instructor_pay ?? 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* Grand total */}
        {!loading && groups.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 120px 40px', padding: '15px 16px', borderTop: '2px solid #252b27', background: '#1a1e1c', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>סה"כ כללי</span>
            <span style={{ color: '#81d4fa', fontWeight: 800 }}>{grandSessions}</span>
            <span style={{ color: '#b5e853', fontWeight: 800 }}>{grandPresent}</span>
            <span style={{ color: '#4cdb7a', fontWeight: 900, fontSize: 18 }}>₪{grandPay.toLocaleString()}</span>
            <span />
          </div>
        )}
      </div>
    </div>
  )
}
