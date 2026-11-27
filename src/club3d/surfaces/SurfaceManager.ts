import * as THREE from 'three';
import { TacticsBoard } from './TacticsBoard';
import type { Tactics, Player } from '../../core/types';

export class SurfaceManager {
  private tacticsBoard: TacticsBoard | null = null;
  private roomGroup: THREE.Group | null = null;

  bindToRoom(roomGroup: THREE.Group) {
    this.roomGroup = roomGroup;
    this.applyTextures();
  }

  private findMesh(name: string): THREE.Mesh | null {
    if (!this.roomGroup) return null;
    const obj = this.roomGroup.getObjectByName(name);
    if (obj && (obj as THREE.Mesh).isMesh) return obj as THREE.Mesh;
    return null;
  }

  private applyTextures() {
    if (!this.tacticsBoard) {
      this.tacticsBoard = new TacticsBoard();
    }
    const map = this.tacticsBoard.texture;
    for (const name of ['whiteboard_surface', 'flipchart_surface']) {
      const mesh = this.findMesh(name);
      if (!mesh) continue;
      const current = mesh.material as THREE.MeshBasicMaterial;
      if (current.map === map) continue; // already bound; texture.needsUpdate handles redraws
      current.dispose();
      mesh.material = new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide });
    }
  }

  updateTactics(tactics: Tactics, players: Player[]) {
    if (!this.tacticsBoard) {
      this.tacticsBoard = new TacticsBoard();
    }
    this.tacticsBoard.update(tactics, players);
    this.applyTextures();
  }

  getSurfaceMesh(surfaceId: string): THREE.Mesh | undefined {
    return this.findMesh(surfaceId) ?? undefined;
  }

  dispose() {
    this.tacticsBoard?.dispose();
    this.roomGroup = null;
  }
}
