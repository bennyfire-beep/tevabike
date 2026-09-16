import type { Metadata } from 'next'

// דף פרטי לאימון ההשלמה — לא צריך להופיע בגוגל ולא בניווט של האתר, רק למי
// שמקבל את הקישור הישיר בוואטסאפ.
export const metadata: Metadata = {
  title: 'הרשמה לאימון השלמה — טבע בייק',
  robots: { index: false, follow: false },
}

export default function HashlamaLayout({ children }: { children: React.ReactNode }) {
  return children
}
