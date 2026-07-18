'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'
import { DEFAULT_HOURLY_RATE } from '@/lib/attendance'

// ─────────────────────────────────────────────────────────────────────────────
// Monthly pay report (coordinator).
//
// A person's monthly pay is the sum of three kinds of line item:
//   • בסיס חודשי  — admin_roles.monthly_base (once per month, if > 0)
//   • regular sessions — class_sessions.instructor_pay (pay_rates × multiplier)
//   • special activities — duration × the instructor's hourly_rate (per instructor)
//
// Rows are merged BY NAME, because one person can have two admin_roles rows
// (e.g. a coordinator row carrying monthly_base + an instructor row that teaches
// sessions). "Only sessions with saved attendance count": present_count IS NOT
// NULL, set when attendance is saved.
// ─────────────────────────────────────────────────────────────────────────────

const BRANCH_COLOR: Record<string, string> = {
  'משגב':  '#b5e853',
  'מצובה': '#81d4fa',
  'ביריה': '#ff8f6b',
  'אמירים': '#c084fc',
}

type Role = { id: string; name: string; hourly_rate: number | null; monthly_base: number | null; role: string }
type SessionRow = {
  id: string
  instructor_id: string | null
  class_name: string
  branch: string | null
  session_date: string
  present_count: number
  instructor_pay: number | null
  type: 'regular' | 'special' | null
  activity_name: string | null
  instructor_ids: string[] | null
  duration: number | null
}
type Kind = 'regular' | 'special' | 'base'
type LineItem = {
  key: string
  name: string
  kind: Kind
  label: string
  branch: string | null
  date: string | null
  present: number | null
  pay: number
}
type PersonGroup = {
  name: string
  items: LineItem[]
  sessionCount: number
  totalPresent: number
  totalPay: number
}

const currentYm = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const ymLabel = (ym: string) =>
  new Date(Number(ym.split('-')[0]), Number(ym.split('-')[1]) - 1, 1)
    .toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
const round2 = (n: number) => Math.round(n * 100) / 100

export default function PayrollPage() {
  const user = useCoordinator()
  const [month, setMonth]       = useState(currentYm)
  const [groups, setGroups]     = useState<PersonGroup[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [emailing, setEmailing] = useState(false)
  const [emailMsg, setEmailMsg] = useState('')

  const load = useCallback(async (ym: string) => {
    setLoading(true)
    setEmailMsg('')
    const [y, m] = ym.split('-').map(Number)
    const first  = `${ym}-01`
    const last   = new Date(y, m, 0).toISOString().split('T')[0]

    // Staff: names, hourly rates (default 90) and monthly base for every role.
    const { data: roles } = await supabase
      .from('admin_roles')
      .select('id, name, hourly_rate, monthly_base, role')
    const roleRows = (roles ?? []) as Role[]
    const nameOf: Record<string, string> = {}
    const rateOf: Record<string, number> = {}
    for (const r of roleRows) {
      nameOf[r.id] = r.name
      rateOf[r.id] = r.hourly_rate == null ? DEFAULT_HOURLY_RATE : Number(r.hourly_rate)
    }

    // Only sessions with saved attendance (present_count populated on save).
    const { data: sessions } = await supabase
      .from('class_sessions')
      .select('id, instructor_id, class_name, branch, session_date, present_count, instructor_pay, type, activity_name, instructor_ids, duration')
      .gte('session_date', first)
      .lte('session_date', last)
      .not('present_count', 'is', null)
      .order('session_date')

    const items: LineItem[] = []

    // Session line items (special sessions expand to one item per instructor).
    for (const s of (sessions ?? []) as SessionRow[]) {
      if (s.type === 'special') {
        const iids = (s.instructor_ids && s.instructor_ids.length)
          ? s.instructor_ids
          : (s.instructor_id ? [s.instructor_id] : [])
        for (const iid of iids) {
          items.push({
            key: s.id + iid, name: nameOf[iid] ?? 'מדריך לא ידוע', kind: 'special',
            label: s.activity_name ?? s.class_name, branch: s.branch, date: s.session_date,
            present: s.present_count ?? 0, pay: round2(Number(s.duration ?? 0) * (rateOf[iid] ?? DEFAULT_HOURLY_RATE)),
          })
        }
      } else {
        items.push({
          key: s.id, name: s.instructor_id ? (nameOf[s.instructor_id] ?? 'מדריך לא ידוע') : 'ללא מדריך',
          kind: 'regular', label: s.class_name, branch: s.branch, date: s.session_date,
          present: s.present_count ?? 0, pay: Number(s.instructor_pay ?? 0),
        })
      }
    }

    // Monthly base line items (one per admin_roles row with monthly_base > 0).
    for (const r of roleRows) {
      const base = Number(r.monthly_base ?? 0)
      if (base > 0) {
        items.push({ key: 'base-' + r.id, name: r.name, kind: 'base', label: 'בסיס חודשי', branch: null, date: null, present: null, pay: base })
      }
    }

    // Merge by name.
    const map: Record<string, PersonGroup> = {}
    for (const it of items) {
      if (!map[it.name]) map[it.name] = { name: it.name, items: [], sessionCount: 0, totalPresent: 0, totalPay: 0 }
      const g = map[it.name]
      g.items.push(it)
      g.totalPay += it.pay
      if (it.kind !== 'base') { g.sessionCount++; g.totalPresent += it.present ?? 0 }
    }
    for (const g of Object.values(map)) {
      g.items.sort((a, b) => {
        if (a.kind === 'base' && b.kind !== 'base') return -1
        if (b.kind === 'base' && a.kind !== 'base') return 1
        return (a.date ?? '').localeCompare(b.date ?? '')
      })
      g.totalPay = round2(g.totalPay)
    }

    setGroups(Object.values(map).sort((a, b) => b.totalPay - a.totalPay))
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) return
    load(month)
  }, [user, month, load])

  const grandSessions = groups.reduce((s, g) => s + g.sessionCount, 0)
  const grandPresent  = groups.reduce((s, g) => s + g.totalPresent, 0)
  const grandPay      = round2(groups.reduce((s, g) => s + g.totalPay, 0))
  const monthLabel = ymLabel(month)

  async function emailReport() {
    setEmailing(true); setEmailMsg('')
    const payload = {
      month, monthLabel,
      grand: { sessions: grandSessions, present: grandPresent, pay: grandPay },
      groups: groups.map(g => ({
        name: g.name,
        totalSessions: g.sessionCount,
        totalPresent: g.totalPresent,
        totalPay: g.totalPay,
        items: g.items.map(it => ({
          date: it.date, label: it.label,
          isSpecial: it.kind === 'special', isBase: it.kind === 'base',
          present: it.present, pay: it.pay,
        })),
      })),
    }
    try {
      const r = await fetch('/api/payroll/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.ok) {
        setEmailMsg(`✓ הדוח נשלח ל־${(d.recipients ?? []).join(', ') || 'הנמענים'}`)
      } else if (d.reason === 'no_email_service') {
        const lines = groups.map(g => `${g.name}: ₪${g.totalPay.toLocaleString()}`)
        const body = `דוח שכר — ${monthLabel}\n\n${lines.join('\n')}\n\nסה"כ לתשלום: ₪${grandPay.toLocaleString()}`
        window.location.href = `mailto:bennyfire@gmail.com,shirkobi8@gmail.com?subject=${encodeURIComponent('דוח שכר — ' + monthLabel)}&body=${encodeURIComponent(body)}`
        setEmailMsg('שירות המייל אינו מוגדר — נפתח מייל ידני')
      } else {
        setEmailMsg('שגיאה בשליחה: ' + (d.error ?? r.statusText))
      }
    } catch (e) {
      setEmailMsg('שגיאה בשליחה: ' + (e as Error).message)
    } finally {
      setEmailing(false)
    }
  }

  if (!user) return null

  const cell: React.CSSProperties = { padding: '14px 16px', fontSize: 14 }
  const disabledEmail = emailing || loading || groups.length === 0

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      {/* Header + email + month picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>דוח שכר</h2>
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>בסיס חודשי · שיעורים · פעילויות מיוחדות — {monthLabel}</p>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {emailMsg && <span style={{ color: emailMsg.startsWith('✓') ? '#4cdb7a' : '#f9a8d4', fontSize: 12, fontWeight: 600 }}>{emailMsg}</span>}
          <button
            onClick={emailReport}
            disabled={disabledEmail}
            aria-label="שלח את הדוח החודשי למייל"
            style={{ minHeight: 40, background: disabledEmail ? '#2a2233' : '#D4288A', color: disabledEmail ? '#8a7fa5' : '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 13, cursor: disabledEmail ? 'default' : 'pointer', boxShadow: disabledEmail ? 'none' : '0 4px 14px rgba(212,40,138,0.3)' }}
          >
            {emailing ? 'שולח...' : '✉️ שלח דוח למייל'}
          </button>
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            aria-label="בחר חודש"
            style={{ background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 8, color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 13, padding: '8px 12px', outline: 'none' }}
          >
            {Array.from({ length: 12 }, (_, i) => {
              const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
              const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
              return <option key={ym} value={ym}>{ymLabel(ym)}</option>
            })}
          </select>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'אנשי צוות',     value: groups.length,                       color: '#c084fc', icon: '🧑‍🏫' },
          { label: 'פעילויות',      value: grandSessions,                       color: '#81d4fa', icon: '🗓️' },
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
          <span>שם</span><span>פעילויות</span><span>נוכחים</span><span>סה"כ לתשלום</span><span />
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#7a8f7d' }}>טוען...</div>
        ) : groups.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#7a8f7d' }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>💸</div>
            אין נתוני שכר לחודש זה
          </div>
        ) : (
          groups.map((g, gi) => {
            const open = !!expanded[g.name]
            return (
              <div key={g.name} style={{ borderBottom: gi < groups.length - 1 ? '1px solid #1a1e1c' : 'none' }}>
                <button
                  onClick={() => setExpanded(p => ({ ...p, [g.name]: !p[g.name] }))}
                  aria-expanded={open}
                  style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 90px 110px 120px 40px', alignItems: 'center', padding: '14px 16px', background: open ? '#1a1e1c' : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Heebo, Arial, sans-serif', textAlign: 'right', color: '#e8efe9' }}
                >
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{g.name}</span>
                  <span style={{ color: '#81d4fa', fontWeight: 700 }}>{g.sessionCount}</span>
                  <span style={{ color: '#b5e853', fontWeight: 700 }}>{g.totalPresent}</span>
                  <span style={{ color: '#4cdb7a', fontWeight: 900, fontSize: 16 }}>₪{g.totalPay.toLocaleString()}</span>
                  <span aria-hidden="true" style={{ color: '#7a8f7d', fontSize: 14, textAlign: 'center' }}>{open ? '▲' : '▼'}</span>
                </button>

                {open && (
                  <div style={{ background: '#0d0f0e', borderTop: '1px solid #252b27' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px 120px', padding: '9px 16px', fontSize: 11, color: '#5f6f62', fontWeight: 600 }}>
                      <span>תאריך</span><span>פריט</span><span>נוכחים</span><span>תשלום</span>
                    </div>
                    {g.items.map(it => (
                      <div key={it.key} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px 120px', ...cell, borderTop: '1px solid #141716', alignItems: 'center' }}>
                        <span style={{ color: '#7a8f7d' }}>{it.date ? new Date(it.date + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }) : '—'}</span>
                        <span>
                          <span style={{ fontWeight: 600 }}>{it.label}</span>
                          {it.kind === 'base'
                            ? <span style={{ marginRight: 6, background: '#f0b90b22', color: '#f0b90b', borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>💼 קבוע</span>
                            : it.kind === 'special'
                              ? <span style={{ marginRight: 6, background: '#c084fc22', color: '#c084fc', borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>★ מיוחדת</span>
                              : it.branch && <span style={{ marginRight: 6, background: (BRANCH_COLOR[it.branch] ?? '#7a8f7d') + '22', color: BRANCH_COLOR[it.branch] ?? '#7a8f7d', borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>{it.branch}</span>}
                        </span>
                        <span style={{ color: '#b5e853' }}>{it.present ?? '—'}</span>
                        <span style={{ color: '#4cdb7a', fontWeight: 700 }}>₪{it.pay.toLocaleString()}</span>
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
