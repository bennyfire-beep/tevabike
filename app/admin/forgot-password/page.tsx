'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const S = {
  page: {
    direction: 'rtl' as const,
    fontFamily: 'Heebo, Arial, sans-serif',
    background: '#0d0f0e',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#e8efe9',
  },
  card: {
    background: '#141716',
    border: '1px solid #252b27',
    borderRadius: 16,
    padding: 40,
    width: '100%',
    maxWidth: 400,
  },
  input: {
    width: '100%',
    background: '#0d0f0e',
    border: '1px solid #252b27',
    borderRadius: 8,
    color: '#e8efe9',
    fontFamily: 'Heebo, Arial, sans-serif',
    fontSize: 14,
    padding: '10px 12px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color .2s',
  },
  label: { fontSize: 12, color: '#7a8f7d', display: 'block', marginBottom: 4 },
}

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')

    const redirectTo = `${window.location.origin}/admin/reset-password`

    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    })

    if (err) {
      setError('שגיאה בשליחת המייל: ' + err.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src="/logo.png"
            alt="טבע בייק"
            style={{ height: 48, borderRadius: 8, display: 'block', margin: '0 auto 14px' }}
          />
          <h1 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 4px', color: '#e8efe9' }}>
            איפוס סיסמה
          </h1>
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>
            נשלח אליך קישור לאיפוס למייל
          </p>
        </div>

        {sent ? (
          /* Success state */
          <div>
            <div style={{ background: '#4cdb7a22', border: '1px solid #4cdb7a44', borderRadius: 10, padding: '16px 18px', color: '#4cdb7a', textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📬</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>המייל נשלח!</div>
              <div style={{ fontSize: 13, color: '#7a8f7d' }}>
                בדוק את תיבת הדואר של<br />
                <strong style={{ color: '#e8efe9' }}>{email}</strong>
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#7a8f7d', textAlign: 'center', lineHeight: 1.6, margin: '0 0 18px' }}>
              לא קיבלת? בדוק בתיקיית הספאם,
              <br />
              או{' '}
              <button
                onClick={() => setSent(false)}
                style={{ background: 'none', border: 'none', color: '#b5e853', cursor: 'pointer', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 12, padding: 0, textDecoration: 'underline' }}
              >
                שלח שוב
              </button>
            </p>
            <a
              href="/admin/login"
              style={{ display: 'block', textAlign: 'center', color: '#7a8f7d', fontSize: 13, textDecoration: 'none' }}
            >
              ← חזרה להתחברות
            </a>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={S.label}>כתובת מייל</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@tevbike.com"
                required
                autoFocus
                style={S.input}
                onFocus={e  => ((e.target as HTMLInputElement).style.borderColor = '#b5e853')}
                onBlur={e   => ((e.target as HTMLInputElement).style.borderColor = '#252b27')}
              />
            </div>

            {error && (
              <div style={{ background: '#ff4f4f22', border: '1px solid #ff4f4f44', borderRadius: 8, padding: '10px 14px', color: '#ff8080', fontSize: 13 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? '#3a4f3a' : '#b5e853',
                color: loading ? '#7a8f7d' : '#0d0f0e',
                border: 'none', borderRadius: 8,
                padding: '13px 0',
                fontFamily: 'Heebo, Arial, sans-serif',
                fontWeight: 700, fontSize: 16,
                cursor: loading ? 'default' : 'pointer',
                transition: 'background .15s',
              }}
            >
              {loading ? 'שולח...' : 'שלח קישור לאיפוס'}
            </button>

            <a
              href="/admin/login"
              style={{ textAlign: 'center', color: '#7a8f7d', fontSize: 13, textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#b5e853')}
              onMouseLeave={e => (e.currentTarget.style.color = '#7a8f7d')}
            >
              ← חזרה להתחברות
            </a>
          </form>
        )}
      </div>
    </div>
  )
}
