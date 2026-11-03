import * as THREE from 'three';

/**
 * Action mode's scenery: props round the outside of a stage, after its theme (trees on the
 * meadow, palms on the beach, buildings in the city...). They stand on the ground beyond the
 * walls, never inside, so they never get in the way; the tall ones keep to the sides and the far
 * end, and only low ones go along the near edge, where they'd stand between you and the camera.
 */
type Make = (rnd: () => number) => THREE.Object3D;

const mat = new Map<string, THREE.Material>();
/** a shared material by colour (and glow) */
const M = (color: number, glow = false) => {
  const key = `${color}:${glow}`;
  let m = mat.get(key);
  if (!m) mat.set(key, (m = glow ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshStandardMaterial({ color, roughness: 0.85 })));
  return m;
};
const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  return o;
};
const group = (...kids: THREE.Object3D[]) => {
  const g = new THREE.Group();
  g.add(...kids);
  return g;
};
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const cyl = (r0: number, r1: number, h: number, n = 8) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);
const cone = (r: number, h: number, n = 8) => new THREE.ConeGeometry(r, h, n).translate(0, h / 2, 0);
const ball = (r: number, detail = 0) => new THREE.IcosahedronGeometry(r, detail);

// ---------- the props ----------

const roundTree: Make = (rnd) => {
  const s = 0.8 + rnd() * 0.6;
  const g = group(mesh(cyl(0.12, 0.16, 0.9), M(0x7a5232)), mesh(ball(0.75), M(rnd() < 0.5 ? 0x4fb84a : 0x3f9e3e), 0, 1.35, 0), mesh(ball(0.5), M(0x5ccc55), 0.25, 1.85, 0.1));
  g.scale.setScalar(s);
  return g;
};
const pine = (green: number, snow?: number): Make => (rnd) => {
  const s = 0.9 + rnd() * 0.7;
  const g = group(mesh(cyl(0.1, 0.13, 0.5), M(0x5a3a22)));
  for (let k = 0; k < 3; k++) {
    g.add(mesh(cone(0.75 - k * 0.18, 0.9), M(green), 0, 0.4 + k * 0.5, 0));
    if (snow) g.add(mesh(cone(0.36 - k * 0.08, 0.32), M(snow), 0, 0.98 + k * 0.5, 0));
  }
  g.scale.setScalar(s);
  return g;
};
const rock = (color: number, glow?: number): Make => (rnd) => {
  const s = 0.35 + rnd() * 0.45;
  const g = group(mesh(ball(1, 0), M(color)));
  if (glow) g.add(mesh(new THREE.BoxGeometry(1.5, 0.08, 0.12), M(glow, true), 0, 0.15, 0.4));
  g.scale.set(s * 1.2, s * 0.8, s);
  g.position.y = s * 0.3;
  g.rotation.y = rnd() * 6;
  return group(g);
};
const flowers: Make = (rnd) => {
  const g = new THREE.Group();
  const cols = [0xff6a9a, 0xffd23e, 0xffffff, 0xb07aff];
  for (let k = 0; k < 5; k++) g.add(mesh(ball(0.09), M(cols[Math.floor(rnd() * 4)]), (rnd() - 0.5) * 0.8, 0.12, (rnd() - 0.5) * 0.8));
  return g;
};
const palm: Make = (rnd) => {
  const g = new THREE.Group();
  const lean = (rnd() - 0.5) * 0.5;
  let x = 0;
  for (let k = 0; k < 6; k++) {
    g.add(mesh(cyl(0.11, 0.13, 0.42), M(k % 2 ? 0x9a7048 : 0x8a6240), x, k * 0.4, 0));
    x += lean * 0.12 * k;
  }
  for (let k = 0; k < 6; k++) {
    const leaf = mesh(new THREE.BoxGeometry(1.3, 0.04, 0.32).translate(0.6, 0, 0), M(k % 2 ? 0x3fae4a : 0x4fc85a), x, 2.45, 0);
    leaf.rotation.set(0, (k / 6) * Math.PI * 2, -0.35);
    g.add(leaf);
  }
  g.add(mesh(ball(0.12), M(0x6a4a2a), x + 0.1, 2.3, 0.05));
  g.scale.setScalar(0.9 + rnd() * 0.4);
  return g;
};
const parasol: Make = (rnd) => {
  const c = [0xff5a5a, 0x4aa8f0, 0xffd23e][Math.floor(rnd() * 3)];
  return group(mesh(cyl(0.04, 0.04, 1.4), M(0xf2ead8)), mesh(cone(0.85, 0.35, 10), M(c), 0, 1.25, 0), mesh(box(0.7, 0.08, 0.35), M(0xf2ead8), 0.5, 0.1, 0.3));
};
const snowman: Make = () => group(mesh(ball(0.4, 1), M(0xffffff), 0, 0.38, 0), mesh(ball(0.28, 1), M(0xffffff), 0, 0.9, 0), mesh(cone(0.06, 0.25), M(0xff7a1a), 0, 0.92, -0.25).rotateX(-Math.PI / 2), mesh(cyl(0.18, 0.18, 0.25), M(0x24222a), 0, 1.12, 0));
const crystal = (color: number): Make => (rnd) => {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const c = mesh(new THREE.OctahedronGeometry(0.3 + rnd() * 0.25).scale(0.6, 1.6, 0.6), M(color, true), (rnd() - 0.5) * 0.5, 0.4, (rnd() - 0.5) * 0.5);
    c.rotation.z = (rnd() - 0.5) * 0.6;
    g.add(c);
  }
  return g;
};
const spike: Make = (rnd) => {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const c = mesh(cone(0.25, 1.2 + rnd() * 1.2, 5), M(0x1e1418), (rnd() - 0.5) * 0.7, 0, (rnd() - 0.5) * 0.7);
    c.rotation.z = (rnd() - 0.5) * 0.4;
    g.add(c);
  }
  g.add(mesh(cyl(0.5, 0.6, 0.06, 10), M(0xff5a1a, true), 0, 0.01, 0));
  return g;
};
const mushroom: Make = (rnd) => {
  const s = 0.6 + rnd() * 0.6;
  const g = group(mesh(cyl(0.09, 0.12, 0.45), M(0xf2ead8)), mesh(new THREE.SphereGeometry(0.35, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(0xd8323a), 0, 0.43, 0), mesh(ball(0.05), M(0xffffff), 0.12, 0.7, 0.1));
  g.scale.setScalar(s);
  return g;
};
const log: Make = (rnd) => {
  const l = mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.4, 8), M(0x6a4a2a), 0, 0.18, 0);
  l.rotation.z = Math.PI / 2;
  const g = group(l);
  g.rotation.y = rnd() * 3;
  return g;
};
const lantern: Make = () => group(mesh(cyl(0.05, 0.06, 1.6), M(0x3a2a1a)), mesh(box(0.5, 0.05, 0.05), M(0x3a2a1a), 0.2, 1.55, 0), mesh(box(0.2, 0.28, 0.2), M(0xffb04a, true), 0.4, 1.25, 0));
const reeds: Make = (rnd) => {
  const g = new THREE.Group();
  for (let k = 0; k < 6; k++) g.add(mesh(cyl(0.02, 0.03, 0.6 + rnd() * 0.5, 4), M(0x7a9a4a), (rnd() - 0.5) * 0.5, 0, (rnd() - 0.5) * 0.5));
  return g;
};
const post: Make = (rnd) => group(mesh(cyl(0.1, 0.12, 0.7 + rnd() * 0.5), M(0x5a3e26)));
const torch: Make = () => group(mesh(box(0.5, 1.8, 0.5), M(0x6a5a8a)), mesh(box(0.6, 0.15, 0.6), M(0x4a3e6a), 0, 1.8, 0), mesh(cone(0.14, 0.4, 6), M(0xffa02a, true), 0, 1.95, 0));
const banner: Make = (rnd) => {
  const c = [0xc8323a, 0x4a6ad8, 0xe8b43a][Math.floor(rnd() * 3)];
  return group(mesh(cyl(0.05, 0.05, 2.4), M(0x3a3448)), mesh(box(0.7, 1, 0.04), M(c), 0.38, 1.25, 0));
};
const building = (body: number, lit: number): Make => (rnd) => {
  const w = 1.4 + rnd() * 1.2;
  const h = 2.2 + rnd() * 3.2;
  const g = group(mesh(box(w, h, w), M(body)));
  // rows of lit windows down the face that looks in
  for (let y = 0.5; y < h - 0.3; y += 0.6)
    for (let x = -w / 2 + 0.3; x < w / 2 - 0.15; x += 0.45) if (rnd() < 0.6) g.add(mesh(new THREE.PlaneGeometry(0.22, 0.3), M(lit, true), x, y, w / 2 + 0.01));
  return g;
};
const neonTower: Make = (rnd) => {
  const h = 2.5 + rnd() * 3;
  const c = rnd() < 0.5 ? 0xff2bd6 : 0x2bf0ff;
  return group(mesh(box(1, h, 1), M(0x1e1430)), mesh(box(1.04, 0.08, 1.04), M(c, true), 0, h * 0.35, 0), mesh(box(1.04, 0.08, 1.04), M(c, true), 0, h * 0.7, 0), mesh(box(0.8, 0.5, 0.06), M(rnd() < 0.5 ? 0xffd23e : c, true), 0, h + 0.4, 0));
};
const lamp: Make = () => group(mesh(cyl(0.05, 0.07, 2), M(0x5a5c66)), mesh(box(0.6, 0.06, 0.12), M(0x5a5c66), 0.25, 1.95, 0), mesh(box(0.25, 0.08, 0.18), M(0xfff2a8, true), 0.45, 1.88, 0));
const dish: Make = (rnd) => {
  const d = mesh(new THREE.SphereGeometry(0.6, 14, 6, 0, Math.PI * 2, 0, Math.PI / 3), M(0xdfe6ee), 0, 1.2, 0);
  d.rotation.x = -0.9;
  d.rotation.y = rnd() * 6;
  return group(mesh(cyl(0.08, 0.12, 1.1), M(0x4a5674)), d, mesh(ball(0.07), M(0x3ef0ff, true), 0, 1.45, -0.35));
};
const mast: Make = () => group(mesh(cyl(0.05, 0.08, 2.6, 6), M(0x4a5674)), mesh(ball(0.12), M(0xff3a3a, true), 0, 2.65, 0), mesh(box(0.5, 0.06, 0.06), M(0x4a5674), 0, 1.8, 0));
const stand: Make = () => {
  const g = new THREE.Group();
  for (let k = 0; k < 4; k++) g.add(mesh(box(2.4, 0.35, 0.5), M(k % 2 ? 0x3a6ad8 : 0x2a52b8), 0, k * 0.35, k * 0.5));
  return g;
};
const goal: Make = () => group(mesh(cyl(0.05, 0.05, 1.2), M(0xffffff), -1, 0, 0), mesh(cyl(0.05, 0.05, 1.2), M(0xffffff), 1, 0, 0), mesh(box(2.1, 0.08, 0.08), M(0xffffff), 0, 1.2, 0));
const flag: Make = () => group(mesh(cyl(0.03, 0.03, 1), M(0xffffff)), mesh(box(0.35, 0.25, 0.02), M(0xffd23e), 0.18, 0.75, 0));

// ---------- flat touches for the floor inside (walked over, never in the way) ----------
const disc = (r: number) => new THREE.CircleGeometry(r, 18).rotateX(-Math.PI / 2);
const puddle = (color: number, glow = false): Make => (rnd) => {
  const g = group(mesh(disc(0.32 + rnd() * 0.18), M(color, glow), 0, 0.012, 0));
  g.scale.set(1.3, 1, 0.8);
  g.rotation.y = rnd() * 3;
  return group(g);
};
const pebbles = (color: number): Make => (rnd) => {
  const g = new THREE.Group();
  for (let k = 0; k < 4; k++) g.add(mesh(ball(0.06 + rnd() * 0.05), M(color), (rnd() - 0.5) * 0.6, 0.04, (rnd() - 0.5) * 0.6));
  return g;
};
const tuft = (color: number): Make => (rnd) => {
  const g = new THREE.Group();
  for (let k = 0; k < 5; k++) {
    const b = mesh(cone(0.04, 0.18 + rnd() * 0.12, 3), M(color), (rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3);
    b.rotation.z = (rnd() - 0.5) * 0.6;
    g.add(b);
  }
  return g;
};
const chalk: Make = (rnd) => group(mesh(new THREE.RingGeometry(0.28, 0.33, 24).rotateX(-Math.PI / 2), M(0xffffff, true), 0, 0.012, 0), mesh(disc(0.05), M(0xffffff, true), (rnd() - 0.5) * 0.1, 0.013, 0));
const smallShroom: Make = (rnd) => {
  const g = mushroom(rnd);
  g.scale.multiplyScalar(0.5);
  return g;
};
const smallCrystal = (color: number): Make => (rnd) => {
  const g = crystal(color)(rnd);
  g.scale.setScalar(0.4);
  return g;
};
/** each theme's floor touches */
const FLOOR: Record<string, Make[]> = {
  meadow: [flowers, tuft(0x3f9e3e), pebbles(0x9a9a8a)],
  dungeon: [pebbles(0x4a4458), puddle(0x5a6488), tuft(0x5a7a5a)],
  beach: [pebbles(0xf2ead8), puddle(0x8ae8ff), flowers],
  snow: [puddle(0xffffff), smallCrystal(0x9fe0ff), pebbles(0xb8c8d8)],
  lava: [puddle(0xff5a1a, true), pebbles(0x1e1418), pebbles(0x5a3a30)],
  forest: [smallShroom, tuft(0x2f6a3a), puddle(0x2a4a4a)],
  river: [tuft(0x7a9a4a), puddle(0x5a7ab8), pebbles(0x8a6a4a)],
  cyber: [puddle(0xff2bd6, true), smallCrystal(0x2bf0ff), smallCrystal(0xff2bd6)],
  space: [smallCrystal(0x3ef0ff), puddle(0x3ef0ff, true), pebbles(0x4a5674)],
  city: [puddle(0x3a3c48), pebbles(0x8a8f98), puddle(0x5a5c66)],
  soccer: [chalk, tuft(0x2f8a3a)],
};

/** each theme's props: tall ones (sides and far end) and low ones (anywhere, the near edge too) */
const SETS: Record<string, { tall: Make[]; low: Make[]; n: number }> = {
  meadow: { tall: [roundTree, roundTree, pine(0x3f8e3e)], low: [flowers, rock(0x9a9a8a), flowers], n: 48 },
  dungeon: { tall: [torch, banner], low: [rock(0x5a5468), rock(0x4a4458)], n: 32 },
  beach: { tall: [palm, palm, parasol], low: [rock(0xb8a888), flowers], n: 38 },
  snow: { tall: [pine(0x2f6a5a, 0xffffff), pine(0x3a7a6a, 0xffffff), snowman], low: [crystal(0x9fe0ff), rock(0xdfe8f2)], n: 42 },
  lava: { tall: [spike, rock(0x2e2220, 0xff5a1a)], low: [rock(0x3a2a26, 0xff7a2a), rock(0x2e2220)], n: 36 },
  forest: { tall: [pine(0x2a5a32), pine(0x24502c), roundTree], low: [mushroom, log, mushroom], n: 50 },
  river: { tall: [lantern, roundTree], low: [reeds, post, reeds], n: 38 },
  cyber: { tall: [neonTower, neonTower], low: [crystal(0xff2bd6), crystal(0x2bf0ff)], n: 30 },
  space: { tall: [dish, mast], low: [crystal(0x3ef0ff), rock(0x4a5674)], n: 32 },
  city: { tall: [building(0x6a6c78, 0xffe08a), building(0x4a4c58, 0x8ae8ff), lamp], low: [post], n: 32 },
  soccer: { tall: [stand, stand, goal], low: [flag], n: 22 },
};

/**
 * dress the ground round a W x H stage (its centre at the origin), and stand some props on its
 * border walls (edges: their tiles; side 0 left, 1 right, 2 far, 3 near) so they frame the
 * stage even when the camera shows little beyond it
 */
export function decorate(
  world: THREE.Object3D,
  theme: string,
  W: number,
  H: number,
  edges: { x: number; z: number; side: number }[] = [],
  /** inside the stage: wall tiles that can carry a prop on top, and open floor for flat touches */
  inner: { x: number; z: number }[] = [],
  open: { x: number; z: number }[] = [],
) {
  const set = SETS[theme];
  if (!set) return;
  // (seeded from the stage, so it's the same each time you see it)
  let seed = W * 131 + H * 17 + theme.length * 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const g = new THREE.Group();
  g.name = 'scenery';
  const placed: { x: number; z: number }[] = [];
  for (let n = 0, tries = 0; n < set.n && tries < set.n * 12; tries++) {
    // a spot on the ground beyond the walls, a little way out
    const side = Math.floor(rnd() * 4);
    const out = 1.2 + rnd() * 4.5;
    const along = rnd() * 2 - 1;
    const x = side === 0 ? -W / 2 - out : side === 1 ? W / 2 + out : along * (W / 2 + 3);
    const z = side === 2 ? -H / 2 - out : side === 3 ? H / 2 + out : along * (H / 2 + 3);
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < 1.6)) continue;
    // (the near edge, between you and the camera, only gets low props)
    const near = side === 3 || z > H / 2;
    const pool = near || rnd() < 0.3 ? set.low : set.tall;
    const o = pool[Math.floor(rnd() * pool.length)](rnd);
    o.position.x += x;
    o.position.z += z;
    o.rotation.y += side === 0 ? Math.PI / 2 : side === 1 ? -Math.PI / 2 : side === 2 ? 0 : Math.PI;
    g.add(o);
    placed.push({ x, z });
    n++;
  }
  // on the border walls: every few tiles, a prop a little smaller than on the ground
  edges.forEach((e, k) => {
    if (rnd() > 0.38 || k % 2) return;
    const near = e.side === 3;
    const pool = near ? set.low : rnd() < 0.7 ? set.tall : set.low;
    const o = pool[Math.floor(rnd() * pool.length)](rnd);
    const wrap = new THREE.Group();
    wrap.add(o);
    wrap.scale.setScalar(0.7);
    wrap.position.set(e.x, 1.1, e.z);
    wrap.rotation.y = e.side === 0 ? Math.PI / 2 : e.side === 1 ? -Math.PI / 2 : e.side === 2 ? 0 : Math.PI;
    g.add(wrap);
  });
  // inside: a prop on top of some of the walls (mostly low ones, so the stage stays easy to read)
  for (const w of inner) {
    if (rnd() > 0.22) continue;
    const pool = rnd() < 0.65 ? set.low : set.tall;
    const o = pool[Math.floor(rnd() * pool.length)](rnd);
    const wrap = new THREE.Group();
    wrap.add(o);
    wrap.scale.setScalar(0.55);
    wrap.position.set(w.x, 1.1, w.z);
    wrap.rotation.y = rnd() * Math.PI * 2;
    g.add(wrap);
  }
  // and flat touches about the floor (flowers, puddles, pebbles...), walked straight over
  const touches = FLOOR[theme] ?? [];
  if (touches.length && open.length) {
    const n = Math.min(open.length, Math.round(open.length * 0.12) + 6);
    const spots = [...open];
    for (let k = 0; k < n; k++) {
      const p = spots.splice(Math.floor(rnd() * spots.length), 1)[0];
      const o = touches[Math.floor(rnd() * touches.length)](rnd);
      o.position.x += p.x + (rnd() - 0.5) * 0.4;
      o.position.z += p.z + (rnd() - 0.5) * 0.4;
      g.add(o);
    }
  }
  world.add(g);
}

// ---------- cover: some of the walls inside a stage, drawn as props instead of plain blocks ----------
// (each fills its one tile and stands about as tall as a wall, so it blocks just the same)
const barrel = (body: number, band: number): Make => () =>
  group(mesh(cyl(0.38, 0.38, 1, 14), M(body)), mesh(cyl(0.4, 0.4, 0.08, 14), M(band), 0, 0.2, 0), mesh(cyl(0.4, 0.4, 0.08, 14), M(band), 0, 0.75, 0), mesh(cyl(0.3, 0.3, 0.02, 14), M(band), 0, 1, 0));
const emblem = (body: number, mark: number): Make => () =>
  group(
    mesh(box(0.96, 1.1, 0.96), M(body)),
    mesh(new THREE.CircleGeometry(0.26, 5).rotateZ(Math.PI / 2), M(mark), 0, 0.6, 0.485),
    mesh(new THREE.CircleGeometry(0.26, 5).rotateZ(Math.PI / 2).rotateY(Math.PI), M(mark), 0, 0.6, -0.485),
    mesh(box(1, 0.08, 1), M(mark), 0, 1.06, 0),
  );
const crates = (wood: number, edge: number): Make => () => {
  const one = (x: number, y: number, z: number, sz: number) => [mesh(box(sz, sz, sz), M(wood), x, y, z), mesh(box(sz + 0.02, 0.06, sz + 0.02), M(edge), x, y + sz * 0.5, z)];
  return group(...one(0, 0, 0, 0.62), ...one(0.18, 0.62, 0.1, 0.48), ...one(-0.2, 0, -0.22, 0.4));
};
const stump: Make = (rnd) => group(mesh(cyl(0.42, 0.46, 0.7, 10), M(0x7a5232)), mesh(cyl(0.38, 0.38, 0.02, 10), M(0xc8a46a), 0, 0.7, 0), mesh(ball(0.32), M(rnd() < 0.5 ? 0x4fb84a : 0x3f9e3e), 0.15, 0.95, 0.1));
const iceBlock: Make = () => group(mesh(box(0.92, 1.05, 0.92), new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.15, transparent: true, opacity: 0.85 })), mesh(box(0.96, 0.12, 0.96), M(0xffffff), 0, 1.0, 0));
const pillar = (color: number, cap: number): Make => () => group(mesh(box(0.9, 0.12, 0.9), M(cap)), mesh(cyl(0.32, 0.36, 0.95, 12), M(color), 0, 0.1, 0), mesh(box(0.9, 0.12, 0.9), M(cap), 0, 1.0, 0));
const container = (color: number): Make => () => {
  const g = group(mesh(box(0.96, 1.05, 0.96), M(color)));
  for (let k = -3; k <= 3; k++) g.add(mesh(box(0.04, 1.0, 0.98), M(0x2a2c34), k * 0.13, 0.02, 0));
  return g;
};
const pylon = (glow: number): Make => () => group(mesh(box(0.85, 1.1, 0.85), M(0x24182e)), mesh(box(0.88, 0.08, 0.88), M(glow, true), 0, 0.35, 0), mesh(box(0.88, 0.08, 0.88), M(glow, true), 0, 0.8, 0));
const COVER: Record<string, Make[]> = {
  meadow: [barrel(0x8a5a32, 0x3a3c44), stump, crates(0xc8925a, 0x6a3f1e)],
  dungeon: [barrel(0x6a4a2a, 0x2a2734), emblem(0x6a5a8a, 0xe8b43a), pillar(0x8a93b8, 0x5a4a8a)],
  beach: [barrel(0x9b7a55, 0x3a6a8a), crates(0xd8b47a, 0x8a5a32), emblem(0xf2ead8, 0x2fc6d6)],
  snow: [iceBlock, barrel(0x5a7ab8, 0xf4f9fd), crates(0xb8a888, 0x5a4a3a)],
  lava: [barrel(0x2e2220, 0xff5a1a), emblem(0x3a2a26, 0xff7a2a), pillar(0x3a2a26, 0xff5a1a)],
  forest: [stump, barrel(0x5a3e22, 0x2a2a2a), crates(0x8a6a3a, 0x3a2a1a)],
  river: [barrel(0x6a4a2a, 0x2a3a5a), crates(0xb0805a, 0x5a3e26), stump],
  cyber: [pylon(0xff2bd6), pylon(0x2bf0ff), container(0x3a2a52)],
  space: [container(0x4a5674), emblem(0x34405e, 0x3ef0ff), barrel(0x4a5674, 0x3ef0ff)],
  city: [container(0xd8502a), container(0x2a6ad8), barrel(0x4a4c58, 0xffcf3e)],
  soccer: [emblem(0xe8e8ee, 0x2f8a3a), barrel(0xe8e8ee, 0xff5a5a), crates(0xe8e8ee, 0x2f8a3a)],
};
/** a cover prop for one wall tile in this theme (null: the theme has none, keep the plain wall) */
export function coverProp(theme: string, rnd: () => number): THREE.Object3D | null {
  const set = COVER[theme];
  if (!set) return null;
  const o = set[Math.floor(rnd() * set.length)](rnd);
  o.rotation.y = Math.floor(rnd() * 4) * (Math.PI / 2);
  return o;
}
