'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TYPES: Record<string, { label: string; icon: string; tone: string }> = {
  credit_refusal: { label: 'סירוב אשראי', icon: '💳', tone: 'border-red-800 bg-red-950/40' },
  membership_cancelled: { label: 'ביטול מנוי', icon: '🛑', tone: 'border-orange-800 bg-orange-950/30' },
  membership_hold: { label: 'הקפאת מנוי', icon: '⏸️', tone: 'border-amber-800 bg-amber-950/30' },
  user_cancel_registration: { label: 'ביטול הרשמה', icon: '↩️', tone: 'border-stone-700 bg-stone-900/60' },
  inactive_user: { label: 'לקוח לא פעיל', icon: '💤', tone: 'border-stone-700 bg-stone-900/60' },
}

type Alert = {
  id: string
  created_at: string
  occurred_at: string | null
  arbox_user_id: number | null
  full_name: string | null
  phone: string | null
  email: string | null
  alert_type: string
  amount: number | null
  status: string
  handled_by: string | null
  handled_at: string | null
  notes: string | null
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'open' | 'done'>('open')
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('payment_alerts')
      .select('*')
      .order('occurred_at', { ascending: false })
    setAlerts((data as Alert[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function mark(alert: Alert, status: 'handled' | 'ignored') {
    setBusy(alert.id)
    await supabase
      .from('payment_alerts')
      .update({ status, handled_at: new Date().toISOString() })
      .eq('id', alert.id)
    setBusy(null)
    await load()
  }

  const shown = alerts.filter((a) => (tab === 'open' ? a.status === 'open' : a.status !== 'open'))
  const openCount = alerts.filter((a) => a.status === 'open').length

  return (
    <div dir="rtl" className="min-h-screen bg-stone-950 text-stone-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">התראות תשלום</h1>
          <p className="text-stone-400 text-sm">סירובי אשראי וביטולי מנוי מ-Arbox</p>
        </header>

        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setTab('open')}
            className={`px-4 py-2 rounded-lg text-sm ${
              tab === 'open' ? 'bg-lime-400 text-stone-950 font-semibold' : 'bg-stone-900 text-stone-400'
            }`}
          >
            פתוחות ({openCount})
          </button>
          <button
            onClick={() => setTab('done')}
            className={`px-4 py-2 rounded-lg text-sm ${
              tab === 'done' ? 'bg-lime-400 text-stone-950 font-semibold' : 'bg-stone-900 text-stone-400'
            }`}
          >
            טופלו ({alerts.length - openCount})
          </button>
        </div>

        {loading ? (
          <p className="text-stone-500">טוען…</p>
        ) : shown.length === 0 ? (
          <div className="border border-dashed border-stone-800 rounded-xl p-10 text-center text-stone-500">
            {tab === 'open' ? 'אין התראות פתוחות. הכל מסודר.' : 'אין התראות שטופלו.'}
          </div>
        ) : (
          <div className="space-y-3">
            {shown.map((a) => {
              const t = TYPES[a.alert_type] || TYPES.inactive_user
              return (
                <div key={a.id} className={`border rounded-xl p-4 ${a.status === 'open' ? t.tone : 'border-stone-800 bg-stone-900/40'}`}>
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{t.icon}</span>
                        <span className="text-sm font-semibold text-stone-300">{t.label}</span>
                      </div>
                      <h3 className="font-bold text-lg mt-1">{a.full_name || 'לקוח לא מזוהה'}</h3>
                      <p className="text-sm text-stone-400 mt-0.5">
                        {a.phone && (
                          <a href={`tel:${a.phone}`} className="text-lime-400">
                            {a.phone}
                          </a>
                        )}
                        {a.email ? ` · ${a.email}` : ''}
                      </p>
                      {a.amount != null && (
                        <p className="text-sm text-stone-300 mt-1">סכום: ₪{Number(a.amount).toLocaleString('he-IL')}</p>
                      )}
                      {a.notes && <p className="text-sm text-stone-400 mt-2">📝 {a.notes}</p>}
                    </div>
                    <span className="text-xs text-stone-500 whitespace-nowrap">
                      {new Date(a.occurred_at || a.created_at).toLocaleDateString('he-IL')}
                    </span>
                  </div>

                  {a.status === 'open' ? (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {a.phone && (
                        <a
                          href={`https://wa.me/${String(a.phone).replace(/\D/g, '').replace(/^0/, '972')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-lime-400 text-stone-950 font-semibold px-4 py-2 rounded-lg text-sm"
                        >
                          שלח וואטסאפ
                        </a>
                      )}
                      {a.arbox_user_id && (
                        <a
                          href={`https://manage.arboxapp.com/user-profile/${a.arbox_user_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="border border-stone-600 px-4 py-2 rounded-lg text-sm text-stone-300"
                        >
                          פתח ב-Arbox
                        </a>
                      )}
                      <button
                        onClick={() => mark(a, 'handled')}
                        disabled={busy === a.id}
                        className="border border-lime-700 text-lime-400 px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                      >
                        סמן כטופל
                      </button>
                      <button
                        onClick={() => mark(a, 'ignored')}
                        disabled={busy === a.id}
                        className="border border-stone-700 text-stone-500 px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                      >
                        התעלם
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-stone-500 mt-3 pt-3 border-t border-stone-800">
                      {a.status === 'handled' ? '✅ טופל' : 'הותעלם'}
                      {a.handled_at ? ` · ${new Date(a.handled_at).toLocaleDateString('he-IL')}` : ''}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
