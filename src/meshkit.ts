import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MeshData } from './roster';

// Editable polygon meshes for the Unit Lab: a list of points and the faces (point loops,
// counter-clockwise seen from outside) that join them. Faces can be extruded, points
// moved, and the whole mesh bevelled at build time.

const at = (d: MeshData, i: number) => new THREE.Vector3(d.v[i * 3], d.v[i * 3 + 1], d.v[i * 3 + 2]);

/** a face's outward normal (Newell's method, so it works for any planar-ish loop) */
export function faceNormal(d: MeshData, face: number[]) {
  const n = new THREE.Vector3();
  for (let i = 0; i < face.length; i++) {
    const a = at(d, face[i]);
    const b = at(d, face[(i + 1) % face.length]);
    n.x += (a.y - b.y) * (a.z + b.z);
    n.y += (a.z - b.z) * (a.x + b.x);
    n.z += (a.x - b.x) * (a.y + b.y);
  }
  return n.lengthSq() > 1e-20 ? n.normalize() : n.set(0, 1, 0);
}

export function faceCenter(d: MeshData, face: number[]) {
  const c = new THREE.Vector3();
  for (const i of face) c.add(at(d, i));
  return c.divideScalar(face.length);
}

/** split a face into triangles (point indices), keeping its winding */
export function triangulate(d: MeshData, face: number[]): [number, number, number][] {
  if (face.length < 3) return [];
  if (face.length === 3) return [[face[0], face[1], face[2]]];
  const n = faceNormal(d, face);
  const u = Math.abs(n.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  u.sub(n.clone().multiplyScalar(u.dot(n))).normalize();
  const w = n.clone().cross(u);
  const contour = face.map((i) => {
    const p = at(d, i);
    return new THREE.Vector2(p.dot(u), p.dot(w));
  });
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  return tris.map(([a, b, c]) => {
    const t: [number, number, number] = [face[a], face[b], face[c]];
    // triangulateShape may flip clockwise loops: keep each triangle facing out
    const pa = at(d, t[0]);
    const tn = at(d, t[1]).sub(pa).cross(at(d, t[2]).sub(pa));
    if (tn.dot(n) < 0) [t[1], t[2]] = [t[2], t[1]];
    return t;
  });
}

/** every edge once, as point index pairs */
export function edgesOf(d: MeshData): [number, number][] {
  const seen = new Set<string>();
  const out: [number, number][] = [];
  for (const f of d.f)
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(a < b ? [a, b] : [b, a]);
    }
  return out;
}

/** turn any three.js geometry into an editable mesh: weld points, merge flat neighbouring triangles into polygons */
export function fromGeometry(geo: THREE.BufferGeometry): MeshData {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const pos = src.getAttribute('position');
  const ids = new Map<string, number>();
  const v: number[] = [];
  const tris: [number, number, number][] = [];
  const key = (x: number, y: number, z: number) => `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
  for (let i = 0; i + 2 < pos.count; i += 3) {
    const t: number[] = [];
    for (let k = 0; k < 3; k++) {
      const x = pos.getX(i + k);
      const y = pos.getY(i + k);
      const z = pos.getZ(i + k);
      const kk = key(x, y, z);
      let id = ids.get(kk);
      if (id === undefined) {
        id = v.length / 3;
        v.push(Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4, Math.round(z * 1e4) / 1e4);
        ids.set(kk, id);
      }
      t.push(id);
    }
    if (t[0] === t[1] || t[1] === t[2] || t[0] === t[2]) continue;
    tris.push(t as [number, number, number]);
  }
  const d: MeshData = { v, f: [] };
  const normals = tris.map((t) => faceNormal(d, t));
  // union triangles that share an edge and face the same way
  const parent = tris.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const byEdge = new Map<string, number[]>();
  tris.forEach((t, ti) => {
    for (let k = 0; k < 3; k++) {
      const a = t[k];
      const b = t[(k + 1) % 3];
      const kk = a < b ? `${a},${b}` : `${b},${a}`;
      const list = byEdge.get(kk) ?? [];
      list.push(ti);
      byEdge.set(kk, list);
    }
  });
  for (const list of byEdge.values())
    if (list.length === 2 && normals[list[0]].dot(normals[list[1]]) > 0.9995) parent[find(list[0])] = find(list[1]);
  const groups = new Map<number, number[]>();
  tris.forEach((_, ti) => {
    const r = find(ti);
    const g = groups.get(r) ?? [];
    g.push(ti);
    groups.set(r, g);
  });
  for (const g of groups.values()) {
    if (g.length === 1) {
      d.f.push([...tris[g[0]]]);
      continue;
    }
    // the polygon's outline: directed edges whose reverse isn't inside the group
    const dir = new Set<string>();
    for (const ti of g) for (let k = 0; k < 3; k++) dir.add(`${tris[ti][k]},${tris[ti][(k + 1) % 3]}`);
    const next = new Map<number, number>();
    let simple = true;
    for (const e of dir) {
      const [a, b] = e.split(',').map(Number);
      if (dir.has(`${b},${a}`)) continue;
      if (next.has(a)) simple = false;
      next.set(a, b);
    }
    const loop: number[] = [];
    if (simple && next.size >= 3) {
      const start = next.keys().next().value as number;
      let cur = start;
      do {
        loop.push(cur);
        cur = next.get(cur) ?? -1;
      } while (cur !== start && cur !== -1 && loop.length <= next.size);
      if (cur !== start || loop.length !== next.size) simple = false;
    } else simple = false;
    if (simple) d.f.push(loop);
    else for (const ti of g) d.f.push([...tris[ti]]);
  }
  return d;
}

/** a flat outline (counter-clockwise points) pulled into a solid of the given depth, centred on z = 0 */
export function prism(pts: [number, number][], depth: number): MeshData {
  const n = pts.length;
  const v: number[] = [];
  for (const z of [-depth / 2, depth / 2]) for (const [x, y] of pts) v.push(x, y, z);
  const f: number[][] = [];
  f.push(pts.map((_, i) => n + i));
  f.push(pts.map((_, i) => n - 1 - i));
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    f.push([i, j, n + j, n + i]);
  }
  return { v, f };
}

/** pull each chosen face out along its normal, joining it back with side walls; returns the moved faces */
export function extrudeFaces(d: MeshData, faces: number[], dist: number) {
  const moved: number[] = [];
  for (const fi of faces) {
    const face = d.f[fi];
    if (!face) continue;
    const n = faceNormal(d, face).multiplyScalar(dist);
    const top = face.map((i) => {
      const p = at(d, i).add(n);
      d.v.push(p.x, p.y, p.z);
      return d.v.length / 3 - 1;
    });
    for (let k = 0; k < face.length; k++) {
      const k2 = (k + 1) % face.length;
      d.f.push([face[k], face[k2], top[k2], top[k]]);
    }
    d.f[fi] = top;
    moved.push(fi);
  }
  return moved;
}

/**
 * Bevel every edge by `w` (one flat chamfer): each face shrinks inward, each edge becomes a strip,
 * each corner becomes a small cap. Needs a closed mesh; open meshes come back unchanged.
 */
export function chamfer(d: MeshData, w: number): MeshData {
  const dirEdge = new Map<string, [number, number]>();
  d.f.forEach((f, fi) => f.forEach((a, k) => dirEdge.set(`${a},${f[(k + 1) % f.length]}`, [fi, k])));
  for (const key of dirEdge.keys()) {
    const [a, b] = key.split(',');
    if (!dirEdge.has(`${b},${a}`)) return d;
  }
  // keep the chamfer narrower than the shortest edge
  let shortest = Infinity;
  for (const [a, b] of edgesOf(d)) shortest = Math.min(shortest, at(d, a).distanceTo(at(d, b)));
  w = Math.min(w, shortest * 0.45);
  if (w <= 1e-5) return d;
  const v: number[] = [];
  const inset: number[][] = d.f.map((f) => {
    const n = faceNormal(d, f);
    return f.map((vi, k) => {
      const p = at(d, vi);
      const prev = at(d, f[(k + f.length - 1) % f.length]);
      const next = at(d, f[(k + 1) % f.length]);
      const e1 = p.clone().sub(prev).normalize();
      const e2 = next.sub(p).normalize();
      const denom = 1 + e1.dot(e2);
      if (denom > 1e-3) p.add(n.clone().cross(e1).add(n.clone().cross(e2)).multiplyScalar(w / denom));
      v.push(p.x, p.y, p.z);
      return v.length / 3 - 1;
    });
  });
  const f: number[][] = inset.map((loop) => [...loop]);
  // edge strips
  d.f.forEach((face, fi) =>
    face.forEach((a, k) => {
      const b = face[(k + 1) % face.length];
      const [gi, gk] = dirEdge.get(`${b},${a}`)!;
      if (gi < fi || (gi === fi && gk < k)) return;
      const g = d.f[gi];
      f.push([inset[fi][(k + 1) % face.length], inset[fi][k], inset[gi][(gk + 1) % g.length], inset[gi][gk]]);
    }),
  );
  // corner caps: walk the faces around each point
  const done = new Set<number>();
  d.f.forEach((face, fi) =>
    face.forEach((a, k) => {
      if (done.has(a)) return;
      done.add(a);
      const cap: number[] = [];
      let cf = fi;
      let ck = k;
      for (let guard = 0; guard < 64; guard++) {
        cap.push(inset[cf][ck]);
        const cface = d.f[cf];
        const p = cface[(ck + cface.length - 1) % cface.length];
        const twin = dirEdge.get(`${a},${p}`);
        if (!twin) break;
        [cf, ck] = twin;
        if (cf === fi && ck === k) break;
      }
      if (cap.length >= 3) f.push(cap);
    }),
  );
  return { v, f };
}

/** the renderable geometry; `triFace` maps each triangle back to its face for picking */
export function meshGeometry(d: MeshData | undefined, bevel = 0, smooth = false): THREE.BufferGeometry {
  if (!d || !d.f.length) return new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const src = bevel > 0 ? chamfer(d, bevel) : d;
  const pos: number[] = [];
  const triFace: number[] = [];
  src.f.forEach((face, fi) => {
    for (const t of triangulate(src, face)) {
      for (const i of t) pos.push(src.v[i * 3], src.v[i * 3 + 1], src.v[i * 3 + 2]);
      triFace.push(fi);
    }
  });
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (smooth) geo = mergeVertices(geo, 1e-4);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  geo.userData.triFace = triFace;
  return geo;
}
