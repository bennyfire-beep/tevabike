'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'
import { downloadCsv } from '@/lib/csv-export'
import WhatsappOptinBadge from '@/components/WhatsappOptinBadge'
import { MISGAV_DAYS, MISGAV_MIN_PER_DAY, MISGAV_PAY_LINKS, MISGAV_PRICE_PER_DAY, misgavDayLabel } from '@/lib/camp-misgav'

type Reg = {
  id: string
  created_at: string
  rider_first_name: string
  rider_last_name: string
  age: string | null
  group_name: string | null
  days: string[]
  parent_name: string
  parent_phone: string
  parent_email: string | null
  city: string
  health_notes: string | null
  total_amount: number
  payment_status: string
  whatsapp_optin: boolean | null
  whatsapp_optin_at: string | null
}

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

const shortDay = (key: string) => MISGAV_DAYS.find(d => d.key === key)?.short ?? key

// הודעת וואטסאפ אישית להורה — עם קישורי התשלום לימים שבחר (אם כבר יש)
function parentMessage(r: Reg) {
  const lines = [
    `היי ${r.parent_name}, זה בני מטבע בייק 🌲`,
    `לגבי ההרשמה של ${r.rider_first_name} למחנה חנוכה במשגב (08:30–13:00, מועדון טבע בייק).`,
  ]
  if (r.payment_status === 'pending') {
    const links = r.days.map(d => MISGAV_PAY_LINKS[d] ? `${misgavDayLabel(d)}: ${MISGAV_PAY_LINKS[d]}` : '').filter(Boolean)
    if (links.length) lines.push('', 'קישורי תשלום (המקום נשמר אחרי התשלום):', ...links)
  }
  return lines.join('\n')
}

export default function HanukkahMisgavAdminPage() {
  const user = useCoordinator()
  const [regs, setRegs] = useState<Reg[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [dayFilter, setDayFilter] = useState('all')
  const [waOnly, setWaOnly] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let live = true
    supabase
      .from('hanukkah_misgav_registrations')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!live) return
        setRegs((data ?? []) as Reg[])
        setLoading(false)
      })
    return () => { live = false }
  }, [user])

  async function changeStatus(reg: Reg, payment_status: string) {
    setSavingId(reg.id)
    const { error } = await supabase.from('hanukkah_misgav_registrations').update({ payment_status }).eq('id', reg.id)
    if (error) { alert(error.message); setSavingId(null); return }
    setRegs(prev => prev.map(r => r.id === reg.id ? { ...r, payment_status } : r))
    setSavingId(null)
  }

  if (!user) return null

  const active = regs.filter(r => r.payment_status !== 'cancelled')
  const paid = active.filter(r => r.payment_status === 'paid')
  const revenue = paid.reduce((s, r) => s + r.total_amount, 0)
  const pending = active.filter(r => r.payment_status === 'pending').reduce((s, r) => s + r.total_amount, 0)

  const perDay = MISGAV_DAYS.map(d => {
    const on = active.filter(r => r.days.includes(d.key))
    return { ...d, total: on.length, paid: on.filter(r => r.payment_status === 'paid').length }
  })

  const filtered = regs.filter(r =>
    (statusFilter === 'all' || r.payment_status === statusFilter) &&
    (dayFilter === 'all' || r.days.includes(dayFilter)) &&
    (!waOnly || r.whatsapp_optin),
  )

  const summaryText = [
    'מחנה חנוכה משגב — סיכום הרשמות',
    ...perDay.map(d => `${d.label}: ${d.total} נרשמו (${d.paid} שילמו)${d.total >= MISGAV_MIN_PER_DAY ? ' ✓' : ` · חסרים ${MISGAV_MIN_PER_DAY - d.total}`}`),
    `שולם: ${revenue.toLocaleString()} ₪ · ממתין: ${pending.toLocaleString()} ₪`,
  ].join('\n')

  const csv = () => {
    const head = ['נרשם', 'רוכב', 'גיל', 'קבוצה', 'ימים', 'הורה', 'טלפון', 'מייל', 'ישוב', 'בריאות', 'סכום', 'תשלום', 'וואטסאפ']
    const rows = filtered.map(r => [
      fmtDate(r.created_at), `${r.rider_first_name} ${r.rider_last_name}`, r.age ?? '', r.group_name ?? '',
      r.days.map(shortDay).join(' '), r.parent_name, r.parent_phone, r.parent_email ?? '', r.city,
      r.health_notes ?? '', String(r.total_amount), STATUS_LABEL[r.payment_status] ?? r.payment_status,
      r.whatsapp_optin ? 'כן' : '',
    ])
    downloadCsv('מחנה-חנוכה-משגב-הרשמות.csv', head, rows)
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

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>מחנה חנוכה · משגב</h2>
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>
            06.12–08.12 · 08:30–13:00 · {loading ? 'טוען...' : `${filtered.length} הרשמות`}
          </p>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <a href="/camp-hanukkah-misgav" target="_blank" rel="noopener noreferrer" style={btnStyle}>לעמוד ההרשמה</a>
          <button onClick={csv} style={btnStyle}>ייצוא לאקסל</button>
          <a href={waLink('0505358071', summaryText)} target="_blank" rel="noopener noreferrer" style={btnStyle}>
            שליחת סיכום לטל
          </a>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e8efe9', fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={waOnly} onChange={e => setWaOnly(e.target.checked)} style={{ width: 15, height: 15, accentColor: '#b5e853', cursor: 'pointer' }} />
            אישרו וואטסאפ בלבד
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7a8f7d', fontSize: 12 }}>
            יום
            <select aria-label="סינון לפי יום" value={dayFilter} onChange={e => setDayFilter(e.target.value)} style={selStyle}>
              <option value="all">כל הימים</option>
              {MISGAV_DAYS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
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

      {/* כרטיס לכל יום — מינימום 8 */}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 24 }}>
        {perDay.map(d => {
          const ok = d.total >= MISGAV_MIN_PER_DAY
          return (
            <div key={d.key} style={{ background: '#141716', border: `1px solid ${ok ? '#2f4020' : '#5a4a14'}`, borderRadius: 12, padding: 16 }}>
              <div style={{ color: '#7a8f7d', fontSize: 12, marginBottom: 4 }}>{d.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: ok ? '#b5e853' : '#fbbf24' }}>{d.total} / {MISGAV_MIN_PER_DAY}</div>
              <div style={{ fontSize: 12, color: '#7a8f7d' }}>
                {ok ? 'יוצא לדרך' : `חסרים ${MISGAV_MIN_PER_DAY - d.total}`} · שילמו {d.paid}
              </div>
            </div>
          )
        })}
        <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: 16 }}>
          <div style={{ color: '#7a8f7d', fontSize: 12, marginBottom: 4 }}>שולם</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#b5e853' }}>{revenue.toLocaleString()} ₪</div>
          <div style={{ fontSize: 12, color: '#fbbf24' }}>ממתין: {pending.toLocaleString()} ₪</div>
        </div>
      </div>

      {MISGAV_DAYS.some(d => !MISGAV_PAY_LINKS[d.key]) && (
        <div style={{ background: '#3a2f14', border: '1px solid #5a4a14', color: '#fbbf24', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 18 }}>
          חסרים קישורי תשלום ב־lib/camp-misgav.ts — הורים רואים כרגע &quot;קישור יישלח בנפרד&quot;.
        </div>
      )}

      <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr>
              <th style={th}>רוכב</th>
              <th style={th}>ימים</th>
              <th style={th}>הורה</th>
              <th style={th}>ישוב</th>
              <th style={th}>בריאות</th>
              <th style={th}>סכום</th>
              <th style={th}>תשלום</th>
              <th style={th}>וואטסאפ</th>
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
                    <div style={{ color: '#7a8f7d', fontSize: 12 }}>
                      {[r.group_name, r.age ? `גיל ${r.age}` : ''].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    {r.days.map(d => (
                      <span key={d} style={{ display: 'inline-block', background: '#1a2114', color: '#b5e853', borderRadius: 6, padding: '2px 7px', fontSize: 12, marginLeft: 4 }}>
                        {shortDay(d)}
                      </span>
                    ))}
                  </td>
                  <td style={td}>
                    <div>{r.parent_name}</div>
                    <a href={waLink(r.parent_phone, parentMessage(r))}
                      target="_blank" rel="noopener noreferrer" style={{ color: '#b5e853', fontSize: 12, textDecoration: 'none' }}>
                      💬 {r.parent_phone}
                    </a>
                    {r.parent_email && <div style={{ color: '#7a8f7d', fontSize: 11 }}>{r.parent_email}</div>}
                  </td>
                  <td style={{ ...td, color: '#7a8f7d' }}>{r.city}</td>
                  <td style={{ ...td, maxWidth: 170, color: r.health_notes ? '#fbbf24' : '#7a8f7d' }}>{r.health_notes || '—'}</td>
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
                  <td style={td}><WhatsappOptinBadge optedIn={r.whatsapp_optin} optedAt={r.whatsapp_optin_at} /></td>
                  <td style={{ ...td, color: '#7a8f7d', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {!loading && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#7a8f7d', fontSize: 14 }}>
            עדיין אין הרשמות למחנה חנוכה במשגב.
          </div>
        )}
      </div>

      <p style={{ color: '#7a8f7d', fontSize: 12, marginTop: 14 }}>
        מחיר: {MISGAV_PRICE_PER_DAY} ₪ ליום · מינימום {MISGAV_MIN_PER_DAY} נרשמים לכל יום · לחיצה על הטלפון פותחת וואטסאפ עם הודעה מוכנה (כולל קישורי תשלום למי שלא שילם).
      </p>
    </div>
  )
}
