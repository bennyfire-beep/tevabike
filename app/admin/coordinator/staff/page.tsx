'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

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
const BRANCHES = ['משגב', 'מצובה', 'ביריה', 'אמירים']
type RoleOpt = 'instructor' | 'coordinator' | 'accountant'

type Staff = {
  id: string
  name: string
  role: string
  branch: string | null
  hourly_rate: number | null
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

  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const loadStaff = useCallback(async () => {
    const { data } = await supabase
      .from('admin_roles')
      .select('id, name, role, branch, hourly_rate')
      .in('role', ['instructor', 'coordinator', 'accountant'])
      .order('role')
      .order('name')
    setStaff(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadStaff() }, [loadStaff])

  function resetForm() {
    setName(''); setEmail(''); setPassword('')
    setRole('instructor'); setBranch(''); setHourlyRate('')
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
              background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#e8efe9' }}>{s.name}</span>
              <span style={{
                background: ROLE_BADGE[s.role] || '#222', color: '#cfe7d8',
                padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
              }}>{ROLE_LABEL[s.role] || s.role}</span>
              {s.branch && <span style={{ color: MUTED, fontSize: 12 }}>📍 {s.branch}</span>}
              {s.role === 'instructor' && s.hourly_rate != null && (
                <span style={{ color: MUTED, fontSize: 12, marginRight: 'auto' }}>₪{s.hourly_rate}/שעה</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
