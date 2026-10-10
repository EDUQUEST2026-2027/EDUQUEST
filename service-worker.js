const CACHE_NAME = 'eduquest-cache-v1.23.0';

const PRECACHE_URLS = [
  './',
  'index.html',
  'dashboard.html',
  'map.html',
  'legal.html',
  'global.css',
  'style.css',
  'quests.css',
  'app.js',
  'db.js',
  'admin-store.js',
  'ai-provider.js',
  'question-bank.js',
  'quiz-engine.js',
  'manifest.webmanifest',
  'Image/logo.webp',
  'Image/personnages/robot.webp',
  'Image/personnages/einstein.webp',
  'Image/personnages/marie-curie.webp',
  'Image/personnages/christophe-colomb.webp',
  'Image/personnages/lovelace.webp',
  'Image/personnages/pythagore.webp',
  'Image/personnages/davinci.webp',
  'Image/personnages/hugo.webp',
  'Image/personnages/astronaute.webp',
  'Image/personnages/mage.webp'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  const currentCaches = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return cacheNames.filter(cacheName => !currentCaches.includes(cacheName));
    }).then(cachesToDelete => {
      return Promise.all(cachesToDelete.map(cacheToDelete => {
        return caches.delete(cacheToDelete);
      }));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    })
  );
});
