'use server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

// ─── Cookie configuration ─────────────────────────────────────────────────────
const COOKIE_BASE = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path:     '/',
  maxAge:   60 * 60 * 24 * 7,  // 7 days
}

// ─── Session cookies ──────────────────────────────────────────────────────────

/**
 * Called after a successful Supabase admin login.
 * Sets httpOnly cookies that proxy.ts reads for route protection.
 * The access token is the Supabase JWT (already signed by Supabase).
 */
export async function setAdminSession(accessToken: string, role: string): Promise<void> {
  const jar = await cookies()
  jar.set('sb_auth_token', accessToken, COOKIE_BASE)
  jar.set('sb_user_role',  role,        COOKIE_BASE)
}

/**
 * Clears all admin auth cookies. Call on logout.
 */
export async function clearAdminSession(): Promise<void> {
  const jar = await cookies()
  jar.delete('sb_auth_token')
  jar.delete('sb_user_role')
}

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Uses the `rate_limits` table in Supabase (service role bypasses RLS).
// Limits:  OTP send  → 5 per phone per hour
//          Login     → 3 per email per hour, then 1-hour lockout

type RateLimitAction = 'otp' | 'login'

const MAX_ATTEMPTS: Record<RateLimitAction, number> = {
  otp:   5,
  login: 3,
}

const WINDOW_MS  = 60 * 60 * 1000   // 1 hour window
const LOCK_MS    = 60 * 60 * 1000   // 1 hour lockout

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Service role bypasses RLS — required for rate_limits table
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

export type RateLimitResult =
  | { allowed: true;  remainingAttempts: number }
  | { allowed: false; retryAfterSec: number; message: string }

/**
 * Checks and increments the rate limit counter for `identifier` + `action`.
 * Runs server-side only; cannot be spoofed from the browser.
 */
export async function checkRateLimit(
  identifier: string,
  action: RateLimitAction,
): Promise<RateLimitResult> {
  const db  = adminClient()
  const now = new Date()
  const max = MAX_ATTEMPTS[action]

  const { data: row } = await db
    .from('rate_limits')
    .select('*')
    .eq('identifier', identifier)
    .eq('action',     action)
    .maybeSingle()

  // ── Currently locked ────────────────────────────────────────────────────
  if (row?.locked_until && new Date(row.locked_until) > now) {
    const sec = Math.ceil((new Date(row.locked_until).getTime() - now.getTime()) / 1000)
    const mins = Math.ceil(sec / 60)
    return {
      allowed:      false,
      retryAfterSec: sec,
      message:      `נחסמת זמנית. נסה שוב בעוד ${mins} דקות`,
    }
  }

  const windowStart = new Date(now.getTime() - WINDOW_MS).toISOString()
  const windowExpired = !row || new Date(row.window_start) < new Date(windowStart)

  // ── Window expired → reset ───────────────────────────────────────────────
  if (windowExpired) {
    await db.from('rate_limits').upsert(
      { identifier, action, attempts: 1, window_start: now.toISOString(), locked_until: null },
      { onConflict: 'identifier,action' },
    )
    return { allowed: true, remainingAttempts: max - 1 }
  }

  const newAttempts = (row.attempts ?? 0) + 1

  // ── Limit exceeded → lock ────────────────────────────────────────────────
  if (newAttempts > max) {
    const lockedUntil = new Date(now.getTime() + LOCK_MS).toISOString()
    await db.from('rate_limits')
      .update({ attempts: newAttempts, locked_until: lockedUntil })
      .eq('identifier', identifier)
      .eq('action',     action)

    const mins = Math.ceil(LOCK_MS / 60000)
    return {
      allowed:      false,
      retryAfterSec: LOCK_MS / 1000,
      message:      `חרגת ממספר הניסיונות המותר. נחסמת ל-${mins} דקות`,
    }
  }

  // ── Increment ────────────────────────────────────────────────────────────
  await db.from('rate_limits')
    .update({ attempts: newAttempts })
    .eq('identifier', identifier)
    .eq('action',     action)

  return { allowed: true, remainingAttempts: max - newAttempts }
}

/**
 * Resets the rate limit counter after a successful auth (login / OTP verify).
 */
export async function resetRateLimit(
  identifier: string,
  action: RateLimitAction,
): Promise<void> {
  const db = adminClient()
  await db.from('rate_limits')
    .delete()
    .eq('identifier', identifier)
    .eq('action',     action)
}
