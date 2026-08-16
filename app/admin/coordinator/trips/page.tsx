'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'

// ============================================================
// נתיב: app/admin/coordinator/trips/page.tsx
// מעקב אחרי הרשמות לטיולי חו"ל
// ============================================================

type Trip = {
  id: number
  slug: string
  access_code: string | null
  title: string
  subtitle: string | null
  trip_start: string
  trip_end: string
  price_small_group: number
  price_large_group: number
  size_small: number
  size_large: number
  deposit_ils: number
  is_open: boolean
}

type Reg = {
  id: number
  trip_id: number
  created_at: string
  name_he: string
  name_passport: string
  birth_date: string
  phone: string
  email: string | null
  passport_number: string
  passport_expiry: string
  passport_file: string | null
  shirt_size: string
  wants_rental: boolean
  rental_size: string | null
  rental_height_cm: number | null
  wants_insurance: boolean
  dietary: string | null
  notes: string | null
  payment_status: string
  amount_paid_ils: number | null
  outbound_flight: string | null
  return_flight: string | null
  flights_received: boolean
}

// רק בני ושיר. תואם ל-is_salary_admin() בבסיס הנתונים.
const TRIP_ADMINS = ['bennyfire@gmail.com', 'shirkobi8@gmail.com']

const STATUS_LABEL: Record<string, string> = {
  pending: 'ממתין למקדמה',
  deposit_paid: 'מקדמה שולמה',
  paid: 'שולם במלואו',
  cancelled: 'בוטל',
}
const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#3a2f14', fg: '#fbbf24' },
  deposit_paid: { bg: '#14293a', fg: '#7dd3fc' },
  paid: { bg: '#1a2114', fg: '#b5e853' },
  cancelled: { bg: '#3a1a1a', fg: '#f87171' },
}
const NEXT_STATUS = ['pending', 'deposit_paid', 'paid', 'cancelled']

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('he-IL', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const fmtDay = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

const waLink = (phone: string, text: string) => {
  const clean = phone.replace(/\D/g, '').replace(/^0/, '972')
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`
}

// passport must be valid 6 months past the return date
const passportExpiringSoon = (expiry: string, tripEnd: string) => {
  const e = new Date(expiry)
  const need = new Date(tripEnd)
  need.setMonth(need.getMonth() + 6)
  return e < need
}

const daysUntil = (iso: string) =>
  Math.ceil(
    (new Date(iso + 'T00:00:00').getTime() - Date.now()) / 86_400_000
  )

export default function TripsAdminPage() {
  const user = useCoordinator()
  const [trips, setTrips] = useState<Trip[]>([])
  const [tripId, setTripId] = useState<number | null>(null)
  const [regs, setRegs] = useState<Reg[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [openRow, setOpenRow] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const allowed =
    !!user?.email && TRIP_ADMINS.includes(user.email.toLowerCase())

  const load = useCallback(async () => {
    setLoading(true)
    const { data: t } = await supabase
      .from('trips')
      .select('*')
      .order('trip_start', { ascending: true })
    const list = (t ?? []) as Trip[]
    setTrips(list)
    const active = tripId ?? list[0]?.id ?? null
    setTripId(active)
    if (active) {
      const { data: r } = await supabase
        .from('trip_registrations')
        .select('*')
        .eq('trip_id', active)
        .order('created_at', { ascending: true })
      setRegs((r ?? []) as Reg[])
    }
    setLoading(false)
  }, [tripId])

  useEffect(() => {
    if (user && allowed) load()
    else if (user) setLoading(false)
  }, [user, allowed, load])

  async function changeStatus(reg: Reg, payment_status: string) {
    setSavingId(reg.id)
    const patch: Record<string, unknown> = { payment_status }
    if (payment_status === 'deposit_paid') {
      patch.deposit_paid_at = new Date().toISOString()
    }
    const { error } = await supabase
      .from('trip_registrations')
      .update(patch)
      .eq('id', reg.id)
    if (error) {
      alert(error.message)
      setSavingId(null)
      return
    }
    setRegs((prev) =>
      prev.map((r) => (r.id === reg.id ? { ...r, payment_status } : r))
    )
    setSavingId(null)
  }

  async function remove(reg: Reg) {
    if (!confirm(`למחוק לצמיתות את ההרשמה של ${reg.name_he}?`)) return
    const { error } = await supabase
      .from('trip_registrations')
      .delete()
      .eq('id', reg.id)
    if (error) {
      alert(error.message)
      return
    }
    setRegs((prev) => prev.filter((r) => r.id !== reg.id))
  }

  const trip = trips.find((t) => t.id === tripId) ?? null
  const active = regs.filter((r) => r.payment_status !== 'cancelled')
  const paidDeposit = active.filter((r) =>
    ['deposit_paid', 'paid'].includes(r.payment_status)
  )
  const shown =
    statusFilter === 'all'
      ? regs
      : regs.filter((r) => r.payment_status === statusFilter)

  const currentPrice = trip
    ? active.length > trip.size_small
      ? trip.price_large_group
      : trip.price_small_group
    : 0

  const link = trip
    ? `https://www.tevabike.com/trip/${trip.slug}?k=${trip.access_code ?? ''}`
    : ''

  // shirt tally
  const shirts = active.reduce<Record<string, number>>((acc, r) => {
    acc[r.shirt_size] = (acc[r.shirt_size] || 0) + 1
    return acc
  }, {})

  if (user && !allowed)
    return (
      <div style={{ padding: 40, maxWidth: 520, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>
          אין לך גישה לעמוד הזה
        </h1>
        <p style={{ color: '#7a8f7d', fontSize: 14, lineHeight: 1.7 }}>
          טיולי חו״ל כוללים פרטי דרכון ותשלומים, ולכן הגישה מוגבלת.
          אם אתה צריך גישה — דבר עם בני.
        </p>
      </div>
    )

  if (loading)
    return <div style={{ padding: 24, color: '#7a8f7d' }}>טוען...</div>

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 18 }}>
        טיולי חו״ל
      </h1>

      {/* trip picker */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {trips.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTripId(t.id)
              setOpenRow(null)
            }}
            style={{
              background: t.id === tripId ? '#1e2a24' : 'transparent',
              border: `1px solid ${t.id === tripId ? '#b5e853' : '#252b27'}`,
              color: t.id === tripId ? '#b5e853' : '#8fa098',
              padding: '8px 16px',
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t.title}
            {!t.is_open && ' (סגור)'}
          </button>
        ))}
      </div>

      {trip && (
        <>
          {/* summary cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 12,
              marginBottom: 20,
            }}
          >
            <Card label="נרשמו" value={String(active.length)} />
            <Card
              label="שילמו מקדמה"
              value={`${paidDeposit.length} / ${active.length}`}
              accent={paidDeposit.length === active.length && active.length > 0}
            />
            <Card
              label="מקדמות שהתקבלו"
              value={`₪${(paidDeposit.length * trip.deposit_ils).toLocaleString()}`}
            />
            <Card label="מחיר בתוקף" value={`€${currentPrice}`} />
            <Card
              label="ימים ליציאה"
              value={String(daysUntil(trip.trip_start))}
            />
          </div>

          {/* private link */}
          <div
            style={{
              background: '#141716',
              border: '1px solid #252b27',
              borderRadius: 6,
              padding: '12px 16px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 12, color: '#7a8f7d' }}>קישור פרטי</span>
            <code
              style={{
                fontSize: 12,
                color: '#b5e853',
                direction: 'ltr',
                flex: 1,
                minWidth: 240,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {link}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(link)
                setCopied(true)
                setTimeout(() => setCopied(false), 1800)
              }}
              style={{
                background: copied ? '#1a2114' : 'transparent',
                border: '1px solid #3a4a40',
                color: copied ? '#b5e853' : '#e8efe9',
                padding: '6px 14px',
                borderRadius: 5,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {copied ? 'הועתק' : 'העתק'}
            </button>
          </div>

          {/* shirt tally */}
          {active.length > 0 && (
            <div
              style={{
                fontSize: 13,
                color: '#8fa098',
                marginBottom: 20,
                display: 'flex',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ color: '#7a8f7d' }}>חולצות:</span>
              {Object.entries(shirts)
                .sort()
                .map(([size, n]) => (
                  <span key={size}>
                    {size} × <strong style={{ color: '#e8efe9' }}>{n}</strong>
                  </span>
                ))}
            </div>
          )}

          {/* filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {['all', ...NEXT_STATUS].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  background: statusFilter === s ? '#1e2a24' : 'transparent',
                  border: `1px solid ${statusFilter === s ? '#3a4a40' : '#252b27'}`,
                  color: statusFilter === s ? '#e8efe9' : '#7a8f7d',
                  padding: '5px 12px',
                  borderRadius: 5,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {s === 'all' ? 'הכל' : STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          {/* list */}
          {shown.length === 0 && (
            <p style={{ color: '#7a8f7d', padding: '30px 0' }}>
              עוד אין הרשמות. שלח את הקישור הפרטי לקבוצה.
            </p>
          )}

          {shown.map((r, i) => {
            const c = STATUS_COLOR[r.payment_status] ?? STATUS_COLOR.pending
            const expiring = passportExpiringSoon(r.passport_expiry, trip.trip_end)
            const open = openRow === r.id
            return (
              <div
                key={r.id}
                style={{
                  background: '#141716',
                  border: '1px solid #252b27',
                  borderRadius: 8,
                  marginBottom: 10,
                  overflow: 'hidden',
                }}
              >
                <div
                  onClick={() => setOpenRow(open ? null : r.id)}
                  style={{
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ color: '#4a5a50', fontSize: 12, width: 20 }}>
                    {i + 1}
                  </span>
                  <strong style={{ fontSize: 15, flex: 1, minWidth: 120 }}>
                    {r.name_he}
                  </strong>
                  <span
                    style={{
                      background: c.bg,
                      color: c.fg,
                      padding: '3px 10px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {STATUS_LABEL[r.payment_status] ?? r.payment_status}
                  </span>
                  {expiring && (
                    <span
                      style={{
                        background: '#3a1a1a',
                        color: '#f87171',
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    >
                      דרכון
                    </span>
                  )}
                  {r.wants_rental && (
                    <span style={{ fontSize: 12, color: '#7dd3fc' }}>
                      השכרה {r.rental_size}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: '#7a8f7d' }}>
                    {r.shirt_size}
                  </span>
                  <span style={{ fontSize: 11, color: '#4a5a50' }}>
                    {fmtDate(r.created_at)}
                  </span>
                </div>

                {open && (
                  <div
                    style={{
                      padding: '0 16px 16px',
                      borderTop: '1px solid #1e2320',
                      fontSize: 13,
                      color: '#b9c7bd',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '10px 20px',
                        padding: '14px 0',
                      }}
                    >
                      <Row k="שם בדרכון" v={r.name_passport} ltr />
                      <Row k="תאריך לידה" v={fmtDay(r.birth_date)} />
                      <Row k="טלפון" v={r.phone} ltr />
                      <Row k="אימייל" v={r.email ?? '—'} ltr />
                      <Row k="מס׳ דרכון" v={r.passport_number} ltr />
                      <Row
                        k="תוקף דרכון"
                        v={fmtDay(r.passport_expiry)}
                        warn={expiring}
                      />
                      <Row
                        k="צילום דרכון"
                        v={r.passport_file ? 'הועלה' : 'חסר'}
                        warn={!r.passport_file}
                      />
                      <Row k="חולצה" v={r.shirt_size} />
                      <Row
                        k="השכרת אופניים"
                        v={
                          r.wants_rental
                            ? `כן — מידה ${r.rental_size ?? '?'}${
                                r.rental_height_cm ? `, ${r.rental_height_cm} ס״מ` : ''
                              }`
                            : 'לא'
                        }
                      />
                      <Row k="ביטוח — לחזור אליו" v={r.wants_insurance ? 'כן' : 'לא'} />
                      <Row k="טיסת הלוך" v={r.outbound_flight ?? '—'} ltr />
                      <Row k="טיסת חזור" v={r.return_flight ?? '—'} ltr />
                      {r.dietary && <Row k="תזונה" v={r.dietary} />}
                      {r.notes && <Row k="הערות" v={r.notes} />}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {NEXT_STATUS.filter((s) => s !== r.payment_status).map(
                        (s) => (
                          <button
                            key={s}
                            disabled={savingId === r.id}
                            onClick={() => changeStatus(r, s)}
                            style={{
                              background: 'transparent',
                              border: `1px solid ${STATUS_COLOR[s].fg}55`,
                              color: STATUS_COLOR[s].fg,
                              padding: '6px 12px',
                              borderRadius: 5,
                              fontSize: 12,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >
                            {STATUS_LABEL[s]}
                          </button>
                        )
                      )}
                      <a
                        href={waLink(
                          r.phone,
                          `היי ${r.name_he.split(' ')[0]}, לגבי ${trip.title} — `
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: 'transparent',
                          border: '1px solid #3a4a40',
                          color: '#e8efe9',
                          padding: '6px 12px',
                          borderRadius: 5,
                          fontSize: 12,
                          textDecoration: 'none',
                        }}
                      >
                        וואטסאפ
                      </a>
                      <button
                        onClick={() => remove(r)}
                        style={{
                          background: 'transparent',
                          border: '1px solid #4a2020',
                          color: '#f87171',
                          padding: '6px 12px',
                          borderRadius: 5,
                          fontSize: 12,
                          cursor: 'pointer',
                          marginInlineStart: 'auto',
                          fontFamily: 'inherit',
                        }}
                      >
                        מחק
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

function Card({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      style={{
        background: '#141716',
        border: `1px solid ${accent ? '#3a5a30' : '#252b27'}`,
        borderRadius: 8,
        padding: '14px 16px',
      }}
    >
      <div style={{ fontSize: 11, color: '#7a8f7d', marginBottom: 6 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: accent ? '#b5e853' : '#e8efe9',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function Row({
  k,
  v,
  ltr,
  warn,
}: {
  k: string
  v: string
  ltr?: boolean
  warn?: boolean
}) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#7a8f7d', marginBottom: 2 }}>{k}</div>
      <div
        style={{
          color: warn ? '#f87171' : '#e8efe9',
          direction: ltr ? 'ltr' : 'rtl',
          textAlign: ltr ? 'left' : 'right',
        }}
      >
        {v}
      </div>
    </div>
  )
}
