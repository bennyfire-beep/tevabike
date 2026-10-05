// Shared config for the parents' meeting ("אסיפת הורים") registration — used
// by the public form (app/asefat-horim), its API (app/api/parent-meeting) and
// the coordinator screen (app/admin/coordinator/parent-meeting), so the date
// and sessions can never drift between them.
//
// For the next meeting, change MEETING_DATE (and the labels/sessions) here.
// Registrations are stored per date (parent_meeting_registrations.meeting_date),
// so the new meeting starts from zero and earlier ones stay as history.

export const MEETING_DATE = '2026-10-21'
export const MEETING_DATE_LABEL = 'יום רביעי, 21.10'
export const LOCATION = 'מועדון טבע בייק, רקפת'

export const SESSIONS = [
  { value: 'beginners_mini', label: 'גרביטי מתחילים ומיני', hours: '19:15–20:15' },
  { value: 'pro', label: 'גרביטי פרו / תחרותי', hours: '20:30–21:30' },
] as const

export const SESSION_VALUES: string[] = SESSIONS.map((s) => s.value)
export const SESSION_LABEL: Record<string, string> = Object.fromEntries(
  SESSIONS.map((s) => [s.value, `${s.label} · ${s.hours}`])
)

// How many people can be listed per registration (two parents + a grandparent, etc).
export const MAX_ATTENDEES = 4
