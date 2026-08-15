// app/api/gemini/route.ts — Teva Bike shared Gemini endpoint (v1)
// מקבל קובץ (טקסט / תמונה / וידאו) + פרומפט, מחזיר ניתוח מ-Gemini
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 60;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = "gemini-3-flash-preview";
const INLINE_LIMIT = 15 * 1024 * 1024; // מעל 15MB או וידאו → Files API

export async function POST(req: Request) {
  try {
    const secret = process.env.GEMINI_ROUTE_SECRET;
    if (secret && req.headers.get("x-api-secret") !== secret) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const prompt =
      (form.get("prompt") as string) || "נתח את הקובץ וסכם בעברית בצורה ברורה.";
    if (!file) return Response.json({ error: "no file" }, { status: 400 });

    const mimeType = file.type || "application/octet-stream";
    const isVideo = mimeType.startsWith("video/");
    let contents;

    if (isVideo || file.size > INLINE_LIMIT) {
      let f = await ai.files.upload({ file, config: { mimeType } });
      while (f.state === "PROCESSING") {
        await new Promise((r) => setTimeout(r, 2000));
        f = await ai.files.get({ name: f.name! });
      }
      if (f.state === "FAILED") throw new Error("Gemini file processing failed");
      contents = createUserContent([createPartFromUri(f.uri!, f.mimeType!), prompt]);
    } else {
      const data = Buffer.from(await file.arrayBuffer()).toString("base64");
      contents = createUserContent([{ inlineData: { mimeType, data } }, prompt]);
    }

    const res = await ai.models.generateContent({ model: MODEL, contents });
    return Response.json({ text: res.text, model: MODEL });
  } catch (e: any) {
    console.error("gemini route error", e);
    return Response.json({ error: e?.message || "gemini error" }, { status: 500 });
  }
}

