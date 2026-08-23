'use client'
// SalariesClient v3 — ק״מ ידני לחודש + שכר שיעור לפי נוכחות
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DEFAULT_HOURLY_RATE, DEFAULT_RATE_PER_LESSON } from '@/lib/attendance'
import {
  computeTravel, travelConfigOf, travelDetail, TRAVEL_LABEL, type TravelType,
} from '@/lib/travel'
import {
  attendanceBandDetail, lessonPayConfigOf, lessonPayFor, type LessonPayModel,
} from '@/lib/lesson-pay'
import {
  ManageShell, Btn, Note, ErrorBox, C, inputStyle, labelStyle,
} from '@/components/ManageShell'

type Row = {
  id: string
  name: string
  // Ordinary weekly lessons — a flat rate each, or banded by attendance.
  lessons: number
  lessonModel: LessonPayModel
  ratePerLesson: number       // the flat rate; unused when lessonModel is by_attendance
  lessonDetail: string
  lessonPay: number
  // Special activities (camps / ימי שיא) — hours × hourly_rate.
  specialCount: number
  specialHours: number
  hourlyRate: number
  specialPay: number
  // Travel — arrangement per instructor.
  travelType: TravelType
  travelRate: number          // ₪ per km, for the per_km arrangement
  workingDays: number
  travelDetail: string
  travelPay: number
  travelIsOverride: boolean   // this month has its own instructor_travel row
  overrideKm: number | null   // manual km entered for this month, per_km only
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

  // Inline editing of this month's travel — a shekel sum for monthly_fixed,
  // kilometres for per_km.
  const [editingTravelId, setEditingTravelId] = useState<string | null>(null)
  const [travelInput,     setTravelInput]     = useState('')
  const [savingTravel,    setSavingTravel]    = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { from, to } = monthRange(month)

    const [
      { data: instructors, error: e1 },
      { data: pay,         error: e2 },
      { data: sessions,    error: e3 },
      { data: travelRows,  error: e4 },
    ] = await Promise.all([
      supabase.from('admin_roles').select('id, name').eq('role', 'instructor').order('name'),
      // Rates and travel arrangement — never on admin_roles.
      supabase
        .from('staff_pay')
        .select('admin_role_id, rate_per_lesson, hourly_rate, lesson_pay_model, attendance_rate_low, attendance_rate_high, attendance_threshold, travel_type, travel_km, travel_rate, travel_monthly_amount'),
      supabase
        .from('class_sessions')
        .select('id, instructor_id, instructor_ids, type, duration, session_date, present_count')
        .gte('session_date', from)
        .lte('session_date', to),
      // Per-month override — a fixed sum, or manual km for a per_km instructor.
      supabase.from('instructor_travel').select('instructor_id, amount, km, mode').eq('month', month),
    ])

    if (e1 || e2 || e3 || e4) {
      setError('הטעינה נכשלה: ' + (e1?.message ?? e2?.message ?? e3?.message ?? e4?.message))
      setLoading(false)
      return
    }

    // Tally per instructor. A session counts for instructor_id and for anyone
    // listed in instructor_ids when it was co-taught.
    // One entry per ordinary lesson taught, holding that lesson's attendance —
    // by_attendance prices every lesson on its own, so a count is not enough.
    const lessonPresents = new Map<string, number[]>()
    const specialCount = new Map<string, number>()
    const specialHours = new Map<string, number>()
    const workDays     = new Map<string, Set<string>>()   // distinct dates actually taught

    for (const s of sessions ?? []) {
      const ids = new Set<string>()
      if (s.instructor_id) ids.add(s.instructor_id)
      for (const extra of (s.instructor_ids ?? []) as string[]) ids.add(extra)

      for (const id of ids) {
        if (!workDays.has(id)) workDays.set(id, new Set())
        workDays.get(id)!.add(s.session_date)

        if (s.type === 'special') {
          specialCount.set(id, (specialCount.get(id) ?? 0) + 1)
          specialHours.set(id, (specialHours.get(id) ?? 0) + (Number(s.duration) || 0))
        } else {
          if (!lessonPresents.has(id)) lessonPresents.set(id, [])
          lessonPresents.get(id)!.push(Number(s.present_count) || 0)
        }
      }
    }

    const payOf      = new Map((pay ?? []).map(p => [p.admin_role_id, p]))
    const overrideOf = new Map((travelRows ?? []).map(t => [t.instructor_id, {
      amount: Number(t.amount),
      km:     Number(t.km ?? 0),
      mode:   (t.mode ?? null) as string | null,
    }]))

    setRows(
      (instructors ?? []).map(i => {
        const p             = payOf.get(i.id)
        const ratePerLesson = p?.rate_per_lesson == null ? DEFAULT_RATE_PER_LESSON : Number(p.rate_per_lesson)
        const hourlyRate    = p?.hourly_rate     == null ? DEFAULT_HOURLY_RATE     : Number(p.hourly_rate)

        const presents    = lessonPresents.get(i.id) ?? []
        const n           = presents.length
        const hours       = specialHours.get(i.id) ?? 0
        const workingDays = workDays.get(i.id)?.size ?? 0
        const lessonModel = lessonPayConfigOf(p).model
        const lessonPay   = lessonPayFor(p, presents)
        const specialPay  = hours * hourlyRate

        const cfg       = travelConfigOf(p)
        const override  = overrideOf.get(i.id) ?? null
        // Only a manual_km row is km the report should show as typed; a row of
        // any other mode is just an amount.
        const overrideKm = override && cfg.type === 'per_km' && override.mode === 'manual_km'
          ? override.km
          : null
        const travelPay = computeTravel(p, workingDays, override ? override.amount : null)

        return {
          id: i.id,
          name: i.name ?? '—',
          lessons: n,
          lessonModel,
          ratePerLesson,
          lessonDetail: lessonModel === 'by_attendance'
            ? attendanceBandDetail(p, n)
            : `${n} × ${ils(ratePerLesson)}`,
          lessonPay,
          specialCount: specialCount.get(i.id) ?? 0,
          specialHours: hours,
          hourlyRate,
          specialPay,
          travelType: cfg.type,
          travelRate: cfg.rate,
          workingDays,
          travelDetail: travelDetail(p, workingDays, overrideKm),
          travelPay,
          travelIsOverride: override !== null,
          overrideKm,
          total: lessonPay + specialPay + travelPay,
        }
      }),
    )
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  async function saveTravel(id: string) {
    const row = rows.find(r => r.id === id)
    if (!row) return
    const perKm = row.travelType === 'per_km'

    // per_km takes kilometres, monthly_fixed takes shekels.
    const entered = Number(travelInput)
    if (travelInput.trim() === '' || !Number.isFinite(entered) || entered < 0) {
      setError(perKm ? 'מספר ק״מ לא תקין' : 'סכום נסיעות לא תקין')
      return
    }
    if (perKm && row.travelRate <= 0) {
      setError('לא הוגדר תעריף ק״מ למדריך זה — קבעו תעריף בדף ניהול המדריכים ואז חזרו לכאן')
      return
    }

    // Whatever was typed, the row stores the final shekel figure in `amount` —
    // that is the one column the reports, the reminders and the cron read.
    const record = perKm
      ? { instructor_id: id, month, amount: Math.round(entered * row.travelRate * 100) / 100, mode: 'manual_km', km: entered }
      : { instructor_id: id, month, amount: entered, mode: 'car', km: 0 }

    setSavingTravel(true)
    setError('')

    // One row per instructor per month — the table already has a unique key.
    const { error: err } = await supabase
      .from('instructor_travel')
      .upsert(record, { onConflict: 'instructor_id,month' })

    setSavingTravel(false)
    if (err) { setError('שמירת הנסיעות נכשלה: ' + err.message); return }

    setEditingTravelId(null)
    load()
  }

  // Instructors who worked nothing this month are noise in a payroll report.
  const active = useMemo(
    () => rows.filter(r => r.lessons > 0 || r.specialCount > 0 || r.travelPay > 0),
    [rows],
  )
  const grand        = useMemo(() => active.reduce((s, r) => s + r.total, 0), [active])
  const grandLessons = useMemo(() => active.reduce((s, r) => s + r.lessonPay, 0), [active])
  const grandSpecial = useMemo(() => active.reduce((s, r) => s + r.specialPay, 0), [active])
  const grandTravel  = useMemo(() => active.reduce((s, r) => s + r.travelPay, 0), [active])

  return (
    <ManageShell title="דוח שכר חודשי" salaryOnly>
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
                      <span style={{ opacity: 0.75 }}> · {r.lessonDetail}</span>
                    </span>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{ils(r.lessonPay)}</span>
                  </div>

                  {/* Special activities */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, paddingBottom: 7, borderBottom: `1px solid ${C.border}` }}>
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

                  {/* Travel */}
                  {editingTravelId === r.id ? (
                    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end', paddingTop: 3 }}>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>
                          {r.travelType === 'per_km'
                            ? 'ק״מ לחודש זה (המערכת תכפיל בתעריף)'
                            : 'נסיעות לחודש זה (₪)'}
                        </label>
                        <input
                          style={inputStyle} type="number" inputMode="decimal" dir="ltr" autoFocus
                          value={travelInput} onChange={e => setTravelInput(e.target.value)}
                        />
                      </div>
                      <Btn onClick={() => saveTravel(r.id)} disabled={savingTravel} style={{ padding: '11px 14px' }}>
                        {savingTravel ? '...' : 'שמור'}
                      </Btn>
                      <Btn tone="ghost" onClick={() => setEditingTravelId(null)} disabled={savingTravel} style={{ padding: '11px 12px' }}>✕</Btn>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, alignItems: 'center' }}>
                      <span style={{ color: r.travelPay > 0 ? '#81d4fa' : C.muted }}>
                        🚗 נסיעות
                        <span style={{ opacity: 0.75 }}> · {TRAVEL_LABEL[r.travelType]}</span>
                        {r.travelType !== 'none' && (
                          <span style={{ opacity: 0.6, fontSize: 12 }}> · {r.travelDetail}</span>
                        )}
                        {r.travelIsOverride && (
                          <span style={{ color: '#fbbf24', fontSize: 11 }}> · נערך ידנית</span>
                        )}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 700 }}>{ils(r.travelPay)}</span>
                        {r.travelType !== 'none' && (
                          <button
                            onClick={() => {
                              setEditingTravelId(r.id)
                              setTravelInput(
                                r.travelType === 'per_km'
                                  ? (r.overrideKm != null ? String(r.overrideKm) : '')
                                  : String(r.travelPay),
                              )
                            }}
                            style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, color: C.muted, padding: '4px 9px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }}
                          >
                            ✎
                          </button>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Grand totals */}
          <div style={{ marginTop: 14, background: C.card, border: `1px solid ${C.accent}`, borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.muted, marginBottom: 6 }}>
              <span>שיעורים רגילים</span><span>{ils(grandLessons)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.muted, marginBottom: 6 }}>
              <span>פעילויות מיוחדות</span><span>{ils(grandSpecial)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.muted, marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
              <span>נסיעות</span><span>{ils(grandTravel)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>סה״כ לתשלום</span>
              <span style={{ color: C.accent, fontWeight: 900, fontSize: 21 }}>{ils(grand)}</span>
            </div>
          </div>

          {rows.some(r => r.lessons === 0 && r.specialCount === 0 && r.travelPay === 0) && (
            <div style={{ color: C.muted, fontSize: 12, marginTop: 12, textAlign: 'center' }}>
              {rows.filter(r => r.lessons === 0 && r.specialCount === 0 && r.travelPay === 0).length} מדריכים ללא פעילות החודש אינם מוצגים
            </div>
          )}
        </>
      )}
    </ManageShell>
  )
}
