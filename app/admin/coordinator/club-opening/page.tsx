'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'
import { downloadCsv } from '@/lib/csv-export'
import WhatsappOptinBadge from '@/components/WhatsappOptinBadge'
import {
  EVENT_DATE, EVENT_DATE_LABEL, LOCATION, PARTICIPATION, PARTICIPATION_LABEL, GROUPS, FOOD, FOOD_LABEL,
} from '@/lib/club-opening'

// ============================================================
// חנוכת מועדון — ניהול ההרשמות (lib/club-opening.ts)
// נתיב: app/admin/coordinator/club-opening/page.tsx
// טופס ציבורי: app/hanukat-moadon/page.tsx · API: app/api/club-opening/route.ts
// ============================================================

type Reg = {
  id: string
  created_at: string
  event_date: string
  participation: string
  group_name: string
  contact_name: string
  phone: string
  rider_names: string | null
  riders_count: number
  attendees: number
  bringing: string[]
  bringing_other: string | null
  notes: string | null
  whatsapp_optin: boolean | null
  whatsapp_optin_at: string | null
}

const ALL = 'all'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })

const waLink = (phone: string, text: string) => {
  const clean = phone.replace(/\D/g, '').replace(/^0/, '972')
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`
}

const foodText = (r: Reg) =>
  (r.bringing ?? []).map(f => FOOD_LABEL[f] ?? f).join(', ') + (r.bringing_other ? ` (${r.bringing_other})` : '')

export default function ClubOpeningAdminPage() {
  const user = useCoordinator()
  const [regs, setRegs] = useState<Reg[]>([])
  const [loading, setLoading] = useState(true)
  const [groupFilter, setGroupFilter] = useState(ALL)
  const [partFilter, setPartFilter] = useState(ALL)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // loading starts true and this runs once — no synchronous setState in the effect.
  const load = useCallback(async () => {
    const { data } = await supabase
      .from('club_opening_registrations')
      .select('*')
      .eq('event_date', EVENT_DATE)
      .order('created_at', { ascending: true })
    setRegs((data ?? []) as Reg[])
    setLoading(false)
  }, [])

  useEffect(() => { if (user) load() }, [user, load])

  async function remove(reg: Reg) {
    if (!confirm(`למחוק את ${reg.contact_name}?`)) return
    setDeletingId(reg.id)
    const { error } = await supabase.from('club_opening_registrations').delete().eq('id', reg.id)
    if (error) { alert(error.message); setDeletingId(null); return }
    setRegs(prev => prev.filter(r => r.id !== reg.id))
    setDeletingId(null)
  }

  if (!user) return null

  const filtered = regs.filter(r =>
    (groupFilter === ALL || r.group_name === groupFilter) &&
    (partFilter === ALL || r.participation === partFilter)
  )

  const people = regs.reduce((s, r) => s + (r.attendees ?? 0), 0)
  const riders = regs.reduce((s, r) => s + (r.riders_count ?? 0), 0)
  const byPart = (v: string) => regs.filter(r => r.participation === v)
  const byGroup = (g: string) => regs.filter(r => r.group_name === g)
  const foodCount = (f: string) => regs.filter(r => (r.bringing ?? []).includes(f)).length

  const csv = () => {
    const head = ['נרשם', 'שם', 'טלפון', 'קבוצה', 'השתתפות', 'רוכבים בתחרות', 'שמות רוכבים', 'מגיעים', 'מביאים', 'הערות']
    const rows = filtered.map(r => [
      fmtDate(r.created_at), r.contact_name, r.phone, r.group_name, PARTICIPATION_LABEL[r.participation] ?? r.participation,
      r.riders_count, r.rider_names ?? '', r.attendees, foodText(r), r.notes ?? '',
    ])
    downloadCsv('חנוכת-מועדון-הרשמות.csv', head, rows)
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
  const box: React.CSSProperties = { background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: 16 }

  const card = (title: string, value: string, sub?: string) => (
    <div style={box}>
      <div style={{ color: '#7a8f7d', fontSize: 12, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#e8efe9' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#7a8f7d' }}>{sub}</div>}
    </div>
  )

  const chip = (label: string, n: number) => (
    <span key={label} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 999, padding: '5px 12px', fontSize: 13 }}>
      {label} <b style={{ color: n ? '#b5e853' : '#7a8f7d' }}>{n}</b>
    </span>
  )

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>חנוכת מועדון</h2>
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>
            {EVENT_DATE_LABEL} · {LOCATION} ← המועדון · {loading ? 'טוען...' : `${filtered.length} הרשמות`}
          </p>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={csv} style={btnStyle}>ייצוא לאקסל</button>
          <a href="/hanukat-moadon" target="_blank" rel="noopener noreferrer" style={btnStyle}>פתיחת הטופס הציבורי</a>
          <select aria-label="סינון לפי השתתפות" value={partFilter} onChange={e => setPartFilter(e.target.value)} style={selStyle}>
            <option value={ALL}>כל סוגי ההשתתפות</option>
            {PARTICIPATION.map(p => <option key={p.value} value={p.value}>{p.label} ({byPart(p.value).length})</option>)}
          </select>
          <select aria-label="סינון לפי קבוצה" value={groupFilter} onChange={e => setGroupFilter(e.target.value)} style={selStyle}>
            <option value={ALL}>כל הקבוצות ({regs.length})</option>
            {GROUPS.map(g => <option key={g} value={g}>{g} ({byGroup(g).length})</option>)}
          </select>
        </div>
      </div>

      {/* כרטיסי סיכום */}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 16 }}>
        {card('סה"כ מגיעים', String(people), `${regs.length} הרשמות`)}
        {card('רוכבים בתחרות', String(riders), 'אופני 20 אינץ׳')}
        {PARTICIPATION.map(p => card(p.label, String(byPart(p.value).length), `${byPart(p.value).reduce((s, r) => s + r.attendees, 0)} אנשים`))}
      </div>

      <div style={{ ...box, marginBottom: 16 }}>
        <div style={{ color: '#7a8f7d', fontSize: 12, marginBottom: 8 }}>🥐 מי מביא מה (מספר משפחות)</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FOOD.map(f => chip(`${f.emoji} ${f.label}`, foodCount(f.value)))}
        </div>
      </div>

      <div style={{ ...box, marginBottom: 24 }}>
        <div style={{ color: '#7a8f7d', fontSize: 12, marginBottom: 8 }}>👥 לפי קבוצה (הרשמות)</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {GROUPS.map(g => chip(g, byGroup(g).length))}
        </div>
      </div>

      {/* טבלה */}
      <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr>
              <th style={th}>שם</th>
              <th style={th}>קבוצה</th>
              <th style={th}>השתתפות</th>
              <th style={th}>רוכבים בתחרות</th>
              <th style={th}>מגיעים</th>
              <th style={th}>מביאים</th>
              <th style={th}>הערות</th>
              <th style={th}>וואטסאפ</th>
              <th style={th}>נרשם</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} style={{ opacity: deletingId === r.id ? 0.5 : 1 }}>
                <td style={td}>
                  <div style={{ fontWeight: 700 }}>{r.contact_name}</div>
                  <a href={waLink(r.phone, `היי ${r.contact_name}, זה בני מטבע בייק לגבי חנוכת המועדון`)}
                    target="_blank" rel="noopener noreferrer" style={{ color: '#b5e853', fontSize: 12, textDecoration: 'none' }}>
                    {r.phone}
                  </a>
                </td>
                <td style={td}>{r.group_name}</td>
                <td style={{ ...td, color: '#7a8f7d' }}>{PARTICIPATION_LABEL[r.participation] ?? r.participation}</td>
                <td style={td}>
                  {r.riders_count > 0 ? <><b>{r.riders_count}</b> · {r.rider_names}</> : <span style={{ color: '#7a8f7d' }}>—</span>}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>{r.attendees}</td>
                <td style={{ ...td, maxWidth: 200 }}>{foodText(r) || <span style={{ color: '#7a8f7d' }}>—</span>}</td>
                <td style={{ ...td, color: '#c3ccc4', maxWidth: 200, whiteSpace: 'pre-wrap' }}>{r.notes}</td>
                <td style={td}><WhatsappOptinBadge optedIn={r.whatsapp_optin} optedAt={r.whatsapp_optin_at} /></td>
                <td style={{ ...td, color: '#7a8f7d', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                <td style={td}>
                  <button onClick={() => remove(r)} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 12, cursor: 'pointer' }}>
                    מחיקה
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#7a8f7d', fontSize: 14 }}>
            עדיין אין הרשמות לחנוכת המועדון.
          </div>
        )}
      </div>
    </div>
  )
}
