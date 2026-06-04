'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('אימייל או סיסמה שגויים')
      setLoading(false)
      return
    }

    // קח תפקיד מ-admin_roles
    const { data: adminRole } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', data.user.id)
      .single()

    const role = adminRole?.role || 'trainee'
    const redirects: Record<string, string> = {
      admin: '/admin',
      coordinator: '/admin/coordinator',
      instructor: '/admin/instructor',
      accountant: '/admin/accountant',
      trainee: '/student',
    }

    router.push(redirects[role] || '/student')
    router.refresh()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8faf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', direction: 'rtl' }}>
      <div style={{ background: '#fff', border: '1px solid #e8f0e8', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, background: '#1a5c2e', borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <circle cx="5" cy="17" r="3"/>
              <circle cx="19" cy="17" r="3"/>
              <path d="M5 17L9 5l4 4 2-4 5 8"/>
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#1a1a1a' }}>טבע בייק</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>כניסה למערכת</div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: '#555', display: 'block', marginBottom: 5 }}>אימייל</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required
              style={{ width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 8, outline: 'none', direction: 'ltr', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, color: '#555', display: 'block', marginBottom: 5 }}>סיסמה</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
              style={{ width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 8, outline: 'none', direction: 'ltr', boxSizing: 'border-box' }} />
          </div>

          {error && (
            <div style={{ background: '#fef0f0', border: '1px solid #fcc', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c00', marginBottom: 16, textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '11px', background: loading ? '#6aad85' : '#1a5c2e', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>
        </form>

        <div style={{ marginTop: 24, padding: 14, background: '#f8faf8', borderRadius: 10, border: '1px solid #e8f0e8' }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 8, textAlign: 'center' }}>גישה לפי תפקיד</div>
          {[
            { role: 'מנהל', color: '#185fa5', bg: '#e6f1fb', desc: 'שליטה מלאה' },
            { role: 'רכז', color: '#1a5c2e', bg: '#e5f5ea', desc: 'ניהול חוגים' },
            { role: 'מדריך', color: '#7a4f0a', bg: '#fef3d8', desc: 'נוכחות ושכר' },
            { role: 'חניך', color: '#555', bg: '#f0f0f0', desc: 'פורטל אישי' },
          ].map(item => (
            <div key={item.role} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: item.bg, color: item.color, fontWeight: 500, minWidth: 40, textAlign: 'center' }}>{item.role}</span>
              <span style={{ fontSize: 11, color: '#888' }}>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


