import './lab.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { BUILTINS, CHARACTERS, DEFAULT_SIZE, ShooterMesh, blockGeometry, characterById, reloadRoster, resolveColor, type CharacterDef } from './robot';
import { DEFAULT_TRAITS, loadRoster, saveRoster, traitMul, type Block, type ColorRef, type PaletteSlot, type Role, type RosterData, type Shape, type Traits, type UnitEntry } from './roster';
import { edgesOf, extrudeFaces, fromGeometry, meshGeometry, prism, triangulate } from './meshkit';
import { MATCH } from './config';
import { computeStats, STARTER_BUILD } from './parts';
import * as store from './storage';
import type { Shooter } from './game';

// Unit Lab: edit a unit's name, traits, colours and block design. Everything
// saves to the device roster, which the game reads when it loads.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const isBuiltin = (id: string) => BUILTINS.some((b) => b.id === id);
const r2 = (n: number) => Math.round(n * 1000) / 1000;
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;
const DEG = 180 / Math.PI;

// ---------- state ----------
const roster: RosterData = clone(loadRoster());
reloadRoster(roster);
let currentId = characterById(store.load().settings.character).id;
/** working design for the current unit; linked into the roster on the first edit */
let draft: Block = { shape: 'group', p: [0, 0, 0], r: [0, 0, 0], s: [1, 1, 1] };
/** the block the form shows (the last one picked) */
let selected: string | null = null;
/** every selected block, `selected` included */
let selection: string[] = [];
let undo: string[] = [];
let redo: string[] = [];

type EditMode = 'vertex' | 'edge' | 'face';
/** shape edit mode: picking and moving one mesh block's points, edges or faces */
let edit: { path: string; mode: EditMode; sel: number[] } | null = null;

const def = (): CharacterDef => characterById(currentId);
const entry = (): UnitEntry => (roster.units[currentId] ??= { id: currentId, base: def().base ?? currentId });

/** a fresh design for the current unit: its saved one, or its built-in model as blocks */
function loadDraft() {
  const d = def();
  if (d.blueprint) {
    draft = d.blueprint;
    return;
  }
  const mesh = new ShooterMesh(d.id, d.ball, { ...d, blueprint: undefined });
  draft = mesh.toBlueprint(d);
  mesh.dispose();
}

// ---------- save + undo ----------
let saveTimer = 0;
const status = $('status');
function scheduleSave() {
  status.textContent = 'Saving…';
  status.classList.add('dirty');
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flushSave, 300);
}
function flushSave() {
  clearTimeout(saveTimer);
  const ok = saveRoster(roster);
  status.textContent = ok ? 'Saved' : 'Storage full!';
  status.classList.toggle('dirty', !ok);
}

const snapshot = () => JSON.stringify({ unit: roster.units[currentId] ?? null, draft, selected, selection, edit });
let lastUndoKey = '';
let lastUndoAt = 0;
/** remember the state before a change; rapid edits to one field count as one step */
function pushUndo(key = '') {
  const now = performance.now();
  if (key && key === lastUndoKey && now - lastUndoAt < 900) {
    lastUndoAt = now;
    return;
  }
  undo.push(snapshot());
  if (undo.length > 120) undo.shift();
  redo = [];
  lastUndoKey = key;
  lastUndoAt = now;
  syncUndoButtons();
}
function restore(snap: string) {
  const s = JSON.parse(snap) as { unit: UnitEntry | null; draft: Block; selected: string | null; selection?: string[]; edit?: typeof edit };
  if (s.unit) roster.units[currentId] = s.unit;
  else delete roster.units[currentId];
  // keep the draft and the saved design the same object once linked
  draft = s.unit?.blueprint ?? s.draft;
  selected = s.selected;
  selection = s.selection ?? (s.selected ? [s.selected] : []);
  const e = s.edit ?? null;
  edit = e && getBlock(e.path)?.shape === 'mesh' ? e : null;
  lastUndoKey = '';
  syncEditBar();
  commit(true);
}
function stepHistory(from: string[], to: string[]) {
  const snap = from.pop();
  if (!snap) return;
  to.push(snapshot());
  restore(snap);
  syncUndoButtons();
}
/** undo / redo live in the top bar and on the canvas toolbar; both pairs stay in sync */
const undoBtns = ['undo', 'canvas-undo'].map((id) => $<HTMLButtonElement>(id));
const redoBtns = ['redo', 'canvas-redo'].map((id) => $<HTMLButtonElement>(id));
function syncUndoButtons() {
  undoBtns.forEach((b) => (b.disabled = !undo.length));
  redoBtns.forEach((b) => (b.disabled = !redo.length));
}
undoBtns.forEach((b) => b.addEventListener('click', () => stepHistory(undo, redo)));
redoBtns.forEach((b) => b.addEventListener('click', () => stepHistory(redo, undo)));

/** apply roster edits everywhere: preview, lists, and (optionally) the open form */
function commit(full = false) {
  reloadRoster(roster);
  scheduleSave();
  rebuildPreview();
  renderRoster();
  renderTree();
  if (full) {
    renderProfile();
    renderPalette();
    renderForm();
  }
}

/** the design changed: make sure the unit owns it, then refresh */
function designChanged(full = false) {
  entry().blueprint = draft;
  commit(full);
}

// ---------- block paths ('r', 'r/0', 'r/0/3') ----------
const getBlock = (path: string): Block | null => {
  let b: Block | undefined = draft;
  for (const i of path.split('/').slice(1).map(Number)) b = b?.children?.[i];
  return b ?? null;
};
const parentPath = (path: string) => path.slice(0, path.lastIndexOf('/'));
const indexIn = (path: string) => Number(path.slice(path.lastIndexOf('/') + 1));
/** the path a block lives at now (after a move) */
function pathOf(target: Block): string | null {
  const walk = (b: Block, path: string): string | null => {
    if (b === target) return path;
    for (let i = 0; i < (b.children?.length ?? 0); i++) {
      const hit = walk(b.children![i], `${path}/${i}`);
      if (hit) return hit;
    }
    return null;
  };
  return walk(draft, 'r');
}
/** selected blocks without the ones already inside another selected block */
const topLevel = (paths: string[]) => paths.filter((p) => p !== 'r' && !paths.some((q) => q !== p && (q === 'r' || p.startsWith(q + '/'))));
/** sort deepest / last first, so removing one never shifts the paths of the rest */
const removalOrder = (paths: string[]) =>
  [...paths].sort((a, b) => {
    const pa = a.split('/').map(Number);
    const pb = b.split('/').map(Number);
    for (let i = 1; i < Math.min(pa.length, pb.length); i++) if (pa[i] !== pb[i]) return pb[i] - pa[i];
    return pb.length - pa.length;
  });

// ---------- 3D preview ----------
const viewEl = $('view');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewEl.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xdfefff, 0x2a3350, 1.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.7);
sun.position.set(3, 6, -4);
scene.add(sun);
const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.75, 0);
controls.enableDamping = true;
controls.minDistance = 1.5;
controls.maxDistance = 12;
const pad = new THREE.Mesh(new THREE.CircleGeometry(1.7, 40), new THREE.MeshLambertMaterial({ color: 0x14254a }));
pad.rotation.x = -Math.PI / 2;
pad.position.y = -0.005;
scene.add(pad);
const grid = new THREE.GridHelper(3.4, 17, 0x3ef0ff, 0x1d3a66);
(grid.material as THREE.Material).opacity = 0.35;
(grid.material as THREE.Material).transparent = true;
scene.add(grid);
// a marker for the unit's front (it fires toward -z)
const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0.01, -1.2), 0.45, 0xffc23d, 0.16, 0.1);
scene.add(arrow);

const CAMS: Record<string, [number, number, number]> = {
  front: [0, 1.3, -4.4],
  side: [4.4, 1.3, 0],
  back: [0, 1.6, 4.4],
  angle: [2.9, 2.1, -3.5],
};
let camName = 'angle';
function setCam(name: string) {
  camName = name;
  // narrow viewports need the camera further back to fit the unit's width
  const fit = Math.max(1.2, 0.8 / Math.max(0.3, camera.aspect));
  const [x, y, z] = CAMS[name];
  camera.position.set(x * fit, 0.75 + (y - 0.75) * fit, z * fit);
  controls.target.set(0, 0.75, 0);
  controls.update();
}
document.querySelectorAll<HTMLElement>('[data-cam]').forEach((b) => b.addEventListener('click', () => setCam(b.dataset.cam!)));

let animate = false;
document.querySelectorAll<HTMLElement>('[data-gizmo]').forEach((b) => b.addEventListener('click', () => setGizmoMode(b.dataset.gizmo as GizmoMode)));
$('animate').addEventListener('click', () => {
  animate = !animate;
  $('animate').classList.toggle('on', animate);
});

let model: ShooterMesh | null = null;
let helpers: THREE.BoxHelper[] = [];
function rebuildPreview() {
  if (model) {
    scene.remove(model.root);
    model.dispose();
  }
  const d = def();
  model = new ShooterMesh(d.id, d.ball, { ...d, blueprint: draft });
  scene.add(model.root);
  updateHelper();
}
/** the preview object built from the block at `path` */
function objOf(path: string): THREE.Object3D | null {
  if (!model) return null;
  let hit: THREE.Object3D | null = null;
  model.root.traverse((o) => {
    if (!hit && o.userData.path === path) hit = o;
  });
  return hit;
}

// on-canvas gizmo: drag the arrows / rings / boxes to move, rotate or scale the selected block(s)
const gizmo = new TransformControls(camera, renderer.domElement);
// bigger handles for fingers
gizmo.setSize(window.matchMedia('(pointer: coarse)').matches ? 1.5 : 1.1);
gizmo.setSpace('local');
// no free 'trackball' sphere over the block: dragging the block itself rotates it predictably
gizmo.showXYZE = false;
// the rings turn fast, so snap to clean steps: 5 degrees, and scale in 0.05s
// (snap is applied before slowing the rings to 40%, so 12.5 here lands on 5-degree steps)
gizmo.setRotationSnap(THREE.MathUtils.degToRad(12.5));
gizmo.setScaleSnap(0.05);
scene.add(gizmo.getHelper());
/** with several blocks selected the gizmo drives this stand-in at their centre */
const pivot = new THREE.Object3D();
scene.add(pivot);
/** in edit mode the gizmo drives this stand-in at the picked points' centre (a child of the mesh) */
const editPivot = new THREE.Object3D();
type GizmoMode = 'translate' | 'rotate' | 'scale';
let gizmoUsed = false;
function setGizmoMode(mode: GizmoMode) {
  gizmo.setMode(mode);
  // the two-axis squares would catch drags on the block in scale mode and stretch it unevenly
  const planes = mode === 'translate';
  gizmo.showXY = gizmo.showYZ = gizmo.showXZ = planes;
  document.querySelectorAll<HTMLElement>('[data-gizmo]').forEach((b) => b.classList.toggle('on', b.dataset.gizmo === mode));
}
gizmo.addEventListener('dragging-changed', (e) => {
  const dragging = !!(e as unknown as { value: boolean }).value;
  controls.enabled = !dragging;
  if (dragging) {
    gizmoUsed = true;
    pushUndo();
  } else {
    // the drag is done: rebuild from the edited block(s) and refresh the form
    designChanged(true);
    updateHelper();
  }
});
/** copy a dragged object's transform into its block */
function writeBlockAt(path: string | null, o: THREE.Object3D | undefined) {
  const b = path ? getBlock(path) : null;
  if (!b || !o) return;
  b.p = [r2(o.position.x), r2(o.position.y), r2(o.position.z)];
  b.r = [r2(o.rotation.x), r2(o.rotation.y), r2(o.rotation.z)];
  b.s = [r2(o.scale.x), r2(o.scale.y), r2(o.scale.z)];
}

// moving several blocks: remember where each one and the pivot started, then carry them along
let multi: { pivotInv: THREE.Matrix4; items: { path: string; obj: THREE.Object3D; world: THREE.Matrix4 }[] } | null = null;
// moving points: remember the mesh's points and the edit pivot at the start
let editStart: { v: number[]; inv: THREE.Matrix4; verts: number[] } | null = null;
function beginDrag() {
  multi = null;
  editStart = null;
  const o = gizmo.object;
  if (o === pivot) {
    pivot.updateMatrixWorld();
    multi = {
      pivotInv: pivot.matrixWorld.clone().invert(),
      items: topLevel(selection)
        .map((path) => ({ path, obj: objOf(path) }))
        .filter((i): i is { path: string; obj: THREE.Object3D } => !!i.obj)
        .map((i) => ({ ...i, world: i.obj.matrixWorld.clone() })),
    };
  } else if (o === editPivot && edit) {
    const b = getBlock(edit.path);
    if (!b?.mesh) return;
    editPivot.updateMatrix();
    editStart = { v: [...b.mesh.v], inv: editPivot.matrix.clone().invert(), verts: editVerts() };
  }
}
/** write whatever the gizmo (or a free drag) just moved back into the design */
function applyDrag(o: THREE.Object3D) {
  if (o === pivot && multi) {
    pivot.updateMatrixWorld();
    const delta = pivot.matrixWorld.clone().multiply(multi.pivotInv);
    for (const it of multi.items) {
      const w = delta.clone().multiply(it.world);
      const local = it.obj.parent ? it.obj.parent.matrixWorld.clone().invert().multiply(w) : w;
      local.decompose(it.obj.position, it.obj.quaternion, it.obj.scale);
      writeBlockAt(it.path, it.obj);
    }
  } else if (o === editPivot && edit && editStart) {
    const b = getBlock(edit.path);
    if (!b?.mesh) return;
    editPivot.updateMatrix();
    const delta = editPivot.matrix.clone().multiply(editStart.inv);
    const p = new THREE.Vector3();
    for (const i of editStart.verts) {
      p.fromArray(editStart.v, i * 3).applyMatrix4(delta);
      b.mesh.v[i * 3] = r4(p.x);
      b.mesh.v[i * 3 + 1] = r4(p.y);
      b.mesh.v[i * 3 + 2] = r4(p.z);
    }
    // reshape the live mesh without rebuilding the whole unit
    const mesh = objOf(edit.path) as THREE.Mesh | null;
    if (mesh?.isMesh) {
      mesh.geometry.dispose();
      mesh.geometry = blockGeometry(b);
    }
    drawEditOverlay();
  } else writeBlockAt(selected, o);
}
// the stock rings turn very fast: keep 40% of each drag's turn, measured from where it started
const RING_SPEED = 0.4;
let ringStart: THREE.Quaternion | null = null;
gizmo.addEventListener('mouseDown', () => {
  ringStart = gizmo.getMode() === 'rotate' && gizmo.object ? gizmo.object.quaternion.clone() : null;
  beginDrag();
});
gizmo.addEventListener('mouseUp', () => (ringStart = null));
gizmo.addEventListener('objectChange', () => {
  const o = gizmo.object;
  if (!o) return;
  if (ringStart && gizmo.getMode() === 'rotate') {
    const delta = ringStart.clone().invert().multiply(o.quaternion);
    if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
    const angle = 2 * Math.acos(Math.min(1, delta.w));
    const sin = Math.sqrt(Math.max(0, 1 - delta.w * delta.w));
    if (angle > 1e-6 && sin > 1e-6) {
      const axis = new THREE.Vector3(delta.x / sin, delta.y / sin, delta.z / sin);
      o.quaternion.copy(ringStart).multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle * RING_SPEED));
    }
  }
  applyDrag(o);
});

function updateHelper() {
  for (const h of helpers) {
    scene.remove(h);
    h.dispose();
  }
  helpers = [];
  gizmo.detach();
  if (!model || draw) return;
  if (edit) {
    attachEdit();
    return;
  }
  const objs = selection.filter((p) => p !== 'r').map(objOf).filter((o): o is THREE.Object3D => !!o);
  for (const o of objs) {
    const h = new THREE.BoxHelper(o, 0xffd23e);
    scene.add(h);
    helpers.push(h);
  }
  if (objs.length === 1) gizmo.attach(objs[0]);
  else if (objs.length > 1) {
    const box = new THREE.Box3();
    objs.forEach((o) => box.expandByObject(o));
    pivot.position.copy(box.getCenter(new THREE.Vector3()));
    pivot.quaternion.identity();
    pivot.scale.set(1, 1, 1);
    pivot.updateMatrixWorld();
    gizmo.attach(pivot);
  }
}

// click (not drag) on a block selects it; dragging a selected block itself
// moves / rotates / scales the selection with the active tool (no need to hit a handle)
let downAt: { x: number; y: number } | null = null;
const ray = new THREE.Raycaster();
const ndcAt = (x: number, y: number) => {
  const rect = renderer.domElement.getBoundingClientRect();
  return new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
};
const pick = (x: number, y: number) => {
  if (!model) return null;
  ray.setFromCamera(ndcAt(x, y), camera);
  return ray.intersectObject(model.root, true).find((h) => (h.object as THREE.Mesh).isMesh && h.object.userData.path) ?? null;
};
let free: {
  id: number;
  x: number;
  y: number;
  obj: THREE.Object3D;
  p: THREE.Vector3;
  q: THREE.Quaternion;
  s: THREE.Vector3;
  world: THREE.Vector3;
  plane: THREE.Plane;
  grab: THREE.Vector3;
  moved: boolean;
} | null = null;
const isInside = (o: THREE.Object3D, root: THREE.Object3D) => {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) if (n === root) return true;
  return false;
};

renderer.domElement.addEventListener('pointerdown', (e) => {
  downAt = { x: e.clientX, y: e.clientY };
  gizmoUsed = false;
  if (edit || draw) return;
  const obj = gizmo.object;
  if (!obj || !selection.length) return;
  const hit = pick(e.clientX, e.clientY);
  if (!hit) return;
  const grabbed = selection.some((p) => {
    const o = p !== 'r' ? objOf(p) : null;
    return !!o && isInside(hit.object, o);
  });
  if (!grabbed) return;
  // grabbed a selected block: this drag edits the selection instead of orbiting
  controls.enabled = false;
  const world = obj.getWorldPosition(new THREE.Vector3());
  const normal = camera.getWorldDirection(new THREE.Vector3());
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, world);
  free = { id: e.pointerId, x: e.clientX, y: e.clientY, obj, p: obj.position.clone(), q: obj.quaternion.clone(), s: obj.scale.clone(), world, plane, grab: hit.point.clone(), moved: false };
  ray.ray.intersectPlane(plane, free.grab);
});

window.addEventListener('pointermove', (e) => {
  if (draw && e.target === renderer.domElement) drawHover(e.clientX, e.clientY);
  if (!free || e.pointerId !== free.id) return;
  // a handle took this press after all
  if (gizmo.dragging) {
    free = null;
    return;
  }
  const dx = e.clientX - free.x;
  const dy = e.clientY - free.y;
  if (!free.moved) {
    if (Math.hypot(dx, dy) < 4) return;
    free.moved = true;
    pushUndo();
    beginDrag();
  }
  const o = free.obj;
  const mode = gizmo.getMode();
  if (mode === 'translate') {
    // slide in the plane facing the camera
    ray.setFromCamera(ndcAt(e.clientX, e.clientY), camera);
    const at = new THREE.Vector3();
    if (!ray.ray.intersectPlane(free.plane, at)) return;
    const target = free.world.clone().add(at.sub(free.grab));
    o.position.copy(o.parent ? o.parent.worldToLocal(target) : target);
  } else if (mode === 'rotate') {
    // sideways turns it, up/down tilts it toward you
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const step = THREE.MathUtils.degToRad(5);
    const snap = (a: number) => Math.round(a / step) * step;
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), snap(dx * 0.012));
    const tilt = new THREE.Quaternion().setFromAxisAngle(right, snap(dy * 0.012));
    const worldRot = turn.multiply(tilt);
    const parentQ = o.parent ? o.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
    o.quaternion.copy(parentQ.clone().invert().multiply(worldRot).multiply(parentQ).multiply(free.q));
  } else {
    // drag up or right to grow, down or left to shrink
    const f = Math.max(0.05, Math.exp((dx - dy) * 0.006));
    o.scale.copy(free.s).multiplyScalar(f);
  }
  applyDrag(o);
});

const endFree = (e: PointerEvent) => {
  if (!free || e.pointerId !== free.id) return false;
  const moved = free.moved;
  free = null;
  controls.enabled = true;
  if (moved) {
    designChanged(true);
    updateHelper();
  }
  return moved;
};
window.addEventListener('pointercancel', (e) => endFree(e));

window.addEventListener('pointerup', (e) => {
  const dragged = endFree(e);
  // a press that worked the gizmo or dragged a block never changes the selection
  if (gizmoUsed || dragged) {
    downAt = null;
    return;
  }
  if (!downAt || !model || e.target !== renderer.domElement) {
    downAt = null;
    return;
  }
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 5) return;
  const additive = e.shiftKey || e.metaKey || e.ctrlKey;
  if (draw) {
    drawClick(e.clientX, e.clientY);
    return;
  }
  if (edit) {
    pickElement(e.clientX, e.clientY, additive);
    return;
  }
  const hit = pick(e.clientX, e.clientY);
  if (hit) showTab('blocks');
  if (!hit && additive) return;
  select(hit ? (hit.object.userData.path as string) : null, additive);
});
renderer.domElement.addEventListener('dblclick', () => {
  if (draw) finishDraw();
});

function resize() {
  const w = viewEl.clientWidth;
  const h = viewEl.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}
new ResizeObserver(() => {
  resize();
  if (!userMoved) setCam(camName);
}).observe(viewEl);
resize();
setCam('angle');
let userMoved = false;
controls.addEventListener('start', () => (userMoved = true));

const fake = { x: 0, y: 0, aim: 0, recoil: 0, vx: 0, flash: 0, stagger: 0, health: 100, firing: false, team: 0, kickT: 9, heavyT: 9 };
let t = 0;
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  t += dt;
  if (model) {
    // shape editing and drawing hold the unit still
    const still = !animate || !!edit || !!draw;
    if (!still) {
      fake.vx = Math.sin(t * 1.2) * 6;
      fake.aim = Math.sin(t * 0.7) * 0.5;
      fake.recoil = Math.max(0, Math.sin(t * 5)) ** 6;
      fake.firing = true;
      // preview the firing animation: a regular shot each pulse, a special move every 4 s
      fake.kickT = (t % (Math.PI * 2 / 5)) * 1;
      fake.heavyT = t % 4;
    } else {
      fake.vx = fake.aim = fake.recoil = 0;
      fake.firing = false;
      fake.kickT = fake.heavyT = 9;
    }
    // hold the pose still while a block is being dragged, so animation never fights the gizmo
    if (!gizmo.dragging && !free?.moved) model.sync(fake as unknown as Shooter, t, dt);
    model.root.position.set(0, edit || draw ? 0 : model.root.position.y, 0);
  }
  helpers.forEach((h) => h.update());
  controls.update();
  renderer.render(scene, camera);
});

// ---------- shape edit mode: points, edges, faces ----------
let editOverlay: THREE.Group | null = null;
let editCage: THREE.Mesh | null = null;
const OVERLAY = 0x3ef0ff;
const PICKED = 0xffb020;

const editBar = $('edit-tools');
function syncEditBar() {
  editBar.classList.toggle('hidden', !edit);
  document.querySelectorAll<HTMLElement>('[data-edit]').forEach((b) => b.classList.toggle('on', !!edit && b.dataset.edit === edit.mode));
  $<HTMLButtonElement>('extrude').disabled = !edit || edit.mode !== 'face' || !edit.sel.length;
  $<HTMLButtonElement>('edit-shape').classList.toggle('on', !!edit);
}

/** start editing the selected block's shape; primitives become editable meshes first */
function enterEdit() {
  if (draw) cancelDraw();
  if (selection.length !== 1 || !selected || selected === 'r') return;
  const b = getBlock(selected);
  if (!b || b.shape === 'group') return;
  if (b.shape !== 'mesh') {
    pushUndo();
    const geo = blockGeometry(b);
    b.mesh = fromGeometry(geo);
    geo.dispose();
    b.shape = 'mesh';
    b.size = { bevel: 0, smooth: 0 };
    designChanged();
  }
  edit = { path: selected, mode: edit?.mode ?? 'face', sel: [] };
  syncEditBar();
  renderForm();
  updateHelper();
}
function exitEdit() {
  if (!edit) return;
  edit = null;
  editOverlay?.removeFromParent();
  editPivot.removeFromParent();
  editOverlay = null;
  editCage = null;
  syncEditBar();
  renderForm();
  updateHelper();
}
function setEditMode(mode: EditMode) {
  if (!edit) return;
  edit.mode = mode;
  edit.sel = [];
  syncEditBar();
  updateHelper();
}
document.querySelectorAll<HTMLElement>('[data-edit]').forEach((b) => b.addEventListener('click', () => setEditMode(b.dataset.edit as EditMode)));
$('edit-done').addEventListener('click', exitEdit);
$('edit-shape').addEventListener('click', () => (edit ? exitEdit() : enterEdit()));
$('edit-all').addEventListener('click', selectAllElements);

/** the points the current pick covers */
function editVerts(): number[] {
  const b = edit ? getBlock(edit.path) : null;
  if (!edit || !b?.mesh) return [];
  const out = new Set<number>();
  if (edit.mode === 'vertex') edit.sel.forEach((i) => out.add(i));
  else if (edit.mode === 'edge') {
    const edges = edgesOf(b.mesh);
    edit.sel.forEach((i) => edges[i]?.forEach((v) => out.add(v)));
  } else edit.sel.forEach((i) => b.mesh!.f[i]?.forEach((v) => out.add(v)));
  return [...out].filter((i) => i * 3 < b.mesh!.v.length);
}

/** draw the points / edges / faces over the mesh, with the picked ones lit */
function drawEditOverlay() {
  if (!edit) return;
  const obj = objOf(edit.path);
  const b = getBlock(edit.path);
  if (!obj || !b?.mesh) return;
  editOverlay?.removeFromParent();
  const g = new THREE.Group();
  g.renderOrder = 10;
  const d = b.mesh;
  const edges = edgesOf(d);
  const onTop = { depthTest: false, transparent: true };
  const ptsGeo = new THREE.BufferGeometry();
  ptsGeo.setAttribute('position', new THREE.Float32BufferAttribute(d.v, 3));
  if (edit.mode === 'vertex') g.add(new THREE.Points(ptsGeo, new THREE.PointsMaterial({ color: OVERLAY, size: 7, sizeAttenuation: false, ...onTop })));
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(d.v, 3));
  lineGeo.setIndex(edges.flat());
  g.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: OVERLAY, opacity: 0.7, ...onTop })));
  // the picked elements
  if (edit.mode === 'vertex' && edit.sel.length) {
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(edit.sel.flatMap((i) => [d.v[i * 3], d.v[i * 3 + 1], d.v[i * 3 + 2]]), 3));
    g.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: PICKED, size: 11, sizeAttenuation: false, ...onTop })));
  } else if (edit.mode === 'edge' && edit.sel.length) {
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(d.v, 3));
    lg.setIndex(edit.sel.flatMap((i) => edges[i] ?? []));
    g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: PICKED, ...onTop })));
  } else if (edit.mode === 'face' && edit.sel.length) {
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(d.v, 3));
    fg.setIndex(edit.sel.flatMap((i) => (d.f[i] ? triangulate(d, d.f[i]).flat() : [])));
    g.add(new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: PICKED, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, ...onTop })));
  }
  // an invisible copy of the bare shape for picking faces
  editCage = new THREE.Mesh(meshGeometry(d), new THREE.MeshBasicMaterial({ visible: false }));
  g.add(editCage);
  g.traverse((o) => (o.renderOrder = 10));
  obj.add(g);
  editOverlay = g;
}

function attachEdit() {
  if (!edit) return;
  const obj = objOf(edit.path);
  const b = getBlock(edit.path);
  if (!obj || !b?.mesh) {
    edit = null;
    syncEditBar();
    return;
  }
  const count = edit.mode === 'vertex' ? b.mesh.v.length / 3 : edit.mode === 'edge' ? edgesOf(b.mesh).length : b.mesh.f.length;
  edit.sel = edit.sel.filter((i) => i < count);
  drawEditOverlay();
  const verts = editVerts();
  obj.add(editPivot);
  if (verts.length) {
    const c = new THREE.Vector3();
    for (const i of verts) c.add(new THREE.Vector3().fromArray(b.mesh.v, i * 3));
    editPivot.position.copy(c.divideScalar(verts.length));
    editPivot.quaternion.identity();
    editPivot.scale.set(1, 1, 1);
    gizmo.attach(editPivot);
  }
  syncEditBar();
}

function pickElement(x: number, y: number, additive: boolean) {
  if (!edit) return;
  const obj = objOf(edit.path);
  const b = getBlock(edit.path);
  if (!obj || !b?.mesh) return;
  obj.updateMatrixWorld();
  const rect = renderer.domElement.getBoundingClientRect();
  const screen = (i: number) => {
    const p = new THREE.Vector3().fromArray(b.mesh!.v, i * 3).applyMatrix4(obj.matrixWorld).project(camera);
    return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height, z: p.z };
  };
  let hit = -1;
  if (edit.mode === 'vertex') {
    let best = 14;
    for (let i = 0; i < b.mesh.v.length / 3; i++) {
      const s = screen(i);
      const dist = Math.hypot(s.x - x, s.y - y) + s.z * 0.5;
      if (dist < best) {
        best = dist;
        hit = i;
      }
    }
  } else if (edit.mode === 'edge') {
    let best = 10;
    edgesOf(b.mesh).forEach(([a, c], i) => {
      const p = screen(a);
      const q = screen(c);
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const len2 = dx * dx + dy * dy || 1;
      const k = Math.max(0, Math.min(1, ((x - p.x) * dx + (y - p.y) * dy) / len2));
      const dist = Math.hypot(p.x + dx * k - x, p.y + dy * k - y) + (p.z + q.z) * 0.25;
      if (dist < best) {
        best = dist;
        hit = i;
      }
    });
  } else if (editCage) {
    ray.setFromCamera(ndcAt(x, y), camera);
    const h = ray.intersectObject(editCage, false)[0];
    const triFace = editCage.geometry.userData.triFace as number[] | undefined;
    if (h && h.faceIndex != null && triFace) hit = triFace[h.faceIndex] ?? -1;
  }
  if (hit < 0) {
    if (!additive) edit.sel = [];
  } else if (additive) edit.sel = edit.sel.includes(hit) ? edit.sel.filter((i) => i !== hit) : [...edit.sel, hit];
  else edit.sel = [hit];
  updateHelper();
}

function selectAllElements() {
  if (!edit) return;
  const b = getBlock(edit.path);
  if (!b?.mesh) return;
  const n = edit.mode === 'vertex' ? b.mesh.v.length / 3 : edit.mode === 'edge' ? edgesOf(b.mesh).length : b.mesh.f.length;
  edit.sel = edit.sel.length === n ? [] : Array.from({ length: n }, (_, i) => i);
  updateHelper();
}

/** pull the picked faces out of the shape, then leave them picked to drag further */
function extrudeSelected() {
  if (!edit || edit.mode !== 'face' || !edit.sel.length) return;
  const b = getBlock(edit.path);
  if (!b?.mesh) return;
  pushUndo();
  edit.sel = extrudeFaces(b.mesh, edit.sel, 0.06);
  setGizmoMode('translate');
  designChanged(true);
}
$('extrude').addEventListener('click', extrudeSelected);

// ---------- draw a shape: click an outline on a plane facing the camera, then extrude it ----------
let draw: {
  origin: THREE.Vector3;
  u: THREE.Vector3;
  w: THREE.Vector3;
  n: THREE.Vector3;
  plane: THREE.Plane;
  pts: THREE.Vector2[];
  cursor: THREE.Vector2 | null;
  layer: THREE.Group;
} | null = null;
const drawBar = $('draw-bar');
const SNAP = 0.02;

function startDraw() {
  exitEdit();
  // the plane faces whichever side the camera mostly looks from, through the unit's middle
  const dir = camera.getWorldDirection(new THREE.Vector3());
  const ax = [Math.abs(dir.x), Math.abs(dir.y), Math.abs(dir.z)];
  const axis = ax.indexOf(Math.max(...ax));
  const n = new THREE.Vector3().setComponent(axis, -Math.sign(dir.getComponent(axis)) || 1);
  const w = axis === 1 ? new THREE.Vector3(0, 0, -Math.sign(n.y)) : new THREE.Vector3(0, 1, 0);
  const u = w.clone().cross(n);
  const origin = controls.target.clone();
  const layer = new THREE.Group();
  // a faint sheet so the plane is visible
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ color: 0x3ef0ff, opacity: 0.06, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  sheet.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, w, n));
  sheet.position.copy(origin);
  layer.add(sheet);
  scene.add(layer);
  draw = { origin, u, w, n, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n, origin), pts: [], cursor: null, layer };
  drawBar.classList.remove('hidden');
  updateHelper();
  refreshDraw();
}
const toWorld = (p: THREE.Vector2) => draw!.origin.clone().addScaledVector(draw!.u, p.x).addScaledVector(draw!.w, p.y);
function planeAt(x: number, y: number) {
  if (!draw) return null;
  ray.setFromCamera(ndcAt(x, y), camera);
  const hit = new THREE.Vector3();
  if (!ray.ray.intersectPlane(draw.plane, hit)) return null;
  hit.sub(draw.origin);
  const snap = (v: number) => Math.round(v / SNAP) * SNAP;
  return new THREE.Vector2(snap(hit.dot(draw.u)), snap(hit.dot(draw.w)));
}
function refreshDraw() {
  if (!draw) return;
  const keep = draw.layer.children[0];
  draw.layer.clear();
  draw.layer.add(keep);
  const path = [...draw.pts, ...(draw.cursor ? [draw.cursor] : [])].map(toWorld);
  if (path.length >= 2) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path), new THREE.LineBasicMaterial({ color: 0xffd23e, depthTest: false }));
    line.renderOrder = 11;
    draw.layer.add(line);
  }
  if (draw.pts.length) {
    const dots = new THREE.Points(new THREE.BufferGeometry().setFromPoints(draw.pts.map(toWorld)), new THREE.PointsMaterial({ color: 0xffd23e, size: 9, sizeAttenuation: false, depthTest: false }));
    dots.renderOrder = 11;
    draw.layer.add(dots);
  }
  $('draw-hint').textContent = draw.pts.length < 3 ? `Click to place points on the grid plane (${draw.pts.length} so far, at least 3).` : 'Click the first point, double-click or press Enter to close the shape.';
  $<HTMLButtonElement>('draw-finish').disabled = draw.pts.length < 3;
  $<HTMLButtonElement>('draw-undo').disabled = !draw.pts.length;
}
function drawHover(x: number, y: number) {
  if (!draw) return;
  draw.cursor = planeAt(x, y);
  refreshDraw();
}
function drawClick(x: number, y: number) {
  if (!draw) return;
  const p = planeAt(x, y);
  if (!p) return;
  // clicking near the first point closes the outline
  if (draw.pts.length >= 3) {
    const first = toWorld(draw.pts[0]).project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    if (Math.hypot(rect.left + ((first.x + 1) / 2) * rect.width - x, rect.top + ((1 - first.y) / 2) * rect.height - y) < 12) {
      finishDraw();
      return;
    }
  }
  const lastPt = draw.pts[draw.pts.length - 1];
  if (!lastPt || lastPt.distanceTo(p) > 1e-6) draw.pts.push(p);
  refreshDraw();
}
function cancelDraw() {
  if (!draw) return;
  scene.remove(draw.layer);
  draw = null;
  drawBar.classList.add('hidden');
  updateHelper();
}
function finishDraw() {
  if (!draw || draw.pts.length < 3) return;
  const { u, w, n } = draw;
  let pts = draw.pts.map((p) => p.clone());
  // counter-clockwise, so the faces point outward
  let area = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    area += p.x * q.y - q.x * p.y;
  });
  if (area < 0) pts = pts.reverse();
  const c = pts.reduce((s, p) => s.add(p), new THREE.Vector2()).divideScalar(pts.length);
  const local = pts.map((p) => [r4(p.x - c.x), r4(p.y - c.y)] as [number, number]);
  // place it: centred on the outline, facing the camera side it was drawn from, inside the selected group
  const parentP = selected && getBlock(selected)?.shape === 'group' ? selected : 'r';
  const world = new THREE.Matrix4().makeBasis(u, w, n).setPosition(toWorld(c));
  // in the unit's own space (the model stands at the origin while drawing)
  const parentObj = parentP === 'r' ? null : objOf(parentP);
  const rootInv = model ? model.root.matrixWorld.clone().invert() : new THREE.Matrix4();
  const parentM = parentObj ? rootInv.multiply(parentObj.matrixWorld) : new THREE.Matrix4();
  const m = parentM.invert().multiply(world);
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  m.decompose(pos, quat, scl);
  const e = new THREE.Euler().setFromQuaternion(quat);
  pushUndo();
  const block: Block = {
    shape: 'mesh',
    name: 'Drawn shape',
    mesh: prism(local, 0.12),
    size: { bevel: 0, smooth: 0 },
    mat: { kind: 'lambert', color: 'accent' },
    p: [r2(pos.x), r2(pos.y), r2(pos.z)],
    r: [r2(e.x), r2(e.y), r2(e.z)],
    s: [r2(scl.x), r2(scl.y), r2(scl.z)],
  };
  const i = insertInto(getBlock(parentP)!, block);
  scene.remove(draw.layer);
  draw = null;
  drawBar.classList.add('hidden');
  selected = `${parentP}/${i}`;
  selection = [selected];
  designChanged(true);
  showTab('blocks');
  // straight into face editing, front face picked, ready to extrude deeper
  enterEdit();
  if (edit) {
    edit.mode = 'face';
    edit.sel = [0];
    syncEditBar();
    updateHelper();
  }
}
$('draw').addEventListener('click', () => (draw ? cancelDraw() : startDraw()));
$('draw-cancel').addEventListener('click', cancelDraw);
$('draw-finish').addEventListener('click', finishDraw);
$('draw-undo').addEventListener('click', () => {
  draw?.pts.pop();
  refreshDraw();
});

// ---------- roster list ----------
function renderRoster() {
  const list = $('unit-list');
  list.innerHTML = '';
  for (const c of CHARACTERS) {
    const b = document.createElement('button');
    b.className = 'unit' + (c.id === currentId ? ' on' : '');
    const tag = !isBuiltin(c.id) ? 'CUSTOM' : roster.units[c.id] ? 'EDITED' : '';
    b.innerHTML = `<i style="background:linear-gradient(135deg, ${hex(c.palette.body)} 0 50%, ${hex(c.palette.trim)} 50% 78%, ${hex(c.ball)} 78%)"></i><span></span>${tag ? `<em>${tag}</em>` : ''}`;
    b.querySelector('span')!.textContent = c.name;
    b.addEventListener('click', () => switchUnit(c.id));
    list.appendChild(b);
  }
  $<HTMLButtonElement>('delete-unit').disabled = isBuiltin(currentId);
  $<HTMLButtonElement>('reset-unit').disabled = !isBuiltin(currentId) || !roster.units[currentId];
}

function switchUnit(id: string) {
  flushSave();
  cancelDraw();
  edit = null;
  syncEditBar();
  currentId = id;
  selected = null;
  selection = [];
  undo = [];
  redo = [];
  syncUndoButtons();
  loadDraft();
  rebuildPreview();
  renderRoster();
  renderProfile();
  renderPalette();
  renderTree();
  renderForm();
}

$('new-unit').addEventListener('click', () => {
  const d = def();
  const id = 'u' + Date.now().toString(36);
  roster.units[id] = {
    id,
    base: d.base ?? d.id,
    name: `${d.name} II`.slice(0, 22),
    ball: d.ball,
    palette: { body: d.palette.body, trim: d.palette.trim, accent: d.palette.accent, joint: d.palette.joint, eye: d.palette.eye },
    traits: { ...DEFAULT_TRAITS, ...d.traits },
    blueprint: clone(draft),
  };
  reloadRoster(roster);
  scheduleSave();
  switchUnit(id);
});

$('delete-unit').addEventListener('click', () => {
  if (isBuiltin(currentId)) return;
  if (!confirm(`Delete ${def().name}? This can't be undone.`)) return;
  const base = def().base ?? BUILTINS[0].id;
  delete roster.units[currentId];
  reloadRoster(roster);
  flushSave();
  switchUnit(base);
});

$('reset-unit').addEventListener('click', () => {
  if (!isBuiltin(currentId) || !roster.units[currentId]) return;
  if (!confirm(`Reset ${def().name} to its original name, traits, colours and design?`)) return;
  pushUndo();
  edit = null;
  syncEditBar();
  delete roster.units[currentId];
  reloadRoster(roster);
  loadDraft();
  selected = null;
  selection = [];
  commit(true);
});

// every edited and custom unit as a file, to back up or to share the designs
$('export-roster').addEventListener('click', () => {
  flushSave();
  const url = URL.createObjectURL(new Blob([JSON.stringify(roster, null, 1)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'marble-fighter-roster.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$('play').addEventListener('click', () => {
  flushSave();
  const save = store.load();
  store.save({ settings: { ...save.settings, character: currentId } });
  location.href = './';
});

// ---------- tabs ----------
function showTab(name: string) {
  document.querySelectorAll<HTMLElement>('.tabs [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  document.querySelectorAll<HTMLElement>('.tab-panel').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== name));
}
document.querySelectorAll<HTMLElement>('.tabs [data-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab!)));

// ---------- profile: name + traits ----------
const base = computeStats(STARTER_BUILD);
const TRAITS: { key: keyof Traits; label: string; sub: string; value: (m: number) => string }[] = [
  { key: 'speed', label: 'Speed', sub: 'How fast it slides along the rail.', value: (m) => `${(base.moveSpeed * m).toFixed(1)} m/s` },
  { key: 'fireRate', label: 'Fire rate', sub: 'Shots per second while the trigger is held.', value: (m) => `${(m / base.fireInterval).toFixed(1)} shots/s` },
  { key: 'health', label: 'Health', sub: 'Armour before a knockout.', value: (m) => `${Math.round(MATCH.maxHealth * m)} HP` },
  { key: 'agility', label: 'Agility', sub: 'Shield recharge speed, and dodging when the CPU drives it.', value: (m) => `×${m.toFixed(2)}` },
];

const nameInput = $<HTMLInputElement>('unit-name');
nameInput.addEventListener('input', () => {
  pushUndo('name');
  entry().name = nameInput.value;
  commit();
});

function renderProfile() {
  nameInput.value = def().name;
  const traits = { ...DEFAULT_TRAITS, ...def().traits };
  const box = $('traits');
  box.innerHTML = '';
  for (const tr of TRAITS) {
    const lvl = traits[tr.key];
    const row = document.createElement('div');
    row.className = 'trait';
    row.innerHTML = `<div class="trait-head"><b>${tr.label}</b><em>${tr.value(traitMul(lvl))}</em></div><div class="levels"></div><p class="trait-sub">${tr.sub}</p>`;
    const levels = row.querySelector('.levels')!;
    for (let n = 1; n <= 5; n++) {
      const b = document.createElement('button');
      b.textContent = String(n);
      b.classList.toggle('on', n === lvl);
      b.classList.toggle('lit', n < lvl);
      b.addEventListener('click', () => {
        pushUndo();
        entry().traits = { ...traits, [tr.key]: n };
        commit();
        renderProfile();
      });
      levels.appendChild(b);
    }
    box.appendChild(row);
  }
}

// ---------- colours ----------
const SLOTS: { key: PaletteSlot; label: string }[] = [
  { key: 'body', label: 'Body' },
  { key: 'trim', label: 'Trim' },
  { key: 'accent', label: 'Accent' },
  { key: 'joint', label: 'Joints & frame' },
  { key: 'eye', label: 'Eyes & glow' },
  { key: 'ball', label: 'Marble' },
];
const slotColor = (k: PaletteSlot) => (k === 'ball' ? def().ball : def().palette[k]);

function renderPalette() {
  const box = $('palette');
  box.innerHTML = '';
  for (const s of SLOTS) {
    const row = document.createElement('label');
    row.className = 'swatch';
    const input = document.createElement('input');
    input.type = 'color';
    input.value = hex(slotColor(s.key));
    const small = document.createElement('small');
    small.textContent = input.value;
    input.addEventListener('input', () => {
      pushUndo('color-' + s.key);
      const v = parseInt(input.value.slice(1), 16);
      const e = entry();
      if (s.key === 'ball') e.ball = v;
      else e.palette = { ...e.palette, [s.key]: v };
      small.textContent = input.value;
      commit();
    });
    const span = document.createElement('span');
    span.textContent = s.label;
    row.append(input, span, small);
    box.appendChild(row);
  }
}

// ---------- block tree (layers) ----------
const SHAPE_LABEL: Record<Shape, string> = { group: 'Group', box: 'Box', rbox: 'Rounded', capsule: 'Capsule', sphere: 'Ball', cylinder: 'Tube', cone: 'Spike', torus: 'Ring', mesh: 'Mesh' };
const ROLE_LABEL: Record<Role, string> = {
  turret: 'AIMS',
  barrel: 'BARREL',
  leg: 'LEG',
  jaw: 'JAW',
  flame: 'FLAME',
  trigger: 'TRIGGER',
  belly: 'BALL EXIT',
  wings: 'WINGS',
  wingL: 'WING L',
  wingR: 'WING R',
};
const blockColor = (b: Block) => (b.mat ? resolveColor(b.mat.color, def(), def().ball) : null);

/** the layers being dragged, and where they'd land */
let dragPaths: string[] = [];
type Drop = 'before' | 'after' | 'inside';

function renderTree() {
  const tree = $('tree');
  const scroll = tree.scrollTop;
  tree.innerHTML = '';
  const add = (b: Block, path: string, depth: number) => {
    const row = document.createElement('div');
    row.className = 'node' + (path === selected ? ' on' : selection.includes(path) ? ' sel' : '');
    row.style.paddingLeft = `${8 + depth * 14}px`;
    const col = blockColor(b);
    const label = path === 'r' ? 'Unit' : b.name || SHAPE_LABEL[b.shape];
    row.innerHTML = `<i class="${col === null ? '' : 'paint'}" title="${col === null ? '' : 'Change colour'}" style="background:${col === null ? 'transparent;border:1px solid #3ef0ff55' : hex(col)}"></i><span></span>${b.role ? `<b class="role">${ROLE_LABEL[b.role]}</b>` : ''}${b.name ? `<span class="kind">${SHAPE_LABEL[b.shape]}</span>` : ''}`;
    row.querySelector('span')!.textContent = label;
    row.addEventListener('click', (e) => select(path, e.shiftKey || e.metaKey || e.ctrlKey));
    const swatch = row.querySelector('i')!;
    if (col !== null)
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        pickLayerColor(path, swatch);
      });
    if (path !== 'r') {
      row.draggable = true;
      row.addEventListener('dragstart', (e) => {
        dragPaths = selection.includes(path) ? topLevel(selection) : [path];
        e.dataTransfer?.setData('text/plain', path);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        row.classList.add('dragging');
      });
      row.addEventListener('dragend', () => {
        dragPaths = [];
        renderTree();
      });
    }
    const zone = (e: DragEvent): Drop => {
      if (path === 'r') return 'inside';
      const r = row.getBoundingClientRect();
      const k = (e.clientY - r.top) / r.height;
      if (b.shape === 'group') return k < 0.28 ? 'before' : k > 0.72 ? 'after' : 'inside';
      return k < 0.5 ? 'before' : 'after';
    };
    row.addEventListener('dragover', (e) => {
      if (!dragPaths.length || dragPaths.some((p) => path === p || path.startsWith(p + '/'))) return;
      e.preventDefault();
      const z = zone(e);
      row.classList.toggle('drop-before', z === 'before');
      row.classList.toggle('drop-after', z === 'after');
      row.classList.toggle('drop-inside', z === 'inside');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-before', 'drop-after', 'drop-inside'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!dragPaths.length) return;
      moveLayers(dragPaths, path, zone(e));
      dragPaths = [];
    });
    tree.appendChild(row);
    (b.children ?? []).forEach((c, i) => add(c, `${path}/${i}`, depth + 1));
  };
  add(draft, 'r', 0);
  tree.scrollTop = scroll;
}

/** move layers before / after / into another layer, keeping them selected */
function moveLayers(paths: string[], target: string, where: Drop) {
  paths = topLevel(paths).filter((p) => target !== p && !target.startsWith(p + '/'));
  if (!paths.length) return;
  const targetBlock = getBlock(target);
  if (!targetBlock) return;
  pushUndo();
  const moving = paths.map((p) => getBlock(p)!).filter(Boolean);
  for (const p of removalOrder(paths)) getBlock(parentPath(p))!.children!.splice(indexIn(p), 1);
  if (where === 'inside') (targetBlock.children ??= []).push(...moving);
  else {
    const parent = getBlock(parentPath(pathOf(targetBlock)!))!;
    const i = parent.children!.indexOf(targetBlock) + (where === 'after' ? 1 : 0);
    parent.children!.splice(i, 0, ...moving);
  }
  selection = moving.map((b) => pathOf(b)!).filter(Boolean);
  selected = selection[selection.length - 1] ?? null;
  exitEditQuiet();
  designChanged(true);
}

/** nudge the picked layer one place up or down its list */
function shiftLayer(by: -1 | 1) {
  if (!selected || selected === 'r') return;
  const pp = parentPath(selected);
  const list = getBlock(pp)?.children;
  const i = indexIn(selected);
  const j = i + by;
  if (!list || j < 0 || j >= list.length) return;
  pushUndo();
  const b = list[i];
  [list[i], list[j]] = [list[j], list[i]];
  const keep = selection.map((p) => getBlock(p));
  selection = keep.map((k) => (k ? pathOf(k) : null)).filter((p): p is string => !!p);
  selected = pathOf(b);
  exitEditQuiet();
  designChanged(true);
}
$('move-up').addEventListener('click', () => shiftLayer(-1));
$('move-down').addEventListener('click', () => shiftLayer(1));

/** click a layer's colour dot: paint it (and the rest of the selection, if it's part of it) */
function pickLayerColor(path: string, anchor: HTMLElement) {
  const targets = (selection.includes(path) ? selection : [path]).map(getBlock).filter((b): b is Block => !!b?.mat);
  if (!targets.length) return;
  const input = document.createElement('input');
  input.type = 'color';
  input.value = hex(blockColor(getBlock(path)!) ?? 0xffffff);
  const r = anchor.getBoundingClientRect();
  Object.assign(input.style, { position: 'fixed', left: `${r.left}px`, top: `${r.bottom}px`, width: '1px', height: '1px', opacity: '0', border: '0', padding: '0' });
  document.body.appendChild(input);
  input.addEventListener('input', () => {
    pushUndo('layer-color');
    const v = parseInt(input.value.slice(1), 16);
    for (const b of targets) b.mat!.color = v;
    designChanged();
  });
  const done = () => {
    input.remove();
    renderForm();
  };
  input.addEventListener('change', done);
  input.addEventListener('blur', () => setTimeout(done, 200));
  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker();
      return;
    } catch {
      // fall back to a click
    }
  }
  input.click();
}

/** leave shape editing without re-rendering (the caller refreshes) */
function exitEditQuiet() {
  if (!edit) return;
  edit = null;
  editOverlay?.removeFromParent();
  editPivot.removeFromParent();
  editOverlay = null;
  editCage = null;
  syncEditBar();
}

function select(path: string | null, additive = false) {
  if (edit && path !== edit.path) exitEditQuiet();
  if (additive && path && path !== 'r') {
    const rest = selection.filter((p) => p !== 'r');
    if (rest.includes(path)) {
      selection = rest.filter((p) => p !== path);
      selected = selection[selection.length - 1] ?? null;
    } else {
      selection = [...rest, path];
      selected = path;
    }
  } else {
    selection = path ? [path] : [];
    selected = path;
  }
  renderTree();
  renderForm();
  updateHelper();
  const row = document.querySelector('.node.on');
  row?.scrollIntoView({ block: 'nearest' });
}

// ---------- block form ----------
const SIZE_FIELDS: Record<Exclude<Shape, 'group'>, [string, string][]> = {
  box: [
    ['width', 'W'],
    ['height', 'H'],
    ['depth', 'D'],
  ],
  rbox: [
    ['width', 'W'],
    ['height', 'H'],
    ['depth', 'D'],
  ],
  capsule: [
    ['radius', 'R'],
    ['height', 'L'],
  ],
  sphere: [['radius', 'R']],
  cylinder: [
    ['radiusTop', 'Top'],
    ['radiusBottom', 'Bot'],
    ['height', 'H'],
    ['radialSegments', 'Sides'],
  ],
  cone: [
    ['radius', 'R'],
    ['height', 'H'],
    ['radialSegments', 'Sides'],
  ],
  torus: [
    ['radius', 'R'],
    ['tube', 'Tube'],
  ],
  mesh: [],
};

function numberInput(value: number, step: number, onChange: (v: number) => void, key: string, full = false) {
  const input = document.createElement('input');
  input.type = 'number';
  input.step = String(step);
  input.value = String(r2(value));
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    if (!Number.isFinite(v)) return;
    pushUndo(key);
    onChange(v);
    designChanged();
  });
  // a change that swaps the shape needs the form rebuilt once typing is done
  if (full) input.addEventListener('change', () => renderForm());
  return input;
}

function renderForm() {
  const form = $('block-form');
  form.innerHTML = '';
  const b = selected ? getBlock(selected) : null;
  const many = topLevel(selection).length > 1;
  const single = !!b && selected !== 'r' && !many;
  $<HTMLButtonElement>('dup').disabled = !topLevel(selection).length;
  $<HTMLButtonElement>('mirror').disabled = !topLevel(selection).length;
  $<HTMLButtonElement>('del').disabled = !topLevel(selection).length;
  $<HTMLButtonElement>('group-sel').disabled = !topLevel(selection).length;
  $<HTMLButtonElement>('move-up').disabled = !single || indexIn(selected!) === 0;
  $<HTMLButtonElement>('move-down').disabled = !single || indexIn(selected!) >= (getBlock(parentPath(selected!))?.children?.length ?? 1) - 1;
  $<HTMLButtonElement>('edit-shape').disabled = !single || b!.shape === 'group';
  const section = (title: string) => {
    const h = document.createElement('div');
    h.className = 'form-title';
    h.textContent = title;
    form.appendChild(h);
  };
  const row2 = (label: string, el: HTMLElement) => {
    const row = document.createElement('div');
    row.className = 'row2';
    const span = document.createElement('span');
    span.textContent = label;
    row.append(span, el);
    form.appendChild(row);
  };
  /** colour + finish controls for one or more blocks */
  const paint = (blocks: Block[], key: string) => {
    const mats = blocks.map((x) => x.mat).filter((m): m is NonNullable<Block['mat']> => !!m);
    if (!mats.length) return;
    section('PAINT');
    const first = mats[0];
    const same = mats.every((m) => m.color === first.color);
    const pick = document.createElement('select');
    if (!same) pick.add(new Option('Mixed', 'mixed', true, true));
    for (const s of SLOTS) pick.add(new Option(s.label, s.key, false, same && first.color === s.key));
    pick.add(new Option('Custom…', 'custom', false, same && typeof first.color === 'number'));
    const custom = document.createElement('input');
    custom.type = 'color';
    custom.value = hex(resolveColor(first.color, def(), def().ball));
    custom.classList.toggle('hidden', !(same && typeof first.color === 'number'));
    pick.addEventListener('change', () => {
      if (pick.value === 'mixed') return;
      pushUndo();
      for (const m of mats) m.color = pick.value === 'custom' ? parseInt(custom.value.slice(1), 16) : (pick.value as ColorRef);
      custom.classList.toggle('hidden', pick.value !== 'custom');
      custom.value = hex(resolveColor(mats[0].color, def(), def().ball));
      designChanged();
    });
    custom.addEventListener('input', () => {
      pushUndo(key + '-custom');
      for (const m of mats) m.color = parseInt(custom.value.slice(1), 16);
      designChanged();
    });
    const inline = document.createElement('div');
    inline.className = 'inline';
    inline.append(pick, custom);
    row2('Colour', inline);

    const finish = document.createElement('select');
    const kinds = new Set(mats.map((m) => m.kind));
    if (kinds.size > 1) finish.add(new Option('Mixed', 'mixed', true, true));
    for (const [k, label] of [
      ['lambert', 'Matte'],
      ['basic', 'Glow (unlit)'],
      ['phong', 'Glossy'],
    ] as const)
      finish.add(new Option(label, k, false, kinds.size === 1 && first.kind === k));
    finish.addEventListener('change', () => {
      if (finish.value === 'mixed') return;
      pushUndo();
      for (const m of mats) m.kind = finish.value as 'lambert' | 'basic' | 'phong';
      designChanged();
    });
    row2('Finish', finish);
  };

  if (many) {
    const n = topLevel(selection).length;
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = `${n} blocks selected. Drag the gizmo (or one of them) to move, turn or scale them together; Group, Duplicate, Mirror and Delete work on all of them.`;
    form.appendChild(p);
    paint(selection.map(getBlock).filter((x): x is Block => !!x), 'multi');
    return;
  }
  if (!b || !selected) {
    form.innerHTML = '<p class="empty">Select a block in the list or click one on the model (Shift / ⌘ to pick several). Add blocks with the buttons above, or draw your own shape; they go inside the selected group.</p>';
    return;
  }
  if (selected === 'r') {
    form.innerHTML = '<p class="empty">The whole unit. Everything hangs off this; add blocks here or inside a group. Blocks marked AIMS turn with the aim, LEG blocks walk, the BARREL recoils, and BALL EXIT (an empty group on the belly) is where the marble leaves.</p>';
    return;
  }
  const path = selected;
  const row3 = (label: string, values: number[], step: number, toShow: (v: number) => number, fromShow: (v: number) => number, set: (i: number, v: number) => void, key: string) => {
    const row = document.createElement('div');
    row.className = 'row3';
    const span = document.createElement('span');
    span.textContent = label;
    row.appendChild(span);
    ['x', 'y', 'z'].forEach((axis, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'axis';
      wrap.dataset.axis = axis;
      wrap.appendChild(numberInput(toShow(values[i]), step, (v) => set(i, fromShow(v)), `${path}-${key}-${i}`));
      row.appendChild(wrap);
    });
    form.appendChild(row);
  };
  const fieldRow = (fields: { label: string; value: number; step: number; set: (v: number) => void; key: string; full?: boolean }[]) => {
    const row = document.createElement('div');
    row.className = 'row3';
    row.style.gridTemplateColumns = `repeat(${fields.length}, 1fr)`;
    for (const f of fields) {
      const wrap = document.createElement('div');
      wrap.className = 'axis';
      wrap.dataset.axis = f.label;
      const input = numberInput(f.value, f.step, f.set, `${path}-${f.key}`, f.full);
      input.style.paddingLeft = `${10 + f.label.length * 7}px`;
      wrap.appendChild(input);
      row.appendChild(wrap);
    }
    form.appendChild(row);
  };

  section('BLOCK');
  const name = document.createElement('input');
  name.type = 'text';
  name.value = b.name ?? '';
  name.placeholder = SHAPE_LABEL[b.shape];
  name.addEventListener('input', () => {
    pushUndo(path + '-name');
    b.name = name.value || undefined;
    designChanged();
  });
  row2('Name', name);

  const shape = document.createElement('select');
  for (const s of Object.keys(SHAPE_LABEL) as Shape[]) {
    // a mesh comes from Edit shape or Draw; it can't be picked from scratch
    if (s === 'mesh' && b.shape !== 'mesh') continue;
    shape.add(new Option(SHAPE_LABEL[s], s, false, s === b.shape));
  }
  shape.addEventListener('change', () => {
    pushUndo();
    const next = shape.value as Shape;
    exitEditQuiet();
    b.shape = next;
    delete b.mesh;
    if (next === 'group') {
      delete b.size;
      delete b.mat;
    } else {
      b.size = { ...DEFAULT_SIZE[next] };
      b.mat ??= { kind: 'lambert', color: 'body' };
    }
    designChanged(true);
  });
  row2('Shape', shape);

  const role = document.createElement('select');
  role.add(new Option('— none —', ''));
  for (const [k, label] of Object.entries(ROLE_LABEL) as [Role, string][]) {
    if (k === 'wings' || k === 'wingL' || k === 'wingR') continue;
    role.add(new Option(label.charAt(0) + label.slice(1).toLowerCase(), k, false, b.role === k));
  }
  role.addEventListener('change', () => {
    pushUndo();
    // aims / barrel / jaw / flame / trigger are one-per-unit: move the tag here
    const r = role.value as Role | '';
    if (r && r !== 'leg') {
      const strip = (n: Block) => {
        if (n.role === r) delete n.role;
        n.children?.forEach(strip);
      };
      strip(draft);
    }
    if (r) b.role = r;
    else delete b.role;
    designChanged(true);
  });
  row2('Moves as', role);

  if (b.shape !== 'group') {
    const size = (b.size ??= { ...DEFAULT_SIZE[b.shape] });
    const fields = SIZE_FIELDS[b.shape];
    if (fields.length) {
      section('SIZE');
      fieldRow(
        fields.map(([k, label]) => {
          const integer = k.endsWith('Segments');
          return {
            label,
            value: Number(size[k] ?? DEFAULT_SIZE[b.shape as Exclude<Shape, 'group'>][k] ?? 0.2),
            step: integer ? 1 : 0.01,
            set: (v: number) => (size[k] = integer ? Math.max(3, Math.round(v)) : Math.max(0.005, v)),
            key: `size-${k}`,
          };
        }),
      );
    }
    if (b.shape === 'mesh' && b.mesh) {
      section('SHAPE');
      const info = document.createElement('p');
      info.className = 'empty';
      info.textContent = `${b.mesh.v.length / 3} points · ${edgesOf(b.mesh).length} edges · ${b.mesh.f.length} faces. ${edit ? 'Pick points, edges or faces on the canvas and drag the gizmo; Extrude pulls faces out.' : 'Press Edit shape (Tab) to move its points, edges and faces.'}`;
      form.appendChild(info);
    }
    // bevel: rounds or chamfers the edges of boxes, tubes and editable meshes
    const bevelable = b.shape === 'box' || b.shape === 'rbox' || b.shape === 'cylinder' || b.shape === 'mesh';
    if (bevelable) {
      section('BEVEL');
      if (b.shape === 'box' || b.shape === 'rbox') {
        fieldRow([
          {
            label: 'Bevel',
            value: b.shape === 'rbox' ? Number(size.radius ?? 0.06) : 0,
            step: 0.005,
            key: 'bevel',
            full: true,
            set: (v) => {
              if (v <= 0) {
                b.shape = 'box';
                delete size.radius;
                delete size.segments;
              } else {
                b.shape = 'rbox';
                size.radius = v;
                size.segments ??= 1;
              }
            },
          },
          { label: 'Steps', value: Number(size.segments ?? 1), step: 1, key: 'bevel-steps', set: (v) => (size.segments = Math.max(1, Math.min(8, Math.round(v)))) },
        ]);
      } else if (b.shape === 'cylinder') {
        fieldRow([
          { label: 'Bevel', value: Number(size.bevel ?? 0), step: 0.005, key: 'bevel', set: (v) => (size.bevel = Math.max(0, v)) },
          { label: 'Steps', value: Number(size.bevelSegments ?? 2), step: 1, key: 'bevel-steps', set: (v) => (size.bevelSegments = Math.max(1, Math.min(8, Math.round(v)))) },
        ]);
      } else {
        fieldRow([{ label: 'Bevel', value: Number(size.bevel ?? 0), step: 0.005, key: 'bevel', set: (v) => (size.bevel = Math.max(0, v)) }]);
        const smooth = document.createElement('input');
        smooth.type = 'checkbox';
        smooth.checked = !!size.smooth;
        smooth.addEventListener('change', () => {
          pushUndo();
          size.smooth = smooth.checked ? 1 : 0;
          designChanged();
        });
        const lab = document.createElement('label');
        lab.className = 'inline';
        lab.append(smooth, document.createTextNode(' Smooth shading'));
        row2('Surface', lab);
      }
    }
  }

  section('PLACE');
  row3('Position', b.p, 0.01, (v) => v, (v) => v, (i, v) => (b.p[i] = v), 'p');
  row3('Rotate °', b.r, 1, (v) => Math.round(v * DEG * 10) / 10, (v) => v / DEG, (i, v) => (b.r[i] = v), 'r');
  row3('Scale', b.s, 0.05, (v) => v, (v) => v, (i, v) => (b.s[i] = v), 's');

  paint([b], path);
}

// ---------- add / duplicate / mirror / group / delete ----------
function insertInto(parent: Block, block: Block, at?: number) {
  parent.children ??= [];
  const i = at ?? parent.children.length;
  parent.children.splice(i, 0, block);
  return i;
}

document.querySelectorAll<HTMLElement>('[data-add]').forEach((btn) =>
  btn.addEventListener('click', () => {
    pushUndo();
    exitEditQuiet();
    cancelDraw();
    const shape = btn.dataset.add as Shape;
    // inside the selected group, or next to the selected block
    let parentP = 'r';
    if (selected) {
      const sb = getBlock(selected);
      parentP = sb && sb.shape === 'group' ? selected : selected === 'r' ? 'r' : parentPath(selected);
    }
    const parent = getBlock(parentP)!;
    const block: Block = {
      shape,
      p: parentP === 'r' ? [0, 1.6, 0] : [0, 0.25, 0],
      r: [0, 0, 0],
      s: [1, 1, 1],
      ...(shape === 'group' ? {} : { size: { ...DEFAULT_SIZE[shape as Exclude<Shape, 'group'>] }, mat: { kind: 'lambert' as const, color: 'accent' as const } }),
    };
    const i = insertInto(parent, block);
    selected = `${parentP}/${i}`;
    selection = [selected];
    designChanged(true);
    updateHelper();
    showTab('blocks');
  }),
);

/** reflect a block (and everything inside it) across the unit's centre line */
function mirrorBlock(b: Block) {
  b.p[0] = -b.p[0];
  b.r[1] = -b.r[1];
  b.r[2] = -b.r[2];
  if (b.mesh) {
    // flip the points, and turn each face around so it still faces out
    for (let i = 0; i < b.mesh.v.length; i += 3) b.mesh.v[i] = -b.mesh.v[i];
    b.mesh.f = b.mesh.f.map((f) => [...f].reverse());
  }
  b.children?.forEach(mirrorBlock);
}

function copySelected(mirror: boolean) {
  const paths = topLevel(selection);
  if (!paths.length) return;
  pushUndo();
  exitEditQuiet();
  const copies: Block[] = [];
  // later siblings first, so earlier insert points stay valid
  for (const p of removalOrder(paths)) {
    const b = getBlock(p);
    if (!b) continue;
    const copy = clone(b);
    if (mirror) mirrorBlock(copy);
    else copy.p[0] += 0.08;
    // one-per-unit roles stay on the original
    const strip = (n: Block) => {
      if (n.role && n.role !== 'leg') delete n.role;
      n.children?.forEach(strip);
    };
    strip(copy);
    insertInto(getBlock(parentPath(p))!, copy, indexIn(p) + 1);
    copies.push(copy);
  }
  selection = copies.map((c) => pathOf(c)!).filter(Boolean);
  selected = selection[selection.length - 1] ?? null;
  designChanged(true);
  updateHelper();
}
$('dup').addEventListener('click', () => copySelected(false));
$('mirror').addEventListener('click', () => copySelected(true));

/** wrap the selected blocks in a new group, placed where the first of them sat */
function groupSelected() {
  const paths = topLevel(selection);
  if (!paths.length) return;
  pushUndo();
  exitEditQuiet();
  // the group goes where the first selected block sat
  const ordered = removalOrder(paths).reverse();
  const parent = getBlock(parentPath(ordered[0]))!;
  const moving = ordered.map((p) => ({ block: getBlock(p)!, from: getBlock(parentPath(p))! }));
  const group: Block = { shape: 'group', name: 'Group', p: [0, 0, 0], r: [0, 0, 0], s: [1, 1, 1], children: [] };
  parent.children!.splice(parent.children!.indexOf(moving[0].block), 0, group);
  for (const { block, from } of moving) from.children!.splice(from.children!.indexOf(block), 1);
  group.children = moving.map((m) => m.block);
  selected = pathOf(group);
  selection = selected ? [selected] : [];
  designChanged(true);
  updateHelper();
}
$('group-sel').addEventListener('click', groupSelected);

$('del').addEventListener('click', () => {
  const paths = topLevel(selection);
  if (!paths.length) return;
  pushUndo();
  exitEditQuiet();
  const pp = parentPath(paths[0]);
  for (const p of removalOrder(paths)) getBlock(parentPath(p))?.children?.splice(indexIn(p), 1);
  selected = getBlock(pp) ? pp : 'r';
  selection = [selected];
  designChanged(true);
  updateHelper();
});

// ---------- keyboard ----------
window.addEventListener('keydown', (e) => {
  const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    if (typing && (e.target as HTMLInputElement).type === 'text') return;
    e.preventDefault();
    if (e.shiftKey) stepHistory(redo, undo);
    else stepHistory(undo, redo);
    return;
  }
  if (typing) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') {
    e.preventDefault();
    groupSelected();
    return;
  }
  // drawing
  if (draw) {
    if (e.key === 'Escape') cancelDraw();
    else if (e.key === 'Enter') finishDraw();
    else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      draw.pts.pop();
      refreshDraw();
    }
    return;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    if (edit) exitEdit();
    else enterEdit();
    return;
  }
  // shape editing
  if (edit) {
    const k = e.key.toLowerCase();
    if (e.key === 'Escape') exitEdit();
    else if (k === '1') setEditMode('vertex');
    else if (k === '2') setEditMode('edge');
    else if (k === '3') setEditMode('face');
    else if (k === 'a') selectAllElements();
    else if (k === 'e' && edit.mode === 'face' && edit.sel.length) extrudeSelected();
    else if (k === 'w') setGizmoMode('translate');
    else if (k === 'e') setGizmoMode('rotate');
    else if (k === 'r') setGizmoMode('scale');
    return;
  }
  const modes: Record<string, GizmoMode> = { w: 'translate', e: 'rotate', r: 'scale' };
  if (!e.metaKey && !e.ctrlKey && modes[e.key.toLowerCase()]) {
    setGizmoMode(modes[e.key.toLowerCase()]);
    return;
  }
  if (e.key === '[' || e.key === ']') {
    shiftLayer(e.key === '[' ? -1 : 1);
    return;
  }
  const paths = topLevel(selection);
  if (!paths.length) return;
  const step = e.shiftKey ? 0.1 : 0.02;
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [0, step],
    ArrowRight: [0, -step],
    ArrowUp: [2, -step],
    ArrowDown: [2, step],
    PageUp: [1, step],
    PageDown: [1, -step],
  };
  const m = moves[e.key];
  if (m) {
    e.preventDefault();
    pushUndo(paths.join() + '-nudge');
    for (const p of paths) {
      const b = getBlock(p);
      if (b) b.p[m[0]] = r2(b.p[m[0]] + m[1]);
    }
    designChanged(true);
    updateHelper();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    $('del').click();
  }
});

window.addEventListener('beforeunload', flushSave);

// ---------- go ----------
loadDraft();
rebuildPreview();
renderRoster();
renderProfile();
renderPalette();
renderTree();
renderForm();
setGizmoMode('translate');
syncUndoButtons();
syncEditBar();
