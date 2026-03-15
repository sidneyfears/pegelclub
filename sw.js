// Pegelclub Service Worker v2 – iOS & Android kompatibel

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('push', e => {
  if (!e.data) return;

  let data = {};
  try { data = e.data.json(); } catch(err) { data = { type: 'chat', payload: {} }; }

  const p = data.payload || {};

  const icons   = { chat:'💬', event:'⚡', expense:'💳', poll:'🗳️', trip:'🗺️', payment:'💸' };
  const titles  = {
    chat:    '💬 Neue Nachricht',
    event:   '⚡ Neues Event',
    expense: '💳 Neue Ausgabe',
    poll:    '🗳️ Neue Abstimmung',
    trip:    '🗺️ Neuer Trip',
    payment: '💸 Zahlung'
  };

  const bodyMap = {
    chat:    () => (p.sender||'Jemand') + ': ' + (p.text||''),
    event:   () => (p.sender||'Jemand') + ' hat "' + (p.name||'') + '" erstellt',
    expense: () => (p.sender||'Jemand') + ' hat €' + Number(p.amount||0).toFixed(2) + ' für "' + (p.desc||'') + '" eingetragen',
    poll:    () => (p.sender||'Jemand') + ' fragt: "' + (p.question||'') + '"',
    trip:    () => (p.sender||'Jemand') + ' hat Trip "' + (p.name||'') + '" erstellt',
    payment: () => p.role === 'debtor'
      ? (p.sender||'Jemand') + ' hat eine Zahlung bestätigt'
      : (p.sender||'Jemand') + ' hat den Geldeingang bestätigt',
  };

  const type  = data.type || 'chat';
  const title = titles[type] || '🍻 Pegelclub';
  const body  = bodyMap[type] ? bodyMap[type]() : 'Neue Aktivität';

  // iOS braucht zwingend: icon, badge und eine action
  // Android: funktioniert mit allen Optionen
  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: type + '-' + Date.now(),
    renotify: true,
    requireInteraction: false,
    silent: false,
    data: { url: self.location.origin, type }
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// Klick auf Benachrichtigung → App öffnen/fokussieren
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const targetUrl = (e.notification.data && e.notification.data.url) || self.location.origin;

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Offenes Fenster fokussieren falls vorhanden
      for (const client of list) {
        if (client.url.startsWith(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Sonst neu öffnen
      return clients.openWindow(targetUrl);
    })
  );
});
