// Pegelclub Service Worker v3
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('push', e => {
  // Show notification even without payload
  let title = '🍻 Pegelclub';
  let body = 'Neue Aktivität in der App!';

  if (e.data) {
    try {
      const d = e.data.json();
      const p = d.payload || {};
      const map = {
        chat:    { t: '💬 Neue Nachricht',   b: (p) => (p.sender||'Jemand') + ': ' + (p.text||'') },
        event:   { t: '⚡ Neues Event',       b: (p) => (p.sender||'Jemand') + ' hat "' + (p.name||'') + '" erstellt' },
        expense: { t: '💳 Neue Ausgabe',      b: (p) => (p.sender||'Jemand') + ' hat €' + Number(p.amount||0).toFixed(2) + ' eingetragen' },
        poll:    { t: '🗳️ Neue Abstimmung',   b: (p) => (p.sender||'Jemand') + ': "' + (p.question||'') + '"' },
        trip:    { t: '🗺️ Neuer Trip',        b: (p) => (p.sender||'Jemand') + ' hat "' + (p.name||'') + '" erstellt' },
        payment: { t: '💸 Zahlung',           b: (p) => p.role==='debtor' ? (p.sender||'Jemand') + ' hat gezahlt' : (p.sender||'Jemand') + ' hat empfangen' },
      };
      const m = map[d.type];
      if (m) { title = m.t; body = m.b(p); }
    } catch(err) {}
  }

  e.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'pegelclub-' + Date.now(),
    renotify: true,
    data: { url: self.location.origin }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(list => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) return c.focus();
      }
      return clients.openWindow(self.location.origin);
    })
  );
});
