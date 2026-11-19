// Implements SPEC §9.5 and §22.1 Ratings unit tests
import { describe, it, expect } from 'vitest';
import { rawOvr, ovrAt } from '@/core/player/ratings';
import { Attributes } from '@/core/types';

describe('Player Ratings (SPEC §9.5)', () => {
  const dummyAttrs: Attributes = {
    finishing: 80,
    longShots: 75,
    passing: 70,
    crossing: 60,
    firstTouch: 75,
    dribbling: 78,
    tackling: 40,
    heading: 72,
    setPieces: 65,
    pace: 82,
    stamina: 75,
    strength: 70,
    offTheBall: 84,
    positioning: 50,
    decisions: 72,
    composure: 76,
    workRate: 70,
    reflexes: 10,
    handling: 10,
    oneOnOnes: 10,
    aerialCommand: 10,
  };

  it('calculates position-weighted raw OVR', () => {
    const stOvr = rawOvr(dummyAttrs, 'ST');
    expect(stOvr).toBeGreaterThanOrEqual(70);
    expect(stOvr).toBeLessThanOrEqual(85);

    // Same player in GK slot has low raw OVR
    const gkOvr = rawOvr(dummyAttrs, 'GK');
    expect(gkOvr).toBeLessThan(30);
  });

  it('adjusts OVR based on listed and unlisted position familiarity', () => {
    const player = {
      attributes: dummyAttrs,
      positions: [
        { pos: 'ST' as const, familiarity: 100 },
        { pos: 'LW' as const, familiarity: 85 },
      ],
    };

    const ovrPrimary = ovrAt(player, 'ST');
    const ovrSecondary = ovrAt(player, 'LW');
    const ovrSameGroup = ovrAt(player, 'RW'); // unlisted in same group (FWD) -> 0.80
    const ovrAdjacentGroup = ovrAt(player, 'AM'); // adjacent group (MID) -> 0.65
    const ovrGkSlot = ovrAt(player, 'GK'); // GK penalty -> 0.20

    expect(ovrPrimary).toBeGreaterThan(ovrSecondary);
    expect(ovrSecondary).toBeGreaterThan(ovrSameGroup);
    expect(ovrSameGroup).toBeGreaterThan(ovrAdjacentGroup);
    expect(ovrAdjacentGroup).toBeGreaterThan(ovrGkSlot);
  });
});
