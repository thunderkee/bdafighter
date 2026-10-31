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

/** the arenas that had pinball boards (Dune Canyon, Candy Land, Cloud Kingdom, Haunted Manor,
 * Coral Reef) are gone: every table is clear again */
export const BOARDS: Record<string, Board> = {};

export const PORTAL_R = 0.55;
/** a pop bumper's kick: the marble leaves at least this fast (and never faster than the cap) */
export const KICK = { min: 15, mul: 1.2, max: 24 };
