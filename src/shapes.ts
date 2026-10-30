import { ARENA } from './config';

/**
 * Shaped boards: arenas whose side walls aren't straight. Nothing is added inside the table
 * (no pins or walls), only the outline changes, so every shot that reaches a side banks off
 * an angled wall instead of a straight one.
 *
 * Each outline is its right-hand wall, from the near end (y = -13) to the far end (y = 13), in
 * game space for the standard 10 m table; the left wall is its mirror through the centre, so
 * both ends of the table get exactly the same board. Both rails stay full width (the bends
 * are kept to |y| < 7.5, in front of the ammo boxes) so moving along them never changes.
 */
export type Pt = [number, number];

const L = 13;
/** the S-bend: the whole channel swings right, then left (an odd curve, so it mirrors onto itself) */
const serpent = (): Pt[] => {
  const pts: Pt[] = [[5, -L]];
  for (let k = 0; k <= 24; k++) {
    const y = -7.5 + (15 * k) / 24;
    pts.push([5 + 2.4 * Math.sin((Math.PI * y) / 7.5), y]);
  }
  pts.push([5, L]);
  return pts;
};

export const SHAPES: Record<string, Pt[]> = {
  // Sandglass Pass: pinched to under half its width in the middle; everything funnels through
  sandglass: [[5, -L], [5, -7.5], [2.4, -1.6], [2.4, 1.6], [5, 7.5], [5, L]],
  // Crystal Court: a hexagon that bulges half again as wide; long angled banks either side
  crystal: [[5, -L], [5, -7.5], [7.6, -2.8], [7.6, 2.8], [5, 7.5], [5, L]],
  // Serpent Run: the channel snakes in an S, so a straight shot down one side meets a wall
  serpent: serpent(),
};

/** an arena's outline on the current table (its right and left walls), or null for a plain one */
export interface Shape {
  right: Pt[];
  left: Pt[];
}
export function shapeOf(id: string | null | undefined): Shape | null {
  const src = id ? SHAPES[id] : undefined;
  if (!src) return null;
  // (laid out for the standard table: across, it scales with the table's width)
  const k = ARENA.width / 10;
  const right = src.map(([x, y]) => [x * k, y] as Pt);
  // the left wall: the right one turned through the centre, then put back in y order
  const left = right.map(([x, y]) => [-x, -y] as Pt).reverse();
  return { right, left };
}

/** where a wall is at this y, and the segment it's on */
function at(wall: Pt[], y: number) {
  for (let i = 1; i < wall.length; i++) {
    const [x0, y0] = wall[i - 1];
    const [x1, y1] = wall[i];
    if (y <= y1 || i === wall.length - 1) {
      const t = y1 === y0 ? 0 : Math.max(0, Math.min(1, (y - y0) / (y1 - y0)));
      return { x: x0 + (x1 - x0) * t, dx: x1 - x0, dy: y1 - y0 };
    }
  }
  return { x: wall[0][0], dx: 0, dy: 1 };
}

/** the open span across the table at this y: [left wall, right wall] */
export function bounds(s: Shape, y: number): [number, number] {
  return [at(s.left, y).x, at(s.right, y).x];
}

/** the widest the table gets (for floors and wide checks) */
export function maxHalf(s: Shape) {
  return Math.max(...s.right.map((p) => p[0]), ...s.left.map((p) => -p[0]));
}

/**
 * Keep a moving point (radius r) inside the walls: if it has gone past one, put it back and
 * reflect its direction off that wall's slope. Returns the new direction, or null if it's clear.
 */
export function bounce(s: Shape, x: number, y: number, dx: number, dy: number, r: number): { x: number; dx: number; dy: number } | null {
  const [lo, hi] = bounds(s, y);
  const side = x > hi - r ? 1 : x < lo + r ? -1 : 0;
  if (!side) return null;
  const w = at(side > 0 ? s.right : s.left, y);
  // the wall's inward normal
  const len = Math.hypot(w.dx, w.dy) || 1;
  let nx = w.dy / len;
  let ny = -w.dx / len;
  if (nx * -side < 0) {
    nx = -nx;
    ny = -ny;
  }
  const dot = dx * nx + dy * ny;
  // (already moving back in: just put it back)
  const out = dot < 0 ? { dx: dx - 2 * dot * nx, dy: dy - 2 * dot * ny } : { dx, dy };
  return { x: side > 0 ? hi - r : lo + r, ...out };
}
