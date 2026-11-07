'use client'

import { useEffect, useState } from 'react'
import SignaturePad from '@/components/SignaturePad'
import { WHATSAPP_OPTIN_LABEL } from '@/lib/whatsapp-optin'
import {
  RENTAL_OPEN, PRICE, PROTECTION_PRICE, PROTECTION_CAP, SLOTS, SLOT_BY_ID, SIZES, SIZE_LABEL, MAX_BIKES_PER_BOOKING,
  MIN_RIDER_AGE, MIN_RENTER_AGE, recommendSize, bikeFits, slotsClash, slotPrice, bookingTotal,
  type Bike, type SlotId, type PayLine,
} from '@/lib/rental'
import { CONSENTS, contractSections, type ConsentId } from '@/lib/rental-contract'

// ============================================================
// השכרת אופני שטח חשמליים — טבע בייק × טימו פאן
// נתיב: app/rent/page.tsx · API: app/api/rent/route.ts · הגדרות: lib/rental.ts
// ============================================================

const ACCENT = '#9BCB3C'

type Rider = { name: string; height: string; bike_id: string; protection: boolean }
const emptyRider = (): Rider => ({ name: '', height: '', bike_id: '', protection: true })

const todayIL = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })

export default function RentPage() {
  const [bikes, setBikes] = useState<Bike[]>([])
  const [busy, setBusy] = useState<{ bike_id: string; slot: SlotId }[]>([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState(false)

  const [date, setDate] = useState('')
  const [slot, setSlot] = useState<SlotId | ''>('')
  const [riders, setRiders] = useState<Rider[]>([emptyRider()])
  const [renter, setRenter] = useState({ name: '', id: '', phone: '', email: '' })
  const [adult, setAdult] = useState(false)
  const [consents, setConsents] = useState<Record<ConsentId, boolean>>({ terms: false, damage: false, theft: false, card: false })
  const [signedName, setSignedName] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [whatsappOptin, setWhatsappOptin] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ total: number; lines: PayLine[] } | null>(null)

  // Bikes on first load, then busy slots whenever the date changes.
  useEffect(() => {
    const q = date ? `?date=${date}` : ''
    fetch(`/api/rent${q}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setPreview(new URLSearchParams(window.location.search).get('preview') === '1')
        setBikes(d.bikes ?? [])
        setBusy(d.busy ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [date])

  const canBook = RENTAL_OPEN || preview

  const takenByOthers = (bikeId: string) => !!slot && busy.some((b) => b.bike_id === bikeId && slotsClash(slot, b.slot))

  const items = riders.map((r) => ({ slot: (slot || 'full') as SlotId, protection: r.protection }))
  const total = slot ? bookingTotal(items) : 0

  const setRider = (i: number, patch: Partial<Rider>) =>
    setRiders((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  async function submit() {
    setError('')
    if (!date) return setError('יש לבחור תאריך')
    if (!slot) return setError('יש לבחור משך השכרה')
    for (const r of riders) {
      if (!r.name.trim()) return setError('חסר שם לאחד הרוכבים')
      if (!recommendSize(Number(r.height))) return setError(`חסר גובה תקין עבור ${r.name}`)
      if (!r.bike_id) return setError(`יש לבחור אופניים עבור ${r.name}`)
    }
    if (renter.name.trim().length < 2) return setError('חסר שם מלא של השוכר')
    if (renter.id.replace(/\D/g, '').length < 5) return setError('חסר מספר תעודת זהות')
    if (renter.phone.replace(/\D/g, '').length < 9) return setError('מספר טלפון לא תקין')
    if (!renter.email.includes('@')) return setError('חסרה כתובת מייל (לשם יישלח עותק ההסכם)')
    if (!adult) return setError(`יש לאשר שהשוכר בן ${MIN_RENTER_AGE} ומעלה`)
    if (!CONSENTS.every((c) => consents[c.id])) return setError('יש לסמן את כל האישורים בהסכם')
    if (signedName.trim() !== renter.name.trim()) return setError('השם בחתימה חייב להיות זהה לשם השוכר')
    if (!signature) return setError('חסרה חתימה')

    setSending(true)
    try {
      const res = await fetch('/api/rent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rent_date: date,
          slot,
          renter_name: renter.name.trim(),
          renter_id_number: renter.id,
          renter_phone: renter.phone,
          renter_email: renter.email.trim(),
          adult,
          items: riders.map((r) => ({
            bike_id: r.bike_id, rider_name: r.name.trim(), rider_height_cm: Number(r.height), protection: r.protection,
          })),
          consents,
          signed_name: signedName.trim(),
          signature,
          whatsapp_optin: whatsappOptin,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'לא הצלחנו לשלוח. נסו שוב.')
        if (res.status === 409) {
          const r = await fetch(`/api/rent?date=${date}`, { cache: 'no-store' }).then((x) => x.json()).catch(() => null)
          if (r) { setBikes(r.bikes ?? []); setBusy(r.busy ?? []) }
        }
        return
      }
      setDone({ total: data.total, lines: data.lines })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setError('לא הצלחנו לשלוח. בדקו את החיבור ונסו שוב.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-stone-950 text-stone-100">
      <div className="max-w-2xl mx-auto">
        <header className="px-6 pt-8 pb-9" style={{ background: 'linear-gradient(160deg,#121a10 0%, #1a2414 55%, #222e16 100%)' }}>
          <p className="text-xs font-bold tracking-[.14em] mb-2" style={{ color: ACCENT }}>
            טבע בייק × טימו פאן
          </p>
          <h1 className="text-3xl font-extrabold mb-3">השכרת אופני שטח חשמליים</h1>
          <p className="text-stone-300 text-[15px] leading-relaxed mb-5">
            אופני שטח חשמליים חדשים, מותאמים לגובה שלכם. בוחרים תאריך, אופניים ומסלול הגנה, חותמים על ההסכם בדיגיטל – ויוצאים לשביל.
          </p>
          <ul className="flex flex-wrap gap-2 text-sm">
            <li className="bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5">⏱️ 4 שעות · {PRICE.half} ₪</li>
            <li className="bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5">☀️ יום מלא · {PRICE.full} ₪</li>
            <li className="bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5">🛡️ מסלול הגנה · {PROTECTION_PRICE} ₪</li>
          </ul>
        </header>

        <main className="px-5 py-7 space-y-8">
          {done ? (
            <Done total={done.total} lines={done.lines} />
          ) : (
            <>
              {/* size guide */}
              <section>
                <h2 className="text-lg font-bold mb-3">איזה גודל מתאים לי?</h2>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {SIZES.map((s) => (
                    <div key={s.id} className="bg-stone-900 rounded-xl p-3">
                      <div className="text-xl font-extrabold" style={{ color: ACCENT }}>{s.id}</div>
                      <div className="text-xs text-stone-400">{s.label}</div>
                      <div className="text-sm font-semibold mt-1" dir="ltr">{s.min}–{s.max} ס״מ</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-stone-500 mt-2">בהזמנה מזינים גובה לכל רוכב ומקבלים המלצה אוטומטית. לכל דגם יכול להיות טווח קצת אחר.</p>
              </section>

              {/* fleet */}
              <section>
                <h2 className="text-lg font-bold mb-3">האופניים</h2>
                {loading ? (
                  <p className="text-stone-400 text-sm">טוען…</p>
                ) : bikes.length === 0 ? (
                  <p className="text-stone-400 text-sm bg-stone-900 rounded-xl p-4">התמונות והאופניים יעלו כאן בקרוב.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {bikes.map((b) => <BikeCard key={b.id} bike={b} />)}
                  </div>
                )}
              </section>

              {/* protection */}
              <section className="bg-stone-900 rounded-xl p-4 space-y-2 text-[14.5px] text-stone-300">
                <h2 className="text-base font-bold text-stone-100">🛡️ מסלול הגנה – {PROTECTION_PRICE} ₪ לאופניים</h2>
                <p>מכסה נזק פיזי לאופניים עד {PROTECTION_CAP.toLocaleString('he-IL')} ₪ להשכרה. מעל זה משלמים רק את ההפרש (נזק של 1,300 ₪ → משלמים 300 ₪).</p>
                <p className="text-stone-400">לא מכסה גניבה ואובדן, ואינו ביטוח. כל הפרטים בהסכם למטה.</p>
              </section>

              {!canBook ? (
                <section className="text-center bg-stone-900 rounded-xl p-6 space-y-1.5">
                  <h2 className="text-lg font-bold">ההזמנות ייפתחו בקרוב</h2>
                  <p className="text-stone-400 text-sm">רוצים לשמוע ראשונים? כתבו לנו בוואטסאפ.</p>
                </section>
              ) : (
                <>
                  {preview && !RENTAL_OPEN && (
                    <p className="bg-amber-950 border border-amber-800 text-amber-200 rounded-lg p-3 text-sm">
                      מצב תצוגה מקדימה – ההזמנות עדיין לא פתוחות לציבור.
                    </p>
                  )}

                  {/* 1. when */}
                  <section className="space-y-4">
                    <h2 className="text-lg font-bold">1. מתי?</h2>
                    <div>
                      <label className="block text-sm text-stone-400 mb-1.5">תאריך *</label>
                      <input
                        type="date"
                        min={todayIL()}
                        value={date}
                        onChange={(e) => { setDate(e.target.value); setRiders((rs) => rs.map((r) => ({ ...r, bike_id: '' }))) }}
                        className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-3 text-stone-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-stone-400 mb-1.5">משך *</label>
                      <div className="grid grid-cols-3 gap-2">
                        {SLOTS.map((s) => (
                          <Pill key={s.id} active={slot === s.id} onClick={() => { setSlot(s.id); setRiders((rs) => rs.map((r) => ({ ...r, bike_id: '' }))) }}>
                            <span className="block">{s.label}</span>
                            <span className="block text-xs opacity-80" dir="ltr">{s.hours}</span>
                            <span className="block text-xs opacity-80">{slotPrice(s.id)} ₪</span>
                          </Pill>
                        ))}
                      </div>
                    </div>
                  </section>

                  {/* 2. riders */}
                  {date && slot && (
                    <section className="space-y-4">
                      <h2 className="text-lg font-bold">2. רוכבים ואופניים</h2>
                      {riders.map((r, i) => {
                        const h = Number(r.height)
                        const rec = recommendSize(h)
                        const chosenElsewhere = new Set(riders.filter((_, j) => j !== i).map((x) => x.bike_id))
                        const options = rec ? bikes.filter((b) => bikeFits(b, h) && !takenByOthers(b.id) && !chosenElsewhere.has(b.id)) : []
                        return (
                          <div key={i} className="bg-stone-900 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-bold">רוכב {i + 1}</span>
                              {riders.length > 1 && (
                                <button type="button" className="text-sm text-stone-400 underline" onClick={() => setRiders((rs) => rs.filter((_, j) => j !== i))}>
                                  הסרה
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="שם הרוכב *" value={r.name} onChange={(v) => setRider(i, { name: v })} />
                              <Field label="גובה בס״מ *" type="number" value={r.height} onChange={(v) => setRider(i, { height: v, bike_id: '' })} />
                            </div>
                            {rec && (
                              <p className="text-sm">
                                מידה מומלצת: <b style={{ color: ACCENT }}>{SIZE_LABEL[rec]} ({rec})</b>
                              </p>
                            )}
                            {rec && (options.length === 0 ? (
                              <p className="text-sm text-amber-300">אין אופניים פנויים בגודל המתאים במועד הזה. נסו מועד אחר או כתבו לנו.</p>
                            ) : (
                              <div className="grid grid-cols-2 gap-2">
                                {options.map((b) => (
                                  <button
                                    key={b.id}
                                    type="button"
                                    onClick={() => setRider(i, { bike_id: b.id })}
                                    className="text-right rounded-lg border overflow-hidden transition"
                                    style={r.bike_id === b.id ? { borderColor: ACCENT, background: '#1a2414' } : { borderColor: '#44403c', background: '#1c1917' }}
                                  >
                                    {b.photos[0] && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={b.photos[0]} alt={b.name} className="w-full h-24 object-cover" />
                                    )}
                                    <span className="block px-2 py-1.5 text-sm font-semibold">{b.name} · {b.size}</span>
                                  </button>
                                ))}
                              </div>
                            ))}
                            <label className="flex items-start gap-2.5 cursor-pointer text-sm text-stone-300 select-none">
                              <input
                                type="checkbox"
                                checked={r.protection}
                                onChange={(e) => setRider(i, { protection: e.target.checked })}
                                className="mt-0.5 w-[18px] h-[18px] shrink-0"
                                style={{ accentColor: ACCENT }}
                              />
                              <span>מסלול הגנה (+{PROTECTION_PRICE} ₪) – נזק פיזי מכוסה עד {PROTECTION_CAP.toLocaleString('he-IL')} ₪</span>
                            </label>
                          </div>
                        )
                      })}
                      {riders.length < MAX_BIKES_PER_BOOKING && (
                        <button
                          type="button"
                          onClick={() => setRiders((rs) => [...rs, emptyRider()])}
                          className="w-full border border-dashed border-stone-600 rounded-xl py-3 text-sm font-semibold text-stone-300"
                        >
                          + הוספת רוכב
                        </button>
                      )}
                      <p className="text-xs text-stone-500">כל רוכב בן {MIN_RIDER_AGE} לפחות. קסדה חובה.</p>
                    </section>
                  )}

                  {/* 3. renter */}
                  {date && slot && (
                    <section className="space-y-4">
                      <h2 className="text-lg font-bold">3. פרטי השוכר</h2>
                      <Field label="שם מלא *" value={renter.name} onChange={(v) => setRenter((x) => ({ ...x, name: v }))} />
                      <Field label="תעודת זהות *" type="tel" value={renter.id} onChange={(v) => setRenter((x) => ({ ...x, id: v }))} />
                      <Field label="טלפון *" type="tel" value={renter.phone} onChange={(v) => setRenter((x) => ({ ...x, phone: v }))} />
                      <Field label="מייל * (לשם יישלח עותק ההסכם)" type="email" value={renter.email} onChange={(v) => setRenter((x) => ({ ...x, email: v }))} />
                      <Check checked={adult} onChange={setAdult}>אני בן/בת {MIN_RENTER_AGE} ומעלה ואחראי/ת על כל הרוכבים בהזמנה</Check>
                    </section>
                  )}

                  {/* 4. contract */}
                  {date && slot && (
                    <section className="space-y-4">
                      <h2 className="text-lg font-bold">4. הסכם השכרה וחתימה</h2>
                      <div className="bg-stone-900 rounded-xl p-4 max-h-80 overflow-y-auto text-[13.5px] leading-relaxed text-stone-300 space-y-3">
                        {contractSections().map((s) => (
                          <div key={s.title}>
                            <h3 className="font-bold text-stone-100 mb-1">{s.title}</h3>
                            <ol className="list-decimal pr-5 space-y-1">
                              {s.items.map((t, k) => <li key={k}>{t}</li>)}
                            </ol>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2.5">
                        {CONSENTS.map((c) => (
                          <Check key={c.id} checked={consents[c.id]} onChange={(v) => setConsents((x) => ({ ...x, [c.id]: v }))} boxed>
                            {c.label}
                          </Check>
                        ))}
                      </div>
                      <Field label="שם מלא לחתימה (זהה לשם השוכר) *" value={signedName} onChange={setSignedName} />
                      <SignaturePad onChange={setSignature} />
                      <Check checked={whatsappOptin} onChange={setWhatsappOptin}>{WHATSAPP_OPTIN_LABEL}</Check>

                      <div className="bg-stone-900 rounded-xl p-4 flex items-center justify-between font-bold">
                        <span>סה״כ לתשלום</span>
                        <span style={{ color: ACCENT }}>{total} ₪</span>
                      </div>

                      {error && <div className="bg-red-950 border border-red-800 text-red-200 rounded-lg p-3 text-sm">{error}</div>}

                      <button
                        onClick={submit}
                        disabled={sending}
                        className="w-full text-stone-950 font-bold py-4 rounded-xl text-lg disabled:opacity-50 transition"
                        style={{ background: ACCENT }}
                      >
                        {sending ? 'שולח…' : 'חתימה ושליחת הזמנה'}
                      </button>
                      <p className="text-xs text-stone-500 text-center">
                        {SLOT_BY_ID[slot].label} · {date}. ההזמנה מאושרת אחרי התשלום. עותק של ההסכם החתום יישלח למייל.
                      </p>
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function Done({ total, lines }: { total: number; lines: PayLine[] }) {
  const allLinks = lines.every((l) => l.url)
  return (
    <section className="space-y-4 text-center">
      <h2 className="text-xl font-bold">ההזמנה נקלטה וההסכם נחתם 🎉</h2>
      <p className="text-stone-300">עותק של ההסכם נשלח למייל. כדי לאשר את ההזמנה יש להשלים תשלום.</p>
      <ul className="bg-stone-900 rounded-xl p-4 space-y-3 text-right">
        {lines.map((l) => (
          <li key={l.label} className="flex items-center justify-between gap-3">
            <span>{l.label} × {l.qty} · {l.unit * l.qty} ₪</span>
            {l.url && (
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-stone-950 font-bold px-4 py-2 rounded-lg text-sm" style={{ background: ACCENT }}>
                לתשלום
              </a>
            )}
          </li>
        ))}
        <li className="flex justify-between font-bold border-t border-stone-700 pt-3">
          <span>סה״כ</span>
          <span>{total} ₪</span>
        </li>
      </ul>
      {lines.some((l) => l.qty > 1 && l.url) && (
        <p className="text-sm text-stone-400">בעמוד התשלום סמנו את הכמות שמופיעה כאן.</p>
      )}
      {!allLinks && <p className="bg-stone-900 rounded-xl p-4 font-bold">קישור לתשלום יישלח אליכם בוואטסאפ.</p>}
    </section>
  )
}

function BikeCard({ bike }: { bike: Bike }) {
  return (
    <div className="bg-stone-900 rounded-xl overflow-hidden">
      {bike.photos.length > 0 && (
        <div className="flex overflow-x-auto snap-x snap-mandatory">
          {bike.photos.map((src, k) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={k} src={src} alt={`${bike.name} ${k + 1}`} className="w-full h-48 object-cover shrink-0 snap-center" />
          ))}
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center justify-between">
          <span className="font-bold">{bike.name}</span>
          <span className="text-xs font-bold rounded-full px-2.5 py-1" style={{ background: `${ACCENT}22`, color: ACCENT }}>
            {SIZE_LABEL[bike.size]}
          </span>
        </div>
        {bike.model && <p className="text-xs text-stone-400">{bike.model}</p>}
        {bike.description && <p className="text-sm text-stone-300 mt-1">{bike.description}</p>}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-sm text-stone-400 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={type === 'email' ? 120 : 60}
        dir={type === 'tel' || type === 'email' || type === 'number' ? 'ltr' : undefined}
        className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-3 text-stone-100 focus:outline-none focus:border-[#9BCB3C]"
      />
    </div>
  )
}

function Check({ checked, onChange, children, boxed = false }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; boxed?: boolean }) {
  return (
    <label className={`flex items-start gap-2.5 cursor-pointer text-sm text-stone-300 select-none ${boxed ? 'bg-stone-900 rounded-xl p-3.5' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 w-[18px] h-[18px] shrink-0" style={{ accentColor: ACCENT }} />
      <span>{children}</span>
    </label>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="py-2.5 px-2 rounded-lg border text-sm font-semibold transition"
      style={active ? { background: ACCENT, borderColor: ACCENT, color: '#0c0a09' } : { background: '#1c1917', borderColor: '#44403c', color: '#d6d3d1' }}
    >
      {children}
    </button>
  )
}
