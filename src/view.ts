import * as THREE from 'three';
import { ARENA, COLORS, MATCH } from './config';
import type { Drop, Game, Team } from './game';
import { ShooterMesh } from './robot';
import { Stage } from './stage';
import { ITEMS } from './items';
import { hex, type Fx2D, type Glow, type Marker } from './fx2d';

// Physics (x, y) maps to three.js (x, 0, -y): the player sits near the
// camera at +z and the opponent sits far away at -z.

const SPARKS = 220;
const AIM_DOTS = 26;
const POWER_BALLS = 8;
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

    this.shooters = [new ShooterMesh('angel', COLORS.playerMarble), new ShooterMesh('dragon', COLORS.enemyMarble)];
    for (const s of this.shooters) this.scene.add(s.root);
    this.robotFx = [new RobotFx(this.scene, COLORS.playerMarble), new RobotFx(this.scene, COLORS.enemyMarble)];

    // marbles: one instanced mesh per team, hidden instances scaled to 0
    const marbleGeo = new THREE.SphereGeometry(1, 16, 12);
    this.marbleMesh = [COLORS.playerMarble, COLORS.enemyMarble].map((c) => {
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
    this.camera.fov = w / h < 0.75 ? 54 : 44;
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
    const marbles = [COLORS.playerMarble, COLORS.enemyMarble];
    this.shooters.forEach((old, i) => {
      if (old.id === ids[i]) return;
      this.scene.remove(old.root);
      old.dispose();
      const next = new ShooterMesh(ids[i], marbles[i]);
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
          } else if (f.power === 'dragon') {
            this.burst(f.x, f.y, ITEMS.dragon.color, 30, 9);
            this.burst(f.x, f.y, 0xffe066, 14, 6);
            this.shake(0.6);
            this.fx2d?.ring(sp.x, sp.y, hex(ITEMS.dragon.color), true);
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
    this.handleFx();
    this.stage.update(dt, this.time);

    g.shooters.forEach((s, i) => this.shooters[i].sync(s, this.time, dt));
    this.updateRobotFx(dt);
    this.updateDrops();

    // marbles + visual rolling
    const counts = [0, 0];
    let powerCount = 0;
    this.glows.length = 0;
    const seen = new Set<number>();
    for (const m of g.marbles) {
      if (!m.active) continue;
      if (m.kind !== 'normal') {
        const p = m.body.translation();
        const mesh = this.powerMeshes[powerCount++];
        const dragon = m.kind === 'dragon';
        if (mesh) {
          mesh.visible = true;
          mesh.position.set(p.x, m.radius, -p.y);
          // shimmer between white-hot and the ball's colour
          const pulse = 0.5 + 0.5 * Math.sin(this.time * 30 + m.idx);
          const base = dragon ? ITEMS.dragon.color : m.team === 0 ? 0x9fd0ff : 0xffb09a;
          (mesh.material as THREE.MeshBasicMaterial).color.set(base).lerp(this.tmpC.set(0xffffff), pulse * 0.5);
          mesh.scale.setScalar(m.radius * (1 + pulse * 0.08));
        }
        const sp = this.project(p.x, p.y, m.radius);
        const trail = this.trails.get(m.idx) ?? [];
        trail.unshift(sp);
        if (trail.length > (dragon ? 14 : 10)) trail.length = dragon ? 14 : 10;
        this.trails.set(m.idx, trail);
        seen.add(m.idx);
        const glowColor = dragon ? ITEMS.dragon.color : m.team === 0 ? 0x5fa8ff : 0xff6a4a;
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
      this.tmpV.set(p.x, m.radius, -p.y);
      this.tmpS.setScalar(m.radius);
      this.tmpM.compose(this.tmpV, q, this.tmpS);
      const mesh = this.marbleMesh[m.team];
      mesh.setMatrixAt(counts[m.team]++, this.tmpM);
    }
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
    this.fx2d?.render(dt, this.glows, g.shooters[0].boostT > 0, this.markers);
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
    const p = this.game.shooters[0];
    const lean = Math.sin(p.aim);
    this.camGoal.set(p.x * 0.9 - lean * 0.9, 6.4, -p.y + 6.4);
    this.lookGoal.set(p.x * 0.6 + lean * 3, 0.2, -p.y - 7.5);
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
