import { describe, it, expect } from 'vitest';
import {
  getPreMatchTalkContext,
  getHalfTimeTalkContext,
  getFullTimeTalkContext,
  predictTalkReaction,
  calculatePlayerTalkMorale,
  applyTeamTalk,
  TALK_BASE_EFFECTS,
} from '@/core/player/talks';
import { Player, Personality } from '@/core/types';
import { createRng } from '@/core/rng';

describe('Team Talks System (SPEC §12.8 & §16.3)', () => {
  describe('Context deduction', () => {
    it('determines pre-match context based on rating gap', () => {
      expect(getPreMatchTalkContext(80, 75)).toBe('PRE_FAV'); // gap >= 3
      expect(getPreMatchTalkContext(72, 78)).toBe('PRE_DOG'); // gap <= -3
      expect(getPreMatchTalkContext(75, 76)).toBe('PRE_EVEN'); // gap between -2 and 2
      expect(getPreMatchTalkContext(77, 75)).toBe('PRE_EVEN');
    });

    it('determines half-time context based on scoreline', () => {
      expect(getHalfTimeTalkContext(2, 0)).toBe('HT_WIN');
      expect(getHalfTimeTalkContext(0, 1)).toBe('HT_LOSE');
      expect(getHalfTimeTalkContext(1, 1)).toBe('HT_DRAW');
    });

    it('determines full-time context based on scoreline', () => {
      expect(getFullTimeTalkContext(3, 1)).toBe('FT_WIN');
      expect(getFullTimeTalkContext(0, 2)).toBe('FT_LOSE');
      expect(getFullTimeTalkContext(2, 2)).toBe('FT_DRAW');
    });
  });

  describe('predictTalkReaction', () => {
    it('returns "Most will respond well" for base delta >= 1.5', () => {
      expect(predictTalkReaction('FT_WIN', 'Praise')).toBe('Most will respond well'); // +5
      expect(predictTalkReaction('PRE_FAV', 'Demand')).toBe('Most will respond well'); // +3
    });

    it('returns "Mixed" for base delta between -0.5 and 1.5', () => {
      expect(predictTalkReaction('FT_WIN', 'Focus')).toBe('Mixed'); // +1
      expect(predictTalkReaction('PRE_FAV', 'Praise')).toBe('Mixed'); // 0
      expect(predictTalkReaction('FT_DRAW', 'Demand')).toBe('Mixed'); // 0
    });

    it('returns "Likely to backfire" for base delta < -0.5', () => {
      expect(predictTalkReaction('FT_WIN', 'Disappoint')).toBe('Likely to backfire'); // -5
      expect(predictTalkReaction('PRE_DOG', 'Demand')).toBe('Likely to backfire'); // -2
    });
  });

  describe('calculatePlayerTalkMorale and Personality Modifiers', () => {
    it('Professional handles Demand/Focus without going below 0', () => {
      const rng = createRng(123);
      // Under PRE_DOG, Demand base is -2. Professional should clamp negative Demand/Focus to 0.
      const profDelta = calculatePlayerTalkMorale('PRE_DOG', 'Demand', 'Professional', rng);
      expect(profDelta).toBe(0);

      // Positive works normally
      const profPositive = calculatePlayerTalkMorale('PRE_FAV', 'Demand', 'Professional', rng);
      expect(profPositive).toBe(3);
    });

    it('Ambitious scales Demand/Focus up (x1.2) and Calm down (x0.8)', () => {
      const rng = createRng(123);
      // HT_WIN Demand is 2 -> 2 * 1.2 = 2.4 -> round 2
      expect(calculatePlayerTalkMorale('HT_WIN', 'Demand', 'Ambitious', rng)).toBe(2);
      // PRE_FAV Demand is 3 -> 3 * 1.2 = 3.6 -> round 4
      expect(calculatePlayerTalkMorale('PRE_FAV', 'Demand', 'Ambitious', rng)).toBe(4);
      // PRE_DOG Calm is 3 -> 3 * 0.8 = 2.4 -> round 2
      expect(calculatePlayerTalkMorale('PRE_DOG', 'Calm', 'Ambitious', rng)).toBe(2);
    });

    it('Leader scales all positive effects by x1.3', () => {
      const rng = createRng(123);
      // FT_WIN Praise is 5 -> 5 * 1.3 = 6.5 -> round 7 (or 6 depending on math.round)
      const leaderDelta = calculatePlayerTalkMorale('FT_WIN', 'Praise', 'Leader', rng);
      expect(leaderDelta).toBeGreaterThanOrEqual(6);

      // Negative effects remain untouched (not scaled by x1.3)
      const leaderNeg = calculatePlayerTalkMorale('FT_WIN', 'Disappoint', 'Leader', rng);
      expect(leaderNeg).toBe(-5);
    });

    it('Relaxed dampens negative by 0.5 and positive by 0.8', () => {
      const rng = createRng(123);
      // FT_WIN Disappoint is -5 -> -5 * 0.5 = -2.5 -> Math.round(-2.5) = -2
      const relaxedNeg = calculatePlayerTalkMorale('FT_WIN', 'Disappoint', 'Relaxed', rng);
      expect(relaxedNeg).toBe(-2);

      // FT_WIN Praise is 5 -> 5 * 0.8 = 4.0 -> 4
      const relaxedPos = calculatePlayerTalkMorale('FT_WIN', 'Praise', 'Relaxed', rng);
      expect(relaxedPos).toBe(4);
    });

    it('Temperamental scales by x1.3 and can invert Demand / Disappoint', () => {
      // Test over many iterations to verify sign flip behavior
      let flipped = false;
      let notFlipped = false;
      for (let seed = 1; seed <= 50; seed++) {
        const rng = createRng(seed);
        const delta = calculatePlayerTalkMorale('HT_WIN', 'Disappoint', 'Temperamental', rng);
        // Base is -4. Flipped: 4 * 1.3 = 5.2 -> 5. Not flipped: -4 * 1.3 = -5.2 -> -5.
        if (delta > 0) flipped = true;
        if (delta < 0) notFlipped = true;
      }
      expect(flipped).toBe(true);
      expect(notFlipped).toBe(true);
    });

    it('Loyal boosts Praise by x1.3', () => {
      const rng = createRng(123);
      // FT_WIN Praise is 5 -> 5 * 1.3 = 6.5 -> 7
      const loyalDelta = calculatePlayerTalkMorale('FT_WIN', 'Praise', 'Loyal', rng);
      expect(loyalDelta).toBe(7);

      // Other tones remain x1.0
      const loyalCalm = calculatePlayerTalkMorale('FT_WIN', 'Calm', 'Loyal', rng);
      expect(loyalCalm).toBe(1);
    });
  });

  describe('applyTeamTalk squad application', () => {
    function makeMockPlayer(id: string, personality: Personality, morale: number): Player {
      return {
        id,
        clubId: 'c1',
        firstName: 'John',
        lastName: `Player_${id}`,
        birthDate: '2000-01-01',
        age: 24,
        nationality: 'ENG',
        positions: ['CM'],
        primaryPosition: 'CM',
        foot: 'Right',
        attributes: {
          pace: 70,
          acceleration: 70,
          stamina: 70,
          strength: 70,
          agility: 70,
          jumping: 70,
          finishing: 70,
          dribbling: 70,
          passing: 70,
          tackling: 70,
          heading: 70,
          vision: 70,
          positioning: 70,
          composure: 70,
          workRate: 70,
        },
        potential: 80,
        currentAbility: 70,
        condition: 100,
        sharpness: 100,
        morale,
        fatigue: 0,
        personality,
        preferredSquadNumber: 8,
        contract: {
          wagePerWeek: 1000,
          expiresSeasonEndYear: 2028,
        },
        stats: {
          appearances: 10,
          starts: 10,
          subMinutes: 0,
          goals: 2,
          assists: 1,
          cleanSheets: 0,
          yellowCards: 0,
          redCards: 0,
          minutesPlayed: 900,
          averageRating: 7.1,
          goalsConceded: 0,
          playerOfTheMatch: 1,
        },
        seasonHistory: [],
      } as unknown as Player;
    }

    it('updates morale for all squad members within [0, 100]', () => {
      const players: Record<string, Player> = {
        p1: makeMockPlayer('p1', 'Professional', 50),
        p2: makeMockPlayer('p2', 'Ambitious', 98),
        p3: makeMockPlayer('p3', 'Leader', 10),
      };

      const rng = createRng(42);
      const res = applyTeamTalk(players, ['p1', 'p2', 'p3'], 'PRE_FAV', 'Demand', rng);

      // p2 had 98 morale, + Demand should cap at 100
      expect(res.updatedPlayers['p2']!.morale).toBeLessThanOrEqual(100);
      expect(res.updatedPlayers['p1']!.morale).toBeGreaterThan(50);
      expect(res.averageMoraleDelta).toBeGreaterThan(0);
      expect(res.focusBoost).toBeGreaterThan(0);
      expect(res.managerSpeech.length).toBeGreaterThan(5);
      expect(res.squadReaction.length).toBeGreaterThan(5);
    });

    it('sets focusBoost to 0 for full-time talks', () => {
      const players: Record<string, Player> = {
        p1: makeMockPlayer('p1', 'Professional', 70),
      };
      const rng = createRng(42);
      const res = applyTeamTalk(players, ['p1'], 'FT_WIN', 'Praise', rng);
      expect(res.focusBoost).toBe(0);
      expect(res.averageMoraleDelta).toBe(5);
    });
  });
});
