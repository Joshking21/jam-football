// Implements SPEC §22.1 RNG unit tests
import { describe, it, expect } from 'vitest';
import { createRng, restoreRng, deriveSeed } from '@/core/rng';

describe('RNG (sfc32 / splitmix32 / FNV-1a)', () => {
  it('same seed produces identical sequence', () => {
    const seed = 20261118;
    const rng1 = createRng(seed);
    const rng2 = createRng(seed);

    for (let i = 0; i < 100; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });

  it('different seeds produce different sequences', () => {
    const rng1 = createRng(1001);
    const rng2 = createRng(1002);
    let allSame = true;

    for (let i = 0; i < 20; i++) {
      if (rng1.next() !== rng2.next()) {
        allSame = false;
        break;
      }
    }
    expect(allSame).toBe(false);
  });

  it('state save and restore reproduces exact continuation', () => {
    const rng = createRng(42);
    for (let i = 0; i < 50; i++) {
      rng.next();
    }

    const savedState = rng.state();
    const next10FromOriginal = Array.from({ length: 10 }, () => rng.next());

    const restoredRng = restoreRng(savedState);
    const next10FromRestored = Array.from({ length: 10 }, () => restoredRng.next());

    expect(next10FromRestored).toEqual(next10FromOriginal);
  });

  it('deriveSeed produces stable and distinct 32-bit seeds', () => {
    const base = 20261118;
    const s1 = deriveSeed(base, 'match', 'f001');
    const s2 = deriveSeed(base, 'match', 'f001');
    const s3 = deriveSeed(base, 'match', 'f002');
    const s4 = deriveSeed(base, 'training', 1);

    expect(s1).toBe(s2);
    expect(s1).not.toBe(s3);
    expect(s1).not.toBe(s4);
    expect(s1).toBeGreaterThanOrEqual(0);
    expect(s1).toBeLessThanOrEqual(4294967295);
  });

  it('int produces values within [min, maxInclusive]', () => {
    const rng = createRng(12345);
    const min = 3;
    const max = 7;
    const counts = new Map<number, number>();

    for (let i = 0; i < 1000; i++) {
      const v = rng.int(min, max);
      expect(v).toBeGreaterThanOrEqual(min);
      expect(v).toBeLessThanOrEqual(max);
      counts.set(v, (counts.get(v) || 0) + 1);
    }

    // Check every integer was generated
    for (let i = min; i <= max; i++) {
      expect(counts.get(i) || 0).toBeGreaterThan(50);
    }
  });

  it('normal distribution produces mean close to target', () => {
    const rng = createRng(999);
    let sum = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      sum += rng.normal(50, 10);
    }
    const sampleMean = sum / n;
    expect(sampleMean).toBeGreaterThan(49.0);
    expect(sampleMean).toBeLessThan(51.0);
  });
});
