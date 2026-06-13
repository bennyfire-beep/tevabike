'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'

const BRANCH_COLOR: Record<string, string> = {
  'משגב':  '#b5e853',
  'מצובה': '#81d4fa',
  'ביריה': '#ff8f6b',
  'אמירים': '#c084fc',
}

type Rider = {
  id: string
  full_name: string
  phone: string | null
  parent_phone: string | null
  group_name: string | null
  branch: string | null
  is_regular: boolean
  group_id: string | null
}

type Group = {
  id: string
  name: string
  branch: string
  days: string | null
  type: 'adults' | 'kids' | null
  level: string | null
}

const inp: React.CSSProperties = {
  background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 8,
  color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 14,
  padding: '10px 12px', outline: 'none', boxSizing: 'border-box',
}

const BRANCH_COLOR_FALLBACK = '#7a8f7d'
const bc = (b: string | null) => BRANCH_COLOR[b ?? ''] ?? BRANCH_COLOR_FALLBACK

export default function StudentsPage() {
  const user = useCoordinator()

  const [riders, setRiders]           = useState<Rider[]>([])
  const [groups, setGroups]           = useState<Group[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [branchFilter, setBranchFilter] = useState('הכל')
  const [groupFilter, setGroupFilter] = useState('הכל')

  // Modal state
  const [selected, setSelected]       = useState<Rider | null>(null)
  const [pickedGroupId, setPickedGroupId] = useState<string>('')
  const [saving, setSaving]           = useState(false)
  const [saveErr, setSaveErr]         = useState('')

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('riders').select('*').order('full_name'),
      supabase.from('groups').select('id, name, branch, days, type, level').eq('is_active', true).order('branch').order('name'),
    ]).then(([{ data: r }, { data: g }]) => {
      setRiders(r ?? [])
      setGroups(g ?? [])
      setLoading(false)
    })
  }, [user])

  function openModal(rider: Rider) {
    setSelected(rider)
    setPickedGroupId(rider.group_id ?? '')
    setSaveErr('')
  }

  function closeModal() {
    setSelected(null)
    setSaveErr('')
  }

  async function saveAssignment() {
    if (!selected) return
    setSaving(true)
    setSaveErr('')

    const group = groups.find(g => g.id === pickedGroupId) ?? null

    const patch: Record<string, string | null> = {
      group_id:   group?.id   ?? null,
      group_name: group?.name ?? null,
      branch:     group?.branch ?? null,
    }

    const { error } = await supabase.from('riders').update(patch).eq('id', selected.id)

    if (error) {
      // group_id column may not exist yet — fall back to name+branch only
      if (error.message.includes('group_id')) {
        const { error: e2 } = await supabase
          .from('riders')
          .update({ group_name: patch.group_name, branch: patch.branch })
          .eq('id', selected.id)
        if (e2) { setSaveErr(e2.message); setSaving(false); return }
      } else {
        setSaveErr(error.message)
        setSaving(false)
        return
      }
    }

    // Update local state so the table reflects the change immediately
    setRiders(prev => prev.map(r =>
      r.id === selected.id
        ? { ...r, group_id: patch.group_id, group_name: patch.group_name, branch: patch.branch }
        : r
    ))
    setSaving(false)
    closeModal()
  }

  if (!user) return null

  const branches = ['הכל', ...Array.from(new Set(riders.map(r => r.branch).filter(Boolean) as string[])).sort()]
  const groupNames = ['הכל', ...Array.from(new Set(riders.map(r => r.group_name).filter(Boolean) as string[])).sort()]

  const filtered = riders.filter(r => {
    if (branchFilter !== 'הכל' && r.branch !== branchFilter) return false
    if (groupFilter  !== 'הכל' && r.group_name !== groupFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!r.full_name.toLowerCase().includes(q) && !(r.phone ?? '').includes(q)) return false
    }
    return true
  })

  const pickedGroup = groups.find(g => g.id === pickedGroupId) ?? null

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>תלמידים</h2>
        <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>{riders.length} תלמידים רשומים · לחץ על שורה לשיוך קבוצה</p>
      </div>

      {/* ── Filters ── */}
      <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: '14px 16px', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 חיפוש לפי שם או טלפון..."
          style={{ ...inp, flex: '1 1 200px' }}
        />
        <select value={branchFilter} onChange={e => { setBranchFilter(e.target.value); setGroupFilter('הכל') }} style={{ ...inp, flex: '0 0 130px' }}>
          {branches.map(b => <option key={b}>{b}</option>)}
        </select>
        <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} style={{ ...inp, flex: '0 0 180px' }}>
          {groupNames.map(g => <option key={g}>{g}</option>)}
        </select>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div style={{ color: '#7a8f7d', textAlign: 'center', padding: 60 }}>טוען תלמידים...</div>
      ) : (
        <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 160px 110px 70px', padding: '10px 20px', borderBottom: '1px solid #252b27', fontSize: 11, color: '#7a8f7d', fontWeight: 700 }}>
            <span>שם</span>
            <span>טלפון</span>
            <span>קבוצה</span>
            <span>סניף</span>
            <span>סטטוס</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#7a8f7d', fontSize: 14 }}>לא נמצאו תלמידים</div>
          ) : (
            filtered.map((r, i) => (
              <div
                key={r.id}
                onClick={() => openModal(r)}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 130px 160px 110px 70px',
                  padding: '13px 20px',
                  borderBottom: i < filtered.length - 1 ? '1px solid #1a1e1c' : 'none',
                  alignItems: 'center', fontSize: 13,
                  cursor: 'pointer',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1a1e1c')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.full_name}</div>
                  {r.parent_phone && (
                    <div style={{ color: '#7a8f7d', fontSize: 11, marginTop: 2 }}>הורה: {r.parent_phone}</div>
                  )}
                </div>
                <span style={{ color: '#7a8f7d' }}>{r.phone ?? '—'}</span>
                <span style={{ color: r.group_name ? '#e8efe9' : '#3a4f3a' }}>{r.group_name ?? 'לא משויך'}</span>
                <span>
                  {r.branch && (
                    <span style={{ background: bc(r.branch) + '22', color: bc(r.branch), borderRadius: 12, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>
                      {r.branch}
                    </span>
                  )}
                </span>
                <span>
                  <span style={{ background: r.is_regular ? '#4cdb7a22' : '#252b27', color: r.is_regular ? '#4cdb7a' : '#7a8f7d', borderRadius: 12, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>
                    {r.is_regular ? 'קבוע' : 'מזדמן'}
                  </span>
                </span>
              </div>
            ))
          )}

          {filtered.length > 0 && (
            <div style={{ padding: '9px 20px', borderTop: '1px solid #252b27', background: '#1a1e1c', fontSize: 12, color: '#7a8f7d' }}>
              מציג {filtered.length} מתוך {riders.length} תלמידים
            </div>
          )}
        </div>
      )}

      {/* ── Assignment modal ── */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: '#000000aa', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460, direction: 'rtl' }}>

            {/* Student details */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#252b27', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                🚵
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17 }}>{selected.full_name}</div>
                <div style={{ color: '#7a8f7d', fontSize: 13, marginTop: 2 }}>
                  {[selected.phone, selected.parent_phone ? `הורה: ${selected.parent_phone}` : null].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>

            {/* Current group */}
            <div style={{ background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: '#7a8f7d', marginBottom: 6 }}>קבוצה נוכחית</div>
              {selected.group_name ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{selected.group_name}</span>
                  {selected.branch && (
                    <span style={{ background: bc(selected.branch) + '22', color: bc(selected.branch), borderRadius: 12, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>
                      {selected.branch}
                    </span>
                  )}
                </div>
              ) : (
                <span style={{ color: '#3a4f3a', fontSize: 14 }}>לא משויך לקבוצה</span>
              )}
            </div>

            {/* Group picker */}
            <div style={{ marginBottom: 6 }}>
              <label style={{ fontSize: 11, color: '#7a8f7d', display: 'block', marginBottom: 8 }}>שיוך לקבוצה</label>
              <select
                value={pickedGroupId}
                onChange={e => setPickedGroupId(e.target.value)}
                style={{ ...inp, width: '100%' }}
              >
                <option value="">ללא קבוצה</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name} — {g.branch}{g.days ? ` · ${g.days}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected group preview */}
            {pickedGroup && (
              <div style={{ background: '#0d0f0e', border: `1px solid ${bc(pickedGroup.branch)}44`, borderRadius: 10, padding: '10px 14px', marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ background: bc(pickedGroup.branch) + '22', color: bc(pickedGroup.branch), borderRadius: 12, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>{pickedGroup.branch}</span>
                {pickedGroup.level && <span style={{ color: '#7a8f7d', fontSize: 12 }}>{pickedGroup.level}</span>}
                {pickedGroup.days  && <span style={{ color: '#7a8f7d', fontSize: 12 }}>📅 {pickedGroup.days}</span>}
                <span style={{ color: pickedGroup.type === 'adults' ? '#81d4fa' : '#c084fc', fontSize: 12 }}>
                  {pickedGroup.type === 'adults' ? 'מבוגרים' : 'ילדים'}
                </span>
              </div>
            )}

            {saveErr && <p style={{ color: '#ff8080', fontSize: 12, margin: '12px 0 0' }}>{saveErr}</p>}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
              <button
                onClick={closeModal}
                style={{ background: 'transparent', border: '1px solid #252b27', color: '#7a8f7d', borderRadius: 8, padding: '10px 20px', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 14, cursor: 'pointer' }}
              >
                ביטול
              </button>
              <button
                onClick={saveAssignment}
                disabled={saving || pickedGroupId === (selected.group_id ?? '')}
                style={{
                  background: saving || pickedGroupId === (selected.group_id ?? '') ? '#3a4f3a' : '#b5e853',
                  color:      saving || pickedGroupId === (selected.group_id ?? '') ? '#7a8f7d' : '#0d0f0e',
                  border: 'none', borderRadius: 8, padding: '10px 24px',
                  fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 14,
                  cursor: saving || pickedGroupId === (selected.group_id ?? '') ? 'default' : 'pointer',
                }}
              >
                {saving ? 'שומר...' : 'שמור שיוך'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
