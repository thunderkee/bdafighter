import * as THREE from 'three';
import { ARENA, COLORS, MATCH } from './config';
import type { Game, Team } from './game';
import { ShooterMesh } from './robot';

// Physics (x, y) maps to three.js (x, 0, -y): the player sits near the
// camera at +z and the opponent sits far away at -z.

const SPARKS = 160;
const AIM_DOTS = 26;

interface Spark {
  life: number;
  max: number;
  p: THREE.Vector3;
  v: THREE.Vector3;
  color: THREE.Color;
  size: number;
}

export class View {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(46, 9 / 16, 0.1, 100);
  shooters: [ShooterMesh, ShooterMesh];
  private marbleMesh: [THREE.InstancedMesh, THREE.InstancedMesh];
  private marbleRot: THREE.Quaternion[] = [];
  private bumpMeshes: THREE.Mesh[] = [];
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
  private axis = new THREE.Vector3();
  private time = 0;

  constructor(
    private host: HTMLElement,
    private game: Game,
  ) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new THREE.WebGLRenderer({ antialias: dpr < 2, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setClearColor(COLORS.bg);
    host.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.Fog(COLORS.bg, 30, 55);
    this.scene.add(new THREE.HemisphereLight(0xdfe4ff, 0x2a1d4a, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.9);
    sun.position.set(4, 12, 6);
    this.scene.add(sun);

    this.buildArena();
    this.shooters = [
      new ShooterMesh('angel'),
      new ShooterMesh('dragon'),
    ];
    for (const s of this.shooters) this.scene.add(s.root);

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

    // bumps
    const bumpMat = new THREE.MeshLambertMaterial({ color: COLORS.bump });
    const bumpTop = new THREE.MeshLambertMaterial({ color: 0xfff1c9 });
    for (const b of game.bumps) {
      const g = new THREE.Group();
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(b.radius, b.radius * 1.05, 0.55, 20), bumpMat);
      cyl.position.y = 0.275;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(b.radius * 0.6, b.radius * 0.6, 0.06, 20), bumpTop);
      cap.position.y = 0.58;
      g.add(cyl, cap);
      this.scene.add(g);
      this.bumpMeshes.push(g as unknown as THREE.Mesh);
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
      this.sparks.push({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), color: new THREE.Color(), size: 0.05 });
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

  private buildArena() {
    const W = ARENA.width;
    const L = ARENA.length;
    // painted floor via canvas texture: centre line, rails, bump zone
    const cvs = document.createElement('canvas');
    cvs.width = 256;
    cvs.height = 640;
    const c = cvs.getContext('2d')!;
    const px = (x: number) => ((x + W / 2) / W) * cvs.width;
    const py = (y: number) => ((L / 2 - y) / L) * cvs.height;
    c.fillStyle = '#' + COLORS.floor.toString(16).padStart(6, '0');
    c.fillRect(0, 0, cvs.width, cvs.height);
    c.fillStyle = 'rgba(255,255,255,0.025)';
    for (let i = 0; i < 26; i += 2) c.fillRect(0, py(L / 2 - i), cvs.width, cvs.height / L);
    c.strokeStyle = '#' + COLORS.floorLine.toString(16).padStart(6, '0');
    c.lineWidth = 3;
    c.setLineDash([10, 8]);
    c.beginPath();
    c.moveTo(0, py(0));
    c.lineTo(cvs.width, py(0));
    c.stroke();
    c.setLineDash([]);
    for (const side of [-1, 1]) {
      c.strokeRect(px(-ARENA.railHalfWidth - 0.7), py(side * ARENA.railY + 0.6), px(ARENA.railHalfWidth + 0.7) - px(-ARENA.railHalfWidth - 0.7), py(-0.6) - py(0.6));
      c.globalAlpha = 0.5;
      c.beginPath();
      c.moveTo(0, py(side * ARENA.bumpFenceY));
      c.lineTo(cvs.width, py(side * ARENA.bumpFenceY));
      c.stroke();
      c.globalAlpha = 1;
    }
    c.beginPath();
    c.arc(px(0), py(0), 34, 0, Math.PI * 2);
    c.stroke();
    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), new THREE.MeshLambertMaterial({ map: tex }));
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // a darker apron so the open ends read as "out"
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 6, L + 16),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(COLORS.bg).multiplyScalar(1.4) }),
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.02;
    this.scene.add(apron);

    const railMat = new THREE.MeshLambertMaterial({ color: COLORS.rail });
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(ARENA.wallThickness, 0.7, L), railMat);
      rail.position.set(side * (W / 2 + ARENA.wallThickness / 2), 0.35, 0);
      this.scene.add(rail);
    }
  }

  resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // narrow portrait screens need a wider lens to keep the side walls in view
    this.camera.fov = w / h < 0.75 ? 58 : 48;
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

  shake(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  burst(x: number, y: number, color: THREE.ColorRepresentation, count: number, speed: number) {
    const col = new THREE.Color(color);
    let n = 0;
    for (const s of this.sparks) {
      if (s.life > 0) continue;
      s.max = s.life = 0.25 + Math.random() * 0.3;
      s.p.set(x, 0.3, -y);
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      s.v.set(Math.cos(a) * sp, 2 + Math.random() * 4, Math.sin(a) * sp);
      s.color.copy(col);
      s.size = 0.05 + Math.random() * 0.07;
      if (++n >= count) break;
    }
  }

  handleFx() {
    const g = this.game;
    for (const f of g.fx) {
      switch (f.type) {
        case 'hit':
          this.burst(f.x, f.y, f.team === 0 ? COLORS.player : COLORS.enemy, 14, 6);
          this.burst(f.x, f.y, 0xffffff, 6, 4);
          this.shake(f.team === 0 ? 0.32 : 0.14);
          break;
        case 'spark':
          this.burst(f.x, f.y, 0xfff2b0, Math.round(3 + f.intensity * 6), 4);
          break;
        case 'muzzle':
          if (f.team === 0) this.shake(0.015);
          break;
      }
    }
    g.fx.length = 0;
  }

  render(dt: number, showAim: boolean) {
    const g = this.game;
    this.time += dt;
    this.handleFx();

    g.shooters.forEach((s, i) => this.shooters[i].sync(s, this.time, dt));

    // marbles + visual rolling
    const counts = [0, 0];
    for (const m of g.marbles) {
      if (!m.active) continue;
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

    g.bumps.forEach((b, i) => {
      const p = b.body.translation();
      this.bumpMeshes[i].position.set(p.x, 0, -p.y);
      this.bumpMeshes[i].rotation.y = b.body.rotation();
    });

    // sparks
    let sc = 0;
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.v.y -= 18 * dt;
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

    this.updateAimDots(showAim);

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
  }

  /**
   * Third-person chase camera: low and behind the player's shooter, drifting
   * with its position and leaning a little into the aim direction.
   */
  private followPlayer(dt: number) {
    const p = this.game.shooters[0];
    const lean = Math.sin(p.aim);
    this.camGoal.set(p.x * 0.85 - lean * 1.1, 8, -p.y + 8.2);
    this.lookGoal.set(p.x * 0.55 + lean * 3, 0, -p.y - 6.5);
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
