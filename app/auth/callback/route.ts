import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { setAdminSession } from '@/lib/auth-actions'
import { rolesOf, homeFor } from '@/lib/roles'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) return NextResponse.redirect(`${origin}/admin/login?error=missing_code`)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.session) return NextResponse.redirect(`${origin}/admin/login?error=invalid_code`)

  const isReset = searchParams.get('type') === 'recovery'
  if (isReset) {
    await setAdminSession(data.session.access_token, '')
    return NextResponse.redirect(`${origin}/admin/reset-password`)
  }

  // Every role row — admin_roles is one per job and some people hold several,
  // which `.single()` turned into an error and so into a bounce back to login.
  const { data: rd } = await supabase
    .from('admin_roles')
    .select('role')
    .eq('user_id', data.session.user.id)

  const roles = rolesOf(rd)
  await setAdminSession(data.session.access_token, roles)

  return NextResponse.redirect(`${origin}${roles.length > 0 ? homeFor(roles) : '/admin/login'}`)
}
