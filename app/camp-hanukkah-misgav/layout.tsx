import type { Metadata } from 'next'

// Share preview (WhatsApp / Facebook) for the Misgav Hanukkah camp form — the
// page itself is a client component, so its metadata lives here.
export const metadata: Metadata = {
  title: 'מחנה חנוכה במשגב — הרשמה',
  description:
    'ראשון–שני 6–7.12 · 08:30–13:00 · מועדון טבע בייק. לקבוצות מיני גרביטי ומתחילים, גילאי 10–13. רכיבה ביער, סינגלים חדשים ויום איירבג. 200 ₪ ליום.',
  openGraph: {
    title: 'מחנה חנוכה במשגב 🕎🌲',
    description: '6–7.12 · 08:30–13:00 · רכיבה ביער, סינגלים ואיירבג · 200 ₪ ליום',
    images: [{ url: '/camp-hanukkah-misgav-flyer.jpg', width: 1122, height: 1402 }],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
