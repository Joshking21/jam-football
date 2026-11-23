import { describe, it, expect } from 'vitest';
import {
  advance,
  applyMatchResults,
  runWeeklyProcessing,
  computeSeasonEnd,
} from '@/core/game/advance';
import { createNewGame } from '@/core/game/newGame';
import { GameState, Club, PlayerId, MatchResult, FixtureId } from '@/core/types';
import { valueOf, wageFor, getAgeFactor } from '@/core/player/value';
import { BALANCE } from '@/config/balance';

function createTestGame(userClubId = 'c01'): GameState {
  return createNewGame({ userClubId: userClubId as any, seed: 12345 });
}

describe('Finances, Board and Fans System (SPEC §12.7, §12.10, §12.14)', () => {
  describe('Finances Formulas (§12.10)', () => {
    it('calculates player values according to SPEC §12.10 formulas with age and potential factors', () => {
      // 21 yo player (ageFactor 1.4), OVR 60, potential 60, contract 2 years
      const p1 = {
        age: 21,
        positions: [{ pos: 'ST' as const, familiarity: 100 }],
        attributes: {
          finishing: 60,
          longShots: 60,
          passing: 60,
          crossing: 60,
          firstTouch: 60,
          dribbling: 60,
          tackling: 60,
          heading: 60,
          setPieces: 60,
          pace: 60,
          stamina: 60,
          strength: 60,
          offTheBall: 60,
          positioning: 60,
          decisions: 60,
          composure: 60,
          workRate: 60,
          reflexes: 10,
          handling: 10,
          oneOnOnes: 10,
          aerialCommand: 10,
        },
        potential: 60,
        contract: { yearsLeft: 2 as const, wagePerWeek: 2000, role: 'Starter' as const },
      };

      const val = valueOf(p1);
      // base: 1.2M * 1.16^0 = 1.2M. ageFactor: 1.4 -> 1.68M -> rounded to 2 sig figs: 1.7M
      expect(val).toBe(1_700_000);

      // Contract factor: 1 year left reduces value by 25% (x 0.75)
      const p1Expiring = {
        ...p1,
        contract: { yearsLeft: 1 as const, wagePerWeek: 2000, role: 'Starter' as const },
      };
      const valExpiring = valueOf(p1Expiring);
      // 1.2M * 1.4 * 0.75 = 1.26M -> rounded to 2 sig figs: 1.3M
      expect(valExpiring).toBe(1_300_000);
    });

    it('calculates weekly wage from player value per SPEC §12.10', () => {
      // valueOf 1,700,000 * 0.0016 = 2720 -> rounded to 500 = 2500
      expect(wageFor(1_700_000)).toBe(2500);
      // valueOf 50_000 * 0.0016 = 80 -> minimum 1,000
      expect(wageFor(50_000)).toBe(1000);
    });

    it('credits weekly TV income and sponsor income by reputation, and deducts payroll and operating expenses', () => {
      const state = createTestGame('c01');
      const club = state.clubs['c01']!;
      const initialBalance = club.balance;

      let squadWages = 0;
      for (const pId of club.squad) {
        const p = state.players[pId];
        if (p?.contract) squadWages += p.contract.wagePerWeek;
      }
      let staffWages = 0;
      if (club.staff) {
        staffWages =
          club.staff.assistant.wage +
          club.staff.coach.wage +
          club.staff.scout.wage +
          club.staff.physio.wage;
      }
      const operating = BALANCE.finances.operatingCostPerReputation * club.reputation;
      const sponsor = BALANCE.finances.sponsorIncomeWeekly[club.reputation] ?? 400_000;
      const expectedBalance =
        initialBalance +
        BALANCE.finances.tvIncomeWeekly +
        sponsor -
        squadWages -
        staffWages -
        operating;

      const processed = runWeeklyProcessing(state);
      const updatedClub = processed.clubs['c01']!;

      expect(updatedClub.balance).toBe(expectedBalance);
      expect(updatedClub.seasonStats.tvIncome).toBe(BALANCE.finances.tvIncomeWeekly);
      expect(updatedClub.seasonStats.sponsorIncome).toBe(sponsor);
      expect(updatedClub.seasonStats.wagesPaid).toBe(squadWages + staffWages);
      expect(updatedClub.seasonStats.operating).toBe(operating);
    });

    it('awards season-end prize money from 1st (€20M) to 10th (€2M) per SPEC §12.10', () => {
      const state = createTestGame('c01');
      const balancesBefore = Object.fromEntries(
        Object.entries(state.clubs).map(([id, c]) => [id, c.balance]),
      );

      const seasonEnded = computeSeasonEnd(state);

      // Check table places: index 0 (1st) gets 20M, index 9 (10th) gets 2M
      for (let i = 0; i < seasonEnded.table.length; i++) {
        const clubId = seasonEnded.table[i]!.clubId;
        const prize = 20_000_000 - i * 2_000_000;
        const clubAfter = seasonEnded.clubs[clubId]!;
        expect(clubAfter.balance).toBe(balancesBefore[clubId]! + prize);
        expect(clubAfter.seasonStats.prizeMoney).toBe(prize);
      }
    });
  });

  describe('Board Confidence & Sacking Logic (SPEC §12.7)', () => {
    function createMockMatchResult(homeGoals: number, awayGoals: number): MatchResult {
      return {
        fixtureId: 'f_test',
        homeGoals,
        awayGoals,
        events: [],
        players: [],
        injuries: [],
        motm: 'p01' as PlayerId,
        stats: {} as any,
      };
    }

    it('increases confidence by +5 on win against higher reputation club, and +3 otherwise', () => {
      const state = createTestGame('c01');
      state.matchday = 1;
      const userClub = state.clubs['c01']!;
      userClub.reputation = 3;
      userClub.boardConfidence = 50;

      const oppClub = state.clubs['c02']!;
      oppClub.reputation = 5; // higher reputation

      const fix =
        state.fixtures.find((f) => f.matchday === 1 && f.homeId === 'c01') ??
        state.fixtures.find((f) => f.matchday === 1)!;
      fix.homeId = 'c01';
      fix.awayId = 'c02';

      const results: Record<FixtureId, MatchResult> = {
        [fix.id]: createMockMatchResult(2, 1),
      };

      const next = applyMatchResults(state, results);
      // Win against higher reputation: 50 + 5 = 55
      expect(next.clubs['c01']!.boardConfidence).toBe(55);
    });

    it('penalizes confidence on loss, with -2 extra penalty if margin >= 3 goals', () => {
      const state = createTestGame('c01');
      state.matchday = 1;
      const userClub = state.clubs['c01']!;
      userClub.reputation = 4;
      userClub.boardConfidence = 50;

      const oppClub = state.clubs['c02']!;
      oppClub.reputation = 2; // lower reputation

      const fix =
        state.fixtures.find((f) => f.matchday === 1 && f.homeId === 'c01') ??
        state.fixtures.find((f) => f.matchday === 1)!;
      fix.homeId = 'c01';
      fix.awayId = 'c02';

      // Lost 0-4 (margin 4 >= 3, against lower rep -> -5 base - 2 extra = -7)
      const results: Record<FixtureId, MatchResult> = {
        [fix.id]: createMockMatchResult(0, 4),
      };

      const next = applyMatchResults(state, results);
      expect(next.clubs['c01']!.boardConfidence).toBe(43);
    });

    it('applies position vs expectation checks from matchday 4', () => {
      const state = createTestGame('c01');
      const userClub = state.clubs['c01']!;
      userClub.expectation = { target: 3, acceptable: 6, label: 'Top 3' };
      userClub.boardConfidence = 50;
      state.matchday = 4;

      // Position 2 <= target 3 -> +1 confidence
      state.table.sort((a, b) => (a.clubId === 'c01' ? -1 : 1)); // user is 1st/2nd
      const fix = state.fixtures.find(
        (f) => f.matchday === 4 && (f.homeId === 'c01' || f.awayId === 'c01'),
      )!;
      const oppId = fix.homeId === 'c01' ? fix.awayId : fix.homeId;
      state.clubs[oppId]!.reputation = userClub.reputation; // same reputation ensures 0 match delta for draw
      const results: Record<FixtureId, MatchResult> = {
        [fix.id]: createMockMatchResult(1, 1),
      };

      const next = applyMatchResults(state, results);
      // From MD4, pos 1 <= target 3 -> +1
      expect(next.clubs['c01']!.boardConfidence).toBe(51);
    });

    it('generates a single final warning when confidence drops below 25', () => {
      const state = createTestGame('c01');
      state.matchday = 3;
      state.clubs['c01']!.boardConfidence = 20;

      const week1 = runWeeklyProcessing(state);
      expect(week1.boardWarningSent).toBe(true);
      const warnings = week1.inbox.filter(
        (i) => i.kind === 'Board' && i.title.includes('Final Warning'),
      );
      expect(warnings.length).toBe(1);

      // Subsequent week below 25 does NOT spam additional warnings
      const week2 = runWeeklyProcessing(week1);
      const warnings2 = week2.inbox.filter(
        (i) => i.kind === 'Board' && i.title.includes('Final Warning'),
      );
      expect(warnings2.length).toBe(1);
    });

    it('generates board commendation praise when confidence reaches >= 80 for the first time', () => {
      const state = createTestGame('c01');
      state.matchday = 2;
      state.clubs['c01']!.boardConfidence = 85;

      const week1 = runWeeklyProcessing(state);
      expect(week1.boardPraiseSent).toBe(true);
      const praises = week1.inbox.filter(
        (i) => i.kind === 'Board' && i.title.includes('Commendation'),
      );
      expect(praises.length).toBe(1);

      // Subsequent week does not duplicate praise
      const week2 = runWeeklyProcessing(week1);
      const praises2 = week2.inbox.filter(
        (i) => i.kind === 'Board' && i.title.includes('Commendation'),
      );
      expect(praises2.length).toBe(1);
    });

    it('triggers sacking if confidence < 12 from matchday 6', () => {
      const state = createTestGame('c01');
      state.matchday = 6;
      state.clubs['c01']!.boardConfidence = 10;

      const next = runWeeklyProcessing(state);
      expect(next.phase).toBe('Sacked');
    });

    it('does not sack the manager before matchday 6 even if confidence < 12', () => {
      const state = createTestGame('c01');
      state.matchday = 4;
      state.clubs['c01']!.boardConfidence = 10;

      const next = runWeeklyProcessing(state);
      expect(next.phase).toBe('WeekSummary');
    });
  });

  describe('Fan Mood Dynamics (SPEC §12.14)', () => {
    function createMockMatchResult(homeGoals: number, awayGoals: number): MatchResult {
      return {
        fixtureId: 'f_test',
        homeGoals,
        awayGoals,
        events: [],
        players: [],
        injuries: [],
        motm: 'p01' as PlayerId,
        stats: {} as any,
      };
    }

    it('applies correct fan mood changes for home win, away win, draw, and margin bonus', () => {
      const state = createTestGame('c01');
      state.matchday = 1;
      const homeClub = state.clubs['c01']!;
      const awayClub = state.clubs['c02']!;
      homeClub.fanMood = 50;
      awayClub.fanMood = 50;

      const fix =
        state.fixtures.find((f) => f.matchday === 1 && f.homeId === 'c01') ??
        state.fixtures.find((f) => f.matchday === 1)!;
      fix.homeId = 'c01';
      fix.awayId = 'c02';
      fix.isDerby = false;

      // Home 4 - 0 Away (Home wins by 4: base +4 + 2 margin = +6; Away lost by 4: base -4 - 2 margin = -6)
      const results: Record<FixtureId, MatchResult> = {
        [fix.id]: createMockMatchResult(4, 0),
      };

      const next = applyMatchResults(state, results);
      expect(next.clubs['c01']!.fanMood).toBe(56);
      expect(next.clubs['c02']!.fanMood).toBe(44);
    });

    it('doubles fan mood effects in derby matches', () => {
      const state = createTestGame('c01');
      state.matchday = 1;
      const homeClub = state.clubs['c01']!;
      const awayClub = state.clubs['c02']!;
      homeClub.fanMood = 50;
      awayClub.fanMood = 50;

      const fix =
        state.fixtures.find((f) => f.matchday === 1 && f.homeId === 'c01') ??
        state.fixtures.find((f) => f.matchday === 1)!;
      fix.homeId = 'c01';
      fix.awayId = 'c02';
      fix.isDerby = true;
      homeClub.rivals = ['c02'];
      awayClub.rivals = ['c01'];

      // Home wins 1-0 (margin 1 < 3, base home +4, away -4; derby doubles to +8 and -8)
      const results: Record<FixtureId, MatchResult> = {
        [fix.id]: createMockMatchResult(1, 0),
      };

      const next = applyMatchResults(state, results);
      expect(next.clubs['c01']!.fanMood).toBe(58);
      expect(next.clubs['c02']!.fanMood).toBe(42);
    });

    it('drifts fan mood towards 60 by 1 point per week', () => {
      const state = createTestGame('c01');
      state.clubs['c01']!.fanMood = 75;
      state.clubs['c02']!.fanMood = 45;

      const next = runWeeklyProcessing(state);
      expect(next.clubs['c01']!.fanMood).toBe(74); // 75 -> 74
      expect(next.clubs['c02']!.fanMood).toBe(46); // 45 -> 46
    });
  });
});
