import { WHATSAPP_GRAPH_VERSION } from '@/lib/whatsapp'

// ─────────────────────────────────────────────────────────────────────────────
// Pre-approved WhatsApp template sends — as opposed to the free-form replies
// in app/api/whatsapp/send, which Meta only allows within the 24h window
// after a customer writes in first. A template is the only way to message
// someone who hasn't written to us yet (e.g. right after they submit a
// registration form), so this is what opens the conversation that
// /admin/coordinator/whatsapp then continues.
//
// WHATSAPP_REGISTRATION_TEMPLATE_NAME is unset until Meta approves the
// `registration_confirmation` template (currently "in review"). Until then
// every send here is a safe no-op (logged, never thrown), so callers can wire
// this in ahead of approval with zero risk.
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATE_NAME = process.env.WHATSAPP_REGISTRATION_TEMPLATE_NAME

export type TemplateSendResult = { skipped: true } | { skipped?: false; ok: boolean }

/** Digits only, country code 972, no leading 0 — the format Meta's `to` field expects (see conversation.wa_id in app/api/whatsapp/send). */
function normalizeIlPhone(raw: string): string {
  const d = (raw || '').replace(/\D/g, '')
  if (d.startsWith('972')) return d
  if (d.startsWith('0')) return `972${d.slice(1)}`
  return `972${d}`
}

/**
 * Sends the pre-approved `registration_confirmation` template to `phone`:
 * "היי {{1}}, ההרשמה שלך ל-{{2}} התקבלה בהצלחה ✅ תאריך: {{3}}. ..."
 *
 * No-ops (does not throw) while the template isn't configured yet, and never
 * throws on a failed send either — it's meant to be called fire-and-forget
 * from a request handler, so a failure here must never surface as an error
 * to whoever is submitting the form.
 */
export async function sendRegistrationConfirmation(
  phone: string,
  firstName: string,
  activityName: string,
  dateLabel: string
): Promise<TemplateSendResult> {
  if (!TEMPLATE_NAME) {
    console.log('[whatsapp] registration_confirmation template not approved/configured yet — skipping')
    return { skipped: true }
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_TOKEN
  if (!phoneNumberId || !token) {
    console.error('[whatsapp] missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_TOKEN')
    return { ok: false }
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
          name: TEMPLATE_NAME,
          language: { code: 'he' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: firstName },
                { type: 'text', text: activityName },
                { type: 'text', text: dateLabel },
              ],
            },
          ],
        },
      }),
    })

    if (!res.ok) {
      console.error('[whatsapp] send failed', await res.text().catch(() => ''))
      return { ok: false }
    }
    return { ok: true }
  } catch (err) {
    console.error('[whatsapp] send threw', err)
    return { ok: false }
  }
}
