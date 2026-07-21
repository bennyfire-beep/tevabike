'use client'
import { useState, useEffect } from 'react'

const GROUPS = ['מיני גרביטי', 'גרביטי', 'ביריה', 'מטה אשר', 'מצובה', 'אחר']
const LEVELS = ['מתחיל', 'בינוני', 'מתקדם']

const BG = '#0d0f0e'
const PANEL = '#141716'
const BORDER = '#252b27'
const TEXT = '#e8efe9'
const MUTED = '#7a8f7d'
const LIME = '#b5e853'
const PINK = '#ec4899'

type Info = { capacity: number; taken: number; remaining: number; minParticipants: number; price: number }

export default function SukkotCampPage() {
  const [info, setInfo] = useState<Info | null>(null)
  const [form, setForm] = useState({
    riderFirstName: '', riderLastName: '', birthDate: '', grade: '', groupName: '',
    ridingLevel: '', parentName: '', parentPhone: '', secondParentPhone: '',
    childPhone: '', parentEmail: '', city: '', healthNotes: '', foodNotes: '',
    consentParentName: '',
  })
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ total: number; paymentLink: string } | null>(null)

  useEffect(() => {
    fetch('/api/sukkot-register')
      .then(r => r.json())
      .then(d => { if (d.ok) setInfo(d) })
      .catch(() => {})
  }, [])

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function submit() {
    setError('')
    if (!form.riderFirstName || !form.riderLastName || !form.parentName || !form.parentPhone || !form.parentEmail) {
      setError('מלאו את כל שדות החובה'); return
    }
    if (!consent || !form.consentParentName) { setError('יש לאשר את הצהרת ההורה'); return }

    setSending(true)
    try {
      const res = await fetch('/api/sukkot-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, consentApproved: consent }),
      })
      const data = await res.json()
      if (!data.ok) { setError(data.error || 'משהו השתבש'); setSending(false); return }
      setDone({ total: data.total, paymentLink: data.paymentLink })
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
  const h2: React.CSSProperties = { fontSize: 18, fontWeight: 800, margin: '0 0 16px' }
  const grid: React.CSSProperties = {
    display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 32,
  }

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
            <div style={{ color: MUTED, fontSize: 13 }}>מחנה סוכות · 5 ימים</div>
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

  const full = info !== null && info.remaining <= 0

  // ---------- טופס ----------
  return (
    <div dir="rtl" style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: 'Heebo, Arial, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 140px' }}>

        <img
          src="/camp-sukkot-banner.png"
          alt="מחנה סוכות — מחנה רכיבה משמר העמק, 27.09–01.10"
          style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 14, marginBottom: 26 }}
        />

        <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
          מחנה סוכות — מחנה רכיבה משמר העמק
        </h1>

        <p style={{ color: TEXT, fontSize: 15, lineHeight: 1.8, margin: '0 0 8px' }}>
          חמישה ימי רכיבה במשמר העמק — אנדורו, הקפצות, פאמפטרק ואייר באג. המחנה כולל ארוחות ולינה.
        </p>
        <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.9, margin: '0 0 24px' }}>
          מיועד לכיתות ו&apos; ומעלה · 2,900 ₪ למשתתף · מינימום 8 משתתפים לפתיחת המחנה.<br />
          רוכבים שאינם חברי טבע בייק — נדרש אישור בני או טל לפני ההרשמה.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 12px' }}>לוז המחנה</h2>
        <img
          src="/camp-sukkot.png"
          alt="לוז יומי של מחנה סוכות"
          style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 14, marginBottom: 30 }}
        />

        {info && (
          <div style={{
            background: full ? '#3a1a1a' : info.remaining <= 4 ? '#3a2f14' : PANEL,
            border: `1px solid ${full ? '#7f2d2d' : BORDER}`,
            borderRadius: 12, padding: '14px 18px', marginBottom: 32,
            fontSize: 15, fontWeight: 700,
            color: full ? '#f87171' : info.remaining <= 4 ? '#fbbf24' : TEXT,
          }}>
            {full ? 'המחנה מלא — התקשרו לרשימת המתנה: 052-5708084' : `נותרו ${info.remaining} מקומות מתוך ${info.capacity}`}
          </div>
        )}

        {/* פרטי הרוכב */}
        <h2 style={h2}>פרטי הרוכב</h2>
        <div style={grid}>
          <div><label style={label}>שם פרטי *</label><input style={input} value={form.riderFirstName} onChange={e => set('riderFirstName', e.target.value)} /></div>
          <div><label style={label}>שם משפחה *</label><input style={input} value={form.riderLastName} onChange={e => set('riderLastName', e.target.value)} /></div>
          <div><label style={label}>תאריך לידה</label><input style={input} value={form.birthDate} onChange={e => set('birthDate', e.target.value)} placeholder="למשל 14.03.2013" /></div>
          <div><label style={label}>כיתה</label><input style={input} value={form.grade} onChange={e => set('grade', e.target.value)} placeholder="למשל ז'" /></div>
          <div>
            <label style={label}>קבוצה</label>
            <select style={input} value={form.groupName} onChange={e => set('groupName', e.target.value)}>
              <option value="">בחרו קבוצה</option>
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>רמת רכיבה</label>
            <select style={input} value={form.ridingLevel} onChange={e => set('ridingLevel', e.target.value)}>
              <option value="">בחרו רמה</option>
              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div><label style={label}>נייד הילד</label><input style={input} type="tel" value={form.childPhone} onChange={e => set('childPhone', e.target.value)} /></div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>מגבלה בריאותית, אלרגיה או תרופות קבועות</label>
            <input style={input} value={form.healthNotes} onChange={e => set('healthNotes', e.target.value)} placeholder="אין / פרטו" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>רגישות או העדפה באוכל (המחנה כולל ארוחות)</label>
            <input style={input} value={form.foodNotes} onChange={e => set('foodNotes', e.target.value)} placeholder="אין / צמחוני / ללא גלוטן..." />
          </div>
        </div>

        {/* פרטי ההורה */}
        <h2 style={h2}>פרטי ההורה הרושם</h2>
        <div style={grid}>
          <div><label style={label}>שם מלא *</label><input style={input} value={form.parentName} onChange={e => set('parentName', e.target.value)} /></div>
          <div><label style={label}>נייד *</label><input style={input} type="tel" value={form.parentPhone} onChange={e => set('parentPhone', e.target.value)} /></div>
          <div><label style={label}>טלפון הורה נוסף</label><input style={input} type="tel" value={form.secondParentPhone} onChange={e => set('secondParentPhone', e.target.value)} /></div>
          <div><label style={label}>אימייל *</label><input style={input} type="email" value={form.parentEmail} onChange={e => set('parentEmail', e.target.value)} placeholder="לשם יישלח אישור ההרשמה" /></div>
          <div><label style={label}>ישוב</label><input style={input} value={form.city} onChange={e => set('city', e.target.value)} /></div>
        </div>

        {/* הצהרה */}
        <h2 style={{ ...h2, marginBottom: 12 }}>הצהרת הורה</h2>
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, marginBottom: 16, color: MUTED, fontSize: 13.5, lineHeight: 1.9 }}>
          <p style={{ marginTop: 0 }}>אני מאשר/ת את השתתפות בני/בתי במחנה הרכיבה של טבע בייק, כולל לינה מחוץ לבית.</p>
          <p>ידוע לי שרכיבת שטח ופעילות אתגרית כוללות סיכונים מהותיים, לרבות נפילה, פציעה ונזק גופני, ואני מאשר/ת את ההשתתפות מתוך בחירה מלאה ואחריות הורית.</p>
          <p>ידוע לי שנדרשת יכולת רכיבה בסיסית ומעלה.</p>
          <p>אני אחראי/ת לצייד את ילדי באופניים תקינים ובטיחותיים, קסדה תקנית, מגני גוף, מים וציוד אישי כנדרש.</p>
          <p>אני מאשר/ת שילדי יישמע להוראות הצוות, ומודע/ת לכך שהפרה חמורה של כללי הבטיחות עלולה להוביל להפסקת השתתפות.</p>
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
          ביטול פחות מ־3 ימים לפני — ללא החזר.<br />
          המחנה ייפתח בכפוף למינימום 8 משתתפים.
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
          <div style={{ color: MUTED, fontSize: 12 }}>מחנה סוכות · 5 ימים</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: LIME }}>2,900 ₪</div>
        </div>
        <button
          onClick={submit}
          disabled={sending || full}
          style={{
            background: sending || full ? BORDER : LIME, color: sending || full ? MUTED : BG, border: 'none',
            borderRadius: 10, padding: '14px 40px', fontSize: 16, fontWeight: 800,
            fontFamily: 'Heebo, Arial, sans-serif', cursor: sending || full ? 'default' : 'pointer',
          }}
        >
          {full ? 'המחנה מלא' : sending ? 'שולח...' : 'שליחת הרשמה'}
        </button>
      </div>
    </div>
  )
}
