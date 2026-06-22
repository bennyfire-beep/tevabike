import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const VALID_ROLES = ['instructor', 'coordinator', 'accountant'] as const
type Role = (typeof VALID_ROLES)[number]

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey)
    return NextResponse.json({ error: 'השרת לא מוגדר נכון (חסר מפתח שירות)' }, { status: 500 })

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── 1. Verify the caller is a logged-in coordinator/admin ──
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const { data: caller, error: callerErr } = await admin.auth.getUser(token)
  if (callerErr || !caller?.user)
    return NextResponse.json({ error: 'ההזדהות נכשלה, התחבר מחדש' }, { status: 401 })

  const { data: callerRole } = await admin
    .from('admin_roles')
    .select('role')
    .eq('user_id', caller.user.id)
    .single()

  if (!callerRole || !['coordinator', 'admin'].includes(callerRole.role))
    return NextResponse.json({ error: 'אין לך הרשאה להוסיף אנשי צוות' }, { status: 403 })

  // ── 2. Parse + validate input ──
  let body: {
    name?: string; email?: string; password?: string
    role?: string; branch?: string | null; hourlyRate?: string | number | null; birthDate?: string | null; idNumber?: string | null; certificateUrl?: string | null
  }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }) }

  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const role = String(body.role || '') as Role
  const branch = body.branch ? String(body.branch).trim() : null
  const hourlyRate =
    body.hourlyRate != null && body.hourlyRate !== '' ? Number(body.hourlyRate) : null
  const birthDate = body.birthDate && String(body.birthDate).trim() !== '' ? String(body.birthDate).trim() : null
  const idNumber = body.idNumber && String(body.idNumber).trim() !== '' ? String(body.idNumber).trim() : null
  const certificateUrl = body.certificateUrl && String(body.certificateUrl).trim() !== '' ? String(body.certificateUrl).trim() : null

  if (!name) return NextResponse.json({ error: 'חסר שם' }, { status: 400 })
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: 'אימייל לא תקין' }, { status: 400 })
  if (password.length < 6)
    return NextResponse.json({ error: 'הסיסמה חייבת להיות לפחות 6 תווים' }, { status: 400 })
  if (!VALID_ROLES.includes(role))
    return NextResponse.json({ error: 'תפקיד לא תקין' }, { status: 400 })

  // ── 3. Create the login (auth user) ──
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })
  if (createErr || !created?.user) {
    const msg = createErr?.message || ''
    if (/already.*registered|already.*exists|been registered/i.test(msg))
      return NextResponse.json({ error: 'כתובת האימייל כבר רשומה במערכת' }, { status: 409 })
    return NextResponse.json({ error: `יצירת המשתמש נכשלה: ${msg}` }, { status: 500 })
  }

  // ── 4. Link the role (admin_roles row) ──
  const { error: roleErr } = await admin.from('admin_roles').insert({
    user_id: created.user.id,
    role,
    name,
    branch: role === 'instructor' ? branch : null,
    hourly_rate: role === 'instructor' ? (hourlyRate ?? 60) : null,
    birth_date: birthDate,
    id_number: idNumber,
    certificate_url: certificateUrl,
  })
  if (roleErr) {
    // Roll back the auth user so we don't leave an orphan login
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {})
    return NextResponse.json({ error: `שמירת התפקיד נכשלה: ${roleErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
