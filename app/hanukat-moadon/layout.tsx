import type { Metadata } from 'next'

// Share preview (WhatsApp / Facebook) for the club inauguration form — the
// page itself is a client component, so its metadata lives here.
export const metadata: Metadata = {
  title: 'חנוכת מועדון טבע בייק — הרשמה',
  description:
    'יום שישי 4.12 · התכנסות 08:00 באתגר · זינוקים 08:30 · 10:30 כיבוד וחנוכת המועדון ברקפת, עם DJ AB — אמיר בורשטיין. כל קבוצות טבע בייק מוזמנות — ההרשמה חובה!',
  openGraph: {
    title: 'חוגגים חנוכה — חנוכת מועדון טבע בייק 🎉',
    description: 'יום שישי 4.12 · מיני בייק, כיף גדול · DJ AB · הרשמה חובה',
    images: [{ url: '/club-opening-flyer-v2.jpg', width: 1024, height: 1536 }],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
