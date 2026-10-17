const CACHE_NAME = 'eduquest-cache-v1.26.0';

const PRECACHE_URLS = [
  './',
  'index.html',
  'admin.html',
  'dashboard.html',
  'map.html',
  'legal.html',
  'test.html',
  'css/global.css',
  'css/style.css',
  'css/quests.css',
  'css/admin.css',
  'js/app.js',
  'js/db.js',
  'js/admin.js',
  'js/admin-store.js',
  'js/ai-provider.js',
  'js/cookies.js',
  'js/question-bank.js',
  'js/quiz-engine.js',
  'js/core/game-rules.js',
  'js/core/quiz-session.js',
  'js/features/daily-quests.js',
  'manifest.webmanifest',
  'Image/logo.webp',
  'Image/logo.png',
  'Image/personnages/robot.webp',
  'Image/personnages/einstein.webp',
  'Image/personnages/marie-curie.webp',
  'Image/personnages/christophe-colomb.webp',
  'Image/personnages/lovelace.webp',
  'Image/personnages/pythagore.webp',
  'Image/personnages/davinci.webp',
  'Image/personnages/hugo.webp',
  'Image/personnages/astronaute.webp',
  'Image/personnages/mage.webp',
  'Image/ile/maths.webp',
  'Image/ile/francais.webp',
  'Image/ile/histoire.webp',
  'Image/ile/geo.svg',
  'Image/ile/svt.webp',
  'Image/ile/anglais.webp',
  'Image/ile/physique.webp',
  'Image/ile/chimie.svg',
  'Image/ile/technologie.webp',
  'Image/ile/philo.svg',
  'Image/ile/emc.svg',
  'Image/ile/nsi.svg',
  'Image/ile/ses.svg'
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
