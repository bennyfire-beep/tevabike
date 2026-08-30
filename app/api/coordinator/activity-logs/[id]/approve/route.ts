import { NextRequest, NextResponse } from 'next/server'
import { resolveSalaryAdmin } from '@/lib/salary-admin-identity'

// ─────────────────────────────────────────────────────────────────────────────
// Approve one "פעילות אחרת" report — the only place hourly_rate is ever set.
// The rate is a per-report judgement call by a salary admin, never something
// the instructor supplies (see /api/instructor/activity-log).
//
// .eq('status', 'pending') on the update guards against double-approving (or
// approving something already rejected) from two open tabs — the second
// request simply matches nothing and comes back 404 rather than silently
// overwriting an already-decided report with a new rate.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveSalaryAdmin(req.headers.get('authorization'))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { db, adminRoleId } = auth.identity
  const { id } = await params

  let body: { hourly_rate?: unknown }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }) }

  const hourlyRate = Math.round(Number(body.hourly_rate) * 100) / 100
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
    return NextResponse.json({ error: 'תעריף שעתי לא תקין' }, { status: 400 })
  }

  const { data, error } = await db
    .from('instructor_activity_logs')
    .update({
      hourly_rate: hourlyRate,
      status: 'approved',
      approved_by: adminRoleId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[coordinator/activity-logs/approve] update failed:', error.message)
    return NextResponse.json({ error: 'האישור נכשל' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'הדיווח לא נמצא, או שכבר טופל' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
