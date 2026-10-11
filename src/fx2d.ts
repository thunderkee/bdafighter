import ThorVG from '@thorvg/webcanvas';
import wasmUrl from '../node_modules/@thorvg/webcanvas/dist/thorvg.wasm?url';

// Screen-space vector effects drawn by ThorVG on a transparent canvas laid
// over the three.js view: shockwave rings, impact starbursts, super-shot
// glow and trail, and a full-screen flash. Loads lazily; if it fails, the
// game simply runs without the overlay.

type TVGNs = Awaited<ReturnType<typeof ThorVG.init>>;
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

const POOL = 40;

export const hex = (c: number): RGB => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

export class Fx2D {
  private tvg: TVGNs | null = null;
  private canvas: InstanceType<TVGNs['Canvas']> | null = null;
  private shapes: TShape[] = [];
  private rings: Ring[] = [];
  private stars: Star[] = [];
  private flashT = 0;
  private flashDur = 0.2;
  private flashColor: RGB = [255, 255, 255];
  private wasEmpty = true;
  private w = 0;
  private h = 0;
  ready = false;

  constructor(private el: HTMLCanvasElement) {}

  async init() {
    try {
      this.tvg = await ThorVG.init({ renderer: 'gl', locateFile: () => wasmUrl });
      this.resize();
      // full redraw every frame; effects move constantly
      this.canvas = new this.tvg.Canvas('#' + this.el.id, {
        width: this.w,
        height: this.h,
        enableDevicePixelRatio: false,
        engineOption: this.tvg.EngineOption.None,
      });
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

  flash(color: RGB = [255, 255, 255], dur = 0.22) {
    this.flashColor = color;
    this.flashDur = dur;
    this.flashT = dur;
  }

  /** Draw one frame. glows are recomputed by the caller each frame. */
  render(dt: number, glows: Glow[]) {
    if (!this.ready || !this.tvg || !this.canvas) return;
    for (const r of this.rings) r.t += dt;
    for (const s of this.stars) s.t += dt;
    this.rings = this.rings.filter((r) => r.t < r.dur);
    this.stars = this.stars.filter((s) => s.t < s.dur);
    this.flashT = Math.max(0, this.flashT - dt);

    const empty = !this.rings.length && !this.stars.length && !glows.length && this.flashT <= 0;
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
