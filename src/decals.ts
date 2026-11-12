import * as THREE from 'three';

/**
 * Painted textures for a block: small pixel-art pictures in full colour, drawn once on a canvas.
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

// ---- a 3x5 pixel font for unit numbers and short codes ----
const GLYPH: Record<string, string> = {
  '0': '111101101101111',
  '1': '010110010010111',
  '2': '111001111100111',
  '3': '111001111001111',
  '4': '101101111001001',
  '5': '111100111001111',
  '6': '111100111101111',
  '7': '111001010010010',
  '8': '111101111101111',
  '9': '111101111001111',
};
type Px = (x: number, y: number, w: number, h: number, c: string) => void;
/** write text at (x, y), each font pixel s by s */
function text(px: Px, str: string, x: number, y: number, c: string, s = 1) {
  for (const ch of str) {
    const gl = GLYPH[ch];
    if (gl) for (let i = 0; i < 15; i++) if (gl[i] === '1') px(x + (i % 3) * s, y + Math.floor(i / 3) * s, s, s, c);
    x += 4 * s;
  }
}
const textW = (str: string, s = 1) => str.length * 4 * s - s;

const HAZARD = '#ffd23e';
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k < 1 ? v * k : v + (255 - v) * (k - 1))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')}`;
};

/** Seraph and its colourways: a numbered unit, panel lines, warnings and a cockpit hatch */
const UNIT: Record<string, Pic> = {
  /** the chest plate: a star over the unit number, with panel lines */
  chest: {
    w: 30,
    h: 20,
    draw: (_g, px, c, num) => {
      px(0, 0, 30, 20, c.base);
      px(0, 0, 30, 1, shade(c.base, 1.25));
      px(0, 19, 30, 1, shade(c.base, 0.7));
      // panel seams
      px(4, 2, 1, 16, shade(c.base, 0.78));
      px(25, 2, 1, 16, shade(c.base, 0.78));
      // the star
      px(14, 2, 2, 1, c.mark);
      px(13, 3, 4, 1, c.mark);
      px(10, 4, 10, 1, c.mark);
      px(12, 5, 6, 1, c.mark);
      px(12, 6, 2, 1, c.mark);
      px(16, 6, 2, 1, c.mark);
      // the number on a dark plate
      const w = textW(num, 2);
      const x = Math.round((30 - w) / 2);
      px(x - 2, 8, w + 4, 12, shade(c.base, 0.82));
      text(px, num, x, 9, c.mark, 2);
    },
  },
  /** the helmet's face: a crest of chevrons up the forehead, vents and a code block */
  helm: {
    w: 26,
    h: 22,
    draw: (_g, px, c) => {
      px(0, 0, 26, 22, c.base);
      px(0, 21, 26, 1, shade(c.base, 0.82));
      // the crest stripe and its chevrons
      px(11, 0, 4, 12, c.mark);
      for (let y = 2; y < 11; y += 3) {
        px(9, y, 2, 1, c.mark);
        px(15, y, 2, 1, c.mark);
        px(12, y, 2, 1, c.base);
      }
      // side vents
      for (let y = 4; y < 10; y += 2) {
        px(2, y, 4, 1, c.joint);
        px(20, y, 4, 1, c.joint);
      }
      // a little code block
      px(20, 13, 4, 4, c.joint);
      px(21, 14, 1, 1, c.base);
      px(22, 15, 1, 1, c.base);
      px(2, 14, 3, 1, c.mark);
    },
  },
  /** a shoulder pad: banded top and bottom, the unit number on every side */
  pad: {
    w: 15,
    h: 14,
    draw: (_g, px, c, num) => {
      px(0, 0, 15, 14, c.base);
      px(0, 0, 15, 1, c.mark);
      px(0, 12, 15, 2, c.mark);
      px(0, 11, 15, 1, shade(c.base, 0.82));
      // a warning dash run
      for (let x = 1; x < 14; x += 3) px(x, 3, 2, 1, c.mark);
      const w = textW(num);
      text(px, num, Math.round((15 - w) / 2), 5, c.mark);
    },
  },
  /** the back hatch: hazard stripes, two gauges, buttons, a screen and vents */
  hatch: {
    w: 24,
    h: 22,
    draw: (_g, px, c) => {
      px(0, 0, 24, 22, c.joint);
      px(0, 0, 24, 1, shade(c.joint, 1.6));
      // hazard band
      for (let x = 0; x < 24; x += 4) {
        px(x, 2, 2, 3, HAZARD);
        px(x + 2, 2, 2, 3, '#1a1a1a');
      }
      // gauges
      px(3, 7, 6, 5, '#e8ecf0');
      px(5, 8, 2, 3, c.eye);
      px(15, 7, 6, 5, '#e8ecf0');
      px(17, 8, 2, 3, c.accent);
      // buttons and a screen
      px(10, 7, 4, 3, c.eye);
      px(10, 11, 1, 1, '#ff3a4a');
      px(13, 11, 1, 1, '#3aff6a');
      // vents
      for (let y = 14; y < 20; y += 2) {
        px(3, y, 7, 1, shade(c.joint, 0.5));
        px(14, y, 7, 1, shade(c.joint, 0.5));
      }
      px(11, 15, 2, 4, c.accent);
    },
  },
  /** a shin or foot plate: a chevron band and a line of small print */
  shin: {
    w: 16,
    h: 16,
    draw: (_g, px, c) => {
      px(0, 0, 16, 16, c.base);
      px(0, 15, 16, 1, shade(c.base, 0.8));
      px(3, 4, 10, 2, c.mark);
      px(5, 6, 6, 1, c.mark);
      px(7, 7, 2, 1, c.mark);
      for (let x = 3; x < 13; x += 2) px(x, 11, 1, 1, c.joint);
      px(3, 13, 6, 1, c.joint);
    },
  },
};

const PICS: Record<string, Pic> = { ...LEO, ...UNIT };

const cache = new Map<string, THREE.Texture>();
const SPARE = 2;
const hex = (n: number) => `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;

/** is this a painted texture name (rather than a tonal armour pattern)? */
export const isPainted = (tex: string | undefined) => !!tex && (tex.startsWith('decal:') || tex.startsWith('paint:'));

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
/** a decal's pictures sit side by side, then the spare columns of the block's own colour */
const sheet = (parts: Part[]) => {
  const W = parts.reduce((n, p) => n + p.pic.w, 0) + SPARE;
  const H = Math.max(...parts.map((p) => p.pic.h));
  return { W, H };
};

const lum = (n: number) => (0.3 * ((n >> 16) & 255) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255;
export function paintedTexture(tex: string, palette: { body: number; trim: number; accent: number; joint: number; eye: number }, base: number) {
  const { kind, parts } = parse(tex);
  if (!parts.length) return null;
  const tile = kind === 'paint';
  // markings: the first of accent, body or cream that stands out from the block
  const mark = [palette.accent, palette.body, 0xf2ead8].find((c) => Math.abs(lum(c) - lum(base)) > 0.25) ?? 0xf2ead8;
  const pal: Pal = { base: hex(base), mark: hex(mark), body: hex(palette.body), trim: hex(palette.trim), accent: hex(palette.accent), joint: hex(palette.joint), eye: hex(palette.eye) };
  const key = `${tex}|${Object.values(pal).join('')}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  const { W, H } = tile ? { W: parts[0].pic.w, H: parts[0].pic.h } : sheet(parts);
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = pal.base;
  g.fillRect(0, 0, W, H);
  let x0 = 0;
  for (const part of tile ? parts.slice(0, 1) : parts) {
    const ox = x0;
    part.pic.draw(
      g,
      (x, y, w, h, col) => {
        g.fillStyle = col;
        g.fillRect(ox + x, y, w, h);
      },
      pal,
      part.arg,
    );
    x0 += part.pic.w;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
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
    const { W, H } = sheet(parts);
    // which picture a side shows, and where that picture sits on the sheet
    const owner: Record<string, { u0: number; du: number; v0: number; dv: number }> = {};
    let x0 = 0;
    for (const part of parts) {
      const at = { u0: x0 / W, du: part.pic.w / W, v0: 1 - part.pic.h / H, dv: part.pic.h / H };
      for (const sd of part.faces === 'ring' ? ['front', 'back', 'xpos', 'xneg'] : [part.faces]) owner[sd] ??= at;
      x0 += part.pic.w;
    }
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
    const cu = 1 - SPARE / 2 / W;
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
