/**
 * Service worker — mode hors ligne.
 *
 * Stratégie :
 *  – la coquille de l'application (HTML, CSS, modules JS, icônes) est mise en
 *    cache à l'installation : l'application démarre sans réseau ;
 *  – les navigations utilisent le réseau en premier avec repli sur le cache,
 *    ce qui évite de servir une version périmée après une mise à jour ;
 *  – les autres ressources de même origine utilisent le cache en premier.
 *
 * Aucune requête vers un tiers n'est interceptée ni mise en cache.
 */

const VERSION = 'v3';
const CACHE = `drillbuilder-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './js/app.js',
  './js/coach.js',
  './js/editor.js',
  './js/exporter.js',
  './js/i18n.js',
  './js/plans.js',
  './js/qr.js',
  './js/render.js',
  './js/rink.js',
  './js/seed.js',
  './js/store.js',
  './js/symbols.js',
  './js/taxonomy.js',
  './js/util.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // addAll échoue en bloc dès qu'un fichier manque : on tolère les absences.
    await Promise.all(SHELL.map((u) => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // rien n'est intercepté hors de l'origine

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        const c = await caches.open(CACHE);
        c.put('./index.html', net.clone()).catch(() => {});
        return net;
      } catch {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const net = await fetch(req);
      if (net && net.status === 200 && net.type === 'basic') {
        const c = await caches.open(CACHE);
        c.put(req, net.clone()).catch(() => {});
      }
      return net;
    } catch {
      return Response.error();
    }
  })());
});
