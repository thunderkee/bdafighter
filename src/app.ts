import { AI_PROFILES, ARENA, BALANCE, MAG_OF, MARBLE_OF, MARBLES, MATCH, setArenaWidth, type ShooterStats } from './config';
import { traitMul } from './roster';
import { computeStats, STARTER_BUILD } from './parts';
import { CHARGE, Game, STEP, chargeLevel, slotTeam, type Shooter } from './game';
import { View } from './view';
import { DuoInput, Input, PadTracker } from './input';
import { AIController } from './ai';
import { Fx2D } from './fx2d';
import { BUILTINS, CHARACTERS, characterById, classic, playable, playableId } from './robot';
import { fillPortraits, portrait } from './portraits';
import { Preview } from './preview';
import { profileOf } from './profiles';
import { STAGES, stageById } from './stage';
import { ITEMS, SHIELD, SLOWMO, type ItemType } from './items';
import { Recorder, ReplayGame } from './replay';
import * as sfx from './audio';
import { SquadRun } from './squadrun';
import { buzz as haptic } from './haptics';
import * as music from './music';
import * as store from './storage';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const params = new URLSearchParams(location.search);
/** CPU intelligence for each side comes from settings (?ai= still overrides the opponents for testing) */
const aiOverride = params.get('ai');
const brain = (level: string | undefined) => AI_PROFILES[level ?? 'normal'] ?? AI_PROFILES.normal;
const debug = params.has('debug');

type Screen = 'title' | 'playing' | 'result';

/** settings level 1..5 -> multiplier, 3 = 1x */
const LEVEL = [0.55, 0.8, 1, 1.25, 1.55];
const level = (n: number) => LEVEL[Math.max(1, Math.min(5, Math.round(n))) - 1];
/** opponent health levels */
const HEALTH = [0.5, 0.75, 1, 1.5, 2];
/** agility: dodge chance and reaction speed multiplier */
const AGILITY = [0.3, 0.65, 1, 1.35, 1.7];

/** a haptic tap or pattern: Android vibrates, iPhone (iOS 18+) clicks its haptic engine */
const buzz = (pattern: number | number[]) => {
  // browsers block haptics until the page has had a real tap
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  haptic(pattern);
};

const hexc = (n: number) => '#' + n.toString(16).padStart(6, '0');
const VIEW_LABEL = { near: 'NEAR', mid: 'MID', far: 'FAR', first: 'COCKPIT' } as const;

/** small line icons for the items, drawn in currentColor */
const ITEM_ICONS: Record<ItemType, string> = {
  multi: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="4" r="2.4"/><circle cx="5.5" cy="7" r="2.4"/><circle cx="18.5" cy="7" r="2.4"/><circle cx="3" cy="13" r="2.4"/><circle cx="21" cy="13" r="2.4"/><circle cx="12" cy="11" r="2.4"/><path d="M9 18h6l-3 4z"/></svg>',
  slowmo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>',
  wiper: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="5" width="9" height="5" rx="1"/><rect x="13" y="5" width="9" height="5" rx="1"/><rect x="7" y="12" width="10" height="5" rx="1"/><rect x="2" y="12" width="3" height="5" rx="1"/><rect x="19" y="12" width="3" height="5" rx="1"/></svg>',
  heal: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></svg>',
  dragon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 22c-5-3 5-5 0-8s5-5 0-8"/><circle cx="12" cy="3" r="2" fill="currentColor"/></svg>',
  missile: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"/><path d="M3.5 13.5c5 2 12 2 17 0" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="2"/><circle cx="9" cy="8.5" r="2.2" fill="#fff" fill-opacity=".7"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5"/><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/></svg>',
};

export function boot() {
  let saveData = store.load();
  {
    // the 2.1 set is the roster now: old 1.0 / 2.0 picks move to their 2.1s
    const st = saveData.settings;
    const character = playableId(st.character);
    const enemyCharacter = st.enemyCharacter && st.enemyCharacter !== 'auto' ? playableId(st.enemyCharacter) : st.enemyCharacter;
    if (character !== st.character || enemyCharacter !== st.enemyCharacter) saveData = store.save({ settings: { ...st, character, enemyCharacter } });
  }
  /** an arcade run: the stage number, how many were cleared, and this stage's match setup */
  let arcade: { stage: number; cleared: number; cfg: Partial<store.Settings>; next?: Partial<store.Settings>; done?: boolean; plan: Partial<store.Settings>[] } | null = null;
  /** after an arcade game over: choosing another fighter to retry the stage with */
  let arcadeSwap = false;
  /** the units the current arcade stage puts against you (they can't be your swap) */
  const arcadeFoes = () => {
    if (!arcade) return new Set<string>();
    const b = bossOf(arcade.stage);
    return new Set((b ? b.units : [arcade.cfg.enemyCharacter ?? '']).filter(Boolean).map((id) => baseOf(id)));
  };
  /**
   * The arcade ladder: you fight alone, one on one. Two stages, then a boss, four times over;
   * beating the last boss clears the run. Each boss sets its own armour (per unit), punch,
   * size and skill; a boss with company is lighter per unit so the group stays beatable.
   */
  const BOSS_EVERY = 3;
  const BOSSES: { title: string; units: string[]; health: number; damage: number; size: number; iq: 'normal' | 'hard' | 'ace'; lv: number; fan?: number; time: number }[] = [
    { title: 'BASTION', units: ['bastion-22'], health: 1.75, damage: 0.85, size: 1.45, iq: 'hard', lv: 3, time: 90 },
    { title: 'VIOLET TRIO', units: ['violet-22', 'violet-22', 'violet-22'], health: 0.8, damage: 0.48, size: 1.12, iq: 'hard', lv: 3, time: 90 },
    { title: 'DINO KINGS', units: ['rex-22', 'tyrant-22'], health: 1.05, damage: 0.56, size: 1.3, iq: 'hard', lv: 4, time: 90 },
    // the last boss: triple armour and three-way spread fire, fought to the finish (no clock)
    { title: 'NIGHTSHADE', units: ['nightshade-22'], health: 3, damage: 0.4, size: 1.6, iq: 'ace', lv: 4, fan: 3, time: 0 },
  ];
  const FINAL_STAGE = BOSSES.length * BOSS_EVERY;
  /**
   * Unlocks: six starters, and the rest are earned in the arcade. Clearing each stage listed
   * here unlocks those units (by base id, whatever their version); a boss is won by beating it.
   */
  const UNLOCKS: [number, string[]][] = [
    [2, ['monoceros']],
    [3, ['bastion']],
    [5, ['liger']],
    [6, ['violet']],
    [8, ['ember']],
    [9, ['rex', 'tyrant']],
    [12, ['nightshade']],
  ];
  const baseOf = (id: string) => characterById(id).id.replace(/-\d+$/, '');
  /** a boss unit, in whichever version (it can't be picked for an arcade run) */
  const isBossUnit = (id: string) => [...BOSS_IDS].some((b) => baseOf(b) === baseOf(id));
  /** the arcade stage that unlocks this unit (0 = a starter, or a custom unit) */
  const unlockStage = (id: string) => (BUILTINS.some((b) => b.id === characterById(id).id) ? (UNLOCKS.find(([, ids]) => ids.includes(baseOf(id)))?.[0] ?? 0) : 0);
  const isLocked = (id: string) => !saveData.unlockAll && unlockStage(id) > (saveData.arcadeBest ?? 0);
  /** the units a clear of this stage unlocks */
  const unlocksAt = (stage: number) => playable().filter((c) => unlockStage(c.id) === stage);
  /** the bosses never turn up as ordinary opponents, and can't be picked in arcade */
  const BOSS_IDS = new Set(BOSSES.flatMap((b) => b.units));
  const bossAt = (stage: number) => stage % BOSS_EVERY === 0;
  const bossOf = (stage: number) => (bossAt(stage) ? BOSSES[Math.min(BOSSES.length, stage / BOSS_EVERY) - 1] : null);
  const boss = () => (arcade ? bossOf(arcade.stage) : null);
  const isBoss = () => !!boss();
  /** the settings a match plays by: yours, with the arcade stage's layered on top */
  /** local two-player versus on one device: player 2 takes the opponent's robot */
  let duo = false;
  /** the settings a match plays by: yours, with an arcade stage's (or local versus') rules on top */
  const S = (): store.Settings =>
    arcade ? { ...saveData.settings, ...arcade.cfg } : duo ? { ...saveData.settings, pack: 1, playerPack: 1, items: false } : saveData.settings;
  // the table width is fixed for the session: walls and scenery are built for it
  setArenaWidth(S().arenaWidth);
  /** the table width the walls and scenery are built for right now */
  let tableWidth = S().arenaWidth ?? 'normal';
  /** magazine size is a match rule, the same for both robots */
  const magazine = () => Math.max(3, Math.min(10, Math.round(S().magazine || 10)));
  /** a unit's traits scale its speed, cadence and shield recharge (health is separate) */
  /** a fighter's marble type and, when magazines are per fighter, its magazine */
  const marbleOf = (id: string) => {
    const c = characterById(id);
    const key = (c.base ?? c.id).replace(/-\d+$/, '');
    const type = MARBLE_OF[key] ?? 'standard';
    return { type, key, ...MARBLES[type], mag: MAG_OF[key] ?? MARBLES[type].mag };
  };
  const withTraits = <S extends ShooterStats>(stats: S, id: string): S => {
    const t = characterById(id).traits;
    const mb = marbleOf(id);
    return {
      ...stats,
      marbleRadius: stats.marbleRadius * mb.radius,
      marbleMass: stats.marbleMass * mb.mass,
      muzzleSpeed: stats.muzzleSpeed * mb.speed,
      damage: stats.damage * mb.damage * (BALANCE[mb.key] ?? 1),
      bounce: mb.bounce,
      capacity: S().magPer === false ? stats.capacity : mb.mag,
      reloadTime: stats.reloadTime * mb.reload,
      moveSpeed: stats.moveSpeed * traitMul(t?.speed),
      fireInterval: (stats.fireInterval * mb.fire) / traitMul(t?.fireRate, 'fireRate'),
      agility: traitMul(t?.agility, 'agility'),
      twin: characterById(id).twin,
      special: characterById(id).special,
    };
  };
  const healthTrait = (id: string) => traitMul(characterById(id).traits?.health, 'health');
  const playerStats = () => {
    const base = computeStats(STARTER_BUILD);
    // a bigger pack hits softer each, like the opponent's
    const sc = PACK_SCALE[allySize() - 1];
    return withTraits({ ...base, capacity: magazine(), damage: base.damage * sc.damage }, S().character);
  };
  const enemyStats = () => {
    const st = S();
    const base = computeStats(STARTER_BUILD, brain(aiOverride ?? st.enemyIQ).stats);
    const power = level(st.enemyPower);
    return {
      ...base,
      capacity: magazine(),
      moveSpeed: base.moveSpeed * level(st.enemySpeed),
      damage: base.damage * power,
      marbleMass: base.marbleMass * power,
      // power also adds a little muzzle speed, kept modest so aim still matters
      muzzleSpeed: base.muzzleSpeed * (0.85 + 0.15 * power),
    };
  };
  const enemyMaxHealth = () => MATCH.maxHealth * (boss()?.health ?? HEALTH[Math.max(1, Math.min(5, S().enemyHealth)) - 1]);
  const packSize = () => Math.max(1, Math.min(3, Math.round(S().pack || 1)));
  /** bigger packs get less armour and punch each, so two or three stay beatable */
  const PACK_SCALE = [
    { health: 1, damage: 1 },
    { health: 0.6, damage: 0.5 },
    { health: 0.4, damage: 0.38 },
  ];
  const allySize = () => Math.max(1, Math.min(3, Math.round(S().playerPack || 1)));
  /** your CPU pack-mates: standard stats with the same pack scaling as the other side */
  const packAllies = () => {
    const sc = PACK_SCALE[allySize() - 1];
    const ids = unitIds();
    const base = { ...computeStats(STARTER_BUILD), capacity: magazine() };
    return Array.from({ length: allySize() - 1 }, (_, k) => ({
      stats: withTraits({ ...base, damage: base.damage * sc.damage }, ids[4 + k]),
      maxHealth: MATCH.maxHealth * sc.health * healthTrait(ids[4 + k]),
    }));
  };
  const packEnemies = () => {
    // player 2 fights on the same footing as player 1: standard stats and the unit's own traits
    if (duo) {
      const id = unitIds()[1];
      return [{ stats: withTraits({ ...computeStats(STARTER_BUILD), capacity: magazine() }, id), maxHealth: MATCH.maxHealth * healthTrait(id) }];
    }
    // a boss sets its own armour and punch per unit (no pack scaling on top)
    const b = boss();
    const sc = b ? { health: 1, damage: b.damage } : PACK_SCALE[packSize() - 1];
    const base = enemyStats();
    const ids = unitIds();
    return Array.from({ length: packSize() }, (_, k) => ({
      stats: withTraits({ ...base, damage: base.damage * sc.damage, fan: b?.fan }, ids[k + 1]),
      // (a boss's armour is its own: the unit's armour trait doesn't apply)
      maxHealth: enemyMaxHealth() * sc.health * (b ? 1 : healthTrait(ids[k + 1])),
    }));
  };
  /** pack members after the first get random units (fixed for the match) */
  let packIds: string[] = [];
  /** your pack-mates' units */
  let allyIds: string[] = [];
  /** opponent robot: the chosen one, or on auto the dragon unless the player picked it */
  const enemyCharacter = () => {
    const st = S();
    if (st.enemyCharacter && st.enemyCharacter !== 'auto') return st.enemyCharacter;
    return st.character === 'dragon-22' ? 'angel-22' : 'dragon-22';
  };

  // ---------- arcade: a ladder of matches, each with its own opponent, rules and arena ----------
  const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
  /** the difficulty climbs one step per stage: intelligence and the opponent's stat level */
  const TIERS = [
    { name: 'VERY EASY', iq: 'easy', lv: 1 },
    { name: 'EASY', iq: 'easy', lv: 2 },
    { name: 'MEDIUM', iq: 'normal', lv: 2 },
    { name: 'MEDIUM', iq: 'normal', lv: 3 },
    { name: 'HARD', iq: 'hard', lv: 3 },
    { name: 'HARD', iq: 'hard', lv: 4 },
    { name: 'VERY HARD', iq: 'hard', lv: 4 },
    { name: 'EXPERT', iq: 'ace', lv: 4 },
  ] as const;
  /** each ordinary stage is one step up from the last (bosses sit between them) */
  const tierAt = (stage: number) => TIERS[Math.min(TIERS.length - 1, Math.max(0, stage - 1 - Math.floor(stage / BOSS_EVERY)))];
  const stageLabel = (stage: number) => (bossAt(stage) ? (stage >= FINAL_STAGE ? 'FINAL BOSS' : `BOSS ${stage / BOSS_EVERY}`) : tierAt(stage).name);
  /** stage `stage`: a one-on-one at that stage's difficulty (or the boss), in a fresh arena */
  const rollStage = (stage: number, prev?: Partial<store.Settings>): Partial<store.Settings> => {
    const me = saveData.settings.character;
    const arenas = STAGES.map((st) => st.id).filter((id) => id !== prev?.stage);
    const b = bossOf(stage);
    if (b) {
      return {
        enemyCharacter: b.units[0],
        enemyIQ: b.iq,
        enemyHealth: 3,
        enemySpeed: b.lv,
        enemyAgility: b.lv,
        enemyPower: b.lv,
        enemyAim: 'flexible',
        enemyTactic: 'hunt',
        cpuCharge: true,
        pack: b.units.length,
        playerPack: 1,
        roundTime: b.time,
        stage: pick(arenas),
        arenaWidth: b.units.length > 1 || b.size > 1.5 ? 'large' : 'normal',
        pucks: 0,
        pins: 0,
        covers: 0,
        items: true,
        gates: false,
        magazine: 10,
        burst: 1,
      };
    }
    const tier = tierAt(stage);
    const units = playable().map((c) => c.id).filter((id) => id !== me && id !== prev?.enemyCharacter && !BOSS_IDS.has(id));
    return {
      enemyCharacter: pick(units.length ? units : playable().map((c) => c.id).filter((id) => !BOSS_IDS.has(id))),
      enemyIQ: tier.iq,
      enemyHealth: tier.lv,
      enemySpeed: tier.lv,
      enemyAgility: tier.lv,
      enemyPower: tier.lv,
      enemyAim: Math.random() < 0.15 ? 'straight' : 'flexible',
      enemyTactic: 'hunt',
      cpuCharge: Math.random() < 0.75,
      pack: 1,
      playerPack: 1,
      roundTime: 60,
      stage: pick(arenas.length ? arenas : STAGES.map((st) => st.id)),
      arenaWidth: pick(['small', 'normal', 'large'] as const),
      // a clean table: no pucks, pins, walls or gates, just you, them and the air drops
      pucks: 0,
      pins: 0,
      covers: 0,
      items: true,
      gates: false,
      magazine: 10,
      burst: 1,
    };
  };
  const WIDTH_NAME = { small: 'NARROW', normal: 'STANDARD', large: 'WIDE' } as const;
  /** one stage in a line: opponent, difficulty, arena */
  const describeStage = (c: Partial<store.Settings>, stage: number) => {
    const foe = characterById(c.enemyCharacter ?? 'dragon').name.toUpperCase() + ((c.pack ?? 1) > 1 ? ` +${(c.pack ?? 1) - 1}` : '');
    const rules = [WIDTH_NAME[c.arenaWidth ?? 'normal'] + ' TABLE', c.covers ? `${c.covers} COVER` : '', c.pins ? `${c.pins} PINS` : '', c.pucks ? `${c.pucks} PUCKS` : '', c.items ? 'AIR DROPS' : '', c.gates ? 'GATES' : '']
      .filter(Boolean)
      .join(' · ');
    return {
      foe,
      diff: stageLabel(stage),
      arena: stageById(c.stage ?? 'space').name.toUpperCase(),
      rules,
      you: (c.playerPack ?? 1) > 1 ? `YOU +${(c.playerPack ?? 1) - 1}` : 'SOLO',
    };
  };

  const game = new Game(playerStats(), enemyStats());
  const view = new View($('stage'), game);
  const player = game.player;
  /** one controller per CPU robot: opponents (slots 1-3) and your pack-mates (4-5) */
  const ais = game.shooters.slice(1).map((s) => new AIController(game, s, AI_PROFILES.normal));
  /** the opponent the HUD shows: the one the player is facing */
  const focus = () => game.targetFor(player);
  const unitIds = () => {
    const ids = [S().character, enemyCharacter()];
    for (let i = 2; i <= 3; i++) ids.push(packIds[i - 2] ?? enemyCharacter());
    for (let i = 0; i < 2; i++) ids.push(allyIds[i] ?? S().character);
    return ids;
  };
  const input = new Input($('touch'), player, (x, y) => view.screenToWorld(x, y));
  const duoInput = new DuoInput($('touch'), [player, game.shooters[1]], (x, y) => view.screenToWorld(x, y));
  /** turn the controls on or off: yours, or both players' in local versus */
  const controls = (on: boolean) => {
    input.enabled = on && !duo;
    duoInput.enabled = on && duo;
    if (!on) duoInput.release();
  };

  // ThorVG effects overlay + portraits load in the background; the game never waits
  const fx2d = new Fx2D($<HTMLCanvasElement>('fx'));
  void fx2d.init().then(() => {
    if (fx2d.ready) view.fx2d = fx2d;
  });
  /** the health bar's head shot: the unit's 3/4 portrait, cropped to the head; it jolts when hit */
  class HudFace {
    private img: HTMLImageElement;
    private id = '';
    constructor(canvas: HTMLCanvasElement, id: string) {
      this.img = new Image();
      this.img.className = 'hud-face';
      this.img.alt = '';
      canvas.replaceWith(this.img);
      this.setCharacter(id);
    }
    init() {}
    setCharacter(id: string) {
      if (id === this.id) return;
      this.id = id;
      try {
        this.img.src = portrait(id);
      } catch {
        // no WebGL: leave the frame empty
      }
    }
    update(_dt: number, s: Shooter) {
      this.img.classList.toggle('hit', s.flash > 0);
      this.img.classList.toggle('down', !s.alive);
    }
  }
  const faces = [new HudFace($<HTMLCanvasElement>('face-player'), S().character), new HudFace($<HTMLCanvasElement>('face-enemy'), enemyCharacter())];
  let facesStarted = false;

  sfx.setMuted(saveData.muted);
  let screen: Screen = 'title';
  let paused = false;
  let acc = 0;
  let sessionMatches = 0;
  let sessionWins = 0;

  // ---------- HUD refs ----------
  const hud = $('hud');
  const banner = $('banner');
  const clock = $('clock');
  const hpFill = [document.querySelector<HTMLElement>('.hp.player .fill')!, document.querySelector<HTMLElement>('.hp.enemy .fill')!];
  const hpChip = [document.querySelector<HTMLElement>('.hp.player .chip')!, document.querySelector<HTMLElement>('.hp.enemy .chip')!];
  const hpBox = [document.querySelector<HTMLElement>('.hp.player')!, document.querySelector<HTMLElement>('.hp.enemy')!];
  const hpNum = [$('player-hp-num'), $('enemy-hp-num')];
  const duoHp = [document.querySelector<HTMLElement>('#duo-hp .p1 b')!, document.querySelector<HTMLElement>('#duo-hp .p2 b')!];
  const spFill = [document.querySelector<HTMLElement>('.sp.player .fill')!, document.querySelector<HTMLElement>('.sp.enemy .fill')!];
  const spBox = [document.querySelector<HTMLElement>('.sp.player')!, document.querySelector<HTMLElement>('.sp.enemy')!];
  const chip = [1, 1];
  const chipDelay = [0, 0];
  const pips = $('mag-tube');
  const reloadBar = $('reload');
  const vignette = $('vignette');
  const hints = $('hints');
  const toast = $('toast');
  const itemBtn = $('item-btn');
  const effects = $('effects');
  const superPips = [[...document.querySelectorAll<HTMLElement>('#player-super i')], [...document.querySelectorAll<HTMLElement>('#enemy-super i')]];
  const superRows = [$('player-super'), $('enemy-super')];

  /** one marble per magazine slot, tinted with the player's ball colour */
  const buildPips = () => {
    pips.innerHTML = '';
    for (let i = 0; i < player.stats.capacity; i++) pips.appendChild(document.createElement('i'));
    $('magazine').style.setProperty('--ball', hexc(characterById(S().character).ball));
  };

  const setTouchClass = () => document.body.classList.toggle('touch', input.mode === 'touch');
  setTouchClass();

  // ---------- hit feedback: damage numbers, the combo counter, callouts ----------
  const dmgLayer = $('dmg-layer');
  const comboEl = $('combo');
  const calloutEl = $('callout');
  /** a number that pops up where a hit landed: gold for damage you deal, red for damage you take */
  const damageNumber = (x: number, y: number, amount: number, yours: boolean, big: boolean) => {
    const sp = view.project(x, y, 1.0);
    const el = document.createElement('b');
    el.className = 'dmg' + (yours ? ' taken' : '') + (big ? ' big' : '');
    el.textContent = String(Math.max(1, Math.round(amount)));
    el.style.left = sp.x + 'px';
    el.style.top = sp.y + 'px';
    el.style.setProperty('--dx', (Math.random() * 40 - 20).toFixed(0) + 'px');
    dmgLayer.appendChild(el);
    setTimeout(() => el.remove(), 900);
  };
  /** a short callout under the clock (FIRST HIT, COMBO, LAST STAND, PARRY...) */
  const callout = (text: string, tone: 'gold' | 'red' | 'cyan' = 'gold') => {
    calloutEl.textContent = text;
    calloutEl.className = tone;
    void calloutEl.offsetWidth;
    calloutEl.classList.add('pop');
  };
  /** this round: hits in the current string, when the last one landed, the first hit, the lows */
  const roundFeel = { combo: 0, lastHit: -9, firstHit: false, lastStand: false, low: [1, 1] };
  const resetFeel = () => {
    Object.assign(roundFeel, { combo: 0, lastHit: -9, firstHit: false, lastStand: false, low: [1, 1] });
    comboEl.classList.remove('on');
  };
  const COMBO_GAP = 1.6;
  const showBanner = (text: string, big = false, sub?: string) => {
    banner.innerHTML = sub ? `${text}<span class="sub">${sub}</span>` : text;
    banner.classList.toggle('big', big);
    banner.classList.remove('pop');
    void banner.offsetWidth; // restart the animation
    banner.classList.add('pop');
  };

  const showToast = (text: string, color: number) => {
    toast.textContent = text;
    toast.style.setProperty('--item', hexc(color));
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
  };

  const updateRecord = () => {
    const arcadeBest = saveData.arcadeBest ? ` · ARCADE BEST STAGE ${saveData.arcadeBest}` : '';
    $('record').textContent = saveData.matches ? `RECORD ${saveData.wins} W / ${saveData.matches - saveData.wins} L${arcadeBest}` : '';
  };
  updateRecord();

  const startFaces = () => {
    if (facesStarted) return;
    facesStarted = true;
    faces.forEach((f) => f.init());
  };

  // ---------- match flow: intro -> rounds (best of 3) -> replays -> finale ----------
  type Flow = 'intro' | 'round' | 'replay' | 'finale';
  let flow: Flow = 'round';
  let flowT = 0;
  let roundNo = 1;
  const roundWins = [0, 0];
  const totals = { dealt: 0, shots: 0, hits: 0 };
  let finalRound = false;
  let replayGame: ReplayGame | null = null;
  let matchWinner: -1 | 0 | 1 = -1;
  const recorder = new Recorder();
  const introEl = $('intro');
  const replayEl = $('replay');
  const introStep = [false, false, false];

  const showRounds = () => {
    for (const [i, id] of [
      [0, 'player-rounds'],
      [1, 'enemy-rounds'],
    ] as const) {
      $(id)
        .querySelectorAll('i')
        .forEach((pip, k) => pip.classList.toggle('won', k < roundWins[i]));
    }
  };

  /** fresh table for the next round: health, ammo, marbles, items, gates */
  const setupRound = () => {
    resetFeel();
    const st = S();
    view.resetMatch();
    game.reset(playerStats(), {
      enemies: packEnemies(),
      allies: packAllies(),
      tactics: [st.allyTactic ?? 'nearest', st.enemyTactic ?? 'nearest'],
      playerHealth: MATCH.maxHealth * healthTrait(st.character) * PACK_SCALE[allySize() - 1].health,
      pucks: st.pucks,
      covers: st.covers,
      pins: st.pins,
      items: st.items,
      gates: st.gates,
      duration: st.roundTime ?? 60,
      burst: st.burst ?? 1,
      cpuCharge: st.cpuCharge ?? true,
      allyCharge: st.allyCharge ?? true,
      boss: boss() ? { slots: boss()!.units.map((_, k) => 1 + k), size: boss()!.size } : undefined,
    });
    for (const a of ais) a.reset();
    recorder.clear();
    input.release();
    chip[0] = chip[1] = 1;
    acc = 0;
    lastCount = -1;
  };

  const startRound = () => {
    flow = 'round';
    flowT = 0;
    hud.classList.remove('hidden');
    controls(true);
    finalRound = roundWins[0] === 1 && roundWins[1] === 1;
    showRounds();
    lastCount = -1;
  };

  /** build the table for these settings: new walls and scenery when the width changes */
  const fitTable = (st: store.Settings) => {
    const want = st.arenaWidth ?? 'normal';
    let rebuilt = false;
    if (want !== tableWidth) {
      tableWidth = want;
      setArenaWidth(want);
      game.resizeArena();
      rebuilt = true;
    }
    view.setStage(st.stage, rebuilt);
  };

  const startMatch = () => {
    sfx.unlock();
    const st = S();
    // local versus: the table from above for both players, their own labels and controls
    document.body.classList.toggle('duo', duo);
    const cam = duo ? 'split' : st.camera;
    if (view.cameraMode !== cam) {
      view.cameraMode = cam;
      view.resize();
    }
    $('enemy-tag').textContent = duo ? 'P2' : 'CPU';
    // the Opponent settings tune the other side; your pack-mates play at standard skill
    ais.forEach((a, i) => {
      const foe = slotTeam(i + 1) === 1;
      a.profile = brain(foe ? (aiOverride ?? st.enemyIQ) : st.allyIQ);
      a.straight = foe && st.enemyAim === 'straight';
      a.speedMul = foe ? level(st.enemySpeed) : 1;
      a.agility = foe ? AGILITY[Math.max(1, Math.min(5, st.enemyAgility)) - 1] : 1;
      // the boss charges big shots far more often
      a.chargeEager = foe && isBoss() ? 0.45 : 1;
    });
    // extra pack members on both sides: random units, all different where the roster allows
    const pool = playable().map((c) => c.id).filter((id) => id !== st.character && id !== enemyCharacter());
    const draw = (fallback: string) => pool.splice(Math.floor(Math.random() * pool.length), 1)[0] ?? fallback;
    // a boss group brings its own units
    packIds = boss() ? boss()!.units.slice(1) : [0, 1].map(() => draw(enemyCharacter()));
    allyIds = [0, 1].map(() => draw(st.character));
    // each CPU unit's agility trait sharpens (or dulls) its dodging on top of the setting
    const ids = unitIds();
    ais.forEach((a, i) => (a.agility *= traitMul(characterById(ids[i + 1]).traits?.agility, 'agility')));
    view.setCharacters(unitIds());
    fitTable(st);
    roundNo = 1;
    roundWins[0] = roundWins[1] = 0;
    totals.dealt = totals.shots = totals.hits = 0;
    matchWinner = -1;
    setupRound();
    buildPips();
    const pName = characterById(st.character).name.toUpperCase() + (allySize() > 1 ? ` +${allySize() - 1}` : '');
    const eName = characterById(enemyCharacter()).name.toUpperCase() + (packSize() > 1 ? ` +${packSize() - 1}` : '');
    $('player-name').textContent = pName;
    $('enemy-name').textContent = eName;
    $('intro-p1').textContent = pName;
    $('intro-p2').textContent = eName;
    $('intro-p1-sub').textContent =
      allySize() > 1
        ? `PACK OF ${allySize()} // ${unitIds().slice(4, 3 + allySize()).map((id) => characterById(id).name.toUpperCase()).join(' + ')}`
        : `${stageById(st.stage).name.toUpperCase()} // BEST OF 3`;
    $('intro-p2-sub').textContent = packSize() > 1 ? `PACK OF ${packSize()} // ${unitIds().slice(2, 1 + packSize()).map((id) => characterById(id).name.toUpperCase()).join(' + ')}` : duo ? 'PLAYER 2 // TOP END' : `CPU // ${brain(aiOverride ?? st.enemyIQ).name.toUpperCase()}`;
    // a boss stage: a red warning card for the challenger
    introEl.classList.toggle('boss', isBoss());
    if (isBoss()) sfx.play('gong');
    introEl.querySelector('.p2 .ic-tag')!.textContent = isBoss() ? '⚠ BOSS' : 'CHALLENGER';
    if (isBoss()) {
      $('intro-p2').textContent = boss()!.title;
      $('enemy-name').textContent = boss()!.title;
    }
    if (arcade) {
      $('intro-p1-sub').textContent = `ARCADE STAGE ${arcade.stage} // ${$('intro-p1-sub').textContent}`;
      $('intro-p2-sub').textContent = packSize() > 1 ? `${stageLabel(arcade.stage)} // ${$('intro-p2-sub').textContent}` : `CPU // ${stageLabel(arcade.stage)}`;
    }
    faces[0].setCharacter(st.character);
    faces[1].setCharacter(enemyCharacter());
    for (const id of ['title', 'select', 'setup', 'result', 'paused', 'settings']) $(id).classList.add('hidden');
    preview.release();
    startFaces();
    hints.classList.toggle('hidden', sessionMatches >= 2);
    hints.classList.remove('fade');
    setTouchClass();
    screen = 'playing';
    paused = false;
    showRounds();
    // VS intro
    flow = 'intro';
    flowT = 0;
    introStep.fill(false);
    hud.classList.add('hidden');
    introEl.classList.remove('hidden');
    introEl.querySelectorAll('.in').forEach((el) => el.classList.remove('in'));
    controls(false);
    view.cine = { kind: 'intro', t: 0, shot: -1, slot: 0 };
  };

  const endIntro = () => {
    if (flow !== 'intro') return;
    introEl.classList.add('hidden');
    view.cine = null;
    startRound();
  };
  introEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    endIntro();
  });

  /** the round is over (KO slow-mo finished): score it and roll the replay */
  const onRoundOver = () => {
    const w = game.winner;
    if (S().vibrate) buzz(w === 0 ? [20, 40, 20, 40, 60] : w === 1 ? [120, 60, 120] : 40);
    if (w === 0 || w === 1) roundWins[w]++;
    else {
      // a drawn round counts for both, unless that would decide nothing forever
      roundWins[0] = Math.min(roundWins[0] + 1, 2);
      roundWins[1] = Math.min(roundWins[1] + 1, 2);
    }
    totals.dealt += player.dealt;
    totals.shots += player.shots;
    totals.hits += player.hits;
    showRounds();
    let over = roundWins[0] >= 2 || roundWins[1] >= 2;
    if (roundWins[0] >= 2 && roundWins[1] >= 2) {
      // both on two: play a deciding round (cap at 5 rounds)
      if (roundNo >= 5) matchWinner = -1;
      else {
        roundWins[0] = roundWins[1] = 1;
        over = false;
      }
    } else if (over) matchWinner = roundWins[0] >= 2 ? 0 : 1;
    startReplay(over, view.loserSlot());
  };

  const startReplay = (final: boolean, loser: number) => {
    comboEl.classList.remove('on');
    controls(false);
    input.release();
    if (!recorder.frames.length) return endReplay(final, loser);
    flow = 'replay';
    flowT = 0;
    finalRound = final;
    replayGame = new ReplayGame(recorder, game);
    view.resetMatch();
    view.game = replayGame as unknown as Game;
    view.cine = { kind: 'replay', t: 0, shot: -1, slot: loser, by: replayGame.by };
    replayEl.classList.remove('hidden');
    hud.classList.add('hidden');
    sfx.play('whoosh');
    replayLoser = loser;
  };
  let replayLoser = 1;

  const endReplay = (final = finalRound, loser = replayLoser) => {
    replayEl.classList.add('hidden');
    view.game = game;
    view.cine = null;
    replayGame = null;
    if (final) {
      flow = 'finale';
      flowT = 0;
      if (matchWinner === 0 || matchWinner === 1) view.explode(loser);
      return;
    }
    roundNo++;
    setupRound();
    startRound();
  };
  replayEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (flow === 'replay') endReplay();
  });

  const endMatch = () => {
    screen = 'result';
    controls(false);
    input.release();
    view.cine = null;
    const w = matchWinner;
    sessionMatches++;
    if (w === 0) sessionWins++;
    saveData = store.save({ matches: saveData.matches + 1, wins: saveData.wins + (w === 0 ? 1 : 0) });
    const title = $('result-title');
    title.textContent = duo ? (w === -1 ? 'DRAW' : `PLAYER ${w + 1} WINS`) : w === 0 ? 'VICTORY' : w === 1 ? 'DEFEAT' : 'DRAW';
    title.className = 'result-title ' + (w === 0 ? 'win' : w === 1 ? 'lose' : '');
    $('result-sub').textContent = `ROUNDS ${roundWins[0]} – ${roundWins[1]} // ${w === 0 ? 'MISSION COMPLETE' : w === 1 ? 'UNIT DOWN' : 'STALEMATE'}`;
    $('r-dealt').textContent = Math.round(totals.dealt).toString();
    $('r-acc').textContent = totals.shots ? Math.round((totals.hits / totals.shots) * 100) + '%' : '–';
    $('r-hp').textContent = Math.ceil(player.hpFrac * 100) + '%';
    $('session').textContent = `SESSION ${sessionWins} / ${sessionMatches} WON`;
    showArcadeResult(w);
    $('result').classList.remove('hidden');
    hud.classList.add('hidden');
    sfx.play(w === 0 ? 'win' : 'lose');
    updateRecord();
  };

  /** the result screen in arcade: stage clear (and a look at the next one), or game over */
  const showArcadeResult = (w: -1 | 0 | 1) => {
    const panel = $('arcade-next');
    panel.classList.toggle('hidden', !arcade);
    // a game over (or a draw) can be retried with a different fighter
    $('arcade-swap').classList.toggle('hidden', !arcade || w === 0);
    if (!arcade) {
      $('again-btn').textContent = 'REMATCH';
      return;
    }
    const best = saveData.arcadeBest ?? 0;
    const title = $('result-title');
    let head = '';
    let stageCfg = arcade.cfg;
    // a first clear of an unlock stage brings in new fighters
    const fresh = w === 0 && arcade.stage > best ? unlocksAt(arcade.stage) : [];
    if (fresh.length) setTimeout(() => showToast(`NEW FIGHTER // ${fresh.map((c) => c.name.toUpperCase()).join(' + ')}`, 0xffc23d), 600);
    if (w === 0 && arcade.stage >= FINAL_STAGE) {
      // the last boss is down: the run is cleared
      arcade.cleared = arcade.stage;
      if (arcade.cleared > best) saveData = store.save({ arcadeBest: arcade.cleared });
      title.textContent = 'ARCADE CLEAR';
      $('result-sub').textContent = `ARCADE // ALL ${FINAL_STAGE} STAGES CLEARED`;
      arcade.next = undefined;
      arcade.done = true;
      $('again-btn').textContent = 'NEW RUN ▶';
      panel.classList.remove('boss');
      panel.innerHTML = `<b>CHAMPION</b><div><span>FINAL BOSS</span><em>${BOSSES[BOSSES.length - 1].title} DEFEATED</em></div>${fresh.length ? `<div><span>UNLOCKED</span><em>${fresh.map((c) => c.name.toUpperCase()).join(' + ')}</em></div>` : ''}`;
      return;
    }
    if (w === 0) {
      arcade.cleared = arcade.stage;
      const record = arcade.cleared > best;
      if (record) saveData = store.save({ arcadeBest: arcade.cleared });
      title.textContent = bossAt(arcade.stage) ? 'BOSS DEFEATED' : `STAGE ${arcade.stage} CLEAR`;
      $('result-sub').textContent = `ARCADE // ${arcade.cleared} CLEARED${record ? ' · NEW BEST' : ''}`;
      arcade.next = arcade.plan[arcade.stage] ?? rollStage(arcade.stage + 1, arcade.cfg);
      stageCfg = arcade.next;
      head = bossAt(arcade.stage + 1) ? `⚠ BOSS AHEAD // STAGE ${arcade.stage + 1}` : `NEXT // STAGE ${arcade.stage + 1}`;
      $('again-btn').textContent = 'NEXT STAGE ▶';
    } else {
      title.textContent = w === 1 ? 'GAME OVER' : 'DRAW';
      $('result-sub').textContent = `ARCADE // REACHED STAGE ${arcade.stage} · BEST ${Math.max(best, arcade.cleared)}`;
      arcade.next = undefined;
      head = `RETRY // STAGE ${arcade.stage}`;
      $('again-btn').textContent = 'RETRY STAGE';
    }
    const d = describeStage(stageCfg, w === 0 ? arcade.stage + 1 : arcade.stage);
    const nextBoss = bossOf(w === 0 ? arcade.stage + 1 : arcade.stage);
    panel.classList.toggle('boss', !!nextBoss);
    if (nextBoss) d.foe = nextBoss.title;
    panel.innerHTML = `<b>${head}</b><div><span>OPPONENT</span><em>${d.foe}</em></div><div><span>DIFFICULTY</span><em>${d.diff}</em></div><div><span>ARENA</span><em>${d.arena}</em></div><div><span>RULES</span><em>${d.rules}</em></div><div><span>YOUR SIDE</span><em>${d.you}</em></div>`;
  };

  /** the whole ladder, rolled at the start of a run (so the tower can show who's coming) */
  const rollPlan = () => {
    // (each opponent once where the roster allows, before any repeats)
    const plan: Partial<store.Settings>[] = [];
    const used = new Set<string>();
    for (let s = 1; s <= FINAL_STAGE; s++) {
      let c = rollStage(s, plan[s - 2]);
      for (let tries = 0; tries < 16 && !bossAt(s) && c.enemyCharacter && used.has(baseOf(c.enemyCharacter)); tries++) c = rollStage(s, plan[s - 2]);
      if (c.enemyCharacter && !bossAt(s)) used.add(baseOf(c.enemyCharacter));
      plan.push(c);
    }
    return plan;
  };
  /** after a fighter swap: any later stage that would put you against yourself is re-rolled */
  const refitPlan = () => {
    if (!arcade) return;
    const me = baseOf(saveData.settings.character);
    for (let s = arcade.stage + 1; s <= FINAL_STAGE; s++) {
      const c = arcade.plan[s - 1];
      if (!bossAt(s) && c.enemyCharacter && baseOf(c.enemyCharacter) === me) arcade.plan[s - 1] = rollStage(s, arcade.plan[s - 2]);
    }
  };
  /** start a new arcade run from stage 1 */
  const startArcade = () => {
    const plan = rollPlan();
    arcade = { stage: 1, cleared: 0, cfg: plan[0], plan };
    showTower(startMatch);
  };

  // ---------- the tower: who you've beaten, who's next, and who waits at the top ----------
  const towerEl = document.createElement('div');
  towerEl.id = 'tower';
  towerEl.className = 'hidden';
  $('app').appendChild(towerEl);
  let towerTimer = 0;
  let towerDone: (() => void) | null = null;
  const closeTower = () => {
    if (!towerDone) return;
    clearTimeout(towerTimer);
    towerEl.classList.add('hidden');
    const go = towerDone;
    towerDone = null;
    go();
  };
  towerEl.addEventListener('click', closeTower);
  /** show the tower for a moment (tap to skip), then carry on */
  const showTower = (then: () => void) => {
    if (!arcade) return then();
    const a = arcade;
    const rows: string[] = [];
    for (let s = FINAL_STAGE; s >= 1; s--) {
      const b = bossOf(s);
      const c = a.plan[s - 1] ?? {};
      const id = b ? b.units[0] : (c.enemyCharacter ?? '');
      const name = b ? b.title : characterById(id).name;
      const state = s < a.stage ? 'cleared' : s === a.stage ? 'current' : 'ahead';
      const crew = b && b.units.length > 1 ? `<small>×${b.units.length}</small>` : '';
      rows.push(
        `<li class="tw-stage ${state}${b ? ' boss' : ''}${s === FINAL_STAGE ? ' final' : ''}" data-stage="${s}"><em>${s}</em><i class="tw-face"><i data-portrait="${id}"></i></i><b>${name}${crew}</b>${b ? `<span>${s === FINAL_STAGE ? 'FINAL BOSS' : 'BOSS'}</span>` : ''}${state === 'cleared' ? '<u>✓</u>' : ''}</li>`,
      );
    }
    const me = characterById(saveData.settings.character);
    towerEl.innerHTML = `<header><span>ARCADE</span><h2>${a.stage === FINAL_STAGE ? 'Final battle' : `Stage ${a.stage}`}</h2></header><div class="tw-col"><ol>${rows.join('')}</ol><div class="tw-you"><i class="tw-face"><i data-portrait="${me.id}"></i></i><b>${me.name}</b></div></div><p>TAP TO CONTINUE</p>`;
    towerEl.classList.remove('hidden');
    fillPortraits(towerEl);
    // the marker starts at the stage below and climbs to this one; the column scrolls to it
    const col = towerEl.querySelector<HTMLElement>('.tw-col')!;
    const you = towerEl.querySelector<HTMLElement>('.tw-you')!;
    const at = (s: number) => towerEl.querySelector<HTMLElement>(`.tw-stage[data-stage="${Math.max(1, s)}"]`)!;
    const place = (s: number) => {
      const row = at(s);
      you.style.transform = `translateY(${row.offsetTop + row.offsetHeight / 2 - you.offsetHeight / 2}px)`;
    };
    you.style.transition = 'none';
    place(a.stage - 1 || 1);
    const cur = at(a.stage);
    col.scrollTop = Math.max(0, cur.offsetTop - col.clientHeight / 2 + cur.offsetHeight / 2);
    requestAnimationFrame(() => {
      you.style.transition = '';
      place(a.stage);
    });
    sfx.play(bossOf(a.stage) ? 'gong' : 'whoosh');
    towerDone = then;
    towerTimer = window.setTimeout(closeTower, 2800);
  };
  /** rematch, or in arcade the next stage (after a win) or the same stage again */
  const playAgain = () => {
    // after the final boss, a new run from stage 1
    if (arcade?.done) {
      startArcade();
      return;
    }
    if (arcade?.next) {
      arcade.stage++;
      arcade.cfg = arcade.next;
      arcade.next = undefined;
    }
    if (arcade) showTower(startMatch);
    else startMatch();
  };
  /** leave the arcade run: back to the title with your own table */
  const quitArcade = () => {
    arcade = null;
    screen = 'title';
    show('title');
    fitTable(S());
    applySettings();
  };

  /** Per-frame timeline for the intro, the replay and the finale. */
  const updateFlow = (dt: number) => {
    flowT += dt;
    if (flow === 'intro') {
      const cards = [introEl.querySelector('.p1')!, introEl.querySelector('.p2')!, introEl.querySelector('.intro-vs')!];
      const at = [0.15, 1.85, 3.5];
      at.forEach((t, k) => {
        if (!introStep[k] && flowT >= t) {
          introStep[k] = true;
          cards[k].classList.add('in');
          sfx.play(k === 2 ? 'slam' : 'whoosh');
          if (k === 2) view.shake(0.4);
        }
      });
      if (flowT > 4.8) endIntro();
    } else if (flow === 'replay' && replayGame) {
      replayGame.advance(dt);
      if (replayGame.done) endReplay();
    } else if (flow === 'finale') {
      if (flowT > 1.6 && lastCount !== -9) {
        lastCount = -9;
        showBanner(duo ? (matchWinner === -1 ? 'DRAW' : `PLAYER ${matchWinner + 1} WINS`) : matchWinner === 0 ? 'YOU WIN' : matchWinner === 1 ? 'YOU LOSE' : 'DRAW', true);
      }
      if (flowT > 4.6) endMatch();
    }
  };

  const setPaused = (p: boolean) => {
    if (screen !== 'playing' || paused === p) return;
    paused = p;
    $('paused').classList.toggle('hidden', !p);
    if (p) {
      input.release();
      pad.clear();
      sfx.suspend();
    } else {
      sfx.resume();
      last = performance.now();
    }
  };

  const useItem = () => {
    if (screen !== 'playing' || paused) return;
    game.useItem(player);
  };
  input.onUseItem = useItem;
  itemBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    sfx.unlock();
    useItem();
  });

  $('play-btn').addEventListener('click', () => openSelect('versus'));
  $('duo-btn').addEventListener('click', () => openSelect('duo'));
  // Squad Run: its own little game over the top, led by your fighter; the arena sleeps meanwhile
  let squadRun: SquadRun | null = null;
  $('squad-btn').addEventListener('click', () => {
    sfx.unlock();
    squadRun ??= new SquadRun($('app'), { unit: playableId(S().character), onExit: () => toTitle(), saver: () => !!S().batterySaver, vibrate: (p) => S().vibrate && buzz(p) });
    show('');
    squadRun.open(playableId(S().character));
    if (debug) (window as unknown as Record<string, unknown>).__squad = squadRun;
  });
  $('arcade-btn').addEventListener('click', () => openSelect('arcade'));
  $('again-btn').addEventListener('click', playAgain);
  $('arcade-quit').addEventListener('click', quitArcade);
  $('arcade-swap').addEventListener('click', () => {
    if (!arcade) return;
    sfx.unlock();
    arcadeSwap = true;
    selectMode = 'arcade';
    // (if the saved pick is the stage's opponent or a boss, start the grid on the first fighter that isn't)
    const foes = arcadeFoes();
    const ok = (id: string) => !isLocked(id) && !isBossUnit(id) && !foes.has(baseOf(id));
    if (!ok(saveData.settings.character)) {
      const first = playable().find((c) => ok(c.id));
      if (first) saveData = store.save({ settings: { ...saveData.settings, character: first.id } });
    }
    goStep('fighter');
  });
  $('pause-btn').addEventListener('click', () => setPaused(true));
  $('resume-btn').addEventListener('click', () => setPaused(false));
  // restart from round 1, straight into the fight (no intro this time)
  $('restart-btn').addEventListener('click', () => {
    paused = false;
    sfx.resume();
    pad.clear();
    replayEl.classList.add('hidden');
    replayGame = null;
    view.game = game;
    last = performance.now();
    startMatch();
    endIntro();
  });
  $('mute-btn').addEventListener('click', () => {
    sfx.unlock();
    saveData = store.save({ muted: !saveData.muted });
    sfx.setMuted(saveData.muted);
    $('mute-btn').textContent = saveData.muted ? 'OFF' : 'SND';
  });
  $('mute-btn').textContent = saveData.muted ? 'OFF' : 'SND';

  // ---------- settings ----------
  const padDir = document.querySelectorAll<HTMLElement>('.pad-dir .pad-btn');
  const applySettings = () => {
    const st = saveData.settings;
    input.settings = { ...st };
    // outside a match the table updates now; mid-match it waits for the next one
    if (screen !== 'playing') {
      game.puckCount = st.pucks;
      game.placePucks();
      view.setCharacters(unitIds());
      view.setStage(st.stage);
    }
    view.showAimLine = st.aimLine;
    view.fxOn = st.effects;
    view.setQuality(st.realism, !!st.batterySaver);
    $('fps').classList.toggle('hidden', !st.showFps);
    // (local versus keeps its overhead view for the whole match)
    const cam = duo && screen !== 'title' ? 'split' : st.camera;
    if (view.cameraMode !== cam) {
      view.cameraMode = cam;
      view.resize();
    }
    document.body.classList.toggle('triple', st.fireButtons === 'triple');
    $('view-btn').textContent = VIEW_LABEL[st.camera];
    $('title-unit').textContent = characterById(st.character).name.toUpperCase();
    $('title-stage').textContent = stageById(st.stage).name.toUpperCase();
    document.body.classList.toggle('buttons', st.layout === 'buttons');
    document.body.classList.toggle('hud-tags', st.hudMode === 'tags');
    document.body.classList.toggle('slider', st.layout === 'buttons' && st.moveControl === 'slider');
    $('pad').classList.toggle('hidden', st.layout !== 'buttons');
    // with the on-screen pad, the view switch and the special weapon join the
    // right-thumb group (view, item, shield, fire); otherwise they keep their own spots
    if (st.layout === 'buttons') {
      $('pad-top').append($('view-btn'));
      $('pad-actions').prepend($('item-btn'));
    }
    else {
      document.querySelector('.hud-btns')?.prepend($('view-btn'));
      $('effects').before($('item-btn'));
    }
    padDir[0].textContent = st.arrows === 'aim' ? '↶' : '◀';
    padDir[1].textContent = st.arrows === 'aim' ? '↷' : '▶';
    document.querySelectorAll<HTMLElement>('.seg').forEach((seg) => {
      const current = String(st[seg.dataset.setting as keyof store.Settings]);
      const levelSeg = seg.classList.contains('level');
      seg.querySelectorAll<HTMLElement>('button').forEach((b) => {
        b.classList.toggle('on', b.dataset.value === current);
        // level bars light up to the chosen value
        if (levelSeg) b.classList.toggle('lit', Number(b.dataset.value) <= Number(current));
      });
    });
  };
  const saveSetting = (patch: Partial<store.Settings>) => {
    // (a new table width is built when the next match starts)
    saveData = store.save({ settings: { ...saveData.settings, ...patch } });
    input.release();
    applySettings();
  };
  document.querySelectorAll<HTMLElement>('.seg button').forEach((b) =>
    b.addEventListener('click', () => {
      const key = (b.parentElement as HTMLElement).dataset.setting as keyof store.Settings;
      const raw = b.dataset.value!;
      const value = raw === 'true' ? true : raw === 'false' ? false : /^\d+$/.test(raw) ? Number(raw) : raw;
      saveSetting({ [key]: value } as Partial<store.Settings>);
    }),
  );
  $('reset-opponent').addEventListener('click', () => saveSetting(store.OPPONENT_DEFAULTS));
  // unlock all fighters (not a match setting: it lives on the save itself)
  const showUnlockAll = () =>
    document.querySelectorAll<HTMLElement>('#unlock-all button').forEach((b) => b.classList.toggle('on', b.dataset.value === String(!!saveData.unlockAll)));
  document.querySelectorAll<HTMLElement>('#unlock-all button').forEach((b) =>
    b.addEventListener('click', () => {
      saveData = store.save({ unlockAll: b.dataset.value === 'true' });
      showUnlockAll();
    }),
  );
  showUnlockAll();

  // ---------- select screens: fighter, rival, arena, then the match rules (like a fighting game) ----------
  const preview = new Preview($('preview'));
  type Step = 'fighter' | 'rival' | 'arena' | 'rules';
  let step: Step = 'fighter';
  let selectMode: 'versus' | 'arcade' | 'duo' = 'versus';
  /** which roster tab is open: the 2.2 roster, the 2.1 set, or custom units */
  let ver: '22' | '21' | 'c' = '22';
  const verOf = (id: string): '22' | '21' | 'c' => {
    const c = characterById(id);
    return !BUILTIN_IDS.has(c.id) ? 'c' : c.v21 ? '21' : '22';
  };
  const BUILTIN_IDS = new Set(BUILTINS.map((c) => c.id));
  const TRAITS: [keyof NonNullable<ReturnType<typeof characterById>['traits']>, string][] = [
    ['health', 'Armour'],
    ['speed', 'Speed'],
    ['fireRate', 'Fire rate'],
    ['agility', 'Agility'],
  ];
  const meters = (id: string) => {
    const t = characterById(id).traits;
    return TRAITS.map(([k, label]) => {
      const v = Math.max(1, Math.min(5, Math.round(t?.[k] ?? 3)));
      return `<div class="meter"><span>${label}</span><i>${[1, 2, 3, 4, 5].map((n) => `<b class="${n <= v ? 'lit' : ''}"></b>`).join('')}</i></div>`;
    }).join('') + marbleLine(id);
  };
  /** the fighter's marble and magazine, under its meters */
  const marbleLine = (id: string) => {
    const mb = marbleOf(id);
    const mag = S().magPer === false ? magazine() : mb.mag;
    return `<div class="meter marble"><span>Marble</span><em class="mb-${mb.type}">${mb.name}<small>${mag} PER LOAD</small></em></div>`;
  };
  const markSteps = () => {
    const order: Step[] = selectMode === 'arcade' ? ['fighter'] : ['fighter', 'rival', 'arena', 'rules'];
    document.querySelectorAll<HTMLElement>('.steps li').forEach((li) => {
      const k = order.indexOf(li.dataset.step as Step);
      li.classList.toggle('hidden', k < 0);
      li.classList.toggle('on', li.dataset.step === step);
      li.classList.toggle('done', k >= 0 && k < order.indexOf(step));
    });
  };
  /** the selected tile for this step */
  const chosen = () => {
    const st = saveData.settings;
    return step === 'fighter' ? st.character : step === 'rival' ? st.enemyCharacter || 'auto' : st.stage;
  };
  /** restart a one-shot CSS animation class on an element */
  const replay = (el: Element, cls: string) => {
    el.classList.remove(cls);
    void (el as HTMLElement).offsetWidth;
    el.classList.add(cls);
  };
  /** the unit card's two tabs: stats or profile */
  let infoTab: 'stats' | 'profile' = 'stats';
  const showInfo = () => {
    $('info-tabs').classList.remove('hidden');
    document.querySelectorAll<HTMLElement>('#info-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.info === infoTab));
    $('pv-stats').classList.toggle('hidden', infoTab !== 'stats');
    $('pv-profile').classList.toggle('hidden', infoTab !== 'profile');
  };
  document.querySelectorAll<HTMLElement>('#info-tabs button').forEach((b) =>
    b.addEventListener('click', () => {
      infoTab = b.dataset.info as typeof infoTab;
      showInfo();
      if (infoTab === 'stats') replay($('pv-stats'), 'refill');
    }),
  );
  const showPreview = () => {
    const id = chosen();
    // the preview screen blinks like a CRT changing channel; the name plate and meters refresh
    replay($('preview'), 'switch');
    replay(document.querySelector('.crt-name')!, 'flash');
    replay($('pv-stats'), 'refill');
    if (step === 'arena') {
      preview.showStage(id);
      $('pv-tag').textContent = 'ARENA';
      $('pv-name').textContent = stageById(id).name;
      $('pv-stats').innerHTML = `<p class="pv-note">${stageById(id).name} · scenery and pucks themed to match</p>`;
      $('pv-profile').classList.add('hidden');
      $('pv-stats').classList.remove('hidden');
      $('info-tabs').classList.add('hidden');
      return;
    }
    const unit = id === 'auto' ? enemyCharacter() : id;
    preview.showUnit(unit);
    $('pv-tag').textContent = step === 'fighter' ? 'PLAYER 1' : selectMode === 'duo' ? 'PLAYER 2' : id === 'auto' ? 'RIVAL · AUTO' : 'RIVAL';
    $('pv-name').textContent = characterById(unit).name;
    $('pv-stats').innerHTML = meters(unit);
    const c = characterById(unit);
    const pr = profileOf(c.id, c.from, c.base);
    const prof = $('pv-profile');
    showInfo();
    prof.innerHTML = pr
      ? `<div class="pf-head"><b>${pr.role}</b><span>${pr.origin}</span></div><p>${pr.bio}</p><div class="pf-tags"><em>Style · ${pr.style}</em><em>Best at · ${pr.specialty}</em></div>`
      : `<div class="pf-head"><b>Custom unit</b><span>Unit Lab</span></div><p>Built in the Unit Lab.</p>`;
  };
  const buildGrid = () => {
    const grid = $('pick-grid');
    grid.innerHTML = '';
    const arena = step === 'arena';
    $('arena-width').classList.toggle('hidden', !arena);
    grid.classList.toggle('arenas', arena);
    const pick = (id: string) => {
      saveSetting(step === 'fighter' ? { character: id } : step === 'rival' ? { enemyCharacter: id } : { stage: id });
      grid.querySelectorAll<HTMLElement>('.tile').forEach((t) => t.classList.toggle('on', t.dataset.id === id));
      showPreview();
    };
    const tile = (id: string, html: string) => {
      const b = document.createElement('button');
      b.className = 'tile' + (id === chosen() ? ' on' : '');
      b.dataset.id = id;
      // tiles drop in one after another
      b.style.setProperty('--i', String(grid.children.length));
      b.innerHTML = html;
      b.addEventListener('click', () => pick(id));
      grid.appendChild(b);
    };
    const foes = arcadeFoes();
    const lockedTile = (id: string, stage: number, color: string, label = `Arcade stage ${stage}`) => {
      const b = document.createElement('button');
      b.className = 'tile locked';
      b.dataset.id = id;
      b.style.setProperty('--i', String(grid.children.length));
      b.innerHTML = `<i data-portrait="${id}" style="background:${color}"></i><em class="lock">${label === 'Opponent' ? '⚔' : '🔒'}</em><span>${label}</span>`;
      b.addEventListener('click', () => {
        replay(b, 'nope');
        sfx.play('bump', 0.5);
      });
      grid.appendChild(b);
    };
    if (arena) {
      for (const st of STAGES) tile(st.id, `<i class="swatch" style="background:linear-gradient(160deg, ${hexc(st.swatch[0])} 0 62%, ${hexc(st.swatch[1])} 62%)"></i><span>${st.name}</span>`);
      // swap the colour swatches for real stills of each arena, one at a time
      const swatches = [...grid.querySelectorAll<HTMLElement>('.tile')];
      const nextShot = () => {
        const t = swatches.shift();
        if (!t || step !== 'arena' || $('select').classList.contains('hidden')) return;
        const i = t.querySelector<HTMLElement>('.swatch');
        if (i) i.style.background = `center / cover url(${preview.stageShot(t.dataset.id!)})`;
        setTimeout(nextShot, 40);
      };
      setTimeout(nextShot, 300);
      return;
    }
    const hasCustom = CHARACTERS.some((c) => verOf(c.id) === 'c');
    // (the Custom tab only shows when there are custom units)
    document.querySelector<HTMLElement>('#ver-tabs [data-ver="c"]')!.classList.toggle('hidden', !hasCustom);
    if (ver === 'c' && !hasCustom) ver = '22';
    document.querySelectorAll<HTMLElement>('#ver-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.ver === ver));
    if (step === 'rival' && selectMode !== 'duo') tile('auto', `<i class="auto">?</i><span>Auto</span>`);
    for (const c of ver === '21' ? classic() : playable()) {
      if (verOf(c.id) !== ver) continue;
      // the arcade's bosses stay a surprise: they can't be picked for a run
      if (selectMode === 'arcade' && isBossUnit(c.id) && !(arcadeSwap && foes.has(baseOf(c.id)))) continue;
      // retrying a stage: the opponent waiting there shows, but can't be your pick
      if (arcadeSwap && step === 'fighter' && foes.has(baseOf(c.id))) {
        lockedTile(c.id, 0, hexc(c.palette.body), 'Opponent');
        continue;
      }
      // a locked unit shows (so there's something to chase) but can't be picked
      if (isLocked(c.id)) {
        lockedTile(c.id, unlockStage(c.id), hexc(c.palette.body));
        continue;
      }
      tile(c.id, `<i data-portrait="${c.id}" style="background:${hexc(c.palette.body)}"></i><span>${c.name}</span>`);
    }
    fillPortraits(grid);
  };
  const SCREENS = ['title', 'select', 'setup', 'result', 'paused', 'settings'];
  const show = (id: string) => {
    for (const k of SCREENS) $(k).classList.toggle('hidden', k !== id);
    if (id !== 'select') preview.release();
  };
  const goStep = (next: Step) => {
    step = next;
    replay(document.querySelector('#select .step-head h2')!, 'type');
    markSteps();
    if (step === 'rules') {
      show('setup');
      const st = saveData.settings;
      const foe = st.enemyCharacter && st.enemyCharacter !== 'auto' ? characterById(st.enemyCharacter).name : `Auto · ${characterById(enemyCharacter()).name}`;
      $('vs-lcd').innerHTML = `<div class="lcd-row"><span>P1</span><b>${characterById(st.character).name}</b></div><div class="lcd-row"><span>VS</span><b>${foe}</b></div><div class="lcd-row"><span>ARENA</span><b>${stageById(st.stage).name}</b></div>`;
      return;
    }
    show('select');
    // open the roster tab the current pick lives in
    if (step !== 'arena') ver = chosen() === 'auto' ? ver : verOf(chosen());
    $('select-title').textContent =
      step === 'fighter' ? (selectMode === 'duo' ? 'Player 1 fighter' : 'Select fighter') : step === 'rival' ? (selectMode === 'duo' ? 'Player 2 fighter' : 'Select rival') : 'Select arena';
    $('select-next').textContent = arcadeSwap ? `Retry stage ${arcade?.stage ?? ''} ▶` : selectMode === 'arcade' ? 'Start arcade ▶' : 'Next ▶';
    if (arcadeSwap) $('select-title').textContent = 'Change fighter';
    buildGrid();
    showPreview();
  };
  const openSelect = (mode: 'versus' | 'arcade' | 'duo') => {
    sfx.unlock();
    selectMode = mode;
    // a locked unit (or, for an arcade run, a boss) can't be your pick: move it to the first that can
    const ok = (id: string) => !isLocked(id) && !(mode === 'arcade' && isBossUnit(id));
    if (!ok(saveData.settings.character)) {
      const first = playable().find((c) => ok(c.id));
      if (first) saveData = store.save({ settings: { ...saveData.settings, character: first.id } });
    }
    if (saveData.settings.enemyCharacter && saveData.settings.enemyCharacter !== 'auto' && isLocked(saveData.settings.enemyCharacter))
      saveData = store.save({ settings: { ...saveData.settings, enemyCharacter: 'auto' } });
    goStep('fighter');
  };
  const toTitle = () => {
    show('title');
    screen = 'title';
    duo = false;
    document.body.classList.remove('duo');
    applySettings();
  };
  document.querySelectorAll<HTMLElement>('#ver-tabs button').forEach((b) =>
    b.addEventListener('click', () => {
      ver = b.dataset.ver as typeof ver;
      buildGrid();
    }),
  );
  $('select-back').addEventListener('click', () => {
    if (arcadeSwap) {
      // back to the game-over screen, the run still on
      arcadeSwap = false;
      show('result');
      return;
    }
    if (step === 'fighter') toTitle();
    else goStep(step === 'arena' ? 'rival' : 'fighter');
  });
  $('select-next').addEventListener('click', () => {
    if (arcadeSwap) {
      // the same stage again, with the new fighter
      arcadeSwap = false;
      preview.release();
      refitPlan();
      showTower(startMatch);
      return;
    }
    if (selectMode === 'arcade') {
      preview.release();
      startArcade();
      return;
    }
    goStep(step === 'fighter' ? 'rival' : step === 'rival' ? 'arena' : 'rules');
  });
  $('setup-back').addEventListener('click', () => goStep('arena'));
  $('fight-btn').addEventListener('click', () => {
    arcade = null;
    duo = selectMode === 'duo';
    startMatch();
  });

  // settings tabs
  const showTab = (tab: string) => {
    document.querySelectorAll<HTMLElement>('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    document.querySelectorAll<HTMLElement>('.panels section').forEach((p) => p.classList.toggle('on', p.dataset.panel === tab));
  };
  document.querySelectorAll<HTMLElement>('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab!)));
  showTab('controls');
  applySettings();

  let settingsFrom: 'title' | 'paused' | 'result' = 'title';
  const openSettings = (from: 'title' | 'paused' | 'result') => {
    settingsFrom = from;
    for (const k of SCREENS) $(k).classList.add('hidden');
    $('settings').classList.remove('hidden');
  };
  $('settings-btn').addEventListener('click', () => openSettings('title'));
  // back from a reload for a new stage width: reopen settings where we were
  try {
    const tab = sessionStorage.getItem('mf-reopen-settings');
    if (tab) {
      sessionStorage.removeItem('mf-reopen-settings');
      // the table width is picked on the rules screen: come back to it
      selectMode = 'versus';
      goStep('rules');
    }
  } catch {
    // storage unavailable
  }
  $('pause-settings-btn').addEventListener('click', () => openSettings('paused'));
  $('result-settings-btn').addEventListener('click', () => openSettings('result'));
  $('settings-done').addEventListener('click', () => {
    $('settings').classList.add('hidden');
    $(settingsFrom).classList.remove('hidden');
  });

  // every key on the menus clicks, and on phones taps back with a tiny buzz
  document.addEventListener(
    'pointerdown',
    (e) => {
      const key = (e.target as Element | null)?.closest?.('.key, .tile, .seg button, .ver-tabs button, .tabs button, .icon-btn');
      if (!key) return;
      sfx.unlock();
      sfx.play('tick', 0.5);
      buzz(6);
      replay(key, 'tap');
      // the power LED on the case blinks with each press
      document.querySelectorAll('.led').forEach((l) => replay(l, 'blip'));
    },
    { capture: true },
  );
  // in-match view switch: near (default), mid, far, cockpit
  const cycleView = () => {
    const order = ['near', 'mid', 'far', 'first'] as const;
    const next = order[(order.indexOf(saveData.settings.camera) + 1) % order.length];
    saveSetting({ camera: next });
    replay($('view-btn'), 'flip');
  };
  $('view-btn').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    cycleView();
  });
  $('pause-menu-btn').addEventListener('click', () => {
    paused = false;
    sfx.resume();
    pad.clear();
    replayEl.classList.add('hidden');
    introEl.classList.add('hidden');
    replayGame = null;
    view.game = game;
    view.cine = null;
    controls(false);
    input.release();
    hud.classList.add('hidden');
    quitArcade();
  });

  // on-screen pad: one tracker for every finger on it
  const pad = new PadTracker($('pad'));
  pad.onPress = () => sfx.unlock();
  const sliderEl = document.querySelector<HTMLElement>('.pad-slider')!;
  input.pad = pad;
  const padButtons = [...document.querySelectorAll<HTMLElement>('.pad-btn')];

  window.addEventListener('keydown', (e) => {
    if (!$('settings').classList.contains('hidden')) return;
    if (e.code === 'Escape' || e.code === 'KeyP') setPaused(!paused);
    if (e.code === 'KeyV' && screen === 'playing') cycleView();
    if ((e.code === 'Enter' || e.code === 'Space') && screen !== 'playing') {
      e.preventDefault();
      if (!$('setup').classList.contains('hidden')) $('fight-btn').click();
      else if (!$('select').classList.contains('hidden')) $('select-next').click();
      else if (!$('title').classList.contains('hidden')) openSelect('versus');
      else if (!$('result').classList.contains('hidden')) $('again-btn').click();
    }
  });
  // pause whenever the tab is hidden (also covers ad overlays later)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) setPaused(true);
  });
  window.addEventListener('resize', () => {
    view.resize();
    fx2d.resize();
  });
  input.onFirstInput = () => sfx.unlock();

  $('loading').classList.add('hidden');

  if (debug) {
    // console hook for balance testing: __mf.sim(seconds) fast-forwards the match
    (window as unknown as Record<string, unknown>).__mf = {
      game,
      ai: ais[0],
      ais,
      view,
      faces,
      start: startMatch,
      /** arcade, for testing the ladder without playing every match */
      arcade: {
        run: () => arcade,
        start: startArcade,
        next: playAgain,
        quit: quitArcade,
        settings: S,
        finish(w: -1 | 0 | 1) {
          matchWinner = w;
          roundWins[0] = w === 0 ? 2 : 0;
          roundWins[1] = w === 1 ? 2 : 0;
          endMatch();
        },
      },
      /** a bot that plays the player's side, for bot-vs-bot balance runs */
      bot(name: string) {
        // the test bot streams shots like the CPU does
        game.chargeShots = false;
        const b = new AIController(game, player, AI_PROFILES[name]);
        return (dt: number) => b.update(dt);
      },
      sim(seconds: number, playerBrain?: (dt: number) => void) {
        for (let t = 0; t < seconds && game.phase !== 'over'; t += STEP) {
          if (playerBrain) playerBrain(STEP);
          else input.update(STEP);
          for (const a of ais) a.update(STEP);
          game.step(STEP);
          game.hitstop = 0;
        }
        return { phase: game.phase, clock: game.clock, hp: game.shooters.map((s) => Math.round(s.health)), winner: game.winner };
      },
    };
  }

  // ---------- loop ----------
  let last = performance.now();
  let lastCount = -1;
  let recAcc = 0;
  let fpsAcc = 0;
  let fpsFrames = 0;
  let fps = 0;

  let lastDrawn = 0;
  let wasShielding = false;
  /** the soundtrack follows the screen: menus, a fight (a boss stage gets its own), Squad Run */
  const scoreMusic = () => {
    const st = S();
    music.setEnabled(st.music !== false);
    music.setDucked(paused);
    if (squadRun?.active) {
      music.play(squadRun.bossOn ? 'boss' : 'squad');
      music.intensity(squadRun.bossOn ? 1 : 0.55);
      return;
    }
    if (screen === 'playing') {
      music.play(arcade && boss() ? 'boss' : 'fight');
      // it heats up in the final round, or when either side is nearly down
      const low = Math.min(game.teamFrac(0), game.teamFrac(1)) < 0.3;
      music.intensity(finalRound || low ? 1 : 0.5);
      return;
    }
    music.play('menu');
    music.intensity(0.3);
  };
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    scoreMusic();
    // battery saver: 30 frames a second in a fight (a 60 Hz screen shows every other one)
    if (S().batterySaver && screen === 'playing' && now - lastDrawn < 1000 / 30 - 4) return;
    lastDrawn = now;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    // a tap as your shield comes up
    const shielding = screen === 'playing' && player.shieldUp;
    if (shielding && !wasShielding && S().vibrate) buzz(12);
    wasShielding = shielding;

    if (screen === 'playing' && !paused && flow !== 'round') updateFlow(dt);
    // knocked out but the pack fights on: you're spectating from the sky, so put the controls away
    document.body.classList.toggle('spectating', screen === 'playing' && flow === 'round' && player.active && player.out);
    // health tags ride along every frame (and hide outside the fight)
    if (screen === 'playing') {
      updateTags(dt);
      updateLocks();
    }
    if (screen === 'playing' && !paused && flow === 'round') {
      if (game.hitstop > 0) {
        game.hitstop -= dt;
      } else {
        // KO slow-mo, or the Slow-Mo item (the whole match at half speed)
        const timeScale = game.phase === 'ko' ? 0.3 : game.slowT > 0 ? SLOWMO.world : 1;
        acc += dt;
        let steps = 0;
        while (acc >= STEP && steps < 5) {
          // every real tick steps the game by a slice of game time; under slow-mo
          // the robot that used it thinks and acts at its own (fast) rate
          const sdt = STEP * timeScale;
          const rate = (slot: number) => (game.slowT > 0 && game.slowOwner === slot ? SLOWMO.owner / SLOWMO.world : 1);
          input.update(sdt * rate(0));
          duoInput.update(sdt * rate(0));
          // (in local versus player 2 drives the opponent instead of its AI)
          ais.forEach((a, i) => (duo && i === 0 ? null : a.update(sdt * rate(i + 1))));
          const before = game.phase;
          game.step(sdt);
          // the replay keeps one frame per full game step, as before
          recAcc += sdt;
          if (recAcc >= STEP - 1e-9) {
            recAcc -= STEP;
            recorder.record(game);
          }
          if (before === 'fight' && game.phase === 'ko') recorder.markKo();
          acc -= STEP;
          steps++;
        }
        if (steps === 5) acc = 0;
      }

      recorder.addFx(game.fx);
      // fx the HUD cares about; the view consumes the list afterwards
      for (const f of game.fx) {
        if (f.type === 'eliminated') {
          if (slotTeam(f.slot) === 1) showToast(`UNIT DOWN // ${game.aliveEnemies().length} LEFT`, 0xffc23d);
          else if (f.slot === 0) showToast('YOU ARE DOWN // PACK FIGHTS ON', 0xff3e5e);
          else showToast(`ALLY DOWN // ${game.alive(0).length} LEFT`, 0xff3e5e);
        }
        if (f.type === 'hit') {
          // a number where it landed; the string of hits your side lands; the first hit of the round
          damageNumber(f.x, f.y, f.amount, f.team === 0, f.power !== 'normal');
          if (!roundFeel.firstHit) {
            roundFeel.firstHit = true;
            callout('FIRST HIT', f.team === 0 ? 'red' : 'gold');
          }
          if (f.team === 1) {
            roundFeel.combo = game.time - roundFeel.lastHit < COMBO_GAP ? roundFeel.combo + 1 : 1;
            roundFeel.lastHit = game.time;
            if (roundFeel.combo >= 3) {
              comboEl.querySelector('b')!.textContent = String(roundFeel.combo);
              comboEl.classList.remove('bump');
              void comboEl.offsetWidth;
              comboEl.classList.add('on', 'bump');
            }
            if (roundFeel.combo === 5 || roundFeel.combo === 10) callout(roundFeel.combo === 10 ? 'UNSTOPPABLE!' : 'COMBO!', 'gold');
          } else {
            // taking a hit breaks your string
            roundFeel.combo = 0;
            comboEl.classList.remove('on');
          }
          chipDelay[f.team] = 0.45;
          hpBox[f.team].classList.remove('shake');
          void hpBox[f.team].offsetWidth;
          hpBox[f.team].classList.add('shake');
          if (f.team === 0) {
            vignette.classList.add('on');
            requestAnimationFrame(() => vignette.classList.remove('on'));
          }
          if (S().vibrate) {
            // taking a hit buzzes harder than landing one
            if (f.power !== 'normal') buzz(f.team === 0 ? [90, 40, 140] : [40, 30, 60]);
            else buzz(f.team === 0 ? 45 : 14);
          }
        }
        if (f.type === 'super-ready' && f.slot === 0 && S().vibrate) buzz([20, 40, 20]);
        // a light tick under your thumb for every shot you fire, a thump for a super
        if (f.type === 'muzzle' && f.slot === 0 && S().vibrate) buzz(8);
        if (f.type === 'super-fire' && f.slot === 0 && S().vibrate) buzz([30, 30, 50]);
        if (f.type === 'parry') {
          if (slotTeam(f.slot) === 0) callout(f.slot === 0 ? 'PARRY!' : 'ALLY PARRY', 'cyan');
          else callout('PARRIED', 'red');
          if (f.slot === 0 && S().vibrate) buzz([15, 25, 40]);
        }
        if (f.type === 'pickup') {
          const def = ITEMS[f.item];
          if (f.slot === 0) showToast(`${def.name.toUpperCase()} ACQUIRED`, def.color);
          if (f.slot === 0 && S().vibrate) buzz(25);
        }
        if (f.type === 'use' && slotTeam(f.slot) === 1) showToast(`ENEMY ${ITEMS[f.item].name.toUpperCase()}`, 0xff3e5e);
        if (f.type === 'drop-destroyed') showToast(f.team === 0 ? 'SUPPLY DESTROYED' : 'ENEMY SUPPLY DENIED', f.team === 0 ? 0xff3e5e : ITEMS[f.item].color);
      }

      updateHud(dt);
      if (game.phase === 'over') onRoundOver();
    }

    for (const el of padButtons) el.classList.toggle('held', pad.held(el.dataset.btn as 'left'));
    // slider thumb rides with the robot's place in its lane; a tick marks where the finger is
    if (document.body.classList.contains('slider')) {
      const lo = -ARENA.railHalfWidth;
      const hi = ARENA.railHalfWidth;
      sliderEl.style.setProperty('--u', String(Math.max(0, Math.min(1, (player.x - lo) / Math.max(0.01, hi - lo)))));
      const u = pad.slider();
      sliderEl.classList.toggle('active', u !== null);
      if (u !== null) sliderEl.style.setProperty('--t', String(u));
    }
    // (the menus, the select screen, options, results and pause are opaque: the arena behind them
    // isn't drawn at all, nor while Squad Run is up)
    const covered = screen !== 'playing' || paused || !!squadRun?.active;
    if (!covered) view.render(paused ? 0 : dt, screen === 'playing' && flow === 'round' && game.phase !== 'ko' && game.phase !== 'over');
    if (screen === 'playing' || screen === 'result') {
      const shown = [view.game.shooters[0], view.game.shooters[focus().slot] ?? view.game.shooters[1]];
      if (shown[1] && faceSlot !== shown[1].slot) {
        faceSlot = shown[1].slot;
        faces[1].setCharacter(unitIds()[faceSlot]);
      }
      shown.forEach((s, i) => faces[i].update(paused ? 0 : dt, s));
      document.body.classList.toggle('slowmo', game.slowT > 0 && flow === 'round');
    }

    // frame-rate meter (settings) and the debug readout share one counter
    fpsAcc += dt;
    fpsFrames++;
    if (fpsAcc > 0.5) {
      fps = Math.round(fpsFrames / fpsAcc);
      fpsAcc = fpsFrames = 0;
      if (S().showFps) {
        const el = $('fps');
        el.textContent = `${fps} FPS`;
        el.classList.toggle('slow', fps < 50 && fps >= 30);
        el.classList.toggle('bad', fps < 30);
      }
    }
    if (debug) {
      const d = $('debug');
      d.classList.remove('hidden');
      d.textContent = `fps ${fps}\nmarbles ${game.activeMarbles()}\nai ${brain(aiOverride ?? S().enemyIQ).name}\npad ${pad.debug()}\nx ${player.x.toFixed(2)}${player.railPush ? ' END' : ''}`;
    }
  };

  let lastItem: ItemType | null | undefined;
  let lastCharge = -1;
  let lastCharging = false;
  let faceSlot = 1;
  let lastEffects = '';
  // ---------- health tags that follow each fighter ----------
  const tagBox = $('unit-tags');
  const tags = game.shooters.map(() => {
    const el = document.createElement('div');
    el.className = 'unit-tag hidden';
    el.innerHTML = '<span class="tag-name"></span><div class="tag-hp"><i class="chip"></i><i class="fill"></i></div><div class="tag-sp"><i></i></div>';
    tagBox.appendChild(el);
    return {
      el,
      name: el.querySelector<HTMLElement>('.tag-name')!,
      chip: el.querySelector<HTMLElement>('.chip')!,
      fill: el.querySelector<HTMLElement>('.fill')!,
      sp: el.querySelector<HTMLElement>('.tag-sp i')!,
      chipFrac: 1,
      id: '',
    };
  });
  // ---------- Smart Lock target squares ----------
  const lockBox = $('lock-marks');
  const lockMarks = game.shooters.map(() => {
    const el = document.createElement('div');
    el.className = 'lock-mark hidden';
    el.innerHTML = '<i></i><i></i><i></i><i></i><b>LOCK</b>';
    lockBox.appendChild(el);
    return { el, label: el.querySelector('b')! };
  });
  const updateLocks = () => {
    const on = flow === 'round' && screen === 'playing';
    // which robots are locked, and by which side
    const lockedBy = new Map<number, number>();
    if (on) for (const s of game.shooters) if (s.active && s.alive && s.lockT > 0 && s.lockSlot >= 0) lockedBy.set(s.lockSlot, s.team);
    game.shooters.forEach((t, i) => {
      const m = lockMarks[i];
      const team = lockedBy.get(i);
      const pt = team !== undefined && t.alive ? view.bodyPoint(i) : null;
      m.el.classList.toggle('hidden', !pt);
      if (!pt) return;
      // amber when your side holds the lock, red when the opponents have locked one of yours
      m.el.classList.toggle('danger', team === 1);
      m.label.textContent = team === 1 && i === 0 ? 'LOCKED ON YOU' : 'LOCK';
      m.el.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px) translate(-50%, -50%) scale(${pt.scale.toFixed(2)})`;
    });
  };

  const updateTags = (dt: number) => {
    const on = S().hudMode === 'tags' && flow === 'round';
    const ids = unitIds();
    game.shooters.forEach((s, i) => {
      const t = tags[i];
      const pt = on && s.active && !s.out ? view.tagPoint(i) : null;
      t.el.classList.toggle('hidden', !pt);
      if (!pt) return;
      if (t.id !== ids[i]) {
        t.id = ids[i];
        t.name.textContent = i === 0 ? 'YOU' : characterById(ids[i]).name.toUpperCase();
        t.el.classList.toggle('you', i === 0);
        t.el.classList.toggle('ally', i !== 0 && s.team === 0);
        t.el.classList.toggle('foe', s.team === 1);
      }
      const frac = Math.max(0, s.health) / Math.max(1, s.maxHealth);
      // a white trail shows the chunk just lost, then drains away
      t.chipFrac = Math.max(frac, t.chipFrac - dt * 0.5);
      if (frac > t.chipFrac) t.chipFrac = frac;
      t.fill.style.width = frac * 100 + '%';
      t.chip.style.width = t.chipFrac * 100 + '%';
      t.sp.style.width = (s.shield / SHIELD.max) * 100 + '%';
      t.el.classList.toggle('low', frac < 0.3);
      t.el.classList.toggle('super', s.superReady);
      t.el.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px) translate(-50%, -100%) scale(${pt.scale.toFixed(2)})`;
    });
  };

  const updateHud = (dt: number) => {
    // countdown + KO banners
    if (game.phase === 'countdown') {
      // "ROUND n" then "READY", Tekken style
      if (lastCount === -1) {
        lastCount = 2;
        showBanner(finalRound ? 'FINAL ROUND' : `ROUND ${roundNo}`, true);
        sfx.play('gong');
      } else if (lastCount === 2 && game.phaseTime > MATCH.countdown * 0.55) {
        lastCount = 1;
        showBanner('READY');
        sfx.play('tick');
      }
    } else if (game.phase === 'fight' && lastCount > 0) {
      lastCount = 0;
      showBanner('FIGHT!', true);
      sfx.play('slam');
      setTimeout(() => hints.classList.add('fade'), 3500);
      $('duo-hints').classList.remove('fade');
      setTimeout(() => $('duo-hints').classList.add('fade'), 5000);
    } else if (game.phase === 'ko' && lastCount === 0) {
      lastCount = -2;
      const w = game.winner;
      const perfect = (w === 0 || w === 1) && game.shooters[w].health >= game.shooters[w].maxHealth;
      // won from the brink: a comeback (or just hanging on)
      const comeback = (w === 0 || w === 1) && roundFeel.low[w] < 0.25;
      const close = (w === 0 || w === 1) && game.teamFrac(w) < 0.15;
      comboEl.classList.remove('on');
      showBanner(game.clock <= 0 ? 'TIME UP' : 'K.O.', true, perfect ? 'PERFECT' : comeback ? 'COMEBACK' : close ? 'CLOSE ONE' : w === -1 ? 'DRAW' : undefined);
    }

    // the string lapses when no hit lands for a moment; your health dropping low gets a callout
    if (roundFeel.combo && game.time - roundFeel.lastHit > COMBO_GAP) {
      roundFeel.combo = 0;
      comboEl.classList.remove('on');
    }
    if (game.phase === 'fight') {
      for (const t of [0, 1] as const) roundFeel.low[t] = Math.min(roundFeel.low[t], game.teamFrac(t));
      if (!roundFeel.lastStand && game.teamFrac(0) < 0.2 && game.teamFrac(0) > 0) {
        roundFeel.lastStand = true;
        callout('LAST STAND', 'red');
      }
    }
    clock.textContent = Number.isFinite(game.clock) ? Math.ceil(game.clock).toString() : '∞';
    clock.classList.toggle('low', game.clock < 10);

    // each bar is a whole pack (just you when solo); shield/super from you and the one you face
    ([player, focus()] as Shooter[]).forEach((s, i) => {
      const frac = game.teamFrac(i === 0 ? 0 : 1);
      hpFill[i].style.width = frac * 100 + '%';
      // split screen: each player's own bar, in their own half
      if (duo) duoHp[i].style.width = frac * 100 + '%';
      chipDelay[i] -= dt;
      if (chipDelay[i] <= 0) chip[i] = Math.max(frac, chip[i] - dt * 0.4);
      chip[i] = Math.max(chip[i], frac);
      hpChip[i].style.width = chip[i] * 100 + '%';
      hpBox[i].classList.toggle('low', frac < 0.25);
      hpNum[i].textContent = Math.ceil(frac * 100) + '%';
      spFill[i].style.width = (s.shield / SHIELD.max) * 100 + '%';
      spBox[i].classList.toggle('broken', s.shieldLock > 0);
      // super meters: pips fill per hit, glow when the next shot is a super
      superPips[i].forEach((pip, k) => pip.classList.toggle('on', s.superReady || k < s.charge));
      superRows[i].classList.toggle('ready', s.superReady);
    });

    // charge shot: the fire button swells and the arena darkens while it builds
    {
      const lvl = chargeLevel(player);
      const charging = player.alive && player.chargeHold >= CHARGE.hold;
      if (Math.abs(lvl - lastCharge) > 0.01 || charging !== lastCharging) {
        lastCharge = lvl;
        lastCharging = charging;
        document.body.style.setProperty('--charge', lvl.toFixed(2));
        document.body.classList.toggle('charging', charging);
        document.body.classList.toggle('charge-full', charging && player.stored >= CHARGE.max);
      }
      document.body.classList.toggle('pressing', player.firing);
    }

    // item slot + opponent's held item
    if (player.item !== lastItem) {
      lastItem = player.item;
      const it = player.item;
      itemBtn.classList.toggle('empty', !it);
      itemBtn.classList.toggle('full', !!it);
      itemBtn.style.setProperty('--item', it ? hexc(ITEMS[it].color) : 'var(--cyan)');
      $('item-icon').innerHTML = it ? ITEM_ICONS[it] : '';
      $('item-name').textContent = it ? ITEMS[it].short : 'NO ITEM';
    }
    const foe = focus();
    $('enemy-item').textContent = foe.item ? `◆ ${ITEMS[foe.item].short}` : '';

    // active timed effects
    const fx: string[] = [];
    if (player.multiT > 0) fx.push(`multi:${Math.ceil(player.multiT)}`);
    if (game.slowT > 0 && game.slowOwner === 0) fx.push(`slowmo:${Math.ceil(game.slowT)}`);
    if (player.wiperT > 0) fx.push(`wiper:${Math.ceil(player.wiperT)}`);
    if (player.lockT > 0) fx.push(`lock:${Math.ceil(player.lockT)}`);
    const key = fx.join('|');
    if (key !== lastEffects) {
      lastEffects = key;
      effects.innerHTML = fx
        .map((e) => {
          const [type, secs] = e.split(':') as [ItemType, string];
          return `<div class="effect" style="--item:${hexc(ITEMS[type].color)}">${ITEM_ICONS[type]}${ITEMS[type].short} ${secs}s</div>`;
        })
        .join('');
    }

    // rail gauge: marker slides between the ends, amber when pressing into one
    const rg = $('rail-gauge');
    (rg.firstElementChild as HTMLElement).style.left = 50 + (player.x / ARENA.railHalfWidth) * 50 + '%';
    rg.classList.toggle('end', !!player.railPush);

    // the charge meter: an arming bar for the first half second, then one segment per stored
    // ball (the next one filling), so holding fire is never a hidden mechanic
    const meter = $('charge-meter');
    const holding = player.alive && player.chargeHold > 0.12;
    meter.classList.toggle('on', holding || player.stored > 0);
    if (holding || player.stored > 0) {
      const armed = player.chargeHold >= CHARGE.hold;
      const next = armed ? ((player.chargeHold - CHARGE.hold) % CHARGE.per) / CHARGE.per : player.chargeHold / CHARGE.hold;
      const segs = $('charge-segs').children;
      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i] as HTMLElement;
        const fill = i < player.stored ? 1 : i === player.stored && player.stored < CHARGE.max ? (armed ? next : 0) : 0;
        seg.style.setProperty('--fill', String(fill));
        seg.classList.toggle('lit', i < player.stored);
      }
      meter.classList.toggle('arming', !armed);
      $('charge-label').textContent = !armed ? 'HOLD TO CHARGE' : player.stored ? `CHARGE ×${player.stored}` : 'CHARGING';
      meter.style.setProperty('--arm', String(armed ? 1 : next));
    }
    // during a reload the tube refills from the bottom as the bar fills
    const full = player.reload > 0 ? Math.floor((1 - player.reload / player.stats.reloadTime) * player.stats.capacity) : Math.floor(player.ammo);
    const kids = pips.children;
    for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('empty', i >= full);
    $('magazine').classList.toggle('reloading', player.reload > 0);
    $('ammo-count').textContent = `${Math.floor(player.ammo)}/${player.stats.capacity}`;
    reloadBar.classList.toggle('on', player.reload > 0);
    if (player.reload > 0) {
      (reloadBar.firstElementChild as HTMLElement).style.width = (1 - player.reload / player.stats.reloadTime) * 100 + '%';
    }
  };

  requestAnimationFrame(frame);
}
