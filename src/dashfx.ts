import * as THREE from 'three';

/**
 * The look of a dash: glowing afterimages of the fighter left along its path, and bright speed
 * streaks on the floor behind it. Shared by the rail matches and the arena. Afterimages are
 * copies of the model (its geometry is shared, never freed here) in one flat additive colour,
 * so they glow without outlines and fade out in a fraction of a second.
 */
const GHOST_LIFE = 0.28;
const STREAK_LIFE = 0.3;
/** an afterimage every so often while the dash lasts */
const GHOST_EVERY = 0.035;

interface Fading {
  obj: THREE.Object3D;
  mat: THREE.MeshBasicMaterial;
  life: number;
  max: number;
  from: number;
  /** streaks also stretch out and thin as they go */
  streak?: { len: number };
}

const streakGeo = new THREE.PlaneGeometry(1, 1);
// (flat on the floor, its length along +x)
streakGeo.rotateX(-Math.PI / 2);

export class DashFx {
  private live: Fading[] = [];
  /** time since the last afterimage, per fighter that is dashing */
  private since = new Map<unknown, number>();

  constructor(private scene: THREE.Scene) {}

  /**
   * Call every frame for a fighter while it dashes: drops afterimages along its path.
   * `root` is the model as it stands right now; `key` tells fighters apart.
   */
  dashing(key: unknown, root: THREE.Object3D, color: THREE.ColorRepresentation, dt: number) {
    const t = (this.since.get(key) ?? GHOST_EVERY) + dt;
    if (t < GHOST_EVERY) {
      this.since.set(key, t);
      return;
    }
    this.since.set(key, 0);
    this.ghost(root, color);
  }

  /** the dash has ended: the next one starts with an afterimage straight away */
  stopped(key: unknown) {
    this.since.delete(key);
  }

  /** a glowing copy of the model where it stands */
  ghost(root: THREE.Object3D, color: THREE.ColorRepresentation) {
    root.updateWorldMatrix(true, true);
    const copy = root.clone(true);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    mat.userData.noCel = true;
    copy.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = mat;
        m.castShadow = false;
        m.renderOrder = 4;
      }
    });
    // (stands exactly where the model is in the world, whatever it's parented to)
    copy.matrixAutoUpdate = false;
    copy.matrix.copy(root.matrixWorld);
    copy.matrixWorldNeedsUpdate = true;
    this.scene.add(copy);
    this.live.push({ obj: copy, mat, life: GHOST_LIFE, max: GHOST_LIFE, from: 0.55 });
  }

  /**
   * Speed streaks on the floor: a few bright lines from `at` back the way it came. `dir` is the
   * dash direction on the floor (x, z), `y` the floor height, `width` how far apart they spread.
   */
  streaks(at: { x: number; z: number }, dir: { x: number; z: number }, y: number, color: THREE.ColorRepresentation, width = 0.7) {
    const len = Math.hypot(dir.x, dir.z) || 1;
    const dx = dir.x / len;
    const dz = dir.z / len;
    // across the dash
    const sx = -dz;
    const sz = dx;
    for (let k = 0; k < 5; k++) {
      const off = (k / 4 - 0.5) * width * 2 + (Math.random() - 0.5) * 0.12;
      const l = 1.6 + Math.random() * 1.2;
      const back = 0.3 + Math.random() * 0.5;
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      mat.userData.noCel = true;
      const m = new THREE.Mesh(streakGeo, mat);
      m.renderOrder = 4;
      // centred behind the fighter, pointing along the dash
      m.position.set(at.x - dx * (back + l / 2) + sx * off, y + 0.02 + k * 0.002, at.z - dz * (back + l / 2) + sz * off);
      m.rotation.y = -Math.atan2(dz, dx);
      m.scale.set(l, 1, 0.1 + Math.random() * 0.06);
      this.scene.add(m);
      this.live.push({ obj: m, mat, life: STREAK_LIFE, max: STREAK_LIFE, from: 1, streak: { len: l } });
    }
  }

  update(dt: number) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const f = this.live[i];
      f.life -= dt;
      const k = Math.max(0, f.life / f.max);
      f.mat.opacity = f.from * k * k;
      if (f.streak) {
        // longer and thinner as it fades
        f.obj.scale.x = f.streak.len * (1 + (1 - k) * 0.6);
        f.obj.scale.z *= 0.96;
      }
      if (f.life <= 0) {
        f.obj.removeFromParent();
        f.mat.dispose();
        this.live.splice(i, 1);
      }
    }
  }

  clear() {
    for (const f of this.live) {
      f.obj.removeFromParent();
      f.mat.dispose();
    }
    this.live = [];
    this.since.clear();
  }
}
