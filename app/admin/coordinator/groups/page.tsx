'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'

const BRANCHES = ['משגב', 'מצובה', 'ביריה', 'אמירים']
const LEVELS   = ['מתחילים', 'כללי', 'מתקדם']
const DAYS_HE  = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

const BRANCH_COLOR: Record<string, string> = {
  'משגב':  '#b5e853',
  'מצובה': '#81d4fa',
  'ביריה': '#ff8f6b',
  'אמירים': '#c084fc',
}
const LEVEL_COLOR: Record<string, string> = {
  'מתחילים': '#4cdb7a',
  'כללי':    '#b5e853',
  'מתקדם':   '#ff8f6b',
}

type Group = {
  id: string
  name: string
  branch: string
  level: string | null
  days: string | null
  type: 'adults' | 'kids' | null
  start_time: string | null
  end_time: string | null
  instructor_id: string | null
  is_active: boolean
  max_riders: number
}
type Instructor = { id: string; name: string; branch: string | null }

const BLANK: Omit<Group, 'id'> = {
  name: '', branch: '', level: 'כללי', days: null, type: 'adults',
  start_time: null, end_time: null, instructor_id: null, is_active: true, max_riders: 15,
}

const inp: React.CSSProperties = {
  background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 8,
  color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 14,
  padding: '10px 12px', outline: 'none', width: '100%', boxSizing: 'border-box',
}

function fmt(t: string | null) {
  return t ? t.slice(0, 5) : ''
}

export default function GroupsPage() {
  const user = useCoordinator()

  const [groups, setGroups]           = useState<Group[]>([])
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [counts, setCounts]           = useState<Record<string, number>>({})
  const [loading, setLoading]         = useState(true)
  const [branchFilter, setBranchFilter] = useState('הכל')

  const [modal, setModal]   = useState(false)
  const [editing, setEditing] = useState<Group | null>(null)
  const [form, setForm]     = useState<Omit<Group, 'id'>>(BLANK)
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

  async function load() {
    setLoading(true)
    const [{ data: grps }, { data: insts }, { data: riders }] = await Promise.all([
      supabase.from('groups').select('*').order('branch').order('name'),
      supabase.from('admin_roles').select('id, name, branch').eq('role', 'instructor').order('name'),
      supabase.from('riders').select('group_name, branch').eq('is_regular', true),
    ])
    setGroups(grps ?? [])
    setInstructors(insts ?? [])
    const c: Record<string, number> = {}
    for (const r of riders ?? []) {
      const k = `${r.group_name}||${r.branch}`
      c[k] = (c[k] ?? 0) + 1
    }
    setCounts(c)
    setLoading(false)
  }

  function openAdd() {
    setForm(BLANK)
    setEditing(null)
    setFormErr('')
    setModal(true)
  }

  function openEdit(g: Group) {
    setForm({ name: g.name, branch: g.branch, level: g.level, days: g.days, type: g.type,
              start_time: g.start_time, end_time: g.end_time, instructor_id: g.instructor_id,
              is_active: g.is_active, max_riders: g.max_riders })
    setEditing(g)
    setFormErr('')
    setModal(true)
  }

  async function save() {
    if (!form.name.trim() || !form.branch) { setFormErr('שם וסניף הם שדות חובה'); return }
    setSaving(true)
    setFormErr('')
    const payload = { ...form, name: form.name.trim() }
    const { error } = editing
      ? await supabase.from('groups').update(payload).eq('id', editing.id)
      : await supabase.from('groups').insert(payload)
    if (error) { setFormErr(error.message); setSaving(false); return }
    setSaving(false)
    setModal(false)
    load()
  }

  async function toggleActive(g: Group) {
    await supabase.from('groups').update({ is_active: !g.is_active }).eq('id', g.id)
    setGroups(prev => prev.map(x => x.id === g.id ? { ...x, is_active: !x.is_active } : x))
  }

  const instName = (id: string | null) => instructors.find(i => i.id === id)?.name ?? '—'

  const displayed = groups
    .filter(g => branchFilter === 'הכל' || g.branch === branchFilter)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'adults' ? -1 : 1
      return (a.branch ?? '').localeCompare(b.branch ?? '', 'he')
    })

  if (!user) return null

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>קבוצות אימון</h2>
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>
            {groups.filter(g => g.is_active).length} קבוצות פעילות
          </p>
        </div>
        <button
          onClick={openAdd}
          style={{ background: '#b5e853', color: '#0d0f0e', border: 'none', borderRadius: 8, padding: '9px 20px', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          + הוסף קבוצה
        </button>
      </div>

      {/* ── Branch filter ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {['הכל', ...BRANCHES].map(b => {
          const active = branchFilter === b
          const color  = BRANCH_COLOR[b]
          return (
            <button
              key={b}
              onClick={() => setBranchFilter(b)}
              style={{
                padding: '6px 16px', borderRadius: 20, cursor: 'pointer',
                fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 600, fontSize: 13,
                border: `1px solid ${active ? 'transparent' : '#252b27'}`,
                background: active ? (color ?? '#b5e853') : '#141716',
                color: active ? '#0d0f0e' : '#7a8f7d',
              }}
            >
              {b}
            </button>
          )
        })}
      </div>

      {/* ── Cards grid ── */}
      {loading ? (
        <div style={{ color: '#7a8f7d', textAlign: 'center', padding: 60 }}>טוען קבוצות...</div>
      ) : displayed.length === 0 ? (
        <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: 56, textAlign: 'center', color: '#7a8f7d' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚵</div>
          <p style={{ margin: 0, fontSize: 14 }}>
            {branchFilter === 'הכל' ? 'אין קבוצות עדיין — לחץ "+ הוסף קבוצה" כדי להתחיל' : `אין קבוצות בסניף ${branchFilter}`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
          {displayed.map(g => {
            const bc         = BRANCH_COLOR[g.branch] ?? '#7a8f7d'
            const lc         = LEVEL_COLOR[g.level ?? ''] ?? '#7a8f7d'
            const riderCount = counts[`${g.name}||${g.branch}`] ?? 0
            const pct        = g.max_riders > 0 ? Math.min(100, Math.round(riderCount / g.max_riders * 100)) : 0
            const capColor   = pct >= 100 ? '#ff8080' : pct >= 80 ? '#f97316' : '#b5e853'

            return (
              <div
                key={g.id}
                style={{
                  background: '#141716',
                  border: `1px solid ${g.is_active ? '#252b27' : '#1a1e1c'}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                  opacity: g.is_active ? 1 : 0.55,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Card header */}
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #252b27' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.3 }}>{g.name}</span>
                    <button
                      onClick={() => toggleActive(g)}
                      style={{
                        background: g.is_active ? '#4cdb7a22' : '#252b27',
                        color: g.is_active ? '#4cdb7a' : '#7a8f7d',
                        border: `1px solid ${g.is_active ? '#4cdb7a44' : '#252b27'}`,
                        borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'Heebo, Arial, sans-serif', whiteSpace: 'nowrap', flexShrink: 0,
                      }}
                    >
                      {g.is_active ? 'פעיל' : 'לא פעיל'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <span style={{ background: bc + '22', color: bc, border: `1px solid ${bc}44`, borderRadius: 12, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>
                      {g.branch}
                    </span>
                    {g.level && (
                      <span style={{ background: lc + '22', color: lc, borderRadius: 12, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>
                        {g.level}
                      </span>
                    )}
                    <span style={{
                      background: g.type === 'adults' ? '#1a2637' : '#1f1a2e',
                      color:      g.type === 'adults' ? '#81d4fa' : '#c084fc',
                      borderRadius: 12, padding: '2px 9px', fontSize: 11,
                    }}>
                      {g.type === 'adults' ? 'מבוגרים' : 'ילדים'}
                    </span>
                  </div>
                </div>

                {/* Card body */}
                <div style={{ padding: '12px 16px', flex: 1 }}>
                  {(g.days || g.start_time) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 15 }}>📅</span>
                      <span style={{ fontSize: 13, color: '#e8efe9' }}>
                        {[g.days, g.start_time ? `${fmt(g.start_time)}–${fmt(g.end_time)}` : null].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 15 }}>👤</span>
                    <span style={{ fontSize: 13, color: '#7a8f7d' }}>{instName(g.instructor_id)}</span>
                  </div>

                  {/* Capacity */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 11, color: '#7a8f7d' }}>תלמידים</span>
                      <span style={{ fontSize: 11, color: pct >= 100 ? '#ff8080' : '#7a8f7d' }}>
                        {riderCount} / {g.max_riders}
                      </span>
                    </div>
                    <div style={{ background: '#252b27', borderRadius: 4, height: 5 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: capColor, borderRadius: 4, transition: 'width .4s' }} />
                    </div>
                  </div>
                </div>

                {/* Edit button */}
                <div style={{ padding: '10px 16px', borderTop: '1px solid #1a1e1c' }}>
                  <button
                    onClick={() => openEdit(g)}
                    style={{ width: '100%', background: 'transparent', border: '1px solid #252b27', color: '#7a8f7d', borderRadius: 8, padding: '7px 0', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 12, cursor: 'pointer' }}
                  >
                    ✏️ עריכה
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal ── */}
      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, background: '#000000aa', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false) }}
        >
          <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', direction: 'rtl' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 800, color: '#b5e853' }}>
              {editing ? '✏️ עריכת קבוצה' : '+ קבוצה חדשה'}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Name — full width */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, color: '#7a8f7d', display: 'block', marginBottom: 4 }}>שם הקבוצה *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="למשל: גרביטי מתחילים"
                  style={inp}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#7a8f7d', display: 'block', marginBottom: 4 }}>סניף *</label>
                <select value={form.branch} onChange={e => setForm(p => ({ ...p, branch: e.target.value }))} style={inp}>
                  <option value="">בחר סניף...</option>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#7a8f7d', display: 'block', marginBottom: 4 }}>סוג</label>
                <select value={form.type ?? 'adults'} onChange={e => setForm(p => ({ ...p, type: e.target.value as 'adults' | 'kids' }))} style={inp}>
                  <option value="adults">מבוגרים</option>
                  <option value="kids">ילדים</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#7a8f7d', display: 'block', marginBottom: 4 }}>רמה</label>
                <select value={form.level ?? ''} onChange={e => setForm(p => ({ ...p, level: e.target.value || null }))} style={inp}>
                  <option value="">ללא</option>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#7a8f7d', display: 'block', marginBottom: 4 }}>יום אימון</label>
                <select value={form.days ?? ''} onChange={e => setForm(p => ({ ...p, days: e.target.value || null }))} style={inp}>
                  <option value="">בחר יום...</option>
                  {DAYS_HE.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#7a8f7d', display: 'block', marginBottom: 4 }}>שעת התחלה</label>
                <input type="time" value={form.start_time ?? ''} onChange={e => setForm(p => ({ ...p, start_time: e.target.value || null }))} style={inp} />
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#7a8f7d', display: 'block', marginBottom: 4 }}>שעת סיום</label>
                <input type="time" value={form.end_time ?? ''} onChange={e => setForm(p => ({ ...p, end_time: e.target.value || null }))} style={inp} />
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#7a8f7d', display: 'block', marginBottom: 4 }}>מדריך</label>
                <select value={form.instructor_id ?? ''} onChange={e => setForm(p => ({ ...p, instructor_id: e.target.value || null }))} style={inp}>
                  <option value="">ללא מדריך</option>
                  {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#7a8f7d', display: 'block', marginBottom: 4 }}>מקסימום תלמידים</label>
                <input
                  type="number" min={1} max={60}
                  value={form.max_riders}
                  onChange={e => setForm(p => ({ ...p, max_riders: parseInt(e.target.value) || 15 }))}
                  style={inp}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', paddingTop: 18 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#e8efe9' }}>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                    style={{ accentColor: '#b5e853', width: 16, height: 16 }}
                  />
                  קבוצה פעילה
                </label>
              </div>
            </div>

            {formErr && (
              <p style={{ color: '#ff8080', fontSize: 13, margin: '14px 0 0' }}>{formErr}</p>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
              <button
                onClick={() => setModal(false)}
                style={{ background: 'transparent', border: '1px solid #252b27', color: '#7a8f7d', borderRadius: 8, padding: '10px 20px', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 14, cursor: 'pointer' }}
              >
                ביטול
              </button>
              <button
                onClick={save}
                disabled={saving}
                style={{ background: saving ? '#3a4f3a' : '#b5e853', color: saving ? '#7a8f7d' : '#0d0f0e', border: 'none', borderRadius: 8, padding: '10px 24px', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer' }}
              >
                {saving ? 'שומר...' : editing ? 'שמור שינויים' : 'צור קבוצה'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
