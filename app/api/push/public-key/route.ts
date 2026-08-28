import { NextResponse } from 'next/server'

// GET /api/push/public-key — hands the VAPID public key to the browser so it
// can call pushManager.subscribe({ applicationServerKey }). Not a secret (it's
// public by design), but kept server-side rather than NEXT_PUBLIC_ so Benny
// only has to set one env var name per key, matching the spec.

export const dynamic = 'force-dynamic'

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? null
  if (!publicKey) {
    return NextResponse.json({ error: 'התראות פוש לא מוגדרות עדיין בשרת' }, { status: 500 })
  }
  return NextResponse.json({ publicKey })
}
