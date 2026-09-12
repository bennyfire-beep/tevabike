import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { primaryRow } from '@/lib/roles'

// Shared server-side plumbing for /api/interval/* — same service-role client
// pattern as lib/whatsapp-server.ts, but the "who's allowed" check is wider:
// the interval panel is run from the coordinator screen OR the instructor's
// mobile page (see AGENTS' spec — "/admin/coordinator/interval (או גם ל-
// instructor page הקיים)"), so admin/coordinator/instructor all qualify.
// Accountant does not — nothing here is their job.

export function intervalServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export type IntervalAuthResult =
  | { ok: true; caller: { userId: string; email: string } }
  | { ok: false; response: NextResponse }

const ALLOWED_ROLES = ['admin', 'coordinator', 'instructor'] as const

/** Verifies the caller's bearer token belongs to a signed-in admin/coordinator/instructor. */
export async function requireIntervalStaff(req: NextRequest, admin: SupabaseClient): Promise<IntervalAuthResult> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return { ok: false, response: NextResponse.json({ error: 'לא מחובר' }, { status: 401 }) }

  const { data: caller, error: callerErr } = await admin.auth.getUser(token)
  if (callerErr || !caller?.user) {
    return { ok: false, response: NextResponse.json({ error: 'ההזדהות נכשלה, התחבר מחדש' }, { status: 401 }) }
  }

  const { data: roleRows } = await admin
    .from('admin_roles')
    .select('role')
    .eq('user_id', caller.user.id)

  const rows = (roleRows ?? []).filter((r): r is { role: (typeof ALLOWED_ROLES)[number] } =>
    (ALLOWED_ROLES as readonly string[]).includes(r.role))
  if (!primaryRow(rows)) {
    return { ok: false, response: NextResponse.json({ error: 'אין לך הרשאה לשלוט בטיימר' }, { status: 403 }) }
  }

  return { ok: true, caller: { userId: caller.user.id, email: (caller.user.email ?? '').toLowerCase() } }
}

export const INTERVAL_SESSION_ID = '00000000-0000-0000-0000-000000000001'
