'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminAuth } from '@/lib/use-admin-auth'
import { DEFAULT_HOURLY_RATE, DEFAULT_RATE_PER_LESSON } from '@/lib/attendance'
import { computeTravel, travelConfigOf, TRAVEL_LABEL } from '@/lib/travel'
import { lessonPayFor, coTaughtPresent } from '@/lib/lesson-pay'

type InstructorSummary = {
  adminRoleId:   string
  name:          string
  branch:        string | null
  lessons:       number   // ordinary weekly lessons
  ratePerLesson: number
  lessonPay:     number
  specialHours:  number   // camps / ימי שיא
  hourlyRate:    number
  specialPay:    number
  travelPay:     number
  travelLabel:   string
  totalPay:      number
  paid:          boolean
}

type Payment = {
  id:          string
  riderId:     string
  riderName:   string
  month:       string
  amount:      number
  status:      'paid' | 'pending' | 'overdue'
  groupName:   string | null
  branch:      string | null
}

type MonthSummary = {
  totalSessions: number
  totalHours:    number
  totalStudents: number
  totalRevenue:  number
  paidCount:     number
  pendingCount:  number
  overdueCount:  number
}

const STATUS_META = {
  paid:    { label: 'שולם',  bg: '#4cdb7a22', color: '#4cdb7a', border: '#4cdb7a44' },
  pending: { label: 'ממתין', bg: '#b5e85322', color: '#b5e853', border: '#b5e85344' },
  overdue: { label: 'פיגור', bg: '#ff4f4f22', color: '#ff8080', border: '#ff4f4f44' },
}

function StatusBadge({ status }: { status: 'paid' | 'pending' | 'overdue' }) {
  const m = STATUS_META[status]
  return (
    <span style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}`, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
      {m.label}
    </span>
  )
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  return new Date(parseInt(y), parseInt(m) - 1, 1)
    .toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
}

export default function AccountantPage() {
  const { user, loading, logout } = useAdminAuth('accountant')

  const [month, setMonth]           = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [instructors, setInstructors] = useState<InstructorSummary[]>([])
  const [payments, setPayments]       = useState<Payment[]>([])
  const [summary, setSummary]         = useState<MonthSummary | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [payFilter, setPayFilter]     = useState<'all' | 'paid' | 'pending' | 'overdue'>('all')
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [savingPay, setSavingPay]     = useState(false)

  // Month options: last 12 months
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    if (!user) return
    loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, month])

  async function loadAll() {
    setDataLoading(true)
    await Promise.all([loadInstructors(), loadPayments()])
    setDataLoading(false)
  }

  async function loadInstructors() {
    const firstDay = `${month}-01`
    const lastDay  = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0)
                       .toISOString().split('T')[0]

    // Fetch all instructor admin_roles
    const { data: roles } = await supabase
      .from('admin_roles')
      .select('id, name, branch')
      .eq('role', 'instructor')

    if (!roles?.length) { setInstructors([]); return }

    // Both rates and the travel arrangement live on staff_pay.
    const { data: pay } = await supabase
      .from('staff_pay')
      .select('admin_role_id, rate_per_lesson, hourly_rate, lesson_pay_model, attendance_rate_low, attendance_rate_mid, attendance_rate_high, attendance_threshold, attendance_threshold_2, travel_type, travel_km, travel_rate, travel_monthly_amount')

    // Per-month travel override, typed into the salary report.
    const { data: travelRows } = await supabase
      .from('instructor_travel')
      .select('instructor_id, amount')
      .eq('month', month)

    // What the per_km instructors reported themselves, one row per day worked.
    const { data: travelDays } = await supabase
      .from('instructor_travel_days')
      .select('instructor_id, km')
      .gte('travel_date', firstDay)
      .lte('travel_date', lastDay)

    // `duration` (not duration_hours) is the real column on class_sessions.
    const { data: sessions } = await supabase
      .from('class_sessions')
      .select('instructor_id, instructor_ids, type, duration, session_date, present_count')
      .gte('session_date', firstDay)
      .lte('session_date', lastDay)

    // Tally per instructor, counting co-taught sessions for everyone listed.
    // One entry per ordinary lesson, holding its attendance — the by_attendance
    // model prices each lesson on its own, so a count is not enough.
    const lessonPresents = new Map<string, number[]>()
    const specialHours = new Map<string, number>()
    const workDays     = new Map<string, Set<string>>()
    for (const s of sessions ?? []) {
      const ids = new Set<string>()
      if (s.instructor_id) ids.add(s.instructor_id)
      for (const extra of (s.instructor_ids ?? []) as string[]) ids.add(extra)
      // Band lookup only, divided by everyone who taught it — see coTaughtPresent.
      const bandPresent = coTaughtPresent(s.present_count, ids.size)
      for (const id of ids) {
        if (!workDays.has(id)) workDays.set(id, new Set())
        workDays.get(id)!.add(s.session_date)
        if (s.type === 'special') {
          specialHours.set(id, (specialHours.get(id) ?? 0) + (Number(s.duration) || 0))
        } else {
          if (!lessonPresents.has(id)) lessonPresents.set(id, [])
          lessonPresents.get(id)!.push(bandPresent)
        }
      }
    }

    const payOf      = new Map((pay ?? []).map(p => [p.admin_role_id, p]))
    const overrideOf = new Map((travelRows ?? []).map(t => [t.instructor_id, Number(t.amount)]))

    // Absent from the map means "reported nothing" — a reported 0 is a real figure.
    const reportedOf = new Map<string, number>()
    for (const d of travelDays ?? []) {
      reportedOf.set(d.instructor_id, (reportedOf.get(d.instructor_id) ?? 0) + (Number(d.km) || 0))
    }

    const summaries: InstructorSummary[] = roles.map(r => {
      const p             = payOf.get(r.id)
      const ratePerLesson = p?.rate_per_lesson == null ? DEFAULT_RATE_PER_LESSON : Number(p.rate_per_lesson)
      const hourlyRate    = p?.hourly_rate     == null ? DEFAULT_HOURLY_RATE     : Number(p.hourly_rate)

      const presents    = lessonPresents.get(r.id) ?? []
      const n           = presents.length
      const hours       = Math.round((specialHours.get(r.id) ?? 0) * 10) / 10
      const workingDays = workDays.get(r.id)?.size ?? 0
      const lessonPay   = lessonPayFor(p, presents)
      const specialPay  = hours * hourlyRate
      const reportedKm  = reportedOf.has(r.id) ? Math.round(reportedOf.get(r.id)! * 100) / 100 : null
      const travelPay   = computeTravel(p, workingDays, overrideOf.has(r.id) ? overrideOf.get(r.id)! : null, reportedKm)

      return {
        adminRoleId: r.id,
        name:        r.name,
        branch:      r.branch ?? null,
        lessons:     n,
        ratePerLesson,
        lessonPay:   Math.round(lessonPay),
        specialHours: hours,
        hourlyRate,
        specialPay:  Math.round(specialPay),
        travelPay:   Math.round(travelPay),
        travelLabel: TRAVEL_LABEL[travelConfigOf(p).type],
        totalPay:    Math.round(lessonPay + specialPay + travelPay),
        paid:        false, // could track with a separate instructor_payments table
      }
    }).sort((a, b) => b.totalPay - a.totalPay)

    setInstructors(summaries)

    // Build month summary
    const { data: riders } = await supabase.from('riders').select('id').eq('is_regular', true)
    const { data: allPay } = await supabase.from('payments').select('status, amount').eq('month', month)
    const paid    = allPay?.filter(p => p.status === 'paid').length ?? 0
    const pending = allPay?.filter(p => p.status === 'pending').length ?? 0
    const overdue = allPay?.filter(p => p.status === 'overdue').length ?? 0
    const revenue = allPay?.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0) ?? 0

    setSummary({
      totalSessions: sessions?.length ?? 0,
      totalHours:    Math.round((sessions?.reduce((s, x) => s + (Number(x.duration) || 1.5), 0) ?? 0) * 10) / 10,
      totalStudents: riders?.length ?? 0,
      totalRevenue:  revenue,
      paidCount: paid, pendingCount: pending, overdueCount: overdue,
    })
  }

  async function loadPayments() {
    const { data } = await supabase
      .from('payments')
      .select('id, rider_id, rider_name, month, amount, status')
      .eq('month', month)
      .order('status')
      .order('rider_name')

    const rows = data ?? []

    // Resolve each rider's group(s) via the rider_groups junction table.
    const riderIds = Array.from(new Set(rows.map(p => p.rider_id).filter(Boolean)))
    const byRider: Record<string, { names: string[]; branches: string[] }> = {}
    if (riderIds.length) {
      const { data: linkRows } = await supabase
        .from('rider_groups')
        .select('rider_id, groups(name, branch)')
        .in('rider_id', riderIds)
      for (const row of linkRows ?? []) {
        // The FK embed returns a single group object at runtime; normalise in
        // case the client types/returns it as an array.
        const raw = row.groups as unknown
        const g = (Array.isArray(raw) ? raw[0] : raw) as { name: string | null; branch: string | null } | null | undefined
        if (!g) continue
        const e = (byRider[row.rider_id] ??= { names: [], branches: [] })
        if (g.name && !e.names.includes(g.name)) e.names.push(g.name)
        if (g.branch && !e.branches.includes(g.branch)) e.branches.push(g.branch)
      }
    }

    setPayments(
      rows.map(p => ({
        id:        p.id,
        riderId:   p.rider_id,
        riderName: p.rider_name,
        month:     p.month,
        amount:    p.amount,
        status:    p.status,
        groupName: byRider[p.rider_id]?.names.join(', ') || null,
        branch:    byRider[p.rider_id]?.branches.join(' · ') || null,
      }))
    )
  }

  async function updatePaymentStatus(id: string, newStatus: 'paid' | 'pending' | 'overdue') {
    setSavingPay(true)
    const { error } = await supabase.from('payments').update({ status: newStatus }).eq('id', id)
    if (!error) {
      setPayments(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p))
      setEditingId(null)
      await loadInstructors() // refresh summary
    } else alert('שגיאה: ' + error.message)
    setSavingPay(false)
  }

  async function generatePayments() {
    // Auto-create payment records for all active riders for this month
    const { data: riders } = await supabase
      .from('riders')
      .select('id, full_name')
      .eq('is_regular', true)

    if (!riders?.length) return alert('לא נמצאו רוכבים פעילים')

    const records = riders.map(r => ({
      rider_id:   r.id,
      rider_name: r.full_name,
      month,
      amount:     350,
      status:     'pending',
    }))

    const { error } = await supabase
      .from('payments')
      .upsert(records, { onConflict: 'rider_id,month', ignoreDuplicates: true })

    if (error) alert('שגיאה: ' + error.message)
    else { await loadPayments(); await loadInstructors() }
  }

  if (loading) return (
    <div style={{ background: '#0d0f0e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7a8f7d', fontFamily: 'Heebo, Arial, sans-serif' }}>
      טוען...
    </div>
  )

  const filteredPayments = payFilter === 'all' ? payments : payments.filter(p => p.status === payFilter)

  return (
    <div dir="rtl" style={{ fontFamily: 'Heebo, Arial, sans-serif', background: '#0d0f0e', minHeight: '100vh', color: '#e8efe9' }}>
      {/* ── Header ── */}
      <div style={{ background: '#141716', borderBottom: '1px solid #252b27', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ color: '#b5e853', fontWeight: 900, fontSize: 18 }}>🚵 טבע בייק</span>
        <span style={{ background: '#1a1a2e', color: '#c0bfff', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>רואה חשבון</span>
        <span style={{ color: '#e8efe9', fontSize: 14, fontWeight: 700 }}>{user?.name}</span>
        <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            style={{ background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 8, color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 13, padding: '5px 10px', outline: 'none' }}
          >
            {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <button onClick={logout} style={{ background: 'transparent', border: '1px solid #252b27', color: '#7a8f7d', borderRadius: 8, padding: '5px 14px', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 12, cursor: 'pointer' }}>
            יציאה
          </button>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>דוח חודשי — {monthLabel(month)}</h2>
        <p style={{ color: '#7a8f7d', fontSize: 13, margin: '0 0 24px' }}>
          {new Date().toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        {dataLoading ? (
          <div style={{ color: '#7a8f7d', padding: 40, textAlign: 'center' }}>טוען נתונים...</div>
        ) : (
          <>
            {/* ── Summary KPIs ── */}
            {summary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 28 }}>
                {[
                  { label: 'סה"כ אימונים',  value: summary.totalSessions, color: '#81d4fa',  icon: '🗓️' },
                  { label: 'שעות הדרכה',    value: `${summary.totalHours}ש'`, color: '#b5e853',  icon: '⏱️' },
                  { label: 'תלמידים פעילים', value: summary.totalStudents, color: '#c0bfff',  icon: '🚵' },
                  { label: 'הכנסות ששולמו', value: `₪${summary.totalRevenue.toLocaleString()}`, color: '#4cdb7a', icon: '💰' },
                  { label: 'שולם',           value: summary.paidCount,    color: '#4cdb7a',  icon: '✓' },
                  { label: 'ממתין לתשלום',   value: summary.pendingCount, color: '#b5e853',  icon: '⏳' },
                  { label: 'בפיגור',          value: summary.overdueCount, color: summary.overdueCount > 0 ? '#ff8080' : '#4cdb7a', icon: '⚠️' },
                ].map(c => (
                  <div key={c.label} style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: '16px 18px' }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{c.icon}</div>
                    <div style={{ fontSize: 10, color: '#7a8f7d', marginBottom: 3 }}>{c.label}</div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Instructor Hours ── */}
            <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflow: 'hidden', marginBottom: 28 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #252b27', fontWeight: 700, fontSize: 15 }}>
                שעות מדריכים — {monthLabel(month)}
              </div>
              {instructors.length === 0 ? (
                <div style={{ padding: 28, color: '#7a8f7d', textAlign: 'center', fontSize: 13 }}>אין נתונים לחודש זה</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.2fr 1.1fr 1fr', padding: '9px 18px', borderBottom: '1px solid #252b27', fontSize: 11, color: '#7a8f7d', fontWeight: 600 }}>
                    <span>מדריך</span><span>שיעורים רגילים</span><span>★ פעילויות מיוחדות</span><span>🚗 נסיעות</span><span>לתשלום</span>
                  </div>
                  {instructors.map((ins, i) => (
                    <div
                      key={ins.adminRoleId}
                      style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.2fr 1.1fr 1fr', padding: '13px 18px', borderBottom: i < instructors.length - 1 ? '1px solid #1a1e1c' : 'none', alignItems: 'center' }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{ins.name}</div>
                        {ins.branch && <div style={{ color: '#7a8f7d', fontSize: 11 }}>📍 {ins.branch}</div>}
                      </div>
                      <div>
                        <div style={{ color: '#b5e853', fontWeight: 700, fontSize: 14 }}>₪{ins.lessonPay.toLocaleString()}</div>
                        <div style={{ color: '#7a8f7d', fontSize: 11 }}>{ins.lessons} × ₪{ins.ratePerLesson}</div>
                      </div>
                      <div>
                        <div style={{ color: '#c084fc', fontWeight: 700, fontSize: 14 }}>₪{ins.specialPay.toLocaleString()}</div>
                        <div style={{ color: '#7a8f7d', fontSize: 11 }}>
                          {ins.specialHours > 0 ? `${ins.specialHours}ש' × ₪${ins.hourlyRate}` : '—'}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: '#81d4fa', fontWeight: 700, fontSize: 14 }}>₪{ins.travelPay.toLocaleString()}</div>
                        <div style={{ color: '#7a8f7d', fontSize: 11 }}>{ins.travelLabel}</div>
                      </div>
                      <span style={{ color: '#4cdb7a', fontWeight: 800, fontSize: 16 }}>
                        ₪{ins.totalPay.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {/* Total row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.2fr 1.1fr 1fr', padding: '12px 18px', borderTop: '1px solid #252b27', background: '#1a1e1c', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#7a8f7d', fontSize: 13 }}>סה"כ</span>
                    <span style={{ color: '#b5e853', fontWeight: 700 }}>₪{instructors.reduce((s, i) => s + i.lessonPay, 0).toLocaleString()}</span>
                    <span style={{ color: '#c084fc', fontWeight: 700 }}>₪{instructors.reduce((s, i) => s + i.specialPay, 0).toLocaleString()}</span>
                    <span style={{ color: '#81d4fa', fontWeight: 700 }}>₪{instructors.reduce((s, i) => s + i.travelPay, 0).toLocaleString()}</span>
                    <span style={{ color: '#4cdb7a', fontWeight: 900, fontSize: 17 }}>
                      ₪{instructors.reduce((s, i) => s + i.totalPay, 0).toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* ── Student Payments ── */}
            <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #252b27', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>תשלומי תלמידים — {monthLabel(month)}</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(['all', 'paid', 'pending', 'overdue'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setPayFilter(f)}
                      style={{
                        padding: '3px 12px', borderRadius: 20, border: 'none',
                        cursor: 'pointer', fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 600, fontSize: 12,
                        background: payFilter === f ? '#b5e853' : '#252b27',
                        color: payFilter === f ? '#0d0f0e' : '#7a8f7d',
                      }}
                    >
                      {f === 'all' ? 'הכל' : STATUS_META[f].label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={generatePayments}
                  style={{ marginRight: 'auto', background: 'transparent', border: '1px solid #b5e85344', color: '#b5e853', borderRadius: 8, padding: '5px 14px', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                >
                  + צור רשומות תשלום
                </button>
              </div>

              {filteredPayments.length === 0 ? (
                <div style={{ padding: 28, color: '#7a8f7d', textAlign: 'center', fontSize: 13 }}>
                  {payments.length === 0
                    ? 'אין רשומות תשלום לחודש זה. לחץ "+ צור רשומות תשלום" ליצירה אוטומטית.'
                    : 'אין תוצאות לפילטר זה'}
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 120px', padding: '9px 18px', borderBottom: '1px solid #252b27', fontSize: 11, color: '#7a8f7d', fontWeight: 600 }}>
                    <span>שם תלמיד</span><span>קבוצה / סניף</span><span>סכום</span><span>סטטוס</span><span>פעולה</span>
                  </div>
                  {filteredPayments.map((p, i) => (
                    <div
                      key={p.id}
                      style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 120px', padding: '12px 18px', borderBottom: i < filteredPayments.length - 1 ? '1px solid #1a1e1c' : 'none', alignItems: 'center' }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{p.riderName}</span>
                      <div>
                        {p.groupName && <div style={{ fontSize: 12 }}>{p.groupName}</div>}
                        {p.branch && <div style={{ color: '#7a8f7d', fontSize: 11 }}>📍 {p.branch}</div>}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>₪{p.amount}</span>
                      <StatusBadge status={p.status} />
                      <div>
                        {editingId === p.id ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            {(['paid', 'pending', 'overdue'] as const).filter(s => s !== p.status).map(ns => (
                              <button
                                key={ns}
                                onClick={() => updatePaymentStatus(p.id, ns)}
                                disabled={savingPay}
                                style={{
                                  padding: '3px 8px', borderRadius: 6, border: 'none',
                                  cursor: 'pointer', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 11, fontWeight: 600,
                                  background: STATUS_META[ns].bg, color: STATUS_META[ns].color,
                                }}
                              >
                                {STATUS_META[ns].label}
                              </button>
                            ))}
                            <button
                              onClick={() => setEditingId(null)}
                              style={{ padding: '3px 6px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#1a1e1c', color: '#7a8f7d', fontSize: 11 }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingId(p.id)}
                            style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #252b27', background: 'transparent', color: '#7a8f7d', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 12, cursor: 'pointer' }}
                          >
                            עדכן
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
