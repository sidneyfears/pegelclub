// Pegelclub Service Worker v4
const VERSION = '2.2.0';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('push', e => {
  let title = '🍻 Pegelclub';
  let body = 'Neue Aktivität in der App!';
  if (e.data) {
    try {
      const d = e.data.json();
      const p = d.payload || {};
      const map = {
        chat:    { t: '💬 Neue Nachricht',  b: p => (p.sender||'Jemand') + ': ' + (p.text||'') },
        event:   { t: '⚡ Neues Event',      b: p => (p.sender||'Jemand') + ' hat "' + (p.name||'') + '" erstellt' },
        expense: { t: '💳 Neue Ausgabe',     b: p => (p.sender||'Jemand') + ' hat Ausgabe eingetragen' },
        poll:    { t: '🗳️ Abstimmung',       b: p => (p.sender||'Jemand') + ': "' + (p.question||'') + '"' },
        trip:    { t: '🗺️ Neuer Trip',       b: p => (p.sender||'Jemand') + ' hat Trip erstellt' },
        payment: { t: '💸 Zahlung',          b: p => p.role==='debtor' ? (p.sender||'Jemand') + ' hat gezahlt' : (p.sender||'Jemand') + ' hat empfangen' },
      };
      const m = map[d.type];
      if (m) { title = m.t; body = m.b(p); }
    } catch(err) {}
  }
  e.waitUntil(self.registration.showNotification(title, {
    body, icon: '/icon-192.png', badge: '/icon-192.png',
    tag: 'pegelclub', renotify: true,
    data: { url: self.location.origin }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(list => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return clients.openWindow(self.location.origin);
    })
  );
});
