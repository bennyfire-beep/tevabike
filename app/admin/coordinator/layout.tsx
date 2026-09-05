'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAdminAuth } from '@/lib/use-admin-auth'
import { CoordinatorCtx } from '@/lib/coordinator-context'
import { supabase } from '@/lib/supabase'
import { isSalaryAdmin } from '@/lib/salary-access'

const LEADS_HREF = '/admin/coordinator/leads'
const HEADER_H = 58

// Grouped nav, replacing the old single-row horizontal-scroll tab strip — at
// 19 tabs that row had to scroll sideways just to see everything, and the
// grouping here (daily ops / WhatsApp+customers / shop / staff) is what
// actually made the equivalent screen usable on agents.lahat.group. An empty
// `title` renders as a standalone link with no section header (לוח בקרה, and
// the summer-2026 area at the bottom).
//
// Salary visibility is limited to the two salary admins. The list mirrors
// is_salary_admin() in the database, which is the real enforcement.
type NavItem = { href: string; label: string; icon: string; exact?: boolean; salaryOnly?: boolean }
type NavGroup = { title: string; items: NavItem[] }

const NAV: NavGroup[] = [
  { title: '', items: [
    { href: '/admin/coordinator', label: 'לוח בקרה', icon: '🏠', exact: true },
  ]},
  { title: 'תפעול יומי', items: [
    { href: '/admin/coordinator/groups', label: 'קבוצות', icon: '👥' },
    { href: '/admin/coordinator/students', label: 'תלמידים', icon: '🧑‍🎓' },
    { href: '/admin/coordinator/attendance', label: 'נוכחות', icon: '📋' },
    { href: '/admin/coordinator/history', label: 'היסטוריה', icon: '🕓' },
    { href: '/admin/coordinator/registrations', label: 'הרשמות', icon: '📝' },
    { href: '/admin/coordinator/workshops', label: 'סדנאות', icon: '🎒' },
    { href: '/admin/coordinator/camp', label: 'ימי שיא', icon: '🏕️' },
    { href: '/admin/coordinator/camp-sukkot', label: 'מחנה סוכות', icon: '⛺' },
    { href: '/admin/coordinator/trips', label: 'טיולי חו״ל', icon: '✈️', salaryOnly: true },
  ]},
  { title: 'וואטסאפ ולקוחות', items: [
    { href: '/admin/coordinator/whatsapp', label: 'וואטסאפ', icon: '💬' },
    { href: '/admin/coordinator/whatsapp-examples', label: 'דוגמאות תשובה', icon: '💡' },
    { href: LEADS_HREF, label: 'מתעניינים', icon: '📥' },
  ]},
  { title: 'חנות', items: [
    { href: '/admin/coordinator/shop-orders', label: 'הזמנות חנות', icon: '🛒' },
    { href: '/admin/coordinator/shop-cancellations', label: 'בקשות ביטול', icon: '↩️' },
    { href: '/admin/coordinator/tshirt-orders', label: 'הזמנות חולצות', icon: '👕' },
  ]},
  { title: 'צוות וניהול', items: [
    { href: '/admin/coordinator/staff', label: 'צוות', icon: '🧑‍🤝‍🧑' },
    { href: '/admin/coordinator/payroll', label: 'שכר', icon: '💰', salaryOnly: true },
    { href: '/admin/coordinator/reports', label: 'דוחות', icon: '📊' },
    { href: '/admin/coordinator/gemini', label: 'ניתוח AI', icon: '🧠' },
  ]},
  { title: '', items: [
    { href: '/admin/groups', label: 'מערכת קיץ 2026', icon: '☀️' },
  ]},
]

function SidebarLink({ item, active, collapsed, badge, onNavigate }: {
  item: NavItem; active: boolean; collapsed: boolean; badge?: number; onNavigate?: () => void
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: collapsed ? '9px 0' : '9px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 8,
        textDecoration: 'none',
        color: active ? '#b5e853' : '#c3ccc4',
        background: active ? '#b5e85320' : 'transparent',
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 15, flexShrink: 0, width: 18, textAlign: 'center' }}>{item.icon}</span>
      {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{item.label}</span>}
      {!collapsed && badge != null && badge > 0 && (
        <span style={{ background: '#ec4899', color: '#fff', borderRadius: 10, minWidth: 18, height: 18, padding: '0 5px', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {badge}
        </span>
      )}
    </Link>
  )
}

function SidebarContent({ groups, pathname, collapsed, newLeads, onNavigate }: {
  groups: NavGroup[]; pathname: string; collapsed: boolean; newLeads: number; onNavigate?: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 10px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.title && !collapsed && (
            <div style={{ color: '#556257', fontSize: 11, fontWeight: 700, padding: '0 12px 6px', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {group.title}
            </div>
          )}
          {group.title && collapsed && <div style={{ height: 1, background: '#252b27', margin: '0 8px 8px' }} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {group.items.map(item => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
              return (
                <SidebarLink
                  key={item.href}
                  item={item}
                  active={active}
                  collapsed={collapsed}
                  badge={item.href === LEADS_HREF ? newLeads : undefined}
                  onNavigate={onNavigate}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CoordinatorLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAdminAuth('coordinator')
  const pathname = usePathname()
  const [newLeads, setNewLeads] = useState(0)

  // Desktop icon-rail collapse, remembered across visits.
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    try { setCollapsed(localStorage.getItem('coordinatorSidebarCollapsed') === '1') } catch { /* ignore */ }
  }, [])
  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem('coordinatorSidebarCollapsed', next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }

  // Below ~768px the sidebar becomes a slide-in drawer instead of a column,
  // opened from the header's hamburger button.
  const [isMobile, setIsMobile] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const apply = () => setIsMobile(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  // A route change closes the drawer — otherwise it stays open over the new page.
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Count of unhandled leads for the nav badge (authenticated read via RLS).
  useEffect(() => {
    if (!user) return
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'new')
      .then(({ count }) => setNewLeads(count ?? 0))
  }, [user, pathname])

  if (loading) return (
    <div style={{ background: '#0d0f0e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7a8f7d', fontFamily: 'Heebo, Arial, sans-serif', direction: 'rtl' }}>
      טוען...
    </div>
  )
  if (!user) return null

  const canSeeSalary = isSalaryAdmin(user.email)
  const groups = NAV
    .map(g => ({ ...g, items: g.items.filter(i => !i.salaryOnly || canSeeSalary) }))
    .filter(g => g.items.length > 0)

  const sidebarWidth = collapsed ? 60 : 216

  return (
    <CoordinatorCtx.Provider value={user}>
      <div dir="rtl" style={{ fontFamily: 'Heebo, Arial, sans-serif', background: '#0d0f0e', minHeight: '100vh', height: '100vh', color: '#e8efe9', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <header style={{ height: HEADER_H, flexShrink: 0, background: '#141716', borderBottom: '1px solid #252b27', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 12, maxWidth: '100vw' }}>
          {isMobile && (
            <button
              onClick={() => setMobileOpen(v => !v)}
              aria-label="תפריט"
              style={{ background: 'transparent', border: '1px solid #252b27', color: '#c3ccc4', borderRadius: 8, width: 34, height: 34, fontSize: 16, cursor: 'pointer', flexShrink: 0 }}
            >
              ☰
            </button>
          )}
          <Link href="/admin/coordinator" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}>
            <img src="/logo.png" alt="טבע בייק" style={{ height: 32, width: 'auto', display: 'block', filter: 'brightness(1.05)' }} />
          </Link>
          <span style={{ width: 1, height: 24, background: '#252b27', flexShrink: 0 }} />
          <span style={{ background: '#1a2637', color: '#81d4fa', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>רכז</span>
          <span style={{ color: '#e8efe9', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</span>
          <span style={{ flex: 1 }} />
          <button
            onClick={logout}
            style={{ flexShrink: 0, background: 'transparent', border: '1px solid #252b27', color: '#7a8f7d', borderRadius: 8, padding: '6px 14px', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 12, cursor: 'pointer' }}
          >
            יציאה
          </button>
        </header>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {!isMobile && (
            <aside style={{ width: sidebarWidth, flexShrink: 0, background: '#141716', borderInlineStart: '1px solid #252b27', display: 'flex', flexDirection: 'column', minHeight: 0, transition: 'width .15s' }}>
              <SidebarContent groups={groups} pathname={pathname} collapsed={collapsed} newLeads={newLeads} />
              <button
                onClick={toggleCollapsed}
                title={collapsed ? 'הרחב תפריט' : 'כווץ תפריט'}
                style={{ flexShrink: 0, margin: 8, background: 'transparent', border: '1px solid #252b27', color: '#7a8f7d', borderRadius: 8, padding: '8px 0', fontSize: 13, cursor: 'pointer' }}
              >
                {collapsed ? '»' : '« כווץ'}
              </button>
            </aside>
          )}

          {isMobile && mobileOpen && (
            <>
              <div
                onClick={() => setMobileOpen(false)}
                style={{ position: 'fixed', inset: 0, top: HEADER_H, background: 'rgba(0,0,0,.5)', zIndex: 40 }}
              />
              <aside style={{
                position: 'fixed', top: HEADER_H, insetInlineEnd: 0, height: `calc(100vh - ${HEADER_H}px)`,
                width: 240, background: '#141716', borderInlineStart: '1px solid #252b27', zIndex: 50,
                display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 24px rgba(0,0,0,.4)',
              }}>
                <SidebarContent groups={groups} pathname={pathname} collapsed={false} newLeads={newLeads} onNavigate={() => setMobileOpen(false)} />
              </aside>
            </>
          )}

          <main style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {children}
          </main>
        </div>
      </div>
    </CoordinatorCtx.Provider>
  )
}
