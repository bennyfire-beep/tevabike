'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ManageShell, Btn, Note, ErrorBox, C, inputStyle, labelStyle,
} from '@/components/ManageShell'

type Instructor = {
  id: string            // admin_roles.id
  name: string | null
  branch: string | null
  active: boolean | null
  ratePerLesson: number
}

const DEFAULT_RATE = 150
const BRANCHES = ['משגב', 'ביריה', 'מטה אשר', 'פרוד-אמירים', 'כללי']

const emptyForm = { name: '', email: '', password: '', branch: 'משגב', rate: String(DEFAULT_RATE) }

export default function InstructorsPage() {
  const [list,    setList]    = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [notice,  setNotice]  = useState('')
  const [adding,  setAdding]  = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [form,    setForm]    = useState({ ...emptyForm })

  // Inline rate editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [rateInput, setRateInput] = useState('')

  const set = (k: keyof typeof emptyForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function load() {
    setLoading(true)
    const [{ data: roles, error: e1 }, { data: pay, error: e2 }] = await Promise.all([
      supabase
        .from('admin_roles')
        .select('id, name, branch, active')
        .eq('role', 'instructor')
        .order('name'),
      supabase.from('staff_pay').select('admin_role_id, rate_per_lesson'),
    ])

    if (e1 || e2) {
      setError('הטעינה נכשלה: ' + (e1?.message ?? e2?.message))
    } else {
      const rateOf = new Map((pay ?? []).map(p => [p.admin_role_id, Number(p.rate_per_lesson ?? DEFAULT_RATE)]))
      setList((roles ?? []).map(r => ({
        id: r.id,
        name: r.name,
        branch: r.branch,
        active: r.active,
        ratePerLesson: rateOf.get(r.id) ?? DEFAULT_RATE,
      })))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addInstructor() {
    if (!form.name.trim())     { setError('שם המדריך חובה'); return }
    if (!form.email.trim())    { setError('אימייל חובה'); return }
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
          ratePerLesson: form.rate || DEFAULT_RATE,
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

  async function saveRate(id: string) {
    const rate = Number(rateInput)
    if (!Number.isFinite(rate) || rate < 0) { setError('תעריף לא תקין'); return }

    setError('')
    const { error: err } = await supabase
      .from('staff_pay')
      .upsert({ admin_role_id: id, rate_per_lesson: rate }, { onConflict: 'admin_role_id' })

    if (err) { setError('עדכון התעריף נכשל: ' + err.message); return }
    setList(prev => prev.map(i => (i.id === id ? { ...i, ratePerLesson: rate } : i)))
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

      <div style={{ marginBottom: 16 }}>
        <Btn onClick={() => { setAdding(true); setError(''); setNotice('') }}>+ הוסף מדריך</Btn>
      </div>

      {loading ? <Note>טוען מדריכים...</Note> : list.length === 0 ? (
        <Note>אין מדריכים להצגה</Note>
      ) : (
        <div style={{ display: 'grid', gap: 9 }}>
          {list.map(ins => (
            <div
              key={ins.id}
              style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                padding: 14, opacity: ins.active === false ? 0.5 : 1,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                gap: 12, flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{ins.name ?? '—'}</div>
                <div style={{ color: C.muted, fontSize: 12.5, marginTop: 3 }}>
                  📍 {ins.branch ?? 'כללי'}
                  {ins.active === false && ' · לא פעיל'}
                </div>
              </div>

              {editingId === ins.id ? (
                <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                  <input
                    style={{ ...inputStyle, width: 100 }}
                    type="number"
                    inputMode="numeric"
                    dir="ltr"
                    autoFocus
                    value={rateInput}
                    onChange={e => setRateInput(e.target.value)}
                  />
                  <Btn onClick={() => saveRate(ins.id)} style={{ padding: '11px 14px' }}>שמור</Btn>
                  <Btn tone="ghost" onClick={() => setEditingId(null)} style={{ padding: '11px 12px' }}>✕</Btn>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingId(ins.id); setRateInput(String(ins.ratePerLesson)) }}
                  style={{
                    background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8,
                    color: C.accent, fontWeight: 800, fontSize: 14, padding: '9px 13px',
                    fontFamily: 'inherit', cursor: 'pointer', minHeight: 42, whiteSpace: 'nowrap',
                  }}
                >
                  ₪{ins.ratePerLesson} / שיעור ✎
                </button>
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
                <label style={labelStyle}>תעריף לשיעור (₪)</label>
                <input
                  style={inputStyle}
                  type="number"
                  inputMode="numeric"
                  dir="ltr"
                  value={form.rate}
                  onChange={e => set('rate', e.target.value)}
                  placeholder={String(DEFAULT_RATE)}
                />
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
