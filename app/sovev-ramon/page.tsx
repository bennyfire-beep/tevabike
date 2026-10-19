// app/sovev-ramon/page.tsx — יום רכיבה "סובב מצפה רמון", יום הבחירות 27.10.2026
// דף נחיתה: תיאור, לוח זמנים, ציוד וטופס הרשמה. הרכב מוגבל ל-RIDE_SEATS רוכבים (lib/sovev-ramon.ts);
// אחרי ההרשמה הרוכב מקבל את קישור התשלום ב-Arbox שמתאים לאופן ההגעה.
// תמונת השיתוף (og:image) והתמונה הראשית: public/trips/sovev-ramon.jpg

import type { Metadata } from 'next'
import RegisterForm from './RegisterForm'
import { RIDE_SEATS } from '@/lib/sovev-ramon'

const HERO = '/trips/sovev-ramon.jpg'


const C = { dark: '#0C1814', brand: '#D4288A', greenMid: '#1F3D2A', card: '#152A1E', offWhite: '#F5F2EE', muted: '#D8E2DC' }

const TITLE = 'מצביעים ורוכבים! סובב מצפה רמון'
const DESCRIPTION =
  'יום שלישי 27.10, יום הבחירות. מצביעים בבוקר, נוסעים דרומה ורוכבים 30–40 ק"מ על שפת מכתש רמון, עד סינגל הצבעים. 180 ₪ עם הסעה, 150 ₪ בהגעה עצמאית.'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.tevabike.com'),
  title: `${TITLE} — טבע בייק`,
  description: DESCRIPTION,
  alternates: { canonical: '/sovev-ramon' },
  openGraph: {
    title: `${TITLE} — טבע בייק`,
    description: DESCRIPTION,
    url: '/sovev-ramon',
    siteName: 'טבע בייק',
    type: 'website',
    locale: 'he_IL',
    images: [{ url: HERO }],
  },
  twitter: { card: 'summary_large_image', title: `${TITLE} — טבע בייק`, description: DESCRIPTION, images: [HERO] },
}

const FACTS: [string, string][] = [
  ['📅 מתי', 'יום שלישי, 27 באוקטובר 2026'],
  ['🚲 אורך', '30–40 ק"מ · 4–5 שעות'],
  ['📍 איפה', 'מצפה רמון · שפת המכתש'],
  ['🏁 סיום', 'סינגל הצבעים'],
]

const SCHEDULE: [string, string][] = [
  ['07:00', 'הקלפיות נפתחות. מצביעים 🗳️'],
  ['08:00', 'יציאה דרומה, ברכב של טבע בייק או בנסיעה עצמאית'],
  ['11:00', 'הגעה למצפה רמון והקפצת הרכבים לנקודת הסיום'],
  ['11:30', 'יוצאים לרכיבה'],
  ['16:00–16:30', 'סיום משוער בסינגל הצבעים וחזרה צפונה'],
]

const GEAR = [
  'קסדה (חובה)',
  'תיק רכיבה עם שלוקר של 2 ליטר לפחות',
  'אוכל לדרך, חטיפי אנרגיה או ג\'לים',
  'פנימית, משאבה, סט אלנים וציוד לתיקון פנצ\'רים',
  'מומלץ: כובע ומשקפי שמש, קרם הגנה, שכבה חמה לסוף היום ופנס קטן לאופניים',
]

const CANCEL = [
  'עד 7 ימי עבודה לפני הטיול: ביטול ללא עלות',
  '3 ימי עבודה לפני: 50% דמי ביטול',
  'פחות מיום עבודה לפני: 100% דמי ביטול',
]

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl p-5 border" style={{ background: C.card, borderColor: C.greenMid }}>
      <h2 className="font-bold text-lg mb-3">{title}</h2>
      {children}
    </section>
  )
}

export default function SovevRamonPage() {
  return (
    <main dir="rtl" className="min-h-screen" style={{ background: C.dark, color: C.offWhite }}>
      <section className="relative overflow-hidden px-6 pt-28 pb-8">
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse at top, ${C.brand}26, transparent 60%)` }}
        />
        <div className="relative max-w-2xl mx-auto space-y-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HERO}
            alt="רוכבי טבע בייק על שפת מכתש רמון"
            className="w-full rounded-2xl border shadow-lg"
            style={{ borderColor: `${C.brand}55` }}
          />
          <p className="font-bold tracking-widest text-sm" style={{ color: C.brand }}>
            טבע בייק · טיול יום · יום הבחירות 🗳️
          </p>
          <h1 className="text-4xl sm:text-5xl font-black leading-tight">{TITLE}</h1>
          <p className="text-lg leading-relaxed" style={{ color: C.muted }}>
            מנצלים את יום הבחירות ליום רכיבה במדבר: מצביעים בבוקר, נוסעים דרומה ורוכבים סביב מצפה רמון. נרכב לאורך שפת
            המכתש, נעבור דרך התצפיות היפות של מצפה ונסיים ב<strong>סינגל הצבעים</strong>.
          </p>
        </div>
      </section>

      <section className="px-6 pb-8">
        <dl className="max-w-2xl mx-auto grid grid-cols-2 gap-3 text-sm">
          {FACTS.map(([k, v]) => (
            <div key={k} className="rounded-xl p-4 border" style={{ background: C.card, borderColor: C.greenMid }}>
              <dt className="font-bold mb-1" style={{ color: C.brand }}>{k}</dt>
              <dd style={{ color: C.muted }}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="px-6 pb-8">
        <div className="max-w-2xl mx-auto">
          <RegisterForm />
        </div>
        <p className="max-w-2xl mx-auto text-center text-sm mt-3" style={{ color: C.muted }}>
          המחיר כולל הובלה מקצועית במסלול והקפצת רכבים לנקודת הסיום. ברכב יש {RIDE_SEATS} מקומות בלבד, כל הקודם זוכה.
        </p>
      </section>

      <div className="px-6 pb-20">
        <div className="max-w-2xl mx-auto space-y-4">
          <Card title="🕗 לוח זמנים">
            <ul className="space-y-2">
              {SCHEDULE.map(([t, what]) => (
                <li key={t} className="flex gap-3">
                  <span className="font-bold shrink-0 w-24" style={{ color: C.brand }}>{t}</span>
                  <span style={{ color: C.muted }}>{what}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm mt-4" style={{ color: '#7E948A' }}>
              המסלול וזמני הרכיבה יכולים להשתנות לפי קצב הקבוצה והזרימה של הרוכבים, ולפי תנאי מזג האוויר.
            </p>
          </Card>

          <Card title="💪 למי מתאים?">
            <p style={{ color: C.muted }}>
              רוכבים בכושר טוב, שרגילים לרכיבות שטח של 30 ק&quot;מ ומעלה ולטיפוסים.
            </p>
          </Card>

          <Card title="🎒 ציוד לטיול">
            <ul className="list-disc pr-5 space-y-1 leading-relaxed" style={{ color: C.muted }}>
              {GEAR.map((g) => <li key={g}>{g}</li>)}
            </ul>
          </Card>

          <Card title="📋 תנאי ביטול">
            <p className="mb-2" style={{ color: C.muted }}>אפשר לבטל רק בהודעה במייל. ימי עבודה לא כוללים שבתות וחגים.</p>
            <ul className="list-disc pr-5 space-y-1" style={{ color: C.muted }}>
              {CANCEL.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </Card>

          <p className="text-center pt-2" style={{ color: C.muted }}>
            לפרטים: בני להט{' '}
            <a href="tel:0525708084" className="font-bold" style={{ color: C.brand }}>052-5708084</a>
          </p>
        </div>
      </div>
    </main>
  )
}
