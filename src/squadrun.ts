import * as THREE from 'three';
import { celify } from './cel';
import { ShooterMesh, characterById, playable, studioEnv, type CharacterDef } from './robot';
import * as sfx from './audio';
import { fillPortraits } from './portraits';
import { ITEMS, type ItemType } from './items';

/**
 * Squad Run: a gate-runner minigame. Your fighter leads a squad of mini clones up a long
 * lane, every one of them firing marbles on its own. You only steer: drive through the gate
 * that grows the squad (+, x) and away from the one that shrinks it (-), and keep the horde
 * off. Shooting a gate fills its bar, and each full bar raises its number by one.
 *
 * The run is long: a rival fighter with its own squad blocks the road part way (a mini boss),
 * the road forks in the middle (pick a side: each route has its own rival waiting), frozen
 * fighters stand along the way (shoot the ice off and they join you), and a giant fighter
 * waits at the end. Clones fire small, weak marbles; your fighter and its allies fire big ones.
 */

const LANE = 4.2; // half the lane's width
const SPEED = 6; // how fast the squad advances
const BOSS_AT = 1000; // distance to the boss
/** where the rivals (mini bosses) stand, and where the road forks between the two */
const RIVAL_AT = [300, 720];
const FORK_AT = 440;
/** how long the fork's wall runs: you're committed to your side until it ends */
const FORK_LEN = 44;
/** where frozen fighters stand along the road */
const FROZEN_AT = [170, 560, 660, 860];
/** a clone's marble is weak; your fighter's and its allies' are big */
const MINI_DMG = 0.85;
const HERO_DMG = 4;
const HERO_EVERY = 0.2;
/** a gate's bar: the first +1 takes this much, each after it a little more */
const GATE_FILL = 5;
const GATE_FILL_UP = 2;
/** thawing a frozen fighter (in damage), and how many allies can walk with you */
const THAW = 26;
const MAX_ALLIES = 3;
/** an ally's health: horde that reaches it and orbs that hit it wear it down */
const ALLY_HP = 14;
/** grinder walls: full-width saws you must drive through, taking a share of the squad and an ally */
const GRINDER_AT = [240, 620, 900];
const GRINDER_TAKE = 0.25;
const GRINDER_MIN = 0.1;
const GRINDER_STEP = 0.03;
const GRINDER_FILL = 12;
const GRINDER_FILL_UP = 3;
const FIRE_EVERY = 1.1; // seconds between one member's shots
const SHOT_SPEED = 22;
const SHOT_RANGE = 20;
const MAX_SHOTS = 420;
const MAX_ENEMIES = 260;
const MAX_SQUAD = 250;
const VISIBLE = 48; // mini clones drawn (the rest of a big squad is counted, not drawn)
/** the boss is huge: armour to break first (shots do half damage through it), then health;
 *  it takes a squad of about 60 to win the race against its volleys */
const BOSS_HP = 1700;
/** kamikazes: from this far on, a pack of them sprinting at you; the blast radius when one goes off */
const KAMI_FROM = 160;
/** an enemy special's cinematic: the power-up (the world holds still), then the release in slow motion */
const CINE = 2.4;
const STRIKE = { time: 0.9, scale: 0.3 };
const KAMI_BLAST = 1.4;
const BOSS_ARMOUR = 400;
const BEST_KEY = 'marble-fighter:squad:best';

/** a gate side's effect; '=' is an open side (no panel, no effect) */
type Op = { kind: '+' | '-' | 'x' | '/' | '='; n: number };
/** a gate's bar fills twice as slowly on a × or ÷ (they move the squad by a share, not a count) */
const barScale = (op: Op) => (op.kind === 'x' || op.kind === '/' ? 2 : 1);
/** a × or ÷ is what it is: shooting it does nothing (a + only goes up to 60) */
const fixedOp = (op: Op) => op.kind === 'x' || op.kind === '/';
const atMax = (op: Op) => fixedOp(op) || (op.kind === '+' && op.n >= 60);
/**
 * a gate: one or more panels across the road, each over its own stretch (`spans`, x from..to);
 * road outside every panel is open. Layouts vary: two halves, one half, three thirds, a narrow
 * panel sliding across, or a mystery panel that shows what it is only up close.
 */
type GateLayout = 'pair' | 'single' | 'triple' | 'slider' | 'mystery';
type Gate = {
  z: number;
  layout: GateLayout;
  ops: Op[];
  spans: [number, number][];
  panels: THREE.Mesh[];
  canvases: HTMLCanvasElement[];
  fill: number[];
  need: number[];
  /** a panel still showing "?" */
  hidden: boolean[];
  /** a sliding panel: how wide it is, its speed and where it is in its swing */
  slide: { w: number; speed: number; t: number } | null;
  group: THREE.Group;
  done: boolean;
};
/** the enemy squad's tiers: foot soldiers, tanks, bulldozers that plough through, and kamikazes
 * that sprint at you with a bomb on their back */
type Tier = 0 | 1 | 2 | 3;
type Enemy = { x: number; z: number; hp: number; max: number; speed: number; tier: Tier; flash: number; fireT: number };
/** per tier: how wide it is to hit, what it costs if it reaches you, what it costs an ally */
const TIER = [
  { r: 0.34, cost: 1, ally: 1, pop: 3 },
  { r: 0.7, cost: 6, ally: 5, pop: 8 },
  { r: 1.05, cost: 15, ally: 14, pop: 16 },
  { r: 0.4, cost: 5, ally: 5, pop: 10 },
] as const;
/** bulldozers turn up from here on */
const DOZER_FROM = 350;
/** a marble: `dmg` is its power, `big` a fighter's (drawn larger; it destroys foot soldiers outright and
 *  ploughs on through up to `pierce` of them) */
type Shot = { x: number; z: number; z0: number; vx: number; dmg: number; big: boolean; pierce?: number };
/** a rival: a fighter at your size with a squad of its own clones guarding it */
type Rival = {
  /** its special move: time to the next one, and the charge-up before it fires */
  spT: number;
  def: CharacterDef;
  mesh: ShooterMesh;
  pose: ReturnType<typeof pose>;
  x: number;
  z: number;
  hp: number;
  max: number;
  t: number;
  fireT: number;
  volley: number;
  next: number;
  windup: number;
  swaps: boolean;
  /** its guard: clones packed in front of it, each soaking a couple of hits before it falls */
  guard: number;
  guardMax: number;
  guardHit: number;
  guardFireT: number;
  down: number;
  /** its shield barrier: shots spend it before they can reach its health */
  shield: number;
  shieldMax: number;
  shieldFlash: number;
};
/** a fighter frozen in ice by the road: shoot the ice off and it joins your side */
type Frozen = { def: CharacterDef; mesh: ShooterMesh; ice: THREE.Mesh; x: number; z: number; got: number };
/** a fighter walking with you (thawed out): it fires big marbles like your own */
type Ally = { def: CharacterDef; mesh: ShooterMesh; pose: ReturnType<typeof pose>; fireT: number; x: number; z: number; hp: number };
/** a grinder wall: spinning saws across the whole road. It takes `take` of the squad and an ally;
 *  shooting it fills its bar, and each full bar takes a little less (never under GRINDER_MIN) */
type Grinder = { z: number; take: number; fill: number; need: number; group: THREE.Group; saws: THREE.Mesh[]; canvas: HTMLCanvasElement; panel: THREE.Mesh; done: boolean };
/** an item crate on the lane: shoot it open, or run straight through it */
type Crate = { x: number; z: number; hp: number; kind: ItemType; group: THREE.Group };
/** the item shots: dragon balls weaving through the horde, a homing steel ball */
type Special = { kind: 'dragon' | 'steel'; x: number; x0: number; z: number; vx: number; vz: number; t: number; hits: number; hit: Set<object> };
type Timed = 'multi' | 'slowmo' | 'wiper' | 'lock';
/** what each item does in Squad Run */
const POWER = { multiFan: 4, slow: 0.3, healShare: 0.25, healMin: 5, dragonDamage: 6, dragonBoss: 60, steelDamage: 8, steelBoss: 40, steelHits: 8, wiperHalf: 1.1 };
const CRATE_HP = 8;
/** a shot at you: `big` from an enemy fighter (a big red orb that takes out 4), else from its squad (a small pellet, 2) */
type Orb = {
  x: number; z: number; vx: number; vz: number; big: boolean;
  /** a tank's or bulldozer's steel ball */
  steel?: boolean;
  /** a fighter's special: its colour, size, what it costs, and how it moves */
  color?: number; size?: number; hit?: number;
  wob?: { x0: number; amp: number; t: number };
  bounce?: boolean;
};
type Pop = { x: number; y: number; z: number; t: number; color: THREE.Color };

/**
 * the clones' and the horde's painted textures (64 px, greys: the colour comes from the
 * material): a body with panel seams, a chest light and rivets; a helmet with a crest and a
 * brow band; the horde's armour with vents and a hazard stripe
 */
/** a circular saw blade: a toothed rim, a ring of cut-outs, a brushed face (white keeps it metal) */
let sawTex: THREE.CanvasTexture | null = null;
function sawTexture() {
  if (sawTex) return sawTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.translate(64, 64);
  // the teeth
  g.fillStyle = '#d8dce2';
  g.beginPath();
  const teeth = 18;
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.6) / teeth) * Math.PI * 2;
    const a2 = ((i + 1) / teeth) * Math.PI * 2;
    g.lineTo(Math.cos(a0) * 50, Math.sin(a0) * 50);
    g.lineTo(Math.cos(a1) * 63, Math.sin(a1) * 63);
    g.lineTo(Math.cos(a2) * 50, Math.sin(a2) * 50);
  }
  g.closePath();
  g.fill();
  // a darker band and bright edge
  g.strokeStyle = '#8a909a';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, 0, 44, 0, Math.PI * 2);
  g.stroke();
  // cut-outs (transparent)
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.beginPath();
    g.arc(Math.cos(a) * 28, Math.sin(a) * 28, 7, 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  // scratches so the spin reads
  g.strokeStyle = 'rgba(90,96,106,0.8)';
  g.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    g.beginPath();
    g.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
    g.lineTo(Math.cos(a + 0.5) * 42, Math.sin(a + 0.5) * 42);
    g.stroke();
  }
  sawTex = new THREE.CanvasTexture(c);
  sawTex.colorSpace = THREE.SRGBColorSpace;
  return sawTex;
}

function squadTexture(kind: 'body' | 'head' | 'foe' | 'rival' | 'rivalHead' | 'tank' | 'blade') {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#9a9a9a';
  g.lineWidth = 3;
  g.strokeRect(4, 4, 56, 56);
  if (kind === 'body') {
    g.fillStyle = '#7a7a7a';
    g.fillRect(24, 18, 16, 14);
    g.fillStyle = '#ffffff';
    g.fillRect(28, 22, 8, 6);
    g.fillStyle = '#8a8a8a';
    for (const [x, y] of [[10, 10], [54, 10], [10, 54], [54, 54]]) g.fillRect(x - 2, y - 2, 4, 4);
    g.fillRect(14, 42, 36, 3);
  } else if (kind === 'head') {
    g.fillStyle = '#b0b0b0';
    g.fillRect(0, 0, 64, 14);
    g.fillStyle = '#6a6a6a';
    g.fillRect(29, 0, 6, 30);
    g.fillRect(10, 50, 44, 4);
  } else if (kind === 'tank') {
    // armour plate: a seam down the middle, rivets along it, tread marks at the edges
    g.fillStyle = '#7a7a7a';
    g.fillRect(30, 4, 4, 56);
    for (let y = 10; y < 60; y += 10) {
      g.fillRect(24, y, 3, 3);
      g.fillRect(37, y, 3, 3);
    }
    g.fillStyle = '#4a4a4a';
    for (let y = 4; y < 60; y += 6) {
      g.fillRect(4, y, 8, 3);
      g.fillRect(52, y, 8, 3);
    }
  } else if (kind === 'blade') {
    // a bulldozer's blade: hazard stripes edge to edge
    g.fillStyle = '#ffcf2e';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#16141c';
    for (let x = -64; x < 64; x += 16) {
      g.beginPath();
      g.moveTo(x, 64);
      g.lineTo(x + 8, 64);
      g.lineTo(x + 72, 0);
      g.lineTo(x + 64, 0);
      g.closePath();
      g.fill();
    }
  } else if (kind === 'rival') {
    // the enemy squad: a hazard chevron down the chest, a dark core, studded shoulders
    g.fillStyle = '#5a5a5a';
    g.beginPath();
    g.moveTo(14, 14);
    g.lineTo(32, 30);
    g.lineTo(50, 14);
    g.lineTo(50, 24);
    g.lineTo(32, 40);
    g.lineTo(14, 24);
    g.closePath();
    g.fill();
    g.fillStyle = '#2a2a2a';
    g.fillRect(27, 42, 10, 10);
    g.fillStyle = '#8a8a8a';
    for (const x of [10, 18, 46, 54]) g.fillRect(x - 2, 8, 4, 4);
  } else if (kind === 'rivalHead') {
    // its helmet: horns of plating and a slit
    g.fillStyle = '#5a5a5a';
    g.beginPath();
    g.moveTo(6, 0);
    g.lineTo(18, 0);
    g.lineTo(12, 18);
    g.closePath();
    g.moveTo(46, 0);
    g.lineTo(58, 0);
    g.lineTo(52, 18);
    g.closePath();
    g.fill();
    g.fillStyle = '#3a3a3a';
    g.fillRect(14, 30, 36, 6);
  } else {
    g.fillStyle = '#6a6a6a';
    for (let y = 14; y < 34; y += 6) g.fillRect(14, y, 36, 3);
    g.fillStyle = '#c8c8c8';
    for (let x = -8; x < 64; x += 12) {
      g.beginPath();
      g.moveTo(x, 54);
      g.lineTo(x + 6, 54);
      g.lineTo(x + 12, 44);
      g.lineTo(x + 6, 44);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** the road's looks: the start, and one for each branch past the fork */
type RoadTheme = 'start' | 'neon' | 'magma';
const THEMES: Record<RoadTheme, { asphalt: string; line: string; kerb: string; sky: number; verge: number; post: number; glow: number }> = {
  start: { asphalt: '#3a3640', line: '#e8e2d4', kerb: '#ee7b4c', sky: 0x2a2236, verge: 0x5a3a2a, post: 0x8a6a4a, glow: 0 },
  neon: { asphalt: '#1e2a38', line: '#e0f8ff', kerb: '#3ad8e0', sky: 0x0e1a26, verge: 0x16303a, post: 0x2a4a5a, glow: 0x3ad8e0 },
  magma: { asphalt: '#3a2422', line: '#ffd23e', kerb: '#ff6a2a', sky: 0x2a1012, verge: 0x3a140e, post: 0x5a2a20, glow: 0xff4a1a },
};

/** a fake shooter for driving a ShooterMesh's own walk and fire animation */
const pose = () => ({ x: 0, y: 0, team: 0, aim: 0, shieldUp: false, recoil: 0, windT: 9, kickT: 9, hand: 1, lastHand: 1, wobble: 0, vx: 0, flash: 0, stagger: 0, health: 100, heavyT: 9, firing: false });

export class SquadRun {
  private el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  private hud: Record<string, HTMLElement> = {};
  private raf = 0;
  private last = 0;
  private running = false;
  private unitId: string;

  // the run
  private cx = 0;
  private steer = 0;
  private z = 0;
  private squad = 3;
  private kills = 0;
  private fireAcc = 0;
  private waveAt = 0;
  private gateAt = 0;
  private time = 0;
  private over = false;
  private boss: { def: CharacterDef; spT: number; mesh: ShooterMesh; pose: ReturnType<typeof pose>; x: number; z: number; hp: number; armour: number; t: number; fireT: number; volley: number; next: number; windup: number; swaps: boolean } | null = null;
  private crates: Crate[] = [];
  private specials: Special[] = [];
  private timers: Partial<Record<Timed, number>> = {};
  private crateAt = 0;
  private bossCrateT = 0;
  private calloutT = 0;
  /** the rival on the road now, and how many have been met */
  private rival: Rival | null = null;
  private rivalsMet = 0;
  /** the fork: the two rivals waiting down each route, its signs and wall, and the side taken */
  private routeDefs: [CharacterDef, CharacterDef] | null = null;
  private fork: THREE.Group | null = null;
  /** the two roads bending away past the fork's island */
  private forkRoads: THREE.Mesh[] = [];
  private route: 0 | 1 | null = null;
  private frozen: Frozen[] = [];
  private frozenMet = 0;
  private allies: Ally[] = [];
  private grinders: Grinder[] = [];
  private grindersMet = 0;
  private heroT = 0;

  private leader: ShooterMesh | null = null;
  private leaderPose = pose();
  private followers: THREE.Vector3[] = [];
  private enemies: Enemy[] = [];
  private shots: Shot[] = [];
  private orbs: Orb[] = [];
  private gates: Gate[] = [];
  private pops: Pop[] = [];
  /** an enemy fighter's special, playing as a cinematic */
  private cine: { t: number; who: 'rival' | 'boss'; def: CharacterDef; fired: boolean } | null = null;
  private camLook = new THREE.Vector3();
  private sfxEl!: HTMLElement;
  /** kamikaze fireballs, swelling and fading */
  private booms: { x: number; z: number; t: number }[] = [];
  private boomMesh!: THREE.InstancedMesh;
  private kamiBomb!: THREE.InstancedMesh;
  private kamiFuse!: THREE.InstancedMesh;

  // drawing
  private ground!: THREE.Mesh;
  private groundTex!: THREE.CanvasTexture;
  private mini!: { body: THREE.InstancedMesh; head: THREE.InstancedMesh; eye: THREE.InstancedMesh };
  /** a rival's guard: clones like yours in its colours */
  private rivalMini!: { body: THREE.InstancedMesh; head: THREE.InstancedMesh; eye: THREE.InstancedMesh };
  private bigShotMesh!: THREE.InstancedMesh;
  private bigGlowMesh!: THREE.InstancedMesh;
  private pelletMesh!: THREE.InstancedMesh;
  private rivalBubble!: THREE.Mesh;
  private bossBubble!: THREE.Mesh;
  private verge!: THREE.Mesh;
  private foe!: { body: THREE.InstancedMesh; eye: THREE.InstancedMesh };
  /** the tank (hull, turret, gun) and the bulldozer (body, cab, blade) */
  private tank!: { hull: THREE.InstancedMesh; turret: THREE.InstancedMesh; gun: THREE.InstancedMesh };
  private dozer!: { body: THREE.InstancedMesh; cab: THREE.InstancedMesh; blade: THREE.InstancedMesh };
  private shotMesh!: THREE.InstancedMesh;
  private orbMesh!: THREE.InstancedMesh;
  private foeSteelMesh!: THREE.InstancedMesh;
  private superMesh!: THREE.InstancedMesh;
  private superGlow!: THREE.InstancedMesh;
  private popMesh!: THREE.InstancedMesh;
  private posts!: THREE.InstancedMesh;
  private dragonMesh!: THREE.InstancedMesh;
  private steelMesh!: THREE.InstancedMesh;
  private wiper!: THREE.Mesh;
  private dummy = new THREE.Object3D();
  private keys = new Set<string>();
  private drag: { id: number; x0: number; cx0: number } | null = null;

  constructor(
    host: HTMLElement,
    private opts: { unit: string; onExit: () => void; saver?: () => boolean; vibrate?: (pattern: number | number[]) => void },
  ) {
    this.unitId = opts.unit;
    this.el = document.createElement('div');
    this.el.id = 'squad';
    this.el.innerHTML = `
      <canvas></canvas>
      <div class="sq-hud">
        <div class="sq-top">
          <button class="sq-quit key round" aria-label="Back">✕</button>
          <div class="sq-count"><b>8</b><span>SQUAD</span></div>
          <div class="sq-score"><b>0</b><span>SCORE</span></div>
        </div>
        <div class="sq-road"><i></i><b class="mk" style="left:${(RIVAL_AT[0] / BOSS_AT) * 100}%"></b><b class="mk fork" style="left:${(FORK_AT / BOSS_AT) * 100}%"></b><b class="mk" style="left:${(RIVAL_AT[1] / BOSS_AT) * 100}%"></b><em>BOSS</em></div>
        <div class="sq-boss hidden"><span></span><i class="sq-armour"><b></b></i><i class="sq-hp"><b></b></i></div>
        <div class="sq-powers"></div>
        <p class="sq-callout"></p>
        <p class="sq-hint">DRAG TO STEER</p>
      </div>
      <div class="sq-sfx hidden"><i class="sfx-lines"></i><div class="sfx-band"><i class="sfx-face"></i><div><span></span><b></b></div></div></div>
      <div class="sq-panel">
        <h2>Gate Rush</h2>
        <p class="sq-unit"></p>
        <p class="sq-text">Steer your squad through the gates: blue grows it, red shrinks it, and shooting a + or − gate fills its bar to raise its number (÷ stays as it is). Beat the rivals on the road, pick your route at the fork, shoot frozen fighters free to join you, and take down the boss at the end.</p>
        <p class="sq-best"></p>
        <div class="sq-buttons"><button class="sq-go key">Start</button><button class="sq-back key">Back</button></div>
      </div>`;
    host.appendChild(this.el);
    this.canvas = this.el.querySelector('canvas')!;
    this.sfxEl = this.el.querySelector('.sq-sfx')!;
    for (const k of ['count', 'score', 'road', 'boss', 'hint', 'panel', 'powers', 'callout']) this.hud[k] = this.el.querySelector(`.sq-${k}`)!;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.applySaver();
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.scene.environment = studioEnv(this.renderer);
    this.buildWorld();

    this.el.querySelector('.sq-quit')!.addEventListener('click', () => this.exit());
    this.el.querySelector('.sq-back')!.addEventListener('click', () => this.exit());
    this.el.querySelector('.sq-go')!.addEventListener('click', () => this.begin());
    this.canvas.addEventListener('pointerdown', this.down);
    window.addEventListener('pointermove', this.move);
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', this.keyup);
    window.addEventListener('resize', this.resize);
  }

  /** show the start panel with this fighter leading */
  open(unit: string) {
    this.unitId = unit;
    this.applySaver();
    this.el.classList.remove('hidden');
    this.reset();
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
    this.el.classList.add('hidden');
    this.opts.onExit();
  }

  get active() {
    return this.running;
  }

  /** the boss is up (for the music) */
  get bossOn() {
    return !!this.boss && this.boss.hp > 0 && !this.over;
  }

  private tap(p: number | number[]) {
    this.opts.vibrate?.(p);
  }

  // ---------- the world ----------

  private buildWorld() {
    const s = this.scene;
    s.background = new THREE.Color(0x2a2236);
    s.fog = new THREE.Fog(0x2a2236, 26, 60);
    s.add(new THREE.HemisphereLight(0xfff2e0, 0x3a2a40, 1.3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-4, 10, 6);
    s.add(sun);

    // the road: asphalt with a dashed centre line and kerbs, scrolling as the squad runs (each
    // route past the fork repaints it in its own theme)
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    this.groundTex = new THREE.CanvasTexture(c);
    this.paintRoad('start');
    this.groundTex.wrapS = this.groundTex.wrapT = THREE.RepeatWrapping;
    this.groundTex.repeat.set(1, 12);
    this.groundTex.colorSpace = THREE.SRGBColorSpace;
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(LANE * 2 + 0.4, 90), new THREE.MeshStandardMaterial({ map: this.groundTex, roughness: 0.9 }));
    this.ground.rotation.x = -Math.PI / 2;
    s.add(this.ground);
    // the verges either side (a wide plane just under the road, riding along with it)
    const verge = (this.verge = new THREE.Mesh(new THREE.PlaneGeometry(60, 90), new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 1 })));
    verge.position.z = -0.02;
    this.ground.add(verge);
    // fence posts along both edges (recycled as the squad passes)
    this.posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.9, 0.18), new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.8 }), 40);
    this.applyTheme('start');
    s.add(this.posts);

    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.count = 0;
      m.frustumCulled = false;
      s.add(m);
      return m;
    };
    // (one small painted texture each, in greys, so the material's colour tints it: panel work
    // that reads at a glance and costs next to nothing)
    const bodyTex = squadTexture('body');
    const headTex = squadTexture('head');
    const foeTex = squadTexture('foe');
    const clones = (n: number) => ({
      body: inst(new THREE.BoxGeometry(0.32, 0.32, 0.26), new THREE.MeshStandardMaterial({ roughness: 0.5, map: bodyTex }), n),
      head: inst(new THREE.BoxGeometry(0.26, 0.22, 0.24), new THREE.MeshStandardMaterial({ roughness: 0.5, map: headTex }), n),
      eye: inst(new THREE.BoxGeometry(0.2, 0.05, 0.03), new THREE.MeshBasicMaterial(), n),
    });
    this.mini = clones(VISIBLE);
    // the rival's guard: clones of its own, in its own enemy markings
    this.rivalMini = {
      body: inst(new THREE.BoxGeometry(0.32, 0.32, 0.26), new THREE.MeshStandardMaterial({ roughness: 0.5, map: squadTexture('rival') }), 40),
      head: inst(new THREE.BoxGeometry(0.26, 0.22, 0.24), new THREE.MeshStandardMaterial({ roughness: 0.5, map: squadTexture('rivalHead') }), 40),
      eye: inst(new THREE.BoxGeometry(0.2, 0.05, 0.03), new THREE.MeshBasicMaterial(), 40),
    };
    this.bigShotMesh = inst(new THREE.SphereGeometry(0.19, 10, 8), new THREE.MeshBasicMaterial(), 60);
    this.foe = {
      body: inst(new THREE.BoxGeometry(0.46, 0.5, 0.4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, map: foeTex }), MAX_ENEMIES),
      eye: inst(new THREE.BoxGeometry(0.3, 0.07, 0.04), new THREE.MeshBasicMaterial({ color: 0xffd23e }), MAX_ENEMIES),
    };
    const gun = new THREE.CylinderGeometry(0.07, 0.07, 0.75, 8);
    gun.rotateX(Math.PI / 2);
    this.tank = {
      hull: inst(new THREE.BoxGeometry(1.05, 0.42, 1.25), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, map: squadTexture('tank') }), 40),
      turret: inst(new THREE.BoxGeometry(0.62, 0.3, 0.62), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, map: squadTexture('foe') }), 40),
      gun: inst(gun, new THREE.MeshStandardMaterial({ color: 0x2a2a34, roughness: 0.5 }), 40),
    };
    this.dozer = {
      body: inst(new THREE.BoxGeometry(1.5, 0.72, 1.3), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, map: squadTexture('tank') }), 20),
      cab: inst(new THREE.BoxGeometry(0.8, 0.55, 0.65), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, map: squadTexture('foe') }), 20),
      blade: inst(new THREE.BoxGeometry(2.1, 0.7, 0.16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, map: squadTexture('blade') }), 20),
    };
    this.shotMesh = inst(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial(), MAX_SHOTS);
    this.orbMesh = inst(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3a4a }), 40);
    // kamikazes: a black bomb on the back with a blinking fuse; their blast, a swelling fireball
    this.kamiBomb = inst(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.35, metalness: 0.4 }), 60);
    this.kamiFuse = inst(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), 60);
    this.boomMesh = inst(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }), 24);
    // tanks' and bulldozers' steel balls: polished metal
    this.foeSteelMesh = inst(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 0.95, roughness: 0.18 }), 60);
    // an enemy fighter's special: orbs in its own colour, with a glow round them
    this.superMesh = inst(new THREE.SphereGeometry(0.32, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }), 40);
    this.superGlow = inst(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }), 40);
    // the enemy squad's shots: small orange pellets, plainly not a fighter's orb
    this.pelletMesh = inst(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffa03a }), 80);
    // your fighters' balls glow, so they stand out from the clones' marbles
    this.bigGlowMesh = inst(new THREE.SphereGeometry(0.34, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }), 60);
    // an enemy fighter's shield: a bubble round it (a rival's, and the boss's armour)
    const bubbleMat = (c: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.rivalBubble = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), bubbleMat(0x5af0ff));
    this.rivalBubble.visible = false;
    s.add(this.rivalBubble);
    this.bossBubble = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), bubbleMat(0xffb04a));
    this.bossBubble.visible = false;
    s.add(this.bossBubble);
    this.dragonMesh = inst(new THREE.SphereGeometry(0.36, 12, 8), new THREE.MeshBasicMaterial({ color: ITEMS.dragon.color }), 12);
    this.steelMesh = inst(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.9, roughness: 0.25 }), 4);
    this.wiper = new THREE.Mesh(new THREE.BoxGeometry(POWER.wiperHalf * 2, 0.5, 0.3), new THREE.MeshStandardMaterial({ color: ITEMS.wiper.color, roughness: 0.7 }));
    this.wiper.visible = false;
    s.add(this.wiper);
    this.popMesh = inst(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0xffffff }), 120);
  }

  private resize = () => {
    const r = this.el.getBoundingClientRect();
    if (!r.width) return;
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
  };

  // ---------- a fresh run ----------

  private reset() {
    for (const gt of this.gates) this.scene.remove(gt.group);
    for (const gr of this.grinders) this.scene.remove(gr.group);
    this.grinders = [];
    this.grindersMet = 0;
    for (const c of this.crates) this.scene.remove(c.group);
    this.crates = [];
    this.specials = [];
    this.booms = [];
    this.cine = null;
    this.el.classList.remove('sq-cine');
    this.sfxEl.classList.add('hidden');
    this.timers = {};
    this.crateAt = 55;
    this.bossCrateT = 6;
    this.calloutT = 0;
    if (this.boss) this.scene.remove(this.boss.mesh.root);
    if (this.rival) {
      this.scene.remove(this.rival.mesh.root);
      this.rival.mesh.dispose();
    }
    this.rival = null;
    this.rivalsMet = 0;
    if (this.fork) this.scene.remove(this.fork);
    this.fork = null;
    this.routeDefs = null;
    this.route = null;
    for (const f of this.frozen) {
      this.scene.remove(f.mesh.root, f.ice);
      f.mesh.dispose();
    }
    this.frozen = [];
    this.frozenMet = 0;
    for (const a of this.allies) {
      this.scene.remove(a.mesh.root);
      a.mesh.dispose();
    }
    this.allies = [];
    this.heroT = 0;
    this.paintRoad('start');
    this.applyTheme('start');
    if (this.leader) {
      this.scene.remove(this.leader.root);
      this.leader.dispose();
    }
    this.gates = [];
    this.enemies = [];
    this.shots = [];
    this.orbs = [];
    this.pops = [];
    this.boss = null;
    this.cx = 0;
    this.z = 0;
    this.squad = 8;
    this.kills = 0;
    this.fireAcc = 0;
    this.waveAt = 14;
    this.gateAt = 20;
    this.time = 0;
    this.over = true;
    this.followers = [];

    const def = characterById(this.unitId);
    this.leader = new ShooterMesh(def.id, def.ball, def);
    this.leader.size = 0.62;
    this.scene.add(this.leader.root);
    (this.mini.body.material as THREE.MeshStandardMaterial).color.setHex(def.palette.body);
    (this.mini.head.material as THREE.MeshStandardMaterial).color.setHex(def.palette.trim);
    (this.mini.eye.material as THREE.MeshBasicMaterial).color.setHex(def.palette.eye);
    (this.shotMesh.material as THREE.MeshBasicMaterial).color.setHex(def.ball);
    (this.bigShotMesh.material as THREE.MeshBasicMaterial).color.setHex(def.ball);
    this.el.querySelector('.sq-unit')!.textContent = def.name;
    this.hud.boss.classList.add('hidden');
    this.updateHud();
    this.draw(0);
  }

  private begin() {
    sfx.unlock();
    this.reset();
    this.over = false;
    this.showPanel(null);
    this.hud.hint.classList.remove('gone');
    setTimeout(() => this.hud.hint.classList.add('gone'), 2600);
    sfx.play('go');
  }

  private showPanel(kind: 'start' | 'win' | 'lose' | null) {
    const p = this.hud.panel;
    p.classList.toggle('hidden', !kind);
    if (!kind) return;
    const best = this.best();
    const score = this.score();
    const h = p.querySelector('h2')!;
    const text = p.querySelector('.sq-text') as HTMLElement;
    const go = p.querySelector('.sq-go')!;
    if (kind === 'start') {
      h.textContent = 'Gate Rush';
      text.classList.remove('hidden');
      go.textContent = 'Start';
    } else {
      h.textContent = kind === 'win' ? 'Boss down!' : 'Squad lost';
      text.classList.add('hidden');
      go.textContent = 'Run again';
    }
    p.querySelector('.sq-best')!.textContent = kind === 'start' ? (best ? `BEST ${best}` : '') : `SCORE ${score}${score >= best ? ' · NEW BEST' : ` · BEST ${best}`}`;
  }

  private best() {
    try {
      return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      return 0;
    }
  }

  private score() {
    return Math.round(this.kills * 10 + this.dist() * 2 + (this.boss && this.boss.hp <= 0 ? 1000 + this.squad * 50 : 0));
  }

  private dist() {
    return -this.z;
  }

  private finish(win: boolean) {
    this.over = true;
    const s = this.score();
    try {
      if (s > this.best()) localStorage.setItem(BEST_KEY, String(s));
    } catch {
      // (best score just isn't kept)
    }
    sfx.play(win ? 'win' : 'lose');
    this.tap(win ? [20, 40, 20, 40, 60] : [120, 60, 120]);
    setTimeout(() => this.showPanel(win ? 'win' : 'lose'), 700);
  }

  // ---------- input: drag anywhere to steer, or A / D and the arrow keys ----------

  private down = (e: PointerEvent) => {
    this.drag = { id: e.pointerId, x0: e.clientX, cx0: this.cx };
  };
  private move = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const w = this.el.getBoundingClientRect().width || 1;
    this.cx = THREE.MathUtils.clamp(this.drag.cx0 + ((e.clientX - this.drag.x0) / w) * LANE * 2.6, -LANE + 0.4, LANE - 0.4);
  };
  private up = (e: PointerEvent) => {
    if (this.drag && e.pointerId === this.drag.id) this.drag = null;
  };
  private keydown = (e: KeyboardEvent) => {
    if (!this.running) return;
    if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space', 'Enter'].includes(e.code)) e.preventDefault();
    this.keys.add(e.code);
    if (this.over && !this.hud.panel.classList.contains('hidden') && (e.code === 'Enter' || e.code === 'Space')) this.begin();
  };
  private keyup = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  // ---------- the loop ----------

  /** battery saver: 1.5x density */
  private saverOn = false;
  private applySaver() {
    this.saverOn = !!this.opts.saver?.();
    const dpr = Math.min(window.devicePixelRatio || 1, this.saverOn ? 1.5 : 2);
    if (this.renderer.getPixelRatio() !== dpr) this.renderer.setPixelRatio(dpr);
  }

  private frame = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.over) this.step(dt);
    this.draw(dt);
  };

  private step(dt: number) {
    this.time += dt;
    // an enemy special's cinematic: the world holds still for its power-up, then runs slow
    if (this.cine) {
      const k = this.runCine(dt);
      if (!k) return;
      dt *= k;
    }
    for (const t of Object.keys(this.timers) as Timed[]) this.timers[t] = Math.max(0, (this.timers[t] ?? 0) - dt);
    const k = this.keys;
    this.steer = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    if (this.steer) this.cx = THREE.MathUtils.clamp(this.cx + this.steer * 7 * dt, -LANE + 0.4, LANE - 0.4);

    // advance, unless the boss or a rival is close: then hold the line and fight
    const rivalUp = !!this.rival && this.rival.hp > 0;
    const holding = (this.boss && this.boss.z - this.z > -13) || (rivalUp && this.rival!.z - this.z > -12);
    if (!holding) this.z -= SPEED * dt;
    const d = this.dist();

    // the fork: whichever side you're on when you reach it is your route, and the wall keeps you
    // there until it ends
    if (this.fork && this.route === null && d >= FORK_AT) this.takeRoute(this.cx < 0 ? 0 : 1);
    if (this.route !== null && d < FORK_AT + FORK_LEN) this.cx = this.route === 0 ? Math.min(this.cx, -0.55) : Math.max(this.cx, 0.55);

    // the road ahead: rivals, the fork, frozen fighters; gates and the horde between them
    if (d < BOSS_AT - 30) {
      const nextRival = RIVAL_AT[this.rivalsMet];
      if (nextRival !== undefined && !this.rival && d + 30 > nextRival) this.spawnRival();
      if (!this.fork && d + 34 > FORK_AT) this.spawnFork();
      const nextFrozen = FROZEN_AT[this.frozenMet];
      if (nextFrozen !== undefined && d + 32 > nextFrozen) this.spawnFrozen();
      const nextGrinder = GRINDER_AT[this.grindersMet];
      if (nextGrinder !== undefined && d + 34 > nextGrinder) this.spawnGrinder();
    }
    // (while a rival stands in the road, nothing else comes: it's you and its squad)
    if (rivalUp) {
      this.gateAt = Math.max(this.gateAt, d + 40);
      this.waveAt = Math.max(this.waveAt, d + 40);
      this.crateAt = Math.max(this.crateAt, d + 50);
    }
    if (d < BOSS_AT - 30 && !rivalUp) {
      if (d + 34 > this.gateAt) {
        // (never right on a grinder: one would hide the other)
        // (nor in the last stretch before the boss: you stop short of it to fight, and a gate you
        // never reach would soak every shot)
        if (!GRINDER_AT.some((gd) => Math.abs(gd - (d + 34)) < 8) && d + 34 < BOSS_AT - 40) this.spawnGate(this.z - 34);
        // (closer while the squad builds up, sparser later on; never quite even, and now and then a
        // second gate right behind the first)
        this.gateAt += d > 250 && Math.random() < 0.14 ? 16 : (d < 200 ? 44 : 70) + (Math.random() * 20 - 10);
      }
      if (d + 34 > this.waveAt) {
        this.spawnWave(this.z - 34, d);
        this.waveAt += Math.max(9, 12 - d / 120);
      }
      if (d + 34 > this.crateAt) {
        this.spawnCrate((Math.random() * 2 - 1) * (LANE - 0.8), this.z - 31);
        this.crateAt += 60 + Math.random() * 20;
      }
    } else if (d >= BOSS_AT - 30 && !this.boss) this.spawnBoss();
    else if (this.boss && this.boss.hp > 0 && (this.bossCrateT -= dt) <= 0) {
      // during the boss fight, crates keep coming down between you and it
      this.bossCrateT = 8;
      this.spawnCrate((Math.random() * 2 - 1) * (LANE - 0.8), this.z - 6);
    }

    this.fire(dt);
    this.moveShots(dt);
    this.moveEnemies(dt * this.slow(), d);
    this.moveSpecials(dt);
    this.touchCrates();
    this.sweep();
    this.passGates(dt);
    if (this.boss) this.fightBoss(dt);
    if (this.rival) this.fightRival(dt);
    this.moveOrbs(dt);
    this.passFrozen();
    this.passGrinders(dt);
    for (const p of this.pops) p.t += dt;
    for (const b of this.booms) b.t += dt;
    this.booms = this.booms.filter((b) => b.t < 0.35);
    this.pops = this.pops.filter((p) => p.t < 0.45);
    if (this.squad <= 0 && !this.over) this.finish(false);
    this.calloutT = Math.max(0, this.calloutT - dt);
    this.hud.callout.classList.toggle('on', this.calloutT > 0);
    this.updateHud();
  }

  /** where each squad member stands: the leader up front, the clones packed in a blob behind */
  private memberSpots() {
    const out: THREE.Vector3[] = [new THREE.Vector3(this.cx, 0, this.z)];
    const n = Math.min(this.squad - 1, VISIBLE);
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996;
      const r = 0.36 * Math.sqrt(i + 1);
      out.push(new THREE.Vector3(THREE.MathUtils.clamp(this.cx + Math.cos(a) * r, -LANE + 0.25, LANE - 0.25), 0, this.z + 0.35 + Math.abs(Math.sin(a)) * r * 0.9));
    }
    return out;
  }

  /** the blob's reach, for the horde and the boss's shots */
  private reach() {
    return 0.45 + 0.36 * Math.sqrt(Math.min(this.squad, VISIBLE));
  }

  private fire(dt: number) {
    if (this.squad <= 0) return;
    this.fireAcc += (this.squad / FIRE_EVERY) * dt;
    const spots = this.followers.length ? this.followers : [new THREE.Vector3(this.cx, 0, this.z)];
    let n = Math.min(Math.floor(this.fireAcc), 24);
    this.fireAcc -= Math.floor(this.fireAcc);
    const fans = this.timers.multi ? [-POWER.multiFan, 0, POWER.multiFan] : [0];
    // the clones: small, weak marbles
    while (n-- > 0 && this.shots.length < MAX_SHOTS) {
      const s = spots[Math.floor(Math.random() * spots.length)];
      for (const vx of fans) this.shots.push({ x: s.x + (Math.random() - 0.5) * 0.1, z: s.z - 0.3, z0: s.z, vx, dmg: MINI_DMG, big: false });
    }
    // your fighter and its allies: big, hard-hitting marbles
    this.heroT -= dt;
    if (this.heroT <= 0) {
      this.heroT = HERO_EVERY;
      const heroes = [{ x: spots[0]?.x ?? this.cx, z: spots[0]?.z ?? this.z }, ...this.allies.map((a) => ({ x: a.x, z: a.z }))];
      for (const h of heroes) for (const vx of fans) if (this.shots.length < MAX_SHOTS) this.shots.push({ x: h.x, z: h.z - 0.4, z0: h.z, vx, dmg: HERO_DMG, big: true });
    }
    if (Math.random() < dt * 8) sfx.play('fire', 0.25);
    this.leaderPose.kickT = (this.leaderPose.kickT + dt) % 0.5;
  }

  private moveShots(dt: number) {
    const keep: Shot[] = [];
    for (const s of this.shots) {
      s.z -= SHOT_SPEED * dt;
      if (this.timers.lock) {
        // smart lock: every shot bends toward the nearest target ahead of it
        const tx = this.nearestAhead(s.x, s.z);
        if (tx !== null) s.vx += THREE.MathUtils.clamp((tx - s.x) * 14 - s.vx, -40, 40) * dt * 4;
      }
      s.x += s.vx * dt;
      if (s.z0 - s.z > SHOT_RANGE || Math.abs(s.x) > LANE + 0.5) continue;
      let hit = false;
      for (const c of this.crates) {
        if (Math.abs(c.z - s.z) < 0.5 && Math.abs(c.x - s.x) < 0.55) {
          if ((c.hp -= s.dmg) <= 0) this.grant(c);
          hit = true;
          break;
        }
      }
      if (hit) continue;
      // a gate soaks up shots into its bar; a full bar raises its number, and the next takes more
      for (const gt of this.gates) {
        if (gt.done || Math.abs(s.z - gt.z) > 0.35) continue;
        const side = this.spanAt(gt, s.x);
        // (open road has nothing to hit; a "?" soaks shots but won't tell what it is)
        if (side < 0) continue;
        if (gt.hidden[side]) {
          hit = true;
          break;
        }
        // (a × or ÷, or a maxed +: it soaks the shot, nothing to raise)
        if (atMax(gt.ops[side])) {
          hit = true;
          break;
        }
        gt.fill[side] += s.dmg;
        if (gt.fill[side] >= gt.need[side]) {
          gt.fill[side] -= gt.need[side];
          this.raise(gt, side);
          // (the next +1 takes a little more; on a × or ÷, twice as much)
          gt.need[side] = (gt.need[side] / barScale(gt.ops[side]) + GATE_FILL_UP) * barScale(gt.ops[side]);
        } else this.paint(gt, side);
        hit = true;
        break;
      }
      if (hit) continue;
      // a grinder soaks shots into its bar
      for (const gr of this.grinders) {
        if (gr.done || Math.abs(s.z - gr.z) > 0.35) continue;
        gr.fill += s.dmg;
        if (gr.fill >= gr.need) {
          gr.fill -= gr.need;
          gr.need += GRINDER_FILL_UP;
          gr.take = Math.max(GRINDER_MIN, gr.take - GRINDER_STEP);
        }
        this.paintGrinder(gr);
        hit = true;
        break;
      }
      if (hit) continue;
      // a frozen fighter: each hit chips the ice
      for (const f of this.frozen) {
        if (Math.abs(f.z - s.z) < 0.55 && Math.abs(f.x - s.x) < 0.6) {
          this.chip(f, s.dmg);
          hit = true;
          break;
        }
      }
      if (hit) continue;
      // a rival: its guard takes the hits first, then the fighter itself
      if (this.rival && this.rival.hp > 0 && this.hitRival(s)) continue;
      if (!hit)
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const r = TIER[e.tier].r;
          if (Math.abs(e.z - s.z) < r && Math.abs(e.x - s.x) < r) {
            // a fighter's ball destroys a foot soldier outright, and keeps going through a few
            if (s.big && (e.tier === 0 || e.tier === 3)) {
              e.hp = 0;
              this.kills += e.max;
              this.pop(e.x, 0.4, e.z, 0xff8a5a, 3);
              if (e.tier === 3) this.blast(e);
              if (Math.random() < 0.5) sfx.play('pop', 0.5);
              s.pierce = (s.pierce ?? 3) - 1;
              if (s.pierce > 0) continue;
              hit = true;
              break;
            }
            e.hp -= s.dmg;
            e.flash = 0.08;
            if (e.hp <= 0) {
              this.kills += e.max;
              this.pop(e.x, 0.4, e.z, 0xff8a5a, TIER[e.tier].pop);
              if (e.tier === 3) this.blast(e);
              else sfx.play(e.tier ? 'explode' : 'pop', 0.5);
            }
            hit = true;
            break;
          }
        }
      if (!hit && this.boss && this.boss.hp > 0 && Math.abs(this.boss.z - s.z) < 1.4 && Math.abs(this.boss.x - s.x) < 2) {
        this.hurtBoss(s.dmg);
        hit = true;
      }
      if (!hit) keep.push(s);
    }
    this.shots = keep;
  }

  private moveEnemies(dt: number, d: number) {
    const reach = this.reach();
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.z += e.speed * dt;
      e.flash = Math.max(0, e.flash - dt);
      // drift toward the squad a little as they close in (a kamikaze locks on and sprints)
      e.x += Math.sign(this.cx - e.x) * Math.min(Math.abs(this.cx - e.x), dt * (e.tier === 3 ? 2.6 : 0.4 + d / 900));
      if (e.tier === 3 && this.z - e.z < 14) e.speed = Math.min(e.speed + dt * 4, 7.5);
      // (the fork's wall holds them on their own side)
      if (this.route !== null && d < FORK_AT + FORK_LEN + 6 && Math.abs(e.z + FORK_AT + FORK_LEN / 2) < FORK_LEN / 2 + 2) e.x = e.x < 0 ? Math.min(e.x, -0.45) : Math.max(e.x, 0.45);
      // tanks and bulldozers fire steel balls at you once they're in range
      if (e.tier && e.tier < 3 && this.z - e.z < 20 && this.z - e.z > 3 && (e.fireT -= dt) <= 0) {
        e.fireT = e.tier === 1 ? 4.2 : 4.6;
        const z0 = e.z + (e.tier === 1 ? 0.9 : 1);
        if (e.tier === 1) this.orbAt(e.x, z0, 7.5, 0, false, { steel: true });
        else for (const off of [-1.3, 0, 1.3]) this.orbAt(e.x + off * 0.4, z0, 6, off, false, { steel: true });
        this.pop(e.x, 0.6, z0, 0xfff0c0, 3);
        sfx.play('steel', 0.7);
      }
      // an ally in its way takes the hit instead
      const ally = this.allies.find((a) => Math.hypot(a.x - e.x, a.z - e.z) < TIER[e.tier].r + 0.3);
      if (ally) {
        e.hp = 0;
        this.hurtAlly(ally, TIER[e.tier].ally);
        this.pop(e.x, 0.4, e.z, 0xff3a4a, 3);
        if (e.tier === 3) this.blast(e);
        continue;
      }
      const dx = e.x - this.cx;
      const dz = e.z - (this.z + reach * 0.4);
      if (Math.hypot(dx, dz) < reach + (TIER[e.tier].r - 0.34) && this.squad > 0) {
        // it reaches the squad: it's gone, and so are some of yours (a tank costs more, a bulldozer a lot)
        e.hp = 0;
        this.squad = Math.max(0, this.squad - TIER[e.tier].cost);
        this.tap(e.tier === 2 ? [80, 40, 80] : e.tier ? 40 : 12);
        if (e.tier === 2) this.say(`BULLDOZER · −${TIER[2].cost}`, 0xff6a2a);
        if (e.tier === 3) {
          this.blast(e);
          this.say(`KAMIKAZE · −${TIER[3].cost}`, 0xff4a2a);
        }
        this.pop(e.x, 0.4, e.z, 0xff3a4a, 4);
        sfx.play('hurt', 0.6);
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0 && e.z < this.z + 6);
  }

  private spawnWave(z: number, d: number) {
    // the horde grows with the distance and with your squad, so a big squad still has a fight
    const half = this.forkHalf();
    const n = Math.floor(Math.min(3 + Math.floor(d / 60) + Math.floor(this.squad * 0.05), 18) * (half ? 0.5 : 1));
    const spot = () => (half ? half[0] + Math.random() * (half[1] - half[0]) : (Math.random() * 2 - 1) * (LANE - 0.4));
    // (it toughens along the road, but levels off: a squad can only grow so big)
    const hp = 1 + Math.floor(Math.min(d, 700) / 320);
    const tank = d > 120 && Math.random() < 0.28;
    const dozer = d > DOZER_FROM && Math.random() < 0.18;
    for (let i = 0; i < n && this.enemies.length < MAX_ENEMIES; i++) {
      this.enemies.push({ x: spot(), z: z - Math.random() * 5, hp, max: hp, speed: 1.4 + Math.random() * 0.8, tier: 0, flash: 0, fireT: 0 });
    }
    if (tank && this.enemies.length < MAX_ENEMIES) {
      const thp = 10 + Math.floor(Math.min(d, 800) / 60);
      this.enemies.push({ x: half ? spot() : (Math.random() * 2 - 1) * (LANE - 1), z: z - 2, hp: thp, max: thp, speed: 1.1, tier: 1, flash: 0, fireT: 0.8 + Math.random() * 1.2 });
    }
    // a kamikaze pack: fast, fragile, and they blow up on whatever they reach (shoot them early,
    // and the blast takes their neighbours with them)
    if (d > KAMI_FROM && Math.random() < 0.3) {
      const k = 3 + Math.floor(Math.random() * Math.min(5, 1 + d / 200));
      const kx = half ? spot() : (Math.random() * 2 - 1) * (LANE - 1);
      for (let i = 0; i < k && this.enemies.length < MAX_ENEMIES; i++) this.enemies.push({ x: THREE.MathUtils.clamp(kx + (Math.random() - 0.5) * 1.6, -LANE + 0.3, LANE - 0.3), z: z - 6 - Math.random() * 3, hp: 1, max: 1, speed: 3 + Math.random(), tier: 3, flash: 0, fireT: 0 });
    }
    // a bulldozer: slow, very tough, and it costs a lot if it gets through
    if (dozer && this.enemies.length < MAX_ENEMIES) {
      const bhp = 50 + Math.floor(Math.min(d, 900) / 15);
      this.enemies.push({ x: half ? spot() : (Math.random() * 2 - 1) * (LANE - 1.4), z: z - 4, hp: bhp, max: bhp, speed: 0.8, tier: 2, flash: 0, fireT: 1.2 + Math.random() });
    }
  }

  // ---------- gates ----------

  private spawnGate(z: number) {
    const d = this.dist();
    // (fewer gates, and fewer plain + ones: a × often, otherwise a + big enough to matter)
    const good = (): Op => {
      // (no × gates: the good side is always a +)
      return { kind: '+', n: 6 + Math.floor(Math.random() * (8 + d / 30)) };
    };
    // the other side takes away: mostly a −, further on often a ÷, only now and then a small +
    const bad = (): Op => {
      const r = Math.random();
      if (d > 120 && r < 0.32) return { kind: '/', n: 2 + (d > 600 && Math.random() < 0.4 ? 1 : 0) };
      return { kind: '-', n: 4 + Math.floor(Math.random() * (5 + d / 50)) };
    };
    const shuffle = <T,>(a: T[]) => a.sort(() => Math.random() - 0.5);
    // the layout: so the road keeps changing
    const r = Math.random();
    const layout: GateLayout =
      d > 200 && r < 0.1 ? 'mystery' : d > 150 && r < 0.22 ? 'slider' : d > 100 && r < 0.36 ? 'triple' : d > 40 && r < 0.6 ? 'single' : 'pair';
    const L = LANE;
    let spans: [number, number][];
    let ops: Op[];
    const hidden: boolean[] = [];
    let slide: Gate['slide'] = null;
    if (layout === 'single') {
      // one half only: the other half is open road
      const side = Math.random() < 0.5 ? 0 : 1;
      spans = [side === 0 ? [-L, 0] : [0, L]];
      ops = [Math.random() < 0.5 ? good() : bad()];
    } else if (layout === 'triple') {
      // three narrow panels: one good, one bad, one either way (a × now and then)
      spans = [[-L, -L / 3], [-L / 3, L / 3], [L / 3, L]];
      ops = shuffle([good(), bad(), Math.random() < 0.5 ? good() : bad()]);
    } else if (layout === 'slider') {
      // a narrow panel sliding across the road: usually a bonus to catch, sometimes one to dodge
      const w = 2.4;
      slide = { w, speed: 1.1 + Math.random() * 0.8, t: Math.random() * Math.PI * 2 };
      spans = [[-w / 2, w / 2]];
      ops = [Math.random() < 0.7 ? good() : bad()];
    } else {
      spans = [[-L, 0], [0, L]];
      ops = Math.random() < 0.5 ? [good(), bad()] : [bad(), good()];
      // now and then both are bad: shoot one up before you reach it
      if (d > 100 && Math.random() < 0.25) ops[Math.random() < 0.5 ? 0 : 1] = { kind: '-', n: 4 + Math.floor(d / 60) };
      // a mystery: one panel says "?" until you're nearly through it
      if (layout === 'mystery') hidden[Math.random() < 0.5 ? 0 : 1] = true;
    }
    const group = new THREE.Group();
    group.position.z = z;
    const canvases: HTMLCanvasElement[] = [];
    const panels = spans.map(([a, b]) => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 128;
      canvases.push(c);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b - a - 0.15, 1.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      m.position.set((a + b) / 2, 0.95, 0);
      group.add(m);
      return m;
    });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2a2a34, roughness: 0.5 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffc23d });
    const post = (x: number, parent: THREE.Object3D) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.9, 0.22), postMat);
      p.position.set(x, slide ? 0 : 0.95, 0);
      parent.add(p);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.2), lampMat);
      lamp.position.set(x, slide ? 1 : 1.95, 0);
      parent.add(lamp);
    };
    if (slide) {
      // (its posts ride along with it)
      post(-slide.w / 2, panels[0]);
      post(slide.w / 2, panels[0]);
    } else {
      const xs = new Set<number>();
      for (const [a, b] of spans) {
        xs.add(Math.round(a * 100) / 100);
        xs.add(Math.round(b * 100) / 100);
      }
      for (const x of xs) post(x, group);
    }
    this.scene.add(group);
    const gt: Gate = { z, layout, ops, spans, panels, canvases, fill: ops.map(() => 0), need: ops.map((o) => GATE_FILL * barScale(o)), hidden, slide, group, done: false };
    ops.forEach((_, k) => this.paint(gt, k));
    this.gates.push(gt);
  }

  /** which panel of a gate an x is under (-1: open road) */
  private spanAt(gt: Gate, x: number) {
    return gt.spans.findIndex(([a, b]) => x >= a && x < b);
  }

  private label(op: Op) {
    if (op.kind === '/') return `÷${op.n}`;
    return op.kind === 'x' ? `×${op.n}` : `${op.kind}${op.n}`;
  }

  private paint(gt: Gate, side: number) {
    const op = gt.ops[side];
    if (op.kind === '=') return;
    const c = gt.canvases[side];
    const g = c.getContext('2d')!;
    const secret = !!gt.hidden[side];
    const good = op.kind !== '-' && op.kind !== '/';
    g.clearRect(0, 0, 256, 128);
    g.fillStyle = secret ? 'rgba(140,70,220,0.85)' : good ? 'rgba(42,120,255,0.78)' : 'rgba(238,58,74,0.78)';
    g.fillRect(4, 4, 248, 120);
    g.strokeStyle = secret ? '#e0c0ff' : good ? '#9ad8ff' : '#ffb0b8';
    g.lineWidth = 6;
    g.strokeRect(6, 6, 244, 116);
    g.fillStyle = '#fff';
    g.font = 'bold 76px "Space Grotesk", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(secret ? '?' : this.label(op), 128, 60);
    const maxed = !secret && atMax(op);
    // the bar: fills as it's shot, and the number goes up by one when it's full (a × or ÷ has none)
    if (!secret && fixedOp(op)) {
      ((gt.panels[side].material as THREE.MeshBasicMaterial).map as THREE.CanvasTexture).needsUpdate = true;
      return;
    }
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(24, 100, 208, 14);
    g.fillStyle = '#ffd23e';
    g.fillRect(24, 100, 208 * (maxed ? 1 : Math.min(1, gt.fill[side] / gt.need[side])), 14);
    g.strokeStyle = '#fff';
    g.lineWidth = 2;
    g.strokeRect(24, 100, 208, 14);
    if (maxed) {
      g.fillStyle = '#1a1a24';
      g.font = 'bold 12px "Space Grotesk", system-ui, sans-serif';
      g.fillText('MAX', 128, 108);
    }
    ((gt.panels[side].material as THREE.MeshBasicMaterial).map as THREE.CanvasTexture).needsUpdate = true;
  }

  /** a shot gate gets better: a + grows, a - shrinks and turns into a + (a × or ÷ never gets here) */
  private raise(gt: Gate, side: number) {
    const op = gt.ops[side];
    if (op.kind === '-') {
      op.n -= 1;
      if (op.n <= 0) gt.ops[side] = { kind: '+', n: 1 };
    } else if (op.kind === '/') {
      // a divide eases off, and at ÷1 it turns into a +1
      op.n -= 1;
      if (op.n <= 1) gt.ops[side] = { kind: '+', n: 1 };
    } else if (op.kind === '+') op.n = Math.min(op.n + 1, 60);
    else op.n = Math.min(op.n + 1, 9);
    this.paint(gt, side);
  }

  private passGates(dt: number) {
    for (const gt of this.gates) {
      if (gt.done) continue;
      // a sliding panel swings across the road; a mystery shows itself up close
      if (gt.slide) {
        gt.slide.t += dt * gt.slide.speed;
        const cx = Math.sin(gt.slide.t) * (LANE - gt.slide.w / 2);
        gt.spans[0] = [cx - gt.slide.w / 2, cx + gt.slide.w / 2];
        gt.panels[0].position.x = cx;
      }
      gt.hidden.forEach((h, k) => {
        if (h && gt.z - this.z > -9) {
          gt.hidden[k] = false;
          this.paint(gt, k);
          sfx.play('tick', 0.6);
        }
      });
      if (this.z > gt.z) continue;
      gt.done = true;
      const side = this.spanAt(gt, this.cx);
      const before = this.squad;
      const apply = (o: Op) => {
        if (o.kind === '=') return;
        if (o.kind === '+') this.squad += o.n;
        else if (o.kind === '-') this.squad -= o.n;
        else if (o.kind === '/') this.squad = Math.floor(this.squad / o.n);
        else this.squad *= o.n;
      };
      if (side >= 0) apply(gt.ops[side]);
      // a squad spread over other panels touches them too: any red one it touches bites
      const spread = this.reach() * 0.45;
      let clipped: Op | null = null;
      gt.spans.forEach(([a, b], k) => {
        if (k === side) return;
        const o = gt.ops[k];
        if ((o.kind === '-' || o.kind === '/') && this.cx + spread > a && this.cx - spread < b) {
          // (only the edge of the squad touched it: a − bites in full, a ÷ takes a share)
          if (o.kind === '/') this.squad -= Math.ceil(this.squad * (1 - 1 / o.n) * 0.3);
          else apply(o);
          gt.panels[k].scale.setScalar(1.15);
          clipped = o;
        }
      });
      if (clipped) this.say(`CLIPPED THE RED ${this.label(clipped)}`, 0xff6a5a);
      // (straight through open road, nothing happened)
      if (side < 0 && !clipped) continue;
      this.squad = THREE.MathUtils.clamp(this.squad, 0, MAX_SQUAD);
      const good = this.squad >= before;
      this.tap(good ? [15, 30, 15] : 60);
      this.pop(this.cx, 1, gt.z, good ? 0x5ab8ff : 0xff3a4a, 10);
      sfx.play(good ? 'charge' : 'hurt');
      // the panel you went through flashes and they all fade away
      if (side >= 0) gt.panels[side].scale.setScalar(1.15);
    }
    for (const gt of this.gates) {
      if (!gt.done) continue;
      for (const p of gt.panels) {
        const mat = p.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, mat.opacity - 0.05);
      }
    }
    this.gates = this.gates.filter((gt) => {
      const keep = gt.z < this.z + 8;
      if (!keep) this.scene.remove(gt.group);
      return keep;
    });
  }

  // ---------- the boss ----------

  private spawnBoss() {
    const pool = playable().filter((c) => c.id !== this.unitId && !c.id.startsWith('custom'));
    const def = pool[Math.floor(Math.random() * pool.length)] ?? characterById(this.unitId);
    const mesh = new ShooterMesh(def.id, def.ball, def);
    mesh.size = 3.2;
    this.scene.add(mesh.root);
    const p = pose();
    p.team = 1;
    const sp = def.special;
    this.boss = { def, spT: 5, mesh, pose: p, x: 0, z: this.z - 32, hp: BOSS_HP, armour: BOSS_ARMOUR, t: 0, fireT: 2, volley: 0, next: 0, windup: sp?.windup ?? 0, swaps: !!(sp?.alternate || sp?.swap) };
    this.hud.boss.classList.remove('hidden');
    this.hud.boss.querySelector('span')!.textContent = def.name;
    sfx.play('gong');
  }

  private fightBoss(dt: number) {
    const b = this.boss!;
    if (b.hp <= 0) return;
    b.t += dt;
    b.x = Math.sin(b.t * 0.7) * (LANE - 1.4);
    b.pose.flash = Math.max(0, b.pose.flash - dt);
    const sl = this.slow();
    if (b.z - this.z > -16) this.chargeSpecial(b, 'boss', b.def, dt * sl, 9);
    b.fireT -= dt * sl;
    if (b.fireT <= 0 && b.volley <= 0 && b.z - this.z > -16) {
      // a volley of three big orbs; a wind-up fighter winds up first (its own punch or bow)
      b.fireT = 1.6;
      b.volley = 3;
      b.next = b.windup + 0.05;
      b.pose.windT = 0;
      b.pose.firing = true;
    }
    if (b.volley > 0) {
      b.next -= dt * sl;
      if (b.next <= 0) {
        // each orb leaves the fighter's own muzzle, with its own shot animation: the kick, the
        // slash, the jaw, the hand it fires from (two-handed fighters alternate)
        const m = b.mesh.muzzleWorld(new THREE.Vector3());
        const off = (b.volley - 2) * 1.2;
        const tx = this.cx + off;
        const dz = this.z - m.z;
        const len = Math.hypot(tx - m.x, dz) || 1;
        this.orbs.push({ x: m.x, z: m.z, vx: ((tx - m.x) / len) * 7, vz: (dz / len) * 7, big: true });
        b.pose.lastHand = b.pose.hand;
        if (b.swaps) b.pose.hand = -b.pose.hand;
        b.pose.recoil = 1;
        b.pose.kickT = 0;
        if (b.volley === 3) b.pose.heavyT = 0;
        b.volley--;
        b.next = 0.24;
        sfx.play('super', 0.5);
        if (!b.volley) b.pose.firing = false;
      }
    }
    b.pose.recoil = Math.max(0, b.pose.recoil - dt * 4);
    b.pose.kickT += dt;
    b.pose.windT += dt;
    b.pose.heavyT += dt;
  }

  /** the orbs fired at you (the boss's, a rival's and its guard's): each one that lands costs a member */
  private moveOrbs(dt: number) {
    const sl = this.slow();
    const reach = this.reach();
    this.orbs = this.orbs.filter((o) => {
      o.z += o.vz * dt * sl;
      if (o.wob) {
        o.wob.t += dt * sl;
        o.wob.x0 += o.vx * dt * sl;
        o.x = o.wob.x0 + Math.sin(o.wob.t * 5) * o.wob.amp;
      } else o.x += o.vx * dt * sl;
      if (o.bounce && Math.abs(o.x) > LANE - 0.2) {
        o.x = Math.sign(o.x) * (LANE - 0.2);
        o.vx = -o.vx;
      }
      // (a fighter's orb ploughs through several; a steel ball or a squad pellet takes a couple)
      const cost = o.hit ?? (o.big ? 3 : 2);
      const r = 0.32 * (o.size ?? 1);
      const ally = this.allies.find((a) => Math.hypot(a.x - o.x, a.z - o.z) < 0.5 + r);
      if (ally) {
        this.hurtAlly(ally, cost);
        this.pop(o.x, 0.6, o.z, 0xff3a4a, 4);
        return false;
      }
      if (Math.hypot(o.x - this.cx, o.z - (this.z + reach * 0.4)) < reach * 0.8 + r * 0.5) {
        this.squad = Math.max(0, this.squad - cost);
        this.tap(30);
        this.pop(o.x, 0.4, o.z, 0xff3a4a, 6);
        sfx.play('hurt');
        return false;
      }
      return o.z < this.z + 4 && Math.abs(o.x) < LANE + 2;
    });
  }

  /** an orb from (x, z) toward the squad, at `speed`, aimed `off` to one side */
  private orbAt(x: number, z: number, speed: number, off = 0, big = false, extra: Partial<Orb> = {}) {
    const tx = this.cx + off;
    const dz = this.z - z;
    const len = Math.hypot(tx - x, dz) || 1;
    const o: Orb = { x, z, vx: ((tx - x) / len) * speed, vz: (dz / len) * speed, big, ...extra };
    this.orbs.push(o);
    return o;
  }

  /**
   * an enemy fighter's special move, picked from its own kind of shot: a fan for the two-handed,
   * weaving orbs for a wobbler, one huge slow orb for a biter, wall-bouncers for a ricochet, a
   * stream for a gatling, and a mega orb with escorts for the rest
   */
  private specialName(def: CharacterDef) {
    const sp = def.special ?? {};
    return sp.bite ? 'CRUSHER' : sp.wobble ? 'SERPENT WAVE' : sp.ricochet ? 'RICOCHET' : sp.swap ? 'GATLING' : sp.triple || sp.alternate ? 'SPREAD SHOT' : 'MEGA ORB';
  }

  private enemySpecial(def: CharacterDef, m: THREE.Vector3, boss: boolean) {
    const sp = def.special ?? {};
    const color = def.ball;
    const n = boss ? 1.4 : 1;
    if (sp.bite) {
      this.orbAt(m.x, m.z, 4.2, 0, true, { color, size: boss ? 3 : 2.3, hit: boss ? 12 : 8 });
    } else if (sp.wobble) {
      for (const off of [-1.4, 0, 1.4]) {
        const o = this.orbAt(m.x + off * 0.3, m.z, 5.5, off, true, { color, size: 1.3, hit: 3 });
        o.wob = { x0: o.x, amp: 1.5, t: Math.random() * 6 };
      }
    } else if (sp.ricochet) {
      for (const vx of boss ? [-5, -3, 3, 5] : [-4, 4, -2.5]) this.orbs.push({ x: m.x, z: m.z, vx, vz: 6, big: true, color, size: 1.2, hit: 3, bounce: true });
    } else if (sp.swap) {
      for (let k = 0; k < Math.round(8 * n); k++) this.orbAt(m.x, m.z - k * 0.9, 8, (Math.random() - 0.5) * 1.4, true, { color, size: 1, hit: 2 });
    } else if (sp.triple || sp.alternate) {
      const k = boss ? 7 : 5;
      for (let i = 0; i < k; i++) this.orbAt(m.x, m.z, 6.5, (i - (k - 1) / 2) * 1.15, true, { color, size: 1.2, hit: 3 });
    } else {
      this.orbAt(m.x, m.z, 7.5, 0, true, { color, size: boss ? 2.6 : 2, hit: boss ? 10 : 6 });
      for (const off of [-2, 2]) this.orbAt(m.x, m.z, 6.5, off, true, { color, size: 1.1, hit: 3 });
    }
    this.pop(m.x, 1, m.z, color, 16);
    this.tap([30, 30, 60]);
    sfx.play('super');
    sfx.play('whoosh', 0.8);
  }

  /** counting down to an enemy fighter's special: when it's time, its cinematic starts */
  private chargeSpecial(f: { spT: number }, who: 'rival' | 'boss', def: CharacterDef, dt: number, every: number) {
    if (this.cine) return true;
    if ((f.spT -= dt) > 0) return false;
    f.spT = every;
    this.cine = { t: 0, who, def, fired: false };
    // the banner: its face, who it is, and the move's name, slashing across
    this.sfxEl.querySelector('.sfx-face')!.innerHTML = `<i data-portrait="${def.id}" data-crop="bust"></i>`;
    fillPortraits(this.sfxEl);
    this.sfxEl.querySelector('span')!.textContent = `${who === 'boss' ? 'BOSS' : 'RIVAL'} // ${def.name.toUpperCase()}`;
    this.sfxEl.querySelector('b')!.textContent = `${this.specialName(def)}!`;
    this.sfxEl.classList.remove('hidden', 'go');
    void this.sfxEl.offsetWidth;
    this.sfxEl.classList.add('go');
    this.el.classList.add('sq-cine');
    this.hud.callout.classList.remove('on');
    sfx.play('charge');
    this.tap([30, 40, 60]);
    return true;
  }

  /** the cinematic runs: held still for the power-up, then it lets go and its squad charges in again */
  private runCine(dt: number) {
    const c = this.cine!;
    c.t += dt;
    if (c.t < CINE) return 0;
    const f = c.who === 'boss' ? this.boss : this.rival;
    if (!c.fired) {
      c.fired = true;
      this.sfxEl.classList.add('hidden');
      if (f) {
        this.enemySpecial(c.def, f.mesh.muzzleWorld(new THREE.Vector3()), c.who === 'boss');
        // and from there, its squad comes at you once more
        const d = this.dist();
        if (this.rival && c.who === 'rival') this.rival.guard = Math.max(this.rival.guard, Math.round(this.rival.guardMax * 0.6));
        this.spawnWave(f.z + 4, d);
        this.say(`${c.def.name.toUpperCase()}'S SQUAD CHARGES!`, c.def.ball);
      }
    }
    if (c.t >= CINE + STRIKE.time) {
      this.cine = null;
      this.el.classList.remove('sq-cine');
      return 1;
    }
    return STRIKE.scale;
  }

  /** the cinematic's camera: close on its face, round it as it powers up, then over its shoulder at you */
  private cineCam(cam: THREE.PerspectiveCamera, dt: number) {
    const c = this.cine!;
    const f = c.who === 'boss' ? this.boss : this.rival;
    if (!f || c.t >= CINE) return false;
    const k = c.who === 'boss' ? 2.9 : 1;
    const goal = new THREE.Vector3();
    const look = new THREE.Vector3();
    if (c.t < 0.9) {
      const push = 1 - c.t * 0.15;
      // (high enough to look over its guard of clones)
      goal.set(f.x + 1.6 * k, 2.3 * k, f.z + 3.4 * k * push);
      look.set(f.x, 0.8 * k, f.z);
    } else if (c.t < 1.7) {
      const a = (c.t - 0.9) * 1.7 + 0.4;
      goal.set(f.x + Math.sin(a) * 3.6 * k, 2.1 * k, f.z + Math.cos(a) * 3.6 * k);
      look.set(f.x, 0.75 * k, f.z);
    } else {
      goal.set(f.x - 1.0 * k, 1.8 * k, f.z - 3.0 * k);
      look.set(f.x + 0.2 * k, 0.55 * k, f.z + 3.5 * k);
    }
    // (a hard cut into the first shot, then it glides)
    const snap = c.t < dt * 1.5 ? 1 : Math.min(1, dt * 5);
    cam.position.lerp(goal, snap);
    this.camLook.lerp(look, snap);
    cam.lookAt(this.camLook);
    return true;
  }

  // ---------- rivals: a fighter your size, with a squad of its own clones ----------

  /** fighters not yet met on this run (not yours, not custom ones) */
  private freshFighters() {
    const used = new Set([this.unitId, this.rival?.def.id, ...(this.routeDefs?.map((d) => d.id) ?? []), ...this.allies.map((a) => a.def.id), ...this.frozen.map((f) => f.def.id)]);
    const pool = playable().filter((c) => !used.has(c.id) && !c.id.startsWith('custom'));
    return pool.length ? pool : playable().filter((c) => c.id !== this.unitId);
  }
  private pick(pool: CharacterDef[]) {
    return pool[Math.floor(Math.random() * pool.length)] ?? characterById(this.unitId);
  }

  private spawnRival() {
    const idx = this.rivalsMet++;
    // the second rival is the one waiting down the route you took
    const def = idx === 1 && this.routeDefs ? this.routeDefs[this.route ?? 0] : this.pick(this.freshFighters());
    const mesh = new ShooterMesh(def.id, def.ball, def);
    mesh.size = 0.62;
    this.scene.add(mesh.root);
    const p = pose();
    p.team = 1;
    const sp = def.special;
    const hp = 200 + idx * 220;
    const guard = 28 + idx * 8;
    const shield = 60 + idx * 80;
    this.rival = { def, mesh, pose: p, x: 0, z: this.z - 30, hp, max: hp, t: 0, fireT: 1.6, volley: 0, next: 0, windup: sp?.windup ?? 0, swaps: !!(sp?.alternate || sp?.swap), guard, guardMax: guard, guardHit: 0, guardFireT: 1.2, down: 0, shield, shieldMax: shield, shieldFlash: 0, spT: 6 };
    (this.rivalMini.body.material as THREE.MeshStandardMaterial).color.setHex(def.palette.body);
    (this.rivalMini.head.material as THREE.MeshStandardMaterial).color.setHex(def.palette.trim);
    (this.rivalMini.eye.material as THREE.MeshBasicMaterial).color.setHex(def.palette.eye);
    this.hud.boss.classList.remove('hidden');
    this.hud.boss.querySelector('span')!.textContent = `Rival · ${def.name}`;
    this.say(`RIVAL: ${def.name.toUpperCase()}`, 0xff8a4a);
    sfx.play('gong', 0.6);
  }

  private fightRival(dt: number) {
    const r = this.rival!;
    if (r.hp <= 0) {
      // beaten: it blinks out, then it's gone
      r.down -= dt;
      r.mesh.root.visible = Math.floor(r.down * 12) % 2 === 0;
      if (r.down <= 0) {
        this.scene.remove(r.mesh.root);
        r.mesh.dispose();
        this.rival = null;
      }
      return;
    }
    r.t += dt;
    r.x = Math.sin(r.t * 0.9) * (LANE - 1.6);
    r.pose.flash = Math.max(0, r.pose.flash - dt);
    const sl = this.slow();
    if (r.z - this.z > -16) {
      // now and then its special move, charged up first
      this.chargeSpecial(r, 'rival', r.def, dt * sl, 11);
      // its own volleys: two orbs, its own shot animation
      r.fireT -= dt * sl;
      if (r.fireT <= 0 && r.volley <= 0) {
        r.fireT = 2.1;
        r.volley = 2;
        r.next = r.windup + 0.05;
        r.pose.windT = 0;
        r.pose.firing = true;
      }
      if (r.volley > 0 && (r.next -= dt * sl) <= 0) {
        const m = r.mesh.muzzleWorld(new THREE.Vector3());
        this.orbAt(m.x, m.z, 6.5, (r.volley - 1.5) * 1.2, true);
        r.pose.lastHand = r.pose.hand;
        if (r.swaps) r.pose.hand = -r.pose.hand;
        r.pose.recoil = 1;
        r.pose.kickT = 0;
        r.volley--;
        r.next = 0.3;
        sfx.play('super', 0.35);
        if (!r.volley) r.pose.firing = false;
      }
      // and its guard fires too: a few small orbs, fewer as it thins out
      if (r.guard > 0 && (r.guardFireT -= dt * sl) <= 0) {
        r.guardFireT = 1.3;
        const n = Math.min(3, Math.ceil(r.guard / 7));
        for (let k = 0; k < n; k++) this.orbAt(r.x + (Math.random() - 0.5) * 1.6, r.z + 1.2, 5.5, (Math.random() - 0.5) * 1.5);
      }
    }
    r.pose.recoil = Math.max(0, r.pose.recoil - dt * 4);
    r.pose.kickT += dt;
    r.pose.windT += dt;
    r.pose.heavyT += dt;
  }

  /** where a rival's guard stands: packed in front of it, toward you */
  private guardSpot(i: number) {
    const r = this.rival!;
    const a = i * 2.39996;
    const rad = 0.34 * Math.sqrt(i + 1);
    return { x: THREE.MathUtils.clamp(r.x + Math.cos(a) * rad, -LANE + 0.25, LANE - 0.25), z: r.z + 0.9 + Math.abs(Math.sin(a)) * rad * 0.8 };
  }
  private guardReach() {
    return 0.45 + 0.34 * Math.sqrt(Math.min(this.rival?.guard ?? 0, 40));
  }

  /** a marble reaching a rival: its guard soaks it (4 damage drops one), then the fighter takes it */
  private hitRival(s: Shot) {
    const r = this.rival!;
    const gr = this.guardReach();
    if (r.guard > 0 && Math.abs(s.x - r.x) < gr + 0.2 && s.z - (r.z + 0.9) < gr * 0.8 + 0.4 && s.z > r.z) {
      r.guardHit += s.dmg;
      while (r.guardHit >= 4 && r.guard > 0) {
        r.guardHit -= 4;
        r.guard--;
        this.kills += 1;
        this.pop(s.x, 0.4, s.z, r.def.palette.body, 3);
      }
      return true;
    }
    // its shield barrier takes the hits until it breaks; only then does its health
    if (r.shield > 0 && Math.abs(s.z - r.z) < 1.1 && Math.abs(s.x - r.x) < 1.15) {
      r.shield -= s.dmg;
      r.shieldFlash = 0.08;
      if (r.shield <= 0) {
        r.shield = 0;
        this.pop(r.x, 1, r.z, 0x5af0ff, 18);
        this.say(`${r.def.name.toUpperCase()} · SHIELD DOWN`, 0x5af0ff);
        sfx.play('explode', 0.5);
      }
      return true;
    }
    if (Math.abs(s.z - r.z) < 0.7 && Math.abs(s.x - r.x) < 0.8) {
      r.hp -= s.dmg;
      r.pose.flash = 0.06;
      if (r.hp <= 0) this.rivalDown();
      return true;
    }
    return false;
  }

  private rivalDown() {
    const r = this.rival!;
    r.hp = 0;
    r.down = 1;
    r.guard = 0;
    this.orbs = [];
    this.kills += 40;
    this.squad = Math.min(MAX_SQUAD, this.squad + 6);
    this.pop(r.x, 1, r.z, 0xffd23e, 20);
    this.hud.boss.classList.add('hidden');
    this.say(`${r.def.name.toUpperCase()} BEATEN · +6`, 0xffd23e);
    sfx.play('explode');
    this.tap([20, 40, 20, 40]);
  }

  // ---------- the fork: two routes, a different rival down each ----------

  private spawnFork() {
    const a = this.pick(this.freshFighters());
    // (the first is set before the second is picked, so the two routes never share a rival)
    this.routeDefs = [a, a];
    this.routeDefs = [a, this.pick(this.freshFighters())];
    const zf = -FORK_AT;
    const g = new THREE.Group();
    // two roads, not one split: a grass island between them, and each side its own road from
    // the fork on (A the neon city, B the magma road)
    const halfW = LANE - 0.5;
    const island = new THREE.Mesh(new THREE.BoxGeometry(1, 0.22, FORK_LEN), new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 1 }));
    island.position.set(0, 0.11, zf - FORK_LEN / 2);
    g.add(island);
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.22, 16), island.material);
    nose.position.set(0, 0.11, zf);
    g.add(nose);
    const kerb = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.6 });
    for (const x of [-0.52, 0.52]) {
      const k = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, FORK_LEN), kerb);
      k.position.set(x, 0.13, zf - FORK_LEN / 2);
      g.add(k);
    }
    // a few bushes on the island
    const bush = new THREE.MeshStandardMaterial({ color: 0x2f5a2a, roughness: 1 });
    for (let k = 4; k < FORK_LEN; k += 7) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), bush);
      b.position.set((Math.random() - 0.5) * 0.3, 0.42, zf - k);
      g.add(b);
    }
    const themes: RoadTheme[] = ['neon', 'magma'];
    this.forkRoads = [];
    themes.forEach((th, i) => {
      const side = i === 0 ? -1 : 1;
      // this side's road, alongside the island
      const road = new THREE.Mesh(new THREE.PlaneGeometry(halfW, FORK_LEN), new THREE.MeshStandardMaterial({ map: this.roadTexture(th, FORK_LEN), roughness: 0.9 }));
      road.rotation.x = -Math.PI / 2;
      road.position.set(side * (0.5 + halfW / 2), 0.012, zf - FORK_LEN / 2);
      g.add(road);
      // past the island, it bends away on its own (the one you don't take, you watch go)
      const away = new THREE.Mesh(new THREE.PlaneGeometry(halfW, 46), new THREE.MeshStandardMaterial({ map: this.roadTexture(th, 46), roughness: 0.9 }));
      away.rotation.set(-Math.PI / 2, 0, side * -0.42);
      const a = side * 0.42;
      away.position.set(side * (0.5 + halfW / 2) + Math.sin(a) * 23, 0.008, zf - FORK_LEN - Math.cos(a) * 23);
      g.add(away);
      this.forkRoads.push(away);
    });
    // the signs: each route and who waits down it
    this.routeDefs.forEach((def, i) => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 128;
      const x = c.getContext('2d')!;
      x.fillStyle = i === 0 ? 'rgba(40,150,160,0.9)' : 'rgba(190,60,90,0.9)';
      x.fillRect(4, 4, 248, 120);
      x.strokeStyle = '#fff';
      x.lineWidth = 6;
      x.strokeRect(6, 6, 244, 116);
      x.fillStyle = '#fff';
      x.textAlign = 'center';
      x.font = 'bold 30px "Space Grotesk", system-ui, sans-serif';
      x.fillText(i === 0 ? '◀ ROUTE A' : 'ROUTE B ▶', 128, 46);
      x.font = 'bold 26px "Space Grotesk", system-ui, sans-serif';
      x.fillText(def.name.toUpperCase(), 128, 90);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(LANE - 0.4, 1.7), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      sign.position.set((i === 0 ? -1 : 1) * (LANE / 2), 2.3, zf);
      g.add(sign);
    });
    this.scene.add(g);
    this.fork = g;
  }

  private takeRoute(side: 0 | 1) {
    this.route = side;
    // (yours carries straight on as the road ahead; the other bends away)
    const mine = this.forkRoads[side];
    if (mine) mine.visible = false;
    const def = this.routeDefs![side];
    // each route is a road of its own: A a neon city, B a magma road
    const theme = side === 0 ? 'neon' : 'magma';
    this.paintRoad(theme);
    this.applyTheme(theme);
    this.say(`ROUTE ${side === 0 ? 'A' : 'B'} · ${def.name.toUpperCase()} AHEAD`, side === 0 ? 0x5ad8e0 : 0xff6a8a);
    sfx.play('charge');
  }

  // ---------- frozen fighters: shoot the ice off and they join you ----------

  private spawnFrozen() {
    this.frozenMet++;
    const def = this.pick(this.freshFighters());
    const mesh = new ShooterMesh(def.id, def.ball, def);
    mesh.size = 0.62;
    this.scene.add(mesh.root);
    const x = (Math.random() * 2 - 1) * (LANE - 1.3);
    const z = this.z - 32;
    const p = pose();
    p.x = x;
    p.y = -z;
    mesh.sync(p as never, 0, 0);
    const ice = new THREE.Mesh(new THREE.BoxGeometry(1, 1.35, 0.85), new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.1, emissive: 0x3a7aa8, emissiveIntensity: 0.25 }));
    ice.position.set(x, 0.68, z);
    this.scene.add(ice);
    this.frozen.push({ def, mesh, ice, x, z, got: 0 });
  }

  /** a hit on the ice: it clouds, cracks smaller, and breaks once enough has landed */
  private chip(f: Frozen, n: number) {
    f.got += n;
    const k = Math.min(1, f.got / THAW);
    const mat = f.ice.material as THREE.MeshStandardMaterial;
    mat.opacity = 0.6 - k * 0.4;
    f.ice.scale.setScalar(1 - k * 0.15);
    if (Math.random() < 0.3) this.pop(f.x, 0.8, f.z, 0xbfe8ff, 1);
    if (f.got >= THAW) this.thaw(f);
  }

  private thaw(f: Frozen) {
    this.frozen = this.frozen.filter((o) => o !== f);
    this.scene.remove(f.ice);
    (f.ice.material as THREE.Material).dispose();
    this.pop(f.x, 0.8, f.z, 0xbfe8ff, 16);
    sfx.play('charge');
    this.tap([15, 25, 15]);
    if (this.allies.length < MAX_ALLIES) {
      this.allies.push({ def: f.def, mesh: f.mesh, pose: pose(), fireT: 0, x: f.x, z: f.z, hp: ALLY_HP });
      this.say(`${f.def.name.toUpperCase()} JOINS YOU`, 0x7affb0);
    } else {
      // (a full team: it lends its squad instead)
      this.scene.remove(f.mesh.root);
      f.mesh.dispose();
      this.squad = Math.min(MAX_SQUAD, this.squad + 5);
      this.say(`${f.def.name.toUpperCase()} · +5`, 0x7affb0);
    }
  }

  /** an ally takes a hit: it flashes, and at no health it falls out of the run */
  private hurtAlly(a: Ally, n: number) {
    a.hp -= n;
    a.pose.flash = 0.12;
    this.tap(20);
    if (a.hp <= 0) this.loseAlly(a, `${a.def.name.toUpperCase()} IS DOWN`);
  }

  private loseAlly(a: Ally, text: string) {
    this.allies = this.allies.filter((o) => o !== a);
    this.pop(a.x, 0.8, a.z, 0xff3a4a, 18);
    this.scene.remove(a.mesh.root);
    a.mesh.dispose();
    this.say(text, 0xff6a5a);
    sfx.play('explode', 0.6);
  }

  // ---------- grinders: saws across the whole road, no way round ----------

  private spawnGrinder() {
    this.grindersMet++;
    const z = this.z - 34;
    const group = new THREE.Group();
    group.position.z = z;
    const metal = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.85, roughness: 0.3 });
    const hub = new THREE.MeshStandardMaterial({ color: 0xe8312f, roughness: 0.5 });
    const frame = new THREE.MeshStandardMaterial({ color: 0x2a2a34, roughness: 0.5 });
    // the frame: a post each side and a beam over the road, hazard-striped
    for (const x of [-LANE - 0.1, LANE + 0.1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.3, 0.3), frame);
      post.position.set(x, 1.15, 0);
      group.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(LANE * 2 + 0.5, 0.26, 0.3), new THREE.MeshStandardMaterial({ color: 0xffcf2e, roughness: 0.5 }));
    beam.position.set(0, 2.2, 0);
    group.add(beam);
    // the saws, edge to edge
    const saws: THREE.Mesh[] = [];
    const n = 7;
    // a toothed blade with cut-outs, so you can see it spin
    const blade = new THREE.MeshStandardMaterial({ map: sawTexture(), alphaTest: 0.5, metalness: 0.85, roughness: 0.28, side: THREE.DoubleSide });
    metal.dispose();
    const geo = new THREE.CircleGeometry(0.66, 28);
    const capGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.14, 10).rotateX(Math.PI / 2);
    for (let i = 0; i < n; i++) {
      const saw = new THREE.Mesh(geo, blade);
      saw.position.set(-LANE + 0.6 + (i * (LANE * 2 - 1.2)) / (n - 1), 0.62, 0);
      saw.add(new THREE.Mesh(capGeo, hub));
      group.add(saw);
      saws.push(saw);
    }
    // the slot in the road the saws rise out of
    const slot = new THREE.Mesh(new THREE.BoxGeometry(LANE * 2, 0.04, 0.34), new THREE.MeshBasicMaterial({ color: 0x0a0a0e }));
    slot.position.y = 0.01;
    group.add(slot);
    // warning lamps on the beam, flashing
    for (const x of [-LANE + 0.3, LANE - 0.3]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3a2a }));
      lamp.position.set(x, 2.42, 0);
      lamp.name = 'lamp';
      group.add(lamp);
    }
    // the sign: what it takes
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    panel.position.set(0, 3.45, 0);
    group.add(panel);
    this.scene.add(group);
    const gr: Grinder = { z, take: GRINDER_TAKE, fill: 0, need: GRINDER_FILL, group, saws, canvas, panel, done: false };
    this.paintGrinder(gr);
    this.grinders.push(gr);
    this.say('GRINDER AHEAD · SHOOT IT DOWN', 0xff6a5a);
  }

  private paintGrinder(gr: Grinder) {
    const g = gr.canvas.getContext('2d')!;
    g.clearRect(0, 0, 256, 128);
    g.fillStyle = 'rgba(150,24,30,0.88)';
    g.fillRect(4, 4, 248, 120);
    g.strokeStyle = '#ffcf2e';
    g.lineWidth = 6;
    g.strokeRect(6, 6, 244, 116);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 22px "Space Grotesk", system-ui, sans-serif';
    g.fillText('GRINDER', 128, 26);
    g.font = 'bold 38px "Space Grotesk", system-ui, sans-serif';
    g.fillText(`−${Math.round(gr.take * 100)}%`, 92, 66);
    g.font = 'bold 20px "Space Grotesk", system-ui, sans-serif';
    g.fillText('−1 ALLY', 196, 66);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(24, 96, 208, 14);
    g.fillStyle = '#ffd23e';
    g.fillRect(24, 96, 208 * Math.min(1, gr.fill / gr.need), 14);
    g.strokeStyle = '#fff';
    g.lineWidth = 2;
    g.strokeRect(24, 96, 208, 14);
    ((gr.panel.material as THREE.MeshBasicMaterial).map as THREE.CanvasTexture).needsUpdate = true;
  }

  /** driving through a grinder: no way round it */
  private passGrinders(dt: number) {
    let near = Infinity;
    for (const gr of this.grinders) {
      const ahead = this.z - gr.z;
      // the saws spin, pump up and down out of the slot, and the frame shudders
      gr.saws.forEach((saw, i) => {
        saw.rotation.z -= dt * 16;
        saw.position.y = 0.5 + Math.max(0, Math.sin(this.time * 5 + i * 0.9)) * 0.28;
      });
      gr.group.position.x = Math.sin(this.time * 61) * 0.015;
      const blink = Math.floor(this.time * 4) % 2 === 0;
      gr.group.children.forEach((c) => {
        if (c.name === 'lamp') ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(blink ? 0xff3a2a : 0x401010);
      });
      if (ahead > -2 && ahead < 40) {
        near = Math.min(near, Math.abs(ahead));
        // sparks where the teeth meet the slot
        if (Math.random() < dt * 40) {
          const saw = gr.saws[Math.floor(Math.random() * gr.saws.length)];
          this.pop(saw.position.x + (Math.random() - 0.5) * 0.6, 0.08, gr.z + (Math.random() - 0.5) * 0.3, Math.random() < 0.5 ? 0xffd23e : 0xff8a2a, 2);
        }
      }
      if (gr.done || this.z > gr.z) continue;
      gr.done = true;
      const lost = Math.max(1, Math.ceil(this.squad * gr.take));
      this.squad = Math.max(0, this.squad - lost);
      const ally = this.allies[this.allies.length - 1];
      this.pop(this.cx, 0.6, gr.z, 0xff3a4a, 24);
      sfx.play('clatter');
      sfx.play('slam', 0.8);
      this.tap([60, 30, 80]);
      if (ally) this.loseAlly(ally, `GRINDER · −${lost} · ${ally.def.name.toUpperCase()} LOST`);
      else this.say(`GRINDER · −${lost}`, 0xff6a5a);
    }
    // the grind: louder as you close in
    if (near < 40) sfx.play('grind', 0.25 + 0.75 * (1 - near / 40));
    this.grinders = this.grinders.filter((gr) => {
      const keep = gr.z < this.z + 8;
      if (!keep) this.scene.remove(gr.group);
      return keep;
    });
  }

  /** a frozen fighter left behind stays frozen */
  private passFrozen() {
    this.frozen = this.frozen.filter((f) => {
      if (f.z < this.z + 3) return true;
      this.scene.remove(f.mesh.root, f.ice);
      f.mesh.dispose();
      return false;
    });
  }

  /** paint the road for a theme: the start, the neon city (route A) or the magma road (route B) */
  private paintRoad(theme: RoadTheme, onto?: HTMLCanvasElement) {
    const t = THEMES[theme];
    const c = onto ?? (this.groundTex.image as HTMLCanvasElement);
    const g = c.getContext('2d')!;
    g.fillStyle = t.asphalt;
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
    }
    if (theme === 'magma') {
      // cracks with lava glowing through
      g.strokeStyle = '#ff6a1a';
      g.lineWidth = 3;
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        let x = 20 + Math.random() * 216;
        let y = Math.random() * 256;
        g.moveTo(x, y);
        for (let j = 0; j < 4; j++) g.lineTo((x += (Math.random() - 0.5) * 40), (y += 10 + Math.random() * 20));
        g.stroke();
      }
    } else if (theme === 'neon') {
      // a grid of faint light lines
      g.strokeStyle = 'rgba(58,216,224,0.18)';
      g.lineWidth = 2;
      for (let y = 0; y < 256; y += 32) {
        g.beginPath();
        g.moveTo(10, y);
        g.lineTo(246, y);
        g.stroke();
      }
    }
    g.fillStyle = t.line;
    g.fillRect(124, 0, 8, 120);
    g.fillStyle = t.kerb;
    g.fillRect(0, 0, 10, 256);
    g.fillRect(246, 0, 10, 256);
    if (!onto) this.groundTex.needsUpdate = true;
  }

  /** a road texture of a theme's own (for the two roads at the fork) */
  private roadTexture(theme: RoadTheme, length: number) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    this.paintRoad(theme, c);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, (length / 90) * 12);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /** the sky, the fog, the verges and the fence posts for a theme */
  private applyTheme(theme: RoadTheme) {
    const t = THEMES[theme];
    (this.scene.background as THREE.Color).setHex(t.sky);
    (this.scene.fog as THREE.Fog).color.setHex(t.sky);
    (this.verge.material as THREE.MeshStandardMaterial).color.setHex(t.verge);
    const post = this.posts.material as THREE.MeshStandardMaterial;
    post.color.setHex(t.post);
    post.emissive.setHex(t.glow);
    post.emissiveIntensity = t.glow ? 0.8 : 0;
  }

  /** between the fork's walls: your half of the road (null when the road is whole) */
  private forkHalf(): [number, number] | null {
    const d = this.dist();
    if (this.route === null || d >= FORK_AT + FORK_LEN + 6) return null;
    return this.route === 0 ? [-LANE + 0.4, -0.5] : [0.5, LANE - 0.4];
  }

  /** a callout over the road */
  private say(text: string, color: number) {
    this.hud.callout.textContent = text;
    (this.hud.callout as HTMLElement).style.color = '#' + color.toString(16).padStart(6, '0');
    this.calloutT = 1.8;
  }

  /** damage to the boss: through its armour at half strength, then its health */
  private hurtBoss(n: number) {
    const b = this.boss;
    if (!b || b.hp <= 0) return;
    if (b.armour > 0) b.armour = Math.max(0, b.armour - n * 0.5);
    else b.hp -= n;
    b.pose.flash = 0.06;
    if (b.hp <= 0) this.bossDown();
  }

  private slow() {
    return this.timers.slowmo ? POWER.slow : 1;
  }

  /** the x of the nearest thing to shoot ahead of a point (for smart lock and the steel ball) */
  private nearestAhead(x: number, z: number) {
    let best: number | null = null;
    let bd = 1e9;
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.z > z || z - e.z > 14) continue;
      const d = Math.abs(e.x - x) + (z - e.z) * 0.3;
      if (d < bd) {
        bd = d;
        best = e.x;
      }
    }
    if (best === null && this.boss && this.boss.hp > 0 && this.boss.z < z) best = this.boss.x;
    return best;
  }

  // ---------- items: the main game's air drops, as crates on the lane ----------

  private spawnCrate(x: number, z: number) {
    const kinds = Object.keys(ITEMS) as ItemType[];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const it = ITEMS[kind];
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    // the crate turns and bobs as one piece: a glowing box in the item's colour, banded
    const body = new THREE.Group();
    body.position.y = 0.55;
    body.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: it.color, emissive: it.color, emissiveIntensity: 0.35, roughness: 0.4 })));
    for (const a of [0, Math.PI / 2]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.14, 0.84), new THREE.MeshStandardMaterial({ color: 0x2a2a34 }));
      band.rotation.z = a;
      body.add(band);
    }
    group.add(body);
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(20,18,24,0.8)';
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#' + it.color.toString(16).padStart(6, '0');
    g.font = 'bold 34px "Space Grotesk", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(it.short, 128, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    tag.position.y = 1.35;
    group.add(tag);
    this.scene.add(group);
    this.crates.push({ x, z, hp: CRATE_HP, kind, group });
  }

  /** running into a crate opens it too */
  private touchCrates() {
    const reach = this.reach();
    for (const c of this.crates) if (c.hp > 0 && Math.hypot(c.x - this.cx, c.z - (this.z + reach * 0.4)) < reach) this.grant(c);
    this.crates = this.crates.filter((c) => {
      const keep = c.hp > 0 && c.z < this.z + 4;
      if (!keep) this.scene.remove(c.group);
      return keep;
    });
  }

  private grant(c: Crate) {
    c.hp = 0;
    this.tap([15, 25, 30]);
    const it = ITEMS[c.kind];
    this.pop(c.x, 0.6, c.z, it.color, 12);
    sfx.play('charge');
    this.hud.callout.textContent = it.name;
    (this.hud.callout as HTMLElement).style.color = '#' + it.color.toString(16).padStart(6, '0');
    this.calloutT = 1.4;
    switch (c.kind) {
      case 'multi':
      case 'slowmo':
      case 'wiper':
      case 'lock':
        this.timers[c.kind] = it.duration;
        break;
      case 'heal':
        // repair kit: reinforcements
        this.squad = Math.min(MAX_SQUAD, this.squad + Math.max(POWER.healMin, Math.round(this.squad * POWER.healShare)));
        break;
      case 'dragon':
        for (const dx of [-0.9, 0, 0.9]) this.specials.push({ kind: 'dragon', x: this.cx + dx, x0: this.cx + dx, z: this.z - 0.6, vx: 0, vz: -12, t: 0, hits: 0, hit: new Set() });
        sfx.play('super');
        break;
      case 'missile':
        this.specials.push({ kind: 'steel', x: this.cx, x0: this.cx, z: this.z - 0.6, vx: 0, vz: -11, t: 0, hits: POWER.steelHits, hit: new Set() });
        break;
    }
  }

  /** the dragon balls and the steel ball */
  private moveSpecials(dt: number) {
    for (const p of this.specials) {
      p.t += dt;
      if (p.kind === 'dragon') {
        // three heavy balls weaving side to side, ploughing through everything once
        p.z += p.vz * dt;
        p.x = THREE.MathUtils.clamp(p.x0 + Math.sin(p.t * 7) * 0.9, -LANE, LANE);
        for (const e of this.enemies)
          if (e.hp > 0 && !p.hit.has(e) && Math.abs(e.z - p.z) < 0.7 && Math.abs(e.x - p.x) < 0.8) {
            p.hit.add(e);
            this.damage(e, POWER.dragonDamage);
          }
        if (this.boss && this.boss.hp > 0 && !p.hit.has(this.boss) && Math.abs(this.boss.z - p.z) < 1.5 && Math.abs(this.boss.x - p.x) < 2) {
          p.hit.add(this.boss);
          this.hurtBoss(POWER.dragonBoss);
        }
      } else {
        // the steel ball hunts: it turns toward the nearest target and hits it, a few times over
        let tx = p.x;
        let tz = p.z - 5;
        let target: Enemy | null = null;
        let bd = 1e9;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const dd = Math.hypot(e.x - p.x, e.z - p.z);
          if (dd < bd) {
            bd = dd;
            target = e;
          }
        }
        if (target) {
          tx = target.x;
          tz = target.z;
        } else if (this.boss && this.boss.hp > 0) {
          tx = this.boss.x;
          tz = this.boss.z;
        }
        const dx = tx - p.x;
        const dz = tz - p.z;
        const len = Math.hypot(dx, dz) || 1;
        p.vx += ((dx / len) * 11 - p.vx) * Math.min(1, dt * 4);
        p.vz += ((dz / len) * 11 - p.vz) * Math.min(1, dt * 4);
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        if (target && bd < 0.6) {
          this.damage(target, POWER.steelDamage);
          p.hits--;
        } else if (!target && this.boss && this.boss.hp > 0 && Math.hypot(this.boss.x - p.x, this.boss.z - p.z) < 1.6) {
          this.hurtBoss(POWER.steelBoss);
          p.hits--;
          p.vz = 8;
        }
      }
    }
    this.specials = this.specials.filter((p) => (p.kind === 'dragon' ? p.t < 2.4 : p.hits > 0 && p.t < 12));
  }

  private damage(e: Enemy, n: number) {
    e.hp -= n;
    e.flash = 0.08;
    if (e.hp <= 0) {
      this.kills += e.max;
      this.pop(e.x, 0.4, e.z, 0xff8a5a, TIER[e.tier].pop);
      if (e.tier === 3) this.blast(e);
    }
  }

  /** a kamikaze goes off: a fireball that takes out the horde round it (and sets off other kamikazes) */
  private blast(e: Enemy) {
    this.pop(e.x, 0.5, e.z, 0xffb03a, 14);
    this.pop(e.x, 0.9, e.z, 0xff4a1a, 10);
    this.booms.push({ x: e.x, z: e.z, t: 0 });
    sfx.play('explode', 0.6);
    for (const o of this.enemies)
      if (o !== e && o.hp > 0 && Math.hypot(o.x - e.x, o.z - e.z) < KAMI_BLAST + TIER[o.tier].r) this.damage(o, o.tier === 3 ? 1 : 6);
  }

  /** the wiper: a brick sweeping side to side in front of the squad, clearing the horde and the boss's orbs */
  private sweep() {
    const on = !!this.timers.wiper;
    this.wiper.visible = on;
    if (!on) return;
    const wx = THREE.MathUtils.clamp(this.cx + Math.sin(this.time * 3.2) * 1.4, -LANE + POWER.wiperHalf, LANE - POWER.wiperHalf);
    const wz = this.z - 1.6 - this.reach() * 0.3;
    this.wiper.position.set(wx, 0.3, wz);
    for (const e of this.enemies) if (e.hp > 0 && Math.abs(e.x - wx) < POWER.wiperHalf + 0.2 && Math.abs(e.z - wz) < 0.5) this.damage(e, 99);
    this.orbs = this.orbs.filter((o) => !(Math.abs(o.x - wx) < POWER.wiperHalf + 0.2 && Math.abs(o.z - wz) < 0.5));
  }

  private bossDown() {
    const b = this.boss!;
    this.pop(b.x, 1.5, b.z, 0xffd23e, 30);
    b.mesh.root.visible = false;
    this.orbs = [];
    sfx.play('explode');
    this.finish(true);
  }

  private pop(x: number, y: number, z: number, color: number, n: number) {
    for (let i = 0; i < n && this.pops.length < 120; i++) this.pops.push({ x: x + (Math.random() - 0.5) * 0.6, y: y + Math.random() * 0.4, z: z + (Math.random() - 0.5) * 0.6, t: 0, color: new THREE.Color(color) });
  }

  // ---------- drawing ----------

  private updateHud() {
    (this.hud.count.querySelector('b') as HTMLElement).textContent = String(this.squad);
    const sub = this.allies.length ? `SQUAD · ${this.allies.length} ALL${this.allies.length > 1 ? 'IES' : 'Y'}` : 'SQUAD';
    const span = this.hud.count.querySelector('span') as HTMLElement;
    if (span.textContent !== sub) span.textContent = sub;
    const chips = (Object.keys(this.timers) as Timed[]).filter((t) => (this.timers[t] ?? 0) > 0).map((t) => `<span style="--c:#${ITEMS[t].color.toString(16).padStart(6, '0')}">${ITEMS[t].short} ${Math.ceil(this.timers[t]!)}</span>`);
    const html = chips.join('');
    if (this.hud.powers.innerHTML !== html) this.hud.powers.innerHTML = html;
    (this.hud.score.querySelector('b') as HTMLElement).textContent = String(this.score());
    (this.hud.road.querySelector('i') as HTMLElement).style.width = `${Math.min(100, (this.dist() / BOSS_AT) * 100)}%`;
    // (a rival uses the same bars: its shield where the boss's armour goes, then its health)
    const r = this.rival && this.rival.hp > 0 ? this.rival : null;
    if (r) {
      (this.hud.boss.querySelector('.sq-armour b') as HTMLElement).style.width = `${Math.max(0, (r.shield / r.shieldMax) * 100)}%`;
      (this.hud.boss.querySelector('.sq-hp b') as HTMLElement).style.width = `${Math.max(0, (r.hp / r.max) * 100)}%`;
    } else if (this.boss) {
      (this.hud.boss.querySelector('.sq-armour b') as HTMLElement).style.width = `${Math.max(0, (this.boss.armour / BOSS_ARMOUR) * 100)}%`;
      (this.hud.boss.querySelector('.sq-hp b') as HTMLElement).style.width = `${Math.max(0, (this.boss.hp / BOSS_HP) * 100)}%`;
    }
  }

  private draw(dt: number) {
    const d = this.dummy;
    // the squad: the leader animates with its own walk; the clones bob along in a blob
    const spots = this.memberSpots();
    while (this.followers.length < spots.length) this.followers.push(spots[this.followers.length].clone());
    this.followers.length = spots.length;
    this.followers.forEach((f, i) => f.lerp(spots[i], Math.min(1, dt * 10)));
    if (this.leader) {
      const lp = this.leaderPose;
      lp.x = this.followers[0]?.x ?? this.cx;
      lp.y = -(this.followers[0]?.z ?? this.z);
      lp.vx = this.over ? 0 : 3;
      lp.firing = !this.over;
      lp.recoil = Math.max(0, 1 - lp.kickT / 0.12) * 0.6;
      this.leader.root.visible = this.squad > 0;
      this.leader.sync(lp as never, this.time, dt);
    }
    const n = Math.max(0, Math.min(this.followers.length - 1, this.squad - 1));
    for (let i = 0; i < n; i++) {
      const f = this.followers[i + 1];
      const bob = Math.abs(Math.sin(this.time * 12 + i)) * 0.06;
      d.rotation.set(0, 0, 0);
      d.scale.setScalar(1);
      d.position.set(f.x, 0.2 + bob, f.z);
      d.updateMatrix();
      this.mini.body.setMatrixAt(i, d.matrix);
      d.position.set(f.x, 0.48 + bob, f.z);
      d.updateMatrix();
      this.mini.head.setMatrixAt(i, d.matrix);
      d.position.set(f.x, 0.5 + bob, f.z - 0.12);
      d.updateMatrix();
      this.mini.eye.setMatrixAt(i, d.matrix);
    }
    for (const m of Object.values(this.mini)) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
    }

    // the horde: dark robots with a hot visor, flashing white when hit
    const col = new THREE.Color();
    let ei = 0;
    let ti = 0;
    let bi = 0;
    let ki = 0;
    for (const e of this.enemies) {
      const hitCol = e.flash > 0 ? col.setHex(0xffffff) : null;
      if (e.tier === 1 && ti < 40) {
        // a tank: hull, turret, and its gun pointed at you
        const rumble = Math.sin(this.time * 20 + e.x) * 0.015;
        d.position.set(e.x, 0.21 + rumble, e.z);
        d.updateMatrix();
        this.tank.hull.setMatrixAt(ti, d.matrix);
        this.tank.hull.setColorAt(ti, hitCol ?? col.setHex(0x9a3a4a));
        d.position.set(e.x, 0.57 + rumble, e.z - 0.05);
        d.updateMatrix();
        this.tank.turret.setMatrixAt(ti, d.matrix);
        this.tank.turret.setColorAt(ti, hitCol ?? col.setHex(0x7a2a38));
        d.position.set(e.x, 0.6 + rumble, e.z + 0.6);
        d.updateMatrix();
        this.tank.gun.setMatrixAt(ti, d.matrix);
        ti++;
        continue;
      }
      if (e.tier === 2 && bi < 20) {
        // a bulldozer: body, cab behind, the blade out in front
        const rumble = Math.sin(this.time * 14 + e.x) * 0.02;
        d.position.set(e.x, 0.36 + rumble, e.z);
        d.updateMatrix();
        this.dozer.body.setMatrixAt(bi, d.matrix);
        this.dozer.body.setColorAt(bi, hitCol ?? col.setHex(0xc8782a));
        d.position.set(e.x, 0.98 + rumble, e.z - 0.3);
        d.updateMatrix();
        this.dozer.cab.setMatrixAt(bi, d.matrix);
        this.dozer.cab.setColorAt(bi, hitCol ?? col.setHex(0x5a5262));
        d.position.set(e.x, 0.38 + rumble, e.z + 0.78);
        d.updateMatrix();
        this.dozer.blade.setMatrixAt(bi, d.matrix);
        this.dozer.blade.setColorAt(bi, hitCol ?? col.setHex(0xffffff));
        bi++;
        continue;
      }
      // a foot soldier (a kamikaze runs faster, leaning in, red, with its bomb)
      const kami = e.tier === 3;
      const step = Math.abs(Math.sin(this.time * (kami ? 18 : 9) + e.x * 3)) * (kami ? 0.09 : 0.05);
      d.position.set(e.x, 0.25 + step, e.z);
      if (kami) d.rotation.x = 0.35;
      d.updateMatrix();
      d.rotation.x = 0;
      this.foe.body.setMatrixAt(ei, d.matrix);
      this.foe.body.setColorAt(ei, hitCol ?? col.setHex(kami ? 0xd84a3a : 0x6a6276));
      if (kami && ki < 60) {
        d.position.set(e.x, 0.6 + step, e.z - 0.2);
        d.updateMatrix();
        this.kamiBomb.setMatrixAt(ki, d.matrix);
        d.position.set(e.x, 0.85 + step, e.z - 0.2);
        d.updateMatrix();
        this.kamiFuse.setMatrixAt(ki, d.matrix);
        this.kamiFuse.setColorAt(ki, col.setHex(Math.floor(this.time * 10 + e.x * 5) % 2 ? 0xffe14a : 0xff3a1a));
        ki++;
      }
      d.position.set(e.x, 0.36 + step, e.z + 0.21);
      d.updateMatrix();
      this.foe.eye.setMatrixAt(ei, d.matrix);
      ei++;
    }
    for (const [group, n] of [[this.tank, ti], [this.dozer, bi]] as const) {
      for (const m of Object.values(group) as THREE.InstancedMesh[]) {
        m.count = n;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    }
    this.kamiBomb.count = ki;
    this.kamiFuse.count = ki;
    this.kamiBomb.instanceMatrix.needsUpdate = true;
    this.kamiFuse.instanceMatrix.needsUpdate = true;
    if (this.kamiFuse.instanceColor) this.kamiFuse.instanceColor.needsUpdate = true;
    let bo = 0;
    for (const b of this.booms) {
      if (bo >= 24) break;
      d.position.set(b.x, 0.4, b.z);
      d.scale.setScalar(0.3 + (b.t / 0.35) * KAMI_BLAST);
      d.updateMatrix();
      this.boomMesh.setMatrixAt(bo++, d.matrix);
    }
    this.boomMesh.count = bo;
    this.boomMesh.instanceMatrix.needsUpdate = true;
    d.scale.setScalar(1);
    for (const m of Object.values(this.foe)) {
      m.count = ei;
      m.instanceMatrix.needsUpdate = true;
    }
    if (this.foe.body.instanceColor) this.foe.body.instanceColor.needsUpdate = true;

    // the clones' small marbles and the fighters' big ones
    let small = 0;
    let big = 0;
    for (const s of this.shots) {
      d.position.set(s.x, s.big ? 0.55 : 0.45, s.z);
      d.updateMatrix();
      if (s.big) {
        if (big < 60) {
          this.bigShotMesh.setMatrixAt(big, d.matrix);
          this.bigGlowMesh.setMatrixAt(big++, d.matrix);
        }
      } else this.shotMesh.setMatrixAt(small++, d.matrix);
    }
    this.shotMesh.count = small;
    this.bigShotMesh.count = big;
    this.bigGlowMesh.count = big;
    this.bigGlowMesh.instanceMatrix.needsUpdate = true;
    this.shotMesh.instanceMatrix.needsUpdate = true;
    this.bigShotMesh.instanceMatrix.needsUpdate = true;
    // enemy fighters' big orbs and their squads' small pellets
    let oi = 0;
    let pi = 0;
    let sti = 0;
    let spi = 0;
    const oc = new THREE.Color();
    for (const o of this.orbs) {
      const sz = o.size ?? 1;
      d.position.set(o.x, o.color !== undefined ? 0.35 + 0.3 * sz : o.big ? 0.6 : o.steel ? 0.32 : 0.45, o.z);
      d.scale.setScalar(sz);
      if (o.steel) d.rotation.set(this.time * 9, 0, 0);
      d.updateMatrix();
      d.scale.setScalar(1);
      d.rotation.set(0, 0, 0);
      if (o.color !== undefined) {
        if (spi < 40) {
          oc.setHex(o.color);
          this.superMesh.setMatrixAt(spi, d.matrix);
          this.superMesh.setColorAt(spi, oc);
          this.superGlow.setMatrixAt(spi, d.matrix);
          this.superGlow.setColorAt(spi, oc);
          spi++;
        }
      } else if (o.steel) {
        if (sti < 60) this.foeSteelMesh.setMatrixAt(sti++, d.matrix);
      } else if (o.big) {
        if (oi < 40) this.orbMesh.setMatrixAt(oi++, d.matrix);
      } else if (pi < 80) this.pelletMesh.setMatrixAt(pi++, d.matrix);
    }
    this.orbMesh.count = oi;
    this.pelletMesh.count = pi;
    this.foeSteelMesh.count = sti;
    this.superMesh.count = spi;
    this.superGlow.count = spi;
    for (const m of [this.orbMesh, this.pelletMesh, this.foeSteelMesh, this.superMesh, this.superGlow]) m.instanceMatrix.needsUpdate = true;
    for (const m of [this.superMesh, this.superGlow]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    let di = 0;
    let si = 0;
    for (const p of this.specials) {
      d.position.set(p.x, p.kind === 'dragon' ? 0.5 : 0.4, p.z);
      d.updateMatrix();
      if (p.kind === 'dragon') this.dragonMesh.setMatrixAt(di++, d.matrix);
      else this.steelMesh.setMatrixAt(si++, d.matrix);
    }
    this.dragonMesh.count = di;
    this.steelMesh.count = si;
    this.dragonMesh.instanceMatrix.needsUpdate = true;
    this.steelMesh.instanceMatrix.needsUpdate = true;
    for (const c of this.crates) {
      c.group.children[0].rotation.y = this.time * 1.5;
      c.group.children[0].position.y = 0.55 + Math.sin(this.time * 3 + c.x) * 0.08;
    }
    this.pops.forEach((p, i) => {
      const k = p.t / 0.45;
      d.position.set(p.x, p.y + k * 0.8, p.z);
      d.rotation.set(k * 4, k * 6, 0);
      d.scale.setScalar(1 - k);
      d.updateMatrix();
      this.popMesh.setMatrixAt(i, d.matrix);
      this.popMesh.setColorAt(i, p.color);
    });
    d.rotation.set(0, 0, 0);
    d.scale.setScalar(1);
    this.popMesh.count = this.pops.length;
    this.popMesh.instanceMatrix.needsUpdate = true;
    if (this.popMesh.instanceColor) this.popMesh.instanceColor.needsUpdate = true;

    if (this.boss) {
      const b = this.boss;
      b.pose.x = b.x;
      b.pose.y = -b.z;
      b.pose.vx = Math.cos(b.t * 0.7) * 2;
      b.mesh.sync(b.pose as never, this.time, dt);
      if (this.cine?.who === 'boss' && this.cine.t < CINE) b.mesh.specialPose(this.cine.t * (2.8 / CINE), 1);
    }
    // the shield bubbles: a rival's, and the boss's armour; brighter as they're hit, fainter as they wear
    const rb = this.rival && this.rival.hp > 0 && this.rival.shield > 0 ? this.rival : null;
    this.rivalBubble.visible = !!rb;
    if (rb) {
      rb.shieldFlash = Math.max(0, rb.shieldFlash - dt);
      this.rivalBubble.position.set(rb.x, 0.75, rb.z);
      this.rivalBubble.scale.setScalar(1.15 + Math.sin(this.time * 4) * 0.03);
      (this.rivalBubble.material as THREE.MeshBasicMaterial).opacity = (rb.shieldFlash > 0 ? 0.6 : 0.18) + 0.2 * (rb.shield / rb.shieldMax);
    }
    const bb = this.boss && this.boss.hp > 0 && this.boss.armour > 0 ? this.boss : null;
    this.bossBubble.visible = !!bb;
    if (bb) {
      this.bossBubble.position.set(bb.x, 2.2, bb.z);
      this.bossBubble.scale.setScalar(3.2 + Math.sin(this.time * 3) * 0.06);
      (this.bossBubble.material as THREE.MeshBasicMaterial).opacity = (bb.pose.flash > 0 ? 0.45 : 0.14) + 0.18 * (bb.armour / BOSS_ARMOUR);
    }
    // a rival and its guard of clones
    let gi = 0;
    if (this.rival) {
      const r = this.rival;
      r.pose.x = r.x;
      r.pose.y = -r.z;
      r.pose.vx = Math.cos(r.t * 0.9) * 2;
      r.mesh.sync(r.pose as never, this.time, dt);
      if (this.cine?.who === 'rival' && this.cine.t < CINE) r.mesh.specialPose(this.cine.t * (2.8 / CINE), 1);
      for (let i = 0; i < Math.min(r.guard, 40); i++) {
        const g = this.guardSpot(i);
        const bob = Math.abs(Math.sin(this.time * 12 + i)) * 0.06;
        d.position.set(g.x, 0.2 + bob, g.z);
        d.updateMatrix();
        this.rivalMini.body.setMatrixAt(gi, d.matrix);
        d.position.set(g.x, 0.48 + bob, g.z);
        d.updateMatrix();
        this.rivalMini.head.setMatrixAt(gi, d.matrix);
        // (facing you: the visor on the near side)
        d.position.set(g.x, 0.5 + bob, g.z + 0.12);
        d.updateMatrix();
        this.rivalMini.eye.setMatrixAt(gi, d.matrix);
        gi++;
      }
    }
    for (const m of Object.values(this.rivalMini)) {
      m.count = gi;
      m.instanceMatrix.needsUpdate = true;
    }
    // allies walk beside your fighter (a step ahead, so they never block the view), firing as they go
    const slots = [
      [-1.1, -0.3],
      [1.1, -0.3],
      [0, -1.1],
    ];
    this.allies.forEach((a, i) => {
      const [sx, sz] = slots[i] ?? [0, 1];
      a.x += (THREE.MathUtils.clamp(this.cx + sx, -LANE + 0.4, LANE - 0.4) - a.x) * Math.min(1, dt * 8);
      a.z += (this.z + sz - a.z) * Math.min(1, dt * 8);
      const ap = a.pose;
      ap.x = a.x;
      ap.y = -a.z;
      ap.vx = this.over ? 0 : 3;
      ap.firing = !this.over;
      ap.kickT = (this.leaderPose.kickT + i * 0.13) % 0.5;
      ap.recoil = Math.max(0, 1 - ap.kickT / 0.12) * 0.6;
      a.mesh.root.visible = this.squad > 0;
      a.mesh.sync(ap as never, this.time, dt);
    });

    // the road and the fence scroll with the squad
    this.ground.position.set(0, 0, this.z - 30);
    this.groundTex.offset.y = (this.z / 90) * 12 * -1;
    for (let i = 0; i < 40; i++) {
      const side = i % 2 ? 1 : -1;
      const zz = Math.floor(this.z / 3) * 3 - Math.floor(i / 2) * 3 + 6;
      d.position.set(side * (LANE + 0.45), 0.45, zz);
      d.updateMatrix();
      this.posts.setMatrixAt(i, d.matrix);
    }
    this.posts.instanceMatrix.needsUpdate = true;

    // the camera rides behind and above, leaning toward where you steer
    const cam = this.camera;
    if (!this.cine || !this.cineCam(cam, dt)) {
      // (back from a cinematic, it eases home)
      const ease = this.cine || this.camLook.distanceTo(new THREE.Vector3(this.cx * 0.2, 0, this.z - 9)) > 0.3 ? dt * 4 : dt * 6;
      cam.position.lerp(new THREE.Vector3(this.cx * 0.35, 8.5, this.z + 8.5), Math.min(1, ease) || 1);
      this.camLook.lerp(new THREE.Vector3(this.cx * 0.2, 0, this.z - 9), Math.min(1, ease * 1.5) || 1);
      cam.lookAt(this.camLook);
    }
    celify(this.scene);
    this.renderer.render(this.scene, cam);
  }
}
