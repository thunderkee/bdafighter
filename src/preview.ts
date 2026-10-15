import * as THREE from 'three';
import { ShooterMesh, characterById, studioEnv } from './robot';
import { Stage } from './stage';

/**
 * The select screens' preview window: the chosen fighter on a slowly turning plinth, or a
 * slow fly-over of the chosen arena. One small renderer, only running while it's on screen.
 */
export class Preview {
  private renderer: THREE.WebGLRenderer | null = null;
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

  constructor(private host: HTMLElement) {
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
    const r = new THREE.WebGLRenderer({ antialias: true });
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

  showUnit(id: string) {
    this.ensure();
    this.clear();
    this.mode = 'unit';
    const def = characterById(id);
    this.unit = new ShooterMesh(def.id, def.ball, def);
    this.scene.add(this.plinth, this.unit.root);
    this.scene.background = new THREE.Color(0x1d1b18);
    this.scene.fog = null;
    this.hemi.color.set(0xfff6e8);
    this.hemi.groundColor.set(0x6a6458);
    this.hemi.intensity = 1.5;
    this.sun.intensity = 2.2;
    this.rim.intensity = 1.2;
    // frame the unit's height
    this.unit.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.unit.root);
    const h = Math.max(1.4, box.max.y);
    const w = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    const dist = Math.max(h, w * 0.9) * 2.1 + 0.9;
    this.camera.position.set(0, h * 0.62, -dist);
    this.camera.lookAt(0, h * 0.45, 0);
    this.camera.fov = 30;
    this.camera.updateProjectionMatrix();
    this.start();
  }

  showStage(id: string) {
    this.ensure();
    this.clear();
    this.mode = 'stage';
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
    this.start();
  }

  private clear() {
    if (this.unit) {
      this.scene.remove(this.unit.root, this.plinth);
      this.unit.dispose();
      this.unit = null;
    }
    if (this.stage) {
      this.scene.remove(this.stage.group);
      this.stage.dispose();
      this.stage = null;
    }
  }

  private start() {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
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

  /** stop and free the GPU (leaving the select screens) */
  release() {
    this.stop();
    this.clear();
    if (this.renderer) {
      this.renderer.domElement.remove();
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer = null;
    }
  }

  private shots = new Map<string, string>();
  /** a still of an arena for its tile, rendered once and kept */
  stageShot(id: string) {
    let url = this.shots.get(id);
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
    const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 200);
    cam.position.set(3, 8, 14);
    cam.lookAt(0, 0, -3);
    r.setSize(320, 180, false);
    r.render(scene, cam);
    url = r.domElement.toDataURL('image/jpeg', 0.85);
    stage.dispose();
    r.setSize(keep.x, keep.y, false);
    this.mode = keepMode;
    this.shots.set(id, url);
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
    }
    this.t += dt;
    if (this.mode === 'unit' && this.unit) {
      // mostly the 3/4 front, swinging round to show the sides
      const a = -0.55 + Math.sin(this.t * 0.45) * 0.75;
      this.unit.root.rotation.y = a;
      this.plinth.rotation.y = a;
    } else if (this.stage) {
      // a slow sweep over the table from behind the player's rail
      const a = Math.sin(this.t * 0.25) * 0.5;
      this.camera.position.set(Math.sin(a) * 14, 9 + Math.sin(this.t * 0.3) * 1.2, Math.cos(a) * 15);
      this.camera.lookAt(0, 0, -2);
      this.stage.update(dt, this.t);
    }
    r.render(this.scene, this.camera);
  }
}
