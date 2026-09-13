import type { Metadata } from 'next'

// דף פרטי ליום ההקפצות — לא צריך להופיע בגוגל ולא בניווט של האתר, רק למי
// שמקבל את הקישור הישיר בוואטסאפ.
export const metadata: Metadata = {
  title: 'הרשמה ליום הקפצות — טבע בייק',
  robots: { index: false, follow: false },
}

export default function HakpatzotLayout({ children }: { children: React.ReactNode }) {
  return children
}
