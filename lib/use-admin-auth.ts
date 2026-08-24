'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supabase'
import { clearAdminSession } from './auth-actions'
import { type AdminRole, rolesOf, rowForRoleOrPrimary, homeFor } from './roles'

export type { AdminRole }

export interface AdminUser {
  userId: string
  email: string
  /** The role this screen is being used in — the requested one when held. */
  role: AdminRole
  /** Every role this person holds, strongest first. Usually just the one. */
  roles: AdminRole[]
  name: string
  branch?: string
  /** admin_roles.id of the row matching `role` — NOT "the" id of the person. */
  adminRoleId: string
  hourlyRate: number
}

/**
 * Resolve the signed-in staff member.
 *
 * `admin_roles` is one row per job, and a few people hold more than one (Tal
 * Barkan today, Benny as coordinator + instructor shortly). Two consequences
 * this hook has to get right:
 *
 *   • It reads every row. The old `.single()` returned an ERROR rather than a
 *     row for exactly those people, and the error branch signed them straight
 *     back out — a two-job user simply could not stay logged in.
 *   • `adminRoleId` is the id of the row for the role being used, not of the
 *     person: there is no such thing. Pay, groups and registers all key off
 *     admin_roles.id, so handing back the coordinator row's id on an
 *     instructor screen would quietly read the wrong records.
 *
 * `requiredRole` now means "use this role", not "hold only this role": someone
 * who holds it is let through on that row, and only someone who doesn't is
 * redirected to whichever dashboard they do own.
 */
export function useAdminAuth(requiredRole?: AdminRole) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    async function check() {
      const { data: { user: supaUser } } = await supabase.auth.getUser()
      if (!supaUser) { router.replace('/admin/login'); return }

      const { data: rows, error } = await supabase
        .from('admin_roles')
        .select('id, role, name, branch')
        .eq('user_id', supaUser.id)

      const roles = rolesOf(rows)
      // The row to work as; falls back to their strongest role, which is where
      // the redirect below then sends them.
      const rd = rowForRoleOrPrimary(rows, requiredRole)

      if (error || roles.length === 0 || !rd) {
        await supabase.auth.signOut()
        router.replace('/admin/login')
        return
      }

      if (requiredRole && rd.role !== requiredRole) {
        router.replace(homeFor(roles))
        return
      }

      if (!cancelled) {
        setUser({
          userId: supaUser.id,
          email: supaUser.email ?? '',
          role: rd.role as AdminRole,
          roles,
          name: rd.name,
          branch: rd.branch ?? undefined,
          adminRoleId: rd.id,
          hourlyRate: 60, // התעריף האמיתי מגיע מ-staff_pay, מוגן ב-RLS
        })
        setLoading(false)
      }
    }
    check()
    return () => { cancelled = true }
  }, [requiredRole, router])

  async function logout() {
    await Promise.all([supabase.auth.signOut(), clearAdminSession()])
    router.push('/admin/login')
  }

  return { user, loading, logout }
}
