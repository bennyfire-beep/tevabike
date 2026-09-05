'use client'
// tshirt-orders/page.tsx — ניהול מדור החולצות: הגדרות מוצר (מתג הזמנה
// מוקדמת/מחירים/קישורי Arbox — נערכים כאן כדי שבני יוכל להדביק קישורים
// אמיתיים בלי דיפלוי) + רשימת הזמנות (accordion, כמו shop-orders/page.tsx).
// אין כאן "שלח לספק" כמו בהזמנות חנות — החולצות מודפסות במרוכז ומחולקות
// באיסוף עצמי, אז הפעולה היחידה על הזמנה היא לסמן תשלום ולמחוק.
import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'

type ShopSettings = {
  is_active: boolean
  coming_soon_message: string
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
}

type Group = {
  key: string
  order_group: string
  created_at: string
  customer_name: string
  customer_phone: string
  customer_email: string | null
  payment_status: string
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
        total: r.line_total,
        rows: [r],
      })
    }
  }
  // אם יש שורה אחת שלא אושרה בתוך הקבוצה, הקבוצה כולה מוצגת כ"ממתינה"
  for (const g of map.values()) {
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
      .update({ is_active: draft.is_active, coming_soon_message: draft.coming_soon_message })
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
          {draft.is_active ? '🟢 מדור החולצות פעיל באתר' : '🟡 מדור החולצות במצב "בקרוב"'}
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

function ProductSettingsCard({ product, onSaved }: { product: ProductRow; onSaved: (p: ProductRow) => void }) {
  const [draft, setDraft] = useState(product)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(product)

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

export default function TshirtOrdersPage() {
  const user = useCoordinator()
  const [products, setProducts] = useState<ProductRow[]>([])
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed'>('all')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: p }, { data: o }, { data: s }] = await Promise.all([
      supabase
        .from('tshirt_products')
        .select('slug, name, preorder_price, regular_price, preorder_active, preorder_arbox_link, regular_arbox_link, preorder_deadline_label')
        .order('display_order', { ascending: true }),
      supabase
        .from('tshirt_orders')
        .select('id, created_at, order_group, product_name, size, back_name, quantity, unit_price, is_preorder, line_total, customer_name, customer_phone, customer_email, payment_status')
        .order('created_at', { ascending: false }),
      supabase.from('tshirt_shop_settings').select('is_active, coming_soon_message').eq('id', true).maybeSingle(),
    ])
    setProducts((p ?? []) as ProductRow[])
    setOrders((o ?? []) as OrderRow[])
    setShopSettings((s as ShopSettings | null) ?? { is_active: false, coming_soon_message: '' })
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) return
    load()
  }, [user, load])

  async function setConfirmed(group: Group, confirmed: boolean) {
    setBusyKey(group.key)
    const payment_status = confirmed ? 'confirmed' : 'pending'
    const ids = group.rows.map((r) => r.id)
    const { error } = await supabase.from('tshirt_orders').update({ payment_status }).in('id', ids)
    if (error) { alert(error.message); setBusyKey(null); return }
    setOrders((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, payment_status } : r)))
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

  if (!user) return null

  const groups = groupOrders(orders).filter((g) => {
    if (filter === 'all') return true
    if (filter === 'confirmed') return g.payment_status === 'confirmed'
    return g.payment_status !== 'confirmed'
  })
  const pendingCount = groupOrders(orders).filter((g) => g.payment_status !== 'confirmed').length

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

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: 18, fontWeight: 800 }}>הזמנות חולצות</h2>
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
                      background: g.payment_status === 'confirmed' ? '#12331f' : '#2a2410',
                      color: g.payment_status === 'confirmed' ? '#7ee787' : '#e8c547',
                      borderRadius: 10, padding: '2px 8px', fontSize: 10, fontWeight: 700,
                    }}
                  >
                    {g.payment_status === 'confirmed' ? 'שולם' : 'ממתין לתשלום'}
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 12 }}>
                      {g.rows.map((r) => (
                        <div key={r.id} style={{ fontSize: 13 }}>
                          <span style={{ color: '#b5e853', fontWeight: 700 }}>{r.product_name}</span>
                          {` — מידה ${r.size} × ${r.quantity}`}
                          {r.back_name ? ` — שם על הגב: "${r.back_name}"` : ''}
                          {r.is_preorder ? ' (הזמנה מוקדמת)' : ''}
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
