import type { Metadata } from 'next'

// Own PWA identity for the rider portal: on iPhone, Safari → Share → "Add to
// Home Screen" from /student gives the "טבע בייק" rider app (activities,
// registration, attendance) rather than the coordinator manifest from
// app/manifest.ts. Same pattern as app/interval/layout.tsx.
export const metadata: Metadata = {
  title: 'טבע בייק — אפליקציית רוכבים',
  manifest: '/student-manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'טבע בייק',
  },
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return children
}
