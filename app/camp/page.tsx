'use client'
import { useState, useEffect } from 'react'

type DayInfo = {
  id: string
  label: string
  date: string
  capacity: number | null
  taken: number
  remaining: number | null
}

const GROUPS = ['מיני גרביטי', 'גרביטי', 'ביריה', 'מטה אשר', 'אחר']

const DAY_DETAILS: Record<string, { title: string; place: string; what: string; img: string; schedule: string[] }> = {
  yaad: {
    title: "יום א' · 16.8",
    place: 'יעד',
    what: 'רכיבת אנדורו + סשן אייר באג',
    img: '/yaad.jpg',
    schedule: ['8:30 נפגשים במועדון טבע בייק', '8:45 תדריך ותחילת רכיבה', '13:30 ארוחת צהריים', '14:00 סיכום והביתה'],
  },
  yarden: {
    title: "יום ג' · 18.8",
    place: 'ירדן',
    what: 'קפיצות למים',
    img: '/yarden.jpg',
    schedule: ['9:55 נפגשים בכפר בלום', '10:00 תדריך ותחילת רכיבה', '13:30 הפסקת צהריים', '16:00 קיפול והביתה'],
  },
  misgav: {
    title: "יום ה' · 20.8",
    place: 'משגב',
    what: 'סשן אייר באג',
    img: '/misgav.jpg',
    schedule: ['8:30 נפגשים במועדון טבע בייק', '9:00 הקמה בשטח', '9:30 תדריך ותחילת קפיצות', '13:00 ארוחת צהריים', '14:00 קיפול והביתה'],
  },
}

const BG = '#0d0f0e'
const PANEL = '#141716'
const BORDER = '#252b27'
const TEXT = '#e8efe9'
const MUTED = '#7a8f7d'
const LIME = '#b5e853'
const PINK = '#ec4899'

export default function CampPage() {
  const [days, setDays] = useState<DayInfo[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [form, setForm] = useState({
    riderFirstName: '', riderLastName: '', groupName: '', parentName: '',
    parentPhone: '', childPhone: '', parentEmail: '', city: '', healthNotes: '',
    consentParentName: '',
  })
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ total: number; daysCount: number; paymentLink: string } | null>(null)

  useEffect(() => {
    fetch('/api/camp-register')
      .then(r => r.json())
      .then(d => { if (d.ok) setDays(d.days) })
      .catch(() => {})
  }, [])

  const total = selected.length * 300

  function toggleDay(id: string, full: boolean) {
    if (full) return
    setSelected(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])
  }

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function submit() {
    setError('')
    if (selected.length === 0) { setError('בחרו לפחות יום אחד'); return }
    if (!form.riderFirstName || !form.riderLastName || !form.parentName || !form.parentPhone || !form.parentEmail) {
      setError('מלאו את כל שדות החובה'); return
    }
    if (!consent || !form.consentParentName) { setError('יש לאשר את הצהרת ההורה'); return }

    setSending(true)
    try {
      const res = await fetch('/api/camp-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, days: selected, consentApproved: consent }),
      })
      const data = await res.json()
      if (!data.ok) { setError(data.error || 'משהו השתבש'); setSending(false); return }
      setDone({ total: data.total, daysCount: data.daysCount, paymentLink: data.paymentLink })
    } catch {
      setError('אין חיבור לשרת. נסו שוב.')
    }
    setSending(false)
  }

  const input: React.CSSProperties = {
    width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8,
    color: TEXT, fontFamily: 'Heebo, Arial, sans-serif', fontSize: 15,
    padding: '11px 13px', outline: 'none', boxSizing: 'border-box',
  }
  const label: React.CSSProperties = { display: 'block', color: MUTED, fontSize: 13, marginBottom: 6, fontWeight: 600 }

  // ---------- מסך אישור ----------
  if (done) {
    return (
      <div dir="rtl" style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: 'Heebo, Arial, sans-serif', padding: '48px 20px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🚵</div>
          <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800 }}>ההרשמה נקלטה</h1>
          <p style={{ color: MUTED, margin: '0 0 24px', lineHeight: 1.7 }}>
            שלחנו לך מייל עם כל הפרטים, רשימת הציוד ומדיניות הביטול.<br />
            נשאר רק לשלם — המקום נשמר אחרי התשלום.
          </p>
          <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, marginBottom: 22 }}>
            <div style={{ color: MUTED, fontSize: 13 }}>{done.daysCount} ימים × 300 ₪</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: LIME }}>{done.total} ₪</div>
          </div>
          <a href={done.paymentLink} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', background: LIME, color: BG, padding: '15px', borderRadius: 10, textDecoration: 'none', fontWeight: 800, fontSize: 17 }}>
            לתשלום
          </a>
          <p style={{ color: MUTED, fontSize: 13, marginTop: 22 }}>שאלות? בני 052-5708084 · טל 050-5358071</p>
        </div>
      </div>
    )
  }

  // ---------- טופס ----------
  return (
    <div dir="rtl" style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: 'Heebo, Arial, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 140px' }}>

        <img
          src="/camp-banner.jpg.jpg"
          alt="ימי שיא — Gravity Camp, אוגוסט 2026. 16.8 הקפצות ביעד, 18.8 קפיצות לירדן, 20.8 אייר באג"
          style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 14, marginBottom: 26 }}
        />

        <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
          ימי שיא — Gravity Camp, אוגוסט 2026
        </h1>

        <p style={{ color: TEXT, fontSize: 15, lineHeight: 1.8, margin: '0 0 8px' }}>
          שלושה ימי רכיבה עם הקפצות, אימונים מקצועיים וקפיצות. 08:30–14:00, כולל ארוחת צהריים. 300 ₪ ליום.
        </p>
        <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.9, margin: '0 0 32px' }}>
          מיועד לרוכבים מנוסים מגיל 11+, בכפוף לאישור בני או טל.<br />
          רוכבים חדשים או שאינם חברי טבע בייק — נדרש לשלוח סרטוני רכיבה לפני ההרשמה.<br />
          הגעה ופיזור באופן עצמאי. מספר המקומות מוגבל.
        </p>

        {/* בחירת ימים */}
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>בחרו ימים</h2>
        <p style={{ color: MUTED, fontSize: 13, margin: '0 0 16px' }}>אפשר יום אחד או יותר</p>

        <div style={{ display: 'grid', gap: 12, marginBottom: 36 }}>
          {days.map(d => {
            const details = DAY_DETAILS[d.id]
            const full = d.remaining !== null && d.remaining <= 0
            const on = selected.includes(d.id)
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDay(d.id, full)}
                disabled={full}
                style={{
                  textAlign: 'right', width: '100%', cursor: full ? 'not-allowed' : 'pointer',
                  background: on ? '#1a2114' : PANEL,
                  border: `2px solid ${on ? LIME : BORDER}`,
                  borderRadius: 14, padding: 18, color: TEXT,
                  fontFamily: 'Heebo, Arial, sans-serif', opacity: full ? 0.45 : 1,
                  transition: 'border-color .15s, background .15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    border: `2px solid ${on ? LIME : BORDER}`, background: on ? LIME : 'transparent',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: BG, fontSize: 13, fontWeight: 900,
                  }}>{on ? '✓' : ''}</span>
                  <span style={{ fontSize: 17, fontWeight: 800 }}>{details.place}</span>
                  <span style={{ color: MUTED, fontSize: 13 }}>{details.title}</span>
                  {d.remaining !== null && (
                    <span style={{
                      marginRight: 'auto', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 10,
                      background: full ? '#3a1a1a' : d.remaining <= 4 ? '#3a2f14' : '#1a2637',
                      color: full ? '#f87171' : d.remaining <= 4 ? '#fbbf24' : '#81d4fa',
                    }}>
                      {full ? 'מלא' : `נותרו ${d.remaining} מקומות`}
                    </span>
                  )}
                </div>
                <div style={{ color: PINK, fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{details.what}</div>
                <img
                  src={details.img}
                  alt={details.place}
                  loading="lazy"
                  style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 10, display: 'block', marginBottom: 12, filter: full ? 'grayscale(1)' : 'none' }}
                />
                <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.8 }}>
                  {details.schedule.map((s, i) => <div key={i}>{s}</div>)}
                </div>
              </button>
            )
          })}
          {days.length === 0 && <p style={{ color: MUTED, fontSize: 14 }}>טוען ימים...</p>}
        </div>

        {/* פרטי הרוכב */}
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 16px' }}>פרטי הרוכב</h2>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 32 }}>
          <div><label style={label}>שם פרטי *</label><input style={input} value={form.riderFirstName} onChange={e => set('riderFirstName', e.target.value)} /></div>
          <div><label style={label}>שם משפחה *</label><input style={input} value={form.riderLastName} onChange={e => set('riderLastName', e.target.value)} /></div>
          <div>
            <label style={label}>קבוצה</label>
            <select style={input} value={form.groupName} onChange={e => set('groupName', e.target.value)}>
              <option value="">בחרו קבוצה</option>
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div><label style={label}>נייד הילד</label><input style={input} type="tel" value={form.childPhone} onChange={e => set('childPhone', e.target.value)} /></div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>מגבלה בריאותית או רגישות שחשוב שנדע</label>
            <input style={input} value={form.healthNotes} onChange={e => set('healthNotes', e.target.value)} placeholder="אין / פרטו" />
          </div>
        </div>

        {/* פרטי ההורה */}
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 16px' }}>פרטי ההורה הרושם</h2>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 32 }}>
          <div><label style={label}>שם מלא *</label><input style={input} value={form.parentName} onChange={e => set('parentName', e.target.value)} /></div>
          <div><label style={label}>נייד *</label><input style={input} type="tel" value={form.parentPhone} onChange={e => set('parentPhone', e.target.value)} /></div>
          <div><label style={label}>אימייל *</label><input style={input} type="email" value={form.parentEmail} onChange={e => set('parentEmail', e.target.value)} placeholder="לשם יישלח אישור ההרשמה" /></div>
          <div><label style={label}>ישוב</label><input style={input} value={form.city} onChange={e => set('city', e.target.value)} /></div>
        </div>

        {/* הצהרה */}
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 12px' }}>הצהרת הורה</h2>
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, marginBottom: 16, color: MUTED, fontSize: 13.5, lineHeight: 1.9 }}>
          <p style={{ marginTop: 0 }}>אני מאשר/ת את השתתפות בני/בתי בפעילות הרכיבה של טבע בייק.</p>
          <p>ידוע לי שרכיבת שטח ופעילות אתגרית כוללות סיכונים מהותיים, לרבות נפילה, פציעה ונזק גופני, ואני מאשר/ת את ההשתתפות מתוך בחירה מלאה ואחריות הורית.</p>
          <p>ידוע לי שנדרשת יכולת רכיבה בסיסית ומעלה.</p>
          <p>אני אחראי/ת לצייד את ילדי באופניים תקינים ובטיחותיים, קסדה תקנית, מגני גוף, מים וציוד אישי כנדרש.</p>
          <p style={{ marginBottom: 0 }}>אני מתחייב/ת לעדכן את מארגני הפעילות בכל מגבלה רפואית או רגישות רלוונטית.</p>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={label}>שם ההורה החותם *</label>
          <input style={input} value={form.consentParentName} onChange={e => set('consentParentName', e.target.value)} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 28, fontSize: 14 }}>
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ width: 20, height: 20, accentColor: LIME, cursor: 'pointer' }} />
          קראתי והבנתי את כל האמור לעיל ואני מאשר/ת
        </label>

        {/* מדיניות ביטול */}
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, color: MUTED, fontSize: 13, lineHeight: 1.9 }}>
          <b style={{ color: TEXT }}>מדיניות ביטול</b><br />
          ביטול עד 14 יום לפני תחילת המחנה — החזר של 50%.<br />
          ביטול פחות מ־3 ימים לפני — ללא החזר.
        </div>

        {error && (
          <div style={{ background: '#3a1a1a', border: '1px solid #7f2d2d', color: '#fca5a5', borderRadius: 10, padding: '12px 16px', marginTop: 18, fontSize: 14 }}>
            {error}
          </div>
        )}
      </div>

      {/* סרגל תחתון דביק */}
      <div style={{
        position: 'fixed', bottom: 0, right: 0, left: 0, background: PANEL,
        borderTop: `1px solid ${BORDER}`, padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center', flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 130 }}>
          <div style={{ color: MUTED, fontSize: 12 }}>
            {selected.length === 0 ? 'לא נבחרו ימים' : `${selected.length} ימים × 300 ₪`}
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: selected.length ? LIME : MUTED }}>{total} ₪</div>
        </div>
        <button
          onClick={submit}
          disabled={sending}
          style={{
            background: sending ? BORDER : LIME, color: sending ? MUTED : BG, border: 'none',
            borderRadius: 10, padding: '14px 40px', fontSize: 16, fontWeight: 800,
            fontFamily: 'Heebo, Arial, sans-serif', cursor: sending ? 'default' : 'pointer',
          }}
        >
          {sending ? 'שולח...' : 'שליחת הרשמה'}
        </button>
      </div>
    </div>
  )
}
