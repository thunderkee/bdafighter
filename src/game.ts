import RAPIER from '@dimforge/rapier2d';
import { AIM_LIMIT, ARENA, BASE_STATS, MATCH, TOSS_TIME, TWIN_X, type ShooterStats } from './config';
import {
  COVER,
  COVER_X,
  DRAGON,
  DROP,
  GATE,
  GATES,
  GATE_TYPES,
  HEAL,
  ITEMS,
  ITEM_TYPES,
  MISSILE,
  MULTI,
  PIN,
  PIN_SPOTS,
  SHIELD,
  PARRY,
  SLOWMO,
  WIPER,
  X5,
  type GateType,
  type ItemType,
 BOOST_BALL } from './items';
import * as sfx from './audio';

// Collision groups: membership in the high 16 bits, filter in the low 16.
const G = { WALL: 1, FENCE: 2, BUMP: 4, PSH: 8, ESH: 16, PM: 32, EM: 64, BLOCK: 128 };
const groups = (member: number, filter: number) => (member << 16) | filter;

const GROUPS = {
  wall: groups(G.WALL, G.PM | G.EM | G.BUMP),
  fence: groups(G.FENCE, G.BUMP),
  bump: groups(G.BUMP, G.WALL | G.FENCE | G.BUMP | G.PM | G.EM | G.PSH | G.ESH | G.BLOCK),
  /** cover walls, wall gates and pins: solid to marbles and pucks */
  block: groups(G.BLOCK, G.PM | G.EM | G.BUMP),
  shooter: [groups(G.PSH, G.EM | G.BUMP), groups(G.ESH, G.PM | G.BUMP)],
  marble: [
    groups(G.PM, G.WALL | G.BUMP | G.ESH | G.PM | G.EM | G.BLOCK),
    groups(G.EM, G.WALL | G.BUMP | G.PSH | G.PM | G.EM | G.BLOCK),
  ],
};

export const STEP = 1 / 60;

/** hits needed to charge one super shot */
export const SUPER_HITS = 3;
/** how a super marble differs from a normal one */
const SUPER = { radius: 2.2, mass: 40, speed: 1.15, damage: 4 };
/**
 * Charge shot (you only): a press fires as usual; keep holding past `hold` seconds and every
 * `per` seconds one more ball leaves the magazine into the charge (up to `max`). Letting go
 * fires one ball that many times the size and power. You move at `moveMul` speed meanwhile.
 */
export const CHARGE = { hold: 0.5, per: 0.5, max: 5, moveMul: 0.45 };
/** 0..1: how far a shooter's charge has built (0 while not charging) */
export const chargeLevel = (s: { chargeHold: number }) => (s.chargeHold < CHARGE.hold ? 0 : Math.min(1, (s.chargeHold - CHARGE.hold) / (CHARGE.per * CHARGE.max)));
/** player + up to three opponents */
/** slot 0 is you, 1-3 the opponent pack, 4-5 your pack-mates */
export const MAX_SHOOTERS = 6;
export const slotTeam = (slot: number): Team => (slot === 0 || slot >= 4 ? 0 : 1);

/** symmetric puck layouts for 1..5 pucks */
const PUCK_LAYOUTS: [number, number][][] = [
  [],
  [[0, 0]],
  [
    [-2.4, 0],
    [2.4, 0],
  ],
  [
    [0, 0],
    [-2.8, 0],
    [2.8, 0],
  ],
  [
    [-2.6, -3.2],
    [2.6, -3.2],
    [-2.6, 3.2],
    [2.6, 3.2],
  ],
  [
    [-2.6, -3.2],
    [2.6, -3.2],
    [0, 0],
    [-2.6, 3.2],
    [2.6, 3.2],
  ],
];
const MAX_PUCKS = 5;

export type Team = 0 | 1; // 0 = player, 1 = opponents
/** CPU pack targeting: nearest, focus the weakest, hunt you (opponents), back up your target (pack-mates) */
export type Tactic = 'nearest' | 'weakest' | 'hunt' | 'assist';
export type MarbleKind = 'normal' | 'super' | 'dragon' | 'x5' | 'boost';

export interface Marble {
  idx: number;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  active: boolean;
  team: Team;
  /** slot of the robot that fired it (credit for hits and super charge) */
  owner: number;
  age: number;
  bounces: number;
  damage: number;
  radius: number;
  spawnOrder: number;
  kind: MarbleKind;
  /** dragon balls: which way the weave starts (+1 / -1) */
  weave: number;
  /** id of the last gate this ball went through (each gate acts once per ball) */
  lastGate: number;
  /** upward kick from the latest impact; the view turns it into a little hop */
  hop: number;
}

export interface Missile {
  id: number;
  team: Team;
  owner: number;
  x: number;
  y: number;
  /** heading (radians, atan2 of velocity) */
  heading: number;
  hits: number;
  age: number;
  /** seconds of coasting after a hit before it turns back in */
  recover: number;
}

export interface Gate {
  id: number;
  type: GateType;
  x: number;
  y: number;
  /** centre the gate slides around, and its phase */
  cx: number;
  phase: number;
  age: number;
  life: number;
  /** transforms left, or hits left for a wall gate */
  charges: number;
}

export interface Bump {
  idx: number;
  body: RAPIER.RigidBody;
  radius: number;
  active: boolean;
  home: [number, number];
}

/** destructible cover on the table (mirrored pairs) */
export interface Cover {
  idx: number;
  collider: RAPIER.Collider;
  x: number;
  y: number;
  hp: number;
  active: boolean;
}

export interface Pin {
  collider: RAPIER.Collider;
  x: number;
  y: number;
  active: boolean;
  /** seconds of glow after a ball pings off it */
  glow: number;
}

export interface Drop {
  id: number;
  team: Team;
  type: ItemType;
  x: number;
  /** height above the floor; 0 = landed */
  h: number;
  /** seconds left once landed */
  life: number;
}

/** effects for the view/HUD; `slot` is the robot concerned (0 = player) */
export type Fx =
  | { type: 'hit'; x: number; y: number; team: Team; slot: number; amount: number; power: MarbleKind | 'missile' }
  | { type: 'missile-launch'; slot: number }
  | { type: 'block'; x: number; y: number; slot: number; heavy: boolean }
  | { type: 'shield-break'; slot: number }
  | { type: 'clack'; x: number; y: number; intensity: number }
  | { type: 'drop-destroyed'; x: number; y: number; team: Team; item: ItemType; h?: number }
  | { type: 'parry'; x: number; y: number; slot: number }
  | { type: 'missile-end'; x: number; y: number; team: Team }
  | { type: 'super-ready'; slot: number }
  | { type: 'super-fire'; slot: number }
  | { type: 'spark'; x: number; y: number; intensity: number }
  | { type: 'muzzle'; slot: number }
  | { type: 'reload'; slot: number }
  | { type: 'pickup'; slot: number; item: ItemType }
  | { type: 'use'; slot: number; item: ItemType }
  | { type: 'heal'; slot: number; amount: number }
  | { type: 'gate-pass'; x: number; y: number; gate: GateType; team: Team }
  | { type: 'gate-break'; x: number; y: number; gate: GateType }
  | { type: 'cover-hit'; x: number; y: number; idx: number }
  | { type: 'cover-break'; x: number; y: number; idx: number }
  | { type: 'pin'; x: number; y: number }
  | { type: 'wiper'; x: number; y: number; slot: number }
  | { type: 'eliminated'; slot: number };

export class Shooter {
  x = 0;
  vx = 0;
  /** current y: the rail, or stepped forward while slipping past a pack-mate */
  y: number;
  /** y of this team's rail */
  readonly railY: number;
  readonly forward: 1 | -1;
  /** stepping forward to pass a pack-mate, and how far out it is right now */
  passing = false;
  passOff = 0;
  /** aim angle relative to straight ahead, radians, + is toward +x */
  aim = 0;
  /** -1..1 from keys/AI, or null when a drag target is in use */
  moveAxis = 0;
  moveTarget: number | null = null;
  firing = false;
  /** taking part in this match (enemy slots beyond the pack size are off) */
  active = true;
  /** knocked out mid-round while teammates fight on */
  out = false;
  /** the stretch of rail this robot may use (opponents share their rail) */
  /** home lane in a pack (where the CPU likes to stand); everyone may use the whole rail */
  lane: [number, number] = [-ARENA.railHalfWidth, ARENA.railHalfWidth];

  maxHealth: number = MATCH.maxHealth;
  health: number = MATCH.maxHealth;
  ammo: number;
  reload = 0; // seconds left in a forced reload
  idle = 0; // seconds since last shot, drives the trickle refill
  cooldown = 0;
  flash = 0;
  recoil = 0;
  /** seconds since the last shot, and since the last special move (drives the firing animation) */
  kickT = 9;
  heavyT = 9;
  /** signature tricks: which hand the gun is in (1 right, -1 left) and the hand the last shot
   *  left from, the hand-swap timer, a wind-up in progress (seconds left, and since it began),
   *  and a turning head's angle off the aim (and its sweep phase) */
  hand = 1;
  lastHand = 1;
  swapT = 0;
  swapN = 0;
  biteN = 0;
  windLeft = 0;
  windT = 9;
  wobble = 0;
  wobbleN = 0;

  shots = 0;
  hits = 0;
  dealt = 0;
  /** hits landed toward the next super shot (0..SUPER_HITS) */
  charge = 0;
  /** the next marble fired will be a super shot */
  superReady = false;
  /** seconds of knock-back stagger after taking a super hit */
  stagger = 0;

  /** held air-drop item, used on demand */
  item: ItemType | null = null;
  /** seconds left on timed item effects */
  multiT = 0;
  wiperT = 0;
  /** Smart Lock: seconds left, and the slot it's locked onto (-1 none) */
  lockT = 0;
  lockSlot = -1;
  /** seconds the fire button has been held this press, balls stored in the charge, and whether this press already fired */
  chargeHold = 0;
  stored = 0;
  pressShot = false;
  /** a CPU's planned charge: how many balls to store before letting go (0 = not charging) */
  chargeWant = 0;
  /** the Smart Lock has been steering the aim (it lets go to straight ahead when it ends) */
  lockSteer = false;
  /** dragon balls still to launch, and the gap timer */
  dragonQueue = 0;
  /** extra balls left in the current trigger pull (fire-rate setting), and the gap timer */
  burstQueue = 0;
  burstTimer = 0;
  dragonTimer = 0;
  /** -1 / 1 while pushing into the left / right end of the rail, else 0 */
  railPush = 0;
  /** shield: wanted (input/AI), energy, lockout after a break, regen delay */
  shielding = false;
  /** seconds since the shield went up (a parry needs it raised just in time), and whether it was up last step */
  shieldT = 9;
  wasShielding = false;
  shield: number = SHIELD.max;
  shieldLock = 0;
  shieldIdle = 0;
  /** seconds since this robot last landed a hit / took one (portraits read these) */
  sinceHit = 99;
  sinceHurt = 99;

  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;

  constructor(
    world: RAPIER.World,
    readonly team: Team,
    readonly slot: number,
    public stats: ShooterStats,
  ) {
    this.forward = team === 0 ? 1 : -1;
    this.railY = team === 0 ? -ARENA.railY : ARENA.railY;
    this.y = this.railY;
    this.ammo = stats.capacity;
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, this.y));
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.62, 0.5).setCollisionGroups(GROUPS.shooter[team]).setRestitution(0.6),
      this.body,
    );
  }

  /** body size: 1 for everyone, bigger for an arcade boss (hit box and model grow together) */
  size = 1;
  get halfWidth() {
    return 0.62 * this.size;
  }
  setSize(k: number) {
    this.size = k;
    const c = this.collider as unknown as { setHalfExtents?: (v: { x: number; y: number }) => void };
    c.setHalfExtents?.({ x: 0.62 * k, y: 0.5 * k });
  }

  get hpFrac() {
    return this.health / this.maxHealth;
  }

  /** in the fight right now */
  get alive() {
    return this.active && !this.out && this.health > 0;
  }

  /** the shield is actually up (wanted, has energy, not broken) */
  get shieldUp() {
    return this.shielding && this.shield > 0 && this.shieldLock <= 0;
  }

  /** where the wiper brick is this instant */
  wiperX(t: number) {
    return this.x + Math.sin(t * WIPER.sweepSpeed) * WIPER.sweep;
  }

  dir(angle = this.aim) {
    return { x: Math.sin(angle), y: Math.cos(angle) * this.forward };
  }

  muzzle() {
    const d = this.dir();
    return { x: this.x + d.x * 0.95, y: this.y + d.y * 0.95 };
  }

  reset(stats: ShooterStats, maxHealth: number, active: boolean, lane: [number, number]) {
    this.stats = stats;
    this.active = active;
    if (this.size !== 1) this.setSize(1);
    this.out = false;
    this.kickT = this.heavyT = 9;
    this.hand = this.lastHand = 1;
    this.swapT = this.swapN = this.biteN = 0;
    this.windLeft = 0;
    this.windT = 9;
    this.wobble = this.wobbleN = 0;
    this.lane = lane;
    this.x = (lane[0] + lane[1]) / 2;
    this.passing = false;
    this.passOff = 0;
    this.y = this.railY;
    this.vx = 0;
    this.aim = 0;
    this.moveAxis = 0;
    this.moveTarget = null;
    this.firing = false;
    this.maxHealth = maxHealth;
    this.health = maxHealth;
    this.ammo = stats.capacity;
    this.reload = 0;
    this.idle = 0;
    this.cooldown = 0;
    this.flash = 0;
    this.recoil = 0;
    this.shots = this.hits = this.dealt = 0;
    this.charge = 0;
    this.superReady = false;
    this.stagger = 0;
    this.item = null;
    this.multiT = this.wiperT = this.lockT = 0;
    this.lockSlot = -1;
    this.chargeHold = this.stored = this.chargeWant = 0;
    this.pressShot = false;
    this.lockSteer = false;
    this.dragonQueue = this.dragonTimer = 0;
    this.burstQueue = this.burstTimer = 0;
    this.sinceHit = this.sinceHurt = 99;
    this.shielding = false;
    this.shield = SHIELD.max;
    this.shieldLock = 0;
    this.shieldIdle = 0;
    this.body.setEnabled(active);
    this.body.setTranslation({ x: this.x, y: active ? this.y : this.y + this.forward * -40 }, true);
  }
}

type Tag =
  | { kind: 'marble'; m: Marble }
  | { kind: 'shooter'; s: Shooter }
  | { kind: 'wall' }
  | { kind: 'bump'; b: Bump }
  | { kind: 'cover'; c: Cover }
  | { kind: 'pin'; p: Pin }
  | { kind: 'gatewall' };

/** seconds between the balls of one trigger pull */
const BURST_GAP = 0.07;
/** twin barrels: each marble leaves from its own barrel (the mesh's TWIN_X), with a share of the damage */
const TWIN = { gap: TWIN_X, damage: 0.45 };
/** spread fire (an arcade boss): the angle between the marbles of a fan, and each one's share of the damage */
const FAN = { angle: 0.16, damage: 0.5 };
/** how fast a sweeping head turns (radians of sweep phase per second: a left-right pass in about 4s) */
const HEAD_SWEEP = 1.5;
/** Wyvern's wound-up shot: damage, speed and weight against a regular one */
const WINDUP = { damage: 1.4, speed: 1.1, mass: 1.8 };
/** Rex's bite: the giant marble's size, weight and damage */
const BITE = { radius: 1.6, mass: 3, damage: 1.8 };

/** pack traffic: start passing within `start` m, done once `clear` m apart; step out `depth` m at `speed` m/s */
const PASS = { start: 2.4, clear: 1.6, depth: 1.3, speed: 13 };

export type Phase = 'countdown' | 'fight' | 'ko' | 'over';

export interface MatchOptions {
  /** one entry per opponent in the pack (1-3) */
  enemies: { stats: ShooterStats; maxHealth: number }[];
  /** your CPU pack-mates (0-2) */
  allies?: { stats: ShooterStats; maxHealth: number }[];
  /** who each team's CPU robots go after */
  tactics?: [Tactic, Tactic];
  pucks: number;
  covers: number;
  pins: number;
  items: boolean;
  gates: boolean;
  /** player max health (unit trait); defaults to the standard */
  playerHealth?: number;
  /** round length in seconds; 0 = no time limit */
  duration: number;
  /** CPU opponents charge shots too */
  cpuCharge?: boolean;
  /** an arcade boss: these slots are bigger (hit box and model) */
  boss?: { slots: number[]; size: number };
  /** and your CPU pack-mates */
  allyCharge?: boolean;
  /** balls fired per trigger pull, both robots (1-5) */
  burst: number;
}

export class Game {
  world: RAPIER.World;
  events: RAPIER.EventQueue;
  /** slot 0 is the player; slots 1..3 are opponents (inactive beyond the pack) */
  shooters: Shooter[];
  marbles: Marble[] = [];
  bumps: Bump[] = [];
  covers: Cover[] = [];
  pins: Pin[] = [];
  drops: Drop[] = [];
  gates: Gate[] = [];
  missiles: Missile[] = [];
  /** moving power gates on/off */
  gatesOn = true;
  /** how many pucks are on the table; unused ones are removed from physics */
  puckCount = MAX_PUCKS;
  /** air drops on/off */
  itemsOn = true;
  fx: Fx[] = [];

  phase: Phase = 'countdown';
  phaseTime = 0;
  /** game seconds since the round started (gates, wipers) */
  time = 0;
  clock: number = MATCH.duration;
  /** round length for this match (0 = untimed) */
  duration: number = MATCH.duration;
  /** balls per trigger pull */
  burst = 1;
  /** long-press charge shots for the player */
  chargeShots = true;
  /** CPU opponents charge too, when their AI decides to (see Shooter.chargeWant) */
  cpuCharge = true;
  /** and so do your CPU pack-mates */
  allyCharge = true;
  /** may this CPU robot plan charge shots? (you charge by holding fire instead) */
  cpuCharges(s: Shooter) {
    return s.slot !== 0 && (s.team === 1 ? this.cpuCharge : this.allyCharge);
  }
  winner: Team | -1 | null = null;
  /** seconds of frozen physics after a heavy hit */
  hitstop = 0;
  /** slow-mo: game seconds left, and who triggered it */
  slowT = 0;
  slowOwner = -1;

  private tags = new Map<number, Tag>();
  private spawnCounter = 0;
  private activeCount = 0;
  private toDespawn = new Set<Marble>();
  private nextDrop = DROP.first;
  private dropSide: Team = Math.random() < 0.5 ? 0 : 1;
  private dropId = 0;
  private nextGate = GATE.first;
  private missileId = 0;
  private gateId = 0;
  /** one kinematic body reused by every WALL gate */
  private gateWallBody!: RAPIER.RigidBody;
  private gateWall!: RAPIER.Collider;

  constructor(playerStats: ShooterStats, enemyStats: ShooterStats) {
    this.world = new RAPIER.World({ x: 0, y: 0 });
    this.world.timestep = STEP;
    this.events = new RAPIER.EventQueue(true);

    this.buildArena();
    this.shooters = [new Shooter(this.world, 0, 0, playerStats)];
    for (let i = 1; i < MAX_SHOOTERS; i++) this.shooters.push(new Shooter(this.world, slotTeam(i), i, i >= 4 ? playerStats : enemyStats));
    for (const s of this.shooters) this.tags.set(s.collider.handle, { kind: 'shooter', s });
    this.buildBumps();
    this.buildObstacles();
    this.buildPool();
  }

  get player() {
    return this.shooters[0];
  }

  /** opponents taking part this match */
  enemies() {
    return this.shooters.filter((s) => s.team === 1 && s.active);
  }

  aliveEnemies() {
    return this.shooters.filter((s) => s.team === 1 && s.alive);
  }

  /** robots of a team taking part this match */
  team(t: Team) {
    return this.shooters.filter((s) => s.team === t && s.active);
  }

  alive(t: Team) {
    return this.shooters.filter((s) => s.team === t && s.alive);
  }

  /** CPU targeting per team: [your pack-mates, opponents] */
  tactics: [Tactic, Tactic] = ['nearest', 'nearest'];

  /**
   * Who a robot fights. You (and the default) take the live opponent nearest along the
   * rail; CPU packs can instead focus the weakest, hunt you, or back up your target.
   */
  targetFor(s: Shooter): Shooter {
    const other: Team = s.team === 0 ? 1 : 0;
    const foes = this.alive(other);
    if (s.slot !== 0 && foes.length > 1) {
      const tactic = this.tactics[s.team];
      if (tactic === 'weakest') {
        // gang up on whoever is closest to going down (nearest breaks ties)
        return foes.reduce((a, b) => (b.hpFrac < a.hpFrac - 0.02 || (Math.abs(b.hpFrac - a.hpFrac) <= 0.02 && Math.abs(b.x - s.x) < Math.abs(a.x - s.x)) ? b : a));
      }
      if (tactic === 'hunt' && this.player.alive) return this.player;
      if (tactic === 'assist' && this.player.alive) return this.nearestTo(this.player, foes);
    }
    return this.nearestTo(s, foes, other);
  }

  /** Smart Lock target: the live opponent closest to the bearer */
  private lockTarget(s: Shooter) {
    let best: Shooter | null = null;
    let bd = Infinity;
    for (const e of this.alive(s.team === 0 ? 1 : 0)) {
      const d = Math.hypot(e.x - s.x, e.y - s.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private nearestTo(s: Shooter, foes: Shooter[], other: Team = s.team === 0 ? 1 : 0): Shooter {
    let best = other === 0 ? this.player : this.shooters[1];
    let bd = Infinity;
    for (const e of foes) {
      const d = Math.abs(e.x - s.x);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /** combined armour of the opponent team, 0..1 */
  enemyFrac() {
    return this.teamFrac(1);
  }

  /** combined armour of a team, 0..1 (knocked-out members count as empty) */
  teamFrac(t: Team) {
    let h = 0;
    let m = 0;
    for (const e of this.team(t)) {
      h += Math.max(0, e.health);
      m += e.maxHealth;
    }
    return m ? h / m : 0;
  }

  /** the side walls and bump fences, kept so a new table width can rebuild them */
  private arenaColliders: RAPIER.Collider[] = [];
  private ground: RAPIER.RigidBody | null = null;

  /** the table width changed (setArenaWidth): move the walls to the new edges */
  resizeArena() {
    for (const c of this.arenaColliders) {
      this.tags.delete(c.handle);
      this.world.removeCollider(c, false);
    }
    this.arenaColliders = [];
    this.buildArena();
  }

  private buildArena() {
    const hw = ARENA.width / 2;
    const t = ARENA.wallThickness;
    const ground = (this.ground ??= this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed()));
    for (const side of [-1, 1]) {
      const wall = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(t / 2, ARENA.length / 2)
          .setTranslation(side * (hw + t / 2), 0)
          .setRestitution(0.86)
          .setFriction(0)
          .setCollisionGroups(GROUPS.wall),
        ground,
      );
      this.tags.set(wall.handle, { kind: 'wall' });
      // fences keep bumps in the middle band; marbles pass straight through
      const fence = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(hw, 0.1).setTranslation(0, side * ARENA.bumpFenceY).setCollisionGroups(GROUPS.fence),
        ground,
      );
      this.arenaColliders.push(wall, fence);
    }
  }

  private buildBumps() {
    for (let idx = 0; idx < MAX_PUCKS; idx++) {
      const [x, y] = PUCK_LAYOUTS[MAX_PUCKS][idx];
      const radius = 0.65;
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y).setLinearDamping(2.2).setAngularDamping(3),
      );
      const col = this.world.createCollider(
        RAPIER.ColliderDesc.ball(radius).setDensity(5).setRestitution(0.5).setFriction(0.2).setCollisionGroups(GROUPS.bump),
        body,
      );
      const b: Bump = { idx, body, radius, active: true, home: [x, y] };
      this.tags.set(col.handle, { kind: 'bump', b });
      this.bumps.push(b);
    }
  }

  /** cover walls, pinball pins and the reusable wall-gate body */
  private buildObstacles() {
    const ground = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    // up to 3 cover walls per side
    let idx = 0;
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const collider = this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(COVER.halfWidth, COVER.halfDepth)
            .setTranslation(0, side * COVER.y)
            .setRestitution(0.7)
            .setFriction(0)
            .setCollisionGroups(GROUPS.block),
          ground,
        );
        collider.setEnabled(false);
        const c: Cover = { idx: idx++, collider, x: 0, y: side * COVER.y, hp: COVER.hp, active: false };
        this.tags.set(collider.handle, { kind: 'cover', c });
        this.covers.push(c);
      }
    }
    for (const [x, y] of PIN_SPOTS) {
      const collider = this.world.createCollider(
        RAPIER.ColliderDesc.ball(PIN.radius).setTranslation(x, y).setRestitution(1.05).setFriction(0).setCollisionGroups(GROUPS.block),
        ground,
      );
      collider.setEnabled(false);
      const p: Pin = { collider, x, y, active: false, glow: 0 };
      this.tags.set(collider.handle, { kind: 'pin', p });
      this.pins.push(p);
    }
    this.gateWallBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -60));
    this.gateWall = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(GATE.halfWidth, 0.2).setRestitution(0.8).setFriction(0).setCollisionGroups(GROUPS.block),
      this.gateWallBody,
    );
    this.gateWall.setEnabled(false);
    this.tags.set(this.gateWall.handle, { kind: 'gatewall' });
  }

  private buildPool() {
    for (let i = 0; i < MATCH.marblePool; i++) {
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(0, -100 - i)
          .setCcdEnabled(true)
          .setLinearDamping(0.2)
          .setEnabled(false),
      );
      const collider = this.world.createCollider(
        RAPIER.ColliderDesc.ball(BASE_STATS.marbleRadius)
          .setRestitution(0.82)
          .setFriction(0)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS)
          .setCollisionGroups(GROUPS.marble[0]),
        body,
      );
      const m: Marble = {
        idx: i,
        body,
        collider,
        active: false,
        team: 0,
        owner: 0,
        age: 0,
        bounces: 0,
        damage: 0,
        radius: BASE_STATS.marbleRadius,
        spawnOrder: 0,
        kind: 'normal',
        weave: 1,
        lastGate: -1,
        hop: 0,
      };
      this.tags.set(collider.handle, { kind: 'marble', m });
      this.marbles.push(m);
    }
  }

  reset(playerStats: ShooterStats, opts: MatchOptions) {
    // each team splits its rail into lanes so pack-mates never stand on each other
    const lanes = (n: number) => {
      const span = ARENA.railHalfWidth * 2;
      const gap = n > 1 ? 0.3 : 0;
      return Array.from({ length: n }, (_, k): [number, number] => [
        -ARENA.railHalfWidth + (span / n) * k + (k > 0 ? gap : 0),
        -ARENA.railHalfWidth + (span / n) * (k + 1) - (k < n - 1 ? gap : 0),
      ]);
    };
    // your side: you take the middle lane of three, the left of two
    const allies = (opts.allies ?? []).slice(0, 2);
    const own = lanes(1 + allies.length);
    const youAt = allies.length === 2 ? 1 : 0;
    const allyLanes = own.filter((_, k) => k !== youAt);
    this.player.reset(playerStats, opts.playerHealth ?? MATCH.maxHealth, true, own[youAt]);
    for (let k = 0; k < 2; k++) {
      const a = allies[k] ?? { stats: playerStats, maxHealth: MATCH.maxHealth };
      this.shooters[4 + k].reset(a.stats, a.maxHealth, k < allies.length, allyLanes[k] ?? own[0]);
    }
    // the opponent pack
    const n = Math.max(1, Math.min(3, opts.enemies.length));
    const theirs = lanes(n);
    for (let i = 1; i <= 3; i++) {
      const k = i - 1;
      const e = opts.enemies[Math.min(k, opts.enemies.length - 1)];
      this.shooters[i].reset(e.stats, e.maxHealth, k < n, theirs[Math.min(k, n - 1)]);
    }
    for (const m of this.marbles) if (m.active) this.despawn(m);
    this.puckCount = opts.pucks;
    this.itemsOn = opts.items;
    this.gatesOn = opts.gates;
    this.gates.length = 0;
    this.gateWall.setEnabled(false);
    this.nextGate = GATE.first;
    this.missiles.length = 0;
    this.placePucks();
    this.placeObstacles(opts.covers, opts.pins);
    this.bumps.forEach((b) => {
      b.body.setLinvel({ x: 0, y: 0 }, true);
      b.body.setAngvel(0, true);
    });
    this.drops.length = 0;
    this.nextDrop = DROP.first;
    this.dropSide = Math.random() < 0.5 ? 0 : 1;
    this.phase = 'countdown';
    this.phaseTime = 0;
    this.time = 0;
    this.duration = opts.duration;
    this.clock = opts.duration > 0 ? opts.duration : Infinity;
    this.burst = Math.max(1, Math.min(5, Math.round(opts.burst)));
    this.cpuCharge = opts.cpuCharge ?? true;
    for (const slot of opts.boss?.slots ?? []) this.shooters[slot]?.setSize(opts.boss!.size);
    this.allyCharge = opts.allyCharge ?? true;
    this.tactics = opts.tactics ?? ['nearest', 'nearest'];
    this.koSource = null;
    this.winner = null;
    this.hitstop = 0;
    this.slowT = 0;
    this.slowOwner = -1;
    this.fx.length = 0;
  }

  /** Enable the first puckCount pucks at their layout spots; disable the rest. */
  placePucks() {
    const n = Math.max(0, Math.min(MAX_PUCKS, Math.round(this.puckCount)));
    const layout = PUCK_LAYOUTS[n];
    this.bumps.forEach((b, i) => {
      b.active = i < n;
      b.body.setEnabled(b.active);
      if (b.active) {
        b.home = layout[i];
        b.body.setTranslation({ x: b.home[0], y: b.home[1] }, true);
        b.body.setLinvel({ x: 0, y: 0 }, true);
      }
    });
  }

  /** Cover walls (pairs per side) and pins (from the symmetric list). */
  placeObstacles(covers: number, pins: number) {
    const n = Math.max(0, Math.min(3, Math.round(covers)));
    const xs = COVER_X[n];
    this.covers.forEach((c) => {
      const k = c.idx % 3;
      c.active = k < n;
      c.hp = COVER.hp;
      if (c.active) {
        c.x = xs[k];
        c.collider.setTranslationWrtParent({ x: c.x, y: c.y });
      }
      c.collider.setEnabled(c.active);
    });
    const pn = Math.max(0, Math.min(PIN_SPOTS.length, Math.round(pins)));
    this.pins.forEach((p, i) => {
      p.active = i < pn;
      p.glow = 0;
      p.collider.setEnabled(p.active);
    });
  }

  activePucks() {
    return this.bumps.filter((b) => b.active);
  }

  /** One fixed physics + gameplay tick. */
  step(dt: number) {
    this.phaseTime += dt;
    if (this.phase === 'countdown' && this.phaseTime >= MATCH.countdown) {
      this.phase = 'fight';
      this.phaseTime = 0;
      sfx.play('go');
    }
    if (this.phase === 'fight') {
      this.time += dt;
      // an untimed round (Infinity) only ends on a knockout
      if (Number.isFinite(this.clock)) {
        this.clock = Math.max(0, this.clock - dt);
        if (this.clock <= 0) this.finish();
      }
    }
    if (this.phase === 'ko' && this.phaseTime > 1.8) {
      this.phase = 'over';
      this.phaseTime = 0;
    }

    const canAct = this.phase === 'fight';
    if (canAct && this.slowT > 0) {
      // slowT is real seconds: it drains at the world's slowed rate
      this.slowT = Math.max(0, this.slowT - dt / SLOWMO.world);
      if (this.slowT <= 0) this.slowOwner = -1;
    }
    this.updatePassing();
    for (const s of this.shooters) if (s.active) this.updateShooter(s, dt, canAct);
    if (canAct) this.updateDrops(dt);

    // bumps drift slowly home so cover never stays piled in one corner
    for (const b of this.bumps) {
      if (!b.active) continue;
      const p = b.body.translation();
      const k = 0.9 * b.body.mass() * dt;
      b.body.applyImpulse({ x: (b.home[0] - p.x) * k, y: (b.home[1] - p.y) * k }, true);
    }
    for (const p of this.pins) p.glow = Math.max(0, p.glow - dt);

    // dragon balls weave: lateral velocity follows A·ω·cos(ωt)
    for (const m of this.marbles) {
      if (!m.active || m.kind !== 'dragon') continue;
      const v = m.body.linvel();
      const w = DRAGON.freq;
      const dv = DRAGON.amp * w * (Math.cos(w * (m.age + dt)) - Math.cos(w * m.age)) * m.weave;
      m.body.setLinvel({ x: v.x + dv, y: v.y }, true);
    }

    // slow-mo steps the same number of times with a smaller time slice, so motion stays smooth
    if (this.world.timestep !== dt) this.world.timestep = dt;
    this.world.step(this.events);
    this.events.drainCollisionEvents((h1, h2, started) => {
      if (started) this.onContact(h1, h2);
    });
    // parries send their marbles back once the physics events are done
    for (const pr of this.parries.splice(0)) this.parry(pr);

    const limitY = ARENA.length / 2 + 1;
    for (const m of this.marbles) {
      if (!m.active) continue;
      m.age += dt;
      const p = m.body.translation();
      const v = m.body.linvel();
      const speed2 = v.x * v.x + v.y * v.y;
      const life = MATCH.marbleLifetime * (m.kind === 'super' ? 1.5 : m.kind === 'dragon' ? DRAGON.life : m.kind === 'x5' ? 1.3 : 1);
      if (m.age > life || Math.abs(p.y) > limitY || Math.abs(p.x) > ARENA.width || (m.age > 0.3 && speed2 < 2)) {
        this.toDespawn.add(m);
      }
    }
    if (canAct) {
      this.updateWipers();
      this.updateGates(dt);
      this.updateMissiles(dt);
    }

    for (const m of this.toDespawn) this.despawn(m);
    this.toDespawn.clear();
  }

  private breakShield(s: Shooter) {
    s.shield = 0;
    s.shieldLock = SHIELD.breakLock;
    this.fx.push({ type: 'shield-break', slot: s.slot });
    sfx.play('superhit', 0.6);
  }

  /** Soak a hit on the shield. Returns true if it was blocked. */
  /** perfect blocks waiting to return their marbles (handled after the physics events) */
  private parries: { s: Shooter; attacker: Shooter; damage: number; kind: MarbleKind; x: number; y: number }[] = [];

  /** a parry: the marble flies straight back at its shooter, faster and harder, as the parrier's own */
  private parry(pr: { s: Shooter; attacker: Shooter; damage: number; kind: MarbleKind; x: number; y: number }) {
    const { s, attacker } = pr;
    this.fx.push({ type: 'parry', x: pr.x, y: pr.y, slot: s.slot });
    sfx.play('superhit', s.slot === 0 ? 1 : 0.6);
    this.hitstop = Math.max(this.hitstop, 0.12);
    s.shieldIdle = 0;
    const m = this.takeMarble();
    if (!m) return;
    const t = attacker.alive ? attacker : this.targetFor(s);
    const angle = Math.atan2(t.x - s.x, (t.y - s.y) * s.forward);
    const st = s.stats;
    this.launch(m, s, {
      angle: Math.max(-AIM_LIMIT, Math.min(AIM_LIMIT, angle)),
      radius: st.marbleRadius * (pr.kind === 'super' ? 1.4 : 1.15),
      speed: st.muzzleSpeed * PARRY.speed,
      mass: st.marbleMass * 1.6,
      damage: pr.damage * PARRY.damage,
      kind: 'boost',
      push: st.marbleRadius,
    });
    s.recoil = 1;
    s.kickT = 0;
  }

  private block(s: Shooter, amount: number, x: number, y: number, heavy: boolean) {
    if (!s.shieldUp) return false;
    s.shield = Math.max(0, s.shield - amount * SHIELD.blockCost);
    s.shieldIdle = 0;
    this.fx.push({ type: 'block', x, y, slot: s.slot, heavy });
    sfx.play('bump', heavy ? 1 : 0.6);
    if (s.shield <= 0) this.breakShield(s);
    return true;
  }

  /** Apply damage to a robot and handle knock-outs. */
  /** what landed the round-ending hit (for the replay: show that shot being fired) */
  koSource: { by: number; marble?: number; missile?: number } | null = null;

  private damage(target: Shooter, attacker: Shooter, amount: number, src: { marble?: number; missile?: number } = {}) {
    target.health = Math.max(0, target.health - amount);
    target.sinceHurt = 0;
    attacker.dealt += amount;
    attacker.sinceHit = 0;
    if (target.health > 0) return;
    if (this.alive(target.team).length > 0) {
      // one of the pack is down (you included); the rest fight on
      target.out = true;
      target.firing = false;
      target.body.setEnabled(false);
      this.fx.push({ type: 'eliminated', slot: target.slot });
      sfx.play('pop', 1);
      return;
    }
    if (this.phase === 'fight') this.koSource = { by: attacker.slot, ...src };
    this.finish();
  }

  // ---------- homing missiles ----------

  private launchMissile(s: Shooter, from?: { x: number; y: number; heading: number }) {
    const d = s.dir(0);
    this.missiles.push({
      id: this.missileId++,
      team: s.team,
      owner: s.slot,
      x: from?.x ?? s.x,
      y: from?.y ?? s.y + d.y * 1.1,
      heading: from?.heading ?? Math.atan2(d.y, d.x),
      hits: 0,
      age: 0,
      recover: 0,
    });
    if (!from) {
      s.kickT = 0;
      s.heavyT = 0;
    }
    this.fx.push({ type: 'missile-launch', slot: s.slot });
  }

  private updateMissiles(dt: number) {
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      // (a hit that ends the round clears the list mid-loop)
      if (!m) continue;
      const attacker = this.shooters[m.owner];
      const target = this.targetFor(attacker);
      m.age += dt;
      m.recover = Math.max(0, m.recover - dt);
      // steer toward the target with a capped turn rate
      if (m.recover <= 0 && target.alive) {
        const want = Math.atan2(target.y - m.y, target.x - m.x);
        let diff = want - m.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = MISSILE.turnRate * dt;
        m.heading += Math.max(-turn, Math.min(turn, diff));
      }
      m.x += Math.cos(m.heading) * MISSILE.speed * dt;
      m.y += Math.sin(m.heading) * MISSILE.speed * dt;
      // bounce off the side walls and keep within the table ends
      const hw = ARENA.width / 2 - 0.3;
      if (Math.abs(m.x) > hw) {
        m.x = Math.sign(m.x) * hw;
        m.heading = Math.PI - m.heading;
      }
      const hl = ARENA.length / 2 - 0.5;
      if (Math.abs(m.y) > hl) {
        m.y = Math.sign(m.y) * hl;
        m.heading = -m.heading;
      }
      if (target.alive && m.recover <= 0 && Math.hypot(target.x - m.x, target.y - m.y) < MISSILE.hitRadius + target.halfWidth * 0.5) {
        const amount = MISSILE.damage * (attacker.stats.damage / BASE_STATS.damage);
        m.hits++;
        // bounce back out and come round again
        m.heading += Math.PI + (Math.random() - 0.5) * 1.2;
        m.recover = MISSILE.recover;
        if (!this.block(target, amount, m.x, m.y, true)) {
          target.flash = 0.25;
          this.hitstop = Math.max(this.hitstop, 0.08);
          this.fx.push({ type: 'hit', x: m.x, y: m.y, team: target.team, slot: target.slot, amount, power: 'missile' });
          sfx.play(target.team === 0 ? 'hurt' : 'hit', 1);
          this.damage(target, attacker, amount, { missile: m.id });
        }
      }
      if (m.hits >= MISSILE.hits || m.age > MISSILE.life) {
        this.fx.push({ type: 'missile-end', x: m.x, y: m.y, team: m.team });
        this.missiles.splice(i, 1);
      }
    }
  }

  // ---------- wipers ----------

  /** Enemy balls that meet a wiper brick bounce back as the wiper owner's own shots. */
  private updateWipers() {
    for (const s of this.shooters) {
      if (!s.alive || s.wiperT <= 0) continue;
      const wx = s.wiperX(this.time);
      const wy = s.y + s.forward * WIPER.ahead;
      for (const m of this.marbles) {
        if (!m.active || m.team === s.team || this.toDespawn.has(m)) continue;
        const p = m.body.translation();
        const v = m.body.linvel();
        if ((p.y - wy) * s.forward < -0.6 || Math.abs(p.y - wy) > 0.35 + m.radius) continue;
        if (Math.abs(p.x - wx) > WIPER.halfWidth + m.radius) continue;
        if (v.y * s.forward > 0) continue; // already heading away
        m.team = s.team;
        m.owner = s.slot;
        m.lastGate = -1;
        m.bounces = 0;
        m.age = Math.min(m.age, 0.5);
        m.collider.setCollisionGroups(GROUPS.marble[s.team]);
        // angle off the brick like a paddle: further from centre, wider the bounce
        const off = (p.x - wx) / WIPER.halfWidth;
        const speed = Math.hypot(v.x, v.y) * WIPER.speedUp;
        const a = off * 0.6;
        m.body.setLinvel({ x: Math.sin(a) * speed, y: Math.cos(a) * speed * s.forward }, true);
        m.body.setTranslation({ x: p.x, y: wy + s.forward * (0.4 + m.radius) }, true);
        m.hop = 0.25;
        this.fx.push({ type: 'wiper', x: p.x, y: wy, slot: s.slot });
        sfx.play('bump', 0.8);
      }
    }
  }

  // ---------- gates ----------

  private updateGates(dt: number) {
    if (this.gatesOn) {
      this.nextGate -= dt;
      if (this.nextGate <= 0 && !this.gates.length) {
        this.spawnGate();
        this.nextGate = GATE.every[0] + Math.random() * (GATE.every[1] - GATE.every[0]);
      }
    }
    const span = ARENA.width / 2 - GATE.halfWidth;
    for (let i = this.gates.length - 1; i >= 0; i--) {
      const g = this.gates[i];
      g.age += dt;
      // slide side to side, kept inside the walls
      g.x = Math.max(-span, Math.min(span, g.cx + Math.sin(g.age * GATE.swaySpeed + g.phase) * GATE.sway));
      if (g.type === 'wall' && g.charges > 0) this.gateWallBody.setNextKinematicTranslation({ x: g.x, y: g.y });
      if (g.age >= g.life) {
        if (g.type === 'wall') this.gateWall.setEnabled(false);
        this.gates.splice(i, 1);
        continue;
      }
      if (g.charges <= 0 || g.type === 'wall') continue;
      for (const m of this.marbles) {
        if (!m.active || m.lastGate === g.id || this.toDespawn.has(m)) continue;
        const p = m.body.translation();
        if (Math.abs(p.y - g.y) > 0.4 || Math.abs(p.x - g.x) > GATE.halfWidth) continue;
        m.lastGate = g.id;
        if (this.applyGate(m, g)) {
          g.charges--;
          this.fx.push({ type: 'gate-pass', x: p.x, y: p.y, gate: g.type, team: m.team });
          sfx.play('charge', 0.8);
          if (g.charges <= 0) {
            // shatter shortly after the last charge
            g.life = Math.min(g.life, g.age + 0.35);
            this.fx.push({ type: 'gate-break', x: g.x, y: g.y, gate: g.type });
          }
        }
        if (g.charges <= 0) break;
      }
    }
  }

  private spawnGate() {
    const type = GATE_TYPES[Math.floor(Math.random() * GATE_TYPES.length)];
    const y = (Math.random() * 2 - 1) * GATE.band;
    const g: Gate = {
      id: this.gateId++,
      type,
      x: 0,
      y,
      cx: (Math.random() * 2 - 1) * 1.2,
      phase: Math.random() * Math.PI * 2,
      age: 0,
      // a wall gate stands a little longer, until it's shot down
      life: type === 'wall' ? GATE.life * 1.6 : GATE.life,
      charges: GATES[type].charges,
    };
    this.gates.push(g);
    if (type === 'wall') {
      this.gateWallBody.setTranslation({ x: g.cx, y }, true);
      this.gateWall.setEnabled(true);
    }
  }

  /** Transform a ball passing through a gate. Returns false if it doesn't apply. */
  private applyGate(m: Marble, g: Gate) {
    const st = this.shooters[m.owner].stats;
    switch (g.type) {
      case 'x5':
        // multiplies whatever the ball carries; a ball can't be 5× twice
        if (m.kind === 'x5') return false;
        m.damage *= X5.damage;
        if (m.kind === 'normal') {
          m.kind = 'x5';
          this.resize(m, m.radius * X5.radius, st.marbleMass * X5.mass);
        }
        return true;
      case 'pow':
        if (m.kind !== 'normal') return false;
        m.kind = 'super';
        m.damage = st.damage * SUPER.damage;
        this.resize(m, st.marbleRadius * SUPER.radius, st.marbleMass * SUPER.mass);
        return true;
      case 'hom': {
        // the ball becomes a homing missile for whoever fired it
        const p = m.body.translation();
        const v = m.body.linvel();
        this.launchMissile(this.shooters[m.owner], { x: p.x, y: p.y, heading: Math.atan2(v.y, v.x) });
        this.toDespawn.add(m);
        return true;
      }
      case 'drg': {
        if (m.kind === 'dragon' || m.kind === 'super') return false;
        // the ball becomes the head of a three-ball dragon braid
        const p = m.body.translation();
        const v = m.body.linvel();
        const mult = m.kind === 'x5' ? X5.damage : 1;
        for (let i = 0; i < DRAGON.count; i++) {
          const d = i === 0 ? m : this.takeMarble();
          if (!d) break;
          if (i > 0) this.revive(d, m.team, m.owner, { x: p.x, y: p.y - Math.sign(v.y) * i * 0.6 }, v);
          d.kind = 'dragon';
          d.damage = st.damage * DRAGON.damage * mult;
          d.weave = i % 2 === 0 ? 1 : -1;
          d.age = 0;
          d.lastGate = g.id;
          this.resize(d, st.marbleRadius * DRAGON.radius, st.marbleMass * DRAGON.mass);
          const dv = d.body.linvel();
          d.body.setLinvel({ x: dv.x + DRAGON.amp * DRAGON.freq * d.weave, y: dv.y }, true);
        }
        return true;
      }
      default:
        return false;
    }
  }

  private resize(m: Marble, radius: number, mass: number) {
    m.radius = radius;
    m.collider.setRadius(radius);
    m.collider.setMass(mass);
  }

  /** Bring a pooled marble to life at a position with a velocity (used by gates). */
  private revive(m: Marble, team: Team, owner: number, pos: { x: number; y: number }, vel: { x: number; y: number }) {
    m.active = true;
    m.team = team;
    m.owner = owner;
    m.bounces = 0;
    m.spawnOrder = this.spawnCounter++;
    m.collider.setCollisionGroups(GROUPS.marble[team]);
    m.body.setEnabled(true);
    m.body.setTranslation(pos, true);
    m.body.setLinvel(vel, true);
    this.activeCount++;
  }

  /**
   * Pack traffic: a robot heading into a pack-mate steps forward and slips past in
   * front of it, then drops back onto the rail once they no longer overlap. The one
   * being passed stays put; only one of an overlapping pair steps out.
   */
  private updatePassing() {
    for (const team of [0, 1] as Team[]) {
      const mates = this.shooters.filter((m) => m.team === team && m.active && !m.out);
      if (mates.length < 2) {
        for (const m of mates) m.passing = false;
        continue;
      }
      for (const m of mates) {
        const dir = m.moveAxis !== 0 ? Math.sign(m.moveAxis) : m.moveTarget !== null && Math.abs(m.moveTarget - m.x) > 0.05 ? Math.sign(m.moveTarget - m.x) : 0;
        // a pack-mate is in the way when it's close, or ahead within reach of where this one is heading
        const inWay = (t: Shooter) => {
          const dx = t.x - m.x;
          return Math.abs(dx) < PASS.clear || (dir !== 0 && Math.sign(dx) === dir && Math.abs(dx) < PASS.start);
        };
        const near = mates.filter((t) => t !== m && inWay(t));
        if (!near.length) {
          // drop back onto the rail once clear
          m.passing = false;
          continue;
        }
        if (m.passing) continue;
        // only the one moving into a pack-mate steps out (walking away never does),
        // and never both of an overlapping pair
        const headingIn = near.some((t) => Math.sign(t.x - m.x) === dir || Math.abs(t.x - m.x) < 0.5);
        if (dir !== 0 && headingIn && near.every((t) => !t.passing)) m.passing = true;
      }
    }
  }

  private updateShooter(s: Shooter, dt: number, canAct: boolean) {
    if (s.out) {
      s.firing = false;
      s.flash = Math.max(0, s.flash - dt);
      return;
    }
    // slow-mo: the robot that triggered it acts at real-time speed x owner rate
    const own = this.slowT > 0 && this.slowOwner === s.slot ? SLOWMO.owner / SLOWMO.world : 1;
    const adt = dt * own;
    // movement
    // the whole rail is open; pack-mates step forward to pass each other
    const lo = -ARENA.railHalfWidth;
    const hi = ARENA.railHalfWidth;
    const speed = s.stats.moveSpeed * (s.shieldUp ? SHIELD.moveMul : 1) * (s.chargeHold >= CHARGE.hold ? CHARGE.moveMul : 1);
    const prevX = s.x;
    if (canAct || this.phase === 'countdown') {
      if (s.moveTarget !== null) {
        const delta = Math.max(lo, Math.min(hi, s.moveTarget)) - s.x;
        const stepMax = speed * 1.6 * adt;
        s.x += Math.max(-stepMax, Math.min(stepMax, delta));
      } else {
        s.x += s.moveAxis * speed * adt;
      }
    }
    // note when the robot is pressing into an end of its rail
    const wants = s.moveTarget !== null ? Math.sign(s.moveTarget - s.x) * (s.moveTarget > hi || s.moveTarget < lo ? 1 : 0) : Math.sign(s.moveAxis);
    s.x = Math.max(lo, Math.min(hi, s.x));
    s.railPush = (s.x >= hi - 1e-6 && wants > 0) || (s.x <= lo + 1e-6 && wants < 0) ? wants : 0;
    s.vx = (s.x - prevX) / dt;
    // slide out in front of the pack while passing, back onto the rail once clear
    const passGoal = s.passing ? PASS.depth : 0;
    const passStep = PASS.speed * adt;
    s.passOff += Math.max(-passStep, Math.min(passStep, passGoal - s.passOff));
    s.y = s.railY + s.forward * s.passOff;
    s.body.setNextKinematicTranslation({ x: s.x, y: s.y });
    // Smart Lock: the aim snaps onto the closest opponent, leading it as it moves
    s.lockSlot = -1;
    const t = s.lockT > 0 && s.alive ? this.lockTarget(s) : null;
    if (t) {
      s.lockSlot = t.slot;
      const dist = Math.hypot(t.x - s.x, t.y - s.y);
      const lead = t.vx * (dist / Math.max(1, s.stats.muzzleSpeed));
      s.aim = Math.atan2(t.x + lead - s.x, (t.y - s.y) * s.forward);
      s.lockSteer = true;
    } else if (s.lockSteer) {
      // the lock ran out (or lost its target): back to shooting straight ahead
      s.aim = 0;
      s.lockSteer = false;
    }
    s.aim = Math.max(-AIM_LIMIT, Math.min(AIM_LIMIT, s.aim));

    s.flash = Math.max(0, s.flash - dt);
    s.stagger = Math.max(0, s.stagger - dt);
    s.recoil = Math.max(0, s.recoil - adt * 8);
    s.kickT += adt;
    s.heavyT += adt;
    s.windT += adt;
    const sp = s.stats.special;
    // a gun in the air (tossed to the other hand): it can't fire until it lands
    s.swapT = Math.max(0, s.swapT - adt);
    // a wind-up in progress: the shot leaves when it's done
    if (s.windLeft > 0 && (s.windLeft -= adt) <= 0) {
      s.windLeft = 0;
      if (s.alive) this.fire(s, true);
    }
    // Ember's head turns left and right all the time; its shots follow it (holding fire slows
    // the sweep, so a steady hand can line a shot up)
    if (sp?.wobble) s.wobble = Math.sin((s.wobbleN += adt * HEAD_SWEEP * (s.firing ? 0.35 : 1))) * sp.wobble;
    s.cooldown -= adt;
    s.sinceHit += dt;
    s.sinceHurt += dt;
    if (canAct) {
      s.multiT = Math.max(0, s.multiT - dt);
      s.wiperT = Math.max(0, s.wiperT - dt);
      s.lockT = Math.max(0, s.lockT - dt);
    }

    // dragon salvo launches on its own, a short gap between balls
    if (canAct && s.dragonQueue > 0) {
      s.dragonTimer -= adt;
      if (s.dragonTimer <= 0) {
        this.fireDragon(s, DRAGON.count - s.dragonQueue);
        s.dragonQueue--;
        s.dragonTimer = DRAGON.gap;
      }
    }

    // magazine: forced reload when empty, slow trickle refill when idle
    if (s.reload > 0) {
      s.reload -= adt;
      if (s.reload <= 0) {
        s.ammo = s.stats.capacity;
        this.fx.push({ type: 'reload', slot: s.slot });
        if (s.slot === 0) sfx.play('reload');
      }
    } else if (!s.firing || !canAct) {
      s.idle += adt;
      if (s.idle > 0.45 && s.ammo < s.stats.capacity) {
        s.ammo = Math.min(s.stats.capacity, s.ammo + (adt * s.stats.capacity) / (s.stats.reloadTime * 1.6));
      }
    }

    // shield energy: drains while raised, regenerates after a pause
    s.shieldLock = Math.max(0, s.shieldLock - dt);
    if (s.shieldUp && !s.wasShielding) s.shieldT = 0;
    s.shieldT += dt;
    s.wasShielding = s.shieldUp;
    if (canAct && s.shieldUp) {
      s.shield = Math.max(0, s.shield - SHIELD.drain * dt);
      s.shieldIdle = 0;
      if (s.shield <= 0) this.breakShield(s);
    } else {
      s.shieldIdle += dt;
      if (s.shieldIdle > SHIELD.regenDelay && s.shieldLock <= 0) s.shield = Math.min(SHIELD.max, s.shield + SHIELD.regen * (s.stats.agility ?? 1) * dt);
    }

    // charge shot: holding past the threshold stores balls; letting go fires them as one.
    // You charge by holding fire; a CPU robot (opponent or pack-mate) charges when its AI plans it (chargeWant).
    const human = this.chargeShots && s.slot === 0;
    const cpu = !human && this.cpuCharges(s) && s.chargeWant > 0;
    if (human || cpu || s.chargeHold > 0 || s.stored > 0) {
      const holding = canAct && (human ? s.firing : cpu) && !s.shieldUp && s.reload <= 0;
      let letGo = false;
      if (holding) {
        s.chargeHold += adt;
        if (s.chargeHold >= CHARGE.hold) {
          s.burstQueue = 0;
          // one ball per `per` seconds after the threshold: a 3 s hold stores 5
          const want = Math.min(CHARGE.max, Math.floor((s.chargeHold - CHARGE.hold) / CHARGE.per + 1e-6));
          while (s.stored < want && s.ammo >= 1) {
            s.ammo -= 1;
            s.stored++;
            s.idle = 0;
            sfx.play('tick', (0.6 + s.stored * 0.12) * (human ? 1 : 0.5));
          }
          // the CPU lets go once it has what it planned, or when the magazine runs dry
          if (cpu && s.stored > 0 && (s.stored >= s.chargeWant || s.ammo < 1)) letGo = true;
        }
      }
      if (letGo || (!holding && (s.chargeHold > 0 || s.stored > 0))) {
        if (s.stored > 0) {
          // released: the charged ball; interrupted (shield, round over): the balls go back
          const chose = human ? !s.firing : letGo;
          if (chose && canAct && !s.shieldUp) this.fireCharged(s, s.stored);
          else s.ammo = Math.min(s.stats.capacity, s.ammo + s.stored);
        }
        if (s.ammo < 1 && s.reload <= 0) s.reload = s.stats.reloadTime;
        s.stored = 0;
        s.chargeHold = 0;
        if (!human) s.chargeWant = 0;
      }
      if (human && !s.firing) s.pressShot = false;
    }
    // a charging press doesn't stream shots: one shot per press, the rest is charge;
    // a charging CPU holds its fire until it lets go
    const mayFire = human ? !s.pressShot && s.chargeHold < CHARGE.hold : s.chargeWant === 0 && s.chargeHold === 0;
    if (mayFire && canAct && s.firing && !s.shieldUp && s.reload <= 0 && s.cooldown <= 0 && s.swapT <= 0 && s.ammo >= 1) {
      if (human) s.pressShot = true;
      const multi = s.multiT > 0 && !s.superReady;
      if (multi) this.fireVolley(s);
      else this.fire(s);
      // fire rate: the rest of this pull's balls follow in a quick string
      s.burstQueue = multi ? 0 : this.burst - 1;
      s.burstTimer = BURST_GAP;
      s.cooldown = s.stats.fireInterval * (multi ? MULTI.interval : 1) + s.burstQueue * BURST_GAP;
      s.idle = 0;
      s.ammo -= 1;
      if (s.ammo < 1) s.reload = s.stats.reloadTime;
    }
    if (s.burstQueue > 0) {
      if (!canAct || s.shieldUp || s.reload > 0 || s.ammo < 1) s.burstQueue = 0;
      else {
        s.burstTimer -= adt;
        if (s.burstTimer <= 0) {
          this.fire(s);
          s.burstQueue--;
          s.burstTimer = BURST_GAP;
          s.idle = 0;
          s.ammo -= 1;
          if (s.ammo < 1) s.reload = s.stats.reloadTime;
        }
      }
    }
  }

  // ---------- air drops ----------

  private updateDrops(dt: number) {
    if (this.itemsOn) {
      this.nextDrop -= dt;
      if (this.nextDrop <= 0) {
        this.spawnDrop();
        this.nextDrop = DROP.every[0] + Math.random() * (DROP.every[1] - DROP.every[0]);
      }
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (d.h > 0) d.h = Math.max(0, d.h - DROP.fallSpeed * dt);
      else d.life -= dt;
      // grab it once it's low enough to reach, if a robot on that rail has free hands
      const s = d.h < 1.2 ? this.shooters.find((r) => r.team === d.team && r.alive && !r.item && Math.abs(r.x - d.x) < DROP.reach) : undefined;
      if (s) {
        s.item = d.type;
        this.drops.splice(i, 1);
        this.fx.push({ type: 'pickup', slot: s.slot, item: d.type });
        if (s.slot === 0) sfx.play('charge');
        continue;
      }
      // the other side can shoot a low crate to deny it
      if (d.h < 1.0 && this.shotDown(d)) {
        this.drops.splice(i, 1);
        continue;
      }
      if (d.life <= 0) this.drops.splice(i, 1);
    }
  }

  /** True if an opposing marble hit this crate (the marble is spent). */
  private shotDown(d: Drop) {
    const y = d.team === 0 ? -ARENA.railY : ARENA.railY;
    for (const m of this.marbles) {
      if (!m.active || m.team === d.team || this.toDespawn.has(m)) continue;
      const p = m.body.translation();
      const reach = 0.36 + m.radius;
      if (Math.abs(p.x - d.x) > reach || Math.abs(p.y - y) > reach) continue;
      if (m.kind === 'normal') this.toDespawn.add(m);
      this.fx.push({ type: 'drop-destroyed', x: d.x, y, team: d.team, item: d.type });
      sfx.play('bump', 1);
      return true;
    }
    return false;
  }

  private spawnDrop() {
    const team = this.dropSide;
    this.dropSide = team === 0 ? 1 : 0;
    // one crate per side at a time
    if (this.drops.some((d) => d.team === team)) return;
    const frac = this.teamFrac(team);
    let total = 0;
    const weights = ITEM_TYPES.map((t) => {
      // repair kits mostly arrive when they're needed
      const w = t === 'heal' ? ITEMS.heal.weight * (frac < 0.7 ? 1.6 : 0.25) : ITEMS[t].weight;
      total += w;
      return w;
    });
    let r = Math.random() * total;
    let type = ITEM_TYPES[0];
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        type = ITEM_TYPES[i];
        break;
      }
    }
    // land it within reach of a live robot on that rail
    const owners = this.shooters.filter((s) => s.team === team && s.alive);
    const o = owners[Math.floor(Math.random() * owners.length)] ?? this.player;
    const x = o.lane[0] + 0.3 + Math.random() * Math.max(0.1, o.lane[1] - o.lane[0] - 0.6);
    this.drops.push({ id: this.dropId++, team, type, x, h: DROP.startHeight, life: DROP.landedLife });
  }

  /** Activate the held item. Returns false when there's nothing to use. */
  useItem(s: Shooter) {
    if (!s.item || this.phase !== 'fight' || !s.alive) return false;
    const item = s.item;
    s.item = null;
    switch (item) {
      case 'multi':
        s.multiT = ITEMS.multi.duration;
        break;
      case 'slowmo':
        this.slowT = ITEMS.slowmo.duration;
        this.slowOwner = s.slot;
        break;
      case 'wiper':
        s.wiperT = ITEMS.wiper.duration;
        break;
      case 'lock':
        s.lockT = ITEMS.lock.duration;
        break;
      case 'heal': {
        const before = s.health;
        s.health = Math.min(s.maxHealth, s.health + s.maxHealth * HEAL.fraction);
        this.fx.push({ type: 'heal', slot: s.slot, amount: s.health - before });
        break;
      }
      case 'dragon':
        s.dragonQueue = DRAGON.count;
        s.dragonTimer = 0;
        break;
      case 'missile':
        this.launchMissile(s);
        break;
    }
    this.fx.push({ type: 'use', slot: s.slot, item });
    sfx.play(item === 'dragon' ? 'super' : item === 'slowmo' ? 'whoosh' : 'charge', s.slot === 0 ? 1 : 0.6);
    return true;
  }

  // ---------- firing ----------

  private takeMarble() {
    if (this.activeCount >= MATCH.marbleCap) {
      // recycle the oldest marble rather than refusing to fire
      let oldest: Marble | null = null;
      for (const m of this.marbles) if (m.active && (!oldest || m.spawnOrder < oldest.spawnOrder)) oldest = m;
      if (oldest) this.despawn(oldest);
    }
    return this.marbles.find((mm) => !mm.active) ?? null;
  }

  private launch(m: Marble, s: Shooter, o: { angle: number; radius: number; speed: number; mass: number; damage: number; kind: MarbleKind; push?: number; weave?: number; side?: number }) {
    const d = s.dir(o.angle);
    const p = s.muzzle();
    // a twin barrel's marble leaves beside the centre line, and a gun held off-centre fires from its hand
    const side = (o.side ?? 0) + (s.stats.special?.hand ?? 0) * s.lastHand;
    if (side) {
      p.x += d.y * side;
      p.y -= d.x * side;
    }
    const push = o.push ?? 0;
    m.active = true;
    m.team = s.team;
    m.owner = s.slot;
    m.kind = o.kind;
    m.weave = o.weave ?? 1;
    m.lastGate = -1;
    m.hop = 0;
    m.age = 0;
    m.bounces = 0;
    m.damage = o.damage;
    m.radius = o.radius;
    m.spawnOrder = this.spawnCounter++;
    m.collider.setRadius(o.radius);
    m.collider.setMass(o.mass);
    m.collider.setCollisionGroups(GROUPS.marble[s.team]);
    m.body.setEnabled(true);
    m.body.setTranslation({ x: p.x + d.x * push, y: p.y + d.y * push }, true);
    m.body.setLinvel({ x: d.x * o.speed, y: d.y * o.speed }, true);
    this.activeCount++;
  }

  private fire(s: Shooter, wound = false) {
    const st = s.stats;
    const sp = st.special;
    // a wind-up first (the punch); the shot itself comes when it's done
    if (sp?.windup && !wound) {
      if (s.windLeft <= 0) {
        s.windLeft = sp.windup;
        s.windT = 0;
      }
      return;
    }
    const m = this.takeMarble();
    if (!m) return;
    // the hand this shot leaves from (it may change for the next one)
    s.lastHand = s.hand;
    if (sp?.alternate) s.hand = -s.hand;
    // Pioneer tosses the gun to the other hand after every few shots
    if (sp?.swap && (s.swapN = (s.swapN + 1) % sp.swap) === 0) {
      s.hand = -s.hand;
      s.swapT = TOSS_TIME;
    }
    // the shot leaves the way the head is facing right now
    const wob = sp?.wobble ? s.wobble : 0;
    // Rex: every few shots is a bite, a giant heavy marble; Wyvern's wound-up shot hits harder
    const bite = !!sp?.bite && (s.biteN = (s.biteN + 1) % sp.bite) === 0;
    const wind = sp?.windup ? WINDUP : { damage: 1, speed: 1, mass: 1 };
    const isSuper = s.superReady;
    s.superReady = false;
    // in your own slow-mo every shot is a boost ball
    const boost = !isSuper && this.slowT > 0 && this.slowOwner === s.slot;
    const radius = st.marbleRadius * (isSuper ? SUPER.radius : boost ? BOOST_BALL.radius : bite ? BITE.radius : 1);
    const twin = !!st.twin && !isSuper;
    const fan = !isSuper && (st.fan ?? 1) > 1 ? st.fan! : 1;
    this.launch(m, s, {
      // a super shot flies dead straight
      angle: s.aim + (isSuper ? 0 : (Math.random() * 2 - 1) * st.spread + wob),
      radius,
      speed: st.muzzleSpeed * (isSuper ? SUPER.speed : boost ? BOOST_BALL.speed : 1) * wind.speed,
      mass: st.marbleMass * (isSuper ? SUPER.mass : boost ? BOOST_BALL.mass : bite ? BITE.mass : 1) * wind.mass,
      damage: st.damage * (isSuper ? SUPER.damage : boost ? BOOST_BALL.damage : bite ? BITE.damage : 1) * (twin ? TWIN.damage : 1) * (fan > 1 ? FAN.damage : 1) * wind.damage,
      kind: isSuper ? 'super' : boost || bite ? 'boost' : 'normal',
      // nudge a big marble forward so it doesn't spawn inside the robot
      push: isSuper || bite ? radius : 0,
      side: twin ? TWIN.gap : 0,
    });
    s.shots++;
    // twin barrels: a second marble from the other barrel, each a little lighter on damage
    // spread fire: the rest of the fan, alternating either side of the aim
    for (let k = 1; k < fan; k++) {
      const mk = this.takeMarble();
      if (!mk) break;
      this.launch(mk, s, {
        angle: s.aim + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * FAN.angle,
        radius,
        speed: st.muzzleSpeed * (boost ? BOOST_BALL.speed : 1),
        mass: st.marbleMass * (boost ? BOOST_BALL.mass : 1),
        damage: st.damage * (boost ? BOOST_BALL.damage : 1) * FAN.damage,
        kind: boost ? 'boost' : 'normal',
      });
      s.shots++;
    }
    if (twin) {
      const m2 = this.takeMarble();
      if (m2) {
        this.launch(m2, s, {
          angle: s.aim + (Math.random() * 2 - 1) * st.spread,
          radius,
          speed: st.muzzleSpeed * (boost ? BOOST_BALL.speed : 1),
          mass: st.marbleMass * (boost ? BOOST_BALL.mass : 1),
          damage: st.damage * (boost ? BOOST_BALL.damage : 1) * TWIN.damage,
          kind: boost ? 'boost' : 'normal',
          side: -TWIN.gap,
        });
        s.shots++;
      }
    }
    s.recoil = 1;
    s.kickT = 0;
    if (isSuper) s.heavyT = 0;
    this.fx.push({ type: isSuper ? 'super-fire' : 'muzzle', slot: s.slot });
    sfx.play(isSuper ? 'super' : 'fire', s.slot === 0 ? 1 : 0.45);
  }

  /** The charge shot: one ball `n` times the size and power of a regular one, dead straight. */
  private fireCharged(s: Shooter, n: number) {
    const m = this.takeMarble();
    if (!m) {
      s.ammo = Math.min(s.stats.capacity, s.ammo + n);
      return;
    }
    const st = s.stats;
    const radius = st.marbleRadius * n;
    this.launch(m, s, {
      angle: s.aim,
      radius,
      // big ones roll a touch slower but carry far more weight
      speed: st.muzzleSpeed * (1 - (n - 1) * 0.04),
      mass: st.marbleMass * n * n,
      damage: st.damage * n,
      kind: 'super',
      push: radius,
    });
    s.shots++;
    s.recoil = 1;
    s.kickT = 0;
    s.heavyT = 0;
    s.idle = 0;
    this.fx.push({ type: 'super-fire', slot: s.slot });
    sfx.play('super', 0.7 + n * 0.1);
  }

  /** Multi shot: a fan of marbles from one trigger pull. */
  private fireVolley(s: Shooter) {
    const st = s.stats;
    for (let i = 0; i < MULTI.count; i++) {
      const m = this.takeMarble();
      if (!m) break;
      const t = MULTI.count === 1 ? 0 : i / (MULTI.count - 1) - 0.5;
      this.launch(m, s, {
        angle: s.aim + t * 2 * MULTI.fan,
        radius: st.marbleRadius,
        speed: st.muzzleSpeed,
        mass: st.marbleMass,
        damage: st.damage * MULTI.damage,
        kind: 'normal',
      });
      s.shots++;
    }
    s.recoil = 1;
    // a multi-shot fan is a special move: the first volley of a run gets the big reaction
    s.kickT = 0;
    if (s.heavyT > 1.2) s.heavyT = 0;
    this.fx.push({ type: 'muzzle', slot: s.slot });
    sfx.play('fire', s.slot === 0 ? 1 : 0.45);
  }

  private fireDragon(s: Shooter, i: number) {
    const m = this.takeMarble();
    if (!m) return;
    const st = s.stats;
    const radius = st.marbleRadius * DRAGON.radius;
    const weave = i % 2 === 0 ? 1 : -1;
    this.launch(m, s, {
      angle: s.aim,
      radius,
      speed: st.muzzleSpeed * DRAGON.speed,
      mass: st.marbleMass * DRAGON.mass,
      damage: st.damage * DRAGON.damage,
      kind: 'dragon',
      push: radius,
      weave,
    });
    // start the weave with a sideways kick (velocity = A·ω at t = 0)
    const v = m.body.linvel();
    m.body.setLinvel({ x: v.x + DRAGON.amp * DRAGON.freq * weave, y: v.y }, true);
    s.recoil = 1;
    s.kickT = 0;
    // one big reaction for the whole three-ball salvo
    const first = s.heavyT > 1.2;
    if (first) s.heavyT = 0;
    this.fx.push({ type: first ? 'super-fire' : 'muzzle', slot: s.slot });
    sfx.play('fire', 1);
  }

  private despawn(m: Marble) {
    if (!m.active) return;
    m.active = false;
    m.body.setLinvel({ x: 0, y: 0 }, false);
    m.body.setTranslation({ x: 0, y: -100 - m.idx }, false);
    m.body.setEnabled(false);
    this.activeCount--;
  }

  private onContact(h1: number, h2: number) {
    const a = this.tags.get(h1);
    const b = this.tags.get(h2);
    if (!a || !b) return;
    if (a.kind !== 'marble' && b.kind !== 'marble') return;
    const [m, other] = a.kind === 'marble' ? [a.m, b] : [(b as { m: Marble }).m, a];
    if (!m.active || this.toDespawn.has(m)) return;
    const v = m.body.linvel();
    const speed = Math.hypot(v.x, v.y);
    const p = m.body.translation();

    switch (other.kind) {
      case 'shooter': {
        const s = other.s;
        if (s.team === m.team) return;
        this.toDespawn.add(m);
        if (this.phase !== 'fight' || !s.alive) return;
        const heavy = m.kind !== 'normal';
        // power balls always land at full power
        const factor = heavy ? 1 : Math.max(0.45, Math.min(1.25, speed / 15));
        const amount = m.damage * factor;
        // a perfect block: the marble goes straight back at whoever fired it
        if (s.shieldUp && s.shieldT < PARRY.window) {
          this.parries.push({ s, attacker: this.shooters[m.owner], damage: m.damage, kind: m.kind, x: p.x, y: p.y });
          return;
        }
        if (this.block(s, amount, p.x, p.y, heavy)) return;
        s.flash = heavy ? 0.3 : 0.12;
        if (m.kind === 'super') s.stagger = 0.45;
        const attacker = this.shooters[m.owner];
        attacker.hits++;
        if (!heavy && !attacker.superReady) {
          attacker.charge = Math.min(SUPER_HITS, attacker.charge + 1);
          if (attacker.charge >= SUPER_HITS) {
            attacker.charge = 0;
            attacker.superReady = true;
            this.fx.push({ type: 'super-ready', slot: attacker.slot });
            if (attacker.slot === 0) sfx.play('charge');
          }
        }
        // a beat of hit-stop on every hit (a touch more when you're the one hit), longer for big ones
        this.hitstop = Math.max(this.hitstop, m.kind === 'super' ? 0.18 : m.kind === 'dragon' || m.kind === 'x5' ? 0.1 : s.team === 0 ? 0.075 : 0.06);
        this.fx.push({ type: 'hit', x: p.x, y: p.y, team: s.team, slot: s.slot, amount, power: m.kind });
        sfx.play(m.kind === 'super' ? 'superhit' : s.team === 0 ? 'hurt' : 'hit', factor);
        this.damage(s, attacker, amount, { marble: m.idx });
        break;
      }
      case 'marble': {
        const o = other.m;
        const ov = o.body.linvel();
        const rel = Math.hypot(v.x - ov.x, v.y - ov.y);
        sfx.play('clack', rel / 25);
        // both balls jump a little on a hard clack
        const hop = Math.min(0.5, rel * 0.025);
        m.hop = Math.max(m.hop, hop);
        o.hop = Math.max(o.hop, hop);
        if (rel > 6) this.fx.push({ type: 'clack', x: p.x, y: p.y, intensity: rel / 25 });
        if (o.team !== m.team && rel > 8) {
          const op = o.body.translation();
          this.fx.push({ type: 'spark', x: (p.x + op.x) / 2, y: (p.y + op.y) / 2, intensity: rel / 30 });
        }
        break;
      }
      case 'wall': {
        m.hop = Math.max(m.hop, Math.min(0.35, speed * 0.015));
        m.bounces++;
        // Liger's marbles come off the wall at full speed, and harder for every bounce
        const ric = this.shooters[m.owner]?.stats.special?.ricochet;
        if (ric) {
          m.damage *= 1 + ric;
          m.body.setLinvel({ x: v.x / 0.82, y: v.y / 0.82 }, true);
          this.fx.push({ type: 'spark', x: p.x, y: p.y, intensity: 1 });
        }
        sfx.play('wall', speed / 20);
        if (m.bounces > MATCH.marbleMaxBounces) this.toDespawn.add(m);
        break;
      }
      case 'bump':
        m.hop = Math.max(m.hop, Math.min(0.45, speed * 0.02));
        m.bounces++;
        sfx.play('bump', speed / 18);
        break;
      case 'pin':
        other.p.glow = 0.3;
        m.hop = Math.max(m.hop, 0.2);
        m.bounces++;
        this.fx.push({ type: 'pin', x: other.p.x, y: other.p.y });
        sfx.play('clack', 0.7);
        break;
      case 'cover': {
        const c = other.c;
        if (!c.active) break;
        m.bounces++;
        // power balls smash cover faster
        c.hp -= m.kind === 'normal' ? 1 : 3;
        sfx.play('bump', 0.9);
        if (c.hp <= 0) {
          c.active = false;
          c.collider.setEnabled(false);
          this.fx.push({ type: 'cover-break', x: c.x, y: c.y, idx: c.idx });
          sfx.play('pop', 0.8);
        } else this.fx.push({ type: 'cover-hit', x: p.x, y: p.y, idx: c.idx });
        break;
      }
      case 'gatewall': {
        const g = this.gates.find((gg) => gg.type === 'wall');
        if (!g || g.charges <= 0) break;
        m.bounces++;
        g.charges -= m.kind === 'normal' ? 1 : 3;
        sfx.play('bump', 0.9);
        if (g.charges <= 0) {
          g.charges = 0;
          this.gateWall.setEnabled(false);
          g.life = Math.min(g.life, g.age + 0.3);
          this.fx.push({ type: 'gate-break', x: g.x, y: g.y, gate: 'wall' });
          sfx.play('pop', 0.9);
        } else this.fx.push({ type: 'gate-pass', x: p.x, y: p.y, gate: 'wall', team: m.team });
        break;
      }
    }
  }

  private finish() {
    if (this.phase !== 'fight') return;
    const pf = this.alive(0).length ? this.teamFrac(0) : 0;
    const ef = this.alive(1).length ? this.teamFrac(1) : 0;
    // compare fractions so boosted or pack health is judged fairly on time-out
    this.winner = Math.abs(pf - ef) < 1e-6 ? -1 : pf > ef ? 0 : 1;
    this.phase = 'ko';
    this.phaseTime = 0;
    this.slowT = 0;
    for (const s of this.shooters) s.firing = false;
    for (const m of this.missiles) this.fx.push({ type: 'missile-end', x: m.x, y: m.y, team: m.team });
    this.missiles.length = 0;
  }

  activeMarbles() {
    return this.activeCount;
  }
}
