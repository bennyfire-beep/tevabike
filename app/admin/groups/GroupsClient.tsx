'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ManageShell, Btn, Note, ErrorBox, C, DAY_NAMES, inputStyle, labelStyle,
} from '@/components/ManageShell'

type Group = {
  id: string
  name: string
  branch: string
  days: string | null
  days_of_week: number[] | null
  start_time: string | null
  end_time: string | null
  type: string | null
  is_active: boolean | null
}

const BRANCHES = ['משגב', 'ביריה', 'מטה אשר', 'פרוד-אמירים', 'כללי']

// Postgres `time` comes back as HH:MM:SS; <input type="time"> wants HH:MM.
const toTimeInput = (t: string | null) => (t ? t.slice(0, 5) : '')

export default function GroupsPage() {
  const [groups,  setGroups]  = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [editing, setEditing] = useState<Group | null>(null)
  const [saving,  setSaving]  = useState(false)

  async function load() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('groups')
      .select('id, name, branch, days, days_of_week, start_time, end_time, type, is_active')
      .order('branch')
      .order('name')

    if (err) setError('טעינת הקבוצות נכשלה: ' + err.message)
    else     setGroups((data ?? []) as Group[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    if (!editing.name.trim()) { setError('שם הקבוצה חובה'); return }

    setSaving(true)
    setError('')

    const days = (editing.days_of_week ?? []).slice().sort((a, b) => a - b)
    const { error: err } = await supabase
      .from('groups')
      .update({
        name:         editing.name.trim(),
        branch:       editing.branch,
        days_of_week: days,
        // Keep the free-text column in step so the existing coordinator
        // screens, which read `days`, keep showing the right thing.
        days:         days.map(d => DAY_NAMES[d]).join(', '),
        start_time:   editing.start_time || null,
        end_time:     editing.end_time || null,
        is_active:    editing.is_active ?? true,
      })
      .eq('id', editing.id)

    setSaving(false)
    if (err) { setError('השמירה נכשלה: ' + err.message); return }
    setEditing(null)
    load()
  }

  function toggleDay(d: number) {
    if (!editing) return
    const cur = editing.days_of_week ?? []
    setEditing({
      ...editing,
      days_of_week: cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d],
    })
  }

  return (
    <ManageShell title="קבוצות">
      <ErrorBox>{error}</ErrorBox>

      {loading ? <Note>טוען קבוצות...</Note> : groups.length === 0 ? (
        <Note>אין קבוצות להצגה</Note>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {groups.map(g => (
            <div
              key={g.id}
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: 15,
                opacity: g.is_active === false ? 0.5 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
                    {g.name}
                    {g.is_active === false && (
                      <span style={{ color: C.muted, fontSize: 12, fontWeight: 400, marginRight: 8 }}>· לא פעילה</span>
                    )}
                  </div>
                  <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.7 }}>
                    <div>📍 {g.branch}</div>
                    <div>
                      📅 {(g.days_of_week?.length ? g.days_of_week.map(d => DAY_NAMES[d]).join(', ') : g.days) || '—'}
                      {g.start_time && ` · ${toTimeInput(g.start_time)}–${toTimeInput(g.end_time)}`}
                    </div>
                  </div>
                </div>
                <Btn tone="ghost" onClick={() => setEditing({ ...g, start_time: toTimeInput(g.start_time), end_time: toTimeInput(g.end_time) })}>
                  עריכה
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Edit dialog ── */}
      {editing && (
        <div
          onClick={() => !saving && setEditing(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50, padding: 0 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '16px 16px 0 0', padding: 20, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 16px' }}>עריכת קבוצה</h2>

            <div style={{ display: 'grid', gap: 13 }}>
              <div>
                <label style={labelStyle}>שם הקבוצה</label>
                <input style={inputStyle} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              </div>

              <div>
                <label style={labelStyle}>סניף</label>
                <select style={inputStyle} value={editing.branch} onChange={e => setEditing({ ...editing, branch: e.target.value })}>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>ימים</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {DAY_NAMES.map((nm, d) => {
                    const on = (editing.days_of_week ?? []).includes(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(d)}
                        style={{
                          background: on ? C.accent : 'transparent',
                          color: on ? C.bg : C.muted,
                          border: `1px solid ${on ? C.accent : C.border}`,
                          borderRadius: 20, padding: '8px 13px', fontSize: 13, fontWeight: 700,
                          fontFamily: 'inherit', cursor: 'pointer', minHeight: 40,
                        }}
                      >
                        {nm}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>שעת התחלה</label>
                  <input type="time" style={inputStyle} value={editing.start_time ?? ''} onChange={e => setEditing({ ...editing, start_time: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>שעת סיום</label>
                  <input type="time" style={inputStyle} value={editing.end_time ?? ''} onChange={e => setEditing({ ...editing, end_time: e.target.value })} />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 9, color: C.text, fontSize: 14, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editing.is_active ?? true}
                  onChange={e => setEditing({ ...editing, is_active: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: C.accent }}
                />
                קבוצה פעילה
              </label>

              <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                <Btn onClick={save} disabled={saving} style={{ flex: 1 }}>
                  {saving ? 'שומר...' : 'שמירה'}
                </Btn>
                <Btn tone="ghost" onClick={() => setEditing(null)} disabled={saving}>ביטול</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </ManageShell>
  )
}
