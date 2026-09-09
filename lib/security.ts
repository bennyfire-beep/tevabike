import crypto from 'crypto'

/**
 * Constant-time string comparison — use for access codes, tokens, and any
 * other secret being checked against user input. A plain `===`/`!==` leaks
 * how many leading characters matched through response-time differences;
 * `crypto.timingSafeEqual` doesn't, but throws on unequal-length buffers,
 * so the length check has to happen first (and itself leaks only "same
 * length or not", which is normal practice for this kind of compare).
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}
