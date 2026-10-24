import type { AILevel } from './config';
// Local save that never throws. Private mode, blocked storage or a full
// quota fall back to an in-memory copy for the session.

const KEY = 'marble-fighter:v1';

export interface Settings {
  /** mouse aims and click fires; off = mouse is ignored in a match */
  mouseAim: boolean;
  /** what left/right (keys and buttons) do: slide the shooter or turn its aim */
  arrows: 'move' | 'aim';
  /** touch gestures over the arena, or on-screen ◀ ▶ FIRE buttons */
  layout: 'gestures' | 'buttons';
  /** number of pushable pucks on the table (0-5) */
  pucks: number;
  /** show the player's dotted shooting line */
  aimLine: boolean;
  /** health display: the fighting-game top bar, or tags that follow each fighter */
  hudMode: 'top' | 'tags';
  /** buttons layout: move with the ◀ ▶ buttons or a slider */
  moveControl: 'buttons' | 'slider';
  /** table width: small / normal / large (rebuilds the arena, so it reloads the game) */
  arenaWidth: 'small' | 'normal' | 'large';
  /** CPU intelligence for the opponent pack and for your pack-mates */
  enemyIQ: AILevel;
  /** the rules screen's one-tap opponent preset (custom once Options' opponent settings are changed) */
  difficulty?: 'easy' | 'normal' | 'hard' | 'custom';
  allyIQ: AILevel;
  /** who each CPU pack goes after */
  enemyTactic: 'nearest' | 'weakest' | 'hunt';
  /** CPU opponents hold fire to charge big shots too */
  cpuCharge: boolean;
  /** and so do your CPU pack-mates */
  allyCharge: boolean;
  allyTactic: 'nearest' | 'weakest' | 'assist';
  /** your pack: you plus 0-2 CPU pack-mates (1-3) */
  playerPack: number;
  /** opponent health level (1-5 -> 50/75/100/150/200%) */
  enemyHealth: number;
  /** opponent movement speed level (1-5, 3 = normal) */
  enemySpeed: number;
  /** opponent dodge skill level (1-5, 3 = normal) */
  enemyAgility: number;
  /** opponent marble power level (1-5, 3 = normal) */
  enemyPower: number;
  /** 'flexible' aims, leads and banks; 'straight' always fires straight ahead */
  enemyAim: 'flexible' | 'straight';
  /** player robot id (see CHARACTERS in robot.ts) */
  character: string;
  /** buzz the phone on hits */
  vibrate: boolean;
  /** background music (the sound effects are separate) */
  music: boolean;
  /** stage id (see STAGES in stage.ts) */
  stage: string;
  /** air-drop items on/off */
  items: boolean;
  /** moving power gates on/off */
  gates: boolean;
  /** buttons layout: one FIRE, or front-left / front / front-right */
  fireButtons: 'single' | 'triple';
  /** opponent robot id, or 'auto' for one different from yours */
  enemyCharacter: string;
  /** chase camera distance, down to a first-person cockpit view */
  camera: 'far' | 'mid' | 'near' | 'first';
  /** special effects: ThorVG overlay, sparks, smoke, afterimages */
  effects: boolean;
  /** realism: marble hops/spin/shadows, stage particles, full pixel density */
  realism: boolean;
  /** cel shading: banded toon lighting with ink outlines */
  cel: boolean;
  /** battery saver: a lighter render (less resolution and post) and 30 fps (on by default on phones) */
  batterySaver: boolean;
  /** frame-rate meter in the corner */
  showFps: boolean;
  /** marbles per magazine for both robots (3-10), when magazines are equal */
  magazine: number;
  /** magazines per fighter (from its marble type) instead of one size for both */
  magPer: boolean;
  /** round length in seconds: 60, 90, or 0 for no limit */
  roundTime: number;
  /** fire rate: balls per trigger pull for both robots (1-5) */
  burst: number;
  /** opponents in the pack (1-3) */
  pack: number;
  /** destructible cover walls per side (0-3) */
  covers: number;
  /** pinball pins on the table (0-8) */
  pins: number;
}

export interface SaveData {
  matches: number;
  wins: number;
  /** the furthest arcade stage cleared */
  arcadeBest?: number;
  /** XP each fighter has earned (by unit id) */
  fighterXp?: Record<string, number>;
  /** each fighter's equipped cosmetics (paint, marbles, eyes, nameplate) */
  equip?: Record<string, Partial<Record<'plate' | 'marble' | 'paint' | 'eyes', string>>>;
  /** an arcade run in progress, to pick up after the app was closed: the stage to play next */
  arcadeRun?: { stage: number; cleared: number; cfg: Partial<Settings>; plan: Partial<Settings>[]; character: string; item?: string | null; at: number };
  /** the near chase camera became the default once; older saves are moved to it */
  nearCam?: boolean;
  /** a clear table (no pucks, walls or pins) became the default once */
  clearTable?: boolean;
  /** the simple rules (clear table, no power gates) and the mid camera became the default once */
  simpleRules?: boolean;
  /** every unit unlocked at once (Options > Advanced, for trying them all out) */
  unlockAll?: boolean;
  /** the tutorial was finished (or the offer turned down) */
  tutorialDone?: boolean;
  muted: boolean;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  mouseAim: true,
  arrows: 'move',
  layout: 'gestures',
  pucks: 0,
  aimLine: true,
  enemyHealth: 3,
  enemySpeed: 3,
  enemyAgility: 3,
  enemyPower: 3,
  enemyAim: 'flexible',
  character: 'angel',
  vibrate: true,
  music: true,
  stage: 'space',
  items: true,
  gates: false,
  fireButtons: 'single',
  enemyCharacter: 'auto',
  difficulty: 'normal',
  camera: 'mid',
  effects: true,
  realism: true,
  cel: true,
  batterySaver: typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0),
  showFps: false,
  magazine: 10,
  magPer: true,
  playerPack: 1,
  enemyIQ: 'normal',
  allyIQ: 'normal',
  arenaWidth: 'normal',
  enemyTactic: 'nearest',
  cpuCharge: true,
  allyCharge: true,
  allyTactic: 'nearest',
  moveControl: 'buttons',
  hudMode: 'top',
  roundTime: 60,
  burst: 1,
  pack: 1,
  covers: 0,
  pins: 0,
};

/** the opponent settings, for "reset opponent" */
/** Difficulty: each preset sets the opponent's brain and its four levels together */
export const DIFFICULTY: Record<'easy' | 'normal' | 'hard', Partial<Settings>> = {
  easy: { enemyIQ: 'easy', enemyHealth: 2, enemySpeed: 2, enemyAgility: 2, enemyPower: 2 },
  normal: { enemyIQ: 'normal', enemyHealth: 3, enemySpeed: 3, enemyAgility: 3, enemyPower: 3 },
  hard: { enemyIQ: 'hard', enemyHealth: 4, enemySpeed: 4, enemyAgility: 4, enemyPower: 4 },
};
export const OPPONENT_DEFAULTS: Partial<Settings> = {
  enemyHealth: 3,
  enemySpeed: 3,
  enemyAgility: 3,
  enemyPower: 3,
  enemyAim: 'flexible',
  enemyIQ: 'normal',
  enemyTactic: 'nearest',
  cpuCharge: true,
};

const DEFAULTS: SaveData = { matches: 0, wins: 0, muted: false, settings: DEFAULT_SETTINGS };

let memory: SaveData = { ...DEFAULTS };

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
      // older saves had a pucks on/off toggle
      if (parsed.settings?.bumps === false && parsed.settings?.pucks === undefined) settings.pucks = 0;
      delete (settings as Record<string, unknown>).bumps;
      if (!parsed.nearCam) settings.camera = 'near';
      if (!parsed.clearTable) Object.assign(settings, { pucks: 0, covers: 0, pins: 0 });
      // simple rules: a clear table without power gates, seen from the mid camera
      if (!parsed.simpleRules) Object.assign(settings, { pucks: 0, covers: 0, pins: 0, gates: false, camera: 'mid' });
      memory = { ...DEFAULTS, ...parsed, settings, nearCam: true, clearTable: true, simpleRules: true };
    }
  } catch {
    // keep the in-memory copy
  }
  return memory;
}

export function save(patch: Partial<SaveData>): SaveData {
  memory = { ...memory, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // storage unavailable; progress lasts for this session only
  }
  return memory;
}
