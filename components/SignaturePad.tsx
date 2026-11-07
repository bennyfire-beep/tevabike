'use client'

import { useEffect, useRef, useState } from 'react'

// Draw-to-sign box. Calls onChange with a PNG data URL after each stroke, or
// null once cleared. Pointer events cover mouse, touch and stylus alike;
// touch-action:none keeps the page from scrolling while signing on a phone.

export default function SignaturePad({ onChange, color = '#111' }: { onChange: (png: string | null) => void; color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [empty, setEmpty] = useState(true)

  // Size the backing store to the displayed size × device pixel ratio so lines
  // stay sharp; done once on mount (resizing would wipe the drawing).
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    const r = c.getBoundingClientRect()
    c.width = Math.round(r.width * dpr)
    c.height = Math.round(r.height * dpr)
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = color
  }, [color])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = point(e)
    const ctx = e.currentTarget.getContext('2d')!
    ctx.beginPath()
    ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return
    const p = point(e)
    const ctx = e.currentTarget.getContext('2d')!
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
  }

  const up = () => {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    setEmpty(false)
    onChange(canvasRef.current!.toDataURL('image/png'))
  }

  const clear = () => {
    const c = canvasRef.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setEmpty(true)
    onChange(null)
  }

  return (
    <div>
      <div className="relative rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
          className="block w-full h-40 cursor-crosshair"
          style={{ touchAction: 'none' }}
          aria-label="אזור חתימה"
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-stone-400 text-sm">
            חתמו כאן באצבע או בעכבר
          </span>
        )}
      </div>
      <button type="button" onClick={clear} className="mt-2 text-sm text-stone-400 underline">
        ניקוי חתימה
      </button>
    </div>
  )
}
