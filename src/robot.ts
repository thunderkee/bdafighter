import * as THREE from 'three';
import type { Shooter } from './game';
import { loadRoster, type Block, type ColorRef, type Role, type RosterData, type Traits, type V3 } from './roster';

/**
 * SD (super-deformed) marble-shooter robots built from primitives:
 * a huge head, stubby body and big feet. Each character is pure data — a
 * palette plus a pick of crest, eyes, wings, shoulders, off-hand gear and
 * feet — so new robots need no new build code.
 * Part slots stay visible on every robot:
 *   barrel   -> chest cannon       core -> torso
 * Footprint matches the physics collider (about 1.24 x 1.0).
 * These are placeholder designs inspired by existing mecha; replace them
 * with original designs before a public release.
 */


interface Palette {
  body: number;
  trim: number;
  accent: number;
  joint: number;
  wing: number;
  wingTip: number;
  eye: number;
}

export interface CharacterDef {
  id: string;
  name: string;
  /** this unit's marble colour */
  ball: number;
  palette: Palette;
  crest: 'vfin' | 'vfin-short' | 'horns' | 'unihorn' | 'fin' | 'eva' | 'beetle' | 'tyrant';
  /** body plan: humanoid mech (default) or a beast that fires from its mouth */
  body?: 'mech' | 'rex' | 'cat' | 'lizard' | 'beetle';
  /** mech gun: chest cannon (default) or a T-rex head blaster */
  barrel?: 'chest' | 'rexhead';
  /** portrait style */
  face?: 'mech' | 'beast' | 'cute';
  eyes: 'twin' | 'mono';
  /** back thruster pods (wings were removed) */
  wings: 'pods' | 'none';
  shoulders: 'round' | 'spike' | 'heavy';
  offhand: 'shield' | 'coil' | 'scythe' | 'gatling' | 'none';
  feet: 'toe' | 'claw';
  /** dark face plate under a coloured helmet */
  darkFace?: boolean;
  /** glowing frame lines on the limbs and torso */
  glow?: number;
  /** gameplay traits (1-5, 3 = standard); edited in the Unit Lab */
  traits?: Traits;
  /** a block design from the Unit Lab; replaces the built-in model */
  blueprint?: Block;
  /** custom units: the built-in they started from */
  base?: string;
}

/** the units as shipped; the roster layers edits and custom units on top */
export const BUILTINS: readonly CharacterDef[] = [
  {
    id: 'angel',
    ball: 0x6fa8ff,
    name: 'Seraph Zero',
    palette: { body: 0xf4f4f8, trim: 0x2f63e8, accent: 0xe8312f, joint: 0x5a5f73, wing: 0xf8f8fc, wingTip: 0x2f63e8, eye: 0x6dff9a },
    crest: 'vfin',
    eyes: 'twin',
    wings: 'none',
    shoulders: 'round',
    offhand: 'shield',
    feet: 'toe',
  },
  {
    id: 'dragon',
    ball: 0xff5040,
    name: 'Wyvern',
    palette: { body: 0x9c1b2e, trim: 0x3d3a4c, accent: 0xffc23d, joint: 0x26232f, wing: 0x5e1020, wingTip: 0x9c1b2e, eye: 0xc8ff3d },
    crest: 'horns',
    eyes: 'twin',
    wings: 'none',
    shoulders: 'spike',
    offhand: 'coil',
    feet: 'claw',
    darkFace: true,
  },
  {
    id: 'pioneer',
    ball: 0xf4ecd0,
    name: 'Pioneer',
    palette: { body: 0xf2f0ea, trim: 0x2950c8, accent: 0xd8262b, joint: 0x5d6070, wing: 0xf2f0ea, wingTip: 0x2950c8, eye: 0x7ff0ff },
    crest: 'vfin-short',
    eyes: 'twin',
    wings: 'none',
    shoulders: 'round',
    offhand: 'shield',
    feet: 'toe',
  },
  {
    id: 'liberty',
    ball: 0xffd04a,
    name: 'Liberty',
    palette: { body: 0xf6f6fa, trim: 0x2b58d6, accent: 0xffc23d, joint: 0xd9a92a, wing: 0x2346b8, wingTip: 0xffd45e, eye: 0x6dff9a },
    crest: 'vfin',
    eyes: 'twin',
    wings: 'none',
    shoulders: 'round',
    offhand: 'shield',
    feet: 'toe',
  },
  {
    id: 'monoceros',
    ball: 0xff4fa8,
    name: 'Monoceros',
    palette: { body: 0xf7f7f7, trim: 0xe9e9ef, accent: 0xff2d55, joint: 0x6a6d7c, wing: 0xf7f7f7, wingTip: 0xff2d55, eye: 0xffe14d },
    crest: 'unihorn',
    eyes: 'twin',
    wings: 'none',
    shoulders: 'heavy',
    offhand: 'shield',
    feet: 'toe',
    glow: 0xff2d55,
  },
  {
    id: 'baron',
    ball: 0xff9a2e,
    name: 'Crimson Baron',
    palette: { body: 0xd2202e, trim: 0x8e1220, accent: 0xffc23d, joint: 0x3a2a30, wing: 0x8e1220, wingTip: 0xd2202e, eye: 0xff5fd0 },
    crest: 'fin',
    eyes: 'mono',
    wings: 'pods',
    shoulders: 'heavy',
    offhand: 'shield',
    feet: 'claw',
    darkFace: true,
  },
  {
    id: 'bastion',
    ball: 0x8dff5a,
    name: 'Bastion',
    palette: { body: 0xeef0ea, trim: 0x3c8f4a, accent: 0xd8262b, joint: 0x4a4e5a, wing: 0x3c8f4a, wingTip: 0xeef0ea, eye: 0x7ff0ff },
    crest: 'vfin-short',
    eyes: 'twin',
    wings: 'pods',
    shoulders: 'heavy',
    offhand: 'gatling',
    feet: 'toe',
  },
  {
    id: 'nightshade',
    ball: 0xb07cff,
    name: 'Nightshade',
    palette: { body: 0x23212c, trim: 0x4a4658, accent: 0x34e07a, joint: 0x15141b, wing: 0x1a1922, wingTip: 0x34e07a, eye: 0x34e07a },
    crest: 'vfin',
    eyes: 'twin',
    wings: 'none',
    shoulders: 'round',
    offhand: 'scythe',
    feet: 'toe',
    darkFace: true,
  },
  {
    id: 'violet',
    ball: 0x9cff5a,
    name: 'Unit Violet',
    palette: { body: 0x5b2c8f, trim: 0x2a1a3a, accent: 0xff8a2a, joint: 0x23162f, wing: 0x5b2c8f, wingTip: 0x7cff5a, eye: 0xffe14d },
    crest: 'eva',
    eyes: 'twin',
    wings: 'none',
    shoulders: 'heavy',
    offhand: 'none',
    feet: 'toe',
    glow: 0x7cff5a,
  },
  {
    id: 'kabuto',
    ball: 0xffe14d,
    name: 'Kabuto Bee',
    palette: { body: 0xf2b20f, trim: 0x1d1d24, accent: 0xe8312f, joint: 0x2c2c34, wing: 0xf2b20f, wingTip: 0x1d1d24, eye: 0x4dff6a },
    crest: 'beetle',
    body: 'beetle',
    darkFace: true,
    eyes: 'twin',
    wings: 'none',
    shoulders: 'round',
    offhand: 'gatling',
    feet: 'toe',
  },
  {
    id: 'tyrant',
    ball: 0xb050ff,
    name: 'Tyrant King',
    palette: { body: 0x6a2a9a, trim: 0x3d3a4c, accent: 0xffc23d, joint: 0x241a30, wing: 0x6a2a9a, wingTip: 0xffc23d, eye: 0xff3030 },
    crest: 'tyrant',
    eyes: 'twin',
    wings: 'none',
    shoulders: 'spike',
    offhand: 'none',
    feet: 'claw',
    barrel: 'rexhead',
    darkFace: true,
  },
  {
    id: 'rex',
    ball: 0xff3a3a,
    name: 'Rex Saur',
    palette: { body: 0x26365e, trim: 0xb8c0cc, accent: 0xe8312f, joint: 0x15192a, wing: 0x26365e, wingTip: 0xb8c0cc, eye: 0xff3030 },
    crest: 'horns',
    eyes: 'twin',
    wings: 'none',
    shoulders: 'round',
    offhand: 'none',
    feet: 'claw',
    body: 'rex',
    face: 'beast',
  },
  {
    id: 'liger',
    ball: 0x6ff0ff,
    name: 'Fang Liger',
    palette: { body: 0xe9edf3, trim: 0x1d3a9e, accent: 0xffc23d, joint: 0x161a24, wing: 0xe9edf3, wingTip: 0x1d3a9e, eye: 0xff3b2f },
    crest: 'horns',
    eyes: 'twin',
    wings: 'none',
    shoulders: 'round',
    offhand: 'none',
    feet: 'claw',
    body: 'cat',
    face: 'beast',
  },
  {
    id: 'ember',
    ball: 0xff7a1a,
    name: 'Ember Lizard',
    palette: { body: 0xf2662a, trim: 0xffd99a, accent: 0xffd23e, joint: 0x8a2a14, wing: 0xf2662a, wingTip: 0xffd23e, eye: 0xffe14d },
    crest: 'fin',
    eyes: 'twin',
    wings: 'none',
    shoulders: 'round',
    offhand: 'none',
    feet: 'toe',
    body: 'lizard',
    face: 'beast',
  },
];

/** built-ins with the device's roster edits applied, then any custom units */
export function rosterCharacters(data = loadRoster()): CharacterDef[] {
  const merge = (def: CharacterDef, id = def.id): CharacterDef => {
    const u = data.units[id];
    if (!u) return { ...def, id };
    return {
      ...def,
      id,
      name: u.name?.trim() || def.name,
      ball: u.ball ?? def.ball,
      palette: { ...def.palette, ...u.palette },
      traits: u.traits ?? def.traits,
      blueprint: u.blueprint ?? def.blueprint,
      base: def.base ?? (id !== def.id ? def.id : undefined),
    };
  };
  const out = BUILTINS.map((b) => merge(b));
  for (const u of Object.values(data.units)) {
    if (BUILTINS.some((b) => b.id === u.id)) continue;
    const base = BUILTINS.find((b) => b.id === u.base) ?? BUILTINS[0];
    out.push(merge(base, u.id));
  }
  return out;
}

/** live list used everywhere in the game (rebuilt by reloadRoster) */
export const CHARACTERS: CharacterDef[] = rosterCharacters();
export function reloadRoster(data?: RosterData) {
  CHARACTERS.splice(0, CHARACTERS.length, ...rosterCharacters(data));
}

export const characterById = (id: string) => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];

export class ShooterMesh {
  root = new THREE.Group();
  /** everything above the hips; rotates with aim */
  turret: THREE.Object3D = new THREE.Group();
  barrel: THREE.Object3D = new THREE.Group();
  wings: THREE.Object3D = new THREE.Group();
  trigger!: THREE.Object3D;
  legs: THREE.Object3D[] = [];
  mats: THREE.MeshLambertMaterial[] = [];
  readonly id: string;
  /** the marble colour this model was built with */
  readonly ball: number;
  wingL = new THREE.Group();
  wingR = new THREE.Group();
  private stride = 0;
  /** rest positions the recoil animation pushes from */
  private barrelZ = -0.32;
  private triggerZ = 0.38;
  /** beasts: lower jaw that snaps open on each shot */
  jaw: THREE.Object3D | null = null;
  /** lizard: tail flame that flickers */
  flame: THREE.Object3D | null = null;

  /** defOverride lets the Unit Lab preview an unsaved design */
  constructor(characterId: string, marbleColor: number, defOverride?: CharacterDef) {
    const def = defOverride ?? characterById(characterId);
    this.id = def.id;
    this.ball = marbleColor;
    const pal = def.palette;
    const lam = (color: number, side: THREE.Side = THREE.FrontSide) => {
      const m = new THREE.MeshLambertMaterial({ color, side });
      this.mats.push(m);
      return m;
    };
    const body = lam(pal.body);
    const trim = lam(pal.trim);
    const accent = lam(pal.accent);
    const joint = lam(pal.joint);
    const gold = lam(0xffc23d);
    const wingMat = lam(pal.wing, THREE.DoubleSide);
    const wingTip = lam(pal.wingTip, THREE.DoubleSide);
    const eyeMat = new THREE.MeshBasicMaterial({ color: pal.eye });
    const glowMat = def.glow !== undefined ? new THREE.MeshBasicMaterial({ color: def.glow }) : null;
    const ballMat = new THREE.MeshPhongMaterial({ color: marbleColor, shininess: 90, specular: 0xffffff });

    if (def.blueprint) {
      this.buildBlueprint(def.blueprint, def, marbleColor);
      return;
    }

    const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      return mesh;
    };
    const cyl = (rt: number, rb: number, h: number, m: THREE.Material, seg = 14) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
    const cone = (r: number, h: number, m: THREE.Material) => new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), m);

    if (def.body === 'beetle') {
      this.buildBeetle(def, { body, trim, accent, joint, gold, eyeMat, ballMat });
      return;
    }
    if (def.body && def.body !== 'mech') {
      this.trigger = box(0.01, 0.01, 0.01, joint); // beasts have no trigger
      this.buildBeast(def, { body, trim, accent, joint, gold, eyeMat, ballMat });
      return;
    }

    // --- legs: short shins on big feet ---
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.27, 0.48, 0);
      leg.add(box(0.26, 0.22, 0.26, joint, 0, -0.08, 0)); // thigh joint
      leg.add(box(0.32, 0.22, 0.34, body, 0, -0.24, 0)); // shin
      leg.add(box(0.3, 0.1, 0.1, trim, 0, -0.18, -0.18)); // knee guard
      leg.add(box(0.42, 0.18, 0.66, body, 0, -0.39, -0.06)); // foot
      if (glowMat) leg.add(box(0.04, 0.2, 0.02, glowMat, 0, -0.26, -0.18));
      if (def.feet === 'claw') {
        for (const cx of [-0.12, 0, 0.12]) {
          const claw = cone(0.05, 0.16, joint);
          claw.rotation.x = -Math.PI / 2;
          claw.position.set(cx, -0.42, -0.46);
          leg.add(claw);
        }
      } else {
        leg.add(box(0.42, 0.1, 0.12, accent, 0, -0.42, -0.4)); // toe cap
      }
      this.root.add(leg);
      this.legs.push(leg);
    }
    this.root.add(box(0.62, 0.16, 0.44, def.darkFace ? joint : accent, 0, 0.56, 0)); // waist
    this.root.add(box(0.22, 0.18, 0.08, gold, 0, 0.54, -0.24)); // belt buckle

    // --- upper body ---
    this.turret.position.y = 0.62;
    this.root.add(this.turret);

    // torso (core slot)
    this.turret.add(box(0.8, 0.5, 0.6, body, 0, 0.25, 0));
    this.turret.add(box(0.7, 0.26, 0.1, trim, 0, 0.33, -0.3)); // chest block
    for (const side of [-1, 1]) this.turret.add(box(0.18, 0.08, 0.04, def.darkFace ? accent : gold, side * 0.2, 0.38, -0.36)); // vents
    if (glowMat) {
      this.turret.add(box(0.04, 0.4, 0.02, glowMat, 0, 0.25, -0.36));
      for (const side of [-1, 1]) this.turret.add(box(0.02, 0.36, 0.5, glowMat, side * 0.41, 0.25, 0));
    }
    const coreBall = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), ballMat);
    coreBall.position.set(0, 0.45, -0.32);
    this.turret.add(coreBall);

    if (def.barrel === 'rexhead') {
      // a T-rex head blaster held in front: the marble leaves its jaws
      this.barrel.position.set(0.18, 0.2, -0.4);
      this.barrelZ = -0.4;
      const snout = box(0.3, 0.24, 0.42, body, 0, 0.04, -0.12);
      const brow = box(0.32, 0.08, 0.2, trim, 0, 0.18, 0.02);
      const lower = box(0.26, 0.08, 0.34, joint, 0, -0.1, -0.1);
      lower.rotation.x = 0.25;
      const mouth = box(0.2, 0.06, 0.06, new THREE.MeshBasicMaterial({ color: 0xff3030 }), 0, -0.04, -0.33);
      this.barrel.add(snout, brow, lower, mouth);
      for (const side of [-1, 1]) {
        this.barrel.add(box(0.05, 0.04, 0.04, eyeMat, side * 0.1, 0.12, -0.18));
        for (let k = 0; k < 3; k++) {
          const tooth = cone(0.025, 0.07, new THREE.MeshLambertMaterial({ color: 0xffffff }));
          tooth.rotation.x = Math.PI;
          tooth.position.set(side * 0.09, -0.06, -0.3 + k * 0.08);
          this.barrel.add(tooth);
        }
      }
      this.turret.add(this.barrel);
    } else {
    // chest cannon (barrel slot) — recoils when firing
    this.barrel.position.set(0, 0.16, -0.32);
    const tube = cyl(0.14, 0.17, 0.34, joint);
    tube.rotation.x = Math.PI / 2;
    tube.position.z = -0.1;
    const ring = cyl(0.19, 0.19, 0.07, gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.z = -0.27;
    const bore = cyl(0.1, 0.1, 0.02, new THREE.MeshBasicMaterial({ color: 0x08060f }));
    bore.rotation.x = Math.PI / 2;
    bore.position.z = -0.31;
    this.barrel.add(tube, ring, bore);
    this.turret.add(this.barrel);
    }

    // shoulders + stubby arms
    for (const side of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(side * 0.55, 0.38, 0);
      if (def.shoulders === 'spike') {
        sh.add(box(0.32, 0.26, 0.36, body));
        for (const sz of [-0.1, 0.1]) {
          const spike = cone(0.06, 0.3, joint);
          spike.rotation.z = -side * 1.2;
          spike.position.set(side * 0.2, 0.12, sz);
          sh.add(spike);
        }
      } else if (def.shoulders === 'heavy') {
        sh.position.x = side * 0.6;
        sh.add(box(0.44, 0.36, 0.5, body));
        sh.add(box(0.46, 0.08, 0.52, trim, 0, 0.2, 0));
        sh.add(box(0.06, 0.24, 0.4, accent, side * 0.24, -0.02, 0));
        if (glowMat) sh.add(box(0.02, 0.26, 0.04, glowMat, side * 0.23, 0, -0.22));
      } else {
        sh.add(box(0.34, 0.3, 0.4, body));
        sh.add(box(0.36, 0.08, 0.42, trim, 0, 0.17, 0));
        sh.add(box(0.06, 0.18, 0.3, accent, side * 0.18, 0, 0));
      }
      const arm = box(0.2, 0.26, 0.22, def.darkFace ? trim : body, 0, -0.26, -0.06);
      arm.rotation.x = -0.5;
      const fist = box(0.22, 0.2, 0.22, joint, -side * 0.08, -0.4, -0.24);
      sh.add(arm, fist);
      if (side === -1) this.buildOffhand(sh, def, { body, trim, accent, joint, gold, glowMat, eyeMat });
      if (side === 1 && def.offhand === 'gatling') this.buildOffhand(sh, def, { body, trim, accent, joint, gold, glowMat, eyeMat });
      this.turret.add(sh);
    }

    // big SD head
    const head = new THREE.Group();
    head.position.set(0, 0.86, -0.02);
    head.add(box(0.74, 0.58, 0.66, body)); // helmet
    head.add(box(0.5, 0.3, 0.06, def.darkFace ? joint : body, 0, -0.08, -0.34)); // faceplate
    head.add(box(0.14, 0.1, 0.06, def.darkFace ? joint : accent, 0, -0.22, -0.36)); // chin
    if (def.eyes === 'mono') {
      // a visor slot with a single glowing eye
      head.add(box(0.56, 0.12, 0.03, new THREE.MeshBasicMaterial({ color: 0x0b0710 }), 0, 0.03, -0.375));
      head.add(box(0.12, 0.1, 0.02, eyeMat, 0.06, 0.03, -0.39));
    } else {
      for (const side of [-1, 1]) {
        const eye = box(0.15, 0.06, 0.02, eyeMat, side * 0.12, 0.02, -0.38);
        eye.rotation.z = side * (def.darkFace ? 0.35 : 0.18);
        head.add(eye);
      }
    }
    for (const side of [-1, 1]) head.add(box(0.1, 0.24, 0.3, trim, side * 0.4, -0.02, 0)); // ear blocks
    head.add(box(0.12, 0.1, 0.06, def.eyes === 'mono' ? gold : accent, 0, 0.2, -0.35)); // forehead sensor
    this.buildCrest(head, def, { body, trim, accent, joint, gold, glowMat });
    this.turret.add(head);

    // --- wings / backpack ---
    this.wings.position.set(0, 0.42, 0.34);
    this.turret.add(this.wings);
    this.wingR.position.x = 0.12;
    this.wingL.position.x = -0.12;
    this.wingL.scale.x = -1; // mirror
    this.wings.add(this.wingL, this.wingR);
    if (def.wings === 'pods') for (const w of [this.wingL, this.wingR]) this.buildPods(w, wingMat, wingTip, joint);

    // trigger on the back, pushed in on every shot
    this.trigger = box(0.26, 0.16, 0.16, gold, 0, 0.06, 0.38);
    this.turret.add(this.trigger);
  }

  /** Beast body plans: the marble leaves the creature's mouth. */
  private buildBeast(
    def: CharacterDef,
    m: { body: THREE.Material; trim: THREE.Material; accent: THREE.Material; joint: THREE.Material; gold: THREE.Material; eyeMat: THREE.Material; ballMat: THREE.Material },
  ) {
    const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      return mesh;
    };
    const sph = (r: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);
      mesh.position.set(x, y, z);
      return mesh;
    };
    const cone = (r: number, h: number, mat: THREE.Material) => new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mat);
    const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const dark = new THREE.MeshBasicMaterial({ color: 0x120a10 });
    this.mats.push(white);
    const teeth = (g: THREE.Object3D, w: number, z0: number, z1: number, y: number, down: boolean) => {
      for (let k = 0; k < 4; k++) {
        const t = cone(0.025, 0.07, white);
        t.rotation.x = down ? Math.PI : 0;
        for (const side of [-1, 1]) {
          const tt = t.clone();
          tt.position.set(side * w, y, z0 + ((z1 - z0) * k) / 3);
          g.add(tt);
        }
      }
    };
    /** a mouth "barrel": upper jaw fixed, lower jaw snaps open on recoil */
    const mouth = (parent: THREE.Object3D, z: number, y: number, w: number) => {
      this.barrel.position.set(0, y, z);
      this.barrelZ = z;
      const cavity = box(w * 0.8, 0.08, 0.1, dark, 0, -0.02, -0.02);
      const glow = sph(0.06, m.ballMat, 0, -0.02, 0.02);
      this.barrel.add(cavity, glow);
      parent.add(this.barrel);
      const jaw = new THREE.Group();
      jaw.position.set(0, y - 0.06, z + 0.32);
      const lower = box(w, 0.1, 0.38, m.joint, 0, -0.04, -0.2);
      jaw.add(lower);
      teeth(jaw, w * 0.4, -0.34, -0.1, 0.03, false);
      parent.add(jaw);
      this.jaw = jaw;
    };

    if (def.body === 'rex') {
      // tyrannosaur hunter: spine level, head low and forward, tail as counterweight
      const claw = new THREE.MeshLambertMaterial({ color: 0xe8ecf2 });
      this.mats.push(claw);
      for (const side of [-1, 1]) {
        // digitigrade leg: thigh forward, shin back, long foot
        const leg = new THREE.Group();
        leg.position.set(side * 0.3, 0.8, 0.16);
        const thigh = box(0.26, 0.44, 0.4, m.body, 0, -0.14, -0.02);
        thigh.rotation.x = 0.35;
        leg.add(thigh);
        const plate = box(0.04, 0.32, 0.3, m.trim, side * 0.14, -0.12, -0.02);
        plate.rotation.x = 0.35;
        leg.add(plate);
        const shin = box(0.15, 0.36, 0.16, m.joint, 0, -0.44, 0.12);
        shin.rotation.x = -0.5;
        leg.add(shin);
        leg.add(box(0.13, 0.16, 0.13, m.joint, 0, -0.64, 0.08)); // ankle
        leg.add(box(0.3, 0.09, 0.44, m.trim, 0, -0.75, -0.08)); // foot
        for (const cx of [-0.1, 0, 0.1]) {
          const c = cone(0.035, 0.16, claw);
          c.rotation.x = -Math.PI / 2 - 0.35;
          c.position.set(cx, -0.77, -0.34);
          leg.add(c);
        }
        this.root.add(leg);
        this.legs.push(leg);
      }
      this.turret.position.y = 0.84;
      this.root.add(this.turret);
      // body: deep chest, waist frame, hips
      const chest = box(0.6, 0.5, 0.58, m.body, 0, 0.08, -0.16);
      chest.rotation.x = 0.1;
      this.turret.add(chest);
      this.turret.add(box(0.44, 0.3, 0.46, m.joint, 0, -0.12, 0.12)); // exposed frame
      this.turret.add(box(0.52, 0.4, 0.42, m.body, 0, 0.04, 0.36)); // hips
      this.turret.add(box(0.42, 0.06, 0.9, m.trim, 0, 0.35, 0.1)); // spine armour
      // a ridge of dark blade-spines down the back, raked toward the tail
      [0.14, 0.18, 0.16, 0.12, 0.09].forEach((h, k) => {
        const spine = cone(0.07, h, k === 1 ? m.accent : m.joint);
        spine.scale.set(0.4, 1, 1.3);
        spine.position.set(0, 0.38 + h / 2 - 0.02, -0.28 + k * 0.2);
        spine.rotation.x = 0.5;
        this.turret.add(spine);
      });
      // tail tapers back and slightly down
      const tail = new THREE.Group();
      tail.position.set(0, 0.06, 0.56);
      [0.32, 0.24, 0.17, 0.11].forEach((w, k) => {
        const seg = box(w, w * 0.85, 0.34, k % 2 ? m.trim : m.body, 0, -k * 0.05, 0.14 + k * 0.3);
        seg.rotation.x = 0.1;
        tail.add(seg);
        if (k < 3) {
          const spine = cone(0.05, 0.1 - k * 0.02, m.joint);
          spine.scale.set(0.4, 1, 1.3);
          spine.position.set(0, w * 0.45 - k * 0.05 + 0.04, 0.14 + k * 0.3);
          spine.rotation.x = 0.6;
          tail.add(spine);
        }
      });
      const tip = cone(0.06, 0.26, m.joint);
      tip.rotation.x = Math.PI / 2 + 0.1;
      tip.position.set(0, -0.22, 1.3);
      tail.add(tip);
      this.turret.add(tail);
      // short arms with hooked claws, held tight to the chest
      for (const side of [-1, 1]) {
        const arm = box(0.08, 0.2, 0.08, m.joint, side * 0.24, -0.08, -0.44);
        arm.rotation.x = 0.7;
        this.turret.add(arm);
        const hand = cone(0.03, 0.12, claw);
        hand.rotation.x = Math.PI - 0.6;
        hand.position.set(side * 0.24, -0.2, -0.54);
        this.turret.add(hand);
      }
      // neck rises into a long, low head
      const neck = box(0.3, 0.28, 0.34, m.body, 0, 0.2, -0.5);
      neck.rotation.x = -0.4;
      this.turret.add(neck);
      const head = new THREE.Group();
      head.position.set(0, 0.36, -0.72);
      head.add(box(0.4, 0.27, 0.44, m.body, 0, 0.04, -0.06)); // skull
      const snout = box(0.32, 0.17, 0.42, m.body, 0, -0.02, -0.42);
      snout.rotation.x = 0.06;
      head.add(snout);
      head.add(box(0.06, 0.07, 0.62, m.trim, 0, 0.2, -0.22)); // crest ridge
      for (const side of [-1, 1]) {
        // heavy brows sloping down to the middle, slit eyes beneath
        const brow = box(0.15, 0.07, 0.2, m.trim, side * 0.13, 0.18, -0.2);
        brow.rotation.set(-0.15, 0, side * 0.3);
        const eye = box(0.09, 0.035, 0.02, m.eyeMat, side * 0.15, 0.115, -0.29);
        eye.rotation.z = side * 0.3;
        head.add(brow, eye);
        head.add(box(0.04, 0.12, 0.24, m.trim, side * 0.2, 0.0, -0.08)); // cheek armour
        const horn = cone(0.035, 0.16, m.joint);
        horn.position.set(side * 0.16, 0.2, 0.08);
        horn.rotation.x = 1.2;
        head.add(horn);
      }
      teeth(head, 0.13, -0.6, -0.26, -0.11, true);
      this.turret.add(head);
      mouth(head, -0.62, -0.09, 0.3);
    } else if (def.body === 'cat') {
      // sabre-tooth liger: crouched low on armoured legs, head thrust forward
      const claw = new THREE.MeshLambertMaterial({ color: 0xffc23d });
      this.mats.push(claw);
      const order: [number, number][] = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]; // FL, FR, BR, BL — diagonal pairs swing together
      for (const [sx, sz] of order) {
        const front = sz < 0;
        const leg = new THREE.Group();
        leg.position.set(sx * 0.32, front ? 0.66 : 0.6, sz * 0.42);
        leg.add(box(0.26, 0.34, 0.32, m.body, 0, -0.1, front ? 0 : 0.04)); // armoured upper leg
        leg.add(box(0.28, 0.06, 0.34, m.trim, 0, 0.08, 0)); // shoulder plate edge
        leg.add(box(0.16, 0.26, 0.18, m.joint, 0, -0.36, front ? -0.02 : 0.08)); // dark frame
        leg.add(box(0.3, 0.1, 0.36, m.trim, 0, -0.56, -0.06)); // paw
        for (const cx of [-0.09, 0, 0.09]) {
          const c = cone(0.035, 0.16, claw);
          c.rotation.x = -Math.PI / 2 - 0.3;
          c.position.set(cx, -0.58, -0.28);
          leg.add(c);
        }
        this.root.add(leg);
        this.legs.push(leg);
      }
      // chest high, haunches lower: a stalking crouch
      const chest = box(0.62, 0.44, 0.5, m.body, 0, 0.78, -0.26);
      chest.rotation.x = -0.12;
      this.root.add(chest);
      this.root.add(box(0.44, 0.26, 0.6, m.joint, 0, 0.66, 0.14)); // exposed frame at the waist
      this.root.add(box(0.58, 0.36, 0.4, m.body, 0, 0.72, 0.44)); // haunches
      const spine = box(0.42, 0.06, 1.0, m.trim, 0, 0.98, 0.06);
      spine.rotation.x = -0.1;
      this.root.add(spine);
      // twin swept blades on the back, edges glowing
      for (const side of [-1, 1]) {
        const blade = new THREE.Group();
        blade.position.set(side * 0.22, 1.0, 0.0);
        blade.rotation.set(0.3, side * 0.1, side * -0.3);
        blade.add(box(0.05, 0.12, 0.9, claw, 0, 0.04, 0.24));
        blade.add(box(0.06, 0.03, 0.86, m.eyeMat, 0, 0.11, 0.26));
        this.root.add(blade);
      }
      // tail arcs up and back, tipped with a blade
      const tail = new THREE.Group();
      tail.position.set(0, 0.82, 0.62);
      [0.12, 0.1, 0.08].forEach((w, k) => {
        const seg = box(w, w, 0.3, k % 2 ? m.trim : m.joint, 0, k * 0.1, 0.12 + k * 0.26);
        seg.rotation.x = -0.35;
        tail.add(seg);
      });
      const tip = cone(0.05, 0.3, claw);
      tip.rotation.x = Math.PI / 2 - 0.4;
      tip.position.set(0, 0.34, 0.86);
      tail.add(tip);
      this.root.add(tail);
      // head on the turret, so it swings with the aim
      this.turret.position.set(0, 0.84, -0.56);
      this.root.add(this.turret);
      this.turret.add(box(0.26, 0.22, 0.28, m.joint, 0, -0.04, 0.2)); // neck
      const head = new THREE.Group();
      head.add(box(0.44, 0.3, 0.42, m.body, 0, 0.06, -0.04)); // skull
      head.add(box(0.32, 0.14, 0.3, m.body, 0, 0.02, -0.36)); // upper snout
      head.add(box(0.2, 0.08, 0.08, m.joint, 0, 0.05, -0.52)); // nose
      head.add(box(0.36, 0.05, 0.36, m.trim, 0, 0.22, -0.1)); // helmet plate
      const crestBlade = cone(0.05, 0.4, claw);
      crestBlade.position.set(0, 0.28, -0.24);
      crestBlade.rotation.x = -1.15;
      head.add(crestBlade);
      for (const side of [-1, 1]) {
        // brows slope down to the middle: a permanent glare
        const brow = box(0.2, 0.06, 0.1, m.trim, side * 0.11, 0.17, -0.26);
        brow.rotation.z = side * 0.4;
        const eye = box(0.13, 0.035, 0.02, m.eyeMat, side * 0.11, 0.115, -0.255);
        eye.rotation.z = side * 0.4;
        head.add(brow, eye);
        // ear fins swept back
        const ear = box(0.04, 0.24, 0.16, m.trim, side * 0.19, 0.28, 0.1);
        ear.rotation.set(0.75, 0, side * -0.3);
        head.add(ear);
        // sabre fangs hang below the jaw line
        const fang = cone(0.035, 0.24, white);
        fang.rotation.x = Math.PI;
        fang.position.set(side * 0.1, -0.12, -0.46);
        head.add(fang);
      }
      // armoured mane, alternating colours, open at the bottom for the neck
      for (let k = 0; k < 9; k++) {
        const a = -0.35 + (k / 8) * (Math.PI + 0.7);
        const plate = cone(0.07, 0.3, k % 2 ? m.accent : m.trim);
        plate.position.set(Math.cos(a) * 0.3, 0.04 + Math.sin(a) * 0.26, 0.12);
        plate.rotation.z = a - Math.PI / 2;
        head.add(plate);
      }
      teeth(head, 0.12, -0.48, -0.3, -0.07, true);
      this.turret.add(head);
      mouth(head, -0.5, -0.1, 0.28);
    } else {
      // fire drake: upright on clawed hind legs, plated belly, horned head, tail ablaze
      const claw = new THREE.MeshLambertMaterial({ color: 0xf4efe6 });
      this.mats.push(claw);
      for (const side of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(side * 0.2, 0.52, 0.06);
        const thigh = box(0.2, 0.3, 0.26, m.body, 0, -0.1, -0.02);
        thigh.rotation.x = 0.4;
        leg.add(thigh);
        const shin = box(0.12, 0.24, 0.12, m.body, 0, -0.32, 0.08);
        shin.rotation.x = -0.45;
        leg.add(shin);
        leg.add(box(0.2, 0.07, 0.3, m.joint, 0, -0.48, -0.06)); // foot
        for (const cx of [-0.06, 0, 0.06]) {
          const c = cone(0.025, 0.11, claw);
          c.rotation.x = -Math.PI / 2 - 0.3;
          c.position.set(cx, -0.49, -0.25);
          leg.add(c);
        }
        this.root.add(leg);
        this.legs.push(leg);
      }
      // torso leans forward like it's about to pounce
      const torso = box(0.42, 0.5, 0.36, m.body, 0, 0.74, 0.02);
      torso.rotation.x = 0.18;
      this.root.add(torso);
      const belly = box(0.3, 0.42, 0.04, m.trim, 0, 0.72, -0.17);
      belly.rotation.x = 0.18;
      this.root.add(belly);
      for (const y of [0.62, 0.74, 0.86]) {
        const seam = box(0.3, 0.015, 0.02, m.joint, 0, y, -0.19 - (y - 0.74) * 0.18);
        seam.rotation.x = 0.18;
        this.root.add(seam);
      }
      // dark dorsal spikes along the back
      for (let k = 0; k < 4; k++) {
        const spike = cone(0.04, 0.16, m.joint);
        spike.position.set(0, 0.98 - k * 0.14, 0.22 + k * 0.04);
        spike.rotation.x = 1.0;
        this.root.add(spike);
      }
      // long tail sweeping back and up, a big flame at the tip
      const tail = new THREE.Group();
      tail.position.set(0, 0.5, 0.22);
      [0.16, 0.13, 0.1, 0.08].forEach((w, k) => {
        const seg = box(w, w, 0.26, m.body, 0, k * 0.07 + (k > 1 ? (k - 1) * 0.07 : 0), 0.12 + k * 0.22);
        seg.rotation.x = -0.15 - k * 0.12;
        tail.add(seg);
      });
      const flame = new THREE.Group();
      flame.position.set(0, 0.48, 0.92);
      // teardrop layers: a round base with a licking tip, glowing additively
      const fire = (r: number, h: number, color: number, y: number, opacity: number) => {
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
        const base = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
        base.position.y = y;
        const lick = new THREE.Mesh(new THREE.ConeGeometry(r * 0.95, h, 10), mat);
        lick.position.y = y + h / 2;
        flame.add(base, lick);
      };
      fire(0.15, 0.38, 0xff4a0a, -0.12, 0.85);
      fire(0.1, 0.28, 0xffa21a, -0.1, 0.9);
      fire(0.055, 0.16, 0xfff07a, -0.08, 1);
      tail.add(flame);
      this.flame = flame;
      this.root.add(tail);
      this.turret.position.y = 0.98;
      this.root.add(this.turret);
      // arms out to the sides in a fighting stance, claws curled
      for (const side of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(side * 0.27, -0.04, -0.06);
        const upper = box(0.1, 0.22, 0.1, m.body, side * 0.04, -0.08, 0);
        upper.rotation.z = side * 0.5;
        arm.add(upper);
        const fore = box(0.09, 0.2, 0.09, m.body, side * 0.1, -0.2, -0.1);
        fore.rotation.x = 0.9;
        arm.add(fore);
        for (const cx of [-0.03, 0.03]) {
          const c = cone(0.02, 0.09, claw);
          c.rotation.x = -Math.PI / 2 - 0.2;
          c.position.set(side * 0.1 + cx, -0.27, -0.22);
          arm.add(c);
        }
        this.turret.add(arm);
      }
      this.turret.add(box(0.2, 0.14, 0.2, m.body, 0, 0.04, -0.02)); // neck
      // head: angular skull, long snout, glaring slit eyes, horn swept back
      const head = new THREE.Group();
      head.position.set(0, 0.22, -0.08);
      head.add(box(0.36, 0.28, 0.34, m.body, 0, 0.04, 0.02)); // skull
      const snout = box(0.28, 0.15, 0.3, m.body, 0, -0.02, -0.26);
      snout.rotation.x = 0.06;
      head.add(snout);
      head.add(box(0.22, 0.04, 0.06, m.joint, 0, 0.05, -0.4)); // nostrils
      const horn = cone(0.055, 0.34, m.body);
      horn.position.set(0, 0.22, 0.24);
      horn.rotation.x = 1.95;
      head.add(horn);
      for (const side of [-1, 1]) {
        const brow = box(0.14, 0.06, 0.12, m.joint, side * 0.1, 0.16, -0.14);
        brow.rotation.z = side * 0.4;
        const eye = box(0.1, 0.04, 0.02, m.eyeMat, side * 0.1, 0.105, -0.155);
        eye.rotation.z = side * 0.4;
        const pupil = box(0.022, 0.045, 0.01, dark, side * 0.09, 0.105, -0.167);
        head.add(brow, eye, pupil);
        const cheek = cone(0.035, 0.12, m.body);
        cheek.position.set(side * 0.19, 0.0, 0.06);
        cheek.rotation.z = side * -1.3;
        head.add(cheek);
      }
      teeth(head, 0.1, -0.38, -0.18, -0.09, true);
      this.turret.add(head);
      mouth(head, -0.4, -0.09, 0.24);
    }
  }

  /**
   * Beetle-type mech (medal-fighter style): insect legs, carapace chest,
   * rhino horn with a forked tip, missile tubes on the head, revolver right
   * arm (the barrel) and a sub-machine gun on the left.
   */
  private buildBeetle(
    def: CharacterDef,
    m: { body: THREE.Material; trim: THREE.Material; accent: THREE.Material; joint: THREE.Material; gold: THREE.Material; eyeMat: THREE.Material; ballMat: THREE.Material },
  ) {
    const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      return mesh;
    };
    const cyl = (r: number, h: number, mat: THREE.Material, seg = 12) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
    const cone = (r: number, h: number, mat: THREE.Material) => new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mat);
    const visor = new THREE.MeshBasicMaterial({ color: 0x07070b });
    void def;

    // digitigrade insect legs with toe spikes
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.27, 0.5, 0);
      leg.add(box(0.26, 0.24, 0.3, m.body, 0, -0.06, 0.02)); // thigh
      const shin = box(0.2, 0.28, 0.22, m.trim, 0, -0.27, 0.06);
      shin.rotation.x = -0.25;
      leg.add(shin);
      leg.add(box(0.12, 0.08, 0.12, m.accent, 0, -0.16, -0.12)); // knee light
      leg.add(box(0.42, 0.14, 0.6, m.body, 0, -0.42, -0.06)); // foot
      leg.add(box(0.04, 0.15, 0.6, m.trim, 0, -0.42, -0.06)); // toe split
      for (const cx of [-0.13, 0.13]) {
        const spike = cone(0.06, 0.18, m.trim);
        spike.rotation.x = -Math.PI / 2;
        spike.position.set(cx, -0.44, -0.44);
        leg.add(spike);
      }
      this.root.add(leg);
      this.legs.push(leg);
    }
    this.root.add(box(0.56, 0.16, 0.4, m.trim, 0, 0.56, 0)); // waist

    this.turret.position.y = 0.62;
    this.root.add(this.turret);
    // carapace chest: yellow shell, black plate, medal in the middle
    this.turret.add(box(0.82, 0.5, 0.6, m.body, 0, 0.26, 0));
    this.turret.add(box(0.56, 0.3, 0.06, m.trim, 0, 0.28, -0.31));
    for (const side of [-1, 1]) {
      const rib = box(0.06, 0.26, 0.02, m.body, side * 0.14, 0.28, -0.345);
      rib.rotation.z = side * 0.3;
      this.turret.add(rib);
    }
    const medal = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), m.ballMat);
    medal.position.set(0, 0.3, -0.34);
    this.turret.add(medal);
    // elytra on the back, cracked open
    for (const side of [-1, 1]) {
      const wing = box(0.36, 0.56, 0.08, m.body, side * 0.2, 0.32, 0.36);
      wing.rotation.set(0.12, side * 0.3, side * 0.06);
      this.turret.add(wing);
      this.turret.add(box(0.03, 0.5, 0.09, m.trim, side * 0.035, 0.32, 0.34));
    }

    // shoulders and forward-held arms
    for (const side of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(side * 0.56, 0.36, 0);
      sh.add(box(0.36, 0.32, 0.44, m.body));
      sh.add(box(0.38, 0.07, 0.46, m.trim, 0, 0.17, 0));
      sh.add(box(0.06, 0.16, 0.3, m.accent, side * 0.19, 0, 0));
      const arm = box(0.2, 0.2, 0.36, m.trim, 0, -0.26, -0.16);
      sh.add(arm);
      if (side < 0) {
        // sub-machine gun
        const smg = new THREE.Group();
        smg.position.set(0, -0.28, -0.42);
        smg.add(box(0.16, 0.18, 0.36, m.body));
        smg.add(box(0.06, 0.12, 0.08, m.trim, 0, -0.14, 0.08)); // magazine
        const muzzle = cyl(0.04, 0.24, m.joint);
        muzzle.rotation.x = Math.PI / 2;
        muzzle.position.z = -0.28;
        smg.add(muzzle);
        sh.add(smg);
      }
      this.turret.add(sh);
    }
    // revolver right arm: the barrel that recoils on every shot
    this.barrel.position.set(0.56, 0.08, -0.5);
    this.barrelZ = -0.5;
    const drum = cyl(0.13, 0.18, m.joint, 10);
    drum.rotation.x = Math.PI / 2;
    const tube = cyl(0.065, 0.46, m.trim);
    tube.rotation.x = Math.PI / 2;
    tube.position.z = -0.3;
    const ring = cyl(0.085, 0.06, m.gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.z = -0.52;
    const sight = box(0.03, 0.06, 0.2, m.accent, 0, 0.08, -0.3);
    this.barrel.add(drum, tube, ring, sight);
    this.turret.add(this.barrel);

    // head: compact helmet, V visor, slanted eyes, mandibles, rhino horn, seeker missiles
    const head = new THREE.Group();
    head.position.set(0, 0.8, -0.02);
    head.add(box(0.6, 0.38, 0.56, m.body, 0, 0, 0)); // helmet
    // the brow drops to a point over the visor: a permanent scowl
    for (const side of [-1, 1]) {
      const brow = box(0.3, 0.07, 0.08, m.body, side * 0.13, 0.08, -0.29);
      brow.rotation.z = side * 0.32;
      head.add(brow);
    }
    head.add(box(0.5, 0.2, 0.05, visor, 0, -0.04, -0.28)); // black face
    for (const side of [-1, 1]) {
      const eye = box(0.15, 0.045, 0.02, m.eyeMat, side * 0.12, -0.01, -0.31);
      eye.rotation.z = side * 0.38;
      head.add(eye);
      const mandible = cone(0.035, 0.16, m.trim);
      mandible.rotation.set(-Math.PI / 2 - 0.5, 0, side * 0.35);
      mandible.position.set(side * 0.13, -0.19, -0.3);
      head.add(mandible);
      head.add(box(0.07, 0.18, 0.22, m.accent, side * 0.32, -0.02, 0.02)); // ear discs
      // seeker missiles: low twin launchers swept back along the helmet
      const pod = new THREE.Group();
      pod.position.set(side * 0.2, 0.22, 0.12);
      pod.rotation.set(-0.35, 0, side * -0.25);
      pod.add(box(0.12, 0.1, 0.32, m.trim));
      for (const dx of [-0.03, 0.03]) {
        const tip = cone(0.022, 0.07, m.accent);
        tip.rotation.x = -Math.PI / 2;
        tip.position.set(dx, 0, -0.19);
        pod.add(tip);
      }
      head.add(pod);
    }
    // the rhino horn tapers as it curls forward, ending in a fork
    const hornSegs: [number, number, number, number, number, number][] = [
      // top radius, bottom radius, length, y, z, tilt
      [0.07, 0.11, 0.26, 0.3, -0.15, -0.25],
      [0.05, 0.07, 0.24, 0.5, -0.24, -0.65],
      [0.035, 0.05, 0.2, 0.63, -0.39, -1.1],
    ];
    for (const [rt, rb, h, y, z, tilt] of hornSegs) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 6), m.body);
      seg.position.set(0, y, z);
      seg.rotation.x = tilt;
      head.add(seg);
    }
    for (const side of [-1, 1]) {
      const fork = cone(0.035, 0.16, m.body);
      fork.position.set(side * 0.04, 0.68, -0.53);
      fork.rotation.set(-1.5, 0, -side * 0.4);
      head.add(fork);
    }
    this.turret.add(head);

    // trigger on the back, pushed in on every shot
    this.trigger = box(0.26, 0.16, 0.16, m.gold, 0, 0.06, 0.42);
    this.turret.add(this.trigger);
  }

  /** Build the model from a Unit Lab block design, wiring up the animated parts. */
  private buildBlueprint(bp: Block, def: CharacterDef, ball: number) {
    const cache = new Map<string, THREE.Material>();
    const material = (m: Block['mat']) => {
      const spec = m ?? { kind: 'lambert', color: 'body' };
      const color = resolveColor(spec.color, def, ball);
      const key = `${spec.kind}|${color}|${spec.double ? 1 : 0}|${spec.opacity ?? 1}|${spec.additive ? 1 : 0}`;
      let mat = cache.get(key);
      if (!mat) {
        const common = {
          color,
          side: spec.double ? THREE.DoubleSide : THREE.FrontSide,
          transparent: (spec.opacity ?? 1) < 1 || !!spec.additive,
          opacity: spec.opacity ?? 1,
          blending: spec.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
          depthWrite: !spec.additive,
        };
        if (spec.kind === 'basic') mat = new THREE.MeshBasicMaterial(common);
        else if (spec.kind === 'phong') mat = new THREE.MeshPhongMaterial({ ...common, shininess: 90, specular: 0xffffff });
        else {
          const lam = new THREE.MeshLambertMaterial(common);
          this.mats.push(lam);
          mat = lam;
        }
        cache.set(key, mat);
      }
      return mat;
    };
    const assign = (o: THREE.Object3D, role: Role | undefined) => {
      switch (role) {
        case 'turret':
          this.turret = o;
          break;
        case 'barrel':
          this.barrel = o;
          this.barrelZ = o.position.z;
          break;
        case 'leg':
          this.legs.push(o);
          break;
        case 'jaw':
          this.jaw = o;
          break;
        case 'flame':
          this.flame = o;
          break;
        case 'trigger':
          this.trigger = o;
          this.triggerZ = o.position.z;
          break;
        case 'wings':
          this.wings = o;
          break;
        case 'wingL':
          this.wingL = o as THREE.Group;
          break;
        case 'wingR':
          this.wingR = o as THREE.Group;
          break;
      }
    };
    const make = (b: Block, path: string): THREE.Object3D => {
      const o = b.shape === 'group' ? new THREE.Group() : new THREE.Mesh(blockGeometry(b), material(b.mat));
      o.position.fromArray(b.p);
      o.rotation.set(b.r[0], b.r[1], b.r[2]);
      o.scale.fromArray(b.s);
      o.userData.path = path;
      assign(o, b.role);
      (b.children ?? []).forEach((c, i) => o.add(make(c, `${path}/${i}`)));
      return o;
    };
    // the top block is the root itself
    this.root.userData.path = 'r';
    (bp.children ?? []).forEach((c, i) => this.root.add(make(c, `r/${i}`)));
    // every model needs these, even if the design leaves them out
    if (!this.trigger) {
      this.trigger = new THREE.Object3D();
      this.turret.add(this.trigger);
    }
    if (!this.barrel.parent) this.turret.add(this.barrel);
    if (!this.turret.parent) this.root.add(this.turret);
  }

  /** Describe this model as editable blocks (how built-ins become Unit Lab designs). */
  toBlueprint(def: CharacterDef): Block {
    const roleOf = (o: THREE.Object3D): Role | undefined => {
      if (o === this.turret) return 'turret';
      if (o === this.barrel) return 'barrel';
      if (this.legs.includes(o)) return 'leg';
      if (o === this.jaw) return 'jaw';
      if (o === this.flame) return 'flame';
      if (o === this.trigger) return 'trigger';
      if (o === this.wings) return 'wings';
      if (o === this.wingL) return 'wingL';
      if (o === this.wingR) return 'wingR';
      return undefined;
    };
    const r3 = (n: number) => Math.round(n * 1000) / 1000;
    const v = (x: { x: number; y: number; z: number }): V3 => [r3(x.x), r3(x.y), r3(x.z)];
    const walk = (o: THREE.Object3D): Block | null => {
      const mesh = o as THREE.Mesh;
      let b: Block;
      if (mesh.isMesh) {
        const shape = SHAPE_OF[mesh.geometry.type];
        if (!shape) return null;
        const mat = mesh.material as THREE.MeshLambertMaterial;
        const kind = mat.type === 'MeshBasicMaterial' ? 'basic' : mat.type === 'MeshPhongMaterial' ? 'phong' : 'lambert';
        const size: Record<string, number | boolean> = {};
        for (const [k, val] of Object.entries((mesh.geometry as THREE.BoxGeometry).parameters)) if (typeof val === 'number' || typeof val === 'boolean') size[k] = typeof val === 'number' ? r3(val) : val;
        b = {
          shape,
          size,
          mat: {
            kind,
            color: colorRefOf(mat.color.getHex(), kind, def, this.ball),
            ...(mat.side === THREE.DoubleSide ? { double: true } : {}),
            ...(mat.opacity < 1 ? { opacity: r3(mat.opacity) } : {}),
            ...(mat.blending === THREE.AdditiveBlending ? { additive: true } : {}),
          },
          p: v(o.position),
          r: v(o.rotation),
          s: v(o.scale),
        };
      } else {
        b = { shape: 'group', p: v(o.position), r: v(o.rotation), s: v(o.scale) };
      }
      const role = roleOf(o);
      if (role) b.role = role;
      const kids = o.children.map(walk).filter((c): c is Block => !!c);
      if (kids.length) b.children = kids;
      return b;
    };
    const root = walk(this.root)!;
    root.p = [0, 0, 0];
    root.r = [0, 0, 0];
    root.s = [1, 1, 1];
    return root;
  }

  private buildCrest(
    head: THREE.Group,
    def: CharacterDef,
    m: { body: THREE.Material; trim: THREE.Material; accent: THREE.Material; joint: THREE.Material; gold: THREE.Material; glowMat: THREE.Material | null },
  ) {
    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      return mesh;
    };
    const cone = (r: number, h: number, mat: THREE.Material) => new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mat);
    switch (def.crest) {
      case 'vfin':
      case 'vfin-short': {
        const short = def.crest === 'vfin-short';
        for (const side of [-1, 1]) {
          const fin = box(0.07, short ? 0.36 : 0.62, 0.04, m.gold, side * (short ? 0.13 : 0.2), short ? 0.32 : 0.42, -0.36);
          fin.rotation.z = -side * (short ? 0.75 : 0.95);
          head.add(fin);
        }
        head.add(box(0.1, 0.16, 0.05, m.accent, 0, 0.3, -0.36));
        head.add(box(0.5, 0.08, 0.62, m.trim, 0, 0.32, 0)); // crest band
        break;
      }
      case 'eva': {
        // one long horn swept forward off the brow, armoured jaw
        const horn = cone(0.06, 0.7, m.body);
        horn.position.set(0, 0.42, -0.28);
        horn.rotation.x = -0.55;
        head.add(horn);
        head.add(box(0.46, 0.12, 0.08, m.glowMat ?? m.trim, 0, -0.2, -0.34));
        for (const side of [-1, 1]) head.add(box(0.08, 0.3, 0.5, m.trim, side * 0.36, 0.06, -0.04));
        break;
      }
      case 'beetle': {
        // a big beetle horn curving up, plus antenna-like side prongs
        const base = box(0.14, 0.3, 0.14, m.body, 0, 0.4, -0.3);
        base.rotation.x = -0.3;
        const tip = cone(0.08, 0.36, m.body);
        tip.position.set(0, 0.68, -0.42);
        tip.rotation.x = -0.7;
        head.add(base, tip);
        for (const side of [-1, 1]) {
          const prong = cone(0.04, 0.3, m.trim);
          prong.position.set(side * 0.26, 0.42, -0.1);
          prong.rotation.z = -side * 0.5;
          head.add(prong);
        }
        break;
      }
      case 'tyrant': {
        // gold crest ridge and swept side fins
        head.add(box(0.12, 0.18, 0.62, m.gold, 0, 0.36, 0));
        for (const side of [-1, 1]) {
          const fin = box(0.04, 0.24, 0.34, m.gold, side * 0.42, 0.18, 0.08);
          fin.rotation.z = -side * 0.4;
          head.add(fin);
        }
        break;
      }
      case 'horns': {
        for (const side of [-1, 1]) {
          const horn = cone(0.06, 0.62, m.joint);
          horn.position.set(side * 0.2, 0.42, 0.12);
          horn.rotation.set(-0.9, 0, -side * 0.35);
          head.add(horn);
          const sideHorn = cone(0.05, 0.36, m.joint);
          sideHorn.position.set(side * 0.48, 0.12, 0.06);
          sideHorn.rotation.set(-0.5, 0, -side * 1.1);
          head.add(sideHorn);
        }
        const blade = cone(0.06, 0.42, m.gold);
        blade.position.set(0, 0.48, -0.26);
        blade.rotation.x = -0.25;
        head.add(blade);
        break;
      }
      case 'unihorn': {
        const horn = cone(0.07, 0.8, m.gold);
        horn.position.set(0, 0.62, -0.28);
        horn.rotation.x = -0.18;
        head.add(horn);
        if (m.glowMat) head.add(box(0.03, 0.4, 0.02, m.glowMat, 0, 0.12, -0.345));
        break;
      }
      case 'fin': {
        // a single swept fin on top, and a crest ridge
        const fin = box(0.06, 0.42, 0.34, m.gold, 0, 0.42, 0.1);
        fin.rotation.x = 0.55;
        head.add(fin);
        head.add(box(0.14, 0.1, 0.66, m.trim, 0, 0.32, 0));
        break;
      }
    }
  }

  private buildOffhand(
    sh: THREE.Group,
    def: CharacterDef,
    m: { body: THREE.Material; trim: THREE.Material; accent: THREE.Material; joint: THREE.Material; gold: THREE.Material; glowMat: THREE.Material | null; eyeMat: THREE.Material },
  ) {
    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      return mesh;
    };
    switch (def.offhand) {
      case 'none':
        break;
      case 'shield': {
        const shield = box(0.06, 0.46, 0.3, def.id === 'pioneer' || def.id === 'baron' ? m.accent : m.trim, -0.16, -0.3, -0.06);
        shield.add(box(0.02, 0.2, 0.12, def.id === 'pioneer' ? m.gold : m.accent, -0.04, 0.04, 0));
        if (m.glowMat) shield.add(box(0.02, 0.36, 0.03, m.glowMat, -0.04, 0, 0));
        sh.add(shield);
        break;
      }
      case 'coil': {
        const coil = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 6, 14), m.gold);
        coil.rotation.y = Math.PI / 2;
        coil.position.set(-0.16, -0.32, -0.02);
        sh.add(coil);
        break;
      }
      case 'scythe': {
        // long pole held upright with a curved glowing blade at the top
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8), m.joint);
        pole.position.set(-0.12, 0.1, -0.3);
        sh.add(pole);
        const blade = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 6, 16, Math.PI * 0.75), m.eyeMat);
        blade.position.set(-0.12, 0.8, -0.3);
        blade.rotation.set(0, Math.PI / 2, Math.PI * 0.15);
        sh.add(blade);
        break;
      }
      case 'gatling': {
        const gun = new THREE.Group();
        gun.position.set(0, -0.4, -0.34);
        for (let i = 0; i < 4; i++) {
          const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), m.joint);
          b.rotation.x = Math.PI / 2;
          const a = (i / 4) * Math.PI * 2;
          b.position.set(Math.cos(a) * 0.06, Math.sin(a) * 0.06, -0.15);
          gun.add(b);
        }
        sh.add(gun);
        break;
      }
    }
  }





  /** A chunky thruster pod per side (no wings). */
  private buildPods(g: THREE.Group, mat: THREE.Material, tipMat: THREE.Material, joint: THREE.Material) {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), mat);
    pod.position.set(0.22, 0.18, 0.06);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.32), tipMat);
    cap.position.set(0.22, 0.46, 0.06);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.14, 10), joint);
    nozzle.position.set(0.22, -0.14, 0.06);
    g.add(pod, cap, nozzle);
  }



  private ghostAlpha = 1;
  /** fade the whole model (pack-mates beside the chase camera); 1 = solid */
  setGhost(alpha: number) {
    if (alpha === this.ghostAlpha) return;
    this.ghostAlpha = alpha;
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        // remember each material's own look the first time it's faded
        mat.userData.base ??= { opacity: mat.opacity, transparent: mat.transparent, depthWrite: mat.depthWrite };
        const base = mat.userData.base as { opacity: number; transparent: boolean; depthWrite: boolean };
        const ghost = alpha < 1;
        mat.opacity = base.opacity * alpha;
        mat.transparent = ghost || base.transparent;
        mat.depthWrite = ghost ? false : base.depthWrite;
        mat.needsUpdate = true;
      }
    });
  }

  /** world position of the barrel's tip, where a fired marble appears */
  muzzleWorld(out: THREE.Vector3) {
    this.root.updateMatrixWorld(true);
    return this.barrel.localToWorld(out.set(0, 0, -0.25));
  }

  /** true once the robot has been blown apart */
  broken = false;

  /**
   * Blow the robot apart: every mesh is detached into the scene, keeping its
   * world transform, and returned so the caller can fling it around.
   */
  shatter(scene: THREE.Scene): THREE.Mesh[] {
    this.broken = true;
    this.root.updateMatrixWorld(true);
    const pieces: THREE.Mesh[] = [];
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) pieces.push(o as THREE.Mesh);
    });
    for (const p of pieces) scene.attach(p);
    // scorch the paint
    for (const m of this.mats) {
      m.color.multiplyScalar(0.55);
      m.emissive.setRGB(0, 0, 0);
    }
    return pieces;
  }

  /** Free GPU memory when swapping characters. */
  dispose() {
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[];
        (Array.isArray(mat) ? mat : [mat]).forEach((mm) => mm.dispose());
      }
    });
  }

  sync(s: Shooter, time: number, dt: number) {
    this.root.position.set(s.x, 0, -s.y);
    // the turret faces -z for the player and +z for the opponent
    this.root.rotation.y = s.team === 0 ? 0 : Math.PI;
    this.turret.rotation.y = s.team === 0 ? -s.aim : s.aim;
    this.barrel.position.z = this.barrelZ + s.recoil * (this.jaw ? 0.04 : 0.12);
    this.trigger.position.z = this.triggerZ - s.recoil * 0.1;
    // beasts: the jaw snaps open as the marble leaves the mouth
    if (this.jaw) this.jaw.rotation.x = s.recoil * 0.55;
    if (this.flame) {
      const f = 0.85 + Math.random() * 0.35;
      this.flame.scale.set(f, 0.8 + Math.random() * 0.5, f);
    }

    // walk cycle while sliding along the rail
    const moving = Math.min(1, Math.abs(s.vx) / 3);
    this.stride += dt * 14 * moving;
    // alternate legs (diagonal pairs on four-legged beasts)
    this.legs.forEach((l, i) => (l.rotation.x = Math.sin(this.stride + (i % 2) * Math.PI) * 0.5 * moving));
    this.turret.rotation.z = (s.team === 0 ? -1 : 1) * Math.sign(s.vx) * moving * 0.06;
    const bob = Math.abs(Math.sin(this.stride)) * 0.05 * moving;

    // wings breathe at idle, flare open while firing
    const flare = s.firing ? 0.18 : 0;
    const beat = Math.sin(time * 2.4) * 0.05;
    const lift = 0.2;
    this.wingR.rotation.set(0, -0.35 - flare, lift + beat + flare * 0.5);
    this.wingL.rotation.set(0, 0.35 + flare, -(lift + beat + flare * 0.5));


    // hit flash; the player's own robot flashes softer so it never washes out
    const f = s.flash > 0 ? (s.team === 0 ? 0.45 : 0.9) : 0;
    for (const m of this.mats) m.emissive.setRGB(f, f, f);
    const hurt = s.health < 25 ? Math.abs(Math.sin(time * 9)) * 0.04 : 0;
    this.root.position.y = bob + hurt;

    // shudder while flashing from a hit; a super hit also rocks it backwards
    const jolt = s.flash > 0 ? (s.stagger > 0 ? 0.16 : 0.07) : 0;
    if (jolt) {
      this.root.position.x += (Math.random() * 2 - 1) * jolt;
      this.root.position.z += (Math.random() * 2 - 1) * jolt;
    }
    const back = s.stagger > 0 ? Math.sin((s.stagger / 0.45) * Math.PI) * 0.35 : 0;
    // tip away from the attacker (player leans toward +z, opponent toward -z)
    this.root.rotation.x = s.team === 0 ? back : -back;
    this.root.rotation.y = (s.team === 0 ? 0 : Math.PI) + (jolt ? (Math.random() * 2 - 1) * jolt : 0);
  }
}

const SHAPE_OF: Record<string, Block['shape']> = {
  BoxGeometry: 'box',
  SphereGeometry: 'sphere',
  CylinderGeometry: 'cylinder',
  ConeGeometry: 'cone',
  TorusGeometry: 'torus',
};

/** default size for a freshly added block of each shape */
export const DEFAULT_SIZE: Record<Exclude<Block['shape'], 'group'>, Record<string, number>> = {
  box: { width: 0.3, height: 0.3, depth: 0.3 },
  sphere: { radius: 0.18, widthSegments: 14, heightSegments: 10 },
  cylinder: { radiusTop: 0.12, radiusBottom: 0.12, height: 0.3, radialSegments: 12 },
  cone: { radius: 0.1, height: 0.3, radialSegments: 6 },
  torus: { radius: 0.18, tube: 0.05, radialSegments: 6, tubularSegments: 14 },
};

export function blockGeometry(b: Block): THREE.BufferGeometry {
  const g = { ...(b.shape === 'group' ? {} : DEFAULT_SIZE[b.shape]), ...(b.size ?? {}) } as Record<string, number>;
  switch (b.shape) {
    case 'sphere':
      return new THREE.SphereGeometry(g.radius, g.widthSegments ?? 14, g.heightSegments ?? 10, g.phiStart ?? 0, g.phiLength ?? Math.PI * 2, g.thetaStart ?? 0, g.thetaLength ?? Math.PI);
    case 'cylinder':
      return new THREE.CylinderGeometry(g.radiusTop, g.radiusBottom, g.height, g.radialSegments ?? 12, g.heightSegments ?? 1, !!g.openEnded, g.thetaStart ?? 0, g.thetaLength ?? Math.PI * 2);
    case 'cone':
      return new THREE.ConeGeometry(g.radius, g.height, g.radialSegments ?? 6, g.heightSegments ?? 1, !!g.openEnded, g.thetaStart ?? 0, g.thetaLength ?? Math.PI * 2);
    case 'torus':
      return new THREE.TorusGeometry(g.radius, g.tube, g.radialSegments ?? 6, g.tubularSegments ?? 14, g.arc ?? Math.PI * 2);
    default:
      return new THREE.BoxGeometry(g.width, g.height, g.depth);
  }
}

/** a block colour: a palette slot follows the unit's colours, a number is fixed */
export function resolveColor(c: ColorRef, def: CharacterDef, ball: number) {
  if (typeof c === 'number') return c;
  if (c === 'ball') return ball;
  return def.palette[c];
}

function colorRefOf(hex: number, kind: string, def: CharacterDef, ball: number): ColorRef {
  if (kind === 'phong' && hex === ball) return 'ball';
  for (const k of ['body', 'trim', 'accent', 'joint', 'eye'] as const) if (def.palette[k] === hex) return k;
  return hex;
}
