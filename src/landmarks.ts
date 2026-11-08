import * as THREE from 'three';
import type { RoomKind } from './dungeon';

/** the one thing each kind of Dungeon Run room is remembered by, built from the stage's own colours */
export function landmark(kind: RoomKind, wall: number, fire: number): THREE.Group {
  const g = new THREE.Group();
  const stone = new THREE.Color(wall).lerp(new THREE.Color(0x8a8378), 0.45).getHex();
  const dark = new THREE.Color(wall).multiplyScalar(0.55).getHex();
  const iron = 0x3a3840;
  const gold = 0xffc94a;
  const add = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, glow = false) => {
    const m = new THREE.Mesh(geo, glow ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  switch (kind) {
    case 'start': {
      // the last camp: a ring of stones and embers
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        add(new THREE.DodecahedronGeometry(0.13), stone, Math.cos(a) * 0.42, 0.1, Math.sin(a) * 0.42, k, k * 2);
      }
      add(new THREE.ConeGeometry(0.2, 0.42, 5), fire, 0, 0.22, 0, 0, 0, 0, true);
      add(box(0.09, 0.09, 0.6), dark, 0, 0.06, 0, 0, 0.7);
      add(box(0.09, 0.09, 0.6), dark, 0, 0.09, 0, 0, -0.7);
      break;
    }
    case 'fight': {
      // a toppled statue: the plinth, its legs still standing, the rest on the floor
      add(box(0.9, 0.24, 0.9), dark, 0, 0.12, 0);
      add(box(0.24, 0.62, 0.26), stone, -0.17, 0.55, 0, 0, 0, 0.04);
      add(box(0.24, 0.5, 0.26), stone, 0.17, 0.49, 0, 0, 0, -0.06);
      add(box(0.72, 0.42, 0.42), stone, 0.72, 0.21, 0.32, 0, 0.5, 1.45);
      add(box(0.32, 0.34, 0.34), stone, 0.3, 0.17, 0.84, 0.4, 0.9, 0.2);
      break;
    }
    case 'key': {
      // a hanging cage on its chain, door open: what was kept here is gone
      const bars = 8;
      for (let k = 0; k < bars; k++) {
        if (k === 2) continue;
        const a = (k / bars) * Math.PI * 2;
        add(new THREE.CylinderGeometry(0.022, 0.022, 0.92, 5), iron, Math.cos(a) * 0.38, 1.14, Math.sin(a) * 0.38);
      }
      add(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 10), iron, 0, 0.68, 0);
      add(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 10), iron, 0, 1.6, 0);
      add(box(0.045, 1.2, 0.045), iron, 0, 2.2, 0);
      add(box(0.3, 0.5, 0.03), dark, 0.46, 1.1, 0.34, 0, 0.9);
      break;
    }
    case 'vault': {
      // a hoard, and the two pillars that guard it
      for (const x of [-0.72, 0.72]) {
        add(box(0.34, 1.5, 0.34), stone, x, 0.75, -0.2);
        add(box(0.48, 0.16, 0.48), dark, x, 1.54, -0.2);
      }
      for (let k = 0; k < 12; k++) {
        const a = k * 2.4;
        const r = 0.08 + k * 0.035;
        add(new THREE.CylinderGeometry(0.085, 0.085, 0.04, 8), gold, Math.cos(a) * r, 0.05 + (12 - k) * 0.02, Math.sin(a) * r, 0.3 * Math.sin(k), 0, 0.3 * Math.cos(k));
      }
      break;
    }
    case 'boss': {
      // the seat of whoever runs this level
      add(box(1.1, 0.2, 0.8), dark, 0, 0.1, 0);
      add(box(0.8, 0.46, 0.6), stone, 0, 0.42, 0);
      add(box(0.84, 1.5, 0.16), stone, 0, 1.15, -0.26);
      for (const x of [-0.46, 0.46]) {
        add(box(0.14, 0.62, 0.62), dark, x, 0.5, 0);
        add(new THREE.ConeGeometry(0.1, 0.5, 4), fire, x * 0.92, 2.1, -0.26, 0, 0, 0, true);
      }
      add(new THREE.ConeGeometry(0.16, 0.42, 4), gold, 0, 2.08, -0.26);
      break;
    }
    default:
      break;
  }
  return g;
}
