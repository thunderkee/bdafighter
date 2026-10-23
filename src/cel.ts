import * as THREE from 'three';

/**
 * Cel shading: every lit surface is drawn with a three-band toon material instead of its
 * standard one (the post pass adds the ink outlines). The toon copy shares the original's
 * colours, so the game's flashes and tints still land; the few plain values (opacity, glow
 * strength, texture) are kept in step both ways each frame.
 */
export const CEL = { on: true };

let gradient: THREE.DataTexture | null = null;
function bands() {
  if (gradient) return gradient;
  // dark side, a mid band, full light
  gradient = new THREE.DataTexture(new Uint8Array([118, 205, 255]), 3, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

type Lit = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial | THREE.MeshPhongMaterial;
type Toon = THREE.MeshToonMaterial & { userData: { celSrc: Lit; last: Record<string, unknown> } };
const toonOf = new WeakMap<THREE.Material, Toon>();
const KEYS = ['opacity', 'transparent', 'visible', 'map', 'emissiveIntensity', 'emissiveMap', 'alphaMap', 'depthWrite', 'side', 'alphaTest', 'wireframe'] as const;

const lit = (m: THREE.Material): m is Lit =>
  !m.userData?.noCel && ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial || (m as THREE.MeshLambertMaterial).isMeshLambertMaterial || (m as THREE.MeshPhongMaterial).isMeshPhongMaterial) === true;

function toonFor(src: Lit) {
  let t = toonOf.get(src);
  if (!t) {
    t = new THREE.MeshToonMaterial({ gradientMap: bands() }) as Toon;
    // (shared, so a tint set through either material shows)
    t.color = src.color;
    t.emissive = src.emissive;
    t.vertexColors = src.vertexColors;
    t.fog = src.fog;
    t.blending = src.blending;
    t.depthTest = src.depthTest;
    t.toneMapped = src.toneMapped;
    t.polygonOffset = src.polygonOffset;
    t.polygonOffsetFactor = src.polygonOffsetFactor;
    t.polygonOffsetUnits = src.polygonOffsetUnits;
    t.name = src.name;
    t.userData = { ...src.userData, celSrc: src, last: {} };
    toonOf.set(src, t);
  }
  // plain values: whichever side changed since the last frame wins
  const rec = t as unknown as Record<string, unknown>;
  const s = src as unknown as Record<string, unknown>;
  const last = t.userData.last;
  for (const k of KEYS) {
    if (!(k in s)) continue;
    if (k in last && rec[k] !== last[k]) s[k] = rec[k];
    else if (rec[k] !== s[k]) {
      if ((k === 'map' || k === 'transparent' || k === 'emissiveMap' || k === 'alphaMap') && Boolean(rec[k]) !== Boolean(s[k])) t.needsUpdate = true;
      rec[k] = s[k];
    }
    last[k] = rec[k];
  }
  return t;
}

const swap = (m: THREE.Material, on: boolean): THREE.Material => {
  const src = (m.userData as { celSrc?: Lit }).celSrc;
  if (!on) return src ?? m;
  if (src) return toonFor(src);
  return lit(m) ? toonFor(m) : m;
};

/** put a scene into (or back out of) the cel look; called each frame while it renders */
export function celify(root: THREE.Object3D, on = CEL.on) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    if (Array.isArray(mesh.material)) mesh.material = mesh.material.map((x) => swap(x, on));
    else mesh.material = swap(mesh.material, on);
  });
}
