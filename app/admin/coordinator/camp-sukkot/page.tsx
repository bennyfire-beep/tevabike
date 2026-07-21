'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'

type Reg = {
  id: string
  created_at: string
  rider_first_name: string
  rider_last_name: string
  birth_date: string | null
  grade: string | null
  group_name: string | null
  riding_level: string | null
  parent_name: string
  parent_phone: string
  second_parent_phone: string | null
  child_phone: string | null
  parent_email: string
  city: string | null
  health_notes: string | null
  food_notes: string | null
  total_amount: number
  payment_status: string
}

const CAPACITY = 20            // ← חייב להיות זהה למספר שב-app/api/sukkot-register/route.ts
const MIN_PARTICIPANTS = 8

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

export default function SukkotAdminPage() {
  const user = useCoordinator()
  const [regs, setRegs] = useState<Reg[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('sukkot_registrations')
      .select('*')
      .order('created_at', { ascending: false })
    setRegs((data ?? []) as Reg[])
    setLoading(false)
  }, [])

  useEffect(() => { if (user) load() }, [user, load])

  async function changeStatus(reg: Reg, payment_status: string) {
    setSavingId(reg.id)
    const { error } = await supabase.from('sukkot_registrations').update({ payment_status }).eq('id', reg.id)
    if (error) { alert(error.message); setSavingId(null); return }
    setRegs(prev => prev.map(r => r.id === reg.id ? { ...r, payment_status } : r))
    setSavingId(null)
  }

  if (!user) return null

  const active = regs.filter(r => r.payment_status !== 'cancelled')
  const paid = active.filter(r => r.payment_status === 'paid')
  const revenue = paid.reduce((s, r) => s + r.total_amount, 0)
  const pending = active.filter(r => r.payment_status === 'pending').reduce((s, r) => s + r.total_amount, 0)

  const filtered = regs.filter(r => statusFilter === 'all' || r.payment_status === statusFilter)

  const summaryText = [
    'מחנה סוכות משמר העמק — סיכום הרשמות',
    `נרשמים: ${active.length} / ${CAPACITY}`,
    `שילמו: ${paid.length}`,
    `שולם: ${revenue.toLocaleString()} ₪ · ממתין: ${pending.toLocaleString()} ₪`,
    active.length >= MIN_PARTICIPANTS ? 'עברנו את המינימום לפתיחת המחנה' : `חסרים ${MIN_PARTICIPANTS - active.length} להגעה למינימום`,
  ].join('\n')

  const csv = () => {
    const head = ['נרשם', 'רוכב', 'לידה', 'כיתה', 'קבוצה', 'רמה', 'הורה', 'טלפון', 'טלפון נוסף', 'מייל', 'ישוב', 'בריאות', 'אוכל', 'סכום', 'תשלום']
    const rows = filtered.map(r => [
      fmtDate(r.created_at), `${r.rider_first_name} ${r.rider_last_name}`, r.birth_date ?? '', r.grade ?? '',
      r.group_name ?? '', r.riding_level ?? '', r.parent_name, r.parent_phone, r.second_parent_phone ?? '',
      r.parent_email, r.city ?? '', r.health_notes ?? '', r.food_notes ?? '',
      String(r.total_amount), STATUS_LABEL[r.payment_status] ?? r.payment_status,
    ])
    const body = [head, ...rows].map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF' + body], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'מחנה-סוכות-הרשמות.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const selStyle: React.CSSProperties = {
    background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 8, color: '#e8efe9',
    fontFamily: 'Heebo, Arial, sans-serif', fontSize: 13, padding: '7px 12px', outline: 'none',
  }
  const btnStyle: React.CSSProperties = {
    background: '#1a2114', color: '#b5e853', border: '1px solid #2f4020', borderRadius: 8,
    padding: '7px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none',
    fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer',
  }
  const th: React.CSSProperties = { textAlign: 'right', padding: '10px 12px', color: '#7a8f7d', fontSize: 12, fontWeight: 700, borderBottom: '1px solid #252b27', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '12px', borderBottom: '1px solid #1c211e', fontSize: 13, verticalAlign: 'top' }

  const card = (title: string, value: string, sub?: string, color = '#e8efe9', border = '#252b27') => (
    <div style={{ background: '#141716', border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ color: '#7a8f7d', fontSize: 12, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#7a8f7d' }}>{sub}</div>}
    </div>
  )

  const full = active.length >= CAPACITY
  const gotMin = active.length >= MIN_PARTICIPANTS

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>מחנה סוכות · משמר העמק</h2>
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>
            27.09–01.10 · {loading ? 'טוען...' : `${filtered.length} הרשמות`}
          </p>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={csv} style={btnStyle}>ייצוא לאקסל</button>
          <a href={waLink('0505358071', summaryText)} target="_blank" rel="noopener noreferrer" style={btnStyle}>
            שליחת סיכום לטל
          </a>
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
        {card('נרשמים', `${active.length} / ${CAPACITY}`, full ? 'מלא' : `נותרו ${CAPACITY - active.length}`, full ? '#f87171' : '#e8efe9', full ? '#7f2d2d' : '#252b27')}
        {card('מינימום לפתיחה', `${active.length} / ${MIN_PARTICIPANTS}`, gotMin ? 'המחנה יוצא לדרך' : `חסרים ${MIN_PARTICIPANTS - active.length}`, gotMin ? '#b5e853' : '#fbbf24', gotMin ? '#2f4020' : '#5a4a14')}
        {card('שילמו', String(paid.length), `מתוך ${active.length}`, '#b5e853')}
        <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: 16 }}>
          <div style={{ color: '#7a8f7d', fontSize: 12, marginBottom: 4 }}>שולם</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#b5e853' }}>{revenue.toLocaleString()} ₪</div>
          <div style={{ fontSize: 12, color: '#fbbf24' }}>ממתין: {pending.toLocaleString()} ₪</div>
        </div>
      </div>

      {/* טבלה */}
      <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
          <thead>
            <tr>
              <th style={th}>רוכב</th>
              <th style={th}>כיתה / רמה</th>
              <th style={th}>הורה</th>
              <th style={th}>ישוב</th>
              <th style={th}>בריאות</th>
              <th style={th}>אוכל</th>
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
                  <td style={{ ...td, color: '#7a8f7d', whiteSpace: 'nowrap' }}>
                    <div>{r.grade || '—'}</div>
                    <div style={{ fontSize: 12 }}>{r.riding_level || ''}</div>
                    <div style={{ fontSize: 11 }}>{r.birth_date || ''}</div>
                  </td>
                  <td style={td}>
                    <div>{r.parent_name}</div>
                    <a href={waLink(r.parent_phone, `היי ${r.parent_name}, זה בני מטבע בייק לגבי מחנה סוכות`)}
                      target="_blank" rel="noopener noreferrer" style={{ color: '#b5e853', fontSize: 12, textDecoration: 'none' }}>
                      {r.parent_phone}
                    </a>
                    {r.second_parent_phone && <div style={{ color: '#7a8f7d', fontSize: 11 }}>{r.second_parent_phone}</div>}
                    <div style={{ color: '#7a8f7d', fontSize: 11 }}>{r.parent_email}</div>
                  </td>
                  <td style={{ ...td, color: '#7a8f7d' }}>{r.city || '—'}</td>
                  <td style={{ ...td, maxWidth: 170, color: r.health_notes ? '#fbbf24' : '#7a8f7d' }}>{r.health_notes || '—'}</td>
                  <td style={{ ...td, maxWidth: 150, color: r.food_notes ? '#81d4fa' : '#7a8f7d' }}>{r.food_notes || '—'}</td>
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
            עדיין אין הרשמות למחנה סוכות.
          </div>
        )}
      </div>
    </div>
  )
}
