// lib/gemini.ts — shared Gemini file/URL analysis, used by every upload flow
// (passport photos, instructor certificates, and the admin /admin/coordinator/gemini
// tool) so every image, video, or PDF that comes into the app is read through the
// same Gemini API call — never a different OCR/vision service.
import { GoogleGenAI, createUserContent, createPartFromUri, type File as GeminiFile } from "@google/genai";

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
 *
 * The link rule: any reply that mentions a specific camp/workshop/class's
 * details must close with that exact page's link — never a bare textual
 * description, never a guessed URL. The only links it's allowed to use are
 * the ones already present in knowledgeBase/dynamicContext (each camp/
 * workshop/class section there carries its own "הרשמה: https://..." line —
 * see lib/whatsapp-knowledge.ts and lib/site-content.ts); if none fits, the
 * iron rule above applies and this should come back unsure instead.
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

כלל קישורים: כל תשובה שמזכירה פרטים על מחנה, סדנה או חוג ספציפי (שם, תאריכים, מחיר, זמינות וכו') חייבת להסתיים בקישור לעמוד ההרשמה/המידע של אותו מחנה/סדנה/חוג עצמו — לא רק בתיאור מילולי, ולא קישור לעמוד הבית או לעמוד כללי אחר. השתמש אך ורק בקישור שמופיע במפורש במידע שלמטה (למשל שורת "הרשמה: https://..." שמצורפת לכל מחנה/סדנה/חוג בבסיס הידע, או קישור שמופיע במידע העדכני מהאתר) — אם אין קישור מתאים במידע הנתון, אל תמציא כתובת בעצמך; במקרה כזה סמן "unsure": true במקום לנחש קישור.

${knowledgeBase}

${dynamicContext ? `## מידע עדכני שנמשך מהאתר עכשיו\n${dynamicContext}\n` : ''}
${styleExamples ? `## דוגמאות סגנון מתשובות אמיתיות שהצוות נתן בעבר — לסגנון וטון בלבד, לא למחירים/עובדות (אלה עשויים להשתנות; המידע העובדתי היחיד הקביל הוא מה שמופיע למעלה)\n${styleExamples}\n` : ''}
## השיחה עד כה (הישן למעלה)
${transcript}

## הפורמט הנדרש
החזר אך ורק אובייקט JSON תקני, בלי טקסט נוסף לפניו או אחריו, במבנה הזה בדיוק:
{"reply": "<טיוטת התשובה בעברית ללקוח, או מחרוזת ריקה אם unsure>", "unsure": true|false, "category": "<אחת מ: price, dates, availability, hours, registration_link, other>"}

category משקף את נושא השאלה האחרונה של הלקוח: price=מחיר, dates=תאריכים, availability=האם יש מקום פנוי, hours=שעות פעילות, registration_link=קישור להרשמה, other=כל דבר אחר.`

  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  })
  return parseSuggestion(res.text ?? '')
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
