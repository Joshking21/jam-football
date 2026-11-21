// Implements SPEC §14.10 Match Post-Processing Pipeline
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { QualityPreset } from './types';
import { RENDER_CONFIG } from '../config/balance';

export interface PostPipeline {
  composer: EffectComposer;
  render: () => void;
  setSize: (width: number, height: number) => void;
  dispose: () => void;
}

/**
 * Creates the broadcast post-processing pipeline for Medium and High presets.
 * Returns null if preset is 'Low'.
 */
export function createPostPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
  quality: QualityPreset,
): PostPipeline | null {
  if (quality === 'Low') {
    return null;
  }

  // 1. HalfFloatType MSAA Render Target (WebGL2)
  const renderTarget = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    samples: 4,
    colorSpace: THREE.SRGBColorSpace,
  });

  const composer = new EffectComposer(renderer, renderTarget);

  // 2. Base Render Pass
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // 3. High Preset: GTAOPass for soft contact ambient occlusion
  let gtaoPass: GTAOPass | null = null;
  if (quality === 'High') {
    try {
      gtaoPass = new GTAOPass(scene, camera, width / 2, height / 2);
      gtaoPass.output = GTAOPass.OUTPUT.Default;
      composer.addPass(gtaoPass);
    } catch (e) {
      console.warn('GTAOPass initialization skipped:', e);
    }
  }

  // 4. UnrealBloomPass at half resolution (threshold 1.0 to isolate floodlights & emissive heads)
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width / 2, height / 2),
    0.55, // strength per §14.10
    0.35, // radius per §14.10
    1.0, // threshold per §14.10
  );
  composer.addPass(bloomPass);

  // 5. Custom GradePass (Lift, Gamma, Gain, Saturation, Contrast, Vignette per §14.10)
  const gradeCfg = RENDER_CONFIG.grade.night;
  const gradeShader = {
    uniforms: {
      tDiffuse: { value: null },
      lift: { value: gradeCfg.lift[0] },
      gamma: { value: gradeCfg.gamma },
      gain: { value: gradeCfg.gain[0] },
      saturation: { value: gradeCfg.saturation },
      contrast: { value: gradeCfg.contrast },
      vignette: { value: gradeCfg.vignetteStrength },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float lift;
      uniform float gamma;
      uniform float gain;
      uniform float saturation;
      uniform float contrast;
      uniform float vignette;
      varying vec2 vUv;

      void main() {
        vec4 color = texture2D(tDiffuse, vUv);

        // 1. Lift, Gamma, Gain
        vec3 rgb = color.rgb * gain + lift;
        rgb = pow(max(vec3(0.0), rgb), vec3(1.0 / max(0.01, gamma)));

        // 2. Contrast
        rgb = (rgb - 0.5) * contrast + 0.5;

        // 3. Saturation
        float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
        rgb = mix(vec3(luma), rgb, saturation);

        // 4. Vignette
        vec2 uv = (vUv - 0.5) * 2.0;
        float vig = 1.0 - dot(uv, uv) * vignette;
        rgb *= clamp(vig, 0.0, 1.0);

        gl_FragColor = vec4(rgb, color.a);
      }
    `,
  };

  const gradePass = new ShaderPass(gradeShader);
  composer.addPass(gradePass);

  // 6. Final OutputPass (ACESFilmic tone mapping + sRGB)
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  // Disable tone mapping on renderer so tone mapping occurs only once in composer
  renderer.toneMapping = THREE.NoToneMapping;

  return {
    composer,
    render: () => {
      composer.render();
    },
    setSize: (newW: number, newH: number) => {
      composer.setSize(newW, newH);
      bloomPass.setSize(newW / 2, newH / 2);
      if (gtaoPass) {
        gtaoPass.setSize(newW / 2, newH / 2);
      }
    },
    dispose: () => {
      renderTarget.dispose();
      bloomPass.dispose();
      gradePass.dispose();
      outputPass.dispose();
      if (gtaoPass) {
        gtaoPass.dispose();
      }
    },
  };
}
