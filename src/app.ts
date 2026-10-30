import { AI_PROFILES, ARENA, BALANCE, MAG_OF, MARBLE_OF, MARBLES, MATCH, setArenaWidth, type ShooterStats } from './config';
import { traitMul } from './roster';
import { computeStats, STARTER_BUILD } from './parts';
import { CHARGE, Game, SPIRIT_MOVES, STEP, chargeLevel, slotTeam, type Shooter, type SpiritKind } from './game';
import { View } from './view';
import { DuoInput, Input, PadTracker } from './input';
import { AIController } from './ai';
import { Fx2D } from './fx2d';
import { BUILTINS, characterById, playable, playableId } from './robot';
import { fillPortraits, portrait } from './portraits';
import { Preview } from './preview';
import { profileOf, storyOf } from './profiles';
import { STAGES, stageById } from './stage';
import { ITEMS, SHIELD, SLOWMO, type ItemType } from './items';
import { Recorder, ReplayGame } from './replay';
import * as sfx from './audio';
import { SquadRun } from './squadrun';
import { buzz as haptic } from './haptics';
import * as music from './music';
import * as store from './storage';
import { CEL } from './cel';
import { BOARDS } from './pinball';
import { CHAPTER_DIFF, STORY_BONUS, STORY_PATHS, type Line } from './storymode';
import { REWARDS, SLOT_NAME, equipKey, rewardsOf, skinned, type Equip, type Slot } from './cosmetics';
import { kitOf } from './kits';

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
  /** the tutorial in progress: which step, how long on it, and what's been done */
  let tut: { i: number; t: number; moved: number; lastX: number; shots0: number; hits0: number; charged: boolean; shield: number; done: boolean } | null = null;
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
  /** story mode: whose story, which chapter (0-based), and the chapter's match settings */
  let story: { hero: string; ch: number; cfg: Partial<store.Settings> } | null = null;
  /** B-Daman mode: marbles picked up off the table, the B-Daspirit gauge and spirit shots */
  let bdaMode = false;
  /** the settings a match plays by: yours, with an arcade stage's (or local versus') rules on top */
  const S = (): store.Settings =>
    tut
      ? // the tutorial's practice match: one on one, a clean table, no clock, an easy rival
        { ...saveData.settings, pack: 1, playerPack: 1, items: false, roundTime: 0, pucks: 0, pins: 0, covers: 0, gates: false, enemyIQ: 'easy', enemyCharacter: 'liberty-22', enemyHealth: 3, enemySpeed: 2, enemyPower: 2 }
      : story
        ? { ...saveData.settings, ...story.cfg }
        : arcade
        ? { ...saveData.settings, ...arcade.cfg }
        : duo
          ? { ...saveData.settings, pack: 1, playerPack: 1, items: false }
          : bdaMode
            ? { ...saveData.settings, pack: 1, playerPack: 1, items: false, gates: false, pucks: 0, covers: 0, pins: 0, stage: BOARDS[saveData.settings.stage] ? 'space' : saveData.settings.stage }
            : saveData.settings;
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
  /** a word floating up from a spot on the table (CATCH +1) */
  const floatText = (x: number, y: number, text: string, cls: string) => {
    const sp = view.project(x, y, 1.0);
    const el = document.createElement('b');
    el.className = 'dmg ' + cls;
    el.textContent = text;
    el.style.left = sp.x + 'px';
    el.style.top = sp.y + 'px';
    el.style.setProperty('--dx', '0px');
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

  // ---------- fighter levels: XP from every match, a level and a rank for each fighter ----------
  const LV_MAX = 10;
  const RANKS = ['Rookie', 'Rookie', 'Brawler', 'Brawler', 'Veteran', 'Veteran', 'Ace', 'Ace', 'Champion', 'Legend'];
  /** XP to go from level n to n+1 */
  const lvNeed = (lv: number) => 100 + 50 * (lv - 1);
  const levelOf = (xp: number) => {
    let lv = 1;
    let into = xp;
    while (lv < LV_MAX && into >= lvNeed(lv)) into -= lvNeed(lv++);
    return { lv, into, need: lv < LV_MAX ? lvNeed(lv) : 0, rank: RANKS[lv - 1] };
  };
  const xpOf = (id: string) => saveData.fighterXp?.[id] ?? 0;
  /** the level line under a fighter's name: LV 3 [bar] Brawler */
  const lvHtml = (id: string) => {
    const L = levelOf(xpOf(id));
    const pct = L.need ? Math.round((L.into / L.need) * 100) : 100;
    return `<em>LV ${L.lv}</em><i><b style="width:${pct}%"></b></i><small>${L.need ? `${L.into} / ${L.need} XP` : 'MAX'}</small>`;
  };
  // ---------- cosmetics: what each fighter has unlocked and has on ----------
  const equipOf = (id: string): Equip => saveData.equip?.[id] ?? {};
  /** your fighter as it looks in its cosmetics */
  const mine = (id: string) => skinned(id, equipOf(id));
  const unlocked = (id: string, r: (typeof REWARDS)[number]) => levelOf(xpOf(id)).lv >= r.lv;
  const setEquip = (id: string, slot: Slot, value: string | undefined) => {
    const e = { ...equipOf(id) };
    if (value) e[slot] = value;
    else delete e[slot];
    saveData = store.save({ equip: { ...(saveData.equip ?? {}), [id]: e } });
  };
  /** the nameplate class for a fighter's name chip */
  const plateClass = (id: string) => (equipOf(id).plate ? `plate-${equipOf(id).plate}` : '');
  /** the next reward a fighter is working toward */
  const nextReward = (id: string) => rewardsOf(id).find((r) => r.lv > levelOf(xpOf(id)).lv);
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
  type Flow = 'intro' | 'round' | 'replay' | 'finale' | 'special';
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

  /** held items nobody used: they come along into the next round (and yours into the next arcade stage) */
  let carry: (ItemType | null)[] = [];
  let carryStage = false;
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
      bdaman: bdaMode,
      allyCharge: st.allyCharge ?? true,
      boss: boss() ? { slots: boss()!.units.map((_, k) => 1 + k), size: boss()!.size } : undefined,
    });
    game.loose.length = 0;
    // every fighter brings its own spirit shot
    const ids = unitIds();
    game.shooters.forEach((sh, i) => (sh.spiritKind = SPIRIT_OF[baseOf(ids[i] ?? saveData.settings.character)] ?? 'single'));
    game.shooters.forEach((sh, i) => {
      if (sh.active && carry[i]) sh.item = carry[i];
    });
    carry = [];
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
    // a new match starts empty-handed; the next arcade stage keeps your unused item
    carry = carryStage ? [carry[0] ?? null] : [];
    carryStage = false;
    saveRun('start');
    const st = S();
    // local versus: the table from above for both players, their own labels and controls
    document.body.classList.toggle('duo', duo);
    const cam = duo ? 'split' : st.camera;
    document.body.classList.toggle('bdaman', bdaMode);
    // (the special button sits over FIRE on the pad; with gestures it floats on the HUD)
    if (bdaMode) (S().layout === 'buttons' ? document.querySelector('#pad .pad-fire.single')! : $('hud')).prepend($('special-btn'));
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
    view.setCharacters(unitIds(), duo ? undefined : mine(unitIds()[0]));
    fitTable(st);
    // the newer arenas bring their pinball board
    game.setBoard(bdaMode ? null : st.stage);
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
    showHero();
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
    carry = game.shooters.map((sh) => sh.item);
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
    strikeT = 0;
    document.body.classList.remove('cine-on');
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
    saveRun('result');
    awardXp(w);
    if (story) showStoryResult(w);
    $('result').classList.remove('hidden');
    hud.classList.add('hidden');
    sfx.play(w === 0 ? 'win' : 'lose');
    updateRecord();
  };

  /** XP for your fighter: more for a win, a little for every round taken (not in 2 players) */
  const awardXp = (w: -1 | 0 | 1) => {
    const box = $('xp-gain');
    box.classList.toggle('hidden', duo);
    if (duo) return;
    const id = saveData.settings.character;
    const gain = (w === 0 ? 50 : w === -1 ? 30 : 20) + roundWins[0] * 10;
    const before = levelOf(xpOf(id));
    saveData = store.save({ fighterXp: { ...(saveData.fighterXp ?? {}), [id]: xpOf(id) + gain } });
    const after = levelOf(xpOf(id));
    $('xp-name').textContent = characterById(id).name.toUpperCase();
    $('xp-lv').textContent = `LV ${after.lv} · ${after.rank.toUpperCase()}`;
    $('xp-plus').textContent = `+${gain} XP`;
    $('xp-text').textContent = after.need ? `${after.into} / ${after.need} XP to level ${after.lv + 1}` : 'Max level';
    // the bar fills from where it was (from empty after a level up)
    const fill = $('xp-fill');
    const from = after.lv > before.lv ? 0 : before.need ? (before.into / before.need) * 100 : 100;
    fill.style.transition = 'none';
    fill.style.width = `${from}%`;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        fill.style.transition = '';
        fill.style.width = `${after.need ? (after.into / after.need) * 100 : 100}%`;
      }),
    );
    // new rewards go on straight away (they can be swapped back on the Style tab)
    const fresh = rewardsOf(id).filter((r) => r.lv > before.lv && r.lv <= after.lv);
    for (const r of fresh) setEquip(id, r.slot, r.id);
    if (fresh.length) $('xp-text').textContent = `Unlocked: ${fresh.map((r) => r.name).join(' + ')}`;
    if (after.lv > before.lv) setTimeout(() => showToast(`LEVEL UP // ${characterById(id).name.toUpperCase()} LV ${after.lv}${fresh.length ? ` · ${fresh[0].name.toUpperCase()}` : ''}`, 0xffc23d), 700);
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
    // a fighter with a run of its own picks it back up
    if (runOf(saveData.settings.character)) return resumeRun();
    runOwner = saveData.settings.character;
    const plan = rollPlan();
    arcade = { stage: 1, cleared: 0, cfg: plan[0], plan };
    showTower(startMatch);
  };
  /**
   * Keep the run on the save, so closing the app mid-run loses at most the stage being
   * fought: it picks up at the start of that stage (or the next one, after a clear) with the
   * fighter and any unused item.
   */
  // (a save from before runs were per fighter: hand it to its fighter)
  if (saveData.arcadeRun) saveData = store.save({ arcadeRuns: { ...(saveData.arcadeRuns ?? {}), [saveData.arcadeRun.character]: saveData.arcadeRun }, arcadeRun: undefined });
  /** a fighter's own arcade run in progress */
  const runOf = (id: string) => saveData.arcadeRuns?.[id];
  const setRun = (id: string, run: store.ArcadeRun | undefined) => {
    const all = { ...(saveData.arcadeRuns ?? {}) };
    if (run) all[id] = run;
    else delete all[id];
    saveData = store.save({ arcadeRuns: all });
  };
  /** whose run this is (it follows the fighter if you swap mid-run) */
  let runOwner = '';
  const saveRun = (at: 'start' | 'result') => {
    const me = saveData.settings.character;
    if (!arcade || arcade.done) {
      if (runOf(me)) setRun(me, undefined);
      return;
    }
    if (runOwner && runOwner !== me) setRun(runOwner, undefined);
    runOwner = me;
    const won = at === 'result' && !!arcade.next;
    setRun(me, {
      stage: won ? arcade.stage + 1 : arcade.stage,
      cleared: arcade.cleared,
      cfg: won ? arcade.next! : arcade.cfg,
      plan: arcade.plan,
      character: me,
      // (during a stage, the item you brought into it; after a clear, the one you still hold)
      item: at === 'result' ? (won ? player.item : null) : (carry[0] ?? null),
      at: Date.now(),
    });
  };
  /** the Arcade card shows your current fighter's run: Continue, or a new run */
  const showRunOffer = () => {
    const r = runOf(saveData.settings.character);
    $('run-offer').classList.add('hidden');
    $('arcade-go').textContent = r ? `CONTINUE ▶` : 'PLAY ▶';
    $('arcade-sub').textContent = r ? `${characterById(r.character).name}: stage ${r.stage}, ${r.cleared} cleared` : 'A ladder of stages and four bosses';
    document.querySelector('#arcade-btn .card-new-run')!.classList.toggle('hidden', !r);
  };
  const resumeRun = (id = saveData.settings.character) => {
    const r = runOf(id);
    if (!r) return;
    story = null;
    bdaMode = false;
    sfx.unlock();
    selectMode = 'arcade';
    duo = false;
    if (characterById(r.character)) saveData = store.save({ settings: { ...saveData.settings, character: r.character } });
    runOwner = r.character;
    arcade = { stage: r.stage, cleared: r.cleared, cfg: r.cfg, plan: r.plan };
    carry = [(r.item as ItemType | null) ?? null];
    carryStage = true;
    showTower(startMatch);
  };
  $('run-continue').addEventListener('click', () => resumeRun());

  // ---------- story mode: three chapters for each fighter, talk before every fight ----------
  const unitOfBase = (b: string) => playable().find((u) => baseOf(u.id) === b)?.id ?? `${b}-22`;
  const pathOf = (id: string) => STORY_PATHS[baseOf(id)];
  const chOf = (id: string) => saveData.storyCh?.[id] ?? 0;
  const dlg = $('story-dlg');
  let dlgLines: Line[] = [];
  let dlgAt = 0;
  let dlgDone: (() => void) | null = null;
  let dlgHero = '';
  /** one line of the talk: the speaker's face (yours on the left, theirs on the right) */
  const dlgShow = () => {
    const l = dlgLines[dlgAt];
    const narr = l.who === 'narrator';
    const id = narr ? '' : unitOfBase(l.who);
    dlg.dataset.side = narr ? 'narrator' : baseOf(id) === baseOf(dlgHero) ? 'you' : 'them';
    $('dlg-who').textContent = narr ? '' : characterById(id).name;
    $('dlg-text').textContent = l.text;
    const face = $('dlg-face');
    face.innerHTML = narr ? '' : `<i data-portrait="${id}" data-crop="bust"></i>`;
    if (!narr) fillPortraits(face);
    replay($('dlg-text'), 'dlg-in');
    replay(face, 'dlg-pop');
  };
  const dlgEnd = () => {
    dlg.classList.add('hidden');
    const done = dlgDone;
    dlgDone = null;
    done?.();
  };
  const talk = (hero: string, head: string, title: string, lines: Line[], then: () => void) => {
    dlgHero = hero;
    dlgLines = lines;
    dlgAt = 0;
    dlgDone = then;
    $('dlg-ch').textContent = head;
    $('dlg-title').textContent = title;
    for (const k of SCREENS) $(k).classList.add('hidden');
    showHero();
    dlg.classList.remove('hidden');
    sfx.play('whoosh');
    dlgShow();
  };
  dlg.addEventListener('click', (e) => {
    if ((e.target as Element).closest('#dlg-skip')) return dlgEnd();
    sfx.play('tick', 0.5);
    if (++dlgAt >= dlgLines.length) dlgEnd();
    else dlgShow();
  });
  /** a chapter's fight: the opponent on their home turf, a little harder each time */
  const fightChapter = () => {
    if (!story) return;
    const c = pathOf(story.hero).chapters[story.ch];
    const diff = CHAPTER_DIFF[story.ch] ?? 'hard';
    bdaMode = false;
    story.cfg = { enemyCharacter: unitOfBase(c.foe), stage: c.arena, pack: 1, playerPack: 1, items: true, roundTime: 60, difficulty: diff, ...store.DIFFICULTY[diff] };
    arcade = null;
    duo = false;
    selectMode = 'versus';
    fitTable(S());
    startMatch();
  };
  /** talk, then fight (the story's opening comes before the first chapter) */
  const playChapter = () => {
    if (!story) return;
    const p = pathOf(story.hero);
    const c = p.chapters[story.ch];
    const lines = story.ch === 0 ? [...p.intro, ...c.before] : c.before;
    talk(story.hero, `CHAPTER ${story.ch + 1} OF ${p.chapters.length}`, `VS ${characterById(unitOfBase(c.foe)).name.toUpperCase()}`, lines, fightChapter);
  };
  const playStory = () => {
    sfx.unlock();
    const hero = saveData.settings.character;
    if (!pathOf(hero)) return showToast('NO STORY FOR THIS UNIT YET', 0xffc23d);
    const done = chOf(hero) >= pathOf(hero).chapters.length;
    story = { hero, ch: done ? 0 : chOf(hero), cfg: {} };
    playChapter();
  };
  $('story-btn').addEventListener('click', playStory);
  /** the home card: your fighter's chapter, or its finished story */
  const showStoryCard = () => {
    const id = saveData.settings.character;
    const p = pathOf(id);
    const ch = chOf(id);
    const done = p && ch >= p.chapters.length;
    $('story-sub').textContent = !p ? 'No story for this unit yet' : done ? `${p.title} · complete ✓ (play again)` : `${p.title} · chapter ${ch + 1} of ${p.chapters.length}`;
    $('story-go').textContent = done ? 'REPLAY ▶' : ch > 0 ? 'CONTINUE ▶' : 'PLAY ▶';
  };
  /** the result screen in story mode: chapter clear (and on to the next), or try again */
  const showStoryResult = (w: -1 | 0 | 1) => {
    if (!story) return;
    const p = pathOf(story.hero);
    $('arcade-next').classList.add('hidden');
    $('arcade-swap').classList.add('hidden');
    if (w === 0) {
      story.ch++;
      saveData = store.save({ storyCh: { ...(saveData.storyCh ?? {}), [story.hero]: Math.max(chOf(story.hero), story.ch) } });
      $('result-title').textContent = story.ch >= p.chapters.length ? 'STORY CLEAR' : `CHAPTER ${story.ch} CLEAR`;
      $('again-btn').textContent = story.ch >= p.chapters.length ? 'SEE THE ENDING ▶' : 'NEXT CHAPTER ▶';
    } else {
      $('result-title').textContent = w === 1 ? 'TRY AGAIN' : 'DRAW';
      $('again-btn').textContent = 'RETRY CHAPTER';
    }
    $('result-sub').textContent = `STORY // ${p.title.toUpperCase()}`;
    storyWon = w === 0;
  };
  let storyWon = false;
  const storyNext = () => {
    if (!story) return;
    const p = pathOf(story.hero);
    if (!storyWon) return fightChapter();
    if (story.ch < p.chapters.length) return playChapter();
    // the ending, and a bonus for finishing
    const hero = story.hero;
    talk(hero, 'THE END', p.title.toUpperCase(), p.ending, () => {
      saveData = store.save({ fighterXp: { ...(saveData.fighterXp ?? {}), [hero]: xpOf(hero) + STORY_BONUS } });
      quitArcade();
      showToast(`STORY COMPLETE // +${STORY_BONUS} XP`, 0xffc23d);
    });
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
    if (story) return storyNext();
    // after the final boss, a new run from stage 1
    if (arcade?.done) {
      startArcade();
      return;
    }
    if (arcade?.next) {
      carryStage = true;
      arcade.stage++;
      arcade.cfg = arcade.next;
      arcade.next = undefined;
    }
    if (arcade) showTower(startMatch);
    else startMatch();
  };
  /** leave the arcade run: back to the title with your own table */
  const quitArcade = () => {
    // (the run stays saved: Continue on the title picks it back up)
    arcade = null;
    story = null;
    bdaMode = false;
    document.body.classList.remove('bdaman');
    $('loose-count').classList.add('hidden');
    showRunOffer();
    screen = 'title';
    show('title');
    fitTable(S());
    applySettings();
  };

  /** Per-frame timeline for the intro, the replay and the finale. */
  // ---------- B-Daman mode: the spirit shot ----------
  const MOVE_NAMES: Record<string, string> = {
    angel: 'ZERO EXCALIBUR', dragon: 'DINO FORCE CANNON', pioneer: 'SIREN BUSTER', liberty: 'DEEP DIVE RAIL', monoceros: 'GENIUS TWIN BLAST', baron: 'CRIMSON LOOP DIVE', bastion: 'SCYTHE CROSS',
    nightshade: 'ECLIPSE FALL', violet: 'SILVERBACK QUAKE', kabuto: 'ROYAL ROAR', tyrant: 'HELLHOUND CERBERUS', rex: 'FROST BITE', liger: 'FANG RICOCHET', ember: 'BLOSSOM BURST',
  };
  /** each fighter's own spirit shot */
  const SPIRIT_OF: Record<string, SpiritKind> = {
    angel: 'triple', dragon: 'giant', pioneer: 'barrage', liberty: 'rail', monoceros: 'twin', baron: 'dive', bastion: 'cross',
    nightshade: 'zigzag', violet: 'quake', kabuto: 'split', tyrant: 'chain', rex: 'frost', liger: 'ricochet', ember: 'drain',
  };
  let specialTap = false;
  $('special-btn').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    specialTap = true;
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyX' && bdaMode) specialTap = true;
  });
  /** each tick: only the SPECIAL button (or X) calls the spirit shot, when you choose; a direction
   *  held as you press it bends the shot that way */
  const pollSpecial = () => {
    if (!bdaMode || flow !== 'round' || duo) return;
    const dir = Math.sign(player.moveAxis) || (Math.abs(player.vx) > 1.5 ? Math.sign(player.vx) : 0);
    if (specialTap && player.spirit >= 100) game.beginSpecial(player, dir);
    specialTap = false;
  };
  const sfxEl = $('special-fx');
  /** how long the spirit shot's cinematic runs before the shot leaves */
  const SPECIAL_CINE = 2.8;
  /** then the strike itself: the shot leaves in slow motion, framed close on the robot's move */
  const STRIKE = { time: 1.2, scale: 0.28 };
  let strikeT = 0;
  const startSpecial = (slot: number) => {
    flow = 'special';
    flowT = 0;
    const s = game.shooters[slot];
    const id = unitIds()[slot] ?? saveData.settings.character;
    view.cine = { kind: 'special', t: 0, shot: -1, slot };
    // the HUD and the controls step aside for the whole cinematic, strike shot included
    document.body.classList.add('cine-on');
    $('sfx-who').textContent = `${characterById(id).name.toUpperCase()}${s.team === 0 ? '' : ' // CPU'} // ${SPIRIT_MOVES[s.spiritKind].label.toUpperCase()}`;
    $('sfx-name').textContent = (MOVE_NAMES[baseOf(id)] ?? 'SPIRIT SHOT') + '!';
    $('sfx-face').innerHTML = `<i data-portrait="${id}" data-crop="bust"></i>`;
    fillPortraits($('sfx-face'));
    sfxEl.classList.toggle('foe', s.team !== 0);
    sfxEl.classList.remove('hidden');
    replay(sfxEl, 'go');
    sfx.play('charge');
    if (S().vibrate) buzz([30, 40, 60]);
  };
  const updateFlow = (dt: number) => {
    if (flow === 'special') {
      flowT += dt;
      if (flowT >= SPECIAL_CINE) {
        sfxEl.classList.add('hidden');
        // (the cinematic carries on into its strike shot while the game runs slow)
        flow = 'round';
        strikeT = STRIKE.time;
        game.releaseSpecial();
        sfx.play('super');
        view.shake(0.7);
        if (S().vibrate) buzz(90);
      }
      return;
    }
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
      // (a loss holds on your robot blowing apart before the camera climbs away)
      const lost = !duo && matchWinner === 1;
      if (flowT > (lost ? 2.8 : 1.6) && lastCount !== -9) {
        lastCount = -9;
        showBanner(duo ? (matchWinner === -1 ? 'DRAW' : `PLAYER ${matchWinner + 1} WINS`) : matchWinner === 0 ? 'YOU WIN' : matchWinner === 1 ? 'YOU LOSE' : 'DRAW', true);
      }
      if (flowT > (lost ? 5.8 : 4.6)) endMatch();
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

  // Versus from home: straight into a match with your fighter, your last rival and arena;
  // Customise walks the steps instead
  const quickMatch = () => {
    sfx.unlock();
    story = null;
    bdaMode = false;
    selectMode = 'versus';
    arcade = null;
    duo = false;
    startMatch();
  };
  // B-Daman mode: a one-on-one with your fighter, marbles to pick up, the B-Daspirit gauge
  $('bda-btn').addEventListener('click', () => {
    sfx.unlock();
    story = null;
    arcade = null;
    duo = false;
    selectMode = 'versus';
    bdaMode = true;
    startMatch();
    setTimeout(() => showToast('SLIDE INTO YOUR AMMO BOX TO RELOAD // SHOOT THEIRS TO BREAK IT // SPECIAL WHEN YOU CHOOSE', 0xffc23d), 900);
  });
  $('play-btn').addEventListener('click', (e) => {
    if ((e.target as Element).closest('.card-custom')) openSelect('versus');
    else quickMatch();
  });
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
  $('arcade-btn').addEventListener('click', (e) => {
    const mine = runOf(saveData.settings.character);
    if (mine && (e.target as Element).closest('.card-new-run')) {
      setRun(saveData.settings.character, undefined);
      showRunOffer();
      openSelect('arcade');
    } else if (mine) resumeRun();
    else openSelect('arcade');
  });
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
      view.setCharacters(unitIds(), duo ? undefined : mine(unitIds()[0]));
      view.setStage(st.stage);
    }
    view.showAimLine = st.aimLine;
    view.fxOn = st.effects;
    view.setQuality(st.realism, !!st.batterySaver);
    CEL.on = st.cel !== false;
    $('fps').classList.toggle('hidden', !st.showFps);
    // (local versus keeps its overhead view for the whole match)
    const cam = duo && screen !== 'title' ? 'split' : st.camera;
    if (view.cameraMode !== cam) {
      view.cameraMode = cam;
      view.resize();
    }
    document.body.classList.toggle('triple', st.fireButtons === 'triple');
    $('view-btn').textContent = VIEW_LABEL[st.camera];
    $('title-unit').textContent = characterById(saveData.settings.character).name.toUpperCase();
    $('title-lv').innerHTML = lvHtml(saveData.settings.character);
    showRunOffer();
    showStoryCard();
    $('title-unit').className = plateClass(saveData.settings.character);
    const nx = nextReward(saveData.settings.character);
    $('title-next').textContent = nx ? `NEXT AT LV ${nx.lv}: ${nx.name.toUpperCase()}` : 'ALL REWARDS UNLOCKED';
    showHero();
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
      // Difficulty sets the whole opponent; tuning one part of it by hand makes it custom
      if (key === 'difficulty') saveSetting({ difficulty: value, ...store.DIFFICULTY[value as 'easy'] } as Partial<store.Settings>);
      else if (['enemyIQ', 'enemyHealth', 'enemySpeed', 'enemyAgility', 'enemyPower'].includes(key)) saveSetting({ [key]: value, difficulty: 'custom' } as Partial<store.Settings>);
      else saveSetting({ [key]: value } as Partial<store.Settings>);
    }),
  );
  $('reset-opponent').addEventListener('click', () => saveSetting({ ...store.OPPONENT_DEFAULTS, difficulty: 'normal' }));
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
  preview.turnable = false;
  preview.cel = true;
  // the arena step: the top of the screen takes the colour of the arena's sky
  preview.onSky = (css) => {
    if (step === 'arena') $('select').style.setProperty('--top', css);
  };
  type Step = 'fighter' | 'rival' | 'arena' | 'rules';
  let step: Step = 'fighter';
  let selectMode: 'versus' | 'arcade' | 'duo' | 'home' = 'versus';

  const TRAITS: [keyof NonNullable<ReturnType<typeof characterById>['traits']>, string][] = [
    ['health', 'Armour'],
    ['speed', 'Speed'],
    ['fireRate', 'Fire rate'],
    ['agility', 'Agility'],
  ];
  /** what a fighter is like, in two or three big badges (not a wall of pips) */
  /** the fighter's B-Daman special: its move name, the kind of shot, what it does */
  const specialCard = (id: string) => {
    const base = baseOf(id);
    const kind = SPIRIT_OF[base] ?? 'single';
    const mv = SPIRIT_MOVES[kind];
    return `<div class="sp-move"><span class="sp-tag">★ Special</span><b>${MOVE_NAMES[base] ?? 'SPIRIT SHOT'}</b><span class="sp-kind">${mv.label} · ${mv.desc}</span></div>`;
  };
  const meters = (id: string) => {
    const t = characterById(id).traits;
    const v = (k: (typeof TRAITS)[number][0]) => Math.max(1, Math.min(5, Math.round(t?.[k] ?? 3)));
    const out: [string, string][] = [];
    if (v('health') >= 4) out.push(['🛡', 'Tanky']);
    if (v('speed') >= 4) out.push(['⚡', 'Fast']);
    if (v('fireRate') >= 4) out.push(['🔥', 'Rapid fire']);
    if (v('agility') >= 4) out.push(['🌀', 'Nimble']);
    if (v('health') <= 2) out.push(['🎯', 'Glass cannon']);
    if (v('speed') <= 2) out.push(['🐢', 'Slow']);
    const mb = marbleOf(id);
    if (mb.type === 'heavy') out.push(['💥', 'Heavy marbles']);
    else if (mb.type === 'light') out.push(['🪶', 'Light marbles']);
    else if (mb.type === 'bouncy') out.push(['🏀', 'Bouncy marbles']);
    if (out.length < 2) out.unshift(['⚖', 'All-rounder']);
    const mag = S().magPer === false ? magazine() : mb.mag;
    return `<div class="badges">${out
      .slice(0, 3)
      .map(([i, l]) => `<span class="badge"><i>${i}</i>${l}</span>`)
      .join('')}</div><p class="badge-note">${mb.name} marbles · ${mag} per load</p>${specialCard(id)}`;
  };
  const markSteps = () => {
    const order: Step[] = selectMode === 'arcade' || selectMode === 'home' ? ['fighter'] : ['fighter', 'rival', 'arena', 'rules'];
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
  let infoTab: 'stats' | 'profile' | 'style' = 'stats';
  /** one page, no tabs: traits, then the story, then (for your own fighter) its style */
  const showInfo = () => {
    $('info-tabs').classList.add('hidden');
    $('pv-stats').classList.remove('hidden');
    $('pv-profile').classList.remove('hidden');
    $('pv-style').classList.toggle('hidden', step !== 'fighter');
  };
  /** the Style tab: each slot's unlocked looks to pick from, the locked ones showing their level */
  const showStyle = (id: string) => {
    const e = equipOf(id);
    const slots: Slot[] = ['paint', 'marble', 'eyes', 'plate'];
    // the customizer: this fighter's own parts, free to swap
    const kit = kitOf(characterById(id));
    const gearRows = kit
      ? (['hat', 'back', 'shoulder'] as const)
          .map((slot) => {
            const pill = (v: string, label: string) => `<button class="style-opt${(e[slot] ?? '') === v ? ' on' : ''}" data-slot="${slot}" data-v="${v}">${label}</button>`;
            return `<div class="style-row"><span>${SLOT_NAME[slot]}</span><div>${pill('', 'None')}${kit[slot].map((a) => pill(a.id, a.name)).join('')}</div></div>`;
          })
          .join('')
      : '';
    $('pv-style').innerHTML = (gearRows ? `<p class="style-sub">PARTS</p>` + gearRows : '') + `<p class="style-sub">REWARDS</p>` + slots
      .map((slot) => {
        const opts = rewardsOf(id).filter((r) => r.slot === slot);
        const pill = (v: string, label: string, ok: boolean, lv?: number) =>
          `<button class="style-opt${(e[slot] ?? '') === v ? ' on' : ''}${ok ? '' : ' locked'}" data-slot="${slot}" data-v="${v}" ${ok ? '' : 'disabled'}>${ok ? label : `🔒 LV ${lv}`}</button>`;
        return `<div class="style-row"><span>${SLOT_NAME[slot]}</span><div>${pill('', 'Standard', true)}${opts.map((r) => pill(r.id, r.name.replace(/ (paint|marbles|eyes|nameplate)$/i, ''), unlocked(id, r), r.lv)).join('')}</div></div>`;
      })
      .join('');
    $('pv-style')
      .querySelectorAll<HTMLButtonElement>('.style-opt:not(.locked)')
      .forEach((b) =>
        b.addEventListener('click', () => {
          setEquip(id, b.dataset.slot as Slot, b.dataset.v || undefined);
          sfx.play('tick', 0.5);
          preview.showUnit(id, mine(id));
          showStyle(id);
          applySettings();
        }),
      );
  };
  document.querySelectorAll<HTMLElement>('#info-tabs button').forEach((b) =>
    b.addEventListener('click', () => {
      infoTab = b.dataset.info as typeof infoTab;
      showInfo();
      if (infoTab === 'stats') replay($('pv-stats'), 'refill');
      if (infoTab === 'style') showStyle(saveData.settings.character);
    }),
  );
  /** the carousel: everything this step can show, and the one in the middle */
  type Entry = { id: string; color: string; lock?: string };
  let entries: Entry[] = [];
  let cur = 0;
  const lockText = (e: Entry) => (e.lock === 'Opponent' ? 'Your opponent this stage' : `Unlocks at ${e.lock}`);
  /** the neighbours peeking in from either side */
  const showPeeks = () => {
    const n = entries.length;
    for (const [el, d] of [
      [$('peek-prev'), -1],
      [$('peek-next'), 1],
    ] as const) {
      el.classList.toggle('hidden', n < 2);
      const e = entries[(cur + d + n) % n];
      if (!e || n < 2) continue;
      if (step === 'arena') el.innerHTML = `<i class="shot" style="background:center / cover url(${preview.stageShot(e.id)})"></i>`;
      else if (e.id === 'auto') el.innerHTML = `<i class="auto">?</i>`;
      else el.innerHTML = `<i class="${e.lock ? 'dark' : ''}"><i data-portrait="${e.id}"></i></i>`;
    }
    fillPortraits($('carousel'));
  };
  const showPreview = (dir = 0) => {
    const e = entries[cur];
    const id = e?.id ?? chosen();
    const locked = !!e?.lock;
    const car = $('carousel');
    car.classList.toggle('arena', step === 'arena');
    car.classList.toggle('locked', locked);
    // (the screen carries the side too: the buttons' bar takes the band's colour)
    car.dataset.side = $('select').dataset.side = step === 'arena' ? 'arena' : step === 'fighter' ? 'p1' : 'p2';
    // the new one slides in from the side it came from; the name band flashes
    replay($('preview'), dir < 0 ? 'from-left' : dir > 0 ? 'from-right' : 'switch');
    replay($('car-band'), 'flash');
    replay($('pv-stats'), 'refill');
    $('car-count').textContent = entries.length > 1 ? `${cur + 1} / ${entries.length}` : '';
    $('car-lock').classList.toggle('hidden', !locked);
    if (e && locked) $('car-lock-text').textContent = lockText(e);
    ($('select-next') as HTMLButtonElement).disabled = locked;
    if (selectMode === 'arcade' && !arcadeSwap && step === 'fighter') {
      const r = e && runOf(e.id);
      $('select-next').textContent = r ? `Continue stage ${r.stage} ▶` : 'Start arcade ▶';
    }
    showPeeks();
    if (step !== 'arena') $('select').style.removeProperty('--top');
    if (step === 'arena') {
      preview.showStage(id);
      $('pv-tag').textContent = 'ARENA';
      $('pv-name').textContent = stageById(id).name;
      $('pv-stats').innerHTML = `<p class="pv-note">Scenery and pucks themed to match</p>`;
      $('pv-profile').classList.add('hidden');
      $('pv-style').classList.add('hidden');
      $('pv-stats').classList.remove('hidden');
      $('info-tabs').classList.add('hidden');
      return;
    }
    const unit = id === 'auto' ? enemyCharacter() : id;
    // (a locked fighter isn't shown in 3D: only its portrait, blacked out)
    if (locked) {
      $('car-shadow').innerHTML = `<i data-portrait="${unit}"></i>`;
      fillPortraits($('car-lock'));
    } else preview.showUnit(unit, step === 'fighter' ? mine(unit) : undefined);
    $('pv-tag').textContent = step === 'fighter' ? `PLAYER 1 · LV ${levelOf(xpOf(unit)).lv}` : selectMode === 'duo' ? 'PLAYER 2' : id === 'auto' ? 'RIVAL · AUTO' : 'RIVAL';
    if (locked && e) {
      // a locked fighter is only a silhouette until it's won
      $('pv-name').textContent = e.lock === 'Opponent' ? characterById(unit).name : '???';
      $('pv-stats').innerHTML = `<p class="pv-note">${e.lock === 'Opponent' ? 'Pick someone else to retry the stage' : 'Climb the arcade ladder to win it'}</p>`;
      $('pv-profile').classList.add('hidden');
      $('pv-style').classList.add('hidden');
      $('pv-stats').classList.remove('hidden');
      $('info-tabs').classList.add('hidden');
      return;
    }
    $('pv-name').textContent = id === 'auto' ? 'Auto' : characterById(unit).name;
    $('pv-stats').innerHTML = meters(unit);
    const c = characterById(unit);
    const pr = profileOf(c.id, c.from, c.base);
    const prof = $('pv-profile');
    showInfo();
    const sto = storyOf(c.id, c.from, c.base);
    prof.innerHTML = pr
      ? `<div class="pf-head"><b>${pr.role}</b><span>${pr.origin}</span></div>${
          sto
            ? `<p class="pf-quote">“${sto.quote}”</p><p class="pf-who">${sto.personality}</p><p>${sto.story}</p><div class="pf-tags"><em>Rival · ${characterById(playable().find((u) => baseOf(u.id) === sto.rival)?.id ?? sto.rival).name}</em><em>Best at · ${pr.specialty}</em></div>`
            : `<p>${pr.bio}</p><div class="pf-tags"><em>Style · ${pr.style}</em><em>Best at · ${pr.specialty}</em></div>`
        }`
      : `<div class="pf-head"><b>Custom unit</b><span>Unit Lab</span></div><p>Built in the Unit Lab.</p>`;
    if (step === 'fighter') showStyle(unit);
    $('pv-name').className = step === 'fighter' ? plateClass(unit) : '';
  };
  /** move to an entry: a pickable one becomes the choice straight away */
  const goTo = (i: number, dir = 0) => {
    const n = entries.length;
    if (!n) return;
    cur = ((i % n) + n) % n;
    const e = entries[cur];
    if (!e.lock) saveSetting(step === 'fighter' ? { character: e.id } : step === 'rival' ? { enemyCharacter: e.id } : { stage: e.id });
    const strip = $('pick-grid');
    strip.querySelectorAll<HTMLElement>('.tile').forEach((t, k) => t.classList.toggle('on', k === cur));
    strip.children[cur]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: dir ? 'smooth' : 'auto' });
    showPreview(dir);
  };
  const go = (d: number) => {
    if (entries.length < 2) return;
    sfx.unlock();
    sfx.play('tick', 0.5);
    buzz(6);
    goTo(cur + d, d);
  };
  const buildGrid = () => {
    const grid = $('pick-grid');
    grid.innerHTML = '';
    entries = [];
    const arena = step === 'arena';
    $('arena-width').classList.toggle('hidden', !arena);
    grid.classList.toggle('arenas', arena);
    // the strip under the carousel: every entry as a thumbnail, to jump straight to one
    const tile = (e: Entry, html: string) => {
      const k = entries.length;
      entries.push(e);
      const b = document.createElement('button');
      b.className = 'tile' + (e.lock ? ' locked' : '');
      b.dataset.id = e.id;
      b.style.setProperty('--i', String(k));
      b.setAttribute('aria-label', e.lock ? 'Locked' : e.id);
      b.innerHTML = html;
      b.addEventListener('click', () => goTo(k, k === cur ? 0 : k < cur ? -1 : 1));
      grid.appendChild(b);
    };
    const foes = arcadeFoes();
    if (arena) {
      for (const st of STAGES) tile({ id: st.id, color: hexc(st.swatch[0]) }, `<i class="swatch" style="background:linear-gradient(160deg, ${hexc(st.swatch[0])} 0 62%, ${hexc(st.swatch[1])} 62%)"></i>`);
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
    } else {
      if (step === 'rival' && selectMode !== 'duo') tile({ id: 'auto', color: '#3a3631' }, `<i class="auto">?</i>`);
      // one roster: the fighters, then any custom units from the Unit Lab
      for (const c of playable()) {
        const color = hexc(c.palette.body);
        // the arcade's bosses stay a surprise: they can't be picked for a run
        if (selectMode === 'arcade' && isBossUnit(c.id) && !(arcadeSwap && foes.has(baseOf(c.id)))) continue;
        // retrying a stage: the opponent waiting there shows, but can't be your pick
        if (arcadeSwap && step === 'fighter' && foes.has(baseOf(c.id))) tile({ id: c.id, color, lock: 'Opponent' }, `<i><i data-portrait="${c.id}" data-crop="bust"></i></i><em class="lock">⚔</em>`);
        // a locked unit shows (so there's something to chase) but can't be picked
        else if (isLocked(c.id)) tile({ id: c.id, color, lock: `arcade stage ${unlockStage(c.id)}` }, `<i class="dark"><i data-portrait="${c.id}" data-crop="bust"></i></i><em class="lock">🔒</em>`);
        else tile({ id: c.id, color }, `<i><i data-portrait="${c.id}" data-crop="bust"></i></i>`);
      }
      fillPortraits(grid);
    }
    cur = Math.max(0, entries.findIndex((e) => e.id === chosen()));
    goTo(cur);
  };
  // the arrows, peeks and lock sit over the preview itself (centred on the fighter, whatever the band's height)
  for (const id of ['peek-prev', 'peek-next', 'car-lock', 'car-prev', 'car-next']) $('preview').appendChild($(id));
  $('car-prev').addEventListener('click', () => go(-1));
  $('car-next').addEventListener('click', () => go(1));
  $('peek-prev').addEventListener('click', () => go(-1));
  $('peek-next').addEventListener('click', () => go(1));
  // swipe the carousel left and right to flip through
  {
    const car = $('carousel');
    let sx: number | null = null;
    let sy = 0;
    car.addEventListener('pointerdown', (e) => {
      if ((e.target as Element).closest('button, .car-info')) return;
      sx = e.clientX;
      sy = e.clientY;
    });
    car.addEventListener('pointerup', (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(e.clientY - sy)) go(dx < 0 ? 1 : -1);
    });
    car.addEventListener('pointercancel', () => (sx = null));
  }
  // ---------- home: your fighter (the last one played) as the hero, the modes as cards ----------
  const hero = new Preview($('title-hero'));
  hero.hero = true;
  hero.turnable = false;
  let heroId = '';
  /** the hero runs only while the home screen is up */
  const showHero = () => {
    if ($('title').classList.contains('hidden')) {
      if (heroId) hero.release();
      heroId = '';
      return;
    }
    const id = saveData.settings.character;
    const key = id + equipKey(equipOf(id));
    if (heroId !== key) {
      heroId = key;
      hero.showUnit(id, mine(id));
    }
  };
  // the tutorial card leads the row (with its NEW badge) until it's been played, then goes last
  if (saveData.tutorialDone) {
    $('home-cards').appendChild($('tut-card'));
    $('tut-card').querySelector('.new-badge')!.remove();
  }
  $('tut-card').addEventListener('click', () => startTutorial());
  // tap your fighter (or its name) to pick another
  for (const el of [$('title-hero'), document.querySelector<HTMLElement>('.home-name')!]) el.addEventListener('click', () => openSelect('home'));
  const cards = [...document.querySelectorAll<HTMLElement>('#home-cards .mode-card')];
  let cardIdx = 0;
  // every card the same wide rectangle; the one scrolled to the middle is the mode, and a tap on
  // it plays (a tap on another slides that one to the middle)
  cards.forEach((c) => c.classList.add('on'));
  const row = $('home-cards');
  const centre = (k: number, smooth = true) => {
    const c = cards[k];
    row.scrollTo({ left: c.offsetLeft - (row.clientWidth - c.offsetWidth) / 2, behavior: smooth ? 'smooth' : 'auto' });
  };
  const markActive = () => {
    const mid = row.scrollLeft + row.clientWidth / 2;
    let best = 0;
    cards.forEach((c, k) => {
      if (Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) < Math.abs(cards[best].offsetLeft + cards[best].offsetWidth / 2 - mid)) best = k;
    });
    cardIdx = best;
    cards.forEach((c, k) => c.classList.toggle('sel', k === best));
  };
  row.addEventListener('scroll', markActive, { passive: true });
  const focusCard = (i: number, smooth = true) => {
    cardIdx = (i + cards.length) % cards.length;
    centre(cardIdx, smooth);
  };
  row.addEventListener(
    'click',
    (e) => {
      const c = (e.target as Element).closest<HTMLElement>('.mode-card');
      const k = c ? cards.indexOf(c) : -1;
      if (k < 0 || k === cardIdx) return;
      e.preventDefault();
      e.stopPropagation();
      focusCard(k);
    },
    { capture: true },
  );
  fillPortraits($('home-cards'));
  // (a saved arcade run: its card in the middle)
  requestAnimationFrame(() => {
    centre(runOf(saveData.settings.character) ? cards.indexOf($('arcade-btn')) : 0, false);
    markActive();
  });

  const SCREENS = ['title', 'select', 'setup', 'result', 'paused', 'settings'];
  const show = (id: string) => {
    for (const k of SCREENS) $(k).classList.toggle('hidden', k !== id);
    if (id !== 'select') preview.release();
    showHero();
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
    $('select-title').textContent =
      step === 'fighter' ? (selectMode === 'duo' ? 'Player 1 fighter' : 'Select fighter') : step === 'rival' ? (selectMode === 'duo' ? 'Player 2 fighter' : 'Select rival') : 'Select arena';
    $('select-next').textContent = arcadeSwap ? `Retry stage ${arcade?.stage ?? ''} ▶` : selectMode === 'arcade' ? 'Start arcade ▶' : selectMode === 'home' ? 'Use this fighter ✓' : 'Next ▶';
    if (selectMode === 'home') $('select-title').textContent = 'Your fighter';
    if (arcadeSwap) $('select-title').textContent = 'Change fighter';
    buildGrid();
  };
  const openSelect = (mode: 'versus' | 'arcade' | 'duo' | 'home') => {
    sfx.unlock();
    story = null;
    bdaMode = false;
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
    showRunOffer();
    screen = 'title';
    duo = false;
    document.body.classList.remove('duo');
    applySettings();
  };
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
    // picked from home: that's the fighter now, back home to see it
    if (selectMode === 'home') {
      preview.release();
      toTitle();
      return;
    }
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
  // Options opens on the basics; the full set of tabs comes out with More settings
  showTab('basics');
  $('more-settings').addEventListener('click', () => {
    $('settings').classList.add('expert');
    showTab('controls');
  });
  applySettings();

  let settingsFrom: 'title' | 'paused' | 'result' = 'title';
  const openSettings = (from: 'title' | 'paused' | 'result') => {
    settingsFrom = from;
    for (const k of SCREENS) $(k).classList.add('hidden');
    $('settings').classList.remove('hidden');
    showHero();
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
      const key = (e.target as Element | null)?.closest?.('.key, .tile, .mode-card, .seg button, .ver-tabs button, .tabs button, .icon-btn');
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
  $('pause-menu-btn').addEventListener('click', () => leaveMatch());
  /** back to the title from a match (or the tutorial) */
  const leaveMatch = () => {
    if (tut) endTutorial();
    paused = false;
    sfx.resume();
    pad.clear();
    replayEl.classList.add('hidden');
    introEl.classList.add('hidden');
    replayGame = null;
    view.game = game;
    view.cine = null;
    strikeT = 0;
    document.body.classList.remove('cine-on');
    controls(false);
    input.release();
    hud.classList.add('hidden');
    quitArcade();
  };

  // ---------- the tutorial: six steps in a practice match, each done by doing it ----------
  type TutStep = { title: string; text: string; ai?: boolean; check: () => boolean; hard?: boolean };
  const tutEl = $('tut');
  const TUT: TutStep[] = [
    { title: 'Move', text: 'Slide along your rail: hold ◀ or ▶ (with gestures, drag your left thumb).', check: () => !!tut && tut.moved > 3 },
    { title: 'Fire', text: 'Tap FIRE to shoot a marble down the lane.', check: () => !!tut && player.shots - tut.shots0 >= 3 },
    { title: 'Charge shot', text: 'Hold FIRE to load marbles into one big shot, then let go.', check: () => !!tut && tut.charged },
    { title: 'Shield', text: 'Pull your move thumb back toward you to raise the shield. A marble that hits it is caught: one more in your magazine.', check: () => !!tut && tut.shield > 0.8 },
    { title: 'Parry', text: 'Your rival is shooting now. Raise the shield just as a marble arrives and it flies back, harder.', ai: true, hard: true, check: () => false },
    { title: 'Land hits', text: 'Put it together: line up with your rival, dodge, shield and land 3 hits. Tip: a shot that bounces off a wall on the way hits harder, more for every bounce.', ai: true, hard: true, check: () => !!tut && player.hits - tut.hits0 >= 3 },
  ];
  const tutStepNow = () => TUT[Math.min(tut?.i ?? 0, TUT.length - 1)];
  const tutShow = () => {
    if (!tut) return;
    const step = TUT[tut.i];
    tutEl.classList.remove('hidden', 'done');
    tutEl.querySelector('.tut-step')!.textContent = `STEP ${tut.i + 1} / ${TUT.length}`;
    tutEl.querySelector('.tut-title')!.textContent = step.title;
    tutEl.querySelector('.tut-text')!.textContent = step.text;
    tutEl.querySelector<HTMLElement>('.tut-bar i')!.style.width = `${(tut.i / TUT.length) * 100}%`;
    tutEl.querySelector('.tut-next')!.classList.add('hidden');
    tutEl.querySelector('.tut-next')!.textContent = 'Next ▸';
    tutEl.querySelector('.tut-skip')!.textContent = 'Skip tutorial';
    tut.t = 0;
    tut.shots0 = player.shots;
    tut.hits0 = player.hits;
    tutLoaded = false;
    replay(tutEl, 'pop');
  };
  const tutAdvance = () => {
    if (!tut) return;
    sfx.play('charge');
    if (S().vibrate) buzz([15, 30, 15]);
    tut.i++;
    if (tut.i < TUT.length) {
      callout('NICE!', 'cyan');
      tutShow();
      return;
    }
    // all done: the way out
    tut.done = true;
    callout("YOU'RE READY", 'gold');
    tutEl.classList.add('done');
    tutEl.querySelector('.tut-step')!.textContent = 'TUTORIAL COMPLETE';
    tutEl.querySelector('.tut-title')!.textContent = "You're ready!";
    tutEl.querySelector('.tut-text')!.textContent = 'That is everything you need. Now win a real fight: Arcade is a ladder of rivals and bosses.';
    tutEl.querySelector<HTMLElement>('.tut-bar i')!.style.width = '100%';
    const next = tutEl.querySelector('.tut-next')!;
    next.textContent = 'Play Arcade ▸';
    next.classList.remove('hidden');
    tutEl.querySelector('.tut-skip')!.textContent = 'Main menu';
    saveData = store.save({ tutorialDone: true });
  };
  /** every frame of the practice match: track what's been done, and nobody goes down */
  const tutTick = (dt: number) => {
    if (!tut || tut.done) return;
    tut.t += dt;
    tut.moved += Math.abs(player.x - tut.lastX);
    tut.lastX = player.x;
    if (player.shieldUp) tut.shield += dt;
    // a charge: marbles loaded (then let go: see tutFx)
    if (player.stored >= 2) tutLoaded = true;
    for (const s of [player, game.shooters[1]]) s.health = Math.max(s.health, s.maxHealth * (s === player ? 0.4 : 0.25));
    // the hard steps can be passed after a while
    if (tutStepNow().hard && tut.t > 22) tutEl.querySelector('.tut-next')!.classList.remove('hidden');
    if (tutStepNow().check()) tutAdvance();
  };
  let tutLoaded = false;
  const tutFx = (f: (typeof game.fx)[number]) => {
    if (!tut || tut.done) return;
    const i = tut.i;
    if (f.type === 'muzzle' && f.slot === 0 && player.stored === 0 && tutLoaded) tut.charged = true;
    if (f.type === 'super-fire' && f.slot === 0 && i === 2) tut.charged = true;
    if (i === 4 && f.type === 'parry' && f.slot === 0) tutAdvance();
  };
  const startTutorial = () => {
    sfx.unlock();
    $('tut-offer').classList.add('hidden');
    arcade = null;
    duo = false;
    story = null;
    bdaMode = false;
    tut = { i: 0, t: 0, moved: 0, lastX: 0, shots0: 0, hits0: 0, charged: false, shield: 0, done: false };
    startMatch();
    tut.lastX = player.x;
    tutShow();
  };
  const endTutorial = () => {
    tut = null;
    tutEl.classList.add('hidden');
    if (!saveData.tutorialDone) saveData = store.save({ tutorialDone: true });
  };
  tutEl.querySelector('.tut-next')!.addEventListener('click', () => {
    if (!tut) return;
    if (tut.done) {
      leaveMatch();
      openSelect('arcade');
    } else tutAdvance();
  });
  tutEl.querySelector('.tut-skip')!.addEventListener('click', () => leaveMatch());
  $('tut-start').addEventListener('click', startTutorial);
  $('tut-later').addEventListener('click', () => {
    $('tut-offer').classList.add('hidden');
    saveData = store.save({ tutorialDone: true });
  });
  // install as an app: Android shows its own prompt; iPhone Safari needs Share > Add to Home Screen
  const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  $('install-row').classList.toggle('hidden', standalone);
  $('install-btn').addEventListener('click', async () => {
    const w = window as unknown as { __installPrompt?: Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } };
    if (w.__installPrompt) {
      await w.__installPrompt.prompt();
      const choice = await w.__installPrompt.userChoice;
      if (choice.outcome === 'accepted') $('install-row').classList.add('hidden');
      w.__installPrompt = undefined;
      return;
    }
    $('install-text').textContent = ios
      ? 'In Safari, tap the Share button (the square with an arrow), then Add to Home Screen.'
      : 'Open your browser menu and choose Install app (or Add to Home screen).';
  });
  $('replay-tutorial').addEventListener('click', () => {
    $('settings').classList.add('hidden');
    startTutorial();
  });
  // the first visit offers the tutorial on the title screen
  $('tut-offer').classList.toggle('hidden', !!saveData.tutorialDone);
  showRunOffer();

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
    if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && screen !== 'playing' && !$('select').classList.contains('hidden')) go(e.code === 'ArrowLeft' ? -1 : 1);
    if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && !$('title').classList.contains('hidden')) focusCard(cardIdx + (e.code === 'ArrowLeft' ? -1 : 1));
    if ((e.code === 'Enter' || e.code === 'Space') && screen !== 'playing') {
      e.preventDefault();
      if (!$('setup').classList.contains('hidden')) $('fight-btn').click();
      else if (!$('select').classList.contains('hidden')) $('select-next').click();
      else if (!$('title').classList.contains('hidden')) cards[cardIdx].click();
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
        const timeScale = strikeT > 0 ? STRIKE.scale : game.phase === 'ko' ? 0.3 : game.slowT > 0 ? SLOWMO.world : 1;
        if (strikeT > 0) {
          strikeT -= dt;
          if (strikeT <= 0) {
            if (view.cine?.kind === 'special') view.cine = null;
            document.body.classList.remove('cine-on');
          }
        }
        acc += dt;
        let steps = 0;
        while (acc >= STEP && steps < 5) {
          // every real tick steps the game by a slice of game time; under slow-mo
          // the robot that used it thinks and acts at its own (fast) rate
          const sdt = STEP * timeScale;
          const rate = (slot: number) => (game.slowT > 0 && game.slowOwner === slot ? SLOWMO.owner / SLOWMO.world : 1);
          input.update(sdt * rate(0));
          duoInput.update(sdt * rate(0));
          pollSpecial();
          // (in local versus player 2 drives the opponent instead of its AI)
          ais.forEach((a, i) => ((duo && i === 0) || (tut && !tutStepNow().ai) ? null : a.update(sdt * rate(i + 1))));
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
        if (f.type === 'special') startSpecial(f.slot);
        if (f.type === 'box-broken') {
          showToast(f.team === 0 ? 'YOUR AMMO BOX IS BROKEN!' : 'ENEMY AMMO BOX BROKEN!', f.team === 0 ? 0xff3e5e : 0xffc23d);
          sfx.play('slam');
          view.shake(0.3);
        }
        if (f.type === 'grab' && f.slot === 0) {
          sfx.play('reload');
          if (S().vibrate) buzz([15, 30, 15]);
        }
        if (f.type === 'spirit-ready' && f.slot === 0) {
          showToast('B-DASPIRIT FULL // SPECIAL READY', 0xffc23d);
          sfx.play('charge');
        }
        if (f.type === 'eliminated') {
          if (slotTeam(f.slot) === 1) showToast(`UNIT DOWN // ${game.aliveEnemies().length} LEFT`, 0xffc23d);
          else if (f.slot === 0) showToast('YOU ARE DOWN // PACK FIGHTS ON', 0xff3e5e);
          else showToast(`ALLY DOWN // ${game.alive(0).length} LEFT`, 0xff3e5e);
        }
        if (f.type === 'hit') {
          // a number where it landed; the string of hits your side lands; the first hit of the round
          const banks = Math.min(3, f.bounces ?? 0);
          damageNumber(f.x, f.y, f.amount, f.team === 0, f.power !== 'normal' || banks > 0);
          // your trick shots get their name called
          // (a single bank is common: a small tag at the hit; two or more earn the callout)
          if (banks > 0 && f.team === 1) {
            if (banks === 1) floatText(f.x, f.y + 0.6, 'BANK', 'bank');
            else {
              callout(banks >= 3 ? 'IMPOSSIBLE SHOT!' : 'TRICK SHOT!', 'gold');
              sfx.play('super', 0.5);
              if (S().vibrate) buzz([20, 30, 30]);
            }
          }
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
        if (tut) tutFx(f);
        if (f.type === 'catch' && f.slot === 0) {
          floatText(f.x, f.y, 'CATCH +1', 'catch');
          if (S().vibrate) buzz(10);
        }
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
      if (tut) tutTick(dt);
      if (game.phase === 'over' && !tut) onRoundOver();
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
      if (bdaMode) {
        // (the gauge is the SPECIAL button itself: it fills from the bottom)
        if (i === 0) {
          $('special-btn').style.setProperty('--p', String(Math.min(100, s.spirit)));
          $('special-btn').classList.toggle('ready', s.spirit >= 100);
        }
      }
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
