// app/api/gemini/route.ts — Teva Bike shared Gemini endpoint (v3: file OR url, YouTube supported)
// מקבל קובץ (multipart "file") או קישור ("url" — יוטיוב או קישור ישיר לוידאו/תמונה) + פרומפט
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = "gemini-3-flash-preview";
const INLINE_LIMIT = 15 * 1024 * 1024;
const DEFAULT_PROMPT = "נתח את הקובץ וסכם בעברית בצורה ברורה.";

async function isAuthorized(req: Request): Promise<boolean> {
  const secret = process.env.GEMINI_ROUTE_SECRET;
  if (secret && req.headers.get("x-api-secret") === secret) return true;
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const supa = createClient(url, key);
  const { data: { user } } = await supa.auth.getUser(token);
  if (!user) return false;
  const { data: role } = await supa.from("admin_roles").select("id").eq("user_id", user.id).limit(1);
  return !!role && role.length > 0;
}

function isYouTube(u: string) {
  return /(^https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(u);
}

async function waitActive(f: any) {
  while (f.state === "PROCESSING") {
    await new Promise((r) => setTimeout(r, 2000));
    f = await ai.files.get({ name: f.name! });
  }
  if (f.state === "FAILED") throw new Error("Gemini file processing failed");
  return f;
}

export async function POST(req: Request) {
  try {
    if (!(await isAuthorized(req))) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    let file: File | null = null;
    let url = "";
    let prompt = DEFAULT_PROMPT;
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const body = await req.json();
      url = (body.url || "").trim();
      prompt = body.prompt || DEFAULT_PROMPT;
    } else {
      const form = await req.formData();
      file = form.get("file") as File | null;
      url = ((form.get("url") as string) || "").trim();
      prompt = (form.get("prompt") as string) || DEFAULT_PROMPT;
    }
    if (!file && !url) return Response.json({ error: "no file or url" }, { status: 400 });

    let contents;

    if (file) {
      const mimeType = file.type || "application/octet-stream";
      const isVideo = mimeType.startsWith("video/");
      if (isVideo || file.size > INLINE_LIMIT) {
        const f = await waitActive(await ai.files.upload({ file, config: { mimeType } }));
        contents = createUserContent([createPartFromUri(f.uri!, f.mimeType!), prompt]);
      } else {
        const data = Buffer.from(await file.arrayBuffer()).toString("base64");
        contents = createUserContent([{ inlineData: { mimeType, data } }, prompt]);
      }
    } else if (isYouTube(url)) {
      contents = createUserContent([{ fileData: { fileUri: url } }, prompt]);
    } else {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`fetch failed ${r.status}`);
      const mimeType = r.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
      const blob = new Blob([await r.arrayBuffer()], { type: mimeType });
      const f = await waitActive(await ai.files.upload({ file: blob, config: { mimeType } }));
      contents = createUserContent([createPartFromUri(f.uri!, f.mimeType!), prompt]);
    }

    const res = await ai.models.generateContent({ model: MODEL, contents });
    return Response.json({ text: res.text, model: MODEL });
  } catch (e: any) {
    console.error("gemini route error", e);
    return Response.json({ error: e?.message || "gemini error" }, { status: 500 });
  }
}
