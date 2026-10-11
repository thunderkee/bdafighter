// Air-drop items: data only, so new items are a new entry plus a case in
// Game.useItem().

export type ItemType = 'multi' | 'boost' | 'heal' | 'dragon' | 'missile';

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
  boost: { name: 'Overdrive', short: 'BOOST', color: 0xffd23e, duration: 6, weight: 1 },
  heal: { name: 'Repair Kit', short: 'REPAIR', color: 0x4dff88, duration: 0, weight: 0.8 },
  dragon: { name: 'Dragon Shot', short: 'DRAGON', color: 0xff3e8e, duration: 0, weight: 0.8 },
  missile: { name: 'Homing Missile', short: 'MISSILE', color: 0xff7a2a, duration: 0, weight: 0.8 },
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
/** overdrive: move speed multiplier */
export const BOOST = { speed: 1.8 };
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

export type GateType = 'x5' | 'pow' | 'drg';

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
