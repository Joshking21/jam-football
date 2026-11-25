// SPEC §11.25.2 Moving between rooms (walk.ts)
import * as THREE from 'three';
import type { Point3D, RoomId } from './types';
import { CLUB3D_CONFIG } from '../config/balance';
import { findNavPath, getWalkDuration, ROOM_KEY_NODES } from './nav';
import { ROOM_DEFINITIONS } from './rooms';
import { loadRapier } from '../physics/matchPhysics';
import type RAPIERNS from '@dimforge/rapier3d-compat';

export interface WalkState {
  active: boolean;
  fromRoom: RoomId;
  toRoom: RoomId;
  path: Point3D[];
  totalDuration: number;
  elapsed: number;
  currentPos: Point3D;
  currentFacing: number; // yaw in radians
  onComplete?: () => void;
}

export class CoachWalkController {
  private state: WalkState | null = null;
  private rapierWorld: RAPIERNS.World | null = null;
  private characterController: RAPIERNS.KinematicCharacterController | null = null;
  private coachCollider: RAPIERNS.Collider | null = null;
  private coachBody: RAPIERNS.RigidBody | null = null;
  private coachMesh: THREE.Group | null = null;

  constructor() {
    this.initPhysics();
  }

  private async initPhysics() {
    const R = await loadRapier();
    if (!R) return;

    this.rapierWorld = new R.World({ x: 0, y: -9.81, z: 0 });
    // Rapier KinematicCharacterController (§14.12.7)
    // capsule r 0.28 and height 1.78 (half-height 0.61, radius 0.28), max step 0.3 m, max slope 40°, snap to ground 0.2, offset 0.02
    this.characterController = this.rapierWorld.createCharacterController(0.02);
    this.characterController.setMaxSlopeClimbAngle((40 * Math.PI) / 180);
    this.characterController.setMinSlopeSlideAngle((30 * Math.PI) / 180);
    this.characterController.enableAutostep(0.3, 0.2, true);
    this.characterController.enableSnapToGround(0.2);

    const bodyDesc = R.RigidBodyDesc.kinematicPositionBased().setTranslation(-12, 0.89, 5.8);
    this.coachBody = this.rapierWorld.createRigidBody(bodyDesc);
    const colliderDesc = R.ColliderDesc.capsule(0.61, 0.28);
    this.coachCollider = this.rapierWorld.createCollider(colliderDesc, this.coachBody);
  }

  public setCoachMesh(mesh: THREE.Group) {
    this.coachMesh = mesh;
  }

  public startWalk(
    fromRoom: RoomId,
    toRoom: RoomId,
    walksEnabled: boolean,
    onComplete: () => void,
  ): boolean {
    if (fromRoom === toRoom || !walksEnabled) {
      onComplete();
      return false;
    }

    const startNode = ROOM_KEY_NODES[fromRoom];
    const endNode = ROOM_KEY_NODES[toRoom];
    const path = findNavPath(startNode, endNode);

    if (path.length <= 1) {
      onComplete();
      return false;
    }

    const totalDuration = getWalkDuration(path);

    const pStart = path[0];
    if (!pStart) {
      onComplete();
      return false;
    }

    this.state = {
      active: true,
      fromRoom,
      toRoom,
      path,
      totalDuration,
      elapsed: 0,
      currentPos: [pStart[0], pStart[1], pStart[2]],
      currentFacing: 0,
      onComplete,
    };

    return true;
  }

  public skip() {
    if (!this.state || !this.state.active) return;
    const dest = this.state.path[this.state.path.length - 1];
    if (dest) {
      this.state.currentPos = [dest[0], dest[1], dest[2]];
    }
    const cb = this.state.onComplete;
    this.state = null;
    if (cb) cb();
  }

  public update(dt: number): { pos: Point3D; facing: number; active: boolean } | null {
    if (!this.state || !this.state.active) return null;

    this.state.elapsed += dt;
    const progress = Math.min(1.0, this.state.elapsed / this.state.totalDuration);

    const path = this.state.path;
    const segmentCount = path.length - 1;
    const currentSegmentIndex = Math.min(Math.floor(progress * segmentCount), segmentCount - 1);
    const segmentProgress = progress * segmentCount - currentSegmentIndex;

    const p0 = path[currentSegmentIndex];
    const p1 = path[currentSegmentIndex + 1];
    if (!p0 || !p1) return null;

    const currentX = p0[0] + (p1[0] - p0[0]) * segmentProgress;
    const currentY = p0[1] + (p1[1] - p0[1]) * segmentProgress;
    const currentZ = p0[2] + (p1[2] - p0[2]) * segmentProgress;

    const dx = p1[0] - p0[0];
    const dz = p1[2] - p0[2];
    const facing = Math.atan2(dx, dz);

    this.state.currentPos = [currentX, currentY, currentZ];
    this.state.currentFacing = facing;

    if (this.coachMesh) {
      this.coachMesh.position.set(currentX, currentY, currentZ);
      this.coachMesh.rotation.y = facing;
    }

    if (this.characterController && this.coachCollider && this.coachBody && this.rapierWorld) {
      const stepDesired = {
        x: (dx * dt) / this.state.totalDuration,
        y: -9.81 * dt,
        z: (dz * dt) / this.state.totalDuration,
      };
      this.characterController.computeColliderMovement(this.coachCollider, stepDesired);
      const corrected = this.characterController.computedMovement();
      const pos = this.coachBody.translation();
      this.coachBody.setNextKinematicTranslation({
        x: pos.x + corrected.x,
        y: pos.y + corrected.y,
        z: pos.z + corrected.z,
      });
      this.rapierWorld.step();
    }

    if (progress >= 1.0) {
      const cb = this.state.onComplete;
      this.state = null;
      if (cb) cb();
      return { pos: [currentX, currentY, currentZ], facing, active: false };
    }

    return { pos: [currentX, currentY, currentZ], facing, active: true };
  }

  public isWalking(): boolean {
    return this.state !== null && this.state.active;
  }
}
