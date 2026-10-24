import { characterById, type CharacterDef } from './robot';
import type { BallTex } from './patterns';

/**
 * Cosmetic rewards: every fighter earns the same track as it levels up (a nameplate, marble
 * skins, paint jobs and eye colours), each one adapted to that fighter. Nothing here changes
 * how a fighter plays.
 */
export type Slot = 'plate' | 'marble' | 'paint' | 'eyes';
export interface Reward {
  lv: number;
  slot: Slot;
  id: string;
  name: string;
}

export const REWARDS: Reward[] = [
  { lv: 2, slot: 'plate', id: 'bronze', name: 'Bronze nameplate' },
  { lv: 3, slot: 'marble', id: 'pearl', name: 'Pearl marbles' },
  { lv: 4, slot: 'paint', id: 'midnight', name: 'Midnight paint' },
  { lv: 5, slot: 'eyes', id: 'gold', name: 'Gold eyes' },
  { lv: 6, slot: 'marble', id: 'galaxy', name: 'Galaxy marbles' },
  { lv: 7, slot: 'paint', id: 'arctic', name: 'Arctic paint' },
  { lv: 8, slot: 'marble', id: 'lava', name: 'Lava marbles' },
  { lv: 9, slot: 'plate', id: 'gold', name: 'Gold nameplate' },
  { lv: 10, slot: 'paint', id: 'legend', name: 'Legend Gold paint' },
];

export const SLOT_NAME: Record<Slot, string> = { paint: 'Paint', marble: 'Marbles', eyes: 'Eyes', plate: 'Nameplate' };

/** what a fighter has equipped: one choice per slot (none is its standard look) */
export type Equip = Partial<Record<Slot, string>>;

const mix = (a: number, b: number, t: number) => {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

type Pal = CharacterDef['palette'];
/** paint jobs: built from the fighter's own colours, so each one still looks like itself */
const PAINTS: Record<string, (p: Pal) => Partial<Pal>> = {
  // its colours sunk into the night, the accent left glowing
  midnight: (p) => ({ body: mix(p.body, 0x12121a, 0.72), trim: mix(p.trim, 0x08080c, 0.6), joint: 0x0c0c10, wing: mix(p.wing ?? p.body, 0x12121a, 0.72), wingTip: p.accent }),
  // snow white and ice blue, its accent kept
  arctic: (p) => ({ body: 0xf2f8ff, trim: 0x3a8ee0, joint: 0x4a5a6c, wing: 0xf2f8ff, wingTip: 0x3a8ee0, accent: mix(p.accent, 0x8ae8ff, 0.5) }),
  // the champion's gold
  legend: () => ({ body: 0xe8b83a, trim: 0x2a1a0a, accent: 0xfff2c0, joint: 0x5a3a10, wing: 0xe8b83a, wingTip: 0x2a1a0a }),
};
const MARBLES: Record<string, { ball: number; tex: BallTex }> = {
  pearl: { ball: 0xf4ece0, tex: 'ring' },
  galaxy: { ball: 0x7a5aff, tex: 'galaxy' },
  lava: { ball: 0xff6a1a, tex: 'lava' },
};
const EYES: Record<string, number> = { gold: 0xffd23e };

/** the fighter as it looks with these cosmetics on (its definition, recoloured) */
export function skinned(id: string, equip: Equip | undefined): CharacterDef {
  const def = characterById(id);
  if (!equip) return def;
  const palette = { ...def.palette };
  const paint = equip.paint ? PAINTS[equip.paint] : undefined;
  if (paint) Object.assign(palette, paint(def.palette));
  if (equip.eyes && EYES[equip.eyes] !== undefined) palette.eye = EYES[equip.eyes];
  const mb = equip.marble ? MARBLES[equip.marble] : undefined;
  return { ...def, palette, ball: mb?.ball ?? def.ball, ballTex: mb?.tex ?? def.ballTex };
}

/** a short key for an equip, to tell when a model needs rebuilding */
export const equipKey = (e: Equip | undefined) => (e ? `${e.paint ?? ''}|${e.marble ?? ''}|${e.eyes ?? ''}` : '');
