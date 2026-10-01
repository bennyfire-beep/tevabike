import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SESSIONS, sessionBySlug, MEMBER_PRICE, GUEST_PRICE } from '@/lib/ride-sessions'
import RideRegistration from './RideRegistration'
import TripCover from '../TripCover'

// ============================================================
// טיול רכיבה — עמוד טיול אחד: פרטי מסלול, מחירים והרשמה
// נתיב: app/rides/[slug]/page.tsx · API: app/api/rides/route.ts
// ============================================================

const PINK = '#D4288A'

export function generateStaticParams() {
  return SESSIONS.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const s = sessionBySlug(slug)
  if (!s) return { title: 'הטיול לא נמצא — טבע בייק' }
  return {
    title: `${s.title} — טבע בייק`,
    description: `${s.dateLabel} · ${s.location} · ${s.summary} רוכבי טבע בייק ${MEMBER_PRICE} ₪, אורחים ${GUEST_PRICE} ₪.`,
    ...(s.image ? { openGraph: { images: [s.image] } } : {}),
  }
}

export default async function RidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const s = sessionBySlug(slug)
  if (!s) notFound()

  const facts: [string, string][] = [
    ['אופי מסלול', s.routeCharacter],
    ['סוג מסלול', s.routeType],
    ['רמה טכנית', s.technicalLevel],
    ['דרגת כושר', s.fitnessLevel],
    ['תוואי שטח', s.terrain],
  ]

  return (
    <div dir="rtl" className="min-h-screen bg-stone-950 text-stone-100">
      {/* hero */}
      <header className="relative">
        <div className="h-[260px] md:h-[380px]"><TripCover image={s.image} title={s.title} className="object-[center_30%]" /></div>
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="max-w-4xl mx-auto px-5 pb-6">
            <Link href="/rides" className="text-sm text-stone-300 hover:text-white">→ כל טיולי הרכיבה</Link>
            <p className="text-xs font-bold tracking-[.14em] mt-3" style={{ color: '#F9A8D4' }}>טיול רכיבה בארץ · {s.location}</p>
            <h1 className="text-3xl md:text-4xl font-extrabold mt-1">{s.title}</h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 pb-14 grid gap-8 md:grid-cols-[1fr_360px] md:items-start">
        {/* details */}
        <main className="space-y-8 pt-2">
          <ul className="flex flex-wrap gap-2 text-sm">
            <li className="bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5">📅 {s.dateLabel}</li>
            <li className="bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5">🕗 {s.hours}</li>
            <li className="bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5">📍 {s.location}</li>
          </ul>

          <ul className="bg-stone-900 rounded-xl p-5 space-y-2 text-[15px] text-stone-300">
            <li><b className="text-stone-100">מדריך/ה:</b> {s.guide}</li>
            <li><b className="text-stone-100">נתוני מסלול:</b> {s.distanceKm} ק״מ, {s.climbM} מטר טיפוס, {s.routeCharacter}</li>
            <li><b className="text-stone-100">נקודת מפגש:</b> {s.meetingPoint}</li>
            <li>
              <b className="text-stone-100">עלות:</b> {MEMBER_PRICE} ₪ לרוכבי טבע בייק · {GUEST_PRICE} ₪ לאורחים
            </li>
          </ul>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">מה בתוכנית?</h2>
            {s.description.map((p, i) => (
              <p key={i} className="text-stone-300 leading-relaxed">{p}</p>
            ))}
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">על המסלול</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {facts.map(([k, v]) => (
                <div key={k} className="bg-stone-900 border border-stone-800 rounded-xl p-4">
                  <dt className="text-xs text-stone-400 mb-1">{k}</dt>
                  <dd className="font-bold">{v}</dd>
                </div>
              ))}
            </dl>
            {s.navUrl && (
              <a
                href={s.navUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 font-bold rounded-xl px-5 py-3 border"
                style={{ borderColor: PINK, color: PINK }}
              >
                🧭 ניווט לנקודת המפגש
              </a>
            )}
          </section>

          <section className="bg-stone-900 rounded-xl p-5 space-y-2 text-sm text-stone-300 leading-relaxed">
            <h2 className="text-base font-bold text-stone-100">בטיחות וציוד</h2>
            <p>הטיול מיועד לרוכבים עם ניסיון ברכיבת שטח ברמה המתאימה למסלול. לא בטוחים? כתבו לנו ונעזור לבחור.</p>
            <p>חובה קסדה ואופניים תקינים. יש להצטייד במים (לפחות 1.5 ליטר), חטיף/ארוחת בוקר קלה ופנימית רזרבית.</p>
            <p>מומלץ ביטוח בריאות הכולל ספורט אתגרי. אין אחריות על נזקי ציוד, גניבה או צד ג׳ במהלך הטיול.</p>
            <p>מספר המקומות מוגבל ל־{s.capacity} רוכבים. המקום נשמר רק לאחר תשלום.</p>
          </section>
        </main>

        {/* pricing + form */}
        <aside className="md:sticky md:top-24">
          <RideRegistration
            slug={s.slug}
            title={s.title}
            dateLabel={s.dateLabel}
            capacity={s.capacity}
            memberPrice={MEMBER_PRICE}
            guestPrice={GUEST_PRICE}
          />
        </aside>
      </div>
    </div>
  )
}
