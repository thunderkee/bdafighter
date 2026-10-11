import { AI_PROFILES, MATCH } from './config';
import { computeStats, STARTER_BUILD } from './parts';
import { Game, STEP, type Shooter } from './game';
import { View } from './view';
import { Input } from './input';
import { AIController } from './ai';
import { Fx2D } from './fx2d';
import { Portrait } from './face';
import { CHARACTERS, characterById } from './robot';
import { STAGES, stageById } from './stage';
import { ITEMS, type ItemType } from './items';
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
  boost: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M4 5l7 7-7 7M13 5l7 7-7 7"/></svg>',
  heal: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></svg>',
  dragon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 22c-5-3 5-5 0-8s5-5 0-8"/><circle cx="12" cy="3" r="2" fill="currentColor"/></svg>',
  missile: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1c3 2.5 4 6 4 10v6H8v-6c0-4 1-7.5 4-10z"/><path d="M8 13l-4 4v3l4-2zM16 13l4 4v3l-4-2z"/><path d="M10 19h4l-2 4z" opacity=".7"/></svg>',
};

export function boot() {
  let saveData = store.load();
  const playerStats = () => computeStats(STARTER_BUILD);
  const enemyStats = () => {
    const st = saveData.settings;
    const base = computeStats(STARTER_BUILD, profile.stats);
    const power = level(st.enemyPower);
    return {
      ...base,
      moveSpeed: base.moveSpeed * level(st.enemySpeed),
      damage: base.damage * power,
      marbleMass: base.marbleMass * power,
      // power also adds a little muzzle speed, kept modest so aim still matters
      muzzleSpeed: base.muzzleSpeed * (0.85 + 0.15 * power),
    };
  };
  const enemyMaxHealth = () => MATCH.maxHealth * HEALTH[Math.max(1, Math.min(5, saveData.settings.enemyHealth)) - 1];
  /** opponent robot: the default dragon, unless the player picked it */
  const enemyCharacter = () => (saveData.settings.character === 'dragon' ? 'angel' : 'dragon');

  const game = new Game(playerStats(), enemyStats());
  const view = new View($('stage'), game);
  const [player, enemy] = game.shooters;
  const ai = new AIController(game, enemy, player, profile);
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
  const chip = [1, 1];
  const chipDelay = [0, 0];
  const pips = $('ammo-pips');
  const reloadBar = $('reload');
  const vignette = $('vignette');
  const hints = $('hints');
  const toast = $('toast');
  const itemBtn = $('item-btn');
  const effects = $('effects');
  const superPips = [[...document.querySelectorAll<HTMLElement>('#player-super i')], [...document.querySelectorAll<HTMLElement>('#enemy-super i')]];
  const superRows = [$('player-super'), $('enemy-super')];

  const buildPips = () => {
    pips.innerHTML = '';
    for (let i = 0; i < player.stats.capacity; i++) pips.appendChild(document.createElement('i'));
  };

  const setTouchClass = () => document.body.classList.toggle('touch', input.mode === 'touch');
  setTouchClass();

  const showBanner = (text: string) => {
    banner.textContent = text;
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

  // ---------- screens ----------
  const startMatch = () => {
    sfx.unlock();
    const st = saveData.settings;
    ai.straight = st.enemyAim === 'straight';
    ai.speedMul = level(st.enemySpeed);
    ai.agility = AGILITY[Math.max(1, Math.min(5, st.enemyAgility)) - 1];
    view.setCharacters(st.character, enemyCharacter());
    view.setStage(st.stage);
    view.resetMatch();
    game.reset(playerStats(), enemyStats(), { enemyMaxHealth: enemyMaxHealth(), pucks: st.pucks, items: st.items, gates: st.gates });
    ai.reset();
    input.release();
    input.enabled = true;
    chip[0] = chip[1] = 1;
    buildPips();
    $('player-name').textContent = characterById(st.character).name.toUpperCase();
    $('enemy-name').textContent = characterById(enemyCharacter()).name.toUpperCase();
    faces[0].setCharacter(st.character);
    faces[1].setCharacter(enemyCharacter());
    for (const id of ['title', 'result', 'paused', 'settings']) $(id).classList.add('hidden');
    hud.classList.remove('hidden');
    startFaces();
    hints.classList.toggle('hidden', sessionMatches >= 2);
    hints.classList.remove('fade');
    setTouchClass();
    screen = 'playing';
    paused = false;
    acc = 0;
    lastCount = -1;
  };

  const endMatch = () => {
    screen = 'result';
    input.enabled = false;
    input.release();
    const w = game.winner;
    sessionMatches++;
    if (w === 0) sessionWins++;
    saveData = store.save({ matches: saveData.matches + 1, wins: saveData.wins + (w === 0 ? 1 : 0) });
    const title = $('result-title');
    title.textContent = w === 0 ? 'VICTORY' : w === 1 ? 'DEFEAT' : 'DRAW';
    title.className = 'result-title ' + (w === 0 ? 'win' : w === 1 ? 'lose' : '');
    $('result-sub').textContent = w === 0 ? 'MISSION COMPLETE' : w === 1 ? 'UNIT DOWN' : 'STALEMATE';
    $('r-dealt').textContent = Math.round(player.dealt).toString();
    $('r-acc').textContent = player.shots ? Math.round((player.hits / player.shots) * 100) + '%' : '–';
    $('r-hp').textContent = Math.ceil(player.hpFrac * 100) + '%';
    $('session').textContent = `SESSION ${sessionWins} / ${sessionMatches} WON`;
    $('result').classList.remove('hidden');
    hud.classList.add('hidden');
    sfx.play(w === 0 ? 'win' : 'lose');
    updateRecord();
  };

  const setPaused = (p: boolean) => {
    if (screen !== 'playing' || paused === p) return;
    paused = p;
    $('paused').classList.toggle('hidden', !p);
    if (p) {
      input.release();
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
      view.setCharacters(st.character, enemyCharacter());
      view.setStage(st.stage);
    }
    view.showAimLine = st.aimLine;
    document.querySelectorAll<HTMLElement>('.char').forEach((c) => c.classList.toggle('on', c.dataset.id === st.character));
    document.querySelectorAll<HTMLElement>('.stage-card').forEach((c) => c.classList.toggle('on', c.dataset.id === st.stage));
    $('char-name').textContent = characterById(st.character).name;
    $('stage-name').textContent = stageById(st.stage).name;
    $('title-unit').textContent = characterById(st.character).name.toUpperCase();
    $('title-stage').textContent = stageById(st.stage).name.toUpperCase();
    document.body.classList.toggle('buttons', st.layout === 'buttons');
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
    btn.innerHTML = `<i style="background:linear-gradient(135deg, ${hexc(c.palette.body)} 0 50%, ${hexc(c.palette.trim)} 50% 78%, ${hexc(c.palette.eye)} 78%)"></i><span>${c.name}</span>`;
    btn.addEventListener('click', () => saveSetting({ character: c.id }));
    $('char-grid').appendChild(btn);
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

  // on-screen buttons: held while a pointer is down on them
  document.querySelectorAll<HTMLElement>('.pad-btn').forEach((el) => {
    const name = el.dataset.btn as keyof typeof input.buttons;
    const set = (held: boolean) => {
      input.buttons[name] = held;
      el.classList.toggle('held', held);
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sfx.unlock();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // fine without capture
      }
      set(true);
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) el.addEventListener(ev, () => set(false));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  });
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
      ai,
      view,
      faces,
      start: startMatch,
      /** a bot that plays the player's side, for bot-vs-bot balance runs */
      bot(name: string) {
        const b = new AIController(game, player, enemy, AI_PROFILES[name]);
        return (dt: number) => b.update(dt);
      },
      sim(seconds: number, playerBrain?: (dt: number) => void) {
        for (let t = 0; t < seconds && game.phase !== 'over'; t += STEP) {
          if (playerBrain) playerBrain(STEP);
          else input.update(STEP);
          ai.update(STEP);
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
  let fpsAcc = 0;
  let fpsFrames = 0;
  let fps = 0;

  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    if (screen === 'playing' && !paused) {
      if (game.hitstop > 0) {
        game.hitstop -= dt;
      } else {
        const timeScale = game.phase === 'ko' ? 0.3 : 1;
        acc += dt * timeScale;
        let steps = 0;
        while (acc >= STEP && steps < 5) {
          input.update(STEP);
          ai.update(STEP);
          game.step(STEP);
          acc -= STEP;
          steps++;
        }
        if (steps === 5) acc = 0;
      }

      // fx the HUD cares about; the view consumes the list afterwards
      for (const f of game.fx) {
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
        if (f.type === 'super-ready' && f.team === 0 && saveData.settings.vibrate) buzz([20, 40, 20]);
        if (f.type === 'pickup') {
          const def = ITEMS[f.item];
          if (f.team === 0) showToast(`${def.name.toUpperCase()} ACQUIRED`, def.color);
          if (f.team === 0 && saveData.settings.vibrate) buzz(25);
        }
        if (f.type === 'use' && f.team === 1) showToast(`ENEMY ${ITEMS[f.item].name.toUpperCase()}`, 0xff3e5e);
        if (f.type === 'drop-destroyed') showToast(f.team === 0 ? 'SUPPLY DESTROYED' : 'ENEMY SUPPLY DENIED', f.team === 0 ? 0xff3e5e : ITEMS[f.item].color);
      }

      updateHud(dt);
      if (game.phase === 'over') endMatch();
    }

    view.render(paused ? 0 : dt, screen === 'playing' && game.phase !== 'ko' && game.phase !== 'over');
    if (screen === 'playing' || screen === 'result') {
      game.shooters.forEach((s, i) => faces[i].update(paused ? 0 : dt, s, Portrait.mood(s, game.phase, game.winner)));
    }

    if (debug) {
      fpsAcc += dt;
      fpsFrames++;
      if (fpsAcc > 0.5) {
        fps = Math.round(fpsFrames / fpsAcc);
        fpsAcc = fpsFrames = 0;
      }
      const d = $('debug');
      d.classList.remove('hidden');
      d.textContent = `fps ${fps}\nmarbles ${game.activeMarbles()}\nai ${profile.name}`;
    }
  };

  let lastItem: ItemType | null | undefined;
  let lastEffects = '';
  const updateHud = (dt: number) => {
    // countdown + KO banners
    if (game.phase === 'countdown') {
      const n = 3 - Math.floor(game.phaseTime / (MATCH.countdown / 3));
      if (n !== lastCount && n > 0) {
        lastCount = n;
        showBanner(String(n));
        sfx.play('tick');
      }
    } else if (game.phase === 'fight' && lastCount > 0) {
      lastCount = 0;
      showBanner('ENGAGE');
      setTimeout(() => hints.classList.add('fade'), 3500);
    } else if (game.phase === 'ko' && lastCount === 0) {
      lastCount = -2;
      showBanner(game.clock <= 0 ? 'TIME UP' : 'K.O.');
    }

    clock.textContent = Math.ceil(game.clock).toString();
    clock.classList.toggle('low', game.clock < 10);

    game.shooters.forEach((s: Shooter, i) => {
      const frac = s.hpFrac;
      hpFill[i].style.width = frac * 100 + '%';
      chipDelay[i] -= dt;
      if (chipDelay[i] <= 0) chip[i] = Math.max(frac, chip[i] - dt * 0.4);
      chip[i] = Math.max(chip[i], frac);
      hpChip[i].style.width = chip[i] * 100 + '%';
      hpBox[i].classList.toggle('low', frac < 0.25);
      hpNum[i].textContent = Math.ceil(frac * 100) + '%';
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
    $('enemy-item').textContent = enemy.item ? `◆ ${ITEMS[enemy.item].short}` : '';

    // active timed effects
    const fx: string[] = [];
    if (player.multiT > 0) fx.push(`multi:${Math.ceil(player.multiT)}`);
    if (player.boostT > 0) fx.push(`boost:${Math.ceil(player.boostT)}`);
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

    const full = Math.floor(player.ammo);
    const kids = pips.children;
    for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('empty', i >= full);
    reloadBar.classList.toggle('on', player.reload > 0);
    if (player.reload > 0) {
      (reloadBar.firstElementChild as HTMLElement).style.width = (1 - player.reload / player.stats.reloadTime) * 100 + '%';
    }
  };

  requestAnimationFrame(frame);
}
