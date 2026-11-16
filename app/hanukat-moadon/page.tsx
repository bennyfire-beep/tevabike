'use client'

import { useEffect, useState } from 'react'
import { WHATSAPP_OPTIN_LABEL } from '@/lib/whatsapp-optin'
import {
  EVENT_DATE_LABEL, LOCATION, CLUB_LOCATION, FLYER_SRC, SCHEDULE, PARTICIPATION, GROUPS, FOOD, MAX_RIDERS, MAX_ATTENDEES,
} from '@/lib/club-opening'

// ============================================================
// הרשמה לחנוכת המועדון — הגדרות ב-lib/club-opening.ts
// נתיב: app/hanukat-moadon/page.tsx · API: app/api/club-opening/route.ts
// Clean, light layout: one accent colour, grouped white cards, lots of air.
// ============================================================

const ACCENT = '#D4288A'
const INK = '#1d1d1f'
const MUTED = '#6e6e73'
const LINE = '#e5e5ea'

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

  const changeRiders = (n: number) => {
    setRidersCount(n)
    if (attendees < n) setAttendees(n)
  }

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
    <div dir="rtl" className="min-h-screen" style={{ background: '#f5f5f7', color: INK }}>
      <div className="max-w-xl mx-auto px-5 pb-20">
        {/* hero */}
        <header className="pt-12 pb-8 text-center">
          <p className="text-[13px] font-semibold tracking-wide mb-3" style={{ color: ACCENT }}>
            טבע בייק · {EVENT_DATE_LABEL}
          </p>
          <h1 className="text-[40px] leading-[1.1] font-extrabold tracking-tight">חנוכת המועדון</h1>
          <p className="text-[21px] font-semibold mt-1" style={{ color: MUTED }}>
            בוקר אחד. כל טבע בייק.
          </p>
          <p className="text-[16px] leading-relaxed mt-5 max-w-md mx-auto" style={{ color: MUTED }}>
            הבית החדש של טבע בייק מוכן. בואו לחגוג איתנו בבוקר של רכיבה, צחוקים ואוכל טוב — ילדים, הורים ומבוגרים,
            כל הקבוצות מוזמנות.
          </p>
          {stats && stats.families > 0 && (
            <p className="mt-5 text-[14px] font-semibold" style={{ color: INK }}>
              כבר {stats.people} נרשמו{stats.riders > 0 ? ` · ${stats.riders} רוכבים בתחרות` : ''}
            </p>
          )}
          <a
            href="#register"
            className="inline-block mt-6 text-white text-[16px] font-semibold rounded-full px-7 py-3"
            style={{ background: ACCENT }}
          >
            להרשמה
          </a>
        </header>

        {/* flyer */}
        <img
          src={FLYER_SRC}
          alt="חוגגים חנוכה — חנוכת מועדון טבע בייק: מיני בייק, מסלול מדידת זמנים לפי קטגוריות לילדים ולמבוגרים"
          width={1024}
          height={1536}
          className="w-full h-auto block rounded-[28px] shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
        />

        {/* schedule */}
        <SectionTitle>התוכנית</SectionTitle>
        <Card>
          {SCHEDULE.map((s, i) => (
            <div
              key={s.time}
              className="flex items-baseline gap-4 px-5 py-4"
              style={i ? { borderTop: `1px solid ${LINE}` } : undefined}
            >
              <span className="text-[17px] font-bold tabular-nums w-14 shrink-0" dir="ltr" style={{ color: ACCENT }}>
                {s.time}
              </span>
              <span className="text-[16px] leading-snug">{s.label}</span>
            </div>
          ))}
        </Card>

        {/* details */}
        <SectionTitle>מה מחכה לכם</SectionTitle>
        <Card>
          <Detail title="מיני בייק, כיף גדול">
            תחרות היתולית על אופני 20 אינץ׳ — גם לגדולים. מסלול מדידת זמנים לפי קטגוריות, לילדים ולמבוגרים. לא צריך
            להיות אלוף כדי לנצח.
          </Detail>
          <Detail title="חוגגים במועדון" line>
            ב-10:30 עולים יחד אל {CLUB_LOCATION}, גוזרים סרט וחונכים את הבית החדש עם כיבוד משותף.
          </Detail>
          <Detail title="כל אחד מביא משהו קטן" line>
            מאפים, ירקות, פיתות ולבנה, חומוס או שתייה קלה — בחרו בטופס, כדי שיהיה מכל דבר.
          </Detail>
          <Detail title={`את הכיבוד מביאים ל${LOCATION}`} line>
            בהתכנסות ב-08:00. נעמיס אותו על הרכב של טבע בייק, נעלה למועדון ונסדר הכול לאחרי התחרות. מי שמגיע רק לכיבוד —
            מביא ישר למועדון ב-10:30.
          </Detail>
        </Card>
        <p className="text-[14px] text-center mt-4 font-medium" style={{ color: INK }}>
          ההרשמה חובה, גם אם מגיעים רק לכיבוד.
        </p>

        {/* form */}
        <div id="register" className="scroll-mt-20" />
        {done ? (
          <>
            <SectionTitle>נרשמתם</SectionTitle>
            <Card>
              <div className="px-6 py-10 text-center">
                <div
                  className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center text-white text-2xl"
                  style={{ background: ACCENT }}
                >
                  ✓
                </div>
                <h2 className="text-[24px] font-bold">מתרגשים לראות אתכם</h2>
                <p className="text-[16px] mt-2" style={{ color: MUTED }}>
                  {done.name} · {done.attendees === 1 ? 'מגיע/ה לבד' : `${done.attendees} מגיעים`}
                </p>
                <p className="text-[15px] mt-1" style={{ color: MUTED }}>
                  {done.activity
                    ? `${EVENT_DATE_LABEL} · התכנסות 08:00 ב${LOCATION}, זינוקים 08:30`
                    : `${EVENT_DATE_LABEL} · 10:30 ב${CLUB_LOCATION}`}
                </p>
                {done.activity && (
                  <p className="text-[14px] mt-4" style={{ color: MUTED }}>
                    את הכיבוד מביאים ל{LOCATION} — אנחנו נעלה אותו למועדון.
                  </p>
                )}
                <p className="text-[15px] font-semibold mt-6" style={{ color: ACCENT }}>
                  שתפו את הקישור בקבוצה — ככה נהיה הכי הרבה.
                </p>
              </div>
            </Card>
          </>
        ) : (
          <>
            <SectionTitle>הרשמה</SectionTitle>
            <Card>
              <Input label="שם מלא" value={form.contact_name} onChange={(v) => set('contact_name', v)} />
              <Input label="טלפון" type="tel" value={form.phone} onChange={(v) => set('phone', v)} line />
              <label className="flex items-center justify-between gap-3 px-5 py-3.5" style={{ borderTop: `1px solid ${LINE}` }}>
                <span className="text-[16px] shrink-0">קבוצה</span>
                <select
                  value={form.group_name}
                  onChange={(e) => set('group_name', e.target.value)}
                  className="bg-transparent text-[16px] text-left outline-none max-w-[65%] truncate"
                  style={{ color: form.group_name ? INK : MUTED }}
                >
                  <option value="">בחירה</option>
                  {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>
            </Card>

            <Label>למה מגיעים?</Label>
            <div className="grid gap-3">
              {PARTICIPATION.map((p) => {
                const active = form.participation === p.value
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => set('participation', p.value)}
                    className="text-right bg-white rounded-2xl px-5 py-4 transition flex items-center justify-between gap-3"
                    style={{ boxShadow: active ? `0 0 0 2px ${ACCENT}` : `0 0 0 1px ${LINE}` }}
                  >
                    <span>
                      <span className="block text-[16px] font-semibold">{p.label}</span>
                      <span className="block text-[14px] mt-0.5" style={{ color: MUTED }}>{p.sub}</span>
                    </span>
                    <Radio on={active} />
                  </button>
                )
              })}
            </div>

            <Label>כמה מגיעים?</Label>
            <Card>
              {isActivity && (
                <Stepper label="רוכבים בתחרות" value={ridersCount} min={1} max={MAX_RIDERS} onChange={changeRiders} />
              )}
              <Stepper
                label="סך הכול, כולל הורים ואחים"
                value={attendees}
                min={isActivity ? ridersCount : 1}
                max={MAX_ATTENDEES}
                onChange={setAttendees}
                line={isActivity}
              />
              {isActivity && (
                <Input
                  label="שמות הרוכבים"
                  value={form.rider_names}
                  onChange={(v) => set('rider_names', v)}
                  max={200}
                  line
                />
              )}
            </Card>

            <Label>מה תביאו לכיבוד?</Label>
            <Card>
              {FOOD.map((f, i) => {
                const on = bringing.includes(f.value)
                const n = stats?.food?.[f.value] ?? 0
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => toggleFood(f.value)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-right"
                    style={i ? { borderTop: `1px solid ${LINE}` } : undefined}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-[20px] w-7 text-center">{f.emoji}</span>
                      <span>
                        <span className="block text-[16px]">{f.label}</span>
                        <span className="block text-[13px]" style={{ color: MUTED }}>
                          {n === 0 ? 'עוד אף אחד' : `${n} כבר מביאים`}
                        </span>
                      </span>
                    </span>
                    <Check on={on} />
                  </button>
                )
              })}
              {bringing.includes('other') && (
                <Input label="מה תביאו?" value={form.bringing_other} onChange={(v) => set('bringing_other', v)} max={120} line />
              )}
            </Card>

            <Label>הערות</Label>
            <Card>
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="לא חובה"
                className="w-full bg-transparent px-5 py-4 text-[16px] outline-none resize-none placeholder:text-[#a1a1a6]"
              />
            </Card>

            <label className="flex items-start gap-3 cursor-pointer text-[14px] mt-6 px-1 select-none" style={{ color: MUTED }}>
              <input
                type="checkbox"
                checked={whatsappOptin}
                onChange={(e) => setWhatsappOptin(e.target.checked)}
                className="mt-0.5 w-[18px] h-[18px] cursor-pointer shrink-0"
                style={{ accentColor: ACCENT }}
              />
              <span>{WHATSAPP_OPTIN_LABEL}</span>
            </label>

            {error && (
              <p className="mt-5 text-[15px] text-center font-medium" style={{ color: '#d70015' }}>{error}</p>
            )}

            <button
              onClick={submit}
              disabled={sending}
              className="w-full text-white font-semibold py-4 rounded-2xl text-[17px] mt-6 disabled:opacity-50 transition active:scale-[0.99]"
              style={{ background: ACCENT }}
            >
              {sending ? 'שולח…' : 'הרשמה'}
            </button>
          </>
        )}

        <p className="text-center text-[13px] mt-10" style={{ color: MUTED }}>
          טבע בייק · {EVENT_DATE_LABEL} · {LOCATION} ← {CLUB_LOCATION}
        </p>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[24px] font-bold tracking-tight mt-12 mb-4 px-1">{children}</h2>
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] font-semibold mt-7 mb-2 px-1" style={{ color: MUTED }}>{children}</p>
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: `0 0 0 1px ${LINE}` }}>{children}</div>
}

function Detail({ title, children, line }: { title: string; children: React.ReactNode; line?: boolean }) {
  return (
    <div className="px-5 py-4" style={line ? { borderTop: `1px solid ${LINE}` } : undefined}>
      <p className="text-[16px] font-semibold">{title}</p>
      <p className="text-[15px] leading-relaxed mt-1" style={{ color: MUTED }}>{children}</p>
    </div>
  )
}

function Input({
  label, value, onChange, type = 'text', max, line,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; max?: number; line?: boolean
}) {
  return (
    <label className="flex items-center gap-3 px-5 py-3.5" style={line ? { borderTop: `1px solid ${LINE}` } : undefined}>
      <span className="text-[16px] shrink-0 w-24">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={max ?? (type === 'tel' ? 20 : 80)}
        dir={type === 'tel' ? 'ltr' : undefined}
        inputMode={type === 'tel' ? 'tel' : undefined}
        className="flex-1 min-w-0 bg-transparent text-[16px] outline-none text-left"
        style={type === 'tel' ? undefined : { textAlign: 'right' }}
      />
    </label>
  )
}

function Stepper({
  label, value, min, max, onChange, line,
}: {
  label: string; value: number; min: number; max: number; onChange: (n: number) => void; line?: boolean
}) {
  const btn = 'w-9 h-9 rounded-full text-[20px] leading-none flex items-center justify-center disabled:opacity-30'
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3" style={line ? { borderTop: `1px solid ${LINE}` } : undefined}>
      <span className="text-[16px]">{label}</span>
      <div className="flex items-center gap-3" dir="ltr">
        <button type="button" aria-label="פחות" className={btn} style={{ background: '#f2f2f7' }} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
        <span className="text-[17px] font-semibold tabular-nums w-6 text-center">{value}</span>
        <button type="button" aria-label="יותר" className={btn} style={{ background: '#f2f2f7' }} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  )
}

function Radio({ on }: { on: boolean }) {
  return (
    <span
      className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center"
      style={{ border: on ? `7px solid ${ACCENT}` : `1.5px solid #c7c7cc` }}
    />
  )
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-white text-[13px] font-bold"
      style={on ? { background: ACCENT } : { border: '1.5px solid #c7c7cc' }}
    >
      {on ? '✓' : ''}
    </span>
  )
}
