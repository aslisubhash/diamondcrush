// Offline cache: the whole game is static files, so cache them on install
// and serve cache-first, refreshing in the background.
const CACHE = 'diamond-crush-v2';
const FILES = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest', 'icon.svg', 'fonts/Cinzel-63551c.woff2',
  'fonts/CinzelDecorative-655d15.woff2', 'fonts/CinzelDecorative-c2814f.woff2',
  'fonts/CormorantGaramond-2fed1d.woff2', 'fonts/CormorantGaramond-5d13e7.woff2', 'fonts/fonts.css',
  'src/audio/audio.js', 'src/engine/ascii.js', 'src/engine/bosses.js', 'src/engine/constants.js',
  'src/engine/enemies.js', 'src/engine/level.js', 'src/engine/replay.js', 'src/engine/shared.js',
  'src/engine/sim.js', 'src/game.js', 'src/input.js', 'src/levels/angkor.js', 'src/levels/bavaria.js',
  'src/levels/index.js', 'src/levels/india.js', 'src/levels/tibet.js', 'src/main.js',
  'src/render/palette.js', 'src/render/premium.js', 'src/render/renderer.js', 'src/render/sprites.js',
  'src/render/sprites2.js', 'src/save.js', 'src/ui/art.js', 'src/ui/icons.js',
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
