'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'

type Rider = { id: string; full_name: string; phone: string | null; parent_phone: string | null; group_name: string | null; branch: string | null }
type Att = { id: string; rider_id: string; date: string; status: string | null; present: boolean | null; rider_name: string | null; group_id: string | null }
type Group = { id: string; name: string; branch: string | null }

const BG = '#0d0f0e', PANEL = '#141716', BORDER = '#252b27', TEXT = '#e8efe9', MUTED = '#7a8f7d', LIME = '#b5e853'

const isPresent = (a: Att) => a.status === 'present' || a.present === true
const fmt = (d: string) => new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' })
const dayName = (d: string) => ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][new Date(d).getDay()]

const waLink = (phone: string, text: string) => {
  const clean = phone.replace(/\D/g, '').replace(/^0/, '972')
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`
}

export default function ReportsPage() {
  const user = useCoordinator()
  const [tab, setTab] = useState<'rider' | 'export'>('rider')

  const [riders, setRiders] = useState<Rider[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Rider | null>(null)
  const [riderAtt, setRiderAtt] = useState<Att[]>([])
  const [loadingAtt, setLoadingAtt] = useState(false)

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState('')

  const load = useCallback(async () => {
    const [{ data: r }, { data: g }] = await Promise.all([
      supabase.from('riders').select('id, full_name, phone, parent_phone, group_name, branch').order('full_name'),
      supabase.from('groups').select('id, name, branch'),
    ])
    setRiders((r ?? []) as Rider[])
    setGroups((g ?? []) as Group[])
  }, [])

  useEffect(() => { if (user) load() }, [user, load])

  async function openRider(r: Rider) {
    setSelected(r); setLoadingAtt(true); setRiderAtt([])
    const { data } = await supabase
      .from('attendance').select('*').eq('rider_id', r.id).order('date', { ascending: false })
    setRiderAtt((data ?? []) as Att[])
    setLoadingAtt(false)
  }

  const stats = useMemo(() => {
    const total = riderAtt.length
    const present = riderAtt.filter(isPresent).length
    const absent = total - present
    const pct = total ? Math.round((present / total) * 100) : 0
    // רצף היעדרויות אחרון
    let streak = 0
    for (const a of riderAtt) { if (isPresent(a)) break; streak++ }
    return { total, present, absent, pct, streak }
  }, [riderAtt])

  const filtered = useMemo(() => {
    const q = search.trim()
    if (!q) return [] as Rider[]
    return riders.filter(r => r.full_name?.includes(q)).slice(0, 12)
  }, [search, riders])

  async function exportMonth() {
    setExporting(true); setExportMsg('')
    const from = `${month}-01`
    const d = new Date(`${month}-01T00:00:00`)
    d.setMonth(d.getMonth() + 1)
    const to = d.toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('attendance').select('*').gte('date', from).lt('date', to).order('date')

    if (error) { setExportMsg('שגיאה: ' + error.message); setExporting(false); return }
    const rows = (data ?? []) as Att[]
    if (rows.length === 0) { setExportMsg('אין נתוני נוכחות בחודש הזה.'); setExporting(false); return }

    const riderById = new Map(riders.map(r => [r.id, r]))
    const groupById = new Map(groups.map(g => [g.id, g]))

    const header = ['תאריך', 'יום', 'קבוצה', 'סניף', 'שם החניך', 'טלפון הורה', 'נוכחות']
    const lines = rows.map(a => {
      const r = riderById.get(a.rider_id)
      const g = a.group_id ? groupById.get(a.group_id) : undefined
      return [
        fmt(a.date),
        dayName(a.date),
        g?.name ?? r?.group_name ?? '',
        g?.branch ?? r?.branch ?? '',
        r?.full_name ?? a.rider_name ?? '',
        r?.parent_phone ?? r?.phone ?? '',
        isPresent(a) ? 'נוכח' : 'נעדר',
      ]
    })

    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
    const csv = '\uFEFF' + [header, ...lines].map(l => l.map(esc).join(',')).join('\r\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `נוכחות-${month}.csv`
    a.click()
    URL.revokeObjectURL(url)

    setExportMsg(`הורדו ${rows.length} רשומות.`)
    setExporting(false)
  }

  if (!user) return null

  const card: React.CSSProperties = { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }
  const input: React.CSSProperties = {
    background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT,
    fontFamily: 'Heebo, Arial, sans-serif', fontSize: 15, padding: '11px 13px', outline: 'none', width: '100%', boxSizing: 'border-box',
  }
  const tabBtn = (active: boolean): React.CSSProperties => ({
    background: active ? PANEL : 'transparent', border: `1px solid ${active ? LIME : BORDER}`,
    color: active ? LIME : MUTED, borderRadius: 10, padding: '9px 18px', fontSize: 14, fontWeight: 700,
    fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer',
  })

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 800 }}>דוחות</h2>

      <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
        <button style={tabBtn(tab === 'rider')} onClick={() => setTab('rider')}>כרטיס חניך</button>
        <button style={tabBtn(tab === 'export')} onClick={() => setTab('export')}>ייצוא נוכחות</button>
      </div>

      {/* ─── כרטיס חניך ─── */}
      {tab === 'rider' && (
        <>
          <input
            style={{ ...input, marginBottom: 14 }}
            placeholder="חפש חניך לפי שם..."
            value={search}
            onChange={e => { setSearch(e.target.value); setSelected(null) }}
          />

          {filtered.length > 0 && !selected && (
            <div style={{ ...card, padding: 0, marginBottom: 20, overflow: 'hidden' }}>
              {filtered.map(r => (
                <button key={r.id} onClick={() => openRider(r)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'right', background: 'transparent',
                    border: 'none', borderBottom: `1px solid ${BORDER}`, color: TEXT, padding: '12px 16px',
                    fontSize: 14, cursor: 'pointer', fontFamily: 'Heebo, Arial, sans-serif',
                  }}>
                  {r.full_name}
                  <span style={{ color: MUTED, fontSize: 12 }}>
                    {r.group_name ? ` · ${r.group_name}` : ''}{r.branch ? ` · ${r.branch}` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}

          {search && filtered.length === 0 && !selected && (
            <p style={{ color: MUTED, fontSize: 14 }}>לא נמצא חניך בשם הזה.</p>
          )}

          {selected && (
            <>
              <div style={{ ...card, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{selected.full_name}</div>
                  <div style={{ color: MUTED, fontSize: 13 }}>
                    {selected.group_name || '—'}{selected.branch ? ` · ${selected.branch}` : ''}
                  </div>
                </div>
                {(selected.parent_phone || selected.phone) && (
                  <a href={waLink((selected.parent_phone || selected.phone)!, `היי, זה בני מטבע בייק לגבי ${selected.full_name}`)}
                    target="_blank" rel="noopener noreferrer"
                    style={{ marginRight: 'auto', background: '#1a2114', color: LIME, border: '1px solid #2f4020',
                             borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                    וואטסאפ להורה
                  </a>
                )}
              </div>

              {loadingAtt ? (
                <p style={{ color: MUTED }}>טוען...</p>
              ) : stats.total === 0 ? (
                <p style={{ color: MUTED }}>אין רישומי נוכחות לחניך הזה.</p>
              ) : (
                <>
                  <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginBottom: 20 }}>
                    {[
                      ['סה"כ אימונים', stats.total, TEXT],
                      ['הגיע', stats.present, LIME],
                      ['החסיר', stats.absent, stats.absent ? '#fbbf24' : MUTED],
                      ['אחוז נוכחות', `${stats.pct}%`, stats.pct >= 80 ? LIME : stats.pct >= 60 ? '#fbbf24' : '#f87171'],
                    ].map(([label, val, color]) => (
                      <div key={label as string} style={card}>
                        <div style={{ color: MUTED, fontSize: 12, marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 26, fontWeight: 800, color: color as string }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  {stats.streak >= 2 && (
                    <div style={{ background: '#3a1a1a', border: '1px solid #7f2d2d', color: '#fca5a5',
                                  borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 14 }}>
                      ⚠️ החסיר {stats.streak} אימונים ברצף — שווה ליצור קשר.
                    </div>
                  )}

                  <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, color: MUTED, fontSize: 13, fontWeight: 700 }}>
                      היסטוריית נוכחות
                    </div>
                    {riderAtt.map(a => (
                      <div key={a.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '11px 16px', borderBottom: `1px solid #1c211e`, fontSize: 14,
                      }}>
                        <span>{fmt(a.date)} <span style={{ color: MUTED, fontSize: 12 }}>· יום {dayName(a.date)}</span></span>
                        <span style={{
                          fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 10,
                          background: isPresent(a) ? '#1a2114' : '#3a1a1a',
                          color: isPresent(a) ? LIME : '#f87171',
                        }}>{isPresent(a) ? 'נוכח' : 'נעדר'}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ─── ייצוא ─── */}
      {tab === 'export' && (
        <div style={{ ...card, maxWidth: 460 }}>
          <p style={{ color: MUTED, fontSize: 14, margin: '0 0 16px', lineHeight: 1.7 }}>
            בחרו חודש והורידו קובץ נוכחות מלא. הקובץ נפתח ישירות באקסל.
          </p>
          <label style={{ display: 'block', color: MUTED, fontSize: 13, marginBottom: 6, fontWeight: 600 }}>חודש</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...input, marginBottom: 16 }} />
          <button
            onClick={exportMonth}
            disabled={exporting}
            style={{
              background: exporting ? BORDER : LIME, color: exporting ? MUTED : BG, border: 'none',
              borderRadius: 10, padding: '13px 28px', fontSize: 15, fontWeight: 800, width: '100%',
              fontFamily: 'Heebo, Arial, sans-serif', cursor: exporting ? 'default' : 'pointer',
            }}>
            {exporting ? 'מכין קובץ...' : 'הורדת קובץ נוכחות'}
          </button>
          {exportMsg && <p style={{ color: MUTED, fontSize: 13, marginTop: 12 }}>{exportMsg}</p>}
        </div>
      )}
    </div>
  )
}
