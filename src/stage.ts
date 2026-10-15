import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ARENA } from './config';

// Themed stages. Each one is data (colours, lighting) plus a scenery builder,
// an ambient particle style, moving props, and a matching puck model.
// Physics is identical on every stage; only the look changes.

export type StageId = 'space' | 'beach' | 'lava' | 'snow' | 'city' | 'forest' | 'river' | 'cyber' | 'soccer';

interface StageDef {
  id: StageId;
  name: string;
  /** for the settings swatch */
  swatch: [number, number];
  sky: number;
  fog: [number, number, number]; // colour, near, far
  hemi: [number, number, number]; // sky, ground, intensity
  sun: [number, number];
  floor: number;
  floorLine: number;
  /** extra floor painting */
  pattern: 'sand' | 'cracks' | 'grid' | 'ice' | 'asphalt' | 'moss' | 'planks' | 'neon' | 'pitch';
  rail: number;
  railGlow?: number;
  apron: number;
  apronGlow?: boolean;
  /** the apron is animated water */
  water?: boolean;
  particles: 'none' | 'snow' | 'embers' | 'stars' | 'rain' | 'fireflies' | 'neon' | 'confetti';
}

/** build the decoration around the table (off: just the field, for speed) */
const SCENERY = false;

export const STAGES: StageDef[] = [
  {
    id: 'space',
    name: 'Orbital Deck',
    swatch: [0x0b1226, 0x3ef0ff],
    sky: 0x03040c,
    fog: [0x03040c, 34, 80],
    hemi: [0xbfd8ff, 0x1a1f3a, 1.5],
    sun: [0xffffff, 1.8],
    floor: 0x161d2e,
    floorLine: 0x2fd8ff,
    pattern: 'grid',
    rail: 0x2c3650,
    railGlow: 0x3ef0ff,
    apron: 0x060912,
    particles: 'stars',
  },
  {
    id: 'beach',
    name: 'Island Beach',
    swatch: [0xf3e7c6, 0x2fc6d6],
    sky: 0x5fbcf5,
    fog: [0xbfe8ff, 42, 100],
    hemi: [0xffffff, 0xe8d6a8, 1.9],
    sun: [0xfff6e0, 2.5],
    floor: 0xf3e7c6,
    floorLine: 0xffffff,
    pattern: 'sand',
    rail: 0x9b7a55,
    apron: 0x2fc6d6,
    water: true,
    particles: 'none',
  },
  {
    id: 'lava',
    name: 'Lava Forge',
    swatch: [0x2a1a17, 0xff5a1a],
    sky: 0x1a0605,
    fog: [0x2a0905, 28, 72],
    hemi: [0xffb08a, 0x400a00, 1.3],
    sun: [0xffc08a, 1.6],
    floor: 0x2b211f,
    floorLine: 0xff7a2a,
    pattern: 'cracks',
    rail: 0x161011,
    railGlow: 0xff5a1a,
    apron: 0xff4a10,
    apronGlow: true,
    particles: 'embers',
  },
  {
    id: 'snow',
    name: 'Snowfield',
    swatch: [0xeaf4fc, 0x7fb6e8],
    sky: 0xbfd6ea,
    fog: [0xd8e7f4, 30, 76],
    hemi: [0xe8f0ff, 0x7f98b8, 1.2],
    sun: [0xf2f8ff, 1.5],
    floor: 0xe6f0f9,
    floorLine: 0x7fb6e8,
    pattern: 'ice',
    rail: 0xa9d4f0,
    apron: 0xf4f9fd,
    particles: 'snow',
  },
  {
    id: 'city',
    name: 'Neo City',
    swatch: [0x2a2c33, 0xffcf3e],
    sky: 0x0b0e1c,
    fog: [0x0f1326, 32, 80],
    hemi: [0xa8b8ff, 0x251c33, 1.4],
    sun: [0xffe2c0, 1.6],
    floor: 0x2b2d35,
    floorLine: 0xffcf3e,
    pattern: 'asphalt',
    rail: 0x8a8f98,
    railGlow: 0xff3e8e,
    apron: 0x16171d,
    particles: 'none',
  },
  {
    id: 'forest',
    name: 'Rainy Forest',
    swatch: [0x1f3a24, 0x7fc06a],
    sky: 0x1b2824,
    fog: [0x26352f, 24, 64],
    hemi: [0xb8d0c0, 0x1a2a1a, 1.25],
    sun: [0xc8d8ff, 0.9],
    floor: 0x2d3b27,
    floorLine: 0xc8e8b0,
    pattern: 'moss',
    rail: 0x4a3826,
    apron: 0x1d2a19,
    particles: 'rain',
  },
  {
    id: 'river',
    name: 'River Dusk',
    swatch: [0xff9a5a, 0x3a5a9a],
    sky: 0xe98a5a,
    fog: [0xd4826a, 28, 70],
    hemi: [0xffc8a0, 0x3a3060, 1.35],
    sun: [0xffa060, 1.7],
    floor: 0x8a6440,
    floorLine: 0xffe0b0,
    pattern: 'planks',
    rail: 0x5a3e26,
    apron: 0x2a4a7a,
    water: true,
    particles: 'fireflies',
  },
  {
    id: 'cyber',
    name: 'Cyberpunk',
    swatch: [0x14081f, 0xff2bd6],
    sky: 0x07030f,
    fog: [0x1a0828, 30, 80],
    hemi: [0xb080ff, 0x200830, 1.3],
    sun: [0xff80d0, 1.2],
    floor: 0x120a1c,
    floorLine: 0xff2bd6,
    pattern: 'neon',
    rail: 0x24182e,
    railGlow: 0x2bf0ff,
    apron: 0x0a0610,
    particles: 'neon',
  },
  {
    id: 'soccer',
    name: 'Soccer Field',
    swatch: [0x2f8a3a, 0xffffff],
    sky: 0x8cc8ff,
    fog: [0xb8dcff, 36, 80],
    hemi: [0xffffff, 0x4a7a3a, 1.7],
    sun: [0xffffff, 2.0],
    floor: 0x3a9a44,
    floorLine: 0xffffff,
    pattern: 'pitch',
    rail: 0xe8e8ee,
    apron: 0x2f7a36,
    particles: 'confetti',
  },
];

export const stageById = (id: string) => STAGES.find((s) => s.id === id) ?? STAGES[0];

const css = (c: number) => '#' + c.toString(16).padStart(6, '0');
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const at = <O extends THREE.Object3D>(o: O, x: number, y: number, z: number) => {
  o.position.set(x, y, z);
  return o;
};

/** a canvas texture painted by a callback */
function paint(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cvs = document.createElement('canvas');
  cvs.width = w;
  cvs.height = h;
  draw(cvs.getContext('2d')!);
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Stage {
  group = new THREE.Group();
  def: StageDef;
  private particles: THREE.Points | null = null;
  private rain: THREE.LineSegments | null = null;
  private pVel: Float32Array | null = null;
  private glowMats: THREE.MeshBasicMaterial[] = [];
  private water: THREE.Mesh[] = [];
  /** animated props: boats, flying cars, drones, birds, flickering signs */
  private movers: ((t: number, dt: number) => void)[] = [];

  constructor(id: string) {
    this.def = stageById(id);
    this.buildFloor();
    this.buildRails();
    // the floor and rails are built for the current table width; the scenery is laid out for the standard one
    // only the table itself: the scenery, backdrop and ambient particles outside the field are
    // left out, which keeps the frame cheap (set SCENERY to bring them back)
    if (SCENERY) {
      const sized = new Set(this.group.children);
      this.buildScenery();
      this.buildBackdrop();
      this.fitWidth(sized);
      this.buildParticles();
    }
  }

  /**
   * Scenery is placed for the standard 10 m table. On a smaller or larger table, props
   * outside the walls slide in or out by the difference, and long pieces spanning the
   * table (arches, highway, stands) stretch to match.
   */
  private fitWidth(sized: Set<THREE.Object3D>) {
    const shift = ARENA.width / 2 - 5;
    if (Math.abs(shift) < 1e-3) return;
    const box = new THREE.Box3();
    for (const o of this.group.children) {
      if (sized.has(o)) continue;
      const x = o.position.x;
      if (Math.abs(x) >= 4.5) o.position.x += Math.sign(x) * shift;
      else if (Math.abs(x) < 0.5) {
        box.setFromObject(o);
        const w = box.max.x - box.min.x;
        if (w > 8 && w < 45) o.scale.x *= ARENA.width / 10;
      }
    }
  }

  /**
   * Tropical island (beach stage): a turquoise lagoon that deepens to blue with distance,
   * a sand island around the table with a wet edge, and a foam line that breathes.
   */
  private buildIsland(apron: THREE.Mesh, mat: THREE.MeshLambertMaterial, W: number, L: number) {
    mat.color.set(0xffffff);
    mat.emissive.set(0x0a2a33);
    mat.map = paint(256, 256, (c) => {
      const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0.16, '#8af2e0');
      g.addColorStop(0.3, '#33cad8');
      g.addColorStop(0.58, '#1f8fd2');
      g.addColorStop(1, '#1a4fa6');
      c.fillStyle = g;
      c.fillRect(0, 0, 256, 256);
      // sun glints scattered across the water
      for (let i = 0; i < 260; i++) {
        c.fillStyle = `rgba(255,255,255,${rand(0.05, 0.22)})`;
        c.fillRect(rand(0, 256), rand(0, 256), rand(1, 4), 1);
      }
    });
    mat.needsUpdate = true;
    void apron;
    const rx = W / 2 + 4;
    const rz = L / 2 + 3;
    const ellipse = (o: THREE.Mesh, y: number) => {
      o.rotation.x = -Math.PI / 2;
      o.scale.set(rx, rz, 1);
      o.position.y = y;
      this.group.add(o);
      return o;
    };
    ellipse(new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshLambertMaterial({ color: 0xf0e2bd })), -0.03);
    ellipse(new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 64), new THREE.MeshLambertMaterial({ color: 0xd8c294 })), -0.025);
    // footprints wandering along the sand beside the table, and rocks where sand meets sea
    const printMat = new THREE.MeshBasicMaterial({ color: 0xcdb78a, transparent: true, opacity: 0.55, depthWrite: false });
    const printGeo = new THREE.CircleGeometry(0.09, 10);
    for (const side of [-1, 1])
      for (let k = 0; k < 18; k++) {
        const z = -L / 2 + 1.5 + k * ((L - 3) / 17);
        const x = side * (W / 2 + 1.6 + Math.sin(k * 0.7 + side) * 0.6) + (k % 2 ? 0.14 : -0.14);
        const fp = new THREE.Mesh(printGeo, printMat);
        fp.rotation.x = -Math.PI / 2;
        fp.scale.set(0.8, 1.5, 1);
        fp.position.set(x, -0.026, z);
        this.group.add(fp);
      }
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x9a9488, flatShading: true });
    for (const [a, sc] of [
      [0.35, 0.7],
      [0.42, 0.45],
      [2.55, 0.8],
      [2.7, 0.5],
      [3.6, 0.6],
      [5.9, 0.75],
      [6.05, 0.4],
    ]) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(sc, 0), rockMat);
      rock.position.set(Math.cos(a) * rx * 0.99, sc * 0.2, -Math.sin(a) * rz * 0.99);
      rock.rotation.set(rand(0, 3), rand(0, 3), 0);
      rock.scale.y = 0.6;
      this.group.add(rock);
    }
    const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
    const foam = ellipse(new THREE.Mesh(new THREE.RingGeometry(0.985, 1.04, 64), foamMat), -0.02);
    const foam2 = ellipse(new THREE.Mesh(new THREE.RingGeometry(1.06, 1.085, 64), foamMat.clone()), -0.02);
    ellipse(new THREE.Mesh(new THREE.RingGeometry(1.0, 1.2, 64), new THREE.MeshBasicMaterial({ color: 0xb8fff0, transparent: true, opacity: 0.35, depthWrite: false })), -0.022);
    this.movers.push((t) => {
      const k = 1 + Math.sin(t * 0.9) * 0.012;
      foam.scale.set(rx * k, rz * k, 1);
      foamMat.opacity = 0.75 + Math.sin(t * 0.9) * 0.2;
      const k2 = 1 + ((t * 0.12) % 1) * 0.05;
      foam2.scale.set(rx * k2, rz * k2, 1);
      (foam2.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - ((t * 0.12) % 1));
    });
  }

  private buildFloor() {
    const d = this.def;
    const W = ARENA.width;
    const L = ARENA.length;
    const cvs = document.createElement('canvas');
    cvs.width = 512;
    cvs.height = 1280;
    const c = cvs.getContext('2d')!;
    const CW = cvs.width;
    const CH = cvs.height;
    const px = (x: number) => ((x + W / 2) / W) * CW;
    const py = (y: number) => ((L / 2 - y) / L) * CH;
    /** canvas pixels per metre across the table */
    const m = CW / W;
    c.fillStyle = css(d.floor);
    c.fillRect(0, 0, CW, CH);
    const speckle = (n: number, rgb: string, a0: number, a1: number, size = 2) => {
      for (let i = 0; i < n; i++) {
        c.fillStyle = `rgba(${rgb},${rand(a0, a1)})`;
        c.fillRect(rand(0, CW), rand(0, CH), size, size);
      }
    };
    /** the band in front of each rail, in canvas y (top edge, height) */
    const railBand = (side: number, depth: number) => {
      const y0 = py(side * ARENA.railY + 0.7);
      const y1 = py(side * ARENA.railY - side * depth);
      return [Math.min(y0, y1), Math.abs(y1 - y0)] as const;
    };

    // every arena has its own ground; only the soccer pitch keeps the sports markings
    switch (d.pattern) {
      case 'grid': {
        // spaceship deck: big bolted plates with bevelled seams, hazard bands at the rails,
        // a hexagonal hatch at the centre and running lights down the sides
        const P = 64;
        for (let y = 0; y < CH; y += P)
          for (let x = 0; x < CW; x += P) {
            c.fillStyle = `rgba(255,255,255,${(((x + y) / P) % 2) * 0.025 + rand(0, 0.02)})`;
            c.fillRect(x, y, P, P);
            c.fillStyle = 'rgba(0,0,0,0.45)';
            c.fillRect(x, y, P, 2);
            c.fillRect(x, y, 2, P);
            c.fillStyle = 'rgba(160,220,255,0.08)';
            c.fillRect(x, y + 2, P, 1);
            c.fillRect(x + 2, y, 1, P);
            c.fillStyle = 'rgba(180,220,255,0.18)';
            for (const [bx, by] of [[8, 8], [P - 10, 8], [8, P - 10], [P - 10, P - 10]]) c.fillRect(x + bx, y + by, 3, 3);
          }
        for (const side of [-1, 1]) {
          const [y, h] = railBand(side, 0.9);
          c.save();
          c.beginPath();
          c.rect(0, y, CW, h);
          c.clip();
          c.fillStyle = '#e8b21f';
          c.fillRect(0, y, CW, h);
          c.fillStyle = '#16161c';
          for (let x = -CH; x < CW + CH; x += 36) {
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo(x + 18, y);
            c.lineTo(x + 18 + h, y + h);
            c.lineTo(x + h, y + h);
            c.fill();
          }
          c.restore();
          c.globalAlpha = 0.35;
          c.fillStyle = '#000';
          c.fillRect(0, y, CW, h);
          c.globalAlpha = 1;
        }
        c.strokeStyle = 'rgba(0,0,0,0.5)';
        c.lineWidth = 4;
        const hex = (r: number) => {
          c.beginPath();
          for (let k = 0; k < 6; k++) c.lineTo(px(0) + Math.cos((k * Math.PI) / 3) * r, py(0) + Math.sin((k * Math.PI) / 3) * r);
          c.closePath();
        };
        hex(1.3 * m);
        c.fillStyle = 'rgba(255,255,255,0.05)';
        c.fill();
        c.stroke();
        c.strokeStyle = css(d.floorLine);
        c.globalAlpha = 0.5;
        c.lineWidth = 2;
        hex(1.05 * m);
        c.stroke();
        c.globalAlpha = 1;
        c.fillStyle = css(d.floorLine);
        for (let y = 24; y < CH; y += 48) for (const x of [10, CW - 16]) c.fillRect(x, y, 6, 18);
        break;
      }
      case 'sand': {
        // a beach: wind ripples, damp darker sand at each end, footprints and shells
        speckle(3000, '255,255,255', 0.05, 0.18);
        speckle(2200, '150,110,60', 0.06, 0.18);
        c.strokeStyle = 'rgba(150,110,60,0.16)';
        c.lineWidth = 3;
        for (let y = 20; y < CH; y += 22) {
          c.beginPath();
          for (let x = 0; x <= CW; x += 16) c.lineTo(x, y + Math.sin(x / 38 + y * 0.7) * 6);
          c.stroke();
        }
        for (const side of [-1, 1]) {
          const [y, h] = railBand(side, 1.2);
          const g = c.createLinearGradient(0, y, 0, y + h);
          g.addColorStop(side > 0 ? 0 : 1, 'rgba(120,85,45,0.28)');
          g.addColorStop(side > 0 ? 1 : 0, 'rgba(120,85,45,0)');
          c.fillStyle = g;
          c.fillRect(0, y, CW, h);
        }
        // a trail of footprints wandering across
        let fx = rand(80, 160);
        for (let y = 60; y < CH; y += 46) {
          fx += rand(-14, 14);
          c.fillStyle = 'rgba(150,110,60,0.22)';
          for (const dx of [-9, 9]) {
            c.beginPath();
            c.ellipse(fx + dx, y + (dx > 0 ? 22 : 0), 6, 11, 0, 0, Math.PI * 2);
            c.fill();
          }
        }
        for (let i = 0; i < 70; i++) {
          c.fillStyle = pick(['#fff4e0', '#f2c9a0', '#d9b48a', '#f6dccb']);
          c.beginPath();
          c.ellipse(rand(0, CW), rand(0, CH), rand(3, 7), rand(2, 5), rand(0, 3), 0, Math.PI * 2);
          c.fill();
        }
        break;
      }
      case 'cracks': {
        // the forge floor: dark basalt flagstones with deep seams (no glow), iron grates at the rails
        const rows = 18;
        const rh = CH / rows;
        for (let r = 0; r < rows; r++) {
          let x = -rand(0, 60);
          while (x < CW) {
            const w = rand(70, 140);
            const shade = rand(-0.06, 0.06);
            c.fillStyle = shade > 0 ? `rgba(255,230,210,${shade})` : `rgba(0,0,0,${-shade * 2})`;
            c.beginPath();
            const j = () => rand(-5, 5);
            c.moveTo(x + 3 + j(), r * rh + 3 + j());
            c.lineTo(x + w - 3 + j(), r * rh + 3 + j());
            c.lineTo(x + w - 3 + j(), (r + 1) * rh - 3 + j());
            c.lineTo(x + 3 + j(), (r + 1) * rh - 3 + j());
            c.closePath();
            c.fill();
            c.strokeStyle = 'rgba(0,0,0,0.55)';
            c.lineWidth = 4;
            c.stroke();
            c.strokeStyle = 'rgba(255,220,200,0.06)';
            c.lineWidth = 1;
            c.stroke();
            x += w;
          }
        }
        speckle(2500, '255,240,230', 0.02, 0.07);
        for (const side of [-1, 1]) {
          const [y, h] = railBand(side, 0.8);
          c.fillStyle = '#1a1414';
          c.fillRect(0, y, CW, h);
          c.fillStyle = '#3a302c';
          for (let x = 4; x < CW; x += 14) c.fillRect(x, y + 4, 7, h - 8);
        }
        break;
      }
      case 'ice': {
        // a frozen lake: frost bloom, skate scratches, long cracks and drifted snow at the sides
        for (let i = 0; i < 40; i++) {
          const g = c.createRadialGradient(rand(0, CW), rand(0, CH), 0, rand(0, CW), rand(0, CH), rand(40, 120));
          g.addColorStop(0, 'rgba(255,255,255,0.22)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = g;
          c.fillRect(0, 0, CW, CH);
        }
        c.strokeStyle = 'rgba(255,255,255,0.35)';
        c.lineWidth = 1.5;
        for (let i = 0; i < 40; i++) {
          const x = rand(0, CW);
          const y = rand(0, CH);
          c.beginPath();
          c.arc(x, y, rand(60, 220), rand(0, 6), rand(0, 6) + rand(0.4, 1.2));
          c.stroke();
        }
        c.strokeStyle = 'rgba(90,140,190,0.4)';
        c.lineWidth = 2;
        for (let i = 0; i < 14; i++) {
          let x = rand(0, CW);
          let y = rand(0, CH);
          c.beginPath();
          c.moveTo(x, y);
          for (let k = 0; k < 7; k++) {
            x += rand(-40, 40);
            y += rand(-40, 40);
            c.lineTo(x, y);
          }
          c.stroke();
        }
        for (const x0 of [0, CW]) {
          const g = c.createLinearGradient(x0, 0, x0 === 0 ? 70 : CW - 70, 0);
          g.addColorStop(0, 'rgba(255,255,255,0.95)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = g;
          c.fillRect(x0 === 0 ? 0 : CW - 70, 0, 70, CH);
        }
        break;
      }
      case 'asphalt': {
        // a city street: tar seams, a zebra crossing at the middle, stop bars at the rails,
        // manholes and oil stains
        speckle(5000, '255,255,255', 0.02, 0.08);
        speckle(3000, '0,0,0', 0.1, 0.25);
        c.strokeStyle = 'rgba(0,0,0,0.45)';
        c.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
          let x = rand(0, CW);
          let y = rand(0, CH);
          c.beginPath();
          c.moveTo(x, y);
          for (let k = 0; k < 6; k++) {
            x += rand(-50, 50);
            y += rand(10, 50);
            c.lineTo(x, y);
          }
          c.stroke();
        }
        c.fillStyle = 'rgba(245,245,240,0.85)';
        const zh = 1.6 * m;
        for (let x = 20; x < CW - 20; x += 44) c.fillRect(x, py(0) - zh / 2, 26, zh);
        c.fillStyle = 'rgba(255,207,62,0.9)';
        for (const x of [10, CW - 18]) c.fillRect(x, 0, 8, CH);
        for (const side of [-1, 1]) {
          const [y, h] = railBand(side, 0.9);
          c.fillStyle = 'rgba(245,245,240,0.85)';
          c.fillRect(24, side > 0 ? y + h - 10 : y, CW - 48, 10);
        }
        for (const [x, y] of [[0.3, 0.3], [0.7, 0.68]]) {
          c.fillStyle = 'rgba(0,0,0,0.5)';
          c.beginPath();
          c.arc(CW * x, CH * y, 26, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = 'rgba(255,255,255,0.12)';
          c.lineWidth = 2;
          for (let r = 8; r < 26; r += 6) {
            c.beginPath();
            c.arc(CW * x, CH * y, r, 0, Math.PI * 2);
            c.stroke();
          }
        }
        for (let i = 0; i < 5; i++) {
          const g = c.createRadialGradient(0, 0, 0, 0, 0, 40);
          g.addColorStop(0, 'rgba(0,0,0,0.35)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          c.save();
          c.translate(rand(0, CW), rand(0, CH));
          c.scale(1, 0.6);
          c.fillStyle = g;
          c.fillRect(-40, -40, 80, 80);
          c.restore();
        }
        break;
      }
      case 'moss': {
        // a forest clearing: moss, a flagstone path down the middle, fallen leaves and roots
        for (let i = 0; i < 160; i++) {
          c.fillStyle = `rgba(${pick(['120,170,90', '70,110,60', '160,190,110', '50,80,40'])},${rand(0.12, 0.32)})`;
          c.beginPath();
          c.ellipse(rand(0, CW), rand(0, CH), rand(10, 40), rand(8, 28), rand(0, 3), 0, Math.PI * 2);
          c.fill();
        }
        c.strokeStyle = 'rgba(60,40,25,0.55)';
        c.lineWidth = 6;
        for (let i = 0; i < 6; i++) {
          c.beginPath();
          const x = pick([rand(0, 60), rand(CW - 60, CW)]);
          const y = rand(0, CH);
          c.moveTo(x, y);
          c.bezierCurveTo(x + rand(-60, 60), y + rand(20, 80), x + rand(-60, 60), y + rand(80, 140), x + rand(-40, 40), y + rand(140, 200));
          c.stroke();
        }
        for (let y = 30; y < CH; y += 70) {
          const x = CW / 2 + rand(-30, 30);
          c.fillStyle = 'rgba(150,150,140,0.55)';
          c.beginPath();
          c.ellipse(x, y, rand(34, 46), rand(22, 28), rand(-0.3, 0.3), 0, Math.PI * 2);
          c.fill();
          c.fillStyle = 'rgba(255,255,255,0.08)';
          c.beginPath();
          c.ellipse(x - 6, y - 5, 18, 8, 0, 0, Math.PI * 2);
          c.fill();
        }
        for (let i = 0; i < 160; i++) {
          c.fillStyle = pick(['#c8782a', '#a0522d', '#d9a441', '#7a8a3a']);
          c.save();
          c.translate(rand(0, CW), rand(0, CH));
          c.rotate(rand(0, 6));
          c.beginPath();
          c.ellipse(0, 0, 7, 3.5, 0, 0, Math.PI * 2);
          c.fill();
          c.restore();
        }
        break;
      }
      case 'planks': {
        // a wooden pier: long boards with grain, iron straps and nails, a rope coil
        const bw = 40;
        for (let y = 0; y < CH; y += bw) {
          c.fillStyle = `rgba(0,0,0,${rand(0.04, 0.2)})`;
          c.fillRect(0, y, CW, bw);
          c.fillStyle = 'rgba(30,18,8,0.75)';
          c.fillRect(0, y, CW, 3);
          const seam = rand(80, CW - 80);
          c.fillRect(seam, y, 3, bw);
          c.strokeStyle = 'rgba(255,220,170,0.12)';
          c.lineWidth = 1.5;
          for (let k = 0; k < 4; k++) {
            c.beginPath();
            c.moveTo(0, y + rand(6, bw - 4));
            c.bezierCurveTo(160, y + rand(6, bw - 4), 340, y + rand(6, bw - 4), CW, y + rand(6, bw - 4));
            c.stroke();
          }
          c.fillStyle = 'rgba(40,30,20,0.85)';
          for (const x of [26, seam - 10, seam + 12, CW - 30]) c.fillRect(x, y + 16, 5, 5);
        }
        c.fillStyle = 'rgba(40,40,44,0.75)';
        for (const x of [70, CW - 90]) c.fillRect(x, 0, 14, CH);
        c.strokeStyle = 'rgba(216,192,138,0.9)';
        c.lineWidth = 5;
        for (let r = 8; r < 34; r += 6) {
          c.beginPath();
          c.arc(CW * 0.8, CH * 0.45, r, 0, Math.PI * 2);
          c.stroke();
        }
        break;
      }
      case 'neon': {
        // a circuit board: copper traces with pads and vias, a chip at the centre
        c.lineCap = 'round';
        const trace = (col: string, wdt: number) => {
          c.strokeStyle = col;
          c.lineWidth = wdt;
          for (let i = 0; i < 46; i++) {
            let x = Math.round(rand(0, 16)) * 32;
            let y = Math.round(rand(0, 40)) * 32;
            c.beginPath();
            c.moveTo(x, y);
            for (let k = 0; k < 5; k++) {
              const r = Math.random();
              if (r < 0.4) x += pick([-32, 32]);
              else if (r < 0.8) y += pick([-32, 32]);
              else {
                x += pick([-32, 32]);
                y += pick([-32, 32]);
              }
              c.lineTo(x, y);
            }
            c.stroke();
            c.fillStyle = col;
            c.beginPath();
            c.arc(x, y, wdt * 1.6, 0, Math.PI * 2);
            c.fill();
          }
        };
        trace('rgba(255,43,214,0.35)', 3);
        trace('rgba(43,240,255,0.5)', 2);
        const cw = 2.4 * m;
        c.fillStyle = '#07040c';
        c.fillRect(px(0) - cw / 2, py(0) - cw / 2, cw, cw);
        c.strokeStyle = 'rgba(43,240,255,0.8)';
        c.lineWidth = 3;
        c.strokeRect(px(0) - cw / 2, py(0) - cw / 2, cw, cw);
        c.fillStyle = 'rgba(255,43,214,0.7)';
        for (let k = 0; k < 8; k++) {
          const o = -cw / 2 + ((k + 0.5) * cw) / 8;
          c.fillRect(px(0) + o - 3, py(0) - cw / 2 - 14, 6, 12);
          c.fillRect(px(0) + o - 3, py(0) + cw / 2 + 2, 6, 12);
          c.fillRect(px(0) - cw / 2 - 14, py(0) + o - 3, 12, 6);
          c.fillRect(px(0) + cw / 2 + 2, py(0) + o - 3, 12, 6);
        }
        break;
      }
      case 'pitch': {
        // the soccer pitch keeps its full markings: mowing stripes, halfway line, centre circle, boxes
        for (let y = 0; y < CH; y += 80) {
          if ((y / 80) % 2) continue;
          c.fillStyle = 'rgba(255,255,255,0.07)';
          c.fillRect(0, y, CW, 80);
        }
        c.strokeStyle = 'rgba(255,255,255,0.85)';
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(0, py(0));
        c.lineTo(CW, py(0));
        c.stroke();
        c.beginPath();
        c.arc(px(0), py(0), 68, 0, Math.PI * 2);
        c.stroke();
        for (const side of [-1, 1]) {
          const [y, h] = railBand(side, 4.2);
          c.strokeRect(px(-3.4), y, px(3.4) - px(-3.4), h);
        }
        break;
      }
    }

    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const glowy = d.pattern === 'grid' || d.pattern === 'neon';
    const mat = glowy
      ? new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: d.pattern === 'neon' ? 0.6 : 0.35 })
      : new THREE.MeshLambertMaterial({ map: tex });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), mat);
    floor.rotation.x = -Math.PI / 2;
    this.group.add(floor);

    // apron: water, lava, snow, void, grass or street around the table
    const apronMat = d.apronGlow
      ? new THREE.MeshBasicMaterial({ color: d.apron })
      : new THREE.MeshLambertMaterial({ color: d.apron, emissive: d.water ? 0x0a3a66 : 0x000000 });
    if (d.apronGlow) this.glowMats.push(apronMat as THREE.MeshBasicMaterial);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(W + 60, L + 60), apronMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.04;
    this.group.add(apron);
    if (d.id === 'beach') this.buildIsland(apron, apronMat as THREE.MeshLambertMaterial, W, L);
    if (d.water) {
      this.water.push(apron);
      // glinting ripple strips on the water
      const ripple = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false });
      for (let i = 0; i < 30; i++) {
        const r = new THREE.Mesh(new THREE.PlaneGeometry(rand(0.6, 2.2), 0.06), ripple);
        r.rotation.x = -Math.PI / 2;
        const side = Math.random() < 0.5 ? -1 : 1;
        // half on the sides, half behind the far rail where the camera looks
        if (i % 2) r.position.set(side * rand(6.5, 20), -0.02, rand(-30, 30));
        else r.position.set(rand(-12, 12), -0.02, rand(-40, -14));
        this.group.add(r);
        const z0 = r.position.z;
        const ph = rand(0, 6);
        this.movers.push((t) => {
          r.position.z = z0 + Math.sin(t * 0.4 + ph) * 0.6;
          (r.material as THREE.MeshBasicMaterial).opacity = 0.1 + Math.max(0, Math.sin(t * 1.3 + ph)) * 0.2;
        });
      }
    }
  }

  private buildRails() {
    const d = this.def;
    const L = ARENA.length;
    const t = ARENA.wallThickness;
    const railMat = new THREE.MeshLambertMaterial({ color: d.rail });
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(t, 0.7, L), railMat);
      rail.position.set(side * (ARENA.width / 2 + t / 2), 0.35, 0);
      this.group.add(rail);
      if (d.railGlow !== undefined) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, L), new THREE.MeshBasicMaterial({ color: d.railGlow }));
        strip.position.set(side * (ARENA.width / 2 + 0.02), 0.6, 0);
        this.group.add(strip);
        this.glowMats.push(strip.material as THREE.MeshBasicMaterial);
      }
      if (d.id === 'city') {
        // hazard stripes on the barrier
        const stripeMat = new THREE.MeshLambertMaterial({ color: 0xffcf3e });
        for (let z = -L / 2 + 1; z < L / 2; z += 2) {
          const s = new THREE.Mesh(new THREE.BoxGeometry(t + 0.02, 0.18, 0.6), stripeMat);
          s.position.set(side * (ARENA.width / 2 + t / 2), 0.25, z);
          this.group.add(s);
        }
      }
      if (d.id === 'soccer') {
        // advertising boards along the touchline
        const ads = [0xe8312f, 0x2f63e8, 0xffc23d, 0x1aa860, 0x111111];
        for (let z = -L / 2 + 1.3; z < L / 2; z += 2.6) {
          const col = pick(ads);
          const board = new THREE.Mesh(
            new THREE.BoxGeometry(t + 0.04, 0.5, 2.4),
            new THREE.MeshLambertMaterial({ map: paint(128, 32, (c) => {
              c.fillStyle = css(col);
              c.fillRect(0, 0, 128, 32);
              c.fillStyle = '#ffffff';
              c.font = '900 18px sans-serif';
              c.fillText(pick(['MARBLE', 'GOAL!', 'B-FIGHT', 'SPORT', 'FIZZ']), 10, 23);
            }) }),
          );
          board.position.set(side * (ARENA.width / 2 + t / 2), 0.42, z);
          this.group.add(board);
        }
      }
      if (d.id === 'cyber') {
        // neon kanji-ish signs along the barrier
        for (let z = -L / 2 + 2; z < L / 2; z += 4) {
          const col = pick([0xff2bd6, 0x2bf0ff, 0xffe14d]);
          const sign = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 1.2), new THREE.MeshBasicMaterial({ color: col }));
          sign.position.set(side * (ARENA.width / 2 + 0.03), 0.35, z);
          this.group.add(sign);
        }
      }
    }
  }

  private buildScenery() {
    const d = this.def;
    const g = this.group;
    const sides = (fn: (side: number, z: number) => void, step = 4, from = -18, to = 18) => {
      for (const side of [-1, 1]) for (let z = from; z <= to; z += step) fn(side, z + rand(-1, 1));
    };
    const lam = (color: number, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
    const basic = (color: number, extra: THREE.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
    const add = (m: THREE.Object3D, x: number, y: number, z: number) => {
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    /** a soft mountain range on the horizon */
    const range = (color: number, y0: number, dist: number, count: number, h: [number, number]) => {
      const mat = lam(color, { flatShading: true, fog: true });
      for (let i = 0; i < count; i++) {
        const hh = rand(h[0], h[1]);
        const m = new THREE.Mesh(new THREE.ConeGeometry(hh * rand(0.9, 1.4), hh, 5), mat);
        const a = rand(-1.2, 1.2);
        add(m, Math.sin(a) * dist, y0 + hh / 2, -Math.cos(a) * dist - 10);
      }
    };

    switch (d.id) {
      case 'beach': {
        sides((side, z) => {
          const palm = makePalm(rand(3.2, 4.6), side * rand(0.6, 1.1));
          palm.rotation.y = rand(-0.4, 0.4);
          add(palm, side * rand(8, 11), 0, z);
        }, 6);
        // striped umbrellas, towels and surfboards on the sand strip
        sides((side, z) => {
          const u = new THREE.Group();
          u.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 6), lam(0xffffff)), 0, 1, 0));
          const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.5, 8, 1, true), lam(pick([0xff4a3d, 0x2f7cff, 0xffd23e]), { side: THREE.DoubleSide }));
          canopy.position.y = 2;
          u.add(canopy);
          u.rotation.z = side * 0.15;
          add(u, side * rand(6.4, 7.2), 0, z);
          const towel = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.6), lam(pick([0xff8ab8, 0x8affd0, 0xffe14d]), { side: THREE.DoubleSide }));
          towel.rotation.x = -Math.PI / 2;
          add(towel, side * rand(6.6, 7.6), 0.01, z + 1.5);
        }, 9, -14, 14);
        for (const side of [-1, 1]) {
          const board = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.1, 0.08), lam(pick([0xff6a1a, 0x3ef0ff])));
          board.rotation.z = side * 0.25;
          add(board, side * 6.6, 1, rand(-6, 6));
          // sandcastle
          const castle = new THREE.Group();
          for (const [x, h] of [
            [-0.25, 0.5],
            [0.25, 0.5],
            [0, 0.75],
          ])
            castle.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, h, 8), lam(0xe8c88a)), x, h / 2, 0));
          add(castle, side * 6.9, 0, rand(-14, -10));
        }
        add(new THREE.Mesh(new THREE.SphereGeometry(3, 20, 14), basic(0xfff1b0, { fog: false })), -14, 16, -48);
        // gulls gliding in circles
        for (let i = 0; i < 4; i++) {
          const bird = new THREE.Group();
          for (const s of [-1, 1]) {
            const w = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.12), basic(0xffffff));
            w.position.x = s * 0.24;
            w.rotation.z = s * 0.35;
            bird.add(w);
          }
          g.add(bird);
          const r = rand(6, 12);
          const h = rand(6, 10);
          const ph = rand(0, 6);
          this.movers.push((t) => {
            const a = t * 0.25 + ph;
            bird.position.set(Math.cos(a) * r, h + Math.sin(t * 2 + ph) * 0.3, -14 + Math.sin(a) * r);
            bird.rotation.y = -a;
            bird.children.forEach((w, k) => (w.rotation.z = (k ? 1 : -1) * (0.35 + Math.sin(t * 6 + ph) * 0.3)));
          });
        }
        break;
      }
      case 'lava': {
        const rock = lam(0x1d1514, { flatShading: true });
        sides((side, z) => {
          const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.8, 2), 0), rock);
          r.rotation.set(rand(0, 3), rand(0, 3), 0);
          add(r, side * rand(7, 12), rand(0, 0.6), z);
        }, 4);
        // a volcano on the horizon with a glowing crater and lava falls
        const volcano = new THREE.Mesh(new THREE.ConeGeometry(16, 14, 9, 1, true), lam(0x24140f, { flatShading: true }));
        add(volcano, 5, 6, -42);
        const crater = add(new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.4, 12), basic(0xff7a2a)), 5, 13, -42);
        this.glowMats.push((crater as THREE.Mesh).material as THREE.MeshBasicMaterial);
        for (const side of [-1, 1]) {
          const fall = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 9), basic(0xff5a1a, { side: THREE.DoubleSide }));
          add(fall, side * 14, 4.5, rand(-20, -8));
          fall.rotation.y = side * 0.6;
        }
        // obsidian pillars with glowing veins
        sides((side, z) => {
          const h = rand(3, 6);
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, h, 6), lam(0x120c0c, { flatShading: true }));
          add(p, side * rand(9, 13), h / 2, z);
          const vein = new THREE.Mesh(new THREE.BoxGeometry(0.06, h * 0.8, 0.06), basic(0xff7a2a));
          add(vein, side * rand(9, 13), h / 2, z);
        }, 9);
        break;
      }
      case 'space': {
        const planet = new THREE.Mesh(new THREE.SphereGeometry(9, 32, 20), lam(0x5b4bd6, { emissive: 0x1a1240 }));
        add(planet, 8, -3, -46);
        const ring = new THREE.Mesh(new THREE.RingGeometry(11, 15, 48), basic(0x9fd8ff, { transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
        ring.position.copy(planet.position);
        ring.rotation.set(1.2, 0.3, 0);
        g.add(ring);
        const moon = add(new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 14), lam(0xb8b0c8, { emissive: 0x202030 })), -20, 12, -46);
        this.movers.push((t) => moon.position.set(-20 + Math.sin(t * 0.05) * 3, 12, -46));
        // nebula backdrop
        const neb = new THREE.Mesh(
          new THREE.PlaneGeometry(90, 50),
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            fog: false,
            map: paint(256, 128, (c) => {
              for (const [x, y, col] of [
                [60, 60, 'rgba(160,60,255,0.6)'],
                [150, 50, 'rgba(60,180,255,0.5)'],
                [210, 80, 'rgba(255,60,160,0.35)'],
              ] as [number, number, string][]) {
                const gr = c.createRadialGradient(x, y, 0, x, y, 70);
                gr.addColorStop(0, col);
                gr.addColorStop(1, 'rgba(0,0,0,0)');
                c.fillStyle = gr;
                c.fillRect(0, 0, 256, 128);
              }
            }),
          }),
        );
        add(neb, 0, 14, -70);
        // deck pylons with cyan lights
        const pylon = lam(0x2c3650);
        const light = basic(0x3ef0ff);
        this.glowMats.push(light);
        sides((side, z) => {
          add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 0.4), pylon), side * 6.2, 0.8, z);
          add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.42), light), side * 6.2, 1.5, z);
        }, 6);
        // a satellite tumbling slowly and drones circling the deck
        const sat = new THREE.Group();
        sat.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.2), lam(0xc8ccd8)));
        for (const s of [-1, 1]) sat.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 0.9), lam(0x2a4aa8)), s * 1.6, 0, 0));
        add(sat, -12, 9, -24);
        this.movers.push((t) => {
          sat.rotation.set(t * 0.2, t * 0.3, 0);
        });
        for (let i = 0; i < 3; i++) {
          const drone = new THREE.Group();
          drone.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), lam(0x8a96b0)));
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), basic(0xff3e5e));
          eye.position.z = -0.25;
          drone.add(eye);
          g.add(drone);
          const ph = (i / 3) * Math.PI * 2;
          this.movers.push((t) => {
            const a = t * 0.4 + ph;
            drone.position.set(Math.cos(a) * 8.5, 3.2 + Math.sin(t * 1.5 + ph) * 0.4, Math.sin(a) * 14);
            drone.rotation.y = -a;
          });
        }
        break;
      }
      case 'snow': {
        const pine = lam(0x2f6b4f, { flatShading: true });
        const snowCap = lam(0xffffff, { flatShading: true });
        sides((side, z) => {
          const tree = new THREE.Group();
          const h = rand(2.4, 4.4);
          for (let i = 0; i < 3; i++) {
            const tier = new THREE.Mesh(new THREE.ConeGeometry(1.2 - i * 0.3, h * 0.45, 7), i === 2 ? snowCap : pine);
            tier.position.y = h * 0.3 + i * h * 0.25;
            tree.add(tier);
          }
          add(tree, side * rand(7, 12), 0, z);
        }, 4);
        // snowmen with carrot noses
        for (const side of [-1, 1]) {
          const man = new THREE.Group();
          [0.45, 0.33, 0.24].forEach((r, k) => man.add(at(new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), lam(0xffffff)), 0, [0.42, 1.05, 1.5][k], 0)));
          const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.25, 6), lam(0xff7a1a));
          nose.rotation.x = side > 0 ? Math.PI / 2 : -Math.PI / 2;
          nose.position.set(0, 1.5, 0.25);
          man.add(nose);
          man.rotation.y = side * -Math.PI / 2;
          add(man, side * 6.7, 0, rand(-8, 8));
        }
        // a cabin with a glowing window
        const cabin = new THREE.Group();
        cabin.add(at(new THREE.Mesh(new THREE.BoxGeometry(3, 2, 2.4), lam(0x6a4a2e)), 0, 1, 0));
        const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.3, 4), lam(0xffffff));
        roof.position.y = 2.6;
        roof.rotation.y = Math.PI / 4;
        cabin.add(roof);
        cabin.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.5), basic(0xffd27a)), 0, 1.2, 1.21));
        add(cabin, 11, 0, -16);
        range(0xdfe8f4, -1, 34, 11, [5, 10]);
        // aurora ribbon
        const aurora = new THREE.Mesh(
          new THREE.PlaneGeometry(70, 10, 20, 1),
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
            fog: false,
            side: THREE.DoubleSide,
            map: paint(128, 32, (c) => {
              const gr = c.createLinearGradient(0, 0, 0, 32);
              gr.addColorStop(0, 'rgba(120,255,200,0)');
              gr.addColorStop(0.5, 'rgba(120,255,200,0.9)');
              gr.addColorStop(1, 'rgba(160,120,255,0)');
              c.fillStyle = gr;
              c.fillRect(0, 0, 128, 32);
            }),
          }),
        );
        add(aurora, 0, 9, -58);
        const pos = aurora.geometry.attributes.position as THREE.BufferAttribute;
        const base = Float32Array.from(pos.array as Float32Array);
        this.movers.push((t) => {
          for (let i = 0; i < pos.count; i++) pos.setY(i, base[i * 3 + 1] + Math.sin(base[i * 3] * 0.15 + t * 0.6) * 1.5);
          pos.needsUpdate = true;
        });
        break;
      }
      case 'city': {
        const wallMat = lam(0x1b1f2e);
        const winTex = paint(64, 128, (c) => {
          c.fillStyle = '#10131f';
          c.fillRect(0, 0, 64, 128);
          for (let y = 6; y < 128; y += 10)
            for (let x = 4; x < 64; x += 10) {
              if (Math.random() < 0.55) continue;
              c.fillStyle = Math.random() < 0.7 ? '#ffd27a' : '#7fe6ff';
              c.fillRect(x, y, 5, 6);
            }
        });
        const winMat = new THREE.MeshBasicMaterial({ map: winTex });
        sides((side, z) => {
          const h = rand(5, 16);
          const w = rand(2.5, 4);
          add(new THREE.Mesh(new THREE.BoxGeometry(w, h, w), [winMat, winMat, wallMat, wallMat, winMat, winMat]), side * rand(10, 15), h / 2, z);
        }, 4.5);
        // street lamps along the barriers
        const pole = lam(0x5a5f6a);
        const bulb = basic(0xfff0c0);
        sides((side, z) => {
          add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3, 6), pole), side * 6.4, 1.5, z);
          add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), bulb), side * 6.4, 3.05, z);
        }, 8);
        // parked cars and a billboard
        sides((side, z) => {
          const car = new THREE.Group();
          car.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 2.2), lam(pick([0xe8312f, 0x2f63e8, 0xf4f4f4, 0x222222]))), 0, 0.45, 0));
          car.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.4, 1.2), lam(0x14161c)), 0, 0.85, 0.1));
          for (const s of [-1, 1]) car.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.05), basic(0xfff4c0)), s * 0.35, 0.5, -1.11));
          add(car, side * 8, 0, z);
        }, 11, -12, 12);
        const bill = new THREE.Mesh(
          new THREE.PlaneGeometry(8, 3.4),
          new THREE.MeshBasicMaterial({
            map: paint(256, 108, (c) => {
              const gr = c.createLinearGradient(0, 0, 256, 0);
              gr.addColorStop(0, '#ff3e8e');
              gr.addColorStop(1, '#3ef0ff');
              c.fillStyle = gr;
              c.fillRect(0, 0, 256, 108);
              c.fillStyle = '#ffffff';
              c.font = '900 38px sans-serif';
              c.fillText('MARBLE', 24, 50);
              c.font = '700 22px sans-serif';
              c.fillText('FIGHT NIGHT', 26, 86);
            }),
          }),
        );
        add(bill, -12, 9, -22);
        bill.rotation.y = 0.4;
        break;
      }
      case 'forest': {
        const bark = lam(0x3e2c1e);
        const leafA = lam(0x1f4a28, { flatShading: true });
        const leafB = lam(0x2e6a34, { flatShading: true });
        sides((side, z) => {
          const tree = new THREE.Group();
          const h = rand(6, 10);
          tree.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, h, 7), bark), 0, h / 2, 0));
          for (let k = 0; k < 3; k++) {
            const c = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(1.4, 2.2), 0), k % 2 ? leafA : leafB);
            c.position.set(rand(-0.6, 0.6), h - k * 1.2, rand(-0.6, 0.6));
            tree.add(c);
          }
          add(tree, side * rand(7.5, 13), 0, z);
        }, 3.5);
        // ferns, mossy rocks, logs and glowing mushrooms
        const fern = lam(0x3a8a3a, { side: THREE.DoubleSide });
        sides((side, z) => {
          const f = new THREE.Group();
          for (let k = 0; k < 5; k++) {
            const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.1, 3), fern);
            leaf.rotation.set(1.0, (k / 5) * Math.PI * 2, 0);
            leaf.translateY(0.45);
            f.add(leaf);
          }
          add(f, side * rand(6.4, 7.5), 0.1, z);
        }, 2.5);
        sides((side, z) => {
          const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.4, 0.9), 0), lam(0x56604c, { flatShading: true }));
          add(r, side * rand(6.6, 9), 0.2, z);
          const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), basic(pick([0x7fffd4, 0xffa0e0])));
          add(cap, side * rand(6.5, 7.2), 0.15, z + 1);
        }, 5);
        for (const side of [-1, 1]) {
          const log = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 4, 9), bark);
          log.rotation.set(0, rand(0, 1), Math.PI / 2);
          add(log, side * 9, 0.35, rand(-10, 10));
        }
        // drifting mist
        const mist = new THREE.MeshBasicMaterial({ color: 0xc8dcd0, transparent: true, opacity: 0.12, depthWrite: false });
        for (let i = 0; i < 6; i++) {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.4), mist);
          const z0 = rand(-24, 0);
          add(m, rand(-8, 8), rand(0.8, 2.2), z0);
          const ph = rand(0, 6);
          this.movers.push((t) => (m.position.x = Math.sin(t * 0.1 + ph) * 6));
        }
        break;
      }
      case 'river': {
        // low sun over the water, hills, reeds, lanterns and a drifting boat
        // a low sun sinking behind the far hills, in shot during play
        add(new THREE.Mesh(new THREE.CircleGeometry(3.4, 28), basic(0xffd08a, { fog: false })), -2, 2.2, -56);
        range(0x5a3a5a, -0.5, 34, 12, [2.5, 5]);
        const reed = lam(0x6a7a3a);
        sides((side, z) => {
          for (let k = 0; k < 5; k++) {
            const h = rand(0.8, 1.8);
            const r = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, h, 4), reed);
            r.rotation.z = rand(-0.2, 0.2);
            add(r, side * rand(6.2, 7.2), h / 2, z + rand(-0.5, 0.5));
          }
          add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), lam(0x6a3a1a)), side * 6.6, 1.5, z);
        }, 2.4);
        sides((side, z) => {
          add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 6), lam(0x3a2a1a)), side * 5.9, 1.2, z);
          const lantern = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), basic(0xffa94a)), side * 5.9, 2.5, z);
          const ph = rand(0, 6);
          this.movers.push((t) => ((lantern as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setRGB(1, 0.62 + Math.sin(t * 3 + ph) * 0.05, 0.28));
        }, 6);
        const boat = new THREE.Group();
        boat.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 3), lam(0x5a3a1e)), 0, 0.15, 0));
        boat.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), lam(0x3a2a1a)), 0, 1.4, 0));
        const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), lam(0xf4e4c8, { side: THREE.DoubleSide }));
        sail.position.set(0, 1.6, 0.3);
        sail.rotation.y = Math.PI / 2;
        boat.add(sail);
        g.add(boat);
        this.movers.push((t) => {
          // sails across behind the far rail
          boat.position.set(((t * 0.9) % 44) - 22, Math.sin(t * 1.2) * 0.06, -19);
          boat.rotation.y = Math.PI / 2;
          boat.rotation.z = Math.sin(t * 0.9) * 0.05;
        });
        break;
      }
      case 'cyber': {
        // neon towers with glowing strips and holographic billboards
        const towerMat = lam(0x150c22);
        sides((side, z) => {
          const h = rand(8, 22);
          const w = rand(2.2, 4);
          add(new THREE.Mesh(new THREE.BoxGeometry(w, h, w), towerMat), side * rand(10, 16), h / 2, z);
          const col = pick([0xff2bd6, 0x2bf0ff, 0xffe14d, 0x8a5cff]);
          for (let k = 0; k < 3; k++) {
            const strip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.08, w + 0.05), basic(col));
            add(strip, side * rand(10, 16), rand(1, h), z);
          }
        }, 4);
        for (const side of [-1, 1]) {
          const holo = new THREE.Mesh(
            new THREE.PlaneGeometry(4, 6),
            new THREE.MeshBasicMaterial({
              transparent: true,
              opacity: 0.8,
              side: THREE.DoubleSide,
              depthWrite: false,
              map: paint(96, 144, (c) => {
                c.fillStyle = side > 0 ? 'rgba(255,43,214,0.35)' : 'rgba(43,240,255,0.35)';
                c.fillRect(0, 0, 96, 144);
                c.fillStyle = '#ffffff';
                c.font = '900 34px sans-serif';
                c.fillText(side > 0 ? '弾' : '戦', 28, 60);
                c.font = '700 14px sans-serif';
                c.fillText(side > 0 ? 'MARBLE' : 'NEO 2077', 14, 110);
              }),
            }),
          );
          add(holo, side * 9, 5, rand(-14, -4));
          holo.rotation.y = side * -0.5;
          const ph = rand(0, 6);
          this.movers.push((t) => ((holo.material as THREE.MeshBasicMaterial).opacity = Math.random() < 0.02 ? 0.2 : 0.7 + Math.sin(t * 2 + ph) * 0.1));
        }
        // flying cars streaking past with light trails
        for (let i = 0; i < 5; i++) {
          const car = new THREE.Group();
          car.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 1.6), lam(0x2a2236)));
          const trail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 3), basic(pick([0xff2bd6, 0x2bf0ff, 0xffe14d])));
          trail.position.z = 2.2;
          car.add(trail);
          g.add(car);
          const lane = rand(-1, 1) > 0 ? 1 : -1;
          const x = lane * rand(8, 14);
          const y = rand(5, 12);
          const speed = rand(6, 12);
          const ph = rand(0, 60);
          this.movers.push((t) => {
            car.position.set(x, y, (((t * speed + ph) % 80) - 40) * lane);
            car.rotation.y = lane > 0 ? Math.PI : 0;
          });
        }
        break;
      }
      case 'soccer': {
        // goals behind each rail, stands with a crowd, floodlights
        const white = lam(0xffffff);
        for (const side of [-1, 1]) {
          const goal = new THREE.Group();
          const w = 5;
          const h = 2.2;
          for (const x of [-w / 2, w / 2]) goal.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, h, 8), white), x, h / 2, 0));
          const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, w, 8), white);
          bar.rotation.z = Math.PI / 2;
          bar.position.y = h;
          goal.add(bar);
          const net = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 10, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.5 }));
          net.position.set(0, h / 2, side * 0.8);
          goal.add(net);
          add(goal, 0, 0, side * (ARENA.length / 2 + 2.2));
        }
        const crowdColors = [0xe8312f, 0x2f63e8, 0xffc23d, 0xffffff, 0x1aa860, 0x333333];
        for (const side of [-1, 1]) {
          for (let row = 0; row < 5; row++) {
            const step = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 40), lam(0x9aa0aa));
            add(step, side * (10 + row * 1.6), 0.3 + row * 0.6, 0);
            const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.6, 0.35), lam(0xffffff), 40);
            const m = new THREE.Matrix4();
            for (let k = 0; k < 40; k++) {
              m.makeTranslation(side * (10 + row * 1.6) + rand(-0.6, 0.6), 0.9 + row * 0.6, -19 + k * 0.95 + rand(-0.2, 0.2));
              crowd.setMatrixAt(k, m);
              crowd.setColorAt(k, new THREE.Color(pick(crowdColors)));
            }
            g.add(crowd);
            // the crowd bobs, a cheap Mexican wave
            const rowPh = row * 0.4;
            this.movers.push((t) => {
              for (let k = 0; k < 40; k++) {
                const lift = Math.max(0, Math.sin(t * 2 - k * 0.25 + rowPh)) * 0.25;
                m.makeTranslation(side * (10 + row * 1.6), 0.9 + row * 0.6 + lift, -19 + k * 0.95);
                crowd.setMatrixAt(k, m);
              }
              crowd.instanceMatrix.needsUpdate = true;
            });
          }
        }
        for (const [x, z] of [
          [-14, -20],
          [14, -20],
          [-14, 20],
          [14, 20],
        ]) {
          add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 14, 8), lam(0x8a8f98)), x, 7, z);
          add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 0.4), basic(0xffffee)), x, 14, z);
        }
        break;
      }
    }
  }

  /**
   * The strip the gameplay camera actually sees beyond the arena: behind the
   * far rail (z -13 to -36), widening with distance, below the HUD. Every
   * stage dresses it so the scenery is part of the fight, not just the intro.
   */
  private buildBackdrop() {
    const d = this.def;
    const g = this.group;
    const lam = (color: number, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
    const basic = (color: number, extra: THREE.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
    const add = <O extends THREE.Object3D>(m: O, x: number, y: number, z: number) => {
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    const box = (w: number, h: number, dd: number, mat: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), mat);
    /** half-width of the view at depth z (with the camera's sideways drift) */
    const halfW = (z: number) => 6.4 + Math.max(0, -z - 13) * 0.2 + 2;
    /** jittered rows across the background; the middle stays clear close in, behind the opponent */
    const rows = (zs: number[], spacing: number, gap: number, fn: (x: number, z: number, i: number) => void) => {
      let i = 0;
      for (const z0 of zs) {
        const w = halfW(z0);
        for (let x = -w; x <= w; x += spacing) {
          const xx = x + rand(-spacing * 0.3, spacing * 0.3);
          if (Math.abs(xx) < gap && z0 > -19) continue;
          fn(xx, z0 + rand(-0.8, 0.8), i++);
        }
      }
    };
    /** an arch over the far rail: two posts and a beam, framing the opponent */
    const arch = (post: THREE.Material, beam: THREE.Material, h: number, z: number, sign?: THREE.Material) => {
      for (const side of [-1, 1]) add(box(0.4, h, 0.4, post), side * 5.6, h / 2, z);
      add(box(11.6, 0.4, 0.4, beam), 0, h, z);
      if (sign) add(box(3.4, 0.7, 0.08, sign), 0, h - 0.6, z + 0.22);
    };
    /** a string of lights sagging between two points */
    const garland = (x0: number, x1: number, y: number, z: number, sag: number, colors: number[], n = 12) => {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 24; k++) {
        const u = k / 24;
        pts.push(new THREE.Vector3(x0 + (x1 - x0) * u, y - Math.sin(u * Math.PI) * sag, z));
      }
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x2a2018 })));
      const bulbs: THREE.Mesh[] = [];
      for (let k = 1; k < n; k++) {
        const u = k / n;
        const b = add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), basic(colors[k % colors.length])), x0 + (x1 - x0) * u, y - Math.sin(u * Math.PI) * sag - 0.15, z);
        bulbs.push(b);
      }
      this.movers.push((t) => bulbs.forEach((b, k) => b.scale.setScalar(0.85 + Math.max(0, Math.sin(t * 2.5 + k)) * 0.3)));
    };
    /** something crossing the background left to right (or back), looping */
    const crosser = (obj: THREE.Object3D, y: number, z: number, speed: number, span = 26) => {
      g.add(obj);
      const ph = rand(0, span * 2);
      const dir = speed > 0 ? 1 : -1;
      this.movers.push((t) => {
        obj.position.set((((t * Math.abs(speed) + ph) % (span * 2)) - span) * dir, y, z);
        obj.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      });
    };

    switch (d.id) {
      case 'forest': {
        const bark = lam(0x3e2c1e);
        const leaves = [lam(0x1f4a28, { flatShading: true }), lam(0x2e6a34, { flatShading: true }), lam(0x3a7a3a, { flatShading: true })];
        // a tree line behind the far rail, denser further back
        rows([-15.5, -19, -24, -30], 2.6, 3, (x, z, i) => {
          const h = rand(4, 8) + (z < -20 ? 2 : 0);
          const tree = new THREE.Group();
          const trunk = box(0.4, h, 0.4, bark);
          trunk.position.y = h / 2;
          tree.add(trunk);
          for (let k = 0; k < 3; k++) {
            const c = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(1.2, 2), 0), leaves[(i + k) % 3]);
            c.position.set(rand(-0.6, 0.6), h - k * 1.1, rand(-0.5, 0.5));
            tree.add(c);
          }
          tree.rotation.y = rand(0, 6);
          add(tree, x, 0, z);
        });
        // undergrowth right behind the rail: ferns, mossy rocks, a fallen log, glowing mushrooms
        const fern = lam(0x3a8a3a, { side: THREE.DoubleSide });
        const moss = lam(0x56604c, { flatShading: true });
        rows([-13.8, -14.8], 1.4, 1.4, (x, z) => {
          if (Math.random() < 0.5) {
            const f = new THREE.Group();
            for (let k = 0; k < 6; k++) {
              const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.1, 3), fern);
              leaf.rotation.set(1.0, (k / 6) * Math.PI * 2, 0);
              leaf.translateY(0.45);
              f.add(leaf);
            }
            add(f, x, 0.05, z);
          } else add(new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.3, 0.6), 0), moss), x, 0.2, z);
          if (Math.random() < 0.4) {
            const cap = add(new THREE.Mesh(new THREE.SphereGeometry(rand(0.12, 0.2), 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), basic(pick([0x7fffd4, 0xffa0e0, 0xd8ff6a]))), x + 0.4, 0.22, z + 0.2);
            add(box(0.05, 0.22, 0.05, lam(0xe8e0d0)), x + 0.4, 0.11, z + 0.2);
            const ph = rand(0, 6);
            this.movers.push((t) => cap.scale.setScalar(1 + Math.sin(t * 2 + ph) * 0.08));
          }
        });
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 5, 9), bark);
        log.rotation.set(0, 0.25, Math.PI / 2);
        add(log, -4.5, 0.4, -16.5);
        // branches hanging into the top corners of the shot
        for (const side of [-1, 1]) {
          const bough = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 0), leaves[1]);
          bough.scale.set(1.6, 0.6, 1);
          add(bough, side * 6.2, 4.6, -12);
          const ph = rand(0, 6);
          this.movers.push((t) => (bough.rotation.z = Math.sin(t * 0.8 + ph) * 0.05));
        }
        // mist banks drifting between the trees
        const mist = basic(0xc8dcd0, { transparent: true, opacity: 0.14, depthWrite: false });
        for (let i = 0; i < 4; i++) {
          const m = add(new THREE.Mesh(new THREE.PlaneGeometry(16, 2), mist), 0, rand(0.6, 1.8), -17 - i * 4);
          const ph = rand(0, 6);
          this.movers.push((t) => (m.position.x = Math.sin(t * 0.12 + ph) * 5));
        }
        break;
      }
      case 'river': {
        // a lantern garland strung across behind the far rail
        for (const side of [-1, 1]) add(box(0.18, 4.2, 0.18, lam(0x3a2a1a)), side * 5.7, 2.1, -13.6);
        garland(-5.7, 5.7, 4.1, -13.6, 0.9, [0xffa94a, 0xff6a5a, 0xffe08a]);
        // reeds and rocks along the far bank of the pier
        const reed = lam(0x6a7a3a);
        rows([-13.6, -14.4], 0.8, 2.2, (x, z) => {
          for (let k = 0; k < 4; k++) {
            const h = rand(0.7, 1.6);
            const r = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, h, 4), reed);
            r.rotation.z = rand(-0.25, 0.25);
            add(r, x + rand(-0.3, 0.3), h / 2, z + rand(-0.3, 0.3));
          }
          if (Math.random() < 0.4) add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), lam(0x6a3a1a)), x, 1.3, z);
        });
        // an arched wooden bridge across the river behind
        const wood = lam(0x5a3a22);
        const bridge = new THREE.Group();
        for (let k = -10; k <= 10; k++) {
          const u = k / 10;
          const plank = box(1.05, 0.12, 2, wood);
          plank.position.set(k, 2.2 - u * u * 1.6, 0);
          plank.rotation.z = -u * 0.32;
          bridge.add(plank);
          if (k % 2 === 0) {
            const post = box(0.1, 0.8, 0.1, wood);
            post.position.set(k, 2.6 - u * u * 1.6, -0.9);
            bridge.add(post);
          }
        }
        for (const x of [-7, 0, 7]) {
          const pier = box(0.5, 2.6, 0.5, lam(0x3a2a1a));
          pier.position.set(x, 0.9 - (x / 10) ** 2 * 1.6, 0);
          bridge.add(pier);
        }
        add(bridge, 0, 0, -25);
        // a lantern glowing on the bridge
        add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), basic(0xffa94a)), 2, 3, -25.9);
        // lily pads on the water
        const pad = lam(0x3a7a3a, { side: THREE.DoubleSide });
        for (let i = 0; i < 18; i++) {
          const p = new THREE.Mesh(new THREE.CircleGeometry(rand(0.25, 0.5), 10, 0.3, Math.PI * 1.8), pad);
          p.rotation.x = -Math.PI / 2;
          add(p, rand(-11, 11), -0.02, rand(-23, -14));
        }
        break;
      }
      case 'cyber': {
        // neon arch over the far rail, with a scrolling sign
        const post = lam(0x241a30);
        const sign = new THREE.MeshBasicMaterial({
          map: paint(256, 52, (c) => {
            c.fillStyle = '#12051c';
            c.fillRect(0, 0, 256, 52);
            c.strokeStyle = '#ff2bd6';
            c.lineWidth = 4;
            c.strokeRect(3, 3, 250, 46);
            c.fillStyle = '#2bf0ff';
            c.font = '900 30px sans-serif';
            c.fillText('MARBLE // 弾', 24, 37);
          }),
        });
        arch(post, post, 3.8, -12.9, sign);
        for (const side of [-1, 1]) {
          add(box(0.06, 3.6, 0.06, basic(0xff2bd6)), side * 5.38, 1.9, -12.68);
          add(box(11, 0.06, 0.06, basic(0x2bf0ff)), 0, 3.56, -12.68);
        }
        // tower wall behind, strips of neon at random heights
        const tower = lam(0x150c22);
        rows([-18, -23, -30], 3.2, 2.5, (x, z) => {
          const h = rand(6, 18);
          const w = rand(2, 3.2);
          add(box(w, h, w, tower), x, h / 2, z);
          const col = pick([0xff2bd6, 0x2bf0ff, 0xffe14d, 0x8a5cff]);
          for (let k = 0; k < 3; k++) add(box(w + 0.05, 0.08, w + 0.05, basic(col)), x, rand(0.8, Math.min(h, 7)), z);
          if (Math.random() < 0.5) {
            // a glowing window column on the tower face
            add(box(0.3, Math.min(h, 6) * 0.8, 0.05, basic(pick([0xffe14d, 0x2bf0ff]), { transparent: true, opacity: 0.7 })), x + rand(-0.5, 0.5), Math.min(h, 6) * 0.45, z + w / 2 + 0.03);
          }
        });
        // a giant holo ad flickering behind the opponent
        const holo = add(
          new THREE.Mesh(
            new THREE.PlaneGeometry(6, 3.4),
            new THREE.MeshBasicMaterial({
              transparent: true,
              depthWrite: false,
              side: THREE.DoubleSide,
              map: paint(192, 108, (c) => {
                const gr = c.createLinearGradient(0, 0, 192, 108);
                gr.addColorStop(0, 'rgba(255,43,214,0.55)');
                gr.addColorStop(1, 'rgba(43,240,255,0.45)');
                c.fillStyle = gr;
                c.fillRect(0, 0, 192, 108);
                c.fillStyle = '#ffffff';
                c.font = '900 40px sans-serif';
                c.fillText('NEO', 14, 50);
                c.font = '700 22px sans-serif';
                c.fillText('FIGHT CLUB 2077', 14, 88);
              }),
            }),
          ),
          5,
          3.6,
          -17,
        );
        this.movers.push((t) => ((holo.material as THREE.MeshBasicMaterial).opacity = Math.random() < 0.03 ? 0.25 : 0.8 + Math.sin(t * 3) * 0.1));
        // flying cars streaking across the shot
        for (let i = 0; i < 6; i++) {
          const car = new THREE.Group();
          car.add(box(0.9, 0.3, 1.8, lam(0x2a2236)));
          car.add(Object.assign(box(0.7, 0.2, 0.8, basic(0x12051c)), {}));
          const trail = box(0.12, 0.06, 3, basic(pick([0xff2bd6, 0x2bf0ff, 0xffe14d])));
          trail.position.z = 2.3;
          car.add(trail);
          crosser(car, rand(2.2, 5), -15 - i * 2.4, (i % 2 ? 1 : -1) * rand(5, 10));
        }
        break;
      }
      case 'soccer': {
        // stands behind the far goal, packed with a waving crowd
        const crowdColors = [0xe8312f, 0x2f63e8, 0xffc23d, 0xffffff, 0x1aa860, 0x333333];
        const m4 = new THREE.Matrix4();
        for (let row = 0; row < 6; row++) {
          const z = -19 - row * 1.5;
          const y = 0.3 + row * 0.7;
          add(box(26, 0.7, 1.5, lam(row % 2 ? 0x8a909a : 0x9aa0aa)), 0, y, z);
          const n = 48;
          const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.38, 0.6, 0.32), lam(0xffffff), n);
          for (let k = 0; k < n; k++) {
            m4.makeTranslation(-12.5 + k * 0.53, y + 0.65, z);
            crowd.setMatrixAt(k, m4);
            crowd.setColorAt(k, new THREE.Color(pick(crowdColors)));
          }
          g.add(crowd);
          const rowPh = row * 0.5;
          this.movers.push((t) => {
            for (let k = 0; k < n; k++) {
              const lift = Math.max(0, Math.sin(t * 2.2 - k * 0.22 + rowPh)) * 0.3;
              m4.makeTranslation(-12.5 + k * 0.53, y + 0.65 + lift, z);
              crowd.setMatrixAt(k, m4);
            }
            crowd.instanceMatrix.needsUpdate = true;
          });
        }
        // ad boards between the goal and the stands
        const ads = [0xe8312f, 0x2f63e8, 0xffc23d, 0x1aa860, 0x111111];
        for (let x = -11; x <= 11; x += 2.8) {
          const col = pick(ads);
          add(
            new THREE.Mesh(
              new THREE.BoxGeometry(2.6, 0.7, 0.1),
              new THREE.MeshLambertMaterial({
                emissive: 0x222222,
                map: paint(128, 32, (c) => {
                  c.fillStyle = css(col);
                  c.fillRect(0, 0, 128, 32);
                  c.fillStyle = '#ffffff';
                  c.font = '900 18px sans-serif';
                  c.fillText(pick(['MARBLE', 'GOAL!', 'B-FIGHT', 'SPORT', 'FIZZ']), 10, 23);
                }),
              }),
            ),
            x,
            0.35,
            -17.4,
          );
        }
        // floodlight towers at the far corners and corner flags
        for (const side of [-1, 1]) {
          add(box(0.3, 7, 0.3, lam(0x8a8f98)), side * 9.5, 3.5, -24);
          add(box(2.6, 1.3, 0.3, basic(0xffffee)), side * 9.5, 6.8, -23.8);
          add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), lam(0xffffff)), side * 4.8, 0.7, -12.85);
          const flag = add(new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), lam(0xffd23e, { side: THREE.DoubleSide })), side * 4.6, 1.25, -12.85);
          this.movers.push((t) => (flag.rotation.y = Math.sin(t * 4 + side) * 0.3));
        }
        break;
      }
      case 'beach': {
        // the island's palm grove: a dense stand behind the far-left, a few leaning over the right
        for (const [x, z, h, lean] of [
          [-6.6, -14.6, 4.4, -1.2],
          [-8.4, -15.8, 5.2, -0.6],
          [-7.4, -17.4, 4.0, 0.7],
          [-10.2, -16.6, 4.8, -0.9],
          [-5.4, -18.8, 5.6, 0.4],
          [-9.0, -19.6, 4.6, -0.3],
          [-11.6, -18.4, 5.0, 0.8],
          [7.2, -14.8, 4.6, 1.2],
          [9.6, -16.2, 5.0, 0.6],
          [11.4, -15.4, 4.2, 1.0],
          [-6.0, -21.4, 6.0, -0.5],
          [-12.8, -21.0, 5.4, 0.3],
          [-8.0, -23.2, 6.4, 0.6],
          [-3.6, -16.4, 3.6, -1.0],
          [-13.6, -15.6, 4.4, -0.7],
          [13.2, -17.8, 5.6, 0.4],
          [10.2, -19.6, 4.8, -0.5],
        ] as [number, number, number, number][]) {
          const palm = makePalm(h, lean);
          palm.rotation.y = rand(0, Math.PI * 2);
          add(palm, x, 0, z);
          const ph = rand(0, 6);
          this.movers.push((tt) => (palm.rotation.z = Math.sin(tt * 0.8 + ph) * 0.025));
        }
        // undergrowth at the grove's feet
        const bush = lam(0x2e8a3e, { flatShading: true });
        const bush2 = lam(0x46a84a, { flatShading: true });
        for (let i = 0; i < 18; i++) add(new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.4, 0.9), 0), i % 3 ? bush : bush2), rand(-13.5, -3.5), 0.25, rand(-23, -14));
        for (let i = 0; i < 6; i++) add(new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.4, 0.7), 0), bush), rand(9, 13.5), 0.25, rand(-20, -15));
        // over-water huts on stilts out in the lagoon, joined to the island by a pier
        const wood = lam(0x8a5a32);
        const darkWood = lam(0x5a3a22);
        const straw = lam(0xd8b56a, { flatShading: true });
        const plank = lam(0xb07a48);
        const pier = new THREE.Group();
        for (let k = 0; k < 26; k++) {
          pier.add(box3(1.2, 0.08, 0.5, plank, 0, 0.7, -k * 0.55));
          if (k % 3 === 0)
            for (const sx of [-0.55, 0.55]) {
              pier.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), darkWood).translateX(sx).translateY(0.2).translateZ(-k * 0.55));
              pier.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 5), darkWood).translateX(sx).translateY(0.98).translateZ(-k * 0.55));
            }
        }
        for (const sx of [-0.55, 0.55]) pier.add(box3(0.05, 0.05, 14.3, darkWood, sx, 1.2, -6.9));
        add(pier, 7.6, 0, -15.5);
        // the hut row: one at the pier's end, the rest on short boardwalks off either side
        for (const [x, z, r, walk] of [
          [7.6, -31.6, 0.1, 0],
          [11.2, -27.2, -0.3, -1],
          [4.0, -25.0, 0.4, 1],
          [11.6, -21.4, -0.2, -1],
          [3.4, -20.2, 0.5, 1],
        ] as [number, number, number, number][]) {
          add(makeHut(wood, darkWood, straw, plank), x, 0, z).rotation.y = r;
          if (walk) add(box3(Math.abs(x - 7.6) - 1.6, 0.08, 0.6, plank, 0, 0, 0), (x + 7.6) / 2, 0.7, z);
        }
        // the pier's ladder posts throw ripples
        const ripple = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false });
        for (const z of [-15.5, -20.5, -25.5, -30.4]) {
          const r = add(new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 24), ripple.clone()), 7.6, 0.02, z);
          r.rotation.x = -Math.PI / 2;
          const ph = rand(0, 1);
          this.movers.push((tt) => {
            const f = (tt * 0.35 + ph) % 1;
            r.scale.setScalar(0.6 + f * 1.4);
            (r.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - f);
          });
        }
        // distant islands on the horizon, and puffy clouds above them
        const green = lam(0x2f8a4a, { flatShading: true });
        const rock = lam(0x8a8a80, { flatShading: true });
        for (const [x, z, sx, sy] of [
          [-16, -52, 9, 2.4],
          [4, -60, 6, 1.6],
          [18, -54, 7, 2.8],
        ] as [number, number, number, number][]) {
          const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), green);
          mound.scale.set(sx, sy, sx * 0.55);
          add(mound, x, -0.2, z);
          add(new THREE.Mesh(new THREE.DodecahedronGeometry(sy * 0.5, 0), rock), x + sx * 0.5, 0.2, z + 1);
        }
        for (const [x, y, z, k] of [
          [-12, 3.6, -64, 1.2],
          [2, 4.4, -70, 1.6],
          [14, 3.4, -62, 1.0],
          [-24, 4.8, -72, 1.4],
          [26, 4.2, -70, 1.3],
          [-36, 6, -78, 2.2],
          [36, 6.6, -80, 2.4],
          [-6, 7.4, -84, 2.6],
          [16, 9.4, -82, 1.8],
        ] as [number, number, number, number][]) {
          const cloud = add(makeCloud(k * 1.3), x, y, z);
          const ph = rand(0, 6);
          this.movers.push((tt) => (cloud.position.x = x + Math.sin(tt * 0.05 + ph) * 2));
        }
        // lifeguard tower and a sandcastle
        const tower = new THREE.Group();
        for (const [x, z] of [
          [-0.5, -0.5],
          [0.5, -0.5],
          [-0.5, 0.5],
          [0.5, 0.5],
        ])
          tower.add(Object.assign(box(0.1, 2, 0.1, lam(0xffffff)), {}).translateX(x).translateZ(z).translateY(1));
        tower.add(box(1.4, 0.8, 1.4, lam(0xff4a3d)).translateY(2.4));
        tower.add(box(1.6, 0.1, 1.6, lam(0xffffff)).translateY(2.85));
        add(tower, 8.2, 0, -16);
        const castle = new THREE.Group();
        for (const [x, h] of [
          [-0.3, 0.6],
          [0.3, 0.6],
          [0, 0.9],
        ])
          castle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, h, 8), lam(0xe8c88a)).translateX(x).translateY(h / 2));
        add(castle, -1.8, 0, -14.4);
        // a sailboat on the sea and gulls low over the far end
        const boat = new THREE.Group();
        boat.add(box(0.9, 0.3, 2.4, lam(0xffffff)));
        const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), lam(0xff4a3d, { side: THREE.DoubleSide }));
        sail.position.y = 1.3;
        sail.rotation.y = Math.PI / 2;
        boat.add(sail);
        crosser(boat, 0.1, -28, 1.2, 24);
        for (let i = 0; i < 5; i++) {
          const bird = new THREE.Group();
          for (const s2 of [-1, 1]) {
            const w = box(0.5, 0.03, 0.12, basic(0xffffff));
            w.position.x = s2 * 0.24;
            bird.add(w);
          }
          g.add(bird);
          const r = rand(3, 7);
          const h = rand(3, 4.6);
          const ph = rand(0, 6);
          this.movers.push((t) => {
            const a = t * 0.35 + ph;
            bird.position.set(Math.cos(a) * r, h + Math.sin(t * 2 + ph) * 0.2, -20 + Math.sin(a) * 4);
            bird.rotation.y = -a;
            bird.children.forEach((w, k) => (w.rotation.z = (k ? 1 : -1) * (0.3 + Math.sin(t * 6 + ph) * 0.35)));
          });
        }
        break;
      }
      case 'lava': {
        // braziers on the far corners of the rails
        for (const side of [-1, 1]) {
          add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.25, 0.5, 8), lam(0x1d1514)), side * 5.25, 0.95, -12.4);
          const fire = add(new THREE.Mesh(new THREE.ConeGeometry(0.38, 1, 8), basic(0xff7a1a, { transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })), side * 5.25, 1.7, -12.4);
          this.movers.push(() => fire.scale.set(0.9 + Math.random() * 0.2, 0.8 + Math.random() * 0.5, 0.9 + Math.random() * 0.2));
        }
        // obsidian spires and rocks rising out of the lava behind the far rail
        const rock = lam(0x1d1514, { flatShading: true });
        const vein = basic(0xff6a1a);
        rows([-15, -19, -25], 2.8, 3, (x, z) => {
          const h = rand(1.5, z < -18 ? 6 : 3.4);
          const spire = new THREE.Mesh(new THREE.ConeGeometry(rand(0.6, 1.1), h, 5), rock);
          spire.rotation.y = rand(0, 3);
          add(spire, x, h / 2 - 0.1, z);
          if (Math.random() < 0.5) add(box(0.06, h * 0.6, 0.06, vein), x + 0.2, h * 0.3, z + 0.45);
        });
        // a rock arch and lava falls pouring off the far cliffs
        const archL = new THREE.Mesh(new THREE.TorusGeometry(3, 0.6, 5, 10, Math.PI), rock);
        add(archL, -5, 0, -21);
        for (const x of [-9, 3, 9.5]) {
          const fall = add(new THREE.Mesh(new THREE.PlaneGeometry(1.2, 6), basic(0xff5a1a, { side: THREE.DoubleSide })), x, 3, -30);
          const ph = rand(0, 6);
          this.movers.push((t) => ((fall.material as THREE.MeshBasicMaterial).color.setRGB(1, 0.35 + Math.sin(t * 4 + ph) * 0.08, 0.1)));
        }
        // bubbling lava domes
        for (let i = 0; i < 8; i++) {
          const bub = add(new THREE.Mesh(new THREE.SphereGeometry(rand(0.2, 0.4), 8, 6), basic(0xffa040)), rand(-9, 9), 0, rand(-26, -14));
          const ph = rand(0, 6);
          this.movers.push((t) => {
            const k = (t * 0.7 + ph) % 2;
            bub.scale.setScalar(k < 1 ? k : 0.01);
          });
        }
        break;
      }
      case 'snow': {
        const pine = lam(0x2f6b4f, { flatShading: true });
        const cap = lam(0xffffff, { flatShading: true });
        rows([-15.5, -19, -24, -30], 2.4, 3, (x, z) => {
          const tree = new THREE.Group();
          const h = rand(3, 5.5) + (z < -20 ? 1.5 : 0);
          for (let i = 0; i < 3; i++) {
            const tier = new THREE.Mesh(new THREE.ConeGeometry(1.3 - i * 0.32, h * 0.45, 7), i === 2 ? cap : pine);
            tier.position.y = h * 0.28 + i * h * 0.24;
            tree.add(tier);
            if (i < 2) {
              const dust = new THREE.Mesh(new THREE.ConeGeometry(1.1 - i * 0.3, h * 0.12, 7), cap);
              dust.position.y = h * 0.42 + i * h * 0.24;
              tree.add(dust);
            }
          }
          add(tree, x, 0, z);
        });
        // snowmen guarding the far rail, with scarves and coal eyes
        for (const x of [-3.6, 3.8]) {
          const man = new THREE.Group();
          [0.5, 0.36, 0.26].forEach((r, k) => man.add(new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), lam(0xffffff)).translateY([0.45, 1.15, 1.65][k])));
          const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 6), lam(0xff7a1a));
          nose.rotation.x = Math.PI / 2;
          nose.position.set(0, 1.65, 0.3);
          man.add(nose);
          man.add(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 6, 12), lam(0xe8312f)).translateY(1.38).rotateX(Math.PI / 2));
          for (const s2 of [-1, 1]) man.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), basic(0x111111)).translateX(s2 * 0.09).translateY(1.72).translateZ(0.23));
          add(man, x, 0, -14.4);
        }
        // a cabin with a lit window and chimney smoke
        const cabin = new THREE.Group();
        cabin.add(box(3, 2, 2.4, lam(0x6a4a2e)).translateY(1));
        const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.3, 4), lam(0xffffff));
        roof.position.y = 2.6;
        roof.rotation.y = Math.PI / 4;
        cabin.add(roof);
        cabin.add(new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.55), basic(0xffd27a)).translateY(1.2).translateZ(1.21));
        cabin.add(box(0.4, 1, 0.4, lam(0x5a5a62)).translateX(0.8).translateY(3));
        add(cabin, -7, 0, -20);
        const smoke = basic(0xdde4ec, { transparent: true, opacity: 0.5, depthWrite: false });
        for (let i = 0; i < 4; i++) {
          const puff = add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), smoke), -6.2, 3.6, -20);
          this.movers.push((t) => {
            const k = (t * 0.25 + i / 4) % 1;
            puff.position.set(-6.2 + k * 0.8, 3.6 + k * 2.4, -20);
            puff.scale.setScalar(0.6 + k * 1.6);
          });
        }
        // ice crystals catching the light
        for (const [x, z] of [
          [6.2, -14],
          [-6, -14.6],
          [9, -18],
        ]) {
          const ice = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), lam(0xbfe8ff, { emissive: 0x3a7aa0, flatShading: true, transparent: true, opacity: 0.85 })), x, 0.7, z);
          ice.scale.y = 1.8;
        }
        break;
      }
      case 'city': {
        // the skyline right behind the far rail
        const wallMat = lam(0x1b1f2e);
        const winMat = new THREE.MeshBasicMaterial({
          map: paint(64, 128, (c) => {
            c.fillStyle = '#10131f';
            c.fillRect(0, 0, 64, 128);
            for (let y = 6; y < 128; y += 10)
              for (let x = 4; x < 64; x += 10) {
                if (Math.random() < 0.5) continue;
                c.fillStyle = Math.random() < 0.7 ? '#ffd27a' : '#7fe6ff';
                c.fillRect(x, y, 5, 6);
              }
          }),
        });
        rows([-22, -28, -34], 3.6, 0, (x, z) => {
          const h = rand(5, 16);
          const w = rand(2.6, 3.6);
          add(new THREE.Mesh(new THREE.BoxGeometry(w, h, w), [winMat, winMat, wallMat, wallMat, winMat, winMat]), x, h / 2, z);
          if (Math.random() < 0.3) add(box(0.06, 1.2, 0.06, basic(0xff3e5e)), x, h + 0.6, z); // antenna light
        });
        // an elevated highway with traffic crossing the shot
        const deck = lam(0x3a3e48);
        add(box(40, 0.4, 2.6, deck), 0, 2.2, -17);
        add(box(40, 0.5, 0.12, lam(0x8a8f98)), 0, 2.6, -15.75);
        for (let x = -12; x <= 12; x += 6) add(box(0.6, 2.2, 0.6, deck), x, 1.1, -17);
        for (let x = -12; x <= 12; x += 3) add(box(0.08, 0.08, 0.08, basic(0xffcf3e)), x, 2.9, -15.75);
        for (let i = 0; i < 6; i++) {
          const car = new THREE.Group();
          const col = pick([0xe8312f, 0x2f63e8, 0xf4f4f4, 0x222222, 0xffcf3e]);
          car.add(box(1.0, 0.45, 2.0, lam(col)).translateY(0.25));
          car.add(box(0.85, 0.35, 1.1, lam(0x14161c)).translateY(0.6).translateZ(0.1));
          for (const s2 of [-1, 1]) car.add(box(0.2, 0.12, 0.05, basic(0xfff4c0)).translateX(s2 * 0.32).translateY(0.3).translateZ(-1.02));
          for (const s2 of [-1, 1]) car.add(box(0.2, 0.1, 0.05, basic(0xff2a2a)).translateX(s2 * 0.32).translateY(0.3).translateZ(1.02));
          crosser(car, 2.4, -17 + (i % 2 ? 0.6 : -0.6), (i % 2 ? 1 : -1) * rand(5, 8), 20);
        }
        // big billboard behind the opponent, traffic lights on the far corners
        add(
          new THREE.Mesh(
            new THREE.PlaneGeometry(4.6, 2),
            new THREE.MeshBasicMaterial({
              map: paint(256, 112, (c) => {
                const gr = c.createLinearGradient(0, 0, 256, 0);
                gr.addColorStop(0, '#ff3e8e');
                gr.addColorStop(1, '#3ef0ff');
                c.fillStyle = gr;
                c.fillRect(0, 0, 256, 112);
                c.fillStyle = '#ffffff';
                c.font = '900 40px sans-serif';
                c.fillText('MARBLE', 24, 52);
                c.font = '700 24px sans-serif';
                c.fillText('FIGHT NIGHT', 26, 90);
              }),
            }),
          ),
          -4.2,
          3.75,
          -17.9,
        );
        for (const side of [-1, 1]) {
          add(box(0.12, 3.4, 0.12, lam(0x2a2e36)), side * 5.4, 1.7, -12.8);
          const lamps = new THREE.Group();
          lamps.add(box(0.36, 0.9, 0.3, lam(0x1a1c22)));
          const lights = [0xff2a2a, 0xffcf3e, 0x3aff6a].map((c, k) => {
            const l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), basic(c));
            l.position.set(0, 0.28 - k * 0.28, 0.16);
            lamps.add(l);
            return l;
          });
          add(lamps, side * 5.4, 3.4, -12.8);
          this.movers.push((t) => {
            const phase = Math.floor((t / 3 + (side > 0 ? 1 : 0)) % 3);
            lights.forEach((l, k) => l.scale.setScalar(k === phase ? 1.15 : 0.5));
          });
        }
        break;
      }
      case 'space': {
        // a docking gantry over the far rail, lights chasing along the beam
        const steel = lam(0x2c3650);
        arch(steel, steel, 3.8, -13);
        const chase: THREE.Mesh[] = [];
        for (let k = 0; k < 14; k++) chase.push(add(box(0.3, 0.12, 0.08, basic(0x3ef0ff)), -5.2 + k * 0.8, 3.55, -12.75));
        this.movers.push((t) => chase.forEach((c, k) => c.scale.setScalar(((t * 8 - k) % 14 + 14) % 14 < 2 ? 1.6 : 0.6)));
        // a hangar wall with bays behind the deck
        rows([-18, -24], 4, 3, (x, z) => {
          const h = rand(2, 4.5);
          add(box(3.4, h, 1.2, lam(0x1b2236)), x, h / 2, z);
          add(box(2.4, 0.1, 0.05, basic(pick([0x3ef0ff, 0xff3e8e, 0xffcf3e]))), x, h * 0.75, z + 0.62);
        });
        // asteroids tumbling past and a shuttle crossing
        const roid = lam(0x6a6570, { flatShading: true });
        for (let i = 0; i < 9; i++) {
          const a = add(new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.4, 1.3), 0), roid), rand(-10, 10), rand(2.5, 5.5), rand(-36, -20));
          const spin = rand(0.2, 0.8);
          const x0 = a.position.x;
          const ph = rand(0, 6);
          this.movers.push((t) => {
            a.rotation.set(t * spin, t * spin * 0.7, 0);
            a.position.x = x0 + Math.sin(t * 0.1 + ph) * 1.5;
          });
        }
        const shuttle = new THREE.Group();
        shuttle.add(box(0.9, 0.5, 2.6, lam(0xd8dce6)));
        shuttle.add(box(2.4, 0.08, 1, lam(0x9aa0b0)).translateZ(0.5));
        shuttle.add(box(0.5, 0.3, 0.1, basic(0x3ef0ff)).translateZ(1.32));
        crosser(shuttle, 4.2, -22, 3, 24);
        break;
      }
    }
  }

  private buildParticles() {
    const kind = this.def.particles;
    if (kind === 'none') return;
    if (kind === 'rain') {
      // falling streaks as line segments
      const n = 500;
      const pos = new Float32Array(n * 6);
      this.pVel = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = rand(-14, 14);
        const y = rand(0, 16);
        const z = rand(-24, 16);
        pos.set([x, y, z, x + 0.05, y + 0.5, z], i * 6);
        this.pVel[i] = rand(16, 22);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xbcd4e0, transparent: true, opacity: 0.45 }));
      this.group.add(this.rain);
      return;
    }
    const n = kind === 'stars' ? 500 : kind === 'fireflies' ? 70 : kind === 'confetti' ? 160 : 220;
    const pos = new Float32Array(n * 3);
    const cols = new Float32Array(n * 3);
    this.pVel = new Float32Array(n);
    const palette = kind === 'confetti' ? [0xff4a3d, 0x2f7cff, 0xffd23e, 0x1aa860, 0xffffff] : kind === 'neon' ? [0xff2bd6, 0x2bf0ff, 0xffe14d] : [0xffffff];
    for (let i = 0; i < n; i++) {
      if (kind === 'stars') {
        // a shell of stars around and below the deck
        const th = rand(0, Math.PI * 2);
        const ph = rand(-0.3, 1.2);
        const r = rand(45, 70);
        pos[i * 3] = Math.cos(th) * Math.cos(ph) * r;
        pos[i * 3 + 1] = Math.sin(ph) * r;
        pos[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * r;
      } else if (kind === 'fireflies') {
        pos[i * 3] = (Math.random() < 0.5 ? -1 : 1) * rand(5.6, 12);
        pos[i * 3 + 1] = rand(0.4, 3);
        pos[i * 3 + 2] = rand(-20, 14);
      } else {
        pos[i * 3] = rand(-12, 12);
        pos[i * 3 + 1] = rand(0, 14);
        pos[i * 3 + 2] = rand(-16, 16);
      }
      const col = new THREE.Color(pick(palette));
      cols.set([col.r, col.g, col.b], i * 3);
      this.pVel[i] = rand(0.6, 1.4);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const glow = kind === 'embers' || kind === 'fireflies' || kind === 'neon';
    const mat = new THREE.PointsMaterial({
      color: kind === 'embers' ? 0xff8a3a : kind === 'fireflies' ? 0xd8ff6a : 0xffffff,
      vertexColors: kind === 'confetti' || kind === 'neon',
      size: kind === 'stars' ? 0.35 : kind === 'snow' ? 0.14 : kind === 'fireflies' ? 0.16 : kind === 'confetti' ? 0.16 : 0.1,
      sizeAttenuation: true,
      transparent: true,
      opacity: kind === 'stars' ? 0.9 : 0.85,
      depthWrite: false,
      blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
      fog: kind !== 'stars',
    });
    this.particles = new THREE.Points(geo, mat);
    this.group.add(this.particles);
  }

  /** A themed puck model of the given radius, sitting on the floor at y = 0. */
  makePuck(radius: number): THREE.Object3D {
    const g = new THREE.Group();
    switch (this.def.id) {
      case 'beach': {
        // striped beach ball
        const tex = paint(128, 64, (c) => {
          ['#ff4a3d', '#ffffff', '#2f7cff', '#ffffff', '#ffd23e', '#ffffff'].forEach((col, i) => {
            c.fillStyle = col;
            c.fillRect((i * 128) / 6, 0, 128 / 6 + 1, 64);
          });
        });
        const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), new THREE.MeshPhongMaterial({ map: tex, shininess: 60 }));
        ball.position.y = radius;
        g.add(ball);
        break;
      }
      case 'lava': {
        // a lump of dark basalt (no molten core)
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 1), new THREE.MeshLambertMaterial({ color: 0x2b211e, flatShading: true }));
        rock.position.y = radius;
        g.add(rock);
        break;
      }
      case 'space': {
        // weld the corners first so neighbouring faces move together (no cracks or stray spikes),
        // then dent the rock inward only, so it never pokes past its rolling radius
        const geo = mergeVertices(new THREE.IcosahedronGeometry(radius, 1).deleteAttribute('normal').deleteAttribute('uv'));
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const k = 0.8 + Math.random() * 0.2;
          p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
        }
        const rockGeo = geo.toNonIndexed();
        rockGeo.computeVertexNormals();
        const rock = new THREE.Mesh(rockGeo, new THREE.MeshLambertMaterial({ color: 0x8a8590, flatShading: true }));
        rock.position.y = radius;
        g.add(rock);
        break;
      }
      case 'snow': {
        const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 2), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
        ball.position.y = radius;
        g.add(ball);
        break;
      }
      case 'city': {
        // orange-and-white traffic barrel
        const orange = new THREE.MeshLambertMaterial({ color: 0xff6a1a });
        const white = new THREE.MeshLambertMaterial({ color: 0xf4f4f4 });
        for (let i = 0; i < 4; i++) {
          const band = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.92, radius, 0.26, 18), i % 2 ? white : orange);
          band.position.y = 0.13 + i * 0.26;
          g.add(band);
        }
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.85, radius * 0.9, 0.06, 18), orange);
        lid.position.y = 1.07;
        g.add(lid);
        break;
      }
      case 'forest': {
        // mossy boulder
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 1), new THREE.MeshLambertMaterial({ color: 0x6a7262, flatShading: true }));
        rock.position.y = radius * 0.8;
        const moss = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.9, 12, 8, 0, Math.PI * 2, 0, Math.PI / 3), new THREE.MeshLambertMaterial({ color: 0x4a8a3a }));
        moss.position.y = radius * 0.95;
        g.add(rock, moss);
        break;
      }
      case 'river': {
        // smooth river stone
        const stone = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 12), new THREE.MeshPhongMaterial({ color: 0x8a8a92, shininess: 40 }));
        stone.scale.set(1, 0.7, 1);
        stone.position.y = radius * 0.7;
        g.add(stone);
        break;
      }
      case 'cyber': {
        // hover drum with neon rings
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.7, 20), new THREE.MeshLambertMaterial({ color: 0x241a30 }));
        drum.position.y = 0.4;
        g.add(drum);
        for (const [y, c] of [
          [0.15, 0xff2bd6],
          [0.65, 0x2bf0ff],
        ] as [number, number][]) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.02, 0.05, 8, 24), new THREE.MeshBasicMaterial({ color: c }));
          ring.rotation.x = Math.PI / 2;
          ring.position.y = y;
          g.add(ring);
        }
        break;
      }
      case 'soccer': {
        // black-and-white football
        const tex = paint(128, 64, (c) => {
          c.fillStyle = '#ffffff';
          c.fillRect(0, 0, 128, 64);
          c.fillStyle = '#111111';
          for (let i = 0; i < 6; i++)
            for (let j = 0; j < 3; j++) {
              const x = i * 22 + (j % 2) * 11 + 6;
              const y = j * 22 + 6;
              c.beginPath();
              for (let k = 0; k < 5; k++) {
                const a = (k / 5) * Math.PI * 2;
                c.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
              }
              c.fill();
            }
        });
        const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), new THREE.MeshPhongMaterial({ map: tex, shininess: 30 }));
        ball.position.y = radius;
        g.add(ball);
        break;
      }
    }
    // round pucks roll about their own centre; the rest only turn, and sit flat on the floor
    const roll = ['beach', 'lava', 'space', 'snow', 'soccer'].includes(this.def.id);
    if (roll) {
      for (const c of g.children) c.position.y -= radius;
      g.userData.lift = radius;
    } else {
      const box = new THREE.Box3().setFromObject(g);
      // the cyber drum hovers on purpose
      if (this.def.id !== 'cyber') for (const c of g.children) c.position.y -= box.min.y;
      g.userData.lift = 0;
    }
    g.userData.roll = roll;
    return g;
  }

  /**
   * A cover wall in this stage's style, 1.4 wide x 0.36 deep (its collider). The first child
   * is the main block: it darkens as the wall takes hits and flashes on each one.
   */
  makeCover(): THREE.Group {
    const g = new THREE.Group();
    const lam = (color: number, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
    const glow = (color: number) => new THREE.MeshBasicMaterial({ color });
    const add = (m: THREE.Mesh, x = 0, y = 0, z = 0) => {
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    switch (this.def.id) {
      case 'beach': {
        // two driftwood logs lashed together
        const wood = lam(0xb4936a);
        for (const [y, r] of [
          [0.2, 0.2],
          [0.52, 0.17],
        ]) {
          const log = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 1.42, 12), y === 0.2 ? wood : lam(0xa58560)), 0, y, 0);
          log.rotation.z = Math.PI / 2;
        }
        for (const x of [-0.5, 0.5]) {
          const rope = add(new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.025, 6, 16), lam(0xd8c08a)), x, 0.36, 0);
          rope.rotation.y = Math.PI / 2;
          rope.scale.set(1, 1.7, 1);
        }
        break;
      }
      case 'lava': {
        // an obsidian slab split by dark seams
        add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.72, 0.36), lam(0x1d1517, { flatShading: true })), 0, 0.36, 0);
        for (const [x, rz] of [
          [-0.35, 0.5],
          [0.25, -0.35],
          [0.5, 0.6],
        ])
          add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.62, 0.372), lam(0x0c0809)), x, 0.36, 0).rotation.z = rz;
        add(new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.06, 0.38), lam(0x2c2224)), 0, 0.74, 0);
        break;
      }
      case 'snow': {
        // a block of blue ice with a snow cap
        add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.68, 0.36), new THREE.MeshPhongMaterial({ color: 0x7cc0e8, shininess: 90, specular: 0xffffff, emissive: 0x0c2a40 })), 0, 0.34, 0);
        const cap = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 1.2, 4, 10), lam(0xffffff)), 0, 0.7, 0);
        cap.rotation.z = Math.PI / 2;
        cap.scale.set(0.6, 1, 1.25);
        break;
      }
      case 'city': {
        // a concrete jersey barrier with a reflective red-and-white band
        add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.36), lam(0xb9b8b1)), 0, 0.15, 0);
        add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.44, 0.22), lam(0xc4c3bc)), 0, 0.52, 0);
        for (let k = 0; k < 6; k++) add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.225), lam(k % 2 ? 0xffffff : 0xe8332a)), -0.58 + k * 0.232, 0.6, 0);
        break;
      }
      case 'forest': {
        // a fallen mossy log
        const log = add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 1.42, 12), lam(0x5e4430)), 0, 0.31, 0);
        log.rotation.z = Math.PI / 2;
        for (const x of [-0.71, 0.71]) {
          const ring = add(new THREE.Mesh(new THREE.CircleGeometry(0.29, 12), lam(0xc49a64)), x, 0.31, 0);
          ring.rotation.y = (x > 0 ? 1 : -1) * (Math.PI / 2);
        }
        const moss = add(new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3), lam(0x4f8a3c)), -0.15, 0.36, 0);
        moss.scale.set(1.9, 0.7, 0.95);
        break;
      }
      case 'river': {
        // a stack of wooden crates
        for (const [x, w, h] of [
          [-0.36, 0.68, 0.7],
          [0.36, 0.68, 0.56],
        ]) {
          add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.36), lam(0x9a6a3c)), x, h / 2, 0);
          for (const y of [0.1, h - 0.1]) add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.01, 0.06, 0.37), lam(0x6a4426)), x, y, 0);
          const brace = add(new THREE.Mesh(new THREE.BoxGeometry(0.06, h * 1.15, 0.37), lam(0x6a4426)), x, h / 2, 0);
          brace.rotation.z = 0.75;
        }
        break;
      }
      case 'cyber': {
        // a dark block outlined in neon
        add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.36), lam(0x1b1428)), 0, 0.35, 0);
        for (const y of [0.04, 0.68]) add(new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.04, 0.38), glow(0xff2bd6)), 0, y, 0);
        for (const x of [-0.69, 0.69]) add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.68, 0.38), glow(0x2bf0ff)), x, 0.35, 0);
        break;
      }
      case 'soccer': {
        // a pitch-side advertising board
        const ad = paint(256, 64, (c) => {
          c.fillStyle = '#1f3f9a';
          c.fillRect(0, 0, 256, 64);
          c.fillStyle = '#ffffff';
          c.font = '900 34px "Arial Black", Impact, sans-serif';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText('MARBLE', 128, 34);
        });
        add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 0.12), [lam(0x15306f), lam(0x15306f), lam(0x15306f), lam(0x15306f), lam(0xffffff, { map: ad }), lam(0xffffff, { map: ad })]), 0, 0.42, 0);
        for (const x of [-0.6, 0.6]) {
          const leg = add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.36), lam(0x6a6f78)), x, 0.18, 0.05);
          leg.rotation.x = -0.35;
        }
        break;
      }
      default: {
        // space: a steel barrier with hazard stripes
        add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.75, 0.36), lam(0x8c96ac)), 0, 0.375, 0);
        add(new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.1, 0.38), lam(0x3a4152)), 0, 0.72, 0);
        for (const x of [-0.45, 0, 0.45]) add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.37), lam(0xffc23d)), x, 0.36, 0).rotation.z = 0.5;
      }
    }
    return g;
  }

  /** A pinball pin in this stage's style (radius 0.16): `cap` lights up when it's hit. */
  makePin(): { root: THREE.Group; cap: THREE.MeshBasicMaterial } {
    const root = new THREE.Group();
    const lam = (color: number) => new THREE.MeshLambertMaterial({ color });
    const post = (r0: number, r1: number, h: number, mat: THREE.Material, seg = 14) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, seg), mat);
      m.position.y = h / 2;
      root.add(m);
      return m;
    };
    const [capColor, capY, capR] = (() => {
      switch (this.def.id) {
        case 'beach':
          // a bamboo post
          post(0.14, 0.13, 0.55, lam(0xc8b46a), 10);
          for (const y of [0.18, 0.38]) root.add(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 6, 12), lam(0x9a8a4a)).translateY(y).rotateX(Math.PI / 2));
          return [0xffd23e, 0.56, 0.12] as const;
        case 'lava':
          // a basalt column
          post(0.18, 0.15, 0.55, new THREE.MeshLambertMaterial({ color: 0x241a1a, flatShading: true }), 6);
          return [0xff5a14, 0.56, 0.15] as const;
        case 'snow':
          // an ice pillar with a snow cap
          post(0.17, 0.13, 0.5, new THREE.MeshPhongMaterial({ color: 0xa8dcf4, shininess: 90, transparent: true, opacity: 0.9 }), 8);
          root.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), lam(0xffffff)).translateY(0.5));
          return [0x9ff2ff, 0.5, 0.15] as const;
        case 'city':
          // a yellow bollard with a black band
          post(0.15, 0.14, 0.55, lam(0xf2c21a));
          root.add(new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.152, 0.1, 14), lam(0x1a1a1a)).translateY(0.36));
          return [0xffffff, 0.56, 0.13] as const;
        case 'forest':
          // a tree stump
          post(0.2, 0.16, 0.42, lam(0x5e4430), 10);
          root.add(new THREE.Mesh(new THREE.CircleGeometry(0.155, 12).rotateX(-Math.PI / 2), lam(0xc49a64)).translateY(0.425));
          return [0x9cff6a, 0.43, 0.1] as const;
        case 'river':
          // a mooring post wrapped in rope
          post(0.16, 0.15, 0.6, lam(0x4a3220), 10);
          root.add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 14), lam(0xd8c08a)).translateY(0.42).rotateX(Math.PI / 2));
          return [0xffc23d, 0.61, 0.12] as const;
        case 'cyber':
          // a neon pylon
          post(0.17, 0.12, 0.55, lam(0x1b1428), 8);
          return [0xff2bd6, 0.56, 0.13] as const;
        case 'soccer':
          // a training pole on a weighted base
          root.add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.05, 14), lam(0x2a2a30)).translateY(0.025));
          post(0.05, 0.05, 0.7, lam(0xff6a1a), 10);
          return [0xffffff, 0.7, 0.06] as const;
        default:
          post(0.18, 0.16, 0.5, new THREE.MeshPhongMaterial({ color: 0xd8e0ee, shininess: 100 }));
          return [0x3ef0ff, 0.48, 0.17] as const;
      }
    })();
    const cap = new THREE.MeshBasicMaterial({ color: capColor });
    cap.userData.base = capColor;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(capR, 0.03, 8, 20), cap);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = capY;
    root.add(ring);
    return { root, cap };
  }

  /** stage particles are part of the realism setting */
  setParticles(on: boolean) {
    if (this.particles) this.particles.visible = on;
    if (this.rain) this.rain.visible = on;
  }

  update(dt: number, time: number) {
    const kind = this.def.particles;
    if (this.rain && this.pVel) {
      const p = this.rain.geometry.attributes.position as THREE.BufferAttribute;
      const a = p.array as Float32Array;
      for (let i = 0; i < this.pVel.length; i++) {
        const fall = this.pVel[i] * dt;
        a[i * 6 + 1] -= fall;
        a[i * 6 + 4] -= fall;
        if (a[i * 6 + 1] < 0) {
          const y = 16;
          a[i * 6 + 1] = y;
          a[i * 6 + 4] = y + 0.5;
        }
      }
      p.needsUpdate = true;
    }
    if (this.particles && this.pVel && kind !== 'stars') {
      const p = this.particles.geometry.attributes.position as THREE.BufferAttribute;
      const a = p.array as Float32Array;
      for (let i = 0; i < p.count; i++) {
        if (kind === 'snow' || kind === 'confetti') {
          a[i * 3 + 1] -= dt * (kind === 'confetti' ? 0.8 : 1.2) * this.pVel[i];
          a[i * 3] += Math.sin(time + i) * dt * (kind === 'confetti' ? 0.8 : 0.3);
          if (a[i * 3 + 1] < 0) a[i * 3 + 1] = 14;
        } else if (kind === 'fireflies') {
          a[i * 3] += Math.sin(time * 0.7 + i) * dt * 0.4;
          a[i * 3 + 1] += Math.cos(time * 0.9 + i * 1.7) * dt * 0.3;
          a[i * 3 + 2] += Math.sin(time * 0.5 + i * 0.3) * dt * 0.4;
        } else {
          a[i * 3 + 1] += dt * 1.6 * this.pVel[i];
          a[i * 3] += Math.sin(time * 2 + i) * dt * 0.4;
          if (a[i * 3 + 1] > 9) {
            a[i * 3 + 1] = 0;
            a[i * 3] = rand(-12, 12);
          }
        }
      }
      p.needsUpdate = true;
      // fireflies pulse together
      if (kind === 'fireflies') (this.particles.material as THREE.PointsMaterial).opacity = 0.5 + Math.sin(time * 2.2) * 0.35;
    }
    for (const mv of this.movers) mv(time, dt);
    // glowing parts pulse gently
    const pulse = 0.85 + Math.sin(time * 3) * 0.15;
    for (const m of this.glowMats) m.color.setScalar(1).multiply(new THREE.Color(this.def.railGlow ?? this.def.apron)).multiplyScalar(pulse);
    for (const w of this.water) {
      const m = w.material as THREE.MeshLambertMaterial;
      // the beach lagoon is painted; it only shimmers a little
      if (this.def.id === 'beach') m.emissive.setRGB(0.02, 0.1 + Math.sin(time * 1.5) * 0.02, 0.13);
      else m.emissive.setRGB(0.03, 0.2 + Math.sin(time * 1.5) * 0.03, 0.38);
    }
  }

  dispose() {
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (mat)
        (Array.isArray(mat) ? mat : [mat]).forEach((mm) => {
          (mm as THREE.MeshBasicMaterial).map?.dispose();
          mm.dispose();
        });
    });
  }
}

/** a box mesh at a position */
function box3(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

/** shared palm materials and the leaflet texture (built once) */
let palmKit: { trunk: THREE.Material; ring: THREE.Material; leaf: THREE.Material; nut: THREE.Material } | null = null;
function getPalmKit() {
  if (palmKit) return palmKit;
  const tex = paint(256, 64, (c) => {
    // a feathery frond: a midrib with leaflets raking toward the tip
    c.clearRect(0, 0, 256, 64);
    c.strokeStyle = '#3d6a26';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, 32);
    c.lineTo(256, 32);
    c.stroke();
    for (let x = 6; x < 250; x += 7) {
      const reach = 30 * Math.sin((x / 256) * Math.PI) + 4;
      for (const dir of [-1, 1]) {
        c.strokeStyle = Math.random() < 0.5 ? '#2f9a40' : '#3fae4a';
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(x, 32);
        c.lineTo(x + 14, 32 + dir * reach);
        c.stroke();
      }
    }
  });
  palmKit = {
    trunk: new THREE.MeshLambertMaterial({ color: 0x9a7048 }),
    ring: new THREE.MeshLambertMaterial({ color: 0x6e4c2e }),
    leaf: new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }),
    nut: new THREE.MeshLambertMaterial({ color: 0x6a4a22 }),
  };
  return palmKit;
}

/** a palm: curved, banded trunk that leans, drooping feathery fronds, coconuts */
function makePalm(h: number, lean: number) {
  const kit = getPalmKit();
  const g = new THREE.Group();
  const up = new THREE.Vector3(0, 1, 0);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 7; i++) {
    const t = i / 7;
    pts.push(new THREE.Vector3(lean * t * t * h * 0.32, t * h, 0));
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const r0 = 0.22 - (i / 7) * 0.1;
    const r1 = 0.22 - ((i + 1) / 7) * 0.1;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, a.distanceTo(b), 9), kit.trunk);
    seg.position.copy(a).add(b).multiplyScalar(0.5);
    seg.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
    g.add(seg);
    const band = new THREE.Mesh(new THREE.TorusGeometry(r1 + 0.01, 0.025, 5, 12), kit.ring);
    band.position.copy(b);
    band.quaternion.copy(seg.quaternion);
    band.rotateX(Math.PI / 2);
    g.add(band);
  }
  const top = pts[pts.length - 1];
  // fronds: long leaves that rise a little, then droop toward their tips
  const len = h * 0.55;
  for (let k = 0; k < 9; k++) {
    const geo = new THREE.PlaneGeometry(len, 0.75, 12, 1);
    geo.translate(len / 2, 0, 0);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / len;
      pos.setY(i, 0.35 * u - 1.1 * u * u * (h / 4.5));
    }
    geo.computeVertexNormals();
    const frond = new THREE.Mesh(geo, kit.leaf);
    frond.position.copy(top);
    frond.rotation.y = (k / 9) * Math.PI * 2 + rand(-0.15, 0.15);
    frond.rotateZ(rand(-0.15, 0.2));
    g.add(frond);
  }
  for (let k = 0; k < 3; k++) {
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), kit.nut);
    nut.position.set(top.x + Math.cos(k * 2.1) * 0.16, top.y - 0.15, Math.sin(k * 2.1) * 0.16);
    g.add(nut);
  }
  return g;
}

/** a thatched hut on stilts over the water */
function makeHut(wood: THREE.Material, darkWood: THREE.Material, straw: THREE.Material, plank: THREE.Material) {
  const g = new THREE.Group();
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ])
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.7, 6), darkWood).translateX(x * 1.05).translateY(0.6).translateZ(z * 1.05));
  g.add(box3(2.6, 0.14, 2.6, plank, 0, 1.45, 0));
  g.add(box3(1.9, 1.1, 1.9, wood, 0, 2.05, 0));
  g.add(box3(0.5, 0.75, 0.04, darkWood, 0, 1.9, 0.97));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.95, 1.3, 4), straw);
  roof.position.y = 3.2;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  const fringe = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.75, 0.22, 4, 1, true), straw);
  fringe.position.y = 2.62;
  fringe.rotation.y = Math.PI / 4;
  g.add(fringe);
  return g;
}

/** a puffy cloud: a cluster of soft white balls with a flat-ish base */
function makeCloud(k: number) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x5a6a7a, fog: false });
  for (const [x, y, r] of [
    [0, 0.3, 1.1],
    [-1.2, 0, 0.8],
    [1.3, 0.05, 0.85],
    [-0.5, 0.75, 0.8],
    [0.6, 0.7, 0.75],
    [2.1, -0.15, 0.55],
    [-2, -0.15, 0.55],
    [0, 1.25, 0.7],
    [-1.1, 0.9, 0.55],
    [1.4, 0.75, 0.6],
    [-2.8, -0.3, 0.4],
    [2.9, -0.3, 0.42],
    [0.3, -0.25, 1.0],
  ]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);
    b.position.set(x, y, 0);
    b.scale.set(1, 0.85, 0.7);
    g.add(b);
  }
  g.scale.setScalar(k);
  return g;
}
