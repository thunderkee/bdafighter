import { characterById, type CharacterDef } from './robot';
import type { BallTex } from './patterns';
import { kitOf } from './kits';

/**
 * Cosmetic rewards: every fighter earns the same track as it levels up (a nameplate, marble
 * skins, eye colours, and its own three paint jobs from its kit). Its head, back and shoulder
 * parts (also from its kit) are free to wear. Nothing here changes how a fighter plays.
 */
export type Slot = 'plate' | 'marble' | 'paint' | 'eyes' | 'hat' | 'back' | 'shoulder';
export interface Reward {
  lv: number;
  slot: Slot;
  id: string;
  name: string;
}

export const REWARDS: Reward[] = [
  { lv: 2, slot: 'plate', id: 'bronze', name: 'Bronze nameplate' },
  { lv: 3, slot: 'marble', id: 'pearl', name: 'Pearl marbles' },
  // (paint:N is the fighter's own Nth paint job, see rewardsOf)
  { lv: 4, slot: 'paint', id: 'paint:0', name: 'Paint job' },
  { lv: 5, slot: 'eyes', id: 'gold', name: 'Gold eyes' },
  { lv: 6, slot: 'marble', id: 'galaxy', name: 'Galaxy marbles' },
  { lv: 7, slot: 'paint', id: 'paint:1', name: 'Paint job' },
  { lv: 8, slot: 'marble', id: 'lava', name: 'Lava marbles' },
  { lv: 9, slot: 'plate', id: 'gold', name: 'Gold nameplate' },
  { lv: 10, slot: 'paint', id: 'paint:2', name: 'Paint job' },
];

export const SLOT_NAME: Record<Slot, string> = { paint: 'Paint', marble: 'Marbles', eyes: 'Eyes', plate: 'Nameplate', hat: 'Head', back: 'Back', shoulder: 'Shoulders' };

/** what a fighter has equipped: one choice per slot (none is its standard look) */
export type Equip = Partial<Record<Slot, string>>;

/** the reward track as this fighter sees it: its own paint jobs named (none for a custom unit) */
export function rewardsOf(id: string): Reward[] {
  const kit = kitOf(characterById(id));
  return REWARDS.flatMap((r) => {
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
const EYES: Record<string, number> = { gold: 0xffd23e };

/** the fighter as it looks with these cosmetics on (its definition, recoloured) */
export function skinned(id: string, equip: Equip | undefined): CharacterDef {
  const def = characterById(id);
  if (!equip) return def;
  const palette = { ...def.palette };
  const kit = kitOf(def);
  const pj = equip.paint ? kit?.paint.find((k) => k.id === equip.paint) : undefined;
  if (pj) Object.assign(palette, pj.palette);
  if (equip.eyes && EYES[equip.eyes] !== undefined) palette.eye = EYES[equip.eyes];
  const mb = equip.marble ? MARBLES[equip.marble] : undefined;
  // its own parts (an id saved from before, or from another fighter, finds nothing and is left off)
  const part = (slot: 'hat' | 'back' | 'shoulder') => kit?.[slot].find((k) => k.id === equip[slot]);
  const gear = { hat: part('hat'), back: part('back'), shoulder: part('shoulder') };
  const anyGear = gear.hat || gear.back || gear.shoulder;
  return { ...def, palette, ball: mb?.ball ?? def.ball, ballTex: mb?.tex ?? def.ballTex, gear: anyGear ? gear : undefined };
}

/** a short key for an equip, to tell when a model needs rebuilding */
export const equipKey = (e: Equip | undefined) => (e ? `${e.paint ?? ''}|${e.marble ?? ''}|${e.eyes ?? ''}|${e.hat ?? ''}|${e.back ?? ''}|${e.shoulder ?? ''}` : '');
