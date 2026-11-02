// app/club/page.tsx — המועדון החדש של טבע בייק + מסלולי השירות (אחסנה / מקלחות / חבילה)
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'המועדון החדש — טבע בייק',
  description:
    'טבע בייק עוברים לבית חדש! מבנה מועדון חדש עם אחסון אופניים, חלל Indoor, מטבח, מכונת קרח ומקלחות חמות. אחסנה 25 ₪, מקלחות 25 ₪, חבילה משולבת 45 ₪ לחודש.',
}

const C = {
  brand: '#D4288A',
  dark: '#0C1814',
  green: '#152A1E',
  greenMid: '#1F3D2A',
  offWhite: '#F5F2EE',
  muted: '#BFD0C5',
}

const FEATURES = [
  { emoji: '🚲', title: 'מתקני אחסון אופניים חדשניים', text: 'לשמירה נוחה ומסודרת על האופניים שלכם.' },
  { emoji: '💪', title: 'חלל לפעילות Indoor', text: 'לאימונים ולפעילויות גם מחוץ למסלולים.' },
  { emoji: '☕', title: 'מטבח מאובזר', text: 'לשימוש חברי המועדון.' },
  { emoji: '🧊', title: 'מכונת קרח', text: 'לשימוש חופשי!' },
  { emoji: '🚿', title: 'מקלחות עם מים חמים', text: 'ללא הפסקה — כי אין כמו מקלחת טובה אחרי רכיבה!' },
]

const PLANS = [
  { id: 'storage', emoji: '🚲', name: 'אחסנת אופניים במועדון', price: 25, was: null as number | null, featured: false, payUrl: 'https://arbox.link/CNWZksHf' },
  { id: 'combo', emoji: '🚲🚿', name: 'חבילה משולבת: אחסנה + מקלחות חופשי', price: 45, was: 50, featured: true, payUrl: 'https://arbox.link/eSVSPD8g' },
  { id: 'showers', emoji: '🚿', name: 'שימוש במקלחות המועדון', price: 25, was: null, featured: false, payUrl: 'https://arbox.link/k1e9AKYp' },
]

export default function ClubPage() {
  return (
    <main dir="rtl" className="min-h-screen" style={{ background: C.dark, color: C.offWhite }}>
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-16 pb-14 text-center">
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse at top, ${C.brand}2e, transparent 60%)` }}
        />
        <div className="relative max-w-2xl mx-auto space-y-5">
          <p className="font-bold tracking-widest text-sm" style={{ color: C.brand }}>
            🚵‍♂️💜 טבע בייק מתחדשים
          </p>
          <h1 className="text-4xl md:text-5xl font-black leading-tight">
            עוברים לבית חדש! 🏠🔥
          </h1>
          <p className="text-lg" style={{ color: C.muted }}>
            רוכבים, מתאמנים ומשפחת טבע בייק היקרים — בימים אלה אנחנו עוברים דירה, ממש מעבר לפינה! 📦🚴‍♂️
          </p>
          <p className="text-lg" style={{ color: C.muted }}>
            בקרוב נפתח את דלתות <strong style={{ color: C.offWhite }}>מבנה המועדון החדש של טבע בייק</strong> 🎉
            — מרחב חדש, גדול ומפנק, שנבנה כדי לתת לכולנו הרבה יותר ממקום לרכוב ממנו או לחזור אליו.
          </p>
          <a
            href="#plans"
            className="inline-block rounded-xl px-8 py-3 font-bold transition hover:opacity-90"
            style={{ background: C.brand, color: '#fff' }}
          >
            למסלולי המנוי ←
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-black text-center mb-8">✨ מה מחכה לכם במועדון החדש?</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl p-6 border"
                style={{ background: C.green, borderColor: C.greenMid }}
              >
                <div className="text-4xl mb-3">{f.emoji}</div>
                <h3 className="font-bold text-lg mb-1">{f.title}</h3>
                <p style={{ color: C.muted }}>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="px-6 pb-16 scroll-mt-24">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-black text-center mb-2">💜 מסלולי השירות שלנו</h2>
          <p className="text-center mb-8" style={{ color: C.muted }}>
            ניתן לבחור בכל אחד מהשירותים בנפרד או ליהנות מהחבילה המשולבת במחיר מיוחד.
          </p>
          <div className="grid gap-5 md:grid-cols-3 items-stretch">
            {PLANS.map((p) => (
              <div
                key={p.id}
                className="relative rounded-2xl p-6 border-2 flex flex-col text-center"
                style={{
                  background: p.featured ? `${C.brand}1a` : C.green,
                  borderColor: p.featured ? C.brand : C.greenMid,
                }}
              >
                {p.featured && (
                  <span
                    className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold whitespace-nowrap"
                    style={{ background: C.brand, color: '#fff' }}
                  >
                    🔥 מבצע חבילה משולבת
                  </span>
                )}
                <div className="text-4xl mb-3 mt-2">{p.emoji}</div>
                <h3 className="font-bold text-lg mb-4 flex-1">{p.name}</h3>
                <div className="mb-5">
                  {p.was && (
                    <span className="line-through ml-2 text-lg" style={{ color: '#7E948A' }}>
                      {p.was} ₪
                    </span>
                  )}
                  <span className="text-4xl font-black">{p.price} ₪</span>
                  <span className="text-sm" style={{ color: C.muted }}> / לחודש</span>
                </div>
                <a
                  href={p.payUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl py-3 font-bold transition hover:opacity-90"
                  style={
                    p.featured
                      ? { background: C.brand, color: '#fff' }
                      : { background: 'transparent', color: C.offWhite, border: `1px solid ${C.brand}` }
                  }
                >
                  💳 להצטרפות ותשלום
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="px-6 pb-20 text-center">
        <div className="max-w-2xl mx-auto space-y-4">
          <p className="text-lg" style={{ color: C.muted }}>
            אנחנו ממשיכים להשקיע, להתפתח ולבנות עבורכם בית לרכיבה, לאימונים, למפגשים ולחוויות משותפות.
          </p>
          <p className="text-2xl font-black">💜🚵‍♂️ כי טבע בייק זה הרבה יותר מרכיבה — זה בית! 🏠🔥</p>
          <p style={{ color: C.muted }}>פרטים נוספים על פתיחת המועדון בקרוב!</p>
          <p className="font-bold" style={{ color: C.brand }}>צוות טבע בייק 🚴‍♂️💜</p>
        </div>
      </section>
    </main>
  )
}
