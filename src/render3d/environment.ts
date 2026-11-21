// Implements SPEC §14.10 Stadium Environment Map Generator via PMREMGenerator
import * as THREE from 'three';
import { TimeSlot } from './types';
import { RENDER_CONFIG } from '../config/balance';

export interface StadiumEnvironment {
  envMap: THREE.WebGLRenderTarget;
  dispose: () => void;
}

/**
 * Builds a custom stadium PMREM environment map per SPEC §14.10 from a lightweight helper scene.
 * Lit by sky gradient, emissive floodlight quads, and dark ground disc.
 */
export function createStadiumEnvironment(
  renderer: THREE.WebGLRenderer,
  timeSlot: TimeSlot,
  floodlightPositions: THREE.Vector3[],
): StadiumEnvironment {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  const skyConfig = RENDER_CONFIG.timeSlots[timeSlot] ?? RENDER_CONFIG.timeSlots.night;

  // 1. Sky Gradient Sphere
  const skyGeom = new THREE.SphereGeometry(100, 16, 16);
  const skyMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(skyConfig.skyTop),
    side: THREE.BackSide,
  });
  const skyMesh = new THREE.Mesh(skyGeom, skyMat);
  envScene.add(skyMesh);

  // 2. Dark Ground Disc
  const groundGeom = new THREE.CircleGeometry(80, 16);
  const groundMat = new THREE.MeshBasicMaterial({
    color: 0x111612,
    side: THREE.DoubleSide,
  });
  const groundMesh = new THREE.Mesh(groundGeom, groundMat);
  groundMesh.rotateX(Math.PI / 2);
  envScene.add(groundMesh);

  // 3. Emissive Quads for Floodlight Banks
  const quadGeom = new THREE.PlaneGeometry(10, 10);
  const quadMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });

  const quadMeshes: THREE.Mesh[] = [];
  floodlightPositions.forEach((pos) => {
    const quad = new THREE.Mesh(quadGeom, quadMat);
    quad.position.copy(pos);
    quad.lookAt(0, 0, 0);
    envScene.add(quad);
    quadMeshes.push(quad);
  });

  // Generate the PMREM environment cubemap
  const envMap = pmremGenerator.fromScene(envScene, 0.04);

  // Clean up helper scene
  pmremGenerator.dispose();
  skyGeom.dispose();
  skyMat.dispose();
  groundGeom.dispose();
  groundMat.dispose();
  quadGeom.dispose();
  quadMat.dispose();

  return {
    envMap,
    dispose: () => {
      envMap.dispose();
    },
  };
}
