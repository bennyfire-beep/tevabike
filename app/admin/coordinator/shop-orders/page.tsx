'use client'
// shop-orders/page.tsx — ניהול הזמנות מ-/shop: מה נכנס, ולסמן שהספק (פאן
// רייד) אישר את ההזמנה בפועל. הזמנה אחת יכולה להכיל כמה שורות (order_group
// משותף — מוצר לכל שורה), כי /shop/page.tsx שולח אותן ביחד ב-insert אחד.
// גרסה 2 — רשימה מתקפלת (accordion): שורה אחת מכווצת לכל הזמנה, נפתחת
// למגע. עוצב לנייד קודם — זה המסך שהרכז והבעלים באמת עובדים איתו מהטלפון.
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'
import { ESTIMATED_DELIVERY } from '@/lib/shop-order-email'

type OrderRow = {
  id: string
  created_at: string
  product_name: string
  color: string | null
  quantity: number
  customer_name: string
  customer_phone: string
  fulfillment: string
  delivery_address: string | null
  payment_status: string
  supplier_notified: boolean
  shipping_amount: number
  total_amount: number | null
  order_group: string | null
  supplier_status: string | null
  final_price: number | null
  customer_updated_at: string | null
}

type Group = {
  key: string
  order_group: string | null
  created_at: string
  customer_name: string
  customer_phone: string
  fulfillment: string
  delivery_address: string | null
  shipping_amount: number
  total_amount: number | null
  supplier_notified: boolean
  payment_status: string
  supplier_status: string | null
  final_price: number | null
  customer_updated_at: string | null
  rows: OrderRow[]
}

// עדכון סטטוס מול פאן רייד הוא ידני — התשובות שלהם מגיעות לתיבה האישית
// של בני (reply-to על מייל ההזמנה), אין קריאה/פענוח אוטומטי של המייל.
const SUPPLIER_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'ordered', label: 'הוזמן מהספק' },
  { value: 'shipped', label: 'נשלח ללקוח' },
  { value: 'delayed', label: 'עיכוב' },
  { value: 'cancelled', label: 'בוטל' },
]

function waPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `972${digits.replace(/^0/, '')}`
}

function customerMessage(g: Group): string {
  const firstName = g.customer_name.split(' ')[0]
  const items = g.rows.map(r => r.product_name + (r.color ? ` (${r.color})` : '')).join(' + ')
  const statusLine =
    g.supplier_status === 'shipped'
      ? `ההזמנה שלך (${items}) יצאה לדרך! צפי אספקה: ${ESTIMATED_DELIVERY}.`
      : g.supplier_status === 'delayed'
        ? `יש עיכוב קל בהזמנה שלך (${items}), ניצור קשר בהקדם עם פרטים מדויקים.`
        : g.supplier_status === 'cancelled'
          ? `לצערנו ההזמנה שלך (${items}) בוטלה מול הספק. ניצור איתך קשר לגבי החזר או חלופה.`
          : `ההזמנה שלך (${items}) התקבלה ואושרה מול הספק, ונמצאת בטיפול.`
  const priceLine =
    g.final_price != null && g.final_price !== g.total_amount
      ? `\n\nלתשומת ליבך: המחיר הסופי עודכן ל-${g.final_price} ₪.`
      : ''
  return `היי ${firstName}, ${statusLine}${priceLine}\n\nתודה,\nבני - טבע בייק`
}

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' })

function groupOrders(rows: OrderRow[]): Group[] {
  const map = new Map<string, Group>()
  for (const r of rows) {
    const key = r.order_group || r.id
    const existing = map.get(key)
    if (existing) {
      existing.rows.push(r)
    } else {
      map.set(key, {
        key,
        order_group: r.order_group,
        created_at: r.created_at,
        customer_name: r.customer_name,
        customer_phone: r.customer_phone,
        fulfillment: r.fulfillment,
        delivery_address: r.delivery_address,
        shipping_amount: r.shipping_amount,
        total_amount: r.total_amount,
        supplier_notified: r.supplier_notified,
        payment_status: r.payment_status,
        supplier_status: r.supplier_status,
        final_price: r.final_price,
        customer_updated_at: r.customer_updated_at,
        rows: [r],
      })
    }
  }
  return Array.from(map.values())
}

export default function ShopOrdersPage() {
  const user = useCoordinator()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed'>('all')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('shop_orders')
      .select('id, created_at, product_name, color, quantity, customer_name, customer_phone, fulfillment, delivery_address, payment_status, supplier_notified, shipping_amount, total_amount, order_group, supplier_status, final_price, customer_updated_at')
      .order('created_at', { ascending: false })
    setOrders((data ?? []) as OrderRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) return
    load()
  }, [user, load])

  async function setConfirmed(group: Group, confirmed: boolean) {
    setBusyKey(group.key)
    const payment_status = confirmed ? 'confirmed' : 'pending'
    const ids = group.rows.map(r => r.id)
    const { error } = await supabase.from('shop_orders').update({ payment_status }).in('id', ids)
    if (error) { alert(error.message); setBusyKey(null); return }
    setOrders(prev => prev.map(r => (ids.includes(r.id) ? { ...r, payment_status } : r)))
    setBusyKey(null)
  }

  async function notifySupplier(group: Group) {
    if (!group.order_group) { alert('חסר מזהה הזמנה'); return }
    if (!confirm(`לשלוח את ההזמנה של ${group.customer_name} לפאן רייד? ודא/י קודם שהתשלום עבר בארבוקס.`)) return
    setBusyKey(group.key)
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token ?? ''
    try {
      const res = await fetch('/api/shop-order/notify-supplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_group: group.order_group }),
      })
      const d = await res.json()
      if (!res.ok) { alert(d.error || 'שליחה נכשלה'); setBusyKey(null); return }
      const ids = group.rows.map(r => r.id)
      setOrders(prev => prev.map(r => (ids.includes(r.id) ? { ...r, supplier_notified: true } : r)))
    } catch {
      alert('שליחה נכשלה — בדוק חיבור')
    }
    setBusyKey(null)
  }

  async function setSupplierStatus(group: Group, supplier_status: string) {
    setBusyKey(group.key)
    const ids = group.rows.map(r => r.id)
    const { error } = await supabase.from('shop_orders').update({ supplier_status }).in('id', ids)
    if (error) { alert(error.message); setBusyKey(null); return }
    setOrders(prev => prev.map(r => (ids.includes(r.id) ? { ...r, supplier_status } : r)))
    setBusyKey(null)
  }

  async function saveFinalPrice(group: Group, value: string) {
    const trimmed = value.trim()
    const final_price = trimmed === '' ? null : Number(trimmed)
    if (trimmed !== '' && (Number.isNaN(final_price) || final_price === null)) return
    if ((group.final_price ?? null) === final_price) return
    const ids = group.rows.map(r => r.id)
    const { error } = await supabase.from('shop_orders').update({ final_price }).in('id', ids)
    if (error) { alert(error.message); return }
    setOrders(prev => prev.map(r => (ids.includes(r.id) ? { ...r, final_price } : r)))
  }

  // פותח וואטסאפ עם הודעה מוכנה ללקוח — בני קורא ולוחץ שלח בעצמו (לא
  // נשלח לבד מהמערכת). מסמן customer_updated_at רק למעקב, לא כאישור מסירה.
  async function sendCustomerUpdate(group: Group) {
    const text = encodeURIComponent(customerMessage(group))
    window.open(`https://wa.me/${waPhone(group.customer_phone)}?text=${text}`, '_blank')
    const ids = group.rows.map(r => r.id)
    const customer_updated_at = new Date().toISOString()
    const { error } = await supabase.from('shop_orders').update({ customer_updated_at }).in('id', ids)
    if (!error) setOrders(prev => prev.map(r => (ids.includes(r.id) ? { ...r, customer_updated_at } : r)))
  }

  async function deleteGroup(group: Group) {
    if (!confirm(`למחוק לצמיתות את ההזמנה של ${group.customer_name}? אי אפשר לשחזר.`)) return
    setBusyKey(group.key)
    const ids = group.rows.map(r => r.id)
    const { error } = await supabase.from('shop_orders').delete().in('id', ids)
    if (error) { alert(error.message); setBusyKey(null); return }
    setOrders(prev => prev.filter(r => !ids.includes(r.id)))
    setBusyKey(null)
    setOpenKey(null)
  }

  if (!user) return null

  const groups = groupOrders(orders).filter(g => {
    if (filter === 'all') return true
    if (filter === 'confirmed') return g.payment_status === 'confirmed'
    return g.payment_status !== 'confirmed'
  })
  const pendingCount = groupOrders(orders).filter(g => g.payment_status !== 'confirmed').length

  return (
    <div style={{ padding: '16px 12px', maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: 18, fontWeight: 800 }}>הזמנות חנות</h2>
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
          <div style={{ fontSize: 30, marginBottom: 8 }}>🛒</div>
          אין הזמנות להצגה.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {groups.map(g => {
            const isOpen = openKey === g.key
            const summary = g.rows.length === 1
              ? g.rows[0].product_name
              : `${g.rows[0].product_name} +${g.rows.length - 1}`
            return (
              <div
                key={g.key}
                style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, overflow: 'hidden' }}
              >
                {/* שורה מכווצת — כל השטח לחיץ, עיצוב אצבע-ראשונה */}
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
                    <span style={{ color: '#e8efe9', fontSize: 14, fontWeight: 800 }}>{g.total_amount ?? '?'} ₪</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#7a8f7d', fontSize: 12 }}>{summary} · {fmtDateTime(g.created_at)}</span>
                    <span style={{ color: '#7a8f7d', fontSize: 14 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        background: g.supplier_notified ? '#12331f' : '#3a1a1a',
                        color: g.supplier_notified ? '#7ee787' : '#ff8f6b',
                        borderRadius: 10, padding: '2px 8px', fontSize: 10, fontWeight: 700,
                      }}
                    >
                      {g.supplier_notified ? '✓ נשלח לפאן רייד' : 'טרם נשלח לפאן רייד'}
                    </span>
                    <span
                      style={{
                        background: g.payment_status === 'confirmed' ? '#12331f' : '#2a2410',
                        color: g.payment_status === 'confirmed' ? '#7ee787' : '#e8c547',
                        borderRadius: 10, padding: '2px 8px', fontSize: 10, fontWeight: 700,
                      }}
                    >
                      {g.payment_status === 'confirmed' ? 'בוצעה' : 'ממתינה'}
                    </span>
                  </div>
                </button>

                {/* פרטים מלאים + פעולות — נפתח למגע בלבד */}
                {isOpen && (
                  <div style={{ padding: '4px 14px 14px', borderTop: '1px solid #252b27' }}>
                    <div style={{ fontSize: 13, margin: '10px 0 8px' }}>
                      <span style={{ color: '#7a8f7d', fontWeight: 700 }}>טלפון: </span>
                      {g.customer_phone}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
                      {g.rows.map(r => (
                        <div key={r.id} style={{ fontSize: 13 }}>
                          <span style={{ color: '#b5e853', fontWeight: 700 }}>{r.product_name}</span>
                          {r.color ? ` — ${r.color}` : ''}
                          {r.quantity > 1 ? ` × ${r.quantity}` : ''}
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 13, color: '#c9d4cb', marginBottom: 4 }}>
                      <span style={{ color: '#7a8f7d', fontWeight: 700 }}>משלוח: </span>
                      {g.delivery_address || '—'}
                    </div>
                    <div style={{ fontSize: 13, color: '#c9d4cb', marginBottom: 12 }}>
                      <span style={{ color: '#7a8f7d', fontWeight: 700 }}>סה״כ: </span>
                      {g.total_amount ?? '?'} ₪ (כולל משלוח {g.shipping_amount} ₪)
                    </div>

                    {!g.supplier_notified && (
                      <button
                        onClick={() => notifySupplier(g)}
                        disabled={busyKey === g.key}
                        style={{
                          width: '100%', background: '#1a2637', border: '1px solid #2a4a6b', borderRadius: 8,
                          color: '#81d4fa', padding: '10px 12px', fontSize: 13, marginBottom: 8,
                          fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, cursor: 'pointer',
                          opacity: busyKey === g.key ? 0.5 : 1,
                        }}
                      >
                        {busyKey === g.key ? '...' : '📧 שלח לפאן רייד (אחרי אימות תשלום בארבוקס)'}
                      </button>
                    )}

                    {g.supplier_notified && (
                      <div style={{ marginBottom: 12, paddingTop: 4, borderTop: '1px dashed #252b27' }}>
                        <div style={{ fontSize: 12, color: '#7a8f7d', fontWeight: 700, margin: '10px 0 6px' }}>
                          סטטוס מול פאן רייד (תשובתם מגיעה למייל של בני — לעדכן ידנית)
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                          {SUPPLIER_STATUS_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => setSupplierStatus(g, opt.value)}
                              disabled={busyKey === g.key}
                              style={{
                                background: g.supplier_status === opt.value ? '#b5e853' : 'transparent',
                                color: g.supplier_status === opt.value ? '#0d0f0e' : '#7a8f7d',
                                border: '1px solid #252b27', borderRadius: 8, padding: '6px 10px',
                                fontSize: 12, fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700,
                                cursor: 'pointer', opacity: busyKey === g.key ? 0.5 : 1,
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <label style={{ display: 'block', fontSize: 12, color: '#7a8f7d', marginBottom: 4 }}>
                          מחיר סופי מהספק (אם שונה מ-{g.total_amount ?? '?'} ₪)
                        </label>
                        <input
                          type="number"
                          defaultValue={g.final_price ?? ''}
                          onBlur={e => saveFinalPrice(g, e.target.value)}
                          placeholder={`${g.total_amount ?? ''}`}
                          style={{
                            width: '100%', boxSizing: 'border-box', background: '#0d0f0e', border: '1px solid #252b27',
                            borderRadius: 8, color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 13,
                            padding: '8px 10px', outline: 'none', marginBottom: 10,
                          }}
                        />
                        <button
                          onClick={() => sendCustomerUpdate(g)}
                          disabled={!g.supplier_status}
                          title={!g.supplier_status ? 'קודם תסמן סטטוס למעלה' : ''}
                          style={{
                            width: '100%', background: '#12331f', border: '1px solid #1f5c34', borderRadius: 8,
                            color: '#7ee787', padding: '10px 12px', fontSize: 13,
                            fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, cursor: 'pointer',
                            opacity: g.supplier_status ? 1 : 0.4,
                          }}
                        >
                          📱 הכן הודעת עדכון ללקוח בוואטסאפ
                        </button>
                        {g.customer_updated_at && (
                          <div style={{ fontSize: 11, color: '#7a8f7d', marginTop: 4 }}>
                            נשלחה הודעה ב-{fmtDateTime(g.customer_updated_at)}
                          </div>
                        )}
                      </div>
                    )}

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
                        {busyKey === g.key ? '...' : g.payment_status === 'confirmed' ? 'החזר לממתינה' : 'סמן כבוצעה'}
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
