import type { Metadata } from 'next'

// Own PWA identity for the /interval/* screens (join + receiver): a separate
// manifest, not the root app/manifest.ts (Next only serves one manifest.ts
// special file, scoped to /admin/coordinator today — see that file). This
// `metadata.manifest` override replaces the <link rel="manifest"> tag for
// this whole subtree with public/interval-manifest.webmanifest instead, so a
// participant who "adds to home screen" from /interval/join gets the "טבע
// בייק אינטרוול" app, not the coordinator WhatsApp one.
export const metadata: Metadata = {
  title: 'טבע בייק אינטרוול',
  manifest: '/interval-manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'טבע בייק',
  },
}

export default function IntervalLayout({ children }: { children: React.ReactNode }) {
  return children
}
