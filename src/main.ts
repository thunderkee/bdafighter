import './style.css';

// iOS Safari ignores user-scalable=no: block pinch and double-tap zoom
// everywhere except scrolling lists, since a browser zoom swallows the touch
// that was holding a button.
{
  const scrollable = (t: EventTarget | null) => t instanceof Element && !!t.closest('.panels');
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

// The physics WASM and three.js load behind the loading screen.
import('./app')
  .then(({ boot }) => boot())
  .catch((err) => {
    console.error(err);
    const el = document.getElementById('loading');
    if (el) el.innerHTML = '<p>Could not start the game. Try reloading.</p>';
  });
