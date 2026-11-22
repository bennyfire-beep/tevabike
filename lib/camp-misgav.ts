// מחנה חנוכה במשגב — בקרי רכיבה לקבוצות מיני גרביטי ומתחילים, 6–8.12.2026.
// Shared by the public page, the registration API and the coordinator screen.
//
// Registration is per day (200 ₪ each). Every day has its own Arbox payment
// link — paste them into PAY_LINKS below; an empty string means "the link
// isn't ready yet" and the page tells the parent it will be sent separately.

export type CampDay = { key: string; label: string; short: string }

export const MISGAV_DAYS: CampDay[] = [
  { key: '2026-12-06', label: 'יום ראשון, 6.12', short: 'א׳ 6.12' },
  { key: '2026-12-07', label: 'יום שני, 7.12',  short: 'ב׳ 7.12' },
  { key: '2026-12-08', label: 'יום שלישי, 8.12', short: 'ג׳ 8.12' },
]

export const MISGAV_PAY_LINKS: Record<string, string> = {
  '2026-12-06': '',   // ← קישור Arbox ליום ראשון 6.12
  '2026-12-07': '',   // ← קישור Arbox ליום שני 7.12
  '2026-12-08': '',   // ← קישור Arbox ליום שלישי 8.12
}

export const MISGAV_PRICE_PER_DAY = 200
export const MISGAV_MIN_PER_DAY = 8

export const MISGAV_GROUPS = ['מיני גרביטי משגב', 'מתחילים', 'מיני גרביטי ביריה', 'מטה אשר', 'אחר']

export const MISGAV_INSTRUCTORS = ['ארז דגן', 'אלון טירוש', 'אופיר כהן']

export const isMisgavDay = (key: string) => MISGAV_DAYS.some(d => d.key === key)
export const misgavDayLabel = (key: string) => MISGAV_DAYS.find(d => d.key === key)?.label ?? key
