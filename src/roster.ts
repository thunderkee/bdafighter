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
/**
 * Each trait has its own range. Speed and agility swing wide (a heavy unit crawls, a scout
 * darts); armour and fire rate stay closer to the middle, since they decide fights far more
 * directly.
 */
const TRAIT_MUL: Record<keyof Traits, number[]> = {
  speed: [0.5, 0.75, 1, 1.3, 1.6],
  agility: [0.55, 0.78, 1, 1.3, 1.6],
  health: [0.72, 0.86, 1, 1.18, 1.36],
  fireRate: [0.72, 0.86, 1, 1.18, 1.36],
};
export const traitMul = (n: number | undefined, kind: keyof Traits = 'speed') => TRAIT_MUL[kind][Math.max(1, Math.min(5, Math.round(n ?? 3))) - 1];

/** palette slots a block can take its colour from, so recolouring a unit is one edit */
export type PaletteSlot = 'body' | 'trim' | 'accent' | 'joint' | 'eye' | 'ball';
export type ColorRef = PaletteSlot | number;

/** parts the animation drives (walk cycle, aiming, recoil, jaw snap, flame flicker) and the belly launch point */
export type Role = 'turret' | 'barrel' | 'belly' | 'leg' | 'jaw' | 'flame' | 'trigger' | 'wings' | 'wingL' | 'wingR' | 'slash' | 'punch' | 'armR' | 'armL' | 'barrelL' | 'bellyL' | 'finger' | 'slashL' | 'jawL' | 'fistR' | 'fistL' | 'head';

export type Shape = 'group' | 'box' | 'rbox' | 'capsule' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'mesh';

/** an editable polygon mesh: flat xyz points, and faces as point loops (counter-clockwise from outside) */
export interface MeshData {
  v: number[];
  f: number[][];
}

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
  /** the points and faces of an editable 'mesh' block */
  mesh?: MeshData;
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

/** this device's own edits; the Unit Studio keeps its unpublished work under another key */
export const ROSTER_KEY = 'marble-fighter:roster:v1';
const memory: Record<string, RosterData> = {};

export function loadRoster(key = ROSTER_KEY): RosterData {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as RosterData;
      if (parsed && typeof parsed.units === 'object') memory[key] = parsed;
    }
  } catch {
    // keep the in-memory copy
  }
  return (memory[key] ??= { units: {} });
}

export function saveRoster(data: RosterData, key = ROSTER_KEY) {
  memory[key] = data;
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
