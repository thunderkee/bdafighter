import { ARENA, type AIProfile } from './config';
import { GATE } from './items';
import { CHARGE, type Game, type Shooter } from './game';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;

/** Fold an x coordinate back into the arena as if it bounced off the side walls. */
function foldX(x: number, half: number) {
  const span = half * 2;
  let t = (x + half) % (span * 2);
  if (t < 0) t += span * 2;
  return t <= span ? t - half : span * 2 - t - half;
}

type AimMode = 'direct' | 'bank' | 'bump' | 'gate' | 'deny';

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
  /** 'straight' never turns the turret: it only fires straight ahead */
  straight = false;
  /** widens how far the opponent strafes (speed itself comes from its stats) */
  speedMul = 1;
  /** settings: scales dodge chance up and reaction time down */
  agility = 1;
  private holdTime = 0;
  private shieldT = 0;
  private shieldCheck = 0;
  private reactQueue: { at: number; target: number }[] = [];
  private t = 0;
  /** seconds until it next considers charging a big shot */
  private chargeCool = rand(3, 6);
  /** below 1 charges more often and bigger (an arcade boss) */
  chargeEager = 1;

  constructor(
    private game: Game,
    private me: Shooter,
    public profile: AIProfile,
  ) {}

  /** opponents target the player; a player-side bot targets the nearest live opponent */
  private get foe() {
    return this.game.targetFor(this.me);
  }

  reset() {
    this.burstLeft = 0;
    this.pauseLeft = rand(0.3, 0.8);
    this.strafeTimer = 0;
    this.dodgeTarget = null;
    this.reactQueue.length = 0;
    this.judged = new WeakSet();
    this.t = 0;
    this.holdTime = 0;
    this.shieldT = 0;
    this.chargeCool = rand(3, 6);
    this.me.chargeWant = 0;
  }

  update(dt: number) {
    const g = this.game;
    const me = this.me;
    const pr = this.profile;
    this.t += dt;
    if (g.phase !== 'fight' || !me.alive) {
      me.firing = false;
      me.shielding = false;
      me.moveTarget = (me.lane[0] + me.lane[1]) / 2;
      return;
    }

    this.updateMovement(dt);
    this.updateItem(dt);
    // B-Daman mode: the gauge full, a spirit shot once lined up (bending one way or the other, sometimes)
    if (g.bdaman && me.spirit >= 100 && Math.abs(this.foe.x - me.x) < 1.6 && Math.random() < dt * 1.2) g.beginSpecial(me, Math.random() < 0.4 ? 0 : Math.random() < 0.5 ? -1 : 1);
    this.updateShield(dt);

    // --- aim ---
    const desired = this.desiredAim();
    const maxTurn = pr.turnRate * dt;
    me.aim += Math.max(-maxTurn, Math.min(maxTurn, desired - me.aim));

    // --- charge shots: now and then a CPU robot stores a few balls and lets go of one big one ---
    if (g.cpuCharges(me)) {
      if (me.chargeWant > 0) {
        // keep tracking the target; the game fires once the planned balls are in
        me.firing = false;
        if (me.shieldUp || me.reload > 0) me.chargeWant = 0;
        return;
      }
      this.chargeCool -= dt;
      if (this.chargeCool <= 0 && this.burstLeft <= 0 && me.reload <= 0 && me.ammo >= 3 && Math.abs(desired - me.aim) < 0.2) {
        // sharper CPUs think about it more often (Rookie every ~6-12 s, Ace every ~3-7 s)
        this.chargeCool = rand(4, 8) * (0.6 + pr.reaction * 2) * this.chargeEager;
        if (Math.random() < (this.chargeEager < 1 ? 0.85 : 0.6)) {
          const lo = this.chargeEager < 1 ? 3 : 2;
          me.chargeWant = Math.max(lo, Math.min(CHARGE.max, Math.floor(me.ammo) - 1, Math.round(rand(lo, 5.4))));
          me.firing = false;
          return;
        }
      }
    }

    // --- trigger: bursts and pauses, respecting the magazine ---
    if (me.reload > 0) {
      me.firing = false;
      this.burstLeft = 0;
      return;
    }
    if (this.burstLeft > 0) {
      // a unit whose head sweeps side to side (its shots follow the head) fires as the sweep
      // passes over the target, and its burst waits for that rather than running out
      const sweeping = !!me.stats.special?.wobble;
      const onTarget = sweeping ? Math.abs(desired - (me.aim + me.wobble)) < 0.22 : Math.abs(desired - me.aim) < 0.25;
      if (!sweeping || onTarget) this.burstLeft -= dt;
      me.firing = onTarget;
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

  /** Raise the shield against power balls, missiles and dense streams. */
  private updateShield(dt: number) {
    const g = this.game;
    const me = this.me;
    this.shieldT = Math.max(0, this.shieldT - dt);
    this.shieldCheck -= dt;
    if (this.shieldCheck <= 0) {
      this.shieldCheck = 0.15;
      let heavy = false;
      let normal = 0;
      for (const m of g.marbles) {
        if (!m.active || m.team === me.team) continue;
        const p = m.body.translation();
        const v = m.body.linvel();
        if ((me.y - p.y) * Math.sign(v.y) <= 0 || Math.abs(v.y) < 1) continue;
        const tHit = Math.abs(me.y - p.y) / Math.abs(v.y);
        if (tHit > 0.6) continue;
        if (Math.abs(p.x + v.x * tHit - me.x) > me.halfWidth + m.radius + 0.3) continue;
        if (m.kind === 'normal') normal++;
        else heavy = true;
      }
      const missile = g.missiles.some((mm) => mm.team !== me.team && Math.hypot(mm.x - me.x, mm.y - me.y) < 3.2);
      const skill = Math.min(1, 0.35 * this.agility);
      if (me.shield > 25 && (heavy || missile) && Math.random() < skill * 2) this.shieldT = 0.5;
      else if (me.shield > 55 && normal >= 3 && Math.random() < skill * 0.6) this.shieldT = 0.35;
    }
    me.shielding = this.shieldT > 0;
  }

  /** Use held items with a little judgement. */
  private updateItem(dt: number) {
    const me = this.me;
    if (!me.item) {
      this.holdTime = 0;
      return;
    }
    this.holdTime += dt;
    let use = false;
    switch (me.item) {
      case 'heal':
        // save the repair kit until it's needed, but don't sit on it forever
        use = me.hpFrac < 0.6 || this.holdTime > 8;
        break;
      case 'slowmo':
        // don't stack on an opponent's slow-mo
        use = this.holdTime > 0.4 && this.game.slowT <= 0;
        break;
      case 'wiper':
      case 'lock':
        use = this.holdTime > 0.3;
        break;
      case 'missile':
        use = this.holdTime > 0.3;
        break;
      case 'multi':
      case 'dragon':
        // fire power items when roughly lined up and loaded
        use = this.holdTime > 0.6 && me.reload <= 0 && me.ammo >= 4;
        break;
    }
    if (use) this.game.useItem(me);
  }

  private pickAimMode() {
    // sometimes snipe the crate sitting on the opponent's rail
    if (this.game.drops.some((d) => d.team === this.foe.team && d.h < 1) && Math.random() < 0.35) {
      this.aimMode = 'deny';
      this.aimNoise = gauss() * this.profile.aimError * 0.5;
      return;
    }
    // a charged gate is worth shooting through most of the time
    if (this.game.gates.some((g) => g.charges > 0) && Math.random() < 0.55) {
      this.aimMode = 'gate';
      this.aimNoise = gauss() * this.profile.aimError * 0.6;
      return;
    }
    const r = Math.random();
    const pr = this.profile;
    if (r < pr.bankChance) this.aimMode = 'bank';
    else if (r < pr.bankChance + pr.bumpChance && this.game.activePucks().length) {
      this.aimMode = 'bump';
      this.bumpIdx = Math.floor(Math.random() * this.game.activePucks().length);
    } else this.aimMode = 'direct';
    this.aimNoise = gauss() * pr.aimError;
  }

  private desiredAim() {
    if (this.straight) return 0;
    const me = this.me;
    const foe = this.foe;
    const pr = this.profile;
    const dy = foe.y - me.y;
    const dist = Math.abs(dy);
    // (a wind-up before the shot leaves adds to the lead)
    const flight = dist / me.stats.muzzleSpeed + (me.stats.special?.windup ?? 0);
    let tx = foe.x + foe.vx * flight * pr.lead;
    const half = ARENA.width / 2 - me.stats.marbleRadius;

    if (this.aimMode === 'deny') {
      const d = this.game.drops.find((dd) => dd.team === foe.team);
      if (d) return this.angleTo(d.x, foe.y) + this.aimNoise;
    }
    if (this.aimMode === 'gate') {
      const g = this.game.gates.find((gg) => gg.charges > 0);
      if (g) {
        // lead the sliding gate: where will it be when the ball gets there?
        const t = Math.abs(g.y - me.y) / me.stats.muzzleSpeed;
        const span = ARENA.width / 2 - GATE.halfWidth;
        const gx = Math.max(-span, Math.min(span, g.cx + Math.sin((g.age + t) * GATE.swaySpeed + g.phase) * GATE.sway));
        return this.angleTo(gx, g.y) + this.aimNoise;
      }
    }
    if (this.aimMode === 'bank') {
      // mirror the target across the wall on the side the foe is closer to
      const wall = tx >= 0 ? half : -half;
      tx = 2 * wall - tx;
    } else if (this.aimMode === 'bump') {
      const b = this.game.activePucks()[this.bumpIdx] ?? this.game.bumps[0];
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
      if (Math.random() > Math.min(0.95, pr.dodge * this.agility)) continue;
      // step to whichever side is clear and inside the rail
      let side = px > me.x ? -1 : 1;
      const target = me.x + side * (danger + 0.4);
      if (target < me.lane[0] || target > me.lane[1]) side = -side;
      this.reactQueue.push({ at: this.t + pr.reaction / this.agility, target: me.x + side * (danger + 0.4) });
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

    // go and grab a crate dropping on our rail
    // B-Daman mode: running low, go and pick up the marbles that rolled back to this end
    if (g.bdaman && me.ammo < Math.max(3, me.stats.capacity * 0.5)) {
      let best: { x: number } | null = null;
      for (const b of g.loose) if (Math.sign(b.y) === Math.sign(me.railY) && Math.abs(b.y - me.railY) < 2.2 && (!best || Math.abs(b.x - me.x) < Math.abs(best.x - me.x))) best = b;
      if (best) {
        me.moveTarget = best.x;
        return;
      }
    }
    const drop = g.drops.find((d) => d.team === me.team && d.x >= me.lane[0] - 0.5 && d.x <= me.lane[1] + 0.5);
    if (drop && !me.item && drop.h < 6) {
      me.moveTarget = drop.x;
      return;
    }

    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeTimer = rand(0.6, 1.8);
      // strafe within this robot's lane (opponents in a pack share the rail)
      const [lo, hi] = me.lane;
      const mid = (lo + hi) / 2;
      const range = ((hi - lo) / 2) * Math.min(1, pr.moveSpeedMul * this.speedMul);
      // a straight shooter can't turn, so it walks to line up with you instead
      this.strafeTarget = this.straight ? Math.max(lo, Math.min(hi, this.foe.x + rand(-0.8, 0.8))) : mid + rand(-range, range);
    }
    // approach strafe target at a speed scaled by mobility
    const delta = this.strafeTarget - me.x;
    me.moveTarget = null;
    me.moveAxis = Math.abs(delta) < 0.1 ? 0 : Math.sign(delta) * pr.moveSpeedMul;
  }
}
