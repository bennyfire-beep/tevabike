'use client'

import { useEffect, useState } from 'react'

// ============================================================
// הרשמה ליום הקפצות — משגב-יעד, יום שישי
// נתיב: app/hakpatzot/page.tsx · API: app/api/hakpatzot/route.ts
// ============================================================

const PINK = '#D4288A'
const CAPACITY = 15
const PAY_URL = 'https://arbox.link/Mi8QbAnU'

const GROUPS = [
  { value: 'mini', label: 'מיני גרביטי' },
  { value: 'full', label: 'גרביטי' },
]
const AREAS = [
  { value: 'misgav', label: 'משגב' },
  { value: 'mata_asher', label: 'מטה אשר' },
  { value: 'biriya', label: 'ביריה' },
]
const GROUP_LABEL: Record<string, string> = { mini: 'מיני גרביטי', full: 'גרביטי' }
const AREA_LABEL: Record<string, string> = { misgav: 'משגב', mata_asher: 'מטה אשר', biriya: 'ביריה' }

type RosterRow = { first_name: string; last_initial: string; group_type: string; area: string }
type Status = { count: number; capacity: number; closed: boolean; roster: RosterRow[] }

export default function HakpatzotPage() {
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', group_type: '', area: '' })
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ first_name: string; last_name: string; phone: string; group_type: string; area: string } | null>(null)

  const set = (k: 'first_name' | 'last_name' | 'phone' | 'group_type' | 'area', v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  async function loadStatus() {
    try {
      const r = await fetch('/api/hakpatzot', { cache: 'no-store' })
      const d = await r.json()
      setStatus(d)
    } catch {
      // best-effort — the form still works, it just won't show live counts
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch('/api/hakpatzot', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => {
        // best-effort — the form still works, it just won't show live counts
      })
      .finally(() => setLoading(false))
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
    if (!form.group_type) {
      setError('יש לבחור קבוצה')
      return
    }
    if (!form.area) {
      setError('יש לבחור אזור')
      return
    }
    if (!consent) {
      setError('יש לאשר את סעיף האחריות והסיכונים')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/hakpatzot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, consent: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'לא הצלחנו לשלוח. נסו שוב.')
        await loadStatus()
        return
      }
      setDone({ ...form })
      setStatus((s) => (s ? { ...s, count: data.count, closed: data.closed } : s))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setError('לא הצלחנו לשלוח. בדקו את החיבור ונסו שוב.')
    } finally {
      setSending(false)
    }
  }

  const count = status?.count ?? 0
  const closed = status?.closed ?? false
  const pct = Math.min(100, Math.round((count / CAPACITY) * 100))

  return (
    <div dir="rtl" className="min-h-screen bg-stone-950 text-stone-100">
      <div className="max-w-lg mx-auto">
        {/* poster */}
        <img src="/hakpatzot-poster.jpg" alt="הרשמה ליום הקפצות — טבע בייק" className="w-full h-auto block" />

        {/* hero */}
        <header
          className="px-6 pt-8 pb-9"
          style={{ background: 'linear-gradient(160deg,#1B1220 0%, #241A28 55%, #2E1224 100%)' }}
        >
          <p className="text-xs font-bold tracking-[.14em] mb-2" style={{ color: PINK }}>
            אנדורו משגב · יעד — יום שישי
          </p>
          <h1 className="text-3xl font-extrabold mb-3">הרשמה ליום הקפצות</h1>
          <p className="text-stone-300 text-[15px] leading-relaxed mb-5">
            קבוצת טבע בייק מסיעה אתכם למסלולים ביום האימונים. השאירו פרטים ותפסו מקום.
          </p>
          <ul className="flex flex-wrap gap-2 text-sm">
            <li className="bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5">🕗 מפגש 8:00 באוהל הקבוצה</li>
            <li className="bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5">💳 80 ₪ לרוכב</li>
            <li className="bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5">🎟️ {CAPACITY} מקומות בלבד</li>
          </ul>
        </header>

        {/* card */}
        <main className="px-5 py-7 space-y-6">
          {/* live meter */}
          {!loading && status && (
            <section aria-live="polite">
              <div className="h-2.5 rounded-full bg-stone-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: closed ? '#C97A3B' : PINK }}
                />
              </div>
              <p className="mt-2 text-sm font-semibold text-stone-400">
                {count} / {CAPACITY} נרשמו ·{' '}
                {closed ? 'המקומות מלאים · ההרשמה סגורה' : `${CAPACITY - count} מקומות פנויים`}
              </p>
            </section>
          )}

          {/* info */}
          <ul className="bg-stone-900 rounded-xl p-4 space-y-2 text-[14.5px] text-stone-300">
            <li>🚐 איסוף מאוהל הקבוצה של טבע בייק · מפגש בשעה 8:00, יציאה להקפצות כ־10 דקות אחרי.</li>
            <li>⏱️ ההקפצות יימשכו עד לסיום הראנים ביעד.</li>
            <li>🎟️ ההקפצות מוגבלות ל־{CAPACITY} רוכבים בלבד — לפי סדר ההרשמה.</li>
            <li>💳 מקום נשמר אך ורק לאחר ביצוע תשלום בפועל.</li>
          </ul>

          {/* form / closed / confirm */}
          {done ? (
            <section className="text-center space-y-4 py-2">
              <h2 className="text-xl font-bold">נרשמתם בהצלחה! 🎉</h2>
              <p className="text-stone-300">
                {done.first_name} {done.last_name} · {GROUP_LABEL[done.group_type]} · {AREA_LABEL[done.area]}
              </p>
              <p className="text-stone-400 text-sm">
                יש מקום שמור עבורכם. כדי לשריין אותו סופית יש להשלים תשלום בהקדם.
              </p>
              <a
                href={PAY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-white font-bold py-4 rounded-xl text-lg"
                style={{ background: PINK }}
              >
                מעבר לתשלום · 80 ₪
              </a>
              <p className="text-xs text-stone-500">שימו לב: המקום נשמר אך ורק לאחר ביצוע תשלום בפועל.</p>
            </section>
          ) : !loading && closed ? (
            <section className="text-center bg-stone-900 rounded-xl p-6 space-y-1.5">
              <h2 className="text-lg font-bold">ההרשמה סגורה</h2>
              <p className="text-stone-400 text-sm">כל {CAPACITY} המקומות נתפסו. אם יתפנה מקום נעדכן כאן.</p>
            </section>
          ) : (
            <section className="space-y-5">
              <Field label="שם פרטי *" value={form.first_name} onChange={(v) => set('first_name', v)} />
              <Field label="שם משפחה *" value={form.last_name} onChange={(v) => set('last_name', v)} />
              <Field label="טלפון *" type="tel" value={form.phone} onChange={(v) => set('phone', v)} />

              <div>
                <label className="block text-sm text-stone-400 mb-1.5">קבוצה *</label>
                <div className="grid grid-cols-2 gap-2">
                  {GROUPS.map((g) => (
                    <Pill key={g.value} active={form.group_type === g.value} onClick={() => set('group_type', g.value)}>
                      {g.label}
                    </Pill>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-stone-400 mb-1.5">אזור *</label>
                <div className="grid grid-cols-3 gap-2">
                  {AREAS.map((a) => (
                    <Pill key={a.value} active={form.area === a.value} onClick={() => set('area', a.value)}>
                      {a.label}
                    </Pill>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer text-sm text-stone-300 select-none bg-stone-900 rounded-xl p-4">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 w-[18px] h-[18px] cursor-pointer shrink-0"
                  style={{ accentColor: PINK }}
                />
                <span>
                  אני מאשר/ת לבן/בת שלי להשתתף ביום ההקפצות, מצהיר/ה כי ידוע לי על הסיכונים הכרוכים בפעילות ונושא/ת
                  באחריות המלאה לכך.
                </span>
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
                {sending ? 'שולח…' : 'שליחת הרשמה'}
              </button>
            </section>
          )}

          {/* roster */}
          {!loading && status && status.roster.length > 0 && (
            <section>
              <h2 className="text-base font-bold mb-3">מי כבר נרשם ({status.roster.length} מתוך {CAPACITY})</h2>
              <ul className="space-y-2">
                {status.roster.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 bg-stone-900 rounded-lg px-3 py-2.5 text-sm flex-wrap"
                  >
                    <span className="font-semibold">
                      {r.first_name} {r.last_initial}
                      {r.last_initial ? '׳' : ''}
                    </span>
                    <span className="flex gap-1.5">
                      <span className="text-xs font-bold bg-stone-800 rounded-full px-2.5 py-1 text-stone-300">
                        {GROUP_LABEL[r.group_type] ?? r.group_type}
                      </span>
                      <span className="text-xs font-bold rounded-full px-2.5 py-1" style={{ background: `${PINK}22`, color: PINK }}>
                        {AREA_LABEL[r.area] ?? r.area}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-center text-sm text-stone-500 pt-2">
            שאלות? אני כאן לכל שאלה — מתרגשים לראות אתכם על האופניים! 🤘🔥
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
