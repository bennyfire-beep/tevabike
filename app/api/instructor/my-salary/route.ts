import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller, currentMonth, monthBounds } from '@/lib/instructor-identity'
import { DEFAULT_HOURLY_RATE } from '@/lib/attendance'
import { computeTravel, travelDetail } from '@/lib/travel'
import { lessonPayConfigOf, lessonRateFor } from '@/lib/lesson-pay'

// ─────────────────────────────────────────────────────────────────────────────
// "המשכורת שלי" — this month's pay for the signed-in instructor, and nobody
// else's.
//
// The arithmetic is the same as /admin/coordinator/payroll, item for item, so
// an instructor's own figure and the management report cannot disagree:
//
//   • בסיס חודשי        — staff_pay.monthly_base, once, when it is > 0
//   • שיעור רגיל         — lessonRateFor(): the flat rate, or the low/high band
//                          that this lesson's present_count falls into
//                          (lib/lesson-pay.ts — up to threshold-1 → low,
//                           threshold and above → high; 9 by default)
//   • פעילות מיוחדת      — duration × staff_pay.hourly_rate
//   • נסיעות             — computeTravel() (lib/travel.ts): manual monthly
//                          override, else self-reported km × rate, else
//                          working days × standing km × rate
//
// Every session the instructor is credited with counts in full, whether they
// led it (instructor_id) or co-taught it (instructor_ids), and whether or not
// the register was ever saved — an unsaved register is 0 present, which the
// by_attendance model prices at the low band.
//
// Security: staff_pay, instructor_travel and instructor_travel_days are
// salary-admin-only under RLS and stay that way. This route reads them with the
// service role, and the instructor whose rows it reads comes from the verified
// access token via resolveCaller() — the request never names an instructor.
// Unlike the coordinator report this does NOT merge rows by name: only the one
// admin_roles row belonging to this user is ever read.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

type Kind = 'base' | 'regular' | 'special' | 'travel'

type LineItem = {
  key: string
  kind: Kind
  label: string
  branch: string | null
  date: string | null
  present: number | null
  pay: number
}

type SessionRow = {
  id: string
  class_name: string | null
  activity_name: string | null
  branch: string | null
  session_date: string
  present_count: number | null
  duration: number | null
  type: 'regular' | 'special' | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

export async function GET(req: NextRequest) {
  const auth = await resolveCaller(req.headers.get('authorization'), 'instructor')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { db, adminRoleId, name } = auth.identity

  // The month is the server's, not the caller's — nothing to tamper with.
  const month = currentMonth()
  const { first, last } = monthBounds(month)

  const credited = `instructor_id.eq.${adminRoleId},instructor_ids.cs.{${adminRoleId}}`

  const [payRes, sessRes, travelRes, daysRes] = await Promise.all([
    db.from('staff_pay')
      .select('hourly_rate, rate_per_lesson, lesson_pay_model, attendance_rate_low, attendance_rate_high, attendance_threshold, monthly_base, travel_type, travel_km, travel_rate, travel_monthly_amount')
      .eq('admin_role_id', adminRoleId)
      .maybeSingle(),
    db.from('class_sessions')
      .select('id, class_name, activity_name, branch, session_date, present_count, duration, type')
      .or(credited)
      .gte('session_date', first)
      .lte('session_date', last)
      .order('session_date'),
    db.from('instructor_travel')
      .select('amount, km, mode')
      .eq('instructor_id', adminRoleId)
      .eq('month', month)
      .maybeSingle(),
    db.from('instructor_travel_days')
      .select('km')
      .eq('instructor_id', adminRoleId)
      .gte('travel_date', first)
      .lte('travel_date', last),
  ])

  if (sessRes.error) {
    console.error('[instructor/my-salary] class_sessions query failed:', sessRes.error.message)
    return NextResponse.json({ error: 'שגיאה בטעינת השיעורים' }, { status: 500 })
  }

  const pay      = payRes.data ?? null
  const sessions = (sessRes.data ?? []) as SessionRow[]

  // No staff_pay row at all means this instructor is not on the payroll — a
  // volunteer, a parent helping out, someone not set up yet. Answering with a
  // priced report built on the DEFAULT_ rates would invent a wage nobody
  // agreed to, and answering ₪0 would read as "you earned nothing this month".
  // Say plainly that there is no pay arrangement instead, and let the screen
  // phrase it.
  if (!pay) {
    return NextResponse.json({
      month,
      name,
      hasPay: false,
      items: [],
      lessonCount: sessions.filter(s => s.type !== 'special').length,
      specialCount: sessions.filter(s => s.type === 'special').length,
      workDays: new Set(sessions.map(s => s.session_date)).size,
      totalPresent: sessions.reduce((sum, s) => sum + Number(s.present_count ?? 0), 0),
      total: 0,
      payModel: lessonPayConfigOf(null),
    })
  }

  const hourly   = pay.hourly_rate == null ? DEFAULT_HOURLY_RATE : Number(pay.hourly_rate)
  const banded   = lessonPayConfigOf(pay).model === 'by_attendance'

  const items: LineItem[] = []

  // ── בסיס חודשי ────────────────────────────────────────────────────────────
  const base = Number(pay?.monthly_base ?? 0)
  if (base > 0) {
    items.push({ key: 'base', kind: 'base', label: 'בסיס חודשי', branch: null, date: null, present: null, pay: round2(base) })
  }

  // ── שיעורים ופעילויות ─────────────────────────────────────────────────────
  const workDays = new Set<string>()
  let lessonCount = 0
  let specialCount = 0

  for (const s of sessions) {
    workDays.add(s.session_date)
    const present = Number(s.present_count ?? 0)

    if (s.type === 'special') {
      specialCount++
      const hours = Number(s.duration ?? 0)
      items.push({
        key: 'sp-' + s.id,
        kind: 'special',
        label: `${s.activity_name ?? s.class_name ?? 'פעילות מיוחדת'} · ${hours} ש׳ × ₪${hourly}`,
        branch: s.branch,
        date: s.session_date,
        present,
        pay: round2(hours * hourly),
      })
    } else {
      lessonCount++
      const rate = lessonRateFor(pay, present)
      items.push({
        key: 'ls-' + s.id,
        kind: 'regular',
        // The band only means something under the by_attendance model; the flat
        // model has a single rate, so saying "(N present)" there would mislead.
        label: banded ? `${s.class_name ?? 'שיעור'} · ₪${rate} (${present} נוכחים)` : (s.class_name ?? 'שיעור'),
        branch: s.branch,
        date: s.session_date,
        present,
        pay: round2(rate),
      })
    }
  }

  // ── נסיעות ────────────────────────────────────────────────────────────────
  const travelRow  = travelRes.data ?? null
  const override   = travelRow?.amount == null ? null : Number(travelRow.amount)
  const overrideKm = travelRow?.mode === 'manual_km' ? Number(travelRow.km ?? 0) : null

  // Absent from instructor_travel_days means "reported nothing this month";
  // a reported 0 is a real figure, so an empty array is not the same as none.
  const dayRows    = (daysRes.data ?? []) as Array<{ km: number | null }>
  const reportedKm = dayRows.length === 0
    ? null
    : round2(dayRows.reduce((sum, d) => sum + (Number(d.km) || 0), 0))

  const travelPay = computeTravel(pay, workDays.size, override, reportedKm)
  if (travelPay > 0) {
    items.push({
      key: 'travel',
      kind: 'travel',
      label: `נסיעות · ${travelDetail(pay, workDays.size, overrideKm, reportedKm)}`,
      branch: null, date: null, present: null,
      pay: round2(travelPay),
    })
  }

  items.sort((a, b) => {
    if (a.kind === 'base' && b.kind !== 'base') return -1
    if (b.kind === 'base' && a.kind !== 'base') return 1
    return (a.date ?? '').localeCompare(b.date ?? '')
  })

  const total = round2(items.reduce((sum, it) => sum + it.pay, 0))

  return NextResponse.json({
    month,
    name,
    hasPay: true,
    items,
    lessonCount,
    specialCount,
    workDays: workDays.size,
    totalPresent: sessions.reduce((sum, s) => sum + Number(s.present_count ?? 0), 0),
    total,
    // Enough for the screen to explain the by_attendance bands; no other
    // instructor's numbers are involved.
    payModel: lessonPayConfigOf(pay),
  })
}
