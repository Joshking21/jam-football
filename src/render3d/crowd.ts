// Implements SPEC §14.2 3D Crowd with InstancedMesh & Celebrations
import * as THREE from 'three';
import { Club, Side } from '../core/types';
import { QualityPreset } from './types';

export interface CrowdBundle {
  group: THREE.Group;
  triggerGoal: (side: Side) => void;
  update: (delta: number) => void;
  dispose: () => void;
}

export function createCrowd(
  homeClub: Club,
  awayClub: Club,
  quality: QualityPreset = 'Medium',
): CrowdBundle {
  const group = new THREE.Group();
  group.name = 'Crowd';

  // In Low quality, skip crowd for maximum frame rates
  if (quality === 'Low') {
    return {
      group,
      triggerGoal: () => {},
      update: () => {},
      dispose: () => {},
    };
  }

  const countPerSide = quality === 'High' ? 1200 : 600;
  const countPerEnd = quality === 'High' ? 800 : 400;
  const totalCount = countPerSide * 2 + countPerEnd * 2;

  // Simple stylized spectator block (head + torso)
  const geom = new THREE.BoxGeometry(0.5, 0.9, 0.4);
  geom.translate(0, 0.45, 0);

  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.8,
    metalness: 0.1,
  });

  const mesh = new THREE.InstancedMesh(geom, mat, totalCount);
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const homeColor1 = new THREE.Color(homeClub.colors.primary);
  const homeColor2 = new THREE.Color(homeClub.colors.secondary);
  const awayColor1 = new THREE.Color(awayClub.colors.primary);
  const neutralColors = [
    new THREE.Color(0x22262e),
    new THREE.Color(0x363d4a),
    new THREE.Color(0x191e24),
    new THREE.Color(0x4a4742),
  ];

  interface SpectatorData {
    baseY: number;
    team: 'home' | 'away' | 'neutral';
    pos: THREE.Vector3;
    rotY: number;
    phase: number;
  }

  const spectators: SpectatorData[] = [];
  const dummy = new THREE.Object3D();
  let instanceIdx = 0;

  const populateStand = (
    length: number,
    depth: number,
    height: number,
    tiers: number,
    standPos: THREE.Vector3,
    rotY: number,
    count: number,
    isAwaySection: boolean,
  ) => {
    const tierDepth = depth / tiers;
    const tierHeight = height / tiers;

    for (let i = 0; i < count; i++) {
      const tier = Math.floor(Math.random() * (tiers - 1));
      const rowX = (Math.random() - 0.5) * (length - 4);
      const rowZ = tier * tierDepth + tierDepth / 2;
      const rowY = tierHeight * (tier + 1) + 0.35;

      // Transform to world coordinates
      dummy.position.set(rowX, rowY, rowZ);
      dummy.rotation.set(0, 0, 0);
      dummy.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
      dummy.position.add(standPos);

      // Look slightly toward pitch center
      dummy.rotation.y = rotY + (Math.random() - 0.5) * 0.2;

      // Color selection (SPEC §14.2: 65% home, 15% away, rest neutral)
      let col: THREE.Color;
      let team: 'home' | 'away' | 'neutral';

      if (isAwaySection && Math.random() < 0.75) {
        col = awayColor1;
        team = 'away';
      } else {
        const roll = Math.random();
        if (roll < 0.65) {
          col = Math.random() < 0.7 ? homeColor1 : homeColor2;
          team = 'home';
        } else if (roll < 0.8) {
          col = awayColor1;
          team = 'away';
        } else {
          const nIdx = Math.floor(Math.random() * neutralColors.length);
          col = neutralColors[nIdx] ?? neutralColors[0]!;
          team = 'neutral';
        }
      }

      dummy.scale.set(
        0.85 + Math.random() * 0.3,
        0.85 + Math.random() * 0.3,
        0.85 + Math.random() * 0.3,
      );
      dummy.updateMatrix();

      mesh.setMatrixAt(instanceIdx, dummy.matrix);
      mesh.setColorAt(instanceIdx, col);

      spectators.push({
        baseY: dummy.position.y,
        team,
        pos: dummy.position.clone(),
        rotY: dummy.rotation.y,
        phase: Math.random() * Math.PI * 2,
      });

      instanceIdx++;
    }
  };

  // Two Side Stands
  populateStand(110, 14, 12, 8, new THREE.Vector3(0, 0, 40), 0, countPerSide, false);
  populateStand(110, 14, 12, 8, new THREE.Vector3(0, 0, -40), Math.PI, countPerSide, false);

  // Two End Stands (one corner assigned as away block)
  populateStand(72, 12, 10, 7, new THREE.Vector3(59, 0, 0), -Math.PI / 2, countPerEnd, true);
  populateStand(72, 12, 10, 7, new THREE.Vector3(-59, 0, 0), Math.PI / 2, countPerEnd, false);

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);

  let celebrationTimer = 0;
  let celebratingSide: Side | null = null;
  let totalTime = 0;

  return {
    group,
    triggerGoal: (side: Side) => {
      celebrationTimer = 3.0; // 3 seconds jump celebration per SPEC §14.2
      celebratingSide = side;
    },
    update: (delta: number) => {
      totalTime += delta;
      if (celebrationTimer > 0) {
        celebrationTimer = Math.max(0, celebrationTimer - delta);
      }

      let matricesNeedUpdate = false;

      // Update bobbing and jumps
      for (let i = 0; i < spectators.length; i++) {
        const spec = spectators[i];
        if (!spec) continue;
        let jumpY = 0;

        // Goal jump wave
        if (celebrationTimer > 0 && spec.team === celebratingSide) {
          jumpY = Math.abs(Math.sin(totalTime * 12 + spec.phase)) * 0.5;
        } else {
          // Idle ambient sway/bob
          jumpY = Math.sin(totalTime * 1.8 + spec.phase) * 0.04;
        }

        dummy.position.copy(spec.pos);
        dummy.position.y = spec.baseY + jumpY;
        dummy.rotation.set(0, spec.rotY, 0);
        dummy.updateMatrix();

        mesh.setMatrixAt(i, dummy.matrix);
        matricesNeedUpdate = true;
      }

      if (matricesNeedUpdate) {
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
    dispose: () => {
      geom.dispose();
      mat.dispose();
    },
  };
}
