// Implements SPEC §14.10 Floodlight Volumetric Beams & Glare Sprites
import * as THREE from 'three';
import { WeatherType } from './types';
import { RENDER_CONFIG } from '../config/balance';
import { createSafeCanvas } from './canvasHelper';

export interface FloodlightBeams {
  group: THREE.Group;
  dispose: () => void;
}

/**
 * Creates subtle volumetric light cones from the 4 floodlight towers toward the pitch.
 * Medium & High quality only, Night and Evening only.
 */
export function createFloodlightBeams(
  towerPositions: THREE.Vector3[],
  weather: WeatherType,
): FloodlightBeams {
  const group = new THREE.Group();
  const isRain = weather === 'rain';
  const baseOpacity = isRain ? 0.09 : 0.05;

  // Custom vertex & fragment shader for volumetric cone
  const coneVertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const coneFragmentShader = `
    uniform vec3 color;
    uniform float opacity;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;

    void main() {
      // Fade along length of cone (vUv.y: 0 at top, 1 at base)
      float lengthFade = pow(1.0 - vUv.y, 1.5);

      // Fresnel silhouette edge fade
      vec3 viewDir = normalize(-vPosition);
      float fresnel = pow(abs(dot(vNormal, viewDir)), 0.6);

      float alpha = opacity * lengthFade * fresnel;
      gl_FragColor = vec4(color, alpha);
    }
  `;

  const coneGeom = new THREE.ConeGeometry(16, 85, 32, 1, true);
  // Center cone pivot at apex
  coneGeom.translate(0, -42.5, 0);

  const materials: THREE.ShaderMaterial[] = [];
  const sprites: THREE.Sprite[] = [];

  // Glare sprite texture
  const glareCanvas = createSafeCanvas(128, 128);
  const ctx = glareCanvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 255, 230, 1.0)');
    grad.addColorStop(0.2, 'rgba(255, 240, 200, 0.6)');
    grad.addColorStop(0.5, 'rgba(240, 210, 160, 0.2)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const glareTexture = new THREE.CanvasTexture(glareCanvas);

  towerPositions.forEach((pos) => {
    const tx = pos.x;
    const ty = pos.y;
    const tz = pos.z;

    // 1. Volumetric Light Cone
    const mat = new THREE.ShaderMaterial({
      vertexShader: coneVertexShader,
      fragmentShader: coneFragmentShader,
      uniforms: {
        color: { value: new THREE.Color(0xfff3d6) },
        opacity: { value: baseOpacity },
      },
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
    });
    materials.push(mat);

    const cone = new THREE.Mesh(coneGeom, mat);
    cone.position.set(tx, ty, tz);

    // Aim cone toward center quadrant of pitch
    const target = new THREE.Vector3(tx * 0.2, 0, tz * 0.2);
    cone.lookAt(target);
    cone.rotateX(-Math.PI / 2); // align cone axis
    group.add(cone);

    // 2. Camera-facing Glare Sprite at lamp bank
    const spriteMat = new THREE.SpriteMaterial({
      map: glareTexture,
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.85,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(tx, ty, tz);
    sprite.scale.set(12, 12, 1);
    sprites.push(sprite);
    group.add(sprite);
  });

  return {
    group,
    dispose: () => {
      coneGeom.dispose();
      materials.forEach((m) => m.dispose());
      glareTexture.dispose();
      sprites.forEach((s) => s.material.dispose());
    },
  };
}
