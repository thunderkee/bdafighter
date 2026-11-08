import * as THREE from 'three';

/**
 * What the arenas do back: what a marble kicks up where it lands, the light moving over a stage,
 * the marks a fight leaves, and the motes hanging in the air. Shared by the table and Action.
 */

export interface Impact {
  color: number;
  /** a soft puff, a ring on water, or hot sparks */
  kind: 'puff' | 'splash' | 'spark';
}
const IMPACTS: Record<string, Impact> = {
  beach: { color: 0xf3e0b4, kind: 'puff' },
  sandglass: { color: 0xe8c080, kind: 'puff' },
  snow: { color: 0xffffff, kind: 'puff' },
  forest: { color: 0x9ad0ff, kind: 'splash' },
  serpent: { color: 0x8ad07a, kind: 'puff' },
  river: { color: 0xa8d0ff, kind: 'splash' },
  lava: { color: 0xff8a3a, kind: 'spark' },
  cyber: { color: 0x2bf0ff, kind: 'spark' },
  space: { color: 0x7ad8ff, kind: 'spark' },
  crystal: { color: 0xa8f0ff, kind: 'spark' },
  city: { color: 0xc8c8d0, kind: 'puff' },
  soccer: { color: 0x7ac86a, kind: 'puff' },
  meadow: { color: 0x9ad07a, kind: 'puff' },
};
const DUST: Impact = { color: 0xb8a890, kind: 'puff' };
export const impactOf = (stage: string): Impact => IMPACTS[stage] ?? DUST;

/** how the stage's light is moving just now, as a multiplier on its usual strength */
export function stageLight(stage: string, t: number) {
  switch (stage) {
    case 'space':
    case 'crystal':
      // the planet's slow turn takes the sun across the deck
      return 1 + Math.sin(t * 0.32) * 0.2;
    case 'lava': {
      // a slow surge from the pit
      const s = Math.sin(t * 0.55);
      return 0.92 + s * s * s * 0.24;
    }
    case 'cyber':
    case 'city':
      // a bad transformer, now and then
      return Math.sin(t * 0.9) > 0.97 && Math.sin(t * 37) > 0 ? 0.72 : 1;
    case 'forest':
      // far-off lightning
      return Math.sin(t * 0.41) > 0.992 ? 1.7 : 0.96;
    case 'river':
    case 'beach':
    case 'serpent':
    case 'sandglass':
      // clouds going over
      return 0.94 + (Math.sin(t * 0.23) + Math.sin(t * 0.37 + 1)) * 0.05;
    default:
      return 1;
  }
}

/** the marks of a fight: dark scorches on the ground, kept until the match is over */
export class Scars {
  readonly mesh: THREE.InstancedMesh;
  private n = 0;
  private m = new THREE.Object3D();
  constructor(max = 64) {
    // (an uneven patch rather than a clean disc)
    const shape = new THREE.Shape();
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const r = 0.72 + 0.28 * Math.sin(k * 2.7) * Math.cos(k * 1.3);
      if (k) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0x1a1410, transparent: true, opacity: 0.34, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 1;
  }
  add(x: number, z: number, size: number, y = 0.012) {
    const cap = this.mesh.instanceMatrix.count;
    this.m.position.set(x, y, z);
    this.m.rotation.y = Math.random() * Math.PI * 2;
    this.m.scale.setScalar(size * (0.8 + Math.random() * 0.4));
    this.m.updateMatrix();
    this.mesh.setMatrixAt(this.n % cap, this.m.matrix);
    this.n++;
    this.mesh.count = Math.min(cap, this.n);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() {
    this.n = 0;
    this.mesh.count = 0;
  }
}

type MoteKind = 'rise' | 'fall' | 'drift';
const MOTES: Record<string, { color: number; kind: MoteKind; speed: number; size: number; glow?: boolean }> = {
  snow: { color: 0xffffff, kind: 'fall', speed: 1.1, size: 0.12 },
  forest: { color: 0xbfe0ff, kind: 'fall', speed: 9, size: 0.06 },
  lava: { color: 0xff8a3a, kind: 'rise', speed: 1.4, size: 0.1, glow: true },
  cyber: { color: 0xff5ae8, kind: 'rise', speed: 0.7, size: 0.08, glow: true },
  space: { color: 0x9ae0ff, kind: 'drift', speed: 0.4, size: 0.07, glow: true },
  city: { color: 0xd8d8e0, kind: 'drift', speed: 0.6, size: 0.05 },
  beach: { color: 0xfff2d0, kind: 'drift', speed: 0.9, size: 0.05 },
  river: { color: 0xffe0a8, kind: 'drift', speed: 0.3, size: 0.06, glow: true },
  meadow: { color: 0xf0ffb0, kind: 'drift', speed: 0.4, size: 0.06 },
  soccer: { color: 0xffffff, kind: 'drift', speed: 0.5, size: 0.04 },
};
const DUNGEON_MOTE = { color: 0xd8c0a0, kind: 'drift' as MoteKind, speed: 0.15, size: 0.05 };

/** what hangs in the air over an Action arena */
export class Motes {
  readonly points: THREE.Points;
  private spec: (typeof MOTES)[string];
  private pos: Float32Array;
  private seed: Float32Array;
  constructor(stage: string, private w: number, d: number, count = 90) {
    this.spec = MOTES[stage] ?? DUNGEON_MOTE;
    this.pos = new Float32Array(count * 3);
    this.seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.pos[i * 3] = (Math.random() - 0.5) * w;
      this.pos[i * 3 + 1] = Math.random() * 6;
      this.pos[i * 3 + 2] = (Math.random() - 0.5) * d;
      this.seed[i] = Math.random() * 10;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ color: this.spec.color, size: this.spec.size, transparent: true, opacity: 0.8, depthWrite: false, blending: this.spec.glow ? THREE.AdditiveBlending : THREE.NormalBlending }));
    this.points.frustumCulled = false;
  }
  update(dt: number, t: number) {
    const { kind, speed } = this.spec;
    const p = this.pos;
    for (let i = 0; i < this.seed.length; i++) {
      const s = this.seed[i];
      if (kind === 'fall') {
        p[i * 3 + 1] -= dt * speed * (0.7 + (s % 1) * 0.6);
        if (p[i * 3 + 1] < 0) p[i * 3 + 1] = 6;
      } else if (kind === 'rise') {
        p[i * 3 + 1] += dt * speed * (0.7 + (s % 1) * 0.6);
        if (p[i * 3 + 1] > 6) p[i * 3 + 1] = 0;
      } else p[i * 3 + 1] += Math.sin(t * 0.6 + s) * dt * 0.12;
      p[i * 3] += Math.sin(t * 0.5 + s) * dt * speed * 0.5;
      if (Math.abs(p[i * 3]) > this.w / 2) p[i * 3] *= -0.98;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
