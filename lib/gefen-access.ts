// ─────────────────────────────────────────────────────────────────────────────
// Who may log hours for the "גפן" special activity — the "★ גפן" tab on the
// instructor screen (app/admin/instructor/page.tsx).
//
// Deliberately separate from SALARY_ADMINS (lib/salary-access.ts): that list
// decides who may SEE pay; this one decides who may fill in the Gefen form at
// all. Benny is on both lists for different reasons — here because he logs his
// own (unpaid) Gefen hours, there because he is a salary admin.
//
// UI-only gating, same as the rest of this app's per-person screens (e.g.
// isBenny) — the real payroll enforcement is that only a salary admin can ever
// read staff_pay or the pay reports. A stray insert from someone not on this
// list would just be an ordinary special-activity session, priced at their own
// rate rather than the fixed Gefen one, since it would come in with
// is_gefen unset from a screen these two are the only ones shown.
// ─────────────────────────────────────────────────────────────────────────────

export const GEFEN_USERS = [
  'bennyfire@gmail.com',   // בני להט
  'talmatoki@gmail.com',   // טל ברקן
] as const

export function isGefenUser(email: string | null | undefined): boolean {
  if (!email) return false
  return (GEFEN_USERS as readonly string[]).includes(email.trim().toLowerCase())
}
