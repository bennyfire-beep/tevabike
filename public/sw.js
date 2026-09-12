// Minimal service worker — just enough to receive Web Push while the app is
// closed and to open the right screen on tap. No offline caching yet; that's
// a separate concern from "get a phone notification", which is all this is
// for right now. Shared by two features: the coordinator WhatsApp alert and
// the interval-timer phase-change alert (see the `kind` check below).

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { /* non-JSON payload, ignore */ }

  // Two payload shapes share this one worker: the coordinator WhatsApp alert
  // (default, no `kind`) and the interval-timer phase change
  // (kind: 'interval', from lib/interval-notify.ts). They differ in default
  // title/url and in whether a vibration pattern rides along — Android reads
  // `vibrate` on the notification itself, which is the whole point for an
  // interval alert reaching a locked phone in someone's pocket.
  const isInterval = data.kind === 'interval'
  const title = data.title || (isInterval ? 'טבע בייק אינטרוול' : 'טבע בייק')
  const body = data.body || (isInterval ? 'עדכון באימון' : 'הודעה חדשה בווטסאפ')
  const url = data.url || (isInterval ? '/interval/receiver' : '/admin/coordinator/whatsapp')

  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    dir: 'rtl',
    data: { url },
  }
  if (isInterval) {
    // Re-alert (sound + vibrate) on every phase change instead of silently
    // replacing the previous notification — tag groups them in the tray so
    // they don't stack up over a long interval session.
    options.tag = 'interval-timer'
    options.renotify = true
    options.vibrate = Array.isArray(data.vibrate) ? data.vibrate : [300, 100, 300]
  }

  event.waitUntil(self.registration.showNotification(title, options))
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
