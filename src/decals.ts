import * as THREE from 'three';
import SHEETS from './art/sheets.json';
import seraphSheet from './art/seraph-sheet.webp';
import trueLeoSheet from './art/true-leo-king-sheet.webp';

/**
 * Painted textures for a block: pictures in full colour, drawn once on a canvas: pixel art, or
 * printed panel art drawn smooth at a high resolution like a model kit's decals.
 * Two kinds, named on a block's material as `tex`:
 *  - `decal:<name>` sits once across the block's front face (`decal:<name>@back` on its back face);
 *    every other face shows the block's own colour.
 *  - `paint:<name>` tiles over every face like the armour patterns, at the same size everywhere.
 * The block keeps its own colour: a picture starts from it (the material itself is drawn white).
 */

export interface Pal {
  /** the painted block's own colour, and a colour that reads on it for markings */
  base: string;
  mark: string;
  /** a warm printing colour for numbers and warnings: the accent when it's a strong colour, else gold */
  print: string;
  body: string;
  trim: string;
  accent: string;
  joint: string;
  eye: string;
}
type Painter = (g: CanvasRenderingContext2D, px: (x: number, y: number, w: number, h: number, c: string) => void, pal: Pal, arg: string) => void;
interface Pic {
  w: number;
  h: number;
  draw: Painter;
  /** drawn at a high resolution with smooth edges (printed panel art), not pixel art */
  hi?: boolean;
}

// Leo King's colours
const PURPLE = '#5b3a9e';
const PURPLE_D = '#46297e';
const PURPLE_L = '#7a55c4';
const GOLD = '#e8b43a';
const GOLD_D = '#a87a1e';
const GOLD_L = '#ffd86a';
const RED = '#8e1838';
const RED_D = '#6a0f28';
const RED_L = '#a82248';
const CREAM = '#f2ead8';
const INK = '#1f1c2a';
const SKIN = '#b23040';
const SKIN_D = '#8a2030';
const SKIN_L = '#d04a52';
const HAIR = '#4a2c22';
const HAIR_D = '#2e1a14';
const HAIR_L = '#6a4030';
const EYE = '#ffd84a';

const LEO: Record<string, Pic> = {
  /** the king's face: angry brows, glowing eyes, a nose and a beard round the mouth */
  face: {
    w: 18,
    h: 17,
    draw: (_g, px) => {
      px(0, 0, 18, 17, SKIN);
      // light down the brow and cheekbones, shade under them
      px(1, 1, 16, 2, SKIN_L);
      px(0, 13, 18, 4, HAIR);
      px(0, 9, 2, 8, HAIR);
      px(16, 9, 2, 8, HAIR);
      // brows, angled in
      px(2, 4, 5, 2, HAIR_D);
      px(11, 4, 5, 2, HAIR_D);
      px(6, 5, 2, 1, HAIR_D);
      px(10, 5, 2, 1, HAIR_D);
      // eyes
      px(3, 6, 4, 2, EYE);
      px(11, 6, 4, 2, EYE);
      px(5, 6, 2, 1, '#fff6c0');
      px(11, 6, 2, 1, '#fff6c0');
      // nose
      px(8, 6, 2, 4, SKIN_L);
      px(8, 10, 2, 1, SKIN_D);
      px(4, 9, 3, 1, SKIN_D);
      px(11, 9, 3, 1, SKIN_D);
      // moustache and mouth
      px(4, 11, 10, 2, HAIR);
      px(6, 12, 6, 1, HAIR_D);
      px(7, 13, 4, 1, INK);
      // beard strands
      for (let x = 1; x < 17; x += 3) px(x, 15, 1, 2, HAIR_L);
      for (let x = 2; x < 17; x += 3) px(x, 14, 1, 1, HAIR_D);
    },
  },
  /** the mane and beard round the face: brown locks */
  mane: {
    w: 16,
    h: 16,
    draw: (_g, px) => {
      px(0, 0, 16, 16, HAIR);
      for (let y = 0; y < 16; y += 4)
        for (let x = 0; x < 16; x += 4) {
          const o = (y / 4) % 2 ? 2 : 0;
          px((x + o) % 16, y, 1, 3, HAIR_L);
          px((x + o + 2) % 16, y + 1, 1, 3, HAIR_D);
        }
    },
  },
  /** ermine: cream fur with black tail tips */
  ermine: {
    w: 16,
    h: 16,
    draw: (_g, px) => {
      px(0, 0, 16, 16, CREAM);
      for (const [x, y] of [[2, 3], [10, 3], [6, 11], [14, 11]]) {
        px(x, y, 1, 3, INK);
        px(x - 1, y + 1, 3, 1, INK);
      }
      px(0, 15, 16, 1, '#ddd2b8');
    },
  },
  /** the robe's front: purple, a gold seam down the middle, a gold key band at the hem */
  robe: {
    w: 32,
    h: 24,
    draw: (_g, px) => {
      px(0, 0, 32, 24, PURPLE);
      px(0, 0, 32, 2, PURPLE_L);
      px(15, 0, 2, 15, GOLD);
      px(17, 0, 1, 15, GOLD_D);
      // the key band
      px(0, 15, 32, 9, PURPLE_D);
      px(0, 15, 32, 1, GOLD);
      px(0, 23, 32, 1, GOLD);
      for (let x = 0; x < 32; x += 8) {
        px(x + 1, 17, 6, 1, GOLD);
        px(x + 6, 17, 1, 5, GOLD);
        px(x + 1, 21, 6, 1, GOLD);
        px(x + 1, 19, 1, 2, GOLD);
        px(x + 1, 19, 3, 1, GOLD);
        px(x + 3, 19, 1, 1, GOLD_L);
      }
    },
  },
  /** the throne's back: red velvet in a double gold frame, with a gold shield */
  throne: {
    w: 28,
    h: 36,
    draw: (_g, px) => {
      px(0, 0, 28, 36, RED);
      // a soft diamond weave in the velvet
      for (let y = 4; y < 33; y += 4) for (let x = 4 + ((y / 4) % 2) * 2; x < 25; x += 4) px(x, y, 1, 1, RED_L);
      px(0, 0, 28, 36, 'rgba(0,0,0,0)');
      // inner frame
      px(2, 2, 24, 1, GOLD);
      px(2, 33, 24, 1, GOLD_D);
      px(2, 2, 1, 32, GOLD);
      px(25, 2, 1, 32, GOLD_D);
      px(3, 3, 22, 1, RED_D);
      // the shield
      px(10, 12, 8, 7, GOLD);
      px(11, 19, 6, 2, GOLD);
      px(12, 21, 4, 1, GOLD);
      px(13, 22, 2, 1, GOLD);
      px(10, 12, 8, 1, GOLD_L);
      px(17, 13, 1, 6, GOLD_D);
      px(13, 14, 2, 1, RED);
      px(12, 15, 4, 1, RED);
      px(13, 16, 2, 1, RED);
    },
  },
  /** the throne's frame: purple, a gold line inset along it */
  frame: {
    w: 16,
    h: 16,
    draw: (_g, px) => {
      px(0, 0, 16, 16, PURPLE_D);
      for (let y = 0; y < 16; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < 16; x += 8) {
        px(x + 3, y + 2, 2, 4, PURPLE);
        px(x + 2, y + 3, 4, 2, PURPLE);
      }
    },
  },
  /** a lion's face, for the fists: eyes, a broad nose, a roaring mouth */
  lion: {
    w: 16,
    h: 16,
    draw: (_g, px) => {
      px(0, 0, 16, 16, GOLD);
      px(0, 0, 16, 1, GOLD_L);
      px(2, 4, 4, 1, GOLD_D);
      px(10, 4, 4, 1, GOLD_D);
      px(3, 5, 3, 2, INK);
      px(10, 5, 3, 2, INK);
      px(4, 5, 1, 1, EYE);
      px(11, 5, 1, 1, EYE);
      px(6, 6, 4, 3, GOLD_D);
      px(7, 8, 2, 1, INK);
      px(3, 10, 10, 4, INK);
      px(4, 10, 1, 2, CREAM);
      px(11, 10, 1, 2, CREAM);
      px(4, 13, 1, 1, CREAM);
      px(11, 13, 1, 1, CREAM);
      px(5, 12, 6, 2, RED);
    },
  },
};

// ---- printed panel art: drawn at a high resolution with smooth edges, like a model kit's decals ----
/** a squared stencil numeral set on a 3x5 grid */
const GLYPH: Record<string, string> = {
  '0': '111101101101111',
  '1': '110010010010111',
  '2': '111001111100111',
  '3': '111001111001111',
  '4': '101101111001001',
  '5': '111100111001111',
  '6': '111100111101111',
  '7': '111001001001001',
  '8': '111101111101111',
  '9': '111101111001111',
};
type G = CanvasRenderingContext2D;
/** a number in the stencil face: each cell `c` across, a slight slant, chamfered outer corners */
function numerals(g: G, str: string, x: number, y: number, c: number, col: string, slant = 0.12) {
  g.save();
  g.fillStyle = col;
  g.transform(1, 0, -slant, 1, slant * (y + 2.5 * c), 0);
  for (const ch of str) {
    const gl = GLYPH[ch];
    if (gl)
      for (let i = 0; i < 15; i++)
        if (gl[i] === '1') g.fillRect(x + (i % 3) * c - 0.4, y + Math.floor(i / 3) * c - 0.4, c + 0.8, c + 0.8);
    x += 3.7 * c;
  }
  g.restore();
}
const numW = (str: string, c: number) => (str.length * 3.7 - 0.7) * c;
function rr(g: G, x: number, y: number, w: number, h: number, r: number, col: string) {
  g.fillStyle = col;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
}
/** a run of chevrons pointing right */
function chevrons(g: G, x: number, y: number, h: number, n: number, col: string) {
  g.fillStyle = col;
  for (let k = 0; k < n; k++) {
    const x0 = x + k * h * 0.75;
    g.beginPath();
    g.moveTo(x0, y);
    g.lineTo(x0 + h * 0.4, y);
    g.lineTo(x0 + h * 0.8, y + h / 2);
    g.lineTo(x0 + h * 0.4, y + h);
    g.lineTo(x0, y + h);
    g.lineTo(x0 + h * 0.4, y + h / 2);
    g.closePath();
    g.fill();
  }
}
/** a few lines of fine print */
function print(g: G, x: number, y: number, w: number, n: number, col: string, lh = 4) {
  g.fillStyle = col;
  for (let k = 0; k < n; k++) g.fillRect(x, y + k * lh, w * (k % 3 === 2 ? 0.55 : k % 2 ? 0.8 : 1), lh * 0.5);
}
function hazard(g: G, x: number, y: number, w: number, h: number) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = '#ffcf2e';
  g.fillRect(x, y, w, h);
  g.fillStyle = '#16141c';
  for (let k = -h; k < w + h; k += h * 1.4) {
    g.beginPath();
    g.moveTo(x + k, y + h);
    g.lineTo(x + k + h * 0.7, y + h);
    g.lineTo(x + k + h * 1.4, y);
    g.lineTo(x + k + h * 0.7, y);
    g.closePath();
    g.fill();
  }
  g.restore();
}
function gauge(g: G, cx: number, cy: number, r: number, face: string, tick: string, a: number) {
  g.fillStyle = '#16141c';
  g.beginPath();
  g.arc(cx, cy, r + 2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = face;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = tick;
  g.lineWidth = Math.max(1.5, r * 0.18);
  g.beginPath();
  g.arc(cx, cy, r * 0.7, Math.PI * 0.8, Math.PI * 1.9);
  g.stroke();
  g.strokeStyle = '#16141c';
  g.lineWidth = Math.max(1.2, r * 0.12);
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8);
  g.stroke();
}
function vents(g: G, x: number, y: number, w: number, h: number, n: number, col: string, slot: string) {
  rr(g, x, y, w, h, 2, col);
  const step = h / n;
  g.fillStyle = slot;
  for (let k = 0; k < n; k++) g.fillRect(x + 3, y + k * step + step * 0.3, w - 6, step * 0.4);
}
/** a made-up machine-readable code block */
function code(g: G, x: number, y: number, s: number, col: string, bg: string) {
  rr(g, x - 2, y - 2, s + 4, s + 4, 1, bg);
  g.fillStyle = col;
  const n = 7;
  const c = s / n;
  let seed = 7;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      seed = (seed * 9301 + 49297) % 233280;
      const corner = (i < 2 && j < 2) || (i < 2 && j > 4) || (i > 4 && j < 2);
      if (corner || seed / 233280 > 0.55) g.fillRect(x + i * c, y + j * c, c, c);
    }
}
function star(g: G, cx: number, cy: number, r: number, col: string) {
  g.fillStyle = col;
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rad = k % 2 ? r * 0.42 : r;
    g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  g.closePath();
  g.fill();
}

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k < 1 ? v * k : v + (255 - v) * (k - 1))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')}`;
};

/** the numbered units, Seraph (001) and True Leo King (002): numbers, warnings, gauges and labels */
const UNIT: Record<string, Pic> = {
  /** the chest: the unit number on a plate, a star over it when the arg asks (`001*`) */
  chest: {
    w: 160,
    h: 110,
    hi: true,
    draw: (g, _px, c, arg) => {
      const num = arg.replace('*', '');
      const plate = shade(c.base, 0.86);
      // panel seams
      g.fillStyle = shade(c.base, 0.72);
      g.fillRect(10, 8, 3, 94);
      g.fillRect(147, 8, 3, 94);
      g.fillRect(16, 100, 128, 3);
      if (arg.includes('*')) star(g, 80, 22, 13, c.mark);
      const cell = 8;
      const w = numW(num, cell);
      rr(g, 80 - w / 2 - 9, 40, w + 18, cell * 5 + 12, 5, plate);
      numerals(g, num, 80 - w / 2, 46, cell, c.mark);
      // a small warning tick each side
      chevrons(g, 24, 52, 11, 2, plate);
      g.save();
      g.translate(160, 0);
      g.scale(-1, 1);
      chevrons(g, 24, 52, 11, 2, plate);
      g.restore();
    },
  },
  /** the helmet's front: a crest of chevrons up the forehead, vents either side */
  helm: {
    w: 128,
    h: 110,
    hi: true,
    draw: (g, _px, c) => {
      g.fillStyle = c.print;
      g.fillRect(52, 0, 24, 60);
      for (let k = 0; k < 4; k++) {
        const y = 8 + k * 12;
        g.fillStyle = c.base;
        g.beginPath();
        g.moveTo(56, y);
        g.lineTo(64, y + 6);
        g.lineTo(72, y);
        g.lineTo(72, y + 4);
        g.lineTo(64, y + 10);
        g.lineTo(56, y + 4);
        g.closePath();
        g.fill();
      }
      chevrons(g, 14, 22, 10, 2, c.print);
      g.save();
      g.translate(128, 0);
      g.scale(-1, 1);
      chevrons(g, 14, 22, 10, 2, c.print);
      g.restore();
    },
  },
  /** a side of the head: a code block and a line of print */
  tag: {
    w: 96,
    h: 96,
    hi: true,
    draw: (g, _px, c) => {
      code(g, 56, 30, 22, '#16141c', shade(c.base, 1.15));
      print(g, 20, 34, 26, 4, shade(c.base, 0.62), 5);
    },
  },
  /** a shoulder pad: the number large, a chevron run and a label over it, thin bands */
  pad: {
    w: 128,
    h: 120,
    hi: true,
    draw: (g, _px, c, num) => {
      g.fillStyle = c.print;
      g.fillRect(0, 0, 128, 7);
      g.fillRect(0, 108, 128, 12);
      g.fillStyle = shade(c.base, 0.8);
      g.fillRect(0, 104, 128, 3);
      chevrons(g, 72, 20, 11, 3, c.print);
      print(g, 22, 21, 36, 3, shade(c.base, 0.62), 4);
      const cell = 7;
      const w = numW(num, cell);
      numerals(g, num, 64 - w / 2, 46, cell, c.print);
    },
  },
  /** the back: a framed hatch, hazard band, three gauges, a screen, vents */
  hatch: {
    w: 128,
    h: 132,
    hi: true,
    draw: (g, _px, c) => {
      rr(g, 8, 6, 112, 120, 6, '#2e2c38');
      rr(g, 13, 11, 102, 110, 4, '#e4ded0');
      hazard(g, 18, 16, 92, 10);
      rr(g, 18, 31, 92, 36, 3, '#1f1d27');
      gauge(g, 34, 49, 11, '#f2f0ea', c.print, 2.2);
      gauge(g, 64, 49, 11, '#f2f0ea', '#3ac8ff', 0.4);
      gauge(g, 94, 49, 11, '#f2f0ea', '#ff5a3a', -0.6);
      rr(g, 48, 72, 32, 12, 2, '#16141c');
      g.fillStyle = c.eye;
      g.fillRect(51, 75, 26, 6);
      for (const [x, col] of [[24, '#3aff6a'], [32, '#ffcf2e'], [96, '#ff3a4a'], [104, '#3ac8ff']] as const) {
        g.fillStyle = col;
        g.fillRect(x, 75, 5, 5);
      }
      vents(g, 20, 89, 36, 26, 5, '#2e2c38', '#0e0d12');
      vents(g, 72, 89, 36, 26, 5, '#2e2c38', '#0e0d12');
      rr(g, 58, 96, 12, 12, 2, c.print);
    },
  },
  /** a side of the chest: a handheld-style unit with a screen and a row of lights */
  device: {
    w: 96,
    h: 110,
    hi: true,
    draw: (g, _px, c) => {
      rr(g, 26, 14, 44, 82, 6, '#2e2c38');
      rr(g, 31, 19, 34, 40, 3, '#e4ded0');
      rr(g, 35, 23, 26, 32, 2, '#16141c');
      g.fillStyle = c.eye;
      g.fillRect(38, 27, 20, 4);
      g.fillStyle = '#3ac8ff';
      g.fillRect(38, 35, 14, 3);
      g.fillRect(38, 41, 18, 3);
      for (const [k, col] of ['#3aff6a', '#ffcf2e', '#ff3a4a', '#3aff6a'].entries()) {
        g.fillStyle = col;
        g.fillRect(34 + k * 8, 66, 5, 5);
      }
      print(g, 34, 78, 28, 3, '#8a8696', 4);
    },
  },
  /** a shin: a dark label with a crest and print, a warning tick at the foot */
  shin: {
    w: 96,
    h: 110,
    hi: true,
    draw: (g, _px, c) => {
      rr(g, 24, 16, 48, 46, 5, '#1f1d27');
      g.strokeStyle = c.print;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(48, 32, 9, 0, Math.PI * 2);
      g.stroke();
      star(g, 48, 32, 5, c.print);
      print(g, 31, 47, 34, 3, '#8a8696', 4);
      g.fillStyle = c.print;
      g.fillRect(24, 70, 48, 4);
      g.beginPath();
      g.moveTo(36, 82);
      g.lineTo(60, 82);
      g.lineTo(48, 94);
      g.closePath();
      g.fill();
    },
  },
  /** an upper arm: a chevron run and a short label */
  arm: {
    w: 96,
    h: 96,
    hi: true,
    draw: (g, _px, c) => {
      chevrons(g, 20, 30, 14, 3, c.print);
      print(g, 20, 56, 44, 3, shade(c.base, 0.62), 5);
    },
  },
  /** a hip plate: a gold warning triangle */
  hip: {
    w: 64,
    h: 64,
    hi: true,
    draw: (g, _px, c) => {
      g.fillStyle = c.print;
      g.beginPath();
      g.moveTo(16, 22);
      g.lineTo(48, 22);
      g.lineTo(32, 44);
      g.closePath();
      g.fill();
    },
  },
};

const PICS: Record<string, Pic> = { ...LEO, ...UNIT };

const cache = new Map<string, THREE.Texture>();
/** printed art is drawn at twice its size, for clean edges up close */
const HI = 2;
const hex = (n: number) => `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;

/** is this a painted texture name (rather than a tonal armour pattern)? */
export const isPainted = (tex: string | undefined) => !!tex && (tex.startsWith('decal:') || tex.startsWith('paint:') || tex.startsWith('sheet:') || isKit(tex));
/** a kit block's texture is made for the block itself, once the model stands whole (see paintKit) */
export const isKit = (tex: string | undefined) => !!tex && (tex === 'kit' || tex.startsWith('kit+'));

/**
 * `decal:<name>[~<arg>][@<faces>]`, several joined with `+` for different pictures on different
 * faces (`decal:chest~002+hatch@back`). Faces are front (the default), back, ring (front, back and
 * both sides), xpos or xneg (the side facing +x or -x). `paint:<name>` takes one picture.
 */
interface Part {
  name: string;
  arg: string;
  faces: string;
  pic: Pic;
}
const parse = (tex: string) => {
  const [kind, rest] = tex.split(/:(.*)/s);
  const parts: Part[] = [];
  for (const one of rest.split('+')) {
    const [head, faces = 'front'] = one.split('@');
    const [name, arg = '001'] = head.split('~');
    if (PICS[name]) parts.push({ name, arg, faces, pic: PICS[name] });
  }
  return { kind, parts };
};
/**
 * a decal's pictures side by side on one sheet, a gap of the block's colour between them (so
 * smooth filtering doesn't bleed one into the next), then spare columns of it for the bare faces
 */
const sheet = (parts: Part[]) => {
  const hi = parts.some((p) => p.pic.hi);
  const gap = hi ? 8 : 0;
  const spare = hi ? 8 : 2;
  let x = 0;
  const at = parts.map((p) => {
    const k = p.pic.hi ? HI : 1;
    const r = { x, w: p.pic.w * k, h: p.pic.h * k, k };
    x += r.w + gap;
    return r;
  });
  return { at, W: x + spare, H: Math.max(...at.map((r) => r.h)), spare, hi };
};

const lum = (n: number) => (0.3 * ((n >> 16) & 255) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255;
export function paintedTexture(tex: string, palette: { body: number; trim: number; accent: number; joint: number; eye: number }, base: number) {
  if (isKit(tex)) return null;
  if (tex.startsWith('sheet:')) return sheetTexture(tex);
  const { kind, parts } = parse(tex);
  if (!parts.length) return null;
  const tile = kind === 'paint';
  // markings: the first of accent, body or cream that stands out from the block
  const mark = [palette.accent, palette.body, 0xf2ead8].find((c) => Math.abs(lum(c) - lum(base)) > 0.25) ?? 0xf2ead8;
  // printing: the accent if it's a strong colour that shows on the block, else gold, else the marking colour
  const sat = (n: number) => {
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return (Math.max(...ch) - Math.min(...ch)) / 255;
  };
  const prn = [sat(palette.accent) > 0.3 ? palette.accent : -1, 0xf2b440].find((c) => c >= 0 && Math.abs(lum(c) - lum(base)) > 0.18) ?? mark;
  const pal: Pal = { base: hex(base), mark: hex(mark), print: hex(prn), body: hex(palette.body), trim: hex(palette.trim), accent: hex(palette.accent), joint: hex(palette.joint), eye: hex(palette.eye) };
  const key = `${tex}|${Object.values(pal).join('')}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  const sh = tile ? { at: [{ x: 0, w: parts[0].pic.w, h: parts[0].pic.h, k: 1 }], W: parts[0].pic.w, H: parts[0].pic.h, hi: false } : sheet(parts);
  c.width = sh.W;
  c.height = sh.H;
  const g = c.getContext('2d')!;
  g.fillStyle = pal.base;
  g.fillRect(0, 0, sh.W, sh.H);
  sh.at.forEach((r, n) => {
    const part = parts[n];
    g.save();
    g.translate(r.x, 0);
    g.scale(r.k, r.k);
    part.pic.draw(
      g,
      (x, y, w, h, col) => {
        g.fillStyle = col;
        g.fillRect(x, y, w, h);
      },
      pal,
      part.arg,
    );
    g.restore();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (sh.hi) {
    // printed art: smooth, and kept sharp at a glancing angle
    t.anisotropy = 4;
  } else {
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
  }
  if (tile) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set(key, t);
  return t;
}

/**
 * texture coordinates for a painted block: each decal spans the faces it's on once, the other
 * faces show the block's own colour; a tiling paint is projected per face at a fixed size
 */
export function paintedUV(g: THREE.BufferGeometry, tex: string, scale = 1, place?: THREE.Matrix4) {
  const src = g.attributes.position;
  const srcN = g.attributes.normal;
  if (!src || !srcN) return;
  // (read the faces as the block sits in the fighter, turned and flipped, so front means the fighter's front)
  const m = place ? place.clone().setPosition(0, 0, 0) : new THREE.Matrix4();
  const pos = src.clone().applyMatrix4(m);
  const nor = srcN.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(m));
  const { kind, parts } = parse(tex);
  if (!parts.length) return;
  const uv = new Float32Array(pos.count * 2);
  if (kind === 'paint') {
    // so many pixels a unit: the same size on every block
    const pic = parts[0].pic;
    const ku = (8 * scale) / pic.w;
    const kv = (8 * scale) / pic.h;
    for (let i = 0; i < pos.count; i++) {
      const [ax, ay, az] = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))];
      const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      if (ax >= ay && ax >= az) uv.set([z * ku, y * kv], i * 2);
      else if (ay >= az) uv.set([x * ku, z * kv], i * 2);
      else uv.set([x * ku, y * kv], i * 2);
    }
  } else {
    const { at: rects, W, H, spare } = sheet(parts);
    // which picture a side shows, and where that picture sits on the sheet
    const owner: Record<string, { u0: number; du: number; v0: number; dv: number }> = {};
    parts.forEach((part, n) => {
      const r = rects[n];
      const at = { u0: r.x / W, du: r.w / W, v0: 1 - r.h / H, dv: r.h / H };
      for (const sd of part.faces === 'ring' ? ['front', 'back', 'xpos', 'xneg'] : [part.faces]) owner[sd] ??= at;
    });
    const span = (a: number, lo: number, hi: number) => (a - lo) / (hi - lo || 1);
    const sideOf = (i: number) => {
      const [nx, nz] = [nor.getX(i), nor.getZ(i)];
      return nz < -0.7 ? 'front' : nz > 0.7 ? 'back' : nx > 0.7 ? 'xpos' : nx < -0.7 ? 'xneg' : '';
    };
    // each side's picture spans just the faces turned that way (a bevelled block's flat front, not its whole height)
    const boxes: Record<string, THREE.Box3> = {};
    const v3 = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const sd = sideOf(i);
      if (sd && owner[sd]) (boxes[sd] ??= new THREE.Box3()).expandByPoint(v3.fromBufferAttribute(pos, i));
    }
    // (the spare columns of the block's colour)
    const cu = 1 - spare / 2 / W;
    for (let i = 0; i < pos.count; i++) {
      const sd = sideOf(i);
      const at = sd ? owner[sd] : undefined;
      if (!at) {
        uv.set([cu, 0.5], i * 2);
        continue;
      }
      const bb = boxes[sd];
      const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      // seen from straight on, each face's own left-to-right
      const u = sd === 'front' ? 1 - span(x, bb.min.x, bb.max.x) : sd === 'back' ? span(x, bb.min.x, bb.max.x) : sd === 'xpos' ? 1 - span(z, bb.min.z, bb.max.z) : span(z, bb.min.z, bb.max.z);
      uv.set([at.u0 + Math.min(u, 0.999) * at.du, at.v0 + span(y, bb.min.y, bb.max.y) * at.dv], i * 2);
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// ---- kit: every face of a block panelled like a model kit, each face drawn to its own size ----

/** a conical lab flask in a ring: the makers' mark */
function flask(g: G, cx: number, cy: number, r: number, col: string) {
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineWidth = Math.max(1, r * 0.12);
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(cx - r * 0.18, cy - r * 0.62);
  g.lineTo(cx + r * 0.18, cy - r * 0.62);
  g.lineTo(cx + r * 0.18, cy - r * 0.15);
  g.lineTo(cx + r * 0.55, cy + r * 0.5);
  g.lineTo(cx - r * 0.55, cy + r * 0.5);
  g.lineTo(cx - r * 0.18, cy - r * 0.15);
  g.closePath();
  g.fill();
}

/** a small, steady number from a string, for choosing a face's details the same way every time */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/** a panelled face, w by h pixels: an inset panel line, a seam on a long face, rivets, and maybe one detail */
function panel(g: G, w: number, h: number, c: Pal, seed: string) {
  g.fillStyle = c.base;
  g.fillRect(0, 0, w, h);
  if (w < 14 || h < 14) return;
  const line = shade(c.base, 0.66);
  const inset = Math.max(4, Math.min(w, h) * 0.07);
  g.strokeStyle = line;
  g.lineWidth = 2.5;
  g.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  const r = (k: number) => hash(seed + k);
  // a seam across a long face
  if (w > 70 && w > h * 1.3) {
    const x = w * (0.35 + r(1) * 0.3);
    g.beginPath();
    g.moveTo(x, inset);
    g.lineTo(x, h - inset);
    g.stroke();
  } else if (h > 70 && h > w * 1.3) {
    const y = h * (0.35 + r(1) * 0.3);
    g.beginPath();
    g.moveTo(inset, y);
    g.lineTo(w - inset, y);
    g.stroke();
  }
  // rivets
  if (w > 30 && h > 30) {
    g.fillStyle = shade(c.base, 0.6);
    const d = inset + 6;
    for (const [x, y] of [[d, d], [w - d, d], [d, h - d], [w - d, h - d]]) {
      g.beginPath();
      g.arc(x, y, 2.6, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (w < 56 || h < 48) return;
  // one detail, or none
  const pick = r(2);
  const s = Math.min(w, h);
  const cx = w * (0.3 + r(3) * 0.4);
  const cy = h * (0.3 + r(4) * 0.4);
  if (pick < 0.12) hazard(g, inset + 6, (r(5) < 0.5 ? inset + 5 : h - inset - 5 - s * 0.1), Math.min(w * 0.5, 90), Math.max(4, s * 0.1));
  else if (pick < 0.24) {
    // a band of the printing colour along one edge, hatched with the block's colour
    const bw = Math.max(8, s * 0.16);
    const side = Math.floor(r(6) * 3);
    const [bx, by, bwid, bht] = side === 0 ? [inset, inset, bw, h - inset * 2] : side === 1 ? [w - inset - bw, inset, bw, h - inset * 2] : [inset, h - inset - bw, w - inset * 2, bw];
    g.save();
    g.beginPath();
    g.rect(bx, by, bwid, bht);
    g.clip();
    g.fillStyle = c.print;
    g.fillRect(bx, by, bwid, bht);
    g.strokeStyle = c.base;
    g.lineWidth = bw * 0.22;
    for (let k = -Math.max(w, h); k < Math.max(w, h) * 2; k += bw * 0.7) {
      g.beginPath();
      g.moveTo(bx + k, by + bht);
      g.lineTo(bx + k + bht, by);
      g.stroke();
    }
    g.restore();
  } else if (pick < 0.32) {
    // twin racing stripes down the long way
    g.fillStyle = c.print;
    const t = Math.max(4, s * 0.09);
    if (h >= w) {
      g.fillRect(w / 2 - t * 1.6, 0, t, h);
      g.fillRect(w / 2 + t * 0.6, 0, t, h);
    } else {
      g.fillRect(0, h / 2 - t * 1.6, w, t);
      g.fillRect(0, h / 2 + t * 0.6, w, t);
    }
  } else if (pick < 0.4) star(g, cx, cy, s * 0.16, c.mark);
  else if (pick < 0.48) flask(g, cx, cy, s * 0.16, c.mark);
  else if (pick < 0.58) {
    const lw = Math.min(w * 0.42, 70);
    const lh = Math.min(h * 0.3, 36);
    rr(g, cx - lw / 2, cy - lh / 2, lw, lh, 3, '#1f1d27');
    print(g, cx - lw / 2 + 5, cy - lh / 2 + 5, lw - 10, Math.max(1, Math.floor((lh - 8) / 5)), '#8a8696', 5);
  } else if (pick < 0.7) chevrons(g, cx - s * 0.2, cy - s * 0.07, s * 0.14, 3, c.print);
  else if (pick < 0.78) code(g, w - inset - 6 - s * 0.18, inset + 6, s * 0.18, '#16141c', shade(c.base, 1.15));
  else {
    g.fillStyle = c.print;
    g.fillRect(inset + 6, h - inset - 9, w * 0.35, 2.5);
    g.fillRect(inset + 6, h - inset - 5, w * 0.22, 2.5);
  }
}

type Side = 'front' | 'back' | 'xpos' | 'xneg' | 'top' | 'bottom';
const PPU = 160;
/** kit textures by what they show, so copies of the same fighter share them */
const kitCache = new Map<string, THREE.Texture>();
/**
 * `kit` or `kit+<decal parts>`: panels every face of the block, each drawn at its real size (so
 * rivets stay round), and puts the named decals on their faces. Sets the block's texture
 * coordinates and returns its own texture.
 */
export function paintKit(
  geo: THREE.BufferGeometry,
  tex: string,
  palette: { body: number; trim: number; accent: number; joint: number; eye: number },
  base: number,
  place: THREE.Matrix4,
  seed: string,
) {
  const src = geo.attributes.position;
  const srcN = geo.attributes.normal;
  if (!src || !srcN) return null;
  const m = place.clone().setPosition(0, 0, 0);
  const pos = src.clone().applyMatrix4(m);
  const nor = srcN.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(m));
  const sideOf = (i: number): Side | '' => {
    const [nx, ny, nz] = [nor.getX(i), nor.getY(i), nor.getZ(i)];
    return nz < -0.7 ? 'front' : nz > 0.7 ? 'back' : nx > 0.7 ? 'xpos' : nx < -0.7 ? 'xneg' : ny > 0.7 ? 'top' : ny < -0.7 ? 'bottom' : '';
  };
  const boxes: Partial<Record<Side, THREE.Box3>> = {};
  const v3 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const sd = sideOf(i);
    if (sd) (boxes[sd] ??= new THREE.Box3()).expandByPoint(v3.fromBufferAttribute(pos, i));
  }
  // the decals asked for, by face
  const decals = tex.includes('+') ? parse('decal:' + tex.slice(tex.indexOf('+') + 1)).parts : [];
  const owner: Partial<Record<Side, Part>> = {};
  for (const p of decals) for (const sd of p.faces === 'ring' ? ['front', 'back', 'xpos', 'xneg'] : [p.faces]) owner[sd as Side] ??= p;
  // lay the faces out in a row, each its own size
  const dims = (sd: Side, b: THREE.Box3) => {
    const s = b.getSize(new THREE.Vector3());
    return sd === 'front' || sd === 'back' ? [s.x, s.y] : sd === 'xpos' || sd === 'xneg' ? [s.z, s.y] : [s.x, s.z];
  };
  const GAP = 4;
  let x = 0;
  const rects: Partial<Record<Side, { x: number; w: number; h: number }>> = {};
  for (const sd of Object.keys(boxes) as Side[]) {
    const p = owner[sd];
    const [fw, fh] = dims(sd, boxes[sd]!);
    const w = p ? p.pic.w * (p.pic.hi ? HI : 1) : Math.max(4, Math.min(300, Math.round(fw * PPU)));
    const h = p ? p.pic.h * (p.pic.hi ? HI : 1) : Math.max(4, Math.min(300, Math.round(fh * PPU)));
    rects[sd] = { x, w, h };
    x += w + GAP;
  }
  const W = x + 6;
  const H = Math.max(8, ...Object.values(rects).map((r) => r!.h));
  const mark = [palette.accent, palette.body, 0xf2ead8].find((c) => Math.abs(lum(c) - lum(base)) > 0.25) ?? 0xf2ead8;
  const sat = (n: number) => {
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return (Math.max(...ch) - Math.min(...ch)) / 255;
  };
  const prn = [sat(palette.accent) > 0.3 ? palette.accent : -1, 0xf2b440].find((c) => c >= 0 && Math.abs(lum(c) - lum(base)) > 0.18) ?? mark;
  const pal: Pal = { base: hex(base), mark: hex(mark), print: hex(prn), body: hex(palette.body), trim: hex(palette.trim), accent: hex(palette.accent), joint: hex(palette.joint), eye: hex(palette.eye) };
  const key = `${tex}|${seed}|${Object.values(pal).join('')}|${JSON.stringify(rects)}`;
  let t = kitCache.get(key);
  if (!t) {
    t = drawKit(W, H, rects, owner, pal, seed);
    kitCache.set(key, t);
  }
  setKitUV(geo, pos, sideOf, boxes, rects, W, H);
  return t;
}

function drawKit(W: number, H: number, rects: Partial<Record<Side, { x: number; w: number; h: number }>>, owner: Partial<Record<Side, Part>>, pal: Pal, seed: string) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = pal.base;
  g.fillRect(0, 0, W, H);
  for (const sd of Object.keys(rects) as Side[]) {
    const r = rects[sd]!;
    const p = owner[sd];
    g.save();
    g.translate(r.x, 0);
    g.beginPath();
    g.rect(0, 0, r.w, r.h);
    g.clip();
    if (p) {
      const k = p.pic.hi ? HI : 1;
      g.scale(k, k);
      p.pic.draw(
        g,
        (px, py, pw, ph, col) => {
          g.fillStyle = col;
          g.fillRect(px, py, pw, ph);
        },
        pal,
        p.arg,
      );
    } else panel(g, r.w, r.h, pal, seed + sd);
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** texture coordinates: each face across its own rectangle */
function setKitUV(
  geo: THREE.BufferGeometry,
  pos: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  sideOf: (i: number) => Side | '',
  boxes: Partial<Record<Side, THREE.Box3>>,
  rects: Partial<Record<Side, { x: number; w: number; h: number }>>,
  W: number,
  H: number,
) {
  const span = (a: number, lo: number, hi: number) => (a - lo) / (hi - lo || 1);
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const sd = sideOf(i);
    const r = sd ? rects[sd] : undefined;
    if (!sd || !r) {
      uv.set([1 - 3 / W, 0.5], i * 2);
      continue;
    }
    const bb = boxes[sd]!;
    const [px, py, pz] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    // seen from straight on, each face's own left-to-right and bottom-to-top
    let u: number;
    let v: number;
    if (sd === 'front') [u, v] = [1 - span(px, bb.min.x, bb.max.x), span(py, bb.min.y, bb.max.y)];
    else if (sd === 'back') [u, v] = [span(px, bb.min.x, bb.max.x), span(py, bb.min.y, bb.max.y)];
    else if (sd === 'xpos') [u, v] = [1 - span(pz, bb.min.z, bb.max.z), span(py, bb.min.y, bb.max.y)];
    else if (sd === 'xneg') [u, v] = [span(pz, bb.min.z, bb.max.z), span(py, bb.min.y, bb.max.y)];
    else if (sd === 'top') [u, v] = [1 - span(px, bb.min.x, bb.max.x), span(pz, bb.min.z, bb.max.z)];
    else [u, v] = [1 - span(px, bb.min.x, bb.max.x), 1 - span(pz, bb.min.z, bb.max.z)];
    const uu = Math.min(Math.max(u, 0.002), 0.998);
    const vv = Math.min(Math.max(v, 0.002), 0.998);
    uv.set([(r.x + uu * r.w) / W, 1 - (r.h - vv * r.h) / H], i * 2);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// ---- painted sheets: a fighter's whole texture painted by hand on its decal template ----

/**
 * Each sheet is the fighter's decal template (art/decal-templates) painted over: every face of
 * every armour block sits at its place in the layout, so a face reads its own rectangle.
 */
const SHEET_URL: Record<string, string> = { seraph: seraphSheet, trueleo: trueLeoSheet };
type Layout = { w: number; h: number; faces: Record<string, Partial<Record<Side, [number, number, number, number]>>> };
const LAYOUT = SHEETS as unknown as Record<string, Layout>;
const sheetTex = new Map<string, THREE.Texture>();
const sheetLoads: Promise<void>[] = [];
for (const [name, url] of Object.entries(SHEET_URL)) {
  const img = new Image();
  const t = new THREE.Texture(img);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  sheetTex.set(name, t);
  sheetLoads.push(
    new Promise<void>((done) => {
      img.onload = () => {
        t.needsUpdate = true;
        done();
      };
      img.onerror = () => done();
    }),
  );
  img.src = url;
}
/** resolves once every painted sheet has loaded (the game waits for it behind the loading screen) */
export const sheetsReady = Promise.all(sheetLoads).then(() => undefined);
export const isSheet = (tex: string | undefined) => !!tex && tex.startsWith('sheet:');
export const sheetTexture = (tex: string) => sheetTex.get(tex.slice(6)) ?? null;

/** texture coordinates for a block on a painted sheet: each face across its rectangle on the sheet */
export function sheetUV(geo: THREE.BufferGeometry, tex: string, path: string, place: THREE.Matrix4) {
  const L = LAYOUT[tex.slice(6)];
  const rects = L?.faces[path];
  const src = geo.attributes.position;
  const srcN = geo.attributes.normal;
  if (!rects || !src || !srcN) return;
  const m = place.clone().setPosition(0, 0, 0);
  const pos = src.clone().applyMatrix4(m);
  const nor = srcN.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(m));
  const sideOf = (i: number): Side | '' => {
    const [nx, ny, nz] = [nor.getX(i), nor.getY(i), nor.getZ(i)];
    return nz < -0.7 ? 'front' : nz > 0.7 ? 'back' : nx > 0.7 ? 'xpos' : nx < -0.7 ? 'xneg' : ny > 0.7 ? 'top' : ny < -0.7 ? 'bottom' : '';
  };
  const boxes: Partial<Record<Side, THREE.Box3>> = {};
  const v3 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const sd = sideOf(i);
    if (sd) (boxes[sd] ??= new THREE.Box3()).expandByPoint(v3.fromBufferAttribute(pos, i));
  }
  // a face too thin to be on the sheet takes the colour at the middle of the block's biggest face
  const big = Object.values(rects).sort((a, b) => b![2] * b![3] - a![2] * a![3])[0]!;
  const solid = [(big[0] + big[2] / 2) / L.w, 1 - (big[1] + big[3] / 2) / L.h];
  const span = (a: number, lo: number, hi: number) => (a - lo) / (hi - lo || 1);
  // (a little in from each edge, so smooth sampling stays inside the painted shape)
  const IN = 0.03;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const sd = sideOf(i);
    const r = sd ? rects[sd] : undefined;
    if (!sd || !r) {
      uv.set(solid, i * 2);
      continue;
    }
    const bb = boxes[sd]!;
    const [px, py, pz] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    // the same unfolding as the template: each face seen straight on
    let u: number;
    let v: number;
    if (sd === 'front') [u, v] = [1 - span(px, bb.min.x, bb.max.x), span(py, bb.min.y, bb.max.y)];
    else if (sd === 'back') [u, v] = [span(px, bb.min.x, bb.max.x), span(py, bb.min.y, bb.max.y)];
    else if (sd === 'xpos') [u, v] = [1 - span(pz, bb.min.z, bb.max.z), span(py, bb.min.y, bb.max.y)];
    else if (sd === 'xneg') [u, v] = [span(pz, bb.min.z, bb.max.z), span(py, bb.min.y, bb.max.y)];
    else if (sd === 'top') [u, v] = [1 - span(px, bb.min.x, bb.max.x), span(pz, bb.min.z, bb.max.z)];
    else [u, v] = [1 - span(px, bb.min.x, bb.max.x), 1 - span(pz, bb.min.z, bb.max.z)];
    u = IN + u * (1 - IN * 2);
    v = IN + v * (1 - IN * 2);
    // on the sheet the face's top is its rectangle's top
    uv.set([(r[0] + u * r[2]) / L.w, 1 - (r[1] + (1 - v) * r[3]) / L.h], i * 2);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// ---- pixel: every face hand-pixelled like a low-poly game model (chunky texels, a lit top rim,
// dithered shade at the foot, glowing stripes and little pixel marks) ----

/** texels per world unit: chunky on purpose */
const TPU = 52;
const pixelCache = new Map<string, THREE.Texture>();
/** the pixel style is on for models built from now on */
let pixelOn = false;
export const setPixelStyle = (on: boolean) => {
  pixelOn = on;
};
export const pixelStyle = () => pixelOn;

/**
 * one face, w by h texels, in the low-poly "technic" manner (lit from above and to the left):
 * - light steps down the face (a top face lit, a bottom one dark), and a bevel round its edge
 * - a big face turns: a second, darker tone across its lower corner
 * - an accent light in a front face's corner (mirrored on the body's left side, so pairs match)
 * A painted face (over a picture) takes only the light and the bevel.
 */
/**
 * A face that isn't its whole rectangle (a wedge, a trapezoid): whether a point (in texels) is on
 * it, and how far it is in from its nearest edge, with that edge's inward direction.
 */
interface FaceShape {
  inside(x: number, y: number): boolean;
  near(x: number, y: number): { d: number; nx: number; ny: number };
  /** the same, measured on the fine grid (see FINE), for drawing the lines */
  field: { on: Uint8Array; dist: Float32Array; nxs: Float32Array; nys: Float32Array; W2: number; H2: number };
}
/** sub-texels a texel on a block with a slanted face (its lines are drawn at this grain) */
const FINE = 4;

/** a CSS colour as [r, g, b, a] (0-255, alpha 0-1) */
const rgbaCache = new Map<string, [number, number, number, number]>();
let rgbaCtx: CanvasRenderingContext2D | null = null;
function rgbaOf(col: string): [number, number, number, number] {
  let v = rgbaCache.get(col);
  if (v) return v;
  rgbaCtx ??= document.createElement('canvas').getContext('2d')!;
  rgbaCtx.fillStyle = '#000';
  rgbaCtx.fillStyle = col;
  const f = rgbaCtx.fillStyle as string;
  if (f.startsWith('#')) v = [parseInt(f.slice(1, 3), 16), parseInt(f.slice(3, 5), 16), parseInt(f.slice(5, 7), 16), 1];
  else {
    const n = f.match(/[\d.]+/g)!.map(Number);
    v = [n[0], n[1], n[2], n[3] ?? 1];
  }
  rgbaCache.set(col, v);
  return v;
}

function pixelFace(g: G, w: number, h: number, base: number, side: Side, over = false, mirror = false, accent = '#3ff0d0', sym = false, shape: FaceShape | null = null, ss = 1, ox = 0) {
  const b = hex(base);
  const L = lum(base);
  // (a dark part needs a lift to show its shape; a light one needs less). Over a painted picture
  // the light and shade are laid on as white and black, so the picture shows through
  const up = (k: number) => (over ? `rgba(255,255,255,${Math.min(0.9, k * 1.1)})` : shade(b, 1 + (L < 0.2 ? k * 1.6 : L > 0.8 ? k * 0.35 : k)));
  const down = (k: number) => (over ? `rgba(0,0,0,${Math.min(0.9, k * 1.05)})` : shade(b, 1 - (L < 0.2 ? k * 0.7 : k)));
  const fill = (x: number, y: number, ww: number, hh: number, col: string) => {
    if (ww <= 0 || hh <= 0) return;
    g.fillStyle = col;
    g.fillRect(x, y, ww, hh);
  };
  /**
   * How far in from the face's own outline a texel sits (1 on the edge, 0 outside it). The face
   * isn't always the whole rectangle: a wedge or a trapezoid covers part of it, and every line
   * (the bevel, the engraved inset, the marks) follows its real shape, not the rectangle's.
   */
  const D = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    if (!shape) return Math.min(x + 1, y + 1, w - x, h - y);
    const cx = x + 0.5;
    const cy = y + 0.5;
    return shape.inside(cx, cy) ? Math.floor(shape.near(cx, cy).d + 0.5) + 1 : 0;
  };
  /**
   * A slanted face's lines are drawn on the finer grid (ss sub-texels a texel), from each point's
   * true distance to the face's edges, so they run straight along a slant instead of stepping.
   * `paint` picks a colour from that distance and the nearest edge's inward direction (or none).
   */
  const fine = (paint: (d: number, nx: number, ny: number) => string | null) => {
    if (!shape) return;
    const { on, dist, nxs, nys, W2, H2 } = shape.field;
    void ss;
    const img = g.getImageData(ox, 0, W2, H2);
    const px = img.data;
    for (let j = 0; j < H2; j++)
      for (let i = 0; i < W2; i++) {
        const f = j * W2 + i;
        if (!on[f]) continue;
        const col = paint(dist[f], nxs[f], nys[f]);
        if (!col) continue;
        const [r, gg, bb, a] = rgbaOf(col);
        const k = (j * W2 + i) * 4;
        px[k] = px[k] * (1 - a) + r * a;
        px[k + 1] = px[k + 1] * (1 - a) + gg * a;
        px[k + 2] = px[k + 2] * (1 - a) + bb * a;
        px[k + 3] = 255;
      }
    g.putImageData(img, ox, 0);
  };
  /** a mark: drawn only where it's this far inside the face, so nothing is cut off by a slanted edge */
  const mark = (x: number, y: number, ww: number, hh: number, col: string, minD = 2) => {
    if (ww <= 0 || hh <= 0) return;
    g.fillStyle = col;
    for (let yy = Math.max(0, y); yy < Math.min(h, y + hh); yy++) for (let xx = Math.max(0, x); xx < Math.min(w, x + ww); xx++) if (D(xx, yy) >= minD) g.fillRect(xx, yy, 1, 1);
  };
  // (marks are placed from the face's inner edge, mirrored for the body's other side)
  const X = (x: number) => (mirror ? w - 1 - x : x);
  // (a face on the body's centre line carries every mark on both halves)
  const dot = (x: number, y: number, col: string, t = 1) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    mark(mirror ? w - x - t : x, y, t, t, col);
    if (sym) mark(mirror ? x : w - x - t, y, t, t, col);
  };
  // the light across the face: three steps, top to foot
  if (side === 'top') fill(0, 0, w, h, up(0.14));
  else if (side === 'bottom') fill(0, 0, w, h, down(0.38));
  else {
    if (!over) fill(0, 0, w, h, b);
    if (h >= 6) {
      fill(0, 0, w, Math.round(h * 0.25), up(0.07));
      fill(0, Math.round(h * 0.82), w, h, down(0.12));
    }
  }
  if (w < 3 || h < 3) return;
  // the bevel: round the face's own outline, lit where the edge faces up or left, shaded where it
  // faces down or right
  const bevel = () => {
    const cols = {
      top: side === 'bottom' ? down(0.25) : up(0.34),
      left: side === 'bottom' ? down(0.3) : up(0.16),
      bottom: down(side === 'top' ? 0.18 : 0.34),
      right: down(side === 'top' ? 0.12 : 0.24),
    };
    if (shape) {
      // (along the face's own edges: lit where the outside is up or left, shaded down or right)
      return fine((d, nx, ny) => (d >= 1 ? null : ny < -0.5 ? cols.bottom : nx < -0.5 ? cols.right : ny > 0.5 ? cols.top : cols.left));
    }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (D(x, y) !== 1) continue;
        // which way the outside is (straight neighbours first, then the corners)
        const out = (dx: number, dy: number) => D(x + dx, y + dy) === 0;
        const k = out(0, 1) ? 'bottom' : out(1, 0) ? 'right' : out(0, -1) ? 'top' : out(-1, 0) ? 'left' : out(1, 1) || out(-1, 1) ? 'bottom' : out(1, -1) ? 'right' : 'top';
        g.fillStyle = cols[k];
        g.fillRect(x, y, 1, 1);
      }
  };
  if (side === 'bottom' || over) return bevel();
  const S = Math.min(w, h);
  const upright = side !== 'top';
  // the face turns: a darker tone across its lower corner, in steps
  if (S >= 10) {
    const tone = down(0.13);
    const y0 = Math.round(h * 0.5);
    for (let y = y0; y < h; y++) {
      const run = Math.round((y - y0) * 1.3 + w * 0.18);
      for (let x = 0; x < Math.min(run, w); x++) dot(x, y, tone);
    }
  }
  // ---- panel lining: the face is built of plates, the seams engraved (a dark line, a lit edge
  // under or right of it). Placed by the face's shape, so a pair of parts gets the same lines ----
  const seamH = (y: number, x0 = 1, x1 = w - 1) => {
    mark(x0, y, x1 - x0, 1, down(0.36));
    mark(x0, y + 1, x1 - x0, 1, up(0.18));
  };
  const seamV = (x: number, y0 = 1, y1 = h - 1) => {
    mark(x, y0, 1, y1 - y0, down(0.36));
    mark(x + 1, y0, 1, y1 - y0, up(0.14));
  };
  const rivet = (x: number, y: number) => {
    mark(x, y, 1, 1, up(0.4), 3);
    mark(x + 1, y + 1, 1, 1, down(0.45), 3);
  };
  /** an inset plate: its outline engraved `m` texels in from the face's own edge, all the way round */
  const inset = (m: number) => {
    const dark = down(0.36);
    const lit = up(0.18);
    if (shape) {
      // the dark line m texels in all round; its lit edge below or right of it (inside it along a
      // top or left edge, outside it along a bottom or right one)
      return fine((d, nx, ny) => {
        if (d >= m && d < m + 1) return dark;
        const topLeft = ny > 0.5 || nx > 0.5;
        if (topLeft ? d >= m + 1 && d < m + 2 : d >= m - 1 && d < m && d >= 1) return lit;
        return null;
      });
    }
    const ring = (x: number, y: number) => D(x, y) === m + 1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (ring(x, y)) {
          g.fillStyle = dark;
          g.fillRect(x, y, 1, 1);
        } else if (D(x, y) >= 2 && (ring(x, y - 1) || ring(x - 1, y))) {
          g.fillStyle = lit;
          g.fillRect(x, y, 1, 1);
        }
      }
  };
  // (the plates' corners, for rivets)
  const corners: [number, number][] = [];
  if (S >= 12) {
    if (w >= h * 1.6) {
      // a long face: split in thirds, end to end
      const a3 = Math.round(w / 3);
      const b3 = w - 1 - a3;
      seamV(a3);
      seamV(b3 - 1);
      corners.push([3, 3], [a3 - 4, 3], [b3 + 2, 3], [w - 5, 3]);
    } else if (h >= w * 1.6) {
      // a tall face: split across, top plate smaller
      const y1 = Math.round(h * 0.34);
      seamH(y1);
      if (h >= 30) seamH(Math.round(h * 0.68));
      corners.push([3, 3], [w - 5, 3], [3, y1 + 3], [w - 5, y1 + 3]);
    } else {
      // a square-ish face: a plate inset in it, its outline engraved
      const m = Math.max(3, Math.round(S * 0.2));
      inset(m);
      corners.push([2, 2], [w - 4, 2], [2, h - 4], [w - 4, h - 4]);
    }
  }
  // rivets at the plates' corners, on a face big enough to show them
  if (S >= 16) for (const [x, y] of corners) rivet(x, y);
  // ---- decals: one per face, chosen by where the face is and how big ----
  const pick = hash(`${w}x${h}${side}`);
  if ((side === 'xpos' || side === 'xneg') && S >= 14) {
    // a side face: a vent, three slits low down (each a dark slot with a lit sill)
    const vw = Math.max(4, Math.round(w * 0.35));
    const vx = Math.round((w - vw) / 2);
    const vy = Math.round(h * 0.6);
    for (let k = 0; k < 3; k++) {
      mark(vx, vy + k * 2, vw, 1, down(0.5), 3);
      mark(vx, vy + k * 2 + 1, vw, 1, up(0.12), 3);
    }
  } else if (side === 'front' && w >= 22 && h >= 16 && pick < 0.6) {
    // a label plate: a light panel with printed lines, up high (in the middle on the centre line)
    const pw = Math.max(8, Math.round(w * 0.3));
    const ph = Math.max(5, Math.round(h * 0.2));
    const px = sym ? Math.round((w - pw) / 2) : Math.round(w * 0.14);
    const py = Math.round(h * 0.2);
    const plate = L > 0.7 ? down(0.16) : up(0.55);
    const ink = L > 0.7 ? down(0.55) : down(0.3);
    const P = (x: number, y: number, ww: number, hh: number, col: string) => (sym ? mark(x, y, ww, hh, col, 3) : mark(X(x + ww - 1) - (mirror ? 0 : ww - 1), y, ww, hh, col, 3));
    // (only where the whole plate fits inside the face's shape)
    let fits = true;
    for (let yy = py; yy < py + ph && fits; yy++) for (let xx = 0; xx < pw && fits; xx++) if (D(sym ? px + xx : X(px + xx), yy) < 3) fits = false;
    if (fits) {
      P(px, py, pw, ph, plate);
      P(px + 1, py + 1, Math.round(pw * 0.6), 1, ink);
      if (ph >= 6) P(px + 1, py + 3, Math.round(pw * 0.4), 1, ink);
      P(px + pw - 3, py + ph - 3, 2, 2, ink);
    }
  } else if (side === 'back' && w >= 22 && h >= 12) {
    // a hazard band across the foot: stripes of the accent and a dark tone
    const bh = Math.max(3, Math.round(h * 0.14));
    const by = h - bh - 3;
    for (let x = 2; x < w - 2; x++) for (let y = by; y < by + bh; y++) mark(x, y, 1, 1, Math.floor((x + y) / 2) % 2 ? accent : down(0.5), 3);
    seamH(by - 1, 2, w - 2);
  } else if (upright && S >= 18 && pick > 0.7) {
    // a bolt: a round plate with a slot
    const cx = Math.round(w / 2) - 2;
    const cy = Math.round(h * 0.7) - 2;
    mark(cx + 1, cy, 2, 4, down(0.28), 3);
    mark(cx, cy + 1, 4, 2, down(0.28), 3);
    mark(cx + 1, cy + 1, 2, 1, up(0.3), 3);
    mark(cx + 1, cy + 2, 2, 1, down(0.5), 3);
  }
  // an accent light in a front face's lower corner
  if (side === 'front' && w >= 14 && h >= 14) {
    const a = S >= 22 ? 2 : 1;
    dot(w - 3 - a, h - 3 - a, accent, a + 1);
  }
  bevel();
  void X;
}

/**
 * `pixel`: hand-pixels every face of the block at its real size (chunky texels, nearest filtering)
 * and sets the block's texture coordinates. Returns its texture (the block's colour is baked in).
 */
export function paintPixel(
  geo: THREE.BufferGeometry,
  base: number,
  eye: number,
  place: THREE.Matrix4,
  _seed: string,
  sheet?: { img: HTMLImageElement; rects: Partial<Record<Side, [number, number, number, number]>>; key: string } | null,
) {
  const src = geo.attributes.position;
  const srcN = geo.attributes.normal;
  if (!src || !srcN) return null;
  const m = place.clone().setPosition(0, 0, 0);
  const pos = src.clone().applyMatrix4(m);
  // where the block sits across the body: on the centre line its faces are symmetrical; on the
  // left side its marks mirror the right side's, so pairs match
  const cxBox = new THREE.Box3().setFromBufferAttribute(pos as THREE.BufferAttribute);
  const cx = place.elements[12] + (cxBox.min.x + cxBox.max.x) / 2;
  const centred = Math.abs(cx) < 0.03;
  const mirror = cx < -0.03;
  const nor = srcN.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(m));
  // every vertex takes the side its normal leans to most (so round parts are box-mapped)
  const sideOf = (i: number): Side => {
    const [nx, ny, nz] = [nor.getX(i), nor.getY(i), nor.getZ(i)];
    const [ax, ay, az] = [Math.abs(nx), Math.abs(ny), Math.abs(nz)];
    if (az >= ax && az >= ay) return nz < 0 ? 'front' : 'back';
    if (ax >= ay) return nx > 0 ? 'xpos' : 'xneg';
    return ny > 0 ? 'top' : 'bottom';
  };
  const boxes: Partial<Record<Side, THREE.Box3>> = {};
  const v3 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) (boxes[sideOf(i)] ??= new THREE.Box3()).expandByPoint(v3.fromBufferAttribute(pos, i));
  const dims = (sd: Side, b: THREE.Box3) => {
    const s = b.getSize(new THREE.Vector3());
    return sd === 'front' || sd === 'back' ? [s.x, s.y] : sd === 'xpos' || sd === 'xneg' ? [s.z, s.y] : [s.x, s.z];
  };
  const GAP = 1;
  let x = 0;
  const rects: Partial<Record<Side, { x: number; w: number; h: number }>> = {};
  for (const sd of Object.keys(boxes) as Side[]) {
    const [fw, fh] = dims(sd, boxes[sd]!);
    // (a painted picture keeps twice the texels, so its marks still read)
    const k = sheet ? TPU * 2 : TPU;
    const w = Math.max(2, Math.min(sheet ? 192 : 96, Math.round(fw * k)));
    const h = Math.max(2, Math.min(sheet ? 192 : 96, Math.round(fh * k)));
    rects[sd] = { x, w, h };
    x += w + GAP;
  }
  const W = x + 2;
  const H = Math.max(2, ...Object.values(rects).map((r) => r!.h));
  // where each face's texels fall in its rectangle (u, v from 0 to 1 across it)
  const span = (a: number, lo: number, hi: number) => (a - lo) / (hi - lo || 1);
  const faceUV = (i: number, sd: Side): [number, number] => {
    const bb = boxes[sd]!;
    const [qx, qy, qz] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    if (sd === 'front') return [1 - span(qx, bb.min.x, bb.max.x), span(qy, bb.min.y, bb.max.y)];
    if (sd === 'back') return [span(qx, bb.min.x, bb.max.x), span(qy, bb.min.y, bb.max.y)];
    if (sd === 'xpos') return [1 - span(qz, bb.min.z, bb.max.z), span(qy, bb.min.y, bb.max.y)];
    if (sd === 'xneg') return [span(qz, bb.min.z, bb.max.z), span(qy, bb.min.y, bb.max.y)];
    if (sd === 'top') return [1 - span(qx, bb.min.x, bb.max.x), span(qz, bb.min.z, bb.max.z)];
    return [1 - span(qx, bb.min.x, bb.max.x), 1 - span(qz, bb.min.z, bb.max.z)];
  };
  // each face's real shape in its rectangle (in texels): its triangles, and its outline (the
  // triangle edges no other triangle shares). A face that fills its rectangle needs none of it
  const shapes: Partial<Record<Side, FaceShape>> = {};
  const outlines: string[] = [];
  {
    const tris: Partial<Record<Side, number[][]>> = {};
    const index = geo.index;
    const n = index ? index.count / 3 : pos.count / 3;
    const vi = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
    for (let t = 0; t < n; t++) {
      const ids = [vi(t, 0), vi(t, 1), vi(t, 2)];
      const sd = sideOf(ids[0]);
      const r = rects[sd]!;
      const P = ids.flatMap((i) => {
        const [u, v] = faceUV(i, sd);
        return [u * r.w, (1 - v) * r.h];
      });
      const area = (P[2] - P[0]) * (P[5] - P[1]) - (P[3] - P[1]) * (P[4] - P[0]);
      if (Math.abs(area) > 1e-6) (tris[sd] ??= []).push(P);
    }
    for (const sd of Object.keys(rects) as Side[]) {
      const T = tris[sd];
      const { w, h } = rects[sd]!;
      if (!T?.length) continue;
      const q = (v: number) => Math.round(v * 100) / 100;
      const count = new Map<string, { e: number[]; n: number }>();
      for (const P of T)
        for (let k = 0; k < 3; k++) {
          const a = [q(P[k * 2]), q(P[k * 2 + 1])];
          const b = [q(P[((k + 1) % 3) * 2]), q(P[((k + 1) % 3) * 2 + 1])];
          const key = a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? `${a}|${b}` : `${b}|${a}`;
          const c = count.get(key);
          if (c) c.n++;
          else count.set(key, { e: [a[0], a[1], b[0], b[1]], n: 1 });
        }
      const edges = [...count.values()].filter((c) => c.n === 1).map((c) => c.e);
      // (an outline lying along the rectangle's own sides: the face is the whole rectangle)
      const onRect = (x: number, y: number) => Math.abs(x) < 0.05 || Math.abs(y) < 0.05 || Math.abs(x - w) < 0.05 || Math.abs(y - h) < 0.05;
      const onSide = (e: number[]) => (Math.abs(e[0] - e[2]) < 0.05 && (Math.abs(e[0]) < 0.05 || Math.abs(e[0] - w) < 0.05)) || (Math.abs(e[1] - e[3]) < 0.05 && (Math.abs(e[1]) < 0.05 || Math.abs(e[1] - h) < 0.05));
      if (edges.every((e) => onSide(e) && onRect(e[0], e[1]) && onRect(e[2], e[3]))) continue;
      // (too small to show a slant, or a rounded part's many-sided outline: left as a rectangle)
      if (Math.min(w, h) < 4 || edges.length > 10) continue;
      // the face measured once on the fine grid (FINE sub-texels a texel): which points are on it,
      // and each one's distance in from the nearest edge with that edge's inward direction
      const measure = () => {
      const F = FINE;
      const W2 = w * F;
      const H2 = h * F;
      const on = new Uint8Array(W2 * H2);
      for (const P of T) {
        const x0 = Math.max(0, Math.floor(Math.min(P[0], P[2], P[4]) * F));
        const x1 = Math.min(W2 - 1, Math.ceil(Math.max(P[0], P[2], P[4]) * F));
        const y0 = Math.max(0, Math.floor(Math.min(P[1], P[3], P[5]) * F));
        const y1 = Math.min(H2 - 1, Math.ceil(Math.max(P[1], P[3], P[5]) * F));
        for (let j = y0; j <= y1; j++)
          for (let i = x0; i <= x1; i++) {
            if (on[j * W2 + i]) continue;
            const x = (i + 0.5) / F;
            const y = (j + 0.5) / F;
            const s0 = (P[2] - P[0]) * (y - P[1]) - (P[3] - P[1]) * (x - P[0]);
            const s1 = (P[4] - P[2]) * (y - P[3]) - (P[5] - P[3]) * (x - P[2]);
            const s2 = (P[0] - P[4]) * (y - P[5]) - (P[1] - P[5]) * (x - P[4]);
            if ((s0 >= -1e-6 && s1 >= -1e-6 && s2 >= -1e-6) || (s0 <= 1e-6 && s1 <= 1e-6 && s2 <= 1e-6)) on[j * W2 + i] = 1;
          }
      }
      const dist = new Float32Array(W2 * H2);
      const nxs = new Float32Array(W2 * H2);
      const nys = new Float32Array(W2 * H2);
      const E = edges.map(([ax, ay, bx, by]) => {
        const dx = bx - ax;
        const dy = by - ay;
        const L2 = dx * dx + dy * dy || 1;
        const L = Math.sqrt(L2);
        return { ax, ay, dx, dy, L2, ux: -dy / L, uy: dx / L };
      });
      for (let j = 0; j < H2; j++)
        for (let i = 0; i < W2; i++) {
          const k = j * W2 + i;
          if (!on[k]) continue;
          const x = (i + 0.5) / F;
          const y = (j + 0.5) / F;
          let best = Infinity;
          let bx = 0;
          let by = 0;
          for (const e of E) {
            const t = Math.max(0, Math.min(1, ((x - e.ax) * e.dx + (y - e.ay) * e.dy) / e.L2));
            const ddx = x - (e.ax + t * e.dx);
            const ddy = y - (e.ay + t * e.dy);
            const d2 = ddx * ddx + ddy * ddy;
            if (d2 < best) {
              best = d2;
              // (the edge's normal, turned toward the point: inward)
              const sgn = e.ux * (x - e.ax) + e.uy * (y - e.ay) < 0 ? -1 : 1;
              bx = e.ux * sgn;
              by = e.uy * sgn;
            }
          }
          dist[k] = Math.sqrt(best);
          nxs[k] = bx;
          nys[k] = by;
        }
      return { on, dist, nxs, nys, W2, H2 };
      };
      // (measured only if this block's texture has to be painted: a cached one never needs it)
      let fld: ReturnType<typeof measure> | null = null;
      const field = () => (fld ??= measure());
      const at = (x: number, y: number) => {
        const f = field();
        return Math.min(f.H2 - 1, Math.max(0, Math.floor(y * FINE))) * f.W2 + Math.min(f.W2 - 1, Math.max(0, Math.floor(x * FINE)));
      };
      shapes[sd] = {
        inside: (x, y) => x >= 0 && y >= 0 && x < w && y < h && !!field().on[at(x, y)],
        near: (x, y) => {
          const k = at(x, y);
          const f = field();
          return { d: f.dist[k], nx: f.nxs[k], ny: f.nys[k] };
        },
        get field() {
          return field();
        },
      };
      outlines.push(`${sd}:${edges.map((e) => e.join(',')).join(';')}`);
    }
  }
  // (a block with a slanted face gets a finer texture, so its lines can run straight)
  const SS = outlines.length ? FINE : 1;
  const shapeKey = outlines.join('/');
  const key = `${base}|${eye}|${mirror ? 1 : 0}${centred ? 'c' : ''}|${sheet?.key ?? ''}|${JSON.stringify(rects)}|${shapeKey}`;
  let t = pixelCache.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = W * SS;
    c.height = H * SS;
    const g = c.getContext('2d', { willReadFrequently: SS > 1 })!;
    g.fillStyle = hex(base);
    g.fillRect(0, 0, W * SS, H * SS);
    for (const sd of Object.keys(rects) as Side[]) {
      const r = rects[sd]!;
      g.save();
      g.scale(SS, SS);
      g.translate(r.x, 0);
      // a painted face: its own patch of the picture, shrunk to the texels (then shaded over)
      const pic = sheet?.rects[sd];
      if (pic) {
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.drawImage(sheet!.img, pic[0], pic[1], pic[2], pic[3], 0, 0, r.w, r.h);
      }
      // (a side face's marks start from its front edge on either side; the others follow the body)
      const flip = sd === 'xpos' ? true : sd === 'xneg' ? false : mirror;
      const sym = centred && sd !== 'xpos' && sd !== 'xneg';
      pixelFace(g, r.w, r.h, base, sd, !!pic, flip, hex(eye), sym, shapes[sd] ?? null, SS, r.x * SS);
      g.restore();
    }
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    pixelCache.set(key, t);
  }
  // texture coordinates: each face across its own rectangle, kept a hair inside it
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const sd = sideOf(i);
    const r = rects[sd]!;
    const [u, v] = faceUV(i, sd);
    const e = 0.5 / Math.max(r.w, r.h);
    const uu = Math.min(Math.max(u, e), 1 - e);
    const vv = Math.min(Math.max(v, e), 1 - e);
    uv.set([(r.x + uu * r.w) / W, 1 - (r.h - vv * r.h) / H], i * 2);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return t;
}
