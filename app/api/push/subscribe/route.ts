import { NextRequest, NextResponse } from 'next/server'
import { whatsappServiceClient, requireCoordinator } from '@/lib/whatsapp-server'

// POST /api/push/subscribe — saves the browser's PushSubscription for the
// signed-in coordinator/admin. Keyed on endpoint (one row per browser/device);
// re-subscribing the same browser just refreshes the keys.

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const admin = whatsappServiceClient()
  if (!admin) return NextResponse.json({ error: 'השרת לא מוגדר נכון' }, { status: 500 })

  const auth = await requireCoordinator(req, admin)
  if (!auth.ok) return auth.response

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }) }

  const endpoint = (body.endpoint ?? '').trim()
  const p256dh = (body.keys?.p256dh ?? '').trim()
  const authKey = (body.keys?.auth ?? '').trim()
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: 'מנוי לא תקין' }, { status: 400 })
  }

  const { error } = await admin
    .from('push_subscriptions')
    .upsert(
      { user_email: auth.caller.email, endpoint, p256dh, auth: authKey },
      { onConflict: 'endpoint' },
    )

  if (error) {
    console.error('[push/subscribe] upsert failed:', error.message)
    return NextResponse.json({ error: 'שמירת המנוי נכשלה' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
