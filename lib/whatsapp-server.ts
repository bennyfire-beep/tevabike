import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { primaryRow, type AdminRole } from '@/lib/roles'

// Shared server-side plumbing for the /api/whatsapp/* and /api/push/* routes:
// the same service-role client, and the same "caller must be a signed-in
// coordinator or admin" check used by app/api/workshop-payment/route.ts —
// enriched with the caller's own identity, since assignment, the sent-by
// signature, and push all need to know who is actually asking.

export function whatsappServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export type Caller = {
  userId: string
  email: string
  /** Their admin_roles row's display name, for the "— טל" signature and the team picker. */
  name: string
  /** Their strongest role — admin outranks coordinator (see lib/roles.ts). */
  role: AdminRole
}

export type AuthResult =
  | { ok: true; caller: Caller }
  | { ok: false; response: NextResponse }

/** Verifies the caller's bearer token belongs to a signed-in coordinator or admin. */
export async function requireCoordinator(req: NextRequest, admin: SupabaseClient): Promise<AuthResult> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return { ok: false, response: NextResponse.json({ error: 'לא מחובר' }, { status: 401 }) }

  const { data: caller, error: callerErr } = await admin.auth.getUser(token)
  if (callerErr || !caller?.user) {
    return { ok: false, response: NextResponse.json({ error: 'ההזדהות נכשלה, התחבר מחדש' }, { status: 401 }) }
  }

  const { data: roleRows } = await admin
    .from('admin_roles')
    .select('role, name')
    .eq('user_id', caller.user.id)

  const rows = (roleRows ?? []).filter((r): r is { role: 'admin' | 'coordinator'; name: string } =>
    r.role === 'coordinator' || r.role === 'admin')
  const winner = primaryRow(rows)
  if (!winner) {
    return { ok: false, response: NextResponse.json({ error: 'אין לך הרשאה לצפות בוואטסאפ' }, { status: 403 }) }
  }

  return {
    ok: true,
    caller: {
      userId: caller.user.id,
      email: (caller.user.email ?? '').toLowerCase(),
      name: winner.name,
      role: winner.role,
    },
  }
}

/**
 * The assignment rule, applied everywhere a conversation is read or acted on:
 * admin sees/acts on everything; a coordinator only on her own assigned
 * conversations and anything unassigned. Mirrors the whatsapp_conversations
 * RLS policy in supabase/migrations/20260828_whatsapp_push_and_assignment.sql
 * — this is the real enforcement, that policy is the backstop.
 */
export function canAccessConversation(caller: Caller, assignedTo: string | null): boolean {
  if (caller.role === 'admin') return true
  return assignedTo === null || assignedTo.toLowerCase() === caller.email
}
