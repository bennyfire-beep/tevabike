import { NextRequest, NextResponse } from 'next/server'
import { resolveSalaryAdmin } from '@/lib/salary-admin-identity'

// Reject one "פעילות אחרת" report. No rate involved — approved_by/approved_at
// double as "who decided, and when" for a rejection too, since the schema has
// no separate rejected_by/rejected_at pair.
//
// .eq('status', 'pending') guards the same double-submit race as approve.

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveSalaryAdmin(req.headers.get('authorization'))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { db, adminRoleId } = auth.identity
  const { id } = await params

  const { data, error } = await db
    .from('instructor_activity_logs')
    .update({
      status: 'rejected',
      approved_by: adminRoleId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[coordinator/activity-logs/reject] update failed:', error.message)
    return NextResponse.json({ error: 'הדחייה נכשלה' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'הדיווח לא נמצא, או שכבר טופל' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
