// Never cache private API responses or authenticated pages.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let data; try { data = event.data?.json(); } catch { data = null; }
  const url = new URL(data?.url || '/#notifications', self.location.origin);
  event.waitUntil(self.registration.showNotification('letsgetmarried', {
    icon: '/icon-192.png?v=2',
    body: data?.body || '새 소식이 있어요.', tag: data?.tag || 'wedding-update',
    data: { url: url.origin === self.location.origin ? url.href : self.location.origin },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = event.notification.data?.url || self.location.origin;
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(url); return existing.focus(); }
    return self.clients.openWindow(url);
  })());
});
