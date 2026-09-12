'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// /interval/join — public, no login. A rider fills their name, grants push
// permission (so a locked phone still buzzes at every work/rest change),
// installs the PWA to their home screen, and lands on /interval/receiver for
// the live workout screen. Styled like the other public pages (app/register,
// app/student) — same brand palette, plain inline styles, no component lib.

const PINK  = '#D4288A'
const DARK  = '#0C1814'
const GREEN = '#152A1E'
const BG    = '#F5F2EE'

/** web-push wants the VAPID key as a Uint8Array, not the base64url string the server hands back. */
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

type NotifStatus = 'unsupported' | 'default' | 'denied' | 'granted' | 'subscribing'
type PushSubJson = { endpoint?: string; keys?: { p256dh?: string; auth?: string } }

export default function IntervalJoinPage() {
  const router = useRouter()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [phone, setPhone]         = useState('')

  // Lazy initializer (not an effect) so this reads the real browser support
  // on first render — matches the same pattern in the coordinator WhatsApp
  // page's own notification toggle.
  const [notifStatus, setNotifStatus] = useState<NotifStatus>(() => {
    if (typeof window === 'undefined') return 'default'
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') return 'unsupported'
    return Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'default'
  })
  const [notifError, setNotifError]   = useState('')
  const [pushSub, setPushSub]         = useState<PushSubJson | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [joined, setJoined] = useState(false)

  const [installPrompt, setInstallPrompt] = useState<{ prompt: () => void } | null>(null)

  useEffect(() => {
    if (notifStatus === 'unsupported') return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [notifStatus])

  useEffect(() => {
    // Chrome/Android fires this instead of doing nothing when there's no
    // native install UI — capture it so the "add to home screen" card can
    // offer a real one-tap install instead of just instructions.
    function onPrompt(e: Event) {
      e.preventDefault()
      setInstallPrompt(e as unknown as { prompt: () => void })
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  async function enableNotifications() {
    setNotifError('')
    setNotifStatus('subscribing')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setNotifStatus(permission === 'denied' ? 'denied' : 'default')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const keyRes = await fetch('/api/push/public-key')
      const keyData = await keyRes.json().catch(() => ({}))
      if (!keyRes.ok) throw new Error(keyData.error || 'התראות לא מוגדרות בשרת עדיין')

      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyData.publicKey) as BufferSource,
        })
      }
      setPushSub(sub.toJSON())
      setNotifStatus('granted')
    } catch (e) {
      setNotifError((e as Error).message)
      setNotifStatus(Notification.permission === 'granted' ? 'granted' : 'default')
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')
    if (!firstName.trim() || !lastName.trim()) {
      setSubmitError('נא למלא שם פרטי ושם משפחה')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/interval/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim() || undefined,
          push_subscription: pushSub,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'ההרשמה נכשלה, נסו שוב')
      setJoined(true)
    } catch (e) {
      setSubmitError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const field: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '13px 14px', fontSize: 16,
    borderRadius: 10, border: '1.5px solid #d8d2c8', background: '#fff', color: DARK,
    fontFamily: 'Heebo, Arial, sans-serif',
  }
  const label: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 700, color: DARK, marginBottom: 6 }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: BG, fontFamily: 'Heebo, Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' }}>
      <img src="/logo.png" alt="טבע בייק" style={{ height: 56, borderRadius: 8, marginBottom: 18 }} />

      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 18, boxShadow: '0 8px 30px rgba(0,0,0,0.08)', padding: '28px 24px' }}>
        {!joined ? (
          <>
            <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 900, color: DARK }}>טיימר אינטרוול 🚴</h1>
            <p style={{ margin: '0 0 24px', color: '#6b6b6b', fontSize: 14.5 }}>
              הצטרפו לקבלת אותות עבודה/מנוחה ישירות לטלפון — גם כשהמסך נעול.
            </p>

            <form onSubmit={submit}>
              <div style={{ marginBottom: 14 }}>
                <label style={label} htmlFor="iv-first">שם פרטי</label>
                <input id="iv-first" value={firstName} onChange={e => setFirstName(e.target.value)} required autoComplete="given-name" style={field} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={label} htmlFor="iv-last">שם משפחה</label>
                <input id="iv-last" value={lastName} onChange={e => setLastName(e.target.value)} required autoComplete="family-name" style={field} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={label} htmlFor="iv-phone">טלפון <span style={{ color: '#9a9a9a', fontWeight: 500 }}>(לא חובה)</span></label>
                <input id="iv-phone" type="tel" dir="ltr" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" style={{ ...field, textAlign: 'right' }} />
              </div>

              {/* אפשר התראות */}
              <div style={{ marginBottom: 20, padding: 14, borderRadius: 12, background: notifStatus === 'granted' ? '#eefaf0' : '#f7f4ef', border: `1.5px solid ${notifStatus === 'granted' ? '#8fd8a3' : '#e4ddd0'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14.5, color: DARK }}>🔔 התראות פוש</div>
                    <div style={{ fontSize: 12.5, color: '#777', marginTop: 2 }}>
                      {notifStatus === 'granted' && 'הופעלו — תקבלו אות בכל שלב באימון'}
                      {notifStatus === 'default' && 'חובה כדי לקבל אות כשהמסך נעול'}
                      {notifStatus === 'denied' && 'נחסמו בדפדפן — אפשר להפעיל מהגדרות האתר'}
                      {notifStatus === 'subscribing' && 'מפעיל...'}
                      {notifStatus === 'unsupported' && 'לא נתמך בדפדפן הזה'}
                    </div>
                  </div>
                  {notifStatus !== 'granted' && notifStatus !== 'unsupported' && (
                    <button
                      type="button"
                      onClick={enableNotifications}
                      disabled={notifStatus === 'subscribing' || notifStatus === 'denied'}
                      style={{ flexShrink: 0, padding: '10px 16px', borderRadius: 10, border: 'none', background: PINK, color: '#fff', fontWeight: 800, fontSize: 14, cursor: notifStatus === 'denied' ? 'default' : 'pointer', fontFamily: 'Heebo, Arial, sans-serif' }}
                    >
                      אפשרו התראות
                    </button>
                  )}
                  {notifStatus === 'granted' && <span style={{ fontSize: 22 }}>✅</span>}
                </div>
                {notifError && <p style={{ margin: '10px 0 0', color: '#b91c1c', fontSize: 12.5 }}>{notifError}</p>}
              </div>

              {submitError && (
                <p role="alert" style={{ margin: '0 0 14px', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontWeight: 600 }}>{submitError}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{ width: '100%', minHeight: 52, background: submitting ? '#e3a9c8' : PINK, color: '#fff', border: 'none', borderRadius: 12, fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 900, fontSize: 17, cursor: submitting ? 'default' : 'pointer' }}
              >
                {submitting ? 'שולח...' : 'הצטרפות לאימון'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
              <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 900, color: DARK }}>נרשמתם בהצלחה!</h1>
              <p style={{ margin: 0, color: '#6b6b6b', fontSize: 14 }}>שלב אחרון — הוסיפו את האפליקציה למסך הבית</p>
            </div>

            <div style={{ background: '#f7f4ef', border: '1.5px solid #e4ddd0', borderRadius: 12, padding: 16, marginBottom: 18 }}>
              {installPrompt ? (
                <button
                  type="button"
                  onClick={() => installPrompt.prompt()}
                  style={{ width: '100%', minHeight: 48, background: GREEN, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'Heebo, Arial, sans-serif' }}
                >
                  📲 התקנת האפליקציה
                </button>
              ) : (
                <>
                  <p style={{ margin: '0 0 10px', fontWeight: 800, fontSize: 14, color: DARK }}>📱 באייפון (Safari):</p>
                  <p style={{ margin: '0 0 14px', fontSize: 13.5, color: '#555', lineHeight: 1.7 }}>
                    לחצו על כפתור השיתוף 📤 בתחתית המסך ← בחרו &quot;הוספה למסך הבית&quot; ➕
                  </p>
                  <p style={{ margin: '0 0 10px', fontWeight: 800, fontSize: 14, color: DARK }}>🤖 באנדרואיד (Chrome):</p>
                  <p style={{ margin: 0, fontSize: 13.5, color: '#555', lineHeight: 1.7 }}>
                    פתחו את התפריט ⋮ בפינה ← בחרו &quot;הוספה למסך הבית&quot; או &quot;התקנת אפליקציה&quot;
                  </p>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => router.push('/interval/receiver')}
              style={{ width: '100%', minHeight: 52, background: PINK, color: '#fff', border: 'none', borderRadius: 12, fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 900, fontSize: 17, cursor: 'pointer' }}
            >
              המשך לטיימר ←
            </button>
          </>
        )}
      </div>
    </div>
  )
}
