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
}

type Message = {
  id: string
  wa_message_id: string | null
  direction: 'inbound' | 'outbound'
  msg_type: string | null
  body: string | null
  status: string | null
  error_detail: string | null
  created_at: string
}

const POLL_MS = 10_000

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

export default function WhatsAppPage() {
  const { user, loading: authLoading } = useAdminAuth('coordinator')

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [convLoading, setConvLoading] = useState(true)
  const [convError, setConvError] = useState('')
  const [search, setSearch] = useState('')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [msgError, setMsgError] = useState('')

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  // Read inside effects without retriggering them on every keystroke elsewhere.
  const selectedIdRef = useRef<string | null>(null)
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

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

  function openConversation(id: string) {
    setSelectedId(id)
    setMsgLoading(true)
    setSendError('')
    fetchMessages(id).finally(() => setMsgLoading(false))
  }

  const selected = conversations.find(c => c.id === selectedId) ?? null
  const windowOpen = selected ? isReplyWindowOpen(selected.last_inbound_at) : false

  async function send() {
    const text = draft.trim()
    if (!text || !selected) return
    setSending(true)
    setSendError('')
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ conversation_id: selected.id, text }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setSendError(d.error ?? 'שליחת ההודעה נכשלה'); return }
      setDraft('')
      await fetchMessages(selected.id)
      await fetchConversations()
    } catch (e) {
      setSendError('שליחת ההודעה נכשלה: ' + (e as Error).message)
    } finally {
      setSending(false)
    }
  }

  if (authLoading) return null
  if (!user) return null

  const q = search.trim().toLowerCase()
  const filtered = q
    ? conversations.filter(c =>
        (c.display_name ?? '').toLowerCase().includes(q) || c.wa_id.includes(q) || formatPhone(c.wa_id).includes(q)
      )
    : conversations

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
        <div className="shrink-0 p-3 border-b border-stone-800">
          <h1 className="text-lg font-bold mb-2">וואטסאפ</h1>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם או מספר..."
            className="w-full px-3 py-2 rounded-lg bg-stone-900 border border-stone-700 text-sm placeholder:text-stone-500"
          />
        </div>

        {convLoading && <p className="p-4 text-stone-400 text-sm">טוען...</p>}
        {convError && <p className="p-4 text-red-400 text-sm">{convError}</p>}
        {!convLoading && filtered.length === 0 && !convError && (
          <p className="p-4 text-stone-400 text-sm">אין עדיין שיחות.</p>
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
            <div className="shrink-0 px-4 py-3 border-b border-stone-800 flex items-center gap-3 bg-stone-950">
              <button onClick={() => setSelectedId(null)} className="md:hidden text-stone-400 px-1">→ חזרה</button>
              <div className="min-w-0">
                <div className="font-bold truncate">{selected.display_name || formatPhone(selected.wa_id)}</div>
                <div className="text-xs text-stone-400">{formatPhone(selected.wa_id)}</div>
              </div>
            </div>

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
                        <span>{formatTime(m.created_at)}</span>
                        {outbound && <StatusTick status={m.status} errorDetail={m.error_detail} />}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {windowOpen ? (
              <div className="shrink-0 p-3 border-t border-stone-800 bg-stone-950">
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
