import type { SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'

// Push to the interval-timer participants (interval_subscribers), not staff.
// Same VAPID keys and web-push mechanics as lib/whatsapp-notify.ts, kept as a
// separate small helper because the audience and table are completely
// different — mixing them would mean every whatsapp-notify caller also needs
// to reason about interval subscribers, and vice versa.

let vapidReady = false
function ensureVapid(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) return false
  if (!vapidReady) {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    vapidReady = true
  }
  return true
}

export type IntervalPushPayload = {
  title: string
  body: string
  /** Vibration pattern in ms, e.g. [200, 100, 200] — Android honours this; iOS ignores it but still sounds/vibrates via the system default for an installed PWA (iOS 16.4+). */
  vibrate?: number[]
}

type SubRow = { id: string; push_subscription: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null }

/** Best-effort: never throws — a failed push must never block the control action that triggered it. */
export async function notifyIntervalSubscribers(admin: SupabaseClient, payload: IntervalPushPayload): Promise<void> {
  try {
    if (!ensureVapid()) return

    const { data: subs } = await admin
      .from('interval_subscribers')
      .select('id, push_subscription')
      .not('push_subscription', 'is', null)
    if (!subs || subs.length === 0) return

    await Promise.all((subs as SubRow[]).map(async (row) => {
      const sub = row.push_subscription
      if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
          JSON.stringify({ kind: 'interval', ...payload }),
        )
      } catch (e) {
        const statusCode = (e as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          // הדפדפן/המערכת זרקו את המנוי הזה (הסרת האפליקציה, ביטול הרשאה) —
          // מנקים רק את המנוי, לא את הרשומה של החניך עצמו.
          await admin.from('interval_subscribers').update({ push_subscription: null }).eq('id', row.id)
        } else {
          console.error('[interval-notify] send failed for subscriber', row.id, (e as Error).message)
        }
      }
    }))
  } catch (e) {
    console.error('[interval-notify] unhandled error:', (e as Error).message)
  }
}
