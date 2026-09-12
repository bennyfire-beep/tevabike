import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/instructor-identity'

// Active instructors — staff PII (name + branch) read with the service role
// because admin_roles is only readable by authenticated users under RLS.
//
// Not called from anywhere in the app today (the instructor mobile page now
// resolves its own identity from the login session instead of picking from
// this list), but it was reachable with no login at all, which handed out
// every active instructor's name and branch to anyone. Locked to any signed-in
// staff member instead of removing the route outright, in case something
// still depends on it that this pass didn't find.

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await resolveCaller(req.headers.get('authorization'))
  if (!auth.ok) return NextResponse.json({ error: auth.error, instructors: [] }, { status: auth.status })
  const { db } = auth.identity

  const { data, error } = await db
    .from('admin_roles')
    .select('id, name, branch')
    .eq('role', 'instructor')
    .eq('active', true)
    .order('name')

  if (error) {
    console.error('[instructor/list] admin_roles query failed:', error.message)
    return NextResponse.json({ error: error.message, instructors: [] }, { status: 500 })
  }
  if (!data || data.length === 0) {
    console.warn('[instructor/list] query succeeded but returned 0 active instructors (role=instructor, active=true)')
  }
  return NextResponse.json({ instructors: data ?? [] })
}
