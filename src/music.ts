import * as sfx from './audio';

/**
 * Synthesised music: a small step sequencer playing through the sound effects' context, so
 * nothing is downloaded. Each track is a chord loop with drums, a bass line, a pad and a lead;
 * `intensity` (0..1) brings in the busier layers (16th hats, the arpeggio) as a fight heats up.
 * Notes are scheduled a moment ahead on the audio clock, so the beat never stutters.
 */
export type Track = 'menu' | 'fight' | 'boss' | 'squad';

type Def = {
  bpm: number;
  /** chord roots (MIDI) for each bar, and whether each chord is minor */
  chords: [number, boolean][];
  /** 16-step drum patterns: k kick, s snare, h hat (x = on) */
  kick: string;
  snare: string;
  hat: string;
  /** bass rhythm over the bar (x = root, o = fifth, . = rest) */
  bass: string;
  /** the lead: semitone offsets from the chord root on these steps (- = rest) */
  lead: (number | null)[];
  pad: number;
  bassWave: OscillatorType;
};

const DEFS: Record<Track, Def> = {
  // easy-going, for the menus
  menu: {
    bpm: 96,
    chords: [[57, true], [53, false], [48, false], [55, false]],
    kick: 'x.......x.......',
    snare: '....x.......x...',
    hat: '..x...x...x...x.',
    bass: 'x.....x.x.......',
    lead: [12, null, null, null, 7, null, null, null, 10, null, 7, null, null, null, null, null],
    pad: 0.07,
    bassWave: 'triangle',
  },
  // driving, for a fight
  fight: {
    bpm: 128,
    chords: [[52, true], [48, false], [55, false], [50, false]],
    kick: 'x...x...x...x...',
    snare: '....x.......x..x',
    hat: 'x.x.x.x.x.x.x.x.',
    bass: 'x.xox.xox.xox.xo',
    lead: [12, null, 7, null, 10, null, 12, null, 15, null, 12, null, 10, null, 7, null],
    pad: 0.045,
    bassWave: 'sawtooth',
  },
  // heavy and dark, for a boss
  boss: {
    bpm: 140,
    chords: [[48, true], [44, false], [41, true], [43, false]],
    kick: 'x..xx...x..xx..x',
    snare: '....x.......x...',
    hat: 'x.xxx.xxx.xxx.xx',
    bass: 'xx.xxx.xxx.xxx.o',
    lead: [12, 11, 12, null, 15, null, 12, null, 19, null, 17, 15, 12, null, 11, null],
    pad: 0.05,
    bassWave: 'sawtooth',
  },
  // bright and bouncy, for Squad Run
  squad: {
    bpm: 136,
    chords: [[48, false], [55, false], [57, true], [53, false]],
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    hat: '..x...x...x...x.',
    bass: 'x..ox..ox..ox.x.',
    lead: [12, null, 16, null, 19, null, 16, null, 24, null, 19, null, 16, null, 12, null],
    pad: 0.045,
    bassWave: 'square',
  },
};

const freq = (m: number) => 440 * 2 ** ((m - 69) / 12);

let bus: GainNode | null = null;
let track: Track | null = null;
let want: Track | null = null;
let level = 0.5;
let enabled = true;
let duck = 1;
let step = 0;
let bar = 0;
let nextAt = 0;
let timer = 0;
let noise: AudioBuffer | null = null;

const VOLUME = 0.42;

function ensureBus() {
  const a = sfx.context();
  if (!a) return null;
  if (!bus) {
    bus = a.ctx.createGain();
    bus.gain.value = 0;
    bus.connect(a.master);
    noise = a.ctx.createBuffer(1, a.ctx.sampleRate * 0.3, a.ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return a;
}

function fadeTo(v: number, time = 0.6) {
  const a = sfx.context();
  if (!a || !bus) return;
  const t = a.ctx.currentTime;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(bus.gain.value, t);
  bus.gain.linearRampToValueAtTime(v, t + time);
}

function note(ctx: AudioContext, type: OscillatorType, f: number, at: number, dur: number, vol: number, cutoff?: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  let out: AudioNode = o;
  if (cutoff) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    o.connect(lp);
    out = lp;
  }
  out.connect(g).connect(bus!);
  o.start(at);
  o.stop(at + dur + 0.03);
}

function kick(ctx: AudioContext, at: number, vol: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(140, at);
  o.frequency.exponentialRampToValueAtTime(42, at + 0.12);
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
  o.connect(g).connect(bus!);
  o.start(at);
  o.stop(at + 0.25);
}

function hiss(ctx: AudioContext, at: number, dur: number, vol: number, hp: number) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(bus!);
  src.start(at, Math.random() * 0.2);
  src.stop(at + dur + 0.02);
}

/** play one 16th-note step of the current track */
function playStep(ctx: AudioContext, d: Def, at: number) {
  const [root, minor] = d.chords[bar % d.chords.length];
  const sixteenth = 60 / d.bpm / 4;
  const busy = level > 0.6;
  if (d.kick[step] === 'x') kick(ctx, at, 0.55);
  if (d.snare[step] === 'x') {
    hiss(ctx, at, 0.14, 0.22, 1400);
    note(ctx, 'triangle', 190, at, 0.08, 0.12);
  }
  // hats: the pattern, and every 16th once things heat up
  if (d.hat[step] === 'x' || (busy && step % 2 === 1)) hiss(ctx, at, 0.035, step % 4 === 0 ? 0.07 : 0.045, 7000);
  const b = d.bass[step];
  if (b === 'x' || b === 'o') note(ctx, d.bassWave, freq(root - 12 + (b === 'o' ? 7 : 0)), at, sixteenth * 1.8, 0.16, 900);
  // the pad: the chord, held across the bar
  if (step === 0) {
    const third = minor ? 3 : 4;
    for (const iv of [0, third, 7]) note(ctx, 'triangle', freq(root + iv), at, sixteenth * 15, d.pad);
  }
  // the lead comes in as the fight heats up (always a little of it on the menus)
  const l = d.lead[step];
  if (l !== null && l !== undefined && (level > 0.35 || step % 8 === 0)) {
    // (a major third in the line drops to a minor one over a minor chord)
    const iv = minor && l % 12 === 4 ? l - 1 : l;
    note(ctx, 'square', freq(root + iv), at, sixteenth * 1.2, 0.05 + 0.03 * level, 2600);
  }
  // the arpeggio on top when it's busiest
  if (busy && step % 2 === 0) {
    const third = minor ? 3 : 4;
    const arp = [0, third, 7, 12][(step / 2) % 4];
    note(ctx, 'square', freq(root + 12 + arp), at, sixteenth * 0.7, 0.03, 3800);
  }
}

function tick() {
  const a = ensureBus();
  if (!a) return;
  if (want !== track) {
    // switch tracks on the next bar line, after a quick fade
    track = want;
    step = 0;
    bar = 0;
    nextAt = a.ctx.currentTime + 0.08;
    fadeTo(track && enabled ? VOLUME * duck : 0, 0.5);
  }
  if (!track || !enabled || a.ctx.state !== 'running') return;
  const d = DEFS[track];
  const sixteenth = 60 / d.bpm / 4;
  // (if the tab slept, don't play a backlog of notes)
  if (nextAt < a.ctx.currentTime - 0.25) nextAt = a.ctx.currentTime + 0.05;
  while (nextAt < a.ctx.currentTime + 0.12) {
    playStep(a.ctx, d, nextAt);
    nextAt += sixteenth;
    step = (step + 1) % 16;
    if (step === 0) bar++;
  }
}

/** which track should be playing (null for silence); it changes at the next bar */
export function play(t: Track | null) {
  want = t;
  if (!timer) timer = window.setInterval(tick, 25);
}

/** how heated the music is, 0..1 */
export function intensity(v: number) {
  level = Math.max(0, Math.min(1, v));
}

/** music on or off (sound effects are separate) */
export function setEnabled(on: boolean) {
  if (enabled === on) return;
  enabled = on;
  fadeTo(on && track ? VOLUME * duck : 0, 0.4);
}

/** quieter under the pause menu */
export function setDucked(on: boolean) {
  const d = on ? 0.35 : 1;
  if (d === duck) return;
  duck = d;
  if (enabled && track) fadeTo(VOLUME * duck, 0.3);
}
