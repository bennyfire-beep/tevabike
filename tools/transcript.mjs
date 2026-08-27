#!/usr/bin/env node
// transcript.mjs — תמלול מ‑YouTube / TikTok / Instagram / X / Facebook דרך Supadata.
// דורש: SUPADATA_API_KEY בסביבה.  שימוש: node transcript.mjs "<url>" [lang]
const KEY = process.env.SUPADATA_API_KEY || '';
const url = process.argv[2], lang = process.argv[3] || '';
if (!url) { console.error('usage: node transcript.mjs "<url>" [lang]'); process.exit(1); }
if (!KEY) { console.error('No SUPADATA_API_KEY. Free key: https://supadata.ai'); process.exit(3); }
const p = new URLSearchParams({ url, text: 'true' }); if (lang) p.set('lang', lang);
const r = await fetch('https://api.supadata.ai/v1/transcript?' + p, { headers: { 'x-api-key': KEY } });
const raw = await r.text();
if (r.status === 401) { console.error('Invalid key (401).'); process.exit(3); }
if (r.status === 429) { console.error('Quota exhausted (429).'); process.exit(2); }
let d; try { d = JSON.parse(raw); } catch { d = null; }
if (!r.ok || (d && d.error)) { console.error('Error: ' + (d && d.message || raw).slice(0, 160)); process.exit(4); }
const text = d && typeof d.content === 'string' ? d.content
  : d && Array.isArray(d.content) ? d.content.map(s => s.text).join(' ') : raw;
if (!text.trim()) { console.error('No transcript available.'); process.exit(4); }
if (d && d.availableLangs) console.error('(langs: ' + d.availableLangs.join(', ') + ')');
process.stdout.write(text.trim() + '\n');
