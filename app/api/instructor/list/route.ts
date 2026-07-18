import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Active instructors for the no-login instructor mobile page.
// admin_roles is only readable by authenticated users under RLS (and holds
// staff PII), so we read it here with the service role and return just the
// non-sensitive fields the picker needs.

export const dynamic = 'force-dynamic'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.json({ error: 'Supabase env vars missing' }, { status: 500 })

  const db = createClient(url, key)
  const { data, error } = await db
    .from('admin_roles')
    .select('id, name, branch')
    .eq('role', 'instructor')
    .eq('active', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ instructors: data ?? [] })
}
