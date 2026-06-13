'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'

const BLUE = '#0057b8'
const FONT_STEPS = [0, 2, 4, 6] // extra px added to base 16px

export default function AccessibilityWidget() {
  const pathname = usePathname()
  const [open, setOpen]               = useState(false)
  const [fontStep, setFontStep]       = useState(0)
  const [highContrast, setHighContrast] = useState(false)
  const [grayscale, setGrayscale]     = useState(false)
  const [mounted, setMounted]         = useState(false)

  const triggerRef  = useRef<HTMLButtonElement>(null)
  const panelRef    = useRef<HTMLDivElement>(null)

  const isAdmin = pathname?.startsWith('/admin') ?? false

  // Load persisted preferences once
  useEffect(() => {
    setMounted(true)
    setFontStep(parseInt(localStorage.getItem('a11y-font-step') ?? '0', 10))
    setHighContrast(localStorage.getItem('a11y-contrast') === '1')
    setGrayscale(localStorage.getItem('a11y-grayscale') === '1')
  }, [])

  // Apply font size to <html>
  useEffect(() => {
    if (!mounted || isAdmin) return
    const size = 16 + FONT_STEPS[fontStep]
    document.documentElement.style.fontSize = fontStep > 0 ? `${size}px` : ''
    localStorage.setItem('a11y-font-step', String(fontStep))
  }, [fontStep, mounted, isAdmin])

  // Apply high contrast class to <html>
  useEffect(() => {
    if (!mounted || isAdmin) return
    document.documentElement.classList.toggle('a11y-high-contrast', highContrast)
    localStorage.setItem('a11y-contrast', highContrast ? '1' : '0')
  }, [highContrast, mounted, isAdmin])

  // Apply grayscale class to <html>
  useEffect(() => {
    if (!mounted || isAdmin) return
    document.documentElement.classList.toggle('a11y-grayscale', grayscale)
    localStorage.setItem('a11y-grayscale', grayscale ? '1' : '0')
  }, [grayscale, mounted, isAdmin])

  // Close on Escape, focus trap on open
  useEffect(() => {
    if (!open) return
    // Focus first interactive element in panel
    const first = panelRef.current?.querySelector<HTMLElement>('button, [tabindex="0"]')
    first?.focus()

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
      // Basic focus trap
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]')
        )
        if (!focusable.length) return
        const first = focusable[0]
        const last  = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  const toggle = useCallback(() => setOpen(v => !v), [])

  if (isAdmin || !mounted) return null

  const sizeLabel = ['רגיל', 'גדול', 'גדול מאד', 'ענק'][fontStep] ?? 'רגיל'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        fontFamily: 'Heebo, Arial, sans-serif',
        direction: 'rtl',
      }}
    >
      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="הגדרות נגישות"
          aria-modal="true"
          style={{
            position: 'absolute',
            bottom: 64,
            right: 0,
            width: 240,
            background: '#ffffff',
            border: `2px solid ${BLUE}`,
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            overflow: 'hidden',
          }}
        >
          {/* Panel header */}
          <div style={{
            background: BLUE,
            color: '#fff',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontWeight: 700,
            fontSize: 14,
          }}>
            <span>נגישות</span>
            <button
              onClick={() => { setOpen(false); triggerRef.current?.focus() }}
              aria-label="סגור תפריט נגישות"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: 18,
                cursor: 'pointer',
                lineHeight: 1,
                padding: '0 2px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              ✕
            </button>
          </div>

          {/* Font size */}
          <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
              גודל טקסט
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setFontStep(s => Math.max(0, s - 1))}
                disabled={fontStep === 0}
                aria-label="הקטן גופן"
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: fontStep === 0 ? '#f3f4f6' : BLUE,
                  color: fontStep === 0 ? '#9ca3af' : '#fff',
                  border: 'none', cursor: fontStep === 0 ? 'default' : 'pointer',
                  fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                −
              </button>
              <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#111827' }}>
                <span aria-live="polite" aria-atomic="true">{sizeLabel}</span>
              </div>
              <button
                onClick={() => setFontStep(s => Math.min(FONT_STEPS.length - 1, s + 1))}
                disabled={fontStep === FONT_STEPS.length - 1}
                aria-label="הגדל גופן"
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: fontStep === FONT_STEPS.length - 1 ? '#f3f4f6' : BLUE,
                  color: fontStep === FONT_STEPS.length - 1 ? '#9ca3af' : '#fff',
                  border: 'none', cursor: fontStep === FONT_STEPS.length - 1 ? 'default' : 'pointer',
                  fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                +
              </button>
            </div>
            {/* Visual size steps */}
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {FONT_STEPS.map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1, height: 3, borderRadius: 2,
                    background: i <= fontStep ? BLUE : '#e5e7eb',
                    transition: 'background .2s',
                  }}
                />
              ))}
            </div>
          </div>

          {/* High contrast */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #e5e7eb' }}>
            <button
              role="switch"
              aria-checked={highContrast}
              onClick={() => setHighContrast(v => !v)}
              aria-label={`ניגודיות גבוהה — ${highContrast ? 'פעיל' : 'כבוי'}`}
              style={{
                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>🌓</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>ניגודיות גבוהה</span>
              </div>
              <Toggle on={highContrast} />
            </button>
          </div>

          {/* Grayscale */}
          <div style={{ padding: '12px 14px' }}>
            <button
              role="switch"
              aria-checked={grayscale}
              onClick={() => setGrayscale(v => !v)}
              aria-label={`גווני אפור — ${grayscale ? 'פעיל' : 'כבוי'}`}
              style={{
                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>◑</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>גווני אפור</span>
              </div>
              <Toggle on={grayscale} />
            </button>
          </div>
        </div>
      )}

      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={toggle}
        aria-label={open ? 'סגור תפריט נגישות' : 'פתח תפריט נגישות'}
        aria-expanded={open}
        aria-haspopup="dialog"
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: BLUE,
          border: '3px solid #fff',
          boxShadow: '0 4px 16px rgba(0,87,184,0.45)',
          color: '#fff',
          fontSize: 24,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform .15s, box-shadow .15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.1)'
          e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,87,184,0.6)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,87,184,0.45)'
        }}
      >
        ♿
      </button>
    </div>
  )
}

function Toggle({ on }: { on: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 40, height: 22, borderRadius: 11,
        background: on ? BLUE : '#d1d5db',
        transition: 'background .2s',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute',
        top: 3,
        right: on ? 3 : 'auto',
        left: on ? 'auto' : 3,
        width: 16, height: 16,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'right .2s, left .2s',
      }} />
    </div>
  )
}
