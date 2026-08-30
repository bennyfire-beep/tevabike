import { WHATSAPP_GRAPH_VERSION } from '@/lib/whatsapp'

// ─────────────────────────────────────────────────────────────────────────────
// Pre-approved WhatsApp template sends — as opposed to the free-form replies
// in app/api/whatsapp/send, which Meta only allows within the 24h window
// after a customer writes in first. A template is the only way to message
// someone who hasn't written to us yet (e.g. right after they submit a form),
// so this is what opens the conversation that /admin/coordinator/whatsapp
// then continues.
//
// WHATSAPP_REGISTRATION_TEMPLATE_NAME is unset until Meta approves the
// registration-confirmation template — until then every send here is a safe
// no-op (logged, never thrown), so callers can wire this in ahead of
// approval with zero risk.
// ─────────────────────────────────────────────────────────────────────────────

const WHATSAPP_TEMPLATE_NAME = process.env.WHATSAPP_REGISTRATION_TEMPLATE_NAME

export type TemplateSendResult =
  | { skipped: true }
  | { skipped: false; ok: true }
  | { skipped: false; ok: false; error: string }

/** Digits only, country code 972, no leading 0 — the format Meta's `to` field expects (see conversation.wa_id in app/api/whatsapp/send). */
function normalizeIlPhone(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.startsWith('972')) return d
  if (d.startsWith('0')) return `972${d.slice(1)}`
  return `972${d}`
}

/**
 * Sends the pre-approved registration-confirmation template to `phone`.
 * No-ops (does not throw) while the template isn't configured yet, and
 * never throws on a failed send either — callers should still wrap this in
 * try/catch since it's fire-and-forget from a request handler's point of
 * view.
 */
export async function sendRegistrationConfirmationTemplate(
  phone: string,
  firstName: string
): Promise<TemplateSendResult> {
  if (!WHATSAPP_TEMPLATE_NAME) {
    console.log('[whatsapp-template] template not configured yet, skipping send')
    return { skipped: true }
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_TOKEN
  if (!phoneNumberId || !token) {
    console.error('[whatsapp-template] missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_TOKEN')
    return { skipped: false, ok: false, error: 'missing WhatsApp API credentials' }
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizeIlPhone(phone),
        type: 'template',
        template: {
          name: WHATSAPP_TEMPLATE_NAME,
          language: { code: 'he' },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: firstName }],
            },
          ],
        },
      }),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error('[whatsapp-template] send failed', errBody)
      return { skipped: false, ok: false, error: errBody }
    }

    return { skipped: false, ok: true }
  } catch (e) {
    console.error('[whatsapp-template] send error', (e as Error).message)
    return { skipped: false, ok: false, error: (e as Error).message }
  }
}
