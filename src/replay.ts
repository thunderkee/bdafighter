import { Shooter, type Fx, type Game, type MarbleKind, type Team } from './game';

// Quick replay: every fixed step we keep a light snapshot of what the view
// draws. After a KO the view is pointed at a stand-in "game" that serves
// those snapshots, so the normal renderer plays the round's finish back.

interface RMarble {
  idx: number;
  active: true;
  team: Team;
  /** slot that fired it */
  owner: number;
  kind: MarbleKind;
  radius: number;
  hop: number;
  p: { x: number; y: number };
  v: { x: number; y: number };
  body: { translation: () => { x: number; y: number }; linvel: () => { x: number; y: number } };
}

interface RBump {
  active: boolean;
  radius: number;
  p: { x: number; y: number };
  v: { x: number; y: number };
  r: number;
  body: { translation: () => { x: number; y: number }; linvel: () => { x: number; y: number }; rotation: () => number };
}

interface Frame {
  shooters: Shooter[];
  covers: Game['covers'];
  pins: Game['pins'];
  time: number;
  slowT: number;
  slowOwner: number;
  marbles: RMarble[];
  bumps: RBump[];
  missiles: Game['missiles'];
  gates: Game['gates'];
  drops: Game['drops'];
  fx: Fx[];
}

/** shooter fields the view reads */
const SHOOTER_KEYS = [
  'x', 'vx', 'y', 'forward', 'team', 'aim', 'firing', 'maxHealth', 'health', 'ammo', 'reload', 'flash', 'recoil', 'stagger',
  'item', 'multiT', 'wiperT', 'dragonQueue', 'shielding', 'shield', 'shieldLock', 'superReady', 'charge', 'sinceHit', 'sinceHurt', 'stats',
  'slot', 'active', 'out', 'lane', 'kickT', 'heavyT', 'lockT', 'lockSlot', 'chargeHold', 'stored',
] as const;

function cloneShooter(s: Shooter): Shooter {
  const c = Object.create(Shooter.prototype) as Record<string, unknown>;
  for (const k of SHOOTER_KEYS) c[k] = (s as unknown as Record<string, unknown>)[k];
  return c as unknown as Shooter;
}

const KEEP = 300; // 5 s of steps

export class Recorder {
  frames: Frame[] = [];
  /** index (into frames) of the step where the round was decided */
  koIndex = -1;

  clear() {
    this.frames.length = 0;
    this.koIndex = -1;
  }

  record(g: Game) {
    const marbles: RMarble[] = [];
    for (const m of g.marbles) {
      if (!m.active) continue;
      const p = m.body.translation();
      const v = m.body.linvel();
      const rm: RMarble = {
        idx: m.idx,
        active: true,
        team: m.team,
        owner: m.owner,
        kind: m.kind,
        radius: m.radius,
        hop: 0,
        p: { x: p.x, y: p.y },
        v: { x: v.x, y: v.y },
        body: { translation: () => rm.p, linvel: () => rm.v },
      };
      marbles.push(rm);
    }
    const bumps = g.bumps.map((b) => {
      const p = b.body.translation();
      const v = b.body.linvel();
      const rb: RBump = {
        active: b.active,
        radius: b.radius,
        p: { x: p.x, y: p.y },
        v: { x: v.x, y: v.y },
        r: b.body.rotation(),
        body: { translation: () => rb.p, linvel: () => rb.v, rotation: () => rb.r },
      };
      return rb;
    });
    this.frames.push({
      shooters: g.shooters.map(cloneShooter),
      covers: g.covers.map((c) => ({ ...c })),
      pins: g.pins.map((p) => ({ ...p })),
      time: g.time,
      slowT: g.slowT,
      slowOwner: g.slowOwner,
      marbles,
      bumps,
      missiles: g.missiles.map((m) => ({ ...m })),
      gates: g.gates.map((x) => ({ ...x })),
      drops: g.drops.map((d) => ({ ...d })),
      fx: [],
    });
    if (this.frames.length > KEEP) {
      this.frames.shift();
      if (this.koIndex >= 0) this.koIndex--;
    }
  }

  /** attach this step's effects (hits, sparks) so the replay shows them too */
  addFx(fx: Fx[]) {
    const last = this.frames[this.frames.length - 1];
    if (last) last.fx.push(...fx.filter((f) => f.type !== 'pickup' && f.type !== 'use'));
  }

  markKo() {
    this.koIndex = this.frames.length - 1;
  }
}

/** Stand-in for Game that the view can render from during a replay. */
export class ReplayGame {
  phase = 'fight';
  winner = null;
  fx: Fx[] = [];
  shooters: Shooter[];
  covers: Game['covers'] = [];
  pins: Game['pins'] = [];
  time = 0;
  slowT = 0;
  slowOwner = -1;
  marbles: RMarble[] = [];
  bumps: RBump[];
  missiles: Game['missiles'] = [];
  gates: Game['gates'] = [];
  drops: Game['drops'] = [];
  private i: number;
  private end: number;
  private koAt: number;
  private acc = 0;
  done = false;
  /** frame where the winner fired the round-ending shot (-1 if unknown, e.g. time-up) and who fired it */
  shotAt = -1;
  by = -1;
  /** slots that were down before the round ended: hidden for the whole replay */
  private gone = new Set<number>();
  /** current frame and the KO frame, for the replay camera */
  get frame() {
    return this.i;
  }
  get ko() {
    return this.koAt;
  }
  /** game seconds already shown, for the slow-motion ramp */
  t = 0;

  constructor(
    private rec: Recorder,
    real: Game,
  ) {
    const ko = rec.koIndex >= 0 ? rec.koIndex : rec.frames.length - 1;
    // find the frame where the round-ending ball (or missile) was fired: walk back from
    // the KO while it's in flight; where it first appears is the winner's shot
    const src = real.koSource;
    const inFlight = (i: number) => {
      const f = rec.frames[i];
      if (!f || !src) return false;
      if (src.marble !== undefined) return f.marbles.some((m) => m.idx === src.marble);
      if (src.missile !== undefined) return f.missiles.some((m) => m.id === src.missile);
      return false;
    };
    let j = inFlight(ko) ? ko : ko - 1;
    if (src && inFlight(j)) {
      while (j > 0 && j > ko - 300 && inFlight(j - 1)) j--;
      this.shotAt = j;
      this.by = src.by;
    }
    // from just before the winner's shot (or ~2.2 s before the KO) to ~0.4 s after it
    this.i = Math.max(0, this.shotAt >= 0 ? this.shotAt - 40 : ko - 132);
    this.end = Math.min(rec.frames.length - 1, ko + 24);
    this.koAt = ko;
    // robots already knocked out of a pack fight stay out of the replay entirely
    for (const sh of real.shooters) if (sh.active && sh.out) this.gone.add(sh.slot);
    // you fell earlier in a pack fight: show only the last exchange, the robot that fired the
    // deciding shot and the one it knocked out, and leave the rest of the field out
    const you = real.shooters[0];
    const pack = real.shooters.filter((sh) => sh.active).length > 2;
    if (pack && you?.active && you.out && this.by >= 0)
      for (const sh of real.shooters) if (sh.active && !sh.out && sh.slot !== this.by && sh.health > 0) this.gone.add(sh.slot);
    this.shooters = real.shooters;
    this.bumps = rec.frames[this.i]?.bumps ?? [];
    this.apply();
  }

  private apply() {
    const f = this.rec.frames[this.i];
    if (!f) {
      this.done = true;
      return;
    }
    this.shooters = this.gone.size ? f.shooters.map((sh) => (this.gone.has(sh.slot) ? Object.assign(Object.create(Object.getPrototypeOf(sh)), sh, { out: true, firing: false }) : sh)) : f.shooters;
    this.covers = f.covers;
    this.pins = f.pins;
    this.time = f.time;
    this.slowT = f.slowT;
    this.slowOwner = f.slowOwner;
    this.marbles = this.gone.size ? f.marbles.filter((m) => !this.gone.has(m.owner)) : f.marbles;
    this.bumps = f.bumps;
    this.missiles = f.missiles;
    this.gates = f.gates;
    this.drops = f.drops;
    // and so do their hits, shots and explosions
    this.fx.push(...(this.gone.size ? f.fx.filter((x) => !('slot' in x) || !this.gone.has((x as { slot: number }).slot)) : f.fx));
  }

  /** Advance by real seconds; plays at half speed, a quarter near the KO. */
  advance(dt: number) {
    if (this.done) return;
    const nearKo = this.koAt - this.i < 30 && this.i <= this.koAt + 6;
    // the winner's shot gets its own slow beat too
    const nearShot = this.shotAt >= 0 && Math.abs(this.i - this.shotAt) < 14;
    this.acc += dt * (nearKo ? 0.25 : nearShot ? 0.3 : 0.5);
    while (this.acc >= 1 / 60) {
      this.acc -= 1 / 60;
      this.i++;
      this.t += 1 / 60;
      if (this.i > this.end) {
        this.done = true;
        return;
      }
      this.apply();
    }
  }

  /** the step that decided the round is on screen */
  get atKo() {
    return this.i >= this.koAt;
  }
}
