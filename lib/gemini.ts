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
 * Drafts one suggested WhatsApp reply — suggest-only: this is text for a
 * coordinator to review and edit before sending, never sent on its own.
 * knowledgeBase is the static policy/schedule text (lib/whatsapp-knowledge.ts);
 * dynamicContext is prices/dates pulled live at call time (lib/site-content.ts);
 * styleExamples is real past question→answer pairs (lib/whatsapp-reply-examples.ts)
 * — tone only, deliberately kept separate from knowledgeBase so a stale price
 * in an old example can never out-rank the real one.
 */
export async function suggestWhatsAppReply(
  history: WhatsAppHistoryMessage[],
  knowledgeBase: string,
  dynamicContext: string,
  styleExamples: string = '',
): Promise<string> {
  const transcript = history
    .map(m => `${m.direction === 'inbound' ? 'לקוח' : 'טבע בייק'}: ${m.body}`)
    .join('\n')

  const prompt = `אתה עוזר לרכז/ת של טבע בייק לנסח טיוטת תשובה בוואטסאפ ללקוח.
זו הצעה בלבד — קואורדינטור אנושי יקרא, יערוך במידת הצורך, ורק אז ישלח. אל תמציא עובדות, מחירים או תאריכים שלא מופיעים במידע שלמטה; אם משהו לא ידוע — תגיד "לבדוק מול הצוות" במקום לנחש.

${knowledgeBase}

${dynamicContext ? `## מידע עדכני שנמשך מהאתר עכשיו\n${dynamicContext}\n` : ''}
${styleExamples ? `## דוגמאות סגנון מתשובות אמיתיות שהצוות נתן בעבר — לסגנון וטון בלבד, לא למחירים/עובדות (אלה עשויים להשתנות; המידע העובדתי היחיד הקביל הוא מה שמופיע למעלה)\n${styleExamples}\n` : ''}
## השיחה עד כה (הישן למעלה)
${transcript}

כתוב אך ורק את הטיוטה המוצעת להודעה הבאה של טבע בייק ללקוח — בלי הקדמות, בלי "הנה הצעה", רק את הטקסט עצמו.`

  const res = await ai.models.generateContent({ model: GEMINI_MODEL, contents: prompt })
  return (res.text ?? '').trim()
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
