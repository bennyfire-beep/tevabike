'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

// /admin/coordinator/interval — the instructor's control panel: set
// work/rest/rounds, Start/Pause/Skip/Reset. Every click hits
// /api/interval/control, which updates the single interval_sessions row
// (→ every open /interval/receiver screen updates via Realtime) and fires a
// Web Push at the registered riders on a phase change.
//
// There's no server-side clock advancing phases on its own — this panel
// schedules its own advance by comparing the live "now" tick against the row's
// phase_ends_at (see the effect below) and calling action:'skip' with
// auto:true right when it elapses. That means this tab has to stay open for
// the length of the session, same as any screen actively running a live
// class from a tablet/phone would anyway.

const SESSION_ID = '00000000-0000-0000-0000-000000000001'
const ACCENT = '#b5e853'
const CARD   = '#141716'
const BORDER = '#252b27'
const MUTED  = '#7a8f7d'

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

const PHASE_LABEL: Record<Phase, string> = { idle: 'ממתין', work: 'עבודה 💪', rest: 'מנוחה 🧊', done: 'הסתיים 🎉' }

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${String(ss).padStart(2, '0')}`
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token ?? ''
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

export default function IntervalControlPage() {
  const [session, setSession] = useState<SessionRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const [workSeconds, setWorkSeconds] = useState('30')
  const [restSeconds, setRestSeconds] = useState('30')
  const [rounds, setRounds] = useState('6')

  const skipInFlight = useRef(false)
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null)

  async function refetchSession() {
    const { data } = await supabase.from('interval_sessions').select('*').eq('id', SESSION_ID).single()
    if (data) setSession(data as SessionRow)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase.from('interval_sessions').select('*').eq('id', SESSION_ID).single()
      if (cancelled) return
      if (data) {
        const row = data as SessionRow
        setSession(row)
        setWorkSeconds(String(row.work_seconds))
        setRestSeconds(String(row.rest_seconds))
        setRounds(String(row.rounds))
      }
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel('interval-sessions-admin')
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

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  // A backgrounded/locked phone can suspend the Realtime socket outright — on
  // returning to the tab, re-sync from the DB instead of trusting whatever
  // Realtime event (if any) eventually arrives. Cheap, and it's exactly the
  // moment a stale display would otherwise be most visible to the coordinator.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') refetchSession()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Screen Wake Lock — this panel's own auto-advance (below) only runs while
  // its tab is alive and ticking; a phone/tablet screen turning off during a
  // live session would stall it. Best-effort: unsupported browsers (older
  // Safari) just fall back to "keep the screen on yourself", same as today.
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }
    if (!nav.wakeLock) return

    async function acquire() {
      try { wakeLock.current = await nav.wakeLock!.request('screen') } catch { /* denied/unsupported — carry on without it */ }
    }
    async function release() {
      try { await wakeLock.current?.release() } catch { /* already released */ }
      wakeLock.current = null
    }
    function onVisible() {
      // The wake lock is auto-released whenever the tab is hidden — re-request
      // it once the coordinator comes back, if the session is still running.
      if (document.visibilityState === 'visible' && session?.status === 'running' && !wakeLock.current) acquire()
    }

    if (session?.status === 'running') acquire()
    else release()

    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [session?.status])

  async function call(action: string, extra?: Record<string, unknown>) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/interval/control', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ action, ...extra }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'הפעולה נכשלה'); return }
      if (d.session) setSession(d.session)
    } catch (e) {
      setError('בעיית רשת: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // Auto-advance: the live tick above notices when the current phase's time
  // is up and asks the server to move on — see the module comment for why
  // this lives here instead of a server-side timer.
  useEffect(() => {
    if (!session || session.status !== 'running' || !session.phase_ends_at) return
    const endsAt = new Date(session.phase_ends_at).getTime()
    if (now >= endsAt + 300 && !skipInFlight.current) {
      skipInFlight.current = true
      call('skip', { auto: true }).finally(() => { skipInFlight.current = false })
    }
  }, [now, session])

  if (loading) return <div style={{ color: MUTED, fontFamily: 'Heebo, Arial, sans-serif' }}>טוען...</div>

  const status = session?.status ?? 'idle'
  const phase = session?.current_phase ?? 'idle'
  const isRunningOrPaused = status === 'running' || status === 'paused'

  let secondsLeft: number | null = null
  if (session?.phase_ends_at) secondsLeft = (new Date(session.phase_ends_at).getTime() - now) / 1000
  else if (status === 'paused' && session?.remaining_seconds != null) secondsLeft = session.remaining_seconds

  return (
    <div dir="rtl" style={{ fontFamily: 'Heebo, Arial, sans-serif', color: '#e7e7e0', maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 4px' }}>⏱️ טיימר אינטרוול</h1>
      <p style={{ color: MUTED, margin: '0 0 20px', fontSize: 14 }}>
        קישור להצטרפות חניכים: <code style={{ background: CARD, padding: '2px 8px', borderRadius: 6 }}>tevabike.com/interval/join</code>
      </p>

      {error && (
        <p role="alert" style={{ background: '#3a1414', border: '1px solid #5a2323', color: '#f3a6a6', borderRadius: 10, padding: '10px 14px', fontSize: 14, marginBottom: 16 }}>{error}</p>
      )}

      {/* מצב חי */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20, marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: MUTED, marginBottom: 6 }}>{PHASE_LABEL[phase]}</div>
        <div style={{ fontSize: 56, fontWeight: 900, fontVariantNumeric: 'tabular-nums', direction: 'ltr', color: phase === 'work' ? '#4ade80' : phase === 'rest' ? '#f87171' : '#fff' }}>
          {secondsLeft != null && isRunningOrPaused ? formatTime(secondsLeft) : '—:—'}
        </div>
        {isRunningOrPaused && (
          <div style={{ marginTop: 8, color: MUTED, fontSize: 14 }}>
            חזרה {session?.current_round} מתוך {session?.rounds} {status === 'paused' && '· מושהה ⏸️'}
          </div>
        )}
      </div>

      {/* הגדרות */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <Field label="עבודה (שניות)" value={workSeconds} onChange={setWorkSeconds} disabled={isRunningOrPaused} />
          <Field label="מנוחה (שניות)" value={restSeconds} onChange={setRestSeconds} disabled={isRunningOrPaused} />
          <Field label="מספר חזרות" value={rounds} onChange={setRounds} disabled={isRunningOrPaused} />
        </div>
        {!isRunningOrPaused && (
          <button
            onClick={() => call('configure', { work_seconds: Number(workSeconds), rest_seconds: Number(restSeconds), rounds: Number(rounds) })}
            disabled={busy}
            style={{ marginTop: 14, padding: '10px 16px', borderRadius: 10, border: `1px solid ${BORDER}`, background: '#1c211d', color: '#e7e7e0', fontWeight: 700, cursor: 'pointer' }}
          >
            שמירת הגדרות
          </button>
        )}
      </div>

      {/* כפתורי שליטה */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {status !== 'running' && (
          <BigButton color={ACCENT} dark onClick={() => call(status === 'paused' ? 'resume' : 'start')} disabled={busy}>
            {status === 'paused' ? '▶️ המשך' : '▶️ התחל'}
          </BigButton>
        )}
        {status === 'running' && (
          <BigButton color="#3a3f22" onClick={() => call('pause')} disabled={busy}>⏸️ השהה</BigButton>
        )}
        <BigButton color="#22303f" onClick={() => call('skip')} disabled={busy || status !== 'running'}>⏭️ דלג לשלב הבא</BigButton>
        <BigButton color="#3f2222" onClick={() => call('reset')} disabled={busy || status === 'idle'}>⏹️ איפוס</BigButton>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: MUTED, marginBottom: 6 }}>{label}</span>
      <input
        type="number" min={0} value={value} disabled={disabled}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${BORDER}`, background: disabled ? '#1a1c1a' : '#0d0f0e', color: '#e7e7e0', fontSize: 16 }}
      />
    </label>
  )
}

function BigButton({ children, color, dark, onClick, disabled }: { children: React.ReactNode; color: string; dark?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: '1 1 140px', minHeight: 56, borderRadius: 12, border: 'none',
        background: disabled ? '#2a2f2a' : color, color: dark ? '#0d0f0e' : '#fff',
        fontWeight: 900, fontSize: 16, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
}
