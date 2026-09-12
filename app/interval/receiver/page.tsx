'use client'
import { useEffect, useState } from 'react'
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

export default function IntervalReceiverPage() {
  const [session, setSession] = useState<SessionRow | null>(null)
  const [now, setNow] = useState(() => Date.now())

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
    <div dir="rtl" style={{
      minHeight: '100vh', background: bg, color: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Heebo, Arial, sans-serif', padding: 24, textAlign: 'center',
      transition: 'background 0.4s ease',
    }}>
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
