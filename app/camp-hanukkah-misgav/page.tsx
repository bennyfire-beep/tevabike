'use client'
import { useState, useEffect } from 'react'
import { WHATSAPP_OPTIN_LABEL } from '@/lib/whatsapp-optin'
import {
  MISGAV_DAYS, MISGAV_GROUPS, MISGAV_INSTRUCTORS, MISGAV_MIN_PER_DAY, MISGAV_RAIN_NOTE,
  misgavDayPrice, misgavPriceText,
} from '@/lib/camp-misgav'

const BG = '#0d0f0e'
const PANEL = '#141716'
const BORDER = '#252b27'
const TEXT = '#e8efe9'
const MUTED = '#7a8f7d'
const LIME = '#b5e853'
const AMBER = '#fbbf24'

type Payment = { day: string; label: string; link: string; price: number }

export default function HanukkahMisgavPage() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [form, setForm] = useState({
    riderFirstName: '', riderLastName: '', age: '', groupName: '',
    parentName: '', parentPhone: '', parentEmail: '', city: '', healthNotes: '',
    consentParentName: '',
  })
  const [days, setDays] = useState<string[]>([])
  const [consent, setConsent] = useState(false)
  const [whatsappOptin, setWhatsappOptin] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ total: number; payments: Payment[] } | null>(null)

  useEffect(() => {
    fetch('/api/hanukkah-misgav-register')
      .then(r => r.json())
      .then(d => { if (d.ok) setCounts(d.counts) })
      .catch(() => {})
  }, [])

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }
  function toggleDay(key: string) {
    setDays(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key])
  }

  const total = days.reduce((s, d) => s + misgavDayPrice(d), 0)

  async function submit() {
    setError('')
    if (days.length === 0) { setError('בחרו לפחות יום אחד'); return }
    if (!form.riderFirstName || !form.riderLastName || !form.parentName || !form.parentPhone || !form.city) {
      setError('מלאו את כל שדות החובה'); return
    }
    if (!consent || !form.consentParentName) { setError('יש לאשר את הצהרת ההורה'); return }

    setSending(true)
    try {
      const res = await fetch('/api/hanukkah-misgav-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, days, consentApproved: consent, whatsappOptin }),
      })
      const data = await res.json()
      if (!data.ok) { setError(data.error || 'משהו השתבש'); setSending(false); return }
      setDone({ total: data.total, payments: data.payments })
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
  const h2: React.CSSProperties = { fontSize: 18, fontWeight: 800, margin: '0 0 14px' }
  const grid: React.CSSProperties = {
    display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 32,
  }
  const page: React.CSSProperties = { background: BG, minHeight: '100vh', color: TEXT, fontFamily: 'Heebo, Arial, sans-serif' }

  // ---------- מסך אישור ----------
  if (done) {
    return (
      <div dir="rtl" style={{ ...page, padding: '48px 20px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🌲</div>
          <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800 }}>ההרשמה נקלטה</h1>
          <p style={{ color: MUTED, margin: '0 0 24px', lineHeight: 1.7 }}>
            {done.total > 0
              ? <>נשאר רק לשלם על יום האיירבג — <b style={{ color: TEXT }}>המקום נשמר רק אחרי התשלום.</b></>
              : <>המקום שמור — נתראה ביער! 🌲</>}
          </p>
          <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, marginBottom: 18 }}>
            <div style={{ color: MUTED, fontSize: 13 }}>מחנה חנוכה במשגב · {done.payments.length} {done.payments.length === 1 ? 'יום' : 'ימים'}</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: LIME }}>{done.total} ₪</div>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {done.payments.map(p => p.price === 0 ? (
              <div key={p.day} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, fontSize: 14 }}>
                {p.label} — ללא עלות, המקום שמור ✓
              </div>
            ) : p.link ? (
              <a key={p.day} href={p.link} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', background: LIME, color: BG, padding: '14px', borderRadius: 10, textDecoration: 'none', fontWeight: 800, fontSize: 16 }}>
                לתשלום · {p.label} · {p.price} ₪
              </a>
            ) : (
              <div key={p.day} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, fontSize: 14, color: MUTED }}>
                {p.label} — קישור לתשלום יישלח אליכם בוואטסאפ
              </div>
            ))}
          </div>
          <p style={{ color: MUTED, fontSize: 13, marginTop: 22 }}>שאלות? בני 052-5708084 · טל 050-5358071</p>
        </div>
      </div>
    )
  }

  // ---------- עמוד + טופס ----------
  return (
    <div dir="rtl" style={page}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 150px' }}>

        <img
          src="/camp-hanukkah-misgav-flyer-v3.jpg"
          alt="מחנה חנוכה טבע בייק — ראשון ושני 6–7 בדצמבר, 08:30–13:00"
          width={1122} height={1402}
          style={{ width: '100%', maxWidth: 480, height: 'auto', display: 'block', margin: '0 auto 28px', borderRadius: 14 }}
        />

        <div style={{ marginBottom: 22 }}>
          <div style={{ color: LIME, fontSize: 14, fontWeight: 700, marginBottom: 6 }}>6–7 בדצמבר · ראשון–שני · 08:30–13:00</div>
          <h1 style={{ margin: 0, fontSize: 'clamp(30px, 7vw, 44px)', fontWeight: 900, lineHeight: 1.15 }}>
            מחנה חנוכה <span style={{ color: LIME }}>במשגב</span> 🕎
          </h1>
          <div style={{ color: MUTED, fontSize: 15, fontWeight: 600, marginTop: 8 }}>
            לקבוצות מיני גרביטי ומתחילים · גילאי 10–13
          </div>
        </div>

        <p style={{ fontSize: 15, lineHeight: 1.8, margin: '0 0 12px' }}>
          🌲 שני בקרים של רכיבה, יער וחברים בחופשת חנוכה!
        </p>
        <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.9, margin: '0 0 24px' }}>
          טבע בייק מזמינה את רוכבי <b style={{ color: TEXT }}>מיני גרביטי משגב, המתחילים, מיני גרביטי ביריה ומטה אשר</b> לבקרים
          של רכיבה ביערות משגב. נכיר סינגלים שאין לנו זמן להגיע אליהם באימונים הרגילים, נשחק, נתרגל טכניקה
          — וביום השני מחכה לנו גם <b style={{ color: TEXT }}>איירבג</b> 🤸
        </p>

        {/* לוח זמנים */}
        <h2 style={h2}>לוח זמנים יומי</h2>
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
          {[
            ['08:30–10:30', 'פעילות ורכיבה ביער'],
            ['10:30–11:00', 'הפסקת בוקר'],
            ['11:00–13:00', 'המשך פעילות וסיום'],
          ].map(([time, what], i) => (
            <div key={time} style={{ display: 'flex', gap: 16, padding: '12px 16px', borderTop: i ? `1px solid ${BORDER}` : 'none', fontSize: 14 }}>
              <div style={{ color: LIME, fontWeight: 800, minWidth: 96, direction: 'ltr', textAlign: 'right' }}>{time}</div>
              <div>{what}</div>
            </div>
          ))}
        </div>

        <h2 style={h2}>מה מחכה לנו</h2>
        <ul style={{ fontSize: 14, lineHeight: 2, margin: '0 0 24px', paddingRight: 20 }}>
          <li>🌲 רכיבה ופעילות ביער</li>
          <li>🚵 היכרות עם סינגלים שלא מגיעים אליהם במהלך האימונים</li>
          <li>🌲 <b>יום ראשון 6.12 — יום החזר:</b> רכיבה ופעילות ביער, ללא עלות</li>
          <li>🤸 <b>יום שני 7.12 — איירבג וסינגלים חדשים ביער:</b> קפיצות לכרית אוויר וסינגלים שעוד לא היינו בהם, 200 ₪</li>
          <li>🎉 אווירת חנוכה וחברים מכל הקבוצות</li>
        </ul>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 24 }}>
          {[
            ['תאריכים', 'ראשון–שני, 6–7 בדצמבר'],
            ['שעות', '08:30–13:00'],
            ['נקודת מפגש', 'מועדון טבע בייק · בוויז: "טבע בייק"'],
            ['הגעה ופיזור', 'עצמאיים'],
            ['גילאים', '10–13'],
            ['מדריכים', MISGAV_INSTRUCTORS.join(' · ')],
            ['עלות', 'יום ראשון — ללא עלות · יום שני — 200 ₪'],
          ].map(([k, v]) => (
            <div key={k} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRight: `3px solid ${LIME}`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ color: MUTED, fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>{v}</div>
            </div>
          ))}
        </div>

        <h2 style={h2}>להביא</h2>
        <ul style={{ fontSize: 14, lineHeight: 2, margin: '0 0 24px', paddingRight: 20 }}>
          <li>אופניים תקינים, קסדה תקנית וכפפות</li>
          <li>בקבוק מים וארוחת בוקר קלה להפסקה</li>
          <li><b>בגדים להחלפה</b> 🌧️</li>
        </ul>

        <div style={{ background: '#1e1a0e', border: '1px solid #5a4a14', borderRadius: 12, padding: '14px 18px', marginBottom: 32, fontSize: 14, lineHeight: 1.9 }}>
          <b style={{ color: AMBER }}>חשוב לדעת</b><br />
          ההרשמה לפי יום — אפשר לבחור יום אחד או את שניהם. גם ליום החינמי צריך להירשם.<br />
          כל יום יוצא לפועל רק עם <b>מינימום {MISGAV_MIN_PER_DAY} נרשמים</b>.<br />
          ביום האיירבג <b>ההתחייבות היא רק לאחר התשלום</b> — בסיום ההרשמה יופיע קישור לתשלום.<br />
          מדיניות ביטול: ניתן לבטל עד 3 ימים לפני יום הפעילות.<br />
          🌧️ {MISGAV_RAIN_NOTE}
        </div>

        {/* בחירת ימים */}
        <h2 style={h2}>באילו ימים? *</h2>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 32 }}>
          {MISGAV_DAYS.map(d => {
            const on = days.includes(d.key)
            const n = counts?.[d.key]
            return (
              <button key={d.key} type="button" onClick={() => toggleDay(d.key)} aria-pressed={on}
                style={{
                  textAlign: 'right', background: on ? '#1a2114' : PANEL, color: TEXT,
                  border: `2px solid ${on ? LIME : BORDER}`, borderRadius: 12, padding: '14px 16px',
                  fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800 }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: 5, border: `2px solid ${on ? LIME : MUTED}`,
                    background: on ? LIME : 'transparent', color: BG, fontSize: 14, lineHeight: '16px', textAlign: 'center', flexShrink: 0,
                  }}>{on ? '✓' : ''}</span>
                  {d.label}
                </div>
                <div style={{ color: MUTED, fontSize: 12, marginTop: 6 }}>
                  <span style={{ color: TEXT, fontWeight: 700 }}>{d.title}</span> · {misgavPriceText(d.price)}
                  {n !== undefined && (n >= MISGAV_MIN_PER_DAY
                    ? <span style={{ color: LIME }}> · היום יוצא לדרך ✓</span>
                    : <span> · {n} נרשמו מתוך מינימום {MISGAV_MIN_PER_DAY}</span>)}
                </div>
              </button>
            )
          })}
        </div>

        {/* פרטי הילד */}
        <h2 style={h2}>פרטי הילד/ה</h2>
        <div style={grid}>
          <div><label style={label}>שם פרטי *</label><input style={input} value={form.riderFirstName} onChange={e => set('riderFirstName', e.target.value)} /></div>
          <div><label style={label}>שם משפחה *</label><input style={input} value={form.riderLastName} onChange={e => set('riderLastName', e.target.value)} /></div>
          <div><label style={label}>גיל</label><input style={input} inputMode="numeric" value={form.age} onChange={e => set('age', e.target.value)} /></div>
          <div>
            <label style={label}>קבוצה</label>
            <select style={input} value={form.groupName} onChange={e => set('groupName', e.target.value)}>
              <option value="">בחרו קבוצה</option>
              {MISGAV_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>מגבלה בריאותית, אלרגיה או תרופות קבועות</label>
            <input style={input} value={form.healthNotes} onChange={e => set('healthNotes', e.target.value)} placeholder="אין / פרטו" />
          </div>
        </div>

        {/* פרטי ההורה */}
        <h2 style={h2}>פרטי ההורה</h2>
        <div style={grid}>
          <div><label style={label}>שם ההורה *</label><input style={input} value={form.parentName} onChange={e => set('parentName', e.target.value)} /></div>
          <div><label style={label}>טלפון ההורה *</label><input style={input} type="tel" value={form.parentPhone} onChange={e => set('parentPhone', e.target.value)} /></div>
          <div><label style={label}>יישוב *</label><input style={input} value={form.city} onChange={e => set('city', e.target.value)} /></div>
          <div><label style={label}>אימייל</label><input style={input} type="email" value={form.parentEmail} onChange={e => set('parentEmail', e.target.value)} placeholder="לקבלת אישור הרשמה" /></div>
        </div>

        {/* הצהרה */}
        <h2 style={{ ...h2, marginBottom: 12 }}>הצהרת הורה</h2>
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, marginBottom: 16, color: MUTED, fontSize: 13.5, lineHeight: 1.9 }}>
          <p style={{ marginTop: 0 }}>אני מאשר/ת את השתתפות בני/בתי בפעילות הרכיבה של טבע בייק בימים שבחרתי.</p>
          <p>ידוע לי שרכיבת שטח ופעילות אתגרית (כולל איירבג) כוללות סיכונים, לרבות נפילה ופציעה, ואני מאשר/ת את ההשתתפות מתוך בחירה מלאה ואחריות הורית.</p>
          <p>ידוע לי שההגעה והפיזור עצמאיים, ושאחריות הצוות היא בשעות הפעילות בלבד (08:30–13:00).</p>
          <p>אני אחראי/ת לצייד את ילדי באופניים תקינים, קסדה תקנית, כפפות, מים ובגדים להחלפה.</p>
          <p>אני מאשר/ת שילדי יישמע להוראות הצוות.</p>
          <p style={{ marginBottom: 0 }}>אני מתחייב/ת לעדכן את הצוות בכל מגבלה רפואית או רגישות רלוונטית.</p>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={label}>שם ההורה החותם *</label>
          <input style={input} value={form.consentParentName} onChange={e => set('consentParentName', e.target.value)} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 16, fontSize: 14 }}>
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ width: 20, height: 20, accentColor: LIME, cursor: 'pointer' }} />
          קראתי והבנתי את כל האמור לעיל ואני מאשר/ת
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 8, fontSize: 14 }}>
          <input type="checkbox" checked={whatsappOptin} onChange={e => setWhatsappOptin(e.target.checked)} style={{ width: 20, height: 20, marginTop: 1, accentColor: LIME, cursor: 'pointer', flexShrink: 0 }} />
          <span>{WHATSAPP_OPTIN_LABEL}</span>
        </label>

        {error && (
          <div style={{ background: '#3a1a1a', border: '1px solid #7f2d2d', color: '#fca5a5', borderRadius: 10, padding: '12px 16px', marginTop: 18, fontSize: 14 }}>
            {error}
          </div>
        )}

        <p style={{ color: MUTED, fontSize: 13, marginTop: 28 }}>שאלות? בני 052-5708084 · טל 050-5358071</p>
      </div>

      {/* סרגל תחתון דביק */}
      <div style={{
        position: 'fixed', bottom: 0, right: 0, left: 0, background: PANEL,
        borderTop: `1px solid ${BORDER}`, padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center', flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 130 }}>
          <div style={{ color: MUTED, fontSize: 12 }}>
            {days.length ? `${days.length} ${days.length === 1 ? 'יום' : 'ימים'}` : 'בחרו ימים'}
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: LIME }}>{total} ₪</div>
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
