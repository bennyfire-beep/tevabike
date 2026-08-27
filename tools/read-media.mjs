#!/usr/bin/env node
// read-media.mjs — קורא תמונה / צילום‑מסך / PDF / אודיו / וידאו דרך Gemini.
// דורש: GEMINI_API_KEY בסביבה.  שימוש: node read-media.mjs "<file>" ["prompt"]
import fs from 'node:fs'; import path from 'node:path';
const API = 'https://generativelanguage.googleapis.com';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const MIME = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.heic':'image/heic','.gif':'image/gif',
  '.pdf':'application/pdf','.mp3':'audio/mp3','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4',
  '.mp4':'video/mp4','.mov':'video/quicktime','.webm':'video/webm' };
const file = process.argv[2];
const prompt = process.argv[3] || 'Describe the file in detail. Transcribe any speech word-for-word. If a screenshot, transcribe all visible text.';
if (!file || !fs.existsSync(file)) { console.error('File not found: ' + file); process.exit(1); }
if (!KEY) { console.error('No GEMINI_API_KEY. Free key: https://aistudio.google.com/apikey'); process.exit(3); }
const mime = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
const cfg = { thinkingConfig: { thinkingBudget: 0 } };
async function gen(parts) {
  const r = await fetch(API + '/v1beta/models/' + MODEL + ':generateContent?key=' + KEY, { method:'POST',
    headers:{'Content-Type':'application/json'}, body:JSON.stringify({ contents:[{ role:'user', parts }], generationConfig:cfg }) });
  const t = await r.text(); if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + t.slice(0,200));
  return (JSON.parse(t).candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
}
const bytes = fs.readFileSync(file);
let out;
if (mime.startsWith('video/') || bytes.length > 18*1024*1024) {
  const s = await fetch(API + '/upload/v1beta/files?key=' + KEY, { method:'POST', headers:{
    'X-Goog-Upload-Protocol':'resumable','X-Goog-Upload-Command':'start',
    'X-Goog-Upload-Header-Content-Length':String(bytes.length),'X-Goog-Upload-Header-Content-Type':mime,
    'Content-Type':'application/json' }, body:JSON.stringify({ file:{ display_name: path.basename(file) } }) });
  const upUrl = s.headers.get('x-goog-upload-url'); if (!upUrl) throw new Error('no upload url');
  let f = JSON.parse(await (await fetch(upUrl, { method:'POST', headers:{
    'X-Goog-Upload-Offset':'0','X-Goog-Upload-Command':'upload, finalize','Content-Length':String(bytes.length) },
    body:bytes })).text()).file;
  for (let i=0; i<60 && f.state!=='ACTIVE'; i++) {
    if (f.state==='FAILED') throw new Error('processing failed');
    await new Promise(res => setTimeout(res, 2000));
    f = await (await fetch(API + '/v1beta/' + f.name + '?key=' + KEY)).json();
  }
  out = await gen([{ text:prompt }, { file_data:{ mime_type:mime, file_uri:f.uri } }]);
} else {
  out = await gen([{ text:prompt }, { inline_data:{ mime_type:mime, data:bytes.toString('base64') } }]);
}
process.stdout.write((out || '(empty)') + '\n');
