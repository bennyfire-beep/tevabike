// app/privacy/page.tsx — מדיניות פרטיות, ציבורי לגמרי (בלי התחברות).
//
// הטקסט הועתק כלשונו ממסמך גוגל "מדיניות פרטיות - טבע בייק" (9 סעיפים
// ממוספרים), בלי קיצורים. העיצוב עוקב אחרי /shop: אותם צבעי מותג, אותה
// טיפוגרפיה (Heebo גלובלי מ-app/layout.tsx), רקע כהה.
//
// לא 'use client' בכוונה — התוכן סטטי לגמרי, אין state. Meta דורשת שה-URL
// הזה ייטען בלי חסימת login כדי לאשר את אפליקציית הווטסאפ.

import type { Metadata } from "next";
import Link from "next/link";

const C = {
  brand: "#D4288A",
  dark: "#0C1814",
  green: "#152A1E",
  greenMid: "#1F3D2A",
  offWhite: "#F5F2EE",
};

export const metadata: Metadata = {
  title: "מדיניות פרטיות — טבע בייק",
  description: "איזה מידע טבע בייק אוספת, איך משתמשים בו, ואיך ליצור קשר בנושא.",
};

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "1. איזה מידע אנחנו אוספים",
    body: (
      <ul className="list-disc pr-5 space-y-2">
        <li>
          פרטי קשר ורישום: שם מלא, מספר טלפון, כתובת דוא&quot;ל, ופרטי המשתתף
          הרלוונטיים לפעילות (גיל, קבוצה, רמת רכיבה).
        </li>
        <li>פרטי הורה/אפוטרופוס עבור משתתפים קטינים.</li>
        <li>מידע הנדרש לטיולים לחו&quot;ל, כגון פרטי דרכון, כאשר הרישום מחייב זאת.</li>
        <li>תכתובות שאתם יוזמים מולנו – לרבות הודעות ווטסאפ, דוא&quot;ל ופניות דרך טפסי האתר.</li>
        <li>מידע תפעולי בסיסי על השימוש באתר, לצורכי אבטחה ותקינות.</li>
      </ul>
    ),
  },
  {
    title: "2. שימוש בשירותי ווטסאפ",
    body: (
      <p className="leading-relaxed">
        אנו משתמשים ב-WhatsApp Business Platform של Meta כדי לתקשר עם לקוחות
        ומתעניינים. כאשר אתם שולחים אלינו הודעה בווטסאפ, תוכן ההודעה, מספר
        הטלפון שלכם והשם המוצג נשמרים במערכת הניהול שלנו כדי שנוכל לענות,
        לעקוב אחר הפנייה ולתת שירות. איננו שולחים הודעות שיווקיות למי שלא
        ביקש זאת, וניתן לבקש בכל רגע להפסיק לקבל מאיתנו הודעות.
      </p>
    ),
  },
  {
    title: "3. למה אנחנו משתמשים במידע",
    body: (
      <ul className="list-disc pr-5 space-y-2">
        <li>לרישום ולניהול השתתפות בחוגים, מחנות, סדנאות וטיולים.</li>
        <li>ליצירת קשר בנוגע לפעילות, שינויים, תשלומים ובטיחות.</li>
        <li>לניהול תשלומים וחשבוניות מול ספקי הסליקה והנהלת החשבונות שלנו.</li>
        <li>לעמידה בדרישות רגולטוריות וביטוחיות החלות על פעילות ספורט וטיולים.</li>
      </ul>
    ),
  },
  {
    title: "4. שיתוף מידע עם צדדים שלישיים",
    body: (
      <p className="leading-relaxed">
        איננו מוכרים מידע אישי. אנחנו משתפים מידע רק במידה הנדרשת לתפעול
        השירות, ובכלל זה: ספקי תשתית ואחסון (Supabase, Vercel), שירותי
        תקשורת ודיוור (Meta WhatsApp, Resend), מערכת ניהול הלקוחות שלנו
        (Arbox), מדריכים ורכזים מטעמנו לצורך הפעלת הפעילות, וספקי טיולים
        ולינה כאשר הדבר נדרש לביצוע הזמנה. כמו כן נעביר מידע אם נידרש לכך
        על פי דין.
      </p>
    ),
  },
  {
    title: "5. שמירת מידע ואבטחתו",
    body: (
      <p className="leading-relaxed">
        המידע נשמר כל עוד הוא נדרש לצורכי הפעילות ולעמידה בחובות חוקיות.
        אנו נוקטים אמצעי אבטחה מקובלים, לרבות הצפנה בהעברה, הרשאות גישה
        מוגבלות לצוות מורשה בלבד, וסביבות מאובטחות אצל ספקי האחסון שלנו.
      </p>
    ),
  },
  {
    title: "6. פרטיות קטינים",
    body: (
      <p className="leading-relaxed">
        חלק ניכר מפעילותנו מיועד לילדים ולנוער. רישום קטין נעשה על ידי הורה
        או אפוטרופוס, והמידע נאסף למטרת הפעלת הפעילות ובטיחות המשתתף בלבד.
      </p>
    ),
  },
  {
    title: "7. הזכויות שלכם",
    body: (
      <p className="leading-relaxed">
        אתם רשאים לפנות אלינו כדי לעיין במידע שנשמר עליכם, לתקן אותו, לבקש
        את מחיקתו או להפסיק לקבל מאיתנו הודעות. נטפל בפנייה בתוך זמן סביר.
      </p>
    ),
  },
  {
    title: "8. יצירת קשר",
    body: (
      <div className="space-y-1">
        <p>טבע בייק – בני להט</p>
        <p>
          דוא&quot;ל:{" "}
          <a href="mailto:bennyfire@gmail.com" className="underline" style={{ color: C.brand }}>
            bennyfire@gmail.com
          </a>
        </p>
        <p>
          טלפון:{" "}
          <a href="tel:0525708084" className="underline" style={{ color: C.brand }}>
            052-570-8084
          </a>
        </p>
      </div>
    ),
  },
  {
    title: "9. שינויים במדיניות",
    body: (
      <p className="leading-relaxed">
        נעדכן מסמך זה מעת לעת. תאריך העדכון האחרון מופיע בראשו.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main dir="rtl" className="min-h-screen" style={{ background: C.dark, color: C.offWhite }}>
      {/* Hero — logo + כותרת, כמו ב/shop */}
      <section className="relative overflow-hidden px-6 pt-16 pb-10 text-center">
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse at top, ${C.brand}26, transparent 60%)` }}
        />
        <div className="relative max-w-2xl mx-auto space-y-4">
          <Link href="/" className="inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="טבע בייק" style={{ height: 48, borderRadius: 6, margin: "0 auto 8px", display: "block" }} />
          </Link>
          <p className="font-bold tracking-widest text-sm" style={{ color: C.brand }}>
            טבע בייק
          </p>
          <h1 className="text-4xl sm:text-5xl font-black leading-tight">מדיניות פרטיות</h1>
          <p className="text-sm" style={{ color: "#9FB3A8" }}>עודכן לאחרונה: 28 באוגוסט 2026</p>
          <p className="text-lg leading-relaxed" style={{ color: "#D8E2DC" }}>
            טבע בייק (&quot;אנחנו&quot;) מפעילה את האתר tevabike.com ואת שירותי ההדרכה, המחנות
            והטיולים הנלווים. מדיניות זו מסבירה איזה מידע אנחנו אוספים, כיצד אנו
            משתמשים בו וכיצד ניתן לפנות אלינו בנושא.
          </p>
        </div>
      </section>

      {/* Sections */}
      <section className="px-6 pb-20">
        <div className="max-w-2xl mx-auto space-y-6">
          {SECTIONS.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl p-6 border"
              style={{ background: C.green, borderColor: C.greenMid }}
            >
              <h2 className="text-xl font-black mb-3">{s.title}</h2>
              <div style={{ color: "#D8E2DC" }}>{s.body}</div>
            </div>
          ))}

          <div className="text-center pt-4">
            <Link href="/" className="text-sm underline" style={{ color: "#9FB3A8" }}>
              חזרה לעמוד הבית
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
