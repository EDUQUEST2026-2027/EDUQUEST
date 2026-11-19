const CACHE_NAME = 'eduquest-cache-v1.27.1';

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
  'js/core/audio-manager.js',
  'js/core/quiz-timer.js',
  'js/core/adaptive-engine.js',
  'js/core/game-rules.js',
  'js/core/quiz-session.js',
  'js/features/daily-quests.js',
  'manifest.webmanifest',
  'fonts/PressStart2P-Regular.woff2',
  'fonts/Silkscreen-Regular.woff2',
  'fonts/Silkscreen-Bold.woff2',
  'Image/logo.webp',
  'Image/personnages/robot.webp',
  'Image/personnages/david-martinez.svg',
  'Image/personnages/fall-guys.svg',
  'Image/personnages/hope-fortnite.svg',
  'Image/personnages/kasane-teto.svg',
  'Image/personnages/helldiver.svg',
  'Image/personnages/space-marine.svg',
  'Image/personnages/doom-guy.svg',
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
    caches.keys()
      .then(cacheNames => cacheNames.filter(name => !currentCaches.includes(name)))
      .then(oldCaches => Promise.all(oldCaches.map(name => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

function isAppCodeRequest(request) {
  const url = new URL(request.url);
  if (request.mode === 'navigate') return true;
  return /\.(html|js|css|webmanifest)$/i.test(url.pathname);
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const reqUrl = new URL(event.request.url);
  if (reqUrl.origin !== self.location.origin) return;

  // Stratégie Network-First pour HTML / JS / CSS : toujours à jour en ligne, repli cache hors-ligne
  if (isAppCodeRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Stratégie Cache-First pour les médias statiques (images, polices, musiques)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
