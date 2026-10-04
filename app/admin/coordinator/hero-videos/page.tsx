'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'
import { HERO_VIDEO_BUCKET, DEFAULT_CLIP_SECONDS, clipEnd, type HeroClip } from '@/lib/hero-clips'

// ============================================================
// סרטוני רקע — ניהול הסרטונים שמתנגנים בראש עמוד טיולי הרכיבה
// נתיב: app/admin/coordinator/hero-videos/page.tsx
// טבלה: site_hero_clips · באקט: site-videos · נגן: app/rides/HeroClips.tsx
//
// אין המרה של הסרטון: מה שנקבע כאן (התחלה, סוף, מיקוד למעלה/למטה לכל
// מסך) הוא בדיוק מה שהנגן באתר עושה — ולכן התצוגה המקדימה מדויקת.
// ============================================================

const PAGE = 'rides'
const MAX_MB = 50

// Roughly the header's real proportions, so the previews frame like the site:
// wide desktop header ≈ 3:1, phone header ≈ 390×880.
const DESKTOP_ASPECT = '3 / 1'
const MOBILE_ASPECT = '390 / 880'

const card: React.CSSProperties = { background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: 16, color: '#e8efe9' }
const btn: React.CSSProperties = {
  background: '#1a2114', color: '#b5e853', border: '1px solid #2f4020', borderRadius: 8,
  padding: '7px 14px', fontSize: 13, fontWeight: 600, fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer',
}
const ghostBtn: React.CSSProperties = { ...btn, background: 'transparent', color: '#c3ccc4', border: '1px solid #252b27' }
const dangerBtn: React.CSSProperties = { ...btn, background: '#3a1a1a', color: '#f87171', border: '1px solid #7f2d2d' }
const muted: React.CSSProperties = { color: '#7a8f7d', fontSize: 12 }

const round1 = (n: number) => Math.round(n * 10) / 10

function videoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => {
      resolve(Number.isFinite(v.duration) ? v.duration : 0)
      URL.revokeObjectURL(url)
    }
    v.onerror = () => {
      resolve(0)
      URL.revokeObjectURL(url)
    }
    v.src = url
  })
}

export default function HeroVideosAdminPage() {
  const user = useCoordinator()
  const [clips, setClips] = useState<HeroClip[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('site_hero_clips')
      .select('id, label, url, storage_path, sort, active, start_s, end_s, focus_desktop, focus_mobile')
      .eq('page', PAGE)
      .order('sort', { ascending: true })
    if (error) setError(error.message)
    setClips(((data ?? []) as HeroClip[]).map((c) => ({
      ...c, start_s: Number(c.start_s), end_s: c.end_s == null ? null : Number(c.end_s),
    })))
    setLoading(false)
  }, [])

  useEffect(() => { if (user) load() }, [user, load])

  async function upload(file: File) {
    setError(null)
    if (!file.type.startsWith('video/')) { setError('אפשר להעלות רק קובץ וידאו'); return }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`הקובץ גדול מ־${MAX_MB}MB. שלחו אותו לעצמכם בוואטסאפ (זה מקטין אותו) ונסו שוב.`)
      return
    }
    setUploading(true)
    const duration = await videoDuration(file)
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase()
    const path = `${PAGE}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error: upErr } = await supabase.storage.from(HERO_VIDEO_BUCKET).upload(path, file, { contentType: file.type })
    if (upErr) { setError(upErr.message); setUploading(false); return }
    const url = supabase.storage.from(HERO_VIDEO_BUCKET).getPublicUrl(path).data.publicUrl
    const { error: insErr } = await supabase.from('site_hero_clips').insert({
      page: PAGE,
      label: file.name.replace(/\.[^.]+$/, '').slice(0, 60),
      url,
      storage_path: path,
      sort: (clips.at(-1)?.sort ?? 0) + 1,
      start_s: 0,
      end_s: duration ? round1(Math.min(duration, DEFAULT_CLIP_SECONDS)) : null,
    })
    if (insErr) {
      setError(insErr.message)
      await supabase.storage.from(HERO_VIDEO_BUCKET).remove([path])
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    await load()
  }

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= clips.length) return
    const a = clips[i]
    const b = clips[j]
    // Swap sort values; fall back to positions if two rows share a value.
    const [sa, sb] = a.sort === b.sort ? [j, i] : [b.sort, a.sort]
    await Promise.all([
      supabase.from('site_hero_clips').update({ sort: sa }).eq('id', a.id),
      supabase.from('site_hero_clips').update({ sort: sb }).eq('id', b.id),
    ])
    await load()
  }

  async function remove(c: HeroClip) {
    if (!confirm(`למחוק את הסרטון "${c.label ?? ''}"?`)) return
    const { error } = await supabase.from('site_hero_clips').delete().eq('id', c.id)
    if (error) { setError(error.message); return }
    if (c.storage_path) await supabase.storage.from(HERO_VIDEO_BUCKET).remove([c.storage_path])
    await load()
  }

  if (!user) return null

  const activeCount = clips.filter((c) => c.active).length

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>סרטוני רקע · טיולי רכיבה</h2>
          <p style={{ ...muted, fontSize: 13, margin: 0 }}>
            {loading ? 'טוען...' : `${activeCount} סרטונים פעילים מתנגנים ברצף בראש העמוד`}
          </p>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 10 }}>
          <a href="/rides" target="_blank" rel="noopener noreferrer" style={{ ...ghostBtn, textDecoration: 'none' }}>פתיחת העמוד</a>
          <button style={btn} disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? 'מעלה…' : '+ הוספת סרטון'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f) }}
          />
        </div>
      </div>

      <div style={{ ...card, marginBottom: 20, fontSize: 13, color: '#c3ccc4', lineHeight: 1.7 }}>
        💡 מומלץ קטעים קצרים של <b>4–8 שניות</b> עם תנועה לכיוון המצלמה. אחרי ההעלאה בוחרים איפה הקטע מתחיל ונגמר,
        ומזיזים את המיקוד למעלה/למטה עד שרואים את הרוכבים — בנפרד למחשב (מסך רחב) ולטלפון (מסך צר).
        מה שרואים בתצוגה המקדימה זה מה שיופיע באתר. עד {MAX_MB}MB לסרטון.
        {activeCount === 0 && !loading && (
          <div style={{ color: '#fbbf24', marginTop: 6 }}>אין סרטונים פעילים — באתר מתנגן סרטון ברירת המחדל.</div>
        )}
      </div>

      {error && (
        <div style={{ ...card, background: '#3a1a1a', borderColor: '#7f2d2d', color: '#fecaca', marginBottom: 16 }}>{error}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {clips.map((c, i) => (
          <ClipEditor
            key={c.id}
            clip={c}
            index={i}
            total={clips.length}
            onMove={(dir) => move(i, dir)}
            onRemove={() => remove(c)}
            onSaved={load}
          />
        ))}
      </div>
    </div>
  )
}

type Draft = Pick<HeroClip, 'label' | 'active' | 'start_s' | 'end_s' | 'focus_desktop' | 'focus_mobile'>

function ClipEditor({ clip, index, total, onMove, onRemove, onSaved }: {
  clip: HeroClip
  index: number
  total: number
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
  onSaved: () => void
}) {
  const initial: Draft = {
    label: clip.label, active: clip.active, start_s: clip.start_s, end_s: clip.end_s,
    focus_desktop: clip.focus_desktop, focus_mobile: clip.focus_mobile,
  }
  const [d, setD] = useState<Draft>(initial)
  const [duration, setDuration] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const dirty = JSON.stringify(d) !== JSON.stringify(initial)
  const end = clipEnd(d, duration || undefined)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setD((p) => ({ ...p, [k]: v })); setSaved(false) }

  async function save() {
    setErr(null)
    if (end <= d.start_s) { setErr('הסוף חייב להיות אחרי ההתחלה'); return }
    setSaving(true)
    const { error } = await supabase.from('site_hero_clips').update({
      label: d.label?.trim() || null,
      active: d.active,
      start_s: round1(d.start_s),
      end_s: round1(end),
      focus_desktop: Math.round(d.focus_desktop),
      focus_mobile: Math.round(d.focus_mobile),
    }).eq('id', clip.id)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setSaved(true)
    onSaved()
  }

  const max = duration ? round1(duration) : Math.max(end, 15)

  return (
    <div style={{ ...card, opacity: d.active ? 1 : 0.6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ background: '#252b27', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{index + 1}</span>
        <input
          value={d.label ?? ''}
          onChange={(e) => set('label', e.target.value)}
          placeholder="שם הסרטון"
          maxLength={60}
          style={{ background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 8, color: '#e8efe9', padding: '6px 10px', fontSize: 14, fontFamily: 'inherit', minWidth: 180 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={d.active} onChange={(e) => set('active', e.target.checked)} style={{ accentColor: '#b5e853' }} />
          מוצג באתר
        </label>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 6 }}>
          <button style={ghostBtn} disabled={index === 0} onClick={() => onMove(-1)} title="להזיז קדימה בסדר">▲</button>
          <button style={ghostBtn} disabled={index === total - 1} onClick={() => onMove(1)} title="להזיז אחורה בסדר">▼</button>
          <button style={dangerBtn} onClick={onRemove}>מחיקה</button>
        </div>
      </div>

      {/* previews — same framing the site uses */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px', gap: 12, alignItems: 'start', marginBottom: 14 }}>
        <div>
          <div style={{ ...muted, marginBottom: 4 }}>🖥️ מחשב</div>
          <Preview url={clip.url} start={d.start_s} end={end} focus={d.focus_desktop} aspect={DESKTOP_ASPECT} onDuration={setDuration} />
        </div>
        <div>
          <div style={{ ...muted, marginBottom: 4 }}>📱 טלפון</div>
          <Preview url={clip.url} start={d.start_s} end={end} focus={d.focus_mobile} aspect={MOBILE_ASPECT} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <Slider
          label="מתחיל בשנייה" value={d.start_s} min={0} max={max} step={0.1} unit="ש׳"
          onChange={(v) => set('start_s', Math.min(v, end - 0.5))}
        />
        <Slider
          label="נגמר בשנייה" value={end} min={0} max={max} step={0.1} unit="ש׳"
          onChange={(v) => set('end_s', Math.max(v, d.start_s + 0.5))}
        />
        <Slider
          label="מיקוד במחשב" value={d.focus_desktop} min={0} max={100} step={1} hint="למעלה ↔ למטה"
          onChange={(v) => set('focus_desktop', v)}
        />
        <Slider
          label="מיקוד בטלפון" value={d.focus_mobile} min={0} max={100} step={1} hint="למעלה ↔ למטה"
          onChange={(v) => set('focus_mobile', v)}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <button style={{ ...btn, opacity: dirty ? 1 : 0.5 }} disabled={!dirty || saving} onClick={save}>
          {saving ? 'שומר…' : 'שמירה'}
        </button>
        {dirty && <button style={ghostBtn} onClick={() => setD(initial)}>ביטול שינויים</button>}
        {saved && !dirty && <span style={{ color: '#b5e853', fontSize: 13 }}>נשמר ✓ — יופיע באתר ברענון הבא</span>}
        {err && <span style={{ color: '#f87171', fontSize: 13 }}>{err}</span>}
        <span style={{ ...muted, marginRight: 'auto' }}>אורך הקטע: {round1(end - d.start_s)} ש׳</span>
      </div>
    </div>
  )
}

/** Loops one clip between start and end, framed like the site at a given aspect. */
function Preview({ url, start, end, focus, aspect, onDuration }: {
  url: string; start: number; end: number; focus: number; aspect: string; onDuration?: (d: number) => void
}) {
  const ref = useRef<HTMLVideoElement>(null)

  // Restart from the (new) start whenever the range changes.
  useEffect(() => {
    const v = ref.current
    if (!v) return
    const go = () => {
      v.currentTime = start
      v.play().catch(() => {})
    }
    if (v.readyState >= 1) go()
    else v.addEventListener('loadedmetadata', go, { once: true })
  }, [start, end])

  return (
    <div style={{ position: 'relative', aspectRatio: aspect, borderRadius: 8, overflow: 'hidden', background: '#000' }}>
      <video
        ref={ref}
        src={url}
        muted
        playsInline
        preload="auto"
        onLoadedMetadata={(e) => onDuration?.(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget
          if (v.currentTime >= end - 0.05 || v.currentTime < start - 0.3) v.currentTime = start
        }}
        onEnded={(e) => { e.currentTarget.currentTime = start; e.currentTarget.play().catch(() => {}) }}
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `50% ${focus}%` }}
      />
    </div>
  )
}

function Slider({ label, value, min, max, step, unit, hint, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string; hint?: string
  onChange: (v: number) => void
}) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ color: '#b5e853', fontWeight: 700 }}>{step < 1 ? value.toFixed(1) : Math.round(value)}{unit ? ` ${unit}` : ''}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#b5e853' }}
      />
      {hint && <div style={muted}>{hint}</div>}
    </label>
  )
}
