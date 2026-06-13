'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAdminAuth } from '@/lib/use-admin-auth'
import { CoordinatorCtx } from '@/lib/coordinator-context'

const NAV = [
  { href: '/admin/coordinator',            label: 'לוח בקרה', exact: true  },
  { href: '/admin/coordinator/groups',     label: 'קבוצות',   exact: false },
  { href: '/admin/coordinator/students',   label: 'תלמידים',  exact: false },
  { href: '/admin/coordinator/attendance', label: 'נוכחות',   exact: false },
]

export default function CoordinatorLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAdminAuth('coordinator')
  const pathname = usePathname()

  if (loading) return (
    <div style={{ background: '#0d0f0e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7a8f7d', fontFamily: 'Heebo, Arial, sans-serif', direction: 'rtl' }}>
      טוען...
    </div>
  )
  if (!user) return null

  return (
    <CoordinatorCtx.Provider value={user}>
      <div dir="rtl" style={{ fontFamily: 'Heebo, Arial, sans-serif', background: '#0d0f0e', minHeight: '100vh', color: '#e8efe9' }}>
        <header style={{ background: '#141716', borderBottom: '1px solid #252b27', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
            <Link href="/admin/coordinator" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}>
              <img src="/logo.png" alt="טבע בייק" style={{ height: 36, width: 'auto', display: 'block', filter: 'brightness(1.05)' }} />
            </Link>
            <span style={{ width: 1, height: 24, background: '#252b27', flexShrink: 0 }} />
            <span style={{ background: '#1a2637', color: '#81d4fa', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>רכז</span>
            <span style={{ color: '#e8efe9', fontSize: 14, fontWeight: 700 }}>{user.name}</span>
          </div>
          <nav style={{ display: 'flex', gap: 2 }}>
            {NAV.map(({ href, label, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href)
              return (
                <Link key={href} href={href} style={{
                  padding: '14px 13px',
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: active ? '#b5e853' : '#7a8f7d',
                  borderBottom: `2px solid ${active ? '#b5e853' : 'transparent'}`,
                  display: 'inline-block',
                  transition: 'color .15s',
                }}>
                  {label}
                </Link>
              )
            })}
          </nav>
          <button
            onClick={logout}
            style={{ marginRight: 'auto', background: 'transparent', border: '1px solid #252b27', color: '#7a8f7d', borderRadius: 8, padding: '6px 14px', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 12, cursor: 'pointer' }}
          >
            יציאה
          </button>
        </header>
        {children}
      </div>
    </CoordinatorCtx.Provider>
  )
}
