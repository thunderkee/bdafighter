import * as THREE from 'three';
import { paintPixel } from './decals';

/**
 * The 3D logo: MARBLE over FIGHTER, each letter built from chunky blocks like the fighters, every
 * block in the same pixel armour (lit rim, bevel, panel lines), set on a white slab that makes the
 * logo's outline. Rendered once to a picture: the title's logo, and the app's icons.
 */

/** a block letter: its bars on a grid 5 high (x, y from the bottom-left, w, h) */
type Bar = [number, number, number, number];
const GLYPH: Record<string, Bar[]> = {
  M: [[0, 0, 1, 5], [3, 0, 1, 5], [1, 3.4, 1, 1.1], [2, 3.4, 1, 1.1], [1.5, 2.4, 1, 1.4]],
  A: [[0, 0, 1, 4.3], [3, 0, 1, 4.3], [0.55, 4, 2.9, 1], [1, 1.8, 2, 0.95]],
  R: [[0, 0, 1, 5], [1, 4, 2.1, 1], [3, 2.7, 1, 2.1], [1, 2, 2.1, 0.95], [2.3, 0, 1, 2.1]],
  B: [[0, 0, 1, 5], [1, 4, 2.1, 1], [1, 2.05, 2.1, 0.9], [1, 0, 2.1, 1], [3, 2.9, 0.95, 1.5], [3, 0.6, 1, 1.6]],
  L: [[0, 0, 1, 5], [1, 0, 2.5, 1]],
  E: [[0, 0, 1, 5], [1, 4, 2.5, 1], [1, 2.05, 2, 0.9], [1, 0, 2.5, 1]],
  F: [[0, 0, 1, 5], [1, 4, 2.5, 1], [1, 2.05, 2, 0.9]],
  I: [[0, 0, 1, 5]],
  G: [[0, 0.6, 1, 3.8], [0.6, 4, 2.9, 1], [0.6, 0, 2.9, 1], [3, 0.6, 1, 1.8], [2, 1.9, 2, 0.85]],
  H: [[0, 0, 1, 5], [3, 0, 1, 5], [1, 2.05, 2, 0.9]],
  T: [[0, 4, 4, 1], [1.5, 0, 1, 4]],
};
const U = 0.2; // a grid unit, in world units
const DEPTH = 1.1; // a letter's thickness, in grid units
const OUTLINE = 0.34; // the white slab's margin round each bar, in grid units

/** one line of block letters, its blocks textured; returns the group and its width (grid units) */
function word(text: string, color: number, accent: number): { g: THREE.Group; w: number } {
  const g = new THREE.Group();
  let x = 0;
  const white = 0xf8f4ea;
  for (const ch of text) {
    const bars = GLYPH[ch];
    if (!bars) {
      x += 2.4;
      continue;
    }
    for (const [bx, by, bw, bh] of bars) {
      const at = new THREE.Vector3((x + bx + bw / 2) * U, (by + bh / 2) * U, 0);
      // the bar, in the fighters' pixel armour
      const geo = new THREE.BoxGeometry(bw * U, bh * U, DEPTH * U);
      const place = new THREE.Matrix4().makeTranslation(at.x, at.y, at.z);
      const map = paintPixel(geo, color, accent, place, `logo:${ch}:${bx}:${by}`);
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map, color: map ? 0xffffff : color }));
      m.position.copy(at);
      g.add(m);
      // the white slab behind it: the outline
      const sg = new THREE.BoxGeometry((bw + OUTLINE * 2) * U, (bh + OUTLINE * 2) * U, DEPTH * 0.8 * U);
      const sp = new THREE.Matrix4().makeTranslation(at.x, at.y, at.z - DEPTH * 0.32 * U);
      const smap = paintPixel(sg, white, accent, sp, `slab:${ch}:${bx}:${by}`);
      const s = new THREE.Mesh(sg, new THREE.MeshLambertMaterial({ map: smap, color: smap ? 0xffffff : white }));
      s.position.set(at.x, at.y, at.z - DEPTH * 0.32 * U);
      g.add(s);
    }
    const right = Math.max(...bars.map((b) => b[0] + b[2]));
    x += right + 0.7;
  }
  return { g, w: x - 0.7 };
}

export interface LogoOpts {
  /** the lines (the full logo, or a monogram) */
  lines?: [string, string];
  /** a backdrop: an app icon's dark tile (with a rim of light), or none (transparent) */
  bg?: 'tile' | null;
  /** an icon's safe area: the logo keeps inside this share of the picture */
  fit?: number;
}

/** the logo rendered to a canvas, w by h pixels */
export function logoCanvas(w: number, h: number, o: LogoOpts = {}): HTMLCanvasElement {
  const [l1, l2] = o.lines ?? ['MARBLE', 'FIGHTER'];
  const INK = 0x2e2a44;
  const ORANGE = 0xf0752e;
  const root = new THREE.Group();
  const a = word(l1, INK, ORANGE);
  const b = word(l2, ORANGE, INK);
  // (the second line sits a little to the right, as the flat logo had it)
  a.g.position.set(0, 6.1 * U, 0);
  b.g.position.set(0.9 * U, 0, 0);
  root.add(a.g, b.g);
  // centre it, then tilt it: a touch back and turned, and the old logo's lean
  const box = new THREE.Box3().setFromObject(root);
  const c = box.getCenter(new THREE.Vector3());
  for (const k of root.children) k.position.sub(c);
  const tilt = new THREE.Group();
  tilt.add(root);
  tilt.rotation.set(-0.16, 0.32, -0.07);
  const scene = new THREE.Scene();
  scene.add(tilt);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a5468, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(-3, 5, 6);
  scene.add(sun);
  // frame it: fit the tilted logo's bounds into the picture
  tilt.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(tilt);
  const size = bb.getSize(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(26, w / h, 0.1, 100);
  const fit = o.fit ?? 0.94;
  const tan = Math.tan(THREE.MathUtils.degToRad(13));
  const dist = Math.max(size.y / 2 / (tan * fit), size.x / 2 / (tan * (w / h) * fit)) + size.z;
  cam.position.set(0, 0, dist);
  cam.lookAt(0, 0, 0);
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(w, h, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.NeutralToneMapping;
  r.setClearColor(0x000000, 0);
  r.render(scene, cam);
  // onto a 2D canvas, over the icon's tile when it has one
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const g = out.getContext('2d')!;
  if (o.bg === 'tile') {
    const gr = g.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
    gr.addColorStop(0, '#3b3256');
    gr.addColorStop(0.6, '#221d33');
    gr.addColorStop(1, '#151220');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    // a soft orange glow behind the letters, like a marble's light
    const glow = g.createRadialGradient(w * 0.5, h * 0.55, 0, w * 0.5, h * 0.55, w * 0.42);
    glow.addColorStop(0, 'rgba(240,117,46,0.35)');
    glow.addColorStop(1, 'rgba(240,117,46,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
  }
  // (a dark drop shadow under the letters lifts them off whatever's behind)
  g.shadowColor = 'rgba(0,0,0,0.35)';
  g.shadowBlur = Math.round(w * 0.02);
  g.shadowOffsetY = Math.round(h * 0.015);
  g.drawImage(r.domElement, 0, 0);
  r.dispose();
  r.forceContextLoss();
  scene.traverse((m) => {
    const mesh = m as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  });
  return out;
}
