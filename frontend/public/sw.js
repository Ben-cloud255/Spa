// Service worker for phone/desktop push alerts. Runs even when no app tab is
// open — this is what lets a notification reach a provider who's busy with a
// client and hasn't got the dashboard on screen.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { title: 'Serene Spa', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Serene Spa';
  const options = {
    body: data.body || '',
    data: { url: data.url || '/' },
    requireInteraction: true, // stays on screen until dismissed — this is time-sensitive
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(url);
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
