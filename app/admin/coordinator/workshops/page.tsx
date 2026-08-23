// app/admin/coordinator/workshops/page.tsx — מסך נרשמי סדנאות איר באג
'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Reg = {
  id: string
  created_at: string
  workshop_date: string
  full_name: string
  phone: string
  email: string
  age: number | null
  bike_brand: string | null
  notes: string | null
  payment_status: string
  utm_source: string | null
  utm_medium: string | null
}

const DATES = [
  { value: '2026-09-04', label: 'שישי 4.9' },
  { value: '2026-09-11', label: 'שישי 11.9' },
]
const CAPACITY = 16
const DISCOUNT = ['whistle', 'ktm', 'bh']

const BRAND_LABEL: Record<string, string> = {
  whistle: 'Whistle', ktm: 'KTM', bh: 'BH', other: 'אחר',
}

function sourceLabel(s: string | null, m: string | null): string {
  if (!s) return 'ישיר'
  if (s === 'fb') return 'פייסבוק (ממומן)'
  if (s === 'facebook') return 'פייסבוק'
  if (s === 'ig') return m === 'story' ? 'אינסטגרם (סטורי)' : 'אינסטגרם'
  if (s === 'instagram') return 'אינסטגרם'
  if (s === 'whatsapp') return 'וואטסאפ'
  return s
}

export default function WorkshopsAdminPage() {
  const [regs, setRegs] = useState<Reg[]>([])
  const [tab, setTab] = useState('2026-09-04')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data, error } = await supabase
        .from('workshop_registrations')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) setError(error.message)
      else
        setRegs(
          (data || []).filter(
            (r: Reg) =>
              !r.full_name.includes('בדיקה') && !r.full_name.includes('בידקה')
          )
        )
      setLoading(false)
    })()
  }, [])

  const current = useMemo(
    () => regs.filter((r) => r.workshop_date === tab && r.payment_status !== 'cancelled'),
    [regs, tab]
  )
  const paidCount = current.filter((r) => r.payment_status === 'paid').length

  function copyPhones() {
    const phones = current.map((r) => r.phone).join(', ')
    navigator.clipboard.writeText(phones).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div dir="rtl" className="p-6 max-w-5xl mx-auto text-stone-100">
      <h1 className="text-3xl font-bold mb-1">סדנאות איר באג</h1>
      <p className="text-stone-400 mb-6">נרשמים, תשלומים ומקורות הגעה</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {DATES.map((d) => {
          const count = regs.filter(
            (r) => r.workshop_date === d.value && r.payment_status !== 'cancelled'
          ).length
          return (
            <button
              key={d.value}
              onClick={() => setTab(d.value)}
              className={`px-5 py-2.5 rounded-xl font-bold transition border ${
                tab === d.value
                  ? 'bg-lime-400 text-stone-950 border-lime-400'
                  : 'bg-stone-900 text-stone-300 border-stone-700 hover:border-lime-400/50'
              }`}
            >
              {d.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Counter */}
      <div className="bg-stone-900 border border-stone-700 rounded-xl p-4 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="font-bold text-lg">
            {current.length} מתוך {CAPACITY} מקומות
          </span>
          <span className="text-stone-400 text-sm">
            💰 שילמו: {paidCount} ({paidCount * 200} ₪) · ממתינים: {current.length - paidCount}
          </span>
        </div>
        <div className="h-3 bg-stone-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-lime-400 transition-all"
            style={{ width: `${Math.min(100, (current.length / CAPACITY) * 100)}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mb-4">
        <button
          onClick={copyPhones}
          disabled={current.length === 0}
          className="px-4 py-2 rounded-lg bg-stone-800 border border-stone-600 text-sm hover:border-lime-400/60 disabled:opacity-40"
        >
          {copied ? '✓ הועתק!' : '📋 העתק רשימת טלפונים'}
        </button>
      </div>

      {loading && <p className="text-stone-400">טוען...</p>}
      {error && <p className="text-red-400">שגיאה: {error}</p>}
      {!loading && current.length === 0 && (
        <p className="text-stone-400">אין עדיין נרשמים לתאריך הזה.</p>
      )}

      {/* Registrant cards */}
      <div className="space-y-3">
        {current.map((r, i) => {
          const discount = r.bike_brand && DISCOUNT.includes(r.bike_brand)
          const paid = r.payment_status === 'paid'
          return (
            <div
              key={r.id}
              className="bg-stone-900 border border-stone-700 rounded-xl p-4 flex flex-wrap gap-3 items-center justify-between"
            >
              <div className="min-w-0">
                <div className="font-bold text-lg">
                  {i + 1}. {r.full_name}
                  {r.age ? <span className="text-stone-400 font-normal text-sm"> · גיל {r.age}</span> : null}
                </div>
                <div className="text-sm text-stone-300 flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  <a
                    href={`https://wa.me/972${r.phone.replace(/^0/, '').replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-lime-400 hover:underline"
                  >
                    📱 {r.phone}
                  </a>
                  <a href={`mailto:${r.email}`} className="text-stone-300 hover:underline">
                    ✉️ {r.email}
                  </a>
                </div>
                <div className="text-xs text-stone-500 mt-1">
                  מקור: {sourceLabel(r.utm_source, r.utm_medium)} · נרשם:{' '}
                  {new Date(r.created_at).toLocaleDateString('he-IL')}
                  {r.notes ? ` · 📝 ${r.notes}` : ''}
                </div>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                {r.bike_brand && (
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      discount
                        ? 'bg-fuchsia-900/60 text-fuchsia-200 border border-fuchsia-500/40'
                        : 'bg-stone-800 text-stone-400 border border-stone-600'
                    }`}
                  >
                    {BRAND_LABEL[r.bike_brand] ?? r.bike_brand}
                    {discount ? ' · 10% הנחה' : ''}
                  </span>
                )}
                <span
                  className={`px-3 py-1 rounded-full text-sm font-bold ${
                    paid
                      ? 'bg-lime-400/20 text-lime-300 border border-lime-400/50'
                      : 'bg-amber-400/15 text-amber-300 border border-amber-400/40'
                  }`}
                >
                  {paid ? '✓ שולם' : '⏳ ממתין לתשלום'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
