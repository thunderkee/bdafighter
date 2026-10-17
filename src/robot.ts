import * as THREE from 'three';
import { meshGeometry } from './meshkit';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Shooter } from './game';
import { loadRoster, type Block, type ColorRef, type Role, type RosterData, type Traits, type UnitEntry, type V3 } from './roster';
import shippedRoster from './roster-shipped.json';
import { cachedPublished } from './published';
import { PROFILES } from './profiles';
import { TWIN_X, type Special } from './config';
import { extrudeData, facetMesh, mirrorX, prismData, sideData, type Cuts } from './facets';
import { armourTexture, type ArmourTex, type BallTex } from './patterns';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

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
  crest: 'vfin' | 'vfin-short' | 'horns' | 'twinHorns' | 'unihorn' | 'fin' | 'eva' | 'beetle' | 'tyrant';
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
  /** 2.0 body: hero proportions (V chest, narrow waist, angled armour, V brow) */
  v2?: boolean;
  /** 2.0 humanoids: built on the shared 2.0 chassis, dressed in this character kit */
  kit?: 'mech' | 'eva' | 'beetle' | 'megatron' | 'lizard';
  /** 2.1 units: the faceted chassis, frame, head, gun and signature parts */
  look21?: Look21;
  /** 2.1 beasts: signature parts added on top of their Unit Lab design */
  addons?: ('fangs' | 'backCannon' | 'noBall' | 'legStripes' | 'armyWhites')[];
  /** a 2.1 unit */
  v21?: boolean;
  /** twin barrels: every shot is a pair of marbles side by side */
  twin?: boolean;
  /** a signature trick (wind-up punch, hand swap, alternate hands, spray, anti-air) */
  special?: Special;
  /** matte (doff) plastic instead of the glossy finish */
  matte?: boolean;
  /** 2.1: the pattern on this unit's marbles */
  ballTex?: BallTex;
  /** 2.1: the texture on this unit's armour */
  armourTex?: ArmourTex;
  /** 2.0 humanoids: 'punch' throws the right arm straight out at the target, body leaning in */
  pose?: 'punch';
  /** 2.0 humanoids: a chest emblem in place of the core marble */
  emblem?: 'skull';
  /** 2.0 units: the original they're made from (its shipped design carries over) */
  from?: string;
  /** 2.0 units: body scale (x wide, y tall, z deep) so the whole roster shares one proportion */
  fit?: [number, number, number];
  /** 2.0 units: resize parts of the design (by block path), e.g. a head to the shared chibi size */
  grow?: { path: string; scale?: number; s?: [number, number, number]; lift?: number }[];
}

/** the units as shipped; the roster layers edits and custom units on top */
const ORIGINALS: CharacterDef[] = [
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
 * 2.0 versions of every unit, to try side by side with the originals: the stock mechs get the
 * hero-proportion body, and every 2.0 shares one body size (about as wide and tall as those
 * mechs), so thin or small units fill out to match. Beasts on four legs scale evenly.
 */
type V2Look = {
  kit?: CharacterDef['kit'];
  pose?: CharacterDef['pose'];
  emblem?: CharacterDef['emblem'];
  fit?: [number, number, number];
  grow?: CharacterDef['grow'];
  /** the 2.0's own colour scheme (its "2P" colours) */
  ball: number;
  palette: Partial<Palette>;
};
const V2: Record<string, V2Look> = {
  dragon: { kit: 'mech', ball: 0x5aff9a, palette: { body: 0x1f8a5a, trim: 0x2a3a34, accent: 0xffc23d, joint: 0x16201c, eye: 0xffe14d } },
  pioneer: { kit: 'mech', ball: 0xffc27a, palette: { body: 0xd8c49a, trim: 0x5a6a3a, accent: 0xe8762a, joint: 0x4a4438, eye: 0x7ff0ff } },
  monoceros: { kit: 'mech', ball: 0xffb02e, palette: { body: 0x23242c, trim: 0x3a3c46, accent: 0xffc23d, joint: 0x121218, eye: 0xff3a3a } },
  baron: { kit: 'mech', pose: 'punch', ball: 0x6fb4ff, palette: { body: 0x2a4fb8, trim: 0x1a2f78, accent: 0xffc23d, joint: 0x1c2030, eye: 0xffe14d } },
  // the Punisher: black armour, white skull, red accents
  bastion: { kit: 'mech', emblem: 'skull', ball: 0xff3a3a, palette: { body: 0x1c1c20, trim: 0xeeeeea, accent: 0xd8262b, joint: 0x2c2c32, eye: 0xff2a2a } },
  nightshade: { kit: 'mech', ball: 0xff7ae0, palette: { body: 0xe6e2f0, trim: 0x7a5ad8, accent: 0xff3acd, joint: 0x3a3448, eye: 0xff3acd } },
  angel: { kit: 'mech', ball: 0xff5a6a, palette: { body: 0x2e313d, trim: 0xd8263a, accent: 0xffc23d, joint: 0x16171e, eye: 0xff4a4a } },
  liberty: { kit: 'mech', ball: 0xfff07a, palette: { body: 0x1f2028, trim: 0xd9a92a, accent: 0xffe08a, joint: 0x3a3a44, eye: 0x6dff9a } },
  violet: { kit: 'eva', pose: 'punch', ball: 0xff8a3a, palette: { body: 0xd8262b, trim: 0x2a1a1c, accent: 0xffa21a, joint: 0x1e1416, eye: 0x7ff0ff } },
  kabuto: {
    kit: 'beetle',
    pose: 'punch',
    ball: 0x7ff0ff,
    palette: { body: 0xeef2f6, trim: 0x2a3a5a, accent: 0x2ad0c8, joint: 0x2c3440, eye: 0xffb02e },
  },
  ember: {
    kit: 'lizard',
    ball: 0x6ad0ff,
    palette: { body: 0x30323c, trim: 0xd84a3a, accent: 0x6ad0ff, joint: 0x1a1a20, eye: 0xff4a3a },
  },
  tyrant: { kit: 'megatron', ball: 0xff5a3a, palette: { body: 0x9a1a24, trim: 0x2a2a30, accent: 0xffc23d, joint: 0x3a2a2a, eye: 0x7cff3a } },
  liger: { fit: [1.15, 1.15, 1.15], ball: 0xffd04a, palette: { body: 0xf0f2f6, trim: 0x3a4a6a, accent: 0xffc23d, joint: 0x2a2f3c, eye: 0x4ad8ff } },
  rex: { fit: [1.12, 1.12, 1.12], ball: 0xb8ff4a, palette: { body: 0x4a6a2a, trim: 0xc8b88a, accent: 0xff6a1a, joint: 0x2a3220, eye: 0xffe14d } },
};
/** a 2.1 body plan: how long the legs are, how wide the chest, how the arms and head sit */
type Frame21 = { legS: number; legW: number; legGap: number; foot: number; chestW: number; chestB: number; chestD: number; waistW: number; armS: number; armW: number; shOut: number; headS: number; headY?: number; lean: number };
const FRAMES21: Record<string, Frame21> = {
  /** the standard hero: V chest, even limbs */
  hero: { legS: 1, legW: 1, legGap: 0.25, foot: 1, chestW: 0.94, chestB: 0.62, chestD: 0.6, waistW: 0.42, armS: 1, armW: 1, shOut: 0.64, headS: 1.04, lean: 0 },
  /** heavy armour: broad chest, thick limbs, big boots */
  heavy: { legS: 1, legW: 1.16, legGap: 0.29, foot: 1.1, chestW: 1.06, chestB: 0.72, chestD: 0.66, waistW: 0.5, armS: 1, armW: 1.16, shOut: 0.72, headS: 0.98, lean: 0 },
  /** slim and quick: narrow chest, long thin limbs */
  slim: { legS: 1.1, legW: 0.84, legGap: 0.23, foot: 0.94, chestW: 0.82, chestB: 0.5, chestD: 0.54, waistW: 0.34, armS: 1.06, armW: 0.84, shOut: 0.58, headS: 1.02, lean: -0.04 },
  /** EVA: very long legs, a narrow waist, hunched forward */
  lanky: { legS: 1.34, legW: 0.82, legGap: 0.22, foot: 0.94, chestW: 0.8, chestB: 0.46, chestD: 0.52, waistW: 0.3, armS: 1.22, armW: 0.84, shOut: 0.56, headS: 0.96, lean: -0.14 },
  /** Metabee: slim limbs under a huge dome head */
  beetle: { legS: 0.96, legW: 0.84, legGap: 0.24, foot: 0.92, chestW: 0.8, chestB: 0.56, chestD: 0.54, waistW: 0.4, armS: 0.96, armW: 0.82, shOut: 0.56, headS: 1.24, headY: 0.04, lean: 0 },
  lizard: { legS: 1, legW: 1, legGap: 0.24, foot: 1, chestW: 0.6, chestB: 0.6, chestD: 0.5, waistW: 0.4, armS: 1, armW: 1, shOut: 0.3, headS: 1, lean: 0 },
};
type Look21 = {
  frame: keyof typeof FRAMES21;
  head: 'gundam' | 'visor' | 'zaku' | 'hood' | 'eva' | 'beetle' | 'bucket' | 'lizard' | 'tallgeese' | 'megazord';
  shoulder: 'wedge' | 'stepped' | 'heavy' | 'spike' | 'shield';
  shoulderL?: Look21['shoulder'];
  gun: 'chest' | 'beamRifle' | 'sniper' | 'magnum' | 'drumMG' | 'pallet' | 'gatling' | 'fistCannon' | 'rexFist' | 'dragonMaw' | 'mouth' | 'hmg' | 'dober' | 'bazooka' | 'shellCannon' | 'staffGun' | 'palm' | 'chestMaw' | 'slashSword';
  left?: 'shield' | 'tower' | 'scythe' | 'claw' | 'tailBlade' | 'knife' | 'katana' | 'powerSword' | 'ammoDrum';
  back?: ('pods' | 'sabers' | 'wings' | 'cape' | 'radio' | 'drum' | 'pylons' | 'fins' | 'launchers' | 'ammoPack' | 'boosters' | 'shell' | 'rexTail' | 'tuskShield')[];
  /** a dino combiner: each limb in its own zord's colour (black arms, a blue right leg, a yellow left) and a pink breastplate */
  megazord?: boolean;
  /** a menacing stance: legs wide and splayed, the head thrust low and forward */
  menace?: boolean;
  /** a gunmetal crest instead of the gold V-fin */
  darkCrest?: boolean;
  /** bone-coloured skull (instead of white) for a darker emblem */
  boneSkull?: boolean;
  /** aim: the right arm straight out; twoHand: both arms forward, the gun held at the centre */
  /** centerAim: the right arm straight forward, turned in so the hand is at the middle */
  pose?: 'stand' | 'aim' | 'twoHand' | 'bazooka' | 'centerAim' | 'dualAim';
  /** a gorilla's hunch: long arms swung forward, knuckles low */
  gorilla?: boolean;
  /** tank treads in place of legs */
  treads?: boolean;
  /** long skirt armour down to the shins */
  longSkirt?: boolean;
  /** no legs: the unit floats on a hover thruster under its skirt */
  hover?: boolean;
  /** a sleeker main-character Gundam head, the crown and ears in the accent colour */
  heroHead?: boolean;
  /** an attacking stance: a lunge (left leg forward, right back), a forward lean, the off hand raised on guard */
  dynamic?: boolean;
  lean?: number;
  pods?: boolean;
  antenna?: boolean;
  xLegs?: boolean;
  shellSkirt?: boolean;
  ribcage?: boolean;
};
/**
 * 2.1: every unit redesigned on the faceted chassis with its own frame and signature part,
 * in a palette that reads at a glance. Rex and Liger keep their Unit Lab designs and gain
 * a back cannon and big fangs.
 */
/** each 2.1 unit's own marble and armour pattern */
const PATTERNS21: Record<string, [BallTex, ArmourTex]> = {
  angel: ['ring', 'panel'],
  dragon: ['flame', 'panel'],
  pioneer: ['camo', 'camo'],
  liberty: ['checker', 'mud'],
  monoceros: ['galaxy', 'circuit'],
  baron: ['eye', 'digital'],
  bastion: ['crackle', 'carbon'],
  nightshade: ['nebula', 'weave'],
  violet: ['candy', 'stripe'],
  kabuto: ['dots', 'none'],
  tyrant: ['lava', 'hammered'],
  ember: ['sparks', 'spots'],
  rex: ['scale', 'crackle'],
};
const V21: Record<string, { look?: Look21; addons?: CharacterDef['addons']; twin?: boolean; special?: Special; ball: number; palette: Partial<Palette>; glow?: number; crest?: CharacterDef['crest']; emblem?: CharacterDef['emblem']; matte?: boolean }> = {
  // Astray Red Frame: white armour over a red frame, black trim
  // a swordsman: the katana raised in the right hand, every shot a slash whose arc throws the marble
  angel: { look: { frame: 'hero', head: 'gundam', shoulder: 'spike', gun: 'slashSword', pose: 'aim', back: ['sabers'], dynamic: true, menace: true, lean: -0.16, heroHead: true }, ball: 0xff4a4a, palette: { body: 0xf2f2f2, trim: 0x1e1e24, accent: 0xd8262b, joint: 0xc8202a, eye: 0x5aff7a } },
  // a dino combiner (after the Mighty Morphin Megazord): red core, silver crested helmet, pink
  // breastplate, black arms with a tusked shield on the back, blue and yellow legs, a T-rex tail;
  // the old Wyvern head with twin gold horns; it fires from a toothed maw in its chest, and holds
  // a power sword ready in its left hand
  dragon: { look: { frame: 'heavy', head: 'gundam', shoulder: 'heavy', gun: 'chestMaw', left: 'powerSword', back: ['tuskShield', 'rexTail'], dynamic: true, menace: true, megazord: true, lean: -0.12 }, special: { windup: 0.16 }, crest: 'twinHorns', ball: 0xff4a3a, palette: { body: 0xc8202a, trim: 0x1e1e24, accent: 0xf2b632, joint: 0x3a3c44, eye: 0xffe14d } },
  // swaps the heavy MG from hand to hand every few seconds; the shot leaves from that side
  pioneer: { special: { swap: 3, hand: 0.42 }, look: { frame: 'slim', head: 'visor', shoulder: 'stepped', gun: 'hmg', back: ['ammoPack'], pose: 'aim', antenna: true, dynamic: true, lean: -0.16 }, ball: 0x7fb8ff, palette: { body: 0x3f6fc4, trim: 0xd8dde4, accent: 0xff8a1a, joint: 0x2a3040, eye: 0x7ff0ff } },
  // Tallgeese-inspired, in mud-caked brown: plume helmet, Dober gun on the shoulder, huge back boosters
  liberty: { look: { frame: 'heavy', head: 'tallgeese', shoulder: 'heavy', gun: 'dober', left: 'shield', back: ['boosters'], treads: true }, ball: 0xd8a868, palette: { body: 0x6e5434, trim: 0xa08a64, accent: 0xc8782a, joint: 0x2e261e, eye: 0xffc04a } },
  // Blastoise-style: a shell on its back with a twin cannon (two marbles a shot), hunched like a gorilla
  monoceros: { look: { frame: 'heavy', head: 'gundam', shoulder: 'heavy', gun: 'shellCannon', back: ['shell'], gorilla: true, menace: true, lean: -0.32 }, twin: true, ball: 0xff6a8a, glow: 0xff2d55, palette: { body: 0xf4f4f6, trim: 0xdfe0e6, accent: 0xff2d55, joint: 0x5a5e6c, eye: 0xffe14d } },
  // teal and deep blue-green with gold, a pink mono-eye
  // a huge drum magazine in the left hand, its belt feeding the machine gun in the right
  baron: { look: { frame: 'heavy', head: 'zaku', shoulder: 'shield', shoulderL: 'spike', gun: 'drumMG', left: 'ammoDrum', back: ['pods'], pose: 'aim', dynamic: true, lean: -0.18 }, ball: 0x6af0e0, palette: { body: 0x1f8a8a, trim: 0x173a44, accent: 0xffc23d, joint: 0x14202a, eye: 0xff5fd0 } },
  // mysterious and dangerous: matte charcoal and dark olive, a bone skull, a red slit visor, a tattered cape
  bastion: { look: { frame: 'heavy', head: 'visor', shoulder: 'spike', gun: 'gatling', back: ['drum', 'cape'], pods: true, boneSkull: true, menace: true, darkCrest: true, pose: 'aim', dynamic: true, lean: -0.18 }, matte: true, emblem: 'skull', ball: 0xc8282e, palette: { body: 0x2a2c2e, trim: 0x474c42, accent: 0xb82020, joint: 0x17181a, eye: 0xff2a2a } },
  nightshade: { look: { frame: 'slim', head: 'hood', shoulder: 'wedge', gun: 'staffGun', back: ['cape'], pose: 'aim', dynamic: true, lean: -0.2, longSkirt: true, hover: true }, ball: 0xd08aff, glow: 0xc86aff, palette: { body: 0x3a2a5c, trim: 0x241c36, accent: 0xc86aff, joint: 0x15111f, eye: 0xd08aff } },
  // Unit-08 pink and mint, hunched, an open palm thrust out
  violet: { look: { frame: 'lanky', head: 'eva', shoulder: 'heavy', gun: 'palm', left: 'knife', back: ['pylons'], pose: 'aim', menace: true, lean: -0.3 }, ball: 0xff8ac0, glow: 0x4ae0a0, palette: { body: 0xf06aa0, trim: 0x2a2a34, accent: 0x4ae0a0, joint: 0x1e1c26, eye: 0xffe14d } },
  // army green
  // a fist cannon on each arm, firing left and right in turn
  kabuto: { special: { alternate: true, hand: 0.45 }, look: { frame: 'beetle', head: 'beetle', shoulder: 'stepped', gun: 'fistCannon', pose: 'dualAim', xLegs: true, shellSkirt: true, dynamic: true, lean: -0.14 }, ball: 0xc8e07a, palette: { body: 0x5c6b3a, trim: 0x2a2c24, accent: 0xffb02e, joint: 0x23261e, eye: 0xffd23e } },
  tyrant: { look: { frame: 'heavy', head: 'bucket', shoulder: 'spike', gun: 'rexFist', left: 'tailBlade', back: ['fins'], ribcage: true, pose: 'centerAim', dynamic: true, lean: -0.18 }, ball: 0xb06aff, palette: { body: 0x5a606a, trim: 0x8a4aff, accent: 0xd8262b, joint: 0x2a2c34, eye: 0xff2a2a } },
  // the head always cocked to one side: rapid fire sprays
  ember: { special: { wobble: 0.2 }, look: { frame: 'lizard', head: 'lizard', shoulder: 'wedge', gun: 'mouth' }, ball: 0xff7a3a, palette: { body: 0xf2662a, trim: 0xffe0b0, accent: 0xffd23e, joint: 0x8a2a14, eye: 0x141018 } },
  // desert: sand armour, dark brown, red accents, cyan eyes
  // rex and liger shoot an enemy air drop out of the sky when it falls straight ahead
  rex: { special: { antiAir: true }, addons: ['backCannon', 'noBall'], ball: 0xffb04a, palette: { body: 0xc8b48a, trim: 0x5a4a3a, accent: 0xd8402a, joint: 0x2a2420, eye: 0x5af0ff } },
  // Char's red Zaku: salmon red armour, deep maroon plates, dark grey frame, a pink-red eye; no patterns
  liger: { special: { antiAir: true }, addons: ['armyWhites'], ball: 0xff5a6a, palette: { body: 0xd9525e, trim: 0x7c1c28, accent: 0x7c1c28, joint: 0x34343c, eye: 0xff3a7a } },
};
// each unit's stats come from its profile (the Unit Lab can still change them)
for (const o of ORIGINALS) o.traits ??= PROFILES[o.id]?.traits;
export const BUILTINS: readonly CharacterDef[] = [
  ...ORIGINALS,
  ...ORIGINALS.filter((o) => V2[o.id]).map((o) => {
    const v = V2[o.id];
    const palette = { ...o.palette, ...v.palette };
    // wings follow the new body and trim
    palette.wing = palette.body;
    palette.wingTip = palette.trim;
    return { ...o, id: `${o.id}-2`, name: `${o.name} 2.0`, from: o.id, v2: !!v.kit, kit: v.kit, pose: v.pose, emblem: v.emblem, fit: v.fit, grow: v.grow, ball: v.ball, palette };
  }),
  ...ORIGINALS.filter((o) => V21[o.id]).map((o): CharacterDef => {
    const v = V21[o.id];
    const palette = { ...o.palette, ...v.palette };
    palette.wing = palette.body;
    palette.wingTip = palette.trim;
    // beasts build on their 2.0 Unit Lab design (and its size); humanoids on the 2.1 chassis
    const beast = !v.look;
    return {
      ...o,
      id: `${o.id}-21`,
      name: o.name,
      from: beast ? `${o.id}-2` : o.id,
      v21: true,
      look21: v.look,
      addons: v.addons,
      twin: v.twin,
      special: v.special,
      crest: v.crest ?? o.crest,
      emblem: v.emblem,
      matte: v.matte,
      ballTex: PATTERNS21[o.id]?.[0],
      armourTex: PATTERNS21[o.id]?.[1] ?? 'none',
      glow: v.glow ?? o.glow,
      darkFace: o.id === 'dragon' ? true : v.look ? false : o.darkFace,
      fit: beast ? V2[o.id]?.fit : undefined,
      ball: v.ball,
      palette,
    };
  }),
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
  if (!b) return undefined;
  // a 2.0 unit borrows its original's traits (and, if it has no 2.0 chassis, its design), never its colours or name
  const borrow = (u: UnitEntry | undefined): UnitEntry | undefined => (u ? { id, base: u.base, blueprint: b.kit || b.look21 ? undefined : u.blueprint, traits: u.traits } : undefined);
  const shipped = SHIPPED.units[id] ?? (b.from ? borrow(SHIPPED.units[b.from]) : undefined);
  const published = PUBLISHED.units[id] ?? (b.from ? borrow(PUBLISHED.units[b.from]) : undefined);
  return applyEntry(applyEntry(b, shipped), published);
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
/** the roster you pick from: the 2.1 set and any custom units (the 1.0s and 2.0s stay only as the 2.1s' bases) */
export const playable = () => CHARACTERS.filter((c) => c.v21 || !BUILTINS.some((b) => b.id === c.id));
/** an old 1.0 / 2.0 pick moves to its 2.1 */
export function playableId(id: string) {
  const all = playable();
  if (all.some((c) => c.id === id)) return id;
  const v21 = `${id.replace(/-2$/, '')}-21`;
  return all.some((c) => c.id === v21) ? v21 : all[0].id;
}

export class ShooterMesh {
  root = new THREE.Group();
  /** model scale on top of the animation (an arcade boss stands taller) */
  size = 1;
  /** a 2.0 unit's body proportions */
  fit = new THREE.Vector3(1, 1, 1);
  /** everything above the hips; rotates with aim */
  turret: THREE.Object3D = new THREE.Group();
  barrel: THREE.Object3D = new THREE.Group();
  wings: THREE.Object3D = new THREE.Group();
  trigger!: THREE.Object3D;
  legs: THREE.Object3D[] = [];
  mats: (THREE.MeshLambertMaterial | THREE.MeshPhysicalMaterial)[] = [];
  readonly id: string;
  /** the marble colour this model was built with */
  readonly ball: number;
  wingL = new THREE.Group();
  wingR = new THREE.Group();
  private stride = 0;
  /** rest pose of animated parts (Unit Lab designs can tilt them); animation is added on top */
  private rest = { turretY: 0, turretZ: 0, jaw: 0, slash: 0, legs: [] as number[], flame: new THREE.Vector3(1, 1, 1) };
  /** a puncher's arms (both thrust forward in the wind-up before each shot) and their rest angles */
  punchArms: THREE.Object3D[] = [];
  private punchRest: number[] = [];
  private windup = 0;
  /** a gun that swaps hands (the upper body mirrors), and a second gun in the left hand */
  private swapper = false;
  private barrel2: THREE.Object3D | null = null;
  private bellyMarkL: THREE.Object3D | null = null;
  private lastHand = 1;
  /** a head kept cocked to one side, swaying with rapid fire's spray */
  private tiltHead: THREE.Object3D | null = null;
  /** a swordsman's sword arm (it swings down on each shot) and the crescent its slash throws */
  slashArm: THREE.Object3D | null = null;
  private slashArc: THREE.Mesh | null = null;
  /** rest positions the recoil animation pushes from */
  private barrelZ = -0.32;
  private triggerZ = 0.38;
  /** beasts: lower jaw that snaps open on each shot */
  jaw: THREE.Object3D | null = null;
  /** lizard: tail flame that flickers */
  flame: THREE.Object3D | null = null;
  /** tank units: the track plates and road wheels, scrolled and spun as the tank drives */
  private treadPlates: THREE.Object3D[] = [];
  private treadWheels: THREE.Object3D[] = [];
  private treadTravel = 0;
  /** hovering units float this high and drift up and down */
  private hoverLift = 0;
  /** a floating unit's legs, swaying (they don't walk) */
  private dangle: THREE.Object3D[] = [];
  /** the jaw's swing when firing (signed); 0 uses the beasts' default snap */
  private jawOpen = 0;

  /** defOverride lets the Unit Lab preview an unsaved design */
  constructor(characterId: string, marbleColor: number, defOverride?: CharacterDef) {
    const def = defOverride ?? characterById(characterId);
    this.id = def.id;
    this.ball = marbleColor;
    this.build(def, marbleColor);
    if (def.fit) {
      this.fit.set(...def.fit);
      this.root.scale.copy(this.fit);
    }
    for (const g of def.grow ?? []) {
      this.root.traverse((o) => {
        if (o.userData.path !== g.path) return;
        if (g.scale) o.scale.multiplyScalar(g.scale);
        if (g.s) o.scale.multiply(new THREE.Vector3(...g.s));
        o.position.y += g.lift ?? 0;
      });
    }
    // the roster's look is boxy: code-built units swap their round parts for square-sided ones
    // (block designs already store theirs that way, so what the Unit Lab shows is what's drawn)
    if (!def.blueprint) boxify(this.root);
    if (def.look21?.gun === 'dragonMaw' || def.look21?.gun === 'chestMaw') this.jawOpen = -0.95;
    this.windup = def.special?.windup ?? 0;
    this.swapper = !!def.special?.swap;
    if (def.look21?.gun === 'slashSword') {
      // the crescent of light a slash throws, flashed in front of the chest on each shot
      const arc = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.72, 28, 1, Math.PI * 0.05, Math.PI * 0.9),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(marbleColor).lerp(new THREE.Color(0xffffff), 0.55), transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      arc.userData.fx = true;
      // tilted to run from high on the right down to the centre, along the cut
      arc.position.set(0.08, 0.4, -0.62);
      arc.rotation.set(-0.2, 0, -0.95);
      arc.visible = false;
      this.turret.add(arc);
      this.slashArc = arc;
    }
    // every unit is moulded plastic: soft gloss, a clear top coat catching the studio light
    this.mats = plasticize(this.root, def.matte, !!def.v21, def.armourTex);
  }

  private build(def: CharacterDef, marbleColor: number) {
    const pal = def.palette;
    const lam = (color: number, side: THREE.Side = THREE.FrontSide, slot?: string) => {
      const m = new THREE.MeshLambertMaterial({ color, side });
      // which part of the kit this paint is, for the 2.1 finishes (armour, trim, frame, ...)
      if (slot) m.userData.slot = slot;
      this.mats.push(m);
      return m;
    };
    const body = lam(pal.body, THREE.FrontSide, 'body');
    const trim = lam(pal.trim, THREE.FrontSide, 'trim');
    const accent = lam(pal.accent, THREE.FrontSide, 'accent');
    const joint = lam(pal.joint, THREE.FrontSide, 'joint');
    const gold = lam(0xffc23d, THREE.FrontSide, 'gold');
    const wingMat = lam(pal.wing, THREE.DoubleSide);
    const wingTip = lam(pal.wingTip, THREE.DoubleSide);
    const eyeMat = new THREE.MeshBasicMaterial({ color: pal.eye });
    const glowMat = def.glow !== undefined ? new THREE.MeshBasicMaterial({ color: def.glow }) : null;
    const ballMat = new THREE.MeshPhongMaterial({ color: marbleColor, shininess: 90, specular: 0xffffff });

    if (def.blueprint) {
      this.buildBlueprint(def.blueprint, def, marbleColor);
      this.addons21(def);
      return;
    }
    if (def.look21) {
      if (def.look21.frame === 'lizard') this.buildLizard21(def, { body, trim, accent, joint, gold, eyeMat, glowMat, ballMat });
      else this.buildHero21(def, { body, trim, accent, joint, gold, eyeMat, glowMat, ballMat, wingMat, wingTip });
      return;
    }
    if (def.kit) {
      this.buildHero2(def, { body, trim, accent, joint, gold, eyeMat, glowMat, ballMat, wingMat, wingTip });
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
          lam.userData.slot = typeof spec.color === 'string' ? spec.color : slotOfColor(color);
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
        case 'slash':
          this.slashArm = o;
          this.rest.slash = o.rotation.x;
          break;
        case 'punch':
          this.punchArms.push(o);
          this.punchRest.push(o.rotation.x);
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
      if (o === this.slashArm) return 'slash';
      if (this.punchArms.includes(o)) return 'punch';
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
      // effects (like the slash crescent) aren't part of the design
      if (o.userData.fx) return null;
      const mesh = o as THREE.Mesh;
      let b: Block;
      if (mesh.isMesh) {
        const meshData = mesh.geometry.userData.meshData as Block['mesh'] | undefined;
        const shape = meshData ? 'mesh' : SHAPE_OF[mesh.geometry.type];
        if (!shape) return null;
        const mat = mesh.material as THREE.MeshLambertMaterial;
        const kind = mat.type === 'MeshBasicMaterial' ? 'basic' : mat.type === 'MeshPhongMaterial' ? 'phong' : 'lambert';
        const size: Record<string, number | boolean> = {};
        if (meshData) Object.assign(size, { bevel: 0, smooth: 0 });
        else for (const [k, val] of Object.entries((mesh.geometry as THREE.BoxGeometry).parameters ?? {})) if (typeof val === 'number' || typeof val === 'boolean') size[k] = typeof val === 'number' ? r3(val) : val;
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
          ...(meshData ? { mesh: meshData } : {}),
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

  /**
   * The 2.0 humanoid: one chassis for every humanoid 2.0 (the same head, chest, arm and leg
   * proportions), dressed in Zoid-style machinery (ribbed vents over dark backing, bolt plates,
   * pistons, layered plates), with a character kit for what makes each unit itself.
   */
  private buildHero2(def: CharacterDef, m: { body: THREE.Material; trim: THREE.Material; accent: THREE.Material; joint: THREE.Material; gold: THREE.Material; eyeMat: THREE.Material; glowMat: THREE.Material | null; ballMat: THREE.Material; wingMat: THREE.Material; wingTip: THREE.Material }) {
    const kit = def.kit ?? 'mech';
    const steel = this.paint(0xb8bec9);
    const black = this.paint(0x16141c);
    const white = this.paint(0xf2f2ee);
    const hole = new THREE.MeshBasicMaterial({ color: 0x050507 });
    const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      return mesh;
    };
    const cyl = (r: number, h: number, mat: THREE.Material) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 4), mat);
    const cone = (r: number, h: number, mat: THREE.Material) => new THREE.Mesh(new THREE.ConeGeometry(r, h, 4), mat);
    /** Zoid-style ribbed vent: slats in body colour over a dark backing, on a face pointing along x (side = ±1) */
    const ventX = (parent: THREE.Object3D, x: number, y0: number, z: number, n: number, depth: number, side: number) => {
      parent.add(box(0.02, n * 0.05, depth + 0.02, m.joint, x - side * 0.012, y0 + (n - 1) * 0.025, z));
      for (let k = 0; k < n; k++) parent.add(box(0.03, 0.026, depth, m.body, x, y0 + k * 0.05, z));
    };
    /** the same, on a face pointing along -z (front) */
    const ventZ = (parent: THREE.Object3D, x: number, y0: number, z: number, n: number, width: number) => {
      parent.add(box(width + 0.02, n * 0.05, 0.02, m.joint, x, y0 + (n - 1) * 0.025, z + 0.012));
      for (let k = 0; k < n; k++) parent.add(box(width, 0.026, 0.03, m.body, x, y0 + k * 0.05, z));
    };
    /** a bolt plate facing along x or -z */
    const bolt = (parent: THREE.Object3D, x: number, y: number, z: number, facing: 'x' | 'z', s = 0.06) => parent.add(facing === 'x' ? box(0.02, s, s, steel, x, y, z) : box(s, s, 0.02, steel, x, y, z));
    /** a hydraulic piston between two points (in the parent's space) */
    const piston = (parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) => {
      const p = cyl(0.026, a.distanceTo(b), steel);
      p.position.copy(a).add(b).multiplyScalar(0.5);
      p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      parent.add(p);
    };
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

    // ---------- legs ----------
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.25, 0.54, 0);
      leg.add(box(0.2, 0.14, 0.22, m.joint, 0, -0.03, 0)); // hip joint
      leg.add(box(0.24, 0.2, 0.26, m.body, 0, -0.15, 0)); // thigh
      ventX(leg, side * 0.135, -0.21, 0, 3, 0.18, side);
      const knee = box(0.28, 0.16, 0.12, m.trim, 0, -0.25, -0.15);
      knee.rotation.x = -0.35;
      leg.add(knee);
      bolt(leg, 0, -0.25, -0.225, 'z');
      leg.add(box(0.32, 0.22, 0.34, m.body, 0, -0.35, 0.01)); // shin
      ventX(leg, side * 0.175, -0.44, 0.02, 4, 0.24, side);
      piston(leg, V(0, -0.2, 0.15), V(0, -0.42, 0.19));
      leg.add(box(0.38, 0.07, 0.4, m.accent, 0, -0.45, 0.01)); // boot flare
      for (const x of [-0.12, 0.12]) bolt(leg, x, -0.45, -0.205, 'z', 0.045);
      if (m.glowMat) leg.add(box(0.04, 0.18, 0.02, m.glowMat, 0, -0.34, -0.165));
      leg.add(box(0.42, 0.1, 0.6, m.body, 0, -0.49, -0.07)); // foot
      leg.add(box(0.34, 0.1, 0.12, m.joint, 0, -0.49, 0.24)); // heel
      if (def.feet === 'claw' || kit === 'lizard') {
        for (const cx of [-0.12, 0, 0.12]) {
          const claw = cone(0.05, 0.18, kit === 'lizard' ? white : m.joint);
          claw.rotation.x = -Math.PI / 2;
          claw.position.set(cx, -0.5, -0.45);
          leg.add(claw);
        }
      } else {
        const toe = box(0.4, 0.08, 0.2, m.accent, 0, -0.47, -0.42);
        toe.rotation.x = 0.3;
        leg.add(toe);
      }
      this.root.add(leg);
      this.legs.push(leg);
    }
    // waist and armour skirt
    this.root.add(box(0.44, 0.14, 0.34, def.darkFace ? m.joint : m.accent, 0, 0.6, 0));
    this.root.add(box(0.2, 0.16, 0.08, m.gold, 0, 0.59, -0.2));
    for (const side of [-1, 1]) {
      const front = box(0.2, 0.2, 0.05, m.body, side * 0.13, 0.48, -0.21);
      front.rotation.x = -0.18;
      this.root.add(front);
      const hip = box(0.05, 0.22, 0.28, m.trim, side * 0.27, 0.5, 0);
      hip.rotation.z = side * 0.22;
      this.root.add(hip);
      bolt(this.root, side * 0.29, 0.52, -0.05, 'x', 0.05);
    }

    // ---------- torso ----------
    this.turret.position.y = 0.64;
    this.root.add(this.turret);
    this.turret.add(box(0.5, 0.16, 0.42, m.joint, 0, 0.08, 0)); // abdomen
    ventZ(this.turret, 0, 0.02, -0.22, 3, 0.34); // ribbed abdomen
    this.turret.add(box(0.7, 0.16, 0.54, m.body, 0, 0.18, 0)); // lower chest
    this.turret.add(box(0.94, 0.32, 0.62, m.body, 0, 0.38, 0)); // upper chest
    for (const side of [-1, 1]) {
      ventX(this.turret, side * 0.485, 0.27, 0.02, 4, 0.4, side); // chest-side vents
      bolt(this.turret, side * 0.42, 0.5, -0.315, 'z', 0.05);
    }
    this.turret.add(box(0.52, 0.08, 0.46, m.joint, 0, 0.57, 0)); // collar
    // backpack, ribbed, with twin thrusters
    this.turret.add(box(0.56, 0.38, 0.2, m.trim, 0, 0.34, 0.38));
    for (let k = 0; k < 4; k++) this.turret.add(box(0.46, 0.026, 0.03, m.body, 0, 0.22 + k * 0.07, 0.49));
    for (const side of [-1, 1]) {
      const thruster = cyl(0.085, 0.18, m.joint);
      thruster.rotation.x = Math.PI / 2;
      thruster.position.set(side * 0.17, 0.12, 0.52);
      const nozzle = cyl(0.06, 0.02, hole);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(side * 0.17, 0.12, 0.615);
      this.turret.add(thruster, nozzle);
    }
    if (m.glowMat) {
      this.turret.add(box(0.04, 0.36, 0.02, m.glowMat, 0, 0.3, -0.36));
      for (const side of [-1, 1]) this.turret.add(box(0.02, 0.28, 0.5, m.glowMat, side * 0.5, 0.38, 0));
    }
    // the chest: angled plates in a V around the core marble (the lizard wears a belly plate instead)
    if (kit === 'lizard') {
      this.turret.add(box(0.5, 0.42, 0.06, m.trim, 0, 0.3, -0.33));
      for (const y of [0.2, 0.3, 0.4]) this.turret.add(box(0.44, 0.015, 0.02, m.joint, 0, y, -0.365));
    } else {
      const skull = def.emblem === 'skull';
      for (const side of [-1, 1]) {
        const pec = box(0.36, 0.2, 0.08, skull ? m.body : m.trim, side * 0.21, 0.4, -0.32);
        pec.rotation.z = side * -0.18;
        this.turret.add(pec);
        this.turret.add(box(0.14, 0.05, 0.04, def.darkFace ? m.accent : m.gold, side * 0.26, 0.31, -0.37));
      }
      if (skull) {
        // the white skull across the chest: cranium, cheeks, hollow eyes, long teeth
        const z = -0.375;
        this.turret.add(box(0.32, 0.15, 0.03, white, 0, 0.47, z), box(0.26, 0.07, 0.03, white, 0, 0.37, z));
        for (const side of [-1, 1]) this.turret.add(box(0.09, 0.07, 0.02, hole, side * 0.075, 0.43, z - 0.012));
        this.turret.add(box(0.03, 0.04, 0.02, hole, 0, 0.375, z - 0.012));
        for (let k = 0; k < 5; k++) this.turret.add(box(0.036, 0.14, 0.03, white, -0.1 + k * 0.05, 0.27, z));
      } else {
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), m.ballMat);
        core.position.set(0, 0.36, -0.35);
        this.turret.add(core);
      }
    }

    // ---------- the gun: a chest cannon, unless the kit carries its own ----------
    const punch = def.pose === 'punch';
    // a mech in the attack pose carries its gun in the thrown hand instead of a chest cannon
    const handGun = kit === 'mech' && punch;
    const chestGun = kit === 'mech' && !handGun;
    if (chestGun) {
      this.markBelly(this.turret, 0, 0.16, -0.66);
      this.barrel.position.set(0, 0.16, -0.32);
      const tube = cyl(0.11, 0.34, m.joint);
      tube.rotation.x = Math.PI / 2;
      tube.position.z = -0.1;
      const ring = cyl(0.135, 0.06, m.gold);
      ring.rotation.x = Math.PI / 2;
      ring.position.z = -0.27;
      const bore = cyl(0.075, 0.02, hole);
      bore.rotation.x = Math.PI / 2;
      bore.position.z = -0.31;
      this.barrel.add(tube, ring, bore);
      this.turret.add(this.barrel);
    } else if (handGun) {
      this.markBelly(this.turret, 0.6, 0.2, -1.43); // the machine gun in the thrown hand
    } else if (kit === 'lizard') {
      this.markBelly(this.turret, 0, 0.76, -0.68); // the mouth
    } else if (kit === 'beetle') {
      if (punch) this.markBelly(this.turret, 0.6, 0.44, -0.99); // the twin cannon on the thrown fist
      else this.markBelly(this.turret, 0.66, 0, -0.64); // the right forearm gun
    } else if (kit === 'eva') {
      if (punch) this.markBelly(this.turret, 0.6, 0.16, -1.37); // the rifle in the outstretched hand
      else this.markBelly(this.turret, 0.52, 0.02, -0.98); // the rifle in the right hand
    } else {
      this.markBelly(this.turret, 0, 0.16, -0.4);
    }

    // ---------- shoulders and arms ----------
    for (const side of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(side * 0.6, 0.42, 0);
      const heavy = def.shoulders === 'heavy' && kit === 'mech';
      if (heavy) sh.position.x = side * 0.64;
      // pauldron, layered, ribbed on the outside
      const pw = heavy ? 0.48 : 0.38;
      sh.add(box(pw, heavy ? 0.4 : 0.32, heavy ? 0.54 : 0.46, m.body));
      sh.add(box(pw + 0.04, 0.08, heavy ? 0.58 : 0.5, m.trim, 0, heavy ? 0.22 : 0.18, 0));
      ventX(sh, side * (pw / 2 + 0.015), -0.1, 0, 3, heavy ? 0.4 : 0.32, side);
      for (const rz of [-0.12, 0.12]) bolt(sh, side * 0.08, heavy ? 0.265 : 0.225, rz, 'z', 0.04);
      if (def.shoulders === 'spike' && kit === 'mech')
        for (const sz of [-0.11, 0.11]) {
          const spike = cone(0.07, 0.34, m.joint);
          spike.rotation.z = -side * 1.2;
          spike.position.set(side * 0.22, 0.14, sz);
          sh.add(spike);
        }
      // the attack pose: the right arm thrown straight out at the target
      const thrown = punch && side === 1;
      if (thrown) {
        sh.add(box(0.15, 0.16, 0.18, m.joint, 0, -0.14, -0.14));
        piston(sh, V(0.1, -0.06, -0.06), V(0.1, -0.08, -0.46));
        const g = new THREE.Group();
        g.position.set(0, -0.14, -0.53);
        g.add(box(0.25, 0.26, 0.3, def.darkFace ? m.trim : m.body));
        ventX(g, 0.14, -0.06, 0, 3, 0.2, 1);
        g.add(box(0.27, 0.28, 0.06, m.accent, 0, 0, 0.15));
        sh.add(g);
        sh.add(box(0.24, 0.24, 0.22, m.joint, 0, -0.14, -0.78)); // fist
        sh.add(box(0.2, 0.2, 0.3, m.joint, 0, -0.14, -0.3)); // upper arm
      }
      // arm: slim upper arm, elbow piston, chunky ribbed gauntlet, fist
      if (!thrown) {
      sh.add(box(0.14, 0.16, 0.14, m.joint, 0, -0.22, -0.02));
      piston(sh, V(side * 0.09, -0.16, 0.04), V(side * 0.1, -0.32, -0.08));
      const gauntlet = new THREE.Group();
      gauntlet.position.set(-side * 0.02, -0.34, -0.12);
      gauntlet.rotation.x = -0.5;
      gauntlet.add(box(0.25, 0.26, 0.28, def.darkFace ? m.trim : m.body));
      ventX(gauntlet, side * 0.14, -0.06, 0, 3, 0.2, side);
      gauntlet.add(box(0.27, 0.06, 0.3, m.accent, 0, 0.1, 0));
      sh.add(gauntlet);
      sh.add(box(0.22, 0.2, 0.22, m.joint, -side * 0.08, -0.42, -0.24)); // fist
      }
      if (kit === 'lizard') {
        for (const dx of [-0.06, 0, 0.06]) {
          const claw = cone(0.03, 0.12, white);
          claw.rotation.x = Math.PI - 0.4;
          claw.position.set(-side * 0.08 + dx, -0.56, -0.3);
          sh.add(claw);
        }
      }
      if (kit === 'eva') {
        // EVA: tall dark pylons rising from the shoulders, green-tipped
        const pylon = box(0.08, 0.62, 0.3, m.trim, side * 0.16, 0.34, 0);
        pylon.rotation.z = -side * 0.08;
        sh.add(pylon);
        sh.add(box(0.09, 0.1, 0.31, m.accent, side * 0.18, 0.66, 0));
        sh.add(box(0.09, 0.04, 0.31, m.accent, side * 0.17, 0.4, 0));
      }
      if (kit === 'beetle' && !thrown) {
        // Metabee: a black gun barrel along each forearm
        const gun = cyl(0.05, 0.3, m.trim);
        gun.rotation.x = Math.PI / 2;
        gun.position.set(side * 0.06, -0.42, -0.38);
        sh.add(gun);
      }
      if (kit === 'megatron') {
        // scaled fins rising behind the shoulders
        const fin = box(0.12, 0.5, 0.3, m.body, side * 0.02, 0.36, 0.12);
        fin.rotation.set(0.15, 0, side * -0.3);
        sh.add(fin);
        for (const y of [0.24, 0.36, 0.48]) {
          const sc = box(0.13, 0.03, 0.22, m.trim, side * (0.02 + (y - 0.36) * 0.3), y, 0.1);
          sc.rotation.set(0.15, 0, side * -0.3);
          sh.add(sc);
        }
      }
      if (kit === 'mech') {
        if (side === -1) this.buildOffhand(sh, def, { ...m, gold: m.gold, glowMat: m.glowMat, eyeMat: m.eyeMat });
        if (side === 1 && def.offhand === 'gatling') this.buildOffhand(sh, def, { ...m, gold: m.gold, glowMat: m.glowMat, eyeMat: m.eyeMat });
      }
      this.turret.add(sh);
    }

    // a drum-fed machine gun in the thrown right hand
    if (handGun) {
      this.barrel.position.set(0.6, 0.2, -0.78);
      this.barrel.add(box(0.12, 0.15, 0.44, m.joint, 0, 0, -0.06)); // receiver
      this.barrel.add(box(0.08, 0.14, 0.18, m.joint, 0, -0.03, 0.24)); // stock
      this.barrel.add(box(0.125, 0.03, 0.3, m.accent, 0, 0.06, -0.08)); // top stripe
      const drum = cyl(0.11, 0.08, m.trim);
      drum.rotation.z = Math.PI / 2;
      drum.position.set(-0.1, -0.02, 0.02);
      this.barrel.add(drum);
      ventX(this.barrel, 0.065, -0.05, -0.12, 2, 0.14, 1);
      const tube = cyl(0.032, 0.3, m.joint);
      tube.rotation.x = Math.PI / 2;
      tube.position.z = -0.43;
      this.barrel.add(tube, box(0.08, 0.08, 0.08, m.trim, 0, 0, -0.6));
      const bore = cyl(0.025, 0.02, hole);
      bore.rotation.x = Math.PI / 2;
      bore.position.z = -0.645;
      this.barrel.add(bore);
      this.turret.add(this.barrel);
      this.barrelZ = -0.78;
    }
    // EVA: a pallet rifle in the right hand is the gun, pointing down the lane
    if (kit === 'eva') {
      const gunmetal = this.paint(0x5d646e);
      if (punch) this.barrel.position.set(0.6, 0.16, -0.74);
      else this.barrel.position.set(0.52, 0.02, -0.36);
      this.barrel.add(box(0.13, 0.15, 0.5, gunmetal, 0, 0, -0.1)); // receiver
      this.barrel.add(box(0.1, 0.16, 0.2, gunmetal, 0, -0.02, 0.24)); // stock
      this.barrel.add(box(0.06, 0.16, 0.08, black, 0, -0.14, -0.08)); // magazine
      this.barrel.add(box(0.05, 0.05, 0.22, black, 0, 0.1, -0.08)); // sight rail
      this.barrel.add(box(0.135, 0.03, 0.2, m.accent, 0, 0.02, -0.2)); // stripe
      ventX(this.barrel, 0.07, -0.04, -0.02, 2, 0.16, 1);
      const tube = cyl(0.035, 0.3, black);
      tube.rotation.x = Math.PI / 2;
      tube.position.z = -0.45;
      const bore = cyl(0.025, 0.02, hole);
      bore.rotation.x = Math.PI / 2;
      bore.position.z = -0.6;
      this.barrel.add(tube, bore);
      this.turret.add(this.barrel);
      this.barrelZ = this.barrel.position.z;
    }
    // Metabee's right forearm gun is the main gun; it recoils on every shot
    if (kit === 'beetle' && punch) {
      // Metabee's twin cannon, mounted over the thrown fist
      this.barrel.position.set(0.6, 0.44, -0.72);
      this.barrel.add(box(0.28, 0.15, 0.3, m.body, 0, 0, 0));
      this.barrel.add(box(0.3, 0.03, 0.32, m.trim, 0, -0.07, 0));
      for (const x of [-0.07, 0.07]) {
        const tube = cyl(0.055, 0.1, m.trim);
        tube.rotation.x = Math.PI / 2;
        tube.position.set(x, 0, -0.19);
        const bore = cyl(0.035, 0.02, hole);
        bore.rotation.x = Math.PI / 2;
        bore.position.set(x, 0, -0.245);
        this.barrel.add(tube, bore);
      }
      this.turret.add(this.barrel);
      this.barrelZ = -0.72;
    } else if (kit === 'beetle') {
      this.barrel.position.set(0.66, 0.0, -0.34);
      const tube = cyl(0.06, 0.34, m.trim);
      tube.rotation.x = Math.PI / 2;
      tube.position.z = -0.1;
      const bore = cyl(0.04, 0.02, hole);
      bore.rotation.x = Math.PI / 2;
      bore.position.z = -0.27;
      this.barrel.add(tube, bore);
      this.turret.add(this.barrel);
      this.barrelZ = -0.34;
    }
    // Megatron: the T-rex head on his right fist is his gun, its jaw snapping on each shot;
    // the great curved tail is carried like a blade in the left hand
    if (kit === 'megatron') {
      const pink = this.paint(0xc8506a);
      const red = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
      this.barrel.position.set(0.56, -0.02, -0.34);
      this.barrel.scale.setScalar(1.5);
      this.barrel.add(box(0.34, 0.3, 0.42, m.body, 0, 0.05, -0.06), box(0.3, 0.17, 0.3, m.body, 0, 0, -0.32));
      this.barrel.add(box(0.22, 0.04, 0.3, pink, 0, -0.07, -0.3));
      for (const side of [-1, 1]) {
        this.barrel.add(box(0.07, 0.05, 0.05, red, side * 0.17, 0.1, -0.14));
        const brow = box(0.1, 0.05, 0.18, m.trim, side * 0.12, 0.2, -0.14);
        brow.rotation.z = side * 0.3;
        this.barrel.add(brow);
        for (let k = 0; k < 5; k++) {
          const t = cone(0.02, 0.07, white);
          t.rotation.x = Math.PI;
          t.position.set(side * 0.11, -0.09, -0.44 + k * 0.065);
          this.barrel.add(t);
        }
        ventX(this.barrel, side * 0.175, -0.05, 0.02, 3, 0.2, side);
      }
      const jaw = new THREE.Group();
      jaw.position.set(0, -0.08, -0.08);
      jaw.add(box(0.26, 0.08, 0.38, m.body, 0, -0.03, -0.21));
      for (const side of [-1, 1])
        for (let k = 0; k < 4; k++) {
          const t = cone(0.019, 0.06, white);
          t.position.set(side * 0.1, 0.03, -0.34 + k * 0.07);
          jaw.add(t);
        }
      this.barrel.add(jaw);
      this.jaw = jaw;
      this.turret.add(this.barrel);
      this.barrelZ = -0.34;
      // the tail blade in the left hand: a thick curve of tapering plates gripped in the fist,
      // a bright cutting edge down the outside and spikes along the spine
      const edgeMat = this.paint(0xd8dde4);
      const blade: [number, number, number, number, number][] = [
        [-0.76, 0.66, -0.14, 0.34, 0.32],
        [-0.84, 0.34, -0.2, 0.32, 0.16],
        [-0.86, 0.0, -0.22, 0.28, 0],
        [-0.82, -0.32, -0.2, 0.22, -0.16],
        [-0.72, -0.6, -0.16, 0.15, -0.38],
      ];
      blade.forEach(([x, y, z, w, rz], k) => {
        const seg = new THREE.Group();
        seg.position.set(x, y, z);
        seg.rotation.z = rz;
        seg.add(box(w * 0.75, 0.38, w * 1.3, k % 2 ? m.trim : m.body));
        seg.add(box(0.05, 0.36, w * 1.1, edgeMat, -w * 0.4, 0, 0)); // cutting edge
        seg.add(box(w * 0.78, 0.04, w * 1.34, m.joint, 0, 0.17, 0)); // plate seam
        const spike = cone(0.05 + w * 0.12, 0.16 + w * 0.3, m.trim);
        spike.rotation.z = -Math.PI / 2;
        spike.position.set(w * 0.4 + 0.06, 0, 0);
        seg.add(spike);
        this.turret.add(seg);
      });
      const tip = cone(0.07, 0.3, edgeMat);
      tip.position.set(-0.6, -0.86, -0.14);
      tip.rotation.z = Math.PI - 0.6;
      this.turret.add(tip);
      // the grip where the fist holds it
      this.turret.add(box(0.2, 0.12, 0.26, m.joint, -0.64, 0.0, -0.24));
    }

    // ---------- head ----------
    this.turret.add(box(0.2, 0.12, 0.2, m.joint, 0, 0.63, 0)); // neck
    const head = new THREE.Group();
    head.position.set(0, 0.9, -0.02);
    head.scale.setScalar(1.06);
    // Metabee's dome, jaw shell and launchers make a bigger head than the rest: scaled down to match
    if (kit === 'beetle') {
      head.scale.setScalar(0.84);
      head.position.y = 0.86;
    }
    this.turret.add(head);
    if (kit === 'eva') {
      const slate = this.paint(0x6f7d96);
      head.add(box(0.6, 0.42, 0.72, m.body, 0, 0.04, 0.02)); // long helmet
      head.add(box(0.14, 0.1, 0.62, m.body, 0, 0.28, 0.02)); // crown ridge
      head.add(box(0.42, 0.16, 0.06, black, 0, -0.02, -0.33)); // face recess
      for (const side of [-1, 1]) {
        const brow = box(0.32, 0.08, 0.16, m.body, side * 0.15, 0.1, -0.34);
        brow.rotation.z = side * 0.25;
        head.add(brow);
        const eye = box(0.13, 0.05, 0.02, m.eyeMat, side * 0.1, -0.01, -0.365);
        eye.rotation.z = side * 0.35;
        head.add(eye);
        const cheek = box(0.05, 0.2, 0.06, m.accent, side * 0.15, -0.2, -0.34);
        cheek.rotation.z = -side * 0.35;
        head.add(cheek);
        const flap = box(0.06, 0.36, 0.46, m.body, side * 0.34, -0.06, 0);
        flap.rotation.z = side * 0.2;
        head.add(flap);
        const stripe = box(0.065, 0.05, 0.44, m.accent, side * 0.355, 0.04, 0);
        stripe.rotation.z = side * 0.2;
        head.add(stripe);
        ventX(head, side * 0.32, -0.16, 0.12, 3, 0.2, side);
      }
      const beak = box(0.2, 0.16, 0.22, slate, 0, -0.2, -0.3);
      beak.rotation.x = 0.35;
      head.add(beak, box(0.13, 0.12, 0.12, slate, 0, -0.32, -0.38));
      const horn = cone(0.07, 0.52, m.body);
      horn.position.set(0, 0.38, -0.34);
      horn.rotation.x = -0.75;
      head.add(horn, box(0.12, 0.04, 0.12, m.accent, 0, 0.27, -0.3));
    } else if (kit === 'beetle') {
      head.add(box(0.74, 0.58, 0.7, m.body, 0, 0.08, 0.02)); // dome
      head.add(box(0.6, 0.12, 0.56, m.body, 0, 0.42, 0.02));
      head.add(box(0.8, 0.24, 0.66, m.body, 0, -0.2, 0.04)); // jaw shell
      head.add(box(0.66, 0.2, 0.08, black, 0, -0.02, -0.33)); // visor
      for (const side of [-1, 1]) {
        const eye = box(0.2, 0.1, 0.02, m.eyeMat, side * 0.13, -0.03, -0.375);
        eye.rotation.z = side * 0.2;
        head.add(eye);
        ventX(head, side * 0.415, -0.26, 0.05, 3, 0.36, side);
      }
      head.add(box(0.46, 0.2, 0.1, white, 0, -0.24, -0.33)); // white lower face
      head.add(box(0.08, 0.22, 0.08, m.body, 0, 0.56, 0.02)); // stalk
      for (const side of [-1, 1]) {
        const pod = new THREE.Group();
        pod.position.set(side * 0.24, 0.72, 0.02);
        pod.rotation.z = side * 0.32;
        const tube = cyl(0.09, 0.4, m.trim);
        tube.rotation.z = Math.PI / 2;
        pod.add(tube);
        for (const dx of [-0.1, 0, 0.1]) pod.add(box(0.05, 0.05, 0.02, hole, side * dx, 0, -0.09));
        pod.add(box(0.02, 0.11, 0.11, hole, side * 0.205, 0, 0));
        head.add(pod);
      }
    } else if (kit === 'megatron') {
      const helmet = this.paint(0x3f4648);
      const helmetLite = this.paint(0x5a6264);
      const face = this.paint(0xa9b0b6);
      const gem = new THREE.MeshBasicMaterial({ color: 0x4dff6a });
      head.add(box(0.58, 0.66, 0.58, helmet, 0, 0.06, 0.01)); // tall bucket helmet
      head.add(box(0.14, 0.12, 0.52, helmetLite, 0, 0.42, 0.02)); // crest
      for (const side of [-1, 1]) {
        const guard = box(0.08, 0.46, 0.5, helmet, side * 0.3, -0.06, 0.02);
        guard.rotation.z = side * -0.08;
        head.add(guard);
        ventX(head, side * 0.345, -0.2, 0.06, 4, 0.3, side);
        const brow = box(0.16, 0.06, 0.08, helmet, side * 0.08, 0.06, -0.31);
        brow.rotation.z = side * 0.35;
        head.add(brow);
        const eye = box(0.1, 0.035, 0.02, m.eyeMat, side * 0.08, 0.02, -0.33);
        eye.rotation.z = side * 0.35;
        head.add(eye);
      }
      head.add(box(0.32, 0.34, 0.06, face, 0, -0.08, -0.29)); // silver face
      head.add(box(0.14, 0.02, 0.02, helmet, 0, -0.16, -0.325)); // grim mouth
      const g = box(0.06, 0.06, 0.03, gem, 0, 0.2, -0.3);
      g.rotation.z = Math.PI / 4;
      g.scale.set(1, 1, 1);
      head.add(g, box(0.03, 0.08, 0.03, gem, 0, 0.27, -0.3));
    } else if (kit === 'lizard') {
      head.add(box(0.62, 0.5, 0.6, m.body, 0, 0.06, 0.04)); // skull
      head.add(box(0.5, 0.24, 0.4, m.body, 0, -0.06, -0.4)); // snout
      for (const side of [-1, 1]) {
        const brow = box(0.24, 0.07, 0.14, m.joint, side * 0.13, 0.2, -0.24);
        brow.rotation.z = side * 0.35;
        head.add(brow);
        const eye = box(0.13, 0.06, 0.02, m.eyeMat, side * 0.13, 0.12, -0.265);
        eye.rotation.z = side * 0.35;
        head.add(eye, box(0.04, 0.03, 0.02, black, side * 0.09, 0.12, -0.6)); // eye, nostril
        ventX(head, side * 0.325, -0.12, 0.1, 3, 0.26, side);
        for (let k = 0; k < 4; k++) {
          const t = cone(0.025, 0.08, white);
          t.rotation.x = Math.PI;
          t.position.set(side * 0.2, -0.2, -0.56 + k * 0.08);
          head.add(t);
        }
      }
      // the lower jaw snaps open on each shot; the marble leaves the mouth
      const jaw = new THREE.Group();
      jaw.position.set(0, -0.18, -0.12);
      jaw.add(box(0.46, 0.1, 0.44, m.body, 0, -0.04, -0.24));
      jaw.add(box(0.36, 0.02, 0.36, this.paint(0xc8506a), 0, 0.012, -0.24));
      head.add(jaw);
      this.jaw = jaw;
      this.barrel.position.set(0, -0.12, -0.6);
      this.barrelZ = -0.6;
      head.add(this.barrel);
      // the tail sweeps back and up from the hips, its tip ablaze
      const tail = new THREE.Group();
      tail.position.set(0, 0.5, 0.24);
      [0.24, 0.2, 0.16, 0.12].forEach((w, k) => {
        const seg = box(w, w, 0.28, k % 2 ? m.trim : m.body, 0, k * 0.1, 0.14 + k * 0.24);
        seg.rotation.x = -0.25 - k * 0.15;
        tail.add(seg);
      });
      const flame = new THREE.Group();
      flame.position.set(0, 0.5, 1.02);
      const fire = (r: number, h: number, color: number, y: number, opacity: number) => {
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
        const base = new THREE.Mesh(new THREE.BoxGeometry(r * 1.6, r * 1.6, r * 1.6), mat);
        base.position.y = y;
        const lick = new THREE.Mesh(new THREE.ConeGeometry(r * 0.95, h, 4), mat);
        lick.position.y = y + h / 2;
        flame.add(base, lick);
      };
      fire(0.15, 0.4, 0xff4a0a, -0.12, 0.85);
      fire(0.1, 0.3, 0xffa21a, -0.1, 0.9);
      fire(0.055, 0.18, 0xfff07a, -0.08, 1);
      tail.add(flame);
      this.flame = flame;
      this.root.add(tail);
    } else {
      // the Gundam-style head: capped helmet, V brow, cheek guards, crest
      head.add(box(0.72, 0.56, 0.64, m.body));
      head.add(box(0.62, 0.08, 0.56, m.trim, 0, 0.3, 0.02));
      head.add(box(0.5, 0.3, 0.06, def.darkFace ? m.joint : m.body, 0, -0.08, -0.33));
      const chin = box(0.18, 0.1, 0.1, def.darkFace ? m.joint : m.accent, 0, -0.23, -0.34);
      chin.rotation.x = 0.35;
      head.add(chin);
      if (def.eyes === 'mono') {
        head.add(box(0.56, 0.12, 0.03, new THREE.MeshBasicMaterial({ color: 0x0b0710 }), 0, 0.03, -0.365));
        head.add(box(0.12, 0.1, 0.02, m.eyeMat, 0.06, 0.03, -0.38));
      } else
        for (const side of [-1, 1]) {
          const eye = box(0.16, 0.065, 0.02, m.eyeMat, side * 0.12, 0.02, -0.37);
          eye.rotation.z = side * (def.darkFace ? 0.35 : 0.2);
          head.add(eye);
        }
      for (const side of [-1, 1]) {
        const brow = box(0.32, 0.07, 0.12, m.trim, side * 0.15, 0.12, -0.33);
        brow.rotation.z = side * 0.22;
        head.add(brow);
        const cheek = box(0.08, 0.26, 0.24, m.trim, side * 0.35, -0.08, -0.16);
        cheek.rotation.y = side * 0.25;
        head.add(cheek);
        head.add(box(0.1, 0.22, 0.3, m.trim, side * 0.4, 0, 0.06));
        ventX(head, side * 0.455, -0.06, 0.06, 3, 0.2, side);
        head.add(box(0.025, 0.18, 0.025, m.joint, side * 0.4, 0.2, 0.14));
        head.add(box(0.05, 0.03, 0.05, m.accent, side * 0.4, 0.3, 0.14));
      }
      for (let k = 0; k < 4; k++) head.add(box(0.02, 0.07, 0.01, def.darkFace ? m.trim : m.joint, -0.06 + k * 0.04, -0.15, -0.363));
      head.add(box(0.06, 0.16, 0.3, m.trim, 0, 0.34, 0.2));
      head.add(box(0.12, 0.1, 0.06, def.eyes === 'mono' ? m.gold : m.accent, 0, 0.22, -0.34));
      this.buildCrest(head, def, { body: m.body, trim: m.trim, accent: m.accent, joint: m.joint, gold: m.gold, glowMat: m.glowMat });
    }

    // ---------- back pods and trigger ----------
    this.wings.position.set(0, 0.42, 0.34);
    this.turret.add(this.wings);
    this.wingR.position.x = 0.12;
    this.wingL.position.x = -0.12;
    this.wingL.scale.x = -1;
    this.wings.add(this.wingL, this.wingR);
    if (def.wings === 'pods' && kit === 'mech') for (const w of [this.wingL, this.wingR]) this.buildPods(w, m.wingMat, m.wingTip, m.joint);
    this.trigger = box(0.26, 0.16, 0.16, m.gold, 0, 0.06, 0.5);
    this.triggerZ = 0.5;
    this.turret.add(this.trigger);
    // leaning into the punch
    if (punch) this.turret.rotation.x = -0.12;
  }

  /**
   * The 2.1 humanoid: the shared chassis rebuilt in faceted kit shapes (a V chest, thighs that
   * taper to the knee, shins that flare to the ankle, wedge feet with heels, angled pauldrons,
   * a cut and pointed face, a visible neck, arms held off the body), on one of a few frames so
   * the silhouettes differ, plus the character's own head, gun, pose and signature parts.
   */
  private buildHero21(def: CharacterDef, m: { body: THREE.Material; trim: THREE.Material; accent: THREE.Material; joint: THREE.Material; gold: THREE.Material; eyeMat: THREE.Material; glowMat: THREE.Material | null; ballMat: THREE.Material; wingMat: THREE.Material; wingTip: THREE.Material }) {
    const L = def.look21!;
    const F = FRAMES21[L.frame];
    const steel = this.paint(0xb8bec9, 'metal');
    const black = this.paint(0x16141c, 'rubber');
    const white = this.paint(0xf2f2ee);
    const silver = this.paint(0xa9b0b6);
    const hole = new THREE.MeshBasicMaterial({ color: 0x050507 });
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const at = <T extends THREE.Object3D>(o: T, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
      o.position.set(x, y, z);
      o.rotation.set(rx, ry, rz);
      return o;
    };
    const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => at(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), x, y, z);
    /** tapered, chamfered block (bottom wb x db, top wt x dt) */
    const prism = (wb: number, db: number, wt: number, dt: number, h: number, mat: THREE.Material, cuts: Cuts = 0, lean = 0) => facetMesh(prismData(wb, db, wt, dt, h, cuts, lean), mat);
    /** a front-view outline extruded through z */
    const plate = (pts: [number, number][], depth: number, mat: THREE.Material) => facetMesh(extrudeData(pts, depth), mat);
    /** a side-view outline (z, y) extruded across x */
    const side = (pts: [number, number][], width: number, mat: THREE.Material) => facetMesh(sideData(pts, width), mat);
    const cyl = (r: number, h: number, mat: THREE.Material) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 4, 1, false, Math.PI / 4), mat);
    const cone = (r: number, h: number, mat: THREE.Material) => new THREE.Mesh(new THREE.ConeGeometry(r, h, 4, 1, false, Math.PI / 4), mat);
    const ventX = (parent: THREE.Object3D, x: number, y0: number, z: number, n: number, depth: number, s: number) => {
      parent.add(box(0.02, n * 0.05, depth + 0.02, m.joint, x - s * 0.012, y0 + (n - 1) * 0.025, z));
      for (let k = 0; k < n; k++) parent.add(box(0.03, 0.026, depth, m.body, x, y0 + k * 0.05, z));
    };
    const piston = (parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) => {
      const p = cyl(0.024, a.distanceTo(b), steel);
      p.position.copy(a).add(b).multiplyScalar(0.5);
      p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      parent.add(p);
    };
    const glow = (parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number) => {
      if (m.glowMat) parent.add(box(w, h, d, m.glowMat, x, y, z));
    };
    const lw = F.legW;
    const k = F.legS;
    const hipY = 0.54 * k;

    // ---------- legs: tapered thigh, pointed knee, flared shin, visible ankle, wedge foot ----------
    if (L.treads) {
      // a tank's lower body: two tread units on short struts, road wheels, a drive sprocket,
      // track plates and an armour skirt with vents
      for (const s of [-1, 1]) {
        const t = at(new THREE.Group(), s * 0.42, 0, 0);
        t.scale.setScalar(1.4);
        t.add(at(side([[-0.5, 0.06], [-0.42, 0], [0.42, 0], [0.5, 0.06], [0.46, 0.28], [-0.46, 0.28]], 0.24, black), 0, 0, 0));
        for (const z of [-0.33, -0.11, 0.11, 0.33]) {
          const wheel = at(cyl(0.085, 0.26, m.joint), 0, 0.1, z, 0, 0, Math.PI / 2);
          t.add(wheel);
          this.treadWheels.push(wheel);
        }
        t.add(at(cyl(0.11, 0.27, m.trim), 0, 0.17, 0.44, 0, 0, Math.PI / 2)); // drive sprocket
        // track plates top and bottom; they scroll round as the tank drives
        for (const y of [0.29, 0.012])
          for (let q = 0; q < 9; q++) {
            const plate = box(0.25, 0.025, 0.07, m.joint, 0, y, -0.4 + q * 0.1);
            plate.userData.z0 = plate.position.z;
            plate.userData.dir = y > 0.1 ? 1 : -1;
            t.add(plate);
            this.treadPlates.push(plate);
          }
        t.add(at(prism(0.06, 0.92, 0.06, 0.86, 0.22, m.body, 0.02), s * 0.16, 0.2, 0)); // armour skirt
        ventX(t, s * 0.195, 0.13, 0.05, 3, 0.36, s);
        t.add(box(0.07, 0.03, 0.88, m.accent, s * 0.16, 0.3, 0));
        this.root.add(t);
        // strut from the top of the tread up to the hips
        this.root.add(at(prism(0.2, 0.24, 0.22, 0.26, Math.max(0.06, hipY - 0.4), m.joint, 0.04), s * 0.3, (hipY + 0.4) / 2, 0));
      }
    }
    // floating units hang long legs, toes down, high enough to clear the floor
    const HOVER_LEG = 1.35;
    if (L.hover) this.hoverLift = 0.54 * k * (HOVER_LEG - 1) + 0.26;
    for (const s of L.treads ? [] : [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(s * (F.legGap + (L.menace ? 0.06 : 0)), hipY, 0);
      if (L.menace) leg.rotation.z = s * 0.12;
      leg.add(box(0.18 * lw, 0.12, 0.2 * lw, m.joint, 0, -0.02, 0)); // hip ball
      leg.add(at(prism(0.2 * lw, 0.22 * lw, 0.27 * lw, 0.27 * lw, 0.24 * k, m.body, [0.05, 0.05, 0.02, 0.02]), 0, -0.15 * k, 0));
      ventX(leg, s * 0.135 * lw, -0.22 * k, 0.01, 3, 0.16 * lw, s);
      if (L.xLegs) {
        // Metabee's leg covers: square shells marked with an X
        leg.add(at(prism(0.3 * lw, 0.32 * lw, 0.3 * lw, 0.32 * lw, 0.26 * k, m.body, 0.03), 0, -0.36 * k, 0));
        for (const r of [0.75, -0.75]) leg.add(at(box(0.025, 0.3 * k, 0.02, m.joint), 0, -0.36 * k, -0.165 * lw, 0, 0, r));
      } else {
        const knee = plate([[-0.13, 0.07], [0.13, 0.07], [0.13, -0.03], [0, -0.11], [-0.13, -0.03]], 0.08, m.trim);
        knee.scale.set(lw, 1, 1);
        leg.add(at(knee, 0, -0.27 * k, -0.15 * lw, -0.3));
        // shin: wider at the ankle than at the knee, cut at the front corners
        leg.add(at(prism(0.36 * lw, 0.38 * lw, 0.28 * lw, 0.3 * lw, 0.2 * k, m.body, [0.07, 0.07, 0.03, 0.03]), 0, -0.37 * k, 0.01));
        ventX(leg, s * 0.165 * lw, -0.44 * k, 0.02, 3, 0.22 * lw, s);
        piston(leg, V(0, -0.2 * k, 0.14 * lw), V(0, -0.42 * k, 0.18 * lw));
        glow(leg, 0.03, 0.16 * k, 0.02, 0, -0.37 * k, -0.19 * lw);
      }
      leg.add(box(0.15 * lw, 0.06, 0.16 * lw, m.joint, 0, -0.475 * k, 0.02)); // ankle
      const sole = -0.54 * k;
      if (L.hover) {
        // no feet: the shins taper off into a glow, as if it doesn't need the floor at all
        leg.add(at(prism(0.15 * lw, 0.16 * lw, 0.08 * lw, 0.08 * lw, 0.08, m.joint, 0.02), 0, -0.53 * k, 0.02, Math.PI));
        leg.add(box(0.07 * lw, 0.05, 0.07 * lw, m.glowMat ?? m.eyeMat, 0, -0.58 * k, 0.02));
      } else {
        // foot: a side-view wedge, low toe and a raised heel block, plus a toe cap and heel spur
        const fl = F.foot;
        leg.add(at(side([[-0.4 * fl, 0], [0.2 * fl, 0], [0.24 * fl, 0.05], [0.15 * fl, 0.12], [-0.12 * fl, 0.13], [-0.4 * fl, 0.045]], 0.4 * lw, m.body), 0, sole, -0.04));
        if (def.feet === 'claw' && !L.megazord) {
          for (const cx of [-0.12, 0, 0.12]) leg.add(at(cone(0.05, 0.16, m.joint), cx * lw, sole + 0.04, -0.47 * fl, -Math.PI / 2));
        } else {
          leg.add(at(side([[-0.42 * fl, 0], [-0.2 * fl, 0], [-0.2 * fl, 0.07], [-0.42 * fl, 0.04]], 0.42 * lw, m.accent), 0, sole, -0.04));
        }
        leg.add(at(side([[0.18, 0], [0.3, 0], [0.24, 0.08], [0.16, 0.08]], 0.2 * lw, m.joint), 0, sole, 0.0)); // heel spur
      }
      this.root.add(leg);
      if (L.hover) {
        // long dangling legs that sway as it drifts, with a jet glowing under each sole
        leg.scale.set(1, HOVER_LEG, 1);
        leg.rotation.x = s === -1 ? -0.14 : 0.2;
        this.dangle.push(leg);
        continue;
      }
      if (L.dynamic) {
        leg.rotation.x = s === -1 ? 0.34 : -0.3;
        leg.position.z = s === -1 ? -0.08 : 0.08;
      }
      this.legs.push(leg);
    }
    if (L.dynamic) this.rest.legs = this.legs.map((l) => l.rotation.x);

    // ---------- waist and skirt ----------
    const tY = hipY + 0.1;
    this.root.add(at(prism(F.waistW, 0.32, F.waistW + 0.06, 0.34, 0.14, def.darkFace ? m.joint : m.accent, 0.05), 0, tY - 0.04, 0));
    // gold trim, or gunmetal on the units that shouldn't shine
    const goldTrim = L.darkCrest ? this.paint(0x45484c) : m.gold;
    this.root.add(box(0.16, 0.14, 0.06, goldTrim, 0, tY - 0.05, -0.18));
    for (const s of [-1, 1]) {
      // front skirt: a pointed plate on each side of the buckle, angled out
      this.root.add(at(plate([[-0.1, 0.06], [0.1, 0.06], [0.1, -0.1], [0, -0.16], [-0.1, -0.08]], 0.05, m.body), s * 0.14, tY - 0.12, -0.2, -0.2, 0, s * 0.08));
      this.root.add(at(prism(0.05, 0.3, 0.05, 0.24, 0.22, m.trim), s * (F.waistW / 2 + 0.06), tY - 0.12, 0, 0, 0, s * 0.25));
    }
    if (L.longSkirt) {
      // long skirt armour: split front plates, side plates and a back plate down to the shins
      // (shorter on a floating unit, so its long legs show beneath)
      const len = hipY * (L.hover ? 0.55 : 0.85);
      const y = tY - 0.1 - len / 2;
      for (const sx of [-1, 1]) {
        const front = plate([[-0.13, len / 2], [0.13, len / 2], [0.12, -len / 2 + 0.06], [0, -len / 2], [-0.12, -len / 2 + 0.06]], 0.05, m.body);
        this.root.add(at(front, sx * 0.14, y, -0.22, -0.12, 0, sx * 0.06));
        this.root.add(at(plate([[-0.02, len / 2], [0.02, len / 2], [0.02, -len / 2 + 0.06], [-0.02, -len / 2 + 0.06]], 0.06, m.accent), sx * 0.14 + sx * 0.1, y, -0.25, -0.12, 0, sx * 0.06));
        this.root.add(at(prism(0.05, 0.36, 0.05, 0.3, len, m.trim, 0.02), sx * (F.waistW / 2 + 0.1), y, 0, 0, 0, sx * 0.14));
      }
      this.root.add(at(plate([[-0.24, len / 2], [0.24, len / 2], [0.2, -len / 2 + 0.04], [-0.2, -len / 2 + 0.04]], 0.05, m.body), 0, y, 0.22, 0.12));
    }
    if (L.shellSkirt) {
      // Metabee's round shell skirt, as a faceted ring of plates
      for (const s of [-1, 1]) this.root.add(at(prism(0.2, 0.36, 0.26, 0.4, 0.16, m.body, 0.06), s * 0.24, tY - 0.12, 0.02, 0, 0, s * 0.35));
    }

    // ---------- torso: a V chest, cut at the front corners ----------
    this.turret.position.y = tY;
    this.turret.rotation.x = L.lean ?? F.lean;
    this.root.add(this.turret);
    const cw = F.chestW;
    const cd = F.chestD;
    // abdomen: three stacked segments, widening up into the chest, the middle one in trim
    for (let q = 0; q < 3; q++) this.turret.add(at(prism(0.34 + q * 0.04, 0.34 + q * 0.03, 0.38 + q * 0.04, 0.37 + q * 0.03, 0.05, q === 1 ? m.trim : m.joint, 0.04), 0, 0.03 + q * 0.055, 0));
    this.turret.add(at(prism(F.chestB, cd * 0.85, cw, cd, 0.38, m.body, [0.12, 0.12, 0.06, 0.06]), 0, 0.35, 0));
    this.turret.add(at(prism(0.48, 0.42, 0.42, 0.36, 0.08, m.joint, 0.06), 0, 0.58, 0)); // collar
    for (const s of [-1, 1]) {
      ventX(this.turret, s * (cw / 2 + 0.005), 0.28, 0.03, 3, cd * 0.6, s);
      glow(this.turret, 0.02, 0.26, cd * 0.7, s * (cw / 2 + 0.01), 0.36, 0);
    }
    // chest: pec plates in a V (or the skull), intakes under them, and the core
    const skull = def.emblem === 'skull';
    const z0 = -cd / 2 - 0.005;
    if (L.megazord) {
      // the pterodactyl breastplate: a broad pink plate edged in gold, its gold beak pointing
      // down the middle and its wings folded up into the collar
      const pink = this.paint(0xf06aa0, 'body');
      const k2 = cw / 0.94;
      this.turret.add(at(plate([[-0.4 * k2, 0.13], [0.4 * k2, 0.13], [0.34 * k2, -0.06], [0.12, -0.16], [-0.12, -0.16], [-0.34 * k2, -0.06]], 0.06, pink), 0, 0.42, z0));
      this.turret.add(at(plate([[-0.42 * k2, 0.16], [0.42 * k2, 0.16], [0.4 * k2, 0.12], [-0.4 * k2, 0.12]], 0.07, m.gold), 0, 0.42, z0 - 0.005));
      const maw = L.gun === 'chestMaw';
      if (!maw) this.turret.add(at(plate([[-0.09, 0.1], [0.09, 0.1], [0, -0.17]], 0.05, m.gold), 0, 0.4, z0 - 0.035));
      for (const sx of [-1, 1]) {
        const wing: [number, number][] = [[0.1, 0.0], [0.36 * k2, 0.08], [0.33 * k2, -0.04], [0.14, -0.1]];
        this.turret.add(at(plate(sx === 1 ? wing : mirrorX(wing), 0.04, m.gold), 0, 0.34, z0 - 0.04));
        this.turret.add(box(0.07, 0.05, 0.02, m.eyeMat, sx * 0.05, 0.47, z0 - 0.065)); // the beak's eyes
      }
      // the red core below (the chest maw takes its place)
      if (!maw) this.turret.add(at(prism(0.42, 0.06, 0.4, 0.06, 0.12, m.body, 0.02), 0, 0.22, z0 + 0.01));
    } else if (!L.ribcage && L.gun !== 'dragonMaw') {
      // layered chest armour, built up like a kit: a frame plate on each side, a raised panel
      // stepped on top of it with an accent edge, a pointed keel down the middle, angled
      // louvred intakes underneath and a glowing core between them
      const k2 = cw / 0.94;
      for (const s of [-1, 1]) {
        const mir = (pts: [number, number][]) => (s === 1 ? pts : mirrorX(pts));
        this.turret.add(at(plate(mir([[0.02 * k2, 0.11], [0.31 * k2, 0.11], [0.28 * k2, -0.05], [0.07 * k2, -0.13]]), 0.05, skull ? m.body : m.trim), 0, 0.42, z0));
        if (!skull) {
          this.turret.add(at(plate(mir([[0.06 * k2, 0.08], [0.27 * k2, 0.08], [0.25 * k2, -0.03], [0.09 * k2, -0.09]]), 0.04, m.body), 0, 0.42, z0 - 0.035));
          this.turret.add(at(plate(mir([[0.09 * k2, -0.1], [0.25 * k2, -0.045], [0.25 * k2, -0.065], [0.09 * k2, -0.12]]), 0.03, m.accent), 0, 0.42, z0 - 0.03));
        }
        const intake = at(new THREE.Group(), s * 0.21, 0.25, z0 - 0.01, 0, 0, s * 0.14);
        intake.add(prism(0.15, 0.05, 0.13, 0.04, 0.11, m.joint, 0.01));
        for (let q = 0; q < 3; q++) intake.add(box(0.12, 0.014, 0.02, def.darkFace ? m.accent : goldTrim, 0, -0.035 + q * 0.033, -0.025));
        this.turret.add(intake);
      }
      if (!skull) this.turret.add(at(plate([[-0.035, 0.12], [0.035, 0.12], [0.03, -0.06], [0, -0.12], [-0.03, -0.06]], 0.05, m.accent), 0, 0.44, z0 - 0.025));
    } else {
      // Megatron: a silver ribcage
      this.turret.add(at(plate([[-0.22, 0.14], [0.22, 0.14], [0.18, -0.12], [0, -0.18], [-0.18, -0.12]], 0.05, silver), 0, 0.38, z0));
      for (let q = 0; q < 4; q++) this.turret.add(box(0.3 - q * 0.04, 0.02, 0.02, m.joint, 0, 0.47 - q * 0.07, z0 - 0.03));
    }
    if (skull) {
      const z = z0 - 0.035;
      const bone = L.boneSkull ? this.paint(0xb5ad98) : white;
      this.turret.add(box(0.32, 0.15, 0.03, bone, 0, 0.47, z), box(0.26, 0.07, 0.03, bone, 0, 0.37, z));
      for (const s of [-1, 1]) this.turret.add(box(0.09, 0.07, 0.02, hole, s * 0.075, 0.43, z - 0.012));
      this.turret.add(box(0.03, 0.04, 0.02, hole, 0, 0.375, z - 0.012));
      for (let q = 0; q < 5; q++) this.turret.add(box(0.036, 0.14, 0.03, bone, -0.1 + q * 0.05, 0.27, z));
    } else if (!L.ribcage && L.gun !== 'dragonMaw' && !L.megazord) {
      // the core: a hex housing with a glowing gem, under the keel
      const hex = (r: number): [number, number][] => [0, 1, 2, 3, 4, 5].map((i) => [Math.cos((i / 6) * Math.PI * 2) * r, Math.sin((i / 6) * Math.PI * 2) * r]);
      this.turret.add(at(plate(hex(0.06), 0.04, m.joint), 0, 0.26, z0 - 0.015));
      this.turret.add(at(plate(hex(0.034), 0.03, m.glowMat ?? m.eyeMat), 0, 0.26, z0 - 0.04));
    }
    // backpack: a deep pack with a raised armour panel and an accent stripe, vernier pods
    // on its sides, and twin thruster bells with a glow in their throats
    const bz = cd / 2;
    this.turret.add(at(prism(0.5, 0.26, 0.44, 0.22, 0.42, m.trim, [0.06, 0.06, 0.04, 0.04]), 0, 0.37, bz + 0.12));
    this.turret.add(at(prism(0.34, 0.06, 0.3, 0.05, 0.3, m.body, 0.03), 0, 0.4, bz + 0.27));
    this.turret.add(box(0.05, 0.3, 0.02, m.accent, 0, 0.4, bz + 0.305));
    for (const s of [-1, 1]) {
      this.turret.add(at(prism(0.1, 0.2, 0.08, 0.17, 0.3, m.body, 0.03), s * 0.29, 0.4, bz + 0.12));
      this.turret.add(box(0.03, 0.2, 0.12, m.joint, s * 0.345, 0.4, bz + 0.12));
      this.turret.add(at(cyl(0.085, 0.16, m.joint), s * 0.14, 0.15, bz + 0.26, Math.PI / 2));
      this.turret.add(at(cyl(0.105, 0.06, m.trim), s * 0.14, 0.15, bz + 0.36, Math.PI / 2));
      this.turret.add(at(cyl(0.07, 0.02, m.glowMat ?? hole), s * 0.14, 0.15, bz + 0.385, Math.PI / 2));
    }

    // the bazooka's placement (in the torso's space), so both hands can reach its grips
    const BAZ_TWIST = 0.75;
    const bazHolder = new THREE.Object3D();
    bazHolder.position.set(0.22, 0.62, -0.1);
    bazHolder.quaternion.setFromEuler(new THREE.Euler(L.lean ?? F.lean, BAZ_TWIST, 0)).invert();
    bazHolder.scale.setScalar(1.35);
    bazHolder.updateMatrix();
    const grip = { front: V(0, -0.2, -0.34).applyMatrix4(bazHolder.matrix), rear: V(0, -0.21, 0.12).applyMatrix4(bazHolder.matrix) };

    // ---------- shoulders and arms, held off the body ----------
    const aw = F.armW;
    const as = F.armS * (L.gorilla ? 1.55 : 1);
    let rightSh: THREE.Group | null = null;
    let rightArm: THREE.Object3D | null = null;
    let leftArm: THREE.Object3D | null = null;
    let leftSh: THREE.Group | null = null;
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(s * F.shOut, 0.44, 0);
      // the gorilla swings its long arms forward, knuckles toward the floor
      // the tail blade is swung back behind the attacking stance
      if (L.dynamic && L.left === 'tailBlade' && s === -1) sh.rotation.x = 0.5;
      const style = s === -1 ? (L.shoulderL ?? L.shoulder) : L.shoulder;
      if (style === 'heavy') {
        sh.add(at(prism(0.46, 0.54, 0.5, 0.58, 0.38, m.body, 0.08), s * 0.04, 0, 0, 0, 0, s * -0.12));
        sh.add(at(prism(0.52, 0.6, 0.46, 0.54, 0.07, m.trim, 0.08), s * 0.05, 0.22, 0, 0, 0, s * -0.12));
        ventX(sh, s * 0.3, -0.1, 0, 3, 0.36, s);
      } else if (style === 'stepped') {
        sh.add(at(prism(0.4, 0.46, 0.36, 0.42, 0.2, m.body, 0.07), s * 0.03, -0.04, 0));
        sh.add(at(prism(0.34, 0.4, 0.28, 0.34, 0.14, m.trim, 0.06), s * 0.03, 0.13, 0));
        ventX(sh, s * 0.215, -0.1, 0, 2, 0.3, s);
      } else if (style === 'shield') {
        // Zaku's round right shoulder shield, faceted
        sh.add(at(prism(0.42, 0.5, 0.36, 0.44, 0.36, m.body, 0.12), s * 0.08, -0.02, 0, 0, 0, s * -0.3));
        sh.add(box(0.03, 0.3, 0.36, m.trim, s * 0.27, -0.04, 0));
      } else {
        // the wedge: wider at the top, tipped out
        sh.add(at(prism(0.3, 0.42, 0.42, 0.48, 0.32, m.body, 0.06), s * 0.04, 0.0, 0, 0, 0, s * -0.22));
        sh.add(at(prism(0.44, 0.5, 0.4, 0.46, 0.06, m.trim, 0.05), s * 0.08, 0.18, 0, 0, 0, s * -0.22));
        ventX(sh, s * 0.25, -0.08, 0, 3, 0.3, s);
      }
      if (style === 'spike') for (const sz of [-0.11, 0.11]) sh.add(at(cone(0.07, 0.36, m.joint), s * 0.24, 0.16, sz, 0, 0, -s * 1.15));
      if (L.pods && style !== 'shield') {
        // missile pods on top of the shoulder
        sh.add(at(prism(0.22, 0.3, 0.22, 0.3, 0.14, m.joint, 0.03), s * 0.06, 0.3, 0));
        for (const x of [-0.05, 0.05]) for (const z of [-0.07, 0.07]) sh.add(box(0.04, 0.02, 0.04, hole, s * 0.06 + x, 0.375, z));
      }
      const twoHand = L.pose === 'twoHand';
      const bazooka = L.pose === 'bazooka' && s === 1;
      const centre = L.pose === 'centerAim' && s === 1;
      // the off hand raised on guard (or with the knife ready), and the gorilla's planted arms
      const dual = L.pose === 'dualAim';
      const guard = s === -1 && L.dynamic && !dual && (!L.left || L.left === 'claw');
      const knuckle = !!L.gorilla;
      const aiming = (L.pose === 'aim' && s === 1) || dual || twoHand || bazooka || centre || guard || knuckle;
      if (aiming) {
        // straight out at the target; with both hands, each arm turns in to meet at the gun;
        // with the bazooka, each arm is aimed (and stretched) so its fist closes on a grip:
        // the right on the trigger grip, the left across the chest on the front grip
        let ag: THREE.Object3D = sh;
        if (twoHand || centre) ag = at(new THREE.Group(), 0, 0, 0, 0, s * 0.62, 0);
        // a sword arm swings on its own inside the shoulder armour
        if (L.gun === 'slashSword' && s === 1) ag = new THREE.Group();
        if (guard) {
          // forearm up and in, the fist in front of the chest
          ag = new THREE.Group();
          ag.rotation.order = 'YXZ';
          ag.rotation.set(0.5, -0.45, 0);
          ag.scale.z = 0.78;
        }
        if (knuckle) {
          // reach down and forward until the knuckles rest on the floor ahead
          const torso = new THREE.Object3D();
          torso.position.set(0, tY, 0);
          torso.rotation.set(L.lean ?? F.lean, 0, 0);
          torso.updateMatrix();
          const floor = V(s * (F.shOut + 0.08), 0.13, -0.78).applyMatrix4(torso.matrix.clone().invert());
          const t = floor.sub(sh.position);
          const dist = t.length();
          const len = Math.sqrt(Math.max(0.01, dist * dist - 0.14 * 0.14));
          ag = new THREE.Group();
          ag.rotation.order = 'YXZ';
          ag.rotation.y = Math.atan2(-t.x, -t.z);
          ag.rotation.x = Math.atan2(t.y, Math.hypot(t.x, t.z)) + Math.atan2(0.14, len);
          ag.scale.z = len / 0.74;
        }
        if (bazooka) {
          const t = (s === 1 ? grip.rear : grip.front).clone().sub(sh.position);
          const dist = t.length();
          const len = Math.sqrt(Math.max(0.01, dist * dist - 0.14 * 0.14));
          ag = new THREE.Group();
          ag.rotation.order = 'YXZ';
          ag.rotation.y = Math.atan2(-t.x, -t.z);
          ag.rotation.x = Math.atan2(t.y, Math.hypot(t.x, t.z)) + Math.atan2(0.14, len);
          ag.scale.z = len / 0.74;
        }
        if (ag !== sh) sh.add(ag);
        ag.add(at(prism(0.15 * aw, 0.15 * aw, 0.15 * aw, 0.15 * aw, 0.2, m.joint, 0.03), 0, -0.14, -0.16, -Math.PI / 2));
        piston(ag, V(s * 0.1, -0.06, -0.08), V(s * 0.1, -0.08, -0.44));
        const g = at(prism(0.22 * aw, 0.24 * aw, 0.27 * aw, 0.28 * aw, 0.3, def.darkFace ? m.trim : m.body, [0.04, 0.04, 0.04, 0.04]), 0, -0.14, -0.5, -Math.PI / 2);
        ag.add(g);
        ventX(ag, s * 0.15 * aw, -0.2, -0.5, 2, 0.2, s);
        ag.add(at(prism(0.29 * aw, 0.3 * aw, 0.29 * aw, 0.3 * aw, 0.05, m.accent, 0.03), 0, -0.14, -0.36, -Math.PI / 2));
        ag.add(box(0.22 * aw, 0.22 * aw, 0.2, m.joint, 0, -0.14, -0.74)); // fist
        if (s === 1) rightArm = ag;
        else leftArm = ag;
        if (knuckle) ag.add(box(0.3 * aw, 0.24 * aw, 0.26, m.joint, 0, -0.14, -0.78)); // big knuckles
      } else {
        // hanging: slim upper arm, elbow piston, a gauntlet that widens toward the fist
        sh.add(at(prism(0.13 * aw, 0.13 * aw, 0.15 * aw, 0.15 * aw, 0.16 * as, m.joint, 0.03), s * 0.02, -0.24 * as, -0.02));
        piston(sh, V(s * 0.09, -0.17 * as, 0.04), V(s * 0.1, -0.33 * as, -0.08));
        const g = at(prism(0.27 * aw, 0.3 * aw, 0.22 * aw, 0.24 * aw, 0.28 * as, def.darkFace ? m.trim : m.body, [0.04, 0.04, 0.04, 0.04]), 0, -0.38 * as, -0.1, -0.45);
        sh.add(g);
        ventX(g, s * 0.13 * aw, -0.06, 0, 3, 0.2, s);
        g.add(at(prism(0.24 * aw, 0.26 * aw, 0.25 * aw, 0.27 * aw, 0.05, m.accent, 0.03), 0, 0.12 * as, 0));
        glow(g, 0.02, 0.2, 0.02, 0, 0, -0.14 * aw);
        sh.add(box(0.2 * aw, 0.2, 0.2 * aw, m.joint, -s * 0.04, -0.52 * as, -0.22)); // fist
      }
      this.turret.add(sh);
      if (s === 1) rightSh = sh;
      else leftSh = sh;
      // a wind-up puncher thrusts both whole arms forward before each shot
      if (def.special?.windup) {
        this.punchArms.push(sh);
        this.punchRest.push(sh.rotation.x);
      }
    }
    // where the right fist is, in its shoulder's space
    const fist = L.pose === 'aim' ? V(0, -0.14, -0.74) : V(-0.04, -0.52 * as, -0.22);

    // ---------- the gun ----------
    const gun = this.barrel;
    const mark = (x: number, y: number, z: number) => this.markBelly(gun, x, y, z);
    const tube = (r: number, len: number, mat: THREE.Material, x: number, y: number, z: number) => gun.add(at(cyl(r, len, mat), x, y, z, Math.PI / 2));
    const inHand = () => {
      gun.scale.setScalar(1.25);
      if (L.pose === 'twoHand') {
        // both fists meet on the grip at the centre of the chest
        gun.position.set(0, 0.3, -0.6);
        this.turret.add(gun);
        return;
      }
      if (L.pose === 'centerAim' && rightArm) {
        // in the fist of the arm thrust forward to the middle
        gun.position.set(0, -0.14, -0.78);
        rightArm.add(gun);
        return;
      }
      gun.position.copy(fist);
      rightSh!.add(gun);
    };
    switch (L.gun) {
      case 'beamRifle': {
        inHand();
        gun.add(at(prism(0.11, 0.42, 0.11, 0.4, 0.14, m.trim, 0.03), 0, 0.02, -0.12));
        gun.add(box(0.06, 0.1, 0.12, m.joint, 0, -0.08, 0.05)); // grip
        gun.add(box(0.05, 0.06, 0.16, m.accent, 0, 0.11, -0.14)); // scope
        tube(0.03, 0.26, m.joint, 0, 0.03, -0.44);
        tube(0.045, 0.06, m.trim, 0, 0.03, -0.57);
        mark(0, 0.03, -0.62);
        break;
      }
      case 'sniper': {
        inHand();
        gun.add(at(prism(0.1, 0.5, 0.1, 0.48, 0.13, m.joint, 0.02), 0, 0.02, -0.14));
        gun.add(box(0.08, 0.13, 0.22, m.joint, 0, -0.02, 0.22)); // stock
        gun.add(box(0.07, 0.07, 0.24, m.trim, 0, 0.13, -0.12)); // long scope
        gun.add(box(0.05, 0.05, 0.02, m.eyeMat, 0, 0.13, -0.245));
        tube(0.026, 0.46, m.joint, 0, 0.03, -0.62);
        gun.add(box(0.06, 0.06, 0.06, m.trim, 0, 0.03, -0.86));
        mark(0, 0.03, -0.9);
        break;
      }
      case 'magnum': {
        inHand();
        gun.add(at(prism(0.13, 0.5, 0.15, 0.5, 0.18, m.body, 0.04), 0, 0.03, -0.14));
        gun.add(at(prism(0.12, 0.16, 0.12, 0.12, 0.12, m.accent, 0.02), 0, -0.08, -0.04)); // e-pac
        gun.add(box(0.06, 0.1, 0.12, m.joint, 0, -0.12, 0.08));
        tube(0.045, 0.3, m.joint, 0, 0.04, -0.52);
        tube(0.06, 0.06, m.trim, 0, 0.04, -0.68);
        mark(0, 0.04, -0.73);
        break;
      }
      case 'drumMG': {
        inHand();
        gun.add(box(0.12, 0.15, 0.44, m.joint, 0, 0.04, -0.08));
        gun.add(box(0.08, 0.14, 0.18, m.joint, 0, 0.02, 0.22));
        gun.add(box(0.125, 0.03, 0.3, m.accent, 0, 0.1, -0.1));
        if (L.left !== 'ammoDrum') gun.add(at(cyl(0.11, 0.08, m.trim), -0.1, 0.02, 0.0, 0, 0, Math.PI / 2));
        else gun.add(box(0.06, 0.1, 0.12, m.trim, -0.09, 0.02, 0.02)); // the belt's feed port
        tube(0.032, 0.3, m.joint, 0, 0.04, -0.45);
        gun.add(box(0.08, 0.08, 0.08, m.trim, 0, 0.04, -0.62));
        mark(0, 0.04, -0.68);
        break;
      }
      case 'hmg': {
        // a huge heavy machine gun: boxy receiver, carry handle, side ammo box, a perforated
        // barrel shroud and a muzzle brake, belt-fed from the pack on the back
        inHand();
        gun.add(at(prism(0.2, 0.62, 0.2, 0.58, 0.22, m.joint, 0.04), 0, 0.02, -0.16));
        gun.add(box(0.04, 0.05, 0.26, m.trim, 0, 0.17, -0.12), box(0.04, 0.06, 0.04, m.trim, 0, 0.14, -0.22), box(0.04, 0.06, 0.04, m.trim, 0, 0.14, -0.02));
        gun.add(at(prism(0.16, 0.22, 0.16, 0.2, 0.2, m.accent, 0.03), -0.17, -0.04, -0.1));
        gun.add(box(0.1, 0.16, 0.14, m.joint, 0, -0.14, 0.04)); // grip
        tube(0.075, 0.42, m.trim, 0, 0.02, -0.66);
        for (let q = 0; q < 4; q++) gun.add(box(0.05, 0.02, 0.05, hole, 0, 0.1, -0.52 - q * 0.08));
        tube(0.036, 0.22, m.joint, 0, 0.02, -0.96);
        gun.add(at(prism(0.1, 0.1, 0.09, 0.09, 0.1, m.joint, 0.02), 0, 0.02, -1.08, Math.PI / 2));
        mark(0, 0.02, -1.14);
        break;
      }
      case 'dober': {
        // Tallgeese's Dober gun: a long cannon riding on the right shoulder, gripped below
        gun.position.set(0.02, 0.32, -0.04);
        gun.scale.setScalar(1.15);
        rightSh!.add(gun);
        gun.add(at(prism(0.2, 0.56, 0.18, 0.52, 0.2, m.trim, 0.05), 0, 0, 0.0));
        gun.add(at(prism(0.16, 0.24, 0.14, 0.22, 0.16, m.accent, 0.03), 0, 0.02, 0.32)); // energy pack
        tube(0.07, 0.62, m.joint, 0, 0.0, -0.56);
        tube(0.09, 0.08, m.trim, 0, 0.0, -0.84);
        gun.add(box(0.04, 0.24, 0.06, m.joint, 0, -0.18, -0.08)); // grip down to the hand
        mark(0, 0, -0.92);
        break;
      }
      case 'palm': {
        // the right hand thrust forward and spread open; the marble leaves the palm
        const hand = rightArm ?? rightSh!;
        gun.position.set(0, -0.14, -0.86);
        hand.add(gun);
        gun.add(box(0.24, 0.24, 0.06, m.joint, 0, 0, 0.0)); // palm
        gun.add(at(cyl(0.07, 0.02, m.glowMat ?? m.accent), 0, 0, -0.035, Math.PI / 2)); // glowing palm core
        for (let q = 0; q < 4; q++) {
          // four fingers fanned out, plus the thumb
          const a = -0.5 + q * 0.33;
          gun.add(at(box(0.045, 0.16, 0.045, m.joint), Math.sin(a) * 0.1, 0.1 + Math.cos(a) * 0.08, -0.02, 0.2, 0, -a));
        }
        gun.add(at(box(0.045, 0.13, 0.045, m.joint), -0.14, -0.06, -0.02, 0.2, 0, 1.1));
        mark(0, 0, -0.08);
        break;
      }
      case 'shellCannon': {
        // Blastoise: cannons rising out of the shell over the shoulders (one over each with
        // twin barrels, each firing its own marble), kept level against the hunch
        const holder = at(new THREE.Group(), def.twin ? 0 : 0.34, 0.9, cd / 2 - 0.02, -(L.lean ?? F.lean));
        this.turret.add(holder);
        holder.add(gun);
        for (const x of def.twin ? [-TWIN_X, TWIN_X] : [0]) {
          gun.add(at(prism(0.26, 0.4, 0.24, 0.36, 0.24, m.trim, 0.06), x, 0, 0.12)); // mount
          gun.add(at(cyl(0.11, 0.9, m.joint), x, 0.02, -0.36, Math.PI / 2));
          gun.add(at(cyl(0.15, 0.14, m.trim), x, 0.02, -0.82, Math.PI / 2));
          gun.add(at(cyl(0.1, 0.02, hole), x, 0.02, -0.9, Math.PI / 2));
          for (const z of [-0.1, -0.5]) gun.add(at(cyl(0.125, 0.04, m.accent), x, 0.02, z, Math.PI / 2));
        }
        mark(0, 0.02, -0.93);
        break;
      }
      case 'staffGun': {
        // a long gun-staff pointed down the lane: the muzzle at its tip, a crescent blade
        // slung under the front like a bayonet
        inHand();
        gun.add(at(cyl(0.028, 1.5, m.joint), 0, 0, -0.25, Math.PI / 2));
        gun.add(at(cyl(0.05, 0.24, m.trim), 0, 0, -0.98, Math.PI / 2));
        gun.add(at(cyl(0.065, 0.04, m.glowMat ?? m.accent), 0, 0, -0.86, Math.PI / 2));
        gun.add(at(cyl(0.035, 0.02, hole), 0, 0, -1.105, Math.PI / 2));
        gun.add(at(side([[-0.62, 0], [-0.98, -0.04], [-1.14, -0.24], [-0.86, -0.12], [-0.6, -0.08]], 0.03, m.glowMat ?? m.accent), 0, -0.02, 0));
        gun.add(at(box(0.08, 0.1, 0.12, m.trim), 0, 0, 0.46)); // butt cap
        mark(0, 0, -1.12);
        break;
      }
      case 'bazooka': {
        // a huge bazooka on the right shoulder, the body turned side-on behind it. The holder
        // turns back against the body's twist so the tube points down the lane; the marble
        // leaves the muzzle and the tube recoils along itself
        const twist = BAZ_TWIST;
        this.rest.turretY = twist;
        this.turret.rotation.y = twist; // previews never sync, so set the twist now too
        const holder = new THREE.Group();
        holder.position.copy(bazHolder.position);
        holder.quaternion.copy(bazHolder.quaternion);
        holder.scale.copy(bazHolder.scale);
        this.turret.add(holder);
        holder.add(gun);
        gun.position.set(0, 0, 0);
        const gm = this.paint(0x4a5058);
        gun.add(at(cyl(0.13, 1.3, m.trim), 0, 0, -0.05, Math.PI / 2));
        gun.add(at(cyl(0.17, 0.16, gm), 0, 0, -0.74, Math.PI / 2)); // muzzle flare
        gun.add(at(cyl(0.12, 0.02, hole), 0, 0, -0.83, Math.PI / 2));
        gun.add(at(cyl(0.15, 0.14, gm), 0, 0, 0.64, Math.PI / 2)); // exhaust
        for (const z of [-0.36, 0.2]) gun.add(at(cyl(0.142, 0.05, m.accent), 0, 0, z, Math.PI / 2));
        gun.add(box(0.07, 0.1, 0.22, gm, 0.14, 0.12, -0.2)); // sight
        gun.add(box(0.05, 0.05, 0.05, m.eyeMat, 0.14, 0.12, -0.32));
        gun.add(box(0.06, 0.2, 0.08, gm, 0, -0.18, -0.38)); // front grip
        gun.add(box(0.06, 0.22, 0.1, gm, 0, -0.19, 0.12)); // trigger grip
        gun.add(box(0.18, 0.06, 0.3, m.joint, -0.1, -0.12, 0.02)); // shoulder rest
        mark(0, 0, -0.86);
        break;
      }
      case 'pallet': {
        inHand();
        const gm = this.paint(0x5d646e);
        gun.add(box(0.13, 0.15, 0.5, gm, 0, -0.02, -0.12));
        gun.add(box(0.1, 0.16, 0.2, gm, 0, -0.04, 0.22));
        gun.add(box(0.06, 0.16, 0.08, black, 0, -0.16, -0.1));
        gun.add(box(0.135, 0.03, 0.2, m.accent, 0, 0.0, -0.22));
        tube(0.035, 0.3, black, 0, -0.02, -0.47);
        mark(0, -0.02, -0.64);
        break;
      }
      case 'gatling': {
        inHand();
        gun.add(at(prism(0.24, 0.34, 0.22, 0.3, 0.22, m.joint, 0.05), 0, 0.02, -0.04));
        gun.add(at(cyl(0.12, 0.08, m.accent), 0, 0.02, -0.2, Math.PI / 2));
        for (let q = 0; q < 6; q++) {
          const a = (q / 6) * Math.PI * 2;
          tube(0.026, 0.36, black, Math.cos(a) * 0.07, 0.02 + Math.sin(a) * 0.07, -0.38);
        }
        gun.add(at(cyl(0.11, 0.04, m.accent), 0, 0.02, -0.56, Math.PI / 2));
        mark(0, 0.02, -0.6);
        break;
      }
      case 'fistCannon': {
        // Metabee's twin cannon over the thrown fist
        gun.position.copy(fist).add(V(0, 0.16, 0.12));
        rightSh!.add(gun);
        gun.add(at(prism(0.28, 0.3, 0.26, 0.28, 0.15, m.body, 0.05), 0, 0, 0));
        gun.add(box(0.3, 0.03, 0.32, m.trim, 0, -0.07, 0));
        for (const x of [-0.07, 0.07]) {
          tube(0.055, 0.1, m.trim, x, 0, -0.19);
          tube(0.035, 0.02, hole, x, 0, -0.245);
        }
        mark(0, 0, -0.27);
        if (L.pose === 'dualAim') {
          // the same cannon on the left fist, with its own muzzle
          const g2 = gun.clone();
          g2.position.copy(gun.position);
          leftSh!.add(g2);
          this.barrel2 = g2;
          this.bellyMarkL = g2.children[gun.children.indexOf(this.bellyMark!)] ?? null;
        }
        break;
      }
      case 'rexFist': {
        // Megatron: the T-rex head on the right fist is the gun, its jaw snapping on each shot
        inHand();
        gun.scale.setScalar(1.4);
        const pink = this.paint(0xc8506a);
        const red = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
        gun.add(at(prism(0.32, 0.4, 0.28, 0.36, 0.28, m.body, [0.06, 0.06, 0.03, 0.03]), 0, 0.04, -0.08));
        gun.add(at(prism(0.28, 0.3, 0.22, 0.28, 0.16, m.body, [0.07, 0.07, 0.02, 0.02], -0.02), 0, 0, -0.32));
        gun.add(box(0.2, 0.03, 0.28, pink, 0, -0.07, -0.3));
        for (const s of [-1, 1]) {
          gun.add(box(0.07, 0.05, 0.05, red, s * 0.15, 0.1, -0.16));
          gun.add(at(prism(0.1, 0.18, 0.06, 0.14, 0.05, m.trim), s * 0.11, 0.19, -0.16, 0, 0, s * 0.35));
          for (let q = 0; q < 4; q++) gun.add(at(cone(0.02, 0.07, white), s * 0.1, -0.09, -0.42 + q * 0.07, Math.PI));
        }
        const jaw = new THREE.Group();
        jaw.position.set(0, -0.08, -0.06);
        jaw.add(at(prism(0.24, 0.36, 0.2, 0.3, 0.07, m.body, 0.04), 0, -0.03, -0.2));
        gun.add(jaw);
        this.jaw = jaw;
        mark(0, -0.04, -0.48);
        break;
      }
      case 'dragonMaw': {
        // Wyvern: a dragon's head on the chest is the gun: a horned skull, a long snout, an
        // open jaw full of teeth, and the marble roaring out of its mouth
        gun.position.set(0, 0.38, -cd / 2 - 0.02);
        gun.scale.setScalar(1.8);
        this.turret.add(gun);
        // a gunmetal-black head with gold horns and slit red eyes: no brows, no nostrils
        const skin = this.paint(0x2a2c33, 'metal');
        const fang = this.paint(0xc8ccd2, 'metal');
        const ember = new THREE.MeshBasicMaterial({ color: 0xff3018 });
        gun.add(at(prism(0.32, 0.3, 0.26, 0.24, 0.2, skin, [0.06, 0.06, 0.03, 0.03]), 0, 0.06, -0.08));
        gun.add(at(side([[0.0, 0.02], [-0.34, 0.0], [-0.4, -0.04], [-0.36, -0.08], [0.0, -0.1]], 0.24, skin), 0, 0.04, -0.1));
        // a ridge of gold spikes down the skull
        for (let q = 0; q < 3; q++) gun.add(at(cone(0.03, 0.12 - q * 0.02, m.accent), 0, 0.17 - q * 0.01, -0.12 + q * 0.1, -0.5));
        // the lower jaw on a hinge at the back of the mouth: it gapes wide on every shot
        const jaw = at(new THREE.Group(), 0, -0.06, -0.02);
        gun.add(jaw);
        this.jaw = jaw;
        jaw.add(at(side([[0.0, 0.0], [-0.3, -0.02], [-0.32, -0.06], [0.0, -0.07]], 0.2, m.body), 0, -0.02, -0.1, 0.28));
        gun.add(at(box(0.16, 0.04, 0.24, hole), 0, -0.05, -0.32)); // the throat
        gun.add(at(box(0.1, 0.03, 0.14, new THREE.MeshBasicMaterial({ color: 0xff7a1a })), 0, -0.05, -0.36)); // fire glowing deep in it
        for (const s of [-1, 1]) {
          gun.add(at(box(0.1, 0.028, 0.03, ember), s * 0.09, 0.12, -0.2, 0, 0, s * 0.45)); // slit eye, slanted down to the snout
          gun.add(at(cone(0.045, 0.36, m.accent), s * 0.12, 0.2, 0.06, 1.05, 0, -s * 0.25)); // horn swept back
          gun.add(at(cone(0.03, 0.18, m.accent), s * 0.15, 0.02, 0.0, 1.3, 0, -s * 0.9)); // cheek spike
          for (let q = 0; q < 4; q++) gun.add(at(cone(0.018, 0.06, fang), s * 0.08, -0.03, -0.44 + q * 0.07, Math.PI)); // upper teeth
          for (let q = 0; q < 3; q++) jaw.add(at(cone(0.016, 0.05, fang), s * 0.07, -0.04, -0.34 + q * 0.07)); // lower teeth
        }
        mark(0, -0.04, -0.56);
        break;
      }
      case 'slashSword': {
        // the katana raised in the right fist, the blade angled up over the shoulder; the
        // marble leaves from in front of the chest, where the slash cuts
        gun.position.copy(fist);
        rightArm!.add(gun);
        gun.add(box(0.06, 0.07, 0.24, m.trim, 0, 0, 0.02)); // grip, wrapped
        gun.add(box(0.16, 0.12, 0.04, m.gold, 0, 0, -0.1)); // guard
        const blade = at(new THREE.Group(), 0, 0, -0.12, 2.16);
        blade.add(at(plate([[-0.03, 0], [0.035, 0], [0.035, -1.0], [-0.03, -1.12]], 0.024, this.paint(0xe8ecf0, 'metal')), 0, 0, 0));
        blade.add(at(plate([[0.022, -0.02], [0.035, -0.02], [0.035, -0.98], [0.022, -0.98]], 0.03, m.accent), 0, 0, 0)); // the glowing edge
        gun.add(blade);
        rightArm!.rotation.x = 1.05;
        this.slashArm = rightArm;
        this.rest.slash = rightArm!.rotation.x;
        this.markBelly(this.turret, 0, 0.42, -0.85);
        break;
      }
      case 'chestMaw': {
        // a toothed maw in the breastplate: fangs along the top, a hinged lower jaw that snaps
        // open on each shot, and fire glowing in the throat
        gun.position.set(0, 0.27, -cd / 2 - 0.05);
        this.turret.add(gun);
        const fang = this.paint(0xeef0f2, 'trim');
        gun.add(box(0.36, 0.13, 0.06, hole, 0, -0.03, 0.02)); // the mouth
        gun.add(box(0.2, 0.05, 0.02, new THREE.MeshBasicMaterial({ color: 0xff7a1a }), 0, -0.04, 0.03)); // fire in the throat
        gun.add(at(plate([[-0.22, 0.05], [0.22, 0.05], [0.2, 0.0], [-0.2, 0.0]], 0.07, m.gold), 0, 0.03, -0.01)); // upper lip
        for (let q = 0; q < 5; q++) gun.add(at(cone(0.022, 0.07, fang), -0.14 + q * 0.07, -0.005, -0.03, Math.PI));
        const jaw = at(new THREE.Group(), 0, -0.09, 0.03);
        gun.add(jaw);
        this.jaw = jaw;
        jaw.add(at(plate([[-0.2, 0.0], [0.2, 0.0], [0.16, -0.06], [-0.16, -0.06]], 0.07, m.gold), 0, 0, -0.04));
        for (let q = 0; q < 4; q++) jaw.add(at(cone(0.02, 0.06, fang), -0.105 + q * 0.07, 0.03, -0.06));
        mark(0, -0.03, -0.08);
        break;
      }
      case 'mouth':
        break; // the lizard's head carries it
      default: {
        // a compact chest cannon
        gun.position.set(0, 0.18, -cd / 2 - 0.02);
        this.turret.add(gun);
        tube(0.09, 0.22, m.joint, 0, 0, -0.06);
        tube(0.115, 0.05, def.darkFace ? m.accent : m.gold, 0, 0, -0.17);
        tube(0.06, 0.02, hole, 0, 0, -0.2);
        mark(0, 0, -0.22);
      }
    }
    this.barrelZ = gun.position.z;
    if (L.gun === 'bazooka') this.barrelZ = 0;

    // ---------- the left hand: shields, scythe, claw, tail blade ----------
    const lh = leftSh!;
    const lfist = V(0.04, -0.52 * as, -0.22);
    let drumFeed: THREE.Object3D | null = null;
    switch (L.left) {
      case 'ammoDrum': {
        // a huge drum magazine carried in the hanging left fist
        const drum = at(new THREE.Group(), lfist.x - 0.04, lfist.y - 0.2, lfist.z - 0.04);
        // an octagonal drum (faceted, like the rest of the kit): dark end caps, a gold band
        const oct = (r: number): [number, number][] => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [Math.cos((i / 8) * Math.PI * 2 + Math.PI / 8) * r, Math.sin((i / 8) * Math.PI * 2 + Math.PI / 8) * r]);
        drum.add(side(oct(0.3), 0.3, m.trim));
        for (const x of [-0.16, 0.16]) drum.add(at(side(oct(0.27), 0.03, m.joint), x, 0, 0));
        drum.add(side(oct(0.31), 0.06, m.accent));
        for (const x of [-0.18, 0.18]) drum.add(at(side(oct(0.1), 0.03, m.accent), x, 0, 0)); // hub caps
        drum.add(box(0.08, 0.14, 0.1, m.joint, 0, 0.27, 0)); // carry handle, under the fist
        drum.add(box(0.1, 0.1, 0.12, m.joint, 0.06, 0.12, -0.24)); // feed throat
        drumFeed = at(new THREE.Object3D(), 0.06, 0.14, -0.3);
        drum.add(drumFeed);
        drum.scale.setScalar(1.3);
        lh.add(drum);
        break;
      }
      case 'powerSword': {
        // the power sword held ready in the hanging left fist, the blade angled up and forward
        const sw = at(new THREE.Group(), lfist.x, lfist.y, lfist.z, -(L.lean ?? F.lean) - 0.75);
        const blade = this.paint(0xeef1f4, 'trim');
        sw.add(box(0.07, 0.2, 0.07, black, 0, -0.06, 0)); // grip
        sw.add(box(0.07, 0.06, 0.07, m.gold, 0, -0.18, 0)); // pommel
        sw.add(at(plate([[-0.16, 0.03], [0.16, 0.03], [0.12, -0.03], [-0.12, -0.03]], 0.09, m.gold), 0, 0.06, 0)); // guard
        sw.add(at(plate([[-0.07, 0], [0.07, 0], [0.06, 0.9], [0, 1.04], [-0.06, 0.9]], 0.03, blade), 0, 0.09, 0));
        sw.add(at(plate([[-0.012, 0], [0.012, 0], [0.012, 0.86], [-0.012, 0.86]], 0.03, m.gold), 0, 0.1, 0)); // fuller
        lh.add(sw);
        break;
      }
      case 'shield': {
        const sh = plate([[-0.16, 0.24], [0.16, 0.24], [0.16, -0.12], [0, -0.3], [-0.16, -0.12]], 0.05, m.body);
        lh.add(at(sh, -0.17, -0.4 * as, -0.04, 0, Math.PI / 2 - 0.15, 0));
        // a plain band across the top (no emblem)
        lh.add(at(plate([[-0.14, 0.04], [0.14, 0.04], [0.14, -0.02], [-0.14, -0.02]], 0.06, m.accent), -0.2, -0.22 * as, -0.04, 0, Math.PI / 2 - 0.15));
        break;
      }
      case 'tower': {
        // a tall guardian shield with a plain rim
        lh.add(at(prism(0.06, 0.46, 0.06, 0.42, 0.74, m.body, [0.0, 0.0, 0.0, 0.0]), -0.18, -0.36, -0.06, 0, 0, 0.05));
        lh.add(at(box(0.07, 0.06, 0.44, m.trim), -0.22, 0.0, -0.06));
        break;
      }
      case 'knife': {
        // a progressive knife held low in the hanging left fist, the blade pointing down
        // tipped forward to undo the hunch, so the blade points down and a little ahead
        const k = at(new THREE.Group(), lfist.x, lfist.y - 0.08, lfist.z, -(L.lean ?? F.lean) + 0.25);
        k.add(box(0.06, 0.14, 0.06, m.joint, 0, 0.02, 0));
        k.add(box(0.12, 0.03, 0.1, m.accent, 0, -0.06, 0));
        k.add(at(plate([[-0.035, 0], [0.035, 0], [0.028, -0.4], [-0.035, -0.3]], 0.024, this.paint(0xd8dde4, 'metal')), 0, -0.075, 0));
        lh.add(k);
        break;
      }
      case 'scythe': {
        const pole = at(cyl(0.025, 1.6, m.joint), lfist.x, lfist.y + 0.3, lfist.z);
        lh.add(pole);
        // a crescent blade facing the camera, sweeping out to the side
        const blade = plate([[0, 0.04], [-0.6, 0.16], [-0.78, -0.04], [-0.52, 0.02], [-0.04, -0.1]], 0.04, m.glowMat ?? m.accent);
        lh.add(at(blade, lfist.x, lfist.y + 1.06, lfist.z));
        lh.add(at(box(0.07, 0.12, 0.07, m.trim), lfist.x, lfist.y + 1.08, lfist.z));
        break;
      }
      case 'claw': {
        // three talons: on the raised guard fist they point at the enemy, otherwise down
        if (leftArm) for (const dx of [-0.07, 0, 0.07]) leftArm.add(at(cone(0.04, 0.26, m.trim), dx, -0.14, -0.94, -Math.PI / 2));
        else for (const dx of [-0.07, 0, 0.07]) lh.add(at(cone(0.035, 0.2, m.trim), lfist.x + dx, lfist.y - 0.16, lfist.z - 0.06, Math.PI - 0.3));
        break;
      }
      case 'katana': {
        // Astray Red Frame's sword, gripped low in the left hand, the long blade angled forward
        const sword = at(new THREE.Group(), lfist.x, lfist.y, lfist.z, -0.95, 0, 0);
        sword.add(box(0.05, 0.22, 0.05, m.trim, 0, 0.02, 0)); // grip
        sword.add(box(0.12, 0.03, 0.1, m.accent, 0, -0.1, 0)); // guard
        sword.add(at(plate([[-0.025, 0], [0.03, 0], [0.03, -0.95], [-0.025, -1.05]], 0.02, this.paint(0xdfe3e8, 'metal')), 0, -0.11, 0));
        lh.add(sword);
        break;
      }
      case 'tailBlade': {
        const segs: [number, number, number, number][] = [
          [0.5, 0.0, 0.32, 0.3],
          [0.22, -0.02, 0.3, 0.12],
          [-0.08, -0.03, 0.26, 0],
          [-0.36, -0.02, 0.2, -0.14],
          [-0.6, 0.0, 0.13, -0.32],
        ];
        for (const [y, z, w, rz] of segs) {
          const g = at(new THREE.Group(), -0.18, y, lfist.z + z, 0, 0, rz);
          g.add(prism(w * 0.7, w * 1.2, w * 0.6, w * 1.1, 0.34, m.body, 0.03));
          g.add(at(box(0.04, 0.32, w * 1.0, silver), -w * 0.38, 0, 0));
          g.add(at(cone(0.04 + w * 0.1, 0.12 + w * 0.3, m.trim), w * 0.4, 0, 0, 0, 0, -Math.PI / 2));
          lh.add(g);
        }
        break;
      }
    }

    // ---------- the back: wings, sabers, cape, radio, ammo drum ----------
    this.wings.position.set(0, 0.42, cd / 2 + 0.2);
    this.turret.add(this.wings);
    this.wingR.position.x = 0.12;
    this.wingL.position.x = -0.12;
    this.wingL.scale.x = -1;
    this.wings.add(this.wingL, this.wingR);
    for (const back of L.back ?? []) {
      if (back === 'pods') for (const w of [this.wingL, this.wingR]) this.buildPods(w, m.wingMat, m.wingTip, m.joint);
      if (back === 'sabers') for (const s of [-1, 1]) this.turret.add(at(cyl(0.03, 0.2, white), s * 0.18, 0.62, cd / 2 + 0.16, -0.5), at(cyl(0.035, 0.05, m.joint), s * 0.18, 0.54, cd / 2 + 0.2, -0.5));
      if (back === 'wings')
        for (const w of [this.wingL, this.wingR]) {
          // bat-wing blades: three tapering fins fanned up and out
          [0.9, 0.5, 0.1].forEach((rz, q) => {
            const fin = plate([[0, 0.04], [0.62 - q * 0.12, 0.08], [0.7 - q * 0.12, -0.02], [0, -0.05]], 0.04, q === 0 ? m.trim : m.wingMat);
            w.add(at(fin, 0.04, 0.12 - q * 0.08, 0.04 + q * 0.03, 0, -0.35, rz));
          });
        }
      if (back === 'cape')
        for (const [x, rz, len] of [[-0.2, 0.06, 0.9], [0, 0, 1.0], [0.2, -0.06, 0.86]] as const)
          this.turret.add(at(plate([[-0.11, 0], [0.11, 0], [0.09, -len], [0, -len - 0.1], [-0.09, -len]], 0.03, m.trim), x, 0.6, cd / 2 + 0.16, 0.12, 0, rz));
      if (back === 'ammoPack') {
        // a big ammo container with spare drums, and the belt running to the gun
        this.turret.add(at(prism(0.64, 0.36, 0.6, 0.34, 0.52, m.trim, 0.06), 0, 0.36, cd / 2 + 0.3));
        this.turret.add(box(0.66, 0.05, 0.38, m.accent, 0, 0.5, cd / 2 + 0.3));
        for (const sx of [-1, 1]) this.turret.add(at(cyl(0.13, 0.16, m.joint), sx * 0.38, 0.2, cd / 2 + 0.32, 0, 0, Math.PI / 2));
        const a0 = V(F.shOut - 0.24, 0.22, -0.72);
        const a1 = V(F.shOut + 0.5, 0.16, -0.05);
        const a2 = V(0.3, 0.3, cd / 2 + 0.16);
        const curve = new THREE.QuadraticBezierCurve3(a0, a1, a2);
        // a bold belt: chunky brass cartridges with copper tips on dark links
        const brass = this.paint(0xc9a03a, 'gold');
        const copper = this.paint(0xb8643a, 'gold');
        const link = this.paint(0x2a2a2e, 'metal');
        const n = 16;
        for (let q = 0; q <= n; q++) {
          const p = curve.getPoint(q / n);
          const ahead = curve.getPoint(Math.min(1, q / n + 0.01));
          const round = new THREE.Group();
          round.position.copy(p);
          round.lookAt(ahead);
          round.add(box(0.19, 0.06, 0.07, link));
          round.add(at(cyl(0.045, 0.16, brass), 0, 0.055, 0, 0, 0, Math.PI / 2));
          round.add(at(cone(0.045, 0.08, copper), 0.12, 0.055, 0, 0, 0, -Math.PI / 2));
          this.turret.add(round);
        }
      }
      if (back === 'shell') {
        // a big turtle shell over the back, with raised plates
        this.turret.add(at(prism(0.96, 0.5, 0.7, 0.36, 0.62, m.trim, 0.14), 0, 0.36, cd / 2 + 0.2));
        for (const [x, y] of [[-0.22, 0.5], [0.22, 0.5], [-0.24, 0.2], [0.24, 0.2], [0, 0.36]] as const)
          this.turret.add(at(prism(0.2, 0.06, 0.16, 0.05, 0.18, m.joint, 0.05), x, y, cd / 2 + 0.47));
        this.turret.add(box(1.0, 0.05, 0.54, m.accent, 0, 0.06, cd / 2 + 0.2));
      }
      if (back === 'boosters')
        for (const sx of [-1, 1]) {
          // Tallgeese's huge twin super-vernier packs
          this.turret.add(at(prism(0.24, 0.42, 0.2, 0.36, 0.7, m.body, 0.06), sx * 0.22, 0.32, cd / 2 + 0.3, 0.12));
          this.turret.add(at(box(0.26, 0.06, 0.4, m.accent), sx * 0.22, 0.52, cd / 2 + 0.33, 0.12));
          this.turret.add(at(cyl(0.1, 0.12, m.joint), sx * 0.22, -0.06, cd / 2 + 0.26));
          this.turret.add(at(cyl(0.07, 0.02, hole), sx * 0.22, -0.125, cd / 2 + 0.26));
        }
      if (back === 'radio') {
        this.turret.add(at(prism(0.2, 0.16, 0.18, 0.14, 0.24, m.joint, 0.03), 0.2, 0.62, cd / 2 + 0.14));
        this.turret.add(at(cyl(0.012, 0.6, steel), 0.24, 0.98, cd / 2 + 0.14));
      }
      if (back === 'drum') this.turret.add(at(cyl(0.18, 0.2, m.joint), 0, 0.38, cd / 2 + 0.28, 0, 0, Math.PI / 2), at(cyl(0.12, 0.21, m.accent), 0, 0.38, cd / 2 + 0.28, 0, 0, Math.PI / 2));
      if (back === 'pylons')
        for (const s of [-1, 1]) {
          const sh = s === 1 ? rightSh! : leftSh!;
          sh.add(at(prism(0.1, 0.3, 0.06, 0.26, 0.64, m.trim, 0.02), s * 0.16, 0.36, 0, 0, 0, -s * 0.08));
          sh.add(box(0.09, 0.1, 0.27, m.accent, s * 0.19, 0.68, 0));
        }
      if (back === 'fins')
        for (const s of [-1, 1]) {
          const sh = s === 1 ? rightSh! : leftSh!;
          sh.add(at(plate([[-0.06, 0], [0.06, 0], [0.03, 0.5], [-0.05, 0.42]], 0.26, m.body), s * 0.02, 0.18, 0.14, 0.15, 0, s * -0.3));
        }
      if (back === 'rexTail') {
        // the T-rex's tail hanging down behind the hips, in tapering segments
        [0.3, 0.26, 0.21, 0.16, 0.11].forEach((w, q) =>
          this.turret.add(at(prism(w, 0.24, w * 0.85, 0.22, 0.2, m.body, 0.03), 0, -0.02 - q * 0.13, cd / 2 + 0.2 + q * 0.12, 0.7 + q * 0.12)),
        );
        for (let q = 0; q < 4; q++) this.turret.add(at(cone(0.04, 0.1, m.gold), 0, 0.06 - q * 0.13, cd / 2 + 0.27 + q * 0.12, -0.4));
      }
      if (back === 'tuskShield') {
        // the mastodon's head as a shield on the back, its tusks curling out at the sides
        const ivory = this.paint(0xece4d0);
        this.turret.add(at(prism(0.66, 0.16, 0.56, 0.14, 0.5, m.trim, 0.08), 0, 0.42, cd / 2 + 0.36));
        for (const sx of [-1, 1]) {
          this.turret.add(at(cone(0.05, 0.36, ivory), sx * 0.36, 0.18, cd / 2 + 0.36, 0, 0, -sx * 2.4));
          this.turret.add(box(0.08, 0.08, 0.06, m.eyeMat, sx * 0.14, 0.52, cd / 2 + 0.44));
        }
      }
      if (back === 'launchers') {
        // Metabee: twin launchers on a stalk from the top of the head (added with the head below)
      }
    }
    if (drumFeed) {
      // the belt: chunky rounds on dark links, sagging from the drum across the front of the body
      // into the feed port on the gun
      this.turret.updateWorldMatrix(true, true);
      const inTurret = (o: THREE.Object3D, v: THREE.Vector3) => this.turret.worldToLocal(o.localToWorld(v));
      const a0 = inTurret(drumFeed, V(0, 0, 0));
      const a2 = inTurret(gun, V(-0.1, 0.02, 0.02));
      const a1 = a0.clone().add(a2).multiplyScalar(0.5).add(V(0, -0.32, -0.3));
      const curve = new THREE.QuadraticBezierCurve3(a0, a1, a2);
      const brass = this.paint(0xc9a03a, 'gold');
      const copper = this.paint(0xb8643a, 'gold');
      const link = this.paint(0x2a2a2e, 'metal');
      const n = 18;
      for (let q = 0; q <= n; q++) {
        const p = curve.getPoint(q / n);
        const ahead = curve.getPoint(Math.min(1, q / n + 0.01));
        const round = new THREE.Group();
        round.position.copy(p);
        round.lookAt(ahead);
        round.add(box(0.17, 0.05, 0.06, link));
        round.add(at(cyl(0.04, 0.14, brass), 0, 0.045, 0, 0, 0, Math.PI / 2));
        round.add(at(cone(0.04, 0.07, copper), 0.105, 0.045, 0, 0, 0, -Math.PI / 2));
        this.turret.add(round);
      }
    }
    this.trigger = box(0.24, 0.14, 0.14, m.gold, 0, 0.06, cd / 2 + 0.36);
    this.triggerZ = cd / 2 + 0.36;
    this.turret.add(this.trigger);

    // ---------- the neck and the head ----------
    this.turret.add(box(0.18, 0.14, 0.18, m.joint, 0, 0.64, -0.01));
    const head = new THREE.Group();
    head.position.set(0, 0.92 + (F.headY ?? 0), -0.03);
    if (L.menace) head.position.add(V(0, -0.07, -0.1));
    head.scale.setScalar(F.headS);
    this.turret.add(head);
    /**
     * Fierce but likeable eyes: kite shapes whose inner corners dip toward the nose, under
     * heavy brows in a V. `brow` null leaves the brows to the helmet.
     */
    const fierce = (y: number, z: number, size = 1, brow: THREE.Material | null = m.trim, gap = 0.03) => {
      const eye: [number, number][] = [[gap, -0.035], [0.17, -0.03], [0.21, 0.045], [gap + 0.025, 0.0]].map(([x, yy]) => [x * size, yy * size]);
      const lid: [number, number][] = [[gap - 0.01, 0.012], [0.235, 0.075], [0.24, 0.125], [gap - 0.01, 0.065]].map(([x, yy]) => [x * size, yy * size]);
      for (const s of [-1, 1]) {
        head.add(at(plate(s === 1 ? eye : mirrorX(eye), 0.02, m.eyeMat), 0, y, z));
        if (brow) head.add(at(plate(s === 1 ? lid : mirrorX(lid), 0.07, brow), 0, y + 0.015 * size, z - 0.012));
      }
    };
    switch (L.head) {
      case 'gundam':
      case 'visor': {
        // the helmet, cut at the front corners so the face reads as facets, narrower at the top
        // (the hero head is sleeker: more cut, and its crown, ears and cheeks take the accent)
        const hero = !!L.heroHead;
        const ht = hero ? m.accent : m.trim;
        if (hero) {
          head.add(prism(0.62, 0.58, 0.5, 0.48, 0.46, m.body, [0.2, 0.2, 0.1, 0.1]));
          head.add(at(prism(0.5, 0.46, 0.38, 0.38, 0.07, ht, [0.15, 0.15, 0.08, 0.08]), 0, 0.26, 0.02));
          head.add(at(plate([[-0.22, 0.03], [0.22, 0.03], [0.24, 0.07], [0, 0.11], [-0.24, 0.07]], 0.05, ht), 0, 0.12, -0.3)); // forehead brim in a V
        } else {
          head.add(prism(0.68, 0.62, 0.58, 0.54, 0.5, m.body, [0.15, 0.15, 0.06, 0.06]));
          head.add(at(prism(0.56, 0.5, 0.46, 0.44, 0.07, m.trim, [0.12, 0.12, 0.05, 0.05]), 0, 0.28, 0.02));
        }
        const face = def.darkFace ? m.joint : L.head === 'visor' ? black : m.body;
        // the faceplate narrows to a squared-off chin
        head.add(at(plate([[-0.2, 0.08], [0.2, 0.08], [0.18, -0.1], [0.1, -0.2], [-0.1, -0.2], [-0.18, -0.1]], 0.06, face), 0, -0.04, -0.3));
        if (L.head === 'visor') {
          head.add(at(plate([[-0.2, 0.05], [0.2, 0.05], [0.19, -0.01], [0, -0.05], [-0.19, -0.01]], 0.02, m.eyeMat), 0, 0.0, -0.335));
          for (let q = 0; q < 4; q++) head.add(box(0.02, 0.06, 0.01, m.trim, -0.06 + q * 0.04, -0.15, -0.335));
        } else if (def.eyes === 'mono') {
          head.add(box(0.36, 0.08, 0.02, black, 0, 0.0, -0.335), box(0.09, 0.07, 0.02, m.eyeMat, 0.06, 0.0, -0.345));
        } else {
          // the eyes sit in a dark recess under the brow, a red chin block below
          head.add(at(plate([[-0.22, 0.05], [0.22, 0.05], [0.18, -0.06], [-0.18, -0.06]], 0.02, black), 0, 0.0, -0.33));
          fierce(-0.01, -0.345, 1, null);
          head.add(box(0.16, 0.05, 0.03, m.accent, 0, -0.22, -0.335)); // chin
        }
        for (const s of [-1, 1]) {
          // brow wedge over each eye, cheek guards swept back
          head.add(at(plate([[0, 0.12], [0.1, 0.06], [0.1, -0.12], [0, -0.16]], 0.04, hero ? m.body : m.trim), s * (hero ? 0.25 : 0.27), -0.06, -0.18, 0, s * 0.55, 0));
          head.add(at(prism(0.1, 0.28, 0.09, 0.24, 0.24, ht, hero ? 0.04 : 0.03), s * (hero ? 0.34 : 0.37), 0.0, 0.05));
          ventX(head, s * (hero ? 0.39 : 0.42), -0.06, 0.06, 3, 0.18, s);
        }
        // forehead sensor (left off under the unicorn horn's glow line, where the two read as a cross)
        if (def.crest !== 'unihorn') head.add(box(0.1, 0.08, 0.05, def.eyes === 'mono' ? m.gold : m.accent, 0, 0.2, -0.3));
        head.add(at(prism(0.05, 0.3, 0.04, 0.26, 0.14, ht), 0, 0.34, 0.16));
        if (L.antenna) head.add(at(cyl(0.012, 0.5, steel), -0.34, 0.36, 0.08), box(0.04, 0.04, 0.04, m.accent, -0.34, 0.6, 0.08));
        // a dark crest for the units that shouldn't shine
        this.buildCrest(head, def, { body: m.body, trim: m.trim, accent: m.accent, joint: m.joint, gold: goldTrim, glowMat: m.glowMat });
        break;
      }
      case 'megazord': {
        // a silver helmet with a gold crest and fins, a black face with yellow eyes, a silver
        // mouthguard, and red ear pieces
        const silverH = this.paint(0xc4c9d0, 'metal');
        head.add(prism(0.64, 0.6, 0.54, 0.52, 0.48, silverH, [0.14, 0.14, 0.06, 0.06]));
        head.add(at(plate([[-0.22, 0.12], [0.22, 0.12], [0.2, -0.08], [0.12, -0.2], [-0.12, -0.2], [-0.2, -0.08]], 0.05, black), 0, -0.02, -0.3));
        head.add(at(plate([[-0.2, 0.04], [0.2, 0.04], [0.18, -0.03], [-0.18, -0.03]], 0.02, m.eyeMat), 0, 0.03, -0.33));
        head.add(at(plate([[-0.12, 0.05], [0.12, 0.05], [0.09, -0.08], [-0.09, -0.08]], 0.04, silverH), 0, -0.14, -0.33)); // mouthguard
        for (let q = 0; q < 3; q++) head.add(box(0.015, 0.08, 0.01, black, -0.04 + q * 0.04, -0.15, -0.355));
        // the gold crest: a forehead plate, a raised centre fin, and two swept side fins
        head.add(at(plate([[-0.24, 0.04], [0.24, 0.04], [0.22, 0.1], [0, 0.17], [-0.22, 0.1]], 0.06, m.gold), 0, 0.1, -0.31));
        head.add(at(side([[0.2, 0], [-0.14, 0], [-0.2, 0.2], [0.06, 0.26]], 0.05, m.gold), 0, 0.26, -0.04));
        for (const sx of [-1, 1]) {
          head.add(at(plate(sx === 1 ? [[0, 0], [0.08, 0], [0.16, 0.24], [0.06, 0.2]] : mirrorX([[0, 0], [0.08, 0], [0.16, 0.24], [0.06, 0.2]]), 0.04, m.gold), sx * 0.24, 0.16, -0.18));
          head.add(at(prism(0.1, 0.26, 0.09, 0.22, 0.22, m.body, 0.03), sx * 0.34, -0.02, 0.04));
        }
        break;
      }
      case 'tallgeese': {
        // a rounded knight's helmet with a plume rising at the front, eyes under the brow,
        // vents on the faceplate and big round ear pieces
        head.add(prism(0.66, 0.64, 0.56, 0.56, 0.48, m.body, [0.15, 0.15, 0.08, 0.08]));
        head.add(at(prism(0.5, 0.48, 0.38, 0.38, 0.08, m.trim, 0.12), 0, 0.28, 0.02));
        head.add(at(plate([[-0.22, 0.05], [0.22, 0.05], [0.18, -0.06], [-0.18, -0.06]], 0.02, black), 0, 0.0, -0.33));
        fierce(-0.01, -0.345, 1, null);
        head.add(at(plate([[-0.18, 0.04], [0.18, 0.04], [0.15, -0.12], [-0.15, -0.12]], 0.05, m.trim), 0, -0.13, -0.31));
        for (let q = 0; q < 3; q++) head.add(box(0.02, 0.09, 0.01, black, -0.05 + q * 0.05, -0.14, -0.337));
        head.add(at(side([[0.14, 0], [-0.08, 0], [-0.18, 0.34], [-0.04, 0.38], [0.16, 0.14]], 0.06, m.accent), 0, 0.26, -0.12));
        for (const sx of [-1, 1]) {
          head.add(at(prism(0.12, 0.3, 0.12, 0.3, 0.3, m.trim, 0.08), sx * 0.37, -0.02, 0.04));
          ventX(head, sx * 0.435, -0.08, 0.04, 3, 0.2, sx);
        }
        break;
      }
      case 'zaku': {
        head.position.y -= 0.1;
        head.add(at(prism(0.66, 0.66, 0.46, 0.5, 0.48, m.body, 0.17), 0, 0.03, 0));
        head.add(at(prism(0.48, 0.52, 0.32, 0.36, 0.1, m.trim, 0.12), 0, 0.31, 0));
        // the mono-eye rail sits inside the helmet: a dark slot flush with the face, the eye in it
        head.add(at(box(0.5, 0.1, 0.02, black), 0, 0.04, -0.282));
        head.add(at(plate([[-0.07, 0], [0, 0.045], [0.07, 0], [0, -0.045]], 0.004, m.eyeMat), 0.07, 0.04, -0.294));
        head.add(at(plate([[-0.27, 0.09], [0.27, 0.09], [0.25, 0.14], [0, 0.11], [-0.25, 0.14]], 0.08, m.trim), 0, 0.0, -0.29));
        head.add(at(prism(0.28, 0.22, 0.2, 0.18, 0.16, m.joint, 0.06, -0.03), 0, -0.17, -0.26)); // snout
        for (const s of [-1, 1]) head.add(at(cyl(0.035, 0.42, m.joint), s * 0.17, -0.38, -0.22, 0.3, 0, s * 0.7)); // power tubes
        this.buildCrest(head, def, { body: m.body, trim: m.trim, accent: m.accent, joint: m.joint, gold: m.gold, glowMat: m.glowMat });
        break;
      }
      case 'hood': {
        // a pointed hood over a dark face with glowing eyes and a V mask
        head.add(at(prism(0.66, 0.66, 0.36, 0.44, 0.58, m.body, 0.12, -0.12), 0, 0.03, 0.02));
        head.add(at(box(0.44, 0.3, 0.06, black), 0, -0.04, -0.3));
        fierce(0.0, -0.335, 0.85, m.joint);
        head.add(at(plate([[-0.2, 0.0], [0.2, 0.0], [0, -0.2]], 0.05, m.joint), 0, -0.1, -0.33));
        for (const s of [-1, 1]) head.add(at(prism(0.06, 0.4, 0.04, 0.3, 0.4, m.trim), s * 0.33, -0.04, 0.0, 0, 0, s * 0.1));
        break;
      }
      case 'eva': {
        head.add(at(prism(0.56, 0.76, 0.46, 0.68, 0.42, m.body, [0.12, 0.12, 0.05, 0.05]), 0, 0.04, 0.04));
        head.add(at(prism(0.12, 0.6, 0.08, 0.5, 0.12, m.body), 0, 0.29, 0.06));
        // eyes that look straight ahead, and the head held level however far the body hunches
        for (const sx of [-1, 1]) head.add(box(0.13, 0.045, 0.02, m.eyeMat, sx * 0.1, -0.02, -0.38));
        head.rotation.x = -(L.lean ?? F.lean);
        head.add(box(0.4, 0.15, 0.06, black, 0, -0.02, -0.34));
        for (const s of [-1, 1]) {
          head.add(at(prism(0.3, 0.14, 0.26, 0.1, 0.07, m.body), s * 0.15, 0.1, -0.34, 0, 0, s * 0.28));
          head.add(at(box(0.05, 0.2, 0.06, m.accent), s * 0.15, -0.2, -0.33, 0, 0, -s * 0.35));
          head.add(at(prism(0.06, 0.48, 0.05, 0.4, 0.34, m.body, 0.03), s * 0.34, -0.06, 0.02, 0, 0, s * 0.2));
        }
        // the long beak jaw, angled down to a point
        head.add(at(side([[-0.08, 0.04], [-0.44, -0.08], [-0.42, -0.16], [-0.06, -0.12]], 0.2, this.paint(0x6f7d96)), 0, -0.14, 0));
        head.add(at(cone(0.07, 0.52, m.body), 0, 0.38, -0.34, -0.75));
        break;
      }
      case 'beetle': {
        head.add(at(prism(0.78, 0.72, 0.7, 0.64, 0.46, m.body, 0.18), 0, 0.04, 0.02)); // the dome
        head.add(at(prism(0.68, 0.62, 0.46, 0.42, 0.14, m.body, 0.16), 0, 0.34, 0.02));
        head.add(at(prism(0.82, 0.66, 0.78, 0.62, 0.22, m.body, 0.14), 0, -0.2, 0.04)); // jaw shell
        // the black visor sits inside the helmet, under a brim and between side guards
        head.add(at(box(0.6, 0.2, 0.02, black), 0, -0.02, -0.33));
        head.add(at(prism(0.72, 0.1, 0.7, 0.08, 0.06, m.body, 0.03), 0, 0.105, -0.33));
        for (const sx of [-1, 1]) head.add(at(box(0.07, 0.26, 0.08, m.body), sx * 0.33, -0.03, -0.32));
        fierce(-0.04, -0.345, 1.25, null, 0.02);
        head.add(at(plate([[-0.22, 0.08], [0.22, 0.08], [0.2, -0.08], [0.12, -0.13], [-0.12, -0.13], [-0.2, -0.08]], 0.08, white), 0, -0.2, -0.32));
        head.add(at(box(0.08, 0.2, 0.08, m.body), 0, 0.5, 0.02)); // stalk
        for (const s of [-1, 1]) {
          const pod = at(new THREE.Group(), s * 0.24, 0.64, 0.02, 0, 0, s * 0.32);
          pod.add(at(cyl(0.09, 0.4, m.trim), 0, 0, 0, 0, 0, Math.PI / 2));
          for (const dx of [-0.1, 0, 0.1]) pod.add(box(0.05, 0.05, 0.02, hole, s * dx, 0, -0.09));
          head.add(pod);
        }
        break;
      }
      case 'bucket': {
        const helmet = this.paint(0x3f4648);
        head.add(at(prism(0.56, 0.56, 0.62, 0.58, 0.66, helmet, [0.1, 0.1, 0.04, 0.04]), 0, 0.06, 0.01));
        head.add(at(prism(0.12, 0.5, 0.16, 0.52, 0.12, this.paint(0x5a6264)), 0, 0.42, 0.02));
        for (const s of [-1, 1]) {
          head.add(at(prism(0.08, 0.5, 0.08, 0.44, 0.46, helmet, 0.02), s * 0.31, -0.06, 0.02, 0, 0, s * -0.08));
          ventX(head, s * 0.36, -0.2, 0.06, 4, 0.3, s);
        }
        head.add(at(plate([[-0.17, 0.1], [0.17, 0.1], [0.17, -0.12], [0.12, -0.2], [-0.12, -0.2], [-0.17, -0.12]], 0.06, silver), 0, -0.06, -0.29));
        // deep-set eyes in a dark recess under a heavy V brow that juts out over them
        head.add(at(plate([[-0.18, 0.05], [0.18, 0.05], [0.15, -0.04], [-0.15, -0.04]], 0.02, black), 0, 0.0, -0.325));
        fierce(-0.005, -0.34, 0.72, null);
        head.add(at(plate([[-0.24, 0.13], [0.24, 0.13], [0.24, 0.07], [0, 0.015], [-0.24, 0.07]], 0.1, helmet), 0, 0.0, -0.33));
        // swept fins rising off the sides of the helmet, edged in red
        for (const sx of [-1, 1]) {
          const fin: [number, number][] = [[0, 0], [0.07, 0], [0.18, 0.4], [0.06, 0.34]];
          head.add(at(plate(sx === 1 ? fin : mirrorX(fin), 0.05, helmet), sx * 0.3, 0.16, 0.04));
          const edge: [number, number][] = [[0.07, 0], [0.1, 0], [0.21, 0.42], [0.18, 0.4]];
          head.add(at(plate(sx === 1 ? edge : mirrorX(edge), 0.055, m.accent), sx * 0.3, 0.16, 0.04));
        }
        // the nose ridge down the middle of the face, and the grim mouth under it
        head.add(at(prism(0.05, 0.05, 0.03, 0.03, 0.13, silver, 0, -0.015), 0, -0.07, -0.335));
        head.add(box(0.07, 0.025, 0.03, silver, 0, -0.135, -0.335));
        head.add(at(box(0.06, 0.06, 0.03, new THREE.MeshBasicMaterial({ color: 0x4dff6a })), 0, 0.2, -0.3, 0, 0, Math.PI / 4));
        break;
      }
    }
    if (L.megazord) {
      // each limb in its own zord's colour: black (mastodon) arms, a blue (triceratops) right
      // leg and a yellow (sabertooth) left leg
      const swap = (o: THREE.Object3D, to: Record<string, THREE.Material>) =>
        o.traverse((c) => {
          const mesh = c as THREE.Mesh;
          const to2 = mesh.isMesh ? to[(mesh.material as THREE.Material).userData?.slot as string] : undefined;
          if (to2 && mesh.material === m[(mesh.material as THREE.Material).userData.slot as 'body']) mesh.material = to2;
        });
      const armBlack = this.paint(0x24242a, 'body');
      for (const sh of [rightSh, leftSh]) if (sh) swap(sh, { body: armBlack });
      for (const leg of this.legs) swap(leg, { body: this.paint(leg.position.x > 0 ? 0x2a5cc8 : 0xf2c21a, 'body') });
    }
    // a hovering unit is built floating above its shadow (sync adds the drift)
    if (this.hoverLift) for (const o of this.root.children) o.position.y += this.hoverLift;
  }

  /**
   * Ember Lizard 2.1: back to the chunky, cute fire lizard of the original, now in faceted
   * kit shapes: a pear-shaped body with a cream belly, a big head with a round snout and big
   * eyes, short legs with claws, and a long tail with a big flame. The marble leaves its mouth.
   */
  private buildLizard21(_def: CharacterDef, m: { body: THREE.Material; trim: THREE.Material; accent: THREE.Material; joint: THREE.Material; gold: THREE.Material; eyeMat: THREE.Material; glowMat: THREE.Material | null; ballMat: THREE.Material }) {
    const white = this.paint(0xfaf7f0);
    const black = this.paint(0x141018);
    const at = <T extends THREE.Object3D>(o: T, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
      o.position.set(x, y, z);
      o.rotation.set(rx, ry, rz);
      return o;
    };
    const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => at(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), x, y, z);
    const prism = (wb: number, db: number, wt: number, dt: number, h: number, mat: THREE.Material, cuts: Cuts = 0, lean = 0) => facetMesh(prismData(wb, db, wt, dt, h, cuts, lean), mat);
    const plate = (pts: [number, number][], depth: number, mat: THREE.Material) => facetMesh(extrudeData(pts, depth), mat);
    const cone = (r: number, h: number, mat: THREE.Material) => new THREE.Mesh(new THREE.ConeGeometry(r, h, 4, 1, false, Math.PI / 4), mat);
    const hipY = 0.4;
    for (const s of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(s * 0.24, hipY, 0.04);
      leg.add(at(prism(0.3, 0.34, 0.34, 0.38, 0.24, m.body, 0.08), 0, -0.1, 0)); // chunky thigh
      leg.add(at(prism(0.26, 0.3, 0.24, 0.28, 0.14, m.body, 0.06), 0, -0.28, 0));
      leg.add(at(prism(0.34, 0.5, 0.3, 0.42, 0.1, m.body, [0.1, 0.1, 0.06, 0.06]), 0, -0.36, -0.06)); // foot
      for (const cx of [-0.1, 0, 0.1]) leg.add(at(cone(0.045, 0.12, white), cx, -0.37, -0.33, -Math.PI / 2));
      this.root.add(leg);
      this.legs.push(leg);
    }
    // the body: a pear, wider at the hips, with the cream belly
    this.turret.position.y = hipY + 0.02;
    this.root.add(this.turret);
    this.turret.add(at(prism(0.66, 0.56, 0.5, 0.46, 0.5, m.body, [0.14, 0.14, 0.12, 0.12]), 0, 0.22, 0));
    this.turret.add(at(plate([[-0.18, 0.2], [0.18, 0.2], [0.24, 0.0], [0.18, -0.2], [-0.18, -0.2], [-0.24, 0.0]], 0.05, m.trim), 0, 0.2, -0.27, 0.12));
    for (let q = 0; q < 3; q++) this.turret.add(box(0.3, 0.012, 0.02, m.accent, 0, 0.12 + q * 0.09, -0.305));
    // a little jetpack strapped on its back: twin thrusters pointing down
    this.turret.add(at(prism(0.34, 0.16, 0.3, 0.14, 0.3, m.trim, 0.04), 0, 0.34, 0.31));
    this.turret.add(box(0.2, 0.04, 0.03, m.accent, 0, 0.4, 0.39));
    for (const s of [-1, 1]) {
      this.turret.add(at(prism(0.1, 0.1, 0.08, 0.08, 0.16, m.joint, 0.02), s * 0.1, 0.13, 0.33));
      this.turret.add(box(0.06, 0.02, 0.06, m.accent, s * 0.1, 0.045, 0.33));
      this.turret.add(box(0.04, 0.3, 0.04, m.joint, s * 0.16, 0.36, 0.22)); // strap
    }
    // short arms with little claws
    for (const s of [-1, 1]) {
      const arm = at(new THREE.Group(), s * 0.3, 0.34, -0.06, -0.5, 0, s * -0.3);
      arm.add(at(prism(0.12, 0.12, 0.14, 0.14, 0.24, m.body, 0.03), 0, -0.1, 0));
      for (const dx of [-0.04, 0.04]) arm.add(at(cone(0.025, 0.08, white), dx, -0.25, -0.02, Math.PI));
      this.turret.add(arm);
    }
    // the big head: a faceted skull, a round snout, big shiny eyes
    const head = at(new THREE.Group(), 0, 0.68, -0.04);
    // the head is always cocked to one side (rapid fire sprays as it sways)
    head.rotation.z = 0.28;
    this.tiltHead = head;
    this.turret.add(head);
    head.add(prism(0.62, 0.58, 0.54, 0.5, 0.5, m.body, 0.15));
    head.add(at(prism(0.5, 0.36, 0.44, 0.3, 0.24, m.body, [0.12, 0.12, 0.04, 0.04]), 0, -0.08, -0.36)); // snout
    for (const s of [-1, 1]) {
      head.add(at(box(0.15, 0.17, 0.03, white), s * 0.14, 0.06, -0.27));
      head.add(at(box(0.08, 0.12, 0.02, black), s * 0.15, 0.05, -0.29));
      // a half-lid over the inner top of each eye and a brow along its edge: cute, but cross
      const lid: [number, number][] = [[0.05, 0.16], [0.235, 0.16], [0.235, 0.13], [0.05, 0.06]];
      const browLine: [number, number][] = [[0.04, 0.05], [0.24, 0.125], [0.24, 0.165], [0.04, 0.09]];
      head.add(at(plate(s === 1 ? lid : mirrorX(lid), 0.02, m.body), 0, 0, -0.3));
      head.add(at(plate(s === 1 ? browLine : mirrorX(browLine), 0.04, m.joint), 0, 0, -0.305));
      head.add(box(0.035, 0.025, 0.01, black, s * 0.08, -0.02, -0.535)); // nostril
      head.add(at(cone(0.025, 0.07, white), s * 0.14, -0.21, -0.48, Math.PI));
    }
    const jaw = new THREE.Group();
    jaw.position.set(0, -0.2, -0.1);
    jaw.add(at(prism(0.44, 0.44, 0.4, 0.4, 0.08, m.body, 0.1), 0, -0.02, -0.22));
    jaw.add(at(box(0.32, 0.015, 0.3, this.paint(0xc8506a)), 0, 0.025, -0.24));
    head.add(jaw);
    this.jaw = jaw;
    this.barrel.position.set(0, -0.12, -0.52);
    head.add(this.barrel);
    this.barrelZ = -0.52;
    this.markBelly(this.barrel, 0, 0, -0.08);
    // the long tail, curling up, with a big flame at the tip
    const tail = at(new THREE.Group(), 0, hipY + 0.08, 0.26);
    [0.3, 0.26, 0.21, 0.16, 0.12].forEach((w, q) => {
      tail.add(at(prism(w, 0.3, w * 0.85, 0.28, w, q % 2 ? m.body : m.body, 0.03), 0, q * 0.08, 0.14 + q * 0.2, -0.35 - q * 0.18));
    });
    const flame = at(new THREE.Group(), 0, 0.55, 1.08);
    const fire = (r: number, h: number, color: number, y: number, opacity: number) => {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
      flame.add(at(new THREE.Mesh(new THREE.BoxGeometry(r * 1.6, r * 1.6, r * 1.6), mat), 0, y));
      flame.add(at(new THREE.Mesh(new THREE.ConeGeometry(r * 0.95, h, 4), mat), 0, y + h / 2));
    };
    fire(0.22, 0.56, 0xff4a0a, -0.12, 0.85);
    fire(0.15, 0.42, 0xffa21a, -0.1, 0.9);
    fire(0.08, 0.26, 0xfff07a, -0.08, 1);
    tail.add(flame);
    this.flame = flame;
    this.root.add(tail);
    this.wings.position.set(0, 0.4, 0.3);
    this.turret.add(this.wings);
    this.wings.add(this.wingL, this.wingR);
    this.trigger = box(0.01, 0.01, 0.01, m.joint);
    this.turret.add(this.trigger);
  }

  /** 2.1 beasts keep their Unit Lab design; these add the new signature parts on top */
  private addons21(def: CharacterDef) {
    const gold = this.paint(0xe2b23a);
    const steel = this.paint(0x8a929e);
    const black = this.paint(0x16141c);
    for (const a of def.addons ?? []) {
      if (a === 'legStripes') {
        // the legs' white plates become stripes, top to bottom
        const stripe = [this.paint(def.palette.joint), this.paint(def.palette.accent)];
        for (const leg of this.legs) {
          const whites: THREE.Mesh[] = [];
          leg.traverse((o) => {
            const mesh = o as THREE.Mesh;
            const c = (mesh.material as THREE.MeshLambertMaterial | undefined)?.color;
            if (mesh.isMesh && c && c.r > 0.85 && c.g > 0.85 && c.b > 0.8) whites.push(mesh);
          });
          whites.sort((p, q) => q.getWorldPosition(new THREE.Vector3()).y - p.getWorldPosition(new THREE.Vector3()).y);
          whites.forEach((mesh, i) => (mesh.material = stripe[i % 2]));
        }
      }
      if (a === 'armyWhites') {
        // the design's fixed white and steel parts (the backpack, plates) turn military:
        // white to a rust red, steel to gunmetal
        const grey = this.paint(def.palette.accent);
        const gunmetal = this.paint(0x40454a);
        const teeth = this.paint(0xc8ccd2, 'metal');
        this.root.traverse((o) => {
          const mesh = o as THREE.Mesh;
          const c = (mesh.material as THREE.MeshLambertMaterial | undefined)?.color;
          if (!mesh.isMesh || !c || !(mesh.material as THREE.MeshLambertMaterial).isMeshLambertMaterial) return;
          // white teeth and claws (cones) stay light steel; other fixed white plates take the accent
          // (the unit's own armour colour is left alone, even when it is white itself)
          const own = c.equals(new THREE.Color(def.palette.body)) || c.equals(new THREE.Color(def.palette.trim));
          if (!own && c.r > 0.85 && c.g > 0.85 && c.b > 0.8) mesh.material = mesh.geometry.type === 'ConeGeometry' ? teeth : grey;
          else if (Math.abs(c.r - 0.72) < 0.05 && Math.abs(c.g - 0.745) < 0.05 && Math.abs(c.b - 0.79) < 0.05) mesh.material = gunmetal;
        });
      }
      if (a === 'noBall') {
        // take the round parts off the design: the glass marbles and the ball on the neck
        const balls: THREE.Object3D[] = [];
        this.root.traverse((o) => {
          const mat = (o as THREE.Mesh).material as THREE.MeshPhongMaterial | undefined;
          if (!(o as THREE.Mesh).isMesh) return;
          if ((mat?.isMeshPhongMaterial && mat.shininess >= 80) || (o as THREE.Mesh).geometry.type === 'SphereGeometry') balls.push(o);
        });
        for (const b of balls) b.removeFromParent();
      }
      if (a === 'fangs' && this.jaw?.parent) {
        // big gold sabre fangs hanging from the upper jaw: the fangs are the name
        const head = this.jaw.parent;
        const jz = this.jaw.position.z;
        for (const s of [-1, 1]) {
          const f = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.3, 4, 1, false, Math.PI / 4), gold);
          f.rotation.x = Math.PI;
          f.position.set(s * 0.1, this.jaw.position.y - 0.1, jz - 0.28);
          head.add(f);
        }
      }
      if (a === 'backCannon') {
        // a twin cannon array on the back, the part every Zoid box shows off
        const t = this.turret;
        const g = new THREE.Group();
        g.position.set(0, 0.42, 0.18);
        g.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.3), black));
        for (const s of [-1, 1]) {
          const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.62, 4, 1, false, Math.PI / 4), steel);
          tube.rotation.x = Math.PI / 2;
          tube.position.set(s * 0.1, 0.1, -0.2);
          const housing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.3), black);
          housing.position.set(s * 0.1, 0.1, 0.02);
          g.add(tube, housing);
        }
        t.add(g);
      }
    }
  }

  // ---------- hero builds from the reference sheets (more shapes: rounded armour, capsules, curves) ----------

  /** a lambert material that joins the hit-flash list */
  private paint(color: number, slot?: string) {
    const m = new THREE.MeshLambertMaterial({ color });
    m.userData.slot = slot ?? slotOfColor(color);
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
      case 'horns':
      case 'twinHorns': {
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
        // one gold blade at the front, or two side by side
        for (const x of def.crest === 'twinHorns' ? [-0.1, 0.1] : [0]) {
          const blade = cone(0.06, 0.42, m.gold);
          blade.position.set(x, 0.48, -0.26);
          blade.rotation.set(-0.25, 0, -x * 1.2);
          head.add(blade);
        }
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
    if (this.lastHand === -1 && this.bellyMarkL) return this.bellyMarkL.getWorldPosition(out);
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
    // (with a gun in each hand, only the one that fired kicks back)
    this.lastHand = s.lastHand ?? 1;
    const kicked = this.barrel2 && this.lastHand === -1 ? this.barrel2 : this.barrel;
    const idle = kicked === this.barrel ? this.barrel2 : this.barrel;
    kicked.position.z = this.barrelZ + s.recoil * (this.jaw ? 0.04 : 0.12);
    if (idle) idle.position.z = this.barrelZ;
    if (this.punchArms.length) {
      // the wind-up: both arms thrust straight out, held through the blast, then drawn back
      const w = s.windT ?? 9;
      const hold = this.windup + 0.18;
      const p = w < 0.1 ? 1 - (1 - w / 0.1) ** 3 : w < hold ? 1 : w < hold + 0.3 ? 1 - (w - hold) / 0.3 : 0;
      this.punchArms.forEach((a, i) => (a.rotation.x = (this.punchRest[i] ?? 0) + p * 1.45));
    }
    if (this.swapper) {
      // swapping hands: the upper body mirrors over, the gun crossing to the other side
      const want = s.hand ?? 1;
      this.turret.scale.x += (want - this.turret.scale.x) * Math.min(1, dt * 12);
    }
    if (this.tiltHead) {
      this.tiltHead.rotation.z = 0.28 + (s.wobble ?? 0) * 1.4;
      this.tiltHead.rotation.y = (s.wobble ?? 0) * 0.9;
    }
    this.trigger.position.z = this.triggerZ - s.recoil * 0.1;
    // beasts: the jaw snaps open as the marble leaves the mouth
    if (this.jaw) {
      // a dragon's maw gapes wide as it blasts and holds open a beat before it shuts
      const gape = Math.max(s.recoil, Math.max(0, 1 - (s.kickT ?? 9) / 0.45));
      this.jaw.rotation.x = this.rest.jaw + (this.jawOpen ? this.jawOpen * gape : s.recoil * 0.55);
    }
    if (this.slashArm) {
      // a swordsman's shot is a slash: from the ready (raised on the right, turned a little out),
      // a fast diagonal cut down and in across the body to the centre, then back up
      const t = s.kickT ?? 9;
      const cut = t < 0.08 ? 1 - (1 - t / 0.08) ** 3 : t < 0.5 ? 1 - ((t - 0.08) / 0.42) ** 0.6 : 0;
      const arm = this.slashArm;
      arm.rotation.order = 'YXZ';
      arm.rotation.y = -0.2 + cut * 0.85; // swings in toward the middle
      arm.rotation.x = this.rest.slash - cut * 1.6;
      arm.rotation.z = -0.25 - cut * 0.45; // the blade rolls over into the diagonal
      if (this.slashArc) {
        const on = t < 0.24;
        this.slashArc.visible = on;
        if (on) {
          const k = t / 0.24;
          this.slashArc.scale.setScalar(0.7 + k * 0.9);
          (this.slashArc.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.95;
        }
      }
    }
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
    if (this.treadPlates.length) {
      // the tracks roll with the ground speed: plates slide along (wrapping every plate pitch),
      // the top run one way and the bottom run the other, and the wheels turn
      this.treadTravel += s.vx * dt * (s.team === 0 ? 1 : -1);
      const pitch = 0.1;
      const off = ((this.treadTravel % pitch) + pitch) % pitch;
      for (const p of this.treadPlates) {
        const z0 = p.userData.z0 as number;
        const z = z0 + off * (p.userData.dir as number);
        p.position.z = z > 0.45 ? z - 0.9 : z < -0.45 ? z + 0.9 : z;
      }
      for (const w of this.treadWheels) w.rotation.x = -this.treadTravel / 0.085;
    }
    // tanks glide, they don't bob
    this.dangle.forEach((l, i) => (l.rotation.x = (i ? 0.2 : -0.14) + Math.sin(time * 1.6 + i * 1.3) * 0.08 - s.vx * 0.03 * (s.team === 0 ? 1 : -1)));
    const bob = this.hoverLift ? Math.sin(time * 1.5) * 0.07 : this.treadPlates.length ? 0 : Math.abs(Math.sin(this.stride)) * 0.05 * moving;

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
    this.root.scale.set((1 + squash * 0.6) * this.size * this.fit.x, (1 - squash) * this.size * this.fit.y, (1 + squash * 0.6) * this.size * this.fit.z);
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
/**
 * Swap round parts for square-sided ones: balls and capsules become blocks, tubes and cones
 * four-sided prisms and pyramids (turned to line up with the body), rings square. The
 * glossy marble in a unit's chest stays round: it's the ball.
 */
function boxify(root: THREE.Object3D) {
  const quarter = Math.PI / 4;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.Material;
    if ((mat as THREE.MeshPhongMaterial).isMeshPhongMaterial && (mat as THREE.MeshPhongMaterial).shininess >= 80) return;
    const g = mesh.geometry as THREE.BufferGeometry & { parameters: Record<string, number> };
    const p = g.parameters;
    let next: THREE.BufferGeometry | null = null;
    switch (g.type) {
      case 'SphereGeometry': {
        const e = p.radius * 1.75;
        if ((p.thetaLength ?? Math.PI) < Math.PI * 0.9) {
          // a dome: a block standing on the cut
          next = new THREE.BoxGeometry(e, p.radius * 0.95, e).translate(0, p.radius * 0.475, 0);
        } else next = new THREE.BoxGeometry(e, e, e);
        break;
      }
      case 'CapsuleGeometry':
        next = new THREE.BoxGeometry(p.radius * 1.8, p.height + p.radius * 1.8, p.radius * 1.8);
        break;
      case 'CylinderGeometry':
        next = new THREE.CylinderGeometry(p.radiusTop * 1.25, p.radiusBottom * 1.25, p.height, 4, 1, !!p.openEnded, quarter);
        break;
      case 'ConeGeometry':
        next = new THREE.ConeGeometry(p.radius * 1.25, p.height, 4, 1, !!p.openEnded, quarter);
        break;
      case 'TorusGeometry':
        next = new THREE.TorusGeometry(p.radius, p.tube, 4, 4, p.arc ?? Math.PI * 2);
        break;
    }
    if (next) {
      g.dispose();
      mesh.geometry = next;
    }
  });
}

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

/** a studio environment for reflections on the plastic, made once per renderer */
const envCache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();
export function studioEnv(renderer: THREE.WebGLRenderer) {
  let t = envCache.get(renderer);
  if (!t) {
    const pm = new THREE.PMREMGenerator(renderer);
    t = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    envCache.set(renderer, t);
  }
  return t;
}

/**
 * Swap a model's matte paint for moulded plastic: slightly glossy, with a clear coat that
 * picks up soft highlights, like a clean toy you want to pick up. Unlit parts (eyes, glows)
 * and the glass marble keep their own materials. Returns the plastic, for the hit flash.
 */
export function plasticize(root: THREE.Object3D, matte = false, mixed = false, armour?: ArmourTex) {
  const swap = new Map<THREE.Material, THREE.MeshPhysicalMaterial>();
  const make = (m: THREE.MeshLambertMaterial) => {
    let p = swap.get(m);
    if (!p) {
      const hsl = { h: 0, s: 0, l: 0 };
      m.color.getHSL(hsl);
      p = new THREE.MeshPhysicalMaterial({
        color: m.color,
        // dark plastic a touch glossier, so black parts still show their form
        // doff plastic: rough, no top coat, barely any reflection
        roughness: matte ? 0.88 : hsl.l < 0.2 ? 0.34 : 0.42,
        metalness: 0,
        clearcoat: matte ? 0 : 0.55,
        clearcoatRoughness: 0.28,
        envMapIntensity: matte ? 0.25 : 0.6,
        side: m.side,
        transparent: m.transparent,
        opacity: m.opacity,
        depthWrite: m.depthWrite,
        blending: m.blending,
      });
      if (mixed) finish(p, (m.userData.slot as string | undefined) ?? 'body', matte, armour);
      p.userData = { ...m.userData };
      swap.set(m, p);
      m.dispose();
    }
    return p;
  };
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (Array.isArray(mesh.material)) mesh.material = mesh.material.map((m) => ((m as THREE.MeshLambertMaterial).isMeshLambertMaterial ? make(m as THREE.MeshLambertMaterial) : m));
    else if ((mesh.material as THREE.MeshLambertMaterial).isMeshLambertMaterial) mesh.material = make(mesh.material as THREE.MeshLambertMaterial);
    mesh.castShadow = true;
  });
  return [...swap.values()];
}

/** the paint a fixed colour stands for: gold and steel read as metal */
function slotOfColor(c: number) {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  if (r > 200 && g > 150 && b < 110 && r - b > 120) return 'gold';
  if (Math.abs(r - g) < 20 && Math.abs(g - b) < 26 && r > 120 && r < 215) return 'metal';
  return 'body';
}

/** small tiling surface textures for the 2.1 finishes, made once */
const surfaceTex: Partial<Record<'grain' | 'knurl' | 'brushed', THREE.Texture>> = {};
function surface(kind: 'grain' | 'knurl' | 'brushed') {
  let t = surfaceTex[kind];
  if (t) return t;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#808080';
  g.fillRect(0, 0, S, S);
  if (kind === 'grain') {
    // sandblasted: fine random speckle
    for (let i = 0; i < 2600; i++) {
      const v = 100 + Math.floor(Math.random() * 60);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5);
    }
  } else if (kind === 'knurl') {
    // diamond knurling, like the grip on a hand tool
    g.strokeStyle = '#3a3a3a';
    g.lineWidth = 3;
    for (let x = -S; x < S * 2; x += 16) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + S, S);
      g.stroke();
      g.beginPath();
      g.moveTo(x + S, 0);
      g.lineTo(x, S);
      g.stroke();
    }
  } else {
    // brushed metal: fine horizontal streaks
    for (let y = 0; y < S; y++) {
      const v = 110 + Math.floor(Math.random() * 40);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(0, y, S, 1);
    }
  }
  t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  surfaceTex[kind] = t;
  return t;
}

/**
 * The 2.1 finishes, by what each paint is on the kit: satin armour with a fine sandblasted
 * grain, gloss enamel trim and accents, a matte knurled inner frame, real metal for gold and
 * steel. A matte unit keeps everything dull but still gets the textures.
 */
function finish(p: THREE.MeshPhysicalMaterial, slot: string, matte: boolean, armour?: ArmourTex) {
  switch (slot) {
    case 'trim':
    case 'accent':
      p.roughness = matte ? 0.6 : 0.2;
      p.clearcoat = matte ? 0.1 : 0.9;
      p.clearcoatRoughness = 0.08;
      p.envMapIntensity = matte ? 0.35 : 0.85;
      break;
    case 'joint':
      p.roughness = 0.92;
      p.clearcoat = 0;
      p.envMapIntensity = 0.2;
      p.bumpMap = surface('knurl');
      p.bumpScale = 1.4;
      break;
    case 'gold':
      // bright plated gold: part metal, glossy, so it stays golden under the studio light
      p.metalness = 0.4;
      p.roughness = 0.26;
      p.clearcoat = 0.7;
      p.clearcoatRoughness = 0.1;
      p.envMapIntensity = 1.1;
      break;
    case 'metal':
      p.metalness = 0.75;
      p.roughness = 0.38;
      p.clearcoat = 0;
      p.envMapIntensity = 0.9;
      p.bumpMap = surface('brushed');
      p.bumpScale = 0.6;
      break;
    case 'rubber':
      p.roughness = 0.95;
      p.clearcoat = 0;
      p.envMapIntensity = 0.15;
      break;
    default:
      // armour: satin with a fine grain
      p.roughness = matte ? 0.85 : 0.48;
      p.clearcoat = matte ? 0 : 0.3;
      p.clearcoatRoughness = 0.35;
      p.envMapIntensity = matte ? 0.25 : 0.55;
      if (armour === 'none') {
        // plain moulded plastic, no pattern
      } else if (armour) {
        // the unit's own armour pattern, as a tone on the paint and as relief
        const t = armourTexture(armour);
        p.map = t;
        p.bumpMap = t;
        p.bumpScale = 1.2;
      } else {
        p.bumpMap = surface('grain');
        p.bumpScale = 0.8;
      }
  }
}
