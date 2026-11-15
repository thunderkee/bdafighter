import * as THREE from 'three';
import { celify } from './cel';
import { ShooterMesh, characterById, playable, studioEnv, type CharacterDef } from './robot';
import * as sfx from './audio';
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
const FIRE_EVERY = 0.55; // seconds between one member's shots
const SHOT_SPEED = 22;
const SHOT_RANGE = 20;
const MAX_SHOTS = 420;
const MAX_ENEMIES = 260;
const MAX_SQUAD = 150;
const VISIBLE = 48; // mini clones drawn (the rest of a big squad is counted, not drawn)
/** the boss is huge: armour to break first (shots do half damage through it), then health;
 *  it takes a squad of about 60 to win the race against its volleys */
const BOSS_HP = 2000;
const BOSS_ARMOUR = 400;
const BEST_KEY = 'marble-fighter:squad:best';

type Op = { kind: '+' | '-' | 'x' | '/'; n: number };
/** a gate's bar fills twice as slowly on a × or ÷ (they move the squad by a share, not a count) */
const barScale = (op: Op) => (op.kind === 'x' || op.kind === '/' ? 2 : 1);
type Gate = { z: number; ops: [Op, Op]; panels: [THREE.Mesh, THREE.Mesh]; canvases: [HTMLCanvasElement, HTMLCanvasElement]; fill: [number, number]; need: [number, number]; group: THREE.Group; done: boolean };
type Enemy = { x: number; z: number; hp: number; max: number; speed: number; big: boolean; flash: number };
/** a marble: `dmg` is its power, `big` a fighter's (drawn larger) */
type Shot = { x: number; z: number; z0: number; vx: number; dmg: number; big: boolean };
/** a rival: a fighter at your size with a squad of its own clones guarding it */
type Rival = {
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
type Orb = { x: number; z: number; vx: number; vz: number };
type Pop = { x: number; y: number; z: number; t: number; color: THREE.Color };

/**
 * the clones' and the horde's painted textures (64 px, greys: the colour comes from the
 * material): a body with panel seams, a chest light and rivets; a helmet with a crest and a
 * brow band; the horde's armour with vents and a hazard stripe
 */
function squadTexture(kind: 'body' | 'head' | 'foe' | 'rival' | 'rivalHead') {
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
  private boss: { mesh: ShooterMesh; pose: ReturnType<typeof pose>; x: number; z: number; hp: number; armour: number; t: number; fireT: number; volley: number; next: number; windup: number; swaps: boolean } | null = null;
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

  // drawing
  private ground!: THREE.Mesh;
  private groundTex!: THREE.CanvasTexture;
  private mini!: { body: THREE.InstancedMesh; head: THREE.InstancedMesh; eye: THREE.InstancedMesh };
  /** a rival's guard: clones like yours in its colours */
  private rivalMini!: { body: THREE.InstancedMesh; head: THREE.InstancedMesh; eye: THREE.InstancedMesh };
  private bigShotMesh!: THREE.InstancedMesh;
  private verge!: THREE.Mesh;
  private foe!: { body: THREE.InstancedMesh; eye: THREE.InstancedMesh };
  private shotMesh!: THREE.InstancedMesh;
  private orbMesh!: THREE.InstancedMesh;
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
          <div class="sq-count"><b>5</b><span>SQUAD</span></div>
          <div class="sq-score"><b>0</b><span>SCORE</span></div>
        </div>
        <div class="sq-road"><i></i><b class="mk" style="left:${(RIVAL_AT[0] / BOSS_AT) * 100}%"></b><b class="mk fork" style="left:${(FORK_AT / BOSS_AT) * 100}%"></b><b class="mk" style="left:${(RIVAL_AT[1] / BOSS_AT) * 100}%"></b><em>BOSS</em></div>
        <div class="sq-boss hidden"><span></span><i class="sq-armour"><b></b></i><i class="sq-hp"><b></b></i></div>
        <div class="sq-powers"></div>
        <p class="sq-callout"></p>
        <p class="sq-hint">DRAG TO STEER</p>
      </div>
      <div class="sq-panel">
        <h2>Gate Rush</h2>
        <p class="sq-unit"></p>
        <p class="sq-text">Steer your squad through the gates: blue grows it, red shrinks it, and shooting a gate fills its bar to raise its number. Beat the rivals on the road, pick your route at the fork, shoot frozen fighters free to join you, and take down the boss at the end.</p>
        <p class="sq-best"></p>
        <div class="sq-buttons"><button class="sq-go key">Start</button><button class="sq-back key">Back</button></div>
      </div>`;
    host.appendChild(this.el);
    this.canvas = this.el.querySelector('canvas')!;
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
    this.shotMesh = inst(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial(), MAX_SHOTS);
    this.orbMesh = inst(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3a4a }), 40);
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
    this.squad = 5;
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

  /** battery saver: 1.5x density and 30 frames a second */
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
    if (!this.over) this.step(dt);
    this.draw(dt);
  };

  private step(dt: number) {
    this.time += dt;
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
        if (!GRINDER_AT.some((gd) => Math.abs(gd - (d + 34)) < 8)) this.spawnGate(this.z - 34);
        // (closer while the squad builds up, sparser later on)
        this.gateAt += d < 200 ? 48 : 68;
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
    this.passGates();
    if (this.boss) this.fightBoss(dt);
    if (this.rival) this.fightRival(dt);
    this.moveOrbs(dt);
    this.passFrozen();
    this.passGrinders(dt);
    for (const p of this.pops) p.t += dt;
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
        const side = s.x < 0 ? 0 : 1;
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
          const r = e.big ? 0.65 : 0.34;
          if (Math.abs(e.z - s.z) < r && Math.abs(e.x - s.x) < r) {
            e.hp -= s.dmg;
            e.flash = 0.08;
            if (e.hp <= 0) {
              this.kills += e.max;
              this.pop(e.x, 0.4, e.z, 0xff8a5a, e.big ? 6 : 3);
              if (Math.random() < 0.5) sfx.play('pop', 0.5);
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
      // drift toward the squad a little as they close in
      e.x += Math.sign(this.cx - e.x) * Math.min(Math.abs(this.cx - e.x), dt * (0.4 + d / 900));
      // (the fork's wall holds them on their own side)
      if (this.route !== null && d < FORK_AT + FORK_LEN + 6 && Math.abs(e.z + FORK_AT + FORK_LEN / 2) < FORK_LEN / 2 + 2) e.x = e.x < 0 ? Math.min(e.x, -0.45) : Math.max(e.x, 0.45);
      // an ally in its way takes the hit instead
      const ally = this.allies.find((a) => Math.hypot(a.x - e.x, a.z - e.z) < (e.big ? 0.9 : 0.6));
      if (ally) {
        e.hp = 0;
        this.hurtAlly(ally, e.big ? 5 : 1);
        this.pop(e.x, 0.4, e.z, 0xff3a4a, 3);
        continue;
      }
      const dx = e.x - this.cx;
      const dz = e.z - (this.z + reach * 0.4);
      if (Math.hypot(dx, dz) < reach && this.squad > 0) {
        // it reaches the squad: it's gone, and so are some of yours
        e.hp = 0;
        this.squad = Math.max(0, this.squad - (e.big ? 4 : 1));
        this.tap(e.big ? 40 : 12);
        this.pop(e.x, 0.4, e.z, 0xff3a4a, 4);
        sfx.play('hurt', 0.6);
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0 && e.z < this.z + 6);
  }

  private spawnWave(z: number, d: number) {
    // the horde grows with the distance and with your squad, so a big squad still has a fight
    const half = this.forkHalf();
    const n = Math.floor(Math.min(4 + Math.floor(d / 40) + Math.floor(this.squad * 0.08), 24) * (half ? 0.5 : 1));
    const spot = () => (half ? half[0] + Math.random() * (half[1] - half[0]) : (Math.random() * 2 - 1) * (LANE - 0.4));
    // (it toughens along the road, but levels off: a squad can only grow so big)
    const hp = 1 + Math.floor(Math.min(d, 620) / 230);
    const big = d > 120 && Math.random() < 0.35;
    for (let i = 0; i < n && this.enemies.length < MAX_ENEMIES; i++) {
      this.enemies.push({ x: spot(), z: z - Math.random() * 5, hp, max: hp, speed: 1.4 + Math.random() * 0.8, big: false, flash: 0 });
    }
    if (big && this.enemies.length < MAX_ENEMIES) {
      const bhp = 10 + Math.floor(Math.min(d, 800) / 60);
      this.enemies.push({ x: half ? spot() : (Math.random() * 2 - 1) * (LANE - 1), z: z - 2, hp: bhp, max: bhp, speed: 1.1, big: true, flash: 0 });
    }
  }

  // ---------- gates ----------

  private spawnGate(z: number) {
    const d = this.dist();
    // (fewer gates, and fewer plain + ones: a × often, otherwise a + big enough to matter)
    const good = (): Op => {
      const r = Math.random();
      if (r < 0.3) return { kind: 'x', n: d > 500 && r < 0.08 ? 3 : 2 };
      return { kind: '+', n: 6 + Math.floor(Math.random() * (8 + d / 30)) };
    };
    // the other side takes away: mostly a −, further on often a ÷, only now and then a small +
    const bad = (): Op => {
      const r = Math.random();
      if (d > 120 && r < 0.32) return { kind: '/', n: 2 + (d > 600 && Math.random() < 0.4 ? 1 : 0) };
      return r < 0.9 ? { kind: '-', n: 4 + Math.floor(Math.random() * (5 + d / 50)) } : { kind: '+', n: 1 + Math.floor(Math.random() * 2) };
    };
    const ops: [Op, Op] = Math.random() < 0.5 ? [good(), bad()] : [bad(), good()];
    // now and then both are bad: shoot one up before you reach it
    if (d > 100 && Math.random() < 0.25) ops[Math.random() < 0.5 ? 0 : 1] = { kind: '-', n: 4 + Math.floor(d / 60) };
    const group = new THREE.Group();
    group.position.z = z;
    const w = LANE - 0.15;
    const canvases: [HTMLCanvasElement, HTMLCanvasElement] = [document.createElement('canvas'), document.createElement('canvas')];
    const panels = canvases.map((c, i) => {
      c.width = 256;
      c.height = 128;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      m.position.set((i === 0 ? -1 : 1) * (LANE / 2), 0.95, 0);
      group.add(m);
      return m;
    }) as unknown as [THREE.Mesh, THREE.Mesh];
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2a2a34, roughness: 0.5 });
    for (const x of [-LANE, 0, LANE]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.9, 0.22), postMat);
      post.position.set(x, 0.95, 0);
      group.add(post);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.2), new THREE.MeshBasicMaterial({ color: 0xffc23d }));
      lamp.position.set(x, 1.95, 0);
      group.add(lamp);
    }
    this.scene.add(group);
    const gt: Gate = { z, ops, panels, canvases, fill: [0, 0], need: [GATE_FILL * barScale(ops[0]), GATE_FILL * barScale(ops[1])], group, done: false };
    this.paint(gt, 0);
    this.paint(gt, 1);
    this.gates.push(gt);
  }

  private label(op: Op) {
    if (op.kind === '/') return `÷${op.n}`;
    return op.kind === 'x' ? `×${op.n}` : `${op.kind}${op.n}`;
  }

  private paint(gt: Gate, side: number) {
    const op = gt.ops[side];
    const c = gt.canvases[side];
    const g = c.getContext('2d')!;
    const good = op.kind !== '-' && op.kind !== '/';
    g.clearRect(0, 0, 256, 128);
    g.fillStyle = good ? 'rgba(42,120,255,0.78)' : 'rgba(238,58,74,0.78)';
    g.fillRect(4, 4, 248, 120);
    g.strokeStyle = good ? '#9ad8ff' : '#ffb0b8';
    g.lineWidth = 6;
    g.strokeRect(6, 6, 244, 116);
    g.fillStyle = '#fff';
    g.font = 'bold 76px "Space Grotesk", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(this.label(op), 128, 60);
    // the bar: fills as it's shot, and the number goes up by one when it's full
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(24, 100, 208, 14);
    g.fillStyle = '#ffd23e';
    g.fillRect(24, 100, 208 * Math.min(1, gt.fill[side] / gt.need[side]), 14);
    g.strokeStyle = '#fff';
    g.lineWidth = 2;
    g.strokeRect(24, 100, 208, 14);
    ((gt.panels[side].material as THREE.MeshBasicMaterial).map as THREE.CanvasTexture).needsUpdate = true;
  }

  /** a shot gate gets better: a + grows, a - shrinks and turns into a + */
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
    else op.n = Math.min(op.n + 1, 5);
    this.paint(gt, side);
  }

  private passGates() {
    for (const gt of this.gates) {
      if (gt.done || this.z > gt.z) continue;
      gt.done = true;
      const side = this.cx < 0 ? 0 : 1;
      const op = gt.ops[side];
      const before = this.squad;
      if (op.kind === '+') this.squad += op.n;
      else if (op.kind === '-') this.squad -= op.n;
      else if (op.kind === '/') this.squad = Math.floor(this.squad / op.n);
      else this.squad *= op.n;
      this.squad = THREE.MathUtils.clamp(this.squad, 0, MAX_SQUAD);
      const good = this.squad >= before;
      this.tap(good ? [15, 30, 15] : 60);
      this.pop(this.cx, 1, gt.z, good ? 0x5ab8ff : 0xff3a4a, 10);
      sfx.play(good ? 'charge' : 'hurt');
      // the panel you went through flashes and both fade away
      gt.panels[side].scale.setScalar(1.15);
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
    this.boss = { mesh, pose: p, x: 0, z: this.z - 32, hp: BOSS_HP, armour: BOSS_ARMOUR, t: 0, fireT: 2, volley: 0, next: 0, windup: sp?.windup ?? 0, swaps: !!(sp?.alternate || sp?.swap) };
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
        this.orbs.push({ x: m.x, z: m.z, vx: ((tx - m.x) / len) * 7, vz: (dz / len) * 7 });
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
      o.x += o.vx * dt * sl;
      o.z += o.vz * dt * sl;
      const ally = this.allies.find((a) => Math.hypot(a.x - o.x, a.z - o.z) < 0.65);
      if (ally) {
        this.hurtAlly(ally, 2);
        this.pop(o.x, 0.6, o.z, 0xff3a4a, 4);
        return false;
      }
      if (Math.hypot(o.x - this.cx, o.z - (this.z + reach * 0.4)) < reach * 0.8) {
        this.squad = Math.max(0, this.squad - 1);
        this.tap(30);
        this.pop(o.x, 0.4, o.z, 0xff3a4a, 6);
        sfx.play('hurt');
        return false;
      }
      return o.z < this.z + 4 && Math.abs(o.x) < LANE + 2;
    });
  }

  /** an orb from (x, z) toward the squad, at `speed`, aimed `off` to one side */
  private orbAt(x: number, z: number, speed: number, off = 0) {
    const tx = this.cx + off;
    const dz = this.z - z;
    const len = Math.hypot(tx - x, dz) || 1;
    this.orbs.push({ x, z, vx: ((tx - x) / len) * speed, vz: (dz / len) * speed });
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
    const hp = 280 + idx * 200;
    const guard = 28 + idx * 8;
    this.rival = { def, mesh, pose: p, x: 0, z: this.z - 30, hp, max: hp, t: 0, fireT: 1.6, volley: 0, next: 0, windup: sp?.windup ?? 0, swaps: !!(sp?.alternate || sp?.swap), guard, guardMax: guard, guardHit: 0, guardFireT: 1.2, down: 0 };
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
        this.orbAt(m.x, m.z, 6.5, (r.volley - 1.5) * 1.2);
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
    // the wall down the middle, from the fork on
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.1, FORK_LEN), new THREE.MeshStandardMaterial({ color: 0x2a2a34, roughness: 0.6 }));
    wall.position.set(0, 0.55, zf - FORK_LEN / 2);
    g.add(wall);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, FORK_LEN), new THREE.MeshBasicMaterial({ color: 0xffc23d }));
    cap.position.set(0, 1.12, zf - FORK_LEN / 2);
    g.add(cap);
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
    const geo = new THREE.CylinderGeometry(0.62, 0.62, 0.07, 14);
    geo.rotateX(Math.PI / 2);
    for (let i = 0; i < n; i++) {
      const saw = new THREE.Mesh(geo, metal);
      saw.position.set(-LANE + 0.6 + (i * (LANE * 2 - 1.2)) / (n - 1), 0.62, 0);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 10).rotateX(Math.PI / 2), hub);
      saw.add(cap);
      group.add(saw);
      saws.push(saw);
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
    for (const gr of this.grinders) {
      for (const saw of gr.saws) saw.rotation.z -= dt * 14;
      if (gr.done || this.z > gr.z) continue;
      gr.done = true;
      const lost = Math.max(1, Math.ceil(this.squad * gr.take));
      this.squad = Math.max(0, this.squad - lost);
      const ally = this.allies[this.allies.length - 1];
      this.pop(this.cx, 0.6, gr.z, 0xff3a4a, 24);
      sfx.play('clatter');
      this.tap([60, 30, 80]);
      if (ally) this.loseAlly(ally, `GRINDER · −${lost} · ${ally.def.name.toUpperCase()} LOST`);
      else this.say(`GRINDER · −${lost}`, 0xff6a5a);
    }
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
  private paintRoad(theme: RoadTheme) {
    const t = THEMES[theme];
    const c = this.groundTex.image as HTMLCanvasElement;
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
    this.groundTex.needsUpdate = true;
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
      this.pop(e.x, 0.4, e.z, 0xff8a5a, e.big ? 6 : 3);
    }
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
    // (a rival uses the same bars: its guard where the boss's armour goes, then its health)
    const r = this.rival && this.rival.hp > 0 ? this.rival : null;
    if (r) {
      (this.hud.boss.querySelector('.sq-armour b') as HTMLElement).style.width = `${Math.max(0, (r.guard / r.guardMax) * 100)}%`;
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
    for (const e of this.enemies) {
      const s = e.big ? 2 : 1;
      const step = Math.abs(Math.sin(this.time * 9 + e.x * 3)) * 0.05;
      d.scale.setScalar(s);
      d.position.set(e.x, 0.25 * s + step, e.z);
      d.updateMatrix();
      this.foe.body.setMatrixAt(ei, d.matrix);
      this.foe.body.setColorAt(ei, e.flash > 0 ? col.setHex(0xffffff) : col.setHex(e.big ? 0x9a3a4a : 0x6a6276));
      d.position.set(e.x, 0.36 * s + step, e.z + 0.21 * s);
      d.updateMatrix();
      this.foe.eye.setMatrixAt(ei, d.matrix);
      ei++;
    }
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
        if (big < 60) this.bigShotMesh.setMatrixAt(big++, d.matrix);
      } else this.shotMesh.setMatrixAt(small++, d.matrix);
    }
    this.shotMesh.count = small;
    this.bigShotMesh.count = big;
    this.shotMesh.instanceMatrix.needsUpdate = true;
    this.bigShotMesh.instanceMatrix.needsUpdate = true;
    this.orbs.forEach((o, i) => {
      d.position.set(o.x, 0.6, o.z);
      d.updateMatrix();
      this.orbMesh.setMatrixAt(i, d.matrix);
    });
    this.orbMesh.count = this.orbs.length;
    this.orbMesh.instanceMatrix.needsUpdate = true;
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
    }
    // a rival and its guard of clones
    let gi = 0;
    if (this.rival) {
      const r = this.rival;
      r.pose.x = r.x;
      r.pose.y = -r.z;
      r.pose.vx = Math.cos(r.t * 0.9) * 2;
      r.mesh.sync(r.pose as never, this.time, dt);
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
    cam.position.lerp(new THREE.Vector3(this.cx * 0.35, 8.5, this.z + 8.5), Math.min(1, dt * 6) || 1);
    cam.lookAt(this.cx * 0.2, 0, this.z - 9);
    celify(this.scene);
    this.renderer.render(this.scene, cam);
  }
}
