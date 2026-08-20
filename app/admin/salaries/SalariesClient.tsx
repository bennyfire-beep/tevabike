'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DEFAULT_HOURLY_RATE, DEFAULT_RATE_PER_LESSON } from '@/lib/attendance'
import { ManageShell, Note, ErrorBox, C, inputStyle, labelStyle } from '@/components/ManageShell'

type Row = {
  id: string
  name: string
  // Ordinary weekly lessons — flat rate_per_lesson each.
  lessons: number
  ratePerLesson: number
  lessonPay: number
  // Special activities (camps / ימי שיא) — hours × hourly_rate.
  specialCount: number
  specialHours: number
  hourlyRate: number
  specialPay: number
  total: number
}

/** First and last day of `month` ("YYYY-MM") as ISO dates. */
function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number)
  const from = `${month}-01`
  const to   = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
  return { from, to }
}

const thisMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const ils = (n: number) => `₪${Math.round(n).toLocaleString('he-IL')}`

export default function SalariesClient() {
  const [month,   setMonth]   = useState(thisMonth())
  const [rows,    setRows]    = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      const { from, to } = monthRange(month)

      const [
        { data: instructors, error: e1 },
        { data: pay,         error: e2 },
        { data: sessions,    error: e3 },
      ] = await Promise.all([
        supabase.from('admin_roles').select('id, name').eq('role', 'instructor').order('name'),
        // Both rates live here, not on admin_roles.
        supabase.from('staff_pay').select('admin_role_id, rate_per_lesson, hourly_rate'),
        supabase
          .from('class_sessions')
          .select('id, instructor_id, instructor_ids, type, duration')
          .gte('session_date', from)
          .lte('session_date', to),
      ])

      if (cancelled) return

      if (e1 || e2 || e3) {
        setError('הטעינה נכשלה: ' + (e1?.message ?? e2?.message ?? e3?.message))
        setLoading(false)
        return
      }

      // Tally per instructor. A lesson counts for instructor_id and for anyone
      // listed in instructor_ids when a session was co-taught.
      const lessons      = new Map<string, number>()
      const specialCount = new Map<string, number>()
      const specialHours = new Map<string, number>()

      for (const s of sessions ?? []) {
        const ids = new Set<string>()
        if (s.instructor_id) ids.add(s.instructor_id)
        for (const extra of (s.instructor_ids ?? []) as string[]) ids.add(extra)

        for (const id of ids) {
          if (s.type === 'special') {
            specialCount.set(id, (specialCount.get(id) ?? 0) + 1)
            specialHours.set(id, (specialHours.get(id) ?? 0) + (Number(s.duration) || 0))
          } else {
            lessons.set(id, (lessons.get(id) ?? 0) + 1)
          }
        }
      }

      const payOf = new Map((pay ?? []).map(p => [p.admin_role_id, p]))

      setRows(
        (instructors ?? []).map(i => {
          const p             = payOf.get(i.id)
          const ratePerLesson = p?.rate_per_lesson == null ? DEFAULT_RATE_PER_LESSON : Number(p.rate_per_lesson)
          const hourlyRate    = p?.hourly_rate     == null ? DEFAULT_HOURLY_RATE     : Number(p.hourly_rate)

          const n        = lessons.get(i.id) ?? 0
          const hours    = specialHours.get(i.id) ?? 0
          const lessonPay  = n * ratePerLesson
          const specialPay = hours * hourlyRate

          return {
            id: i.id,
            name: i.name ?? '—',
            lessons: n,
            ratePerLesson,
            lessonPay,
            specialCount: specialCount.get(i.id) ?? 0,
            specialHours: hours,
            hourlyRate,
            specialPay,
            total: lessonPay + specialPay,
          }
        }),
      )
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [month])

  // Instructors who worked nothing this month are noise in a payroll report.
  const active = useMemo(() => rows.filter(r => r.lessons > 0 || r.specialCount > 0), [rows])
  const grand  = useMemo(() => active.reduce((s, r) => s + r.total, 0), [active])
  const grandLessons = useMemo(() => active.reduce((s, r) => s + r.lessonPay, 0), [active])
  const grandSpecial = useMemo(() => active.reduce((s, r) => s + r.specialPay, 0), [active])

  return (
    <ManageShell title="דוח שכר חודשי">
      <ErrorBox>{error}</ErrorBox>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 15, marginBottom: 16 }}>
        <label style={labelStyle}>חודש</label>
        <input style={inputStyle} type="month" value={month} onChange={e => setMonth(e.target.value)} />
      </div>

      {loading ? <Note>מחשב...</Note> : active.length === 0 ? (
        <Note>לא נרשמו שיעורים או פעילויות בחודש זה</Note>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 10 }}>
            {active.map(r => (
              <div key={r.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 15 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 11 }}>
                  <span style={{ fontWeight: 800, fontSize: 16 }}>{r.name}</span>
                  <span style={{ color: C.accent, fontWeight: 900, fontSize: 19, whiteSpace: 'nowrap' }}>
                    {ils(r.total)}
                  </span>
                </div>

                <div style={{ display: 'grid', gap: 7 }}>
                  {/* Regular lessons */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, paddingBottom: 7, borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ color: C.muted }}>
                      שיעורים רגילים
                      <span style={{ opacity: 0.75 }}> · {r.lessons} × {ils(r.ratePerLesson)}</span>
                    </span>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{ils(r.lessonPay)}</span>
                  </div>

                  {/* Special activities */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                    <span style={{ color: r.specialCount > 0 ? '#c084fc' : C.muted }}>
                      ★ פעילויות מיוחדות
                      <span style={{ opacity: 0.75 }}>
                        {r.specialCount > 0
                          ? ` · ${r.specialCount} · ${r.specialHours} ש׳ × ${ils(r.hourlyRate)}`
                          : ' · אין'}
                      </span>
                    </span>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{ils(r.specialPay)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Grand totals */}
          <div style={{ marginTop: 14, background: C.card, border: `1px solid ${C.accent}`, borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.muted, marginBottom: 6 }}>
              <span>שיעורים רגילים</span><span>{ils(grandLessons)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.muted, marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
              <span>פעילויות מיוחדות</span><span>{ils(grandSpecial)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>סה״כ לתשלום</span>
              <span style={{ color: C.accent, fontWeight: 900, fontSize: 21 }}>{ils(grand)}</span>
            </div>
          </div>

          {rows.some(r => r.lessons === 0 && r.specialCount === 0) && (
            <div style={{ color: C.muted, fontSize: 12, marginTop: 12, textAlign: 'center' }}>
              {rows.filter(r => r.lessons === 0 && r.specialCount === 0).length} מדריכים ללא פעילות החודש אינם מוצגים
            </div>
          )}
        </>
      )}
    </ManageShell>
  )
}
