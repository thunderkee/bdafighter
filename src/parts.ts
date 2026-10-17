import { BASE_STATS, type ShooterStats } from './config';

// Parts are pure data: each one multiplies or adds to base stats.
// New parts are added here (or loaded from JSON later) with no code changes.

export type Slot = 'barrel' | 'core' | 'magazine';

export interface PartDef {
  id: string;
  slot: Slot;
  name: string;
  /** multipliers applied to base stats (1 = unchanged) */
  mul?: Partial<Record<keyof ShooterStats, number>>;
  /** flat additions applied after multipliers */
  add?: Partial<Record<keyof ShooterStats, number>>;
}

export const PARTS: PartDef[] = [
  { id: 'barrel-standard', slot: 'barrel', name: 'Standard Barrel' },
  { id: 'core-standard', slot: 'core', name: 'Standard Core' },
  { id: 'mag-standard', slot: 'magazine', name: 'Standard Magazine' },
];

export type Build = Record<Slot, string>;

export const STARTER_BUILD: Build = {
  barrel: 'barrel-standard',
  core: 'core-standard',
  magazine: 'mag-standard',
};

export function computeStats(build: Build, overrides?: Partial<ShooterStats>): ShooterStats {
  const stats: ShooterStats = { ...BASE_STATS };
  const keys = Object.keys(stats).filter((k) => k !== 'twin' && k !== 'special') as Exclude<keyof ShooterStats, 'twin' | 'special' | 'fan'>[];
  for (const slot of Object.keys(build) as Slot[]) {
    const part = PARTS.find((p) => p.id === build[slot]);
    if (!part) continue;
    for (const k of keys) {
      if (part.mul?.[k] !== undefined) stats[k] *= part.mul[k]!;
    }
    for (const k of keys) {
      if (part.add?.[k] !== undefined) stats[k] += part.add[k]!;
    }
  }
  return { ...stats, ...overrides };
}
