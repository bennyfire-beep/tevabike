'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { resolveGroupId, groupRiderIds } from '@/lib/rider-groups'
import { saveAttendanceAndPay } from '@/lib/attendance'
import { useCoordinator } from '@/lib/coordinator-context'

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
  group_id: string | null
  start_time: string | null
  end_time: string | null
  type: 'regular' | 'special' | null
  activity_name: string | null
  instructor_ids: string[] | null
}
type Rider       = { id: string; full_name: string; phone: string | null }
type Instructor  = { id: string; name: string; active: boolean }
type Group       = { id: string; name: string; branch: string; start_time: string | null; end_time: string | null }

const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : '')
function hoursBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const diff = (eh * 60 + em) - (sh * 60 + sm)
  return diff > 0 ? +(diff / 60).toFixed(2) : null
}

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

  const [groups, setGroups]           = useState<Group[]>([])
  const [showNew, setShowNew]         = useState(false)
  const [newGroupId, setNewGroupId]   = useState('')
  const [newInstructor, setNewInst]   = useState('')
  const [newHours, setNewHours]       = useState('1.5')
  const [creating, setCreating]       = useState(false)

  // Special activity (camp) form
  const [showSpecial, setShowSpecial]     = useState(false)
  const [spName, setSpName]               = useState('')
  const [spHours, setSpHours]             = useState('6')
  const [spInstructors, setSpInstructors] = useState<string[]>([])
  const [spParticipants, setSpParts]      = useState<Rider[]>([])
  const [spSearchQ, setSpSearchQ]         = useState('')
  const [spSearchRes, setSpSearchRes]     = useState<Rider[]>([])
  const [spSearching, setSpSearching]     = useState(false)
  const [spCreating, setSpCreating]       = useState(false)

  useEffect(() => {
    if (!user) return
    // Load all instructors (active + inactive) so old sessions still resolve
    // names; the selection dropdown filters to active only.
    supabase.from('admin_roles').select('id, name, active').eq('role', 'instructor').order('name')
      .then(({ data }) => setInst((data ?? []) as Instructor[]))
    supabase.from('groups').select('id, name, branch, start_time, end_time').eq('is_active', true).order('branch').order('name')
      .then(({ data }) => setGroups((data ?? []) as Group[]))
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
      .select('id, class_name, branch, session_date, duration, instructor_id, status, notes, group_id, start_time, end_time, type, activity_name, instructor_ids')
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

    // Special activities aren't group-bound: their participant list lives in the
    // attendance rows created when the activity was set up.
    if (s.type === 'special') {
      const { data: attData } = await supabase.from('attendance').select('rider_id, present').eq('session_id', s.id)
      const ids = (attData ?? []).map(a => a.rider_id)
      let list: Rider[] = []
      if (ids.length) {
        const { data: riderData } = await supabase
          .from('riders').select('id, full_name, phone').in('id', ids).order('full_name')
        list = riderData ?? []
      }
      setRiders(list)
      const map: Record<string, boolean> = {}
      for (const a of attData ?? []) map[a.rider_id] = a.present
      for (const r of list) if (!(r.id in map)) map[r.id] = true
      setAtt(map)
      return
    }

    // Group membership now lives in rider_groups.
    const groupId = await resolveGroupId(s.group_id, s.class_name, s.branch)
    let list: Rider[] = []
    if (groupId) {
      const ids = await groupRiderIds(groupId)
      if (ids.length) {
        const { data: riderData } = await supabase
          .from('riders')
          .select('id, full_name, phone')
          .in('id', ids)
          .order('full_name')
        list = riderData ?? []
      }
    } else {
      // Legacy fallback when no matching group row exists.
      const { data: riderData } = await supabase
        .from('riders')
        .select('id, full_name, phone')
        .eq('group_name', s.class_name).eq('branch', s.branch).eq('is_regular', true)
        .order('full_name')
      list = riderData ?? []
    }

    const { data: attData } = await supabase.from('attendance').select('rider_id, present').eq('session_id', s.id)
    setRiders(list)
    const map: Record<string, boolean> = {}
    for (const a of attData ?? []) map[a.rider_id] = a.present
    for (const r of list) if (!(r.id in map)) map[r.id] = true
    setAtt(map)
  }, [])

  async function createSession() {
    const g = groups.find(x => x.id === newGroupId)
    if (!g) return
    setCreating(true)
    const { data, error } = await supabase
      .from('class_sessions')
      .insert({ group_id: g.id, class_name: g.name, branch: g.branch, session_date: date, start_time: g.start_time, end_time: g.end_time, instructor_id: newInstructor || null, duration: parseFloat(newHours) || 1.5, status: 'open' })
      .select('id, class_name, branch, session_date, duration, instructor_id, status, notes, group_id, start_time, end_time, type, activity_name, instructor_ids')
      .single()
    if (error) { alert(error.message); setCreating(false); return }
    const s = data as unknown as Session
    setSessions(p => [...p, s])
    loadAttendance(s)
    setShowNew(false)
    setCreating(false)
  }

  async function spSearchRiders(q: string) {
    setSpSearchQ(q)
    if (q.trim().length < 2) { setSpSearchRes([]); return }
    setSpSearching(true)
    const { data } = await supabase
      .from('riders')
      .select('id, full_name, phone')
      .eq('active', true)
      .ilike('full_name', `%${q.trim()}%`)
      .order('full_name')
      .limit(15)
    const existing = new Set(spParticipants.map(r => r.id))
    setSpSearchRes((data ?? []).filter(r => !existing.has(r.id)))
    setSpSearching(false)
  }

  function toggleSpInstructor(id: string) {
    setSpInstructors(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  }

  async function createSpecialActivity() {
    if (!spName.trim() || spInstructors.length === 0 || spParticipants.length === 0) return
    setSpCreating(true)
    const hours = parseFloat(spHours) || 0
    const { data, error } = await supabase
      .from('class_sessions')
      .insert({
        type: 'special',
        activity_name: spName.trim(),
        class_name: spName.trim(),   // keep class_name populated for pages that read it
        branch: null,
        session_date: date,
        duration: hours,
        instructor_id: spInstructors[0],
        instructor_ids: spInstructors,
        status: 'open',
      })
      .select('id, class_name, branch, session_date, duration, instructor_id, status, notes, group_id, start_time, end_time, type, activity_name, instructor_ids')
      .single()
    if (error) { alert(error.message); setSpCreating(false); return }
    const s = data as unknown as Session
    // Persist the chosen participants (all present by default) and compute pay.
    const res = await saveAttendanceAndPay(s, spParticipants.map(r => ({ id: r.id, full_name: r.full_name })), {})
    if (res.error) alert(res.error)
    setSessions(p => [...p, s])
    loadAttendance(s)
    setShowSpecial(false)
    setSpName(''); setSpHours('6'); setSpInstructors([]); setSpParts([]); setSpSearchQ(''); setSpSearchRes([])
    setSpCreating(false)
  }

  async function saveAttendance() {
    if (!selected || riders.length === 0) return
    setSaving(true)
    // Shared save flow: upserts attendance and recomputes the instructor pay.
    const res = await saveAttendanceAndPay(selected, riders, attendance)
    if (res.error) { alert(res.error); setSaving(false); return }
    setSavedMsg(`נוכחות נשמרה! ✓ ${res.presentCount} נוכחים · שכר ₪${res.pay.toLocaleString()}`)
    setTimeout(() => setSavedMsg(''), 4000)
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
      // Resolve the group id (from the session, or by name/branch for legacy sessions).
      const gid = await resolveGroupId(selected.group_id, selected.class_name, selected.branch)
      // Membership link is the source of truth.
      if (gid) {
        await supabase.from('rider_groups').upsert({ rider_id: r.id, group_id: gid }, { onConflict: 'rider_id,group_id' })
      }
      // Keep legacy denormalized columns in sync for pages not yet migrated.
      const patch: Record<string, unknown> = {
        group_name: selected.class_name,
        branch:     selected.branch,
        is_regular: true,
      }
      if (gid) patch.group_id = gid
      await supabase.from('riders').update(patch).eq('id', r.id)
    }
  }

  async function removeFromGroup(rider: Rider) {
    if (!selected) return
    // Special activities aren't group-bound: just drop the participant from this
    // activity (delete their attendance row) rather than touching group membership.
    if (selected.type === 'special') {
      if (!window.confirm(`להסיר את ${rider.full_name} מהפעילות?`)) return
      await supabase.from('attendance').delete().eq('session_id', selected.id).eq('rider_id', rider.id)
      setRiders(p => p.filter(x => x.id !== rider.id))
      setAtt(p => { const n = { ...p }; delete n[rider.id]; return n })
      return
    }
    if (!window.confirm(`להסיר את ${rider.full_name} מהקבוצה?\nהוא יישאר במערכת, אבל לא יופיע יותר אוטומטית באימוני קבוצה זו.`)) return
    if (selected.group_id) {
      await supabase.from('rider_groups').delete().eq('rider_id', rider.id).eq('group_id', selected.group_id)
    } else {
      // Legacy session without a group_id: fall back to the old flag.
      await supabase.from('riders').update({ is_regular: false }).eq('id', rider.id)
    }
    setRiders(p => p.filter(x => x.id !== rider.id))
    setAtt(p => { const n = { ...p }; delete n[rider.id]; return n })
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
            onClick={() => { setShowNew(p => !p); setShowSpecial(false) }}
            style={{ background: showNew ? '#1a1e1c' : '#b5e853', color: showNew ? '#7a8f7d' : '#0d0f0e', border: '1px solid #252b27', borderRadius: 8, padding: '7px 16px', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            {showNew ? '✕ ביטול' : '+ אימון חדש'}
          </button>
          <button
            onClick={() => { setShowSpecial(p => !p); setShowNew(false) }}
            style={{ background: showSpecial ? '#1a1e1c' : '#c084fc', color: showSpecial ? '#c084fc' : '#0d0f0e', border: '1px solid #c084fc55', borderRadius: 8, padding: '7px 16px', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            {showSpecial ? '✕ ביטול' : '★ פעילות מיוחדת'}
          </button>
        </div>
      </div>

      {/* ── New session form ── */}
      {showNew && (
        <div style={{ background: '#141716', border: '1px solid #b5e85344', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#b5e853' }}>פתיחת אימון חדש</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: '#7a8f7d', display: 'block', marginBottom: 4 }}>קבוצה *</label>
              <select
                value={newGroupId}
                onChange={e => {
                  setNewGroupId(e.target.value)
                  const g = groups.find(x => x.id === e.target.value)
                  const h = g ? hoursBetween(g.start_time, g.end_time) : null
                  if (h) setNewHours(String(h))
                }}
                style={inp}
              >
                <option value="">בחר קבוצה...</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name} · {g.branch}{g.start_time ? ` · ${fmtTime(g.start_time)}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#7a8f7d', display: 'block', marginBottom: 4 }}>מדריך</label>
              <select value={newInstructor} onChange={e => setNewInst(e.target.value)} style={inp}>
                <option value="">ללא מדריך</option>
                {instructors.filter(i => i.active).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#7a8f7d', display: 'block', marginBottom: 4 }}>משך (שעות)</label>
              <input type="number" step="0.5" min="0.5" max="4" value={newHours} onChange={e => setNewHours(e.target.value)} style={inp} />
            </div>
          </div>
          <button
            onClick={createSession}
            disabled={creating || !newGroupId}
            style={{ background: creating || !newGroupId ? '#3a4f3a' : '#b5e853', color: creating || !newGroupId ? '#7a8f7d' : '#0d0f0e', border: 'none', borderRadius: 8, padding: '10px 22px', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 15, cursor: creating || !newGroupId ? 'default' : 'pointer' }}
          >
            {creating ? 'יוצר...' : '✓ פתח אימון'}
          </button>
        </div>
      )}

      {/* ── New special activity (camp) form ── */}
      {showSpecial && (
        <div style={{ background: '#161320', border: '1px solid #c084fc44', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#c084fc' }}>★ פעילות מיוחדת חדשה</h3>
          <p style={{ margin: '0 0 16px', fontSize: 12, color: '#8a7fa5' }}>מחנה, טיול או אירוע חד-פעמי — תשלום לפי שעות × תעריף שעתי של המדריך</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div>
              <label htmlFor="sp-name" style={{ fontSize: 11, color: '#8a7fa5', display: 'block', marginBottom: 4 }}>שם הפעילות *</label>
              <input id="sp-name" value={spName} onChange={e => setSpName(e.target.value)} placeholder="לדוגמה: מחנה קיץ" style={{ ...inp, borderColor: '#3a2f47' }} />
            </div>
            <div>
              <label htmlFor="sp-hours" style={{ fontSize: 11, color: '#8a7fa5', display: 'block', marginBottom: 4 }}>משך (שעות) *</label>
              <input id="sp-hours" type="number" step="0.5" min="0.5" value={spHours} onChange={e => setSpHours(e.target.value)} style={{ ...inp, borderColor: '#3a2f47' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#8a7fa5', display: 'block', marginBottom: 4 }}>תאריך</label>
              <div style={{ ...inp, borderColor: '#3a2f47', color: '#8a7fa5' }}>{new Date(date + 'T12:00:00').toLocaleDateString('he-IL')}</div>
            </div>
          </div>

          {/* Instructors multi-select */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#8a7fa5', display: 'block', marginBottom: 6 }}>מדריכים * (אחד או יותר)</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {instructors.filter(i => i.active).map(i => {
                const on = spInstructors.includes(i.id)
                return (
                  <button
                    key={i.id}
                    onClick={() => toggleSpInstructor(i.id)}
                    aria-pressed={on}
                    style={{ minHeight: 40, padding: '8px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 13, border: `1px solid ${on ? '#c084fc' : '#3a2f47'}`, background: on ? '#c084fc' : 'transparent', color: on ? '#0d0f0e' : '#c9bce0' }}
                  >
                    {on ? '✓ ' : ''}{i.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Participants picker */}
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="sp-search" style={{ fontSize: 11, color: '#8a7fa5', display: 'block', marginBottom: 6 }}>
              משתתפים * ({spParticipants.length})
            </label>
            {spParticipants.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {spParticipants.map(r => (
                  <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#241a2e', border: '1px solid #3a2f47', borderRadius: 16, padding: '5px 6px 5px 12px', fontSize: 13, color: '#e8e2f0' }}>
                    {r.full_name}
                    <button
                      onClick={() => setSpParts(p => p.filter(x => x.id !== r.id))}
                      aria-label={`הסר את ${r.full_name}`}
                      style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: '#3a2f47', color: '#f9a8d4', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}
                    >✕</button>
                  </span>
                ))}
              </div>
            )}
            <input id="sp-search" value={spSearchQ} onChange={e => spSearchRiders(e.target.value)} placeholder="חיפוש רוכב להוספה..." style={{ ...inp, borderColor: '#3a2f47' }} />
            {spSearching && <div style={{ color: '#8a7fa5', fontSize: 12, marginTop: 6 }}>מחפש...</div>}
            {spSearchRes.map(r => (
              <div
                key={r.id}
                onClick={() => { setSpParts(p => [...p, r]); setSpSearchQ(''); setSpSearchRes([]) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: '#1a1320', marginTop: 6, border: '1px solid #241a2e' }}
              >
                <span style={{ fontWeight: 700, fontSize: 13 }}>{r.full_name}</span>
                {r.phone && <span style={{ color: '#8a7fa5', fontSize: 12 }}>📞 {r.phone}</span>}
                <span style={{ marginRight: 'auto', color: '#c084fc', fontSize: 18, fontWeight: 700, lineHeight: 1 }}>＋</span>
              </div>
            ))}
            {!spSearching && spSearchQ.trim().length >= 2 && spSearchRes.length === 0 && (
              <div style={{ color: '#8a7fa5', fontSize: 12, marginTop: 6 }}>לא נמצאו רוכבים פעילים תואמים (ייתכן שכבר ברשימה)</div>
            )}
          </div>

          <button
            onClick={createSpecialActivity}
            disabled={spCreating || !spName.trim() || spInstructors.length === 0 || spParticipants.length === 0}
            style={{ background: (spCreating || !spName.trim() || spInstructors.length === 0 || spParticipants.length === 0) ? '#3a2f47' : '#c084fc', color: (spCreating || !spName.trim() || spInstructors.length === 0 || spParticipants.length === 0) ? '#8a7fa5' : '#0d0f0e', border: 'none', borderRadius: 8, padding: '10px 22px', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 15, cursor: (spCreating || !spName.trim() || spInstructors.length === 0 || spParticipants.length === 0) ? 'default' : 'pointer' }}
          >
            {spCreating ? 'יוצר...' : '★ צור פעילות'}
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
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 5, color: isSelected ? (s.type === 'special' ? '#c084fc' : '#b5e853') : '#e8efe9' }}>{s.class_name}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      {s.type === 'special'
                        ? <span style={{ background: '#c084fc22', color: '#c084fc', borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>★ מיוחדת</span>
                        : <span style={{ background: bc + '22', color: bc, borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>{s.branch}</span>}
                      {s.start_time && <span style={{ color: '#7a8f7d', fontSize: 11 }}>🕒 {fmtTime(s.start_time)}</span>}
                      {s.type === 'special'
                        ? <span style={{ color: '#7a8f7d', fontSize: 11 }}>👤 {(s.instructor_ids ?? []).map(id => instructors.find(i => i.id === id)?.name).filter(Boolean).join(', ')}</span>
                        : s.instructor_id && <span style={{ color: '#7a8f7d', fontSize: 11 }}>👤 {instructors.find(i => i.id === s.instructor_id)?.name}</span>}
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
                <span style={{ color: selected.type === 'special' ? '#c084fc' : '#b5e853', fontSize: 13, fontWeight: 600 }}>📅 {new Date(selected.session_date + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' })}</span>
                {selected.type === 'special'
                  ? <span style={{ background: '#c084fc22', color: '#c084fc', borderRadius: 10, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>★ מיוחדת · {selected.duration}ש׳</span>
                  : <span style={{ color: '#7a8f7d', fontSize: 13 }}>📍 {selected.branch}</span>}
                {selected.start_time && <span style={{ color: '#7a8f7d', fontSize: 13 }}>🕒 {fmtTime(selected.start_time)}{selected.end_time ? `–${fmtTime(selected.end_time)}` : ''}</span>}
                {selected.type === 'special'
                  ? <span style={{ color: '#7a8f7d', fontSize: 13 }}>👤 {(selected.instructor_ids ?? []).map(id => instructors.find(i => i.id === id)?.name).filter(Boolean).join(', ')}</span>
                  : selected.instructor_id && <span style={{ color: '#7a8f7d', fontSize: 13 }}>👤 {instructors.find(i => i.id === selected.instructor_id)?.name}</span>}
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
                      <button
                        onClick={e => { e.stopPropagation(); removeFromGroup(r) }}
                        title="הסר מהקבוצה"
                        style={{ background: 'transparent', border: '1px solid #3a2626', color: '#ff8080', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15, flexShrink: 0 }}
                      >🗑</button>
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
