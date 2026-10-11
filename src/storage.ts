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
  /** opponent movement speed level (1-5, 3 = normal) */
  enemySpeed: number;
  /** opponent marble power level (1-5, 3 = normal) */
  enemyPower: number;
  /** 'flexible' aims, leads and banks; 'straight' always fires straight ahead */
  enemyAim: 'flexible' | 'straight';
  /** player robot id (see CHARACTERS in robot.ts) */
  character: string;
  /** buzz the phone on hits */
  vibrate: boolean;
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
  enemySpeed: 3,
  enemyPower: 3,
  enemyAim: 'flexible',
  character: 'angel',
  vibrate: true,
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
