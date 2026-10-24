// HeyGen avatar videos for the site.
//
//   node scripts/heygen.mjs looks              list your avatar looks (pick avatar_id)
//   node scripts/heygen.mjs voices [Hebrew]    list voices in a language (pick voice_id)
//   node scripts/heygen.mjs generate [id ...]  render videos from videos/avatar/scripts.json
//
// Needs HEYGEN_API_KEY in the environment. `generate` submits each script to
// POST /v3/videos, polls GET /v3/videos/{id} until it completes, downloads the
// MP4 to public/videos/avatar/<id>.mp4 and records it in lib/avatar-videos.json,
// which the site reads — a video shows up on the site only once it's listed there.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'

const API = 'https://api.heygen.com'
const ROOT = path.resolve(import.meta.dirname, '..')
const SCRIPTS = path.join(ROOT, 'videos/avatar/scripts.json')
const OUT_DIR = path.join(ROOT, 'public/videos/avatar')
const MANIFEST = path.join(ROOT, 'lib/avatar-videos.json')

const KEY = process.env.HEYGEN_API_KEY
if (!KEY) {
  console.error('HEYGEN_API_KEY is not set.')
  process.exit(1)
}

async function api(method, pathname, body) {
  const res = await fetch(API + pathname, {
    method,
    headers: { 'X-Api-Key': KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${method} ${pathname} → ${res.status}: ${JSON.stringify(json)}`)
  return json
}

// Walk a cursor-paginated list endpoint.
async function listAll(pathname, params = {}) {
  const out = []
  let token
  do {
    const q = new URLSearchParams({ ...params, ...(token ? { token } : {}) })
    const page = await api('GET', `${pathname}?${q}`)
    out.push(...(page.data ?? []))
    token = page.has_more ? page.next_token : undefined
  } while (token)
  return out
}

async function looks() {
  for (const l of await listAll('/v3/avatars/looks')) {
    console.log(`${l.id}\t${l.name}\t${l.avatar_type}\t${l.status}\tdefault voice: ${l.default_voice_id ?? '-'}`)
  }
}

async function voices(language = 'Hebrew') {
  const rows = [
    ...(await listAll('/v3/voices', { type: 'private', limit: '100' })),
    ...(await listAll('/v3/voices', { language, limit: '100' })),
  ]
  for (const v of rows) {
    console.log(`${v.voice_id}\t${v.name}\t${v.language}\t${v.gender}\t${v.type}\t${v.preview_audio_url ?? ''}`)
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function render(video, avatarId, voiceId) {
  const created = await api('POST', '/v3/videos', {
    type: 'avatar',
    avatar_id: video.avatar_id || avatarId,
    ...((video.voice_id || voiceId) ? { voice_id: video.voice_id || voiceId } : {}),
    script: video.script,
  })
  const videoId = created.data?.id ?? created.data?.video_id ?? created.video_id
  if (!videoId) throw new Error(`no video id in response: ${JSON.stringify(created)}`)
  console.log(`[${video.id}] submitted ${videoId}`)

  for (;;) {
    await sleep(15_000)
    const { data } = await api('GET', `/v3/videos/${videoId}`)
    if (data.status === 'completed') return { videoId, url: data.video_url, duration: data.duration }
    if (data.status === 'failed') throw new Error(`[${video.id}] render failed: ${JSON.stringify(data)}`)
    console.log(`[${video.id}] ${data.status}…`)
  }
}

async function generate(ids) {
  const cfg = JSON.parse(await readFile(SCRIPTS, 'utf8'))
  if (!cfg.avatar_id) throw new Error('Set avatar_id in videos/avatar/scripts.json (see `looks`).')
  const todo = ids.length ? cfg.videos.filter(v => ids.includes(v.id)) : cfg.videos
  if (!todo.length) throw new Error(`no videos match: ${ids.join(', ')}`)

  await mkdir(OUT_DIR, { recursive: true })
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8').catch(() => '{}'))

  // Submit all at once; HeyGen renders them in parallel.
  const results = await Promise.allSettled(todo.map(async v => {
    const done = await render(v, cfg.avatar_id, cfg.voice_id)
    const file = path.join(OUT_DIR, `${v.id}.mp4`)
    const res = await fetch(done.url)
    if (!res.ok) throw new Error(`[${v.id}] download → ${res.status}`)
    await pipeline(Readable.fromWeb(res.body), createWriteStream(file))
    manifest[v.id] = { title: v.title, src: `/videos/avatar/${v.id}.mp4`, duration: done.duration ?? null, heygen_id: done.videoId }
    console.log(`[${v.id}] saved ${path.relative(ROOT, file)}`)
  }))

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
  const failed = results.filter(r => r.status === 'rejected')
  for (const f of failed) console.error(f.reason.message)
  if (failed.length) process.exit(1)
}

const [cmd, ...args] = process.argv.slice(2)
const run = { looks: () => looks(), voices: () => voices(args[0]), generate: () => generate(args) }[cmd]
if (!run) {
  console.error('usage: node scripts/heygen.mjs looks | voices [language] | generate [id ...]')
  process.exit(1)
}
run().catch(e => { console.error(e.message); process.exit(1) })
