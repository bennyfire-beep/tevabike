import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { type AdminRole, rowForRole, primaryRow, rolesOf } from './roles'

// ─────────────────────────────────────────────────────────────────────────────
// "Who is calling, and which staff row are they?"
//
// The instructor's own screens (My students / My pay) read tables the instructor
// cannot read for themselves: staff_pay, instructor_travel and
// instructor_travel_days are restricted to the two salary admins by RLS
// (supabase/migrations/20260820_lock_down_salary_data.sql), and that stays that
// way — opening RLS would expose every instructor's pay to every instructor.
//
// So those routes run with the service role, which bypasses RLS entirely, and
// the authorisation moves here instead:
//
//   1. the caller must present their own Supabase access token,
//   2. the token is verified against Supabase (not merely decoded),
//   3. the admin_roles row is looked up BY user_id — the caller never names the
//      instructor whose data they want.
//
// Point 3 is the whole security model: the returned admin_role_id is derived
// from the verified session, so a route built on this helper physically cannot
// be pointed at another instructor's row.
//
// One person can hold several jobs — admin_roles is one row per job, and Benny
// is coordinator AND instructor. `resolveCaller` therefore takes the role it
// wants: the instructor routes ask for 'instructor' and get that row's id.
// Taking whichever row came back first would hand pay and rosters the
// coordinator row's admin_roles.id, which owns no sessions and no staff_pay —
// the screens would look empty rather than wrong, which is worse to diagnose.
// ─────────────────────────────────────────────────────────────────────────────

export interface CallerIdentity {
  db: SupabaseClient
  /** admin_roles.id of the row for the requested role — not "the" person's id. */
  adminRoleId: string
  name: string
  branch: string | null
  role: string
  /** Every role this caller holds, strongest first. */
  roles: AdminRole[]
}

export type IdentityResult =
  | { ok: true;  identity: CallerIdentity }
  | { ok: false; status: number; error: string }

/**
 * Verify the bearer token and resolve the caller's own admin_roles row.
 *
 * `wantRole` picks WHICH of their rows when they hold several. Pass
 * 'instructor' from the instructor routes; omit it to accept whoever they are
 * (their strongest role), which is what the register-opening route wants,
 * since covering a lesson is not an instructor-only act.
 */
export async function resolveCaller(
  authHeader: string | null,
  wantRole?: AdminRole,
): Promise<IdentityResult> {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('[instructor-identity] SUPABASE_SERVICE_ROLE_KEY or URL not set.')
    return { ok: false, status: 500, error: 'השרת לא מוגדר נכון (חסר מפתח שירות)' }
  }

  const token = (authHeader ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return { ok: false, status: 401, error: 'לא מחובר' }

  const db = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: caller, error: callerErr } = await db.auth.getUser(token)
  const user = caller?.user
  if (callerErr || !user) return { ok: false, status: 401, error: 'ההזדהות נכשלה, התחבר/י מחדש' }

  // By user_id only. Nothing the caller sends picks the row — that is what
  // stops one instructor asking for another's data.
  //
  // Every row, not `.maybeSingle()`: that errors on two matches, so a
  // coordinator+instructor got "שגיאה בזיהוי המשתמש" on their own pay screen.
  const { data: rows, error: roleErr } = await db
    .from('admin_roles')
    .select('id, name, branch, role')
    .eq('user_id', user.id)

  if (roleErr) {
    console.error('[instructor-identity] admin_roles lookup failed:', roleErr.message)
    return { ok: false, status: 500, error: 'שגיאה בזיהוי המשתמש' }
  }

  // When a role is asked for, only that row will do. Falling back to another
  // of their rows would point pay and rosters at an id that owns neither.
  const role = wantRole ? rowForRole(rows, wantRole) : primaryRow(rows)
  if (!role) {
    return {
      ok: false,
      status: 403,
      error: wantRole === 'instructor'
        ? 'המשתמש אינו מקושר לרשומת מדריך'
        : 'המשתמש אינו מקושר לרשומת צוות',
    }
  }

  return {
    ok: true,
    identity: {
      db,
      adminRoleId: role.id,
      name:        role.name,
      branch:      role.branch ?? null,
      role:        role.role,
      roles:       rolesOf(rows),
    },
  }
}

// Month arithmetic lives in lib/month.ts so the browser pay screens and the
// server routes cannot disagree about where a month starts and ends. The month
// a route reports on is still the server's own — never taken from the request.
export { currentMonth, monthBounds } from './month'
