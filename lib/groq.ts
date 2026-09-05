// lib/groq.ts — thin fallback client for Groq's free, OpenAI-compatible API.
//
// Used only when Gemini fails (daily quota, rate limit, outage) so a
// customer-facing WhatsApp reply never just goes silent because one
// provider's quota ran out for the day — confirmed live: Gemini's free tier
// on gemini-3-flash-preview capped at 20 requests/day, and a handful of
// people testing the bot burned through that in an afternoon.
//
// Groq's free tier (14,400 requests/day, 30 RPM, no credit card, ongoing —
// not a trial) comfortably covers this site's WhatsApp volume, and its
// Services Agreement explicitly permits serving End Users through a
// Customer Application, i.e. exactly this use case.

const GROQ_MODEL = 'openai/gpt-oss-120b'

/**
 * Sends `prompt` to Groq (OpenAI-compatible chat completions) and returns the
 * raw text response, asking for JSON back since suggestWhatsAppReply's prompt
 * always specifies a JSON shape regardless of which provider answers it.
 * Throws if GROQ_API_KEY is unset or the request fails — the caller decides
 * what "no answer from either provider" means (currently: unsure=true).
 */
export async function callGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not configured')

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Groq API error ${res.status}: ${detail.slice(0, 300)}`)
  }

  const data = await res.json()
  return data?.choices?.[0]?.message?.content ?? ''
}

const GROQ_VISION_MODEL = 'qwen/qwen3.6-27b'
const GROQ_WHISPER_MODEL = 'whisper-large-v3'

/** Sends `prompt` + one image to Groq's vision-capable model, same fallback role as callGroq but for image description. */
export async function callGroqVision(prompt: string, imageBase64: string, mimeType: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not configured')

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      }],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Groq vision API error ${res.status}: ${detail.slice(0, 300)}`)
  }

  const data = await res.json()
  return (data?.choices?.[0]?.message?.content ?? '').trim()
}

/** Transcribes audio via Groq's hosted Whisper endpoint — the fallback for voice-note understanding when Gemini's quota is exhausted. */
export async function transcribeGroqAudio(data: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not configured')

  const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' : 'ogg'
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(data)], { type: mimeType }), `voice.${ext}`)
  form.append('model', GROQ_WHISPER_MODEL)
  form.append('language', 'he')
  form.append('response_format', 'text')

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Groq transcription API error ${res.status}: ${detail.slice(0, 300)}`)
  }

  return (await res.text()).trim()
}
