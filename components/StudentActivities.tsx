'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ACTIVITY_KIND_META, REGISTRATION_STATUS_LABEL, formatActivityDates, type RiderActivity,
} from '@/lib/activities'

// פעילויות בפורטל החניך: רשימת המחנות/הקפצות/טיולים שפורסמו, כמה מקומות
// נשארו, מי מגיע (רק מי שבחר להציג שם), והרשמה עם אישור הורה.
// הנתונים מגיעים מ-app/api/activities/route.ts.

const PINK = '#D4288A'
const GREEN = '#16A34A'
const ORANGE = '#F97316'
const DARK = '#0C1814'
const MUTED = '#7A8880'
const LINE = '#EAE6E1'

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return session ? { Authorization: `Bearer ${session.access_token}` } : {}
}

export default function StudentActivities({ riderId }: { riderId: string }) {
  const [items, setItems] = useState<RiderActivity[] | null>(null)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const fetchList = useCallback(async (): Promise<{ items?: RiderActivity[]; error?: string }> => {
    try {
      const res = await fetch(`/api/activities?riderId=${encodeURIComponent(riderId)}`, { headers: await authHeaders() })
      const json = await res.json()
      return json.ok ? { items: json.activities } : { error: json.error || 'שגיאה בטעינת הפעילויות' }
    } catch {
      return { error: 'שגיאה בטעינת הפעילויות' }
    }
  }, [riderId])

  const apply = useCallback((r: { items?: RiderActivity[]; error?: string }) => {
    if (r.items) setItems(r.items)
    setError(r.error ?? '')
  }, [])

  const load = useCallback(async () => apply(await fetchList()), [fetchList, apply])

  useEffect(() => {
    let cancelled = false
    fetchList().then((r) => { if (!cancelled) apply(r) })
    return () => { cancelled = true }
  }, [fetchList, apply])

  async function post(payload: Record<string, unknown>): Promise<string | null> {
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ riderId, ...payload }),
      })
      const json = await res.json()
      if (!json.ok) return json.error || 'הפעולה נכשלה'
      await load()
      return null
    } catch {
      return 'הפעולה נכשלה, בדקו את החיבור'
    }
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 900, fontSize: 18, margin: '4px 4px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>🚵</span> פעילויות קרובות
      </div>

      {error && <div style={{ ...cardSt, padding: 16, color: '#DC2626', fontSize: 13, textAlign: 'center' }}>{error}</div>}
      {!items && !error && <div style={{ ...cardSt, padding: 20, color: MUTED, fontSize: 14, textAlign: 'center' }}>טוען פעילויות…</div>}
      {items && items.length === 0 && (
        <div style={{ ...cardSt, padding: 24, color: MUTED, fontSize: 14, textAlign: 'center' }}>
          אין כרגע פעילויות פתוחות. נעדכן כשיעלו חדשות 🙌
        </div>
      )}

      {items?.map((a) => (
        <ActivityCard
          key={a.id}
          a={a}
          open={openId === a.id}
          onToggle={() => setOpenId(openId === a.id ? null : a.id)}
          post={post}
        />
      ))}
    </div>
  )
}

function ActivityCard({ a, open, onToggle, post }: {
  a: RiderActivity
  open: boolean
  onToggle: () => void
  post: (payload: Record<string, unknown>) => Promise<string | null>
}) {
  const meta = ACTIVITY_KIND_META[a.kind]
  const pct = a.capacity ? Math.min(100, Math.round((a.taken / a.capacity) * 100)) : 0
  const barColor = a.remaining === 0 ? '#EF4444' : a.remaining != null && a.remaining <= 3 ? ORANGE : GREEN

  return (
    <div style={{ ...cardSt, overflow: 'hidden', borderColor: a.mine ? `${GREEN}66` : LINE }}>
      <button onClick={onToggle} aria-expanded={open} style={{ all: 'unset', display: 'block', width: '100%', cursor: 'pointer' }}>
        {a.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.image_url} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
        )}
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{meta.icon} {meta.label} · {formatActivityDates(a)}</span>
            {a.mine && <Chip color={a.mine.status === 'paid' ? GREEN : ORANGE}>✓ נרשמת · {REGISTRATION_STATUS_LABEL[a.mine.status]}</Chip>}
            {!a.mine && a.closed && <Chip color="#EF4444">{a.remaining === 0 ? 'מלא' : 'ההרשמה סגורה'}</Chip>}
          </div>
          <div style={{ fontWeight: 800, fontSize: 17, color: DARK }}>{a.title}</div>
          {a.location && <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>📍 {a.location}</div>}

          <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: barColor }}>
            {a.capacity == null
              ? `${a.taken} נרשמו`
              : a.remaining === 0 ? `מלא · ${a.taken} נרשמו` : `נשארו ${a.remaining} מקומות מתוך ${a.capacity}`}
          </div>
          {a.capacity != null && (
            <div style={{ marginTop: 6, background: '#E8E4E0', borderRadius: 99, height: 7, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 99 }} />
            </div>
          )}
        </div>
      </button>

      {open && <ActivityDetails a={a} post={post} />}
    </div>
  )
}

function ActivityDetails({ a, post }: { a: RiderActivity; post: (p: Record<string, unknown>) => Promise<string | null> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(payload: Record<string, unknown>) {
    setBusy(true); setError('')
    const err = await post({ activityId: a.id, ...payload })
    if (err) setError(err)
    setBusy(false)
  }

  return (
    <div style={{ borderTop: `1px solid ${LINE}`, padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {a.description && <div style={{ fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-line', color: DARK }}>{a.description}</div>}
      {a.price != null && a.price > 0 && <div style={{ fontSize: 14, fontWeight: 700 }}>מחיר: ₪{a.price.toLocaleString('he-IL')}</div>}

      {a.show_attendees && a.taken > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>👥 מי מגיע</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {a.attendees.map((n, i) => (
              <span key={i} style={{ background: `${PINK}12`, color: PINK, borderRadius: 20, padding: '4px 11px', fontSize: 13, fontWeight: 700 }}>{n}</span>
            ))}
            {a.hiddenCount > 0 && (
              <span style={{ background: '#F1EEEA', color: MUTED, borderRadius: 20, padding: '4px 11px', fontSize: 13, fontWeight: 600 }}>
                {a.attendees.length ? `ועוד ${a.hiddenCount}` : `${a.hiddenCount} נרשמו`} שבחרו לא להציג שם
              </span>
            )}
          </div>
        </div>
      )}

      {a.mine ? (
        <MyRegistration a={a} busy={busy} run={run} />
      ) : a.closed ? (
        <div style={{ fontSize: 14, color: MUTED, textAlign: 'center' }}>
          {a.remaining === 0 ? 'הפעילות מלאה. לרשימת המתנה התקשרו 052-5708084' : 'ההרשמה לפעילות הזו סגורה'}
        </div>
      ) : (
        <RegisterForm busy={busy} onSubmit={(p) => run({ action: 'register', ...p })} />
      )}

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', color: '#DC2626', fontSize: 13, textAlign: 'center' }}>{error}</div>}
    </div>
  )
}

function MyRegistration({ a, busy, run }: { a: RiderActivity; busy: boolean; run: (p: Record<string, unknown>) => void }) {
  const mine = a.mine!
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: `${GREEN}12`, borderRadius: 12, padding: '12px 14px', fontSize: 14, color: GREEN, fontWeight: 700 }}>
        ✓ את/ה רשום/ה · {REGISTRATION_STATUS_LABEL[mine.status]}
      </div>

      {mine.status === 'pending' && a.pay_url && (
        <a href={a.pay_url} target="_blank" rel="noopener noreferrer" style={{ ...primaryBtn, textDecoration: 'none', textAlign: 'center' }}>
          לתשלום ולאישור המקום ←
        </a>
      )}

      {a.show_attendees && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: busy ? 'default' : 'pointer' }}>
          <input type="checkbox" checked={mine.show_name} disabled={busy}
            onChange={() => run({ action: 'visibility', showName: !mine.show_name })}
            style={{ width: 20, height: 20, accentColor: PINK }} />
          <span>להציג את השם שלי ברשימת המגיעים</span>
        </label>
      )}

      {mine.status === 'pending' && (
        <button disabled={busy} style={ghostBtn}
          onClick={() => { if (confirm(`לבטל את ההרשמה ל"${a.title}"?`)) run({ action: 'cancel' }) }}>
          ביטול הרשמה
        </button>
      )}
    </div>
  )
}

function RegisterForm({ busy, onSubmit }: {
  busy: boolean
  onSubmit: (p: { parentName: string; parentApproved: boolean; showName: boolean; healthNotes: string }) => void
}) {
  const [parentName, setParentName] = useState('')
  const [approved, setApproved] = useState(false)
  const [showName, setShowName] = useState(false)
  const [health, setHealth] = useState('')
  const ready = parentName.trim().length > 1 && approved && !busy

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 800 }}>הרשמה</div>

      <div>
        <label style={labelSt}>שם ההורה המאשר *</label>
        <input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="שם מלא של ההורה" style={inputSt} />
      </div>

      <div>
        <label style={labelSt}>הערות בריאות / מידע חשוב (לא חובה)</label>
        <textarea value={health} onChange={(e) => setHealth(e.target.value)} rows={2} style={{ ...inputSt, resize: 'vertical' }} />
      </div>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, lineHeight: 1.55, cursor: 'pointer' }}>
        <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)}
          style={{ width: 20, height: 20, accentColor: PINK, flexShrink: 0, marginTop: 1 }} />
        <span>
          אני ההורה / האפוטרופוס של הרוכב/ת, מאשר/ת את ההשתתפות בפעילות, מצהיר/ה שהרוכב/ת כשיר/ה להשתתף בה,
          ומתחייב/ת לעדכן את טבע בייק על כל מגבלה רפואית.
        </span>
      </label>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, lineHeight: 1.55, cursor: 'pointer' }}>
        <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)}
          style={{ width: 20, height: 20, accentColor: PINK, flexShrink: 0, marginTop: 1 }} />
        <span>
          להציג את השם שלי (שם פרטי ואות ראשונה של שם המשפחה) לרוכבים אחרים של טבע בייק ברשימת המגיעים.
          אפשר לשנות את זה בכל רגע.
        </span>
      </label>

      <button disabled={!ready} onClick={() => onSubmit({ parentName: parentName.trim(), parentApproved: approved, showName, healthNotes: health })}
        style={{ ...primaryBtn, background: ready ? PINK : '#D1CEC9', boxShadow: ready ? `0 6px 20px ${PINK}44` : 'none', cursor: ready ? 'pointer' : 'default' }}>
        {busy ? 'נרשם…' : 'הרשמה לפעילות ←'}
      </button>
    </div>
  )
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ background: `${color}18`, color, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 800 }}>{children}</span>
}

const cardSt: React.CSSProperties = {
  background: '#fff', borderRadius: 18, marginBottom: 12,
  boxShadow: '0 2px 14px rgba(0,0,0,0.055)', border: `1px solid ${LINE}`,
}
const labelSt: React.CSSProperties = { fontSize: 13, color: MUTED, display: 'block', marginBottom: 6, fontWeight: 600 }
const inputSt: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1.5px solid #E2DDD8', borderRadius: 12,
  padding: '12px 14px', fontSize: 16, fontFamily: 'inherit', outline: 'none', background: '#fff', color: DARK,
}
const primaryBtn: React.CSSProperties = {
  display: 'block', width: '100%', boxSizing: 'border-box', padding: '14px 0', border: 'none', borderRadius: 12,
  background: PINK, color: '#fff', fontFamily: 'inherit', fontWeight: 800, fontSize: 16, cursor: 'pointer',
  boxShadow: `0 6px 20px ${PINK}44`,
}
const ghostBtn: React.CSSProperties = {
  width: '100%', padding: '11px 0', border: '1.5px solid #E2DDD8', borderRadius: 12, background: 'transparent',
  color: MUTED, fontFamily: 'inherit', fontWeight: 600, fontSize: 14, cursor: 'pointer',
}
