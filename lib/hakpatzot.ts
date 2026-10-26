// Shared config for the shuttle-day ("הקפצות") registration — used by the
// public form (app/hakpatzot), its API (app/api/hakpatzot) and the
// coordinator screen (app/admin/coordinator/hakpatzot), so the dates, price
// and cap can never drift between them.
//
// Each round of shuttle days gets its own dates here. Registrations are
// stored per date (hakpatzot_registrations.event_date), so switching to new
// dates starts every counter from zero while earlier rounds stay in the
// table as history (event_date null = the original Misgav-Yaad day).

// Hard cap per date — vehicles are booked, not elastic.
export const CAPACITY = 15

// Manual override to close registration early (e.g. the coordinator filled
// the vehicles through other channels before the online count hit CAPACITY).
// true → the public form and API treat every date as closed regardless of
// the actual count; existing registrations and the admin screen are
// unaffected. Reset to false when opening the next round.
export const REGISTRATION_CLOSED = false

// Current round: one training day ahead of the Israel Championship.
export const PRICE = 150

// Arbox payment link — same link reused across rounds; riders are told the
// price on this page, Arbox itself is configured separately per round.
// null → the confirmation screen says the link will be sent on WhatsApp.
export const PAY_URL: string | null = 'https://arbox.link/NqkgOCKC'

export const DATES = [
  { value: '2026-10-30', label: 'שישי 30.10', long: 'יום שישי 30 באוקטובר' },
] as const

export const HOURS = '8:00–13:00'

export const DATE_VALUES: string[] = DATES.map((d) => d.value)
export const DATE_LABEL: Record<string, string> = Object.fromEntries(DATES.map((d) => [d.value, d.label]))

export const GROUP_LABEL: Record<string, string> = { mini: 'מיני גרביטי', full: 'גרביטי' }
export const AREA_LABEL: Record<string, string> = { misgav: 'משגב', mata_asher: 'מטה אשר', biriya: 'ביריה' }
