'use client'

import { useEffect, useRef } from 'react'

// Muted looping background video for the /rides intro. A client component
// because React doesn't put the `muted` attribute into server-rendered HTML,
// and iOS Safari only autoplays videos that are muted from the start — so
// it's set on the element directly before asking it to play.
// Hidden for visitors who prefer reduced motion; the poster still shows
// behind it as the header background.

export default function HeroVideo({ mp4, webm, poster }: { mp4: string; webm: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = true
    v.play().catch(() => {
      // autoplay blocked (e.g. low-power mode) — the poster stays up
    })
  }, [])

  return (
    <video
      ref={ref}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      className="absolute inset-0 w-full h-full object-cover motion-reduce:hidden"
    >
      {/* MP4 first — every mainstream browser plays it; WebM only for the few without H.264 */}
      <source src={mp4} type="video/mp4" />
      <source src={webm} type="video/webm" />
    </video>
  )
}
