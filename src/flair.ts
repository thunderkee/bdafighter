import * as THREE from 'three';
import type { CharacterDef } from './robot';

/**
 * The finish on a fighter, laid over its Unit Lab design when the model is built:
 *  - a shape on its back, so it reads from the chase camera (only those that need one);
 *  - a finish of its own: panel lines on the machines, a polish on the copy;
 *  - thin parts that lag behind the body on a spring (antennae, crests, tails, capes);
 *  - damage: under 30% a panel hangs off, an eye flickers and it throws sparks.
 * Nothing here changes the design itself, or how a fighter plays.
 */

type Palette = CharacterDef['palette'];
type Add = (geo: THREE.BufferGeometry, color: number, p: [number, number, number], r?: [number, number, number], s?: [number, number, number], lit?: boolean) => THREE.Mesh;

/** a flat, four-sided spike */
const spike = (r: number, h: number) => new THREE.ConeGeometry(r, h, 4);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
/** a flat triangular fin, pointing up (+y) */
const fin = (w: number, h: number, d: number) => {
  const g = new THREE.ConeGeometry(0.5, 1, 3);
  g.rotateY(Math.PI / 6);
  g.scale(w, h, d);
  // (reshaped, so the Unit Lab takes it as a drawn shape rather than a plain cone)
  (g as { type: string }).type = 'FinGeometry';
  return g;
};

/** what each fighter wears on its back, in model space (+z is behind it). `sway` marks parts that spring */
const BACK: Record<string, (add: Add, c: Palette, sway: (m: THREE.Mesh) => void) => void> = {
  // Seraph: two fans of blades, the first frame ever built
  angel(add) {
    for (const s of [-1, 1])
      [0.86, 0.72, 0.56].forEach((h, k) => add(box(0.13, h, 0.05), k === 0 ? 0xe8703a : 0xf2efe6, [s * (0.26 + k * 0.1 + (h / 2) * Math.sin(0.3 + k * 0.32)), 1.42 - k * 0.08 + (h / 2) * Math.cos(0.3 + k * 0.32) - 0.3, 0.68], [0.14, 0, -s * (0.3 + k * 0.32)]));
  },
  // Wyvern: folded wings
  dragon(add, c, sway) {
    for (const s of [-1, 1]) {
      sway(add(fin(0.72, 1.15, 0.05), c.body, [s * 0.46, 1.42, 0.62], [0.2, 0, -s * 0.34]));
      add(fin(0.4, 0.8, 0.07), c.trim, [s * 0.5, 1.36, 0.66], [0.2, 0, -s * 0.34]);
    }
  },
  // Pioneer: the marshal's radio pack, siren on top
  pioneer(add, _c, sway) {
    add(box(0.62, 0.72, 0.26), 0x2a3a6a, [0, 1.12, 0.6]);
    add(box(0.5, 0.12, 0.28), 0xffc94a, [0, 1.3, 0.61]);
    add(new THREE.CylinderGeometry(0.11, 0.12, 0.18, 8), 0xff3b4e, [-0.18, 1.57, 0.6]);
    add(new THREE.CylinderGeometry(0.11, 0.12, 0.18, 8), 0x3a8cff, [0.06, 1.57, 0.6]);
    sway(add(box(0.035, 0.9, 0.035), 0x2a3a6a, [0.27, 1.92, 0.6]));
  },
  // Liberty: the crown of rays
  liberty(add, c) {
    for (let k = -3; k <= 3; k++) {
      const a = k * 0.42;
      add(spike(0.08, 0.5), c.trim, [Math.sin(a) * 0.55, 1.58 + Math.cos(a) * 0.5, 0.34], [0, 0, -a]);
    }
  },
  // Bastion: a mantis's wing cases
  bastion(add, c, sway) {
    for (const s of [-1, 1]) {
      sway(add(box(0.3, 1.05, 0.05), c.body, [s * 0.19, 1.34, 0.42], [0.22, 0, s * 0.1]));
      add(box(0.09, 0.95, 0.07), c.accent, [s * 0.25, 1.34, 0.44], [0.22, 0, s * 0.1]);
    }
  },
  // Tyrant King: a ridge of spines
  tyrant(add, c, sway) {
    [0.62, 0.78, 0.7, 0.5].forEach((h, k) => sway(add(spike(0.17, h), k % 2 ? c.accent : c.trim, [0, 1.62 - k * 0.27, 0.56 + k * 0.03], [-0.5, Math.PI / 4, 0])));
  },
  // Rex Saur: plates down the spine, head to tail
  rex(add) {
    [0.72, 0.9, 0.74, 0.52].forEach((h, k) => add(fin(0.56, h, 0.06), 0xff8a3a, [0, 1.42 - k * 0.1 + h * 0.3, -0.02 + k * 0.36], [0, Math.PI / 2, 0]));
  },
  // Fang Hound: blade fins off the shoulders
  liger(add, c, sway) {
    for (const s of [-1, 1]) sway(add(fin(0.26, 0.72, 0.06), c.trim, [s * 0.3, 1.3, 0.22], [0.2, 0, -s * 0.26]));
  },
  // True Leo King: what's left of the royal cape, torn on the road
  trueleo(add, c, sway) {
    add(box(0.92, 0.12, 0.12), c.trim, [0, 1.58, 0.5]);
    [1.36, 1.02, 1.5].forEach((h, k) => sway(add(box(0.3, h, 0.03), k === 1 ? 0x8a1a26 : 0xc4283a, [-0.31 + k * 0.31, 1.54 - h / 2, 0.55 + (k % 2) * 0.02])));
  },
};

interface FaceKit {
  add: Add;
  sway: (m: THREE.Mesh) => void;
  c: Palette;
  eyes: THREE.Mesh[];
  /** the part the face is on (what's added below rides on it, unless `use` says otherwise) */
  head: THREE.Object3D;
  byRole: (role: string) => THREE.Object3D[];
  turret: THREE.Object3D;
  use: (o: THREE.Object3D) => void;
  /** make a part of the design bigger (not in the Unit Lab) */
  enlarge: (o: THREE.Object3D, k: number) => void;
}
const at = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
const ball = (r: number) => new THREE.SphereGeometry(r, 12, 10);
const WHITE = 0xfff8ec;

/** how much bigger each head should sit (people fall for faces) */
const HEAD: Record<string, number> = { bastion: 1.28, monoceros: 1.16, pioneer: 1.16, rex: 1.1, liger: 1.1, violet: 1.14, trueleo: 1.14, angel: 1.08 };

/** what gives each fighter its face and its one memorable thing, in model space */
const FACE: Record<string, (f: FaceKit) => void> = {
  // one huge compound eye
  bastion({ add }) {
    add(ball(0.26), 0xff3f86, [0, 1.52, -0.46], undefined, [1, 1, 0.65], true);
    add(ball(0.09), WHITE, [0.09, 1.61, -0.6], undefined, undefined, true);
  },
  // goggles and a mad grin
  monoceros({ add }) {
    for (const s of [-1, 1]) {
      add(new THREE.TorusGeometry(0.15, 0.04, 8, 20), 0x2a2432, [s * 0.18, 1.1, -0.64]);
      add(new THREE.CircleGeometry(0.13, 18), 0x7affd8, [s * 0.18, 1.1, -0.65], [0, Math.PI, 0], undefined, true);
    }
    add(box(0.46, 0.13, 0.05), WHITE, [0, 0.82, -0.68]);
    for (let k = -2; k <= 2; k++) add(box(0.018, 0.13, 0.06), 0x2a2432, [k * 0.085, 0.82, -0.69]);
  },
  // the marshal's hat and star
  pioneer({ add, use, turret }) {
    add(new THREE.CylinderGeometry(0.34, 0.36, 0.04, 16), 0x24304e, [0, 1.84, -0.08]);
    add(new THREE.CylinderGeometry(0.2, 0.25, 0.26, 12), 0x2d3a60, [0, 1.98, -0.08]);
    add(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 5), 0xffc94a, [0, 1.98, -0.3], [Math.PI / 2, 0, 0]);
    use(turret);
    add(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 5), 0xffc94a, [-0.18, 1.14, -0.5], [Math.PI / 2, 0, 0]);
  },
  // the torch, held high
  liberty({ add, use, turret }) {
    use(turret);
    add(new THREE.CylinderGeometry(0.04, 0.05, 1.05, 8), 0xe8b43a, [0.72, 1.96, -0.1]);
    add(new THREE.CylinderGeometry(0.15, 0.08, 0.16, 10), 0xe8b43a, [0.72, 2.52, -0.1]);
    add(new THREE.ConeGeometry(0.13, 0.42, 6), 0xffb040, [0.72, 2.8, -0.1], undefined, undefined, true);
    add(new THREE.ConeGeometry(0.06, 0.24, 6), 0xfff0a0, [0.72, 2.7, -0.12], undefined, undefined, true);
  },
  // the scarf and the grin
  baron({ add, sway, use, turret }) {
    add(box(0.2, 0.05, 0.03), WHITE, [0, 1.12, -0.44]);
    use(turret);
    for (const x of [-0.08, 0.08]) sway(add(box(0.11, 0.025, 0.72), x < 0 ? 0xf4f0e6 : 0xee2a3a, [x, 1.12, 0.36]));
  },
  // the brow, and bigger fists
  violet({ add, byRole, head, enlarge }) {
    head.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(head);
    add(box(0.46, 0.1, 0.14), 0x2a2036, [(b.min.x + b.max.x) / 2, b.min.y + (b.max.y - b.min.y) * 0.62, b.min.z - 0.02], [0.28, 0, 0]);
    for (const r of [...byRole('fistL'), ...byRole('fistR')]) enlarge(r, 1.25);
  },
  // a pale mask in the hood
  nightshade({ add, head }) {
    head.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(head);
    const y = b.min.y + (b.max.y - b.min.y) * 0.78;
    const z = b.min.z - 0.01;
    add(box(0.3, 0.36, 0.04), 0xf2ece2, [0, y, z]);
    for (const s of [-1, 1]) add(box(0.09, 0.05, 0.03), 0xff4aa0, [s * 0.08, y + 0.05, z - 0.025], [0, 0, s * -0.3], undefined, true);
  },
  // a mane to fill out the face, and a smug lid over each eye
  kabuto({ add, use, turret }) {
    use(turret);
    const cy = 1.34;
    for (let k = 0; k < 11; k++) {
      const a = (k / 11) * Math.PI * 2;
      add(spike(0.1, 0.34), k % 2 ? 0xc8762a : 0xe8a03a, [Math.sin(a) * 0.46, cy + Math.cos(a) * 0.46, -0.14], [0, 0, -a]);
    }
    for (const s of [-1, 1]) add(box(0.16, 0.05, 0.05), 0x3a2008, [s * 0.09, 1.47, -0.27], [0, 0, s * -0.22]);
  },
  // the wolf heads wake up: teeth, and hotter eyes
  tyrant({ add, eyes, use }) {
    for (const e of eyes) (e.material as THREE.MeshBasicMaterial).color.setHex(0xffe94a);
    const seen = new Set<THREE.Object3D>();
    for (const e of eyes) {
      const p = e.parent!;
      if (seen.has(p)) continue;
      seen.add(p);
      const mine = eyes.filter((x) => x.parent === p).map(at);
      const cx = mine.reduce((n, v) => n + v.x, 0) / mine.length;
      const y = mine[0].y;
      const z = mine[0].z;
      use(p);
      for (let k = -2; k <= 2; k++) add(spike(0.045, 0.16), WHITE, [cx + k * 0.08, y - 0.24, z - 0.03], [Math.PI, 0, 0]);
    }
  },
  // a heavier jaw and one broken tooth
  rex({ add, byRole, use, enlarge }) {
    for (const j of byRole('jaw')) {
      enlarge(j, 1.28);
      use(j);
    }
    for (const x of [-0.14, 0.14]) add(spike(0.07, 0.28), WHITE, [x, 1.08, -1.34], [Math.PI, 0, 0]);
    add(spike(0.06, 0.1), 0xdccfb8, [0.02, 1.13, -1.42], [Math.PI, 0, 0.5]);
  },
  // a scowl and fangs
  liger({ add, eyes }) {
    const p = at(eyes[0]);
    for (const s of [-1, 1]) {
      add(box(0.16, 0.04, 0.05), 0x1a1a22, [s * 0.12, p.y + 0.09, p.z - 0.03], [0, 0, s * 0.42]);
      add(spike(0.05, 0.22), WHITE, [s * 0.1, p.y - 0.28, p.z - 0.12], [Math.PI, 0, 0]);
    }
  },
  // great big eyes, and a hood that flops
  ember({ add, head, sway, use, turret }) {
    head.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(head);
    const y = b.min.y + (b.max.y - b.min.y) * 0.42;
    const z = b.min.z;
    for (const s of [-1, 1]) {
      add(ball(0.15), WHITE, [s * 0.2, y, z + 0.04], undefined, [1, 1.1, 0.5]);
      add(ball(0.09), 0x2a1a3a, [s * 0.19, y - 0.01, z - 0.03], undefined, [1, 1.15, 0.5], true);
      add(ball(0.03), WHITE, [s * 0.16, y + 0.05, z - 0.07], undefined, undefined, true);
    }
    use(turret);
    sway(add(new THREE.ConeGeometry(0.2, 0.55, 8), 0xf6f2e8, [0, 1.6, 0.42], [-1.15, 0, 0]));
  },
  // a lion's crest over the heart, to mirror the throne it's owed
  trueleo({ add, use, turret }) {
    use(turret);
    add(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 12), 0xffc94a, [0, 1.0, -0.47], [Math.PI / 2, 0, 0]);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      add(spike(0.04, 0.12), 0xe8a03a, [Math.sin(a) * 0.2, 1.0 + Math.cos(a) * 0.2, -0.47], [0, 0, -a]);
    }
  },
};

/** the copy's crown: a shade too bright, and it doesn't quite fit */
function crown(add: Add) {
  const gold = 0xffdf5a;
  const y = 1.92;
  const tilt: [number, number, number] = [0.08, 0, 0.26];
  add(new THREE.CylinderGeometry(0.2, 0.18, 0.1, 8), gold, [0.04, y, -0.12], tilt);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    add(spike(0.05, 0.16), gold, [0.04 + Math.cos(a) * 0.17 - 0.03, y + 0.11 + Math.cos(a) * -0.04, -0.12 + Math.sin(a) * 0.17], tilt);
  }
}

/** the finish: unused (0), panel lines (0..1), polish (0..1) */
const WEAR: Record<string, [number, number, number]> = {
  angel: [0.015, 0.45, 0.15],
  dragon: [0.08, 0.1, 0],
  pioneer: [0.02, 0.8, 0.25],
  liberty: [0.04, 0.35, 0.1],
  monoceros: [0.07, 0.6, 0],
  baron: [0.06, 0.25, 0.1],
  bastion: [0.09, 0.2, 0],
  nightshade: [0.01, 0.1, 0.2],
  violet: [0.04, 0.3, 0],
  kabuto: [0, 0.15, 0.9],
  tyrant: [0.1, 0.15, 0],
  rex: [0.16, 0.05, 0],
  liger: [0.06, 0.3, 0.1],
  ember: [0, 0, 0.1],
  trueleo: [0.17, 0.25, 0],
};

function paintWear(mat: THREE.Material, wear: [number, number, number]) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.uniforms.uWear = { value: new THREE.Vector3(...wear) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWearP;\nvarying vec3 vWearN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWearP = position;\nvWearN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uWear;\nvarying vec3 vWearP;\nvarying vec3 vWearN;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          diffuseColor.rgb *= 1.0 - uWear.y * step(0.9, fract(vWearP.y * 6.5)) * 0.3;
          diffuseColor.rgb += uWear.z * step(0.5, vWearN.y) * 0.16;
        }`,
      );
  };
  mat.needsUpdate = true;
}

/** a part on a spring, hinged at the end nearest the body */
interface Spring {
  pivot: THREE.Group;
  ax: number;
  az: number;
  vx: number;
  vz: number;
  /** how long and loose it is */
  gain: number;
  phase: number;
}

/** the roles that already animate (or that a spring would only disturb) */
const STILL = new Set(['leg', 'barrel', 'barrelL', 'belly', 'bellyL', 'punch', 'swing', 'slash', 'slashL', 'armR', 'armL', 'finger', 'jaw', 'trigger', 'flame']);

const SPARKS = 5;

export class Flair {
  private springs: Spring[] = [];
  private eyes: THREE.Object3D[] = [];
  /** the panels that hang off when it's badly hurt, and how they sit normally */
  private panels: { o: THREE.Object3D; p: THREE.Vector3; rz: number; out: THREE.Vector3 }[] = [];
  private sparks: THREE.Mesh[] = [];
  private sparkAt = new THREE.Vector3();
  private hurt = false;
  private last: THREE.Vector3 | null = null;
  private vel = new THREE.Vector3();
  private lastTurn = 0;
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();

  constructor(
    private root: THREE.Object3D,
    private turret: THREE.Object3D,
    id: string,
    def: CharacterDef,
    mats: THREE.Material[],
    private isEye: (m: THREE.Mesh) => boolean,
    /** the Unit Lab: add the finish, but don't move, rehang or resize any block of the design */
    private still = false,
  ) {
    const key = id.replace(/-\d+$/, '');
    root.updateMatrixWorld(true);
    const swayed: THREE.Mesh[] = [];
    let holder: THREE.Object3D = turret;
    // what the pieces are called in the Unit Lab
    let label = 'Back shape';
    // (edited in the Lab: the pieces are blocks of the design now, and aren't added again)
    const baked = !!def.blueprint?.baked;
    const add: Add = (geo, color, p, r, s, lit) => {
      if (baked) return new THREE.Mesh(geo);
      const mat = lit ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color });
      if (!lit) mats.push(mat);
      const m = new THREE.Mesh(geo, mat);
      // (authored in model space; it rides on the torso so it turns with the aim)
      m.position.set(...p);
      if (r) m.rotation.set(...r);
      if (s) m.scale.set(...s);
      root.add(m);
      holder.attach(m);
      m.userData.flair = true;
      m.name = label;
      return m;
    };
    const sway = (m: THREE.Mesh) => {
      m.userData.finishRole = 'sway';
      swayed.push(m);
    };
    BACK[key]?.(add, def.palette, sway);
    label = 'Crown';
    if (key === 'kabuto') crown(add);
    // the face, and whatever makes this fighter itself
    root.updateMatrixWorld(true);
    const eyes: THREE.Mesh[] = [];
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && this.isEye(o as THREE.Mesh)) eyes.push(o as THREE.Mesh);
    });
    const byRole = (role: string) => {
      const out: THREE.Object3D[] = [];
      root.traverse((o) => {
        if (o.userData.role === role) out.push(o);
      });
      return out;
    };
    const look = FACE[key];
    if (look) {
      const head = eyes.find((e) => e.parent !== turret)?.parent ?? byRole('head')[0] ?? byRole('tilt')[0] ?? turret;
      holder = head;
      label = 'Face detail';
      look({ add, sway, c: def.palette, eyes, head, byRole, turret, use: (o) => (holder = o), enlarge: (o, k) => !this.still && o.scale.multiplyScalar(k) });
      holder = turret;
      if (HEAD[key] && head !== turret && !still) head.scale.multiplyScalar(HEAD[key]);
    }
    this.grow(def);
    if (baked) {
      swayed.length = 0;
      for (const o of byRole('sway')) if ((o as THREE.Mesh).isMesh) swayed.push(o as THREE.Mesh);
    }
    root.updateMatrixWorld(true);

    this.wear = WEAR[key] ?? null;

    if (!still) this.findParts(swayed);
    const spark = new THREE.MeshBasicMaterial({ color: 0xffc84a });
    const geo = new THREE.BoxGeometry(0.035, 0.035, 0.035);
    for (let k = 0; k < SPARKS; k++) {
      const m = new THREE.Mesh(geo, spark);
      m.visible = false;
      root.add(m);
      this.sparks.push(m);
    }
  }

  /** the forms of an evolution: shards, then a halo of light (every form stands the same size) */
  private orbit: THREE.Group | null = null;
  private backLight: THREE.Object3D[] = [];
  showBackLight(on: boolean) {
    for (const o of this.backLight) o.visible = on;
  }
  private grow(def: CharacterDef) {
    const form = def.form ?? 0;
    if (!form) return;
    if (def.blueprint?.baked) {
      this.root.traverse((o) => {
        if (o.userData.role === 'orbit') this.orbit = o as THREE.Group;
        if (o.userData.role === 'backlight') this.backLight.push(o);
      });
      return;
    }
    const c = def.palette;
    const body = new THREE.Box3().setFromObject(this.root);
    const top = body.max.y;
    const glow = c.eye;
    if (form >= 3) {
      const g = new THREE.Group();
      g.position.y = top * 0.58;
      g.name = 'Orbiting shards';
      g.userData.finishRole = 'orbit';
      this.root.add(g);
      this.orbit = g;
      const n = form >= 4 ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.1 + form * 0.012), new THREE.MeshBasicMaterial({ color: i % 2 ? c.trim : glow }));
        m.name = 'Shard';
        m.position.set(Math.cos(a) * 0.95, Math.sin(a * 2) * 0.22, Math.sin(a) * 0.95);
        g.add(m);
      }
    }
    if (form >= 4) {
      // the final form: a halo, and two great blades of light on its back
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: glow }));
      halo.name = 'Halo';
      halo.userData.finishRole = 'backlight';
      halo.position.set(0, top * 0.8, 0.62);
      this.root.add(halo);
      this.backLight.push(halo);
      const light = new THREE.MeshBasicMaterial({ color: c.trim, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
      for (const s of [-1, 1]) {
        const blade = new THREE.Mesh(fin(0.5, 1.9, 0.02), light);
        blade.name = 'Blade of light';
        blade.userData.finishRole = 'backlight';
        blade.position.set(s * 0.72, top * 0.72, 0.66);
        blade.rotation.set(0.1, 0, -s * 0.55);
        this.root.add(blade);
        this.backLight.push(blade);
      }
    }
  }

  private wear: [number, number, number] | null = null;
  /** the painted wear, on the model's finished materials */
  paint(mats: THREE.Material[]) {
    if (this.wear) for (const m of mats) paintWear(m, this.wear);
  }

  /** go through the design: eyes, thin outer parts for the springs, panels that can come loose */
  private findParts(swayed: THREE.Mesh[]) {
    const body = new THREE.Box3().setFromObject(this.root);
    const h = body.max.y - body.min.y;
    const size = new THREE.Vector3();
    const centre = new THREE.Vector3();
    const thin: { m: THREE.Mesh; len: number; axis: 0 | 1 | 2 }[] = [];
    const loose: { m: THREE.Mesh; c: THREE.Vector3 }[] = [];
    const moved = (o: THREE.Object3D) => {
      for (let p: THREE.Object3D | null = o; p && p !== this.root; p = p.parent) if (STILL.has(p.userData.role as string)) return true;
      return false;
    };
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.children.length || swayed.includes(m)) return;
      if (this.isEye(m)) {
        this.eyes.push(m);
        return;
      }
      if (moved(m) || !m.geometry) return;
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox!;
      bb.getSize(size);
      bb.getCenter(centre);
      m.localToWorld(centre);
      const dims = [size.x, size.y, size.z];
      const order = [0, 1, 2].sort((a, b) => dims[b] - dims[a]) as (0 | 1 | 2)[];
      const [d1, d2] = [dims[order[0]], dims[order[1]]];
      // thin, long and out at the edges: above the shoulders, or trailing behind
      if (d1 > 0.2 && d2 < 0.17 && d1 / d2 > 2.4 && (centre.y > body.min.y + h * 0.72 || centre.z > body.max.z * 0.6)) thin.push({ m, len: d1, axis: order[0] });
      // a plate on the upper body, to hang off when it's hurt
      else if (d1 > 0.16 && d1 < 0.6 && centre.y > body.min.y + h * 0.4 && centre.y < body.min.y + h * 0.85 && Math.abs(centre.x) > 0.12) loose.push({ m, c: centre.clone() });
    });
    thin.sort((a, b) => b.len - a.len);
    for (const m of swayed) this.hinge(m, 1, 1.6);
    for (const t of thin.slice(0, 6)) this.hinge(t.m, t.axis, Math.min(1.2, t.len * 2));
    // (one on each side, the highest)
    loose.sort((a, b) => b.c.y - a.c.y);
    for (const side of [-1, 1]) {
      const l = loose.find((x) => Math.sign(x.c.x) === side);
      if (!l) continue;
      this.panels.push({ o: l.m, p: l.m.position.clone(), rz: l.m.rotation.z, out: new THREE.Vector3(side * 0.05, -0.05, 0.03) });
      if (!this.sparkAt.lengthSq()) this.sparkAt.copy(this.root.worldToLocal(l.c.clone()));
    }
  }

  /** hang a part on a pivot at the end nearest the body */
  private hinge(m: THREE.Mesh, axis: 0 | 1 | 2, gain: number) {
    const parent = m.parent;
    if (!parent || !m.geometry) return;
    m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox!;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    a.setComponent(axis, bb.min.getComponent(axis));
    b.setComponent(axis, bb.max.getComponent(axis));
    const at = (v: THREE.Vector3) => m.localToWorld(v.clone());
    const wa = at(a);
    const wb = at(b);
    const c = new THREE.Vector3(0, this.turret.getWorldPosition(new THREE.Vector3()).y, 0);
    const near = wa.distanceTo(c) < wb.distanceTo(c) ? wa : wb;
    const pivot = new THREE.Group();
    parent.add(pivot);
    parent.worldToLocal(near);
    pivot.position.copy(near);
    pivot.updateMatrixWorld(true);
    pivot.attach(m);
    this.springs.push({ pivot, ax: 0, az: 0, vx: 0, vz: 0, gain, phase: this.springs.length * 1.7 });
  }

  /** each frame, after the fighter is posed. `hp` is its health as a share (0..1) */
  update(time: number, dt: number, hp: number, recoil: number) {
    if (dt <= 0) return;
    this.root.getWorldPosition(this.v);
    // the body's push, in its own frame
    let ax = 0;
    let az = 0;
    if (this.last) {
      const vx = Math.max(-16, Math.min(16, (this.v.x - this.last.x) / dt));
      const vz = Math.max(-16, Math.min(16, (this.v.z - this.last.z) / dt));
      const dvx = vx - this.vel.x;
      const dvz = vz - this.vel.z;
      this.vel.set(vx, 0, vz);
      this.root.getWorldQuaternion(this.q).invert();
      const push = new THREE.Vector3(dvx, 0, dvz).applyQuaternion(this.q);
      ax = push.x;
      az = push.z;
    } else this.last = new THREE.Vector3();
    this.last.copy(this.v);
    const turn = this.turret.rotation.y;
    const spin = Math.max(-6, Math.min(6, (turn - this.lastTurn) / dt));
    this.lastTurn = turn;
    const k = 110;
    const c = 8;
    for (const s of this.springs) {
      const fx = az * 1.5 + recoil * 5;
      const fz = -ax * 1.5 + spin * 0.6;
      s.vx += (-k * s.ax - c * s.vx + fx * s.gain * 2.2) * dt;
      s.vz += (-k * s.az - c * s.vz + fz * s.gain * 2.2) * dt;
      s.ax = Math.max(-0.42, Math.min(0.42, s.ax + s.vx * dt));
      s.az = Math.max(-0.42, Math.min(0.42, s.az + s.vz * dt));
      s.pivot.rotation.x = s.ax + Math.sin(time * 1.7 + s.phase) * 0.025 * s.gain;
      s.pivot.rotation.z = s.az + Math.cos(time * 1.3 + s.phase) * 0.02 * s.gain;
    }
    if (this.orbit) this.orbit.rotation.y = time * 0.9;
    this.damage(time, hp);
  }

  private damage(time: number, hp: number) {
    const hurt = hp > 0 && hp < 0.3;
    if (hurt !== this.hurt) {
      this.hurt = hurt;
      for (const p of this.panels) {
        p.o.position.copy(p.p);
        p.o.rotation.z = p.rz;
        if (hurt) {
          p.o.position.add(p.out);
          p.o.rotation.z += p.out.x > 0 ? -0.55 : 0.55;
        }
      }
      if (!hurt) {
        for (const e of this.eyes) e.visible = true;
        for (const s of this.sparks) s.visible = false;
      }
    }
    if (!hurt) return;
    // one eye (the first found) stutters
    const eye = this.eyes[0];
    if (eye) eye.visible = Math.sin(time * 31) + Math.sin(time * 17.3) > -0.9;
    // a little fountain from the loose panel
    this.sparks.forEach((s, i) => {
      const u = (time * 1.4 + i / SPARKS) % 1;
      const seed = i * 2.4 + Math.floor(time * 1.4 + i / SPARKS) * 1.3;
      s.visible = u < 0.7;
      s.position.set(this.sparkAt.x + Math.sin(seed) * u * 0.32, this.sparkAt.y + u * 0.34 - u * u * 0.62, this.sparkAt.z + Math.cos(seed) * u * 0.32);
    });
  }
}

/** how each fighter arrives in the VS intro */
type Entrance = 'land' | 'hover' | 'skid' | 'shadow' | 'rise' | 'stomp' | 'dash';
const ENTRANCE: Record<string, Entrance> = {
  angel: 'hover',
  dragon: 'land',
  pioneer: 'skid',
  liberty: 'rise',
  monoceros: 'land',
  baron: 'skid',
  bastion: 'shadow',
  nightshade: 'shadow',
  violet: 'stomp',
  kabuto: 'hover',
  tyrant: 'stomp',
  rex: 'rise',
  liger: 'dash',
  ember: 'land',
  trueleo: 'dash',
};
const out3 = (u: number) => 1 - (1 - Math.min(1, Math.max(0, u))) ** 3;

/**
 * pose a fighter for its entrance, t seconds in (before 0 it's not here yet). Laid over its pose
 * each frame. Returns how solid it is, and whether it hit the ground on this frame.
 */
export function entrance(root: THREE.Object3D, id: string, t: number, dt: number, team: number): { alpha: number; impact: boolean } {
  const kind = ENTRANCE[id.replace(/-\d+$/, '')] ?? 'land';
  const away = team === 0 ? 1 : -1;
  if (t < 0) {
    root.visible = false;
    return { alpha: 1, impact: false };
  }
  let alpha = 1;
  let touch = -1;
  switch (kind) {
    case 'land': {
      touch = 0.5;
      const u = Math.min(1, t / touch);
      root.position.y += 9 * (1 - u * u);
      const bump = t > touch ? Math.exp(-(t - touch) * 9) : 0;
      root.scale.y *= 1 - bump * 0.3;
      root.scale.x *= 1 + bump * 0.2;
      root.scale.z *= 1 + bump * 0.2;
      break;
    }
    case 'hover': {
      const e = out3(t / 1.1);
      root.position.y += 5 * (1 - e);
      root.rotation.y += (1 - e) * 2.4;
      break;
    }
    case 'skid': {
      touch = 0.05;
      const e = out3(t / 0.75);
      const side = team === 0 ? -1 : 1;
      root.position.x += side * 9 * (1 - e);
      root.rotation.z += side * 0.34 * (1 - e);
      break;
    }
    case 'shadow': {
      alpha = Math.min(1, t / 0.9);
      root.scale.y *= 0.55 + 0.45 * out3(t / 0.9);
      break;
    }
    case 'rise': {
      root.position.y -= 2.6 * (1 - out3(t / 1));
      break;
    }
    case 'stomp': {
      const u = Math.min(1, t / 1);
      root.position.z += away * 6 * (1 - u);
      root.position.y += u < 1 ? Math.abs(Math.sin(t * 9.4)) * 0.34 : 0;
      touch = 1;
      break;
    }
    case 'dash': {
      touch = 0.32;
      const e = out3(t / 0.32);
      root.position.z += away * 13 * (1 - e);
      root.rotation.x += -away * 0.5 * (1 - e) * (team === 0 ? 1 : -1);
      break;
    }
  }
  return { alpha, impact: touch >= 0 && t >= touch && t - dt < touch };
}
