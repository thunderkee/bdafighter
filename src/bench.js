// ?bench — a repeatable performance run. The same file is in bdafighter, drrragon and jagggo;
// each game's src/bench-scenes.js says how to start its scenes and what each may cost.
//
//   ?bench=<scene>   run one scene        ?bench=all   run every scene, one page load each
//   &frames=300      measured frames      &warm=120    frames run first and not counted
//   &seed=1          Math.random seed
//   &profile         sample the JS stack while measuring and list the costliest functions
//                    (needs the page served with the header  Document-Policy: js-profiling)
//
// It changes nothing unless ?bench is in the URL. When it is: Math.random is seeded, the game's
// requestAnimationFrame and performance.now run on a fixed 1/60 s clock, every WebGL draw call is
// counted, and after each frame the GPU is waited on, so a frame's time includes the GPU's work.
// Results: an overlay on the page, window.__bench, and one console line starting "BENCH ".
// ms is the median frame (budgets check it), p95 the slow end, hitches the frames over 50 ms;
// cpu is the game's own work plus sending it to the GPU, gpuWait the time left for the GPU to finish.
// Run it at phone size (375×812, or 812×375 for a game played sideways) for numbers comparable
// between runs; the report says the size. A game (or one scene) can say how to tell it is moving (progress());
// a run where it didn't move is marked void, since a paused game measures nothing.

const QS = new URLSearchParams(location.search);
export const active = QS.has('bench');
const ORIGINAL_SEARCH = location.search;
const STEP = 1000 / 60;
const realNow = performance.now.bind(performance);
const hiddenGetter = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden')?.get;
const reallyHidden = () => !!hiddenGetter?.call(document);

let fixed = null; // the clock while stepping (ms), or null while it follows real time
let offset = 0;
const queue = new Map(); // the game's pending animation-frame callbacks
let nextId = 1;
let frame = null; // what the current frame has done
let gl0 = null; // the original WebGL functions

let s = 0;
function reseed() { s = (+QS.get('seed') || 1) >>> 0; }

function install() {
  // a seeded Math.random, so every run makes the same choices (re-seeded when stepping starts)
  reseed();
  Math.random = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // the game's clock
  performance.now = () => (fixed ?? realNow() + offset);
  window.requestAnimationFrame = (cb) => {
    const id = nextId++;
    queue.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = (id) => queue.delete(id);
  // a hidden browser pane must not pause the game or switch it to background stepping
  Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
  Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
  instrumentGL();
  pump();
}

/** runs the queued callbacks once, as one animation frame at time t */
function runFrame(t) {
  const cbs = [...queue.values()];
  queue.clear();
  for (const cb of cbs) {
    try { cb(t); } catch (e) { console.error(e); }
  }
}

// Until stepping starts, frames run about 60 times a second in real time. A MessageChannel keeps
// them going in a hidden pane, where timers and real animation frames are throttled.
const channel = new MessageChannel();
let lastPump = 0;
let stepper = null;
channel.port1.onmessage = () => {
  if (stepper) return stepper();
  const now = realNow();
  if (now - lastPump >= STEP - 1) {
    lastPump = now;
    runFrame(performance.now());
  }
  // (visible: a short timer between frames; hidden: timers are throttled, so post straight away)
  if (reallyHidden()) pump();
  else setTimeout(pump, 4);
};
function pump() { channel.port2.postMessage(0); }

if (active) install();

// ---------- WebGL counting ----------
function instrumentGL() {
  gl0 = new Map();
  const protos = [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype].filter(Boolean);
  const TRI = 4, STRIP = 5, FAN = 6;
  const tris = (mode, count, inst = 1) => (mode === TRI ? (count / 3) * inst : mode === STRIP || mode === FAN ? Math.max(0, count - 2) * inst : 0);
  const draw = (gl, mode, count, inst) => {
    if (!frame) return;
    frame.draws++;
    frame.tris += tris(mode, count, inst);
    frame.contexts.add(gl);
    if (frame.newPass) { frame.passes++; frame.newPass = false; }
  };
  for (const p of protos) {
    const orig = {};
    gl0.set(p, orig);
    const wrap = (name, count) => {
      const f = p[name];
      if (!f) return;
      orig[name] = f;
      p[name] = function (...a) {
        if (!frame) return f.apply(this, a);
        const t = realNow();
        const r = f.apply(this, a);
        frame.drawMs += realNow() - t;
        count(this, a);
        return r;
      };
    };
    wrap('drawArrays', (gl, a) => draw(gl, a[0], a[2], 1));
    wrap('drawElements', (gl, a) => draw(gl, a[0], a[1], 1));
    wrap('drawArraysInstanced', (gl, a) => draw(gl, a[0], a[2], a[3]));
    wrap('drawElementsInstanced', (gl, a) => draw(gl, a[0], a[1], a[4]));
    wrap('drawRangeElements', (gl, a) => draw(gl, a[0], a[3], 1));
    orig.bindFramebuffer = p.bindFramebuffer;
    p.bindFramebuffer = function (target, fb) {
      if (frame && target !== 0x8ca8 /* READ_FRAMEBUFFER */) frame.newPass = true;
      return orig.bindFramebuffer.call(this, target, fb);
    };
    // three.js's BatchedMesh draws through WEBGL_multi_draw: count each sub-draw
    const getExt = p.getExtension;
    p.getExtension = function (name) {
      const ext = getExt.call(this, name);
      if (ext && name === 'WEBGL_multi_draw' && !ext.__bench) {
        ext.__bench = true;
        const gl = this;
        for (const [fn, ci, n] of [['multiDrawArraysWEBGL', 3, 5], ['multiDrawElementsWEBGL', 1, 6]]) {
          const f = ext[fn].bind(ext);
          ext[fn] = (...a) => {
            if (frame) {
              const counts = a[ci], start = a[ci + 1], drawcount = a[n];
              const t = realNow();
              const r = f(...a);
              frame.drawMs += realNow() - t;
              for (let i = 0; i < drawcount; i++) draw(gl, a[0], counts[start + i], 1);
              return r;
            }
            return f(...a);
          };
        }
      }
      return ext;
    };
  }
}

const px = new Uint8Array(4);
/** waits until the GPU has finished everything this frame sent to each context */
function syncGPU(contexts) {
  for (const gl of contexts) {
    if (gl.isContextLost()) continue;
    const orig = gl0.get(Object.getPrototypeOf(gl)) || {};
    const bind = orig.bindFramebuffer || gl.bindFramebuffer;
    const two = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    const target = two ? gl.READ_FRAMEBUFFER : gl.FRAMEBUFFER;
    const prev = gl.getParameter(two ? gl.READ_FRAMEBUFFER_BINDING : gl.FRAMEBUFFER_BINDING);
    bind.call(gl, target, null);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    bind.call(gl, target, prev);
  }
}

// ---------- the run ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const helpers = {
  /** waits (in real time, frames still running) until test() is true */
  async until(test, what = 'the game', ms = 60000) {
    const t0 = realNow();
    while (!test()) {
      if (realNow() - t0 > ms) throw new Error(`bench: timed out waiting for ${what}`);
      await sleep(50);
    }
  },
  wait: sleep,
  click(sel) {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el) throw new Error(`bench: no ${sel} to click`);
    el.click();
  },
};

/** steps n frames on the fixed clock, each as its own task; returns per-frame records */
function step(n, onFrame) {
  return new Promise((resolve) => {
    const out = [];
    let i = 0;
    fixed ??= realNow() + offset;
    stepper = () => {
      fixed += STEP;
      frame = { draws: 0, tris: 0, passes: 0, drawMs: 0, newPass: true, contexts: new Set() };
      const t0 = realNow();
      onFrame?.(i);
      runFrame(fixed);
      const t1 = realNow();
      syncGPU(frame.contexts);
      const t2 = realNow();
      out.push({ cpu: t1 - t0, gpu: t2 - t1, total: t2 - t0, draws: frame.draws, tris: frame.tris, passes: frame.passes, drawMs: frame.drawMs, contexts: frame.contexts.size });
      frame = null;
      if (++i < n) return pump();
      stepper = null;
      offset = fixed - realNow();
      fixed = null;
      resolve(out);
      pump();
    };
    pump();
  });
}

const pct = (arr, q) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
const r2 = (v) => Math.round(v * 100) / 100;

function summarise(game, name, scene, frames) {
  const col = (k) => frames.map((f) => f[k]);
  const canvases = [...document.querySelectorAll('canvas')]
    .filter((c) => c.width > 1 && c.getClientRects().length > 0 && getComputedStyle(c).visibility !== 'hidden')
    .map((c) => `${c.width}×${c.height}`);
  const res = {
    game,
    scene: name,
    label: scene.label || name,
    frames: frames.length,
    ms: r2(pct(col('total'), 0.5)), // the median: steady cost, not swayed by one stall
    avg: r2(avg(col('total'))),
    p95: r2(pct(col('total'), 0.95)),
    max: r2(Math.max(...col('total'))),
    hitches: frames.filter((f) => f.total > 50).length, // frames over 50 ms: stalls a player sees (shader compiles, GC, loading)
    cpu: r2(avg(col('cpu'))),
    gpuWait: r2(avg(col('gpu'))),
    drawCpu: r2(avg(col('drawMs'))),
    draws: Math.round(avg(col('draws'))),
    drawsMax: Math.max(...col('draws')),
    passes: Math.round(avg(col('passes'))),
    tris: Math.round(avg(col('tris'))),
    contexts: Math.max(...col('contexts')),
    emptyFrames: frames.filter((f) => !f.draws).length,
    viewport: `${innerWidth}×${innerHeight}@${devicePixelRatio}`,
    phoneSize: Math.min(innerWidth, innerHeight) === 375 && Math.max(innerWidth, innerHeight) === 812,
    canvases,
    heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
    seed: +QS.get('seed') || 1,
    when: new Date().toISOString(),
    budget: scene.budget || null,
    over: [],
  };
  const b = scene.budget || {};
  if (b.ms != null && res.ms > b.ms) res.over.push(`ms ${res.ms} > ${b.ms}`);
  if (b.p95 != null && res.p95 > b.p95) res.over.push(`p95 ${res.p95} > ${b.p95}`);
  if (b.draws != null && res.draws > b.draws) res.over.push(`draws ${res.draws} > ${b.draws}`);
  if (b.passes != null && res.passes > b.passes) res.over.push(`passes ${res.passes} > ${b.passes}`);
  if (b.hitches != null && res.hitches > b.hitches) res.over.push(`hitches ${res.hitches} > ${b.hitches}`);
  res.ok = res.over.length === 0;
  return res;
}

// ---------- profiling (&profile) ----------
function startProfiler() {
  try {
    return new window.Profiler({ sampleInterval: 1, maxBufferSize: 1e6 });
  } catch {
    return null;
  }
}
/** the trace as self and total time per function (ms, by sample count × the sampling interval) */
function summariseProfile(trace) {
  const { frames, resources, stacks, samples } = trace;
  if (!samples.length) return { samples: 0 };
  const dt = (samples[samples.length - 1].timestamp - samples[0].timestamp) / Math.max(1, samples.length - 1);
  const label = (fi) => {
    const f = frames[fi];
    const file = f.resourceId != null ? resources[f.resourceId].split('/').pop().split('?')[0] : '';
    return `${f.name || '(anonymous)'} ${file}${f.line != null ? ':' + f.line : ''}`;
  };
  const self = new Map();
  const total = new Map();
  let busy = 0;
  for (const s of samples) {
    if (s.stackId == null) continue; // idle
    busy++;
    let id = s.stackId;
    const top = label(stacks[id].frameId);
    self.set(top, (self.get(top) || 0) + 1);
    const seen = new Set();
    while (id != null) {
      const l = label(stacks[id].frameId);
      if (!seen.has(l)) {
        seen.add(l);
        total.set(l, (total.get(l) || 0) + 1);
      }
      id = stacks[id].parentId;
    }
  }
  // per-frame milliseconds: samples × interval ÷ measured frames
  const toMs = (v) => r2((v * dt) / profileFrames);
  const top = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => ({ fn: k, msPerFrame: toMs(v), samples: v }));
  return { samples: samples.length, busy, intervalMs: r2(dt), self: top(self), total: top(total) };
}
let profileFrames = 1; // (the measured frame count, for per-frame figures)

function overlay(results, note = '') {
  let el = document.getElementById('bench-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'bench-overlay';
    el.style.cssText = 'position:fixed;left:6px;top:6px;z-index:2147483647;max-width:calc(100vw - 12px);overflow:auto;background:rgba(10,12,18,.88);color:#e8ecf4;font:11px/1.4 ui-monospace,Menlo,monospace;padding:8px 10px;border-radius:8px;pointer-events:auto;white-space:pre';
    el.addEventListener('click', () => el.remove());
    document.body.appendChild(el);
  }
  const head = 'scene       med    p95    max hitch   cpu   gpu  draws pass  status';
  const rows = results.map((r) =>
    `${r.scene.padEnd(10)} ${String(r.ms).padStart(5)} ${String(r.p95).padStart(6)} ${String(Math.round(r.max)).padStart(6)} ${String(r.hitches).padStart(5)} ${String(r.cpu).padStart(5)} ${String(r.gpuWait).padStart(5)} ${String(r.draws).padStart(6)} ${String(r.passes).padStart(4)}  ${r.ok ? 'ok' : 'OVER ' + r.over.join(', ')}`);
  const r0 = results[results.length - 1];
  const size = r0 ? `${r0.viewport}${r0.phoneSize ? '' : '  (not phone size 375×812 or 812×375)'}  canvas ${r0.canvases.join(' ')}` : '';
  el.textContent = [`BENCH ${r0?.game ?? ''}  ${note}`, head, ...rows, size, '(tap to close)'].join('\n');
}

/** called by each game's bench-scenes.js */
export async function bench(game) {
  if (!active) return;
  const names = Object.keys(game.scenes);
  const want = QS.get('bench');
  // ?bench=all: one scene per page load, the results carried in sessionStorage
  let all = null;
  try { all = JSON.parse(sessionStorage.getItem('bench.all') || 'null'); } catch {}
  if (want === 'all') {
    all = { left: names.slice(1), results: [], search: ORIGINAL_SEARCH };
    try { sessionStorage.setItem('bench.all', JSON.stringify(all)); } catch {}
  } else if (!all || !all.current || all.current !== want) all = null;
  const name = want === 'all' ? names[0] : want;
  const scene = game.scenes[name];
  if (!scene) {
    overlay([], `unknown scene "${want}". Scenes: ${names.join(', ')}, all`);
    return;
  }
  // the game's own URL flags for this scene, in place before the game reads them
  const u = new URL(location.href);
  for (const [k, v] of Object.entries({ ...(game.params || {}), ...(scene.params || {}) })) if (!u.searchParams.has(k)) u.searchParams.set(k, v);
  history.replaceState(history.state, '', u);

  const warm = +QS.get('warm') || scene.warm || 120;
  const n = +QS.get('frames') || scene.frames || 300;
  try {
    await new Promise((r) => (document.readyState === 'loading' ? addEventListener('DOMContentLoaded', r, { once: true }) : r()));
    overlay([], `${name}: loading…`);
    await helpers.until(game.ready, `${game.name} to load`);
    // (loading and menus ran in real time, using up a varying amount of randomness: start the scene from the same point)
    reseed();
    await scene.start(helpers);
    overlay([], `${name}: warming up ${warm} frames…`);
    await step(warm, scene.tick ? (i) => scene.tick(i - warm, helpers) : null);
    overlay([], `${name}: measuring ${n} frames…`);
    const progress = scene.progress || game.progress;
    const p0 = progress?.();
    profileFrames = n;
    const profiler = QS.has('profile') ? startProfiler() : null;
    const frames = await step(n, scene.tick ? (i) => scene.tick(i, helpers) : null);
    const res = summarise(game.name, name, scene, frames);
    if (QS.has('profile')) res.profile = profiler ? summariseProfile(await profiler.stop()) : 'unavailable: serve the page with  Document-Policy: js-profiling';
    // a game that didn't move during the run was paused or stuck: its numbers mean nothing
    if (progress && progress() === p0) {
      res.ok = false;
      res.over.unshift('the game did not advance (paused?)');
    }
    window.__bench = res;
    console.log('BENCH ' + JSON.stringify(res));
    const done = all ? [...all.results, res] : [res];
    if (all && all.left.length) {
      const next = all.left[0];
      all = { ...all, left: all.left.slice(1), results: done, current: next };
      try { sessionStorage.setItem('bench.all', JSON.stringify(all)); } catch {}
      overlay(done, `next: ${next}…`);
      const q = new URLSearchParams(all.search);
      q.set('bench', next);
      location.search = q.toString();
      return;
    }
    try { sessionStorage.removeItem('bench.all'); } catch {}
    if (all) {
      window.__benchAll = done;
      console.log('BENCH-ALL ' + JSON.stringify(done));
    }
    overlay(done, done.every((r) => r.ok) ? 'all within budget' : 'over budget');
  } catch (e) {
    console.error(e);
    try { sessionStorage.removeItem('bench.all'); } catch {}
    overlay([], `${name}: ${e.message}`);
    window.__bench = { game: game.name, scene: name, error: e.message };
    console.log('BENCH ' + JSON.stringify(window.__bench));
  }
}
