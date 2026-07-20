'use client'
import { useState, useEffect, useRef, useCallback, useId } from 'react'
import { usePathname } from 'next/navigation'
import { LEAD_INTERESTS } from '@/lib/leads'

// Public "צור קשר" floating button + modal lead form.
// Bottom-left, stacked ABOVE the accessibility link that lives in the root
// layout (so the two don't overlap). Hidden on /admin. Submits to the
// service-role /api/leads route. Accessible: labelled dialog, focus trap,
// Esc/backdrop close, keyboard nav, AA-contrast colours.

const PURPLE = '#7c3aed'   // violet-600 — AA contrast with white text
const PINK   = '#db2777'   // pink-600
const INK    = '#1a1230'

export default function ContactWidget() {
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith('/admin') ?? false

  const [mounted, setMounted]     = useState(false)
  const [open, setOpen]           = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]           = useState(false)
  const [error, setError]         = useState('')

  const [fullName, setFullName] = useState('')
  const [phone, setPhone]       = useState('')
  const [interest, setInterest] = useState('')
  const [message, setMessage]   = useState('')

  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef  = useRef<HTMLDivElement>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const titleId = useId()

  useEffect(() => { setMounted(true) }, [])

  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  // Focus first field on open; focus trap + Esc while open.
  useEffect(() => {
    if (!open) return
    firstFieldRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return }
      if (e.key === 'Tab' && dialogRef.current) {
        const f = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
          ),
        ).filter(el => el.offsetParent !== null)
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!fullName.trim() || !phone.trim() || !interest) {
      setError('נא למלא שם, טלפון ותחום עניין')
      return
    }
    setSubmitting(true)
    try {
      const r = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, phone, interest, message }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.ok) {
        setDone(true)
        setFullName(''); setPhone(''); setInterest(''); setMessage('')
      } else {
        setError(d.error || 'אירעה שגיאה, נסו שוב')
      }
    } catch {
      setError('בעיית רשת, נסו שוב')
    } finally {
      setSubmitting(false)
    }
  }

  if (isAdmin || !mounted) return null

  const field: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '11px 12px', fontSize: 16,
    borderRadius: 10, border: '1.5px solid #d1c9e0', background: '#fff', color: INK,
    fontFamily: 'Heebo, Arial, sans-serif',
  }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 700, color: INK, marginBottom: 6 }

  return (
    <>
      {/* Floating trigger — bottom-left, above the accessibility link */}
      <button
        ref={triggerRef}
        onClick={() => { setOpen(true); setDone(false); setError('') }}
        aria-label="צור קשר"
        aria-haspopup="dialog"
        style={{
         position: 'fixed', bottom: 150, left: 24, zIndex: 9998,
          minWidth: 56, height: 56, borderRadius: 28, padding: '0 20px',
          display: 'flex', alignItems: 'center', gap: 8,
          background: `linear-gradient(135deg, ${PURPLE}, ${PINK})`, color: '#fff',
          border: '3px solid #fff', boxShadow: '0 4px 18px rgba(124,58,237,0.5)',
          fontFamily: 'Heebo, Arial, sans-serif', fontSize: 16, fontWeight: 800, cursor: 'pointer',
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 20 }}>✉️</span>
        <span>צור קשר</span>
      </button>

      {open && (
        <div
          role="presentation"
          onMouseDown={e => { if (e.target === e.currentTarget) close() }}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000, direction: 'rtl',
            background: 'rgba(20,10,35,0.55)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 16,
            fontFamily: 'Heebo, Arial, sans-serif',
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            style={{
              width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto',
              background: '#fff', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            }}
          >
            {/* Header */}
            <div style={{ background: `linear-gradient(135deg, ${PURPLE}, ${PINK})`, color: '#fff', padding: '18px 20px', borderRadius: '18px 18px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 id={titleId} style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>🚵 צרו איתנו קשר</h2>
              <button
                onClick={close}
                aria-label="סגירת החלון"
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: 10, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
              >✕</button>
            </div>

            {done ? (
              <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 56, marginBottom: 12 }} aria-hidden="true">🎉</div>
                <p role="status" style={{ fontSize: 20, fontWeight: 800, color: INK, margin: '0 0 24px' }}>תודה! נחזור אליך בקרוב 🚵</p>
                <button
                  onClick={close}
                  style={{ minHeight: 48, padding: '0 28px', background: PURPLE, color: '#fff', border: 'none', borderRadius: 12, fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}
                >סגירה</button>
              </div>
            ) : (
              <form onSubmit={submit} style={{ padding: '20px 20px 24px' }}>
                <div style={{ marginBottom: 16 }}>
                  <label htmlFor="cw-name" style={labelStyle}>שם מלא <span style={{ color: PINK }}>*</span></label>
                  <input id="cw-name" ref={firstFieldRef} value={fullName} onChange={e => setFullName(e.target.value)} required aria-required="true" autoComplete="name" style={field} />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label htmlFor="cw-phone" style={labelStyle}>טלפון <span style={{ color: PINK }}>*</span></label>
                  <input id="cw-phone" type="tel" dir="ltr" value={phone} onChange={e => setPhone(e.target.value)} required aria-required="true" autoComplete="tel" style={{ ...field, textAlign: 'right' }} />
                </div>

                <fieldset style={{ border: 'none', padding: 0, margin: '0 0 16px' }}>
                  <legend style={{ ...labelStyle, marginBottom: 10, padding: 0 }}>תחום עניין <span style={{ color: PINK }}>*</span></legend>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {LEAD_INTERESTS.map(opt => {
                      const selected = interest === opt
                      return (
                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${selected ? PURPLE : '#d1c9e0'}`, background: selected ? '#f5f0ff' : '#fff' }}>
                          <input
                            type="radio" name="cw-interest" value={opt}
                            checked={selected} onChange={() => setInterest(opt)}
                            required aria-required="true"
                            style={{ width: 20, height: 20, accentColor: PURPLE, flexShrink: 0 }}
                          />
                          <span style={{ fontSize: 15, fontWeight: selected ? 700 : 500, color: INK }}>{opt}</span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>

                <div style={{ marginBottom: 16 }}>
                  <label htmlFor="cw-msg" style={labelStyle}>הודעה <span style={{ color: '#8a7fa5', fontWeight: 500 }}>(לא חובה)</span></label>
                  <textarea id="cw-msg" value={message} onChange={e => setMessage(e.target.value)} rows={3} style={{ ...field, resize: 'vertical' }} />
                </div>

                {error && (
                  <p role="alert" style={{ margin: '0 0 14px', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontWeight: 600 }}>{error}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  style={{ width: '100%', minHeight: 52, background: submitting ? '#b6a7c9' : `linear-gradient(135deg, ${PURPLE}, ${PINK})`, color: '#fff', border: 'none', borderRadius: 12, fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 900, fontSize: 17, cursor: submitting ? 'default' : 'pointer' }}
                >
                  {submitting ? 'שולח...' : 'שליחה'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
