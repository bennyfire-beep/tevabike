'use client'
// shop-cancellations/page.tsx — ניהול בקשות ביטול מ-/shop/cancel. הטופס
// עצמו לא מזיז כסף — כאן רק רואים את הבקשה, ומעדכנים סטטוס אחרי שמטפלים
// בזיכוי בפועל בפאנל ארבוקס.
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'

type Request = {
  id: string
  created_at: string
  customer_name: string
  customer_phone: string
  order_reference: string | null
  reason: string
  reason_details: string | null
  matched_order_id: string | null
  matched_order_created_at: string | null
  matched_order_total: number | null
  days_since_order: number | null
  eligible_14_day_window: boolean | null
  estimated_fee: number | null
  status: string
  staff_notes: string | null
}

const REASON_LABELS: Record<string, string> = {
  not_wanted: 'לא רוצה יותר / הוזמן בטעות',
  defective: 'מוצר פגום / לא תקין',
  other: 'אחר',
}

const STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'pending', label: 'ממתין', color: '#e8c547' },
  { value: 'approved', label: 'אושר', color: '#81d4fa' },
  { value: 'refunded', label: 'זוכה', color: '#7ee787' },
  { value: 'rejected', label: 'נדחה', color: '#ff8f6b' },
]

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function ShopCancellationsPage() {
  const user = useCoordinator()
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [showResolved, setShowResolved] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('shop_cancellation_requests')
      .select('id, created_at, customer_name, customer_phone, order_reference, reason, reason_details, matched_order_id, matched_order_created_at, matched_order_total, days_since_order, eligible_14_day_window, estimated_fee, status, staff_notes')
      .order('created_at', { ascending: false })
    setRequests((data ?? []) as Request[])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) return
    load()
  }, [user, load])

  async function setStatus(req: Request, status: string) {
    setBusyId(req.id)
    const { error } = await supabase.from('shop_cancellation_requests').update({ status }).eq('id', req.id)
    if (error) { alert(error.message); setBusyId(null); return }
    setRequests(prev => prev.map(r => (r.id === req.id ? { ...r, status } : r)))
    setBusyId(null)
  }

  async function saveNotes(req: Request, notes: string) {
    const trimmed = notes.trim()
    if ((req.staff_notes ?? '') === trimmed) return
    const { error } = await supabase.from('shop_cancellation_requests').update({ staff_notes: trimmed || null }).eq('id', req.id)
    if (error) { alert(error.message); return }
    setRequests(prev => prev.map(r => (r.id === req.id ? { ...r, staff_notes: trimmed || null } : r)))
    setSavedNoteId(req.id)
    setTimeout(() => setSavedNoteId(id => (id === req.id ? null : id)), 1500)
  }

  if (!user) return null

  const visible = requests.filter(r => showResolved || r.status === 'pending')
  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div style={{ padding: 24, maxWidth: 950, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>בקשות ביטול הזמנה</h2>
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>
            {loading ? 'טוען...' : `${pendingCount} ממתינות`} — לא מבצע זיכוי אוטומטית, רק תיעוד. הביטול בפועל נעשה ידנית בארבוקס.
          </p>
        </div>
        <label style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 6, color: '#e8efe9', fontSize: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showResolved}
            onChange={e => setShowResolved(e.target.checked)}
            style={{ width: 15, height: 15, accentColor: '#b5e853', cursor: 'pointer' }}
          />
          הצג גם מטופלות
        </label>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#7a8f7d' }}>טוען...</div>
      ) : visible.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#7a8f7d', background: '#141716', border: '1px solid #252b27', borderRadius: 12 }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>🙌</div>
          אין בקשות ביטול ממתינות.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map(r => {
            const statusMeta = STATUS_OPTIONS.find(s => s.value === r.status) ?? STATUS_OPTIONS[0]
            return (
              <div
                key={r.id}
                style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: 16 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: '#7a8f7d', fontSize: 11 }}>{fmtDateTime(r.created_at)}</span>
                    <span style={{ background: '#1a2637', color: '#81d4fa', borderRadius: 10, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>
                      {REASON_LABELS[r.reason] || r.reason}
                    </span>
                    <span style={{ background: `${statusMeta.color}22`, color: statusMeta.color, borderRadius: 10, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {STATUS_OPTIONS.filter(s => s.value !== r.status).map(s => (
                      <button
                        key={s.value}
                        onClick={() => setStatus(r, s.value)}
                        disabled={busyId === r.id}
                        style={{
                          background: 'transparent', border: `1px solid ${s.color}55`, borderRadius: 8,
                          color: s.color, padding: '5px 10px', fontSize: 11,
                          fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, cursor: 'pointer',
                          opacity: busyId === r.id ? 0.5 : 1,
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: '#7a8f7d', fontWeight: 700 }}>לקוח: </span>
                  {r.customer_name} · {r.customer_phone}
                  {r.order_reference && <span style={{ color: '#7a8f7d' }}> · הזמנה: {r.order_reference}</span>}
                </div>

                {r.reason_details && (
                  <div style={{ fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: '#7a8f7d', fontWeight: 700 }}>פרטים: </span>
                    {r.reason_details}
                  </div>
                )}

                <div style={{ fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: '#7a8f7d', fontWeight: 700 }}>בתוך 14 יום: </span>
                  {r.eligible_14_day_window === null
                    ? 'לא נמצאה הזמנה תואמת'
                    : r.eligible_14_day_window
                      ? `כן (${r.days_since_order} ימים)`
                      : `לא (${r.days_since_order} ימים)`}
                  {' · '}
                  <span style={{ color: '#7a8f7d', fontWeight: 700 }}>דמי ביטול משוערים: </span>
                  {r.estimated_fee === null ? '—' : r.estimated_fee === 0 ? 'ללא' : `${r.estimated_fee} ₪`}
                  {r.matched_order_total !== null && (
                    <span style={{ color: '#7a8f7d' }}> (הזמנה: {r.matched_order_total} ₪)</span>
                  )}
                </div>

                <textarea
                  defaultValue={r.staff_notes ?? ''}
                  onBlur={e => saveNotes(r, e.target.value)}
                  placeholder="הערות צוות (נשמר אוטומטית ביציאה מהשדה)"
                  rows={2}
                  style={{
                    width: '100%', boxSizing: 'border-box', background: '#0d0f0e', border: '1px solid #252b27',
                    borderRadius: 8, color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 13,
                    padding: '8px 10px', outline: 'none', resize: 'vertical', marginTop: 6,
                  }}
                />
                {savedNoteId === r.id && <span style={{ color: '#7ee787', fontSize: 11 }}>נשמר ✓</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
