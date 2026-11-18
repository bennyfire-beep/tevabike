'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CHECKLIST } from '@/lib/rental-checklist'

// ============================================================
// בדיקת אופניים לפני יציאה — הקישור נשלח לשוכר במייל ההזמנה.
// נתיב: app/rent/checklist/page.tsx · API: app/api/rent/checklist/route.ts
// ============================================================

const ACCENT = '#9BCB3C'

type Item = {
  id: string
  rider_name: string
  bike_name: string
  checklist: Record<string, unknown> | null
  checklist_ok: boolean | null
  checklist_at: string | null
}
type Data = { rent_date: string; slot: string; first_name: string; items: Item[] }

export default function ChecklistPage() {
  return (
    <Suspense fallback={<Shell><p className="text-stone-400">טוען…</p></Shell>}>
      <Checklist />
    </Suspense>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-stone-950 text-stone-100">
      <div className="max-w-xl mx-auto px-5 py-8">
        <p className="text-xs font-bold tracking-[.14em] mb-2" style={{ color: ACCENT }}>טבע בייק × טימו פאן</p>
        <h1 className="text-2xl font-extrabold mb-2">בדיקת אופניים לפני יציאה</h1>
        {children}
      </div>
    </div>
  )
}

function Checklist() {
  const b = useSearchParams().get('b') ?? ''
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const load = useCallback(() => setTick((t) => t + 1), [])

  // Loaded on open and again after each bike's check is saved.
  useEffect(() => {
    fetch(`/api/rent/checklist?b=${encodeURIComponent(b)}`, { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) setError(json.error ?? 'שגיאה')
        else setData(json)
      })
      .catch(() => setError('אין חיבור. נסו שוב.'))
  }, [b, tick])

  if (error) return <Shell><p className="text-red-400">{error}</p></Shell>
  if (!data) return <Shell><p className="text-stone-400">טוען…</p></Shell>

  return (
    <Shell>
      <p className="text-stone-300 text-[15px] leading-relaxed mb-6">
        היי {data.first_name}, לפני שיוצאים לשביל בודקים כל אופניים ({new Date(data.rent_date + 'T12:00:00').toLocaleDateString('he-IL')} · {data.slot}).
        אם משהו לא תקין, <b>לא יוצאים</b>: ניגשים לחנות טימו פאן, מתקנים בלי עלות, וממלאים את הבדיקה שוב.
      </p>
      <div className="space-y-6">
        {data.items.map((it) => <BikeCard key={it.id} b={b} item={it} onSaved={load} />)}
      </div>
    </Shell>
  )
}

function BikeCard({ b, item, onSaved }: { b: string; item: Item; onSaved: () => void }) {
  const [answers, setAnswers] = useState<Record<string, boolean | undefined>>({})
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(item.checklist_ok !== true)

  const anyNo = CHECKLIST.some((c) => answers[c.id] === false)
  const allAnswered = CHECKLIST.every((c) => typeof answers[c.id] === 'boolean')

  async function submit() {
    setError('')
    if (!allAnswered) return setError('יש לענות על כל הסעיפים')
    if (anyNo && note.trim().length < 3) return setError('כתבו בקצרה מה לא תקין')
    setSending(true)
    try {
      const res = await fetch('/api/rent/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ b, item_id: item.id, answers, note }),
      })
      const json = await res.json()
      if (!res.ok) return setError(json.error ?? 'שגיאה')
      setEditing(false)
      setAnswers({})
      setNote('')
      onSaved()
    } catch {
      setError('אין חיבור. נסו שוב.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="bg-stone-900 rounded-2xl p-4">
      <h2 className="text-lg font-bold">{item.bike_name}</h2>
      <p className="text-sm text-stone-400 mb-3">רוכב: {item.rider_name}</p>

      {item.checklist_at && !editing && (
        item.checklist_ok ? (
          <div className="rounded-xl p-3 mb-2" style={{ background: `${ACCENT}22` }}>
            <p className="font-bold" style={{ color: ACCENT }}>✅ האופניים נבדקו ותקינים. רכיבה מהנה!</p>
          </div>
        ) : (
          <div className="rounded-xl p-3 mb-2 bg-red-500/15 border border-red-500/40">
            <p className="font-bold text-red-300">⛔ לא יוצאים לרכיבה עם האופניים האלה.</p>
            <p className="text-sm text-red-200 mt-1">גשו לחנות טימו פאן לתיקון. אחרי התיקון לחצו ״בדיקה מחדש״.</p>
          </div>
        )
      )}

      {!editing ? (
        <button onClick={() => setEditing(true)} className="text-sm underline text-stone-300">בדיקה מחדש</button>
      ) : (
        <>
          <ul className="space-y-3">
            {CHECKLIST.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3">
                <span className="text-[15px]">{c.label}</span>
                <span className="flex gap-1.5 shrink-0">
                  {([true, false] as const).map((v) => {
                    const on = answers[c.id] === v
                    return (
                      <button
                        key={String(v)}
                        type="button"
                        onClick={() => setAnswers((a) => ({ ...a, [c.id]: v }))}
                        className="px-3 py-1.5 rounded-lg text-sm font-bold border"
                        style={on ? { background: v ? ACCENT : '#ef4444', color: '#0c0a09', borderColor: 'transparent' } : { borderColor: '#57534e' }}
                      >
                        {v ? 'תקין' : 'לא'}
                      </button>
                    )
                  })}
                </span>
              </li>
            ))}
          </ul>
          {anyNo && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="מה לא תקין? (למשל: הבלם האחורי חלש)"
              className="w-full mt-3 bg-stone-800 rounded-lg p-2.5 text-sm"
              rows={2}
            />
          )}
          <p className="text-xs text-stone-500 mt-3">
            בלחיצה על ״שליחה״ אני מאשר/ת שבדקתי את האופניים בעצמי, ושהתשובות נכונות.
          </p>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          <button
            onClick={submit}
            disabled={sending}
            className="w-full mt-3 py-3 rounded-xl font-bold text-stone-950 disabled:opacity-60"
            style={{ background: ACCENT }}
          >
            {sending ? 'שולח…' : 'שליחה'}
          </button>
        </>
      )}
    </section>
  )
}
