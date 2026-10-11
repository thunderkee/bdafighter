import ThorVG from '@thorvg/webcanvas';
import wasmUrl from '../node_modules/@thorvg/webcanvas/dist/thorvg.wasm?url';

// Screen-space vector effects drawn by ThorVG on a transparent canvas laid
// over the three.js view: shockwave rings, impact starbursts, super-shot
// glow and trail, and a full-screen flash. Loads lazily; if it fails, the
// game simply runs without the overlay.

export type TVGNs = Awaited<ReturnType<typeof ThorVG.init>>;

let tvgPromise: Promise<TVGNs> | null = null;
/** One ThorVG engine shared by the effects overlay and the portraits. */
export function loadTVG() {
  tvgPromise ??= ThorVG.init({ renderer: 'gl', locateFile: () => wasmUrl });
  return tvgPromise;
}
type TShape = InstanceType<TVGNs['Shape']>;
type RGB = [number, number, number];

interface Ring {
  x: number;
  y: number;
  t: number;
  dur: number;
  r0: number;
  r1: number;
  width: number;
  color: RGB;
}

interface Star {
  x: number;
  y: number;
  t: number;
  dur: number;
  rays: number;
  len: number;
  angle: number;
  color: RGB;
}

export interface Glow {
  x: number;
  y: number;
  r: number;
  color: RGB;
  /** previous screen positions, newest first */
  trail: { x: number; y: number }[];
}

/** a supply-drop pointer: bracket when on screen, edge arrow when off */
export interface Marker {
  x: number;
  y: number;
  color: RGB;
  /** -1 / 1 when pinned to the left / right edge, 0 when on screen */
  edge: number;
}

/** a motion streak behind a fast marble (screen space) */
export interface Streak {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  team: number;
}

interface Tick {
  x: number;
  y: number;
  t: number;
  k: number;
}

const POOL = 64;

/** ThorVG writes the pixel size into the canvas's inline style; keep CSS size fluid. */
export function fitCss(el: HTMLCanvasElement) {
  el.style.width = '100%';
  el.style.height = '100%';
}

export const hex = (c: number): RGB => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

export class Fx2D {
  private tvg: TVGNs | null = null;
  private canvas: InstanceType<TVGNs['Canvas']> | null = null;
  private shapes: TShape[] = [];
  private rings: Ring[] = [];
  private stars: Star[] = [];
  private ticks: Tick[] = [];
  private flashT = 0;
  private flashDur = 0.2;
  private flashColor: RGB = [255, 255, 255];
  private wasEmpty = true;
  private time = 0;
  private w = 0;
  private h = 0;
  ready = false;

  constructor(private el: HTMLCanvasElement) {}

  async init() {
    try {
      this.tvg = await loadTVG();
      this.resize();
      // full redraw every frame; effects move constantly
      this.canvas = new this.tvg.Canvas('#' + this.el.id, {
        width: this.w,
        height: this.h,
        enableDevicePixelRatio: false,
        engineOption: this.tvg.EngineOption.None,
      });
      fitCss(this.el);
      for (let i = 0; i < POOL; i++) {
        const s = new this.tvg.Shape();
        this.shapes.push(s);
        this.canvas.add(s);
      }
      this.ready = true;
    } catch (err) {
      console.warn('ThorVG overlay disabled:', err);
      this.ready = false;
    }
  }

  resize() {
    const r = this.el.getBoundingClientRect();
    // render at CSS pixels (capped) — glow and rings don't need retina detail
    const scale = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = Math.max(1, Math.round(r.width * scale));
    this.h = Math.max(1, Math.round(r.height * scale));
    this.canvas?.resize(this.w, this.h);
    fitCss(this.el);
  }

  /** CSS-pixel point -> overlay pixel */
  private sx(x: number) {
    return (x / (this.el.clientWidth || 1)) * this.w;
  }
  private sy(y: number) {
    return (y / (this.el.clientHeight || 1)) * this.h;
  }
  private get unit() {
    return this.w / (this.el.clientWidth || 1);
  }

  ring(x: number, y: number, color: RGB, big = false) {
    this.rings.push({ x, y, t: 0, dur: big ? 0.55 : 0.3, r0: big ? 12 : 6, r1: big ? 170 : 46, width: big ? 14 : 5, color });
    if (big) this.rings.push({ x, y, t: -0.08, dur: 0.6, r0: 8, r1: 120, width: 6, color: [255, 255, 255] });
  }

  star(x: number, y: number, color: RGB, big = false) {
    this.stars.push({ x, y, t: 0, dur: big ? 0.35 : 0.18, rays: big ? 12 : 7, len: big ? 110 : 34, angle: Math.random() * Math.PI, color });
  }

  /** drop everything queued (effects switched off) */
  clearQueued() {
    this.rings.length = 0;
    this.stars.length = 0;
    this.ticks.length = 0;
    this.flashT = 0;
  }

  /** a tiny white impact ring where two marbles clack */
  tick(x: number, y: number, k: number) {
    if (this.ticks.length > 24) return;
    this.ticks.push({ x, y, t: 0, k });
  }

  flash(color: RGB = [255, 255, 255], dur = 0.22) {
    this.flashColor = color;
    this.flashDur = dur;
    this.flashT = dur;
  }

  /** Draw one frame. glows are recomputed by the caller each frame. */
  render(dt: number, glows: Glow[], speed = false, markers: Marker[] = [], streaks: Streak[] = [], teamColors: number[] = [0xffffff, 0xffffff]) {
    if (!this.ready || !this.tvg || !this.canvas) return;
    for (const r of this.rings) r.t += dt;
    for (const s of this.stars) s.t += dt;
    this.rings = this.rings.filter((r) => r.t < r.dur);
    this.stars = this.stars.filter((s) => s.t < s.dur);
    for (const t of this.ticks) t.t += dt;
    this.ticks = this.ticks.filter((t) => t.t < 0.16);
    this.flashT = Math.max(0, this.flashT - dt);

    const empty = !this.rings.length && !this.stars.length && !glows.length && this.flashT <= 0 && !speed && !markers.length && !streaks.length && !this.ticks.length;
    if (empty && this.wasEmpty) return; // nothing to draw and already cleared
    this.wasEmpty = empty;

    const TVG = this.tvg;
    const u = this.unit;
    let i = 0;
    // reset() keeps the old fill and stroke, so clear both when recycling
    const next = () => (i < this.shapes.length ? this.shapes[i++].reset().fill(0, 0, 0, 0).stroke({ width: 0 }) : null);

    // full-screen flash first so everything else draws over it
    if (this.flashT > 0) {
      const s = next();
      const a = Math.round(140 * (this.flashT / this.flashDur));
      s?.appendRect(0, 0, this.w, this.h).fill(...this.flashColor, a);
    }

    // overdrive: streaks rushing in from the screen edges
    if (speed) {
      const s = next();
      if (s) {
        const cx = this.w / 2;
        const cy = this.h * 0.55;
        for (let k = 0; k < 22; k++) {
          const a = Math.random() * Math.PI * 2;
          const r0 = Math.max(this.w, this.h) * (0.42 + Math.random() * 0.2);
          const len = (40 + Math.random() * 90) * u;
          const x0 = cx + Math.cos(a) * r0;
          const y0 = cy + Math.sin(a) * r0;
          const x1 = cx + Math.cos(a) * (r0 - len);
          const y1 = cy + Math.sin(a) * (r0 - len);
          const nx = -Math.sin(a) * 1.4 * u;
          const ny = Math.cos(a) * 1.4 * u;
          s.moveTo(x0 + nx, y0 + ny);
          s.lineTo(x1, y1);
          s.lineTo(x0 - nx, y0 - ny);
          s.close();
        }
        s.fill(255, 240, 190, 150);
      }
    }

    // super-shot glow: soft halo plus a fading trail of dots
    for (const g of glows) {
      const x = this.sx(g.x);
      const y = this.sy(g.y);
      const r = g.r * u;
      g.trail.forEach((p, k) => {
        const s = next();
        if (!s) return;
        const f = 1 - k / g.trail.length;
        s.appendCircle(this.sx(p.x), this.sy(p.y), r * 0.9 * f + 1).fill(...g.color, Math.round(120 * f));
      });
      const halo = next();
      if (halo) {
        const grad = new TVG.RadialGradient(x, y, r * 2.4);
        grad.setStops([0, [255, 255, 255, 230]], [0.35, [...g.color, 170]], [1, [...g.color, 0]]);
        halo.appendCircle(x, y, r * 2.4).fill(grad);
      }
    }

    // motion streaks: one shape per team, each streak a tapered sliver
    for (const team of [0, 1]) {
      const list = streaks.filter((st) => st.team === team);
      if (!list.length) continue;
      const s = next();
      if (!s) break;
      for (const st of list) {
        const x0 = this.sx(st.x0);
        const y0 = this.sy(st.y0);
        const x1 = this.sx(st.x1);
        const y1 = this.sy(st.y1);
        const len = Math.hypot(x1 - x0, y1 - y0) || 1;
        const nx = (-(y1 - y0) / len) * st.w * u * 0.5;
        const ny = ((x1 - x0) / len) * st.w * u * 0.5;
        s.moveTo(x0 + nx, y0 + ny);
        s.lineTo(x1, y1);
        s.lineTo(x0 - nx, y0 - ny);
        s.close();
      }
      s.fill(...hex(teamColors[team]), 110);
    }
    // clack ticks
    if (this.ticks.length) {
      const s = next();
      if (s) {
        for (const t of this.ticks) {
          const r = (4 + (t.t / 0.16) * 12 * (0.5 + t.k)) * u;
          s.appendCircle(this.sx(t.x), this.sy(t.y), r);
        }
        s.stroke({ width: 1.5 * u, color: [255, 255, 255, 170] });
      }
    }

    // supply-drop markers
    this.time += dt;
    for (const mk of markers) {
      const s = next();
      if (!s) break;
      const x = this.sx(mk.x);
      const y = this.sy(mk.y);
      const pulse = 1 + Math.sin(this.time * 8) * 0.12;
      if (mk.edge) {
        // chevron pointing off-screen
        const d = mk.edge;
        const z = 16 * u * pulse;
        s.moveTo(x + d * z, y);
        s.lineTo(x - d * z * 0.6, y - z);
        s.lineTo(x - d * z * 0.2, y);
        s.lineTo(x - d * z * 0.6, y + z);
        s.close();
        s.fill(...mk.color, 230);
      } else {
        // four corner brackets around the crate
        const r = 22 * u * pulse;
        const l = 8 * u;
        for (const [cx, cy] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ]) {
          s.moveTo(x + cx * r, y + cy * (r - l));
          s.lineTo(x + cx * r, y + cy * r);
          s.lineTo(x + cx * (r - l), y + cy * r);
        }
        s.stroke({ width: 2.5 * u, color: [...mk.color, 240] });
      }
    }

    for (const ring of this.rings) {
      if (ring.t < 0) continue;
      const s = next();
      if (!s) break;
      const k = ring.t / ring.dur;
      const ease = 1 - (1 - k) * (1 - k);
      const rad = (ring.r0 + (ring.r1 - ring.r0) * ease) * u;
      s.appendCircle(this.sx(ring.x), this.sy(ring.y), rad).stroke({
        width: Math.max(1, ring.width * (1 - k) * u),
        color: [...ring.color, Math.round(255 * (1 - k))],
      });
    }

    for (const st of this.stars) {
      const s = next();
      if (!s) break;
      const k = st.t / st.dur;
      const x = this.sx(st.x);
      const y = this.sy(st.y);
      const inner = st.len * 0.25 * u * (1 + k);
      const outer = st.len * u * (0.6 + k * 0.6);
      for (let r = 0; r < st.rays; r++) {
        const a = st.angle + (r / st.rays) * Math.PI * 2;
        const half = 0.12;
        s.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
        s.lineTo(x + Math.cos(a - half) * inner * 1.6, y + Math.sin(a - half) * inner * 1.6);
        s.lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer);
        s.lineTo(x + Math.cos(a + half) * inner * 1.6, y + Math.sin(a + half) * inner * 1.6);
        s.close();
      }
      s.fill(...st.color, Math.round(255 * (1 - k)));
    }

    // clear unused pool shapes
    while (i < this.shapes.length) this.shapes[i++].reset();
    this.canvas.update().render();
  }
}
