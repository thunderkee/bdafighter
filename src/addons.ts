import * as THREE from 'three';

/**
 * Modular parts: small add-ons bolted onto a fighter. Each one is built from a few plain shapes
 * and placed by measuring the fighter's upper body: a hat on top of the head, a pack on the
 * back, a pair on the shoulders, sized to the fighter. Which parts a fighter can wear, what
 * they're called and their colours are its own (see kits.ts); this is the shape library.
 */
export type AddonSlot = 'hat' | 'back' | 'shoulder';
/** a part: a shape from the library, in two colours (main and second; the fighter's own if left out) */
export interface PartSpec {
  shape: string;
  a?: number;
  b?: number;
}

interface Pal {
  body: number;
  trim: number;
  accent: number;
  joint: number;
  eye: number;
}
const GOLD = 0xe8b43a;
const CREAM = 0xf2ead8;

const mat = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0 });
const glowMat = (color: number) => new THREE.MeshBasicMaterial({ color });
const at = <O extends THREE.Object3D>(o: O, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  return o;
};
const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => {
  const o = new THREE.Mesh(g, m);
  o.castShadow = true;
  return o;
};

// ---------- the parts, built at unit size (scaled to the fighter afterwards) ----------
function hat({ shape, a, b }: PartSpec, p: Pal): THREE.Object3D {
  const g = new THREE.Group();
  const A = a ?? p.accent;
  const B = b ?? p.trim;
  switch (shape) {
    case 'crown': {
      const m = mat(a ?? GOLD);
      g.add(at(mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.14, 10), m), 0, 0.07, 0));
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        g.add(at(mesh(new THREE.ConeGeometry(0.07, 0.2, 4), m), Math.sin(a) * 0.22, 0.22, Math.cos(a) * 0.22));
      }
      g.add(at(mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(b ?? (p.accent === GOLD ? 0xee5466 : p.accent))), 0, 0.08, -0.27));
      break;
    }
    case 'horns':
      for (const s of [-1, 1]) g.add(at(mesh(new THREE.ConeGeometry(0.08, 0.42, 6), mat(a ?? CREAM)), s * 0.22, 0.18, 0, 0, 0, -s * 0.5));
      break;
    case 'antenna':
      g.add(at(mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.5, 6), mat(b ?? p.joint)), 0.08, 0.25, 0));
      g.add(at(mesh(new THREE.SphereGeometry(0.07, 10, 8), glowMat(a ?? p.eye)), 0.08, 0.52, 0));
      break;
    case 'tophat':
      g.add(at(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 16), mat(B)), 0, 0.02, 0));
      g.add(at(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.42, 16), mat(B)), 0, 0.24, 0));
      g.add(at(mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.07, 16), mat(A)), 0, 0.09, 0));
      break;
    case 'halo':
      g.add(at(mesh(new THREE.TorusGeometry(0.26, 0.035, 8, 26), glowMat(a ?? 0xffe08a)), 0, 0.26, 0, Math.PI / 2));
      break;
    case 'mohawk':
      for (let k = 0; k < 5; k++) g.add(at(mesh(new THREE.ConeGeometry(0.06, 0.26 - Math.abs(k - 2) * 0.04, 4), mat(A)), 0, 0.12, -0.24 + k * 0.12, -0.15 + k * 0.08));
      break;
    // a V-fin crest, swept up from the brow
    case 'vfin':
      for (const s of [-1, 1]) g.add(at(mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), mat(A)), s * 0.12, 0.18, -0.2, 0.2, 0, -s * 0.7));
      g.add(at(mesh(new THREE.BoxGeometry(0.1, 0.1, 0.06), mat(B)), 0, 0.03, -0.22));
      break;
    // one long horn from the brow
    case 'unihorn':
      g.add(at(mesh(new THREE.ConeGeometry(0.07, 0.6, 8), mat(A)), 0, 0.22, -0.16, -0.5));
      g.add(at(mesh(new THREE.TorusGeometry(0.075, 0.02, 6, 12), mat(B)), 0, 0.03, -0.12, Math.PI / 2 - 0.5));
      break;
    // a police light bar: red and blue
    case 'siren':
      g.add(at(mesh(new THREE.BoxGeometry(0.46, 0.06, 0.14), mat(B)), 0, 0.03, 0));
      g.add(at(mesh(new THREE.BoxGeometry(0.2, 0.1, 0.12), glowMat(a ?? 0xff3a3a)), -0.12, 0.11, 0));
      g.add(at(mesh(new THREE.BoxGeometry(0.2, 0.1, 0.12), glowMat(b ?? 0x3a7aff)), 0.12, 0.11, 0));
      break;
    // a single dome light
    case 'beacon':
      g.add(at(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.06, 12), mat(B)), 0, 0.03, 0));
      g.add(at(mesh(new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glowMat(A)), 0, 0.06, 0));
      break;
    // a plume of feathers swept back
    case 'plume':
      for (let k = 0; k < 4; k++) g.add(at(mesh(new THREE.ConeGeometry(0.05, 0.42, 5), mat(k % 2 ? B : A)), (k - 1.5) * 0.05, 0.22, 0.05 + k * 0.03, 0.6 + k * 0.12));
      break;
    // a pilot's cap with goggles
    case 'goggles':
      g.add(at(mesh(new THREE.SphereGeometry(0.27, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(B)), 0, 0, 0));
      for (const s of [-1, 1]) {
        g.add(at(mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 14), mat(0x2a2734)), s * 0.1, 0.12, -0.22, -0.3));
        g.add(at(mesh(new THREE.CircleGeometry(0.06, 14), glowMat(A)), s * 0.1, 0.12, -0.225, Math.PI - 0.3));
      }
      break;
    // pointed ears
    case 'ears':
      for (const s of [-1, 1]) {
        g.add(at(mesh(new THREE.ConeGeometry(0.11, 0.28, 4), mat(A)), s * 0.2, 0.12, 0, 0, Math.PI / 4, -s * 0.3));
        g.add(at(mesh(new THREE.ConeGeometry(0.06, 0.16, 4), mat(B)), s * 0.2, 0.1, -0.05, 0, Math.PI / 4, -s * 0.3));
      }
      break;
    // a lion's mane: spikes all round
    case 'mane':
      for (let k = 0; k < 9; k++) {
        const t = (k / 9) * Math.PI * 2;
        g.add(at(mesh(new THREE.ConeGeometry(0.07, 0.26, 5), mat(k % 2 ? B : A)), Math.sin(t) * 0.26, 0.04, Math.cos(t) * 0.26, Math.cos(t) * 1.1, 0, -Math.sin(t) * 1.1));
      }
      break;
    // a flower: petals round a centre
    case 'flower':
      for (let k = 0; k < 6; k++) {
        const t = (k / 6) * Math.PI * 2;
        const petal = mesh(new THREE.SphereGeometry(0.09, 10, 6), mat(A));
        petal.scale.set(1, 0.4, 1);
        g.add(at(petal, Math.sin(t) * 0.11 + 0.12, 0.08, Math.cos(t) * 0.11));
      }
      g.add(at(mesh(new THREE.SphereGeometry(0.06, 10, 8), mat(B)), 0.12, 0.1, 0));
      break;
    // a star that glows
    case 'star': {
      const st = new THREE.Group();
      for (let k = 0; k < 5; k++) st.add(at(mesh(new THREE.ConeGeometry(0.05, 0.16, 4), glowMat(A)), Math.sin((k / 5) * Math.PI * 2) * 0.08, Math.cos((k / 5) * Math.PI * 2) * 0.08, 0, 0, 0, -(k / 5) * Math.PI * 2));
      st.add(at(mesh(new THREE.SphereGeometry(0.06, 8, 6), glowMat(A)), 0, 0, 0));
      st.position.set(0, 0.38, 0);
      g.add(st);
      g.add(at(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), mat(B)), 0, 0.16, 0));
      break;
    }
    // a helmet dome with a stripe
    case 'dome':
      g.add(at(mesh(new THREE.SphereGeometry(0.29, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(A)), 0, -0.02, 0));
      g.add(at(mesh(new THREE.TorusGeometry(0.27, 0.035, 6, 20, Math.PI), mat(B)), 0, 0, 0, 0, Math.PI / 2));
      break;
    // insect feelers
    case 'feelers':
      for (const s of [-1, 1]) {
        g.add(at(mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.5, 5), mat(B)), s * 0.12, 0.22, -0.06, -0.4, 0, -s * 0.35));
        g.add(at(mesh(new THREE.SphereGeometry(0.045, 8, 6), glowMat(A)), s * 0.21, 0.45, -0.16));
      }
      break;
    // a ring of ice spikes
    case 'icecrown':
      for (let k = 0; k < 7; k++) {
        const t = (k / 7) * Math.PI * 2;
        g.add(at(mesh(new THREE.ConeGeometry(0.05, 0.18 + (k % 2) * 0.12, 5), glowMat(A)), Math.sin(t) * 0.2, 0.12, Math.cos(t) * 0.2));
      }
      g.add(at(mesh(new THREE.TorusGeometry(0.21, 0.025, 6, 20), mat(B)), 0, 0.03, 0, Math.PI / 2));
      break;
    // a hood's point, flopped back
    case 'hood':
      g.add(at(mesh(new THREE.ConeGeometry(0.28, 0.5, 8), mat(A)), 0, 0.12, 0.12, 0.7));
      g.add(at(mesh(new THREE.TorusGeometry(0.26, 0.03, 6, 16), mat(B)), 0, 0.02, 0, Math.PI / 2));
      break;
    // a spiked collar ring
    case 'spikering':
      for (let k = 0; k < 6; k++) {
        const t = (k / 6) * Math.PI * 2;
        g.add(at(mesh(new THREE.ConeGeometry(0.05, 0.2, 4), mat(A)), Math.sin(t) * 0.2, 0.1, Math.cos(t) * 0.2));
      }
      g.add(at(mesh(new THREE.TorusGeometry(0.21, 0.035, 6, 18), mat(B)), 0, 0.02, 0, Math.PI / 2));
      break;
    // a leaf sprouting on top
    case 'sprout':
      g.add(at(mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.16, 5), mat(B)), 0, 0.08, 0));
      for (const s of [-1, 1]) {
        const l = mesh(new THREE.SphereGeometry(0.1, 10, 6), mat(A));
        l.scale.set(1, 0.3, 0.5);
        g.add(at(l, s * 0.09, 0.17, 0, 0, 0, s * 0.4));
      }
      break;
    // a captain's peaked cap
    case 'cap':
      g.add(at(mesh(new THREE.CylinderGeometry(0.27, 0.24, 0.16, 16), mat(A)), 0, 0.08, 0));
      g.add(at(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16, 1, false, Math.PI / 2, Math.PI), mat(0x1f1c2a)), 0, 0.02, -0.12));
      g.add(at(mesh(new THREE.BoxGeometry(0.12, 0.07, 0.02), mat(b ?? GOLD)), 0, 0.1, -0.27));
      break;
  }
  return g;
}

function back({ shape, a, b }: PartSpec, p: Pal): THREE.Object3D {
  const g = new THREE.Group();
  const A = a ?? p.accent;
  const B = b ?? p.trim;
  switch (shape) {
    case 'jetpack':
      for (const s of [-1, 1]) {
        g.add(at(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 10), mat(B)), s * 0.14, 0, 0.1));
        g.add(at(mesh(new THREE.ConeGeometry(0.11, 0.16, 10), mat(p.joint)), s * 0.14, -0.31, 0.1, Math.PI));
        g.add(at(mesh(new THREE.ConeGeometry(0.07, 0.22, 8), glowMat(0xffb24a)), s * 0.14, -0.48, 0.1, Math.PI));
      }
      g.add(at(mesh(new THREE.BoxGeometry(0.2, 0.36, 0.14), mat(A)), 0, 0.02, 0.06));
      break;
    case 'wings':
      for (const s of [-1, 1]) {
        const w = new THREE.Group();
        w.add(at(mesh(new THREE.BoxGeometry(0.62, 0.05, 0.26), mat(A)), s * 0.34, 0, 0));
        w.add(at(mesh(new THREE.BoxGeometry(0.42, 0.04, 0.2), mat(b ?? CREAM)), s * 0.5, 0.03, 0.04));
        w.rotation.set(0, 0, s * 0.5);
        w.position.set(s * 0.06, 0.08, 0.08);
        g.add(w);
      }
      break;
    // feathered angel wings: a fan of long feathers each side
    case 'feathers':
      for (const s of [-1, 1])
        for (let k = 0; k < 4; k++) {
          const f = mesh(new THREE.BoxGeometry(0.12, 0.62 - k * 0.1, 0.03), mat(k % 2 ? B : A));
          g.add(at(f, s * (0.18 + k * 0.11), 0.22 - k * 0.04, 0.14, 0, 0, -s * (0.35 + k * 0.28)));
        }
      break;
    case 'backpack':
      g.add(at(mesh(new THREE.BoxGeometry(0.5, 0.52, 0.26), mat(B)), 0, 0, 0.12));
      g.add(at(mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), mat(A)), 0, -0.08, 0.27));
      g.add(at(mesh(new THREE.BoxGeometry(0.54, 0.06, 0.3), mat(p.joint)), 0, 0.24, 0.12));
      break;
    case 'fin':
      g.add(at(mesh(new THREE.ConeGeometry(0.22, 0.6, 3), mat(a ?? p.body)), 0, 0.2, 0.16, 0.5, Math.PI / 6));
      break;
    // a cape hanging from the shoulders
    case 'cape':
      g.add(at(mesh(new THREE.BoxGeometry(0.62, 0.86, 0.04), mat(A)), 0, -0.28, 0.2, 0.18));
      g.add(at(mesh(new THREE.BoxGeometry(0.66, 0.06, 0.08), mat(B)), 0, 0.14, 0.14));
      break;
    // two swords crossed on the back
    case 'swords':
      for (const s of [-1, 1]) {
        const sw = new THREE.Group();
        sw.add(at(mesh(new THREE.BoxGeometry(0.07, 0.8, 0.02), mat(a ?? 0xdfe6ee)), 0, 0.2, 0));
        sw.add(at(mesh(new THREE.BoxGeometry(0.22, 0.05, 0.05), mat(B)), 0, -0.22, 0));
        sw.add(at(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), mat(p.joint)), 0, -0.34, 0));
        sw.rotation.z = s * 0.6;
        sw.position.set(0, 0.04, 0.16);
        g.add(sw);
      }
      break;
    // a long cannon over one shoulder
    case 'cannon':
      g.add(at(mesh(new THREE.BoxGeometry(0.2, 0.26, 0.3), mat(B)), 0.16, 0.08, 0.14));
      g.add(at(mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.9, 10), mat(A)), 0.16, 0.24, -0.12, Math.PI / 2 - 0.25));
      g.add(at(mesh(new THREE.TorusGeometry(0.075, 0.02, 6, 12), mat(p.joint)), 0.16, 0.34, -0.5, 0.25));
      break;
    // two missile racks
    case 'missiles':
      for (const s of [-1, 1]) {
        g.add(at(mesh(new THREE.BoxGeometry(0.2, 0.34, 0.2), mat(B)), s * 0.18, 0.06, 0.14));
        for (const y of [0.0, 0.14]) g.add(at(mesh(new THREE.ConeGeometry(0.045, 0.16, 8), mat(A)), s * 0.18, 0.26 + y * 0.4, 0.1 + y * 0.3, -0.2));
      }
      break;
    // a war banner on a pole
    case 'banner':
      g.add(at(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6), mat(p.joint)), 0.2, 0.3, 0.18));
      g.add(at(mesh(new THREE.BoxGeometry(0.02, 0.36, 0.3), mat(A)), 0.2, 0.62, 0.34));
      g.add(at(mesh(new THREE.BoxGeometry(0.025, 0.12, 0.12), mat(B)), 0.2, 0.62, 0.34));
      break;
    // a propeller on a hub
    case 'rotor':
      g.add(at(mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.16, 10), mat(B)), 0, 0.06, 0.18, Math.PI / 2));
      for (const s of [-1, 1]) g.add(at(mesh(new THREE.BoxGeometry(0.08, 0.5, 0.02), mat(A)), 0, 0.06 + s * 0.27, 0.27));
      break;
    // a row of plates down the spine
    case 'spines':
      for (let k = 0; k < 4; k++) g.add(at(mesh(new THREE.ConeGeometry(0.12 - k * 0.015, 0.3 - k * 0.04, 3), mat(k % 2 ? B : A)), 0, 0.26 - k * 0.2, 0.18, 0.4));
      break;
    // a fan of petals
    case 'petals':
      for (let k = 0; k < 7; k++) {
        const t = -1.3 + (k / 6) * 2.6;
        const pe = mesh(new THREE.SphereGeometry(0.14, 10, 6), mat(k % 2 ? B : A));
        pe.scale.set(0.6, 1.6, 0.25);
        g.add(at(pe, Math.sin(t) * 0.3, 0.12 + Math.cos(t) * 0.3, 0.16, 0, 0, -t));
      }
      break;
    // a rounded shell
    case 'shell':
      g.add(at(mesh(new THREE.SphereGeometry(0.34, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(A)), 0, 0, 0.1, -Math.PI / 2));
      g.add(at(mesh(new THREE.TorusGeometry(0.33, 0.03, 6, 20), mat(B)), 0, 0, 0.1));
      break;
    // scuba tanks
    case 'tanks':
      for (const s of [-1, 1]) {
        g.add(at(mesh(new THREE.CapsuleGeometry(0.1, 0.36, 4, 10), mat(A)), s * 0.12, 0, 0.14));
        g.add(at(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 6), mat(B)), s * 0.12, 0.3, 0.14));
      }
      break;
    // ice crystals
    case 'crystals':
      for (let k = 0; k < 5; k++) {
        const c = mesh(new THREE.OctahedronGeometry(0.12 + (k % 2) * 0.05), glowMat(k % 2 ? B : A));
        c.scale.set(0.5, 1.6, 0.5);
        g.add(at(c, (k - 2) * 0.12, 0.24 - Math.abs(k - 2) * 0.06, 0.18, 0, 0, (k - 2) * 0.2));
      }
      break;
    // a big saw blade
    case 'saw':
      g.add(at(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 16), mat(a ?? 0xb8bfcc)), 0, 0.08, 0.18, Math.PI / 2));
      for (let k = 0; k < 12; k++) {
        const t = (k / 12) * Math.PI * 2;
        g.add(at(mesh(new THREE.ConeGeometry(0.04, 0.1, 3), mat(a ?? 0xb8bfcc)), Math.sin(t) * 0.38, 0.08 + Math.cos(t) * 0.38, 0.18, 0, 0, -t));
      }
      g.add(at(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10), mat(B)), 0, 0.08, 0.18, Math.PI / 2));
      break;
    // a ring of glowing thrusters
    case 'thrusters':
      g.add(at(mesh(new THREE.TorusGeometry(0.26, 0.05, 8, 20), mat(B)), 0, 0.06, 0.16));
      for (let k = 0; k < 4; k++) {
        const t = (k / 4) * Math.PI * 2 + Math.PI / 4;
        g.add(at(mesh(new THREE.SphereGeometry(0.06, 8, 6), glowMat(A)), Math.sin(t) * 0.26, 0.06 + Math.cos(t) * 0.26, 0.2));
      }
      break;
  }
  return g;
}

function shoulder({ shape, a, b }: PartSpec, p: Pal): THREE.Object3D {
  // one side, built facing +x (mirrored for the other)
  const g = new THREE.Group();
  const A = a ?? p.accent;
  const B = b ?? p.trim;
  switch (shape) {
    case 'spikes':
      for (let k = 0; k < 3; k++) g.add(at(mesh(new THREE.ConeGeometry(0.05, 0.22, 5), mat(a ?? CREAM)), 0.02, 0.06, -0.1 + k * 0.1, 0, 0, -0.4));
      break;
    case 'pads':
      g.add(at(mesh(new THREE.BoxGeometry(0.26, 0.1, 0.36), mat(B)), 0.02, 0.04, 0, 0, 0, -0.25));
      g.add(at(mesh(new THREE.BoxGeometry(0.22, 0.04, 0.3), mat(A)), 0.02, 0.1, 0, 0, 0, -0.25));
      break;
    case 'rockets':
      g.add(at(mesh(new THREE.BoxGeometry(0.2, 0.18, 0.34), mat(B)), 0.04, 0.1, 0));
      for (const [y, z] of [[0.13, -0.08], [0.13, 0.06], [0.06, -0.08], [0.06, 0.06]]) g.add(at(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 8), mat(a ?? 0xee5466)), 0.04, y, z - 0.15, Math.PI / 2));
      break;
    // a glowing orb floating above
    case 'orb':
      g.add(at(mesh(new THREE.SphereGeometry(0.09, 12, 8), glowMat(A)), 0.04, 0.22, 0));
      g.add(at(mesh(new THREE.TorusGeometry(0.12, 0.015, 6, 16), mat(B)), 0.04, 0.22, 0, Math.PI / 2));
      break;
    // a blade fin standing up
    case 'blade':
      g.add(at(mesh(new THREE.BoxGeometry(0.03, 0.34, 0.2), mat(a ?? 0xdfe6ee)), 0.04, 0.16, 0, 0, 0, -0.3));
      g.add(at(mesh(new THREE.BoxGeometry(0.14, 0.06, 0.24), mat(B)), 0.02, 0.02, 0));
      break;
    // a round shield
    case 'disc':
      g.add(at(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16), mat(A)), 0.06, 0.06, 0, 0, 0, -0.5));
      g.add(at(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.07, 12), mat(B)), 0.07, 0.07, 0, 0, 0, -0.5));
      break;
    // glowing flames
    case 'flames':
      for (let k = 0; k < 3; k++) g.add(at(mesh(new THREE.ConeGeometry(0.06, 0.2 + (k % 2) * 0.1, 6), glowMat(k % 2 ? B : A)), 0.02, 0.12, -0.08 + k * 0.08));
      break;
    // a cut gem
    case 'gem':
      g.add(at(mesh(new THREE.BoxGeometry(0.2, 0.06, 0.26), mat(B)), 0.02, 0.03, 0));
      g.add(at(mesh(new THREE.OctahedronGeometry(0.09), glowMat(A)), 0.02, 0.13, 0));
      break;
    // a couple of leaves
    case 'leaves':
      for (const z of [-0.06, 0.08]) {
        const l = mesh(new THREE.SphereGeometry(0.12, 10, 6), mat(z < 0 ? A : B));
        l.scale.set(0.4, 0.15, 1);
        g.add(at(l, 0.06, 0.06, z, 0, z * 4, -0.4));
      }
      break;
    // a little gun pod
    case 'gun':
      g.add(at(mesh(new THREE.BoxGeometry(0.16, 0.14, 0.2), mat(B)), 0.04, 0.1, 0));
      g.add(at(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), mat(A)), 0.04, 0.12, -0.2, Math.PI / 2));
      break;
    // gold epaulettes with a fringe
    case 'epaulette':
      g.add(at(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 14), mat(a ?? GOLD)), 0.02, 0.05, 0));
      for (let k = 0; k < 6; k++) g.add(at(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 4), mat(a ?? GOLD)), 0.08 + Math.cos(k) * 0.02, -0.02, -0.12 + k * 0.05));
      g.add(at(mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(B)), 0.02, 0.09, 0));
      break;
    // a tyre
    case 'wheel':
      g.add(at(mesh(new THREE.TorusGeometry(0.13, 0.06, 8, 16), mat(0x1f1c2a)), 0.06, 0.08, 0, 0, Math.PI / 2));
      g.add(at(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12), mat(A)), 0.06, 0.08, 0, 0, 0, Math.PI / 2));
      break;
    // ice shards
    case 'shards':
      for (let k = 0; k < 3; k++) {
        const c = mesh(new THREE.OctahedronGeometry(0.07), glowMat(k % 2 ? B : A));
        c.scale.set(0.6, 2, 0.6);
        g.add(at(c, 0.04, 0.14 + (k % 2) * 0.05, -0.1 + k * 0.1, 0, 0, -0.3));
      }
      break;
    // a beast's claw
    case 'claw':
      for (let k = 0; k < 3; k++) g.add(at(mesh(new THREE.ConeGeometry(0.04, 0.2, 5), mat(a ?? CREAM)), 0.1, 0.02, -0.08 + k * 0.08, 0, 0, -1.3));
      g.add(at(mesh(new THREE.BoxGeometry(0.16, 0.1, 0.28), mat(B)), 0.02, 0.04, 0));
      break;
  }
  return g;
}

/**
 * Bolt the chosen parts onto a built fighter: measured from its turret (the upper body that
 * aims and leans), so the parts move with it.
 */
export function attachParts(turret: THREE.Object3D, parts: Partial<Record<AddonSlot, PartSpec>>, pal: Pal) {
  if (!parts.hat && !parts.back && !parts.shoulder) return;
  // the upper body's shape, in the turret's own space
  turret.updateWorldMatrix(true, true);
  const inv = turret.matrixWorld.clone().invert();
  const all = new THREE.Box3();
  const boxes: THREE.Box3[] = [];
  turret.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld).applyMatrix4(inv);
    boxes.push(b);
    all.union(b);
  });
  if (all.isEmpty()) return;
  // the core: the middle column of the upper body (arms, guns and blades left out), and its height
  const cx = (b: THREE.Box3) => (b.min.x + b.max.x) / 2;
  const core = new THREE.Box3();
  for (const b of boxes) if (Math.abs(cx(b)) < 0.36 && b.max.x - b.min.x < 1.6) core.union(b);
  const C = core.isEmpty() ? all : core;
  const H = C.max.y - C.min.y;
  const k = Math.max(0.7, Math.min(1.6, H / 1.3));
  const kit = new THREE.Group();
  kit.name = 'parts';
  // top of the head: the highest part of the core
  if (parts.hat) {
    const top = new THREE.Box3();
    for (const b of boxes) if (Math.abs(cx(b)) < 0.36 && b.max.y > C.max.y - H * 0.28) top.union(b);
    const src = top.isEmpty() ? C : top;
    const o = hat(parts.hat, pal);
    o.scale.setScalar(k);
    o.position.set(cx(src), src.max.y - 0.04 * k, (src.min.z + src.max.z) / 2);
    kit.add(o);
  }
  // the chest band of the core: a pack on its back
  const chest = new THREE.Box3();
  for (const b of boxes) {
    const cy = (b.min.y + b.max.y) / 2;
    if (Math.abs(cx(b)) < 0.36 && cy > C.min.y + H * 0.2 && cy < C.min.y + H * 0.62) chest.union(b);
  }
  const band = chest.isEmpty() ? C : chest;
  if (parts.back) {
    const o = back(parts.back, pal);
    o.scale.setScalar(k);
    o.position.set(0, (band.min.y + band.max.y) / 2 + 0.05 * k, band.max.z - 0.02);
    kit.add(o);
  }
  // shoulders: the outer top corners of the chest (the widest pieces at that height, short of the arms' ends)
  if (parts.shoulder) {
    let sx = 0;
    let sy = band.max.y;
    for (const b of boxes) {
      const cy = (b.min.y + b.max.y) / 2;
      if (cy < band.min.y || cy > C.min.y + H * 0.78 || Math.abs(cx(b)) > 0.85) continue;
      const w = Math.max(Math.abs(b.min.x), Math.abs(b.max.x));
      if (w > sx) {
        sx = w;
        sy = Math.max(sy, b.max.y);
      }
    }
    sx = Math.max(sx, (band.max.x - band.min.x) / 2) * 0.9;
    for (const s of [-1, 1]) {
      const o = shoulder(parts.shoulder, pal);
      o.scale.set(s * k, k, k);
      o.position.set(s * sx, sy - 0.02 * k, (band.min.z + band.max.z) / 2);
      kit.add(o);
    }
  }
  turret.add(kit);
}
