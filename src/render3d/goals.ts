// Implements SPEC §14.2 3D Goals & Net with Ripple Physics
import * as THREE from 'three';

export interface GoalsBundle {
  group: THREE.Group;
  triggerRipple: (side: 'home' | 'away') => void;
  update: (delta: number) => void;
  dispose: () => void;
}

export function createGoals(): GoalsBundle {
  const group = new THREE.Group();
  group.name = 'Goals';

  const postRadius = 0.06;
  const goalWidth = 7.32;
  const goalHeight = 2.44;
  const goalDepth = 2.0;

  const postMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0.8,
  });

  const netMaterial = new THREE.LineBasicMaterial({
    color: 0xdddddd,
    transparent: true,
    opacity: 0.65,
  });

  interface NetState {
    geometry: THREE.BufferGeometry;
    originalPositions: Float32Array;
    rippleTime: number; // 0 = inactive, > 0 = active
  }

  const nets: { home: NetState; away: NetState } = {
    home: {} as NetState,
    away: {} as NetState,
  };

  const createSingleGoal = (isLeft: boolean): THREE.Group => {
    const goalGroup = new THREE.Group();
    const xPos = isLeft ? -52.5 : 52.5;
    const dir = isLeft ? -1 : 1; // Nets extend backwards away from pitch center

    goalGroup.position.set(xPos, 0, 0);

    // 1. Vertical Posts (z = -3.66, z = +3.66)
    const postGeom = new THREE.CylinderGeometry(postRadius, postRadius, goalHeight, 16);
    postGeom.translate(0, goalHeight / 2, 0);

    const leftPost = new THREE.Mesh(postGeom, postMaterial);
    leftPost.position.set(0, 0, -goalWidth / 2);
    leftPost.castShadow = true;
    goalGroup.add(leftPost);

    const rightPost = new THREE.Mesh(postGeom, postMaterial);
    rightPost.position.set(0, 0, goalWidth / 2);
    rightPost.castShadow = true;
    goalGroup.add(rightPost);

    // 2. Crossbar (Horizontal at y = 2.44, spanning z = -3.66 to +3.66)
    const crossbarGeom = new THREE.CylinderGeometry(postRadius, postRadius, goalWidth, 16);
    crossbarGeom.rotateX(Math.PI / 2);
    crossbarGeom.translate(0, goalHeight, 0);

    const crossbar = new THREE.Mesh(crossbarGeom, postMaterial);
    crossbar.castShadow = true;
    goalGroup.add(crossbar);

    // 3. Stanchions (rear support bars extending back)
    const stanchionGeom = new THREE.CylinderGeometry(0.03, 0.03, goalDepth, 8);
    stanchionGeom.rotateZ(Math.PI / 2);
    stanchionGeom.translate((dir * goalDepth) / 2, 0.05, 0);

    const bottomBackBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, goalWidth, 8).rotateX(Math.PI / 2),
      postMaterial,
    );
    bottomBackBar.position.set(dir * goalDepth, 0.05, 0);
    goalGroup.add(bottomBackBar);

    // 4. Net Grid (Back and sides)
    const segmentsX = 14;
    const segmentsY = 10;
    const segmentsZ = 16;
    const points: THREE.Vector3[] = [];

    // Back net grid (at x = dir * goalDepth)
    for (let i = 0; i <= segmentsY; i++) {
      const y = (i / segmentsY) * goalHeight;
      points.push(new THREE.Vector3(dir * goalDepth, y, -goalWidth / 2));
      points.push(new THREE.Vector3(dir * goalDepth, y, goalWidth / 2));
    }
    for (let i = 0; i <= segmentsZ; i++) {
      const z = -goalWidth / 2 + (i / segmentsZ) * goalWidth;
      points.push(new THREE.Vector3(dir * goalDepth, 0, z));
      points.push(new THREE.Vector3(dir * goalDepth, goalHeight, z));
    }

    // Top net (from crossbar to back bar)
    for (let i = 0; i <= segmentsZ; i++) {
      const z = -goalWidth / 2 + (i / segmentsZ) * goalWidth;
      points.push(new THREE.Vector3(0, goalHeight, z));
      points.push(new THREE.Vector3(dir * goalDepth, goalHeight, z));
    }

    // Side nets (z = ±goalWidth / 2)
    [-goalWidth / 2, goalWidth / 2].forEach((zSide) => {
      for (let i = 0; i <= segmentsY; i++) {
        const y = (i / segmentsY) * goalHeight;
        points.push(new THREE.Vector3(0, y, zSide));
        points.push(new THREE.Vector3(dir * goalDepth, y, zSide));
      }
      for (let i = 0; i <= segmentsX; i++) {
        const x = dir * (i / segmentsX) * goalDepth;
        points.push(new THREE.Vector3(x, 0, zSide));
        points.push(new THREE.Vector3(x, goalHeight, zSide));
      }
    });

    const netGeom = new THREE.BufferGeometry().setFromPoints(points);
    const netLines = new THREE.LineSegments(netGeom, netMaterial);
    goalGroup.add(netLines);

    const posAttr = netGeom.attributes.position;
    const originalPos = posAttr ? new Float32Array(posAttr.array) : new Float32Array();
    const netKey = isLeft ? 'home' : 'away';
    nets[netKey] = {
      geometry: netGeom,
      originalPositions: originalPos,
      rippleTime: 0,
    };

    return goalGroup;
  };

  group.add(createSingleGoal(true));
  group.add(createSingleGoal(false));

  return {
    group,
    triggerRipple: (side: 'home' | 'away') => {
      if (nets[side]) {
        nets[side].rippleTime = 1.2; // 1.2s ripple duration per SPEC §14.2
      }
    },
    update: (delta: number) => {
      (['home', 'away'] as const).forEach((side) => {
        const net = nets[side];
        if (net && net.rippleTime > 0) {
          net.rippleTime = Math.max(0, net.rippleTime - delta);
          const progress = 1 - net.rippleTime / 1.2;
          const decay = Math.max(0, 1 - progress);
          const pos = net.geometry.attributes.position;
          const orig = net.originalPositions;
          if (!pos || !orig.length) return;

          for (let i = 0; i < pos.count; i++) {
            const ox = orig[i * 3] ?? 0;
            const oy = orig[i * 3 + 1] ?? 0;
            const oz = orig[i * 3 + 2] ?? 0;

            // Animate wave displacement along z and y
            const wave = Math.sin(progress * 18 + oz * 2.5 + oy * 3) * 0.12 * decay;
            pos.setXYZ(i, ox + wave * 0.5, oy + wave * 0.2, oz + wave * 0.2);
          }
          pos.needsUpdate = true;
        }
      });
    },
    dispose: () => {
      postMaterial.dispose();
      netMaterial.dispose();
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
          obj.geometry.dispose();
        }
      });
    },
  };
}
