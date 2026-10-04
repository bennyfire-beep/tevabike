'use client'

import { useEffect, useRef } from 'react'

// Muted looping background video for the /rides intro. A client component
// because React doesn't put the `muted` attribute into server-rendered HTML,
// and iOS Safari only autoplays videos that are muted from the start — so
// it's set on the element directly before asking it to play.
// No poster attribute: until the first frame (or for visitors who prefer
// reduced motion, where the video is hidden) the header's own background
// shows through — a still of the matching cut, picked by CSS per breakpoint.
//
// Two cuts of the same loop: the clips were shot upright, so the phone-width
// header uses the portrait cut, while wide screens get a landscape cut where
// each clip's band was chosen by hand (riders' heads, not torsos) — a single
// portrait file centre-cropped on desktop cut the waving rider's head off.

type Cut = { mp4: string; webm: string }

export default function HeroVideo({ portrait, wide }: { portrait: Cut; wide: Cut }) {
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
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      className="absolute inset-0 w-full h-full object-cover motion-reduce:hidden"
    >
      {/* The first matching <source> wins: wide cut from 768px up, portrait
          below. MP4 before WebM in each pair — every mainstream browser plays
          H.264; WebM only for the few without it. */}
      <source src={wide.mp4} type="video/mp4" media="(min-width: 768px)" />
      <source src={wide.webm} type="video/webm" media="(min-width: 768px)" />
      <source src={portrait.mp4} type="video/mp4" />
      <source src={portrait.webm} type="video/webm" />
    </video>
  )
}
