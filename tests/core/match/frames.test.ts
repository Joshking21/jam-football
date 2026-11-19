// Implements SPEC §22.1 Coordinate frame and zone tests
import { describe, it, expect } from 'vitest';
import {
  toAbsolute,
  toAttacking,
  getThird,
  getLane,
  getZoneKey,
  isInBox,
  isInSixYard,
  getMirroredZoneKey,
} from '@/core/match/frames';

describe('Coordinate Frames & Zones (SPEC §13.1)', () => {
  const sides = ['home', 'away'] as const;
  const halves = [1, 2] as const;

  it('round-trips coordinates across both halves and both sides', () => {
    const testPoints = [
      { ax: 0, ay: 0 },
      { ax: 105, ay: 68 },
      { ax: 52.5, ay: 34 },
      { ax: 18.2, ay: 45.6 },
      { ax: 90.0, ay: 20.0 },
    ];

    for (const side of sides) {
      for (const half of halves) {
        for (const pt of testPoints) {
          const abs = toAbsolute(pt.ax, pt.ay, side, half);
          expect(abs.x).toBeGreaterThanOrEqual(0);
          expect(abs.x).toBeLessThanOrEqual(105);
          expect(abs.y).toBeGreaterThanOrEqual(0);
          expect(abs.y).toBeLessThanOrEqual(68);

          const back = toAttacking(abs.x, abs.y, side, half);
          expect(back.ax).toBeCloseTo(pt.ax, 4);
          expect(back.ay).toBeCloseTo(pt.ay, 4);
        }
      }
    }
  });

  it('classifies thirds at boundaries properly', () => {
    expect(getThird(0)).toBe('DEF');
    expect(getThird(34.99)).toBe('DEF');
    expect(getThird(35.0)).toBe('MID');
    expect(getThird(69.99)).toBe('MID');
    expect(getThird(70.0)).toBe('ATT');
    expect(getThird(105)).toBe('ATT');
  });

  it('classifies lanes at boundaries properly', () => {
    expect(getLane(0)).toBe('Left');
    expect(getLane(22.66)).toBe('Left');
    expect(getLane(22.67)).toBe('Centre');
    expect(getLane(45.32)).toBe('Centre');
    expect(getLane(45.33)).toBe('Right');
    expect(getLane(68)).toBe('Right');
  });

  it('correctly maps 9 zone keys', () => {
    expect(getZoneKey(10, 10)).toBe('DL');
    expect(getZoneKey(10, 34)).toBe('DC');
    expect(getZoneKey(10, 50)).toBe('DR');
    expect(getZoneKey(50, 10)).toBe('ML');
    expect(getZoneKey(50, 34)).toBe('MC');
    expect(getZoneKey(50, 50)).toBe('MR');
    expect(getZoneKey(80, 10)).toBe('AL');
    expect(getZoneKey(80, 34)).toBe('AC');
    expect(getZoneKey(80, 50)).toBe('AR');
  });

  it('accurately identifies penalty box and six-yard box bounds', () => {
    expect(isInBox(90, 34)).toBe(true);
    expect(isInBox(88.4, 34)).toBe(false); // Outside box (too far back)
    expect(isInBox(90, 10)).toBe(false); // Wide of box

    expect(isInSixYard(100, 34)).toBe(true);
    expect(isInSixYard(99.0, 34)).toBe(false); // Outside 6-yard
    expect(isInSixYard(100, 20)).toBe(false); // Wide of 6-yard
  });

  it('mirrors defensive zones correctly (SPEC §13.5)', () => {
    expect(getMirroredZoneKey('DL')).toBe('AR');
    expect(getMirroredZoneKey('DC')).toBe('AC');
    expect(getMirroredZoneKey('DR')).toBe('AL');
    expect(getMirroredZoneKey('ML')).toBe('MR');
    expect(getMirroredZoneKey('MC')).toBe('MC');
    expect(getMirroredZoneKey('MR')).toBe('ML');
    expect(getMirroredZoneKey('AL')).toBe('DR');
    expect(getMirroredZoneKey('AC')).toBe('DC');
    expect(getMirroredZoneKey('AR')).toBe('DL');
  });
});
