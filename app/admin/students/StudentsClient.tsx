'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ManageShell, Btn, Note, ErrorBox, C, DAY_NAMES, TRACK_LABEL, inputStyle, labelStyle,
} from '@/components/ManageShell'

type Group   = { id: string; name: string; branch: string; days_of_week: number[] | null }
type Student = {
  id: string
  full_name: string
  parent_name: string | null
  phone: string | null
  parent_phone: string | null
  email: string | null
  group_id: string | null
  track: string | null
  chosen_day: number | null
  monthly_price: number | null
  active: boolean | null
}

// Track prices for summer 2026. Picking a track prefills the price, which the
// coordinator can still override per student (siblings, mid-season joins).
const TRACK_PRICE: Record<string, number> = {
  once_weekly:  300,
  twice_weekly: 550,
}

const emptyForm = {
  full_name: '', parent_name: '', phone: '', email: '',
  group_id: '', track: '', chosen_day: '', monthly_price: '',
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [groups,   setGroups]   = useState<Group[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [adding,   setAdding]   = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [q,        setQ]        = useState('')
  const [form,     setForm]     = useState({ ...emptyForm })

  const set = (k: keyof typeof emptyForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function load() {
    setLoading(true)
    const [{ data: st, error: e1 }, { data: gr, error: e2 }] = await Promise.all([
      supabase
        .from('riders')
        .select('id, full_name, parent_name, phone, parent_phone, email, group_id, track, chosen_day, monthly_price, active')
        .order('full_name'),
      supabase
        .from('groups')
        .select('id, name, branch, days_of_week')
        .eq('is_active', true)
        .order('name'),
    ])

    if (e1 || e2) setError('הטעינה נכשלה: ' + (e1?.message ?? e2?.message))
    else {
      setStudents((st ?? []) as Student[])
      setGroups((gr ?? []) as Group[])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function pickTrack(track: string) {
    set('track', track)
    // Prefill the price, and clear the day when both days are attended.
    setForm(f => ({
      ...f,
      track,
      monthly_price: String(TRACK_PRICE[track] ?? ''),
      chosen_day: track === 'twice_weekly' ? '' : f.chosen_day,
    }))
  }

  async function addStudent() {
    if (!form.full_name.trim()) { setError('שם החניך חובה'); return }
    if (!form.phone.trim())     { setError('טלפון חובה'); return }
    if (form.track === 'once_weekly' && !form.chosen_day) {
      setError('במסלול פעם בשבוע צריך לבחור יום')
      return
    }

    setSaving(true)
    setError('')

    const { error: err } = await supabase.from('riders').insert({
      full_name:     form.full_name.trim(),
      parent_name:   form.parent_name.trim() || null,
      // `phone` is the parent's contact on this form; parent_phone mirrors it so
      // the existing screens that read parent_phone keep working.
      phone:         form.phone.trim(),
      parent_phone:  form.phone.trim(),
      email:         form.email.trim() || null,
      group_id:      form.group_id || null,
      track:         form.track || null,
      chosen_day:    form.chosen_day === '' ? null : parseInt(form.chosen_day, 10),
      monthly_price: form.monthly_price === '' ? null : Number(form.monthly_price),
      is_child:      true,
      active:        true,
    })

    setSaving(false)
    if (err) { setError('ההוספה נכשלה: ' + err.message); return }
    setForm({ ...emptyForm })
    setAdding(false)
    load()
  }

  const groupName = (id: string | null) => groups.find(g => g.id === id)?.name ?? '—'

  const filtered = students.filter(s => {
    if (!q.trim()) return true
    const needle = q.trim()
    return (
      s.full_name?.includes(needle) ||
      s.parent_name?.includes(needle) ||
      s.phone?.includes(needle)
    )
  })

  return (
    <ManageShell title="חניכים">
      <ErrorBox>{error}</ErrorBox>

      <div style={{ display: 'flex', gap: 9, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          style={{ ...inputStyle, flex: 1, minWidth: 180 }}
          placeholder="חיפוש לפי שם / הורה / טלפון"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <Btn onClick={() => { setAdding(true); setError('') }}>+ הוסף חניך</Btn>
      </div>

      {loading ? <Note>טוען חניכים...</Note> : filtered.length === 0 ? (
        <Note>{q ? 'לא נמצאו חניכים' : 'אין חניכים להצגה'}</Note>
      ) : (
        <>
          <div style={{ color: C.muted, fontSize: 12, marginBottom: 9 }}>
            {filtered.length} חניכים
          </div>

          <div style={{ display: 'grid', gap: 9 }}>
            {filtered.map(s => (
              <div
                key={s.id}
                style={{
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                  padding: 14, opacity: s.active === false ? 0.5 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 3 }}>{s.full_name}</div>
                    <div style={{ color: C.muted, fontSize: 12.5, lineHeight: 1.75 }}>
                      {s.parent_name && <div>👤 {s.parent_name}</div>}
                      {(s.phone || s.parent_phone) && <div>📞 {s.phone || s.parent_phone}</div>}
                      <div>👥 {groupName(s.group_id)}</div>
                      {s.track && (
                        <div>
                          🗓️ {TRACK_LABEL[s.track] ?? s.track}
                          {s.chosen_day !== null && s.chosen_day !== undefined && ` · ${DAY_NAMES[s.chosen_day]}`}
                        </div>
                      )}
                    </div>
                  </div>
                  {s.monthly_price != null && (
                    <div style={{ color: C.accent, fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap' }}>
                      ₪{s.monthly_price}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
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
            <h2 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 16px' }}>הוספת חניך</h2>

            <div style={{ display: 'grid', gap: 13 }}>
              <div>
                <label style={labelStyle}>שם החניך *</label>
                <input style={inputStyle} value={form.full_name} onChange={e => set('full_name', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>שם ההורה</label>
                <input style={inputStyle} value={form.parent_name} onChange={e => set('parent_name', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>טלפון *</label>
                <input style={inputStyle} type="tel" inputMode="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>אימייל</label>
                <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>קבוצה</label>
                <select style={inputStyle} value={form.group_id} onChange={e => set('group_id', e.target.value)}>
                  <option value="">— בחר קבוצה —</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name} · {g.branch}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>מסלול</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {Object.entries(TRACK_LABEL).map(([value, label]) => {
                    const on = form.track === value
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => pickTrack(value)}
                        style={{
                          background: on ? C.accent : 'transparent',
                          color: on ? C.bg : C.muted,
                          border: `1px solid ${on ? C.accent : C.border}`,
                          borderRadius: 9, padding: '11px 8px', fontSize: 13, fontWeight: 700,
                          fontFamily: 'inherit', cursor: 'pointer', minHeight: 46, lineHeight: 1.4,
                        }}
                      >
                        {label}
                        <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 600 }}>₪{TRACK_PRICE[value]}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {form.track === 'once_weekly' && (
                <div>
                  <label style={labelStyle}>יום קבוע *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[0, 4].map(d => {
                      const on = form.chosen_day === String(d)
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => set('chosen_day', String(d))}
                          style={{
                            background: on ? C.accent : 'transparent',
                            color: on ? C.bg : C.muted,
                            border: `1px solid ${on ? C.accent : C.border}`,
                            borderRadius: 9, padding: '11px 8px', fontSize: 13, fontWeight: 700,
                            fontFamily: 'inherit', cursor: 'pointer', minHeight: 44,
                          }}
                        >
                          {DAY_NAMES[d]}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div>
                <label style={labelStyle}>מחיר חודשי (₪)</label>
                <input
                  style={inputStyle}
                  type="number"
                  inputMode="numeric"
                  value={form.monthly_price}
                  onChange={e => set('monthly_price', e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                <Btn onClick={addStudent} disabled={saving} style={{ flex: 1 }}>
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
