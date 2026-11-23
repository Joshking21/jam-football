// Implements SPEC §14.2 crowd (v1.8 rebuild, REVIEW-M4 T14).
// Supporters are instanced billboards seated on the stand rakes (standLayout.ts), tinted in club
// colours (home 65%, away in their block, the rest dark coats). They bob gently, and the scoring
// side's sections jump for 3 s. All motion runs in the vertex shader: no per-frame CPU work.
import * as THREE from 'three';
import { Club, Side } from '../core/types';
import { QualityPreset } from './types';
import { createSafeCanvas } from './canvasHelper';
import { STANDS, treadY, standToWorld, isAwayBlock, hash01 } from './standLayout';

export interface CrowdBundle {
  group: THREE.Group;
  triggerGoal: (side: Side) => void;
  update: (delta: number) => void;
  dispose: () => void;
}

function supporterSprite(): THREE.CanvasTexture {
  const c = createSafeCanvas(64, 96);
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 64, 96);
    ctx.fillStyle = '#ffffff';
    // Shoulders and torso.
    ctx.beginPath();
    ctx.moveTo(8, 96);
    ctx.quadraticCurveTo(8, 50, 32, 48);
    ctx.quadraticCurveTo(56, 50, 56, 96);
    ctx.fill();
    // Head (slightly darker so the tint reads as a face over a shirt).
    ctx.fillStyle = '#c9b4a0';
    ctx.beginPath();
    ctx.arc(32, 32, 14, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createCrowd(
  homeClub: Club,
  awayClub: Club,
  quality: QualityPreset = 'Medium',
): CrowdBundle {
  const group = new THREE.Group();
  group.name = 'Crowd';

  const cap = quality === 'High' ? 12000 : quality === 'Medium' ? 6000 : 2000;

  // Collect candidate seats.
  const seats: { pos: THREE.Vector3; yaw: number; away: boolean; phase: number }[] = [];
  const tmp = new THREE.Vector3();
  STANDS.forEach((s, sIdx) => {
    const spacing = 0.6;
    const n = Math.floor(s.length / spacing);
    for (let r = 0; r < s.rows; r++) {
      for (let i = 0; i < n; i++) {
        const x = -s.length / 2 + (i + 0.5) * spacing;
        const z = r * s.rowDepth + s.rowDepth * 0.55;
        standToWorld(s, x, treadY(s, r), z, tmp);
        seats.push({
          pos: tmp.clone(),
          yaw: s.yaw + Math.PI,
          away: isAwayBlock(s, x),
          phase: hash01(sIdx, r, i),
        });
      }
    }
  });
  const keep = Math.min(1, cap / seats.length);
  const chosen = seats.filter((_, i) => hash01(i, 3, 11) < keep).slice(0, cap);
  const count = chosen.length;

  const geom = new THREE.PlaneGeometry(0.55, 0.82);
  geom.translate(0, 0.41, 0);
  const tex = supporterSprite();
  const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });

  const uniforms = {
    uTime: { value: 0 },
    uJumpTeam: { value: 0 }, // 1 home, 2 away
    uJump: { value: 0 },
  };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uJumpTeam = uniforms.uJumpTeam;
    shader.uniforms.uJump = uniforms.uJump;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aPhase;
        attribute float aTeam;
        uniform float uTime;
        uniform float uJumpTeam;
        uniform float uJump;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float ph = aPhase * 6.2831;
        transformed.y += sin(uTime * 1.7 + ph) * 0.035;
        float jumping = step(0.5, uJump) * (1.0 - step(0.5, abs(aTeam - uJumpTeam)));
        transformed.y += jumping * abs(sin(uTime * 10.5 + ph)) * 0.42 * uJump;
        transformed.x += jumping * sin(uTime * 7.0 + ph) * 0.06;`,
      );
  };

  const mesh = new THREE.InstancedMesh(geom, mat, Math.max(1, count));
  mesh.count = count;
  mesh.frustumCulled = false;
  const phases = new Float32Array(Math.max(1, count));
  const teams = new Float32Array(Math.max(1, count));

  const home1 = new THREE.Color(homeClub.colors.primary);
  const home2 = new THREE.Color(homeClub.colors.secondary);
  const away1 = new THREE.Color(awayClub.colors.primary);
  const away2 = new THREE.Color(awayClub.colors.secondary);
  const coats = [
    new THREE.Color(0x2a2e36),
    new THREE.Color(0x3b342e),
    new THREE.Color(0x1e2533),
    new THREE.Color(0x4a4a4a),
  ];
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  chosen.forEach((seat, i) => {
    dummy.position.copy(seat.pos);
    dummy.rotation.set(0, seat.yaw + (seat.phase - 0.5) * 0.3, 0);
    const sc = 0.9 + seat.phase * 0.22;
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    const roll = hash01(i, 5, 2);
    let team = 1;
    if (seat.away) {
      team = 2;
      col.copy(roll < 0.75 ? away1 : roll < 0.9 ? away2 : coats[0]!);
    } else if (roll < 0.65) {
      col.copy(roll < 0.45 ? home1 : home2);
    } else {
      team = 0;
      col.copy(coats[Math.floor(roll * 997) % coats.length]!);
    }
    mesh.setColorAt(i, col);
    phases[i] = seat.phase;
    teams[i] = team;
  });
  geom.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  geom.setAttribute('aTeam', new THREE.InstancedBufferAttribute(teams, 1));
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);

  let celebration = 0;
  return {
    group,
    triggerGoal: (side: Side) => {
      celebration = 3.0;
      uniforms.uJumpTeam.value = side === 'home' ? 1 : 2;
    },
    update: (delta: number) => {
      uniforms.uTime.value += delta;
      celebration = Math.max(0, celebration - delta);
      uniforms.uJump.value = celebration > 0 ? Math.min(1, celebration) : 0;
    },
    dispose: () => {
      geom.dispose();
      mat.dispose();
      tex.dispose();
    },
  };
}
