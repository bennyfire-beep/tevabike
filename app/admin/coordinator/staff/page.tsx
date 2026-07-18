'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { DEFAULT_HOURLY_RATE } from '@/lib/attendance'

const ACCENT = '#b5e853'
const CARD   = '#141716'
const BORDER = '#252b27'
const MUTED  = '#7a8f7d'

const ROLE_LABEL: Record<string, string> = {
  instructor:  'מדריך',
  coordinator: 'רכז',
  accountant:  'רו"ח',
  admin:       'מנהל',
}
const ROLE_BADGE: Record<string, string> = {
  instructor:  '#1f3d2a',
  coordinator: '#1a2637',
  accountant:  '#2a2440',
  admin:       '#3a2a1a',
}
const BRANCHES = ['כל הסניפים', 'משגב', 'מצובה', 'ביריה', 'אמירים']
type RoleOpt = 'instructor' | 'coordinator' | 'accountant'

type Staff = {
  id: string
  name: string
  role: string
  branch: string | null
  hourly_rate: number | null
  birth_date: string | null
  id_number: string | null
  certificate_url: string | null
  active: boolean
}

export default function StaffPage() {
  const [staff, setStaff]     = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)

  // ── form state ──
  const [name, setName]             = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [role, setRole]             = useState<RoleOpt>('instructor')
  const [branch, setBranch]         = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [birthDate, setBirthDate]   = useState('')
  const [idNumber, setIdNumber]     = useState('')
  const [certFile, setCertFile]     = useState<File | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // ── quick "add instructor" (name only → admin_roles) ──
  const [quickName, setQuickName]   = useState('')
  const [quickAdding, setQuickAdding] = useState(false)
  const [quickMsg, setQuickMsg]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // per-row activate/deactivate in-flight guard
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const loadStaff = useCallback(async () => {
    // Show all staff (active + inactive) so deactivated instructors can be
    // reactivated; active are listed first.
    const { data } = await supabase
      .from('admin_roles')
      .select('id, name, role, branch, hourly_rate, birth_date, id_number, certificate_url, active')
      .in('role', ['instructor', 'coordinator', 'accountant'])
      .order('active', { ascending: false })
      .order('role')
      .order('name')
    setStaff((data || []) as Staff[])
    setLoading(false)
  }, [])

  useEffect(() => { loadStaff() }, [loadStaff])

  async function addInstructor() {
    setQuickMsg(null)
    const trimmed = quickName.trim()
    if (!trimmed) { setQuickMsg({ type: 'err', text: 'יש להזין שם מדריך' }); return }
    setQuickAdding(true)
    const { error } = await supabase
      .from('admin_roles')
      .insert({ name: trimmed, role: 'instructor', active: true })
    if (error) {
      setQuickMsg({ type: 'err', text: `ההוספה נכשלה: ${error.message}` })
      setQuickAdding(false)
      return
    }
    setQuickMsg({ type: 'ok', text: `המדריך ${trimmed} נוסף כפעיל 🎉` })
    setQuickName('')
    await loadStaff()
    setQuickAdding(false)
  }

  async function toggleActive(s: Staff) {
    setTogglingId(s.id)
    const next = !s.active
    const { error } = await supabase.from('admin_roles').update({ active: next }).eq('id', s.id)
    if (error) {
      setMsg({ type: 'err', text: `עדכון הסטטוס נכשל: ${error.message}` })
    } else {
      setStaff(prev => prev.map(x => x.id === s.id ? { ...x, active: next } : x))
    }
    setTogglingId(null)
  }

  function resetForm() {
    setName(''); setEmail(''); setPassword('')
    setRole('instructor'); setBranch(''); setHourlyRate(''); setBirthDate('')
    setIdNumber(''); setCertFile(null)
  }

  async function handleSubmit() {
    setMsg(null)
    if (!name.trim())        { setMsg({ type: 'err', text: 'יש להזין שם' }); return }
    if (!email.trim())       { setMsg({ type: 'err', text: 'יש להזין אימייל' }); return }
    if (password.length < 6) { setMsg({ type: 'err', text: 'הסיסמה חייבת להיות לפחות 6 תווים' }); return }

    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setMsg({ type: 'err', text: 'פג תוקף ההתחברות, התחבר מחדש' })
        setSubmitting(false); return
      }

      // upload instructor certificate (if provided) to Supabase Storage
      let certificateUrl: string | null = null
      if (role === 'instructor' && certFile) {
        const ext = certFile.name.split('.').pop() || 'pdf'
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: upErr } = await supabase.storage.from('certificates').upload(path, certFile)
        if (upErr) {
          setMsg({ type: 'err', text: `העלאת התעודה נכשלה: ${upErr.message}` })
          setSubmitting(false); return
        }
        certificateUrl = supabase.storage.from('certificates').getPublicUrl(path).data.publicUrl
      }

      const res = await fetch('/api/admin/add-staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          branch: role === 'instructor' ? (branch || null) : null,
          hourlyRate: role === 'instructor' ? (hourlyRate || null) : null,
          birthDate: birthDate || null,
          idNumber: idNumber.trim() || null,
          certificateUrl,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMsg({ type: 'err', text: json.error || 'ההוספה נכשלה' })
        setSubmitting(false); return
      }

      setMsg({ type: 'ok', text: `${ROLE_LABEL[role]} ${name.trim()} נוסף בהצלחה! 🎉` })
      resetForm()
      await loadStaff()
    } catch {
      setMsg({ type: 'err', text: 'שגיאת רשת, נסה שוב' })
    }
    setSubmitting(false)
  }

  const input: React.CSSProperties = {
    width: '100%', background: '#0d0f0e', border: `1px solid ${BORDER}`, borderRadius: 8,
    padding: '10px 12px', color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif',
    fontSize: 14, boxSizing: 'border-box',
  }
  const label: React.CSSProperties = {
    fontSize: 12, color: MUTED, fontWeight: 600, display: 'block', marginBottom: 5,
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 24px 60px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 4px' }}>ניהול צוות</h1>
      <p style={{ color: MUTED, fontSize: 13, margin: '0 0 24px' }}>
        הוסף מדריכים ורכזים — כל איש צוות מקבל התחברות משלו למערכת.
      </p>

      {/* ── Add form ── */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20, marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px', color: ACCENT }}>➕ הוספת איש צוות</h2>

        {/* role selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['instructor', 'coordinator', 'accountant'] as const).map(r => (
            <button key={r} onClick={() => setRole(r)} style={{
              flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'Heebo, Arial, sans-serif', fontSize: 14, fontWeight: 700,
              border: `1px solid ${role === r ? ACCENT : BORDER}`,
              background: role === r ? ACCENT : 'transparent',
              color: role === r ? '#0d0f0e' : MUTED,
              transition: 'all .15s',
            }}>{ROLE_LABEL[r]}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={label}>שם מלא *</label>
            <input style={input} value={name} onChange={e => setName(e.target.value)} placeholder="ישראל ישראלי" />
          </div>
          <div>
            <label style={label}>אימייל (לכניסה) *</label>
            <input style={input} type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <div>
            <label style={label}>סיסמה ראשונית * (6 תווים לפחות)</label>
            <input style={input} dir="ltr" value={password} onChange={e => setPassword(e.target.value)} placeholder="לפחות 6 תווים" />
          </div>
          <div>
            <label style={label}>תאריך לידה</label>
            <input style={input} type="date" dir="ltr" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
          </div>
          <div>
            <label style={label}>מספר תעודת זהות</label>
            <input style={input} dir="ltr" value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="9 ספרות" />
          </div>
          {role === 'instructor' && (
            <div>
              <label style={label}>סניף</label>
              <select style={input} value={branch} onChange={e => setBranch(e.target.value)}>
                <option value="">בחר סניף</option>
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}
          {role === 'instructor' && (
            <div>
              <label style={label}>תעריף לשעה (₪)</label>
              <input style={input} type="number" dir="ltr" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} placeholder="לדוגמה 80" />
            </div>
          )}
          {role === 'instructor' && (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={label}>תעודת מדריך (PDF / תמונה)</label>
              <input
                style={{ ...input, padding: '8px 12px' }}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => setCertFile(e.target.files?.[0] || null)}
              />
              {certFile && <div style={{ fontSize: 11, color: ACCENT, marginTop: 4 }}>📄 {certFile.name}</div>}
            </div>
          )}
        </div>

        {msg && (
          <div style={{
            padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 14,
            background: msg.type === 'ok' ? '#16331f' : '#3a1a1a',
            color:      msg.type === 'ok' ? '#7ee29a' : '#ff9b9b',
            border: `1px solid ${msg.type === 'ok' ? '#1f5132' : '#5a2626'}`,
          }}>{msg.text}</div>
        )}

        <button onClick={handleSubmit} disabled={submitting} style={{
          background: submitting ? '#5a6e3f' : ACCENT, color: '#0d0f0e', border: 'none', borderRadius: 8,
          padding: '11px 22px', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 14, fontWeight: 800,
          cursor: submitting ? 'default' : 'pointer',
        }}>{submitting ? 'מוסיף...' : 'הוסף איש צוות'}</button>
      </div>

      {/* ── Quick add instructor (name only) ── */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20, marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px', color: ACCENT }}>➕ הוספת מדריך מהירה</h2>
        <p style={{ color: MUTED, fontSize: 12, margin: '0 0 14px' }}>
          מוסיף מדריך פעיל לפי שם בלבד (ללא כניסה למערכת) — לשיבוץ ולדוחות שכר.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px' }}>
            <label htmlFor="quick-instructor-name" style={label}>שם המדריך *</label>
            <input
              id="quick-instructor-name"
              style={input}
              value={quickName}
              onChange={e => setQuickName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addInstructor() }}
              placeholder="ישראל ישראלי"
            />
          </div>
          <button
            onClick={addInstructor}
            disabled={quickAdding}
            style={{
              background: quickAdding ? '#5a6e3f' : ACCENT, color: '#0d0f0e', border: 'none', borderRadius: 8,
              padding: '11px 22px', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 14, fontWeight: 800,
              cursor: quickAdding ? 'default' : 'pointer', whiteSpace: 'nowrap',
            }}
          >{quickAdding ? 'מוסיף...' : 'הוסף מדריך'}</button>
        </div>
        {quickMsg && (
          <div role="status" style={{
            padding: '10px 12px', borderRadius: 8, fontSize: 13, marginTop: 14,
            background: quickMsg.type === 'ok' ? '#16331f' : '#3a1a1a',
            color:      quickMsg.type === 'ok' ? '#7ee29a' : '#ff9b9b',
            border: `1px solid ${quickMsg.type === 'ok' ? '#1f5132' : '#5a2626'}`,
          }}>{quickMsg.text}</div>
        )}
      </div>

      {/* ── Existing staff ── */}
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>הצוות הקיים</h2>
      {loading ? (
        <p style={{ color: MUTED }}>טוען...</p>
      ) : staff.length === 0 ? (
        <p style={{ color: MUTED, fontSize: 13 }}>עדיין אין אנשי צוות.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {staff.map(s => (
            <div key={s.id} style={{
              background: CARD, border: `1px solid ${s.active ? BORDER : '#3a2626'}`, borderRadius: 10, padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 12, opacity: s.active ? 1 : 0.6,
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#e8efe9' }}>{s.name}</span>
              <span style={{
                background: ROLE_BADGE[s.role] || '#222', color: '#cfe7d8',
                padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
              }}>{ROLE_LABEL[s.role] || s.role}</span>
              {!s.active && (
                <span style={{
                  background: '#3a1a1a', color: '#ff9b9b', border: '1px solid #5a2626',
                  padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                }}>מושבת</span>
              )}
              {s.branch && <span style={{ color: MUTED, fontSize: 12 }}>📍 {s.branch}</span>}
              {s.birth_date && <span style={{ color: MUTED, fontSize: 12 }}>🎂 {s.birth_date.split('-').reverse().join('/')}</span>}
              {s.id_number && <span style={{ color: MUTED, fontSize: 12 }}>🆔 {s.id_number}</span>}
              {s.certificate_url && (
                <a href={s.certificate_url} target="_blank" rel="noopener noreferrer"
                   style={{ color: ACCENT, fontSize: 12, textDecoration: 'none' }}>📄 תעודה</a>
              )}
              {s.role === 'instructor' && (
                <span style={{ color: MUTED, fontSize: 12 }}>
                  ₪{s.hourly_rate ?? DEFAULT_HOURLY_RATE}/שעה{s.hourly_rate == null ? ' (ברירת מחדל)' : ''}
                </span>
              )}
              {s.role === 'instructor' && (
                <button
                  onClick={() => toggleActive(s)}
                  disabled={togglingId === s.id}
                  aria-pressed={s.active}
                  aria-label={`${s.active ? 'השבת' : 'הפעל'} את ${s.name}`}
                  title={s.active ? 'השבתת מדריך' : 'הפעלת מדריך'}
                  style={{
                    marginRight: 'auto',
                    background: 'transparent',
                    border: `1px solid ${s.active ? '#5a2626' : ACCENT}`,
                    color: s.active ? '#ff9b9b' : ACCENT,
                    borderRadius: 8, padding: '6px 14px',
                    fontFamily: 'Heebo, Arial, sans-serif', fontSize: 12, fontWeight: 700,
                    cursor: togglingId === s.id ? 'default' : 'pointer',
                    opacity: togglingId === s.id ? 0.6 : 1, whiteSpace: 'nowrap',
                  }}
                >{togglingId === s.id ? '...' : s.active ? 'השבת' : 'הפעל'}</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
