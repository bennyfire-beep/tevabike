// app/workshop-airbag/page.tsx — דף רישום סדנת איר באג (גרסה 7 — תיקון שם קובץ תמונה)
"use client";

import { useEffect, useState } from "react";
import { WHATSAPP_OPTIN_LABEL } from "@/lib/whatsapp-optin";

const PAYMENT_LINK = "https://arbox.link/IdCW6--f";

const C = {
  brand: "#D4288A",
  brandHover: "#B51E77",
  dark: "#0C1814",
  green: "#152A1E",
  greenMid: "#1F3D2A",
  offWhite: "#F5F2EE",
};

const DATES = [
  { value: "2026-09-04", label: "שישי 4.9", sub: "8:00–12:00" },
  { value: "2026-09-11", label: "שישי 11.9", sub: "ערב ראש השנה · 8:00–12:00" },
];

const BRANDS = [
  { value: "", label: "מותג האופניים שלי (לא חובה)" },
  { value: "whistle", label: "Whistle — ‏10% הנחה 🎁" },
  { value: "ktm", label: "KTM — ‏10% הנחה 🎁" },
  { value: "bh", label: "BH — ‏10% הנחה 🎁" },
  { value: "other", label: "מותג אחר" },
];

const WAIVER = [
  "אני מאשר/ת את השתתפותי בסדנת האיר באג של טבע בייק.",
  "ידוע לי שרכיבת שטח וקפיצות הן פעילות אתגרית הכוללת סיכונים מהותיים, לרבות נפילה, פציעה ונזק גופני, ואני מאשר/ת את ההשתתפות מתוך בחירה מלאה ובאחריותי.",
  "ידוע לי שנדרשת יכולת רכיבה בסיסית ומעלה.",
  "אני אחראי/ת להגיע עם אופניים תקינים ובטיחותיים, קסדת פול פייס, מיגון גוף, מים וציוד אישי כנדרש.",
  "אני מתחייב/ת לעדכן את מארגני הסדנה בכל מגבלה רפואית או רגישות רלוונטית.",
];

export default function WorkshopAirbagPage() {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    age: "",
    workshop_date: "2026-09-04",
    bike_brand: "",
    notes: "",
  });
  const [waiver, setWaiver] = useState(false);
  const [whatsappOptin, setWhatsappOptin] = useState(false);
  const [utm, setUtm] = useState({ utm_source: "", utm_medium: "", utm_campaign: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "full" | "error">("idle");

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
      if (res.ok) setStatus("done");
      else {
        const data = await res.json().catch(() => ({}));
        setStatus(data?.error === "workshop_full" ? "full" : "error");
      }
    } catch {
      setStatus("error");
    }
  }

  const discount = ["whistle", "ktm", "bh"].includes(form.bike_brand);

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
            לתשלום מאובטח — 200 ₪ {discount && "(10% הנחה תינתן בסדנה)"}
          </a>
          <p className="text-xs" style={{ color: "#7E948A" }}>
            ביטול עד 14 יום לפני הסדנה — החזר של 50% · פחות מ־3 ימים לפני — ללא החזר
          </p>
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
            src="/workshop-hero.jpg.jpg"
            alt="רוכב באוויר מעל כרית האוויר של טבע בייק — סדנת איר באג"
            className="w-full rounded-2xl border shadow-lg"
            style={{ borderColor: `${C.brand}55` }}
          />
          <p className="font-bold tracking-widest text-sm" style={{ color: C.brand }}>
            טבע בייק · סדנת AIR BAG
          </p>
          <h1 className="text-4xl sm:text-5xl font-black leading-tight">
            לשלוט באוויר.
            <br />
            <span style={{ color: C.brand }}>לא לפחד ממנו.</span>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: "#D8E2DC" }}>
            מכיר את הרגע? אתה מגיע לקפיצה, החברים כבר באוויר — ואתה על הבלמים.
            זה לא חוסר כישרון. זו טכניקה שאף אחד לא לימד אותך.
          </p>
          <p className="leading-relaxed" style={{ color: "#D8E2DC" }}>
            כרית אוויר ייעודית בגובה{" "}
            <b style={{ color: C.brand }}>1.20 מ׳</b> עם רמפה מודולרית בזווית נוחה
            למתחילים — סביבה בטוחה לטעות, לתקן, ולבנות ביטחון אמיתי באוויר. תוך בוקר
            אחד: המראה יציבה, שליטה באוויר, נחיתה רכה.
          </p>
        </div>
      </section>

      {/* Details */}
      <section className="px-6 pb-10">
        <div className="max-w-2xl mx-auto grid grid-cols-2 gap-3 text-sm">
          {[
            ["📍 איפה", "משגב, פארק אוסטרליה (בוויז)"],
            ["🕗 מתי", "שישי 4.9 או 11.9 · 8:00–12:00"],
            ["🎯 למי", "פתוח לכולם · רמת מתחילים"],
            ["💰 עלות", "200 ₪ · Whistle/KTM/BH — ‏10% הנחה"],
            ["🚲 להביא", "אופניים תקינים, קסדת פול פייס, מיגון"],
            ["👥 מקומות", "עד 16 משתתפים בלבד לסדנה"],
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
            <li><b style={{ color: C.brand }}>8:00</b> — קפה קטן והיכרות</li>
            <li><b style={{ color: C.brand }}>8:30</b> — תדריך ותחילת תרגול</li>
            <li><b style={{ color: C.brand }}>10:00</b> — הפסקת רענון (15 דק׳)</li>
            <li><b style={{ color: C.brand }}>12:00</b> — סיום וסיכום</li>
          </ul>
        </div>
      </section>

      {/* Form */}
      <section className="px-6 pb-16">
        <div
          className="max-w-2xl mx-auto rounded-2xl p-6 space-y-4 border"
          style={{ background: C.green, borderColor: `${C.brand}55` }}
        >
          <h2 className="text-2xl font-black">הרשמה לסדנה</h2>

          {/* Date picker */}
          <div className="grid grid-cols-2 gap-3">
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
            placeholder="שם מלא *"
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
              placeholder="גיל"
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
            value={form.bike_brand}
            onChange={(e) => set("bike_brand", e.target.value)}
          >
            {BRANDS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
          <textarea
            className={input}
            style={inputStyle}
            placeholder="הערות (לא חובה)"
            rows={2}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />

          {discount && (
            <p className="text-sm font-bold" style={{ color: C.brand }}>
              🎁 מגיעה לך 10% הנחה! ההנחה תינתן בסדנה עם הצגת האופניים.
            </p>
          )}

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
              תנאי ביטול: ביטול עד 14 יום לפני הסדנה — החזר של 50%. פחות מ־3 ימים
              לפני הסדנה — ללא החזר.
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
              הסדנה בתאריך הזה מלאה 😢 נסה את התאריך השני, או השאר פרטים בצור קשר
              ונעדכן אם יתפנה מקום.
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
