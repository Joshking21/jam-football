// Implements SPEC §14.4 3D Match Camera Controller (Broadcast, Tactical, Player, Free Orbit)
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CameraMode } from './types';

export interface CameraBundle {
  camera: THREE.PerspectiveCamera;
  controls?: OrbitControls;
  getMode: () => CameraMode;
  setMode: (mode: CameraMode) => void;
  cycleMode: () => CameraMode;
  update: (delta: number, ballPos: THREE.Vector3, activePlayerPos?: THREE.Vector3) => void;
  handleResize: (width: number, height: number) => void;
  dispose: () => void;
}

export function createCameras(domElement: HTMLElement, aspectRatio: number): CameraBundle {
  const camera = new THREE.PerspectiveCamera(36, aspectRatio, 0.5, 350);

  let currentMode: CameraMode = 'broadcast';
  const lookTarget = new THREE.Vector3(0, 0, 0);
  const currentPos = new THREE.Vector3(0, 22, -62);
  camera.position.copy(currentPos);
  camera.lookAt(lookTarget);

  // Initialize OrbitControls for Free Orbit mode
  const controls = new OrbitControls(camera, domElement);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 8;
  controls.maxDistance = 140;
  controls.maxPolarAngle = (85 * Math.PI) / 180; // Never under the ground plane

  const modes: CameraMode[] = ['broadcast', 'tactical', 'player', 'orbit'];

  const setMode = (newMode: CameraMode) => {
    currentMode = newMode;
    controls.enabled = newMode === 'orbit';
    if (newMode === 'orbit') {
      controls.target.copy(lookTarget);
    }
  };

  const cycleMode = (): CameraMode => {
    const nextIdx = (modes.indexOf(currentMode) + 1) % modes.length;
    const nextMode = modes[nextIdx] ?? 'broadcast';
    setMode(nextMode);
    return currentMode;
  };

  return {
    camera,
    controls,
    getMode: () => currentMode,
    setMode,
    cycleMode,
    update: (delta: number, ballPos: THREE.Vector3, activePlayerPos?: THREE.Vector3) => {
      if (currentMode === 'orbit') {
        controls.update();
        return;
      }

      const targetCamPos = new THREE.Vector3();
      const targetLook = new THREE.Vector3();

      if (currentMode === 'broadcast') {
        // Broadcast mode (SPEC §14.4): (x = ball.x * 0.85, y = 22, z = -62)
        targetCamPos.set(ballPos.x * 0.85, 22, -62);
        targetLook.copy(ballPos);

        // Zoom in when ball is in the penalty area (|x| > 36 and |z| < 20)
        const inBox = Math.abs(ballPos.x) > 36 && Math.abs(ballPos.z) < 20;
        const targetFOV = inBox ? 32 : 38;
        camera.fov += (targetFOV - camera.fov) * Math.min(1, delta * 3.5);
        camera.updateProjectionMatrix();
      } else if (currentMode === 'tactical') {
        // Tactical top-down view (x = 0, y = 75, z = 0, pitched 65 deg)
        targetCamPos.set(ballPos.x * 0.25, 72, -32);
        targetLook.set(ballPos.x * 0.25, 0, 0);
        camera.fov = 48;
        camera.updateProjectionMatrix();
      } else if (currentMode === 'player') {
        // Player cam: follows ball carrier from 12m behind, 5m up
        const focus = activePlayerPos || ballPos;
        targetCamPos.set(focus.x, focus.y + 5.5, focus.z - 12);
        targetLook.set(focus.x, focus.y + 1.2, focus.z + 4);
        camera.fov = 50;
        camera.updateProjectionMatrix();
      }

      // Smooth camera damping (0.08 smoothing factor per SPEC §14.4)
      const dampFactor = Math.min(1, delta * 8.0);
      currentPos.lerp(targetCamPos, dampFactor);
      lookTarget.lerp(targetLook, dampFactor);

      camera.position.copy(currentPos);
      camera.lookAt(lookTarget);
    },
    handleResize: (width: number, height: number) => {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    dispose: () => {
      controls.dispose();
    },
  };
}
