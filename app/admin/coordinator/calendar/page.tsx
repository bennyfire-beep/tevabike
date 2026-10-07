'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'
import {
  CALENDAR_SELECT, CALENDAR_TYPES, CALENDAR_TYPE_META, formatEventRange,
  type CalendarEvent, type CalendarEventType,
} from '@/lib/calendar-events'

// ============================================================
// לוח שנה — הוספה, עריכה ומחיקה של אירועים בעמוד /calendar
// נתיב: app/admin/coordinator/calendar/page.tsx
// טבלה: site_calendar_events · תצוגה באתר: components/YearCalendar.tsx
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

type Draft = { start_date: string; end_date: string; type: CalendarEventType; title: string; note: string }
const EMPTY: Draft = { start_date: '', end_date: '', type: 'closed', title: '', note: '' }

const toDraft = (e: CalendarEvent): Draft => ({
  start_date: e.start_date, end_date: e.end_date ?? '', type: e.type, title: e.title, note: e.note ?? '',
})

export default function CalendarAdminPage() {
  const user = useCoordinator()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showPast, setShowPast] = useState(false)

  const fetchEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('site_calendar_events')
      .select(CALENDAR_SELECT)
      .order('start_date', { ascending: true })
    return { rows: (data ?? []) as CalendarEvent[], error: error?.message ?? null }
  }, [])

  const load = useCallback(async () => {
    const { rows, error } = await fetchEvents()
    if (error) setError(error)
    setEvents(rows)
  }, [fetchEvents])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchEvents().then(({ rows, error }) => {
      if (cancelled) return
      if (error) setError(error)
      setEvents(rows)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [user, fetchEvents])

  function startEdit(e: CalendarEvent) {
    setEditingId(e.id)
    setDraft(toDraft(e))
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
    if (!draft.start_date) { setError('צריך לבחור תאריך התחלה'); return }
    if (!title) { setError('צריך לכתוב שם לאירוע'); return }
    // An end date equal to the start is just a one-day event.
    const end = draft.end_date && draft.end_date !== draft.start_date ? draft.end_date : null
    if (end && end < draft.start_date) { setError('תאריך הסיום לפני תאריך ההתחלה'); return }

    const row = { start_date: draft.start_date, end_date: end, type: draft.type, title, note: draft.note.trim() || null }
    setSaving(true)
    const { error } = editingId
      ? await supabase.from('site_calendar_events').update(row).eq('id', editingId)
      : await supabase.from('site_calendar_events').insert(row)
    setSaving(false)
    if (error) { setError(error.message); return }
    cancelEdit()
    await load()
  }

  async function remove(e: CalendarEvent) {
    if (!confirm(`למחוק את "${e.title}" (${formatEventRange(e)})?`)) return
    const { error } = await supabase.from('site_calendar_events').delete().eq('id', e.id)
    if (error) { setError(error.message); return }
    if (editingId === e.id) cancelEdit()
    await load()
  }

  if (!user) return null

  const todayIso = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, local time
  const isPast = (e: CalendarEvent) => (e.end_date ?? e.start_date) < todayIso
  const pastCount = events.filter(isPast).length
  const shown = showPast ? events : events.filter((e) => !isPast(e))

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>לוח שנה</h2>
          <p style={{ ...muted, fontSize: 13, margin: 0 }}>
            {loading ? 'טוען...' : `${events.length} אירועים בלוח`}
          </p>
        </div>
        <div style={{ marginRight: 'auto' }}>
          <a href="/calendar" target="_blank" rel="noopener noreferrer" style={{ ...ghostBtn, textDecoration: 'none' }}>פתיחת הלוח באתר</a>
        </div>
      </div>

      {/* ── Add / edit form ── */}
      <div style={{ ...card, marginBottom: 20, borderColor: editingId ? '#b5e853' : '#252b27' }}>
        <div style={{ fontWeight: 800, marginBottom: 12 }}>{editingId ? '✏️ עריכת אירוע' : '+ הוספת אירוע'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={label}>תאריך התחלה *</label>
            <input type="date" style={input} value={draft.start_date}
              onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} />
          </div>
          <div>
            <label style={label}>תאריך סיום (לאירוע של כמה ימים)</label>
            <input type="date" style={input} value={draft.end_date} min={draft.start_date || undefined}
              onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} />
          </div>
          <div>
            <label style={label}>סוג</label>
            <select style={input} value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value as CalendarEventType })}>
              {CALENDAR_TYPES.map((t) => <option key={t} value={t}>{CALENDAR_TYPE_META[t].label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={label}>שם האירוע *</label>
          <input style={input} value={draft.title} placeholder="למשל: חופשת סוכות"
            onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={label}>הערה (לא חובה — מופיעה מתחת לשם)</label>
          <input style={input} value={draft.note} placeholder="למשל: אין פעילות. חזרה לפעילות ביום א' 4/10"
            onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btn} disabled={saving} onClick={save}>
            {saving ? 'שומר…' : editingId ? 'שמירת שינויים' : 'הוספה ללוח'}
          </button>
          {editingId && <button style={ghostBtn} onClick={cancelEdit}>ביטול</button>}
        </div>
      </div>

      {error && (
        <div style={{ ...card, background: '#3a1a1a', borderColor: '#7f2d2d', color: '#fecaca', marginBottom: 16 }}>{error}</div>
      )}

      {/* ── Event list ── */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 700 }}>{showPast ? 'כל האירועים' : 'אירועים קרובים'}</div>
        {pastCount > 0 && (
          <button style={{ ...ghostBtn, marginRight: 'auto', padding: '4px 10px', fontSize: 12 }} onClick={() => setShowPast(!showPast)}>
            {showPast ? 'הסתרת אירועים שעברו' : `הצגת ${pastCount} אירועים שעברו`}
          </button>
        )}
      </div>

      {!loading && shown.length === 0 && (
        <div style={{ ...card, ...muted, fontSize: 14, textAlign: 'center' }}>אין אירועים להצגה</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shown.map((e) => {
          const meta = CALENDAR_TYPE_META[e.type]
          return (
            <div
              key={e.id}
              style={{
                ...card, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                opacity: isPast(e) ? 0.55 : 1,
                borderColor: editingId === e.id ? '#b5e853' : '#252b27',
              }}
            >
              <span style={{ background: meta.bg, color: meta.fg, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {meta.label}
              </span>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 700 }}>{e.title}</div>
                <div style={muted}>{formatEventRange(e)}{e.note ? ` · ${e.note}` : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={ghostBtn} onClick={() => startEdit(e)}>עריכה</button>
                <button style={dangerBtn} onClick={() => remove(e)}>מחיקה</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
