// ─────────────────────────────────────────────────────────────────────────────
// Travel reimbursement.
//
// Every instructor has their own arrangement, configured on /admin/instructors
// and stored on `staff_pay`:
//
//   per_km        — reimbursed per kilometre: working days × travel_km × travel_rate.
//                   "Working days" means days actually taught that month (distinct
//                   session dates), not scheduled days.
//   none          — no reimbursement (company vehicle).
//   monthly_fixed — a flat monthly sum. staff_pay.travel_monthly_amount is the
//                   default; a given month can override it with a row in
//                   `instructor_travel` (UNIQUE per instructor+month), editable
//                   straight from the salary report.
//
// Every pay report runs its travel through computeTravel so the three
// arrangements cannot drift apart between screens.
// ─────────────────────────────────────────────────────────────────────────────

export type TravelType = 'per_km' | 'none' | 'monthly_fixed'

export const TRAVEL_TYPES: TravelType[] = ['per_km', 'none', 'monthly_fixed']

export const TRAVEL_LABEL: Record<TravelType, string> = {
  per_km:        'לפי ק״מ',
  none:          'ללא החזר',
  monthly_fixed: 'סכום חודשי',
}

export const TRAVEL_HINT: Record<TravelType, string> = {
  per_km:        'ימי עבודה בפועל × ק״מ × תעריף',
  none:          'רכב מהעבודה — לא מתווסף לשכר',
  monthly_fixed: 'סכום קבוע לחודש, ניתן לעריכה בדוח השכר',
}

export interface TravelConfig {
  travel_type: string | null
  travel_km: number | null
  travel_rate: number | null
  travel_monthly_amount: number | null
}

/** Normalise whatever came back from staff_pay into a usable config. */
export function travelConfigOf(row: Partial<TravelConfig> | undefined | null): {
  type: TravelType; km: number; rate: number; monthly: number
} {
  const t = row?.travel_type
  return {
    type:    t === 'per_km' || t === 'monthly_fixed' ? t : 'none',
    km:      Number(row?.travel_km ?? 0) || 0,
    rate:    Number(row?.travel_rate ?? 0) || 0,
    monthly: Number(row?.travel_monthly_amount ?? 0) || 0,
  }
}

/**
 * Travel pay for one instructor for one month.
 *
 * `workingDays` — distinct dates the instructor actually taught that month.
 * `monthOverride` — the instructor_travel amount for this month, when a row
 *                   exists. Only consulted for monthly_fixed.
 */
export function computeTravel(
  row: Partial<TravelConfig> | undefined | null,
  workingDays: number,
  monthOverride?: number | null,
): number {
  const cfg = travelConfigOf(row)

  switch (cfg.type) {
    case 'per_km':
      return Math.round(workingDays * cfg.km * cfg.rate * 100) / 100
    case 'monthly_fixed':
      // An explicitly entered 0 for the month is a real value, not "unset".
      return Math.round((monthOverride ?? cfg.monthly) * 100) / 100
    case 'none':
    default:
      return 0
  }
}

/** One-line description of how a travel figure was reached, for the reports. */
export function travelDetail(
  row: Partial<TravelConfig> | undefined | null,
  workingDays: number,
): string {
  const cfg = travelConfigOf(row)
  switch (cfg.type) {
    case 'per_km':
      return `${workingDays} ימים × ${cfg.km} ק״מ × ₪${cfg.rate}`
    case 'monthly_fixed':
      return 'סכום חודשי'
    case 'none':
    default:
      return 'ללא החזר'
  }
}
