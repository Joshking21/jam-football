// SPEC §14.11 People: shared rig, clip mixer with fallbacks, sitting and marks
import * as THREE from 'three';
import type { FaceMood } from './types';
import { FaceController } from './faces';

export interface PersonInstance {
  id: string;
  name: string;
  role: 'coach' | 'theo' | 'player' | 'owner' | 'reporter' | 'director';
  group: THREE.Group;
  faceController: FaceController;
  currentClip: string;
  isSitting: boolean;
  position: [number, number, number];
  facingY: number;
}

export class PeopleManager {
  private people: Map<string, PersonInstance> = new Map();

  /** Creates a character instance with procedural capsule and face layer fallback */
  public createPerson(
    id: string,
    name: string,
    role: PersonInstance['role'],
    pos: [number, number, number],
    facingY = 0,
    tint = 0x3b82f6,
  ): PersonInstance {
    const group = new THREE.Group();
    group.name = `Person_${id}`;
    group.position.set(...pos);
    group.rotation.y = facingY;

    // Capsule body (height 1.78, radius 0.28)
    const bodyGeo = new THREE.CapsuleGeometry(0.28, 1.22, 8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: role === 'theo' ? 0x2563eb : role === 'owner' ? 0x1e293b : tint,
      roughness: 0.8,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.89;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Head (sphere)
    const headGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xc68b63, // skin tone
      roughness: 0.6,
    });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.name = 'Head';
    headMesh.position.set(0, 1.62, 0);
    headMesh.castShadow = true;
    group.add(headMesh);

    // Face patch parented to Head
    const faceController = new FaceController();
    const faceMesh = faceController.createFaceMesh();
    faceMesh.position.set(0, 0, 0.141);
    headMesh.add(faceMesh);

    const instance: PersonInstance = {
      id,
      name,
      role,
      group,
      faceController,
      currentClip: 'Listen',
      isSitting: false,
      position: [...pos],
      facingY,
    };

    this.people.set(id, instance);
    return instance;
  }

  public getPerson(id: string): PersonInstance | undefined {
    return this.people.get(id);
  }

  public getAll(): PersonInstance[] {
    return Array.from(this.people.values());
  }

  public setMood(id: string, mood: FaceMood) {
    const p = this.people.get(id);
    if (p) p.faceController.setMood(mood);
  }

  public playClip(id: string, clipName: string) {
    const p = this.people.get(id);
    if (!p) return;
    p.currentClip = clipName;

    // Procedural animation adjustment for fallbacks
    if (clipName.startsWith('Sit')) {
      p.isSitting = true;
      p.group.position.y = p.position[1] - 0.45; // lowered for chair/bench
    } else {
      p.isSitting = false;
      p.group.position.y = p.position[1];
    }
  }

  public update(dt: number, speakerId: string | null, analyser: AnalyserNode | null) {
    let speakerPos: [number, number, number] | null = null;
    if (speakerId) {
      const sp = this.people.get(speakerId);
      if (sp) speakerPos = sp.position;
    }

    for (const [id, person] of this.people.entries()) {
      const isSpeaking = id === speakerId;
      person.faceController.update(dt, isSpeaking, analyser, speakerPos, person.position);

      const head = person.group.getObjectByName('Head');
      if (head) {
        head.rotation.copy(person.faceController.getHeadRotation());
      }
    }
  }

  public clear() {
    this.people.clear();
  }
}
