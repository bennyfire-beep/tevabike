// ============================================================
// נתיב: lib/ics.ts
// בונה קובץ .ics (יומן, אירוע יחיד) — משמש להצמדה למיילים
// (מפגש ההיכרות של מורזין, לדוגמה)
// ============================================================

export type IcsEvent = {
  title: string
  /** YYYY-MM-DD */
  date: string
  /** HH:MM or HH:MM:SS */
  startTime: string
  /** HH:MM or HH:MM:SS */
  endTime: string
  location?: string | null
  description?: string | null
  /** IANA timezone name. Defaults to Asia/Jerusalem. */
  timezone?: string
}

function icsEscape(s: string) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

// "HH:MM" or "HH:MM:SS" → "HHMMSS"
function icsTime(time: string) {
  const parts = time.split(':')
  const [h, m, sec] = [parts[0] ?? '00', parts[1] ?? '00', parts[2] ?? '00']
  return `${h.padStart(2, '0')}${m.padStart(2, '0')}${sec.padStart(2, '0')}`
}

// "YYYY-MM-DD" + "HH:MM[:SS]" → "YYYYMMDDTHHMMSS" (local, paired with TZID)
function icsLocalDateTime(date: string, time: string) {
  return `${date.replace(/-/g, '')}T${icsTime(time)}`
}

/** Builds a single-event iCalendar (.ics) file as a string. */
export function buildICS(ev: IcsEvent): string {
  const tz = ev.timezone || 'Asia/Jerusalem'
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@tevabike.com`
  const dtStamp =
    new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Teva Bike//trip-reminders//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=${tz}:${icsLocalDateTime(ev.date, ev.startTime)}`,
    `DTEND;TZID=${tz}:${icsLocalDateTime(ev.date, ev.endTime)}`,
    `SUMMARY:${icsEscape(ev.title)}`,
    ev.location ? `LOCATION:${icsEscape(ev.location)}` : null,
    ev.description ? `DESCRIPTION:${icsEscape(ev.description)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((l): l is string => l !== null)

  return lines.join('\r\n')
}
