// Shared WhatsApp marketing opt-in — used by every public form that collects
// a phone number (workshops, camps, youth-group registration, contact) and by
// the coordinator screens that show whether someone approved and when.
//
// The checkbox is optional and unchecked by default everywhere it appears —
// submitting the form without it is a normal, complete registration.

export const WHATSAPP_OPTIN_LABEL =
  'אני מאשר/ת לקבל עדכונים והצעות מטבע בייק בוואטסאפ'

// One value per form that offers the checkbox — stored in
// `whatsapp_optin_source` so the coordinator can tell which funnel a given
// consent came from.
export const WHATSAPP_OPTIN_SOURCES = {
  contact: 'צור קשר',
  youth_registration: 'הרשמה לקבוצות',
  camp_gravity: 'ימי שיא',
  camp_sukkot: 'מחנה סוכות',
  workshop_airbag: 'סדנת איר באג',
} as const

export type WhatsappOptinSource = keyof typeof WHATSAPP_OPTIN_SOURCES

/**
 * Builds the three `whatsapp_optin*` columns for an insert, from the
 * checkbox's checked state at submit time. Kept in one place so the three
 * fields can never drift out of sync (e.g. optin=true but no timestamp).
 */
export function whatsappOptinFields(accepted: boolean, source: WhatsappOptinSource) {
  return accepted
    ? {
        whatsapp_optin: true,
        whatsapp_optin_at: new Date().toISOString(),
        whatsapp_optin_source: source,
      }
    : {
        whatsapp_optin: false,
        whatsapp_optin_at: null,
        whatsapp_optin_source: null,
      }
}
