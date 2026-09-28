// Offline cache: the whole game is static files, so cache them on install
// and serve cache-first, refreshing in the background.
const CACHE = 'diamond-crush-v1';
const FILES = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest', 'icon.svg',
  'src/main.js', 'src/game.js', 'src/input.js', 'src/save.js',
  'src/engine/constants.js', 'src/engine/level.js', 'src/engine/sim.js', 'src/engine/replay.js',
  'src/levels/index.js', 'src/levels/angkor.js',
  'src/render/renderer.js', 'src/render/sprites.js', 'src/render/palette.js',
  'src/audio/audio.js', 'src/ui/art.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const net = fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      }).catch(() => hit);
      return hit || net;
    }),
  );
});
