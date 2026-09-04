import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isSalaryAdmin } from '@/lib/salary-access'

// ─────────────────────────────────────────────────────────────────────────────
// The manual pay amount for one special activity — class_sessions.instructor_pay.
//
// A special activity (מחנה, סדנה) is normally priced live at duration ×
// staff_pay.hourly_rate (lib/attendance.ts, the payroll screens). That formula
// doesn't always match what actually gets paid for a one-off — an evening
// workshop at a flat ₪400, say — so this is where a salary admin overrides it
// per activity.
//
// Only Benny and Shir (lib/salary-access.ts) may read or write it. The column
// is revoked from `authenticated`/`anon` entirely
// (supabase/migrations/20260820_lock_down_salary_data.sql), so nobody's anon-key
// session can touch it regardless of what the UI shows — this route runs on
// the service role and checks the caller's own JWT first, the same shape as
// /api/workshop-payment.
//
// Scoped to type='special' rows only: a regular lesson's pay is always the
// live lesson-rate calculation and has no stored override.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_AMOUNT = 100000

type Admin = SupabaseClient

function serviceClient(): Admin | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function requireSalaryAdmin(req: NextRequest, admin: Admin) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return { ok: false as const, status: 401, error: 'לא מחובר' }

  const { data: caller, error } = await admin.auth.getUser(token)
  if (error || !caller?.user) return { ok: false as const, status: 401, error: 'ההזדהות נכשלה, התחבר/י מחדש' }

  if (!isSalaryAdmin(caller.user.email)) {
    return { ok: false as const, status: 403, error: 'רק בני או שיר יכולים לצפות בסכום הזה או לערוך אותו' }
  }
  return { ok: true as const }
}

export async function GET(req: NextRequest) {
  const admin = serviceClient()
  if (!admin) {
    console.error('[special-activity-pay] SUPABASE_SERVICE_ROLE_KEY or URL not set')
    return NextResponse.json({ error: 'השרת לא מוגדר נכון (חסר מפתח שירות)' }, { status: 500 })
  }

  const auth = await requireSalaryAdmin(req, admin)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sessionId = (req.nextUrl.searchParams.get('session_id') ?? '').trim()
  if (!UUID.test(sessionId)) return NextResponse.json({ error: 'מזהה פעילות לא תקין' }, { status: 400 })

  const { data: session, error } = await admin
    .from('class_sessions')
    .select('id, type, instructor_pay')
    .eq('id', sessionId)
    .maybeSingle()

  if (error) {
    console.error('[special-activity-pay] read failed:', error.message)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
  if (!session) return NextResponse.json({ error: 'הפעילות לא נמצאה' }, { status: 404 })
  if (session.type !== 'special') {
    return NextResponse.json({ error: 'שדה הסכום קיים רק לפעילויות מיוחדות' }, { status: 400 })
  }

  return NextResponse.json({ amount: session.instructor_pay })
}

export async function POST(req: NextRequest) {
  const admin = serviceClient()
  if (!admin) {
    console.error('[special-activity-pay] SUPABASE_SERVICE_ROLE_KEY or URL not set')
    return NextResponse.json({ error: 'השרת לא מוגדר נכון (חסר מפתח שירות)' }, { status: 500 })
  }

  const auth = await requireSalaryAdmin(req, admin)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: { session_id?: string; amount?: number | string | null }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }) }

  const sessionId = String(body.session_id ?? '').trim()
  if (!UUID.test(sessionId)) return NextResponse.json({ error: 'מזהה פעילות לא תקין' }, { status: 400 })

  // Empty/null clears the override back to "not set" — the live formula
  // takes over again rather than being stuck at a stale ₪0.
  let amount: number | null = null
  if (body.amount !== null && body.amount !== undefined && body.amount !== '') {
    const n = Number(body.amount)
    if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) {
      return NextResponse.json({ error: `סכום לא תקין (0–${MAX_AMOUNT})` }, { status: 400 })
    }
    amount = Math.round(n * 100) / 100
  }

  const { data: session, error: readErr } = await admin
    .from('class_sessions')
    .select('id, type')
    .eq('id', sessionId)
    .maybeSingle()
  if (readErr) {
    console.error('[special-activity-pay] read failed:', readErr.message)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
  if (!session) return NextResponse.json({ error: 'הפעילות לא נמצאה' }, { status: 404 })
  if (session.type !== 'special') {
    return NextResponse.json({ error: 'שדה הסכום קיים רק לפעילויות מיוחדות' }, { status: 400 })
  }

  const { error: upErr } = await admin
    .from('class_sessions')
    .update({ instructor_pay: amount })
    .eq('id', sessionId)

  if (upErr) {
    console.error('[special-activity-pay] update failed:', upErr.message)
    return NextResponse.json({ error: 'שמירת הסכום נכשלה' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, amount })
}
