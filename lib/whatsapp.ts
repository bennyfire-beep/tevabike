// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Cloud API — shared constants and small helpers.
//
// The webhook (app/api/whatsapp/webhook), the send route (app/api/whatsapp/send)
// and the coordinator screen (/admin/coordinator/whatsapp) all need the same
// message-type labels and the same 24h reply-window rule, so they live here
// once rather than drifting apart between a route and a page.
// ─────────────────────────────────────────────────────────────────────────────

export const WHATSAPP_GRAPH_VERSION = 'v26.0'

/**
 * Digits only, country code 972, no leading 0 — the format Meta's Cloud API
 * uses everywhere (conversation.wa_id, the `to` field on a send/template
 * call, wa.me links). The one normalizer every WhatsApp entry point should
 * share, so a phone typed as "052-570-8084" and one already stored as
 * "972525708084" always resolve to the same wa_id.
 */
export function normalizeToWaId(raw: string): string {
  const d = (raw || '').replace(/\D/g, '')
  if (d.startsWith('972')) return d
  if (d.startsWith('0')) return `972${d.slice(1)}`
  return `972${d}`
}

/** Meta only lets a business reply for free within 24h of the customer's last message. */
export const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000

export const WINDOW_CLOSED_MESSAGE =
  'חלון 24 השעות נסגר — הלקוח צריך לכתוב קודם, או שיש לשלוח תבנית מאושרת.'

/** Whether we may still send a free-form reply, given the last inbound message time. */
export function isReplyWindowOpen(lastInboundAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!lastInboundAt) return false
  const t = new Date(lastInboundAt).getTime()
  if (Number.isNaN(t)) return false
  return now - t < REPLY_WINDOW_MS
}

// Inbound message types we recognise, mapped to a short Hebrew placeholder
// shown in the conversation list / bubble when there's no text to show.
export const MSG_TYPE_LABEL: Record<string, string> = {
  text:        '',
  image:       '[תמונה]',
  audio:       '[הקלטה]',
  video:       '[סרטון]',
  document:    '[מסמך]',
  sticker:     '[מדבקה]',
  location:    '[מיקום]',
  contacts:    '[איש קשר]',
  unsupported: '[הודעה לא נתמכת]',
}

/** The line shown for a message that has no text body — non-text types get a placeholder. */
export function bodyLabel(msgType: string | null | undefined, body: string | null | undefined): string {
  if (body) return body
  return (msgType && MSG_TYPE_LABEL[msgType]) || '[הודעה]'
}

export const STATUS_LABEL: Record<string, string> = {
  sent:      'נשלח',
  delivered: 'נמסר',
  read:      'נקרא',
  failed:    'נכשל',
}

export const isMsgStatus = (v: unknown): v is 'sent' | 'delivered' | 'read' | 'failed' =>
  typeof v === 'string' && ['sent', 'delivered', 'read', 'failed'].includes(v)
