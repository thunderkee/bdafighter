import './style.css';

// The physics WASM and three.js load behind the loading screen.
import('./app')
  .then(({ boot }) => boot())
  .catch((err) => {
    console.error(err);
    const el = document.getElementById('loading');
    if (el) el.innerHTML = '<p>Could not start the game. Try reloading.</p>';
  });
