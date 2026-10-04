import { createClient } from '@supabase/supabase-js'

// Background-video clips for page heroes (table site_hero_clips, managed at
// /admin/coordinator/hero-videos). Played as uploaded, trimmed to
// start_s–end_s and framed with object-position — see the migration
// 20261004_site_hero_clips.sql for the column meanings.

export type HeroClip = {
  id: string
  label: string | null
  url: string
  storage_path: string | null
  sort: number
  active: boolean
  start_s: number
  end_s: number | null
  focus_desktop: number
  focus_mobile: number
}

/** The header switches to the wide layout at Tailwind's `md` breakpoint. */
export const DESKTOP_QUERY = '(min-width: 768px)'

export const HERO_VIDEO_BUCKET = 'site-videos'

/** A clip with no end set plays this long at most, so one long upload can't stall the loop. */
export const DEFAULT_CLIP_SECONDS = 8

export const clipEnd = (c: Pick<HeroClip, 'start_s' | 'end_s'>, duration?: number) => {
  const end = c.end_s ?? Number(c.start_s) + DEFAULT_CLIP_SECONDS
  return duration ? Math.min(end, duration) : end
}

/**
 * Active clips for a page, in order — server-side only (service role). Any
 * failure returns [] so the page falls back to its built-in video instead of
 * erroring.
 */
export async function fetchHeroClips(page: string): Promise<HeroClip[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return []
  try {
    const db = createClient(url, key, { auth: { persistSession: false } })
    const { data, error } = await db
      .from('site_hero_clips')
      .select('id, label, url, storage_path, sort, active, start_s, end_s, focus_desktop, focus_mobile')
      .eq('page', page)
      .eq('active', true)
      .order('sort', { ascending: true })
    if (error) {
      console.error('[hero-clips] query failed:', error.message)
      return []
    }
    return (data ?? []).map((c) => ({
      ...c,
      start_s: Number(c.start_s),
      end_s: c.end_s == null ? null : Number(c.end_s),
    })) as HeroClip[]
  } catch (e) {
    console.error('[hero-clips] fetch failed:', e)
    return []
  }
}
