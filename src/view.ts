import * as THREE from 'three';
import { ARENA, COLORS, MATCH } from './config';
import type { Drop, Game, Gate, Team } from './game';
import { ShooterMesh, characterById } from './robot';
import { Stage } from './stage';
import { GATE, GATES, ITEMS, MISSILE, SHIELD } from './items';
import { hex, type Fx2D, type Glow, type Marker, type Streak } from './fx2d';

// Physics (x, y) maps to three.js (x, 0, -y): the player sits near the
// camera at +z and the opponent sits far away at -z.

const SPARKS = 220;
const AIM_DOTS = 26;
const POWER_BALLS = 16;
const GHOSTS = 4;

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

/** the loser's breakup: timed explosions, then the robot flies apart */
interface KoState {
  team: Team;
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

/** Per-robot item effect meshes: overdrive afterimages + thrusters, multi aura. */
class RobotFx {
  ghosts: THREE.Mesh[] = [];
  history: { x: number; t: number }[] = [];
  flames: THREE.Mesh[] = [];
  aura: THREE.Mesh;

  constructor(scene: THREE.Scene, color: number) {
    const ghostGeo = new THREE.BoxGeometry(1.0, 1.6, 0.6);
    for (let i = 0; i < GHOSTS; i++) {
      const g = new THREE.Mesh(
        ghostGeo,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      g.visible = false;
      scene.add(g);
      this.ghosts.push(g);
    }
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
}

export class View {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(46, 9 / 16, 0.1, 140);
  shooters: [ShooterMesh, ShooterMesh];
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
  private axis = new THREE.Vector3();
  private time = 0;
  /** optional ThorVG overlay for screen-space effects */
  fx2d: Fx2D | null = null;
  /** settings: draw the player's dotted shooting line */
  showAimLine = true;
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
  private robotFx: [RobotFx, RobotFx];

  constructor(
    private host: HTMLElement,
    private game: Game,
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

    this.shooters = [new ShooterMesh('angel', this.teamBall[0]), new ShooterMesh('dragon', this.teamBall[1])];
    for (const s of this.shooters) this.scene.add(s.root);
    this.robotFx = [new RobotFx(this.scene, this.teamBall[0]), new RobotFx(this.scene, this.teamBall[1])];
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
    // energy shields: a curved, hex-patterned wall in front of each robot
    const hexTex = this.makeHexTexture();
    for (let i = 0; i < 2; i++) {
      const arc = Math.PI * 0.75;
      const geo = new THREE.CylinderGeometry(1.15, 1.15, 1.9, 24, 1, true, Math.PI - arc / 2, arc);
      const mat = new THREE.MeshBasicMaterial({ color: this.teamBall[i], map: hexTex, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
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

  /** Swap the robot models for each side. */
  setCharacters(player: string, enemy: string) {
    const ids = [player, enemy];
    this.teamBall = [characterById(player).ball, characterById(enemy).ball];
    // a mirror match keeps the opponent's marbles distinguishable
    if (player === enemy) this.teamBall[1] = 0xff5a4a;
    this.teamBall.forEach((c, i) => {
      (this.marbleMesh[i].material as THREE.MeshPhongMaterial).color.set(c);
      (this.shields[i].material as THREE.MeshBasicMaterial).color.set(c);
      this.robotFx[i].ghosts.forEach((g) => (g.material as THREE.MeshBasicMaterial).color.set(c));
    });
    this.shooters.forEach((old, i) => {
      if (old.id === ids[i] && old.ball === this.teamBall[i]) return;
      this.scene.remove(old.root);
      old.dispose();
      const next = new ShooterMesh(ids[i], this.teamBall[i]);
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
          if (f.team === 0) this.shake(0.015);
          break;
        case 'super-fire': {
          const s = g.shooters[f.team];
          this.shake(f.team === 0 ? 0.35 : 0.15);
          const sp = this.project(s.x, s.y, 1);
          this.fx2d?.ring(sp.x, sp.y, hex(0xffe066));
          break;
        }
        case 'super-ready': {
          const s = g.shooters[f.team];
          const sp = this.project(s.x, s.y, 1);
          this.fx2d?.ring(sp.x, sp.y, hex(0xffe066));
          this.fx2d?.star(sp.x, sp.y, hex(0xffe066));
          break;
        }
        case 'pickup':
        case 'use': {
          const s = g.shooters[f.team];
          const c = ITEMS[f.item].color;
          const sp = this.project(s.x, s.y, 1);
          this.fx2d?.ring(sp.x, sp.y, hex(c), f.type === 'use');
          this.fx2d?.star(sp.x, sp.y, hex(c));
          this.burst(s.x, s.y, c, 16, 5, { h: 1 });
          break;
        }
        case 'missile-launch': {
          const s = g.shooters[f.team];
          this.shake(f.team === 0 ? 0.25 : 0.1);
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
          this.shieldFlash[f.team] = 1;
          const c = this.teamBall[f.team];
          const sp = this.project(f.x, f.y, 0.8);
          this.fx2d?.ring(sp.x, sp.y, hex(c), f.heavy);
          this.burst(f.x, f.y, c, f.heavy ? 18 : 6, 4, { h: 0.8 });
          this.shake(f.team === 0 ? (f.heavy ? 0.3 : 0.08) : 0.05);
          break;
        }
        case 'shield-break': {
          const s = g.shooters[f.team];
          const c = this.teamBall[f.team];
          const sp = this.project(s.x, s.y, 1);
          this.burst(s.x, s.y + s.forward * 0.9, c, 40, 8, { h: 1 });
          this.burst(s.x, s.y + s.forward * 0.9, 0xffffff, 16, 6, { h: 1 });
          this.fx2d?.ring(sp.x, sp.y, hex(c), true);
          this.fx2d?.star(sp.x, sp.y, hex(c), true);
          this.shake(f.team === 0 ? 0.55 : 0.2);
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
          const s = g.shooters[f.team];
          // rising green motes
          this.burst(s.x, s.y, ITEMS.heal.color, 40, 1, { h: 0.4, float: true, size: 0.09 });
          break;
        }
      }
    }
    g.fx.length = 0;
  }

  render(dt: number, showAim: boolean) {
    const g = this.game;
    this.time += dt;
    this.glows.length = 0;
    this.handleFx();
    this.stage.update(dt, this.time);

    g.shooters.forEach((s, i) => {
      if (!this.shooters[i].broken) this.shooters[i].sync(s, this.time, dt);
    });
    this.updateKo(dt);
    this.updateRobotFx(dt);
    this.updateShields(dt);
    // first person: hide your own robot so it doesn't block the view
    this.shooters[0].root.visible = this.cameraMode !== 'first' || !!this.ko;
    this.updateMissiles(dt);
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
          mesh.position.set(p.x, m.radius + this.hop(m.idx, m, dt), -p.y);
          // shimmer between white-hot and the ball's colour
          const pulse = 0.5 + 0.5 * Math.sin(this.time * 30 + m.idx);
          const base = dragon ? ITEMS.dragon.color : gold ? GATES.x5.color : this.teamBall[m.team];
          (mesh.material as THREE.MeshBasicMaterial).color.set(base).lerp(this.tmpC.set(0xffffff), pulse * 0.5);
          mesh.scale.setScalar(m.radius * (1 + pulse * 0.08));
        }
        const sp = this.project(p.x, p.y, m.radius);
        const trail = this.trails.get(m.idx) ?? [];
        trail.unshift(sp);
        if (trail.length > (dragon ? 14 : 10)) trail.length = dragon ? 14 : 10;
        this.trails.set(m.idx, trail);
        seen.add(m.idx);
        const glowColor = dragon ? ITEMS.dragon.color : gold ? GATES.x5.color : this.teamBall[m.team];
        this.glows.push({ x: sp.x, y: sp.y, r: this.screenRadius(p.x, p.y, m.radius), color: hex(glowColor), trail: trail.slice(1) });
        continue;
      }
      const p = m.body.translation();
      const v = m.body.linvel();
      const q = this.marbleRot[m.idx];
      const speed = Math.hypot(v.x, v.y);
      if (speed > 0.01) {
        // roll around the axis perpendicular to travel on the floor
        this.axis.set(-v.y, 0, -v.x).normalize();
        this.tmpQ.setFromAxisAngle(this.axis, (speed * dt) / m.radius);
        q.premultiply(this.tmpQ);
      }
      const h = this.hop(m.idx, m, dt);
      this.tmpV.set(p.x, m.radius + h, -p.y);
      this.tmpS.setScalar(m.radius);
      this.tmpM.compose(this.tmpV, q, this.tmpS);
      const mesh = this.marbleMesh[m.team];
      mesh.setMatrixAt(counts[m.team]++, this.tmpM);
      // fast marbles get a ThorVG motion streak
      if (speed > 11) {
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
      this.tmpS.setScalar(m.radius * (1.05 - Math.min(0.5, h * 0.8)));
      this.tmpQ.identity();
      this.tmpM.compose(this.tmpV, this.tmpQ, this.tmpS);
      this.shadows.setMatrixAt(shadowN++, this.tmpM);
    }
    this.shadows.count = shadowN;
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
      if (rolls) {
        const v = b.body.linvel();
        const speed = Math.hypot(v.x, v.y);
        if (speed > 0.01) {
          this.axis.set(-v.y, 0, -v.x).normalize();
          this.tmpQ.setFromAxisAngle(this.axis, (speed * dt) / b.radius);
          this.puckRot[i].premultiply(this.tmpQ);
        }
        mesh.quaternion.copy(this.puckRot[i]);
      } else {
        mesh.rotation.y = b.body.rotation();
      }
    });

    this.updateSparks(dt);
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
      const sp = this.project(d.x, g.shooters[0].y, d.h + 0.32);
      const margin = 26;
      const edge = sp.x < margin ? -1 : sp.x > w - margin ? 1 : 0;
      this.markers.push({ x: Math.max(margin, Math.min(w - margin, sp.x)), y: edge ? Math.min(sp.y, this.host.clientHeight * 0.72) : sp.y, color: hex(ITEMS[d.type].color), edge });
    }
    this.fx2d?.render(dt, this.glows, g.shooters[0].boostT > 0, this.markers, this.streaks, this.teamBall);
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

  /** Overdrive afterimages and thrusters, multi-shot aura. */
  private updateRobotFx(dt: number) {
    this.game.shooters.forEach((s, i) => {
      const fx = this.robotFx[i];
      const boosted = s.boostT > 0;
      // sample positions so afterimages trail behind the motion
      fx.history.unshift({ x: s.x, t: this.time });
      if (fx.history.length > 24) fx.history.length = 24;
      fx.ghosts.forEach((g, k) => {
        const h = fx.history[(k + 1) * 4];
        const show = boosted && !!h && Math.abs(h.x - s.x) > 0.15;
        g.visible = show;
        if (!show) return;
        g.position.set(h.x, 0.85, -s.y);
        (g.material as THREE.MeshBasicMaterial).opacity = 0.32 * (1 - k / GHOSTS);
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
      const y = -this.game.shooters[d.team].y;
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
  private hop(idx: number, m: { hop: number }, dt: number) {
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
  private updateShields(dt: number) {
    this.game.shooters.forEach((s, i) => {
      const mesh = this.shields[i];
      this.shieldFlash[i] = Math.max(0, this.shieldFlash[i] - dt * 4);
      mesh.visible = s.shieldUp && !this.shooters[i].broken;
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
    if (this.ko) {
      for (const d of this.ko.debris) {
        this.scene.remove(d.mesh);
        d.mesh.geometry.dispose();
      }
      this.ko = null;
    }
    this.shooters.forEach((sm, i) => {
      if (!sm.broken) return;
      this.scene.remove(sm.root);
      sm.dispose();
      const next = new ShooterMesh(sm.id, this.teamBall[i]);
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
      this.ko = { team: g.winner === 0 ? 1 : 0, t: 0, pops: 0, shattered: false, debris: [] };
    }
    const ko = this.ko;
    if (!ko) return;
    // run the sequence a little slow for drama
    const sdt = dt * 0.6;
    ko.t += sdt;
    const l = g.shooters[ko.team];
    const color = ko.team === 0 ? COLORS.player : COLORS.enemy;
    const sp = () => this.project(l.x, l.y, 1);
    // three pops from different spots on the body
    const popAt = [0.05, 0.3, 0.55];
    while (ko.pops < popAt.length && ko.t >= popAt[ko.pops]) {
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
      const sm = this.shooters[ko.team];
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
      gm.panel.opacity = 0.32 + Math.sin(this.time * 8) * 0.06;
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
    if (this.ko) {
      // KO cam: swing in on the wreck (a reverse shot when the player loses)
      const l = this.game.shooters[this.ko.team];
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
    switch (this.cameraMode) {
      case 'far':
        this.camGoal.set(p.x * 0.85 - lean * 1.1, 8.4, -p.y + 8.4);
        this.lookGoal.set(p.x * 0.55 + lean * 3, 0, -p.y - 6.5);
        break;
      case 'mid':
        this.camGoal.set(p.x * 0.9 - lean * 0.9, 6.4, -p.y + 6.4);
        this.lookGoal.set(p.x * 0.6 + lean * 3, 0.2, -p.y - 7.5);
        break;
      case 'near':
        this.camGoal.set(p.x * 0.95 - lean * 0.6, 3.8, -p.y + 3.9);
        this.lookGoal.set(p.x * 0.7 + lean * 3.5, 0.5, -p.y - 8.5);
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
