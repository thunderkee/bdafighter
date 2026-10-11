import { ARENA, type AIProfile } from './config';
import type { Game, Shooter } from './game';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;

/** Fold an x coordinate back into the arena as if it bounced off the side walls. */
function foldX(x: number, half: number) {
  const span = half * 2;
  let t = (x + half) % (span * 2);
  if (t < 0) t += span * 2;
  return t <= span ? t - half : span * 2 - t - half;
}

type AimMode = 'direct' | 'bank' | 'bump';

export class AIController {
  private burstLeft = 0;
  private pauseLeft = 0.6;
  private strafeTimer = 0;
  private strafeTarget = 0;
  private dodgeTarget: number | null = null;
  private dodgeTimer = 0;
  /** marbles already judged, so each one rolls the dodge chance once */
  private judged = new WeakSet<object>();
  private aimMode: AimMode = 'direct';
  private aimNoise = 0;
  private bumpIdx = 0;
  private reactQueue: { at: number; target: number }[] = [];
  private t = 0;

  constructor(
    private game: Game,
    private me: Shooter,
    private foe: Shooter,
    public profile: AIProfile,
  ) {}

  reset() {
    this.burstLeft = 0;
    this.pauseLeft = rand(0.3, 0.8);
    this.strafeTimer = 0;
    this.dodgeTarget = null;
    this.reactQueue.length = 0;
    this.judged = new WeakSet();
    this.t = 0;
  }

  update(dt: number) {
    const g = this.game;
    const me = this.me;
    const pr = this.profile;
    this.t += dt;
    if (g.phase !== 'fight') {
      me.firing = false;
      me.moveTarget = 0;
      return;
    }

    this.updateMovement(dt);

    // --- aim ---
    const desired = this.desiredAim();
    const maxTurn = pr.turnRate * dt;
    me.aim += Math.max(-maxTurn, Math.min(maxTurn, desired - me.aim));

    // --- trigger: bursts and pauses, respecting the magazine ---
    if (me.reload > 0) {
      me.firing = false;
      this.burstLeft = 0;
      return;
    }
    if (this.burstLeft > 0) {
      this.burstLeft -= dt;
      me.firing = Math.abs(desired - me.aim) < 0.25;
      if (this.burstLeft <= 0) {
        this.pauseLeft = rand(pr.pause[0], pr.pause[1]);
        me.firing = false;
      }
    } else {
      me.firing = false;
      this.pauseLeft -= dt;
      // wait for a reasonable magazine before starting a burst
      if (this.pauseLeft <= 0 && me.ammo >= Math.min(5, me.stats.capacity)) {
        this.burstLeft = rand(pr.burst[0], pr.burst[1]);
        this.pickAimMode();
      }
    }
  }

  private pickAimMode() {
    const r = Math.random();
    const pr = this.profile;
    if (r < pr.bankChance) this.aimMode = 'bank';
    else if (r < pr.bankChance + pr.bumpChance) {
      this.aimMode = 'bump';
      this.bumpIdx = Math.floor(Math.random() * this.game.bumps.length);
    } else this.aimMode = 'direct';
    this.aimNoise = gauss() * pr.aimError;
  }

  private desiredAim() {
    const me = this.me;
    const foe = this.foe;
    const pr = this.profile;
    const dy = foe.y - me.y;
    const dist = Math.abs(dy);
    const flight = dist / me.stats.muzzleSpeed;
    let tx = foe.x + foe.vx * flight * pr.lead;
    const half = ARENA.width / 2 - me.stats.marbleRadius;

    if (this.aimMode === 'bank') {
      // mirror the target across the wall on the side the foe is closer to
      const wall = tx >= 0 ? half : -half;
      tx = 2 * wall - tx;
    } else if (this.aimMode === 'bump') {
      const b = this.game.bumps[this.bumpIdx];
      const p = b.body.translation();
      // hit the bump slightly off-centre on the side that sends it toward the foe
      const ax = p.x + Math.sign(p.x - foe.x || 1) * b.radius * 0.5;
      return this.angleTo(ax, p.y) + this.aimNoise * 0.5;
    }
    // sway slowly so streams aren't laser-straight
    const sway = Math.sin(this.t * 2.3) * pr.aimError * 0.6;
    return this.angleTo(tx, foe.y) + this.aimNoise + sway;
  }

  private angleTo(x: number, y: number) {
    const me = this.me;
    return Math.atan2(x - me.x, (y - me.y) * me.forward);
  }

  private updateMovement(dt: number) {
    const g = this.game;
    const me = this.me;
    const pr = this.profile;
    const half = ARENA.width / 2;

    // scan incoming marbles; schedule a dodge after the reaction delay
    for (const m of g.marbles) {
      if (!m.active || m.team === me.team || this.judged.has(m)) continue;
      const p = m.body.translation();
      const v = m.body.linvel();
      const toward = (me.y - p.y) * Math.sign(v.y);
      if (toward <= 0 || Math.abs(v.y) < 1) continue;
      const tHit = Math.abs(me.y - p.y) / Math.abs(v.y);
      if (tHit > 1.1) continue;
      const px = foldX(p.x + v.x * tHit, half - m.radius);
      const danger = me.halfWidth + m.radius + 0.25;
      if (Math.abs(px - me.x) > danger) continue;
      this.judged.add(m);
      if (Math.random() > pr.dodge) continue;
      // step to whichever side is clear and inside the rail
      let side = px > me.x ? -1 : 1;
      const target = me.x + side * (danger + 0.4);
      if (Math.abs(target) > ARENA.railHalfWidth) side = -side;
      this.reactQueue.push({ at: this.t + pr.reaction, target: me.x + side * (danger + 0.4) });
    }
    for (let i = this.reactQueue.length - 1; i >= 0; i--) {
      if (this.reactQueue[i].at <= this.t) {
        this.dodgeTarget = this.reactQueue[i].target;
        this.dodgeTimer = 0.45;
        this.reactQueue.splice(i, 1);
      }
    }

    if (this.dodgeTarget !== null) {
      this.dodgeTimer -= dt;
      me.moveTarget = this.dodgeTarget;
      if (this.dodgeTimer <= 0) this.dodgeTarget = null;
      return;
    }

    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeTimer = rand(0.6, 1.8);
      const range = ARENA.railHalfWidth * pr.moveSpeedMul;
      this.strafeTarget = rand(-range, range);
    }
    // approach strafe target at a speed scaled by mobility
    const delta = this.strafeTarget - me.x;
    me.moveTarget = null;
    me.moveAxis = Math.abs(delta) < 0.1 ? 0 : Math.sign(delta) * pr.moveSpeedMul;
  }
}
