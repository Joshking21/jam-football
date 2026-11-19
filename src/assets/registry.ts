// Implements SPEC §18.1 Asset registry

export interface AssetManifest {
  version: number;
  files: Record<string, { bytes: number }>;
}

let manifest: AssetManifest = {
  version: 1,
  files: {},
};

let isLoaded = false;

/**
 * Initializes the asset registry by loading asset-manifest.json.
 * Safe to call multiple times. Handles offline / test environments gracefully.
 */
export async function initAssetRegistry(): Promise<void> {
  if (isLoaded) return;
  try {
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      const response = await fetch('./asset-manifest.json');
      if (response.ok) {
        manifest = await response.json();
      }
    }
  } catch {
    // If running in test or before manifest generated, keep empty manifest
    manifest = { version: 1, files: {} };
  } finally {
    isLoaded = true;
  }
}

/**
 * Returns `./assets/<path>` if listed in the manifest, otherwise null.
 * Never request an unlisted file to ensure zero 404s in console.
 */
export function assetUrl(path: string): string | null {
  if (manifest.files[path]) {
    return `./assets/${path}`;
  }
  return null;
}

/**
 * Check if an asset is available in the manifest.
 */
export function hasAsset(path: string): boolean {
  return !!manifest.files[path];
}
