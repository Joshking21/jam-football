// Implements SPEC §14.2 3D goals and net (v1.8 rebuild, REVIEW-M4 T2).
// Painted white posts (non-metallic, so they read under floodlights at broadcast distance) and a
// net made of textured panels: a box-net with a sloped roof, stanchions and a back bar. The back
// panel bulges where the ball actually hits it, scaled by the ball's speed.
import * as THREE from 'three';
import { createSafeCanvas } from './canvasHelper';

export interface GoalsBundle {
  group: THREE.Group;
  /** Back-compat: ripple the net of the goal this side attacks in half 1. */
  triggerRipple: (side: 'home' | 'away') => void;
  /** Bulge the net of the goal at x (scene) around the contact point. */
  hitNet: (goalX: number, z: number, y: number, speed: number) => void;
  update: (delta: number) => void;
  dispose: () => void;
}

const W = 7.32;
const H = 2.44;
const DEPTH_TOP = 1.0;
const DEPTH_BOTTOM = 2.0;
const POST_R = 0.06;

function netTexture(): THREE.CanvasTexture {
  const c = createSafeCanvas(128, 128);
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 6;
    // Diamond (hexagonal-ish) mesh: two diagonal families.
    ctx.beginPath();
    ctx.moveTo(0, 64);
    ctx.lineTo(64, 0);
    ctx.lineTo(128, 64);
    ctx.lineTo(64, 128);
    ctx.closePath();
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

interface NetState {
  geometry: THREE.BufferGeometry;
  original: Float32Array;
  time: number;
  z: number;
  y: number;
  amp: number;
  dir: number;
}

export function createGoals(): GoalsBundle {
  const group = new THREE.Group();
  group.name = 'Goals';

  const postMaterial = new THREE.MeshStandardMaterial({
    color: 0xf4f4f0,
    roughness: 0.35,
    metalness: 0.0,
    emissive: new THREE.Color(0x202020),
  });
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0xd8d8d8,
    roughness: 0.5,
    metalness: 0.2,
  });
  const tex = netTexture();
  const netMaterials: THREE.MeshStandardMaterial[] = [];
  const netMat = (repX: number, repY: number) => {
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(repX, repY);
    const m = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: t,
      alphaMap: t,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
      roughness: 0.9,
    });
    netMaterials.push(m);
    return m;
  };
  const CELL = 0.14;

  const nets: Record<'left' | 'right', NetState | null> = { left: null, right: null };

  const build = (isLeft: boolean) => {
    const g = new THREE.Group();
    const x = isLeft ? -52.5 : 52.5;
    const dir = isLeft ? -1 : 1; // nets extend away from the pitch
    g.position.set(x, 0, 0);

    // Posts and crossbar (the frame stands on the goal line, its back edge on the line).
    const postGeom = new THREE.CylinderGeometry(POST_R, POST_R, H + POST_R, 16);
    postGeom.translate(0, (H + POST_R) / 2, 0);
    [-1, 1].forEach((s) => {
      const post = new THREE.Mesh(postGeom, postMaterial);
      post.position.set(dir * POST_R, 0, s * (W / 2 + POST_R));
      post.castShadow = true;
      g.add(post);
    });
    const barGeom = new THREE.CylinderGeometry(POST_R, POST_R, W + POST_R * 4, 16);
    barGeom.rotateX(Math.PI / 2);
    const bar = new THREE.Mesh(barGeom, postMaterial);
    bar.position.set(dir * POST_R, H + POST_R, 0);
    bar.castShadow = true;
    g.add(bar);

    // Stanchions: from the crossbar ends back and down to the ground frame.
    const stanchion = (z: number) => {
      const pts = [
        new THREE.Vector3(0, H, z),
        new THREE.Vector3(dir * DEPTH_TOP, H - 0.15, z),
        new THREE.Vector3(dir * DEPTH_BOTTOM, 0.02, z),
      ];
      const curve = new THREE.CatmullRomCurve3(pts);
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.025, 6), frameMaterial);
      g.add(m);
    };
    stanchion(-W / 2);
    stanchion(W / 2);
    const backBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, W, 6).rotateX(Math.PI / 2),
      frameMaterial,
    );
    backBar.position.set(dir * DEPTH_BOTTOM, 0.03, 0);
    g.add(backBar);

    // Back panel: from the roof's back edge down to the back bar (sloped), segmented to ripple.
    const back = new THREE.PlaneGeometry(W, 1, 28, 12);
    const pos = back.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getX(i);
      const v = pos.getY(i) + 0.5; // 0 bottom … 1 top
      const y = v * (H - 0.15);
      const depth = DEPTH_BOTTOM + (DEPTH_TOP - DEPTH_BOTTOM) * v;
      pos.setXYZ(i, dir * depth, y, z);
    }
    back.computeVertexNormals();
    const backMesh = new THREE.Mesh(back, netMat(W / CELL, H / CELL));
    g.add(backMesh);
    nets[isLeft ? 'left' : 'right'] = {
      geometry: back,
      original: new Float32Array(pos.array as Float32Array),
      time: 0,
      z: 0,
      y: 1,
      amp: 0,
      dir,
    };

    // Roof: crossbar to the back panel's top edge.
    const roof = new THREE.PlaneGeometry(DEPTH_TOP, W);
    roof.rotateX(-Math.PI / 2);
    const roofMesh = new THREE.Mesh(roof, netMat(DEPTH_TOP / CELL, W / CELL));
    roofMesh.position.set((dir * DEPTH_TOP) / 2, H - 0.07, 0);
    g.add(roofMesh);

    // Side panels: the quadrilateral goal line → back bar, ground → roof.
    [-1, 1].forEach((s) => {
      const shape = new THREE.BufferGeometry();
      const verts = new Float32Array([
        0,
        0,
        0,
        dir * DEPTH_BOTTOM,
        0,
        0,
        dir * DEPTH_TOP,
        H - 0.15,
        0,
        0,
        H,
        0,
      ]);
      shape.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      shape.setAttribute(
        'uv',
        new THREE.BufferAttribute(
          new Float32Array([0, 0, DEPTH_BOTTOM / CELL, 0, DEPTH_TOP / CELL, H / CELL, 0, H / CELL]),
          2,
        ),
      );
      shape.setIndex([0, 1, 2, 0, 2, 3]);
      shape.computeVertexNormals();
      const m = new THREE.Mesh(shape, netMat(1, 1));
      m.position.set(0, 0, s * (W / 2 + POST_R));
      g.add(m);
    });

    group.add(g);
  };

  build(true);
  build(false);

  const hitNet = (goalX: number, z: number, y: number, speed: number) => {
    const n = goalX < 0 ? nets.left : nets.right;
    if (!n) return;
    n.time = 1.4;
    n.z = z;
    n.y = y;
    n.amp = Math.min(0.9, 0.25 + speed * 0.025);
  };

  return {
    group,
    triggerRipple: (side) => hitNet(side === 'home' ? 52.5 : -52.5, 0, 1.2, 15),
    hitNet,
    update: (delta: number) => {
      (['left', 'right'] as const).forEach((k) => {
        const n = nets[k];
        if (!n || n.time <= 0) return;
        n.time = Math.max(0, n.time - delta);
        const age = 1.4 - n.time;
        // A quick bulge outward, then a damped wobble back.
        const env = Math.exp(-age * 3.2) * Math.cos(age * 11);
        const pos = n.geometry.attributes.position as THREE.BufferAttribute;
        const o = n.original;
        for (let i = 0; i < pos.count; i++) {
          const ox = o[i * 3]!;
          const oy = o[i * 3 + 1]!;
          const oz = o[i * 3 + 2]!;
          const d2 = (oz - n.z) * (oz - n.z) + (oy - n.y) * (oy - n.y);
          const bump = Math.exp(-d2 / 1.1) * n.amp * env;
          pos.setX(i, ox + n.dir * bump);
        }
        pos.needsUpdate = true;
        if (n.time === 0) {
          (pos.array as Float32Array).set(o);
          pos.needsUpdate = true;
        }
      });
    },
    dispose: () => {
      postMaterial.dispose();
      frameMaterial.dispose();
      netMaterials.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
      tex.dispose();
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose();
      });
    },
  };
}
