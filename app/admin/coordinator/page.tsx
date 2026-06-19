'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'
import Link from 'next/link'

const MONTHS_HE = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']
const BRANCH_COLORS: Record<string, string> = {
  'משגב':  '#b5e853',
  'מצובה': '#81d4fa',
  'ביריה': '#ff8f6b',
}

type ClassStat = {
  class_name: string
  branch: string
  sessions: number
  present: number
  total: number
  pct: number
}
type Alert = { riderId: string; riderName: string; absences: number; lastClass: string; branch: string }
type MonthlyPoint = { month: string; label: string; pct: number }

function AttendanceBadge({ pct }: { pct: number }) {
  const [bg, text] =
    pct >= 80 ? ['#4cdb7a22', '#4cdb7a'] :
    pct >= 60 ? ['#b5e85322', '#b5e853'] :
                ['#ff4f4f22', '#ff8080']
  return (
    <span style={{ background: bg, color: text, border: `1px solid ${text}44`, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
      {pct}%
    </span>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#4cdb7a' : pct >= 60 ? '#b5e853' : '#ff6b6b'
  return (
    <div style={{ background: '#252b27', borderRadius: 4, height: 6, width: '100%' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .4s' }} />
    </div>
  )
}

function TrendChart({ points }: { points: MonthlyPoint[] }) {
  const maxPct = 100
  const W = 560, H = 160, PADDING = { top: 12, bottom: 28, left: 36, right: 8 }
  const chartW = W - PADDING.left - PADDING.right
  const chartH = H - PADDING.top - PADDING.bottom
  const barW   = Math.floor(chartW / points.length) - 4

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block' }}>
      {[0, 25, 50, 75, 100].map(y => {
        const cy = PADDING.top + chartH - (y / maxPct) * chartH
        return (
          <g key={y}>
            <line x1={PADDING.left} y1={cy} x2={W - PADDING.right} y2={cy} stroke="#252b27" strokeWidth={1} />
            <text x={PADDING.left - 4} y={cy + 4} textAnchor="end" fontSize={9} fill="#7a8f7d">{y}</text>
          </g>
        )
      })}
      {points.map((p, i) => {
        const barH = (p.pct / maxPct) * chartH
        const x    = PADDING.left + (i * (chartW / points.length)) + 2
        const y    = PADDING.top + chartH - barH
        const color = p.pct >= 80 ? '#4cdb7a' : p.pct >= 60 ? '#b5e853' : '#ff6b6b'
        return (
          <g key={p.month}>
            {p.pct > 0 && (
              <>
                <rect x={x} y={y} width={barW} height={barH} rx={3} fill={color} opacity={0.85} />
                {barH > 18 && (
                  <text x={x + barW / 2} y={y + 11} textAnchor="middle" fontSize={8} fill="#0d0f0e" fontWeight="700">
                    {p.pct}%
                  </text>
                )}
              </>
            )}
            {p.pct === 0 && (
              <rect x={x} y={PADDING.top + chartH - 4} width={barW} height={4} rx={2} fill="#252b27" />
            )}
            <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={9} fill="#7a8f7d">{p.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function CoordinatorPage() {
  const user = useCoordinator()
  const [classStats, setClassStats]   = useState<ClassStat[]>([])
  const [branchStats, setBranchStats] = useState<Record<string, { present: number; total: number }>>({})
  const [alerts, setAlerts]           = useState<Alert[]>([])
  const [trendPoints, setTrendPoints] = useState<MonthlyPoint[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [period, setPeriod]           = useState<'30' | '90'>('30')

  useEffect(() => {
    if (!user) return
    loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, period])

  async function loadAll() {
    setDataLoading(true)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - parseInt(period))
    const cutoffStr = cutoff.toISOString().split('T')[0]

    const { data: sessions } = await supabase
      .from('class_sessions')
      .select('id, class_name, branch, session_date')
      .gte('session_date', cutoffStr)
      .order('session_date')

    if (!sessions?.length) {
      setClassStats([])
      setBranchStats({})
      setAlerts([])
      setDataLoading(false)
      await loadTrend()
      return
    }

    const sessionIds = sessions.map(s => s.id)
    const { data: attRows } = await supabase
      .from('attendance')
      .select('session_id, rider_id, rider_name, present')
      .in('session_id', sessionIds)

    const att = attRows ?? []

    const classMap: Record<string, ClassStat> = {}
    for (const s of sessions) {
      const key = `${s.class_name}||${s.branch}`
      if (!classMap[key]) classMap[key] = { class_name: s.class_name, branch: s.branch, sessions: 0, present: 0, total: 0, pct: 0 }
      classMap[key].sessions++
    }
    for (const a of att) {
      const s = sessions.find(x => x.id === a.session_id)
      if (!s) continue
      const key = `${s.class_name}||${s.branch}`
      if (!classMap[key]) continue
      classMap[key].total++
      if (a.present) classMap[key].present++
    }
    for (const k of Object.keys(classMap)) {
      const c = classMap[k]
      c.pct = c.total > 0 ? Math.round(c.present / c.total * 100) : 0
    }
    setClassStats(Object.values(classMap).sort((a, b) => b.pct - a.pct))

    const bmap: Record<string, { present: number; total: number }> = {}
    for (const a of att) {
      const s = sessions.find(x => x.id === a.session_id)
      if (!s) continue
      if (!bmap[s.branch]) bmap[s.branch] = { present: 0, total: 0 }
      bmap[s.branch].total++
      if (a.present) bmap[s.branch].present++
    }
    setBranchStats(bmap)

    const absenceMap: Record<string, { name: string; count: number; lastClass: string; branch: string }> = {}
    for (const a of att.filter(x => !x.present)) {
      const s = sessions.find(x => x.id === a.session_id)
      if (!s) continue
      if (!absenceMap[a.rider_id]) absenceMap[a.rider_id] = { name: a.rider_name ?? a.rider_id, count: 0, lastClass: s.class_name, branch: s.branch }
      absenceMap[a.rider_id].count++
    }
    setAlerts(
      Object.entries(absenceMap)
        .filter(([, v]) => v.count >= 2)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 20)
        .map(([id, v]) => ({ riderId: id, riderName: v.name, absences: v.count, lastClass: v.lastClass, branch: v.branch }))
    )

    await loadTrend()
    setDataLoading(false)
  }

  async function loadTrend() {
    const yearAgo = new Date()
    yearAgo.setFullYear(yearAgo.getFullYear() - 1)
    const yearAgoStr = yearAgo.toISOString().split('T')[0]

    const { data: sessions } = await supabase
      .from('class_sessions')
      .select('id, session_date')
      .gte('session_date', yearAgoStr)

    if (!sessions?.length) {
      const now = new Date()
      const pts: MonthlyPoint[] = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
        return { month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: MONTHS_HE[d.getMonth()], pct: 0 }
      })
      setTrendPoints(pts)
      return
    }

    const sessionIds = sessions.map(s => s.id)
    const { data: attRows } = await supabase
      .from('attendance')
      .select('session_id, present')
      .in('session_id', sessionIds)

    const monthly: Record<string, { present: number; total: number }> = {}
    for (const s of sessions) {
      const m = s.session_date.substring(0, 7)
      if (!monthly[m]) monthly[m] = { present: 0, total: 0 }
    }
    for (const a of attRows ?? []) {
      const s = sessions.find(x => x.id === a.session_id)
      if (!s) continue
      const m = s.session_date.substring(0, 7)
      if (!monthly[m]) monthly[m] = { present: 0, total: 0 }
      monthly[m].total++
      if (a.present) monthly[m].present++
    }

    const now = new Date()
    const pts: MonthlyPoint[] = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const m = monthly[key]
      const pct = m && m.total > 0 ? Math.round(m.present / m.total * 100) : 0
      return { month: key, label: MONTHS_HE[d.getMonth()], pct }
    })
    setTrendPoints(pts)
  }

  if (!user) return null

  const totalPresent  = classStats.reduce((s, c) => s + c.present, 0)
  const totalAtt      = classStats.reduce((s, c) => s + c.total, 0)
  const avgPct        = totalAtt > 0 ? Math.round(totalPresent / totalAtt * 100) : 0
  const totalSessions = classStats.reduce((s, c) => s + c.sessions, 0)

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Title row + period picker */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 3px' }}>לוח בקרה — {period} ימים אחרונים</h2>
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>
            {new Date().toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['30', '90'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{ background: period === p ? '#b5e853' : '#1a1e1c', color: period === p ? '#0d0f0e' : '#7a8f7d', border: 'none', borderRadius: 8, padding: '5px 12px', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              {p === '30' ? '30 יום' : '90 יום'}
            </button>
          ))}
        </div>
      </div>

      {dataLoading ? (
        <div style={{ color: '#7a8f7d', padding: 40, textAlign: 'center' }}>טוען נתונים...</div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14, marginBottom: 28 }}>
            {[
              { label: 'ממוצע נוכחות',   value: `${avgPct}%`,       color: avgPct >= 80 ? '#4cdb7a' : avgPct >= 60 ? '#b5e853' : '#ff8080', icon: '📊' },
              { label: 'סה"כ אימונים',  value: totalSessions,        color: '#81d4fa',  icon: '🗓️' },
              { label: 'קבוצות פעילות', value: classStats.length,    color: '#b5e853',  icon: '🚵' },
              { label: 'התראות',         value: alerts.length,        color: alerts.length > 0 ? '#ff8080' : '#4cdb7a', icon: '⚠️' },
            ].map(c => (
              <div key={c.label} style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{c.icon}</div>
                <div style={{ fontSize: 11, color: '#7a8f7d', marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
            {/* Per-class */}
            <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #252b27', fontWeight: 700, fontSize: 15 }}>נוכחות לפי קבוצה</div>
              {classStats.length === 0 ? (
                <div style={{ padding: 24, color: '#7a8f7d', fontSize: 13, textAlign: 'center' }}>אין נתונים</div>
              ) : (
                classStats.map((c, i) => (
                  <Link key={`${c.class_name}${c.branch}`} href={`/admin/coordinator/history?group=${encodeURIComponent(c.class_name)}&branch=${encodeURIComponent(c.branch)}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit', cursor: 'pointer', padding: '11px 18px', borderBottom: i < classStats.length - 1 ? '1px solid #1a1e1c' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{c.class_name}</span>
                        <span style={{ marginRight: 6, background: BRANCH_COLORS[c.branch] ? BRANCH_COLORS[c.branch] + '22' : '#1a1e1c', color: BRANCH_COLORS[c.branch] ?? '#7a8f7d', padding: '1px 8px', borderRadius: 10, fontSize: 11 }}>
                          {c.branch}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#7a8f7d', fontSize: 11 }}>{c.present}/{c.total}</span>
                        <AttendanceBadge pct={c.pct} />
                      </div>
                    </div>
                    <ProgressBar pct={c.pct} />
                  </Link>
                ))
              )}
            </div>

            {/* Per-branch */}
            <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #252b27', fontWeight: 700, fontSize: 15 }}>נוכחות לפי סניף</div>
              {Object.keys(branchStats).length === 0 ? (
                <div style={{ padding: 24, color: '#7a8f7d', fontSize: 13, textAlign: 'center' }}>אין נתונים</div>
              ) : (
                Object.entries(branchStats).map(([branch, stats], i, arr) => {
                  const pct = stats.total > 0 ? Math.round(stats.present / stats.total * 100) : 0
                  return (
                    <Link key={branch} href={`/admin/coordinator/history?branch=${encodeURIComponent(branch)}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit', cursor: 'pointer', padding: '14px 18px', borderBottom: i < arr.length - 1 ? '1px solid #1a1e1c' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: BRANCH_COLORS[branch] ?? '#7a8f7d' }} />
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{branch}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#7a8f7d', fontSize: 12 }}>{stats.present}/{stats.total}</span>
                          <AttendanceBadge pct={pct} />
                        </div>
                      </div>
                      <ProgressBar pct={pct} />
                    </Link>
                  )
                })
              )}
            </div>
          </div>

          {/* Trend chart */}
          <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: '18px 20px', marginBottom: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>מגמת נוכחות שנתית</div>
            <TrendChart points={trendPoints} />
            <div style={{ display: 'flex', gap: 16, marginTop: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {[['#4cdb7a', '80%+'], ['#b5e853', '60-79%'], ['#ff6b6b', '<60%']].map(([color, label]) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#7a8f7d' }}>
                  <span style={{ width: 10, height: 10, background: color, borderRadius: 2, display: 'inline-block' }} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div style={{ background: '#141716', border: alerts.length > 0 ? '1px solid #ff4f4f44' : '1px solid #252b27', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #252b27', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>תלמידים עם 2+ היעדרויות</span>
              {alerts.length > 0 && (
                <span style={{ background: '#ff4f4f22', color: '#ff8080', border: '1px solid #ff4f4f44', borderRadius: 20, padding: '1px 10px', fontSize: 12, fontWeight: 700 }}>
                  {alerts.length}
                </span>
              )}
            </div>
            {alerts.length === 0 ? (
              <div style={{ padding: 28, color: '#4cdb7a', textAlign: 'center', fontSize: 14 }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>✓</div>
                אין תלמידים עם יותר מ-2 היעדרויות בתקופה זו
              </div>
            ) : (
              alerts.map((a, i) => (
                <div key={a.riderId} style={{ padding: '12px 18px', borderBottom: i < alerts.length - 1 ? '1px solid #1a1e1c' : 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ff4f4f22', border: '1px solid #ff4f4f44', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff8080', fontWeight: 900, fontSize: 14, flexShrink: 0 }}>
                    {a.absences}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{a.riderName}</div>
                    <div style={{ color: '#7a8f7d', fontSize: 12 }}>{a.lastClass} · {a.branch}</div>
                  </div>
                  <span style={{ background: '#ff4f4f22', color: '#ff8080', border: '1px solid #ff4f4f44', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {a.absences} היעדרויות
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
