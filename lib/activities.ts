// Activities in the rider app (tables activities / activity_registrations,
// migration 20261016_activities.sql). Managed at
// app/admin/coordinator/activities, shown to riders on /student via
// app/api/activities/route.ts.

export const ACTIVITY_KINDS = ['camp', 'shuttle', 'trip', 'event', 'other'] as const
export type ActivityKind = (typeof ACTIVITY_KINDS)[number]

export const ACTIVITY_KIND_META: Record<ActivityKind, { label: string; icon: string }> = {
  camp:    { label: 'מחנה',       icon: '🏕️' },
  shuttle: { label: 'הקפצות',     icon: '🚐' },
  trip:    { label: 'טיול / טיסה', icon: '✈️' },
  event:   { label: 'אירוע',      icon: '🎉' },
  other:   { label: 'אחר',        icon: '🚵' },
}

export const REGISTRATION_STATUS_LABEL = {
  pending:   'ממתין לתשלום',
  paid:      'שולם',
  cancelled: 'בוטל',
} as const
export type RegistrationStatus = keyof typeof REGISTRATION_STATUS_LABEL

export type Activity = {
  id: string
  title: string
  kind: ActivityKind
  start_date: string
  end_date: string | null
  location: string | null
  description: string | null
  image_url: string | null
  capacity: number | null
  price: number | null
  pay_url: string | null
  published: boolean
  registration_open: boolean
  show_attendees: boolean
}

export const ACTIVITY_SELECT =
  'id, title, kind, start_date, end_date, location, description, image_url, capacity, price, pay_url, published, registration_open, show_attendees'

/** What /api/activities returns per activity to a rider. */
export type RiderActivity = Activity & {
  taken: number
  remaining: number | null // null = no limit
  closed: boolean
  attendees: string[]      // names of riders who opted in, e.g. "יונתן ל."
  hiddenCount: number      // registered riders who did not opt in
  mine: { id: string; status: RegistrationStatus; show_name: boolean } | null
}

/** "יונתן לוי" → "יונתן ל." — the most another rider ever sees. */
export function publicName(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

/** +972XXXXXXXXX, matching how Supabase Auth stores phone users. */
export function normalizePhone(raw: string | null | undefined): string {
  const d = (raw ?? '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('972')) return `+${d}`
  if (d.startsWith('0')) return `+972${d.slice(1)}`
  return `+972${d}`
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "6.12" or "6.12 – 9.12". */
export function formatActivityDates(a: Pick<Activity, 'start_date' | 'end_date'>): string {
  const f = (s: string) => {
    const [, m, d] = s.split('-').map(Number)
    return `${d}.${pad(m)}`
  }
  return a.end_date && a.end_date !== a.start_date ? `${f(a.start_date)} – ${f(a.end_date)}` : f(a.start_date)
}
