import * as sfx from './audio';
import type { Fx, Game, MarbleKind, Shooter, Team } from './game';

/**
 * Online versus over a WebSocket room (the Worker's /api/room/<CODE>).
 *
 * The host's game is the one that counts: it runs the match as local two-player versus does,
 * with the guest's controls driving the opponent (slot 1). Every frame it sends the table: the
 * two fighters (only what changed), the marbles, pucks, cover, gates, the round's clock and phase,
 * plus the effects and sounds of that frame. The guest doesn't simulate; it shows what the host
 * sends, turned half a turn round so the guest sees it from their own end as slot 0, the same
 * as any solo match. Its own controls go the other way.
 */

export type Role = 'host' | 'guest';

/** the table, as the host sends it (in the host's own coordinates) */
export interface Snap {
  t: 's';
  /** the two fighters' fields that changed since the last snapshot (all of them now and then) */
  sh: Record<string, unknown>[];
  /** active marbles, MARBLE_N numbers each */
  m: number[];
  /** pucks: [active, x, y, vx, vy, rotation] each */
  b: number[];
  /** cover walls: [active, hp, x, y]; pins: [active, glow, x, y] */
  c: number[];
  p: number[];
  ga: Record<string, unknown>[];
  mi: Record<string, unknown>[];
  dr: Record<string, unknown>[];
  /** the round */
  g: { phase: string; pt: number; time: number; clock: number; winner: number | null; hs: number; slowT: number; slowOwner: number; gatesOn: boolean; ko: { by: number; marble?: number; missile?: number } | null };
  fx: Fx[];
  snd: [sfx.Sfx, number, boolean][];
}

/** the guest's controls, in the guest's own coordinates */
export interface InputMsg {
  t: 'in';
  mx: number;
  mt: number | null;
  aim: number;
  f: 0 | 1;
  sh: 0 | 1;
  adv: 0 | 1;
  dash: 0 | 1;
}

export type Msg = (
  | { t: 'hosting' }
  | { t: 'peer'; on: boolean; id?: string }
  | { t: 'error'; reason: string }
  | { t: 'hello'; id: string; name: string }
  | { t: 'start'; cfg: Record<string, unknown>; id: string; name: string }
  | { t: 'next' }
  | { t: 'lobby'; kind: string; players: string[] }
  | { t: 'bstart'; kind: string; players: { nid: string; char: string; name: string }[] }
  | InputMsg
  | Snap
  // (an online brawl's own messages: action.ts reads them)
  | { t: 'a'; [k: string]: unknown }
) & {
  /** the host: which guest sent it (g1 to g5) */
  _from?: string;
};

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
export const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

/** one connection to a room; messages wait in `queue` until the game takes them */
export class Net {
  readonly ws: WebSocket;
  queue: Msg[] = [];
  open = false;
  /** the socket closed (by either side, or the network) */
  onClose: (() => void) | null = null;
  /** a message arrived (the queue has it too) */
  onMessage: ((m: Msg) => void) | null = null;

  constructor(
    readonly code: string,
    readonly role: Role,
    /** players the room holds (host only): 2 for a duel, up to 6 for a brawl */
    max = 2,
  ) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}/api/room/${code}?role=${role}&max=${max}`);
    this.ws.onopen = () => (this.open = true);
    this.ws.onmessage = (e) => {
      let m: Msg;
      let text = e.data as string;
      // (the host hears its guests as "<id>|<message>")
      const from = /^g\d\|/.test(text) ? text.slice(0, 2) : undefined;
      if (from) text = text.slice(3);
      try {
        m = JSON.parse(text) as Msg;
      } catch {
        return;
      }
      if (from) m._from = from;
      this.queue.push(m);
      this.onMessage?.(m);
    };
    this.ws.onclose = () => {
      this.open = false;
      this.onClose?.();
    };
  }

  send(m: Msg) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  /** the host: to one guest only */
  sendTo(id: string, m: Msg) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(`@${id}|${JSON.stringify(m)}`);
  }

  close() {
    this.onClose = null;
    this.onMessage = null;
    try {
      this.ws.close(1000, 'bye');
    } catch {
      // already closed
    }
  }
}

// ---------- the host: writing snapshots ----------

const KINDS: MarbleKind[] = ['normal', 'super', 'dragon', 'x5', 'boost'];
const MARBLE_N = 13;
/** a fighter's identity, fixed by its slot (never sent) */
const FIXED = new Set(['slot', 'team', 'forward', 'railY']);
/** numbers to 3 decimals; infinities (an untimed clock) as ±1e9, which JSON can carry */
const r3 = (v: number) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : v > 0 ? 1e9 : -1e9);
const unInf = (v: number) => (v >= 1e9 ? Infinity : v <= -1e9 ? -Infinity : v);

/** plain fields of an object (numbers rounded), for gates, missiles and drops */
const plain = (o: object) => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'number') out[k] = r3(v);
    else if (typeof v === 'string' || typeof v === 'boolean' || v === null) out[k] = v;
  }
  return out;
};

export class SnapWriter {
  private last: Record<string, unknown>[] = [{}, {}];
  private frames = 0;
  /** sounds the host's game played since the last snapshot */
  sounds: [sfx.Sfx, number, boolean][] = [];

  /** send everything next time (a new round: the guest has reset its table) */
  reset() {
    this.last = [{}, {}];
    this.frames = 0;
  }

  write(g: Game): Snap {
    // (every second the fighters go whole, in case anything was missed)
    const full = this.frames++ % 60 === 0;
    const sh = [0, 1].map((i) => {
      const s = g.shooters[i] as unknown as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      const last = this.last[i];
      for (const k of Object.keys(s)) {
        if (FIXED.has(k)) continue;
        const v = s[k];
        let val: unknown;
        if (typeof v === 'number') val = r3(v);
        else if (typeof v === 'boolean' || typeof v === 'string' || v === null) val = v;
        else if (k === 'lane' && Array.isArray(v)) val = [r3(v[0]), r3(v[1])];
        else continue;
        const same = Array.isArray(val) ? Array.isArray(last[k]) && (last[k] as number[])[0] === val[0] && (last[k] as number[])[1] === val[1] : last[k] === val;
        if (full || !same) {
          out[k] = val;
          last[k] = val;
        }
      }
      return out;
    });
    const m: number[] = [];
    for (const mb of g.marbles) {
      if (!mb.active) continue;
      const p = mb.body.translation();
      const v = mb.body.linvel();
      m.push(mb.idx, mb.team, mb.owner, Math.max(0, KINDS.indexOf(mb.kind)), r3(mb.radius), r3(p.x), r3(p.y), r3(v.x), r3(v.y), r3(mb.hop), r3(mb.age), r3(mb.curve ?? 0), mb.weave);
    }
    const b: number[] = [];
    for (const bp of g.bumps) {
      const p = bp.body.translation();
      const v = bp.body.linvel();
      b.push(bp.active ? 1 : 0, r3(p.x), r3(p.y), r3(v.x), r3(v.y), r3(bp.body.rotation()));
    }
    const c: number[] = [];
    for (const cv of g.covers) c.push(cv.active ? 1 : 0, cv.hp, r3(cv.x), r3(cv.y));
    const p: number[] = [];
    for (const pn of g.pins) p.push(pn.active ? 1 : 0, r3(pn.glow), r3(pn.x), r3(pn.y));
    const snap: Snap = {
      t: 's',
      sh,
      m,
      b,
      c,
      p,
      ga: g.gates.map(plain),
      mi: g.missiles.map(plain),
      dr: g.drops.map(plain),
      g: { phase: g.phase, pt: r3(g.phaseTime), time: r3(g.time), clock: r3(g.clock), winner: g.winner, hs: r3(g.hitstop), slowT: r3(g.slowT), slowOwner: g.slowOwner, gatesOn: g.gatesOn, ko: g.koSource },
      fx: g.fx.map((f) => ({ ...f })),
      snd: this.sounds,
    };
    this.sounds = [];
    return snap;
  }
}

/** the host: the guest's controls on the opponent (slot 1), turned back into the host's coordinates */
export function applyInput(s: Shooter, m: InputMsg) {
  s.moveAxis = -m.mx;
  s.moveTarget = m.mt === null ? null : -m.mt;
  s.aim = -m.aim;
  s.firing = !!m.f;
  s.shielding = !!m.sh;
  s.advancing = !!m.adv;
  if (m.dash) s.dashReq = true;
}

// ---------- the guest: showing snapshots ----------

/** the host's slot 0 is the guest's 1 and the other way round */
const swap = (n: number) => (n === 0 ? 1 : n === 1 ? 0 : n);
const otherTeam = (t: number) => (t === 0 ? 1 : t === 1 ? 0 : t) as Team;
/** a fighter's fields that point along the table's width or length: they flip with it */
const FLIP = new Set(['x', 'vx', 'y', 'moveTarget', 'dashDir', 'railPush', 'specialDir', 'aim', 'wobble']);
/** your own controls: your fingers set them, not the host */
const OWN = new Set(['aim', 'firing', 'shielding', 'advancing', 'moveAxis', 'moveTarget', 'dashReq']);

/** the guest's controls, to send (null when nothing changed since the last send) */
export class InputWriter {
  private last = '';
  read(p: Shooter): InputMsg | null {
    const m: InputMsg = { t: 'in', mx: p.moveAxis, mt: p.moveTarget === null ? null : r3(p.moveTarget), aim: r3(p.aim), f: p.firing ? 1 : 0, sh: p.shielding ? 1 : 0, adv: p.advancing ? 1 : 0, dash: p.dashReq ? 1 : 0 };
    // (a dash is a press: it's sent once, then it's the host's)
    p.dashReq = false;
    const key = JSON.stringify(m);
    if (key === this.last && !m.dash) return null;
    this.last = key;
    return m;
  }
}

function mirrorFx(f: Fx): Fx {
  const o = { ...f } as Record<string, unknown>;
  if (typeof o.x === 'number') o.x = -o.x;
  if (typeof o.y === 'number') o.y = -o.y;
  if (typeof o.slot === 'number') o.slot = swap(o.slot);
  if (typeof o.team === 'number') o.team = otherTeam(o.team);
  if (typeof o.dir === 'number') o.dir = -o.dir;
  if (Array.isArray(o.at)) o.at = [-(o.at[0] as number), -(o.at[1] as number)];
  return o as unknown as Fx;
}

/** put a snapshot on the guest's table, half a turn round */
export function applySnap(g: Game, s: Snap) {
  s.sh.forEach((d, h) => {
    const gi = swap(h);
    const sh = g.shooters[gi] as unknown as Record<string, unknown>;
    if (!sh) return;
    for (const [k, raw] of Object.entries(d)) {
      if (gi === 0 && OWN.has(k)) continue;
      let v = raw;
      if (k === 'lane' && Array.isArray(v)) v = [-v[1], -v[0]];
      else if (typeof v === 'number') {
        v = unInf(v);
        if (FLIP.has(k)) v = -(v as number);
        else if (k === 'lockSlot') v = swap(v as number);
      }
      sh[k] = v;
    }
  });
  const byIdx = new Map(g.marbles.map((mb) => [mb.idx, mb]));
  const seen = new Set<number>();
  for (let i = 0; i + MARBLE_N <= s.m.length; i += MARBLE_N) {
    const mb = byIdx.get(s.m[i]);
    if (!mb) continue;
    seen.add(mb.idx);
    mb.active = true;
    mb.team = otherTeam(s.m[i + 1]);
    mb.owner = swap(s.m[i + 2]);
    mb.kind = KINDS[s.m[i + 3]] ?? 'normal';
    mb.radius = s.m[i + 4];
    mb.body.setTranslation({ x: -s.m[i + 5], y: -s.m[i + 6] }, false);
    mb.body.setLinvel({ x: -s.m[i + 7], y: -s.m[i + 8] }, false);
    mb.hop = s.m[i + 9];
    mb.age = s.m[i + 10];
    mb.curve = s.m[i + 11] ? -s.m[i + 11] : undefined;
    mb.weave = -s.m[i + 12];
  }
  for (const mb of g.marbles) if (!seen.has(mb.idx)) mb.active = false;
  g.bumps.forEach((bp, i) => {
    const o = i * 6;
    if (o + 6 > s.b.length) return;
    bp.active = !!s.b[o];
    bp.body.setTranslation({ x: -s.b[o + 1], y: -s.b[o + 2] }, false);
    bp.body.setLinvel({ x: -s.b[o + 3], y: -s.b[o + 4] }, false);
    bp.body.setRotation(s.b[o + 5] + Math.PI, false);
  });
  g.covers.forEach((cv, i) => {
    const o = i * 4;
    if (o + 4 > s.c.length) return;
    cv.active = !!s.c[o];
    cv.hp = s.c[o + 1];
    cv.x = -s.c[o + 2];
    cv.y = -s.c[o + 3];
  });
  g.pins.forEach((pn, i) => {
    const o = i * 4;
    if (o + 4 > s.p.length) return;
    pn.active = !!s.p[o];
    pn.glow = s.p[o + 1];
    pn.x = -s.p[o + 2];
    pn.y = -s.p[o + 3];
  });
  const flipXY = (o: Record<string, unknown>) => {
    const r = { ...o };
    for (const k of ['x', 'y', 'cx']) if (typeof r[k] === 'number') r[k] = -(r[k] as number);
    if (typeof r.heading === 'number') r.heading = (r.heading as number) + Math.PI;
    if (typeof r.team === 'number') r.team = otherTeam(r.team as number);
    if (typeof r.owner === 'number') r.owner = swap(r.owner as number);
    return r;
  };
  g.gates = s.ga.map(flipXY) as unknown as Game['gates'];
  g.missiles = s.mi.map(flipXY) as unknown as Game['missiles'];
  g.drops = s.dr.map(flipXY) as unknown as Game['drops'];
  const r = s.g;
  g.phase = r.phase as Game['phase'];
  g.phaseTime = r.pt;
  g.time = r.time;
  g.clock = unInf(r.clock);
  g.winner = r.winner === 0 || r.winner === 1 ? otherTeam(r.winner) : (r.winner as -1 | null);
  g.hitstop = r.hs;
  g.slowT = r.slowT;
  g.slowOwner = swap(r.slowOwner);
  g.gatesOn = r.gatesOn;
  g.koSource = r.ko ? { ...r.ko, by: swap(r.ko.by) } : null;
  for (const f of s.fx) g.fx.push(mirrorFx(f));
  for (const [name, k, quiet] of s.snd) sfx.play(name, k, quiet);
}
