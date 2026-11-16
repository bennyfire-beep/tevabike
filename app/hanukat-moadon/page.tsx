'use client'

import { useEffect, useState } from 'react'
import { WHATSAPP_OPTIN_LABEL } from '@/lib/whatsapp-optin'
import {
  EVENT_DATE_LABEL, LOCATION, CLUB_LOCATION, FLYER_SRC, SCHEDULE, PARTICIPATION, GROUPS, FOOD, MAX_RIDERS, MAX_ATTENDEES,
} from '@/lib/club-opening'

// ============================================================
// הרשמה לחנוכת המועדון — הגדרות ב-lib/club-opening.ts
// נתיב: app/hanukat-moadon/page.tsx · API: app/api/club-opening/route.ts
// ============================================================

const PINK = '#D4288A'
const LIME = '#b5e853'

type Stats = { families: number; people: number; riders: number; food: Record<string, number> }

export default function HanukatMoadonPage() {
  const [form, setForm] = useState({ contact_name: '', phone: '', group_name: '', participation: '', rider_names: '', bringing_other: '', notes: '' })
  const [ridersCount, setRidersCount] = useState(1)
  const [attendees, setAttendees] = useState(2)
  const [bringing, setBringing] = useState<string[]>([])
  const [whatsappOptin, setWhatsappOptin] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ name: string; attendees: number; activity: boolean } | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const isActivity = form.participation === 'activity'

  const loadStats = () =>
    fetch('/api/club-opening', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})

  useEffect(() => { loadStats() }, [])

  const toggleFood = (v: string) =>
    setBringing((b) => (b.includes(v) ? b.filter((x) => x !== v) : [...b, v]))

  async function submit() {
    setError('')
    if (!form.contact_name.trim()) return setError('חסר שם')
    if (form.phone.replace(/\D/g, '').length < 9) return setError('מספר טלפון לא תקין')
    if (!form.group_name) return setError('יש לבחור קבוצה')
    if (!form.participation) return setError('יש לבחור למה מגיעים')
    if (isActivity && !form.rider_names.trim()) return setError('כתבו את שמות הרוכבים שמשתתפים בתחרות')
    if (isActivity && attendees < ridersCount) return setError('מספר המגיעים לא יכול להיות קטן ממספר הרוכבים')

    setSending(true)
    try {
      const res = await fetch('/api/club-opening', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          riders_count: isActivity ? ridersCount : 0,
          attendees,
          bringing,
          whatsapp_optin: whatsappOptin,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'לא הצלחנו לשלוח. נסו שוב.')
        return
      }
      setDone({ name: form.contact_name, attendees, activity: isActivity })
      loadStats()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setError('לא הצלחנו לשלוח. בדקו את החיבור ונסו שוב.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-stone-950 text-stone-100">
      <div className="max-w-lg mx-auto">
        {/* hero */}
        <header
          className="px-6 pt-10 pb-9"
          style={{ background: 'linear-gradient(160deg,#0C1814 0%, #152A1E 50%, #2E1224 100%)' }}
        >
          <p className="text-xs font-bold tracking-[.14em] mb-2" style={{ color: LIME }}>
            טבע בייק · {EVENT_DATE_LABEL}
          </p>
          <h1 className="text-4xl font-extrabold mb-3 leading-tight">
            חנוכת המועדון 🎉
            <span className="block text-2xl mt-1" style={{ color: PINK }}>כל טבע בייק — ביחד!</span>
          </h1>
          <p className="text-stone-300 text-[15px] leading-relaxed mb-5">
            אחרי חודשים של עבודה — הבית החדש של טבע בייק מוכן! בואו לחגוג איתנו בבוקר של רכיבה, צחוקים, אוכל טוב
            וכל המשפחה. ילדים, הורים, מבוגרים — כל הקבוצות מוזמנות 💜
          </p>
          <ul className="flex flex-wrap gap-2 text-sm">
            <li className="bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5">📅 {EVENT_DATE_LABEL}</li>
            <li className="bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5">⏰ 08:00</li>
            <li className="bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5">📍 {LOCATION} ← המועדון ברקפת</li>
          </ul>
          {stats && stats.families > 0 && (
            <p className="mt-5 text-sm font-semibold" style={{ color: LIME }}>
              🔥 כבר {stats.people} נרשמו{stats.riders > 0 ? ` · ${stats.riders} רוכבים בתחרות` : ''} — אל תישארו בחוץ!
            </p>
          )}
        </header>

        {/* flyer */}
        <img
          src={FLYER_SRC}
          alt="חוגגים חנוכה — חנוכת מועדון טבע בייק: מיני בייק, מסלול מדידת זמנים לפי קטגוריות לילדים ולמבוגרים"
          width={1024}
          height={1536}
          className="w-full h-auto block"
        />

        <main className="px-5 py-7 space-y-6">
          {/* schedule */}
          <section>
            <h2 className="text-lg font-bold mb-3">🗓️ התוכנית</h2>
            <ol className="space-y-2">
              {SCHEDULE.map((s) => (
                <li key={s.time} className="flex items-center gap-3 bg-stone-900 rounded-lg px-4 py-3 text-sm">
                  <span className="text-xl">{s.emoji}</span>
                  <span className="font-semibold flex-1">{s.label}</span>
                  <span className="font-bold whitespace-nowrap" dir="ltr" style={{ color: PINK }}>
                    {s.time}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <div className="bg-stone-900 rounded-xl p-4 space-y-3 text-[14.5px] text-stone-300 leading-relaxed">
            <p>
              🚲 <b className="text-stone-100">מיני בייק • כיף גדול</b> — תחרות היתולית על אופני 20 אינץ׳, גם הגדולים!
              מסלול מדידת זמנים לפי קטגוריות, לילדים ולמבוגרים. לא צריך להיות אלוף כדי לנצח.
            </p>
            <p>
              ⛰️ ב-10:30 נטפס יחד למעלה אל {CLUB_LOCATION}, נגזור סרט ונחנוך את הבית החדש עם כיבוד משותף. חוגגים חנוכה! 🕎
            </p>
            <p>
              🥐 <b className="text-stone-100">כל אחד מביא משהו קטן</b> — מאפים, ירקות, פיתות ולבנה, חומוס או שתייה קלה.
              בחרו בטופס מה תביאו, כדי שיהיה מכל דבר.
            </p>
            <p className="font-semibold" style={{ color: LIME }}>
              ⚠️ ההרשמה חובה — גם אם מגיעים רק לכיבוד — כדי שנדע לתכנן אופניים, אוכל ומקום.
            </p>
          </div>

          {done ? (
            <section className="text-center space-y-4 py-4 bg-stone-900 rounded-xl px-4">
              <div className="text-5xl">🎉</div>
              <h2 className="text-2xl font-bold">נרשמתם! מתרגשים לראות אתכם</h2>
              <p className="text-stone-300">
                {done.name} · {done.attendees === 1 ? 'מגיע/ה לבד' : `${done.attendees} מגיעים`}
              </p>
              <p className="text-stone-400 text-sm">
                {done.activity ? `${EVENT_DATE_LABEL} · התכנסות 08:00 ב${LOCATION}, זינוקים 08:30` : `${EVENT_DATE_LABEL} · 10:30 ב${CLUB_LOCATION}`}
              </p>
              <p className="text-lg font-bold" style={{ color: PINK }}>
                שתפו את הקישור בקבוצה — ככה נהיה הכי הרבה! 🚵‍♀️✨
              </p>
            </section>
          ) : (
            <section className="space-y-5">
              <h2 className="text-lg font-bold">📝 הרשמה</h2>
              <Field label="שם מלא *" value={form.contact_name} onChange={(v) => set('contact_name', v)} />
              <Field label="טלפון *" type="tel" value={form.phone} onChange={(v) => set('phone', v)} />

              <div>
                <label className="block text-sm text-stone-400 mb-1.5">מאיזו קבוצה? *</label>
                <div className="grid grid-cols-2 gap-2">
                  {GROUPS.map((g) => (
                    <Pill key={g} active={form.group_name === g} onClick={() => set('group_name', g)}>
                      {g}
                    </Pill>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-stone-400 mb-1.5">למה מגיעים? *</label>
                <div className="grid gap-2">
                  {PARTICIPATION.map((p) => (
                    <Pill key={p.value} active={form.participation === p.value} onClick={() => set('participation', p.value)}>
                      <span className="block">{p.label}</span>
                      <span className="block text-xs font-normal opacity-80 mt-0.5">{p.sub}</span>
                    </Pill>
                  ))}
                </div>
              </div>

              {isActivity && (
                <>
                  <div>
                    <label className="block text-sm text-stone-400 mb-1.5">כמה רוכבים משתתפים בתחרות? *</label>
                    <div className="grid grid-cols-6 gap-2">
                      {Array.from({ length: MAX_RIDERS }, (_, i) => i + 1).map((n) => (
                        <Pill key={n} active={ridersCount === n} onClick={() => { setRidersCount(n); if (attendees < n) setAttendees(n) }}>
                          {n}
                        </Pill>
                      ))}
                    </div>
                  </div>
                  <Field
                    label="שמות הרוכבים בתחרות *"
                    value={form.rider_names}
                    onChange={(v) => set('rider_names', v)}
                    max={200}
                  />
                </>
              )}

              <div>
                <label className="block text-sm text-stone-400 mb-1.5">כמה מגיעים בסך הכול (כולל הורים ואחים)? *</label>
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: MAX_ATTENDEES }, (_, i) => i + 1).map((n) => (
                    <Pill key={n} active={attendees === n} onClick={() => setAttendees(n)}>
                      {n}
                    </Pill>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-stone-400 mb-1.5">מה תביאו לכיבוד? (אפשר לבחור כמה)</label>
                <div className="grid grid-cols-2 gap-2">
                  {FOOD.map((f) => {
                    const n = stats?.food?.[f.value] ?? 0
                    return (
                      <Pill key={f.value} active={bringing.includes(f.value)} onClick={() => toggleFood(f.value)}>
                        <span className="block">{f.emoji} {f.label}</span>
                        <span className="block text-[11px] font-normal opacity-75 mt-0.5">
                          {n === 0 ? 'עוד אף אחד — תהיו ראשונים!' : `כבר ${n} מביאים`}
                        </span>
                      </Pill>
                    )
                  })}
                </div>
                {bringing.includes('other') && (
                  <div className="mt-2">
                    <Field label="מה תביאו?" value={form.bringing_other} onChange={(v) => set('bringing_other', v)} max={120} />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-stone-400 mb-1.5">הערות (לא חובה)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  maxLength={500}
                  rows={2}
                  className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-3 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-[#D4288A]"
                />
              </div>

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
                <div className="bg-red-950 border border-red-800 text-red-200 rounded-lg p-3 text-sm">{error}</div>
              )}

              <button
                onClick={submit}
                disabled={sending}
                className="w-full text-white font-bold py-4 rounded-xl text-lg disabled:opacity-50 transition"
                style={{ background: PINK }}
              >
                {sending ? 'שולח…' : 'אני בפנים! 🎉'}
              </button>
            </section>
          )}

          <p className="text-center text-sm text-stone-500 pt-2">נתראה בחנוכת המועדון! 🚵‍♀️✨</p>
        </main>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  max,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  max?: number
}) {
  return (
    <div>
      <label className="block text-sm text-stone-400 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={max ?? (type === 'tel' ? 20 : 80)}
        dir={type === 'tel' ? 'ltr' : undefined}
        className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-3 text-stone-100 placeholder-stone-600 focus:outline-none focus:border-[#D4288A]"
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
      style={
        active
          ? { background: PINK, borderColor: PINK, color: '#fff' }
          : { background: '#1c1917', borderColor: '#44403c', color: '#d6d3d1' }
      }
    >
      {children}
    </button>
  )
}
