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
