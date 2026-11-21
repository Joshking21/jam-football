// Implements SPEC §14.8 & §18.3 GLTF Model Loader with MeshoptDecoder, caching, and cloning
import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { assetUrl } from '../assets/registry';

const gltfCache = new Map<string, GLTF>();
let loader: GLTFLoader | null = null;

function getLoader(): GLTFLoader {
  if (!loader) {
    loader = new GLTFLoader();
    try {
      loader.setMeshoptDecoder(MeshoptDecoder);
    } catch (e) {
      console.warn('MeshoptDecoder initialization skipped:', e);
    }
  }
  return loader;
}

/**
 * Loads a GLTF model asset if listed in the asset manifest registry.
 * Caches loaded models so each file is only fetched once per session.
 * Returns null if the asset is missing or fails to load, falling back to procedural meshes.
 */
export async function loadModelAsset(path: string): Promise<GLTF | null> {
  const url = assetUrl(path);
  if (!url) {
    return null; // Missing in registry: procedural fallback
  }

  if (gltfCache.has(path)) {
    return gltfCache.get(path)!;
  }

  return new Promise((resolve) => {
    getLoader().load(
      url,
      (gltf) => {
        gltfCache.set(path, gltf);
        resolve(gltf);
      },
      undefined,
      (err) => {
        console.warn(`Failed to load 3D model asset "${path}", using procedural fallback.`, err);
        resolve(null);
      },
    );
  });
}

/**
 * Clones a cached GLTF scene with properly cloned skeletons and bone bindings (§14.8, §18.3).
 */
export function cloneModelScene(gltf: GLTF): THREE.Group {
  return SkeletonUtils.clone(gltf.scene) as THREE.Group;
}
