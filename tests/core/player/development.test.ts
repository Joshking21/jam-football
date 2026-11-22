// Tests for SPEC §12.3 & §12.4 Player Development and Age Decline
import { describe, it, expect } from 'vitest';
import {
  getBaseWeeklyGrowth,
  processPlayerDevelopment,
  getFocusAttributes,
} from '@/core/player/development';
import { Player, Position } from '@/core/types';
import { createRng } from '@/core/rng';
import { rawOvr } from '@/core/player/ratings';

function createMockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p_test',
    firstName: 'Marcus',
    lastName: 'Vance',
    nationality: 'ENG',
    age: 19,
    heightCm: 184,
    foot: 'Right',
    positions: [{ pos: 'ST' as Position, familiarity: 100 }],
    attributes: {
      finishing: 70,
      longShots: 65,
      passing: 60,
      crossing: 50,
      firstTouch: 68,
      dribbling: 72,
      tackling: 30,
      heading: 66,
      setPieces: 50,
      pace: 78,
      stamina: 75,
      strength: 70,
      offTheBall: 72,
      positioning: 64,
      decisions: 60,
      composure: 66,
      workRate: 70,
      reflexes: 5,
      handling: 5,
      oneOnOnes: 5,
      aerialCommand: 5,
    },
    potential: 85,
    personality: 'Ambitious',
    clubId: 'c01',
    squadNumber: 9,
    contract: { wagePerWeek: 5000, yearsLeft: 3, role: 'Starter' },
    condition: 100,
    fatigue: 0,
    morale: 80,
    injury: null,
    suspendedMatches: 0,
    yellowAccumulation: 0,
    form: [7.2, 7.5, 7.0],
    stats: {
      apps: 10,
      starts: 10,
      minutes: 900,
      minutesLastMatch: 90,
      goals: 5,
      assists: 2,
      yellow: 1,
      red: 0,
      ratingSum: 72,
      ratedApps: 10,
      motm: 1,
      cleanSheets: 0,
      shots: 25,
      shotsOnTarget: 15,
      keyPasses: 10,
      tacklesWon: 5,
      interceptions: 3,
      saves: 0,
      goalsConceded: 0,
    },
    transferListed: false,
    notForSale: false,
    scoutedBy: [],
    growth: 0,
    history: [],
    ...overrides,
  };
}

describe('SPEC §12.4 Base weekly growth by age', () => {
  it('correctly maps age tiers to base growth numbers', () => {
    expect(getBaseWeeklyGrowth(18)).toBe(0.45);
    expect(getBaseWeeklyGrowth(20)).toBe(0.45);
    expect(getBaseWeeklyGrowth(21)).toBe(0.3);
    expect(getBaseWeeklyGrowth(23)).toBe(0.3);
    expect(getBaseWeeklyGrowth(24)).toBe(0.12);
    expect(getBaseWeeklyGrowth(27)).toBe(0.12);
    expect(getBaseWeeklyGrowth(28)).toBe(0.0);
    expect(getBaseWeeklyGrowth(30)).toBe(0.0);
    expect(getBaseWeeklyGrowth(31)).toBe(-0.1);
    expect(getBaseWeeklyGrowth(33)).toBe(-0.1);
    expect(getBaseWeeklyGrowth(34)).toBe(-0.25);
    expect(getBaseWeeklyGrowth(38)).toBe(-0.25);
  });
});

describe('SPEC §12.3 Focus attribute lists', () => {
  it('returns appropriate attributes for outfield positions', () => {
    const attAttrs = getFocusAttributes('Attacking', 'ST', 22);
    expect(attAttrs).toContain('finishing');
    expect(attAttrs).toContain('dribbling');
    expect(attAttrs).toContain('offTheBall');

    const defAttrs = getFocusAttributes('Defending', 'CB', 24);
    expect(defAttrs).toContain('tackling');
    expect(defAttrs).toContain('positioning');

    const fitOld = getFocusAttributes('Fitness', 'CM', 31);
    expect(fitOld).toEqual(['stamina']);

    const fitYoung = getFocusAttributes('Fitness', 'CM', 22);
    expect(fitYoung).toContain('pace');
    expect(fitYoung).toContain('stamina');
    expect(fitYoung).toContain('strength');
  });

  it('handles GK positions properly', () => {
    const gkAttrs = getFocusAttributes('Balanced', 'GK', 25);
    expect(gkAttrs).toContain('reflexes');
    expect(gkAttrs).toContain('handling');
    expect(gkAttrs).toContain('oneOnOnes');
  });
});

describe('SPEC §12.4 processPlayerDevelopment', () => {
  it('accumulates fractional growth for young players with playing time', () => {
    const player = createMockPlayer({ age: 19, potential: 85, growth: 0.2 });
    const rng = createRng(12345);

    const res = processPlayerDevelopment(player, {
      focus: 'Attacking',
      intensity: 'Normal',
      minutesLastMatch: 90,
      rng,
    });

    // 0.45 base * headroom(85-69=16 => 1) * minutes(1.0) * intensity(1.0) * morale(1.1) = ~0.495
    expect(res.growthDelta).toBeGreaterThan(0.4);
    expect(res.player.growth).toBeGreaterThan(0.6);
  });

  it('triggers attribute boost when growth reaches or exceeds 1.0', () => {
    const player = createMockPlayer({ age: 19, potential: 88, growth: 0.95 });
    const rng = createRng(54321);

    const res = processPlayerDevelopment(player, {
      focus: 'Attacking',
      intensity: 'Hard', // 1.3 multiplier
      minutesLastMatch: 90,
      rng,
    });

    // Growth was 0.95 + >0.5 >= 1.0, so at least 1 round of +1 to 3 attributes fired
    expect(res.boostedAttributes.length).toBeGreaterThanOrEqual(3);
    expect(res.player.growth).toBeLessThan(1.0);
  });

  it('always includes individual focus attribute when boosting', () => {
    const player = createMockPlayer({ age: 19, potential: 88, growth: 0.99 });
    const rng = createRng(777);

    const res = processPlayerDevelopment(player, {
      focus: 'Balanced',
      intensity: 'Normal',
      minutesLastMatch: 90,
      individualFocus: 'finishing',
      rng,
    });

    expect(res.boostedAttributes).toContain('finishing');
    expect(res.player.attributes.finishing).toBe(71);
  });

  it('stops raising attributes once OVR reaches potential', () => {
    const player = createMockPlayer({
      age: 20,
      potential: 70, // already near potential
      growth: 0.98,
    });
    const rng = createRng(999);

    const initialOvr = Math.round(rawOvr(player.attributes, 'ST'));

    const res = processPlayerDevelopment(player, {
      focus: 'Attacking',
      intensity: 'Normal',
      minutesLastMatch: 90,
      rng,
    });

    const finalOvr = Math.round(rawOvr(res.player.attributes, 'ST'));
    expect(finalOvr).toBeLessThanOrEqual(player.potential);
  });

  it('handles veteran decline for players aged 34+ when growth <= -1.0', () => {
    const player = createMockPlayer({
      age: 35,
      growth: -0.9,
      attributes: {
        ...createMockPlayer().attributes,
        pace: 70,
        stamina: 68,
        strength: 75,
      },
    });
    const rng = createRng(888);

    const res = processPlayerDevelopment(player, {
      focus: 'Balanced',
      intensity: 'Normal',
      minutesLastMatch: 0,
      rng,
    });

    // Base growth is -0.25, bringing growth to <= -1.0
    expect(res.declinedAttributes.length).toBeGreaterThanOrEqual(3);
    // Physical attributes are declined first
    expect(res.declinedAttributes).toContain('pace');
    expect(res.declinedAttributes).toContain('stamina');
    expect(res.declinedAttributes).toContain('strength');
  });
});
