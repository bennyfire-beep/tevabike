// app/shop/terms/page.tsx — תקנון רכישה לחנות טבע בייק
import type { ReactNode } from "react";

const C = {
  brand: "#D4288A",
  dark: "#0C1814",
  green: "#152A1E",
  greenMid: "#1F3D2A",
  offWhite: "#F5F2EE",
};

const SECTIONS: { title: string; body: ReactNode }[] = [
  {
    title: "1. כללי",
    body: "רכישה באתר זה כפופה לתנאים אלו. השלמת הזמנה מהווה הסכמה מלאה לתקנון.",
  },
  {
    title: "2. תהליך רכישה",
    body: "בחירת מוצר/ים, מילוי פרטים אישיים, ותשלום מאובטח דרך שער סליקה חיצוני (ארבוקס). לאחר תשלום תישלח הודעת אישור למייל.",
  },
  {
    title: "3. מחירים",
    body: 'כל המחירים באתר כוללים מע"מ כדין.',
  },
  {
    title: "4. אספקה",
    body: "משלוח עד 7–10 ימי עסקים; איסוף עצמי מתואם מראש. עלות משלוח 35 ₪, חינם בהזמנה מעל 600 ₪.",
  },
  {
    title: "5. אחריות",
    body: "האחריות על המוצרים הנמכרים בחנות זו, לרבות אחריות היצרן ואחריות המשלוח, חלה על הספק (פאן רייד סחר בע\"מ) ולא על טבע בייק.",
  },
  {
    title: "6. ביטול עסקה, החלפות והחזרות",
    body: (
      <>
        בהתאם לחוק הגנת הצרכן, ניתן לבטל עסקה תוך 14 יום מקבלת המוצר. החלפות והחזרות
        מתבצעות בתיאום מראש מול מחסני הספק בלבד, בטלפון 0509446696, בשעות הפעילות:
        א&apos;–ה&apos; 08:00–16:00 (בימי שישי ושבת אין מענה). ביטול שלא עקב פגם עשוי לחייב
        דמי ביטול בשיעור של עד 5% ממחיר המוצר או 100 ₪, לפי הנמוך. למילוי טופס בקשת ביטול —{" "}
        <a href="/shop/cancel" className="underline font-bold" style={{ color: C.brand }}>
          לחצו כאן
        </a>
        .
      </>
    ),
  },
  {
    title: "7. פרטיות",
    body: "הפרטים שתמסור ישמשו לביצוע ההזמנה בלבד ולא יועברו לצד שלישי מלבד הספק והגורם הסולק, לצורך השלמת העסקה.",
  },
  {
    title: "8. אחריות טבע בייק",
    body: "טבע בייק מספקת פלטפורמה להזמנה ותיווך מול הספק; היא אינה צד לעסקת המכר ואינה אחראית לאספקה, לאיכות המוצר או לתקינותו.",
  },
];

export default function ShopTermsPage() {
  return (
    <main dir="rtl" className="min-h-screen" style={{ background: C.dark, color: C.offWhite }}>
      <div className="max-w-2xl mx-auto px-6 py-16">
        <a href="/shop" className="text-sm font-bold" style={{ color: C.brand }}>
          ← חזרה לחנות
        </a>
        <h1 className="text-3xl font-black mt-4 mb-8">תקנון רכישה — חנות טבע בייק</h1>
        <div className="space-y-6">
          {SECTIONS.map((s) => (
            <div
              key={s.title}
              className="rounded-xl p-5 border"
              style={{ background: C.green, borderColor: C.greenMid }}
            >
              <h2 className="text-lg font-black mb-2" style={{ color: C.brand }}>
                {s.title}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "#D8E2DC" }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
