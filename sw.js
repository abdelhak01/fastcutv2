/* FASTCUT — service worker : permet le fonctionnement hors connexion. */
const CACHE = 'fastcut-essai-v3';
const FICHIERS = ['./', './index.html', './moteur.js', './dxf.js',
                   './manifest.json', './icone.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).then((reponse) => {
      const copie = reponse.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copie)).catch(() => {});
      return reponse;
    }).catch(() => caches.match('./index.html')))
  );
});
