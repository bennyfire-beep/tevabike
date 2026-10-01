import type { Metadata } from 'next'
import Link from 'next/link'
import { SESSIONS, MEMBER_PRICE, GUEST_PRICE, isPast } from '@/lib/ride-sessions'
import TripCover from './TripCover'

// ============================================================
// טיולי רכיבה בארץ — פתיח + רשימת הטיולים הקרובים (lib/ride-sessions.ts)
// נתיב: app/rides/page.tsx · עמוד טיול: app/rides/[slug]/page.tsx
// ============================================================

export const metadata: Metadata = {
  title: 'טיולי רכיבה בארץ — טבע בייק',
  description: `טיולי אופני שטח מודרכים ברחבי הארץ, פעמיים בחודש. רוכבי טבע בייק ${MEMBER_PRICE} ₪, אורחים ${GUEST_PRICE} ₪.`,
}

// Trips drop off the list the day after they happen — re-render on request so
// "today" is always today, not the build date.
export const dynamic = 'force-dynamic'

const PINK = '#D4288A'

export default function RidesPage() {
  const upcoming = SESSIONS.filter((s) => !isPast(s)).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div dir="rtl" className="min-h-screen bg-stone-950 text-stone-100">
      {/* intro — what the trips are, before the list */}
      <header
        className="px-6 pt-12 pb-12"
        style={{ background: 'linear-gradient(160deg,#1B1220 0%, #241A28 55%, #2E1224 100%)' }}
      >
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold tracking-[.14em] mb-2" style={{ color: PINK }}>
            טבע בייק · פעמיים בחודש · פתוח לכולם
          </p>
          <h1 className="text-3xl md:text-5xl font-extrabold mb-5 leading-tight">
            יוצאים לרכוב. <span style={{ color: PINK }}>יוצאים לטייל.</span>
          </h1>
          <div className="space-y-4 text-stone-300 text-[15px] md:text-lg leading-relaxed max-w-2xl">
            <p className="text-stone-100 font-semibold">
              פעמיים בחודש אנחנו עוזבים את השגרה ויוצאים לגלות את הארץ על שני גלגלים.
            </p>
            <p>
              יערות, רכסים, נחלים ושבילים שמובילים לנופים ששווה לעצור בשבילם. כמה שעות של רכיבה בטבע, בקבוצה טובה ועם
              מדריך שמכיר את השטח ויודע לקחת אותנו למקומות שלא תמיד מגיעים אליהם לבד.
            </p>
            <p>לא צריך להיות חלק מקבוצה קבועה — פשוט לבחור טיול שמתאים לכם ולהצטרף.</p>
          </div>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-5 pt-12 space-y-10">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-2xl font-extrabold">איך זה עובד?</h2>
            <p className="text-stone-300 leading-relaxed">
              כל חודש עולים כאן שני טיולים חדשים, כל פעם לאזור אחר בארץ. בכל טיול מפורטים מראש המסלול, האורך, הטיפוס,
              הרמה הטכנית ודרגת הכושר — כך שתדעו בדיוק למה להתכונן ותבחרו את הטיולים שמתאימים לכם.
            </p>
            <p className="text-stone-300 leading-relaxed">
              נפגשים בנקודת ההתחלה, מתדרכים ויוצאים לדרך. רוכבים בקצב של טיול, עוצרים בתצפיות ובמקומות מעניינים,
              ועושים הפסקת קפה באמצע.
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-extrabold">מי מוביל?</h2>
            <p className="text-stone-300 leading-relaxed">
              את הטיולים מוביל <b className="text-stone-100">מיכאל איזנשטין</b>, שמכיר את השבילים ודואג לאורך כל הדרך
              שהרכיבה תהיה בטוחה, זורמת ומהנה — ושכולם ירגישו חלק מהקבוצה.
            </p>
            <p className="text-stone-300 leading-relaxed">
              הטיולים פתוחים לכולם, גם אם זו הפעם הראשונה שלכם איתנו. אפשר להגיע לבד, לצרף חברים או את הפרטנר הקבוע
              לרכיבה — ופשוט לצאת איתנו לבוקר טוב על האופניים, להכיר אנשים ולגלות עוד פינה יפה בארץ.
            </p>
          </div>
        </div>

        <ul className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[
            { icon: '🗺️', title: 'כל פעם מגלים מקום חדש', body: 'שבילים, נופים ואזורים אחרים בארץ — בכל טיול מחכה מסלול חדש.' },
            { icon: '🚵', title: 'פשוט באים לרכוב', body: 'אנחנו דואגים למסלול ולהובלה — אתם רק בוחרים טיול ויוצאים איתנו לדרך. אין לכם אופניים? אפשר גם לשכור.' },
            { icon: '☕', title: 'רוכבים, עוצרים, נהנים', body: 'לא מרוץ ולא אימון — רוכבים בקצב טוב, עוצרים בנוף וגם לקפה בדרך.' },
            { icon: '🤝', title: 'הרבה יותר כיף ביחד', body: 'מגיעים לבד או עם חברים, מכירים רוכבים חדשים ויוצאים לדרך כקבוצה.' },
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
            <p className="text-stone-400 text-sm">מחיר לטיול אחד. רוכבי טבע בייק מזוהים אוטומטית לפי מספר הטלפון.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <PriceTag label="רוכבי טבע בייק" price={MEMBER_PRICE} highlight />
            <PriceTag label="אורחים" price={GUEST_PRICE} />
          </div>
        </div>

        <h2 className="text-2xl font-extrabold pt-2">הטיולים הקרובים</h2>
      </section>

      <main className="max-w-4xl mx-auto px-5 pt-5 pb-14">
        {upcoming.length === 0 ? (
          <div className="text-center bg-stone-900 rounded-2xl p-8 space-y-2">
            <h2 className="text-lg font-bold">אין כרגע טיולים פתוחים להרשמה</h2>
            <p className="text-stone-400 text-sm">הטיולים הבאים יעלו כאן בקרוב — עקבו אחרינו באינסטגרם ובוואטסאפ.</p>
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
                    <TripCover image={s.image} title={s.title} className="object-[center_35%] group-hover:scale-105 transition duration-500" />
                  </div>
                  <div className="p-5 space-y-2">
                    <p className="text-sm font-bold" style={{ color: PINK }}>📅 {s.dateLabel} · {s.hours}</p>
                    <h2 className="text-xl font-extrabold leading-snug">{s.title}</h2>
                    <p className="text-stone-400 text-sm leading-relaxed">{s.summary}</p>
                    <p className="text-stone-500 text-xs pt-1">
                      📍 {s.location} · {s.distanceKm} ק״מ · {s.climbM} מ׳ טיפוס · רמה טכנית {s.technicalLevel}
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
