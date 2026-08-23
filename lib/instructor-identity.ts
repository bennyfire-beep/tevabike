import { createClient, type SupabaseClient } from '@supabase/supabase-js'

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
// ─────────────────────────────────────────────────────────────────────────────

export interface CallerIdentity {
  db: SupabaseClient
  /** admin_roles.id — the id every other table keys its staff rows by. */
  adminRoleId: string
  name: string
  branch: string | null
  role: string
}

export type IdentityResult =
  | { ok: true;  identity: CallerIdentity }
  | { ok: false; status: number; error: string }

/** Verify the bearer token and resolve the caller's own admin_roles row. */
export async function resolveCaller(authHeader: string | null): Promise<IdentityResult> {
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

  // By user_id only. Nothing the caller sends picks the row.
  const { data: role, error: roleErr } = await db
    .from('admin_roles')
    .select('id, name, branch, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (roleErr) {
    console.error('[instructor-identity] admin_roles lookup failed:', roleErr.message)
    return { ok: false, status: 500, error: 'שגיאה בזיהוי המשתמש' }
  }
  if (!role) return { ok: false, status: 403, error: 'המשתמש אינו מקושר לרשומת מדריך' }

  return {
    ok: true,
    identity: {
      db,
      adminRoleId: role.id,
      name:        role.name,
      branch:      role.branch ?? null,
      role:        role.role,
    },
  }
}

// Month arithmetic lives in lib/month.ts so the browser pay screens and the
// server routes cannot disagree about where a month starts and ends. The month
// a route reports on is still the server's own — never taken from the request.
export { currentMonth, monthBounds } from './month'
