// Implements SPEC §14.4 3D Match Camera Controller (Broadcast, Tactical, Player, Free Orbit)
// v1.8: the broadcast shot is tighter (about a third of the pitch, like TV), it never pans past
// the penalty areas into the end stands, and goal replays get a low behind-goal camera (§14.7).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CameraMode } from './types';
import { CAMERA } from '../config/render3d';

export interface CameraBundle {
  camera: THREE.PerspectiveCamera;
  controls?: OrbitControls;
  getMode: () => CameraMode;
  setMode: (mode: CameraMode) => void;
  cycleMode: () => CameraMode;
  setReplay: (on: boolean, attackingGoalX: number) => void;
  update: (delta: number, ballPos: THREE.Vector3, activePlayerPos?: THREE.Vector3) => void;
  handleResize: (width: number, height: number) => void;
  dispose: () => void;
}

export function createCameras(domElement: HTMLElement, aspectRatio: number): CameraBundle {
  const B = CAMERA.broadcast;
  const camera = new THREE.PerspectiveCamera(B.fov, aspectRatio, 0.5, 400);

  let currentMode: CameraMode = 'broadcast';
  let replayOn = false;
  let replayGoalX = 52.5;
  const lookTarget = new THREE.Vector3(0, 0, 0);
  const currentPos = new THREE.Vector3(0, B.height, -B.distance);
  const targetCamPos = new THREE.Vector3();
  const targetLook = new THREE.Vector3();
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

  const setFov = (fov: number, delta: number) => {
    const next = camera.fov + (fov - camera.fov) * Math.min(1, delta * 3.5);
    if (Math.abs(next - camera.fov) > 0.01) {
      camera.fov = next;
      camera.updateProjectionMatrix();
    }
  };

  return {
    camera,
    controls,
    getMode: () => currentMode,
    setMode,
    cycleMode,
    setReplay: (on: boolean, attackingGoalX: number) => {
      if (on && !replayOn) {
        // Cut, don't glide, into the replay angle.
        replayGoalX = attackingGoalX;
        const R = CAMERA.replay;
        const dir = Math.sign(replayGoalX) || 1;
        currentPos.set(replayGoalX + dir * R.behindGoal, R.height, R.side);
        lookTarget.set(replayGoalX - dir * 12, 1, 0);
      }
      replayOn = on;
    },
    update: (delta: number, ballPos: THREE.Vector3, activePlayerPos?: THREE.Vector3) => {
      if (currentMode === 'orbit' && !replayOn) {
        controls.update();
        return;
      }

      let damp = Math.min(1, delta * 4.0);

      if (replayOn) {
        // Low behind-goal camera, slightly off-centre, tracking the ball (§14.7).
        const R = CAMERA.replay;
        const dir = Math.sign(replayGoalX) || 1;
        targetCamPos.set(replayGoalX + dir * R.behindGoal, R.height, R.side + ballPos.z * 0.25);
        targetLook.set(ballPos.x, Math.max(0.6, ballPos.y * 0.6), ballPos.z);
        setFov(R.fov, delta * 3);
        damp = Math.min(1, delta * 6.0);
      } else if (currentMode === 'broadcast') {
        // Main TV camera on the near side, panning with the ball. It stops at the penalty areas
        // so the end stands never fill the frame.
        const camX = THREE.MathUtils.clamp(ballPos.x * B.followX, -B.maxX, B.maxX);
        targetCamPos.set(camX, B.height, -B.distance);
        targetLook.set(
          THREE.MathUtils.clamp(ballPos.x, -46, 46),
          0,
          THREE.MathUtils.clamp(ballPos.z * 0.75, -24, 24),
        );
        const inBox = Math.abs(ballPos.x) > 36 && Math.abs(ballPos.z) < 20;
        setFov(inBox ? B.fovBox : B.fov, delta);
      } else if (currentMode === 'tactical') {
        // Tactical: high, whole pitch visible.
        targetCamPos.set(ballPos.x * 0.25, 72, -32);
        targetLook.set(ballPos.x * 0.25, 0, 0);
        setFov(48, 10);
      } else if (currentMode === 'player') {
        // Player cam: follows the ball carrier from 12 m behind, 5 m up.
        const focus = activePlayerPos || ballPos;
        targetCamPos.set(focus.x, focus.y + 5.5, focus.z - 12);
        targetLook.set(focus.x, focus.y + 1.2, focus.z + 4);
        setFov(50, 10);
      }

      currentPos.lerp(targetCamPos, damp);
      lookTarget.lerp(targetLook, damp);

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
