import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { whatsappServiceClient } from '@/lib/whatsapp-server'
import { bodyLabel, isMsgStatus } from '@/lib/whatsapp'

// Meta WhatsApp Cloud API webhook — one URL, two jobs:
//   GET  — the handshake Meta does once, when the webhook is configured.
//   POST — every event afterwards: inbound messages and outbound status updates.
//
// POST must answer fast and with 200 even for events we don't handle, or Meta
// treats the endpoint as broken and starts retrying / eventually unsubscribes.
// So every branch below is wrapped so a bad payload logs instead of throwing.

export const dynamic = 'force-dynamic'

// Not a secret worth rotating carefully — Meta sends it back verbatim on the
// GET handshake, it never touches a message. process.env wins when set; this
// is just so the webhook works before Vercel env vars are configured.
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'tevabike-wa-2026'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge') ?? ''

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// ── Types for the slice of the Meta payload we read ──
type WaContact = { profile?: { name?: string }; wa_id?: string }
type WaTextMessage = {
  id: string
  from: string
  timestamp: string
  type: string
  text?: { body?: string }
}
type WaStatus = {
  id: string
  status: string
  errors?: { title?: string; message?: string }[]
}
type WaChangeValue = {
  contacts?: WaContact[]
  messages?: WaTextMessage[]
  statuses?: WaStatus[]
}

async function upsertConversationForInbound(
  admin: SupabaseClient,
  waId: string,
  displayName: string | null,
  when: string,
): Promise<string | null> {
  const { data: existing } = await admin
    .from('whatsapp_conversations')
    .select('id, unread_count')
    .eq('wa_id', waId)
    .maybeSingle()

  if (existing) {
    const currentUnread = existing.unread_count ?? 0
    const { error } = await admin
      .from('whatsapp_conversations')
      .update({
        display_name: displayName ?? undefined,
        last_message_at: when,
        last_inbound_at: when,
        unread_count: currentUnread + 1,
      })
      .eq('id', existing.id)
    if (error) console.error('[whatsapp/webhook] conversation update failed:', error.message)
    return existing.id
  }

  const { data: created, error } = await admin
    .from('whatsapp_conversations')
    .insert({
      wa_id: waId,
      display_name: displayName,
      last_message_at: when,
      last_inbound_at: when,
      unread_count: 1,
    })
    .select('id')
    .single()
  if (error) {
    console.error('[whatsapp/webhook] conversation insert failed:', error.message)
    return null
  }
  return created?.id ?? null
}

async function handleInboundMessage(
  admin: SupabaseClient,
  message: WaTextMessage,
  contact: WaContact | undefined,
) {
  const waId = contact?.wa_id || message.from
  if (!waId) return
  const displayName = contact?.profile?.name ?? null
  const when = new Date(Number(message.timestamp) * 1000 || Date.now()).toISOString()

  const conversationId = await upsertConversationForInbound(admin, waId, displayName, when)
  if (!conversationId) return

  const msgType = message.type || 'unsupported'
  const text = msgType === 'text' ? (message.text?.body ?? '') : ''
  const body = bodyLabel(msgType, text)

  const { error } = await admin
    .from('whatsapp_messages')
    .upsert(
      {
        conversation_id: conversationId,
        wa_message_id: message.id,
        direction: 'inbound',
        msg_type: msgType,
        body,
        created_at: when,
      },
      { onConflict: 'wa_message_id', ignoreDuplicates: true },
    )
  if (error) console.error('[whatsapp/webhook] message insert failed:', error.message)
}

async function handleStatus(admin: SupabaseClient, status: WaStatus) {
  if (!isMsgStatus(status.status)) return // e.g. "deleted" — nothing to record
  const patch: { status: string; error_detail?: string } = { status: status.status }
  if (status.status === 'failed' && status.errors?.length) {
    patch.error_detail = status.errors.map(e => e.title || e.message).filter(Boolean).join('; ')
  }
  const { error } = await admin
    .from('whatsapp_messages')
    .update(patch)
    .eq('wa_message_id', status.id)
  if (error) console.error('[whatsapp/webhook] status update failed:', error.message)
}

export async function POST(req: NextRequest) {
  try {
    const admin = whatsappServiceClient()
    if (!admin) return NextResponse.json({ received: true }) // still 200 — misconfigured server shouldn't make Meta retry forever

    const payload = await req.json().catch(() => null)
    const entries = payload?.entry ?? []

    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const value: WaChangeValue | undefined = change?.value
        if (!value) continue

        for (const message of value.messages ?? []) {
          const contact = value.contacts?.find(c => c.wa_id === message.from) ?? value.contacts?.[0]
          await handleInboundMessage(admin, message, contact)
        }
        for (const status of value.statuses ?? []) {
          await handleStatus(admin, status)
        }
      }
    }
  } catch (e) {
    console.error('[whatsapp/webhook] unhandled error:', (e as Error).message)
  }

  // Always 200: an unhandled/unknown event type is not a failure worth a retry.
  return NextResponse.json({ received: true })
}
