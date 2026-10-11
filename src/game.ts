import RAPIER from '@dimforge/rapier2d';
import { AIM_LIMIT, ARENA, MATCH, type ShooterStats } from './config';
import { BOOST, DRAGON, DROP, GATE, GATES, GATE_TYPES, HEAL, ITEMS, ITEM_TYPES, MISSILE, MULTI, X5, type GateType, type ItemType } from './items';
import * as sfx from './audio';

// Collision groups: membership in the high 16 bits, filter in the low 16.
const G = { WALL: 1, FENCE: 2, BUMP: 4, PSH: 8, ESH: 16, PM: 32, EM: 64 };
const groups = (member: number, filter: number) => (member << 16) | filter;

const GROUPS = {
  wall: groups(G.WALL, G.PM | G.EM | G.BUMP),
  fence: groups(G.FENCE, G.BUMP),
  bump: groups(G.BUMP, G.WALL | G.FENCE | G.BUMP | G.PM | G.EM | G.PSH | G.ESH),
  shooter: [groups(G.PSH, G.EM | G.BUMP), groups(G.ESH, G.PM | G.BUMP)],
  marble: [
    groups(G.PM, G.WALL | G.BUMP | G.ESH | G.PM | G.EM),
    groups(G.EM, G.WALL | G.BUMP | G.PSH | G.PM | G.EM),
  ],
};

export const STEP = 1 / 60;

/** hits needed to charge one super shot */
export const SUPER_HITS = 3;
/** how a super marble differs from a normal one */
const SUPER = { radius: 2.2, mass: 40, speed: 1.15, damage: 4 };

/** symmetric puck layouts for 1..5 pucks */
const PUCK_LAYOUTS: [number, number][][] = [
  [],
  [[0, 0]],
  [
    [-2.4, 0],
    [2.4, 0],
  ],
  [
    [0, 0],
    [-2.8, 0],
    [2.8, 0],
  ],
  [
    [-2.6, -3.2],
    [2.6, -3.2],
    [-2.6, 3.2],
    [2.6, 3.2],
  ],
  [
    [-2.6, -3.2],
    [2.6, -3.2],
    [0, 0],
    [-2.6, 3.2],
    [2.6, 3.2],
  ],
];
const MAX_PUCKS = 5;

export type Team = 0 | 1; // 0 = player, 1 = opponent
export type MarbleKind = 'normal' | 'super' | 'dragon' | 'x5';

export interface Marble {
  idx: number;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  active: boolean;
  team: Team;
  age: number;
  bounces: number;
  damage: number;
  radius: number;
  spawnOrder: number;
  kind: MarbleKind;
  /** dragon balls: which way the weave starts (+1 / -1) */
  weave: number;
  /** id of the last gate this ball went through (each gate acts once per ball) */
  lastGate: number;
}

export interface Missile {
  id: number;
  team: Team;
  x: number;
  y: number;
  /** heading (radians, atan2 of velocity) */
  heading: number;
  hits: number;
  age: number;
  /** seconds of coasting after a hit before it turns back in */
  recover: number;
}

export interface Gate {
  id: number;
  type: GateType;
  x: number;
  y: number;
  /** centre the gate slides around, and its phase */
  cx: number;
  phase: number;
  age: number;
  life: number;
  charges: number;
}

export interface Bump {
  idx: number;
  body: RAPIER.RigidBody;
  radius: number;
  active: boolean;
  home: [number, number];
}

export interface Drop {
  id: number;
  team: Team;
  type: ItemType;
  x: number;
  /** height above the floor; 0 = landed */
  h: number;
  /** seconds left once landed */
  life: number;
}

export type Fx =
  | { type: 'hit'; x: number; y: number; team: Team; amount: number; power: MarbleKind | 'missile' }
  | { type: 'missile-launch'; team: Team }
  | { type: 'drop-destroyed'; x: number; y: number; team: Team; item: ItemType }
  | { type: 'missile-end'; x: number; y: number; team: Team }
  | { type: 'super-ready'; team: Team }
  | { type: 'super-fire'; team: Team }
  | { type: 'spark'; x: number; y: number; intensity: number }
  | { type: 'muzzle'; team: Team }
  | { type: 'reload'; team: Team }
  | { type: 'pickup'; team: Team; item: ItemType }
  | { type: 'use'; team: Team; item: ItemType }
  | { type: 'heal'; team: Team; amount: number }
  | { type: 'gate-pass'; x: number; y: number; gate: GateType; team: Team }
  | { type: 'gate-break'; x: number; y: number; gate: GateType };

export class Shooter {
  x = 0;
  vx = 0;
  readonly y: number;
  readonly forward: 1 | -1;
  /** aim angle relative to straight ahead, radians, + is toward +x */
  aim = 0;
  /** -1..1 from keys/AI, or null when a drag target is in use */
  moveAxis = 0;
  moveTarget: number | null = null;
  firing = false;

  maxHealth: number = MATCH.maxHealth;
  health: number = MATCH.maxHealth;
  ammo: number;
  reload = 0; // seconds left in a forced reload
  idle = 0; // seconds since last shot, drives the trickle refill
  cooldown = 0;
  flash = 0;
  recoil = 0;

  shots = 0;
  hits = 0;
  dealt = 0;
  /** hits landed toward the next super shot (0..SUPER_HITS) */
  charge = 0;
  /** the next marble fired will be a super shot */
  superReady = false;
  /** seconds of knock-back stagger after taking a super hit */
  stagger = 0;

  /** held air-drop item, used on demand */
  item: ItemType | null = null;
  /** seconds left on timed item effects */
  multiT = 0;
  boostT = 0;
  /** dragon balls still to launch, and the gap timer */
  dragonQueue = 0;
  dragonTimer = 0;
  /** seconds since this robot last landed a hit / took one (portraits read these) */
  sinceHit = 99;
  sinceHurt = 99;

  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;

  constructor(
    world: RAPIER.World,
    readonly team: Team,
    public stats: ShooterStats,
  ) {
    this.forward = team === 0 ? 1 : -1;
    this.y = team === 0 ? -ARENA.railY : ARENA.railY;
    this.ammo = stats.capacity;
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, this.y));
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.62, 0.5).setCollisionGroups(GROUPS.shooter[team]).setRestitution(0.6),
      this.body,
    );
  }

  get halfWidth() {
    return 0.62;
  }

  get hpFrac() {
    return this.health / this.maxHealth;
  }

  dir(angle = this.aim) {
    return { x: Math.sin(angle), y: Math.cos(angle) * this.forward };
  }

  muzzle() {
    const d = this.dir();
    return { x: this.x + d.x * 0.95, y: this.y + d.y * 0.95 };
  }

  reset(stats: ShooterStats, maxHealth: number) {
    this.stats = stats;
    this.x = 0;
    this.vx = 0;
    this.aim = 0;
    this.moveAxis = 0;
    this.moveTarget = null;
    this.firing = false;
    this.maxHealth = maxHealth;
    this.health = maxHealth;
    this.ammo = stats.capacity;
    this.reload = 0;
    this.idle = 0;
    this.cooldown = 0;
    this.flash = 0;
    this.recoil = 0;
    this.shots = this.hits = this.dealt = 0;
    this.charge = 0;
    this.superReady = false;
    this.stagger = 0;
    this.item = null;
    this.multiT = this.boostT = 0;
    this.dragonQueue = this.dragonTimer = 0;
    this.sinceHit = this.sinceHurt = 99;
    this.body.setTranslation({ x: 0, y: this.y }, true);
  }
}

type Tag = { kind: 'marble'; m: Marble } | { kind: 'shooter'; s: Shooter } | { kind: 'wall' } | { kind: 'bump'; b: Bump };

export type Phase = 'countdown' | 'fight' | 'ko' | 'over';

export interface MatchOptions {
  enemyMaxHealth: number;
  pucks: number;
  items: boolean;
  gates: boolean;
}

export class Game {
  world: RAPIER.World;
  events: RAPIER.EventQueue;
  shooters: [Shooter, Shooter];
  marbles: Marble[] = [];
  bumps: Bump[] = [];
  drops: Drop[] = [];
  gates: Gate[] = [];
  missiles: Missile[] = [];
  /** moving power gates on/off */
  gatesOn = true;
  /** how many pucks are on the table; unused ones are removed from physics */
  puckCount = MAX_PUCKS;
  /** air drops on/off */
  itemsOn = true;
  fx: Fx[] = [];

  phase: Phase = 'countdown';
  phaseTime = 0;
  clock: number = MATCH.duration;
  winner: Team | -1 | null = null;
  /** seconds of frozen physics after a heavy hit */
  hitstop = 0;

  private tags = new Map<number, Tag>();
  private spawnCounter = 0;
  private activeCount = 0;
  private toDespawn = new Set<Marble>();
  private nextDrop = DROP.first;
  private dropSide: Team = Math.random() < 0.5 ? 0 : 1;
  private dropId = 0;
  private nextGate = GATE.first;
  private missileId = 0;
  private gateId = 0;

  constructor(playerStats: ShooterStats, enemyStats: ShooterStats) {
    this.world = new RAPIER.World({ x: 0, y: 0 });
    this.world.timestep = STEP;
    this.events = new RAPIER.EventQueue(true);

    this.buildArena();
    this.shooters = [new Shooter(this.world, 0, playerStats), new Shooter(this.world, 1, enemyStats)];
    for (const s of this.shooters) this.tags.set(s.collider.handle, { kind: 'shooter', s });
    this.buildBumps();
    this.buildPool();
  }

  private buildArena() {
    const hw = ARENA.width / 2;
    const t = ARENA.wallThickness;
    const ground = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    for (const side of [-1, 1]) {
      const wall = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(t / 2, ARENA.length / 2)
          .setTranslation(side * (hw + t / 2), 0)
          .setRestitution(0.92)
          .setFriction(0)
          .setCollisionGroups(GROUPS.wall),
        ground,
      );
      this.tags.set(wall.handle, { kind: 'wall' });
      // fences keep bumps in the middle band; marbles pass straight through
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(hw, 0.1).setTranslation(0, side * ARENA.bumpFenceY).setCollisionGroups(GROUPS.fence),
        ground,
      );
    }
  }

  private buildBumps() {
    for (let idx = 0; idx < MAX_PUCKS; idx++) {
      const [x, y] = PUCK_LAYOUTS[MAX_PUCKS][idx];
      const radius = 0.65;
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y).setLinearDamping(2.2).setAngularDamping(3),
      );
      const col = this.world.createCollider(
        RAPIER.ColliderDesc.ball(radius).setDensity(5).setRestitution(0.5).setFriction(0.2).setCollisionGroups(GROUPS.bump),
        body,
      );
      const b: Bump = { idx, body, radius, active: true, home: [x, y] };
      this.tags.set(col.handle, { kind: 'bump', b });
      this.bumps.push(b);
    }
  }

  private buildPool() {
    for (let i = 0; i < MATCH.marblePool; i++) {
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(0, -100 - i)
          .setCcdEnabled(true)
          .setLinearDamping(0.12)
          .setEnabled(false),
      );
      const collider = this.world.createCollider(
        RAPIER.ColliderDesc.ball(0.22)
          .setRestitution(0.9)
          .setFriction(0)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS)
          .setCollisionGroups(GROUPS.marble[0]),
        body,
      );
      const m: Marble = {
        idx: i,
        body,
        collider,
        active: false,
        team: 0,
        age: 0,
        bounces: 0,
        damage: 0,
        radius: 0.22,
        spawnOrder: 0,
        kind: 'normal',
        weave: 1,
        lastGate: -1,
      };
      this.tags.set(collider.handle, { kind: 'marble', m });
      this.marbles.push(m);
    }
  }

  reset(playerStats: ShooterStats, enemyStats: ShooterStats, opts: MatchOptions) {
    this.shooters[0].reset(playerStats, MATCH.maxHealth);
    this.shooters[1].reset(enemyStats, opts.enemyMaxHealth);
    for (const m of this.marbles) if (m.active) this.despawn(m);
    this.puckCount = opts.pucks;
    this.itemsOn = opts.items;
    this.gatesOn = opts.gates;
    this.gates.length = 0;
    this.nextGate = GATE.first;
    this.missiles.length = 0;
    this.placePucks();
    this.bumps.forEach((b) => {
      b.body.setLinvel({ x: 0, y: 0 }, true);
      b.body.setAngvel(0, true);
    });
    this.drops.length = 0;
    this.nextDrop = DROP.first;
    this.dropSide = Math.random() < 0.5 ? 0 : 1;
    this.phase = 'countdown';
    this.phaseTime = 0;
    this.clock = MATCH.duration;
    this.winner = null;
    this.hitstop = 0;
    this.fx.length = 0;
  }

  /** Enable the first puckCount pucks at their layout spots; disable the rest. */
  placePucks() {
    const n = Math.max(0, Math.min(MAX_PUCKS, Math.round(this.puckCount)));
    const layout = PUCK_LAYOUTS[n];
    this.bumps.forEach((b, i) => {
      b.active = i < n;
      b.body.setEnabled(b.active);
      if (b.active) {
        b.home = layout[i];
        b.body.setTranslation({ x: b.home[0], y: b.home[1] }, true);
        b.body.setLinvel({ x: 0, y: 0 }, true);
      }
    });
  }

  activePucks() {
    return this.bumps.filter((b) => b.active);
  }

  /** One fixed physics + gameplay tick. */
  step(dt: number) {
    this.phaseTime += dt;
    if (this.phase === 'countdown' && this.phaseTime >= MATCH.countdown) {
      this.phase = 'fight';
      this.phaseTime = 0;
      sfx.play('go');
    }
    if (this.phase === 'fight') {
      this.clock = Math.max(0, this.clock - dt);
      if (this.clock <= 0) this.finish();
    }
    if (this.phase === 'ko' && this.phaseTime > 1.8) {
      this.phase = 'over';
      this.phaseTime = 0;
    }

    const canAct = this.phase === 'fight';
    for (const s of this.shooters) this.updateShooter(s, dt, canAct);
    if (canAct) this.updateDrops(dt);

    // bumps drift slowly home so cover never stays piled in one corner
    for (const b of this.bumps) {
      if (!b.active) continue;
      const p = b.body.translation();
      const k = 0.9 * b.body.mass() * dt;
      b.body.applyImpulse({ x: (b.home[0] - p.x) * k, y: (b.home[1] - p.y) * k }, true);
    }

    // dragon balls weave: lateral velocity follows A·ω·cos(ωt)
    for (const m of this.marbles) {
      if (!m.active || m.kind !== 'dragon') continue;
      const v = m.body.linvel();
      const w = DRAGON.freq;
      const dv = DRAGON.amp * w * (Math.cos(w * (m.age + dt)) - Math.cos(w * m.age)) * m.weave;
      m.body.setLinvel({ x: v.x + dv, y: v.y }, true);
    }

    this.world.step(this.events);
    this.events.drainCollisionEvents((h1, h2, started) => {
      if (started) this.onContact(h1, h2);
    });

    const limitY = ARENA.length / 2 + 1;
    for (const m of this.marbles) {
      if (!m.active) continue;
      m.age += dt;
      const p = m.body.translation();
      const v = m.body.linvel();
      const speed2 = v.x * v.x + v.y * v.y;
      const life = MATCH.marbleLifetime * (m.kind === 'super' ? 1.5 : m.kind === 'dragon' ? DRAGON.life : m.kind === 'x5' ? 1.3 : 1);
      if (m.age > life || Math.abs(p.y) > limitY || Math.abs(p.x) > ARENA.width || (m.age > 0.3 && speed2 < 2)) {
        this.toDespawn.add(m);
      }
    }
    if (canAct) {
      this.updateGates(dt);
      this.updateMissiles(dt);
    }

    for (const m of this.toDespawn) this.despawn(m);
    this.toDespawn.clear();
  }

  // ---------- homing missiles ----------

  private launchMissile(s: Shooter) {
    const d = s.dir(0);
    this.missiles.push({ id: this.missileId++, team: s.team, x: s.x, y: s.y + d.y * 1.1, heading: Math.atan2(d.y, d.x), hits: 0, age: 0, recover: 0 });
    this.fx.push({ type: 'missile-launch', team: s.team });
  }

  private updateMissiles(dt: number) {
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      const target = this.shooters[m.team === 0 ? 1 : 0];
      m.age += dt;
      m.recover = Math.max(0, m.recover - dt);
      // steer toward the target with a capped turn rate
      if (m.recover <= 0) {
        const want = Math.atan2(target.y - m.y, target.x - m.x);
        let diff = want - m.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = MISSILE.turnRate * dt;
        m.heading += Math.max(-turn, Math.min(turn, diff));
      }
      m.x += Math.cos(m.heading) * MISSILE.speed * dt;
      m.y += Math.sin(m.heading) * MISSILE.speed * dt;
      // bounce off the side walls and keep within the table ends
      const hw = ARENA.width / 2 - 0.3;
      if (Math.abs(m.x) > hw) {
        m.x = Math.sign(m.x) * hw;
        m.heading = Math.PI - m.heading;
      }
      const hl = ARENA.length / 2 - 0.5;
      if (Math.abs(m.y) > hl) {
        m.y = Math.sign(m.y) * hl;
        m.heading = -m.heading;
      }
      if (m.recover <= 0 && Math.hypot(target.x - m.x, target.y - m.y) < MISSILE.hitRadius + target.halfWidth * 0.5) {
        const attacker = this.shooters[m.team];
        const amount = MISSILE.damage * (attacker.stats.damage / 4.4);
        target.health = Math.max(0, target.health - amount);
        target.flash = 0.25;
        target.sinceHurt = 0;
        attacker.dealt += amount;
        attacker.sinceHit = 0;
        m.hits++;
        this.hitstop = Math.max(this.hitstop, 0.08);
        this.fx.push({ type: 'hit', x: m.x, y: m.y, team: target.team, amount, power: 'missile' });
        sfx.play(target.team === 0 ? 'hurt' : 'hit', 1);
        // bounce back out and come round again
        m.heading += Math.PI + (Math.random() - 0.5) * 1.2;
        m.recover = MISSILE.recover;
        if (target.health <= 0) this.finish();
      }
      if (m.hits >= MISSILE.hits || m.age > MISSILE.life) {
        this.fx.push({ type: 'missile-end', x: m.x, y: m.y, team: m.team });
        this.missiles.splice(i, 1);
      }
    }
  }

  // ---------- gates ----------

  private updateGates(dt: number) {
    if (this.gatesOn) {
      this.nextGate -= dt;
      if (this.nextGate <= 0 && !this.gates.length) {
        this.spawnGate();
        this.nextGate = GATE.every[0] + Math.random() * (GATE.every[1] - GATE.every[0]);
      }
    }
    const span = ARENA.width / 2 - GATE.halfWidth;
    for (let i = this.gates.length - 1; i >= 0; i--) {
      const g = this.gates[i];
      g.age += dt;
      // slide side to side, kept inside the walls
      g.x = Math.max(-span, Math.min(span, g.cx + Math.sin(g.age * GATE.swaySpeed + g.phase) * GATE.sway));
      if (g.age >= g.life) {
        this.gates.splice(i, 1);
        continue;
      }
      if (g.charges <= 0) continue;
      for (const m of this.marbles) {
        if (!m.active || m.lastGate === g.id || this.toDespawn.has(m)) continue;
        const p = m.body.translation();
        if (Math.abs(p.y - g.y) > 0.4 || Math.abs(p.x - g.x) > GATE.halfWidth) continue;
        m.lastGate = g.id;
        if (this.applyGate(m, g)) {
          g.charges--;
          this.fx.push({ type: 'gate-pass', x: p.x, y: p.y, gate: g.type, team: m.team });
          sfx.play('charge', 0.8);
          if (g.charges <= 0) {
            // shatter shortly after the last charge
            g.life = Math.min(g.life, g.age + 0.35);
            this.fx.push({ type: 'gate-break', x: g.x, y: g.y, gate: g.type });
          }
        }
        if (g.charges <= 0) break;
      }
    }
  }

  private spawnGate() {
    const type = GATE_TYPES[Math.floor(Math.random() * GATE_TYPES.length)];
    const y = (Math.random() * 2 - 1) * GATE.band;
    this.gates.push({
      id: this.gateId++,
      type,
      x: 0,
      y,
      cx: (Math.random() * 2 - 1) * 1.2,
      phase: Math.random() * Math.PI * 2,
      age: 0,
      life: GATE.life,
      charges: GATES[type].charges,
    });
  }

  /** Transform a ball passing through a gate. Returns false if it doesn't apply. */
  private applyGate(m: Marble, g: Gate) {
    const st = this.shooters[m.team].stats;
    switch (g.type) {
      case 'x5':
        // multiplies whatever the ball carries; a ball can't be 5× twice
        if (m.kind === 'x5') return false;
        m.damage *= X5.damage;
        if (m.kind === 'normal') {
          m.kind = 'x5';
          this.resize(m, m.radius * X5.radius, st.marbleMass * X5.mass);
        }
        return true;
      case 'pow':
        if (m.kind !== 'normal') return false;
        m.kind = 'super';
        m.damage = st.damage * SUPER.damage;
        this.resize(m, st.marbleRadius * SUPER.radius, st.marbleMass * SUPER.mass);
        return true;
      case 'drg': {
        if (m.kind === 'dragon' || m.kind === 'super') return false;
        // the ball becomes the head of a three-ball dragon braid
        const p = m.body.translation();
        const v = m.body.linvel();
        const mult = m.kind === 'x5' ? X5.damage : 1;
        for (let i = 0; i < DRAGON.count; i++) {
          const d = i === 0 ? m : this.takeMarble();
          if (!d) break;
          if (i > 0) this.revive(d, m.team, { x: p.x, y: p.y - Math.sign(v.y) * i * 0.6 }, v);
          d.kind = 'dragon';
          d.damage = st.damage * DRAGON.damage * mult;
          d.weave = i % 2 === 0 ? 1 : -1;
          d.age = 0;
          d.lastGate = g.id;
          this.resize(d, st.marbleRadius * DRAGON.radius, st.marbleMass * DRAGON.mass);
          const dv = d.body.linvel();
          d.body.setLinvel({ x: dv.x + DRAGON.amp * DRAGON.freq * d.weave, y: dv.y }, true);
        }
        return true;
      }
    }
  }

  private resize(m: Marble, radius: number, mass: number) {
    m.radius = radius;
    m.collider.setRadius(radius);
    m.collider.setMass(mass);
  }

  /** Bring a pooled marble to life at a position with a velocity (used by gates). */
  private revive(m: Marble, team: Team, pos: { x: number; y: number }, vel: { x: number; y: number }) {
    m.active = true;
    m.team = team;
    m.bounces = 0;
    m.spawnOrder = this.spawnCounter++;
    m.collider.setCollisionGroups(GROUPS.marble[team]);
    m.body.setEnabled(true);
    m.body.setTranslation(pos, true);
    m.body.setLinvel(vel, true);
    this.activeCount++;
  }

  private updateShooter(s: Shooter, dt: number, canAct: boolean) {
    // movement (overdrive speeds it up)
    const maxX = ARENA.railHalfWidth;
    const speed = s.stats.moveSpeed * (s.boostT > 0 ? BOOST.speed : 1);
    const prevX = s.x;
    if (canAct || this.phase === 'countdown') {
      if (s.moveTarget !== null) {
        const delta = Math.max(-maxX, Math.min(maxX, s.moveTarget)) - s.x;
        const stepMax = speed * 1.6 * dt;
        s.x += Math.max(-stepMax, Math.min(stepMax, delta));
      } else {
        s.x += s.moveAxis * speed * dt;
      }
    }
    s.x = Math.max(-maxX, Math.min(maxX, s.x));
    s.vx = (s.x - prevX) / dt;
    s.body.setNextKinematicTranslation({ x: s.x, y: s.y });
    s.aim = Math.max(-AIM_LIMIT, Math.min(AIM_LIMIT, s.aim));

    s.flash = Math.max(0, s.flash - dt);
    s.stagger = Math.max(0, s.stagger - dt);
    s.recoil = Math.max(0, s.recoil - dt * 8);
    s.cooldown -= dt;
    s.sinceHit += dt;
    s.sinceHurt += dt;
    if (canAct) {
      s.multiT = Math.max(0, s.multiT - dt);
      s.boostT = Math.max(0, s.boostT - dt);
    }

    // dragon salvo launches on its own, a short gap between balls
    if (canAct && s.dragonQueue > 0) {
      s.dragonTimer -= dt;
      if (s.dragonTimer <= 0) {
        this.fireDragon(s, DRAGON.count - s.dragonQueue);
        s.dragonQueue--;
        s.dragonTimer = DRAGON.gap;
      }
    }

    // magazine: forced reload when empty, slow trickle refill when idle
    if (s.reload > 0) {
      s.reload -= dt;
      if (s.reload <= 0) {
        s.ammo = s.stats.capacity;
        this.fx.push({ type: 'reload', team: s.team });
        if (s.team === 0) sfx.play('reload');
      }
    } else if (!s.firing || !canAct) {
      s.idle += dt;
      if (s.idle > 0.45 && s.ammo < s.stats.capacity) {
        s.ammo = Math.min(s.stats.capacity, s.ammo + (dt * s.stats.capacity) / (s.stats.reloadTime * 1.6));
      }
    }

    if (canAct && s.firing && s.reload <= 0 && s.cooldown <= 0 && s.ammo >= 1) {
      const multi = s.multiT > 0 && !s.superReady;
      if (multi) this.fireVolley(s);
      else this.fire(s);
      s.cooldown = s.stats.fireInterval * (multi ? MULTI.interval : 1);
      s.idle = 0;
      s.ammo -= 1;
      if (s.ammo < 1) s.reload = s.stats.reloadTime;
    }
  }

  // ---------- air drops ----------

  private updateDrops(dt: number) {
    if (this.itemsOn) {
      this.nextDrop -= dt;
      if (this.nextDrop <= 0) {
        this.spawnDrop();
        this.nextDrop = DROP.every[0] + Math.random() * (DROP.every[1] - DROP.every[0]);
      }
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (d.h > 0) d.h = Math.max(0, d.h - DROP.fallSpeed * dt);
      else d.life -= dt;
      const s = this.shooters[d.team];
      // grab it once it's low enough to reach, if the robot's hands are free
      if (d.h < 1.2 && !s.item && Math.abs(s.x - d.x) < DROP.reach) {
        s.item = d.type;
        this.drops.splice(i, 1);
        this.fx.push({ type: 'pickup', team: s.team, item: d.type });
        if (s.team === 0) sfx.play('charge');
        continue;
      }
      // the other side can shoot a low crate to deny it
      if (d.h < 1.0 && this.shotDown(d)) {
        this.drops.splice(i, 1);
        continue;
      }
      if (d.life <= 0) this.drops.splice(i, 1);
    }
  }

  /** True if an opposing marble hit this crate (the marble is spent). */
  private shotDown(d: Drop) {
    const y = this.shooters[d.team].y;
    for (const m of this.marbles) {
      if (!m.active || m.team === d.team || this.toDespawn.has(m)) continue;
      const p = m.body.translation();
      const reach = 0.36 + m.radius;
      if (Math.abs(p.x - d.x) > reach || Math.abs(p.y - y) > reach) continue;
      if (m.kind === 'normal') this.toDespawn.add(m);
      this.fx.push({ type: 'drop-destroyed', x: d.x, y, team: d.team, item: d.type });
      sfx.play('bump', 1);
      return true;
    }
    return false;
  }

  private spawnDrop() {
    const team = this.dropSide;
    this.dropSide = team === 0 ? 1 : 0;
    // one crate per side at a time
    if (this.drops.some((d) => d.team === team)) return;
    const s = this.shooters[team];
    let total = 0;
    const weights = ITEM_TYPES.map((t) => {
      // repair kits mostly arrive when they're needed
      const w = t === 'heal' ? ITEMS.heal.weight * (s.hpFrac < 0.7 ? 1.6 : 0.25) : ITEMS[t].weight;
      total += w;
      return w;
    });
    let r = Math.random() * total;
    let type = ITEM_TYPES[0];
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        type = ITEM_TYPES[i];
        break;
      }
    }
    const span = ARENA.railHalfWidth - 0.4;
    this.drops.push({ id: this.dropId++, team, type, x: (Math.random() * 2 - 1) * span, h: DROP.startHeight, life: DROP.landedLife });
  }

  /** Activate the held item. Returns false when there's nothing to use. */
  useItem(s: Shooter) {
    if (!s.item || this.phase !== 'fight') return false;
    const item = s.item;
    s.item = null;
    switch (item) {
      case 'multi':
        s.multiT = ITEMS.multi.duration;
        break;
      case 'boost':
        s.boostT = ITEMS.boost.duration;
        break;
      case 'heal': {
        const before = s.health;
        s.health = Math.min(s.maxHealth, s.health + s.maxHealth * HEAL.fraction);
        this.fx.push({ type: 'heal', team: s.team, amount: s.health - before });
        break;
      }
      case 'dragon':
        s.dragonQueue = DRAGON.count;
        s.dragonTimer = 0;
        break;
      case 'missile':
        this.launchMissile(s);
        break;
    }
    this.fx.push({ type: 'use', team: s.team, item });
    sfx.play(item === 'dragon' ? 'super' : 'charge', s.team === 0 ? 1 : 0.6);
    return true;
  }

  // ---------- firing ----------

  private takeMarble() {
    if (this.activeCount >= MATCH.marbleCap) {
      // recycle the oldest marble rather than refusing to fire
      let oldest: Marble | null = null;
      for (const m of this.marbles) if (m.active && (!oldest || m.spawnOrder < oldest.spawnOrder)) oldest = m;
      if (oldest) this.despawn(oldest);
    }
    return this.marbles.find((mm) => !mm.active) ?? null;
  }

  private launch(m: Marble, s: Shooter, o: { angle: number; radius: number; speed: number; mass: number; damage: number; kind: MarbleKind; push?: number; weave?: number }) {
    const d = s.dir(o.angle);
    const p = s.muzzle();
    const push = o.push ?? 0;
    m.active = true;
    m.team = s.team;
    m.kind = o.kind;
    m.weave = o.weave ?? 1;
    m.lastGate = -1;
    m.age = 0;
    m.bounces = 0;
    m.damage = o.damage;
    m.radius = o.radius;
    m.spawnOrder = this.spawnCounter++;
    m.collider.setRadius(o.radius);
    m.collider.setMass(o.mass);
    m.collider.setCollisionGroups(GROUPS.marble[s.team]);
    m.body.setEnabled(true);
    m.body.setTranslation({ x: p.x + d.x * push, y: p.y + d.y * push }, true);
    m.body.setLinvel({ x: d.x * o.speed, y: d.y * o.speed }, true);
    this.activeCount++;
  }

  private fire(s: Shooter) {
    const m = this.takeMarble();
    if (!m) return;
    const st = s.stats;
    const isSuper = s.superReady;
    s.superReady = false;
    const radius = st.marbleRadius * (isSuper ? SUPER.radius : 1);
    this.launch(m, s, {
      // a super shot flies dead straight
      angle: s.aim + (isSuper ? 0 : (Math.random() * 2 - 1) * st.spread),
      radius,
      speed: st.muzzleSpeed * (isSuper ? SUPER.speed : 1),
      mass: st.marbleMass * (isSuper ? SUPER.mass : 1),
      damage: st.damage * (isSuper ? SUPER.damage : 1),
      kind: isSuper ? 'super' : 'normal',
      // nudge a big marble forward so it doesn't spawn inside the robot
      push: isSuper ? radius : 0,
    });
    s.shots++;
    s.recoil = 1;
    this.fx.push({ type: isSuper ? 'super-fire' : 'muzzle', team: s.team });
    sfx.play(isSuper ? 'super' : 'fire', s.team === 0 ? 1 : 0.55);
  }

  /** Multi shot: a fan of marbles from one trigger pull. */
  private fireVolley(s: Shooter) {
    const st = s.stats;
    for (let i = 0; i < MULTI.count; i++) {
      const m = this.takeMarble();
      if (!m) break;
      const t = MULTI.count === 1 ? 0 : i / (MULTI.count - 1) - 0.5;
      this.launch(m, s, {
        angle: s.aim + t * 2 * MULTI.fan,
        radius: st.marbleRadius,
        speed: st.muzzleSpeed,
        mass: st.marbleMass,
        damage: st.damage * MULTI.damage,
        kind: 'normal',
      });
      s.shots++;
    }
    s.recoil = 1;
    this.fx.push({ type: 'muzzle', team: s.team });
    sfx.play('fire', s.team === 0 ? 1 : 0.55);
  }

  private fireDragon(s: Shooter, i: number) {
    const m = this.takeMarble();
    if (!m) return;
    const st = s.stats;
    const radius = st.marbleRadius * DRAGON.radius;
    const weave = i % 2 === 0 ? 1 : -1;
    this.launch(m, s, {
      angle: s.aim,
      radius,
      speed: st.muzzleSpeed * DRAGON.speed,
      mass: st.marbleMass * DRAGON.mass,
      damage: st.damage * DRAGON.damage,
      kind: 'dragon',
      push: radius,
      weave,
    });
    // start the weave with a sideways kick (velocity = A·ω at t = 0)
    const v = m.body.linvel();
    m.body.setLinvel({ x: v.x + DRAGON.amp * DRAGON.freq * weave, y: v.y }, true);
    s.recoil = 1;
    this.fx.push({ type: 'super-fire', team: s.team });
    sfx.play('fire', 1);
  }

  private despawn(m: Marble) {
    if (!m.active) return;
    m.active = false;
    m.body.setLinvel({ x: 0, y: 0 }, false);
    m.body.setTranslation({ x: 0, y: -100 - m.idx }, false);
    m.body.setEnabled(false);
    this.activeCount--;
  }

  private onContact(h1: number, h2: number) {
    const a = this.tags.get(h1);
    const b = this.tags.get(h2);
    if (!a || !b) return;
    if (a.kind !== 'marble' && b.kind !== 'marble') return;
    const [m, other] = a.kind === 'marble' ? [a.m, b] : [(b as { m: Marble }).m, a];
    if (!m.active || this.toDespawn.has(m)) return;
    const v = m.body.linvel();
    const speed = Math.hypot(v.x, v.y);
    const p = m.body.translation();

    switch (other.kind) {
      case 'shooter': {
        const s = other.s;
        if (s.team === m.team) return;
        this.toDespawn.add(m);
        if (this.phase !== 'fight') return;
        const heavy = m.kind !== 'normal';
        // power balls always land at full power
        const factor = heavy ? 1 : Math.max(0.45, Math.min(1.25, speed / 15));
        const amount = m.damage * factor;
        s.health = Math.max(0, s.health - amount);
        s.flash = heavy ? 0.3 : 0.12;
        s.sinceHurt = 0;
        if (m.kind === 'super') s.stagger = 0.45;
        const attacker = this.shooters[m.team];
        attacker.hits++;
        attacker.dealt += amount;
        attacker.sinceHit = 0;
        if (!heavy && !attacker.superReady) {
          attacker.charge = Math.min(SUPER_HITS, attacker.charge + 1);
          if (attacker.charge >= SUPER_HITS) {
            attacker.charge = 0;
            attacker.superReady = true;
            this.fx.push({ type: 'super-ready', team: attacker.team });
            if (attacker.team === 0) sfx.play('charge');
          }
        }
        this.hitstop = Math.max(this.hitstop, m.kind === 'super' ? 0.16 : m.kind === 'dragon' || m.kind === 'x5' ? 0.09 : s.team === 0 ? 0.06 : 0.04);
        this.fx.push({ type: 'hit', x: p.x, y: p.y, team: s.team, amount, power: m.kind });
        sfx.play(m.kind === 'super' ? 'superhit' : s.team === 0 ? 'hurt' : 'hit', factor);
        if (s.health <= 0) this.finish();
        break;
      }
      case 'marble': {
        const o = other.m;
        const ov = o.body.linvel();
        const rel = Math.hypot(v.x - ov.x, v.y - ov.y);
        sfx.play('clack', rel / 25);
        if (o.team !== m.team && rel > 8) {
          const op = o.body.translation();
          this.fx.push({ type: 'spark', x: (p.x + op.x) / 2, y: (p.y + op.y) / 2, intensity: rel / 30 });
        }
        break;
      }
      case 'wall':
        m.bounces++;
        sfx.play('wall', speed / 20);
        if (m.bounces > MATCH.marbleMaxBounces) this.toDespawn.add(m);
        break;
      case 'bump':
        m.bounces++;
        sfx.play('bump', speed / 18);
        break;
    }
  }

  private finish() {
    if (this.phase !== 'fight') return;
    const [p, e] = this.shooters;
    // compare fractions so a boosted-health opponent is judged fairly on time-out
    const pf = p.hpFrac;
    const ef = e.hpFrac;
    this.winner = Math.abs(pf - ef) < 1e-6 ? -1 : pf > ef ? 0 : 1;
    this.phase = 'ko';
    this.phaseTime = 0;
    for (const s of this.shooters) s.firing = false;
    for (const m of this.missiles) this.fx.push({ type: 'missile-end', x: m.x, y: m.y, team: m.team });
    this.missiles.length = 0;
  }

  activeMarbles() {
    return this.activeCount;
  }
}
