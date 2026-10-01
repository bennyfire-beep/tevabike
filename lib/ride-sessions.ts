// Shared config for guided ride sessions ("סשן רכיבה") — one-off day rides in
// the spirit of outdoor-cafe.com's "רכיבה בארץ" events: open to Teva Bike
// riders and to guests, at two prices. Used by the public pages (app/rides),
// the API (app/api/rides) and the coordinator screen
// (app/admin/coordinator/rides), so prices, caps and dates can never drift
// between them.
//
// Adding a ride = adding an entry to SESSIONS. Registrations are stored per
// slug (ride_session_registrations.session_slug), so a past ride's rows stay
// as history once its entry is removed or its date has passed.

// A Teva Bike rider pays MEMBER_PRICE, anyone else GUEST_PRICE. The server
// decides which one applies by looking the phone number up in `riders`
// (phone or parent_phone) — the form's "I'm a Teva Bike rider" toggle is only
// a claim, never trusted on its own.
export const MEMBER_PRICE = 90
export const GUEST_PRICE = 250

export type RiderType = 'member' | 'guest'

export const RIDER_TYPE_LABEL: Record<RiderType, string> = {
  member: 'רוכב/ת טבע בייק',
  guest: 'אורח/ת',
}

export const priceFor = (t: RiderType) => (t === 'member' ? MEMBER_PRICE : GUEST_PRICE)

export const LEVELS = [
  { value: 'beginner', label: 'מתחיל/ה' },
  { value: 'intermediate', label: 'בינוני/ת' },
  { value: 'advanced', label: 'מתקדם/ת' },
] as const

export const LEVEL_LABEL: Record<string, string> = Object.fromEntries(LEVELS.map((l) => [l.value, l.label]))
export const LEVEL_VALUES: string[] = LEVELS.map((l) => l.value)

export type RideSession = {
  slug: string
  title: string
  /** ISO date — the ride counts as past (and closes) the day after. */
  date: string
  dateLabel: string
  hours: string
  location: string
  meetingPoint: string
  /** Waze / Google Maps link to the meeting point. null hides the button. */
  navUrl: string | null
  guide: string
  distanceKm: number
  climbM: number
  routeCharacter: string
  routeType: string
  technicalLevel: string
  fitnessLevel: string
  terrain: string
  summary: string
  description: string[]
  capacity: number
  image: string
  /** Arbox payment links per price. null → the link is sent on WhatsApp. */
  payUrl: { member: string | null; guest: string | null }
}

// TODO(בני): פרטי הרכיבה הראשונה הם דוגמה — לעדכן תאריך, מקום, מסלול,
// מדריך וקישורי תשלום לפני שמפרסמים את הקישור.
export const SESSIONS: RideSession[] = [
  {
    slug: 'misgav-autumn-ride',
    title: 'סינגלים של משגב | רכיבת סתיו',
    date: '2026-10-23',
    dateLabel: 'שישי 23.10',
    hours: '8:00–11:30',
    location: 'משגב, הגליל התחתון',
    meetingPoint: 'מועדון טבע בייק, רקפת',
    navUrl: null,
    guide: 'מיכאל איזנשטין',
    distanceKm: 22,
    climbM: 450,
    routeCharacter: 'סינגלים ושבילים רחבים',
    routeType: 'מעגלי',
    technicalLevel: 'בינונית',
    fitnessLevel: 'בינונית',
    terrain: 'סלע גלילי ואדמה',
    summary: 'בוקר של סינגלים זורמים ביערות משגב, עם עצירת קפה ונוף לעמקים.',
    description: [
      'מצטרפים אלינו לבוקר של רכיבה מודרכת בסינגלים הכי יפים של משגב — שבילים זורמים בין עצי אלון ואורן, תצפיות לבקעת בית הכרם ועצירת קפה באמצע.',
      'הרכיבה פתוחה לרוכבי טבע בייק ולאורחים. המדריכים שלנו ילוו את הקבוצה לאורך כל המסלול, יעצרו לטיפים טכניים במקומות המאתגרים וידאגו שכולם נהנים בקצב שלהם.',
    ],
    capacity: 20,
    image: '/misgav.jpg',
    payUrl: { member: null, guest: null },
  },
]

export const SESSION_SLUGS: string[] = SESSIONS.map((s) => s.slug)

export const sessionBySlug = (slug: string) => SESSIONS.find((s) => s.slug === slug)

/** Israel-local "today" as YYYY-MM-DD, so a ride closes at local midnight. */
export function todayInIsrael(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())
}

export const isPast = (s: RideSession) => s.date < todayInIsrael()

/** Last 9 digits — the common part of 054-1234567, 0541234567 and +972541234567. */
export function phoneKey(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  return digits.length >= 9 ? digits.slice(-9) : ''
}
