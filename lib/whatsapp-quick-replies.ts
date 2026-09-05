// lib/whatsapp-quick-replies.ts — the "always-on" one-click drafts for the
// coordinator inbox (app/admin/coordinator/whatsapp), one button per category
// that already has automatic handling in suggestWhatsAppReply (see the
// category whitelist history in lib/whatsapp-autoreply.ts).
//
// Deliberately NOT a separate hand-written template per button: each key maps
// to a canned *customer-style question*, fed through the exact same
// suggestWhatsAppReply pipeline (knowledge base + live site content + the
// iron/freshness/formatting/shop-marketing rules) as a real inbound message
// would be — see app/api/whatsapp/quick-reply. That's what keeps a button's
// answer accurate as prices/dates/open items change, instead of drifting out
// of sync with a second hard-coded copy.
//
// A plain data object (no imports) so it's safe to import from the client
// page (app/admin/coordinator/whatsapp/page.tsx) for the button labels, and
// from the server route for the canonical prompt text — one source for both.

export type QuickReplyKey = 'overview' | 'price' | 'dates' | 'hours' | 'registration_link'

export const QUICK_REPLIES: Record<QuickReplyKey, { label: string; prompt: string }> = {
  overview: {
    label: '📋 סקירה כללית',
    prompt: 'היי, מה יש אצלכם? אשמח לסקירה כללית של כל מה שפתוח עכשיו.',
  },
  price: {
    label: '💰 מחירים',
    prompt: 'כמה זה עולה?',
  },
  dates: {
    label: '📅 תאריכים ומקומות פנויים',
    prompt: 'אילו תאריכים קרובים יש, ואיפה יש עדיין מקום פנוי?',
  },
  hours: {
    label: '🕒 שעות פעילות',
    prompt: 'מה שעות הפעילות / מתי האימונים?',
  },
  registration_link: {
    label: '🔗 קישור להרשמה',
    prompt: 'איך נרשמים? אפשר קישור?',
  },
}

export const QUICK_REPLY_KEYS = Object.keys(QUICK_REPLIES) as QuickReplyKey[]
