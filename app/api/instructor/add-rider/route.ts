import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/instructor-identity'

// ─────────────────────────────────────────────────────────────────────────────
// A new rider, added by an instructor from the group screen.
//
// An instructor meets a child who turned up to try a lesson. They are not a
// paying member yet and nobody has spoken to the parents, so three things have
// to happen at once:
//
//   1. the rider is created as NOT paying — is_regular = false, plus a note
//      saying who added them and when. Every roster in the system already reads
//      is_regular as "on the regular paying list", so this needs no new column,
//      and the instructor screen tints these riders so it is visible at a
//      glance.
//   2. a lead is opened in "מתעניינים" with status 'new'. That screen orders by
//      created_at descending, so a fresh lead lands at the top of the list on
//      its own.
//   3. one email goes out, to Tal and nobody else.
//
// The whole thing runs with the service role, because `leads` is not writable
// by an ordinary signed-in user and the rider has to land with its group link
// in one go. The caller is verified from their access token first.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

// The one recipient for these alerts. Deliberately not the general
// bennyfire@gmail.com list the other routes use.
const TAL_EMAIL = 'talmatoki@gmail.com'

const MAX_NAME = 100
const MAX_PHONE = 30
const MAX_TEXT = 500

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, max)
  return s.length ? s : null
}

/** Best-effort alert. A failure here must never lose the rider. */
async function notifyTal(info: {
  riderName: string
  parentName: string | null
  parentPhone: string
  groupName: string
  branch: string | null
  instructor: string
  notes: string | null
}) {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[instructor/add-rider] RESEND_API_KEY not set — rider and lead saved, no email sent.')
    return
  }

  const rows = [
    ['חניך', info.riderName],
    ['הורה', info.parentName ?? '—'],
    ['טלפון הורה', info.parentPhone],
    ['קבוצה', info.groupName],
    ['סניף', info.branch ?? '—'],
    ['נוסף על ידי', info.instructor],
    ['הערות', info.notes ?? '—'],
  ]
    .map(([k, v]) => `<tr><td style="padding:6px 12px;font-weight:700">${k}</td><td style="padding:6px 12px">${v}</td></tr>`)
    .join('')

  const wa = info.parentPhone.replace(/\D/g, '').replace(/^0/, '972')

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Teva Bike <leads@mail.tevabike.com>',
        to: [TAL_EMAIL],
        subject: `חניך חדש (לא משלם) — ${info.riderName} · ${info.groupName}`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif">
          <h2 style="margin:0 0 6px">🚵 חניך חדש נוסף על ידי מדריך</h2>
          <p style="margin:0 0 14px;color:#666;font-size:14px">
            החניך נוצר <b>ללא סטטוס משלם</b> ונפתח עבורו ליד ב"מתעניינים".
          </p>
          <table style="border-collapse:collapse;font-size:15px">${rows}</table>
          <p style="margin-top:16px">
            <a href="https://wa.me/${wa}"
               style="background:#25D366;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700">
              פתיחת וואטסאפ עם ההורה
            </a>
          </p>
        </div>`,
      }),
    })
  } catch (e) {
    console.error('[instructor/add-rider] notification failed (rider was still saved):', e)
  }
}

export async function POST(req: NextRequest) {
  const auth = await resolveCaller(req.headers.get('authorization'))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { db, name: instructorName } = auth.identity

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }) }

  const fullName    = clean(body.full_name, MAX_NAME)
  const parentName  = clean(body.parent_name, MAX_NAME)
  const parentPhone = clean(body.parent_phone, MAX_PHONE)
  const groupId     = clean(body.group_id, 64)

  if (!fullName)    return NextResponse.json({ error: 'שם החניך הוא שדה חובה' }, { status: 400 })
  if (!parentName)  return NextResponse.json({ error: 'שם ההורה הוא שדה חובה' }, { status: 400 })
  if (!parentPhone) return NextResponse.json({ error: 'טלפון הורה הוא שדה חובה' }, { status: 400 })
  if (!groupId)     return NextResponse.json({ error: 'חסרה קבוצה' }, { status: 400 })

  const { data: group } = await db
    .from('groups')
    .select('id, name, branch')
    .eq('id', groupId)
    .maybeSingle()
  if (!group) return NextResponse.json({ error: 'הקבוצה לא נמצאה' }, { status: 404 })

  const ageRaw = body.age
  const age = typeof ageRaw === 'number' ? ageRaw
            : typeof ageRaw === 'string' && ageRaw.trim() !== '' ? Number(ageRaw)
            : null

  const today = new Date().toISOString().split('T')[0]
  const ownNotes = clean(body.notes, MAX_TEXT)
  const marker = `נוסף ע״י ${instructorName} ב־${today} — טרם שולם`
  const notes = ownNotes ? `${ownNotes} · ${marker}` : marker

  // ── 1. The rider, explicitly not on the paying roster ─────────────────────
  const { data: rider, error: riderErr } = await db
    .from('riders')
    .insert({
      full_name:    fullName,
      parent_name:  parentName,
      parent_phone: parentPhone,
      phone:        clean(body.phone, MAX_PHONE),
      email:        clean(body.email, MAX_NAME),
      age:          Number.isFinite(age) ? age : null,
      bike_type:    clean(body.bike_type, MAX_NAME),
      notes,
      group_id:     group.id,
      group_name:   group.name,
      branch:       group.branch,
      is_regular:   false,   // ← not a paying member yet
      active:       true,
    })
    .select('id, full_name, phone, parent_phone, is_regular')
    .single()

  if (riderErr || !rider) {
    console.error('[instructor/add-rider] rider insert failed:', riderErr?.message)
    return NextResponse.json({ error: riderErr?.message ?? 'שמירת החניך נכשלה' }, { status: 500 })
  }

  // ── 2. Group membership, so they show up on the register straight away ────
  const { error: linkErr } = await db
    .from('rider_groups')
    .insert({ rider_id: rider.id, group_id: group.id })
  if (linkErr) {
    // The rider exists and carries group_id/group_name, so the register still
    // finds them through the legacy path. Worth a log, not worth a failure.
    console.error('[instructor/add-rider] rider_groups link failed:', linkErr.message)
  }

  // ── 3. The lead, at the top of "מתעניינים" ────────────────────────────────
  const { error: leadErr } = await db.from('leads').insert({
    full_name: fullName,
    phone:     parentPhone,
    interest:  'חוג רכיבה — ילדים או מבוגרים',
    branch:    group.branch,
    source:    'instructor',
    status:    'new',
    message:   `חניך חדש שנוסף בשטח ע״י ${instructorName} לקבוצת ${group.name}. טרם שולם — צריך יצירת קשר עם ההורים.`,
  })
  if (leadErr) console.error('[instructor/add-rider] lead insert failed:', leadErr.message)

  // ── 4. One email, to Tal ──────────────────────────────────────────────────
  await notifyTal({
    riderName: fullName,
    parentName,
    parentPhone,
    groupName: group.name,
    branch: group.branch,
    instructor: instructorName,
    notes: ownNotes,
  })

  return NextResponse.json({ ok: true, rider, leadOpened: !leadErr })
}
