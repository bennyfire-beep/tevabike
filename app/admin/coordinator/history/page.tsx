'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'
import Link from 'next/link'

const BRANCH_COLORS: Record<string, string> = {
  'משגב':  '#b5e853',
  'מצובה': '#81d4fa',
  'ביריה': '#ff8f6b',
  'אמירים': '#c084fc',
}

const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : '')
const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' })

type SessionRow = {
  id: string
  class_name: string
  branch: string
  session_date: string
  start_time: string | null
  end_time: string | null
  type: 'regular' | 'special' | null
  activity_name: string | null
  present: number
  total: number
  pct: number
}
type AttRow = { rider_id: string; rider_name: string | null; phone: string | null; present: boolean }

function badge(pct: number): [string, string] {
  return pct >= 80 ? ['#4cdb7a22', '#4cdb7a'] : pct >= 60 ? ['#b5e85322', '#b5e853'] : ['#ff4f4f22', '#ff8080']
}

export default function HistoryPage() {
  const user = useCoordinator()
  const [branch, setBranch] = useState('')
  const [group, setGroup]   = useState('')
  const [rows, setRows]     = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId]   = useState<string | null>(null)
  const [attMap, setAttMap]   = useState<Record<string, AttRow[]>>({})
  const [attLoading, setAttLoading] = useState(false)
  const [paramsReady, setParamsReady] = useState(false)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    setBranch(p.get('branch') ?? '')
    setGroup(p.get('group') ?? '')
    setParamsReady(true)
  }, [])

  useEffect(() => {
    if (!user || !paramsReady) return
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, paramsReady, branch, group])

  async function load() {
    setLoading(true)
    setOpenId(null)
    let q = supabase
      .from('class_sessions')
      .select('id, class_name, branch, session_date, start_time, end_time, type, activity_name')
      .order('session_date', { ascending: false })
    if (branch) q = q.eq('branch', branch)
    if (group)  q = q.eq('class_name', group)
    const { data: sessions } = await q
    const list = sessions ?? []
    if (list.length === 0) { setRows([]); setLoading(false); return }

    const ids = list.map(s => s.id)
    const { data: attRows } = await supabase
      .from('attendance')
      .select('session_id, present')
      .in('session_id', ids)

    const counts: Record<string, { present: number; total: number }> = {}
    for (const a of attRows ?? []) {
      if (!counts[a.session_id]) counts[a.session_id] = { present: 0, total: 0 }
      counts[a.session_id].total++
      if (a.present) counts[a.session_id].present++
    }
    setRows(list.map(s => {
      const c = counts[s.id] ?? { present: 0, total: 0 }
      return { ...s, present: c.present, total: c.total, pct: c.total > 0 ? Math.round(c.present / c.total * 100) : 0 }
    }))
    setLoading(false)
  }

  async function toggle(id: string) {
    if (openId === id) { setOpenId(null); return }
    setOpenId(id)
    if (!attMap[id]) {
      setAttLoading(true)
      const { data } = await supabase
        .from('attendance')
        .select('rider_id, rider_name, present')
        .eq('session_id', id)
        .order('rider_name')
      setAttMap(p => ({ ...p, [id]: (data ?? []) as AttRow[] }))
      setAttLoading(false)
    }
  }

  if (!user) return null

  const title = group || branch || 'כל האימונים'
  const titleColor = BRANCH_COLORS[branch] ?? '#b5e853'

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <Link href="/admin/coordinator" style={{ color: '#7a8f7d', fontSize: 13, textDecoration: 'none' }}>← לוח בקרה</Link>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>היסטוריית אימונים</h2>
        <span style={{ background: titleColor + '22', color: titleColor, border: `1px solid ${titleColor}44`, borderRadius: 20, padding: '3px 14px', fontSize: 14, fontWeight: 700 }}>
          {title}
        </span>
        {(branch || group) && (
          <Link href="/admin/coordinator/history" style={{ color: '#7a8f7d', fontSize: 12, textDecoration: 'none' }}>✕ הצג הכל</Link>
        )}
      </div>
      <p style={{ color: '#7a8f7d', fontSize: 13, margin: '0 0 20px' }}>
        {loading ? 'טוען...' : `${rows.length} אימונים`}
      </p>

      {loading ? (
        <div style={{ color: '#7a8f7d', textAlign: 'center', padding: 50 }}>טוען...</div>
      ) : rows.length === 0 ? (
        <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: 50, textAlign: 'center', color: '#7a8f7d' }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>📭</div>
          <p style={{ margin: 0 }}>אין אימונים להצגה</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(s => {
            const bc = BRANCH_COLORS[s.branch] ?? '#7a8f7d'
            const [bg, text] = badge(s.pct)
            const isOpen = openId === s.id
            const att = attMap[s.id] ?? []
            const presentList = att.filter(a => a.present)
            const absentList  = att.filter(a => !a.present)
            return (
              <div key={s.id} style={{ background: '#141716', border: `1px solid ${isOpen ? bc + '55' : '#252b27'}`, borderRadius: 12, overflow: 'hidden' }}>

                {/* Row header (clickable) */}
                <div
                  onClick={() => toggle(s.id)}
                  style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flexWrap: 'wrap' }}
                >
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{s.class_name}</span>
                  {s.type === 'special'
                    ? <span style={{ background: '#c084fc22', color: '#c084fc', borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>★ מיוחדת</span>
                    : <span style={{ background: bc + '22', color: bc, borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>{s.branch}</span>}
                  <span style={{ color: '#e8efe9', fontSize: 13 }}>📅 {fmtDate(s.session_date)}</span>
                  {s.start_time && <span style={{ color: '#7a8f7d', fontSize: 12 }}>🕒 {fmtTime(s.start_time)}{s.end_time ? `–${fmtTime(s.end_time)}` : ''}</span>}
                  <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#7a8f7d', fontSize: 12 }}>{s.present}/{s.total}</span>
                    <span style={{ background: bg, color: text, border: `1px solid ${text}44`, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{s.pct}%</span>
                    <span style={{ color: '#7a8f7d', fontSize: 13 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded attendees */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #252b27', padding: '12px 18px', background: '#0d0f0e' }}>
                    {attLoading && !attMap[s.id] ? (
                      <div style={{ color: '#7a8f7d', fontSize: 13 }}>טוען נוכחות...</div>
                    ) : att.length === 0 ? (
                      <div style={{ color: '#7a8f7d', fontSize: 13 }}>לא נשמרה נוכחות לאימון זה</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                          <div style={{ color: '#4cdb7a', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>✓ נכחו ({presentList.length})</div>
                          {presentList.length === 0 ? <div style={{ color: '#7a8f7d', fontSize: 12 }}>—</div> :
                            presentList.map(a => (
                              <div key={a.rider_id} style={{ fontSize: 13, color: '#e8efe9', padding: '3px 0' }}>{a.rider_name ?? a.rider_id}</div>
                            ))}
                        </div>
                        <div>
                          <div style={{ color: '#ff8080', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>✗ נעדרו ({absentList.length})</div>
                          {absentList.length === 0 ? <div style={{ color: '#7a8f7d', fontSize: 12 }}>—</div> :
                            absentList.map(a => (
                              <div key={a.rider_id} style={{ fontSize: 13, color: '#7a8f7d', padding: '3px 0' }}>{a.rider_name ?? a.rider_id}</div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
