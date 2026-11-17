// bdafighter's ?bench scenes (see bench.js). Each starts a mode from its own button, past the
// home screen; the CPU fighters play. Your fighter stands still, except in Storm Brawl (see seek). The game's own settings apply
// (a phone gets Battery saver). Budgets are "no worse than 2026-11-17" on the Mac at phone size
// (375×812): median ms, p95 ms and draws, with headroom for run-to-run noise (Storm Brawl's fight
// differs a little between runs). OVER means a change made it slower.
// Plain JS on purpose: index.html loads it directly, outside tsc.
import { bench } from './bench.js';

const W = window;

/** Action mode: steer your fighter at the nearest live opponent with the arrow keys, fire held */
const seek = (a) => {
  const me = a?.me;
  if (!me?.alive || !a.keys) return;
  let best = null;
  let bd = Infinity;
  for (const u of a.units) {
    if (u === me || !u.alive) continue;
    const d = Math.hypot(u.x - me.x, u.z - me.z);
    if (d < bd) [best, bd] = [u, d];
  }
  for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) a.keys.delete(k);
  a.keyFire = !!best;
  if (!best || bd < 4) return; // (close enough: stand and shoot)
  const dx = best.x - me.x;
  const dz = best.z - me.z;
  if (dx > 1) a.keys.add('ArrowRight');
  if (dx < -1) a.keys.add('ArrowLeft');
  if (dz > 1) a.keys.add('ArrowDown');
  if (dz < -1) a.keys.add('ArrowUp');
};

bench({
  name: 'bdafighter',
  // ?debug exposes the game to the console (__mf, __action, __squad)
  params: { debug: '' },
  ready: () => !!document.getElementById('loading')?.classList.contains('hidden'),
  scenes: {
    // Duel: you against one CPU fighter
    duel: {
      label: 'Duel',
      warm: 240, // (past the countdown)
      budget: { ms: 7, p95: 12, draws: 700 },
      progress: () => W.__mf?.game.clock ?? 0,
      async start(b) {
        b.click('#play-btn');
        await b.until(() => W.__mf?.game.phase === 'countdown' || W.__mf?.game.phase === 'fight', 'the duel to start');
      },
    },
    // Storm Brawl: you and five fighters (Action's free-for-all)
    storm: {
      label: 'Storm Brawl',
      warm: 300, // (5 s: long enough to reach the others)
      frames: 600,
      budget: { ms: 7.5, p95: 12, draws: 600 },
      progress: () => W.__action?.time ?? 0,
      async start(b) {
        b.click('#action-btn');
        await b.until(() => W.__action, 'Action to open');
        W.__action.start('ffa');
      },
      // your fighter plays too: it walks at the nearest fighter (as if on WASD) and holds fire,
      // which aims itself, so the camera is in the thick of it like a real match
      tick: () => seek(W.__action),
    },
    // Gate Rush: the squad runner
    gate: {
      label: 'Gate Rush',
      progress: () => W.__squad?.z ?? 0,
      budget: { ms: 3.5, p95: 7, draws: 140 },
      async start(b) {
        b.click('#squad-btn');
        await b.until(() => document.querySelector('.sq-go')?.offsetParent, 'Gate Rush to open');
        b.click('.sq-go');
      },
    },
  },
});
