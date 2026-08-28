import type { MetadataRoute } from 'next'

// Next's manifest file convention — auto-served at /manifest.webmanifest and
// auto-linked into every page's <head>, no manual <link rel="manifest"> needed.
// Scoped to the coordinator WhatsApp screen for now (start_url below): that's
// the only screen this is built for so far.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'טבע בייק — רכז',
    short_name: 'טבע בייק',
    description: 'ניהול שיחות ווטסאפ עם לקוחות טבע בייק',
    start_url: '/admin/coordinator/whatsapp',
    scope: '/admin/coordinator',
    display: 'standalone',
    dir: 'rtl',
    lang: 'he',
    background_color: '#0d0f0e',
    theme_color: '#0d0f0e',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
