import * as THREE from 'three';
import { ARENA, COLORS, MATCH } from './config';
import { MAX_SHOOTERS, slotTeam, type Drop, type Game, type Gate, type Team } from './game';

/** every robot slot: 0 you, 1-3 opponents, 4-5 your pack-mates */
const SLOTS = Array.from({ length: MAX_SHOOTERS }, (_, i) => i);
import { ShooterMesh, characterById } from './robot';
import { Stage } from './stage';
import { GATE, GATES, ITEMS, MISSILE, SHIELD, SLOWMO, WIPER } from './items';
import { hex, type Fx2D, type Glow, type Marker, type Streak } from './fx2d';
import * as sfx from './audio';

// Physics (x, y) maps to three.js (x, 0, -y): the player sits near the
// camera at +z and the opponent sits far away at -z.

const SPARKS = 220;
const AIM_DOTS = 26;
const POWER_BALLS = 16;
const GHOSTS = 5;
/** seconds a fired marble takes to blend from the barrel onto its physics path */
const LAUNCH_T = 0.18;
const SMOKE = 90;

interface Spark {
  life: number;
  max: number;
  p: THREE.Vector3;
  v: THREE.Vector3;
  color: THREE.Color;
  size: number;
  /** floaty sparks (heal pluses) ignore gravity */
  float: boolean;
}

interface Debris {
  mesh: THREE.Mesh;
  v: THREE.Vector3;
  spin: THREE.Vector3;
  smoke: number;
}

/**
 * KO aftermath. 'down': the loser slumps, sparking (between rounds and at the
 * final KO). 'explode': timed pops, then the robot flies apart (match end).
 */
interface KoState {
  mode: 'down' | 'explode';
  /** which robot */
  slot: number;
  t: number;
  pops: number;
  shattered: boolean;
  debris: Debris[];
}

interface GateMesh {
  root: THREE.Group;
  panel: THREE.MeshBasicMaterial;
  pips: THREE.Mesh[];
}

interface DropMesh {
  root: THREE.Group;
  chute: THREE.Group;
  beam: THREE.Mesh;
  marker: THREE.Mesh;
}

/** samples of past positions kept for the slow-mo trail */
const TRAIL_N = 28;

/** a vertical ribbon traced along a robot's recent path, fading toward its tail */
class Ribbon {
  mesh: THREE.Mesh;
  private pos: Float32Array;
  private col: Float32Array;
  constructor(
    scene: THREE.Scene,
    private y0: number,
    private y1: number,
    private strength: number,
  ) {
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(TRAIL_N * 2 * 3);
    this.col = new Float32Array(TRAIL_N * 2 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const idx: number[] = [];
    for (let k = 0; k < TRAIL_N - 1; k++) {
      const a = k * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(
      geo,
      // additive: dark vertex colours fade to nothing
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  update(history: { x: number }[], z: number, color: THREE.Color, fade: number) {
    for (let k = 0; k < TRAIL_N; k++) {
      const h = history[Math.min(k, history.length - 1)];
      const x = h ? h.x : 0;
      // the ribbon tapers toward its tail
      const taper = 1 - (k / TRAIL_N) * 0.6;
      const mid = (this.y0 + this.y1) / 2;
      const half = ((this.y1 - this.y0) / 2) * taper;
      this.pos.set([x, mid - half, z, x, mid + half, z], k * 6);
      const a = Math.pow(1 - k / TRAIL_N, 1.6) * this.strength * fade;
      this.col.set([color.r * a, color.g * a, color.b * a, color.r * a, color.g * a, color.b * a], k * 6);
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  }
}

/** Per-robot item effect meshes: slow-mo afterimages, light trail and thrusters, multi aura. */
class RobotFx {
  /** see-through copies of the robot's silhouette, left behind as it moves */
  ghosts: THREE.Object3D[] = [];
  ghostMats: THREE.MeshBasicMaterial[] = [];
  /** which model the ghosts were cloned from */
  ghostOf: ShooterMesh | null = null;
  history: { x: number; t: number }[] = [];
  flames: THREE.Mesh[] = [];
  aura: THREE.Mesh;
  /** wide colour ribbon and a white-hot core */
  ribbons: Ribbon[];
  /** fades the trail in and out so it never pops */
  boost = 0;

  constructor(
    private scene: THREE.Scene,
    color: number,
  ) {
    for (let i = 0; i < GHOSTS; i++) {
      this.ghostMats.push(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    }
    // thin light streaks at foot, chest and head height read as speed without hiding the robot
    this.ribbons = [new Ribbon(scene, 0.18, 0.3, 0.9), new Ribbon(scene, 0.82, 0.94, 0.7), new Ribbon(scene, 1.42, 1.5, 0.9)];
    const flameGeo = new THREE.ConeGeometry(0.16, 0.6, 8);
    flameGeo.rotateX(Math.PI);
    for (let i = 0; i < 2; i++) {
      const f = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      f.visible = false;
      scene.add(f);
      this.flames.push(f);
    }
    this.aura = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.15, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x3ef0ff, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.aura.visible = false;
    scene.add(this.aura);
  }

  /** (re)clone the ghost silhouettes from the robot's current model */
  cloneGhosts(src: ShooterMesh) {
    for (const g of this.ghosts) this.scene.remove(g);
    this.ghosts = this.ghostMats.map((mat) => {
      const c = src.root.clone(true);
      c.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.material = mat;
      });
      c.visible = false;
      this.scene.add(c);
      return c;
    });
    this.ghostOf = src;
  }
}

export class View {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(46, 9 / 16, 0.1, 140);
  /** one model per slot: player + up to three opponents */
  shooters: ShooterMesh[];
  private marbleMesh: [THREE.InstancedMesh, THREE.InstancedMesh];
  private marbleRot: THREE.Quaternion[] = [];
  private puckMeshes: THREE.Object3D[] = [];
  private puckRot: THREE.Quaternion[] = [];
  private sparkMesh: THREE.InstancedMesh;
  private sparks: Spark[] = [];
  private aimDots: THREE.InstancedMesh;
  private trauma = 0;
  private camBase = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private camGoal = new THREE.Vector3();
  private lookGoal = new THREE.Vector3();
  private snapCamera = true;
  /** debug only: fixed camera [position, lookAt] for inspecting models */
  debugCam: [THREE.Vector3Like, THREE.Vector3Like] | null = null;
  private raycaster = new THREE.Raycaster();
  private floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpV = new THREE.Vector3();
  private tmpS = new THREE.Vector3();
  private tmpC = new THREE.Color();
  private white = new THREE.Color(0xffffff);
  /** marbles leave from the barrel: per-marble offset from muzzle to physics spawn point */
  private spawnSeen = new Map<number, number>();
  private spawnOff = new Map<number, THREE.Vector3>();
  private tmpOff = new THREE.Vector3();
  private tmpMuzzle = new THREE.Vector3();
  private axis = new THREE.Vector3();
  private time = 0;
  /** game-time clock for world animation (slows with slow-mo) */
  private worldTime = 0;
  /** optional ThorVG overlay for screen-space effects */
  fx2d: Fx2D | null = null;
  /** settings: draw the player's dotted shooting line */
  showAimLine = true;
  /** settings: special effects (ThorVG overlay, sparks, smoke, afterimages) */
  fxOn = true;
  /** settings: realism (marble hops/spin/shadows, stage particles, full pixel density) */
  realismOn = true;
  private powerMeshes: THREE.Mesh[] = [];
  private trails = new Map<number, { x: number; y: number }[]>();
  private glows: Glow[] = [];
  private markers: Marker[] = [];
  private stage: Stage;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private dropMeshes = new Map<number, DropMesh>();
  private gateMeshes = new Map<number, GateMesh>();
  private missileMeshes = new Map<number, { root: THREE.Group; flame: THREE.Mesh }>();
  private missileTrails = new Map<number, { x: number; y: number }[]>();
  private ko: KoState | null = null;
  /** opponents knocked out mid-round, blowing apart while the rest fight on */
  private wrecks: KoState[] = [];
  private wiperMeshes: THREE.Mesh[] = [];
  private coverMeshes: THREE.Group[] = [];
  private pinMeshes: { root: THREE.Group; cap: THREE.MeshBasicMaterial }[] = [];
  private coverFlash: number[] = [];
  /** scripted camera: the VS intro or a replay */
  cine: { kind: 'intro' | 'replay'; t: number; shot: number; slot: number; by?: number } | null = null;
  /** each side's marble colour, from its robot */
  private teamBall: [number, number] = [characterById('angel').ball, characterById('dragon').ball];
  /** settings: chase-camera distance, down to a first-person cockpit view */
  cameraMode: 'far' | 'mid' | 'near' | 'first' = 'mid';
  private hopH: Float32Array;
  private hopV: Float32Array;
  private shadows: THREE.InstancedMesh;
  private streaks: Streak[] = [];
  private shields: THREE.Mesh[] = [];
  private shieldFlash = [0, 0];
  private robotFx: RobotFx[];
  /** damage smoke: soft grey puffs that rise, drift and swell */
  private smokeMesh!: THREE.InstancedMesh;
  private smoke: { life: number; max: number; p: THREE.Vector3; v: THREE.Vector3; size: number; shade: number }[] = [];
  private smokeTimer = [0, 0];

  constructor(
    private host: HTMLElement,
    /** what to draw; swapped for a ReplayGame during quick replays */
    public game: Game,
  ) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new THREE.WebGLRenderer({ antialias: dpr < 2, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(dpr);
    host.appendChild(this.renderer.domElement);

    this.hemi = new THREE.HemisphereLight(0xdfe4ff, 0x2a1d4a, 1.6);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.9);
    this.sun.position.set(4, 12, 6);
    this.scene.add(this.hemi, this.sun);

    this.stage = new Stage('space');
    this.applyStage();

    this.shooters = SLOTS.map((i) => new ShooterMesh(slotTeam(i) === 0 ? 'angel' : 'dragon', this.teamBall[slotTeam(i)]));
    for (const s of this.shooters) this.scene.add(s.root);
    this.robotFx = SLOTS.map((i) => new RobotFx(this.scene, this.teamBall[slotTeam(i)]));
    this.hopH = new Float32Array(MATCH.marblePool);
    this.hopV = new Float32Array(MATCH.marblePool);
    // soft contact shadows under every marble
    this.shadows = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }),
      MATCH.marblePool,
    );
    this.shadows.frustumCulled = false;
    this.scene.add(this.shadows);
    this.smokeMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.34, depthWrite: false, flatShading: true }),
      SMOKE,
    );
    this.smokeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.smokeMesh.frustumCulled = false;
    this.smokeMesh.setColorAt(0, new THREE.Color());
    this.scene.add(this.smokeMesh);
    for (let i = 0; i < SMOKE; i++) this.smoke.push({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), size: 0.2, shade: 0.4 });
    // energy shields: a curved, hex-patterned wall in front of each robot
    const hexTex = this.makeHexTexture();
    for (const i of SLOTS) {
      const arc = Math.PI * 0.75;
      const geo = new THREE.CylinderGeometry(1.15, 1.15, 1.9, 24, 1, true, Math.PI - arc / 2, arc);
      const mat = new THREE.MeshBasicMaterial({ color: this.teamBall[slotTeam(i)], map: hexTex, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.shields.push(mesh);
    }

    // marbles: one instanced mesh per team, hidden instances scaled to 0
    const marbleGeo = new THREE.SphereGeometry(1, 16, 12);
    this.marbleMesh = this.teamBall.map((c) => {
      const mat = new THREE.MeshPhongMaterial({ color: c, shininess: 90, specular: 0xffffff });
      const mesh = new THREE.InstancedMesh(marbleGeo, mat, MATCH.marblePool);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      return mesh;
    }) as unknown as [THREE.InstancedMesh, THREE.InstancedMesh];
    for (let i = 0; i < MATCH.marblePool; i++) this.marbleRot.push(new THREE.Quaternion());

    // super and dragon balls: unlit, over-bright cores so they read as glowing
    const powerGeo = new THREE.SphereGeometry(1, 20, 14);
    for (let i = 0; i < POWER_BALLS; i++) {
      const mesh = new THREE.Mesh(powerGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
      mesh.visible = false;
      this.scene.add(mesh);
      this.powerMeshes.push(mesh);
    }

    this.buildObstacleMeshes();

    // sparks
    this.sparkMesh = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      SPARKS,
    );
    this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sparkMesh.frustumCulled = false;
    this.sparkMesh.setColorAt(0, new THREE.Color());
    this.scene.add(this.sparkMesh);
    for (let i = 0; i < SPARKS; i++) {
      this.sparks.push({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), color: new THREE.Color(), size: 0.05, float: false });
    }

    // dotted aim guide
    this.aimDots = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }),
      AIM_DOTS,
    );
    this.aimDots.frustumCulled = false;
    this.scene.add(this.aimDots);

    this.resize();
  }

  // ---------- stage ----------

  setStage(id: string) {
    if (this.stage.def.id === id) return;
    this.scene.remove(this.stage.group);
    this.stage.dispose();
    this.stage = new Stage(id);
    this.applyStage();
  }

  private applyStage() {
    const d = this.stage.def;
    this.scene.add(this.stage.group);
    this.renderer.setClearColor(d.sky);
    this.scene.fog = new THREE.Fog(d.fog[0], d.fog[1], d.fog[2]);
    this.hemi.color.set(d.hemi[0]);
    this.hemi.groundColor.set(d.hemi[1]);
    this.hemi.intensity = d.hemi[2];
    this.sun.color.set(d.sun[0]);
    this.sun.intensity = d.sun[1];
    // pucks take the stage's theme
    for (const p of this.puckMeshes) this.scene.remove(p);
    this.puckMeshes = this.game.bumps.map((b) => {
      const m = this.stage.makePuck(b.radius);
      this.scene.add(m);
      return m;
    });
    this.puckRot = this.puckMeshes.map(() => new THREE.Quaternion());
  }

  /** Apply the realism setting's pixel density (1x when off). */
  setQuality(realism: boolean) {
    this.realismOn = realism;
    const dpr = realism ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    if (this.renderer.getPixelRatio() !== dpr) {
      this.renderer.setPixelRatio(dpr);
      this.resize();
    }
  }

  resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // narrow portrait screens need a wider lens to keep the side walls in view
    this.camera.fov = this.cameraMode === 'first' ? (w / h < 0.75 ? 74 : 62) : w / h < 0.75 ? 54 : 44;
    this.camera.updateProjectionMatrix();
    this.snapCamera = true;
  }

  /** Map a screen point to a physics-space point on the floor. */
  screenToWorld(cx: number, cy: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.floorPlane, this.tmpV);
    return hit ? { x: hit.x, y: -hit.z } : null;
  }

  /** Swap the robot models: ids[0] is the player, ids[1..3] the opponents, ids[4..5] your pack-mates. */
  setCharacters(ids: string[]) {
    const all = SLOTS.map((i) => ids[i] ?? (slotTeam(i) === 0 ? ids[0] : ids[1]) ?? 'dragon');
    this.teamBall = [characterById(all[0]).ball, characterById(all[1]).ball];
    // a mirror match keeps the opponent's marbles distinguishable
    if (all[0] === all[1]) this.teamBall[1] = 0xff5a4a;
    this.teamBall.forEach((c, i) => (this.marbleMesh[i].material as THREE.MeshPhongMaterial).color.set(c));
    this.shooters.forEach((old, i) => {
      const ball = this.teamBall[slotTeam(i)];
      (this.shields[i].material as THREE.MeshBasicMaterial).color.set(ball);
      this.robotFx[i].ghostMats.forEach((m) => m.color.set(ball));
      if (old.id === all[i] && old.ball === ball && !old.broken) return;
      this.scene.remove(old.root);
      old.dispose();
      const next = new ShooterMesh(all[i], ball);
      this.scene.add(next.root);
      this.shooters[i] = next;
    });
  }

  /** Physics-space point (x, y) at height h -> CSS pixels in the host. */
  project(x: number, y: number, h = 0.3) {
    this.tmpV.set(x, h, -y).project(this.camera);
    return { x: ((this.tmpV.x + 1) / 2) * this.host.clientWidth, y: ((1 - this.tmpV.y) / 2) * this.host.clientHeight };
  }

  /** Approximate on-screen radius in CSS pixels of a sphere at a point. */
  private screenRadius(x: number, y: number, r: number) {
    const dist = this.camera.position.distanceTo(this.tmpV.set(x, r, -y));
    return (r * this.host.clientHeight) / (2 * Math.tan((this.camera.fov * Math.PI) / 360) * dist);
  }

  shake(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  burst(x: number, y: number, color: THREE.ColorRepresentation, count: number, speed: number, opts: { h?: number; float?: boolean; size?: number } = {}) {
    if (!this.fxOn) return;
    const col = new THREE.Color(color);
    let n = 0;
    for (const s of this.sparks) {
      if (s.life > 0) continue;
      s.max = s.life = opts.float ? 0.7 + Math.random() * 0.5 : 0.25 + Math.random() * 0.3;
      s.p.set(x + (opts.float ? (Math.random() - 0.5) * 1.2 : 0), opts.h ?? 0.3, -y + (opts.float ? (Math.random() - 0.5) * 0.8 : 0));
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      if (opts.float) s.v.set(Math.cos(a) * 0.4, 1.6 + Math.random() * 1.6, Math.sin(a) * 0.4);
      else s.v.set(Math.cos(a) * sp, 2 + Math.random() * 4, Math.sin(a) * sp);
      s.color.copy(col);
      s.size = opts.size ?? 0.05 + Math.random() * 0.07;
      s.float = !!opts.float;
      if (++n >= count) break;
    }
  }

  handleFx() {
    const g = this.game;
    for (const f of g.fx) {
      switch (f.type) {
        case 'hit': {
          const color = f.team === 0 ? COLORS.player : COLORS.enemy;
          const sp = this.project(f.x, f.y, 0.6);
          if (f.power === 'super') {
            this.burst(f.x, f.y, color, 50, 12);
            this.burst(f.x, f.y, 0xffe066, 30, 9);
            this.burst(f.x, f.y, 0xffffff, 20, 7);
            this.shake(0.95);
            this.fx2d?.ring(sp.x, sp.y, hex(0xffe066), true);
            this.fx2d?.star(sp.x, sp.y, [255, 255, 255], true);
            this.fx2d?.flash(f.team === 0 ? [255, 90, 80] : [255, 245, 200], 0.3);
          } else if (f.power === 'missile') {
            this.burst(f.x, f.y, ITEMS.missile.color, 26, 8, { h: 0.9 });
            this.burst(f.x, f.y, 0xffffff, 10, 5, { h: 0.9 });
            this.shake(f.team === 0 ? 0.6 : 0.4);
            this.fx2d?.ring(sp.x, sp.y, hex(ITEMS.missile.color), true);
            this.fx2d?.star(sp.x, sp.y, [255, 255, 255]);
          } else if (f.power === 'dragon' || f.power === 'x5') {
            const c = f.power === 'x5' ? GATES.x5.color : ITEMS.dragon.color;
            this.burst(f.x, f.y, c, 30, 9);
            this.burst(f.x, f.y, 0xffe066, 14, 6);
            this.shake(0.6);
            this.fx2d?.ring(sp.x, sp.y, hex(c), true);
            this.fx2d?.star(sp.x, sp.y, hex(0xffe066));
          } else {
            this.burst(f.x, f.y, color, 14, 6);
            this.burst(f.x, f.y, 0xffffff, 6, 4);
            // both sides shake: harder when you're the one hit
            this.shake(f.team === 0 ? 0.45 : 0.3);
            this.fx2d?.ring(sp.x, sp.y, hex(f.team === 0 ? 0xff5a4f : 0xfff2b0));
            this.fx2d?.star(sp.x, sp.y, [255, 255, 255]);
          }
          break;
        }
        case 'spark':
          this.burst(f.x, f.y, 0xfff2b0, Math.round(3 + f.intensity * 6), 4);
          break;
        case 'muzzle':
          if (f.slot === 0) this.shake(0.015);
          // the opening volley of a multi-shot run is a special move too
          this.shotFlash(f.slot, g.shooters[f.slot].heavyT < 0.02);
          break;
        case 'super-fire': {
          const s = g.shooters[f.slot];
          this.shake(f.slot === 0 ? 0.35 : 0.15);
          this.shotFlash(f.slot, true);
          const sp = this.project(s.x, s.y, 1);
          this.fx2d?.ring(sp.x, sp.y, hex(0xffe066));
          break;
        }
        case 'super-ready': {
          const s = g.shooters[f.slot];
          const sp = this.project(s.x, s.y, 1);
          this.fx2d?.ring(sp.x, sp.y, hex(0xffe066));
          this.fx2d?.star(sp.x, sp.y, hex(0xffe066));
          break;
        }
        case 'pickup':
        case 'use': {
          const s = g.shooters[f.slot];
          const c = ITEMS[f.item].color;
          const sp = this.project(s.x, s.y, 1);
          this.fx2d?.ring(sp.x, sp.y, hex(c), f.type === 'use');
          this.fx2d?.star(sp.x, sp.y, hex(c));
          this.burst(s.x, s.y, c, 16, 5, { h: 1 });
          break;
        }
        case 'missile-launch': {
          const s = g.shooters[f.slot];
          this.shake(f.slot === 0 ? 0.25 : 0.1);
          // a robot launching a missile (gate conversions start mid-table)
          if (s.heavyT < 0.05) this.shotFlash(f.slot, true);
          const sp = this.project(s.x, s.y, 1);
          this.fx2d?.ring(sp.x, sp.y, hex(ITEMS.missile.color));
          break;
        }
        case 'missile-end': {
          const sp = this.project(f.x, f.y, 0.9);
          this.burst(f.x, f.y, ITEMS.missile.color, 24, 7, { h: 0.9 });
          this.burst(f.x, f.y, 0xffffff, 10, 5, { h: 0.9 });
          this.fx2d?.ring(sp.x, sp.y, hex(ITEMS.missile.color), true);
          this.fx2d?.star(sp.x, sp.y, [255, 255, 255]);
          this.shake(0.25);
          break;
        }
        case 'drop-destroyed': {
          const c = ITEMS[f.item].color;
          const sp = this.project(f.x, f.y, 0.5);
          this.burst(f.x, f.y, c, 24, 7, { h: 0.5 });
          this.burst(f.x, f.y, 0x8a90a8, 14, 5, { h: 0.5 });
          this.fx2d?.ring(sp.x, sp.y, hex(c), true);
          this.fx2d?.star(sp.x, sp.y, hex(c));
          this.shake(0.2);
          break;
        }
        case 'block': {
          this.shieldFlash[f.slot] = 1;
          const c = this.teamBall[f.slot === 0 ? 0 : 1];
          const sp = this.project(f.x, f.y, 0.8);
          this.fx2d?.ring(sp.x, sp.y, hex(c), f.heavy);
          this.burst(f.x, f.y, c, f.heavy ? 18 : 6, 4, { h: 0.8 });
          this.shake(f.slot === 0 ? (f.heavy ? 0.3 : 0.08) : 0.05);
          break;
        }
        case 'shield-break': {
          const s = g.shooters[f.slot];
          const c = this.teamBall[f.slot === 0 ? 0 : 1];
          const sp = this.project(s.x, s.y, 1);
          this.burst(s.x, s.y + s.forward * 0.9, c, 40, 8, { h: 1 });
          this.burst(s.x, s.y + s.forward * 0.9, 0xffffff, 16, 6, { h: 1 });
          this.fx2d?.ring(sp.x, sp.y, hex(c), true);
          this.fx2d?.star(sp.x, sp.y, hex(c), true);
          this.shake(f.slot === 0 ? 0.55 : 0.2);
          break;
        }
        case 'eliminated':
          this.wrecks.push({ mode: 'explode', slot: f.slot, t: 0.4, pops: 2, shattered: false, debris: [] });
          break;
        case 'wiper': {
          const sp = this.project(f.x, f.y, 0.6);
          this.burst(f.x, f.y, ITEMS.wiper.color, 8, 4, { h: 0.6 });
          this.fx2d?.ring(sp.x, sp.y, hex(ITEMS.wiper.color));
          break;
        }
        case 'pin': {
          const sp = this.project(f.x, f.y, 0.5);
          this.fx2d?.tick(sp.x, sp.y, 1);
          this.burst(f.x, f.y, 0xbff8ff, 3, 2, { h: 0.5 });
          break;
        }
        case 'cover-hit':
          this.coverFlash[f.idx] = 1;
          this.burst(f.x, f.y, 0xd8dde8, 5, 3, { h: 0.4 });
          break;
        case 'cover-break': {
          const sp = this.project(f.x, f.y, 0.4);
          this.burst(f.x, f.y, 0xd8dde8, 30, 7, { h: 0.4 });
          this.burst(f.x, f.y, 0xffd27a, 12, 5, { h: 0.4 });
          this.fx2d?.ring(sp.x, sp.y, [220, 225, 235], true);
          this.shake(0.2);
          break;
        }
        case 'clack': {
          const sp = this.project(f.x, f.y, 0.3);
          this.fx2d?.tick(sp.x, sp.y, Math.min(1, f.intensity));
          break;
        }
        case 'gate-pass': {
          const c = GATES[f.gate].color;
          const sp = this.project(f.x, f.y, 0.6);
          this.fx2d?.ring(sp.x, sp.y, hex(c));
          this.fx2d?.star(sp.x, sp.y, hex(c));
          this.burst(f.x, f.y, c, 14, 5, { h: 0.6 });
          this.shake(0.12);
          break;
        }
        case 'gate-break': {
          const c = GATES[f.gate].color;
          const sp = this.project(f.x, f.y, 1);
          this.fx2d?.ring(sp.x, sp.y, hex(c), true);
          this.burst(f.x, f.y, c, 30, 8, { h: 1 });
          break;
        }
        case 'heal': {
          const s = g.shooters[f.slot];
          // rising green motes
          this.burst(s.x, s.y, ITEMS.heal.color, 40, 1, { h: 0.4, float: true, size: 0.09 });
          break;
        }
      }
    }
    g.fx.length = 0;
  }

  /** how fast a robot (or the world, slot -1) is running right now: slow-mo slows all but its user */
  private rate(slot: number) {
    const g = this.game;
    if (!(g.slowT > 0)) return 1;
    return slot >= 0 && slot === g.slowOwner ? SLOWMO.owner : SLOWMO.world;
  }

  render(dt: number, showAim: boolean) {
    const g = this.game;
    this.time += dt;
    // world animation (marbles, scenery, missiles, sparks) follows game time
    const wdt = dt * this.rate(-1);
    this.worldTime += wdt;
    this.glows.length = 0;
    this.handleFx();
    this.stage.update(wdt, this.worldTime);
    this.stage.setParticles(this.realismOn);

    g.shooters.forEach((s, i) => {
      const sm = this.shooters[i];
      if (!sm) return;
      // knocked-out pack members leave only their wreck behind
      sm.root.visible = s.active && !s.out;
      if (sm.root.visible && !sm.broken) sm.sync(s, this.time, dt * this.rate(i));
      // your pack-mates stand beside the chase camera: see-through so they never wall off the view
      if (i >= 4) sm.setGhost(this.cine || this.ko || this.cameraMode === 'first' ? 1 : 0.38);
    });
    this.updateKo(dt);
    this.updateRobotFx(dt);
    this.updateShields(dt);
    this.updateSmoke(dt);
    this.updateRailStops(dt);
    // first person: hide your own robot so it doesn't block the view
    this.shooters[0].root.visible = this.cameraMode !== 'first' || !!this.ko || !!this.cine;
    this.updateMissiles(wdt);
    this.updateObstacles(dt);
    this.updateDrops();
    this.updateGates();

    // marbles + visual rolling
    const counts = [0, 0];
    let powerCount = 0;
    this.streaks.length = 0;
    const seen = new Set<number>();
    for (const m of g.marbles) {
      if (!m.active) {
        this.hopH[m.idx] = this.hopV[m.idx] = 0;
        continue;
      }
      if (m.kind !== 'normal') {
        const p = m.body.translation();
        const mesh = this.powerMeshes[powerCount++];
        const dragon = m.kind === 'dragon';
        const gold = m.kind === 'x5';
        if (mesh) {
          mesh.visible = true;
          mesh.position.set(p.x, m.radius + this.hop(m.idx, m, wdt), -p.y);
          const lo = this.launchOffset(m);
          if (lo) mesh.position.add(lo);
          // shimmer between white-hot and the ball's colour
          const pulse = 0.5 + 0.5 * Math.sin(this.time * 30 + m.idx);
          const base = dragon ? ITEMS.dragon.color : gold ? GATES.x5.color : m.kind === 'boost' ? ITEMS.slowmo.color : this.teamBall[m.team];
          (mesh.material as THREE.MeshBasicMaterial).color.set(base).lerp(this.tmpC.set(0xffffff), pulse * 0.5);
          mesh.scale.setScalar(m.radius * (1 + pulse * 0.08));
        }
        const sp = this.project(p.x, p.y, m.radius);
        const trail = this.trails.get(m.idx) ?? [];
        trail.unshift(sp);
        if (trail.length > (dragon ? 14 : 10)) trail.length = dragon ? 14 : 10;
        this.trails.set(m.idx, trail);
        seen.add(m.idx);
        const glowColor = dragon ? ITEMS.dragon.color : gold ? GATES.x5.color : m.kind === 'boost' ? ITEMS.slowmo.color : this.teamBall[m.team];
        // the 2D glow draws over everything, so hold it until the ball has cleared the robot that fired it
        if (this.leavingBarrel(m)) continue;
        this.glows.push({ x: sp.x, y: sp.y, r: this.screenRadius(p.x, p.y, m.radius), color: hex(glowColor), trail: trail.slice(1) });
        continue;
      }
      const p = m.body.translation();
      const v = m.body.linvel();
      const q = this.marbleRot[m.idx];
      const speed = Math.hypot(v.x, v.y);
      if (this.realismOn && speed > 0.01) {
        // roll around the axis perpendicular to travel on the floor
        this.axis.set(-v.y, 0, -v.x).normalize();
        this.tmpQ.setFromAxisAngle(this.axis, (speed * wdt) / m.radius);
        q.premultiply(this.tmpQ);
      }
      const h = this.hop(m.idx, m, wdt);
      this.tmpV.set(p.x, m.radius + h, -p.y);
      const lo = this.launchOffset(m);
      if (lo) this.tmpV.add(lo);
      this.tmpS.setScalar(m.radius);
      this.tmpM.compose(this.tmpV, q, this.tmpS);
      const mesh = this.marbleMesh[m.team];
      mesh.setMatrixAt(counts[m.team]++, this.tmpM);
      // fast marbles get a ThorVG motion streak
      if (this.fxOn && speed > 11 && !this.leavingBarrel(m)) {
        const a = this.project(p.x, p.y, m.radius + h);
        const k = Math.min(0.09, speed * 0.005);
        const b = this.project(p.x - v.x * k, p.y - v.y * k, m.radius + h);
        this.streaks.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y, w: this.screenRadius(p.x, p.y, m.radius) * 1.4, team: m.team });
      }
    }
    // contact shadows shrink and fade as a marble hops
    let shadowN = 0;
    for (const m of g.marbles) {
      if (!m.active) continue;
      const p = m.body.translation();
      const h = this.hopH[m.idx];
      this.tmpV.set(p.x, 0.02, -p.y);
      // the shadow follows the drawn ball while it leaves the belly
      const lo = this.spawnOff.get(m.idx);
      if (lo && m.age < LAUNCH_T) {
        const k = (1 - m.age / LAUNCH_T) ** 2;
        this.tmpV.x += lo.x * k;
        this.tmpV.z += lo.z * k;
      }
      this.tmpS.setScalar(m.radius * (1.05 - Math.min(0.5, h * 0.8)));
      this.tmpQ.identity();
      this.tmpM.compose(this.tmpV, this.tmpQ, this.tmpS);
      this.shadows.setMatrixAt(shadowN++, this.tmpM);
    }
    this.shadows.count = this.realismOn ? shadowN : 0;
    this.shadows.instanceMatrix.needsUpdate = true;
    for (const t of [0, 1] as Team[]) {
      this.marbleMesh[t].count = counts[t];
      this.marbleMesh[t].instanceMatrix.needsUpdate = true;
    }
    for (let i = powerCount; i < this.powerMeshes.length; i++) this.powerMeshes[i].visible = false;
    for (const idx of this.trails.keys()) if (!seen.has(idx)) this.trails.delete(idx);

    // pucks: round ones roll, barrels just turn
    const rolls = this.stage.def.id !== 'city';
    g.bumps.forEach((b, i) => {
      const mesh = this.puckMeshes[i];
      if (!mesh) return;
      mesh.visible = b.active;
      if (!b.active) return;
      const p = b.body.translation();
      mesh.position.set(p.x, 0, -p.y);
      if (rolls && this.realismOn) {
        const v = b.body.linvel();
        const speed = Math.hypot(v.x, v.y);
        if (speed > 0.01) {
          this.axis.set(-v.y, 0, -v.x).normalize();
          this.tmpQ.setFromAxisAngle(this.axis, (speed * wdt) / b.radius);
          this.puckRot[i].premultiply(this.tmpQ);
        }
        mesh.quaternion.copy(this.puckRot[i]);
      } else {
        mesh.rotation.y = b.body.rotation();
      }
    });

    this.updateSparks(wdt);
    this.updateShotFx(dt);
    this.updateAimDots(showAim && this.showAimLine);
    this.followPlayer(dt);

    // camera shake: trauma squared drives offset and roll
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    const sh = this.trauma * this.trauma;
    const t = this.time * 40;
    this.camera.position.set(
      this.camBase.x + Math.sin(t * 1.1) * sh * 0.7,
      this.camBase.y + Math.sin(t * 1.7 + 1) * sh * 0.5,
      this.camBase.z + Math.sin(t * 1.3 + 2) * sh * 0.4,
    );
    this.camera.lookAt(this.camLook);
    if (this.debugCam) {
      this.camera.position.copy(this.debugCam[0]);
      this.camera.lookAt(this.tmpV.copy(this.debugCam[1]));
    }
    this.camera.rotateZ(Math.sin(t * 0.9) * sh * 0.04);

    this.renderer.render(this.scene, this.camera);
    // point the player at crates dropping on their rail, even off-screen
    this.markers.length = 0;
    const w = this.host.clientWidth;
    for (const d of g.drops) {
      if (d.team !== 0) continue;
      const sp = this.project(d.x, -ARENA.railY, d.h + 0.32);
      const margin = 26;
      const edge = sp.x < margin ? -1 : sp.x > w - margin ? 1 : 0;
      this.markers.push({ x: Math.max(margin, Math.min(w - margin, sp.x)), y: edge ? Math.min(sp.y, this.host.clientHeight * 0.72) : sp.y, color: hex(ITEMS[d.type].color), edge });
    }
    if (this.fxOn) this.fx2d?.render(dt, this.glows, g.slowT > 0 && g.slowOwner === 0, this.markers, this.streaks, this.teamBall);
    else {
      this.fx2d?.clearQueued();
      this.fx2d?.render(dt, [], false, [], [], this.teamBall);
    }
  }

  private updateSparks(dt: number) {
    let sc = 0;
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (!s.float) s.v.y -= 18 * dt;
      s.p.addScaledVector(s.v, dt);
      if (s.p.y < 0.03) {
        s.p.y = 0.03;
        s.v.y *= -0.4;
      }
      const k = Math.max(0, s.life / s.max);
      this.tmpS.setScalar(s.size * (0.4 + k));
      this.tmpQ.identity();
      this.tmpM.compose(s.p, this.tmpQ, this.tmpS);
      this.sparkMesh.setMatrixAt(sc, this.tmpM);
      this.sparkMesh.setColorAt(sc, s.color);
      sc++;
    }
    this.sparkMesh.count = sc;
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
  }

  /** Slow-mo user: silhouette afterimages, a light trail along its path, thrusters. Multi-shot aura. */
  private updateRobotFx(dt: number) {
    const g = this.game;
    g.shooters.forEach((s, i) => {
      const fx = this.robotFx[i];
      const sm = this.shooters[i];
      // in slow-mo the robot that triggered it streaks through a frozen world
      const boosted = !!g.slowT && g.slowOwner === i && s.alive && this.fxOn;
      fx.boost = Math.max(0, Math.min(1, fx.boost + (boosted ? dt * 6 : -dt * 3)));
      fx.history.unshift({ x: s.x, t: this.time });
      if (fx.history.length > TRAIL_N) fx.history.length = TRAIL_N;

      // light trail: visible while the robot is (or was just) moving
      const spread = Math.abs(fx.history[fx.history.length - 1].x - s.x);
      const trailOn = fx.boost > 0 && spread > 0.05;
      const ball = this.tmpC.set(this.teamBall[slotTeam(i)]);
      fx.ribbons.forEach((r, k) => {
        r.mesh.visible = trailOn;
        if (trailOn) r.update(fx.history, -s.y + (s.team === 0 ? 0.12 : -0.12), k === 1 ? this.white : ball, fx.boost);
      });

      // afterimages: ghostly copies of the robot at points along the path
      if (boosted && sm && fx.ghostOf !== sm) fx.cloneGhosts(sm);
      fx.ghosts.forEach((ghost, k) => {
        const h = fx.history[(k + 1) * 5];
        const show = fx.boost > 0 && !!h && Math.abs(h.x - s.x) > 0.2 && !!sm && sm.root.visible;
        ghost.visible = show;
        if (!show || !sm) return;
        ghost.position.set(h.x, sm.root.position.y, -s.y);
        ghost.rotation.copy(sm.root.rotation);
        fx.ghostMats[k].opacity = 0.2 * (1 - k / GHOSTS) * fx.boost;
      });
      fx.flames.forEach((f, k) => {
        f.visible = boosted;
        if (!boosted) return;
        f.position.set(s.x + (k ? 0.27 : -0.27), 0.25, -s.y + s.forward * 0.45);
        f.scale.set(1, 0.7 + Math.random() * 0.6, 1);
      });
      if (boosted && Math.abs(s.vx) > 1) this.burst(s.x, s.y, 0xfff2b0, 1, 1.5, { h: 0.1 });
      fx.aura.visible = s.multiT > 0;
      if (fx.aura.visible) {
        fx.aura.position.set(s.x, 0.05, -s.y);
        fx.aura.rotation.y += dt * 3;
        const pulse = 1 + Math.sin(this.time * 10) * 0.08;
        fx.aura.scale.set(pulse, 1, pulse);
      }
    });
  }

  /** Crates under parachutes, a beacon beam and a landing marker. */
  private updateDrops() {
    const live = new Set<number>();
    for (const d of this.game.drops) {
      live.add(d.id);
      let dm = this.dropMeshes.get(d.id);
      if (!dm) {
        dm = this.makeDrop(d);
        this.dropMeshes.set(d.id, dm);
      }
      const y = d.team === 0 ? ARENA.railY : -ARENA.railY;
      const sway = d.h > 0 ? Math.sin(this.time * 2 + d.id) * 0.15 : 0;
      dm.root.position.set(d.x + sway, d.h + 0.32, y);
      dm.root.rotation.y = this.time * (d.h > 0 ? 0.6 : 1.5);
      dm.chute.visible = d.h > 0.2;
      dm.beam.visible = d.h > 0;
      dm.beam.position.set(d.x, 6, y);
      dm.marker.position.set(d.x, 0.04, y);
      const pulse = 1 + Math.sin(this.time * 6) * 0.12;
      dm.marker.scale.set(pulse, 1, pulse);
      // blink before vanishing
      dm.root.visible = d.h > 0 || d.life > 2 || Math.sin(this.time * 20) > 0;
    }
    for (const [id, dm] of this.dropMeshes) {
      if (live.has(id)) continue;
      this.scene.remove(dm.root, dm.beam, dm.marker);
      this.dropMeshes.delete(id);
    }
  }

  /** Visual hop height for a marble: impacts kick it up, gravity brings it down. */
  /**
   * Physics fires marbles from a point on the floor ahead of the robot. For their first
   * moments draw them coming out of the actual barrel (chest cannon, arm, mouth), then
   * ease them onto their real path.
   */
  private launchOffset(m: { idx: number; radius: number; spawnOrder?: number; age?: number; owner?: number; body: { translation: () => { x: number; y: number } } }) {
    if (m.spawnOrder === undefined || m.age === undefined || m.owner === undefined) return null;
    if (this.spawnSeen.get(m.idx) !== m.spawnOrder) {
      this.spawnSeen.set(m.idx, m.spawnOrder);
      this.spawnOff.delete(m.idx);
      const sm = this.shooters[m.owner];
      // only fresh shots from a robot (gate splits and revived balls start where they are)
      if (sm && sm.root.visible && !sm.broken && m.age < 0.06) {
        const p = m.body.translation();
        const w = sm.muzzleWorld(this.tmpMuzzle);
        const off = new THREE.Vector3(w.x - p.x, Math.max(0, w.y - m.radius), w.z + p.y);
        if (Math.hypot(off.x, off.z) < 1.8) this.spawnOff.set(m.idx, off);
      }
    }
    const off = this.spawnOff.get(m.idx);
    if (!off || m.age >= LAUNCH_T) return null;
    const k = (1 - m.age / LAUNCH_T) ** 2;
    return this.tmpOff.copy(off).multiplyScalar(k);
  }

  /**
   * True while a fresh shot is still beside the robot that fired it. Overlay effects
   * (streaks, glows) skip it then: they are drawn on top of the 3D scene and would
   * show through the robot.
   */
  private leavingBarrel(m: { idx: number; age?: number; spawnOrder?: number }) {
    if (m.age === undefined || m.spawnOrder === undefined) return false;
    return m.age < 0.24 && this.spawnSeen.get(m.idx) === m.spawnOrder;
  }

  private hop(idx: number, m: { hop: number }, dt: number) {
    if (!this.realismOn) {
      m.hop = 0;
      this.hopH[idx] = this.hopV[idx] = 0;
      return 0;
    }
    if (m.hop > 0) {
      this.hopV[idx] = Math.max(this.hopV[idx], Math.sqrt(2 * 22 * m.hop));
      m.hop = 0;
    }
    if (this.hopH[idx] > 0 || this.hopV[idx] > 0) {
      this.hopV[idx] -= 22 * dt;
      this.hopH[idx] += this.hopV[idx] * dt;
      if (this.hopH[idx] <= 0) {
        this.hopH[idx] = 0;
        // small bounces die out quickly
        this.hopV[idx] = this.hopV[idx] < -1.2 ? -this.hopV[idx] * 0.35 : 0;
      }
    }
    return this.hopH[idx];
  }

  private makeHexTexture() {
    const cvs = document.createElement('canvas');
    cvs.width = 128;
    cvs.height = 128;
    const c = cvs.getContext('2d')!;
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.fillRect(0, 0, 128, 128);
    c.strokeStyle = '#ffffff';
    c.lineWidth = 3;
    const r = 16;
    for (let row = -1; row < 6; row++)
      for (let col = -1; col < 6; col++) {
        const x = col * r * 1.5;
        const y = row * r * Math.sqrt(3) + (col % 2 ? (r * Math.sqrt(3)) / 2 : 0);
        c.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        c.closePath();
        c.stroke();
      }
    const tex = new THREE.CanvasTexture(cvs);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 2);
    return tex;
  }

  /** Shield walls: shown while raised, flicker as energy runs low, flash on blocks. */
  private railTimer = 0;
  /** Pushing into a rail end: the robot shudders against the wall, with sparks and a clank. */
  private updateRailStops(dt: number) {
    const s = this.game.shooters[0];
    this.railTimer -= dt;
    if (!s.railPush || this.shooters[0].broken) return;
    this.shooters[0].root.position.x += (Math.random() - 0.5) * 0.05;
    if (this.railTimer <= 0) {
      this.railTimer = 0.28;
      const wx = s.railPush * (ARENA.width / 2 - 0.05);
      this.burst(wx, s.y, 0xfff2b0, 5, 3, { h: 0.5 });
      sfx.play('wall', 0.7);
    }
  }

  /** Robots at 30% health or less trail smoke; under 15% they also spit sparks. */
  private updateSmoke(dt: number) {
    if (!this.fxOn) {
      this.smokeMesh.count = 0;
      for (const p of this.smoke) p.life = 0;
      return;
    }
    this.game.shooters.forEach((s, i) => {
      if (!s.active || s.out || this.shooters[i].broken || s.health <= 0) return;
      const frac = s.health / s.maxHealth;
      if (frac > 0.3) return;
      // thicker smoke the closer to empty
      const rate = 4 + (1 - frac / 0.3) * 8;
      this.smokeTimer[i] -= dt;
      while (this.smokeTimer[i] <= 0) {
        this.smokeTimer[i] += 1 / rate;
        const p = this.smoke.find((q) => q.life <= 0);
        if (!p) break;
        p.max = p.life = 1.1 + Math.random() * 0.9;
        // rise from the back of the robot and drift backwards, away from the lane it shoots down
        p.p.set(s.x + (Math.random() - 0.5) * 0.6, 1.2 + Math.random() * 0.5, -s.y + s.forward * 0.35);
        p.v.set((Math.random() - 0.5) * 0.35, 1.2 + Math.random() * 0.7, s.forward * (0.5 + Math.random() * 0.4));
        p.size = 0.09 + Math.random() * 0.07;
        p.shade = 0.18 + Math.random() * 0.22;
      }
      if (frac < 0.15 && Math.random() < dt * 6) {
        this.burst(s.x + (Math.random() - 0.5) * 0.8, s.y, Math.random() < 0.5 ? 0xffd27a : 0xff7a2a, 3, 3, { h: 1.2 });
      }
    });
    let n = 0;
    for (const p of this.smoke) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.p.addScaledVector(p.v, dt);
      p.v.x += Math.sin(this.time * 1.7 + p.p.y) * dt * 0.3; // lazy drift
      const k = 1 - Math.max(0, p.life) / p.max; // 0 -> 1 over its life
      // swell as it rises, shrink away at the end
      this.tmpS.setScalar(p.size * (1 + k * 1.8) * (k > 0.8 ? (1 - k) * 5 : 1));
      this.tmpQ.setFromAxisAngle(this.axis.set(0, 1, 0), k * 2);
      this.tmpM.compose(p.p, this.tmpQ, this.tmpS);
      this.smokeMesh.setMatrixAt(n, this.tmpM);
      this.smokeMesh.setColorAt(n, this.tmpC.setScalar(p.shade + k * 0.25));
      n++;
    }
    this.smokeMesh.count = n;
    this.smokeMesh.instanceMatrix.needsUpdate = true;
    if (this.smokeMesh.instanceColor) this.smokeMesh.instanceColor.needsUpdate = true;
  }

  private updateShields(dt: number) {
    this.game.shooters.forEach((s, i) => {
      const mesh = this.shields[i];
      this.shieldFlash[i] = Math.max(0, this.shieldFlash[i] - dt * 4);
      mesh.visible = s.active && !s.out && s.shieldUp && !this.shooters[i].broken;
      if (!mesh.visible) return;
      mesh.position.set(s.x, 0.95, -s.y);
      mesh.rotation.y = s.team === 0 ? 0 : Math.PI;
      const low = s.shield / SHIELD.max < 0.3;
      const flicker = low && Math.random() < 0.3 ? 0.15 : 1;
      (mesh.material as THREE.MeshBasicMaterial).opacity = (0.38 + this.shieldFlash[i] * 0.6) * flicker;
      const map = (mesh.material as THREE.MeshBasicMaterial).map;
      if (map) map.offset.y = (this.time * 0.3) % 1;
    });
  }

  /** Clear the wreck and rebuild a broken robot before the next match. */
  resetMatch() {
    for (const k of [this.ko, ...this.wrecks]) {
      if (!k) continue;
      for (const d of k.debris) {
        this.scene.remove(d.mesh);
        d.mesh.geometry.dispose();
      }
    }
    this.ko = null;
    this.deathT = 0;
    this.wrecks.length = 0;
    this.shooters.forEach((sm, i) => {
      if (!sm.broken) return;
      this.scene.remove(sm.root);
      sm.dispose();
      const next = new ShooterMesh(sm.id, this.teamBall[slotTeam(i)]);
      this.scene.add(next.root);
      this.shooters[i] = next;
    });
    for (const [id, mm] of this.missileMeshes) {
      this.scene.remove(mm.root);
      this.missileMeshes.delete(id);
    }
    this.snapCamera = true;
  }

  /** The losing robot sputters, pops three times, then blows apart. */
  private updateKo(dt: number) {
    const g = this.game;
    if (!this.ko && (g.phase === 'ko' || g.phase === 'over') && (g.winner === 0 || g.winner === 1)) {
      this.ko = { mode: 'down', slot: this.loserSlot(), t: 0, pops: 0, shattered: false, debris: [] };
    }
    for (const w of this.wrecks) this.stepExplode(w, dt);
    const ko = this.ko;
    if (!ko) return;
    if (ko.mode === 'down') {
      this.updateDown(ko, dt);
      return;
    }
    this.stepExplode(ko, dt);
  }

  /** the robot that lost the round: the player, or the last opponent standing */
  loserSlot() {
    const g = this.game;
    // the losing team's last robot standing (a draw counts against your side)
    const team = g.winner === 0 ? 1 : 0;
    const last = g.shooters.find((s) => s.team === team && s.active && !s.out);
    return last ? last.slot : team === 0 ? 0 : 1;
  }

  /** pops, then the robot blows apart into tumbling, smoking debris */
  private stepExplode(ko: KoState, dt: number) {
    const g = this.game;
    // run the sequence a little slow for drama
    const sdt = dt * 0.6;
    ko.t += sdt;
    const l = g.shooters[ko.slot];
    const color = slotTeam(ko.slot) === 0 ? COLORS.player : COLORS.enemy;
    const sp = () => this.project(l.x, l.y, 1);
    // three pops from different spots on the body
    const popAt = [0.05, 0.3, 0.55];
    while (ko.pops < popAt.length && ko.t >= popAt[ko.pops]) {
      sfx.play('pop', 0.8 + ko.pops * 0.1);
      const ox = (Math.random() - 0.5) * 1.2;
      this.burst(l.x + ox, l.y, 0xffd27a, 18, 6, { h: 0.6 + Math.random() });
      this.burst(l.x + ox, l.y, color, 10, 5, { h: 1 });
      const p = sp();
      this.fx2d?.ring(p.x + ox * 20, p.y, hex(0xffd27a));
      this.fx2d?.star(p.x + ox * 20, p.y, [255, 255, 255]);
      this.shake(0.35);
      ko.pops++;
    }
    if (!ko.shattered && ko.t >= 0.85) {
      ko.shattered = true;
      sfx.play('explode');
      setTimeout(() => sfx.play('clatter', 0.9), 650);
      setTimeout(() => sfx.play('clatter', 0.6), 1300);
      const sm = this.shooters[ko.slot];
      sm.root.visible = true;
      const centre = new THREE.Vector3(l.x, 0.9, -l.y);
      for (const mesh of sm.shatter(this.scene)) {
        const out = mesh.getWorldPosition(new THREE.Vector3()).sub(centre);
        out.y = Math.max(0.2, out.y);
        out.normalize();
        const v = out.multiplyScalar(2 + Math.random() * 4.5);
        v.y += 2.5 + Math.random() * 4;
        const spin = new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
        ko.debris.push({ mesh, v, spin, smoke: Math.random() * 0.3 });
      }
      this.burst(l.x, l.y, 0xffffff, 40, 12, { h: 1 });
      this.burst(l.x, l.y, 0xff8a2a, 50, 10, { h: 0.8 });
      this.burst(l.x, l.y, color, 30, 9, { h: 1.2 });
      const p = sp();
      this.fx2d?.ring(p.x, p.y, hex(0xffd27a), true);
      this.fx2d?.ring(p.x, p.y, hex(color), true);
      this.fx2d?.star(p.x, p.y, [255, 255, 255], true);
      this.fx2d?.flash([255, 240, 210], 0.45);
      this.shake(1);
    }
    // tumbling debris with gravity, floor bounces and smoke
    for (const d of ko.debris) {
      d.v.y -= 16 * sdt;
      d.mesh.position.addScaledVector(d.v, sdt);
      d.mesh.rotation.x += d.spin.x * sdt;
      d.mesh.rotation.y += d.spin.y * sdt;
      d.mesh.rotation.z += d.spin.z * sdt;
      if (d.mesh.position.y < 0.06) {
        d.mesh.position.y = 0.06;
        d.v.y *= -0.32;
        d.v.x *= 0.7;
        d.v.z *= 0.7;
        d.spin.multiplyScalar(0.6);
      }
      d.smoke -= sdt;
      if (d.smoke <= 0 && ko.t < 6) {
        d.smoke = 0.25 + Math.random() * 0.4;
        const wp = d.mesh.position;
        this.burst(wp.x, -wp.z, Math.random() < 0.3 ? 0xff8a2a : 0x6a6a74, 1, 1, { h: wp.y, float: true, size: 0.12 });
      }
    }
  }

  /** Blow the loser apart (called once the final replay is over). */
  explode(slot: number) {
    this.resetMatch();
    this.ko = { mode: 'explode', slot, t: 0, pops: 0, shattered: false, debris: [] };
  }

  /** Between rounds: the loser slumps forward, sparking and smoking. */
  private updateDown(ko: KoState, dt: number) {
    ko.t += dt * 0.6;
    const l = this.game.shooters[ko.slot];
    const sm = this.shooters[ko.slot];
    const k = Math.min(1, ko.t * 3);
    // tip toward its opponent and sink a little
    sm.root.rotation.x += (l.team === 0 ? -0.55 : 0.55) * k;
    sm.root.position.y -= 0.12 * k;
    sm.turret.rotation.z += Math.sin(ko.t * 3) * 0.05;
    const popAt = [0.04, 0.35];
    while (ko.pops < popAt.length && ko.t >= popAt[ko.pops]) {
      this.burst(l.x + (Math.random() - 0.5), l.y, 0xffd27a, 16, 5, { h: 1 });
      const p = this.project(l.x, l.y, 1);
      this.fx2d?.ring(p.x, p.y, hex(0xffd27a));
      sfx.play('pop', 0.6);
      this.shake(0.3);
      ko.pops++;
    }
    if (Math.random() < 0.25) this.burst(l.x + (Math.random() - 0.5) * 0.8, l.y, Math.random() < 0.4 ? 0xffd27a : 0x6a6a74, 1, 1.5, { h: 1.2, float: true, size: 0.1 });
  }

  /** Cover walls (crates), pinball pins and per-robot wiper bricks. */
  private buildObstacleMeshes() {
    const metal = new THREE.MeshLambertMaterial({ color: 0x8c96ac });
    const dark = new THREE.MeshLambertMaterial({ color: 0x3a4152 });
    const stripe = new THREE.MeshLambertMaterial({ color: 0xffc23d });
    for (const c of this.game.covers) {
      const g = new THREE.Group();
      const block = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.75, 0.36), metal.clone());
      block.position.y = 0.375;
      g.add(block);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.1, 0.38), dark);
      cap.position.y = 0.72;
      g.add(cap);
      for (const x of [-0.45, 0, 0.45]) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.37), stripe);
        st.position.set(x, 0.36, 0);
        st.rotation.z = 0.5;
        g.add(st);
      }
      g.visible = false;
      this.scene.add(g);
      this.coverMeshes.push(g);
      this.coverFlash[c.idx] = 0;
    }
    for (const _p of this.game.pins) {
      const root = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.5, 14), new THREE.MeshPhongMaterial({ color: 0xd8e0ee, shininess: 100 }));
      post.position.y = 0.25;
      const cap = new THREE.MeshBasicMaterial({ color: 0x3ef0ff });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 20), cap);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.48;
      root.add(post, ring);
      root.visible = false;
      this.scene.add(root);
      this.pinMeshes.push({ root, cap });
    }
    // wiper: a brick slab with a painted brick texture
    const cvs = document.createElement('canvas');
    cvs.width = 128;
    cvs.height = 48;
    const cx = cvs.getContext('2d')!;
    cx.fillStyle = '#7a4a2e';
    cx.fillRect(0, 0, 128, 48);
    cx.fillStyle = '#c8925a';
    for (let row = 0; row < 3; row++)
      for (let col = -1; col < 5; col++) cx.fillRect(col * 30 + (row % 2) * 15 + 2, row * 16 + 2, 26, 12);
    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    const brickMat = new THREE.MeshLambertMaterial({ map: tex });
    for (let i = 0; i < 4; i++) {
      const brick = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 0.28), brickMat);
      brick.visible = false;
      this.scene.add(brick);
      this.wiperMeshes.push(brick);
    }
  }

  private updateObstacles(dt: number) {
    const g = this.game;
    g.covers?.forEach((c, i) => {
      const m = this.coverMeshes[i];
      if (!m) return;
      m.visible = c.active;
      if (!c.active) return;
      m.position.set(c.x, 0, -c.y);
      // darkens as it takes hits, flashes white on each one
      this.coverFlash[c.idx] = Math.max(0, this.coverFlash[c.idx] - dt * 5);
      const block = m.children[0] as THREE.Mesh;
      const mat = block.material as THREE.MeshLambertMaterial;
      const wear = c.hp / 5;
      mat.color.setRGB(0.35 + 0.2 * wear, 0.38 + 0.21 * wear, 0.45 + 0.22 * wear);
      mat.emissive.setScalar(this.coverFlash[c.idx] * 0.6);
      m.rotation.z = c.hp < 3 ? Math.sin(this.time * 40) * 0.01 * this.coverFlash[c.idx] : 0;
    });
    g.pins?.forEach((p, i) => {
      const pm = this.pinMeshes[i];
      if (!pm) return;
      pm.root.visible = p.active;
      pm.root.position.set(p.x, 0, -p.y);
      pm.cap.color.set(p.glow > 0 ? 0xffffff : 0x3ef0ff);
    });
    g.shooters.forEach((s, i) => {
      const brick = this.wiperMeshes[i];
      if (!brick) return;
      brick.visible = s.alive && s.wiperT > 0;
      if (!brick.visible) return;
      brick.position.set(s.wiperX(g.time ?? 0), 0.36, -(s.y + s.forward * WIPER.ahead));
      // blink in the last second
      if (s.wiperT < 1) brick.visible = Math.sin(this.time * 30) > 0;
    });
  }

  /** Homing missiles: body, fins, flickering flame, smoke and a glow trail. */
  private updateMissiles(dt: number) {
    const live = new Set<number>();
    for (const m of this.game.missiles) {
      live.add(m.id);
      let mm = this.missileMeshes.get(m.id);
      if (!mm) {
        mm = this.makeMissile(m.team);
        this.missileMeshes.set(m.id, mm);
      }
      mm.root.position.set(m.x, 0.9 + Math.sin(this.time * 6 + m.id) * 0.08, -m.y);
      // model points along -z; face the heading
      mm.root.rotation.y = Math.atan2(-Math.cos(m.heading), Math.sin(m.heading));
      mm.flame.scale.set(1, 0.7 + Math.random() * 0.7, 1);
      if (Math.random() < 0.7) this.burst(m.x - Math.cos(m.heading) * 0.5, m.y - Math.sin(m.heading) * 0.5, 0x9a9aa6, 1, 0.5, { h: 0.9, float: true, size: 0.1 });
      const sp = this.project(m.x, m.y, 0.9);
      const trail = this.missileTrails.get(m.id) ?? [];
      trail.unshift(sp);
      if (trail.length > 12) trail.length = 12;
      this.missileTrails.set(m.id, trail);
      this.glows.push({ x: sp.x, y: sp.y, r: this.screenRadius(m.x, m.y, 0.22), color: hex(ITEMS.missile.color), trail: trail.slice(1) });
    }
    for (const [id, mm] of this.missileMeshes) {
      if (live.has(id)) continue;
      this.scene.remove(mm.root);
      this.missileMeshes.delete(id);
      this.missileTrails.delete(id);
    }
    void dt;
    void MISSILE;
  }

  private makeMissile(team: Team) {
    const root = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: team === 0 ? 0xe8f4ff : 0x3a2a30 });
    const stripe = new THREE.MeshBasicMaterial({ color: ITEMS.missile.color });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.75, 10), bodyMat);
    body.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 10), new THREE.MeshLambertMaterial({ color: team === 0 ? COLORS.player : COLORS.enemy }));
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -0.52;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 10), stripe);
    band.rotation.x = Math.PI / 2;
    band.position.z = -0.2;
    root.add(body, nose, band);
    for (let k = 0; k < 4; k++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.2), bodyMat);
      fin.position.z = 0.3;
      fin.rotation.z = (k * Math.PI) / 2;
      fin.translateY(0.15);
      root.add(fin);
    }
    const flameGeo = new THREE.ConeGeometry(0.11, 0.5, 8);
    flameGeo.rotateX(-Math.PI / 2);
    flameGeo.translate(0, 0, 0.25);
    const flame = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    flame.position.z = 0.4;
    root.add(flame);
    this.scene.add(root);
    return { root, flame };
  }

  /** Holographic gates: two posts, a top bar, a label panel and charge pips. */
  private updateGates() {
    const live = new Set<number>();
    for (const g of this.game.gates) {
      live.add(g.id);
      let gm = this.gateMeshes.get(g.id);
      if (!gm) {
        gm = this.makeGate(g);
        this.gateMeshes.set(g.id, gm);
      }
      // pop in, shrink out
      const grow = Math.min(1, g.age / 0.3, Math.max(0, (g.life - g.age) / 0.3));
      gm.root.position.set(g.x, 0, -g.y);
      gm.root.scale.set(grow, grow, grow);
      // a wall gate is a solid barrier, the rest are see-through fields
      gm.panel.opacity = g.type === 'wall' ? 0.9 : 0.32 + Math.sin(this.time * 8) * 0.06;
      gm.pips.forEach((p, i) => (p.visible = i < g.charges));
    }
    for (const [id, gm] of this.gateMeshes) {
      if (live.has(id)) continue;
      this.scene.remove(gm.root);
      gm.root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          const mat = mesh.material as THREE.MeshBasicMaterial;
          mat.map?.dispose();
          mat.dispose();
        }
      });
      this.gateMeshes.delete(id);
    }
  }

  private makeGate(g: Gate): GateMesh {
    const def = GATES[g.type];
    const w = GATE.halfWidth * 2;
    const h = 1.5;
    const root = new THREE.Group();
    const frame = new THREE.MeshBasicMaterial({ color: def.color });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, 0.1), frame);
      post.position.set(side * GATE.halfWidth, h / 2, 0);
      root.add(post);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.1, 0.1), frame);
    bar.position.y = h;
    const sill = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, 0.14), frame);
    sill.position.y = 0.02;
    root.add(bar, sill);
    // translucent field + label drawn on a canvas
    const cvs = document.createElement('canvas');
    cvs.width = 256;
    cvs.height = 160;
    const c = cvs.getContext('2d')!;
    const col = '#' + def.color.toString(16).padStart(6, '0');
    const grad = c.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, col + 'cc');
    grad.addColorStop(1, col + '22');
    c.fillStyle = grad;
    c.fillRect(0, 0, 256, 160);
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    for (let y = 4; y < 160; y += 8) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(256, y);
      c.stroke();
    }
    c.font = '900 76px Orbitron, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 8;
    c.strokeStyle = 'rgba(5,9,20,0.85)';
    c.strokeText(def.label, 128, 74);
    c.fillStyle = '#ffffff';
    c.fillText(def.label, 128, 74);
    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    const panel = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
    const field = new THREE.Mesh(new THREE.PlaneGeometry(w, h), panel);
    field.position.y = h / 2;
    root.add(field);
    // one pip per remaining charge above the bar
    const pips: THREE.Mesh[] = [];
    for (let i = 0; i < def.charges; i++) {
      const pip = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), frame);
      pip.position.set((i - (def.charges - 1) / 2) * 0.3, h + 0.22, 0);
      root.add(pip);
      pips.push(pip);
    }
    this.scene.add(root);
    return { root, panel, pips };
  }

  private makeDrop(d: Drop): DropMesh {
    const c = ITEMS[d.type].color;
    const root = new THREE.Group();
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), new THREE.MeshLambertMaterial({ color: 0x2a3146 }));
    root.add(crate);
    const glow = new THREE.MeshBasicMaterial({ color: c });
    // glowing edge bands and an item-coloured core window
    for (const [w, h, dd] of [
      [0.66, 0.08, 0.66],
      [0.08, 0.66, 0.66],
      [0.66, 0.66, 0.08],
    ]) root.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), glow));
    const chute = new THREE.Group();
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
    );
    canopy.scale.set(0.9, 0.5, 0.9);
    canopy.position.y = 1.5;
    chute.add(canopy);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xdfe8ff });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.3, 4), lineMat);
      line.position.set(Math.cos(a) * 0.42, 0.95, Math.sin(a) * 0.42);
      line.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
      chute.add(line);
    }
    root.add(chute);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 12, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.75, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.scene.add(root, beam, marker);
    return { root, chute, beam, marker };
  }

  /**
   * Third-person chase camera: low and behind the player's shooter, drifting
   * with its position and leaning a little into the aim direction.
   */
  private followPlayer(dt: number) {
    if (this.cine) {
      this.cinematic(dt);
      return;
    }
    // you went down (knocked out of a pack fight, or the round's KO): rise into the sky
    const you = this.game.shooters[0];
    if ((this.ko && this.ko.slot === 0) || (!this.ko && you.active && you.out)) {
      this.ascend(dt, you);
      return;
    }
    this.deathT = 0;
    if (this.ko) {
      // KO cam: swing in on the wreck
      const l = this.game.shooters[this.ko.slot];
      // camera sits in front of the loser, a little to the side
      this.camGoal.set(l.x * 0.6 + 2.6, 4.8, -l.y + (l.team === 0 ? -8.5 : 8.5));
      this.lookGoal.set(l.x, 0.6, -l.y);
      const k = 1 - Math.exp(-dt * 2.5);
      this.camBase.lerp(this.camGoal, k);
      this.camLook.lerp(this.lookGoal, k);
      return;
    }
    const p = this.game.shooters[0];
    const lean = Math.sin(p.aim);
    // stop following near the rail ends so the robot visibly reaches the wall
    // camera follow limits grow with the table so a wide stage keeps you in shot
    const wk = ARENA.railHalfWidth / 4.1;
    const follow = (k: number, limit: number) => Math.max(-limit * wk, Math.min(limit * wk, p.x * k));
    switch (this.cameraMode) {
      case 'far':
        this.camGoal.set(follow(0.85, 2.8) - lean * 1.1, 8.4, -p.y + 8.4);
        this.lookGoal.set(p.x * 0.55 + lean * 3, 0, -p.y - 6.5);
        break;
      case 'mid':
        this.camGoal.set(follow(0.9, 3.15) - lean * 0.9, 6.4, -p.y + 6.4);
        this.lookGoal.set(follow(0.6, 2.1) + lean * 3, 0.2, -p.y - 7.5);
        break;
      case 'near':
        this.camGoal.set(follow(0.95, 3.5) - lean * 0.6, 3.8, -p.y + 3.9);
        this.lookGoal.set(follow(0.7, 2.3) + lean * 3.5, 0.5, -p.y - 8.5);
        break;
      case 'first':
        // cockpit: eye level on the robot, looking down the aim line
        this.camGoal.set(p.x, 1.8, -p.y - 0.1);
        this.lookGoal.set(p.x + Math.sin(p.aim) * 10, 0.6, -p.y - Math.cos(p.aim) * 10);
        break;
    }
    // frame-rate independent smoothing
    const k = this.snapCamera ? 1 : 1 - Math.exp(-dt * 6);
    this.camBase.lerp(this.camGoal, k);
    this.camLook.lerp(this.lookGoal, k);
    this.snapCamera = false;
  }

  private heightCache = new Map<string, number>();
  /** screen point just above a robot's head, for its floating health tag (null if hidden) */
  tagPoint(slot: number) {
    const sm = this.shooters[slot];
    const s = this.game.shooters[slot];
    if (!sm || !s || !sm.root.visible) return null;
    let h = this.heightCache.get(sm.id);
    if (h === undefined) {
      const box = new THREE.Box3().setFromObject(sm.root);
      h = box.max.y - sm.root.position.y;
      this.heightCache.set(sm.id, h);
    }
    // behind the camera (first-person, your own robot) there is nothing to tag
    this.tmpV.set(s.x, h + 0.35, -s.y).project(this.camera);
    if (this.tmpV.z > 1) return null;
    const pt = this.project(s.x, s.y, h + 0.35);
    // far fighters get smaller tags so a pack's tags don't pile up
    const scale = Math.max(0.6, Math.min(1, this.screenRadius(s.x, s.y, 1) / 60));
    return { ...pt, scale };
  }

  /** screen point at the middle of a robot's body (Smart Lock reticle), scaled by distance */
  bodyPoint(slot: number) {
    const sm = this.shooters[slot];
    const s = this.game.shooters[slot];
    if (!sm || !s || !sm.root.visible) return null;
    let h = this.heightCache.get(sm.id);
    if (h === undefined) {
      const box = new THREE.Box3().setFromObject(sm.root);
      h = box.max.y - sm.root.position.y;
      this.heightCache.set(sm.id, h);
    }
    this.tmpV.set(s.x, h * 0.5, -s.y).project(this.camera);
    if (this.tmpV.z > 1) return null;
    const pt = this.project(s.x, s.y, h * 0.5);
    return { ...pt, scale: Math.max(0.5, Math.min(1.4, this.screenRadius(s.x, s.y, 1) / 45)) };
  }

  private sizeCache = new Map<string, number>();
  /** how much bigger than a standard mech a slot's model is (1 = mech) */
  private modelScale(slot: number) {
    const m = this.shooters[slot];
    let k = this.sizeCache.get(m.id);
    if (k === undefined) {
      const size = new THREE.Box3().setFromObject(m.root).getSize(new THREE.Vector3());
      // long beasts reach toward the camera, so their length counts for more
      k = Math.max(1, Math.max(size.y, size.z * 1.4) / 2.2);
      this.sizeCache.set(m.id, k);
    }
    return k;
  }

  /** Scripted shots: orbit each fighter for the VS intro; a sweeping side cam for replays. */
  private cinematic(dt: number) {
    const c = this.cine!;
    c.t += dt;
    const p = this.game.shooters[0];
    // the opponents' shot frames the middle of the pack
    const pack = this.game.shooters.filter((s) => s.team === 1 && s.active);
    const e = { x: pack.reduce((a, s) => a + s.x, 0) / Math.max(1, pack.length), y: pack[0]?.y ?? ARENA.railY };
    const er = 3.4 * this.modelScale(pack[0]?.slot ?? 1) + (pack.length - 1) * 1.6;
    let shot = 0;
    if (c.kind === 'intro') {
      if (c.t < 1.7) {
        // orbit in front of your robot (or your whole pack), further out for the big beasts
        const own = this.game.shooters.filter((s) => s.team === 0 && s.active);
        const cx = own.reduce((a, s) => a + s.x, 0) / Math.max(1, own.length);
        const k = this.modelScale(0);
        const r = 3.4 * k + (own.length - 1) * 1.6;
        const a = -0.9 + c.t * 0.9;
        this.camGoal.set(cx + Math.sin(a) * r, (1.4 + c.t * 0.25) * k + (own.length - 1) * 0.6, -p.y - Math.cos(a) * r);
        this.lookGoal.set(cx, 1.15 * k, -p.y);
      } else if (c.t < 3.4) {
        shot = 1;
        const a = 0.9 - (c.t - 1.7) * 0.9;
        this.camGoal.set(e.x + Math.sin(a) * er, 1.4 + (c.t - 1.7) * 0.25 + (pack.length - 1) * 0.6, -e.y + Math.cos(a) * er);
        this.lookGoal.set(e.x, 1.15, -e.y);
      } else {
        // wide establishing shot of the arena
        shot = 2;
        this.camGoal.set(Math.sin(c.t * 0.4) * 3, 10, -p.y + 9);
        this.lookGoal.set(0, 0, 0);
      }
    } else {
      // replay: the loser's side, a camera beside and in front of the loser, sweeping slowly
      const l = this.game.shooters[c.slot];
      const rg = this.game as unknown as { frame?: number; shotAt?: number; ko?: number };
      const winnerShot = c.by !== undefined && c.by >= 0 && (rg.shotAt ?? -1) >= 0;
      const side = winnerShot ? 1 : Math.sin(c.t * 0.35) > 0 ? 1 : -1;
      shot = side > 0 ? 0 : 1;
      const front = l.team === 0 ? -1 : 1;
      this.camGoal.set(l.x + side * 5.5, 2.8 + Math.sin(c.t * 0.5) * 0.5, -l.y + front * (4.5 + Math.cos(c.t * 0.4) * 1.2));
      this.lookGoal.set(l.x, 0.9, -l.y + front * 1.5);
      if (winnerShot) {
        // first the winner's finishing shot, over its shoulder, then ride the shot across
        // to the loser so the impact lands on screen
        const w = this.game.shooters[c.by!];
        const dy = Math.sign(l.y - w.y) || 1;
        this.tmpV.set(w.x + 1.5, 1.9, -(w.y - dy * 3.1));
        const winLook = new THREE.Vector3(w.x * 0.7 + l.x * 0.3, 1.0, -(w.y + dy * 4.5));
        const start = rg.shotAt! + 8;
        const u = Math.max(0, Math.min(1, ((rg.frame ?? 0) - start) / Math.max(15, (rg.ko ?? start) - start)));
        const e = u * u * (3 - 2 * u);
        this.camGoal.lerpVectors(this.tmpV, this.camGoal.clone(), e);
        this.lookGoal.lerpVectors(winLook, this.lookGoal.clone(), e);
        shot = 2;
      }
    }
    // hard cut between shots, smooth within one
    const cut = shot !== c.shot;
    c.shot = shot;
    const k = cut ? 1 : 1 - Math.exp(-dt * 4);
    this.camBase.lerp(this.camGoal, k);
    this.camLook.lerp(this.lookGoal, k);
  }

  // ---------- firing effects: belly flash, and a floor shockwave for special moves ----------
  private shotFx: { mesh: THREE.Object3D; mat: THREE.SpriteMaterial | THREE.MeshBasicMaterial; t: number; life: number; size: number; ring: boolean }[] = [];
  private ringGeo = new THREE.RingGeometry(0.8, 1, 40).rotateX(-Math.PI / 2);
  /** soft round glow (white centre fading out) for camera-facing flashes */
  private flashTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();

  /** a pooled additive flash or ring */
  private takeShotFx(ring: boolean) {
    let fx = this.shotFx.find((x) => x.ring === ring && x.t >= x.life);
    if (!fx) {
      let mesh: THREE.Object3D;
      let mat: THREE.SpriteMaterial | THREE.MeshBasicMaterial;
      if (ring) {
        mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
        mesh = new THREE.Mesh(this.ringGeo, mat);
      } else {
        mat = new THREE.SpriteMaterial({ map: this.flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        mesh = new THREE.Sprite(mat);
      }
      mesh.renderOrder = 5;
      this.scene.add(mesh);
      fx = { mesh, mat, t: 0, life: 0, size: 1, ring };
      this.shotFx.push(fx);
    }
    return fx;
  }

  /** muzzle flash at the belly; special moves add a big flash, a shockwave ring and sparks */
  private shotFlash(slot: number, special: boolean) {
    const sm = this.shooters[slot];
    const s = this.game.shooters[slot];
    if (!sm || !s || !sm.root.visible || sm.broken) return;
    const at = sm.muzzleWorld(this.tmpMuzzle);
    const color = this.teamBall[slotTeam(slot)];
    const flash = this.takeShotFx(false);
    flash.t = 0;
    flash.life = special ? 0.3 : 0.12;
    flash.size = special ? 2.2 : 1.0;
    flash.mesh.position.copy(at);
    flash.mat.color.set(special ? color : 0xfff4d6).lerp(this.tmpC.set(0xffffff), special ? 0.3 : 0);
    if (!this.fxOn) return;
    // little sparks spit from the belly on every shot
    this.burst(at.x, -at.z, special ? color : 0xfff2b0, special ? 16 : 3, special ? 7 : 3.5, { h: at.y });
    if (!special) return;
    const ring = this.takeShotFx(true);
    ring.t = 0;
    ring.life = 0.55;
    ring.size = 3;
    ring.mesh.position.set(s.x, 0.05, -s.y);
    ring.mat.color.set(color);
  }

  private updateShotFx(dt: number) {
    for (const fx of this.shotFx) {
      if (fx.t >= fx.life) {
        fx.mesh.visible = false;
        continue;
      }
      fx.t += dt;
      const u = Math.min(1, fx.t / fx.life);
      fx.mesh.visible = true;
      const mat = fx.mat;
      if (fx.ring) {
        // the shockwave races out across the floor and thins away
        fx.mesh.scale.setScalar(0.3 + (1 - (1 - u) ** 3) * fx.size);
        mat.opacity = (1 - u) * 0.9;
      } else {
        // the flash pops big, then shrinks as it fades
        fx.mesh.scale.setScalar(fx.size * (u < 0.2 ? 0.55 + u * 2.25 : 1 - (u - 0.2) * 0.75));
        mat.opacity = 1 - u;
      }
    }
  }

  /** seconds since your robot went down (drives the rising death camera) */
  private deathT = 0;
  private deathFrom = new THREE.Vector3();

  /**
   * Death camera: lift off from your wreck and soar up and back into the sky,
   * slowly circling, until the whole table lies below. In a pack fight it stays
   * up there so you can watch your pack-mates carry on.
   */
  private ascend(dt: number, you: { x: number; y: number }) {
    if (this.deathT === 0) this.deathFrom.copy(this.camBase);
    this.deathT += dt;
    const u = Math.min(1, this.deathT / 3.2);
    // slow start, a long glide at the top
    const e = 1 - Math.pow(1 - u, 3);
    const wx = you.x;
    const wz = -you.y;
    const a = this.deathT * 0.18 + 0.4;
    const r = 2.4 + e * 13;
    const h = 2 + e * 24;
    // the climb starts from wherever the camera was, then circles out
    const ring = this.tmpV.set(wx * (1 - e) + Math.sin(a) * r, h, wz * (1 - e) + (wz > 0 ? 1 : -1) * Math.cos(a) * r * 0.6 + e * (wz > 0 ? 4 : -4));
    this.camGoal.copy(this.deathFrom).lerp(ring, Math.min(1, u * 1.6));
    // look from the wreck out to the middle of the table
    this.lookGoal.set(wx * (1 - e), 0.5 * (1 - e), wz * (1 - e));
    const k = 1 - Math.exp(-dt * 3);
    this.camBase.lerp(this.camGoal, k);
    this.camLook.lerp(this.lookGoal, k);
  }

  /** Dots along the predicted path, with one bounce off the side walls. */
  private updateAimDots(show: boolean) {
    const s = this.game.shooters[0];
    if (!show) {
      this.aimDots.count = 0;
      return;
    }
    const half = ARENA.width / 2 - s.stats.marbleRadius;
    const d = s.dir();
    let x = s.x + d.x * 0.95;
    let y = s.y + d.y * 0.95;
    let dx = d.x;
    const dy = d.y;
    const stepLen = 0.6;
    let bounces = 0;
    let n = 0;
    for (let i = 0; i < AIM_DOTS; i++) {
      x += dx * stepLen;
      y += dy * stepLen;
      if (Math.abs(x) > half) {
        if (bounces >= 1) break;
        x = Math.sign(x) * half * 2 - x;
        dx = -dx;
        bounces++;
      }
      if (y > ARENA.length / 2) break;
      const fade = 1 - i / AIM_DOTS;
      this.tmpV.set(x, 0.03, -y);
      this.tmpS.setScalar(0.07 + 0.04 * fade);
      this.tmpQ.identity();
      this.tmpM.compose(this.tmpV, this.tmpQ, this.tmpS);
      this.aimDots.setMatrixAt(n++, this.tmpM);
    }
    this.aimDots.count = n;
    this.aimDots.instanceMatrix.needsUpdate = true;
  }
}
