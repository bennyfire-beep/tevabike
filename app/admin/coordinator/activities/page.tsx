'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'
import {
  ACTIVITY_KINDS, ACTIVITY_KIND_META, ACTIVITY_SELECT, REGISTRATION_STATUS_LABEL, formatActivityDates, publicName,
  type Activity, type ActivityKind, type RegistrationStatus,
} from '@/lib/activities'

// ============================================================
// פעילויות באפליקציה — מחנות, הקפצות, טיולים ואירועים שרוכבים נרשמים
// אליהם מהטלפון (/student). כאן מעלים פעילות, קובעים מספר מקומות,
// ורואים מי נרשם, מי אישר להציג שם ומי שילם.
// טבלאות: activities, activity_registrations · API לרוכבים: app/api/activities
// ============================================================

const card: React.CSSProperties = { background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: 16, color: '#e8efe9' }
const btn: React.CSSProperties = {
  background: '#1a2114', color: '#b5e853', border: '1px solid #2f4020', borderRadius: 8,
  padding: '7px 14px', fontSize: 13, fontWeight: 600, fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer',
}
const ghostBtn: React.CSSProperties = { ...btn, background: 'transparent', color: '#c3ccc4', border: '1px solid #252b27' }
const dangerBtn: React.CSSProperties = { ...btn, background: '#3a1a1a', color: '#f87171', border: '1px solid #7f2d2d' }
const muted: React.CSSProperties = { color: '#7a8f7d', fontSize: 12 }
const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: '#0d100f', color: '#e8efe9',
  border: '1px solid #252b27', borderRadius: 8, padding: '8px 10px', fontSize: 14, fontFamily: 'inherit',
}
const label: React.CSSProperties = { ...muted, display: 'block', marginBottom: 4, fontWeight: 600 }

type Draft = {
  title: string; kind: ActivityKind; start_date: string; end_date: string; location: string
  description: string; image_url: string; capacity: string; price: string; pay_url: string
  published: boolean; registration_open: boolean; show_attendees: boolean
}
const EMPTY: Draft = {
  title: '', kind: 'camp', start_date: '', end_date: '', location: '', description: '', image_url: '',
  capacity: '', price: '', pay_url: '', published: false, registration_open: true, show_attendees: true,
}
const toDraft = (a: Activity): Draft => ({
  title: a.title, kind: a.kind, start_date: a.start_date, end_date: a.end_date ?? '', location: a.location ?? '',
  description: a.description ?? '', image_url: a.image_url ?? '',
  capacity: a.capacity?.toString() ?? '', price: a.price?.toString() ?? '', pay_url: a.pay_url ?? '',
  published: a.published, registration_open: a.registration_open, show_attendees: a.show_attendees,
})

type Registration = {
  id: string; created_at: string; activity_id: string; show_name: boolean; parent_name: string
  submitted_by_parent: boolean; health_notes: string | null; status: RegistrationStatus
  riders: { full_name: string | null; phone: string | null; parent_phone: string | null } | null
}

export default function ActivitiesAdminPage() {
  const user = useCoordinator()
  const [activities, setActivities] = useState<Activity[]>([])
  const [regs, setRegs] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)

  const fetchAll = useCallback(async () => {
    const [a, r] = await Promise.all([
      supabase.from('activities').select(ACTIVITY_SELECT).order('start_date', { ascending: true }),
      supabase.from('activity_registrations')
        .select('id, created_at, activity_id, show_name, parent_name, submitted_by_parent, health_notes, status, riders(full_name, phone, parent_phone)')
        .order('created_at', { ascending: true }),
    ])
    return {
      activities: (a.data ?? []) as Activity[],
      regs: (r.data ?? []) as unknown as Registration[],
      error: a.error?.message ?? r.error?.message ?? null,
    }
  }, [])

  const load = useCallback(async () => {
    const res = await fetchAll()
    setError(res.error)
    setActivities(res.activities)
    setRegs(res.regs)
  }, [fetchAll])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchAll().then((res) => {
      if (cancelled) return
      setError(res.error)
      setActivities(res.activities)
      setRegs(res.regs)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [user, fetchAll])

  function startEdit(a: Activity) {
    setEditingId(a.id)
    setDraft(toDraft(a))
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(EMPTY)
    setError(null)
  }

  async function save() {
    setError(null)
    const title = draft.title.trim()
    if (!title) { setError('צריך לכתוב שם לפעילות'); return }
    if (!draft.start_date) { setError('צריך לבחור תאריך התחלה'); return }
    const end = draft.end_date && draft.end_date !== draft.start_date ? draft.end_date : null
    if (end && end < draft.start_date) { setError('תאריך הסיום לפני תאריך ההתחלה'); return }
    const capacity = draft.capacity.trim() ? Number(draft.capacity) : null
    if (capacity != null && (!Number.isInteger(capacity) || capacity < 1)) { setError('מספר המקומות צריך להיות מספר שלם חיובי'); return }
    const price = draft.price.trim() ? Number(draft.price) : null
    if (price != null && (!Number.isFinite(price) || price < 0)) { setError('מחיר לא תקין'); return }

    const row = {
      title, kind: draft.kind, start_date: draft.start_date, end_date: end,
      location: draft.location.trim() || null, description: draft.description.trim() || null,
      image_url: draft.image_url.trim() || null, capacity, price: price == null ? null : Math.round(price),
      pay_url: draft.pay_url.trim() || null, published: draft.published,
      registration_open: draft.registration_open, show_attendees: draft.show_attendees,
    }
    setSaving(true)
    const { error } = editingId
      ? await supabase.from('activities').update(row).eq('id', editingId)
      : await supabase.from('activities').insert(row)
    setSaving(false)
    if (error) { setError(error.message); return }
    cancelEdit()
    await load()
  }

  async function patchActivity(a: Activity, patch: Partial<Activity>) {
    const { error } = await supabase.from('activities').update(patch).eq('id', a.id)
    if (error) { setError(error.message); return }
    await load()
  }

  async function remove(a: Activity) {
    const count = regs.filter((r) => r.activity_id === a.id).length
    const warn = count ? `\nשים לב: ${count} הרשמות יימחקו איתה.` : ''
    if (!confirm(`למחוק את "${a.title}"?${warn}`)) return
    const { error } = await supabase.from('activities').delete().eq('id', a.id)
    if (error) { setError(error.message); return }
    if (editingId === a.id) cancelEdit()
    await load()
  }

  async function setStatus(r: Registration, status: RegistrationStatus) {
    const { error } = await supabase.from('activity_registrations')
      .update({ status, cancelled_at: status === 'cancelled' ? new Date().toISOString() : null })
      .eq('id', r.id)
    if (error) { setError(error.message.includes('one_live') ? 'לרוכב כבר יש הרשמה פעילה אחרת לפעילות הזו' : error.message); return }
    await load()
  }

  if (!user) return null

  const todayIso = new Date().toLocaleDateString('en-CA')
  const isPast = (a: Activity) => (a.end_date ?? a.start_date) < todayIso
  const pastCount = activities.filter(isPast).length
  const shown = showPast ? activities : activities.filter((a) => !isPast(a))
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v })

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>פעילויות באפליקציה</h2>
          <p style={{ ...muted, fontSize: 13, margin: 0 }}>
            {loading ? 'טוען...' : 'מחנות, הקפצות, טיולים ואירועים שרוכבים נרשמים אליהם מהטלפון (פורטל החניך)'}
          </p>
        </div>
        <div style={{ marginRight: 'auto' }}>
          <a href="/student" target="_blank" rel="noopener noreferrer" style={{ ...ghostBtn, textDecoration: 'none' }}>פתיחת פורטל החניך</a>
        </div>
      </div>

      {/* ── Add / edit form ── */}
      <div style={{ ...card, marginBottom: 20, borderColor: editingId ? '#b5e853' : '#252b27' }}>
        <div style={{ fontWeight: 800, marginBottom: 12 }}>{editingId ? '✏️ עריכת פעילות' : '+ פעילות חדשה'}</div>
        <div style={{ marginBottom: 12 }}>
          <label style={label}>שם הפעילות *</label>
          <input style={input} value={draft.title} placeholder="למשל: טיסה למורזין — נוער" onChange={(e) => set('title', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={label}>סוג</label>
            <select style={input} value={draft.kind} onChange={(e) => set('kind', e.target.value as ActivityKind)}>
              {ACTIVITY_KINDS.map((k) => <option key={k} value={k}>{ACTIVITY_KIND_META[k].icon} {ACTIVITY_KIND_META[k].label}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>תאריך התחלה *</label>
            <input type="date" style={input} value={draft.start_date} onChange={(e) => set('start_date', e.target.value)} />
          </div>
          <div>
            <label style={label}>תאריך סיום (לכמה ימים)</label>
            <input type="date" style={input} value={draft.end_date} min={draft.start_date || undefined} onChange={(e) => set('end_date', e.target.value)} />
          </div>
          <div>
            <label style={label}>מספר מקומות (ריק = ללא הגבלה)</label>
            <input type="number" min={1} style={input} value={draft.capacity} onChange={(e) => set('capacity', e.target.value)} />
          </div>
          <div>
            <label style={label}>מחיר ₪</label>
            <input type="number" min={0} style={input} value={draft.price} onChange={(e) => set('price', e.target.value)} />
          </div>
          <div>
            <label style={label}>מיקום</label>
            <input style={input} value={draft.location} placeholder="למשל: מורזין, צרפת" onChange={(e) => set('location', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={label}>קישור תשלום (Arbox)</label>
            <input style={{ ...input, direction: 'ltr' }} value={draft.pay_url} placeholder="https://arbox.link/…" onChange={(e) => set('pay_url', e.target.value)} />
          </div>
          <div>
            <label style={label}>תמונה (קישור, למשל /morzine-youth-banner.png)</label>
            <input style={{ ...input, direction: 'ltr' }} value={draft.image_url} onChange={(e) => set('image_url', e.target.value)} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={label}>תיאור (מה כולל, מה להביא, שעות…)</label>
          <textarea style={{ ...input, resize: 'vertical' }} rows={4} value={draft.description} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 14, fontSize: 13 }}>
          <Check on={draft.published} onChange={(v) => set('published', v)} text="מפורסם באפליקציה" />
          <Check on={draft.registration_open} onChange={(v) => set('registration_open', v)} text="ההרשמה פתוחה" />
          <Check on={draft.show_attendees} onChange={(v) => set('show_attendees', v)} text='להציג "מי מגיע" (רק מי שאישר שם)' />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btn} disabled={saving} onClick={save}>
            {saving ? 'שומר…' : editingId ? 'שמירת שינויים' : 'הוספת פעילות'}
          </button>
          {editingId && <button style={ghostBtn} onClick={cancelEdit}>ביטול</button>}
        </div>
      </div>

      {error && <div style={{ ...card, background: '#3a1a1a', borderColor: '#7f2d2d', color: '#fecaca', marginBottom: 16 }}>{error}</div>}

      {/* ── List ── */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 700 }}>{showPast ? 'כל הפעילויות' : 'פעילויות קרובות'}</div>
        {pastCount > 0 && (
          <button style={{ ...ghostBtn, marginRight: 'auto', padding: '4px 10px', fontSize: 12 }} onClick={() => setShowPast(!showPast)}>
            {showPast ? 'הסתרת פעילויות שעברו' : `הצגת ${pastCount} פעילויות שעברו`}
          </button>
        )}
      </div>

      {!loading && shown.length === 0 && <div style={{ ...card, ...muted, fontSize: 14, textAlign: 'center' }}>אין פעילויות עדיין</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {shown.map((a) => {
          const mine = regs.filter((r) => r.activity_id === a.id)
          const live = mine.filter((r) => r.status !== 'cancelled')
          const paid = live.filter((r) => r.status === 'paid').length
          const open = openId === a.id
          return (
            <div key={a.id} style={{ ...card, padding: 0, opacity: isPast(a) ? 0.6 : 1 }}>
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700 }}>
                    {ACTIVITY_KIND_META[a.kind].icon} {a.title}
                    {!a.published && <span style={{ ...muted, marginRight: 8, color: '#f2b134' }}>· טיוטה (לא מפורסם)</span>}
                    {a.published && !a.registration_open && <span style={{ ...muted, marginRight: 8, color: '#f87171' }}>· הרשמה סגורה</span>}
                  </div>
                  <div style={muted}>
                    {formatActivityDates(a)}{a.location ? ` · ${a.location}` : ''} ·{' '}
                    <b style={{ color: '#b5e853' }}>{live.length}{a.capacity ? `/${a.capacity}` : ''}</b> נרשמו · {paid} שילמו
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button style={ghostBtn} onClick={() => setOpenId(open ? null : a.id)}>{open ? 'סגירה' : `נרשמים (${live.length})`}</button>
                  <button style={ghostBtn} onClick={() => patchActivity(a, { published: !a.published })}>{a.published ? 'הסתרה' : 'פרסום'}</button>
                  <button style={ghostBtn} onClick={() => patchActivity(a, { registration_open: !a.registration_open })}>{a.registration_open ? 'סגירת הרשמה' : 'פתיחת הרשמה'}</button>
                  <button style={btn} onClick={() => startEdit(a)}>עריכה</button>
                  <button style={dangerBtn} onClick={() => remove(a)}>מחיקה</button>
                </div>
              </div>

              {open && (
                <div style={{ borderTop: '1px solid #252b27', padding: 12, overflowX: 'auto' }}>
                  {mine.length === 0 ? (
                    <div style={{ ...muted, textAlign: 'center', padding: 8 }}>אין נרשמים עדיין</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ ...muted, textAlign: 'right' }}>
                          <th style={th}>רוכב</th><th style={th}>טלפון</th><th style={th}>הורה מאשר</th>
                          <th style={th}>שם גלוי</th><th style={th}>הערות</th><th style={th}>סטטוס</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mine.map((r) => (
                          <tr key={r.id} style={{ borderTop: '1px solid #252b27', opacity: r.status === 'cancelled' ? 0.5 : 1 }}>
                            <td style={td}>{r.riders?.full_name ?? '—'}</td>
                            <td style={{ ...td, direction: 'ltr', textAlign: 'right' }}>{r.riders?.phone ?? ''}{r.riders?.parent_phone ? ` / ${r.riders.parent_phone}` : ''}</td>
                            <td style={td}>{r.parent_name}<div style={muted}>{r.submitted_by_parent ? 'מהטלפון של ההורה' : 'מהטלפון של הרוכב'}</div></td>
                            <td style={td}>{r.show_name ? `✓ ${publicName(r.riders?.full_name)}` : 'מוסתר'}</td>
                            <td style={{ ...td, maxWidth: 200 }}>{r.health_notes ?? ''}</td>
                            <td style={td}>
                              <select style={{ ...input, width: 'auto', padding: '4px 8px' }} value={r.status}
                                onChange={(e) => setStatus(r, e.target.value as RegistrationStatus)}>
                                {(Object.keys(REGISTRATION_STATUS_LABEL) as RegistrationStatus[]).map((s) => (
                                  <option key={s} value={s}>{REGISTRATION_STATUS_LABEL[s]}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '6px 8px', fontWeight: 600 }
const td: React.CSSProperties = { padding: '8px', verticalAlign: 'top' }

function Check({ on, onChange, text }: { on: boolean; onChange: (v: boolean) => void; text: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: '#b5e853' }} />
      {text}
    </label>
  )
}
