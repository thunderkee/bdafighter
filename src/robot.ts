import * as THREE from 'three';
import type { Shooter } from './game';

/**
 * SD (super-deformed) marble-shooter robots built from primitives:
 * a huge head, stubby body and big feet. Two placeholder styles:
 *   'angel'  — white/blue, feathered wings, gold V-fin (player)
 *   'dragon' — crimson/gunmetal, bat wings, swept horns (opponent)
 * Part slots stay visible on both:
 *   barrel   -> chest cannon       core -> torso
 *   magazine -> clear tube on the back that empties as you fire
 * Footprint matches the physics collider (about 1.24 x 1.0).
 */
export type RobotStyle = 'angel' | 'dragon';

const MAG_BALLS = 5;

interface Palette {
  body: number;
  trim: number;
  accent: number;
  joint: number;
  wing: number;
  wingTip: number;
  eye: number;
  marble: number;
}

const PALETTES: Record<RobotStyle, Palette> = {
  angel: { body: 0xf4f4f8, trim: 0x2f63e8, accent: 0xe8312f, joint: 0x5a5f73, wing: 0xf8f8fc, wingTip: 0x2f63e8, eye: 0x6dff9a, marble: 0x7fb4ff },
  dragon: { body: 0x9c1b2e, trim: 0x3d3a4c, accent: 0xffc23d, joint: 0x26232f, wing: 0x5e1020, wingTip: 0x9c1b2e, eye: 0xc8ff3d, marble: 0xffa08a },
};

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
  private wingL = new THREE.Group();
  private wingR = new THREE.Group();
  private stride = 0;

  constructor(readonly style: RobotStyle) {
    const pal = PALETTES[style];
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
    const glass = new THREE.MeshPhongMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.35, shininess: 120, depthWrite: false });
    const ballMat = new THREE.MeshPhongMaterial({ color: pal.marble, shininess: 90, specular: 0xffffff });

    const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      return mesh;
    };
    const cyl = (rt: number, rb: number, h: number, m: THREE.Material, seg = 14) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
    const cone = (r: number, h: number, m: THREE.Material) => new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), m);
    const dragon = style === 'dragon';

    // --- legs: short shins on big feet ---
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.27, 0.48, 0);
      leg.add(box(0.26, 0.22, 0.26, joint, 0, -0.08, 0)); // thigh joint
      leg.add(box(0.32, 0.22, 0.34, body, 0, -0.24, 0)); // shin
      leg.add(box(0.3, 0.1, 0.1, trim, 0, -0.18, -0.18)); // knee guard
      leg.add(box(0.42, 0.18, 0.66, body, 0, -0.39, -0.06)); // foot
      if (dragon) {
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
    this.root.add(box(0.62, 0.16, 0.44, dragon ? joint : accent, 0, 0.56, 0)); // waist
    this.root.add(box(0.22, 0.18, 0.08, gold, 0, 0.54, -0.24)); // belt buckle

    // --- upper body ---
    this.turret.position.y = 0.62;
    this.root.add(this.turret);

    // torso (core slot)
    this.turret.add(box(0.8, 0.5, 0.6, body, 0, 0.25, 0));
    this.turret.add(box(0.7, 0.26, 0.1, trim, 0, 0.33, -0.3)); // chest block
    if (!dragon) {
      for (const side of [-1, 1]) this.turret.add(box(0.18, 0.08, 0.04, gold, side * 0.2, 0.38, -0.36)); // chest vents
    } else {
      this.turret.add(box(0.5, 0.06, 0.04, accent, 0, 0.44, -0.36));
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
      if (dragon) {
        sh.add(box(0.32, 0.26, 0.36, body));
        for (const sz of [-0.1, 0.1]) {
          const spike = cone(0.06, 0.3, joint);
          spike.rotation.z = -side * 1.2;
          spike.position.set(side * 0.2, 0.12, sz);
          sh.add(spike);
        }
      } else {
        sh.add(box(0.34, 0.3, 0.4, body));
        sh.add(box(0.36, 0.08, 0.42, trim, 0, 0.17, 0));
        sh.add(box(0.06, 0.18, 0.3, accent, side * 0.18, 0, 0));
      }
      const arm = box(0.2, 0.26, 0.22, dragon ? trim : body, 0, -0.26, -0.06);
      arm.rotation.x = -0.5;
      const fist = box(0.22, 0.2, 0.22, joint, -side * 0.08, -0.4, -0.24);
      sh.add(arm, fist);
      // off-hand gear: a small shield for angel, a coiled whip for dragon
      if (side === -1) {
        if (dragon) {
          const coil = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 6, 14), gold);
          coil.rotation.y = Math.PI / 2;
          coil.position.set(-0.16, -0.32, -0.02);
          sh.add(coil);
        } else {
          const shield = box(0.06, 0.42, 0.28, trim, -0.16, -0.3, -0.06);
          shield.add(box(0.02, 0.18, 0.12, accent, -0.04, 0.02, 0));
          sh.add(shield);
        }
      }
      this.turret.add(sh);
    }

    // big SD head
    const head = new THREE.Group();
    head.position.set(0, 0.86, -0.02);
    head.add(box(0.74, 0.58, 0.66, body)); // helmet
    head.add(box(0.5, 0.3, 0.06, dragon ? joint : body, 0, -0.08, -0.34)); // faceplate
    head.add(box(0.14, 0.1, 0.06, dragon ? joint : accent, 0, -0.22, -0.36)); // chin
    for (const side of [-1, 1]) {
      const eye = box(0.15, 0.06, 0.02, eyeMat, side * 0.12, 0.02, -0.38);
      eye.rotation.z = side * (dragon ? 0.35 : 0.18);
      head.add(eye);
      head.add(box(0.1, 0.24, 0.3, trim, side * 0.4, -0.02, 0)); // ear blocks
    }
    head.add(box(0.12, 0.1, 0.06, accent, 0, 0.2, -0.35)); // forehead sensor
    if (dragon) {
      // swept-back horns and a tall centre blade
      for (const side of [-1, 1]) {
        const horn = cone(0.06, 0.62, joint);
        horn.position.set(side * 0.2, 0.42, 0.12);
        horn.rotation.set(-0.9, 0, -side * 0.35);
        head.add(horn);
        const side_ = cone(0.05, 0.36, joint);
        side_.position.set(side * 0.48, 0.12, 0.06);
        side_.rotation.set(-0.5, 0, -side * 1.1);
        head.add(side_);
      }
      const blade = cone(0.06, 0.42, gold);
      blade.position.set(0, 0.48, -0.26);
      blade.rotation.x = -0.25;
      head.add(blade);
    } else {
      // long gold V-fin
      for (const side of [-1, 1]) {
        const fin = box(0.07, 0.62, 0.04, gold, side * 0.2, 0.42, -0.36);
        fin.rotation.z = -side * 0.95;
        head.add(fin);
      }
      head.add(box(0.1, 0.16, 0.05, accent, 0, 0.3, -0.36));
      head.add(box(0.5, 0.08, 0.62, trim, 0, 0.32, 0)); // helmet crest band
    }
    this.turret.add(head);

    // --- wings ---
    this.wings.position.set(0, 0.42, 0.34);
    this.turret.add(this.wings);
    this.wingR.position.x = 0.12;
    this.wingL.position.x = -0.12;
    this.wingL.scale.x = -1; // mirror
    this.wings.add(this.wingL, this.wingR);
    for (const w of [this.wingL, this.wingR]) {
      if (dragon) this.buildBatWing(w, wingMat, wingTip, joint);
      else this.buildFeatherWing(w, wingMat, wingTip, joint);
    }

    // magazine slot: clear tube on the back between the wings
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

  /** Three long tapered feathers fanning up and out, blue-tipped. */
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
    const lift = this.style === 'dragon' ? 0.5 : 0.2; // sweep the wings upward
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
  }
}
