'use client'
import { useEffect, useRef, useState } from 'react'
import { playStartSound, playStopSound, playFinishSound, playEnabledSound, vibrate, formatTime } from '@/lib/interval-sound'

// /interval/personal — a solo interval timer for anyone who installed the
// טבע בייק PWA and wants to train on their own, outside a coordinator-led
// group session. Deliberately has NO server component at all: no DB row, no
// Realtime, no Push — everything lives in this tab's own state. That's not
// a shortcut, it's the right shape for this use case: a personal timer only
// ever needs to talk to the one screen already in front of the person
// running it, so the whole group-session machinery (the shared
// interval_sessions row, /api/interval/control, notifying subscribers) would
// just be overhead here. See app/interval/receiver for the group version and
// app/admin/coordinator/interval for the panel that drives it.

const DARK = '#0C1814'
const ACCENT = '#b5e853'
const CARD = '#141716'
const BORDER = '#252b27'
const MUTED = '#7a8f7d'

type Phase = 'idle' | 'work' | 'rest' | 'done'
type Status = 'idle' | 'running' | 'paused' | 'finished'

const PHASE_BG: Record<Phase, string> = { idle: DARK, work: '#15803d', rest: '#b91c1c', done: DARK }
const PHASE_LABEL: Record<Phase, string> = { idle: 'מוכנים?', work: 'עבודה 💪', rest: 'מנוחה 🧊', done: 'סיימת! 🎉' }

const RECOMMENDATIONS = [
  { name: 'כידון ספון 35', price: 399, image: '/spoon35m.webp' },
  { name: 'גריפים ספייק 33', price: 139, image: '/SPIKE33MAIN123.webp' },
  { name: 'מגיני רגל IXS CARVE 2.0', price: 550, image: 'https://fmxkkwunwzmrjsvejzub.supabase.co/storage/v1/object/public/product-images/ixs_carve_2_knee_guards/1788878130301-w5s25i.png' },
]

export default function PersonalIntervalPage() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [status, setStatus] = useState<Status>('idle')
  const [currentRound, setCurrentRound] = useState(0)
  const [phaseEndsAt, setPhaseEndsAt] = useState<number | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const [workSeconds, setWorkSeconds] = useState('30')
  const [restSeconds, setRestSeconds] = useState('30')
  const [rounds, setRounds] = useState('6')

  const [soundEnabled, setSoundEnabled] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)

  function enableSound() {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!audioCtxRef.current) {
      if (!Ctor) return
      audioCtxRef.current = new Ctor()
    }
    audioCtxRef.current.resume().then(() => playEnabledSound(audioCtxRef.current!))
    setSoundEnabled(true)
  }

  function fireTransition(next: Phase) {
    if (next === 'work') vibrate([200, 100, 200])
    else if (next === 'rest') vibrate([600])
    else if (next === 'done') vibrate([400, 100, 400, 100, 400])

    if (!soundEnabled || !audioCtxRef.current) return
    const ctx = audioCtxRef.current
    ctx.resume().then(() => {
      if (next === 'work') playStartSound(ctx)
      else if (next === 'rest') playStopSound(ctx)
      else if (next === 'done') playFinishSound(ctx)
    })
  }

  function start() {
    const work = Math.max(1, Math.min(3600, Number(workSeconds) || 30))
    setPhase('work')
    setStatus('running')
    setCurrentRound(1)
    setPhaseEndsAt(Date.now() + work * 1000)
    setRemainingSeconds(null)
    fireTransition('work')
  }

  function pause() {
    if (status !== 'running') return
    const remaining = phaseEndsAt ? Math.max(0, Math.ceil((phaseEndsAt - Date.now()) / 1000)) : 0
    setStatus('paused')
    setRemainingSeconds(remaining)
    setPhaseEndsAt(null)
  }

  function resume() {
    if (status !== 'paused') return
    setStatus('running')
    setPhaseEndsAt(Date.now() + (remainingSeconds ?? 0) * 1000)
    setRemainingSeconds(null)
  }

  /** Advances to the next phase/round — same shared meaning as the "skip" button and the automatic tick below. */
  function advance() {
    const work = Math.max(1, Math.min(3600, Number(workSeconds) || 30))
    const rest = Math.max(0, Math.min(3600, Number(restSeconds) || 0))
    const totalRounds = Math.max(1, Math.min(200, Number(rounds) || 1))

    if (phase === 'work' && rest > 0) {
      setPhase('rest')
      setPhaseEndsAt(Date.now() + rest * 1000)
      fireTransition('rest')
    } else if (currentRound >= totalRounds) {
      setStatus('finished')
      setPhase('done')
      setPhaseEndsAt(null)
      fireTransition('done')
    } else {
      setCurrentRound(r => r + 1)
      setPhase('work')
      setPhaseEndsAt(Date.now() + work * 1000)
      fireTransition('work')
    }
  }

  function reset() {
    setStatus('idle')
    setPhase('idle')
    setCurrentRound(0)
    setPhaseEndsAt(null)
    setRemainingSeconds(null)
  }

  // Auto-advance: no server, no other tab to race with, so this is just a
  // plain "did the clock run out" check on the local tick below. Deferred a
  // tick (rather than calling advance() straight in the effect body) so the
  // state update isn't synchronous-within-effect.
  useEffect(() => {
    if (status !== 'running' || phaseEndsAt === null) return
    if (now < phaseEndsAt) return
    const id = setTimeout(advance, 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, status, phaseEndsAt])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  // Screen Wake Lock while running — same reasoning as the coordinator panel:
  // a screen that turns itself off stops this tab's own JS clock along with it.
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }
    if (!nav.wakeLock) return
    async function acquire() {
      try { wakeLockRef.current = await nav.wakeLock!.request('screen') } catch { /* denied/unsupported */ }
    }
    async function release() {
      try { await wakeLockRef.current?.release() } catch { /* already released */ }
      wakeLockRef.current = null
    }
    function onVisible() {
      if (document.visibilityState === 'visible' && status === 'running' && !wakeLockRef.current) acquire()
      if (document.visibilityState === 'visible') audioCtxRef.current?.resume()
    }
    if (status === 'running') acquire()
    else release()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [status])

  const isRunningOrPaused = status === 'running' || status === 'paused'
  let secondsLeft: number | null = null
  if (phaseEndsAt !== null) secondsLeft = (phaseEndsAt - now) / 1000
  else if (status === 'paused' && remainingSeconds != null) secondsLeft = remainingSeconds

  const bg = PHASE_BG[phase]

  return (
    <div
      dir="rtl"
      onClick={soundEnabled ? undefined : enableSound}
      style={{
        minHeight: '100vh', background: bg, color: '#fff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Heebo, Arial, sans-serif', padding: 24, textAlign: 'center',
        transition: 'background 0.4s ease', cursor: soundEnabled ? 'default' : 'pointer',
      }}
    >
      <div style={{ position: 'fixed', top: 0, insetInline: 0, background: 'rgba(0,0,0,0.55)', padding: '10px 16px', fontSize: 13.5, fontWeight: 800 }}>
        {soundEnabled
          ? '🔊 צליל פעיל · השאירו את המסך פתוח (לא נעול) כדי לשמוע'
          : '🔇 הקישו על המסך כדי להפעיל צליל לאותות'}
      </div>

      <img src="/logo.png" alt="טבע בייק" style={{ height: 44, borderRadius: 8, marginBottom: 24, opacity: 0.95 }} />

      {status === 'finished' ? (
        <FinishedScreen onAgain={reset} />
      ) : status === 'idle' ? (
        // No stopPropagation here on purpose: the outer container's onClick
        // (enableSound) still bubbles up from clicking into a field or the
        // Start button, so the very first tap anywhere — including "התחל"
        // itself — is what unlocks audio, not a separate dedicated tap.
        <div style={{ width: '100%', maxWidth: 380 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 4px' }}>⏱️ אינטרוול אישי</h1>
          <p style={{ opacity: 0.75, fontSize: 14, margin: '0 0 20px' }}>קבעו לעצמכם עבודה / מנוחה / חזרות והתחילו</p>

          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <Field label="עבודה (שניות)" value={workSeconds} onChange={setWorkSeconds} />
              <Field label="מנוחה (שניות)" value={restSeconds} onChange={setRestSeconds} />
              <Field label="חזרות" value={rounds} onChange={setRounds} />
            </div>
          </div>

          <button
            onClick={start}
            style={{ width: '100%', minHeight: 56, borderRadius: 12, border: 'none', background: ACCENT, color: DARK, fontWeight: 900, fontSize: 18, cursor: 'pointer' }}
          >
            ▶️ התחל
          </button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 'clamp(18px, 4vw, 28px)', fontWeight: 800, letterSpacing: 1, marginBottom: 8, opacity: 0.9 }}>
            {PHASE_LABEL[phase]}
          </div>

          {secondsLeft != null && (
            <div style={{ fontSize: 'clamp(96px, 28vw, 220px)', fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums', direction: 'ltr' }}>
              {formatTime(secondsLeft)}
            </div>
          )}

          <div style={{ marginTop: 28, fontSize: 'clamp(16px, 3vw, 22px)', fontWeight: 700, opacity: 0.85 }}>
            חזרה {currentRound} מתוך {rounds}
          </div>

          {status === 'paused' && (
            <div style={{ marginTop: 16, fontSize: 15, fontWeight: 800, background: 'rgba(255,255,255,0.15)', padding: '8px 18px', borderRadius: 999 }}>
              ⏸️ מושהה
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 32 }}>
            {isRunningOrPaused && (
              <button
                onClick={status === 'paused' ? resume : pause}
                style={{ minHeight: 48, padding: '0 20px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}
              >
                {status === 'paused' ? '▶️ המשך' : '⏸️ השהה'}
              </button>
            )}
            <button
              onClick={advance}
              disabled={status !== 'running'}
              style={{ minHeight: 48, padding: '0 20px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: status === 'running' ? 'pointer' : 'default', opacity: status === 'running' ? 1 : 0.5 }}
            >
              ⏭️ דלג
            </button>
            <button
              onClick={reset}
              style={{ minHeight: 48, padding: '0 20px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}
            >
              ⏹️ איפוס
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: MUTED, marginBottom: 6 }}>{label}</span>
      <input
        type="number" min={0} value={value} inputMode="numeric"
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 8px', borderRadius: 10, border: `1px solid ${BORDER}`, background: '#0d0f0e', color: '#e7e7e0', fontSize: 16, textAlign: 'center' }}
      />
    </label>
  )
}

function FinishedScreen({ onAgain }: { onAgain: () => void }) {
  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 56, marginBottom: 10 }}>🎉</div>
      <h1 style={{ fontSize: 'clamp(22px, 5vw, 30px)', fontWeight: 900, margin: '0 0 6px' }}>כל הכבוד, סיימת!</h1>
      <p style={{ opacity: 0.8, margin: '0 0 20px', fontSize: 15 }}>המלצות בשבילך 🎯</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', marginBottom: 22 }}>
        {RECOMMENDATIONS.map((p) => (
          <a
            key={p.name}
            href="/shop"
            style={{ width: 140, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 14, padding: 12, textDecoration: 'none', color: '#fff' }}
          >
            <img src={p.image} alt={p.name} style={{ width: '100%', height: 90, objectFit: 'contain', marginBottom: 8, borderRadius: 8, background: '#fff' }} />
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{p.name}</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#ffd966' }}>{p.price} ₪</div>
          </a>
        ))}
      </div>

      <button
        onClick={onAgain}
        style={{ minHeight: 52, padding: '0 28px', borderRadius: 12, border: 'none', background: '#b5e853', color: '#0C1814', fontWeight: 900, fontSize: 16, cursor: 'pointer' }}
      >
        סבב נוסף 🔁
      </button>
    </div>
  )
}
