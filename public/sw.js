// Minimal service worker — just enough to receive Web Push while the app is
// closed and to open the right conversation on tap. No offline caching yet;
// that's a separate concern from "get a phone notification when a WhatsApp
// message comes in", which is all this is for right now.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { /* non-JSON payload, ignore */ }

  const title = data.title || 'טבע בייק'
  const body = data.body || 'הודעה חדשה בווטסאפ'
  const url = data.url || '/admin/coordinator/whatsapp'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      dir: 'rtl',
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/admin/coordinator/whatsapp'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        // Reuse an already-open tab instead of stacking new ones.
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
