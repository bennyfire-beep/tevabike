import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// The dynamic half of the WhatsApp reply-suggestion context: prices/dates that
// change often enough that baking them into lib/whatsapp-knowledge.ts would go
// stale. Two different sources, because that's genuinely where each fact lives
// today:
//   - workshops and the shop catalog have no database table (they're plain
//     constants inside their own page components), so this fetches the actual
//     public pages and strips the HTML down to text — a literal "pull from the
//     site", not a second copy of the same numbers to keep in sync by hand.
//   - trips ARE a real table (`trips`, see app/api/trip/[slug]/route.ts), so
//     that one's a normal query instead of scraping the site's own page.
// Both are best-effort: a slow/unreachable page or an empty trips table just
// means a shorter prompt, never a thrown error — this only ever feeds a
// suggestion the coordinator reviews before sending.
// ─────────────────────────────────────────────────────────────────────────────

const SITE_ORIGIN = 'https://tevabike.com'
// The canonical, user-facing form (matches every other customer-facing link
// in this codebase, e.g. components/RiderForm.tsx) — this is what gets cited
// in the prompt, so it has to be a real, clickable link, not the bare fetch
// origin above.
const PUBLIC_ORIGIN = 'https://www.tevabike.com'
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

/** Everything pulled live for the current suggestion — joined into one text block, or '' if all three came up empty. */
export async function fetchDynamicSiteContent(admin: SupabaseClient): Promise<string> {
  const [shop, workshop, trips] = await Promise.all([
    fetchPageText('/shop'),
    fetchPageText('/workshop-airbag'),
    fetchOpenTrips(admin),
  ])

  const parts: string[] = []
  if (workshop) parts.push(`סדנת איר-באג (הרשמה: ${PUBLIC_ORIGIN}/workshop-airbag) — כרגע באתר:\n${workshop}`)
  if (trips) parts.push(`טיולים פתוחים כרגע:\n${trips}`)
  if (shop) parts.push(`חנות (${PUBLIC_ORIGIN}/shop) — כרגע באתר:\n${shop}`)
  return parts.join('\n\n')
}
