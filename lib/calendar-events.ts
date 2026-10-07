// Year-calendar events (table site_calendar_events, managed at
// /admin/coordinator/calendar, shown on the homepage by
// components/YearCalendar.tsx). See migration 20261007_site_calendar_events.sql.

export const CALENDAR_TYPES = ['holiday', 'closed', 'competition', 'camp', 'other'] as const
export type CalendarEventType = (typeof CALENDAR_TYPES)[number]

export type CalendarEvent = {
  id: string
  start_date: string // YYYY-MM-DD
  end_date: string | null
  type: CalendarEventType
  title: string
  note: string | null
}

export const CALENDAR_TYPE_META: Record<CalendarEventType, { label: string; bg: string; fg: string }> = {
  holiday:     { label: 'חג / חופשה',  bg: '#f2b134', fg: '#2b2100' },
  closed:      { label: 'אין פעילות',  bg: '#e0452f', fg: '#ffffff' },
  competition: { label: 'תחרות',       bg: '#2f7fd1', fg: '#ffffff' },
  camp:        { label: 'מחנה / טיול', bg: '#2f9a5b', fg: '#ffffff' },
  other:       { label: 'אירוע מיוחד', bg: '#1f9aa8', fg: '#ffffff' },
}

/** Which colour a day takes when several events share it. */
export const CALENDAR_PRIORITY: CalendarEventType[] = ['closed', 'competition', 'camp', 'holiday', 'other']

export const CALENDAR_SELECT = 'id, start_date, end_date, type, title, note'

export const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

/** Parses YYYY-MM-DD as a local date (no UTC shift). */
export const parseDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "11–13 בספטמבר", "25/9 – 3/10" or "1 בספטמבר". */
export function formatEventRange(e: Pick<CalendarEvent, 'start_date' | 'end_date'>) {
  const s = parseDay(e.start_date)
  const en = parseDay(e.end_date || e.start_date)
  if (s.getTime() === en.getTime()) return `${s.getDate()} ב${MONTHS_HE[s.getMonth()]} ${s.getFullYear()}`
  if (s.getMonth() === en.getMonth() && s.getFullYear() === en.getFullYear())
    return `${s.getDate()}–${en.getDate()} ב${MONTHS_HE[s.getMonth()]} ${s.getFullYear()}`
  return `${s.getDate()}/${s.getMonth() + 1}/${s.getFullYear()} – ${en.getDate()}/${en.getMonth() + 1}/${en.getFullYear()}`
}
