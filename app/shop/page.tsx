// app/shop/page.tsx — דף חנות טבע בייק (גרסה 5 — בחירה מרובה + תשלום ישיר בארבוקס)
"use client";

import { useState } from "react";

const C = {
  brand: "#D4288A",
  brandHover: "#B51E77",
  dark: "#0C1814",
  green: "#152A1E",
  greenMid: "#1F3D2A",
  offWhite: "#F5F2EE",
};

type Product = {
  slug: string;
  brand: string;
  name: string;
  spec: string;
  price: number;
  marketPrice: number;
  variantLabel: string;
  variants: string[];
  image: string;
  // אופציונלי: תמונה ומק"ט ספציפיים לכל וריאנט (למשל רייז כידון). כשלא מוגדר
  // — נופלים חזרה לתמונת ה-image הכללית ולא מציגים מק"ט.
  variantImages?: Record<string, string>;
  variantSkus?: Record<string, string>;
};

// סדר הקבוע הזה משמש גם לבניית מפתח הצירוף (COMBO) — אל תשנה סדר בלי לעדכן ARBOX_LINKS.
const PRODUCTS: Product[] = [
  {
    slug: "spank-spoon-35",
    brand: "SPANK",
    name: "כידון ספון 35",
    spec: 'קוטר 35 מ"מ · רוחב 800 מ"מ · שחור בלבד',
    price: 399,
    marketPrice: 450,
    variantLabel: "רייז",
    variants: ["40mm", "60mm"],
    image: "/spoon35m.webp",
    variantImages: {
      "40mm": "/spoon35-40mm.jpg.webp",
      "60mm": "/spoon35-60mm.jpg.webp",
    },
    variantSkus: {
      "40mm": "2115",
      "60mm": "2116",
    },
  },
  {
    slug: "spank-spike-33-grip",
    brand: "SPANK",
    name: "גריפים ספייק 33",
    spec: 'קוטר 33 מ"מ · Interlocking Column',
    price: 139,
    marketPrice: 149,
    variantLabel: "צבע",
    variants: ["שחור", "קרם"],
    image: "/SPIKE33MAIN123.webp",
  },
  {
    slug: "spank-spoon-pedals",
    brand: "SPANK",
    name: "פדלים ספון",
    spec: 'ציר Chromoly · עובי 16 מ"מ · 20 פינים לאחיזה',
    price: 449,
    marketPrice: 495,
    variantLabel: "צבע",
    variants: ["שחור", "בורדו", "כחול", "ירוק ליים", "סגול", "כתום", "זהב", "לבן"],
    image: "/spank%20pedal.webp",
  },
];

// קישורי תשלום בארבוקס לכל צירוף אפשרי (7 = 3 בודדים + 3 זוגות + שלישיה).
const ARBOX_LINKS: Record<string, string> = {
  "spank-spoon-35": "https://arbox.link/Ww_B1s0m",
  "spank-spike-33-grip": "https://arbox.link/b47ZV4mf",
  "spank-spoon-pedals": "https://arbox.link/sJ4q7GJJ",
  "spank-spoon-35+spank-spike-33-grip": "https://arbox.link/Z3G-I2NI",
  "spank-spike-33-grip+spank-spoon-pedals": "https://arbox.link/argsWl45",
  "spank-spoon-35+spank-spoon-pedals": "https://arbox.link/irFHdfoU",
  "spank-spoon-35+spank-spike-33-grip+spank-spoon-pedals": "https://arbox.link/dVxDfHUx",
};

function comboKey(slugs: string[]): string {
  return PRODUCTS.filter((p) => slugs.includes(p.slug))
    .map((p) => p.slug)
    .join("+");
}

const SHIPPING_COST = 35;
const FREE_SHIPPING_THRESHOLD = 600;

type Status = "idle" | "sending" | "done" | "error";

export default function ShopPage() {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [variantBySlug, setVariantBySlug] = useState<Record<string, string>>({});
  const [panelOpen, setPanelOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    fulfillment: "pickup" as "pickup" | "delivery",
    delivery_city: "",
    delivery_street: "",
    termsAccepted: false,
  });

  const selectedSlugs = PRODUCTS.filter((p) => selected[p.slug]).map((p) => p.slug);
  const selectedProducts = PRODUCTS.filter((p) => selected[p.slug]);
  const subtotal = selectedProducts.reduce((sum, p) => sum + p.price, 0);
  const shipping =
    form.fulfillment === "delivery" && subtotal > 0 && subtotal < FREE_SHIPPING_THRESHOLD
      ? SHIPPING_COST
      : 0;
  const total = subtotal + shipping;
  const key = comboKey(selectedSlugs);
  const payLink = ARBOX_LINKS[key];

  function toggle(slug: string) {
    setSelected((s) => ({ ...s, [slug]: !s[slug] }));
    setVariantBySlug((v) =>
      v[slug] ? v : { ...v, [slug]: PRODUCTS.find((p) => p.slug === slug)!.variants[0] }
    );
    setStatus("idle");
  }

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (selectedSlugs.length === 0) return;
    if (!payLink) {
      alert("הצירוף הזה עדיין לא זמין להזמנה. נסה שילוב אחר או פנה אלינו בוואטסאפ.");
      return;
    }
    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      alert("נא למלא שם וטלפון");
      return;
    }
    if (
      form.fulfillment === "delivery" &&
      (!form.delivery_city.trim() || !form.delivery_street.trim())
    ) {
      alert("נא למלא עיר וכתובת למשלוח");
      return;
    }
    if (!form.termsAccepted) {
      alert("יש לאשר את תקנון האתר לפני מעבר לתשלום");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/shop-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selectedProducts.map((p) => ({
            product_slug: p.slug,
            product_name: p.name,
            variant: variantBySlug[p.slug] || p.variants[0],
          })),
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          fulfillment: form.fulfillment,
          delivery_city: form.delivery_city,
          delivery_street: form.delivery_street,
          shipping_amount: shipping,
          total_amount: total,
        }),
      });
      if (res.ok) {
        setStatus("done");
        window.location.href = payLink;
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
      <section className="relative overflow-hidden px-6 pt-16 pb-10 text-center">
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse at top, ${C.brand}26, transparent 60%)` }}
        />
        <div className="relative max-w-2xl mx-auto space-y-4">
          <p className="font-bold tracking-widest text-sm" style={{ color: C.brand }}>
            טבע בייק · חנות
          </p>
          <h1 className="text-4xl sm:text-5xl font-black leading-tight">
            הציוד שאנחנו
            <br />
            <span style={{ color: C.brand }}>רוכבים איתו בעצמנו.</span>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: "#D8E2DC" }}>
            חלקים נבחרים במחירי הכי משתלמים — סמנו מה שאתם צריכים ותשלמו על הכל ביחד.
          </p>
        </div>
      </section>

      <section className="px-6 pb-8">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-5">
          {PRODUCTS.map((p) => {
            const isChecked = !!selected[p.slug];
            const currentVariant = variantBySlug[p.slug] || p.variants[0];
            const currentImage = p.variantImages?.[currentVariant] || p.image;
            const currentSku = p.variantSkus?.[currentVariant];
            const discountPct = Math.round(((p.marketPrice - p.price) / p.marketPrice) * 100);
            return (
              <div
                key={p.slug}
                className="rounded-2xl p-5 border flex flex-col text-center transition"
                style={{
                  background: C.green,
                  borderColor: isChecked ? C.brand : C.greenMid,
                }}
              >
                <label className="flex items-center justify-center gap-2 mb-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(p.slug)}
                    className="w-5 h-5 accent-current"
                    style={{ accentColor: C.brand }}
                  />
                  <span className="text-sm font-bold" style={{ color: "#D8E2DC" }}>
                    הוסף להזמנה
                  </span>
                </label>

                <div
                  className="mb-4 mx-auto rounded-xl overflow-hidden flex items-center justify-center"
                  style={{ width: "100%", aspectRatio: "1 / 1", background: C.dark }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentImage} alt={`${p.name} ${p.variantImages ? currentVariant : ""}`.trim()} className="w-full h-full object-contain" />
                </div>
                <p className="text-xs font-bold tracking-widest mb-1" style={{ color: C.brand }}>
                  {p.brand}
                </p>
                <h3 className="text-lg font-black mb-1">{p.name}</h3>
                <p className="text-xs mb-4 leading-relaxed flex-1" style={{ color: "#9FB3A8" }}>
                  {p.spec}
                </p>
                <div className="mb-1">
                  <span className="text-2xl font-black">{p.price} ₪</span>
                  <span className="text-xs mr-2 line-through" style={{ color: "#7E948A" }}>
                    {p.marketPrice} ₪
                  </span>
                </div>
                {discountPct > 0 && (
                  <p className="text-xs font-bold mb-1" style={{ color: C.brand }}>
                    {discountPct}% הנחה למזמינים באתר
                  </p>
                )}
                {currentSku && (
                  <p className="text-xs mb-3" style={{ color: "#7E948A" }}>
                    מק&quot;ט: {currentSku}
                  </p>
                )}
                {!currentSku && <div className="mb-3" />}

                {isChecked && (
                  <div className="mt-auto">
                    <p className="text-xs mb-2" style={{ color: "#9FB3A8" }}>{p.variantLabel}</p>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {p.variants.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setVariantBySlug((s) => ({ ...s, [p.slug]: v }))}
                          className="rounded-md px-2 py-1 text-xs border transition"
                          style={
                            (variantBySlug[p.slug] || p.variants[0]) === v
                              ? { background: C.brand, borderColor: C.brand, color: "#fff", fontWeight: 700 }
                              : { background: C.dark, borderColor: C.greenMid, color: "#D8E2DC" }
                          }
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {selectedSlugs.length > 0 && (
        <div
          className="sticky bottom-0 z-40 border-t px-6 py-4"
          style={{ background: C.green, borderColor: C.greenMid }}
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <p style={{ color: "#D8E2DC" }}>
              {selectedProducts.map((p) => p.name).join(" + ")}
              <br />
              <span className="text-sm" style={{ color: "#9FB3A8" }}>
                {subtotal} ₪
                {form.fulfillment === "delivery" &&
                  (shipping === 0 ? " · משלוח חינם" : ` · משלוח ${shipping} ₪`)}
              </span>
            </p>
            <button
              onClick={() => setPanelOpen(true)}
              className="rounded-xl px-6 py-3 font-black transition hover:opacity-90"
              style={{ background: C.brand, color: "#fff" }}
            >
              המשך להזמנה — {total} ₪
            </button>
          </div>
        </div>
      )}

      <section className="px-6 py-8 text-center">
        <div
          className="max-w-2xl mx-auto rounded-xl p-4 text-xs leading-relaxed space-y-1"
          style={{ background: C.green, border: `1px solid ${C.greenMid}`, color: "#9FB3A8" }}
        >
          <p>האחריות על המוצרים והאחריות על המשלוח הן באחריות פאן רייד.</p>
          <p>
            החלפות והחזרות בתיאום מראש מול מחסני החברה — לתיאום: 0509446696.
          </p>
          <p>
            מענה טלפוני להחלפות/החזרות ולבירורי משלוח: ימים א&apos;–ה&apos; 08:00–16:00. בימי שישי
            ושבת אין מענה.
          </p>
        </div>
      </section>

      {panelOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setPanelOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4 border"
            style={{ background: C.green, borderColor: `${C.brand}55` }}
            onClick={(e) => e.stopPropagation()}
          >
            {status === "done" ? (
              <div className="text-center space-y-4 py-6">
                <div className="text-5xl">✅</div>
                <h2 className="text-2xl font-black">מעביר אותך לתשלום…</h2>
                <p style={{ color: "#D8E2DC" }}>
                  {selectedProducts.map((p) => p.name).join(" + ")}
                  <br />
                  סה״כ לתשלום: <b style={{ color: C.offWhite }}>{total} ₪</b>
                  <br />
                  <span style={{ color: "#9FB3A8", fontSize: 13 }}>
                    אם לא הועברת אוטומטית, <a href={payLink} style={{ color: C.brand }}>לחץ כאן לתשלום</a>.
                  </span>
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black">פרטי הזמנה</h2>
                  <button onClick={() => setPanelOpen(false)} className="text-xl opacity-70">✕</button>
                </div>

                <div
                  className="rounded-lg p-3 text-sm space-y-1"
                  style={{ background: C.dark, border: `1px solid ${C.greenMid}` }}
                >
                  {selectedProducts.map((p) => (
                    <div key={p.slug} className="flex justify-between" style={{ color: "#D8E2DC" }}>
                      <span>{p.name} ({variantBySlug[p.slug] || p.variants[0]})</span>
                      <span>{p.price} ₪</span>
                    </div>
                  ))}
                  {form.fulfillment === "delivery" && (
                    <div className="flex justify-between" style={{ color: "#D8E2DC" }}>
                      <span>משלוח</span>
                      <span>{shipping === 0 ? "חינם" : `${shipping} ₪`}</span>
                    </div>
                  )}
                  <div
                    className="flex justify-between font-bold pt-1 mt-1"
                    style={{ borderTop: `1px solid ${C.greenMid}`, color: C.offWhite }}
                  >
                    <span>סה״כ</span>
                    <span>{total} ₪</span>
                  </div>
                  {form.fulfillment === "delivery" && shipping > 0 && (
                    <p className="text-xs pt-1" style={{ color: "#7E948A" }}>
                      משלוח חינם בהזמנה מעל {FREE_SHIPPING_THRESHOLD} ₪
                    </p>
                  )}
                </div>

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
                  placeholder="טלפון *"
                  inputMode="tel"
                  value={form.customer_phone}
                  onChange={(e) => set("customer_phone", e.target.value)}
                />

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => set("fulfillment", "pickup")}
                    className="rounded-lg p-3 text-sm border transition"
                    style={
                      form.fulfillment === "pickup"
                        ? { background: C.brand, borderColor: C.brand, color: "#fff", fontWeight: 700 }
                        : { background: C.dark, borderColor: C.greenMid, color: "#D8E2DC" }
                    }
                  >
                    איסוף עצמי
                  </button>
                  <button
                    type="button"
                    onClick={() => set("fulfillment", "delivery")}
                    className="rounded-lg p-3 text-sm border transition"
                    style={
                      form.fulfillment === "delivery"
                        ? { background: C.brand, borderColor: C.brand, color: "#fff", fontWeight: 700 }
                        : { background: C.dark, borderColor: C.greenMid, color: "#D8E2DC" }
                    }
                  >
                    משלוח
                  </button>
                </div>

                {form.fulfillment === "delivery" && (
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className={input}
                      style={inputStyle}
                      placeholder="עיר *"
                      value={form.delivery_city}
                      onChange={(e) => set("delivery_city", e.target.value)}
                    />
                    <input
                      className={input}
                      style={inputStyle}
                      placeholder="כתובת (רחוב ומספר) *"
                      value={form.delivery_street}
                      onChange={(e) => set("delivery_street", e.target.value)}
                    />
                  </div>
                )}

                <p className="text-xs leading-relaxed" style={{ color: "#7E948A" }}>
                  לחיצה על "מעבר לתשלום" תעביר אותך לעמוד תשלום מאובטח. החלפות והחזרות בתיאום מראש
                  מול מחסני החברה — 0509446696.
                </p>

                <label className="flex items-start gap-2 text-sm cursor-pointer" style={{ color: "#D8E2DC" }}>
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={form.termsAccepted}
                    onChange={(e) => set("termsAccepted", e.target.checked)}
                  />
                  <span>
                    קראתי ואני מאשר/ת את{" "}
                    <a
                      href="/shop/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                      style={{ color: C.brand }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      תקנון האתר
                    </a>
                  </span>
                </label>

                <button
                  onClick={submit}
                  disabled={status === "sending" || !payLink || !form.termsAccepted}
                  className="w-full rounded-xl py-3 font-black transition disabled:opacity-50 hover:opacity-90"
                  style={{ background: C.brand, color: "#fff" }}
                >
                  {status === "sending" ? "שולח..." : `מעבר לתשלום — ${total} ₪`}
                </button>

                {status === "error" && (
                  <p className="text-sm text-center" style={{ color: "#FF8FA3" }}>
                    משהו השתבש. נסה שוב או כתוב לנו בוואטסאפ.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
