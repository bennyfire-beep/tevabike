// app/shop/TshirtSection.tsx — טאב "חולצות" בעמוד /shop: הזמנה מוקדמת של
// חולצות טבע בייק ממותגות. שונה מהאביזרים (PRODUCTS ב-page.tsx): המוצרים
// נשלפים מטבלת tshirt_products ב-Supabase, לא hardcoded — כי המחיר/מצב
// ההזמנה-המוקדמת/קישור התשלום צריכים להיות ניתנים לעריכה מפאנל הניהול בלי
// דיפלוי (בני עוד ישלח קישורי Arbox אמיתיים). וגם — בניגוד לאביזרים, אין כאן
// הגבלה על כמות/שילוב: כל אחד יכול להזמין כמה חולצות שהוא רוצה בכל מידה
// (למשל למשפחה), אז זו עגלה עם כמה שורות במקום בחירה בודדת.
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
  name: string;
  description: string | null;
  image_url: string | null;
  sizes: string[];
  requires_back_name: boolean;
  preorder_price: number;
  regular_price: number;
  preorder_active: boolean;
  preorder_deadline_label: string | null;
};

type CartLine = {
  key: string;
  product_slug: string;
  product_name: string;
  size: string;
  back_name: string | null;
  quantity: number;
  unit_price: number;
};

type PaymentLink = { slug: string; name: string; link: string | null };
type Status = "idle" | "sending" | "done" | "error";

export default function TshirtSection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  // מתג נפרד מ-preorder_active של כל מוצר: זה כיבוי/הדלקה של כל המדור,
  // לשימוש כשהעיצוב הסופי של החולצות עוד לא מוכן — הטאב נשאר גלוי, אבל
  // מוצג הודעת "בקרוב" במקום המוצרים/העגלה. נשלט מפאנל הניהול.
  const [shopActive, setShopActive] = useState(true);
  const [comingSoonMessage, setComingSoonMessage] = useState("");
  const [sizeBySlug, setSizeBySlug] = useState<Record<string, string>>({});
  const [backNameBySlug, setBackNameBySlug] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<CartLine[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", customer_email: "" });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase
        .from("tshirt_products")
        .select(
          "slug, name, description, image_url, sizes, requires_back_name, preorder_price, regular_price, preorder_active, preorder_deadline_label"
        )
        .order("display_order", { ascending: true }),
      supabase.from("tshirt_shop_settings").select("is_active, coming_soon_message").eq("id", true).maybeSingle(),
    ]).then(([productsRes, settingsRes]) => {
      if (cancelled) return;
      setProducts((productsRes.data ?? []) as Product[]);
      setShopActive(settingsRes.data?.is_active ?? true);
      setComingSoonMessage(settingsRes.data?.coming_soon_message ?? "");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function addToCart(p: Product) {
    const size = sizeBySlug[p.slug] || p.sizes[0];
    const backName = p.requires_back_name ? (backNameBySlug[p.slug] || "").trim() : "";
    if (p.requires_back_name && !backName) {
      alert("נא להזין שם באנגלית לגב החולצה");
      return;
    }
    const unit_price = p.preorder_active ? p.preorder_price : p.regular_price;
    const key = `${p.slug}__${size}__${backName}`;
    setCart((c) => {
      const existing = c.find((l) => l.key === key);
      if (existing) {
        return c.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...c,
        {
          key,
          product_slug: p.slug,
          product_name: p.name,
          size,
          back_name: backName || null,
          quantity: 1,
          unit_price,
        },
      ];
    });
    if (p.requires_back_name) setBackNameBySlug((s) => ({ ...s, [p.slug]: "" }));
  }

  function updateQty(key: string, delta: number) {
    setCart((c) =>
      c.map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l)).filter((l) => l.quantity > 0)
    );
  }

  function removeLine(key: string) {
    setCart((c) => c.filter((l) => l.key !== key));
  }

  const total = cart.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (cart.length === 0) return;
    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      alert("נא למלא שם וטלפון");
      return;
    }
    if (!form.customer_email.trim()) {
      alert("נא למלא אימייל לקבלת אישור ההזמנה");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/tshirt-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: cart.map((l) => ({
            product_slug: l.product_slug,
            size: l.size,
            back_name: l.back_name,
            quantity: l.quantity,
          })),
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          customer_email: form.customer_email,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPaymentLinks(data.paymentLinks || []);
        setStatus("done");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  const input = "w-full rounded-lg p-3 outline-none border transition placeholder:opacity-60";
  const inputStyle = { background: C.dark, borderColor: C.greenMid, color: C.offWhite };

  if (loading) {
    return (
      <div className="px-6 py-16 text-center" style={{ color: "#9FB3A8" }}>
        טוען...
      </div>
    );
  }

  if (!shopActive) {
    return (
      <div className="px-6 py-16 text-center max-w-md mx-auto">
        <div className="text-4xl mb-3">👕</div>
        <p className="text-lg font-bold mb-1">בקרוב</p>
        <p style={{ color: "#9FB3A8" }}>{comingSoonMessage || "המדור עוד לא פעיל."}</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="px-6 py-16 text-center" style={{ color: "#9FB3A8" }}>
        מדור החולצות עדיין לא זמין.
      </div>
    );
  }

  return (
    <>
      <section className="px-6 pb-8">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-5">
          {products.map((p) => {
            const activePrice = p.preorder_active ? p.preorder_price : p.regular_price;
            const showStrike = p.preorder_active && p.preorder_price !== p.regular_price;
            const size = sizeBySlug[p.slug] || p.sizes[0];
            return (
              <div
                key={p.slug}
                className="rounded-2xl p-5 border flex flex-col text-center"
                style={{ background: C.green, borderColor: C.greenMid }}
              >
                <div
                  className="mb-4 mx-auto rounded-xl overflow-hidden flex items-center justify-center"
                  style={{ width: "100%", aspectRatio: "1 / 1", background: C.dark }}
                >
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-contain" />
                  ) : (
                    <span style={{ color: "#7E948A", fontSize: 13 }}>תמונה בקרוב</span>
                  )}
                </div>
                <h3 className="text-lg font-black mb-1">{p.name}</h3>
                {p.description && (
                  <p className="text-xs mb-3 leading-relaxed" style={{ color: "#9FB3A8" }}>
                    {p.description}
                  </p>
                )}
                <div className="mb-1">
                  <span className="text-2xl font-black">{activePrice} ₪</span>
                  {showStrike && (
                    <span className="text-xs mr-2 line-through" style={{ color: "#7E948A" }}>
                      {p.regular_price} ₪
                    </span>
                  )}
                </div>
                <div className="mb-3">
                  {p.preorder_active && (
                    <p className="text-xs font-bold" style={{ color: C.brand }}>
                      מחיר הזמנה מוקדמת
                      {p.preorder_deadline_label ? ` — בתוקף עד ${p.preorder_deadline_label}` : ""}
                    </p>
                  )}
                </div>

                <div className="mt-auto space-y-2">
                  <select
                    className="w-full rounded-lg p-2 text-sm border"
                    style={inputStyle}
                    value={size}
                    onChange={(e) => setSizeBySlug((s) => ({ ...s, [p.slug]: e.target.value }))}
                  >
                    {p.sizes.map((sz) => (
                      <option key={sz} value={sz}>
                        {sz}
                      </option>
                    ))}
                  </select>
                  {p.requires_back_name && (
                    <input
                      className="w-full rounded-lg p-2 text-sm border placeholder:opacity-60"
                      style={inputStyle}
                      placeholder="שם באנגלית לגב *"
                      value={backNameBySlug[p.slug] || ""}
                      onChange={(e) => setBackNameBySlug((s) => ({ ...s, [p.slug]: e.target.value }))}
                    />
                  )}
                  <button
                    onClick={() => addToCart(p)}
                    className="w-full rounded-lg py-2 font-bold text-sm transition hover:opacity-90"
                    style={{ background: C.brand, color: "#fff" }}
                  >
                    הוסף לסל
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {cart.length > 0 && (
        <div
          className="sticky bottom-0 z-40 border-t px-6 py-4"
          style={{ background: C.green, borderColor: C.greenMid }}
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <p style={{ color: "#D8E2DC" }}>
              {cart.length} {cart.length === 1 ? "פריט" : "פריטים"} בסל
              <br />
              <span className="text-sm" style={{ color: "#9FB3A8" }}>
                סה״כ: {total} ₪
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

      {panelOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setPanelOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4 border max-h-[90vh] overflow-y-auto"
            style={{ background: C.green, borderColor: `${C.brand}55` }}
            onClick={(e) => e.stopPropagation()}
          >
            {status === "done" ? (
              <div className="text-center space-y-4 py-4">
                <div className="text-5xl">✅</div>
                <h2 className="text-2xl font-black">ההזמנה נשמרה!</h2>
                <p style={{ color: "#D8E2DC" }}>
                  סה״כ לתשלום: <b style={{ color: C.offWhite }}>{total} ₪</b>
                </p>
                <div className="space-y-2">
                  {paymentLinks.map((pl) => (
                    <div key={pl.slug}>
                      {pl.link ? (
                        <a
                          href={pl.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-xl py-3 font-black transition hover:opacity-90"
                          style={{ background: C.brand, color: "#fff" }}
                        >
                          לתשלום עבור {pl.name}
                        </a>
                      ) : (
                        <p className="text-sm" style={{ color: "#9FB3A8" }}>
                          {pl.name}: קישור התשלום עדיין לא זמין — ניצור איתך קשר לתיאום התשלום.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs" style={{ color: "#7E948A" }}>
                  איסוף עצמי מהמועדון — נעדכן אותך כשהחולצות יגיעו.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black">פרטי הזמנה</h2>
                  <button onClick={() => setPanelOpen(false)} className="text-xl opacity-70">
                    ✕
                  </button>
                </div>

                <div
                  className="rounded-lg p-3 text-sm space-y-2"
                  style={{ background: C.dark, border: `1px solid ${C.greenMid}` }}
                >
                  {cart.map((l) => (
                    <div key={l.key} className="flex items-center justify-between gap-2" style={{ color: "#D8E2DC" }}>
                      <div>
                        <div>
                          {l.product_name} ({l.size}){l.back_name ? ` — "${l.back_name}"` : ""}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => updateQty(l.key, -1)}
                            className="w-6 h-6 rounded"
                            style={{ background: C.greenMid }}
                          >
                            -
                          </button>
                          <span>{l.quantity}</span>
                          <button
                            onClick={() => updateQty(l.key, 1)}
                            className="w-6 h-6 rounded"
                            style={{ background: C.greenMid }}
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeLine(l.key)}
                            className="text-xs underline mr-2"
                            style={{ color: "#FF8FA3" }}
                          >
                            הסר
                          </button>
                        </div>
                      </div>
                      <span>{l.unit_price * l.quantity} ₪</span>
                    </div>
                  ))}
                  <div
                    className="flex justify-between font-bold pt-2 mt-1"
                    style={{ borderTop: `1px solid ${C.greenMid}`, color: C.offWhite }}
                  >
                    <span>סה״כ</span>
                    <span>{total} ₪</span>
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
                <input
                  className={input}
                  style={inputStyle}
                  placeholder="אימייל * — לקבלת אישור הזמנה"
                  type="email"
                  required
                  value={form.customer_email}
                  onChange={(e) => set("customer_email", e.target.value)}
                />

                <p className="text-xs leading-relaxed" style={{ color: "#7E948A" }}>
                  איסוף עצמי בלבד ממועדון טבע בייק — ניצור איתך קשר לתיאום כשהחולצות יגיעו. לאחר השליחה תופנה
                  לתשלום.
                </p>

                <button
                  onClick={submit}
                  disabled={status === "sending"}
                  className="w-full rounded-xl py-3 font-black transition disabled:opacity-50 hover:opacity-90"
                  style={{ background: C.brand, color: "#fff" }}
                >
                  {status === "sending" ? "שולח..." : `שליחת הזמנה — ${total} ₪`}
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
    </>
  );
}
