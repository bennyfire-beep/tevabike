// מחנה חנוכה במשגב — בקרי רכיבה לקבוצות מיני גרביטי ומתחילים, 6–7.12.2026.
// If it rains, the day is postponed to another date and parents get a message in advance.
// Shared by the public page, the registration API and the coordinator screen.
//
// Registration is per day, each day with its own price. Day 1 is a free
// make-up day ("יום החזר"); day 2 is the airbag + forest day and is paid
// through its Arbox link. A paid day with an empty link means "the link isn't
// ready yet" and the page tells the parent it will be sent separately.

export type CampDay = { key: string; label: string; short: string; price: number; title: string }

export const MISGAV_DAYS: CampDay[] = [
  { key: '2026-12-06', label: 'יום ראשון, 6.12', short: 'א׳ 6.12', price: 0,   title: 'יום החזר · רכיבה ביער' },
  { key: '2026-12-07', label: 'יום שני, 7.12',  short: 'ב׳ 7.12', price: 200, title: 'איירבג וסינגלים חדשים ביער' },
]

export const MISGAV_PAY_LINKS: Record<string, string> = {
  '2026-12-07': 'https://arbox.link/yBSdSkyb',
}
export const MISGAV_MIN_PER_DAY = 8

export const MISGAV_GROUPS = ['מיני גרביטי משגב', 'מתחילים', 'מיני גרביטי ביריה', 'מטה אשר', 'אחר']

export const MISGAV_RAIN_NOTE = 'במקרה של גשם היום יידחה ליום אחר, ותצא הודעה מראש לכל הנרשמים.'

export const MISGAV_INSTRUCTORS = ['ארז דגן', 'אלון טירוש', 'אופיר כהן']

export const isMisgavDay = (key: string) => MISGAV_DAYS.some(d => d.key === key)
export const misgavDayPrice = (key: string) => MISGAV_DAYS.find(d => d.key === key)?.price ?? 0
export const misgavPriceText = (price: number) => price ? `${price} ₪` : 'ללא עלות'
export const misgavDayLabel = (key: string) => MISGAV_DAYS.find(d => d.key === key)?.label ?? key
