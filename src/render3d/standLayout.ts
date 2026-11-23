// Shared stand layout for the stadium (stadium.ts) and the crowd (crowd.ts), v1.8.
// Each stand is a stepped rake. Local frame: x along the stand, +z away from the pitch, y up;
// `origin` is the front-centre at ground level, `yaw` turns local +z to face away from the pitch.
import * as THREE from 'three';

export interface StandDef {
  key: 'far' | 'near' | 'right' | 'left';
  origin: THREE.Vector3;
  yaw: number;
  length: number;
  rows: number;
  rowDepth: number;
  rowRise: number;
  frontWall: number;
  roof: boolean;
}

export const STANDS: StandDef[] = [
  {
    key: 'far',
    origin: new THREE.Vector3(0, 0, 40),
    yaw: 0,
    length: 114,
    rows: 24,
    rowDepth: 0.75,
    rowRise: 0.45,
    frontWall: 1.6,
    roof: true,
  },
  // The near side holds the TV gantry: no roof, so the broadcast camera sees over it.
  {
    key: 'near',
    origin: new THREE.Vector3(0, 0, -40),
    yaw: Math.PI,
    length: 114,
    rows: 24,
    rowDepth: 0.75,
    rowRise: 0.45,
    frontWall: 1.6,
    roof: false,
  },
  {
    key: 'right',
    origin: new THREE.Vector3(59, 0, 0),
    yaw: Math.PI / 2,
    length: 76,
    rows: 20,
    rowDepth: 0.75,
    rowRise: 0.48,
    frontWall: 1.6,
    roof: true,
  },
  {
    key: 'left',
    origin: new THREE.Vector3(-59, 0, 0),
    yaw: -Math.PI / 2,
    length: 76,
    rows: 20,
    rowDepth: 0.75,
    rowRise: 0.48,
    frontWall: 1.6,
    roof: true,
  },
];

/** Height of row r's seat tread (local y). */
export function treadY(s: StandDef, r: number): number {
  return s.frontWall + (r + 1) * s.rowRise;
}

export function standDepth(s: StandDef): number {
  return s.rows * s.rowDepth;
}

export function standTop(s: StandDef): number {
  return treadY(s, s.rows - 1);
}

/** Local → world for a stand. */
export function standToWorld(
  s: StandDef,
  x: number,
  y: number,
  z: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const c = Math.cos(s.yaw);
  const sn = Math.sin(s.yaw);
  // Rotation about Y: local x → (c, 0, -sn), local z → (sn, 0, c)
  return out.set(s.origin.x + x * c + z * sn, s.origin.y + y, s.origin.z - x * sn + z * c);
}

/** The away supporters' block: the left third of the right-hand end stand. */
export function isAwayBlock(s: StandDef, x: number): boolean {
  return s.key === 'right' && x < -s.length / 6;
}

/** Deterministic hash → [0, 1). */
export function hash01(a: number, b: number, c = 0): number {
  let h =
    Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^
    Math.imul(b + 0x7f4a7c15, 0xc2b2ae35) ^
    Math.imul(c + 0x165667b1, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}
