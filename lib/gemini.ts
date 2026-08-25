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
