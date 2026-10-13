import type { RosterData } from './roster';

// The shared roster published from the Unit Studio. Every page reads the cached copy
// synchronously (so the roster is ready when the models load) and refreshes it from
// the server at startup.

export interface PublishedRoster extends RosterData {
  version: number;
  updatedAt: string | null;
}

const CACHE = 'marble-fighter:published:v1';
export const API = './api/roster';

const empty = (): PublishedRoster => ({ version: 0, updatedAt: null, units: {} });

/** the last published roster this browser has seen */
export function cachedPublished(): PublishedRoster {
  try {
    const raw = localStorage.getItem(CACHE);
    if (raw) {
      const p = JSON.parse(raw) as PublishedRoster;
      if (p && typeof p.units === 'object') return p;
    }
  } catch {
    // fall through
  }
  return empty();
}

/** fetch the published roster; null when the server can't be reached (offline, local dev) */
export async function fetchPublished(timeoutMs = 4000): Promise<PublishedRoster | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(API, { cache: 'no-store', signal: ctl.signal });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null;
    const p = (await res.json()) as PublishedRoster;
    if (!p || typeof p.units !== 'object') return null;
    try {
      localStorage.setItem(CACHE, JSON.stringify(p));
    } catch {
      // storage full: the fresh copy still applies to this page
    }
    return p;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Before the game loads: fetch the latest publish. With a cached copy, wait only briefly
 * (a publish that arrives later shows on the next load); without one, wait a little longer.
 */
export async function refreshPublished(waitMs = 2500) {
  const had = cachedPublished().version > 0;
  const pending = fetchPublished(had ? 4000 : waitMs);
  // a cached copy means we can start soon; still give a fresh publish a moment to arrive
  await Promise.race([pending, new Promise((r) => setTimeout(r, had ? 1200 : waitMs))]);
}
