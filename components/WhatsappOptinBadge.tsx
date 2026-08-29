'use client'

// Small status badge shown on every coordinator list card/row for a contact
// collected from a public form (leads, registrations, camps, workshops):
// whether they approved WhatsApp marketing messages, and when.

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function WhatsappOptinBadge({
  optedIn,
  optedAt,
}: {
  optedIn: boolean | null
  optedAt: string | null
}) {
  if (!optedIn) {
    return <span style={{ color: '#4a544c', fontSize: 11 }}>לא אישר/ה וואטסאפ</span>
  }
  return (
    <span
      title={optedAt ? `אישר/ה לקבל וואטסאפ · ${fmt(optedAt)}` : 'אישר/ה לקבל וואטסאפ'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: '#1a2114', color: '#b5e853', border: '1px solid #2f4020',
        borderRadius: 10, padding: '2px 9px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
      }}
    >
      💬 וואטסאפ{optedAt ? ` · ${fmt(optedAt)}` : ''}
    </span>
  )
}
