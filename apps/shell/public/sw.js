/*
 * Service worker de Casa Caride.
 * Estrategia:
 *  - Navegaciones (HTML): network-first con fallback a caché (para que las
 *    mini-apps con datos en vivo siempre intenten la red primero).
 *  - Estáticos del shell (íconos, manifest): stale-while-revalidate.
 * Scope "/" -> cubre todas las mini-apps del mismo origen.
 */
const CACHE = 'casa-caride-v8'
const APP_SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Fabián 🐶', {
      body:     data.body  ?? 'Hora de la pastilla',
      icon:     '/icon-192.png',
      badge:    '/icon-192.png',
      tag:      data.tag   ?? 'fabian',
      renotify: true,
      data:     { url: data.url ?? '/fabian' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/fabian'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const match = cs.find(c => c.url.includes('/fabian'))
      if (match) return match.focus()
      return clients.openWindow(url)
    })
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Las APIs nunca se cachean: siempre datos frescos del server.
  if (url.pathname.includes('/api/')) return

  // Navegaciones -> network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/')))
    )
    return
  }

  // Estáticos -> stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
          return res
        })
        .catch(() => cached)
      return cached || network
    })
  )
})
