import * as THREE from 'three';
import { ARENA } from './config';

/**
 * The cartoon arenas: flat floors with a bright play lane and one bold motif, chunky capped
 * bumpers, a few big simple props along each side and one backdrop piece on the horizon.
 * Everything is plain shapes in flat colours; the cel shading and its ink outlines (which
 * catch every silhouette against the sky) do the rest. Kept to a few dozen meshes a stage.
 */
export interface Toon {
  /** brighter skies and light, so the ink lines and dark fighters read */
  sky: number;
  fog: [number, number, number];
  hemi: [number, number, number];
  sun: [number, number];
  /** the floor: its base, the lighter play lane down the middle, darker bands at the sides */
  floor: number;
  lane: number;
  edge: number;
  /** the motif and line colour */
  line: number;
  apron: number;
  /** the bumpers: body and rounded cap (a glowing cap for the neon stages) */
  wall: number;
  cap: number;
  capGlow?: boolean;
}

export const TOON: Record<string, Toon> = {
  space: { sky: 0x1c2a66, fog: [0x1c2a66, 40, 110], hemi: [0xd8e6ff, 0x3a4a80, 1.9], sun: [0xffffff, 2.0], floor: 0x2e4078, lane: 0x4660aa, edge: 0x223060, line: 0x6af0ff, apron: 0x141e48, wall: 0x34467e, cap: 0x6af0ff, capGlow: true },
  beach: { sky: 0x7fd6ff, fog: [0xbfeaff, 50, 130], hemi: [0xffffff, 0xf0dcb0, 2.0], sun: [0xfff6e0, 2.4], floor: 0xf4d898, lane: 0xfff0c8, edge: 0xe6c07c, line: 0xffffff, apron: 0x2fc6d6, wall: 0x2fb0c8, cap: 0xff6a5a },
  lava: { sky: 0xff9a5a, fog: [0xff9a5a, 40, 110], hemi: [0xffd8b8, 0x7a2a10, 1.8], sun: [0xffe0b0, 2.0], floor: 0x6a4238, lane: 0x8a5a4c, edge: 0x4a2c26, line: 0xffb24a, apron: 0xff5a1a, wall: 0x3a2622, cap: 0xffb24a, capGlow: true },
  snow: { sky: 0xb8e2ff, fog: [0xd8eeff, 44, 120], hemi: [0xf4f8ff, 0x9ab8d8, 1.6], sun: [0xffffff, 1.8], floor: 0xe4f0fc, lane: 0xffffff, edge: 0xc8dcf0, line: 0x7ab8ee, apron: 0xf4f9ff, wall: 0x8ac8f0, cap: 0xffffff },
  city: { sky: 0x4a4aa8, fog: [0x5a5ab0, 44, 120], hemi: [0xd8dcff, 0x4a3a6a, 1.8], sun: [0xffe8c8, 1.9], floor: 0x464a58, lane: 0x5c6172, edge: 0x34363f, line: 0xffd23e, apron: 0x2a2c36, wall: 0xffd23e, cap: 0x2a2c36 },
  forest: { sky: 0x9ad8a0, fog: [0xb8e4b8, 40, 110], hemi: [0xf0fff0, 0x3a6a3a, 1.8], sun: [0xfffbe0, 1.9], floor: 0x5a9248, lane: 0x74ae5a, edge: 0x447636, line: 0xe8f8c8, apron: 0x3a6a30, wall: 0x8a5a34, cap: 0x6ac04a },
  river: { sky: 0xffba7a, fog: [0xffc896, 40, 110], hemi: [0xffe8d0, 0x5a4a7a, 1.8], sun: [0xffc080, 2.0], floor: 0xa87446, lane: 0xc28c58, edge: 0x8a5a34, line: 0xfff0c8, apron: 0x3a6aaa, wall: 0x6a4428, cap: 0xffd27a },
  cyber: { sky: 0x3a1268, fog: [0x3a1268, 40, 110], hemi: [0xe0c8ff, 0x3a1450, 1.8], sun: [0xffb0e8, 1.7], floor: 0x2e1a4a, lane: 0x442a6c, edge: 0x22123a, line: 0xff4ae0, apron: 0x1a0c30, wall: 0x2a1a44, cap: 0x2bf0ff, capGlow: true },
  soccer: { sky: 0x8cd2ff, fog: [0xc0e4ff, 46, 130], hemi: [0xffffff, 0x4a8a3a, 1.9], sun: [0xffffff, 2.1], floor: 0x3aa046, lane: 0x48b454, edge: 0x2e8a3a, line: 0xffffff, apron: 0x2f8036, wall: 0xffffff, cap: 0xe8312f },
};

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

/**
 * Paint the cartoon floor: the base, a lighter lane down the middle, darker side bands, soft
 * end zones in front of each rail and the arena's one motif in the centre. Flat fills only.
 */
export function paintToonFloor(c: CanvasRenderingContext2D, id: string, CW: number, CH: number, px: (x: number) => number, py: (y: number) => number, m: number) {
  const t = TOON[id];
  c.fillStyle = hex(t.floor);
  c.fillRect(0, 0, CW, CH);
  // darker bands along the walls, the bright lane where the fight is
  const band = CW * 0.12;
  c.fillStyle = hex(t.edge);
  c.fillRect(0, 0, band, CH);
  c.fillRect(CW - band, 0, band, CH);
  const lane = CW * 0.56;
  c.fillStyle = hex(t.lane);
  c.fillRect((CW - lane) / 2, 0, lane, CH);
  // end zones: a band across each end, in front of the rails
  for (const side of [-1, 1]) {
    const y0 = py(side * (ARENA.railY - 1.2));
    const y1 = py(side * (ARENA.railY + 1));
    c.fillStyle = hex(t.edge);
    c.globalAlpha = 0.55;
    c.fillRect(0, Math.min(y0, y1), CW, Math.abs(y1 - y0));
    c.globalAlpha = 1;
    c.fillStyle = hex(t.line);
    c.fillRect(0, side < 0 ? Math.max(y0, y1) - 6 : Math.min(y0, y1), CW, 6);
  }
  c.strokeStyle = hex(t.line);
  c.fillStyle = hex(t.line);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const cx = px(0);
  const cy = py(0);
  const r = 1.5 * m;
  c.lineWidth = 10;
  switch (id) {
    case 'space': {
      // a hex hatch
      c.beginPath();
      for (let k = 0; k < 6; k++) c.lineTo(cx + Math.cos((k * Math.PI) / 3) * r, cy + Math.sin((k * Math.PI) / 3) * r);
      c.closePath();
      c.stroke();
      c.globalAlpha = 0.25;
      c.fill();
      c.globalAlpha = 1;
      break;
    }
    case 'beach': {
      // a big starfish
      c.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        const rr = k % 2 ? r * 0.42 : r;
        c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      c.closePath();
      c.fillStyle = '#ff9a6a';
      c.fill();
      c.stroke();
      break;
    }
    case 'lava': {
      // a glowing crack star
      c.strokeStyle = hex(t.line);
      c.lineWidth = 14;
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3 + 0.3;
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5 + 10);
        c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        c.stroke();
      }
      c.beginPath();
      c.arc(cx, cy, r * 0.28, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'snow': {
      // a snowflake
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        const ex = cx + Math.cos(a) * r;
        const ey = cy + Math.sin(a) * r;
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(ex, ey);
        c.stroke();
        for (const s of [-1, 1]) {
          const mx = cx + Math.cos(a) * r * 0.6;
          const my = cy + Math.sin(a) * r * 0.6;
          c.beginPath();
          c.moveTo(mx, my);
          c.lineTo(mx + Math.cos(a + s * 0.7) * r * 0.3, my + Math.sin(a + s * 0.7) * r * 0.3);
          c.stroke();
        }
      }
      break;
    }
    case 'city': {
      // a crosswalk across the middle
      const w = 0.42 * m;
      for (let x = (CW - lane) / 2 + w * 0.5; x < (CW + lane) / 2 - w; x += w * 2) c.fillRect(x, cy - r * 0.6, w, r * 1.2);
      break;
    }
    case 'forest': {
      // a lily pad
      c.fillStyle = '#3e8a34';
      c.beginPath();
      c.moveTo(cx, cy);
      c.arc(cx, cy, r, -Math.PI / 2 + 0.35, -Math.PI / 2 - 0.35 + Math.PI * 2);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#ff8ac0';
      c.beginPath();
      c.arc(cx + r * 0.35, cy + r * 0.2, r * 0.18, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'river': {
      // a life ring
      c.lineWidth = r * 0.36;
      for (let k = 0; k < 8; k++) {
        c.strokeStyle = k % 2 ? '#ffffff' : '#e8463a';
        c.beginPath();
        c.arc(cx, cy, r * 0.8, (k * Math.PI) / 4, ((k + 1) * Math.PI) / 4);
        c.stroke();
      }
      break;
    }
    case 'cyber': {
      // a chip
      const s = r * 1.3;
      c.lineWidth = 10;
      c.strokeRect(cx - s / 2, cy - s / 2, s, s);
      c.globalAlpha = 0.25;
      c.fillRect(cx - s / 2, cy - s / 2, s, s);
      c.globalAlpha = 1;
      for (let k = 0; k < 5; k++) {
        const o = -s / 2 + ((k + 0.5) * s) / 5;
        c.fillRect(cx + o - 5, cy - s / 2 - 22, 10, 18);
        c.fillRect(cx + o - 5, cy + s / 2 + 4, 10, 18);
      }
      break;
    }
    case 'soccer': {
      // the pitch markings
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(0, cy);
      c.lineTo(CW, cy);
      c.stroke();
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.stroke();
      for (const side of [-1, 1]) {
        const y = py(side * ARENA.railY);
        const h = 3.4 * m;
        c.strokeRect(px(-3.2), side > 0 ? y : y - h, px(3.2) - px(-3.2), h);
      }
      break;
    }
  }
}

const lam = (color: number) => new THREE.MeshLambertMaterial({ color });
const glow = (color: number) => new THREE.MeshBasicMaterial({ color });
const put = <O extends THREE.Object3D>(o: O, x: number, y: number, z: number, s = 1) => {
  o.position.set(x, y, z);
  o.scale.setScalar(s);
  return o;
};

/** chunky bumpers: a solid body and a rounded cap along the top, split into blocks */
export function toonRails(g: THREE.Group, id: string) {
  const t = TOON[id];
  const L = ARENA.length;
  const th = ARENA.wallThickness;
  const body = lam(t.wall);
  const cap = t.capGlow ? glow(t.cap) : lam(t.cap);
  const seam = lam(new THREE.Color(t.wall).multiplyScalar(0.7).getHex());
  for (const side of [-1, 1]) {
    const x = side * (ARENA.width / 2 + th / 2);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(th + 0.08, 0.62, L), body);
    rail.position.set(x, 0.31, 0);
    g.add(rail);
    const top = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, L - 0.4, 4, 10), cap);
    top.rotation.x = Math.PI / 2;
    top.position.set(x, 0.66, 0);
    g.add(top);
    // seams every couple of metres: the wall reads as big padded blocks
    for (let z = -L / 2 + 2; z < L / 2 - 0.5; z += 2) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(th + 0.12, 0.5, 0.08), seam);
      s.position.set(x, 0.3, z);
      g.add(s);
    }
  }
}

// ---------- props: a handful of plain shapes each ----------
type Make = () => THREE.Object3D;
const grp = (...o: THREE.Object3D[]) => {
  const gg = new THREE.Group();
  gg.add(...o);
  return gg;
};
const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => put(new THREE.Mesh(geo, mat), x, y, z);

const palm: Make = () => {
  const trunk = lam(0xb07a44);
  const leaf = lam(0x3ab04a);
  const parts: THREE.Object3D[] = [];
  for (let k = 0; k < 4; k++) {
    const seg = mesh(new THREE.CylinderGeometry(0.2 - k * 0.02, 0.24 - k * 0.02, 1.1, 7), trunk, k * 0.18, 0.55 + k * 1.0, 0);
    seg.rotation.z = -0.12 * k;
    parts.push(seg);
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const f = mesh(new THREE.ConeGeometry(0.34, 2.4, 4), leaf, 0.6 + Math.cos(a) * 0.9, 4.2, Math.sin(a) * 0.9);
    f.rotation.set(Math.sin(a) * 1.4, 0, -Math.cos(a) * 1.4);
    parts.push(f);
  }
  return grp(...parts);
};
const umbrella: Make = () => grp(mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), lam(0xffffff), 0, 1.2, 0), mesh(new THREE.ConeGeometry(1.5, 0.7, 8), lam(0xff6a5a), 0, 2.5, 0));
const pine: Make = () => {
  const dark = lam(0x2e7a4a);
  const snow = lam(0xffffff);
  return grp(
    mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.9, 6), lam(0x8a5a34), 0, 0.45, 0),
    mesh(new THREE.ConeGeometry(1.4, 1.8, 7), dark, 0, 1.6, 0),
    mesh(new THREE.ConeGeometry(1.1, 1.5, 7), dark, 0, 2.5, 0),
    mesh(new THREE.ConeGeometry(0.75, 1.2, 7), dark, 0, 3.3, 0),
    mesh(new THREE.ConeGeometry(0.4, 0.6, 7), snow, 0, 3.9, 0),
  );
};
const snowman: Make = () => {
  const w = lam(0xffffff);
  return grp(mesh(new THREE.SphereGeometry(0.9, 10, 8), w, 0, 0.8, 0), mesh(new THREE.SphereGeometry(0.62, 10, 8), w, 0, 2.0, 0), mesh(new THREE.ConeGeometry(0.1, 0.5, 6), lam(0xff8a2a), 0, 2.05, -0.75), mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 8), lam(0x2a2a3a), 0, 2.75, 0));
};
const roundTree: Make = () => grp(mesh(new THREE.CylinderGeometry(0.28, 0.36, 2, 7), lam(0x8a5a34), 0, 1, 0), mesh(new THREE.IcosahedronGeometry(1.6, 0), lam(0x4ab04a), 0, 3.0, 0), mesh(new THREE.IcosahedronGeometry(1.0, 0), lam(0x5ac85a), 0.7, 3.8, 0.2));
const mushroom: Make = () => grp(mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.0, 8), lam(0xfff2dc), 0, 0.5, 0), mesh(new THREE.SphereGeometry(0.9, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), lam(0xe8463a), 0, 0.95, 0));
const rockSpire: Make = () => grp(mesh(new THREE.ConeGeometry(1.0, 3.6, 5), lam(0x3a2622), 0, 1.8, 0), mesh(new THREE.ConeGeometry(0.6, 2.2, 5), lam(0x4a302a), 0.9, 1.1, 0.3));
const lamp: Make = () => grp(mesh(new THREE.CylinderGeometry(0.1, 0.14, 4.2, 6), lam(0x2a2c36), 0, 2.1, 0), mesh(new THREE.BoxGeometry(1.0, 0.16, 0.3), lam(0x2a2c36), -0.4, 4.2, 0), mesh(new THREE.BoxGeometry(0.4, 0.14, 0.26), glow(0xffe08a), -0.75, 4.08, 0));
const trafficCone: Make = () => grp(mesh(new THREE.ConeGeometry(0.4, 1.0, 8), lam(0xff7a1a), 0, 0.5, 0), mesh(new THREE.CylinderGeometry(0.27, 0.32, 0.16, 8), lam(0xffffff), 0, 0.45, 0));
const post: Make = () => grp(mesh(new THREE.CylinderGeometry(0.22, 0.26, 2.4, 7), lam(0x6a4428), 0, 1.0, 0), mesh(new THREE.TorusGeometry(0.26, 0.07, 6, 10), lam(0xe8d8a8), 0, 1.6, 0));
const lantern: Make = () => grp(mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 5), lam(0x4a3020), 0, 1.5, 0), mesh(new THREE.SphereGeometry(0.4, 8, 6), glow(0xffd27a), 0, 3.1, 0));
const antenna: Make = () => grp(mesh(new THREE.CylinderGeometry(0.12, 0.2, 4, 6), lam(0x8a9ac8), 0, 2, 0), mesh(new THREE.SphereGeometry(0.3, 8, 6), glow(0xff5a5a), 0, 4.1, 0), mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 10), lam(0xc8d4f0), 0, 3.0, 0));
const crate: Make = () => grp(mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), lam(0x6a7ab8), 0, 0.7, 0), mesh(new THREE.BoxGeometry(1.46, 0.2, 1.46), glow(0x6af0ff), 0, 1.0, 0));
const neonPillar: Make = () => grp(mesh(new THREE.BoxGeometry(0.9, 5, 0.9), lam(0x2a1a44), 0, 2.5, 0), mesh(new THREE.BoxGeometry(0.96, 0.18, 0.96), glow(0xff4ae0), 0, 1.6, 0), mesh(new THREE.BoxGeometry(0.96, 0.18, 0.96), glow(0x2bf0ff), 0, 3.4, 0));
const floodlight: Make = () => grp(mesh(new THREE.CylinderGeometry(0.16, 0.22, 7, 6), lam(0xc8ccd6), 0, 3.5, 0), mesh(new THREE.BoxGeometry(1.8, 1.0, 0.3), lam(0x4a4e5a), 0, 7.2, 0), mesh(new THREE.BoxGeometry(1.6, 0.8, 0.1), glow(0xfffce0), 0, 7.2, 0.18));
const stand: Make = () => {
  const crowd = [0xe8312f, 0x2f63e8, 0xffc23d, 0xffffff];
  const parts: THREE.Object3D[] = [mesh(new THREE.BoxGeometry(2.4, 2.4, 7), lam(0x8a8e9a), 0, 1.2, 0)];
  for (let k = 0; k < 3; k++) parts.push(mesh(new THREE.BoxGeometry(0.7, 0.5, 6.6), lam(crowd[k % crowd.length]), -0.7 + k * 0.7, 1.6 + k * 0.5, 0));
  return grp(...parts);
};

/** what stands along each side of the table, by arena */
const SIDES: Record<string, Make[]> = {
  space: [antenna, crate, crate],
  beach: [palm, umbrella, palm],
  lava: [rockSpire, rockSpire, rockSpire],
  snow: [pine, snowman, pine],
  city: [lamp, trafficCone, lamp],
  forest: [roundTree, mushroom, roundTree],
  river: [lantern, post, lantern],
  cyber: [neonPillar, neonPillar, neonPillar],
  soccer: [floodlight, stand, floodlight],
};

/** the big piece on the horizon, filling the sky behind the far rail */
function backdrop(id: string): THREE.Object3D {
  switch (id) {
    case 'space': {
      const planet = mesh(new THREE.SphereGeometry(7, 20, 14), lam(0xff9a5a), 0, 0, 0);
      const ring = mesh(new THREE.TorusGeometry(11, 0.7, 6, 40), lam(0xffd27a), 0, 0, 0);
      ring.rotation.x = 1.25;
      const moon = mesh(new THREE.SphereGeometry(1.8, 12, 10), lam(0xc8d4f0), 14, 6, 2);
      return put(grp(planet, ring, moon), -6, 9, -48);
    }
    case 'lava': {
      // (off to one side, and lighter than the fighters, so the one at the far end stands out)
      const v = mesh(new THREE.CylinderGeometry(3.2, 16, 14, 9), lam(0x9a4a34), 0, 7, 0);
      const top = mesh(new THREE.CylinderGeometry(3.3, 3.4, 0.6, 9), glow(0xffd27a), 0, 14.2, 0);
      return put(grp(v, top), 22, 0, -50);
    }
    case 'snow':
      return put(grp(mesh(new THREE.ConeGeometry(9, 14, 6), lam(0x9ab8d8), 0, 7, 0), mesh(new THREE.ConeGeometry(3.9, 6, 6), lam(0xffffff), 0, 11, 0), mesh(new THREE.ConeGeometry(7, 10, 6), lam(0xb0cce4), 12, 5, 4), mesh(new THREE.ConeGeometry(2.6, 3.7, 6), lam(0xffffff), 12, 8.2, 4)), -4, 0, -50);
    case 'city': {
      const parts: THREE.Object3D[] = [];
      const cols = [0x6a6cc8, 0x7a7cd8, 0x5a5cb8];
      for (let k = 0; k < 9; k++) {
        const h = 6 + ((k * 7) % 9) * 1.6;
        parts.push(mesh(new THREE.BoxGeometry(4, h, 4), lam(cols[k % 3]), -18 + k * 4.5, h / 2, 0));
        parts.push(mesh(new THREE.BoxGeometry(2.6, 0.5, 0.1), glow(0xffd23e), -18 + k * 4.5, h * 0.7, 2.06));
      }
      return put(grp(...parts), 0, 0, -46);
    }
    case 'cyber': {
      const parts: THREE.Object3D[] = [];
      for (let k = 0; k < 8; k++) {
        const h = 10 + ((k * 5) % 7) * 2;
        parts.push(mesh(new THREE.BoxGeometry(3.4, h, 3.4), lam(0x5a2a98), -16 + k * 4.6, h / 2, 0));
        parts.push(mesh(new THREE.BoxGeometry(3.5, 0.3, 3.5), glow(k % 2 ? 0xff4ae0 : 0x2bf0ff), -16 + k * 4.6, h * 0.6, 0));
      }
      return put(grp(...parts), 0, 0, -46);
    }
    case 'forest':
      return put(grp(mesh(new THREE.SphereGeometry(12, 14, 10), lam(0x5aa050), -10, -4, 0), mesh(new THREE.SphereGeometry(10, 14, 10), lam(0x4a9046), 8, -3, 4)), 0, 0, -50);
    case 'river':
      return put(grp(mesh(new THREE.CircleGeometry(7, 24), glow(0xffe0a0), 0, 6, -2), mesh(new THREE.SphereGeometry(11, 14, 10), lam(0x7a5a8a), -12, -5, 3), mesh(new THREE.SphereGeometry(9, 14, 10), lam(0x6a4a7a), 10, -4, 4)), 0, 0, -50);
    case 'beach': {
      const stripes = [0xffffff, 0xe8463a];
      const parts: THREE.Object3D[] = [];
      for (let k = 0; k < 5; k++) parts.push(mesh(new THREE.CylinderGeometry(1.4 - k * 0.1, 1.5 - k * 0.1, 1.6, 10), lam(stripes[k % 2]), 0, 0.8 + k * 1.6, 0));
      parts.push(mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.2, 10), glow(0xfff2a0), 0, 8.6, 0));
      parts.push(mesh(new THREE.ConeGeometry(1.3, 1.2, 10), lam(0xe8463a), 0, 9.8, 0));
      parts.push(mesh(new THREE.SphereGeometry(6, 12, 8), lam(0x5ab84a), -4, -3.5, 2));
      return put(grp(...parts), 14, 0, -44);
    }
    case 'soccer': {
      const crowd = [0xe8312f, 0x2f63e8, 0xffc23d, 0xffffff, 0x1aa860];
      const parts: THREE.Object3D[] = [mesh(new THREE.BoxGeometry(44, 9, 6), lam(0x8a8e9a), 0, 4.5, 0)];
      for (let k = 0; k < 4; k++) parts.push(mesh(new THREE.BoxGeometry(42, 1.4, 0.4), lam(crowd[k]), 0, 2.2 + k * 1.8, 3.1 + k * 0.01));
      return put(grp(...parts), 0, 0, -40);
    }
  }
  return new THREE.Group();
}

/** the scenery round the table: three props a side and the horizon piece */
export function toonScenery(g: THREE.Group, id: string) {
  const makes = SIDES[id] ?? [];
  const W = ARENA.width;
  makes.forEach((make, k) => {
    for (const side of [-1, 1]) {
      const z = -8 + k * 7 + (side > 0 ? 1.5 : -1.5);
      const o = make();
      o.position.set(side * (W / 2 + 2.6 + (k % 2) * 1.2), 0, z);
      o.rotation.y = side * (0.4 + k * 0.5);
      g.add(o);
    }
  });
  // two more behind the far end, either side of the camera's view down the table
  if (makes[0])
    for (const side of [-1, 1]) {
      const o = makes[0]();
      o.position.set(side * (W / 2 + 1.5), 0, -ARENA.length / 2 - 3);
      g.add(o);
    }
  // (the camera looks down the table: only a strip above the far wall shows, so the horizon
  // piece sits close behind it, scaled down, rising up out of that strip)
  const bd = backdrop(id);
  bd.position.set(bd.position.x * 0.6, bd.position.y * 0.35, -ARENA.length / 2 - 9);
  bd.scale.multiplyScalar(0.6);
  g.add(bd);
}
