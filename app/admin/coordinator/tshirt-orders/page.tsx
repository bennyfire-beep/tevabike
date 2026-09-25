'use client'
// tshirt-orders/page.tsx — ניהול מדור החולצות: הגדרות מוצר (מתג הזמנה
// מוקדמת/מחירים/קישורי Arbox — נערכים כאן כדי שבני יוכל להדביק קישורים
// אמיתיים בלי דיפלוי) + רשימת הזמנות (accordion, כמו shop-orders/page.tsx).
// אין כאן "שלח לספק" כמו בהזמנות חנות — החולצות מודפסות במרוכז ומחולקות
// באיסוף עצמי, אז הפעולה היחידה על הזמנה היא לסמן תשלום ולמחוק.
import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'
import { hatWinners } from '@/lib/tshirt-hat-promo'

type ShopSettings = {
  is_active: boolean
  coming_soon_message: string
  shipping_price: number
  shipping_arbox_link: string | null
  hat_promo_active: boolean
  hat_promo_min_total: number
  hat_promo_limit: number
}

type ProductRow = {
  slug: string
  name: string
  preorder_price: number
  regular_price: number
  preorder_active: boolean
  preorder_arbox_link: string | null
  regular_arbox_link: string | null
  preorder_deadline_label: string | null
  image_urls: string[]
}

type OrderRow = {
  id: string
  created_at: string
  order_group: string
  product_name: string
  size: string
  back_name: string | null
  quantity: number
  unit_price: number
  is_preorder: boolean
  line_total: number
  customer_name: string
  customer_phone: string
  customer_email: string | null
  payment_status: string
  arrival_notified_at: string | null
  fulfillment: string
  delivery_address: string | null
  shipping_fee: number
  cancelled_at: string | null
  referral_code: string | null
  paid_at: string | null
}

type Group = {
  key: string
  order_group: string
  created_at: string
  customer_name: string
  customer_phone: string
  customer_email: string | null
  payment_status: string
  fulfillment: string
  delivery_address: string | null
  shipping_fee: number
  cancelled: boolean
  total: number
  rows: OrderRow[]
}

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' })

function groupOrders(rows: OrderRow[]): Group[] {
  const map = new Map<string, Group>()
  for (const r of rows) {
    const key = r.order_group
    const existing = map.get(key)
    if (existing) {
      existing.rows.push(r)
      existing.total += r.line_total
    } else {
      map.set(key, {
        key,
        order_group: r.order_group,
        created_at: r.created_at,
        customer_name: r.customer_name,
        customer_phone: r.customer_phone,
        customer_email: r.customer_email,
        payment_status: r.payment_status,
        fulfillment: r.fulfillment,
        delivery_address: r.delivery_address,
        shipping_fee: Number(r.shipping_fee) || 0,
        cancelled: !!r.cancelled_at,
        total: r.line_total,
        rows: [r],
      })
    }
  }
  // אם יש שורה אחת שלא אושרה בתוך הקבוצה, הקבוצה כולה מוצגת כ"ממתינה"
  for (const g of map.values()) {
    // דמי משלוח נשמרים על כל שורה בהזמנה אבל נגבים פעם אחת
    g.total += g.shipping_fee
    g.payment_status = g.rows.every((r) => r.payment_status === 'confirmed') ? 'confirmed' : 'pending'
  }
  return Array.from(map.values())
}

const inputStyle: CSSProperties = {
  background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 8, color: '#e8efe9',
  padding: '8px 10px', fontSize: 13, fontFamily: 'Heebo, Arial, sans-serif', width: '100%',
}

function ShopActiveBanner({ settings, onSaved }: { settings: ShopSettings; onSaved: (s: ShopSettings) => void }) {
  const [draft, setDraft] = useState(settings)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('tshirt_shop_settings')
      .update({
        is_active: draft.is_active,
        coming_soon_message: draft.coming_soon_message,
        shipping_price: draft.shipping_price,
        shipping_arbox_link: draft.shipping_arbox_link || null,
        hat_promo_active: draft.hat_promo_active,
        hat_promo_min_total: draft.hat_promo_min_total,
        hat_promo_limit: draft.hat_promo_limit,
      })
      .eq('id', true)
    setSaving(false)
    if (error) { alert(error.message); return }
    onSaved(draft)
  }

  return (
    <div
      style={{
        background: draft.is_active ? '#12331f' : '#2a2410', border: `1px solid ${draft.is_active ? '#1f5233' : '#4a3f10'}`,
        borderRadius: 12, padding: 14, marginBottom: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: draft.is_active ? '#7ee787' : '#e8c547' }}>
          {draft.is_active ? '🟢 מדור הביגוד פעיל באתר' : '🟡 מדור הביגוד במצב "בקרוב"'}
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#e8efe9', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={draft.is_active}
            onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
          />
          החנות פעילה (לקוחות יכולים להזמין)
        </label>
      </div>
      {!draft.is_active && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: '#7a8f7d' }}>הודעת &quot;בקרוב&quot; שתוצג במקום המוצרים</label>
          <input
            style={inputStyle}
            value={draft.coming_soon_message}
            onChange={(e) => setDraft((d) => ({ ...d, coming_soon_message: e.target.value }))}
          />
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: '#7a8f7d' }}>משלוח (₪)</label>
          <input
            type="number"
            style={inputStyle}
            value={draft.shipping_price}
            onChange={(e) => setDraft((d) => ({ ...d, shipping_price: Number(e.target.value) }))}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#7a8f7d' }}>קישור Arbox לתשלום המשלוח (פעם אחת להזמנה)</label>
          <input
            style={inputStyle}
            placeholder="https://arbox.link/..."
            value={draft.shipping_arbox_link ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, shipping_arbox_link: e.target.value }))}
          />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: 8, marginBottom: 10, alignItems: 'end' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#e8efe9', cursor: 'pointer', paddingBottom: 8 }}>
          <input
            type="checkbox"
            checked={draft.hat_promo_active}
            onChange={(e) => setDraft((d) => ({ ...d, hat_promo_active: e.target.checked }))}
          />
          🧢 מבצע כובע
        </label>
        <div>
          <label style={{ fontSize: 11, color: '#7a8f7d' }}>מסכום (₪, בלי משלוח)</label>
          <input
            type="number"
            style={inputStyle}
            value={draft.hat_promo_min_total}
            onChange={(e) => setDraft((d) => ({ ...d, hat_promo_min_total: Number(e.target.value) }))}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#7a8f7d' }}>כמות כובעים</label>
          <input
            type="number"
            style={inputStyle}
            value={draft.hat_promo_limit}
            onChange={(e) => setDraft((d) => ({ ...d, hat_promo_limit: Number(e.target.value) }))}
          />
        </div>
      </div>
      <button
        onClick={save}
        disabled={!dirty || saving}
        style={{
          width: '100%', background: dirty ? '#b5e853' : 'transparent', color: dirty ? '#0d0f0e' : '#7a8f7d',
          border: `1px solid ${dirty ? '#b5e853' : '#252b27'}`, borderRadius: 8, padding: '8px 12px',
          fontSize: 13, fontWeight: 700, fontFamily: 'Heebo, Arial, sans-serif', cursor: dirty ? 'pointer' : 'default',
          opacity: saving ? 0.5 : 1,
        }}
      >
        {saving ? 'שומר...' : dirty ? 'שמירת שינויים' : 'נשמר'}
      </button>
    </div>
  )
}

function ProductImages({ product, onSaved }: { product: ProductRow; onSaved: (p: ProductRow) => void }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const images = product.image_urls ?? []

  async function saveUrls(urls: string[]) {
    const { error } = await supabase.from('tshirt_products').update({ image_urls: urls }).eq('slug', product.slug)
    if (error) { setError(error.message); return }
    onSaved({ ...product, image_urls: urls })
  }

  async function addImage(file: File) {
    setError(null)
    setUploading(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${product.slug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error: upErr } = await supabase.storage.from('product-images').upload(path, file)
    if (upErr) { setError(upErr.message); setUploading(false); return }
    const publicUrl = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
    await saveUrls([...images, publicUrl])
    setUploading(false)
  }

  async function removeImage(url: string) {
    if (!confirm('להסיר את התמונה?')) return
    await saveUrls(images.filter((u) => u !== url))
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, color: '#7a8f7d' }}>תמונות המוצר</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6, marginBottom: 8 }}>
        {images.map((url) => (
          <div key={url} style={{ position: 'relative', width: 64, height: 64 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid #252b27' }}
            />
            <button
              onClick={() => removeImage(url)}
              aria-label="הסר תמונה"
              style={{
                position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                background: '#e85353', color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer', lineHeight: '20px',
              }}
            >
              ✕
            </button>
          </div>
        ))}
        {images.length === 0 && (
          <span style={{ fontSize: 12, color: '#7a8f7d' }}>אין עדיין תמונות — מוצג &quot;תמונה בקרוב&quot; באתר</span>
        )}
      </div>
      <label
        style={{
          display: 'inline-block', fontSize: 12, fontWeight: 700, cursor: uploading ? 'default' : 'pointer',
          background: 'transparent', color: '#b5e853', border: '1px solid #b5e853', borderRadius: 8,
          padding: '6px 10px', opacity: uploading ? 0.5 : 1,
        }}
      >
        {uploading ? 'מעלה...' : '+ הוספת תמונה'}
        <input
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) addImage(file)
          }}
          style={{ display: 'none' }}
        />
      </label>
      {error && <p style={{ color: '#ff8fa3', fontSize: 12, marginTop: 6 }}>{error}</p>}
    </div>
  )
}

function ProductSettingsCard({ product, onSaved }: { product: ProductRow; onSaved: (p: ProductRow) => void }) {
  const [draft, setDraft] = useState(product)
  const [saving, setSaving] = useState(false)
  // תמונות נשמרות ישירות מ-ProductImages (לא דרך draft/save, נכנס לתוקף
  // מיד) — image_urls מוצא מהשוואת ה-dirty כדי שהעלאה/הסרה לא תדליק פה
  // "יש שינויים לא שמורים" על שדות המחיר/קישורים.
  const dirty =
    JSON.stringify({ ...draft, image_urls: undefined }) !== JSON.stringify({ ...product, image_urls: undefined })

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('tshirt_products')
      .update({
        preorder_active: draft.preorder_active,
        preorder_price: draft.preorder_price,
        regular_price: draft.regular_price,
        preorder_arbox_link: draft.preorder_arbox_link || null,
        regular_arbox_link: draft.regular_arbox_link || null,
        preorder_deadline_label: draft.preorder_deadline_label || null,
      })
      .eq('slug', draft.slug)
    setSaving(false)
    if (error) { alert(error.message); return }
    onSaved(draft)
  }

  return (
    <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 14 }}>{draft.name}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#7a8f7d', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={draft.preorder_active}
            onChange={(e) => setDraft((d) => ({ ...d, preorder_active: e.target.checked }))}
          />
          הזמנה מוקדמת פעילה
        </label>
      </div>
      <ProductImages product={product} onSaved={onSaved} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <label style={{ fontSize: 11, color: '#7a8f7d' }}>מחיר הזמנה מוקדמת (₪)</label>
          <input
            type="number"
            style={inputStyle}
            value={draft.preorder_price}
            onChange={(e) => setDraft((d) => ({ ...d, preorder_price: Number(e.target.value) }))}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#7a8f7d' }}>מחיר רגיל (₪)</label>
          <input
            type="number"
            style={inputStyle}
            value={draft.regular_price}
            onChange={(e) => setDraft((d) => ({ ...d, regular_price: Number(e.target.value) }))}
          />
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 11, color: '#7a8f7d' }}>תוקף הזמנה מוקדמת (טקסט חופשי, למשל 1.11.2026)</label>
        <input
          style={inputStyle}
          value={draft.preorder_deadline_label ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, preorder_deadline_label: e.target.value }))}
        />
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 11, color: '#7a8f7d' }}>קישור Arbox — מחיר הזמנה מוקדמת</label>
        <input
          style={inputStyle}
          placeholder="https://arbox.link/..."
          value={draft.preorder_arbox_link ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, preorder_arbox_link: e.target.value }))}
        />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: '#7a8f7d' }}>קישור Arbox — מחיר רגיל</label>
        <input
          style={inputStyle}
          placeholder="https://arbox.link/..."
          value={draft.regular_arbox_link ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, regular_arbox_link: e.target.value }))}
        />
      </div>
      <button
        onClick={save}
        disabled={!dirty || saving}
        style={{
          width: '100%', background: dirty ? '#b5e853' : 'transparent', color: dirty ? '#0d0f0e' : '#7a8f7d',
          border: `1px solid ${dirty ? '#b5e853' : '#252b27'}`, borderRadius: 8, padding: '8px 12px',
          fontSize: 13, fontWeight: 700, fontFamily: 'Heebo, Arial, sans-serif', cursor: dirty ? 'pointer' : 'default',
          opacity: saving ? 0.5 : 1,
        }}
      >
        {saving ? 'שומר...' : dirty ? 'שמירת שינויים' : 'נשמר'}
      </button>
    </div>
  )
}

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
const sizeRank = (s: string) => {
  const i = SIZE_ORDER.indexOf(s)
  return i === -1 ? SIZE_ORDER.length : i
}

// סיכום מידות לספק + טבלה שטוחה "מי הזמין מה" — ההזמנות עצמן מקובצות
// למטה לפי לקוח, אבל להזמנה מהספק צריך לראות כמות לכל מוצר×מידה.
// הזמנה נחשבת רק לאחר תשלום מלא — לספק מזמינים לפי "רק ששולמו".
function SizeSummary({ orders }: { orders: OrderRow[] }) {
  const [paidOnly, setPaidOnly] = useState(false)
  const [open, setOpen] = useState(true)
  const rows = orders.filter((r) => !paidOnly || r.payment_status === 'confirmed')

  const byProduct = new Map<string, Map<string, number>>()
  for (const r of rows) {
    const sizes = byProduct.get(r.product_name) ?? new Map<string, number>()
    sizes.set(r.size, (sizes.get(r.size) ?? 0) + r.quantity)
    byProduct.set(r.product_name, sizes)
  }
  const totalQty = rows.reduce((sum, r) => sum + r.quantity, 0)
  const sorted = [...rows].sort(
    (a, b) =>
      a.product_name.localeCompare(b.product_name, 'he') ||
      sizeRank(a.size) - sizeRank(b.size) ||
      a.customer_name.localeCompare(b.customer_name, 'he')
  )

  function downloadCsv() {
    const header = ['מוצר', 'מידה', 'כמות', 'שם', 'טלפון', 'אימייל', 'סטטוס תשלום', 'משלוח/איסוף', 'כתובת', 'קוד הפניה', 'תאריך']
    const lines = sorted.map((r) => [
      r.product_name, r.size, String(r.quantity), r.customer_name, r.customer_phone, r.customer_email ?? '',
      r.payment_status === 'confirmed' ? 'שולם' : 'ממתין לתשלום',
      r.fulfillment === 'delivery' ? 'משלוח' : 'איסוף עצמי', r.delivery_address ?? '', r.referral_code ?? '', fmtDateTime(r.created_at),
    ])
    const csv = [header, ...lines]
      .map((l) => l.map((v) => `"${v.replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tshirt-orders${paidOnly ? '-paid' : ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const th: CSSProperties = { textAlign: 'right', padding: '6px 8px', color: '#7a8f7d', fontWeight: 700, borderBottom: '1px solid #252b27', whiteSpace: 'nowrap' }
  const td: CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #1c211e', whiteSpace: 'nowrap' }

  return (
    <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{ background: 'transparent', border: 'none', color: '#e8efe9', fontSize: 16, fontWeight: 800, fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer', padding: 0 }}
        >
          📏 סיכום מידות · {totalQty} פריטים {open ? '▲' : '▼'}
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          {([[false, 'כל ההזמנות'], [true, 'רק ששולמו']] as [boolean, string][]).map(([value, label]) => (
            <button
              key={label}
              onClick={() => setPaidOnly(value)}
              style={{
                background: paidOnly === value ? '#b5e853' : 'transparent', color: paidOnly === value ? '#0d0f0e' : '#7a8f7d',
                border: '1px solid #252b27', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700,
                fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {open && (
        rows.length === 0 ? (
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: '12px 0 0' }}>
            {paidOnly ? 'אין עדיין הזמנות ששולמו.' : 'אין עדיין הזמנות.'}
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {[...byProduct.entries()].map(([product, sizes]) => {
                const productTotal = [...sizes.values()].reduce((a, b) => a + b, 0)
                return (
                  <div key={product}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#b5e853', marginBottom: 6 }}>
                      {product} — {productTotal} יח׳
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {[...sizes.entries()]
                        .sort((a, b) => sizeRank(a[0]) - sizeRank(b[0]))
                        .map(([size, qty]) => (
                          <div
                            key={size}
                            style={{ background: '#0d0f0e', border: '1px solid #252b27', borderRadius: 8, padding: '6px 10px', textAlign: 'center', minWidth: 52 }}
                          >
                            <div style={{ fontSize: 12, color: '#7a8f7d', fontWeight: 700 }}>{size}</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: '#e8efe9' }}>{qty}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 6px' }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>מי הזמין מה</span>
              <button
                onClick={downloadCsv}
                style={{
                  background: 'transparent', color: '#b5e853', border: '1px solid #b5e853', borderRadius: 8,
                  padding: '6px 10px', fontSize: 12, fontWeight: 700, fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer',
                }}
              >
                ⬇ הורדה לאקסל (CSV)
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={th}>מוצר</th>
                    <th style={th}>מידה</th>
                    <th style={th}>כמות</th>
                    <th style={th}>שם</th>
                    <th style={th}>טלפון</th>
                    <th style={th}>תשלום</th>
                    <th style={th}>קבלה</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.id}>
                      <td style={td}>{r.product_name}</td>
                      <td style={{ ...td, fontWeight: 800, color: '#b5e853' }}>{r.size}</td>
                      <td style={td}>{r.quantity}</td>
                      <td style={td}>{r.customer_name}</td>
                      <td style={td}>{r.customer_phone}</td>
                      <td style={{ ...td, color: r.payment_status === 'confirmed' ? '#7ee787' : '#e8c547' }}>
                        {r.payment_status === 'confirmed' ? 'שולם' : 'ממתין'}
                      </td>
                      <td style={td}>{r.fulfillment === 'delivery' ? `🚚 ${r.delivery_address ?? ''}` : 'איסוף'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}
    </div>
  )
}

// כפתור "החולצות הגיעו" — שולח מייל לכל מי ששילם ועוד לא קיבל הודעה
// (השרת מסמן arrival_notified_at, אז לחיצה חוזרת שולחת רק לחדשים).
function ArrivalNotice({ orders, onSent }: { orders: OrderRow[]; onSent: () => void }) {
  const user = useCoordinator()
  const [note, setNote] = useState('')
  const [state, setState] = useState<'' | 'testing' | 'sending'>('')
  const [result, setResult] = useState('')

  const paidGroups = groupOrders(orders).filter((g) => g.payment_status === 'confirmed')
  const toNotify = paidGroups.filter((g) => g.customer_email && g.rows.some((r) => !r.arrival_notified_at))
  const alreadyNotified = paidGroups.filter((g) => g.rows.every((r) => r.arrival_notified_at))
  const noEmail = paidGroups.filter((g) => !g.customer_email)

  async function send(test: boolean) {
    setResult('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setResult('פג תוקף ההתחברות, התחבר מחדש'); return }
    if (!test && !confirm(`לשלוח מייל "החולצות הגיעו" ל-${toNotify.length} לקוחות ששילמו? אי אפשר לבטל אחרי השליחה.`)) return
    setState(test ? 'testing' : 'sending')
    try {
      const res = await fetch('/api/admin/tshirt-arrival', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ note, testTo: test ? (user?.email ?? '') : undefined }),
      })
      const d = await res.json()
      if (!d.ok) setResult(d.error || 'השליחה נכשלה')
      else if (test) setResult(`נשלח מייל בדיקה אליך (${user?.email ?? ''}). בדוק אותו לפני שליחה לכולם.`)
      else {
        setResult(`נשלח ל-${d.sent} מתוך ${d.total} לקוחות.` + (d.failed?.length ? ` נכשלו: ${d.failed.join(', ')}` : ''))
        onSent()
      }
    } catch {
      setResult('אין חיבור לשרת')
    }
    setState('')
  }

  const btn = (primary: boolean, disabled: boolean): CSSProperties => ({
    flex: '1 1 auto', background: primary && !disabled ? '#b5e853' : 'transparent',
    color: primary && !disabled ? '#0d0f0e' : '#b5e853', border: `1px solid ${disabled ? '#252b27' : '#b5e853'}`,
    borderRadius: 8, padding: '10px 12px', fontSize: 13, fontWeight: 700, fontFamily: 'Heebo, Arial, sans-serif',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
  })

  return (
    <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>📬 הודעה ללקוחות: החולצות הגיעו</div>
      <p style={{ color: '#7a8f7d', fontSize: 12, margin: '0 0 10px', lineHeight: 1.6 }}>
        נשלח רק למי שסומן &quot;שולם&quot;. כל לקוח מקבל את רשימת הפריטים והמידות שלו.
        <br />
        ממתינים להודעה: <b style={{ color: '#e8efe9' }}>{toNotify.length}</b> · כבר קיבלו: {alreadyNotified.length}
        {noEmail.length > 0 && ` · שילמו בלי אימייל (צריך להודיע בטלפון): ${noEmail.map((g) => g.customer_name).join(', ')}`}
      </p>
      <label style={{ fontSize: 11, color: '#7a8f7d' }}>פרטי איסוף (יופיע במייל) — למשל ימים ושעות במועדון</label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="אפשר לאסוף במועדון בימים א׳–ה׳ בין 17:00 ל-20:00."
        style={{ ...inputStyle, resize: 'vertical', marginBottom: 10 }}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => send(true)} disabled={state !== ''} style={btn(false, state !== '')}>
          {state === 'testing' ? 'שולח...' : 'שלח לי מייל בדיקה'}
        </button>
        <button
          onClick={() => send(false)}
          disabled={state !== '' || toNotify.length === 0}
          style={btn(true, state !== '' || toNotify.length === 0)}
        >
          {state === 'sending' ? 'שולח...' : `שלח "החולצות הגיעו" ל-${toNotify.length} לקוחות`}
        </button>
      </div>
      {result && <p style={{ fontSize: 13, margin: '10px 0 0', color: '#e8efe9' }}>{result}</p>}
    </div>
  )
}

// מבצע כובע: מי זכה (לפי סדר התשלום) וכמה נשארו
function HatPromoPanel({ orders, settings, winners }: { orders: OrderRow[]; settings: ShopSettings; winners: string[] }) {
  const [open, setOpen] = useState(false)
  if (!settings.hat_promo_active) return null
  const groups = groupOrders(orders)
  const byKey = new Map(groups.map((g) => [g.order_group, g]))
  const winnerGroups = winners.map((k) => byKey.get(k)).filter((g): g is Group => !!g)
  const eligibleUnpaid = groups.filter(
    (g) => g.payment_status !== 'confirmed' && g.total - g.shipping_fee >= settings.hat_promo_min_total
  )
  return (
    <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ background: 'transparent', border: 'none', color: '#e8efe9', fontSize: 16, fontWeight: 800, fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer', padding: 0, textAlign: 'right', width: '100%' }}
      >
        🧢 מבצע כובע · {winnerGroups.length}/{settings.hat_promo_limit} כובעים {open ? '▲' : '▼'}
      </button>
      <p style={{ color: '#7a8f7d', fontSize: 12, margin: '4px 0 0' }}>
        הזמנות ששולמו מעל {settings.hat_promo_min_total} ₪ (בלי משלוח), לפי סדר התשלום
        {eligibleUnpaid.length > 0 && ` · עוד ${eligibleUnpaid.length} הזמנות מעל הסף ממתינות לתשלום`}
      </p>
      {open && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {winnerGroups.length === 0 ? (
            <span style={{ color: '#7a8f7d', fontSize: 13 }}>עדיין אין זוכים — הזמנה נכנסת כשהיא מסומנת &quot;שולם&quot;.</span>
          ) : (
            winnerGroups.map((g, i) => (
              <div key={g.key} style={{ fontSize: 13 }}>
                <b style={{ color: '#b5e853' }}>#{i + 1}</b> {g.customer_name} · {g.customer_phone} · {g.total - g.shipping_fee} ₪
                {g.fulfillment === 'delivery' ? ' · 🚚 משלוח' : ' · איסוף'}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

type ReferralCode = { code: string; owner_name: string | null; commission_per_order: number; is_active: boolean }

// קודי הפניה (שגרירים): ניהול קודים + מכירות לכל קוד. עמלה רק על הזמנות ששולמו.
function ReferralPanel({ orders }: { orders: OrderRow[] }) {
  const [codes, setCodes] = useState<ReferralCode[]>([])
  const [open, setOpen] = useState(false)
  const [openCode, setOpenCode] = useState<string | null>(null)
  const [newCode, setNewCode] = useState('')
  const [newOwner, setNewOwner] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase
      .from('tshirt_referral_codes')
      .select('code, owner_name, commission_per_order, is_active')
      .order('created_at', { ascending: true })
      .then(({ data }) => setCodes((data ?? []) as ReferralCode[]))
  }, [])

  async function addCode() {
    const code = newCode.trim().toUpperCase().replace(/\s+/g, '')
    if (!/^[A-Z0-9_-]{2,30}$/.test(code)) { alert('קוד באנגלית/ספרות בלבד, 2–30 תווים'); return }
    setBusy(true)
    const { error } = await supabase.from('tshirt_referral_codes').insert({ code, owner_name: newOwner.trim() || null })
    setBusy(false)
    if (error) { alert(error.message); return }
    setCodes((c) => [...c, { code, owner_name: newOwner.trim() || null, commission_per_order: 10, is_active: true }])
    setNewCode('')
    setNewOwner('')
  }

  async function toggle(c: ReferralCode) {
    const { error } = await supabase.from('tshirt_referral_codes').update({ is_active: !c.is_active }).eq('code', c.code)
    if (error) { alert(error.message); return }
    setCodes((cs) => cs.map((x) => (x.code === c.code ? { ...x, is_active: !x.is_active } : x)))
  }

  const groups = groupOrders(orders)
  const stats = codes.map((c) => {
    const gs = groups.filter((g) => g.rows[0].referral_code === c.code)
    const paid = gs.filter((g) => g.payment_status === 'confirmed')
    return {
      ...c,
      groups: gs,
      paidCount: paid.length,
      paidTotal: paid.reduce((sum, g) => sum + g.total - g.shipping_fee, 0),
      commission: paid.length * Number(c.commission_per_order),
    }
  })

  return (
    <div style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ background: 'transparent', border: 'none', color: '#e8efe9', fontSize: 16, fontWeight: 800, fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer', padding: 0, textAlign: 'right', width: '100%' }}
      >
        🤝 קודי הפניה · {codes.filter((c) => c.is_active).length} פעילים {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          {stats.map((c) => (
            <div key={c.code} style={{ borderTop: '1px solid #252b27', padding: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setOpenCode(openCode === c.code ? null : c.code)}
                  style={{ background: 'transparent', border: 'none', color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer', padding: 0, textAlign: 'right' }}
                >
                  <b style={{ color: c.is_active ? '#b5e853' : '#7a8f7d', fontSize: 14 }}>{c.code}</b>
                  {c.owner_name ? ` · ${c.owner_name}` : ''}
                  <span style={{ color: '#7a8f7d', fontSize: 12 }}>
                    {' '}· {c.groups.length} הזמנות · {c.paidCount} שולמו · {c.paidTotal} ₪ · עמלה {c.commission} ₪
                  </span>
                </button>
                <button
                  onClick={() => toggle(c)}
                  style={{ background: 'transparent', border: '1px solid #252b27', borderRadius: 8, color: c.is_active ? '#ff8f6b' : '#b5e853', padding: '4px 8px', fontSize: 11, fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer' }}
                >
                  {c.is_active ? 'השבתה' : 'הפעלה'}
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#7a8f7d', marginTop: 2, direction: 'ltr', textAlign: 'right' }}>
                tevabike.com/shop?ref={c.code}
              </div>
              {openCode === c.code && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {c.groups.length === 0 ? (
                    <span style={{ fontSize: 12, color: '#7a8f7d' }}>עדיין אין הזמנות עם הקוד הזה.</span>
                  ) : (
                    c.groups.map((g) => (
                      <div key={g.key} style={{ fontSize: 12 }}>
                        {g.customer_name} · {g.total - g.shipping_fee} ₪ ·{' '}
                        <span style={{ color: g.payment_status === 'confirmed' ? '#7ee787' : '#e8c547' }}>
                          {g.payment_status === 'confirmed' ? 'שולם' : 'ממתין'}
                        </span>{' '}
                        · {fmtDateTime(g.created_at)}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <input style={{ ...inputStyle, flex: '1 1 100px', direction: 'ltr' }} placeholder="קוד חדש (YINON)" value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} />
            <input style={{ ...inputStyle, flex: '1 1 100px' }} placeholder="שם השגריר" value={newOwner} onChange={(e) => setNewOwner(e.target.value)} />
            <button
              onClick={addCode}
              disabled={busy || !newCode.trim()}
              style={{ background: '#b5e853', color: '#0d0f0e', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 700, fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer', opacity: busy || !newCode.trim() ? 0.5 : 1 }}
            >
              הוספה
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TshirtOrdersPage() {
  const user = useCoordinator()
  const [products, setProducts] = useState<ProductRow[]>([])
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: p }, { data: o }, { data: s }] = await Promise.all([
      supabase
        .from('tshirt_products')
        .select('slug, name, preorder_price, regular_price, preorder_active, preorder_arbox_link, regular_arbox_link, preorder_deadline_label, image_urls')
        .order('display_order', { ascending: true }),
      supabase
        .from('tshirt_orders')
        .select('id, created_at, order_group, product_name, size, back_name, quantity, unit_price, is_preorder, line_total, customer_name, customer_phone, customer_email, payment_status, arrival_notified_at, fulfillment, delivery_address, shipping_fee, cancelled_at, referral_code, paid_at')
        .order('created_at', { ascending: false }),
      supabase.from('tshirt_shop_settings').select('is_active, coming_soon_message, shipping_price, shipping_arbox_link, hat_promo_active, hat_promo_min_total, hat_promo_limit').eq('id', true).maybeSingle(),
    ])
    setProducts((p ?? []) as ProductRow[])
    setOrders((o ?? []) as OrderRow[])
    setShopSettings((s as ShopSettings | null) ?? { is_active: false, coming_soon_message: '', shipping_price: 25, shipping_arbox_link: null, hat_promo_active: false, hat_promo_min_total: 400, hat_promo_limit: 30 })
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) return
    load()
  }, [user, load])

  async function setConfirmed(group: Group, confirmed: boolean) {
    setBusyKey(group.key)
    const payment_status = confirmed ? 'confirmed' : 'pending'
    // paid_at קובע את הסדר ב"30 הראשונים ששילמו" של מבצע הכובע
    const paid_at = confirmed ? new Date().toISOString() : null
    const ids = group.rows.map((r) => r.id)
    const { error } = await supabase.from('tshirt_orders').update({ payment_status, paid_at }).in('id', ids)
    if (error) { alert(error.message); setBusyKey(null); return }
    setOrders((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, payment_status, paid_at } : r)))
    setBusyKey(null)
  }

  async function deleteGroup(group: Group) {
    if (!confirm(`למחוק לצמיתות את ההזמנה של ${group.customer_name}? אי אפשר לשחזר.`)) return
    setBusyKey(group.key)
    const ids = group.rows.map((r) => r.id)
    const { error } = await supabase.from('tshirt_orders').delete().in('id', ids)
    if (error) { alert(error.message); setBusyKey(null); return }
    setOrders((prev) => prev.filter((r) => !ids.includes(r.id)))
    setBusyKey(null)
    setOpenKey(null)
  }

  // ביטול (במקום מחיקה): ההזמנה נשארת ברשימה, יוצאת מסיכום המידות
  // ומהודעת ההגעה, והלקוח מקבל מייל. "שחזור" מחזיר אותה לפעילה בלי מייל.
  async function setCancelled(group: Group, cancel: boolean) {
    if (cancel) {
      const paid = group.payment_status === 'confirmed'
      const msg =
        `לבטל את ההזמנה של ${group.customer_name}?` +
        (group.customer_email ? '\nהלקוח יקבל מייל שההזמנה בוטלה.' : '\nללקוח אין אימייל — צריך להודיע לו בטלפון.') +
        (paid ? '\nההזמנה סומנה כשולמה — את ההחזר צריך לבצע ידנית ב-Arbox.' : '')
      if (!confirm(msg)) return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { alert('פג תוקף ההתחברות, התחבר מחדש'); return }
    setBusyKey(group.key)
    try {
      const res = await fetch('/api/admin/tshirt-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ order_group: group.order_group, undo: !cancel }),
      })
      const d = await res.json()
      if (!d.ok) { alert(d.error || 'הפעולה נכשלה'); setBusyKey(null); return }
      const ids = group.rows.map((r) => r.id)
      setOrders((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, cancelled_at: d.cancelled_at } : r)))
      if (cancel && group.customer_email && !d.emailed) alert('ההזמנה בוטלה, אבל שליחת המייל ללקוח נכשלה.')
    } catch {
      alert('אין חיבור לשרת')
    }
    setBusyKey(null)
  }

  if (!user) return null

  const activeOrders = orders.filter((r) => !r.cancelled_at)
  const winners = shopSettings
    ? hatWinners(orders, {
        active: shopSettings.hat_promo_active,
        minTotal: Number(shopSettings.hat_promo_min_total),
        limit: Number(shopSettings.hat_promo_limit),
      })
    : []
  const allGroups = groupOrders(orders)
  const groups = allGroups.filter((g) => {
    if (filter === 'all') return true
    if (filter === 'cancelled') return g.cancelled
    if (g.cancelled) return false
    if (filter === 'confirmed') return g.payment_status === 'confirmed'
    return g.payment_status !== 'confirmed'
  })
  const pendingCount = allGroups.filter((g) => !g.cancelled && g.payment_status !== 'confirmed').length

  return (
    <div style={{ padding: '16px 12px', maxWidth: 700, margin: '0 auto' }}>
      {shopSettings && (
        <ShopActiveBanner settings={shopSettings} onSaved={setShopSettings} />
      )}

      <div style={{ marginBottom: 14 }}>
        <button
          onClick={() => setSettingsOpen((s) => !s)}
          style={{
            width: '100%', textAlign: 'right', background: '#141716', border: '1px solid #252b27', borderRadius: 12,
            padding: '12px 14px', color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 14, fontWeight: 800,
            cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>⚙️ הגדרות מוצרים ומחירים</span>
          <span>{settingsOpen ? '▲' : '▼'}</span>
        </button>
        {settingsOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {products.map((p) => (
              <ProductSettingsCard
                key={p.slug}
                product={p}
                onSaved={(updated) => setProducts((prev) => prev.map((pp) => (pp.slug === updated.slug ? updated : pp)))}
              />
            ))}
          </div>
        )}
      </div>

      {!loading && <SizeSummary orders={activeOrders} />}
      {!loading && <ArrivalNotice orders={activeOrders} onSent={load} />}
      {!loading && shopSettings && <HatPromoPanel orders={activeOrders} settings={shopSettings} winners={winners} />}
      {!loading && <ReferralPanel orders={activeOrders} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: 18, fontWeight: 800 }}>הזמנות ביגוד</h2>
          <p style={{ color: '#7a8f7d', fontSize: 12, margin: 0 }}>
            {loading ? 'טוען...' : `${groups.length} הזמנות`} · {pendingCount} ממתינות
          </p>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 6 }}>
          {(
            [
              ['all', 'הכל'],
              ['pending', 'ממתינות'],
              ['confirmed', 'בוצעו'],
              ['cancelled', 'בוטלו'],
            ] as [typeof filter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              style={{
                background: filter === value ? '#b5e853' : 'transparent',
                color: filter === value ? '#0d0f0e' : '#7a8f7d',
                border: '1px solid #252b27', borderRadius: 8, padding: '7px 12px',
                fontSize: 12, fontWeight: 700, fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#7a8f7d' }}>טוען...</div>
      ) : groups.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#7a8f7d', background: '#141716', border: '1px solid #252b27', borderRadius: 12 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>👕</div>
          אין הזמנות להצגה.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {groups.map((g) => {
            const isOpen = openKey === g.key
            const summary = g.rows.length === 1
              ? `${g.rows[0].product_name} (${g.rows[0].size})`
              : `${g.rows[0].product_name} +${g.rows.length - 1}`
            return (
              <div key={g.key} style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflow: 'hidden' }}>
                <button
                  onClick={() => setOpenKey(isOpen ? null : g.key)}
                  style={{
                    width: '100%', textAlign: 'right', background: 'transparent', border: 'none',
                    padding: '12px 14px', cursor: 'pointer', fontFamily: 'Heebo, Arial, sans-serif',
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#e8efe9', fontSize: 14, fontWeight: 700 }}>{g.customer_name}</span>
                    <span style={{ color: '#e8efe9', fontSize: 14, fontWeight: 800 }}>{g.total} ₪</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#7a8f7d', fontSize: 12 }}>{summary} · {fmtDateTime(g.created_at)}</span>
                    <span style={{ color: '#7a8f7d', fontSize: 14 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                  <span
                    style={{
                      alignSelf: 'flex-start',
                      background: g.cancelled ? '#3a1a1a' : g.payment_status === 'confirmed' ? '#12331f' : '#2a2410',
                      color: g.cancelled ? '#ff8f6b' : g.payment_status === 'confirmed' ? '#7ee787' : '#e8c547',
                      borderRadius: 10, padding: '2px 8px', fontSize: 10, fontWeight: 700,
                    }}
                  >
                    {g.cancelled ? '❌ בוטלה · ' : ''}
                    {winners.includes(g.order_group) ? `🧢 כובע #${winners.indexOf(g.order_group) + 1} · ` : ''}
                    {g.rows[0].referral_code ? `🤝 ${g.rows[0].referral_code} · ` : ''}
                    {g.payment_status === 'confirmed' ? 'שולם' : 'ממתין לתשלום'}
                    {g.fulfillment === 'delivery' ? ' · 🚚 משלוח' : ' · איסוף עצמי'}
                  </span>
                </button>

                {isOpen && (
                  <div style={{ padding: '4px 14px 14px', borderTop: '1px solid #252b27' }}>
                    <div style={{ fontSize: 13, margin: '10px 0 8px' }}>
                      <span style={{ color: '#7a8f7d', fontWeight: 700 }}>טלפון: </span>
                      {g.customer_phone}
                      {g.customer_email && (
                        <>
                          {' · '}
                          <span style={{ color: '#7a8f7d', fontWeight: 700 }}>אימייל: </span>
                          {g.customer_email}
                        </>
                      )}
                    </div>
                    <div style={{ fontSize: 13, margin: '0 0 8px' }}>
                      <span style={{ color: '#7a8f7d', fontWeight: 700 }}>
                        {g.fulfillment === 'delivery' ? `🚚 משלוח (${g.shipping_fee} ₪): ` : 'איסוף עצמי מהמועדון'}
                      </span>
                      {g.fulfillment === 'delivery' && (g.delivery_address || '—')}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 12 }}>
                      {g.rows.map((r) => (
                        <div key={r.id} style={{ fontSize: 13 }}>
                          <span style={{ color: '#b5e853', fontWeight: 700 }}>{r.product_name}</span>
                          {` — מידה ${r.size} × ${r.quantity}`}
                          {r.back_name ? ` — שם על הגב: "${r.back_name}"` : ''}
                          {r.is_preorder ? ' (הזמנה מוקדמת)' : ''}
                          {r.arrival_notified_at ? ' · ✉️ קיבל הודעת הגעה' : ''}
                          {` — ${r.line_total} ₪`}
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setConfirmed(g, g.payment_status !== 'confirmed')}
                        disabled={busyKey === g.key}
                        style={{
                          flex: '1 1 auto', background: g.payment_status === 'confirmed' ? 'transparent' : '#b5e853',
                          border: `1px solid ${g.payment_status === 'confirmed' ? '#252b27' : '#b5e853'}`, borderRadius: 8,
                          color: g.payment_status === 'confirmed' ? '#ff8f6b' : '#0d0f0e',
                          padding: '10px 12px', fontSize: 13, fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700,
                          cursor: 'pointer', opacity: busyKey === g.key ? 0.5 : 1,
                        }}
                      >
                        {busyKey === g.key ? '...' : g.payment_status === 'confirmed' ? 'החזר לממתין' : 'סמן ששולם'}
                      </button>
                      <button
                        onClick={() => setCancelled(g, !g.cancelled)}
                        disabled={busyKey === g.key}
                        style={{
                          background: 'transparent', border: `1px solid ${g.cancelled ? '#252b27' : '#5a2a2a'}`, borderRadius: 8,
                          color: g.cancelled ? '#b5e853' : '#ff8f6b', padding: '10px 12px', fontSize: 13,
                          fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, cursor: 'pointer',
                          opacity: busyKey === g.key ? 0.5 : 1,
                        }}
                      >
                        {g.cancelled ? 'שחזור הזמנה' : 'ביטול הזמנה'}
                      </button>
                      <button
                        onClick={() => deleteGroup(g)}
                        disabled={busyKey === g.key}
                        style={{
                          background: 'transparent', border: '1px solid #3a1a1a', borderRadius: 8,
                          color: '#ff8f6b', padding: '10px 12px', fontSize: 13,
                          fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, cursor: 'pointer',
                          opacity: busyKey === g.key ? 0.5 : 1,
                        }}
                      >
                        מחיקה
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
