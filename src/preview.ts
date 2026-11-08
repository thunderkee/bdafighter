import * as THREE from 'three';
import { CEL, celify } from './cel';
import { InkOnly } from './post';
import { ShooterMesh, characterById, studioEnv, type CharacterDef } from './robot';
import { Stage } from './stage';
import { TOSS_TIME, TWIN_X } from './config';
import type { Shooter } from './game';

/** the preview unit's pretend fight state, fed to the same animation code the match uses */
type Act = Pick<Shooter, 'x' | 'y' | 'team' | 'aim' | 'recoil' | 'vx' | 'firing' | 'kickT' | 'heavyT' | 'flash' | 'stagger' | 'health' | 'hand' | 'lastHand' | 'windT' | 'wobble'>;

/**
 * The select screens' preview window: the chosen fighter on a slowly turning plinth, or a
 * slow fly-over of the chosen arena. One small renderer, only running while it's on screen.
 */
export class Preview {
  private renderer: THREE.WebGLRenderer | null = null;
  /** the ink outline pass for the cel look */
  private inked: InkOnly | null = null;
  /** the tallest roster unit (Bastion) and the widest reach (Nightshade), round the plinth's axis */
  static FRAME_H = 2.5;
  static FRAME_R = 1.65;
  /** told the colour at the top of an arena's view (once it's drawn), for the screen round it */
  onSky: ((css: string) => void) | null = null;
  private skyIn = 0;
  /** units always cel shaded (whatever the setting) */
  cel = false;
  /** the title screen's hero: no plinth, framed big, an attack pose (punches, no marble), always cel shaded */
  hero = false;
  /** drag to turn the unit (off where a swipe flips to the next one instead) */
  turnable = true;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
  private hemi = new THREE.HemisphereLight(0xfff6e8, 0x6a6458, 1.6);
  private sun = new THREE.DirectionalLight(0xffffff, 2.2);
  private rim = new THREE.DirectionalLight(0xffe2c8, 1.2);
  private unit: ShooterMesh | null = null;
  private stage: Stage | null = null;
  private plinth: THREE.Group;
  private raf = 0;
  private last = 0;
  private t = 0;
  private mode: 'unit' | 'stage' = 'unit';
  /** turns the unit on the plinth (the unit's own root is driven by its animation) */
  private pivot = new THREE.Group();
  private act: Act = { x: 0, y: 0, team: 0, aim: 0, recoil: 0, vx: 0, firing: false, kickT: 9, heavyT: 9, flash: 0, stagger: 0, health: 100, hand: 1, lastHand: 1, windT: 9, wobble: 0 };
  /** the unit's signature trick, acted out on the plinth too */
  private special: NonNullable<ReturnType<typeof characterById>['special']> = {};
  private windLeft = 0;
  private swapT = 0;
  private wobbleN = 0;
  /** seconds into the unit's routine, and when its next shot goes */
  private at = 0;
  private nextShot = 0;
  private twin = false;
  private balls: { mesh: THREE.Mesh; v: THREE.Vector3; age: number }[] = [];
  private ballGeo = new THREE.SphereGeometry(0.104, 20, 14);
  private ballMat = new THREE.MeshPhysicalMaterial({ roughness: 0.08, clearcoat: 1, metalness: 0 });

  constructor(private host: HTMLElement) {
    // drag left and right to turn the unit (vertical drags still scroll the page)
    host.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'unit' || !this.turnable) return;
      // (the arrows and peeks laid over it still click)
      if ((e.target as Element).closest('button')) return;
      this.dragX = e.clientX;
      this.dragged = 0;
      host.setPointerCapture(e.pointerId);
      host.classList.add('turning');
    });
    host.addEventListener('pointermove', (e) => {
      if (this.dragX === null) return;
      this.spin += (e.clientX - this.dragX) * 0.012;
      this.dragged += Math.abs(e.clientX - this.dragX);
      this.dragX = e.clientX;
      this.handT = 2.5;
    });
    const end = () => {
      this.dragX = null;
      host.classList.remove('turning');
    };
    host.addEventListener('pointerup', end);
    host.addEventListener('pointercancel', end);
    // pinch with two fingers (or scroll a mouse wheel) to look closer
    const spread = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    host.addEventListener(
      'touchstart',
      (e) => {
        if (this.mode !== 'unit' || e.touches.length !== 2) return;
        e.preventDefault();
        this.pinch = { d: spread(e.touches), z: this.zoom };
        // (two fingers aren't a turn, or a tap on the fighter)
        end();
        this.dragged = 99;
      },
      { passive: false },
    );
    host.addEventListener(
      'touchmove',
      (e) => {
        if (!this.pinch || e.touches.length !== 2) return;
        e.preventDefault();
        this.setZoom((this.pinch.z * spread(e.touches)) / this.pinch.d);
      },
      { passive: false },
    );
    host.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) this.pinch = null;
    });
    host.addEventListener('touchcancel', () => (this.pinch = null));
    // (Safari's own page zoom would take the gesture otherwise)
    host.addEventListener('gesturestart', (e) => e.preventDefault());
    host.addEventListener(
      'wheel',
      (e) => {
        if (this.mode !== 'unit') return;
        e.preventDefault();
        this.setZoom(this.zoom * Math.exp(-e.deltaY * 0.0015));
      },
      { passive: false },
    );
    this.sun.position.set(-3, 6, -5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -2;
    sc.right = sc.top = 2;
    this.sun.shadow.normalBias = 0.02;
    this.rim.position.set(4, 3, 5);
    this.scene.add(this.hemi, this.sun, this.rim);
    // a cream turntable plinth with a dark rubber top
    this.plinth = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.32, 0.22, 64), new THREE.MeshPhysicalMaterial({ color: 0xe6dfcf, roughness: 0.45, clearcoat: 0.4 }));
    base.position.y = -0.11;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.18, 0.02, 64), new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.85 }));
    top.position.y = 0.005;
    top.receiveShadow = true;
    base.receiveShadow = true;
    this.plinth.add(base, top);
  }

  private ensure() {
    if (this.renderer) return this.renderer;
    // see-through, so the unit's name can sit behind it on the screen
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setClearColor(0x000000, 0);
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 0.92;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.environment = studioEnv(r);
    this.scene.environmentIntensity = 0.6;
    this.host.appendChild(r.domElement);
    this.renderer = r;
    return r;
  }

  /** a unit on show; skin is the unit in its cosmetics (your fighter) */
  showUnit(id: string, skin?: CharacterDef, silhouette = false) {
    this.ensure();
    this.clear();
    this.mode = 'unit';
    const def = skin && skin.id === characterById(id).id ? skin : characterById(id);
    // (a different fighter starts back at the full view; another skin on this one keeps the close-up)
    if (id !== this.zoomFor) {
      this.zoom = 1;
      this.host.classList.remove('zoomed');
    }
    this.zoomFor = id;
    this.unit = new ShooterMesh(def.id, def.ball, def);
    // a locked fighter: the whole of it painted black, moving as it would
    if (silhouette) {
      const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
      this.unit.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.material) m.material = black;
      });
    }
    this.pivot.add(this.unit.root);
    // (no plinth: the unit stands on its own, at the roster's shared framing)
    this.scene.add(this.pivot);
    this.host.classList.remove('stage');
    this.spin = 0;
    this.handT = 0;
    this.swingT = 0;
    this.twin = !!def.twin;
    this.special = def.special ?? {};
    this.windLeft = 0;
    this.swapT = 0;
    this.wobbleN = 0;
    this.ballMat.color.setHex(silhouette ? 0x000000 : def.ball);
    // it powers up as it's picked: the special-move spring and glow, then its routine
    this.act = { ...this.act, x: 0, aim: 0, vx: 0, recoil: 0, kickT: 9, heavyT: 0, flash: 0, hand: 1, lastHand: 1, windT: 9, wobble: 0 };
    this.at = 0;
    this.signatureAt = 0.9;
    this.nextShot = 1.4;
    this.scene.background = null;
    this.scene.fog = null;
    this.hemi.color.set(0xfff6e8);
    this.hemi.groundColor.set(0x6a6458);
    this.hemi.intensity = 1.5;
    this.sun.intensity = 2.2;
    this.rim.intensity = 1.2;
    // one framing for the whole roster (sized for its biggest unit), so the plinth stays put and
    // units show at their true scale against each other; only an oversized custom unit widens it
    this.unit.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.unit.root);
    const reach = Math.hypot(Math.max(-box.min.x, box.max.x), Math.max(-box.min.z, box.max.z)) * 0.7;
    // (the hero fills its frame instead)
    this.frameH = this.hero ? Math.max(1.2, box.max.y) : Math.max(Preview.FRAME_H, box.max.y);
    this.frameR = this.hero ? Math.max(0.8, reach * 0.8) : Math.max(Preview.FRAME_R, reach);
    this.camera.fov = 30;
    this.fitCamera();
    this.start();
  }

  /** how close the view is pulled in by a pinch (1 is the full fighter) */
  private zoom = 1;
  private zoomFor = '';
  private pinch: { d: number; z: number } | null = null;
  private setZoom(z: number) {
    this.zoom = Math.max(0.7, Math.min(2.6, z));
    this.host.classList.toggle('zoomed', this.zoom > 1.05);
    if (this.mode === 'unit') this.fitCamera();
  }

  /** place the camera so the unit (and some of the plinth) fills the screen at its current shape */
  private fitCamera() {
    const aspect = this.camera.aspect || 1;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const lo = -0.2;
    const hi = this.frameH + 0.12;
    const cy = (lo + hi) / 2;
    const r = this.frameR;
    // (in the select carousel the fighter is the focus: in a little closer, the biggest only just fitting)
    const dist = (Math.max((hi - lo) / 2 / tan, r / (tan * aspect)) + r * 0.15) * (this.hero ? 1 : 0.84);
    // (closer in, the view rises from the middle of the fighter towards its face)
    const rise = Math.max(0, Math.min(1, (this.zoom - 1) / 1.2));
    const look = cy + (hi * 0.8 - cy) * rise;
    this.camera.zoom = this.zoom;
    this.camera.position.set(0, look + dist * 0.12, -dist);
    this.camera.lookAt(0, look, 0);
    this.camera.updateProjectionMatrix();
  }

  showStage(id: string) {
    this.ensure();
    this.clear();
    this.mode = 'stage';
    this.camera.zoom = 1;
    this.host.classList.add('stage');
    this.stage = new Stage(id);
    const d = this.stage.def;
    this.scene.add(this.stage.group);
    this.stage.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = true;
    });
    this.scene.background = new THREE.Color(d.sky);
    this.scene.fog = new THREE.Fog(d.fog[0], d.fog[1], d.fog[2]);
    this.hemi.color.set(d.hemi[0]);
    this.hemi.groundColor.set(d.hemi[1]);
    this.hemi.intensity = d.hemi[2];
    this.sun.intensity = d.sun[1];
    this.sun.color.set(d.sun[0]);
    this.rim.intensity = 0;
    this.camera.fov = 46;
    this.camera.updateProjectionMatrix();
    this.skyIn = 2;
    this.start();
  }

  private clear() {
    if (this.unit) {
      this.pivot.remove(this.unit.root);
      this.scene.remove(this.pivot, this.plinth);
      this.unit.dispose();
      this.unit = null;
    }
    for (const b of this.balls) this.scene.remove(b.mesh);
    this.balls.length = 0;
    if (this.stage) {
      this.scene.remove(this.stage.group);
      this.stage.dispose();
      this.stage = null;
    }
  }

  private start() {
    if (this.raf) return;
    this.last = performance.now();
    // (a turntable doesn't need more than 30 frames a second)
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      if (now - this.last < 1000 / 30 - 4) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /**
   * Stop drawing and drop the model (leaving the screen). The renderer itself is kept and reused:
   * phones allow only a few 3D canvases, and creating fresh ones each visit can push out the
   * match's own (it goes black).
   */
  release() {
    this.stop();
    this.clear();
    this.renderer?.renderLists.dispose();
  }

  private shots = new Map<string, string>();
  /** a still of an arena for its tile, rendered once and kept */
  stageShot(id: string, w = 320, h = 180) {
    const shot = `${id}:${w}x${h}`;
    let url = this.shots.get(shot);
    if (url) return url;
    const r = this.ensure();
    const keepMode = this.mode;
    const keep = r.getSize(new THREE.Vector2());
    const stage = new Stage(id);
    const d = stage.def;
    const scene = new THREE.Scene();
    scene.environment = this.scene.environment;
    scene.background = new THREE.Color(d.sky);
    scene.fog = new THREE.Fog(d.fog[0], d.fog[1], d.fog[2]);
    scene.add(new THREE.HemisphereLight(d.hemi[0], d.hemi[1], d.hemi[2]));
    const sun = new THREE.DirectionalLight(d.sun[0], d.sun[1]);
    sun.position.set(6, 18, 9);
    scene.add(sun, stage.group);
    const cam = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);
    cam.position.set(3, 8, 14);
    cam.lookAt(0, 0, -3);
    r.setSize(w, h, false);
    celify(scene);
    r.render(scene, cam);
    url = r.domElement.toDataURL('image/jpeg', 0.85);
    stage.dispose();
    r.setSize(keep.x, keep.y, false);
    this.mode = keepMode;
    this.shots.set(shot, url);
    return url;
  }

  private frame(dt: number) {
    const r = this.renderer;
    if (!r) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    const size = r.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) {
      r.setSize(w, h, false);
      r.domElement.style.width = '100%';
      r.domElement.style.height = '100%';
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      if (this.mode === 'unit') this.fitCamera();
    }
    this.t += dt;
    if (this.mode === 'unit' && this.unit) {
      // mostly the 3/4 front, swinging round to show the sides; a drag turns it by hand,
      // and the swing waits a moment after you let go
      this.handT = Math.max(0, this.handT - dt);
      if (this.handT === 0 && this.dragX === null) this.swingT += dt;
      const a = this.hero ? -0.5 + Math.sin(this.t * 0.35) * 0.14 + this.spin : -0.55 + Math.sin(this.swingT * 0.45) * 0.75 + this.spin;
      this.pivot.rotation.y = a;
      this.plinth.rotation.y = a;
      this.animate(dt);
    } else if (this.stage) {
      // a slow sweep over the table from behind the player's rail
      const a = Math.sin(this.t * 0.25) * 0.5;
      this.camera.position.set(Math.sin(a) * 14, 9 + Math.sin(this.t * 0.3) * 1.2, Math.cos(a) * 15);
      this.camera.lookAt(0, 0, -2);
      this.stage.update(dt, this.t);
    }
    const cel = this.hero || (this.cel && this.mode === 'unit') || CEL.on;
    celify(this.scene, cel);
    // (the rim light would fill in the toon shading's dark band, so the cel look goes without it)
    this.rim.visible = !cel;
    // (and its key light comes from the side, so the dark band shows on the far faces)
    if (cel && this.mode === 'unit') this.sun.position.set(-5, 7, -1.5);
    else this.sun.position.set(-3, 6, -5);
    // (a unit on show gets the game's ink outlines too)
    if (cel && this.mode === 'unit') (this.inked ??= new InkOnly(r, this.scene, this.camera)).render();
    else r.render(this.scene, this.camera);
    // (read straight after drawing, while the frame is still there)
    if (this.mode === 'stage' && this.skyIn > 0 && --this.skyIn === 0 && this.onSky) {
      const gl = r.getContext();
      const px = new Uint8Array(4);
      gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), gl.drawingBufferHeight - 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      this.onSky(`rgb(${px[0]}, ${px[1]}, ${px[2]})`);
    }
  }

  /**
   * The selected unit's routine on the plinth: it shuffles side to side on the spot, sweeps
   * its aim, and every couple of seconds fires (a recoil punch and a marble flying out at you),
   * sometimes a quick string of shots.
   */
  private animate(dt: number) {
    const unit = this.unit!;
    const s = this.act;
    this.at += dt;
    const t = this.at;
    // a side-step every few seconds: walk cycle on the spot, the body swaying with it
    const step = Math.sin(t * 0.9);
    // (the hero stands its ground, squared up and leaning into its shots)
    s.vx = this.hero ? 0 : Math.abs(step) > 0.55 ? Math.sign(step) * 4 : 0;
    s.aim = this.hero ? Math.sin(t * 0.5) * 0.1 : Math.sin(t * 0.7) * 0.28;
    s.kickT += dt;
    s.heavyT += dt;
    s.windT += dt;
    s.recoil = Math.max(this.hero ? 0.3 : 0, s.recoil - dt * 8);
    s.firing = this.hero;
    const sp = this.special;
    // a head that keeps turning (Ember): the shots follow it
    if (sp.wobble) s.wobble = Math.sin((this.wobbleN += dt * 2.5)) * sp.wobble;

    // a wind-up: the punch first, the shot when it's done
    if (this.windLeft > 0 && (this.windLeft -= dt) <= 0) this.shoot();
    if (t >= this.nextShot) {
      s.firing = true;
      if (sp.windup) {
        this.windLeft = sp.windup;
        s.windT = 0;
      } else this.shoot();
      // now and then a quick string of three
      if (this.burstLeft === 0 && !sp.windup && !this.hero && Math.random() < 0.35) this.burstLeft = 3;
      if (this.burstLeft > 0) this.burstLeft--;
      this.nextShot = Math.max(this.tossUntil, t + (this.burstLeft > 0 ? 0.16 : 1.6 + Math.random() * 1.2));
    }
    unit.sync(s as Shooter, this.t, dt);
    // keep it planted on the plinth: no sliding along a rail here
    unit.root.position.x = 0;
    unit.root.position.z = 0;
    // on the select screen each fighter shows off: its own special pose, soon after you land on it
    if (!this.hero && t >= this.signatureAt) {
      const p = t - this.signatureAt;
      if (p < 2.8) unit.specialPose(p, 0);
      else this.signatureAt = t + 5;
    }
    // (the marble leaves once the model has moved its gun to the hand that fired)
    if (this.ballDue) {
      this.ballDue = false;
      if (!this.hero) this.fire();
    }
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.age += dt;
      b.mesh.position.addScaledVector(b.v, dt);
      b.mesh.rotation.x -= dt * 12;
      if (b.age > 0.9) {
        this.scene.remove(b.mesh);
        this.balls.splice(i, 1);
      }
    }
  }
  private signatureAt = 0.9;
  private burstLeft = 0;
  private tripleN = 0;
  /** drag to turn the unit by hand: the extra turn, and how long the auto swing waits after a drag */
  private spin = 0;
  /** how far the last press dragged, in pixels */
  private dragged = 0;
  /** the last press turned the unit (so it wasn't a tap) */
  get wasDrag() {
    return this.dragged > 6;
  }
  private handT = 0;
  private swingT = 0;
  private dragX: number | null = null;
  /** the framing for this unit: what the camera looks at, and from how far */
  private frameH = 1.4;
  private frameR = 1;

  /** the shot itself: the kick, the hand it leaves from, rapid fire's spray, and the marble */
  private shoot() {
    const s = this.act;
    const sp = this.special;
    s.recoil = 1;
    s.lastHand = s.hand;
    if (sp.alternate) s.hand = -s.hand;
    // Tyrant King's cycle: left, right, both
    if (sp.triple) {
      const n = this.tripleN++ % 3;
      s.lastHand = n === 0 ? -1 : n === 1 ? 1 : 0;
      s.hand = n === 2 ? -1 : 1;
    }
    // after every few shots the gun is tossed to the other hand; it fires again once it lands
    if (sp.swap && (this.swapT = (this.swapT + 1) % sp.swap) === 0) {
      s.hand = -s.hand;
      this.tossUntil = this.at + TOSS_TIME + 0.05;
    }
    s.kickT = 0;
    this.ballDue = true;
  }
  private ballDue = false;
  private tossUntil = 0;

  /** a marble out of the muzzle (two from twin barrels), flying down the unit's facing */
  private fire() {
    const unit = this.unit!;
    this.scene.updateMatrixWorld(true);
    const from = unit.muzzleWorld(new THREE.Vector3());
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(unit.turret.getWorldQuaternion(new THREE.Quaternion()));
    fwd.y = 0;
    fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    if (this.special.wobble) fwd.applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.act.wobble);
    const both = this.act.lastHand === 0;
    for (const side of this.twin ? [-TWIN_X, TWIN_X] : both ? [-(this.special.hand ?? 0.45), this.special.hand ?? 0.45] : [0]) {
      const mesh = new THREE.Mesh(this.ballGeo, this.ballMat);
      mesh.castShadow = true;
      mesh.position.copy(from).addScaledVector(right, side);
      this.scene.add(mesh);
      this.balls.push({ mesh, v: fwd.clone().multiplyScalar(7), age: 0 });
    }
  }
}
