'use client'

import { useEffect, useState } from 'react'
import { WHATSAPP_OPTIN_LABEL } from '@/lib/whatsapp-optin'
import { LEVELS, RENTAL_PRICE, type RiderType } from '@/lib/ride-sessions'

// ============================================================
// טופס הרשמה לטיול רכיבה — בחירת "רוכב/ת טבע בייק" או "אורח/ת".
// המחיר הסופי נקבע בשרת (app/api/rides/route.ts) לפי הטלפון.
// ============================================================

const PINK = '#D4288A'

type Props = {
  slug: string
  title: string
  dateLabel: string
  capacity: number
  memberPrice: number
  guestPrice: number
}

type Done = { first_name: string; rider_type: RiderType; price: number; wantsRental: boolean; payUrl: string | null }

export default function RideRegistration({ slug, title, dateLabel, capacity, memberPrice, guestPrice }: Props) {
  const [status, setStatus] = useState<{ count: number; closed: boolean } | null>(null)
  const [riderType, setRiderType] = useState<RiderType>('member')
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '', level: '', notes: '' })
  const [wantsRental, setWantsRental] = useState(false)
  const [rentalHeight, setRentalHeight] = useState('')
  const [consent, setConsent] = useState(false)
  const [whatsappOptin, setWhatsappOptin] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notMember, setNotMember] = useState(false)
  const [done, setDone] = useState<Done | null>(null)

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  // best-effort — the form still works, it just won't show live counts
  const fetchStatus = (): Promise<{ count: number; closed: boolean } | null> =>
    fetch('/api/rides', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => (d.sessions ?? []).find((x: { slug: string }) => x.slug === slug) ?? null)
      .catch(() => null)

  async function loadStatus() {
    const mine = await fetchStatus()
    if (mine) setStatus({ count: mine.count, closed: mine.closed })
  }

  useEffect(() => {
    fetchStatus().then((mine) => {
      if (mine) setStatus({ count: mine.count, closed: mine.closed })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  async function submit() {
    setError('')
    setNotMember(false)
    if (!form.first_name.trim() || !form.last_name.trim()) return setError('חסרים שם פרטי ושם משפחה')
    if (form.phone.replace(/\D/g, '').length < 9) return setError('מספר טלפון לא תקין')
    if (!form.level) return setError('יש לבחור רמת רכיבה')
    if (wantsRental) {
      const h = Number(rentalHeight)
      if (!(h >= 100 && h <= 220)) return setError('לשכירת אופניים צריך גובה בס״מ (100–220)')
    }
    if (!consent) return setError('יש לאשר את הצהרת הבריאות והאחריות')

    setSending(true)
    try {
      const res = await fetch('/api/rides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, ...form, rider_type: riderType, consent: true, whatsapp_optin: whatsappOptin,
          wants_rental: wantsRental, rental_height_cm: wantsRental ? Number(rentalHeight) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'לא הצלחנו לשלוח. נסו שוב.')
        setNotMember(Boolean(data?.notMember))
        if (data?.closed) await loadStatus()
        return
      }
      setDone({ first_name: form.first_name, rider_type: data.rider_type, price: data.price, wantsRental: Boolean(data.wants_rental), payUrl: data.payUrl ?? null })
      await loadStatus()
    } catch {
      setError('לא הצלחנו לשלוח. בדקו את החיבור ונסו שוב.')
    } finally {
      setSending(false)
    }
  }

  const count = status?.count ?? 0
  const closed = status?.closed ?? false
  const pct = Math.min(100, Math.round((count / capacity) * 100))

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-5">
      {/* pricing */}
      <div className="grid grid-cols-2 gap-2">
        <PriceCard
          active={!done && riderType === 'member'}
          onClick={() => { setRiderType('member'); setNotMember(false) }}
          label="רוכב/ת טבע בייק"
          price={memberPrice}
          disabled={!!done}
        />
        <PriceCard
          active={!done && riderType === 'guest'}
          onClick={() => { setRiderType('guest'); setNotMember(false) }}
          label="אורח/ת"
          price={guestPrice}
          disabled={!!done}
        />
      </div>

      {/* live meter */}
      {status && (
        <div aria-live="polite">
          <div className="h-2.5 rounded-full bg-stone-800 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: closed ? '#C97A3B' : PINK }} />
          </div>
          <p className="mt-1.5 text-sm font-semibold text-stone-400">
            {count} / {capacity} נרשמו · {closed ? 'ההרשמה סגורה' : `${capacity - count} מקומות פנויים`}
          </p>
        </div>
      )}

      {done ? (
        <section className="text-center space-y-3 py-1">
          <h2 className="text-xl font-bold">נרשמת בהצלחה! 🎉</h2>
          <p className="text-stone-300 text-sm">
            {done.first_name}, שמרנו לך מקום ב{title} · {dateLabel}
          </p>
          <p className="text-stone-400 text-sm">
            {done.rider_type === 'member' ? 'זיהינו אותך כרוכב/ת טבע בייק 🤘' : 'נרשמת כאורח/ת — כיף שבאת!'} כדי לשריין את המקום
            סופית יש להשלים תשלום.
          </p>
          {done.payUrl ? (
            <a
              href={done.payUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-white font-bold py-4 rounded-xl text-lg"
              style={{ background: PINK }}
            >
              מעבר לתשלום · {done.price} ₪
            </a>
          ) : (
            <p className="bg-stone-800 rounded-xl p-4 font-bold">
              לתשלום: {done.price} ₪ · קישור לתשלום יישלח אליך בוואטסאפ
            </p>
          )}
          {done.wantsRental && (
            <p className="bg-stone-800 rounded-xl p-3 text-sm text-stone-300">
              🚲 ביקשת אופניים בהשכרה —{' '}
              {RENTAL_PRICE != null ? `${RENTAL_PRICE} ₪, בתשלום נפרד.` : 'נעדכן אותך במחיר ובפרטים בוואטסאפ.'}
            </p>
          )}
          <p className="text-xs text-stone-500">המקום נשמר אך ורק לאחר ביצוע תשלום בפועל.</p>
        </section>
      ) : closed ? (
        <section className="text-center bg-stone-800 rounded-xl p-5 space-y-1.5">
          <h2 className="text-lg font-bold">ההרשמה סגורה</h2>
          <p className="text-stone-400 text-sm">אם יתפנה מקום נעדכן כאן. טיולים נוספים בעמוד טיולי הרכיבה.</p>
        </section>
      ) : (
        <section className="space-y-4">
          {riderType === 'member' && (
            <p className="text-xs text-stone-400 leading-relaxed">
              רוכבי טבע בייק — הזינו את הטלפון שאיתו נרשמתם לחוג (או של ההורה), והמחיר של {memberPrice} ₪ יחול אוטומטית.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="שם פרטי *" value={form.first_name} onChange={(v) => set('first_name', v)} />
            <Field label="שם משפחה *" value={form.last_name} onChange={(v) => set('last_name', v)} />
          </div>
          <Field label="טלפון *" type="tel" value={form.phone} onChange={(v) => set('phone', v)} />
          <Field label="אימייל" type="email" value={form.email} onChange={(v) => set('email', v)} />

          <div>
            <label className="block text-sm text-stone-400 mb-1.5">רמת רכיבה *</label>
            <div className="grid grid-cols-3 gap-2">
              {LEVELS.map((l) => (
                <Pill key={l.value} active={form.level === l.value} onClick={() => set('level', l.value)}>
                  {l.label}
                </Pill>
              ))}
            </div>
          </div>

          <div className="bg-stone-950 rounded-xl p-3.5 space-y-3">
            <label className="flex items-start gap-2.5 cursor-pointer text-sm text-stone-300 select-none">
              <input
                type="checkbox"
                checked={wantsRental}
                onChange={(e) => setWantsRental(e.target.checked)}
                className="mt-0.5 w-[18px] h-[18px] cursor-pointer shrink-0"
                style={{ accentColor: PINK }}
              />
              <span>
                <b className="text-stone-100">🚲 צריך/ה אופניים בהשכרה</b>
                <span className="block text-stone-400 text-xs mt-0.5">
                  {RENTAL_PRICE != null ? `${RENTAL_PRICE} ₪ לטיול, בנוסף למחיר הטיול` : 'המחיר יעודכן בקרוב — נחזור אליך עם הפרטים'}
                </span>
              </span>
            </label>
            {wantsRental && (
              <Field label="גובה הרוכב/ת בס״מ * (להתאמת מידת האופניים)" type="number" value={rentalHeight} onChange={setRentalHeight} />
            )}
          </div>

          <div>
            <label className="block text-sm text-stone-400 mb-1.5">הערות (רגישויות, שאלות, הגעה עם חבר/ה)</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2.5 text-stone-100 focus:outline-none focus:border-[#D4288A]"
            />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer text-sm text-stone-300 select-none bg-stone-950 rounded-xl p-3.5">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 w-[18px] h-[18px] cursor-pointer shrink-0"
              style={{ accentColor: PINK }}
            />
            <span>
              אני מצהיר/ה שמצבי הבריאותי מאפשר השתתפות ברכיבת שטח, ידוע לי על הסיכונים הכרוכים בפעילות ואני נושא/ת
              באחריות המלאה לכך (לקטינים — באישור הורה).
            </span>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer text-sm text-stone-300 select-none">
            <input
              type="checkbox"
              checked={whatsappOptin}
              onChange={(e) => setWhatsappOptin(e.target.checked)}
              className="mt-0.5 w-[18px] h-[18px] cursor-pointer shrink-0"
              style={{ accentColor: PINK }}
            />
            <span>{WHATSAPP_OPTIN_LABEL}</span>
          </label>

          {error && (
            <div className="bg-red-950 border border-red-800 text-red-200 rounded-lg p-3 text-sm space-y-2">
              <p>{error}</p>
              {notMember && (
                <button
                  type="button"
                  onClick={() => { setRiderType('guest'); setNotMember(false); setError('') }}
                  className="underline font-bold"
                >
                  להירשם כאורח/ת ({guestPrice} ₪)
                </button>
              )}
            </div>
          )}

          <button
            onClick={submit}
            disabled={sending}
            className="w-full text-white font-bold py-4 rounded-xl text-lg disabled:opacity-50 transition"
            style={{ background: PINK }}
          >
            {sending ? 'שולח…' : `הרשמה · ${riderType === 'member' ? memberPrice : guestPrice} ₪`}
          </button>
        </section>
      )}
    </div>
  )
}

function PriceCard({ active, onClick, label, price, disabled }: {
  active: boolean; onClick: () => void; label: string; price: number; disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className="rounded-xl border p-3 text-center transition disabled:cursor-default"
      style={active ? { background: `${PINK}22`, borderColor: PINK } : { background: '#0c0a09', borderColor: '#44403c' }}
    >
      <span className="block text-xs text-stone-400 mb-0.5">{label}</span>
      <span className="block text-2xl font-extrabold">{price} ₪</span>
      <span className="block text-[11px] text-stone-500">לטיול</span>
    </button>
  )
}

function Field({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <label className="block text-sm text-stone-400 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={type === 'email' ? 120 : 40}
        dir={type === 'tel' || type === 'email' || type === 'number' ? 'ltr' : undefined}
        inputMode={type === 'number' ? 'numeric' : undefined}
        className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-3 text-stone-100 focus:outline-none focus:border-[#D4288A]"
      />
    </div>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="py-3 px-2 rounded-lg border text-sm font-semibold transition"
      style={active ? { background: PINK, borderColor: PINK, color: '#fff' } : { background: '#0c0a09', borderColor: '#44403c', color: '#d6d3d1' }}
    >
      {children}
    </button>
  )
}
