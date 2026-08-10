'use client'

import { useState } from 'react'

const BRANCHES = [
  { value: 'משגב', label: 'משגב' },
  { value: 'מצובה', label: 'מצובה' },
  { value: 'ביריה', label: 'ביריה' },
  { value: 'אמירים', label: 'אמירים / פרוד' },
  { value: 'אחר', label: 'אחר' },
]

export default function RegisterPage() {
  const [type, setType] = useState<'' | 'kids' | 'adults'>('')
  const [form, setForm] = useState({
    child_name: '',
    child_age: '',
    branch: '',
    city: '',
    class_type: '',
    full_name: '',
    phone: '',
    email: '',
    notes: '',
  })
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const isKids = type === 'kids'

  async function submit() {
    setError('')
    const missing = isKids
      ? !form.child_name || !form.full_name || !form.phone || !form.branch || !form.city
      : !form.full_name || !form.phone || !form.branch || !form.city

    if (missing) {
      setError(
        isKids
          ? 'חסרים שדות חובה: שם הרוכב, יישוב, סניף, שם ההורה וטלפון'
          : 'חסרים שדות חובה: שם מלא, יישוב, סניף וטלפון'
      )
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, registration_type: type }),
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
        <header className="mb-8">
          <p className="text-lime-400 text-sm tracking-widest mb-2">טבע בייק · שנת פעילות</p>
          <h1 className="text-3xl font-bold">הרשמה לקבוצות</h1>
          <p className="text-stone-400 mt-2 text-sm leading-relaxed">
            ממלאים את הפרטים, אנחנו משבצים לקבוצה מתאימה,
            ואז שולחים קישור לתשלום ולאפליקציה.
          </p>
        </header>

        {/* בחירת סוג הרשמה */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setType('kids')}
            className={`p-5 rounded-xl border text-right transition ${
              type === 'kids'
                ? 'bg-lime-400 text-stone-950 border-lime-400'
                : 'bg-stone-900 border-stone-700 hover:border-stone-500'
            }`}
          >
            <div className="text-2xl mb-1">🧒</div>
            <div className="font-bold">ילדים ונוער</div>
            <div className={`text-xs mt-0.5 ${type === 'kids' ? 'text-stone-800' : 'text-stone-500'}`}>
              הורה רושם את הילד
            </div>
          </button>
          <button
            type="button"
            onClick={() => setType('adults')}
            className={`p-5 rounded-xl border text-right transition ${
              type === 'adults'
                ? 'bg-lime-400 text-stone-950 border-lime-400'
                : 'bg-stone-900 border-stone-700 hover:border-stone-500'
            }`}
          >
            <div className="text-2xl mb-1">🚴</div>
            <div className="font-bold">מבוגרים</div>
            <div className={`text-xs mt-0.5 ${type === 'adults' ? 'text-stone-800' : 'text-stone-500'}`}>
              רושם את עצמי
            </div>
          </button>
        </div>

        {!type ? (
          <p className="text-center text-stone-500 text-sm">בחרו סוג הרשמה כדי להמשיך</p>
        ) : (
          <div className="space-y-5">
            {isKids ? (
              <Section title="הרוכב">
                <Field label="שם מלא של הילד/ה *" value={form.child_name} onChange={(v) => set('child_name', v)} />
                <Field label="גיל" type="number" value={form.child_age} onChange={(v) => set('child_age', v)} />
                <Field
                  label="יישוב מגורים *"
                  value={form.city}
                  onChange={(v) => set('city', v)}
                  placeholder="למשל: שכניה, נהריה, צפת"
                />
              </Section>
            ) : (
              <Section title="הפרטים שלך">
                <Field label="שם מלא *" value={form.full_name} onChange={(v) => set('full_name', v)} />
                <Field label="גיל" type="number" value={form.child_age} onChange={(v) => set('child_age', v)} />
                <Field
                  label="יישוב מגורים *"
                  value={form.city}
                  onChange={(v) => set('city', v)}
                  placeholder="למשל: שכניה, נהריה, צפת"
                />
              </Section>
            )}

            <Section title="הסניף">
              <div>
                <label className="block text-sm text-stone-400 mb-1.5">איפה נוח לכם להתאמן? *</label>
                <div className="grid grid-cols-2 gap-2">
                  {BRANCHES.map((b) => (
                    <button
                      key={b.value}
                      type="button"
                      onClick={() => set('branch', b.value)}
                      className={`py-3 rounded-lg border text-sm transition ${
                        form.branch === b.value
                          ? 'bg-lime-400 text-stone-950 border-lime-400 font-semibold'
                          : 'bg-stone-900 border-stone-700 text-stone-300 hover:border-stone-500'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
                {form.branch === 'אחר' && (
                  <p className="text-xs text-stone-500 mt-2">לפי היישוב שמילאתם נציע את הקבוצה הקרובה ביותר.</p>
                )}
              </div>

              <Field
                label="ניסיון קודם ברכיבה"
                value={form.class_type}
                onChange={(v) => set('class_type', v)}
                placeholder="מתחיל / רכב שנה / מתקדם"
              />
            </Section>

            {isKids && (
              <Section title="ההורה">
                <Field label="שם ההורה *" value={form.full_name} onChange={(v) => set('full_name', v)} />
                <Field label="טלפון ההורה *" type="tel" value={form.phone} onChange={(v) => set('phone', v)} />
                <Field label="אימייל" type="email" value={form.email} onChange={(v) => set('email', v)} />
              </Section>
            )}

            {!isKids && (
              <Section title="יצירת קשר">
                <Field label="טלפון *" type="tel" value={form.phone} onChange={(v) => set('phone', v)} />
                <Field label="אימייל" type="email" value={form.email} onChange={(v) => set('email', v)} />
              </Section>
            )}

            <Section title="הערות">
              <Field
                label="בריאות, אלרגיות או כל דבר שכדאי שנדע"
                value={form.notes}
                onChange={(v) => set('notes', v)}
                textarea
              />
            </Section>

            {error && (
              <div className="bg-red-950 border border-red-800 text-red-200 rounded-lg p-3 text-sm">{error}</div>
            )}

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
