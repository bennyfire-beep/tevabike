import { NextRequest, NextResponse } from 'next/server'
import { adminDb, type AdminDb } from '@/lib/admin-api'
import {
  ACTIVITY_SELECT, ACTIVITY_KIND_META, formatActivityDates, normalizePhone, publicName,
  type Activity, type RiderActivity, type RegistrationStatus,
} from '@/lib/activities'

// פעילויות באפליקציית החניך (/student).
//
// GET  ?riderId=…  → הפעילויות שפורסמו, כמה מקומות נשארו, מי מגיע (רק מי
//                    שבחר להציג שם) וההרשמה של הרוכב עצמו
// POST { action: 'register' | 'visibility' | 'cancel', … }
//
// הקורא מזדהה עם ה-access token של Supabase (התחברות SMS בפורטל החניך).
// riderId חייב להיות רוכב שהטלפון המחובר הוא הטלפון שלו או של ההורה שלו.

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = ['bennyfire@gmail.com', 'talmatoki@gmail.com']
const FROM = 'טבע בייק <info@mail.tevabike.com>'

type Rider = { id: string; full_name: string | null; phone: string | null; parent_phone: string | null }

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status })

// The signed-in phone, and the riders it may act for (own phone or parent's).
async function caller(req: NextRequest, db: AdminDb) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await db.auth.getUser(token)
  const phone = normalizePhone(data?.user?.phone)
  if (error || !phone) return null

  const { data: riders } = await db.from('riders').select('id, full_name, phone, parent_phone')
  const mine = ((riders ?? []) as Rider[]).filter(
    (r) => normalizePhone(r.phone) === phone || normalizePhone(r.parent_phone) === phone,
  )
  return { phone, riders: mine }
}

const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })

// ---------- GET ----------

export async function GET(req: NextRequest) {
  const db = adminDb()
  if (!db) return fail('תקלה בשרת', 500)

  const who = await caller(req, db)
  if (!who) return fail('לא מחובר', 401)
  const riderId = req.nextUrl.searchParams.get('riderId') ?? who.riders[0]?.id
  const rider = who.riders.find((r) => r.id === riderId)
  if (!rider) return fail('הרוכב לא נמצא', 403)

  const today = todayIso()
  const { data: acts, error } = await db
    .from('activities')
    .select(ACTIVITY_SELECT)
    .eq('published', true)
    .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`)
    .order('start_date', { ascending: true })
  if (error) return fail(error.message, 500)

  const activities = (acts ?? []) as Activity[]
  const ids = activities.map((a) => a.id)

  type Reg = { id: string; activity_id: string; rider_id: string; show_name: boolean; status: RegistrationStatus; riders: { full_name: string | null } | null }
  let regs: Reg[] = []
  if (ids.length) {
    const { data } = await db
      .from('activity_registrations')
      .select('id, activity_id, rider_id, show_name, status, riders(full_name)')
      .in('activity_id', ids)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true })
    regs = (data ?? []) as unknown as Reg[]
  }

  const out: RiderActivity[] = activities.map((a) => {
    const live = regs.filter((r) => r.activity_id === a.id)
    const mineReg = live.find((r) => r.rider_id === rider.id)
    const shown = a.show_attendees ? live.filter((r) => r.show_name) : []
    const remaining = a.capacity == null ? null : Math.max(0, a.capacity - live.length)
    return {
      ...a,
      taken: live.length,
      remaining,
      closed: !a.registration_open || remaining === 0,
      attendees: shown.map((r) => publicName(r.riders?.full_name)).filter(Boolean),
      hiddenCount: live.length - shown.length,
      mine: mineReg ? { id: mineReg.id, status: mineReg.status, show_name: mineReg.show_name } : null,
    }
  })

  return NextResponse.json({ ok: true, activities: out }, { headers: { 'Cache-Control': 'no-store' } })
}

// ---------- POST ----------

type Body = {
  action?: 'register' | 'visibility' | 'cancel'
  riderId?: string
  activityId?: string
  showName?: boolean
  parentName?: string
  parentApproved?: boolean
  healthNotes?: string
}

const REGISTER_ERRORS: Record<string, [string, number]> = {
  not_found:          ['הפעילות לא נמצאה', 404],
  closed:             ['ההרשמה לפעילות הזו סגורה', 409],
  full:               ['הפעילות מלאה. התקשרו אלינו לרשימת המתנה: 052-5708084', 409],
  already_registered: ['כבר נרשמת לפעילות הזו', 409],
}

export async function POST(req: NextRequest) {
  const db = adminDb()
  if (!db) return fail('תקלה בשרת', 500)

  const who = await caller(req, db)
  if (!who) return fail('לא מחובר', 401)

  let body: Body
  try { body = await req.json() } catch { return fail('בקשה לא תקינה', 400) }

  const rider = who.riders.find((r) => r.id === body.riderId)
  if (!rider) return fail('הרוכב לא נמצא', 403)
  const activityId = (body.activityId ?? '').trim()
  if (!activityId) return fail('חסרה פעילות', 400)

  if (body.action === 'register') {
    const parentName = (body.parentName ?? '').trim()
    if (!parentName || body.parentApproved !== true)
      return fail('נדרש אישור של ההורה כדי להירשם', 400)
    const healthNotes = (body.healthNotes ?? '').trim().slice(0, 1000) || null
    const byParent = normalizePhone(rider.parent_phone) === who.phone

    const { error } = await db.rpc('register_for_activity', {
      p_activity_id: activityId,
      p_rider_id: rider.id,
      p_show_name: body.showName === true,
      p_parent_name: parentName.slice(0, 120),
      p_submitted_by_phone: who.phone,
      p_submitted_by_parent: byParent,
      p_health_notes: healthNotes,
    })
    if (error) {
      const key = Object.keys(REGISTER_ERRORS).find((k) => error.message.includes(k))
      if (key) return fail(...REGISTER_ERRORS[key])
      console.error('[activities] register failed:', error.message)
      return fail('ההרשמה נכשלה, נסו שוב', 500)
    }

    await notifyAdmins(db, activityId, rider, parentName, byParent)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'visibility' || body.action === 'cancel') {
    const patch = body.action === 'visibility'
      ? { show_name: body.showName === true }
      : { status: 'cancelled', cancelled_at: new Date().toISOString() }

    let q = db.from('activity_registrations').update(patch)
      .eq('activity_id', activityId).eq('rider_id', rider.id)
    // A paid spot is cancelled with the office (refunds go through Arbox).
    q = body.action === 'cancel' ? q.eq('status', 'pending') : q.neq('status', 'cancelled')
    const { data, error } = await q.select('id')
    if (error) return fail(error.message, 500)
    if (!data?.length)
      return fail(body.action === 'cancel' ? 'אפשר לבטל רק הרשמה שעוד לא שולמה. לביטול התקשרו: 052-5708084' : 'ההרשמה לא נמצאה', 409)
    return NextResponse.json({ ok: true })
  }

  return fail('פעולה לא מוכרת', 400)
}

async function notifyAdmins(db: AdminDb, activityId: string, rider: Rider, parentName: string, byParent: boolean) {
  const key = process.env.RESEND_API_KEY
  if (!key) return
  const { data: a } = await db.from('activities').select('title, kind, start_date, end_date, capacity').eq('id', activityId).single()
  if (!a) return
  const { count } = await db.from('activity_registrations')
    .select('id', { count: 'exact', head: true }).eq('activity_id', activityId).neq('status', 'cancelled')
  const esc = (s: string | null | undefined) => (s ?? '').replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif">
    <h2>${ACTIVITY_KIND_META[a.kind as keyof typeof ACTIVITY_KIND_META]?.icon ?? ''} הרשמה חדשה מהאפליקציה: ${esc(a.title)}</h2>
    <p><b>רוכב:</b> ${esc(rider.full_name)}</p>
    <p><b>הורה מאשר:</b> ${esc(parentName)} ${byParent ? '(נשלח מהטלפון של ההורה)' : '(נשלח מהטלפון של הרוכב)'}</p>
    <p><b>תאריכים:</b> ${formatActivityDates(a)}</p>
    <p><b>נרשמים עד כה:</b> ${count ?? 0}${a.capacity ? ` מתוך ${a.capacity}` : ''}</p>
  </div>`
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: ADMIN_EMAILS, subject: `הרשמה חדשה: ${a.title} — ${rider.full_name ?? ''}`, html }),
    })
    if (!res.ok) console.error('[activities] resend failed:', res.status, await res.text())
  } catch (err) {
    console.error('[activities] resend error:', err)
  }
}
