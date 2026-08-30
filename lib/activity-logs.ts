// ─────────────────────────────────────────────────────────────────────────────
// "פעילות אחרת" — an instructor's non-lesson activity report (צילום, תיקון
// אופניים, ...), reported with hours + a description and priced only once a
// salary admin approves it and sets an hourly rate.
//
// Shared between the instructor page (reporting), the coordinator screen
// (approving), and every pay report (summing what's approved) so the closed
// list and the money math can't drift between them.
// ─────────────────────────────────────────────────────────────────────────────

/** The closed list a report can pick from, plus the free-text "אחר". */
export const ACTIVITY_TYPES = ['צילום', 'תיקון אופניים', 'אחר'] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export const OTHER_ACTIVITY_TYPE: ActivityType = 'אחר'

export function isActivityType(v: unknown): v is ActivityType {
  return typeof v === 'string' && (ACTIVITY_TYPES as readonly string[]).includes(v)
}

export type ActivityStatus = 'pending' | 'approved' | 'rejected'

export const ACTIVITY_STATUS_LABEL: Record<ActivityStatus, string> = {
  pending:  'ממתין לאישור',
  approved: 'אושר',
  rejected: 'נדחה',
}

export const ACTIVITY_STATUS_COLOR: Record<ActivityStatus, string> = {
  pending:  '#f0b90b',
  approved: '#4ade80',
  rejected: '#f87171',
}

/** How an activity_type + activity_type_other pair should read on screen. */
export function activityLabel(type: string, other: string | null | undefined): string {
  return type === OTHER_ACTIVITY_TYPE && other ? other : type
}

const round2 = (n: number) => Math.round(n * 100) / 100

export interface ApprovedActivityRow {
  hours: number | string | null
  hourly_rate: number | string | null
}

/** hours × hourly_rate, summed — only meaningful for status='approved' rows. */
export function activityPayTotal(rows: readonly ApprovedActivityRow[]): number {
  return round2(rows.reduce((sum, r) => sum + Number(r.hours ?? 0) * Number(r.hourly_rate ?? 0), 0))
}
