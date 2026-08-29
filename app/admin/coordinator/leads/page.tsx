'use client'
// leads/page.tsx — v2: notes column added (editable by coordinators)
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'
import { INTEREST_COLOR, LEAD_INTERESTS, LEAD_STATUSES, STATUS_COLOR, SOURCE_LABEL } from '@/lib/leads'
import { downloadCsv } from '@/lib/csv-export'
import WhatsappOptinBadge from '@/components/WhatsappOptinBadge'

type Lead = {
  id: string
  full_name: string
  phone: string
  interest: string
  branch: string | null
  source: string | null
  utm_campaign: string | null
  message: string | null
  status: string
  handled_by: string | null
  notes: string | null
  whatsapp_optin: boolean | null
  whatsapp_optin_at: string | null
  created_at: string
}

const GRID = '105px 1fr 120px 165px 95px 105px 1fr 110px 95px 1.3fr 150px'

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function LeadsPage() {
  const user = useCoordinator()
  const [leads, setLeads]         = useState<Lead[]>([])
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setStatusFilter]     = useState('all')
  const [interestFilter, setInterestFilter] = useState('all')
  const [waOnly, setWaOnly] = useState(false)
  const [savingId, setSavingId]   = useState<string | null>(null)
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('leads')
      .select('id, full_name, phone, interest, branch, source, utm_campaign, message, status, handled_by, notes, whatsapp_optin, whatsapp_optin_at, created_at')
      .order('created_at', { ascending: false })
    setLeads((data ?? []) as Lead[])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) return
    load()
  }, [user, load])

  async function changeStatus(lead: Lead, status: string) {
    setSavingId(lead.id)
    const handled_by = user?.name ?? lead.handled_by ?? null
    const { error } = await supabase.from('leads').update({ status, handled_by }).eq('id', lead.id)
    if (error) { alert(error.message); setSavingId(null); return }
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status, handled_by } : l))
    setSavingId(null)
  }

  async function saveNotes(lead: Lead, notes: string) {
    const trimmed = notes.trim()
    if ((lead.notes ?? '') === trimmed) return
    const { error } = await supabase.from('leads').update({ notes: trimmed || null }).eq('id', lead.id)
    if (error) { alert(error.message); return }
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, notes: trimmed || null } : l))
    setSavedNoteId(lead.id)
    setTimeout(() => setSavedNoteId(id => (id === lead.id ? null : id)), 1500)
  }

  if (!user) return null

  const filtered = leads.filter(l =>
    (statusFilter === 'all' || l.status === statusFilter) &&
    (interestFilter === 'all' || l.interest === interestFilter) &&
    (!waOnly || l.whatsapp_optin),
  )
  const newCount = leads.filter(l => l.status === 'new').length

  function exportCsv() {
    downloadCsv(
      'מתעניינים-אישרו-וואטסאפ.csv',
      ['תאריך', 'שם', 'טלפון', 'תחום עניין', 'סניף', 'מקור', 'סטטוס', 'אישר וואטסאפ בתאריך'],
      filtered
        .filter(l => l.whatsapp_optin)
        .map(l => [
          fmtDateTime(l.created_at), l.full_name, l.phone, l.interest, l.branch ?? '',
          SOURCE_LABEL[l.source ?? ''] ?? l.source ?? '', l.status,
          l.whatsapp_optin_at ? fmtDateTime(l.whatsapp_optin_at) : '',
        ]),
    )
  }

  const selStyle: React.CSSProperties = {
    background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 8, color: '#e8efe9',
    fontFamily: 'Heebo, Arial, sans-serif', fontSize: 13, padding: '7px 12px', outline: 'none',
  }

  return (
    <div style={{ padding: 24, maxWidth: 1250, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>מתעניינים</h2>
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>
            {loading ? 'טוען...' : `${filtered.length} פניות`}{newCount > 0 ? ` · ${newCount} חדשות` : ''}
          </p>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e8efe9', fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={waOnly} onChange={e => setWaOnly(e.target.checked)} style={{ width: 15, height: 15, accentColor: '#b5e853', cursor: 'pointer' }} />
            אישרו וואטסאפ בלבד
          </label>
          <button
            onClick={exportCsv}
            disabled={filtered.filter(l => l.whatsapp_optin).length === 0}
            style={{
              background: '#1a2114', color: '#b5e853', border: '1px solid #2f4020', borderRadius: 8,
              padding: '7px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'Heebo, Arial, sans-serif',
              cursor: 'pointer', opacity: filtered.filter(l => l.whatsapp_optin).length === 0 ? 0.45 : 1,
            }}
          >
            ייצוא מאושרי וואטסאפ ל-CSV ({filtered.filter(l => l.whatsapp_optin).length})
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7a8f7d', fontSize: 12 }}>
            סטטוס
            <select aria-label="סינון לפי סטטוס" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selStyle}>
              <option value="all">הכל</option>
              {LEAD_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7a8f7d', fontSize: 12 }}>
            תחום
            <select aria-label="סינון לפי תחום עניין" value={interestFilter} onChange={e => setInterestFilter(e.target.value)} style={selStyle}>
              <option value="all">הכל</option>
              {LEAD_INTERESTS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '11px 16px', borderBottom: '1px solid #252b27', fontSize: 11, color: '#7a8f7d', fontWeight: 700 }}>
          <span>תאריך</span><span>שם</span><span>טלפון</span><span>תחום עניין</span><span>סניף</span><span>מקור</span><span>הודעה</span><span>סטטוס</span><span>טופל ע"י</span><span>הערות</span><span>וואטסאפ</span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#7a8f7d' }}>טוען...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#7a8f7d' }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>📭</div>
            אין פניות להצגה
          </div>
        ) : (
          filtered.map((l, i) => {
            const ic = INTEREST_COLOR[l.interest] ?? '#7a8f7d'
            return (
              <div key={l.id} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '13px 16px', borderBottom: i < filtered.length - 1 ? '1px solid #1a1e1c' : 'none', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: '#7a8f7d', fontSize: 12 }}>{fmtDateTime(l.created_at)}</span>
                <span style={{ fontWeight: 700 }}>{l.full_name}</span>
                <a href={`tel:${l.phone}`} dir="ltr" style={{ color: '#81d4fa', textDecoration: 'none', textAlign: 'right' }}>{l.phone}</a>
                <span>
                  <span style={{ background: ic + '22', color: ic, border: `1px solid ${ic}44`, borderRadius: 10, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>{l.interest}</span>
                </span>
                <span style={{ color: l.branch ? '#cdd6cf' : '#4a544c', fontSize: 12 }}>{l.branch || '—'}</span>
                <span title={l.utm_campaign || undefined} style={{ fontSize: 11 }}>
                  {l.source && l.source !== 'website' ? (
                    <span style={{ background: '#f0b90b22', color: '#f0b90b', border: '1px solid #f0b90b44', borderRadius: 10, padding: '2px 8px', fontWeight: 700 }}>
                      {SOURCE_LABEL[l.source] ?? l.source}
                    </span>
                  ) : (
                    <span style={{ color: '#4a544c' }}>{SOURCE_LABEL['website']}</span>
                  )}
                </span>
                <span style={{ color: l.message ? '#cdd6cf' : '#4a544c' }}>{l.message || '—'}</span>
                <span>
                  <select
                    aria-label={`סטטוס עבור ${l.full_name}`}
                    value={l.status}
                    disabled={savingId === l.id}
                    onChange={e => changeStatus(l, e.target.value)}
                    style={{ background: (STATUS_COLOR[l.status] ?? '#7a8f7d') + '22', color: STATUS_COLOR[l.status] ?? '#e8efe9', border: `1px solid ${(STATUS_COLOR[l.status] ?? '#7a8f7d')}55`, borderRadius: 8, padding: '5px 8px', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer', outline: 'none' }}
                  >
                    {LEAD_STATUSES.map(s => <option key={s.value} value={s.value} style={{ background: '#141716', color: '#e8efe9' }}>{s.label}</option>)}
                  </select>
                </span>
                <span style={{ color: l.handled_by ? '#b5e853' : '#4a544c', fontSize: 12 }}>{l.handled_by || '—'}</span>
                <span style={{ position: 'relative' }}>
                  <textarea
                    aria-label={`הערות עבור ${l.full_name}`}
                    defaultValue={l.notes ?? ''}
                    placeholder="הוסף הערה..."
                    rows={2}
                    onBlur={e => saveNotes(l, e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 38,
                      background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 8,
                      color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 12,
                      padding: '6px 9px', outline: 'none', lineHeight: 1.4,
                    }}
                  />
                  {savedNoteId === l.id && (
                    <span style={{ position: 'absolute', bottom: -14, right: 2, color: '#b5e853', fontSize: 10, fontWeight: 700 }}>נשמר ✓</span>
                  )}
                </span>
                <span>
                  <WhatsappOptinBadge optedIn={l.whatsapp_optin} optedAt={l.whatsapp_optin_at} />
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
