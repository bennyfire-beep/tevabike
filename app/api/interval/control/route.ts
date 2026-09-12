import { NextRequest, NextResponse } from 'next/server'
import { intervalServiceClient, requireIntervalStaff, INTERVAL_SESSION_ID } from '@/lib/interval-server'
import { notifyIntervalSubscribers } from '@/lib/interval-notify'

// POST /api/interval/control — the interval-timer state machine. One button
// on the coordinator/instructor panel = one call here. Every call:
//   1. Updates the single interval_sessions row → every open "receiver" screen
//      gets it instantly via Supabase Realtime (see app/interval/receiver).
//   2. On a phase change, also fires a Web Push at interval_subscribers — the
//      part that actually wakes a locked phone in someone's pocket.
//
// There is no server-side clock ticking phase transitions on its own: the
// panel that started the session schedules its own "skip" call for the exact
// moment the current phase ends (see app/admin/coordinator/interval/page.tsx),
// using the authoritative phase_ends_at this route returns. That keeps this
// route itself simple and stateless, at the cost of needing the coordinator's
// tab to stay open for the length of the session — a fair trade since they're
// the one actively running the class from it anyway.

export const dynamic = 'force-dynamic'

type Row = {
  id: string
  status: 'idle' | 'running' | 'paused' | 'finished'
  work_seconds: number
  rest_seconds: number
  rounds: number
  current_round: number
  current_phase: 'idle' | 'work' | 'rest' | 'done'
  phase_ends_at: string | null
  remaining_seconds: number | null
}

type Body = {
  action?: 'configure' | 'start' | 'pause' | 'resume' | 'skip' | 'reset'
  work_seconds?: number
  rest_seconds?: number
  rounds?: number
  /** Set by the panel's own scheduled auto-advance (as opposed to a manual click on "skip"). */
  auto?: boolean
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export async function POST(req: NextRequest) {
  const admin = intervalServiceClient()
  if (!admin) return NextResponse.json({ error: 'השרת לא מוגדר נכון' }, { status: 500 })

  const auth = await requireIntervalStaff(req, admin)
  if (!auth.ok) return auth.response

  let body: Body
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }) }

  const { data: row, error: fetchErr } = await admin
    .from('interval_sessions')
    .select('*')
    .eq('id', INTERVAL_SESSION_ID)
    .single()
  if (fetchErr || !row) {
    return NextResponse.json({ error: 'לא נמצא מצב טיימר' }, { status: 500 })
  }
  const current = row as Row

  let patch: Partial<Row> = {}
  let push: { title: string; body: string; vibrate?: number[] } | null = null

  switch (body.action) {
    case 'configure': {
      if (current.status === 'running' || current.status === 'paused') {
        return NextResponse.json({ error: 'אי אפשר לשנות הגדרות באמצע אימון פעיל — אפסו קודם' }, { status: 409 })
      }
      patch = {
        work_seconds: clampInt(body.work_seconds, 1, 3600, current.work_seconds),
        rest_seconds: clampInt(body.rest_seconds, 0, 3600, current.rest_seconds),
        rounds: clampInt(body.rounds, 1, 200, current.rounds),
        status: 'idle',
        current_round: 0,
        current_phase: 'idle',
        phase_ends_at: null,
        remaining_seconds: null,
      }
      break
    }

    case 'start': {
      if (current.status === 'running') {
        return NextResponse.json({ error: 'האימון כבר פעיל' }, { status: 409 })
      }
      const phaseEndsAt = new Date(Date.now() + current.work_seconds * 1000)
      patch = {
        status: 'running',
        current_round: 1,
        current_phase: 'work',
        phase_ends_at: phaseEndsAt.toISOString(),
        remaining_seconds: null,
      }
      push = {
        title: 'האימון מתחיל! 💪',
        body: `עבודה — ${current.work_seconds} שניות · חזרה 1 מתוך ${current.rounds}`,
        vibrate: [300, 100, 300],
      }
      break
    }

    case 'pause': {
      if (current.status !== 'running') {
        return NextResponse.json({ error: 'אין אימון פעיל להשהות' }, { status: 409 })
      }
      const remaining = current.phase_ends_at
        ? Math.max(0, Math.ceil((new Date(current.phase_ends_at).getTime() - Date.now()) / 1000))
        : 0
      patch = { status: 'paused', phase_ends_at: null, remaining_seconds: remaining }
      break
    }

    case 'resume': {
      if (current.status !== 'paused') {
        return NextResponse.json({ error: 'אין אימון מושהה לחדש' }, { status: 409 })
      }
      const phaseEndsAt = new Date(Date.now() + (current.remaining_seconds ?? 0) * 1000)
      patch = { status: 'running', phase_ends_at: phaseEndsAt.toISOString(), remaining_seconds: null }
      break
    }

    case 'skip': {
      if (current.status !== 'running') {
        return NextResponse.json({ error: 'אין אימון פעיל לדלג בו' }, { status: 409 })
      }
      // An auto-advance call (the panel's own scheduled timeout, not a manual
      // click) can arrive after another tab already advanced the phase — e.g.
      // two coordinator tabs open, both scheduled the same timeout. If the
      // phase currently in the row still has plenty of time left, this call
      // is stale: no-op instead of skipping a second phase early.
      if (body.auto && current.phase_ends_at && new Date(current.phase_ends_at).getTime() > Date.now() + 500) {
        return NextResponse.json({ ok: true, session: current, skipped: false })
      }
      if (current.current_phase === 'work' && current.rest_seconds > 0) {
        patch = {
          current_phase: 'rest',
          phase_ends_at: new Date(Date.now() + current.rest_seconds * 1000).toISOString(),
        }
        push = { title: 'מנוחה 🧊', body: `${current.rest_seconds} שניות מנוחה`, vibrate: [150, 80, 150] }
      } else if (current.current_round >= current.rounds) {
        patch = { status: 'finished', current_phase: 'done', phase_ends_at: null, remaining_seconds: null }
        push = { title: 'סיימת! כל הכבוד 🎉', body: 'האימון הסתיים', vibrate: [400, 100, 400, 100, 400] }
      } else {
        const nextRound = current.current_round + 1
        patch = {
          current_round: nextRound,
          current_phase: 'work',
          phase_ends_at: new Date(Date.now() + current.work_seconds * 1000).toISOString(),
        }
        push = { title: 'עבודה! 💪', body: `חזרה ${nextRound} מתוך ${current.rounds}`, vibrate: [300, 100, 300] }
      }
      break
    }

    case 'reset': {
      patch = { status: 'idle', current_round: 0, current_phase: 'idle', phase_ends_at: null, remaining_seconds: null }
      break
    }

    default:
      return NextResponse.json({ error: 'פעולה לא מוכרת' }, { status: 400 })
  }

  const { data: updated, error: updateErr } = await admin
    .from('interval_sessions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', INTERVAL_SESSION_ID)
    .select('*')
    .single()

  if (updateErr || !updated) {
    console.error('[interval/control] update failed:', updateErr?.message)
    return NextResponse.json({ error: 'העדכון נכשל' }, { status: 500 })
  }

  if (push) await notifyIntervalSubscribers(admin, push)

  return NextResponse.json({ ok: true, session: updated })
}
