'use client'

import { useEffect, useRef } from 'react'
import { DESKTOP_QUERY, clipEnd, type HeroClip } from '@/lib/hero-clips'

// Plays the admin-managed hero clips (site_hero_clips) back to back, muted,
// in a loop: each from start_s to end_s, framed with object-position by its
// desktop or phone focus.
//
// Two stacked <video> elements take turns: while one plays, the other has
// the next clip loaded and seeked to its start, so the switch is a short
// cross-fade instead of a loading gap. Driven imperatively (refs and DOM
// listeners) because the switch happens on `timeupdate`, several times a
// second — no React state involved.
//
// `muted` is set on the element before play(): React doesn't render the
// attribute server-side, and iOS Safari only autoplays muted video. Hidden
// for prefers-reduced-motion; the header's own background still shows then.

export default function HeroClips({ clips }: { clips: HeroClip[] }) {
  const aRef = useRef<HTMLVideoElement>(null)
  const bRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const a = aRef.current
    const b = bRef.current
    if (!a || !b || clips.length === 0) return
    const els = [a, b]
    const mq = window.matchMedia(DESKTOP_QUERY)
    const slotClip = [0, 0]
    let front = 0

    const frame = (el: HTMLVideoElement, c: HeroClip) => {
      el.style.objectPosition = `50% ${mq.matches ? c.focus_desktop : c.focus_mobile}%`
    }

    const play = (el: HTMLVideoElement) => {
      el.muted = true
      el.play().catch(() => {
        // autoplay blocked (e.g. low-power mode) — the header background stays up
      })
    }

    // Put clip `idx` into a slot, framed and seeked to its start.
    const load = (slot: number, idx: number) => {
      const el = els[slot]
      const c = clips[idx]
      slotClip[slot] = idx
      frame(el, c)
      el.muted = true
      if (el.dataset.src !== c.url) {
        el.dataset.src = c.url
        el.src = c.url
      }
      const seek = () => {
        el.currentTime = c.start_s
      }
      if (el.readyState >= 1) seek()
      else el.addEventListener('loadedmetadata', seek, { once: true })
    }

    const show = (slot: number) => {
      els[slot].style.opacity = '1'
      els[1 - slot].style.opacity = '0'
    }

    const advance = () => {
      if (clips.length === 1) {
        els[front].currentTime = clips[0].start_s
        play(els[front])
        return
      }
      const old = front
      front = 1 - front
      play(els[front])
      show(front)
      els[old].pause()
      load(old, (slotClip[front] + 1) % clips.length)
    }

    const onTime = (e: Event) => {
      const el = e.target as HTMLVideoElement
      if (el !== els[front]) return
      const end = clipEnd(clips[slotClip[front]], Number.isFinite(el.duration) ? el.duration : undefined)
      if (el.currentTime >= end - 0.08) advance()
    }
    const onEnded = (e: Event) => {
      if (e.target === els[front]) advance()
    }
    const onLayout = () => els.forEach((el, i) => frame(el, clips[slotClip[i]]))

    els.forEach((el) => {
      el.addEventListener('timeupdate', onTime)
      el.addEventListener('ended', onEnded)
    })
    mq.addEventListener('change', onLayout)

    load(0, 0)
    if (clips.length > 1) load(1, 1)
    show(0)
    play(a)

    return () => {
      els.forEach((el) => {
        el.removeEventListener('timeupdate', onTime)
        el.removeEventListener('ended', onEnded)
        el.pause()
      })
      mq.removeEventListener('change', onLayout)
    }
  }, [clips])

  const video = (ref: React.RefObject<HTMLVideoElement | null>) => (
    <video
      ref={ref}
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
      style={{ opacity: 0 }}
    />
  )

  return (
    <div aria-hidden="true" className="absolute inset-0 motion-reduce:hidden">
      {video(aRef)}
      {video(bRef)}
    </div>
  )
}
