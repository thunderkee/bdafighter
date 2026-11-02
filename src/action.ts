import * as THREE from 'three';
import { celify } from './cel';
import { InkOnly } from './post';
import { ShooterMesh, characterById, playable, studioEnv, type CharacterDef } from './robot';
import { traitMul } from './roster';
import { BALANCE_ARENA, BASE_STATS, MAG_ARENA, MAG_ARENA_OF, MARBLES, MARBLE_OF, MATCH, type MarbleType } from './config';
import { MOVE_NAMES, SPIRIT, SPIRIT_OF, type SpiritKind } from './game';
import * as sfx from './audio';

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

export type ActionKind = 'gauntlet' | 'ffa';

// tiles
const FLOOR = 0;
const WALL = 1;
const CRATE = 2;
const BUSH = 3;
const WATER = 4;
const GATE = 5;

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
const STORM_START = 20;
const STORM_END = 95;
const STORM_DPS = 700;
const BEST_KEY = 'marble-fighter:action:best';

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
type Drop = { x: number; z: number; kind: 'cube' | 'heal'; mesh: THREE.Object3D };
type Pop = { el: HTMLElement; x: number; z: number; t: number };

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
  private gateMeshes: THREE.Object3D[] = [];
  private units: Unit[] = [];
  private me: Unit | null = null;
  private shots: Shot[] = [];
  private drops: Drop[] = [];
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
  private shake = 0;

  // shots drawn as instances
  private shotMesh: THREE.InstancedMesh;
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
    private opts: { unit: string; skin?: (id: string) => CharacterDef; onExit: () => void; saver?: () => boolean; vibrate?: (pattern: number | number[]) => void },
  ) {
    this.unitId = opts.unit;
    this.el = document.createElement('div');
    this.el.id = 'action';
    this.el.className = 'hidden';
    this.el.innerHTML = `
      <canvas></canvas>
      <div class="ac-bars"></div>
      <div class="ac-hud">
        <div class="ac-top">
          <button class="ac-quit key round" aria-label="Back">✕</button>
          <div class="ac-title"><b></b><span></span></div>
          <div class="ac-score"><b>0</b><span>KOS</span></div>
        </div>
        <p class="ac-callout"></p>
        <p class="ac-hint">LEFT THUMB WALKS · RIGHT THUMB AIMS AND FIRES · TAP TO AUTO-FIRE · STAND STILL TO MEND</p>
      </div>
      <div class="ac-stick ac-move hidden"><i></i></div>
      <div class="ac-stick ac-aim hidden"><i></i></div>
      <button class="ac-super" aria-label="Special"><b>SPECIAL</b><i></i></button>
      <div class="ac-panel">
        <h2>Action</h2>
        <p class="ac-unit"></p>
        <p class="ac-text"></p>
        <div class="ac-cards"></div>
        <p class="ac-best"></p>
        <div class="ac-buttons"></div>
      </div>`;
    host.appendChild(this.el);
    this.canvas = this.el.querySelector('canvas')!;
    for (const k of ['bars', 'title', 'score', 'callout', 'hint', 'panel', 'super']) this.hud[k] = this.el.querySelector(`.ac-${k}`)!;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.scene.environment = studioEnv(this.renderer);
    this.scene.environmentIntensity = 0.4;
    this.ink = new InkOnly(this.renderer, this.scene, this.camera);
    this.scene.add(new THREE.HemisphereLight(0xeef4ff, 0x4a5a3a, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(-6, 14, 5);
    this.scene.add(sun, this.world);

    this.shotMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), 300);
    this.shotMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(300 * 3), 3);
    this.shotMesh.frustumCulled = false;
    this.scene.add(this.shotMesh);
    const guide = new THREE.PlaneGeometry(1, 1);
    guide.translate(0, 0.5, 0);
    guide.rotateX(-Math.PI / 2);
    this.aimGuide = new THREE.Mesh(guide, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
    this.aimGuide.visible = false;
    this.scene.add(this.aimGuide);

    this.el.querySelector('.ac-quit')!.addEventListener('click', () => this.exit());
    this.canvas.addEventListener('pointerdown', this.down);
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.hud.super.addEventListener('pointerdown', this.superDown);
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
    this.startStage();
    this.showPanel(null);
    this.hud.hint.classList.remove('gone');
    setTimeout(() => this.hud.hint.classList.add('gone'), 3500);
  }

  private kos = 0;
  private startStage() {
    this.clearStage();
    this.cleared = false;
    this.storm = this.kind === 'ffa' ? this.W / 2 : 99;
    this.time = this.kind === 'ffa' ? 0 : this.time;
    this.buildStage();
    const keep = this.me ? { hp: this.me.hp / this.me.max, charge: this.me.charge } : null;
    this.spawnMe();
    if (keep && this.kind === 'gauntlet' && this.room > 1) {
      this.me!.hp = Math.max(1, this.me!.max * Math.min(1, keep.hp + 0.08));
      this.me!.charge = keep.charge;
    }
    this.spawnFoes();
    this.over = false;
    this.callout(this.kind === 'ffa' ? 'FREE-FOR-ALL' : this.isBossRoom() ? `ROOM ${this.room} · BOSS` : `ROOM ${this.room}`);
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
    this.me = null;
    this.shots = [];
    for (const d of this.drops) d.mesh.removeFromParent();
    this.drops = [];
    for (const p of this.pops) p.el.remove();
    this.pops = [];
    this.world.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) m.geometry.dispose();
    });
    this.world.clear();
    this.crateHp.clear();
    this.crateMesh.clear();
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
  private blocksMove = (t: number) => t === WALL || t === CRATE || t === WATER || t === GATE;
  private blocksShot = (t: number) => t === WALL || t === CRATE || t === GATE;

  private buildStage() {
    if (this.kind === 'ffa') {
      this.W = this.H = 28;
      this.layoutFfa();
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

  private ffaStarts() {
    return Array.from({ length: 6 }, (_, k) => {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 2;
      return { x: Math.cos(a) * 11, z: Math.sin(a) * 11 };
    });
  }

  private drawStage() {
    const { W, H } = this;
    const ffa = this.kind === 'ffa';
    // the floor: a checker of two tones with a fine grid
    const cv = document.createElement('canvas');
    cv.width = W * 32;
    cv.height = H * 32;
    const c = cv.getContext('2d')!;
    const tones = ffa ? ['#7fc25a', '#76b852'] : ['#8a93b8', '#828bb0'];
    for (let i = 0; i < W; i++)
      for (let j = 0; j < H; j++) {
        c.fillStyle = tones[(i + j) % 2];
        c.fillRect(i * 32, j * 32, 32, 32);
      }
    c.strokeStyle = 'rgba(0,0,0,0.06)';
    for (let i = 0; i <= W; i++) {
      c.beginPath();
      c.moveTo(i * 32, 0);
      c.lineTo(i * 32, H * 32);
      c.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    this.world.add(floor);
    // round the outside, a darker apron so the edge reads
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(W + 40, H + 40), new THREE.MeshStandardMaterial({ color: ffa ? 0x3a6a8a : 0x2a2440, roughness: 1 }));
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
    inst(wallGeo, new THREE.MeshStandardMaterial({ color: ffa ? 0xc8a46a : 0x5a4a8a, roughness: 0.8 }), WALL, () => {});
    const bushGeo = new THREE.IcosahedronGeometry(0.64, 0);
    bushGeo.translate(0, 0.5, 0);
    inst(bushGeo, this.bushMat, BUSH, (o, i, j) => {
      o.rotation.y = (i * 7 + j * 13) % 6;
      o.scale.set(1, 0.85 + ((i + j) % 3) * 0.08, 1);
    });
    const waterGeo = new THREE.PlaneGeometry(1, 1);
    waterGeo.rotateX(-Math.PI / 2);
    waterGeo.translate(0, 0.015, 0);
    inst(waterGeo, new THREE.MeshStandardMaterial({ color: 0x3ac8ef, roughness: 0.2, metalness: 0.1 }), WATER, () => {});
    // crates and the door are one mesh each: they come away
    const crateGeo = new THREE.BoxGeometry(0.86, 0.86, 0.86);
    crateGeo.translate(0, 0.43, 0);
    const crateMat = new THREE.MeshStandardMaterial({ color: 0xb87a3e, roughness: 0.8 });
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x6a3f1e, roughness: 0.8 });
    const bandGeo = new THREE.BoxGeometry(0.9, 0.12, 0.9);
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const t = this.grid[this.idx(i, j)];
        const p = this.center(i, j);
        if (t === CRATE) {
          const g = new THREE.Group();
          g.add(new THREE.Mesh(crateGeo, crateMat));
          for (const y of [0.16, 0.7]) {
            const b = new THREE.Mesh(bandGeo, bandMat);
            b.position.y = y;
            g.add(b);
          }
          g.position.set(p.x, 0, p.z);
          this.world.add(g);
          this.crateMesh.set(this.idx(i, j), g);
        } else if (t === GATE) {
          const bars = new THREE.Mesh(new THREE.BoxGeometry(1, 1.1, 0.3), new THREE.MeshStandardMaterial({ color: 0xff5a5a, emissive: 0x801010, roughness: 0.5 }));
          bars.position.set(p.x, 0.55, p.z);
          this.world.add(bars);
          this.gateMeshes.push(bars);
        }
      }
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
    const max = Math.round(BASE_HP * traitMul(t?.health, 'health') * (opts.hp ?? 1));
    const bar = document.createElement('div');
    bar.className = 'ac-bar' + (cpu ? '' : ' me');
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
      speed: 3.3 * Math.sqrt(traitMul(t?.speed, 'speed')) * (boss ? 0.85 : 1),
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
    };
    this.units.push(u);
    return u;
  }

  private spawnMe() {
    const def = this.opts.skin?.(this.unitId) ?? characterById(this.unitId);
    const start = this.kind === 'ffa' ? this.ffaStarts()[0] : { x: 0, z: this.H / 2 - 2 };
    this.me = this.makeUnit(def, start.x, start.z, false, 0);
    this.me.face = Math.PI;
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
    this.hud.super.querySelector('b')!.textContent = MOVE_NAMES[baseOf(def)] ?? 'SPECIAL';
  }

  private pickFoes(n: number) {
    const pool = playable().filter((c) => c.id !== this.unitId);
    const out: CharacterDef[] = [];
    for (let k = 0; k < n; k++) {
      if (!pool.length) pool.push(...playable());
      out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return out;
  }

  private spawnFoes() {
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

  /** one marble out of the magazine, toward u.aim */
  private shoot(u: Unit) {
    const mine = u === this.me && this.kind === 'gauntlet';
    const color = new THREE.Color(u.def.ball);
    const bounce = u.bounce + (mine ? (this.ups.bounce ?? 0) : 0);
    const pierce = mine ? (this.ups.pierce ?? 0) : 0;
    const out = (ang: number, side: number, dmg: number) => {
      const sx = u.x + Math.sin(ang) * (u.r + 0.1) + Math.cos(ang) * side;
      const sz = u.z - Math.cos(ang) * (u.r + 0.1) + Math.sin(ang) * side;
      this.shots.push({ x: sx, z: sz, vx: Math.sin(ang) * u.shotSpeed, vz: -Math.cos(ang) * u.shotSpeed, owner: u, dmg, r: u.shotR, left: u.range, bounce, pierce, hit: new Set(), color, big: false });
    };
    const ang = u.aim + (Math.random() - 0.5) * 2 * BASE_STATS.spread;
    const dmg = u.dmg * u.power;
    const two = mine && (this.ups.multi ?? 0) > 0;
    if (two) {
      out(ang, -0.14, dmg * 0.75);
      out(ang, 0.14, dmg * 0.75);
    } else out(ang, 0, dmg);
    const fan = mine ? (this.ups.fan ?? 0) : 0;
    for (let f = 1; f <= fan; f++) for (const side of [-1, 1]) out(ang + side * 0.3 * f, 0, dmg * 0.6);
    u.face = u.aim;
    u.pose.kickT = 0;
    u.pose.lastHand = u.def.twin ? -u.pose.lastHand : 1;
    u.reveal = 1.2;
    if (u === this.me || Math.random() < 0.35) sfx.play('fire', u === this.me ? 0.45 : 0.2);
  }

  /** its own special, as in the main game: the same balls, homing, quirks and damage shares */
  private special(u: Unit, angle: number) {
    if (!u.alive || u.charge < 1 || u.stunT > 0) return;
    u.charge = 0;
    u.firing = false;
    const tgt = this.nearestFoe(u);
    const at = tgt ? Math.atan2(tgt.x - u.x, -(tgt.z - u.z)) : angle;
    const dist = tgt ? Math.hypot(tgt.x - u.x, tgt.z - u.z) : 7;
    const steel = 0xdfe6ee;
    const ball = (o: Partial<Shot> & { size?: number; share?: number }, ang = angle, delay = 0) => {
      const { size = 1, share = 1, ...rest } = o;
      const sp = 9.5 * (rest.speed ?? 1);
      const shot: Partial<Shot> = {
        r: 0.3 * size,
        dmg: SPIRIT.damage * SCALE * share * u.power,
        speed: sp,
        home: SPIRIT.turn,
        tgt,
        recover: 0.12,
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
      this.shake = 0.35;
      this.opts.vibrate?.([20, 30, 40]);
    }
    sfx.play('super');
    const name = MOVE_NAMES[baseOf(u.def)] ?? 'SPECIAL';
    this.callout(u === this.me ? `${name}!` : `${u.def.name.toUpperCase()} · ${name}`, u === this.me ? 0 : 1);
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
    u.wrap.visible = false;
    u.shadow.visible = false;
    u.bar.classList.add('gone');
    sfx.play('explode', u.boss ? 1 : 0.6);
    if (from === this.me) this.kos++;
    if (this.kind === 'ffa') {
      // its power cubes spill out (at least one)
      for (let k = 0; k < Math.max(1, u.cubes); k++) this.drop(u.x + (Math.random() - 0.5) * 0.8, u.z + (Math.random() - 0.5) * 0.8, 'cube');
    } else if (u.cpu && Math.random() < 0.35) this.drop(u.x, u.z, 'heal');
    if (u === this.me) {
      const place = this.units.filter((x) => x.alive).length + 1;
      setTimeout(() => this.finish(false, place), 900);
    }
    this.updateHud();
  }

  private drop(x: number, z: number, kind: 'cube' | 'heal') {
    const mesh =
      kind === 'cube'
        ? new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshStandardMaterial({ color: 0x5aff7a, emissive: 0x1a8a3a }))
        : new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshStandardMaterial({ color: 0xff6a9a, emissive: 0x8a1a3a }));
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
    this.drop(p.x, p.z, this.kind === 'ffa' ? 'cube' : 'heal');
    sfx.play('clatter', 0.6);
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
    if (!this.over && !this.paused) this.step(dt);
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
    if (me.alive) {
      const sp = me.stunT > 0 ? 0 : me.speed * (me.slowT > 0 ? 0.5 : 1);
      me.vx = mx * sp;
      me.vz = mz * sp;
      // the trigger: held on the aim stick (once dragged), the mouse button, or Space
      const a = this.aimStick;
      const dragged = a && !a.big && Math.hypot(a.x - a.x0, a.y - a.y0) > 14;
      if (dragged) me.aim = Math.atan2(a.x - a.x0, -(a.y - a.y0));
      if (this.mouseFire) me.aim = this.mouseAngle();
      if (this.keyFire) me.aim = this.autoAim();
      me.firing = !!dragged || this.mouseFire || this.keyFire || me.burst > 0;
      this.walk(me, me.vx * dt, me.vz * dt);
      if ((mx || mz) && !me.firing && !this.aimStick) me.face = Math.atan2(mx, -mz);
    }
    for (const u of this.units) if (u.cpu && u.alive) this.think(u, dt);
    for (const u of this.units) this.tickUnit(u, dt);
    this.moveShots(dt);
    this.pickups();
    if (this.kind === 'ffa') this.tickStorm(dt);
    this.checkEnd();
    this.updateHud();
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
    if (u.firing && u.stunT <= 0 && u.ammo >= 1) {
      u.idle = 0;
      u.fireT -= dt;
      while (u.fireT <= 0 && u.ammo >= 1) {
        this.shoot(u);
        u.ammo -= 1;
        u.fireT += u.fireInt;
      }
    } else {
      u.fireT = Math.max(0, u.fireT - dt);
      if (!u.firing) {
        u.idle += dt;
        if (u.idle > 0.45 && u.ammo < u.mag) u.ammo = Math.min(u.mag, u.ammo + dt * u.refill);
      }
    }
    // standing still mends: not moving, not firing, and not hit for a moment
    const still = Math.hypot(u.vx, u.vz) < 0.3 && !u.firing;
    u.still = still ? u.still + dt : 0;
    const mending = u.still > 0.6 && u.calm > 2 && u.hp < u.max;
    if (mending) u.hp = Math.min(u.max, u.hp + u.max * MEND * dt);
    u.bar.classList.toggle('mend', mending);
    for (const q of u.queue) q.t -= dt;
    while (u.queue.length && u.queue[0].t <= 0) {
      const q = u.queue.shift()!;
      this.launchBall(u, q.angle, q.o);
    }
    u.pose.kickT += dt;
    u.pose.heavyT += dt;
    u.pose.flash = Math.max(0, u.pose.flash - dt * 4);
  }

  /** a special's ball lands on someone: its damage, and its quirk */
  private ballHits(s: Shot, u: Unit) {
    this.hurt(u, s.dmg, s.owner, true);
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
          if (t === CRATE && key >= 0) {
            const hp = (this.crateHp.get(key) ?? CRATE_HP) - s.dmg;
            this.crateHp.set(key, hp);
            sfx.play('wall', 0.3);
            if (hp <= 0) this.breakCrate(key);
            dead = true;
          } else if (s.bounce > 0) {
            s.bounce--;
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

  private pickups() {
    for (let k = this.drops.length - 1; k >= 0; k--) {
      const d = this.drops[k];
      for (const u of this.units) {
        if (!u.alive || (u.x - d.x) ** 2 + (u.z - d.z) ** 2 > 0.5 ** 2) continue;
        if (d.kind === 'cube') {
          // a power cube: a little more health and hit
          u.cubes++;
          u.max = Math.round(u.max * 1.1);
          u.hp = Math.min(u.max, u.hp + u.max * 0.1);
          u.power *= 1.08;
        } else {
          if (u !== this.me) continue;
          u.hp = Math.min(u.max, u.hp + u.max * 0.25);
        }
        if (u === this.me) {
          sfx.play('charge', 0.6);
          this.pop(u.x, u.z, d.kind === 'cube' ? 'POWER UP' : 'HEAL', 'good');
        }
        d.mesh.removeFromParent();
        this.drops.splice(k, 1);
        break;
      }
    }
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
      let bd = this.kind === 'ffa' ? 9 : 13;
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
        else fire = !u.reloading && u.cycle > 0;
      }
      u.face = Math.atan2(ox, -oz);
    } else {
      // nothing in sight: shoot open a crate nearby, pick up cubes, head for the middle
      const cube = this.kind === 'ffa' ? this.drops.find((d) => Math.hypot(d.x - u.x, d.z - u.z) < 7) : undefined;
      const crate = !cube && this.kind === 'ffa' ? this.nearCrate(u) : null;
      if (crate && !u.reloading) {
        u.aim = Math.atan2(crate.x - u.x, -(crate.z - u.z));
        fire = u.cycle > 0;
      }
      const g = cube ?? u.step ?? u.goal;
      if (g) {
        const ox = g.x - u.x;
        const oz = g.z - u.z;
        const d = Math.hypot(ox, oz) || 1;
        dx = ox / d;
        dz = oz / d;
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
      const sp = u.stunT > 0 ? 0 : u.speed * (u.slowT > 0 ? 0.5 : 1);
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
      const hidden = !!me && u.cpu && me.alive && !this.sees(me, u);
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
      p.vx = Math.hypot(u.vx, u.vz) > 0.3 ? 3 : 0;
      p.firing = u.queue.length > 0 || p.kickT < 0.2;
      p.recoil = Math.max(0, 1 - p.kickT / 0.12) * 0.6;
      u.mesh.sync(p as never, this.time, dt);
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
    this.drawAimGuide();
    // the camera follows you from above and behind
    // (in a Gauntlet room it stops short of the edges, so the room fills the screen)
    const room = this.kind === 'gauntlet';
    const view = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect * 18;
    const fx = room ? THREE.MathUtils.clamp(me ? me.x : 0, -Math.max(0, this.W / 2 - view + 0.3), Math.max(0, this.W / 2 - view + 0.3)) : me ? me.x : 0;
    const fz = room ? THREE.MathUtils.clamp(me ? me.z : 0, -this.H / 2 + 6, this.H / 2 - 6.5) : me ? me.z : 0;
    this.shake = Math.max(0, this.shake - dt);
    const j = this.shake * 0.4;
    const tall = this.camera.aspect < 1;
    const h = this.kind === 'ffa' ? (tall ? 13.5 : 11) : tall ? 17 : 12;
    this.camera.position.set(fx + (Math.random() - 0.5) * j, h, fz + h * 0.55 + (Math.random() - 0.5) * j);
    this.camera.lookAt(fx, 0, fz - (tall ? 0.5 : 0));
    celify(this.scene, true);
    this.ink.render();
    this.placeBars();
    this.tickPops(dt);
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
    if (Math.hypot(dx, dy) < 14) {
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
      this.v.set(u.x, u.boss ? 2.4 : 1.75, u.z).project(this.camera);
      u.bar.style.transform = `translate(${((this.v.x + 1) / 2) * w}px, ${((1 - this.v.y) / 2) * h}px) translate(-50%, -100%)`;
      (u.bar.querySelector('b') as HTMLElement).style.width = `${(u.hp / u.max) * 100}%`;
      u.bar.querySelector('i')!.setAttribute('data-hp', String(Math.max(0, Math.round(u.hp))));
      if (!u.cpu) (u.bar.querySelector('u') as HTMLElement).style.width = `${(u.ammo / u.mag) * 100}%`;
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
    if (this.kind === 'ffa') {
      title.querySelector('b')!.textContent = `${alive}`;
      title.querySelector('span')!.textContent = 'FIGHTERS LEFT';
    } else {
      title.querySelector('b')!.textContent = `${this.room}/${ROOMS}`;
      title.querySelector('span')!.textContent = this.isBossRoom() ? 'BOSS ROOM' : 'ROOM';
    }
    this.hud.score.querySelector('b')!.textContent = String(this.kos);
    const c = this.me?.charge ?? 0;
    this.hud.super.classList.toggle('ready', c >= 1);
    (this.hud.super.querySelector('i') as HTMLElement).style.height = `${c * 100}%`;
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

  private best(): { ffa: number; gauntlet: number } {
    try {
      return { ffa: 0, gauntlet: 0, ...JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') };
    } catch {
      return { ffa: 0, gauntlet: 0 };
    }
  }

  private finish(win: boolean, place: number) {
    if (this.over) return;
    this.over = true;
    this.shots = [];
    sfx.play(win ? 'win' : 'lose');
    const best = this.best();
    // best: the most rooms cleared, or the most free-for-all wins
    if (this.kind === 'gauntlet') best.gauntlet = Math.max(best.gauntlet, win ? ROOMS : this.room - 1);
    else if (win) best.ffa += 1;
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(best));
    } catch {
      // storage unavailable
    }
    this.showPanel(win ? 'win' : 'lose', place);
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
    const best = this.best();
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
      text.textContent = 'Walk anywhere on the stage and take the other fighters down. Left thumb walks; right thumb aims and fires while you hold it (a tap auto-fires). Your marbles, magazine and special are your fighter’s own. Landing hits charges the special; standing still mends you.';
      const mode = (k: ActionKind, title: string, sub: string) => {
        const c = document.createElement('button');
        c.className = 'ac-mode';
        c.innerHTML = `<b>${title}</b><small>${sub}</small>`;
        c.addEventListener('click', () => this.begin(k));
        cards.appendChild(c);
      };
      mode('gauntlet', 'Gauntlet', `Clear ${ROOMS} rooms, pick an upgrade after each, a boss every fifth room`);
      mode('ffa', 'Free-for-all', 'You and five fighters, one stage, bushes, crates and a closing storm');
      bestEl.textContent = `Best: ${best.gauntlet}/${ROOMS} rooms · ${best.ffa} free-for-all win${best.ffa === 1 ? '' : 's'}`;
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
      h.textContent = kind === 'win' ? (ffa ? 'Victory!' : 'Gauntlet cleared!') : ffa ? `#${place} of 6` : 'Knocked out';
      text.textContent = ffa ? (kind === 'win' ? `Last one standing, with ${this.kos} KO${this.kos === 1 ? '' : 's'}.` : `${this.kos} KO${this.kos === 1 ? '' : 's'} before you went down.`) : kind === 'win' ? `All ${ROOMS} rooms, ${this.kos} fighters down.` : `You reached room ${this.room} with ${this.kos} KO${this.kos === 1 ? '' : 's'}.`;
      bestEl.textContent = `Best: ${best.gauntlet}/${ROOMS} rooms · ${best.ffa} free-for-all win${best.ffa === 1 ? '' : 's'}`;
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
    this.camera.updateProjectionMatrix();
  };

  /** the nearest enemy you can see, for a tap or the keyboard */
  private autoAim(): number {
    const me = this.me!;
    let best: Unit | null = null;
    let bd = 12;
    for (const u of this.units) {
      if (!this.hostile(me, u) || !this.sees(me, u)) continue;
      // (one behind a wall counts as further away, so a clear shot wins)
      const d = Math.hypot(u.x - me.x, u.z - me.z) + (this.clearLine(me.x, me.z, u.x, u.z) ? 0 : 6);
      if (d < bd) {
        bd = d;
        best = u;
      }
    }
    if (best) return Math.atan2(best.x - me.x, -(best.z - me.z));
    // nothing in sight: a crate, or straight ahead
    const crate = this.nearCrate(me);
    if (crate) return Math.atan2(crate.x - me.x, -(crate.z - me.z));
    return me.face;
  }

  private stickEl(which: 'move' | 'aim', s: { x0: number; y0: number; x: number; y: number } | null) {
    const el = this.el.querySelector(`.ac-${which}`) as HTMLElement;
    el.classList.toggle('hidden', !s);
    if (!s) return;
    const r = this.el.getBoundingClientRect();
    el.style.left = `${s.x0 - r.left}px`;
    el.style.top = `${s.y0 - r.top}px`;
    const dx = s.x - s.x0;
    const dy = s.y - s.y0;
    const len = Math.hypot(dx, dy);
    const k = len > 46 ? 46 / len : 1;
    (el.querySelector('i') as HTMLElement).style.transform = `translate(${dx * k}px, ${dy * k}px)`;
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
      if (e.button === 2 || e.shiftKey) this.special(this.me, this.mouseAngle());
      else this.mouseFire = true;
      return;
    }
    const left = e.clientX < this.el.clientWidth / 2;
    const s = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
    if (left && !this.moveStick) {
      this.moveStick = s;
      this.stickEl('move', s);
    } else if (!left && !this.aimStick) {
      this.aimStick = { ...s, t0: performance.now(), big: false };
      this.stickEl('aim', s);
    }
  };
  private superDown = (e: PointerEvent) => {
    e.stopPropagation();
    if (this.over || this.paused || !this.me?.alive || this.me.charge < 1) return;
    if (e.pointerType === 'mouse') {
      this.special(this.me, this.autoAim());
      return;
    }
    this.aimStick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), big: true };
    this.stickEl('aim', this.aimStick);
  };
  private pmove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') this.mouseAt = { x: e.clientX, y: e.clientY };
    for (const s of [this.moveStick, this.aimStick]) {
      if (s && s.id === e.pointerId) {
        s.x = e.clientX;
        s.y = e.clientY;
      }
    }
    if (this.moveStick) this.stickEl('move', this.moveStick);
    if (this.aimStick) this.stickEl('aim', this.aimStick);
  };
  private up = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') this.mouseFire = false;
    if (this.moveStick?.id === e.pointerId) {
      this.moveStick = null;
      this.stickEl('move', null);
    }
    const a = this.aimStick;
    if (a?.id === e.pointerId) {
      this.aimStick = null;
      this.stickEl('aim', null);
      if (this.over || this.paused || !this.me?.alive) return;
      const dx = a.x - a.x0;
      const dy = a.y - a.y0;
      const dragged = Math.hypot(dx, dy) > 14;
      if (a.big) this.special(this.me, dragged ? Math.atan2(dx, -dy) : this.autoAim());
      else if (!dragged) {
        // a quick tap: a short burst at the nearest enemy
        this.me.aim = this.autoAim();
        this.me.burst = 0.4;
      }
    }
  };
  private keydown = (e: KeyboardEvent) => {
    if (!this.running) return;
    this.keys.add(e.code);
    if (this.over || this.paused || !this.me?.alive) return;
    if (e.code === 'Space') this.keyFire = true;
    if (e.code === 'KeyE' || e.code === 'KeyQ') this.special(this.me, this.autoAim());
    if (e.code === 'Escape') this.exit();
  };
  private keyup = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === 'Space') this.keyFire = false;
  };
}
