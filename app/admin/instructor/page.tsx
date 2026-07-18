'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { resolveGroupId, groupRiderIds } from '@/lib/rider-groups'

// ─────────────────────────────────────────────────────────────────────────────
// Instructor mobile page (no login yet — the instructor just taps their name).
// Mobile-first, big thumb-friendly targets, purple / black / pink branding,
// built to WCAG 2.1: real <button> elements for keyboard nav, aria labels /
// aria-pressed on toggles, text+icon (not colour alone) to convey state, and
// high-contrast colours on the dark background.
//
// Flow:  pick instructor → today's sessions → rider list (✔ / ✖) → save →
//        confirmation with the present count.
// ─────────────────────────────────────────────────────────────────────────────

// Brand palette
const C = {
  bg:        '#0d0b10',
  surface:   '#1a1320',
  surface2:  '#241a2e',
  border:    '#3a2f47',
  purple:    '#a855f7',
  purpleSoft:'#c4b5fd',
  pink:      '#ec4899',
  pinkSoft:  '#f9a8d4',
  text:      '#f5f3f7',
  muted:     '#b6a7c9',
  present:   '#4ade80',
  absent:    '#f87171',
}
const FONT = 'Heebo, Arial, sans-serif'

type Instructor = { id: string; name: string; branch: string | null }
type Session = {
  id: string
  class_name: string
  branch: string
  session_date: string
  instructor_id: string | null
  group_id: string | null
  start_time: string | null
  duration: number | null
  type: 'regular' | 'special' | null
  instructor_ids: string[] | null
}
type Rider = { id: string; full_name: string; phone: string | null }

const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : '')

// Page chrome (brand header + centred column). Kept at module level so it is a
// stable component type — nesting it inside the page would remount the whole
// subtree on every state change (worse under the React Compiler).
function Shell({
  instructor, onChangeInstructor, sub, children,
}: {
  instructor: Instructor | null
  onChangeInstructor: () => void
  sub?: string
  children: React.ReactNode
}) {
  return (
    <div dir="rtl" style={{ fontFamily: FONT, background: C.bg, minHeight: '100vh', color: C.text }}>
      <header style={{ background: `linear-gradient(90deg, ${C.surface}, ${C.surface2})`, borderBottom: `1px solid ${C.border}`, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22, fontWeight: 900, color: C.purpleSoft }}>🚵 טבע בייק</span>
        <span style={{ background: C.pink, color: '#0d0b10', padding: '4px 12px', borderRadius: 20, fontSize: 14, fontWeight: 800 }}>מדריך</span>
        {instructor && (
          <button
            onClick={onChangeInstructor}
            style={{ marginInlineStart: 'auto', minHeight: 44, background: 'transparent', border: `1px solid ${C.border}`, color: C.purpleSoft, borderRadius: 12, padding: '8px 16px', fontFamily: FONT, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          >
            החלף מדריך
          </button>
        )}
      </header>
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 48px' }}>
        {sub && <p style={{ color: C.muted, fontSize: 15, margin: '0 0 18px' }}>{sub}</p>}
        {children}
      </main>
    </div>
  )
}

export default function InstructorMobilePage() {
  const today = new Date().toISOString().split('T')[0]
  const todayLabel = new Date().toLocaleDateString('he-IL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const [instructors, setInstructors]   = useState<Instructor[]>([])
  const [loadingInst, setLoadingInst]   = useState(true)
  const [listError, setListError]       = useState('')
  const [instructor, setInstructor]     = useState<Instructor | null>(null)

  const [sessions, setSessions]         = useState<Session[]>([])
  const [loadingSess, setLoadingSess]   = useState(false)
  const [session, setSession]           = useState<Session | null>(null)

  const [riders, setRiders]             = useState<Rider[]>([])
  const [attendance, setAttendance]     = useState<Record<string, boolean>>({})
  const [loadingRiders, setLoadingRiders] = useState(false)
  const [saving, setSaving]             = useState(false)
  const [confirmCount, setConfirmCount] = useState<number | null>(null)

  // ── Load the active instructors once ──────────────────────────────────────
  // admin_roles isn't anon-readable under RLS (it holds staff PII), so the list
  // comes from a service-role API route rather than a direct client query.
  useEffect(() => {
    fetch('/api/instructor/list')
      .then(async r => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))
      .then(({ ok, d }) => {
        setInstructors((d.instructors ?? []) as Instructor[])
        if (!ok || d.error) setListError(d.error ? 'שגיאת שרת בטעינת המדריכים' : '')
      })
      .catch(() => { setInstructors([]); setListError('לא ניתן לטעון את רשימת המדריכים') })
      .finally(() => setLoadingInst(false))
  }, [])

  // ── Load today's sessions for the chosen instructor ───────────────────────
  const pickInstructor = useCallback(async (inst: Instructor) => {
    setInstructor(inst)
    setSession(null)
    setConfirmCount(null)
    setLoadingSess(true)
    // Include regular sessions the instructor leads AND special activities where
    // they are one of several instructors (instructor_ids array contains them).
    const { data } = await supabase
      .from('class_sessions')
      .select('id, class_name, branch, session_date, instructor_id, group_id, start_time, duration, type, instructor_ids')
      .or(`instructor_id.eq.${inst.id},instructor_ids.cs.{${inst.id}}`)
      .eq('session_date', today)
      .order('start_time', { nullsFirst: true })
    setSessions((data ?? []) as Session[])
    setLoadingSess(false)
  }, [today])

  // ── Load the roster for a session ─────────────────────────────────────────
  const openSession = useCallback(async (s: Session) => {
    setSession(s)
    setConfirmCount(null)
    setRiders([])
    setAttendance({})
    setLoadingRiders(true)

    // Special activities aren't group-bound — their participants live in the
    // attendance rows created when the activity was set up.
    if (s.type === 'special') {
      const { data: attData } = await supabase.from('attendance').select('rider_id, present').eq('session_id', s.id)
      const ids = (attData ?? []).map(a => a.rider_id)
      let plist: Rider[] = []
      if (ids.length) {
        const { data } = await supabase.from('riders').select('id, full_name, phone').in('id', ids).order('full_name')
        plist = data ?? []
      }
      const map: Record<string, boolean> = {}
      for (const a of attData ?? []) map[a.rider_id] = a.present
      for (const r of plist) if (!(r.id in map)) map[r.id] = true
      setRiders(plist)
      setAttendance(map)
      setLoadingRiders(false)
      return
    }

    const groupId = await resolveGroupId(s.group_id, s.class_name, s.branch)
    let list: Rider[] = []
    if (groupId) {
      const ids = await groupRiderIds(groupId)
      if (ids.length) {
        const { data } = await supabase
          .from('riders')
          .select('id, full_name, phone')
          .in('id', ids)
          .order('full_name')
        list = data ?? []
      }
    } else {
      const { data } = await supabase
        .from('riders')
        .select('id, full_name, phone')
        .eq('group_name', s.class_name).eq('branch', s.branch).eq('is_regular', true)
        .order('full_name')
      list = data ?? []
    }

    const { data: attData } = await supabase
      .from('attendance')
      .select('rider_id, present')
      .eq('session_id', s.id)

    const map: Record<string, boolean> = {}
    for (const a of attData ?? []) map[a.rider_id] = a.present
    for (const r of list) if (!(r.id in map)) map[r.id] = true
    setRiders(list)
    setAttendance(map)
    setLoadingRiders(false)
  }, [])

  async function save() {
    if (!session || riders.length === 0) return
    setSaving(true)
    // Save via the service-role API route so the instructor's pay multiplier is
    // applied correctly (admin_roles is not anon-readable). Shares the same
    // underlying save logic as the desktop attendance page.
    try {
      const r = await fetch('/api/instructor/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: {
            id: session.id,
            instructor_id: session.instructor_id,
            group_id: session.group_id,
            session_date: session.session_date,
            type: session.type,
            duration: session.duration,
            instructor_ids: session.instructor_ids,
          },
          riders: riders.map(r => ({ id: r.id, full_name: r.full_name })),
          attendance,
        }),
      })
      const d = await r.json()
      if (!r.ok) { alert('שגיאה בשמירה: ' + (d.error ?? r.statusText)); return }
      setConfirmCount(d.presentCount ?? presentCount)
    } catch (e) {
      alert('שגיאה בשמירה: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const presentCount = riders.filter(r => attendance[r.id] !== false).length

  const changeInstructor = () => { setInstructor(null); setSession(null); setSessions([]); setConfirmCount(null) }

  // ── 1. Confirmation ────────────────────────────────────────────────────────
  if (confirmCount !== null && session) {
    return (
      <Shell instructor={instructor} onChangeInstructor={changeInstructor}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 12 }} aria-hidden="true">✅</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 8px' }}>הנוכחות נשמרה!</h1>
          <p style={{ color: C.muted, fontSize: 17, margin: '0 0 24px' }}>{session.class_name} · {session.branch}</p>
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10, background: C.surface2, border: `1px solid ${C.purple}`, borderRadius: 16, padding: '18px 30px' }}>
            <span style={{ fontSize: 52, fontWeight: 900, color: C.present, lineHeight: 1 }}>{confirmCount}</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: C.text }}>רוכבים נוכחים</span>
          </div>
          <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => openSession(session)}
              style={{ minHeight: 56, background: C.surface2, color: C.purpleSoft, border: `1px solid ${C.border}`, borderRadius: 16, fontFamily: FONT, fontWeight: 800, fontSize: 17, cursor: 'pointer' }}
            >
              ✏️ ערוך שוב את האימון הזה
            </button>
            <button
              onClick={() => { setSession(null); setConfirmCount(null) }}
              style={{ minHeight: 56, background: C.purple, color: '#0d0b10', border: 'none', borderRadius: 16, fontFamily: FONT, fontWeight: 900, fontSize: 18, cursor: 'pointer' }}
            >
              → חזרה לאימוני היום
            </button>
          </div>
        </div>
      </Shell>
    )
  }

  // ── 2. Pick instructor ─────────────────────────────────────────────────────
  if (!instructor) {
    return (
      <Shell instructor={instructor} onChangeInstructor={changeInstructor} sub={todayLabel}>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 4px' }}>מי מדריך היום?</h1>
        <p style={{ color: C.muted, fontSize: 15, margin: '0 0 20px' }}>בחר/י את השם שלך כדי להתחיל</p>
        {loadingInst ? (
          <p style={{ color: C.muted, textAlign: 'center', padding: 40, fontSize: 16 }}>טוען...</p>
        ) : instructors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ color: listError ? C.absent : C.muted, fontSize: 16, margin: 0 }}>
              {listError || 'לא נמצאו מדריכים פעילים'}
            </p>
            {listError && <p style={{ color: C.muted, fontSize: 13, margin: '8px 0 0' }}>נסה לרענן את הדף, או פנה למנהל המערכת.</p>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {instructors.map(inst => (
              <button
                key={inst.id}
                onClick={() => pickInstructor(inst)}
                style={{ minHeight: 68, display: 'flex', alignItems: 'center', gap: 14, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: '14px 20px', fontFamily: FONT, cursor: 'pointer', textAlign: 'start' }}
              >
                <span aria-hidden="true" style={{ width: 46, height: 46, flexShrink: 0, borderRadius: '50%', background: C.purple, color: '#0d0b10', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900 }}>
                  {inst.name?.trim().charAt(0) || '?'}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{inst.name}</span>
                  {inst.branch && <span style={{ fontSize: 14, color: C.muted }}>📍 {inst.branch}</span>}
                </span>
                <span aria-hidden="true" style={{ marginInlineStart: 'auto', color: C.pinkSoft, fontSize: 26, fontWeight: 900 }}>‹</span>
              </button>
            ))}
          </div>
        )}
      </Shell>
    )
  }

  // ── 3. Today's sessions ────────────────────────────────────────────────────
  if (!session) {
    return (
      <Shell instructor={instructor} onChangeInstructor={changeInstructor} sub={`${instructor.name} · ${todayLabel}`}>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 20px' }}>האימונים שלך היום</h1>
        {loadingSess ? (
          <p style={{ color: C.muted, textAlign: 'center', padding: 40, fontSize: 16 }}>טוען...</p>
        ) : sessions.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }} aria-hidden="true">🗓️</div>
            <p style={{ color: C.muted, fontSize: 17, margin: 0 }}>אין לך אימונים מתוזמנים להיום</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => openSession(s)}
                style={{ minHeight: 76, display: 'flex', alignItems: 'center', gap: 14, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: '16px 20px', fontFamily: FONT, cursor: 'pointer', textAlign: 'start' }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{s.class_name}</span>
                  <span style={{ fontSize: 14, color: C.muted, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>📍 {s.branch}</span>
                    {s.start_time && <span>🕒 {fmtTime(s.start_time)}</span>}
                  </span>
                </span>
                <span aria-hidden="true" style={{ marginInlineStart: 'auto', color: C.pinkSoft, fontSize: 26, fontWeight: 900 }}>‹</span>
              </button>
            ))}
          </div>
        )}
      </Shell>
    )
  }

  // ── 4. Attendance ──────────────────────────────────────────────────────────
  return (
    <Shell instructor={instructor} onChangeInstructor={changeInstructor}>
      {/* session heading + back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          onClick={() => setSession(null)}
          aria-label="חזרה לרשימת האימונים"
          style={{ minWidth: 48, minHeight: 48, background: C.surface, border: `1px solid ${C.border}`, color: C.purpleSoft, borderRadius: 14, fontSize: 22, fontWeight: 900, cursor: 'pointer' }}
        >›</button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>{session.class_name}</h1>
          <p style={{ color: C.muted, fontSize: 14, margin: '2px 0 0' }}>
            📍 {session.branch}{session.start_time ? ` · 🕒 ${fmtTime(session.start_time)}` : ''}
          </p>
        </div>
      </div>

      {/* live present tally */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <span style={{ flex: 1, textAlign: 'center', background: `${C.present}1f`, border: `1px solid ${C.present}66`, color: C.present, borderRadius: 14, padding: '10px 0', fontSize: 17, fontWeight: 800 }}>✔ {presentCount} נוכחים</span>
        <span style={{ flex: 1, textAlign: 'center', background: `${C.absent}1f`, border: `1px solid ${C.absent}66`, color: C.absent, borderRadius: 14, padding: '10px 0', fontSize: 17, fontWeight: 800 }}>✖ {riders.length - presentCount} נעדרים</span>
      </div>

      {loadingRiders ? (
        <p style={{ color: C.muted, textAlign: 'center', padding: 40, fontSize: 16 }}>טוען רוכבים...</p>
      ) : riders.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 40, textAlign: 'center', color: C.muted, fontSize: 16 }}>
          לא נמצאו רוכבים רשומים לקבוצה זו
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {riders.map(r => {
            const present = attendance[r.id] !== false
            return (
              <div
                key={r.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.surface, border: `1px solid ${present ? C.border : `${C.absent}66`}`, borderRadius: 16, padding: '12px 14px' }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 18, fontWeight: 800, color: present ? C.text : C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.full_name}</span>
                  {r.phone && <span style={{ display: 'block', fontSize: 13, color: C.muted }}>📞 {r.phone}</span>}
                </span>
                <button
                  onClick={() => setAttendance(p => ({ ...p, [r.id]: true }))}
                  aria-label={`סמן ${r.full_name} כנוכח`}
                  aria-pressed={present}
                  style={{ minWidth: 56, minHeight: 56, borderRadius: 14, border: `2px solid ${C.present}`, cursor: 'pointer', fontSize: 24, fontWeight: 900, background: present ? C.present : 'transparent', color: present ? '#0d0b10' : C.present }}
                >✔</button>
                <button
                  onClick={() => setAttendance(p => ({ ...p, [r.id]: false }))}
                  aria-label={`סמן ${r.full_name} כנעדר`}
                  aria-pressed={!present}
                  style={{ minWidth: 56, minHeight: 56, borderRadius: 14, border: `2px solid ${C.absent}`, cursor: 'pointer', fontSize: 24, fontWeight: 900, background: !present ? C.absent : 'transparent', color: !present ? '#0d0b10' : C.absent }}
                >✖</button>
              </div>
            )
          })}
        </div>
      )}

      {/* sticky save bar */}
      {riders.length > 0 && (
        <div style={{ position: 'sticky', bottom: 0, marginTop: 20, paddingTop: 12, background: `linear-gradient(180deg, transparent, ${C.bg} 40%)` }}>
          <button
            onClick={save}
            disabled={saving}
            style={{ width: '100%', minHeight: 64, background: saving ? C.surface2 : `linear-gradient(90deg, ${C.purple}, ${C.pink})`, color: saving ? C.muted : '#fff', border: 'none', borderRadius: 18, fontFamily: FONT, fontWeight: 900, fontSize: 20, cursor: saving ? 'default' : 'pointer', boxShadow: saving ? 'none' : '0 6px 20px rgba(168,85,247,0.35)' }}
          >
            {saving ? 'שומר...' : `💾 שמור נוכחות (${presentCount})`}
          </button>
        </div>
      )}
    </Shell>
  )
}
