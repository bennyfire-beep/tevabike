'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { setAdminSession, checkRateLimit, resetRateLimit } from '@/lib/auth-actions'
import { rolesOf, homeFor, ROLE_LABEL } from '@/lib/roles'

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
  },
  label: { fontSize: 12, color: '#7a8f7d', display: 'block', marginBottom: 4 },
}

// Just the footer list of who the system is for. Which roles are actually
// valid, and which one a person lands on, is lib/roles.ts's job — 'admin' is
// omitted here because it isn't a job anyone signs up as.
const ROLE_LABELS: Record<string, string> = {
  instructor:  ROLE_LABEL.instructor,
  coordinator: ROLE_LABEL.coordinator,
  accountant:  ROLE_LABEL.accountant,
}

// useSearchParams must live inside a <Suspense> boundary to allow static export
function ResetSuccessBanner() {
  const searchParams = useSearchParams()
  if (searchParams.get('reset') !== 'success') return null
  return (
    <div style={{ background: '#4cdb7a22', border: '1px solid #4cdb7a44', borderRadius: 8, padding: '10px 14px', color: '#4cdb7a', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
      ✓ הסיסמה עודכנה בהצלחה — אפשר להתחבר עכשיו
    </div>
  )
}

export default function AdminLoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const router = useRouter()

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      // Every role row, not `.single()` — someone who is both coordinator and
      // instructor has two, and `.single()` errors on two rather than choosing.
      supabase.from('admin_roles').select('role').eq('user_id', user.id)
        .then(({ data }) => {
          const roles = rolesOf(data)
          if (roles.length > 0) router.replace(homeFor(roles))
        })
    })
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // ── Rate limit check (server-side) ──────────────────────────────────────
    const rl = await checkRateLimit(email.toLowerCase(), 'login')
    if (!rl.allowed) {
      setError(rl.message)
      setLoading(false)
      return
    }
    if (rl.allowed && rl.remainingAttempts <= 1) {
      setError(`אזהרה: ${rl.remainingAttempts} ניסיון נותר לפני חסימה`)
    }

    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
    if (authErr || !data.user) {
      setError((error || '') + '\nשם משתמש או סיסמה שגויים')
      setLoading(false)
      return
    }

    // ── Look up this user's admin roles ──────────────────────────────────────
    // All of them: admin_roles is one row per job and a few people hold more
    // than one. No .single() here — it errors on two matches, which is exactly
    // how a coordinator+instructor used to be locked out of their own login.
    const { data: rd, error: roleErr } = await supabase
      .from('admin_roles')
      .select('role, name')
      .eq('user_id', data.user.id)

    if (roleErr) {
      await supabase.auth.signOut()
      setError('שגיאה בבדיקת ההרשאות. נסה שוב בעוד רגע')
      setLoading(false)
      return
    }

    const roles = rolesOf(rd)
    if (roles.length === 0) {
      await supabase.auth.signOut()
      setError('לחשבון זה אין הרשאות גישה למערכת הניהול. פנה למנהל המערכת')
      setLoading(false)
      return
    }

    // ── Set httpOnly auth cookies (read by proxy.ts) ─────────────────────────
    // The cookie carries every role, so holding two does not fence the user out
    // of one of their own areas at the edge.
    const session = data.session
    if (!session) {
      await supabase.auth.signOut()
      setError('ההתחברות לא הושלמה. נסה שוב')
      setLoading(false)
      return
    }
    await setAdminSession(session.access_token, roles)
    // Reset rate limit counter on success
    await resetRateLimit(email.toLowerCase(), 'login')

    // Land on the strongest role's dashboard (bypasses the hub).
    // refresh() after push re-runs proxy.ts and the server render with the
    // cookies that were just set — without it the client router can replay a
    // cached pre-login payload and the page appears stuck.
    router.push(homeFor(roles))
    router.refresh()
  }


  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src="/logo.png"
            alt="טבע בייק"
            style={{ height: 54, borderRadius: 8, display: 'block', margin: '0 auto 12px' }}
          />
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>
            כניסה למערכת הניהול
          </p>
        </div>

        {/* Password-reset success banner (Suspense required for useSearchParams) */}
        <Suspense fallback={null}>
          <ResetSuccessBanner />
        </Suspense>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={S.label}>אימייל</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@tevbike.com"
              required
              style={S.input}
            />
          </div>
          <div>
            <label style={S.label}>סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={S.input}
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
              border: 'none',
              borderRadius: 8,
              padding: '13px 0',
              fontFamily: 'Heebo, Arial, sans-serif',
              fontWeight: 700,
              fontSize: 16,
              cursor: loading ? 'default' : 'pointer',
              marginTop: 4,
              transition: 'background .15s',
            }}
          >
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>

          {/* Forgot password */}
          <a
            href="/admin/forgot-password"
            style={{ textAlign: 'center', color: '#7a8f7d', fontSize: 13, textDecoration: 'none', marginTop: 2 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#b5e853')}
            onMouseLeave={e => (e.currentTarget.style.color = '#7a8f7d')}
          >
            שכחתי סיסמה
          </a>
        </form>

        {/* Role hints */}
        <div style={{ marginTop: 28, borderTop: '1px solid #252b27', paddingTop: 20 }}>
          <p style={{ color: '#7a8f7d', fontSize: 11, textAlign: 'center', margin: '0 0 12px' }}>
            תפקידים במערכת
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(ROLE_LABELS).map(([, label]) => (
              <span
                key={label}
                style={{ background: '#1a1e1c', border: '1px solid #252b27', borderRadius: 20, padding: '3px 12px', fontSize: 12, color: '#7a8f7d' }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}



