import type { Metadata } from 'next'
import Link from 'next/link'
import { SESSIONS, MEMBER_PRICE, GUEST_PRICE, isPast } from '@/lib/ride-sessions'

// ============================================================
// סשני רכיבה — רשימת הרכיבות הקרובות (lib/ride-sessions.ts)
// נתיב: app/rides/page.tsx · עמוד רכיבה: app/rides/[slug]/page.tsx
// ============================================================

export const metadata: Metadata = {
  title: 'סשני רכיבה — טבע בייק',
  description: `רכיבות שטח מודרכות של טבע בייק, פתוחות לרוכבי המועדון (${MEMBER_PRICE} ₪) ולאורחים (${GUEST_PRICE} ₪).`,
}

// Rides drop off the list the day after they happen — re-render on request so
// "today" is always today, not the build date.
export const dynamic = 'force-dynamic'

const PINK = '#D4288A'

export default function RidesPage() {
  const upcoming = SESSIONS.filter((s) => !isPast(s)).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div dir="rtl" className="min-h-screen bg-stone-950 text-stone-100">
      <header
        className="px-6 pt-12 pb-10"
        style={{ background: 'linear-gradient(160deg,#1B1220 0%, #241A28 55%, #2E1224 100%)' }}
      >
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold tracking-[.14em] mb-2" style={{ color: PINK }}>
            רכיבות מודרכות · פתוח לכולם
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold mb-3">סשני רכיבה</h1>
          <p className="text-stone-300 text-[15px] md:text-base leading-relaxed max-w-2xl">
            מעבר לחוגים הקבועים, טבע בייק מפיקה רכיבות שטח מודרכות במסלולים היפים בארץ. הרכיבות פתוחות לרוכבי
            המועדון וגם לאורחים — הביאו חברים!
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <PriceTag label="רוכבי טבע בייק" price={MEMBER_PRICE} highlight />
            <PriceTag label="אורחים" price={GUEST_PRICE} />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-10">
        {upcoming.length === 0 ? (
          <div className="text-center bg-stone-900 rounded-2xl p-8 space-y-2">
            <h2 className="text-lg font-bold">אין כרגע רכיבות פתוחות להרשמה</h2>
            <p className="text-stone-400 text-sm">רכיבות חדשות יעלו כאן בקרוב — עקבו אחרינו באינסטגרם ובוואטסאפ.</p>
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2">
            {upcoming.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/rides/${s.slug}`}
                  className="group block bg-stone-900 rounded-2xl overflow-hidden border border-stone-800 hover:border-[#D4288A] transition h-full"
                >
                  <div className="aspect-[16/9] overflow-hidden bg-stone-800">
                    <img
                      src={s.image}
                      alt={s.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                  </div>
                  <div className="p-5 space-y-2">
                    <p className="text-sm font-bold" style={{ color: PINK }}>📅 {s.dateLabel} · {s.hours}</p>
                    <h2 className="text-xl font-extrabold leading-snug">{s.title}</h2>
                    <p className="text-stone-400 text-sm leading-relaxed">{s.summary}</p>
                    <p className="text-stone-500 text-xs pt-1">
                      {s.distanceKm} ק״מ · {s.climbM} מ׳ טיפוס · רמה טכנית {s.technicalLevel}
                    </p>
                    <span className="inline-block pt-2 text-sm font-bold" style={{ color: PINK }}>
                      לפרטים והרשמה ←
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

function PriceTag({ label, price, highlight = false }: { label: string; price: number; highlight?: boolean }) {
  return (
    <div
      className="rounded-xl px-4 py-2.5 border"
      style={highlight ? { background: `${PINK}22`, borderColor: PINK } : { background: 'rgba(255,255,255,.06)', borderColor: 'rgba(255,255,255,.15)' }}
    >
      <span className="text-sm text-stone-300">{label} · </span>
      <span className="text-lg font-extrabold">{price} ₪</span>
      <span className="text-sm text-stone-400"> לטיול</span>
    </div>
  )
}
