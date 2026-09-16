'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'
import { downloadCsv } from '@/lib/csv-export'
import WhatsappOptinBadge from '@/components/WhatsappOptinBadge'

// ============================================================
// יום הקפצות (משגב-יעד, יום שישי) — ניהול ההרשמות
// נתיב: app/admin/coordinator/hakpatzot/page.tsx
// טופס ציבורי: app/hakpatzot/page.tsx · API: app/api/hakpatzot/route.ts
// ============================================================

type Reg = {
  id: string
  created_at: string
  first_name: string
  last_name: string
  phone: string
  group_type: string
  area: string
  consent: boolean
  status: string
  whatsapp_optin: boolean | null
  whatsapp_optin_at: string | null
}

const CAPACITY = 15 // ← חייב להיות זהה למספר שב-app/api/hakpatzot/route.ts

const GROUP_LABEL: Record<string, string> = { mini: 'מיני גרביטי', full: 'גרביטי' }
const AREA_LABEL: Record<string, string> = { misgav: 'משגב', mata_asher: 'מטה אשר', biriya: 'ביריה' }
const STATUS_LABEL: Record<string, string> = { pending: 'ממתין לתשלום', paid: 'שולם', cancelled: 'בוטל' }
const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#3a2f14', fg: '#fbbf24' },
  paid: { bg: '#1a2114', fg: '#b5e853' },
  cancelled: { bg: '#3a1a1a', fg: '#f87171' },
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })

const waLink = (phone: string, text: string) => {
  const clean = phone.replace(/\D/g, '').replace(/^0/, '972')
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`
}

export default function HakpatzotAdminPage() {
  const user = useCoordinator()
  const [regs, setRegs] = useState<Reg[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('hakpatzot_registrations')
      .select('*')
      .order('created_at', { ascending: true })
    setRegs((data ?? []) as Reg[])
    setLoading(false)
  }, [])

  useEffect(() => { if (user) load() }, [user, load])

  async function changeStatus(reg: Reg, status: string) {
    setSavingId(reg.id)
    const { error } = await supabase.from('hakpatzot_registrations').update({ status }).eq('id', reg.id)
    if (error) { alert(error.message); setSavingId(null); return }
    setRegs(prev => prev.map(r => r.id === reg.id ? { ...r, status } : r))
    setSavingId(null)
  }

  if (!user) return null

  const active = regs.filter(r => r.status !== 'cancelled')
  const paid = active.filter(r => r.status === 'paid')
  const full = active.length >= CAPACITY

  const filtered = regs.filter(r => statusFilter === 'all' || r.status === statusFilter)

  const csv = () => {
    const head = ['נרשם', 'שם פרטי', 'שם משפחה', 'טלפון', 'קבוצה', 'אזור', 'תשלום']
    const rows = filtered.map(r => [
      fmtDate(r.created_at), r.first_name, r.last_name, r.phone,
      GROUP_LABEL[r.group_type] ?? r.group_type, AREA_LABEL[r.area] ?? r.area,
      STATUS_LABEL[r.status] ?? r.status,
    ])
    downloadCsv('הקפצות-הרשמות.csv', head, rows)
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

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>יום הקפצות · משגב-יעד</h2>
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>
            יום שישי · {loading ? 'טוען...' : `${filtered.length} הרשמות`}
          </p>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={csv} style={btnStyle}>ייצוא לאקסל</button>
          <a href="/hakpatzot" target="_blank" rel="noopener noreferrer" style={btnStyle}>פתיחת הטופס הציבורי</a>
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
        {card('שילמו', String(paid.length), `מתוך ${active.length}`, '#b5e853')}
        {card('ממתינים לתשלום', String(active.length - paid.length), undefined, '#fbbf24')}
      </div>

      {/* טבלה */}
      <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr>
              <th style={th}>רוכב</th>
              <th style={th}>קבוצה</th>
              <th style={th}>אזור</th>
              <th style={th}>תשלום</th>
              <th style={th}>וואטסאפ</th>
              <th style={th}>נרשם</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const color = STATUS_COLOR[r.status] ?? STATUS_COLOR.pending
              return (
                <tr key={r.id} style={{ opacity: savingId === r.id ? 0.5 : 1 }}>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{r.first_name} {r.last_name}</div>
                    <a href={waLink(r.phone, `היי ${r.first_name}, זה בני מטבע בייק לגבי יום ההקפצות`)}
                      target="_blank" rel="noopener noreferrer" style={{ color: '#b5e853', fontSize: 12, textDecoration: 'none' }}>
                      {r.phone}
                    </a>
                  </td>
                  <td style={{ ...td, color: '#7a8f7d' }}>{GROUP_LABEL[r.group_type] ?? r.group_type}</td>
                  <td style={{ ...td, color: '#7a8f7d' }}>{AREA_LABEL[r.area] ?? r.area}</td>
                  <td style={td}>
                    <select
                      aria-label="סטטוס תשלום"
                      value={r.status}
                      onChange={e => changeStatus(r, e.target.value)}
                      style={{ ...selStyle, background: color.bg, color: color.fg, border: 'none', fontWeight: 700 }}
                    >
                      {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k} style={{ background: '#0d0f0e', color: '#e8efe9' }}>{v}</option>)}
                    </select>
                  </td>
                  <td style={td}><WhatsappOptinBadge optedIn={r.whatsapp_optin} optedAt={r.whatsapp_optin_at} /></td>
                  <td style={{ ...td, color: '#7a8f7d', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {!loading && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#7a8f7d', fontSize: 14 }}>
            עדיין אין הרשמות ליום ההקפצות.
          </div>
        )}
      </div>
    </div>
  )
}
