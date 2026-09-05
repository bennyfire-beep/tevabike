import { WHATSAPP_GRAPH_VERSION } from '@/lib/whatsapp'

// lib/whatsapp-media.ts — downloads inbound WhatsApp media (image/audio) from
// Meta's Graph API. The webhook payload only ever carries a media id, never
// the file itself — this is the two-step fetch Meta requires: id -> a
// short-lived signed URL -> the actual bytes, both calls needing our own
// access token as bearer auth.

export type WhatsAppMedia = { data: Buffer; mimeType: string }

/** Downloads one piece of inbound media by its Meta media id. Throws on any failure — the caller (best-effort in the webhook) decides what "couldn't fetch it" means. */
export async function fetchWhatsAppMedia(mediaId: string): Promise<WhatsAppMedia> {
  const token = process.env.WHATSAPP_TOKEN
  if (!token) throw new Error('WHATSAPP_TOKEN not configured')

  const metaRes = await fetch(`https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!metaRes.ok) throw new Error(`media metadata fetch failed: ${metaRes.status}`)
  const meta = await metaRes.json()
  const url = meta?.url as string | undefined
  const mimeType = (meta?.mime_type as string | undefined) || 'application/octet-stream'
  if (!url) throw new Error('media metadata missing url')

  const fileRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!fileRes.ok) throw new Error(`media download failed: ${fileRes.status}`)
  const data = Buffer.from(await fileRes.arrayBuffer())
  return { data, mimeType }
}
