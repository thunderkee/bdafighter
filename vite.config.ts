import { defineConfig, type Plugin } from 'vite';
import wasm from 'vite-plugin-wasm';

/**
 * The offline cache: after the build, write sw.js with this build's version and every file it
 * emitted, so the service worker can precache the whole game on install and drop old builds.
 */
function serviceWorker(): Plugin {
  let files: string[] = [];
  return {
    name: 'marble-fighter-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
    },
    writeBundle(opts) {
      // (public files are copied as they are: list the ones the game needs too)
      const extra = ['manifest.webmanifest', 'favicon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];
      const precache = ['./', ...files, ...extra].filter((f) => f !== 'sw.js');
      const version = Date.now().toString(36);
      const src = SW_SOURCE.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(precache));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return import('node:fs').then((fs) => fs.writeFileSync(`${opts.dir}/sw.js`, src));
    },
  };
}

const SW_SOURCE = `// Marble Fighter offline cache (written by the build)
const VERSION = '__VERSION__';
const CACHE = 'marble-fighter-' + VERSION;
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('marble-fighter-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // the shared roster is always fetched live
  if (url.origin === location.origin && url.pathname.includes('/api/')) return;
  // pages: the network first (so an update shows up), the cache when offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./'))),
    );
    return;
  }
  // everything else (the hashed game files, icons, fonts): the cache first
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (url.origin === location.origin || url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com'))) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
`;

// Relative base so the build works from any static host or sub-path
// (GitHub Pages, itch.io, CrazyGames iframe).
export default defineConfig({
  base: './',
  plugins: [wasm(), serviceWorker()],
  build: {
    target: 'es2022',
    // three pages: the game, the Unit Lab character editor, and the Unit Studio that publishes to everyone
    rollupOptions: {
      input: { main: 'index.html', editor: 'editor.html', studio: 'studio.html' },
    },
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier2d'],
  },
});
