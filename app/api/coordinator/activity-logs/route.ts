import { NextRequest, NextResponse } from 'next/server'
import { resolveSalaryAdmin } from '@/lib/salary-admin-identity'
import { type ActivityStatus } from '@/lib/activity-logs'

// ─────────────────────────────────────────────────────────────────────────────
// Every "פעילות אחרת" report, for a salary admin to review.
//
// instructor_activity_logs is RLS-locked to is_salary_admin() (same as
// staff_pay), so this runs with the service role once resolveSalaryAdmin has
// verified the caller really is Benny or Shir. Names are joined in code, not
// via a foreign-table select, matching how the rest of the payroll screens
// merge admin_roles in — a service-role client has no session RLS to lean on
// either way.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

const LOG_COLS = 'id, instructor_id, activity_date, activity_type, activity_type_other, description, hours, hourly_rate, status, approved_by, approved_at, created_at'

const VALID_STATUS = new Set<ActivityStatus | 'all'>(['pending', 'approved', 'rejected', 'all'])

export async function GET(req: NextRequest) {
  const auth = await resolveSalaryAdmin(req.headers.get('authorization'))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { db } = auth.identity

  const statusParam = req.nextUrl.searchParams.get('status') ?? 'pending'
  const status = VALID_STATUS.has(statusParam as ActivityStatus | 'all') ? statusParam : 'pending'

  let query = db.from('instructor_activity_logs').select(LOG_COLS).order('activity_date', { ascending: false })
  if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    console.error('[coordinator/activity-logs] list failed:', error.message)
    return NextResponse.json({ error: 'טעינת הדיווחים נכשלה' }, { status: 500 })
  }

  const rows = data ?? []
  const instructorIds = [...new Set(rows.map(r => r.instructor_id))]
  const nameOf: Record<string, string> = {}
  if (instructorIds.length > 0) {
    const { data: roleRows } = await db.from('admin_roles').select('id, name').in('id', instructorIds)
    for (const r of roleRows ?? []) nameOf[r.id] = r.name
  }

  return NextResponse.json({
    logs: rows.map(r => ({ ...r, instructor_name: nameOf[r.instructor_id] ?? 'מדריך לא ידוע' })),
  })
}
