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
