import RAPIER from '@dimforge/rapier2d';
import { AIM_LIMIT, ARENA, MATCH, type ShooterStats } from './config';
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

const BUMP_SPOTS = [
  [-2.6, -3.2],
  [2.6, -3.2],
  [0, 0],
  [-2.6, 3.2],
  [2.6, 3.2],
];

export type Team = 0 | 1; // 0 = player, 1 = opponent

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
}

export interface Bump {
  idx: number;
  body: RAPIER.RigidBody;
  radius: number;
}

export type Fx =
  | { type: 'hit'; x: number; y: number; team: Team; amount: number }
  | { type: 'spark'; x: number; y: number; intensity: number }
  | { type: 'muzzle'; team: Team }
  | { type: 'reload'; team: Team };

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

  dir(angle = this.aim) {
    return { x: Math.sin(angle), y: Math.cos(angle) * this.forward };
  }

  muzzle() {
    const d = this.dir();
    return { x: this.x + d.x * 0.95, y: this.y + d.y * 0.95 };
  }

  reset(stats: ShooterStats) {
    this.stats = stats;
    this.x = 0;
    this.vx = 0;
    this.aim = 0;
    this.moveAxis = 0;
    this.moveTarget = null;
    this.firing = false;
    this.health = MATCH.maxHealth;
    this.ammo = stats.capacity;
    this.reload = 0;
    this.idle = 0;
    this.cooldown = 0;
    this.flash = 0;
    this.recoil = 0;
    this.shots = this.hits = this.dealt = 0;
    this.body.setTranslation({ x: 0, y: this.y }, true);
  }
}

type Tag = { kind: 'marble'; m: Marble } | { kind: 'shooter'; s: Shooter } | { kind: 'wall' } | { kind: 'bump'; b: Bump };

export type Phase = 'countdown' | 'fight' | 'ko' | 'over';

export class Game {
  world: RAPIER.World;
  events: RAPIER.EventQueue;
  shooters: [Shooter, Shooter];
  marbles: Marble[] = [];
  bumps: Bump[] = [];
  /** pushable pucks on the table; off removes them from physics entirely */
  bumpsOn = true;
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
    BUMP_SPOTS.forEach(([x, y], idx) => {
      const radius = idx === 2 ? 0.75 : 0.6;
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y).setLinearDamping(2.2).setAngularDamping(3),
      );
      const col = this.world.createCollider(
        RAPIER.ColliderDesc.ball(radius).setDensity(5).setRestitution(0.5).setFriction(0.2).setCollisionGroups(GROUPS.bump),
        body,
      );
      const b: Bump = { idx, body, radius };
      this.tags.set(col.handle, { kind: 'bump', b });
      this.bumps.push(b);
    });
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
      const m: Marble = { idx: i, body, collider, active: false, team: 0, age: 0, bounces: 0, damage: 0, radius: 0.22, spawnOrder: 0 };
      this.tags.set(collider.handle, { kind: 'marble', m });
      this.marbles.push(m);
    }
  }

  reset(playerStats: ShooterStats, enemyStats: ShooterStats) {
    this.shooters[0].reset(playerStats);
    this.shooters[1].reset(enemyStats);
    for (const m of this.marbles) if (m.active) this.despawn(m);
    this.bumps.forEach((b, i) => {
      b.body.setEnabled(this.bumpsOn);
      b.body.setTranslation({ x: BUMP_SPOTS[i][0], y: BUMP_SPOTS[i][1] }, true);
      b.body.setLinvel({ x: 0, y: 0 }, true);
      b.body.setAngvel(0, true);
    });
    this.phase = 'countdown';
    this.phaseTime = 0;
    this.clock = MATCH.duration;
    this.winner = null;
    this.hitstop = 0;
    this.fx.length = 0;
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
    if (this.phase === 'ko' && this.phaseTime > 1.6) {
      this.phase = 'over';
      this.phaseTime = 0;
    }

    const canAct = this.phase === 'fight';
    for (const s of this.shooters) this.updateShooter(s, dt, canAct);

    // bumps drift slowly home so cover never stays piled in one corner
    if (this.bumpsOn) this.bumps.forEach((b, i) => {
      const p = b.body.translation();
      const k = 0.9 * b.body.mass() * dt;
      b.body.applyImpulse({ x: (BUMP_SPOTS[i][0] - p.x) * k, y: (BUMP_SPOTS[i][1] - p.y) * k }, true);
    });

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
      if (m.age > MATCH.marbleLifetime || Math.abs(p.y) > limitY || Math.abs(p.x) > ARENA.width || (m.age > 0.3 && speed2 < 2)) {
        this.toDespawn.add(m);
      }
    }
    for (const m of this.toDespawn) this.despawn(m);
    this.toDespawn.clear();
  }

  private updateShooter(s: Shooter, dt: number, canAct: boolean) {
    // movement
    const maxX = ARENA.railHalfWidth;
    const speed = s.stats.moveSpeed;
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
    s.recoil = Math.max(0, s.recoil - dt * 8);
    s.cooldown -= dt;

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
      this.fire(s);
      s.cooldown = s.stats.fireInterval;
      s.idle = 0;
      s.ammo -= 1;
      if (s.ammo < 1) s.reload = s.stats.reloadTime;
    }
  }

  private fire(s: Shooter) {
    if (this.activeCount >= MATCH.marbleCap) {
      // recycle the oldest marble rather than refusing to fire
      let oldest: Marble | null = null;
      for (const m of this.marbles) if (m.active && (!oldest || m.spawnOrder < oldest.spawnOrder)) oldest = m;
      if (oldest) this.despawn(oldest);
    }
    const m = this.marbles.find((mm) => !mm.active);
    if (!m) return;
    const st = s.stats;
    const angle = s.aim + (Math.random() * 2 - 1) * st.spread;
    const d = s.dir(angle);
    const p = s.muzzle();
    m.active = true;
    m.team = s.team;
    m.age = 0;
    m.bounces = 0;
    m.damage = st.damage;
    m.radius = st.marbleRadius;
    m.spawnOrder = this.spawnCounter++;
    m.collider.setRadius(st.marbleRadius);
    m.collider.setMass(st.marbleMass);
    m.collider.setCollisionGroups(GROUPS.marble[s.team]);
    m.body.setEnabled(true);
    m.body.setTranslation(p, true);
    m.body.setLinvel({ x: d.x * st.muzzleSpeed, y: d.y * st.muzzleSpeed }, true);
    this.activeCount++;
    s.shots++;
    s.recoil = 1;
    this.fx.push({ type: 'muzzle', team: s.team });
    sfx.play('fire', s.team === 0 ? 1 : 0.55);
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
        const factor = Math.max(0.45, Math.min(1.25, speed / 15));
        const amount = m.damage * factor;
        s.health = Math.max(0, s.health - amount);
        s.flash = 0.12;
        const attacker = this.shooters[m.team];
        attacker.hits++;
        attacker.dealt += amount;
        this.hitstop = Math.max(this.hitstop, s.team === 0 ? 0.05 : 0.03);
        this.fx.push({ type: 'hit', x: p.x, y: p.y, team: s.team, amount });
        sfx.play(s.team === 0 ? 'hurt' : 'hit', factor);
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
    this.winner = p.health === e.health ? -1 : p.health > e.health ? 0 : 1;
    this.phase = 'ko';
    this.phaseTime = 0;
    for (const s of this.shooters) s.firing = false;
  }

  activeMarbles() {
    return this.activeCount;
  }
}
