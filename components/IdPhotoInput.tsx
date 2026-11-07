'use client'

import { useRef, useState } from 'react'
import { ID_PHOTO_MAX_PX } from '@/lib/rental'

// Required photo of the renter's ID card (app/rent). The phone's photo (often
// 3–8 MB, sometimes HEIC on iPhone) is redrawn on a canvas and sent as a JPEG
// of at most ID_PHOTO_MAX_PX on the long side — small enough for the request,
// sharp enough to read the card. onChange gets the JPEG data URL, or null.

async function shrinkToJpeg(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('decode'))
      el.src = url
    })
    const scale = Math.min(1, ID_PHOTO_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * scale)
    const h = Math.round(img.naturalHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function IdPhotoInput({ value, onChange }: { value: string | null; onChange: (jpeg: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function pick(file: File | undefined) {
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) {
      setError('יש לבחור קובץ תמונה')
      return
    }
    setBusy(true)
    try {
      onChange(await shrinkToJpeg(file))
    } catch {
      onChange(null)
      setError('לא הצלחנו לקרוא את התמונה. נסו לצלם שוב או לבחור תמונה אחרת.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <label className="block text-sm text-stone-400 mb-1.5">צילום תעודת זהות של השוכר * (חובה)</label>
      {value ? (
        <div className="bg-stone-900 rounded-xl p-3 space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="צילום תעודת זהות" className="w-full max-h-56 object-contain rounded-lg bg-white" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#9BCB3C] font-semibold">✓ הצילום נקלט</span>
            <button type="button" className="text-stone-400 underline" onClick={() => inputRef.current?.click()}>
              החלפת צילום
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full border-2 border-dashed border-stone-600 rounded-xl py-6 text-sm font-semibold text-stone-300 disabled:opacity-50"
        >
          {busy ? 'מעבד…' : '📷 צילום או בחירת תמונה של תעודת הזהות'}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <p className="text-xs text-stone-500 mt-1.5">
        הצד עם התמונה והפרטים, כשהכול קריא. הצילום משמש לזיהוי בלבד, נגיש לצוות טבע בייק בלבד ונמחק אחרי סגירת ההשכרה.
      </p>
      {error && <p className="text-sm text-red-300 mt-1.5">{error}</p>}
    </div>
  )
}
