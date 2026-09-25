// lib/admin-api.ts — עזרים לראוטים של פאנל הניהול: לקוח Supabase עם
// service role, ובדיקה שהקורא הוא רכז/אדמין מחובר (לפי Bearer token).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export type AdminDb = NonNullable<ReturnType<typeof adminDb>>

// מחזיר null אם הקורא רכז/אדמין, אחרת תשובת שגיאה להחזיר כמו שהיא.
export async function requireCoordinator(req: NextRequest, db: AdminDb) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return NextResponse.json({ ok: false, error: 'לא מחובר' }, { status: 401 })

  const { data: caller, error } = await db.auth.getUser(token)
  if (error || !caller?.user)
    return NextResponse.json({ ok: false, error: 'ההזדהות נכשלה, התחבר מחדש' }, { status: 401 })

  // admin_roles היא שורה לכל תפקיד — בודקים אם אחד מהם מתאים
  const { data: roleRows } = await db.from('admin_roles').select('role').eq('user_id', caller.user.id)
  const roles = ((roleRows ?? []) as Array<{ role?: string }>).map((r) => r.role)
  if (!roles.some((r) => r === 'coordinator' || r === 'admin'))
    return NextResponse.json({ ok: false, error: 'אין לך הרשאה לפעולה הזו' }, { status: 403 })

  return null
}
