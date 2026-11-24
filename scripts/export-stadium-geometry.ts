// Exports the procedural stadium (src/render3d/stadium.ts) to a PLY file for baking in Blender
// (tools/blender/bake_stadium_ao.py). Meshes are written in the same traversal order the game
// uses when it applies the bake, with a sidecar listing each mesh's vertex count, so the baked
// per-vertex values line up exactly. Usage: npx tsx scripts/export-stadium-geometry.ts <outDir>
import * as fs from 'fs';
import * as path from 'path';
import * as THREE from 'three';
import { createStadium } from '../src/render3d/stadium';
import { bakeableMeshes } from '../src/render3d/stadiumBake';
import worldSnapshot from '../src/core/world/world.snapshot.json';
import type { Club } from '../src/core/types';

const outDir = process.argv[2] ?? 'tests-ai/bake';
fs.mkdirSync(outDir, { recursive: true });

const clubs = worldSnapshot.clubs as unknown as Record<string, Club>;
const stadium = createStadium(clubs['c01']!, 'High', clubs['c02']!);
stadium.group.updateMatrixWorld(true);

const meshes = bakeableMeshes(stadium.group);
const verts: number[] = [];
const faces: number[][] = [];
const counts: { name: string; vertices: number }[] = [];
const v = new THREE.Vector3();

for (const m of meshes) {
  const g = m.geometry;
  const pos = g.attributes.position as THREE.BufferAttribute;
  const base = verts.length / 3;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
    verts.push(v.x, v.y, v.z);
  }
  const index = g.index;
  const tri = index ? index.count / 3 : pos.count / 3;
  for (let t = 0; t < tri; t++) {
    const a = index ? index.getX(t * 3) : t * 3;
    const b = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const c = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    faces.push([base + a, base + b, base + c]);
  }
  counts.push({ name: m.name || m.geometry.type, vertices: pos.count });
}

const lines: string[] = [
  'ply',
  'format ascii 1.0',
  'comment Touchline stadium for AO baking',
  `element vertex ${verts.length / 3}`,
  'property float x',
  'property float y',
  'property float z',
  `element face ${faces.length}`,
  'property list uchar int vertex_indices',
  'end_header',
];
for (let i = 0; i < verts.length; i += 3) {
  // Blender is Z-up: (x, y, z)three → (x, -z, y)blender
  lines.push(`${verts[i]!.toFixed(4)} ${(-verts[i + 2]!).toFixed(4)} ${verts[i + 1]!.toFixed(4)}`);
}
for (const f of faces) lines.push(`3 ${f[0]} ${f[1]} ${f[2]}`);
fs.writeFileSync(path.join(outDir, 'stadium.ply'), lines.join('\n') + '\n');
fs.writeFileSync(
  path.join(outDir, 'stadium_meshes.json'),
  JSON.stringify({ totalVertices: verts.length / 3, meshes: counts }, null, 1),
);
console.log(
  `Exported ${meshes.length} meshes, ${verts.length / 3} vertices, ${faces.length} triangles to ${outDir}`,
);
