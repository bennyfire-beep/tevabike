'use client'
// app/admin/coordinator/workshops/page.tsx — coordinator view of workshop
// registrations (airbag clinic etc.), with a quick payment-status toggle.
//
// This file used to contain a duplicate of the PUBLIC registration form
// (app/workshop-airbag/page.tsx) by mistake — nothing here ever queried
// workshop_registrations, so clicking "סדנאות" showed a signup form instead
// of the registrant list. This is the actual admin screen lib/workshop-payment.ts
// already refers to ("a coordinator marks them paid by hand on
// /admin/coordinator/workshops").

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { downloadCsv } from '@/lib/csv-export'
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  type PaymentMethod,
} from '@/lib/workshop-payment'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Registration = {
  id: string
  created_at: string
  workshop_date: string
  full_name: string
  phone: string
  email: string
  age: number | null
  bike_brand: string | null
  discount_eligible: boolean
  payment_status: string
  notes: string | null
  riding_experience: string | null
  riding_style: string | null
  learning_goals: string | null
  health_declaration: boolean
  whatsapp_optin: boolean | null
}

const STATUS_BADGE: Record<string, string> = {
  paid: 'bg-lime-950 text-lime-300 border-lime-800',
  pending: 'bg-amber-950 text-amber-300 border-amber-800',
  cancelled: 'bg-stone-800 text-stone-400 border-stone-700',
}

export default function WorkshopsAdminPage() {
  const [regs, setRegs] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [pickingPay, setPickingPay] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('workshop_registrations')
      .select('*')
      .order('workshop_date', { ascending: true })
      .order('created_at', { ascending: false })
    if (error) setMsg(error.message)
    else setRegs((data as Registration[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const dates = useMemo(
    () => Array.from(new Set(regs.map((r) => r.workshop_date))).sort(),
    [regs]
  )

  const shown = regs
    .filter((r) => dateFilter === 'all' || r.workshop_date === dateFilter)
    .filter((r) => statusFilter === 'all' || r.payment_status === statusFilter)

  const fmtDate = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', weekday: 'long' })
  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' })

  async function setStatus(reg: Registration, status: 'pending' | 'paid', method?: PaymentMethod) {
    setBusy(reg.id)
    setMsg('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token ?? ''
      const res = await fetch('/api/workshop-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: reg.id, payment_status: status, payment_method: method ?? null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'העדכון נכשל')
      setPickingPay(null)
      await load()
    } catch (e: any) {
      setMsg(e.message)
    } finally {
      setBusy(null)
    }
  }

  function exportCsv() {
    downloadCsv(
      'סדנאות-נרשמים.csv',
      ['תאריך סדנה', 'נרשם בתאריך', 'שם מלא', 'טלפון', 'אימייל', 'גיל', 'מותג אופניים', 'סטטוס תשלום', 'הערות'],
      shown.map((r) => [
        fmtDate(r.workshop_date), fmtDateTime(r.created_at), r.full_name, r.phone, r.email,
        r.age ?? '', r.bike_brand ?? '', PAYMENT_STATUS_LABEL[r.payment_status as 'pending' | 'paid'] ?? r.payment_status,
        r.notes ?? '',
      ]),
    )
  }

  const paidCount = shown.filter((r) => r.payment_status === 'paid').length
  const pendingCount = shown.filter((r) => r.payment_status === 'pending').length
  const activeCount = shown.filter((r) => r.payment_status !== 'cancelled').length

  return (
    <div dir="rtl" className="min-h-screen bg-stone-950 text-stone-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">סדנאות</h1>
            <p className="text-stone-400 text-sm">נרשמים לסדנת האיר באג וסטטוס תשלום</p>
          </div>
          <button
            onClick={exportCsv}
            disabled={shown.length === 0}
            className="bg-lime-950 border border-lime-800 text-lime-300 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
          >
            ייצוא ל-CSV ({shown.length})
          </button>
        </header>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold">{activeCount}</div>
            <div className="text-xs text-stone-500 mt-1">רשומים</div>
          </div>
          <div className="bg-stone-900/60 border border-lime-900 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-lime-400">{paidCount}</div>
            <div className="text-xs text-stone-500 mt-1">שילמו</div>
          </div>
          <div className="bg-stone-900/60 border border-amber-900 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-amber-400">{pendingCount}</div>
            <div className="text-xs text-stone-500 mt-1">ממתינים לתשלום</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => setDateFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs ${dateFilter === 'all' ? 'bg-lime-400 text-stone-950 font-semibold' : 'bg-stone-900 text-stone-400'}`}
          >
            כל התאריכים
          </button>
          {dates.map((d) => (
            <button
              key={d}
              onClick={() => setDateFilter(d)}
              className={`px-3 py-1.5 rounded-lg text-xs ${dateFilter === d ? 'bg-lime-400 text-stone-950 font-semibold' : 'bg-stone-900 text-stone-400'}`}
            >
              {fmtDate(d)} ({regs.filter((r) => r.workshop_date === d).length})
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {(['all', 'pending', 'paid', 'cancelled'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs ${statusFilter === s ? 'bg-stone-100 text-stone-950 font-semibold' : 'bg-stone-900 text-stone-400'}`}
            >
              {s === 'all' ? 'הכל' : PAYMENT_STATUS_LABEL[s as 'pending' | 'paid'] ?? 'בוטל'}
            </button>
          ))}
        </div>

        {msg && <div className="bg-red-950 border border-red-800 text-red-200 rounded-lg p-3 text-sm mb-4">{msg}</div>}

        {loading ? (
          <p className="text-stone-500">טוען…</p>
        ) : shown.length === 0 ? (
          <div className="border border-dashed border-stone-800 rounded-xl p-10 text-center text-stone-500">
            אין נרשמים תואמים לסינון הזה.
          </div>
        ) : (
          <div className="space-y-3">
            {shown.map((reg) => (
              <div key={reg.id} className="bg-stone-900/60 border border-stone-800 rounded-xl p-4">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="font-bold text-lg">
                      {reg.full_name}{' '}
                      {reg.age ? <span className="text-stone-500 text-sm font-normal">· גיל {reg.age}</span> : null}
                    </h3>
                    <p className="text-sm text-stone-400 mt-0.5">
                      <a href={`tel:${reg.phone}`} className="text-lime-400">{reg.phone}</a> · {reg.email}
                    </p>
                    <p className="text-sm text-stone-500 mt-0.5">
                      📅 {fmtDate(reg.workshop_date)}
                      {reg.bike_brand && ` · 🚲 ${reg.bike_brand}`}
                      {reg.discount_eligible && ' · 🎁 זכאי להנחה'}
                    </p>
                    {(reg.riding_experience || reg.riding_style || reg.learning_goals) && (
                      <p className="text-sm text-stone-500 mt-0.5">
                        {[reg.riding_experience, reg.riding_style, reg.learning_goals].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {reg.notes && <p className="text-sm text-amber-300/80 mt-2">📝 {reg.notes}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-stone-600 whitespace-nowrap">{fmtDateTime(reg.created_at)}</span>
                    <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_BADGE[reg.payment_status] ?? STATUS_BADGE.cancelled}`}>
                      {PAYMENT_STATUS_LABEL[reg.payment_status as 'pending' | 'paid'] ?? 'בוטל'}
                    </span>
                  </div>
                </div>

                {reg.payment_status !== 'cancelled' && (
                  <div className="mt-3 pt-3 border-t border-stone-800">
                    {pickingPay === reg.id ? (
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-xs text-stone-500">שולם באמצעות:</span>
                        {PAYMENT_METHODS.map((m) => (
                          <button
                            key={m}
                            disabled={busy === reg.id}
                            onClick={() => setStatus(reg, 'paid', m)}
                            className="bg-lime-400 text-stone-950 font-semibold px-3 py-1.5 rounded-lg text-xs disabled:opacity-50"
                          >
                            {PAYMENT_METHOD_LABEL[m]}
                          </button>
                        ))}
                        <button onClick={() => setPickingPay(null)} className="text-stone-500 text-xs px-2">ביטול</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {reg.payment_status !== 'paid' && (
                          <button
                            onClick={() => setPickingPay(reg.id)}
                            disabled={busy === reg.id}
                            className="bg-lime-400 text-stone-950 font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                          >
                            סמן כשולם
                          </button>
                        )}
                        {reg.payment_status !== 'pending' && (
                          <button
                            onClick={() => setStatus(reg, 'pending')}
                            disabled={busy === reg.id}
                            className="border border-stone-700 text-stone-400 px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                          >
                            {busy === reg.id ? 'מעדכן…' : 'סמן כממתין'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
