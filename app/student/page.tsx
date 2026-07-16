'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { riderGroupIds } from '@/lib/rider-groups'
import { checkRateLimit, resetRateLimit } from '@/lib/auth-actions'

// ─── Brand ────────────────────────────────────────────────────────────────────
const PINK   = '#D4288A'
const GREEN  = '#16A34A'
const ORANGE = '#F97316'
const DARK   = '#0C1814'
const BG     = '#F5F2EE'

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen = 'phone' | 'otp' | 'loading' | 'dashboard' | 'not_found'

type Rider = {
  id: string
  full_name: string
  phone: string
  parent_phone: string | null
  group_name: string | null
  branch: string | null
}

type AttendanceStats = {
  totalSessions: number
  attended: number
  pct: number
  streak: number
  heatmap: Record<string, 'present' | 'absent'>   // YYYY-MM-DD → status
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.startsWith('972')) return `+${d}`
  if (d.startsWith('0'))   return `+972${d.slice(1)}`
  return `+972${d}`
}

function getMotivation(pct: number): { text: string; color: string } {
  if (pct >= 90) return { text: 'מדהים! אתה מנצח! 🏆',           color: GREEN  }
  if (pct >= 80) return { text: 'כל הכבוד! אתה על הגל! 🔥',       color: GREEN  }
  if (pct >= 65) return { text: 'לא רע! עוד קצת ואתה שם 💪',      color: ORANGE }
  if (pct >= 50) return { text: 'בדרך הנכונה, בוא נשפר יחד! 📈',  color: ORANGE }
  return           { text: 'בוא נשפר יחד! 🌱',                    color: PINK   }
}

const MONTHS_HE = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']

// ─── Circular Progress ────────────────────────────────────────────────────────
function CircularProgress({ pct }: { pct: number }) {
  const r     = 46
  const circ  = 2 * Math.PI * r
  const fill  = (pct / 100) * circ
  const color = pct >= 80 ? GREEN : pct >= 60 ? ORANGE : PINK

  return (
    <div style={{ position: 'relative', width: 176, height: 176, margin: '0 auto' }}>
      <svg viewBox="0 0 100 100" width={176} height={176} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx="50" cy="50" r={r} fill="none" stroke="#E8E4E0" strokeWidth="9" />
        {/* Progress */}
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={color} strokeWidth="9"
          strokeDasharray={`${fill.toFixed(1)} ${circ.toFixed(1)}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 2 }}>
        <span style={{ fontSize: 36, fontWeight: 900, color, lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>נוכחות</span>
      </div>
    </div>
  )
}

// ─── Calendar Heatmap ─────────────────────────────────────────────────────────
function CalendarHeatmap({ heatmap }: { heatmap: Record<string, 'present' | 'absent'> }) {
  const today     = new Date()
  const yearStart = new Date(today.getFullYear(), 0, 1)

  // Align grid start to Sunday
  const gridStart = new Date(yearStart)
  gridStart.setDate(gridStart.getDate() - yearStart.getDay())

  // Build weeks array
  const weeks: Date[][] = []
  const cur = new Date(gridStart)
  while (cur <= today) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }

  // Month label positions: track which week each month first appears
  const monthLabels: { wi: number; label: string }[] = []
  let lastMonth = -1
  weeks.forEach((week, wi) => {
    const m = week[0].getMonth()
    if (m !== lastMonth) {
      monthLabels.push({ wi, label: MONTHS_HE[m] })
      lastMonth = m
    }
  })

  const CELL  = 11
  const GAP   = 2
  const STEP  = CELL + GAP
  const totalW = weeks.length * STEP

  const dayLabels = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 6, direction: 'ltr' }}>
      <div style={{ display: 'inline-block', position: 'relative' }}>
        {/* Month labels row */}
        <div style={{ position: 'relative', height: 16, marginBottom: 3, width: totalW + 18 }}>
          {monthLabels.map(({ wi, label }) => (
            <span
              key={`${wi}-${label}`}
              style={{
                position: 'absolute',
                left: 18 + wi * STEP,
                fontSize: 9, color: '#9ca3af', fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Grid */}
        <div style={{ display: 'flex', gap: 0 }}>
          {/* Day-of-week labels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, marginLeft: 0, marginRight: 4, paddingTop: 0 }}>
            {dayLabels.map((d, i) => (
              <div key={i} style={{ width: 12, height: CELL, fontSize: 8, color: '#b0b8b2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d}</div>
            ))}
          </div>

          {/* Weeks */}
          <div style={{ display: 'flex', gap: GAP }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                {week.map((day, di) => {
                  const ds     = day.toISOString().split('T')[0]
                  const status = heatmap[ds]
                  const future = day > today
                  const inYear = day >= yearStart

                  const bg = future || !inYear ? 'transparent'
                    : status === 'present' ? GREEN
                    : status === 'absent'  ? '#EF4444'
                    : '#E2DDD8'

                  return (
                    <div
                      key={di}
                      title={status ? `${ds}: ${status === 'present' ? 'נוכח ✓' : 'נעדר ✗'}` : ds}
                      style={{
                        width: CELL, height: CELL, borderRadius: 2,
                        background: bg,
                        opacity: future || !inYear ? 0 : 1,
                        transition: 'background .15s',
                      }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center', direction: 'rtl' }}>
          {[
            { color: GREEN,    label: 'נוכח'    },
            { color: '#EF4444', label: 'נעדר'   },
            { color: '#E2DDD8', label: 'אין אימון' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#9ca3af' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      aria-pressed={on}
      style={{
        width: 50, height: 28, borderRadius: 14, border: 'none', cursor: disabled ? 'default' : 'pointer',
        background: on ? PINK : '#D1CEC9',
        position: 'relative', flexShrink: 0, transition: 'background .22s', padding: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, width: 22, height: 22, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
        transition: 'transform .22s cubic-bezier(0.4,0,0.2,1)',
        transform: on ? 'translateX(25px)' : 'translateX(3px)',
        left: 0, display: 'block',
      }} />
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StudentPage() {
  const [screen, setScreen]               = useState<Screen>('phone')
  const [phone, setPhone]                 = useState('')
  const [otp, setOtp]                     = useState('')
  const [rider, setRider]                 = useState<Rider | null>(null)
  const [groupLabels, setGroupLabels]     = useState<string[]>([])
  const [stats, setStats]                 = useState<AttendanceStats | null>(null)
  const [privacyHidden, setPrivacyHidden] = useState(false)
  const [error, setError]                 = useState('')
  const [sending, setSending]             = useState(false)
  const [verifying, setVerifying]         = useState(false)
  const [savingPrivacy, setSavingPrivacy] = useState(false)

  // ── Auto-restore session on mount ──────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user?.phone) {
        setScreen('loading')
        await resolveRider(user.phone)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Match auth phone → rider record ────────────────────────────────────────
  const resolveRider = useCallback(async (authPhone: string) => {
    const { data: allRiders } = await supabase.from('riders').select('*')
    const found = allRiders?.find(r =>
      normalizePhone(r.phone) === authPhone ||
      (r.parent_phone && normalizePhone(r.parent_phone) === authPhone)
    ) ?? null

    if (!found) { setScreen('not_found'); return }

    setRider(found)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: settings } = await supabase
        .from('rider_settings')
        .select('privacy_hidden')
        .eq('user_id', user.id)
        .single()
      setPrivacyHidden(settings?.privacy_hidden ?? false)

      // Ensure rider_settings row exists
      await supabase.from('rider_settings').upsert(
        { user_id: user.id, rider_id: found.id, privacy_hidden: settings?.privacy_hidden ?? false },
        { onConflict: 'user_id', ignoreDuplicates: true }
      )
    }

    await loadStats(found)
    setScreen('dashboard')
  }, [])

  // ── Load attendance stats ───────────────────────────────────────────────────
  async function loadStats(r: Rider) {
    const empty: AttendanceStats = { totalSessions: 0, attended: 0, pct: 0, streak: 0, heatmap: {} }

    // Resolve the rider's groups from rider_groups (falling back to the legacy
    // denormalized column while assignments are still being migrated).
    const groupIds = await riderGroupIds(r.id)
    let groups: { name: string; branch: string }[] = []
    if (groupIds.length) {
      const { data: grps } = await supabase.from('groups').select('name, branch').in('id', groupIds)
      groups = (grps ?? []).filter((g): g is { name: string; branch: string } => !!g.name && !!g.branch)
    } else if (r.group_name && r.branch) {
      groups = [{ name: r.group_name, branch: r.branch }]
    }
    setGroupLabels(Array.from(new Set(groups.map(g => g.name))))

    if (groups.length === 0) { setStats(empty); return }

    const yearStart = `${new Date().getFullYear()}-01-01`
    const today     = new Date().toISOString().split('T')[0]

    const names    = Array.from(new Set(groups.map(g => g.name)))
    const branches = Array.from(new Set(groups.map(g => g.branch)))
    const pairSet  = new Set(groups.map(g => `${g.name}||${g.branch}`))

    // Over-fetch by name/branch, then keep only sessions for the rider's exact
    // group pairs (a name can repeat across branches).
    const { data: sessionsRaw } = await supabase
      .from('class_sessions')
      .select('id, session_date, class_name, branch')
      .in('class_name', names)
      .in('branch', branches)
      .gte('session_date', yearStart)
      .lte('session_date', today)
      .order('session_date', { ascending: false })

    const sessions = (sessionsRaw ?? []).filter(s => pairSet.has(`${s.class_name}||${s.branch}`))

    if (!sessions.length) {
      setStats(empty)
      return
    }

    const { data: attRows } = await supabase
      .from('attendance')
      .select('session_id, present')
      .eq('rider_id', r.id)
      .in('session_id', sessions.map(s => s.id))

    const attMap: Record<string, boolean> = {}
    for (const a of attRows ?? []) attMap[a.session_id] = a.present

    const total    = sessions.length
    const attended = sessions.filter(s => attMap[s.id] === true).length
    const pct      = total > 0 ? Math.round((attended / total) * 100) : 0

    // Streak: consecutive attended sessions from most recent
    let streak = 0
    for (const s of sessions) {
      if (attMap[s.id] === true)       streak++
      else if (attMap[s.id] === false) break
      // undefined = not yet recorded → stop streak
      else                             break
    }

    // Heatmap: date → status
    const heatmap: Record<string, 'present' | 'absent'> = {}
    for (const s of sessions) {
      if (attMap[s.id] !== undefined) {
        heatmap[s.session_date] = attMap[s.id] ? 'present' : 'absent'
      }
    }

    setStats({ totalSessions: total, attended, pct, streak, heatmap })
  }

  // ── Auth actions ────────────────────────────────────────────────────────────
  async function handleSendOtp() {
    setError('')
    const norm = normalizePhone(phone)
    if (norm.length < 12) { setError('מספר טלפון לא תקין'); return }
    setSending(true)

    // Rate limit: max 5 OTP requests per phone per hour
    const rl = await checkRateLimit(norm, 'otp')
    if (!rl.allowed) {
      setError(rl.message)
      setSending(false)
      return
    }

    const { error: err } = await supabase.auth.signInWithOtp({ phone: norm })
    if (err) setError('שגיאה בשליחת SMS — ' + err.message)
    else     setScreen('otp')
    setSending(false)
  }

  async function handleVerifyOtp() {
    setError('')
    setVerifying(true)
    const norm = normalizePhone(phone)

    const { data, error: err } = await supabase.auth.verifyOtp({ phone: norm, token: otp, type: 'sms' })
    if (err || !data.user) {
      setError('קוד שגוי — נסה שוב')
      setVerifying(false)
      return
    }

    // Successful verification — reset rate limit counter
    await resetRateLimit(norm, 'otp')
    setScreen('loading')
    await resolveRider(norm)
    setVerifying(false)
  }

  async function handleTogglePrivacy() {
    setSavingPrivacy(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user && rider) {
      const next = !privacyHidden
      const { error: err } = await supabase.from('rider_settings')
        .update({ privacy_hidden: next })
        .eq('user_id', user.id)
      if (!err) setPrivacyHidden(next)
    }
    setSavingPrivacy(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setScreen('phone'); setRider(null); setStats(null); setGroupLabels([])
    setPhone(''); setOtp(''); setError('')
  }

  // ─── Shared styles ─────────────────────────────────────────────────────────
  const inputSt: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    border: '1.5px solid #E2DDD8', borderRadius: 12,
    padding: '14px 16px', fontSize: 16,
    fontFamily: 'inherit', outline: 'none', background: '#fff',
    color: DARK, textAlign: 'center', transition: 'border-color .2s',
  }

  const primaryBtn: React.CSSProperties = {
    width: '100%', padding: '15px 0', border: 'none', borderRadius: 12,
    background: PINK, color: '#fff', fontFamily: 'inherit',
    fontWeight: 800, fontSize: 17, cursor: 'pointer',
    boxShadow: `0 6px 20px ${PINK}44`, transition: 'transform .15s',
  }

  const ghostBtn: React.CSSProperties = {
    width: '100%', padding: '13px 0', border: '1.5px solid #E2DDD8',
    borderRadius: 12, background: 'transparent', color: '#7A8880',
    fontFamily: 'inherit', fontWeight: 600, fontSize: 15, cursor: 'pointer',
  }

  // ─── Screens ───────────────────────────────────────────────────────────────
  const shell = (children: React.ReactNode) => (
    <div dir="rtl" style={{ fontFamily: 'Heebo, Arial, sans-serif', background: BG, minHeight: '100vh', color: DARK }}>
      {children}
    </div>
  )

  // Loading
  if (screen === 'loading') return shell(
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
      <img src="/logo.png" alt="Tev Bike" style={{ height: 50, borderRadius: 8 }} />
      <div style={{ color: '#7A8880', fontSize: 15 }}>מחפש את הנתונים שלך...</div>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${PINK}`, borderTopColor: 'transparent', animation: 'spin 0.9s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  // Not found
  if (screen === 'not_found') return shell(
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '80px 24px 40px', textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 18 }}>🔍</div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 10px' }}>מספר לא נמצא</h2>
      <p style={{ color: '#7A8880', fontSize: 15, lineHeight: 1.7, margin: '0 0 28px' }}>
        המספר הזה לא רשום במערכת.<br />פנה למדריך שלך להוספה.
      </p>
      <button onClick={handleLogout} style={primaryBtn}>חזור ←</button>
    </div>
  )

  // Phone screen
  if (screen === 'phone') return shell(
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '72px 24px 48px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <img src="/logo.png" alt="Tev Bike" style={{ height: 54, borderRadius: 8, marginBottom: 24 }} />
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 6px' }}>פורטל חניך</h1>
        <p style={{ color: '#7A8880', fontSize: 15, margin: 0 }}>הכנס מספר טלפון לקבלת קוד אימות</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 13, color: '#7A8880', display: 'block', marginBottom: 6, fontWeight: 600 }}>מספר טלפון</label>
          <input
            type="tel" inputMode="numeric" placeholder="050-000-0000"
            value={phone} onChange={e => setPhone(e.target.value)}
            onFocus={e  => (e.target as HTMLInputElement).style.borderColor = PINK}
            onBlur={e   => (e.target as HTMLInputElement).style.borderColor = '#E2DDD8'}
            onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
            style={inputSt}
          />
        </div>

        {error && <ErrorBox msg={error} />}

        <button onClick={handleSendOtp} disabled={sending} style={{ ...primaryBtn, background: sending ? '#D1CEC9' : PINK, boxShadow: sending ? 'none' : `0 6px 20px ${PINK}44`, cursor: sending ? 'default' : 'pointer' }}>
          {sending ? 'שולח SMS...' : 'שלח קוד אימות ←'}
        </button>
      </div>

      <p style={{ textAlign: 'center', fontSize: 12, color: '#b0b8b2', marginTop: 28, lineHeight: 1.65 }}>
        נשלח אליך קוד SMS חד-פעמי.<br />אין צורך בסיסמה.
      </p>
    </div>
  )

  // OTP screen
  if (screen === 'otp') return shell(
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '80px 24px 48px' }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: 52, marginBottom: 14 }}>📱</div>
        <h2 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 6px' }}>בדוק את ה-SMS</h2>
        <p style={{ color: '#7A8880', fontSize: 15, margin: 0 }}>שלחנו קוד 6 ספרות ל-{phone}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <input
          type="text" inputMode="numeric" maxLength={6} placeholder="000000"
          value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
          onFocus={e  => (e.target as HTMLInputElement).style.borderColor = PINK}
          onBlur={e   => (e.target as HTMLInputElement).style.borderColor = '#E2DDD8'}
          onKeyDown={e => e.key === 'Enter' && otp.length === 6 && handleVerifyOtp()}
          style={{ ...inputSt, fontSize: 30, letterSpacing: '0.32em', fontWeight: 900 }}
          autoFocus
        />

        {error && <ErrorBox msg={error} />}

        <button
          onClick={handleVerifyOtp}
          disabled={verifying || otp.length < 6}
          style={{ ...primaryBtn, background: (verifying || otp.length < 6) ? '#D1CEC9' : PINK, boxShadow: otp.length === 6 ? `0 6px 20px ${PINK}44` : 'none', cursor: (verifying || otp.length < 6) ? 'default' : 'pointer' }}
        >
          {verifying ? 'מאמת...' : 'אמת קוד ←'}
        </button>

        <button onClick={() => { setScreen('phone'); setError(''); setOtp('') }} style={ghostBtn}>
          ← שינוי מספר
        </button>
      </div>
    </div>
  )

  // Dashboard
  if (screen !== 'dashboard' || !rider || !stats) return null

  const { text: motText, color: motColor } = getMotivation(stats.pct)

  return shell(
    <>
      {/* ── Sticky Header ── */}
      <div style={{ background: DARK, padding: '14px 20px', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
        <div style={{ maxWidth: 500, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="Tev Bike" style={{ height: 34, borderRadius: 6, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {rider.full_name}
            </div>
            {groupLabels.length > 0 && (
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                {groupLabels.join(' · ')}
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, padding: '5px 12px', color: 'rgba(255,255,255,0.5)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
          >
            יציאה
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '20px 16px 80px' }}>

        {/* ── Circular progress + motivation ── */}
        <Card style={{ textAlign: 'center', padding: '32px 24px' }}>
          <CircularProgress pct={stats.pct} />
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: motColor, lineHeight: 1.3 }}>{motText}</div>
            <div style={{ color: '#9ca3af', fontSize: 13, marginTop: 6 }}>
              {stats.attended} מתוך {stats.totalSessions} אימונים השנה
            </div>
          </div>

          {/* Mini progress bar */}
          <div style={{ marginTop: 20, background: '#E8E4E0', borderRadius: 99, height: 8, overflow: 'hidden' }}>
            <div style={{ width: `${stats.pct}%`, height: '100%', background: motColor, borderRadius: 99, transition: 'width 1s ease' }} />
          </div>
        </Card>

        {/* ── Stat cards row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '12px 0' }}>
          {/* Streak */}
          <Card style={{ textAlign: 'center', padding: '20px 16px' }}>
            <div style={{ fontSize: 30, marginBottom: 6 }}>{stats.streak > 0 ? '🔥' : '💤'}</div>
            <div style={{ fontSize: 34, fontWeight: 900, color: stats.streak > 0 ? ORANGE : '#c4bdb5', lineHeight: 1, marginBottom: 4 }}>
              {stats.streak}
            </div>
            <div style={{ fontSize: 12, color: '#7A8880', fontWeight: 600 }}>אימונים ברצף</div>
            {stats.streak >= 5 && (
              <div style={{ marginTop: 8, background: `${ORANGE}18`, color: ORANGE, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, display: 'inline-block' }}>
                🏆 רצף מרשים!
              </div>
            )}
          </Card>

          {/* Attended */}
          <Card style={{ textAlign: 'center', padding: '20px 16px' }}>
            <div style={{ fontSize: 30, marginBottom: 6 }}>📅</div>
            <div style={{ fontSize: 34, fontWeight: 900, color: GREEN, lineHeight: 1, marginBottom: 4 }}>
              {stats.attended}
            </div>
            <div style={{ fontSize: 12, color: '#7A8880', fontWeight: 600 }}>אימונים השנה</div>
            {stats.totalSessions > 0 && (
              <div style={{ marginTop: 8, background: `${GREEN}18`, color: GREEN, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, display: 'inline-block' }}>
                מתוך {stats.totalSessions}
              </div>
            )}
          </Card>
        </div>

        {/* ── Calendar heatmap ── */}
        {Object.keys(stats.heatmap).length > 0 && (
          <Card style={{ padding: '20px 16px' }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📆</span> לוח נוכחות {new Date().getFullYear()}
            </div>
            <CalendarHeatmap heatmap={stats.heatmap} />
          </Card>
        )}

        {stats.totalSessions === 0 && (
          <Card style={{ textAlign: 'center', padding: '32px 24px', color: '#7A8880' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
            <div style={{ fontSize: 15 }}>
              {groupLabels.length > 0
                ? 'אין עדיין אימונים מתועדים השנה'
                : 'לא הוקצה קבוצה — פנה למדריך שלך'}
            </div>
          </Card>
        )}

        {/* ── Privacy toggle ── */}
        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, margin: '0 0 3px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🔒</span> פרטיות
              </div>
              <div style={{ fontSize: 12, color: '#7A8880', lineHeight: 1.55 }}>
                הסתר את הנתונים שלי מהמדריך
              </div>
            </div>
            <Toggle on={privacyHidden} onChange={handleTogglePrivacy} disabled={savingPrivacy} />
          </div>
          {privacyHidden && (
            <div style={{ marginTop: 12, background: `${PINK}10`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: PINK, fontWeight: 600 }}>
              הנתונים שלך מוצגים כאנונימיים בדוחות המדריך
            </div>
          )}
        </Card>

      </div>
    </>
  )
}

// ─── Micro-components ─────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 18, marginBottom: 12,
      boxShadow: '0 2px 14px rgba(0,0,0,0.055)',
      border: '1px solid #EAE6E1',
      ...style,
    }}>
      {children}
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', color: '#DC2626', fontSize: 13, textAlign: 'center' }}>
      {msg}
    </div>
  )
}
