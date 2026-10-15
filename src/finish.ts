import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// The units' finish: real (metal / roughness) materials with a soft studio reflection,
// machined-armour edges on every block (a bright chamfer highlight and an inset panel
// seam, worked out in world units so they stay crisp on any size of block), and decals,
// so each unit has its own character. Applied after a model is built, so it reaches
// built-in units and Unit Lab designs alike without touching their blocks.

export type Slot = 'body' | 'trim' | 'accent' | 'joint' | 'eye' | 'other';
/** metalness, roughness, and how much the colour glows on its own */
export interface Finish {
  m: number;
  r: number;
  glow?: number;
}
export type Emblem = 'wing' | 'claw' | 'star' | 'shield' | 'horn' | 'crown' | 'gear' | 'eye' | 'bolt' | 'hex' | 'fang' | 'flame' | 'skull';
export interface Look {
  slots: Partial<Record<Slot, Finish>>;
  emblem: Emblem;
  /** a short unit code for the shoulder badges */
  code: string;
  /** hazard stripes on the side armour */
  stripes?: boolean;
}

const F = (m: number, r: number, glow = 0): Finish => ({ m, r, glow });
const STEEL = F(0.7, 0.42);
export const LOOKS: Record<string, Look> = {
  angel: { slots: { body: F(0.12, 0.3), trim: F(0.25, 0.35), accent: F(0.2, 0.32), joint: STEEL }, emblem: 'wing', code: 'SZ-01' },
  dragon: { slots: { body: F(0.55, 0.28), trim: F(0.6, 0.35), accent: F(0.3, 0.3, 0.25), joint: F(0.75, 0.5) }, emblem: 'claw', code: 'WY-02' },
  pioneer: { slots: { body: F(0.08, 0.62), trim: F(0.1, 0.6), accent: F(0.15, 0.5), joint: F(0.6, 0.55) }, emblem: 'star', code: 'PN-03', stripes: true },
  liberty: { slots: { body: F(0.38, 0.24), trim: F(0.45, 0.3), accent: F(0.4, 0.25), joint: STEEL }, emblem: 'shield', code: 'LB-04' },
  monoceros: { slots: { body: F(0.6, 0.18), trim: F(0.65, 0.22), accent: F(0.4, 0.25, 0.2), joint: F(0.85, 0.3) }, emblem: 'horn', code: 'MC-05' },
  baron: { slots: { body: F(0.62, 0.24), trim: F(0.5, 0.3), accent: F(0.7, 0.25), joint: F(0.75, 0.45) }, emblem: 'crown', code: 'CB-06' },
  bastion: { slots: { body: F(0.2, 0.72), trim: F(0.25, 0.7), accent: F(0.1, 0.6), joint: F(0.65, 0.6) }, emblem: 'gear', code: 'BS-07', stripes: true },
  nightshade: { slots: { body: F(0.45, 0.48), trim: F(0.5, 0.45), accent: F(0.2, 0.4, 0.75), joint: F(0.7, 0.5) }, emblem: 'eye', code: 'NS-08' },
  violet: { slots: { body: F(0.25, 0.32), trim: F(0.4, 0.45), accent: F(0.1, 0.35, 0.55), joint: STEEL }, emblem: 'bolt', code: 'UV-09' },
  kabuto: { slots: { body: F(0.05, 0.2), trim: F(0.3, 0.4), accent: F(0.1, 0.3), joint: F(0.55, 0.45) }, emblem: 'hex', code: 'KB-10' },
  tyrant: { slots: { body: F(0.55, 0.3), trim: F(0.5, 0.32), accent: F(0.2, 0.4), joint: F(0.6, 0.4) }, emblem: 'skull', code: 'TK-11' },
  rex: { slots: { body: F(0.62, 0.38), trim: F(0.55, 0.4), accent: F(0.3, 0.35, 0.3), joint: F(0.8, 0.45) }, emblem: 'fang', code: 'RX-12', stripes: true },
  liger: { slots: { body: F(0.35, 0.28), trim: F(0.65, 0.4), accent: F(0.75, 0.3), joint: F(0.7, 0.45) }, emblem: 'claw', code: 'FL-13' },
  ember: { slots: { body: F(0.05, 0.58), trim: F(0.1, 0.55), accent: F(0.1, 0.5, 0.4), joint: F(0.3, 0.6) }, emblem: 'flame', code: 'EL-14' },
};
const DEFAULT_LOOK: Look = { slots: {}, emblem: 'star', code: 'MF-00' };
const DEFAULT_FINISH: Record<Slot, Finish> = { body: F(0.2, 0.4), trim: F(0.3, 0.45), accent: F(0.2, 0.4), joint: STEEL, eye: F(0, 0.4), other: F(0.25, 0.45) };
export const lookFor = (id: string, base?: string) => LOOKS[id] ?? (base ? LOOKS[base] : undefined) ?? DEFAULT_LOOK;

// ---------- studio reflection ----------
const envs = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();
/** a soft room reflection for metal to pick up (one per renderer) */
export function studioEnv(renderer: THREE.WebGLRenderer) {
  let env = envs.get(renderer);
  if (!env) {
    const pm = new THREE.PMREMGenerator(renderer);
    env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    envs.set(renderer, env);
  }
  return env;
}

// ---------- machined-armour edges ----------
/** inject the edge highlight + panel seam into a standard material */
function armour(mat: THREE.MeshStandardMaterial) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aFace;\nvarying vec2 vFaceUv;\nvarying vec2 vFace;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvFaceUv = uv;\nvFace = aFace;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFaceUv;\nvarying vec2 vFace;\nfloat mfRim = 0.0;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        if (vFace.x > 0.0) {
          // distance to the face's nearest edge, in world units
          vec2 dd = min(vFaceUv, 1.0 - vFaceUv) * vFace;
          float e = min(dd.x, dd.y);
          float big = step(0.11, min(vFace.x, vFace.y));
          mfRim = 1.0 - smoothstep(0.0, 0.022, e);
          float seam = big * smoothstep(0.034, 0.04, e) * (1.0 - smoothstep(0.04, 0.047, e));
          // a soft shadow just inside the highlight sells the chamfer
          float lip = (1.0 - smoothstep(0.022, 0.034, e)) * (1.0 - mfRim);
          diffuseColor.rgb *= 1.0 - seam * 0.6 - lip * 0.18;
          // dark paint gets a bright chamfer; light paint (which can't get brighter) a crisp darker edge
          float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          vec3 edgeCol = lum > 0.62 ? diffuseColor.rgb * 0.72 : min(vec3(1.0), diffuseColor.rgb * 1.6 + 0.1);
          diffuseColor.rgb = mix(diffuseColor.rgb, edgeCol, mfRim * 0.85);
        }`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, roughnessFactor * 0.45, mfRim);');
  };
  mat.customProgramCacheKey = () => 'mf-armour';
}

/**
 * Give every box block its faces' real sizes (world units, rest pose), so the edge
 * highlight and seams come out the same width on big plates and thin trim alike.
 */
function tagFaces(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const scl = new THREE.Vector3();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.geometry.type !== 'BoxGeometry') return;
    const geo = mesh.geometry as THREE.BoxGeometry;
    const { width, height, depth } = geo.parameters;
    new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld).decompose(new THREE.Vector3(), new THREE.Quaternion(), scl);
    const w = width * Math.abs(scl.x);
    const h = height * Math.abs(scl.y);
    const d = depth * Math.abs(scl.z);
    // BoxGeometry face order: +x, -x (u = depth, v = height), +y, -y (u = width, v = depth), +z, -z (u = width, v = height)
    const sizes = [
      [d, h],
      [d, h],
      [w, d],
      [w, d],
      [w, h],
      [w, h],
    ];
    const count = geo.getAttribute('position').count;
    const per = count / 6;
    const arr = new Float32Array(count * 2);
    for (let f = 0; f < 6; f++) for (let k = 0; k < per; k++) arr.set(sizes[f], (f * per + k) * 2);
    geo.setAttribute('aFace', new THREE.BufferAttribute(arr, 2));
  });
}

// ---------- decals ----------
const decalTex = new Map<string, THREE.CanvasTexture>();
function canvasTex(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  let t = decalTex.get(key);
  if (!t) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    draw(cv.getContext('2d')!);
    t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    decalTex.set(key, t);
  }
  return t;
}
const css = (n: number) => '#' + n.toString(16).padStart(6, '0');

/** a unit's emblem, drawn as a bold silhouette with a dark outline */
function emblemTex(kind: Emblem, color: number) {
  return canvasTex(`emblem-${kind}-${color}`, 256, 256, (c) => {
    c.translate(128, 128);
    c.lineJoin = 'round';
    const shape = () => {
      c.beginPath();
      switch (kind) {
        case 'wing':
          for (const s of [-1, 1]) {
            c.moveTo(0, 30);
            c.lineTo(s * 100, -60);
            c.lineTo(s * 80, -20);
            c.lineTo(s * 105, -25);
            c.lineTo(s * 70, 15);
            c.lineTo(s * 90, 15);
            c.lineTo(s * 30, 60);
            c.closePath();
          }
          break;
        case 'claw':
          for (const x of [-55, 0, 55]) {
            c.moveTo(x - 22, 80);
            c.quadraticCurveTo(x - 20, -40, x + 18, -95);
            c.quadraticCurveTo(x + 6, -20, x + 22, 80);
            c.closePath();
          }
          break;
        case 'star':
          for (let i = 0; i < 10; i++) {
            const r = i % 2 ? 42 : 105;
            const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
            if (i) c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            else c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          c.closePath();
          break;
        case 'shield':
          c.moveTo(0, -100);
          c.lineTo(90, -65);
          c.quadraticCurveTo(85, 50, 0, 105);
          c.quadraticCurveTo(-85, 50, -90, -65);
          c.closePath();
          break;
        case 'horn':
          c.moveTo(-26, 95);
          c.lineTo(0, -110);
          c.lineTo(26, 95);
          c.closePath();
          c.moveTo(-80, 40);
          c.lineTo(-40, 10);
          c.lineTo(-45, 60);
          c.closePath();
          c.moveTo(80, 40);
          c.lineTo(40, 10);
          c.lineTo(45, 60);
          c.closePath();
          break;
        case 'crown':
          c.moveTo(-100, 70);
          c.lineTo(-100, -50);
          c.lineTo(-50, 0);
          c.lineTo(0, -85);
          c.lineTo(50, 0);
          c.lineTo(100, -50);
          c.lineTo(100, 70);
          c.closePath();
          break;
        case 'gear':
          for (let i = 0; i < 16; i++) {
            const r = i % 2 ? 78 : 104;
            const a0 = (i / 16) * Math.PI * 2;
            const a1 = ((i + 1) / 16) * Math.PI * 2;
            c.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
            c.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
          }
          c.closePath();
          c.moveTo(38, 0);
          c.arc(0, 0, 38, 0, Math.PI * 2, true);
          break;
        case 'eye':
          c.moveTo(-110, 0);
          c.quadraticCurveTo(0, -95, 110, 0);
          c.quadraticCurveTo(0, 95, -110, 0);
          c.closePath();
          c.moveTo(34, 0);
          c.arc(0, 0, 34, 0, Math.PI * 2, true);
          break;
        case 'bolt':
          c.moveTo(30, -110);
          c.lineTo(-60, 15);
          c.lineTo(-5, 15);
          c.lineTo(-30, 110);
          c.lineTo(65, -20);
          c.lineTo(10, -20);
          c.closePath();
          break;
        case 'hex':
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
            c.lineTo(Math.cos(a) * 100, Math.sin(a) * 100);
          }
          c.closePath();
          c.moveTo(0, -55);
          c.lineTo(0, 55);
          break;
        case 'fang':
          c.moveTo(-95, -70);
          c.lineTo(95, -70);
          c.lineTo(60, -40);
          c.lineTo(35, 100);
          c.lineTo(10, -40);
          c.lineTo(-10, -40);
          c.lineTo(-35, 100);
          c.lineTo(-60, -40);
          c.closePath();
          break;
        case 'flame':
          c.moveTo(0, 105);
          c.bezierCurveTo(-95, 90, -80, -10, -20, -55);
          c.bezierCurveTo(-25, -10, 5, 0, 10, -110);
          c.bezierCurveTo(70, -50, 100, 70, 0, 105);
          c.closePath();
          break;
        case 'skull':
          c.arc(0, -15, 85, Math.PI * 0.85, Math.PI * 2.15);
          c.lineTo(45, 95);
          c.lineTo(-45, 95);
          c.closePath();
          c.moveTo(-12, -10);
          c.arc(-35, -10, 23, 0, Math.PI * 2, true);
          c.moveTo(58, -10);
          c.arc(35, -10, 23, 0, Math.PI * 2, true);
          break;
      }
    };
    shape();
    c.lineWidth = 22;
    c.strokeStyle = 'rgba(10,12,20,0.9)';
    c.stroke();
    c.fillStyle = css(color);
    c.fill('evenodd');
    c.lineWidth = 5;
    c.strokeStyle = 'rgba(255,255,255,0.55)';
    c.stroke();
  });
}

/** the shoulder badge: unit code in a cut-corner plate */
function badgeTex(code: string, color: number) {
  return canvasTex(`badge-${code}-${color}`, 256, 128, (c) => {
    const k = 22;
    c.beginPath();
    c.moveTo(k, 8);
    c.lineTo(248, 8);
    c.lineTo(248, 120 - k);
    c.lineTo(248 - k, 120);
    c.lineTo(8, 120);
    c.lineTo(8, 8 + k);
    c.closePath();
    c.fillStyle = 'rgba(10,12,20,0.82)';
    c.fill();
    c.lineWidth = 6;
    c.strokeStyle = css(color);
    c.stroke();
    c.fillStyle = css(color);
    c.font = '900 64px Orbitron, "Arial Black", Impact, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(code, 128, 68);
  });
}

/** diagonal warning stripes */
function stripeTex(color: number) {
  return canvasTex(`stripes-${color}`, 128, 128, (c) => {
    c.fillStyle = 'rgba(12,12,16,0.9)';
    c.fillRect(0, 0, 128, 128);
    c.fillStyle = css(color);
    for (let x = -128; x < 256; x += 48) {
      c.beginPath();
      c.moveTo(x, 128);
      c.lineTo(x + 24, 128);
      c.lineTo(x + 152, 0);
      c.lineTo(x + 128, 0);
      c.closePath();
      c.fill();
    }
  });
}

type FaceRef = { mesh: THREE.Mesh; across: number; up: number; center: THREE.Vector3; normal: THREE.Vector3 };

/** every box face, measured in the model's own space (rest pose): its centre, normal, and its horizontal and vertical extent */
function boxFaces(root: THREE.Object3D): FaceRef[] {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const out: FaceRef[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.geometry.type !== 'BoxGeometry' || mesh.userData.labHelper || mesh.userData.decal) return;
    const mat = mesh.material as THREE.Material;
    if ((mat as THREE.MeshBasicMaterial).isMeshBasicMaterial || mat.transparent) return;
    const { width, height, depth } = (mesh.geometry as THREE.BoxGeometry).parameters;
    const half = [width / 2, height / 2, depth / 2];
    const m = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
    // the block's three edges, as vectors in model space (scale included)
    const edge = [0, 1, 2].map((a) => new THREE.Vector3().setComponent(a, half[a] * 2).applyMatrix3(new THREE.Matrix3().setFromMatrix4(m)));
    for (const axis of [0, 1, 2])
      for (const sign of [1, -1]) {
        const local = new THREE.Vector3().setComponent(axis, half[axis] * sign);
        const normal = edge[axis].clone().normalize().multiplyScalar(sign);
        const [a, b] = [0, 1, 2].filter((k) => k !== axis).map((k) => edge[k]);
        // which in-plane edge runs up and which runs across
        const aUp = Math.abs(a.clone().normalize().y) > Math.abs(b.clone().normalize().y);
        out.push({ mesh, up: (aUp ? a : b).length(), across: (aUp ? b : a).length(), center: local.applyMatrix4(m), normal });
      }
  });
  return out;
}

/** stick a decal flat on a box face, centred and upright, at `fill` of the room it has */
function placeDecal(root: THREE.Object3D, face: FaceRef, tex: THREE.Texture, aspect: number, fill: number, mats: THREE.Material[]) {
  const size = Math.min(face.across / aspect, face.up) * fill;
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.35, roughness: 0.45, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  mats.push(mat);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(size * aspect, size), mat);
  plane.userData.decal = true;
  // built in model space, facing out along the face's normal, then carried by its block
  root.add(plane);
  plane.position.copy(face.center).addScaledVector(face.normal, 0.004);
  plane.lookAt(plane.position.clone().add(face.normal));
  plane.updateMatrixWorld(true);
  face.mesh.attach(plane);
}

/** nothing else of the model sits right in front of this face's centre */
const ray = new THREE.Raycaster();
function exposed(root: THREE.Object3D, f: FaceRef) {
  const from = f.center.clone().addScaledVector(f.normal, 0.6);
  ray.set(from, f.normal.clone().negate());
  ray.far = 0.62;
  const hit = ray.intersectObject(root, true).find((h) => (h.object as THREE.Mesh).isMesh && !h.object.userData.decal && !h.object.userData.labHelper);
  return !!hit && hit.object === f.mesh && hit.distance > 0.58;
}

/** chest emblem, shoulder badges and (some units) side stripes */
function addDecals(root: THREE.Object3D, look: Look, accent: number, mats: THREE.Material[]) {
  const faces = boxFaces(root);
  const pickFace = (list: FaceRef[]) => list.sort((a, b) => b.across * b.up - a.across * a.up).find((f) => exposed(root, f));
  const fwd = new THREE.Vector3(0, 0, -1);
  // the emblem: the biggest plate facing forward, near the middle, in the upper body
  const front = faces
    // chest height (below the head, so it never covers a face); the chest itself first, else a shoulder plate
    .filter((f) => f.normal.dot(fwd) > 0.85 && Math.abs(f.center.x) < 0.75 && f.center.y > 0.35 && f.center.y < 1.12 && Math.min(f.across, f.up) > 0.09);
  const centred = (f: FaceRef) => f.across * f.up * (Math.abs(f.center.x) < 0.22 ? 2.5 : 1);
  const frontFace = front.sort((a, b) => centred(b) - centred(a)).find((f) => exposed(root, f));
  if (frontFace) placeDecal(root, frontFace, emblemTex(look.emblem, accent), 1, 0.66, mats);
  // badges: the biggest outward-facing plate on each side, shoulder height or above
  for (const side of [-1, 1]) {
    const out = new THREE.Vector3(side, 0, 0);
    const plate = faces
      .filter((f) => f.normal.dot(out) > 0.85 && f.center.x * side > 0.2 && f.center.y > 0.55 && Math.min(f.across, f.up) > 0.1 && f.across * f.up > 0.02);
    const plateFace = pickFace(plate);
    if (plateFace) placeDecal(root, plateFace, badgeTex(look.code, accent), 2, 0.72, mats);
    if (look.stripes) {
      // hazard stripes low on the legs / flanks
      const low = faces
        .filter((f) => f.normal.dot(out) > 0.85 && f.center.x * side > 0.1 && f.center.y < 0.55 && f.center.y > 0.1 && Math.min(f.across, f.up) > 0.09 && f.mesh !== plateFace?.mesh);
      const lowFace = pickFace(low);
      if (lowFace) placeDecal(root, lowFace, stripeTex(0xffc23d), 1, 0.7, mats);
    }
  }
}

// ---------- the whole pass ----------
/**
 * Re-skin a built model: lit materials become standard (metal / roughness) materials with
 * armour edges, tuned per palette slot for this unit; then decals go on.
 * Returns the materials that should flash and glow with the unit.
 */
export function applyFinish(
  root: THREE.Object3D,
  look: Look,
  palette: { body: number; trim: number; accent: number; joint: number; eye: number },
): THREE.MeshStandardMaterial[] {
  const slotOf = (hex: number): Slot => {
    if (hex === palette.body) return 'body';
    if (hex === palette.trim) return 'trim';
    if (hex === palette.accent) return 'accent';
    if (hex === palette.joint) return 'joint';
    if (hex === palette.eye) return 'eye';
    return 'other';
  };
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  const lit: THREE.MeshStandardMaterial[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.labHelper) return;
    const src = mesh.material as THREE.Material;
    const lambert = (src as THREE.MeshLambertMaterial).isMeshLambertMaterial;
    const phong = (src as THREE.MeshPhongMaterial).isMeshPhongMaterial;
    if (!lambert && !phong) return;
    const s = src as THREE.MeshLambertMaterial | THREE.MeshPhongMaterial;
    const hex = s.color.getHex();
    const slot = slotOf(hex);
    const key = `${hex}|${slot}|${s.side}|${s.transparent ? 1 : 0}|${s.opacity}|${phong ? 1 : 0}|${s.blending}`;
    let mat = cache.get(key);
    if (!mat) {
      const fin = look.slots[slot] ?? DEFAULT_FINISH[slot];
      // near-white paint is held a touch below white so its shading survives bright stages
      const col = new THREE.Color(hex);
      const l = col.r * 0.299 + col.g * 0.587 + col.b * 0.114;
      if (l > 0.82) col.multiplyScalar(0.86);
      mat = new THREE.MeshStandardMaterial({
        color: col,
        side: s.side,
        transparent: s.transparent,
        opacity: s.opacity,
        blending: s.blending,
        depthWrite: s.depthWrite,
        // glossy (glass, canopies, marbles) stays glossy
        metalness: phong ? 0.1 : fin.m,
        roughness: phong ? 0.12 : fin.r,
        // reflections matter for metal; on enamel and plastic they'd only wash the colour out
        envMapIntensity: phong ? 0.6 : 0.25 + fin.m * 0.75,
      });
      if (fin.glow) mat.emissive.setHex(hex).multiplyScalar(fin.glow);
      mat.userData.baseEmissive = mat.emissive.clone();
      if (!phong) armour(mat);
      cache.set(key, mat);
      lit.push(mat);
    }
    mesh.material = mat;
  });
  tagFaces(root);
  const extra: THREE.Material[] = [];
  addDecals(root, look, palette.accent, extra);
  return lit;
}
