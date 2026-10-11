import { Shooter, type Fx, type Game, type MarbleKind, type Team } from './game';

// Quick replay: every fixed step we keep a light snapshot of what the view
// draws. After a KO the view is pointed at a stand-in "game" that serves
// those snapshots, so the normal renderer plays the round's finish back.

interface RMarble {
  idx: number;
  active: true;
  team: Team;
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
  shooters: [Shooter, Shooter];
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
  'item', 'multiT', 'boostT', 'dragonQueue', 'shielding', 'shield', 'shieldLock', 'superReady', 'charge', 'sinceHit', 'sinceHurt', 'stats',
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
      shooters: [cloneShooter(g.shooters[0]), cloneShooter(g.shooters[1])],
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
  shooters: [Shooter, Shooter];
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
  /** game seconds already shown, for the slow-motion ramp */
  t = 0;

  constructor(
    private rec: Recorder,
    real: Game,
  ) {
    const ko = rec.koIndex >= 0 ? rec.koIndex : rec.frames.length - 1;
    // ~2.2 s before the KO to ~0.4 s after it
    this.i = Math.max(0, ko - 132);
    this.end = Math.min(rec.frames.length - 1, ko + 24);
    this.koAt = ko;
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
    this.shooters = f.shooters;
    this.marbles = f.marbles;
    this.bumps = f.bumps;
    this.missiles = f.missiles;
    this.gates = f.gates;
    this.drops = f.drops;
    this.fx.push(...f.fx);
  }

  /** Advance by real seconds; plays at half speed, a quarter near the KO. */
  advance(dt: number) {
    if (this.done) return;
    const nearKo = this.koAt - this.i < 30 && this.i <= this.koAt + 6;
    this.acc += dt * (nearKo ? 0.25 : 0.5);
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
