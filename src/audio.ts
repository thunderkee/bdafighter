// Synthesised sound effects. Nothing plays until unlock() runs inside a
// user gesture, which is what mobile browsers and web portals require.

type Sfx = 'fire' | 'clack' | 'wall' | 'bump' | 'hit' | 'hurt' | 'reload' | 'go' | 'tick' | 'win' | 'lose' | 'super' | 'superhit' | 'charge' | 'pop' | 'explode' | 'clatter' | 'whoosh' | 'gong' | 'slam';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false;
const lastPlayed = new Map<Sfx, number>();

// minimum seconds between two plays of the same sound
const THROTTLE: Partial<Record<Sfx, number>> = { clack: 0.03, wall: 0.05, bump: 0.06, fire: 0.04 };

export function unlock() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.7;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch {
    ctx = null;
  }
}

/** the running audio context and the master bus (for the music), once unlocked */
export function context() {
  return ctx && master ? { ctx, master } : null;
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.7;
}

export function suspend() {
  if (ctx && ctx.state === 'running') void ctx.suspend();
}

export function resume() {
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function burst(dur: number, vol: number, filterType: BiquadFilterType, freq: number, q = 1) {
  if (!ctx || !master || !noise) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.3);
  src.stop(t + dur + 0.02);
}

/** intensity 0..1 scales volume for impact sounds */
export function play(name: Sfx, intensity = 1) {
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const gap = THROTTLE[name];
  if (gap && now - (lastPlayed.get(name) ?? -1) < gap) return;
  lastPlayed.set(name, now);
  const v = Math.min(1, Math.max(0.15, intensity));
  const jitter = 0.9 + Math.random() * 0.2;

  switch (name) {
    case 'fire':
      burst(0.05, 0.18, 'highpass', 2500);
      tone('triangle', 520 * jitter, 180, 0.07, 0.16);
      break;
    case 'clack':
      tone('sine', 2600 * jitter, 2200, 0.05, 0.22 * v);
      tone('sine', 3900 * jitter, 3500, 0.03, 0.1 * v);
      break;
    case 'wall':
      tone('triangle', 900 * jitter, 500, 0.04, 0.12 * v);
      break;
    case 'bump':
      tone('sine', 300 * jitter, 140, 0.09, 0.25 * v);
      burst(0.04, 0.1 * v, 'bandpass', 1200, 2);
      break;
    case 'hit':
      tone('sine', 220, 70, 0.16, 0.45 * v);
      burst(0.09, 0.28 * v, 'bandpass', 1800, 0.8);
      tone('square', 1300 * jitter, 900, 0.05, 0.05 * v);
      break;
    case 'hurt':
      tone('sine', 150, 45, 0.24, 0.6 * v);
      burst(0.14, 0.32 * v, 'lowpass', 900);
      break;
    case 'reload':
      tone('square', 700, 650, 0.03, 0.06);
      tone('square', 1100, 1000, 0.03, 0.06, 0.09);
      break;
    case 'tick':
      tone('sine', 660, 660, 0.08, 0.2);
      break;
    case 'go':
      tone('sawtooth', 440, 880, 0.25, 0.18);
      tone('sine', 880, 880, 0.3, 0.15, 0.05);
      break;
    case 'super':
      // charged launch: rising whoosh over a heavy thump
      tone('sawtooth', 180, 900, 0.32, 0.22 * v);
      tone('sine', 120, 50, 0.3, 0.5 * v);
      burst(0.3, 0.25 * v, 'bandpass', 2400, 0.7);
      break;
    case 'superhit':
      // big boom: deep drop, crunch and a ringing tail
      tone('sine', 140, 30, 0.6, 0.9);
      burst(0.45, 0.5, 'lowpass', 1400);
      tone('square', 900, 300, 0.25, 0.08);
      tone('triangle', 1760, 1700, 0.5, 0.08, 0.05);
      break;
    case 'charge':
      [880, 1175, 1568].forEach((f, i) => tone('triangle', f, f, 0.12, 0.16, i * 0.06));
      break;
    case 'pop':
      // small internal explosion
      tone('sine', 260 * jitter, 60, 0.22, 0.55 * v);
      burst(0.2, 0.4 * v, 'lowpass', 1600);
      tone('square', 1800 * jitter, 600, 0.06, 0.06 * v);
      break;
    case 'explode':
      // the big one: sub drop, long rumble, bright crack and a crackling tail
      tone('sine', 110, 26, 1.4, 1);
      tone('triangle', 70, 30, 1.1, 0.5);
      burst(1.4, 0.75, 'lowpass', 700);
      burst(0.35, 0.5, 'highpass', 2600);
      for (let i = 0; i < 6; i++) tone('square', 900 + Math.random() * 1400, 200, 0.05, 0.05, 0.25 + i * 0.12 + Math.random() * 0.05);
      break;
    case 'clatter':
      // metal parts landing
      for (let i = 0; i < 7; i++) tone('triangle', 1400 + Math.random() * 2200, 700, 0.04, 0.1 * v, i * 0.07 + Math.random() * 0.05);
      break;
    case 'whoosh':
      burst(0.5, 0.3, 'bandpass', 900, 0.6);
      tone('sine', 300, 900, 0.4, 0.06);
      break;
    case 'gong':
      tone('sine', 196, 190, 1.6, 0.5);
      tone('sine', 392, 385, 1.2, 0.18);
      tone('triangle', 588, 580, 0.9, 0.08);
      break;
    case 'slam':
      tone('sine', 150, 40, 0.5, 0.8);
      burst(0.25, 0.45, 'lowpass', 2200);
      tone('sawtooth', 880, 220, 0.18, 0.12);
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.22, 0.2, i * 0.11));
      break;
    case 'lose':
      [392, 330, 262].forEach((f, i) => tone('triangle', f, f * 0.97, 0.3, 0.2, i * 0.16));
      break;
  }
}
