'use client'
import { useState } from 'react'

// ============================================================
// נתיב: app/morzine-2027/page.tsx
// חופשת רכיבה לנוער במורזין 2027 (25.06–09.07.2027) — עמוד מידע + הרשמה
// (חלק המבוגרים יתווסף בהמשך לאותו עמוד)
// ============================================================

const BG = '#1a1f1c'
const PANEL = '#232a26'
const BORDER = '#38443d'
const TEXT = '#e8efe9'
const MUTED = '#7a8f7d'
const PINK = '#ec4899'

const PRICE = 10900
const DEPOSIT = 1800

export default function MorzineYouthPage() {
  const [form, setForm] = useState({
    rider_name_he: '', rider_name_en: '', birth_date: '', id_number: '',
    rider_phone: '', parent_phone: '', email: '', address: '',
  })
  const [passportFile, setPassportFile] = useState<File | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [healthDeclared, setHealthDeclared] = useState(false)
  const [insuranceCommitted, setInsuranceCommitted] = useState(false)
  const [showTerms, setShowTerms] = useState(false)

  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function submit() {
    setError('')
    const required = Object.values(form).every(v => v.trim() !== '')
    if (!required) { setError('נא למלא את כל השדות'); return }
    if (!passportFile) { setError('יש להעלות צילום דרכון בתוקף'); return }
    if (!termsAccepted || !healthDeclared || !insuranceCommitted) {
      setError('יש לאשר את שלוש ההצהרות כדי להירשם'); return
    }

    setSending(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      fd.append('terms_accepted', String(termsAccepted))
      fd.append('health_declared', String(healthDeclared))
      fd.append('insurance_committed', String(insuranceCommitted))
      fd.append('passport', passportFile)

      const res = await fetch('/api/morzine-youth-register', { method: 'POST', body: fd })
      const data = await res.json()
      if (!data.ok) { setError(data.error || 'משהו השתבש'); setSending(false); return }
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
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
  const card: React.CSSProperties = {
    background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, marginBottom: 16,
  }

  // ---------- מסך אישור ----------
  if (done) {
    return (
      <div dir="rtl" style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: 'Heebo, Arial, sans-serif', padding: '48px 20px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🚵🏔️</div>
          <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800 }}>ההרשמה נקלטה</h1>
          <p style={{ color: MUTED, margin: '0 0 24px', lineHeight: 1.7 }}>
            שלחנו למייל שנרשם את פרטי ההזמנה ואת פרטי החשבון להעברת המקדמה.<br />
            המקום נשמר לאחר קבלת המקדמה.
          </p>
          <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, marginBottom: 22 }}>
            <div style={{ color: MUTED, fontSize: 13 }}>מקדמה לשמירת מקום</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: PINK }}>{DEPOSIT.toLocaleString()} ₪</div>
            <div style={{ color: MUTED, fontSize: 13, marginTop: 10 }}>
              בנק הפועלים (12) · סניף 746 · חשבון 44447 · ע&quot;ש טבע בייק
            </div>
          </div>
          <p style={{ color: MUTED, fontSize: 13 }}>שאלות? בני 052-5708084 · טל 050-5358071</p>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: 'Heebo, Arial, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 140px' }}>

        {/* באנר — יוחלף לתמונה אמיתית (public/morzine-youth-banner.png) */}
        <img
          src="/morzine-youth-banner.png"
          alt="חופשת רכיבה לנוער במורזין 2027 — טבע בייק"
          style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 14, marginBottom: 26 }}
        />

        <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 10px' }}>
          חופשת רכיבה לנוער במורזין 2027 🚵🏔️
        </h1>

        <p style={{ color: TEXT, fontSize: 15, lineHeight: 1.8, margin: '0 0 8px' }}>
          יוצאים לחוויה של פעם בחיים במורזין 2027! רוכב/ת יקר/ה, אנו שמחים שהחלטת לצאת
          לחופשת אופניים בלתי נשכחת בירת האופניים של אירופה.
        </p>
        <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.9, margin: '0 0 24px' }}>
          (התקציר מנוסח בלשון זכר מטעמי נוחות בלבד, אך פונה לכל המינים באופן שווה)
        </p>

        <video
          src="/morzine-youth-video.mp4"
          autoPlay
          muted
          loop
          playsInline
          style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 14, marginBottom: 26 }}
        />

        {/* פרטי החופשה */}
        <h2 style={h2}>📅 פרטי החופשה</h2>
        <div style={card}>
          <p style={{ margin: '0 0 8px' }}><b>יעד:</b> מורזין (Morzine), צרפת</p>
          <p style={{ margin: '0 0 8px' }}><b>תאריכים:</b> 25.06–09.07.2027</p>
          <p style={{ margin: 0 }}>
            <b>תכנית רכיבה:</b> החופשה כוללת 13 ימי רכיבה מלאים.{' '}
            <span style={{ color: MUTED, fontSize: 13 }}>
              (שימו לב: ייתכנו שינויים בלו&quot;ז בהתאם לתנאי מזג האוויר בשטח)
            </span>
          </p>
        </div>

        {/* מה כלול */}
        <h2 style={h2}>🏠 מה החבילה כוללת?</h2>
        <div style={card}>
          <p style={{ margin: '0 0 8px' }}><b>הובלה והדרכה:</b> ליווי צמוד של צוות המועדון במסלולים.</p>
          <p style={{ margin: '0 0 8px' }}><b>לינה:</b> מתחם מגורים מפנק ומותאם לרוכבים.</p>
          <p style={{ margin: '0 0 8px' }}><b>לוגיסטיקה:</b> הסעות הלוך ושוב משדה התעופה למגורים במורזין.</p>
          <p style={{ margin: '0 0 8px' }}><b>כרטיסים:</b> &quot;בייק-פס&quot; (Bike Pass) חופשי לרכבלים לאורך כל ימי הרכיבה.</p>
          <p style={{ margin: 0 }}><b>כלכלה מלאה:</b> ארוחות מסודרות לאורך כל השהות.</p>
        </div>

        {/* טיסות ביטוח וציוד */}
        <h2 style={h2}>✈️ טיסות, ביטוח וציוד (דגשים חשובים)</h2>
        <div style={card}>
          <p style={{ margin: '0 0 8px' }}>
            <b>טיסות:</b> טיסת הלוך לנמל התעופה במילאנו, וטיסת חזור מנמל התעופה בז&apos;נבה
            (טיסת open-jaw). עלות הכרטיס משוערת סביב <b>$980</b> ואינה כלולה במחיר החבילה.
          </p>
          <p style={{ margin: '0 0 8px' }}>
            <b>ביטוח נסיעות:</b> מחיר החופשה אינו כולל ביטוח נסיעות. <b>יש להסדיר את הביטוח עד 90 יום לפני מועד היציאה.</b>
          </p>
          <p style={{ margin: 0 }}>
            <b>חשוב לציין:</b> המחיר אינו כולל השכרת אופניים או ציוד רכיבה אישי.
          </p>
        </div>

        {/* עלויות ותנאי תשלום */}
        <h2 style={h2}>💳 עלויות ותנאי תשלום</h2>
        <div style={card}>
          <p style={{ margin: '0 0 8px' }}><b>מחיר החופשה:</b> {PRICE.toLocaleString()} ש&quot;ח</p>
          <p style={{ margin: '0 0 8px' }}>
            <b>דמי רישום והבטחת מקום:</b> {DEPOSIT.toLocaleString()} ש&quot;ח — מקדמה זו אינה ניתנת להחזר.
          </p>
          <p style={{ margin: '0 0 14px' }}><b>יתרת התשלום:</b> יש להסדיר עד 60 יום לפני מועד הטיסה.</p>
          <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 16px' }}>
            <b style={{ color: TEXT }}>פרטי חשבון להעברת המקדמה:</b><br />
            <span style={{ color: MUTED }}>בנק הפועלים (12) · סניף 746 · מספר חשבון 44447 · ע&quot;ש טבע בייק</span>
          </div>
        </div>

        {/* תקנון */}
        <button
          type="button"
          onClick={() => setShowTerms(v => !v)}
          style={{
            display: 'block', width: '100%', textAlign: 'right', background: PANEL,
            border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 18px',
            color: TEXT, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 32,
          }}
        >
          {showTerms ? '▲' : '▼'} תנאים כלליים והסדרי ביטול — למי שרוצה לקרוא לפני ההרשמה
        </button>
        {showTerms && (
          <div style={{ ...card, color: MUTED, fontSize: 13, lineHeight: 1.9, maxHeight: 340, overflowY: 'auto' }}>
            <p><b style={{ color: TEXT }}>דמי ביטול ושינוי</b><br />
              דמי ביטול יכנסו לתוקף עם קבלת הודעת ביטול בכתב מאת הלקוח למייל bennyfire@gmail.com.
              באחריות הלקוח לוודא שהודעת הביטול אכן הגיעה ליעדה ולקבל על כך אישור בכתב.</p>
            <ul style={{ margin: '0 0 12px', paddingRight: 18 }}>
              <li>מ-64 ועד 49 ימים לפני מועד היציאה — 50% מעלות החבילה לנוסע</li>
              <li>מ-48 ועד 29 ימים לפני מועד היציאה — 65% מעלות החבילה לנוסע</li>
              <li>מ-28 ועד 15 ימים לפני מועד היציאה — 75% מעלות החבילה לנוסע</li>
              <li>מ-14 ועד 8 ימים לפני מועד היציאה — 85% מעלות החבילה לנוסע</li>
              <li>מ-7 ימים לפני מועד היציאה ועד ליום היציאה — 100% מעלות החבילה לנוסע</li>
            </ul>
            <p>בנוסף לדמי הביטול הנקובים, ישלמו המבטלים את עלות השינויים בהזמנה שנוצרו בשל ביטולה
              (לדוגמה, הפער במחיר לאדם בין דירה המושכרת לארבעה או חמישה אנשים).</p>
            <p>שינוי שם ניתן לביצוע עד 7 ימים לפני מועד היציאה בעלות שתיגבה על ידי ספקי השירותים והמוצרים
              השונים, ככל שתיגבה, זאת בתנאי שהנוסע/ת המחליף/ה &quot;נכנס/ת לנעליו&quot; של הנוסע המבטל/ת
              על כל מרכיבי החופשה, בתוספת 100 ש&quot;ח דמי טיפול.</p>
            <p><b style={{ color: TEXT }}>בשל הנסיבות הביטחוניות בישראל</b> ואפשרות ביטול מיידית של מרכיבי
              חבילת הנופש על-ידי הספקים עמם טבע בייק מתקשרת, יחולו דמי הביטול הבאים:</p>
            <ul style={{ margin: '0 0 12px', paddingRight: 18 }}>
              <li>ממועד ההזמנה ועד 38 יום לפני מועד היציאה — 70% מעלות החבילה לנוסע</li>
              <li>מ-37 ועד 8 ימים לפני מועד היציאה — 85% מעלות החבילה לנוסע</li>
              <li>מ-7 ימים לפני מועד היציאה ועד ליום היציאה — 100% מעלות החבילה לנוסע</li>
            </ul>
            <p>ביטול של כל מרכיב בחבילה, כמו העברות, בייק-פס או כל חלק אחר, יחויב בדמי ביטול בנפרד:
              עד 60 יום לפני מועד החופשה — 25% ממחיר המרכיב שבוטל, 30–60 יום — 50%, פחות מ-30 יום —
              100%. מכל זיכוי מוסכם ללקוח יופחתו 50 ש&quot;ח דמי טיפול.</p>

            <p><b style={{ color: TEXT }}>השכרת אופניים ו/או ציוד רכיבה אחר</b><br />
              השכרת אופניים וציוד רכיבה אחר אינם חלק מהחבילה. ככל שיש בכך צורך, על הרוכב לשכור את
              האופניים/הציוד בעצמו, על חשבונו ועל אחריותו. תנאי ההשכרה הם כפי שיסוכמו בין הרוכב לחנות
              המשכירה, ולטבע בייק/בני להט אין כל אחריות או השפעה על כך.</p>

            <p><b style={{ color: TEXT }}>כללי</b></p>
            <ul style={{ margin: '0 0 12px', paddingRight: 18 }}>
              <li>איחור בהגעה או עזיבה מוקדמת של החופשה, לרבות במקרה פציעה, אינם מזכים בהחזר כספי כלשהו.</li>
              <li>אובדן ימי רכיבה בשל איחור בטיסות, פגעי מזג אוויר וכדומה לא יזכו בהחזר כספי כלשהו.</li>
              <li>במקרה שלא ניתן לארח את הלקוח מכל סיבה שהיא במקום האירוח שאושר, יוצע מקום אירוח חלופי ברמה זהה.</li>
              <li>באחריות הלקוח לוודא שהדרכון בתוקף לשישה חודשים לפחות ממועד היציאה, וכן שיש ברשותו כל אשרה/מסמך נדרש.</li>
              <li>קבלה/פינוי מקום הלינה: קבלת החדר החל מהשעה 15:00, הפינוי לא יאוחר מהשעה 10:00.</li>
              <li>ההעברות אינן פרטיות, וייתכנו עצירות במקומות הלינה של לקוחות אחרים בהעברה.</li>
              <li>הרוכב מתחייב לרכוב בהתאם לכללי הרכיבה הנהוגים באתר ולהישמע להנחיות המדריכים.</li>
              <li>הרוכב מתחייב לנהוג בהתאם לחוק במהלך הטיסות, הנסיעות והשהות בחו&quot;ל. על קטינים חל איסור צריכת אלכוהול.</li>
              <li>יש לנהוג בכבוד ובנימוס לרוכבים האחרים ולזולת, לכבד את הטבע והסביבה, ולא לפגוע באחר או ברכוש.</li>
              <li>חריגה מהכללים או התנהגות לא הולמת תביא להרחקת הרוכב מהפעילויות ולחזרתו לישראל על חשבונו, ללא זכות להחזר.</li>
            </ul>

            <p><b style={{ color: TEXT }}>אחריות</b><br />
              טבע בייק ו/או בני להט ו/או מי מטעמם אינם נושאים בכל אחריות לפגיעה בגוף, בנפש או ברכוש
              המשתתפים בחופשה. הרוכב או הוריו (במקרה של קטין) מצהירים כי הם מודעים לכך שרכיבה על
              אופניים כרוכה במאמץ פיזי גדול ובסיכון, עד כדי סיכון חיים, ונוטלים על עצמם את הסיכונים
              מרצון ובאופן בלעדי. במקרה חירום יחולו כל ההוצאות על הרוכבים. חובה להצטייד בביטוח
              המתאים לספורט אתגרי הכולל חילוץ אווירי, הטסה רפואית, אשפוז, ניתוחים וטיפול שוטף — רכישת
              הביטוח היא באחריות הרוכב או הוריו. מומלץ להצטייד גם בביטוח מטען.</p>

            <p><b style={{ color: TEXT }}>תנאי והסדרי תשלום</b><br />
              {DEPOSIT.toLocaleString()} ש&quot;ח עד 3 ימי עסקים מיום שליחת טופס ההרשמה. יתרת התשלום
              תועבר עד 60 יום לפני יום הטיסה. סיכום הזמנה וקבלה יישלחו בדואר אלקטרוני עם אישור ההזמנה.</p>
          </div>
        )}

        {/* טופס הרשמה */}
        <h2 style={h2}>הרשמה</h2>
        <div style={grid}>
          <div><label style={label}>שם מלא (שם פרטי ושם משפחה) *</label>
            <input style={input} value={form.rider_name_he} onChange={e => set('rider_name_he', e.target.value)} /></div>
          <div><label style={label}>שם מלא באנגלית (בדיוק כפי שמופיע בדרכון) *</label>
            <input style={{ ...input, direction: 'ltr' }} value={form.rider_name_en} onChange={e => set('rider_name_en', e.target.value)} /></div>
          <div><label style={label}>תאריך לידה *</label>
            <input style={input} type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} /></div>
          <div><label style={label}>מספר תעודת זהות *</label>
            <input style={input} value={form.id_number} onChange={e => set('id_number', e.target.value)} /></div>
          <div><label style={label}>נייד הרוכב/ת *</label>
            <input style={input} type="tel" value={form.rider_phone} onChange={e => set('rider_phone', e.target.value)} /></div>
          <div><label style={label}>נייד ההורה הרשום *</label>
            <input style={input} type="tel" value={form.parent_phone} onChange={e => set('parent_phone', e.target.value)} /></div>
          <div><label style={label}>מייל (אצל קטין — של ההורה הרשום) *</label>
            <input style={{ ...input, direction: 'ltr' }} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
          <div><label style={label}>כתובת מגורים *</label>
            <input style={input} value={form.address} onChange={e => set('address', e.target.value)} /></div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>צילום דרכון בתוקף *</label>
            <input
              type="file" accept="image/*,application/pdf"
              onChange={e => setPassportFile(e.target.files?.[0] ?? null)}
              style={{ ...input, padding: '9px 13px' }}
            />
          </div>
        </div>

        {/* הצהרות */}
        <h2 style={{ ...h2, marginBottom: 12 }}>הצהרות — חובה לאישור</h2>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 14, fontSize: 14, lineHeight: 1.7 }}>
          <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)}
            style={{ width: 20, height: 20, marginTop: 1, accentColor: PINK, cursor: 'pointer', flexShrink: 0 }} />
          <span>אני מסכים/ה לתנאים הכלליים המפורטים לעיל</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 14, fontSize: 14, lineHeight: 1.7 }}>
          <input type="checkbox" checked={healthDeclared} onChange={e => setHealthDeclared(e.target.checked)}
            style={{ width: 20, height: 20, marginTop: 1, accentColor: PINK, cursor: 'pointer', flexShrink: 0 }} />
          <span>אני מצהיר/ה כי אין לי / לילדי הקטין שום מגבלה רפואית שעלולה למנוע ממני/ממנו לבצע את הפעילויות הכרוכות בחופשה</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 28, fontSize: 14, lineHeight: 1.7 }}>
          <input type="checkbox" checked={insuranceCommitted} onChange={e => setInsuranceCommitted(e.target.checked)}
            style={{ width: 20, height: 20, marginTop: 1, accentColor: PINK, cursor: 'pointer', flexShrink: 0 }} />
          <span>
            אני מתחייב/ת כי לפני יציאתי/יציאת ילדי הקטין מהבית לחופשה, ארכוש עבורו ביטוח נסיעות ארוך
            טווח מלא ומקיף, הכולל הרחבה לספורט אתגרי, לרבות איתור וחילוץ אוויר, הטסה רפואית, אשפוז,
            ניתוחים ותיפולים ותרופות שוטפים.
          </span>
        </label>

        {error && (
          <div style={{ background: '#3a1a1a', border: '1px solid #7f2d2d', color: '#fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 18, fontSize: 14 }}>
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
        <div style={{ minWidth: 150 }}>
          <div style={{ color: MUTED, fontSize: 12 }}>חופשת רכיבה במורזין 2027</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: PINK }}>{PRICE.toLocaleString()} ₪</div>
        </div>
        <button
          onClick={submit}
          disabled={sending}
          style={{
            background: sending ? BORDER : PINK, color: sending ? MUTED : '#1a0410', border: 'none',
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
