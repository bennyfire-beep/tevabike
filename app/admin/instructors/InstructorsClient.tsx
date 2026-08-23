'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DEFAULT_HOURLY_RATE, DEFAULT_RATE_PER_LESSON } from '@/lib/attendance'
import {
  TRAVEL_TYPES, TRAVEL_LABEL, TRAVEL_HINT, travelConfigOf, type TravelType,
} from '@/lib/travel'
import {
  LESSON_PAY_MODELS, LESSON_PAY_LABEL, LESSON_PAY_HINT, lessonPayConfigOf,
  DEFAULT_ATTENDANCE_RATE_LOW, DEFAULT_ATTENDANCE_RATE_HIGH, DEFAULT_ATTENDANCE_THRESHOLD,
  type LessonPayModel,
} from '@/lib/lesson-pay'
import {
  ManageShell, Btn, Note, ErrorBox, C, inputStyle, labelStyle,
} from '@/components/ManageShell'

type Instructor = {
  id: string            // admin_roles.id
  name: string | null
  branch: string | null
  active: boolean | null
  lessonModel: LessonPayModel // flat rate per lesson, or banded by attendance
  ratePerLesson: number // staff_pay.rate_per_lesson — an ordinary weekly lesson, flat model
  attLow: number        // by_attendance — below the threshold
  attHigh: number       // by_attendance — at or above the threshold
  attThreshold: number  // by_attendance — riders present that earn the high rate
  hourlyRate: number    // staff_pay.hourly_rate     — special activities, per hour
  travelType: TravelType
  travelKm: number
  travelRate: number
  travelMonthly: number
  hasPayRow: boolean    // false → the numbers shown are defaults, not set values
}

const BRANCHES = ['משגב', 'ביריה', 'מטה אשר', 'פרוד-אמירים', 'כללי']

const emptyForm = {
  name: '', email: '', password: '', branch: 'משגב',
  lessonModel: 'flat' as LessonPayModel,
  ratePerLesson: String(DEFAULT_RATE_PER_LESSON),
  attLow: String(DEFAULT_ATTENDANCE_RATE_LOW),
  attHigh: String(DEFAULT_ATTENDANCE_RATE_HIGH),
  attThreshold: String(DEFAULT_ATTENDANCE_THRESHOLD),
  hourlyRate: String(DEFAULT_HOURLY_RATE),
  travelType: 'none' as TravelType,
  travelKm: '', travelRate: '', travelMonthly: '',
}

/** Lesson-pay model picker plus whichever fields that choice needs. */
function LessonPayFields({
  model, flat, low, high, threshold, onModel, onFlat, onLow, onHigh, onThreshold,
}: {
  model: LessonPayModel; flat: string; low: string; high: string; threshold: string
  onModel: (m: LessonPayModel) => void
  onFlat: (v: string) => void
  onLow: (v: string) => void
  onHigh: (v: string) => void
  onThreshold: (v: string) => void
}) {
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 13 }}>
      <label style={labelStyle}>מודל שכר לשיעור</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 4 }}>
        {LESSON_PAY_MODELS.map(m => {
          const on = model === m
          return (
            <button
              key={m}
              type="button"
              onClick={() => onModel(m)}
              style={{
                background: on ? C.accent : 'transparent',
                color: on ? C.bg : C.muted,
                border: `1px solid ${on ? C.accent : C.border}`,
                borderRadius: 9, padding: '10px 4px', fontSize: 12.5, fontWeight: 700,
                fontFamily: 'inherit', cursor: 'pointer', minHeight: 44,
              }}
            >
              {LESSON_PAY_LABEL[m]}
            </button>
          )
        })}
      </div>
      <div style={{ color: C.muted, fontSize: 11.5, marginBottom: 10 }}>{LESSON_PAY_HINT[model]}</div>

      {model === 'flat' ? (
        <div>
          <label style={labelStyle}>תעריף לשיעור (₪)</label>
          <input
            style={inputStyle} type="number" inputMode="numeric" dir="ltr"
            value={flat} onChange={e => onFlat(e.target.value)}
            placeholder={String(DEFAULT_RATE_PER_LESSON)}
          />
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div>
              <label style={labelStyle}>תעריף עד הסף (₪)</label>
              <input
                style={inputStyle} type="number" inputMode="numeric" dir="ltr"
                value={low} onChange={e => onLow(e.target.value)}
                placeholder={String(DEFAULT_ATTENDANCE_RATE_LOW)}
              />
            </div>
            <div>
              <label style={labelStyle}>תעריף מהסף (₪)</label>
              <input
                style={inputStyle} type="number" inputMode="numeric" dir="ltr"
                value={high} onChange={e => onHigh(e.target.value)}
                placeholder={String(DEFAULT_ATTENDANCE_RATE_HIGH)}
              />
            </div>
            <div>
              <label style={labelStyle}>סף חניכים</label>
              <input
                style={inputStyle} type="number" inputMode="numeric" dir="ltr"
                value={threshold} onChange={e => onThreshold(e.target.value)}
                placeholder={String(DEFAULT_ATTENDANCE_THRESHOLD)}
              />
            </div>
          </div>
          <div style={{ color: C.muted, fontSize: 11.5, marginTop: 5 }}>
            עד {Math.max(Number(threshold || DEFAULT_ATTENDANCE_THRESHOLD) - 1, 0)} נוכחים → ₪{low || DEFAULT_ATTENDANCE_RATE_LOW} ·
            {' '}מ־{threshold || DEFAULT_ATTENDANCE_THRESHOLD} נוכחים → ₪{high || DEFAULT_ATTENDANCE_RATE_HIGH}
          </div>
        </>
      )}
    </div>
  )
}

/** Travel-type picker plus whichever fields that choice needs. */
function TravelFields({
  type, km, rate, monthly, onType, onKm, onRate, onMonthly,
}: {
  type: TravelType; km: string; rate: string; monthly: string
  onType: (t: TravelType) => void
  onKm: (v: string) => void
  onRate: (v: string) => void
  onMonthly: (v: string) => void
}) {
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 13 }}>
      <label style={labelStyle}>הסדר נסיעות</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 4 }}>
        {TRAVEL_TYPES.map(t => {
          const on = type === t
          return (
            <button
              key={t}
              type="button"
              onClick={() => onType(t)}
              style={{
                background: on ? C.accent : 'transparent',
                color: on ? C.bg : C.muted,
                border: `1px solid ${on ? C.accent : C.border}`,
                borderRadius: 9, padding: '10px 4px', fontSize: 12.5, fontWeight: 700,
                fontFamily: 'inherit', cursor: 'pointer', minHeight: 44,
              }}
            >
              {TRAVEL_LABEL[t]}
            </button>
          )
        })}
      </div>
      <div style={{ color: C.muted, fontSize: 11.5, marginBottom: 10 }}>{TRAVEL_HINT[type]}</div>

      {type === 'per_km' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>ק״מ ליום עבודה</label>
            <input
              style={inputStyle} type="number" inputMode="decimal" dir="ltr"
              value={km} onChange={e => onKm(e.target.value)} placeholder="0"
            />
          </div>
          <div>
            <label style={labelStyle}>תעריף לק״מ (₪)</label>
            <input
              style={inputStyle} type="number" inputMode="decimal" dir="ltr"
              value={rate} onChange={e => onRate(e.target.value)} placeholder="0"
            />
          </div>
        </div>
      )}

      {type === 'monthly_fixed' && (
        <div>
          <label style={labelStyle}>סכום חודשי (₪)</label>
          <input
            style={inputStyle} type="number" inputMode="decimal" dir="ltr"
            value={monthly} onChange={e => onMonthly(e.target.value)} placeholder="0"
          />
          <div style={{ color: C.muted, fontSize: 11.5, marginTop: 5 }}>
            זו ברירת המחדל — אפשר לשנות לחודש מסוים ישירות בדוח השכר.
          </div>
        </div>
      )}
    </div>
  )
}

export default function InstructorsClient() {
  const [list,    setList]    = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [notice,  setNotice]  = useState('')
  const [adding,  setAdding]  = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [form,    setForm]    = useState({ ...emptyForm })

  // Inline editing — both rates and the travel arrangement together.
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editModel,   setEditModel]   = useState<LessonPayModel>('flat')
  const [editLesson,  setEditLesson]  = useState('')
  const [editAttLow,  setEditAttLow]  = useState('')
  const [editAttHigh, setEditAttHigh] = useState('')
  const [editAttThreshold, setEditAttThreshold] = useState('')
  const [editHourly,  setEditHourly]  = useState('')
  const [editTravelType,    setEditTravelType]    = useState<TravelType>('none')
  const [editTravelKm,      setEditTravelKm]      = useState('')
  const [editTravelRate,    setEditTravelRate]    = useState('')
  const [editTravelMonthly, setEditTravelMonthly] = useState('')
  const [savingRates, setSavingRates] = useState(false)

  const set = (k: keyof typeof emptyForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function load() {
    setLoading(true)
    const [{ data: roles, error: e1 }, { data: pay, error: e2 }] = await Promise.all([
      supabase
        .from('admin_roles')
        .select('id, name, branch, active')
        .eq('role', 'instructor')
        .order('name'),
      // Rates and the travel arrangement live here, keyed by admin_roles.id.
      supabase
        .from('staff_pay')
        .select('admin_role_id, rate_per_lesson, hourly_rate, lesson_pay_model, attendance_rate_low, attendance_rate_high, attendance_threshold, travel_type, travel_km, travel_rate, travel_monthly_amount'),
    ])

    if (e1 || e2) {
      setError('הטעינה נכשלה: ' + (e1?.message ?? e2?.message))
    } else {
      const payOf = new Map((pay ?? []).map(p => [p.admin_role_id, p]))
      setList((roles ?? []).map(r => {
        const p = payOf.get(r.id)
        const cfg = travelConfigOf(p)
        const lesson = lessonPayConfigOf(p)
        return {
          id: r.id,
          name: r.name,
          branch: r.branch,
          active: r.active,
          lessonModel:   lesson.model,
          ratePerLesson: lesson.flat,
          attLow:        lesson.low,
          attHigh:       lesson.high,
          attThreshold:  lesson.threshold,
          hourlyRate:    p?.hourly_rate     == null ? DEFAULT_HOURLY_RATE     : Number(p.hourly_rate),
          travelType:    cfg.type,
          travelKm:      cfg.km,
          travelRate:    cfg.rate,
          travelMonthly: cfg.monthly,
          hasPayRow: !!p,
        }
      }))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addInstructor() {
    if (!form.name.trim())        { setError('שם המדריך חובה'); return }
    if (!form.email.trim())       { setError('אימייל חובה'); return }
    if (form.password.length < 6) { setError('הסיסמה חייבת להיות לפחות 6 תווים'); return }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      // The route needs the caller's JWT to verify they may add staff.
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/add-staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: 'instructor',
          branch: form.branch,
          lessonModel:   form.lessonModel,
          ratePerLesson: form.ratePerLesson || DEFAULT_RATE_PER_LESSON,
          attLow:        form.attLow        || DEFAULT_ATTENDANCE_RATE_LOW,
          attHigh:       form.attHigh       || DEFAULT_ATTENDANCE_RATE_HIGH,
          attThreshold:  form.attThreshold  || DEFAULT_ATTENDANCE_THRESHOLD,
          hourlyRate:    form.hourlyRate    || DEFAULT_HOURLY_RATE,
          travelType:    form.travelType,
          travelKm:      form.travelType === 'per_km'        ? (form.travelKm || 0) : 0,
          travelRate:    form.travelType === 'per_km'        ? (form.travelRate || 0) : 0,
          travelMonthly: form.travelType === 'monthly_fixed' ? (form.travelMonthly || 0) : 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ההוספה נכשלה')
      if (data.warning) setNotice(data.warning)

      setForm({ ...emptyForm })
      setAdding(false)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ההוספה נכשלה')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(ins: Instructor) {
    setEditingId(ins.id)
    setEditModel(ins.lessonModel)
    setEditLesson(String(ins.ratePerLesson))
    setEditAttLow(String(ins.attLow))
    setEditAttHigh(String(ins.attHigh))
    setEditAttThreshold(String(ins.attThreshold))
    setEditHourly(String(ins.hourlyRate))
    setEditTravelType(ins.travelType)
    setEditTravelKm(String(ins.travelKm))
    setEditTravelRate(String(ins.travelRate))
    setEditTravelMonthly(String(ins.travelMonthly))
    setError('')
  }

  async function saveRates(id: string) {
    const perLesson = Number(editLesson)
    const hourly    = Number(editHourly)
    if (!Number.isFinite(perLesson) || perLesson < 0) { setError('תעריף לשיעור לא תקין'); return }
    if (!Number.isFinite(hourly)    || hourly    < 0) { setError('תעריף לשעה לא תקין'); return }

    // The bands are stored whichever model is chosen — zeroing them the way the
    // travel fields do would make a later switch to "לפי נוכחות" pay ₪0.
    const attLow  = Number(editAttLow || 0)
    const attHigh = Number(editAttHigh || 0)
    const attThr  = Number(editAttThreshold || 0)
    if (editModel === 'by_attendance') {
      if (!Number.isFinite(attLow)  || attLow  < 0) { setError('תעריף עד הסף לא תקין'); return }
      if (!Number.isFinite(attHigh) || attHigh < 0) { setError('תעריף מהסף לא תקין'); return }
      if (!Number.isInteger(attThr) || attThr  < 1) { setError('סף חניכים לא תקין — מספר שלם מ־1 ומעלה'); return }
    }

    // Only the fields the chosen arrangement uses are validated and stored;
    // the others are zeroed so a stale value cannot resurface after a switch.
    const km      = editTravelType === 'per_km'        ? Number(editTravelKm || 0)      : 0
    const rate    = editTravelType === 'per_km'        ? Number(editTravelRate || 0)    : 0
    const monthly = editTravelType === 'monthly_fixed' ? Number(editTravelMonthly || 0) : 0
    if (!Number.isFinite(km) || km < 0)           { setError('ק״מ לא תקין'); return }
    if (!Number.isFinite(rate) || rate < 0)       { setError('תעריף לק״מ לא תקין'); return }
    if (!Number.isFinite(monthly) || monthly < 0) { setError('סכום חודשי לא תקין'); return }

    setSavingRates(true)
    setError('')

    const { error: err } = await supabase
      .from('staff_pay')
      .upsert(
        {
          admin_role_id: id,
          lesson_pay_model: editModel,
          rate_per_lesson: perLesson,
          attendance_rate_low: attLow,
          attendance_rate_high: attHigh,
          attendance_threshold: attThr,
          hourly_rate: hourly,
          travel_type: editTravelType,
          travel_km: km,
          travel_rate: rate,
          travel_monthly_amount: monthly,
        },
        { onConflict: 'admin_role_id' },
      )

    setSavingRates(false)
    if (err) { setError('העדכון נכשל: ' + err.message); return }

    setList(prev => prev.map(i =>
      i.id === id
        ? {
            ...i, lessonModel: editModel, ratePerLesson: perLesson, hourlyRate: hourly,
            attLow, attHigh, attThreshold: attThr,
            travelType: editTravelType, travelKm: km, travelRate: rate, travelMonthly: monthly,
            hasPayRow: true,
          }
        : i,
    ))
    setEditingId(null)
  }

  return (
    <ManageShell title="מדריכים" salaryOnly>
      <ErrorBox>{error}</ErrorBox>
      {notice && (
        <div style={{ background: '#f59e0b22', border: '1px solid #f59e0b44', borderRadius: 8, padding: '10px 14px', color: '#fbbf24', fontSize: 13, marginBottom: 14 }}>
          {notice}
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <Btn onClick={() => { setAdding(true); setError(''); setNotice('') }}>+ הוסף מדריך</Btn>
      </div>

      <p style={{ color: C.muted, fontSize: 12.5, margin: '0 0 14px', lineHeight: 1.75 }}>
        השכר מחושב לפי תעריפים אישיים: <b style={{ color: C.text }}>שכר לשיעור</b> עבור אימון שבועי רגיל —
        קבוע, או <b style={{ color: C.text }}>לפי נוכחות</b> (תעריף נמוך עד הסף, גבוה ממנו ומעלה) —
        ו־<b style={{ color: C.text }}>תעריף לשעה</b> עבור פעילות מיוחדת (מחנה, ימי שיא) — שעות × תעריף.
      </p>

      {loading ? <Note>טוען מדריכים...</Note> : list.length === 0 ? (
        <Note>אין מדריכים להצגה</Note>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {list.map(ins => (
            <div
              key={ins.id}
              style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                padding: 15, opacity: ins.active === false ? 0.5 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{ins.name ?? '—'}</div>
                  <div style={{ color: C.muted, fontSize: 12.5, marginTop: 3 }}>
                    📍 {ins.branch ?? 'כללי'}
                    {ins.active === false && ' · לא פעיל'}
                    {!ins.hasPayRow && ' · תעריפי ברירת מחדל'}
                  </div>
                </div>
                {editingId !== ins.id && (
                  <Btn tone="ghost" onClick={() => startEdit(ins)} style={{ padding: '9px 14px', minHeight: 40, whiteSpace: 'nowrap' }}>
                    ✎ ערוך תעריפים
                  </Btn>
                )}
              </div>

              {editingId === ins.id ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>★ תעריף לשעה (₪) — פעילות מיוחדת</label>
                    <input
                      style={inputStyle} type="number" inputMode="numeric" dir="ltr" autoFocus
                      value={editHourly} onChange={e => setEditHourly(e.target.value)}
                    />
                  </div>
                  <LessonPayFields
                    model={editModel} flat={editLesson} low={editAttLow}
                    high={editAttHigh} threshold={editAttThreshold}
                    onModel={setEditModel} onFlat={setEditLesson} onLow={setEditAttLow}
                    onHigh={setEditAttHigh} onThreshold={setEditAttThreshold}
                  />
                  <TravelFields
                    type={editTravelType} km={editTravelKm} rate={editTravelRate} monthly={editTravelMonthly}
                    onType={setEditTravelType} onKm={setEditTravelKm}
                    onRate={setEditTravelRate} onMonthly={setEditTravelMonthly}
                  />

                  <div style={{ display: 'flex', gap: 9 }}>
                    <Btn onClick={() => saveRates(ins.id)} disabled={savingRates} style={{ flex: 1 }}>
                      {savingRates ? 'שומר...' : 'שמירה'}
                    </Btn>
                    <Btn tone="ghost" onClick={() => setEditingId(null)} disabled={savingRates}>ביטול</Btn>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 9 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, padding: '9px 12px' }}>
                      <div style={{ color: C.muted, fontSize: 11, marginBottom: 2 }}>
                        לשיעור רגיל{ins.lessonModel === 'by_attendance' && ' · לפי נוכחות'}
                      </div>
                      <div style={{ color: C.accent, fontWeight: 800, fontSize: 16 }}>
                        {ins.lessonModel === 'by_attendance'
                          ? `₪${ins.attLow} / ₪${ins.attHigh}`
                          : `₪${ins.ratePerLesson}`}
                      </div>
                      {ins.lessonModel === 'by_attendance' && (
                        <div style={{ color: C.muted, fontSize: 10.5, marginTop: 2 }}>
                          מ־{ins.attThreshold} נוכחים → ₪{ins.attHigh}
                        </div>
                      )}
                    </div>
                    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, padding: '9px 12px' }}>
                      <div style={{ color: C.muted, fontSize: 11, marginBottom: 2 }}>★ לשעה (מיוחדת)</div>
                      <div style={{ color: '#c084fc', fontWeight: 800, fontSize: 16 }}>₪{ins.hourlyRate}</div>
                    </div>
                  </div>

                  <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, padding: '9px 12px' }}>
                    <div style={{ color: C.muted, fontSize: 11, marginBottom: 2 }}>🚗 נסיעות · {TRAVEL_LABEL[ins.travelType]}</div>
                    <div style={{ color: '#81d4fa', fontWeight: 800, fontSize: 14 }}>
                      {ins.travelType === 'per_km' && (
                        ins.travelKm > 0
                          ? `${ins.travelKm} ק״מ × ₪${ins.travelRate} ליום עבודה`
                          : <span style={{ color: '#fbbf24' }}>חסר ק״מ ליום — הנסיעות יחושבו ₪0</span>
                      )}
                      {ins.travelType === 'monthly_fixed' && `₪${ins.travelMonthly} לחודש`}
                      {ins.travelType === 'none' && <span style={{ color: C.muted, fontWeight: 600 }}>ללא החזר</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Add dialog ── */}
      {adding && (
        <div
          onClick={() => !saving && setAdding(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '16px 16px 0 0', padding: 20, width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto' }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 6px' }}>הוספת מדריך</h2>
            <p style={{ color: C.muted, fontSize: 12.5, margin: '0 0 16px', lineHeight: 1.6 }}>
              נוצר גם חשבון כניסה למערכת. מסרו למדריך את האימייל והסיסמה.
            </p>

            <div style={{ display: 'grid', gap: 13 }}>
              <div>
                <label style={labelStyle}>שם מלא *</label>
                <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>אימייל *</label>
                <input style={inputStyle} type="email" dir="ltr" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>סיסמה ראשונית * (6 תווים לפחות)</label>
                <input style={inputStyle} type="text" dir="ltr" value={form.password} onChange={e => set('password', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>סניף</label>
                <select style={inputStyle} value={form.branch} onChange={e => set('branch', e.target.value)}>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>★ תעריף לשעה (₪) — פעילות מיוחדת</label>
                <input
                  style={inputStyle} type="number" inputMode="numeric" dir="ltr"
                  value={form.hourlyRate} onChange={e => set('hourlyRate', e.target.value)}
                  placeholder={String(DEFAULT_HOURLY_RATE)}
                />
              </div>

              <LessonPayFields
                model={form.lessonModel} flat={form.ratePerLesson} low={form.attLow}
                high={form.attHigh} threshold={form.attThreshold}
                onModel={m => setForm(f => ({ ...f, lessonModel: m }))}
                onFlat={v => set('ratePerLesson', v)}
                onLow={v => set('attLow', v)}
                onHigh={v => set('attHigh', v)}
                onThreshold={v => set('attThreshold', v)}
              />

              <TravelFields
                type={form.travelType} km={form.travelKm} rate={form.travelRate} monthly={form.travelMonthly}
                onType={t => setForm(f => ({ ...f, travelType: t }))}
                onKm={v => set('travelKm', v)}
                onRate={v => set('travelRate', v)}
                onMonthly={v => set('travelMonthly', v)}
              />

              <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                <Btn onClick={addInstructor} disabled={saving} style={{ flex: 1 }}>
                  {saving ? 'שומר...' : 'הוספה'}
                </Btn>
                <Btn tone="ghost" onClick={() => setAdding(false)} disabled={saving}>ביטול</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </ManageShell>
  )
}
