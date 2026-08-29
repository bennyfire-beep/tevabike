'use client'

import { useState, useEffect } from 'react'
import { WHATSAPP_OPTIN_LABEL } from '@/lib/whatsapp-optin'

const MATNAS_URL = 'https://www.matnasmatteasher.org.il/%D7%9E%D7%97%D7%9C%D7%A7%D7%AA-%D7%A1%D7%A4%D7%95%D7%A8%D7%98/'

// המבצע יורד אוטומטית ב-1 בספטמבר 2026
const PROMO_ENDS = new Date('2026-09-01T00:00:00+03:00')
const promoActive = () => new Date() < PROMO_ENDS

const BRANCHES = [
  { value: 'משגב', label: 'משגב', day: 'ראשון וחמישי 15:30–17:00' },
  { value: 'ביריה', label: 'ביריה', day: 'שני 15:45–17:15' },
  { value: 'מטה אשר', label: 'מטה אשר', day: 'שלישי', external: true },
  { value: 'פרוד-אמירים', label: 'פרוד-אמירים', day: 'רביעי 15:45–17:00' },
  { value: 'אחר', label: 'אחר', day: '' },
]

// Summer 2026 tracks. Friday (יומועדון) is cancelled, so the only remaining
// membership_plan value is 'center' — the track is what varies now.
const TRACKS = [
  {
    value: 'once_weekly',
    title: 'פעם בשבוע',
    price: 300,
    desc: 'אימון קבוע אחד בשבוע — בוחרים ראשון או חמישי',
  },
  {
    value: 'twice_weekly',
    title: 'פעמיים בשבוע',
    price: 550,
    desc: 'ראשון וגם חמישי — אימון כפול בשבוע',
    best: true,
  },
]

// 0 = Sunday .. 6 = Saturday, matching groups.days_of_week in Supabase.
const TRACK_DAYS = [
  { value: '0', label: "יום ראשון" },
  { value: '4', label: "יום חמישי" },
]

export default function RegisterPage() {
  const [type, setType] = useState<'' | 'kids' | 'adults'>('')
  const [form, setForm] = useState({
    child_name: '',
    child_age: '',
    branch: '',
    city: '',
    class_type: '',
    membership_plan: '',
    track: '',
    chosen_day: '',
    full_name: '',
    phone: '',
    email: '',
    notes: '',
  })
  const [whatsappOptin, setWhatsappOptin] = useState(false)
  const [utm, setUtm] = useState<{ utm_source?: string; utm_medium?: string; utm_campaign?: string }>({})

  // Capture campaign tags from the landing URL and keep them for the session,
  // so a registration can be traced back to the ad that produced it even if
  // the visitor browsed a few pages before signing up.
  useEffect(() => {
    const KEY = 'tb_utm'
    try {
      const q = new URLSearchParams(window.location.search)
      const fresh = {
        utm_source:   q.get('utm_source')   || undefined,
        utm_medium:   q.get('utm_medium')   || undefined,
        utm_campaign: q.get('utm_campaign') || undefined,
      }
      if (fresh.utm_source || fresh.utm_medium || fresh.utm_campaign) {
        sessionStorage.setItem(KEY, JSON.stringify(fresh))
        setUtm(fresh)
        return
      }
      const saved = sessionStorage.getItem(KEY)
      if (saved) setUtm(JSON.parse(saved))
    } catch {
      // storage blocked (private browsing) — tracking is optional, carry on
    }
  }, [])

  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const isKids = type === 'kids'
  const isMatteAsher = form.branch === 'מטה אשר'
  const promo = promoActive()

  async function submit() {
    setError('')
    const missing = isKids
      ? !form.child_name || !form.full_name || !form.phone || !form.branch || !form.city
      : !form.full_name || !form.phone || !form.branch || !form.city

    if (missing) {
      setError(
        isKids
          ? 'חסרים שדות חובה: שם הילד, יישוב, סניף, שם ההורה וטלפון'
          : 'חסרים שדות חובה: שם מלא, יישוב, סניף וטלפון'
      )
      return
    }
    if (isKids && !form.track) {
      setError('בחרו מסלול הרשמה')
      return
    }
    if (isKids && form.track === 'once_weekly' && !form.chosen_day) {
      setError('בחרו יום קבוע — ראשון או חמישי')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          // Friday is cancelled, so every kids registration is a plain branch
          // membership; the track is what carries the price distinction now.
          membership_plan: isKids ? 'center' : form.membership_plan || null,
          // A twice-weekly student attends both days, so no single chosen day.
          chosen_day: form.track === 'twice_weekly' ? null : form.chosen_day || null,
          amount_monthly: TRACKS.find((t) => t.value === form.track)?.price ?? null,
          registration_type: type,
          promo_code: promo ? 'BOOST5' : null,
          whatsapp_optin: whatsappOptin,
          ...utm,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה בשליחה')
      setDone(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <div dir="rtl" className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="text-5xl">🚵</div>
          <h1 className="text-2xl font-bold text-lime-400">ההרשמה נקלטה</h1>
          <p className="text-stone-300 leading-relaxed">
            תודה! נבדוק את הפרטים, נשבץ לקבוצה המתאימה ונשלח קישור
            לתשלום והצטרפות לאפליקציית טבע בייק.
          </p>
          <p className="text-sm text-stone-500">בדרך כלל תוך יום עסקים אחד.</p>
          <a href="/" className="inline-block mt-4 text-lime-400 underline">חזרה לאתר</a>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen bg-stone-950 text-stone-100 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <header className="mb-6">
          <p className="text-lime-400 text-sm tracking-widest mb-2">טבע בייק · שנת פעילות</p>
          <h1 className="text-3xl font-bold">הרשמה לקבוצות</h1>
        </header>

        {promo && (
          <div className="bg-gradient-to-l from-fuchsia-900/60 to-purple-900/40 border border-fuchsia-600 rounded-xl p-4 mb-6">
            <p className="font-bold text-fuchsia-200">⚡ בוסט הרשמה — 5% הנחה</p>
            <p className="text-sm text-fuchsia-100/80 mt-1">
              לחברים קיימים ולמצטרפים חדשים. ההנחה תקפה להרשמות עד 31.8 ותחושב בקישור התשלום.
            </p>
          </div>
        )}

        {/* בחירת סוג הרשמה */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setType('kids')}
            className={`p-5 rounded-xl border text-right transition ${
              type === 'kids' ? 'bg-lime-400 text-stone-950 border-lime-400' : 'bg-stone-900 border-stone-700 hover:border-stone-500'
            }`}
          >
            <div className="text-2xl mb-1">🧒</div>
            <div className="font-bold">ילדים ונוער</div>
            <div className={`text-xs mt-0.5 ${type === 'kids' ? 'text-stone-800' : 'text-stone-500'}`}>הורה רושם את הילד</div>
          </button>
          <button
            type="button"
            onClick={() => setType('adults')}
            className={`p-5 rounded-xl border text-right transition ${
              type === 'adults' ? 'bg-lime-400 text-stone-950 border-lime-400' : 'bg-stone-900 border-stone-700 hover:border-stone-500'
            }`}
          >
            <div className="text-2xl mb-1">🚴</div>
            <div className="font-bold">מבוגרים</div>
            <div className={`text-xs mt-0.5 ${type === 'adults' ? 'text-stone-800' : 'text-stone-500'}`}>רושם את עצמי</div>
          </button>
        </div>

        {!type ? (
          <p className="text-center text-stone-500 text-sm">בחרו סוג הרשמה כדי להמשיך</p>
        ) : (
          <div className="space-y-5">
            <Section title={isKids ? 'הרוכב' : 'הפרטים שלך'}>
              {isKids && <Field label="שם מלא של הילד/ה *" value={form.child_name} onChange={(v) => set('child_name', v)} />}
              {!isKids && <Field label="שם מלא *" value={form.full_name} onChange={(v) => set('full_name', v)} />}
              <Field label="גיל" type="number" value={form.child_age} onChange={(v) => set('child_age', v)} />
              <Field label="יישוב מגורים *" value={form.city} onChange={(v) => set('city', v)} placeholder="למשל: שכניה, נהריה, צפת" />
            </Section>

            <Section title="הסניף">
              <div>
                <label className="block text-sm text-stone-400 mb-1.5">איפה נוח לכם להתאמן? *</label>
                <div className="grid grid-cols-2 gap-2">
                  {BRANCHES.map((b) => (
                    <button
                      key={b.value}
                      type="button"
                      onClick={() => set('branch', b.value)}
                      className={`py-3 px-2 rounded-lg border text-sm transition ${
                        form.branch === b.value
                          ? 'bg-lime-400 text-stone-950 border-lime-400 font-semibold'
                          : 'bg-stone-900 border-stone-700 text-stone-300 hover:border-stone-500'
                      }`}
                    >
                      <div>{b.label}</div>
                      {b.day && (
                        <div className={`text-[11px] mt-0.5 ${form.branch === b.value ? 'text-stone-700' : 'text-stone-500'}`}>
                          {b.day}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </Section>

            {/* מטה אשר – מעבר ישיר לאתר המתנ"ס */}
            {isMatteAsher ? (
              <a
                href={MATNAS_URL}
                target="_blank"
                rel="noreferrer"
                className="block text-center bg-lime-400 text-stone-950 font-bold py-4 rounded-xl text-lg"
              >
                להרשמה במטה אשר ←
              </a>
            ) : (
              <>
                {isKids && (
                  <Section title="מסלול הרשמה">
                    <div className="space-y-2">
                      {TRACKS.map((p) => {
                        const selected = form.track === p.value
                        return (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => {
                              set('track', p.value)
                              if (p.value === 'twice_weekly') set('chosen_day', '')
                            }}
                            className={`w-full text-right p-4 rounded-lg border transition ${
                              selected
                                ? 'bg-lime-400 text-stone-950 border-lime-400'
                                : 'bg-stone-950 border-stone-700 hover:border-stone-500'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-3">
                              <div>
                                <div className="font-bold flex items-center gap-2">
                                  {p.title}
                                  {p.best && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${selected ? 'bg-stone-900 text-lime-300' : 'bg-lime-400 text-stone-950'}`}>
                                      הכי משתלם
                                    </span>
                                  )}
                                </div>
                                <div className={`text-xs mt-1 ${selected ? 'text-stone-700' : 'text-stone-400'}`}>{p.desc}</div>
                              </div>
                              <div className="text-left whitespace-nowrap">
                                <div className="font-bold text-lg">₪{p.price}</div>
                                <div className={`text-[11px] ${selected ? 'text-stone-700' : 'text-stone-500'}`}>לחודש</div>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Once-weekly students commit to one fixed day. */}
                    {form.track === 'once_weekly' && (
                      <div className="pt-1">
                        <div className="text-xs text-stone-400 mb-2">איזה יום? *</div>
                        <div className="grid grid-cols-2 gap-2">
                          {TRACK_DAYS.map((d) => {
                            const selected = form.chosen_day === d.value
                            return (
                              <button
                                key={d.value}
                                type="button"
                                onClick={() => set('chosen_day', d.value)}
                                className={`p-3 rounded-lg border text-sm font-bold transition ${
                                  selected
                                    ? 'bg-lime-400 text-stone-950 border-lime-400'
                                    : 'bg-stone-950 border-stone-700 hover:border-stone-500'
                                }`}
                              >
                                {d.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-stone-500 leading-relaxed">
                      החוגים במשגב מתקיימים בימים ראשון וחמישי, 15:30–17:00.
                      במסלול פעם בשבוע בוחרים יום קבוע אחד ונשארים איתו לאורך השנה.
                    </p>
                  </Section>
                )}

                <Section title="ניסיון">
                  <Field
                    label="ניסיון קודם ברכיבה"
                    value={form.class_type}
                    onChange={(v) => set('class_type', v)}
                    placeholder="מתחיל / רכב שנה / מתקדם"
                  />
                </Section>

                <Section title={isKids ? 'ההורה' : 'יצירת קשר'}>
                  {isKids && <Field label="שם ההורה *" value={form.full_name} onChange={(v) => set('full_name', v)} />}
                  <Field label="טלפון *" type="tel" value={form.phone} onChange={(v) => set('phone', v)} />
                  <Field label="אימייל" type="email" value={form.email} onChange={(v) => set('email', v)} />
                </Section>

                <Section title="הערות">
                  <Field
                    label="בריאות, אלרגיות או כל דבר שכדאי שנדע"
                    value={form.notes}
                    onChange={(v) => set('notes', v)}
                    textarea
                  />
                </Section>

                <label className="flex items-start gap-2.5 cursor-pointer text-sm text-stone-300 select-none">
                  <input
                    type="checkbox"
                    checked={whatsappOptin}
                    onChange={(e) => setWhatsappOptin(e.target.checked)}
                    className="mt-0.5 w-[18px] h-[18px] accent-lime-400 cursor-pointer shrink-0"
                  />
                  <span>{WHATSAPP_OPTIN_LABEL}</span>
                </label>

                {error && <div className="bg-red-950 border border-red-800 text-red-200 rounded-lg p-3 text-sm">{error}</div>}

                <button
                  onClick={submit}
                  disabled={sending}
                  className="w-full bg-lime-400 text-stone-950 font-bold py-4 rounded-xl text-lg disabled:opacity-50 hover:bg-lime-300 transition"
                >
                  {sending ? 'שולח…' : 'שליחת הרשמה'}
                </button>

                <p className="text-xs text-stone-500 text-center">
                  שליחת הטופס אינה מהווה תשלום. קישור התשלום יישלח לאחר שיבוץ לקבוצה.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-5 space-y-4">
      <h2 className="text-lime-400 font-semibold text-sm">{title}</h2>
      {children}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  textarea,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  textarea?: boolean
}) {
  const cls =
    'w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-3 text-stone-100 placeholder-stone-600 focus:border-lime-400 focus:outline-none'
  return (
    <div>
      <label className="block text-sm text-stone-400 mb-1.5">{label}</label>
      {textarea ? (
        <textarea rows={3} className={cls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type={type} className={cls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}
