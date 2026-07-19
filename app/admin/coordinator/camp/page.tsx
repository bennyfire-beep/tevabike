'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'

type Reg = {
  id: string
  created_at: string
  rider_first_name: string
  rider_last_name: string
  group_name: string | null
  parent_name: string
  parent_phone: string
  child_phone: string | null
  parent_email: string
  city: string | null
  health_notes: string | null
  days: string[]
  days_count: number
  total_amount: number
  payment_status: string
}

const DAY_LABEL: Record<string, string> = { yaad: 'יעד 16.8', yarden: 'ירדן 18.8', misgav: 'משגב 20.8' }
const DAY_IDS = ['yaad', 'yarden', 'misgav']
const CAPACITY: Record<string, number | null> = { yaad: 16, yarden: null, misgav: null }

const STATUS_LABEL: Record<string, string> = { pending: 'ממתין לתשלום', paid: 'שולם', cancelled: 'בוטל' }
const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  pending:   { bg: '#3a2f14', fg: '#fbbf24' },
  paid:      { bg: '#1a2114', fg: '#b5e853' },
  cancelled: { bg: '#3a1a1a', fg: '#f87171' },
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })

const waLink = (phone: string, text: string) => {
  const clean = phone.replace(/\D/g, '').replace(/^0/, '972')
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`
}

export default function CampAdminPage() {
  const user = useCoordinator()
  const [regs, setRegs] = useState<Reg[]>([])
  const [loading, setLoading] = useState(true)
  const [dayFilter, setDayFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('camp_registrations')
      .select('*')
      .order('created_at', { ascending: false })
    setRegs((data ?? []) as Reg[])
    setLoading(false)
  }, [])

  useEffect(() => { if (user) load() }, [user, load])

  async function changeStatus(reg: Reg, payment_status: string) {
    setSavingId(reg.id)
    const { error } = await supabase.from('camp_registrations').update({ payment_status }).eq('id', reg.id)
    if (error) { alert(error.message); setSavingId(null); return }
    setRegs(prev => prev.map(r => r.id === reg.id ? { ...r, payment_status } : r))
    setSavingId(null)
  }

  if (!user) return null

  const active = regs.filter(r => r.payment_status !== 'cancelled')
  const countFor = (d: string) => active.filter(r => r.days?.includes(d)).length

  const filtered = regs.filter(r =>
    (dayFilter === 'all' || r.days?.includes(dayFilter)) &&
    (statusFilter === 'all' || r.payment_status === statusFilter),
  )

  const revenue = active.filter(r => r.payment_status === 'paid').reduce((s, r) => s + r.total_amount, 0)
  const pending = active.filter(r => r.payment_status === 'pending').reduce((s, r) => s + r.total_amount, 0)

  const summaryText = [
    'ימי שיא — סיכום הרשמות',
    ...DAY_IDS.map(d => {
      const cap = CAPACITY[d]
      return `${DAY_LABEL[d]}: ${countFor(d)}${cap ? `/${cap}` : ''}`
    }),
    `סה"כ נרשמים: ${active.length}`,
    `שולם: ${revenue} ₪ · ממתין: ${pending} ₪`,
  ].join('\n')

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
          <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>ימי שיא</h2>
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>
            {loading ? 'טוען...' : `${filtered.length} הרשמות`}
          </p>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <a href={waLink('0505358071', summaryText)} target="_blank" rel="noopener noreferrer"
            style={{ background: '#1a2114', color: '#b5e853', border: '1px solid #2f4020', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            שליחת סיכום לטל
          </a>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7a8f7d', fontSize: 12 }}>
            יום
            <select aria-label="סינון לפי יום" value={dayFilter} onChange={e => setDayFilter(e.target.value)} style={selStyle}>
              <option value="all">הכל</option>
              {DAY_IDS.map(d => <option key={d} value={d}>{DAY_LABEL[d]}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7a8f7d', fontSize: 12 }}>
            תשלום
            <select aria-label="סינון לפי סטטוס תשלום" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selStyle}>
              <option value="all">הכל</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* כרטיסי סיכום */}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', marginBottom: 24 }}>
        {DAY_IDS.map(d => {
          const n = countFor(d)
          const cap = CAPACITY[d]
          const full = cap !== null && n >= cap
          return (
            <div key={d} style={{ background: '#141716', border: `1px solid ${full ? '#7f2d2d' : '#252b27'}`, borderRadius: 12, padding: 16 }}>
              <div style={{ color: '#7a8f7d', fontSize: 12, marginBottom: 4 }}>{DAY_LABEL[d]}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: full ? '#f87171' : '#e8efe9' }}>
                {n}{cap !== null && <span style={{ fontSize: 15, color: '#7a8f7d' }}> / {cap}</span>}
              </div>
              {cap !== null && <div style={{ fontSize: 12, color: full ? '#f87171' : '#7a8f7d' }}>{full ? 'מלא' : `נותרו ${cap - n}`}</div>}
            </div>
          )
        })}
        <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: 16 }}>
          <div style={{ color: '#7a8f7d', fontSize: 12, marginBottom: 4 }}>שולם</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#b5e853' }}>{revenue.toLocaleString()} ₪</div>
          <div style={{ fontSize: 12, color: '#fbbf24' }}>ממתין: {pending.toLocaleString()} ₪</div>
        </div>
      </div>

      {/* טבלה */}
      <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
          <thead>
            <tr>
              <th style={th}>רוכב</th>
              <th style={th}>ימים</th>
              <th style={th}>הורה</th>
              <th style={th}>ישוב</th>
              <th style={th}>בריאות</th>
              <th style={th}>סכום</th>
              <th style={th}>תשלום</th>
              <th style={th}>נרשם</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const color = STATUS_COLOR[r.payment_status] ?? STATUS_COLOR.pending
              return (
                <tr key={r.id} style={{ opacity: savingId === r.id ? 0.5 : 1 }}>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{r.rider_first_name} {r.rider_last_name}</div>
                    {r.group_name && <div style={{ color: '#7a8f7d', fontSize: 12 }}>{r.group_name}</div>}
                    {r.child_phone && <div style={{ color: '#7a8f7d', fontSize: 12 }}>{r.child_phone}</div>}
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {(r.days ?? []).map(d => (
                        <span key={d} style={{ background: '#1a2637', color: '#81d4fa', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {DAY_LABEL[d] ?? d}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={td}>
                    <div>{r.parent_name}</div>
                    <a href={waLink(r.parent_phone, `היי ${r.parent_name}, זה בני מטבע בייק לגבי ימי השיא`)}
                      target="_blank" rel="noopener noreferrer" style={{ color: '#b5e853', fontSize: 12, textDecoration: 'none' }}>
                      {r.parent_phone}
                    </a>
                    <div style={{ color: '#7a8f7d', fontSize: 11 }}>{r.parent_email}</div>
                  </td>
                  <td style={{ ...td, color: '#7a8f7d' }}>{r.city || '—'}</td>
                  <td style={{ ...td, maxWidth: 180, color: r.health_notes ? '#fbbf24' : '#7a8f7d' }}>{r.health_notes || '—'}</td>
                  <td style={{ ...td, fontWeight: 700, whiteSpace: 'nowrap' }}>{r.total_amount} ₪</td>
                  <td style={td}>
                    <select
                      aria-label="סטטוס תשלום"
                      value={r.payment_status}
                      onChange={e => changeStatus(r, e.target.value)}
                      style={{ ...selStyle, background: color.bg, color: color.fg, border: 'none', fontWeight: 700 }}
                    >
                      {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k} style={{ background: '#0d0f0e', color: '#e8efe9' }}>{v}</option>)}
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
