import * as THREE from 'three';
import { celify } from './cel';
import { InkOnly } from './post';
import { ShooterMesh, characterById, playable, propModel, studioEnv, type CharacterDef } from './robot';
import { traitMul } from './roster';
import { BALANCE_ARENA, BASE_STATS, MAG_ARENA, MAG_ARENA_OF, MARBLES, MARBLE_OF, MATCH, TOSS_TIME, type MarbleType } from './config';
import { BITE, CHARGE, HEAD_SWEEP, MOVE_NAMES, SPIRIT, SPIRIT_OF, TWIN, WINDUP, type SpiritKind } from './game';
import * as sfx from './audio';
import { skinned } from './cosmetics';
import { kitOf } from './kits';
import { DROP, DRAGON, ITEMS, MISSILE } from './items';
import { portrait } from './portraits';
import { stageById } from './stage';
import { Motes, Scars, impactOf, stageLight } from './stagefx';
import { landmark } from './landmarks';
import { coverProp, decorate } from './scenery';
import { BOSSES, MONSTERS } from './monsters';
import { makeDungeon, rollGear, gearPower, RARITY, PERKS, STARTER, D_ROCK, type Dungeon, type DRoom, type Gear } from './dungeon';

/**
 * Action: walk the whole stage freely and take the other fighters down, seen from above.
 * Two ways to play, on one engine:
 * - Gauntlet: room after room of CPU fighters; clear a room, pick an upgrade, walk through the
 *   door. A boss every fifth room, ten rooms in all.
 * - Free-for-all: one big stage, you and five CPU fighters, everyone against everyone. Crates
 *   hold power cubes, bushes hide whoever stands in them, and a storm closes in from the edges.
 * Twin-stick: the left thumb walks, the right thumb aims and fires while held (a tap fires a burst
 * at the nearest enemy). Every fighter keeps its own marble, magazine, damage and special from
 * the main game (Arena rules), scaled to Action's health. Standing still mends you.
 */

export type ActionKind = 'gauntlet' | 'ffa' | 'siege' | 'knockout' | 'zone' | 'boss';
/**
 * a League Story chapter played as an Action fight: who's in it (the chapter's foe first), the
 * look, and what happens when it's over (the story carries on, or you try again)
 */
/** a caption during a story dungeon ('' who: the narrator) */
export interface StoryLine {
  who: string;
  text: string;
}
export interface StoryFight {
  kind: 'ffa' | 'gauntlet' | 'boss';
  /** the chapter, for the panels */
  title: string;
  /** Storm Brawl: the fighters you face (the chapter's foe first; the rest are filled in) */
  foes?: string[];
  /** Giant Slayer: your two allies, and the giant; Dungeon Run: the boss at the end */
  allies?: string[];
  boss?: string;
  /** the arena's look (a theme id) or, for a dungeon, which stage's look (1-7) */
  theme?: string;
  stage?: number;
  rooms?: number;
  /** the other side's health, as a share (earlier chapters are gentler) */
  hp?: number;
  /** the chapter's objective, kept on screen through the fight */
  goal?: string;
  /** a dungeon chapter's script: captions as you go, and a talk before the boss */
  says?: { enter: StoryLine; room: StoryLine; key: StoryLine; door: StoryLine };
  bossTalk?: (then: () => void) => void;
  /** a loss: the foe's closing words first (then the retry panel) */
  closing?: (then: () => void) => void;
  onEnd: (win: boolean) => void;
}

// tiles
const FLOOR = 0;
const WALL = 1;
const CRATE = 2;
const BUSH = 3;
const WATER = 4;
const GATE = 5;
/** a fortress's footprint (Siege): blocks walking, and takes the marbles that hit it */
const FORT = 6;
/** Dungeon Run: the rock beyond the walls (blocks everything, drawn as darkness) */
const ROCK = D_ROCK;

const UNIT_R = 0.42;
const BASE_HP = 3600;
/** the main game's health is 100: its damage numbers scale by this */
const SCALE = BASE_HP / MATCH.maxHealth;
const SHOT_SPEED = 22; // (was 13: raised with the run speed so a marble still well outpaces a fighter)
const SHOT_RANGE = 7.5;
/** Action's own Speed rail: the slow fighters are quicker here than in the other modes (0.5 and 0.75 there) */
const ACTION_SPEED = [0.75, 0.9, 1, 1.3, 1.6];
/** a computer fighter's special also fills by itself over this many seconds (as well as from hits) */
const CPU_SPECIAL_FILL = 18;
/** standing still (not firing, not hit for a moment) mends this share of health a second */
const MEND = 0.12;
const CRATE_HP = 2600;
const STORM_START = 45;
const STORM_END = 165;
/** free-for-all fighters are tougher, so a fight there lasts */
const FFA_HP = 2.1;
const STORM_DPS = 700;
const BEST_KEY = 'marble-fighter:action:best';
// Siege: three on three, each side's fortress shooting back; knock theirs down (or have more of yours left at the bell)
const FORT_HP = 21000;
const FORT_RANGE = 7;
const FORT_FIRE = 0.6;
const FORT_DMG = 300;
const SIEGE_TIME = 150;
const RESPAWN = 3;
const HINTS = ['TAP TO FIRE', 'HOLD TO CHARGE', 'DRAG TO AIM', 'SHOOT THE CRATES', 'STAND STILL TO MEND'];
const HINTS_KEY = 'marble-fighter:action:hints';
/** rough blocks of stone in a dark shade of the floor's hue: what a dungeon's rooms are cut out of */
function rockCanvas(floor: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  // (the floor's hue at one fixed darkness, so a bright crypt and a neon vault both read as rock)
  const hsl = new THREE.Color(floor).getHSL({ h: 0, s: 0, l: 0 });
  const shade = (l: number) => `#${new THREE.Color().setHSL(hsl.h, Math.max(hsl.s * 0.8, 0.12), l).getHexString()}`;
  g.fillStyle = shade(0.05);
  g.fillRect(0, 0, 256, 256);
  // courses of uneven blocks, the seams left dark
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < 256; y += 64) {
    const off = y % 128 ? -48 : 0;
    for (let x = off; x < 256; x += 96) {
      g.fillStyle = shade(0.11 + rnd() * 0.05);
      g.beginPath();
      g.roundRect(x + 3, y + 3, 90, 58, 10);
      g.fill();
    }
  }
  return c;
}

/** the team modes' colours: bars, marbles and the rings underfoot */
const TEAM_OURS = 0x4aa8ff;
const TEAM_THEIRS = 0xff4a4a;
const OURS_C = new THREE.Color(TEAM_OURS);
const THEIRS_C = new THREE.Color(TEAM_THEIRS);
// Knockout: best of three rounds, no respawns; a round runs out at ROUND_TIME (the side with more health left takes it)
const ROUND_TIME = 60;
// Hot Zone: hold the ring in the middle with nobody of theirs in it; first to 100% (or the most at the bell)
const ZONE_TIME = 150;
const ZONE_R = 2.4;
/** % a second for one fighter alone in the zone, and for each more */
const ZONE_RATE = [1.9, 0.6];
// Boss Fight: you and two more against one giant fighter, before the clock runs out
const BOSS_TIME = 150;
const BOSS_HP = 22;
/**
 * the special's power-up pose before its balls leave (game seconds): yours plays through the slow
 * motion as a little cinematic; the others' quicker, as a warning
 */
const POSE_ME = 0.36;
const POSE_CPU = 0.8;
/** (the other modes' pose runs this long) */
const POSE_FULL = 2.8;
const TEAM_COLOR = [0x4aa8f0, 0xff5a5a];

/**
 * the stages' looks, after the main game's arenas (their floor, rails and surroundings), made
 * light enough to read from above: floor checker, wall, bush, water and the ground round the edge
 */
interface Theme {
  id: string;
  /** the main game's stage it's after (for its name), or its own name */
  stage?: string;
  name?: string;
  floor: [string, string];
  /** the floor's grid lines (neon on the night stages) */
  line: string;
  wall: number;
  /** a glowing edge on the walls */
  wallGlow?: number;
  bush: number;
  bushGlow?: boolean;
  water: number;
  /** lava, neon pools: they glow */
  waterGlow?: boolean;
  apron: number;
  sky: number;
}
const THEMES: Theme[] = [
  { id: 'meadow', name: 'Green Meadow', floor: ['#7fc25a', '#76b852'], line: 'rgba(0,0,0,0.06)', wall: 0xc8a46a, bush: 0x3fae4a, water: 0x3ac8ef, apron: 0x3a6a8a, sky: 0x8fcff0 },
  { id: 'dungeon', name: 'Stone Keep', floor: ['#8a93b8', '#828bb0'], line: 'rgba(0,0,0,0.06)', wall: 0x5a4a8a, bush: 0x3fae4a, water: 0x3ac8ef, apron: 0x2a2440, sky: 0x4a4070 },
  { id: 'beach', stage: 'beach', floor: ['#f3e7c6', '#eadbb4'], line: 'rgba(160,120,60,0.12)', wall: 0x9b7a55, bush: 0x4fbf6a, water: 0x2fc6d6, apron: 0x2fc6d6, sky: 0x5fbcf5 },
  { id: 'snow', stage: 'snow', floor: ['#e6f0f9', '#d9e6f2'], line: 'rgba(127,182,232,0.35)', wall: 0xa9d4f0, bush: 0x2f6a5a, water: 0x8fd0f2, apron: 0xf4f9fd, sky: 0xbfd6ea },
  { id: 'lava', stage: 'lava', floor: ['#5a4640', '#514039'], line: 'rgba(255,122,42,0.3)', wall: 0x2e2220, wallGlow: 0xff5a1a, bush: 0xb04a2a, water: 0xff5a1a, waterGlow: true, apron: 0xff4a10, sky: 0x1a0605 },
  { id: 'forest', stage: 'forest', floor: ['#557a48', '#4d7141'], line: 'rgba(200,232,176,0.12)', wall: 0x6a5236, bush: 0x2f7a3a, water: 0x3a7a8a, apron: 0x1d2a19, sky: 0x26352f },
  { id: 'river', stage: 'river', floor: ['#b0805a', '#a47652'], line: 'rgba(255,224,176,0.25)', wall: 0x5a3e26, bush: 0x5a8a3a, water: 0x3a5a9a, apron: 0x2a4a7a, sky: 0xe98a5a },
  { id: 'cyber', stage: 'cyber', floor: ['#3a2a52', '#33244a'], line: 'rgba(255,43,214,0.45)', wall: 0x2a1e3a, wallGlow: 0x2bf0ff, bush: 0xff2bd6, bushGlow: true, water: 0x2bf0ff, waterGlow: true, apron: 0x0a0610, sky: 0x07030f },
  { id: 'space', stage: 'space', floor: ['#34405e', '#2e3955'], line: 'rgba(47,216,255,0.4)', wall: 0x4a5674, wallGlow: 0x3ef0ff, bush: 0x3ef0ff, bushGlow: true, water: 0x0b1226, apron: 0x060912, sky: 0x03040c },
  { id: 'city', stage: 'city', floor: ['#5a5c66', '#53555f'], line: 'rgba(255,207,62,0.3)', wall: 0x8a8f98, wallGlow: 0xff3e8e, bush: 0x4a8a4a, water: 0x3a5a7a, apron: 0x16171d, sky: 0x0f1326 },
  { id: 'soccer', stage: 'soccer', floor: ['#3fa04a', '#379142'], line: 'rgba(255,255,255,0.35)', wall: 0xe8e8ee, bush: 0x2f7a36, water: 0x3ac8ef, apron: 0x2f7a36, sky: 0x8cc8ff },
];
/** Dungeon Run's look: warm stone, brick walls, darkness all round */
const CRYPT: Theme = { id: 'crypt', name: 'The Crypt', floor: ['#7d6e5c', '#766754'], line: 'rgba(0,0,0,0.16)', wall: 0x6e4229, bush: 0x3a6a3a, water: 0x2a4a6a, apron: 0x050407, sky: 0x0a0806 };
/**
 * Dungeon Run's stages, deeper and deeper: each a fresh dungeon dressed after one of the arenas
 * (its floor, walls and glow), always in darkness, with its own torch fire and lamp
 */
interface DStage {
  theme: Theme;
  torch: number;
  lamp: number;
}
const dstage = (id: string, name: string, torch: number, lamp: number, o: Partial<Theme> = {}): DStage => {
  const t = THEMES.find((x) => x.id === id) ?? CRYPT;
  return { theme: { ...t, name, line: 'rgba(0,0,0,0.16)', apron: 0x050407, sky: 0x0a0806, ...o }, torch, lamp };
};
const DSTAGES: DStage[] = [
  { theme: CRYPT, torch: 0xffb040, lamp: 0xffb070 },
  dstage('snow', 'Frozen Caverns', 0x8ae8ff, 0xbfe8ff, { wall: 0x7aaed0 }),
  dstage('forest', 'Overgrown Ruins', 0x9aff6a, 0xd8ffb0),
  dstage('lava', 'Molten Depths', 0xff6a1a, 0xff8a4a, { apron: 0x200602 }),
  dstage('river', 'Sunken Grotto', 0x5ae0ff, 0xa8e8ff, { wall: 0x4a5a6a }),
  dstage('cyber', 'Neon Vault', 0xff2bd6, 0xd890ff),
  dstage('space', 'Star Vault', 0x3ef0ff, 0xa8f4ff),
];
/** a dungeon stage's name (1 to 7) */
export const dungeonStageName = (n: number) => DSTAGES[Math.max(0, n - 1)]?.theme.name ?? 'The Crypt';
const themeName = (t: Theme) => t.name ?? stageById(t.stage ?? '').name;
/** the camera, shared with the other modes' setting: far (overhead), mid, near, and first (just behind your fighter) */
export type ActionView = 'far' | 'mid' | 'near' | 'first';
const VIEWS: ActionView[] = ['near', 'mid', 'far', 'first'];
/** the views in play: the shared ones, and Dungeon Run's own TPS (close behind your fighter, turning with it) */
type Cam = ActionView | 'tps';
const VIEW_LABEL: Record<Cam, string> = { near: 'NEAR', mid: 'MID', far: 'FAR', first: 'COCKPIT', tps: 'TPS' };
/** the views from just behind your fighter: they see the sky, and turn the aim stick with the camera */
const behind = (v: Cam) => v === 'first' || v === 'tps';
/** TPS steering: a full push across turns you this fast (radians a second) */
const TPS_TURN = 3.2;
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** a fighter's marble as the main game has it (Arena rules magazines and balance) */
const marbleOf = (def: CharacterDef) => {
  const key = (def.base ?? def.id).replace(/-\d+$/, '');
  const type: MarbleType = MARBLE_OF[key] ?? 'standard';
  return { key, type, ...MARBLES[type], mag: MAG_ARENA_OF[key] ?? MAG_ARENA[type], balance: BALANCE_ARENA[key] ?? 1 };
};
const baseOf = (def: CharacterDef) => (def.base ?? def.id).replace(/-\d+$/, '');

/** the Gauntlet's upgrades, one picked from three after each room */
const UPGRADES = [
  { id: 'power', name: 'Power Marbles', text: '+20% damage' },
  { id: 'rapid', name: 'Quick Hands', text: 'Fire and reload 20% faster' },
  { id: 'multi', name: 'Double Barrel', text: 'Every shot fires two marbles side by side' },
  { id: 'fan', name: 'Side Shots', text: '+2 marbles angled to the sides' },
  { id: 'bounce', name: 'Ricochet', text: 'Marbles bounce off walls once more' },
  { id: 'pierce', name: 'Piercing', text: 'Marbles pass through one more fighter' },
  { id: 'vital', name: 'Armour Plating', text: '+25% max health, and heal 25%' },
  { id: 'swift', name: 'Boosters', text: 'Move 15% faster' },
  { id: 'leech', name: 'Drain', text: 'Heal 8% of the damage you deal' },
] as const;
type UpgradeId = (typeof UPGRADES)[number]['id'];

type Pose = ReturnType<typeof pose>;
/** a fake shooter for driving a ShooterMesh's own walk and fire animation */
const pose = () => ({ x: 0, y: 0, team: 0, aim: 0, shieldUp: false, recoil: 0, windT: 9, kickT: 9, hand: 1, lastHand: 1, wobble: 0, vx: 0, flash: 0, stagger: 0, health: 100, heavyT: 9, firing: false, stored: 0 });

interface Unit {
  def: CharacterDef;
  mesh: ShooterMesh;
  wrap: THREE.Group;
  shadow: THREE.Mesh;
  pose: Pose;
  bar: HTMLElement;
  cpu: boolean;
  team: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  face: number;
  r: number;
  hp: number;
  max: number;
  speed: number;
  /** one marble's damage, and a multiplier on it and the special (upgrades, cubes, a boss) */
  dmg: number;
  power: number;
  // the magazine, as in the main game: fires one marble per interval while held, refills when it stops
  mag: number;
  ammo: number;
  fireInt: number;
  refill: number;
  fireT: number;
  firing: boolean;
  aim: number;
  idle: number;
  /** a tap's short auto-aimed burst (seconds left) */
  burst: number;
  // the main game's shooting habits: which hand fires, a gun tossed between hands, the wind-up
  // punch, the bite, a head that sweeps side to side
  hand: number;
  lastHand: number;
  tripleN: number;
  swapN: number;
  swapT: number;
  biteN: number;
  windLeft: number;
  wobble: number;
  wobbleN: number;
  // the charge shot, as in the main game: a held trigger stores marbles, letting go fires them as one
  chargeHold: number;
  stored: number;
  /** this press already fired its one shot (a press fires once; holding on charges) */
  pressShot: boolean;
  /** the CPU's plan: how many to store before it lets go (0: not charging) */
  chargeWant: number;
  shotSpeed: number;
  shotR: number;
  range: number;
  bounce: number;
  spirit: SpiritKind;
  charge: number;
  marble: MarbleType;
  alive: boolean;
  /** seconds it stays seen after firing or being hit, even in a bush */
  reveal: number;
  /** seconds since it was last hurt */
  calm: number;
  /** seconds it has stood still without firing (mending after a moment) */
  still: number;
  /** frozen (slowed) and stunned (can't move or fire) */
  slowT: number;
  stunT: number;
  /** a special's balls still to leave (a barrage, a chain) */
  queue: { t: number; angle: number; o: Partial<Shot> }[];
  cubes: number;
  boss: boolean;
  // the CPU's mind
  think: number;
  target: Unit | null;
  aimDelay: number;
  strafe: number;
  strafeT: number;
  goal: { x: number; z: number } | null;
  /** the next tile on its way round the walls (null: the way is straight) */
  step: { x: number; z: number } | null;
  aimError: number;
  /** the CPU holding back to let its magazine refill */
  reloading: boolean;
  /** the CPU's trigger rhythm: firing for a while, then a breath */
  cycle: number;
  /** Siege: seconds until it's back at its fortress after a knockout */
  back: number;
  /** an item picked up from a crate: its next shot is a Dragon Shot or a Steel Ball */
  item: 'dragon' | 'steel' | null;
  /** health mended since the last +HP pop, and time to the next one */
  healed: number;
  healT: number;
  /** its special's power-up pose, as in the other modes: seconds in, and how long it lasts (-1: not posing) */
  spT: number;
  spLen: number;
  /** Boss Fight's giant */
  giant: boolean;
}
interface Fort {
  team: number;
  x: number;
  z: number;
  hp: number;
  max: number;
  root: THREE.Group;
  turret: THREE.Object3D;
  bar: HTMLElement;
  fireT: number;
  flash: number;
  /** its turret's marbles go out in a hidden gunner's name (so hits, gauges and teams all just work) */
  gun: Unit;
  /** the tiles it stands on */
  tiles: number[];
}
interface Shot {
  x: number;
  z: number;
  vx: number;
  vz: number;
  owner: Unit;
  dmg: number;
  r: number;
  left: number;
  bounce: number;
  pierce: number;
  hit: Set<Unit>;
  color: THREE.Color;
  big: boolean;
  // a special's ball
  spirit?: boolean;
  head?: number;
  speed?: number;
  /** homing turn rate (rad/s), the one it homes on, and seconds before it starts turning */
  home?: number;
  tgt?: Unit | null;
  recover?: number;
  age?: number;
  weave?: boolean;
  /** splits into three once this much range is left */
  splitAt?: number;
  /** only homes once it has banked off a wall */
  bank?: boolean;
  banked?: boolean;
  /** flies over everything and lands on the spot, hitting all round it */
  dive?: number;
  effect?: 'drain' | 'frost' | 'quake';
}
/** what a crate (or a knocked-out fighter) leaves: a power cube, or one of the main game's items */
type DropKind = 'cube' | 'heal' | 'dragon' | 'steel' | 'special';
type Drop = { x: number; z: number; kind: DropKind; mesh: THREE.Object3D };
const DROP_NAME: Record<DropKind, string> = { cube: 'POWER UP', heal: 'REPAIR', dragon: 'DRAGON SHOT', steel: 'STEEL BALL', special: 'SPECIAL FULL' };
/** a crate's item, by weight (the free-for-all's crates hold power cubes) */
/** an item crate's colour: the main game's item colours */
const ITEM_COLOR: Record<Exclude<DropKind, 'cube'>, number> = { heal: ITEMS.heal.color, dragon: ITEMS.dragon.color, steel: ITEMS.missile.color, special: 0xffd23e };
/** the main game's item crates: they drop in from above, take two hits, and the item goes to whoever breaks one */
interface ItemBox {
  kind: Exclude<DropKind, 'cube'>;
  x: number;
  z: number;
  hp: number;
  life: number;
  age: number;
  flash: number;
  root: THREE.Group;
  marker: THREE.Mesh;
}
const CRATE_ITEMS: [DropKind, number][] = [
  ['heal', 0.3],
  ['dragon', 0.25],
  ['steel', 0.25],
  ['special', 0.2],
];
type Pop = { el: HTMLElement; x: number; z: number; t: number };
/** Dungeon Run: a trap at work */
type TrapRt =
  | { kind: 'spikes'; tiles: number[]; phase: number; mesh: THREE.Object3D; blades: THREE.Object3D[]; cyc: number; hit: Set<Unit> }
  | { kind: 'axe'; x: number; z: number; along: 'i' | 'j'; phase: number; arm: THREE.Object3D }
  | { kind: 'boulder'; x0: number; z0: number; x1: number; z1: number; phase: number; mesh: THREE.Object3D; rock: THREE.Object3D; rolling: boolean };
type Chest = { x: number; z: number; open: boolean; root: THREE.Object3D; lid: THREE.Object3D; gear: Gear; t: number };
type Loot = { x: number; z: number; gear: Gear; root: THREE.Object3D; gem: THREE.Object3D; away: boolean };
/** a knocked-out fighter blowing apart, as in the other modes: three pops, then it shatters into tumbling, smoking pieces */
interface Wreck {
  u: Unit;
  mesh: ShooterMesh;
  t: number;
  pops: number;
  shattered: boolean;
  debris: { mesh: THREE.Mesh; v: THREE.Vector3; spin: THREE.Vector3; smoke: number }[];
}
/** a spark or a puff of smoke */
type Spark = { mesh: THREE.Mesh; v: THREE.Vector3; life: number; max: number; float: boolean; trail?: boolean };
/** a one-off effect in the world (a shockwave ring, a pillar of light): k runs 0 to 1 over its life */
type Fx = { mesh: THREE.Mesh; t: number; life: number; step: (k: number, m: THREE.Mesh) => void };

export class ActionMode {
  private el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private ink: InkOnly;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200);
  private world = new THREE.Group();
  private hud: Record<string, HTMLElement> = {};
  private raf = 0;
  private last = 0;
  private running = false;
  private unitId: string;

  private kind: ActionKind = 'gauntlet';
  /** a League Story chapter being played (null: Action on its own) */
  private story: StoryFight | null = null;
  private W = 11;
  private H = 17;
  private grid = new Uint8Array(0);
  private crateHp = new Map<number, number>();
  private crateMesh = new Map<number, THREE.Object3D>();
  /** Siege: broken crates, back after a while (tile, seconds left) */
  private crateBack: { k: number; t: number }[] = [];
  private gateMeshes: THREE.Object3D[] = [];
  private units: Unit[] = [];
  private forts: Fort[] = [];
  /** Siege: what your marbles have knocked off their fortress */
  private fortDealt = 0;
  private me: Unit | null = null;
  private shots: Shot[] = [];
  private drops: Drop[] = [];
  private boxes: ItemBox[] = [];
  private wrecks: Wreck[] = [];
  private sparks: Spark[] = [];
  private sparkGeo = new THREE.BoxGeometry(1, 1, 1);
  private sparkMats = new Map<number, THREE.MeshBasicMaterial>();
  private fxs: Fx[] = [];
  /** the ring on the floor under a fighter charging (gold) or mending (green) */
  private auras = new Map<Unit, THREE.Mesh>();
  /** the camera pushing in: for your special, and while you charge */
  private punch = 0;
  /** your special's cinematic: close behind you for the pose, then back to your view (spMax: a safety cut-off) */
  private spCine = false;
  private spMax = 0;
  private spYaw = 0;
  /** seconds to the next item crate */
  private boxT = DROP.first;
  /** charging: a ball of light at the muzzle of whoever's charging (one each, made as needed) */
  private orbs = new Map<Unit, THREE.Group>();
  private hemi!: THREE.HemisphereLight;
  private sun!: THREE.DirectionalLight;
  private dim = 0;
  private pops: Pop[] = [];
  private time = 0;
  private over = true;
  private paused = false;
  /** which panel is up (the gear card and the upgrade pick close with FIRE) */
  private panelKind: string | null = null;
  private panelAt = 0;
  private room = 1;
  private cleared = false;
  private ups: Partial<Record<UpgradeId, number>> = {};
  // Dungeon Run: the map, the room you're fighting in, what you've seen, your launcher, the key
  private dg: Dungeon | null = null;
  private activeRoom: DRoom | null = null;
  private seen = new Uint8Array(0);
  private seenT = 0;
  private mapT = 0;
  private gear: Gear = STARTER;
  private rageT = 0;
  private hasKey = false;
  /** Dungeon Run: lives left, and where you come back (the middle of the last room you cleared) */
  private lives = 4;
  /** Dungeon Run: which stage you're on (1-based), and the rooms cleared before it */
  private stage = 1;
  private stageRooms = 0;
  private checkpoint = { x: 0, z: 0 };
  private lockMeshes: THREE.Object3D[] = [];
  private doorMeshes: THREE.Object3D[] = [];
  private chests: Chest[] = [];
  private loot: Loot[] = [];
  private lootOpen: Loot | null = null;
  private keyItem: { x: number; z: number; root: THREE.Object3D } | null = null;
  private traps: TrapRt[] = [];
  private trapHit = new Map<Unit, number>();
  private lockedT = 0;
  private lamp: THREE.PointLight | null = null;
  private lightK = 1;
  private storm = 0;
  private stormMesh: THREE.Mesh[] = [];
  private bushMat = new THREE.MeshStandardMaterial({ color: 0x3fae4a, roughness: 0.9, transparent: true });
  /** this stage's look, and the Gauntlet run's order of them */
  private theme: Theme = THEMES[0];
  private themeOrder: Theme[] = [];
  private shake = 0;
  /** a beat of slow motion as your special goes */
  private slowT = 0;
  /** the lock-on ring: on whoever your special will go for once it's charged, and on its target while it flies */
  private lockRing!: THREE.Group;
  private lockOn: Unit | null = null;
  /** who your charged shot is going for (marked while you charge) */
  private chargeTarget: Unit | null = null;
  private aimRing!: THREE.Group;
  private lockShow = 0;
  /** the camera, eased toward where the view puts it */
  private camPos = new THREE.Vector3();
  private camAt = new THREE.Vector3();
  private camSnap = true;
  /** which way the cockpit view looks (set as each stage starts, so the stick stays put); TPS turns it with you */
  private camYaw = 0;
  /** TPS: how fast the camera is swinging round (it eases into and out of a turn), and a view change's glide (s left) */
  private yawVel = 0;
  private lastFace = 0;
  private camGlide = 0;
  private localView: ActionView = 'mid';
  /** Dungeon Run's TPS view is on (kept here, not in the camera setting the other modes share) */
  private tps = false;
  private skyFor: Theme | null = null;
  private lift = 0;
  private vw = 1;
  private vh = 1;
  /** the cockpit view's sky (the ink pass leaves an empty background black) */
  private skyDome = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 12), new THREE.MeshBasicMaterial({ color: 0x8fcff0, side: THREE.BackSide, fog: false }));

  // shots drawn as instances
  private shotMesh: THREE.InstancedMesh;
  private haloMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private aimGuide: THREE.Mesh;

  // input
  private keys = new Set<string>();
  /** the mouse held down (firing at the cursor), Space held (firing at the nearest) */
  private mouseFire = false;
  private keyFire = false;
  private mouseAt = { x: 0, y: 0 };
  private moveStick: { id: number; x0: number; y0: number; x: number; y: number } | null = null;
  private aimStick: { id: number; x0: number; y0: number; x: number; y: number; t0: number; big: boolean } | null = null;

  constructor(
    host: HTMLElement,
    private opts: { unit: string; skin?: (id: string) => CharacterDef; onExit: () => void; reward?: (box: HTMLElement, unit: string, gain: number) => void; camera?: () => ActionView; setCamera?: (v: ActionView) => void; cpuCharge?: () => boolean; allyCharge?: () => boolean; landscape?: () => boolean; lock?: () => boolean; saver?: () => boolean; vibrate?: (pattern: number | number[]) => void },
  ) {
    this.unitId = opts.unit;
    this.el = document.createElement('div');
    this.el.id = 'action';
    this.el.className = 'hidden';
    this.el.innerHTML = `
      <canvas></canvas>
      <div class="ac-flash"></div>
      <div class="ac-fade"></div>
      <div class="ac-vignette"></div>
      <div class="ac-speed"></div>
      <div class="ac-bars"></div>
      <canvas class="ac-map" aria-hidden="true"></canvas>
      <div class="ac-hud">
        <div class="ac-top">
          <div class="ac-left"><button class="ac-quit key round" aria-label="Back">✕</button></div>
          <div class="ac-title"><b></b><span></span></div>
          <div class="ac-score"><b>0</b><span>KOS</span></div>
        </div>
        <div class="ac-bossbar" aria-hidden="true"><b></b><i><s></s><u></u></i></div>
        <p class="ac-goal hidden"></p>
        <div class="ac-say" aria-live="polite"><b></b><p></p></div>
        <p class="ac-respawn" aria-live="polite"><small>RESPAWN IN</small><b></b></p>
        <p class="ac-callout"></p>
        <p class="ac-supername"></p>
        <p class="ac-hint gone"></p>
      </div>
      <div class="charge-meter ac-charge" aria-hidden="true">
        <b>HOLD TO CHARGE</b>
        <div class="charge-segs"><i></i><i></i><i></i><i></i><i></i></div>
      </div>
      <div class="ac-tray">
        <div class="pad-dir ac-joy" aria-label="Move"><div class="ac-move"><i></i></div></div>
        <div class="pad-right ac-right">
          <!-- the view switch, where the other modes keep it: on top of the right thumb's group -->
          <button class="icon-btn view ac-view" aria-label="Switch view">NEAR</button>
          <button class="ac-special" aria-label="Special move">SPECIAL</button>
          <button class="pad-btn fire ac-fire" aria-label="Fire">FIRE</button>
        </div>
        <!-- the team modes: take over a teammate (its face shows who's next) -->
        <button class="ac-swap" aria-label="Switch fighter"><img alt="" /><span>SWITCH</span></button>
      </div>
      <div class="ac-panel">
        <h2>Action</h2>
        <p class="ac-unit"></p>
        <p class="ac-text"></p>
        <div class="ac-cards"></div>
        <div class="xp-gain ac-xp hidden"></div>
        <p class="ac-best"></p>
        <div class="ac-buttons"></div>
      </div>`;
    host.appendChild(this.el);
    this.canvas = this.el.querySelector('canvas')!;
    for (const k of ['say', 'swap', 'respawn', 'goal', 'bossbar', 'fade', 'bars', 'title', 'score', 'callout', 'supername', 'flash', 'vignette', 'speed', 'hint', 'panel', 'special', 'fire', 'charge']) this.hud[k] = this.el.querySelector(`.ac-${k}`)!;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.scene.environment = studioEnv(this.renderer);
    this.scene.environmentIntensity = 0.4;
    this.ink = new InkOnly(this.renderer, this.scene, this.camera);
    this.hemi = new THREE.HemisphereLight(0xeef4ff, 0x4a5a3a, 1.5);
    this.scene.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight(0xffffff, 2));
    sun.position.set(-6, 14, 5);
    this.scene.add(sun, this.world);

    this.shotMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), 300);
    this.shotMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(300 * 3), 3);
    this.shotMesh.frustumCulled = false;
    this.scene.add(this.shotMesh);
    this.haloMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }), 60);
    this.haloMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(60 * 3), 3);
    this.haloMesh.frustumCulled = false;
    this.haloMesh.count = 0;
    this.scene.add(this.haloMesh);
    const guide = new THREE.PlaneGeometry(1, 1);
    guide.translate(0, 0.5, 0);
    guide.rotateX(-Math.PI / 2);
    this.aimGuide = new THREE.Mesh(guide, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
    this.aimGuide.visible = false;
    this.scene.add(this.aimGuide);
    this.skyDome.visible = false;
    this.scene.add(this.skyDome);
    // the lock-on: a gold ring on the floor with four pointers, drawn over everything
    this.lockRing = new THREE.Group();
    const lockMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.95, depthTest: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.74, 40), lockMat);
    ring.rotation.x = -Math.PI / 2;
    this.lockRing.add(ring);
    for (let k = 0; k < 4; k++) {
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.32), lockMat);
      tick.rotation.x = -Math.PI / 2;
      const a = (k * Math.PI) / 2;
      tick.position.set(Math.sin(a) * 0.95, 0, Math.cos(a) * 0.95);
      tick.rotation.z = a;
      this.lockRing.add(tick);
    }
    this.lockRing.renderOrder = 5;
    this.lockRing.traverse((o) => (o.renderOrder = 5));
    this.lockRing.visible = false;
    this.scene.add(this.lockRing);
    // the charge target: a red crosshair on the floor, its corners closing in as the charge builds
    this.aimRing = new THREE.Group();
    const aimMat = new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.95, depthTest: false });
    const aring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.58, 40), aimMat);
    aring.rotation.x = -Math.PI / 2;
    this.aimRing.add(aring);
    for (let k = 0; k < 4; k++) {
      const corner = new THREE.Group();
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      for (const [w, d, ox, oz] of [
        [0.26, 0.07, 0.1, 0],
        [0.07, 0.26, 0, 0.1],
      ]) {
        const bar = new THREE.Mesh(new THREE.PlaneGeometry(w, d), aimMat);
        bar.rotation.x = -Math.PI / 2;
        bar.position.set(ox, 0, oz);
        corner.add(bar);
      }
      corner.rotation.y = -a + Math.PI / 4;
      corner.position.set(Math.sin(a) * 0.85, 0, Math.cos(a) * 0.85);
      corner.name = 'corner';
      this.aimRing.add(corner);
    }
    this.aimRing.traverse((o) => (o.renderOrder = 6));
    this.aimRing.visible = false;
    this.scene.add(this.aimRing);

    this.el.querySelector('.ac-quit')!.addEventListener('click', () => this.exit());
    this.el.querySelector('.ac-view')!.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.cycleView();
    });
    this.hud.swap.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.switchFighter();
    });
    this.canvas.addEventListener('pointerdown', this.down);
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.hud.special.addEventListener('pointerdown', this.specialDown);
    this.hud.fire.addEventListener('pointerdown', this.fireDown);
    window.addEventListener('pointermove', this.pmove);
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', this.keyup);
    window.addEventListener('resize', this.resize);
  }

  // ---------- lifecycle ----------

  /** play a League Story chapter: straight into its fight, and back to the story when it's over */
  startStory(unit: string, f: StoryFight) {
    this.open(unit);
    this.story = f;
    this.begin(f.kind);
  }
  /** the story chapter is over: leave, and let the story carry on (or not) */
  private endStory(win: boolean) {
    const f = this.story;
    this.story = null;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.clearStage();
    this.el.classList.add('hidden');
    this.goWide(false);
    f?.onEnd(win);
  }

  /** show the start panel with this fighter */
  open(unit: string) {
    this.story = null;
    this.unitId = unit;
    this.applySaver();
    this.goWide(!!this.opts.landscape?.());
    this.showView();
    this.camSnap = true;
    this.el.classList.remove('hidden');
    this.over = true;
    this.clearStage();
    this.kind = 'gauntlet';
    this.buildStage();
    (this.el.querySelector('.ac-map') as HTMLElement).classList.remove('on');
    this.spawnMe();
    this.showPanel('start');
    this.resize();
    this.running = true;
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
  }

  private exit() {
    clearTimeout(this.hintTimer);
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.clearStage();
    this.el.classList.add('hidden');
    this.goWide(false);
    this.opts.onExit();
  }

  /**
   * landscape: the whole window rather than the portrait column, and (where the phone allows it:
   * Android, in fullscreen) turned on its side; back again on the way out
   */
  private wideLock = false;
  private goWide(on: boolean) {
    this.el.classList.toggle('wide', on);
    const orient = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    if (on && !this.wideLock && orient?.lock && (this.opts.lock?.() ?? true)) {
      const fs = document.fullscreenElement ? Promise.resolve() : document.documentElement.requestFullscreen?.() ?? Promise.resolve();
      fs.then(() => orient.lock!('landscape'))
        .then(() => (this.wideLock = true))
        .catch(() => {
          // (not allowed here: iPhones, desktop) — it's still the full window, turn the phone by hand
        });
    } else if (!on && this.wideLock) {
      this.wideLock = false;
      try {
        orient.unlock();
      } catch {
        // nothing to unlock
      }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
    requestAnimationFrame(() => this.resize());
  }

  get active() {
    return this.running;
  }
  /** League Story: the chapter's foe and you, for the foe's lines during the fight (null while it isn't on) */
  storyFeed() {
    const me = this.me;
    if (!this.story || !this.running || this.over || this.paused || !me) return null;
    const id = this.story.boss ?? this.story.foes?.[0];
    const foe = this.units.find((u) => u.def.id === id && u.team !== me.team);
    if (!foe) return null;
    return { foeFrac: foe.alive ? foe.hp / foe.max : 0, meFrac: me.alive ? me.hp / me.max : 0, action: true };
  }
  /** the music this fight wants: Dungeon Run's own, or the arena's (a theme id or its stage) */
  get musicStage() {
    return this.kind === 'gauntlet' ? 'dungeon' : (this.theme.stage ?? this.theme.id);
  }
  /** a boss is up (for the music) */
  get bossOn() {
    return !this.over && this.units.some((u) => u.boss && u.alive);
  }

  /** straight into a mode (from the home screen), past Action's own menu */
  start(kind: ActionKind) {
    this.begin(kind);
  }

  private begin(kind: ActionKind) {
    sfx.unlock();
    this.kind = kind;
    // (TPS is Dungeon Run's alone: the view button says which view this mode is in)
    this.showView();
    this.room = 1;
    this.ups = {};
    this.kos = 0;
    this.time = 0;
    this.fortDealt = 0;
    this.warned = false;
    this.zoneScore = [0, 0];
    this.zoneHold = -1;
    this.kRound = 1;
    this.kWins = [0, 0];
    this.kRoundT = 0;
    this.kBreak = 0;
    this.giantPhase = 0;
    this.gear = STARTER;
    this.rageT = 0;
    this.lives = this.story ? 3 : 4;
    this.meBack = 0;
    this.swapAt = 0;
    this.says = [];
    this.sayT = 0;
    this.hud.say.classList.remove('on');
    this.roomSaid = this.bossTalked = false;
    this.stage = this.story?.stage ?? 1;
    this.stageRooms = 0;
    this.startStage();
    this.showPanel(null);
    this.hud.goal.textContent = this.story?.goal ? `OBJECTIVE · ${this.story.goal}` : '';
    this.hud.goal.classList.toggle('hidden', !this.story?.goal);
    this.teachControls();
    if (this.story?.says && kind === 'gauntlet') setTimeout(() => !this.over && this.storySay(this.story?.says?.enter), 1000);
  }

  /** the controls, one rule at a time (your first few fights; after that you know them) */
  private hintTimer = 0;
  private teachControls() {
    clearTimeout(this.hintTimer);
    const el = this.hud.hint;
    el.classList.add('gone');
    let seen = 0;
    try {
      seen = Number(localStorage.getItem(HINTS_KEY)) || 0;
      localStorage.setItem(HINTS_KEY, String(seen + 1));
    } catch {
      // storage unavailable: teach it each time
    }
    if (seen >= 3) return;
    let k = 0;
    const next = () => {
      if (k >= HINTS.length || this.over) return el.classList.add('gone');
      el.textContent = HINTS[k++];
      el.classList.remove('gone');
      this.hintTimer = window.setTimeout(() => {
        el.classList.add('gone');
        this.hintTimer = window.setTimeout(next, 350);
      }, 1900);
    };
    next();
  }

  private kos = 0;
  private startStage() {
    // (what you carry into the next Gauntlet room, read before the old room is cleared away:
    // your health, your special's gauge and an item you haven't used yet)
    const keep = this.me ? { hp: this.me.hp / this.me.max, charge: this.me.charge, item: this.me.item } : null;
    this.clearStage();
    this.camSnap = true;
    this.cleared = false;
    // a new look each time: a fresh shuffle for a new run (the Gauntlet walks through them room by room)
    if (this.kind !== 'gauntlet' || this.room === 1 || !this.themeOrder.length) this.themeOrder = [...THEMES].sort(() => Math.random() - 0.5);
    const storyTheme = this.story?.theme ? THEMES.find((t) => t.id === this.story!.theme) : undefined;
    this.theme = this.kind === 'gauntlet' ? this.dstage().theme : storyTheme ?? this.themeOrder[0];
    this.storm = this.kind === 'ffa' ? this.W / 2 : 99;
    this.time = this.kind === 'gauntlet' ? this.time : 0;
    this.buildStage();
    (this.el.querySelector('.ac-map') as HTMLElement).classList.toggle('on', this.kind === 'gauntlet');
    this.spawnMe();
    this.checkpoint = { x: this.me!.x, z: this.me!.z };
    if (keep && this.kind === 'gauntlet' && this.room > 1) {
      this.me!.hp = Math.max(1, this.me!.max * Math.min(1, keep.hp + 0.08));
      this.me!.charge = keep.charge;
      this.me!.item = keep.item;
    }
    this.spawnFoes();
    this.over = false;
    const where = themeName(this.theme).toUpperCase();
    const TEAM_NAME: Partial<Record<ActionKind, string>> = { knockout: 'TEAM KNOCKOUT · ROUND 1', zone: 'KING OF THE RING · HOLD IT', boss: 'GIANT SLAYER · TAKE IT DOWN' };
    this.callout(TEAM_NAME[this.kind] ? `${TEAM_NAME[this.kind]}` : this.kind === 'siege' ? `CASTLE CRASH · ${where}` : this.kind === 'ffa' ? `STORM BRAWL · ${where}` : `STAGE ${this.stage} · ${themeName(this.theme).toUpperCase()}`);
    sfx.play(this.isBossRoom() ? 'gong' : 'go');
    this.updateHud();
  }

  private isBossRoom() {
    return this.kind === 'gauntlet' && this.activeRoom?.kind === 'boss';
  }

  private clearStage() {
    for (const u of this.units) {
      u.mesh.dispose();
      u.bar.remove();
    }
    this.units = [];
    for (const f of this.forts) {
      f.bar.remove();
      f.gun.mesh.dispose();
    }
    this.forts = [];
    this.zoneDisc = this.zoneRing = null;
    this.giant = null;
    this.me = null;
    this.shots = [];
    for (const d of this.drops) d.mesh.removeFromParent();
    this.drops = [];
    for (const b of this.boxes) {
      b.root.removeFromParent();
      b.marker.removeFromParent();
    }
    this.boxes = [];
    this.boxT = DROP.first;
    for (const o of this.orbs.values()) o.removeFromParent();
    this.orbs.clear();
    for (const w of this.wrecks) this.dropWreck(w);
    this.wrecks = [];
    for (const sp of this.sparks) sp.mesh.removeFromParent();
    this.sparks = [];
    for (const f of this.fxs) f.mesh.removeFromParent();
    this.fxs = [];
    for (const a of this.auras.values()) a.removeFromParent();
    this.auras.clear();
    for (const p of this.pops) p.el.remove();
    this.pops = [];
    this.world.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) m.geometry.dispose();
    });
    this.world.clear();
    this.crateHp.clear();
    this.crateMesh.clear();
    this.crateBack = [];
    this.gateMeshes = [];
    this.stormMesh = [];
    this.lockMeshes = [];
    this.doorMeshes = [];
    this.wallMesh = this.stripMesh = null;
    this.torches = [];
    this.chests = [];
    this.loot = [];
    this.lootOpen = null;
    this.keyItem = null;
    this.traps = [];
    this.trapHit.clear();
    this.activeRoom = null;
    if (this.lamp) this.lamp.removeFromParent();
    this.lamp = null;
  }

  // ---------- the stage ----------

  private idx = (i: number, j: number) => j * this.W + i;
  private tileOf(x: number, z: number) {
    const i = Math.floor(x + this.W / 2);
    const j = Math.floor(z + this.H / 2);
    if (i < 0 || j < 0 || i >= this.W || j >= this.H) return -1;
    return this.idx(i, j);
  }
  private tile(x: number, z: number) {
    const k = this.tileOf(x, z);
    return k < 0 ? WALL : this.grid[k];
  }
  private center(i: number, j: number) {
    return { x: i - this.W / 2 + 0.5, z: j - this.H / 2 + 0.5 };
  }
  private blocksMove = (t: number) => t === WALL || t === CRATE || t === WATER || t === GATE || t === FORT || t === ROCK;
  private blocksShot = (t: number) => t === WALL || t === CRATE || t === GATE || t === FORT || t === ROCK;

  private buildStage() {
    if (this.kind === 'ffa') {
      this.W = this.H = 28;
      this.layoutFfa();
    } else if (this.teams) {
      this.W = 15;
      this.H = this.kind === 'boss' ? 21 : 25;
      this.layoutSiege();
    } else {
      this.theme = this.dstage().theme;
      this.layoutDungeon();
    }
    this.lightK = 1;
    this.drawStage();
  }

  /** Dungeon Run: a fresh dungeon (see dungeon.ts); the boss room's door is locked */
  private layoutDungeon() {
    // (rolled until it has one of each trap and a key room, so every run shows the lot)
    let dg = makeDungeon(Math.random, this.story?.rooms);
    for (let n = 0; n < 30; n++) {
      const has = (k: string) => dg.traps.some((t) => t.kind === k);
      if (has('boulder') && has('axe') && has('spikes') && dg.rooms.some((r) => r.kind === 'key')) break;
      dg = makeDungeon(Math.random, this.story?.rooms);
    }
    this.dg = dg;
    this.W = dg.W;
    this.H = dg.H;
    this.grid = dg.grid as typeof this.grid;
    for (let k = 0; k < this.grid.length; k++) if (this.grid[k] === CRATE) this.crateHp.set(k, CRATE_HP);
    for (const k of dg.lock) this.grid[k] = GATE;
    this.seen = new Uint8Array(this.W * this.H);
    this.activeRoom = null;
    this.hasKey = false;
  }
  /** how tall the walls stand (the dungeon's are higher) */
  private wallH() {
    // (the dungeon's walls rise in the views from behind you, TPS and the cockpit, so its corridors close in
    // round you; seen from above they stay low)
    return this.kind === 'gauntlet' && behind(this.view) ? 2.1 : 1.1;
  }
  private wallCur = 1.1;
  /**
   * the views from behind you: a wall between the camera and your fighter turns see-through, as a
   * bush does when you're in it (blended, not cut away, so no outline rings the spot), in a
   * soft-edged tube from the camera to you
   */
  private fadeU = { uFadeA: { value: new THREE.Vector3() }, uFadeB: { value: new THREE.Vector3() }, uFadeR: { value: 2.1 }, uFadeOn: { value: 0 } };
  private seeThrough<M extends THREE.Material>(mat: M): M {
    // (drawn after the solid things so what's behind shows through; everywhere else it's fully opaque)
    mat.transparent = true;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.fadeU);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSeeW;')
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          #ifdef USE_INSTANCING
            vSeeW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          #else
            vSeeW = (modelMatrix * vec4(transformed, 1.0)).xyz;
          #endif`,
        );
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSeeW;\nuniform vec3 uFadeA;\nuniform vec3 uFadeB;\nuniform float uFadeR;\nuniform float uFadeOn;')
        .replace(
          'void main() {',
          `void main() {
          if (uFadeOn > 0.0) {
            vec3 ab = uFadeB - uFadeA;
            float t = clamp(dot(vSeeW - uFadeA, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
            float d = length(vSeeW - (uFadeA + ab * t));
            // (a tube from the camera to just short of you: fully open in the middle, easing out at its edge)
            seeK = uFadeOn * (1.0 - smoothstep(uFadeR * 0.55, uFadeR, d)) * (1.0 - smoothstep(0.9, 1.0, t));
          }`,
        )
        .replace('void main() {', 'float seeK = 0.0;\nvoid main() {')
        // (as see-through as a bush you stand in)
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= 1.0 - seeK * 0.55;');
    };
    return mat;
  }
  private wallMesh: THREE.Object3D | null = null;
  private stripMesh: THREE.Object3D | null = null;
  private torches: THREE.Object3D[] = [];
  /** the walls ease to the height the view wants (and the doors, glow strips and torches with them) */
  private tickWalls(dt: number) {
    const want = this.wallH();
    if (Math.abs(want - this.wallCur) < 0.002) {
      if (this.wallCur === want) return;
      this.wallCur = want;
    } else this.wallCur += (want - this.wallCur) * (1 - Math.exp(-dt * 8));
    const h = this.wallCur;
    if (this.wallMesh) this.wallMesh.scale.y = h;
    if (this.stripMesh) this.stripMesh.position.y = h;
    for (const b of [...this.doorMeshes, ...this.lockMeshes, ...this.gateMeshes]) b.scale.y = h;
    // (torches ride up with a taller wall, so the flame stays up near its top)
    for (const t of this.torches) t.position.y = (h - 1.1) * 0.36;
    // the flames dance
    for (const t of this.torches) {
      const s = t.userData.seed as number;
      const k = 1 + Math.sin(this.time * 13 + s) * 0.14 + Math.sin(this.time * 29 + s * 2) * 0.1;
      if (t.children[1]) t.children[1].scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k));
      if (t.children[2]) t.children[2].scale.setScalar(0.9 + (k - 1) * 0.9);
    }
  }
  private dstage() {
    return DSTAGES[Math.min(this.stage, DSTAGES.length) - 1];
  }
  /** how many rooms there are to fight through, and how many are done */
  private fightRooms() {
    return this.dg?.rooms.filter((r) => r.kind === 'fight' || r.kind === 'key' || r.kind === 'boss').length ?? 0;
  }

  /** the free-for-all stage: four mirrored quarters of walls, bushes, crates and a pond */
  private layoutFfa() {
    const { W, H } = this;
    const g = (this.grid = new Uint8Array(W * H));
    const half = W / 2;
    const put = (i: number, j: number, t: number) => {
      // (i, j) in the top-left quarter, mirrored into all four
      for (const [a, b] of [
        [i, j],
        [W - 1 - i, j],
        [i, H - 1 - j],
        [W - 1 - i, H - 1 - j],
      ]) {
        if (a < 0 || b < 0 || a >= W || b >= H) continue;
        g[this.idx(a, b)] = t;
        if (t === CRATE) this.crateHp.set(this.idx(a, b), CRATE_HP);
      }
    };
    for (let i = 0; i < W; i++) put(i, 0, WALL);
    for (let j = 0; j < H; j++) put(0, j, WALL);
    const rnd = (n: number) => Math.floor(Math.random() * n);
    const free = (i: number, j: number) => i >= 1 && j >= 1 && i < half && j < half && g[this.idx(i, j)] === FLOOR;
    // wall runs
    for (let n = 0; n < 6; n++) {
      const len = 2 + rnd(3);
      const across = Math.random() < 0.5;
      const i0 = 2 + rnd(half - 4);
      const j0 = 2 + rnd(half - 4);
      for (let k = 0; k < len; k++) {
        const i = across ? i0 + k : i0;
        const j = across ? j0 : j0 + k;
        if (free(i, j)) put(i, j, WALL);
      }
    }
    // bush patches
    for (let n = 0; n < 4; n++) {
      const i0 = 1 + rnd(half - 3);
      const j0 = 1 + rnd(half - 3);
      const w = 2 + rnd(2);
      const h = 2 + rnd(2);
      for (let i = i0; i < i0 + w; i++) for (let j = j0; j < j0 + h; j++) if (free(i, j)) put(i, j, BUSH);
    }
    // a pond near the middle
    const pi = half - 4 - rnd(2);
    const pj = half - 4 - rnd(2);
    for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (free(pi + di, pj + dj)) put(pi + di, pj + dj, WATER);
    // crates
    for (let n = 0; n < 3; n++) {
      const i = 2 + rnd(half - 3);
      const j = 2 + rnd(half - 3);
      if (free(i, j)) put(i, j, CRATE);
    }
    // clear ground round each start
    for (const s of this.ffaStarts()) {
      const i0 = Math.floor(s.x + W / 2);
      const j0 = Math.floor(s.z + H / 2);
      for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) if (i > 0 && j > 0 && i < W - 1 && j < H - 1) g[this.idx(i, j)] = FLOOR;
    }
  }

  /** a crate on tile k: a box with two bands (they all share one set of shapes and paints) */
  private crateParts?: { geo: THREE.BufferGeometry; band: THREE.BufferGeometry; mat: THREE.Material; bandMat: THREE.Material };
  private makeCrate(k: number) {
    const c = (this.crateParts ??= {
      geo: new THREE.BoxGeometry(0.86, 0.86, 0.86).translate(0, 0.43, 0),
      band: new THREE.BoxGeometry(0.9, 0.12, 0.9),
      mat: new THREE.MeshStandardMaterial({ color: 0xb87a3e, roughness: 0.8 }),
      bandMat: new THREE.MeshStandardMaterial({ color: 0x6a3f1e, roughness: 0.8 }),
    });
    const g = new THREE.Group();
    g.add(new THREE.Mesh(c.geo, c.mat));
    for (const y of [0.16, 0.7]) {
      const b = new THREE.Mesh(c.band, c.bandMat);
      b.position.y = y;
      g.add(b);
    }
    const j = Math.floor(k / this.W);
    const p = this.center(k - j * this.W, j);
    g.position.set(p.x, 0, p.z);
    this.world.add(g);
    this.crateMesh.set(k, g);
  }

  /** the Siege stage: your fortress at the bottom, theirs at the top, the same cover both ways round */
  private layoutSiege() {
    const { W, H } = this;
    const g = (this.grid = new Uint8Array(W * H));
    const put = (i: number, j: number, t: number) => {
      // (i, j) in the top half, turned through the middle onto the bottom half, and mirrored left to right
      for (const [a, b] of [
        [i, j],
        [W - 1 - i, j],
        [i, H - 1 - j],
        [W - 1 - i, H - 1 - j],
      ]) {
        if (a < 0 || b < 0 || a >= W || b >= H) continue;
        g[this.idx(a, b)] = t;
        if (t === CRATE) this.crateHp.set(this.idx(a, b), CRATE_HP);
      }
    };
    for (let i = 0; i < W; i++) put(i, 0, WALL);
    for (let j = 0; j < H; j++) put(0, j, WALL);
    const rnd = (n: number) => Math.floor(Math.random() * n);
    const mid = (W - 1) / 2;
    // walls guarding each fortress's flanks, cover out in the field, bushes down the sides
    put(mid - 4, 4, WALL);
    put(mid - 4, 5, WALL);
    for (let n = 0; n < 3; n++) {
      const i = 1 + rnd(mid - 1);
      const j = 7 + rnd(4);
      put(i, j, WALL);
      if (Math.random() < 0.5) put(i + 1, j, WALL);
      else put(i, j + 1, WALL);
    }
    for (let i = 1; i <= 2; i++) for (let j = 8; j <= 11; j++) if (g[this.idx(i, j)] === FLOOR) put(i, j, BUSH);
    for (let n = 0; n < 2; n++) {
      const i = 2 + rnd(mid - 2);
      const j = 6 + rnd(5);
      if (g[this.idx(i, j)] === FLOOR) put(i, j, CRATE);
    }
    // the middle row: a bush on each side of a crate pair, open lanes either side
    const cj = (H - 1) / 2;
    g[this.idx(mid - 1, cj)] = g[this.idx(mid + 1, cj)] = CRATE;
    this.crateHp.set(this.idx(mid - 1, cj), CRATE_HP);
    this.crateHp.set(this.idx(mid + 1, cj), CRATE_HP);
    for (const i of [2, 3, W - 3, W - 4]) g[this.idx(i, cj)] = BUSH;
    // clear ground in front of and round each fortress
    for (let i = 1; i < W - 1; i++)
      for (const j of [1, 2, 3, 4, 5, H - 2, H - 3, H - 4, H - 5, H - 6])
        if (Math.abs(i - mid) <= 3) g[this.idx(i, j)] = FLOOR;
    // Hot Zone: its ring kept clear; Boss Fight: a wide open middle to fight the giant in
    const clearR = this.kind === 'zone' ? ZONE_R + 0.8 : this.kind === 'boss' ? 4.5 : 0;
    if (clearR)
      for (let j = 1; j < H - 1; j++)
        for (let i = 1; i < W - 1; i++) {
          const c = this.center(i, j);
          if (Math.hypot(c.x, c.z) < clearR && g[this.idx(i, j)] !== FLOOR) {
            g[this.idx(i, j)] = FLOOR;
            this.crateHp.delete(this.idx(i, j));
          }
        }
    // the fortresses (Siege only): three tiles across, two deep
    if (this.kind !== 'siege') return;
    for (const [team, j0] of [
      [0, H - 4],
      [1, 2],
    ]) {
      const tiles: number[] = [];
      for (let i = mid - 1; i <= mid + 1; i++)
        for (let j = j0; j <= j0 + 1; j++) {
          g[this.idx(i, j)] = FORT;
          tiles.push(this.idx(i, j));
        }
      this.pendingForts.push({ team, z: j0 + 1 - H / 2, tiles });
    }
  }
  private pendingForts: { team: number; z: number; tiles: number[] }[] = [];
  // Hot Zone and Knockout's score, and the giant
  private zoneDisc: THREE.Mesh | null = null;
  private zoneRing: THREE.Mesh | null = null;
  private zoneScore = [0, 0];
  private zoneHold = -1;
  private kRound = 1;
  private kWins = [0, 0];
  private kRoundT = 0;
  private kBreak = 0;
  private giant: Unit | null = null;
  private giantPhase = 0;

  /** a fortress: a stone keep in its side's colours, with a turret on top that turns to shoot */
  private makeFort(team: number, z: number, tiles: number[]) {
    const color = TEAM_COLOR[team];
    const root = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.85 });
    const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a3448, roughness: 0.8 });
    const keep = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.3, 1.9), stone);
    keep.position.y = 0.65;
    root.add(keep);
    const band = new THREE.Mesh(new THREE.BoxGeometry(3, 0.22, 2), paint);
    band.position.y = 1.2;
    root.add(band);
    // battlements, and a tower at each corner with a pennant
    for (let k = -1; k <= 1; k += 2)
      for (let m = -1; m <= 1; m += 2) {
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 1.8, 10), stone);
        tower.position.set(k * 1.3, 0.9, m * 0.82);
        root.add(tower);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.55, 10), paint);
        cap.position.set(k * 1.3, 2.07, m * 0.82);
        root.add(cap);
      }
    for (let k = -2; k <= 2; k++) {
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.28), stone);
      merlon.position.set(k * 0.5, 1.43, team ? -0.86 : 0.86);
      root.add(merlon);
    }
    const gate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.1), dark);
    gate.position.set(0, 0.4, team ? 0.96 : -0.96);
    root.add(gate);
    // the turret: a drum and a barrel, turning as one
    const turret = new THREE.Group();
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.5, 14), paint);
    turret.add(drum);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.9, 10), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.05, -0.55);
    turret.add(barrel);
    turret.position.y = 1.55;
    turret.rotation.y = team ? Math.PI : 0;
    root.add(turret);
    root.position.set(0, 0, z);
    this.world.add(root);
    const bar = document.createElement('div');
    bar.className = 'ac-bar fort ' + (team === 0 ? 'ally' : 'foe');
    bar.innerHTML = `<span>${team === 0 ? 'YOUR FORTRESS' : 'THEIR FORTRESS'}</span><i><b></b></i>`;
    this.hud.bars.appendChild(bar);
    // (its gunner: a fighter of its side, never seen, never in the fight)
    const gun = this.makeUnit(playable()[0], 0, z, true, team, { dmg: 1 });
    this.units.pop();
    gun.wrap.visible = gun.shadow.visible = false;
    gun.bar.remove();
    gun.dmg = FORT_DMG;
    this.forts.push({ team, x: 0, z, hp: FORT_HP, max: FORT_HP, root, turret, bar, fireT: 1.5, flash: 0, gun, tiles });
  }
  private fortAt(key: number) {
    return this.forts.find((f) => f.tiles.includes(key)) ?? null;
  }
  private hurtFort(f: Fort, amount: number, from: Unit) {
    if (f.hp <= 0 || this.over) return;
    f.hp = Math.max(0, f.hp - amount);
    f.flash = 1;
    if (from === this.me) {
      this.fortDealt += amount;
      this.pop(f.x + (Math.random() - 0.5) * 1.5, f.z, `-${Math.round(amount)}`, 'hit');
    }
    // knocking at a fortress fills the gauge a little too
    if (from.alive) from.charge = Math.min(1, from.charge + 0.04);
    sfx.play('wall', from === this.me ? 0.45 : 0.2);
    if (f.hp <= 0) {
      this.shake = 0.6;
      sfx.play('explode', 1);
      f.root.scale.set(1, 0.35, 1);
      f.turret.visible = false;
      this.finishSiege(f.team === 0 ? -1 : 1);
    }
  }
  /** the fortress turrets: each fires on the nearest enemy in range it can see */
  private tickForts(dt: number) {
    for (const f of this.forts) {
      f.flash = Math.max(0, f.flash - dt * 5);
      if (f.hp <= 0) continue;
      f.fireT -= dt;
      let best: Unit | null = null;
      let bd = FORT_RANGE;
      for (const u of this.units) {
        if (u.team === f.team || !u.alive || !this.targetable(f.gun, u)) continue;
        const d = Math.hypot(u.x - f.x, u.z - f.z);
        if (d < bd && this.lineFrom(f, u.x, u.z)) {
          bd = d;
          best = u;
        }
      }
      if (!best) continue;
      const ang = Math.atan2(best.x - f.x, -(best.z - f.z));
      f.turret.rotation.y = -ang;
      if (f.fireT > 0) continue;
      f.fireT = FORT_FIRE;
      const lead = (bd / SHOT_SPEED) * 0.5;
      const a = Math.atan2(best.x + best.vx * lead - f.x, -(best.z + best.vz * lead - f.z)) + (Math.random() - 0.5) * 0.12;
      const sx = f.x + Math.sin(a) * 1.7;
      const sz = f.z - Math.cos(a) * 1.7;
      this.shots.push({ x: sx, z: sz, vx: Math.sin(a) * SHOT_SPEED, vz: -Math.cos(a) * SHOT_SPEED, owner: f.gun, dmg: FORT_DMG, r: 0.22, left: FORT_RANGE, bounce: 0, pierce: 0, hit: new Set(), color: new THREE.Color(TEAM_COLOR[f.team]), big: true });
      sfx.play('fire', 0.35);
    }
  }
  /** a clear line from just outside a fortress's walls to a spot */
  private lineFrom(f: Fort, x: number, z: number) {
    const a = Math.atan2(x - f.x, -(z - f.z));
    return this.clearLine(f.x + Math.sin(a) * 1.7, f.z - Math.cos(a) * 1.7, x, z);
  }
  /** the first thing a line runs into: a fortress (or null if it's open, or something else is in the way) */
  private fortOnLine(x0: number, z0: number, x1: number, z1: number) {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.ceil(d / 0.2);
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const key = this.tileOf(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
      const tile = key < 0 ? WALL : this.grid[key];
      if (tile === FORT) return this.fortAt(key);
      if (this.blocksShot(tile)) return null;
    }
    return null;
  }
  /** the three-on-three modes (Siege, Knockout, Hot Zone, Boss Fight): two sides, an end each */
  private get teams() {
    return this.kind === 'siege' || this.kind === 'knockout' || this.kind === 'zone' || this.kind === 'boss';
  }
  /** where a side starts (and comes back): by its fortress in Siege, at its own end otherwise */
  private teamSpot(team: number, k: number) {
    if (this.kind === 'siege') return this.siegeSpot(team, k);
    return { x: [0, -2.2, 2.2][k % 3], z: team === 0 ? this.H / 2 - 3 : -this.H / 2 + 3 };
  }
  /** Siege starts: your side at the bottom by your fortress, theirs at the top */
  private siegeSpot(team: number, k: number) {
    const f = this.forts.find((o) => o.team === team)!;
    return { x: [0, -2.2, 2.2][k % 3], z: f.z + (team === 0 ? -2.4 : 2.4) };
  }

  private ffaStarts() {
    return Array.from({ length: 6 }, (_, k) => {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 2;
      return { x: Math.cos(a) * 11, z: Math.sin(a) * 11 };
    });
  }

  private drawStage() {
    const { W, H } = this;
    const th = this.theme;
    // the floor: a checker of two tones with a fine grid
    const cv = document.createElement('canvas');
    cv.width = W * 32;
    cv.height = H * 32;
    const c = cv.getContext('2d')!;
    const tones = th.floor;
    for (let i = 0; i < W; i++)
      for (let j = 0; j < H; j++) {
        c.fillStyle = tones[(i + j) % 2];
        c.fillRect(i * 32, j * 32, 32, 32);
      }
    // paving: here and there a tile is laid as stones, a shade off the floor (as the arenas' cobbles)
    c.fillStyle = 'rgba(0,0,0,0.07)';
    for (let i = 0; i < W; i++)
      for (let j = 0; j < H; j++) {
        if ((i * 7 + j * 13) % 5 > 1) continue;
        const r = (n: number) => ((i * 31 + j * 17 + n * 7) % 9) / 9;
        const cut = 10 + r(1) * 12;
        const cut2 = 8 + r(2) * 14;
        const pad = 3;
        const round = (x: number, y: number, w: number, h: number) => {
          c.beginPath();
          c.roundRect(i * 32 + x, j * 32 + y, w, h, 4);
          c.fill();
        };
        round(pad, pad, cut - pad, cut2 - pad);
        round(cut + 2, pad, 32 - cut - pad - 2, cut2 - pad);
        round(pad, cut2 + 2, 32 - pad * 2, 32 - cut2 - pad - 2);
      }
    c.strokeStyle = th.line;
    c.lineWidth = 1.5;
    for (let i = 0; i <= W; i++) {
      c.beginPath();
      c.moveTo(i * 32, 0);
      c.lineTo(i * 32, H * 32);
      c.stroke();
    }
    for (let j = 0; j <= H; j++) {
      c.beginPath();
      c.moveTo(0, j * 32);
      c.lineTo(W * 32, j * 32);
      c.stroke();
    }
    // (Dungeon Run: the rock the rooms are cut out of)
    const rock = this.kind === 'gauntlet' ? rockCanvas(th.floor[0]) : null;
    if (rock) {
      c.fillStyle = c.createPattern(rock, 'repeat')!;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (this.grid[this.idx(i, j)] === ROCK) c.fillRect(i * 32, j * 32, 32, 32);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    this.world.add(floor);
    // round the outside, a darker apron so the edge reads
    // (a dungeon's: the same rock its rooms are cut out of)
    const rockTex = rock ? new THREE.CanvasTexture(rock) : null;
    if (rockTex) {
      rockTex.wrapS = rockTex.wrapT = THREE.RepeatWrapping;
      rockTex.repeat.set((W + 40) / 8, (H + 40) / 8);
      rockTex.colorSpace = THREE.SRGBColorSpace;
    }
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 40, H + 40),
      new THREE.MeshStandardMaterial(rockTex ? { map: rockTex, roughness: 1 } : { color: th.apron, roughness: 1, emissive: th.waterGlow && th.id === 'lava' ? 0x801800 : 0x000000 }),
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.02;
    this.world.add(apron);
    this.scars.clear();
    this.world.add(this.scars.mesh);
    this.motes = new Motes(this.kind === 'gauntlet' ? 'dungeon' : (th.stage ?? th.id), W, H);
    this.world.add(this.motes.points);

    const count = (t: number) => this.grid.reduce((n, v) => n + (v === t ? 1 : 0), 0);
    // about a third of the walls inside the stage are drawn as cover props (barrels, crates,
    // pillars...) after the theme; they block exactly like a wall
    const cover = new Set<number>();
    for (let j = 1; j < H - 1; j++)
      for (let i = 1; i < W - 1; i++) if (this.kind !== 'gauntlet' && this.grid[this.idx(i, j)] === WALL && Math.random() < 0.34) cover.add(this.idx(i, j));
    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, t: number, place: (o: THREE.Object3D, i: number, j: number) => void) => {
      const skip = t === WALL ? cover : null;
      const n = count(t) - (skip?.size ?? 0);
      if (n <= 0) return;
      const m = new THREE.InstancedMesh(geo, mat, n);
      let k = 0;
      for (let j = 0; j < H; j++)
        for (let i = 0; i < W; i++) {
          if (this.grid[this.idx(i, j)] !== t || skip?.has(this.idx(i, j))) continue;
          const p = this.center(i, j);
          this.dummy.position.set(p.x, 0, p.z);
          this.dummy.rotation.set(0, 0, 0);
          this.dummy.scale.set(1, 1, 1);
          place(this.dummy, i, j);
          this.dummy.updateMatrix();
          m.setMatrixAt(k++, this.dummy.matrix);
        }
      this.world.add(m);
      return m;
    };
    // (walls are a unit tall, stretched to the height they stand at: the dungeon's rise in TPS)
    this.wallCur = this.wallH();
    const wallGeo = new THREE.BoxGeometry(1, 1, 1);
    wallGeo.translate(0, 0.5, 0);
    this.wallMesh = inst(wallGeo, this.seeThrough(new THREE.MeshStandardMaterial({ color: th.wall, roughness: 0.8 })), WALL, () => {}) ?? null;
    if (this.wallMesh) this.wallMesh.scale.y = this.wallCur;
    for (const k of cover) {
      const o = coverProp(th.id, Math.random);
      if (!o) continue;
      const j = Math.floor(k / W);
      const c = this.center(k - j * W, j);
      o.position.x += c.x;
      o.position.z += c.z;
      this.world.add(o);
    }
    if (th.wallGlow) {
      // a glowing band round the top of each wall (the main game's rail glow)
      // (a band round the sides just under the top, so it never shares a face with the wall)
      const stripGeo = new THREE.BoxGeometry(1.03, 0.09, 1.03);
      stripGeo.translate(0, -0.12, 0);
      this.stripMesh = inst(stripGeo, this.seeThrough(new THREE.MeshBasicMaterial({ color: th.wallGlow })), WALL, () => {}) ?? null;
      if (this.stripMesh) this.stripMesh.position.y = this.wallCur;
    }
    this.bushMat.color.setHex(th.bush);
    this.bushMat.emissive.setHex(th.bushGlow ? th.bush : 0x000000);
    this.bushMat.emissiveIntensity = th.bushGlow ? 0.35 : 0;
    this.bushMat.opacity = th.bushGlow ? 0.85 : 1;
    const bushGeo = new THREE.IcosahedronGeometry(0.64, 0);
    bushGeo.translate(0, 0.5, 0);
    inst(bushGeo, this.bushMat, BUSH, (o, i, j) => {
      o.rotation.y = (i * 7 + j * 13) % 6;
      o.scale.set(1, 0.85 + ((i + j) % 3) * 0.08, 1);
    });
    const waterGeo = new THREE.PlaneGeometry(1, 1);
    waterGeo.rotateX(-Math.PI / 2);
    waterGeo.translate(0, 0.015, 0);
    inst(waterGeo, new THREE.MeshStandardMaterial({ color: th.water, roughness: 0.2, metalness: 0.1, emissive: th.waterGlow ? th.water : 0x000000, emissiveIntensity: 0.6 }), WATER, () => {});
    // crates and the door are one mesh each: they come away
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const t = this.grid[this.idx(i, j)];
        if (t === CRATE) this.makeCrate(this.idx(i, j));
        else if (t === GATE) {
          // (Dungeon Run's only door at the start is the boss room's: gold, locked)
          const dg = this.kind === 'gauntlet';
          const bars = this.barsAt(this.idx(i, j), dg ? 0xe8b43a : 0xff5a5a, dg ? 0x5a3a08 : 0x801010);
          if (dg) this.lockMeshes.push(bars);
          else this.gateMeshes.push(bars);
        }
      }
    // round the outside: props after the theme (trees, palms, buildings...)
    const edges: { x: number; z: number; side: number }[] = [];
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        if (this.grid[this.idx(i, j)] !== WALL) continue;
        const side = i === 0 ? 0 : i === W - 1 ? 1 : j === 0 ? 2 : j === H - 1 ? 3 : -1;
        if (side >= 0) edges.push({ ...this.center(i, j), side });
      }
    // inside: walls that can carry a prop, and open floor for flat touches (not where anyone starts)
    const inner: { x: number; z: number }[] = [];
    const open: { x: number; z: number }[] = [];
    for (let j = 1; j < H - 1; j++)
      for (let i = 1; i < W - 1; i++) {
        const t = this.grid[this.idx(i, j)];
        if (t === WALL) inner.push(this.center(i, j));
        else if (t === FLOOR) open.push(this.center(i, j));
      }
    if (this.kind === 'gauntlet') this.drawDungeon();
    else decorate(this.world, th.id, W, H, edges, inner, open);
    for (const f of this.pendingForts) this.makeFort(f.team, f.z, f.tiles);
    if (this.kind === 'zone') {
      // the zone: a glowing ring and a disc that takes the colour of whoever holds it
      const disc = new THREE.Mesh(new THREE.CircleGeometry(ZONE_R, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }));
      disc.position.y = 0.03;
      const ring = new THREE.Mesh(new THREE.RingGeometry(ZONE_R - 0.12, ZONE_R, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
      ring.position.y = 0.04;
      this.zoneDisc = disc;
      this.zoneRing = ring;
      this.world.add(disc, ring);
    }
    this.pendingForts = [];
    if (this.kind === 'ffa') {
      // the storm: four walls of green cloud closing in from the edges
      const mat = new THREE.MeshBasicMaterial({ color: 0x3aff8a, transparent: true, opacity: 0.32, depthWrite: false });
      for (let k = 0; k < 4; k++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1.6, 1), mat);
        m.position.y = 0.8;
        this.world.add(m);
        this.stormMesh.push(m);
      }
    }
  }

  // ---------- fighters ----------

  private makeUnit(def: CharacterDef, x: number, z: number, cpu: boolean, team: number, opts: { hp?: number; dmg?: number; boss?: boolean; giant?: boolean } = {}): Unit {
    const mesh = new ShooterMesh(def.id, def.ball, def);
    const boss = !!opts.boss;
    mesh.size = opts.giant ? 1.25 : boss ? 0.78 : 0.55;
    const wrap = new THREE.Group();
    wrap.add(mesh.root);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(opts.giant ? 1 : boss ? 0.62 : 0.44, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    // the team modes: a ring underfoot in your side's colour
    if (this.teams && !opts.giant) {
      const r = boss ? 0.62 : 0.44;
      shadow.add(new THREE.Mesh(new THREE.RingGeometry(r * 1.02, r * 1.3, 32), new THREE.MeshBasicMaterial({ color: team === 0 ? TEAM_OURS : TEAM_THEIRS, transparent: true, opacity: 0.85, depthWrite: false })));
    }
    this.world.add(wrap, shadow);
    const t = def.traits;
    const mb = marbleOf(def);
    // (a story chapter's other side: gentler early on)
    const storyHp = this.story && cpu && team !== 0 ? (this.story.hp ?? 1) : 1;
    const max = Math.round(BASE_HP * traitMul(t?.health, 'health') * (opts.hp ?? 1) * (this.kind === 'ffa' ? FFA_HP : 1) * storyHp);
    const bar = document.createElement('div');
    this.dressBar(bar, def.name, cpu, team);
    this.hud.bars.appendChild(bar);
    const u: Unit = {
      def,
      mesh,
      wrap,
      shadow,
      pose: pose(),
      bar,
      cpu,
      team,
      x,
      z,
      vx: 0,
      vz: 0,
      face: Math.PI,
      r: opts.giant ? 0.95 : boss ? 0.6 : UNIT_R,
      hp: max,
      max,
      // (each fighter's Speed, as on the rail in the other modes: half as fast at 1, 1.6 times at 5)
      // (3.96: 0.9x of 4.4, which made the old standard pace, 3.3, the slow one)
      speed: 3.96 * ACTION_SPEED[Math.max(1, Math.min(5, Math.round(t?.speed ?? 3))) - 1] * (opts.giant ? 0.7 : boss ? 0.85 : 1),
      // (the main game's marble: its damage per hit as a share of health, its magazine and cadence)
      dmg: BASE_STATS.damage * SCALE * mb.damage * mb.balance,
      power: opts.dmg ?? 1,
      mag: mb.mag,
      ammo: mb.mag,
      fireInt: (BASE_STATS.fireInterval * mb.fire) / traitMul(t?.fireRate, 'fireRate'),
      // (a full magazine back in the main game's reload time: quicker than it was, so fights keep moving)
      refill: mb.mag / (BASE_STATS.reloadTime * mb.reload),
      fireT: 0,
      firing: false,
      aim: Math.PI,
      idle: 0,
      burst: 0,
      hand: 1,
      lastHand: 1,
      tripleN: 0,
      swapN: 0,
      swapT: 0,
      biteN: 0,
      windLeft: 0,
      wobble: 0,
      wobbleN: 0,
      chargeHold: 0,
      stored: 0,
      pressShot: false,
      chargeWant: 0,
      shotSpeed: SHOT_SPEED * mb.speed,
      shotR: 0.15 * mb.radius,
      range: mb.type === 'bouncy' ? SHOT_RANGE + 1.5 : SHOT_RANGE,
      bounce: mb.type === 'bouncy' ? 2 : 0,
      spirit: SPIRIT_OF[baseOf(def)] ?? 'single',
      charge: 0,
      marble: mb.type,
      alive: true,
      reveal: 0,
      calm: 9,
      still: 0,
      slowT: 0,
      stunT: 0,
      queue: [],
      cubes: 0,
      boss,
      think: Math.random() * 0.3,
      target: null,
      aimDelay: 0.4,
      strafe: Math.random() < 0.5 ? 1 : -1,
      strafeT: 1,
      goal: null,
      step: null,
      aimError: 0.12,
      reloading: false,
      cycle: 0,
      back: 0,
      item: null,
      healed: 0,
      healT: 0,
      spT: -1,
      spLen: 1,
      giant: !!opts.giant,
    };
    this.units.push(u);
    return u;
  }

  /** a fighter's bar: YOU with the ammo strip if it's yours, otherwise its name */
  private dressBar(bar: HTMLElement, name: string, cpu: boolean, team: number) {
    const gone = bar.classList.contains('gone');
    bar.className = 'ac-bar' + (cpu ? (team === 0 && this.teams ? ' ally' : '') : ' me') + (!cpu && this.teams ? ' ours' : '') + (gone ? ' gone' : '');
    bar.innerHTML = `<span></span><i><b></b></i>${cpu ? '' : '<em><u></u></em>'}`;
    bar.querySelector('span')!.textContent = cpu ? name : 'YOU';
  }

  /** the team modes: who a switch would hand you (the next teammate still standing) */
  private nextAlly() {
    const me = this.me;
    if (!me || !this.teams || this.over) return null;
    const side = this.units.filter((u) => u.team === me.team && !u.giant);
    const at = side.indexOf(me);
    for (let k = 1; k < side.length; k++) {
      const u = side[(at + k) % side.length];
      if (u.alive) return u;
    }
    return null;
  }

  /** take over the next teammate; the fighter you leave plays on by itself (or comes back by itself) */
  private switchFighter() {
    const old = this.me;
    const next = this.nextAlly();
    if (!old || !next || this.paused || this.time < this.swapAt) return;
    this.swapAt = this.time + 0.35;
    for (const u of [old, next]) {
      u.firing = u.pressShot = false;
      u.burst = u.chargeHold = u.chargeWant = u.stored = 0;
      u.queue = [];
      u.target = null;
      u.goal = null;
    }
    old.cpu = true;
    next.cpu = false;
    this.me = next;
    this.dressBar(old.bar, old.def.name, true, old.team);
    this.dressBar(next.bar, next.def.name, false, next.team);
    this.lastFace = next.face;
    this.camGlide = 0.45;
    this.ringFx(next.x, next.z, 0x7ac8ff, 0.3, 3, 0.5);
    this.callout(next.def.name);
    sfx.play('whoosh', 0.7);
    this.updateHud();
  }

  /** a marble's colour: in the team modes, its side's (blue yours, red theirs) */
  private shotColor(s: Shot) {
    const team = (s.owner as { team?: number } | null)?.team;
    return this.teams && team !== undefined ? (team === 0 ? OURS_C : THEIRS_C) : s.color;
  }

  private spawnMe() {
    const def = this.opts.skin?.(this.unitId) ?? characterById(this.unitId);
    const sr = this.dg?.rooms.find((r) => r.kind === 'start');
    const start = this.kind === 'ffa' ? this.ffaStarts()[0] : this.teams ? this.teamSpot(0, 0) : sr ? this.center((sr.i0 + sr.i1) >> 1, (sr.j0 + sr.j1) >> 1) : { x: 0, z: this.H / 2 - 2 };
    this.me = this.makeUnit(def, start.x, start.z, false, 0);
    // (TPS starts you looking into the stage: toward the middle in free-for-all, at the other side in
    // the team modes, up the room in the dungeon; never at the wall behind)
    this.me.face = this.kind === 'ffa' && this.view === 'tps' ? Math.atan2(-start.x, start.z) : this.teams || this.view === 'tps' ? 0 : Math.PI;
    if (this.kind === 'gauntlet') {
      const vital = this.ups.vital ?? 0;
      this.me.max = Math.round(this.me.max * (1 + 0.25 * vital));
      this.me.hp = this.me.max;
      this.me.speed *= 1 + 0.15 * (this.ups.swift ?? 0);
      this.me.power *= 1 + 0.2 * (this.ups.power ?? 0);
      this.me.fireInt /= 1 + 0.2 * (this.ups.rapid ?? 0);
      this.me.refill *= 1 + 0.2 * (this.ups.rapid ?? 0);
      this.applyGear(STARTER, this.gear);
    }
    this.el.querySelector('.ac-unit')!.textContent = def.name;
  }

  private pickFoes(n: number, not: string[] = []) {
    const pool = playable().filter((c) => c.id !== this.unitId && !not.includes(c.id));
    const out: CharacterDef[] = [];
    for (let k = 0; k < n; k++) {
      if (!pool.length) pool.push(...playable());
      out.push(this.painted(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]));
    }
    return out;
  }
  /** Dungeon Run's foes: its monsters (a room mixes them; the first rooms keep to the weaker ones) */
  private pickMonsters(n: number) {
    // (the golem and the wraith wait until the third room)
    const pool = this.room - this.stageRooms < 3 && this.stage === 1 ? MONSTERS.filter((m) => m.id !== 'golem' && m.id !== 'wraith') : MONSTERS;
    // (as the roster has them: a Unit Lab edit shows up here)
    return Array.from({ length: n }, () => characterById(pool[Math.floor(Math.random() * pool.length)].id));
  }
  /** the other fighters wear one of their paint jobs (never the plain one), so no two matches look alike */
  private painted(def: CharacterDef) {
    const jobs = kitOf(def)?.paint ?? [];
    if (!jobs.length) return def;
    return skinned(def.id, { paint: jobs[Math.floor(Math.random() * jobs.length)].id });
  }

  private spawnFoes() {
    if (this.kind === 'boss') {
      // two on your side; on theirs, one giant
      const allies = this.story?.allies?.length ? [...this.story.allies.map((id) => characterById(id)), ...this.pickFoes(2, [...this.story.allies, this.story.boss ?? ''])].slice(0, 2) : this.pickFoes(2);
      allies.forEach((d, k) => {
        const p = this.teamSpot(0, k + 1);
        const u = this.makeUnit(d, p.x, p.z, true, 0);
        u.face = 0;
      });
      const d = this.story?.boss ? characterById(this.story.boss) : this.pickFoes(1)[0];
      const g = this.makeUnit(d, 0, -this.H / 2 + 4.5, true, 1, { hp: BOSS_HP, dmg: 1.5, boss: true, giant: true });
      g.face = Math.PI;
      g.aimError = 0.08;
      g.aimDelay = 0.25;
      this.giant = g;
      return;
    }
    if (this.teams) {
      // two on your side, three on theirs
      const picks = this.pickFoes(5);
      picks.forEach((d, k) => {
        const team = k < 2 ? 0 : 1;
        const p = this.teamSpot(team, team === 0 ? k + 1 : k - 2);
        const u = this.makeUnit(d, p.x, p.z, true, team);
        u.face = team === 0 ? 0 : Math.PI;
        u.aimError = 0.1 + Math.random() * 0.08;
        u.aimDelay = 0.3 + Math.random() * 0.3;
      });
      return;
    }
    if (this.kind === 'ffa') {
      const starts = this.ffaStarts();
      const given = (this.story?.foes ?? []).map((id) => characterById(id));
      // (the chapter's own fighters aren't drawn again to fill the field)
      [...given, ...this.pickFoes(5 - given.length, this.story?.foes)].slice(0, 5).forEach((d, k) => {
        const u = this.makeUnit(d, starts[k + 1].x, starts[k + 1].z, true, k + 1);
        u.aimError = 0.1 + Math.random() * 0.08;
        u.aimDelay = 0.3 + Math.random() * 0.3;
      });
      return;
    }
    // (Dungeon Run: nobody yet; each room fills as you walk into it)
  }

  /** Dungeon Run: a room's fighters, on its far side from you (tougher the further you've got) */
  private spawnRoom(room: DRoom) {
    // (the rooms of this stage, plus a step for each stage below)
    const r = Math.min(this.room - this.stageRooms, 7) + (this.stage - 1) * 1.5;
    // (kept gentle: monsters are frailer and hit softer than the arena fighters, growing slowly room by room)
    const hp = 0.35 + 0.05 * r;
    const dmg = 0.3 + 0.035 * r;
    const me = this.me!;
    const spots: { x: number; z: number }[] = [];
    for (let j = room.j0; j <= room.j1; j++)
      for (let i = room.i0; i <= room.i1; i++) {
        if (this.grid[this.idx(i, j)] !== FLOOR) continue;
        const p = this.center(i, j);
        if (Math.hypot(p.x - me.x, p.z - me.z) > 4.5) spots.push(p);
      }
    spots.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z));
    // (the far half, shuffled)
    const far = spots.slice(Math.floor(spots.length / 2)).sort(() => Math.random() - 0.5);
    if (room.kind === 'boss') {
      // this stage's own boss, with a monster at its side
      const d = characterById(this.story?.boss ?? BOSSES[Math.min(this.stage, BOSSES.length) - 1].id);
      const p = far.pop() ?? this.center((room.i0 + room.i1) >> 1, (room.j0 + room.j1) >> 1);
      const b = this.makeUnit(d, p.x, p.z, true, 1, { hp: hp * 3.5, dmg: dmg * 1.1, boss: true });
      b.aimError = 0.12;
      b.aimDelay = 0.45;
      this.pickMonsters(1).forEach((e) => this.makeUnit(e, ...this.spotOf(far), true, 1, { hp, dmg }));
      return;
    }
    const n = [1, 1, 2, 2, 2, 3, 3][Math.floor(r) - 1] ?? 3;
    this.pickMonsters(n).forEach((d) => {
      const u = this.makeUnit(d, ...this.spotOf(far), true, 1, { hp, dmg });
      u.aimError = Math.max(0.12, 0.3 - r * 0.02);
      u.aimDelay = Math.max(0.45, 0.9 - r * 0.05);
      u.face = Math.atan2(me.x - u.x, -(me.z - u.z));
    });
  }

  private spotOf(spots: { x: number; z: number }[]): [number, number] {
    const p = spots.pop() ?? { x: 0, z: -this.H / 2 + 3 };
    return [p.x, p.z];
  }

  // ---------- rules ----------

  private hostile(a: Unit, b: Unit) {
    return a !== b && a.team !== b.team && b.alive;
  }
  private inBush(u: Unit) {
    return this.tile(u.x, u.z) === BUSH;
  }
  /** a sees b: b isn't hiding in a bush (unless a is right next to it or it just gave itself away) */
  private sees(a: Unit, b: Unit) {
    if (!this.inBush(b) || b.reveal > 0) return true;
    return Math.hypot(a.x - b.x, a.z - b.z) < 2.3;
  }
  /**
   * a can aim at b on its own (auto aim, a CPU's target, a homing ball, a turret): not while b is
   * in a bush, unless a is right next to it. (Firing or being hit gives a hider away for a moment,
   * so it flashes into sight, but that's all: it can't be locked on to.)
   */
  private targetable(a: Unit, b: Unit) {
    if (!this.inBush(b)) return true;
    return Math.hypot(a.x - b.x, a.z - b.z) < 2.3;
  }
  private clearLine(x0: number, z0: number, x1: number, z1: number) {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.ceil(d / 0.2);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      if (this.blocksShot(this.tile(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t))) return false;
    }
    return true;
  }
  private blocked(x: number, z: number, r: number) {
    for (let i = Math.floor(x - r + this.W / 2); i <= Math.floor(x + r + this.W / 2); i++)
      for (let j = Math.floor(z - r + this.H / 2); j <= Math.floor(z + r + this.H / 2); j++) {
        const t = i < 0 || j < 0 || i >= this.W || j >= this.H ? WALL : this.grid[this.idx(i, j)];
        if (!this.blocksMove(t)) continue;
        // circle against the tile's square
        const cx = i - this.W / 2;
        const cz = j - this.H / 2;
        const nx = Math.max(cx, Math.min(x, cx + 1));
        const nz = Math.max(cz, Math.min(z, cz + 1));
        if ((x - nx) ** 2 + (z - nz) ** 2 < r * r) return true;
      }
    return false;
  }
  /**
   * a step, wall by wall. Walking uses a slimmer body than being hit does, so a fighter fits a
   * one-tile gap with room to spare; and one that catches a corner slides toward the middle of the
   * gap it's lining up with (if the way on is clear), rather than sticking on the edge
   */
  private moveR = (u: Unit) => (u.giant ? 0.85 : Math.min(u.r, 0.34));
  private walk(u: Unit, dx: number, dz: number) {
    const r = this.moveR(u);
    const movedX = !this.blocked(u.x + dx, u.z, r);
    if (movedX) u.x += dx;
    const movedZ = !this.blocked(u.x, u.z + dz, r);
    if (movedZ) u.z += dz;
    const lane = (v: number, half: number) => Math.floor(v + half) + 0.5 - half;
    if (!movedX && Math.abs(dx) > 1e-4) {
      const lz = lane(u.z, this.H / 2);
      const off = lz - u.z;
      const step = Math.sign(off) * Math.min(Math.abs(off), Math.abs(dx) + Math.abs(dz) * 0.5);
      if (step && !this.blocked(u.x + dx, lz, r) && !this.blocked(u.x, u.z + step, r)) u.z += step;
    }
    if (!movedZ && Math.abs(dz) > 1e-4) {
      const lx = lane(u.x, this.W / 2);
      const off = lx - u.x;
      const step = Math.sign(off) * Math.min(Math.abs(off), Math.abs(dz) + Math.abs(dx) * 0.5);
      if (step && !this.blocked(lx, u.z + dz, r) && !this.blocked(u.x + step, u.z, r)) u.x += step;
    }
  }

  /** the nearest enemy it can see (what a special homes on) */
  private nearestFoe(u: Unit, range = 14) {
    let best: Unit | null = null;
    let bd = range;
    for (const o of this.units) {
      if (!this.hostile(u, o) || !this.targetable(u, o)) continue;
      const d = Math.hypot(o.x - u.x, o.z - u.z);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  private mz = new THREE.Vector3();
  /**
   * one shot out of the magazine, toward u.aim, as the main game fires it: from the hand whose
   * turn it is (alternating, Tyrant King's left-right-both, Pioneer's tossed gun), both barrels of
   * a twin, Rex's bite every few shots, Wyvern's punch once its wind-up is done, Blossom's sweeping
   * head. Returns the marbles it used.
   */
  private shoot(u: Unit, wound = false): number {
    const sp = u.def.special;
    if (sp?.windup && !wound) {
      if (u.windLeft <= 0) {
        u.windLeft = sp.windup;
        u.pose.windT = 0;
      }
      return 0;
    }
    u.lastHand = u.hand;
    if (sp?.alternate) u.hand = -u.hand;
    let both = false;
    if (sp?.triple) {
      const n = u.tripleN++ % 3;
      both = n === 2;
      u.lastHand = n === 0 ? -1 : n === 1 ? 1 : 0;
      u.hand = n === 0 ? 1 : n === 1 ? 1 : -1;
    }
    if (sp?.swap && (u.swapN = (u.swapN + 1) % sp.swap) === 0) {
      u.hand = -u.hand;
      u.swapT = TOSS_TIME;
    }
    const bite = !!sp?.bite && (u.biteN = (u.biteN + 1) % sp.bite) === 0;
    const wind = sp?.windup ? WINDUP : { damage: 1, speed: 1 };
    const twin = !!u.def.twin;
    const mine = u === this.me && this.kind === 'gauntlet';
    const color = new THREE.Color(u.def.ball);
    const bounce = u.bounce + (mine ? (this.ups.bounce ?? 0) + (this.gear.perk === 'bounce' ? 1 : 0) : 0);
    const pierce = mine ? (this.ups.pierce ?? 0) + (this.gear.perk === 'pierce' ? 1 : 0) : 0;
    const handed = !!(sp?.alternate || sp?.triple || sp?.swap || sp?.hand);
    const r = u.shotR * (bite ? BITE.radius : 1);
    const speed = u.shotSpeed * wind.speed;
    const dmg = u.dmg * u.power * (bite ? BITE.damage : 1) * wind.damage;
    // (the marble appears at the model's own muzzle for that hand, at floor level)
    const out = (ang: number, hand: number | null, d: number, off = 0) => {
      // (turned to face the shot first, so the muzzle is where the marble goes)
      u.wrap.position.set(u.x, 0, u.z);
      u.wrap.rotation.y = -u.aim;
      u.mesh.muzzleFor(hand, this.mz, sp?.hand ?? TWIN.gap);
      const sx = this.mz.x + Math.cos(ang) * off;
      const sz = this.mz.z + Math.sin(ang) * off;
      this.shots.push({ x: sx, z: sz, vx: Math.sin(ang) * speed, vz: -Math.cos(ang) * speed, owner: u, dmg: d, r, left: u.range, bounce, pierce, hit: new Set(), color, big: false });
    };
    const ang = u.aim + (Math.random() - 0.5) * 2 * BASE_STATS.spread + (sp?.wobble ? u.wobble : 0);
    let used = 1;
    if (twin) {
      // both barrels, each a little lighter
      out(ang, 1, dmg * TWIN.damage);
      out(u.aim + (Math.random() - 0.5) * 2 * BASE_STATS.spread, -1, dmg * TWIN.damage);
    } else if (both) {
      // both fists at once (the second marble costs one too)
      out(ang, 1, dmg);
      if (u.ammo >= 2) {
        out(u.aim + (Math.random() - 0.5) * 2 * BASE_STATS.spread, -1, dmg);
        used = 2;
      }
    } else if (mine && (this.ups.multi ?? 0) > 0) {
      out(ang, handed ? u.lastHand : null, dmg * 0.75, -0.14);
      out(ang, handed ? u.lastHand : null, dmg * 0.75, 0.14);
    } else out(ang, handed ? u.lastHand : null, dmg);
    const fan = mine ? (this.ups.fan ?? 0) : 0;
    for (let f = 1; f <= fan; f++) for (const side of [-1, 1]) out(ang + side * 0.3 * f, handed ? u.lastHand : null, dmg * 0.6);
    u.face = u.aim;
    u.pose.kickT = 0;
    u.pose.recoil = 1;
    if (bite) u.pose.heavyT = 0;
    u.reveal = 1.2;
    if (u === this.me || Math.random() < 0.35) sfx.play('fire', u === this.me ? 0.45 : 0.2);
    return used;
  }

  /** the charged ball: the stored marbles as one, bigger, heavier and slower, from the hand whose turn it is */
  private fireCharged(u: Unit, n: number) {
    const sp = u.def.special;
    const handed = !!(sp?.alternate || sp?.triple || sp?.swap || sp?.hand);
    const r = u.shotR * n;
    u.face = u.aim;
    u.wrap.position.set(u.x, 0, u.z);
    u.wrap.rotation.y = -u.aim;
    u.mesh.muzzleFor(handed ? u.lastHand || 1 : null, this.mz, sp?.hand ?? TWIN.gap);
    const speed = u.shotSpeed * (1 - (n - 1) * 0.04);
    // (nudged forward so a big one doesn't start inside the fighter)
    const sx = this.mz.x + Math.sin(u.aim) * r;
    const sz = this.mz.z - Math.cos(u.aim) * r;
    this.shots.push({ x: sx, z: sz, vx: Math.sin(u.aim) * speed, vz: -Math.cos(u.aim) * speed, owner: u, dmg: u.dmg * u.power * n, r, left: u.range, bounce: u.bounce, pierce: 0, hit: new Set(), color: new THREE.Color(u.def.ball), big: true });
    u.pose.kickT = 0;
    u.pose.heavyT = 0;
    u.pose.recoil = 1;
    u.reveal = 1.2;
    u.idle = 0;
    if (u === this.me) this.shake = Math.max(this.shake, 0.12 + n * 0.05);
    // the blast: a burst at the muzzle and a ring along the ground, both as big as the charge
    this.burst(this.mz.x, this.mz.y, this.mz.z, 0xffffff, 6 + n * 4, 2 + n * 0.8);
    this.burst(this.mz.x, this.mz.y, this.mz.z, u.def.ball, 4 + n * 3, 2 + n * 0.6);
    this.ringFx(u.x, u.z, 0xffd23e, 0.4, 1 + n * 0.45, 0.45);
    sfx.play('super', (0.7 + n * 0.1) * (u === this.me ? 1 : 0.5));
  }

  /** its own special, as in the main game: the same balls, homing, quirks and damage shares */
  private special(u: Unit, angle: number) {
    if (!u.alive || u.charge < 1 || u.stunT > 0) return;
    u.charge = 0;
    u.firing = false;
    // locked on: the special goes for the nearest enemy it can see, whichever way you were aiming
    const tgt = this.lockOf(u);
    const at = tgt ? Math.atan2(tgt.x - u.x, -(tgt.z - u.z)) : angle;
    angle = at;
    const dist = tgt ? Math.hypot(tgt.x - u.x, tgt.z - u.z) : 7;
    const steel = 0xdfe6ee;
    const ball = (o: Partial<Shot> & { size?: number; share?: number }, ang = angle, delay = 0) => {
      const { size = 1, share = 1, ...rest } = o;
      const sp = 9.5 * (rest.speed ?? 1);
      const shot: Partial<Shot> = {
        r: 0.3 * size,
        dmg: SPIRIT.damage * SCALE * share * u.power,
        speed: sp,
        home: SPIRIT.turn * (tgt ? 1.6 : 1),
        tgt,
        recover: 0.08,
        color: new THREE.Color(steel),
        left: sp * SPIRIT.life,
        ...rest,
      };
      shot.speed = sp;
      u.queue.push({ t: delay, angle: ang, o: shot });
    };
    const fan = (n: number, spread: number, o: Partial<Shot> & { size?: number; share?: number }) => {
      for (let k = 0; k < n; k++) ball({ recover: 0.25, ...o }, angle + (k - (n - 1) / 2) * spread);
    };
    switch (u.spirit) {
      case 'twin':
        fan(2, 0.3, { share: 0.62, size: 0.8 });
        break;
      case 'triple':
        fan(3, 0.32, { share: 0.46, size: 0.72 });
        break;
      case 'cross':
        // both swing out wide, coast, then turn back in and cross on the way
        fan(2, 1.1, { share: 0.62, size: 0.8, home: 3.6, recover: 0.3 });
        break;
      case 'barrage':
        for (let k = 0; k < 10; k++) ball({ share: 0.14, size: 0.42, speed: 1.5, home: 1.4 }, angle + (Math.random() - 0.5) * 0.35, k * 0.09);
        break;
      case 'chain':
        for (let k = 0; k < 3; k++) ball({ share: 0.42, size: 0.75, speed: 1.15 }, angle, k * 0.32);
        break;
      case 'giant':
        ball({ share: 1.5, size: 1.7, speed: 0.62, home: 0.6 });
        break;
      case 'rail':
        // straight at where the target stands, three times as fast, no homing, through everyone
        ball({ share: 1.05, size: 0.65, speed: 3, home: 0, pierce: 9, color: new THREE.Color(0x8ae8ff) }, at);
        break;
      case 'zigzag':
        ball({ share: 1.1, size: 0.9, speed: 0.9, weave: true });
        break;
      case 'dive':
        // up over everything and down on the spot it was aimed at
        ball({ share: 1.2, size: 0.95, speed: 0.8, home: 0, dive: dist, left: dist }, at);
        break;
      case 'split':
        ball({ share: 1.2, size: 1.05, splitAt: Math.max(0, 9.5 * SPIRIT.life - dist * 0.55) });
        break;
      case 'ricochet':
        // off to one side first, then home in once it has banked off a wall
        ball({ share: 1.25, size: 0.9, speed: 1.2, bounce: 1, bank: true }, angle + (Math.random() < 0.5 ? -1 : 1) * 1.05);
        break;
      case 'drain':
        ball({ share: 0.9, effect: 'drain', color: new THREE.Color(0xff6a9a) });
        break;
      case 'frost':
        ball({ share: 0.8, effect: 'frost', color: new THREE.Color(0x8ae8ff) });
        break;
      case 'quake':
        ball({ share: 1.15, size: 1.35, speed: 0.75, effect: 'quake', color: new THREE.Color(0xffa24a) });
        break;
      default:
        ball({});
    }
    u.face = angle;
    // first the pose; the balls leave as it ends
    u.spLen = u === this.me ? POSE_ME : POSE_CPU;
    u.spT = 0;
    for (const q of u.queue) q.t += u.spLen;
    u.reveal = 2;
    if (u === this.me) {
      this.shake = 0.45;
      this.opts.vibrate?.([20, 30, 40]);
      // the moment: a flash, a beat of slow motion, the move's name big across the screen
      this.flash();
      // (the slow motion lasts the pose: the world at 0.3, so it's about a second)
      this.slowT = POSE_ME / 0.3 + 0.1;
      this.lockShow = 1.6;
      this.lockOn = tgt;
      this.punch = 1;
      // the camera drops behind you, looking where it'll go, for the pose; then back to your view
      this.spCine = true;
      this.spMax = 3;
      this.spYaw = angle;
      const sl = this.hud.speed;
      sl.classList.remove('show');
      void sl.offsetWidth;
      sl.classList.add('show');
    }
    // a pillar of light and a shockwave round whoever fires one (red on the other side: you see it coming)
    const col = u.team === (this.me?.team ?? 0) ? 0xffd23e : 0xff5a4a;
    this.pillarFx(u.x, u.z, col, u === this.me ? 1 : 0.7);
    this.ringFx(u.x, u.z, col, 0.3, u === this.me ? 4.5 : 3, 0.6);
    this.burst(u.x, 0.6, u.z, col, u === this.me ? 30 : 14, 5);
    sfx.play('super');
    const name = MOVE_NAMES[baseOf(u.def)] ?? 'SPECIAL';
    if (u === this.me) this.superCallout(name);
    else this.callout(`${u.def.name.toUpperCase()} · ${name}`, 1);
  }

  /** who a special locks on to: the nearest enemy in sight (one in a clear line first) */
  private lockOf(u: Unit) {
    let best: Unit | null = null;
    let bd = 14;
    for (const o of this.units) {
      if (!this.hostile(u, o) || !this.targetable(u, o)) continue;
      const d = Math.hypot(o.x - u.x, o.z - u.z) + (this.clearLine(u.x, u.z, o.x, o.z) ? 0 : 5);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }
  /** the special's own callout: big, gold, and it bursts in */
  private superCallout(name: string) {
    const el = this.hud.supername;
    el.textContent = `${name}!`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }
  private flash() {
    const el = this.hud.flash;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  /** a special's ball leaves */
  private launchBall(u: Unit, angle: number, o: Partial<Shot>) {
    const sp = o.speed ?? 9.5;
    const sx = u.x + Math.sin(angle) * (u.r + 0.2);
    const sz = u.z - Math.cos(angle) * (u.r + 0.2);
    this.shots.push({
      x: sx,
      z: sz,
      vx: Math.sin(angle) * sp,
      vz: -Math.cos(angle) * sp,
      owner: u,
      dmg: 0,
      r: 0.3,
      left: sp * SPIRIT.life,
      bounce: 0,
      pierce: 0,
      hit: new Set(),
      color: new THREE.Color(0xdfe6ee),
      big: true,
      spirit: true,
      head: angle,
      age: 0,
      ...o,
    });
  }

  private hurt(u: Unit, amount: number, from: Unit | null, spirit = false) {
    if (!u.alive) return;
    // Dungeon Run: your launcher's critical hits and perks
    let crit = false;
    if (from && from === this.me && this.kind === 'gauntlet' && u !== from) {
      if (this.rageT > 0) amount *= 1.4;
      if (this.gear.crit && Math.random() < this.gear.crit) {
        amount *= 1.8;
        crit = true;
      }
      if (this.gear.perk === 'fury' && Math.random() < 0.2) {
        if (this.rageT <= 0) this.pop(from.x, from.z, 'FURY', 'good');
        this.rageT = 5;
      }
      if (this.gear.perk === 'leech') from.hp = Math.min(from.max, from.hp + amount * 0.06);
    }
    const dmg = Math.round(amount);
    u.hp -= dmg;
    u.reveal = Math.max(u.reveal, 1);
    u.calm = 0;
    u.pose.flash = 1;
    if (from === this.me || u === this.me) {
      const pct = Math.max(1, Math.round((dmg / u.max) * 100));
      if (pct >= 12) this.stopT = Math.max(this.stopT, 0.055);
      this.pop(u.x, u.z, crit ? `-${pct}%!` : `-${pct}%`, from === this.me ? 'hit' : 'ouch');
    }
    // the special's gauge, as in the main game: a marble that lands fills 8%, one taken 4.5%
    // (the giant fills half as fast again, from the marbles it takes and the ones it lands)
    if (!spirit) u.charge = Math.min(1, u.charge + 0.045 * (u.giant ? 1.5 : 1));
    if (from && from.alive) {
      if (!spirit) from.charge = Math.min(1, from.charge + 0.08 * (from.giant ? 1.5 : 1));
      if (from === this.me && this.kind === 'gauntlet' && this.ups.leech) from.hp = Math.min(from.max, from.hp + amount * 0.08 * this.ups.leech);
    }
    if (u === this.me) {
      this.opts.vibrate?.(14);
      sfx.play('hurt', 0.5);
    } else sfx.play('hit', from === this.me ? 0.6 : 0.3);
    if (u.hp <= 0) this.ko(u, from);
  }

  private ko(u: Unit, from: Unit | null) {
    u.alive = false;
    u.hp = 0;
    u.shadow.visible = false;
    u.bar.classList.add('gone');
    u.firing = false;
    u.stored = u.chargeHold = 0;
    u.spT = -1;
    u.queue = [];
    // (it stays standing through the pops, then blows apart)
    this.wrecks.push({ u, mesh: u.mesh, t: 0, pops: 0, shattered: false, debris: [] });
    if (from === this.me) this.kos++;
    if (from === this.me || u === this.me) this.stopT = Math.max(this.stopT, 0.1);
    if (this.teams) {
      // respawns: Siege and Hot Zone, and your side in Boss Fight; never in Knockout
      const back = this.kind === 'siege' || this.kind === 'zone' || (this.kind === 'boss' && u.team === 0);
      if (back) {
        u.back = RESPAWN;
      } else if (u === this.me) this.callout('KNOCKED OUT · YOUR SIDE FIGHTS ON', 1);
      if (u === this.giant) this.finishSiege(1);
      this.updateHud();
      return;
    }
    if (this.kind === 'ffa') {
      // its power cubes spill out (at least one)
      for (let k = 0; k < Math.max(1, u.cubes); k++) this.drop(u.x + (Math.random() - 0.5) * 0.8, u.z + (Math.random() - 0.5) * 0.8, 'cube');
    } else if (u.cpu && Math.random() < 0.35) this.drop(u.x, u.z, 'heal');
    // Dungeon Run: a life gone, and back at the checkpoint (the last one ends the run)
    if (u === this.me && this.kind === 'gauntlet' && this.lives > 1) {
      this.lives--;
      this.callout(`DOWN · ${this.lives} ${this.lives === 1 ? 'LIFE' : 'LIVES'} LEFT`, 1);
      // (a countdown first: RESPAWN IN 3, 2, 1)
      this.meBack = 3;
      this.updateHud();
      return;
    }
    if (u === this.me) {
      const place = this.units.filter((x) => x.alive).length + 1;
      setTimeout(() => this.finish(false, place), 1700);
    }
    this.updateHud();
  }

  private drop(x: number, z: number, kind: DropKind) {
    let mesh: THREE.Object3D;
    if (kind === 'cube') mesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshStandardMaterial({ color: 0x5aff7a, emissive: 0x1a8a3a }));
    else if (kind === 'heal') mesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshStandardMaterial({ color: 0xff6a9a, emissive: 0x8a1a3a }));
    else if (kind === 'steel') mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: 0xdfe6ee, metalness: 0.9, roughness: 0.2, emissive: 0x30343a }));
    else {
      // the main game's item colours: the Dragon Shot's pink gem, the special's gold star
      const c = kind === 'dragon' ? ITEMS.dragon.color : 0xffd23e;
      mesh = new THREE.Mesh(kind === 'dragon' ? new THREE.OctahedronGeometry(0.26) : new THREE.IcosahedronGeometry(0.24, 0), new THREE.MeshStandardMaterial({ color: c, emissive: new THREE.Color(c).multiplyScalar(0.45) }));
    }
    mesh.position.set(x, 0.35, z);
    this.world.add(mesh);
    this.drops.push({ x, z, kind, mesh });
  }

  private breakCrate(k: number) {
    this.grid[k] = FLOOR;
    this.crateHp.delete(k);
    const m = this.crateMesh.get(k);
    m?.removeFromParent();
    this.crateMesh.delete(k);
    const j = Math.floor(k / this.W);
    const p = this.center(k - j * this.W, j);
    this.drop(p.x, p.z, this.kind === 'ffa' ? 'cube' : this.crateItem());
    sfx.play('clatter', 0.6);
    // (in Siege the crates come back)
    if (this.kind === 'siege') this.crateBack.push({ k, t: 20 });
  }
  private crateItem(): DropKind {
    let r = Math.random() * CRATE_ITEMS.reduce((n, [, w]) => n + w, 0);
    for (const [kind, w] of CRATE_ITEMS) if ((r -= w) <= 0) return kind;
    return 'heal';
  }
  private tickCrates(dt: number) {
    for (let n = this.crateBack.length - 1; n >= 0; n--) {
      const c = this.crateBack[n];
      if ((c.t -= dt) > 0) continue;
      const j = Math.floor(c.k / this.W);
      const p = this.center(c.k - j * this.W, j);
      // (not on top of anyone, or an item still lying there)
      if (this.units.some((u) => u.alive && Math.abs(u.x - p.x) < 1 && Math.abs(u.z - p.z) < 1) || this.drops.some((d) => Math.hypot(d.x - p.x, d.z - p.z) < 0.6)) {
        c.t = 1;
        continue;
      }
      this.crateBack.splice(n, 1);
      this.grid[c.k] = CRATE;
      this.crateHp.set(c.k, CRATE_HP);
      this.makeCrate(c.k);
    }
  }

  // ---------- the loop ----------

  private saverOn = false;
  private applySaver() {
    this.saverOn = !!this.opts.saver?.();
    const dpr = Math.min(window.devicePixelRatio || 1, this.saverOn ? 1.5 : 2);
    if (this.renderer.getPixelRatio() !== dpr) this.renderer.setPixelRatio(dpr);
  }

  private frame = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    if (this.saverOn && now - this.last < 1000 / 30 - 4) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    // (a beat of slow motion as your special goes)
    if (this.slowT > 0) this.slowT -= dt;
    // (a heavy hit lands: everything holds for a couple of frames)
    const held = this.stopT > 0;
    if (held) this.stopT -= dt;
    if (!this.over && !this.paused && !held) this.step(this.slowT > 0 ? dt * 0.3 : dt);
    this.draw(held ? dt * 0.08 : dt);
  };

  /** a story dungeon's captions, one at a time */
  private says: StoryLine[] = [];
  private sayT = 0;
  private roomSaid = false;
  private bossTalked = false;
  private storySay(l?: StoryLine) {
    if (!l) return;
    this.says.push(l);
    if (this.sayT <= 0) this.nextSay();
  }
  private nextSay() {
    const el = this.hud.say;
    const l = this.says.shift();
    if (!l) {
      el.classList.remove('on');
      this.sayT = 0;
      return;
    }
    el.querySelector('b')!.textContent = l.who;
    el.querySelector('p')!.textContent = l.text;
    el.classList.toggle('narrator', !l.who);
    el.classList.add('on');
    this.sayT = 4.2;
  }

  /** the hit-stop still to run */
  private stopT = 0;
  /** the marks of this fight, and what hangs in the air */
  private scars = new Scars(80);
  private motes: Motes | null = null;
  private impacts = 0;
  /** what a marble kicks up where it ends, by arena; a big one leaves a mark */
  private impactFx(x: number, z: number, big: boolean) {
    if (this.impacts++ > 6) return;
    const fx = impactOf(this.theme.stage ?? this.theme.id);
    if (fx.kind === 'splash') this.ringFx(x, z, fx.color, 0.1, big ? 1.5 : 0.8, 0.4);
    this.burst(x, 0.45, z, fx.color, big ? 12 : 4, fx.kind === 'spark' ? 5 : 2.6, { float: fx.kind !== 'spark', size: big ? 0.13 : 0.09 });
    if (big || Math.random() < 0.18) this.scars.add(x, z, big ? 0.6 : 0.26);
  }

  private step(dt: number) {
    this.impacts = 0;
    this.time += dt;
    if (this.sayT > 0 && (this.sayT -= dt) <= 0) this.nextSay();
    this.motes?.update(dt, this.time);
    const me = this.me!;
    // you: walk with the stick (or WASD)
    let mx = 0;
    let mz = 0;
    if (this.moveStick) {
      const dx = this.moveStick.x - this.moveStick.x0;
      const dy = this.moveStick.y - this.moveStick.y0;
      const len = Math.hypot(dx, dy);
      if (len > 6) {
        const k = Math.min(1, len / 50) / len;
        mx = dx * k;
        mz = dy * k;
      }
    } else {
      const k = this.keys;
      mx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      mz = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
      const len = Math.hypot(mx, mz);
      if (len > 1) {
        mx /= len;
        mz /= len;
      }
    }
    // (in the cockpit view, up on the stick is the way the camera looks)
    if (this.view === 'first' && (mx || mz)) {
      const c = Math.cos(this.camYaw);
      const sn = Math.sin(this.camYaw);
      [mx, mz] = [mx * c - mz * sn, mx * sn + mz * c];
    }
    // (striking the special's pose: standing your ground)
    if (me.spT >= 0) mx = mz = 0;
    // TPS steers: across turns you, up and down walk you forward and back the way you face
    // (while you shoot, the shot turns you instead, and across steps you sideways round your target)
    const tps = this.view === 'tps';
    if (tps && me.alive && (mx || mz)) {
      const shooting = me.firing || !!this.aimStick || this.mouseFire || this.keyFire || me.chargeHold > 0.12;
      if (!shooting && me.stunT <= 0) me.face = wrapAngle(me.face + mx * TPS_TURN * dt);
      const f = me.face;
      const ahead = -mz;
      const side = shooting ? mx : 0;
      [mx, mz] = [Math.sin(f) * ahead + Math.cos(f) * side, -Math.cos(f) * ahead + Math.sin(f) * side];
    }
    if (me.alive) {
      const sp = me.stunT > 0 ? 0 : me.speed * (me.slowT > 0 ? 0.5 : 1) * (me.chargeHold >= CHARGE.hold ? CHARGE.moveMul : 1);
      me.vx = mx * sp;
      me.vz = mz * sp;
      // the trigger: held on the aim stick (once dragged), the mouse button, or Space
      // FIRE held: at the nearest enemy, or wherever your thumb slides off the button to aim
      const a = this.aimStick;
      const dragged = a && Math.hypot(a.x - a.x0, a.y - a.y0) > 30;
      if (a) me.aim = dragged ? Math.atan2(a.x - a.x0, -(a.y - a.y0)) + (behind(this.view) ? this.camYaw : 0) : this.autoAim();
      if (this.mouseFire) me.aim = this.mouseAngle();
      if (this.keyFire) me.aim = this.autoAim();
      me.firing = me.spT < 0 && (!!a || this.mouseFire || this.keyFire || me.burst > 0);
      // charging: turned to face the closest enemy (unless you're aiming by hand), and it's marked
      this.chargeTarget = null;
      if (me.chargeHold > 0.12 && !dragged && !this.mouseFire) {
        const t = this.nearestEnemy().u;
        if (t) {
          me.aim = Math.atan2(t.x - me.x, -(t.z - me.z));
          this.chargeTarget = t;
        }
      }
      if (me.chargeHold > 0.12) me.face = me.aim;
      this.walk(me, me.vx * dt, me.vz * dt);
      // (TPS has already turned you: walking back, you keep facing ahead)
      if (!tps && (mx || mz) && !me.firing && !this.aimStick) me.face = Math.atan2(mx, -mz);
    }
    if (this.kind === 'siege') {
      this.tickForts(dt);
      this.tickCrates(dt);
    }
    if (this.teams) for (const u of this.units) if (!u.alive && u.back > 0 && (u.back -= dt) <= 0) this.respawn(u);
    if (this.meBack > 0 && (this.meBack -= dt) <= 0) {
      this.meBack = 0;
      this.fadeThrough(() => this.backToCheckpoint());
    }
    this.showRespawn(this.me && !this.me.alive && !this.over ? (this.teams ? this.me.back : this.meBack) : 0);
    if (this.kind === 'zone') this.tickZone(dt);
    if (this.kind === 'boss') this.tickGiant(dt);
    if (this.kind === 'knockout') this.kRoundT += dt;
    for (const u of this.units) if (u.cpu && u.alive) this.think(u, dt);
    for (const u of this.units) this.tickUnit(u, dt);
    this.tickBoxes(dt);
    this.moveShots(dt);
    this.pickups();
    if (this.kind === 'ffa') this.tickStorm(dt);
    if (this.kind === 'gauntlet') this.tickDungeon(dt);
    this.checkEnd();
    this.updateHud();
  }

  /** Siege: back on its feet by its own fortress */
  private respawn(u: Unit, at?: { x: number; z: number }) {
    const p = at ?? this.teamSpot(u.team, Math.floor(Math.random() * 3));
    u.x = p.x;
    u.z = p.z;
    u.vx = u.vz = 0;
    u.hp = u.max;
    u.ammo = u.mag;
    u.alive = true;
    u.stored = u.chargeHold = u.chargeWant = 0;
    u.slowT = u.stunT = 0;
    u.queue = [];
    u.face = u.team === 0 ? 0 : Math.PI;
    u.calm = u.still = 0;
    // (the last one was blown apart: a fresh body)
    if (u.mesh.broken) {
      const mesh = new ShooterMesh(u.def.id, u.def.ball, u.def);
      mesh.size = u.giant ? 1.25 : u.boss ? 0.78 : 0.55;
      u.wrap.add(mesh.root);
      u.mesh = mesh;
    }
    u.wrap.visible = u.shadow.visible = true;
    u.bar.classList.remove('gone');
    u.target = null;
    u.goal = null;
    if (u === this.me) {
      this.callout('BACK IN THE FIGHT');
      this.camSnap = true;
    }
  }

  private tickUnit(u: Unit, dt: number) {
    if (!u.alive) return;
    u.reveal = Math.max(0, u.reveal - dt);
    u.slowT = Math.max(0, u.slowT - dt);
    u.stunT = Math.max(0, u.stunT - dt);
    u.calm += dt;
    if (u.burst > 0) {
      u.burst -= dt;
      u.firing = u.burst > 0;
    }
    // the magazine: a marble every interval while the trigger's held, refilling once it lets go
    const sp = u.def.special;
    u.swapT = Math.max(0, u.swapT - dt);
    // the wind-up done: the punch leaves
    if (u.windLeft > 0 && (u.windLeft -= dt) <= 0) {
      u.windLeft = 0;
      if (u.ammo >= 1) u.ammo -= this.shoot(u, true);
    }
    // Blossom's head sweeps side to side (slower while firing), and its shots follow it
    if (sp?.wobble) u.wobble = Math.sin((u.wobbleN += dt * HEAD_SWEEP * (u.firing ? 0.35 : 1))) * sp.wobble;
    // the charge shot: you charge by holding FIRE past a moment; a CPU charges when it plans to
    const human = u === this.me;
    if (human || u.chargeWant > 0 || u.chargeHold > 0 || u.stored > 0) {
      const holding = u.stunT <= 0 && (human ? u.firing : u.chargeWant > 0);
      let letGo = false;
      if (holding) {
        u.chargeHold += dt;
        if (u.chargeHold >= CHARGE.hold) {
          // one marble per `per` seconds after the threshold, up to five
          const want = Math.min(CHARGE.max, Math.floor((u.chargeHold - CHARGE.hold) / CHARGE.per + 1e-6));
          while (u.stored < want && u.ammo >= 1) {
            u.ammo -= 1;
            u.stored++;
            u.idle = 0;
            // (each marble stored sends a ring out round its feet)
            this.ringFx(u.x, u.z, 0xffd23e, 0.3, 0.8 + u.stored * 0.18, 0.4);
            if (human) this.shake = Math.max(this.shake, 0.04 + u.stored * 0.015);
            sfx.play('tick', (0.6 + u.stored * 0.12) * (human ? 1 : 0.4));
          }
          if (!human && u.stored > 0 && (u.stored >= u.chargeWant || u.ammo < 1)) letGo = true;
        }
      }
      if (letGo || (!holding && (u.chargeHold > 0 || u.stored > 0))) {
        // let go: the charged ball (stunned mid-charge: the marbles go back)
        if (u.stored > 0) {
          if ((human ? !u.firing : letGo) && u.stunT <= 0) this.fireCharged(u, u.stored);
          else u.ammo = Math.min(u.mag, u.ammo + u.stored);
        }
        u.stored = 0;
        u.chargeHold = 0;
        if (!human) u.chargeWant = 0;
      }
      if (human && !u.firing) u.pressShot = false;
    }
    // a press fires one shot (holding on is charge); a CPU's held trigger streams, unless it's charging
    u.fireT = Math.max(0, u.fireT - dt);
    const mayFire = human ? !u.pressShot && u.chargeHold < CHARGE.hold : u.chargeWant === 0 && u.chargeHold === 0;
    // (not while a gun's in the air, or a punch is winding up)
    if (mayFire && u.firing && u.stunT <= 0 && u.ammo >= 1 && u.fireT <= 0 && u.swapT <= 0 && u.windLeft <= 0) {
      if (human) u.pressShot = true;
      u.ammo -= u.item ? this.fireItem(u) : this.shoot(u);
      u.fireT = u.fireInt;
      u.idle = 0;
    }
    if (!u.firing && u.stored === 0) {
      u.idle += dt;
      if (u.idle > 0.3 && u.ammo < u.mag) u.ammo = Math.min(u.mag, u.ammo + dt * u.refill);
    }
    // standing still mends: not moving, not firing, and not hit for a moment
    const still = Math.hypot(u.vx, u.vz) < 0.3 && !u.firing;
    u.still = still ? u.still + dt : 0;
    // (not the giant: its health only goes down)
    const mending = !u.giant && u.still > 0.6 && u.calm > 2 && u.hp < u.max;
    if (mending) {
      const before = u.hp;
      u.hp = Math.min(u.max, u.hp + u.max * MEND * dt);
      u.healed += u.hp - before;
    }
    u.bar.classList.toggle('mend', mending);
    if (u.spT >= 0 && (u.spT += dt) >= u.spLen) {
      u.spT = -1;
      u.pose.kickT = 0;
      u.pose.heavyT = 0;
    }
    for (const q of u.queue) q.t -= dt;
    while (u.queue.length && u.queue[0].t <= 0) {
      const q = u.queue.shift()!;
      this.launchBall(u, q.angle, q.o);
    }
    u.pose.kickT += dt;
    u.pose.heavyT += dt;
    u.pose.windT += dt;
    u.pose.recoil = Math.max(0, u.pose.recoil - dt * 8);
    u.pose.hand = u.hand;
    u.pose.lastHand = u.lastHand;
    u.pose.wobble = u.wobble;
    u.pose.flash = Math.max(0, u.pose.flash - dt * 4);
    u.pose.health = (u.hp / u.max) * 100;
    u.pose.stored = u.stored;
  }

  /** a special's ball lands on someone: its damage, and its quirk */
  private ballHits(s: Shot, u: Unit) {
    this.hurt(u, s.dmg, s.owner, true);
    // (a special landing: a burst and a ring, and the screen jolts if it's near you)
    this.burst(u.x, 0.6, u.z, 0xffffff, 14, 5);
    this.burst(u.x, 0.6, u.z, s.color.getHex(), 12, 4);
    this.ringFx(u.x, u.z, s.color.getHex(), 0.2, 1.8, 0.4);
    if (this.me && Math.hypot(u.x - this.me.x, u.z - this.me.z) < 8) this.shake = Math.max(this.shake, 0.25);
    if (s.effect === 'drain' && s.owner.alive) s.owner.hp = Math.min(s.owner.max, s.owner.hp + s.dmg * 0.75);
    if (s.effect === 'frost') u.slowT = 3;
    if (s.effect === 'quake') {
      u.stunT = 1;
      this.shake = Math.max(this.shake, 0.25);
      for (const o of this.units) if (o !== u && this.hostile(s.owner, o) && Math.hypot(o.x - u.x, o.z - u.z) < 1.6) this.hurt(o, s.dmg * 0.5, s.owner, true);
    }
    sfx.play('superhit', 0.7);
  }

  /** a special's ball steering: homing on its target, weaving, splitting */
  private steerBall(s: Shot, dt: number) {
    s.age = (s.age ?? 0) + dt;
    let head = s.head ?? Math.atan2(s.vx, -s.vz);
    const t = s.tgt;
    if (s.home && t?.alive && this.targetable(s.owner, t) && s.age > (s.recover ?? 0) && (!s.bank || s.banked)) {
      const want = Math.atan2(t.x - s.x, -(t.z - s.z));
      let d = want - head;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      head += Math.max(-s.home * dt, Math.min(s.home * dt, d));
    }
    s.head = head;
    const wob = s.weave ? Math.sin(s.age * 8) * 0.75 : 0;
    const sp = s.speed ?? 9.5;
    s.vx = Math.sin(head + wob) * sp;
    s.vz = -Math.cos(head + wob) * sp;
    if (s.splitAt !== undefined && s.left <= s.splitAt) {
      // into three, just before it lands
      s.splitAt = undefined;
      for (const off of [-0.35, 0.35]) this.shots.push({ ...s, dmg: s.dmg / 3, r: s.r * 0.6, head: head + off, hit: new Set(), splitAt: undefined, recover: s.age + 0.15 });
      s.dmg /= 3;
      s.r *= 0.6;
    }
  }

  private moveShots(dt: number) {
    for (let k = this.shots.length - 1; k >= 0; k--) {
      const s = this.shots[k];
      // (a hit can end the match, which clears the marbles mid-loop)
      if (!s) continue;
      if (s.spirit) this.steerBall(s, dt);
      const speed = Math.hypot(s.vx, s.vz);
      const steps = Math.max(1, Math.ceil((speed * dt) / 0.2));
      let dead = false;
      for (let n = 0; n < steps && !dead; n++) {
        const h = dt / steps;
        const ox = s.x;
        const oz = s.z;
        s.x += s.vx * h;
        s.z += s.vz * h;
        s.left -= speed * h;
        if (s.dive !== undefined) {
          // over everything until it comes down: then everyone round the spot is hit
          if (s.left <= 0) {
            for (const u of this.units) if (this.hostile(s.owner, u) && Math.hypot(u.x - s.x, u.z - s.z) < 1.4) this.ballHits(s, u);
            for (const f of this.forts) if (f.team !== s.owner.team && Math.abs(s.x - f.x) < 2.2 && Math.abs(s.z - f.z) < 1.8) this.hurtFort(f, s.dmg, s.owner);
            this.shake = Math.max(this.shake, 0.3);
            sfx.play('slam', 0.8);
            this.impactFx(s.x, s.z, true);
            dead = true;
          }
          continue;
        }
        if (s.left <= 0) {
          this.impactFx(s.x, s.z, s.big);
          dead = true;
          break;
        }
        const t = this.tile(s.x, s.z);
        if (this.blocksShot(t)) {
          this.impactFx(ox, oz, s.big);
          const key = this.tileOf(s.x, s.z);
          if (t === FORT && key >= 0) {
            const f = this.fortAt(key);
            if (f && f.team !== s.owner.team) this.hurtFort(f, s.dmg, s.owner);
            dead = true;
          } else if (t === CRATE && key >= 0) {
            const hp = (this.crateHp.get(key) ?? CRATE_HP) - s.dmg;
            this.crateHp.set(key, hp);
            sfx.play('wall', 0.3);
            if (hp <= 0) this.breakCrate(key);
            dead = true;
          } else if (s.bounce > 0) {
            s.bounce--;
            // (Fang Hound's marbles hit harder for every bounce)
            const ric = s.owner.def.special?.ricochet;
            if (ric && !s.spirit) s.dmg *= 1 + ric;
            // which way to turn: whichever axis took it into the wall
            if (this.blocksShot(this.tile(s.x, oz))) s.vx = -s.vx;
            if (this.blocksShot(this.tile(ox, s.z))) s.vz = -s.vz;
            s.x = ox;
            s.z = oz;
            if (s.spirit) {
              s.head = Math.atan2(s.vx, -s.vz);
              s.banked = true;
            }
            sfx.play('wall', 0.25);
          } else dead = true;
          continue;
        }
        // an item crate in the way: anyone's marble knocks at it
        const bk = s.dive === undefined ? this.boxes.findIndex((b) => b.age >= DROP.land && (b.x - s.x) ** 2 + (b.z - s.z) ** 2 < (0.4 + s.r) ** 2) : -1;
        if (bk >= 0) {
          this.hitBox(bk, s);
          dead = true;
          break;
        }
        for (const u of this.units) {
          if (!this.hostile(s.owner, u) || s.hit.has(u)) continue;
          if ((u.x - s.x) ** 2 + (u.z - s.z) ** 2 < (u.r + s.r) ** 2) {
            if (s.spirit) this.ballHits(s, u);
            else this.hurt(u, s.dmg, s.owner);
            s.hit.add(u);
            if (s.pierce > 0) s.pierce--;
            else {
              dead = true;
              break;
            }
          }
        }
      }
      if (dead && this.shots[k] === s) this.shots.splice(k, 1);
    }
  }

  /** a power cube or an item, to this fighter */
  private gain(u: Unit, kind: DropKind) {
    if (kind === 'cube') {
      // a power cube: a little more health and hit
      u.cubes++;
      u.max = Math.round(u.max * 1.1);
      u.hp = Math.min(u.max, u.hp + u.max * 0.1);
      u.power *= 1.08;
    } else if (kind === 'heal') u.hp = Math.min(u.max, u.hp + u.max * 0.25);
    else if (kind === 'special') u.charge = 1;
    else u.item = kind;
    if (u === this.me) {
      sfx.play('charge', 0.6);
      this.pop(u.x, u.z, DROP_NAME[kind], 'good');
      if (kind === 'dragon' || kind === 'steel') this.callout(`${DROP_NAME[kind]} · YOUR NEXT SHOT`);
    }
  }

  // ---------- item crates (the main game's air drops) ----------

  private tickBoxes(dt: number) {
    if (this.kind === 'gauntlet' && !this.activeRoom) this.boxT = Math.max(this.boxT, 4);
    if ((this.boxT -= dt) <= 0 && this.boxes.length < 2) {
      this.boxT = DROP.every[0] + Math.random() * (DROP.every[1] - DROP.every[0]);
      this.dropBox();
    }
    for (let k = this.boxes.length - 1; k >= 0; k--) {
      const b = this.boxes[k];
      b.age += dt;
      b.life -= dt;
      b.flash = Math.max(0, b.flash - dt * 6);
      if (b.life <= 0) this.removeBox(k);
    }
  }
  /** an item crate drops onto open floor, away from everyone (and inside the storm) */
  private dropBox() {
    for (let n = 0; n < 40; n++) {
      const ar = this.kind === 'gauntlet' ? this.activeRoom : null;
      const i = ar ? ar.i0 + Math.floor(Math.random() * (ar.i1 - ar.i0 + 1)) : 1 + Math.floor(Math.random() * (this.W - 2));
      const j = ar ? ar.j0 + Math.floor(Math.random() * (ar.j1 - ar.j0 + 1)) : 2 + Math.floor(Math.random() * (this.H - 4));
      if (this.grid[this.idx(i, j)] !== FLOOR) continue;
      const p = this.center(i, j);
      if (this.kind === 'ffa' && (Math.abs(p.x) > this.storm - 2 || Math.abs(p.z) > this.storm - 2)) continue;
      if (this.units.some((u) => u.alive && Math.hypot(u.x - p.x, u.z - p.z) < 2.5)) continue;
      if (this.boxes.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < 3)) continue;
      const kind = this.crateItem() as ItemBox['kind'];
      const c = ITEM_COLOR[kind];
      // as in the main game: a dark crate with glowing bands in the item's colour, and a ring on the floor
      const root = new THREE.Group();
      root.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), new THREE.MeshLambertMaterial({ color: 0x2a3146 })));
      const glow = new THREE.MeshBasicMaterial({ color: c });
      for (const [w, h, d] of [
        [0.66, 0.08, 0.66],
        [0.08, 0.66, 0.66],
        [0.66, 0.66, 0.08],
      ])
        root.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glow));
      root.rotation.y = Math.random() * 0.8 - 0.4;
      const marker = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
      this.world.add(root, marker);
      this.boxes.push({ kind, x: p.x, z: p.z, hp: DROP.hp, life: DROP.landedLife, age: 0, flash: 0, root, marker });
      sfx.play('whoosh', 0.5);
      return;
    }
  }
  private removeBox(k: number) {
    const b = this.boxes[k];
    b.root.removeFromParent();
    b.marker.removeFromParent();
    this.boxes.splice(k, 1);
  }
  /** a marble hits an item crate: two hits break it, and its item goes to whoever broke it */
  private hitBox(k: number, s: Shot) {
    const b = this.boxes[k];
    b.hp -= s.big || s.spirit ? 2 : 1;
    b.flash = 1;
    sfx.play('wall', 0.4);
    if (b.hp > 0) return;
    this.removeBox(k);
    sfx.play('clatter', 0.7);
    const u = s.owner;
    // (a fortress's turret breaks it for nobody)
    if (u.alive && this.units.includes(u)) this.gain(u, b.kind);
  }
  private drawBoxes() {
    for (const b of this.boxes) {
      // it drops in, then sits with a little bob; a hit squashes it, and it blinks before it goes
      const t = Math.min(1, b.age / DROP.land);
      const bob = t < 1 ? 0 : Math.abs(Math.sin(b.age * 3)) * 0.06;
      b.root.position.set(b.x, (1 - t) * 5 + bob + 0.32, b.z);
      b.root.scale.setScalar((b.hp < DROP.hp ? 0.86 : 1) * (1 + b.flash * 0.25));
      b.marker.position.set(b.x, 0.04, b.z);
      const pulse = 1 + Math.sin(this.time * 6) * 0.12;
      b.marker.scale.set(pulse, 1, pulse);
      b.root.visible = b.life > 2 || Math.sin(this.time * 20) > 0;
    }
  }
  /** a burst of sparks (or smoke) at a spot */
  private burst(x: number, y: number, z: number, color: number, n: number, speed: number, o: { float?: boolean; size?: number; trail?: boolean } = {}) {
    let mat = this.sparkMats.get(color);
    if (!mat) this.sparkMats.set(color, (mat = new THREE.MeshBasicMaterial({ color })));
    for (let k = 0; k < n && this.sparks.length < 260; k++) {
      const mesh = new THREE.Mesh(this.sparkGeo, mat);
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(o.size ?? 0.05 + Math.random() * 0.07);
      this.scene.add(mesh);
      const a = Math.random() * Math.PI * 2;
      const up = o.float ? 0.6 : 1 + Math.random() * 2.5;
      const sp = speed * (0.3 + Math.random() * 0.7);
      const life = o.trail ? 0.3 : o.float ? 1 + Math.random() * 0.6 : 0.35 + Math.random() * 0.45;
      this.sparks.push({ mesh, v: new THREE.Vector3(Math.cos(a) * sp, up * (o.float ? 1 : speed * 0.4), Math.sin(a) * sp), life, max: life, float: !!o.float, trail: o.trail });
    }
  }
  /** a spark that flies in to a point (charging energy gathering at the muzzle) */
  private swirl(x: number, y: number, z: number, color: number) {
    if (this.sparks.length >= 260) return;
    let mat = this.sparkMats.get(color);
    if (!mat) this.sparkMats.set(color, (mat = new THREE.MeshBasicMaterial({ color })));
    const mesh = new THREE.Mesh(this.sparkGeo, mat);
    const a = Math.random() * Math.PI * 2;
    const e = (Math.random() - 0.3) * 1.2;
    const r = 0.45 + Math.random() * 0.45;
    mesh.position.set(x + Math.cos(a) * r, y + e * r, z + Math.sin(a) * r);
    mesh.scale.setScalar(0.035 + Math.random() * 0.03);
    this.scene.add(mesh);
    const life = 0.22;
    const v = new THREE.Vector3(x, y, z).sub(mesh.position).divideScalar(life);
    this.sparks.push({ mesh, v, life, max: life, float: true, trail: true });
  }
  /** a ring that spreads across the floor and fades (a shockwave) */
  private ringFx(x: number, z: number, color: number, from: number, to: number, life: number) {
    const mesh = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.position.set(x, 0.06, z);
    mesh.renderOrder = 4;
    this.scene.add(mesh);
    this.fxs.push({ mesh, t: 0, life, step: (k, m) => {
      m.scale.setScalar(from + (to - from) * (1 - (1 - k) ** 2));
      (m.material as THREE.MeshBasicMaterial).opacity = 1 - k;
    } });
  }
  /** a pillar of light rising from the floor */
  private pillarFx(x: number, z: number, color: number, size: number) {
    const mesh = new THREE.Mesh(this.pillarGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.fxs.push({ mesh, t: 0, life: 0.8, step: (k, m) => {
      m.scale.set(size * (0.6 + k * 0.6) * (1 - k * 0.6), size * Math.min(1, k * 4) * 1.4, size * (0.6 + k * 0.6) * (1 - k * 0.6));
      (m.material as THREE.MeshBasicMaterial).opacity = 0.65 * (1 - k);
    } });
  }
  private ringGeo = new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2);
  private pillarGeo = new THREE.CylinderGeometry(0.55, 0.75, 6, 24, 1, true).translate(0, 3, 0);
  private drawFx(dt: number) {
    for (let n = this.fxs.length - 1; n >= 0; n--) {
      const f = this.fxs[n];
      f.t += dt;
      const k = Math.min(1, f.t / f.life);
      f.step(k, f.mesh);
      if (k >= 1) {
        f.mesh.removeFromParent();
        (f.mesh.material as THREE.Material).dispose();
        this.fxs.splice(n, 1);
      }
    }
  }
  /**
   * charging and mending show round the fighter: a ring on the floor under it (gold while it
   * charges, green while it mends), energy gathering at its muzzle, green sparkles rising and
   * your +HP; and while you charge, the screen's edges glow and the camera leans in
   */
  private drawAuras(dt: number) {
    const me = this.me;
    for (const u of this.units) {
      const charging = u.alive && u.wrap.visible && u.chargeHold >= CHARGE.hold;
      const mending = u.alive && u.wrap.visible && u.bar.classList.contains('mend');
      let ring = this.auras.get(u);
      if (!charging && !mending) {
        if (ring) ring.visible = false;
        if (!mending) u.healT = 0;
        continue;
      }
      if (!ring) {
        ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
        ring.renderOrder = 4;
        this.scene.add(ring);
        this.auras.set(u, ring);
      }
      ring.visible = true;
      const mat = ring.material as THREE.MeshBasicMaterial;
      if (charging) {
        mat.color.setHex(0xffd23e);
        const lvl = u.stored / CHARGE.max;
        ring.scale.setScalar((0.55 + lvl * 0.35) * (1 + Math.sin(this.time * (10 + u.stored * 3)) * 0.08));
        mat.opacity = 0.5 + lvl * 0.45;
        // energy gathering at the muzzle (where the orb is)
        const orb = this.orbs.get(u);
        if (orb?.visible) for (let k = 0; k < 1 + u.stored; k++) if (Math.random() < 0.6) this.swirl(orb.position.x, orb.position.y, orb.position.z, Math.random() < 0.5 ? 0xffffff : 0xffd23e);
      } else {
        mat.color.setHex(0x5aff9a);
        ring.scale.setScalar(0.6 + ((this.time * 1.4) % 1) * 0.3);
        mat.opacity = 0.7 * (1 - ((this.time * 1.4) % 1));
        if (Math.random() < dt * 9) this.burst(u.x + (Math.random() - 0.5) * 0.6, 0.15, u.z + (Math.random() - 0.5) * 0.6, Math.random() < 0.5 ? 0x5aff9a : 0xd8ffe8, 1, 0.1, { float: true, size: 0.045 });
        if (u === me && (u.healT -= dt) <= 0) {
          u.healT = 0.7;
          if (u.healed >= 1) this.pop(u.x, u.z, `+${Math.round(u.healed)}`, 'good');
          u.healed = 0;
        }
      }
      ring.position.set(u.x, 0.05, u.z);
    }
    // your charge: the screen's edges glow gold, stronger with each marble
    const lvl = me && me.alive && me.chargeHold >= CHARGE.hold ? 0.25 + (me.stored / CHARGE.max) * 0.75 : 0;
    this.hud.vignette.style.opacity = lvl.toFixed(2);
  }

  private drawSparks(dt: number) {
    for (let k = this.sparks.length - 1; k >= 0; k--) {
      const sp = this.sparks[k];
      sp.life -= dt;
      if (sp.life <= 0) {
        sp.mesh.removeFromParent();
        this.sparks.splice(k, 1);
        continue;
      }
      if (!sp.float && !sp.trail) sp.v.y -= 14 * dt;
      sp.mesh.position.addScaledVector(sp.v, dt);
      if (sp.mesh.position.y < 0.03) sp.mesh.position.y = 0.03;
      // (smoke swells as it fades; sparks shrink)
      const f = sp.life / sp.max;
      sp.mesh.scale.setScalar(sp.trail ? sp.mesh.scale.x * (1 - dt * 3) : sp.float ? sp.mesh.scale.x * (1 + dt * 0.35) : sp.mesh.scale.x * (0.96 + 0.04 * f));
    }
  }

  /** the knockout, as in the other modes: three pops round the body, then it blows apart */
  private drawWrecks(dt: number) {
    for (let n = this.wrecks.length - 1; n >= 0; n--) {
      const w = this.wrecks[n];
      const u = w.u;
      w.t += dt;
      const color = TEAM_COLOR[u.team === (this.me?.team ?? 0) ? 0 : 1];
      const near = !this.me || Math.hypot(u.x - this.me.x, u.z - this.me.z) < 9;
      const big = u.boss ? 1.5 : 1;
      const popAt = [0.05, 0.25, 0.45];
      while (w.pops < popAt.length && w.t >= popAt[w.pops]) {
        if (near) sfx.play('pop', 0.6 + w.pops * 0.1);
        const ox = (Math.random() - 0.5) * 0.6;
        const oz = (Math.random() - 0.5) * 0.6;
        this.burst(u.x + ox, 0.4 + Math.random() * 0.5, u.z + oz, 0xffd27a, 12, 3 * big);
        this.burst(u.x + ox, 0.6, u.z + oz, color, 6, 2.5 * big);
        if (u === this.me) this.shake = Math.max(this.shake, 0.2);
        w.pops++;
      }
      // (shaking as it goes)
      if (!w.shattered) {
        u.wrap.position.set(u.x + (Math.random() - 0.5) * 0.05 * w.t, 0, u.z + (Math.random() - 0.5) * 0.05 * w.t);
        if (w.t >= 0.6) {
          w.shattered = true;
          if (near) {
            sfx.play('explode', u.boss ? 1 : 0.75);
            setTimeout(() => sfx.play('clatter', 0.6), 500);
          }
          const centre = new THREE.Vector3(u.x, 0.5, u.z);
          for (const mesh of w.mesh.shatter(this.scene)) {
            const out = mesh.getWorldPosition(new THREE.Vector3()).sub(centre);
            out.y = Math.max(0.2, out.y);
            out.normalize();
            const v = out.multiplyScalar((1.2 + Math.random() * 2.6) * big);
            v.y += 1.6 + Math.random() * 2.6;
            const spin = new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
            // (some of the pieces smoke)
            w.debris.push({ mesh, v, spin, smoke: Math.random() < 0.35 ? Math.random() * 0.3 : 99 });
          }
          u.wrap.visible = false;
          this.burst(u.x, 0.5, u.z, 0xffffff, 22, 6 * big);
          this.burst(u.x, 0.5, u.z, 0xff8a2a, 26, 5 * big);
          this.burst(u.x, 0.6, u.z, color, 14, 4.5 * big);
          if (near) this.shake = Math.max(this.shake, u === this.me || u.boss ? 0.7 : 0.35);
        }
      }
      // tumbling pieces with gravity, floor bounces and smoke; after a while they sink away
      for (const d of w.debris) {
        d.v.y -= 16 * dt;
        d.mesh.position.addScaledVector(d.v, dt);
        d.mesh.rotation.x += d.spin.x * dt;
        d.mesh.rotation.y += d.spin.y * dt;
        d.mesh.rotation.z += d.spin.z * dt;
        const floor = w.t > 3.4 ? 0.04 - (w.t - 3.4) * 0.4 : 0.04;
        if (d.mesh.position.y < floor) {
          d.mesh.position.y = floor;
          d.v.y *= w.t > 3.4 ? 0 : -0.32;
          d.v.x *= 0.7;
          d.v.z *= 0.7;
          d.spin.multiplyScalar(0.6);
        }
        d.smoke -= dt;
        if (d.smoke <= 0 && w.t < 2.2) {
          d.smoke = 0.4 + Math.random() * 0.5;
          const wp = d.mesh.position;
          this.burst(wp.x, wp.y, wp.z, Math.random() < 0.3 ? 0xff8a2a : 0x8a8a94, 1, 0.2, { float: true, size: 0.04 });
        }
      }
      if (w.t > 4.2) {
        this.dropWreck(w);
        this.wrecks.splice(n, 1);
      }
    }
  }
  private dropWreck(w: Wreck) {
    for (const d of w.debris) d.mesh.removeFromParent();
    if (w.mesh !== w.u.mesh || !this.units.includes(w.u)) w.mesh.dispose();
  }

  /** the nearest item crate this fighter has a clear shot at */
  private nearBox(u: Unit, range: number) {
    let best: ItemBox | null = null;
    let bd = range;
    for (const b of this.boxes) {
      if (b.age < DROP.land) continue;
      const d = Math.hypot(b.x - u.x, b.z - u.z);
      if (d < bd && this.clearLine(u.x, u.z, b.x, b.z)) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  /**
   * charging: a ball of light swells at the muzzle of whoever is charging (an opponent's warns
   * you a big one is coming), and while it's you the stage dims a touch around you
   */
  private drawCharge(dt: number) {
    const me = this.me;
    const yours = !!me && me.alive && me.chargeHold >= CHARGE.hold;
    const lvl = yours ? Math.min(1, me.stored / CHARGE.max) : 0;
    this.dim += ((yours ? 0.1 + lvl * 0.15 : 0) - this.dim) * Math.min(1, dt * (yours ? 5 : 9));
    const moving = stageLight(this.theme.stage ?? this.theme.id, this.time);
    this.hemi.intensity = 1.5 * this.lightK * (1 - 0.45 * this.dim) * moving;
    this.sun.intensity = 2 * this.lightK * (1 - 0.5 * this.dim) * moving;
    for (const u of this.units) {
      const charging = u.alive && u.wrap.visible && u.chargeHold >= CHARGE.hold;
      let orb = this.orbs.get(u);
      if (!charging) {
        if (orb) orb.visible = false;
        continue;
      }
      if (!orb) {
        orb = new THREE.Group();
        const glow = (r: number, opacity: number) => new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
        orb.add(glow(1, 0.85), glow(1.18, 0.3), glow(1.4, 0.1));
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.05, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
        ring.name = 'ring';
        orb.add(ring);
        orb.renderOrder = 5;
        this.scene.add(orb);
        this.orbs.set(u, orb);
      }
      orb.visible = true;
      u.mesh.muzzleFor(u.def.special?.hand ? u.lastHand || 1 : null, this.mz, u.def.special?.hand ?? TWIN.gap);
      // grows toward the next stored marble, so its size reads as how big the shot will be
      // (scaled to these smaller fighters: a full charge is about head-sized)
      const r = u.shotR * 0.5 * Math.max(0.8, Math.min(CHARGE.max, u.stored + ((u.chargeHold - CHARGE.hold) % CHARGE.per) / CHARGE.per));
      const pulse = 1 + Math.sin(this.time * (14 + u.stored * 4)) * 0.08;
      orb.position.set(this.mz.x, Math.max(this.mz.y, r), this.mz.z);
      orb.scale.setScalar(r * pulse);
      const col = new THREE.Color(u.team === (this.me?.team ?? 0) ? 0x7ac8ff : 0xff7a5a).lerp(new THREE.Color(0xffffff), 0.35 + 0.3 * Math.sin(this.time * 9));
      orb.children.forEach((c, k) => ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).color.copy(k === 0 ? new THREE.Color(0xffffff).lerp(col, 0.4) : col));
      orb.getObjectByName('ring')!.rotation.set(this.time * 3, this.time * 4.2, 0);
    }
  }

  private pickups() {
    for (let k = this.drops.length - 1; k >= 0; k--) {
      const d = this.drops[k];
      for (const u of this.units) {
        if (!u.alive || (u.x - d.x) ** 2 + (u.z - d.z) ** 2 > 0.5 ** 2) continue;
        // (in the Gauntlet, what's left lying about is yours)
        if (d.kind !== 'cube' && this.kind === 'gauntlet' && u !== this.me) continue;
        this.gain(u, d.kind);
        d.mesh.removeFromParent();
        this.drops.splice(k, 1);
        break;
      }
    }
  }

  /**
   * a held item goes out instead of the next shot, as in the main game: the Dragon Shot's three
   * heavy weaving balls, or the Steel Ball that homes in (its three hits landing as one)
   */
  private fireItem(u: Unit) {
    const kind = u.item!;
    u.item = null;
    const angle = u.aim;
    if (kind === 'dragon') {
      for (let k = 0; k < DRAGON.count; k++)
        u.queue.push({
          t: k * DRAGON.gap,
          angle,
          o: { dmg: u.dmg * DRAGON.damage * u.power, r: 0.15 * DRAGON.radius * 1.4, speed: SHOT_SPEED * DRAGON.speed, left: 10, weave: true, color: new THREE.Color(ITEMS.dragon.color), home: 0 },
        });
      sfx.play('super', u === this.me ? 0.8 : 0.4);
    } else {
      const tgt = this.nearestFoe(u, 16);
      u.queue.push({
        t: 0,
        angle,
        o: { dmg: u.dmg * 2 * MISSILE.hits * u.power, r: 0.32, speed: MISSILE.speed, left: MISSILE.speed * MISSILE.life * 0.6, home: MISSILE.turnRate, tgt, recover: 0.2, color: new THREE.Color(0xdfe6ee) },
      });
      sfx.play('super', u === this.me ? 0.8 : 0.4);
    }
    u.pose.kickT = 0;
    u.pose.recoil = 1;
    return 1;
  }

  private tickStorm(dt: number) {
    const half = this.W / 2;
    const t = Math.max(0, Math.min(1, (this.time - STORM_START) / (STORM_END - STORM_START)));
    this.storm = half - t * (half - 3);
    if (this.time > STORM_START && this.time - dt <= STORM_START) this.callout('THE STORM IS CLOSING IN');
    for (const u of this.units) {
      if (!u.alive) continue;
      if (Math.abs(u.x) > this.storm || Math.abs(u.z) > this.storm) {
        u.hp -= STORM_DPS * dt;
        u.calm = 0;
        if (u.hp <= 0) this.ko(u, null);
      }
    }
  }

  /** Hot Zone: whoever has fighters in the ring, and nobody of the other side, fills their meter */
  private tickZone(dt: number) {
    const inside = [0, 1].map((t) => this.units.filter((u) => u.team === t && u.alive && Math.hypot(u.x, u.z) < ZONE_R).length);
    const hold = inside[0] && !inside[1] ? 0 : inside[1] && !inside[0] ? 1 : inside[0] && inside[1] ? 2 : -1;
    if (hold === 0 || hold === 1) {
      this.zoneScore[hold] = Math.min(100, this.zoneScore[hold] + dt * (ZONE_RATE[0] + ZONE_RATE[1] * (inside[hold] - 1)));
      if (this.zoneScore[hold] >= 100 && !this.over) this.finishSiege(hold === 0 ? 1 : -1);
    }
    if (hold !== this.zoneHold) {
      if (hold === 0) this.callout('YOU HOLD THE ZONE');
      else if (hold === 1) this.callout('THEY HOLD THE ZONE', 1);
      else if (hold === 2) this.callout('CONTESTED');
      this.zoneHold = hold;
    }
    if (this.zoneDisc && this.zoneRing) {
      const col = hold === 0 ? 0x4aa8f0 : hold === 1 ? 0xff5a5a : hold === 2 ? 0xffffff : 0xffd23e;
      (this.zoneDisc.material as THREE.MeshBasicMaterial).color.setHex(col);
      (this.zoneDisc.material as THREE.MeshBasicMaterial).opacity = hold >= 0 ? 0.28 + Math.sin(this.time * 6) * 0.06 : 0.16;
      (this.zoneRing.material as THREE.MeshBasicMaterial).color.setHex(col);
    }
  }
  /** Boss Fight: the giant grows wilder as it's hurt (at two thirds and a third), calling in two fighters each time */
  private tickGiant(dt: number) {
    const g = this.giant;
    if (!g?.alive) return;
    // (its special charges by itself, quickly: about every 10 s, then 6, then 4 once it's berserk)
    g.charge = Math.min(1, g.charge + dt * (0.1 + this.giantPhase * 0.07));
    const phase = g.hp < g.max / 3 ? 2 : g.hp < (g.max * 2) / 3 ? 1 : 0;
    if (phase <= this.giantPhase) return;
    this.giantPhase = phase;
    g.power *= 1.25;
    g.fireInt /= 1.25;
    g.speed *= 1.15;
    this.shake = Math.max(this.shake, 0.5);
    this.ringFx(g.x, g.z, 0xff3a3a, 0.5, 6, 0.7);
    this.pillarFx(g.x, g.z, 0xff3a3a, 1.4);
    sfx.play('gong');
    this.callout(phase === 1 ? 'THE BOSS IS ENRAGED!' : 'THE BOSS GOES BERSERK!', 1);
    this.pickFoes(2).forEach((d, k) => {
      const u = this.makeUnit(d, g.x + (k ? 1.6 : -1.6), g.z + 1, true, 1, { hp: 0.6, dmg: 0.8 });
      u.aimError = 0.14;
    });
  }
  /** Knockout: everyone back on their feet at their own end for the next round */
  private nextRound() {
    if (this.over || this.kind !== 'knockout') return;
    this.kRound++;
    this.kRoundT = 0;
    this.kBreak = 0;
    this.shots = [];
    for (const u of this.units) {
      u.back = 0;
      this.respawn(u);
    }
    this.camSnap = true;
    this.callout(`ROUND ${this.kRound}`);
    sfx.play('go');
  }

  private checkEnd() {
    if (this.kind === 'zone' || this.kind === 'boss') {
      const T = this.kind === 'zone' ? ZONE_TIME : BOSS_TIME;
      if (!this.over && this.time >= T) {
        // the bell: the zone to whoever has more; the giant, if it's still standing, wins
        const [a, b] = this.zoneScore;
        this.finishSiege(this.kind === 'boss' ? -1 : Math.abs(a - b) < 0.5 ? 0 : a > b ? 1 : -1);
      }
      if (!this.over && this.time >= T - 30 && !this.warned) {
        this.warned = true;
        this.callout('30 SECONDS LEFT');
      }
      return;
    }
    if (this.kind === 'knockout') {
      if (this.over || this.kBreak > 0) return;
      const left = [0, 1].map((t) => this.units.filter((u) => u.team === t && u.alive).length);
      let winner = -1;
      if (!left[0] || !left[1]) winner = left[0] ? 0 : left[1] ? 1 : -1;
      else if (this.kRoundT >= ROUND_TIME) {
        // out of time: the side with more health left
        const hp = [0, 1].map((t) => this.units.filter((u) => u.team === t && u.alive).reduce((n, u) => n + u.hp / u.max, 0));
        winner = Math.abs(hp[0] - hp[1]) < 0.01 ? -1 : hp[0] > hp[1] ? 0 : 1;
        if (winner < 0) winner = 2;
      }
      if (winner === -1 && (left[0] && left[1])) return;
      if (winner === 0 || winner === 1) this.kWins[winner]++;
      if (this.kWins[0] >= 2 || this.kWins[1] >= 2) {
        this.finishSiege(this.kWins[0] >= 2 ? 1 : -1);
        return;
      }
      this.callout(winner === 0 ? `ROUND ${this.kRound} TO YOUR SIDE` : winner === 1 ? `ROUND ${this.kRound} TO THEIRS` : `ROUND ${this.kRound} · A DRAW`, winner === 1 ? 1 : 0);
      this.kBreak = 1.8;
      setTimeout(() => this.nextRound(), 1800);
      return;
    }
    if (this.kind === 'siege') {
      if (!this.over && this.time >= SIEGE_TIME) {
        // the bell: whichever fortress has more left
        const [mine, theirs] = [0, 1].map((t) => this.forts.find((f) => f.team === t)!.hp / FORT_HP);
        this.finishSiege(Math.abs(mine - theirs) < 0.005 ? 0 : mine > theirs ? 1 : -1);
      }
      if (!this.over && this.time >= SIEGE_TIME - 30 && !this.warned) {
        this.warned = true;
        this.callout('30 SECONDS LEFT');
      }
      return;
    }
    if (this.over || !this.me?.alive) return;
    const foes = this.units.filter((u) => u !== this.me && u.alive).length;
    if (this.kind === 'ffa') {
      if (!foes) this.finish(true, 1);
      return;
    }
    // Dungeon Run: the room you're sealed in is clear
    const r = this.activeRoom;
    if (r && !foes && !this.cleared) {
      this.cleared = true;
      r.cleared = true;
      this.room++;
      sfx.play('win', 0.6);
      if (r.kind === 'boss') {
        this.callout('BOSS DOWN');
        if (this.stage >= DSTAGES.length || this.story) setTimeout(() => this.finish(true, 1), 1000);
        else setTimeout(() => !this.over && this.showPanel('stage'), 1000);
        return;
      }
      this.callout(r.kind === 'key' ? 'ROOM CLEAR · TAKE THE KEY' : 'ROOM CLEAR · CHECKPOINT');
      if (!this.roomSaid) {
        this.roomSaid = true;
        this.storySay(this.story?.says?.room);
      }
      this.checkpoint = this.roomMiddle(r);
      // (a breather: a good part of your health back with each room)
      if (this.me) {
        const heal = Math.round(this.me.max * 0.35);
        const got = Math.min(heal, this.me.max - this.me.hp);
        this.me.hp += got;
        if (got > 0) this.pop(this.me.x, this.me.z, `+${got}`, 'good');
      }
      this.roomReward(r);
      setTimeout(() => this.offerUpgrades(), 700);
    }
  }

  private openDoor() {
    const r = this.activeRoom;
    if (!r) return;
    for (const k of r.doors) this.grid[k] = FLOOR;
    for (const g of this.doorMeshes) g.removeFromParent();
    this.doorMeshes = [];
    this.activeRoom = null;
    this.callout('THE DOORS ARE OPEN');
    sfx.play('whoosh');
  }

  // ---------- Dungeon Run ----------

  /** a barred door across tile k (turned to fit a door in a side wall) */
  private barsAt(k: number, color: number, glow: number) {
    const i = k % this.W;
    const j = Math.floor(k / this.W);
    const p = this.center(i, j);
    const geo = new THREE.BoxGeometry(1, 1, 0.3);
    geo.translate(0, 0.5, 0);
    const bars = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, emissive: glow, roughness: 0.5 }));
    bars.position.set(p.x, 0, p.z);
    bars.scale.y = this.wallCur;
    // (a door in a side wall: open floor left and right of it means it runs up and down)
    const side = this.grid[this.idx(i - 1, j)] === WALL || this.grid[this.idx(i + 1, j)] === WALL || this.grid[this.idx(i - 1, j)] === ROCK;
    const updown = !side && (this.grid[this.idx(i, j - 1)] === WALL || this.grid[this.idx(i, j + 1)] === WALL);
    if (updown || (!side && this.isSideDoor(k))) bars.rotation.y = Math.PI / 2;
    this.world.add(bars);
    return bars;
  }
  /** a door in a room's left or right wall */
  private isSideDoor(k: number) {
    const i = k % this.W;
    return !!this.dg?.rooms.some((r) => r.doors.includes(k) && (i === r.i0 - 1 || i === r.i1 + 1));
  }

  /** the dungeon's dressing: torches on the room walls, the traps, a chest at the start and in the vault, a lamp on you */
  private drawDungeon() {
    const dg = this.dg;
    if (!dg) return;
    // torches round each room, every few tiles along the walls (not by the doors), in the stage's fire
    const fire = { accent: this.dstage().torch };
    for (const r of dg.rooms) {
      const ring: [number, number][] = [];
      for (let i = r.i0 + 1; i < r.i1; i += 3) ring.push([i, r.j0 - 1]);
      for (let j = r.j0 + 2; j < r.j1; j += 4) ring.push([r.i0 - 1, j], [r.i1 + 1, j]);
      for (const [i, j] of ring) {
        const k = this.idx(i, j);
        if (this.grid[k] !== WALL || r.doors.some((d) => Math.abs((d % this.W) - i) + Math.abs(Math.floor(d / this.W) - j) < 2)) continue;
        const p = this.center(i, j);
        const t = propModel('torch', fire);
        // (on the room's side of the wall)
        const dx = i < r.i0 ? 0.55 : i > r.i1 ? -0.55 : 0;
        const dz = j < r.j0 ? 0.55 : j > r.j1 ? -0.55 : 0;
        t.position.set(p.x + dx, (this.wallCur - 1.1) * 0.36, p.z + dz);
        t.userData.seed = Math.random() * 10;
        this.world.add(t);
        this.torches.push(t);
      }
    }
    this.placeLandmarks();
    // the traps (built from their Unit Lab designs; the parts that move are found by name)
    for (const t of dg.traps) {
      if (t.kind === 'spikes') {
        const g = new THREE.Group();
        for (const k of t.tiles) {
          const p = this.center(k % this.W, Math.floor(k / this.W));
          const m = propModel('spikes');
          m.position.set(p.x, 0, p.z);
          g.add(m);
        }
        this.world.add(g);
        const blades: THREE.Object3D[] = [];
        g.traverse((o) => o.name === 'blades' && blades.push(o));
        this.traps.push({ kind: 'spikes', tiles: t.tiles, phase: t.phase, mesh: g, blades, cyc: -1, hit: new Set() });
      } else if (t.kind === 'axe') {
        const p = this.center(t.i, t.j);
        const m = propModel('axe');
        m.position.set(p.x, 0, p.z);
        // (its beam lies across the corridor, the blade swinging from side to side)
        if (t.along === 'i') m.rotation.y = Math.PI / 2;
        this.world.add(m);
        this.traps.push({ kind: 'axe', x: p.x, z: p.z, along: t.along, phase: t.phase, arm: m.getObjectByName('arm') ?? m });
      } else {
        const a = this.center(t.from.i, t.from.j);
        const b = this.center(t.to.i, t.to.j);
        const m = propModel('boulder');
        m.visible = false;
        this.world.add(m);
        this.traps.push({ kind: 'boulder', x0: a.x, z0: a.z, x1: b.x, z1: b.z, phase: t.phase, mesh: m, rock: m.getObjectByName('rock') ?? m, rolling: false });
      }
    }
    // a chest by the start, and the vault's (always Epic or better)
    const start = dg.rooms.find((r) => r.kind === 'start');
    if (start) {
      const p = this.center(start.i0 + 1, start.j0 + 1);
      this.makeChest(p.x, p.z, rollGear(0, 0));
    }
    for (const v of dg.rooms.filter((r) => r.kind === 'vault')) {
      const p = this.roomMiddle(v);
      this.makeChest(p.x, p.z, rollGear(2, v.depth));
    }
    // a warm lamp that goes with you, and the rest of the light turned down
    this.lightK = 0.62;
    this.lamp = new THREE.PointLight(this.dstage().lamp, 46, 17, 1.6);
    this.scene.add(this.lamp);
  }

  /** the open floor tile nearest a room's middle */
  private roomMiddle(r: DRoom) {
    const ci = (r.i0 + r.i1) >> 1;
    const cj = (r.j0 + r.j1) >> 1;
    for (let d = 0; d < 6; d++)
      for (let dj = -d; dj <= d; dj++)
        for (let di = -d; di <= d; di++) if (this.grid[this.idx(ci + di, cj + dj)] === FLOOR) return this.center(ci + di, cj + dj);
    return this.center(ci, cj);
  }

  /** each room's landmark, in a corner clear of its doors */
  private placeLandmarks() {
    const dg = this.dg;
    if (!dg) return;
    const traps = new Set(dg.traps.flatMap((t) => ('tiles' in t ? t.tiles : [])));
    for (const r of dg.rooms) {
      const corners: [number, number][] = [[r.i0 + 1, r.j0 + 1], [r.i1 - 1, r.j0 + 1], [r.i0 + 1, r.j1 - 1], [r.i1 - 1, r.j1 - 1]];
      const clear = corners.filter(([i, j]) => this.grid[this.idx(i, j)] === FLOOR && !traps.has(this.idx(i, j)) && !r.doors.some((d) => Math.abs((d % this.W) - i) + Math.abs(Math.floor(d / this.W) - j) < 4));
      const at = clear[0];
      if (!at) continue;
      const p = this.center(at[0], at[1]);
      const m = landmark(r.kind, this.theme.wall, this.dstage().torch);
      m.position.set(p.x, 0, p.z);
      // (facing the room)
      m.rotation.y = (at[0] < (r.i0 + r.i1) / 2 ? 1 : -1) * (at[1] < (r.j0 + r.j1) / 2 ? 0.5 : 2.6);
      this.world.add(m);
    }
  }

  private makeChest(x: number, z: number, gear: Gear) {
    const root = propModel('chest');
    root.position.set(x, 0, z);
    this.world.add(root);
    this.chests.push({ x, z, open: false, root, lid: root.getObjectByName('lid') ?? root, gear, t: 0 });
  }

  /** a launcher on the floor: a gem in its rarity's colour with a beam of light over it */
  private dropLoot(x: number, z: number, gear: Gear) {
    const root = new THREE.Group();
    const c = RARITY[gear.rarity].hex;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.3 }));
    gem.position.y = 0.6;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 3.2, 12, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 1.6;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.5, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.7, depthWrite: false }));
    ring.position.y = 0.03;
    root.add(gem, beam, ring);
    root.position.set(x, 0, z);
    this.world.add(root);
    const l: Loot = { x, z, gear, root, gem, away: true };
    this.loot.push(l);
    return l;
  }

  /** what a cleared room leaves: the key in the key room, sometimes a chest */
  private roomReward(r: DRoom) {
    const p = this.roomMiddle(r);
    if (r.kind === 'key') {
      const root = propModel('keystand');
      root.position.set(p.x, 0, p.z);
      this.world.add(root);
      this.keyItem = { x: p.x, z: p.z, root };
      this.ringFx(p.x, p.z, 0xffc83e, 0.3, 1.6, 0.6);
    } else if (Math.random() < 0.5) {
      this.makeChest(p.x, p.z, rollGear(0, r.depth));
    }
  }

  /** walk into a room you haven't cleared: its doors shut and its fighters appear */
  private enterRoom(r: DRoom) {
    this.activeRoom = r;
    this.cleared = false;
    for (const k of r.doors) {
      this.grid[k] = GATE;
      this.doorMeshes.push(this.barsAt(k, 0xff5a5a, 0x801010));
    }
    this.spawnRoom(r);
    // (a story's boss has something to say first)
    if (r.kind === 'boss' && this.story?.bossTalk && !this.bossTalked) {
      this.bossTalked = true;
      this.paused = true;
      this.story.bossTalk(() => {
        this.paused = false;
        this.last = performance.now();
      });
    }
    this.callout(r.kind === 'boss' ? characterById(this.story?.boss ?? BOSSES[Math.min(this.stage, BOSSES.length) - 1].id).name.toUpperCase() : r.kind === 'key' ? 'THE KEY ROOM' : `ROOM ${this.room}`, r.kind === 'boss' ? 1 : 0);
    sfx.play(r.kind === 'boss' ? 'gong' : 'go');
  }

  /** your launcher's bonuses on (and the last one's off) */
  private applyGear(prev: Gear, next: Gear) {
    const me = this.me;
    if (!me) return;
    me.power = (me.power / (1 + prev.dmg)) * (1 + next.dmg);
    me.fireInt = (me.fireInt * (1 + prev.rate)) / (1 + next.rate);
    me.refill = (me.refill / (1 + prev.rate)) * (1 + next.rate);
  }

  private equip(l: Loot) {
    const old = this.gear;
    this.applyGear(old, l.gear);
    this.gear = l.gear;
    sfx.play('charge');
    this.pop(this.me!.x, this.me!.z, l.gear.name.toUpperCase(), 'good');
    // (what you were holding goes down where the new one was, so you can change your mind)
    l.root.removeFromParent();
    this.loot.splice(this.loot.indexOf(l), 1);
    if (old !== STARTER) this.dropLoot(l.x, l.z, old);
    this.lootOpen = null;
    this.showPanel(null);
  }

  /** a launcher's card, its numbers against another's (green better, red worse) */
  private gearCard(g: Gear, vs: Gear | null, label: string) {
    const el = document.createElement('div');
    el.className = 'ac-gear';
    el.style.setProperty('--rar', RARITY[g.rarity].color);
    const pct = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
    const diff = (a: number, b: number) => (Math.abs(a - b) < 0.005 ? '' : `<em class="${a > b ? 'up' : 'down'}">${a > b ? '▲' : '▼'}</em>`);
    const pw = gearPower(g);
    const vp = vs ? gearPower(vs) : 0;
    const rows: string[] = [];
    const stat = (v: number, w: number, name: string) => {
      if (Math.abs(v) < 0.005 && (!vs || Math.abs(w) < 0.005)) return;
      rows.push(`<li class="${v < 0 ? 'neg' : ''}">${pct(v)} ${name}${vs ? diff(v, w) : ''}</li>`);
    };
    stat(g.dmg, vs?.dmg ?? 0, 'damage');
    stat(g.rate, vs?.rate ?? 0, 'fire rate');
    stat(g.crit, vs?.crit ?? 0, 'critical hit chance');
    const change = vs && vp ? Math.round((pw / vp - 1) * 100) : 0;
    el.innerHTML = `<small>${label}</small><b>${g.name}</b><span class="rar">${RARITY[g.rarity].name}</span>
      <p class="pow">Power ${pw}${vs && change ? ` <em class="${change > 0 ? 'up' : 'down'}">${change > 0 ? '+' : ''}${change}%</em>` : ''}</p>
      ${rows.length ? `<ul>${rows.join('')}</ul>` : '<ul><li class="none">No bonuses</li></ul>'}
      ${g.perk ? `<p class="perk"><b>${PERKS[g.perk].name}</b> ${PERKS[g.perk].text}</p>` : ''}`;
    return el;
  }

  private tickDungeon(dt: number) {
    const dg = this.dg;
    const me = this.me;
    if (!dg || !me) return;
    this.rageT = Math.max(0, this.rageT - dt);
    this.tickTraps();
    // the lamp goes with you
    if (this.lamp) {
      this.lamp.position.set(me.x, 5.2, me.z + 0.6);
      // (firelight: it never quite holds still)
      this.lamp.intensity = 46 * (0.9 + Math.sin(this.time * 11) * 0.05 + Math.sin(this.time * 23.7) * 0.05);
    }
    // chests spring open, loot spins
    for (const c of this.chests) if (c.open && c.t < 1) {
      c.t = Math.min(1, c.t + dt * 3);
      c.lid.rotation.x = -1.9 * c.t;
    }
    for (const l of this.loot) {
      l.gem.rotation.y += dt * 2;
      l.gem.position.y = 0.6 + Math.sin(this.time * 3 + l.x) * 0.08;
    }
    if (this.keyItem) {
      const k = this.keyItem.root.getObjectByName('key');
      if (k) {
        k.rotation.y += dt * 2.2;
        k.position.y = 0.95 + Math.sin(this.time * 3) * 0.06;
      }
    }
    if (!me.alive) return;
    const i = Math.floor(me.x + this.W / 2);
    const j = Math.floor(me.z + this.H / 2);
    // the rooms: seen as you step in, and an uncleared one shuts you in once you're well inside
    for (const r of dg.rooms) {
      const inside = i >= r.i0 && i <= r.i1 && j >= r.j0 && j <= r.j1;
      if (!inside) continue;
      if (!r.seen) {
        r.seen = true;
        for (let y = r.j0 - 1; y <= r.j1 + 1; y++) for (let x = r.i0 - 1; x <= r.i1 + 1; x++) this.seen[this.idx(x, y)] = 1;
      }
      if (!r.cleared && !this.activeRoom && i > r.i0 && i < r.i1 && j > r.j0 && j < r.j1) this.enterRoom(r);
    }
    // the corridors: seen a few tiles round you
    if ((this.seenT -= dt) <= 0) {
      this.seenT = 0.2;
      for (let y = j - 4; y <= j + 4; y++)
        for (let x = i - 4; x <= i + 4; x++) if (x >= 0 && y >= 0 && x < this.W && y < this.H && (x - i) ** 2 + (y - j) ** 2 <= 20) this.seen[this.idx(x, y)] = 1;
    }
    const calm = !this.activeRoom;
    // a chest opens as you reach it (once the room's quiet)
    for (const c of this.chests) {
      if (c.open || !calm || Math.hypot(c.x - me.x, c.z - me.z) > 1.1) continue;
      c.open = true;
      sfx.play('charge', 0.7);
      this.burst(c.x, 0.6, c.z, RARITY[c.gear.rarity].hex, 16, 3);
      // (the launcher lands in front of the chest, toward you)
      const a = Math.atan2(me.x - c.x, me.z - c.z);
      this.dropLoot(c.x + Math.sin(a) * 0.9, c.z + Math.cos(a) * 0.9, c.gear).away = true;
    }
    // loot: step on it to look (stepping off and on again to look again)
    for (const l of this.loot) {
      const d = Math.hypot(l.x - me.x, l.z - me.z);
      if (d > 1.2) l.away = false;
      if (!l.away && calm && !this.paused && d < 0.7) {
        l.away = true;
        this.lootOpen = l;
        this.showPanel('loot');
        break;
      }
    }
    // the key
    if (this.keyItem && Math.hypot(this.keyItem.x - me.x, this.keyItem.z - me.z) < 0.9) {
      this.keyItem.root.getObjectByName('key')?.removeFromParent();
      this.keyItem = null;
      this.hasKey = true;
      sfx.play('win', 0.5);
      this.callout('KEY FOUND · THE BOSS DOOR AWAITS');
      this.storySay(this.story?.says?.key);
    }
    // the boss's door: opens to the key
    this.lockedT -= dt;
    if (this.lockMeshes.length && dg.lock.some((k) => {
      const p = this.center(k % this.W, Math.floor(k / this.W));
      return Math.hypot(p.x - me.x, p.z - me.z) < 1.7;
    })) {
      if (this.hasKey) {
        for (const k of dg.lock) this.grid[k] = FLOOR;
        for (const m of this.lockMeshes) m.removeFromParent();
        this.lockMeshes = [];
        sfx.play('whoosh');
        this.callout('UNLOCKED');
        this.storySay(this.story?.says?.door);
      } else if (this.lockedT <= 0) {
        this.lockedT = 3;
        this.callout('LOCKED · FIND THE KEY', 1);
      }
    }
    if ((this.mapT -= dt) <= 0) {
      this.mapT = 0.15;
      this.drawMap();
    }
  }

  /**
   * Dungeon Run: back on your feet at the checkpoint. The room you went down in starts over:
   * its fighters go, its doors open, and it fills again when you walk back in
   */
  private backToCheckpoint() {
    if (this.over || this.kind !== 'gauntlet' || !this.me) return;
    const r = this.activeRoom;
    if (r) {
      for (const u of this.units.filter((x) => x !== this.me && x.alive)) {
        u.mesh.dispose();
        u.bar.remove();
        u.wrap.removeFromParent();
        u.shadow.removeFromParent();
        this.auras.get(u)?.removeFromParent();
        this.auras.delete(u);
        this.orbs.get(u)?.removeFromParent();
        this.orbs.delete(u);
      }
      this.units = this.units.filter((x) => x === this.me || !x.alive);
      for (const k of r.doors) this.grid[k] = FLOOR;
      for (const g of this.doorMeshes) g.removeFromParent();
      this.doorMeshes = [];
      this.activeRoom = null;
      this.cleared = false;
    }
    this.shots = [];
    this.respawn(this.me, this.checkpoint);
    this.me.charge = Math.max(this.me.charge, 0.5);
    this.trapHit.set(this.me, this.time + 1.5);
    this.callout(`BACK AT THE CHECKPOINT · ${this.lives} ${this.lives === 1 ? 'LIFE' : 'LIVES'} LEFT`);
    sfx.play('go');
  }

  /** a trap catches someone: a share of their health, and a shove */
  private trapHurt(u: Unit, share: number, push?: { x: number; z: number }) {
    const t = this.trapHit.get(u) ?? -9;
    if (this.time - t < 0.7) return;
    this.trapHit.set(u, this.time);
    this.hurt(u, u.max * share, null);
    u.pose.flash = 1;
    if (push) this.walk(u, push.x, push.z);
    if (u === this.me) {
      this.shake = Math.max(this.shake, 0.25);
      this.opts.vibrate?.(30);
    }
  }

  private tickTraps() {
    const live = this.units.filter((u) => u.alive);
    for (const t of this.traps) {
      if (t.kind === 'spikes') {
        // down, a warning peek, up, back down: three seconds round
        const T = (this.time + t.phase) % 3;
        const cyc = Math.floor((this.time + t.phase) / 3);
        const h = T < 1.7 ? 0 : T < 2 ? 0.35 : T < 2.8 ? 1 : 1 - (T - 2.8) / 0.2;
        for (const b of t.blades) b.position.y = -0.5 + 0.5 * h;
        if (cyc !== t.cyc) {
          t.cyc = cyc;
          t.hit.clear();
        }
        if (T >= 2 && T < 2.8)
          for (const u of live) {
            if (t.hit.has(u) || !t.tiles.includes(this.tileOf(u.x, u.z))) continue;
            t.hit.add(u);
            this.trapHurt(u, 0.06);
          }
      } else if (t.kind === 'axe') {
        const th = 1.05 * Math.sin(this.time * 2.4 + t.phase);
        // (it swings across the corridor: about z when the corridor runs along z, about x otherwise)
        // (the arm swings across its beam; turned for a corridor along x, its side-to-side runs along z, mirrored)
        t.arm.rotation.z = th;
        if (Math.abs(th) > 0.7) continue;
        const lat = (t.along === 'j' ? 1 : -1) * 2.3 * Math.sin(th);
        const dir = Math.sign(Math.cos(this.time * 2.4 + t.phase)) || 1;
        for (const u of live) {
          const along = t.along === 'j' ? u.z - t.z : u.x - t.x;
          const side = t.along === 'j' ? u.x - t.x : u.z - t.z;
          if (Math.abs(along) < 0.45 && Math.abs(side - lat) < 0.55) this.trapHurt(u, 0.09, t.along === 'j' ? { x: dir * 0.8, z: 0 } : { x: 0, z: dir * 0.8 });
        }
      } else {
        // the boulder: a wait, then a roll from one end to the other, then it sinks away
        const len = Math.hypot(t.x1 - t.x0, t.z1 - t.z0);
        const roll = len / 6.5;
        const T = (this.time + t.phase) % (roll + 2.4);
        const on = T < roll;
        t.mesh.visible = on;
        if (on && !t.rolling && this.me && Math.hypot(this.me.x - t.x0, this.me.z - t.z0) < 12) sfx.play('whoosh', 0.6);
        t.rolling = on;
        if (!on) continue;
        const k = T / roll;
        const x = t.x0 + (t.x1 - t.x0) * k;
        const z = t.z0 + (t.z1 - t.z0) * k;
        t.mesh.position.set(x, 0, z);
        const d = k * len;
        if (Math.abs(t.x1 - t.x0) > Math.abs(t.z1 - t.z0)) t.rock.rotation.z = -Math.sign(t.x1 - t.x0) * d / 0.95;
        else t.rock.rotation.x = Math.sign(t.z1 - t.z0) * d / 0.95;
        for (const u of live) {
          if (Math.hypot(u.x - x, u.z - z) > 0.95 + u.r * 0.8) continue;
          // (shoved to whichever side of it they're on)
          const sx = Math.abs(t.x1 - t.x0) > Math.abs(t.z1 - t.z0) ? 0 : Math.sign(u.x - x) || 1;
          const sz = sx ? 0 : Math.sign(u.z - z) || 1;
          this.trapHurt(u, 0.12, { x: sx * 1.2, z: sz * 1.2 });
        }
      }
    }
  }

  /** the map in the corner: what you've seen, you, the fighters in your room, chests, loot, the key */
  private drawMap() {
    const cv = this.el.querySelector('.ac-map') as HTMLCanvasElement;
    const dg = this.dg;
    if (!cv || !dg) return;
    const s = 3;
    if (cv.width !== this.W * s) {
      cv.width = this.W * s;
      cv.height = this.H * s;
    }
    const c = cv.getContext('2d')!;
    c.clearRect(0, 0, cv.width, cv.height);
    for (let j = 0; j < this.H; j++)
      for (let i = 0; i < this.W; i++) {
        const k = this.idx(i, j);
        if (!this.seen[k]) continue;
        const t = this.grid[k];
        c.fillStyle = t === WALL ? '#5a4232' : t === GATE ? (dg.lock.includes(k) ? '#ffc83e' : '#ff5a5a') : t === ROCK ? 'transparent' : '#c8ab80';
        if (t !== ROCK) c.fillRect(i * s, j * s, s, s);
      }
    const dot = (x: number, z: number, color: string, r: number) => {
      const i = x + this.W / 2;
      const j = z + this.H / 2;
      if (!this.seen[this.idx(Math.floor(i), Math.floor(j))]) return;
      c.fillStyle = color;
      c.beginPath();
      c.arc(i * s, j * s, r, 0, Math.PI * 2);
      c.fill();
    };
    for (const ch of this.chests) if (!ch.open) dot(ch.x, ch.z, '#ffb02a', 3);
    for (const l of this.loot) dot(l.x, l.z, RARITY[l.gear.rarity].color, 3);
    if (this.keyItem) dot(this.keyItem.x, this.keyItem.z, '#fff27a', 3.5);
    for (const u of this.units) if (u.alive && u !== this.me) dot(u.x, u.z, '#ff4a4a', u.boss ? 4.5 : 3);
    if (this.me) {
      c.strokeStyle = '#0a2a12';
      c.lineWidth = 2;
      const i = this.me.x + this.W / 2;
      const j = this.me.z + this.H / 2;
      c.fillStyle = '#5aff8a';
      c.beginPath();
      c.arc(i * s, j * s, 4, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
  }

  // ---------- the CPU ----------

  private think(u: Unit, dt: number) {
    // (striking the special's pose: it holds still)
    if (u.spT >= 0) {
      u.vx = u.vz = 0;
      u.firing = false;
      return;
    }
    // (its special fills by itself too, so the other side gets theirs as often as you do; the giant has its own)
    if (!u.giant) u.charge = Math.min(1, u.charge + dt / (this.kind === 'gauntlet' ? CPU_SPECIAL_FILL * 1.8 : CPU_SPECIAL_FILL));
    u.think -= dt;
    u.strafeT -= dt;
    if (u.strafeT <= 0) {
      u.strafe = -u.strafe;
      u.strafeT = 0.9 + Math.random() * 1.6;
    }
    if (u.think <= 0) {
      u.think = 0.25;
      let best: Unit | null = null;
      // (in free-for-all it only takes on what's near, so the stage doesn't all pile into the middle)
      let bd = this.kind === 'gauntlet' || this.kind === 'boss' ? 13 : this.kind === 'ffa' ? 6.5 : 9;
      for (const o of this.units) {
        if (!this.hostile(u, o) || !this.targetable(u, o)) continue;
        const d = Math.hypot(o.x - u.x, o.z - u.z);
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      if (best !== u.target) u.aimDelay = 0.25 + Math.random() * 0.35;
      u.target = best;
      // (the Gauntlet's fighters always know where you are, and come for you)
      if (!best && this.kind === 'gauntlet' && this.me?.alive) u.goal = { x: this.me.x, z: this.me.z };
      else if (this.kind === 'siege') u.goal = this.siegeGoal(u, best);
      else if (this.teams) u.goal = this.teamGoal(u, best);
      else if (!best && (!u.goal || Math.hypot(u.goal.x - u.x, u.goal.z - u.z) < 0.8 || Math.random() < 0.02)) u.goal = this.wanderGoal(u);
      // where it's headed, if a wall is in the way: the way round
      const to = best ?? u.goal;
      u.step = to && !this.clearLine(u.x, u.z, to.x, to.z) ? this.route(u, to.x, to.z) : null;
    }
    let dx = 0;
    let dz = 0;
    const range = u.range;
    const low = this.kind === 'ffa' && u.hp < u.max * 0.3;
    // the trigger: hold back once the magazine's empty until it's mostly full again
    if (u.ammo < 1) u.reloading = true;
    if (u.reloading && u.ammo >= u.mag * 0.6) u.reloading = false;
    u.cycle -= dt;
    if (u.cycle < -0.3 - Math.random() * 0.5) u.cycle = 0.5 + Math.random() * 0.8;
    let fire = false;
    if (u.target && u.target.alive && !this.targetable(u, u.target)) {
      u.goal = { x: u.target.x, z: u.target.z };
      u.target = null;
    }
    const tgt = u.target && u.target.alive ? u.target : null;
    if (tgt) {
      const ox = tgt.x - u.x;
      const oz = tgt.z - u.z;
      const d = Math.hypot(ox, oz) || 1;
      const los = this.clearLine(u.x, u.z, tgt.x, tgt.z);
      const want = low ? range * 1.2 : range * (u.marble === 'heavy' ? 0.55 : 0.68);
      if (!los && u.step) {
        // round the wall toward it
        const sx = u.step.x - u.x;
        const sz = u.step.z - u.z;
        const sd = Math.hypot(sx, sz) || 1;
        dx = sx / sd;
        dz = sz / sd;
      } else {
        const push = d > want + 0.8 ? 1 : d < want - 0.8 ? -1 : 0;
        dx = (ox / d) * push + (-oz / d) * u.strafe * 0.8;
        dz = (oz / d) * push + (ox / d) * u.strafe * 0.8;
      }
      u.aimDelay -= dt;
      if (los && d < range * 0.95 && u.aimDelay <= 0) {
        // lead the target a little, with a miss that shrinks as the rooms go on
        const lead = (d / u.shotSpeed) * 0.6;
        const px = tgt.x + tgt.vx * lead;
        const pz = tgt.z + tgt.vz * lead;
        const ang = Math.atan2(px - u.x, -(pz - u.z)) + (Math.random() - 0.5) * 2 * u.aimError;
        u.aim = ang;
        if (u.charge >= 1 && d < 7.5) this.special(u, ang);
        else {
          fire = !u.reloading && u.cycle > 0;
          // now and then it plans a charge shot instead (2 to 4 marbles)
          // (as in the other modes: Settings can turn opponents' charge shots, and your side's, off)
          const may = u.team === 0 ? (this.opts.allyCharge?.() ?? true) : (this.opts.cpuCharge?.() ?? true);
          if (may && fire && u.chargeWant === 0 && u.chargeHold === 0 && u.ammo >= 5 && Math.random() < dt * 0.35) u.chargeWant = 2 + Math.floor(Math.random() * 3);
        }
      }
      u.face = Math.atan2(ox, -oz);
    } else {
      // Siege, nothing in sight: knock at their fortress once it's in range
      const fort = this.kind === 'siege' ? this.forts.find((f) => f.team !== u.team && f.hp > 0) : undefined;
      if (fort && Math.hypot(fort.x - u.x, fort.z - u.z) < u.range + 1 && this.fortOnLine(u.x, u.z, fort.x, fort.z) === fort && !u.reloading) {
        u.aim = Math.atan2(fort.x - u.x, -(fort.z - u.z)) + (Math.random() - 0.5) * 0.1;
        u.face = u.aim;
        fire = u.cycle > 0;
      }
      // an item crate in reach: shoot it open (and walk up to it)
      const box = !fire ? this.nearBox(u, u.range + 2) : null;
      if (box && !u.reloading) {
        u.aim = Math.atan2(box.x - u.x, -(box.z - u.z));
        u.face = u.aim;
        fire = u.cycle > 0;
      }
      // nothing in sight: shoot open a crate nearby, pick up cubes, head for the middle
      const cube = this.kind !== 'gauntlet' ? this.drops.find((d) => Math.hypot(d.x - u.x, d.z - u.z) < (this.kind === 'ffa' ? 7 : 5)) : undefined;
      const crate = !cube && this.kind !== 'gauntlet' && !fire ? this.nearCrate(u) : null;
      if (crate && !u.reloading) {
        u.aim = Math.atan2(crate.x - u.x, -(crate.z - u.z));
        fire = u.cycle > 0;
      }
      const g = cube ?? u.step ?? u.goal;
      if (g) {
        const ox = g.x - u.x;
        const oz = g.z - u.z;
        const d = Math.hypot(ox, oz) || 1;
        // (there: it holds its spot)
        if (d > 0.5) {
          dx = ox / d;
          dz = oz / d;
        }
      }
    }
    u.firing = fire && u.stunT <= 0;
    // stay inside the storm
    if (this.kind === 'ffa' && (Math.abs(u.x) > this.storm - 1 || Math.abs(u.z) > this.storm - 1)) {
      const d = Math.hypot(u.x, u.z) || 1;
      dx = -u.x / d;
      dz = -u.z / d;
    }
    // sidestep a marble that's coming straight in
    for (const s of this.shots) {
      if (s.owner.team === u.team) continue;
      const rx = u.x - s.x;
      const rz = u.z - s.z;
      const dist = Math.hypot(rx, rz);
      if (dist > 3 || rx * s.vx + rz * s.vz <= 0) continue;
      const sp = Math.hypot(s.vx, s.vz);
      const cross = (rx * s.vz - rz * s.vx) / sp;
      if (Math.abs(cross) < u.r + s.r + 0.2) {
        const side = cross >= 0 ? 1 : -1;
        const agility = traitMul(u.def.traits?.agility, 'agility');
        dx += (s.vz / sp) * side * 1.4 * agility;
        dz += (-s.vx / sp) * side * 1.4 * agility;
        break;
      }
    }
    const len = Math.hypot(dx, dz);
    if (len > 0.01) {
      let ax = dx / len;
      let az = dz / len;
      // round a wall: try turning a little each way
      const step = u.speed * dt;
      if (this.blocked(u.x + ax * step * 3, u.z + az * step * 3, this.moveR(u))) {
        for (const turn of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
          const c = Math.cos(turn * u.strafe);
          const sn = Math.sin(turn * u.strafe);
          const bx = ax * c - az * sn;
          const bz = ax * sn + az * c;
          if (!this.blocked(u.x + bx * step * 3, u.z + bz * step * 3, this.moveR(u))) {
            ax = bx;
            az = bz;
            break;
          }
        }
      }
      const sp = u.stunT > 0 ? 0 : u.speed * (u.slowT > 0 ? 0.5 : 1) * (u.chargeHold >= CHARGE.hold ? CHARGE.moveMul : 1);
      u.vx = ax * sp;
      u.vz = az * sp;
      this.walk(u, u.vx * dt, u.vz * dt);
      if (!tgt) u.face = Math.atan2(ax, -az);
    } else {
      u.vx = u.vz = 0;
    }
  }

  /** the next tile on the shortest walk to (tx, tz), round walls, crates and water */
  private route(u: Unit, tx: number, tz: number) {
    const { W, H } = this;
    const s = this.tileOf(u.x, u.z);
    const t = this.tileOf(tx, tz);
    if (s < 0 || t < 0 || s === t) return null;
    const prev = new Int32Array(W * H).fill(-1);
    prev[s] = s;
    const q = [s];
    for (let h = 0; h < q.length && prev[t] < 0; h++) {
      const k = q[h];
      const i = k % W;
      const j = (k - i) / W;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const nk = nj * W + ni;
        if (prev[nk] >= 0 || (nk !== t && this.blocksMove(this.grid[nk]))) continue;
        prev[nk] = k;
        q.push(nk);
      }
    }
    if (prev[t] < 0) return null;
    const path: number[] = [];
    for (let k = t; k !== s; k = prev[k]) path.push(k);
    path.reverse();
    // the next tile, or the one after once it's nearly there
    let k = path[0];
    let c = this.center(k % W, Math.floor(k / W));
    if (path.length > 1 && Math.hypot(c.x - u.x, c.z - u.z) < 0.35) {
      k = path[1];
      c = this.center(k % W, Math.floor(k / W));
    }
    return c;
  }

  /**
   * Siege: where a CPU heads. Back to defend if their side is at its fortress; otherwise up to
   * theirs, to a spot in range of it (each its own, so they don't stack up)
   */
  private siegeGoal(u: Unit, foe: Unit | null) {
    const home = this.forts.find((f) => f.team === u.team)!;
    const away = this.forts.find((f) => f.team !== u.team)!;
    // (only the one of its side nearest home goes back; the rest keep up the attack)
    const raid = this.units.find((o) => o.alive && o.team !== u.team && Math.hypot(o.x - home.x, o.z - home.z) < 5.5);
    if (raid && !foe) {
      const mates = this.units.filter((o) => o.alive && o.team === u.team);
      const nearest = mates.reduce((a, b) => (Math.hypot(a.x - home.x, a.z - home.z) <= Math.hypot(b.x - home.x, b.z - home.z) ? a : b));
      if (nearest === u) return { x: raid.x, z: raid.z };
    }
    if (u.goal && Math.abs(u.goal.z - away.z) < 7 && Math.random() > 0.05) return u.goal;
    const side = (this.units.indexOf(u) % 3) - 1;
    const dir = away.z > home.z ? -1 : 1;
    return { x: side * 2.4, z: away.z + dir * (u.range * 0.7 + 1) };
  }

  /** Knockout, Hot Zone and Boss Fight: where a CPU heads when it has nobody in its sights */
  private teamGoal(u: Unit, foe: Unit | null) {
    if (foe) return u.goal;
    const side = (this.units.indexOf(u) % 3) - 1;
    if (this.kind === 'zone') return { x: side * 1.1, z: side * 0.6 };
    // the giant (and its helpers) and Knockout: after the nearest of the other side, wherever they are
    let best: Unit | null = null;
    let bd = 99;
    for (const o of this.units) {
      if (!this.hostile(u, o)) continue;
      const d = Math.hypot(o.x - u.x, o.z - u.z);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best ? { x: best.x + side * 1.5, z: best.z } : { x: 0, z: 0 };
  }

  private nearCrate(u: Unit) {
    let best: { x: number; z: number } | null = null;
    let bd = 6;
    for (const k of this.crateHp.keys()) {
      const j = Math.floor(k / this.W);
      const p = this.center(k - j * this.W, j);
      const d = Math.hypot(p.x - u.x, p.z - u.z);
      if (d < bd && this.clearLine(u.x, u.z, p.x, p.z)) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  private wanderGoal(u: Unit) {
    for (let n = 0; n < 20; n++) {
      const lim = this.kind === 'ffa' ? Math.min(this.storm - 1.5, this.W / 2 - 2) : this.W / 2 - 1.5;
      const x = (Math.random() * 2 - 1) * lim * (this.kind === 'ffa' ? 0.9 : 1);
      const z = (Math.random() * 2 - 1) * (this.kind === 'ffa' ? lim * 0.9 : this.H / 2 - 2);
      // (a hurt fighter in free-for-all looks for a bush to hide in)
      if (this.kind === 'ffa' && u.hp < u.max * 0.4 && this.tile(x, z) !== BUSH) continue;
      if (!this.blocked(x, z, u.r)) return { x, z };
    }
    return { x: 0, z: 0 };
  }

  // ---------- drawing ----------

  private draw(dt: number) {
    const me = this.me;
    for (const u of this.units) {
      if (!u.alive) continue;
      // (a CPU in a bush is hidden from you, unless you're right next to it or it just gave itself away)
      const hidden = !!me && u.team !== me.team && me.alive && !this.sees(me, u);
      u.wrap.visible = !hidden;
      u.shadow.visible = !hidden;
      u.bar.classList.toggle('gone', hidden);
      u.wrap.position.set(u.x, 0, u.z);
      // turn smoothly toward where it faces
      const cur = u.wrap.rotation.y;
      const want = -u.face;
      let d = want - cur;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      u.wrap.rotation.y = cur + d * Math.min(1, dt * 14);
      u.shadow.position.set(u.x, 0.02, u.z);
      const p = u.pose;
      // the main game's gait, from how it walks against the way it faces: ahead (or back) is a
      // march (the pose's y going up), across is the side-step shuffle (the pose's x speed)
      const yaw = -u.wrap.rotation.y;
      const ahead = u.vx * Math.sin(yaw) - u.vz * Math.cos(yaw);
      const across = u.vx * Math.cos(yaw) + u.vz * Math.sin(yaw);
      const moving = Math.hypot(u.vx, u.vz) > 0.3;
      p.vx = moving ? across * 1.1 : 0;
      p.y += moving ? ahead * 1.1 * dt : 0;
      // (and the legs keep time with how fast it's really going: a quick fighter's steps are quicker)
      (p as { gait?: number }).gait = moving ? Math.max(0.6, Math.hypot(u.vx, u.vz) / 3.3) : 1;
      p.firing = u.queue.length > 0 || p.kickT < 0.2;
      p.recoil = Math.max(0, 1 - p.kickT / 0.12) * 0.6;
      u.mesh.sync(p as never, this.time, dt);
      // the special's power-up pose, the other modes' own, run to fit
      if (u.spT >= 0) u.mesh.specialPose((u.spT / u.spLen) * POSE_FULL, 0);
      // (the march's y only drives its legs: the fighter itself stays where the wrap puts it)
      u.mesh.root.position.z += p.y;
    }
    // your own bush goes see-through while you're in it
    this.bushMat.opacity = me?.alive && this.inBush(me) ? 0.55 : 1;
    // the marbles
    let n = 0;
    for (const s of this.shots) {
      if (n >= 300) break;
      // (a diving ball arcs high and comes down on its spot)
      const y = s.dive !== undefined ? 0.55 + Math.sin(Math.PI * Math.min(1, Math.max(0, 1 - s.left / s.dive))) * 3.2 : 0.55;
      this.dummy.position.set(s.x, y, s.z);
      this.dummy.scale.setScalar(s.r);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.shotMesh.setMatrixAt(n, this.dummy.matrix);
      this.shotMesh.setColorAt(n, this.shotColor(s));
      n++;
    }
    this.shotMesh.count = n;
    // a special's balls glow: a soft halo round each
    let h = 0;
    for (const s of this.shots) {
      if (!s.spirit || h >= 60) continue;
      // (a trail of sparks behind it)
      if (Math.random() < 0.7) this.burst(s.x, 0.55, s.z, s.color.getHex(), 1, 0.3, { trail: true, size: s.r * 0.5 });
      const y = s.dive !== undefined ? 0.55 + Math.sin(Math.PI * Math.min(1, Math.max(0, 1 - s.left / s.dive))) * 3.2 : 0.55;
      this.dummy.position.set(s.x, y, s.z);
      this.dummy.scale.setScalar(s.r * (2.1 + Math.sin(this.time * 20 + h) * 0.2));
      this.dummy.updateMatrix();
      this.haloMesh.setMatrixAt(h, this.dummy.matrix);
      this.haloMesh.setColorAt(h, this.shotColor(s));
      h++;
    }
    this.haloMesh.count = h;
    this.haloMesh.instanceMatrix.needsUpdate = true;
    if (this.haloMesh.instanceColor) this.haloMesh.instanceColor.needsUpdate = true;
    this.shotMesh.instanceMatrix.needsUpdate = true;
    if (this.shotMesh.instanceColor) this.shotMesh.instanceColor.needsUpdate = true;
    for (const d of this.drops) {
      d.mesh.rotation.y += dt * 2;
      d.mesh.position.y = 0.35 + Math.sin(this.time * 4 + d.x) * 0.06;
    }
    if (this.kind === 'ffa' && this.stormMesh.length) {
      const half = this.W / 2 + 2;
      const s = this.storm;
      const w = half - s;
      const [l, r, t, b] = this.stormMesh;
      l.scale.set(w, 1, half * 2);
      l.position.set(-s - w / 2, 0.8, 0);
      r.scale.set(w, 1, half * 2);
      r.position.set(s + w / 2, 0.8, 0);
      t.scale.set(s * 2, 1, w);
      t.position.set(0, 0.8, -s - w / 2);
      b.scale.set(s * 2, 1, w);
      b.position.set(0, 0.8, s + w / 2);
      for (const m of this.stormMesh) m.visible = s < this.W / 2 - 0.01;
    }
    for (const f of this.forts) {
      const k = 1 + f.flash * 0.04;
      if (f.hp > 0) f.root.scale.set(k, k, k);
    }
    this.drawLock(dt);
    this.drawBoxes();
    this.drawCharge(dt);
    this.drawWrecks(dt);
    this.drawAuras(dt);
    this.drawFx(dt);
    this.drawSparks(dt);
    this.drawAimGuide();
    this.placeCamera(dt);
    celify(this.scene, true);
    this.ink.render();
    this.placeBars();
    this.tickPops(dt);
  }

  /** the lock-on ring: on your special's target while it's ready, and while the special flies at it */
  private drawLock(dt: number) {
    const me = this.me;
    // your charge's target: the corners close in as marbles are stored, and its bar goes red
    const ct = me?.alive && me.chargeHold > 0.12 && this.chargeTarget?.alive ? this.chargeTarget : null;
    this.aimRing.visible = !!ct;
    for (const u of this.units) u.bar.classList.toggle('aimed', u === ct);
    if (ct && me) {
      const lvl = me.stored / CHARGE.max;
      this.aimRing.position.set(ct.x, 0.07, ct.z);
      this.aimRing.scale.setScalar((ct.boss ? 1.4 : 1) * (1 + Math.sin(this.time * 12) * 0.04));
      this.aimRing.rotation.y -= dt * (1.5 + lvl * 4);
      for (const c of this.aimRing.children) if (c.name === 'corner') {
        const a = Math.atan2(c.position.x, c.position.z);
        const r = 0.95 - lvl * 0.3;
        c.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      }
    }
    this.lockShow = Math.max(0, this.lockShow - dt);
    let t: Unit | null = null;
    if (this.lockShow > 0 && this.lockOn?.alive) t = this.lockOn;
    else if (me?.alive && me.charge >= 1 && !this.over) t = this.lockOf(me);
    this.lockRing.visible = !!t;
    if (!t) return;
    const r = (t.boss ? 1.4 : 1) * (1 + Math.sin(this.time * 9) * 0.06) * (this.lockShow > 0 ? 1.15 : 1);
    this.lockRing.position.set(t.x, 0.06, t.z);
    this.lockRing.scale.setScalar(r);
    this.lockRing.rotation.y += dt * 2.2;
    t.bar.classList.add('locked');
    for (const u of this.units) if (u !== t) u.bar.classList.remove('locked');
  }

  private drawAimGuide() {
    const me = this.me;
    const a = this.aimStick;
    if (!me?.alive || !a) {
      this.aimGuide.visible = false;
      return;
    }
    const dx = a.x - a.x0;
    const dy = a.y - a.y0;
    if (Math.hypot(dx, dy) < 30) {
      this.aimGuide.visible = false;
      return;
    }
    const ang = Math.atan2(dx, -dy) + (behind(this.view) ? this.camYaw : 0);
    const range = a.big ? 8.5 : me.range;
    this.aimGuide.visible = true;
    this.aimGuide.position.set(me.x, 0.05, me.z);
    this.aimGuide.rotation.y = -ang;
    this.aimGuide.scale.set(a.big ? 2.2 : 0.5, 1, range);
    (this.aimGuide.material as THREE.MeshBasicMaterial).color.setHex(a.big ? 0xffd23e : 0xffffff);
    me.face = ang;
  }

  private v = new THREE.Vector3();
  private placeBars() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    for (const u of this.units) {
      if (!u.alive) continue;
      this.v.set(u.x, (u.giant ? 3.4 : u.boss ? 2.4 : 1.75) - (behind(this.view) ? 0.35 : 0), u.z).project(this.camera);
      u.bar.style.transform = `translate(${((this.v.x + 1) / 2) * w}px, ${((1 - this.v.y) / 2) * h}px) translate(-50%, -100%)`;
      (u.bar.querySelector('b') as HTMLElement).style.width = `${(u.hp / u.max) * 100}%`;
      // (health is a share everywhere: the bars, the hits, the top of the duel)
      const pct = Math.max(1, Math.ceil((u.hp / u.max) * 100));
      u.bar.querySelector('i')!.setAttribute('data-hp', `${pct}%`);
      u.bar.classList.toggle('low', pct <= 30);
      if (!u.cpu) (u.bar.querySelector('u') as HTMLElement).style.width = `${(u.ammo / u.mag) * 100}%`;
    }
    for (const f of this.forts) {
      this.v.set(f.x, 2.75 - (behind(this.view) ? 0.3 : 0), f.z).project(this.camera);
      f.bar.style.transform = `translate(${((this.v.x + 1) / 2) * w}px, ${((1 - this.v.y) / 2) * h}px) translate(-50%, -100%)`;
      (f.bar.querySelector('b') as HTMLElement).style.width = `${(f.hp / f.max) * 100}%`;
      f.bar.querySelector('i')!.setAttribute('data-hp', `${Math.max(1, Math.ceil((f.hp / f.max) * 100))}%`);
      f.bar.classList.toggle('gone', this.v.z > 1);
    }
  }

  private pop(x: number, z: number, text: string, kind: string) {
    const el = document.createElement('p');
    el.className = 'ac-pop ' + kind;
    el.textContent = text;
    this.el.appendChild(el);
    this.pops.push({ el, x: x + (Math.random() - 0.5) * 0.4, z, t: 0 });
  }
  private tickPops(dt: number) {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    for (let k = this.pops.length - 1; k >= 0; k--) {
      const p = this.pops[k];
      p.t += dt;
      if (p.t > 0.8) {
        p.el.remove();
        this.pops.splice(k, 1);
        continue;
      }
      this.v.set(p.x, 1.9 + p.t * 1.2, p.z).project(this.camera);
      p.el.style.transform = `translate(${((this.v.x + 1) / 2) * w}px, ${((1 - this.v.y) / 2) * h}px) translate(-50%, -50%)`;
      p.el.style.opacity = String(1 - Math.max(0, p.t - 0.5) / 0.3);
    }
  }

  // ---------- HUD and panels ----------

  private updateHud() {
    const title = this.hud.title;
    const alive = this.units.filter((u) => u.alive).length;
    const clock = (T: number) => {
      const left = Math.max(0, Math.ceil(T));
      return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    };
    if (this.kind === 'knockout') {
      title.querySelector('b')!.textContent = clock(ROUND_TIME - this.kRoundT);
      title.querySelector('span')!.textContent = `ROUND ${this.kRound} · ${this.kWins[0]}–${this.kWins[1]}`;
    } else if (this.kind === 'zone') {
      title.querySelector('b')!.textContent = clock(ZONE_TIME - this.time);
      title.querySelector('span')!.textContent = `OURS ${Math.floor(this.zoneScore[0])}% · THEIRS ${Math.floor(this.zoneScore[1])}%`;
    } else if (this.kind === 'boss') {
      title.querySelector('b')!.textContent = clock(BOSS_TIME - this.time);
      title.querySelector('span')!.textContent = `BOSS ${Math.ceil(((this.giant?.hp ?? 0) / (this.giant?.max ?? 1)) * 100)}%`;
    } else if (this.kind === 'siege') {
      const left = Math.max(0, Math.ceil(SIEGE_TIME - this.time));
      title.querySelector('b')!.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      const pct = (t: number) => Math.ceil(((this.forts.find((f) => f.team === t)?.hp ?? 0) / FORT_HP) * 100);
      title.querySelector('span')!.textContent = `OURS ${pct(0)}% · THEIRS ${pct(1)}%`;
    } else if (this.kind === 'ffa') {
      title.querySelector('b')!.textContent = `${alive}`;
      title.querySelector('span')!.textContent = 'FIGHTERS LEFT';
    } else {
      title.querySelector('b')!.textContent = `${this.room - 1 - this.stageRooms}/${this.fightRooms()}`;
      title.querySelector('span')!.textContent = `STAGE ${this.stage} · ${this.isBossRoom() ? 'BOSS' : this.hasKey ? 'KEY FOUND' : 'ROOMS'} · ${'♥'.repeat(this.lives)}`;
    }
    this.hud.score.querySelector('b')!.textContent = String(this.kos);
    // the boss's health across the top, while one's up (the dark part trails behind, showing the last hit)
    const boss = this.units.find((u) => u.boss && u.alive && u.cpu && (!this.me || u.team !== this.me.team));
    const bb = this.hud.bossbar;
    bb.classList.toggle('on', !!boss && !this.over);
    if (boss) {
      const k = Math.max(0, boss.hp / boss.max);
      if (bb.dataset.id !== boss.def.id) {
        bb.dataset.id = boss.def.id;
        bb.querySelector('b')!.textContent = boss.def.name.toUpperCase();
        this.bossTrail = k;
      }
      this.bossTrail = Math.max(k, this.bossTrail - 0.006);
      (bb.querySelector('u') as HTMLElement).style.width = `${k * 100}%`;
      (bb.querySelector('s') as HTMLElement).style.width = `${this.bossTrail * 100}%`;
    } else bb.dataset.id = '';
    // who a switch would hand you
    const ally = this.nextAlly();
    this.hud.swap.classList.toggle('on', !!ally);
    if (ally && this.hud.swap.dataset.id !== ally.def.id) {
      this.hud.swap.dataset.id = ally.def.id;
      this.hud.swap.querySelector('img')!.src = portrait(ally.def.id, true);
    }
    const c = this.me?.charge ?? 0;
    // (the SPECIAL button fills from the bottom, then burns once it's ready, as in the main game)
    this.hud.special.classList.toggle('ready', c >= 1);
    const me = this.me;
    // the charge meter, as in the other modes: an arming bar for the first moment, then one
    // segment per stored marble (the next one filling)
    const meter = this.hud.charge;
    const holding = !!me && me.alive && me.chargeHold > 0.12;
    meter.classList.toggle('on', holding || (!!me && me.stored > 0));
    if (me && (holding || me.stored > 0)) {
      const armed = me.chargeHold >= CHARGE.hold;
      const next = armed ? ((me.chargeHold - CHARGE.hold) % CHARGE.per) / CHARGE.per : me.chargeHold / CHARGE.hold;
      const segs = meter.querySelector('.charge-segs')!.children;
      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i] as HTMLElement;
        const fill = i < me.stored ? 1 : i === me.stored && me.stored < CHARGE.max ? (armed ? next : 0) : 0;
        seg.style.setProperty('--fill', String(fill));
        seg.classList.toggle('lit', i < me.stored);
      }
      meter.classList.toggle('arming', !armed);
      meter.querySelector('b')!.textContent = !armed ? 'HOLD TO CHARGE' : me.stored ? `CHARGE ×${me.stored}` : 'CHARGING';
      meter.style.setProperty('--arm', String(armed ? 1 : next));
    }
    this.hud.fire.textContent = me?.item === 'dragon' ? 'DRAGON' : me?.item === 'steel' ? 'STEEL' : 'FIRE';
    this.hud.fire.classList.toggle('item', !!me?.item);
    this.hud.special.style.setProperty('--p', String(Math.round(c * 100)));
  }

  private bossTrail = 1;
  /** Dungeon Run: seconds until you're back at the checkpoint */
  private meBack = 0;
  /** a switch of fighter can't come again before this (the fight's clock) */
  private swapAt = 0;
  private respawnN = 0;
  /** the respawn countdown in the middle of the screen: RESPAWN IN 3, 2, 1 */
  private showRespawn(left: number) {
    const n = left > 0 ? Math.ceil(left) : 0;
    if (n === this.respawnN) return;
    this.respawnN = n;
    const el = this.hud.respawn;
    el.classList.toggle('on', n > 0);
    if (!n) return;
    el.querySelector('b')!.textContent = String(n);
    el.classList.remove('tick');
    void el.offsetWidth;
    el.classList.add('tick');
    sfx.play('tick', 0.8);
  }
  private calloutTimer = 0;
  private callout(text: string, tone = 0) {
    const el = this.hud.callout;
    el.textContent = text;
    el.classList.toggle('foe', tone === 1);
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this.calloutTimer);
    this.calloutTimer = window.setTimeout(() => el.classList.remove('show'), 1600);
  }

  private get view(): Cam {
    if (this.tps) return 'tps';
    return this.opts.camera?.() ?? this.localView;
  }
  private cycleView() {
    const now = this.view;
    // (one more after the cockpit, in every mode: TPS; from there, round to the first again)
    this.tps = now === 'first';
    if (!this.tps) {
      const next = VIEWS[(VIEWS.indexOf(now as ActionView) + 1) % VIEWS.length];
      if (this.opts.setCamera) this.opts.setCamera(next);
      else this.localView = next;
    }
    // (no cut: the camera glides from the old view to the new one; TPS picks up behind you)
    if (this.tps && this.me) {
      this.camYaw = this.me.face;
      this.yawVel = 0;
    }
    this.camGlide = 0.45;
    this.showView();
  }
  private showView() {
    (this.el.querySelector('.ac-view') as HTMLElement).textContent = VIEW_LABEL[this.view];
  }

  /** the camera follows you: from above and behind (far is near overhead), low behind you in the cockpit view, or lower and closer, turning with you, in TPS */
  private placeCamera(dt: number) {
    const me = this.me;
    this.tickWalls(dt);
    // (your special's cinematic: the cockpit framing, behind you and looking at its target)
    // (the cinematic is the pose: when it's done and the balls leave, back to your view)
    if (this.spCine) {
      this.spMax -= dt;
      if (!me?.alive || me.spT < 0 || this.spMax <= 0) this.spCine = false;
    }
    const cine = this.spCine && !!me?.alive;
    const view: Cam = cine ? 'first' : this.view;
    const tall = this.camera.aspect < 1;
    const mx = me ? me.x : 0;
    const mz = me ? me.z : 0;
    this.shake = Math.max(0, this.shake - dt);
    const j = this.shake * 0.4;
    const pos = new THREE.Vector3();
    const at = new THREE.Vector3();
    // (the cockpit view starts looking into the stage: up the room, or toward the middle)
    if (this.camSnap && me) this.camYaw = this.kind === 'ffa' && Math.hypot(me.x, me.z) > 1 ? Math.atan2(-me.x, me.z) : 0;
    // (TPS turns with your fighter, a beat behind; it holds while you aim by hand, or it would chase your thumb round)
    // (a spring, so the camera eases into a swing and settles out of it: a new target or a sharp turn
    // never yanks it round)
    if (view === 'tps' && me) {
      if (this.camSnap) {
        this.camYaw = me.face;
        this.yawVel = 0;
      } else if (!this.aimStick && !this.mouseFire) {
        // (it matches how fast you're turning, so it stays right behind you through a turn, and the
        // spring only takes up what's left: a stiff one, damped so it never swings past)
        const w = 16;
        const faceVel = dt > 0 ? wrapAngle(me.face - this.lastFace) / dt : 0;
        const d = wrapAngle(me.face - this.camYaw);
        this.yawVel += (d * w * w + 2 * w * (THREE.MathUtils.clamp(faceVel, -8, 8) - this.yawVel)) * Math.min(dt, 0.05);
        this.camYaw = wrapAngle(this.camYaw + this.yawVel * dt);
      } else this.yawVel *= Math.exp(-dt * 10);
      this.lastFace = me.face;
    }
    // it sees the horizon: a sky, and a haze over the far side
    const sky = behind(view);
    if (sky !== !!this.scene.fog || (sky && this.skyFor !== this.theme)) {
      this.skyFor = this.theme;
      this.skyDome.visible = sky;
      (this.skyDome.material as THREE.MeshBasicMaterial).color.setHex(this.theme.sky);
      this.scene.fog = sky ? new THREE.Fog(this.theme.sky, 16, 42) : null;
    }
    if (cine) {
      // the pose: close in behind you, looking where it'll go (closer than the cockpit view)
      const fx = Math.sin(this.spYaw);
      const fz = -Math.cos(this.spYaw);
      const back = tall ? 4.2 : 3.6;
      pos.set(mx - fx * back, tall ? 2.8 : 2.4, mz - fz * back);
      at.set(mx + fx * 2.6, 0.75, mz + fz * 2.6);
    } else if (view === 'first') {
      const back = tall ? 7.4 : 6.4;
      const yaw = this.camYaw;
      const fx = Math.sin(yaw);
      const fz = -Math.cos(yaw);
      pos.set(mx - fx * back, tall ? 4.6 : 4, mz - fz * back);
      at.set(mx + fx * 5.5, 0.3, mz + fz * 5.5);
    } else if (view === 'tps') {
      // close behind your fighter and a little above (clear of the walls), looking the way it faces
      const back = tall ? 6 : 4.2;
      const fx = Math.sin(this.camYaw);
      const fz = -Math.cos(this.camYaw);
      pos.set(mx - fx * back, tall ? 3.6 : 2.9, mz - fz * back);
      at.set(mx + fx * 3, 0.6, mz + fz * 3);
    } else {
      // (in a Gauntlet room the overhead views stop short of the edges, so the room fills the screen)
      // (a short, wide landscape screen sees little front to back: a little higher up)
      const wideK = this.camera.aspect > 1.6 ? 1.25 : 1;
      // (near is the exception: sideways it comes in closer, so your fighter reads big)
      const k = view === 'near' ? (this.camera.aspect > 1.2 ? 0.78 : 1) : wideK;
      const h = { far: tall ? 26 : 19, mid: this.kind !== 'gauntlet' ? (tall ? 13.5 : 11) : tall ? 17 : 13, near: tall ? 10.5 : 8.5 }[view] * k;
      const back = { far: 0.22, mid: 0.55, near: 0.85 }[view];
      const room = false;
      const half = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect * h * 1.5;
      const fx = room ? THREE.MathUtils.clamp(mx, -Math.max(0, this.W / 2 - half + 0.3), Math.max(0, this.W / 2 - half + 0.3)) : mx;
      const fz = room ? THREE.MathUtils.clamp(mz, -this.H / 2 + 6, this.H / 2 - 6.5) : mz;
      pos.set(fx, h, fz + h * back);
      at.set(fx, 0, fz - (tall ? 0.5 : 0));
    }
    if (this.camSnap) {
      this.camPos.copy(pos);
      this.camAt.copy(at);
      this.camSnap = false;
    } else {
      // (a view change glides over a moment, easing in and out; otherwise the camera keeps close)
      this.camGlide = Math.max(0, this.camGlide - dt);
      const k = 1 - Math.exp(-dt * (this.camGlide > 0 ? 5 : view === 'tps' ? 22 : 9));
      this.camPos.lerp(pos, k);
      this.camAt.lerp(at, k);
    }
    // pushing in: a punch for your special (easing out), and a lean in while you charge
    this.punch = Math.max(0, this.punch - dt * 1.6);
    const charge = me && me.alive && me.chargeHold >= CHARGE.hold ? 0.06 + (me.stored / CHARGE.max) * 0.1 : 0;
    const zoom = 1 - Math.max(charge, cine ? 0 : this.punch * 0.3);
    const cp = this.camAt.clone().add(this.camPos.clone().sub(this.camAt).multiplyScalar(zoom));
    this.camera.position.set(cp.x + (Math.random() - 0.5) * j, cp.y, cp.z + (Math.random() - 0.5) * j);
    this.camera.lookAt(this.camAt);
    // (the cockpit and TPS pictures are lifted, so you stand above the thumb tray rather than behind it)
    // (not during your special's cinematic, so the picture doesn't jump as it starts and ends)
    const lift = behind(view) && !cine ?Math.round(this.camera.aspect < 1 ? 0.17 * this.vh : 0.08 * this.vh) : 0;
    if (lift !== this.lift) {
      this.lift = lift;
      if (lift) this.camera.setViewOffset(this.vw, this.vh, 0, lift, this.vw, this.vh);
      else this.camera.clearViewOffset();
    }
    this.skyDome.position.copy(this.camera.position);
    // (walls between the camera and you dissolve, in the views from behind)
    const on = behind(view) && !!me?.alive ? 1 : 0;
    this.fadeU.uFadeOn.value += (on - this.fadeU.uFadeOn.value) * Math.min(1, dt * 10);
    if (me) {
      this.fadeU.uFadeA.value.copy(this.camera.position);
      this.fadeU.uFadeB.value.set(me.x, 0.9, me.z);
    }
  }

  private best(): { ffa: number; gauntlet: number; siege: number; knockout: number; zone: number; boss: number } {
    const zero = { ffa: 0, gauntlet: 0, siege: 0, knockout: 0, zone: 0, boss: 0 };
    try {
      return { ...zero, ...JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') };
    } catch {
      return zero;
    }
  }
  private bestLine() {
    const b = this.best();
    // (just this mode's, and only once there is one)
    const n = b[this.kind as keyof typeof b] ?? 0;
    return !n ? '' : this.kind === 'gauntlet' ? `Best: ${n} rooms` : `Wins in this mode: ${n}`;
  }

  /** Siege over: 1 your side won, -1 theirs, 0 a draw at the bell */
  private siegeOutcome = 0;
  private warned = false;
  private finishSiege(result: number) {
    if (this.over) return;
    this.siegeOutcome = result;
    setTimeout(() => this.finish(result > 0, result > 0 ? 1 : result < 0 ? 2 : 0), result ? 1200 : 300);
    const SAY: Record<string, [string, string]> = {
      siege: ['THEIR FORTRESS FALLS!', 'YOUR FORTRESS FALLS'],
      knockout: ['YOUR SIDE TAKES IT!', 'THEIR SIDE TAKES IT'],
      zone: ['THE ZONE IS YOURS!', 'THEY TAKE THE ZONE'],
      boss: ['THE BOSS IS DOWN!', 'TIME · THE BOSS STANDS'],
    };
    const say = SAY[this.kind] ?? SAY.siege;
    this.callout(result > 0 ? say[0] : result < 0 ? say[1] : 'TIME · A DRAW', result < 0 ? 1 : 0);
    this.over = true;
    this.shots = [];
  }

  private finish(win: boolean, place: number) {
    if (this.over && !this.teams) return;
    if (this.teams && !this.hud.panel.classList.contains('hidden')) return;
    this.over = true;
    this.shots = [];
    sfx.play(win ? 'win' : 'lose');
    const best = this.best();
    // best: the most rooms cleared, or the most free-for-all wins
    if (this.kind === 'gauntlet') best.gauntlet = Math.max(best.gauntlet, this.room - 1);
    else if (win && this.kind === 'ffa') best.ffa += 1;
    else if (win) best[this.kind as 'siege' | 'knockout' | 'zone' | 'boss'] = (best[this.kind as 'siege'] ?? 0) + 1;
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(best));
    } catch {
      // storage unavailable
    }
    // (a story chapter lost: the foe has its say before the retry panel)
    if (!win && this.story?.closing) this.story.closing(() => this.result(win, place));
    else this.result(win, place);
  }

  /** the end panel, and the XP for the fight */
  private result(win: boolean, place: number) {
    this.showPanel(win ? 'win' : 'lose', place);
    // XP for your fighter, as in the other modes: rooms cleared (gauntlet) or how high you placed (free-for-all), plus KOs
    const gain =
      this.kind === 'gauntlet'
        ? (this.room - 1) * 6 + this.kos * 2 + (win ? 30 : 0)
        : this.kind === 'siege'
          ? (win ? 60 : place === 0 ? 35 : 20) + this.kos * 4 + Math.round((this.fortDealt / FORT_HP) * 40)
          : this.teams
            ? (win ? (this.kind === 'boss' ? 80 : 60) : place === 0 ? 35 : 20) + this.kos * 4
          : (7 - place) * 8 + this.kos * 5 + (win ? 20 : 0);
    const box = this.hud.panel.querySelector('.ac-xp') as HTMLElement;
    box.classList.toggle('hidden', !this.opts.reward);
    this.opts.reward?.(box, this.unitId, Math.max(10, gain));
  }

  private showPanel(kind: 'start' | 'win' | 'lose' | 'upgrade' | 'loot' | 'stage' | null, place = 0) {
    const p = this.hud.panel;
    p.classList.toggle('hidden', !kind);
    this.panelKind = kind;
    this.panelAt = performance.now();
    this.paused = kind === 'upgrade' || kind === 'loot' || kind === 'stage';
    if (!kind) return;
    const h = p.querySelector('h2')!;
    const text = p.querySelector('.ac-text') as HTMLElement;
    const cards = p.querySelector('.ac-cards') as HTMLElement;
    const buttons = p.querySelector('.ac-buttons') as HTMLElement;
    const bestEl = p.querySelector('.ac-best') as HTMLElement;
    cards.innerHTML = '';
    cards.classList.remove('modes', 'gear');
    buttons.innerHTML = '';
    (p.querySelector('.ac-xp') as HTMLElement).classList.add('hidden');
    const button = (label: string, fn: () => void, cls = '') => {
      const b = document.createElement('button');
      b.className = 'key ' + cls;
      b.textContent = label;
      b.addEventListener('click', fn);
      buttons.appendChild(b);
    };
    bestEl.textContent = '';
    // a story chapter's end: on with the story, or try it again
    if (this.story && (kind === 'win' || kind === 'lose')) {
      const f = this.story;
      h.textContent = kind === 'win' ? 'Chapter won!' : 'Defeated';
      text.textContent = kind === 'win' ? `${f.title}: the story goes on.` : `${f.title}: get up and try it again.`;
      if (kind === 'win') button('Continue story ▶', () => this.endStory(true), 'primary');
      else {
        button('Retry chapter', () => this.begin(f.kind), 'primary');
        button('Leave story', () => this.endStory(false));
      }
      return;
    }
    if (kind === 'start') {
      h.textContent = 'Action';
      text.textContent = 'Left thumb walks. Tap FIRE to shoot, hold to charge, slide off to aim. SPECIAL fires your fighter’s own move.';
      const mode = (k: ActionKind, title: string, sub: string) => {
        const c = document.createElement('button');
        c.className = 'ac-mode';
        c.innerHTML = `<b>${title}</b><small>${sub}</small>`;
        c.addEventListener('click', () => this.begin(k));
        cards.appendChild(c);
      };
      mode('gauntlet', 'Dungeon Run', 'Seven stages deep, a new dungeon each: traps, chests of gear, a key to find and a boss behind the locked door');
      mode('ffa', 'Storm Brawl', 'You and five fighters, one stage, bushes, crates and a closing storm');
      mode('siege', 'Castle Crash', 'Three on three: knock down their fortress before they knock down yours');
      mode('knockout', 'Team Knockout', 'Three on three, no respawns: last side standing takes the round, best of three');
      mode('zone', 'King of the Ring', 'Three on three: hold the ring in the middle with none of theirs in it, first to 100%');
      mode('boss', 'Giant Slayer', 'You and two more against one giant fighter with huge health, before time runs out');
      cards.classList.add('modes');
      button('Back', () => this.exit());
    } else if (kind === 'stage') {
      const next = DSTAGES[this.stage];
      h.textContent = `Stage ${this.stage} cleared`;
      text.textContent = `Down the stairs: ${themeName(next.theme)}, stage ${this.stage + 1} of ${DSTAGES.length}. Your gear, upgrades and lives come with you, and you get some health back.`;
      button('Descend · FIRE', () => this.descend(), 'primary');
    } else if (kind === 'loot') {
      const l = this.lootOpen!;
      h.textContent = 'Gear found';
      text.textContent = '';
      cards.classList.add('gear');
      cards.append(this.gearCard(l.gear, this.gear, 'Found'), this.gearCard(this.gear, null, 'Equipped'));
      button('Equip', () => this.equip(l), 'primary');
      button('Leave it · FIRE', () => this.dismissBonus());
    } else if (kind === 'upgrade') {
      h.textContent = 'Room clear';
      text.textContent = 'Pick an upgrade for the rest of the run.';
      const pool = [...UPGRADES].sort(() => Math.random() - 0.5).slice(0, 3);
      for (const up of pool) {
        const c = document.createElement('button');
        c.className = 'ac-mode';
        const have = this.ups[up.id] ?? 0;
        c.innerHTML = `<b>${up.name}${have ? ` ×${have + 1}` : ''}</b><small>${up.text}</small>`;
        c.addEventListener('click', () => this.takeUpgrade(up.id));
        cards.appendChild(c);
      }
      button('Skip · FIRE', () => this.dismissBonus());
    } else {
      const ffa = this.kind === 'ffa';
      if (this.teams && this.kind !== 'siege') {
        const o = this.siegeOutcome;
        const head: Record<string, [string, string]> = { knockout: ['Knockout won!', 'Knockout lost'], zone: ['Zone held!', 'Zone lost'], boss: ['Boss defeated!', 'The boss wins'] };
        h.textContent = o > 0 ? head[this.kind][0] : o < 0 ? head[this.kind][1] : 'A draw';
        const kos = `${this.kos} fighter${this.kos === 1 ? '' : 's'} down by you`;
        text.textContent =
          this.kind === 'knockout'
            ? `Rounds ${this.kWins[0]}–${this.kWins[1]}. ${kos}.`
            : this.kind === 'zone'
              ? `Yours ${Math.floor(this.zoneScore[0])}%, theirs ${Math.floor(this.zoneScore[1])}%. ${kos}.`
              : o > 0
                ? `Down in ${Math.floor(this.time / 60)}:${String(Math.floor(this.time % 60)).padStart(2, '0')}. ${kos}.`
                : `It had ${Math.ceil(((this.giant?.hp ?? 0) / (this.giant?.max ?? 1)) * 100)}% left. ${kos}.`;
      } else if (this.kind === 'siege') {
        const o = this.siegeOutcome;
        h.textContent = o > 0 ? 'Fortress down!' : o < 0 ? 'Fortress lost' : 'A draw';
        const pct = (t: number) => Math.ceil(((this.forts.find((f) => f.team === t)?.hp ?? 0) / FORT_HP) * 100);
        text.textContent = `${o > 0 ? 'Your side knocked theirs down' : o < 0 ? 'Their side knocked yours down' : 'Time ran out'}: yours ${pct(0)}%, theirs ${pct(1)}%. You knocked off ${Math.round((this.fortDealt / FORT_HP) * 100)}% and took down ${this.kos} fighter${this.kos === 1 ? '' : 's'}.`;
      } else h.textContent = kind === 'win' ? (ffa ? 'Victory!' : 'Dungeon cleared!') : ffa ? `#${place} of 6` : 'Knocked out';
      if (!this.teams) text.textContent = ffa ? (kind === 'win' ? `Last one standing, with ${this.kos} KO${this.kos === 1 ? '' : 's'}.` : `${this.kos} KO${this.kos === 1 ? '' : 's'} before you went down.`) : kind === 'win' ? `All ${DSTAGES.length} stages: ${this.room - 1} rooms and ${this.kos} monsters down.` : `You reached stage ${this.stage} (${themeName(this.theme)}) and cleared ${this.room - 1} rooms with ${this.kos} KO${this.kos === 1 ? '' : 's'}.`;
      bestEl.textContent = this.bestLine();
      button('Play again', () => this.begin(this.kind), 'primary');
      button('Modes', () => {
        this.clearStage();
        this.kind = 'gauntlet';
        this.buildStage();
        this.spawnMe();
        this.showPanel('start');
      });
      button('Back', () => this.exit());
    }
  }

  /** FIRE on the gear card leaves the launcher where it lies; on the upgrade pick, it skips the upgrade */
  private dismissBonus(byFire = false) {
    // (a FIRE already being hammered as the panel comes up doesn't throw it away)
    if (byFire && performance.now() - this.panelAt < 450) return;
    if (this.panelKind === 'stage') return this.descend();
    if (this.panelKind === 'loot') {
      if (this.lootOpen) this.lootOpen.away = true;
      this.lootOpen = null;
      this.showPanel(null);
    } else if (this.panelKind === 'upgrade') {
      this.showPanel(null);
      this.openDoor();
    }
  }

  /** Dungeon Run: down to the next stage, a new dungeon (you keep your gear, upgrades, lives and most of your health) */
  private descend() {
    this.showPanel(null);
    this.fadeThrough(() => {
      this.stage++;
      this.stageRooms = this.room - 1;
      this.startStage();
      if (this.me) this.me.hp = Math.min(this.me.max, this.me.hp + this.me.max * 0.3);
      sfx.play('gong');
    });
  }

  /**
   * a jump from one place to another (back to a checkpoint, down to the next stage) hidden
   * behind a quick fade to black: the world holds still while it's dark, the camera lands, then
   * the picture fades back in
   */
  private fading = false;
  private fadeThrough(fn: () => void) {
    if (this.fading) return;
    this.fading = true;
    const el = this.hud.fade;
    el.classList.add('on');
    this.paused = true;
    setTimeout(() => {
      fn();
      this.camSnap = true;
      // (a beat in the dark so the new place is drawn before it shows)
      setTimeout(() => {
        el.classList.remove('on');
        this.paused = !!this.panelKind && this.panelKind !== 'start' && this.panelKind !== 'win' && this.panelKind !== 'lose';
        this.fading = false;
      }, 120);
    }, 320);
  }

  private offerUpgrades() {
    if (this.over) return;
    this.showPanel('upgrade');
  }

  private takeUpgrade(id: UpgradeId) {
    this.ups[id] = (this.ups[id] ?? 0) + 1;
    const me = this.me!;
    if (id === 'power') me.power *= 1.2;
    if (id === 'rapid') {
      me.fireInt /= 1.2;
      me.refill *= 1.2;
    }
    if (id === 'swift') me.speed *= 1.15;
    if (id === 'vital') {
      me.max = Math.round(me.max * 1.25);
      me.hp = Math.min(me.max, me.hp + me.max * 0.25);
    }
    sfx.play('charge');
    this.showPanel(null);
    this.openDoor();
  }

  // ---------- input ----------

  private resize = () => {
    const w = this.el.clientWidth || window.innerWidth;
    const h = this.el.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.vw = w;
    this.vh = h;
    // (the lift is worked out again for the new size)
    this.lift = 0;
    this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  };

  /** the nearest enemy you can see, for a tap or the keyboard */
  /** the closest enemy you can see (one behind a wall counts as further away, so a clear shot wins), and how far */
  private nearestEnemy(): { u: Unit | null; d: number } {
    const me = this.me!;
    let best: Unit | null = null;
    let bd = 12;
    for (const u of this.units) {
      if (!this.hostile(me, u) || !this.targetable(me, u)) continue;
      const d = Math.hypot(u.x - me.x, u.z - me.z) + (this.clearLine(me.x, me.z, u.x, u.z) ? 0 : 6);
      if (d < bd) {
        bd = d;
        best = u;
      }
    }
    return { u: best, d: bd };
  }

  private autoAim(): number {
    const me = this.me!;
    const { u: best, d: bd } = this.nearestEnemy();
    // (an enemy in shooting range first; then an item crate in reach, before one further off)
    const box = this.nearBox(me, me.range + 1);
    if (box && (!best || bd > me.range + 1)) return Math.atan2(box.x - me.x, -(box.z - me.z));
    if (best) return Math.atan2(best.x - me.x, -(best.z - me.z));
    // nothing in sight: their fortress, a crate, or straight ahead
    const fort = this.forts.find((f) => f.team !== me.team && f.hp > 0);
    if (fort && Math.hypot(fort.x - me.x, fort.z - me.z) < me.range + 2) return Math.atan2(fort.x - me.x, -(fort.z - me.z));
    const crate = this.nearCrate(me);
    if (crate) return Math.atan2(crate.x - me.x, -(crate.z - me.z));
    return me.face;
  }

  /** the stick in the left tray: its knob follows your thumb (the thumb can start anywhere on the left) */
  private stickEl(s: { x0: number; y0: number; x: number; y: number } | null) {
    const knob = this.el.querySelector('.ac-move i') as HTMLElement;
    this.el.querySelector('.ac-joy')!.classList.toggle('held', !!s);
    if (!s) {
      knob.style.transform = '';
      return;
    }
    const dx = s.x - s.x0;
    const dy = s.y - s.y0;
    const len = Math.hypot(dx, dy);
    const k = len > 34 ? 34 / len : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  }

  /** the floor spot under the mouse, as an angle from you */
  private mouseAngle() {
    const me = this.me!;
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((this.mouseAt.x - r.left) / r.width) * 2 - 1, -((this.mouseAt.y - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5), hit)) return me.aim;
    return Math.atan2(hit.x - me.x, -(hit.z - me.z));
  }

  private down = (e: PointerEvent) => {
    if (this.over || this.paused || !this.me?.alive) return;
    sfx.unlock();
    // a mouse: hold to fire at the cursor (right click or shift: the special)
    if (e.pointerType === 'mouse') {
      this.mouseAt = { x: e.clientX, y: e.clientY };
      if (e.button === 2) this.special(this.me, this.mouseAngle());
      else this.mouseFire = true;
      return;
    }
    // (the left half of the view itself: it can sit inset from the window's edge)
    const box = this.el.getBoundingClientRect();
    const left = e.clientX - box.left < box.width / 2;
    const s = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
    if (left && !this.moveStick) {
      this.moveStick = s;
      this.stickEl(s);
    }
  };
  private fireDown = (e: PointerEvent) => {
    e.stopPropagation();
    if (this.panelKind === 'loot' || this.panelKind === 'upgrade' || this.panelKind === 'stage') return this.dismissBonus(true);
    if (this.over || this.paused || !this.me?.alive || this.aimStick) return;
    sfx.unlock();
    this.aimStick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), big: false };
    this.hud.fire.classList.add('held');
  };
  private specialDown = (e: PointerEvent) => {
    e.stopPropagation();
    if (this.over || this.paused || !this.me?.alive) return;
    this.special(this.me, this.autoAim());
  };
  private pmove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') this.mouseAt = { x: e.clientX, y: e.clientY };
    for (const s of [this.moveStick, this.aimStick]) {
      if (s && s.id === e.pointerId) {
        s.x = e.clientX;
        s.y = e.clientY;
      }
    }
    if (this.moveStick) this.stickEl(this.moveStick);
  };
  private up = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') this.mouseFire = false;
    if (this.moveStick?.id === e.pointerId) {
      this.moveStick = null;
      this.stickEl(null);
    }
    if (this.aimStick?.id === e.pointerId) {
      this.aimStick = null;
      this.hud.fire.classList.remove('held');
    }
  };
  private keydown = (e: KeyboardEvent) => {
    if (!this.running) return;
    this.keys.add(e.code);
    if (e.code === 'Space' && !e.repeat && (this.panelKind === 'loot' || this.panelKind === 'upgrade' || this.panelKind === 'stage')) return this.dismissBonus(true);
    // (Q: switch fighter, even while yours is down)
    if (e.code === 'KeyQ' && !e.repeat) return this.switchFighter();
    if (this.over || this.paused || !this.me?.alive) return;
    if (e.code === 'Space') this.keyFire = true;
    if ((e.code === 'KeyF' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) this.special(this.me, this.autoAim());
    if (e.code === 'KeyV') this.cycleView();
    if (e.code === 'Escape') this.exit();
  };
  private keyup = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === 'Space') this.keyFire = false;
  };
}
