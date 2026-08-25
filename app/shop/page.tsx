// app/shop/page.tsx — דף חנות טבע בייק (גרסה 2 — תמונות אמיתיות + מלאי פתיחה)
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
};

const PRODUCTS: Product[] = [
  {
    slug: "spank-spoon-35",
    brand: "SPANK",
    name: "כידון ספון 35",
    spec: 'קוטר 35 מ"מ · רוחב 800 מ"מ · שחור בלבד',
    price: 399,
    marketPrice: 450,
    variantLabel: "רייז",
    variants: ["25mm", "40mm", "60mm"],
    image: "/spoon35m.webp",
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

type Status = "idle" | "sending" | "done" | "error";

export default function ShopPage() {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [form, setForm] = useState({
    variant: "",
    quantity: "1",
    customer_name: "",
    customer_phone: "",
    fulfillment: "pickup" as "pickup" | "delivery",
    delivery_address: "",
  });

  const openProduct = PRODUCTS.find((p) => p.slug === openSlug) || null;

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function openOrder(p: Product) {
    setOpenSlug(p.slug);
    setStatus("idle");
    setForm({
      variant: p.variants[0],
      quantity: "1",
      customer_name: "",
      customer_phone: "",
      fulfillment: "pickup",
      delivery_address: "",
    });
  }

  async function submit() {
    if (!openProduct) return;
    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      alert("נא למלא שם וטלפון");
      return;
    }
    if (form.fulfillment === "delivery" && !form.delivery_address.trim()) {
      alert("נא למלא כתובת למשלוח");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/shop-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_slug: openProduct.slug,
          product_name: openProduct.name,
          color: form.variant,
          quantity: form.quantity,
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          fulfillment: form.fulfillment,
          delivery_address: form.delivery_address,
        }),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  const input =
    "w-full rounded-lg p-3 outline-none border transition placeholder:opacity-60";
  const inputStyle = { background: C.dark, borderColor: C.greenMid, color: C.offWhite };

  return (
    <main dir="rtl" className="min-h-screen" style={{ background: C.dark, color: C.offWhite }}>
      {/* Hero */}
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
            חלקים נבחרים במחירי הכי משתלמים — ישירות מהמדריכים של טבע בייק אליכם.
          </p>
        </div>
      </section>

      {/* Products */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-5">
          {PRODUCTS.map((p) => (
            <div
              key={p.slug}
              className="rounded-2xl p-5 border flex flex-col text-center"
              style={{ background: C.green, borderColor: C.greenMid }}
            >
              <div
                className="mb-4 mx-auto rounded-xl overflow-hidden flex items-center justify-center"
                style={{ width: "100%", aspectRatio: "1 / 1", background: C.dark }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt={p.name} className="w-full h-full object-contain" />
              </div>
              <p className="text-xs font-bold tracking-widest mb-1" style={{ color: C.brand }}>
                {p.brand}
              </p>
              <h3 className="text-lg font-black mb-1">{p.name}</h3>
              <p className="text-xs mb-4 leading-relaxed flex-1" style={{ color: "#9FB3A8" }}>
                {p.spec}
              </p>
              <div className="mb-4">
                <span className="text-2xl font-black">{p.price} ₪</span>
                <span className="text-xs mr-2 line-through" style={{ color: "#7E948A" }}>
                  {p.marketPrice} ₪
                </span>
              </div>
              <button
                onClick={() => openOrder(p)}
                className="w-full rounded-xl py-3 font-bold transition hover:opacity-90"
                style={{ background: C.brand, color: "#fff" }}
              >
                הזמן
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Order panel */}
      {openProduct && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setOpenSlug(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4 border"
            style={{ background: C.green, borderColor: `${C.brand}55` }}
            onClick={(e) => e.stopPropagation()}
          >
            {status === "done" ? (
              <div className="text-center space-y-4 py-6">
                <div className="text-5xl">✅</div>
                <h2 className="text-2xl font-black">ההזמנה התקבלה!</h2>
                <p style={{ color: "#D8E2DC" }}>
                  {openProduct.name} · {form.variant}
                  <br />
                  ניצור איתך קשר בקרוב לתיאום תשלום ומסירה.
                </p>
                <button
                  onClick={() => setOpenSlug(null)}
                  className="rounded-xl px-6 py-2 font-bold"
                  style={{ background: C.brand, color: "#fff" }}
                >
                  סגור
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black">{openProduct.name}</h2>
                  <button onClick={() => setOpenSlug(null)} className="text-xl opacity-70">✕</button>
                </div>

                <div>
                  <p className="text-sm mb-2" style={{ color: "#9FB3A8" }}>{openProduct.variantLabel}</p>
                  <div className="flex flex-wrap gap-2">
                    {openProduct.variants.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => set("variant", v)}
                        className="rounded-lg px-3 py-2 text-sm border transition"
                        style={
                          form.variant === v
                            ? { background: C.brand, borderColor: C.brand, color: "#fff", fontWeight: 700 }
                            : { background: C.dark, borderColor: C.greenMid, color: "#D8E2DC" }
                        }
                      >
                        {v}
                      </button>
                    ))}
                  </div>
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
                  <input
                    className={input}
                    style={inputStyle}
                    placeholder="כתובת למשלוח *"
                    value={form.delivery_address}
                    onChange={(e) => set("delivery_address", e.target.value)}
                  />
                )}

                <button
                  onClick={submit}
                  disabled={status === "sending"}
                  className="w-full rounded-xl py-3 font-black transition disabled:opacity-50 hover:opacity-90"
                  style={{ background: C.brand, color: "#fff" }}
                >
                  {status === "sending" ? "שולח..." : `אישור הזמנה — ${openProduct.price} ₪`}
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
