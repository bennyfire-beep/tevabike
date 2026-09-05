import type { SupabaseClient } from '@supabase/supabase-js'
import { suggestWhatsAppReply, type WhatsAppSuggestionCategory } from '@/lib/gemini'
import { WHATSAPP_KNOWLEDGE_BASE } from '@/lib/whatsapp-knowledge'
import { fetchDynamicSiteContent } from '@/lib/site-content'
import { formatReplyExamples } from '@/lib/whatsapp-reply-examples'
import { sendWhatsAppText } from '@/lib/whatsapp-send'
import { isReplyWindowOpen } from '@/lib/whatsapp'

// Stage 4: auto-send, called from the webhook right after a new inbound text
// message is saved — the fully-automatic sibling of the coordinator's "הצע
// תשובה" button (app/api/whatsapp/suggest). Same Gemini call, same knowledge
// sources, but no human clicks anything for the categories below.
//
// The gate is deliberately narrow: only plain facts Gemini is already
// forbidden from guessing at (see the iron rule in suggestWhatsAppReply) go
// out untouched. Payment/refunds, health/medical, complaints, 'other', and
// every `unsure: true` — always wait for a coordinator, exactly as before
// this existed. Widening this list is a product decision, not a bug fix.
const AUTO_SEND_CATEGORIES: WhatsAppSuggestionCategory[] = [
  'price', 'dates', 'availability', 'hours', 'registration_link',
]

const BOT_SIGNATURE = 'טבע בייק'
const BOT_SENT_BY = 'בוט (אוטומטי)'

const HISTORY_LIMIT = 15
const EXAMPLES_LIMIT = 15

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
    if (!process.env.GEMINI_API_KEY) return
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

    const safeToAutoSend =
      !suggestion.unsure &&
      !!suggestion.text &&
      AUTO_SEND_CATEGORIES.includes(suggestion.category as WhatsAppSuggestionCategory)
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
