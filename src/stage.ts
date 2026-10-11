import * as THREE from 'three';
import { ARENA } from './config';

// Themed stages. Each one is data (colours, lighting) plus a small scenery
// builder, an ambient particle style, and a matching puck model. Physics is
// identical on every stage; only the look changes.

export type StageId = 'beach' | 'lava' | 'space' | 'snow' | 'city';

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
  pattern: 'sand' | 'cracks' | 'grid' | 'ice' | 'asphalt';
  rail: number;
  railGlow?: number;
  apron: number;
  apronGlow?: boolean;
  particles: 'none' | 'snow' | 'embers' | 'stars';
}

export const STAGES: StageDef[] = [
  {
    id: 'space',
    name: 'Orbital Deck',
    swatch: [0x0b1226, 0x3ef0ff],
    sky: 0x03040c,
    fog: [0x03040c, 34, 70],
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
    name: 'Beach',
    swatch: [0xf0d9a4, 0x2a9fe0],
    sky: 0x8fd3ff,
    fog: [0xbfe6ff, 30, 62],
    hemi: [0xffffff, 0xd8c28c, 1.8],
    sun: [0xfff2d6, 2.2],
    floor: 0xe8d29c,
    floorLine: 0xffffff,
    pattern: 'sand',
    rail: 0x9b7a55,
    apron: 0x2a9fe0,
    particles: 'none',
  },
  {
    id: 'lava',
    name: 'Lava Forge',
    swatch: [0x2a1a17, 0xff5a1a],
    sky: 0x1a0605,
    fog: [0x2a0905, 26, 56],
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
    fog: [0xd8e7f4, 26, 58],
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
    fog: [0x0f1326, 30, 64],
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
];

export const stageById = (id: string) => STAGES.find((s) => s.id === id) ?? STAGES[0];

const css = (c: number) => '#' + c.toString(16).padStart(6, '0');
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Stage {
  group = new THREE.Group();
  def: StageDef;
  private particles: THREE.Points | null = null;
  private pVel: Float32Array | null = null;
  private glowMats: THREE.MeshBasicMaterial[] = [];
  private water: THREE.Mesh | null = null;

  constructor(id: string) {
    this.def = stageById(id);
    this.buildFloor();
    this.buildRails();
    this.buildScenery();
    this.buildParticles();
  }

  private buildFloor() {
    const d = this.def;
    const W = ARENA.width;
    const L = ARENA.length;
    const cvs = document.createElement('canvas');
    cvs.width = 256;
    cvs.height = 640;
    const c = cvs.getContext('2d')!;
    const px = (x: number) => ((x + W / 2) / W) * cvs.width;
    const py = (y: number) => ((L / 2 - y) / L) * cvs.height;
    c.fillStyle = css(d.floor);
    c.fillRect(0, 0, cvs.width, cvs.height);

    // stage-specific surface detail
    switch (d.pattern) {
      case 'sand':
        for (let i = 0; i < 900; i++) {
          c.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '160,120,60'},${rand(0.05, 0.16)})`;
          c.fillRect(rand(0, 256), rand(0, 640), 2, 2);
        }
        c.strokeStyle = 'rgba(160,120,60,0.18)';
        c.lineWidth = 2;
        for (let y = 20; y < 640; y += 26) {
          c.beginPath();
          for (let x = 0; x <= 256; x += 16) c.lineTo(x, y + Math.sin(x / 30 + y) * 4);
          c.stroke();
        }
        break;
      case 'cracks':
        c.strokeStyle = '#ff6a1a';
        c.shadowColor = '#ff8a2a';
        c.shadowBlur = 8;
        c.lineWidth = 2;
        for (let i = 0; i < 22; i++) {
          let x = rand(0, 256);
          let y = rand(0, 640);
          c.beginPath();
          c.moveTo(x, y);
          for (let k = 0; k < 6; k++) {
            x += rand(-30, 30);
            y += rand(-30, 30);
            c.lineTo(x, y);
          }
          c.stroke();
        }
        c.shadowBlur = 0;
        break;
      case 'grid':
        c.strokeStyle = 'rgba(62,240,255,0.12)';
        c.lineWidth = 1;
        for (let x = 0; x <= 256; x += 16) {
          c.beginPath();
          c.moveTo(x, 0);
          c.lineTo(x, 640);
          c.stroke();
        }
        for (let y = 0; y <= 640; y += 16) {
          c.beginPath();
          c.moveTo(0, y);
          c.lineTo(256, y);
          c.stroke();
        }
        break;
      case 'ice':
        c.strokeStyle = 'rgba(120,170,220,0.25)';
        c.lineWidth = 1.5;
        for (let i = 0; i < 40; i++) {
          const x = rand(0, 256);
          const y = rand(0, 640);
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + rand(-40, 40), y + rand(-40, 40));
          c.stroke();
        }
        break;
      case 'asphalt':
        for (let i = 0; i < 1400; i++) {
          c.fillStyle = `rgba(255,255,255,${rand(0.02, 0.07)})`;
          c.fillRect(rand(0, 256), rand(0, 640), 2, 2);
        }
        // side lane lines
        c.strokeStyle = 'rgba(255,255,255,0.5)';
        c.lineWidth = 3;
        for (const x of [12, 244]) {
          c.beginPath();
          c.moveTo(x, 0);
          c.lineTo(x, 640);
          c.stroke();
        }
        break;
    }

    // shared markings: centre line, rail boxes, puck fences, centre circle
    c.strokeStyle = css(d.floorLine);
    c.globalAlpha = 0.85;
    c.lineWidth = 3;
    c.setLineDash([10, 8]);
    c.beginPath();
    c.moveTo(0, py(0));
    c.lineTo(cvs.width, py(0));
    c.stroke();
    c.setLineDash([]);
    for (const side of [-1, 1]) {
      c.strokeRect(px(-ARENA.railHalfWidth - 0.7), py(side * ARENA.railY + 0.6), px(ARENA.railHalfWidth + 0.7) - px(-ARENA.railHalfWidth - 0.7), py(-0.6) - py(0.6));
      c.globalAlpha = 0.4;
      c.beginPath();
      c.moveTo(0, py(side * ARENA.bumpFenceY));
      c.lineTo(cvs.width, py(side * ARENA.bumpFenceY));
      c.stroke();
      c.globalAlpha = 0.85;
    }
    c.beginPath();
    c.arc(px(0), py(0), 34, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mat =
      d.pattern === 'cracks' || d.pattern === 'grid'
        ? new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 })
        : new THREE.MeshLambertMaterial({ map: tex });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), mat);
    floor.rotation.x = -Math.PI / 2;
    this.group.add(floor);

    // apron: water, lava, snow, void, or street around the table
    const apronMat = d.apronGlow
      ? new THREE.MeshBasicMaterial({ color: d.apron })
      : new THREE.MeshLambertMaterial({ color: d.apron, emissive: d.id === 'beach' ? 0x0a3a66 : 0x000000 });
    if (d.apronGlow) this.glowMats.push(apronMat as THREE.MeshBasicMaterial);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(W + 40, L + 40), apronMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.04;
    this.group.add(apron);
    if (d.id === 'beach') this.water = apron;
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
    }
  }

  private buildScenery() {
    const d = this.def;
    const g = this.group;
    const sides = (fn: (side: number, z: number) => void, step = 4) => {
      for (const side of [-1, 1]) for (let z = -16; z <= 16; z += step) fn(side, z + rand(-1, 1));
    };
    switch (d.id) {
      case 'beach': {
        const trunk = new THREE.MeshLambertMaterial({ color: 0x8a6440 });
        const leaf = new THREE.MeshLambertMaterial({ color: 0x2f9a4a, side: THREE.DoubleSide });
        sides((side, z) => {
          const palm = new THREE.Group();
          const h = rand(3, 4.5);
          const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, h, 6), trunk);
          t.position.y = h / 2;
          t.rotation.z = side * 0.12;
          palm.add(t);
          for (let i = 0; i < 6; i++) {
            const l = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2, 4), leaf);
            l.position.y = h;
            l.rotation.set(Math.PI / 2.4, (i / 6) * Math.PI * 2, 0);
            l.translateY(1);
            palm.add(l);
          }
          palm.position.set(side * rand(7, 10), 0, z);
          g.add(palm);
        }, 7);
        const sun = new THREE.Mesh(new THREE.SphereGeometry(3, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff1b0, fog: false }));
        sun.position.set(-14, 16, -40);
        g.add(sun);
        break;
      }
      case 'lava': {
        const rock = new THREE.MeshLambertMaterial({ color: 0x1d1514, flatShading: true });
        sides((side, z) => {
          const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.8, 2), 0), rock);
          r.position.set(side * rand(7, 12), rand(0, 0.6), z);
          r.rotation.set(rand(0, 3), rand(0, 3), 0);
          g.add(r);
        }, 5);
        break;
      }
      case 'space': {
        const planet = new THREE.Mesh(new THREE.SphereGeometry(9, 32, 20), new THREE.MeshLambertMaterial({ color: 0x5b4bd6, emissive: 0x1a1240 }));
        planet.position.set(18, -2, -46);
        g.add(planet);
        const ring = new THREE.Mesh(new THREE.RingGeometry(11, 15, 48), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
        ring.position.copy(planet.position);
        ring.rotation.set(1.2, 0.3, 0);
        g.add(ring);
        // deck pylons with cyan lights
        const pylon = new THREE.MeshLambertMaterial({ color: 0x2c3650 });
        const light = new THREE.MeshBasicMaterial({ color: 0x3ef0ff });
        this.glowMats.push(light);
        sides((side, z) => {
          const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 0.4), pylon);
          p.position.set(side * 6.2, 0.8, z);
          const l = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.42), light);
          l.position.set(side * 6.2, 1.5, z);
          g.add(p, l);
        }, 6);
        break;
      }
      case 'snow': {
        const pine = new THREE.MeshLambertMaterial({ color: 0x2f6b4f, flatShading: true });
        const snowCap = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
        sides((side, z) => {
          const tree = new THREE.Group();
          const h = rand(2.4, 4);
          for (let i = 0; i < 3; i++) {
            const tier = new THREE.Mesh(new THREE.ConeGeometry(1.2 - i * 0.3, h * 0.45, 7), i === 2 ? snowCap : pine);
            tier.position.y = h * 0.3 + i * h * 0.25;
            tree.add(tier);
          }
          tree.position.set(side * rand(7, 11), 0, z);
          g.add(tree);
        }, 5);
        break;
      }
      case 'city': {
        const wallMat = new THREE.MeshLambertMaterial({ color: 0x1b1f2e });
        // a lit-window texture shared by all buildings
        const cvs = document.createElement('canvas');
        cvs.width = 64;
        cvs.height = 128;
        const c = cvs.getContext('2d')!;
        c.fillStyle = '#10131f';
        c.fillRect(0, 0, 64, 128);
        for (let y = 6; y < 128; y += 10)
          for (let x = 4; x < 64; x += 10) {
            if (Math.random() < 0.55) continue;
            c.fillStyle = Math.random() < 0.7 ? '#ffd27a' : '#7fe6ff';
            c.fillRect(x, y, 5, 6);
          }
        const winTex = new THREE.CanvasTexture(cvs);
        winTex.colorSpace = THREE.SRGBColorSpace;
        const winMat = new THREE.MeshBasicMaterial({ map: winTex });
        sides((side, z) => {
          const h = rand(5, 14);
          const w = rand(2.5, 4);
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), [winMat, winMat, wallMat, wallMat, winMat, winMat]);
          b.position.set(side * rand(10, 14), h / 2, z);
          g.add(b);
        }, 5);
        // street lamps along the barriers
        const pole = new THREE.MeshLambertMaterial({ color: 0x5a5f6a });
        const bulb = new THREE.MeshBasicMaterial({ color: 0xfff0c0 });
        sides((side, z) => {
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3, 6), pole);
          p.position.set(side * 6.4, 1.5, z);
          const l = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), bulb);
          l.position.set(side * 6.4, 3.05, z);
          g.add(p, l);
        }, 8);
        break;
      }
    }
  }

  private buildParticles() {
    const kind = this.def.particles;
    if (kind === 'none') return;
    const n = kind === 'stars' ? 500 : 220;
    const pos = new Float32Array(n * 3);
    this.pVel = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (kind === 'stars') {
        // a shell of stars around and below the deck
        const th = rand(0, Math.PI * 2);
        const ph = rand(-0.3, 1.2);
        const r = rand(45, 70);
        pos[i * 3] = Math.cos(th) * Math.cos(ph) * r;
        pos[i * 3 + 1] = Math.sin(ph) * r;
        pos[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * r;
      } else {
        pos[i * 3] = rand(-12, 12);
        pos[i * 3 + 1] = rand(0, 14);
        pos[i * 3 + 2] = rand(-16, 16);
      }
      this.pVel[i] = rand(0.6, 1.4);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: kind === 'embers' ? 0xff8a3a : 0xffffff,
      size: kind === 'stars' ? 0.35 : kind === 'snow' ? 0.14 : 0.1,
      sizeAttenuation: true,
      transparent: true,
      opacity: kind === 'stars' ? 0.9 : 0.85,
      depthWrite: false,
      blending: kind === 'embers' ? THREE.AdditiveBlending : THREE.NormalBlending,
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
        const cvs = document.createElement('canvas');
        cvs.width = 128;
        cvs.height = 64;
        const c = cvs.getContext('2d')!;
        ['#ff4a3d', '#ffffff', '#2f7cff', '#ffffff', '#ffd23e', '#ffffff'].forEach((col, i) => {
          c.fillStyle = col;
          c.fillRect((i * 128) / 6, 0, 128 / 6 + 1, 64);
        });
        const tex = new THREE.CanvasTexture(cvs);
        tex.colorSpace = THREE.SRGBColorSpace;
        const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), new THREE.MeshPhongMaterial({ map: tex, shininess: 60 }));
        ball.position.y = radius;
        g.add(ball);
        break;
      }
      case 'lava': {
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(radius, 0),
          new THREE.MeshLambertMaterial({ color: 0x2a1a16, emissive: 0xff4a10, emissiveIntensity: 0.35, flatShading: true }),
        );
        rock.position.y = radius * 0.8;
        const core = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 0.55, 0), new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
        core.position.y = radius * 0.8;
        g.add(core, rock);
        break;
      }
      case 'space': {
        const geo = new THREE.IcosahedronGeometry(radius, 1);
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const k = 0.82 + Math.random() * 0.3;
          p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
        }
        geo.computeVertexNormals();
        const rock = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x8a8590, flatShading: true }));
        rock.position.y = radius * 0.85;
        g.add(rock);
        break;
      }
      case 'snow': {
        const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 2), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
        ball.position.y = radius * 0.9;
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
    }
    return g;
  }

  update(dt: number, time: number) {
    const kind = this.def.particles;
    if (this.particles && this.pVel && kind !== 'stars') {
      const p = this.particles.geometry.attributes.position as THREE.BufferAttribute;
      const a = p.array as Float32Array;
      for (let i = 0; i < p.count; i++) {
        if (kind === 'snow') {
          a[i * 3 + 1] -= dt * 1.2 * this.pVel[i];
          a[i * 3] += Math.sin(time + i) * dt * 0.3;
          if (a[i * 3 + 1] < 0) a[i * 3 + 1] = 14;
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
    }
    // glowing parts pulse gently
    const pulse = 0.85 + Math.sin(time * 3) * 0.15;
    for (const m of this.glowMats) m.color.setScalar(1).multiply(new THREE.Color(this.def.railGlow ?? this.def.apron)).multiplyScalar(pulse);
    if (this.water) {
      const m = this.water.material as THREE.MeshLambertMaterial;
      m.emissive.setRGB(0.03, 0.2 + Math.sin(time * 1.5) * 0.03, 0.38);
    }
  }

  dispose() {
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((mm) => {
        (mm as THREE.MeshBasicMaterial).map?.dispose();
        mm.dispose();
      });
    });
  }
}
