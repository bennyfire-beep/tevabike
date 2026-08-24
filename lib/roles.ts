// ─────────────────────────────────────────────────────────────────────────────
// One person, several jobs.
//
// `admin_roles` is one row per job, not per person, and a few people hold more
// than one: Tal Barkan already does, and Benny is about to be coordinator AND
// instructor. Every screen that resolved a user with
//
//     .from('admin_roles').select('role').eq('user_id', uid).single()
//
// broke on exactly those people — PostgREST returns an error, not a row, when
// `.single()` matches two, so the login failed outright rather than picking a
// job. This module is the one place that decides which row wins.
//
// Two different questions, two different helpers:
//
//   "Where does this person land, and what does the nav look like?"
//        → primaryRow / rolesOf. Priority order, admin first.
//   "Which row is their INSTRUCTOR row?"
//        → rowForRole(rows, 'instructor'). Pay, groups and registers all key
//          off admin_roles.id, and a coordinator+instructor has two ids — the
//          wrong one silently reads the wrong person's work.
//
// Holding several roles must never narrow access, so a multi-role user may
// reach every area they hold a row for; the proxy carries the whole list in the
// role cookie rather than a single value.
// ─────────────────────────────────────────────────────────────────────────────

export const ADMIN_ROLES = ['admin', 'coordinator', 'instructor', 'accountant'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

/** Which job wins when someone holds several. Highest authority first. */
export const ROLE_PRIORITY: readonly AdminRole[] = ADMIN_ROLES

export const ROLE_LABEL: Record<AdminRole, string> = {
  admin:       'מנהל',
  coordinator: 'רכז סניף',
  instructor:  'מדריך',
  accountant:  'רואה חשבון',
}

/** The dashboard each job lands on. */
export const ROLE_HOME: Record<AdminRole, string> = {
  admin:       '/admin',
  coordinator: '/admin/coordinator',
  instructor:  '/admin/instructor',
  accountant:  '/admin/accountant',
}

export function isAdminRole(v: unknown): v is AdminRole {
  return typeof v === 'string' && (ADMIN_ROLES as readonly string[]).includes(v)
}

type WithRole = { role?: string | null }

/** Rank of a role, lower is stronger. Unknown roles sort last. */
function rank(role: string | null | undefined): number {
  const i = ROLE_PRIORITY.indexOf(role as AdminRole)
  return i === -1 ? ROLE_PRIORITY.length : i
}

/** The rows a person holds, strongest first. Unknown roles are dropped. */
export function sortByPriority<T extends WithRole>(rows: readonly T[] | null | undefined): T[] {
  return (rows ?? []).filter(r => isAdminRole(r.role)).sort((a, b) => rank(a.role) - rank(b.role))
}

/**
 * The row that decides where this person lands and what their nav shows.
 * Null when they hold no recognised role at all — which is "no access", not
 * "pick something anyway".
 */
export function primaryRow<T extends WithRole>(rows: readonly T[] | null | undefined): T | null {
  return sortByPriority(rows)[0] ?? null
}

/** Their row for one specific job, or null if they don't hold it. */
export function rowForRole<T extends WithRole>(
  rows: readonly T[] | null | undefined,
  role: AdminRole,
): T | null {
  return (rows ?? []).find(r => r.role === role) ?? null
}

/**
 * The row to use when a screen wants a specific job but will settle for the
 * person's main one — the coordinator layout asking for 'coordinator', say.
 */
export function rowForRoleOrPrimary<T extends WithRole>(
  rows: readonly T[] | null | undefined,
  role: AdminRole | undefined,
): T | null {
  if (role) {
    const exact = rowForRole(rows, role)
    if (exact) return exact
  }
  return primaryRow(rows)
}

/** Every job this person holds, strongest first, no duplicates. */
export function rolesOf<T extends WithRole>(rows: readonly T[] | null | undefined): AdminRole[] {
  const seen = new Set<AdminRole>()
  for (const r of sortByPriority(rows)) if (isAdminRole(r.role)) seen.add(r.role)
  return [...seen]
}

/** Where a person with these roles should land. */
export function homeFor(roles: readonly AdminRole[]): string {
  const first = roles.find(isAdminRole)
  return first ? ROLE_HOME[first] : '/admin/login'
}

// ── The role cookie ─────────────────────────────────────────────────────────
// proxy.ts reads this at the edge to decide which areas to allow. It holds the
// whole list, comma separated, so a coordinator+instructor is not bounced out
// of /admin/instructor by their own coordinator cookie.

export function encodeRoles(roles: readonly AdminRole[]): string {
  return roles.join(',')
}

/** Tolerates the old single-value cookies still in browsers from before this. */
export function decodeRoles(cookie: string | null | undefined): AdminRole[] {
  if (!cookie) return []
  return cookie.split(',').map(s => s.trim()).filter(isAdminRole)
}
