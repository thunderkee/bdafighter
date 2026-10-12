import { AI_PROFILES, ARENA, MATCH, type ShooterStats } from './config';
import { traitMul } from './roster';
import { computeStats, STARTER_BUILD } from './parts';
import { Game, STEP, slotTeam, type Shooter } from './game';
import { View } from './view';
import { Input, PadTracker } from './input';
import { AIController } from './ai';
import { Fx2D } from './fx2d';
import { Portrait } from './face';
import { CHARACTERS, characterById } from './robot';
import { STAGES, stageById } from './stage';
import { ITEMS, SHIELD, SLOWMO, type ItemType } from './items';
import { Recorder, ReplayGame } from './replay';
import * as sfx from './audio';
import * as store from './storage';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const params = new URLSearchParams(location.search);
const profile = AI_PROFILES[params.get('ai') ?? 'normal'] ?? AI_PROFILES.normal;
const debug = params.has('debug');

type Screen = 'title' | 'playing' | 'result';

/** settings level 1..5 -> multiplier, 3 = 1x */
const LEVEL = [0.55, 0.8, 1, 1.25, 1.55];
const level = (n: number) => LEVEL[Math.max(1, Math.min(5, Math.round(n))) - 1];
/** opponent health levels */
const HEALTH = [0.5, 0.75, 1, 1.5, 2];
/** agility: dodge chance and reaction speed multiplier */
const AGILITY = [0.3, 0.65, 1, 1.35, 1.7];

/** buzz the phone if the browser allows it (Android Chrome; iOS Safari ignores it) */
const buzz = (pattern: number | number[]) => {
  try {
    // browsers block vibration until the page has had a real tap
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    navigator.vibrate?.(pattern);
  } catch {
    // not supported
  }
};

const hexc = (n: number) => '#' + n.toString(16).padStart(6, '0');

/** small line icons for the items, drawn in currentColor */
const ITEM_ICONS: Record<ItemType, string> = {
  multi: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="4" r="2.4"/><circle cx="5.5" cy="7" r="2.4"/><circle cx="18.5" cy="7" r="2.4"/><circle cx="3" cy="13" r="2.4"/><circle cx="21" cy="13" r="2.4"/><circle cx="12" cy="11" r="2.4"/><path d="M9 18h6l-3 4z"/></svg>',
  slowmo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>',
  wiper: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="5" width="9" height="5" rx="1"/><rect x="13" y="5" width="9" height="5" rx="1"/><rect x="7" y="12" width="10" height="5" rx="1"/><rect x="2" y="12" width="3" height="5" rx="1"/><rect x="19" y="12" width="3" height="5" rx="1"/></svg>',
  heal: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></svg>',
  dragon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 22c-5-3 5-5 0-8s5-5 0-8"/><circle cx="12" cy="3" r="2" fill="currentColor"/></svg>',
  missile: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1c3 2.5 4 6 4 10v6H8v-6c0-4 1-7.5 4-10z"/><path d="M8 13l-4 4v3l4-2zM16 13l4 4v3l-4-2z"/><path d="M10 19h4l-2 4z" opacity=".7"/></svg>',
};

export function boot() {
  let saveData = store.load();
  /** magazine size is a match rule, the same for both robots */
  const magazine = () => Math.max(3, Math.min(10, Math.round(saveData.settings.magazine || 10)));
  /** a unit's traits scale its speed, cadence and shield recharge (health is separate) */
  const withTraits = <S extends ShooterStats>(stats: S, id: string): S => {
    const t = characterById(id).traits;
    return {
      ...stats,
      moveSpeed: stats.moveSpeed * traitMul(t?.speed),
      fireInterval: stats.fireInterval / traitMul(t?.fireRate),
      agility: traitMul(t?.agility),
    };
  };
  const healthTrait = (id: string) => traitMul(characterById(id).traits?.health);
  const playerStats = () => {
    const base = computeStats(STARTER_BUILD);
    // a bigger pack hits softer each, like the opponent's
    const sc = PACK_SCALE[allySize() - 1];
    return withTraits({ ...base, capacity: magazine(), damage: base.damage * sc.damage }, saveData.settings.character);
  };
  const enemyStats = () => {
    const st = saveData.settings;
    const base = computeStats(STARTER_BUILD, profile.stats);
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
  const enemyMaxHealth = () => MATCH.maxHealth * HEALTH[Math.max(1, Math.min(5, saveData.settings.enemyHealth)) - 1];
  const packSize = () => Math.max(1, Math.min(3, Math.round(saveData.settings.pack || 1)));
  /** bigger packs get less armour and punch each, so two or three stay beatable */
  const PACK_SCALE = [
    { health: 1, damage: 1 },
    { health: 0.6, damage: 0.5 },
    { health: 0.4, damage: 0.38 },
  ];
  const allySize = () => Math.max(1, Math.min(3, Math.round(saveData.settings.playerPack || 1)));
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
    const sc = PACK_SCALE[packSize() - 1];
    const base = enemyStats();
    const ids = unitIds();
    return Array.from({ length: packSize() }, (_, k) => ({
      stats: withTraits({ ...base, damage: base.damage * sc.damage }, ids[k + 1]),
      maxHealth: enemyMaxHealth() * sc.health * healthTrait(ids[k + 1]),
    }));
  };
  /** pack members after the first get random units (fixed for the match) */
  let packIds: string[] = [];
  /** your pack-mates' units */
  let allyIds: string[] = [];
  /** opponent robot: the chosen one, or on auto the dragon unless the player picked it */
  const enemyCharacter = () => {
    const st = saveData.settings;
    if (st.enemyCharacter && st.enemyCharacter !== 'auto') return st.enemyCharacter;
    return st.character === 'dragon' ? 'angel' : 'dragon';
  };

  const game = new Game(playerStats(), enemyStats());
  const view = new View($('stage'), game);
  const player = game.player;
  /** one controller per CPU robot: opponents (slots 1-3) and your pack-mates (4-5) */
  const ais = game.shooters.slice(1).map((s) => new AIController(game, s, profile));
  /** the opponent the HUD shows: the one the player is facing */
  const focus = () => game.targetFor(player);
  const unitIds = () => {
    const ids = [saveData.settings.character, enemyCharacter()];
    for (let i = 2; i <= 3; i++) ids.push(packIds[i - 2] ?? enemyCharacter());
    for (let i = 0; i < 2; i++) ids.push(allyIds[i] ?? saveData.settings.character);
    return ids;
  };
  const input = new Input($('touch'), player, (x, y) => view.screenToWorld(x, y));

  // ThorVG effects overlay + portraits load in the background; the game never waits
  const fx2d = new Fx2D($<HTMLCanvasElement>('fx'));
  void fx2d.init().then(() => {
    if (fx2d.ready) view.fx2d = fx2d;
  });
  const faces = [new Portrait($<HTMLCanvasElement>('face-player'), saveData.settings.character), new Portrait($<HTMLCanvasElement>('face-enemy'), enemyCharacter())];
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
    $('magazine').style.setProperty('--ball', hexc(characterById(saveData.settings.character).ball));
  };

  const setTouchClass = () => document.body.classList.toggle('touch', input.mode === 'touch');
  setTouchClass();

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
    $('record').textContent = saveData.matches ? `RECORD ${saveData.wins} W / ${saveData.matches - saveData.wins} L` : '';
  };
  updateRecord();

  const startFaces = () => {
    if (facesStarted) return;
    facesStarted = true;
    faces.forEach((f) => void f.init());
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
    const st = saveData.settings;
    view.resetMatch();
    game.reset(playerStats(), {
      enemies: packEnemies(),
      allies: packAllies(),
      playerHealth: MATCH.maxHealth * healthTrait(st.character) * PACK_SCALE[allySize() - 1].health,
      pucks: st.pucks,
      covers: st.covers,
      pins: st.pins,
      items: st.items,
      gates: st.gates,
      duration: st.roundTime ?? 60,
      burst: st.burst ?? 1,
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
    input.enabled = true;
    finalRound = roundWins[0] === 1 && roundWins[1] === 1;
    showRounds();
    lastCount = -1;
  };

  const startMatch = () => {
    sfx.unlock();
    const st = saveData.settings;
    // the Opponent settings tune the other side; your pack-mates play at standard skill
    ais.forEach((a, i) => {
      const foe = slotTeam(i + 1) === 1;
      a.straight = foe && st.enemyAim === 'straight';
      a.speedMul = foe ? level(st.enemySpeed) : 1;
      a.agility = foe ? AGILITY[Math.max(1, Math.min(5, st.enemyAgility)) - 1] : 1;
    });
    // extra pack members on both sides: random units, all different where the roster allows
    const pool = CHARACTERS.map((c) => c.id).filter((id) => id !== st.character && id !== enemyCharacter());
    const draw = (fallback: string) => pool.splice(Math.floor(Math.random() * pool.length), 1)[0] ?? fallback;
    packIds = [0, 1].map(() => draw(enemyCharacter()));
    allyIds = [0, 1].map(() => draw(st.character));
    // each CPU unit's agility trait sharpens (or dulls) its dodging on top of the setting
    const ids = unitIds();
    ais.forEach((a, i) => (a.agility *= traitMul(characterById(ids[i + 1]).traits?.agility)));
    view.setCharacters(unitIds());
    view.setStage(st.stage);
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
    $('intro-p2-sub').textContent = packSize() > 1 ? `PACK OF ${packSize()} // ${unitIds().slice(2, 1 + packSize()).map((id) => characterById(id).name.toUpperCase()).join(' + ')}` : `CPU // ${profile.name.toUpperCase()}`;
    faces[0].setCharacter(st.character);
    faces[1].setCharacter(enemyCharacter());
    for (const id of ['title', 'result', 'paused', 'settings']) $(id).classList.add('hidden');
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
    input.enabled = false;
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
    input.enabled = false;
    input.release();
    if (!recorder.frames.length) return endReplay(final, loser);
    flow = 'replay';
    flowT = 0;
    finalRound = final;
    replayGame = new ReplayGame(recorder, game);
    view.resetMatch();
    view.game = replayGame as unknown as Game;
    view.cine = { kind: 'replay', t: 0, shot: -1, slot: loser };
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
    input.enabled = false;
    input.release();
    view.cine = null;
    const w = matchWinner;
    sessionMatches++;
    if (w === 0) sessionWins++;
    saveData = store.save({ matches: saveData.matches + 1, wins: saveData.wins + (w === 0 ? 1 : 0) });
    const title = $('result-title');
    title.textContent = w === 0 ? 'VICTORY' : w === 1 ? 'DEFEAT' : 'DRAW';
    title.className = 'result-title ' + (w === 0 ? 'win' : w === 1 ? 'lose' : '');
    $('result-sub').textContent = `ROUNDS ${roundWins[0]} – ${roundWins[1]} // ${w === 0 ? 'MISSION COMPLETE' : w === 1 ? 'UNIT DOWN' : 'STALEMATE'}`;
    $('r-dealt').textContent = Math.round(totals.dealt).toString();
    $('r-acc').textContent = totals.shots ? Math.round((totals.hits / totals.shots) * 100) + '%' : '–';
    $('r-hp').textContent = Math.ceil(player.hpFrac * 100) + '%';
    $('session').textContent = `SESSION ${sessionWins} / ${sessionMatches} WON`;
    $('result').classList.remove('hidden');
    hud.classList.add('hidden');
    sfx.play(w === 0 ? 'win' : 'lose');
    updateRecord();
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
        showBanner(matchWinner === 0 ? 'YOU WIN' : matchWinner === 1 ? 'YOU LOSE' : 'DRAW', true);
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

  $('play-btn').addEventListener('click', startMatch);
  $('again-btn').addEventListener('click', startMatch);
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
    $('mute-btn').textContent = saveData.muted ? '🔇' : '🔊';
  });
  $('mute-btn').textContent = saveData.muted ? '🔇' : '🔊';

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
    view.setQuality(st.realism);
    $('fps').classList.toggle('hidden', !st.showFps);
    if (view.cameraMode !== st.camera) {
      view.cameraMode = st.camera;
      view.resize();
    }
    document.body.classList.toggle('triple', st.fireButtons === 'triple');
    document.querySelectorAll<HTMLElement>('.enemy-char').forEach((c) => c.classList.toggle('on', c.dataset.id === (st.enemyCharacter || 'auto')));
    $('enemy-char-name').textContent = st.enemyCharacter && st.enemyCharacter !== 'auto' ? characterById(st.enemyCharacter).name : `Auto (${characterById(enemyCharacter()).name})`;
    document.querySelectorAll<HTMLElement>('#char-grid .char').forEach((c) => c.classList.toggle('on', c.dataset.id === st.character));
    document.querySelectorAll<HTMLElement>('.stage-card').forEach((c) => c.classList.toggle('on', c.dataset.id === st.stage));
    $('char-name').textContent = characterById(st.character).name;
    $('stage-name').textContent = stageById(st.stage).name;
    $('title-unit').textContent = characterById(st.character).name.toUpperCase();
    $('title-stage').textContent = stageById(st.stage).name.toUpperCase();
    document.body.classList.toggle('buttons', st.layout === 'buttons');
    document.body.classList.toggle('hud-tags', st.hudMode === 'tags');
    document.body.classList.toggle('slider', st.layout === 'buttons' && st.moveControl === 'slider');
    $('pad').classList.toggle('hidden', st.layout !== 'buttons');
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

  // character + stage pickers, built from their lists
  for (const c of CHARACTERS) {
    const btn = document.createElement('button');
    btn.className = 'char';
    btn.dataset.id = c.id;
    btn.innerHTML = `<i style="background:linear-gradient(135deg, ${hexc(c.palette.body)} 0 50%, ${hexc(c.palette.trim)} 50% 78%, ${hexc(c.ball)} 78%)"></i><span>${c.name}</span>`;
    btn.addEventListener('click', () => saveSetting({ character: c.id }));
    $('char-grid').appendChild(btn);
  }
  // opponent picker: Auto, then every unit
  {
    const auto = document.createElement('button');
    auto.className = 'char enemy-char';
    auto.dataset.id = 'auto';
    auto.innerHTML = `<i style="background:repeating-linear-gradient(45deg, #3ef0ff 0 4px, #0a1630 4px 8px)"></i><span>Auto</span>`;
    auto.addEventListener('click', () => saveSetting({ enemyCharacter: 'auto' }));
    $('enemy-char-grid').appendChild(auto);
    for (const c of CHARACTERS) {
      const btn = document.createElement('button');
      btn.className = 'char enemy-char';
      btn.dataset.id = c.id;
      btn.innerHTML = `<i style="background:linear-gradient(135deg, ${hexc(c.palette.body)} 0 50%, ${hexc(c.palette.trim)} 50% 78%, ${hexc(c.ball)} 78%)"></i><span>${c.name}</span>`;
      btn.addEventListener('click', () => saveSetting({ enemyCharacter: c.id }));
      $('enemy-char-grid').appendChild(btn);
    }
  }
  for (const s of STAGES) {
    const btn = document.createElement('button');
    btn.className = 'stage-card';
    btn.dataset.id = s.id;
    btn.innerHTML = `<i style="background:linear-gradient(160deg, ${hexc(s.swatch[0])} 0 60%, ${hexc(s.swatch[1])} 60%)"></i><span>${s.name}</span>`;
    btn.addEventListener('click', () => saveSetting({ stage: s.id }));
    $('stage-grid').appendChild(btn);
  }

  // settings tabs
  const showTab = (tab: string) => {
    document.querySelectorAll<HTMLElement>('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    document.querySelectorAll<HTMLElement>('.panels section').forEach((p) => p.classList.toggle('on', p.dataset.panel === tab));
  };
  document.querySelectorAll<HTMLElement>('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab!)));
  showTab('fighter');
  applySettings();

  let settingsFrom: 'title' | 'paused' | 'result' = 'title';
  const openSettings = (from: 'title' | 'paused' | 'result') => {
    settingsFrom = from;
    $(from).classList.add('hidden');
    $('settings').classList.remove('hidden');
  };
  $('settings-btn').addEventListener('click', () => openSettings('title'));
  $('pause-settings-btn').addEventListener('click', () => openSettings('paused'));
  $('result-settings-btn').addEventListener('click', () => openSettings('result'));
  // in-match gear: pause, then jump straight to settings
  $('hud-settings-btn').addEventListener('click', () => {
    setPaused(true);
    openSettings('paused');
  });
  $('settings-done').addEventListener('click', () => {
    $('settings').classList.add('hidden');
    $(settingsFrom).classList.remove('hidden');
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
    if ((e.code === 'Enter' || e.code === 'Space') && screen !== 'playing') {
      e.preventDefault();
      startMatch();
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
      /** a bot that plays the player's side, for bot-vs-bot balance runs */
      bot(name: string) {
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

  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    if (screen === 'playing' && !paused && flow !== 'round') updateFlow(dt);
    // health tags ride along every frame (and hide outside the fight)
    if (screen === 'playing') updateTags(dt);
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
          ais.forEach((a, i) => a.update(sdt * rate(i + 1)));
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
          chipDelay[f.team] = 0.45;
          hpBox[f.team].classList.remove('shake');
          void hpBox[f.team].offsetWidth;
          hpBox[f.team].classList.add('shake');
          if (f.team === 0) {
            vignette.classList.add('on');
            requestAnimationFrame(() => vignette.classList.remove('on'));
          }
          if (saveData.settings.vibrate) {
            // taking a hit buzzes harder than landing one
            if (f.power !== 'normal') buzz(f.team === 0 ? [90, 40, 140] : [40, 30, 60]);
            else buzz(f.team === 0 ? 45 : 14);
          }
        }
        if (f.type === 'super-ready' && f.slot === 0 && saveData.settings.vibrate) buzz([20, 40, 20]);
        if (f.type === 'pickup') {
          const def = ITEMS[f.item];
          if (f.slot === 0) showToast(`${def.name.toUpperCase()} ACQUIRED`, def.color);
          if (f.slot === 0 && saveData.settings.vibrate) buzz(25);
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
      const [lo, hi] = player.lane;
      sliderEl.style.setProperty('--u', String(Math.max(0, Math.min(1, (player.x - lo) / Math.max(0.01, hi - lo)))));
      const u = pad.slider();
      sliderEl.classList.toggle('active', u !== null);
      if (u !== null) sliderEl.style.setProperty('--t', String(u));
    }
    view.render(paused ? 0 : dt, screen === 'playing' && flow === 'round' && game.phase !== 'ko' && game.phase !== 'over');
    if (screen === 'playing' || screen === 'result') {
      const shown = [view.game.shooters[0], view.game.shooters[focus().slot] ?? view.game.shooters[1]];
      if (shown[1] && faceSlot !== shown[1].slot) {
        faceSlot = shown[1].slot;
        faces[1].setCharacter(unitIds()[faceSlot]);
      }
      shown.forEach((s, i) => faces[i].update(paused ? 0 : dt, s, Portrait.mood(s, game.phase, game.winner)));
      document.body.classList.toggle('slowmo', game.slowT > 0 && flow === 'round');
    }

    // frame-rate meter (settings) and the debug readout share one counter
    fpsAcc += dt;
    fpsFrames++;
    if (fpsAcc > 0.5) {
      fps = Math.round(fpsFrames / fpsAcc);
      fpsAcc = fpsFrames = 0;
      if (saveData.settings.showFps) {
        const el = $('fps');
        el.textContent = `${fps} FPS`;
        el.classList.toggle('slow', fps < 50 && fps >= 30);
        el.classList.toggle('bad', fps < 30);
      }
    }
    if (debug) {
      const d = $('debug');
      d.classList.remove('hidden');
      d.textContent = `fps ${fps}\nmarbles ${game.activeMarbles()}\nai ${profile.name}\npad ${pad.debug()}\nx ${player.x.toFixed(2)}${player.railPush ? ' END' : ''}`;
    }
  };

  let lastItem: ItemType | null | undefined;
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
  const updateTags = (dt: number) => {
    const on = saveData.settings.hudMode === 'tags' && flow === 'round';
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
    } else if (game.phase === 'ko' && lastCount === 0) {
      lastCount = -2;
      const w = game.winner;
      const perfect = (w === 0 || w === 1) && game.shooters[w].health >= game.shooters[w].maxHealth;
      showBanner(game.clock <= 0 ? 'TIME UP' : 'K.O.', true, perfect ? 'PERFECT' : w === -1 ? 'DRAW' : undefined);
    }

    clock.textContent = Number.isFinite(game.clock) ? Math.ceil(game.clock).toString() : '∞';
    clock.classList.toggle('low', game.clock < 10);

    // each bar is a whole pack (just you when solo); shield/super from you and the one you face
    ([player, focus()] as Shooter[]).forEach((s, i) => {
      const frac = game.teamFrac(i === 0 ? 0 : 1);
      hpFill[i].style.width = frac * 100 + '%';
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
