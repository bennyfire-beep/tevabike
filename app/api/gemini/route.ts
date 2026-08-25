// app/api/gemini/route.ts — Teva Bike shared Gemini endpoint (v3: file OR url, YouTube supported)
// מקבל קובץ (multipart "file") או קישור ("url" — יוטיוב או קישור ישיר לוידאו/תמונה) + פרומפט
import { createClient } from "@supabase/supabase-js";
import { analyzeFileWithGemini, analyzeUrlWithGemini, GEMINI_MODEL } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

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

    const text = file
      ? await analyzeFileWithGemini(file, prompt)
      : await analyzeUrlWithGemini(url, prompt);

    return Response.json({ text, model: GEMINI_MODEL });
  } catch (e: any) {
    console.error("gemini route error", e);
    return Response.json({ error: e?.message || "gemini error" }, { status: 500 });
  }
}
