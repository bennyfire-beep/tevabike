'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'
import { DEFAULT_HOURLY_RATE } from '@/lib/attendance'
import { computeTravel, travelDetail } from '@/lib/travel'
import { lessonPayConfigOf, lessonRateFor, coTaughtPresent } from '@/lib/lesson-pay'
import { isSalaryAdmin, isBenny } from '@/lib/salary-access'
import { currentMonth, monthBounds } from '@/lib/month'

// ─────────────────────────────────────────────────────────────────────────────
// Monthly pay report (coordinator).
//
// A person's monthly pay is the sum of three kinds of line item:
//   • בסיס חודשי  — staff_pay.monthly_base (once per month, if > 0)
//   • regular sessions   — the instructor's lesson rate: staff_pay.rate_per_lesson
//                          when lesson_pay_model is 'flat', or the low/high band
//                          picked by that session's present_count when it is
//                          'by_attendance' (see lib/lesson-pay.ts)
//   • special activities — duration × the instructor's staff_pay.hourly_rate
//
// Both session rates are read live from staff_pay rather than from the stored
// class_sessions.instructor_pay, so a rate change on /admin/instructors shows
// up here immediately and rows written under the retired pay_rates bracket
// model cannot leak into a current report.
//
// Rows are merged BY NAME, because one person can have two admin_roles rows
// (e.g. a coordinator row carrying monthly_base + an instructor row that teaches
// sessions).
//
// Every session of the month counts, whether or not its register was ever
// saved: an unsaved register means nobody was marked present, so present_count
// reads as 0 — a real figure the by_attendance model prices at the low band,
// not a reason to leave the lesson out of the month. And every instructor
// credited with a session is paid for it in full on their own terms —
// instructor_id plus anyone in instructor_ids, each counted once. Both rules
// match the other pay screens exactly; the numbers have to agree.
// ─────────────────────────────────────────────────────────────────────────────

const BRANCH_COLOR: Record<string, string> = {
  'משגב':  '#b5e853',
  'מצובה': '#81d4fa',
  'ביריה': '#ff8f6b',
  'אמירים': '#c084fc',
}

type Role = {
  id: string; name: string; role: string
  hourly_rate: number | null
  rate_per_lesson: number | null
  lesson_pay_model: string | null
  attendance_rate_low: number | null
  attendance_rate_mid: number | null
  attendance_rate_high: number | null
  attendance_threshold: number | null
  attendance_threshold_2: number | null
  monthly_base: number | null
  travel_type: string | null
  travel_km: number | null
  travel_rate: number | null
  travel_monthly_amount: number | null
}
type SessionRow = {
  id: string
  instructor_id: string | null
  class_name: string
  branch: string | null
  session_date: string
  present_count: number
  // instructor_pay is deliberately absent: the column is revoked from
  // `authenticated`, and every amount here is derived live from staff_pay.
  type: 'regular' | 'special' | null
  activity_name: string | null
  instructor_ids: string[] | null
  duration: number | null
}
type Kind = 'regular' | 'special' | 'base' | 'travel'
type LineItem = {
  key: string
  name: string
  kind: Kind
  label: string
  branch: string | null
  date: string | null
  present: number | null
  pay: number
  // Only set for kind='regular'|'special' — lets the row offer "מחק אימון"
  // for a session opened by mistake. base/travel items aren't real sessions
  // and have nothing to delete.
  sessionId: string | null
}
type PersonGroup = {
  name: string
  items: LineItem[]
  sessionCount: number
  totalPresent: number
  totalPay: number
}
// Taught this month but has no staff_pay row — shown separately, never folded
// into the totals above: there is no rate to price them at.
type NoPayRow = { name: string; sessions: number; present: number }

const currentYm = currentMonth
const ymLabel = (ym: string) =>
  new Date(Number(ym.split('-')[0]), Number(ym.split('-')[1]) - 1, 1)
    .toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
const round2 = (n: number) => Math.round(n * 100) / 100

// רק בני ושיר רואים שכר. תואם ל-is_salary_admin() בבסיס הנתונים.
const SALARY_ADMINS = ['bennyfire@gmail.com', 'shirkobi8@gmail.com']

export default function PayrollPage() {
  const user = useCoordinator()
  const canSeeSalary = isSalaryAdmin(user?.email)
  const canDelete = isBenny(user?.email)
  const [month, setMonth]       = useState(currentYm)
  const [groups, setGroups]     = useState<PersonGroup[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  // Taught this month but has no staff_pay row, so is not in the figures above.
  const [notOnPayroll, setNotOnPayroll] = useState<NoPayRow[]>([])
  const [emailing, setEmailing] = useState(false)
  const [emailMsg, setEmailMsg] = useState('')

  const load = useCallback(async (ym: string) => {
    setLoading(true)
    setEmailMsg('')
    // Both ends come from lib/month.ts, which formats the local date rather
    // than routing it through toISOString(). The old inline version rendered a
    // local midnight as UTC, so east of Greenwich the last day of the month
    // came out one day early and every lesson taught on it fell out of the
    // report.
    const { first, last } = monthBounds(ym)

    // Staff: names, both pay rates and monthly base for every role.
    const [{ data: roles }, { data: pay }] = await Promise.all([
      supabase.from('admin_roles').select('id, name, role'),
      supabase.from('staff_pay').select('admin_role_id, hourly_rate, rate_per_lesson, lesson_pay_model, attendance_rate_low, attendance_rate_mid, attendance_rate_high, attendance_threshold, attendance_threshold_2, monthly_base, travel_type, travel_km, travel_rate, travel_monthly_amount'),
    ])
    const payOf: Record<string, any> = {}
    for (const p of (pay ?? []) as any[]) payOf[p.admin_role_id] = p

    const roleRows = ((roles ?? []) as any[]).map(r => ({
      ...r,
      hourly_rate:           payOf[r.id]?.hourly_rate           ?? null,
      rate_per_lesson:       payOf[r.id]?.rate_per_lesson       ?? null,
      lesson_pay_model:      payOf[r.id]?.lesson_pay_model      ?? null,
      attendance_rate_low:   payOf[r.id]?.attendance_rate_low   ?? null,
      attendance_rate_mid:   payOf[r.id]?.attendance_rate_mid   ?? null,
      attendance_rate_high:  payOf[r.id]?.attendance_rate_high  ?? null,
      attendance_threshold:  payOf[r.id]?.attendance_threshold  ?? null,
      attendance_threshold_2: payOf[r.id]?.attendance_threshold_2 ?? null,
      monthly_base:          payOf[r.id]?.monthly_base          ?? null,
      travel_type:           payOf[r.id]?.travel_type           ?? null,
      travel_km:             payOf[r.id]?.travel_km             ?? null,
      travel_rate:           payOf[r.id]?.travel_rate           ?? null,
      travel_monthly_amount: payOf[r.id]?.travel_monthly_amount ?? null,
    })) as Role[]

    // No staff_pay row at all = not on the payroll. A volunteer, a parent
    // helping out, or someone not set up yet. They are skipped entirely rather
    // than priced at the DEFAULT_ fallback rates (which would invent a wage) or
    // listed at ₪0 (which reads as an unpaid debt). Their names are collected
    // so the screen can say who was left out — an instructor missing from
    // payroll because nobody configured them is a mistake worth seeing.
    const hasPay = new Set(Object.keys(payOf))
    const skipped: Record<string, NoPayRow> = {}

    const nameOf: Record<string, string> = {}
    const rateOf: Record<string, number> = {}       // per hour — special activities
    const lessonCfgOf: Record<string, Role> = {}   // per lesson — flat or banded by attendance
    for (const r of roleRows) {
      nameOf[r.id] = r.name
      rateOf[r.id] = r.hourly_rate == null ? DEFAULT_HOURLY_RATE : Number(r.hourly_rate)
      lessonCfgOf[r.id] = r
    }

    // Every session in the month — an unsaved register is 0 present, not an
    // absent lesson.
    const { data: sessions } = await supabase
      .from('class_sessions')
      .select('id, instructor_id, class_name, branch, session_date, present_count, type, activity_name, instructor_ids, duration')
      .gte('session_date', first)
      .lte('session_date', last)
      .order('session_date')

    // Per-month travel override, typed into the salary report.
    const { data: travelRows } = await supabase
      .from('instructor_travel')
      .select('instructor_id, amount, km, mode')
      .eq('month', ym)
    const overrideOf: Record<string, number> = {}
    const overrideKmOf: Record<string, number> = {}   // manual km, per_km instructors only
    for (const t of travelRows ?? []) {
      overrideOf[t.instructor_id] = Number(t.amount)
      if (t.mode === 'manual_km') overrideKmOf[t.instructor_id] = Number(t.km ?? 0)
    }

    // What the per_km instructors reported themselves, one row per day worked.
    // Absent means "reported nothing" — a reported 0 is a real figure.
    const { data: travelDays } = await supabase
      .from('instructor_travel_days')
      .select('instructor_id, km')
      .gte('travel_date', first)
      .lte('travel_date', last)
    const reportedOf: Record<string, number> = {}
    for (const d of travelDays ?? []) {
      reportedOf[d.instructor_id] = (reportedOf[d.instructor_id] ?? 0) + (Number(d.km) || 0)
    }

    // Distinct dates each instructor actually taught — the basis for per_km travel.
    const workDays: Record<string, Set<string>> = {}

    const items: LineItem[] = []

    // Session line items — one per instructor credited with the session.
    for (const s of (sessions ?? []) as SessionRow[]) {
      // Everyone credited: the lead instructor plus anyone in instructor_ids,
      // each counted once even when they appear in both.
      const allCredited = [...new Set<string>([
        ...(s.instructor_id ? [s.instructor_id] : []),
        ...((s.instructor_ids ?? []) as string[]),
      ])]

      // Anyone with no staff_pay row is not on the payroll and drops out here,
      // before they can produce a line item — counted separately instead, so
      // they show up in their own sub-list rather than vanishing outright.
      const credited = allCredited.filter(iid => {
        if (hasPay.has(iid)) return true
        if (nameOf[iid]) {
          const row = skipped[iid] ?? { name: nameOf[iid], sessions: 0, present: 0 }
          row.sessions++
          row.present += s.present_count ?? 0
          skipped[iid] = row
        }
        return false
      })

      // Record the working day for each of them — this is what per_km travel
      // falls back to when nothing was reported.
      for (const iid of credited) {
        if (!workDays[iid]) workDays[iid] = new Set()
        workDays[iid].add(s.session_date)
      }

      if (s.type === 'special') {
        for (const iid of credited) {
          items.push({
            key: s.id + iid, name: nameOf[iid] ?? 'מדריך לא ידוע', kind: 'special',
            label: s.activity_name ?? s.class_name, branch: s.branch, date: s.session_date,
            present: s.present_count ?? 0, pay: round2(Number(s.duration ?? 0) * (rateOf[iid] ?? DEFAULT_HOURLY_RATE)),
            sessionId: s.id,
          })
        }
      } else {
        // Regular lesson: every credited instructor is paid in full at their own
        // per-lesson rate — flat, or the band this session's attendance falls into.
        const present = s.present_count ?? 0

        // A session nobody is assigned to pays nobody, but is still listed so
        // it is not silently missing from the month. Tested against the full
        // list, not the filtered one: a session whose instructor is off-payroll
        // is genuinely assigned, and must drop out entirely rather than
        // resurface here mislabelled "ללא מדריך".
        if (allCredited.length === 0) {
          items.push({
            key: s.id, name: 'ללא מדריך', kind: 'regular', label: s.class_name,
            branch: s.branch, date: s.session_date, present, pay: 0, sessionId: s.id,
          })
        }

        // Band lookup only — co-taught lessons pay each credited instructor
        // in full, only which band they fall into shifts. Divided by everyone
        // who actually taught (allCredited), not just those on payroll, so an
        // unpaid co-instructor (e.g. Benny) still lightens the paid one's band.
        const bandPresent = coTaughtPresent(present, allCredited.length)
        for (const iid of credited) {
          const cfg  = lessonCfgOf[iid]
          const rate = lessonRateFor(cfg, bandPresent)
          // Show which band was picked — the flat model has only one, so it says nothing.
          const banded = lessonPayConfigOf(cfg).model === 'by_attendance'
          items.push({
            key: s.id + iid,
            name: nameOf[iid] ?? 'מדריך לא ידוע',
            kind: 'regular',
            label: banded ? `${s.class_name} · ₪${rate} (${present} נוכחים)` : s.class_name,
            branch: s.branch, date: s.session_date,
            present,
            pay: rate,
            sessionId: s.id,
          })
        }
      }
    }

    // Monthly base line items (one per admin_roles row with monthly_base > 0).
    // A row with no staff_pay has no base to read anyway; the guard states it.
    for (const r of roleRows) {
      if (!hasPay.has(r.id)) continue
      const base = Number(r.monthly_base ?? 0)
      if (base > 0) {
        items.push({ key: 'base-' + r.id, name: r.name, kind: 'base', label: 'בסיס חודשי', branch: null, date: null, present: null, pay: base, sessionId: null })
      }
    }

    // Travel line items — one per instructor with a non-zero reimbursement.
    // Working days are the distinct dates they actually taught this month.
    for (const r of roleRows) {
      if (!hasPay.has(r.id)) continue
      const days     = workDays[r.id]?.size ?? 0
      const reported = r.id in reportedOf ? Math.round(reportedOf[r.id] * 100) / 100 : null
      const amount   = computeTravel(r, days, overrideOf[r.id] ?? null, reported)
      if (amount > 0) {
        items.push({
          key: 'travel-' + r.id, name: r.name, kind: 'travel',
          label: `נסיעות · ${travelDetail(r, days, overrideKmOf[r.id] ?? null, reported)}`,
          branch: null, date: null, present: null, pay: amount, sessionId: null,
        })
      }
    }

    // Merge by name.
    const map: Record<string, PersonGroup> = {}
    for (const it of items) {
      if (!map[it.name]) map[it.name] = { name: it.name, items: [], sessionCount: 0, totalPresent: 0, totalPay: 0 }
      const g = map[it.name]
      g.items.push(it)
      g.totalPay += it.pay
      // Base pay and travel are not sessions — they must not inflate the count.
      if (it.kind !== 'base' && it.kind !== 'travel') { g.sessionCount++; g.totalPresent += it.present ?? 0 }
    }
    for (const g of Object.values(map)) {
      g.items.sort((a, b) => {
        if (a.kind === 'base' && b.kind !== 'base') return -1
        if (b.kind === 'base' && a.kind !== 'base') return 1
        return (a.date ?? '').localeCompare(b.date ?? '')
      })
      g.totalPay = round2(g.totalPay)
    }

    setGroups(Object.values(map).sort((a, b) => b.totalPay - a.totalPay))
    setNotOnPayroll(Object.values(skipped).sort((a, b) => a.name.localeCompare(b.name, 'he')))
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) return
    load(month)
  }, [user, month, load])

  // Whole-session delete, right from a mispriced line item — for a session
  // opened by mistake (e.g. an instructor tapping the wrong entry on the
  // board). Removes it and its attendance rows entirely, then reloads the
  // month so every affected total (this instructor's, and any co-instructor
  // whose band this session's headcount was feeding into) recomputes.
  const [deletingSession, setDeletingSession] = useState<string | null>(null)
  async function deleteSessionRow(id: string, label: string, date: string | null) {
    // The button is already hidden for anyone but Benny; this guards the
    // function itself in case it's ever called another way. The real
    // enforcement is the class_sessions DELETE RLS policy (is_benny()).
    if (!canDelete) return
    const when = date ? new Date(date + 'T12:00:00').toLocaleDateString('he-IL') : ''
    if (!window.confirm(`למחוק את האימון "${label}" ${when}?\nהפעולה תמחק גם את כל הנוכחות שסומנה בו, ולא ניתן לבטל.`)) return
    setDeletingSession(id)
    await supabase.from('attendance').delete().eq('session_id', id)
    const { error } = await supabase.from('class_sessions').delete().eq('id', id)
    setDeletingSession(null)
    if (error) { alert('מחיקת האימון נכשלה: ' + error.message); return }
    load(month)
  }

  const grandSessions = groups.reduce((s, g) => s + g.sessionCount, 0)
  const grandPresent  = groups.reduce((s, g) => s + g.totalPresent, 0)
  const grandPay      = round2(groups.reduce((s, g) => s + g.totalPay, 0))
  const monthLabel = ymLabel(month)

  async function emailReport() {
    setEmailing(true); setEmailMsg('')
    const payload = {
      month, monthLabel,
      grand: { sessions: grandSessions, present: grandPresent, pay: grandPay },
      groups: groups.map(g => ({
        name: g.name,
        totalSessions: g.sessionCount,
        totalPresent: g.totalPresent,
        totalPay: g.totalPay,
        items: g.items.map(it => ({
          date: it.date, label: it.label,
          isSpecial: it.kind === 'special', isBase: it.kind === 'base',
          present: it.present, pay: it.pay,
        })),
      })),
    }
    try {
      const r = await fetch('/api/payroll/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.ok) {
        setEmailMsg(`✓ הדוח נשלח ל־${(d.recipients ?? []).join(', ') || 'הנמענים'}`)
      } else if (d.reason === 'no_email_service') {
        const lines = groups.map(g => `${g.name}: ₪${g.totalPay.toLocaleString()}`)
        const body = `דוח שכר — ${monthLabel}\n\n${lines.join('\n')}\n\nסה"כ לתשלום: ₪${grandPay.toLocaleString()}`
        window.location.href = `mailto:bennyfire@gmail.com,shirkobi8@gmail.com?subject=${encodeURIComponent('דוח שכר — ' + monthLabel)}&body=${encodeURIComponent(body)}`
        setEmailMsg('שירות המייל אינו מוגדר — נפתח מייל ידני')
      } else {
        setEmailMsg('שגיאה בשליחה: ' + (d.error ?? r.statusText))
      }
    } catch (e) {
      setEmailMsg('שגיאה בשליחה: ' + (e as Error).message)
    } finally {
      setEmailing(false)
    }
  }

  if (!user) return null

  const cell: React.CSSProperties = { padding: '14px 16px', fontSize: 14 }
  const disabledEmail = emailing || loading || groups.length === 0
  if (user && !canSeeSalary) {
    return (
      <div dir="rtl" style={{ padding: 60, textAlign: 'center', color: '#a8a29e' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e7e5e4' }}>אין הרשאה</h1>
        <p style={{ marginTop: 8 }}>דוח השכר זמין להנהלה בלבד.</p>
      </div>
    )
  }


  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      {/* Header + email + month picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>דוח שכר</h2>
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>בסיס חודשי · שיעורים · פעילויות מיוחדות — {monthLabel}</p>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {emailMsg && <span style={{ color: emailMsg.startsWith('✓') ? '#4cdb7a' : '#f9a8d4', fontSize: 12, fontWeight: 600 }}>{emailMsg}</span>}
          <button
            onClick={emailReport}
            disabled={disabledEmail}
            aria-label="שלח את הדוח החודשי למייל"
            style={{ minHeight: 40, background: disabledEmail ? '#2a2233' : '#D4288A', color: disabledEmail ? '#8a7fa5' : '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, fontSize: 13, cursor: disabledEmail ? 'default' : 'pointer', boxShadow: disabledEmail ? 'none' : '0 4px 14px rgba(212,40,138,0.3)' }}
          >
            {emailing ? 'שולח...' : '✉️ שלח דוח למייל'}
          </button>
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            aria-label="בחר חודש"
            style={{ background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 8, color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 13, padding: '8px 12px', outline: 'none' }}
          >
            {Array.from({ length: 12 }, (_, i) => {
              const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
              const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
              return <option key={ym} value={ym}>{ymLabel(ym)}</option>
            })}
          </select>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'אנשי צוות',     value: groups.length,                       color: '#c084fc', icon: '🧑‍🏫' },
          { label: 'פעילויות',      value: grandSessions,                       color: '#81d4fa', icon: '🗓️' },
          { label: 'סה"כ נוכחים',   value: grandPresent,                        color: '#b5e853', icon: '🚵' },
          { label: 'סה"כ לתשלום',   value: `₪${grandPay.toLocaleString()}`,     color: '#4cdb7a', icon: '💰' },
        ].map(c => (
          <div key={c.label} style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontSize: 11, color: '#7a8f7d', marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 120px 40px', padding: '11px 16px', borderBottom: '1px solid #252b27', fontSize: 11, color: '#7a8f7d', fontWeight: 700 }}>
          <span>שם</span><span>פעילויות</span><span>נוכחים</span><span>סה"כ לתשלום</span><span />
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#7a8f7d' }}>טוען...</div>
        ) : groups.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#7a8f7d' }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>💸</div>
            אין נתוני שכר לחודש זה
          </div>
        ) : (
          groups.map((g, gi) => {
            const open = !!expanded[g.name]
            return (
              <div key={g.name} style={{ borderBottom: gi < groups.length - 1 ? '1px solid #1a1e1c' : 'none' }}>
                <button
                  onClick={() => setExpanded(p => ({ ...p, [g.name]: !p[g.name] }))}
                  aria-expanded={open}
                  style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 90px 110px 120px 40px', alignItems: 'center', padding: '14px 16px', background: open ? '#1a1e1c' : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Heebo, Arial, sans-serif', textAlign: 'right', color: '#e8efe9' }}
                >
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{g.name}</span>
                  <span style={{ color: '#81d4fa', fontWeight: 700 }}>{g.sessionCount}</span>
                  <span style={{ color: '#b5e853', fontWeight: 700 }}>{g.totalPresent}</span>
                  <span style={{ color: '#4cdb7a', fontWeight: 900, fontSize: 16 }}>₪{g.totalPay.toLocaleString()}</span>
                  <span aria-hidden="true" style={{ color: '#7a8f7d', fontSize: 14, textAlign: 'center' }}>{open ? '▲' : '▼'}</span>
                </button>

                {open && (
                  <div style={{ background: '#0d0f0e', borderTop: '1px solid #252b27' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px 120px 30px', padding: '9px 16px', fontSize: 11, color: '#5f6f62', fontWeight: 600 }}>
                      <span>תאריך</span><span>פריט</span><span>נוכחים</span><span>תשלום</span><span></span>
                    </div>
                    {g.items.map(it => {
                      // Read once into a local rather than asserting `it.sessionId!`
                      // below — a non-null assertion in a component is exactly what
                      // turned a real null into a white screen once already in this
                      // codebase (see RiderForm's history). TS narrows a const fine;
                      // it doesn't narrow a repeated property access the same way.
                      const sessionId = it.sessionId
                      return (
                      <div key={it.key} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px 120px 30px', ...cell, borderTop: '1px solid #141716', alignItems: 'center' }}>
                        <span style={{ color: '#7a8f7d' }}>{it.date ? new Date(it.date + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }) : '—'}</span>
                        <span>
                          <span style={{ fontWeight: 600 }}>{it.label}</span>
                          {it.kind === 'base'
                            ? <span style={{ marginRight: 6, background: '#f0b90b22', color: '#f0b90b', borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>💼 קבוע</span>
                            : it.kind === 'travel'
                            ? <span style={{ marginRight: 6, background: '#81d4fa22', color: '#81d4fa', borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>🚗 נסיעות</span>
                            : it.kind === 'special'
                              ? <span style={{ marginRight: 6, background: '#c084fc22', color: '#c084fc', borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>★ מיוחדת</span>
                              : it.branch && <span style={{ marginRight: 6, background: (BRANCH_COLOR[it.branch] ?? '#7a8f7d') + '22', color: BRANCH_COLOR[it.branch] ?? '#7a8f7d', borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>{it.branch}</span>}
                        </span>
                        <span style={{ color: '#b5e853' }}>{it.present ?? '—'}</span>
                        <span style={{ color: '#4cdb7a', fontWeight: 700 }}>₪{it.pay.toLocaleString()}</span>
                        <span>
                          {sessionId && canDelete && (
                            <button
                              onClick={() => deleteSessionRow(sessionId, it.label, it.date)}
                              disabled={deletingSession === sessionId}
                              title="מחק אימון זה (נפתח בטעות?)"
                              style={{ background: 'transparent', border: 'none', color: '#ff8080', fontSize: 14, cursor: deletingSession === sessionId ? 'default' : 'pointer', opacity: deletingSession === sessionId ? 0.5 : 1 }}
                            >🗑</button>
                          )}
                        </span>
                      </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* Grand total */}
        {!loading && groups.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 120px 40px', padding: '15px 16px', borderTop: '2px solid #252b27', background: '#1a1e1c', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>סה"כ כללי</span>
            <span style={{ color: '#81d4fa', fontWeight: 800 }}>{grandSessions}</span>
            <span style={{ color: '#b5e853', fontWeight: 800 }}>{grandPresent}</span>
            <span style={{ color: '#4cdb7a', fontWeight: 900, fontSize: 18 }}>₪{grandPay.toLocaleString()}</span>
            <span />
          </div>
        )}
      </div>

      {/* Separate sub-list — never folded into totalPay/grandPay above, because
          there is no rate to price these people at. Not necessarily an error
          (a volunteer has no wage on purpose), but an instructor missing pay
          because nobody configured them is a mistake, and a report that just
          omits them hides it. */}
      {!loading && notOnPayroll.length > 0 && (
        <div style={{ marginTop: 20, background: '#1c140d', border: '1px solid #ff8f6b33', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '13px 16px', borderBottom: '1px solid #ff8f6b22' }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: '#ff8f6b' }}>⚠ מדריכים ללא שכר</span>
            <p style={{ margin: '4px 0 0', color: '#c9a08e', fontSize: 12, lineHeight: 1.7 }}>
              העבירו אימונים החודש אך אין להם הסדר שכר מוגדר (staff_pay) — לא נכללים בסכומים שלמעלה.
              אם זו טעות, אפשר להגדיר להם תעריף במסך המדריכים.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px', padding: '9px 16px', fontSize: 11, color: '#a8887a', fontWeight: 700 }}>
            <span>שם</span><span>פעילויות</span><span>נוכחים</span>
          </div>
          {notOnPayroll.map((r, i) => (
            <div
              key={r.name}
              style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px', padding: '10px 16px', fontSize: 13, borderTop: i === 0 ? 'none' : '1px solid #2a1e15', color: '#e8efe9' }}
            >
              <span style={{ fontWeight: 600 }}>{r.name}</span>
              <span style={{ color: '#81d4fa' }}>{r.sessions}</span>
              <span style={{ color: '#b5e853' }}>{r.present}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
