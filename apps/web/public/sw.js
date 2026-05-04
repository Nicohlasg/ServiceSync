// ServiceSync Service Worker
// Sprint 3 Task 3.6: Version-based cache-bust with skipWaiting on message.
const SW_VERSION = '1.0.0';

self.addEventListener('install', () => {
  // Don't call skipWaiting here — let the client decide when to activate
  // via the "New version available" banner.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Sprint 3 Task 3.6: Client sends SKIP_WAITING when user taps "Refresh".
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'ServiceSync', body: event.data.text() };
  }

  const title = payload.title || 'ServiceSync';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon.png',
    badge: payload.badge || '/icon.png',
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
