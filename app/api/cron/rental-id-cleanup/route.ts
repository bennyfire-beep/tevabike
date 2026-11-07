import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ID_PHOTO_RETENTION_DAYS } from '@/lib/rental'

// רץ פעם ביום דרך Vercel Cron (vercel.json).
// מוחק צילומי תעודת זהות של השכרות סגורות (הוחזרו / בוטלו) שעברו
// ID_PHOTO_RETENTION_DAYS ימים ממועד ההשכרה — כפי שמובטח לשוכר בהסכם (סעיף 8).
// השכרות שעדיין פתוחות (ממתין / שולם / נמסר) לא נוגעים בהן: ייתכן שיש חוב
// או מחלוקת, והצילום נדרש לזיהוי.

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  // Fail closed, like the other cron routes: no secret, no run.
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[rental-id-cleanup] CRON_SECRET is not set — refusing to run.')
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const cutoff = new Date(Date.now() - ID_PHOTO_RETENTION_DAYS * 86400000)
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })

  const { data: rows, error } = await db
    .from('rental_bookings')
    .select('id, id_photo_path')
    .not('id_photo_path', 'is', null)
    .in('status', ['returned', 'cancelled'])
    .lt('rent_date', cutoff)
    .limit(200)
  if (error) {
    console.error('[rental-id-cleanup] select failed:', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  let deleted = 0
  for (const r of rows ?? []) {
    const { error: rmErr } = await db.storage.from('rental-contracts').remove([r.id_photo_path as string])
    if (rmErr) {
      console.error('[rental-id-cleanup] remove failed', r.id, rmErr)
      continue
    }
    await db
      .from('rental_bookings')
      .update({ id_photo_path: null, id_photo_deleted_at: new Date().toISOString() })
      .eq('id', r.id)
    deleted++
  }

  return NextResponse.json({ ok: true, cutoff, deleted })
}
