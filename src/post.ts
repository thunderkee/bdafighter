import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

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

  constructor(
    private renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    // bloom runs at half resolution: only the bright parts (glows, flashes, sunlit white) haze
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.28, 0.45, 1.9);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  setSize(w: number, h: number) {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.bloom.resolution.set((w * this.renderer.getPixelRatio()) / 2, (h * this.renderer.getPixelRatio()) / 2);
    this.grade.uniforms.aspect.value = w / Math.max(1, h);
  }

  render(dt: number, dim: number) {
    this.grade.uniforms.time.value += dt;
    this.grade.uniforms.dim.value = dim;
    this.composer.render(dt);
  }

  dispose() {
    this.composer.dispose();
  }
}
