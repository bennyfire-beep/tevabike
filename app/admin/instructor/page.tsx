'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import RiderForm from '@/components/RiderForm'
import { resolveGroupId, groupRiderIds } from '@/lib/rider-groups'
import { clearAdminSession } from '@/lib/auth-actions'
import { today as localToday, monthLabel as fmtMonth } from '@/lib/month'
import { rowForRole } from '@/lib/roles'

// ─────────────────────────────────────────────────────────────────────────────
// Instructor screen — for a SIGNED-IN instructor.
//
// There is no "who is teaching today?" name picker any more, here or anywhere
// else — it was retired deliberately, not moved. The instructor is identified
// by their login: admin_roles.user_id = auth.uid(). Everything below assumes a
// signed-in user and the page redirects to /admin/login when there isn't one.
//
// Mobile-first, big thumb-friendly targets, purple / black / pink branding,
// built to WCAG 2.1: real <button> elements for keyboard nav, aria labels /
// aria-pressed on toggles, text+icon (not colour alone) to convey state, and
// high-contrast colours on the dark background.
//
// Three tabs:
//
//   אימונים        — today's sessions first (mine, then everyone else's,
//                    because instructors cover for each other), then my usual
//                    groups, then every group in the club across all branches.
//                    Picking any of them opens the register; a group with no
//                    session today gets one opened for it server-side.
//   התלמידים שלי   — the riders of the groups I teach.
//   המשכורת שלי    — this month's pay, mine only.
//
// The last two, plus opening a register, are served by service-role routes that
// resolve the instructor from the access token rather than from anything this
// page sends — see lib/instructor-identity.ts. RLS on staff_pay stays shut: no
// instructor can read another instructor's pay, and there is no request shape
// that would return it.
//
// "➕ חניך חדש" is RiderForm's existing contract, unchanged: the rider is saved
// with payment_status='unpaid', a lead is opened in "מתעניינים", and Tal gets
// the email — see /api/staff-lead.
//
// Instructors on the per_km travel arrangement also report where they travelled
// from and how far, once for the day. Neither their arrangement nor their rate
// is readable with the anon key, so that card is driven by two service-role
// routes (travel-status / travel-save) which return the instructor's own km and
// nothing else off staff_pay.
//
// House rule, learned the hard way: no `!` non-null assertions in components.
// Under reactCompiler they turn a null into a white screen instead of a
// harmless empty render. Read the value into a local and check it.
// ─────────────────────────────────────────────────────────────────────────────

// Brand palette
const C = {
  bg:        '#0d0b10',
  surface:   '#1a1320',
  surface2:  '#241a2e',
  border:    '#3a2f47',
  purple:    '#a855f7',
  purpleSoft:'#c4b5fd',
  pink:      '#ec4899',
  pinkSoft:  '#f9a8d4',
  text:      '#f5f3f7',
  muted:     '#b6a7c9',
  present:   '#4ade80',
  absent:    '#f87171',
  unpaid:    '#f0b90b',
}
const FONT = 'Heebo, Arial, sans-serif'

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

// The signed-in instructor's own staff row.
type Account = { id: string; name: string; branch: string | null; role: string }

type Session = {
  id: string
  class_name: string
  branch: string
  session_date: string
  instructor_id: string | null
  group_id: string | null
  start_time: string | null
  duration: number | null
  type: 'regular' | 'special' | null
  instructor_ids: string[] | null
}
type Group = {
  id: string
  name: string
  branch: string | null
  days: string | null
  days_of_week: number[] | null
  start_time: string | null
  level: string | null
}
type Rider = {
  id: string
  full_name: string
  phone: string | null
  // 'unpaid' | 'paid' | null. RiderForm stamps 'unpaid' on anyone added in the
  // field; null on riders who predate the column.
  payment_status: string | null
}
type TravelDay = { origin: string; km: number }
type TravelStatus = { is_per_km: boolean; today: TravelDay | null; last: TravelDay | null }

type Tab = 'sessions' | 'students' | 'salary'

type Student = {
  id: string
  name: string
  group: string
  branch: string | null
  parentPhone: string | null
  phone: string | null
}

type PayKind = 'base' | 'regular' | 'special' | 'travel'
type PayItem = {
  key: string
  kind: PayKind
  label: string
  branch: string | null
  date: string | null
  present: number | null
  pay: number
}
type PayReport = {
  month: string
  /** False when this instructor has no staff_pay row — no wage arranged. */
  hasPay: boolean
  items: PayItem[]
  lessonCount: number
  specialCount: number
  workDays: number
  total: number
  payModel: { model: string; flat: number; low: number; high: number; threshold: number }
}

// ── Formatting ──────────────────────────────────────────────────────────────
const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : '')
const fmtMoney = (n: number) => `₪${n.toLocaleString('he-IL')}`
// Noon, so the date can't slide a day when the string is read as UTC.
const fmtDay = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
// Month naming and "what day is it" come from lib/month.ts — the same helpers
// the pay routes and the coordinator report use, so no screen can disagree with
// another about where a month starts or ends.
function groupDays(g: Group): string {
  const dow = g.days_of_week
  if (dow && dow.length > 0) {
    return dow.slice().sort((a, b) => a - b).map(d => DAY_NAMES[d] ?? '').filter(Boolean).join(', ')
  }
  return g.days ?? ''
}

// The token the personal routes authenticate with.
async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token ?? null
}
async function authHeaders(): Promise<Record<string, string> | null> {
  const token = await accessToken()
  return token ? { Authorization: `Bearer ${token}` } : null
}

const PAY_BADGE: Record<PayKind, { text: string; color: string }> = {
  base:    { text: '💼 קבוע',   color: '#f0b90b' },
  travel:  { text: '🚗 נסיעות', color: '#81d4fa' },
  special: { text: '★ מיוחדת',  color: '#c084fc' },
  regular: { text: '',          color: C.muted   },
}

// ── Page chrome ─────────────────────────────────────────────────────────────
// Module level so it stays a stable component type — nesting it inside the page
// would remount the whole subtree on every state change (worse under the React
// Compiler).
function Shell({
  account, onLogout, sub, children,
}: {
  account: Account | null
  onLogout: () => void
  sub?: string
  children: React.ReactNode
}) {
  return (
    <div dir="rtl" style={{ fontFamily: FONT, background: C.bg, minHeight: '100vh', color: C.text }}>
      <header style={{ background: `linear-gradient(90deg, ${C.surface}, ${C.surface2})`, borderBottom: `1px solid ${C.border}`, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22, fontWeight: 900, color: C.purpleSoft }}>🚵 טבע בייק</span>
        <span style={{ background: C.pink, color: '#0d0b10', padding: '4px 12px', borderRadius: 20, fontSize: 14, fontWeight: 800 }}>מדריך</span>
        {account && (
          <button
            onClick={onLogout}
            style={{ marginInlineStart: 'auto', minHeight: 44, background: 'transparent', border: `1px solid ${C.border}`, color: C.purpleSoft, borderRadius: 12, padding: '8px 16px', fontFamily: FONT, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          >
            יציאה
          </button>
        )}
      </header>
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 48px' }}>
        {sub && <p style={{ color: C.muted, fontSize: 15, margin: '0 0 18px' }}>{sub}</p>}
        {children}
      </main>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" style={{ fontFamily: FONT, background: C.bg, minHeight: '100vh', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', fontSize: 16 }}>
      {children}
    </div>
  )
}

// ── Tabs ────────────────────────────────────────────────────────────────────
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'sessions', label: '🗓️ אימונים' },
  { id: 'students', label: '🚵 התלמידים שלי' },
  { id: 'salary',   label: '💰 המשכורת שלי' },
]

function TabBar({ tab, onPick }: { tab: Tab; onPick: (t: Tab) => void }) {
  return (
    <nav aria-label="מסכי המדריך" style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
      {TABS.map(t => {
        const on = t.id === tab
        return (
          <button
            key={t.id}
            onClick={() => onPick(t.id)}
            aria-current={on ? 'page' : undefined}
            style={{
              flex: '1 0 auto', minHeight: 48, whiteSpace: 'nowrap',
              background: on ? C.purple : C.surface,
              color: on ? '#0d0b10' : C.purpleSoft,
              border: `1px solid ${on ? C.purple : C.border}`,
              borderRadius: 14, padding: '0 16px',
              fontFamily: FONT, fontSize: 15, fontWeight: 800, cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        )
      })}
    </nav>
  )
}

// ── One tappable row, shared by the session and group lists ─────────────────
function PickRow({
  title, meta, tag, tagColor, onClick, busy,
}: {
  title: string
  meta: string
  tag?: string
  tagColor?: string
  onClick: () => void
  busy?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{ minHeight: 72, width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: '14px 18px', fontFamily: FONT, cursor: busy ? 'default' : 'pointer', textAlign: 'start', opacity: busy ? 0.6 : 1 }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{title}</span>
          {tag && (
            <span style={{ background: `${tagColor ?? C.purple}22`, color: tagColor ?? C.purpleSoft, borderRadius: 10, padding: '1px 9px', fontSize: 12, fontWeight: 700 }}>
              {tag}
            </span>
          )}
        </span>
        {meta && <span style={{ fontSize: 13.5, color: C.muted }}>{meta}</span>}
      </span>
      <span aria-hidden="true" style={{ color: C.pinkSoft, fontSize: 26, fontWeight: 900 }}>‹</span>
    </button>
  )
}

function ListBlock({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <h2 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 2px', color: C.purpleSoft }}>{title}</h2>
      {hint && <p style={{ color: C.muted, fontSize: 13, margin: '0 0 12px' }}>{hint}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: hint ? 0 : 12 }}>{children}</div>
    </section>
  )
}

// ── "התלמידים שלי" ──────────────────────────────────────────────────────────
function StudentsSection({
  students, loading, error, onRetry,
}: {
  students: Student[] | null
  loading: boolean
  error: string
  onRetry: () => void
}) {
  const list = students ?? []
  const groups: Array<{ name: string; branch: string | null; rows: Student[] }> = []
  for (const s of list) {
    const last = groups[groups.length - 1]
    if (last && last.name === s.group) last.rows.push(s)
    else groups.push({ name: s.group, branch: s.branch, rows: [s] })
  }

  return (
    <section aria-label="התלמידים שלי">
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 4px' }}>התלמידים שלי</h1>
      <p style={{ color: C.muted, fontSize: 15, margin: '0 0 20px' }}>
        {loading ? 'טוען...' : `${list.length} חניכים · ${groups.length} קבוצות`}
      </p>

      {error ? (
        <div style={{ background: C.surface, border: `1px solid ${C.absent}66`, borderRadius: 18, padding: 28, textAlign: 'center' }}>
          <p role="alert" style={{ color: C.absent, fontSize: 16, margin: '0 0 16px' }}>{error}</p>
          <button onClick={onRetry} style={{ minHeight: 48, background: C.surface2, border: `1px solid ${C.border}`, color: C.purpleSoft, borderRadius: 14, padding: '0 22px', fontFamily: FONT, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
            נסה שוב
          </button>
        </div>
      ) : loading ? (
        <p style={{ color: C.muted, textAlign: 'center', padding: 40, fontSize: 16 }}>טוען תלמידים...</p>
      ) : list.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 10 }} aria-hidden="true">🚵</div>
          <p style={{ color: C.muted, fontSize: 17, margin: 0 }}>לא נמצאו חניכים בקבוצות שלך</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {groups.map(g => (
            <div key={g.name} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ background: C.surface2, borderBottom: `1px solid ${C.border}`, padding: '12px 18px', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: C.purpleSoft }}>{g.name}</span>
                {g.branch && <span style={{ fontSize: 13, color: C.muted }}>📍 {g.branch}</span>}
                <span style={{ marginInlineStart: 'auto', fontSize: 13, color: C.muted }}>{g.rows.length} חניכים</span>
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {g.rows.map((s, i) => {
                  const phone = s.parentPhone ?? s.phone
                  return (
                    <li key={s.id + g.name} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 18px', borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
                      <span style={{ flex: 1, minWidth: 140, fontSize: 17, fontWeight: 700, color: C.text }}>{s.name}</span>
                      {phone ? (
                        <a
                          href={`tel:${phone}`}
                          aria-label={`התקשרות להורה של ${s.name}`}
                          style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 6, background: C.surface2, border: `1px solid ${C.border}`, color: C.pinkSoft, borderRadius: 12, padding: '0 14px', fontSize: 15, fontWeight: 700, textDecoration: 'none', direction: 'ltr' }}
                        >
                          <span aria-hidden="true">📞</span>{phone}
                        </a>
                      ) : (
                        <span style={{ fontSize: 14, color: C.muted }}>אין טלפון הורה</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ── "המשכורת שלי" ───────────────────────────────────────────────────────────
function SalarySection({
  report, loading, error, onRetry,
}: {
  report: PayReport | null
  loading: boolean
  error: string
  onRetry: () => void
}) {
  return (
    <section aria-label="המשכורת שלי">
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 4px' }}>המשכורת שלי</h1>
      <p style={{ color: C.muted, fontSize: 15, margin: '0 0 20px' }}>
        {report ? fmtMonth(report.month) : 'החודש הנוכחי'}
      </p>

      {error ? (
        <div style={{ background: C.surface, border: `1px solid ${C.absent}66`, borderRadius: 18, padding: 28, textAlign: 'center' }}>
          <p role="alert" style={{ color: C.absent, fontSize: 16, margin: '0 0 16px' }}>{error}</p>
          <button onClick={onRetry} style={{ minHeight: 48, background: C.surface2, border: `1px solid ${C.border}`, color: C.purpleSoft, borderRadius: 14, padding: '0 22px', fontFamily: FONT, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
            נסה שוב
          </button>
        </div>
      ) : loading || !report ? (
        <p style={{ color: C.muted, textAlign: 'center', padding: 40, fontSize: 16 }}>טוען שכר...</p>
      ) : !report.hasPay ? (
        // No staff_pay row: no wage was ever arranged for this person. Showing
        // ₪0 would read as "you earned nothing", which is a different and
        // alarming claim.
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: '36px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }} aria-hidden="true">🗒️</div>
          <h2 style={{ fontSize: 19, fontWeight: 900, margin: '0 0 8px' }}>לא מוגדר לך שכר במערכת</h2>
          <p style={{ color: C.muted, fontSize: 15, margin: 0, lineHeight: 1.8 }}>
            {report.lessonCount + report.specialCount > 0
              ? `רשומים לך ${report.lessonCount + report.specialCount} אימונים החודש, אבל אין הסדר שכר מוגדר — דברו עם ההנהלה.`
              : 'אין הסדר שכר מוגדר עבורך. אם זו טעות, דברו עם ההנהלה.'}
          </p>
        </div>
      ) : (
        <>
          <div style={{ background: C.surface, border: `1px solid ${C.purple}`, borderRadius: 20, padding: '24px 20px', textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: C.muted, marginBottom: 6 }}>סה״כ לתשלום החודש</div>
            <div style={{ fontSize: 44, fontWeight: 900, color: C.present, lineHeight: 1.1 }}>{fmtMoney(report.total)}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'שיעורים',   value: report.lessonCount },
              { label: 'מיוחדות',   value: report.specialCount },
              { label: 'ימי עבודה', value: report.workDays },
            ].map(c => (
              <div key={c.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 3 }}>{c.label}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: C.purpleSoft }}>{c.value}</div>
              </div>
            ))}
          </div>

          {report.payModel.model === 'by_attendance' && (
            <p style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 16px', color: C.muted, fontSize: 14, margin: '0 0 20px', lineHeight: 1.7 }}>
              <span aria-hidden="true">ℹ️</span> השכר לשיעור נקבע לפי מספר החניכים שנכחו:
              עד {report.payModel.threshold - 1} נוכחים — {fmtMoney(report.payModel.low)},
              מ־{report.payModel.threshold} ומעלה — {fmtMoney(report.payModel.high)}.
            </p>
          )}

          {report.items.length === 0 ? (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 44, marginBottom: 10 }} aria-hidden="true">💸</div>
              <p style={{ color: C.muted, fontSize: 17, margin: 0 }}>אין עדיין שיעורים החודש</p>
            </div>
          ) : (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, overflow: 'hidden' }}>
              {report.items.map((it, i) => {
                const badge = PAY_BADGE[it.kind]
                return (
                  <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '13px 16px', borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
                    <span style={{ minWidth: 52, fontSize: 13, color: C.muted }}>{it.date ? fmtDay(it.date) : '—'}</span>
                    <span style={{ flex: 1, minWidth: 150, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15.5, fontWeight: 700, color: C.text }}>{it.label}</span>
                      {badge.text
                        ? <span style={{ background: `${badge.color}22`, color: badge.color, borderRadius: 10, padding: '1px 9px', fontSize: 12, fontWeight: 700 }}>{badge.text}</span>
                        : it.branch && <span style={{ fontSize: 12, color: C.muted }}>📍 {it.branch}</span>}
                    </span>
                    <span style={{ fontSize: 17, fontWeight: 900, color: C.present }}>{fmtMoney(it.pay)}</span>
                  </div>
                )
              })}
              <div style={{ display: 'flex', alignItems: 'center', padding: '15px 16px', borderTop: `2px solid ${C.border}`, background: C.surface2 }}>
                <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: C.text }}>סה״כ</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: C.present }}>{fmtMoney(report.total)}</span>
              </div>
            </div>
          )}

          <p style={{ color: C.muted, fontSize: 13, margin: '16px 0 0', lineHeight: 1.7 }}>
            הנתונים מחושבים לפי הדיווחים שנשמרו במערכת. שאלה על השכר? דברו עם ההנהלה.
          </p>
        </>
      )}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function InstructorPage() {
  const router = useRouter()
  const today = localToday()
  const todayLabel = new Date().toLocaleDateString('he-IL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  // ── Who is signed in ──────────────────────────────────────────────────────
  const [account, setAccount] = useState<Account | null>(null)
  const [authState, setAuthState] = useState<'checking' | 'ok' | 'no-role'>('checking')

  const [tab, setTab] = useState<Tab>('sessions')

  // ── Sessions and groups ───────────────────────────────────────────────────
  const [daySessions, setDaySessions] = useState<Session[]>([])
  const [groups, setGroups]           = useState<Group[]>([])
  const [myGroupIds, setMyGroupIds]   = useState<Set<string>>(new Set())
  const [instructorNames, setInstructorNames] = useState<Record<string, string>>({})
  const [loadingBoard, setLoadingBoard] = useState(true)
  const [opening, setOpening]         = useState<string | null>(null)
  const [boardError, setBoardError]   = useState('')

  // ── The open register ─────────────────────────────────────────────────────
  const [session, setSession]             = useState<Session | null>(null)
  const [riders, setRiders]               = useState<Rider[]>([])
  const [attendance, setAttendance]       = useState<Record<string, boolean>>({})
  const [loadingRiders, setLoadingRiders] = useState(false)
  const [saving, setSaving]               = useState(false)
  const [confirmCount, setConfirmCount]   = useState<number | null>(null)
  const [showAddRider, setShowAddRider]   = useState(false)
  const [addedMsg, setAddedMsg]           = useState('')

  // ── Today's travel report — per_km instructors only ───────────────────────
  const [travel,        setTravel]        = useState<TravelStatus | null>(null)
  const [travelOrigin,  setTravelOrigin]  = useState('')
  const [travelKm,      setTravelKm]      = useState('')
  const [travelEditing, setTravelEditing] = useState(false)
  const [travelSaving,  setTravelSaving]  = useState(false)
  const [travelError,   setTravelError]   = useState('')

  // ── The two personal tabs ─────────────────────────────────────────────────
  const [students,        setStudents]        = useState<Student[] | null>(null)
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [studentsError,   setStudentsError]   = useState('')

  const [payReport,  setPayReport]  = useState<PayReport | null>(null)
  const [payLoading, setPayLoading] = useState(false)
  const [payError,   setPayError]   = useState('')

  // ── Identify the instructor ───────────────────────────────────────────────
  // admin_roles.user_id is the link between the Supabase login and the staff
  // row. This read only drives the UI; every API route re-resolves the same
  // link server-side from the access token and trusts nothing sent from here.
  //
  // Specifically the INSTRUCTOR row: admin_roles is one row per job, and Benny
  // is coordinator + instructor. `.maybeSingle()` errored on two rows (so the
  // screen said "not linked to an instructor record" to an actual instructor),
  // and taking whichever row came first would hand the coordinator row's
  // admin_roles.id to the sessions and pay queries — an id that owns neither,
  // so everything would just look empty.
  useEffect(() => {
    let cancelled = false
    async function identify() {
      const { data: { user: supaUser } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!supaUser) { router.replace('/admin/login'); return }

      const { data: rows } = await supabase
        .from('admin_roles')
        .select('id, name, branch, role')
        .eq('user_id', supaUser.id)
      if (cancelled) return

      const rd = rowForRole(rows, 'instructor')
      if (!rd) { setAuthState('no-role'); return }
      setAccount({ id: rd.id, name: rd.name, branch: rd.branch ?? null, role: rd.role })
      setAuthState('ok')
    }
    identify().catch(() => { if (!cancelled) setAuthState('no-role') })
    return () => { cancelled = true }
  }, [router])

  async function logout() {
    await Promise.all([supabase.auth.signOut(), clearAdminSession()])
    router.push('/admin/login')
  }

  // ── The board: today's sessions everywhere + every group + my groups ──────
  useEffect(() => {
    if (!account) return
    let cancelled = false

    async function loadBoard(me: Account) {
      setLoadingBoard(true)
      setBoardError('')

      // Every session today, from every branch — instructors cover for one
      // another, so this is deliberately not filtered to the signed-in one.
      const [sessRes, groupRes, staffRes, mineRes] = await Promise.all([
        supabase
          .from('class_sessions')
          .select('id, class_name, branch, session_date, instructor_id, group_id, start_time, duration, type, instructor_ids')
          .eq('session_date', today)
          .order('start_time', { nullsFirst: true }),
        supabase
          .from('groups')
          .select('id, name, branch, days, days_of_week, start_time, level')
          .eq('is_active', true)
          .order('branch')
          .order('name'),
        supabase
          .from('admin_roles')
          .select('id, name')
          .eq('role', 'instructor'),
        // Which groups are usually mine — used only to float them to the top.
        supabase
          .from('class_sessions')
          .select('group_id')
          .or(`instructor_id.eq.${me.id},instructor_ids.cs.{${me.id}}`)
          .not('group_id', 'is', null),
      ])

      if (cancelled) return

      if (sessRes.error) setBoardError('טעינת האימונים נכשלה')
      setDaySessions((sessRes.data ?? []) as Session[])
      setGroups((groupRes.data ?? []) as Group[])

      const names: Record<string, string> = {}
      for (const s of (staffRes.data ?? []) as Array<{ id: string; name: string }>) names[s.id] = s.name
      setInstructorNames(names)

      const mine = new Set<string>()
      for (const r of (mineRes.data ?? []) as Array<{ group_id: string | null }>) {
        if (r.group_id) mine.add(r.group_id)
      }
      setMyGroupIds(mine)
      setLoadingBoard(false)
    }

    loadBoard(account).catch(() => {
      if (!cancelled) { setBoardError('טעינת האימונים נכשלה'); setLoadingBoard(false) }
    })
    return () => { cancelled = true }
  }, [account, today])

  // ── Travel status ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!account) return
    let cancelled = false
    fetch(`/api/instructor/travel-status?instructor_id=${encodeURIComponent(account.id)}&date=${today}`)
      .then(r => r.json())
      .then((d: TravelStatus) => {
        if (cancelled || !d?.is_per_km) return
        setTravel(d)
        // Prefill from today's report, or the last one filed — most instructors
        // leave from the same place every week.
        const prefill = d.today ?? d.last
        setTravelOrigin(prefill?.origin ?? '')
        setTravelKm(prefill ? String(prefill.km) : '')
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [account, today])

  // ── Open a register ───────────────────────────────────────────────────────
  const openSession = useCallback(async (s: Session) => {
    setSession(s)
    setConfirmCount(null)
    setRiders([])
    setAttendance({})
    setAddedMsg('')
    setLoadingRiders(true)

    // Special activities aren't group-bound — their participants live in the
    // attendance rows created when the activity was set up.
    if (s.type === 'special') {
      const { data: attData } = await supabase.from('attendance').select('rider_id, present').eq('session_id', s.id)
      const ids = (attData ?? []).map(a => a.rider_id)
      let plist: Rider[] = []
      if (ids.length) {
        const { data } = await supabase.from('riders').select('id, full_name, phone, payment_status').in('id', ids).order('full_name')
        plist = (data ?? []) as Rider[]
      }
      const map: Record<string, boolean> = {}
      for (const a of attData ?? []) map[a.rider_id] = a.present
      for (const r of plist) if (!(r.id in map)) map[r.id] = true
      setRiders(plist)
      setAttendance(map)
      setLoadingRiders(false)
      return
    }

    const groupId = await resolveGroupId(s.group_id, s.class_name, s.branch)
    let list: Rider[] = []
    if (groupId) {
      const ids = await groupRiderIds(groupId)
      if (ids.length) {
        const { data } = await supabase
          .from('riders')
          .select('id, full_name, phone, payment_status')
          .in('id', ids)
          .order('full_name')
        list = (data ?? []) as Rider[]
      }
    } else {
      const { data } = await supabase
        .from('riders')
        .select('id, full_name, phone, payment_status')
        .eq('group_name', s.class_name).eq('branch', s.branch).eq('is_regular', true)
        .order('full_name')
      list = (data ?? []) as Rider[]
    }

    const { data: attData } = await supabase
      .from('attendance')
      .select('rider_id, present')
      .eq('session_id', s.id)

    const map: Record<string, boolean> = {}
    for (const a of attData ?? []) map[a.rider_id] = a.present
    for (const r of list) if (!(r.id in map)) map[r.id] = true
    setRiders(list)
    setAttendance(map)
    setLoadingRiders(false)
  }, [])

  // Picking a group rather than a scheduled session: the server finds today's
  // register for that group or opens one. It never reassigns an existing
  // session's instructor, so covering a lesson can't move anyone's pay.
  const openGroup = useCallback(async (g: Group) => {
    setOpening(g.id)
    setBoardError('')
    try {
      const headers = await authHeaders()
      if (!headers) { setBoardError('החיבור פג — יש להתחבר מחדש'); return }
      const r = await fetch('/api/instructor/open-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ group_id: g.id, date: today }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.session) { setBoardError(d.error ?? 'פתיחת האימון נכשלה'); return }
      const s = d.session as Session
      if (d.created) setDaySessions(prev => [...prev, s])
      openSession(s)
    } catch (e) {
      setBoardError('פתיחת האימון נכשלה: ' + (e as Error).message)
    } finally {
      setOpening(null)
    }
  }, [today, openSession])

  async function save() {
    const s = session
    if (!s || riders.length === 0) return
    setSaving(true)
    // Saved through the service-role route: attendance and its present_count
    // are what the pay reports price the lesson from.
    try {
      const r = await fetch('/api/instructor/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: {
            id: s.id,
            instructor_id: s.instructor_id,
            group_id: s.group_id,
            session_date: s.session_date,
            type: s.type,
            duration: s.duration,
            instructor_ids: s.instructor_ids,
          },
          riders: riders.map(r => ({ id: r.id, full_name: r.full_name })),
          attendance,
        }),
      })
      const d = await r.json()
      if (!r.ok) { alert('שגיאה בשמירה: ' + (d.error ?? r.statusText)); return }
      setConfirmCount(d.presentCount ?? presentCount)
    } catch (e) {
      alert('שגיאה בשמירה: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // One row per instructor per day — saving again corrects today's report.
  async function saveTravelDay() {
    const me = account
    if (!me) return
    const km = Number(travelKm)
    if (!travelOrigin.trim()) { setTravelError('צריך למלא מאיפה הגעת'); return }
    if (travelKm.trim() === '' || !Number.isFinite(km) || km < 0 || km > 1000) {
      setTravelError('מספר ק״מ לא תקין (0–1000)'); return
    }

    setTravelSaving(true)
    setTravelError('')
    try {
      const r = await fetch('/api/instructor/travel-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructor_id: me.id, travel_date: today, origin: travelOrigin.trim(), km }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setTravelError(d.error ?? 'שמירת הנסיעות נכשלה'); return }
      setTravel(t => (t ? { ...t, today: d.saved, last: d.saved } : t))
      setTravelEditing(false)
    } catch (e) {
      setTravelError('שמירת הנסיעות נכשלה: ' + (e as Error).message)
    } finally {
      setTravelSaving(false)
    }
  }

  const loadStudents = useCallback(async () => {
    setStudentsLoading(true)
    setStudentsError('')
    try {
      const headers = await authHeaders()
      if (!headers) { setStudentsError('החיבור פג — יש להתחבר מחדש'); return }
      const r = await fetch('/api/instructor/my-students', { headers })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setStudentsError(d.error ?? 'טעינת התלמידים נכשלה'); return }
      setStudents((d.students ?? []) as Student[])
    } catch (e) {
      setStudentsError('טעינת התלמידים נכשלה: ' + (e as Error).message)
    } finally {
      setStudentsLoading(false)
    }
  }, [])

  const loadSalary = useCallback(async () => {
    setPayLoading(true)
    setPayError('')
    try {
      const headers = await authHeaders()
      if (!headers) { setPayError('החיבור פג — יש להתחבר מחדש'); return }
      const r = await fetch('/api/instructor/my-salary', { headers })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setPayError(d.error ?? 'טעינת השכר נכשלה'); return }
      setPayReport(d as PayReport)
    } catch (e) {
      setPayError('טעינת השכר נכשלה: ' + (e as Error).message)
    } finally {
      setPayLoading(false)
    }
  }, [])

  // Fetch when the tab is first opened rather than from an effect: an effect
  // keyed on "no data yet" would re-fire forever once a request fails.
  const openTab = useCallback((t: Tab) => {
    setTab(t)
    if (t === 'students' && students === null && !studentsLoading) loadStudents()
    if (t === 'salary'   && payReport === null && !payLoading)     loadSalary()
  }, [students, studentsLoading, loadStudents, payReport, payLoading, loadSalary])

  const presentCount = riders.filter(r => attendance[r.id] !== false).length

  // ── 0. Auth gates ─────────────────────────────────────────────────────────
  if (authState === 'checking') return <Centered>טוען...</Centered>

  if (authState === 'no-role' || !account) return (
    <Shell account={null} onLogout={logout}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: '36px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }} aria-hidden="true">🔒</div>
        <h1 style={{ fontSize: 21, fontWeight: 900, margin: '0 0 8px' }}>המשתמש אינו מקושר לרשומת מדריך</h1>
        <p style={{ color: C.muted, fontSize: 15, margin: '0 0 22px', lineHeight: 1.7 }}>
          פנה/י למנהל המערכת כדי לקשר את החשבון שלך לרשומת המדריך.
        </p>
        <a href="/admin/login" style={{ display: 'inline-block', minHeight: 48, background: C.purple, color: '#0d0b10', borderRadius: 14, padding: '13px 26px', fontWeight: 900, fontSize: 16, textDecoration: 'none' }}>
          התחברות מחדש
        </a>
      </div>
    </Shell>
  )

  // ── 1. Save confirmation ──────────────────────────────────────────────────
  if (confirmCount !== null && session) {
    const s = session
    return (
      <Shell account={account} onLogout={logout}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 12 }} aria-hidden="true">✅</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 8px' }}>הנוכחות נשמרה!</h1>
          <p style={{ color: C.muted, fontSize: 17, margin: '0 0 24px' }}>{s.class_name} · {s.branch}</p>
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10, background: C.surface2, border: `1px solid ${C.purple}`, borderRadius: 16, padding: '18px 30px' }}>
            <span style={{ fontSize: 52, fontWeight: 900, color: C.present, lineHeight: 1 }}>{confirmCount}</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: C.text }}>רוכבים נוכחים</span>
          </div>
          <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => openSession(s)}
              style={{ minHeight: 56, background: C.surface2, color: C.purpleSoft, border: `1px solid ${C.border}`, borderRadius: 16, fontFamily: FONT, fontWeight: 800, fontSize: 17, cursor: 'pointer' }}
            >
              ✏️ ערוך שוב את האימון הזה
            </button>
            <button
              onClick={() => { setSession(null); setConfirmCount(null) }}
              style={{ minHeight: 56, background: C.purple, color: '#0d0b10', border: 'none', borderRadius: 16, fontFamily: FONT, fontWeight: 900, fontSize: 18, cursor: 'pointer' }}
            >
              → חזרה לרשימת האימונים
            </button>
          </div>
        </div>
      </Shell>
    )
  }

  // ── 2. Board: pick a session or a group ───────────────────────────────────
  if (!session) {
    const mySessions    = daySessions.filter(s => {
      const ids = [s.instructor_id, ...(s.instructor_ids ?? [])]
      return ids.includes(account.id)
    })
    const otherSessions = daySessions.filter(s => !mySessions.includes(s))
    const myGroups      = groups.filter(g => myGroupIds.has(g.id))
    const otherGroups   = groups.filter(g => !myGroupIds.has(g.id))

    const sessionRow = (s: Session, tag?: string, tagColor?: string) => {
      const lead = s.instructor_id ? instructorNames[s.instructor_id] : undefined
      const meta = [
        s.branch ? `📍 ${s.branch}` : '',
        s.start_time ? `🕒 ${fmtTime(s.start_time)}` : '',
        lead ? `🧑‍🏫 ${lead}` : '',
      ].filter(Boolean).join(' · ')
      return (
        <PickRow key={s.id} title={s.class_name} meta={meta} tag={tag} tagColor={tagColor} onClick={() => openSession(s)} />
      )
    }

    const groupRow = (g: Group, tag?: string, tagColor?: string) => {
      const days = groupDays(g)
      const meta = [
        g.branch ? `📍 ${g.branch}` : '',
        days ? `📅 ${days}` : '',
        g.start_time ? `🕒 ${fmtTime(g.start_time)}` : '',
        g.level ?? '',
      ].filter(Boolean).join(' · ')
      return (
        <PickRow
          key={g.id}
          title={g.name}
          meta={meta}
          tag={tag}
          tagColor={tagColor}
          busy={opening === g.id}
          onClick={() => openGroup(g)}
        />
      )
    }

    return (
      <Shell account={account} onLogout={logout} sub={`שלום ${account.name} 👋 · ${todayLabel}`}>
        <TabBar tab={tab} onPick={openTab} />

        {tab === 'students' && (
          <StudentsSection students={students} loading={studentsLoading} error={studentsError} onRetry={loadStudents} />
        )}

        {tab === 'salary' && (
          <SalarySection report={payReport} loading={payLoading} error={payError} onRetry={loadSalary} />
        )}

        {tab === 'sessions' && (
          <>
            {travel?.is_per_km && (
              <section
                aria-label="דיווח נסיעות היום"
                style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: '16px 18px', marginBottom: 24 }}
              >
                <h2 style={{ fontSize: 19, fontWeight: 900, margin: '0 0 4px' }}>
                  <span aria-hidden="true">🚗</span> נסיעות היום
                </h2>

                {travel.today && !travelEditing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                    <span style={{ flex: 1, minWidth: 170, color: C.present, fontSize: 18, fontWeight: 800 }}>
                      ✓ דווח: {travel.today.km} ק״מ מ־{travel.today.origin}
                    </span>
                    <button
                      onClick={() => {
                        // Read it into a local first — no `!` in a component.
                        const reported = travel.today
                        if (!reported) return
                        setTravelEditing(true)
                        setTravelOrigin(reported.origin)
                        setTravelKm(String(reported.km))
                        setTravelError('')
                      }}
                      style={{ minHeight: 48, background: C.surface2, border: `1px solid ${C.border}`, color: C.purpleSoft, borderRadius: 14, padding: '0 18px', fontFamily: FONT, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}
                    >
                      ✎ עריכה
                    </button>
                  </div>
                ) : (
                  <>
                    <p style={{ color: C.muted, fontSize: 14, margin: '0 0 14px' }}>
                      {travel.last && !travel.today
                        ? 'מולא מראש מהדיווח האחרון שלך — עדכן/י אם נסעת מאיפה שהוא אחר.'
                        : 'דיווח אחד ליום, הלוך-חזור.'}
                    </p>

                    <label htmlFor="travel-origin" style={{ display: 'block', color: C.muted, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                      מאיפה הגעת?
                    </label>
                    <input
                      id="travel-origin"
                      value={travelOrigin}
                      onChange={e => setTravelOrigin(e.target.value)}
                      placeholder="למשל: כרמיאל"
                      style={{ width: '100%', minHeight: 56, boxSizing: 'border-box', background: C.surface2, border: `1px solid ${C.border}`, color: C.text, borderRadius: 14, padding: '0 16px', fontFamily: FONT, fontSize: 18, marginBottom: 14 }}
                    />

                    <label htmlFor="travel-km" style={{ display: 'block', color: C.muted, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                      כמה ק״מ (הלוך-חזור)?
                    </label>
                    <input
                      id="travel-km"
                      value={travelKm}
                      onChange={e => setTravelKm(e.target.value)}
                      type="number" inputMode="decimal" dir="ltr" placeholder="0"
                      style={{ width: '100%', minHeight: 56, boxSizing: 'border-box', background: C.surface2, border: `1px solid ${C.border}`, color: C.text, borderRadius: 14, padding: '0 16px', fontFamily: FONT, fontSize: 18 }}
                    />

                    {travelError && (
                      <p role="alert" style={{ color: C.absent, fontSize: 15, margin: '12px 0 0' }}>{travelError}</p>
                    )}

                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                      <button
                        onClick={saveTravelDay}
                        disabled={travelSaving}
                        style={{ flex: 1, minHeight: 56, background: travelSaving ? C.surface2 : `linear-gradient(90deg, ${C.purple}, ${C.pink})`, color: travelSaving ? C.muted : '#fff', border: 'none', borderRadius: 16, fontFamily: FONT, fontWeight: 900, fontSize: 18, cursor: travelSaving ? 'default' : 'pointer' }}
                      >
                        {travelSaving ? 'שומר...' : '💾 שמור נסיעות'}
                      </button>
                      {travel.today && (
                        <button
                          onClick={() => { setTravelEditing(false); setTravelError('') }}
                          disabled={travelSaving}
                          style={{ minHeight: 56, background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 16, padding: '0 20px', fontFamily: FONT, fontWeight: 800, fontSize: 16, cursor: 'pointer' }}
                        >
                          ביטול
                        </button>
                      )}
                    </div>
                  </>
                )}
              </section>
            )}

            {boardError && (
              <p role="alert" style={{ background: `${C.absent}1f`, border: `1px solid ${C.absent}66`, color: C.absent, borderRadius: 14, padding: '11px 16px', marginBottom: 18, fontSize: 15 }}>
                {boardError}
              </p>
            )}

            {loadingBoard ? (
              <p style={{ color: C.muted, textAlign: 'center', padding: 40, fontSize: 16 }}>טוען אימונים...</p>
            ) : (
              <>
                {mySessions.length > 0 && (
                  <ListBlock title="האימונים שלי היום">
                    {mySessions.map(s => sessionRow(s, 'שלי', C.present))}
                  </ListBlock>
                )}

                {otherSessions.length > 0 && (
                  <ListBlock title="אימונים נוספים היום" hint="מכל הסניפים — אפשר להיכנס ולסמן נוכחות גם כמחליף/ה.">
                    {otherSessions.map(s => sessionRow(s, 'היום', C.pinkSoft))}
                  </ListBlock>
                )}

                {mySessions.length === 0 && otherSessions.length === 0 && (
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 32, textAlign: 'center', marginBottom: 26 }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }} aria-hidden="true">🗓️</div>
                    <p style={{ color: C.muted, fontSize: 16, margin: 0 }}>אין אימונים מתוזמנים היום — אפשר לבחור קבוצה מהרשימה למטה.</p>
                  </div>
                )}

                {myGroups.length > 0 && (
                  <ListBlock title="הקבוצות שלי" hint="בחירת קבוצה פותחת נוכחות לתאריך היום.">
                    {myGroups.map(g => groupRow(g, 'שלי', C.present))}
                  </ListBlock>
                )}

                <ListBlock
                  title={myGroups.length > 0 ? 'כל הקבוצות' : 'הקבוצות של טבע בייק'}
                  hint="כל הסניפים. בחירת קבוצה פותחת נוכחות לתאריך היום."
                >
                  {otherGroups.length === 0 && myGroups.length === 0 ? (
                    <p style={{ color: C.muted, fontSize: 15, margin: 0 }}>לא נמצאו קבוצות פעילות</p>
                  ) : (
                    otherGroups.map(g => groupRow(g))
                  )}
                </ListBlock>
              </>
            )}
          </>
        )}
      </Shell>
    )
  }

  // ── 3. Attendance ─────────────────────────────────────────────────────────
  const openGroupId = session.group_id
  const formGroups = openGroupId
    ? [{ id: openGroupId, name: session.class_name, branch: session.branch }]
    : []

  return (
    <Shell account={account} onLogout={logout}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          onClick={() => setSession(null)}
          aria-label="חזרה לרשימת האימונים"
          style={{ minWidth: 48, minHeight: 48, background: C.surface, border: `1px solid ${C.border}`, color: C.purpleSoft, borderRadius: 14, fontSize: 22, fontWeight: 900, cursor: 'pointer' }}
        >›</button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>{session.class_name}</h1>
          <p style={{ color: C.muted, fontSize: 14, margin: '2px 0 0' }}>
            📍 {session.branch}{session.start_time ? ` · 🕒 ${fmtTime(session.start_time)}` : ''}
          </p>
        </div>
      </div>

      {addedMsg && (
        <div style={{ background: `${C.present}1f`, border: `1px solid ${C.present}66`, color: C.present,
                      borderRadius: 14, padding: '11px 16px', marginBottom: 14, fontSize: 15, lineHeight: 1.6 }}>
          {addedMsg}
        </div>
      )}

      {openGroupId && (
        <button
          onClick={() => setShowAddRider(true)}
          style={{ width: '100%', minHeight: 52, marginBottom: 16, background: C.surface,
                   border: `1px dashed ${C.border}`, color: C.purpleSoft, borderRadius: 16,
                   fontFamily: FONT, fontWeight: 800, fontSize: 16, cursor: 'pointer' }}
        >
          ➕ חניך חדש
        </button>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <span style={{ flex: 1, textAlign: 'center', background: `${C.present}1f`, border: `1px solid ${C.present}66`, color: C.present, borderRadius: 14, padding: '10px 0', fontSize: 17, fontWeight: 800 }}>✔ {presentCount} נוכחים</span>
        <span style={{ flex: 1, textAlign: 'center', background: `${C.absent}1f`, border: `1px solid ${C.absent}66`, color: C.absent, borderRadius: 14, padding: '10px 0', fontSize: 17, fontWeight: 800 }}>✖ {riders.length - presentCount} נעדרים</span>
      </div>

      {loadingRiders ? (
        <p style={{ color: C.muted, textAlign: 'center', padding: 40, fontSize: 16 }}>טוען רוכבים...</p>
      ) : riders.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 40, textAlign: 'center', color: C.muted, fontSize: 16 }}>
          לא נמצאו רוכבים רשומים לקבוצה זו
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {riders.map(r => {
            const present = attendance[r.id] !== false
            // Riders an instructor added in the field are not on the paying
            // roster yet — tinted amber so it's obvious at a glance.
            const unpaid = r.payment_status === 'unpaid'
            return (
              <div
                key={r.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: unpaid ? `${C.unpaid}14` : C.surface, border: `1px solid ${unpaid ? `${C.unpaid}66` : present ? C.border : `${C.absent}66`}`, borderRadius: 16, padding: '12px 14px' }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: present ? C.text : C.muted, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.full_name}</span>
                    {unpaid && (
                      <span style={{ background: `${C.unpaid}26`, color: C.unpaid, borderRadius: 10, padding: '1px 9px', fontSize: 12, fontWeight: 800 }}>
                        טרם שולם
                      </span>
                    )}
                  </span>
                  {r.phone && <span style={{ display: 'block', fontSize: 13, color: C.muted }}>📞 {r.phone}</span>}
                </span>
                <button
                  onClick={() => setAttendance(p => ({ ...p, [r.id]: true }))}
                  aria-label={`סמן ${r.full_name} כנוכח`}
                  aria-pressed={present}
                  style={{ minWidth: 56, minHeight: 56, borderRadius: 14, border: `2px solid ${C.present}`, cursor: 'pointer', fontSize: 24, fontWeight: 900, background: present ? C.present : 'transparent', color: present ? '#0d0b10' : C.present }}
                >✔</button>
                <button
                  onClick={() => setAttendance(p => ({ ...p, [r.id]: false }))}
                  aria-label={`סמן ${r.full_name} כנעדר`}
                  aria-pressed={!present}
                  style={{ minWidth: 56, minHeight: 56, borderRadius: 14, border: `2px solid ${C.absent}`, cursor: 'pointer', fontSize: 24, fontWeight: 900, background: !present ? C.absent : 'transparent', color: !present ? '#0d0b10' : C.absent }}
                >✖</button>
              </div>
            )
          })}
        </div>
      )}

      {riders.length > 0 && (
        <div style={{ position: 'sticky', bottom: 0, marginTop: 20, paddingTop: 12, background: `linear-gradient(180deg, transparent, ${C.bg} 40%)` }}>
          <button
            onClick={save}
            disabled={saving}
            style={{ width: '100%', minHeight: 64, background: saving ? C.surface2 : `linear-gradient(90deg, ${C.purple}, ${C.pink})`, color: saving ? C.muted : '#fff', border: 'none', borderRadius: 18, fontFamily: FONT, fontWeight: 900, fontSize: 20, cursor: saving ? 'default' : 'pointer', boxShadow: saving ? 'none' : '0 6px 20px rgba(168,85,247,0.35)' }}
          >
            {saving ? 'שומר...' : `💾 שמור נוכחות (${presentCount})`}
          </button>
        </div>
      )}

      {/* RiderForm already carries the whole "new rider" contract: the rider is
          saved with payment_status='unpaid', a lead is opened in "מתעניינים"
          via /api/staff-lead, and Tal gets the email. Nothing to add here. */}
      {showAddRider && openGroupId && (
        <RiderForm
          rider={null}
          allowDelete={false}
          defaultGroupId={openGroupId}
          groups={formGroups}
          onClose={() => setShowAddRider(false)}
          onSaved={name => {
            setShowAddRider(false)
            setAddedMsg(`${name} נוסף/ה לקבוצה כ״לא שולם״ — נפתח ליד ב״מתעניינים״ ונשלח מייל לטל.`)
            openSession(session)
            setTimeout(() => setAddedMsg(''), 8000)
          }}
        />
      )}
    </Shell>
  )
}
