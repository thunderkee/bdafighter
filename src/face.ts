import { fitCss, loadTVG, type TVGNs } from './fx2d';
import { characterById, type CharacterDef } from './robot';
import type { Shooter } from './game';

// Doom-style live portraits drawn with ThorVG: each robot's head in vector
// form, reacting to the fight — glancing around, flinching when hit,
// grinning after landing hits, cracking and smoking as health drops, and
// showing X eyes when knocked out.

type TShape = InstanceType<TVGNs['Shape']>;
type RGB = [number, number, number];
type Pt = [number, number];

const POOL = 70;
const FPS = 24;

const rgb = (c: number): RGB => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const shade = (c: RGB, k: number): RGB => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];

/** fixed crack paths in the 100x100 portrait space, revealed as health drops */
const CRACKS: Pt[][] = [
  [
    [62, 32],
    [58, 40],
    [63, 46],
  ],
  [
    [26, 62],
    [33, 66],
    [30, 74],
  ],
  [
    [70, 60],
    [64, 66],
    [69, 72],
    [64, 78],
  ],
  [
    [38, 31],
    [42, 38],
    [36, 42],
  ],
  [
    [52, 70],
    [47, 75],
    [52, 80],
  ],
];

export type Mood = 'idle' | 'hurt' | 'grin' | 'power' | 'win' | 'ko';

export class Portrait {
  private tvg: TVGNs | null = null;
  private canvas: InstanceType<TVGNs['Canvas']> | null = null;
  private shapes: TShape[] = [];
  private i = 0;
  private size = 0;
  private acc = 0;
  private t = 0;
  private glance = 0;
  private glanceTimer = 1;
  private def: CharacterDef;
  ready = false;

  constructor(
    private el: HTMLCanvasElement,
    characterId: string,
  ) {
    this.def = characterById(characterId);
  }

  async init() {
    try {
      this.tvg = await loadTVG();
      const css = this.el.clientWidth || 64;
      this.size = Math.round(css * Math.min(2, window.devicePixelRatio || 1));
      this.canvas = new this.tvg.Canvas('#' + this.el.id, {
        width: this.size,
        height: this.size,
        enableDevicePixelRatio: false,
        engineOption: this.tvg.EngineOption.None,
      });
      fitCss(this.el);
      for (let k = 0; k < POOL; k++) {
        const s = new this.tvg.Shape();
        this.shapes.push(s);
        this.canvas.add(s);
      }
      this.ready = true;
    } catch (err) {
      console.warn('portrait disabled:', err);
    }
  }

  setCharacter(id: string) {
    this.def = characterById(id);
    this.acc = 1; // redraw next frame
  }

  /** Decide the expression from the robot's state. */
  static mood(s: Shooter, phase: string, winner: number | null): Mood {
    if (s.health <= 0) return 'ko';
    if (phase === 'over' || phase === 'ko') return winner === s.team ? 'win' : 'idle';
    if (s.sinceHurt < 0.4) return 'hurt';
    if (s.superReady || s.dragonQueue > 0) return 'power';
    if (s.sinceHit < 0.7 || s.multiT > 0 || s.wiperT > 0) return 'grin';
    return 'idle';
  }

  update(dt: number, s: Shooter, mood: Mood) {
    if (!this.ready || !this.canvas) return;
    this.t += dt;
    this.acc += dt;
    // Doom-style idle glance: look left, centre or right every second or two
    this.glanceTimer -= dt;
    if (this.glanceTimer <= 0) {
      this.glance = [-1, 0, 0, 1][Math.floor(Math.random() * 4)];
      this.glanceTimer = 0.8 + Math.random() * 1.8;
    }
    if (this.acc < 1 / FPS) return;
    this.acc = 0;
    this.draw(s.hpFrac, mood);
  }

  // ---------- tiny painter over a shape pool ----------

  private k = 1;
  private ox = 0;
  private oy = 0;
  private rot = 0;

  private tx(x: number, y: number): Pt {
    // rotate about the chin-ish centre, then offset and scale
    const cx = 50;
    const cy = 58;
    const c = Math.cos(this.rot);
    const s = Math.sin(this.rot);
    const dx = x - cx;
    const dy = y - cy;
    return [(cx + dx * c - dy * s + this.ox) * this.k, (cy + dx * s + dy * c + this.oy) * this.k];
  }

  private next() {
    return this.i < this.shapes.length ? this.shapes[this.i++].reset().fill(0, 0, 0, 0).stroke({ width: 0 }) : null;
  }

  private poly(pts: Pt[], color: RGB, a = 255) {
    const s = this.next();
    if (!s) return;
    pts.forEach(([x, y], n) => {
      const [px, py] = this.tx(x, y);
      if (n === 0) s.moveTo(px, py);
      else s.lineTo(px, py);
    });
    s.close();
    s.fill(color[0], color[1], color[2], a);
  }

  private rect(x: number, y: number, w: number, h: number, color: RGB, a = 255) {
    this.poly(
      [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ],
      color,
      a,
    );
  }

  private line(pts: Pt[], width: number, color: RGB, a = 255) {
    const s = this.next();
    if (!s) return;
    pts.forEach(([x, y], n) => {
      const [px, py] = this.tx(x, y);
      if (n === 0) s.moveTo(px, py);
      else s.lineTo(px, py);
    });
    s.stroke({ width: width * this.k, color: [color[0], color[1], color[2], a], cap: this.tvg!.StrokeCap.Round, join: this.tvg!.StrokeJoin.Round });
  }

  private circle(x: number, y: number, r: number, color: RGB, a = 255) {
    const s = this.next();
    if (!s) return;
    const [px, py] = this.tx(x, y);
    s.appendCircle(px, py, r * this.k).fill(color[0], color[1], color[2], a);
  }

  // ---------- the face ----------

  private draw(hp: number, mood: Mood) {
    const d = this.def;
    const pal = d.palette;
    const body = rgb(pal.body);
    const trim = rgb(pal.trim);
    const accent = rgb(pal.accent);
    const joint = rgb(pal.joint);
    const eye = rgb(pal.eye);
    const gold: RGB = [255, 194, 61];
    const face = d.darkFace ? joint : shade(body, 0.86);
    this.i = 0;
    this.k = this.size / 100;
    // head motion: flinch jitter, KO tilt, victory bob, idle glance lean
    const flinch = mood === 'hurt';
    this.ox = flinch ? (Math.random() - 0.5) * 6 : this.glance * 2;
    this.oy = flinch ? (Math.random() - 0.5) * 4 : mood === 'win' ? Math.sin(this.t * 10) * 2 : 0;
    this.rot = mood === 'ko' ? -0.22 : flinch ? (Math.random() - 0.5) * 0.12 : this.glance * 0.04;

    // backdrop: cockpit screen with scanlines (not transformed)
    const keep = [this.ox, this.oy, this.rot];
    this.ox = this.oy = this.rot = 0;
    this.rect(0, 0, 100, 100, [6, 12, 28]);
    for (let y = 2; y < 100; y += 6) this.rect(0, y, 100, 1.2, [62, 240, 255], 18);
    if (mood === 'power') this.circle(50, 52, 46 + Math.sin(this.t * 12) * 3, gold, 60);
    [this.ox, this.oy, this.rot] = keep;

    if (d.face === 'beast') this.drawBeast(d, mood, hp, body, trim, accent, joint, eye);
    else if (d.face === 'cute') this.drawCute(mood, body, trim, eye);
    else {
      // crest behind the helmet top
      this.drawCrest(d, hp, gold, accent, joint);

      // ear blocks
      this.rect(10, 44, 10, 24, trim);
      this.rect(80, 44, 10, 24, trim);
      // helmet + lower shading
      this.poly(
        [
          [22, 28],
          [78, 28],
          [84, 46],
          [80, 82],
          [20, 82],
          [16, 46],
        ],
        body,
      );
      this.poly(
        [
          [16, 46],
          [84, 46],
          [80, 82],
          [20, 82],
        ],
        shade(body, 0.8),
        120,
      );
      if (d.crest === 'vfin' || d.crest === 'vfin-short') this.rect(22, 26, 56, 7, trim);
      this.rect(46, 34, 8, 6, d.eyes === 'mono' ? gold : accent); // forehead sensor

      // visor band and eyes
      this.rect(22, 44, 56, 13, [8, 6, 16], 235);
      this.drawEyes(d, mood, hp, eye);

      // faceplate, mouth grille, chin
      this.poly(
        [
          [30, 58],
          [70, 58],
          [66, 82],
          [34, 82],
        ],
        face,
      );
      const grin = mood === 'grin' || mood === 'power' || mood === 'win';
      for (const gx of [42, 50, 58]) this.rect(gx - 1.5, 63, 3, 11, grin ? eye : shade(face, 0.6), grin ? 230 : 255);
      this.rect(44, 78, 12, 8, d.darkFace ? shade(joint, 1.4) : accent);
      if (d.glow !== undefined) this.rect(49, 58, 2, 24, rgb(d.glow), 220);
    }

    // battle damage grows as health drops
    const cracks = hp > 0.75 ? 0 : hp > 0.5 ? 1 : hp > 0.25 ? 3 : 5;
    for (let c = 0; c < cracks; c++) this.line(CRACKS[c], 1.8, [20, 18, 26], 230);
    if (hp <= 0.5) {
      this.circle(30, 38, 7, [20, 18, 24], 90);
      this.circle(68, 72, 6, [20, 18, 24], 80);
    }
    if (hp <= 0.25 && mood !== 'ko') {
      // sparks and smoke
      if (Math.random() < 0.6) {
        const sx = 70 + Math.random() * 10;
        const sy = 30 + Math.random() * 10;
        this.line(
          [
            [sx - 4, sy],
            [sx + 4, sy],
          ],
          1.6,
          [255, 230, 120],
        );
        this.line(
          [
            [sx, sy - 4],
            [sx, sy + 4],
          ],
          1.6,
          [255, 230, 120],
        );
      }
      const puff = (this.t * 0.8) % 1;
      this.circle(72 + puff * 6, 24 - puff * 20, 4 + puff * 6, [90, 90, 100], Math.round(140 * (1 - puff)));
    }

    // overlays: red flash when hit, dimmed when KO
    const keep2 = [this.ox, this.oy, this.rot];
    this.ox = this.oy = this.rot = 0;
    if (flinch) this.rect(0, 0, 100, 100, [255, 40, 40], 70);
    if (mood === 'ko') this.rect(0, 0, 100, 100, [0, 0, 0], 110);
    [this.ox, this.oy, this.rot] = keep2;

    while (this.i < this.shapes.length) this.shapes[this.i++].reset().fill(0, 0, 0, 0).stroke({ width: 0 });
    this.canvas!.update().render();
  }

  /** Front-on beast head: brow or ears, slit eyes, toothy jaws. */
  private drawBeast(d: CharacterDef, mood: Mood, hp: number, body: RGB, trim: RGB, accent: RGB, joint: RGB, eye: RGB) {
    const cat = d.body === 'cat';
    if (cat) {
      // armoured mane behind the head
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        const cx = 50 + Math.cos(a) * 34;
        const cy = 50 + Math.sin(a) * 32;
        this.poly(
          [
            [cx + Math.cos(a) * 12, cy + Math.sin(a) * 12],
            [cx + Math.cos(a + 1.6) * 6, cy + Math.sin(a + 1.6) * 6],
            [cx + Math.cos(a - 1.6) * 6, cy + Math.sin(a - 1.6) * 6],
          ],
          accent,
        );
      }
      for (const side of [-1, 1])
        this.poly(
          [
            [50 + side * 14, 30],
            [50 + side * 26, 10],
            [50 + side * 32, 32],
          ],
          trim,
        );
    }
    // skull
    this.poly(
      [
        [22, 28],
        [78, 28],
        [86, 50],
        [74, 70],
        [26, 70],
        [14, 50],
      ],
      body,
    );
    if (!cat) {
      // tyrannosaur brow plates and horns
      this.poly(
        [
          [20, 36],
          [46, 40],
          [44, 46],
          [18, 42],
        ],
        trim,
      );
      this.poly(
        [
          [80, 36],
          [54, 40],
          [56, 46],
          [82, 42],
        ],
        trim,
      );
    }
    // eyes: slits that react like the mech eyes do
    const g = this.glance * 2;
    for (const side of [-1, 1]) {
      const cx = 50 + side * 18 + g;
      if (mood === 'ko') {
        this.line([[cx - 4, 44], [cx + 4, 52]], 2.4, [200, 70, 70]);
        this.line([[cx + 4, 44], [cx - 4, 52]], 2.4, [200, 70, 70]);
      } else if (mood === 'win') this.line([[cx - 5, 52], [cx, 46], [cx + 5, 52]], 3, eye);
      else {
        const h = mood === 'hurt' ? 1.2 : 4;
        this.poly(
          [
            [cx - side * 7, 46],
            [cx + side * 6, 48 - (mood === 'power' ? 2 : 0)],
            [cx + side * 6, 48 + h],
            [cx - side * 7, 46 + h],
          ],
          mood === 'power' || mood === 'grin' ? shade(eye, 1.3) : eye,
        );
      }
    }
    // muzzle, nostrils, jaws and teeth; the mouth opens wider when fired up
    this.poly(
      [
        [30, 56],
        [70, 56],
        [66, 70],
        [34, 70],
      ],
      shade(body, 0.85),
    );
    this.circle(44, 60, 1.8, [20, 14, 18]);
    this.circle(56, 60, 1.8, [20, 14, 18]);
    const open = mood === 'grin' || mood === 'power' || mood === 'win' ? 9 : mood === 'hurt' ? 6 : 4;
    this.rect(32, 70, 36, open, [24, 8, 12]);
    if (mood === 'power' || mood === 'grin') this.circle(50, 70 + open / 2, 3, eye, 200);
    for (let k = 0; k < 6; k++) {
      const x = 34 + k * 6.4;
      this.poly(
        [
          [x, 70],
          [x + 4, 70],
          [x + 2, 74],
        ],
        [245, 245, 240],
      );
    }
    this.poly(
      [
        [32, 70 + open],
        [68, 70 + open],
        [64, 82 + open * 0.3],
        [36, 82 + open * 0.3],
      ],
      joint,
    );
    void hp;
  }

  /** Big round cartoon head: wide eyes, simple smile. */
  private drawCute(mood: Mood, body: RGB, belly: RGB, eye: RGB) {
    this.circle(50, 52, 34, body);
    this.circle(50, 70, 16, belly, 120);
    const g = this.glance * 2;
    for (const side of [-1, 1]) {
      const cx = 50 + side * 14 + g;
      if (mood === 'ko') {
        this.line([[cx - 5, 40], [cx + 5, 50]], 2.6, [60, 40, 40]);
        this.line([[cx + 5, 40], [cx - 5, 50]], 2.6, [60, 40, 40]);
      } else if (mood === 'win') this.line([[cx - 6, 48], [cx, 42], [cx + 6, 48]], 3, [40, 30, 40]);
      else if (mood === 'hurt') this.line([[cx - 6, 46], [cx + 6, 44]], 3, [40, 30, 40]);
      else {
        this.circle(cx, 45, 8, [255, 255, 255]);
        this.circle(cx + g * 0.6, 46, 5, eye);
        this.circle(cx + g * 0.6 - 2, 43.5, 1.8, [255, 255, 255]);
      }
    }
    // cheeks blush when happy
    if (mood === 'grin' || mood === 'win' || mood === 'power') {
      this.circle(30, 58, 4, [255, 120, 120], 140);
      this.circle(70, 58, 4, [255, 120, 120], 140);
    }
    const open = mood === 'power' ? 10 : mood === 'grin' || mood === 'win' ? 7 : 3;
    this.poly(
      [
        [40, 60],
        [60, 60],
        [56, 60 + open],
        [44, 60 + open],
      ],
      [80, 20, 30],
    );
    if (mood === 'power') this.circle(50, 64, 3, [255, 200, 80]);
  }

  private drawCrest(d: CharacterDef, hp: number, gold: RGB, accent: RGB, joint: RGB) {
    // low health snaps off the right half of fins and horns
    const broken = hp <= 0.25;
    switch (d.crest) {
      case 'vfin':
      case 'vfin-short': {
        const tip = d.crest === 'vfin' ? 8 : 16;
        const reach = d.crest === 'vfin' ? 38 : 24;
        this.poly(
          [
            [48, 30],
            [44, 34],
            [50 - reach, tip],
            [50 - reach + 6, tip - 2],
          ],
          gold,
        );
        if (!broken)
          this.poly(
            [
              [52, 30],
              [56, 34],
              [50 + reach, tip],
              [50 + reach - 6, tip - 2],
            ],
            gold,
          );
        else
          this.poly(
            [
              [52, 30],
              [56, 34],
              [64, 24],
              [60, 22],
            ],
            gold,
          );
        this.rect(46, 24, 8, 9, accent);
        break;
      }
      case 'horns':
        this.poly(
          [
            [36, 30],
            [44, 30],
            [26, 2],
          ],
          joint,
        );
        if (!broken)
          this.poly(
            [
              [56, 30],
              [64, 30],
              [74, 2],
            ],
            joint,
          );
        this.poly(
          [
            [18, 42],
            [22, 50],
            [4, 30],
          ],
          joint,
        );
        this.poly(
          [
            [82, 42],
            [78, 50],
            [96, 30],
          ],
          joint,
        );
        this.poly(
          [
            [47, 30],
            [53, 30],
            [50, 6],
          ],
          gold,
        );
        break;
      case 'unihorn':
        this.poly(
          [
            [45, 32],
            [55, 32],
            [50, broken ? 18 : -4],
          ],
          gold,
        );
        break;
      case 'eva':
        // single horn rising off the brow
        this.poly(
          [
            [46, 30],
            [54, 30],
            [50, broken ? 14 : -2],
          ],
          shade(joint, 2.2),
        );
        break;
      case 'beetle':
        // big curved beetle horn plus side prongs
        this.poly(
          [
            [44, 32],
            [56, 32],
            [58, 14],
            [52, broken ? 10 : 0],
            [46, 12],
          ],
          rgb(d.palette.body),
        );
        this.poly(
          [
            [24, 32],
            [30, 30],
            [18, 16],
          ],
          joint,
        );
        this.poly(
          [
            [76, 32],
            [70, 30],
            [82, 16],
          ],
          joint,
        );
        break;
      case 'tyrant':
        this.rect(46, 10, 8, 22, gold);
        this.poly(
          [
            [18, 36],
            [26, 30],
            [12, 18],
          ],
          gold,
        );
        this.poly(
          [
            [82, 36],
            [74, 30],
            [88, 18],
          ],
          gold,
        );
        break;
      case 'fin':
        this.poly(
          [
            [46, 30],
            [58, 30],
            [64, 6],
          ],
          gold,
        );
        break;
    }
  }

  private drawEyes(d: CharacterDef, mood: Mood, hp: number, eye: RGB) {
    const g = this.glance * 3;
    // flicker when badly damaged
    if (hp <= 0.25 && mood !== 'ko' && Math.random() < 0.15) return;
    const bright = mood === 'power' || mood === 'grin' ? shade(eye, 1.25) : eye;
    if (mood === 'ko') {
      for (const cx of d.eyes === 'mono' ? [50] : [37, 63]) {
        this.line(
          [
            [cx - 5, 46],
            [cx + 5, 55],
          ],
          2.4,
          [200, 70, 70],
        );
        this.line(
          [
            [cx + 5, 46],
            [cx - 5, 55],
          ],
          2.4,
          [200, 70, 70],
        );
      }
      return;
    }
    if (mood === 'win') {
      // happy ^ ^ eyes
      for (const cx of d.eyes === 'mono' ? [50] : [37, 63]) {
        this.line(
          [
            [cx - 6, 54],
            [cx, 47],
            [cx + 6, 54],
          ],
          3,
          bright,
        );
      }
      return;
    }
    if (d.eyes === 'mono') {
      const x = 50 + this.glance * 14;
      const r = mood === 'hurt' ? 2 : 4.2;
      this.circle(x, 50.5, r + 3, bright, 70);
      this.circle(x, 50.5, r, bright);
      return;
    }
    // twin eyes: angular; squint when hurt, steeper (fiercer) when fired up
    const fierce = mood === 'power' || mood === 'grin' ? 3 : d.darkFace ? 2 : 0;
    const h = mood === 'hurt' ? 1.2 : 5;
    for (const side of [-1, 1]) {
      const inner = 50 + side * 6 + g;
      const outer = 50 + side * 22 + g;
      this.poly(
        [
          [inner, 48 + fierce],
          [outer, 47 - fierce * 0.3],
          [outer - side * 2, 47 + h],
          [inner, 48 + fierce + h],
        ],
        bright,
      );
    }
    if (mood === 'power') this.rect(24, 44, 52, 13, [255, 255, 255], 40);
  }
}
