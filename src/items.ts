// Air-drop items: data only, so new items are a new entry plus a case in
// Game.useItem().

export type ItemType = 'multi' | 'slowmo' | 'heal' | 'dragon' | 'missile' | 'wiper' | 'lock';

export interface ItemDef {
  name: string;
  short: string;
  color: number;
  /** seconds the effect lasts (0 = instant) */
  duration: number;
  /** spawn weight; heal is re-weighted by the receiver's health */
  weight: number;
}

export const ITEMS: Record<ItemType, ItemDef> = {
  multi: { name: 'Multi Shot', short: 'MULTI', color: 0x3ef0ff, duration: 6, weight: 1 },
  slowmo: { name: 'Slow-Mo', short: 'SLOW-MO', color: 0xffd23e, duration: 5, weight: 1 },
  heal: { name: 'Repair Kit', short: 'REPAIR', color: 0x4dff88, duration: 0, weight: 0.8 },
  dragon: { name: 'Dragon Shot', short: 'DRAGON', color: 0xff3e8e, duration: 0, weight: 0.8 },
  missile: { name: 'Homing Missile', short: 'MISSILE', color: 0xff7a2a, duration: 0, weight: 0.8 },
  wiper: { name: 'Wiper', short: 'WIPER', color: 0xc8925a, duration: 6, weight: 0.9 },
  lock: { name: 'Smart Lock', short: 'LOCK', color: 0xff3b3b, duration: 7, weight: 0.9 },
};

export const ITEM_TYPES = Object.keys(ITEMS) as ItemType[];

export const DROP = {
  /** seconds into the fight before the first drop */
  first: 8,
  /** gap between drops */
  every: [11, 15] as [number, number],
  startHeight: 11,
  fallSpeed: 2.6,
  /** seconds a landed crate waits before vanishing */
  landedLife: 8,
  /** how close (x) a robot must be to grab it */
  reach: 0.95,
};

/** multi shot: marbles per volley, fan half-angle, damage scale, fire-interval scale */
export const MULTI = { count: 6, fan: 0.32, damage: 0.6, interval: 2 };
/** slow-mo user's shots become boost balls: bigger, heavier, a touch faster, harder hitting */
export const BOOST_BALL = { radius: 1.3, mass: 1.6, speed: 1.1, damage: 1.5 };
/**
 * slow-mo: the whole match runs at `world` speed for `duration` game seconds
 * (so twice as long in real time), while the robot that used it moves, fires
 * and reloads at `owner` times real speed
 */
/** world runs at 0.2x; whoever triggered it moves and fires at 1.25x real time */
export const SLOWMO = { world: 0.2, owner: 1.25 };
/** wiper: a brick that sweeps in front of the robot and sends enemy balls back as its own */
export const WIPER = { halfWidth: 1.0, ahead: 1.2, sweep: 0.9, sweepSpeed: 3.2, speedUp: 1.1 };
/** repair kit: fraction of max health restored */
export const HEAL = { fraction: 0.25 };
/**
 * homing missile: chases the opponent with a limited turn rate (so a sharp
 * sidestep can slip it), hits up to 3 times, then is destroyed
 */
export const MISSILE = { speed: 9, turnRate: 2.6, hits: 3, damage: 6, hitRadius: 0.85, recover: 0.75, life: 14 };
/** dragon shot: three heavy balls that weave side to side */
export const DRAGON = { count: 3, gap: 0.12, radius: 1.7, mass: 25, damage: 2.6, speed: 0.9, amp: 0.9, freq: 7, life: 1.6 };

// ---------- gates ----------

export type GateType = 'x5' | 'pow' | 'drg' | 'hom' | 'wall';

export interface GateDef {
  label: string;
  name: string;
  color: number;
  /** balls a gate can transform before it shatters */
  charges: number;
}

export const GATES: Record<GateType, GateDef> = {
  x5: { label: '5×', name: 'Power ×5', color: 0xffc23d, charges: 3 },
  pow: { label: 'POW', name: 'Power Ball', color: 0x3ef0ff, charges: 3 },
  drg: { label: 'DRG', name: 'Dragon Gate', color: 0xff3e8e, charges: 1 },
  hom: { label: 'HOM', name: 'Homing Gate', color: 0xff7a2a, charges: 1 },
  // a solid wall: "charges" are the hits it takes before it breaks
  wall: { label: 'WALL', name: 'Wall', color: 0x9aa8c4, charges: 5 },
};

export const GATE_TYPES = Object.keys(GATES) as GateType[];

export const GATE = {
  /** seconds into the fight before the first gate */
  first: 14,
  every: [13, 17] as [number, number],
  /** a gate lives this long, sliding side to side */
  life: 5,
  halfWidth: 1.15,
  /** sideways slide: amplitude (m) and angular speed (rad/s) */
  sway: 3.2,
  swaySpeed: 1.6,
  /** gates appear somewhere in this y band (between the puck fences) */
  band: 5.2,
};

/** 5× gate: damage multiplier and visual growth for a basic ball */
export const X5 = { damage: 5, radius: 1.45, mass: 4 };

// ---------- shield ----------

export const SHIELD = {
  max: 100,
  /** energy drained per second while raised */
  drain: 9,
  /** energy cost per point of damage blocked */
  blockCost: 1.3,
  /** regen per second once lowered for regenDelay seconds */
  regen: 14,
  regenDelay: 0.9,
  /** seconds the shield is locked out after it breaks */
  breakLock: 2.5,
  /** move speed while shielding */
  moveMul: 0.5,
};

// ---------- table obstacles ----------

/** destructible cover: mirrored pairs in front of each rail */
export const COVER = { hp: 5, halfWidth: 0.7, halfDepth: 0.18, y: 5.2 };
export const COVER_X: number[][] = [[], [0], [-2.2, 2.2], [-3, 0, 3]];
/** pinball pins: point-symmetric so both sides get the same deflections */
export const PIN = { radius: 0.16 };
export const PIN_SPOTS: [number, number][] = [
  [-1.3, 1.7],
  [1.3, -1.7],
  [3.3, 1.0],
  [-3.3, -1.0],
  [-0.9, 4.3],
  [0.9, -4.3],
  [3.6, 6.3],
  [-3.6, -6.3],
];
