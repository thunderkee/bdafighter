import * as THREE from 'three';
import { celify } from './cel';
import { InkOnly } from './post';
import { ShooterMesh, studioEnv, type CharacterDef } from './robot';
import type { Shooter } from './game';

/**
 * Your fighter on a result card, turning on the spot and acting out how it went: a win hops and
 * cheers with a twirl (and confetti), a loss slumps and sways, a draw just shrugs along. One small
 * renderer shared by every mode's result (Versus, Action, Gate Rush), running only while its card
 * is on screen.
 */
export type Outcome = 'win' | 'lose' | 'draw';

/** the menu's skinned fighter for an id (your cosmetics), set once by the app */
let skinOf: ((id: string) => CharacterDef | undefined) | null = null;
export const setResultSkins = (f: (id: string) => CharacterDef | undefined) => {
  skinOf = f;
};

const H = 2.5; // the roster's tallest, as the menu frames them
const R = 1.3;
const FRAME_LO = -0.1;
const FRAME_HI = H + 0.45;

class Hero {
  private renderer: THREE.WebGLRenderer | null = null;
  private ink: InkOnly | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  private pivot = new THREE.Group();
  private shadow: THREE.Mesh;
  /** this fighter's own fit: how far the camera pulls in or out so its whole act stays in the picture */
  private fit = 1;
  /** and how far the view slides (world units) to centre that act in the picture */
  private shift = new THREE.Vector2();
  private unit: ShooterMesh | null = null;
  private host: HTMLElement | null = null;
  private outcome: Outcome = 'win';
  private raf = 0;
  private last = 0;
  private t = 0;
  private pose = { x: 0, y: 0, team: 0, aim: 0, shieldUp: false, recoil: 0, windT: 9, kickT: 9, hand: 1, lastHand: 1, wobble: 0, vx: 0, flash: 0, stagger: 0, health: 100, heavyT: 9, firing: false } as unknown as Shooter;

  constructor() {
    this.scene.add(new THREE.HemisphereLight(0xfff6e8, 0x6a6458, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-5, 7, -1.5);
    this.scene.add(sun);
    // a soft round shadow under its feet
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.42)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    this.shadow = shadow;
    this.scene.add(shadow, this.pivot);
  }

  show(host: HTMLElement, def: CharacterDef, outcome: Outcome) {
    const r = this.ensure();
    if (this.unit) this.pivot.remove(this.unit.root);
    const skin = skinOf?.(def.id);
    const d = skin && skin.id === def.id ? skin : def;
    this.unit = new ShooterMesh(d.id, d.ball, d);
    this.pivot.add(this.unit.root);
    this.outcome = outcome;
    this.t = 0;
    this.host = host;
    host.classList.add('result-hero');
    host.classList.toggle('win', outcome === 'win');
    host.classList.toggle('lose', outcome === 'lose');
    host.prepend(r.domElement);
    // (fitted once it's on the card, at the shape it's shown at)
    this.fitTo();
    this.camera.aspect = r.domElement.clientWidth && r.domElement.clientHeight ? r.domElement.clientWidth / r.domElement.clientHeight : 1;
    r.setSize(r.domElement.clientWidth || 1, r.domElement.clientHeight || 1, false);
    this.frameCamera();
    host.querySelector('.rh-confetti')?.remove();
    if (outcome === 'win') host.appendChild(confetti(d.ball));
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private ensure() {
    if (this.renderer) return this.renderer;
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setClearColor(0x000000, 0);
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 0.92;
    r.domElement.className = 'rh-canvas';
    this.scene.environment = studioEnv(r);
    this.scene.environmentIntensity = 0.6;
    this.renderer = r;
    this.ink = new InkOnly(r, this.scene, this.camera);
    return r;
  }

  private frame = (now: number) => {
    const host = this.host;
    // (its card gone or hidden: stop until the next result)
    if (!host || !host.isConnected || !host.offsetParent) return this.stop();
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    const r = this.renderer!;
    // (sized by its canvas, which can stand bigger than its box and break out of the card)
    const w = r.domElement.clientWidth;
    const h = r.domElement.clientHeight;
    const size = r.getSize(new THREE.Vector2());
    if (w && h && (size.x !== w || size.y !== h)) {
      r.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.frameCamera();
    }
    this.act(dt);
    celify(this.scene, true);
    this.ink!.render();
  };

  /** the camera's distance before this fighter's own fit (the roster's shared framing) */
  private baseDist() {
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    return Math.max((FRAME_HI - FRAME_LO) / 2 / tan, R / (tan * (this.camera.aspect || 1))) + R * 0.2;
  }

  /** the whole fighter in view, hops and all, from a touch above */
  private frameCamera() {
    const cy = (FRAME_LO + FRAME_HI) / 2;
    const dist = this.baseDist();
    // (slid to centre this fighter's act; the camera faces +z, so the picture's right is world -x)
    const sx = -this.shift.x;
    const sy = this.shift.y;
    this.camera.position.set(sx, cy + sy + dist * 0.14, -dist);
    this.camera.lookAt(sx, cy + sy, 0);
    this.camera.zoom = this.fit;
    this.camera.updateProjectionMatrix();
  }

  /**
   * how far this fighter's whole act reaches across the picture (0..1 from the bottom-left), drawn
   * small and read back so only what really shows counts (not hidden glow planes and props)
   */
  private measure(px = 72, asFitted = false) {
    const r = this.renderer!;
    const keep = r.getSize(new THREE.Vector2());
    // (the picture's own shape: a wide one gives a long fighter's twirl more room)
    const el = r.domElement;
    const aspect = el.clientWidth && el.clientHeight ? el.clientWidth / el.clientHeight : 1;
    const keepAspect = this.camera.aspect;
    r.setSize(Math.round(px * aspect), px, false);
    this.camera.aspect = aspect;
    // (drawn zoomed out to half, so nothing it does can run off the edge of the measure)
    if (!asFitted) {
      this.fit = 0.5;
      this.shift.set(0, 0);
    }
    this.frameCamera();
    this.shadow.visible = false;
    const gl = r.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const buf = new Uint8Array(w * h * 4);
    const out = { x0: 1, x1: 0, y0: 1, y1: 0 };
    for (this.t = 0; this.t < 6.4; this.t += 0.2) {
      this.act(0.2);
      celify(this.scene, true);
      r.render(this.scene, this.camera);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (buf[(y * w + x) * 4 + 3] > 40) {
            if (x / w < out.x0) out.x0 = x / w;
            if (x / w > out.x1) out.x1 = x / w;
            if (y / h < out.y0) out.y0 = y / h;
            if (y / h > out.y1) out.y1 = y / h;
          }
    }
    this.shadow.visible = true;
    this.t = 0;
    // (back to the full framing's terms: at half zoom every reach from the middle is half as far)
    if (!asFitted) for (const k of ['x0', 'x1', 'y0', 'y1'] as const) out[k] = 0.5 + (out[k] - 0.5) * 2;
    r.setSize(keep.x || px, keep.y || px, false);
    this.camera.aspect = keepAspect;
    return out;
  }

  /** fit the camera to this fighter's act: centred on it, as big as fits with a margin */
  private fitTo() {
    const m = this.measure();
    const aspect = this.camera.aspect || 1;
    // (its middle and half size, in the base framing's 0..1)
    const hx = Math.max(0.05, (m.x1 - m.x0) / 2);
    const hy = Math.max(0.05, (m.y1 - m.y0) / 2);
    this.fit = THREE.MathUtils.clamp(Math.min(0.43 / hx, 0.43 / hy), 0.4, 1.6);
    // the slide: from the picture's middle to the act's, in world units at the fighter's distance
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const half = this.baseDist() * tan;
    this.shift.set(((m.x0 + m.x1) / 2 - 0.5) * 2 * half * aspect, ((m.y0 + m.y1) / 2 - 0.5) * 2 * half);
    // (then its feet set down near the bottom, standing on the card, rather than floating mid-picture)
    const bottom = 0.06 + hy * this.fit;
    this.shift.y += ((0.5 - bottom) * 2 * half) / this.fit;
    this.frameCamera();
  }

  /** see resultHeroReach */
  reach(def: CharacterDef, outcome: Outcome) {
    this.ensure();
    if (this.unit) this.pivot.remove(this.unit.root);
    this.unit = new ShooterMesh(def.id, def.ball, def);
    this.pivot.add(this.unit.root);
    this.outcome = outcome;
    this.fitTo();
    return { fit: this.fit, ...this.measure(72, true) };
  }

  private act(dt: number) {
    const u = this.unit!;
    const t = this.t;
    u.sync(this.pose, t, dt);
    const p = this.pivot;
    p.position.set(0, 0, 0);
    p.rotation.set(0, 0, 0);
    p.scale.set(1, 1, 1);
    if (this.outcome === 'win') {
      // cheering: arms up and shouting, a run of hops, then a full twirl, round and round
      u.talkPose(t, 'shout', true, 0);
      const cyc = t % 3.2;
      const hop = cyc < 1.6 ? Math.abs(Math.sin(cyc * Math.PI * 2.5)) : 0;
      p.position.y = hop * 0.32;
      // (a squash as it lands, a stretch in the air)
      const land = cyc < 1.6 ? Math.max(0, 1 - hop * 4) : 0;
      p.scale.set(1 + land * 0.08, 1 - land * 0.1 + hop * 0.05, 1 + land * 0.08);
      const twirl = cyc > 1.7 && cyc < 2.5 ? ease((cyc - 1.7) / 0.8) : cyc >= 2.5 ? 1 : 0;
      p.rotation.y = t * 0.6 + twirl * Math.PI * 2;
      // and a dance under it all: a bounce on every beat, a step side to side, a sway of the body
      const beat = t * Math.PI * 2 * 1.1;
      p.position.y += Math.abs(Math.sin(beat)) * 0.06;
      p.position.x = Math.sin(beat / 2) * 0.1;
      p.rotation.z = Math.sin(beat / 2) * 0.12;
      p.rotation.x = Math.sin(beat) * 0.04;
    } else if (this.outcome === 'lose') {
      // sad: its own moping act (head hung, crying into a hand, shaking its head, sighing, scuffing
      // a foot), turning slowly away as if it can't look at you
      u.sadPose(t);
      p.rotation.y = t * 0.3;
    } else {
      u.talkPose(t, 'say', false, 0);
      p.rotation.y = t * 0.5;
    }
  }
}

const ease = (u: number) => {
  const c = Math.max(0, Math.min(1, u));
  return c * c * (3 - 2 * c);
};

/** a burst of confetti behind the fighter, partly in its marble's colour */
function confetti(ball: number): HTMLElement {
  const box = document.createElement('div');
  box.className = 'rh-confetti';
  const mine = '#' + ball.toString(16).padStart(6, '0');
  const cols = [mine, '#ffd23e', '#ff6a8a', '#5ad8ff', mine, '#8dff5a'];
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('i');
    s.style.left = `${4 + Math.random() * 92}%`;
    s.style.background = cols[i % cols.length];
    s.style.animationDelay = `${(Math.random() * 2.4).toFixed(2)}s`;
    s.style.animationDuration = `${(2.2 + Math.random() * 1.6).toFixed(2)}s`;
    s.style.setProperty('--sx', `${(Math.random() * 60 - 30).toFixed(0)}px`);
    s.style.setProperty('--r', `${(Math.random() * 720 - 360).toFixed(0)}deg`);
    box.appendChild(s);
  }
  return box;
}

let hero: Hero | null = null;
/** your fighter on this result card, acting out the outcome (replaces whatever was in the box) */
export function showResultHero(host: HTMLElement, def: CharacterDef, outcome: Outcome) {
  (hero ??= new Hero()).show(host, def, outcome);
}
export function stopResultHero() {
  hero?.stop();
}

/**
 * (debugging: the fit and slide a fighter's act gets on the card)
 */
export function resultHeroReach(def: CharacterDef, outcome: Outcome) {
  const h = (hero ??= new Hero()) as unknown as { reach(def: CharacterDef, o: Outcome): { fit: number; x0: number; x1: number; y0: number; y1: number } };
  return h.reach(def, outcome);
}
