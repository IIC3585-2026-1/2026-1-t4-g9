'use strict';

const CACHE_NAME = 'dividapp-v1';

// Archivos que se cachean al instalar el SW
const PRECACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json'
];

// ─── INSTALL ──────────────────────────────────────────────────────────────────
// Se ejecuta una sola vez cuando el SW se registra por primera vez.
// Cachea todos los assets estáticos.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())  // activa el SW inmediatamente sin esperar
  );
});

// ─── ACTIVATE ────────────────────────────────────────────────────────────────
// Elimina cachés viejos de versiones anteriores del SW.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())  // toma control de todas las pestañas abiertas
  );
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
// Estrategia: Cache First para assets estáticos, Network First para el resto.
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar requests del mismo origen
  if (url.origin !== location.origin) return;

  // Ignorar requests que no sean GET
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        // Tenemos el archivo en caché: lo devolvemos y en paralelo
        // intentamos actualizar la caché en background (stale-while-revalidate)
        const networkFetch = fetch(request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => {});  // si falla la red, no importa, ya tenemos el cached

        return cached;
      }

      // No está en caché: intentamos la red y guardamos el resultado
      return fetch(request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => {
        // Sin red y sin caché: devolvemos el index.html como fallback
        // (útil si el usuario navega a una ruta desconocida offline)
        return caches.match('/index.html');
      });
    })
  );
});

// ─── PUSH ────────────────────────────────────────────────────────────────────
// Recibe notificaciones push desde Firebase Cloud Messaging.
self.addEventListener('push', event => {
  let data = { title: 'DividApp', body: 'Tienes una actualización nueva.' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    '/icons/icon-192.png',
      badge:   '/icons/icon-96.png',
      vibrate: [100, 50, 100],
      data:    { url: data.url || '/' },
      actions: [
        { action: 'open',    title: 'Abrir app' },
        { action: 'dismiss', title: 'Cerrar'    }
      ]
    })
  );
});

// ─── NOTIFICATION CLICK ──────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Si la app ya está abierta, la enfoca
      for (const client of clientList) {
        if (client.url.includes(location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Si no está abierta, abre una ventana nueva
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});