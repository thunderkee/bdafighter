import * as THREE from 'three';
import { celify } from './cel';
import { InkOnly } from './post';
import { ShooterMesh, characterById, playable, studioEnv, type CharacterDef } from './robot';
import { traitMul } from './roster';
import { BALANCE_ARENA, BASE_STATS, MAG_ARENA, MAG_ARENA_OF, MARBLES, MARBLE_OF, MATCH, TOSS_TIME, type MarbleType } from './config';
import { BITE, CHARGE, HEAD_SWEEP, MOVE_NAMES, SPIRIT, SPIRIT_OF, TWIN, WINDUP, type SpiritKind } from './game';
import * as sfx from './audio';
import { skinned } from './cosmetics';
import { kitOf } from './kits';
import { DROP, DRAGON, ITEMS, MISSILE } from './items';
import { stageById } from './stage';

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

export type ActionKind = 'gauntlet' | 'ffa' | 'siege';

// tiles
const FLOOR = 0;
const WALL = 1;
const CRATE = 2;
const BUSH = 3;
const WATER = 4;
const GATE = 5;
/** a fortress's footprint (Siege): blocks walking, and takes the marbles that hit it */
const FORT = 6;

const UNIT_R = 0.42;
const BASE_HP = 3600;
/** the main game's health is 100: its damage numbers scale by this */
const SCALE = BASE_HP / MATCH.maxHealth;
const SHOT_SPEED = 13;
const SHOT_RANGE = 7.5;
/** standing still (not firing, not hit for a moment) mends this share of health a second */
const MEND = 0.12;
const ROOMS = 10;
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
const RESPAWN = 4;
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
const themeName = (t: Theme) => t.name ?? stageById(t.stage ?? '').name;
/** the camera, shared with the other modes' setting: far (overhead), mid, near, and first (just behind your fighter) */
export type ActionView = 'far' | 'mid' | 'near' | 'first';
const VIEWS: ActionView[] = ['near', 'mid', 'far', 'first'];
const VIEW_LABEL: Record<ActionView, string> = { near: 'NEAR', mid: 'MID', far: 'FAR', first: 'COCKPIT' };

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
const pose = () => ({ x: 0, y: 0, team: 0, aim: 0, shieldUp: false, recoil: 0, windT: 9, kickT: 9, hand: 1, lastHand: 1, wobble: 0, vx: 0, flash: 0, stagger: 0, health: 100, heavyT: 9, firing: false });

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
  private room = 1;
  private cleared = false;
  private ups: Partial<Record<UpgradeId, number>> = {};
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
  /** which way the cockpit view looks (set as each stage starts, so the stick stays put) */
  private camYaw = 0;
  private localView: ActionView = 'mid';
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
    private opts: { unit: string; skin?: (id: string) => CharacterDef; onExit: () => void; reward?: (box: HTMLElement, unit: string, gain: number) => void; camera?: () => ActionView; setCamera?: (v: ActionView) => void; cpuCharge?: () => boolean; allyCharge?: () => boolean; saver?: () => boolean; vibrate?: (pattern: number | number[]) => void },
  ) {
    this.unitId = opts.unit;
    this.el = document.createElement('div');
    this.el.id = 'action';
    this.el.className = 'hidden';
    this.el.innerHTML = `
      <canvas></canvas>
      <div class="ac-flash"></div>
      <div class="ac-vignette"></div>
      <div class="ac-speed"></div>
      <div class="ac-bars"></div>
      <div class="ac-hud">
        <div class="ac-top">
          <div class="ac-left"><button class="ac-quit key round" aria-label="Back">✕</button></div>
          <div class="ac-title"><b></b><span></span></div>
          <div class="ac-score"><b>0</b><span>KOS</span></div>
        </div>
        <p class="ac-callout"></p>
        <p class="ac-supername"></p>
        <p class="ac-hint">TAP TO FIRE · HOLD TO CHARGE · DRAG TO AIM · SHOOT THE CRATES · STAND STILL TO MEND</p>
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
    for (const k of ['bars', 'title', 'score', 'callout', 'supername', 'flash', 'vignette', 'speed', 'hint', 'panel', 'special', 'fire', 'charge']) this.hud[k] = this.el.querySelector(`.ac-${k}`)!;

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

  /** show the start panel with this fighter */
  open(unit: string) {
    this.unitId = unit;
    this.applySaver();
    this.showView();
    this.camSnap = true;
    this.el.classList.remove('hidden');
    this.over = true;
    this.clearStage();
    this.kind = 'gauntlet';
    this.buildStage();
    this.spawnMe();
    this.showPanel('start');
    this.resize();
    this.running = true;
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
  }

  private exit() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.clearStage();
    this.el.classList.add('hidden');
    this.opts.onExit();
  }

  get active() {
    return this.running;
  }
  /** a boss is up (for the music) */
  get bossOn() {
    return !this.over && this.units.some((u) => u.boss && u.alive);
  }

  private begin(kind: ActionKind) {
    sfx.unlock();
    this.kind = kind;
    this.room = 1;
    this.ups = {};
    this.kos = 0;
    this.time = 0;
    this.fortDealt = 0;
    this.warned = false;
    this.startStage();
    this.showPanel(null);
    this.hud.hint.classList.remove('gone');
    setTimeout(() => this.hud.hint.classList.add('gone'), 3500);
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
    this.theme = this.kind === 'gauntlet' ? this.themeOrder[(this.room - 1) % this.themeOrder.length] : this.themeOrder[0];
    this.storm = this.kind === 'ffa' ? this.W / 2 : 99;
    this.time = this.kind === 'gauntlet' ? this.time : 0;
    this.buildStage();
    this.spawnMe();
    if (keep && this.kind === 'gauntlet' && this.room > 1) {
      this.me!.hp = Math.max(1, this.me!.max * Math.min(1, keep.hp + 0.08));
      this.me!.charge = keep.charge;
      this.me!.item = keep.item;
    }
    this.spawnFoes();
    this.over = false;
    const where = themeName(this.theme).toUpperCase();
    this.callout(this.kind === 'siege' ? `SIEGE · ${where}` : this.kind === 'ffa' ? `FREE-FOR-ALL · ${where}` : this.isBossRoom() ? `ROOM ${this.room} · BOSS` : `ROOM ${this.room} · ${where}`);
    sfx.play(this.isBossRoom() ? 'gong' : 'go');
    this.updateHud();
  }

  private isBossRoom() {
    return this.kind === 'gauntlet' && this.room % 5 === 0;
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
  private blocksMove = (t: number) => t === WALL || t === CRATE || t === WATER || t === GATE || t === FORT;
  private blocksShot = (t: number) => t === WALL || t === CRATE || t === GATE || t === FORT;

  private buildStage() {
    if (this.kind === 'ffa') {
      this.W = this.H = 28;
      this.layoutFfa();
    } else if (this.kind === 'siege') {
      this.W = 15;
      this.H = 25;
      this.layoutSiege();
    } else {
      this.W = 11;
      this.H = 17;
      this.layoutRoom();
    }
    this.drawStage();
  }

  /** a Gauntlet room: walls round the edge with a door at the top, a mirrored layout inside */
  private layoutRoom() {
    const { W, H } = this;
    const g = (this.grid = new Uint8Array(W * H));
    for (let i = 0; i < W; i++) {
      g[this.idx(i, 0)] = WALL;
      g[this.idx(i, H - 1)] = WALL;
    }
    for (let j = 0; j < H; j++) {
      g[this.idx(0, j)] = WALL;
      g[this.idx(W - 1, j)] = WALL;
    }
    // the door: shut until the room is clear
    for (let i = 4; i <= 6; i++) g[this.idx(i, 0)] = GATE;
    // mirrored pieces left and right, kept off the middle column, the door and the start
    const put = (i: number, j: number, t: number) => {
      if (i < 1 || i > 4 || j < 2 || j > H - 4) return;
      g[this.idx(i, j)] = t;
      g[this.idx(W - 1 - i, j)] = t;
      if (t === CRATE) {
        this.crateHp.set(this.idx(i, j), CRATE_HP);
        this.crateHp.set(this.idx(W - 1 - i, j), CRATE_HP);
      }
    };
    const rnd = (n: number) => Math.floor(Math.random() * n);
    const pieces = 2 + rnd(2);
    for (let p = 0; p < pieces; p++) {
      const j = 3 + rnd(H - 8);
      const i = 1 + rnd(3);
      if (Math.random() < 0.5) {
        put(i, j, WALL);
        put(i + 1, j, WALL);
      } else {
        put(i, j, WALL);
        put(i, j + 1, WALL);
      }
    }
    for (let b = 0; b < 2; b++) {
      const j = 3 + rnd(H - 8);
      const i = 1 + rnd(3);
      for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (g[this.idx(i + di, j + dj)] === FLOOR) put(i + di, j + dj, BUSH);
    }
    const c = { i: 1 + rnd(3), j: 4 + rnd(H - 9) };
    if (g[this.idx(c.i, c.j)] === FLOOR) put(c.i, c.j, CRATE);
    if (this.room >= 3 && Math.random() < 0.5) {
      const j = 5 + rnd(H - 11);
      put(2, j, WATER);
      put(3, j, WATER);
    }
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
    // the fortresses: three tiles across, two deep
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
        if (u.team === f.team || !u.alive || !this.sees(f.gun, u)) continue;
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
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    this.world.add(floor);
    // round the outside, a darker apron so the edge reads
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(W + 40, H + 40), new THREE.MeshStandardMaterial({ color: th.apron, roughness: 1, emissive: th.waterGlow && th.id === 'lava' ? 0x801800 : 0x000000 }));
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.02;
    this.world.add(apron);

    const count = (t: number) => this.grid.reduce((n, v) => n + (v === t ? 1 : 0), 0);
    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, t: number, place: (o: THREE.Object3D, i: number, j: number) => void) => {
      const n = count(t);
      if (!n) return;
      const m = new THREE.InstancedMesh(geo, mat, n);
      let k = 0;
      for (let j = 0; j < H; j++)
        for (let i = 0; i < W; i++) {
          if (this.grid[this.idx(i, j)] !== t) continue;
          const p = this.center(i, j);
          this.dummy.position.set(p.x, 0, p.z);
          this.dummy.rotation.set(0, 0, 0);
          this.dummy.scale.set(1, 1, 1);
          place(this.dummy, i, j);
          this.dummy.updateMatrix();
          m.setMatrixAt(k++, this.dummy.matrix);
        }
      this.world.add(m);
    };
    const wallGeo = new THREE.BoxGeometry(1, 1.1, 1);
    wallGeo.translate(0, 0.55, 0);
    inst(wallGeo, new THREE.MeshStandardMaterial({ color: th.wall, roughness: 0.8 }), WALL, () => {});
    if (th.wallGlow) {
      // a glowing band round the top of each wall (the main game's rail glow)
      // (a band round the sides just under the top, so it never shares a face with the wall)
      const stripGeo = new THREE.BoxGeometry(1.03, 0.09, 1.03);
      stripGeo.translate(0, 0.98, 0);
      inst(stripGeo, new THREE.MeshBasicMaterial({ color: th.wallGlow }), WALL, () => {});
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
        const p = this.center(i, j);
        if (t === CRATE) this.makeCrate(this.idx(i, j));
        else if (t === GATE) {
          const bars = new THREE.Mesh(new THREE.BoxGeometry(1, 1.1, 0.3), new THREE.MeshStandardMaterial({ color: 0xff5a5a, emissive: 0x801010, roughness: 0.5 }));
          bars.position.set(p.x, 0.55, p.z);
          this.world.add(bars);
          this.gateMeshes.push(bars);
        }
      }
    for (const f of this.pendingForts) this.makeFort(f.team, f.z, f.tiles);
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

  private makeUnit(def: CharacterDef, x: number, z: number, cpu: boolean, team: number, opts: { hp?: number; dmg?: number; boss?: boolean } = {}): Unit {
    const mesh = new ShooterMesh(def.id, def.ball, def);
    const boss = !!opts.boss;
    mesh.size = boss ? 0.78 : 0.55;
    const wrap = new THREE.Group();
    wrap.add(mesh.root);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(boss ? 0.62 : 0.44, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    this.world.add(wrap, shadow);
    const t = def.traits;
    const mb = marbleOf(def);
    const max = Math.round(BASE_HP * traitMul(t?.health, 'health') * (opts.hp ?? 1) * (this.kind === 'ffa' ? FFA_HP : 1));
    const bar = document.createElement('div');
    bar.className = 'ac-bar' + (cpu ? (team === 0 && this.kind === 'siege' ? ' ally' : '') : ' me');
    bar.innerHTML = `<span></span><i><b></b></i>${cpu ? '' : '<em><u></u></em>'}`;
    bar.querySelector('span')!.textContent = cpu ? def.name : 'YOU';
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
      r: boss ? 0.6 : UNIT_R,
      hp: max,
      max,
      // (each fighter's Speed, as on the rail in the other modes: half as fast at 1, 1.6 times at 5)
      speed: 3.3 * traitMul(t?.speed, 'speed') * (boss ? 0.85 : 1),
      // (the main game's marble: its damage per hit as a share of health, its magazine and cadence)
      dmg: BASE_STATS.damage * SCALE * mb.damage * mb.balance,
      power: opts.dmg ?? 1,
      mag: mb.mag,
      ammo: mb.mag,
      fireInt: (BASE_STATS.fireInterval * mb.fire) / traitMul(t?.fireRate, 'fireRate'),
      refill: mb.mag / (BASE_STATS.reloadTime * mb.reload * 1.6),
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
    };
    this.units.push(u);
    return u;
  }

  private spawnMe() {
    const def = this.opts.skin?.(this.unitId) ?? characterById(this.unitId);
    const start = this.kind === 'ffa' ? this.ffaStarts()[0] : this.kind === 'siege' ? this.siegeSpot(0, 0) : { x: 0, z: this.H / 2 - 2 };
    this.me = this.makeUnit(def, start.x, start.z, false, 0);
    this.me.face = this.kind === 'siege' ? 0 : Math.PI;
    if (this.kind === 'gauntlet') {
      const vital = this.ups.vital ?? 0;
      this.me.max = Math.round(this.me.max * (1 + 0.25 * vital));
      this.me.hp = this.me.max;
      this.me.speed *= 1 + 0.15 * (this.ups.swift ?? 0);
      this.me.power *= 1 + 0.2 * (this.ups.power ?? 0);
      this.me.fireInt /= 1 + 0.2 * (this.ups.rapid ?? 0);
      this.me.refill *= 1 + 0.2 * (this.ups.rapid ?? 0);
    }
    this.el.querySelector('.ac-unit')!.textContent = def.name;
  }

  private pickFoes(n: number) {
    const pool = playable().filter((c) => c.id !== this.unitId);
    const out: CharacterDef[] = [];
    for (let k = 0; k < n; k++) {
      if (!pool.length) pool.push(...playable());
      out.push(this.painted(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]));
    }
    return out;
  }
  /** the other fighters wear one of their paint jobs (never the plain one), so no two matches look alike */
  private painted(def: CharacterDef) {
    const jobs = kitOf(def)?.paint ?? [];
    if (!jobs.length) return def;
    return skinned(def.id, { paint: jobs[Math.floor(Math.random() * jobs.length)].id });
  }

  private spawnFoes() {
    if (this.kind === 'siege') {
      // two on your side, three on theirs
      const picks = this.pickFoes(5);
      picks.forEach((d, k) => {
        const team = k < 2 ? 0 : 1;
        const p = this.siegeSpot(team, team === 0 ? k + 1 : k - 2);
        const u = this.makeUnit(d, p.x, p.z, true, team);
        u.face = team === 0 ? 0 : Math.PI;
        u.aimError = 0.1 + Math.random() * 0.08;
        u.aimDelay = 0.3 + Math.random() * 0.3;
      });
      return;
    }
    if (this.kind === 'ffa') {
      const starts = this.ffaStarts();
      this.pickFoes(5).forEach((d, k) => {
        const u = this.makeUnit(d, starts[k + 1].x, starts[k + 1].z, true, k + 1);
        u.aimError = 0.1 + Math.random() * 0.08;
        u.aimDelay = 0.3 + Math.random() * 0.3;
      });
      return;
    }
    const r = this.room;
    const hp = 0.45 + 0.07 * r;
    const dmg = 0.45 + 0.05 * r;
    // (in the top half, well away from where you come in)
    const spots = this.freeSpots(1, -1);
    if (this.isBossRoom()) {
      const [d] = this.pickFoes(1);
      const b = this.makeUnit(d, 0, -this.H / 2 + 4, true, 1, { hp: hp * 5, dmg: dmg * 1.3, boss: true });
      b.aimError = 0.07;
      b.aimDelay = 0.25;
      if (r === ROOMS) this.pickFoes(2).forEach((e) => this.makeUnit(e, ...this.spotOf(spots), true, 1, { hp, dmg }));
      return;
    }
    const n = [1, 2, 2, 3, 0, 3, 3, 4, 4][r - 1] ?? 4;
    this.pickFoes(n).forEach((d) => {
      const u = this.makeUnit(d, ...this.spotOf(spots), true, 1, { hp, dmg });
      u.aimError = Math.max(0.06, 0.2 - r * 0.015);
      u.aimDelay = Math.max(0.25, 0.7 - r * 0.05);
    });
  }

  /** open floor tiles in a band of rows (shuffled) */
  private freeSpots(j0: number, j1: number) {
    const out: { x: number; z: number }[] = [];
    for (let j = j0; j < this.H; j++)
      for (let i = 1; i < this.W - 1; i++) {
        const p = this.center(i, j);
        if (p.z > j1) continue;
        if (this.grid[this.idx(i, j)] === FLOOR) out.push(p);
      }
    return out.sort(() => Math.random() - 0.5);
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
  private walk(u: Unit, dx: number, dz: number) {
    if (!this.blocked(u.x + dx, u.z, u.r)) u.x += dx;
    if (!this.blocked(u.x, u.z + dz, u.r)) u.z += dz;
  }

  /** the nearest enemy it can see (what a special homes on) */
  private nearestFoe(u: Unit, range = 14) {
    let best: Unit | null = null;
    let bd = range;
    for (const o of this.units) {
      if (!this.hostile(u, o) || !this.sees(u, o)) continue;
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
    const bounce = u.bounce + (mine ? (this.ups.bounce ?? 0) : 0);
    const pierce = mine ? (this.ups.pierce ?? 0) : 0;
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
    u.pose.kickT = 0;
    u.pose.heavyT = 0;
    u.reveal = 2;
    if (u === this.me) {
      this.shake = 0.45;
      this.opts.vibrate?.([20, 30, 40]);
      // the moment: a flash, a beat of slow motion, the move's name big across the screen
      this.flash();
      this.slowT = 0.45;
      this.lockShow = 1.6;
      this.lockOn = tgt;
      this.punch = 1;
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
      if (!this.hostile(u, o) || !this.sees(u, o)) continue;
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
    const dmg = Math.round(amount);
    u.hp -= dmg;
    u.reveal = Math.max(u.reveal, 1);
    u.calm = 0;
    u.pose.flash = 1;
    if (from === this.me || u === this.me) this.pop(u.x, u.z, `-${dmg}`, from === this.me ? 'hit' : 'ouch');
    // the special's gauge, as in the main game: a marble that lands fills 8%, one taken 4.5%
    if (!spirit) u.charge = Math.min(1, u.charge + 0.045);
    if (from && from.alive) {
      if (!spirit) from.charge = Math.min(1, from.charge + 0.08);
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
    // (it stays standing through the pops, then blows apart)
    this.wrecks.push({ u, mesh: u.mesh, t: 0, pops: 0, shattered: false, debris: [] });
    if (from === this.me) this.kos++;
    if (this.kind === 'siege') {
      u.back = RESPAWN;
      if (u === this.me) this.callout(`BACK IN ${RESPAWN}`, 1);
      this.updateHud();
      return;
    }
    if (this.kind === 'ffa') {
      // its power cubes spill out (at least one)
      for (let k = 0; k < Math.max(1, u.cubes); k++) this.drop(u.x + (Math.random() - 0.5) * 0.8, u.z + (Math.random() - 0.5) * 0.8, 'cube');
    } else if (u.cpu && Math.random() < 0.35) this.drop(u.x, u.z, 'heal');
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
    if (!this.over && !this.paused) this.step(this.slowT > 0 ? dt * 0.3 : dt);
    this.draw(dt);
  };

  private step(dt: number) {
    this.time += dt;
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
    if (me.alive) {
      const sp = me.stunT > 0 ? 0 : me.speed * (me.slowT > 0 ? 0.5 : 1) * (me.chargeHold >= CHARGE.hold ? CHARGE.moveMul : 1);
      me.vx = mx * sp;
      me.vz = mz * sp;
      // the trigger: held on the aim stick (once dragged), the mouse button, or Space
      // FIRE held: at the nearest enemy, or wherever your thumb slides off the button to aim
      const a = this.aimStick;
      const dragged = a && Math.hypot(a.x - a.x0, a.y - a.y0) > 30;
      if (a) me.aim = dragged ? Math.atan2(a.x - a.x0, -(a.y - a.y0)) + (this.view === 'first' ? this.camYaw : 0) : this.autoAim();
      if (this.mouseFire) me.aim = this.mouseAngle();
      if (this.keyFire) me.aim = this.autoAim();
      me.firing = !!a || this.mouseFire || this.keyFire || me.burst > 0;
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
      if ((mx || mz) && !me.firing && !this.aimStick) me.face = Math.atan2(mx, -mz);
    }
    if (this.kind === 'siege') {
      this.tickForts(dt);
      this.tickCrates(dt);
      for (const u of this.units) if (!u.alive && u.back > 0 && (u.back -= dt) <= 0) this.respawn(u);
    }
    for (const u of this.units) if (u.cpu && u.alive) this.think(u, dt);
    for (const u of this.units) this.tickUnit(u, dt);
    this.tickBoxes(dt);
    this.moveShots(dt);
    this.pickups();
    if (this.kind === 'ffa') this.tickStorm(dt);
    this.checkEnd();
    this.updateHud();
  }

  /** Siege: back on its feet by its own fortress */
  private respawn(u: Unit) {
    const p = this.siegeSpot(u.team, Math.floor(Math.random() * 3));
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
    // (the last one was blown apart: a fresh body)
    if (u.mesh.broken) {
      const mesh = new ShooterMesh(u.def.id, u.def.ball, u.def);
      mesh.size = u.boss ? 0.78 : 0.55;
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
      if (u.idle > 0.45 && u.ammo < u.mag) u.ammo = Math.min(u.mag, u.ammo + dt * u.refill);
    }
    // standing still mends: not moving, not firing, and not hit for a moment
    const still = Math.hypot(u.vx, u.vz) < 0.3 && !u.firing;
    u.still = still ? u.still + dt : 0;
    const mending = u.still > 0.6 && u.calm > 2 && u.hp < u.max;
    if (mending) {
      const before = u.hp;
      u.hp = Math.min(u.max, u.hp + u.max * MEND * dt);
      u.healed += u.hp - before;
    }
    u.bar.classList.toggle('mend', mending);
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
    if (s.home && t?.alive && s.age > (s.recover ?? 0) && (!s.bank || s.banked)) {
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
            dead = true;
          }
          continue;
        }
        if (s.left <= 0) {
          dead = true;
          break;
        }
        const t = this.tile(s.x, s.z);
        if (this.blocksShot(t)) {
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
      if (dead) this.shots.splice(k, 1);
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
      const i = 1 + Math.floor(Math.random() * (this.W - 2));
      const j = 2 + Math.floor(Math.random() * (this.H - 4));
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
    this.hemi.intensity = 1.5 * (1 - 0.45 * this.dim);
    this.sun.intensity = 2 * (1 - 0.5 * this.dim);
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

  private checkEnd() {
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
    if (!foes && !this.cleared) {
      this.cleared = true;
      sfx.play('win', 0.6);
      if (this.room >= ROOMS) {
        setTimeout(() => this.finish(true, 1), 800);
        return;
      }
      this.callout('ROOM CLEAR');
      setTimeout(() => this.offerUpgrades(), 700);
    }
    // through the open door: the next room
    if (this.cleared && this.gateMeshes.length === 0 && this.me.z < -this.H / 2 + 0.6) {
      this.room++;
      this.startStage();
    }
  }

  private openDoor() {
    for (let i = 4; i <= 6; i++) this.grid[this.idx(i, 0)] = FLOOR;
    for (const g of this.gateMeshes) g.removeFromParent();
    this.gateMeshes = [];
    this.callout('THE DOOR IS OPEN ▲');
    sfx.play('whoosh');
  }

  // ---------- the CPU ----------

  private think(u: Unit, dt: number) {
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
      let bd = this.kind === 'gauntlet' ? 13 : this.kind === 'ffa' ? 6.5 : 9;
      for (const o of this.units) {
        if (!this.hostile(u, o) || !this.sees(u, o)) continue;
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
      if (this.blocked(u.x + ax * step * 3, u.z + az * step * 3, u.r)) {
        for (const turn of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
          const c = Math.cos(turn * u.strafe);
          const sn = Math.sin(turn * u.strafe);
          const bx = ax * c - az * sn;
          const bz = ax * sn + az * c;
          if (!this.blocked(u.x + bx * step * 3, u.z + bz * step * 3, u.r)) {
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
      this.shotMesh.setColorAt(n, s.color);
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
      this.haloMesh.setColorAt(h, s.color);
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
    const ang = Math.atan2(dx, -dy);
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
      this.v.set(u.x, (u.boss ? 2.4 : 1.75) - (this.view === 'first' ? 0.35 : 0), u.z).project(this.camera);
      u.bar.style.transform = `translate(${((this.v.x + 1) / 2) * w}px, ${((1 - this.v.y) / 2) * h}px) translate(-50%, -100%)`;
      (u.bar.querySelector('b') as HTMLElement).style.width = `${(u.hp / u.max) * 100}%`;
      u.bar.querySelector('i')!.setAttribute('data-hp', String(Math.max(0, Math.round(u.hp))));
      if (!u.cpu) (u.bar.querySelector('u') as HTMLElement).style.width = `${(u.ammo / u.mag) * 100}%`;
    }
    for (const f of this.forts) {
      this.v.set(f.x, 2.75 - (this.view === 'first' ? 0.3 : 0), f.z).project(this.camera);
      f.bar.style.transform = `translate(${((this.v.x + 1) / 2) * w}px, ${((1 - this.v.y) / 2) * h}px) translate(-50%, -100%)`;
      (f.bar.querySelector('b') as HTMLElement).style.width = `${(f.hp / f.max) * 100}%`;
      f.bar.querySelector('i')!.setAttribute('data-hp', String(Math.ceil(f.hp)));
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
    if (this.kind === 'siege') {
      const left = Math.max(0, Math.ceil(SIEGE_TIME - this.time));
      title.querySelector('b')!.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      const pct = (t: number) => Math.ceil(((this.forts.find((f) => f.team === t)?.hp ?? 0) / FORT_HP) * 100);
      title.querySelector('span')!.textContent = `OURS ${pct(0)}% · THEIRS ${pct(1)}%`;
    } else if (this.kind === 'ffa') {
      title.querySelector('b')!.textContent = `${alive}`;
      title.querySelector('span')!.textContent = 'FIGHTERS LEFT';
    } else {
      title.querySelector('b')!.textContent = `${this.room}/${ROOMS}`;
      title.querySelector('span')!.textContent = this.isBossRoom() ? 'BOSS ROOM' : 'ROOM';
    }
    this.hud.score.querySelector('b')!.textContent = String(this.kos);
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

  private get view(): ActionView {
    return this.opts.camera?.() ?? this.localView;
  }
  private cycleView() {
    const next = VIEWS[(VIEWS.indexOf(this.view) + 1) % VIEWS.length];
    if (this.opts.setCamera) this.opts.setCamera(next);
    else this.localView = next;
    this.camSnap = true;
    this.showView();
  }
  private showView() {
    (this.el.querySelector('.ac-view') as HTMLElement).textContent = VIEW_LABEL[this.view];
  }

  /** the camera follows you: from above and behind (far is near overhead), or low behind you in the cockpit view */
  private placeCamera(dt: number) {
    const me = this.me;
    const view = this.view;
    const tall = this.camera.aspect < 1;
    const mx = me ? me.x : 0;
    const mz = me ? me.z : 0;
    this.shake = Math.max(0, this.shake - dt);
    const j = this.shake * 0.4;
    const pos = new THREE.Vector3();
    const at = new THREE.Vector3();
    // (the cockpit view starts looking into the stage: up the room, or toward the middle)
    if (this.camSnap && me) this.camYaw = this.kind === 'ffa' && Math.hypot(me.x, me.z) > 1 ? Math.atan2(-me.x, me.z) : 0;
    // it sees the horizon: a sky, and a haze over the far side
    const sky = view === 'first';
    if (sky !== !!this.scene.fog || (sky && this.skyFor !== this.theme)) {
      this.skyFor = this.theme;
      this.skyDome.visible = sky;
      (this.skyDome.material as THREE.MeshBasicMaterial).color.setHex(this.theme.sky);
      this.scene.fog = sky ? new THREE.Fog(this.theme.sky, 16, 42) : null;
    }
    if (view === 'first') {
      const back = tall ? 7.4 : 6.4;
      const fx = Math.sin(this.camYaw);
      const fz = -Math.cos(this.camYaw);
      pos.set(mx - fx * back, tall ? 4.6 : 4, mz - fz * back);
      at.set(mx + fx * 5.5, 0.3, mz + fz * 5.5);
    } else {
      // (in a Gauntlet room the overhead views stop short of the edges, so the room fills the screen)
      const h = { far: tall ? 26 : 19, mid: this.kind !== 'gauntlet' ? (tall ? 13.5 : 11) : tall ? 17 : 12, near: tall ? 10.5 : 8.5 }[view];
      const back = { far: 0.22, mid: 0.55, near: 0.85 }[view];
      const room = this.kind === 'gauntlet' && view !== 'near';
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
      const k = 1 - Math.exp(-dt * 9);
      this.camPos.lerp(pos, k);
      this.camAt.lerp(at, k);
    }
    // pushing in: a punch for your special (easing out), and a lean in while you charge
    this.punch = Math.max(0, this.punch - dt * 1.6);
    const charge = me && me.alive && me.chargeHold >= CHARGE.hold ? 0.06 + (me.stored / CHARGE.max) * 0.1 : 0;
    const zoom = 1 - Math.max(charge, this.punch * 0.3);
    const cp = this.camAt.clone().add(this.camPos.clone().sub(this.camAt).multiplyScalar(zoom));
    this.camera.position.set(cp.x + (Math.random() - 0.5) * j, cp.y, cp.z + (Math.random() - 0.5) * j);
    this.camera.lookAt(this.camAt);
    // (the cockpit view's picture is lifted, so you stand above the thumb tray rather than behind it)
    const lift = view === 'first' ? Math.round(this.camera.aspect < 1 ? 0.17 * this.vh : 0.08 * this.vh) : 0;
    if (lift !== this.lift) {
      this.lift = lift;
      if (lift) this.camera.setViewOffset(this.vw, this.vh, 0, lift, this.vw, this.vh);
      else this.camera.clearViewOffset();
    }
    this.skyDome.position.copy(this.camera.position);
  }

  private best(): { ffa: number; gauntlet: number; siege: number } {
    try {
      return { ffa: 0, gauntlet: 0, siege: 0, ...JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') };
    } catch {
      return { ffa: 0, gauntlet: 0, siege: 0 };
    }
  }
  private bestLine() {
    const b = this.best();
    return `Best: ${b.gauntlet}/${ROOMS} rooms · ${b.ffa} free-for-all win${b.ffa === 1 ? '' : 's'} · ${b.siege} siege win${b.siege === 1 ? '' : 's'}`;
  }

  /** Siege over: 1 your side won, -1 theirs, 0 a draw at the bell */
  private siegeOutcome = 0;
  private warned = false;
  private finishSiege(result: number) {
    if (this.over) return;
    this.siegeOutcome = result;
    setTimeout(() => this.finish(result > 0, result > 0 ? 1 : result < 0 ? 2 : 0), result ? 1200 : 300);
    this.callout(result > 0 ? 'THEIR FORTRESS FALLS!' : result < 0 ? 'YOUR FORTRESS FALLS' : 'TIME · A DRAW', result < 0 ? 1 : 0);
    this.over = true;
    this.shots = [];
  }

  private finish(win: boolean, place: number) {
    if (this.over && this.kind !== 'siege') return;
    if (this.kind === 'siege' && !this.hud.panel.classList.contains('hidden')) return;
    this.over = true;
    this.shots = [];
    sfx.play(win ? 'win' : 'lose');
    const best = this.best();
    // best: the most rooms cleared, or the most free-for-all wins
    if (this.kind === 'gauntlet') best.gauntlet = Math.max(best.gauntlet, win ? ROOMS : this.room - 1);
    else if (win && this.kind === 'ffa') best.ffa += 1;
    else if (win) best.siege += 1;
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(best));
    } catch {
      // storage unavailable
    }
    this.showPanel(win ? 'win' : 'lose', place);
    // XP for your fighter, as in the other modes: rooms cleared (gauntlet) or how high you placed (free-for-all), plus KOs
    const gain =
      this.kind === 'gauntlet'
        ? (win ? ROOMS : this.room - 1) * 5 + this.kos * 2 + (win ? 30 : 0)
        : this.kind === 'siege'
          ? (win ? 60 : place === 0 ? 35 : 20) + this.kos * 4 + Math.round((this.fortDealt / FORT_HP) * 40)
          : (7 - place) * 8 + this.kos * 5 + (win ? 20 : 0);
    const box = this.hud.panel.querySelector('.ac-xp') as HTMLElement;
    box.classList.toggle('hidden', !this.opts.reward);
    this.opts.reward?.(box, this.unitId, Math.max(10, gain));
  }

  private showPanel(kind: 'start' | 'win' | 'lose' | 'upgrade' | null, place = 0) {
    const p = this.hud.panel;
    p.classList.toggle('hidden', !kind);
    this.paused = kind === 'upgrade';
    if (!kind) return;
    const h = p.querySelector('h2')!;
    const text = p.querySelector('.ac-text') as HTMLElement;
    const cards = p.querySelector('.ac-cards') as HTMLElement;
    const buttons = p.querySelector('.ac-buttons') as HTMLElement;
    const bestEl = p.querySelector('.ac-best') as HTMLElement;
    cards.innerHTML = '';
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
    if (kind === 'start') {
      h.textContent = 'Action';
      text.textContent = 'Walk anywhere on the stage and take the other fighters down. Left thumb walks. Tap FIRE to shoot at the nearest fighter; hold it to charge up to five marbles and let go to fire them as one; slide your thumb off it to aim. SPECIAL fires your fighter’s own move once it’s charged. Standing still mends you.';
      const mode = (k: ActionKind, title: string, sub: string) => {
        const c = document.createElement('button');
        c.className = 'ac-mode';
        c.innerHTML = `<b>${title}</b><small>${sub}</small>`;
        c.addEventListener('click', () => this.begin(k));
        cards.appendChild(c);
      };
      mode('gauntlet', 'Gauntlet', `Clear ${ROOMS} rooms, pick an upgrade after each, a boss every fifth room`);
      mode('ffa', 'Free-for-all', 'You and five fighters, one stage, bushes, crates and a closing storm');
      mode('siege', 'Siege', 'Three on three: knock down their fortress before they knock down yours');
      bestEl.textContent = this.bestLine();
      button('Back', () => this.exit());
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
    } else {
      const ffa = this.kind === 'ffa';
      if (this.kind === 'siege') {
        const o = this.siegeOutcome;
        h.textContent = o > 0 ? 'Fortress down!' : o < 0 ? 'Fortress lost' : 'A draw';
        const pct = (t: number) => Math.ceil(((this.forts.find((f) => f.team === t)?.hp ?? 0) / FORT_HP) * 100);
        text.textContent = `${o > 0 ? 'Your side knocked theirs down' : o < 0 ? 'Their side knocked yours down' : 'Time ran out'}: yours ${pct(0)}%, theirs ${pct(1)}%. You knocked off ${Math.round((this.fortDealt / FORT_HP) * 100)}% and took down ${this.kos} fighter${this.kos === 1 ? '' : 's'}.`;
      } else h.textContent = kind === 'win' ? (ffa ? 'Victory!' : 'Gauntlet cleared!') : ffa ? `#${place} of 6` : 'Knocked out';
      if (this.kind !== 'siege') text.textContent = ffa ? (kind === 'win' ? `Last one standing, with ${this.kos} KO${this.kos === 1 ? '' : 's'}.` : `${this.kos} KO${this.kos === 1 ? '' : 's'} before you went down.`) : kind === 'win' ? `All ${ROOMS} rooms, ${this.kos} fighters down.` : `You reached room ${this.room} with ${this.kos} KO${this.kos === 1 ? '' : 's'}.`;
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
      if (!this.hostile(me, u) || !this.sees(me, u)) continue;
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
    const left = e.clientX < this.el.clientWidth / 2;
    const s = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
    if (left && !this.moveStick) {
      this.moveStick = s;
      this.stickEl(s);
    }
  };
  private fireDown = (e: PointerEvent) => {
    e.stopPropagation();
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
