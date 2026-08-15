'use client'
// app/admin/coordinator/gemini/page.tsx — Teva Bike Gemini AI file analysis page (v1)
import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const PRESETS: { label: string; prompt: string }[] = [
  { label: 'תיאור כללי', prompt: 'תאר את הקובץ בעברית בצורה ברורה ומסודרת.' },
  { label: 'ניתוח טכניקת רכיבה', prompt: 'אתה מאמן MTB מקצועי. נתח את טכניקת הרכיבה בסרטון: מיקום גוף, בלימה, שימוש בברכיים ומרפקים, מבט, מעברי משקל. תן 3 נקודות חוזק ו-3 נקודות לשיפור עם הסבר קצר. כתוב בעברית.' },
  { label: 'סיכום מסמך', prompt: 'סכם את המסמך בעברית ב-5-8 נקודות עיקריות.' },
  { label: 'טקסט מתמונה', prompt: 'העתק את כל הטקסט שמופיע בתמונה במדויק, שמור על סדר ומבנה.' },
]

export default function GeminiPage() {
  const [file, setFile] = useState<File | null>(null)
  const [prompt, setPrompt] = useState(PRESETS[0].prompt)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  async function run() {
    if (!file) { setError('בחר קובץ קודם'); return }
    setError(''); setResult(''); setLoading(true); setElapsed(0)
    const t0 = Date.now()
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 500)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('לא מחובר — התחבר מחדש')
      const fd = new FormData()
      fd.append('file', file)
      fd.append('prompt', prompt)
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'שגיאה')
      setResult(json.text || '(אין טקסט)')
    } catch (e: any) {
      setError(e.message)
    } finally {
      clearInterval(timer)
      setLoading(false)
    }
  }

  const sizeMB = file ? (file.size / 1024 / 1024).toFixed(1) : ''

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 20px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#e8efe9', margin: '0 0 4px' }}>
        ניתוח קבצים <span style={{ color: '#b5e853' }}>AI</span>
      </h1>
      <p style={{ color: '#7a8f7d', fontSize: 13, margin: '0 0 22px' }}>
        תמונה, סרטון, PDF או טקסט → Gemini מנתח ומחזיר תשובה בעברית.
      </p>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setFile(f) }}
        style={{
          border: `2px dashed ${file ? '#b5e853' : '#2f3833'}`, borderRadius: 14, padding: '26px 18px',
          textAlign: 'center', cursor: 'pointer', background: '#141716', transition: 'border-color .15s',
        }}
      >
        <input ref={inputRef} type="file" hidden accept="image/*,video/*,application/pdf,text/*"
          onChange={e => setFile(e.target.files?.[0] || null)} />
        {file ? (
          <div>
            <div style={{ color: '#e8efe9', fontWeight: 700, fontSize: 15 }}>{file.name}</div>
            <div style={{ color: '#7a8f7d', fontSize: 12, marginTop: 4 }}>{file.type || 'לא ידוע'} · {sizeMB} MB</div>
          </div>
        ) : (
          <div style={{ color: '#7a8f7d', fontSize: 14 }}>לחץ לבחירת קובץ או גרור לכאן</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '16px 0 8px' }}>
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => setPrompt(p.prompt)} style={{
            background: prompt === p.prompt ? '#b5e85322' : '#1c211e',
            color: prompt === p.prompt ? '#b5e853' : '#a9b8ac',
            border: `1px solid ${prompt === p.prompt ? '#b5e85366' : '#252b27'}`,
            borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{p.label}</button>
        ))}
      </div>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} style={{
        width: '100%', boxSizing: 'border-box', background: '#141716', color: '#e8efe9', border: '1px solid #252b27',
        borderRadius: 10, padding: 12, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', direction: 'rtl',
      }} />

      <button onClick={run} disabled={loading || !file} style={{
        marginTop: 12, background: loading || !file ? '#2f3833' : '#b5e853', color: loading || !file ? '#7a8f7d' : '#0d0f0e',
        border: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 15, fontWeight: 800, cursor: loading || !file ? 'not-allowed' : 'pointer',
      }}>
        {loading ? `מנתח… ${elapsed}s` : 'נתח עם Gemini'}
      </button>

      {error && (
        <div style={{ marginTop: 14, background: '#3a1a1a', color: '#ff8080', border: '1px solid #ff4f4f44', borderRadius: 10, padding: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 18, background: '#141716', border: '1px solid #252b27', borderRadius: 12, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ color: '#b5e853', fontWeight: 700, fontSize: 13 }}>תוצאה</span>
            <button onClick={() => navigator.clipboard.writeText(result)} style={{
              background: 'transparent', color: '#7a8f7d', border: '1px solid #252b27', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
            }}>העתק</button>
          </div>
          <div style={{ color: '#e8efe9', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', direction: 'rtl' }}>{result}</div>
        </div>
      )}
    </div>
  )
}
