'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'

const CLASSES  = ['גרביטי מתחילים', 'גרביטי מתקדמים', 'גרביטי פרו', 'רכיבה טכנית', 'כושר ואושר', 'רכיבה לנשים', 'טכני חשמלי', 'נשים טכני']
const BRANCHES = ['משגב', 'מצובה', 'ביריה', 'אמירים']
const BRANCH_COLOR: Record<string, string> = {
  'משגב':  '#b5e853',
  'מצובה': '#81d4fa',
  'ביריה': '#ff8f6b',
  'אמירים': '#c084fc',
}

type Session = {
  id: string
  class_name: string
  branch: string
  session_date: string
  duration: number
  instructor_id: string | null
  status: string | null
  notes: string | null
}
type Rider       = { id: string; full_name: string; phone: string | null }
type Instructor  = { id: string; name: string }

const inp: React.CSSProperties = {
  background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 8,
  color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 14,
  padding: '10px 12px', outline: 'none', width: '100%', boxSizing: 'border-box',
}

export default function AttendancePage() {
  const user  = useCoordinator()
  const today = new Date().toISOString().split('T')[0]

  const [date, setDate]         = useState(today)
  const [sessions, setSessions] = useState<Session[]>([])
  const [selected, setSelected] = useState<Session | null>(null)
  const [riders, setRiders]     = useState<Rider[]>([])
  const [attendance, setAtt]    = useState<Record<string, boolean>>({})
  const [instructors, setInst]  = useState<Instructor[]>([])
  const [loadingSess, setLoadingSess] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  // Add-rider-from-system search
  const [adding, setAdding]       = useState(false)
  const [searchQ, setSearchQ]     = useState('')
  const [searchRes, setSearchRes] = useState<Rider[]>([])
  const [searching, setSearching] = useState(false)
  const [makePermanent, setMakePermanent] = useState(false)

  const [showNew, setShowNew]         = useState(false)
  const [newClass, setNewClass]       = useState(CLASSES[0])
  const [newBranch, setNewBranch]     = useState('')
  const [newInstructor, setNewInst]   = useState('')
  const [newHours, setNewHours]       = useState('1.5')
  const [creating, setCreating]       = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('admin_roles').select('id, name').eq('role', 'instructor').order('name')
      .then(({ data }) => setInst(data ?? []))
  }, [user])

  useEffect(() => {
    if (!user) return
    loadSessions()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, date])

  async function loadSessions() {
    setLoadingSess(true)
    setSelected(null)
    setRiders([])
    setAtt({})
    const { data } = await supabase
      .from('class_sessions')
      .select('id, class_name, branch, session_date, duration, instructor_id, status, notes')
      .eq('session_date', date)
      .order('class_name')
    setSessions((data ?? []) as Session[])
    setLoadingSess(false)
  }

  const loadAttendance = useCallback(async (s: Session) => {
    setSelected(s)
    setRiders([])
    setAtt({})
    setAdding(false)
    setSearchQ('')
    setSearchRes([])
    const [{ data: riderData }, { data: attData }] = await Promise.all([
      supabase.from('riders').select('id, full_name, phone').eq('group_name', s.class_name).eq('branch', s.branch).eq('is_regular', true).order('full_name'),
      supabase.from('attendance').select('rider_id, present').eq('session_id', s.id),
    ])
    const list = riderData ?? []
    setRiders(list)
    const map: Record<string, boolean> = {}
    for (const a of attData ?? []) map[a.rider_id] = a.present
    for (const r of list) if (!(r.id in map)) map[r.id] = true
    setAtt(map)
  }, [])

  async function createSession() {
    if (!newBranch) return
    setCreating(true)
    const { data, error } = await supabase
      .from('class_sessions')
      .insert({ class_name: newClass, branch: newBranch, session_date: date, instructor_id: newInstructor || null, duration: parseFloat(newHours) || 1.5, status: 'open' })
      .select('id, class_name, branch, session_date, duration, instructor_id, status, notes')
      .single()
    if (error) { alert(error.message); setCreating(false); return }
    const s = data as unknown as Session
    setSessions(p => [...p, s])
    loadAttendance(s)
    setShowNew(false)
    setCreating(false)
  }

  async function saveAttendance() {
    if (!selected || riders.length === 0) return
    setSaving(true)
    const records = riders.map(r => ({ session_id: selected.id, rider_id: r.id, rider_name: r.full_name, present: attendance[r.id] ?? true, date: selected.session_date }))
    const { error } = await supabase.from('attendance').upsert(records, { onConflict: 'session_id,rider_id' })
    if (error) { alert(error.message); setSaving(false); return }
    setSavedMsg('נוכחות נשמרה! ✓')
    setTimeout(() => setSavedMsg(''), 3000)
    setSaving(false)
  }

  function toggle(rid: string) {
    setAtt(p => ({ ...p, [rid]: !p[rid] }))
  }

  async function searchRiders(q: string) {
    setSearchQ(q)
    if (q.trim().length < 2) { setSearchRes([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('riders')
      .select('id, full_name, phone')
      .ilike('full_name', `%${q.trim()}%`)
      .order('full_name')
      .limit(15)
    const existing = new Set(riders.map(r => r.id))
    setSearchRes((data ?? []).filter(r => !existing.has(r.id)))
    setSearching(false)
  }

  async function addRider(r: Rider) {
    setRiders(p => [...p, r])
    setAtt(p => ({ ...p, [r.id]: true }))
    setSearchQ('')
    setSearchRes([])
    setAdding(false)
    if (makePermanent && selected) {
      const patch: Record<string, unknown> = {
        group_name: selected.class_name,
        branch:     selected.branch,
        is_regular: true,
      }
      const { data: g } = await supabase
        .from('groups')
        .select('id')
        .eq('name', selected.class_name)
        .eq('branch', selected.branch)
        .maybeSingle()
      if (g?.id) patch.group_id = g.id
      await supabase.from('riders').update(patch).eq('id', r.id)
    }
  }

  if (!user) return null

  const presentCount = riders.filter(r => attendance[r.id] !== false).length

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>נוכחות</h2>
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>
            {new Date(date + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 8, color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 13, padding: '7px 12px', outline: 'none' }}
          />
          <button
            onClick={() => setShowNew(p => !p)}
            style={{ background: showNew ? '#1a1e1c' : '#b5e853', color: showNew ? '#7a8f7d' : '#0d0f0e', border: '1px solid #252b27', borderRadius: 8, padding: '7px 16px', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            {showNew ? '✕ ביטול' : '+ אימון חדש'}
          </button>
        </div>
      </div>

      {/* ── New session form ── */}
      {showNew && (
        <div style={{ background: '#141716', border: '1px solid #b5e85344', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#b5e853' }}>פתיחת אימון חדש</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 14 }}>
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
              <label style={{ fontSize: 11, color: '#7a8f7d', display: 'block', marginBottom: 4 }}>מדריך</label>
              <select value={newInstructor} onChange={e => setNewInst(e.target.value)} style={inp}>
                <option value="">ללא מדריך</option>
                {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
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

      {/* ── Main content: session list + attendance panel ── */}
      {loadingSess ? (
        <div style={{ color: '#7a8f7d', textAlign: 'center', padding: 60 }}>טוען...</div>
      ) : sessions.length === 0 ? (
        <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: 52, textAlign: 'center', color: '#7a8f7d' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
          <p style={{ margin: 0 }}>אין אימונים מוגדרים לתאריך זה</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>

          {/* Left: session list */}
          <div>
            <div style={{ fontSize: 12, color: '#7a8f7d', fontWeight: 600, marginBottom: 8 }}>
              {sessions.length} אימונים
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sessions.map(s => {
                const bc = BRANCH_COLOR[s.branch] ?? '#7a8f7d'
                const isSelected = selected?.id === s.id
                return (
                  <div
                    key={s.id}
                    onClick={() => loadAttendance(s)}
                    style={{ background: isSelected ? '#1a2e1a' : '#141716', border: `1px solid ${isSelected ? '#b5e85366' : '#252b27'}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'background .15s' }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 5, color: isSelected ? '#b5e853' : '#e8efe9' }}>{s.class_name}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ background: bc + '22', color: bc, borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>{s.branch}</span>
                      {s.instructor_id && <span style={{ color: '#7a8f7d', fontSize: 11 }}>👤 {instructors.find(i => i.id === s.instructor_id)?.name}</span>}
                      <span style={{ color: '#7a8f7d', fontSize: 11 }}>{s.duration}ש׳</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: attendance panel */}
          {selected ? (
            <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflow: 'hidden' }}>
              {/* Panel header */}
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #252b27', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: 16 }}>{selected.class_name}</span>
                <span style={{ color: '#7a8f7d', fontSize: 13 }}>📍 {selected.branch}</span>
                {selected.instructor_id && <span style={{ color: '#7a8f7d', fontSize: 13 }}>👤 {instructors.find(i => i.id === selected.instructor_id)?.name}</span>}
                <div style={{ marginRight: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={() => setAdding(p => !p)} style={{ background: adding ? '#1a1e1c' : '#1f2a1f', color: adding ? '#7a8f7d' : '#b5e853', border: '1px solid #b5e85344', borderRadius: 20, padding: '5px 13px', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    {adding ? '✕ סגור' : '➕ הוסף חניך'}
                  </button>
                  <span style={{ background: '#4cdb7a22', color: '#4cdb7a', border: '1px solid #4cdb7a44', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>✓ {presentCount}</span>
                  <span style={{ background: '#ff4f4f22', color: '#ff8080', border: '1px solid #ff4f4f44', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>✗ {riders.length - presentCount}</span>
                </div>
              </div>

              {adding && (
                <div style={{ padding: '12px 20px', borderBottom: '1px solid #252b27', background: '#0d0f0e' }}>
                  <input
                    autoFocus
                    value={searchQ}
                    onChange={e => searchRiders(e.target.value)}
                    placeholder="חיפוש חניך לפי שם..."
                    style={{ ...inp, marginBottom: 0 }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: makePermanent ? '#b5e853' : '#7a8f7d', fontSize: 12, margin: '10px 0', cursor: 'pointer' }}>
                    <input type="checkbox" checked={makePermanent} onChange={e => setMakePermanent(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#b5e853', cursor: 'pointer' }} />
                    קבע כחבר קבוע בקבוצה (יופיע אוטומטית באימונים הבאים)
                  </label>
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
                <div style={{ padding: 48, textAlign: 'center', color: '#7a8f7d' }}>לא נמצאו תלמידים רשומים לקבוצה זו</div>
              ) : (
                riders.map((r, i) => {
                  const present = attendance[r.id] !== false
                  return (
                    <div
                      key={r.id}
                      onClick={() => toggle(r.id)}
                      style={{ padding: '12px 20px', borderBottom: i < riders.length - 1 ? '1px solid #1a1e1c' : 'none', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: present ? 'transparent' : '#ff4f4f08' }}
                    >
                      <div style={{ width: 30, height: 30, borderRadius: '50%', border: `2px solid ${present ? '#4cdb7a' : '#ff6b6b'}`, background: present ? '#4cdb7a22' : '#ff4f4f22', display: 'flex', alignItems: 'center', justifyContent: 'center', color: present ? '#4cdb7a' : '#ff6b6b', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        {present ? '✓' : '✗'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: present ? '#e8efe9' : '#7a8f7d' }}>{r.full_name}</div>
                        {r.phone && <div style={{ color: '#7a8f7d', fontSize: 12 }}>📞 {r.phone}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={e => { e.stopPropagation(); setAtt(p => ({ ...p, [r.id]: true })) }} style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 11, background: present ? '#4cdb7a' : '#1a1e1c', color: present ? '#0d0f0e' : '#7a8f7d' }}>נוכח</button>
                        <button onClick={e => { e.stopPropagation(); setAtt(p => ({ ...p, [r.id]: false })) }} style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 11, background: !present ? '#ff6b6b' : '#1a1e1c', color: !present ? '#0d0f0e' : '#7a8f7d' }}>נעדר</button>
                      </div>
                    </div>
                  )
                })
              )}

              {riders.length > 0 && (
                <div style={{ padding: '14px 20px', borderTop: '1px solid #252b27', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={saveAttendance}
                    disabled={saving}
                    style={{ background: saving ? '#3a4f3a' : '#b5e853', color: saving ? '#7a8f7d' : '#0d0f0e', border: 'none', borderRadius: 8, padding: '10px 24px', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer' }}
                  >
                    {saving ? 'שומר...' : '💾 שמור נוכחות'}
                  </button>
                  {savedMsg && <span style={{ color: '#4cdb7a', fontSize: 13, fontWeight: 600 }}>{savedMsg}</span>}
                  <span style={{ marginRight: 'auto', color: '#7a8f7d', fontSize: 12 }}>
                    {presentCount}/{riders.length} נוכחים ({riders.length > 0 ? Math.round(presentCount / riders.length * 100) : 0}%)
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: 56, textAlign: 'center', color: '#7a8f7d' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>👆</div>
              <p style={{ margin: 0 }}>בחר אימון מהרשימה לצפייה ועריכת נוכחות</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
