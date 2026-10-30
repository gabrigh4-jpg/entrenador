// Caché de la app para que abra sin conexión. Los datos van por la API (POST) y no se cachean aquí:
// la app guarda su propia copia local. Sube VERSION al cambiar archivos para que el móvil se actualice.
const VERSION = 'entrenador-v2';
const FILES = ['./', './index.html', './styles.css', './app.js', './figures.js', './data/ejercicios.js', './data/demo.js', './manifest.webmanifest', './icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// primero la red (así siempre ves la última versión) y, si no hay, la copia
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(VERSION).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
});
