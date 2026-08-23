'use client'
// registrations/page.tsx — v2: admin_notes (הערות צוות) editable field added to each card

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const BRANCHES = ['משגב', 'ביריה', 'מטה אשר', 'פרוד-אמירים', 'אחר']

const PLAN_LABEL: Record<string, string> = {
  center: 'מרכז בלבד · ₪300',
  yomoadon: 'יומועדון בלבד · ₪360',
  combined: 'משולב · ₪640',
}

type Registration = {
  id: string
  created_at: string
  child_name: string | null
  child_age: number | null
  full_name: string
  phone: string
  email: string | null
  branch: string | null
  city: string | null
  class_type: string | null
  notes: string | null
  admin_notes: string | null
  status: string
  group_name: string | null
  arbox_sent_at: string | null
  membership_plan: string | null
  promo_code: string | null
  registration_type: string | null
}

type Group = {
  id: string
  name: string
  branch: string
  type: string | null
  days: string | null
  arbox_link: string | null
  is_active: boolean
}

export default function RegistrationsPage() {
  const [regs, setRegs] = useState<Registration[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pending' | 'approved'>('pending')
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [r, g] = await Promise.all([
      supabase.from('registrations').select('*').order('created_at', { ascending: false }),
      supabase.from('groups').select('*').eq('is_active', true).order('branch'),
    ])
    setRegs((r.data as Registration[]) || [])
    setGroups((g.data as Group[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function saveAdminNotes(reg: Registration, value: string) {
    const trimmed = value.trim()
    if ((reg.admin_notes ?? '') === trimmed) return
    const { error } = await supabase
      .from('registrations')
      .update({ admin_notes: trimmed || null })
      .eq('id', reg.id)
    if (error) { alert(error.message); return }
    setRegs((prev) => prev.map((r) => (r.id === reg.id ? { ...r, admin_notes: trimmed || null } : r)))
    setSavedNoteId(reg.id)
    setTimeout(() => setSavedNoteId((id) => (id === reg.id ? null : id)), 1500)
  }

  async function approve(reg: Registration) {
    const groupId = picked[reg.id]
    if (!groupId) {
      setMsg('בחר קבוצה לפני האישור')
      return
    }
    const group = groups.find((g) => g.id === groupId)
    if (group && !group.arbox_link) {
      if (!confirm(`לקבוצה "${group.name}" אין קישור Arbox. לאשר בלי לשלוח קישור תשלום?`)) return
    }

    setBusy(reg.id)
    setMsg('')
    try {
      const res = await fetch('/api/registrations/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_id: reg.id, group_id: groupId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'האישור נכשל')

      setMsg(
        data.email_sent
          ? `${reg.child_name || reg.full_name} שובץ ל${data.group_name} · הזמנת Arbox נשלחה למייל`
          : `${reg.child_name || reg.full_name} שובץ ל${data.group_name} · לא נשלח מייל (אין אימייל או אין קישור Arbox)`
      )

      if (data.whatsapp_url) window.open(data.whatsapp_url, '_blank')
      await load()
    } catch (e: any) {
      setMsg(e.message)
    } finally {
      setBusy(null)
    }
  }

  async function reject(reg: Registration) {
    if (!confirm(`לסמן את ההרשמה של ${reg.child_name || reg.full_name} כסגורה?`)) return
    await supabase.from('registrations').update({ status: 'closed' }).eq('id', reg.id)
    await load()
  }

  const shown = regs.filter((r) => (tab === 'pending' ? r.status === 'pending' : r.status !== 'pending'))

  // מסלול יומועדון בלבד → מציגים את קבוצת יומועדון; אחרת לפי סניף
  function groupsFor(reg: Registration) {
    if (reg.membership_plan === 'yomoadon') return groups.filter((g) => g.branch === 'כללי')
    const known = reg.branch && groups.some((g) => g.branch === reg.branch)
    return known ? groups.filter((g) => g.branch === reg.branch || g.branch === 'כללי') : groups
  }

  return (
    <div dir="rtl" className="min-h-screen bg-stone-950 text-stone-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">הרשמות</h1>
            <p className="text-stone-400 text-sm">שיבוץ לקבוצה ושליחת הזמנה ל-Arbox</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="bg-lime-400 text-stone-950 font-semibold px-4 py-2 rounded-lg text-sm">
            {showAdd ? 'סגור' : '➕ נרשם חדש'}
          </button>
        </header>

        {showAdd && <ManualAdd onDone={() => { setShowAdd(false); load() }} />}

        <div className="flex gap-2 mb-5">
          {(['pending', 'approved'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm ${tab === t ? 'bg-lime-400 text-stone-950 font-semibold' : 'bg-stone-900 text-stone-400'}`}
            >
              {t === 'pending'
                ? `ממתינים (${regs.filter((r) => r.status === 'pending').length})`
                : `טופלו (${regs.filter((r) => r.status !== 'pending').length})`}
            </button>
          ))}
        </div>

        {msg && <div className="bg-lime-950 border border-lime-800 text-lime-200 rounded-lg p-3 text-sm mb-4">{msg}</div>}

        {loading ? (
          <p className="text-stone-500">טוען…</p>
        ) : shown.length === 0 ? (
          <div className="border border-dashed border-stone-800 rounded-xl p-10 text-center text-stone-500">
            {tab === 'pending' ? 'אין הרשמות שממתינות לשיבוץ.' : 'עוד לא אושרו הרשמות.'}
          </div>
        ) : (
          <div className="space-y-3">
            {shown.map((reg) => (
              <div key={reg.id} className="bg-stone-900/60 border border-stone-800 rounded-xl p-4">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="font-bold text-lg">
                      {reg.child_name || reg.full_name}{' '}
                      {reg.child_age ? <span className="text-stone-500 text-sm font-normal">· גיל {reg.child_age}</span> : null}
                      {reg.registration_type === 'annual_adults' && (
                        <span className="text-xs bg-stone-800 text-stone-300 px-2 py-0.5 rounded-full mr-2">מבוגרים</span>
                      )}
                    </h3>
                    <p className="text-sm text-stone-400 mt-0.5">
                      {reg.full_name} · <a href={`tel:${reg.phone}`} className="text-lime-400">{reg.phone}</a>
                      {reg.email ? ` · ${reg.email}` : ''}
                    </p>
                    <p className="text-sm text-stone-500 mt-0.5">
                      {reg.city && <span className="text-stone-300">📍 {reg.city}</span>}
                      {reg.city && ' · '}
                      {reg.branch}
                      {reg.class_type ? ` · ${reg.class_type}` : ''}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {reg.membership_plan && (
                        <span className="text-xs bg-lime-950 text-lime-300 border border-lime-800 px-2 py-1 rounded-full">
                          {PLAN_LABEL[reg.membership_plan] || reg.membership_plan}
                        </span>
                      )}
                      {reg.promo_code && (
                        <span className="text-xs bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-800 px-2 py-1 rounded-full">
                          ⚡ 5% הנחה
                        </span>
                      )}
                    </div>
                    {reg.notes && <p className="text-sm text-amber-300/80 mt-2">📝 {reg.notes}</p>}
                  </div>
                  <span className="text-xs text-stone-600 whitespace-nowrap">
                    {new Date(reg.created_at).toLocaleDateString('he-IL')}
                  </span>
                </div>

                {reg.status === 'pending' ? (
                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <select
                      value={picked[reg.id] || ''}
                      onChange={(e) => setPicked({ ...picked, [reg.id]: e.target.value })}
                      className="flex-1 bg-stone-950 border border-stone-700 rounded-lg px-3 py-2.5 text-sm"
                    >
                      <option value="">בחר קבוצה…</option>
                      {groupsFor(reg).map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} · {g.branch}
                          {g.days ? ` · ${g.days}` : ''}
                          {g.arbox_link ? '' : ' (אין קישור Arbox)'}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => approve(reg)}
                      disabled={busy === reg.id}
                      className="bg-lime-400 text-stone-950 font-semibold px-5 py-2.5 rounded-lg text-sm disabled:opacity-50"
                    >
                      {busy === reg.id ? 'מאשר…' : 'אשר ושלח הזמנה'}
                    </button>
                    <button onClick={() => reject(reg)} className="border border-stone-700 text-stone-400 px-4 py-2.5 rounded-lg text-sm">
                      סגור
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t border-stone-800 text-sm text-stone-400">
                    {reg.status === 'approved' ? (
                      <>
                        ✅ שובץ ל<span className="text-stone-200">{reg.group_name}</span>
                        {reg.arbox_sent_at && ' · הזמנת Arbox נשלחה'}
                      </>
                    ) : (
                      <>סגור</>
                    )}
                  </div>
                )}

                <div className="mt-3 relative">
                  <textarea
                    aria-label={`הערות צוות עבור ${reg.child_name || reg.full_name}`}
                    defaultValue={reg.admin_notes ?? ''}
                    placeholder="✏️ הערות צוות…"
                    rows={2}
                    onBlur={(e) => saveAdminNotes(reg, e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-lime-700 rounded-lg px-3 py-2 text-sm text-stone-200 placeholder-stone-600 outline-none resize-y"
                  />
                  {savedNoteId === reg.id && (
                    <span className="absolute -bottom-4 right-1 text-lime-400 text-xs font-semibold">נשמר ✓</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ManualAdd({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({
    child_name: '',
    child_age: '',
    full_name: '',
    phone: '',
    email: '',
    branch: 'משגב',
    city: '',
    membership_plan: '',
    notes: '',
    registration_type: 'kids',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  async function save() {
    if (!f.child_name || !f.full_name || !f.phone) return alert('שם רוכב, שם הורה וטלפון הם חובה')
    setSaving(true)
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(f),
    })
    setSaving(false)
    if (!res.ok) return alert('השמירה נכשלה')
    onDone()
  }

  const cls = 'bg-stone-950 border border-stone-700 rounded-lg px-3 py-2.5 text-sm w-full'

  return (
    <div className="bg-stone-900/60 border border-lime-900 rounded-xl p-4 mb-5 space-y-3">
      <h2 className="text-lime-400 font-semibold text-sm">הוספת נרשם ידנית</h2>
      <div className="grid grid-cols-2 gap-3">
        <input className={cls} placeholder="שם הרוכב *" value={f.child_name} onChange={(e) => set('child_name', e.target.value)} />
        <input className={cls} type="number" placeholder="גיל" value={f.child_age} onChange={(e) => set('child_age', e.target.value)} />
        <input className={cls} placeholder="שם ההורה *" value={f.full_name} onChange={(e) => set('full_name', e.target.value)} />
        <input className={cls} type="tel" placeholder="טלפון *" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        <input className={cls} type="email" placeholder="אימייל" value={f.email} onChange={(e) => set('email', e.target.value)} />
        <input className={cls} placeholder="יישוב" value={f.city} onChange={(e) => set('city', e.target.value)} />
        <select className={cls} value={f.branch} onChange={(e) => set('branch', e.target.value)}>
          {BRANCHES.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select className={cls} value={f.membership_plan} onChange={(e) => set('membership_plan', e.target.value)}>
          <option value="">מסלול…</option>
          <option value="center">מרכז בלבד ₪300</option>
          <option value="yomoadon">יומועדון בלבד ₪360</option>
          <option value="combined">משולב ₪640</option>
        </select>
      </div>
      <input className={cls} placeholder="הערות" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      <button onClick={save} disabled={saving} className="bg-lime-400 text-stone-950 font-semibold px-5 py-2.5 rounded-lg text-sm disabled:opacity-50">
        {saving ? 'שומר…' : 'שמור נרשם'}
      </button>
    </div>
  )
}
