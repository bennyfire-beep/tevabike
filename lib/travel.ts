// travel.ts v3 — ק״מ ידני לחודש + דיווח ק״מ יומי של המדריך
// ─────────────────────────────────────────────────────────────────────────────
// Travel reimbursement.
//
// Every instructor has their own arrangement, configured on /admin/instructors
// and stored on `staff_pay`:
//
//   per_km        — reimbursed per kilometre, from the best source available:
//                     1. a manual override for the month — a row in
//                        `instructor_travel` with mode = 'manual_km', typed into
//                        the salary report. Beats everything else.
//                     2. the days the instructor reported themselves from the
//                        mobile page — the month's `instructor_travel_days` km
//                        added up, × travel_rate.
//                     3. failing both, the standing estimate: working days ×
//                        travel_km × travel_rate. "Working days" means days
//                        actually taught that month (distinct session dates),
//                        not scheduled days.
//   none          — no reimbursement (company vehicle).
//   monthly_fixed — a flat monthly sum. staff_pay.travel_monthly_amount is the
//                   default; a given month can override it with a row in
//                   `instructor_travel` (UNIQUE per instructor+month), editable
//                   straight from the salary report.
//
// Either kind of override lands in `instructor_travel.amount` as the final
// shekel figure, so the reports, the reminders and the cron all read one column.
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
 *                   exists. Consulted for monthly_fixed and for per_km alike;
 *                   for per_km it is the manual kilometres already multiplied
 *                   by the instructor's rate.
 * `dailyKmSum` — the km the instructor reported themselves this month
 *                (instructor_travel_days), or null when they reported none.
 *                A reported 0 is a real figure, not "nothing reported".
 */
export function computeTravel(
  row: Partial<TravelConfig> | undefined | null,
  workingDays: number,
  monthOverride?: number | null,
  dailyKmSum?: number | null,
): number {
  const cfg = travelConfigOf(row)

  switch (cfg.type) {
    case 'per_km':
      // A manual-km row for the month replaces everything below it.
      if (monthOverride != null) return Math.round(monthOverride * 100) / 100
      // Then what the instructor actually reported, day by day.
      if (dailyKmSum != null) return Math.round(dailyKmSum * cfg.rate * 100) / 100
      return Math.round(workingDays * cfg.km * cfg.rate * 100) / 100
    case 'monthly_fixed':
      // An explicitly entered 0 for the month is a real value, not "unset".
      return Math.round((monthOverride ?? cfg.monthly) * 100) / 100
    case 'none':
    default:
      return 0
  }
}

/**
 * One-line description of how a travel figure was reached, for the reports.
 *
 * `overrideKm` — the manual kilometres entered for this month, when a per_km
 *                instructor has a manual_km row.
 * `dailyKmSum` — the km they reported themselves this month, when they did.
 *
 * The order matches computeTravel, so the line always describes the figure
 * actually paid.
 */
export function travelDetail(
  row: Partial<TravelConfig> | undefined | null,
  workingDays: number,
  overrideKm?: number | null,
  dailyKmSum?: number | null,
): string {
  const cfg = travelConfigOf(row)
  switch (cfg.type) {
    case 'per_km':
      if (overrideKm != null) return `${overrideKm} ק״מ ידני × ₪${cfg.rate}`
      if (dailyKmSum != null) return `${dailyKmSum} ק״מ מדווח × ₪${cfg.rate}`
      return `${workingDays} ימים × ${cfg.km} ק״מ × ₪${cfg.rate}`
    case 'monthly_fixed':
      return 'סכום חודשי'
    case 'none':
    default:
      return 'ללא החזר'
  }
}
