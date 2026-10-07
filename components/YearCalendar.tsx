'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  CALENDAR_PRIORITY, CALENDAR_SELECT, CALENDAR_TYPES, CALENDAR_TYPE_META, MONTHS_HE, parseDay,
  type CalendarEvent, type CalendarEventType,
} from '@/lib/calendar-events'

// Year calendar for the homepage — school year (Sep–Aug) or calendar year,
// 12 month grids with the events coloured by type and listed under each
// month. Events come from site_calendar_events (edited at
// /admin/coordinator/calendar); the table is public-read so the anon client
// is enough here.

const PINK = '#D4288A'
const DARK = '#0C1814'
const DOW = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

const pad = (n: number) => String(n).padStart(2, '0')
const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

/** The school year starts in September: Jan–Aug belong to the year that started last September. */
const schoolStartYear = (now: Date) => (now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1)

type Normalized = CalendarEvent & { s: Date; e: Date }

const CSS = `
.tbcal-top { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:16px; margin-bottom:20px; }
.tbcal-range { margin:0; font-size:clamp(24px,4vw,36px); font-weight:900; color:${DARK}; letter-spacing:-0.02em; }
.tbcal-range small { display:block; font-size:14px; font-weight:400; color:#7A8880; margin-top:2px; letter-spacing:0; }
.tbcal-controls { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.tbcal-seg { display:inline-flex; border:1px solid ${PINK}; border-radius:10px; overflow:hidden; background:#fff; }
.tbcal-seg button, .tbcal-nav button { font:inherit; font-size:14px; color:${DARK}; background:transparent; border:0; padding:8px 14px; cursor:pointer; }
.tbcal-seg button[aria-pressed="true"] { background:${PINK}; color:#fff; }
.tbcal-nav { display:inline-flex; gap:6px; }
.tbcal-nav button { border:1px solid ${PINK}; color:${PINK}; border-radius:10px; min-width:40px; background:#fff; }
.tbcal-nav button:hover, .tbcal-seg button:hover:not([aria-pressed="true"]) { background:${PINK}12; }
.tbcal button:focus-visible { outline:3px solid ${PINK}; outline-offset:2px; }
.tbcal-legend { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:24px; }
.tbcal-chip { display:inline-flex; align-items:center; gap:8px; font:inherit; font-size:14px; color:${DARK}; background:#fff; border:1px solid #EAE6E1; border-radius:999px; padding:6px 14px 6px 12px; cursor:pointer; }
.tbcal-chip i { width:12px; height:12px; border-radius:50%; display:inline-block; }
.tbcal-chip[aria-pressed="false"] { opacity:.45; text-decoration:line-through; }
.tbcal-months { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
@media (max-width:900px) { .tbcal-months { grid-template-columns:repeat(2,1fr); } }
@media (max-width:560px) { .tbcal-months { grid-template-columns:1fr; } }
.tbcal-month { border:1px solid #EAE6E1; border-top:5px solid ${PINK}; border-radius:14px; padding:12px 14px; background:#fff; box-shadow:0 2px 14px rgba(0,0,0,0.04); }
.tbcal-month h3 { margin:0 0 10px; font-size:18px; font-weight:800; color:${DARK}; display:flex; justify-content:space-between; align-items:baseline; }
.tbcal-month h3 span { font-size:13px; font-weight:400; color:#7A8880; }
.tbcal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:3px; text-align:center; }
.tbcal-dow { font-size:12px; color:#7A8880; padding-bottom:4px; }
.tbcal-day { position:relative; aspect-ratio:1/1; display:flex; align-items:center; justify-content:center; font-size:14px; border-radius:8px; font-variant-numeric:tabular-nums; color:${DARK}; }
.tbcal-day.shabbat { background:#F6EDF3; color:#7A8880; }
.tbcal-day.today { box-shadow:inset 0 0 0 2px ${PINK}; color:${PINK}; font-weight:800; }
.tbcal-day.ev { font-weight:600; }
.tbcal-day .more { position:absolute; bottom:3px; inset-inline-end:4px; width:5px; height:5px; border-radius:50%; background:currentColor; opacity:.85; }
.tbcal-caps { list-style:none; margin:10px 0 0; padding:10px 0 0; border-top:1px solid #EAE6E1; display:grid; gap:5px; font-size:14px; }
.tbcal-caps li { display:flex; gap:8px; align-items:baseline; line-height:1.35; color:${DARK}; }
.tbcal-caps i { width:10px; height:10px; border-radius:50%; flex:none; transform:translateY(1px); }
.tbcal-caps b { font-weight:600; font-variant-numeric:tabular-nums; white-space:nowrap; color:#7A8880; }
.tbcal-caps small { display:block; color:#7A8880; font-size:12.5px; }
`

export default function YearCalendar() {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null)
  // Set on the client only, so server and client render the same markup.
  const [now, setNow] = useState<Date | null>(null)
  const [mode, setMode] = useState<'school' | 'cal'>('school')
  const [year, setYear] = useState<number | null>(null)
  const [active, setActive] = useState<Set<CalendarEventType>>(() => new Set(CALENDAR_TYPES))

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('site_calendar_events')
        .select(CALENDAR_SELECT)
        .order('start_date', { ascending: true })
      if (cancelled) return
      if (error) console.error('[calendar] query failed:', error.message)
      const today = new Date()
      setEvents((data ?? []) as CalendarEvent[])
      setNow(today)
      setYear(schoolStartYear(today))
    })()
    return () => { cancelled = true }
  }, [])

  const normalized = useMemo<Normalized[]>(
    () => (events ?? [])
      .map((e) => ({ ...e, s: parseDay(e.start_date), e: parseDay(e.end_date || e.start_date) }))
      .sort((a, b) => a.s.getTime() - b.s.getTime()),
    [events],
  )

  if (!now || year == null) {
    return <div style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7A8880' }}>טוען לוח שנה…</div>
  }

  const resetToToday = (m: 'school' | 'cal') => setYear(m === 'school' ? schoolStartYear(new Date()) : new Date().getFullYear())
  const switchMode = (m: 'school' | 'cal') => { setMode(m); resetToToday(m) }

  const startMonth = mode === 'school' ? 8 : 0
  const rangeStart = new Date(year, startMonth, 1)
  const rangeEnd = new Date(year, startMonth + 12, 0)
  const todayKey = dayKey(now.getFullYear(), now.getMonth(), now.getDate())

  const visible = normalized.filter((ev) => active.has(ev.type))
  const byDay: Record<string, Normalized[]> = {}
  for (const ev of visible) {
    for (let d = new Date(ev.s); d <= ev.e; d.setDate(d.getDate() + 1)) {
      const k = dayKey(d.getFullYear(), d.getMonth(), d.getDate())
      ;(byDay[k] ??= []).push(ev)
    }
  }

  const toggle = (t: CalendarEventType) => setActive((prev) => {
    const next = new Set(prev)
    if (next.has(t)) next.delete(t)
    else next.add(t)
    return next
  })

  return (
    <div className="tbcal">
      <style>{CSS}</style>

      <header className="tbcal-top">
        <h3 className="tbcal-range">
          {mode === 'school'
            ? <>שנת פעילות {rangeStart.getFullYear()}–{String(rangeEnd.getFullYear()).slice(2)}
                <small>{MONTHS_HE[rangeStart.getMonth()]} {rangeStart.getFullYear()} עד {MONTHS_HE[rangeEnd.getMonth()]} {rangeEnd.getFullYear()}</small></>
            : <>{year}<small>ינואר עד דצמבר</small></>}
        </h3>
        <div className="tbcal-controls">
          <div className="tbcal-seg" role="group" aria-label="סוג תצוגה">
            <button type="button" aria-pressed={mode === 'school'} onClick={() => switchMode('school')}>שנת לימודים</button>
            <button type="button" aria-pressed={mode === 'cal'} onClick={() => switchMode('cal')}>שנה אזרחית</button>
          </div>
          <div className="tbcal-nav">
            <button type="button" aria-label="שנה קודמת" onClick={() => setYear(year - 1)}>›</button>
            <button type="button" onClick={() => resetToToday(mode)}>היום</button>
            <button type="button" aria-label="שנה הבאה" onClick={() => setYear(year + 1)}>‹</button>
          </div>
        </div>
      </header>

      <div className="tbcal-legend" role="group" aria-label="סינון לפי סוג">
        {CALENDAR_TYPES.map((t) => (
          <button key={t} type="button" className="tbcal-chip" aria-pressed={active.has(t)} onClick={() => toggle(t)}>
            <i style={{ background: CALENDAR_TYPE_META[t].bg }} />{CALENDAR_TYPE_META[t].label}
          </button>
        ))}
      </div>

      <div className="tbcal-months">
        {Array.from({ length: 12 }, (_, i) => {
          const first = new Date(year, startMonth + i, 1)
          const y = first.getFullYear()
          const m = first.getMonth()
          const daysIn = new Date(y, m + 1, 0).getDate()
          const offset = first.getDay() // 0 = Sunday
          const mStart = new Date(y, m, 1)
          const mEnd = new Date(y, m + 1, 0)
          const inMonth = visible.filter((ev) => ev.s <= mEnd && ev.e >= mStart)

          return (
            <section key={`${y}-${m}`} className="tbcal-month">
              <h3>{MONTHS_HE[m]}<span>{y}</span></h3>
              <div className="tbcal-grid">
                {DOW.map((d) => <div key={d} className="tbcal-dow">{d}</div>)}
                {Array.from({ length: offset }, (_, b) => <div key={`b${b}`} />)}
                {Array.from({ length: daysIn }, (_, idx) => {
                  const d = idx + 1
                  const k = dayKey(y, m, d)
                  const evs = byDay[k]
                  const top = evs?.length ? CALENDAR_PRIORITY.find((p) => evs.some((e) => e.type === p)) : undefined
                  const cls = ['tbcal-day']
                  if (!top && (offset + d - 1) % 7 === 6) cls.push('shabbat')
                  if (k === todayKey) cls.push('today')
                  if (top) cls.push('ev')
                  return (
                    <div
                      key={k}
                      className={cls.join(' ')}
                      title={evs?.map((e) => e.title).join(' | ')}
                      style={top ? { background: CALENDAR_TYPE_META[top].bg, color: CALENDAR_TYPE_META[top].fg } : undefined}
                    >
                      {d}
                      {evs && evs.length > 1 && <span className="more" />}
                    </div>
                  )
                })}
              </div>

              {inMonth.length > 0 && (
                <ul className="tbcal-caps">
                  {inMonth.map((ev) => {
                    const sameDay = ev.s.getTime() === ev.e.getTime()
                    const sameMonth = ev.s.getMonth() === ev.e.getMonth() && ev.s.getFullYear() === ev.e.getFullYear()
                    const when = sameDay ? `${ev.s.getDate()}`
                      : sameMonth ? `${ev.s.getDate()}–${ev.e.getDate()}`
                      : `${ev.s.getDate()}/${ev.s.getMonth() + 1} – ${ev.e.getDate()}/${ev.e.getMonth() + 1}`
                    return (
                      <li key={ev.id}>
                        <i style={{ background: CALENDAR_TYPE_META[ev.type].bg }} />
                        <b>{when}</b>
                        <span>{ev.title}{ev.note && <small>{ev.note}</small>}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
