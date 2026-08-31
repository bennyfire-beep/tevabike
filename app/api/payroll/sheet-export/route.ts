import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// JSON-only export of the monthly payroll totals, for the Google Sheet
// automation. Same numbers as the payroll page (salary_report_json RPC).
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const month = url.searchParams.get('month')
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month query param required, format YYYY-MM' }, { status: 400 })
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !supaKey) return NextResponse.json({ error: 'Supabase env vars missing' }, { status: 500 })

  const db = createClient(supaUrl, supaKey)
  const { data, error } = await db.rpc('salary_report_json', { p_month: month })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
