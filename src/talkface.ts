import * as THREE from 'three';
import { ShooterMesh, characterById, studioEnv, type TalkMood } from './robot';
import { celify } from './cel';
import type { Shooter } from './game';

/**
 * The story chat's live face: whoever is speaking, as a moving bust (its talk animation: the
 * jaw or head in a syllable rhythm, the gesture for the line) in a small round window by the
 * newest bubble. One small renderer, moved from bubble to bubble, drawing only while it's shown.
 */
export class TalkFace {
  readonly canvas = document.createElement('canvas');
  private r: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  private unit: ShooterMesh | null = null;
  private id = '';
  private mood: TalkMood = 'say';
  private t = 0;
  private last = 0;
  private raf = 0;
  private framed = false;
  /** a pretend fight state for the unit's own pose code (standing still, not firing) */
  private act = { x: 0, y: 0, team: 0, aim: 0, recoil: 0, vx: 0, firing: false, kickT: 9, heavyT: 9, flash: 0, stagger: 0, health: 100, hand: 1, lastHand: 1, windT: 9, wobble: 0 };

  constructor() {
    this.canvas.className = 'cb-live';
    this.scene.add(new THREE.HemisphereLight(0xdfefff, 0x2a3350, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.position.set(-3, 6, -5);
    this.scene.add(sun);
  }

  private ensure() {
    if (this.r) return this.r;
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    r.setClearColor(0x000000, 0);
    r.setPixelRatio(Math.min(3, window.devicePixelRatio || 1));
    r.setSize(80, 80, false);
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.environment = studioEnv(r);
    this.scene.environmentIntensity = 0.8;
    this.r = r;
    return r;
  }

  /** how big it's drawn (CSS pixels, square) */
  private px = 80;
  size(px: number) {
    if (px === this.px) return;
    this.px = px;
    this.ensure().setSize(px, px, false);
  }

  /** start a line: this fighter, saying it this way */
  show(id: string, mood: TalkMood) {
    this.ensure();
    if (id !== this.id || !this.unit) {
      this.drop();
      const def = characterById(id);
      this.unit = new ShooterMesh(def.id, def.ball, def);
      this.scene.add(this.unit.root);
      this.id = id;
      this.framed = false;
    }
    this.mood = mood;
    this.t = 0;
    if (!this.raf) {
      this.last = performance.now();
      const loop = (now: number) => {
        this.raf = requestAnimationFrame(loop);
        this.frame(Math.min(0.05, (now - this.last) / 1000));
        this.last = now;
      };
      this.raf = requestAnimationFrame(loop);
    }
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private drop() {
    if (!this.unit) return;
    this.scene.remove(this.unit.root);
    this.unit.dispose();
    this.unit = null;
    this.id = '';
  }

  /** the bust: head and shoulders from the front-right, a little below, the frame tilted (as the portraits are) */
  private frameBust(unit: ShooterMesh) {
    unit.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(unit.root);
    const tall = box.max.y - box.min.y;
    box.min.y = box.max.y - tall * 0.5;
    const c = box.getCenter(new THREE.Vector3());
    const eyes = eyeCentre(unit.root, characterById(this.id).palette.eye);
    if (eyes) c.set(eyes.x, eyes.y - tall * 0.12, eyes.z);
    const dir = new THREE.Vector3(0.62, -0.16, -1).normalize();
    this.cam.position.copy(c).addScaledVector(dir, 10);
    this.cam.up.set(Math.sin(0.2), Math.cos(0.2), 0);
    this.cam.lookAt(c);
    let half = Math.max(0.75, tall * 0.4);
    if (!eyes) {
      this.cam.updateMatrixWorld();
      const inv = this.cam.matrixWorldInverse;
      let hw = 0;
      let hh = 0;
      for (const x of [box.min.x, box.max.x])
        for (const y of [box.min.y, box.max.y])
          for (const z of [box.min.z, box.max.z]) {
            const p = new THREE.Vector3(x, y, z).applyMatrix4(inv);
            hw = Math.max(hw, Math.abs(p.x));
            hh = Math.max(hh, Math.abs(p.y));
          }
      half = Math.max(hh, hw * 0.62) * 1.08;
    }
    this.cam.left = this.cam.bottom = -half;
    this.cam.right = this.cam.top = half;
    this.cam.updateProjectionMatrix();
  }

  private frame(dt: number) {
    const u = this.unit;
    const r = this.r;
    if (!u || !r || !this.canvas.isConnected) return;
    this.t += dt;
    u.sync(this.act as unknown as Shooter, this.t, dt);
    u.root.position.x = 0;
    u.root.position.z = 0;
    if (!this.framed) {
      this.frameBust(u);
      this.framed = true;
    }
    u.talkPose(this.t, this.mood, true, 0);
    celify(this.scene, true);
    r.render(this.scene, this.cam);
  }
}

/** where a unit's eyes are: the middle of its glowing parts in the eye colour */
function eyeCentre(root: THREE.Object3D, eye: number) {
  const sum = new THREE.Vector3();
  const p = new THREE.Vector3();
  let n = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    const mat = m.isMesh ? (m.material as THREE.MeshBasicMaterial) : null;
    if (!mat || Array.isArray(mat) || !mat.isMeshBasicMaterial || mat.color.getHex() !== eye) return;
    sum.add(m.getWorldPosition(p));
    n++;
  });
  return n ? sum.divideScalar(n) : null;
}
