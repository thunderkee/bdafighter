import * as THREE from 'three';
import { ShooterMesh, characterById, studioEnv } from './robot';
import { celify } from './cel';

// 3/4-view portraits of the units for the pickers: each fighter rendered once into a
// small picture, one at a time so opening the menu never stutters.

const W = 120;
const H = 136;
const cache = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;

function setup() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.environment = studioEnv(renderer);
  scene.environmentIntensity = 0.8;
  scene.add(new THREE.HemisphereLight(0xdfefff, 0x2a3350, 2.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(-3, 6, -5);
  scene.add(sun);
}

/** the bust crop: a square of the upper body and head */
const BUST = 128;

/** the unit seen from the front-left, a little above, framed to fit (or, for a bust, the top of it) */
function render(id: string, bust = false) {
  if (!renderer || !scene) setup();
  const w = bust ? BUST : W;
  const h = bust ? BUST : H;
  renderer!.setSize(w, h, false);
  const def = characterById(id);
  const mesh = new ShooterMesh(def.id, def.ball, def);
  scene!.add(mesh.root);
  mesh.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh.root);
  const tall = box.max.y - box.min.y;
  // (a bust keeps the top half: head to shoulders, with room for the tilt)
  if (bust) box.min.y = box.max.y - tall * 0.5;
  const c = box.getCenter(new THREE.Vector3());
  // the bust centres on the eyes (horns, blades and antennae don't pull the face off the frame)
  const eyes = bust ? eyeCentre(mesh.root, def.palette.eye) : null;
  if (eyes) c.set(eyes.x, eyes.y - tall * 0.12, eyes.z);
  // (the bust: a low hero angle from the front-right, looking up at the face, the frame tilted)
  const dir = bust ? new THREE.Vector3(0.62, -0.16, -1).normalize() : new THREE.Vector3(-0.75, 0.42, -1).normalize();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  cam.position.copy(c).addScaledVector(dir, 10);
  if (bust) cam.up.set(Math.sin(0.2), Math.cos(0.2), 0);
  cam.lookAt(c);
  // fit the projected bounds, with a little air
  cam.updateMatrixWorld();
  const inv = cam.matrixWorldInverse;
  let hw = 0;
  let hh = 0;
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const p = new THREE.Vector3(x, y, z).applyMatrix4(inv);
        hw = Math.max(hw, Math.abs(p.x));
        hh = Math.max(hh, Math.abs(p.y));
      }
  // (the bust is cropped tight: the arms may run off the sides)
  const half = eyes ? Math.max(0.75, tall * 0.4) : bust ? Math.max(hh, hw * 0.62) * 1.08 : Math.max(hw, hh * (W / H)) * 1.06;
  cam.left = -half;
  cam.right = half;
  cam.top = (half * h) / w;
  cam.bottom = (-half * h) / w;
  cam.updateProjectionMatrix();
  // (every portrait in the cel look, like the fighters everywhere else)
  celify(scene!, true);
  renderer!.render(scene!, cam);
  const url = renderer!.domElement.toDataURL('image/png');
  scene!.remove(mesh.root);
  mesh.dispose();
  return url;
}

/** where a unit's eyes are: the middle of its glowing parts in the eye colour */
function eyeCentre(root: THREE.Object3D, eye: number) {
  const sum = new THREE.Vector3();
  const p = new THREE.Vector3();
  let n = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    const mat = m.isMesh ? (m.material as THREE.MeshBasicMaterial) : null;
    if (!mat || Array.isArray(mat) || !mat.isMeshBasicMaterial || mat.color.getHex() !== eye) return;
    sum.add(m.getWorldPosition(p));
    n++;
  });
  return n ? sum.divideScalar(n) : null;
}

/** a unit's portrait, rendering it now if it isn't cached */
export function portrait(id: string, bust = false) {
  const key = bust ? 'bust:' + id : id;
  let url = cache.get(key);
  if (!url) {
    url = render(id, bust);
    cache.set(key, url);
  }
  return url;
}

/**
 * Swap each `[data-portrait]` placeholder under `root` for the unit's picture, one unit at a
 * time (a short timer rather than animation frames, so a background tab still gets there). One renderer, kept for the whole session.
 */
export function fillPortraits(root: ParentNode = document) {
  const queue = [...root.querySelectorAll<HTMLElement>('[data-portrait]')];
  const step = () => {
    const el = queue.shift();
    // (the renderer is kept for next time: phones allow only a few 3D canvases, and making a
    // fresh one for every batch can push out the match's own)
    if (!el) return;
    const id = el.dataset.portrait!;
    const bust = el.dataset.crop === 'bust';
    try {
      const img = bust ? new Image(BUST, BUST) : new Image(W, H);
      img.className = bust ? 'portrait bust' : 'portrait';
      img.alt = '';
      img.src = portrait(id, bust);
      el.replaceWith(img);
    } catch {
      // keep the colour swatch if WebGL isn't available
    }
    setTimeout(step, 24);
  };
  setTimeout(step, 24);
}
