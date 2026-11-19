// Unit tests for asset registry (SPEC §18.1)
import { describe, it, expect } from 'vitest';
import { assetUrl, hasAsset } from '@/assets/registry';

describe('Asset registry', () => {
  it('returns null for unlisted assets to avoid 404s', () => {
    expect(assetUrl('models/player.glb')).toBeNull();
    expect(hasAsset('images/crests/c01.webp')).toBe(false);
  });
});
