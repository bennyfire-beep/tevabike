import type { SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { WHATSAPP_GRAPH_VERSION } from '@/lib/whatsapp'

// Who to tell when a WhatsApp message comes in — shared by the push
// notification (this file) and the personal-number template alert (also this
// file), called from the webhook right after it saves an inbound message.
// Both are best-effort: a failure here must never affect the 200 the webhook
// already sent back to Meta, so every entry point below only ever logs.

type RosterMember = { userId: string; email: string; name: string; role: 'admin' | 'coordinator' }

/** Every admin/coordinator, with the email Auth knows them by (admin_roles has no email column). */
async function getRoster(admin: SupabaseClient): Promise<RosterMember[]> {
  const { data: rows } = await admin
    .from('admin_roles')
    .select('user_id, name, role')
    .in('role', ['admin', 'coordinator'])
  if (!rows || rows.length === 0) return []

  // admin_roles has no email column — that lives on auth.users, only reachable
  // through the Auth admin API, not a plain .from('auth.users') select.
  const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 200 })
  const emailById = new Map((usersPage?.users ?? []).map(u => [u.id, (u.email ?? '').toLowerCase()]))

  return rows
    .map(r => ({ userId: r.user_id as string, name: r.name as string, role: r.role as 'admin' | 'coordinator', email: emailById.get(r.user_id) ?? '' }))
    .filter(r => r.email)
}

/** admin sees/hears about everything; coordinator only her own + unassigned. Same rule as canAccessConversation in lib/whatsapp-server.ts. */
function isNotifyTarget(member: RosterMember, assignedTo: string | null): boolean {
  if (member.role === 'admin') return true
  return assignedTo === null || assignedTo.toLowerCase() === member.email
}

type InboundAlert = {
  conversationId: string
  assignedTo: string | null
  senderName: string
  senderPhone: string
  preview: string
}

// ── Push (Web Push / VAPID) ─────────────────────────────────────────────────

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

async function sendPushToEmails(admin: SupabaseClient, emails: string[], payload: { title: string; body: string; url: string }) {
  if (emails.length === 0 || !ensureVapid()) return

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_email', emails)
  if (!subs || subs.length === 0) return

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      )
    } catch (e) {
      const statusCode = (e as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) {
        // The browser/OS dropped this subscription (uninstalled, permission
        // revoked) — Meta-equivalent of a dead endpoint, just clean it up.
        await admin.from('push_subscriptions').delete().eq('id', s.id)
      } else {
        console.error('[push] send failed for', s.endpoint, (e as Error).message)
      }
    }
  }))
}

// ── WhatsApp template alert to a personal number (phase 2) ─────────────────
// Not deployed until the template is approved: ALERT_RECIPIENTS format is
// "email:phone" pairs so each number can be matched back to its person's role
// (see final instructions to Benny for the exact env var format).

function parseAlertRecipients(raw: string | undefined): { email: string; phone: string }[] {
  if (!raw) return []
  return raw.split(',')
    .map(pair => pair.trim())
    .filter(Boolean)
    .map(pair => {
      const [email, phone] = pair.split(':').map(x => (x ?? '').trim())
      return { email: email.toLowerCase(), phone }
    })
    .filter(r => r.email && r.phone)
}

async function sendTemplateAlerts(targetEmails: Set<string>, vars: { senderName: string; senderPhone: string; preview: string }) {
  const templateName = process.env.ALERT_TEMPLATE_NAME
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const recipients = parseAlertRecipients(process.env.ALERT_RECIPIENTS).filter(r => targetEmails.has(r.email))
  if (!templateName || !token || !phoneNumberId || recipients.length === 0) return

  await Promise.all(recipients.map(async (r) => {
    try {
      const res = await fetch(`https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: r.phone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'he' },
            components: [{
              type: 'body',
              parameters: [
                { type: 'text', text: vars.senderName },
                { type: 'text', text: vars.senderPhone },
                { type: 'text', text: vars.preview },
              ],
            }],
          },
        }),
      })
      if (!res.ok) {
        console.error('[whatsapp-alert] template send failed for', r.phone, await res.text().catch(() => ''))
      }
    } catch (e) {
      console.error('[whatsapp-alert] template send error for', r.phone, (e as Error).message)
    }
  }))
}

// ── Entry point called from the webhook ─────────────────────────────────────

/** Best-effort: any failure in here is caught and logged, never thrown. */
export async function notifyInbound(admin: SupabaseClient, alert: InboundAlert): Promise<void> {
  try {
    const roster = await getRoster(admin)
    const targets = roster.filter(m => isNotifyTarget(m, alert.assignedTo))
    if (targets.length === 0) return

    const title = alert.senderName || alert.senderPhone
    const body = alert.preview.length > 120 ? alert.preview.slice(0, 120) + '…' : alert.preview
    const url = `/admin/coordinator/whatsapp?conversation=${alert.conversationId}`

    await Promise.all([
      sendPushToEmails(admin, targets.map(t => t.email), { title, body, url }),
      sendTemplateAlerts(new Set(targets.map(t => t.email)), {
        senderName: alert.senderName || 'לקוח',
        senderPhone: alert.senderPhone,
        preview: body,
      }),
    ])
  } catch (e) {
    console.error('[whatsapp-notify] unhandled error:', (e as Error).message)
  }
}
