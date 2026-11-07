/**
 * Dungeon Run's monsters: five non-playable foes, built as block designs (the Unit Lab's format)
 * so they walk, aim, fire, pose and break apart like any fighter. They never appear in the
 * Fighters grid: only the dungeon spawns them.
 *
 * Models face -z (front), stand on y = 0 and are about the roster's height (~1.9). A design with
 * no legs floats and bobs (the slime, the bat and the wraith).
 */
import type { CharacterDef } from './robot';
import type { Block, ColorRef, Role, Shape } from './roster';

type V3 = [number, number, number];
type Opt = { r?: V3; s?: V3; role?: Role; glow?: boolean; opacity?: number; kids?: Block[] };
const blk = (shape: Shape, size: Record<string, number>, p: V3, color: ColorRef, o: Opt = {}): Block => ({
  shape,
  size,
  mat: { kind: o.glow ? 'basic' : 'lambert', color, ...(o.opacity ? { opacity: o.opacity } : {}) },
  p,
  r: o.r ?? [0, 0, 0],
  s: o.s ?? [1, 1, 1],
  ...(o.role ? { role: o.role } : {}),
  ...(o.kids ? { children: o.kids } : {}),
});
const box = (w: number, h: number, d: number, p: V3, c: ColorRef, o?: Opt) => blk('box', { width: w, height: h, depth: d }, p, c, o);
const ball = (radius: number, p: V3, c: ColorRef, o?: Opt) => blk('sphere', { radius, widthSegments: 12, heightSegments: 9 }, p, c, o);
const cone = (radius: number, height: number, p: V3, c: ColorRef, o?: Opt) => blk('cone', { radius, height, radialSegments: 6 }, p, c, o);
const group = (p: V3, kids: Block[], o: Opt = {}): Block => ({ shape: 'group', p, r: o.r ?? [0, 0, 0], s: o.s ?? [1, 1, 1], ...(o.role ? { role: o.role } : {}), children: kids });
const root = (kids: Block[]): Block => group([0, 0, 0], kids);
/** where the marbles leave (the barrel) and where a special's balls launch from (the belly) */
const muzzle = (p: V3): Block[] => [group(p, [], { role: 'barrel' }), group([p[0], p[1], p[2] - 0.05], [], { role: 'belly' })];

const base = {
  crest: 'none',
  eyes: 'twin',
  wings: 'none',
  shoulders: 'round',
  offhand: 'none',
  feet: 'toe',
  matte: true,
} as const;

// ---------- Bonewalker: a skeleton, quick on its feet and quicker on the trigger, easy to break ----------
const bonewalker: CharacterDef = {
  ...base,
  id: 'bonewalker',
  fit: [1.6, 1.6, 1.6],
  name: 'Bonewalker',
  ball: 0xe8e2d0,
  palette: { body: 0xe8e2d0, trim: 0x2a2420, accent: 0x8a2a24, joint: 0xb8b0a0, wing: 0xe8e2d0, wingTip: 0xe8e2d0, eye: 0xff4a3a },
  traits: { speed: 3, fireRate: 4, health: 2, agility: 4 },
  blueprint: root([
    ...[-1, 1].map((sd) =>
      group([sd * 0.18, 0.52, 0], [box(0.1, 0.44, 0.1, [0, -0.2, 0], 'body'), box(0.14, 0.08, 0.14, [0, -0.22, 0], 'joint'), box(0.18, 0.08, 0.32, [0, -0.47, -0.06], 'body')], { role: 'leg' }),
    ),
    box(0.42, 0.12, 0.22, [0, 0.54, 0], 'body'),
    group([0, 0.58, 0], [
      box(0.1, 0.46, 0.1, [0, 0.22, 0.06], 'joint'),
      ...[0.14, 0.26, 0.38].map((y, i) => box(0.52 - i * 0.04, 0.06, 0.3, [0, y, 0], 'body')),
      box(0.08, 0.32, 0.06, [0, 0.26, -0.15], 'body'),
      // the skull, its dark sockets and red eyes, and a jaw that snaps when it fires
      blk('rbox', { width: 0.42, height: 0.36, depth: 0.4, radius: 0.08 }, [0, 0.76, 0], 'body'),
      box(0.12, 0.1, 0.04, [-0.1, 0.78, -0.2], 'trim'),
      box(0.12, 0.1, 0.04, [0.1, 0.78, -0.2], 'trim'),
      box(0.05, 0.05, 0.03, [-0.1, 0.78, -0.225], 'eye', { glow: true }),
      box(0.05, 0.05, 0.03, [0.1, 0.78, -0.225], 'eye', { glow: true }),
      group([0, 0.6, 0.02], [box(0.34, 0.08, 0.34, [0, -0.02, -0.04], 'body'), box(0.26, 0.03, 0.03, [0, 0.03, -0.2], 'trim')], { role: 'jaw' }),
      // arms that swing as it walks; a bone club in the right hand
      group([-0.32, 0.44, 0], [box(0.08, 0.42, 0.08, [0, -0.2, 0], 'body'), box(0.12, 0.1, 0.12, [0, -0.44, 0], 'joint')], { role: 'swing' }),
      group([0.32, 0.44, 0], [box(0.08, 0.42, 0.08, [0, -0.2, 0], 'body'), box(0.1, 0.1, 0.5, [0, -0.44, -0.2], 'body'), box(0.16, 0.14, 0.16, [0, -0.44, -0.46], 'joint')], { role: 'swing' }),
      ...muzzle([0.32, 0.0, -0.62]),
    ], { role: 'turret' }),
  ]),
};

// ---------- Gloop: a slime that bobs along, its marbles bouncing off the walls ----------
const gloop: CharacterDef = {
  ...base,
  id: 'gloop',
  fit: [1.75, 1.75, 1.75],
  name: 'Gloop',
  ball: 0x7aff5a,
  palette: { body: 0x4ac83a, trim: 0x1e5a18, accent: 0xb8ff8a, joint: 0x2e8a24, wing: 0x4ac83a, wingTip: 0x4ac83a, eye: 0xffffff },
  traits: { speed: 2, fireRate: 3, health: 4, agility: 2 },
  blueprint: root([
    group([0, 0, 0], [
      ball(0.62, [0, 0.46, 0], 'body', { s: [1, 0.78, 1], opacity: 0.88 }),
      ball(0.36, [0, 0.62, 0.04], 'accent', { s: [1, 0.8, 1] }),
      ball(0.2, [0.22, 0.32, 0.2], 'joint'),
      ball(0.14, [-0.3, 0.26, 0.12], 'joint'),
      // big eyes on stalks of goo, and a mouth that gapes when it spits
      ball(0.13, [-0.18, 0.86, -0.36], 'eye', { glow: true }),
      ball(0.13, [0.18, 0.86, -0.36], 'eye', { glow: true }),
      ball(0.06, [-0.18, 0.86, -0.48], 'trim'),
      ball(0.06, [0.18, 0.86, -0.48], 'trim'),
      group([0, 0.5, -0.5], [box(0.32, 0.1, 0.08, [0, 0, 0], 'trim')], { role: 'jaw' }),
      ...muzzle([0, 0.5, -0.66]),
    ], { role: 'turret' }),
  ]),
};

// ---------- Duskwing: a giant bat, fast and frail, weaving as it fires ----------
const wing = (sd: number): Block =>
  group([sd * 0.3, 1.0, 0.04], [
    box(0.62, 0.04, 0.34, [sd * 0.32, 0, 0.04], 'trim'),
    box(0.4, 0.04, 0.26, [sd * 0.76, -0.06, 0.08], 'trim', { r: [0, 0, sd * -0.3] }),
    box(0.06, 0.06, 0.06, [sd * 0.62, 0.02, -0.12], 'joint'),
    cone(0.04, 0.16, [sd * 0.98, -0.16, 0.06], 'joint', { r: [0, 0, sd * 2.6] }),
  ], { role: sd < 0 ? 'wingL' : 'wingR', r: [0, 0, sd * 0.25] });
const duskwing: CharacterDef = {
  ...base,
  id: 'duskwing',
  fit: [1.4, 1.4, 1.4],
  name: 'Duskwing',
  ball: 0xc86aff,
  palette: { body: 0x3a2a4a, trim: 0x6a3a7a, accent: 0xff6a9a, joint: 0x241a2e, wing: 0x6a3a7a, wingTip: 0x6a3a7a, eye: 0xffe24a },
  traits: { speed: 5, fireRate: 4, health: 1, agility: 5 },
  blueprint: root([
    group([0, 0, 0], [
      ball(0.34, [0, 1.0, 0], 'body', { s: [1, 1.1, 1] }),
      ball(0.26, [0, 0.66, 0.06], 'joint'),
      cone(0.1, 0.3, [-0.17, 1.38, 0], 'body', { r: [0, 0, 0.3] }),
      cone(0.1, 0.3, [0.17, 1.38, 0], 'body', { r: [0, 0, -0.3] }),
      box(0.08, 0.06, 0.03, [-0.12, 1.06, -0.32], 'eye', { glow: true }),
      box(0.08, 0.06, 0.03, [0.12, 1.06, -0.32], 'eye', { glow: true }),
      box(0.12, 0.08, 0.1, [0, 0.96, -0.32], 'accent'),
      cone(0.03, 0.1, [-0.05, 0.86, -0.3], 'eye', { r: [Math.PI, 0, 0] }),
      cone(0.03, 0.1, [0.05, 0.86, -0.3], 'eye', { r: [Math.PI, 0, 0] }),
      wing(-1),
      wing(1),
      // little claws dangling under it
      box(0.05, 0.16, 0.05, [-0.1, 0.42, 0.04], 'joint'),
      box(0.05, 0.16, 0.05, [0.1, 0.42, 0.04], 'joint'),
      ...muzzle([0, 0.92, -0.46]),
    ], { role: 'turret' }),
  ]),
};

// ---------- Rubble Golem: walking rock, slow and very hard to knock down, heavy marbles ----------
const golem: CharacterDef = {
  ...base,
  id: 'golem',
  fit: [1.6, 1.6, 1.6],
  name: 'Rubble Golem',
  ball: 0xffa02a,
  palette: { body: 0x8a847a, trim: 0x5a564e, accent: 0x5a8a3a, joint: 0x3e3a34, wing: 0x8a847a, wingTip: 0x8a847a, eye: 0xffa02a },
  traits: { speed: 1, fireRate: 2, health: 5, agility: 1 },
  blueprint: root([
    ...[-1, 1].map((sd) =>
      group([sd * 0.3, 0.56, 0], [box(0.34, 0.42, 0.36, [0, -0.2, 0], 'body'), box(0.46, 0.16, 0.52, [0, -0.48, -0.06], 'trim')], { role: 'leg' }),
    ),
    box(0.7, 0.16, 0.5, [0, 0.6, 0], 'trim'),
    group([0, 0.66, 0], [
      blk('rbox', { width: 1.04, height: 0.72, depth: 0.74, radius: 0.1 }, [0, 0.38, 0], 'body'),
      // moss on the shoulders, a glowing rune in the chest, a small head sunk between the shoulders
      box(0.36, 0.08, 0.5, [-0.3, 0.76, 0.04], 'accent'),
      box(0.24, 0.08, 0.4, [0.34, 0.76, 0.1], 'accent'),
      box(0.26, 0.26, 0.04, [0, 0.36, -0.38], 'eye', { glow: true, r: [0, 0, Math.PI / 4] }),
      box(0.4, 0.3, 0.36, [0, 0.86, -0.12], 'trim'),
      box(0.08, 0.05, 0.03, [-0.09, 0.88, -0.31], 'eye', { glow: true }),
      box(0.08, 0.05, 0.03, [0.09, 0.88, -0.31], 'eye', { glow: true }),
      // huge arms ending in boulder fists, swinging as it lumbers
      ...[-1, 1].map((sd) =>
        group([sd * 0.66, 0.56, 0], [box(0.28, 0.5, 0.3, [0, -0.2, 0], 'body'), box(0.44, 0.4, 0.44, [0, -0.56, -0.04], 'trim')], { role: 'swing' }),
      ),
      ...muzzle([0, 0.36, -0.52]),
    ], { role: 'turret' }),
  ]),
};

// ---------- Hex Wraith: a floating spirit in a ragged robe, freezing what it hits ----------
const wraith: CharacterDef = {
  ...base,
  id: 'wraith',
  fit: [1.5, 1.5, 1.5],
  name: 'Hex Wraith',
  ball: 0x5af0ff,
  palette: { body: 0x3a2a5a, trim: 0x241a3a, accent: 0x5af0ff, joint: 0x5a4a7a, wing: 0x3a2a5a, wingTip: 0x3a2a5a, eye: 0x5af0ff },
  traits: { speed: 3, fireRate: 3, health: 3, agility: 3 },
  blueprint: root([
    group([0, 0, 0], [
      cone(0.5, 1.1, [0, 0.72, 0], 'body'),
      // a ragged hem
      ...[0, 1, 2, 3, 4, 5].map((k) => {
        const a = (k / 6) * Math.PI * 2;
        return box(0.18, 0.22, 0.06, [Math.sin(a) * 0.42, 0.22, Math.cos(a) * 0.42], 'trim', { r: [0, a, 0] });
      }),
      // the hood, the dark inside it and two cold eyes
      ball(0.32, [0, 1.3, 0.02], 'body'),
      ball(0.24, [0, 1.27, -0.1], 'trim'),
      box(0.07, 0.05, 0.03, [-0.08, 1.3, -0.33], 'eye', { glow: true }),
      box(0.07, 0.05, 0.03, [0.08, 1.3, -0.33], 'eye', { glow: true }),
      cone(0.1, 0.3, [0, 1.6, 0.12], 'body', { r: [-0.5, 0, 0] }),
      // sleeves, and the orb it casts from
      group([-0.36, 1.0, 0], [cone(0.12, 0.42, [0, -0.16, -0.06], 'joint', { r: [0.5, 0, 0] })], { role: 'swing' }),
      group([0.36, 1.0, 0], [cone(0.12, 0.42, [0, -0.16, -0.08], 'joint', { r: [0.7, 0, 0] }), ball(0.13, [0, -0.32, -0.32], 'accent', { glow: true }), ball(0.2, [0, -0.32, -0.32], 'accent', { glow: true, opacity: 0.35 })], { role: 'swing' }),
      ...muzzle([0.36, 0.68, -0.5]),
    ], { role: 'turret' }),
  ]),
};

export const MONSTERS: CharacterDef[] = [bonewalker, gloop, duskwing, golem, wraith];
export const isMonster = (id: string) => MONSTERS.some((m) => m.id === id);

// ---------- the bosses: one for each stage of the dungeon ----------

const pal = (body: number, trim: number, accent: number, joint: number, eye: number) => ({ body, trim, accent, joint, wing: body, wingTip: trim, eye });

// 1 · The Crypt: the Bone King, a towering skeleton in a crown, a scepter in its fist
const boneKing: CharacterDef = {
  ...base,
  id: 'boneking',
  name: 'Bone King',
  fit: [2.1, 2.1, 2.1],
  ball: 0xffd23e,
  palette: pal(0xece6d4, 0x2a2420, 0xe8b43a, 0xb8b0a0, 0x7affb0),
  traits: { speed: 2, fireRate: 3, health: 4, agility: 3 },
  blueprint: root([
    ...[-1, 1].map((sd) => group([sd * 0.2, 0.56, 0], [box(0.12, 0.48, 0.12, [0, -0.22, 0], 'body'), box(0.2, 0.08, 0.34, [0, -0.5, -0.06], 'body')], { role: 'leg' })),
    box(0.46, 0.12, 0.24, [0, 0.58, 0], 'body'),
    // a tattered royal cape behind
    box(0.7, 0.9, 0.04, [0, 0.62, 0.22], 'accent'),
    group([0, 0.62, 0], [
      box(0.1, 0.5, 0.1, [0, 0.24, 0.06], 'joint'),
      ...[0.14, 0.27, 0.4].map((y, i) => box(0.56 - i * 0.04, 0.06, 0.32, [0, y, 0], 'body')),
      box(0.62, 0.1, 0.34, [0, 0.52, 0], 'accent'),
      blk('rbox', { width: 0.46, height: 0.4, depth: 0.42, radius: 0.08 }, [0, 0.82, 0], 'body'),
      box(0.13, 0.11, 0.04, [-0.11, 0.84, -0.21], 'trim'),
      box(0.13, 0.11, 0.04, [0.11, 0.84, -0.21], 'trim'),
      box(0.06, 0.06, 0.03, [-0.11, 0.84, -0.235], 'eye', { glow: true }),
      box(0.06, 0.06, 0.03, [0.11, 0.84, -0.235], 'eye', { glow: true }),
      group([0, 0.64, 0.02], [box(0.36, 0.08, 0.36, [0, -0.02, -0.04], 'body')], { role: 'jaw' }),
      // the crown: a gold band with points
      box(0.5, 0.1, 0.46, [0, 1.06, 0], 'accent'),
      ...[-0.18, 0, 0.18].map((x) => cone(0.06, 0.18, [x, 1.2, -0.18], 'accent')),
      ...[-0.18, 0.18].map((x) => cone(0.06, 0.18, [x, 1.2, 0.18], 'accent')),
      group([-0.36, 0.46, 0], [box(0.09, 0.46, 0.09, [0, -0.2, 0], 'body'), box(0.13, 0.12, 0.13, [0, -0.46, 0], 'joint')], { role: 'swing' }),
      // the scepter: a gold rod with a glowing green gem
      group([0.36, 0.46, 0], [box(0.09, 0.46, 0.09, [0, -0.2, 0], 'body'), box(0.06, 0.06, 0.8, [0, -0.44, -0.26], 'accent'), ball(0.1, [0, -0.44, -0.7], 'eye', { glow: true })], { role: 'swing' }),
      ...muzzle([0.36, 0.02, -0.8]),
    ], { role: 'turret' }),
  ]),
};

// 2 · Frozen Caverns: the Frost Yeti, a hulking shaggy beast with ice horns
const frostYeti: CharacterDef = {
  ...base,
  id: 'frostyeti',
  name: 'Frost Yeti',
  fit: [2.09, 2.09, 2.09],
  ball: 0x8ae8ff,
  palette: pal(0xf2f6fa, 0x9ac8e8, 0x4a8ad0, 0xc8d8e8, 0x2a6ad8),
  traits: { speed: 2, fireRate: 2, health: 5, agility: 2 },
  blueprint: root([
    ...[-1, 1].map((sd) => group([sd * 0.28, 0.5, 0], [box(0.34, 0.4, 0.36, [0, -0.18, 0], 'body'), box(0.4, 0.14, 0.48, [0, -0.44, -0.06], 'trim')], { role: 'leg' })),
    group([0, 0.56, 0], [
      blk('rbox', { width: 1.0, height: 0.86, depth: 0.76, radius: 0.16 }, [0, 0.44, 0.04], 'body'),
      // shaggy tufts
      ...[[-0.4, 0.8], [0.4, 0.8], [-0.46, 0.4], [0.46, 0.4], [0, 0.92]].map(([x, y]) => box(0.24, 0.2, 0.24, [x, y, 0.1], 'body', { r: [0, 0.6, 0.4] })),
      // a blue face, angry eyes, a fanged mouth
      box(0.5, 0.42, 0.06, [0, 0.62, -0.36], 'accent'),
      box(0.1, 0.06, 0.03, [-0.12, 0.72, -0.4], 'eye', { glow: true }),
      box(0.1, 0.06, 0.03, [0.12, 0.72, -0.4], 'eye', { glow: true }),
      box(0.34, 0.08, 0.03, [-0, 0.78, -0.4], 'trim', { r: [0, 0, 0] }),
      group([0, 0.5, -0.36], [box(0.32, 0.1, 0.08, [0, 0, 0], 'trim'), cone(0.03, 0.08, [-0.1, 0.06, -0.03], 'body'), cone(0.03, 0.08, [0.1, 0.06, -0.03], 'body')], { role: 'jaw' }),
      // ice horns
      cone(0.09, 0.42, [-0.38, 1.02, -0.04], 'trim', { r: [0, 0, 0.6] }),
      cone(0.09, 0.42, [0.38, 1.02, -0.04], 'trim', { r: [0, 0, -0.6] }),
      // long arms, big fists
      ...[-1, 1].map((sd) => group([sd * 0.62, 0.7, 0], [box(0.3, 0.62, 0.32, [0, -0.26, 0], 'body'), box(0.38, 0.32, 0.38, [0, -0.66, -0.04], 'trim')], { role: 'swing' })),
      ...muzzle([0, 0.5, -0.5]),
    ], { role: 'turret' }),
  ]),
};

// 3 · Overgrown Ruins: Thornroot, a walking tree with branch arms and a glowing heart
const thornroot: CharacterDef = {
  ...base,
  id: 'thornroot',
  name: 'Thornroot',
  fit: [1.75, 1.75, 1.75],
  ball: 0x9aff6a,
  palette: pal(0x6a4a2e, 0x3e2a1a, 0x4ab83a, 0x2e7a26, 0xc8ff5a),
  traits: { speed: 2, fireRate: 3, health: 5, agility: 2 },
  blueprint: root([
    // roots for feet
    ...[-1, 1].map((sd) => group([sd * 0.24, 0.46, 0], [box(0.26, 0.42, 0.26, [0, -0.18, 0], 'body'), box(0.5, 0.1, 0.16, [sd * 0.08, -0.43, -0.12], 'trim', { r: [0, sd * 0.4, 0] }), box(0.12, 0.1, 0.42, [0, -0.43, -0.14], 'trim')], { role: 'leg' })),
    group([0, 0.52, 0], [
      box(0.66, 1.0, 0.56, [0, 0.5, 0], 'body'),
      box(0.12, 0.8, 0.04, [-0.2, 0.5, -0.29], 'trim'),
      box(0.12, 0.6, 0.04, [0.22, 0.42, -0.29], 'trim'),
      // the glowing heart in the bark, two eyes in the knots
      box(0.2, 0.22, 0.04, [0, 0.46, -0.3], 'eye', { glow: true, r: [0, 0, Math.PI / 4] }),
      box(0.1, 0.06, 0.03, [-0.14, 0.84, -0.3], 'eye', { glow: true }),
      box(0.1, 0.06, 0.03, [0.14, 0.84, -0.3], 'eye', { glow: true }),
      // the crown of leaves
      blk('rbox', { width: 1.1, height: 0.5, depth: 0.9, radius: 0.12 }, [0, 1.2, 0.04], 'accent'),
      blk('rbox', { width: 0.7, height: 0.36, depth: 0.6, radius: 0.1 }, [0.2, 1.5, 0.1], 'joint'),
      // branch arms ending in leafy clumps
      ...[-1, 1].map((sd) => group([sd * 0.4, 0.86, 0], [box(0.14, 0.14, 0.5, [sd * 0.14, -0.06, -0.12], 'body', { r: [0, sd * 0.6, sd * 0.3] }), box(0.12, 0.5, 0.12, [sd * 0.3, -0.3, -0.24], 'body'), blk('rbox', { width: 0.32, height: 0.28, depth: 0.32, radius: 0.08 }, [sd * 0.3, -0.58, -0.26], 'accent')], { role: 'swing' })),
      ...muzzle([0, 0.46, -0.5]),
    ], { role: 'turret' }),
  ]),
};

// 4 · Molten Depths: the Cinder Brute, rock cracked open with lava, flames on its back
const cinderBrute: CharacterDef = {
  ...base,
  id: 'cinderbrute',
  name: 'Cinder Brute',
  fit: [1.96, 1.96, 1.96],
  ball: 0xff6a1a,
  palette: pal(0x3a2a26, 0x221816, 0xff6a1a, 0x5a3a2e, 0xffd23e),
  traits: { speed: 2, fireRate: 2, health: 5, agility: 2 },
  blueprint: root([
    ...[-1, 1].map((sd) => group([sd * 0.32, 0.56, 0], [box(0.36, 0.44, 0.38, [0, -0.2, 0], 'body'), box(0.06, 0.3, 0.04, [0, -0.2, -0.2], 'accent', { glow: true }), box(0.48, 0.16, 0.54, [0, -0.48, -0.06], 'trim')], { role: 'leg' })),
    group([0, 0.62, 0], [
      blk('rbox', { width: 1.1, height: 0.8, depth: 0.8, radius: 0.12 }, [0, 0.42, 0], 'body'),
      // lava cracks
      box(0.06, 0.5, 0.04, [-0.2, 0.42, -0.41], 'accent', { glow: true, r: [0, 0, 0.3] }),
      box(0.06, 0.4, 0.04, [0.24, 0.36, -0.41], 'accent', { glow: true, r: [0, 0, -0.4] }),
      box(0.5, 0.05, 0.04, [0, 0.16, -0.41], 'accent', { glow: true }),
      // a molten core, a horned head with fire eyes
      box(0.28, 0.28, 0.06, [0, 0.46, -0.42], 'eye', { glow: true, r: [0, 0, Math.PI / 4] }),
      box(0.46, 0.36, 0.4, [0, 0.96, -0.12], 'trim'),
      box(0.1, 0.06, 0.03, [-0.11, 0.98, -0.33], 'eye', { glow: true }),
      box(0.1, 0.06, 0.03, [0.11, 0.98, -0.33], 'eye', { glow: true }),
      cone(0.08, 0.34, [-0.28, 1.2, -0.1], 'trim', { r: [0, 0, 0.7] }),
      cone(0.08, 0.34, [0.28, 1.2, -0.1], 'trim', { r: [0, 0, -0.7] }),
      // flames rising off its back
      cone(0.16, 0.5, [-0.26, 1.0, 0.34], 'accent', { glow: true }),
      cone(0.2, 0.62, [0.06, 1.06, 0.36], 'eye', { glow: true }),
      cone(0.14, 0.44, [0.32, 0.98, 0.32], 'accent', { glow: true }),
      ...[-1, 1].map((sd) => group([sd * 0.72, 0.64, 0], [box(0.32, 0.52, 0.34, [0, -0.22, 0], 'body'), box(0.48, 0.42, 0.48, [0, -0.6, -0.04], 'trim'), box(0.5, 0.06, 0.5, [0, -0.6, -0.04], 'accent', { glow: true })], { role: 'swing' })),
      ...muzzle([0, 0.46, -0.6]),
    ], { role: 'turret' }),
  ]),
};

// 5 · Sunken Grotto: the Tidecrab, a giant crab, claws up, its marbles skimming off the walls
const tidecrab: CharacterDef = {
  ...base,
  id: 'tidecrab',
  name: 'Tidecrab',
  fit: [2.24, 2.24, 2.24],
  ball: 0x5ae0ff,
  palette: pal(0xe8503a, 0x9a2a1e, 0xffc8a0, 0x6a1a14, 0x111111),
  traits: { speed: 3, fireRate: 3, health: 4, agility: 3 },
  blueprint: root([
    // four legs a side (two drive the walk, the rest ride along)
    ...[-1, 1].map((sd) => group([sd * 0.5, 0.42, 0.04], [
      ...[-0.18, 0, 0.18, 0.34].map((z) => box(0.42, 0.08, 0.08, [sd * 0.2, -0.1, z], 'trim', { r: [0, 0, sd * -0.7] })),
    ], { role: 'leg' })),
    group([0, 0.4, 0], [
      blk('rbox', { width: 1.2, height: 0.42, depth: 0.86, radius: 0.16 }, [0, 0.22, 0.06], 'body'),
      blk('rbox', { width: 0.9, height: 0.16, depth: 0.6, radius: 0.06 }, [0, 0.46, 0.08], 'trim'),
      box(0.8, 0.06, 0.1, [0, 0.2, -0.38], 'accent'),
      // eyes on stalks
      ...[-0.2, 0.2].map((x) => group([x, 0.42, -0.3], [box(0.05, 0.3, 0.05, [0, 0.14, 0], 'trim'), ball(0.08, [0, 0.32, 0], 'accent'), ball(0.04, [0, 0.33, -0.07], 'eye')])),
      group([0, 0.16, -0.42], [box(0.26, 0.06, 0.06, [0, 0, 0], 'joint')], { role: 'jaw' }),
      // the claws, raised
      ...[-1, 1].map((sd) => group([sd * 0.56, 0.3, -0.2], [
        box(0.12, 0.12, 0.42, [sd * 0.06, 0.12, -0.18], 'trim', { r: [0.5, sd * -0.3, 0] }),
        blk('rbox', { width: 0.36, height: 0.26, depth: 0.38, radius: 0.08 }, [sd * 0.1, 0.36, -0.46], 'body'),
        box(0.08, 0.2, 0.28, [sd * 0.22, 0.52, -0.58], 'body', { r: [0.4, 0, 0] }),
      ], { role: 'swing' })),
      ...muzzle([0, 0.24, -0.62]),
    ], { role: 'turret' }),
  ]),
};

// 6 · Neon Vault: the Glitch Sentinel, a floating cube with one eye, neon seams and shards orbiting
const glitchSentinel: CharacterDef = {
  ...base,
  id: 'glitchsentinel',
  name: 'Glitch Sentinel',
  fit: [2.29, 2.29, 2.29],
  ball: 0xff2bd6,
  palette: pal(0x2a1e3a, 0x14101e, 0xff2bd6, 0x2bf0ff, 0x2bf0ff),
  traits: { speed: 3, fireRate: 4, health: 4, agility: 3 },
  blueprint: root([
    group([0, 0, 0], [
      blk('rbox', { width: 0.9, height: 0.9, depth: 0.9, radius: 0.08 }, [0, 1.0, 0], 'body'),
      // neon seams round the cube
      box(0.94, 0.04, 0.94, [0, 1.0, 0], 'accent', { glow: true }),
      box(0.04, 0.94, 0.94, [0, 1.0, 0], 'joint', { glow: true }),
      // the eye: a ring and a pupil
      blk('torus', { radius: 0.2, tube: 0.05, radialSegments: 8, tubularSegments: 20 }, [0, 1.02, -0.46], 'joint', { glow: true }),
      ball(0.1, [0, 1.02, -0.46], 'accent', { glow: true }),
      // shards hovering round it, and a beam of light underneath
      ...[0, 1, 2, 3].map((k) => {
        const a = (k / 4) * Math.PI * 2 + 0.4;
        return box(0.16, 0.3, 0.16, [Math.sin(a) * 0.82, 1.0 + (k % 2 ? 0.2 : -0.2), Math.cos(a) * 0.82], k % 2 ? 'accent' : 'joint', { glow: true, r: [0.5, a, 0.5] });
      }),
      cone(0.3, 0.5, [0, 0.36, 0], 'joint', { glow: true, opacity: 0.4, r: [Math.PI, 0, 0] }),
      ...muzzle([0, 1.02, -0.6]),
    ], { role: 'turret' }),
  ]),
};

// 7 · Star Vault: the Void Herald, a crowned crystal spirit wrapped in a starry cloak
const voidHerald: CharacterDef = {
  ...base,
  id: 'voidherald',
  name: 'Void Herald',
  fit: [1.74, 1.74, 1.74],
  ball: 0x9a7aff,
  palette: pal(0x1a1440, 0x0a0820, 0x9a7aff, 0x3ef0ff, 0xffffff),
  traits: { speed: 3, fireRate: 3, health: 5, agility: 4 },
  blueprint: root([
    group([0, 0, 0], [
      // the cloak, flecked with stars
      cone(0.56, 1.2, [0, 0.74, 0.04], 'body'),
      ...[[0.2, 0.5, -0.3], [-0.24, 0.8, -0.2], [0.1, 1.0, -0.18], [-0.1, 0.36, -0.42], [0.3, 0.3, 0.2]].map(([x, y, z]) => box(0.04, 0.04, 0.04, [x, y, z], 'eye', { glow: true })),
      // a crystal body rising out of it, a crystal head with a crown of points
      blk('cone', { radius: 0.3, height: 0.7, radialSegments: 4 }, [0, 1.36, 0], 'accent', { r: [Math.PI, Math.PI / 4, 0] }),
      blk('cone', { radius: 0.22, height: 0.44, radialSegments: 4 }, [0, 1.84, 0], 'joint', { glow: true, r: [0, Math.PI / 4, 0] }),
      blk('cone', { radius: 0.22, height: 0.24, radialSegments: 4 }, [0, 1.56, 0], 'joint', { glow: true, r: [Math.PI, Math.PI / 4, 0] }),
      ...[-0.22, 0, 0.22].map((x, i) => cone(0.04, 0.26 + (i === 1 ? 0.12 : 0), [x, 2.12, 0], 'accent', { glow: true })),
      // a halo ring behind its head
      blk('torus', { radius: 0.42, tube: 0.03, radialSegments: 6, tubularSegments: 28 }, [0, 1.7, 0.2], 'accent', { glow: true }),
      // hands of light, one holding the star it fires
      group([-0.44, 1.2, 0], [ball(0.1, [0, -0.1, -0.1], 'joint', { glow: true })], { role: 'swing' }),
      group([0.44, 1.2, 0], [ball(0.1, [0, -0.1, -0.1], 'joint', { glow: true }), ball(0.14, [0, -0.1, -0.36], 'eye', { glow: true }), ball(0.24, [0, -0.1, -0.36], 'accent', { glow: true, opacity: 0.35 })], { role: 'swing' }),
      ...muzzle([0.44, 1.1, -0.54]),
    ], { role: 'turret' }),
  ]),
};

/** each stage's boss, in order */
export const BOSSES: CharacterDef[] = [boneKing, frostYeti, thornroot, cinderBrute, tidecrab, glitchSentinel, voidHerald];
