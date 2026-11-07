// app/workshop-airbag/page.tsx — דף רישום סשן איר באג (גרסה 9 — סשן 13.11 לילדים מגיל 11, קפיצה חופשית עם מדריך בשטח, עד 25 משתתפים)
"use client";

import { useEffect, useState } from "react";
import { WHATSAPP_OPTIN_LABEL } from "@/lib/whatsapp-optin";
import { CLUB_GROUPS } from "@/lib/workshop-payment";

const OUTSIDE = "outside";

const PAYMENT_LINK = "https://arbox.link/IdCW6--f"; // Arbox: "סשיין air bag" — 180 ₪
const PRICE = 180;
const MIN_AGE = 11;

const C = {
  brand: "#D4288A",
  brandHover: "#B51E77",
  dark: "#0C1814",
  green: "#152A1E",
  greenMid: "#1F3D2A",
  offWhite: "#F5F2EE",
};

const DATES = [
  { value: "2026-11-13", label: "שישי 13.11", sub: "9:00–13:00" },
];

const WAIVER = [
  "אני מאשר/ת את השתתפותי בסשן האיר באג של טבע בייק.",
  "ידוע לי שרכיבת שטח וקפיצות הן פעילות אתגרית הכוללת סיכונים מהותיים, לרבות נפילה, פציעה ונזק גופני, ואני מאשר/ת את ההשתתפות מתוך בחירה מלאה ובאחריותי.",
  "ידוע לי שהסשן מיועד לרוכבים מגיל 11 ומעלה ושנדרשת יכולת רכיבה בסיסית ומעלה.",
  "ידוע לי שזהו סשן קפיצה חופשי: מדריך נמצא בשטח לאורך כל הסשן, אך הסשן אינו כולל הדרכה.",
  "אם הרוכב/ת קטין/ה — ההרשמה והאישור נעשים על ידי הורה או אפוטרופוס.",
  "ידוע לי שחובה להגיע עם קסדת פול פייס וצב (מגן גב וחזה) — רוכב/ת בלי פול פייס וצב לא יורשה/תורשה לקפוץ.",
  "אני אחראי/ת להגיע עם אופניים תקינים ובטיחותיים, מים וציוד אישי כנדרש.",
  "אני מתחייב/ת לעדכן את מארגני הסשן בכל מגבלה רפואית או רגישות רלוונטית.",
];

export default function WorkshopAirbagPage() {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    age: "",
    workshop_date: "2026-11-13",
    club_group: "",
    notes: "",
  });
  const [waiver, setWaiver] = useState(false);
  const [whatsappOptin, setWhatsappOptin] = useState(false);
  const [utm, setUtm] = useState({ utm_source: "", utm_medium: "", utm_campaign: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "full" | "error">("idle");
  const [free, setFree] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setUtm({
      utm_source: p.get("utm_source") || "",
      utm_medium: p.get("utm_medium") || "",
      utm_campaign: p.get("utm_campaign") || "",
    });
  }, []);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!form.full_name.trim() || !form.phone.trim() || !form.email.trim()) {
      alert("נא למלא שם, טלפון ומייל");
      return;
    }
    if (!form.club_group) {
      alert("נא לבחור קבוצה");
      return;
    }
    const ageNum = parseInt(form.age, 10);
    if (!form.age.trim() || Number.isNaN(ageNum)) {
      alert("נא למלא גיל");
      return;
    }
    if (ageNum < MIN_AGE) {
      alert(`הסשן מיועד לרוכבים מגיל ${MIN_AGE} ומעלה`);
      return;
    }
    if (!waiver) {
      alert("כדי להירשם יש לאשר את תנאי ההשתתפות והאחריות");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/workshop-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...utm, waiver_accepted: true, whatsapp_optin: whatsappOptin }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setFree(data?.free === true);
        setStatus("done");
      }
      else {
        const data = await res.json().catch(() => ({}));
        setStatus(data?.error === "workshop_full" ? "full" : "error");
      }
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
          <div className="text-6xl">🚵</div>
          <h1 className="text-3xl font-black">נרשמת! עכשיו נשאר רק לעוף</h1>
          {free ? (
            <p style={{ color: "#BFD0C5" }}>
              שלחנו לך מייל אישור עם כל הפרטים.
              <br />
              המקום שלך שמור — נתראה בשישי! 💚
            </p>
          ) : (
          <>
          <p style={{ color: "#BFD0C5" }}>
            שלחנו לך מייל אישור עם כל הפרטים.
            <br />
            כדי לשריין את המקום — נשאר רק להשלים תשלום:
          </p>
          <a
            href={PAYMENT_LINK}
            className="block w-full rounded-xl py-4 text-lg font-bold transition hover:opacity-90"
            style={{ background: C.brand, color: "#fff" }}
          >
            לתשלום מאובטח — {PRICE} ₪
          </a>
          <p className="text-xs" style={{ color: "#7E948A" }}>
            ביטול עד 14 יום לפני הסשן — החזר של 50% · פחות מ־3 ימים לפני — ללא החזר
          </p>
          </>
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
            src="/airbag-session-nov13.jpg"
            alt="פוסטר סשן איירבג — 13 בנובמבר, 09:00–13:00, מוזמנים"
            className="w-full rounded-2xl border shadow-lg"
            style={{ borderColor: `${C.brand}55` }}
          />
          <p className="font-bold tracking-widest text-sm" style={{ color: C.brand }}>
            טבע בייק · סשן AIR BAG · שישי 13.11 · מגיל 11
          </p>
          <h1 className="text-4xl sm:text-5xl font-black leading-tight">
            לשלוט באוויר.
            <br />
            <span style={{ color: C.brand }}>לא לפחד ממנו.</span>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: "#D8E2DC" }}>
            ארבע שעות של קפיצות חופשיות על שתי כריות אוויר — לצבור עוד ועוד
            זמן אוויר, לנסות, ליפול רך ולחזור לרמפה.
          </p>
          <p className="leading-relaxed" style={{ color: "#D8E2DC" }}>
            <b style={{ color: C.brand }}>שתי כריות אוויר</b> — ארבג קטנה וארבג
            גדולה. <b style={{ color: C.brand }}>מגיל 11 ומעלה, פתוח לכל הרוכבים —
            גם מחוץ לטבע בייק.</b> מדריך נמצא בשטח לאורך כל הסשן לשמירה על
            הסדר והבטיחות — זהו סשן קפיצה חופשי, ללא הדרכה.
          </p>
        </div>
      </section>

      {/* Details */}
      <section className="px-6 pb-10">
        <div className="max-w-2xl mx-auto grid grid-cols-2 gap-3 text-sm">
          {[
            ["📍 איפה", "משגב, פארק אוסטרליה (בוויז)"],
            ["🕗 מתי", "שישי 13.11 · 9:00–13:00"],
            ["🎯 למי", "מגיל 11 ומעלה · פתוח גם לרוכבים מבחוץ"],
            ["💰 עלות", `${PRICE} ₪`],
            ["⛑️ חובה", "קסדת פול פייס + צב · בלי — לא קופצים"],
            ["👥 מקומות", "עד 25 רוכבים · מדריך בשטח, ללא הדרכה"],
          ].map(([k, v]) => (
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

      {/* Schedule */}
      <section className="px-6 pb-10">
        <div
          className="max-w-2xl mx-auto rounded-xl p-5 border"
          style={{ background: C.green, borderColor: C.greenMid }}
        >
          <h2 className="font-bold text-lg mb-3">הלו״ז</h2>
          <ul className="space-y-2 text-sm" style={{ color: "#D8E2DC" }}>
            <li><b style={{ color: C.brand }}>9:00</b> — התכנסות וכללי בטיחות בשטח</li>
            <li><b style={{ color: C.brand }}>9:15</b> — קפיצה חופשית על הארבג הקטנה והגדולה</li>
            <li><b style={{ color: C.brand }}>13:00</b> — סיום</li>
          </ul>
        </div>
      </section>

      {/* Form */}
      <section className="px-6 pb-16">
        <div
          className="max-w-2xl mx-auto rounded-2xl p-6 space-y-4 border"
          style={{ background: C.green, borderColor: `${C.brand}55` }}
        >
          <h2 className="text-2xl font-black">הרשמה לסשן</h2>

          {/* Date picker */}
          <div className="grid grid-cols-1 gap-3">
            {DATES.map((d) => {
              const active = form.workshop_date === d.value;
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => set("workshop_date", d.value)}
                  className="rounded-xl p-4 text-center border transition"
                  style={
                    active
                      ? { background: C.brand, borderColor: C.brand, color: "#fff", fontWeight: 700 }
                      : { background: C.dark, borderColor: C.greenMid, color: "#D8E2DC" }
                  }
                >
                  <div className="text-lg">{d.label}</div>
                  <div className="text-xs opacity-80">{d.sub}</div>
                </button>
              );
            })}
          </div>

          <input
            className={input}
            style={inputStyle}
            placeholder="שם הרוכב/ת *"
            value={form.full_name}
            onChange={(e) => set("full_name", e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className={input}
              style={inputStyle}
              placeholder="טלפון *"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
            <input
              className={input}
              style={inputStyle}
              placeholder="גיל * (מגיל 11)"
              inputMode="numeric"
              value={form.age}
              onChange={(e) => set("age", e.target.value)}
            />
          </div>
          <input
            className={input}
            style={inputStyle}
            placeholder="אימייל *"
            inputMode="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
          <select
            className={input}
            style={inputStyle}
            value={form.club_group}
            onChange={(e) => set("club_group", e.target.value)}
          >
            <option value="" disabled>קבוצה *</option>
            {CLUB_GROUPS.map((g) => (
              <option key={g} value={g}>רוכב/ת טבע בייק — {g}</option>
            ))}
            <option value={OUTSIDE}>לא רוכב/ת בטבע בייק</option>
          </select>
          <textarea
            className={input}
            style={inputStyle}
            placeholder="הערות (לא חובה)"
            rows={2}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />

          {/* תנאי השתתפות ואחריות */}
          <div
            className="rounded-xl p-4 border text-sm leading-relaxed"
            style={{ background: C.dark, borderColor: C.greenMid, color: "#BFD0C5" }}
          >
            <div className="font-bold mb-2" style={{ color: C.offWhite }}>
              תנאי השתתפות ואחריות
            </div>
            {WAIVER.map((line) => (
              <p key={line} className="mb-1">{line}</p>
            ))}
            <p className="mt-2" style={{ color: "#7E948A" }}>
              תנאי ביטול: ביטול עד 14 יום לפני הסשן — החזר של 50%. פחות מ־3 ימים
              לפני הסשן — ללא החזר.
            </p>
            <label className="flex items-start gap-2 mt-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={waiver}
                onChange={(e) => setWaiver(e.target.checked)}
                className="mt-1 h-4 w-4 accent-pink-600"
              />
              <span style={{ color: C.offWhite }}>
                קראתי ואני מאשר/ת את תנאי ההשתתפות, האחריות והביטול *
              </span>
            </label>
          </div>

          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={whatsappOptin}
              onChange={(e) => setWhatsappOptin(e.target.checked)}
              className="mt-1 h-4 w-4 accent-pink-600"
            />
            <span style={{ color: "#D8E2DC" }}>{WHATSAPP_OPTIN_LABEL}</span>
          </label>

          <button
            onClick={submit}
            disabled={status === "sending"}
            className="w-full rounded-xl py-4 text-lg font-black transition disabled:opacity-50 hover:opacity-90"
            style={{ background: C.brand, color: "#fff" }}
          >
            {status === "sending" ? "שולח..." : "הירשם עכשיו ותתחיל לעוף 🚀"}
          </button>

          {status === "full" && (
            <p className="text-sm font-bold" style={{ color: "#FF8FA3" }}>
              הסשן מלא 😢 השאר פרטים בצור קשר ונעדכן אם יתפנה מקום.
            </p>
          )}
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
