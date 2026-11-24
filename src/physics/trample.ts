// §14.12.6 Grass that reacts: a trample map and a wear map over the pitch.
// Every frame, feet and the rolling ball stamp soft marks into a small render target; the marks
// fade with a half-life (the grass springs back). The pitch shader reads it: flattened grass shows
// its lighter side, so footpaths and the ball's track are visible even from the TV camera. Slides,
// falls and heavy traffic also stamp a permanent wear map that darkens the turf (goalmouths wear in).
import * as THREE from 'three';
import type { QualityPreset } from '../render3d/types';

const HALF_W = 57.5; // pitch mesh is 115 × 78 (with run-off)
const HALF_H = 39;

export interface TrampleStamp {
  x: number;
  z: number;
  r: number;
  s: number; // strength this frame
  wear?: number; // permanent wear this frame
}

function softDot(): THREE.CanvasTexture | THREE.DataTexture {
  const n = 32;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (x + 0.5) / n - 0.5;
      const dy = (y + 0.5) / n - 0.5;
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2);
      const v = Math.round(255 * Math.pow(1 - d, 2));
      const i = (y * n + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
}

class StampLayer {
  public rt: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private stamps: THREE.InstancedMesh;
  private fade: THREE.Mesh | null = null;
  private fadeMat: THREE.MeshBasicMaterial | null = null;
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();
  private cleared = false;

  constructor(
    w: number,
    h: number,
    dot: THREE.Texture,
    private halfLife: number | null,
  ) {
    this.rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
    });
    const quad = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: dot,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    this.stamps = new THREE.InstancedMesh(quad, mat, 96);
    this.stamps.count = 0;
    this.stamps.frustumCulled = false;
    this.scene.add(this.stamps);
    if (halfLife !== null) {
      // Fade pass: dst = dst * k (custom blend), drawn before the stamps.
      this.fadeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.ZeroFactor,
        blendDst: THREE.SrcColorFactor,
        depthTest: false,
        depthWrite: false,
      });
      this.fade = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, HALF_H * 2), this.fadeMat);
      this.fade.renderOrder = -1;
      this.scene.add(this.fade);
    }
  }

  render(
    renderer: THREE.WebGLRenderer,
    cam: THREE.Camera,
    dt: number,
    list: TrampleStamp[],
    pick: (s: TrampleStamp) => number,
  ) {
    let n = 0;
    for (const s of list) {
      const v = pick(s);
      if (v <= 0 || n >= 96) continue;
      this.dummy.position.set(s.x, s.z, 0);
      this.dummy.scale.set(s.r * 2, s.r * 2, 1);
      this.dummy.updateMatrix();
      this.stamps.setMatrixAt(n, this.dummy.matrix);
      this.stamps.setColorAt(n, this.color.setScalar(v));
      n++;
    }
    this.stamps.count = n;
    this.stamps.instanceMatrix.needsUpdate = true;
    if (this.stamps.instanceColor) this.stamps.instanceColor.needsUpdate = true;
    if (this.fadeMat && this.halfLife)
      this.fadeMat.color.setScalar(Math.exp((-dt * Math.LN2) / this.halfLife));

    const prevTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    renderer.setRenderTarget(this.rt);
    if (!this.cleared) {
      const prevColor = renderer.getClearColor(new THREE.Color());
      const prevAlpha = renderer.getClearAlpha();
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, false, false);
      renderer.setClearColor(prevColor, prevAlpha);
      this.cleared = true;
    }
    renderer.autoClear = false;
    renderer.render(this.scene, cam);
    renderer.autoClear = prevAutoClear;
    renderer.setRenderTarget(prevTarget);
  }

  dispose() {
    this.rt.dispose();
    this.stamps.geometry.dispose();
    (this.stamps.material as THREE.Material).dispose();
    this.fade?.geometry.dispose();
    this.fadeMat?.dispose();
  }
}

export class GrassTrample {
  private cam = new THREE.OrthographicCamera(-HALF_W, HALF_W, HALF_H, -HALF_H, -1, 1);
  private dot = softDot();
  private trample: StampLayer;
  private wear: StampLayer;
  public readonly uniforms = {
    uTrample: { value: null as THREE.Texture | null },
    uWear: { value: null as THREE.Texture | null },
  };

  constructor(quality: QualityPreset, wet: boolean) {
    const [w, h] =
      quality === 'High' ? [1024, 640] : quality === 'Medium' ? [512, 320] : [256, 160];
    this.trample = new StampLayer(w, h, this.dot, wet ? 9 : 4);
    this.wear = new StampLayer(
      quality === 'Low' ? 512 : 1024,
      quality === 'Low' ? 320 : 640,
      this.dot,
      null,
    );
    this.uniforms.uTrample.value = this.trample.rt.texture;
    this.uniforms.uWear.value = this.wear.rt.texture;
  }

  /** Hooks the maps into the pitch material. */
  attach(material: THREE.MeshStandardMaterial, wet: boolean) {
    const u = this.uniforms;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTrample = u.uTrample;
      shader.uniforms.uWear = u.uWear;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vTrUv;')
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vec4 trWp = modelMatrix * vec4(transformed, 1.0);
          vTrUv = vec2((trWp.x + ${HALF_W.toFixed(1)}) / ${(HALF_W * 2).toFixed(1)}, (trWp.z + ${HALF_H.toFixed(1)}) / ${(HALF_H * 2).toFixed(1)});`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform sampler2D uTrample;\nuniform sampler2D uWear;\nvarying vec2 vTrUv;',
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          float trA = clamp(texture2D(uTrample, vTrUv).r, 0.0, 1.0);
          float wrA = clamp(texture2D(uWear, vTrUv).r, 0.0, 1.0);
          // Flattened grass shows its lighter, shinier side; worn turf goes dark and earthy.
          diffuseColor.rgb *= 1.0 + 0.16 * trA;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.72, 0.6), wrA * ${wet ? '0.75' : '0.55'});`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          roughnessFactor *= 1.0 - 0.18 * trA;`,
        );
    };
    material.needsUpdate = true;
  }

  update(renderer: THREE.WebGLRenderer, dt: number, stamps: TrampleStamp[]) {
    this.trample.render(renderer, this.cam, dt, stamps, (s) => s.s);
    this.wear.render(renderer, this.cam, dt, stamps, (s) => s.wear ?? 0);
  }

  dispose() {
    this.trample.dispose();
    this.wear.dispose();
    this.dot.dispose();
  }
}
