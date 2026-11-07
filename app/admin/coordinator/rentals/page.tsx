'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'
import { downloadCsv } from '@/lib/csv-export'
import { SIZES, SIZE_LABEL, SLOT_BY_ID, STATUS_LABEL, AGREED_VALUE_DEFAULT, isSize, type BikeSize, type SlotId } from '@/lib/rental'

// ============================================================
// השכרת אופניים — צי (תמונות, מידות) והזמנות עם ההסכם החתום
// נתיב: app/admin/coordinator/rentals/page.tsx
// דף ציבורי: app/rent/page.tsx · API: app/api/rent/route.ts
// ============================================================

type BikeRow = {
  id: string
  name: string
  model: string | null
  size: BikeSize
  height_min: number | null
  height_max: number | null
  description: string | null
  photos: string[]
  frame_number: string | null
  agreed_value: number | null
  active: boolean
  sort_order: number
}

type Item = { id: string; rider_name: string; rider_height_cm: number; protection: boolean; price: number; rental_bikes: { name: string; size: string } | null }
type Booking = {
  id: string
  created_at: string
  rent_date: string
  slot: SlotId
  renter_name: string
  renter_id_number: string
  renter_phone: string
  renter_email: string | null
  total: number
  status: string
  notes: string | null
  contract_version: string
  contract_text: string
  contract_sha256: string
  signed_at: string
  signer_ip: string | null
  signature_path: string | null
  id_photo_path: string | null
  id_photo_deleted_at: string | null
  rental_booking_items: Item[]
}

const blankBike = (): Omit<BikeRow, 'id'> => ({
  name: '', model: '', size: 'M', height_min: null, height_max: null, description: '', photos: [],
  frame_number: '', agreed_value: null, active: true, sort_order: 0,
})

const C = { bg: '#141716', border: '#252b27', muted: '#7a8f7d', text: '#e8efe9', accent: '#b5e853' }
const input: React.CSSProperties = {
  background: '#0d0f0e', border: `1px solid ${C.border}`, borderRadius: 8, color: C.text,
  fontFamily: 'Heebo, Arial, sans-serif', fontSize: 13, padding: '7px 10px', outline: 'none', width: '100%',
}
const btn: React.CSSProperties = {
  background: '#1a2114', color: C.accent, border: '1px solid #2f4020', borderRadius: 8,
  padding: '7px 14px', fontSize: 13, fontWeight: 600, fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer',
}
const STATUS_COLOR: Record<string, string> = {
  pending: '#fbbf24', paid: '#b5e853', picked_up: '#60a5fa', returned: '#a8a29e', cancelled: '#f87171',
}
const waLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '').replace(/^0/, '972')}`

export default function RentalsAdminPage() {
  const user = useCoordinator()
  const [tab, setTab] = useState<'bookings' | 'bikes'>('bookings')
  if (!user) return null
  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', color: C.text }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🚲 השכרת אופניים</h1>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>
        דף ציבורי: <a href="/rent?preview=1" target="_blank" style={{ color: C.accent }}>/rent</a> · מחירים ומדיניות: lib/rental.ts
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button style={{ ...btn, ...(tab === 'bookings' ? { background: C.accent, color: '#0d0f0e' } : {}) }} onClick={() => setTab('bookings')}>הזמנות</button>
        <button style={{ ...btn, ...(tab === 'bikes' ? { background: C.accent, color: '#0d0f0e' } : {}) }} onClick={() => setTab('bikes')}>אופניים</button>
      </div>
      {tab === 'bookings' ? <Bookings /> : <Bikes />}
    </div>
  )
}

// ───────────────────────── Bookings ─────────────────────────

function Bookings() {
  const [rows, setRows] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [showPast, setShowPast] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [sigUrl, setSigUrl] = useState<Record<string, string>>({})
  const [idUrl, setIdUrl] = useState<Record<string, string>>({})

  // No setLoading(true) here: `loading` starts true, and a refresh keeps the
  // current list on screen until the new one arrives.
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('rental_bookings')
      .select('*, rental_booking_items(id, rider_name, rider_height_cm, protection, price, rental_bikes(name, size))')
      .order('rent_date', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) alert(error.message)
    setRows((data ?? []) as unknown as Booking[])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function setStatus(b: Booking, status: string) {
    const { error } = await supabase.from('rental_bookings').update({ status }).eq('id', b.id)
    if (error) return alert(error.message)
    setRows((rs) => rs.map((r) => (r.id === b.id ? { ...r, status } : r)))
  }

  async function toggle(b: Booking) {
    if (open === b.id) return setOpen(null)
    setOpen(b.id)
    if (b.signature_path && !sigUrl[b.id]) {
      const { data } = await supabase.storage.from('rental-contracts').createSignedUrl(b.signature_path, 600)
      if (data?.signedUrl) setSigUrl((s) => ({ ...s, [b.id]: data.signedUrl }))
    }
    if (b.id_photo_path && !idUrl[b.id]) {
      const { data } = await supabase.storage.from('rental-contracts').createSignedUrl(b.id_photo_path, 600)
      if (data?.signedUrl) setIdUrl((s) => ({ ...s, [b.id]: data.signedUrl }))
    }
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
  const shown = rows.filter((r) => showPast || r.rent_date >= today)

  const csv = () =>
    downloadCsv(
      'השכרות.csv',
      ['תאריך', 'משך', 'שוכר', 'טלפון', 'אופניים', 'מסלולי הגנה', 'סה״כ', 'סטטוס'],
      shown.map((r) => [
        r.rent_date, SLOT_BY_ID[r.slot]?.label ?? r.slot, r.renter_name, r.renter_phone,
        String(r.rental_booking_items.length), String(r.rental_booking_items.filter((i) => i.protection).length),
        String(r.total), STATUS_LABEL[r.status] ?? r.status,
      ]),
    )

  if (loading) return <p style={{ color: C.muted }}>טוען…</p>

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13, color: C.muted, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} /> להציג גם תאריכים שעברו
        </label>
        <button style={btn} onClick={csv}>ייצוא CSV</button>
        <button style={btn} onClick={load}>רענון</button>
      </div>
      {shown.length === 0 && <p style={{ color: C.muted }}>אין הזמנות.</p>}
      <div style={{ display: 'grid', gap: 10 }}>
        {shown.map((b) => (
          <div key={b.id} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 800 }}>{b.rent_date} · {SLOT_BY_ID[b.slot]?.label}</div>
                <div style={{ fontSize: 13 }}>
                  {b.renter_name} · <a href={waLink(b.renter_phone)} target="_blank" style={{ color: C.accent }}>{b.renter_phone}</a>
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  {b.rental_booking_items.map((i) => `${i.rider_name} (${i.rider_height_cm}) → ${i.rental_bikes?.name ?? '?'}${i.protection ? ' 🛡️' : ''}`).join(' · ')}
                </div>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{b.total} ₪</div>
                <select
                  value={b.status}
                  onChange={(e) => setStatus(b, e.target.value)}
                  style={{ ...input, width: 'auto', color: STATUS_COLOR[b.status] }}
                >
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <button style={{ ...btn, marginTop: 10, fontSize: 12, padding: '4px 10px' }} onClick={() => toggle(b)}>
              {open === b.id ? 'הסתרת ההסכם' : 'ההסכם החתום'}
            </button>
            {open === b.id && (
              <div style={{ marginTop: 10, fontSize: 12 }}>
                <div style={{ color: C.muted, marginBottom: 6 }}>
                  נחתם {new Date(b.signed_at).toLocaleString('he-IL')} · IP {b.signer_ip ?? '—'} · גרסה {b.contract_version} · ת״ז {b.renter_id_number}
                  <br />SHA-256: <span dir="ltr" style={{ fontFamily: 'monospace' }}>{b.contract_sha256}</span>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ color: C.muted, marginBottom: 4 }}>צילום תעודת זהות:</div>
                  {idUrl[b.id] ? (
                    <a href={idUrl[b.id]} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={idUrl[b.id]} alt="תעודת זהות" style={{ maxWidth: 320, maxHeight: 220, objectFit: 'contain', background: '#fff', borderRadius: 8 }} />
                    </a>
                  ) : b.id_photo_deleted_at ? (
                    <span style={{ color: C.muted }}>נמחק אוטומטית ב-{new Date(b.id_photo_deleted_at).toLocaleDateString('he-IL')}</span>
                  ) : b.id_photo_path ? (
                    <span style={{ color: C.muted }}>טוען…</span>
                  ) : (
                    <span style={{ color: '#f87171' }}>אין צילום</span>
                  )}
                </div>
                <div style={{ color: C.muted, marginBottom: 4 }}>חתימה:</div>
                {sigUrl[b.id] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sigUrl[b.id]} alt="חתימה" style={{ background: '#fff', borderRadius: 8, maxWidth: 320, marginBottom: 8 }} />
                )}
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'Heebo, Arial, sans-serif', background: '#0d0f0e', padding: 12, borderRadius: 8, maxHeight: 360, overflowY: 'auto' }}>
                  {b.contract_text}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ───────────────────────── Bikes ─────────────────────────

function Bikes() {
  const [bikes, setBikes] = useState<BikeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<(Omit<BikeRow, 'id'> & { id?: string }) | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // No setLoading(true) here: `loading` starts true, and a refresh keeps the
  // current list on screen until the new one arrives.
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('rental_bikes').select('*').order('sort_order').order('name')
    if (error) alert(error.message)
    setBikes((data ?? []) as BikeRow[])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function upload(files: FileList | null) {
    if (!files || !edit) return
    setUploading(true)
    const urls: string[] = []
    for (const file of Array.from(files)) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error } = await supabase.storage.from('rental-bike-photos').upload(path, file, { contentType: file.type })
      if (error) { alert(error.message); continue }
      urls.push(supabase.storage.from('rental-bike-photos').getPublicUrl(path).data.publicUrl)
    }
    setEdit((e) => (e ? { ...e, photos: [...e.photos, ...urls] } : e))
    setUploading(false)
  }

  async function save() {
    if (!edit) return
    if (!edit.name.trim()) return alert('חסר שם')
    if (!isSize(edit.size)) return alert('חסרה מידה')
    setSaving(true)
    const row = {
      name: edit.name.trim(),
      model: edit.model?.trim() || null,
      size: edit.size,
      height_min: edit.height_min || null,
      height_max: edit.height_max || null,
      description: edit.description?.trim() || null,
      photos: edit.photos,
      frame_number: edit.frame_number?.trim() || null,
      agreed_value: edit.agreed_value || null,
      active: edit.active,
      sort_order: edit.sort_order || 0,
    }
    const { error } = edit.id
      ? await supabase.from('rental_bikes').update(row).eq('id', edit.id)
      : await supabase.from('rental_bikes').insert(row)
    setSaving(false)
    if (error) return alert(error.message)
    setEdit(null)
    load()
  }

  if (loading) return <p style={{ color: C.muted }}>טוען…</p>

  if (edit) {
    const num = (v: string) => (v === '' ? null : Number(v))
    return (
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, display: 'grid', gap: 12 }}>
        <h2 style={{ fontWeight: 800 }}>{edit.id ? 'עריכת אופניים' : 'אופניים חדשים'}</h2>
        <L label="שם (מוצג ללקוחות) *"><input style={input} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Whistle #1" /></L>
        <L label="דגם"><input style={input} value={edit.model ?? ''} onChange={(e) => setEdit({ ...edit, model: e.target.value })} /></L>
        <L label="מידה *">
          <select style={input} value={edit.size} onChange={(e) => setEdit({ ...edit, size: e.target.value as BikeSize })}>
            {SIZES.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.label} ({s.min}–{s.max} ס״מ)</option>)}
          </select>
        </L>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <L label="גובה רוכב מינימלי (ריק = ברירת המחדל של המידה)"><input style={input} type="number" value={edit.height_min ?? ''} onChange={(e) => setEdit({ ...edit, height_min: num(e.target.value) })} /></L>
          <L label="גובה רוכב מקסימלי"><input style={input} type="number" value={edit.height_max ?? ''} onChange={(e) => setEdit({ ...edit, height_max: num(e.target.value) })} /></L>
        </div>
        <L label="תיאור קצר (מוצג ללקוחות)"><textarea style={{ ...input, minHeight: 60 }} value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></L>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <L label="מספר שלדה (פנימי)"><input style={input} value={edit.frame_number ?? ''} onChange={(e) => setEdit({ ...edit, frame_number: e.target.value })} /></L>
          <L label={`מחיר אופניים חדשים ₪ (לגניבה/אובדן; ריק = ${AGREED_VALUE_DEFAULT.toLocaleString('he-IL')})`}><input style={input} type="number" value={edit.agreed_value ?? ''} onChange={(e) => setEdit({ ...edit, agreed_value: num(e.target.value) })} /></L>
          <L label="סדר הצגה"><input style={input} type="number" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) || 0 })} /></L>
        </div>
        <L label="תמונות">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {edit.photos.map((src, k) => (
              <div key={src} style={{ position: 'relative' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" style={{ width: 110, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                <button
                  onClick={() => setEdit({ ...edit, photos: edit.photos.filter((_, j) => j !== k) })}
                  style={{ position: 'absolute', top: 2, left: 2, background: '#000a', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer', padding: '0 6px' }}
                >✕</button>
              </div>
            ))}
          </div>
          <input type="file" accept="image/*" multiple onChange={(e) => upload(e.target.files)} disabled={uploading} />
          {uploading && <span style={{ color: C.muted, fontSize: 12 }}> מעלה…</span>}
        </L>
        <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> פעיל (מוצג ללקוחות וזמין להזמנה)
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...btn, background: C.accent, color: '#0d0f0e' }} onClick={save} disabled={saving || uploading}>{saving ? 'שומר…' : 'שמירה'}</button>
          <button style={btn} onClick={() => setEdit(null)}>ביטול</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button style={{ ...btn, marginBottom: 14 }} onClick={() => setEdit(blankBike())}>+ הוספת אופניים</button>
      {bikes.length === 0 && <p style={{ color: C.muted }}>עוד אין אופניים.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
        {bikes.map((b) => (
          <button
            key={b.id}
            onClick={() => setEdit({ ...b })}
            style={{ textAlign: 'right', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', padding: 0, cursor: 'pointer', color: C.text, opacity: b.active ? 1 : 0.5 }}
          >
            {b.photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.photos[0]} alt="" style={{ width: '100%', height: 130, objectFit: 'cover' }} />
            ) : (
              <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}>אין תמונה</div>
            )}
            <div style={{ padding: 10 }}>
              <div style={{ fontWeight: 800 }}>{b.name} · {SIZE_LABEL[b.size]}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{b.model ?? ''}{b.active ? '' : ' · לא פעיל'}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 12, color: C.muted }}>
      {label}
      {children}
    </label>
  )
}
