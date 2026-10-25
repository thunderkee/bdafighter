/**
 * Pinball boards for the newer arenas: things in the middle of the table that throw marbles
 * around. Pop bumpers kick a marble away hard, slingshot bars bounce it harder than a wall,
 * current zones (wind, sand, sea, a conveyor) bend it as it crosses, and portals swap it
 * across the board. Every layout is point-symmetric, so both ends of the table get exactly
 * the same board. Coordinates are game space (x across, y down the table toward the
 * opponent) for the standard 10 m table, and stay in |y| < 4.4, clear of both rails and of
 * a robot that has stepped up.
 */
export interface Bumper {
  x: number;
  y: number;
  r: number;
}
export interface Bar {
  x: number;
  y: number;
  len: number;
  /** radians, from the x axis */
  angle: number;
}
export interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
  /** the push on a marble inside it, m/s per second */
  fx: number;
  fy: number;
}
export interface Portal {
  a: [number, number];
  b: [number, number];
}
export interface Board {
  bumpers: Bumper[];
  bars: Bar[];
  zones: Zone[];
  portals: Portal[];
}

/** a layout plus its mirror through the centre (pieces on the centre are kept once) */
function sym(half: Partial<Board>): Board {
  const onCentre = (x: number, y: number) => Math.abs(x) < 1e-6 && Math.abs(y) < 1e-6;
  const bumpers = (half.bumpers ?? []).flatMap((b) => (onCentre(b.x, b.y) ? [b] : [b, { ...b, x: -b.x, y: -b.y }]));
  const bars = (half.bars ?? []).flatMap((b) => [b, { ...b, x: -b.x, y: -b.y }]);
  const zones = (half.zones ?? []).flatMap((z) => [z, { ...z, x: -z.x, y: -z.y, fx: -z.fx, fy: -z.fy }]);
  const portals = (half.portals ?? []).flatMap((p) => [p, { a: [-p.a[0], -p.a[1]] as [number, number], b: [-p.b[0], -p.b[1]] as [number, number] }]);
  return { bumpers, bars, zones, portals };
}

export const BOARDS: Record<string, Board> = {
  // Dune Canyon: rock bumpers and two sandstorm bands that bend every shot into an S
  desert: sym({
    bumpers: [
      { x: -2.6, y: 2.4, r: 0.55 },
      { x: 2.4, y: 0.8, r: 0.5 },
    ],
    zones: [{ x: 0, y: 3.2, w: 10, h: 1.5, fx: 6, fy: 0 }],
  }),
  // Candy Land: candy-cane slingshots angled across the lanes, gumdrop bumpers, a conveyor
  candy: sym({
    bumpers: [{ x: 1.6, y: 1.4, r: 0.5 }],
    bars: [
      { x: -3.0, y: 2.6, len: 2.2, angle: 0.5 },
      { x: 3.2, y: 3.6, len: 1.8, angle: -0.6 },
    ],
    zones: [{ x: 2.6, y: -0.9, w: 3.2, h: 1.2, fx: -6, fy: 0 }],
  }),
  // Cloud Kingdom: gusts across the table, alternating, round a cloud bumper in the middle
  cloud: sym({
    bumpers: [
      { x: 0, y: 0, r: 0.7 },
      { x: -3.2, y: 3.4, r: 0.45 },
    ],
    zones: [
      { x: 0, y: 1.8, w: 10, h: 1.3, fx: 7, fy: 0 },
      { x: 0, y: 4.0, w: 10, h: 0.9, fx: -7, fy: 0 },
    ],
  }),
  // Haunted Manor: a pair of portals each side (a shot into one leaves the other), tombstone bumpers
  haunted: sym({
    bumpers: [{ x: 0, y: 2.8, r: 0.5 }],
    bars: [{ x: -3.4, y: 0.6, len: 1.6, angle: 1.2 }],
    portals: [{ a: [-2.6, 1.6], b: [2.8, 3.8] }],
  }),
  // Coral Reef: anemone bumpers, coral slingshots, and a forward current down each flank
  reef: sym({
    bumpers: [
      { x: -1.6, y: 3.2, r: 0.5 },
      { x: 2.6, y: 1.6, r: 0.55 },
    ],
    bars: [{ x: 0.8, y: 4.0, len: 1.6, angle: 0.3 }],
    zones: [{ x: -3.2, y: 0, w: 2.2, h: 5, fx: 0, fy: 5 }],
  }),
};

export const PORTAL_R = 0.55;
/** a pop bumper's kick: the marble leaves at least this fast (and never faster than the cap) */
export const KICK = { min: 15, mul: 1.2, max: 24 };
