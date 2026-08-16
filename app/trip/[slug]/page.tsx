'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useParams } from 'next/navigation'

// ============================================================
// טופס הרשמה לקבוצה — טבע בייק
// נתיב: app/trip/[slug]/page.tsx
// גישה: /trip/morzine-2027?k=tb27azm
// ============================================================

type Trip = {
  id: number
  slug: string
  title: string
  subtitle: string | null
  destination: string
  chalet_name: string | null
  trip_start: string
  trip_end: string
  riding_start: string
  riding_end: string
  riding_days: number
  coaching_days: number
  price_small_group: number
  price_large_group: number
  size_small: number
  size_large: number
  deposit_ils: number
  balance_days_before: number
  rental_shop_name: string | null
  rental_shop_url: string | null
  rental_coupon: string | null
  insurance_agent: string | null
  insurance_phone: string | null
  includes: string[]
  notes: string | null
  hero_image: string | null
  gallery: string[]
  show_chalet_name: boolean
  rental_note: string | null
}

const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const BIKE_SIZES = ['S', 'M', 'L', 'XL']

const heDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

export default function TripRegistrationPage() {
  const params = useParams<{ slug: string }>()
  const search = useSearchParams()
  const key = search.get('k') ?? ''

  const [trip, setTrip] = useState<Trip | null>(null)
  const [registered, setRegistered] = useState(0)
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name_he: '',
    name_passport: '',
    birth_date: '',
    phone: '',
    email: '',
    passport_number: '',
    passport_expiry: '',
    shirt_size: '',
    wants_rental: false,
    rental_height_cm: '',
    rental_size: '',
    wants_insurance: false,
    dietary: '',
    notes: '',
    terms_accepted: false,
  })
  const [passportFile, setPassportFile] = useState<File | null>(null)

  useEffect(() => {
    if (!params?.slug) return
    fetch(`/api/trip/${params.slug}?k=${encodeURIComponent(key)}`)
      .then(async (r) => {
        if (r.status === 403 || r.status === 404) {
          setDenied(true)
          return null
        }
        return r.json()
      })
      .then((d) => {
        if (!d) return
        setTrip(d.trip)
        setRegistered(d.registered ?? 0)
        setCurrentPrice(d.currentPrice ?? null)
      })
      .catch(() => setDenied(true))
      .finally(() => setLoading(false))
  }, [params?.slug, key])

  const set = (k: string, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }))

  const missing = useMemo(() => {
    const m: string[] = []
    if (!form.name_he.trim()) m.push('שם בעברית')
    if (!form.name_passport.trim()) m.push('שם כמו בדרכון')
    if (!form.birth_date) m.push('תאריך לידה')
    if (!form.phone.trim()) m.push('טלפון')
    if (!form.passport_number.trim()) m.push('מספר דרכון')
    if (!form.passport_expiry) m.push('תוקף דרכון')
    if (!form.shirt_size) m.push('מידת חולצה')
    if (form.wants_rental && !form.rental_size) m.push('מידת אופניים')
    if (!form.terms_accepted) m.push('אישור תנאי הביטול')
    return m
  }, [form])

  // Passport must be valid 6 months past the return date
  const passportWarning = useMemo(() => {
    if (!form.passport_expiry || !trip) return null
    const exp = new Date(form.passport_expiry)
    const needed = new Date(trip.trip_end)
    needed.setMonth(needed.getMonth() + 6)
    return exp < needed
      ? `הדרכון חייב להיות בתוקף עד ${needed.toLocaleDateString('he-IL')} לפחות — שישה חודשים אחרי החזרה.`
      : null
  }, [form.passport_expiry, trip])

  async function submit() {
    if (missing.length) {
      setError(`חסר: ${missing.join(', ')}`)
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
      return
    }
    setSending(true)
    setError('')
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)))
      fd.append('slug', params.slug)
      fd.append('k', key)
      if (passportFile) fd.append('passport', passportFile)

      const res = await fetch('/api/trip/register', { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json())?.error || 'שגיאה בשליחה')
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא הצלחנו לשלוח. נסו שוב.')
    } finally {
      setSending(false)
    }
  }

  // ---------- states ----------
  if (loading)
    return (
      <Shell>
        <p className="text-stone-400">טוען…</p>
      </Shell>
    )

  if (denied || !trip)
    return (
      <Shell>
        <h1 className="font-display text-3xl mb-3">הקישור לא תקין</h1>
        <p className="text-stone-400 leading-relaxed">
          הדף הזה פתוח רק למי שקיבל קישור אישי. אם קיבלתם קישור ואתם רואים את
          ההודעה הזו, כתבו לבני ונשלח קישור חדש.
        </p>
      </Shell>
    )

  if (done)
    return (
      <Shell>
        <div className="border-r-2 border-brand pr-5">
          <h1 className="font-display text-4xl mb-4">נרשמת. </h1>
          <p className="text-lg text-stone-300 leading-relaxed mb-6">
            {form.name_he}, הפרטים שלך התקבלו.
          </p>
          <p className="text-stone-400 leading-relaxed">
            אשלח לך פרטי העברה למקדמה של ₪{trip.deposit_ils} בוואטסאפ. המקום
            נשמר ברגע שהמקדמה מתקבלת.
          </p>
        </div>
      </Shell>
    )

  // ---------- form ----------
  return (
    <Shell>
      {/* hero */}
      <header className="mb-14">
        {trip.hero_image && (
          <div className="relative -mx-6 sm:mx-0 mb-10 aspect-[3/2] sm:aspect-[16/9] overflow-hidden bg-panel">
            <img
              src={trip.hero_image}
              alt=""
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              style={{ filter: 'saturate(.85)' }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to top, var(--ink) 2%, rgba(14,28,23,.35) 45%, rgba(14,28,23,.15))',
              }}
            />
          </div>
        )}

        <p className="eyebrow">{trip.destination}</p>
        <h1 className="font-display text-5xl sm:text-6xl leading-none mb-4">
          {trip.title}
        </h1>
        {trip.subtitle && (
          <p className="text-stone-400 text-lg">{trip.subtitle}</p>
        )}

        <dl className="mt-10 grid grid-cols-3 border-t border-line">
          <Stat label="החופשה">
            {heDate(trip.trip_start)}
            <br />
            עד {heDate(trip.trip_end)}
          </Stat>
          <Stat label="ימי רכיבה">{trip.riding_days}</Stat>
          <Stat label="ימי הובלה מודרכים">{trip.coaching_days}</Stat>
        </dl>
      </header>

      {/* what's included */}
      <Section title="מה החופשה כוללת">
        <ul className="space-y-2">
          {trip.includes.map((item, i) => (
            <li key={i} className="flex gap-3 text-stone-200">
              <span className="text-brand shrink-0">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-stone-400 leading-relaxed">
          <strong className="text-stone-200">לא כולל:</strong> טיסות, אוכל (יש
          מטבח מאובזר בשאלה), ביטוח נסיעות, השכרת אופניים.
        </p>

        {trip.gallery?.length > 0 && (
          <div className="mt-10 -mx-6 sm:mx-0">
            <div className="grid grid-cols-3 gap-1.5">
              {trip.gallery.slice(0, 3).map((src, i) => (
                <div
                  key={i}
                  className="aspect-square overflow-hidden bg-panel"
                >
                  <img
                    src={src}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    style={{ filter: 'saturate(.85)' }}
                  />
                </div>
              ))}
            </div>
            <p className="px-6 sm:px-0 mt-3 text-xs text-stone-500">
              מתוך השאלה שהזמנו
            </p>
          </div>
        )}
      </Section>

      {/* price */}
      <Section title="המחיר">
        {(() => {
          const atLowerTier = registered > trip.size_small
          const toGo = trip.size_small + 1 - registered
          return (
            <>
              <div className="grid sm:grid-cols-2 gap-px bg-line border border-line">
                <PriceTier
                  price={Number(trip.price_small_group)}
                  label={`עד ${trip.size_small} נרשמים`}
                  active={!atLowerTier}
                />
                <PriceTier
                  price={Number(trip.price_large_group)}
                  label={`מ־${trip.size_small + 1} נרשמים ומעלה`}
                  active={atLowerTier}
                />
              </div>

              <div className="mt-6 border-r-2 border-brand pr-5">
                <p className="text-stone-100">
                  נרשמו עד עכשיו:{' '}
                  <strong className="text-brand">{registered}</strong>
                </p>
                <p className="text-stone-300 mt-1">
                  המחיר כרגע:{' '}
                  <strong className="text-brand">
                    €{(currentPrice ?? trip.price_small_group).toLocaleString()}
                  </strong>{' '}
                  לרוכב
                </p>
                {!atLowerTier && (
                  <p className="text-sm text-stone-400 mt-3 leading-relaxed">
                    {toGo === 1 ? 'עוד נרשם אחד' : `עוד ${toGo} נרשמים`} והמחיר
                    יורד ל־€{Number(trip.price_large_group).toLocaleString()}{' '}
                    <strong className="text-stone-200">לכולם</strong>, כולל מי
                    שכבר נרשם.
                  </p>
                )}
                {atLowerTier && (
                  <p className="text-sm text-stone-400 mt-3 leading-relaxed">
                    הגענו למחיר המוזל. הוא חל על כל הנרשמים, כולל הראשונים.
                  </p>
                )}
              </div>
            </>
          )
        })()}

        <p className="mt-5 text-sm text-stone-400 leading-relaxed">
          השאלה נשכרת במחיר קבוע לשבוע, לא לפי מספר אנשים — לכן ככל שנהיה יותר,
          זול יותר לכל אחד. המחיר הסופי ייקבע במועד התשלום המלא לפי מספר
          המשתתפים בפועל.
        </p>

        <div className="mt-8 border-r-2 border-brand pr-5 space-y-2">
          <p className="text-stone-200">
            <strong>₪{trip.deposit_ils}</strong> מקדמה בהרשמה — שומרת את המקום
          </p>
          <p className="text-stone-200">
            <strong>היתרה</strong> עד {trip.balance_days_before} יום לפני היציאה
          </p>
        </div>
      </Section>

      {/* the form */}
      <Section title="הרשמה">
        <div className="space-y-8">
          <Field
            label="שם מלא בעברית"
            value={form.name_he}
            onChange={(v) => set('name_he', v)}
            required
          />
          <Field
            label="שם כמו שכתוב בדרכון"
            hint="באנגלית, בדיוק כמו בדרכון — כך נזמין את הטיסה"
            value={form.name_passport}
            onChange={(v) => set('name_passport', v)}
            dir="ltr"
            required
          />
          <div className="grid sm:grid-cols-2 gap-8">
            <Field
              label="תאריך לידה"
              type="date"
              value={form.birth_date}
              onChange={(v) => set('birth_date', v)}
              required
            />
            <Field
              label="טלפון"
              type="tel"
              value={form.phone}
              onChange={(v) => set('phone', v)}
              required
            />
          </div>
          <Field
            label="אימייל"
            type="email"
            value={form.email}
            onChange={(v) => set('email', v)}
            dir="ltr"
          />

          <Divider>דרכון</Divider>

          <div className="grid sm:grid-cols-2 gap-8">
            <Field
              label="מספר דרכון"
              value={form.passport_number}
              onChange={(v) => set('passport_number', v)}
              dir="ltr"
              required
            />
            <Field
              label="תוקף דרכון"
              type="date"
              value={form.passport_expiry}
              onChange={(v) => set('passport_expiry', v)}
              required
            />
          </div>

          {passportWarning && (
            <p className="text-amber-400 text-sm border-r-2 border-amber-400 pr-4">
              {passportWarning}
            </p>
          )}

          <div>
            <label className="block mb-2 text-sm text-stone-300">
              צילום הדרכון
            </label>
            <p className="text-xs text-stone-500 mb-3">
              עמוד הפרטים בלבד. נשמר מוצפן ומשמש רק להזמנת הטיסה.
            </p>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setPassportFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-stone-400
                file:ml-4 file:py-2.5 file:px-5 file:border file:border-line
                file:bg-transparent file:text-brand file:text-sm
                hover:file:border-brand file:cursor-pointer cursor-pointer"
            />
          </div>

          <Divider>ציוד</Divider>

          <div>
            <label className="block mb-3 text-sm text-stone-300">
              מידת חולצה <span className="text-brand">*</span>
            </label>
            <Choices
              options={SHIRT_SIZES}
              value={form.shirt_size}
              onChange={(v) => set('shirt_size', v)}
            />
          </div>

          <Toggle
            checked={form.wants_rental}
            onChange={(v) => set('wants_rental', v)}
            label="אני רוצה לשכור אופניים במורזין"
          />

          {form.wants_rental && (
            <div className="border-r-2 border-line pr-5 space-y-6">
              <div className="grid sm:grid-cols-2 gap-8">
                <Field
                  label="גובה בס״מ"
                  type="number"
                  value={form.rental_height_cm}
                  onChange={(v) => set('rental_height_cm', v)}
                />
                <div>
                  <label className="block mb-3 text-sm text-stone-300">
                    מידת אופניים <span className="text-brand">*</span>
                  </label>
                  <Choices
                    options={BIKE_SIZES}
                    value={form.rental_size}
                    onChange={(v) => set('rental_size', v)}
                  />
                </div>
              </div>

            </div>
          )}

          {trip.rental_shop_name && (
            <div className="bg-panel border border-line p-6">
              <p className="text-sm text-stone-300 leading-relaxed">
                אנחנו עובדים עם{' '}
                <strong className="text-stone-100">
                  {trip.rental_shop_name}
                </strong>{' '}
                במורזין. ההזמנה נעשית ישירות מולם, עם קוד הנחה של טבע בייק.
              </p>

              {trip.rental_coupon && (
                <div className="mt-5 border border-brand p-4 text-center">
                  <p className="text-[10px] tracking-[.16em] text-stone-400 mb-2">
                    קוד ההנחה שלכם
                  </p>
                  <p className="font-mono text-brand tracking-[.2em] text-xl">
                    {trip.rental_coupon}
                  </p>
                </div>
              )}

              {trip.rental_note && (
                <p className="text-sm text-stone-400 mt-5 leading-relaxed">
                  {trip.rental_note}
                </p>
              )}

              {trip.rental_shop_url && (
                <a
                  href={trip.rental_shop_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-5 border border-brand text-brand
                    px-6 py-3 text-sm transition-colors hover:bg-brand hover:text-ink
                    focus-visible:outline focus-visible:outline-2
                    focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  להזמנת אופניים ←
                </a>
              )}

              <p className="text-xs text-stone-500 mt-5 leading-relaxed">
                השכרת האופניים אינה חלק מהחבילה. ההתקשרות והתשלום הם בינך לבין
                החנות.
              </p>
            </div>
          )}

          <Divider>ביטוח</Divider>

          <div className="bg-panel border border-line p-5">
            <p className="text-sm text-stone-300 leading-relaxed">
              <strong className="text-stone-100">ביטוח הוא חובה.</strong> רכיבת
              הרים דורשת פוליסה לספורט אתגרי הכוללת חילוץ אווירי, הטסה רפואית,
              אשפוז וניתוחים. רכישת הביטוח באחריותך.
            </p>
            {trip.insurance_agent && (
              <p className="text-sm text-stone-400 mt-4">
                סוכן הביטוח שלנו: {trip.insurance_agent} ·{' '}
                <a
                  href={`tel:${trip.insurance_phone}`}
                  className="text-brand"
                  dir="ltr"
                >
                  {trip.insurance_phone}
                </a>
              </p>
            )}
          </div>

          <Toggle
            checked={form.wants_insurance}
            onChange={(v) => set('wants_insurance', v)}
            label="אשמח שתיצרו קשר בנוגע לביטוח"
          />

          <Divider>עוד משהו</Divider>

          <Field
            label="הגבלות תזונה או אלרגיות"
            value={form.dietary}
            onChange={(v) => set('dietary', v)}
          />
          <Field
            label="הערות"
            hint="עם מי תרצה לחלוק חדר, בעיה רפואית שכדאי שאדע עליה, כל דבר אחר"
            value={form.notes}
            onChange={(v) => set('notes', v)}
            textarea
          />
        </div>
      </Section>

      {/* terms */}
      <Section title="תנאי ביטול">
        <div className="text-sm text-stone-400 leading-relaxed space-y-4 max-h-72 overflow-y-auto border border-line p-5 bg-panel">
          <p>
            דמי ביטול ייכנסו לתוקף עם קבלת הודעת ביטול בכתב מאת הלקוח למייל
            bennyfire@gmail.com. באחריות הלקוח לוודא שההודעה הגיעה ליעדה ולקבל
            אישור בכתב.
          </p>
          <ul className="space-y-1.5">
            <li>64–49 ימים לפני היציאה — 50% מעלות החבילה</li>
            <li>48–29 ימים לפני היציאה — 65%</li>
            <li>28–15 ימים לפני היציאה — 75%</li>
            <li>14–8 ימים לפני היציאה — 85%</li>
            <li>7 ימים ועד ליום היציאה — 100%</li>
          </ul>
          <p className="text-stone-300">
            בשל הנסיבות הביטחוניות בישראל ואפשרות ביטול מיידית של מרכיבי החבילה
            על ידי הספקים, יחולו דמי הביטול הבאים:
          </p>
          <ul className="space-y-1.5">
            <li>ממועד ההזמנה ועד 38 יום לפני היציאה — 70%</li>
            <li>37–8 ימים לפני היציאה — 85%</li>
            <li>7 ימים ועד ליום היציאה — 100%</li>
          </ul>
          <p>
            שינוי שם ניתן עד 7 ימים לפני היציאה, בעלות שתיגבה על ידי חברת התעופה
            והספקים, בתוספת ₪100 דמי טיפול, ובתנאי שהנוסע המחליף נכנס לנעליו של
            המבטל בכל מרכיבי החופשה.
          </p>
          <p>
            ביטול מרכיב בודד (הסעות, בייק פאס וכו׳) יחויב בנפרד: עד 60 יום — 25%
            מהמרכיב, 30–60 יום — 50%, פחות מ־30 יום — 100%. מכל זיכוי יופחתו ₪50
            דמי טיפול.
          </p>
          <p>
            איחור בהגעה, עזיבה מוקדמת או פציעה אינם מזכים בהחזר. אובדן ימי רכיבה
            בשל עיכובי טיסות או מזג אוויר אינו מזכה בהחזר.
          </p>
          <p>
            רכיבת אופני הרים כרוכה בסיכון, עד כדי סיכון חיים. באחריות הרוכב
            לוודא שאין לו מגבלה רפואית. טבע בייק ובני להט אינם נושאים באחריות
            לפגיעה בגוף, בנפש או ברכוש.
          </p>
        </div>

        <div className="mt-6">
          <Toggle
            checked={form.terms_accepted}
            onChange={(v) => set('terms_accepted', v)}
            label="קראתי את תנאי הביטול ואני מאשר/ת אותם"
          />
        </div>
      </Section>

      {/* submit */}
      <div className="mt-14 pt-10 border-t border-line">
        {error && (
          <p className="mb-5 text-amber-400 text-sm border-r-2 border-amber-400 pr-4">
            {error}
          </p>
        )}
        <button
          onClick={submit}
          disabled={sending}
          className="w-full sm:w-auto bg-brand text-ink font-medium tracking-wide
            px-12 py-4 border border-brand transition-colors
            hover:bg-transparent hover:text-brand
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-brand
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? 'שולח…' : 'שולח/ת הרשמה'}
        </button>
        <p className="mt-5 text-sm text-stone-500 leading-relaxed">
          אחרי השליחה אשלח פרטי העברה למקדמה של ₪{trip.deposit_ils}. המקום נשמר
          ברגע שהמקדמה מתקבלת.
        </p>
      </div>
    </Shell>
  )
}

// ============================================================
// building blocks
// ============================================================

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-ink text-stone-100">
      <style>{`
        :root{
          --brand:#F0C419;
          --ink:#0E1C17;
          --panel:#16261F;
          --line:#2C4A3C;
        }
        .bg-ink{background:var(--ink)}
        .bg-panel{background:var(--panel)}
        .bg-brand{background:var(--brand)}
        .text-brand{color:var(--brand)}
        .text-ink{color:var(--ink)}
        .border-brand{border-color:var(--brand)}
        .border-line{border-color:var(--line)}
        .font-display{
          font-family:'Suez One',Georgia,serif;
          font-weight:400;letter-spacing:-.01em;
        }
        .eyebrow{
          font-size:11px;font-weight:600;letter-spacing:.22em;
          color:var(--brand);margin-bottom:14px;
        }
        input,textarea{color-scheme:dark}
        @media (prefers-reduced-motion:reduce){
          *{transition:none!important;animation:none!important}
        }
      `}</style>
      <link
        href="https://fonts.googleapis.com/css2?family=Suez+One&family=Assistant:wght@300;400;600&display=swap"
        rel="stylesheet"
      />
      <main
        className="max-w-2xl mx-auto px-6 py-16 sm:py-24"
        style={{ fontFamily: 'Assistant, system-ui, sans-serif' }}
      >
        {children}
      </main>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-16">
      <h2 className="font-display text-2xl mb-7">{title}</h2>
      {children}
    </section>
  )
}

function Stat({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="py-4 pl-4 border-l border-line last:border-l-0">
      <dt className="text-[10px] tracking-[.13em] text-stone-500 mb-1.5">
        {label}
      </dt>
      <dd className="text-sm text-stone-100 leading-snug">{children}</dd>
    </div>
  )
}

function PriceTier({
  price,
  label,
  active,
}: {
  price: number
  label: string
  active: boolean
}) {
  return (
    <div className={`p-7 relative ${active ? 'bg-panel' : 'bg-ink'}`}>
      {active && (
        <span className="absolute top-4 left-4 text-[9px] tracking-[.16em] text-brand border border-brand px-2 py-0.5">
          המחיר כרגע
        </span>
      )}
      <p className="text-[10px] tracking-[.13em] text-stone-500 mb-3">{label}</p>
      <p
        className={`font-display text-4xl ${
          active ? 'text-brand' : 'text-stone-600'
        }`}
      >
        €{price.toLocaleString()}
      </p>
    </div>
  )
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 pt-4">
      <span className="text-[10px] tracking-[.22em] text-brand shrink-0">
        {children}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

function Field({
  label,
  hint,
  value,
  onChange,
  type = 'text',
  dir,
  required,
  textarea,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  type?: string
  dir?: string
  required?: boolean
  textarea?: boolean
}) {
  const cls = `w-full bg-transparent border-b border-line py-2.5
    text-stone-100 placeholder-stone-600 outline-none
    focus:border-brand transition-colors`
  return (
    <div>
      <label className="block mb-1.5 text-sm text-stone-300">
        {label} {required && <span className="text-brand">*</span>}
      </label>
      {hint && <p className="text-xs text-stone-500 mb-2">{hint}</p>}
      {textarea ? (
        <textarea
          rows={3}
          value={value}
          dir={dir}
          onChange={(e) => onChange(e.target.value)}
          className={cls + ' resize-none'}
        />
      ) : (
        <input
          type={type}
          value={value}
          dir={dir}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      )}
    </div>
  )
}

function Choices({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`px-5 py-2.5 border text-sm transition-colors
            focus-visible:outline focus-visible:outline-2
            focus-visible:outline-offset-2 focus-visible:outline-brand
            ${
              value === o
                ? 'border-brand text-brand bg-panel'
                : 'border-line text-stone-400 hover:border-stone-500'
            }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <span
        className="mt-0.5 w-5 h-5 border border-line shrink-0 grid place-items-center
          transition-colors peer-checked:border-brand peer-checked:bg-brand
          peer-focus-visible:outline peer-focus-visible:outline-2
          peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand
          group-hover:border-stone-500"
      >
        {checked && (
          <svg
            viewBox="0 0 12 12"
            className="w-3 h-3"
            fill="none"
            stroke="#0E1C17"
            strokeWidth="2.5"
          >
            <path d="M2 6.5L4.5 9L10 3" />
          </svg>
        )}
      </span>
      <span className="text-sm text-stone-200 leading-snug">{label}</span>
    </label>
  )
}
