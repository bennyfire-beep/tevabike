'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'
import { downloadCsv } from '@/lib/csv-export'
import WhatsappOptinBadge from '@/components/WhatsappOptinBadge'
import { SESSIONS, SESSION_SLUGS, sessionBySlug, LEVEL_LABEL, RIDER_TYPE_LABEL, type RiderType } from '@/lib/ride-sessions'

// ============================================================
// סשני רכיבה — ניהול ההרשמות, לפי רכיבה (lib/ride-sessions.ts)
// נתיב: app/admin/coordinator/rides/page.tsx
// עמוד ציבורי: app/rides · API: app/api/rides/route.ts
// ============================================================

type Reg = {
  id: string
  created_at: string
  session_slug: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
  level: string
  rider_type: RiderType
  price_ils: number
  notes: string | null
  status: string
  whatsapp_optin: boolean | null
  whatsapp_optin_at: string | null
}

// Rows for rides no longer listed in lib/ride-sessions.ts are grouped under
// one "past" filter.
const PAST = 'past'
const sessionKey = (r: Reg) => (SESSION_SLUGS.includes(r.session_slug) ? r.session_slug : PAST)
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

export default function RidesAdminPage() {
  const user = useCoordinator()
  const [regs, setRegs] = useState<Reg[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [sessionFilter, setSessionFilter] = useState<string>(SESSIONS[0]?.slug ?? PAST)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('ride_session_registrations')
      .select('*')
      .order('created_at', { ascending: true })
    setRegs((data ?? []) as Reg[])
    setLoading(false)
  }, [])

  useEffect(() => { if (user) load() }, [user, load])

  async function changeStatus(reg: Reg, status: string) {
    setSavingId(reg.id)
    const { error } = await supabase.from('ride_session_registrations').update({ status }).eq('id', reg.id)
    if (error) { alert(error.message); setSavingId(null); return }
    setRegs(prev => prev.map(r => r.id === reg.id ? { ...r, status } : r))
    setSavingId(null)
  }

  if (!user) return null

  const session = sessionBySlug(sessionFilter)
  const capacity = session?.capacity ?? 0
  const inSession = regs.filter(r => sessionKey(r) === sessionFilter)
  const active = inSession.filter(r => r.status !== 'cancelled')
  const paid = active.filter(r => r.status === 'paid')
  const members = active.filter(r => r.rider_type === 'member')
  const expected = active.reduce((sum, r) => sum + Number(r.price_ils || 0), 0)
  const collected = paid.reduce((sum, r) => sum + Number(r.price_ils || 0), 0)
  const full = !!session && active.length >= capacity

  const filtered = inSession.filter(r => statusFilter === 'all' || r.status === statusFilter)
  const activeCount = (key: string) => regs.filter(r => sessionKey(r) === key && r.status !== 'cancelled').length

  const csv = () => {
    const head = ['נרשם', 'רכיבה', 'שם פרטי', 'שם משפחה', 'טלפון', 'אימייל', 'רמה', 'סוג', 'מחיר', 'תשלום', 'הערות']
    const rows = filtered.map(r => [
      fmtDate(r.created_at), sessionBySlug(r.session_slug)?.title ?? r.session_slug, r.first_name, r.last_name, r.phone,
      r.email ?? '', LEVEL_LABEL[r.level] ?? r.level, RIDER_TYPE_LABEL[r.rider_type] ?? r.rider_type,
      String(r.price_ils), STATUS_LABEL[r.status] ?? r.status, r.notes ?? '',
    ])
    downloadCsv('סשני-רכיבה-הרשמות.csv', head, rows)
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
          <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>סשני רכיבה</h2>
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>
            {session ? `${session.title} · ${session.dateLabel}` : 'רכיבות קודמות'} · {loading ? 'טוען...' : `${filtered.length} הרשמות`}
          </p>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={csv} style={btnStyle}>ייצוא לאקסל</button>
          <a href={session ? `/rides/${session.slug}` : '/rides'} target="_blank" rel="noopener noreferrer" style={btnStyle}>פתיחת העמוד הציבורי</a>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7a8f7d', fontSize: 12 }}>
            רכיבה
            <select aria-label="סינון לפי רכיבה" value={sessionFilter} onChange={e => setSessionFilter(e.target.value)} style={selStyle}>
              {SESSIONS.map(s => <option key={s.slug} value={s.slug}>{s.dateLabel} · {s.title} ({activeCount(s.slug)}/{s.capacity})</option>)}
              <option value={PAST}>רכיבות קודמות ({activeCount(PAST)})</option>
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
        {session
          ? card('נרשמים', `${active.length} / ${capacity}`, full ? 'מלא' : `נותרו ${capacity - active.length}`, full ? '#f87171' : '#e8efe9', full ? '#7f2d2d' : '#252b27')
          : card('נרשמים', String(active.length))}
        {card('רוכבי טבע בייק / אורחים', `${members.length} / ${active.length - members.length}`)}
        {card('שילמו', String(paid.length), `מתוך ${active.length}`, '#b5e853')}
        {card('נגבה / צפוי', `₪${collected.toLocaleString('he-IL')}`, `מתוך ₪${expected.toLocaleString('he-IL')}`, '#fbbf24')}
      </div>

      {/* טבלה */}
      <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr>
              <th style={th}>רוכב</th>
              <th style={th}>סוג</th>
              <th style={th}>רמה</th>
              <th style={th}>תשלום</th>
              <th style={th}>הערות</th>
              <th style={th}>וואטסאפ</th>
              <th style={th}>נרשם</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const color = STATUS_COLOR[r.status] ?? STATUS_COLOR.pending
              const title = sessionBySlug(r.session_slug)?.title
              return (
                <tr key={r.id} style={{ opacity: savingId === r.id ? 0.5 : 1 }}>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{r.first_name} {r.last_name}</div>
                    <a href={waLink(r.phone, `היי ${r.first_name}, זה בני מטבע בייק לגבי ${title ? `הרכיבה "${title}"` : 'סשן הרכיבה'}`)}
                      target="_blank" rel="noopener noreferrer" style={{ color: '#b5e853', fontSize: 12, textDecoration: 'none' }}>
                      {r.phone}
                    </a>
                    {r.email && <div style={{ color: '#7a8f7d', fontSize: 12 }}>{r.email}</div>}
                  </td>
                  <td style={td}>
                    <span style={{
                      background: r.rider_type === 'member' ? '#D4288A22' : '#252b27',
                      color: r.rider_type === 'member' ? '#ec4899' : '#c3ccc4',
                      borderRadius: 12, padding: '2px 9px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                    }}>
                      {RIDER_TYPE_LABEL[r.rider_type] ?? r.rider_type} · ₪{r.price_ils}
                    </span>
                  </td>
                  <td style={{ ...td, color: '#7a8f7d' }}>{LEVEL_LABEL[r.level] ?? r.level}</td>
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
                  <td style={{ ...td, color: '#7a8f7d', maxWidth: 220 }}>{r.notes ?? '—'}</td>
                  <td style={td}><WhatsappOptinBadge optedIn={r.whatsapp_optin} optedAt={r.whatsapp_optin_at} /></td>
                  <td style={{ ...td, color: '#7a8f7d', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {!loading && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#7a8f7d', fontSize: 14 }}>
            עדיין אין הרשמות לרכיבה הזו.
          </div>
        )}
      </div>
    </div>
  )
}
