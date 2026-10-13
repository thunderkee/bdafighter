import * as THREE from 'three';
import { meshGeometry } from './meshkit';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Shooter } from './game';
import { loadRoster, type Block, type ColorRef, type Role, type RosterData, type Traits, type UnitEntry, type V3 } from './roster';
import shippedRoster from './roster-shipped.json';
import { cachedPublished } from './published';

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
  body?: 'mech' | 'rex' | 'cat' | 'lizard' | 'beetle' | 'eva' | 'megatron';
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
    palette: { body: 0x8a5ae0, trim: 0x1b1a22, accent: 0x3de87c, joint: 0x15101e, wing: 0x8a5ae0, wingTip: 0x3de87c, eye: 0xf4ea8a },
    crest: 'eva',
    body: 'eva',
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
    palette: { body: 0x6a3fd8, trim: 0xa63ab8, accent: 0xf0e4b8, joint: 0x2a3470, wing: 0x6a3fd8, wingTip: 0xa63ab8, eye: 0xff2a2a },
    crest: 'tyrant',
    body: 'megatron',
    eyes: 'twin',
    wings: 'none',
    shoulders: 'spike',
    offhand: 'none',
    feet: 'claw',
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
    palette: { body: 0x2a50ba, trim: 0x4b556d, accent: 0xcaa56c, joint: 0x2a2f3c, wing: 0x2a50ba, wingTip: 0x4b556d, eye: 0xff9a2a },
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

/**
 * Unit Lab designs that ship with the game: everyone gets these as the built-ins'
 * defaults. Exported from the Unit Lab roster (src/roster-shipped.json).
 */
export const SHIPPED: RosterData = shippedRoster as unknown as RosterData;

/** a unit with one roster layer (shipped or device) applied */
function applyEntry(def: CharacterDef, u: UnitEntry | undefined, id = def.id): CharacterDef {
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
}

/** the built-ins as shipped (code designs plus the shipped Unit Lab edits) */
/** the roster published from the Unit Studio: shared by every player, above the shipped designs */
let PUBLISHED: RosterData = cachedPublished();
export function setPublished(data: RosterData) {
  PUBLISHED = { units: data.units ?? {} };
}

/** a built-in unit as everyone gets it: shipped design, then the published one */
export const shippedById = (id: string) => {
  const b = BUILTINS.find((c) => c.id === id);
  return b ? applyEntry(applyEntry(b, SHIPPED.units[id]), PUBLISHED.units[id]) : undefined;
};

/** built-ins with the shipped and published designs, then this device's edits; then shared and own custom units */
export function rosterCharacters(data = loadRoster()): CharacterDef[] {
  const isBuiltin = (id: string) => BUILTINS.some((b) => b.id === id);
  const out = BUILTINS.map((b) => applyEntry(shippedById(b.id)!, data.units[b.id]));
  const customs = new Map<string, CharacterDef>();
  for (const u of Object.values(PUBLISHED.units)) {
    if (isBuiltin(u.id)) continue;
    customs.set(u.id, applyEntry(shippedById(u.base) ?? BUILTINS[0], u, u.id));
  }
  for (const u of Object.values(data.units)) {
    if (isBuiltin(u.id)) continue;
    customs.set(u.id, applyEntry(customs.get(u.id) ?? shippedById(u.base) ?? BUILTINS[0], u, u.id));
  }
  out.push(...customs.values());
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
  /** model scale on top of the animation (an arcade boss stands taller) */
  size = 1;
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
  /** rest pose of animated parts (Unit Lab designs can tilt them); animation is added on top */
  private rest = { turretY: 0, turretZ: 0, jaw: 0, legs: [] as number[], flame: new THREE.Vector3(1, 1, 1) };
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
    if (def.body === 'eva' || def.body === 'cat' || def.body === 'megatron') {
      const hm: HeroMats = { body, trim, accent, joint, eyeMat, ballMat, eyeColor: pal.eye, accentColor: pal.accent };
      if (def.body === 'eva') this.buildEva(hm);
      else if (def.body === 'cat') this.buildLion(hm);
      else this.buildMegatron(hm);
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
      // detail: knee seam, knee bolt, calf piston, shin vents, heel block, sole rim
      leg.add(box(0.34, 0.035, 0.36, joint, 0, -0.13, 0));
      leg.add(box(0.06, 0.06, 0.02, gold, 0, -0.18, -0.235));
      const piston = cyl(0.028, 0.028, 0.2, trim, 8);
      piston.position.set(side * 0.12, -0.25, 0.18);
      leg.add(piston);
      for (let k = 0; k < 3; k++) leg.add(box(0.02, 0.025, 0.2, trim, side * 0.165, -0.2 - k * 0.05, 0.02));
      leg.add(box(0.2, 0.1, 0.08, trim, 0, -0.38, 0.29));
      leg.add(box(0.44, 0.03, 0.68, joint, 0, -0.465, -0.06));
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
    // the marble leaves through the belly cannon's mouth (the rex-head unit has no cannon, so its belly)
    if (def.barrel === 'rexhead') this.markBelly(this.turret, 0, 0.06, -0.36);
    else this.markBelly(this.turret, 0, 0.16, -0.66);
    this.turret.add(box(0.7, 0.26, 0.1, trim, 0, 0.33, -0.3)); // chest block
    for (const side of [-1, 1]) this.turret.add(box(0.18, 0.08, 0.04, def.darkFace ? accent : gold, side * 0.2, 0.38, -0.36)); // vents
    if (glowMat) {
      this.turret.add(box(0.04, 0.4, 0.02, glowMat, 0, 0.25, -0.36));
      for (const side of [-1, 1]) this.turret.add(box(0.02, 0.36, 0.5, glowMat, side * 0.41, 0.25, 0));
    }
    const coreBall = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), ballMat);
    coreBall.position.set(0, 0.45, -0.32);
    this.turret.add(coreBall);
    // detail: collar, chest panel lines, vented side armour, back plate and twin thrusters
    this.turret.add(box(0.5, 0.06, 0.42, joint, 0, 0.52, 0));
    for (const side of [-1, 1]) {
      this.turret.add(box(0.015, 0.22, 0.015, joint, side * 0.28, 0.32, -0.352));
      this.turret.add(box(0.04, 0.3, 0.42, trim, side * 0.41, 0.24, 0.02));
      for (let k = 0; k < 3; k++) this.turret.add(box(0.045, 0.025, 0.32, joint, side * 0.415, 0.14 + k * 0.07, 0.02));
      const thruster = cyl(0.075, 0.095, 0.18, joint, 12);
      thruster.rotation.x = Math.PI / 2;
      thruster.position.set(side * 0.22, 0.2, 0.38);
      const nozzle = cyl(0.055, 0.055, 0.02, new THREE.MeshBasicMaterial({ color: 0x08060f }), 12);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(side * 0.22, 0.2, 0.475);
      this.turret.add(thruster, nozzle);
    }
    this.turret.add(box(0.6, 0.3, 0.05, trim, 0, 0.3, 0.32));

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
      // detail: shoulder rivets, elbow joint, forearm plate, wrist band
      for (const rz of [-0.1, 0.1]) sh.add(box(0.04, 0.025, 0.04, gold, side * 0.08, 0.22, rz));
      sh.add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), joint).translateY(-0.17).translateZ(0.02));
      const plate = box(0.23, 0.08, 0.2, trim, 0, -0.3, -0.12);
      plate.rotation.x = -0.5;
      sh.add(plate);
      sh.add(box(0.24, 0.04, 0.24, accent, -side * 0.08, -0.31, -0.24));
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
    for (const side of [-1, 1]) {
      head.add(box(0.1, 0.24, 0.3, trim, side * 0.4, -0.02, 0)); // ear blocks
      // detail: ear vents and a sensor antenna
      for (let k = 0; k < 3; k++) head.add(box(0.02, 0.025, 0.2, joint, side * 0.455, -0.08 + k * 0.05, 0));
      head.add(box(0.025, 0.18, 0.025, joint, side * 0.4, 0.18, 0.1));
      head.add(box(0.05, 0.03, 0.05, accent, side * 0.4, 0.28, 0.1));
    }
    // detail: brow ledge over the eyes, mouth grille, a fin down the back of the helmet
    head.add(box(0.6, 0.04, 0.08, trim, 0, 0.11, -0.35));
    for (let k = 0; k < 4; k++) head.add(box(0.02, 0.07, 0.01, def.darkFace ? trim : joint, -0.06 + k * 0.04, -0.15, -0.373));
    head.add(box(0.06, 0.16, 0.3, trim, 0, 0.3, 0.2));
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
      this.markBelly(this.turret, 0, -0.1, -0.48);
      // body: deep chest, waist frame, hips
      const chest = box(0.6, 0.5, 0.58, m.body, 0, 0.08, -0.16);
      chest.rotation.x = 0.1;
      this.turret.add(chest);
      this.turret.add(box(0.44, 0.3, 0.46, m.joint, 0, -0.12, 0.12)); // exposed frame
      this.turret.add(box(0.52, 0.4, 0.42, m.body, 0, 0.04, 0.36)); // hips
      this.turret.add(box(0.42, 0.06, 0.9, m.trim, 0, 0.35, 0.1)); // spine armour
      // detail: vented flank armour, a glowing chest core, hip pistons
      for (const side of [-1, 1]) {
        const flank = box(0.04, 0.3, 0.42, m.trim, side * 0.31, 0.08, -0.16);
        flank.rotation.x = 0.1;
        this.turret.add(flank);
        for (let k = 0; k < 3; k++) {
          const slat = box(0.045, 0.025, 0.32, m.joint, side * 0.315, 0.0 + k * 0.07, -0.16);
          slat.rotation.x = 0.1;
          this.turret.add(slat);
        }
        const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), m.joint);
        piston.position.set(side * 0.27, -0.06, 0.36);
        piston.rotation.x = 0.5;
        this.turret.add(piston);
      }
      this.turret.add(sph(0.07, m.ballMat, 0, 0.14, -0.46));
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
        // armour band between segments
        const band = box(w + 0.03, w * 0.85 + 0.03, 0.05, m.joint, 0, -k * 0.05, 0.29 + k * 0.3);
        band.rotation.x = 0.1;
        tail.add(band);
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
      // detail: plates stacked down the neck
      for (let k = 0; k < 2; k++) {
        const np = box(0.24, 0.04, 0.14, m.trim, 0, 0.36 - k * 0.07, -0.44 - k * 0.1);
        np.rotation.x = -0.4;
        this.turret.add(np);
      }
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
      // detail: nostril slits, jaw-hinge bolts, a scar plate across the snout
      for (const side of [-1, 1]) {
        head.add(box(0.04, 0.02, 0.03, dark, side * 0.07, 0.06, -0.64));
        head.add(box(0.03, 0.05, 0.05, m.gold, side * 0.19, -0.08, 0.06));
      }
      head.add(box(0.33, 0.03, 0.12, m.trim, 0, 0.07, -0.42));
      this.turret.add(head);
      mouth(head, -0.62, -0.09, 0.3);
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
      this.markBelly(this.root, 0, 0.66, -0.22);
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

  /** Metabee from the figure sheet: chibi build, big round head with twin launchers, white ribbed core,
   * yellow side plates and shoulder blocks, black gun barrels on the forearms and back, blocky yellow boots */
  private buildBeetle(
    def: CharacterDef,
    m: { body: THREE.Material; trim: THREE.Material; accent: THREE.Material; joint: THREE.Material; gold: THREE.Material; eyeMat: THREE.Material; ballMat: THREE.Material },
  ) {
    void def;
    const white = this.paint(0xf2f2ee);
    const grey = this.paint(0xb9bcc4);
    const deep = this.paint(0xd99a0c);
    const visor = new THREE.MeshBasicMaterial({ color: 0x07070b });
    const hole = new THREE.MeshBasicMaterial({ color: 0x050507 });
    /** a black gun barrel pointing along -z, with a dark bore */
    const gun = (len: number, r: number) => {
      const g = new THREE.Group();
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), m.trim);
      tube.rotation.x = Math.PI / 2;
      tube.position.z = -len / 2;
      const bore = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.6, 0.012, 10), hole);
      bore.rotation.x = Math.PI / 2;
      bore.position.z = -len - 0.002;
      g.add(tube, bore);
      return g;
    };

    // legs: white thighs, black knee hinge, big yellow boots crossed with an X, white feet with black claws
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.19, 0.55, 0);
      leg.add(rbox(0.13, 0.14, 0.14, 0.04, white, 0, -0.04, 0));
      leg.add(rbox(0.12, 0.06, 0.12, 0.02, m.trim, 0, -0.13, 0));
      leg.add(rbox(0.25, 0.3, 0.28, 0.05, m.body, 0, -0.3, 0));
      leg.add(rbox(0.28, 0.08, 0.31, 0.03, m.body, 0, -0.43, 0));
      for (const tilt of [-0.62, 0.62]) {
        const x = rbox(0.03, 0.34, 0.02, 0.008, deep, 0, -0.32, -0.145);
        x.rotation.z = tilt;
        leg.add(x);
      }
      leg.add(rbox(0.22, 0.07, 0.34, 0.03, white, 0, -0.505, -0.03));
      for (const x of [-0.06, 0.06]) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), m.trim);
        claw.rotation.x = -Math.PI / 2;
        claw.position.set(x, -0.52, -0.24);
        leg.add(claw);
      }
      const heel = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 4), m.trim);
      heel.rotation.x = Math.PI / 2;
      heel.position.set(0, -0.52, 0.18);
      leg.add(heel);
      this.root.add(leg);
      this.legs.push(leg);
    }
    // the round yellow pelvis, with a white crotch plate
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 12), m.body);
    pelvis.scale.set(1.15, 0.75, 1.05);
    pelvis.position.set(0, 0.6, 0.03);
    this.root.add(pelvis);
    this.root.add(rbox(0.12, 0.1, 0.06, 0.025, white, 0, 0.56, -0.19));

    this.turret.position.y = 0.66;
    this.root.add(this.turret);
    // torso: white ribbed core between yellow side plates, yellow collar
    this.turret.add(rbox(0.2, 0.16, 0.18, 0.05, white, 0, 0.06, 0));
    for (const y of [0.02, 0.06, 0.1]) this.turret.add(rbox(0.16, 0.012, 0.02, 0.004, grey, 0, y, -0.092));
    this.turret.add(rbox(0.3, 0.22, 0.26, 0.07, white, 0, 0.24, 0));
    for (const side of [-1, 1]) {
      const plate = rbox(0.1, 0.22, 0.28, 0.04, m.body, side * 0.17, 0.25, 0);
      plate.rotation.z = side * -0.08;
      this.turret.add(plate);
    }
    this.turret.add(rbox(0.36, 0.07, 0.26, 0.03, m.body, 0, 0.37, 0));
    this.turret.add(rbox(0.08, 0.1, 0.03, 0.01, grey, 0, 0.24, -0.135));
    this.markBelly(this.turret, 0, 0.14, -0.16);
    // backpack (the trigger) with a dark vent, and the two black barrels angled up behind the shoulders
    this.trigger = rbox(0.16, 0.14, 0.08, 0.03, white, 0, 0.28, 0.16);
    this.trigger.add(rbox(0.08, 0.05, 0.02, 0.008, m.trim, 0, -0.02, 0.04));
    this.turret.add(this.trigger);
    for (const side of [-1, 1]) {
      const back = gun(0.26, 0.045);
      back.position.set(side * 0.13, 0.32, 0.14);
      back.rotation.set(-2.3, side * -0.35, 0);
      this.turret.add(back);
    }
    // shoulders, white upper arms, yellow forearm blocks; each forearm carries a black barrel
    for (const side of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(side * 0.28, 0.34, 0);
      sh.add(rbox(0.16, 0.13, 0.2, 0.04, m.body, 0, 0, 0));
      sh.add(rbox(0.17, 0.03, 0.21, 0.01, white, 0, -0.07, 0));
      sh.add(rbox(0.08, 0.14, 0.08, 0.025, white, side * 0.02, -0.15, 0));
      sh.add(rbox(0.13, 0.17, 0.15, 0.04, m.body, side * 0.03, -0.3, -0.02));
      sh.add(rbox(0.08, 0.07, 0.08, 0.025, white, side * 0.03, -0.42, -0.02));
      if (side < 0) {
        const off = gun(0.24, 0.04);
        off.position.set(side * 0.1, -0.3, 0.06);
        sh.add(off);
      }
      this.turret.add(sh);
    }
    // the right forearm barrel is the main gun: it recoils on every shot
    this.barrel.position.set(0.41, 0.04, 0.06);
    this.barrelZ = 0.06;
    this.barrel.add(gun(0.26, 0.045));
    this.turret.add(this.barrel);

    // head, like the figure: a big round yellow dome, wider toward the jaw, a black visor band with two
    // big green eyes, a white rounded lower face, and the stalk carrying the twin black seeker launchers
    this.turret.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.1, 12), white).translateY(0.43));
    const head = new THREE.Group();
    head.position.set(0, 0.72, -0.02);
    head.scale.setScalar(1.15);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.33, 24, 18), m.body);
    dome.scale.set(1, 0.95, 1.04);
    dome.position.set(0, 0.07, 0.03);
    head.add(dome);
    // the lower shell: the helmet flares out around the jaw
    head.add(rbox(0.64, 0.22, 0.56, 0.11, m.body, 0, -0.14, 0.04));
    head.add(rbox(0.56, 0.2, 0.2, 0.08, visor, 0, -0.03, -0.21));
    for (const side of [-1, 1]) {
      const eye = rbox(0.19, 0.1, 0.02, 0.035, m.eyeMat, side * 0.115, -0.03, -0.312);
      eye.rotation.z = side * 0.2;
      head.add(eye);
    }
    head.add(rbox(0.42, 0.2, 0.24, 0.09, white, 0, -0.2, -0.17));
    head.add(rbox(0.16, 0.012, 0.02, 0.004, m.joint, 0, -0.21, -0.292));
    head.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.2, 12), m.body).translateY(0.45).translateZ(0.02));
    for (const side of [-1, 1]) {
      const pod = new THREE.Group();
      pod.position.set(side * 0.2, 0.61, 0.02);
      pod.scale.setScalar(1.15);
      pod.rotation.z = side * 0.32;
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.32, 16), m.trim);
      tube.rotation.z = Math.PI / 2;
      pod.add(tube);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.05, 16), m.trim);
      rim.rotation.z = Math.PI / 2;
      rim.position.x = side * 0.15;
      pod.add(rim);
      const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 14), hole);
      mouth.rotation.z = Math.PI / 2;
      mouth.position.x = side * 0.176;
      pod.add(mouth);
      for (const dx of [-0.09, -0.01, 0.07]) {
        const h = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.02, 10), hole);
        h.rotation.x = Math.PI / 2;
        h.position.set(side * dx, 0, -0.07);
        pod.add(h);
      }
      head.add(pod);
    }
    this.turret.add(head);
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
          this.rest.turretY = o.rotation.y;
          this.rest.turretZ = o.rotation.z;
          break;
        case 'barrel':
          this.barrel = o;
          this.barrelZ = o.position.z;
          break;
        case 'leg':
          this.legs.push(o);
          this.rest.legs.push(o.rotation.x);
          break;
        case 'jaw':
          this.jaw = o;
          this.rest.jaw = o.rotation.x;
          break;
        case 'flame':
          this.flame = o;
          this.rest.flame.copy(o.scale);
          break;
        case 'belly':
          this.bellyMark = o;
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
      if (o === this.bellyMark) return 'belly';
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

  // ---------- hero builds from the reference sheets (more shapes: rounded armour, capsules, curves) ----------

  /** a lambert material that joins the hit-flash list */
  private paint(color: number) {
    const m = new THREE.MeshLambertMaterial({ color });
    this.mats.push(m);
    return m;
  }

  /** chibi EVA-01 from the figure sheet: big hooded helmet with horn and grey beak jaw, tall black pylons, rifle held across the body */
  private buildEva(m: HeroMats) {
    const orange = this.paint(0xf0a23a);
    const slate = this.paint(0x6f7d96);
    const gun = this.paint(0x5d646e);
    const black = this.paint(0x16141c);
    // legs: purple thighs, knees with orange and black diamonds, green ankle bands, purple feet on orange soles
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.2, 0.6, 0.02);
      leg.add(rbox(0.24, 0.28, 0.27, 0.08, m.body, 0, -0.1, 0));
      leg.add(rbox(0.22, 0.16, 0.2, 0.06, m.body, 0, -0.27, -0.05));
      const dia = rbox(0.08, 0.08, 0.02, 0.01, orange, side * 0.03, -0.27, -0.155);
      dia.rotation.z = Math.PI / 4;
      const dia2 = rbox(0.06, 0.06, 0.02, 0.01, black, -side * 0.05, -0.24, -0.15);
      dia2.rotation.z = Math.PI / 4;
      leg.add(dia, dia2);
      leg.add(rbox(0.25, 0.22, 0.28, 0.08, m.body, 0, -0.42, 0));
      leg.add(rbox(0.27, 0.06, 0.3, 0.025, m.accent, 0, -0.5, 0));
      leg.add(rbox(0.3, 0.11, 0.44, 0.05, m.body, 0, -0.55, -0.07));
      leg.add(rbox(0.31, 0.04, 0.46, 0.015, orange, 0, -0.615, -0.07));
      this.root.add(leg);
      this.legs.push(leg);
    }
    // hips with the green crotch diamond
    this.root.add(rbox(0.38, 0.14, 0.26, 0.06, m.body, 0, 0.64, 0));
    const crotch = rbox(0.11, 0.11, 0.04, 0.015, m.accent, 0, 0.6, -0.135);
    crotch.rotation.z = Math.PI / 4;
    this.root.add(crotch);
    this.turret.position.y = 0.7;
    this.root.add(this.turret);
    // torso: purple waist and chest, orange ribs under the chin, green V collar, umbilical plug on the back
    this.turret.add(rbox(0.3, 0.14, 0.24, 0.05, m.body, 0, 0.06, 0));
    this.turret.add(rbox(0.26, 0.06, 0.22, 0.02, black, 0, 0.15, 0));
    this.turret.add(rbox(0.5, 0.32, 0.38, 0.1, m.body, 0, 0.34, 0));
    this.turret.add(rbox(0.28, 0.12, 0.04, 0.015, orange, 0, 0.42, -0.19));
    for (const y of [0.39, 0.42, 0.45]) this.turret.add(rbox(0.24, 0.012, 0.02, 0.004, black, 0, y, -0.212));
    this.turret.add(rbox(0.015, 0.1, 0.02, 0.004, black, 0, 0.42, -0.213));
    for (const side of [-1, 1]) {
      const collar = rbox(0.18, 0.05, 0.08, 0.02, m.accent, side * 0.11, 0.5, -0.16);
      collar.rotation.z = side * 0.5;
      this.turret.add(collar);
      this.turret.add(rbox(0.08, 0.05, 0.03, 0.01, m.accent, side * 0.17, 0.26, -0.19));
      this.turret.add(rbox(0.06, 0.12, 0.03, 0.01, m.accent, side * 0.1, 0.32, 0.2));
    }
    this.turret.add(rbox(0.14, 0.16, 0.08, 0.03, m.body, 0, 0.36, 0.22));
    this.turret.add(rbox(0.08, 0.04, 0.04, 0.01, m.accent, 0, 0.42, 0.265));
    this.markBelly(this.turret, 0, 0.26, -0.28);
    // belly port: the B-Daman barrel, ringed in green
    this.barrel.position.set(0, 0.26, -0.19);
    this.barrelZ = -0.19;
    const port = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.06, 16), black);
    port.rotation.x = Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 8, 20), m.accent);
    ring.position.z = -0.03;
    this.barrel.add(port, ring);
    this.turret.add(this.barrel);
    // shoulders: tall black pylons with green tips and bands, arms bent forward to hold the rifle
    for (const side of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(side * 0.34, 0.46, 0);
      sh.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), m.body));
      const pylon = new THREE.Group();
      pylon.position.set(side * 0.1, 0.12, 0.02);
      pylon.rotation.z = -side * 0.1;
      pylon.add(rbox(0.16, 0.2, 0.22, 0.06, m.body, -side * 0.05, -0.04, 0));
      pylon.add(rbox(0.07, 0.6, 0.24, 0.02, m.trim, 0, 0.12, 0));
      pylon.add(rbox(0.075, 0.1, 0.25, 0.02, m.accent, 0, 0.44, 0));
      pylon.add(rbox(0.075, 0.04, 0.25, 0.012, m.accent, 0, 0.22, 0));
      pylon.add(rbox(0.075, 0.24, 0.03, 0.01, m.accent, 0, 0.02, -0.12));
      const hex = rbox(0.02, 0.07, 0.07, 0.01, orange, side * 0.04, -0.02, 0.03);
      hex.rotation.x = Math.PI / 4;
      pylon.add(hex);
      sh.add(pylon);
      sh.add(rbox(0.13, 0.18, 0.13, 0.04, m.body, 0, -0.16, 0));
      sh.add(rbox(0.15, 0.04, 0.15, 0.015, m.accent, 0, -0.26, 0));
      const turn = new THREE.Group();
      turn.position.set(0, -0.28, 0);
      turn.rotation.y = side * 0.5;
      const fore = new THREE.Group();
      fore.rotation.x = 1.2;
      fore.add(rbox(0.15, 0.2, 0.15, 0.05, m.body, 0, -0.1, 0));
      fore.add(rbox(0.16, 0.04, 0.16, 0.015, m.accent, 0, -0.19, 0));
      fore.add(rbox(0.12, 0.1, 0.12, 0.04, m.body, 0, -0.26, 0));
      turn.add(fore);
      sh.add(turn);
      this.turret.add(sh);
    }
    // the rifle, carried diagonally across the hips
    const rifle = new THREE.Group();
    rifle.position.set(0, 0.11, -0.32);
    rifle.rotation.set(0, 0.45, 0.12);
    rifle.scale.setScalar(1.3);
    rifle.add(rbox(0.09, 0.12, 0.62, 0.03, gun));
    rifle.add(rbox(0.08, 0.14, 0.18, 0.03, gun, 0, -0.02, 0.36));
    rifle.add(rbox(0.05, 0.14, 0.07, 0.015, gun, 0, -0.12, -0.05));
    rifle.add(rbox(0.05, 0.05, 0.2, 0.015, black, 0, 0.09, 0.02));
    rifle.add(rbox(0.04, 0.1, 0.05, 0.01, black, 0, -0.1, 0.14));
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8), black);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.z = -0.4;
    rifle.add(muzzle);
    this.turret.add(rifle);
    this.turret.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.1, 12), m.accent).translateY(0.56));
    // head (chibi-big, like the figure): a long ridged crown swept back, a V brow that points down
    // between two angry yellow eyes, hood flaps flaring down each side with green stripes,
    // a grey muzzle and long chin pointing down, green cheek bars, and the horn off the forehead
    const head = new THREE.Group();
    head.position.set(0, 0.8, -0.02);
    head.scale.setScalar(1.35);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.26, 22, 16), m.body);
    crown.scale.set(1.0, 0.78, 1.35);
    crown.position.set(0, 0.13, 0.06);
    head.add(crown);
    const ridge = rbox(0.1, 0.1, 0.56, 0.045, m.body, 0, 0.3, 0.04);
    ridge.rotation.x = -0.1;
    head.add(ridge);
    head.add(rbox(0.36, 0.2, 0.3, 0.08, m.body, 0, 0.02, 0.24));
    const nape = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), slate);
    nape.position.set(0, -0.08, 0.22);
    head.add(nape);
    head.add(rbox(0.28, 0.08, 0.1, 0.025, black, 0, -0.01, -0.27));
    head.add(rbox(0.34, 0.22, 0.14, 0.05, m.body, 0, -0.15, -0.2));
    for (const side of [-1, 1]) {
      // V brow: the inner ends dip down over the nose
      const brow = rbox(0.21, 0.07, 0.3, 0.03, m.body, side * 0.1, 0.07, -0.22);
      brow.rotation.set(0.2, side * 0.2, side * 0.3);
      head.add(brow);
      // hood flap: flares out at the bottom, striped green
      const flap = new THREE.Group();
      flap.position.set(side * 0.25, -0.04, 0.02);
      flap.rotation.set(0, side * 0.12, side * 0.32);
      flap.add(rbox(0.05, 0.32, 0.42, 0.025, m.body));
      flap.add(rbox(0.055, 0.04, 0.4, 0.012, m.accent, 0, 0.08, 0));
      flap.add(rbox(0.055, 0.14, 0.04, 0.012, m.accent, 0, -0.07, -0.19));
      head.add(flap);
      const backFin = rbox(0.035, 0.14, 0.22, 0.012, m.accent, side * 0.18, 0.18, 0.34);
      backFin.rotation.set(-0.4, side * 0.35, 0);
      head.add(backFin);
      // angular yellow eyes, slanted down toward the nose, tapering to a sharp outer point
      const eye = rbox(0.1, 0.05, 0.02, 0.012, m.eyeMat, side * 0.07, -0.015, -0.315);
      eye.rotation.z = side * 0.32;
      head.add(eye);
      const tail = rbox(0.07, 0.026, 0.02, 0.008, m.eyeMat, side * 0.122, 0.012, -0.314);
      tail.rotation.z = side * 0.6;
      head.add(tail);
      const cheek = rbox(0.04, 0.17, 0.05, 0.012, m.accent, side * 0.125, -0.15, -0.29);
      cheek.rotation.set(0.25, 0, -side * 0.35);
      head.add(cheek);
    }
    head.add(rbox(0.2, 0.1, 0.14, 0.035, slate, 0, -0.1, -0.3));
    const chin = rbox(0.13, 0.22, 0.1, 0.04, slate, 0, -0.24, -0.32);
    chin.rotation.x = 0.3;
    head.add(chin);
    for (const y of [-0.22, -0.27, -0.32]) {
      const slot = rbox(0.08, 0.012, 0.02, 0.004, black, 0, y + 0.03, -0.375 - (y + 0.22) * 0.3);
      slot.rotation.x = 0.3;
      head.add(slot);
    }
    head.add(taper(curvePts(9, [0, 0.24, -0.18], [0, 0.42, -0.32], [0, 0.6, -0.44]), 0.065, 0.012, m.body));
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 8, 16), m.accent);
    band.position.set(0, 0.47, -0.37);
    band.rotation.x = 0.9;
    head.add(band);
    this.turret.add(head);
    this.trigger = new THREE.Object3D();
    this.turret.add(this.trigger);
  }

  /** shield liger from the model sheet: boxy blue armour ribbed with vents, slate frame studded with silver discs,
   * orange canopy, slotted crest, gold block paws, straight cannon tail */
  private buildLion(m: HeroMats) {
    const white = this.paint(0xf4f2ea);
    const silver = this.paint(0xb8bec9);
    const canopy = new THREE.MeshPhongMaterial({ color: m.eyeColor, shininess: 140, specular: 0xffffff, transparent: true, opacity: 0.82 });
    const disc = (parent: THREE.Object3D, x: number, y: number, z: number, r: number, facing: 'x' | 'z') => {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.03, 12), silver);
      if (facing === 'x') d.rotation.z = Math.PI / 2;
      else d.rotation.x = Math.PI / 2;
      d.position.set(x, y, z);
      parent.add(d);
    };
    // horizontal blue slats over a dark backing: the ribbed vents all over the reference
    const vents = (parent: THREE.Object3D, x: number, y0: number, z: number, n: number, depth: number, side: number) => {
      parent.add(rbox(0.02, n * 0.05, depth + 0.02, 0.006, m.joint, x - side * 0.012, y0 + (n - 1) * 0.025, z));
      for (let k = 0; k < n; k++) parent.add(rbox(0.03, 0.026, depth, 0.008, m.body, x, y0 + k * 0.05, z));
    };
    const order: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]; // FL, FR, BR, BL: diagonal pairs swing together
    for (const [sx, sz] of order) {
      const front = sz < 0;
      const leg = new THREE.Group();
      leg.position.set(sx * 0.32, front ? 0.64 : 0.6, sz * 0.42);
      leg.add(rbox(0.24, 0.3, 0.32, 0.05, m.body, 0, -0.05, 0));
      vents(leg, sx * 0.135, -0.16, 0, 4, 0.24, sx);
      disc(leg, sx * 0.125, 0.06, 0.06, 0.045, 'x');
      leg.add(rbox(0.2, 0.24, 0.24, 0.04, m.trim, 0, -0.33, 0));
      disc(leg, sx * 0.105, -0.28, 0.05, 0.04, 'x');
      disc(leg, sx * 0.105, -0.38, -0.05, 0.04, 'x');
      disc(leg, 0, -0.3, -0.125, 0.035, 'z');
      leg.add(rbox(0.2, 0.06, 0.2, 0.02, m.joint, 0, -0.47, 0));
      leg.add(rbox(0.28, 0.1, 0.3, 0.03, m.accent, 0, -0.53, -0.03));
      for (let k = 0; k < 4; k++) leg.add(rbox(0.06, 0.09, 0.11, 0.025, m.accent, -0.1 + k * 0.066, -0.535, -0.22));
      this.root.add(leg);
      this.legs.push(leg);
    }
    // body: boxy blue chest and haunches ribbed with vents, slate frame between, back pods with round cannon ends
    this.root.add(rbox(0.6, 0.42, 0.5, 0.06, m.body, 0, 0.82, -0.26));
    this.root.add(rbox(0.44, 0.3, 0.5, 0.05, m.trim, 0, 0.76, 0.12));
    this.root.add(rbox(0.54, 0.36, 0.4, 0.06, m.body, 0, 0.76, 0.46));
    this.root.add(rbox(0.44, 0.06, 0.9, 0.02, m.body, 0, 1.0, 0.1));
    for (const side of [-1, 1]) {
      vents(this.root, side * 0.315, 0.66, -0.26, 6, 0.4, side);
      vents(this.root, side * 0.285, 0.64, 0.46, 5, 0.3, side);
      disc(this.root, side * 0.225, 0.8, 0.04, 0.05, 'x');
      disc(this.root, side * 0.225, 0.68, 0.2, 0.04, 'x');
      this.root.add(rbox(0.18, 0.16, 0.3, 0.03, m.trim, side * 0.17, 1.1, 0.42));
      for (const dx of [-0.045, 0.045]) disc(this.root, side * 0.17 + dx, 1.1, 0.575, 0.035, 'z');
      const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 10), m.trim);
      gun.rotation.x = Math.PI / 2;
      gun.position.set(side * 0.17, 1.08, 0.14);
      this.root.add(gun);
    }
    for (let k = 0; k < 6; k++) this.root.add(rbox(0.4, 0.025, 0.035, 0.008, m.trim, 0, 1.04, -0.12 + k * 0.08));
    this.markBelly(this.root, 0, 0.64, -0.55);
    // tail: a straight cannon pointing back, with a boxy fork at the tip
    this.root.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), m.joint).translateY(0.9).translateZ(0.68));
    this.root.add(taper([new THREE.Vector3(0, 0.9, 0.68), new THREE.Vector3(0, 1.0, 1.36)], 0.05, 0.035, m.trim));
    this.root.add(rbox(0.1, 0.1, 0.18, 0.02, m.trim, 0, 1.01, 1.44));
    for (const side of [-1, 1]) this.root.add(rbox(0.03, 0.08, 0.1, 0.01, m.trim, side * 0.06, 1.01, 1.56));
    // head on the turret (it aims): boxy skull, orange canopy in a silver frame, slotted crest,
    // vented cheeks, big sabre fangs and teeth, a snapping jaw
    this.turret.position.set(0, 0.88, -0.62);
    this.root.add(this.turret);
    this.turret.add(rbox(0.3, 0.26, 0.3, 0.05, m.joint, 0, -0.04, 0.22));
    // head, like the model sheet: a big blue block, the orange canopy a dome tipped forward over the brow
    // and framed by raised side rims, the slotted crest and antenna behind it, ribbed cheeks, huge fangs
    const head = new THREE.Group();
    head.scale.setScalar(1.2);
    head.add(rbox(0.46, 0.3, 0.44, 0.05, m.body, 0, 0.04, -0.02));
    head.add(rbox(0.4, 0.16, 0.22, 0.04, m.body, 0, 0.22, 0.1));
    for (const side of [-1, 1]) {
      const rim = rbox(0.06, 0.12, 0.42, 0.02, m.body, side * 0.2, 0.2, -0.16);
      rim.rotation.x = -0.25;
      head.add(rim);
    }
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), canopy);
    glass.scale.set(1.08, 1.05, 1.5);
    glass.rotation.x = -0.5;
    glass.position.set(0, 0.17, -0.2);
    head.add(glass);
    const crest = new THREE.Group();
    crest.position.set(0, 0.3, 0.14);
    crest.rotation.x = -0.15;
    crest.add(rbox(0.16, 0.06, 0.12, 0.02, m.body, 0, -0.01, 0));
    crest.add(rbox(0.22, 0.3, 0.05, 0.02, m.body, 0, 0.16, 0));
    for (let k = 0; k < 4; k++) crest.add(rbox(0.025, 0.22, 0.06, 0.006, m.joint, -0.075 + k * 0.05, 0.16, 0));
    const antenna = rbox(0.02, 0.24, 0.02, 0.006, m.trim, 0.05, 0.38, 0.06);
    antenna.rotation.x = -0.6;
    crest.add(antenna);
    head.add(crest);
    // upper jaw under the canopy
    head.add(rbox(0.38, 0.12, 0.24, 0.04, m.body, 0, -0.03, -0.38));
    for (const side of [-1, 1]) {
      vents(head, side * 0.245, -0.1, -0.06, 6, 0.36, side);
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.34, 8), white);
      fang.rotation.x = Math.PI;
      fang.position.set(side * 0.13, -0.2, -0.46);
      head.add(fang);
    }
    this.lionTeeth(head, white);
    this.turret.add(head);
    this.mouthOn(head, m, -0.5, -0.1, 0.28, white);
    this.trigger = new THREE.Object3D();
    this.turret.add(this.trigger);
  }

  /** beast-wars megatron from the figure sheet: gunmetal helmet with a green gem, magenta chest with silver lines,
   * scaled shoulder fins, a big T-rex head right hand, and the curved tail carried like a blade in the left */
  private buildMegatron(m: HeroMats) {
    const helmet = this.paint(0x3f4648);
    const helmetLite = this.paint(0x5a6264);
    const face = this.paint(0xa9b0b6);
    const silver = this.paint(0xd8d8e4);
    const cream = this.paint(m.accentColor);
    const pink = this.paint(0xc8506a);
    const wrist = this.paint(0xd8323a);
    const red = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    const gem = new THREE.MeshBasicMaterial({ color: 0x4dff6a });
    // dino legs: magenta thighs, bulky purple knees and shins, raptor feet with cream claws
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.22, 0.6, 0.04);
      leg.add(rbox(0.2, 0.26, 0.24, 0.06, m.trim, 0, -0.08, 0));
      leg.add(rbox(0.26, 0.18, 0.26, 0.08, m.body, 0, -0.26, -0.03));
      leg.add(rbox(0.28, 0.24, 0.3, 0.09, m.body, 0, -0.42, 0));
      leg.add(rbox(0.3, 0.1, 0.36, 0.04, m.body, 0, -0.55, -0.06));
      for (const x of [-0.09, 0, 0.09]) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 8), cream);
        c.rotation.x = -Math.PI / 2;
        c.position.set(x, -0.57, -0.28);
        leg.add(c);
      }
      const spur = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 6), cream);
      spur.rotation.x = Math.PI / 2;
      spur.position.set(0, -0.57, 0.16);
      leg.add(spur);
      this.root.add(leg);
      this.legs.push(leg);
    }
    this.root.add(rbox(0.36, 0.12, 0.26, 0.04, m.trim, 0, 0.62, 0));
    this.turret.position.y = 0.7;
    this.root.add(this.turret);
    // torso: navy belt, dark abdomen, purple frame, magenta chest plate traced with silver lines
    this.turret.add(rbox(0.42, 0.08, 0.3, 0.03, m.joint, 0, 0.04, 0));
    this.turret.add(rbox(0.24, 0.12, 0.2, 0.03, helmet, 0, 0.12, 0));
    this.turret.add(rbox(0.56, 0.32, 0.4, 0.1, m.body, 0, 0.32, 0));
    this.turret.add(rbox(0.42, 0.22, 0.06, 0.03, m.trim, 0, 0.34, -0.2));
    for (const side of [-1, 1])
      for (let k = 0; k < 3; k++) {
        const line = rbox(0.14, 0.014, 0.02, 0.004, silver, side * 0.1, 0.29 + k * 0.045, -0.235);
        line.rotation.z = side * -0.35;
        this.turret.add(line);
      }
    this.turret.add(rbox(0.016, 0.18, 0.02, 0.004, silver, 0, 0.34, -0.236));
    this.markBelly(this.turret, 0, 0.16, -0.26);
    // scaled purple fins rising behind both shoulders
    for (const side of [-1, 1]) {
      const fin = rbox(0.12, 0.46, 0.28, 0.05, m.body, side * 0.3, 0.62, 0.08);
      fin.rotation.set(0.15, 0, side * -0.3);
      this.turret.add(fin);
      for (const y of [0.52, 0.64, 0.76]) {
        const sc = rbox(0.13, 0.03, 0.2, 0.012, m.body, side * (0.3 + (y - 0.62) * 0.3), y, 0.06);
        sc.rotation.set(0.15, 0, side * -0.3);
        this.turret.add(sc);
      }
      this.turret.add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), m.body).translateX(side * 0.36).translateY(0.42));
      this.turret.add(rbox(0.12, 0.2, 0.12, 0.04, m.trim, side * 0.4, 0.26, 0));
    }
    // left arm: a clawed fist with the navy ring, carrying the great curved tail like a blade
    this.turret.add(rbox(0.16, 0.2, 0.18, 0.05, m.body, -0.42, 0.06, -0.04));
    this.turret.add(rbox(0.13, 0.1, 0.13, 0.03, m.joint, -0.42, -0.06, -0.06));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 8, 16), m.joint);
    ring.position.set(-0.42, -0.08, -0.16);
    this.turret.add(ring);
    const tailPts = curvePts(10, [-0.5, 0.74, 0.02], [-0.66, 0.38, -0.08], [-0.68, -0.02, -0.06], [-0.56, -0.48, 0.0]);
    this.turret.add(taper(tailPts, 0.16, 0.015, m.body));
    // right arm: the T-rex head; its jaw snaps open on every shot
    this.turret.add(rbox(0.14, 0.1, 0.14, 0.03, wrist, 0.44, 0.12, -0.08));
    this.barrel.position.set(0.5, 0.08, -0.3);
    this.barrelZ = -0.3;
    // bigger than his own head, like the reference
    this.barrel.scale.setScalar(1.5);
    const skull = rbox(0.34, 0.3, 0.42, 0.12, m.body, 0, 0.05, -0.06);
    const snout = rbox(0.3, 0.17, 0.3, 0.08, m.body, 0, 0.0, -0.32);
    this.barrel.add(skull, snout);
    this.barrel.add(rbox(0.22, 0.04, 0.3, 0.015, pink, 0, -0.07, -0.3));
    for (const side of [-1, 1]) {
      const brow = rbox(0.1, 0.05, 0.18, 0.02, m.body, side * 0.12, 0.2, -0.14);
      brow.rotation.z = side * 0.3;
      this.barrel.add(brow);
      this.barrel.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), red).translateX(side * 0.17).translateY(0.1).translateZ(-0.14));
      for (const [y, z] of [
        [0.14, 0.06],
        [0.0, 0.08],
        [-0.04, -0.3],
      ]) {
        const sc = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), m.body);
        sc.scale.set(0.4, 0.8, 1);
        sc.position.set(side * (z < -0.2 ? 0.15 : 0.17), y, z);
        this.barrel.add(sc);
      }
      for (let k = 0; k < 6; k++) {
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 6), cream);
        t.rotation.x = Math.PI;
        t.position.set(side * (0.12 - (k === 0 ? 0.04 : 0)), -0.09, -0.46 + k * 0.06);
        this.barrel.add(t);
      }
    }
    const jaw = new THREE.Group();
    jaw.position.set(0, -0.08, -0.08);
    jaw.add(rbox(0.26, 0.08, 0.38, 0.03, m.body, 0, -0.03, -0.21));
    jaw.add(rbox(0.18, 0.02, 0.3, 0.008, pink, 0, 0.012, -0.22));
    for (const side of [-1, 1])
      for (let k = 0; k < 5; k++) {
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.019, 0.06, 6), cream);
        t.position.set(side * 0.1, 0.03, -0.36 + k * 0.065);
        jaw.add(t);
      }
    this.barrel.add(jaw);
    this.jaw = jaw;
    this.turret.add(this.barrel);
    // head, like the figure: a tall domed gunmetal helmet that flares out at the bottom, a centre crest,
    // a long green gem on the forehead, a heavy V brow over red eyes, a recessed silver face and frowning mouth
    this.turret.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.1, 10), helmet).translateY(0.56));
    const head = new THREE.Group();
    head.position.set(0, 0.8, -0.02);
    head.scale.setScalar(1.1);
    head.add(rbox(0.3, 0.4, 0.34, 0.13, helmet, 0, 0.06, 0.01));
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), helmet);
    crown.scale.set(1, 0.6, 1.12);
    crown.position.set(0, 0.2, 0.01);
    head.add(crown);
    const crest = rbox(0.06, 0.07, 0.36, 0.025, helmetLite, 0, 0.27, 0.02);
    head.add(crest);
    head.add(rbox(0.06, 0.12, 0.05, 0.02, helmetLite, 0, 0.2, -0.16));
    for (const side of [-1, 1]) {
      // side guards flare out toward the jaw
      const guard = rbox(0.07, 0.3, 0.32, 0.03, helmet, side * 0.135, -0.06, 0.02);
      guard.rotation.z = side * -0.08;
      head.add(guard);
      head.add(rbox(0.045, 0.22, 0.06, 0.015, helmet, side * 0.105, -0.06, -0.175));
      const brow = rbox(0.1, 0.04, 0.06, 0.012, helmet, side * 0.05, 0.035, -0.19);
      brow.rotation.z = side * 0.35;
      head.add(brow);
      const eye = rbox(0.06, 0.026, 0.02, 0.006, m.eyeMat, side * 0.05, 0.005, -0.198);
      eye.rotation.z = side * 0.35;
      head.add(eye);
    }
    head.add(rbox(0.18, 0.2, 0.05, 0.02, face, 0, -0.05, -0.17));
    head.add(rbox(0.09, 0.012, 0.02, 0.004, helmet, 0, -0.1, -0.198));
    for (const side of [-1, 1]) {
      const frown = rbox(0.03, 0.012, 0.02, 0.004, helmet, side * 0.055, -0.108, -0.198);
      frown.rotation.z = side * 0.5;
      head.add(frown);
    }
    head.add(rbox(0.14, 0.05, 0.06, 0.02, face, 0, -0.16, -0.16));
    const gemG = new THREE.Group();
    gemG.position.set(0, 0.11, -0.19);
    gemG.scale.set(1, 2.1, 1);
    const g = rbox(0.045, 0.045, 0.03, 0.008, gem);
    g.rotation.z = Math.PI / 4;
    gemG.add(g);
    head.add(gemG);
    this.turret.add(head);
    this.trigger = new THREE.Object3D();
    this.turret.add(this.trigger);
  }

  /** a beast's upper teeth along the snout */
  private lionTeeth(head: THREE.Object3D, white: THREE.Material) {
    for (const side of [-1, 1])
      for (let k = 0; k < 5; k++) {
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 6), white);
        t.rotation.x = Math.PI;
        t.position.set(side * (0.125 - k * 0.008), -0.08, -0.42 + k * 0.055);
        head.add(t);
      }
  }

  /** the mouth "barrel" for hero beasts: a dark cavity, a lower jaw with a pink tongue that snaps on recoil */
  private mouthOn(parent: THREE.Object3D, m: HeroMats, z: number, y: number, w: number, white: THREE.Material) {
    this.barrel.position.set(0, y, z);
    this.barrelZ = z;
    const cavity = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.08, 0.1), new THREE.MeshBasicMaterial({ color: 0x120a10 }));
    cavity.position.set(0, -0.02, -0.02);
    this.barrel.add(cavity);
    parent.add(this.barrel);
    const jaw = new THREE.Group();
    jaw.position.set(0, y - 0.06, z + 0.32);
    jaw.add(rbox(w, 0.1, 0.38, 0.03, m.body, 0, -0.04, -0.2));
    jaw.add(rbox(w * 0.7, 0.02, 0.3, 0.008, this.paint(0xc8506a), 0, 0.012, -0.2));
    for (const side of [-1, 1])
      for (let k = 0; k < 5; k++) {
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 6), white);
        t.position.set(side * w * 0.38, 0.03, -0.36 + k * 0.06);
        jaw.add(t);
      }
    parent.add(jaw);
    this.jaw = jaw;
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
    // B-Daman style: the marble leaves from the front of the belly
    if (this.bellyMark) return this.bellyMark.getWorldPosition(out);
    return this.barrel.localToWorld(out.set(0, 0, -0.25));
  }

  /** where fired marbles appear: an empty marker on the front of the belly */
  bellyMark: THREE.Object3D | null = null;
  private markBelly(parent: THREE.Object3D, x: number, y: number, z: number) {
    const mark = new THREE.Object3D();
    mark.position.set(x, y, z);
    parent.add(mark);
    this.bellyMark = mark;
  }

  private glowCol = new THREE.Color();

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
    this.turret.rotation.y = this.rest.turretY + (s.team === 0 ? -s.aim : s.aim);
    this.barrel.position.z = this.barrelZ + s.recoil * (this.jaw ? 0.04 : 0.12);
    this.trigger.position.z = this.triggerZ - s.recoil * 0.1;
    // beasts: the jaw snaps open as the marble leaves the mouth
    if (this.jaw) this.jaw.rotation.x = this.rest.jaw + s.recoil * 0.55;
    if (this.flame) {
      const f = 0.85 + Math.random() * 0.35;
      const fs = this.rest.flame;
      this.flame.scale.set(fs.x * f, fs.y * (0.8 + Math.random() * 0.5), fs.z * f);
    }

    // walk cycle while sliding along the rail
    const moving = Math.min(1, Math.abs(s.vx) / 3);
    this.stride += dt * 14 * moving;
    // alternate legs (diagonal pairs on four-legged beasts)
    this.legs.forEach((l, i) => (l.rotation.x = (this.rest.legs[i] ?? 0) + Math.sin(this.stride + (i % 2) * Math.PI) * 0.5 * moving));
    this.turret.rotation.z = this.rest.turretZ + (s.team === 0 ? -1 : 1) * Math.sign(s.vx) * moving * 0.06;
    const bob = Math.abs(Math.sin(this.stride)) * 0.05 * moving;

    // wings breathe at idle, flare open while firing
    const flare = s.firing ? 0.18 : 0;
    const beat = Math.sin(time * 2.4) * 0.05;
    const lift = 0.2;
    this.wingR.rotation.set(0, -0.35 - flare, lift + beat + flare * 0.5);
    this.wingL.rotation.set(0, 0.35 + flare, -(lift + beat + flare * 0.5));


    // firing: a regular shot is a quick punch (rock back, squash); a special move
    // throws the robot back, squashes and springs, and makes it glow in its ball colour
    const kickT = s.kickT ?? 9;
    const heavyT = s.heavyT ?? 9;
    const punch = Math.max(0, 1 - kickT / 0.16) ** 2;
    const heavy = heavyT < 0.9 ? Math.exp(-heavyT * 4.5) : 0;
    const spring = heavy * Math.cos(heavyT * 17);
    const lean = punch * 0.09 + heavy * 0.3;
    const slide = punch * 0.05 + heavy * 0.2;
    const squash = punch * 0.06 + spring * 0.16;

    // hit flash (the player's own robot flashes softer so it never washes out), plus the special-move glow
    const f = s.flash > 0 ? (s.team === 0 ? 0.45 : 0.9) : 0;
    const glow = heavy * 0.6;
    this.glowCol.setHex(this.ball);
    for (const m of this.mats) m.emissive.setRGB(Math.min(1, f + this.glowCol.r * glow), Math.min(1, f + this.glowCol.g * glow), Math.min(1, f + this.glowCol.b * glow));
    const hurt = s.health < 25 ? Math.abs(Math.sin(time * 9)) * 0.04 : 0;
    this.root.position.y = bob + hurt;

    // shudder while flashing from a hit; a super hit also rocks it backwards
    const jolt = s.flash > 0 ? (s.stagger > 0 ? 0.16 : 0.07) : 0;
    if (jolt) {
      this.root.position.x += (Math.random() * 2 - 1) * jolt;
      this.root.position.z += (Math.random() * 2 - 1) * jolt;
    }
    const back = (s.stagger > 0 ? Math.sin((s.stagger / 0.45) * Math.PI) * 0.35 : 0) + lean;
    // tip away from the attacker / the shot (player leans toward +z, opponent toward -z)
    this.root.rotation.x = s.team === 0 ? back : -back;
    this.root.position.z += s.team === 0 ? slide : -slide;
    this.root.scale.set((1 + squash * 0.6) * this.size, (1 - squash) * this.size, (1 + squash * 0.6) * this.size);
    this.root.rotation.y = (s.team === 0 ? 0 : Math.PI) + (jolt ? (Math.random() * 2 - 1) * jolt : 0);
  }
}

const SHAPE_OF: Record<string, Block['shape']> = {
  BoxGeometry: 'box',
  RoundedBoxGeometry: 'rbox',
  CapsuleGeometry: 'capsule',
  SphereGeometry: 'sphere',
  CylinderGeometry: 'cylinder',
  ConeGeometry: 'cone',
  TorusGeometry: 'torus',
};

/** default size for a freshly added block of each shape */
export const DEFAULT_SIZE: Record<Exclude<Block['shape'], 'group'>, Record<string, number>> = {
  box: { width: 0.3, height: 0.3, depth: 0.3 },
  rbox: { width: 0.3, height: 0.3, depth: 0.3, segments: 3, radius: 0.06 },
  capsule: { radius: 0.12, height: 0.3, capSegments: 4, radialSegments: 12 },
  sphere: { radius: 0.18, widthSegments: 14, heightSegments: 10 },
  cylinder: { radiusTop: 0.12, radiusBottom: 0.12, height: 0.3, radialSegments: 12 },
  cone: { radius: 0.1, height: 0.3, radialSegments: 6 },
  torus: { radius: 0.18, tube: 0.05, radialSegments: 6, tubularSegments: 14 },
  mesh: { bevel: 0, smooth: 0 },
};

/** a tube with its top and bottom rims rounded off by `bevel` */
function bevelledTube(rt: number, rb: number, h: number, sides: number, bevel: number, segs: number) {
  const bv = Math.max(0.001, Math.min(bevel, rt - 0.001, rb - 0.001, h / 2 - 0.001));
  const n = Math.max(1, Math.round(segs));
  const pts = [new THREE.Vector2(0, -h / 2)];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (Math.PI / 2) * (i / n);
    pts.push(new THREE.Vector2(rb - bv + bv * Math.cos(a), -h / 2 + bv + bv * Math.sin(a)));
  }
  for (let i = 0; i <= n; i++) {
    const a = (Math.PI / 2) * (i / n);
    pts.push(new THREE.Vector2(rt - bv + bv * Math.cos(a), h / 2 - bv + bv * Math.sin(a)));
  }
  pts.push(new THREE.Vector2(0, h / 2));
  return new THREE.LatheGeometry(pts, Math.max(3, Math.round(sides)));
}

export function blockGeometry(b: Block): THREE.BufferGeometry {
  const g = { ...(b.shape === 'group' ? {} : DEFAULT_SIZE[b.shape]), ...(b.size ?? {}) } as Record<string, number>;
  switch (b.shape) {
    case 'rbox':
      return new RoundedBoxGeometry(g.width, g.height, g.depth, g.segments ?? 3, Math.min(g.radius ?? 0.06, Math.min(g.width, g.height, g.depth) / 2 - 0.001));
    case 'capsule':
      return new THREE.CapsuleGeometry(g.radius, g.height, g.capSegments ?? 4, g.radialSegments ?? 12);
    case 'sphere':
      return new THREE.SphereGeometry(g.radius, g.widthSegments ?? 14, g.heightSegments ?? 10, g.phiStart ?? 0, g.phiLength ?? Math.PI * 2, g.thetaStart ?? 0, g.thetaLength ?? Math.PI);
    case 'cylinder':
      if ((g.bevel ?? 0) > 0) return bevelledTube(g.radiusTop, g.radiusBottom, g.height, g.radialSegments ?? 12, g.bevel, g.bevelSegments ?? 2);
      return new THREE.CylinderGeometry(g.radiusTop, g.radiusBottom, g.height, g.radialSegments ?? 12, g.heightSegments ?? 1, !!g.openEnded, g.thetaStart ?? 0, g.thetaLength ?? Math.PI * 2);
    case 'mesh':
      return meshGeometry(b.mesh, g.bevel ?? 0, !!g.smooth);
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

/** materials a hero build is painted with (palette slots plus the raw colours some parts need) */
interface HeroMats {
  body: THREE.Material;
  trim: THREE.Material;
  accent: THREE.Material;
  joint: THREE.Material;
  eyeMat: THREE.Material;
  ballMat: THREE.Material;
  eyeColor: number;
  accentColor: number;
}

/** a rounded (bevelled) box: armour that catches the light on its edges */
/** an armour block; `r` was its corner rounding, now kept sharp (no bevel) across the roster */
function rbox(w: number, h: number, d: number, r: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  void r;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

/** points along a smooth curve through the given control points */
function curvePts(n: number, ...pts: [number, number, number][]) {
  return new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))).getPoints(n);
}

/** a curved, tapering limb (horn, tail) as cylinder segments along points, with round joints */
function taper(pts: THREE.Vector3[], r0: number, r1: number, mat: THREE.Material, sides = 10) {
  const g = new THREE.Group();
  const up = new THREE.Vector3(0, 1, 0);
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const ra = r0 + ((r1 - r0) * i) / n;
    const rb = r0 + ((r1 - r0) * (i + 1)) / n;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rb, ra, a.distanceTo(b), sides), mat);
    seg.position.copy(a).add(b).multiplyScalar(0.5);
    seg.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
    g.add(seg);
    if (i > 0) {
      const joint = new THREE.Mesh(new THREE.SphereGeometry(ra, sides, 6), mat);
      joint.position.copy(a);
      g.add(joint);
    }
  }
  return g;
}
