/**
 * Dungeon Run's map and loot.
 *
 * The map: a fresh dungeon each run. Rooms sit in the cells of a coarse grid, joined into a tree
 * by three-wide corridors (each an L: out of one room, across, into the other). The room furthest
 * from the start is the boss's, behind a locked door; the key waits in the next furthest dead end.
 * Traps line the corridors: spike strips, swinging axes, and a boulder down the longest straight.
 *
 * The loot: marble launchers found in chests, each with a few bonuses (and now and then a
 * drawback) and, from Epic up, a perk.
 */

export const D_FLOOR = 0;
export const D_WALL = 1;
export const D_CRATE = 2;
/** solid rock beyond the walls: blocks everything and isn't drawn (the dark around the dungeon) */
export const D_ROCK = 7;

export type RoomKind = 'start' | 'fight' | 'key' | 'vault' | 'boss';
export interface DRoom {
  id: number;
  /** its floor, inclusive (tiles); its walls run one tile outside */
  i0: number;
  j0: number;
  i1: number;
  j1: number;
  kind: RoomKind;
  /** corridors from the start */
  depth: number;
  /** the openings in its walls (tiles where the corridors come in) */
  doors: number[];
  cleared: boolean;
  seen: boolean;
}
/** a straight run of corridor, centre line, from a to b (tile coordinates, a.i === b.i or a.j === b.j) */
export interface Leg {
  a: { i: number; j: number };
  b: { i: number; j: number };
}
export type DTrap =
  | { kind: 'spikes'; tiles: number[]; phase: number }
  | { kind: 'axe'; i: number; j: number; along: 'i' | 'j'; phase: number }
  | { kind: 'boulder'; from: { i: number; j: number }; to: { i: number; j: number }; phase: number };
export interface Dungeon {
  W: number;
  H: number;
  grid: Uint8Array;
  rooms: DRoom[];
  traps: DTrap[];
  /** the boss room's door: locked until you bring the key */
  lock: number[];
  /** tiles of corridor (for the map's fog and for traps) */
  corridor: Set<number>;
}

const CELL = 17;
const COLS = 3;
const ROWS = 4;

export function makeDungeon(rnd: () => number = Math.random): Dungeon {
  const W = COLS * CELL + 2;
  const H = ROWS * CELL + 2;
  const grid = new Uint8Array(W * H).fill(D_ROCK);
  const at = (i: number, j: number) => j * W + i;
  const R = (n: number) => Math.floor(rnd() * n);

  // the tree of cells: grown out from the start (bottom row, middle) one neighbour at a time
  const want = 8 + R(2);
  const start = { c: 1, r: ROWS - 1 };
  const key = (c: number, r: number) => r * COLS + c;
  const used = new Map<number, { c: number; r: number }>([[key(start.c, start.r), start]]);
  const edges: [number, number][] = [];
  while (used.size < want) {
    const options: [number, number][] = [];
    for (const [k, p] of used)
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = p.c + dc;
        const r = p.r + dr;
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS || used.has(key(c, r))) continue;
        options.push([k, key(c, r)]);
      }
    if (!options.length) break;
    const [from, to] = options[R(options.length)];
    used.set(to, { c: to % COLS, r: Math.floor(to / COLS) });
    edges.push([from, to]);
  }

  // each cell's room: a rectangle kept three tiles in from the cell's sides (so corridors pass between)
  const cells = [...used.keys()];
  const roomOf = new Map<number, DRoom>();
  cells.forEach((k, id) => {
    const p = used.get(k)!;
    const ox = 1 + p.c * CELL;
    const oy = 1 + p.r * CELL;
    const w = 8 + R(4);
    const h = 8 + R(4);
    const i0 = ox + 3 + R(CELL - 6 - w + 1);
    const j0 = oy + 3 + R(CELL - 6 - h + 1);
    const room: DRoom = { id, i0, j0, i1: i0 + w - 1, j1: j0 + h - 1, kind: 'fight', depth: 0, doors: [], cleared: false, seen: false };
    roomOf.set(k, room);
    for (let j = room.j0; j <= room.j1; j++) for (let i = room.i0; i <= room.i1; i++) grid[at(i, j)] = D_FLOOR;
  });

  // corridors: an L from one room's side, across the gap, into the other's
  const corridor = new Set<number>();
  const legs: Leg[] = [];
  const carve = (i: number, j: number) => {
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const k = at(i + di, j + dj);
        if (grid[k] === D_ROCK) corridor.add(k);
        grid[k] = D_FLOOR;
      }
  };
  const line = (a: { i: number; j: number }, b: { i: number; j: number }) => {
    const n = Math.abs(b.i - a.i) + Math.abs(b.j - a.j);
    for (let s = 0; s <= n; s++) carve(a.i + Math.sign(b.i - a.i) * s, a.j + Math.sign(b.j - a.j) * s);
    if (n >= 1) legs.push({ a: { ...a }, b: { ...b } });
  };
  const mid = (lo: number, hi: number) => lo + 1 + R(Math.max(1, hi - lo - 1));
  for (const [ka, kb] of edges) {
    let A = roomOf.get(ka)!;
    let B = roomOf.get(kb)!;
    const pa = used.get(ka)!;
    const pb = used.get(kb)!;
    if (pa.r === pb.r) {
      // side by side: A on the left
      if (pb.c < pa.c) [A, B] = [B, A];
      const ja = mid(A.j0, A.j1);
      const jb = mid(B.j0, B.j1);
      const xm = Math.floor((A.i1 + B.i0) / 2);
      line({ i: A.i1 + 1, j: ja }, { i: xm, j: ja });
      line({ i: xm, j: ja }, { i: xm, j: jb });
      line({ i: xm, j: jb }, { i: B.i0 - 1, j: jb });
    } else {
      // one above the other: A on top
      if (pb.r < pa.r) [A, B] = [B, A];
      const ia = mid(A.i0, A.i1);
      const ib = mid(B.i0, B.i1);
      const ym = Math.floor((A.j1 + B.j0) / 2);
      line({ i: ia, j: A.j1 + 1 }, { i: ia, j: ym });
      line({ i: ia, j: ym }, { i: ib, j: ym });
      line({ i: ib, j: ym }, { i: ib, j: B.j0 - 1 });
    }
  }

  // walls: the rock that touches open floor
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      if (grid[at(i, j)] !== D_ROCK) continue;
      let near = false;
      for (let dj = -1; dj <= 1 && !near; dj++)
        for (let di = -1; di <= 1 && !near; di++) {
          const ni = i + di;
          const nj = j + dj;
          if (ni >= 0 && nj >= 0 && ni < W && nj < H && grid[at(ni, nj)] === D_FLOOR) near = true;
        }
      if (near) grid[at(i, j)] = D_WALL;
    }

  // each room's doors: the open tiles in its ring of walls
  const rooms = cells.map((k) => roomOf.get(k)!);
  for (const r of rooms)
    for (let j = r.j0 - 1; j <= r.j1 + 1; j++)
      for (let i = r.i0 - 1; i <= r.i1 + 1; i++) {
        if (i >= r.i0 && i <= r.i1 && j >= r.j0 && j <= r.j1) continue;
        if (grid[at(i, j)] === D_FLOOR) r.doors.push(at(i, j));
      }

  // what each room is: by how far it is from the start
  const adj = new Map<number, number[]>();
  for (const [a, b] of edges) {
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
  }
  const depth = new Map<number, number>([[key(start.c, start.r), 0]]);
  const q = [key(start.c, start.r)];
  for (let h = 0; h < q.length; h++) for (const n of adj.get(q[h]) ?? []) if (!depth.has(n)) (depth.set(n, depth.get(q[h])! + 1), q.push(n));
  for (const k of cells) roomOf.get(k)!.depth = depth.get(k) ?? 0;
  const startRoom = roomOf.get(key(start.c, start.r))!;
  startRoom.kind = 'start';
  startRoom.cleared = true;
  const leaves = cells.filter((k) => k !== key(start.c, start.r) && (adj.get(k)?.length ?? 0) === 1).map((k) => roomOf.get(k)!);
  leaves.sort((a, b) => b.depth - a.depth);
  const others = rooms.filter((r) => r.kind === 'fight').sort((a, b) => b.depth - a.depth);
  const boss = leaves[0] ?? others[0];
  boss.kind = 'boss';
  const keyRoom = leaves.find((r) => r.kind === 'fight') ?? rooms.filter((r) => r.kind === 'fight').sort((a, b) => b.depth - a.depth)[0];
  if (keyRoom) keyRoom.kind = 'key';
  const vault = leaves.find((r) => r.kind === 'fight');
  if (vault) {
    vault.kind = 'vault';
    vault.cleared = true;
  }
  const lock = [...boss.doors];

  // inside the rooms: pillars (mirrored round the middle) and a crate or two by the walls
  for (const r of rooms) {
    if (r.kind === 'start') continue;
    const cx = (r.i0 + r.i1) / 2;
    const cy = (r.j0 + r.j1) / 2;
    const w = r.i1 - r.i0 + 1;
    const h = r.j1 - r.j0 + 1;
    if (w >= 9 && h >= 9 && rnd() < 0.8) {
      const dx = Math.floor(w / 2) - 2 - R(2);
      const dy = Math.floor(h / 2) - 2 - R(2);
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) grid[at(Math.round(cx + sx * dx), Math.round(cy + sy * dy))] = D_WALL;
    }
    const crates = r.kind === 'vault' ? 3 : R(3);
    for (let n = 0, tries = 0; n < crates && tries < 30; tries++) {
      const side = R(4);
      const i = side === 0 ? r.i0 : side === 1 ? r.i1 : r.i0 + 1 + R(w - 2);
      const j = side === 2 ? r.j0 : side === 3 ? r.j1 : r.j0 + 1 + R(h - 2);
      // (never in front of a door)
      if (r.doors.some((d) => Math.abs((d % W) - i) + Math.abs(Math.floor(d / W) - j) < 3)) continue;
      if (grid[at(i, j)] !== D_FLOOR) continue;
      grid[at(i, j)] = D_CRATE;
      n++;
    }
  }

  // traps, one to a leg: the boulder down the longest straight, then axes and spikes on the rest
  const traps: DTrap[] = [];
  const len = (l: Leg) => Math.abs(l.b.i - l.a.i) + Math.abs(l.b.j - l.a.j);
  const free = legs.filter((l) => len(l) >= 3).sort((a, b) => len(b) - len(a));
  const nearStart = (i: number, j: number) => i >= startRoom.i0 - 3 && i <= startRoom.i1 + 3 && j >= startRoom.j0 - 3 && j <= startRoom.j1 + 3;
  const long = free.find((l) => len(l) >= 7 && !nearStart(l.a.i, l.a.j) && !nearStart(l.b.i, l.b.j));
  if (long) {
    traps.push({ kind: 'boulder', from: long.a, to: long.b, phase: rnd() * 4 });
    free.splice(free.indexOf(long), 1);
  }
  for (const l of free) {
    const m = { i: Math.round((l.a.i + l.b.i) / 2), j: Math.round((l.a.j + l.b.j) / 2) };
    if (nearStart(m.i, m.j) || rnd() < 0.3) continue;
    const along = l.a.i === l.b.i ? 'j' : 'i';
    if (len(l) >= 4 && rnd() < 0.45) traps.push({ kind: 'axe', i: m.i, j: m.j, along, phase: rnd() * Math.PI * 2 });
    else {
      // a strip of spikes right across the corridor
      const tiles = [-1, 0, 1].map((o) => (along === 'j' ? at(m.i + o, m.j) : at(m.i, m.j + o)));
      if (tiles.every((t) => grid[t] === D_FLOOR)) traps.push({ kind: 'spikes', tiles, phase: rnd() * 3 });
    }
  }
  // and a bed of spikes in a couple of the rooms (clear of the doors and the middle)
  for (const r of rooms.filter((r) => r.kind === 'fight' || r.kind === 'vault').sort(() => rnd() - 0.5).slice(0, 2)) {
    const i = r.i0 + 1 + R(Math.max(1, r.i1 - r.i0 - 3));
    const j = r.j0 + 1 + R(Math.max(1, r.j1 - r.j0 - 3));
    const tiles = [at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1)];
    if (tiles.every((t) => grid[t] === D_FLOOR) && !r.doors.some((d) => Math.abs((d % W) - i) + Math.abs(Math.floor(d / W) - j) < 3)) traps.push({ kind: 'spikes', tiles, phase: rnd() * 3 });
  }

  return { W, H, grid, rooms, traps, lock, corridor };
}

// ---------- loot ----------

export type Rarity = 0 | 1 | 2 | 3;
export const RARITY = [
  { name: 'Common', color: '#c9ced8', hex: 0xc9ced8 },
  { name: 'Rare', color: '#4aa8ff', hex: 0x4aa8ff },
  { name: 'Epic', color: '#c25aff', hex: 0xc25aff },
  { name: 'Legendary', color: '#ffb02a', hex: 0xffb02a },
] as const;
export type Perk = 'fury' | 'leech' | 'bounce' | 'pierce';
export const PERKS: Record<Perk, { name: string; text: string }> = {
  fury: { name: 'Fury', text: 'A hit has a 20% chance to raise your damage 40% for 5 s' },
  leech: { name: 'Vampiric', text: 'Heal 6% of the damage you deal' },
  bounce: { name: 'Ricochet', text: 'Marbles bounce off walls once more' },
  pierce: { name: 'Skewer', text: 'Marbles pass through one more fighter' },
};
export interface Gear {
  name: string;
  rarity: Rarity;
  /** bonuses as fractions: damage, fire rate, chance of a critical hit (1.8× damage) */
  dmg: number;
  rate: number;
  crit: number;
  perk: Perk | null;
}
export const STARTER: Gear = { name: 'Starter Launcher', rarity: 0, dmg: 0, rate: 0, crit: 0, perk: null };

const FIRST = ['Pebble', 'Glass', 'Iron', 'Ember', 'Frost', 'Storm', 'Comet', 'Grave', 'Thorn', 'Ruin'];
const LAST = ['Slinger', 'Launcher', 'Repeater', 'Cannon', 'Blaster', 'Mortar'];

/** a launcher found at depth d (deeper finds roll better) */
export function rollGear(minRarity: Rarity = 0, depth = 0, rnd: () => number = Math.random): Gear {
  const roll = rnd() + depth * 0.04;
  let rarity = (roll > 0.93 ? 3 : roll > 0.72 ? 2 : roll > 0.4 ? 1 : 0) as Rarity;
  if (rarity < minRarity) rarity = minRarity;
  const budget = [0.18, 0.32, 0.46, 0.62][rarity] * (0.85 + rnd() * 0.3);
  // split the budget over two or three stats (damage counts double against fire rate's half)
  const w = [rnd(), rnd(), rarity >= 1 ? rnd() : 0];
  const sum = w[0] + w[1] + w[2] || 1;
  let dmg = (budget * w[0]) / sum;
  let rate = (budget * w[1]) / sum;
  const crit = Math.min(0.2, ((budget * w[2]) / sum) * 0.6);
  // now and then a heavy one: big damage, slower to fire (or the other way round)
  if (rnd() < 0.3) {
    if (rnd() < 0.5) {
      dmg += 0.15 + rnd() * 0.1;
      rate = -(0.08 + rnd() * 0.08);
    } else {
      rate += 0.12 + rnd() * 0.08;
      dmg = -(0.06 + rnd() * 0.06);
    }
  }
  const perks = Object.keys(PERKS) as Perk[];
  const perk = rarity >= 2 ? perks[Math.floor(rnd() * perks.length)] : null;
  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    name: `${FIRST[Math.floor(rnd() * FIRST.length)]} ${LAST[Math.floor(rnd() * LAST.length)]}`,
    rarity,
    dmg: round(dmg),
    rate: round(rate),
    crit: round(crit),
    perk,
  };
}

/** one number to compare by: how much harder it hits over time than bare hands (100) */
export function gearPower(g: Gear) {
  const perk = g.perk === 'fury' ? 1.07 : g.perk ? 1.05 : 1;
  return Math.round(100 * (1 + g.dmg) * (1 + g.rate) * (1 + g.crit * 0.8) * perk);
}
