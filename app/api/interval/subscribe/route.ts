import { NextRequest, NextResponse } from 'next/server'
import { intervalServiceClient } from '@/lib/interval-server'

// POST /api/interval/subscribe — /interval/join's form target. Public, no
// login (the same "real enforcement is the server route, not RLS" pattern as
// app/api/camp-register/route.ts): saves the participant's details and,
// when granted, their PushSubscription — that's what lets the phase-change
// Web Push reach their locked phone during the workout.

export const dynamic = 'force-dynamic'

type Body = {
  first_name?: string
  last_name?: string
  phone?: string
  push_subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null
}

export async function POST(req: NextRequest) {
  const admin = intervalServiceClient()
  if (!admin) return NextResponse.json({ error: 'השרת לא מוגדר נכון' }, { status: 500 })

  let body: Body
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }) }

  const firstName = (body.first_name ?? '').trim()
  const lastName = (body.last_name ?? '').trim()
  const phone = (body.phone ?? '').trim()
  if (!firstName || !lastName) {
    return NextResponse.json({ error: 'נא למלא שם פרטי ושם משפחה' }, { status: 400 })
  }

  const sub = body.push_subscription
  const pushSubscription = sub?.endpoint && sub.keys?.p256dh && sub.keys?.auth
    ? { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }
    : null

  const { error } = await admin.from('interval_subscribers').insert({
    first_name: firstName,
    last_name: lastName,
    phone: phone || null,
    push_subscription: pushSubscription,
  })

  if (error) {
    console.error('[interval/subscribe] insert failed:', error.message)
    return NextResponse.json({ error: 'ההרשמה לא נשמרה, נסו שוב' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
