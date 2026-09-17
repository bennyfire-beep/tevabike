// app/instructors-course/page.tsx — קורס מדריכי רכיבה טכנית באופני הרים (טבע בייק × מכללת משגב)
"use client";

import { useEffect, useState } from "react";
import { WHATSAPP_OPTIN_LABEL } from "@/lib/whatsapp-optin";
import { COURSE_DATES_LABEL, COLLEGE_REGISTRATION_LINK, COLLEGE_PHONE } from "@/lib/instructors-course";

const C = {
  brand: "#f0b90b",
  brandHover: "#cf9f09",
  dark: "#0C1814",
  green: "#152A1E",
  greenMid: "#1F3D2A",
  offWhite: "#F5F2EE",
};

const WHAT_YOULL_LEARN = [
  {
    title: "תפקיד המדריך ואחריות מקצועית",
    points: [
      "תפקידו של מדריך רכיבת אופני הרים",
      "אחריות, אתיקה והתנהלות מקצועית",
      "התאמת האימון לרמת הרוכבים",
      "תקשורת נכונה עם ילדים, בני נוער ומבוגרים",
      "ניהול קבוצה בשטח",
    ],
  },
  {
    title: "בניית שיעור וניהול סיכונים",
    points: [
      "הגדרת מטרות לשיעור",
      "תכנון מערך הדרכה",
      "הכרת המסלול ובדיקת תנאי השטח",
      "זיהוי סיכונים והכנת חלופות",
      "קביעת גבולות פעילות ותנאים לעצירת האימון",
      "התאמת מספר המדריכים לגודל הקבוצה ולרמתה",
    ],
  },
  {
    title: "בדיקות לפני הרכיבה",
    points: [
      "העברת תדריך פתיחה מקצועי",
      "בדיקת התאמת הקסדה והמיגון",
      "בדיקת אופניים בסיסית לפני יציאה",
      "חלוקת תפקידים בין המדריכים",
      "קביעת נקודות כינוס, עצירה ותקשורת",
    ],
  },
  {
    title: "עקרונות ההדרכה הטכנית",
    points: [
      "עמידת מוצא נכונה",
      "מבט ותכנון התנועה",
      "בחירת קו וקריאת השטח",
      "ויסות מהירות ובלימה",
      "שיווי משקל ושליטה במהירות נמוכה",
      "מעבר הדרגתי מתרגול פשוט לשטח מורכב",
      "מתן משוב קצר, ברור ומקדם",
    ],
  },
  {
    title: "הובלת קבוצה והתמודדות עם אירועים בשטח",
    points: [
      "ניהול קבוצה בזמן רכיבה",
      "שמירה על מרחקים וקצב מתאים",
      "ניווט ותכנון מסלול",
      "טיפול בתקלות מכניות בסיסיות",
      "התנהלות במקרה של שינוי במזג האוויר",
      "הכרת דרכי גישה, יציאה ופינוי",
      "ניהול הקבוצה באירוע חריג",
    ],
  },
];

const COURSE_UNITS = [
  "אחריות המדריך, ציוד, תדריך והערכת סיכונים",
  "הדגמה, ניהול קבוצה ובניית שיעור",
  "יסודות הרכיבה הטכנית והדרך ללמד אותם",
  "בחירת קו, קריאת שטח והתאמת התרגול לרמות שונות",
  "תרחישי שטח, התנסות בהדרכה ומבחן מסכם",
];

const MICRO_LESSON = [
  "הגדרת מטרה",
  "זיהוי סיכונים",
  "תדריך והדגמה",
  "תצפית על הרוכבים",
  "מתן משוב",
  "התאמת התרגול לרמות שונות",
];

const WHO_FOR = [
  "להפוך את הידע והניסיון שלהם ליכולת הדרכה מקצועית",
  "לעבוד עם ילדים, בני נוער או מבוגרים",
  "להוביל קבוצות רכיבה",
  "להשתלב במועדוני אופניים ובמסגרות חינוך וספורט",
  "לשפר את יכולות ההסבר, ההדגמה וניהול הקבוצה",
  "להתפתח מקצועית בתחום רכיבת השטח",
];

const COURSE_FACTS: [string, string][] = [
  ["📅 מועד הקורס", COURSE_DATES_LABEL],
  ["🚵 הכשרת רכיבה", "15 שעות"],
  ["🩹 עזרה ראשונה", "15 שעות נוספות (במכללה)"],
  ["📍 מיקום", "מועדון טבע בייק, משגב"],
  ["👥 משתתפים", "מינימום 8, מקסימום 15"],
  ["💰 עלות", "3,200 ₪ כולל מע״מ למשתתף"],
];

function Section({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-6 pb-10">
      <div className="max-w-2xl mx-auto">
        {title && <h2 className="text-2xl font-black mb-4">{title}</h2>}
        {children}
      </div>
    </section>
  );
}

export default function InstructorsCoursePage() {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
  });
  const [whatsappOptin, setWhatsappOptin] = useState(false);
  const [utm, setUtm] = useState({ utm_source: "", utm_medium: "", utm_campaign: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setUtm({
      utm_source: p.get("utm_source") || "",
      utm_medium: p.get("utm_medium") || "",
      utm_campaign: p.get("utm_campaign") || "",
    });
  }, []);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function scrollToForm() {
    document.getElementById("course-form")?.scrollIntoView({ behavior: "smooth" });
  }

  async function submit() {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim() || !form.email.trim()) {
      alert("נא למלא שם פרטי, שם משפחה, טלפון ומייל");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/course-instructors-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          email: form.email,
          ...utm,
          whatsapp_optin: whatsappOptin,
        }),
      });
      if (res.ok) setStatus("done");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  const input =
    "w-full rounded-lg p-3 outline-none border transition placeholder:opacity-60";
  const inputStyle = {
    background: C.dark,
    borderColor: C.greenMid,
    color: C.offWhite,
  };

  if (status === "done") {
    return (
      <main
        dir="rtl"
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: C.dark, color: C.offWhite }}
      >
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-6xl">🎓</div>
          <h1 className="text-3xl font-black">קיבלנו את הפרטים שלך!</h1>
          <p style={{ color: "#BFD0C5" }}>
            ניצור איתך קשר בהקדם עם כל הפרטים, ונשלח לך את קישור ההרשמה הרשמי
            של מכללת משגב להשלמת הרישום לקורס.
          </p>
          {COLLEGE_REGISTRATION_LINK && (
            <a
              href={COLLEGE_REGISTRATION_LINK}
              className="block w-full rounded-xl py-4 text-lg font-bold transition hover:opacity-90"
              style={{ background: C.brand, color: C.dark }}
            >
              להרשמה הרשמית במכללה
            </a>
          )}
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen" style={{ background: C.dark, color: C.offWhite }}>
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-16 pb-12 text-center">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at top, ${C.brand}26, transparent 60%)`,
          }}
        />
        <div className="relative max-w-2xl mx-auto space-y-5">
          <img
            src="/instructors-course-hero.jpg"
            alt="קורס מדריכי רכיבה טכנית באופני הרים — טבע בייק ומכללת משגב"
            className="w-full rounded-2xl border shadow-lg"
            style={{ borderColor: `${C.brand}55` }}
          />
          <p className="font-bold tracking-widest text-sm" style={{ color: C.brand }}>
            טבע בייק אקדמי · בשיתוף מכללת משגב לחינוך וספורט
          </p>
          <h1 className="text-4xl sm:text-5xl font-black leading-tight">
            קורס מדריכי רכיבה טכנית
            <br />
            <span style={{ color: C.brand }}>באופני הרים</span>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: "#D8E2DC" }}>
            הופכים את ניסיון הרכיבה ליכולת הדרכה מקצועית.
          </p>
          <p className="leading-relaxed" style={{ color: "#D8E2DC" }}>
            קורס מקצועי ומעשי להכשרת מדריכי רכיבה טכנית באופני הרים, בשיתוף
            פעולה בין מועדון טבע בייק לבין מכללת משגב לחינוך וספורט ע״ר — בית
            הספר למאמנים ולמדריכים. מיועד לרוכבים מנוסים המעוניינים לרכוש כלים
            מקצועיים להדרכה, להוביל קבוצות וללמד מיומנויות רכיבה בצורה בטוחה,
            הדרגתית ומותאמת לרמת המשתתפים.
          </p>
          <button
            onClick={scrollToForm}
            className="inline-block rounded-xl px-8 py-4 text-lg font-black transition hover:opacity-90"
            style={{ background: C.brand, color: C.dark }}
          >
            להרשמה ולקבלת פרטים
          </button>
        </div>
      </section>

      {/* Quick facts */}
      <section className="px-6 pb-10">
        <div className="max-w-2xl mx-auto grid grid-cols-2 gap-3 text-sm">
          {COURSE_FACTS.map(([k, v]) => (
            <div
              key={k}
              className="rounded-xl p-4 border"
              style={{ background: C.green, borderColor: C.greenMid }}
            >
              <div className="font-bold mb-1" style={{ color: C.brand }}>{k}</div>
              <div style={{ color: "#D8E2DC" }}>{v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* מטרת הקורס */}
      <Section title="מטרת הקורס">
        <p className="leading-relaxed" style={{ color: "#D8E2DC" }}>
          להכשיר מדריכים המסוגלים לתכנן ולהעביר שיעורי רכיבת שטח טכנית באופן
          מקצועי ואחראי. במהלך הקורס ילמדו המשתתפים לזהות את רמת הרוכבים,
          להעריך את תנאי השטח והסיכונים, ללמד מיומנויות רכיבה בצורה הדרגתית
          ולהעניק לכל רוכב חוויית למידה בטוחה, חיובית ומקדמת. הקורס משלב ידע
          מקצועי, תרגול מעשי והתנסות בהדרכה בשטח.
        </p>
      </Section>

      {/* מה תלמדו בקורס */}
      <Section title="מה תלמדו בקורס?">
        <div className="grid grid-cols-1 gap-3">
          {WHAT_YOULL_LEARN.map((cat) => (
            <div
              key={cat.title}
              className="rounded-xl p-4 border"
              style={{ background: C.green, borderColor: C.greenMid }}
            >
              <div className="font-bold mb-2" style={{ color: C.brand }}>{cat.title}</div>
              <ul className="space-y-1 text-sm list-disc pr-5" style={{ color: "#D8E2DC" }}>
                {cat.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* מבנה הקורס */}
      <Section title="מבנה הקורס">
        <p className="mb-3 leading-relaxed" style={{ color: "#D8E2DC" }}>
          ההכשרה כוללת 15 שעות לימודי רכיבה והדרכה טכנית, המחולקות לחמש
          יחידות מקצועיות:
        </p>
        <ol className="space-y-2 text-sm list-decimal pr-5" style={{ color: "#D8E2DC" }}>
          {COURSE_UNITS.map((u) => (
            <li key={u}>{u}</li>
          ))}
        </ol>
        <p className="mt-3 leading-relaxed" style={{ color: "#D8E2DC" }}>
          בנוסף, המשתתפים יעברו קורס עזרה ראשונה בהיקף של 15 שעות, שיועבר
          במסגרת המכללה.
        </p>
      </Section>

      {/* הכשרה מעשית */}
      <Section title="הכשרה מעשית ולא רק לימודים בכיתה">
        <p className="mb-3 leading-relaxed" style={{ color: "#D8E2DC" }}>
          אנחנו מאמינים שכדי ללמוד להדריך רכיבה צריך לצאת לשטח. חלק מרכזי
          בקורס יוקדש להתנסות מעשית: המשתתפים יתכננו שיעורים, יעבירו תדריכים,
          ידגימו מיומנויות, יתנסו בניהול קבוצה ויקבלו משוב מקצועי.
        </p>
        <div
          className="rounded-xl p-4 border"
          style={{ background: C.green, borderColor: C.greenMid }}
        >
          <div className="font-bold mb-2" style={{ color: C.brand }}>
            כל משתתף יתבקש להכין מערך שיעור קצר ולהעביר מיקרו־שיעור הכולל:
          </div>
          <ul className="space-y-1 text-sm list-disc pr-5" style={{ color: "#D8E2DC" }}>
            {MICRO_LESSON.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      </Section>

      {/* למי הקורס מתאים */}
      <Section title="למי הקורס מתאים?">
        <p className="mb-3 leading-relaxed" style={{ color: "#D8E2DC" }}>
          הקורס מתאים לרוכבות ולרוכבים בעלי ניסיון ברכיבת אופני הרים, המעוניינים:
        </p>
        <ul className="space-y-1 text-sm list-disc pr-5" style={{ color: "#D8E2DC" }}>
          {WHO_FOR.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm" style={{ color: "#7E948A" }}>
          תנאי הקבלה, דרישות הנוכחות ורמת הרכיבה הנדרשת ייקבעו בהתאם לסילבוס
          ולדרישות המכללה.
        </p>
      </Section>

      {/* תעודת סיום */}
      <Section title="תעודת סיום">
        <p className="leading-relaxed" style={{ color: "#D8E2DC" }}>
          משתתפים שיעמדו בדרישות הקורס, בדרישות הנוכחות, בהערכה המעשית וביתר
          התנאים שייקבעו, יקבלו תעודת מדריך רכיבה טכנית באופני הרים, מטעם
          מכללת משגב לחינוך וספורט ומועדון טבע בייק. נוסח התעודה ותנאי ההסמכה
          כפופים לאישור הסופי של המכללה.
        </p>
      </Section>

      {/* למה טבע בייק */}
      <Section title="למה ללמוד בטבע בייק?">
        <p className="mb-4 leading-relaxed" style={{ color: "#D8E2DC" }}>
          טבע בייק הוא מועדון רכיבת אופניים מקצועי הפועל במשגב ומכשיר רוכבים
          במגוון גילאים ורמות — מילדים העושים את צעדיהם הראשונים בתחום ועד
          לרוכבי גרביטי ואנדורו תחרותיים. המועדון מתמחה בהדרכת רכיבת שטח
          טכנית, בניית תהליכי למידה, פיתוח ביטחון על האופניים, ניהול קבוצות
          והכנת רוכבים להתמודדות עם מסלולים ואתגרים ברמות שונות. הפעילות
          בטבע בייק מבוססת על שילוב בין מקצועיות, בטיחות, יחס אישי, אהבת השטח
          והבנה שכל רוכב מתקדם בקצב שלו.
        </p>
        <p className="mb-3 font-bold" style={{ color: C.offWhite }}>
          את הקורס יעבירו בני להט וטל ברקן:
        </p>
        <div className="space-y-3">
          <div
            className="rounded-xl p-4 border flex gap-4 items-start"
            style={{ background: C.green, borderColor: C.greenMid }}
          >
            <img
              src="/benny-lahat.jpg"
              alt="בני להט — מנהל מקצועי ומוביל הקורס"
              className="w-20 h-20 rounded-full object-cover flex-shrink-0"
              style={{ border: `2px solid ${C.brand}` }}
            />
            <div>
              <div className="font-bold mb-1" style={{ color: C.brand }}>
                בני להט — מנהל מקצועי ומוביל הקורס
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "#D8E2DC" }}>
                בני להט הוא מייסד ומנהל מועדון טבע בייק ומדריך רכיבת אופני הרים
                משנת 2008. במהלך השנים הדריך וליווה רוכבים רבים — ילדים, בני
                נוער ומבוגרים — מרמת מתחילים ועד לרכיבה טכנית ותחרותית. בני עוסק
                בבניית תוכניות הדרכה, הכשרת מדריכים, ניהול צוותים מקצועיים,
                הפקת מחנות ואירועי רכיבה וליווי רוכבים בתהליכי התפתחות ארוכי
                טווח. הגישה המקצועית שלו משלבת ידע טכני, ניסיון מעשי רב, קריאת
                שטח, הבנת הרוכב ויכולת להפוך מיומנות מורכבת לתהליך לימוד פשוט,
                ברור והדרגתי.
              </p>
            </div>
          </div>

          <div
            className="rounded-xl p-4 border flex gap-4 items-start"
            style={{ background: C.green, borderColor: C.greenMid }}
          >
            <img
              src="/tal-barkan.jpg"
              alt="טל ברקן — רכז החוגים ומדריך בקורס"
              className="w-20 h-20 rounded-full object-cover flex-shrink-0"
              style={{ border: `2px solid ${C.brand}` }}
            />
            <div>
              <div className="font-bold mb-1" style={{ color: C.brand }}>
                טל ברקן — רכז החוגים ומדריך בקורס
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "#D8E2DC" }}>
                טל ברקן הוא רכז החוגים של טבע בייק, ואחראי על התיאום השוטף מול
                המדריכים והרוכבים ועל הליווי המקצועי של הקבוצות בכל הסניפים.
                בקורס הוא ישלים את בני בהיבטים הארגוניים והמעשיים של ניהול
                קבוצה בשטח ותפעול שיעור.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* פרטי הקורס */}
      <Section title="פרטי הקורס">
        <div
          className="rounded-xl p-5 border text-sm space-y-2"
          style={{ background: C.green, borderColor: C.greenMid, color: "#D8E2DC" }}
        >
          <p>היקף הכשרת הרכיבה: <b style={{ color: C.offWhite }}>15 שעות</b></p>
          <p>קורס עזרה ראשונה: <b style={{ color: C.offWhite }}>15 שעות נוספות</b></p>
          <p>מיקום: <b style={{ color: C.offWhite }}>מועדון טבע בייק, משגב</b></p>
          <p>מספר משתתפים: <b style={{ color: C.offWhite }}>מינימום 8, מקסימום 15</b></p>
          <p>עלות: <b style={{ color: C.offWhite }}>3,200 ₪ כולל מע״מ למשתתף</b></p>
          <p>אופי הקורס: <b style={{ color: C.offWhite }}>מעשי ועיוני</b></p>
          <p>רישום ותשלום: <b style={{ color: C.offWhite }}>באמצעות קישור הרשמה של המכללה</b></p>
          <p>לפרטים ולהרשמה טלפונית: <b style={{ color: C.offWhite }}>{COLLEGE_PHONE}</b> (מכללת משגב)</p>
          <p className="pt-2" style={{ color: "#7E948A" }}>
            הקורס ייפתח בכפוף למספר הנרשמים המינימלי ולעמידה בתנאי הקבלה.
          </p>
        </div>
      </Section>

      {/* Closing CTA */}
      <section className="px-6 pb-10 text-center">
        <div className="max-w-2xl mx-auto space-y-3">
          <h2 className="text-2xl font-black">
            מוכנים להפוך את האהבה לרכיבה למקצוע?
          </h2>
          <p className="leading-relaxed" style={{ color: "#D8E2DC" }}>
            אם אתם אוהבים אופני הרים, נהנים לעבוד עם אנשים ורוצים לקבל כלים
            מקצועיים להדרכה בטוחה, איכותית ומקדמת — זה הקורס עבורכם. מספר
            המקומות מוגבל ל־15 משתתפים בלבד.
          </p>
        </div>
      </section>

      {/* Form */}
      <section id="course-form" className="px-6 pb-16">
        <div
          className="max-w-2xl mx-auto rounded-2xl p-6 space-y-4 border"
          style={{ background: C.green, borderColor: `${C.brand}55` }}
        >
          <h2 className="text-2xl font-black">אני רוצה לקבל פרטים ולהירשם</h2>

          <div className="grid grid-cols-2 gap-3">
            <input
              className={input}
              style={inputStyle}
              placeholder="שם פרטי *"
              value={form.first_name}
              onChange={(e) => set("first_name", e.target.value)}
            />
            <input
              className={input}
              style={inputStyle}
              placeholder="שם משפחה *"
              value={form.last_name}
              onChange={(e) => set("last_name", e.target.value)}
            />
          </div>
          <input
            className={input}
            style={inputStyle}
            placeholder="טלפון נייד *"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
          <input
            className={input}
            style={inputStyle}
            placeholder="אימייל *"
            inputMode="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />

          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={whatsappOptin}
              onChange={(e) => setWhatsappOptin(e.target.checked)}
              className="mt-1 h-4 w-4 accent-yellow-500"
            />
            <span style={{ color: "#D8E2DC" }}>{WHATSAPP_OPTIN_LABEL}</span>
          </label>

          <p className="text-xs" style={{ color: "#7E948A" }}>
            לאחר קבלת הפרטים ניצור איתך קשר ונשלח לך קישור להרשמה הרשמית
            במכללת משגב.
          </p>

          <button
            onClick={submit}
            disabled={status === "sending"}
            className="w-full rounded-xl py-4 text-lg font-black transition disabled:opacity-50 hover:opacity-90"
            style={{ background: C.brand, color: C.dark }}
          >
            {status === "sending" ? "שולח..." : "שליחת פרטים"}
          </button>

          {status === "error" && (
            <p className="text-sm" style={{ color: "#FF8FA3" }}>
              משהו השתבש. נסה שוב או כתוב לנו בוואטסאפ.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
