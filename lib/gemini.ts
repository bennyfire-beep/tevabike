// lib/gemini.ts — shared Gemini file/URL analysis, used by every upload flow
// (passport photos, instructor certificates, and the admin /admin/coordinator/gemini
// tool) so every image, video, or PDF that comes into the app is read through the
// same Gemini API call — never a different OCR/vision service.
import { GoogleGenAI, createUserContent, createPartFromUri, type File as GeminiFile } from "@google/genai";
import { callGroq, callGroqVision, transcribeGroqAudio } from "@/lib/groq";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const GEMINI_MODEL = "gemini-3-flash-preview";
const INLINE_LIMIT = 15 * 1024 * 1024;

export function isYouTubeUrl(u: string) {
  return /(^https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(u);
}

async function waitActive(f: GeminiFile) {
  while (f.state === "PROCESSING") {
    await new Promise((r) => setTimeout(r, 2000));
    f = await ai.files.get({ name: f.name! });
  }
  if (f.state === "FAILED") throw new Error("Gemini file processing failed");
  return f;
}

/** Sends an uploaded File (image/video/PDF/text) straight to Gemini and returns its text reply. */
export async function analyzeFileWithGemini(file: File, prompt: string): Promise<string> {
  const mimeType = file.type || "application/octet-stream";
  const isVideo = mimeType.startsWith("video/");
  let contents;
  if (isVideo || file.size > INLINE_LIMIT) {
    const f = await waitActive(await ai.files.upload({ file, config: { mimeType } }));
    contents = createUserContent([createPartFromUri(f.uri!, f.mimeType!), prompt]);
  } else {
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    contents = createUserContent([{ inlineData: { mimeType, data } }, prompt]);
  }
  const res = await ai.models.generateContent({ model: GEMINI_MODEL, contents });
  return res.text ?? "";
}

/**
 * Turns an inbound WhatsApp image or voice note into Hebrew text, so the
 * auto-reply pipeline has something to react to instead of a "[תמונה]"/
 * "[הקלטה]" placeholder.
 *
 * Safety: the image prompt explicitly forbids identifying or guessing any
 * person's identity. This is not a restriction we're choosing to relax later
 * for anyone (including staff) — general-purpose vision models are already
 * trained not to do facial recognition of private individuals, and there is
 * no reliable way to have Gemini recognize one specific named person without
 * a reference photo to compare against; that would be a separate, far more
 * sensitive face-matching feature, not a prompt tweak.
 */
export async function describeInboundMedia(
  data: Buffer,
  mimeType: string,
  kind: 'image' | 'audio',
): Promise<string> {
  const prompt = kind === 'image'
    ? `תאר בעברית, בקצרה (1-3 משפטים), מה רואים בתמונה הזו — חפצים, פעילות, מקום, טקסט גלוי אם יש (כמו שלט, הודעת שגיאה, צילום מסך).
כלל ברזל: אסור לזהות, לנחש, או לציין שם של אף אדם שמופיע בתמונה — גם אם אתה "חושב" שאתה מזהה מיהו. תיאור אדם מותר רק באופן כללי (למשל "רוכב אופניים", "ילד/ה", "קבוצת אנשים"), לעולם לא בניחוש זהות.`
    : `תמלל לעברית את מה שנאמר בהודעה הקולית הזו. אם השמע לא ברור או לא מובן, כתוב זאת במפורש במקום לנחש מה נאמר.`

  // Groq first, same reasoning and same trivial-to-reverse order as
  // suggestWhatsAppReply: Gemini's free tier is exhausted for the day well
  // before real traffic shows up, so trying it first just adds latency to
  // every image/voice note for a call that's going to fail anyway.
  try {
    return kind === 'image'
      ? await callGroqVision(prompt, data.toString('base64'), mimeType)
      : await transcribeGroqAudio(data, mimeType)
  } catch (e) {
    console.error(`[gemini] describeInboundMedia (${kind}): Groq call failed, trying Gemini fallback:`, (e as Error).message)
    try {
      let contents
      if (data.length > INLINE_LIMIT) {
        const blob = new Blob([new Uint8Array(data)], { type: mimeType })
        const f = await waitActive(await ai.files.upload({ file: blob, config: { mimeType } }))
        contents = createUserContent([createPartFromUri(f.uri!, f.mimeType!), prompt])
      } else {
        contents = createUserContent([{ inlineData: { mimeType, data: data.toString('base64') } }, prompt])
      }
      const res = await ai.models.generateContent({ model: GEMINI_MODEL, contents })
      return (res.text ?? '').trim()
    } catch (e2) {
      console.error(`[gemini] describeInboundMedia (${kind}): Gemini fallback also failed:`, (e2 as Error).message)
      return ''
    }
  }
}

export type WhatsAppHistoryMessage = { direction: 'inbound' | 'outbound'; body: string }

/**
 * The whitelist categories stage 4 (auto-send) will key off — kept here now,
 * one stage early, so every suggestion is already labeled by the time that
 * whitelist logic exists. 'other' is everything not on the safe list:
 * payment, cancellation, medical/limitations, complaints, anything else.
 */
export type WhatsAppSuggestionCategory = 'price' | 'dates' | 'availability' | 'hours' | 'registration_link' | 'other'
const SUGGESTION_CATEGORIES: WhatsAppSuggestionCategory[] = [
  'price', 'dates', 'availability', 'hours', 'registration_link', 'other',
]

export type WhatsAppSuggestion = {
  /** '' whenever unsure is true — never hand back customer-facing text without checking unsure first. */
  text: string
  unsure: boolean
  category: WhatsAppSuggestionCategory
}

const UNSURE_FALLBACK: WhatsAppSuggestion = { text: '', unsure: true, category: 'other' }

/**
 * Drafts one suggested WhatsApp reply — suggest-only: this is text for a
 * coordinator to review, send as-is, edit, or reject, never sent on its own.
 * knowledgeBase is the static policy/schedule text (lib/whatsapp-knowledge.ts);
 * dynamicContext is prices/dates pulled live at call time (lib/site-content.ts);
 * styleExamples is real past question→answer pairs (lib/whatsapp-reply-examples.ts)
 * — tone only, deliberately kept separate from knowledgeBase so a stale price
 * in an old example can never out-rank the real one.
 *
 * The iron rule: never invent a fact that isn't in the context below. Gemini
 * is asked to reply with structured JSON so "I don't actually know this" is
 * a real, machine-checkable `unsure: true` rather than free text a
 * coordinator might miss and send as if it were solid.
 */
export async function suggestWhatsAppReply(
  history: WhatsAppHistoryMessage[],
  knowledgeBase: string,
  dynamicContext: string,
  styleExamples: string = '',
): Promise<WhatsAppSuggestion> {
  const transcript = history
    .map(m => `${m.direction === 'inbound' ? 'לקוח' : 'טבע בייק'}: ${m.body}`)
    .join('\n')

  const prompt = `אתה עוזר לרכז/ת של טבע בייק לנסח טיוטת תשובה בוואטסאפ ללקוח.
זו הצעה בלבד — קואורדינטור אנושי יקרא, ורק אז ישלח כמו שהיא, יערוך, או ידחה אותה.

כלל ברזל: אסור להמציא עובדה, מחיר, תאריך או מדיניות שלא מופיעים במפורש במידע שלמטה. אם התשובה הבטוחה לא נמצאת שם — אל תנחש: סמן "unsure": true והחזר "reply" כמחרוזת ריקה.
סמן "unsure": true גם כשמדובר בתשלום/החזר כספי, מצב רפואי/מגבלה גופנית, תלונה, או כל בקשה חריגה שלא מכוסה במפורש למטה — אלה תמיד עוברים לבן אדם, גם אם יש לך ניחוש סביר.

כשההודעה האחרונה של הלקוח היא פתיחה כללית/עמומה בלי נושא ברור (למשל "היי", "מה נשמע", "יש לכם משהו מעניין?") — אל תניח מראש שהכוונה לחוגים דווקא. תן סקירה קצרה של כל מה שפעיל/פתוח כרגע לפי המידע למטה (חוגים, סדנאות פתוחות, טיולים פתוחים) ושאל במה מעוניינים. תמיד בקצרה ולעניין — לא לפרט את כל המחירים/תאריכים בהודעת הפתיחה עצמה, זה יגיע בהמשך השיחה.

כלל עדכניות: "השיחה עד כה" למטה היא היסטוריה בלבד — היא עשויה לשקף מצב שכבר השתנה (למשל טיול/סדנה שהיו פתוחים והוצגו בתשובה קודמת, ונסגרו מאז). אם עובדה שהוזכרה בהודעה קודמת שלך באותה שיחה סותרת את "מידע עדכני שנמשך מהאתר עכשיו" למטה, או שלא מופיעה בו יותר — המידע העדכני תמיד גובר. אל תחזור על אפשרות/מחיר/תאריך רק כי הם הוזכרו קודם בשיחה אם הם לא מופיעים גם במידע העדכני של הפנייה הנוכחית.

כלל עיצוב: זו הודעת WhatsApp, לא Markdown. WhatsApp מזהה **רק** כוכבית בודדת ל-*מודגש* וקו תחתון ל-_נטוי_ — אסור להשתמש בכוכבית כפולה (**כמו זה**), כותרות עם #, או טבלאות, כי הלקוח יראה תווים גולמיים במקום עיצוב. אין להשתמש בכותרות-קטגוריה מודגשות עם רשימות ארוכות תחתן — זה נראה "בלאגן" למרות שהמידע נכון. עדיף פסקה קצרה או עד 2-3 שורות תבליט פשוטות (עם ‑ או •) על פני חלוקה לכמה קטגוריות מודגשות בהודעה אחת.

${knowledgeBase}

${dynamicContext ? `## מידע עדכני שנמשך מהאתר עכשיו\n${dynamicContext}\n` : ''}
${styleExamples ? `## דוגמאות סגנון מתשובות אמיתיות שהצוות נתן בעבר — לסגנון וטון בלבד, לא למחירים/עובדות (אלה עשויים להשתנות; המידע העובדתי היחיד הקביל הוא מה שמופיע למעלה)\n${styleExamples}\n` : ''}
## השיחה עד כה (הישן למעלה)
${transcript}

## הפורמט הנדרש
החזר אך ורק אובייקט JSON תקני, בלי טקסט נוסף לפניו או אחריו, במבנה הזה בדיוק:
{"reply": "<טיוטת התשובה בעברית ללקוח, או מחרוזת ריקה אם unsure>", "unsure": true|false, "category": "<אחת מ: price, dates, availability, hours, registration_link, other>"}

category משקף את נושא השאלה האחרונה של הלקוח: price=מחיר, dates=תאריכים, availability=האם יש מקום פנוי, hours=שעות פעילות, registration_link=קישור להרשמה, other=כל דבר אחר.`

  // Groq is tried FIRST, Gemini second — the reverse of this pipeline's
  // original order. Confirmed live: gemini-3-flash-preview's free tier is
  // capped at 20 requests/day and stays exhausted for the rest of any day
  // real traffic shows up, so every single message was paying the latency of
  // a guaranteed-to-fail Gemini call before ever reaching Groq — measured
  // contributing to an actual 30s webhook timeout. Groq has already been
  // answering 100% of real traffic today regardless of which one goes first;
  // this just stops paying for the doomed attempt. Trivially reversible
  // (swap the two blocks back) once Gemini has a paid tier or its quota is
  // reliably available again.
  let raw = ''
  try {
    raw = await callGroq(prompt)
  } catch (e) {
    console.error('[gemini] suggestWhatsAppReply: Groq call failed, trying Gemini fallback:', (e as Error).message)
    try {
      const res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      })
      raw = res.text ?? ''
    } catch (e2) {
      console.error('[gemini] suggestWhatsAppReply: Gemini fallback also failed:', (e2 as Error).message)
    }
  }
  return parseSuggestion(raw)
}

function parseSuggestion(raw: string): WhatsAppSuggestion {
  // JSON response mode should mean `raw` is already clean JSON, but strip a
  // stray ```json fence defensively — cheap insurance against an SDK/model
  // edge case, not the normal path.
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  if (!cleaned) return UNSURE_FALLBACK

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (e) {
    console.error('[gemini] suggestWhatsAppReply: non-JSON response:', (e as Error).message, cleaned.slice(0, 200))
    return UNSURE_FALLBACK
  }

  if (typeof parsed !== 'object' || parsed === null) return UNSURE_FALLBACK
  const p = parsed as Record<string, unknown>
  const text = typeof p.reply === 'string' ? p.reply.trim() : ''
  // Fail toward unsure: a missing/malformed flag, or an empty reply, both mean "don't trust this".
  const unsure = p.unsure !== false || !text
  const category = SUGGESTION_CATEGORIES.includes(p.category as WhatsAppSuggestionCategory)
    ? (p.category as WhatsAppSuggestionCategory)
    : 'other'

  return unsure ? { text: '', unsure: true, category } : { text, unsure: false, category }
}

/** Fetches a URL (YouTube link, or a direct link to an image/video/PDF already in
 *  storage) and sends it to Gemini. Used when the file itself already left the
 *  request — e.g. a public Supabase Storage URL. */
export async function analyzeUrlWithGemini(url: string, prompt: string): Promise<string> {
  if (isYouTubeUrl(url)) {
    const res = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: createUserContent([{ fileData: { fileUri: url } }, prompt]),
    });
    return res.text ?? "";
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch failed ${r.status}`);
  const mimeType = r.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
  const blob = new Blob([await r.arrayBuffer()], { type: mimeType });
  const f = await waitActive(await ai.files.upload({ file: blob, config: { mimeType } }));
  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: createUserContent([createPartFromUri(f.uri!, f.mimeType!), prompt]),
  });
  return res.text ?? "";
}
