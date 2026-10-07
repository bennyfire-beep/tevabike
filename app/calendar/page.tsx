import type { Metadata } from 'next'
import YearCalendar from '@/components/YearCalendar'

// ============================================================
// לוח שנה — חגים, ימים ללא פעילות, מחנות ותחרויות
// נתיב: app/calendar/page.tsx · אירועים: site_calendar_events
// עריכה: app/admin/coordinator/calendar · תצוגה: components/YearCalendar.tsx
// ============================================================

export const metadata: Metadata = {
  title: 'לוח שנה — טבע בייק',
  description: 'לוח הפעילות השנתי של טבע בייק: חגים, ימים ללא פעילות, מחנות ותחרויות.',
}

const PINK = '#D4288A'
const DARK = '#0C1814'
const OFF_WHITE = '#F5F2EE'

export default function CalendarPage() {
  return (
    <main dir="rtl" style={{ background: OFF_WHITE, minHeight: '100vh', padding: '56px 24px 88px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <span style={{ background: `${PINK}18`, color: PINK, borderRadius: 20, padding: '5px 18px', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em' }}>
            לוח שנה
          </span>
          <h1 style={{ fontSize: 'clamp(1.9rem, 3.5vw, 2.8rem)', fontWeight: 900, color: DARK, margin: '14px 0 8px', letterSpacing: '-0.025em' }}>
            לוח הפעילות השנתי
          </h1>
          <p style={{ color: '#7A8880', fontSize: 16, margin: 0 }}>חגים, ימים ללא פעילות, מחנות ותחרויות — הכל במקום אחד</p>
        </div>

        <YearCalendar />

        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <a href="/register" className="btn-primary">הרשמה לחוג ←</a>
        </div>
      </div>
    </main>
  )
}
