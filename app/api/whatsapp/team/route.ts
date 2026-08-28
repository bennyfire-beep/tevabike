import { NextRequest, NextResponse } from 'next/server'
import { whatsappServiceClient, requireCoordinator } from '@/lib/whatsapp-server'

// GET /api/whatsapp/team — the admins/coordinators the "אחראי/ת" picker can
// assign a conversation to. admin_roles has no email column (it lives on
// auth.users), so this joins the Auth admin API in for it — same reason
// lib/whatsapp-notify.ts does.

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const admin = whatsappServiceClient()
  if (!admin) return NextResponse.json({ error: 'השרת לא מוגדר נכון' }, { status: 500 })

  const auth = await requireCoordinator(req, admin)
  if (!auth.ok) return auth.response

  const { data: rows, error } = await admin
    .from('admin_roles')
    .select('user_id, name, role')
    .in('role', ['admin', 'coordinator'])
    .order('name')

  if (error) {
    console.error('[whatsapp/team] query failed:', error.message)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }

  const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 200 })
  const emailById = new Map((usersPage?.users ?? []).map(u => [u.id, (u.email ?? '').toLowerCase()]))

  const team = (rows ?? [])
    .map(r => ({ email: emailById.get(r.user_id) ?? '', name: r.name as string, role: r.role as string }))
    .filter(t => t.email)

  return NextResponse.json({ team })
}
