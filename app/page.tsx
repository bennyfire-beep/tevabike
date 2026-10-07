'use client'
import { useState, useEffect } from 'react'
import YearCalendar from '@/components/YearCalendar'

// ─── Brand ───────────────────────────────────────────────────────────────────
const PINK      = '#D4288A'
const PINK_H    = '#B51E77'
const DARK      = '#0C1814'
const GREEN     = '#152A1E'
const GREEN_M   = '#1F3D2A'
const OFF_WHITE = '#F5F2EE'

// ─── Data ────────────────────────────────────────────────────────────────────
const BRANCH_COLOR: Record<string, string> = {
  'משגב':        PINK,
  'ביריה':       '#4cdb7a',
  'מטה אשר':     '#22B5D4',
  'פרוד-אמירים': '#f59e0b',
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FormInput({ label, type = 'text', placeholder, value, onChange }: {
  label: string; type?: string; placeholder: string; value: string; onChange: (v: string) => void
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{ fontSize: 12, color: '#6B7A72', display: 'block', marginBottom: 5, fontWeight: 600 }}>
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', boxSizing: 'border-box',
          border: `1.5px solid ${focused ? PINK : '#E2DDD8'}`,
          borderRadius: 9, padding: '11px 14px', fontSize: 14,
          fontFamily: 'inherit', outline: 'none', background: '#FAFAF8',
          transition: 'border-color .2s',
          color: '#111',
        }}
      />
    </div>
  )
}

function FormSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{ fontSize: 12, color: '#6B7A72', display: 'block', marginBottom: 5, fontWeight: 600 }}>
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', boxSizing: 'border-box',
          border: `1.5px solid ${focused ? PINK : '#E2DDD8'}`,
          borderRadius: 9, padding: '11px 14px', fontSize: 14,
          fontFamily: 'inherit', outline: 'none', background: '#FAFAF8',
          transition: 'border-color .2s', cursor: 'pointer',
          color: value ? '#111' : '#9ca3af',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <main style={{ fontFamily: 'inherit', background: '#fff', color: DARK, overflowX: 'hidden' }}>

      {/* ════════════════════════════ HERO ════════════════════════════ */}
      <section style={{ position: 'relative', height: '100vh', minHeight: 580, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {/* Video background */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <iframe
            src="https://www.youtube.com/embed/mm0esszVJv0?autoplay=1&mute=1&loop=1&playlist=mm0esszVJv0&controls=0&showinfo=0&rel=0&modestbranding=1"
            style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none', transform: 'scale(1.45)' }}
            allow="autoplay; fullscreen"
          />
        </div>

        {/* Layered overlay */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: `linear-gradient(160deg, rgba(12,24,20,0.88) 0%, rgba(12,24,20,0.55) 50%, rgba(12,24,20,0.82) 100%)` }} />

        {/* Pink accent line at bottom of hero */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 3, height: 3, background: `linear-gradient(90deg, transparent, ${PINK}, transparent)` }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 2, padding: '0 24px', maxWidth: 820 }} className="animate-fadeIn">
          {/* Logo */}
          <img
            src="/logo.png"
            alt="Tev Bike"
            style={{ height: 72, borderRadius: 8, marginBottom: 36, boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}
          />

          {/* Headline */}
          <h1 style={{
            color: '#fff', margin: '0 0 18px',
            fontSize: 'clamp(2rem, 5vw, 3.8rem)',
            fontWeight: 900, lineHeight: 1.12, letterSpacing: '-0.025em',
          }}>
            רכיבת שטח<br />
            <span style={{ color: PINK }}>שמשנה חיים</span>
          </h1>

          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 'clamp(.95rem, 2.2vw, 1.2rem)', margin: '0 0 28px', lineHeight: 1.65 }}>
            חוגי גרביטי, טכניקה וכושר לילדים ומבוגרים — ברחבי הגליל
          </p>

          {/* Location chips */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 38, flexWrap: 'wrap' }}>
            {(['משגב', 'ביריה', 'מטה אשר', 'פרוד-אמירים'] as const).map(b => (
              <span key={b} style={{
                background: 'rgba(255,255,255,0.1)',
                border: `1px solid rgba(255,255,255,0.22)`,
                backdropFilter: 'blur(6px)',
                color: '#fff', borderRadius: 20,
                padding: '5px 16px', fontSize: 13, fontWeight: 600,
              }}>
                <span style={{ color: BRANCH_COLOR[b] }}>●</span> {b}
              </span>
            ))}
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/register" className="btn-primary">הירשמו עכשיו</a>
            <a href="#classes" className="btn-outline">ללוח השנה</a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="scroll-indicator" style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 1, height: 36, background: `linear-gradient(to bottom, transparent, rgba(255,255,255,0.35))` }} />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, letterSpacing: '0.1em' }}>SCROLL</span>
        </div>
      </section>

      {/* ════════════════════════════ MORZINE YOUTH 2027 ════════════════════════════ */}
      <MorzineYouthPromo />

      {/* ════════════════════════════ STATS STRIP ════════════════════════════ */}
      <section style={{ background: DARK }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
          {[
            { num: '150+', label: 'תלמידים פעילים', icon: '🚵' },
            { num: '3',    label: 'סניפים בגליל',   icon: '📍' },
            { num: '8',    label: 'סוגי חוגים',     icon: '🏆' },
            { num: '5+',   label: 'שנות ניסיון',    icon: '⭐' },
          ].map((s, i) => (
            <div
              key={s.label}
              style={{
                padding: '40px 24px', textAlign: 'center',
                borderLeft: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 'clamp(2rem,4vw,2.8rem)', fontWeight: 900, color: PINK, lineHeight: 1, marginBottom: 6 }}>{s.num}</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════ CALENDAR ════════════════════════════ */}
      {/* id stays "classes" so the existing nav/hero anchors keep working. */}
      <section id="classes" style={{ background: OFF_WHITE, padding: '88px 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <span style={{ background: `${PINK}18`, color: PINK, borderRadius: 20, padding: '5px 18px', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em' }}>
              לוח שנה
            </span>
            <h2 style={{ fontSize: 'clamp(1.9rem, 3.5vw, 2.8rem)', fontWeight: 900, color: DARK, margin: '14px 0 8px', letterSpacing: '-0.025em' }}>
              לוח הפעילות השנתי
            </h2>
            <p style={{ color: '#7A8880', fontSize: 16, margin: 0 }}>חגים, ימים ללא פעילות, מחנות ותחרויות — הכל במקום אחד</p>
          </div>

          <YearCalendar />

          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <a href="/register" className="btn-primary">הרשמה לחוג ←</a>
          </div>
        </div>
      </section>

      {/* ════════════════════════════ WHY US ════════════════════════════ */}
      <section id="why" style={{ background: GREEN, padding: '88px 24px' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', textAlign: 'center' }}>
          <span style={{ background: `${PINK}28`, color: PINK, borderRadius: 20, padding: '5px 18px', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em' }}>
            למה טבע בייק?
          </span>
          <h2 style={{ color: '#fff', fontSize: 'clamp(1.9rem, 3.5vw, 2.8rem)', fontWeight: 900, margin: '14px 0 52px', letterSpacing: '-0.025em' }}>
            חוויה מקצועית. תוצאות אמיתיות.
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 20, textAlign: 'right' }}>
            {[
              { icon: '🏆', title: 'מדריכים מוסמכים', body: 'כל המדריכים מוסמכים בטכניקת גרביטי ובעלי ניסיון רב עם ילדים ומבוגרים' },
              { icon: '🛡️', title: 'בטיחות קודמת לכל', body: 'ציוד בטיחות מתקדם, מסלולים מותאמים לגיל ורמה, ותמיד בנוכחות מדריך' },
              { icon: '📊', title: 'מעקב התקדמות', body: 'דוחות נוכחות בזמן אמת ותקשורת שקופה עם ההורים על התפתחות הילד' },
              { icon: '🌿', title: '4 סניפים בגליל', body: 'משגב, ביריה, מטה אשר ופרוד-אמירים — חוגים קרוב לבית ברחבי הגליל' },
            ].map(f => (
              <div
                key={f.title}
                className="feature-card"
                style={{ background: GREEN_M, borderRadius: 16, padding: 28, border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div style={{ width: 54, height: 54, borderRadius: 14, background: `${PINK}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 18 }}>
                  {f.icon}
                </div>
                <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 800, margin: '0 0 10px' }}>{f.title}</h3>
                <p style={{ color: 'rgba(255,255,255,0.52)', fontSize: 14, lineHeight: 1.75, margin: 0 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════ PARTNERS ════════════════════════════ */}
      <section style={{ background: '#fff', padding: '60px 24px', borderTop: '1px solid #EAE6E1' }}>
        <p style={{ textAlign: 'center', color: '#C4BDB5', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', margin: '0 0 32px' }}>
          שותפים שלנו
        </p>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 60, flexWrap: 'wrap' }}>
          {[
            { src: '/logos/bh.png',      alt: 'BH Bikes',  h: 46 },
            { src: '/logos/ktm.png',     alt: 'KTM',       h: 58 },
            { src: '/logos/whistle.png', alt: 'Whistle',   h: 54, dark: true },
          ].map(p => (
            <a
              key={p.alt}
              href="https://www.motosport-bicycle.co.il/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'block', transition: 'opacity .25s, transform .25s', opacity: 0.42 }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.opacity='1'; el.style.transform='scale(1.06)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.opacity='0.42'; el.style.transform='scale(1)' }}
            >
              <img
                src={p.src}
                alt={p.alt}
                style={{ height: p.h, objectFit: 'contain', display: 'block', ...(p.dark ? { background: '#1a1a1a', borderRadius: 6, padding: '5px 10px' } : {}) }}
              />
            </a>
          ))}
        </div>
      </section>

      {/* ════════════════════════════ FOOTER ════════════════════════════ */}
      <footer style={{ background: DARK, padding: '64px 24px 32px', color: 'rgba(255,255,255,0.55)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 44, marginBottom: 52 }}>

            {/* Brand */}
            <div>
              <img src="/logo.png" alt="Tev Bike" style={{ height: 48, borderRadius: 6, marginBottom: 18, display: 'block' }} />
              <p style={{ fontSize: 14, lineHeight: 1.75, margin: '0 0 20px', color: 'rgba(255,255,255,0.42)', maxWidth: 220 }}>
                חוגי רכיבת שטח מקצועיים לילדים ומבוגרים ברחבי הגליל המערבי
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { href: '#', emoji: '📘', label: 'Facebook' },
                  { href: '#', emoji: '📸', label: 'Instagram' },
                  { href: '#', emoji: '🎬', label: 'YouTube' },
                ].map(s => (
                  <a
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, textDecoration: 'none', transition: 'background .2s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = `${PINK}28`}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
                  >
                    {s.emoji}
                  </a>
                ))}
              </div>
            </div>

            {/* Quick links */}
            <div>
              <h4 style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: '0 0 18px', letterSpacing: '0.05em' }}>ניווט מהיר</h4>
              {[
                { label: 'מורזין נוער 2027', href: '/morzine-2027' },
                { label: 'מחנה חנוכה', href: '/camp-hanukkah' },
                { label: 'סדנת איר באג', href: '/workshop-airbag' },
                { label: 'טבע בייק אקדמי', href: '/instructors-course' },
                { label: 'לוח שנה',  href: '#classes'  },
                { label: 'הרשמה',   href: '/register' },
                { label: 'למה אנחנו', href: '#why'    },
                { label: 'חנות',     href: '/shop'    },
                { label: 'ניהול',    href: '/admin'    },
              ].map(l => (
                <div key={l.label} style={{ marginBottom: 10 }}>
                  <a
                    href={l.href}
                    style={{ color: 'rgba(255,255,255,0.42)', fontSize: 14, textDecoration: 'none', transition: 'color .2s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = PINK}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.42)'}
                  >
                    {l.label} →
                  </a>
                </div>
              ))}
            </div>

            {/* Branches */}
            <div>
              <h4 style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: '0 0 18px', letterSpacing: '0.05em' }}>סניפים</h4>
              {(['משגב', 'ביריה', 'מטה אשר', 'פרוד-אמירים'] as const).map(b => (
                <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: BRANCH_COLOR[b], flexShrink: 0, boxShadow: `0 0 6px ${BRANCH_COLOR[b]}` }} />
                  <span style={{ fontSize: 14 }}>{b}</span>
                </div>
              ))}
            </div>

            {/* Contact */}
            <div>
              <h4 style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: '0 0 18px', letterSpacing: '0.05em' }}>צור קשר</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <a
                  href="https://wa.me/972584708084?text=%D7%94%D7%99%D7%99%2C%20%D7%90%D7%A0%D7%99%20%D7%9E%D7%A2%D7%95%D7%A0%D7%99%D7%99%D7%9F%2F%D7%AA%20%D7%9C%D7%A9%D7%9E%D7%95%D7%A2%20%D7%A4%D7%A8%D7%98%D7%99%D7%9D%20%D7%A2%D7%9C%20%D7%94%D7%97%D7%95%D7%92%D7%99%D7%9D"
                  style={{ color: 'rgba(255,255,255,0.42)', fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, transition: 'color .2s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#25D366'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.42)'}
                >
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: '#25D36622', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💬</span>
                  WhatsApp
                </a>
                <a
                  href="mailto:info@tevbike.com"
                  style={{ color: 'rgba(255,255,255,0.42)', fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, transition: 'color .2s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = PINK}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.42)'}
                >
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: `${PINK}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✉️</span>
                  info@tevbike.com
                </a>
                <a
                  href="https://waze.com/ul/hsvc4fmkzh"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'rgba(255,255,255,0.42)', fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, transition: 'color .2s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#33ccff'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.42)'}
                >
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: '#33ccff22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📍</span>
                  הגעה (Waze)
                </a>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ borderTop: `1px solid rgba(212,40,138,0.18)`, paddingTop: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ color: 'rgba(255,255,255,0.26)', fontSize: 12 }}>
                © {new Date().getFullYear()} טבע בייק. כל הזכויות שמורות.
              </span>
              <a
                href="/privacy"
                style={{ color: 'rgba(255,255,255,0.42)', fontSize: 12, textDecoration: 'none', transition: 'color .2s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = PINK}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.42)'}
              >
                מדיניות פרטיות
              </a>
            </div>
            <span style={{ color: PINK, fontSize: 12, fontWeight: 600 }}>
              Made with ❤️ in the Galilee
            </span>
          </div>
        </div>
      </footer>

      {/* ════════════════════════════ WHATSAPP BUTTON ════════════════════════════ */}
      <a
       href="https://wa.me/972584708084?text=%D7%94%D7%99%D7%99%2C%20%D7%9E%D7%A2%D7%95%D7%A0%D7%99%D7%99%D7%9F%20%D7%91%D7%A4%D7%A8%D7%98%D7%99%D7%9D"
        target="_blank"
        rel="noopener noreferrer"
        title="שלחו לנו הודעה בווצאפ"
        style={{
         position: 'fixed', bottom: 88, left: 24, zIndex: 999,
          width: 58, height: 58, borderRadius: '50%',
          background: '#25D366',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, textDecoration: 'none',
          boxShadow: '0 6px 26px rgba(37,211,102,0.48)',
          transition: 'transform .2s, box-shadow .2s',
        }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform='scale(1.12)'; el.style.boxShadow='0 10px 32px rgba(37,211,102,0.6)' }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform='scale(1)'; el.style.boxShadow='0 6px 26px rgba(37,211,102,0.48)' }}
      >
        💬
      </a>

    </main>
  )
}

// ─── Morzine youth 2027 promo (home page) ────────────────────────────────────
// מספר המקומות במחיר השקה נטען חי מה-API של דף מורזין
function MorzineYouthPromo() {
  const [slotsLeft, setSlotsLeft] = useState<number | null>(null)
  const [earlyBirdPrice, setEarlyBirdPrice] = useState(13200)
  const [regularPrice, setRegularPrice] = useState(13800)

  useEffect(() => {
    fetch('/api/morzine-youth-register')
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setSlotsLeft(d.earlyBirdSlotsLeft)
          setEarlyBirdPrice(d.earlyBirdPrice)
          setRegularPrice(d.regularPrice)
        }
      })
      .catch(() => {})
  }, [])

  return (
    <section style={{ background: DARK, padding: '48px 20px' }}>
      <a
        href="/morzine-2027"
        style={{
          display: 'block', maxWidth: 960, margin: '0 auto', textDecoration: 'none', color: '#fff',
          borderRadius: 18, overflow: 'hidden', border: `1px solid ${PINK}`,
          background: GREEN, boxShadow: `0 0 32px ${PINK}33`,
        }}
      >
        <img
          src="/morzine-youth-banner.png"
          alt="חופשת רכיבה לנוער במורזין 2027"
          style={{ width: '100%', aspectRatio: '4 / 1', objectFit: 'cover', display: 'block' }}
        />
        <div style={{ padding: '24px 22px 28px', textAlign: 'center' }}>
          <div style={{ color: PINK, fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', marginBottom: 6 }}>
            🇫🇷 חדש · קיץ 2027
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 'clamp(1.6rem,4vw,2.3rem)', fontWeight: 900 }}>
            מורזין נוער 2027
          </h2>
          <p style={{ margin: '0 0 16px', color: 'rgba(255,255,255,0.7)', fontSize: 15 }}>
            חופשת רכיבה לנוער בהרי האלפים · <span dir="ltr" style={{ whiteSpace: 'nowrap' }}>25.06–09.07.2027</span> · כולל טיסה
          </p>
          {slotsLeft !== null && slotsLeft > 0 && (
            <p style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 800 }}>
              🔥 רק 8 הנרשמים הראשונים: {earlyBirdPrice.toLocaleString()} ₪ במקום {regularPrice.toLocaleString()} ₪
              <br />
              <span style={{ color: PINK }}>נשארו עוד {slotsLeft} מקומות במחיר השקה</span>
            </p>
          )}
          <span className="btn-primary" style={{ display: 'inline-block' }}>לפרטים והרשמה ←</span>
        </div>
      </a>
    </section>
  )
}
