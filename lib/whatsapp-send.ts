import type { SupabaseClient } from '@supabase/supabase-js'
import { WHATSAPP_GRAPH_VERSION } from '@/lib/whatsapp'

// The one place that actually calls the Meta Graph API to send a free-form
// WhatsApp text and logs it as an outbound message — shared by the
// coordinator's manual send (app/api/whatsapp/send) and the automatic bot
// reply (lib/whatsapp-autoreply.ts), so both paths log identically and a fix
// to one (retry, error shape, whatever) never drifts out of sync with the
// other.

export type SendResult =
  | { ok: true; messageId: string | null }
  | { ok: false; error: string }

/** Sends `text` to `waId` via the Graph API, then logs it in whatsapp_messages and bumps the conversation. Does not check the 24h window or ownership — callers do that first. */
export async function sendWhatsAppText(
  admin: SupabaseClient,
  opts: { conversationId: string; waId: string; text: string; sentBy: string },
): Promise<SendResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_TOKEN
  if (!phoneNumberId || !token) {
    return { ok: false, error: 'missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_TOKEN' }
  }

  let waMessageId: string | null = null
  try {
    const res = await fetch(`https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: opts.waId,
        text: { body: opts.text },
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: data?.error?.message || res.statusText }
    }
    waMessageId = data?.messages?.[0]?.id ?? null
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const now = new Date().toISOString()
  const { data: saved, error: insertErr } = await admin
    .from('whatsapp_messages')
    .insert({
      conversation_id: opts.conversationId,
      wa_message_id: waMessageId,
      direction: 'outbound',
      msg_type: 'text',
      body: opts.text,
      status: 'sent',
      sent_by: opts.sentBy,
      created_at: now,
    })
    .select('id')
    .single()
  if (insertErr) console.error('[whatsapp-send] message insert failed:', insertErr.message)

  const { error: updateErr } = await admin
    .from('whatsapp_conversations')
    .update({ last_message_at: now })
    .eq('id', opts.conversationId)
  if (updateErr) console.error('[whatsapp-send] conversation update failed:', updateErr.message)

  // The Graph API call is the part that can actually fail the caller's
  // request; a broken insert/update above is logged but doesn't flip this to
  // an error — the message did go out to the customer either way.
  return { ok: true, messageId: saved?.id ?? null }
}
