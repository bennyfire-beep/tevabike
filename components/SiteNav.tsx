'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Pages with their own dedicated chrome — the public site nav shouldn't
// overlay these (staff dashboards, login, auth callback, API routes).
const HIDE_PREFIXES = ['/admin', '/student', '/auth', '/login', '/api', '/interval']

export default function SiteNav() {
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  if (HIDE_PREFIXES.some(p => pathname?.startsWith(p))) return null

  const isHome = pathname === '/'

  return (
    <>
      {/* ════════════════════════════ NAVBAR ════════════════════════════ */}
      <nav style={{
        position: 'fixed', inset: '0 0 auto 0', zIndex: 100,
        background: scrolled ? 'rgba(12,24,20,0.97)' : 'rgba(12,24,20,0.72)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderBottom: `1px solid rgba(212,40,138,${scrolled ? '.3' : '.12'})`,
        transition: 'background .35s, border-color .35s',
      }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 66 }}>
          {/* Logo (right in RTL) */}
          <a href="/">
            <img src="/logo.png" alt="Tev Bike" style={{ height: 42, borderRadius: 6, display: 'block' }} />
          </a>

          {/* Nav links (left in RTL) — "/#classes" and "/#why" so they work
              from any page (they navigate home, then jump to the section) */}
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            <a href="/#classes" className="nav-link">חוגים</a>
            <a href="/camp-sukkot" className="nav-link" style={{ color: '#ec4899', fontWeight: 700 }}>מחנה סוכות</a>
            <a href="/workshop-airbag" className="nav-link" style={{ color: '#ec4899', fontWeight: 700 }}>סדנת איר באג</a>
            <a href="/#why" className="nav-link">למה אנחנו</a>
            <a href="/shop" className="nav-link">חנות</a>
            <a href="/register" className="btn-primary" style={{ padding: '8px 22px', fontSize: 14, borderRadius: 8 }}>
              הרשמה
            </a>
          </div>
        </div>
      </nav>

      {/* On the homepage the hero is designed to sit under the fixed nav
          (nav floats on top). On every other page we need a spacer so the
          fixed nav doesn't cover the top of the page content. */}
      {!isHome && <div style={{ height: 66 }} />}
    </>
  )
}
