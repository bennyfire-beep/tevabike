'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useContext } from 'react'
import { useAdminAuth, type AdminUser } from '@/lib/use-admin-auth'
import { isSalaryAdmin } from '@/lib/salary-access'

/**
 * Chrome for the top-level management screens (/admin/groups, /admin/students,
 * /admin/instructors, /admin/attendance, /admin/salaries).
 *
 * These sit outside the per-role areas on purpose: instructors mark attendance
 * from their phone and coordinators manage the roster, so the roster screens are
 * open to any signed-in admin and proxy.ts gates them behind a valid role cookie.
 *
 * The screens that show pay or rates (/admin/salaries, /admin/instructors) pass
 * salaryOnly and are limited to the salary admins. That is a courtesy layer —
 * the real enforcement is is_salary_admin() in RLS, which returns nothing to
 * anyone else even on a direct REST call.
 */

/** The signed-in admin, so screens inside the shell don't refetch it. */
const ManageCtx = createContext<AdminUser | null>(null)
export const useManageUser = () => useContext(ManageCtx)

export const NAV: { href: string; label: string; icon: string; salaryOnly?: boolean }[] = [
  { href: '/admin/groups',      label: 'קבוצות',  icon: '👥' },
  { href: '/admin/students',    label: 'חניכים',  icon: '🚵' },
  // Rates live on this screen, so it is salary-admin only.
  { href: '/admin/instructors', label: 'מדריכים', icon: '🎓', salaryOnly: true },
  { href: '/admin/attendance',  label: 'נוכחות',  icon: '✅' },
  { href: '/admin/salaries',    label: 'שכר',     icon: '₪',  salaryOnly: true },
]

export const C = {
  bg:     '#0d0f0e',
  card:   '#141716',
  border: '#252b27',
  text:   '#e8efe9',
  muted:  '#7a8f7d',
  accent: '#b5e853',
  danger: '#ff8080',
  input:  '#0d0f0e',
}

export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

export const TRACK_LABEL: Record<string, string> = {
  once_weekly:  'פעם בשבוע',
  twice_weekly: 'פעמיים בשבוע',
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  background: C.input,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  color: C.text,
  fontFamily: 'Heebo, Arial, sans-serif',
  fontSize: 15,           // >=16px avoids iOS zoom-on-focus; 15 + no zoom meta is fine here
  padding: '11px 12px',
  outline: 'none',
  boxSizing: 'border-box',
}

export const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: C.muted,
  display: 'block',
  marginBottom: 5,
}

export function Btn({
  children, onClick, type = 'button', tone = 'primary', disabled, style,
}: {
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  tone?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  style?: React.CSSProperties
}) {
  const tones = {
    primary: { background: disabled ? '#3a4f3a' : C.accent, color: disabled ? C.muted : C.bg, border: 'none' },
    ghost:   { background: 'transparent', color: C.muted, border: `1px solid ${C.border}` },
    danger:  { background: '#ff4f4f22', color: C.danger, border: '1px solid #ff4f4f44' },
  }[tone]

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...tones,
        borderRadius: 8,
        padding: '11px 18px',
        fontFamily: 'Heebo, Arial, sans-serif',
        fontWeight: 700,
        fontSize: 14,
        cursor: disabled ? 'default' : 'pointer',
        minHeight: 44,          // comfortable tap target on a phone
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export function ManageShell({
  title, children, salaryOnly = false,
}: {
  title: string
  children: React.ReactNode
  /** Screens that show pay or rates. Blocked for anyone but the salary admins. */
  salaryOnly?: boolean
}) {
  const { user, loading, logout } = useAdminAuth()
  const pathname = usePathname()

  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontFamily: 'Heebo, Arial, sans-serif', direction: 'rtl' }}>
        טוען...
      </div>
    )
  }
  if (!user) return null

  const canSeeSalary = isSalaryAdmin(user.email)
  const navItems = NAV.filter(n => !n.salaryOnly || canSeeSalary)

  // Belt and braces: RLS already returns nothing to a non-salary-admin, but the
  // screen should say so plainly rather than render an empty report.
  if (salaryOnly && !canSeeSalary) {
    return (
      <div dir="rtl" style={{ fontFamily: 'Heebo, Arial, sans-serif', background: C.bg, minHeight: '100vh', color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 30, maxWidth: 380, textAlign: 'center' }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>🔒</div>
          <h1 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 8px' }}>אין לך גישה למסך זה</h1>
          <p style={{ color: C.muted, fontSize: 13.5, margin: '0 0 20px', lineHeight: 1.7 }}>
            נתוני שכר, תעריפים ונסיעות פתוחים להנהלה בלבד.
          </p>
          <Link
            href="/admin/attendance"
            style={{ display: 'block', background: C.accent, color: C.bg, borderRadius: 8, padding: '11px 0', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
          >
            חזרה לנוכחות
          </Link>
        </div>
      </div>
    )
  }

  return (
    <ManageCtx.Provider value={user}>
    <div dir="rtl" style={{ fontFamily: 'Heebo, Arial, sans-serif', background: C.bg, minHeight: '100vh', color: C.text }}>
      <header style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
          <Link href="/admin" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img src="/logo.png" alt="טבע בייק" style={{ height: 32, width: 'auto', display: 'block' }} />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: C.muted, fontSize: 12 }}>{user.name}</span>
            <button
              onClick={logout}
              style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, color: C.muted, padding: '6px 12px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}
            >
              יציאה
            </button>
          </div>
        </div>

        {/* Horizontally scrollable tabs — fits a phone without wrapping */}
        <nav style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 2, WebkitOverflowScrolling: 'touch' }}>
          {navItems.map(n => {
            const active = pathname === n.href
            return (
              <Link
                key={n.href}
                href={n.href}
                style={{
                  flexShrink: 0,
                  background: active ? C.accent : 'transparent',
                  color: active ? C.bg : C.muted,
                  border: `1px solid ${active ? C.accent : C.border}`,
                  borderRadius: 20,
                  padding: '7px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {n.icon} {n.label}
              </Link>
            )
          })}
        </nav>
      </header>

      <main style={{ padding: '18px 16px 60px', maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontSize: 21, fontWeight: 900, margin: '0 0 16px' }}>{title}</h1>
        {children}
      </main>
    </div>
    </ManageCtx.Provider>
  )
}

/** Small status line used while loading or when a list comes back empty. */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: C.muted, fontSize: 14, padding: '22px 0', textAlign: 'center' }}>
      {children}
    </div>
  )
}

/** Inline error banner. */
export function ErrorBox({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return (
    <div style={{ background: '#ff4f4f22', border: '1px solid #ff4f4f44', borderRadius: 8, padding: '10px 14px', color: C.danger, fontSize: 13, marginBottom: 14 }}>
      {children}
    </div>
  )
}
