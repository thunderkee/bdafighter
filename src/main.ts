import './style.css';
import './theme.css';

// iOS Safari ignores user-scalable=no: block pinch and double-tap zoom
// everywhere except scrolling lists, since a browser zoom swallows the touch
// that was holding a button.
{
  // menu screens and their lists scroll; the arena (and the in-match HUD) never does
const scrollable = (t: EventTarget | null) => t instanceof Element && !!t.closest('.screen, .panels, .pick-grid');
  const opts = { passive: false } as const;
  for (const g of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(g, (e) => e.preventDefault(), opts);
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1 || !scrollable(e.target)) e.preventDefault();
  }, opts);
  let lastEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = performance.now();
    // a second tap within 350 ms is a double-tap zoom: cancel it
    if (now - lastEnd < 350 && !scrollable(e.target)) e.preventDefault();
    lastEnd = now;
  }, opts);
  document.addEventListener('dblclick', (e) => e.preventDefault(), opts);
}

// Installable app: the service worker caches the game, so it starts instantly and plays offline
// after the first visit (built pages only; the dev server is never cached).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
// Android Chrome offers an install prompt: keep it for the Install button
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as unknown as { __installPrompt?: Event }).__installPrompt = e;
  document.body.classList.add('can-install');
});

// The shared roster from the Unit Studio comes first, so the units are ready when the
// game builds them; then the physics WASM and three.js load behind the loading screen.
import('./published')
  .then(({ refreshPublished }) => refreshPublished())
  .catch(() => {})
  .then(() => import('./app'))
  .then(({ boot }) => boot())
  .catch((err) => {
    console.error(err);
    const el = document.getElementById('loading');
    if (el) el.innerHTML = '<p>Could not start the game. Try reloading.</p>';
  });
