// Кешує оболонку застосунку та шрифти, щоб він відкривався без інтернету.
// Графік зберігається окремо (localStorage), тому офлайн видно останній завантажений.
const CACHE = 'svitlo-v8';  // = VERSION в app.js
const SHELL = ['./', 'index.html', 'app.js', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Свої файли: спершу мережа (щоб оновлення доходили), без мережі — кеш
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(e.request)
      .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then(r => r || caches.match('index.html'))));
    return;
  }

  // Шрифти Google: кеш, потім мережа
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
    })));
  }
  // Дані графіка йдуть напряму, без перехоплення
});
