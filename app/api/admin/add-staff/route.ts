import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  DEFAULT_ATTENDANCE_RATE_LOW, DEFAULT_ATTENDANCE_RATE_HIGH, DEFAULT_ATTENDANCE_THRESHOLD,
} from '@/lib/lesson-pay'

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

  // All of their rows: admin_roles is one per job and some people hold several.
  // `.single()` errors on two matches, so a coordinator who also instructs was
  // refused permission they actually held. Holding an extra role must never
  // take one away — the test is "is coordinator or admin among their roles".
  const { data: callerRoles } = await admin
    .from('admin_roles')
    .select('role')
    .eq('user_id', caller.user.id)

  const roles = (callerRoles ?? []).map(r => r.role)
  if (!roles.some(r => r === 'coordinator' || r === 'admin'))
    return NextResponse.json({ error: 'אין לך הרשאה להוסיף אנשי צוות' }, { status: 403 })

  // ── 2. Parse + validate input ──
  let body: {
    name?: string; email?: string; password?: string
    role?: string; branch?: string | null
    // Two rate shapes, because two screens feed this route: /admin/instructors
    // sets a per-lesson rate, the older coordinator staff screen an hourly one.
    ratePerLesson?: string | number | null
    hourlyRate?: string | number | null
    // Lesson pay model, set on /admin/instructors.
    lessonModel?: string | null
    attLow?: string | number | null
    attMid?: string | number | null
    attHigh?: string | number | null
    attThreshold?: string | number | null
    attThreshold2?: string | number | null
    // Travel arrangement, set on /admin/instructors.
    travelType?: string | null
    travelKm?: string | number | null
    travelRate?: string | number | null
    travelMonthly?: string | number | null
  }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }) }

  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const role = String(body.role || '') as Role
  const branch = body.branch ? String(body.branch).trim() : null
  const ratePerLesson =
    body.ratePerLesson != null && body.ratePerLesson !== '' ? Number(body.ratePerLesson) : 150
  const hourlyRate =
    body.hourlyRate != null && body.hourlyRate !== '' ? Number(body.hourlyRate) : null

  const num = (v: unknown) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : 0)
  const numOr = (v: unknown, d: number) =>
    v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d

  // Lesson pay: a flat rate per lesson, or bands by attendance (2 or 3 tiers).
  // The bands are stored either way, so switching model later is one click.
  // Mid/threshold2 stay null unless both were actually sent — a null mid rate
  // is what keeps lessonPayConfigOf on the plain 2-tier model.
  const lessonModel = body.lessonModel === 'by_attendance' ? 'by_attendance' : 'flat'
  const attLow      = numOr(body.attLow,       DEFAULT_ATTENDANCE_RATE_LOW)
  const attHigh     = numOr(body.attHigh,      DEFAULT_ATTENDANCE_RATE_HIGH)
  const attThresh   = numOr(body.attThreshold, DEFAULT_ATTENDANCE_THRESHOLD)
  const attMid      = body.attMid      != null && body.attMid      !== '' ? Number(body.attMid)      : null
  const attThresh2  = body.attThreshold2 != null && body.attThreshold2 !== '' ? Number(body.attThreshold2) : null
  const travelType = ['per_km', 'none', 'monthly_fixed'].includes(String(body.travelType))
    ? String(body.travelType)
    : 'none'
  // Only keep the fields the chosen arrangement actually uses.
  const travelKm      = travelType === 'per_km'        ? num(body.travelKm)      : 0
  const travelRate    = travelType === 'per_km'        ? num(body.travelRate)    : 0
  const travelMonthly = travelType === 'monthly_fixed' ? num(body.travelMonthly) : 0

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
  // Pay lives in staff_pay, not here — admin_roles has no rate column.
  const { data: roleRow, error: roleErr } = await admin
    .from('admin_roles')
    .insert({
      user_id: created.user.id,
      role,
      name,
      branch: role === 'instructor' ? branch : null,
    })
    .select('id')
    .single()

  if (roleErr || !roleRow) {
    // Roll back the auth user so we don't leave an orphan login
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {})
    return NextResponse.json({ error: `שמירת התפקיד נכשלה: ${roleErr?.message ?? ''}` }, { status: 500 })
  }

  // ── 5. Per-lesson rate for instructors ──
  if (role === 'instructor') {
    const { error: payErr } = await admin
      .from('staff_pay')
      .upsert(
        {
          admin_role_id: roleRow.id,
          lesson_pay_model: lessonModel,
          rate_per_lesson: ratePerLesson,
          attendance_rate_low: attLow,
          attendance_rate_mid: attMid,
          attendance_rate_high: attHigh,
          attendance_threshold: attThresh,
          attendance_threshold_2: attThresh2,
          ...(hourlyRate !== null ? { hourly_rate: hourlyRate } : {}),
          travel_type: travelType,
          travel_km: travelKm,
          travel_rate: travelRate,
          travel_monthly_amount: travelMonthly,
        },
        { onConflict: 'admin_role_id' },
      )

    // The instructor exists and can log in either way — surface the pay problem
    // without rolling the whole thing back.
    if (payErr)
      return NextResponse.json(
        { success: true, warning: `המדריך נוצר אך שמירת התעריף נכשלה: ${payErr.message}` },
      )
  }

  return NextResponse.json({ success: true })
}
