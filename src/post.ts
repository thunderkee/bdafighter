import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { CEL } from './cel';

/** cel shading's ink: a dark line wherever the depth jumps (the edge of a shape) */
class InkPass extends Pass {
  private quad: FullScreenQuad;
  private mat: THREE.ShaderMaterial;
  constructor(private camera: THREE.PerspectiveCamera) {
    super();
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        texel: { value: new THREE.Vector2() },
        near: { value: 0.1 },
        far: { value: 100 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        #include <packing>
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform vec2 texel;
        uniform float near;
        uniform float far;
        varying vec2 vUv;
        float z(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, near, far); }
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          float zc = z(vUv);
          // the nearest neighbour decides: lines sit on the front shape's rim
          float zn = min(min(z(vUv + vec2(texel.x, 0.0)), z(vUv - vec2(texel.x, 0.0))), min(z(vUv + vec2(0.0, texel.y)), z(vUv - vec2(0.0, texel.y))));
          float jump = (zc - zn) / max(zn, 0.001);
          float ink = smoothstep(0.018, 0.05, jump) * (1.0 - smoothstep(30.0, 60.0, zn));
          gl_FragColor = vec4(mix(c.rgb, c.rgb * 0.12 + vec3(0.01, 0.01, 0.02), ink), c.a);
        }
      `,
    });
    this.quad = new FullScreenQuad(this.mat);
  }
  setSize(w: number, h: number) {
    // (w and h are device pixels: a line a little over three wide)
    this.mat.uniforms.texel.value.set(3.3 / w, 3.3 / h);
  }
  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    const u = this.mat.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    u.tDepth.value = readBuffer.depthTexture;
    u.near.value = this.camera.near;
    u.far.value = this.camera.far;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
  dispose() {
    this.mat.dispose();
    this.quad.dispose();
  }
}

/**
 * The film look, after the PS2-era Mirror's Edge: clean high-key whites, cool shadows,
 * warm highlights, a soft bloom haze on anything bright, a gentle vignette and fine grain.
 * Runs in linear HDR; the output pass tone-maps and converts to sRGB at the end.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    time: { value: 0 },
    aspect: { value: 1 },
    dim: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float aspect;
    uniform float dim;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      // split tone: cool, slightly cyan shadows and warm highlights
      vec3 shadowTint = vec3(0.93, 0.99, 1.07);
      vec3 highTint = vec3(1.04, 1.0, 0.95);
      col *= mix(shadowTint, highTint, smoothstep(0.05, 0.8, l));
      // a little more colour in the mids, the primaries popping off the clean surfaces
      col = mix(vec3(l), col, 1.1);
      // vignette, stronger while a charge shot is building
      vec2 q = (vUv - 0.5) * vec2(aspect, 1.0);
      float v = smoothstep(0.95, 0.25, length(q) * (1.0 + dim * 0.5));
      col *= mix(0.72 - dim * 0.25, 1.0, v);
      // fine animated grain
      float n = hash(vUv * vec2(1931.0, 1373.0) + fract(time) * 91.0) - 0.5;
      col += n * 0.018 * (0.4 + l);
      gl_FragColor = vec4(max(col, 0.0), c.a);
    }
  `,
};

export class Post {
  composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private grade: ShaderPass;
  private renderPass: RenderPass;
  private ink: InkPass;

  constructor(
    private renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4, depthTexture: new THREE.DepthTexture(size.x, size.y) });
    this.composer = new EffectComposer(renderer, target);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.ink = new InkPass(camera as THREE.PerspectiveCamera);
    this.composer.addPass(this.ink);
    // bloom runs at half resolution: only the bright parts (glows, flashes, sunlit white) haze
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.28, 0.45, 1.9);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  /** battery saver: no multisampling (the density does the smoothing) and a quarter-size bloom */
  private bloomDiv = 2;
  setLowPower(on: boolean) {
    const samples = on ? 0 : 4;
    for (const t of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      if (t.samples !== samples) {
        t.samples = samples;
        t.dispose();
      }
    }
    this.bloomDiv = on ? 4 : 2;
  }

  setSize(w: number, h: number) {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.bloom.resolution.set((w * this.renderer.getPixelRatio()) / this.bloomDiv, (h * this.renderer.getPixelRatio()) / this.bloomDiv);
    this.grade.uniforms.aspect.value = w / Math.max(1, h);
  }

  render(dt: number, dim: number) {
    this.grade.uniforms.time.value += dt;
    this.grade.uniforms.dim.value = dim;
    this.ink.enabled = CEL.on;
    this.composer.render(dt);
  }

  dispose() {
    this.composer.dispose();
  }
}
