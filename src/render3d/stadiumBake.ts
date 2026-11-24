// Baked ambient occlusion for the procedural stadium (§14.10: baked AO allowed for static objects).
// tools/blender/bake_stadium_ao.py bakes one AO value per vertex in Blender (Cycles), from the
// geometry scripts/export-stadium-geometry.ts exports. Here the game multiplies those values into
// the stadium's vertex colours. AO is lighting-independent, so it holds for night, afternoon, rain
// and every club's colours. With no bake file, the stadium renders as before.
import * as THREE from 'three';
import { assetUrl } from '../assets/registry';

/** The stadium meshes that receive AO, in a fixed order (shared by the exporter and the game). */
export function bakeableMeshes(group: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  group.traverse((o) => {
    if (o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh)) out.push(o);
  });
  return out;
}

interface BakeMeta {
  totalVertices: number;
  meshes: { name: string; vertices: number }[];
}

/** Multiplies baked per-vertex AO (0–255) into the meshes' vertex colours. Returns false if it doesn't fit. */
export function applyStadiumAO(group: THREE.Object3D, ao: Uint8Array, meta: BakeMeta): boolean {
  const meshes = bakeableMeshes(group);
  if (meshes.length !== meta.meshes.length) return false;
  for (let i = 0; i < meshes.length; i++) {
    const n = (meshes[i]!.geometry.attributes.position as THREE.BufferAttribute).count;
    if (n !== meta.meshes[i]!.vertices) return false;
  }
  if (ao.length < meta.totalVertices) return false;

  const materials = new Set<THREE.MeshStandardMaterial>();
  let offset = 0;
  for (const m of meshes) {
    // Geometries can be shared between meshes (pillars, corner blocks): each needs its own AO.
    m.geometry = m.geometry.clone();
    const g = m.geometry;
    const n = (g.attributes.position as THREE.BufferAttribute).count;
    const existing = g.attributes.color as THREE.BufferAttribute | undefined;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = ao[offset + i]! / 255;
      // Keep a floor so crevices read as shade, not black.
      const k = 0.18 + 0.82 * a;
      colors[i * 3] = (existing ? existing.getX(i) : 1) * k;
      colors[i * 3 + 1] = (existing ? existing.getY(i) : 1) * k;
      colors[i * 3 + 2] = (existing ? existing.getZ(i) : 1) * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    offset += n;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((mat) => {
      if (mat instanceof THREE.MeshStandardMaterial) materials.add(mat);
    });
  }
  materials.forEach((mat) => {
    mat.vertexColors = true;
    mat.needsUpdate = true;
  });
  return true;
}

/** Loads the bake if it was delivered (asset manifest) and applies it. Safe to call and forget. */
export async function loadStadiumAO(group: THREE.Object3D): Promise<boolean> {
  const binUrl = assetUrl('bake/stadium_ao.bin');
  const metaUrl = assetUrl('bake/stadium_ao.json');
  if (!binUrl || !metaUrl) return false;
  try {
    const [bin, meta] = await Promise.all([
      fetch(binUrl).then((r) => r.arrayBuffer()),
      fetch(metaUrl).then((r) => r.json() as Promise<BakeMeta>),
    ]);
    const ok = applyStadiumAO(group, new Uint8Array(bin), meta);
    if (!ok) console.warn('Stadium AO bake does not match the stadium geometry; re-bake it.');
    return ok;
  } catch (e) {
    console.warn('Stadium AO bake not applied:', e);
    return false;
  }
}
