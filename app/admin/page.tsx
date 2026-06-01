'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/lib/use-admin-auth'

const ROLE_DESTINATIONS: Record<string, string> = {
  instructor:  '/admin/instructor',
  coordinator: '/admin/coordinator',
  accountant:  '/admin/accountant',
}

export default function AdminHubPage() {
  const { user, loading } = useAdminAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) return
    const dest = ROLE_DESTINATIONS[user.role] ?? '/admin/login'
    router.replace(dest)
  }, [user, router])

  return (
    <div
      dir="rtl"
      style={{
        fontFamily: 'Heebo, Arial, sans-serif',
        background: '#0d0f0e',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#7a8f7d',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <img src="/logo.png" alt="טבע בייק" style={{ height: 48, borderRadius: 8 }} />
      {loading
        ? <span style={{ fontSize: 14 }}>טוען...</span>
        : <span style={{ fontSize: 14 }}>מעביר לדשבורד...</span>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #b5e853', borderTopColor: 'transparent', animation: 'spin .8s linear infinite' }} />
    </div>
  )
}
