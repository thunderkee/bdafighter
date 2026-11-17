// The game's Worker: serves the built site, plus a tiny API for the shared roster that
// the Unit Studio publishes and every player's game loads.
//
//   GET  /api/roster           the published roster (public)
//   PUT  /api/roster           publish a new roster (Authorization: Bearer <STUDIO_KEY>)
//   GET  /api/roster/versions  earlier published versions (public)
//   GET  /api/roster/v/<n>     one earlier version (public)
//   GET  /api/room/<CODE>      online versus: a WebSocket into that room (?role=host|guest)

interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  list(opts: { prefix: string; limit?: number }): Promise<{ keys: { name: string }[] }>;
}
interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
  ROSTER: KV;
  STUDIO_KEY?: string;
  ROOMS: { idFromName(name: string): unknown; get(id: unknown): { fetch(req: Request): Promise<Response> } };
}

// ---------- online versus: one Durable Object per room code, relaying between the two players ----------

/** the Workers runtime's own pieces this file uses (it isn't type-checked against workers-types) */
interface DOState {
  acceptWebSocket(ws: WebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): WebSocket[];
  getTags(ws: WebSocket): string[];
}
declare const WebSocketPair: { new (): { 0: WebSocket; 1: WebSocket } };

/**
 * A room: the host opens it, up to `max - 1` guests join (2 for a duel, up to 6 for a brawl).
 * Each guest gets an id (g1, g2, ...). What a guest sends goes to the host as `<id>|<message>`;
 * what the host sends goes to every guest, or to one when it starts `@<id>|`. The room tells the
 * host when a guest arrives or leaves (with its id), and every guest when the host leaves.
 * Hibernation keeps it free while idle.
 */
export class Room {
  constructor(private state: DOState) {}

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('upgrade') !== 'websocket') return new Response('Expected a WebSocket.', { status: 426 });
    const url = new URL(req.url);
    const role = url.searchParams.get('role') === 'host' ? 'host' : 'guest';
    const max = Math.max(2, Math.min(6, Number(url.searchParams.get('max')) || 2));
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const host = this.state.getWebSockets('host')[0];
    const guests = this.state.getWebSockets('guest');
    // (a refusal still opens the socket, so the page can read why, then closes it)
    const refuse = (reason: string) => {
      (server as unknown as { accept(): void }).accept();
      server.send(JSON.stringify({ t: 'error', reason }));
      server.close(4000, reason);
      return new Response(null, { status: 101, webSocket: client } as ResponseInit);
    };
    if (role === 'host' && host) return refuse('taken');
    if (role === 'guest' && !host) return refuse('no-room');
    if (role === 'host') {
      this.state.acceptWebSocket(server, ['host', `max${max}`]);
      server.send(JSON.stringify({ t: 'hosting' }));
      return new Response(null, { status: 101, webSocket: client } as ResponseInit);
    }
    const cap = Number(this.state.getTags(host!).find((t) => t.startsWith('max'))?.slice(3)) || 2;
    if (guests.length >= cap - 1) return refuse('full');
    const taken = new Set(guests.flatMap((g) => this.state.getTags(g)));
    let id = 'g1';
    for (let k = 1; k <= 5; k++)
      if (!taken.has(`g${k}`)) {
        id = `g${k}`;
        break;
      }
    this.state.acceptWebSocket(server, ['guest', id]);
    host!.send(JSON.stringify({ t: 'peer', on: true, id }));
    server.send(JSON.stringify({ t: 'peer', on: true, id }));
    return new Response(null, { status: 101, webSocket: client } as ResponseInit);
  }

  private idOf(ws: WebSocket) {
    return this.state.getTags(ws).find((t) => /^g\d$/.test(t)) ?? '';
  }

  webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer) {
    if (typeof msg !== 'string') return;
    const tags = this.state.getTags(ws);
    try {
      if (tags.includes('host')) {
        // to one guest, or to them all
        const to = msg.startsWith('@') ? msg.slice(1, msg.indexOf('|')) : '';
        const body = to ? msg.slice(msg.indexOf('|') + 1) : msg;
        for (const g of this.state.getWebSockets(to || 'guest')) g.send(body);
      } else this.state.getWebSockets('host')[0]?.send(`${this.idOf(ws)}|${msg}`);
    } catch {
      // the other side is mid-close: its own close tells the sender
    }
  }

  webSocketClose(ws: WebSocket) {
    const tags = this.state.getTags(ws);
    try {
      if (tags.includes('host')) for (const g of this.state.getWebSockets('guest')) g.send(JSON.stringify({ t: 'peer', on: false }));
      else this.state.getWebSockets('host')[0]?.send(JSON.stringify({ t: 'peer', on: false, id: this.idOf(ws) }));
    } catch {
      // nobody left to tell
    }
    try {
      ws.close(1000, 'bye');
    } catch {
      // already closed
    }
  }

  webSocketError(ws: WebSocket) {
    this.webSocketClose(ws);
  }
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
    const room = path.match(/^\/api\/room\/([A-Z0-9]{4,8})$/);
    if (room) return env.ROOMS.get(env.ROOMS.idFromName(room[1])).fetch(req);
    if (path.startsWith('/api/')) return json({ error: 'Not found.' }, 404);
    return env.ASSETS.fetch(req);
  },
};
