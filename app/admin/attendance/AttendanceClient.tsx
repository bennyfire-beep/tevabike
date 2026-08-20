'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ManageShell, useManageUser, Btn, Note, ErrorBox, C, DAY_NAMES, inputStyle, labelStyle,
} from '@/components/ManageShell'

type Group   = { id: string; name: string; branch: string; days_of_week: number[] | null; start_time: string | null; end_time: string | null }
type Student = { id: string; full_name: string; chosen_day: number | null; track: string | null }

const todayISO = () => {
  // Local date, not UTC — an evening session must not roll to tomorrow.
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AttendancePage() {
  return (
    <ManageShell title="נוכחות">
      <AttendanceInner />
    </ManageShell>
  )
}

function AttendanceInner() {
  const user = useManageUser()

  const [groups,   setGroups]   = useState<Group[]>([])
  const [groupId,  setGroupId]  = useState('')
  const [date,     setDate]     = useState(todayISO())
  const [students, setStudents] = useState<Student[]>([])
  const [marks,    setMarks]    = useState<Record<string, boolean>>({})
  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [saved,    setSaved]    = useState(false)

  // ── Groups ──
  useEffect(() => {
    supabase
      .from('groups')
      .select('id, name, branch, days_of_week, start_time, end_time')
      .eq('is_active', true)
      .order('name')
      .then(({ data, error: err }) => {
        if (err) setError('טעינת הקבוצות נכשלה: ' + err.message)
        else setGroups((data ?? []) as Group[])
      })
  }, [])

  const group  = groups.find(g => g.id === groupId)
  const weekday = new Date(date + 'T12:00:00').getDay()

  // ── Roster + any marks already saved for this group/date ──
  useEffect(() => {
    if (!groupId || !date) { setStudents([]); setMarks({}); return }

    setLoading(true)
    setSaved(false)
    setError('')

    Promise.all([
      supabase
        .from('riders')
        .select('id, full_name, chosen_day, track')
        .eq('group_id', groupId)
        .neq('active', false)
        .order('full_name'),
      supabase
        .from('attendance')
        .select('rider_id, present')
        .eq('group_id', groupId)
        .eq('date', date),
    ]).then(([{ data: rs, error: e1 }, { data: at, error: e2 }]) => {
      if (e1 || e2) {
        setError('הטעינה נכשלה: ' + (e1?.message ?? e2?.message))
      } else {
        setStudents((rs ?? []) as Student[])
        // Default to present; existing marks win.
        const existing = new Map((at ?? []).map(a => [a.rider_id, !!a.present]))
        const next: Record<string, boolean> = {}
        for (const r of rs ?? []) next[r.id] = existing.get(r.id) ?? true
        setMarks(next)
      }
      setLoading(false)
    })
  }, [groupId, date])

  // A once-weekly student only attends their chosen day.
  const expected = students.filter(
    s => s.track !== 'once_weekly' || s.chosen_day === null || s.chosen_day === weekday,
  )

  async function save() {
    if (!groupId || !date || !group) return
    setSaving(true)
    setError('')

    try {
      // 1. One lesson row per group/date, so the salaries report can count it.
      const { data: existingSession } = await supabase
        .from('class_sessions')
        .select('id')
        .eq('group_id', groupId)
        .eq('session_date', date)
        .maybeSingle()

      let sessionId = existingSession?.id ?? null

      if (!sessionId) {
        const { data: created, error: sErr } = await supabase
          .from('class_sessions')
          .insert({
            group_id:      groupId,
            session_date:  date,
            // Only an instructor marking their own lesson gets attributed;
            // a coordinator filling in for them leaves it unassigned.
            instructor_id: user?.role === 'instructor' ? user.adminRoleId : null,
            branch:        group.branch,
            class_name:    group.name,
            start_time:    group.start_time,
            end_time:      group.end_time,
            status:        'open',
            present_count: expected.filter(s => marks[s.id]).length,
          })
          .select('id')
          .single()

        if (sErr) throw new Error('יצירת השיעור נכשלה: ' + sErr.message)
        sessionId = created.id
      } else {
        await supabase
          .from('class_sessions')
          .update({ present_count: expected.filter(s => marks[s.id]).length })
          .eq('id', sessionId)
      }

      // 2. Replace this group/date's marks wholesale — attendance has no
      //    unique key to upsert on, so a clean delete+insert keeps it exact.
      const { error: dErr } = await supabase
        .from('attendance')
        .delete()
        .eq('group_id', groupId)
        .eq('date', date)
      if (dErr) throw new Error('ניקוי הנוכחות הקודמת נכשל: ' + dErr.message)

      if (expected.length > 0) {
        const { error: iErr } = await supabase.from('attendance').insert(
          expected.map(s => ({
            rider_id:   s.id,
            rider_name: s.full_name,
            group_id:   groupId,
            session_id: sessionId,
            date,
            present:    !!marks[s.id],
            status:     marks[s.id] ? 'present' : 'absent',
          })),
        )
        if (iErr) throw new Error('שמירת הנוכחות נכשלה: ' + iErr.message)
      }

      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'השמירה נכשלה')
    } finally {
      setSaving(false)
    }
  }

  const presentCount = expected.filter(s => marks[s.id]).length

  return (
    <>
      <ErrorBox>{error}</ErrorBox>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 15, marginBottom: 16, display: 'grid', gap: 12 }}>
        <div>
          <label style={labelStyle}>קבוצה</label>
          <select style={inputStyle} value={groupId} onChange={e => setGroupId(e.target.value)}>
            <option value="">— בחר קבוצה —</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name} · {g.branch}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>תאריך</label>
          <input style={inputStyle} type="date" value={date} onChange={e => setDate(e.target.value)} />
          <div style={{ color: C.muted, fontSize: 12, marginTop: 5 }}>
            יום {DAY_NAMES[weekday]}
            {group?.days_of_week?.length && !group.days_of_week.includes(weekday) && (
              <span style={{ color: '#fbbf24' }}> · שימו לב: הקבוצה לא מתאמנת ביום זה</span>
            )}
          </div>
        </div>
      </div>

      {!groupId ? (
        <Note>בחרו קבוצה כדי לסמן נוכחות</Note>
      ) : loading ? (
        <Note>טוען חניכים...</Note>
      ) : expected.length === 0 ? (
        <Note>אין חניכים משובצים לקבוצה זו ביום {DAY_NAMES[weekday]}</Note>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ color: C.muted, fontSize: 13 }}>
              {presentCount} נוכחים מתוך {expected.length}
            </span>
            <div style={{ display: 'flex', gap: 7 }}>
              <button
                onClick={() => setMarks(Object.fromEntries(expected.map(s => [s.id, true])))}
                style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, color: C.muted, padding: '6px 11px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}
              >
                כולם נוכחים
              </button>
              <button
                onClick={() => setMarks(Object.fromEntries(expected.map(s => [s.id, false])))}
                style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, color: C.muted, padding: '6px 11px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}
              >
                כולם נעדרים
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
            {expected.map(s => {
              const present = !!marks[s.id]
              return (
                <div
                  key={s.id}
                  style={{
                    background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                    padding: '11px 13px', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: 10,
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 15, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.full_name}
                  </span>

                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => setMarks(m => ({ ...m, [s.id]: true }))}
                      style={{
                        background: present ? '#4cdb7a' : 'transparent',
                        color: present ? C.bg : C.muted,
                        border: `1px solid ${present ? '#4cdb7a' : C.border}`,
                        borderRadius: 8, padding: '9px 15px', fontSize: 13, fontWeight: 800,
                        fontFamily: 'inherit', cursor: 'pointer', minHeight: 42, minWidth: 54,
                      }}
                    >
                      נוכח
                    </button>
                    <button
                      onClick={() => setMarks(m => ({ ...m, [s.id]: false }))}
                      style={{
                        background: !present ? '#ff6b6b' : 'transparent',
                        color: !present ? C.bg : C.muted,
                        border: `1px solid ${!present ? '#ff6b6b' : C.border}`,
                        borderRadius: 8, padding: '9px 15px', fontSize: 13, fontWeight: 800,
                        fontFamily: 'inherit', cursor: 'pointer', minHeight: 42, minWidth: 54,
                      }}
                    >
                      נעדר
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Sticky save bar — reachable with a thumb on a phone */}
          <div style={{ position: 'sticky', bottom: 0, background: C.bg, paddingTop: 10, paddingBottom: 12 }}>
            <Btn onClick={save} disabled={saving} style={{ width: '100%', fontSize: 16, padding: '14px 0' }}>
              {saving ? 'שומר...' : saved ? '✓ נשמר — שמור שוב' : 'שמירת נוכחות'}
            </Btn>
          </div>
        </>
      )}
    </>
  )
}
