// SPEC §11.25.4 Look around (the player controls the camera)
import * as THREE from 'three';
import type { RoomDefinition, CameraRail, Point3D } from './types';
import { CLUB3D_CONFIG } from '../config/balance';

export interface LookAroundState {
  isHolding: boolean;
  yawDeg: number; // ±60°
  pitchDeg: number; // -20° to +15°
  leanM: number; // 0 to 1.5m
  springT: number; // 0 to 1
  isEasingBack: boolean;
}

export class LookAroundController {
  public state: LookAroundState = {
    isHolding: false,
    yawDeg: 0,
    pitchDeg: 0,
    leanM: 0,
    springT: 1,
    isEasingBack: false,
  };

  private currentRail: CameraRail | null = null;
  private currentRoom: RoomDefinition | null = null;
  private shownHints = new Set<string>();
  private activeHint: { text: string; timer: number } | null = null;
  private onPanelFadeChange?: (fade: boolean) => void;

  public setCallbacks(onPanelFadeChange?: (fade: boolean) => void) {
    this.onPanelFadeChange = onPanelFadeChange;
  }

  public setRoom(room: RoomDefinition) {
    this.currentRoom = room;
    this.currentRail = room.cameraRail;
    this.reset(true);

    if (!this.shownHints.has(room.id)) {
      this.shownHints.add(room.id);
      this.activeHint = {
        text: 'Right-drag to look around',
        timer: 4.0,
      };
    }
  }

  public getActiveHint(): string | null {
    return this.activeHint ? this.activeHint.text : null;
  }

  public reset(instant = false) {
    if (instant) {
      this.state.yawDeg = 0;
      this.state.pitchDeg = 0;
      this.state.leanM = 0;
      this.state.isHolding = false;
      this.state.isEasingBack = false;
      this.state.springT = 1;
      if (this.onPanelFadeChange) this.onPanelFadeChange(false);
    } else {
      this.state.isHolding = false;
      this.state.isEasingBack = true;
      this.state.springT = 0;
      if (this.onPanelFadeChange) this.onPanelFadeChange(false);
    }
  }

  public onMouseDown(button: number) {
    if (button === 2) {
      // Right mouse button
      this.state.isHolding = true;
      this.state.isEasingBack = false;
      if (this.onPanelFadeChange) this.onPanelFadeChange(true);
    }
  }

  public onMouseUp(button: number, reducedMotion = false) {
    if (button === 2) {
      this.reset(reducedMotion);
    }
  }

  public onMouseMove(dx: number, dy: number) {
    if (!this.state.isHolding) return;
    const sens = 0.25;
    this.state.yawDeg = THREE.MathUtils.clamp(
      this.state.yawDeg - dx * sens,
      -CLUB3D_CONFIG.lookAroundYawMaxDeg,
      CLUB3D_CONFIG.lookAroundYawMaxDeg,
    );
    this.state.pitchDeg = THREE.MathUtils.clamp(
      this.state.pitchDeg - dy * sens,
      CLUB3D_CONFIG.lookAroundPitchMinDeg,
      CLUB3D_CONFIG.lookAroundPitchMaxDeg,
    );
  }

  public onWheel(deltaY: number) {
    if (!this.state.isHolding) return;
    const leanSens = 0.002;
    this.state.leanM = THREE.MathUtils.clamp(
      this.state.leanM - deltaY * leanSens,
      -CLUB3D_CONFIG.lookAroundLeanMaxM,
      CLUB3D_CONFIG.lookAroundLeanMaxM,
    );
  }

  public onKeyDown(e: KeyboardEvent, reducedMotion = false) {
    if (!e.shiftKey) return;
    const stepDeg = 4;
    const stepLean = 0.1;

    if (e.key === 'ArrowLeft') {
      this.state.yawDeg = Math.min(CLUB3D_CONFIG.lookAroundYawMaxDeg, this.state.yawDeg + stepDeg);
      this.triggerHold();
    } else if (e.key === 'ArrowRight') {
      this.state.yawDeg = Math.max(-CLUB3D_CONFIG.lookAroundYawMaxDeg, this.state.yawDeg - stepDeg);
      this.triggerHold();
    } else if (e.key === 'ArrowUp') {
      this.state.pitchDeg = Math.min(
        CLUB3D_CONFIG.lookAroundPitchMaxDeg,
        this.state.pitchDeg + stepDeg,
      );
      this.triggerHold();
    } else if (e.key === 'ArrowDown') {
      this.state.pitchDeg = Math.max(
        CLUB3D_CONFIG.lookAroundPitchMinDeg,
        this.state.pitchDeg - stepDeg,
      );
      this.triggerHold();
    } else if (e.key === '+' || e.key === '=') {
      this.state.leanM = Math.min(CLUB3D_CONFIG.lookAroundLeanMaxM, this.state.leanM + stepLean);
      this.triggerHold();
    } else if (e.key === '-' || e.key === '_') {
      this.state.leanM = Math.max(-CLUB3D_CONFIG.lookAroundLeanMaxM, this.state.leanM - stepLean);
      this.triggerHold();
    }
  }

  private triggerHold() {
    this.state.isHolding = true;
    this.state.isEasingBack = false;
    if (this.onPanelFadeChange) this.onPanelFadeChange(true);
  }

  public update(dt: number, camera: THREE.PerspectiveCamera, headPositions: Point3D[] = []) {
    if (this.activeHint) {
      this.activeHint.timer -= dt;
      if (this.activeHint.timer <= 0) {
        this.activeHint = null;
      }
    }

    if (!this.currentRail || !this.currentRoom) return;

    if (this.state.isEasingBack) {
      const springSpeed = 1000 / CLUB3D_CONFIG.cameraRailSpringMs;
      this.state.springT += dt * springSpeed;
      const ease = 1 - Math.exp(-6 * dt);
      this.state.yawDeg = THREE.MathUtils.lerp(this.state.yawDeg, 0, ease);
      this.state.pitchDeg = THREE.MathUtils.lerp(this.state.pitchDeg, 0, ease);
      this.state.leanM = THREE.MathUtils.lerp(this.state.leanM, 0, ease);

      if (
        Math.abs(this.state.yawDeg) < 0.1 &&
        Math.abs(this.state.pitchDeg) < 0.1 &&
        Math.abs(this.state.leanM) < 0.01
      ) {
        this.reset(true);
      }
    }

    // Compute modified camera position and target
    const basePos = new THREE.Vector3(...this.currentRail.position);
    const baseTarget = new THREE.Vector3(...this.currentRail.target);

    const viewDir = new THREE.Vector3().subVectors(baseTarget, basePos).normalize();
    const right = new THREE.Vector3().crossVectors(viewDir, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, viewDir).normalize();

    // Yaw and pitch rotation
    const rotEuler = new THREE.Euler(
      (this.state.pitchDeg * Math.PI) / 180,
      (this.state.yawDeg * Math.PI) / 180,
      0,
      'YXZ',
    );
    const rotatedDir = viewDir.clone().applyEuler(rotEuler);

    // Lean along view direction
    const eyePos = basePos.clone().addScaledVector(rotatedDir, this.state.leanM);

    // Wall margin clamp against room bounds (§11.25.4)
    const b = this.currentRoom.bounds;
    const margin = CLUB3D_CONFIG.cameraWallMargin;
    eyePos.x = THREE.MathUtils.clamp(eyePos.x, b.min[0] + margin, b.max[0] - margin);
    eyePos.y = THREE.MathUtils.clamp(eyePos.y, b.min[1] + margin, b.max[1] - margin);
    eyePos.z = THREE.MathUtils.clamp(eyePos.z, b.min[2] + margin, b.max[2] - margin);

    // Minimum distance of 1.2m to any person's head (§14.11.8)
    for (const head of headPositions) {
      const hVec = new THREE.Vector3(...head);
      const d = eyePos.distanceTo(hVec);
      if (d < CLUB3D_CONFIG.cameraMinHeadDist) {
        const pushDir = eyePos.clone().sub(hVec).normalize();
        eyePos.copy(hVec).addScaledVector(pushDir, CLUB3D_CONFIG.cameraMinHeadDist);
      }
    }

    const eyeTarget = eyePos.clone().add(rotatedDir);

    camera.position.copy(eyePos);
    camera.lookAt(eyeTarget);
    camera.fov = this.currentRail.fov;
    camera.updateProjectionMatrix();
  }

  public isLooking(): boolean {
    return (
      this.state.isHolding ||
      Math.abs(this.state.yawDeg) > 0.5 ||
      Math.abs(this.state.pitchDeg) > 0.5
    );
  }
}
