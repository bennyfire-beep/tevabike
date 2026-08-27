import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  appendNote, isPaymentMethod, isPaymentStatus, paymentNote,
  type PaymentMethod,
} from '@/lib/workshop-payment'

// Mark a workshop registration paid (or back to pending) by hand.
//
// Arbox syncs its own payments; PayBox, Bit and bank transfers do not, so a
// coordinator sets those on /admin/coordinator/workshops. The write runs with
// the service role — but only after the caller's own JWT is checked against
// admin_roles, so the elevated key never depends on anything the browser says
// about itself.
//
// The notes line is composed here rather than in the page: the client sends the
// method, the server reads the current notes and appends. Two coordinators
// marking the same person cannot then wipe each other's line.

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('[workshop-payment] SUPABASE_SERVICE_ROLE_KEY or URL not set')
    return NextResponse.json({ error: 'השרת לא מוגדר נכון (חסר מפתח שירות)' }, { status: 500 })
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── 1. The caller must be a signed-in coordinator or admin ──
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const { data: caller, error: callerErr } = await admin.auth.getUser(token)
  if (callerErr || !caller?.user) {
    return NextResponse.json({ error: 'ההזדהות נכשלה, התחבר מחדש' }, { status: 401 })
  }

  // Every row, not .single(): a few people hold two jobs, and .single() errors
  // on exactly those (see lib/roles.ts).
  const { data: roleRows } = await admin
    .from('admin_roles')
    .select('role')
    .eq('user_id', caller.user.id)

  const allowed = (roleRows ?? []).some(r => r.role === 'coordinator' || r.role === 'admin')
  if (!allowed) return NextResponse.json({ error: 'אין לך הרשאה לעדכן תשלומים' }, { status: 403 })

  // ── 2. Input ──
  let body: { id?: string; payment_status?: string; payment_method?: string | null }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }) }

  const id = String(body.id ?? '').trim()
  if (!UUID.test(id)) return NextResponse.json({ error: 'מזהה הרשמה לא תקין' }, { status: 400 })

  const status = body.payment_status
  if (!isPaymentStatus(status)) {
    return NextResponse.json({ error: 'סטטוס תשלום לא תקין' }, { status: 400 })
  }

  // A payment has to say how it arrived — that is the whole point of the note.
  let method: PaymentMethod | null = null
  if (status === 'paid') {
    if (!isPaymentMethod(body.payment_method)) {
      return NextResponse.json({ error: 'אמצעי תשלום לא תקין' }, { status: 400 })
    }
    method = body.payment_method
  }

  // ── 3. Update, appending to notes rather than replacing them ──
  const { data: reg, error: readErr } = await admin
    .from('workshop_registrations')
    .select('id, notes')
    .eq('id', id)
    .maybeSingle()

  if (readErr) {
    console.error('[workshop-payment] read failed:', readErr.message)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
  if (!reg) return NextResponse.json({ error: 'ההרשמה לא נמצאה' }, { status: 404 })

  // Going back to pending changes the status only — the log of what happened
  // stays as it is.
  const patch: { payment_status: string; notes?: string } = { payment_status: status }
  if (method) patch.notes = appendNote(reg.notes, paymentNote(method))

  const { data: updated, error: upErr } = await admin
    .from('workshop_registrations')
    .update(patch)
    .eq('id', id)
    .select('id, payment_status, notes')
    .single()

  if (upErr) {
    console.error('[workshop-payment] update failed:', upErr.message)
    return NextResponse.json({ error: 'עדכון התשלום נכשל' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, registration: updated })
}
