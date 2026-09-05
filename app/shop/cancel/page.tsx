// app/shop/cancel/page.tsx — טופס בקשת ביטול הזמנה (לא מבצע זיכוי בפועל,
// רק יוצר בקשה מתועדת + מתריע לצוות. הביטול בפועל נעשה ידנית בארבוקס.)
"use client";

import { useState } from "react";

const C = {
  brand: "#D4288A",
  dark: "#0C1814",
  green: "#152A1E",
  greenMid: "#1F3D2A",
  offWhite: "#F5F2EE",
};

type Reason = "not_wanted" | "defective" | "other";
type Status = "idle" | "sending" | "done" | "error";

export default function ShopCancelPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<{ eligible14Days: boolean | null; estimatedFee: number | null; matchedOrder: boolean } | null>(null);
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    order_reference: "",
    reason: "not_wanted" as Reason,
    reason_details: "",
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      alert("נא למלא שם וטלפון");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/shop-cancel-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        setResult({
          eligible14Days: data.eligible14Days ?? null,
          estimatedFee: data.estimatedFee ?? null,
          matchedOrder: !!data.matchedOrder,
        });
        setStatus("done");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  const input =
    "w-full rounded-lg p-3 outline-none border transition placeholder:opacity-60";
  const inputStyle = { background: C.dark, borderColor: C.greenMid, color: C.offWhite };

  return (
    <main dir="rtl" className="min-h-screen" style={{ background: C.dark, color: C.offWhite }}>
      <div className="max-w-xl mx-auto px-6 py-16">
        <a href="/shop" className="text-sm font-bold" style={{ color: C.brand }}>
          ← חזרה לחנות
        </a>
        <h1 className="text-3xl font-black mt-4 mb-4">ביטול הזמנה</h1>

        <div
          className="rounded-xl p-4 text-sm leading-relaxed mb-6 space-y-1"
          style={{ background: C.green, border: `1px solid ${C.greenMid}`, color: "#D8E2DC" }}
        >
          <p>
            בהתאם לחוק הגנת הצרכן, ניתן לבטל עסקה תוך 14 יום מקבלת המוצר, מכל סיבה שהיא.
          </p>
          <p>
            ביטול שלא עקב פגם עשוי לחייב דמי ביטול של עד 5% ממחיר המוצר או 100 ₪, הנמוך
            מביניהם. ביטול עקב פגם — זיכוי מלא, ללא דמי ביטול.
          </p>
          <p style={{ color: "#7E948A" }}>
            טופס זה <b>לא מבצע זיכוי אוטומטית</b> — הוא שולח בקשה מתועדת לצוות, וניצור איתך
            קשר בטלפון שהזנת לאישור סופי ולביצוע הזיכוי בפועל.
          </p>
        </div>

        {status === "done" && result ? (
          <div
            className="rounded-xl p-5 space-y-3 text-center"
            style={{ background: C.green, border: `1px solid ${C.brand}55` }}
          >
            <div className="text-4xl">✅</div>
            <h2 className="text-xl font-black">הבקשה נשלחה</h2>
            <p style={{ color: "#D8E2DC" }}>ניצור איתך קשר בטלפון שהזנת בהקדם לאישור ולהמשך הטיפול.</p>
            {result.matchedOrder ? (
              <p className="text-sm" style={{ color: "#9FB3A8" }}>
                {result.eligible14Days === false
                  ? "שימו לב: לפי ההזמנה שמצאנו, עברו יותר מ-14 יום — עדיין נבדוק את הבקשה."
                  : result.estimatedFee !== null && result.estimatedFee > 0
                    ? `דמי ביטול משוערים: ${result.estimatedFee} ₪ (בכפוף לאישור סופי).`
                    : "לא צפויים דמי ביטול (בכפוף לאישור סופי)."}
              </p>
            ) : (
              <p className="text-sm" style={{ color: "#9FB3A8" }}>
                לא מצאנו הזמנה תואמת אוטומטית לפי הטלפון — הצוות יבדוק זאת ידנית.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <input
              className={input}
              style={inputStyle}
              placeholder="שם מלא *"
              value={form.customer_name}
              onChange={(e) => set("customer_name", e.target.value)}
            />
            <input
              className={input}
              style={inputStyle}
              placeholder="טלפון (אותו מספר מההזמנה) *"
              inputMode="tel"
              value={form.customer_phone}
              onChange={(e) => set("customer_phone", e.target.value)}
            />
            <input
              className={input}
              style={inputStyle}
              placeholder="מספר הזמנה / תיאור ההזמנה (אם יש)"
              value={form.order_reference}
              onChange={(e) => set("order_reference", e.target.value)}
            />

            <div>
              <p className="text-sm mb-2" style={{ color: "#9FB3A8" }}>סיבת הביטול</p>
              <div className="grid grid-cols-1 gap-2">
                {(
                  [
                    ["not_wanted", "לא רוצה יותר / הוזמן בטעות"],
                    ["defective", "מוצר פגום / לא תקין"],
                    ["other", "אחר"],
                  ] as [Reason, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set("reason", value)}
                    className="rounded-lg p-3 text-sm border transition text-right"
                    style={
                      form.reason === value
                        ? { background: C.brand, borderColor: C.brand, color: "#fff", fontWeight: 700 }
                        : { background: C.dark, borderColor: C.greenMid, color: "#D8E2DC" }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              className={input}
              style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
              placeholder="פרטים נוספים (לא חובה)"
              value={form.reason_details}
              onChange={(e) => set("reason_details", e.target.value)}
            />

            <button
              onClick={submit}
              disabled={status === "sending"}
              className="w-full rounded-xl py-3 font-black transition disabled:opacity-50 hover:opacity-90"
              style={{ background: C.brand, color: "#fff" }}
            >
              {status === "sending" ? "שולח..." : "שליחת בקשת ביטול"}
            </button>

            {status === "error" && (
              <p className="text-sm text-center" style={{ color: "#FF8FA3" }}>
                משהו השתבש. נסה שוב או פנה אלינו בוואטסאפ / בטלפון 0509446696.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
