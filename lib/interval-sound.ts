// Sound + vibration for the interval timer, shared between the group
// "receiver" screen (app/interval/receiver) and the personal solo timer
// (app/interval/personal). Pure client-side — no server, no push — so it
// works the instant a phase changes on whichever screen is open, regardless
// of Web Push / PWA-install status. See app/interval/receiver/page.tsx's
// original comment for the iOS gesture-unlock story; both screens follow it
// the same way (one tap to create/resume the AudioContext).

export function beep(ctx: AudioContext, freq: number, atSeconds: number, durationSeconds: number, gain = 0.4) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  const t0 = ctx.currentTime + atSeconds
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01)
  g.gain.linearRampToValueAtTime(0, t0 + durationSeconds)
  osc.connect(g)
  g.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + durationSeconds + 0.02)
}

/** "תות תות" — short double beep, work starting. */
export function playStartSound(ctx: AudioContext) {
  beep(ctx, 880, 0, 0.14)
  beep(ctx, 880, 0.22, 0.14)
}

/** One long tone — this phase is over, stop / switch to rest. */
export function playStopSound(ctx: AudioContext) {
  beep(ctx, 440, 0, 0.75, 0.45)
}

/** Three rising beeps — the whole workout is done. */
export function playFinishSound(ctx: AudioContext) {
  beep(ctx, 660, 0, 0.16)
  beep(ctx, 880, 0.22, 0.16)
  beep(ctx, 1100, 0.44, 0.3)
}

/** One short confirmation beep — "yes, sound is on", played the moment someone taps to enable it. */
export function playEnabledSound(ctx: AudioContext) {
  beep(ctx, 660, 0, 0.12, 0.35)
}

export function vibrate(pattern: number[]) {
  try { navigator.vibrate?.(pattern) } catch { /* unsupported (all of iOS) — ignore */ }
}

export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${String(ss).padStart(2, '0')}`
}
