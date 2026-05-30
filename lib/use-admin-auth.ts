'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supabase'
import { clearAdminSession } from './auth-actions'

export type AdminRole = 'instructor' | 'coordinator' | 'accountant'

export interface AdminUser {
  userId: string
  email: string
  role: AdminRole
  name: string
  branch?: string
  adminRoleId: string
  hourlyRate: number
}

export function useAdminAuth(requiredRole?: AdminRole) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    async function check() {
      const { data: { user: supaUser } } = await supabase.auth.getUser()
      if (!supaUser) { router.replace('/admin/login'); return }

      const { data: rd, error } = await supabase
        .from('admin_roles')
        .select('id, role, name, branch, hourly_rate')
        .eq('user_id', supaUser.id)
        .single()

      if (error || !rd) {
        await supabase.auth.signOut()
        router.replace('/admin/login')
        return
      }

      if (requiredRole && rd.role !== requiredRole) {
        router.replace(`/admin/${rd.role}`)
        return
      }

      if (!cancelled) {
        setUser({
          userId: supaUser.id,
          email: supaUser.email!,
          role: rd.role as AdminRole,
          name: rd.name,
          branch: rd.branch ?? undefined,
          adminRoleId: rd.id,
          hourlyRate: rd.hourly_rate ?? 60,
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
