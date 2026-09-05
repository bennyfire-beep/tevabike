import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { whatsappServiceClient } from '@/lib/whatsapp-server'
import { bodyLabel, isMsgStatus } from '@/lib/whatsapp'
import { notifyInbound } from '@/lib/whatsapp-notify'
import { maybeAutoReply } from '@/lib/whatsapp-autoreply'

// Meta WhatsApp Cloud API webhook — one URL, two jobs:
//   GET  — the handshake Meta does once, when the webhook is configured.
//   POST — every event afterwards: inbound messages and outbound status updates.
//
// POST must answer fast and with 200 even for events we don't handle, or Meta
// treats the endpoint as broken and starts retrying / eventually unsubscribes.
// So every branch below is wrapped so a bad payload logs instead of throwing.

export const dynamic = 'force-dynamic'
// The stage-4 auto-reply path (lib/whatsapp-autoreply.ts) now runs inline
// here — same Gemini + dynamic-site-content pipeline as /api/whatsapp/suggest,
// which already needed 30s (see its own maxDuration) — so this needs the same
// headroom, or a slow Gemini/site-fetch call gets killed mid-request on
// Vercel's default function timeout before it can send or log anything.
export const maxDuration = 30

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

type UpsertedConversation = { id: string; assignedTo: string | null }

async function upsertConversationForInbound(
  admin: SupabaseClient,
  waId: string,
  displayName: string | null,
  when: string,
): Promise<UpsertedConversation | null> {
  const { data: existing } = await admin
    .from('whatsapp_conversations')
    .select('id, unread_count, assigned_to')
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
    return { id: existing.id, assignedTo: existing.assigned_to ?? null }
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
  return created ? { id: created.id, assignedTo: null } : null
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

  const conversation = await upsertConversationForInbound(admin, waId, displayName, when)
  if (!conversation) return

  const msgType = message.type || 'unsupported'
  const text = msgType === 'text' ? (message.text?.body ?? '') : ''
  const body = bodyLabel(msgType, text)

  const { error, data: inserted } = await admin
    .from('whatsapp_messages')
    .upsert(
      {
        conversation_id: conversation.id,
        wa_message_id: message.id,
        direction: 'inbound',
        msg_type: msgType,
        body,
        created_at: when,
      },
      { onConflict: 'wa_message_id', ignoreDuplicates: true },
    )
    .select('id')
  if (error) console.error('[whatsapp/webhook] message insert failed:', error.message)

  // Push + personal-number alert, then stage-4 auto-reply. Only for a message
  // we actually just inserted (ignoreDuplicates leaves `inserted` empty on a
  // Meta retry) — best-effort and fully awaited: an un-awaited send on Vercel
  // can get killed the moment this function's response goes out, same lesson
  // as the /shop supplier email.
  if (!error && inserted && inserted.length > 0) {
    await notifyInbound(admin, {
      conversationId: conversation.id,
      assignedTo: conversation.assignedTo,
      senderName: displayName ?? '',
      senderPhone: waId,
      preview: body,
    })

    // Auto-reply only ever drafts off actual typed text — never guess a
    // response to an image/sticker/location/etc., that stays a human's call.
    if (msgType === 'text' && text.trim()) {
      await maybeAutoReply(admin, {
        conversationId: conversation.id,
        waId,
        inboundMessageId: inserted[0].id,
        lastInboundAt: when,
      })
    }
  }
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
