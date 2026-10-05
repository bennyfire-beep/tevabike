'use client'

import { useState } from 'react'
import { WHATSAPP_OPTIN_LABEL } from '@/lib/whatsapp-optin'
import { MEETING_DATE_LABEL, LOCATION, SESSIONS, SESSION_LABEL, MAX_ATTENDEES } from '@/lib/parent-meeting'

// ============================================================
// הרשמה לאסיפת הורים — תאריך ומפגשים ב-lib/parent-meeting.ts
// נתיב: app/asefat-horim/page.tsx · API: app/api/parent-meeting/route.ts
// ============================================================

const PINK = '#D4288A'

export default function AsefatHorimPage() {
  const [form, setForm] = useState({ parent_name: '', phone: '', rider_name: '', session: '', notes: '' })
  const [attendees, setAttendees] = useState(1)
  const [whatsappOptin, setWhatsappOptin] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ parent_name: string; session: string; attendees: number } | null>(null)

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function submit() {
    setError('')
    if (!form.parent_name.trim()) {
      setError('חסר שם ההורה')
      return
    }
    if (form.phone.replace(/\D/g, '').length < 9) {
      setError('מספר טלפון לא תקין')
      return
    }
    if (!form.rider_name.trim()) {
      setError('חסר שם הרוכב/ת')
      return
    }
    if (!form.session) {
      setError('יש לבחור מפגש')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/parent-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, attendees, whatsapp_optin: whatsappOptin }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'לא הצלחנו לשלוח. נסו שוב.')
        return
      }
      setDone({ parent_name: form.parent_name, session: form.session, attendees })
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
          style={{ background: 'linear-gradient(160deg,#1B1220 0%, #241A28 55%, #2E1224 100%)' }}
        >
          <p className="text-xs font-bold tracking-[.14em] mb-2" style={{ color: PINK }}>
            טבע בייק · {MEETING_DATE_LABEL}
          </p>
          <h1 className="text-3xl font-extrabold mb-3">אסיפת הורים 💜🚵‍♂️</h1>
          <p className="text-stone-300 text-[15px] leading-relaxed mb-5">
            הורים יקרים, ב{MEETING_DATE_LABEL} נקיים אסיפת הורים של טבע בייק!
          </p>
          <ul className="flex flex-wrap gap-2 text-sm">
            <li className="bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5">📅 {MEETING_DATE_LABEL}</li>
            <li className="bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5">📍 {LOCATION}</li>
          </ul>
        </header>

        <main className="px-5 py-7 space-y-6">
          {/* info */}
          <div className="bg-stone-900 rounded-xl p-4 space-y-3 text-[14.5px] text-stone-300 leading-relaxed">
            <p>
              מאחורי כל ילד שרוכב, מתאמץ ומתקדם יש עולם שלם של חלומות, חששות, הצלחות ואתגרים 🌟 אנחנו פוגשים את
              הילדים באימונים ורואים כמה הם יכולים להתפתח — ברכיבה, בביטחון העצמי, בהתמדה וביכולת להתמודד עם אתגרים 💪
            </p>
            <p>
              כדי שנוכל ללוות אותם ולתמוך בהם בצורה הטובה ביותר, חשוב לנו שגם אתם תהיו חלק מהדרך 🤝 באסיפה נשתף במה
              שאנחנו מתכננים עבור הילדים, נשמע מכם ונחשוב יחד על הדרך קדימה. המעורבות שלכם חשובה לילדים וחשובה לנו 💜
            </p>
            <p>🏡 נשמח לארח אתכם במבנה המועדון החדש, שנבנה עבור הרוכבים וכחלק מתהליך פיתוח המועדון.</p>
          </div>

          <ul className="space-y-2">
            {SESSIONS.map((s) => (
              <li key={s.value} className="flex items-center justify-between gap-2 bg-stone-900 rounded-lg px-4 py-3 text-sm">
                <span className="font-semibold">{s.label}</span>
                <span className="font-bold" dir="ltr" style={{ color: PINK }}>
                  {s.hours}
                </span>
              </li>
            ))}
          </ul>

          {done ? (
            <section className="text-center space-y-4 py-2">
              <h2 className="text-xl font-bold">נרשמתם בהצלחה! 🎉</h2>
              <p className="text-stone-300">
                {done.parent_name} · {done.attendees === 1 ? 'משתתף/ת אחד/ת' : `${done.attendees} משתתפים`}
              </p>
              <p className="text-stone-300 font-semibold">{SESSION_LABEL[done.session]}</p>
              <p className="text-stone-400 text-sm">
                {MEETING_DATE_LABEL} · {LOCATION}
              </p>
              <p className="text-lg font-bold" style={{ color: PINK }}>
                מחכים לכם! 🚵‍♀️✨
              </p>
            </section>
          ) : (
            <section className="space-y-5">
              <h2 className="text-lg font-bold">📝 הרשמה לאסיפה</h2>
              <Field label="שם ההורה *" value={form.parent_name} onChange={(v) => set('parent_name', v)} />
              <Field label="טלפון *" type="tel" value={form.phone} onChange={(v) => set('phone', v)} />
              <Field
                label="שם הרוכב/ת * (אם יש יותר מילד אחד — כתבו את כולם)"
                value={form.rider_name}
                onChange={(v) => set('rider_name', v)}
              />

              <div>
                <label className="block text-sm text-stone-400 mb-1.5">לאיזה מפגש תגיעו? *</label>
                <div className="grid gap-2">
                  {SESSIONS.map((s) => (
                    <Pill key={s.value} active={form.session === s.value} onClick={() => set('session', s.value)}>
                      {s.label} · <span dir="ltr">{s.hours}</span>
                    </Pill>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-stone-400 mb-1.5">כמה תגיעו? *</label>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: MAX_ATTENDEES }, (_, i) => i + 1).map((n) => (
                    <Pill key={n} active={attendees === n} onClick={() => setAttendees(n)}>
                      {n}
                    </Pill>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-stone-400 mb-1.5">שאלה או נושא שתרצו שנעלה באסיפה (לא חובה)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  maxLength={500}
                  rows={3}
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
                {sending ? 'שולח…' : 'נרשמים לאסיפה'}
              </button>
            </section>
          )}

          <p className="text-center text-sm text-stone-500 pt-2">מחכים לכם! 🚵‍♀️✨</p>
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
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="block text-sm text-stone-400 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={type === 'tel' ? 20 : 80}
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
