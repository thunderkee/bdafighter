import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

// Relative base so the build works from any static host or sub-path
// (GitHub Pages, itch.io, CrazyGames iframe).
export default defineConfig({
  base: './',
  plugins: [wasm()],
  build: {
    target: 'es2022',
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier2d'],
  },
});
