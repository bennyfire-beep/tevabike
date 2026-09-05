import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// The dynamic half of the WhatsApp reply-suggestion context: prices/dates that
// change often enough that baking them into lib/whatsapp-knowledge.ts would go
// stale. Three different sources, because that's genuinely where each fact
// lives today:
//   - trips and workshops ARE real tables (`trips`, `workshops` +
//     `workshop_sessions` — see app/api/trip/[slug]/route.ts for the trips
//     pattern this mirrors), so those are normal queries.
//   - groups (kids/adults classes) is also a real table, queried for live
//     schedule/active-status only — pricing stays in
//     lib/whatsapp-knowledge.ts and is intentionally NOT repeated here, so
//     there's one place to update it and no risk of two numbers disagreeing.
//   - the shop catalog has no database table (it's a plain constant inside
//     app/shop/page.tsx), so this fetches the actual public page and strips
//     the HTML down to text — a literal "pull from the site", not a second
//     copy of the same numbers to keep in sync by hand.
// All best-effort: a slow/unreachable page or an empty table just means a
// shorter prompt, never a thrown error — this only ever feeds a suggestion
// the coordinator reviews before sending.
// ─────────────────────────────────────────────────────────────────────────────

const SITE_ORIGIN = 'https://tevabike.com'
const FETCH_TIMEOUT_MS = 5000

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchPageText(path: string, maxChars = 2500): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(`${SITE_ORIGIN}${path}`, { cache: 'no-store', signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return null
    return stripHtml(await res.text()).slice(0, maxChars)
  } catch (e) {
    console.error('[site-content] fetch failed for', path, (e as Error).message)
    return null
  }
}

async function fetchOpenTrips(admin: SupabaseClient): Promise<string | null> {
  const { data, error } = await admin
    .from('trips')
    .select('title, destination, trip_start, trip_end, price_small_group, price_large_group, deposit_ils')
    .eq('is_open', true)

  if (error || !data || data.length === 0) {
    if (error) console.error('[site-content] trips query failed:', error.message)
    return null
  }

  return data
    .map(t =>
      `${t.title} (${t.destination}), ${t.trip_start}–${t.trip_end}: החל מ-€${t.price_small_group} לאדם ` +
      `(או €${t.price_large_group} בקבוצה גדולה), מקדמה ₪${t.deposit_ils}.`
    )
    .join('\n')
}

function fmtSessionDate(iso: string): string {
  return new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' }).format(new Date(iso))
}

function fmtTimeRange(start: string | null, end: string | null): string {
  if (!start || !end) return ''
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`
}

/** Open workshop sessions (upcoming, not full-by-flag) — title, date/time, place, price, spots left. */
async function fetchOpenWorkshops(admin: SupabaseClient): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10)

  const { data: workshops, error: wErr } = await admin
    .from('workshops')
    .select('id, slug, title, price, currency, discount_percent, discount_eligible_brands, registration_url')
    .eq('is_open', true)

  if (wErr || !workshops || workshops.length === 0) {
    if (wErr) console.error('[site-content] workshops query failed:', wErr.message)
    return null
  }

  const { data: sessions, error: sErr } = await admin
    .from('workshop_sessions')
    .select('workshop_id, session_date, start_time, end_time, location, capacity')
    .in('workshop_id', workshops.map(w => w.id))
    .eq('is_open', true)
    .gte('session_date', today)
    .order('session_date', { ascending: true })

  if (sErr || !sessions || sessions.length === 0) {
    if (sErr) console.error('[site-content] workshop_sessions query failed:', sErr.message)
    return null
  }

  const byWorkshop = new Map(workshops.map(w => [w.id, w]))

  const lines = await Promise.all(sessions.map(async (s) => {
    const w = byWorkshop.get(s.workshop_id)
    if (!w) return null

    const { count, error: cErr } = await admin
      .from('workshop_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('workshop_slug', w.slug)
      .eq('workshop_date', s.session_date)
      .neq('payment_status', 'cancelled')
    if (cErr) console.error('[site-content] workshop_registrations count failed:', cErr.message)

    const spotsLeft = s.capacity != null ? Math.max(s.capacity - (count ?? 0), 0) : null
    const discount = w.discount_percent
      ? ` (${w.discount_percent}% הנחה לרוכבי ${(w.discount_eligible_brands ?? []).join('/')})`
      : ''

    return (
      `${w.title} — ${fmtSessionDate(s.session_date)}` +
      `${fmtTimeRange(s.start_time, s.end_time) ? `, ${fmtTimeRange(s.start_time, s.end_time)}` : ''}` +
      `${s.location ? ` · ${s.location}` : ''}` +
      `: ${w.price} ${w.currency}${discount}` +
      `${spotsLeft != null ? ` · ${spotsLeft > 0 ? `נשארו ${spotsLeft} מקומות` : 'מלא'}` : ''}` +
      `${w.registration_url ? ` · הרשמה: ${SITE_ORIGIN}${w.registration_url}` : ''}`
    )
  }))

  const text = lines.filter((l): l is string => !!l).join('\n')
  return text || null
}

/** Active kids/adults groups — schedule only, never price (that stays in lib/whatsapp-knowledge.ts). */
async function fetchActiveGroups(admin: SupabaseClient): Promise<string | null> {
  const { data, error } = await admin
    .from('groups')
    .select('name, branch, level, type, days')
    .eq('is_active', true)
    .order('branch', { ascending: true })

  if (error || !data || data.length === 0) {
    if (error) console.error('[site-content] groups query failed:', error.message)
    return null
  }

  return data
    .map(g => `${g.branch} · ${g.name} (${g.level}, ${g.type === 'kids' ? 'ילדים/נוער' : 'מבוגרים'}) — ${g.days}`)
    .join('\n')
}

/** Everything pulled live for the current suggestion — joined into one text block, or '' if everything came up empty. */
export async function fetchDynamicSiteContent(admin: SupabaseClient): Promise<string> {
  const [shop, workshops, trips, groups] = await Promise.all([
    fetchPageText('/shop'),
    fetchOpenWorkshops(admin),
    fetchOpenTrips(admin),
    fetchActiveGroups(admin),
  ])

  const parts: string[] = []
  if (groups) parts.push(`חוגים פעילים כרגע (ללוח זמנים בלבד — למחיר תמיד לפי המידע הסטטי למעלה, לא להמציא כאן):\n${groups}`)
  if (workshops) parts.push(`סדנאות פתוחות כרגע:\n${workshops}`)
  if (trips) parts.push(`טיולים פתוחים כרגע:\n${trips}`)
  if (shop) parts.push(`חנות (tevabike.com/shop) — כרגע באתר:\n${shop}`)
  return parts.join('\n\n')
}
