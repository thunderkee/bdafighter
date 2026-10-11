// Local save that never throws. Private mode, blocked storage or a full
// quota fall back to an in-memory copy for the session.

const KEY = 'marble-fighter:v1';

export interface SaveData {
  matches: number;
  wins: number;
  muted: boolean;
}

const DEFAULTS: SaveData = { matches: 0, wins: 0, muted: false };

let memory: SaveData = { ...DEFAULTS };

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) memory = { ...DEFAULTS, ...JSON.parse(raw) };
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
