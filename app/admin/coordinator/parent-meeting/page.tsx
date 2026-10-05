'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'
import { downloadCsv } from '@/lib/csv-export'
import WhatsappOptinBadge from '@/components/WhatsappOptinBadge'
import { MEETING_DATE, MEETING_DATE_LABEL, LOCATION, SESSIONS, SESSION_LABEL } from '@/lib/parent-meeting'

// ============================================================
// אסיפת הורים — ניהול ההרשמות, לפי מפגש (lib/parent-meeting.ts)
// נתיב: app/admin/coordinator/parent-meeting/page.tsx
// טופס ציבורי: app/asefat-horim/page.tsx · API: app/api/parent-meeting/route.ts
// ============================================================

type Reg = {
  id: string
  created_at: string
  meeting_date: string
  session: string
  parent_name: string
  phone: string
  rider_name: string
  attendees: number
  notes: string | null
  whatsapp_optin: boolean | null
  whatsapp_optin_at: string | null
}

// Rows from earlier meetings (a meeting_date other than the current one) are
// grouped under one "past" filter.
const ALL = 'all'
const PAST = 'past'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })

const waLink = (phone: string, text: string) => {
  const clean = phone.replace(/\D/g, '').replace(/^0/, '972')
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`
}

export default function ParentMeetingAdminPage() {
  const user = useCoordinator()
  const [regs, setRegs] = useState<Reg[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionFilter, setSessionFilter] = useState(ALL)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('parent_meeting_registrations')
      .select('*')
      .order('created_at', { ascending: true })
    setRegs((data ?? []) as Reg[])
    setLoading(false)
  }, [])

  useEffect(() => { if (user) load() }, [user, load])

  async function remove(reg: Reg) {
    if (!confirm(`למחוק את ${reg.parent_name}?`)) return
    setDeletingId(reg.id)
    const { error } = await supabase.from('parent_meeting_registrations').delete().eq('id', reg.id)
    if (error) { alert(error.message); setDeletingId(null); return }
    setRegs(prev => prev.filter(r => r.id !== reg.id))
    setDeletingId(null)
  }

  if (!user) return null

  const current = regs.filter(r => r.meeting_date === MEETING_DATE)
  const past = regs.filter(r => r.meeting_date !== MEETING_DATE)
  const isPast = sessionFilter === PAST

  const filtered = isPast
    ? past
    : current.filter(r => sessionFilter === ALL || r.session === sessionFilter)

  const inSession = (session: string) => current.filter(r => r.session === session)
  const people = (list: Reg[]) => list.reduce((sum, r) => sum + (r.attendees ?? 1), 0)

  const csv = () => {
    const head = ['נרשם', 'תאריך אסיפה', 'מפגש', 'שם ההורה', 'טלפון', 'רוכב/ת', 'מספר משתתפים', 'הערות']
    const rows = filtered.map(r => [
      fmtDate(r.created_at), r.meeting_date, SESSION_LABEL[r.session] ?? r.session,
      r.parent_name, r.phone, r.rider_name, r.attendees, r.notes ?? '',
    ])
    downloadCsv('אסיפת-הורים-הרשמות.csv', head, rows)
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

  const card = (title: string, value: string, sub?: string) => (
    <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: 16 }}>
      <div style={{ color: '#7a8f7d', fontSize: 12, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#e8efe9' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#7a8f7d' }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>אסיפת הורים</h2>
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>
            {isPast ? 'אסיפות קודמות' : `${MEETING_DATE_LABEL} · ${LOCATION}`} · {loading ? 'טוען...' : `${filtered.length} הרשמות`}
          </p>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={csv} style={btnStyle}>ייצוא לאקסל</button>
          <a href="/asefat-horim" target="_blank" rel="noopener noreferrer" style={btnStyle}>פתיחת הטופס הציבורי</a>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7a8f7d', fontSize: 12 }}>
            מפגש
            <select aria-label="סינון לפי מפגש" value={sessionFilter} onChange={e => setSessionFilter(e.target.value)} style={selStyle}>
              <option value={ALL}>כל המפגשים ({current.length})</option>
              {SESSIONS.map(s => <option key={s.value} value={s.value}>{s.label} ({inSession(s.value).length})</option>)}
              <option value={PAST}>אסיפות קודמות ({past.length})</option>
            </select>
          </label>
        </div>
      </div>

      {/* כרטיסי סיכום */}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 24 }}>
        {card('סה"כ משפחות', String(current.length), `${people(current)} משתתפים`)}
        {SESSIONS.map(s => card(`${s.label} · ${s.hours}`, String(inSession(s.value).length), `${people(inSession(s.value))} משתתפים`))}
      </div>

      {/* טבלה */}
      <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr>
              <th style={th}>הורה</th>
              <th style={th}>רוכב/ת</th>
              <th style={th}>מפגש</th>
              <th style={th}>משתתפים</th>
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
                  <div style={{ fontWeight: 700 }}>{r.parent_name}</div>
                  <a href={waLink(r.phone, `היי ${r.parent_name}, זה בני מטבע בייק לגבי אסיפת ההורים`)}
                    target="_blank" rel="noopener noreferrer" style={{ color: '#b5e853', fontSize: 12, textDecoration: 'none' }}>
                    {r.phone}
                  </a>
                </td>
                <td style={td}>{r.rider_name}</td>
                <td style={{ ...td, color: '#7a8f7d' }}>
                  {SESSION_LABEL[r.session] ?? r.session}
                  {isPast && <div style={{ fontSize: 12 }}>{r.meeting_date}</div>}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>{r.attendees}</td>
                <td style={{ ...td, color: '#c3ccc4', maxWidth: 220, whiteSpace: 'pre-wrap' }}>{r.notes}</td>
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
            עדיין אין הרשמות לאסיפת ההורים.
          </div>
        )}
      </div>
    </div>
  )
}
