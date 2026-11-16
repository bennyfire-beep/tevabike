// Shared config for the club inauguration ("חנוכת מועדון") registration — used
// by the public form (app/hanukat-moadon), its API (app/api/club-opening) and
// the coordinator screen (app/admin/coordinator/club-opening), so the date,
// groups and food options can never drift between them.
//
// Registrations are stored per date (club_opening_registrations.event_date),
// so a future event starts from zero and this one stays as history.

export const EVENT_DATE = '2026-12-04'
export const EVENT_DATE_LABEL = 'יום שישי, 4.12'
export const LOCATION = 'אתגר'

export const SCHEDULE = [
  { time: '08:00', label: 'התכנסות', emoji: '👋' },
  { time: '08:30–10:30', label: 'תחרות היתולית על אופני 20 אינץ׳', emoji: '🚲' },
  { time: '10:30', label: 'עולים למועדון — כיבוד וחנוכת המועדון', emoji: '🎉' },
] as const

// What kind of attendance — the activity (competition + party) or only the
// party at the club at 10:30.
export const PARTICIPATION = [
  { value: 'activity', label: 'פעילות + חנוכת מועדון', sub: '08:00 באתגר — תחרות, ואז עולים למועדון' },
  { value: 'party_only', label: 'רק כיבוד וחנוכת מועדון', sub: '10:30 במועדון' },
] as const
export const PARTICIPATION_VALUES: string[] = PARTICIPATION.map((p) => p.value)
export const PARTICIPATION_LABEL: Record<string, string> = Object.fromEntries(
  PARTICIPATION.map((p) => [p.value, p.label])
)

// Every Teva Bike group, plus a catch-all for family and friends. Branch names
// match groups.branch (see app/register/page.tsx BRANCHES).
export const GROUPS = [
  'משגב — ילדים',
  'ביריה',
  'מטה אשר',
  'פרוד-אמירים',
  'צורית-גילון',
  'גרביטי מתחילים',
  'גרביטי מיני',
  'גרביטי פרו / תחרותי',
  'מבוגרים',
  'צוות טבע בייק',
  'חברים, משפחה ואורחים',
] as const
export const GROUP_VALUES: string[] = [...GROUPS]

// The "bring something" options. People can pick several; the public form
// shows how many families already signed up for each so the table ends up
// balanced.
export const FOOD = [
  { value: 'pastries', label: 'מאפים', emoji: '🥐' },
  { value: 'vegetables', label: 'ירקות', emoji: '🥕' },
  { value: 'pita_labane', label: 'פיתות ולבנה', emoji: '🫓' },
  { value: 'hummus', label: 'חומוס', emoji: '🧆' },
  { value: 'drinks', label: 'שתייה קלה', emoji: '🥤' },
  { value: 'other', label: 'משהו אחר', emoji: '🎁' },
] as const
export const FOOD_VALUES: string[] = FOOD.map((f) => f.value)
export const FOOD_LABEL: Record<string, string> = Object.fromEntries(
  FOOD.map((f) => [f.value, `${f.emoji} ${f.label}`])
)

// Per-registration limits (a family with several kids, grandparents, etc).
export const MAX_RIDERS = 6
export const MAX_ATTENDEES = 10
