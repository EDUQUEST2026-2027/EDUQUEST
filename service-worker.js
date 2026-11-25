/* SERVICE-WORKER.JS — EDUQUEST v1.30.2 (PWA hors-ligne, pré-cache résilient cœur + crédits + médias 100 % SVG, 43 matières dont Allemand) */
const CACHE_NAME = 'eduquest-cache-v1.30.2';

const CORE_PRECACHE_URLS = [
  './',
  'index.html',
  'admin.html',
  'dashboard.html',
  'map.html',
  'credits.html',
  'legal.html',
  'css/global.css',
  'css/style.css',
  'css/quests.css',
  'css/admin.css',
  'js/core/icons.js',
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
  'fonts/Silkscreen-Regular.woff2',
  'fonts/Silkscreen-Bold.woff2',
  'Image/logo.svg'
];

const MEDIA_PRECACHE_URLS = [
  'Image/personnages/robot.svg',
  'Image/personnages/david-martinez.svg',
  'Image/personnages/fall-guys.svg',
  'Image/personnages/hope-fortnite.svg',
  'Image/personnages/kasane-teto.svg',
  'Image/personnages/helldiver.svg',
  'Image/personnages/space-marine.svg',
  'Image/personnages/doom-guy.svg',
  'Image/personnages/einstein.svg',
  'Image/personnages/marie-curie.svg',
  'Image/personnages/christophe-colomb.svg',
  'Image/personnages/lovelace.svg',
  'Image/personnages/pythagore.svg',
  'Image/personnages/davinci.svg',
  'Image/personnages/hugo.svg',
  'Image/personnages/astronaute.svg',
  'Image/personnages/mage.svg',
  'Image/personnages/nikola-tesla.svg',
  'Image/personnages/pasteur.svg',
  'Image/personnages/rosalind-franklin.svg',
  'Image/personnages/galilee.svg',
  'Image/personnages/alan-turing.svg',
  'Image/personnages/hypatie.svg',
  'Image/personnages/cleopatre.svg',
  'Image/personnages/samourai-cyber.svg',
  'Image/personnages/alchimiste-etoile.svg',
  'Image/personnages/chevalier-astral.svg',
  'Image/ile/maths.svg',
  'Image/ile/francais.svg',
  'Image/ile/histoire.svg',
  'Image/ile/geo.svg',
  'Image/ile/svt.svg',
  'Image/ile/anglais.svg',
  'Image/ile/allemand.svg',
  'Image/ile/physique.svg',
  'Image/ile/chimie.svg',
  'Image/ile/technologie.svg',
  'Image/ile/philo.svg',
  'Image/ile/emc.svg',
  'Image/ile/nsi.svg',
  'Image/ile/ses.svg',
  'Image/ile/espagnol.svg',
  'Image/ile/arts.svg',
  'Image/ile/hggsp.svg',
  'Image/ile/si.svg',
  'Image/ile/msgn.svg',
  'Image/ile/droit_eco.svg',
  'Image/ile/mercatique.svg',
  'Image/ile/i2d.svg',
  'Image/ile/sin.svg',
  'Image/ile/cybersecurite.svg',
  'Image/ile/reseaux.svg',
  'Image/ile/electronique.svg',
  'Image/ile/stss.svg',
  'Image/ile/biotech.svg',
  'Image/ile/design.svg',
  'Image/ile/hotellerie.svg',
  'Image/ile/agronomie.svg',
  'Image/ile/spectacle.svg',
  'Image/ile/hlp.svg',
  'Image/ile/dev_bdd.svg',
  'Image/ile/commerce.svg',
  'Image/ile/comptabilite.svg',
  'Image/ile/electrotech.svg',
  'Image/ile/biopathologie.svg',
  'Image/ile/spcl.svg',
  'Image/ile/rh_comm.svg',
  'Image/ile/architecture_habitat.svg',
  'Image/ile/llce.svg',
  'Image/ile/pse.svg',
  'Image/team/clement-amisse.jpg'
];

const PRECACHE_URLS = CORE_PRECACHE_URLS.concat(MEDIA_PRECACHE_URLS);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache =>
        cache.addAll(CORE_PRECACHE_URLS)
          .then(() => Promise.allSettled(MEDIA_PRECACHE_URLS.map(url => cache.add(url))))
      )
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
