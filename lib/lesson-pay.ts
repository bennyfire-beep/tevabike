// ─────────────────────────────────────────────────────────────────────────────
// What one ordinary lesson pays.
//
// Every instructor has one of two models, on `staff_pay.lesson_pay_model`:
//
//   flat          — staff_pay.rate_per_lesson, the same for every lesson.
//   by_attendance — the rate depends on how many riders actually turned up:
//                   present_count >= attendance_threshold → attendance_rate_high,
//                   anything less                         → attendance_rate_low.
//
// Special activities (מחנה, ימי שיא) are untouched by either model — they are
// always duration × hourly_rate.
//
// Every pay screen runs its lessons through lessonRateFor, so the two models
// cannot drift apart between screens — the same job lib/travel.ts does for
// travel reimbursement.
// ─────────────────────────────────────────────────────────────────────────────

import { DEFAULT_RATE_PER_LESSON } from './attendance'

export type LessonPayModel = 'flat' | 'by_attendance'

export const LESSON_PAY_MODELS: LessonPayModel[] = ['flat', 'by_attendance']

export const LESSON_PAY_LABEL: Record<LessonPayModel, string> = {
  flat:          'קבוע',
  by_attendance: 'לפי נוכחות',
}

export const LESSON_PAY_HINT: Record<LessonPayModel, string> = {
  flat:          'אותו תעריף לכל שיעור רגיל',
  by_attendance: 'התעריף לכל שיעור נקבע לפי מספר החניכים שנכחו בו',
}

// Used for an instructor whose staff_pay row has nothing in these columns.
export const DEFAULT_ATTENDANCE_RATE_LOW  = 90
export const DEFAULT_ATTENDANCE_RATE_HIGH = 150
export const DEFAULT_ATTENDANCE_THRESHOLD = 9

export interface LessonPayFields {
  lesson_pay_model: string | null
  rate_per_lesson: number | null
  attendance_rate_low: number | null
  attendance_rate_high: number | null
  attendance_threshold: number | null
}

/** The stored number when there is one, the fallback when there isn't — 0 is a real value. */
function numOr(v: unknown, fallback: number): number {
  if (v == null || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/** Normalise whatever came back from staff_pay into a usable config. */
export function lessonPayConfigOf(row: Partial<LessonPayFields> | undefined | null): {
  model: LessonPayModel; flat: number; low: number; high: number; threshold: number
} {
  return {
    model:     row?.lesson_pay_model === 'by_attendance' ? 'by_attendance' : 'flat',
    flat:      numOr(row?.rate_per_lesson,      DEFAULT_RATE_PER_LESSON),
    low:       numOr(row?.attendance_rate_low,  DEFAULT_ATTENDANCE_RATE_LOW),
    high:      numOr(row?.attendance_rate_high, DEFAULT_ATTENDANCE_RATE_HIGH),
    threshold: numOr(row?.attendance_threshold, DEFAULT_ATTENDANCE_THRESHOLD),
  }
}

/**
 * When a lesson is co-taught, each credited instructor's band is judged
 * against present ÷ number of instructors credited (rounded up), not the
 * raw headcount — two instructors sharing 15 riders are each judged as if
 * they'd taught 8, not 15. This only changes which band a lesson falls
 * into; pay is never split, each credited instructor still gets their own
 * full per-lesson rate at whatever band that adjusted number lands on.
 * A solo-taught lesson (instructorCount <= 1) is unaffected.
 */
export function coTaughtPresent(
  presentCount: number | null | undefined,
  instructorCount: number,
): number {
  const p = Number(presentCount) || 0
  const n = Math.max(1, Math.trunc(instructorCount) || 1)
  return n <= 1 ? p : Math.ceil(p / n)
}

/**
 * What one ordinary lesson pays this instructor.
 *
 * `presentCount` — riders marked present in that lesson, already adjusted by
 *                  coTaughtPresent() if the lesson was co-taught. Null
 *                  (attendance was never saved) counts as none present, i.e.
 *                  the low rate.
 */
export function lessonRateFor(
  row: Partial<LessonPayFields> | undefined | null,
  presentCount: number | null | undefined,
): number {
  const cfg = lessonPayConfigOf(row)
  if (cfg.model === 'flat') return cfg.flat
  return (Number(presentCount) || 0) >= cfg.threshold ? cfg.high : cfg.low
}

/** A month's lesson pay: every lesson priced on its own attendance. */
export function lessonPayFor(
  row: Partial<LessonPayFields> | undefined | null,
  presentCounts: Array<number | null | undefined>,
): number {
  return Math.round(
    presentCounts.reduce<number>((sum, pc) => sum + lessonRateFor(row, pc), 0) * 100,
  ) / 100
}

/** How the two bands are set, for the report screens. */
export function attendanceBandDetail(
  row: Partial<LessonPayFields> | undefined | null,
  lessons: number,
): string {
  const cfg = lessonPayConfigOf(row)
  return `${lessons} שיעורים · לפי נוכחות (עד ${cfg.threshold - 1} → ₪${cfg.low}, מ־${cfg.threshold} → ₪${cfg.high})`
}
