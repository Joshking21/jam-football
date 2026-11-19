// Unit tests for math and money formatting (SPEC §6, §13.4)
import { describe, it, expect } from 'vitest';
import { z, sigmoid, logit, clamp, formatMoney } from '@/core/math';

describe('Math utilities', () => {
  it('z-units converts 50 to 0, 75 to 1, and 25 to -1', () => {
    expect(z(50)).toBe(0);
    expect(z(75)).toBe(1);
    expect(z(25)).toBe(-1);
  });

  it('sigmoid correctly maps values to (0, 1)', () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 4);
    expect(sigmoid(5)).toBeGreaterThan(0.99);
    expect(sigmoid(-5)).toBeLessThan(0.01);
  });

  it('logit and sigmoid are approximate inverses', () => {
    const val = 0.75;
    expect(sigmoid(logit(val))).toBeCloseTo(val, 3);
  });

  it('clamp restricts values to min and max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('formatMoney formats amounts with € and proper units', () => {
    expect(formatMoney(12_400_000)).toBe('€12.4M');
    expect(formatMoney(850_000)).toBe('€850K');
    expect(formatMoney(9_500)).toBe('€9,500');
    expect(formatMoney(40_000_000)).toBe('€40M');
    expect(formatMoney(-5_000_000)).toBe('-€5M');
  });
});
