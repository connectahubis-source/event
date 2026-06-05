/* connec+a Service Worker (P2: PWA + Web Push)
 * 配置: participants-index.html と同じディレクトリ (例: リポジトリ直下) に置く。
 * 登録: navigator.serviceWorker.register('./sw.js')  ← 相対指定で GitHub Pages のサブパスでも動作。
 */
const CACHE_NAME = 'cca-cache-v2';

self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

// 静的アセットのみ cache-first。HTML / GAS API はキャッシュしない (常に最新)。
self.addEventListener('fetch', (e) => {
  if (e.request.url.indexOf('script.google.com') >= 0) return;
  if (e.request.url.indexOf('googleusercontent.com') >= 0) return;
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isStatic = /\.(woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|ico|css|js)(\?|$)/i.test(url.pathname);
  if (!isStatic) return;
  e.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(e.request).then((cached) => {
        const fetchPromise = fetch(e.request).then((networkRes) => {
          if (networkRes && networkRes.ok) cache.put(e.request, networkRes.clone());
          return networkRes;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    )
  );
});

// --- Web Push ---
// 送信側 (P2-2: web-push) が JSON ペイロードを送る想定:
// { title, body, url, tag, icon, badge }
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    try { data = { title: 'connec+a', body: event.data ? event.data.text() : '' }; } catch (e2) { data = {}; }
  }
  const title = data.title || 'connec+a';
  const options = {
    body: data.body || '',
    icon: data.icon || './icons/icon-192.png',
    badge: data.badge || './icons/badge-72.png',
    data: { url: data.url || './' },
    tag: data.tag || undefined,
    renotify: !!data.tag,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          if (c.navigate) { try { c.navigate(target); } catch (e) {} }
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
