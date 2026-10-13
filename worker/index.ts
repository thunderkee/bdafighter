// The game's Worker: serves the built site, plus a tiny API for the shared roster that
// the Unit Studio publishes and every player's game loads.
//
//   GET  /api/roster           the published roster (public)
//   PUT  /api/roster           publish a new roster (Authorization: Bearer <STUDIO_KEY>)
//   GET  /api/roster/versions  earlier published versions (public)
//   GET  /api/roster/v/<n>     one earlier version (public)

interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  list(opts: { prefix: string; limit?: number }): Promise<{ keys: { name: string }[] }>;
}
interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
  ROSTER: KV;
  STUDIO_KEY?: string;
}

const KEY = 'roster';
const MAX_BYTES = 4_000_000;
const KEEP_DAYS = 180;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** compare without leaking how much of the key matched */
function sameKey(a: string, b: string) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** a roster is { units: { [id]: { id, base, ... } } } */
function validUnits(data: unknown): data is { units: Record<string, { id: string; base: string }> } {
  if (!data || typeof data !== 'object') return false;
  const units = (data as { units?: unknown }).units;
  if (!units || typeof units !== 'object' || Array.isArray(units)) return false;
  return Object.entries(units as Record<string, unknown>).every(([id, u]) => {
    const e = u as { id?: unknown; base?: unknown };
    return !!u && typeof u === 'object' && e.id === id && typeof e.base === 'string' && id.length <= 64;
  });
}

async function publish(req: Request, env: Env) {
  if (!env.STUDIO_KEY) return json({ error: 'Publishing is not set up yet: add the STUDIO_KEY secret to the Worker.' }, 503);
  if (!sameKey(req.headers.get('authorization') ?? '', `Bearer ${env.STUDIO_KEY}`)) return json({ error: 'Wrong studio key.' }, 401);
  const text = await req.text();
  if (text.length > MAX_BYTES) return json({ error: 'Roster too large.' }, 413);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return json({ error: 'Not valid JSON.' }, 400);
  }
  if (!validUnits(data)) return json({ error: 'Not a roster: expected { units: { id: { id, base, ... } } }.' }, 400);
  const prevText = await env.ROSTER.get(KEY);
  const prev = prevText ? (JSON.parse(prevText) as { version?: number }) : null;
  const version = (prev?.version ?? 0) + 1;
  // keep the one being replaced, so a bad publish can be rolled back from the studio
  if (prevText && prev?.version) await env.ROSTER.put(`${KEY}:v${prev.version}`, prevText, { expirationTtl: KEEP_DAYS * 86400 });
  const doc = { version, updatedAt: new Date().toISOString(), units: data.units };
  await env.ROSTER.put(KEY, JSON.stringify(doc));
  return json({ ok: true, version, updatedAt: doc.updatedAt });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    if (path === '/api/roster') {
      if (req.method === 'GET') {
        const body = (await env.ROSTER.get(KEY)) ?? JSON.stringify({ version: 0, updatedAt: null, units: {} });
        return new Response(body, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
      }
      if (req.method === 'PUT') return publish(req, env);
      return json({ error: 'Method not allowed.' }, 405);
    }
    if (path === '/api/roster/versions' && req.method === 'GET') {
      const { keys } = await env.ROSTER.list({ prefix: `${KEY}:v`, limit: 1000 });
      const versions = keys.map((k) => Number(k.name.slice(KEY.length + 2))).filter(Number.isFinite).sort((a, b) => b - a);
      return json({ versions });
    }
    const m = path.match(/^\/api\/roster\/v\/(\d+)$/);
    if (m && req.method === 'GET') {
      const body = await env.ROSTER.get(`${KEY}:v${m[1]}`);
      return body ? new Response(body, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }) : json({ error: 'No such version.' }, 404);
    }
    if (path.startsWith('/api/')) return json({ error: 'Not found.' }, 404);
    return env.ASSETS.fetch(req);
  },
};
