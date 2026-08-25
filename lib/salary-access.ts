// ─────────────────────────────────────────────────────────────────────────────
// Who may see pay.
//
// Single source of truth for the UI. It mirrors the `is_salary_admin()`
// function in Postgres, which is the actual enforcement — RLS on staff_pay,
// instructor_travel and admin_roles writes checks that function, so a direct
// REST call with any other valid token returns nothing regardless of what the
// UI decides to render.
//
// Keep this list and the SQL function in step. The SQL function matches on
// user id first and falls back to email.
// ─────────────────────────────────────────────────────────────────────────────

export const SALARY_ADMINS = [
  'bennyfire@gmail.com',
  'shirkobi8@gmail.com',
] as const

export function isSalaryAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return (SALARY_ADMINS as readonly string[]).includes(email.trim().toLowerCase())
}

// Destructive actions (deleting a session, e.g. one opened by mistake) are
// restricted to Benny specifically, even though Shir sees the same payroll
// numbers as a salary admin. This mirrors the class_sessions DELETE RLS
// policy (is_benny() in Postgres) — that's the real enforcement; this is
// just what decides whether the UI shows the button at all.
export function isBenny(email: string | null | undefined): boolean {
  if (!email) return false
  return email.trim().toLowerCase() === 'bennyfire@gmail.com'
}
