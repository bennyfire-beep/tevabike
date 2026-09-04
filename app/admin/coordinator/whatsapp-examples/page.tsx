'use client'
// whatsapp-examples/page.tsx — דוגמאות שאלה→תשובה אמיתיות שמלמדות את Gemini
// את הסגנון שלנו (ראה lib/whatsapp-reply-examples.ts + app/api/whatsapp/suggest).
// לא עובדות/מחירים — אלה נשארים ב-lib/whatsapp-knowledge.ts.
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCoordinator } from '@/lib/coordinator-context'

type Example = {
  id: string
  question_text: string
  answer_text: string
  category: string | null
  active: boolean
  created_at: string
}

const EMPTY_FORM = { question_text: '', answer_text: '', category: '' }

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' })

export default function WhatsappExamplesPage() {
  const user = useCoordinator()
  const [examples, setExamples] = useState<Example[]>([])
  const [loading, setLoading] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('whatsapp_reply_examples')
      .select('id, question_text, answer_text, category, active, created_at')
      .order('created_at', { ascending: false })
    setExamples((data ?? []) as Example[])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) return
    ;(async () => { await load() })()
  }, [user, load])

  async function addExample() {
    const question_text = form.question_text.trim()
    const answer_text = form.answer_text.trim()
    if (!question_text || !answer_text) { setAddError('שאלה ותשובה הן שדות חובה'); return }

    setSaving(true)
    setAddError('')
    const { data, error } = await supabase
      .from('whatsapp_reply_examples')
      .insert({
        question_text,
        answer_text,
        category: form.category.trim() || null,
      })
      .select('id, question_text, answer_text, category, active, created_at')
      .single()

    if (error) { setAddError(error.message); setSaving(false); return }
    setExamples(prev => [data as Example, ...prev])
    setSaving(false)
    setShowAddModal(false)
    setForm(EMPTY_FORM)
  }

  async function setActive(example: Example, active: boolean) {
    setBusyId(example.id)
    const { error } = await supabase.from('whatsapp_reply_examples').update({ active }).eq('id', example.id)
    if (error) { alert(error.message); setBusyId(null); return }
    setExamples(prev => prev.map(e => (e.id === example.id ? { ...e, active } : e)))
    setBusyId(null)
  }

  if (!user) return null

  const visible = examples.filter(e => showInactive || e.active)

  const modalInputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: '#0d0f0e', border: '1px solid #252b27',
    borderRadius: 8, color: '#e8efe9', fontFamily: 'Heebo, Arial, sans-serif', fontSize: 13,
    padding: '8px 10px', outline: 'none',
  }

  return (
    <div style={{ padding: 24, maxWidth: 950, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800 }}>דוגמאות סגנון לתשובות וואטסאפ</h2>
          <p style={{ color: '#7a8f7d', fontSize: 13, margin: 0 }}>
            {loading ? 'טוען...' : `${visible.length} דוגמאות`} — משמשות את מנוע ההצעה (💡 הצע תשובה) ללמידת הסגנון שלנו, לא לעובדות/מחירים.
          </p>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setForm(EMPTY_FORM); setAddError(''); setShowAddModal(true) }}
            style={{
              background: '#b5e853', color: '#0d0f0e', border: 'none', borderRadius: 8,
              padding: '7px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'Heebo, Arial, sans-serif',
              cursor: 'pointer',
            }}
          >
            ➕ הוסף דוגמה
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e8efe9', fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              style={{ width: 15, height: 15, accentColor: '#b5e853', cursor: 'pointer' }}
            />
            הצג גם מושבתות
          </label>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#7a8f7d' }}>טוען...</div>
      ) : visible.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#7a8f7d', background: '#141716', border: '1px solid #252b27', borderRadius: 12 }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>💬</div>
          אין עדיין דוגמאות. לחצו על &quot;➕ הוסף דוגמה&quot; כדי להתחיל.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map(e => (
            <div
              key={e.id}
              style={{
                background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: 16,
                opacity: e.active ? 1 : 0.55,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: '#7a8f7d', fontSize: 11 }}>{fmtDate(e.created_at)}</span>
                  {e.category && (
                    <span style={{ background: '#1a2637', color: '#81d4fa', borderRadius: 10, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>
                      {e.category}
                    </span>
                  )}
                  {!e.active && (
                    <span style={{ background: '#3a1a1a', color: '#ff8f6b', borderRadius: 10, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>
                      מושבת
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setActive(e, !e.active)}
                  disabled={busyId === e.id}
                  style={{
                    background: 'transparent', border: '1px solid #252b27', borderRadius: 8,
                    color: e.active ? '#ff8f6b' : '#b5e853', padding: '5px 12px', fontSize: 12,
                    fontFamily: 'Heebo, Arial, sans-serif', fontWeight: 700, cursor: 'pointer',
                    opacity: busyId === e.id ? 0.5 : 1, flexShrink: 0,
                  }}
                >
                  {busyId === e.id ? '...' : e.active ? 'השבת' : 'הפעל מחדש'}
                </button>
              </div>
              <div style={{ fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#7a8f7d', fontWeight: 700 }}>לקוח: </span>
                {e.question_text}
              </div>
              <div style={{ fontSize: 13 }}>
                <span style={{ color: '#b5e853', fontWeight: 700 }}>טבע בייק: </span>
                {e.answer_text}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* מודאל: הוספת דוגמה */}
      {showAddModal && (
        <div
          onClick={() => !saving && setShowAddModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: 22, width: '100%', maxWidth: 480 }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 800 }}>➕ הוספת דוגמה</h3>

            <label style={{ display: 'block', fontSize: 12, color: '#7a8f7d', marginBottom: 4 }}>שאלת הלקוח *</label>
            <textarea
              value={form.question_text}
              onChange={e => setForm(v => ({ ...v, question_text: e.target.value }))}
              rows={2}
              style={{ ...modalInputStyle, resize: 'vertical' }}
            />

            <label style={{ display: 'block', fontSize: 12, color: '#7a8f7d', margin: '12px 0 4px' }}>התשובה שלנו *</label>
            <textarea
              value={form.answer_text}
              onChange={e => setForm(v => ({ ...v, answer_text: e.target.value }))}
              rows={4}
              style={{ ...modalInputStyle, resize: 'vertical' }}
            />

            <label style={{ display: 'block', fontSize: 12, color: '#7a8f7d', margin: '12px 0 4px' }}>קטגוריה (אופציונלי)</label>
            <input
              value={form.category}
              onChange={e => setForm(v => ({ ...v, category: e.target.value }))}
              placeholder="למשל: ביטולים, מחירים, לוגיסטיקה..."
              style={modalInputStyle}
            />

            {addError && <p style={{ color: '#ff8f6b', fontSize: 12, margin: '10px 0 0' }}>{addError}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                onClick={addExample}
                disabled={saving}
                style={{ flex: 1, background: '#b5e853', color: '#0d0f0e', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 700, fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'שומר...' : 'שמירה'}
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                disabled={saving}
                style={{ background: 'transparent', color: '#7a8f7d', border: '1px solid #252b27', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontFamily: 'Heebo, Arial, sans-serif', cursor: 'pointer' }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
