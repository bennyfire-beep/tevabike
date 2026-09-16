'use client'

import { useEffect, useState } from 'react'

// ============================================================
// הרשמה לאימון השלמה — יום שלישי 22.9, רקפת
// נתיב: app/hashlama/page.tsx · API: app/api/hashlama/route.ts
// ============================================================

const PINK = '#D4288A'

const BRANCHES = [
  { value: 'misgav', label: 'משגב' },
  { value: 'biriya', label: 'ביריה' },
  { value: 'matzuva', label: 'מצובה' },
]
const GROUPS = [
  { value: 'beginners', label: 'גרביטי מתחילים' },
  { value: 'mini', label: 'מיני גרביטי' },
  { value: 'pro', label: 'גרביטי פרו' },
]
const BRANCH_LABEL: Record<string, string> = { misgav: 'משגב', biriya: 'ביריה', matzuva: 'מצובה' }
const GROUP_LABEL: Record<string, string> = { beginners: 'גרביטי מתחילים', mini: 'מיני גרביטי', pro: 'גרביטי פרו' }

export default function HashlamaPage() {
  const [count, setCount] = useState<number | null>(null)

  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', branch: '', group_type: '' })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<typeof form | null>(null)

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    fetch('/api/hashlama', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setCount(d.count))
      .catch(() => {
        // best-effort — the form still works, it just won't show a live count
      })
  }, [])

  async function submit() {
    setError('')
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('חסרים שם פרטי ושם משפחה')
      return
    }
    if (form.phone.replace(/\D/g, '').length < 9) {
      setError('מספר טלפון לא תקין')
      return
    }
    if (!form.branch) {
      setError('יש לבחור סניף')
      return
    }
    if (!form.group_type) {
      setError('יש לבחור קבוצה')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/hashlama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'לא הצלחנו לשלוח. נסו שוב.')
        return
      }
      setDone({ ...form })
      setCount(data.count)
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
        {/* poster */}
        <img src="/hashlama-poster.jpg" alt="אימון השלמה מרוכז — טבע בייק" className="w-full h-auto block" />

        {/* hero */}
        <header
          className="px-6 pt-8 pb-9"
          style={{ background: 'linear-gradient(160deg,#1B1220 0%, #241A28 55%, #2E1224 100%)' }}
        >
          <p className="text-xs font-bold tracking-[.14em] mb-2" style={{ color: PINK }}>
            לכל רוכבי טבע בייק — כל הסניפים מוזמנים
          </p>
          <h1 className="text-3xl font-extrabold mb-3">הרשמה לאימון השלמה</h1>
          <p className="text-stone-300 text-[15px] leading-relaxed mb-5">
            אימון השלמה מרוכז ללא עלות, בעקבות החגים שיצאו על חלק מימי האימונים.
          </p>
          <ul className="flex flex-wrap gap-2 text-sm">
            <li className="bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5">📅 שלישי · 22.9</li>
            <li className="bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5">⏰ 08:30–13:00</li>
            <li className="bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5">📍 רקפת</li>
            <li className="bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5">💜 ללא עלות</li>
          </ul>
        </header>

        {/* card */}
        <main className="px-5 py-7 space-y-6">
          {count !== null && (
            <p className="text-sm font-semibold text-stone-400">{count} נרשמו עד כה</p>
          )}

          {/* info */}
          <ul className="bg-stone-900 rounded-xl p-4 space-y-2 text-[14.5px] text-stone-300">
            <li>🌱 גרביטי מתחילים (גילאי 6–8) יעבדו בחלק מהזמן בנפרד, על מסלולים מותאמים ביער.</li>
            <li>🚵‍♂️ מיני גרביטי ופרו יעבדו יחד — מסלולים, קווים, טכניקה וסשן מדידת זמנים.</li>
            <li>🎒 להביא: ארוחת עשר, מים בכמות מספקת, פנימית ספייר או ערכת תיקון טיובלס.</li>
            <li>🛡️ ציוד מגן חובה: קסדה, כפפות ומגיני ברכיים.</li>
            <li>🚲 יש להגיע עם אופניים תקינים ומוכנים לרכיבה.</li>
          </ul>

          {/* form / confirm */}
          {done ? (
            <section className="text-center space-y-3 py-2">
              <h2 className="text-xl font-bold">נרשמתם בהצלחה! 🎉</h2>
              <p className="text-stone-300">
                {done.first_name} {done.last_name} · {BRANCH_LABEL[done.branch]} · {GROUP_LABEL[done.group_type]}
              </p>
              <p className="text-stone-400 text-sm">מחכים לכם ביום שלישי 22.9, 08:30 ברקפת 🚵‍♂️💜</p>
            </section>
          ) : (
            <section className="space-y-5">
              <Field label="שם פרטי *" value={form.first_name} onChange={(v) => set('first_name', v)} />
              <Field label="שם משפחה *" value={form.last_name} onChange={(v) => set('last_name', v)} />
              <Field label="טלפון *" type="tel" value={form.phone} onChange={(v) => set('phone', v)} />

              <div>
                <label className="block text-sm text-stone-400 mb-1.5">סניף *</label>
                <div className="grid grid-cols-3 gap-2">
                  {BRANCHES.map((b) => (
                    <Pill key={b.value} active={form.branch === b.value} onClick={() => set('branch', b.value)}>
                      {b.label}
                    </Pill>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-stone-400 mb-1.5">קבוצה *</label>
                <div className="grid grid-cols-3 gap-2">
                  {GROUPS.map((g) => (
                    <Pill key={g.value} active={form.group_type === g.value} onClick={() => set('group_type', g.value)}>
                      {g.label}
                    </Pill>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-950 border border-red-800 text-red-200 rounded-lg p-3 text-sm">{error}</div>
              )}

              <button
                onClick={submit}
                disabled={sending}
                className="w-full text-white font-bold py-4 rounded-xl text-lg disabled:opacity-50 transition"
                style={{ background: PINK }}
              >
                {sending ? 'שולח…' : 'שליחת הרשמה'}
              </button>
            </section>
          )}

          <p className="text-center text-sm text-stone-500 pt-2">
            שאלות? אני כאן לכל שאלה — מחכים לכם ליום רכיבה ארוך, כיפי ומקצועי! 🌲🚵‍♂️💜
          </p>
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
        maxLength={40}
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
