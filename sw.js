/* connec+a Service Worker (P2: PWA + Web Push)
 * 配置: participants-index.html と同じディレクトリ (例: リポジトリ直下) に置く。
 * 登録: navigator.serviceWorker.register('./sw.js')  ← 相対指定で GitHub Pages のサブパスでも動作。
 */
const CACHE_NAME = 'cca-cache-v3';

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
  const raw = (event.notification.data && event.notification.data.url) || './';
  const scope = self.registration.scope; // アプリのディレクトリ (例: https://site/event/)。sw.js ではなくここを基準にする。
  // 遷移先を「アプリのスコープ」基準で絶対URL化する (相対や '#/...' を sw.js 基準で解決して sw.js を開く事故を防ぐ)。
  let absolute;
  try {
    if (/^https?:\/\//i.test(raw)) absolute = raw;
    else if (raw.charAt(0) === '#') absolute = scope + raw;        // scope直下のindex + hash
    else absolute = new URL(raw, scope).href;                      // 相対は scope 基準
  } catch (e) { absolute = scope; }
  const hash = absolute.indexOf('#') >= 0 ? absolute.slice(absolute.indexOf('#')) : '';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        // sw.js を指すタブは無視。アプリのタブ(同一オリジン)があれば、それに hash を適用して前面化。
        if (c.url && c.url.indexOf('/sw.js') >= 0) continue;
        if ('focus' in c) {
          try {
            const cu = new URL(c.url);
            const navTo = hash ? (cu.origin + cu.pathname + cu.search + hash) : absolute;
            if (c.navigate) { c.navigate(navTo).catch(() => {}); }
          } catch (e) {}
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(absolute);
    })
  );
});
