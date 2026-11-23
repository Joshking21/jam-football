import { describe, it, expect } from 'vitest';
import { formatMatchClock } from '@/ui/screens/Match/clock';

describe('formatMatchClock (REVIEW-M4 B2, SPEC §14.5)', () => {
  it('formats negative time by clamping to 00:00', () => {
    expect(formatMatchClock(-39)).toBe('00:00');
    expect(formatMatchClock(-1)).toBe('00:00');
  });

  it('formats 0 seconds as 00:00', () => {
    expect(formatMatchClock(0)).toBe('00:00');
  });

  it('formats 59 seconds as 00:59', () => {
    expect(formatMatchClock(59)).toBe('00:59');
  });

  it('formats 60 seconds as 01:00', () => {
    expect(formatMatchClock(60)).toBe('01:00');
  });

  it('formats 2,700 seconds (45 min) as 45:00', () => {
    expect(formatMatchClock(2700, 1)).toBe('45:00');
  });

  it('formats first half stoppage time as 45+X', () => {
    expect(formatMatchClock(2700 + 60, 1)).toBe('45+1');
    expect(formatMatchClock(2700 + 120, 1)).toBe('45+2');
  });

  it('formats second half 5,400 seconds (90 min) as 90:00', () => {
    expect(formatMatchClock(5400, 2)).toBe('90:00');
  });

  it('formats second half stoppage time as 90+X', () => {
    expect(formatMatchClock(5400 + 60, 2)).toBe('90+1');
    expect(formatMatchClock(5400 + 180, 2)).toBe('90+3');
  });
});
