// Air-drop items: data only, so new items are a new entry plus a case in
// Game.useItem().

export type ItemType = 'multi' | 'boost' | 'heal' | 'dragon';

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
/** dragon shot: three heavy balls that weave side to side */
export const DRAGON = { count: 3, gap: 0.12, radius: 1.7, mass: 25, damage: 2.6, speed: 0.9, amp: 0.9, freq: 7, life: 1.6 };
