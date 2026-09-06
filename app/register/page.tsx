'use client'

import { useState, useEffect } from 'react'
import { WHATSAPP_OPTIN_LABEL } from '@/lib/whatsapp-optin'

const MATNAS_URL = 'https://www.matnasmatteasher.org.il/%D7%9E%D7%97%D7%9C%D7%A7%D7%AA-%D7%A1%D7%A4%D7%95%D7%A8%D7%98/'

// המבצע יורד אוטומטית ב-1 בספטמבר 2026
const PROMO_ENDS = new Date('2026-09-01T00:00:00+03:00')
const promoActive = () => new Date() < PROMO_ENDS

// חוגי ילדים ונוער — כל הסניפים הפעילים.
const BRANCHES = [
  { value: 'משגב', label: 'משגב', day: 'ראשון וחמישי 15:30–17:00' },
  { value: 'ביריה', label: 'ביריה', day: 'שני 15:45–17:15' },
  { value: 'מטה אשר', label: 'מטה אשר', day: 'שלישי', external: true },
  { value: 'פרוד-אמירים', label: 'פרוד-אמירים', day: 'רביעי 15:45–17:00' },
  { value: 'צורית-גילון', label: 'צורית-גילון', day: 'שלישי 14:45–15:45' },
  { value: 'אחר', label: 'אחר', day: '' },
]

// חוגים חד-מסלוליים — יום, שעה, מחיר (ומדריך אם רלוונטי) קבועים לכל
// הסניף, בלי בחירת מסלול/יום. dayIndex תואם ל-groups.days_of_week/DAY_LABEL
// בשרת (0=ראשון..6=שבת).
const FIXED_BRANCHES: Record<
  string,
  { dayIndex: string; dayLabel: string; time: string; price: number; instructor?: string }
> = {
  'צורית-גילון': { dayIndex: '2', dayLabel: 'שלישי', time: '14:45–15:45', price: 270, instructor: 'ארז דגן' },
  'פרוד-אמירים': { dayIndex: '3', dayLabel: 'רביעי', time: '15:45–17:00', price: 270 },
}

// מבוגרים — כרגע פעיל רק משגב (ביריה, מטה אשר ופרוד-אמירים הן חוגי ילדים/נוער
// בלבד ולא רלוונטיות למבוגרים). לוח הזמנים המלא מוצג בנפרד, ב-MISGAV_ADULT_SESSIONS.
const ADULT_BRANCHES = [
  { value: 'משגב', label: 'משגב', day: '' },
  { value: 'אחר', label: 'אחר', day: '' },
]

// פירוט האימונים במשגב למבוגרים — הנרשם בוחר אימון אחד מתוך החמישה (radio
// יחיד). dayIndex (0=ראשון..4=חמישי) נשמר בשדה chosen_day הקיים — אותו שדה
// שכבר משמש למסלול "פעם בשבוע" של ילדים — ומגיע במייל האישור דרך DAY_LABEL
// שם, בלי צורך בעמודה נוספת. sent as class_type so the coordinator screen
// (which already renders class_type next to the branch) shows which session.
const MISGAV_ADULT_SESSIONS = [
  { dayIndex: 0, day: "יום א'", type: 'טכני', time: '6:30–8:00' },
  { dayIndex: 1, day: "יום ב'", type: 'כושר ואושר', time: '6:00–7:15' },
  { dayIndex: 2, day: "יום ג'", type: 'כושר נשים', time: '6:00–7:15' },
  { dayIndex: 3, day: "יום ד'", type: 'חשמלי טכני', time: '6:00–7:15' },
  { dayIndex: 4, day: "יום ה'", type: 'נשים טכני', time: '6:00–7:15' },
]

// Summer 2026 tracks. Friday (יומועדון) is cancelled, so the only remaining
// membership_plan value is 'center' — the track is what varies now.
// title/price are the same everywhere; only the days differ by branch (see
// BRANCH_ONCE_WEEKLY_DAYS / BRANCH_TWICE_WEEKLY_LABEL below), so desc is
// filled in dynamically per branch when rendering.
const TRACKS = [
  { value: 'once_weekly', title: 'פעם בשבוע', price: 300 },
  { value: 'twice_weekly', title: 'פעמיים בשבוע', price: 550, best: true },
]

// אילו ימים ניתן לבחור במסלול "פעם בשבוע", לפי סניף. סניף שלא מופיע כאן
// מקבל את ברירת המחדל של משגב (ראשון/חמישי). ביריה מוגבלת ליום קבוע אחד —
// אין בחירה, הוא נקבע אוטומטית. 0 = ראשון .. 6 = שבת, תואם ל-
// groups.days_of_week ב-Supabase.
const DEFAULT_ONCE_WEEKLY_DAYS = [
  { value: '0', label: 'יום ראשון' },
  { value: '4', label: 'יום חמישי' },
]
const BRANCH_ONCE_WEEKLY_DAYS: Record<string, { value: string; label: string }[]> = {
  'ביריה': [{ value: '1', label: 'יום שני' }],
}

// התיאור של מסלול "פעמיים בשבוע", לפי סניף — אותו הגיון: ברירת המחדל היא
// הימים של משגב.
const DEFAULT_TWICE_WEEKLY_LABEL = 'ראשון וגם חמישי'
const BRANCH_TWICE_WEEKLY_LABEL: Record<string, string> = {
  'ביריה': 'שני וגם רביעי',
}

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
  const fixedBranch = isKids ? FIXED_BRANCHES[form.branch] : undefined
  const onceWeeklyDays = BRANCH_ONCE_WEEKLY_DAYS[form.branch] ?? DEFAULT_ONCE_WEEKLY_DAYS
  const twiceWeeklyLabel = BRANCH_TWICE_WEEKLY_LABEL[form.branch] ?? DEFAULT_TWICE_WEEKLY_LABEL
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
    if (isKids && !fixedBranch && !form.track) {
      setError('בחרו מסלול הרשמה')
      return
    }
    if (isKids && !fixedBranch && form.track === 'once_weekly' && !form.chosen_day) {
      setError('בחרו יום קבוע')
      return
    }
    if (!isKids && form.branch === 'משגב' && !form.chosen_day) {
      setError('בחרו אימון')
      return
    }

    // מבוגר שבחר משגב: תואמים את chosen_day לאימון שנבחר, ומעדכנים את
    // class_type לשם האימון (למשל "כושר ואושר") כדי שהרכזת תראה בדיוק
    // לאיזה אימון נרשמו — לא רק לאיזה יום.
    const misgavSession =
      !isKids && form.branch === 'משגב'
        ? MISGAV_ADULT_SESSIONS.find((s) => String(s.dayIndex) === form.chosen_day)
        : null

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
          class_type: misgavSession ? misgavSession.type : form.class_type,
          amount_monthly: fixedBranch ? fixedBranch.price : (TRACKS.find((t) => t.value === form.track)?.price ?? null),
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
            onClick={() => { setType('kids'); set('chosen_day', '') }}
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
            onClick={() => { setType('adults'); set('chosen_day', '') }}
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
                  {(isKids ? BRANCHES : ADULT_BRANCHES).map((b) => (
                    <button
                      key={b.value}
                      type="button"
                      onClick={() => {
                        set('branch', b.value)
                        // המסלול הישן שייך רק ל"משגב" אצל מבוגרים — סניף אחר מבטל אותו.
                        if (!isKids && b.value !== 'משגב') set('chosen_day', '')
                        if (!isKids) return

                        const nextFixed = FIXED_BRANCHES[b.value]
                        if (nextFixed) {
                          // חוג חד-מסלולי (גילון/פרוד-אמירים): מסלול, יום ומדריך
                          // קבועים — אין בחירה, נקבע אוטומטית.
                          set('track', 'once_weekly')
                          set('chosen_day', nextFixed.dayIndex)
                          set('class_type', nextFixed.instructor ?? '')
                          return
                        }
                        if (FIXED_BRANCHES[form.branch]) {
                          // יציאה מסניף חד-מסלולי חזרה לסניף עם בחירת מסלול —
                          // מנקים כדי לא לגרור ערכים לא רלוונטיים.
                          set('track', '')
                          set('chosen_day', '')
                          set('class_type', '')
                          return
                        }
                        // מעבר בין סניפים עם ימים שונים (למשל משגב וביריה) — היום
                        // שנבחר בסניף הקודם עלול לא להיות רלוונטי לסניף החדש.
                        if (form.track === 'once_weekly') {
                          const days = BRANCH_ONCE_WEEKLY_DAYS[b.value] ?? DEFAULT_ONCE_WEEKLY_DAYS
                          set('chosen_day', days.length === 1 ? days[0].value : '')
                        }
                      }}
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

              {/* מבוגרים + משגב — בחירת אימון אחד מתוך החמישה (radio יחיד) */}
              {!isKids && form.branch === 'משגב' && (
                <fieldset className="space-y-2 border-0 p-0 m-0">
                  <legend className="text-sm text-stone-300 font-semibold mb-1.5">באיזה אימון תרצו להשתתף? *</legend>
                  {MISGAV_ADULT_SESSIONS.map((s) => {
                    const selected = form.chosen_day === String(s.dayIndex)
                    return (
                      <label
                        key={s.dayIndex}
                        className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition ${
                          selected
                            ? 'bg-lime-400 text-stone-950 border-lime-400 font-semibold'
                            : 'bg-stone-950 border-stone-700 text-stone-300 hover:border-stone-500'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name="misgav-session"
                            value={s.dayIndex}
                            checked={selected}
                            onChange={() => set('chosen_day', String(s.dayIndex))}
                            className="w-4 h-4 accent-lime-700 cursor-pointer shrink-0"
                          />
                          <span>{s.day} · {s.type}</span>
                        </span>
                        <span dir="ltr" className={`text-xs ${selected ? 'text-stone-800' : 'text-stone-500'}`}>{s.time}</span>
                      </label>
                    )
                  })}
                </fieldset>
              )}
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
                {isKids && fixedBranch && (
                  <Section title="פרטי החוג">
                    <div className="rounded-lg border border-stone-700 bg-stone-950 p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-stone-400">יום ושעה</span>
                        <span className="font-semibold">{fixedBranch.dayLabel}, {fixedBranch.time}</span>
                      </div>
                      {fixedBranch.instructor && (
                        <div className="flex justify-between">
                          <span className="text-stone-400">מדריך</span>
                          <span className="font-semibold">{fixedBranch.instructor}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-stone-400">מסלול</span>
                        <span className="font-semibold">פעם בשבוע</span>
                      </div>
                      <div className="flex justify-between border-t border-stone-800 pt-2">
                        <span className="text-stone-400">מחיר</span>
                        <span className="font-bold text-lime-400">₪{fixedBranch.price} לחודש</span>
                      </div>
                    </div>
                  </Section>
                )}

                {isKids && !fixedBranch && (
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
                              if (p.value === 'twice_weekly') {
                                // תלמיד פעמיים בשבוע מגיע בשני הימים, אין יום קבוע יחיד.
                                set('chosen_day', '')
                              } else {
                                // פעם בשבוע: אם לסניף יש רק אפשרות יום אחת (כמו
                                // ביריה), קובעים אותה אוטומטית ולא מציגים בחירה.
                                set('chosen_day', onceWeeklyDays.length === 1 ? onceWeeklyDays[0].value : '')
                              }
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
                                <div className={`text-xs mt-1 ${selected ? 'text-stone-700' : 'text-stone-400'}`}>
                                  {p.value === 'twice_weekly'
                                    ? `${twiceWeeklyLabel} — אימון כפול בשבוע`
                                    : onceWeeklyDays.length === 1
                                    ? `אימון קבוע אחד בשבוע — ${onceWeeklyDays[0].label}`
                                    : 'אימון קבוע אחד בשבוע — בוחרים יום קבוע אחד'}
                                </div>
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

                    {/* Once-weekly students commit to one fixed day — only shown
                        when the branch actually offers more than one choice
                        (e.g. Birya has just one day, set automatically above). */}
                    {form.track === 'once_weekly' && onceWeeklyDays.length > 1 && (
                      <div className="pt-1">
                        <div className="text-xs text-stone-400 mb-2">איזה יום? *</div>
                        <div className="grid grid-cols-2 gap-2">
                          {onceWeeklyDays.map((d) => {
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
                      {onceWeeklyDays.length === 1
                        ? `בסניף ${form.branch} האימון הקבוע במסלול פעם בשבוע הוא ביום ${onceWeeklyDays[0].label.replace(/^יום /, '')}. במסלול פעמיים בשבוע: ${twiceWeeklyLabel}.`
                        : 'החוגים במשגב מתקיימים בימים ראשון וחמישי, 15:30–17:00. במסלול פעם בשבוע בוחרים יום קבוע אחד ונשארים איתו לאורך השנה.'}
                    </p>
                  </Section>
                )}

                {/* אצל מבוגר שנרשם למשגב, סוג האימון כבר נקבע מהבחירה למעלה —
                    שדה "ניסיון קודם" חופשי היה רק מבלבל לצד זה. */}
                {!(!isKids && form.branch === 'משגב') && !fixedBranch && (
                  <Section title="ניסיון">
                    <Field
                      label="ניסיון קודם ברכיבה"
                      value={form.class_type}
                      onChange={(v) => set('class_type', v)}
                      placeholder="מתחיל / רכב שנה / מתקדם"
                    />
                  </Section>
                )}

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
