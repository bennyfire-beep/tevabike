import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isSalaryAdmin } from './salary-access'

// ─────────────────────────────────────────────────────────────────────────────
// "Is whoever is calling actually Benny or Shir?" — the server-side twin of
// lib/salary-access.ts (which only decides what the UI renders) and of
// is_salary_admin() in Postgres (the real enforcement on staff_pay /
// instructor_travel / instructor_activity_logs).
//
// Same shape as lib/instructor-identity.ts's resolveCaller: verify the bearer
// token against Supabase, then check the identity it returns — never anything
// the request body claims. Used by the coordinator-side activity-log routes,
// which run with the service role because instructor_activity_logs is RLS-
// locked to salary admins only, same as staff_pay.
// ─────────────────────────────────────────────────────────────────────────────

export interface SalaryAdminIdentity {
  db: SupabaseClient
  userId: string
  email: string
  /** This admin's own admin_roles.id, for stamping approved_by — null if they
   *  have no admin_roles row at all (shouldn't happen for Benny/Shir, but a
   *  missing row must not crash the approve/reject action over it). */
  adminRoleId: string | null
}

export type SalaryAdminResult =
  | { ok: true;  identity: SalaryAdminIdentity }
  | { ok: false; status: number; error: string }

export async function resolveSalaryAdmin(authHeader: string | null): Promise<SalaryAdminResult> {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('[salary-admin-identity] SUPABASE_SERVICE_ROLE_KEY or URL not set.')
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

  const email = user.email ?? ''
  if (!isSalaryAdmin(email)) {
    return { ok: false, status: 403, error: 'המסך הזה זמין להנהלה בלבד' }
  }

  const { data: roles } = await db
    .from('admin_roles')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)

  return {
    ok: true,
    identity: { db, userId: user.id, email, adminRoleId: roles?.[0]?.id ?? null },
  }
}
