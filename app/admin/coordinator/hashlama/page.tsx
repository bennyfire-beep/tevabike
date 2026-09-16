'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'
import { downloadCsv } from '@/lib/csv-export'

// ============================================================
// אימון השלמה (22.9, רקפת) — ניהול ההרשמות
// נתיב: app/admin/coordinator/hashlama/page.tsx
// טופס ציבורי: app/hashlama/page.tsx · API: app/api/hashlama/route.ts
// ============================================================

type Reg = {
  id: string
  created_at: string
  first_name: string
  last_name: string
  phone: string
  branch: string
  group_type: string
}

const BRANCH_LABEL: Record<string, string> = { misgav: 'משגב', biriya: 'ביריה', matzuva: 'מצובה' }
const GROUP_LABEL: Record<string, string> = { beginners: 'גרביטי מתחילים', mini: 'מיני גרביטי', pro: 'גרביטי פרו' }

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })

const waLink = (phone: string, text: string) => {
  const clean = phone.replace(/\D/g, '').replace(/^0/, '972')
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`
}

export default function HashlamaAdminPage() {
  const user = useCoordinator()
  const [regs, setRegs] = useState<Reg[]>([])
  const [loading, setLoading] = useState(true)
  const [branchFilter, setBranchFilter] = useState('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('hashlama_registrations')
      .select('*')
      .order('created_at', { ascending: true })
    setRegs((data ?? []) as Reg[])
    setLoading(false)
  }, [])

  useEffect(() => { if (user) load() }, [user, load])

  async function remove(reg: Reg) {
    if (!confirm(`למחוק את ${reg.first_name} ${reg.last_name}?`)) return
    setDeletingId(reg.id)
    const { error } = await supabase.from('hashlama_registrations').delete().eq('id', reg.id)
    if (error) { alert(error.message); setDeletingId(null); return }
    setRegs(prev => prev.filter(r => r.id !== reg.id))
    setDeletingId(null)
  }

  if (!user) return null

  const filtered = regs.filter(r => branchFilter === 'all' || r.branch === branchFilter)

  const byBranch = (branch: string) => regs.filter(r => r.branch === branch).length
  const byGroup = (group: string) => regs.filter(r => r.group_type === group).length

  const csv = () => {
    const head = ['נרשם', 'שם פרטי', 'שם משפחה', 'טלפון', 'סניף', 'קבוצה']
    const rows = filtered.map(r => [
      fmtDate(r.created_at), r.first_name, r.last_name, r.phone,
      BRANCH_LABEL[r.branch] ?? r.branch, GROUP_LABEL[r.group_type] ?? r.group_type,
    ])
    downloadCsv('אימון-השלמה-הרשמות.csv', head, rows)
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
          <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>אימון השלמה · רקפת</h2>
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>
            שלישי 22.9, 08:30–13:00 · {loading ? 'טוען...' : `${filtered.length} הרשמות`}
          </p>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={csv} style={btnStyle}>ייצוא לאקסל</button>
          <a href="/hashlama" target="_blank" rel="noopener noreferrer" style={btnStyle}>פתיחת הטופס הציבורי</a>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7a8f7d', fontSize: 12 }}>
            סניף
            <select aria-label="סינון לפי סניף" value={branchFilter} onChange={e => setBranchFilter(e.target.value)} style={selStyle}>
              <option value="all">הכל</option>
              {Object.entries(BRANCH_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* כרטיסי סיכום */}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 24 }}>
        {card('סה"כ נרשמו', String(regs.length))}
        {card('משגב', String(byBranch('misgav')))}
        {card('ביריה', String(byBranch('biriya')))}
        {card('מצובה', String(byBranch('matzuva')))}
        {card('מתחילים / מיני / פרו', `${byGroup('beginners')} / ${byGroup('mini')} / ${byGroup('pro')}`)}
      </div>

      {/* טבלה */}
      <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr>
              <th style={th}>רוכב</th>
              <th style={th}>סניף</th>
              <th style={th}>קבוצה</th>
              <th style={th}>נרשם</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} style={{ opacity: deletingId === r.id ? 0.5 : 1 }}>
                <td style={td}>
                  <div style={{ fontWeight: 700 }}>{r.first_name} {r.last_name}</div>
                  <a href={waLink(r.phone, `היי ${r.first_name}, זה בני מטבע בייק לגבי אימון ההשלמה`)}
                    target="_blank" rel="noopener noreferrer" style={{ color: '#b5e853', fontSize: 12, textDecoration: 'none' }}>
                    {r.phone}
                  </a>
                </td>
                <td style={{ ...td, color: '#7a8f7d' }}>{BRANCH_LABEL[r.branch] ?? r.branch}</td>
                <td style={{ ...td, color: '#7a8f7d' }}>{GROUP_LABEL[r.group_type] ?? r.group_type}</td>
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
            עדיין אין הרשמות לאימון ההשלמה.
          </div>
        )}
      </div>
    </div>
  )
}
