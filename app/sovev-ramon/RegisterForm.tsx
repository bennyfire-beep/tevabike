'use client'

import { useEffect, useState } from 'react'
import { WHATSAPP_OPTIN_LABEL } from '@/lib/whatsapp-optin'
import { RIDE_SEATS, TRANSPORT, type Transport } from '@/lib/sovev-ramon'

// Sign-up for /sovev-ramon: name + phone + how you get there. The car option
// closes once RIDE_SEATS riders hold a seat; after signing up the rider gets
// the Arbox payment link that matches their choice.

const C = { brand: '#D4288A', greenMid: '#1F3D2A', card: '#152A1E', muted: '#D8E2DC' }

type Seats = { seats: number; taken: number; full: boolean }

export default function RegisterForm() {
  const [seats, setSeats] = useState<Seats | null>(null)
  const [transport, setTransport] = useState<Transport | ''>('')
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '' })
  const [consent, setConsent] = useState(false)
  const [whatsappOptin, setWhatsappOptin] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ transport: Transport; payUrl: string } | null>(null)

  async function loadSeats() {
    try {
      const r = await fetch('/api/sovev-ramon', { cache: 'no-store' })
      if (r.ok) setSeats(await r.json())
    } catch {
      // best-effort — the server still enforces the cap
    }
  }

  useEffect(() => {
    fetch('/api/sovev-ramon', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSeats(d))
      .catch(() => {})
  }, [])

  const rideFull = !!seats?.full
  const rideLeft = seats ? Math.max(0, RIDE_SEATS - seats.taken) : null

  async function submit() {
    setError('')
    if (!transport) return setError('יש לבחור איך מגיעים')
    if (!form.first_name.trim() || !form.last_name.trim()) return setError('חסרים שם פרטי ושם משפחה')
    if (form.phone.replace(/\D/g, '').length < 9) return setError('מספר טלפון לא תקין')
    if (!consent) return setError('יש לאשר את תנאי הביטול והאחריות')

    setSending(true)
    try {
      const res = await fetch('/api/sovev-ramon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, transport, consent: true, whatsapp_optin: whatsappOptin }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'לא הצלחנו לשלוח. נסו שוב.')
        if (data?.full) setTransport('')
        await loadSeats()
        return
      }
      setDone({ transport, payUrl: data.payUrl })
    } catch {
      setError('לא הצלחנו לשלוח. בדקו את החיבור ונסו שוב.')
    } finally {
      setSending(false)
    }
  }

  if (done) {
    const t = TRANSPORT[done.transport]
    return (
      <div className="rounded-2xl border-2 p-6 text-center" style={{ borderColor: C.brand, background: `${C.brand}14` }}>
        <p className="text-2xl font-black mb-2">נרשמת! 🎉</p>
        <p className="mb-1" style={{ color: C.muted }}>{t.label} · {t.price} ₪</p>
        <p className="mb-5" style={{ color: C.muted }}>המקום נשמר. כדי לסגור אותו, נשאר רק לשלם:</p>
        <a
          href={done.payUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-xl px-8 py-3 text-lg font-bold"
          style={{ background: C.brand, color: '#fff' }}
        >
          לתשלום {t.price} ₪ ←
        </a>
      </div>
    )
  }

  const input = 'w-full rounded-xl px-4 py-3 bg-black/30 border outline-none focus:border-pink-500'

  return (
    <div className="rounded-2xl border p-5 space-y-5" style={{ background: C.card, borderColor: C.greenMid }}>
      <h2 className="text-xl font-bold">📝 הרשמה</h2>

      <fieldset className="grid sm:grid-cols-2 gap-3">
        <legend className="font-bold mb-2">איך מגיעים?</legend>
        {(Object.keys(TRANSPORT) as Transport[]).map((k) => {
          const t = TRANSPORT[k]
          const disabled = k === 'ride' && rideFull
          const selected = transport === k
          return (
            <button
              key={k}
              type="button"
              disabled={disabled}
              onClick={() => setTransport(k)}
              aria-pressed={selected}
              className="rounded-2xl p-4 border-2 text-center disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor: selected ? C.brand : C.greenMid, background: selected ? `${C.brand}22` : 'transparent' }}
            >
              <span className="block text-sm" style={{ color: C.muted }}>{t.sub}</span>
              <span className="block text-lg font-bold mt-1">{t.label}</span>
              <span className="block text-2xl font-black mt-1" style={{ color: C.brand }}>{t.price} ₪</span>
              {k === 'ride' && rideLeft != null && (
                <span className="block text-sm mt-2 font-bold" style={{ color: rideFull ? '#F87171' : C.muted }}>
                  {rideFull ? 'הרכב מלא' : `נשארו ${rideLeft} מתוך ${RIDE_SEATS} מקומות`}
                </span>
              )}
            </button>
          )
        })}
      </fieldset>

      <div className="grid sm:grid-cols-2 gap-3">
        <input className={input} style={{ borderColor: C.greenMid }} placeholder="שם פרטי"
          value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
        <input className={input} style={{ borderColor: C.greenMid }} placeholder="שם משפחה"
          value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
        <input className={`${input} sm:col-span-2`} style={{ borderColor: C.greenMid }} placeholder="טלפון נייד" inputMode="tel" dir="ltr"
          value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>

      <label className="flex gap-3 items-start text-sm" style={{ color: C.muted }}>
        <input type="checkbox" className="mt-1 accent-pink-600" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          קראתי ואני מאשר/ת את תנאי הביטול. ידוע לי שרכיבת שטח במדבר כרוכה במאמץ ובסיכון, שאני כשיר/ה לרכיבה
          ושההשתתפות באחריותי.
        </span>
      </label>
      <label className="flex gap-3 items-start text-sm" style={{ color: C.muted }}>
        <input type="checkbox" className="mt-1 accent-pink-600" checked={whatsappOptin} onChange={(e) => setWhatsappOptin(e.target.checked)} />
        <span>{WHATSAPP_OPTIN_LABEL}</span>
      </label>

      {error && <p className="font-bold" style={{ color: '#F87171' }}>{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={sending}
        className="w-full rounded-xl py-3.5 text-lg font-bold disabled:opacity-60"
        style={{ background: C.brand, color: '#fff' }}
      >
        {sending ? 'שולח…' : 'להרשמה ←'}
      </button>
    </div>
  )
}
