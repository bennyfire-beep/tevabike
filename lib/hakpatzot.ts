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

export const PRICE = 180

// Arbox payment link for the current round — one link priced per day; riders
// who registered for both days are told to set the quantity to 2 there.
// null → the confirmation screen says the link will be sent on WhatsApp.
export const PAY_URL: string | null = 'https://arbox.link/NqkgOCKC'

export const DATES = [
  { value: '2026-10-09', label: 'שישי 9.10', long: 'יום שישי 9 באוקטובר' },
  { value: '2026-10-16', label: 'שישי 16.10', long: 'יום שישי 16 באוקטובר' },
] as const

export const HOURS = '8:00–13:00'

export const DATE_VALUES: string[] = DATES.map((d) => d.value)
export const DATE_LABEL: Record<string, string> = Object.fromEntries(DATES.map((d) => [d.value, d.label]))

export const GROUP_LABEL: Record<string, string> = { mini: 'מיני גרביטי', full: 'גרביטי' }
export const AREA_LABEL: Record<string, string> = { misgav: 'משגב', mata_asher: 'מטה אשר', biriya: 'ביריה' }
