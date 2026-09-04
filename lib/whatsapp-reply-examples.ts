// Real question→answer pairs the team has actually sent before, managed at
// /admin/coordinator/whatsapp-examples and stored in whatsapp_reply_examples.
// These teach Gemini the team's tone — NOT facts. lib/whatsapp-knowledge.ts
// stays the one source of truth for prices/dates/policy; an old example
// containing a since-changed price must never out-rank it, which is why the
// prompt in lib/gemini.ts labels this block "style only" and keeps it
// separate from the knowledge base rather than merging the two.

export type ReplyExample = { question_text: string; answer_text: string }

/** Formats examples into the prompt block suggestWhatsAppReply expects — '' if there are none. */
export function formatReplyExamples(examples: ReplyExample[]): string {
  if (examples.length === 0) return ''
  return examples
    .map(e => `לקוח: ${e.question_text}\nטבע בייק: ${e.answer_text}`)
    .join('\n---\n')
}
