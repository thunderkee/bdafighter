import * as THREE from 'three';

/**
 * Stage surfaces: real-world texture on every element of a stage (floor, rails, walls, props,
 * rocks, trees) without touching how each one was built.
 *
 * A handful of small tiling detail textures (stone, concrete, brushed metal, wood, moss, sand),
 * drawn once in greys and shared by everything. Each material keeps its own colour; the detail
 * multiplies it, lightening and darkening around it, so every theme keeps its palette.
 *
 * The detail is laid on triplanar in the shader (projected from the three axes in world space,
 * blended by the surface's facing), so it needs no texture coordinates, never stretches on a
 * sphere or a long rail, and sits at the same real size on a pebble and on a wall.
 *
 * Cost: one pass over the stage when it's built, a few 256 px textures for the whole game, and three
 * texture reads per pixel of a textured surface (cheap enough to stay on in Battery saver too).
 */
export type SurfaceKind = 'concrete' | 'stone' | 'metal' | 'wood' | 'moss' | 'sand';

/** how big the detail sits (repeats per metre) and how strongly it marks the colour */
const KIND: Record<SurfaceKind, { scale: number; gain: number }> = {
  concrete: { scale: 0.45, gain: 0.32 },
  stone: { scale: 0.6, gain: 0.5 },
  metal: { scale: 0.55, gain: 0.3 },
  wood: { scale: 0.7, gain: 0.42 },
  moss: { scale: 1.1, gain: 0.45 },
  sand: { scale: 0.9, gain: 0.3 },
};

let enabled = true;
/** the stages built from now on get their surfaces (on by default, Battery saver included) */
export const setSurfaces = (on: boolean) => {
  enabled = on;
};

// ---- the detail textures: tileable, in greys around mid grey ----

const N = 256;
/** a seeded random */
const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
/** tileable value noise: a grid of random values, smoothly interpolated, wrapping at the edge */
function noise(cells: number, seed: number) {
  const r = rng(seed);
  const g = Array.from({ length: cells * cells }, () => r());
  const at = (i: number, j: number) => g[((j % cells) + cells) % cells * cells + (((i % cells) + cells) % cells)];
  const sm = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const fx = (x / N) * cells;
    const fy = (y / N) * cells;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const u = sm(fx - i);
    const v = sm(fy - j);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * u;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * u;
    return a + (b - a) * v;
  };
}
/** several octaves of noise, summed (0..1) */
function fbm(octaves: number[], seed: number) {
  const ns = octaves.map((c, k) => noise(c, seed + k * 101));
  return (x: number, y: number) => {
    let s = 0;
    let w = 0;
    ns.forEach((n, k) => {
      const a = 1 / (k + 1);
      s += n(x, y) * a;
      w += a;
    });
    return s / w;
  };
}

function paint(kind: SurfaceKind): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const img = g.createImageData(N, N);
  const d = img.data;
  const put = (x: number, y: number, v: number) => {
    const k = (y * N + x) * 4;
    const b = Math.max(0, Math.min(255, Math.round(v * 255)));
    d[k] = d[k + 1] = d[k + 2] = b;
    d[k + 3] = 255;
  };
  const r = rng(kind.length * 977 + 13);
  if (kind === 'concrete' || kind === 'sand') {
    const f = fbm(kind === 'sand' ? [32, 64, 128] : [4, 8, 16, 32, 64], 7);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) put(x, y, 0.5 + (f(x, y) - 0.5) * 0.9 + (r() - 0.5) * (kind === 'sand' ? 0.35 : 0.12));
  } else if (kind === 'stone') {
    const f = fbm([3, 6, 12, 24, 48], 19);
    const v = noise(5, 41);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        // blotches, with veins where the coarse noise crosses its middle
        const vein = Math.abs(v(x, y) - 0.5) < 0.018 ? -0.25 : 0;
        put(x, y, 0.5 + (f(x, y) - 0.5) * 1.1 + vein + (r() - 0.5) * 0.08);
      }
  } else if (kind === 'metal') {
    const f = fbm([2, 4], 23);
    // brushed: streaks along x, each row its own shade
    const rows = Array.from({ length: N }, () => (r() - 0.5) * 0.12);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) put(x, y, 0.52 + rows[y] + (f(x, y) - 0.5) * 0.35 + (r() - 0.5) * 0.05);
    g.putImageData(img, 0, 0);
    // panel seams (a dark line, a lit edge) every half tile, and a rivet at each corner
    for (const p of [0, N / 2]) {
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(p, 0, 2, N);
      g.fillRect(0, p, N, 2);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(p + 2, 0, 1, N);
      g.fillRect(0, p + 2, N, 1);
    }
    for (const [x, y] of [[8, 8], [N / 2 - 10, 8], [N / 2 + 8, 8], [N - 10, 8], [8, N / 2 + 8], [N - 10, N / 2 + 8], [8, N / 2 - 10], [N - 10, N / 2 - 10]]) {
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(x, y, 3, 3);
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(x, y, 1, 1);
    }
    return c;
  } else if (kind === 'wood') {
    const f = fbm([3, 6, 24], 31);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        // grain running along x, warped by noise, plank seams every quarter
        const ring = Math.sin((y / N) * Math.PI * 2 * 9 + f(x, y) * 7);
        const seam = y % (N / 4) < 2 ? -0.35 : 0;
        put(x, y, 0.5 + ring * 0.16 + (f(x, y) - 0.5) * 0.4 + seam + (r() - 0.5) * 0.05);
      }
  } else if (kind === 'moss') {
    const f = fbm([8, 16, 64, 128], 47);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) put(x, y, 0.5 + (f(x, y) - 0.5) * 1.2 + (r() - 0.5) * 0.3);
  }
  g.putImageData(img, 0, 0);
  return c;
}

const textures = new Map<SurfaceKind, THREE.Texture>();
function detail(kind: SurfaceKind) {
  let t = textures.get(kind);
  if (!t) {
    t = new THREE.CanvasTexture(paint(kind));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    // (a detail map: its greys are a multiplier, read as they are)
    t.colorSpace = THREE.NoColorSpace;
    textures.set(kind, t);
  }
  return t;
}

/** which surface a material reads as, from what it is and its colour */
function kindOf(m: THREE.Material & { color?: THREE.Color; flatShading?: boolean; shininess?: number; map?: THREE.Texture | null }): SurfaceKind {
  if (m.map) return 'concrete';
  if (m.flatShading) return 'stone';
  if ((m.shininess ?? 0) >= 60) return 'metal';
  if (!m.color) return 'concrete';
  const hsl = m.color.getHSL({ h: 0, s: 0, l: 0 });
  const hue = hsl.h * 360;
  if (hue >= 18 && hue <= 42 && hsl.s > 0.25 && hsl.l < 0.45) return 'wood';
  if (hue >= 70 && hue <= 165 && hsl.s > 0.22) return 'moss';
  if (hue >= 35 && hue <= 60 && hsl.l > 0.62 && hsl.s > 0.2) return 'sand';
  if (hsl.s < 0.12 && hsl.l < 0.4) return 'metal';
  return 'concrete';
}

/** adds the triplanar detail to a material's shader (its colour, lighting and maps stay as they are) */
function surface(mat: THREE.Material, kind: SurfaceKind, soft: boolean) {
  const k = KIND[kind];
  const uniforms = { uTriMap: { value: detail(kind) }, uTriScale: { value: k.scale }, uTriGain: { value: soft ? k.gain * 0.5 : k.gain } };
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriN;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 triP = vec4( transformed, 1.0 );
        vec3 triN = objectNormal;
        #ifdef USE_INSTANCING
          triP = instanceMatrix * triP;
          triN = mat3( instanceMatrix ) * triN;
        #endif
        vTriPos = ( modelMatrix * triP ).xyz;
        vTriN = normalize( mat3( modelMatrix ) * triN );`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriN;\nuniform sampler2D uTriMap;\nuniform float uTriScale;\nuniform float uTriGain;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec3 tw = pow( abs( normalize( vTriN ) ), vec3( 4.0 ) );
          tw /= ( tw.x + tw.y + tw.z );
          vec3 tp = vTriPos * uTriScale;
          float td = texture2D( uTriMap, tp.zy ).r * tw.x + texture2D( uTriMap, tp.xz ).r * tw.y + texture2D( uTriMap, tp.xy ).r * tw.z;
          diffuseColor.rgb *= 1.0 + ( td - 0.5 ) * 2.0 * uTriGain;
        }`,
      );
  };
  // (one program for every material of this make: the detail differs only by uniforms)
  mat.customProgramCacheKey = () => `surface|${prev ? prev.toString().length : 0}`;
  mat.needsUpdate = true;
}

/**
 * gives every lit, solid material under `root` its real surface. Glows, glass, water and anything
 * see-through keep their look. A material shared by many meshes is done once.
 */
export function texturize(root: THREE.Object3D) {
  if (!enabled) return;
  const done = new Set<THREE.Material>();
  // (a fighter standing on the stage, a fort's gunner, keeps its own armour: its subtree is skipped)
  const walk = (o: THREE.Object3D, visit: (o: THREE.Object3D) => void) => {
    if (o.userData.path === 'r') return;
    visit(o);
    for (const c of o.children) walk(c, visit);
  };
  walk(root, (o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (done.has(mat)) continue;
      done.add(mat);
      const m = mat as THREE.MeshLambertMaterial & { shininess?: number };
      if (!(m.isMeshLambertMaterial || (m as unknown as THREE.MeshPhongMaterial).isMeshPhongMaterial || (m as unknown as THREE.MeshStandardMaterial).isMeshStandardMaterial)) continue;
      if (m.transparent || m.blending !== THREE.NormalBlending || m.userData.noSurface) continue;
      // (a painted floor or sign keeps its picture: the grit goes over it, softly)
      surface(m, kindOf(m), !!m.map);
    }
  });
}
