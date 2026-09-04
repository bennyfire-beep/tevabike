// app/admin/coordinator/whatsapp/page.tsx — שיחות וואטסאפ של הלקוחות
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAdminAuth } from '@/lib/use-admin-auth'
import { supabase } from '@/lib/supabase'
import { isReplyWindowOpen, WINDOW_CLOSED_MESSAGE, bodyLabel } from '@/lib/whatsapp'

type Conversation = {
  id: string
  wa_id: string
  display_name: string | null
  last_message_at: string | null
  last_inbound_at: string | null
  unread_count: number
  last_message_preview?: string
  assigned_to: string | null
  assigned_at: string | null
}

type Message = {
  id: string
  wa_message_id: string | null
  direction: 'inbound' | 'outbound'
  msg_type: string | null
  body: string | null
  status: string | null
  error_detail: string | null
  sent_by: string | null
  created_at: string
}

type TeamMember = { email: string; name: string; role: string }

type Suggestion = {
  id: string | null
  text: string
  unsure: boolean
  category: string
}

const CATEGORY_LABEL: Record<string, string> = {
  price: 'מחיר',
  dates: 'תאריכים',
  availability: 'מקום פנוי',
  hours: 'שעות פעילות',
  registration_link: 'קישור להרשמה',
  other: 'אחר',
}

const POLL_MS = 10_000
type FilterMode = 'all' | 'mine' | 'unassigned'

/** 972584708084 → 058-470-8084 — the local format used everywhere else on the site. */
function formatPhone(waId: string): string {
  const digits = waId.replace(/[^0-9]/g, '')
  const local = digits.startsWith('972') ? '0' + digits.slice(3) : digits
  const m = local.match(/^(\d{3})(\d{3})(\d{4})$/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : local
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function StatusTick({ status, errorDetail }: { status: string | null; errorDetail: string | null }) {
  if (status === 'failed') {
    return <span title={errorDetail || 'השליחה נכשלה'} className="text-red-400">⚠</span>
  }
  if (status === 'read') return <span className="text-sky-400" title="נקרא">✓✓</span>
  if (status === 'delivered') return <span className="text-stone-400" title="נמסר">✓✓</span>
  if (status === 'sent') return <span className="text-stone-400" title="נשלח">✓</span>
  return null
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token ?? ''
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

/** web-push wants the VAPID key as a Uint8Array, not the base64url string the server hands back. */
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export default function WhatsAppPage() {
  const { user, loading: authLoading } = useAdminAuth('coordinator')
  const isAdmin = user?.role === 'admin'

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [convLoading, setConvLoading] = useState(true)
  const [convError, setConvError] = useState('')
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [msgError, setMsgError] = useState('')

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  // Suggest-only Gemini draft, auto-fetched whenever the open conversation's
  // last message is an unanswered inbound one. Shown as a card with
  // שלח/ערוך/דחה — never sent on its own; see lib/gemini.ts and
  // app/api/whatsapp/suggest for the unsure/category contract.
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [suggestionLoading, setSuggestionLoading] = useState(false)
  const [suggestionError, setSuggestionError] = useState('')
  // The inbound message id the current `suggestion` (or an in-flight fetch)
  // is for — guards against re-asking Gemini on every 10s poll tick when
  // nothing in the conversation actually changed.
  const [suggestionMsgId, setSuggestionMsgId] = useState<string | null>(null)
  // Set by "ערוך" so the next normal שליחה tags its outcome as 'edited'
  // instead of leaving the suggestion undecided.
  const [pendingSuggestion, setPendingSuggestion] = useState<{ id: string; outcome: 'edited' } | null>(null)

  const [team, setTeam] = useState<TeamMember[]>([])
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignError, setAssignError] = useState('')

  // Lazy initializer, not an effect: this only reads static browser/permission
  // state, and setState-in-effect is exactly the "you might not need an
  // effect" case — it just caused an extra render for no reason.
  const [notifStatus, setNotifStatus] = useState<'unsupported' | 'default' | 'denied' | 'granted' | 'subscribing'>(() => {
    if (typeof window === 'undefined') return 'default'
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') return 'unsupported'
    return Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'default'
  })
  const [notifError, setNotifError] = useState('')

  // Read inside effects without retriggering them on every keystroke elsewhere.
  const selectedIdRef = useRef<string | null>(null)
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  // Guards the auto-draft effect further down against re-fetching for a
  // pending message id it has already asked Gemini about.
  const suggestionFetchedForRef = useRef<string | null>(null)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/conversations', { headers: await authHeaders() })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setConvError(d.error ?? 'טעינת השיחות נכשלה'); return }
      setConvError('')
      setConversations(d.conversations ?? [])
    } catch (e) {
      setConvError('טעינת השיחות נכשלה: ' + (e as Error).message)
    } finally {
      setConvLoading(false)
    }
  }, [])

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch(`/api/whatsapp/messages?conversation_id=${conversationId}`, { headers: await authHeaders() })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setMsgError(d.error ?? 'טעינת ההודעות נכשלה'); return }
      setMsgError('')
      setMessages(d.messages ?? [])
      // The server zeroed unread_count for this conversation — reflect it locally
      // so the badge disappears without waiting for the next conversations poll.
      setConversations(prev => prev.map(c => (c.id === conversationId ? { ...c, unread_count: 0 } : c)))
    } catch (e) {
      setMsgError('טעינת ההודעות נכשלה: ' + (e as Error).message)
    }
  }, [])

  function openConversation(id: string) {
    setSelectedId(id)
    setMsgLoading(true)
    setSendError('')
    setAssignError('')
    setSuggestion(null)
    setSuggestionError('')
    setSuggestionMsgId(null)
    setPendingSuggestion(null)
    suggestionFetchedForRef.current = null
    fetchMessages(id).finally(() => setMsgLoading(false))
  }

  const selected = conversations.find(c => c.id === selectedId) ?? null
  const windowOpen = selected ? isReplyWindowOpen(selected.last_inbound_at) : false

  async function fetchSuggestion(conversationId: string, forMessageId?: string) {
    if (forMessageId) {
      setSuggestionMsgId(forMessageId)
      setPendingSuggestion(null)
    }
    setSuggestionLoading(true)
    setSuggestionError('')
    try {
      const res = await fetch('/api/whatsapp/suggest', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ conversation_id: conversationId }),
      })
      const d = await res.json().catch(() => ({}))
      // A newer inbound message may have started its own auto-fetch while
      // this one was in flight (e.g. two customer messages within the same
      // ~10s poll window) — don't let a slower, now-stale response clobber
      // the newer one. Only applies to the auto-fetch path (forMessageId
      // set); "↻ הצע שוב" is a deliberate manual request and always applies.
      if (forMessageId && suggestionFetchedForRef.current !== forMessageId) return
      if (!res.ok) { setSuggestionError(d.error ?? 'הצעת התשובה נכשלה'); setSuggestion(null); return }
      setSuggestion({ id: d.id ?? null, text: d.text ?? '', unsure: !!d.unsure, category: d.category ?? 'other' })
    } catch (e) {
      if (forMessageId && suggestionFetchedForRef.current !== forMessageId) return
      setSuggestionError('הצעת התשובה נכשלה: ' + (e as Error).message)
      setSuggestion(null)
    } finally {
      if (!forMessageId || suggestionFetchedForRef.current === forMessageId) setSuggestionLoading(false)
    }
  }

  // The conversation's newest message, and whether it's an unanswered inbound
  // one — the only case the suggestion card is for. Derived in render (not
  // stored state) so a message that becomes stale (answered, or a new one
  // arrived) hides the old card without any effect needing to clear it.
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null
  const pendingInboundId = windowOpen && lastMessage?.direction === 'inbound' ? lastMessage.id : null

  // Auto-draft: whenever the open conversation's newest message becomes an
  // unanswered inbound one, ask Gemini for a suggestion — guarded by
  // suggestionFetchedForRef (a ref, not state) so this fires once per pending
  // message, not once per 10s poll tick.
  useEffect(() => {
    if (!selectedId || !pendingInboundId || suggestionFetchedForRef.current === pendingInboundId) return
    suggestionFetchedForRef.current = pendingInboundId
    void fetchSuggestion(selectedId, pendingInboundId)
  }, [selectedId, pendingInboundId])

  // Initial load + poll every 10s.
  useEffect(() => {
    if (!user) return
    function tick() {
      void fetchConversations()
      if (selectedIdRef.current) void fetchMessages(selectedIdRef.current)
    }
    tick()
    const id = setInterval(tick, POLL_MS)
    return () => clearInterval(id)
  }, [user, fetchConversations, fetchMessages])

  // The "אחראי/ת" picker's options — only admin needs the full team list.
  useEffect(() => {
    if (!user || !isAdmin) return
    ;(async () => {
      try {
        const res = await fetch('/api/whatsapp/team', { headers: await authHeaders() })
        const d = await res.json().catch(() => ({}))
        if (res.ok) setTeam(d.team ?? [])
      } catch { /* the picker just won't show options; not worth surfacing an error for */ }
    })()
  }, [user, isAdmin])

  // Deep link from a push notification: /admin/coordinator/whatsapp?conversation=<id>.
  // Read directly from the URL rather than useSearchParams, which would force
  // this whole page behind a Suspense boundary for no real benefit here.
  useEffect(() => {
    if (!user || convLoading) return
    const id = new URLSearchParams(window.location.search).get('conversation')
    if (id && conversations.some(c => c.id === id) && selectedIdRef.current !== id) {
      openConversation(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, convLoading, conversations])

  // Register the service worker — a real side effect (not just reading
  // state), so this one stays an effect; notifStatus itself is set above.
  useEffect(() => {
    if (notifStatus === 'unsupported') return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [notifStatus])

  async function enableNotifications() {
    setNotifError('')
    setNotifStatus('subscribing')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setNotifStatus(permission === 'denied' ? 'denied' : 'default')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const keyRes = await fetch('/api/push/public-key')
      const keyData = await keyRes.json().catch(() => ({}))
      if (!keyRes.ok) throw new Error(keyData.error || 'התראות לא מוגדרות בשרת עדיין')

      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyData.publicKey) as BufferSource,
        })
      }
      const subJson = sub.toJSON()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'שמירת המנוי נכשלה')
      setNotifStatus('granted')
    } catch (e) {
      setNotifError((e as Error).message)
      setNotifStatus(Notification.permission === 'granted' ? 'granted' : 'default')
    }
  }

  const myEmail = (user?.email ?? '').toLowerCase()

  async function assign(nextAssignee: string | null) {
    if (!selected) return
    setAssignSaving(true)
    setAssignError('')
    const before = conversations
    setConversations(prev => prev.map(c => (c.id === selected.id ? { ...c, assigned_to: nextAssignee } : c)))
    try {
      const res = await fetch('/api/whatsapp/assign', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ conversation_id: selected.id, assigned_to: nextAssignee }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setConversations(before); setAssignError(d.error ?? 'השיוך נכשל'); return }
      await fetchConversations()
    } catch (e) {
      setConversations(before)
      setAssignError('השיוך נכשל: ' + (e as Error).message)
    } finally {
      setAssignSaving(false)
    }
  }

  async function sendText(text: string, suggestionMeta?: { id: string; outcome: 'sent_as_is' | 'edited' }) {
    const trimmed = text.trim()
    if (!trimmed || !selected) return
    setSending(true)
    setSendError('')
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          conversation_id: selected.id,
          text: trimmed,
          ...(suggestionMeta ? { suggestion_id: suggestionMeta.id, suggestion_outcome: suggestionMeta.outcome } : {}),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setSendError(d.error ?? 'שליחת ההודעה נכשלה'); return }
      setDraft('')
      setSuggestion(null)
      setPendingSuggestion(null)
      await fetchMessages(selected.id)
      await fetchConversations()
    } catch (e) {
      setSendError('שליחת ההודעה נכשלה: ' + (e as Error).message)
    } finally {
      setSending(false)
    }
  }

  /** The composer's own שליחה button — tags the suggestion as 'edited' if "ערוך" opened it here first. */
  async function send() {
    const meta = pendingSuggestion ?? undefined
    await sendText(draft, meta)
  }

  /** The suggestion card's "שלח" — sends the draft text unchanged. */
  async function sendSuggestionAsIs() {
    if (!suggestion || suggestion.unsure || !suggestion.text || !suggestion.id) return
    await sendText(suggestion.text, { id: suggestion.id, outcome: 'sent_as_is' })
  }

  /** The suggestion card's "ערוך" — loads the draft into the composer for free editing before sending. */
  function editSuggestion() {
    if (!suggestion || suggestion.unsure || !suggestion.text) return
    setDraft(suggestion.text)
    setPendingSuggestion(suggestion.id ? { id: suggestion.id, outcome: 'edited' } : null)
  }

  /** The suggestion card's "דחה" — dismissed without sending; just a stage-3 outcome flag. */
  async function rejectSuggestion() {
    if (!suggestion || !suggestion.id) { setSuggestion(null); return }
    const id = suggestion.id
    setSuggestion(null)
    try {
      await fetch('/api/whatsapp/suggestions/reject', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ suggestion_id: id }),
      })
    } catch {
      // Best-effort — losing one outcome row isn't worth surfacing an error for.
    }
  }

  if (authLoading) return null
  if (!user) return null

  const q = search.trim().toLowerCase()
  const bySearch = q
    ? conversations.filter(c =>
        (c.display_name ?? '').toLowerCase().includes(q) || c.wa_id.includes(q) || formatPhone(c.wa_id).includes(q)
      )
    : conversations
  const filtered = bySearch.filter(c => {
    if (filterMode === 'mine') return (c.assigned_to ?? '').toLowerCase() === myEmail
    if (filterMode === 'unassigned') return !c.assigned_to
    return true
  })

  const FILTER_TABS: { key: FilterMode; label: string }[] = [
    { key: 'all', label: 'הכל' },
    { key: 'mine', label: 'שלי' },
    { key: 'unassigned', label: 'לא משויך' },
  ]

  // The two-column box below is pegged to a hard height (viewport minus the
  // coordinator header — a single row since the nav scrolls horizontally
  // rather than wrapping, see layout.tsx), not min-height. Every flex child
  // down to the scrollable panes also needs `min-h-0`: a flex item's default
  // min-height is `auto` (= its content's height), so without it the message
  // list would just grow past the box instead of scrolling internally, the
  // whole page would gain a scrollbar, and the composer would end up below
  // the fold — which was exactly the bug here.
  return (
    <div dir="rtl" className="flex h-[calc(100vh-58px)] min-h-0 text-stone-100">
      {/* ── רשימת שיחות (ימין) ── */}
      <div className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col min-h-0 border-l border-stone-800 bg-stone-950`}>
        <div className="shrink-0 p-3 border-b border-stone-800 space-y-2">
          <h1 className="text-lg font-bold">וואטסאפ</h1>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם או מספר..."
            className="w-full px-3 py-2 rounded-lg bg-stone-900 border border-stone-700 text-sm placeholder:text-stone-500"
          />
          <div className="flex gap-1.5">
            {FILTER_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setFilterMode(t.key)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition ${
                  filterMode === t.key ? 'bg-lime-400 text-stone-950' : 'bg-stone-900 text-stone-400 border border-stone-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {notifStatus !== 'unsupported' && (
            <div className="pt-1">
              {notifStatus === 'granted' ? (
                <p className="text-xs text-lime-400">🔔 התראות פעילות</p>
              ) : notifStatus === 'denied' ? (
                <p className="text-xs text-amber-300">
                  ההתראות חסומות בדפדפן — כדי להפעיל: הגדרות הדפדפן ← הרשאות אתר ← התראות.
                </p>
              ) : (
                <button
                  onClick={enableNotifications}
                  disabled={notifStatus === 'subscribing'}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 border border-stone-600 text-xs font-bold disabled:opacity-50"
                >
                  {notifStatus === 'subscribing' ? 'מפעיל...' : '🔔 הפעל התראות'}
                </button>
              )}
              <p className="text-[11px] text-stone-500 mt-1">
                באייפון: קודם צריך להוסיף את הדף למסך הבית (שיתוף ← הוסף למסך הבית), אחרת התראות לא יעבדו.
              </p>
              {notifError && <p className="text-[11px] text-red-400 mt-1">{notifError}</p>}
            </div>
          )}
        </div>

        {convLoading && <p className="p-4 text-stone-400 text-sm">טוען...</p>}
        {convError && <p className="p-4 text-red-400 text-sm">{convError}</p>}
        {!convLoading && filtered.length === 0 && !convError && (
          <p className="p-4 text-stone-400 text-sm">אין שיחות להצגה.</p>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto">
          {filtered.map(c => {
            const active = c.id === selectedId
            return (
              <button
                key={c.id}
                onClick={() => openConversation(c.id)}
                className={`w-full text-right px-3 py-3 border-b border-stone-900 flex items-center gap-2 transition ${
                  active ? 'bg-stone-800' : 'hover:bg-stone-900'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold truncate">{c.display_name || formatPhone(c.wa_id)}</span>
                    <span className="text-xs text-stone-500 shrink-0">{formatTime(c.last_message_at)}</span>
                  </div>
                  <div className="text-xs text-stone-400 truncate">
                    {c.last_message_preview ? truncate(c.last_message_preview, 40) : formatPhone(c.wa_id)}
                  </div>
                </div>
                {c.unread_count > 0 && (
                  <span className="shrink-0 bg-[#ec4899] text-white rounded-full min-w-[18px] h-[18px] px-1.5 text-[11px] font-extrabold flex items-center justify-center">
                    {c.unread_count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── חלון שיחה ── */}
      <div className={`${selectedId ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-h-0 bg-stone-900`}>
        {!selected && (
          <div className="flex-1 flex items-center justify-center text-stone-500 text-sm">
            בחר/י שיחה מהרשימה
          </div>
        )}

        {selected && (
          <>
            <div className="shrink-0 px-4 py-3 border-b border-stone-800 flex items-center gap-3 bg-stone-950 flex-wrap">
              <button onClick={() => setSelectedId(null)} className="md:hidden text-stone-400 px-1">→ חזרה</button>
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate">{selected.display_name || formatPhone(selected.wa_id)}</div>
                <div className="text-xs text-stone-400">{formatPhone(selected.wa_id)}</div>
              </div>

              {/* אחראי/ת */}
              <div className="flex items-center gap-2 shrink-0">
                {isAdmin ? (
                  <select
                    value={selected.assigned_to ?? ''}
                    onChange={e => assign(e.target.value || null)}
                    disabled={assignSaving}
                    aria-label="אחראי/ת"
                    className="px-2 py-1.5 rounded-lg bg-stone-800 border border-stone-600 text-xs text-stone-100 disabled:opacity-50"
                  >
                    <option value="">לא משויך</option>
                    {team.map(t => (
                      <option key={t.email} value={t.email}>{t.name}</option>
                    ))}
                  </select>
                ) : !selected.assigned_to ? (
                  <button
                    onClick={() => assign(myEmail)}
                    disabled={assignSaving}
                    className="px-3 py-1.5 rounded-lg bg-stone-800 border border-stone-600 text-xs font-bold disabled:opacity-50"
                  >
                    קח שיחה אליי
                  </button>
                ) : (selected.assigned_to ?? '').toLowerCase() === myEmail ? (
                  <button
                    onClick={() => assign(null)}
                    disabled={assignSaving}
                    className="px-3 py-1.5 rounded-lg bg-lime-400/20 text-lime-300 border border-lime-400/50 text-xs font-bold disabled:opacity-50"
                  >
                    משויכת אליי · שחרר
                  </button>
                ) : null}
              </div>
            </div>
            {assignError && <p className="shrink-0 px-4 pt-2 text-red-400 text-xs bg-stone-950">{assignError}</p>}

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
              {msgLoading && <p className="text-stone-400 text-sm">טוען הודעות...</p>}
              {msgError && <p className="text-red-400 text-sm">{msgError}</p>}
              {!msgLoading && messages.length === 0 && !msgError && (
                <p className="text-stone-500 text-sm">אין עדיין הודעות בשיחה הזו.</p>
              )}
              {messages.map(m => {
                const outbound = m.direction === 'outbound'
                return (
                  <div key={m.id} dir="ltr" style={{ display: 'flex', justifyContent: outbound ? 'flex-end' : 'flex-start' }}>
                    <div
                      dir="rtl"
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                        outbound ? 'bg-lime-600/90 text-stone-950' : 'bg-stone-700 text-stone-100'
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">{bodyLabel(m.msg_type, m.body)}</div>
                      <div
                        className={`mt-1 text-[11px] flex items-center gap-1 justify-end ${
                          outbound ? 'text-stone-900/70' : 'text-stone-400'
                        }`}
                      >
                        {outbound && m.sent_by && <span className="font-bold">{m.sent_by} ·</span>}
                        <span>{formatTime(m.created_at)}</span>
                        {outbound && <StatusTick status={m.status} errorDetail={m.error_detail} />}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {windowOpen ? (
              <div className="shrink-0 border-t border-stone-800 bg-stone-950">
                {/* הצעת תשובה — נטענת אוטומטית כשההודעה האחרונה היא מהלקוח וטרם נענתה */}
                {pendingInboundId && pendingInboundId === suggestionMsgId && (suggestionLoading || suggestion || suggestionError) && (
                  <div className="p-3 border-b border-stone-800 bg-stone-900/60">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-stone-400">
                        💡 הצעת תשובה
                        {suggestion && !suggestion.unsure && (
                          <span className="mr-1.5 font-normal text-stone-500">
                            · {CATEGORY_LABEL[suggestion.category] ?? suggestion.category}
                          </span>
                        )}
                      </span>
                      {selected && !suggestionLoading && (
                        <button
                          onClick={() => fetchSuggestion(selected.id)}
                          className="text-[11px] text-stone-500 hover:text-stone-300"
                        >
                          ↻ הצע שוב
                        </button>
                      )}
                    </div>
                    {suggestionLoading && <p className="text-xs text-stone-500">חושב על הצעת תשובה...</p>}
                    {!suggestionLoading && suggestionError && <p className="text-xs text-red-400">{suggestionError}</p>}
                    {!suggestionLoading && !suggestionError && suggestion?.unsure && (
                      <p className="text-xs text-amber-300">אין הצעה בטוחה לתשובה הזו — דורש תשומת לב מלאה.</p>
                    )}
                    {!suggestionLoading && !suggestionError && suggestion && !suggestion.unsure && suggestion.text && (
                      <>
                        <p className="text-sm text-stone-200 whitespace-pre-wrap mb-2">{suggestion.text}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={sendSuggestionAsIs}
                            disabled={sending}
                            className="px-3 py-1.5 rounded-lg bg-lime-400 text-stone-950 font-bold text-xs disabled:opacity-40"
                          >
                            שלח
                          </button>
                          <button
                            onClick={editSuggestion}
                            className="px-3 py-1.5 rounded-lg bg-stone-800 border border-stone-600 text-xs font-bold"
                          >
                            ערוך
                          </button>
                          <button
                            onClick={rejectSuggestion}
                            className="px-3 py-1.5 rounded-lg bg-stone-800 border border-stone-600 text-xs text-stone-400"
                          >
                            דחה
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="p-3">
                  {sendError && <p className="text-red-400 text-xs mb-2">{sendError}</p>}
                  <div className="flex gap-2">
                    <input
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !sending) send() }}
                      placeholder="הקלד/י הודעה..."
                      className="flex-1 px-3 py-2 rounded-lg bg-stone-900 border border-stone-700 text-sm"
                    />
                    <button
                      onClick={send}
                      disabled={sending || !draft.trim()}
                      className="px-4 py-2 rounded-lg bg-lime-400 text-stone-950 font-bold text-sm disabled:opacity-40"
                    >
                      {sending ? 'שולח...' : 'שליחה'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="shrink-0 p-3 border-t border-stone-800 bg-amber-400/15 text-amber-200 text-sm text-center">
                {WINDOW_CLOSED_MESSAGE}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
