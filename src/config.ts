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

export const MATCH = {
  duration: 75,
  maxHealth: 100,
  countdown: 2.4,
  /** active marble cap across both sides */
  marbleCap: 70,
  marblePool: 90,
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
}

export const BASE_STATS: ShooterStats = {
  muzzleSpeed: 17,
  spread: 0.035,
  fireInterval: 0.13,
  marbleRadius: 0.22,
  marbleMass: 1,
  damage: 4.4,
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
