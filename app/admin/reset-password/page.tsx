'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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

type PageState = 'verifying' | 'ready' | 'invalid' | 'done'

export default function ResetPasswordPage() {
  const [state, setState]       = useState<PageState>('verifying')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [saving, setSaving]     = useState(false)
  const router = useRouter()

  useEffect(() => {
    // ── Handle PKCE flow: ?code=xxx in URL search params ───────────────────
    // (Supabase sends this when PKCE is enabled, which is the default for new projects)
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('code')

    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(({ error: err }) => {
          setState(err ? 'invalid' : 'ready')
        })
      return
    }

    // ── Handle implicit flow: #access_token=xxx&type=recovery in hash ──────
    // (Supabase sends this on older/legacy auth settings)
    // Supabase JS automatically processes the hash fragment on initialize();
    // listen for the PASSWORD_RECOVERY event it fires.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setState('ready')
      if (event === 'SIGNED_OUT')        setState('invalid')
    })

    // If the hash is already gone (page was refreshed) and no code, the link is stale
    const hash = window.location.hash
    if (!hash.includes('access_token') && !hash.includes('token_hash')) {
      // Give Supabase 1.5 s to process stored session before declaring invalid
      const timeout = setTimeout(() => setState('invalid'), 1500)
      return () => { clearTimeout(timeout); subscription.unsubscribe() }
    }

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('הסיסמה חייבת להיות לפחות 8 תווים')
      return
    }
    if (password !== confirm) {
      setError('הסיסמאות אינן תואמות')
      return
    }

    setSaving(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setError('שגיאה בעדכון הסיסמה: ' + err.message)
      setSaving(false)
      return
    }

    // Sign out so the user starts fresh at the login page
    await supabase.auth.signOut()
    setState('done')

    // Small delay so the user sees the success state before redirect
    setTimeout(() => router.replace('/admin/login?reset=success'), 1400)
  }

  /* ── Shared header ── */
  const Header = () => (
    <div style={{ textAlign: 'center', marginBottom: 28 }}>
      <img
        src="/logo.png"
        alt="טבע בייק"
        style={{ height: 48, borderRadius: 8, display: 'block', margin: '0 auto 14px' }}
      />
    </div>
  )

  return (
    <div style={S.page}>
      <div style={S.card}>
        <Header />

        {/* ── Verifying state ── */}
        {state === 'verifying' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #b5e853', borderTopColor: 'transparent', animation: 'spin .8s linear infinite', margin: '0 auto 14px' }} />
            <p style={{ color: '#7a8f7d', fontSize: 14, margin: 0 }}>מאמת את הקישור...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* ── Invalid / expired link ── */}
        {state === 'invalid' && (
          <div>
            <div style={{ background: '#ff4f4f22', border: '1px solid #ff4f4f44', borderRadius: 10, padding: '16px 18px', textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
              <div style={{ fontWeight: 700, color: '#ff8080', marginBottom: 4 }}>הקישור אינו תקף</div>
              <div style={{ fontSize: 13, color: '#7a8f7d', lineHeight: 1.6 }}>
                הקישור פג תוקף או כבר נוצל.
                <br />
                בקש קישור חדש.
              </div>
            </div>
            <a
              href="/admin/forgot-password"
              style={{
                display: 'block', textAlign: 'center',
                background: '#b5e853', color: '#0d0f0e',
                padding: '12px 0', borderRadius: 8,
                fontFamily: 'Heebo, Arial, sans-serif',
                fontWeight: 700, fontSize: 15, textDecoration: 'none',
                marginBottom: 12,
              }}
            >
              שלח קישור חדש
            </a>
            <a
              href="/admin/login"
              style={{ display: 'block', textAlign: 'center', color: '#7a8f7d', fontSize: 13, textDecoration: 'none' }}
            >
              ← חזרה להתחברות
            </a>
          </div>
        )}

        {/* ── Set new password form ── */}
        {state === 'ready' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <h2 style={{ fontSize: 19, fontWeight: 900, margin: '0 0 4px' }}>הגדר סיסמה חדשה</h2>
              <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>לפחות 8 תווים</p>
            </div>

            <div>
              <label style={S.label}>סיסמה חדשה</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoFocus
                style={S.input}
                onFocus={e  => ((e.target as HTMLInputElement).style.borderColor = '#b5e853')}
                onBlur={e   => ((e.target as HTMLInputElement).style.borderColor = '#252b27')}
              />
              {/* Strength bar */}
              {password.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', gap: 3 }}>
                  {[1, 2, 3, 4].map(i => {
                    const strength = Math.min(4, Math.floor(password.length / 3))
                    const active = i <= strength
                    const color  = strength <= 1 ? '#ff6b6b' : strength <= 2 ? '#f97316' : strength <= 3 ? '#b5e853' : '#4cdb7a'
                    return (
                      <div
                        key={i}
                        style={{ flex: 1, height: 3, borderRadius: 99, background: active ? color : '#252b27', transition: 'background .2s' }}
                      />
                    )
                  })}
                  <span style={{ fontSize: 10, color: '#7a8f7d', marginRight: 4 }}>
                    {password.length < 8 ? `${password.length}/8` : '✓'}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label style={S.label}>אימות סיסמה</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  ...S.input,
                  borderColor: confirm.length > 0
                    ? confirm === password ? '#4cdb7a44' : '#ff4f4f44'
                    : '#252b27',
                }}
                onFocus={e => {
                  const el = e.target as HTMLInputElement
                  if (!confirm.length) el.style.borderColor = '#b5e853'
                }}
                onBlur={e => {
                  const el = e.target as HTMLInputElement
                  if (!confirm.length) el.style.borderColor = '#252b27'
                }}
              />
              {confirm.length > 0 && confirm !== password && (
                <p style={{ fontSize: 11, color: '#ff8080', margin: '4px 0 0' }}>הסיסמאות אינן תואמות</p>
              )}
            </div>

            {error && (
              <div style={{ background: '#ff4f4f22', border: '1px solid #ff4f4f44', borderRadius: 8, padding: '10px 14px', color: '#ff8080', fontSize: 13 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || password.length < 8 || password !== confirm}
              style={{
                background: (saving || password.length < 8 || password !== confirm) ? '#3a4f3a' : '#b5e853',
                color:      (saving || password.length < 8 || password !== confirm) ? '#7a8f7d' : '#0d0f0e',
                border: 'none', borderRadius: 8, padding: '13px 0',
                fontFamily: 'Heebo, Arial, sans-serif',
                fontWeight: 700, fontSize: 16,
                cursor: (saving || password.length < 8 || password !== confirm) ? 'default' : 'pointer',
                transition: 'background .15s',
              }}
            >
              {saving ? 'שומר...' : 'עדכן סיסמה'}
            </button>
          </form>
        )}

        {/* ── Success state ── */}
        {state === 'done' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 6px' }}>הסיסמה עודכנה!</h2>
            <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>מעביר אותך לדף ההתחברות...</p>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #4cdb7a', borderTopColor: 'transparent', animation: 'spin .8s linear infinite', margin: '16px auto 0' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}
      </div>
    </div>
  )
}
