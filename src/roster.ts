// The editable roster: per-unit overrides (name, traits, colours, block design)
// and fully custom units, saved on the device. The game and the Unit Lab
// page share it through localStorage, so edits show up on the next load.

export type V3 = [number, number, number];

/** gameplay traits, each a 1-5 level where 3 is the standard unit */
export interface Traits {
  speed: number;
  fireRate: number;
  health: number;
  agility: number;
}

export const DEFAULT_TRAITS: Traits = { speed: 3, fireRate: 3, health: 3, agility: 3 };

/** level -> multiplier on the base stat */
const TRAIT_MUL = [0.7, 0.85, 1, 1.18, 1.36];
export const traitMul = (n: number | undefined) => TRAIT_MUL[Math.max(1, Math.min(5, Math.round(n ?? 3))) - 1];

/** palette slots a block can take its colour from, so recolouring a unit is one edit */
export type PaletteSlot = 'body' | 'trim' | 'accent' | 'joint' | 'eye' | 'ball';
export type ColorRef = PaletteSlot | number;

/** parts the animation drives (walk cycle, aiming, recoil, jaw snap, flame flicker) and the belly launch point */
export type Role = 'turret' | 'barrel' | 'belly' | 'leg' | 'jaw' | 'flame' | 'trigger' | 'wings' | 'wingL' | 'wingR';

export type Shape = 'group' | 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus';

/** One block of a unit's design. Groups hold other blocks and move them together. */
export interface Block {
  shape: Shape;
  name?: string;
  /** three.js geometry parameters for the shape (width/height/depth, radius, ...) */
  size?: Record<string, number | boolean>;
  mat?: {
    kind: 'lambert' | 'basic' | 'phong';
    color: ColorRef;
    double?: boolean;
    opacity?: number;
    additive?: boolean;
  };
  p: V3;
  r: V3;
  s: V3;
  role?: Role;
  children?: Block[];
}

export interface UnitEntry {
  /** built-in id for an override; a new id for a custom unit */
  id: string;
  /** the built-in unit this one started from (portrait style, defaults) */
  base: string;
  name?: string;
  ball?: number;
  palette?: Partial<Record<Exclude<PaletteSlot, 'ball'>, number>>;
  traits?: Traits;
  blueprint?: Block;
}

export interface RosterData {
  units: Record<string, UnitEntry>;
}

const KEY = 'marble-fighter:roster:v1';
let memory: RosterData = { units: {} };

export function loadRoster(): RosterData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RosterData;
      if (parsed && typeof parsed.units === 'object') memory = parsed;
    }
  } catch {
    // keep the in-memory copy
  }
  return memory;
}

export function saveRoster(data: RosterData) {
  memory = data;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
