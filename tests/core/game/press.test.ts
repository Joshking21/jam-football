import { describe, it, expect } from 'vitest';
import {
  getJournalists,
  getAllPressQuestions,
  shouldTriggerPreMatchPress,
  shouldTriggerPostMatchPress,
  determinePressContext,
  generatePressConference,
  applyPressAnswer,
} from '@/core/game/press';
import { GameState, PressContext, Club, Player } from '@/core/types';
import { createRng } from '@/core/rng';

describe('Press Conferences System (SPEC §12.6, §16.2)', () => {
  describe('Content and Data Integrity', () => {
    it('contains exactly 3 fictional journalists per SPEC §16.2', () => {
      const journos = getJournalists();
      expect(journos.length).toBe(3);
      expect(journos.map((j) => j.name)).toContain('Priya Natarajan');
      expect(journos.map((j) => j.name)).toContain('Joe Kettering');
      expect(journos.map((j) => j.name)).toContain('Femi Adebayo-Clarke');
    });

    it('contains at least 52 questions covering all 13 contexts with >= 4 questions each', () => {
      const questions = getAllPressQuestions();
      expect(questions.length).toBeGreaterThanOrEqual(52);

      const requiredContexts: PressContext[] = [
        'PRE_DERBY',
        'POST_WIN',
        'POST_BIG_WIN',
        'POST_DRAW',
        'POST_LOSS',
        'POST_BIG_LOSS',
        'POST_UPSET_WIN',
        'STREAK_WIN',
        'STREAK_LOSS',
        'PLAYER_PRAISE',
        'PLAYER_CRITICISM',
        'TRANSFER_RUMOUR',
        'OPENING_DAY',
      ];

      for (const ctx of requiredContexts) {
        const matching = questions.filter((q) => q.context.includes(ctx));
        expect(
          matching.length,
          `Expected context ${ctx} to have at least 4 questions`,
        ).toBeGreaterThanOrEqual(4);
      }
    });

    it('ensures each question has 3 answers within SPEC §16.2 effect ranges', () => {
      const questions = getAllPressQuestions();
      for (const q of questions) {
        expect(q.answers.length).toBe(3);
        for (const ans of q.answers) {
          expect(ans.tone.length).toBeGreaterThan(0);
          expect(ans.text.length).toBeGreaterThan(0);
          expect(ans.voText.length).toBeGreaterThan(0);

          if (ans.effects.fans !== undefined) {
            expect(ans.effects.fans).toBeGreaterThanOrEqual(-5);
            expect(ans.effects.fans).toBeLessThanOrEqual(5);
          }
          if (ans.effects.board !== undefined) {
            expect(ans.effects.board).toBeGreaterThanOrEqual(-3);
            expect(ans.effects.board).toBeLessThanOrEqual(3);
          }
          if (ans.effects.squadMorale !== undefined) {
            expect(ans.effects.squadMorale).toBeGreaterThanOrEqual(-4);
            expect(ans.effects.squadMorale).toBeLessThanOrEqual(4);
          }
          if (ans.effects.playerMorale !== undefined) {
            expect(ans.effects.playerMorale).toBeGreaterThanOrEqual(-8);
            expect(ans.effects.playerMorale).toBeLessThanOrEqual(8);
          }
        }
      }
    });
  });

  describe('Trigger Logic (SPEC §12.6)', () => {
    it('triggers pre-match press only for derbies', () => {
      expect(shouldTriggerPreMatchPress(true)).toBe(true);
      expect(shouldTriggerPreMatchPress(false)).toBe(false);
    });

    it('triggers post-match press unconditionally on derbies, matchday 1, upsets, big losses, or streaks', () => {
      const rng = createRng(42);
      // Derby
      expect(
        shouldTriggerPostMatchPress(
          {
            isDerby: true,
            matchday: 5,
            userWonOrDrawnAgainstHighRep: false,
            lossByThreeOrMore: false,
            streakReachedThree: false,
          },
          rng,
        ),
      ).toBe(true);

      // Matchday 1
      expect(
        shouldTriggerPostMatchPress(
          {
            isDerby: false,
            matchday: 1,
            userWonOrDrawnAgainstHighRep: false,
            lossByThreeOrMore: false,
            streakReachedThree: false,
          },
          rng,
        ),
      ).toBe(true);

      // Upset
      expect(
        shouldTriggerPostMatchPress(
          {
            isDerby: false,
            matchday: 8,
            userWonOrDrawnAgainstHighRep: true,
            lossByThreeOrMore: false,
            streakReachedThree: false,
          },
          rng,
        ),
      ).toBe(true);

      // Loss by 3+
      expect(
        shouldTriggerPostMatchPress(
          {
            isDerby: false,
            matchday: 4,
            userWonOrDrawnAgainstHighRep: false,
            lossByThreeOrMore: true,
            streakReachedThree: false,
          },
          rng,
        ),
      ).toBe(true);

      // Streak
      expect(
        shouldTriggerPostMatchPress(
          {
            isDerby: false,
            matchday: 7,
            userWonOrDrawnAgainstHighRep: false,
            lossByThreeOrMore: false,
            streakReachedThree: true,
          },
          rng,
        ),
      ).toBe(true);
    });

    it('triggers with 30% probability on standard matches', () => {
      let triggered = 0;
      const count = 1000;
      for (let i = 0; i < count; i++) {
        const rng = createRng(i);
        if (
          shouldTriggerPostMatchPress(
            {
              isDerby: false,
              matchday: 6,
              userWonOrDrawnAgainstHighRep: false,
              lossByThreeOrMore: false,
              streakReachedThree: false,
            },
            rng,
          )
        ) {
          triggered++;
        }
      }
      const pct = triggered / count;
      expect(pct).toBeGreaterThan(0.24);
      expect(pct).toBeLessThan(0.36);
    });
  });

  describe('Context Determination (SPEC §16.2)', () => {
    it('identifies PRE_DERBY before a derby', () => {
      const rng = createRng(1);
      expect(
        determinePressContext(
          {
            isPreMatch: true,
            isDerby: true,
            matchday: 4,
            userGoals: 0,
            oppGoals: 0,
            userRep: 3,
            oppRep: 3,
            winStreak: 0,
            lossStreak: 0,
          },
          rng,
        ),
      ).toBe('PRE_DERBY');
    });

    it('identifies OPENING_DAY on matchday 1', () => {
      const rng = createRng(1);
      expect(
        determinePressContext(
          {
            matchday: 1,
            userGoals: 1,
            oppGoals: 0,
            userRep: 3,
            oppRep: 3,
            winStreak: 0,
            lossStreak: 0,
          },
          rng,
        ),
      ).toBe('OPENING_DAY');
    });

    it('identifies POST_UPSET_WIN when defeating club with reputation >= ours + 2', () => {
      const rng = createRng(1);
      expect(
        determinePressContext(
          {
            matchday: 5,
            userGoals: 2,
            oppGoals: 1,
            userRep: 2,
            oppRep: 4,
            winStreak: 0,
            lossStreak: 0,
          },
          rng,
        ),
      ).toBe('POST_UPSET_WIN');
    });

    it('identifies POST_BIG_WIN and POST_BIG_LOSS on 3+ goal margins', () => {
      const rng = createRng(1);
      expect(
        determinePressContext(
          {
            matchday: 6,
            userGoals: 4,
            oppGoals: 0,
            userRep: 3,
            oppRep: 3,
            winStreak: 0,
            lossStreak: 0,
          },
          rng,
        ),
      ).toBe('POST_BIG_WIN');

      expect(
        determinePressContext(
          {
            matchday: 6,
            userGoals: 0,
            oppGoals: 3,
            userRep: 3,
            oppRep: 3,
            winStreak: 0,
            lossStreak: 0,
          },
          rng,
        ),
      ).toBe('POST_BIG_LOSS');
    });

    it('identifies STREAK_WIN and STREAK_LOSS', () => {
      const rng = createRng(1);
      expect(
        determinePressContext(
          {
            matchday: 6,
            userGoals: 2,
            oppGoals: 1,
            userRep: 3,
            oppRep: 3,
            winStreak: 3,
            lossStreak: 0,
          },
          rng,
        ),
      ).toBe('STREAK_WIN');

      expect(
        determinePressContext(
          {
            matchday: 6,
            userGoals: 0,
            oppGoals: 1,
            userRep: 3,
            oppRep: 3,
            winStreak: 0,
            lossStreak: 3,
          },
          rng,
        ),
      ).toBe('STREAK_LOSS');
    });
  });

  describe('Generation and Token Replacement', () => {
    it('replaces all tokens ({opponent}, {club}, {player}, {score})', () => {
      const rng = createRng(100);
      const conf = generatePressConference(
        'POST_WIN',
        [],
        {
          opponent: 'Ironford FC',
          club: 'Saltmere Town',
          player: 'Jack Vance',
          score: '2 - 0',
        },
        rng,
      );

      expect(conf.question.text).not.toContain('{opponent}');
      expect(conf.question.text).not.toContain('{club}');
      expect(conf.journalist).toBeDefined();
      expect(conf.question.answers.length).toBe(3);
    });

    it('excludes questions already present in pressHistory', () => {
      const questions = getAllPressQuestions().filter((q) => q.context.includes('POST_WIN'));
      const askedId = questions[0]!.id;

      const rng = createRng(42);
      const conf = generatePressConference(
        'POST_WIN',
        [askedId],
        { opponent: 'Opp', club: 'Club' },
        rng,
      );

      expect(conf.question.id).not.toBe(askedId);
    });
  });

  describe('Answer Application & State Updates', () => {
    it('applies answer effects to fans, board, squad morale, and records condition', () => {
      const mockClub: Club = {
        id: 'c1',
        name: 'Saltmere Town',
        code: 'STM',
        fanMood: 50,
        boardConfidence: 50,
        squad: ['p1'],
        reputation: 3,
        balance: 1000000,
        wageBudget: 50000,
        stadium: { name: 'Ground', capacity: 10000 },
        colors: { primary: '#000', secondary: '#fff', text: '#fff' },
        rivals: [],
        trainingPlan: { intensity: 'Normal', focus: 'Balanced', individual: {} },
        tactics: {
          formation: '4-3-3',
          lineup: ['p1'],
          bench: [],
          tempo: 'Normal',
          passing: 'Mixed',
          pressing: 'Mid',
          width: 'Balanced',
          lineHeight: 'Mid',
          offsideTrap: false,
          corners: { attacking: 'FarPost', defending: 'Zonal' },
          freeKicks: { attacking: 'Cross', defending: 'Wall' },
          penalties: { taker: 'p1' },
          captain: 'p1',
          cornerTaker: 'p1',
          freeKickTaker: 'p1',
        },
        expectation: { target: 4, acceptable: 7, label: 'Mid-table' },
      } as unknown as Club;

      const mockPlayer: Player = {
        id: 'p1',
        clubId: 'c1',
        firstName: 'Leo',
        lastName: 'Archer',
        morale: 60,
      } as unknown as Player;

      const mockState: GameState = {
        userClubId: 'c1',
        clubs: { c1: mockClub },
        players: { p1: mockPlayer },
        pressHistory: [],
        activePressCondition: null,
      } as unknown as GameState;

      const rng = createRng(42);
      const conf = generatePressConference(
        'POST_WIN',
        [],
        { opponent: 'Opp', club: 'Saltmere Town' },
        rng,
      );
      mockState.pendingPress = conf;

      const chosenAnswer = conf.question.answers[0]!;
      const result = applyPressAnswer(mockState, conf, chosenAnswer.id);

      expect(result.managerSpeech).toBe(chosenAnswer.text);
      expect(mockState.pendingPress).toBeNull();
      expect(mockState.pressHistory).toContain(conf.question.id);

      // Verify fan and board updates match answer effects
      const expectedFans = 50 + (chosenAnswer.effects.fans ?? 0);
      const expectedBoard = 50 + (chosenAnswer.effects.board ?? 0);
      expect(mockClub.fanMood).toBe(expectedFans);
      expect(mockClub.boardConfidence).toBe(expectedBoard);

      // If answer had squadMorale, verify player morale changed
      if (chosenAnswer.effects.squadMorale) {
        expect(mockPlayer.morale).toBe(60 + chosenAnswer.effects.squadMorale);
      }

      // If answer had nextMatchCondition, verify activePressCondition is set
      if (chosenAnswer.effects.nextMatchCondition) {
        expect(mockState.activePressCondition).toEqual(chosenAnswer.effects.nextMatchCondition);
      }
    });
  });
});
