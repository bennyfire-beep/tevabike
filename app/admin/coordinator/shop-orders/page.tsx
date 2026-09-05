'use client'
// shop-orders/page.tsx — ניהול הזמנות מ-/shop: מה נכנס, ולסמן שהספק (פאן
// רייד) אישר את ההזמנה בפועל. הזמנה אחת יכולה להכיל כמה שורות (order_group
// משותף — מוצר לכל שורה), כי /shop/page.tsx שולח אותן ביחד ב-insert אחד.
// גרסה 2 — רשימה מתקפלת (accordion): שורה אחת מכווצת לכל הזמנה, נפתחת
// למגע. עוצב לנייד קודם — זה המסך שהרכז והבעלים באמת עובדים איתו מהטלפון.
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'

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
}

type Group = {
  key: string
  created_at: string
  customer_name: string
  customer_phone: string
  fulfillment: string
  delivery_address: string | null
  shipping_amount: number
  total_amount: number | null
  supplier_notified: boolean
  payment_status: string
  rows: OrderRow[]
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
        created_at: r.created_at,
        customer_name: r.customer_name,
        customer_phone: r.customer_phone,
        fulfillment: r.fulfillment,
        delivery_address: r.delivery_address,
        shipping_amount: r.shipping_amount,
        total_amount: r.total_amount,
        supplier_notified: r.supplier_notified,
        payment_status: r.payment_status,
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
      .select('id, created_at, product_name, color, quantity, customer_name, customer_phone, fulfillment, delivery_address, payment_status, supplier_notified, shipping_amount, total_amount, order_group')
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
                      {g.supplier_notified ? '✓ נשלח לפאן רייד' : '✗ מייל לא נשלח'}
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
