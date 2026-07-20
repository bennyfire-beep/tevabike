'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'

type Reg = {
  id: string
  created_at: string
  full_name: string
  phone: string
  email: string | null
  branch: string | null
  class_type: string | null
  registration_type: string | null
  child_name: string | null
  child_age: number | null
  notes: string | null
  status: string
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'חדש',
  contacted: 'יצרנו קשר',
  joined: 'הצטרף',
  closed: 'לא רלוונטי',
}
const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  pending:   { bg: '#3a2f14', fg: '#fbbf24' },
  contacted: { bg: '#1a2637', fg: '#81d4fa' },
  joined:    { bg: '#1a2114', fg: '#b5e853' },
  closed:    { bg: '#2a2a2a', fg: '#8a8a8a' },
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })

const waLink = (phone: string, text: string) => {
  const clean = phone.replace(/\D/g, '').replace(/^0/, '972')
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`
}

export default function RegistrationsPage() {
  const user = useCoordinator()
  const [regs, setRegs] = useState<Reg[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false })
    setRegs((data ?? []) as Reg[])
    setLoading(false)
  }, [])

  useEffect(() => { if (user) load() }, [user, load])

  async function changeStatus(reg: Reg, status: string) {
    setSavingId(reg.id)
    const { error } = await supabase.from('registrations').update({ status }).eq('id', reg.id)
    if (error) { alert(error.message); setSavingId(null); return }
    setRegs(prev => prev.map(r => r.id === reg.id ? { ...r, status } : r))
    setSavingId(null)
  }

  if (!user) return null

  const filtered = regs.filter(r => statusFilter === 'all' || r.status === statusFilter)
  const newCount = regs.filter(r => r.status === 'pending').length

  const selStyle: React.CSSProperties = {
    background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 8, color: '#e8efe9',
    fontFamily: 'Heebo, Arial, sans-serif', fontSize: 13, padding: '7px 12px', outline: 'none',
  }
  const th: React.CSSProperties = { textAlign: 'right', padding: '10px 12px', color: '#7a8f7d', fontSize: 12, fontWeight: 700, borderBottom: '1px solid #252b27', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '12px', borderBottom: '1px solid #1c211e', fontSize: 13, verticalAlign: 'top' }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>הרשמות מהאתר</h2>
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>
            {loading ? 'טוען...' : `${filtered.length} הרשמות${newCount ? ` · ${newCount} חדשות` : ''}`}
          </p>
        </div>
        <label style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 6, color: '#7a8f7d', fontSize: 12 }}>
          סטטוס
          <select aria-label="סינון לפי סטטוס" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selStyle}>
            <option value="all">הכל</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>

      <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
          <thead>
            <tr>
              <th style={th}>נרשם</th>
              <th style={th}>חוג / סניף</th>
              <th style={th}>ילד</th>
              <th style={th}>הערות</th>
              <th style={th}>סטטוס</th>
              <th style={th}>נרשם ב</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const color = STATUS_COLOR[r.status] ?? STATUS_COLOR.pending
              return (
                <tr key={r.id} style={{ opacity: savingId === r.id ? 0.5 : 1 }}>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{r.full_name}</div>
                    <a href={waLink(r.phone, `היי ${r.full_name}, זה בני מטבע בייק לגבי ההרשמה שלך`)}
                      target="_blank" rel="noopener noreferrer"
                      style={{ color: '#b5e853', fontSize: 12, textDecoration: 'none' }}>
                      {r.phone}
                    </a>
                    {r.email && <div style={{ color: '#7a8f7d', fontSize: 11 }}>{r.email}</div>}
                  </td>
                  <td style={td}>
                    <div>{r.class_type || '—'}</div>
                    <div style={{ color: '#7a8f7d', fontSize: 12 }}>{r.branch || '—'}</div>
                  </td>
                  <td style={td}>
                    {r.child_name
                      ? <>{r.child_name}{r.child_age ? <span style={{ color: '#7a8f7d' }}> · {r.child_age}</span> : null}</>
                      : <span style={{ color: '#7a8f7d' }}>—</span>}
                  </td>
                  <td style={{ ...td, maxWidth: 220, color: r.notes ? '#e8efe9' : '#7a8f7d' }}>{r.notes || '—'}</td>
                  <td style={td}>
                    <select
                      aria-label="סטטוס הרשמה"
                      value={r.status}
                      onChange={e => changeStatus(r, e.target.value)}
                      style={{ ...selStyle, background: color.bg, color: color.fg, border: 'none', fontWeight: 700 }}
                    >
                      {Object.entries(STATUS_LABEL).map(([k, v]) =>
                        <option key={k} value={k} style={{ background: '#0d0f0e', color: '#e8efe9' }}>{v}</option>)}
                    </select>
                  </td>
                  <td style={{ ...td, color: '#7a8f7d', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {!loading && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#7a8f7d', fontSize: 14 }}>
            אין הרשמות שמתאימות לסינון.
          </div>
        )}
      </div>
    </div>
  )
}
