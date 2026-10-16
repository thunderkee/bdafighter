import * as THREE from 'three';
import { meshGeometry } from './meshkit';
import type { MeshData } from './roster';

/**
 * Faceted kit shapes for the 2.1 units: still hard-edged and zero-bevel, but cut and tapered
 * the way model-kit armour is, instead of plain upright boxes. Each one is a polygon mesh
 * (the Unit Lab's 'mesh' block), so a 2.1 unit opened in the Lab keeps every facet.
 */

type P2 = [number, number];

/** corner cut for the four vertical edges, front-left, front-right, back-right, back-left (front = -z) */
export type Cuts = number | [number, number, number, number];

/** the outline of a w x d rectangle around the y axis, with chamfered corners, in ring order */
function ring(w: number, d: number, cuts: Cuts): P2[] {
  const [fl, fr, br, bl] = typeof cuts === 'number' ? [cuts, cuts, cuts, cuts] : cuts;
  const x = w / 2;
  const z = d / 2;
  const pts: P2[] = [];
  const corner = (cx: number, cz: number, c: number, inX: number, inZ: number, first: 'x' | 'z') => {
    if (c <= 0) return pts.push([cx, cz]);
    const a: P2 = [cx + inX * c, cz];
    const b: P2 = [cx, cz + inZ * c];
    if (first === 'x') pts.push(b, a);
    else pts.push(a, b);
  };
  // walk: front-left -> front-right -> back-right -> back-left
  corner(-x, -z, fl, 1, 1, 'x');
  corner(x, -z, fr, -1, 1, 'z');
  corner(x, z, br, -1, -1, 'x');
  corner(-x, z, bl, 1, -1, 'z');
  return pts;
}

/**
 * A tapered, chamfered block standing on the y axis: `wb x db` at the bottom, `wt x dt` at the
 * top, `h` tall, with its vertical edges cut by `cuts`. `lean` slides the top forward (-) or back (+).
 */
export function prismData(wb: number, db: number, wt: number, dt: number, h: number, cuts: Cuts = 0, lean = 0): MeshData {
  const sx = wt / wb;
  const sz = dt / db;
  const base = ring(wb, db, cuts);
  const n = base.length;
  const v: number[] = [];
  for (const [x, z] of base) v.push(x, -h / 2, z);
  for (const [x, z] of base) v.push(x * sx, h / 2, z * sz + lean);
  const f: number[][] = [];
  f.push(base.map((_, i) => i)); // bottom
  f.push(base.map((_, i) => n + (n - 1 - i))); // top
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    f.push([i, n + i, n + j, j]);
  }
  return { v, f };
}

/** a flat outline in the x/y plane, extruded `depth` along z */
export function extrudeData(pts: P2[], depth: number): MeshData {
  // accept outlines drawn either way round: make them counter-clockwise so every face points out
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    area += x1 * y2 - x2 * y1;
  }
  if (area < 0) pts = pts.slice().reverse();
  const n = pts.length;
  const v: number[] = [];
  for (const [x, y] of pts) v.push(x, y, depth / 2); // back
  for (const [x, y] of pts) v.push(x, y, -depth / 2); // front
  const f: number[][] = [];
  f.push(pts.map((_, i) => i));
  f.push(pts.map((_, i) => n + (n - 1 - i)));
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    f.push([i, n + i, n + j, j]);
  }
  return { v, f };
}

/** a side profile drawn in the z/y plane (z forward is -), extruded `width` across x */
export function sideData(pts: P2[], width: number): MeshData {
  const d = extrudeData(pts, width);
  // swap x and z (a mirror), then flip every face so it still faces outward
  const v: number[] = [];
  for (let i = 0; i < d.v.length; i += 3) v.push(d.v[i + 2], d.v[i + 1], d.v[i]);
  return { v, f: d.f.map((face) => face.slice().reverse()) };
}

/** a mesh from shape data, remembering the data so the Unit Lab can read it back */
export function facetMesh(data: MeshData, mat: THREE.Material) {
  const geo = meshGeometry(data);
  geo.userData.meshData = data;
  boxUV(geo);
  return new THREE.Mesh(geo, mat);
}

/** the same outline mirrored left to right (a mirror made with a negative scale turns the faces inside out) */
export const mirrorX = (pts: P2[]): P2[] => pts.map(([x, y]) => [-x, y]);

/**
 * Texture coordinates by box projection: each triangle takes the plane its face points
 * along, at 3 tiles per unit, so surface textures (grain, knurling) sit at one scale everywhere.
 */
export function boxUV(geo: THREE.BufferGeometry) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  const k = 3;
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nrm.getX(i));
    const ay = Math.abs(nrm.getY(i));
    const az = Math.abs(nrm.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const [u, v] = ax >= ay && ax >= az ? [z, y] : ay >= az ? [x, z] : [x, y];
    uv[i * 2] = u * k;
    uv[i * 2 + 1] = v * k;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
