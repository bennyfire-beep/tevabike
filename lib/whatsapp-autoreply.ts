import type { SupabaseClient } from '@supabase/supabase-js'
import { suggestWhatsAppReply } from '@/lib/gemini'
import { WHATSAPP_KNOWLEDGE_BASE } from '@/lib/whatsapp-knowledge'
import { fetchDynamicSiteContent } from '@/lib/site-content'
import { formatReplyExamples } from '@/lib/whatsapp-reply-examples'
import { sendWhatsAppText } from '@/lib/whatsapp-send'
import { isReplyWindowOpen } from '@/lib/whatsapp'

// Stage 4: auto-send, called from the webhook right after a new inbound text
// message is saved — the fully-automatic sibling of the coordinator's "הצע
// תשובה" button (app/api/whatsapp/suggest). Same Gemini call, same knowledge
// sources, but no human clicks anything when Gemini is confident.
//
// The gate is just `unsure: false` — no category whitelist on top of it.
// That's not weaker than the original 5-category whitelist: the iron rule in
// suggestWhatsAppReply already forces unsure=true, unconditionally, for
// payment/refunds, health/medical, complaints, and anything not explicitly
// covered by the knowledge base — regardless of what category Gemini tags it
// with. A category gate on top of that only ever blocked *harmless* general
// questions ("היי", "ספר לי על חוג") that Gemini was perfectly confident
// about — which is exactly what real first-contact messages look like — so
// it was dropped; `category` is still logged on every suggestion for
// reporting, just no longer part of the send decision.
const BOT_SIGNATURE = 'טבע בייק'
const BOT_SENT_BY = 'בוט (אוטומטי)'

// Trimmed from 15/15: measured live at ~4,000-4,500 tokens per call at that
// size, enough to blow through Groq's free-tier 8,000 TPM (tokens/minute)
// cap after just two calls in the same minute — confirmed live, a burst of
// suggestion requests across a few conversations started failing with a
// Groq 429 on top of Gemini's already-exhausted one. Fewer messages/examples
// costs little quality for a short WhatsApp exchange and buys real headroom.
const HISTORY_LIMIT = 8
const EXAMPLES_LIMIT = 8

/**
 * Best-effort end to end: every failure here is caught and logged, never
 * thrown — this runs inside the webhook, which must always answer Meta with
 * 200 regardless of what happens in here.
 */
export async function maybeAutoReply(
  admin: SupabaseClient,
  args: { conversationId: string; waId: string; inboundMessageId: string; lastInboundAt: string },
): Promise<void> {
  try {
    // Either provider configured is enough — suggestWhatsAppReply tries Groq
    // first and Gemini second, so this must not gate on Gemini alone.
    if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) return
    if (!isReplyWindowOpen(args.lastInboundAt)) return

    const { data: recent, error: msgErr } = await admin
      .from('whatsapp_messages')
      .select('direction, body, msg_type, created_at')
      .eq('conversation_id', args.conversationId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT)
    if (msgErr || !recent || recent.length === 0) {
      if (msgErr) console.error('[whatsapp-autoreply] history read failed:', msgErr.message)
      return
    }

    const history = recent
      .slice()
      .reverse()
      .map(m => ({ direction: m.direction as 'inbound' | 'outbound', body: m.body ?? `[${m.msg_type ?? 'הודעה'}]` }))

    const { data: examples, error: examplesErr } = await admin
      .from('whatsapp_reply_examples')
      .select('question_text, answer_text')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(EXAMPLES_LIMIT)
    if (examplesErr) console.error('[whatsapp-autoreply] examples read failed:', examplesErr.message)

    const dynamicContext = await fetchDynamicSiteContent(admin)
    const styleExamples = formatReplyExamples(examples ?? [])
    const suggestion = await suggestWhatsAppReply(history, WHATSAPP_KNOWLEDGE_BASE, dynamicContext, styleExamples)

    // Logged either way — same stage-3 tracking table, so an auto-answered
    // conversation shows up in the accuracy numbers exactly like a
    // human-approved one, just tagged with outcome='auto_sent' below.
    const { data: saved, error: insertErr } = await admin
      .from('whatsapp_suggestions')
      .insert({
        conversation_id: args.conversationId,
        inbound_message_id: args.inboundMessageId,
        suggested_text: suggestion.text,
        category: suggestion.category,
        unsure: suggestion.unsure,
      })
      .select('id')
      .single()
    if (insertErr) console.error('[whatsapp-autoreply] suggestion log insert failed:', insertErr.message)

    const safeToAutoSend = !suggestion.unsure && !!suggestion.text
    if (!safeToAutoSend) return

    const result = await sendWhatsAppText(admin, {
      conversationId: args.conversationId,
      waId: args.waId,
      text: `${suggestion.text}\n\n— ${BOT_SIGNATURE}`,
      sentBy: BOT_SENT_BY,
    })
    if (!result.ok) {
      console.error('[whatsapp-autoreply] send failed:', result.error)
      return
    }

    if (saved?.id) {
      const { error: decideErr } = await admin
        .from('whatsapp_suggestions')
        .update({
          outcome: 'auto_sent',
          final_text: suggestion.text,
          outbound_message_id: result.messageId,
          decided_by: 'bot',
          decided_at: new Date().toISOString(),
        })
        .eq('id', saved.id)
      if (decideErr) console.error('[whatsapp-autoreply] outcome update failed:', decideErr.message)
    }
  } catch (e) {
    console.error('[whatsapp-autoreply] unhandled error:', (e as Error).message)
  }
}
