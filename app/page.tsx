'use client'
import { useState, useEffect } from 'react'

// ─── Brand ───────────────────────────────────────────────────────────────────
const PINK      = '#D4288A'
const PINK_H    = '#B51E77'
const DARK      = '#0C1814'
const GREEN     = '#152A1E'
const GREEN_M   = '#1F3D2A'
const OFF_WHITE = '#F5F2EE'

// ─── Data ────────────────────────────────────────────────────────────────────
const KIDS_CLASSES = [
  { level: 'גרביטי מתחילים', branch: 'משגב',  days: "א' + ג'",  age: '6-10', icon: '🌱' },
  { level: 'גרביטי מתחילים', branch: 'מצובה', days: "ב' + ד'",  age: '6-10', icon: '🌱' },
  { level: 'גרביטי מתחילים', branch: 'ביריה', days: "א' + ה'",  age: '6-10', icon: '🌱' },
  { level: 'גרביטי מתקדמים', branch: 'משגב',  days: "ב' + ד'",  age: '10-14', icon: '🔥' },
  { level: 'גרביטי מתקדמים', branch: 'מצובה', days: "א' + ג'",  age: '10-14', icon: '🔥' },
  { level: 'גרביטי פרו',     branch: 'משגב',  days: "ג' + ו'",  age: '12+',   icon: '⚡' },
]

const ADULTS_CLASSES = [
  { level: 'רכיבה טכנית',  day: "יום א'", icon: '🏔️', desc: 'שיפור טכניקת רכיבה בשטח' },
  { level: 'כושר ואושר',   day: "יום ב'", icon: '💪', desc: 'אימון כושר על הפדלים' },
  { level: 'רכיבה לנשים',  day: "יום ג'", icon: '✨', desc: 'קבוצת נשים בסביבה תומכת' },
  { level: 'טכני חשמלי',   day: "יום ד'", icon: '⚡', desc: 'טכניקה על אופניים חשמליים' },
  { level: 'נשים טכני',    day: "יום ה'", icon: '🌟', desc: 'טכניקה מתקדמת לנשים' },
]

const LEVEL_COLORS: Record<string, [string, string]> = {
  'גרביטי מתחילים': [`${PINK}1A`, PINK],
  'גרביטי מתקדמים': ['#8B22D41A', '#8B22D4'],
  'גרביטי פרו':     ['#1F3D2A',   '#4cdb7a'],
}

const BRANCH_COLOR: Record<string, string> = {
  'משגב':  PINK,
  'מצובה': '#22B5D4',
  'ביריה': '#4cdb7a',
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
  const [tab, setTab]           = useState<'kids' | 'adults'>('kids')
  const [scrolled, setScrolled] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', email: '', branch: '', classType: ''
  })

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.firstName || !form.phone || !form.classType) {
      alert('אנא מלא שם, טלפון וחוג')
      return
    }
    setSubmitted(true)
  }

  const upd = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <main style={{ fontFamily: 'inherit', background: '#fff', color: DARK, overflowX: 'hidden' }}>

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

          {/* Nav links (left in RTL) */}
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            <a href="#classes" className="nav-link">חוגים</a>
            <a href="#why" className="nav-link">למה אנחנו</a>
            <a href="#register" className="btn-primary" style={{ padding: '8px 22px', fontSize: 14, borderRadius: 8 }}>
              הרשמה
            </a>
          </div>
        </div>
      </nav>

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
            חוגי גרביטי, טכניקה וכושר לילדים ומבוגרים — בגליל המערבי
          </p>

          {/* Location chips */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 38, flexWrap: 'wrap' }}>
            {(['משגב', 'מצובה', 'ביריה'] as const).map(b => (
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
            <a href="#register" className="btn-primary">הירשמו עכשיו</a>
            <a href="#classes" className="btn-outline">גלה את החוגים</a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="scroll-indicator" style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 1, height: 36, background: `linear-gradient(to bottom, transparent, rgba(255,255,255,0.35))` }} />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, letterSpacing: '0.1em' }}>SCROLL</span>
        </div>
      </section>

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

      {/* ════════════════════════════ CLASSES ════════════════════════════ */}
      <section id="classes" style={{ background: OFF_WHITE, padding: '88px 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          {/* Section header */}
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <span style={{ background: `${PINK}18`, color: PINK, borderRadius: 20, padding: '5px 18px', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em' }}>
              לוח חוגים
            </span>
            <h2 style={{ fontSize: 'clamp(1.9rem, 3.5vw, 2.8rem)', fontWeight: 900, color: DARK, margin: '14px 0 8px', letterSpacing: '-0.025em' }}>
              בחרו את החוג שלכם
            </h2>
            <p style={{ color: '#7A8880', fontSize: 16, margin: 0 }}>חוגים מקצועיים לכל הגילאים ורמות הרכיבה</p>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 40 }}>
            {[
              { id: 'kids',   label: 'ילדים — גרביטי', emoji: '🚵' },
              { id: 'adults', label: 'מבוגרים',         emoji: '🏔️' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as 'kids' | 'adults')}
                style={{
                  padding: '11px 30px', borderRadius: 10, border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 15,
                  background: tab === t.id ? PINK : '#fff',
                  color: tab === t.id ? '#fff' : '#666',
                  boxShadow: tab === t.id ? `0 6px 20px rgba(212,40,138,0.32)` : '0 2px 10px rgba(0,0,0,0.07)',
                  transition: 'all .25s',
                }}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>

          {/* Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 20 }}>
            {tab === 'kids' ? KIDS_CLASSES.map((c, i) => {
              const [bg, color] = LEVEL_COLORS[c.level] ?? [`${PINK}18`, PINK]
              return (
                <div
                  key={i}
                  className="card-class"
                  style={{ background: '#fff', borderRadius: 16, padding: 26, border: '1px solid #EAE6E1', boxShadow: '0 2px 14px rgba(0,0,0,0.05)', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                    <span style={{ background: bg, color, borderRadius: 20, padding: '4px 13px', fontSize: 11, fontWeight: 700 }}>
                      {c.level}
                    </span>
                    <span style={{ fontSize: 22 }}>{c.icon}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: BRANCH_COLOR[c.branch] ?? '#ccc', flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: 14, color: DARK }}>{c.branch}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, color: '#7A8880', fontSize: 13 }}>
                      <span>📅</span> <span>{c.days}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, color: '#7A8880', fontSize: 13 }}>
                      <span>👦</span> <span>גיל {c.age}</span>
                    </div>
                  </div>

                  <a
                    href="#register"
                    style={{
                      display: 'block', textAlign: 'center', padding: '9px 0', borderRadius: 8,
                      background: `${PINK}12`, color: PINK, fontSize: 13, fontWeight: 700,
                      textDecoration: 'none', border: `1px solid ${PINK}2A`,
                      transition: 'background .2s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = `${PINK}22`}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = `${PINK}12`}
                  >
                    הרשמה לחוג ←
                  </a>
                </div>
              )
            }) : ADULTS_CLASSES.map((c, i) => (
              <div
                key={i}
                className="card-class"
                style={{ background: '#fff', borderRadius: 16, padding: 26, border: '1px solid #EAE6E1', boxShadow: '0 2px 14px rgba(0,0,0,0.05)', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <span style={{ background: `${PINK}1A`, color: PINK, borderRadius: 20, padding: '4px 13px', fontSize: 11, fontWeight: 700 }}>
                    {c.level}
                  </span>
                  <span style={{ fontSize: 22 }}>{c.icon}</span>
                </div>
                <p style={{ color: '#7A8880', fontSize: 13, margin: '0 0 14px', lineHeight: 1.6 }}>{c.desc}</p>
                <div style={{ display: 'flex', gap: 6, color: '#7A8880', fontSize: 13, marginBottom: 18 }}>
                  <span>📅</span> <span>{c.day}</span>
                </div>
                <a
                  href="#register"
                  style={{
                    display: 'block', textAlign: 'center', padding: '9px 0', borderRadius: 8,
                    background: `${PINK}12`, color: PINK, fontSize: 13, fontWeight: 700,
                    textDecoration: 'none', border: `1px solid ${PINK}2A`,
                    transition: 'background .2s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = `${PINK}22`}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = `${PINK}12`}
                >
                  הרשמה לחוג ←
                </a>
              </div>
            ))}
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
              { icon: '🌿', title: '3 סניפים בגליל', body: 'משגב, מצובה וביריה — חוגים קרוב לבית ברחבי הגליל המערבי' },
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

      {/* ════════════════════════════ REGISTRATION ════════════════════════════ */}
      <section id="register" style={{ background: OFF_WHITE, padding: '88px 24px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <span style={{ background: `${PINK}18`, color: PINK, borderRadius: 20, padding: '5px 18px', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em' }}>
              הרשמה לחוג
            </span>
            <h2 style={{ fontSize: 'clamp(1.9rem, 3.5vw, 2.5rem)', fontWeight: 900, color: DARK, margin: '14px 0 8px', letterSpacing: '-0.02em' }}>
              מצטרפים לטבע בייק?
            </h2>
            <p style={{ color: '#7A8880', fontSize: 15, margin: 0 }}>
              מלאו את הטופס ונחזור אליכם תוך 24 שעות עם קישור לתשלום
            </p>
          </div>

          <div style={{ background: '#fff', borderRadius: 20, padding: '40px 36px', boxShadow: '0 10px 48px rgba(0,0,0,0.09)', border: '1px solid #EAE6E1' }}>
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: `${PINK}14`, margin: '0 auto 22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38 }}>
                  ✅
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 900, color: DARK, margin: '0 0 10px' }}>ההרשמה התקבלה!</h3>
                <p style={{ color: '#7A8880', fontSize: 15, margin: 0 }}>
                  נשלח אליך קישור לתשלום בהוראת קבע תוך 24 שעות
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FormInput label="שם פרטי *"  placeholder="ישראל"     value={form.firstName} onChange={upd('firstName')} />
                  <FormInput label="שם משפחה"   placeholder="ישראלי"    value={form.lastName}  onChange={upd('lastName')} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FormInput label="טלפון *" type="tel"   placeholder="05X-XXXXXXX"     value={form.phone} onChange={upd('phone')} />
                  <FormInput label="אימייל"  type="email" placeholder="name@example.com" value={form.email} onChange={upd('email')} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FormSelect
                    label="סניף"
                    value={form.branch}
                    onChange={upd('branch')}
                    options={[
                      { value: '', label: 'בחר סניף...' },
                      { value: 'משגב',  label: 'משגב'  },
                      { value: 'מצובה', label: 'מצובה' },
                      { value: 'ביריה', label: 'ביריה' },
                    ]}
                  />
                  <FormSelect
                    label="חוג *"
                    value={form.classType}
                    onChange={upd('classType')}
                    options={[
                      { value: '', label: 'בחר חוג...' },
                      { value: 'גרביטי מתחילים',  label: 'גרביטי מתחילים'  },
                      { value: 'גרביטי מתקדמים', label: 'גרביטי מתקדמים' },
                      { value: 'גרביטי פרו',      label: 'גרביטי פרו'      },
                      { value: 'רכיבה טכנית',     label: 'רכיבה טכנית'     },
                      { value: 'כושר ואושר',      label: 'כושר ואושר'      },
                      { value: 'רכיבה לנשים',     label: 'רכיבה לנשים'     },
                      { value: 'טכני חשמלי',      label: 'טכני חשמלי'      },
                      { value: 'נשים טכני',        label: 'נשים טכני'        },
                    ]}
                  />
                </div>

                <p style={{ color: '#9ca3af', fontSize: 12, margin: '2px 0 2px' }}>
                  בלחיצה על שלח מאשר/ת קריאת תנאי ההשתתפות. קישור לתשלום יישלח תוך 24 שעות.
                </p>

                <button
                  type="submit"
                  className="btn-primary"
                  style={{ width: '100%', textAlign: 'center', marginTop: 6, fontSize: 17, padding: '14px 0' }}
                >
                  שלח הרשמה ←
                </button>
              </form>
            )}
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
                { label: 'חוגים',    href: '#classes'  },
                { label: 'הרשמה',   href: '#register' },
                { label: 'למה אנחנו', href: '#why'    },
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
              {(['משגב', 'מצובה', 'ביריה'] as const).map(b => (
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
                  href="https://wa.me/9725XXXXXXXX"
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
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ borderTop: `1px solid rgba(212,40,138,0.18)`, paddingTop: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ color: 'rgba(255,255,255,0.26)', fontSize: 12 }}>
              © {new Date().getFullYear()} טבע בייק. כל הזכויות שמורות.
            </span>
            <span style={{ color: PINK, fontSize: 12, fontWeight: 600 }}>
              Made with ❤️ in the Galilee
            </span>
          </div>
        </div>
      </footer>

      {/* ════════════════════════════ WHATSAPP BUTTON ════════════════════════════ */}
      <a
        href="https://wa.me/9725XXXXXXXX"
        target="_blank"
        rel="noopener noreferrer"
        title="שלחו לנו הודעה בווצאפ"
        style={{
          position: 'fixed', bottom: 24, left: 24, zIndex: 999,
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
