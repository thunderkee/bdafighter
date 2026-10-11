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
  /** pushable pucks in the middle of the table */
  bumps: boolean;
}

export interface SaveData {
  matches: number;
  wins: number;
  muted: boolean;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = { mouseAim: true, arrows: 'move', layout: 'gestures', bumps: true };

const DEFAULTS: SaveData = { matches: 0, wins: 0, muted: false, settings: DEFAULT_SETTINGS };

let memory: SaveData = { ...DEFAULTS };

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      memory = { ...DEFAULTS, ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } };
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
