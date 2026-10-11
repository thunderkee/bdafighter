import { AI_PROFILES, MATCH } from './config';
import { computeStats, STARTER_BUILD } from './parts';
import { Game, STEP } from './game';
import { View } from './view';
import { Input } from './input';
import { AIController } from './ai';
import * as sfx from './audio';
import * as store from './storage';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const params = new URLSearchParams(location.search);
const profile = AI_PROFILES[params.get('ai') ?? 'normal'] ?? AI_PROFILES.normal;
const debug = params.has('debug');

type Screen = 'title' | 'playing' | 'result';

export function boot() {
  const playerStats = () => computeStats(STARTER_BUILD);
  const enemyStats = () => computeStats(STARTER_BUILD, profile.stats);

  const game = new Game(playerStats(), enemyStats());
  const view = new View($('stage'), game);
  const [player, enemy] = game.shooters;
  const ai = new AIController(game, enemy, player, profile);
  const input = new Input($('touch'), player, (x, y) => view.screenToWorld(x, y));

  let saveData = store.load();
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
  const chip = [MATCH.maxHealth, MATCH.maxHealth];
  const chipDelay = [0, 0];
  const pips = $('ammo-pips');
  const reloadBar = $('reload');
  const vignette = $('vignette');
  const hints = $('hints');
  $('enemy-name').textContent = profile.name;

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

  const updateRecord = () => {
    $('record').textContent = saveData.matches ? `Record: ${saveData.wins} wins / ${saveData.matches} matches` : '';
  };
  updateRecord();

  // ---------- screens ----------
  const startMatch = () => {
    sfx.unlock();
    game.reset(playerStats(), enemyStats());
    ai.reset();
    input.release();
    input.enabled = true;
    chip[0] = chip[1] = MATCH.maxHealth;
    buildPips();
    $('title').classList.add('hidden');
    $('result').classList.add('hidden');
    hud.classList.remove('hidden');
    hints.classList.toggle('hidden', sessionMatches >= 2);
    hints.classList.remove('fade');
    setTouchClass();
    screen = 'playing';
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
    title.textContent = w === 0 ? 'WIN' : w === 1 ? 'LOSE' : 'DRAW';
    title.className = 'result-title ' + (w === 0 ? 'win' : w === 1 ? 'lose' : '');
    $('r-dealt').textContent = Math.round(player.dealt).toString();
    $('r-acc').textContent = player.shots ? Math.round((player.hits / player.shots) * 100) + '%' : '–';
    $('r-hp').textContent = Math.ceil(player.health).toString();
    $('session').textContent = `This session: ${sessionWins} / ${sessionMatches} won`;
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
  window.addEventListener('keydown', (e) => {
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
  window.addEventListener('resize', () => view.resize());
  input.onFirstInput = () => sfx.unlock();

  $('loading').classList.add('hidden');

  if (debug) {
    // console hook for balance testing: __mf.sim(seconds) fast-forwards the match
    (window as unknown as Record<string, unknown>).__mf = {
      game,
      ai,
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
        }
      }

      updateHud(dt);
      if (game.phase === 'over') endMatch();
    }

    view.render(paused ? 0 : dt, screen === 'playing' && game.phase !== 'ko' && game.phase !== 'over');

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
      showBanner('FIGHT!');
      setTimeout(() => hints.classList.add('fade'), 3500);
    } else if (game.phase === 'ko' && lastCount === 0) {
      lastCount = -2;
      showBanner(game.clock <= 0 ? 'TIME!' : 'K.O.!');
    }

    clock.textContent = Math.ceil(game.clock).toString();
    clock.classList.toggle('low', game.clock < 10);

    game.shooters.forEach((s, i) => {
      const pct = (s.health / MATCH.maxHealth) * 100;
      hpFill[i].style.width = pct + '%';
      chipDelay[i] -= dt;
      if (chipDelay[i] <= 0) chip[i] = Math.max(s.health, chip[i] - dt * 40);
      hpChip[i].style.width = (chip[i] / MATCH.maxHealth) * 100 + '%';
    });

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

