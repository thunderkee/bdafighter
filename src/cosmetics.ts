import { characterById, type CharacterDef } from './robot';
import type { BallTex } from './patterns';
import { kitOf, paintPalette, skinOf, skinsOf } from './kits';

/**
 * Cosmetics: every fighter has five skins (versions of itself with their own parts and stats,
 * see kits.ts), three paint jobs and three marble finishes. The first skin is free; the rest
 * unlock as the fighter levels up, along with the paint jobs and marbles.
 */
export type Slot = 'skin' | 'paint' | 'marble';
export interface Reward {
  lv: number;
  slot: Slot;
  id: string;
  name: string;
}

export const REWARDS: Reward[] = [
  // (skin:N is the fighter's own Nth skin, paint:N its Nth paint job, see rewardsOf)
  { lv: 2, slot: 'skin', id: 'skin:1', name: 'Skin' },
  { lv: 3, slot: 'marble', id: 'pearl', name: 'Pearl marbles' },
  { lv: 4, slot: 'paint', id: 'paint:0', name: 'Paint job' },
  { lv: 5, slot: 'skin', id: 'skin:2', name: 'Skin' },
  { lv: 6, slot: 'marble', id: 'galaxy', name: 'Galaxy marbles' },
  { lv: 7, slot: 'paint', id: 'paint:1', name: 'Paint job' },
  { lv: 8, slot: 'skin', id: 'skin:3', name: 'Skin' },
  { lv: 9, slot: 'marble', id: 'lava', name: 'Lava marbles' },
  { lv: 10, slot: 'paint', id: 'paint:2', name: 'Paint job' },
  { lv: 10, slot: 'skin', id: 'skin:4', name: 'Skin' },
];

export const SLOT_NAME: Record<Slot, string> = { skin: 'Skin', paint: 'Paint', marble: 'Marbles' };

/** what a fighter has equipped: one choice per slot (none is its standard look) */
export type Equip = Partial<Record<Slot, string>>;

/** the reward track as this fighter sees it: its own skins and paint jobs named */
export function rewardsOf(id: string): Reward[] {
  const def = characterById(id);
  const kit = kitOf(def);
  const skins = skinsOf(def);
  return REWARDS.flatMap((r) => {
    if (r.id.startsWith('skin:')) {
      const sk = skins[Number(r.id.slice(5))];
      return sk ? [{ ...r, id: sk.id, name: `${sk.name} skin` }] : [];
    }
    if (!r.id.startsWith('paint:')) return [r];
    const pj = kit?.paint[Number(r.id.slice(6))];
    return pj ? [{ ...r, id: pj.id, name: `${pj.name} paint` }] : [];
  });
}
const MARBLES: Record<string, { ball: number; tex: BallTex }> = {
  pearl: { ball: 0xf4ece0, tex: 'ring' },
  galaxy: { ball: 0x7a5aff, tex: 'galaxy' },
  lava: { ball: 0xff6a1a, tex: 'lava' },
};

/** the fighter as it is with these on: its skin's model, parts and stats, recoloured */
export function skinned(id: string, equip: Equip | undefined): CharacterDef {
  const def = characterById(id);
  if (!equip) return def;
  const palette = { ...def.palette };
  const kit = kitOf(def);
  const pj = equip.paint ? kit?.paint.find((k) => k.id === equip.paint) : undefined;
  if (pj) Object.assign(palette, paintPalette(def, pj));
  const mb = equip.marble ? MARBLES[equip.marble] : undefined;
  const sk = skinOf(def, equip.skin);
  const anyGear = sk.gear.hat || sk.gear.back || sk.gear.shoulder;
  return {
    ...def,
    palette,
    ball: mb?.ball ?? def.ball,
    ballTex: mb?.tex ?? def.ballTex,
    gear: anyGear ? sk.gear : undefined,
    traits: sk.traits,
    blueprint: sk.blueprint ?? def.blueprint,
  };
}

/** a short key for an equip, to tell when a model needs rebuilding */
export const equipKey = (e: Equip | undefined) => (e ? `${e.skin ?? ''}|${e.paint ?? ''}|${e.marble ?? ''}` : '');

const hex = (n: number) => `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;
/** the colours a choice shows on its Customize tile: a paint job's body, trim and accent, or a marble's colour */
export function swatchOf(id: string, slot: Slot, v: string): string[] {
  const def = characterById(id);
  if (slot === 'marble') return [hex(MARBLES[v]?.ball ?? def.ball)];
  const pj = v ? kitOf(def)?.paint.find((k) => k.id === v) : undefined;
  const pal = pj ? { ...def.palette, ...paintPalette(def, pj) } : def.palette;
  return [hex(pal.body), hex(pal.trim), hex(pal.accent)];
}
