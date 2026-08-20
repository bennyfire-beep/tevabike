'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DEFAULT_HOURLY_RATE, DEFAULT_RATE_PER_LESSON } from '@/lib/attendance'
import {
  ManageShell, Btn, Note, ErrorBox, C, inputStyle, labelStyle,
} from '@/components/ManageShell'

type Instructor = {
  id: string            // admin_roles.id
  name: string | null
  branch: string | null
  active: boolean | null
  ratePerLesson: number // staff_pay.rate_per_lesson — an ordinary weekly lesson
  hourlyRate: number    // staff_pay.hourly_rate     — special activities, per hour
  hasPayRow: boolean    // false → the numbers shown are defaults, not set values
}

const BRANCHES = ['משגב', 'ביריה', 'מטה אשר', 'פרוד-אמירים', 'כללי']

const emptyForm = {
  name: '', email: '', password: '', branch: 'משגב',
  ratePerLesson: String(DEFAULT_RATE_PER_LESSON),
  hourlyRate: String(DEFAULT_HOURLY_RATE),
}

export default function InstructorsClient() {
  const [list,    setList]    = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [notice,  setNotice]  = useState('')
  const [adding,  setAdding]  = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [form,    setForm]    = useState({ ...emptyForm })

  // Inline rate editing — both rates together.
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editLesson,  setEditLesson]  = useState('')
  const [editHourly,  setEditHourly]  = useState('')
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
      // Both rates live here, keyed by admin_roles.id — never on admin_roles.
      supabase.from('staff_pay').select('admin_role_id, rate_per_lesson, hourly_rate'),
    ])

    if (e1 || e2) {
      setError('הטעינה נכשלה: ' + (e1?.message ?? e2?.message))
    } else {
      const payOf = new Map((pay ?? []).map(p => [p.admin_role_id, p]))
      setList((roles ?? []).map(r => {
        const p = payOf.get(r.id)
        return {
          id: r.id,
          name: r.name,
          branch: r.branch,
          active: r.active,
          ratePerLesson: p?.rate_per_lesson == null ? DEFAULT_RATE_PER_LESSON : Number(p.rate_per_lesson),
          hourlyRate:    p?.hourly_rate     == null ? DEFAULT_HOURLY_RATE     : Number(p.hourly_rate),
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
          ratePerLesson: form.ratePerLesson || DEFAULT_RATE_PER_LESSON,
          hourlyRate:    form.hourlyRate    || DEFAULT_HOURLY_RATE,
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
    setEditLesson(String(ins.ratePerLesson))
    setEditHourly(String(ins.hourlyRate))
    setError('')
  }

  async function saveRates(id: string) {
    const perLesson = Number(editLesson)
    const hourly    = Number(editHourly)
    if (!Number.isFinite(perLesson) || perLesson < 0) { setError('תעריף לשיעור לא תקין'); return }
    if (!Number.isFinite(hourly)    || hourly    < 0) { setError('תעריף לשעה לא תקין'); return }

    setSavingRates(true)
    setError('')

    const { error: err } = await supabase
      .from('staff_pay')
      .upsert(
        { admin_role_id: id, rate_per_lesson: perLesson, hourly_rate: hourly },
        { onConflict: 'admin_role_id' },
      )

    setSavingRates(false)
    if (err) { setError('עדכון התעריפים נכשל: ' + err.message); return }

    setList(prev => prev.map(i =>
      i.id === id ? { ...i, ratePerLesson: perLesson, hourlyRate: hourly, hasPayRow: true } : i,
    ))
    setEditingId(null)
  }

  return (
    <ManageShell title="מדריכים">
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
        השכר מחושב לפי שני תעריפים אישיים: <b style={{ color: C.text }}>תעריף לשיעור</b> עבור אימון שבועי רגיל,
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>תעריף לשיעור (₪)</label>
                      <input
                        style={inputStyle} type="number" inputMode="numeric" dir="ltr" autoFocus
                        value={editLesson} onChange={e => setEditLesson(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>תעריף לשעה (₪)</label>
                      <input
                        style={inputStyle} type="number" inputMode="numeric" dir="ltr"
                        value={editHourly} onChange={e => setEditHourly(e.target.value)}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 9 }}>
                    <Btn onClick={() => saveRates(ins.id)} disabled={savingRates} style={{ flex: 1 }}>
                      {savingRates ? 'שומר...' : 'שמירה'}
                    </Btn>
                    <Btn tone="ghost" onClick={() => setEditingId(null)} disabled={savingRates}>ביטול</Btn>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                  <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, padding: '9px 12px' }}>
                    <div style={{ color: C.muted, fontSize: 11, marginBottom: 2 }}>לשיעור רגיל</div>
                    <div style={{ color: C.accent, fontWeight: 800, fontSize: 16 }}>₪{ins.ratePerLesson}</div>
                  </div>
                  <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, padding: '9px 12px' }}>
                    <div style={{ color: C.muted, fontSize: 11, marginBottom: 2 }}>★ לשעה (מיוחדת)</div>
                    <div style={{ color: '#c084fc', fontWeight: 800, fontSize: 16 }}>₪{ins.hourlyRate}</div>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>תעריף לשיעור (₪)</label>
                  <input
                    style={inputStyle} type="number" inputMode="numeric" dir="ltr"
                    value={form.ratePerLesson} onChange={e => set('ratePerLesson', e.target.value)}
                    placeholder={String(DEFAULT_RATE_PER_LESSON)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>תעריף לשעה (₪)</label>
                  <input
                    style={inputStyle} type="number" inputMode="numeric" dir="ltr"
                    value={form.hourlyRate} onChange={e => set('hourlyRate', e.target.value)}
                    placeholder={String(DEFAULT_HOURLY_RATE)}
                  />
                </div>
              </div>

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
