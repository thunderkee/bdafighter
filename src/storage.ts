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
  /** buttons layout: move with the ◀ ▶ buttons or a slider */
  moveControl: 'buttons' | 'slider';
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
  /** frame-rate meter in the corner */
  showFps: boolean;
  /** marbles per magazine for both robots (3-10) */
  magazine: number;
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
  muted: boolean;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  mouseAim: true,
  arrows: 'move',
  layout: 'gestures',
  pucks: 5,
  aimLine: true,
  enemyHealth: 3,
  enemySpeed: 3,
  enemyAgility: 3,
  enemyPower: 3,
  enemyAim: 'flexible',
  character: 'angel',
  vibrate: true,
  stage: 'space',
  items: true,
  gates: true,
  fireButtons: 'single',
  enemyCharacter: 'auto',
  camera: 'mid',
  effects: true,
  realism: true,
  showFps: false,
  magazine: 10,
  playerPack: 1,
  moveControl: 'buttons',
  roundTime: 60,
  burst: 1,
  pack: 1,
  covers: 0,
  pins: 0,
};

/** the opponent settings, for "reset opponent" */
export const OPPONENT_DEFAULTS: Partial<Settings> = {
  enemyHealth: 3,
  enemySpeed: 3,
  enemyAgility: 3,
  enemyPower: 3,
  enemyAim: 'flexible',
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
      memory = { ...DEFAULTS, ...parsed, settings };
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
