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
      {/* intro — who we are and what the rides are, before the list */}
      <header
        className="px-6 pt-12 pb-12"
        style={{ background: 'linear-gradient(160deg,#1B1220 0%, #241A28 55%, #2E1224 100%)' }}
      >
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold tracking-[.14em] mb-2" style={{ color: PINK }}>
            רכיבת שטח חברתית · פתוח לכולם
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold mb-4">
            נעים להכיר, <span style={{ color: PINK }}>טבע בייק</span>
          </h1>
          <p className="text-stone-300 text-[15px] md:text-lg leading-relaxed max-w-2xl">
            טבע בייק היא קהילה של רוכבי אופני שטח בגליל — ילדים, נוער ומבוגרים שאוהבים טבע, אתגר ואנשים טובים. אנחנו
            בית חם לרוכבים בכל הגילים והרמות, עם חוגים קבועים בארבעה סניפים: משגב, ביריה, מטה אשר ופרוד־אמירים.
          </p>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-5 pt-12 space-y-10">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-2xl font-extrabold">מה זה סשן רכיבה?</h2>
            <p className="text-stone-300 leading-relaxed">
              מעבר לאימונים השבועיים, אנחנו יוצאים לרכיבות מודרכות במסלולים היפים בארץ — סינגלים זורמים, שבילי יער,
              תצפיות ונופים שלא רואים מהכביש. כל רכיבה היא בוקר שלם בשטח: מתכנסים, מתדרכים, רוכבים יחד ועוצרים לקפה
              באמצע.
            </p>
            <p className="text-stone-300 leading-relaxed">
              הרכיבות פתוחות לרוכבי טבע בייק וגם לאורחים. זו ההזדמנות להביא חבר, בן זוג או שכנה, להכיר את המדריכים שלנו
              ולגלות מה כולם מדברים עליו.
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-extrabold">למה לרכוב איתנו?</h2>
            <p className="text-stone-300 leading-relaxed">
              המדריכים שלנו מלמדים טכניקת רכיבה כל השבוע — אז ברכיבה לא רק עוברים מסלול, אלא גם משתפרים. עוצרים
              במקומות המאתגרים, מסבירים איך לעבור אותם, ואף אחד לא נשאר מאחור.
            </p>
            <p className="text-stone-300 leading-relaxed">
              לכל רכיבה מפורטים מראש אורך המסלול, הטיפוס, הרמה הטכנית ודרגת הכושר — כך שתדעו בדיוק למה להתכונן.
            </p>
          </div>
        </div>

        <ul className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[
            { icon: '🏆', title: 'מדריכים מוסמכים', body: 'מוסמכים בטכניקת גרביטי, עם ניסיון רב בשטח' },
            { icon: '🛡️', title: 'בטיחות קודמת לכל', body: 'מסלולים מותאמים לרמה, מדריך מלווה לאורך כל הדרך' },
            { icon: '🗺️', title: 'מסלולים שווים', body: 'סינגלים, יערות ונופים שלא רואים מהכביש' },
            { icon: '☕', title: 'קהילה', body: 'רוכבים יחד, עוצרים לקפה ומכירים חברים חדשים' },
          ].map((f) => (
            <li key={f.title} className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-3"
                style={{ background: `${PINK}28` }}
              >
                {f.icon}
              </div>
              <h3 className="font-extrabold mb-1">{f.title}</h3>
              <p className="text-stone-400 text-sm leading-relaxed">{f.body}</p>
            </li>
          ))}
        </ul>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 md:flex md:items-center md:justify-between gap-6 space-y-4 md:space-y-0">
          <div>
            <h2 className="text-xl font-extrabold mb-1">כמה זה עולה?</h2>
            <p className="text-stone-400 text-sm">מחיר לטיול אחד. רוכבי המועדון מזוהים אוטומטית לפי מספר הטלפון.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <PriceTag label="רוכבי טבע בייק" price={MEMBER_PRICE} highlight />
            <PriceTag label="אורחים" price={GUEST_PRICE} />
          </div>
        </div>

        <h2 className="text-2xl font-extrabold pt-2">הרכיבות הקרובות</h2>
      </section>

      <main className="max-w-4xl mx-auto px-5 pt-5 pb-14">
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
