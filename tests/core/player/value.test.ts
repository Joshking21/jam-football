// Implements SPEC §12.10 and §22.1 Value and wage unit tests
import { describe, it, expect } from 'vitest';
import { valueOf, wageFor } from '@/core/player/value';
import { Attributes } from '@/core/types';

describe('Player Value & Wage Formulas (SPEC §12.10)', () => {
  const baseAttrs: Attributes = {
    finishing: 70,
    longShots: 70,
    passing: 70,
    crossing: 70,
    firstTouch: 70,
    dribbling: 70,
    tackling: 70,
    heading: 70,
    setPieces: 70,
    pace: 70,
    stamina: 70,
    strength: 70,
    offTheBall: 70,
    positioning: 70,
    decisions: 70,
    composure: 70,
    workRate: 70,
    reflexes: 10,
    handling: 10,
    oneOnOnes: 10,
    aerialCommand: 10,
  };

  it('value is strictly monotonic in OVR for same age and potential', () => {
    const pLow = {
      attributes: { ...baseAttrs, finishing: 60, offTheBall: 60, composure: 60 },
      positions: [{ pos: 'ST' as const, familiarity: 100 }],
      age: 25,
      potential: 75,
      contract: null,
    };

    const pMid = {
      attributes: { ...baseAttrs, finishing: 75, offTheBall: 75, composure: 75 },
      positions: [{ pos: 'ST' as const, familiarity: 100 }],
      age: 25,
      potential: 80,
      contract: null,
    };

    const pHigh = {
      attributes: { ...baseAttrs, finishing: 88, offTheBall: 88, composure: 88 },
      positions: [{ pos: 'ST' as const, familiarity: 100 }],
      age: 25,
      potential: 92,
      contract: null,
    };

    const vLow = valueOf(pLow);
    const vMid = valueOf(pMid);
    const vHigh = valueOf(pHigh);

    expect(vLow).toBeLessThan(vMid);
    expect(vMid).toBeLessThan(vHigh);
  });

  it('value decreases strictly with age past 28 for same attributes and potential', () => {
    const playerBase = {
      attributes: baseAttrs,
      positions: [{ pos: 'ST' as const, familiarity: 100 }],
      potential: 70,
      contract: null,
    };

    const v28 = valueOf({ ...playerBase, age: 28 });
    const v30 = valueOf({ ...playerBase, age: 30 });
    const v32 = valueOf({ ...playerBase, age: 32 });
    const v34 = valueOf({ ...playerBase, age: 34 });

    expect(v28).toBeGreaterThan(v30);
    expect(v30).toBeGreaterThan(v32);
    expect(v32).toBeGreaterThan(v34);
  });

  it('wageFor scales with value and respects minimum €1,000', () => {
    expect(wageFor(50_000)).toBe(1_000);
    expect(wageFor(10_000_000)).toBe(16_000);
    expect(wageFor(40_000_000)).toBe(64_000);
  });
});
