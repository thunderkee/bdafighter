// Arena and match tuning. Physics units are metres-ish; the arena is a
// portrait rectangle with the player at -y and the opponent at +y.

export const ARENA = {
  width: 10,
  length: 26,
  /** y of each shooter's rail (player at -railY, opponent at +railY) */
  railY: 10.6,
  /** how far a shooter may slide left/right from centre */
  railHalfWidth: 4.1,
  /** bumps are fenced into the middle band so they never pin a shooter */
  bumpFenceY: 7.6,
  wallThickness: 0.5,
};

/** table widths for the Stage width setting; the rail stops 0.9 m short of each wall */
export const ARENA_WIDTHS = { small: 8, normal: 10, large: 13 } as const;
export type ArenaWidth = keyof typeof ARENA_WIDTHS;
/** set before the game (physics walls) and the stage are built */
export function setArenaWidth(key: string | undefined) {
  const w = ARENA_WIDTHS[(key ?? 'normal') as ArenaWidth] ?? ARENA_WIDTHS.normal;
  ARENA.width = w;
  ARENA.railHalfWidth = w / 2 - 0.9;
}

export const MATCH = {
  duration: 60,
  maxHealth: 100,
  countdown: 2.4,
  /** active marble cap across both sides (multi-shot volleys need headroom) */
  marbleCap: 110,
  marblePool: 140,
  marbleLifetime: 3.6,
  marbleMaxBounces: 4,
};

export const AIM_LIMIT = 1.15; // radians either side of straight ahead

/** Final, flattened stats a shooter fights with. Parts produce these. */
export interface ShooterStats {
  muzzleSpeed: number; // m/s
  spread: number; // radians, random cone half-angle
  fireInterval: number; // seconds between marbles
  marbleRadius: number;
  marbleMass: number;
  damage: number; // per hit at full speed
  capacity: number; // marbles per magazine
  reloadTime: number; // seconds for an empty magazine
  moveSpeed: number; // m/s along the rail
  /** agility trait: shield recharge multiplier (CPU units also dodge better) */
  agility?: number;
  /** twin barrels: each regular shot is two marbles side by side */
  twin?: boolean;
  /** spread fire: marbles per regular shot, fanned around the aim (an arcade boss) */
  fan?: number;
  /** a unit's signature trick (see Special) */
  special?: Special;
  /** how bouncy its marbles are (restitution) */
  bounce?: number;
}

/**
 * Marble types: each fighter fires one kind. They trade size, weight and punch against speed,
 * fire rate and how many fit in a magazine, so the damage a fighter can put out stays about even:
 * - light: small and fast, quick to fire, a big magazine; light hits that lose a head-on clash
 * - standard: the all-rounder
 * - heavy: big and slow, little bounce, a small magazine and a slower trigger; it hits hard, knocks
 *   back and ploughs through lighter marbles
 * - bouncy: keeps its speed off the walls, for bank shots; a touch softer straight on
 * (radius, mass, speed, damage and fire are multipliers on the base; mag is marbles per load when
 * magazines are per fighter; reload multiplies the reload time)
 */
export type MarbleType = 'light' | 'standard' | 'heavy' | 'bouncy';
export const MARBLES: Record<MarbleType, { name: string; radius: number; mass: number; speed: number; damage: number; fire: number; bounce: number; mag: number; reload: number }> = {
  light: { name: 'Light', radius: 0.85, mass: 0.6, speed: 1.12, damage: 0.78, fire: 0.85, bounce: 0.82, mag: 14, reload: 1.15 },
  standard: { name: 'Standard', radius: 1, mass: 1, speed: 1, damage: 1, fire: 1, bounce: 0.82, mag: 10, reload: 1 },
  heavy: { name: 'Heavy', radius: 1.3, mass: 2.4, speed: 0.86, damage: 1.55, fire: 1.3, bounce: 0.55, mag: 6, reload: 1.1 },
  bouncy: { name: 'Bouncy', radius: 1, mass: 0.9, speed: 1, damage: 0.9, fire: 1, bounce: 0.97, mag: 12, reload: 1.05 },
};
/** each fighter's marble (by its base unit); anything not listed fires standard */
export const MARBLE_OF: Record<string, MarbleType> = {
  pioneer: 'light',
  nightshade: 'light',
  ember: 'light',
  angel: 'standard',
  liberty: 'standard',
  kabuto: 'standard',
  bastion: 'standard',
  baron: 'standard',
  // (Wyvern's wound-up punch already throws a heavy marble: on heavy marbles too it ran away with fights)
  dragon: 'standard',
  monoceros: 'heavy',
  rex: 'heavy',
  tyrant: 'heavy',
  liger: 'bouncy',
  violet: 'bouncy',
};
/**
 * Balance: a hidden damage scale per fighter (by base unit), tuned from bot-against-bot round
 * robins so every fighter wins about half its fights; the stat bars on the cards are unchanged.
 * (A fighter whose trick costs it shots, like Pioneer's gun toss or Ember's sweeping head, hits
 * harder; one whose kit already stacks up, like Wyvern's wound-up heavy marbles, hits softer.)
 */
export const BALANCE: Record<string, number> = {
  pioneer: 2.05,
  ember: 1.8,
  rex: 1.55,
  angel: 1.45,
  monoceros: 1.15,
  nightshade: 1.09,
  bastion: 1.05,
  tyrant: 1,
  violet: 0.9,
  dragon: 0.85,
  kabuto: 0.84,
  liberty: 0.78,
  liger: 0.76,
  baron: 0.7,
};
/** signature magazines that break the type's rule: the Baron's drum */
export const MAG_OF: Record<string, number> = { baron: 18 };

/**
 * Signature tricks some units have:
 * - windup: seconds of wind-up before each shot leaves (Wyvern punches, then its maw blasts);
 *   the wound-up shot hits harder and knocks back more
 * - hand: how far the gun sits off the centre line; the shot leaves from that side
 * - swap: shots before the gun is tossed to the other hand (Pioneer)
 * - alternate: fire from alternate hands, shot by shot (Kabuto's twin fist cannons)
 * - wobble: the head keeps turning this far (radians) left and right, and each shot leaves the way
 *   it's facing, so rapid fire sweeps across the table (Ember)
 * - bite: every this-many shots is a giant, heavy marble (Rex)
 * - ricochet: its marbles keep their speed off the walls and gain this share of damage per bounce (Liger)
 */
/** seconds a swapped gun takes to jump from one hand to the other (it fires once it lands) */
export const TOSS_TIME = 0.3;

export interface Special {
  windup?: number;
  hand?: number;
  swap?: number;
  alternate?: boolean;
  wobble?: number;
  bite?: number;
  ricochet?: number;
}

export const BASE_STATS: ShooterStats = {
  muzzleSpeed: 17,
  spread: 0.035,
  fireInterval: 0.13,
  marbleRadius: 0.264,
  marbleMass: 1,
  damage: 6.5,
  capacity: 14,
  reloadTime: 1.5,
  moveSpeed: 7,
};

export interface AIProfile {
  name: string;
  /** seconds before reacting to a new threat */
  reaction: number;
  /** std-dev of aim noise, radians */
  aimError: number;
  /** 0 = aim at where you are, 1 = perfect lead */
  lead: number;
  /** chance (0..1) of dodging a marble that would hit */
  dodge: number;
  /** aim turn rate, rad/s */
  turnRate: number;
  burst: [number, number];
  pause: [number, number];
  bankChance: number;
  bumpChance: number;
  moveSpeedMul: number;
  stats?: Partial<ShooterStats>;
}

/** CPU intelligence levels, Rookie to Ace (settings keys) */
export type AILevel = 'easy' | 'normal' | 'hard' | 'ace';

export const AI_PROFILES: Record<string, AIProfile> = {
  easy: {
    name: 'Practice Bot',
    reaction: 0.45,
    aimError: 0.12,
    lead: 0.2,
    dodge: 0.15,
    turnRate: 1.6,
    burst: [0.4, 0.9],
    pause: [0.9, 1.6],
    bankChance: 0.05,
    bumpChance: 0.1,
    moveSpeedMul: 0.6,
  },
  normal: {
    name: 'Sparring Bot',
    reaction: 0.28,
    aimError: 0.07,
    lead: 0.6,
    dodge: 0.45,
    turnRate: 2.6,
    burst: [0.5, 1.2],
    pause: [0.5, 1.1],
    bankChance: 0.15,
    bumpChance: 0.15,
    moveSpeedMul: 0.85,
  },
  hard: {
    name: 'Champion Bot',
    reaction: 0.16,
    aimError: 0.03,
    lead: 0.9,
    dodge: 0.75,
    turnRate: 3.6,
    burst: [0.7, 1.6],
    pause: [0.3, 0.7],
    bankChance: 0.25,
    bumpChance: 0.15,
    moveSpeedMul: 1,
  },
  ace: {
    name: 'Ace Bot',
    // veteran's firing rhythm (so it never starves its magazine) with sharper eyes and reflexes
    reaction: 0.1,
    aimError: 0.015,
    lead: 0.97,
    dodge: 0.9,
    turnRate: 4.6,
    burst: [0.7, 1.5],
    pause: [0.3, 0.6],
    bankChance: 0.3,
    bumpChance: 0.15,
    moveSpeedMul: 1,
  },
};

export const COLORS = {
  player: 0x2f7cff,
  playerMarble: 0x7fb4ff,
  enemy: 0xff4a3d,
  enemyMarble: 0xffa08a,
  bump: 0xffc23d,
  floor: 0x2a2346,
  floorLine: 0x4b3f7a,
  rail: 0x5c4f93,
  bg: 0x15112a,
};

/** a twin-cannon unit's barrels sit this far either side of its centre line; its marbles leave from them */
export const TWIN_X = 0.42;
