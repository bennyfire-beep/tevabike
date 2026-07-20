'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// טופס חניך — יצירה ועריכה. משמש גם רכזות (עמוד תלמידים) וגם מדריכים (מסך נוכחות).
// שדות חובה: שם פרטי ומשפחה של החניך, שם פרטי ומשפחה של ההורה, טלפון הורה.

export type RiderRecord = {
  id: string
  full_name: string
  parent_name?: string | null
  phone?: string | null
  parent_phone?: string | null
  email?: string | null
  age?: number | null
  bike_type?: string | null
  notes?: string | null
  group_id?: string | null
  group_name?: string | null
  branch?: string | null
  is_regular?: boolean | null
}

type GroupOpt = { id: string; name: string; branch: string | null }

const BG = '#0d0f0e', PANEL = '#141716', BORDER = '#252b27'
const TEXT = '#e8efe9', MUTED = '#7a8f7d', LIME = '#b5e853'

const BIKE_TYPES = ['הארדטייל', 'פול סאספנשן', 'אנדורו', 'דירט / פאמפטרק', 'אופניים חשמליים', 'אחר']

const splitName = (full?: string | null) => {
  const parts = (full ?? '').trim().split(/\s+/)
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') }
}

export default function RiderForm({
  rider, groups, defaultGroupId, onClose, onSaved, allowDelete = true,
}: {
  rider?: RiderRecord | null
  groups: GroupOpt[]
  defaultGroupId?: string | null
  onClose: () => void
  onSaved: (savedName: string) => void
  allowDelete?: boolean
}) {
  const isEdit = !!rider?.id

  const rn = splitName(rider?.full_name)
  const pn = splitName(rider?.parent_name)

  const [f, setF] = useState({
    riderFirst: rn.first, riderLast: rn.last,
    parentFirst: pn.first, parentLast: pn.last,
    parentPhone: rider?.parent_phone ?? '',
    riderPhone: rider?.phone ?? '',
    email: rider?.email ?? '',
    age: rider?.age ? String(rider.age) : '',
    bikeType: rider?.bike_type ?? '',
    groupId: rider?.group_id ?? defaultGroupId ?? '',
    notes: rider?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))

  const riderName  = `${f.riderFirst.trim()} ${f.riderLast.trim()}`.trim()
  const parentName = `${f.parentFirst.trim()} ${f.parentLast.trim()}`.trim()

  async function save() {
    setErr('')
    if (!f.riderFirst.trim() || !f.riderLast.trim()) { setErr('שם פרטי ומשפחה של החניך הם שדות חובה'); return }
    if (!f.parentFirst.trim() || !f.parentLast.trim()) { setErr('שם פרטי ומשפחה של ההורה הם שדות חובה'); return }
    if (!f.parentPhone.trim()) { setErr('טלפון הורה הוא שדה חובה'); return }

    setSaving(true)
    const g = groups.find(x => x.id === f.groupId)
    const payload: Record<string, unknown> = {
      full_name: riderName,
      parent_name: parentName,
      parent_phone: f.parentPhone.trim(),
      phone: f.riderPhone.trim() || null,
      email: f.email.trim() || null,
      age: f.age ? parseInt(f.age) : null,
      bike_type: f.bikeType.trim() || null,
      notes: f.notes.trim() || null,
      group_id: f.groupId || null,
      group_name: g?.name ?? null,
      branch: g?.branch ?? null,
    }
    if (!isEdit) { payload.is_regular = !!f.groupId; payload.active = true }

    const { error } = isEdit
      ? await supabase.from('riders').update(payload).eq('id', rider!.id)
      : await supabase.from('riders').insert(payload)

    setSaving(false)
    if (error) { setErr(error.message); return }
    onSaved(riderName)
  }

  async function remove() {
    setSaving(true)
    const { error } = await supabase.from('riders').update({ active: false, is_regular: false }).eq('id', rider!.id)
    setSaving(false)
    if (error) { setErr(error.message); return }
    onSaved(riderName)
  }

  const waParent = () => {
    const clean = f.parentPhone.replace(/\D/g, '').replace(/^0/, '972')
    const msg = `היי ${f.parentFirst || ''}, זה בני מטבע בייק 🚵\nכדי להשלים את ההרשמה של ${f.riderFirst || 'הילד'} אפשר למלא כאן:\nhttps://www.tevabike.com/#register`
    return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`
  }

  const input: React.CSSProperties = {
    width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT,
    fontFamily: 'Heebo, Arial, sans-serif', fontSize: 15, padding: '10px 12px', outline: 'none', boxSizing: 'border-box',
  }
  const label: React.CSSProperties = { display: 'block', color: MUTED, fontSize: 12, marginBottom: 5, fontWeight: 600 }
  const row: React.CSSProperties = { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 14 }

  return (
    <div
      role="dialog" aria-modal="true" aria-label={isEdit ? 'עריכת חניך' : 'חניך חדש'}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,.72)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: 20, overflowY: 'auto', direction: 'rtl',
      }}
    >
      <div style={{
        background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24,
        width: '100%', maxWidth: 620, marginTop: 24, marginBottom: 40,
        fontFamily: 'Heebo, Arial, sans-serif', color: TEXT,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>{isEdit ? 'עריכת חניך' : 'חניך חדש'}</h3>
          <button onClick={onClose} aria-label="סגירה"
            style={{ marginRight: 'auto', background: 'transparent', border: 'none', color: MUTED, fontSize: 26, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <p style={{ color: MUTED, fontSize: 12.5, margin: '0 0 16px' }}>שדות עם ★ הם חובה</p>

        <div style={row}>
          <div><label style={label}>שם פרטי — חניך ★</label><input style={input} value={f.riderFirst} onChange={e => set('riderFirst', e.target.value)} /></div>
          <div><label style={label}>שם משפחה — חניך ★</label><input style={input} value={f.riderLast} onChange={e => set('riderLast', e.target.value)} /></div>
        </div>

        <div style={row}>
          <div><label style={label}>שם פרטי — הורה ★</label><input style={input} value={f.parentFirst} onChange={e => set('parentFirst', e.target.value)} /></div>
          <div><label style={label}>שם משפחה — הורה ★</label><input style={input} value={f.parentLast} onChange={e => set('parentLast', e.target.value)} /></div>
        </div>

        <div style={row}>
          <div><label style={label}>טלפון הורה ★</label><input style={input} type="tel" inputMode="tel" value={f.parentPhone} onChange={e => set('parentPhone', e.target.value)} /></div>
          <div><label style={label}>טלפון החניך</label><input style={input} type="tel" inputMode="tel" placeholder="לא חובה" value={f.riderPhone} onChange={e => set('riderPhone', e.target.value)} /></div>
        </div>

        <div style={row}>
          <div><label style={label}>אימייל</label><input style={input} type="email" placeholder="לא חובה" value={f.email} onChange={e => set('email', e.target.value)} /></div>
          <div><label style={label}>גיל</label><input style={input} type="number" inputMode="numeric" placeholder="לא חובה" value={f.age} onChange={e => set('age', e.target.value)} /></div>
        </div>

        <div style={row}>
          <div>
            <label style={label}>סוג אופניים</label>
            <input style={input} list="bike-types" placeholder="לא חובה" value={f.bikeType} onChange={e => set('bikeType', e.target.value)} />
            <datalist id="bike-types">{BIKE_TYPES.map(b => <option key={b} value={b} />)}</datalist>
          </div>
          <div>
            <label style={label}>קבוצה</label>
            <select aria-label="קבוצה" style={input} value={f.groupId} onChange={e => set('groupId', e.target.value)}>
              <option value="">ללא שיוך</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}{g.branch ? ` · ${g.branch}` : ''}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={label}>הערות</label>
          <input style={input} placeholder="מגבלה רפואית, רמה, כל דבר שחשוב לדעת" value={f.notes} onChange={e => set('notes', e.target.value)} />
        </div>

        {f.parentPhone.trim() && (
          <a href={waParent()} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', textAlign: 'center', background: '#1a2114', color: LIME, border: '1px solid #2f4020',
                     borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, textDecoration: 'none', marginBottom: 16 }}>
            שליחת קישור הרשמה להורה בוואטסאפ
          </a>
        )}

        {err && (
          <div style={{ background: '#3a1a1a', border: '1px solid #7f2d2d', color: '#fca5a5',
                        borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13.5 }}>{err}</div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={save} disabled={saving}
            style={{ flex: 1, minWidth: 150, background: saving ? BORDER : LIME, color: saving ? MUTED : BG,
                     border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 800,
                     fontFamily: 'Heebo, Arial, sans-serif', cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'שומר...' : isEdit ? 'שמירת שינויים' : 'הוספת חניך'}
          </button>
          <button onClick={onClose} disabled={saving}
            style={{ background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 10,
                     padding: '13px 20px', fontSize: 15, fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer' }}>
            ביטול
          </button>
        </div>

        {isEdit && allowDelete && (
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
            {confirmDel ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: '#fca5a5', fontSize: 13.5 }}>להוציא את {riderName} מהמערכת?</span>
                <button onClick={remove} disabled={saving}
                  style={{ background: '#7f2d2d', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px',
                           fontSize: 13, fontWeight: 700, fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer' }}>כן, הוצא</button>
                <button onClick={() => setConfirmDel(false)}
                  style={{ background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8,
                           padding: '8px 16px', fontSize: 13, fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer' }}>ביטול</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(true)}
                style={{ background: 'transparent', color: '#f87171', border: 'none', fontSize: 13,
                         fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer', padding: 0 }}>
                הוצאת החניך מהמערכת
              </button>
            )}
            <p style={{ color: MUTED, fontSize: 11.5, margin: '8px 0 0' }}>
              ההוצאה אינה מוחקת נתונים — היסטוריית הנוכחות נשמרת.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
