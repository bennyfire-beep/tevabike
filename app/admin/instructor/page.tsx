'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminAuth } from '@/lib/use-admin-auth'

const CLASSES = [
  'גרביטי מתחילים', 'גרביטי מתקדמים', 'גרביטי פרו',
  'רכיבה טכנית', 'כושר ואושר', 'רכיבה לנשים', 'טכני חשמלי', 'נשים טכני',
]
const BRANCHES = ['משגב', 'מצובה', 'ביריה']

type Session = {
  id: string
  class_name: string
  branch: string
  session_date: string
  duration_hours: number
}
type Rider = { id: string; full_name: string; phone: string | null; group_name: string | null; branch: string | null }
type HistoryRow = { session: Session; presentCount: number; totalCount: number }

const inp: React.CSSProperties = {
  background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 8,
  color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 14,
  padding: '10px 12px', outline: 'none', width: '100%', boxSizing: 'border-box',
}

type SalaryRow = { date: string; class_name: string; branch: string; hours: number }

export default function InstructorPage() {
  const { user, loading, logout } = useAdminAuth('instructor')

  // Active tab
  const [activeTab, setActiveTab] = useState<'attendance' | 'salary'>('attendance')

  // Attendance tab state
  const [sessions, setSessions]             = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [riders, setRiders]                 = useState<Rider[]>([])
  const [attendance, setAttendance]         = useState<Record<string, boolean>>({})
  const [saving, setSaving]                 = useState(false)
  const [savedMsg, setSavedMsg]             = useState('')
  const [history, setHistory]               = useState<HistoryRow[]>([])

  // Add-rider-from-system search
  const [adding, setAdding]                 = useState(false)
  const [searchQ, setSearchQ]               = useState('')
  const [searchRes, setSearchRes]           = useState<Rider[]>([])
  const [searching, setSearching]           = useState(false)

  // New-session form
  const [showNew, setShowNew]       = useState(false)
  const [newClass, setNewClass]     = useState(CLASSES[0])
  const [newBranch, setNewBranch]   = useState('')
  const [newHours, setNewHours]     = useState('1.5')
  const [creating, setCreating]     = useState(false)

  // Salary tab state
  const [salaryMonth, setSalaryMonth]   = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [salaryRows, setSalaryRows]     = useState<SalaryRow[]>([])
  const [salaryLoading, setSalaryLoading] = useState(false)
  const [monthlyHours, setMonthlyHours] = useState(0)
  const [monthlySalary, setMonthlySalary] = useState(0)

  const today = new Date().toISOString().split('T')[0]
  const todayLabel = new Date().toLocaleDateString('he-IL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const loadHistory = useCallback(async (adminRoleId: string) => {
    const { data: pastSessions } = await supabase
      .from('class_sessions')
      .select('id, class_name, branch, session_date, duration_hours')
      .eq('instructor_id', adminRoleId)
      .lt('session_date', today)
      .order('session_date', { ascending: false })
      .limit(6)

    if (!pastSessions?.length) return

    const rows: HistoryRow[] = await Promise.all(
      pastSessions.map(async s => {
        const { data: att } = await supabase
          .from('attendance')
          .select('present')
          .eq('session_id', s.id)
        const total   = att?.length ?? 0
        const present = att?.filter(a => a.present).length ?? 0
        return { session: s, presentCount: present, totalCount: total }
      })
    )
    setHistory(rows)
  }, [today])

  const loadSessionStudents = useCallback(async (session: Session) => {
    setSelectedSession(session)
    setRiders([])
    setAttendance({})
    setAdding(false)
    setSearchQ('')
    setSearchRes([])

    const { data: riderData } = await supabase
      .from('riders')
      .select('id, full_name, phone, group_name, branch')
      .eq('group_name', session.class_name)
      .eq('branch', session.branch)
      .eq('is_regular', true)
      .order('full_name')

    const list = riderData ?? []
    setRiders(list)

    const { data: attData } = await supabase
      .from('attendance')
      .select('rider_id, present')
      .eq('session_id', session.id)

    const map: Record<string, boolean> = {}
    for (const a of attData ?? []) map[a.rider_id] = a.present
    for (const r of list) if (!(r.id in map)) map[r.id] = true
    setAttendance(map)
  }, [])

  useEffect(() => {
    if (!user) return
    async function init() {
      const { data: todaySessions } = await supabase
        .from('class_sessions')
        .select('id, class_name, branch, session_date, duration_hours')
        .eq('instructor_id', user!.adminRoleId)
        .eq('session_date', today)
        .order('created_at')

      const list = todaySessions ?? []
      setSessions(list)
      if (list.length > 0) loadSessionStudents(list[0])
      await loadHistory(user!.adminRoleId)
    }
    init()
  }, [user, today, loadSessionStudents, loadHistory])

  async function createSession() {
    if (!user || !newBranch) return
    setCreating(true)
    const { data, error } = await supabase
      .from('class_sessions')
      .insert({
        class_name:     newClass,
        branch:         newBranch,
        session_date:   today,
        instructor_id:  user.adminRoleId,
        instructor_name: user.name,
        duration_hours: parseFloat(newHours) || 1.5,
      })
      .select('id, class_name, branch, session_date, duration_hours')
      .single()

    if (error) { alert('שגיאה: ' + error.message); setCreating(false); return }
    const newS = data as Session
    setSessions(p => [...p, newS])
    loadSessionStudents(newS)
    setShowNew(false)
    setCreating(false)
  }

  async function saveAttendance() {
    if (!selectedSession || riders.length === 0) return
    setSaving(true)
    const records = riders.map(r => ({
      session_id: selectedSession.id,
      rider_id:   r.id,
      rider_name: r.full_name,
      present:    attendance[r.id] ?? true,
      date:       selectedSession.session_date,
    }))
    const { error } = await supabase
      .from('attendance')
      .upsert(records, { onConflict: 'session_id,rider_id' })
    if (error) { alert('שגיאה: ' + error.message); setSaving(false); return }

    // Auto-log instructor hours (once per session — ignored if already exists)
    await supabase.from('instructor_hours').upsert({
      instructor_id: user!.adminRoleId,
      session_id:    selectedSession.id,
      date:          selectedSession.session_date,
      class_name:    selectedSession.class_name,
      branch:        selectedSession.branch,
      hours:         selectedSession.duration_hours ?? 1.5,
    }, { onConflict: 'session_id,instructor_id', ignoreDuplicates: true })

    setSavedMsg('נוכחות נשמרה! ✓ שעות עבודה עודכנו')
    setTimeout(() => setSavedMsg(''), 3500)
    await loadHistory(user!.adminRoleId)
    setSaving(false)
  }

  async function loadSalaryData(adminRoleId: string, ym: string) {
    setSalaryLoading(true)
    const [y, m] = ym.split('-').map(Number)
    const first  = `${ym}-01`
    const last   = new Date(y, m, 0).toISOString().split('T')[0]

    const { data } = await supabase
      .from('instructor_hours')
      .select('date, class_name, branch, hours')
      .eq('instructor_id', adminRoleId)
      .gte('date', first)
      .lte('date', last)
      .order('date')

    const rows  = data ?? []
    const total = rows.reduce((s, r) => s + Number(r.hours), 0)
    setSalaryRows(rows.map(r => ({ date: r.date, class_name: r.class_name, branch: r.branch, hours: Number(r.hours) })))
    setMonthlyHours(Math.round(total * 10) / 10)
    setMonthlySalary(Math.round(total * (user?.hourlyRate ?? 60)))
    setSalaryLoading(false)
  }

  function toggle(riderId: string) {
    setAttendance(p => ({ ...p, [riderId]: !p[riderId] }))
  }

  async function searchRiders(q: string) {
    setSearchQ(q)
    if (q.trim().length < 2) { setSearchRes([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('riders')
      .select('id, full_name, phone, group_name, branch')
      .ilike('full_name', `%${q.trim()}%`)
      .order('full_name')
      .limit(15)
    const existing = new Set(riders.map(r => r.id))
    setSearchRes((data ?? []).filter(r => !existing.has(r.id)))
    setSearching(false)
  }

  function addRider(r: Rider) {
    setRiders(p => [...p, r])
    setAttendance(p => ({ ...p, [r.id]: true }))
    setSearchQ('')
    setSearchRes([])
    setAdding(false)
  }

  if (loading) return (
    <div style={{ background: '#0d0f0e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7a8f7d', fontFamily: 'Heebo, Arial, sans-serif' }}>
      טוען...
    </div>
  )

  const presentCount = riders.filter(r => attendance[r.id] !== false).length

  const tabBtn = (id: 'attendance' | 'salary', label: string) => (
    <button
      key={id}
      onClick={() => {
        setActiveTab(id)
        if (id === 'salary' && user) loadSalaryData(user.adminRoleId, salaryMonth)
      }}
      style={{
        padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
        fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 13,
        background: activeTab === id ? '#b5e853' : '#1a1e1c',
        color:      activeTab === id ? '#0d0f0e'  : '#7a8f7d',
      }}
    >{label}</button>
  )

  return (
    <div dir="rtl" style={{ fontFamily: 'Heebo, Arial, sans-serif', background: '#0d0f0e', minHeight: '100vh', color: '#e8efe9' }}>
      {/* ── Header ── */}
      <div style={{ background: '#141716', borderBottom: '1px solid #252b27', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ color: '#b5e853', fontWeight: 900, fontSize: 18 }}>🚵 טבע בייק</span>
        <span style={{ background: '#1a2e1a', color: '#b5e853', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>מדריך</span>
        <span style={{ color: '#e8efe9', fontSize: 14, fontWeight: 700 }}>{user?.name}</span>
        {user?.branch && <span style={{ color: '#7a8f7d', fontSize: 13 }}>📍 {user.branch}</span>}
        <div style={{ marginRight: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 4 }}>
            {tabBtn('attendance', '📋 נוכחות')}
            {tabBtn('salary',     '💰 שכר')}
          </div>
          {activeTab === 'attendance' && (
            <button
              onClick={() => setShowNew(p => !p)}
              style={{ background: showNew ? '#1a1e1c' : '#b5e853', color: showNew ? '#7a8f7d' : '#0d0f0e', border: '1px solid #252b27', borderRadius: 8, padding: '6px 14px', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              {showNew ? '✕ ביטול' : '+ אימון חדש'}
            </button>
          )}
          <button onClick={logout} style={{ background: 'transparent', border: '1px solid #252b27', color: '#7a8f7d', borderRadius: 8, padding: '6px 14px', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 13, cursor: 'pointer' }}>
            יציאה
          </button>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 860, margin: '0 auto' }}>
        {/* ── ATTENDANCE TAB ─────────────────────────────────────────────── */}
        {activeTab === 'attendance' && <>
        {/* Date */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 800 }}>אימון היום</h2>
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>{todayLabel}</p>
        </div>

        {/* New session form */}
        {showNew && (
          <div style={{ background: '#141716', border: '1px solid #b5e85344', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 16px', color: '#b5e853', fontSize: 15 }}>פתיחת אימון חדש</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: '#7a8f7d', display: 'block', marginBottom: 4 }}>קבוצה</label>
                <select value={newClass} onChange={e => setNewClass(e.target.value)} style={inp}>
                  {CLASSES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#7a8f7d', display: 'block', marginBottom: 4 }}>סניף *</label>
                <select value={newBranch} onChange={e => setNewBranch(e.target.value)} style={inp}>
                  <option value="">בחר סניף...</option>
                  {BRANCHES.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#7a8f7d', display: 'block', marginBottom: 4 }}>משך (שעות)</label>
                <input type="number" step="0.5" min="0.5" max="4" value={newHours} onChange={e => setNewHours(e.target.value)} style={inp} />
              </div>
            </div>
            <button
              onClick={createSession}
              disabled={creating || !newBranch}
              style={{ background: creating || !newBranch ? '#3a4f3a' : '#b5e853', color: creating || !newBranch ? '#7a8f7d' : '#0d0f0e', border: 'none', borderRadius: 8, padding: '10px 22px', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 15, cursor: creating || !newBranch ? 'default' : 'pointer' }}
            >
              {creating ? 'יוצר...' : '✓ פתח אימון'}
            </button>
          </div>
        )}

        {/* Session selector (if multiple today) */}
        {sessions.length > 1 && (
          <div style={{ marginBottom: 16 }}>
            <select
              value={selectedSession?.id ?? ''}
              onChange={e => {
                const s = sessions.find(x => x.id === e.target.value)
                if (s) loadSessionStudents(s)
              }}
              style={inp}
            >
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{s.class_name} — {s.branch} ({s.duration_hours}ש')</option>
              ))}
            </select>
          </div>
        )}

        {/* No sessions today */}
        {sessions.length === 0 && !showNew && (
          <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: 32, textAlign: 'center', color: '#7a8f7d' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <p style={{ margin: '0 0 12px' }}>אין אימונים מוגדרים להיום</p>
            <button
              onClick={() => setShowNew(true)}
              style={{ background: '#b5e853', color: '#0d0f0e', border: 'none', borderRadius: 8, padding: '10px 24px', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              + פתח אימון חדש
            </button>
          </div>
        )}

        {/* Attendance table */}
        {selectedSession && (
          <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
            {/* Card header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #252b27', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, fontSize: 16 }}>{selectedSession.class_name}</span>
              <span style={{ background: '#1a2e1a', color: '#b5e853', padding: '2px 10px', borderRadius: 12, fontSize: 12 }}>📍 {selectedSession.branch}</span>
              <span style={{ color: '#7a8f7d', fontSize: 13 }}>{selectedSession.duration_hours}ש' אימון</span>
              <div style={{ marginRight: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => setAdding(p => !p)} style={{ background: adding ? '#1a1e1c' : '#1f2a1f', color: adding ? '#7a8f7d' : '#b5e853', border: '1px solid #b5e85344', borderRadius: 20, padding: '5px 13px', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  {adding ? '✕ סגור' : '➕ הוסף חניך'}
                </button>
                <span style={{ background: '#4cdb7a22', color: '#4cdb7a', border: '1px solid #4cdb7a44', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                  ✓ {presentCount}
                </span>
                <span style={{ background: '#ff4f4f22', color: '#ff8080', border: '1px solid #ff4f4f44', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                  ✗ {riders.length - presentCount}
                </span>
                <span style={{ color: '#7a8f7d', fontSize: 12 }}>{riders.length} תלמידים</span>
              </div>
            </div>

            {adding && (
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #252b27', background: '#0d0f0e' }}>
                <input
                  autoFocus
                  value={searchQ}
                  onChange={e => searchRiders(e.target.value)}
                  placeholder="חיפוש חניך לפי שם..."
                  style={{ ...inp, marginBottom: (searching || searchRes.length > 0 || searchQ.trim().length >= 2) ? 10 : 0 }}
                />
                {searching && <div style={{ color: '#7a8f7d', fontSize: 12 }}>מחפש...</div>}
                {searchRes.map(r => (
                  <div key={r.id} onClick={() => addRider(r)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: '#141716', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{r.full_name}</span>
                    {r.phone && <span style={{ color: '#7a8f7d', fontSize: 12 }}>📞 {r.phone}</span>}
                    <span style={{ marginRight: 'auto', color: '#b5e853', fontSize: 18, fontWeight: 700, lineHeight: 1 }}>＋</span>
                  </div>
                ))}
                {!searching && searchQ.trim().length >= 2 && searchRes.length === 0 && (
                  <div style={{ color: '#7a8f7d', fontSize: 12 }}>לא נמצאו רוכבים תואמים (ייתכן שכבר ברשימה)</div>
                )}
              </div>
            )}

            {riders.length === 0 ? (
              <div style={{ padding: 32, color: '#7a8f7d', textAlign: 'center' }}>
                לא נמצאו תלמידים רשומים לקבוצה זו
              </div>
            ) : (
              riders.map((r, i) => {
                const isPresent = attendance[r.id] !== false
                return (
                  <div
                    key={r.id}
                    onClick={() => toggle(r.id)}
                    style={{
                      padding: '13px 20px',
                      borderBottom: i < riders.length - 1 ? '1px solid #1a1e1c' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      cursor: 'pointer',
                      background: isPresent ? 'transparent' : '#ff4f4f08',
                      transition: 'background .1s',
                    }}
                  >
                    {/* Toggle circle */}
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', border: `2px solid ${isPresent ? '#4cdb7a' : '#ff6b6b'}`,
                      background: isPresent ? '#4cdb7a22' : '#ff4f4f22',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, color: isPresent ? '#4cdb7a' : '#ff6b6b',
                      flexShrink: 0, fontWeight: 700,
                    }}>
                      {isPresent ? '✓' : '✗'}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: isPresent ? '#e8efe9' : '#7a8f7d' }}>
                        {r.full_name}
                      </div>
                      {r.phone && (
                        <div style={{ color: '#7a8f7d', fontSize: 12, marginTop: 1 }}>📞 {r.phone}</div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={ev => { ev.stopPropagation(); setAttendance(p => ({ ...p, [r.id]: true })) }}
                        style={{
                          padding: '5px 14px', borderRadius: 20, border: 'none',
                          cursor: 'pointer', fontFamily: 'Heebo, Arial, sans-serif',
                          fontWeight: 700, fontSize: 12,
                          background: isPresent ? '#4cdb7a' : '#1a1e1c',
                          color: isPresent ? '#0d0f0e' : '#7a8f7d',
                        }}
                      >נוכח</button>
                      <button
                        onClick={ev => { ev.stopPropagation(); setAttendance(p => ({ ...p, [r.id]: false })) }}
                        style={{
                          padding: '5px 14px', borderRadius: 20, border: 'none',
                          cursor: 'pointer', fontFamily: 'Heebo, Arial, sans-serif',
                          fontWeight: 700, fontSize: 12,
                          background: !isPresent ? '#ff6b6b' : '#1a1e1c',
                          color: !isPresent ? '#0d0f0e' : '#7a8f7d',
                        }}
                      >נעדר</button>
                    </div>
                  </div>
                )
              })
            )}

            {/* Save bar */}
            {riders.length > 0 && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid #252b27', display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={saveAttendance}
                  disabled={saving}
                  style={{
                    background: saving ? '#3a4f3a' : '#b5e853',
                    color: saving ? '#7a8f7d' : '#0d0f0e',
                    border: 'none', borderRadius: 8,
                    padding: '10px 26px', fontFamily: 'Heebo, Arial, sans-serif',
                    fontWeight: 700, fontSize: 15, cursor: saving ? 'default' : 'pointer',
                  }}
                >
                  {saving ? 'שומר...' : '💾 שמור נוכחות'}
                </button>
                {savedMsg && (
                  <span style={{ color: '#4cdb7a', fontSize: 14, fontWeight: 600 }}>✓ {savedMsg}</span>
                )}
                <span style={{ marginRight: 'auto', color: '#7a8f7d', fontSize: 13 }}>
                  {presentCount}/{riders.length} תלמידים נוכחים ({riders.length > 0 ? Math.round(presentCount / riders.length * 100) : 0}%)
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Attendance History ── */}
        {history.length > 0 && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>היסטוריית אימונים אחרונים</h3>
            <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '10px 20px', borderBottom: '1px solid #252b27', fontSize: 11, color: '#7a8f7d', fontWeight: 600 }}>
                <span>קבוצה / סניף</span><span>תאריך</span><span>נוכחות</span><span>אחוז</span>
              </div>
              {history.map((row, i) => {
                const pct = row.totalCount > 0 ? Math.round(row.presentCount / row.totalCount * 100) : null
                const color = pct === null ? '#7a8f7d' : pct >= 80 ? '#4cdb7a' : pct >= 60 ? '#b5e853' : '#ff8080'
                return (
                  <div
                    key={row.session.id}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '12px 20px', borderBottom: i < history.length - 1 ? '1px solid #1a1e1c' : 'none', alignItems: 'center' }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{row.session.class_name}</div>
                      <div style={{ color: '#7a8f7d', fontSize: 12 }}>{row.session.branch}</div>
                    </div>
                    <span style={{ color: '#7a8f7d', fontSize: 13 }}>
                      {new Date(row.session.session_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </span>
                    <span style={{ color: '#e8efe9', fontSize: 14 }}>
                      {row.presentCount}/{row.totalCount}
                    </span>
                    <span style={{ color, fontWeight: 700, fontSize: 14 }}>
                      {pct !== null ? `${pct}%` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {/* end attendance tab */}
        </>}

        {/* ── SALARY TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'salary' && (
          <div>
            {/* Month selector + KPIs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>הכנסות שלי</h2>
              <select
                value={salaryMonth}
                onChange={e => { setSalaryMonth(e.target.value); loadSalaryData(user!.adminRoleId, e.target.value) }}
                style={{ background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 8, color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 13, padding: '6px 12px', outline: 'none' }}
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
                  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                  return <option key={ym} value={ym}>{d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}</option>
                })}
              </select>
            </div>

            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'שיעורים',    value: salaryRows.length, color: '#81d4fa', icon: '🗓️' },
                { label: 'שעות',       value: `${monthlyHours}ש'`, color: '#b5e853', icon: '⏱️' },
                { label: 'סה"כ לתשלום', value: `₪${monthlySalary.toLocaleString()}`, color: '#4cdb7a', icon: '💰' },
              ].map(c => (
                <div key={c.label} style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: '16px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{c.icon}</div>
                  <div style={{ fontSize: 11, color: '#7a8f7d', marginBottom: 3 }}>{c.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: c.color }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Details table */}
            <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 100px 60px 80px', padding: '10px 20px', borderBottom: '1px solid #252b27', fontSize: 11, color: '#7a8f7d', fontWeight: 700 }}>
                <span>תאריך</span><span>קבוצה</span><span>סניף</span><span>שעות</span><span>תשלום</span>
              </div>
              {salaryLoading ? (
                <div style={{ padding: 24, color: '#7a8f7d', textAlign: 'center' }}>טוען...</div>
              ) : salaryRows.length === 0 ? (
                <div style={{ padding: 32, color: '#7a8f7d', textAlign: 'center' }}>
                  אין שעות מתועדות לחודש זה
                </div>
              ) : (
                salaryRows.map((r, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 100px 60px 80px', padding: '12px 20px', borderBottom: i < salaryRows.length - 1 ? '1px solid #1a1e1c' : 'none', alignItems: 'center', fontSize: 13 }}>
                    <span style={{ color: '#7a8f7d' }}>{new Date(r.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}</span>
                    <span style={{ fontWeight: 600 }}>{r.class_name}</span>
                    <span style={{ color: '#7a8f7d' }}>{r.branch}</span>
                    <span style={{ color: '#b5e853' }}>{r.hours}ש'</span>
                    <span style={{ color: '#4cdb7a', fontWeight: 700 }}>₪{(r.hours * (user?.hourlyRate ?? 60)).toFixed(0)}</span>
                  </div>
                ))
              )}
              {/* Total row */}
              {salaryRows.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 100px 60px 80px', padding: '12px 20px', borderTop: '1px solid #252b27', background: '#1a1e1c', alignItems: 'center' }}>
                  <span style={{ color: '#7a8f7d', fontSize: 12 }}>סה"כ</span>
                  <span /><span />
                  <span style={{ color: '#b5e853', fontWeight: 700 }}>{monthlyHours}ש'</span>
                  <span style={{ color: '#4cdb7a', fontWeight: 900, fontSize: 16 }}>₪{monthlySalary.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Print button */}
            {salaryRows.length > 0 && (
              <button
                onClick={() => {
                  const ymLabel = new Date(parseInt(salaryMonth.split('-')[0]), parseInt(salaryMonth.split('-')[1]) - 1, 1)
                    .toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
                  const html = `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"><title>תלוש שכר</title>
<style>@page{margin:18mm}body{font-family:Arial,sans-serif;font-size:14px}h1{font-size:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:right}th{background:#f0f0f0}tfoot td{font-weight:700;background:#f7f7f5}</style>
</head><body>
<h1>🚵 טבע בייק — תלוש שכר</h1>
<p><strong>מדריך:</strong> ${user?.name} &nbsp;&nbsp; <strong>חודש:</strong> ${ymLabel} &nbsp;&nbsp; <strong>שכר לשעה:</strong> ₪${user?.hourlyRate ?? 60}</p>
<table><thead><tr><th>תאריך</th><th>קבוצה</th><th>סניף</th><th>שעות</th><th>תשלום</th></tr></thead><tbody>
${salaryRows.map(r => `<tr><td>${new Date(r.date).toLocaleDateString('he-IL')}</td><td>${r.class_name}</td><td>${r.branch}</td><td>${r.hours}</td><td>₪${(r.hours * (user?.hourlyRate ?? 60)).toFixed(0)}</td></tr>`).join('')}
</tbody><tfoot><tr><td colspan="3">סה"כ</td><td>${monthlyHours}ש'</td><td>₪${monthlySalary.toLocaleString()}</td></tr></tfoot></table>
<p style="margin-top:24px;font-size:12px;color:#888">הופק ב-${new Date().toLocaleDateString('he-IL')}</p>
<script>window.onload=()=>window.print()</script></body></html>`
                  const win = window.open('', '_blank', 'width=820,height=600')
                  if (win) { win.document.write(html); win.document.close() }
                }}
                style={{ background: '#D4288A', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(212,40,138,0.3)' }}
              >
                📄 הפק תלוש PDF
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
