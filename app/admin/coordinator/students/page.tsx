'use client'
import { useState, useEffect, useMemo } from 'react'
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
  is_active: boolean
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
  // rider_id → array of group_ids (source of truth for assignments)
  const [links, setLinks]             = useState<Record<string, string[]>>({})
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [branchFilter, setBranchFilter] = useState('הכל')
  const [groupFilter, setGroupFilter] = useState('הכל')

  // Modal state
  const [selected, setSelected]       = useState<Rider | null>(null)
  const [pickedGroupIds, setPickedGroupIds] = useState<string[]>([])
  const [saving, setSaving]           = useState(false)
  const [saveErr, setSaveErr]         = useState('')

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('riders').select('*').order('full_name'),
      supabase.from('groups').select('id, name, branch, days, type, level, is_active').order('branch').order('name'),
      supabase.from('rider_groups').select('rider_id, group_id'),
    ]).then(([{ data: r }, { data: g }, { data: rg }]) => {
      setRiders(r ?? [])
      setGroups(g ?? [])
      const map: Record<string, string[]> = {}
      for (const row of rg ?? []) {
        (map[row.rider_id] ??= []).push(row.group_id)
      }
      setLinks(map)
      setLoading(false)
    })
  }, [user])

  // Close modal on Escape
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  const groupsById   = useMemo(() => new Map(groups.map(g => [g.id, g])), [groups])
  const activeGroups = useMemo(() => groups.filter(g => g.is_active), [groups])

  // Resolve a rider's assigned groups (linked, then falling back to legacy group_id)
  function riderGroups(riderId: string): Group[] {
    const ids = links[riderId] ?? []
    return ids.map(id => groupsById.get(id)).filter((g): g is Group => !!g)
  }

  function openModal(rider: Rider) {
    setSelected(rider)
    setPickedGroupIds([...(links[rider.id] ?? [])])
    setSaveErr('')
  }

  function closeModal() {
    setSelected(null)
    setSaveErr('')
  }

  function toggleGroup(id: string) {
    setPickedGroupIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function saveAssignment() {
    if (!selected) return
    setSaving(true)
    setSaveErr('')

    const original = links[selected.id] ?? []
    const picked   = pickedGroupIds
    const toAdd    = picked.filter(id => !original.includes(id))
    const toRemove = original.filter(id => !picked.includes(id))

    if (toAdd.length) {
      const { error } = await supabase
        .from('rider_groups')
        .insert(toAdd.map(group_id => ({ rider_id: selected.id, group_id })))
      if (error) { setSaveErr(error.message); setSaving(false); return }
    }
    if (toRemove.length) {
      const { error } = await supabase
        .from('rider_groups')
        .delete()
        .eq('rider_id', selected.id)
        .in('group_id', toRemove)
      if (error) { setSaveErr(error.message); setSaving(false); return }
    }

    // Keep the legacy denormalized columns pointing at the primary (first-listed)
    // group for back-compat with pages not yet migrated to rider_groups.
    const primary = groups.find(g => picked.includes(g.id)) ?? null
    const { error: e2 } = await supabase
      .from('riders')
      .update({ group_id: primary?.id ?? null, group_name: primary?.name ?? null, branch: primary?.branch ?? null })
      .eq('id', selected.id)
    if (e2 && !e2.message.includes('group_id')) { setSaveErr(e2.message); setSaving(false); return }

    // Reflect the change locally
    setLinks(prev => ({ ...prev, [selected.id]: picked }))
    setRiders(prev => prev.map(r =>
      r.id === selected.id
        ? { ...r, group_id: primary?.id ?? null, group_name: primary?.name ?? null, branch: primary?.branch ?? null }
        : r
    ))
    setSaving(false)
    closeModal()
  }

  if (!user) return null

  const branches = ['הכל', ...Array.from(new Set(groups.map(g => g.branch).filter(Boolean))).sort()]
  const groupNames = ['הכל', ...Array.from(new Set(groups.map(g => g.name).filter(Boolean))).sort()]

  const filtered = riders.filter(r => {
    const rg = riderGroups(r.id)
    if (branchFilter !== 'הכל') {
      const inBranch = rg.length ? rg.some(g => g.branch === branchFilter) : r.branch === branchFilter
      if (!inBranch) return false
    }
    if (groupFilter !== 'הכל' && !rg.some(g => g.name === groupFilter)) return false
    if (search) {
      const q = search.toLowerCase()
      if (!r.full_name.toLowerCase().includes(q) && !(r.phone ?? '').includes(q)) return false
    }
    return true
  })

  const originalIds = selected ? (links[selected.id] ?? []) : []
  const dirty = selected != null && (
    pickedGroupIds.length !== originalIds.length ||
    pickedGroupIds.some(id => !originalIds.includes(id))
  )

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>תלמידים</h2>
        <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>{riders.length} תלמידים רשומים · לחץ על שורה לשיוך קבוצות</p>
      </div>

      {/* ── Filters ── */}
      <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: '14px 16px', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 חיפוש לפי שם או טלפון..."
          aria-label="חיפוש תלמידים"
          style={{ ...inp, flex: '1 1 200px' }}
        />
        <select aria-label="סינון לפי סניף" value={branchFilter} onChange={e => { setBranchFilter(e.target.value); setGroupFilter('הכל') }} style={{ ...inp, flex: '0 0 130px' }}>
          {branches.map(b => <option key={b}>{b}</option>)}
        </select>
        <select aria-label="סינון לפי קבוצה" value={groupFilter} onChange={e => setGroupFilter(e.target.value)} style={{ ...inp, flex: '0 0 180px' }}>
          {groupNames.map(g => <option key={g}>{g}</option>)}
        </select>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div style={{ color: '#7a8f7d', textAlign: 'center', padding: 60 }}>טוען תלמידים...</div>
      ) : (
        <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 220px 110px 70px', padding: '10px 20px', borderBottom: '1px solid #252b27', fontSize: 11, color: '#7a8f7d', fontWeight: 700 }}>
            <span>שם</span>
            <span>טלפון</span>
            <span>קבוצות</span>
            <span>סניף</span>
            <span>סטטוס</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#7a8f7d', fontSize: 14 }}>לא נמצאו תלמידים</div>
          ) : (
            filtered.map((r, i) => {
              const rg = riderGroups(r.id)
              return (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`שיוך קבוצות עבור ${r.full_name}`}
                  onClick={() => openModal(r)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(r) } }}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 130px 220px 110px 70px',
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
                  <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {rg.length === 0 ? (
                      <span style={{ color: '#3a4f3a' }}>לא משויך</span>
                    ) : (
                      rg.map(g => (
                        <span key={g.id} style={{ background: bc(g.branch) + '22', color: bc(g.branch), borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {g.name}
                        </span>
                      ))
                    )}
                  </span>
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
              )
            })
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
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-title"
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
                <div id="assign-title" style={{ fontWeight: 800, fontSize: 17 }}>{selected.full_name}</div>
                <div style={{ color: '#7a8f7d', fontSize: 13, marginTop: 2 }}>
                  {[selected.phone, selected.parent_phone ? `הורה: ${selected.parent_phone}` : null].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>

            {/* Group picker (multi-select) */}
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                <label id="groups-label" style={{ fontSize: 11, color: '#7a8f7d' }}>שיוך לקבוצות (ניתן לבחור כמה)</label>
                <span style={{ fontSize: 11, color: pickedGroupIds.length ? '#b5e853' : '#7a8f7d' }}>נבחרו {pickedGroupIds.length}</span>
              </div>

              <div
                role="group"
                aria-labelledby="groups-label"
                style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto', padding: 2 }}
              >
                {activeGroups.length === 0 ? (
                  <div style={{ color: '#7a8f7d', fontSize: 13, padding: '10px 4px' }}>אין קבוצות פעילות</div>
                ) : (
                  activeGroups.map(g => {
                    const checked = pickedGroupIds.includes(g.id)
                    return (
                      <label
                        key={g.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                          background: checked ? '#1a2e1a' : '#0d0f0e',
                          border: `1px solid ${checked ? '#b5e85355' : '#252b27'}`,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleGroup(g.id)}
                          style={{ width: 16, height: 16, accentColor: '#b5e853', cursor: 'pointer', flexShrink: 0 }}
                        />
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{g.name}</span>
                        <span style={{ background: bc(g.branch) + '22', color: bc(g.branch), borderRadius: 12, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>{g.branch}</span>
                        {g.days && <span style={{ color: '#7a8f7d', fontSize: 11 }}>· {g.days}</span>}
                        {g.type && (
                          <span style={{ marginRight: 'auto', color: g.type === 'adults' ? '#81d4fa' : '#c084fc', fontSize: 11 }}>
                            {g.type === 'adults' ? 'מבוגרים' : 'ילדים'}
                          </span>
                        )}
                      </label>
                    )
                  })
                )}
              </div>
            </div>

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
                disabled={saving || !dirty}
                style={{
                  background: saving || !dirty ? '#3a4f3a' : '#b5e853',
                  color:      saving || !dirty ? '#7a8f7d' : '#0d0f0e',
                  border: 'none', borderRadius: 8, padding: '10px 24px',
                  fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 14,
                  cursor: saving || !dirty ? 'default' : 'pointer',
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
