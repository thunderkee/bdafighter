import * as THREE from 'three';

/**
 * Modular parts: small add-ons that fit any fighter. Each one is built from a few plain shapes
 * in the fighter's own colours, and placed by measuring the fighter's upper body: a hat on top
 * of the head, a pack on the back, a pair on the shoulders. Sized to the fighter, so the same
 * crown sits right on Blossom and on Unit Violet.
 */
export type AddonSlot = 'hat' | 'back' | 'shoulder';
export const ADDONS: Record<AddonSlot, { id: string; name: string }[]> = {
  hat: [
    { id: 'crown', name: 'Crown' },
    { id: 'horns', name: 'Horns' },
    { id: 'antenna', name: 'Antenna' },
    { id: 'tophat', name: 'Top hat' },
    { id: 'halo', name: 'Halo' },
    { id: 'mohawk', name: 'Mohawk' },
  ],
  back: [
    { id: 'jetpack', name: 'Jetpack' },
    { id: 'wings', name: 'Wings' },
    { id: 'backpack', name: 'Backpack' },
    { id: 'fin', name: 'Shark fin' },
  ],
  shoulder: [
    { id: 'spikes', name: 'Spikes' },
    { id: 'pads', name: 'Armour pads' },
    { id: 'rockets', name: 'Rocket pods' },
  ],
};

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
function hat(id: string, p: Pal): THREE.Object3D {
  const g = new THREE.Group();
  switch (id) {
    case 'crown': {
      const m = mat(GOLD);
      g.add(at(mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.14, 10), m), 0, 0.07, 0));
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        g.add(at(mesh(new THREE.ConeGeometry(0.07, 0.2, 4), m), Math.sin(a) * 0.22, 0.22, Math.cos(a) * 0.22));
      }
      g.add(at(mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(p.accent === GOLD ? 0xee5466 : p.accent)), 0, 0.08, -0.27));
      break;
    }
    case 'horns':
      for (const s of [-1, 1]) g.add(at(mesh(new THREE.ConeGeometry(0.08, 0.42, 6), mat(CREAM)), s * 0.22, 0.18, 0, 0, 0, -s * 0.5));
      break;
    case 'antenna':
      g.add(at(mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.5, 6), mat(p.joint)), 0.08, 0.25, 0));
      g.add(at(mesh(new THREE.SphereGeometry(0.07, 10, 8), glowMat(p.eye)), 0.08, 0.52, 0));
      break;
    case 'tophat':
      g.add(at(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 16), mat(p.joint)), 0, 0.02, 0));
      g.add(at(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.42, 16), mat(p.joint)), 0, 0.24, 0));
      g.add(at(mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.07, 16), mat(p.accent)), 0, 0.09, 0));
      break;
    case 'halo':
      g.add(at(mesh(new THREE.TorusGeometry(0.26, 0.035, 8, 26), glowMat(0xffe08a)), 0, 0.26, 0, Math.PI / 2));
      break;
    case 'mohawk':
      for (let k = 0; k < 5; k++) g.add(at(mesh(new THREE.ConeGeometry(0.06, 0.26 - Math.abs(k - 2) * 0.04, 4), mat(p.accent)), 0, 0.12, -0.24 + k * 0.12, -0.15 + k * 0.08));
      break;
  }
  return g;
}

function back(id: string, p: Pal): THREE.Object3D {
  const g = new THREE.Group();
  switch (id) {
    case 'jetpack':
      for (const s of [-1, 1]) {
        g.add(at(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 10), mat(p.trim)), s * 0.14, 0, 0.1));
        g.add(at(mesh(new THREE.ConeGeometry(0.11, 0.16, 10), mat(p.joint)), s * 0.14, -0.31, 0.1, Math.PI));
        g.add(at(mesh(new THREE.ConeGeometry(0.07, 0.22, 8), glowMat(0xffb24a)), s * 0.14, -0.48, 0.1, Math.PI));
      }
      g.add(at(mesh(new THREE.BoxGeometry(0.2, 0.36, 0.14), mat(p.accent)), 0, 0.02, 0.06));
      break;
    case 'wings':
      for (const s of [-1, 1]) {
        const w = new THREE.Group();
        w.add(at(mesh(new THREE.BoxGeometry(0.62, 0.05, 0.26), mat(p.accent)), s * 0.34, 0, 0));
        w.add(at(mesh(new THREE.BoxGeometry(0.42, 0.04, 0.2), mat(CREAM)), s * 0.5, 0.03, 0.04));
        w.rotation.set(0, 0, s * 0.5);
        w.position.set(s * 0.06, 0.08, 0.08);
        g.add(w);
      }
      break;
    case 'backpack':
      g.add(at(mesh(new THREE.BoxGeometry(0.5, 0.52, 0.26), mat(p.trim)), 0, 0, 0.12));
      g.add(at(mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), mat(p.accent)), 0, -0.08, 0.27));
      g.add(at(mesh(new THREE.BoxGeometry(0.54, 0.06, 0.3), mat(p.joint)), 0, 0.24, 0.12));
      break;
    case 'fin':
      g.add(at(mesh(new THREE.ConeGeometry(0.22, 0.6, 3), mat(p.body)), 0, 0.2, 0.16, 0.5, Math.PI / 6));
      break;
  }
  return g;
}

function shoulder(id: string, p: Pal): THREE.Object3D {
  // one side, built facing +x (mirrored for the other)
  const g = new THREE.Group();
  switch (id) {
    case 'spikes':
      for (let k = 0; k < 3; k++) g.add(at(mesh(new THREE.ConeGeometry(0.05, 0.22, 5), mat(CREAM)), 0.02, 0.06, -0.1 + k * 0.1, 0, 0, -0.4));
      break;
    case 'pads':
      g.add(at(mesh(new THREE.BoxGeometry(0.26, 0.1, 0.36), mat(p.trim)), 0.02, 0.04, 0, 0, 0, -0.25));
      g.add(at(mesh(new THREE.BoxGeometry(0.22, 0.04, 0.3), mat(p.accent)), 0.02, 0.1, 0, 0, 0, -0.25));
      break;
    case 'rockets':
      g.add(at(mesh(new THREE.BoxGeometry(0.2, 0.18, 0.34), mat(p.joint)), 0.04, 0.1, 0));
      for (const [y, z] of [[0.13, -0.08], [0.13, 0.06], [0.06, -0.08], [0.06, 0.06]]) g.add(at(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 8), mat(0xee5466)), 0.04, y, z - 0.15, Math.PI / 2));
      break;
  }
  return g;
}

/**
 * Bolt the chosen parts onto a built fighter: measured from its turret (the upper body that
 * aims and leans), so the parts move with it.
 */
export function attachParts(turret: THREE.Object3D, parts: Partial<Record<AddonSlot, string>>, pal: Pal) {
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
