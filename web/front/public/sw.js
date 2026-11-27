/* MedSync — Service Worker: recebe notificações push, trata cliques e dá um "offline mínimo". */
const CACHE = 'medsync-shell-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/favicon.svg'])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Páginas: rede primeiro, cache como reserva (app abre mesmo sem internet).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/')));
  }
});

self.addEventListener('push', (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch (e) {
    dados = { titulo: 'MedSync', corpo: event.data ? event.data.text() : '' };
  }
  const importante = dados.tipo === 'lembrete' || dados.tipo === 'atraso';
  event.waitUntil(
    self.registration.showNotification(dados.titulo || 'MedSync', {
      body: dados.corpo || '',
      tag: dados.tag || 'medsync',
      renotify: true,
      requireInteraction: importante, // fica na tela até a pessoa tocar
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200, 100, 200],
      data: { url: dados.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if ('focus' in janela) {
          janela.navigate(destino).catch(() => {});
          return janela.focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
