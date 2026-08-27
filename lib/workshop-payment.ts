// ─────────────────────────────────────────────────────────────────────────────
// Workshop payment status.
//
// Most people pay through Arbox, which syncs itself. The rest pay by PayBox,
// Bit or bank transfer, and a coordinator marks them paid by hand on
// /admin/coordinator/workshops.
//
// Marking someone paid also writes a line into `notes` — how and when — so the
// screen alone says where the money came from. `notes` is a running log
// separated by " | ", so the line is appended, never written over.
//
// The screen and the API route share this module, so the labels the coordinator
// picks from and the text that lands in the database cannot drift apart.
// ─────────────────────────────────────────────────────────────────────────────

export const PAYMENT_STATUSES = ['pending', 'paid'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: 'ממתין לתשלום',
  paid:    'שולם',
}

export const PAYMENT_METHODS = ['arbox', 'paybox', 'bit', 'bank', 'other'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** What the coordinator picks from. */
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  arbox:  'ארבוקס',
  paybox: 'פייבוקס',
  bit:    'ביט',
  bank:   'העברה בנקאית',
  other:  'אחר',
}

// The note reads "שולם ב<אמצעי>", so 'other' needs a noun that follows ב־
// sensibly — "שולם באמצעי אחר", not "שולם באחר".
const NOTE_METHOD: Record<PaymentMethod, string> = {
  ...PAYMENT_METHOD_LABEL,
  other: 'אמצעי אחר',
}

export const isPaymentStatus = (v: unknown): v is PaymentStatus =>
  typeof v === 'string' && (PAYMENT_STATUSES as readonly string[]).includes(v)

export const isPaymentMethod = (v: unknown): v is PaymentMethod =>
  typeof v === 'string' && (PAYMENT_METHODS as readonly string[]).includes(v)

/**
 * The line appended to notes when a payment is recorded — "שולם בפייבוקס 27.8.2026".
 *
 * The date is the date in Israel, not on the server: Vercel runs in UTC, and a
 * payment entered late in the evening would otherwise be logged as yesterday.
 */
export function paymentNote(method: PaymentMethod, now: Date = new Date()): string {
  const date = new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric', year: 'numeric',
  }).format(now)
  return `שולם ב${NOTE_METHOD[method]} ${date}`
}

/** Append to the running log, using the " | " separator already in the column. */
export function appendNote(existing: string | null | undefined, line: string): string {
  const prev = (existing ?? '').trim()
  return prev ? `${prev} | ${line}` : line
}
