import * as THREE from 'three';

/**
 * Patterns for the 2.1 units: each has its own armour texture and its own marble. All are
 * drawn in greys, so they tint whatever colour they sit on: a tonal pattern on the paint,
 * and the same picture as a bump map for a little relief.
 */

export type ArmourTex = 'hex' | 'scales' | 'camo' | 'brushed' | 'circuit' | 'digital' | 'carbon' | 'weave' | 'stripe' | 'panel' | 'hammered' | 'spots' | 'crackle' | 'tiger' | 'ripstop' | 'none' | 'tigerBold' | 'mud';
export type BallTex = 'swirl' | 'ring' | 'flame' | 'camo' | 'checker' | 'galaxy' | 'eye' | 'crackle' | 'nebula' | 'candy' | 'dots' | 'lava' | 'sparks' | 'scale' | 'tiger';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const grey = (v: number) => {
  const c = Math.round(Math.max(0, Math.min(255, v)));
  return `rgb(${c},${c},${c})`;
};

function canvas(w: number, h: number, base = 235) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = grey(base);
  g.fillRect(0, 0, w, h);
  return { c, g };
}

const armourCache = new Map<ArmourTex, THREE.Texture>();
/** a tiling armour texture (128 px), tonal greys between ~170 and 255 */
export function armourTexture(kind: ArmourTex) {
  let t = armourCache.get(kind);
  if (t) return t;
  const S = 128;
  const { c, g } = canvas(S, S, 240);
  const line = (x1: number, y1: number, x2: number, y2: number, v: number, w: number) => {
    g.strokeStyle = grey(v);
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  };
  switch (kind) {
    case 'hex': {
      // hexagonal plating
      const r = 12;
      const h = r * Math.sqrt(3);
      for (let row = -1; row < S / h + 1; row++)
        for (let col = -1; col < S / (r * 1.5) + 1; col++) {
          const cx = col * r * 1.5;
          const cy = row * h + (col % 2 ? h / 2 : 0);
          g.strokeStyle = grey(175);
          g.lineWidth = 2;
          g.beginPath();
          for (let k = 0; k < 6; k++) g.lineTo(cx + Math.cos((k * Math.PI) / 3) * r, cy + Math.sin((k * Math.PI) / 3) * r);
          g.closePath();
          g.stroke();
        }
      break;
    }
    case 'scales': {
      for (let row = 0; row < 10; row++)
        for (let col = -1; col < 10; col++) {
          const x = col * 16 + (row % 2 ? 8 : 0);
          const y = row * 14;
          g.fillStyle = grey(rand(200, 245));
          g.beginPath();
          g.arc(x, y, 10, 0, Math.PI);
          g.fill();
          g.strokeStyle = grey(165);
          g.lineWidth = 1.5;
          g.stroke();
        }
      break;
    }
    case 'camo':
      for (let i = 0; i < 26; i++) {
        g.fillStyle = grey(pickOf([180, 205, 255]));
        g.beginPath();
        const x = rand(0, S);
        const y = rand(0, S);
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2;
          const r = rand(8, 20);
          g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        g.fill();
      }
      break;
    case 'digital':
      for (let x = 0; x < S; x += 8) for (let y = 0; y < S; y += 8) if (Math.random() < 0.45) {
        g.fillStyle = grey(pickOf([185, 210, 255]));
        g.fillRect(x, y, 8, 8);
      }
      break;
    case 'carbon':
      for (let x = 0; x < S; x += 8)
        for (let y = 0; y < S; y += 8) {
          const v = (x / 8 + y / 8) % 2 ? 190 : 240;
          const grad = g.createLinearGradient(x, y, x + 8, y + 8);
          grad.addColorStop(0, grey(v));
          grad.addColorStop(1, grey(v - 30));
          g.fillStyle = grad;
          g.fillRect(x, y, 8, 8);
        }
      break;
    case 'weave':
      for (let k = -S; k < S * 2; k += 10) {
        line(k, 0, k + S, S, 190, 2);
        line(k + S, 0, k, S, 205, 1.5);
      }
      break;
    case 'stripe':
      for (let y = 0; y < S; y += 32) {
        g.fillStyle = grey(190);
        g.fillRect(0, y + 10, S, 6);
        g.fillStyle = grey(210);
        g.fillRect(0, y + 19, S, 3);
      }
      break;
    case 'panel':
      // light panel lines, large plates, just a few of them
      for (let x = 0; x <= S; x += 64) line(x, 0, x, S, 205, 1.5);
      for (let y = 0; y <= S; y += 64) line(0, y, S, y, 205, 1.5);
      line(64, 32, S, 32, 215, 1);
      break;
    case 'ripstop':
      // military ripstop: a fine fabric weave with a heavier thread every few millimetres
      for (let x = 0; x < S; x += 4) line(x, 0, x, S, 228, 1);
      for (let y = 0; y < S; y += 4) line(0, y, S, y, 228, 1);
      for (let x = 0; x < S; x += 16) line(x, 0, x, S, 200, 1.5);
      for (let y = 0; y < S; y += 16) line(0, y, S, y, 200, 1.5);
      break;
    case 'hammered':
      for (let i = 0; i < 90; i++) {
        const x = rand(0, S);
        const y = rand(0, S);
        const r = rand(4, 9);
        const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
        grad.addColorStop(0, grey(255));
        grad.addColorStop(1, grey(195));
        g.fillStyle = grad;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'mud':
      // dried mud: dark splats with droplets flung off them, and lighter dust patches
      for (let i = 0; i < 8; i++) {
        g.fillStyle = grey(rand(200, 222));
        g.beginPath();
        g.ellipse(rand(0, S), rand(0, S), rand(10, 22), rand(6, 14), rand(0, 3), 0, Math.PI * 2);
        g.fill();
      }
      for (let i = 0; i < 14; i++) {
        const x = rand(0, S);
        const y = rand(0, S);
        g.fillStyle = grey(rand(150, 175));
        g.beginPath();
        g.ellipse(x, y, rand(4, 10), rand(3, 7), rand(0, 3), 0, Math.PI * 2);
        g.fill();
        for (let k = 0; k < 5; k++) {
          g.beginPath();
          g.arc(x + rand(-16, 16), y + rand(-16, 16), rand(0.8, 2.4), 0, Math.PI * 2);
          g.fill();
        }
      }
      break;
    case 'spots':
      for (let i = 0; i < 22; i++) {
        g.fillStyle = grey(rand(185, 210));
        g.beginPath();
        g.ellipse(rand(0, S), rand(0, S), rand(3, 8), rand(3, 7), rand(0, 3), 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'crackle':
      for (let i = 0; i < 26; i++) {
        let x = rand(0, S);
        let y = rand(0, S);
        g.strokeStyle = grey(165);
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x += rand(-18, 18);
          y += rand(-18, 18);
          g.lineTo(x, y);
        }
        g.stroke();
      }
      break;
    case 'tiger':
      for (let i = 0; i < 9; i++) {
        const y = i * 15 + rand(-3, 3);
        g.fillStyle = grey(175);
        g.beginPath();
        g.moveTo(0, y);
        g.quadraticCurveTo(S * 0.4, y - 8, S * 0.7, y + 4);
        g.lineTo(S * 0.75, y + 8);
        g.quadraticCurveTo(S * 0.35, y + 2, 0, y + 7);
        g.fill();
      }
      break;
    case 'tigerBold':
      // a Sumatran tiger's coat: dense, bold black stripes, forked and tapering
      for (let i = 0; i < 7; i++) {
        const y = i * 19 + rand(-3, 3);
        g.fillStyle = grey(25);
        g.beginPath();
        g.moveTo(0, y);
        g.quadraticCurveTo(S * 0.35, y - 10, S * 0.62, y + 3);
        g.lineTo(S * 0.7, y + 9);
        g.quadraticCurveTo(S * 0.3, y + 4, 0, y + 10);
        g.fill();
        g.beginPath();
        g.moveTo(S, y + 8);
        g.quadraticCurveTo(S * 0.75, y + 2, S * 0.5, y + 12);
        g.lineTo(S * 0.48, y + 15);
        g.quadraticCurveTo(S * 0.75, y + 9, S, y + 15);
        g.fill();
      }
      break;
    case 'brushed':
      for (let y = 0; y < S; y++) {
        g.fillStyle = grey(rand(215, 250));
        g.fillRect(0, y, S, 1);
      }
      break;
    case 'circuit':
      g.lineCap = 'round';
      for (let i = 0; i < 16; i++) {
        let x = Math.round(rand(0, 8)) * 16;
        let y = Math.round(rand(0, 8)) * 16;
        g.strokeStyle = grey(180);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 3; k++) {
          if (Math.random() < 0.5) x += pickOf([-16, 16]);
          else y += pickOf([-16, 16]);
          g.lineTo(x, y);
        }
        g.stroke();
        g.fillStyle = grey(170);
        g.fillRect(x - 3, y - 3, 6, 6);
      }
      break;
  }
  // soften it: a pattern, not a print (the tiger coat stays bold)
  if (kind !== 'tigerBold') {
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(0, 0, S, S);
  }
  t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  // the facets map 3 tiles per unit; show the armour patterns at half that, larger and calmer
  t.repeat.set(0.55, 0.55);
  armourCache.set(kind, t);
  return t;
}

const ballCache = new Map<BallTex, THREE.Texture>();
/** a marble's insides unwrapped (256 x 128): bright glass (tinted by the team colour) with darker features */
export function ballTexture(kind: BallTex) {
  let t = ballCache.get(kind);
  if (t) return t;
  const W = 256;
  const H = 128;
  const { c, g } = canvas(W, H, 255);
  switch (kind) {
    case 'swirl':
    default:
      for (let k = 0; k < 4; k++) {
        const x0 = (k + 0.5) * (W / 4);
        for (const [w, v] of [[22, 90], [7, 42]] as const) {
          g.fillStyle = grey(v);
          g.beginPath();
          for (let y = 0; y <= H; y += 4) g.lineTo(x0 + Math.sin((y / H) * Math.PI * 1.6) * 26 - w / 2, y);
          for (let y = H; y >= 0; y -= 4) g.lineTo(x0 + Math.sin((y / H) * Math.PI * 1.6) * 26 + w / 2, y);
          g.fill();
        }
      }
      break;
    case 'ring':
      for (const [y, h] of [[44, 10], [74, 10]] as const) {
        g.fillStyle = grey(60);
        g.fillRect(0, y, W, h);
      }
      g.fillStyle = grey(140);
      g.fillRect(0, 58, W, 12);
      break;
    case 'flame':
      for (let k = 0; k < 8; k++) {
        const x = k * 32;
        g.fillStyle = grey(70);
        g.beginPath();
        g.moveTo(x, H);
        g.quadraticCurveTo(x + 8, 60, x + 16, 18);
        g.quadraticCurveTo(x + 22, 60, x + 32, H);
        g.fill();
      }
      break;
    case 'camo':
      for (let i = 0; i < 40; i++) {
        g.fillStyle = grey(pickOf([60, 120, 180]));
        g.beginPath();
        g.ellipse(rand(0, W), rand(0, H), rand(10, 24), rand(6, 14), rand(0, 3), 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'checker':
      for (let x = 0; x < W; x += 32) for (let y = 0; y < H; y += 32) if ((x / 32 + y / 32) % 2) {
        g.fillStyle = grey(55);
        g.fillRect(x, y, 32, 32);
      }
      break;
    case 'galaxy':
    case 'nebula': {
      // dark enough to read as space, light enough that the team colour still shows
      const dark = kind === 'galaxy' ? 120 : 150;
      g.fillStyle = grey(dark);
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 12; i++) {
        const x = rand(0, W);
        const y = rand(0, H);
        const r = rand(14, 40);
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, grey(kind === 'galaxy' ? 230 : 200));
        grad.addColorStop(1, grey(dark));
        g.fillStyle = grad;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (let i = 0; i < 120; i++) {
        g.fillStyle = grey(255);
        g.fillRect(rand(0, W), rand(0, H), 1.5, 1.5);
      }
      break;
    }
    case 'eye':
      for (const x of [64, 192]) {
        g.fillStyle = grey(40);
        g.beginPath();
        g.ellipse(x, 64, 30, 30, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = grey(255);
        g.beginPath();
        g.ellipse(x, 64, 12, 12, 0, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'crackle':
      for (let i = 0; i < 40; i++) {
        let x = rand(0, W);
        let y = rand(0, H);
        g.strokeStyle = grey(50);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x += rand(-20, 20);
          y += rand(-20, 20);
          g.lineTo(x, y);
        }
        g.stroke();
      }
      break;
    case 'candy':
      for (let x = -H; x < W + H; x += 24) {
        g.fillStyle = grey(70);
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + 10, 0);
        g.lineTo(x + 10 + H, H);
        g.lineTo(x + H, H);
        g.fill();
      }
      break;
    case 'dots':
      for (let x = 16; x < W; x += 32) for (let y = 16; y < H; y += 32) {
        g.fillStyle = grey(55);
        g.beginPath();
        g.arc(x + ((y / 32) % 2 ? 16 : 0), y, 8, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'lava':
      g.fillStyle = grey(125);
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 26; i++) {
        let x = rand(0, W);
        let y = rand(0, H);
        g.strokeStyle = grey(255);
        g.lineWidth = rand(2, 4);
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x += rand(-24, 24);
          y += rand(-16, 16);
          g.lineTo(x, y);
        }
        g.stroke();
      }
      break;
    case 'sparks':
      for (let i = 0; i < 60; i++) {
        g.fillStyle = grey(70);
        const x = rand(0, W);
        const y = rand(0, H);
        g.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const r = k % 2 ? 2 : 6;
          g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        g.fill();
      }
      break;
    case 'scale':
      for (let row = 0; row < 8; row++)
        for (let col = 0; col < 17; col++) {
          g.strokeStyle = grey(60);
          g.lineWidth = 2;
          g.beginPath();
          g.arc(col * 16 + (row % 2 ? 8 : 0), row * 16, 9, 0, Math.PI);
          g.stroke();
        }
      break;
    case 'tiger':
      for (let k = 0; k < 10; k++) {
        const x = k * 26 + rand(-4, 4);
        g.fillStyle = grey(45);
        g.beginPath();
        g.moveTo(x, 0);
        g.quadraticCurveTo(x - 10, H * 0.5, x + 6, H);
        g.lineTo(x + 14, H);
        g.quadraticCurveTo(x + 2, H * 0.5, x + 10, 0);
        g.fill();
      }
      break;
  }
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  ballCache.set(kind, t);
  return t;
}

function pickOf<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}
