import * as THREE from 'three';
import type { Shooter } from './game';

/**
 * SD (super-deformed) marble-shooter robots built from primitives:
 * a huge head, stubby body and big feet. Each character is pure data — a
 * palette plus a pick of crest, eyes, wings, shoulders, off-hand gear and
 * feet — so new robots need no new build code.
 * Part slots stay visible on every robot:
 *   barrel   -> chest cannon       core -> torso
 *   magazine -> clear tube on the back that empties as you fire
 * Footprint matches the physics collider (about 1.24 x 1.0).
 * These are placeholder designs inspired by existing mecha; replace them
 * with original designs before a public release.
 */

const MAG_BALLS = 5;

interface Palette {
  body: number;
  trim: number;
  accent: number;
  joint: number;
  wing: number;
  wingTip: number;
  eye: number;
}

export interface CharacterDef {
  id: string;
  name: string;
  palette: Palette;
  crest: 'vfin' | 'vfin-short' | 'horns' | 'unihorn' | 'fin';
  eyes: 'twin' | 'mono';
  wings: 'feather' | 'bat' | 'blades' | 'pods' | 'none';
  shoulders: 'round' | 'spike' | 'heavy';
  offhand: 'shield' | 'coil' | 'scythe' | 'gatling';
  feet: 'toe' | 'claw';
  /** dark face plate under a coloured helmet */
  darkFace?: boolean;
  /** glowing frame lines on the limbs and torso */
  glow?: number;
  /** how far the wings sweep upward (radians) */
  wingLift?: number;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'angel',
    name: 'Seraph Zero',
    palette: { body: 0xf4f4f8, trim: 0x2f63e8, accent: 0xe8312f, joint: 0x5a5f73, wing: 0xf8f8fc, wingTip: 0x2f63e8, eye: 0x6dff9a },
    crest: 'vfin',
    eyes: 'twin',
    wings: 'feather',
    shoulders: 'round',
    offhand: 'shield',
    feet: 'toe',
    wingLift: 0.2,
  },
  {
    id: 'dragon',
    name: 'Wyvern',
    palette: { body: 0x9c1b2e, trim: 0x3d3a4c, accent: 0xffc23d, joint: 0x26232f, wing: 0x5e1020, wingTip: 0x9c1b2e, eye: 0xc8ff3d },
    crest: 'horns',
    eyes: 'twin',
    wings: 'bat',
    shoulders: 'spike',
    offhand: 'coil',
    feet: 'claw',
    darkFace: true,
    wingLift: 0.5,
  },
  {
    id: 'pioneer',
    name: 'Pioneer',
    palette: { body: 0xf2f0ea, trim: 0x2950c8, accent: 0xd8262b, joint: 0x5d6070, wing: 0xf2f0ea, wingTip: 0x2950c8, eye: 0x7ff0ff },
    crest: 'vfin-short',
    eyes: 'twin',
    wings: 'none',
    shoulders: 'round',
    offhand: 'shield',
    feet: 'toe',
  },
  {
    id: 'liberty',
    name: 'Liberty',
    palette: { body: 0xf6f6fa, trim: 0x2b58d6, accent: 0xffc23d, joint: 0xd9a92a, wing: 0x2346b8, wingTip: 0xffd45e, eye: 0x6dff9a },
    crest: 'vfin',
    eyes: 'twin',
    wings: 'blades',
    shoulders: 'round',
    offhand: 'shield',
    feet: 'toe',
    wingLift: 0.25,
  },
  {
    id: 'monoceros',
    name: 'Monoceros',
    palette: { body: 0xf7f7f7, trim: 0xe9e9ef, accent: 0xff2d55, joint: 0x6a6d7c, wing: 0xf7f7f7, wingTip: 0xff2d55, eye: 0xffe14d },
    crest: 'unihorn',
    eyes: 'twin',
    wings: 'none',
    shoulders: 'heavy',
    offhand: 'shield',
    feet: 'toe',
    glow: 0xff2d55,
  },
  {
    id: 'baron',
    name: 'Crimson Baron',
    palette: { body: 0xd2202e, trim: 0x8e1220, accent: 0xffc23d, joint: 0x3a2a30, wing: 0x8e1220, wingTip: 0xd2202e, eye: 0xff5fd0 },
    crest: 'fin',
    eyes: 'mono',
    wings: 'pods',
    shoulders: 'heavy',
    offhand: 'shield',
    feet: 'claw',
    darkFace: true,
  },
  {
    id: 'bastion',
    name: 'Bastion',
    palette: { body: 0xeef0ea, trim: 0x3c8f4a, accent: 0xd8262b, joint: 0x4a4e5a, wing: 0x3c8f4a, wingTip: 0xeef0ea, eye: 0x7ff0ff },
    crest: 'vfin-short',
    eyes: 'twin',
    wings: 'pods',
    shoulders: 'heavy',
    offhand: 'gatling',
    feet: 'toe',
  },
  {
    id: 'nightshade',
    name: 'Nightshade',
    palette: { body: 0x23212c, trim: 0x4a4658, accent: 0x34e07a, joint: 0x15141b, wing: 0x1a1922, wingTip: 0x34e07a, eye: 0x34e07a },
    crest: 'vfin',
    eyes: 'twin',
    wings: 'bat',
    shoulders: 'round',
    offhand: 'scythe',
    feet: 'toe',
    darkFace: true,
    wingLift: 0.35,
  },
];

export const characterById = (id: string) => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];

export class ShooterMesh {
  root = new THREE.Group();
  /** everything above the hips; rotates with aim */
  turret = new THREE.Group();
  barrel = new THREE.Group();
  wings = new THREE.Group();
  trigger: THREE.Mesh;
  legs: THREE.Group[] = [];
  magBalls: THREE.Mesh[] = [];
  mats: THREE.MeshLambertMaterial[] = [];
  readonly id: string;
  private wingL = new THREE.Group();
  private wingR = new THREE.Group();
  private stride = 0;
  private def: CharacterDef;

  constructor(characterId: string, marbleColor: number) {
    const def = characterById(characterId);
    this.def = def;
    this.id = def.id;
    const pal = def.palette;
    const lam = (color: number, side: THREE.Side = THREE.FrontSide) => {
      const m = new THREE.MeshLambertMaterial({ color, side });
      this.mats.push(m);
      return m;
    };
    const body = lam(pal.body);
    const trim = lam(pal.trim);
    const accent = lam(pal.accent);
    const joint = lam(pal.joint);
    const gold = lam(0xffc23d);
    const wingMat = lam(pal.wing, THREE.DoubleSide);
    const wingTip = lam(pal.wingTip, THREE.DoubleSide);
    const eyeMat = new THREE.MeshBasicMaterial({ color: pal.eye });
    const glowMat = def.glow !== undefined ? new THREE.MeshBasicMaterial({ color: def.glow }) : null;
    const glass = new THREE.MeshPhongMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.35, shininess: 120, depthWrite: false });
    const ballMat = new THREE.MeshPhongMaterial({ color: marbleColor, shininess: 90, specular: 0xffffff });

    const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      return mesh;
    };
    const cyl = (rt: number, rb: number, h: number, m: THREE.Material, seg = 14) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
    const cone = (r: number, h: number, m: THREE.Material) => new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), m);

    // --- legs: short shins on big feet ---
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.27, 0.48, 0);
      leg.add(box(0.26, 0.22, 0.26, joint, 0, -0.08, 0)); // thigh joint
      leg.add(box(0.32, 0.22, 0.34, body, 0, -0.24, 0)); // shin
      leg.add(box(0.3, 0.1, 0.1, trim, 0, -0.18, -0.18)); // knee guard
      leg.add(box(0.42, 0.18, 0.66, body, 0, -0.39, -0.06)); // foot
      if (glowMat) leg.add(box(0.04, 0.2, 0.02, glowMat, 0, -0.26, -0.18));
      if (def.feet === 'claw') {
        for (const cx of [-0.12, 0, 0.12]) {
          const claw = cone(0.05, 0.16, joint);
          claw.rotation.x = -Math.PI / 2;
          claw.position.set(cx, -0.42, -0.46);
          leg.add(claw);
        }
      } else {
        leg.add(box(0.42, 0.1, 0.12, accent, 0, -0.42, -0.4)); // toe cap
      }
      this.root.add(leg);
      this.legs.push(leg);
    }
    this.root.add(box(0.62, 0.16, 0.44, def.darkFace ? joint : accent, 0, 0.56, 0)); // waist
    this.root.add(box(0.22, 0.18, 0.08, gold, 0, 0.54, -0.24)); // belt buckle

    // --- upper body ---
    this.turret.position.y = 0.62;
    this.root.add(this.turret);

    // torso (core slot)
    this.turret.add(box(0.8, 0.5, 0.6, body, 0, 0.25, 0));
    this.turret.add(box(0.7, 0.26, 0.1, trim, 0, 0.33, -0.3)); // chest block
    for (const side of [-1, 1]) this.turret.add(box(0.18, 0.08, 0.04, def.darkFace ? accent : gold, side * 0.2, 0.38, -0.36)); // vents
    if (glowMat) {
      this.turret.add(box(0.04, 0.4, 0.02, glowMat, 0, 0.25, -0.36));
      for (const side of [-1, 1]) this.turret.add(box(0.02, 0.36, 0.5, glowMat, side * 0.41, 0.25, 0));
    }
    const coreBall = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), ballMat);
    coreBall.position.set(0, 0.45, -0.32);
    this.turret.add(coreBall);

    // chest cannon (barrel slot) — recoils when firing
    this.barrel.position.set(0, 0.16, -0.32);
    const tube = cyl(0.14, 0.17, 0.34, joint);
    tube.rotation.x = Math.PI / 2;
    tube.position.z = -0.1;
    const ring = cyl(0.19, 0.19, 0.07, gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.z = -0.27;
    const bore = cyl(0.1, 0.1, 0.02, new THREE.MeshBasicMaterial({ color: 0x08060f }));
    bore.rotation.x = Math.PI / 2;
    bore.position.z = -0.31;
    this.barrel.add(tube, ring, bore);
    this.turret.add(this.barrel);

    // shoulders + stubby arms
    for (const side of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(side * 0.55, 0.38, 0);
      if (def.shoulders === 'spike') {
        sh.add(box(0.32, 0.26, 0.36, body));
        for (const sz of [-0.1, 0.1]) {
          const spike = cone(0.06, 0.3, joint);
          spike.rotation.z = -side * 1.2;
          spike.position.set(side * 0.2, 0.12, sz);
          sh.add(spike);
        }
      } else if (def.shoulders === 'heavy') {
        sh.position.x = side * 0.6;
        sh.add(box(0.44, 0.36, 0.5, body));
        sh.add(box(0.46, 0.08, 0.52, trim, 0, 0.2, 0));
        sh.add(box(0.06, 0.24, 0.4, accent, side * 0.24, -0.02, 0));
        if (glowMat) sh.add(box(0.02, 0.26, 0.04, glowMat, side * 0.23, 0, -0.22));
      } else {
        sh.add(box(0.34, 0.3, 0.4, body));
        sh.add(box(0.36, 0.08, 0.42, trim, 0, 0.17, 0));
        sh.add(box(0.06, 0.18, 0.3, accent, side * 0.18, 0, 0));
      }
      const arm = box(0.2, 0.26, 0.22, def.darkFace ? trim : body, 0, -0.26, -0.06);
      arm.rotation.x = -0.5;
      const fist = box(0.22, 0.2, 0.22, joint, -side * 0.08, -0.4, -0.24);
      sh.add(arm, fist);
      if (side === -1) this.buildOffhand(sh, def, { body, trim, accent, joint, gold, glowMat, eyeMat });
      if (side === 1 && def.offhand === 'gatling') this.buildOffhand(sh, def, { body, trim, accent, joint, gold, glowMat, eyeMat });
      this.turret.add(sh);
    }

    // big SD head
    const head = new THREE.Group();
    head.position.set(0, 0.86, -0.02);
    head.add(box(0.74, 0.58, 0.66, body)); // helmet
    head.add(box(0.5, 0.3, 0.06, def.darkFace ? joint : body, 0, -0.08, -0.34)); // faceplate
    head.add(box(0.14, 0.1, 0.06, def.darkFace ? joint : accent, 0, -0.22, -0.36)); // chin
    if (def.eyes === 'mono') {
      // a visor slot with a single glowing eye
      head.add(box(0.56, 0.12, 0.03, new THREE.MeshBasicMaterial({ color: 0x0b0710 }), 0, 0.03, -0.375));
      head.add(box(0.12, 0.1, 0.02, eyeMat, 0.06, 0.03, -0.39));
    } else {
      for (const side of [-1, 1]) {
        const eye = box(0.15, 0.06, 0.02, eyeMat, side * 0.12, 0.02, -0.38);
        eye.rotation.z = side * (def.darkFace ? 0.35 : 0.18);
        head.add(eye);
      }
    }
    for (const side of [-1, 1]) head.add(box(0.1, 0.24, 0.3, trim, side * 0.4, -0.02, 0)); // ear blocks
    head.add(box(0.12, 0.1, 0.06, def.eyes === 'mono' ? gold : accent, 0, 0.2, -0.35)); // forehead sensor
    this.buildCrest(head, def, { body, trim, accent, joint, gold, glowMat });
    this.turret.add(head);

    // --- wings / backpack ---
    this.wings.position.set(0, 0.42, 0.34);
    this.turret.add(this.wings);
    this.wingR.position.x = 0.12;
    this.wingL.position.x = -0.12;
    this.wingL.scale.x = -1; // mirror
    this.wings.add(this.wingL, this.wingR);
    for (const w of [this.wingL, this.wingR]) {
      if (def.wings === 'bat') this.buildBatWing(w, wingMat, wingTip, joint);
      else if (def.wings === 'feather') this.buildFeatherWing(w, wingMat, wingTip, joint);
      else if (def.wings === 'blades') this.buildBladeWing(w, wingMat, wingTip, joint);
      else if (def.wings === 'pods') this.buildPods(w, wingMat, wingTip, joint);
    }

    // magazine slot: clear tube on the back
    const mag = new THREE.Group();
    mag.position.set(0, 0.42, 0.42);
    const tubeGlass = cyl(0.13, 0.13, 0.7, glass);
    const cap = cyl(0.15, 0.15, 0.06, gold);
    cap.position.y = 0.37;
    mag.add(tubeGlass, cap);
    for (let i = 0; i < MAG_BALLS; i++) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), ballMat);
      ball.position.y = -0.26 + i * 0.13;
      mag.add(ball);
      this.magBalls.push(ball);
    }
    this.turret.add(mag);

    // trigger under the tube, pushed in on every shot
    this.trigger = box(0.26, 0.16, 0.16, gold, 0, 0.06, 0.38);
    this.turret.add(this.trigger);
  }

  private buildCrest(
    head: THREE.Group,
    def: CharacterDef,
    m: { body: THREE.Material; trim: THREE.Material; accent: THREE.Material; joint: THREE.Material; gold: THREE.Material; glowMat: THREE.Material | null },
  ) {
    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      return mesh;
    };
    const cone = (r: number, h: number, mat: THREE.Material) => new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mat);
    switch (def.crest) {
      case 'vfin':
      case 'vfin-short': {
        const short = def.crest === 'vfin-short';
        for (const side of [-1, 1]) {
          const fin = box(0.07, short ? 0.36 : 0.62, 0.04, m.gold, side * (short ? 0.13 : 0.2), short ? 0.32 : 0.42, -0.36);
          fin.rotation.z = -side * (short ? 0.75 : 0.95);
          head.add(fin);
        }
        head.add(box(0.1, 0.16, 0.05, m.accent, 0, 0.3, -0.36));
        head.add(box(0.5, 0.08, 0.62, m.trim, 0, 0.32, 0)); // crest band
        break;
      }
      case 'horns': {
        for (const side of [-1, 1]) {
          const horn = cone(0.06, 0.62, m.joint);
          horn.position.set(side * 0.2, 0.42, 0.12);
          horn.rotation.set(-0.9, 0, -side * 0.35);
          head.add(horn);
          const sideHorn = cone(0.05, 0.36, m.joint);
          sideHorn.position.set(side * 0.48, 0.12, 0.06);
          sideHorn.rotation.set(-0.5, 0, -side * 1.1);
          head.add(sideHorn);
        }
        const blade = cone(0.06, 0.42, m.gold);
        blade.position.set(0, 0.48, -0.26);
        blade.rotation.x = -0.25;
        head.add(blade);
        break;
      }
      case 'unihorn': {
        const horn = cone(0.07, 0.8, m.gold);
        horn.position.set(0, 0.62, -0.28);
        horn.rotation.x = -0.18;
        head.add(horn);
        if (m.glowMat) head.add(box(0.03, 0.4, 0.02, m.glowMat, 0, 0.12, -0.345));
        break;
      }
      case 'fin': {
        // a single swept fin on top, and a crest ridge
        const fin = box(0.06, 0.42, 0.34, m.gold, 0, 0.42, 0.1);
        fin.rotation.x = 0.55;
        head.add(fin);
        head.add(box(0.14, 0.1, 0.66, m.trim, 0, 0.32, 0));
        break;
      }
    }
  }

  private buildOffhand(
    sh: THREE.Group,
    def: CharacterDef,
    m: { body: THREE.Material; trim: THREE.Material; accent: THREE.Material; joint: THREE.Material; gold: THREE.Material; glowMat: THREE.Material | null; eyeMat: THREE.Material },
  ) {
    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      return mesh;
    };
    switch (def.offhand) {
      case 'shield': {
        const shield = box(0.06, 0.46, 0.3, def.id === 'pioneer' || def.id === 'baron' ? m.accent : m.trim, -0.16, -0.3, -0.06);
        shield.add(box(0.02, 0.2, 0.12, def.id === 'pioneer' ? m.gold : m.accent, -0.04, 0.04, 0));
        if (m.glowMat) shield.add(box(0.02, 0.36, 0.03, m.glowMat, -0.04, 0, 0));
        sh.add(shield);
        break;
      }
      case 'coil': {
        const coil = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 6, 14), m.gold);
        coil.rotation.y = Math.PI / 2;
        coil.position.set(-0.16, -0.32, -0.02);
        sh.add(coil);
        break;
      }
      case 'scythe': {
        // long pole held upright with a curved glowing blade at the top
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8), m.joint);
        pole.position.set(-0.12, 0.1, -0.3);
        sh.add(pole);
        const blade = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 6, 16, Math.PI * 0.75), m.eyeMat);
        blade.position.set(-0.12, 0.8, -0.3);
        blade.rotation.set(0, Math.PI / 2, Math.PI * 0.15);
        sh.add(blade);
        break;
      }
      case 'gatling': {
        const gun = new THREE.Group();
        gun.position.set(0, -0.4, -0.34);
        for (let i = 0; i < 4; i++) {
          const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), m.joint);
          b.rotation.x = Math.PI / 2;
          const a = (i / 4) * Math.PI * 2;
          b.position.set(Math.cos(a) * 0.06, Math.sin(a) * 0.06, -0.15);
          gun.add(b);
        }
        sh.add(gun);
        break;
      }
    }
  }

  /** Three long tapered feathers fanning up and out, tipped. */
  private buildFeatherWing(g: THREE.Group, mat: THREE.Material, tipMat: THREE.Material, joint: THREE.Material) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.15, 0.04);
    shape.lineTo(0.13, 0.92);
    shape.lineTo(0.05, 1.04);
    shape.lineTo(-0.02, 0.88);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
    const tipGeo = new THREE.BoxGeometry(0.12, 0.2, 0.05);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.12), joint)); // wing root
    [-0.15, -0.5, -0.88].forEach((rz, i) => {
      const f = new THREE.Group();
      f.position.set(0.14, 0.02, 0.02 + i * 0.03);
      f.rotation.set(0.25, 0, rz);
      const scale = 1.25 - i * 0.18;
      const feather = new THREE.Mesh(geo, mat);
      feather.scale.setScalar(scale);
      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.position.set(0.07 * scale, 0.86 * scale, 0.02);
      tip.scale.setScalar(scale);
      f.add(feather, tip);
      g.add(f);
    });
  }

  /** Four slim blades in a gold frame, fanned like a dragoon rack. */
  private buildBladeWing(g: THREE.Group, mat: THREE.Material, tipMat: THREE.Material, joint: THREE.Material) {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.12), joint));
    const blade = new THREE.BoxGeometry(0.1, 0.95, 0.04);
    const edge = new THREE.BoxGeometry(0.03, 0.95, 0.05);
    [-0.1, -0.42, -0.74, -1.06].forEach((rz, i) => {
      const f = new THREE.Group();
      f.position.set(0.12, 0.02, 0.02 + i * 0.025);
      f.rotation.set(0.2, 0, rz);
      const b = new THREE.Mesh(blade, mat);
      b.position.y = 0.48;
      const e = new THREE.Mesh(edge, tipMat);
      e.position.set(0.06, 0.48, 0);
      f.add(b, e);
      g.add(f);
    });
  }

  /** A chunky thruster pod per side (no wings). */
  private buildPods(g: THREE.Group, mat: THREE.Material, tipMat: THREE.Material, joint: THREE.Material) {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), mat);
    pod.position.set(0.22, 0.18, 0.06);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.32), tipMat);
    cap.position.set(0.22, 0.46, 0.06);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.14, 10), joint);
    nozzle.position.set(0.22, -0.14, 0.06);
    g.add(pod, cap, nozzle);
  }

  /** A scalloped bat wing on a dark spar, with tip spikes. */
  private buildBatWing(g: THREE.Group, mat: THREE.Material, tipMat: THREE.Material, joint: THREE.Material) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.85, 0.8);
    shape.lineTo(1.15, 0.62);
    shape.quadraticCurveTo(0.95, 0.42, 1.0, 0.18);
    shape.quadraticCurveTo(0.78, 0.3, 0.68, 0.0);
    shape.quadraticCurveTo(0.5, 0.18, 0.4, -0.12);
    shape.quadraticCurveTo(0.24, 0.06, 0.04, -0.06);
    shape.closePath();
    const membrane = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: false }), mat);
    membrane.position.set(0.08, 0.02, 0);
    membrane.rotation.x = 0.3;
    g.add(membrane);
    const spar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.08), joint);
    spar.position.set(0.52, 0.42, 0.09);
    spar.rotation.set(0.3, 0, 0.75);
    g.add(spar);
    for (const [x, y] of [
      [1.2, 0.66],
      [1.02, 0.14],
      [0.68, -0.04],
    ]) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 5), tipMat);
      spike.position.set(x + 0.08, y, 0.02);
      spike.rotation.z = -0.6;
      g.add(spike);
    }
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.12), joint)); // wing root
  }

  /** true once the robot has been blown apart */
  broken = false;

  /**
   * Blow the robot apart: every mesh is detached into the scene, keeping its
   * world transform, and returned so the caller can fling it around.
   */
  shatter(scene: THREE.Scene): THREE.Mesh[] {
    this.broken = true;
    this.root.updateMatrixWorld(true);
    const pieces: THREE.Mesh[] = [];
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) pieces.push(o as THREE.Mesh);
    });
    for (const p of pieces) scene.attach(p);
    // scorch the paint
    for (const m of this.mats) {
      m.color.multiplyScalar(0.55);
      m.emissive.setRGB(0, 0, 0);
    }
    return pieces;
  }

  /** Free GPU memory when swapping characters. */
  dispose() {
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[];
        (Array.isArray(mat) ? mat : [mat]).forEach((mm) => mm.dispose());
      }
    });
  }

  sync(s: Shooter, time: number, dt: number) {
    this.root.position.set(s.x, 0, -s.y);
    // the turret faces -z for the player and +z for the opponent
    this.root.rotation.y = s.team === 0 ? 0 : Math.PI;
    this.turret.rotation.y = s.team === 0 ? -s.aim : s.aim;
    this.barrel.position.z = -0.32 + s.recoil * 0.12;
    this.trigger.position.z = 0.38 - s.recoil * 0.1;

    // walk cycle while sliding along the rail
    const moving = Math.min(1, Math.abs(s.vx) / 3);
    this.stride += dt * 14 * moving;
    this.legs[0].rotation.x = Math.sin(this.stride) * 0.5 * moving;
    this.legs[1].rotation.x = -Math.sin(this.stride) * 0.5 * moving;
    this.turret.rotation.z = (s.team === 0 ? -1 : 1) * Math.sign(s.vx) * moving * 0.06;
    const bob = Math.abs(Math.sin(this.stride)) * 0.05 * moving;

    // wings breathe at idle, flare open while firing
    const flare = s.firing ? 0.18 : 0;
    const beat = Math.sin(time * 2.4) * 0.05;
    const lift = this.def.wingLift ?? 0.2;
    this.wingR.rotation.set(0, -0.35 - flare, lift + beat + flare * 0.5);
    this.wingL.rotation.set(0, 0.35 + flare, -(lift + beat + flare * 0.5));

    // magazine tube shows what's left
    const filled = s.reload > 0 ? 0 : Math.ceil((s.ammo / s.stats.capacity) * MAG_BALLS);
    this.magBalls.forEach((b, i) => (b.visible = i < filled));

    // hit flash; the player's own robot flashes softer so it never washes out
    const f = s.flash > 0 ? (s.team === 0 ? 0.45 : 0.9) : 0;
    for (const m of this.mats) m.emissive.setRGB(f, f, f);
    const hurt = s.health < 25 ? Math.abs(Math.sin(time * 9)) * 0.04 : 0;
    this.root.position.y = bob + hurt;

    // shudder while flashing from a hit; a super hit also rocks it backwards
    const jolt = s.flash > 0 ? (s.stagger > 0 ? 0.16 : 0.07) : 0;
    if (jolt) {
      this.root.position.x += (Math.random() * 2 - 1) * jolt;
      this.root.position.z += (Math.random() * 2 - 1) * jolt;
    }
    const back = s.stagger > 0 ? Math.sin((s.stagger / 0.45) * Math.PI) * 0.35 : 0;
    // tip away from the attacker (player leans toward +z, opponent toward -z)
    this.root.rotation.x = s.team === 0 ? back : -back;
    this.root.rotation.y = (s.team === 0 ? 0 : Math.PI) + (jolt ? (Math.random() * 2 - 1) * jolt : 0);
  }
}
