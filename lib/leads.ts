// Shared constants for the public leads funnel — imported by both the public
// contact form (client) and the leads API route (server), so the allowed
// interest values can never drift between them.

export const LEAD_INTERESTS = [
  'חוג רכיבה — ילדים או מבוגרים',
  'סדנת רכיבה טכנית',
  'חוג טיולים',
  'אופניים ומרצ\'נדייז',
] as const

export type LeadInterest = (typeof LEAD_INTERESTS)[number]

// Distinct colour per interest area (used for the badges on the admin page).
export const INTEREST_COLOR: Record<string, string> = {
  'חוג רכיבה — ילדים או מבוגרים': '#a855f7', // purple
  'סדנת רכיבה טכנית':            '#ec4899', // pink
  'חוג טיולים':                  '#4cdb7a', // green
  'אופניים ומרצ\'נדייז':          '#81d4fa', // blue
}

// Training centres the lead can pick from in the contact form.
// Kept here (not inline in the form) so the server can validate against the
// exact same list the client renders.
export const LEAD_BRANCHES = [
  'משגב',
  'ביריה',
  'מטה אשר',
  'פרוד־עמירים',
  'חיפה והסביבה',
  'עדיין לא בטוח/ה',
] as const

export type LeadBranch = (typeof LEAD_BRANCHES)[number]

export const LEAD_STATUSES = [
  { value: 'new',         label: 'חדש' },
  { value: 'in_progress', label: 'בטיפול' },
  { value: 'closed',      label: 'נסגר' },
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]['value']

export const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  LEAD_STATUSES.map(s => [s.value, s.label]),
)
export const STATUS_COLOR: Record<string, string> = {
  new:         '#ff8f6b',
  in_progress: '#f0b90b',
  closed:      '#7a8f7d',
}

// Human labels for the `source` column. Anything not listed here is shown
// as-is (it will be whatever utm_source the ad platform sent).
export const SOURCE_LABEL: Record<string, string> = {
  website:   'אתר (אורגני)',
  instagram: 'אינסטגרם — ממומן',
  facebook:  'פייסבוק — ממומן',
  google:    'גוגל — ממומן',
  whatsapp:  'וואטסאפ',
  staff:     'הוזן ע״י צוות',
  manual:    'הוזן ידנית',
}
