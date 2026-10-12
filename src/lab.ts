import './lab.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { BUILTINS, CHARACTERS, DEFAULT_SIZE, ShooterMesh, characterById, reloadRoster, resolveColor, type CharacterDef } from './robot';
import { DEFAULT_TRAITS, loadRoster, saveRoster, traitMul, type Block, type ColorRef, type PaletteSlot, type Role, type RosterData, type Shape, type Traits, type UnitEntry } from './roster';
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
const DEG = 180 / Math.PI;

// ---------- state ----------
const roster: RosterData = clone(loadRoster());
reloadRoster(roster);
let currentId = characterById(store.load().settings.character).id;
/** working design for the current unit; linked into the roster on the first edit */
let draft: Block = { shape: 'group', p: [0, 0, 0], r: [0, 0, 0], s: [1, 1, 1] };
let selected: string | null = null;
let undo: string[] = [];
let redo: string[] = [];

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

const snapshot = () => JSON.stringify({ unit: roster.units[currentId] ?? null, draft, selected });
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
  const s = JSON.parse(snap) as { unit: UnitEntry | null; draft: Block; selected: string | null };
  if (s.unit) roster.units[currentId] = s.unit;
  else delete roster.units[currentId];
  // keep the draft and the saved design the same object once linked
  draft = s.unit?.blueprint ?? s.draft;
  selected = s.selected;
  lastUndoKey = '';
  commit(true);
}
function stepHistory(from: string[], to: string[]) {
  const snap = from.pop();
  if (!snap) return;
  to.push(snapshot());
  restore(snap);
  syncUndoButtons();
}
function syncUndoButtons() {
  $<HTMLButtonElement>('undo').disabled = !undo.length;
  $<HTMLButtonElement>('redo').disabled = !redo.length;
}
$('undo').addEventListener('click', () => stepHistory(undo, redo));
$('redo').addEventListener('click', () => stepHistory(redo, undo));

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
let helper: THREE.BoxHelper | null = null;
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
// on-canvas gizmo: drag the arrows / rings / boxes to move, rotate or scale the selected block
const gizmo = new TransformControls(camera, renderer.domElement);
gizmo.setSize(0.85);
gizmo.setSpace('local');
scene.add(gizmo.getHelper());
type GizmoMode = 'translate' | 'rotate' | 'scale';
let gizmoUsed = false;
function setGizmoMode(mode: GizmoMode) {
  gizmo.setMode(mode);
  document.querySelectorAll<HTMLElement>('[data-gizmo]').forEach((b) => b.classList.toggle('on', b.dataset.gizmo === mode));
}
gizmo.addEventListener('dragging-changed', (e) => {
  const dragging = !!(e as unknown as { value: boolean }).value;
  controls.enabled = !dragging;
  if (dragging) {
    gizmoUsed = true;
    pushUndo();
  } else {
    // the drag is done: rebuild from the edited block and refresh the form
    designChanged(true);
    updateHelper();
  }
});
// while dragging, write the transform straight into the block (rebuilt on release)
gizmo.addEventListener('objectChange', () => {
  const b = selected ? getBlock(selected) : null;
  const o = gizmo.object;
  if (!b || !o) return;
  b.p = [r2(o.position.x), r2(o.position.y), r2(o.position.z)];
  b.r = [r2(o.rotation.x), r2(o.rotation.y), r2(o.rotation.z)];
  b.s = [r2(o.scale.x), r2(o.scale.y), r2(o.scale.z)];
});

function updateHelper() {
  if (helper) {
    scene.remove(helper);
    helper.dispose();
    helper = null;
  }
  let target: THREE.Object3D | null = null;
  if (model && selected && selected !== 'r') {
    model.root.traverse((o) => {
      if (o.userData.path === selected) target = o;
    });
  }
  if (target) {
    helper = new THREE.BoxHelper(target, 0xffd23e);
    scene.add(helper);
    gizmo.attach(target);
  } else gizmo.detach();
}

// click (not drag) on a block selects it
let downAt: { x: number; y: number } | null = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  downAt = { x: e.clientX, y: e.clientY };
  gizmoUsed = false;
});
renderer.domElement.addEventListener('pointerup', (e) => {
  // a press that worked the gizmo never changes the selection
  if (gizmoUsed) {
    downAt = null;
    return;
  }
  if (!downAt || !model) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 5) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObject(model.root, true).find((h) => (h.object as THREE.Mesh).isMesh && h.object.userData.path);
  if (hit) showTab('blocks');
  select(hit ? (hit.object.userData.path as string) : null);
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

const fake = { x: 0, y: 0, aim: 0, recoil: 0, vx: 0, flash: 0, stagger: 0, health: 100, firing: false, team: 0 };
let t = 0;
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  t += dt;
  if (model) {
    if (animate) {
      fake.vx = Math.sin(t * 1.2) * 6;
      fake.aim = Math.sin(t * 0.7) * 0.5;
      fake.recoil = Math.max(0, Math.sin(t * 5)) ** 6;
      fake.firing = true;
    } else {
      fake.vx = fake.aim = fake.recoil = 0;
      fake.firing = false;
    }
    // hold the pose still while a block is being dragged, so animation never fights the gizmo
    if (!gizmo.dragging) model.sync(fake as unknown as Shooter, t, dt);
    model.root.position.set(0, model.root.position.y, 0);
  }
  helper?.update();
  controls.update();
  renderer.render(scene, camera);
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
  currentId = id;
  selected = null;
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
  delete roster.units[currentId];
  reloadRoster(roster);
  loadDraft();
  selected = null;
  commit(true);
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

// ---------- block tree ----------
const SHAPE_LABEL: Record<Shape, string> = { group: 'Group', box: 'Box', sphere: 'Ball', cylinder: 'Tube', cone: 'Spike', torus: 'Ring' };
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

function renderTree() {
  const tree = $('tree');
  const scroll = tree.scrollTop;
  tree.innerHTML = '';
  const add = (b: Block, path: string, depth: number) => {
    const row = document.createElement('div');
    row.className = 'node' + (path === selected ? ' on' : '');
    row.style.paddingLeft = `${8 + depth * 14}px`;
    const col = blockColor(b);
    const label = path === 'r' ? 'Unit' : b.name || SHAPE_LABEL[b.shape];
    row.innerHTML = `<i style="background:${col === null ? 'transparent;border:1px solid #3ef0ff55' : hex(col)}"></i><span></span>${b.role ? `<b class="role">${ROLE_LABEL[b.role]}</b>` : ''}${b.name ? `<span class="kind">${SHAPE_LABEL[b.shape]}</span>` : ''}`;
    row.querySelector('span')!.textContent = label;
    row.addEventListener('click', () => select(path));
    tree.appendChild(row);
    (b.children ?? []).forEach((c, i) => add(c, `${path}/${i}`, depth + 1));
  };
  add(draft, 'r', 0);
  tree.scrollTop = scroll;
}

function select(path: string | null) {
  selected = path;
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
};

function numberInput(value: number, step: number, onChange: (v: number) => void, key: string) {
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
  return input;
}

function renderForm() {
  const form = $('block-form');
  form.innerHTML = '';
  const b = selected ? getBlock(selected) : null;
  $<HTMLButtonElement>('dup').disabled = !b || selected === 'r';
  $<HTMLButtonElement>('mirror').disabled = !b || selected === 'r';
  $<HTMLButtonElement>('del').disabled = !b || selected === 'r';
  if (!b || !selected) {
    form.innerHTML = '<p class="empty">Select a block in the list or click one on the model. Add blocks with the buttons above; they go inside the selected group.</p>';
    return;
  }
  if (selected === 'r') {
    form.innerHTML = '<p class="empty">The whole unit. Everything hangs off this; add blocks here or inside a group. Blocks marked AIMS turn with the aim, LEG blocks walk, the BARREL recoils, and BALL EXIT (an empty group on the belly) is where the marble leaves.</p>';
    return;
  }
  const path = selected;
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
  for (const s of Object.keys(SHAPE_LABEL) as Shape[]) shape.add(new Option(SHAPE_LABEL[s], s, false, s === b.shape));
  shape.addEventListener('change', () => {
    pushUndo();
    const next = shape.value as Shape;
    b.shape = next;
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
    section('SIZE');
    const size = (b.size ??= { ...DEFAULT_SIZE[b.shape] });
    const fields = SIZE_FIELDS[b.shape];
    const row = document.createElement('div');
    row.className = 'row3';
    row.style.gridTemplateColumns = `repeat(${fields.length}, 1fr)`;
    for (const [k, label] of fields) {
      const wrap = document.createElement('div');
      wrap.className = 'axis';
      wrap.dataset.axis = label;
      const integer = k.endsWith('Segments');
      const input = numberInput(Number(size[k] ?? DEFAULT_SIZE[b.shape][k] ?? 0.2), integer ? 1 : 0.01, (v) => (size[k] = integer ? Math.max(3, Math.round(v)) : Math.max(0.005, v)), `${path}-size-${k}`);
      input.style.paddingLeft = `${10 + label.length * 7}px`;
      wrap.appendChild(input);
      row.appendChild(wrap);
    }
    form.appendChild(row);
  }

  section('PLACE');
  row3('Position', b.p, 0.01, (v) => v, (v) => v, (i, v) => (b.p[i] = v), 'p');
  row3('Rotate °', b.r, 1, (v) => Math.round(v * DEG * 10) / 10, (v) => v / DEG, (i, v) => (b.r[i] = v), 'r');
  row3('Scale', b.s, 0.05, (v) => v, (v) => v, (i, v) => (b.s[i] = v), 's');

  if (b.mat) {
    section('PAINT');
    const mat = b.mat;
    const pick = document.createElement('select');
    for (const s of SLOTS) pick.add(new Option(s.label, s.key, false, mat.color === s.key));
    pick.add(new Option('Custom…', 'custom', false, typeof mat.color === 'number'));
    const custom = document.createElement('input');
    custom.type = 'color';
    custom.value = hex(resolveColor(mat.color, def(), def().ball));
    custom.classList.toggle('hidden', typeof mat.color !== 'number');
    pick.addEventListener('change', () => {
      pushUndo();
      mat.color = pick.value === 'custom' ? parseInt(custom.value.slice(1), 16) : (pick.value as ColorRef);
      custom.classList.toggle('hidden', pick.value !== 'custom');
      custom.value = hex(resolveColor(mat.color, def(), def().ball));
      designChanged();
    });
    custom.addEventListener('input', () => {
      pushUndo(path + '-custom');
      mat.color = parseInt(custom.value.slice(1), 16);
      designChanged();
    });
    const inline = document.createElement('div');
    inline.className = 'inline';
    inline.append(pick, custom);
    row2('Colour', inline);

    const finish = document.createElement('select');
    for (const [k, label] of [
      ['lambert', 'Matte'],
      ['basic', 'Glow (unlit)'],
      ['phong', 'Glossy'],
    ] as const)
      finish.add(new Option(label, k, false, mat.kind === k));
    finish.addEventListener('change', () => {
      pushUndo();
      mat.kind = finish.value as 'lambert' | 'basic' | 'phong';
      designChanged();
    });
    row2('Finish', finish);
  }
}

// ---------- add / duplicate / mirror / delete ----------
function insertInto(parent: Block, block: Block, at?: number) {
  parent.children ??= [];
  const i = at ?? parent.children.length;
  parent.children.splice(i, 0, block);
  return i;
}

document.querySelectorAll<HTMLElement>('[data-add]').forEach((btn) =>
  btn.addEventListener('click', () => {
    pushUndo();
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
      ...(shape === 'group' ? {} : { size: { ...DEFAULT_SIZE[shape] }, mat: { kind: 'lambert' as const, color: 'accent' as const } }),
    };
    const i = insertInto(parent, block);
    selected = `${parentP}/${i}`;
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
  b.children?.forEach(mirrorBlock);
}

function copySelected(mirror: boolean) {
  if (!selected || selected === 'r') return;
  const b = getBlock(selected);
  if (!b) return;
  pushUndo();
  const copy = clone(b);
  if (mirror) mirrorBlock(copy);
  else copy.p[0] += 0.08;
  // one-per-unit roles stay on the original
  const strip = (n: Block) => {
    if (n.role && n.role !== 'leg') delete n.role;
    n.children?.forEach(strip);
  };
  strip(copy);
  const pp = parentPath(selected);
  const i = insertInto(getBlock(pp)!, copy, indexIn(selected) + 1);
  selected = `${pp}/${i}`;
  designChanged(true);
  updateHelper();
}
$('dup').addEventListener('click', () => copySelected(false));
$('mirror').addEventListener('click', () => copySelected(true));

$('del').addEventListener('click', () => {
  if (!selected || selected === 'r') return;
  pushUndo();
  const pp = parentPath(selected);
  getBlock(pp)!.children!.splice(indexIn(selected), 1);
  selected = pp;
  designChanged(true);
  updateHelper();
});

// ---------- keyboard: undo/redo, nudge, delete ----------
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
  const modes: Record<string, GizmoMode> = { w: 'translate', e: 'rotate', r: 'scale' };
  if (!e.metaKey && !e.ctrlKey && modes[e.key.toLowerCase()]) {
    setGizmoMode(modes[e.key.toLowerCase()]);
    return;
  }
  if (!selected || selected === 'r') return;
  const b = getBlock(selected);
  if (!b) return;
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
    pushUndo(selected + '-nudge');
    b.p[m[0]] = r2(b.p[m[0]] + m[1]);
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
