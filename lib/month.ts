// ─────────────────────────────────────────────────────────────────────────────
// Month boundaries for the pay screens.
//
// This exists because of one bug worth remembering. The old inline version was
//
//     const last = new Date(y, m, 0).toISOString().split('T')[0]
//
// and `new Date(y, m, 0)` is midnight LOCAL on the last day of the month, while
// toISOString() renders UTC. East of Greenwich that subtracts a few hours and
// lands on the previous day: in Israel (UTC+2/+3), the last day of August 2026
// came out as 2026-08-30. Every screen that filtered `session_date <= last` was
// quietly dropping the final day of the month — lessons taught on the 31st were
// missing from the report, and the same code in a server route (UTC, no offset)
// disagreed with the browser about which days the month even contained.
//
// Formatting the local date by hand has no timezone in it at all, so it gives
// the same answer in a browser in Israel and in a Vercel function in UTC.
// ─────────────────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')

/** A Date rendered as YYYY-MM-DD in its own local terms — never via UTC. */
export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** The month we are in, as YYYY-MM. */
export function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** Today, as YYYY-MM-DD. */
export function today(): string {
  return toYmd(new Date())
}

/** First and last calendar day of a YYYY-MM month, inclusive, as YYYY-MM-DD. */
export function monthBounds(ym: string): { first: string; last: string } {
  const [y, m] = ym.split('-').map(Number)
  return { first: `${ym}-01`, last: toYmd(new Date(y, m, 0)) }
}

/** "אוגוסט 2026" */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
}
