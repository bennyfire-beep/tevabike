'use client'

const PROMO_ENDS = new Date('2026-09-01T00:00:00+03:00')
const promoActive = () => new Date() < PROMO_ENDS

const CENTERS = [
  { name: 'משגב', day: 'ראשון', time: '15:30–17:00' },
  { name: 'ביריה', day: 'שני', time: '15:45–17:15' },
  { name: 'מטה אשר', day: 'שלישי', time: '' },
  { name: 'פרוד-אמירים', day: 'רביעי', time: '15:45–17:00' },
]

const WHY = [
  {
    icon: '🗺️',
    title: 'מסלולים חדשים בכל שבוע',
    text: 'בכל שבוע נצא ליעד אחר ברחבי הצפון — מגוון מסלולים, אתגרים וחוויות רכיבה חדשות.',
  },
  {
    icon: '⏱️',
    title: 'יותר זמן על האופניים',
    text: 'שעתיים מלאות של רכיבה. אימון משמעותי יותר, שיפור טכניקה, פיתוח ביטחון והמון זמן איכות בשטח.',
  },
  {
    icon: '🤝',
    title: 'מועדון אחד, קהילה אחת',
    text: 'כל רוכבי טבע בייק נפגשים לרכיבה משותפת. הילדים מכירים חברים חדשים, לומדים אחד מהשני ומרגישים חלק ממועדון גדול ומגובש.',
  },
]

const PLANS = [
  { title: 'אימון שבועי במרכז', price: 300, desc: 'האימון הקבוע בסניף שלכם' },
  { title: 'יומועדון בלבד', price: 360, desc: 'שישי 08:00–10:00' },
  { title: 'משולב', price: 640, desc: 'מרכז + יומועדון', best: true },
]

export default function YomoadonPage() {
  const promo = promoActive()

  return (
    <div dir="rtl" className="min-h-screen bg-stone-950 text-stone-100">
      {/* Hero */}
      <div className="border-b border-stone-800 px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-lime-400 text-sm tracking-[0.2em] mb-3">מסורת חדשה בטבע בייק</p>
          <h1 className="text-4xl md:text-5xl font-black mb-4">יומועדון</h1>
          <p className="text-xl text-stone-300">כל יום שישי · 08:00–10:00</p>
          <p className="text-stone-400 mt-4 max-w-xl mx-auto leading-relaxed">
            אימון מועדוני משותף לכל רוכבי טבע בייק. מסלול אחר בכל שבוע ברחבי הצפון,
            שעתיים מלאות על האופניים, וכל הסניפים רוכבים ביחד.
          </p>
          <a
            href="/register"
            className="inline-block mt-8 bg-lime-400 text-stone-950 font-bold px-8 py-4 rounded-xl text-lg"
          >
            להרשמה ←
          </a>
        </div>
      </div>

      {promo && (
        <div className="bg-gradient-to-l from-fuchsia-900/60 to-purple-900/40 border-b border-fuchsia-700 px-4 py-4">
          <p className="max-w-3xl mx-auto text-center text-fuchsia-100">
            <span className="font-bold">⚡ בוסט הרשמה — 5% הנחה</span>
            <span className="text-fuchsia-200/80"> · לחברים קיימים ולמצטרפים חדשים · עד 31.8 בלבד</span>
          </p>
        </div>
      )}

      {/* למה */}
      <section className="px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">למה דווקא יומועדון?</h2>
          <div className="space-y-4">
            {WHY.map((w) => (
              <div key={w.title} className="bg-stone-900/60 border border-stone-800 rounded-xl p-6">
                <div className="text-3xl mb-3">{w.icon}</div>
                <h3 className="font-bold text-lg text-lime-400 mb-2">{w.title}</h3>
                <p className="text-stone-300 leading-relaxed">{w.text}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-stone-400 mt-8 text-lg">
            בקיצור — יותר רכיבה, יותר מסלולים, יותר חברים ויותר חוויות.
          </p>
        </div>
      </section>

      {/* איך זה משתלב */}
      <section className="px-4 py-16 bg-stone-900/40 border-y border-stone-800">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-3 text-center">איך זה משתלב עם האימון הקבוע?</h2>
          <p className="text-stone-400 text-center mb-8 leading-relaxed">
            יומועדון מצטרף לאימון השבועי במרכז — הוא לא מחליף אותו.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {CENTERS.map((c) => (
              <div key={c.name} className="bg-stone-950 border border-stone-800 rounded-xl p-5">
                <h3 className="font-bold text-lg">{c.name}</h3>
                <p className="text-stone-400 text-sm mt-1">
                  יום {c.day}
                  {c.time ? ` · ${c.time}` : ''}
                </p>
                <p className="text-lime-400/70 text-xs mt-2">+ יומועדון בשישי</p>
              </div>
            ))}
          </div>
          <p className="text-stone-500 text-sm text-center mt-6">
            יומועדון פתוח לרוכבי מיני גרביטי וגרביטי פרו.
          </p>
        </div>
      </section>

      {/* עלויות */}
      <section className="px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">עלויות</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {PLANS.map((p) => (
              <div
                key={p.title}
                className={`rounded-xl p-6 text-center border ${
                  p.best ? 'bg-lime-400 text-stone-950 border-lime-400' : 'bg-stone-900/60 border-stone-800'
                }`}
              >
                {p.best && <div className="text-[11px] font-bold mb-2">הכי משתלם</div>}
                <h3 className="font-bold">{p.title}</h3>
                <div className="text-3xl font-black my-3">₪{p.price}</div>
                <p className={`text-xs ${p.best ? 'text-stone-800' : 'text-stone-500'}`}>לחודש</p>
                <p className={`text-sm mt-3 ${p.best ? 'text-stone-800' : 'text-stone-400'}`}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* הסעות */}
      <section className="px-4 py-16 bg-stone-900/40 border-y border-stone-800">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-4xl mb-4">🚐</div>
          <h2 className="text-2xl font-bold mb-4">הסעות</h2>
          <p className="text-stone-300 leading-relaxed">
            האימונים מתקיימים בכל פעם באזור אחר, ולכן אנחנו מקימים מערך הסעות שיתופי —
            גם בין ההורים וגם בעזרת צוות טבע בייק, שיסייע בהסעות על בסיס מקום פנוי ברכבי החברה.
          </p>
          <p className="text-lime-400 mt-4">
            המטרה: שכל ילד שרוצה להשתתף יוכל להגיע.
          </p>
        </div>
      </section>

      {/* סיום */}
      <section className="px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-stone-300 text-lg leading-relaxed mb-8">
            אנחנו מאמינים שיומועדון יהפוך לאחד מרגעי השיא של השבוע עבור הילדים —
            חוויה שתעניק להם יותר אתגר, יותר חברים והמון הנאה על השבילים.
          </p>
          <a href="/register" className="inline-block bg-lime-400 text-stone-950 font-bold px-8 py-4 rounded-xl text-lg">
            להרשמה ←
          </a>
          <p className="text-stone-500 text-sm mt-8">
            שאלות, מחשבות או התלבטויות? כתבו לנו ונשמח לענות.
            <br />
            <a href="https://wa.me/972525708084" className="text-lime-400 underline">052-5708084</a>
          </p>
        </div>
      </section>
    </div>
  )
}
