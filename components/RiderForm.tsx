'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// v4 — טופס חניך: יצירה ועריכה. משמש גם רכזות (עמוד תלמידים) וגם מדריכים
// (מסך נוכחות, כולל הוספה תוך כדי אימון פתוח).
//
// יצירה מתחילה בבחירת קטגוריה — מבוגר / ילד — שקובעת אילו שדות מוצגים:
//   ילד:    שם/כינוי הרוכב עצמו (★, לתצוגה בנוכחות) · שם פרטי+משפחה של ההורה (★)
//           · טלפון הורה (★) · אימייל (לא חובה)
//   מבוגר:  שם פרטי+משפחה (★) · טלפון (★) · אימייל (לא חובה)
// ברירת המחדל לקטגוריה נגזרת מה-`type` של הקבוצה שנבחרה מראש (groups.type
// 'adults'/'kids'), כשזו זמינה; אחרת נופלת ל"ילד".
//
// חניך חדש נשמר תמיד עם payment_status = 'unpaid' (מסומן בצבע כתום ברשימת
// התלמידים ובנוכחות) ובמקביל נפתחת עבורו שורה ב"מתעניינים" ונשלח מייל לטל —
// דרך /api/staff-lead. פתיחת הליד היא best-effort: אם היא נכשלת החניך עדיין
// נשמר, וההודעה מוצגת במסך ההצלחה.
//
// אחרי שמירה מוצלחת של חניך חדש (לא עריכה) הטופס לא נסגר מעצמו: הוא עובר
// למסך "נוסף בהצלחה" עם כפתור וואטסאפ (פותח wa.me עם הודעת ברירת מחדל, ידני —
// ה-API הרשמי עדיין לא מאושר) וכפתור "הוסף עוד", כדי לתמוך בהוספת כמה חניכים
// ברצף מבלי לצאת מהמסך. `onSaved` עדיין נקרא מיד עם השמירה (כדי שהעמוד הקורא
// ירענן את הרשימה — למשל יוסיף את החניך לנוכחות הפתוחה ויסמן אותו נוכח), אבל
// הקורא לא סוגר את הדיאלוג בעצמו יותר עבור יצירה — הסגירה קורית רק כש-onClose
// נקרא (כפתור X, ביטול, או "סגור" ממסך ההצלחה). בעריכה שום דבר לא השתנה:
// onSaved נקרא ומיד נסגר, בדיוק כמו קודם.
//
// חשוב: אין להשתמש כאן ב-`rider!.id`. React Compiler (reactCompiler: true)
// הפיל את הקומפוננטה עם "Cannot read properties of null (reading 'id')" כשהיא
// נפתחה עם rider={null} — כלומר בכל לחיצה על "➕ חניך חדש". מזהה החניך נקרא
// פעם אחת ל-riderId ומשם והלאה עובדים רק איתו.

export type RiderRecord = {
  id: string
  full_name: string
  parent_name?: string | null
  phone?: string | null
  parent_phone?: string | null
  email?: string | null
  age?: number | null
  bike_type?: string | null
  notes?: string | null
  group_id?: string | null
  group_name?: string | null
  branch?: string | null
  is_regular?: boolean | null
  payment_status?: string | null
}

type GroupOpt = { id: string; name: string; branch: string | null; type?: 'adults' | 'kids' | null }
type Kind = 'adult' | 'child'

const BG = '#0d0f0e', PANEL = '#141716', BORDER = '#252b27'
const TEXT = '#e8efe9', MUTED = '#7a8f7d', LIME = '#b5e853'
const AMBER = '#ff8f6b'

const BIKE_TYPES = ['הארדטייל', 'פול סאספנשן', 'אנדורו', 'דירט / פאמפטרק', 'אופניים חשמליים', 'אחר']

const splitName = (full?: string | null) => {
  const parts = (full ?? '').trim().split(/\s+/)
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') }
}

/** Israeli local number → international, digits only. Same rule everywhere in the app. */
const toIntl = (phone: string) => phone.replace(/\D/g, '').replace(/^0/, '972')

/** The one-time welcome message, sent manually (the WhatsApp API isn't approved yet). */
function waWelcomeLink(phone: string, riderDisplayName: string): string {
  const msg = `היי! שמחנו לארח אותך/את ${riderDisplayName} היום בטבע בייק 🚵 כדי להמשיך ולהירשם לחוג, ההרשמה כאן: tevabike.com`
  return `https://wa.me/${toIntl(phone)}?text=${encodeURIComponent(msg)}`
}

/** Which category a new rider should start on, from the pre-selected group's kind. */
function defaultKindFor(groups: GroupOpt[], groupId: string | null | undefined): Kind {
  const g = groups.find(x => x.id === groupId)
  return g?.type === 'adults' ? 'adult' : 'child'
}

const blankCreateFields = (keepGroupId: string) => ({
  riderFirst: '', riderLast: '', parentFirst: '', parentLast: '',
  parentPhone: '', riderPhone: '', riderNickname: '',
  email: '', age: '', bikeType: '',
  groupId: keepGroupId,
  notes: '',
})

export default function RiderForm({
  rider, groups, defaultGroupId, onClose, onSaved, allowDelete = true,
}: {
  rider?: RiderRecord | null
  groups: GroupOpt[]
  defaultGroupId?: string | null
  onClose: () => void
  onSaved: (savedName: string) => void
  allowDelete?: boolean
}) {
  const riderId = rider?.id ?? null
  const isEdit = riderId !== null

  const rn = splitName(rider?.full_name)
  const pn = splitName(rider?.parent_name)

  const [kind, setKind] = useState<Kind>(() => defaultKindFor(groups, rider?.group_id ?? defaultGroupId))
  const [f, setF] = useState({
    riderFirst: rn.first, riderLast: rn.last,
    parentFirst: pn.first, parentLast: pn.last,
    parentPhone: rider?.parent_phone ?? '',
    riderPhone: rider?.phone ?? '',
    riderNickname: '',   // רק ב"ילד" ביצירה — שם/כינוי לתצוגה בנוכחות
    email: rider?.email ?? '',
    age: rider?.age ? String(rider.age) : '',
    bikeType: rider?.bike_type ?? '',
    groupId: rider?.group_id ?? defaultGroupId ?? '',
    notes: rider?.notes ?? '',
  })
  // '' = לא ידוע (חניכים ותיקים שנכנסו לפני שהשדה נוסף) — נשמר כ-null.
  const [payStatus, setPayStatus] = useState(rider?.payment_status ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [warn, setWarn] = useState('')          // אזהרת "הליד לא נפתח" — מוצגת במסך ההצלחה
  const [confirmDel, setConfirmDel] = useState(false)
  // מוגדר רק אחרי יצירה מוצלחת (לא עריכה) — מחליף את הטופס במסך "נוסף בהצלחה".
  const [savedRider, setSavedRider] = useState<{ name: string; phone: string } | null>(null)

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))

  const riderName  = `${f.riderFirst.trim()} ${f.riderLast.trim()}`.trim()
  const parentName = `${f.parentFirst.trim()} ${f.parentLast.trim()}`.trim()

  /** מה חסר, לפי isEdit/kind. null = תקין. */
  function validate(): string | null {
    if (isEdit) {
      if (!f.riderFirst.trim() || !f.riderLast.trim()) return 'שם פרטי ומשפחה של החניך הם שדות חובה'
      if (!f.parentFirst.trim() || !f.parentLast.trim()) return 'שם פרטי ומשפחה של ההורה הם שדות חובה'
      if (!f.parentPhone.trim()) return 'טלפון הורה הוא שדה חובה'
      return null
    }
    if (kind === 'child') {
      if (!f.riderNickname.trim()) return 'שם/כינוי הרוכב הוא שדה חובה'
      if (!f.parentFirst.trim() || !f.parentLast.trim()) return 'שם פרטי ומשפחה של ההורה הם שדות חובה'
      if (!f.parentPhone.trim()) return 'טלפון הורה הוא שדה חובה'
      return null
    }
    // adult
    if (!f.riderFirst.trim() || !f.riderLast.trim()) return 'שם פרטי ומשפחה הם שדות חובה'
    if (!f.riderPhone.trim()) return 'טלפון הוא שדה חובה'
    return null
  }

  // פותח ליד ב"מתעניינים" ושולח מייל לטל. best-effort — לא מפיל את השמירה.
  // מקבל את השדות במפורש (לא קורא מ-f. ישירות) כדי שמעבר בין מבוגר↔ילד לא
  // ידליף שדה שהוסתר בטופס (למשל טלפון הורה שהוקלד לפני מעבר ל"מבוגר").
  async function openLead(args: {
    riderName: string; parentName: string; parentPhone: string; riderPhone: string
    branch: string | null; groupName: string | null
  }): Promise<string> {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return 'הליד לא נפתח (אין הרשאה) — צריך לפתוח אותו ידנית'

    const res = await fetch('/api/staff-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        rider_name: args.riderName,
        parent_name: args.parentName,
        parent_phone: args.parentPhone,
        rider_phone: args.riderPhone,
        branch: args.branch,
        group_name: args.groupName,
        notes: f.notes.trim() || null,
      }),
    })
    if (res.ok) return ''
    const body = await res.json().catch(() => ({}))
    return `החניך נשמר, אבל פתיחת הליד נכשלה: ${body.error ?? res.status}`
  }

  async function save() {
    setErr('')
    const problem = validate()
    if (problem) { setErr(problem); return }

    setSaving(true)
    const g = groups.find(x => x.id === f.groupId) ?? null

    let payload: Record<string, unknown>
    let displayName: string
    let waPhone = ''

    if (isEdit) {
      displayName = riderName
      payload = {
        full_name: riderName,
        parent_name: parentName,
        parent_phone: f.parentPhone.trim(),
        phone: f.riderPhone.trim() || null,
        email: f.email.trim() || null,
        age: f.age ? parseInt(f.age) : null,
        bike_type: f.bikeType.trim() || null,
        notes: f.notes.trim() || null,
        group_id: f.groupId || null,
        group_name: g?.name ?? null,
        branch: g?.branch ?? null,
        payment_status: payStatus || null,
      }
    } else if (kind === 'child') {
      displayName = f.riderNickname.trim()
      waPhone = f.parentPhone.trim()
      payload = {
        full_name: displayName,
        parent_name: parentName,
        parent_phone: f.parentPhone.trim(),
        phone: null,
        email: f.email.trim() || null,
        notes: f.notes.trim() || null,
        group_id: f.groupId || null,
        group_name: g?.name ?? null,
        branch: g?.branch ?? null,
        is_regular: !!f.groupId,
        active: true,
        payment_status: 'unpaid',
      }
    } else {
      // adult, create
      displayName = riderName
      waPhone = f.riderPhone.trim()
      payload = {
        full_name: displayName,
        parent_name: null,
        parent_phone: null,
        phone: f.riderPhone.trim(),
        email: f.email.trim() || null,
        notes: f.notes.trim() || null,
        group_id: f.groupId || null,
        group_name: g?.name ?? null,
        branch: g?.branch ?? null,
        is_regular: !!f.groupId,
        active: true,
        payment_status: 'unpaid',
      }
    }

    const { error } = isEdit && riderId
      ? await supabase.from('riders').update(payload).eq('id', riderId)
      : await supabase.from('riders').insert(payload)

    if (error) { setSaving(false); setErr(error.message); return }

    if (isEdit) {
      setSaving(false)
      onSaved(displayName)
      return
    }

    // יצירה: פתיחת ליד (best-effort), ואז מסך "נוסף בהצלחה" — לא סגירה אוטומטית.
    let problemMsg = ''
    try {
      problemMsg = await openLead({
        riderName: displayName,
        parentName: kind === 'child' ? parentName : '',
        parentPhone: kind === 'child' ? f.parentPhone.trim() : '',
        riderPhone: kind === 'adult' ? f.riderPhone.trim() : '',
        branch: g?.branch ?? null,
        groupName: g?.name ?? null,
      })
    } catch {
      problemMsg = 'החניך נשמר, אבל פתיחת הליד נכשלה (בעיית רשת)'
    }

    setSaving(false)
    setWarn(problemMsg)
    setSavedRider({ name: displayName, phone: waPhone })
    // נקרא מיד — לא ממתין לסגירת הדיאלוג — כדי שהעמוד הקורא ירענן את הרשימה
    // (למשל יוסיף את החניך לנוכחות הפתוחה ויסמן אותו נוכח) בלי לצאת מהמסך.
    onSaved(displayName)
  }

  function addAnother() {
    setSavedRider(null)
    setWarn('')
    setErr('')
    setF(p => blankCreateFields(p.groupId))
  }

  async function remove() {
    if (!riderId) return
    setSaving(true)
    const { error } = await supabase.from('riders').update({ active: false, is_regular: false }).eq('id', riderId)
    setSaving(false)
    if (error) { setErr(error.message); return }
    onSaved(riderName)
  }

  const waParent = () => {
    const msg = `היי ${f.parentFirst || ''}, זה בני מטבע בייק 🚵\nכדי להשלים את ההרשמה של ${f.riderFirst || 'הילד'} אפשר למלא כאן:\nhttps://www.tevabike.com/#register`
    return `https://wa.me/${toIntl(f.parentPhone)}?text=${encodeURIComponent(msg)}`
  }

  const input: React.CSSProperties = {
    width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT,
    fontFamily: 'Heebo, Arial, sans-serif', fontSize: 15, padding: '10px 12px', outline: 'none', boxSizing: 'border-box',
  }
  const label: React.CSSProperties = { display: 'block', color: MUTED, fontSize: 12, marginBottom: 5, fontWeight: 600 }
  const row: React.CSSProperties = { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 14 }

  const title = isEdit ? 'עריכת חניך' : savedRider ? 'נוסף בהצלחה' : 'חניך חדש'

  return (
    <div
      role="dialog" aria-modal="true" aria-label={title}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,.72)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: 20, overflowY: 'auto', direction: 'rtl',
      }}
    >
      <div style={{
        background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24,
        width: '100%', maxWidth: 620, marginTop: 24, marginBottom: 40,
        fontFamily: 'Heebo, Arial, sans-serif', color: TEXT,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>{title}</h3>
          <button onClick={onClose} aria-label="סגירה"
            style={{ marginRight: 'auto', background: 'transparent', border: 'none', color: MUTED, fontSize: 26, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* ── מסך הצלחה (יצירה בלבד) — מחליף את הטופס אחרי שמירה ────────────── */}
        {savedRider ? (
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <div style={{ fontSize: 46, marginBottom: 10 }} aria-hidden="true">✅</div>
            <h4 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>{savedRider.name} נוסף/ה בהצלחה</h4>
            <p style={{ color: MUTED, fontSize: 13, margin: '0 0 18px', lineHeight: 1.7 }}>
              מסומן/ת כ״לא שולם״ ונוסף/ה לנוכחות. נפתח עבורו/ה ליד ב״מתעניינים״ ונשלח מייל לטל.
            </p>

            {warn && (
              <div style={{ background: '#231a12', border: `1px solid ${AMBER}`, color: AMBER,
                            borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, textAlign: 'start' }}>{warn}</div>
            )}

            {waPhoneOf(savedRider.phone) ? (
              <a href={waWelcomeLink(savedRider.phone, savedRider.name)} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', background: '#1a2114', color: LIME, border: '1px solid #2f4020',
                         borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 800, textDecoration: 'none', marginBottom: 14 }}>
                💬 שלח וואטסאפ
              </a>
            ) : (
              <p style={{ color: MUTED, fontSize: 12.5, margin: '0 0 14px' }}>אין מספר טלפון לשליחת הודעה</p>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={addAnother}
                style={{ flex: 1, minWidth: 150, background: BG, color: LIME, border: `1px solid ${BORDER}`, borderRadius: 10,
                         padding: '12px', fontSize: 14, fontWeight: 800, fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer' }}>
                ➕ הוסף חניך נוסף
              </button>
              <button onClick={onClose}
                style={{ flex: 1, minWidth: 150, background: LIME, color: BG, border: 'none', borderRadius: 10,
                         padding: '12px', fontSize: 14, fontWeight: 800, fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer' }}>
                סגור
              </button>
            </div>
          </div>
        ) : (
        <>
        <p style={{ color: MUTED, fontSize: 12.5, margin: '0 0 16px' }}>שדות עם ★ הם חובה</p>

        {!isEdit && (
          <div style={{ background: '#231a12', border: `1px solid ${AMBER}55`, color: AMBER,
                        borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            החניך ייכנס כ״לא שולם״, ייפתח עבורו ליד ב״מתעניינים״ ויישלח מייל לטל להמשך התהליך.
          </div>
        )}

        {/* ── יצירה: בחירת קטגוריה ואז שדות ממוקדים לפיה ──────────────────── */}
        {!isEdit && (
          <>
            <div role="group" aria-label="קטגוריית חניך" style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
              {([['adult', '🧑 מבוגר/ת'], ['child', '🧒 ילד/ה']] as const).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  aria-pressed={kind === k}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 10, fontWeight: 800, fontSize: 14,
                    fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer',
                    border: `2px solid ${kind === k ? LIME : BORDER}`,
                    background: kind === k ? '#1a2114' : BG,
                    color: kind === k ? LIME : MUTED,
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {kind === 'child' ? (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={label}>שם/כינוי הרוכב/ת ★</label>
                  <input style={input} value={f.riderNickname} onChange={e => set('riderNickname', e.target.value)}
                         placeholder="לתצוגה ברשימת הנוכחות" />
                </div>
                <div style={row}>
                  <div><label style={label}>שם פרטי — הורה ★</label><input style={input} value={f.parentFirst} onChange={e => set('parentFirst', e.target.value)} /></div>
                  <div><label style={label}>שם משפחה — הורה ★</label><input style={input} value={f.parentLast} onChange={e => set('parentLast', e.target.value)} /></div>
                </div>
                <div style={row}>
                  <div><label style={label}>טלפון הורה ★</label><input style={input} type="tel" inputMode="tel" value={f.parentPhone} onChange={e => set('parentPhone', e.target.value)} /></div>
                  <div><label style={label}>אימייל</label><input style={input} type="email" placeholder="לא חובה" value={f.email} onChange={e => set('email', e.target.value)} /></div>
                </div>
              </>
            ) : (
              <>
                <div style={row}>
                  <div><label style={label}>שם פרטי ★</label><input style={input} value={f.riderFirst} onChange={e => set('riderFirst', e.target.value)} /></div>
                  <div><label style={label}>שם משפחה ★</label><input style={input} value={f.riderLast} onChange={e => set('riderLast', e.target.value)} /></div>
                </div>
                <div style={row}>
                  <div><label style={label}>טלפון ★</label><input style={input} type="tel" inputMode="tel" value={f.riderPhone} onChange={e => set('riderPhone', e.target.value)} /></div>
                  <div><label style={label}>אימייל</label><input style={input} type="email" placeholder="לא חובה" value={f.email} onChange={e => set('email', e.target.value)} /></div>
                </div>
              </>
            )}

            <div style={row}>
              <div>
                <label style={label}>קבוצה</label>
                <select aria-label="קבוצה" style={input} value={f.groupId} onChange={e => set('groupId', e.target.value)}>
                  <option value="">ללא שיוך</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}{g.branch ? ` · ${g.branch}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>הערות</label>
                <input style={input} placeholder="לא חובה" value={f.notes} onChange={e => set('notes', e.target.value)} />
              </div>
            </div>
          </>
        )}

        {/* ── עריכה: הטופס המלא, ללא שינוי ────────────────────────────────── */}
        {isEdit && (
          <>
            <div style={row}>
              <div><label style={label}>שם פרטי — חניך ★</label><input style={input} value={f.riderFirst} onChange={e => set('riderFirst', e.target.value)} /></div>
              <div><label style={label}>שם משפחה — חניך ★</label><input style={input} value={f.riderLast} onChange={e => set('riderLast', e.target.value)} /></div>
            </div>

            <div style={row}>
              <div><label style={label}>שם פרטי — הורה ★</label><input style={input} value={f.parentFirst} onChange={e => set('parentFirst', e.target.value)} /></div>
              <div><label style={label}>שם משפחה — הורה ★</label><input style={input} value={f.parentLast} onChange={e => set('parentLast', e.target.value)} /></div>
            </div>

            <div style={row}>
              <div><label style={label}>טלפון הורה ★</label><input style={input} type="tel" inputMode="tel" value={f.parentPhone} onChange={e => set('parentPhone', e.target.value)} /></div>
              <div>
                <label style={label}>טלפון החניך</label>
                <input style={input} type="tel" inputMode="tel" placeholder="לא חובה" value={f.riderPhone} onChange={e => set('riderPhone', e.target.value)} />
              </div>
            </div>

            <div style={row}>
              <div><label style={label}>אימייל</label><input style={input} type="email" placeholder="לא חובה" value={f.email} onChange={e => set('email', e.target.value)} /></div>
              <div><label style={label}>גיל</label><input style={input} type="number" inputMode="numeric" placeholder="לא חובה" value={f.age} onChange={e => set('age', e.target.value)} /></div>
            </div>

            <div style={row}>
              <div>
                <label style={label}>סוג אופניים</label>
                <input style={input} list="bike-types" placeholder="לא חובה" value={f.bikeType} onChange={e => set('bikeType', e.target.value)} />
                <datalist id="bike-types">{BIKE_TYPES.map(b => <option key={b} value={b} />)}</datalist>
              </div>
              <div>
                <label style={label}>קבוצה</label>
                <select aria-label="קבוצה" style={input} value={f.groupId} onChange={e => set('groupId', e.target.value)}>
                  <option value="">ללא שיוך</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}{g.branch ? ` · ${g.branch}` : ''}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={label}>הערות</label>
              <input style={input} placeholder="מגבלה רפואית, רמה, כל דבר שחשוב לדעת" value={f.notes} onChange={e => set('notes', e.target.value)} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={label}>סטטוס תשלום</label>
              <select
                aria-label="סטטוס תשלום"
                value={payStatus}
                onChange={e => setPayStatus(e.target.value)}
                style={{
                  ...input,
                  borderColor: payStatus === 'unpaid' ? AMBER + '77' : payStatus === 'paid' ? LIME + '77' : BORDER,
                  color: payStatus === 'unpaid' ? AMBER : payStatus === 'paid' ? LIME : TEXT,
                  fontWeight: payStatus ? 700 : 400,
                }}
              >
                <option value="">לא ידוע</option>
                <option value="unpaid">לא שולם</option>
                <option value="paid">שולם</option>
              </select>
            </div>
          </>
        )}

        {f.parentPhone.trim() && (
          <a href={waParent()} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', textAlign: 'center', background: '#1a2114', color: LIME, border: '1px solid #2f4020',
                     borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, textDecoration: 'none', marginBottom: 16 }}>
            שליחת קישור הרשמה להורה בוואטסאפ
          </a>
        )}

        {err && (
          <div style={{ background: '#3a1a1a', border: '1px solid #7f2d2d', color: '#fca5a5',
                        borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13.5 }}>{err}</div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={save} disabled={saving}
            style={{ flex: 1, minWidth: 150, background: saving ? BORDER : LIME, color: saving ? MUTED : BG,
                     border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 800,
                     fontFamily: 'Heebo, Arial, sans-serif', cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'שומר...' : isEdit ? 'שמירת שינויים' : 'הוספת חניך'}
          </button>
          <button onClick={onClose} disabled={saving}
            style={{ background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 10,
                     padding: '13px 20px', fontSize: 15, fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer' }}>
            ביטול
          </button>
        </div>

        {isEdit && allowDelete && (
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
            {confirmDel ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: '#fca5a5', fontSize: 13.5 }}>להוציא את {riderName} מהמערכת?</span>
                <button onClick={remove} disabled={saving}
                  style={{ background: '#7f2d2d', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px',
                           fontSize: 13, fontWeight: 700, fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer' }}>כן, הוצא</button>
                <button onClick={() => setConfirmDel(false)}
                  style={{ background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8,
                           padding: '8px 16px', fontSize: 13, fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer' }}>ביטול</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(true)}
                style={{ background: 'transparent', color: '#f87171', border: 'none', fontSize: 13,
                         fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer', padding: 0 }}>
                הוצאת החניך מהמערכת
              </button>
            )}
            <p style={{ color: MUTED, fontSize: 11.5, margin: '8px 0 0' }}>
              ההוצאה אינה מוחקת נתונים — היסטוריית הנוכחות נשמרת.
            </p>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  )
}

/** Guard against an empty/whitespace phone reaching wa.me with nothing to send to. */
function waPhoneOf(phone: string): string {
  return phone.trim()
}
