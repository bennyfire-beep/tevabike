'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

// /interval/receiver — the screen a rider actually looks at during the
// workout: one huge number, background colour telling them work vs rest at
// a glance, readable from a bike mount at a distance. State comes from
// Supabase Realtime (postgres_changes on interval_sessions), so it updates
// the instant the coordinator's panel does — the Web Push is what wakes a
// locked phone, this is what a screen that's already on shows.

const SESSION_ID = '00000000-0000-0000-0000-000000000001'

const DARK = '#0C1814'

type Phase = 'idle' | 'work' | 'rest' | 'done'
type Status = 'idle' | 'running' | 'paused' | 'finished'

type SessionRow = {
  status: Status
  work_seconds: number
  rest_seconds: number
  rounds: number
  current_round: number
  current_phase: Phase
  phase_ends_at: string | null
  remaining_seconds: number | null
}

const PHASE_BG: Record<Phase, string> = {
  idle: DARK,
  work: '#15803d',
  rest: '#b91c1c',
  done: DARK,
}

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'ממתינים להתחלה',
  work: 'עבודה 💪',
  rest: 'מנוחה 🧊',
  done: 'סיימת! 🎉',
}

// שלושה פריטים מייצגים מתוך /shop — לא כל הקטלוג, רק "טיפ אישי" קצר אחרי
// אימון. אם מוצר יורד מהחנות זה לא שובר כלום, זה רק קישור.
const RECOMMENDATIONS = [
  { name: 'כידון ספון 35', price: 399, image: '/spoon35m.webp' },
  { name: 'גריפים ספייק 33', price: 139, image: '/SPIKE33MAIN123.webp' },
  { name: 'מגיני רגל IXS CARVE 2.0', price: 550, image: 'https://fmxkkwunwzmrjsvejzub.supabase.co/storage/v1/object/public/product-images/ixs_carve_2_knee_guards/1788878130301-w5s25i.png' },
]

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${String(ss).padStart(2, '0')}`
}

// ── Sound + vibration on phase change ───────────────────────────────────────
// The Web Push (see lib/interval-notify.ts) is what's supposed to wake a
// LOCKED phone, but in practice that only works from the installed home-
// screen PWA (iOS requires it; testing straight in a Safari tab never rings).
// This is the fallback that actually matters for "screen is open, on the
// table, nobody's looking at it every second": play an audible tone and
// vibrate right here whenever the phase changes, independent of push/PWA
// install status entirely.
//
// iOS Safari blocks audio started without a user gesture, and never supports
// navigator.vibrate at all (Apple's own restriction, not fixable from here) —
// so the page waits for one tap anywhere to unlock its AudioContext before
// any of this can play.
function beep(ctx: AudioContext, freq: number, atSeconds: number, durationSeconds: number, gain = 0.4) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  const t0 = ctx.currentTime + atSeconds
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01)
  g.gain.linearRampToValueAtTime(0, t0 + durationSeconds)
  osc.connect(g)
  g.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + durationSeconds + 0.02)
}

/** "תות תות" — short double beep, work starting. */
function playStartSound(ctx: AudioContext) {
  beep(ctx, 880, 0, 0.14)
  beep(ctx, 880, 0.22, 0.14)
}

/** One long tone — this phase is over, stop / switch to rest. */
function playStopSound(ctx: AudioContext) {
  beep(ctx, 440, 0, 0.75, 0.45)
}

/** Three rising beeps — the whole workout is done. */
function playFinishSound(ctx: AudioContext) {
  beep(ctx, 660, 0, 0.16)
  beep(ctx, 880, 0.22, 0.16)
  beep(ctx, 1100, 0.44, 0.3)
}

function vibrate(pattern: number[]) {
  try { navigator.vibrate?.(pattern) } catch { /* unsupported (all of iOS) — ignore */ }
}

export default function IntervalReceiverPage() {
  const [session, setSession] = useState<SessionRow | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [soundEnabled, setSoundEnabled] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const lastPhaseRef = useRef<Phase | null>(null)

  function enableSound() {
    if (audioCtxRef.current) { audioCtxRef.current.resume(); setSoundEnabled(true); return }
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    audioCtxRef.current = new Ctor()
    // A silent tick right now, inside this tap, is what actually unlocks the
    // context on iOS — a later call from a Realtime callback (no user
    // gesture behind it) would otherwise be silently ignored by Safari.
    beep(audioCtxRef.current, 440, 0, 0.01, 0.0001)
    setSoundEnabled(true)
  }

  // Fires the right sound + vibration exactly on a phase transition — never
  // on the initial load (lastPhaseRef starts null, so the first real value
  // is treated as "nothing to compare yet", not a transition) and never
  // twice for the same phase (Realtime can resend the same row on reconnect).
  useEffect(() => {
    const next = session?.current_phase
    if (next === undefined) return // nothing loaded yet
    const prev = lastPhaseRef.current
    lastPhaseRef.current = next
    if (prev === null || prev === next) return

    if (next === 'work') { vibrate([200, 100, 200]); if (soundEnabled && audioCtxRef.current) playStartSound(audioCtxRef.current) }
    else if (next === 'rest') { vibrate([600]); if (soundEnabled && audioCtxRef.current) playStopSound(audioCtxRef.current) }
    else if (next === 'done') { vibrate([400, 100, 400, 100, 400]); if (soundEnabled && audioCtxRef.current) playFinishSound(audioCtxRef.current) }
  }, [session?.current_phase, soundEnabled])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data } = await supabase.from('interval_sessions').select('*').eq('id', SESSION_ID).single()
      if (!cancelled && data) setSession(data as SessionRow)
    }
    load()

    const channel = supabase
      .channel('interval-sessions-receiver')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'interval_sessions', filter: `id=eq.${SESSION_ID}` },
        (payload) => setSession(payload.new as SessionRow),
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  // A locked/backgrounded phone can suspend the Realtime socket — when the
  // rider unlocks and looks at this screen, re-sync from the DB immediately
  // instead of showing whatever phase was last rendered until a Realtime
  // event happens to arrive (the Web Push already woke them; this just makes
  // sure the screen they glance at matches reality right away).
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      supabase.from('interval_sessions').select('*').eq('id', SESSION_ID).single()
        .then(({ data }) => { if (data) setSession(data as SessionRow) })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Local 1x/sec tick so the countdown reads smoothly between server updates
  // — the source of truth is always phase_ends_at, this just re-renders.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const phase: Phase = session?.current_phase ?? 'idle'
  const status: Status = session?.status ?? 'idle'

  let secondsLeft: number | null = null
  if (session?.phase_ends_at) {
    secondsLeft = (new Date(session.phase_ends_at).getTime() - now) / 1000
  } else if (status === 'paused' && session?.remaining_seconds != null) {
    secondsLeft = session.remaining_seconds
  }

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
      {!soundEnabled && (
        <div style={{ position: 'fixed', top: 0, insetInline: 0, background: 'rgba(0,0,0,0.55)', padding: '10px 16px', fontSize: 14, fontWeight: 800 }}>
          🔊 הקישו על המסך כדי להפעיל צליל לאותות
        </div>
      )}

      <img src="/logo.png" alt="טבע בייק" style={{ height: 44, borderRadius: 8, marginBottom: 28, opacity: 0.95 }} />

      {status === 'finished' || phase === 'done' ? (
        <FinishedScreen />
      ) : (
        <>
          <div style={{ fontSize: 'clamp(18px, 4vw, 28px)', fontWeight: 800, letterSpacing: 1, marginBottom: 8, opacity: 0.9 }}>
            {PHASE_LABEL[phase]}
          </div>

          {secondsLeft != null && (status === 'running' || status === 'paused') ? (
            <div style={{ fontSize: 'clamp(96px, 28vw, 220px)', fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums', direction: 'ltr' }}>
              {formatTime(secondsLeft)}
            </div>
          ) : (
            <div style={{ fontSize: 'clamp(20px, 5vw, 32px)', fontWeight: 700, opacity: 0.85, maxWidth: 320 }}>
              המדריך עוד לא התחיל את האימון — הישארו במסך הזה
            </div>
          )}

          {status !== 'idle' && (
            <div style={{ marginTop: 28, fontSize: 'clamp(16px, 3vw, 22px)', fontWeight: 700, opacity: 0.85 }}>
              חזרה {session?.current_round ?? 0} מתוך {session?.rounds ?? 0}
            </div>
          )}

          {status === 'paused' && (
            <div style={{ marginTop: 16, fontSize: 15, fontWeight: 800, background: 'rgba(255,255,255,0.15)', padding: '8px 18px', borderRadius: 999 }}>
              ⏸️ מושהה
            </div>
          )}
        </>
      )}
    </div>
  )
}

function FinishedScreen() {
  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 56, marginBottom: 10 }}>🎉</div>
      <h1 style={{ fontSize: 'clamp(22px, 5vw, 30px)', fontWeight: 900, margin: '0 0 6px' }}>כל הכבוד, סיימתם!</h1>
      <p style={{ opacity: 0.8, margin: '0 0 24px', fontSize: 15 }}>המלצות בשבילך 🎯</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
        {RECOMMENDATIONS.map((p) => (
          <a
            key={p.name}
            href="/shop"
            style={{
              width: 140, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 14, padding: 12, textDecoration: 'none', color: '#fff',
            }}
          >
            <img src={p.image} alt={p.name} style={{ width: '100%', height: 90, objectFit: 'contain', marginBottom: 8, borderRadius: 8, background: '#fff' }} />
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{p.name}</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#ffd966' }}>{p.price} ₪</div>
          </a>
        ))}
      </div>

      <a href="/shop" style={{ display: 'inline-block', marginTop: 22, color: '#fff', opacity: 0.75, fontSize: 13.5, textDecoration: 'underline' }}>
        לכל המוצרים בחנות ←
      </a>
    </div>
  )
}
