// Implements SPEC §7.3 Deterministic Seeded RNG (sfc32 + splitmix32 + FNV-1a)

export type RngState = [number, number, number, number];

export interface Rng {
  next(): number;
  int(min: number, maxInclusive: number): number;
  pick<T>(arr: readonly T[]): T;
  weighted<T>(items: readonly T[], weightFn: (item: T) => number): T;
  normal(mean?: number, sd?: number): number;
  chance(p: number): boolean;
  state(): RngState;
}

function splitmix32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
}

export function createRng(seed: number): Rng {
  const sm = splitmix32(seed);
  return restoreRng([sm(), sm(), sm(), sm()]);
}

export function restoreRng(state: RngState): Rng {
  let [a, b, c, d] = state;
  let nextGaussian: number | null = null;

  const next = (): number => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };

  const int = (min: number, maxInclusive: number): number => {
    if (min >= maxInclusive) return min;
    return Math.floor(next() * (maxInclusive - min + 1)) + min;
  };

  const pick = <T>(arr: readonly T[]): T => {
    if (arr.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    const idx = int(0, arr.length - 1);
    return arr[idx]!;
  };

  const weighted = <T>(items: readonly T[], weightFn: (item: T) => number): T => {
    if (items.length === 0) {
      throw new Error('Cannot pick weighted from empty array');
    }
    let total = 0;
    for (let i = 0; i < items.length; i++) {
      const w = weightFn(items[i]!);
      if (w > 0) total += w;
    }
    if (total <= 0) {
      return items[0]!;
    }
    let r = next() * total;
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const w = weightFn(item);
      if (w > 0) {
        if (r <= w) return item;
        r -= w;
      }
    }
    return items[items.length - 1]!;
  };

  const normal = (mean = 0, sd = 1): number => {
    if (nextGaussian !== null) {
      const res = nextGaussian;
      nextGaussian = null;
      return mean + sd * res;
    }
    let u1 = next();
    while (u1 <= 1e-15) {
      u1 = next();
    }
    const u2 = next();
    const radius = Math.sqrt(-2.0 * Math.log(u1));
    const theta = 2.0 * Math.PI * u2;
    nextGaussian = radius * Math.sin(theta);
    return mean + sd * (radius * Math.cos(theta));
  };

  const chance = (p: number): boolean => {
    if (p <= 0) return false;
    if (p >= 1) return true;
    return next() < p;
  };

  const getState = (): RngState => [a, b, c, d];

  return {
    next,
    int,
    pick,
    weighted,
    normal,
    chance,
    state: getState,
  };
}

/**
 * Derives independent 32-bit seeds using FNV-1a hash algorithm (SPEC §7.3)
 */
export function deriveSeed(baseSeed: number, ...labels: (string | number)[]): number {
  let hash = 0x811c9dc5;
  const FNV_PRIME = 0x01000193;

  // Hash base seed (4 bytes)
  let s = baseSeed >>> 0;
  for (let i = 0; i < 4; i++) {
    hash ^= s & 0xff;
    hash = Math.imul(hash, FNV_PRIME);
    s >>>= 8;
  }

  // Hash labels
  for (let l = 0; l < labels.length; l++) {
    const str = String(labels[l]);
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i) & 0xff;
      hash = Math.imul(hash, FNV_PRIME);
    }
    // Delimiter between labels
    hash ^= 0xff;
    hash = Math.imul(hash, FNV_PRIME);
  }

  return hash >>> 0;
}
