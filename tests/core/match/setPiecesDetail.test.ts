import { describe, it, expect } from 'vitest';
import {
  createDefaultSetPieceTactics,
  generateAutoCornerJobs,
  computeCornerSwing,
  calculateRoutinePredictability,
  calculateRoutineSharpnessCtx,
  calculateWallEffect,
  resolveCorner,
  SetPiecePlayer,
} from '@/core/match/setPieces';
import {
  CornerRoutine,
  CornerTarget,
  CornerJob,
  Player,
  PlayerId,
  Side,
  TeamSheet,
  Tactics,
} from '@/core/types';
import { K } from '@/config/balance';
import { createRng } from '@/core/rng';
import { createMockAttributes } from './testHelper';
import { determineFoulRestart } from '@/core/match/fouls';
import { createNewGame } from '@/core/game/newGame';
import { runWeeklyProcessing } from '@/core/game/advance';

describe('SPEC §13.20 Detailed Set Pieces', () => {
  // Mock player builder
  function makeMockPlayer(
    id: string,
    pos: string,
    overrides: Partial<Player['attributes']> = {},
    foot: 'Left' | 'Right' | 'Both' = 'Right',
  ): Player {
    return {
      id: id as PlayerId,
      clubId: 'c01' as any,
      firstName: 'Test',
      lastName: id,
      nationality: 'ENG',
      age: 24,
      heightCm: 182,
      foot,
      positions: [{ pos: pos as any, familiarity: 100 }],
      attributes: {
        ...createMockAttributes(65),
        ...overrides,
      },
      potential: 75,
      personality: 'Professional',
      squadNumber: 10,
      contract: { yearsLeft: 2, wagePerWeek: 1000, role: 'Starter' },
      condition: 100,
      fatigue: 0,
      morale: 80,
      injury: null,
      suspendedMatches: 0,
      yellowAccumulation: 0,
      form: [7, 7, 7],
      stats: {
        apps: 0,
        starts: 0,
        minutes: 0,
        goals: 0,
        assists: 0,
        yellow: 0,
        red: 0,
        ratingSum: 0,
        ratedApps: 0,
        motm: 0,
        cleanSheets: 0,
        shots: 0,
        shotsOnTarget: 0,
        keyPasses: 0,
        tacklesWon: 0,
        interceptions: 0,
        saves: 0,
        goalsConceded: 0,
      },
      transferListed: false,
      notForSale: false,
      scoutedBy: [],
      growth: 0,
      history: [],
    };
  }

  describe('§13.20.1 Corner Jobs & Auto Jobs', () => {
    it('generates auto jobs respecting capacities and player strengths', () => {
      // Create 11 mock starters
      const lineup: (Player | null)[] = [
        makeMockPlayer('gk', 'GK', { aerialCommand: 75 }),
        makeMockPlayer('cb1', 'CB', { heading: 88, strength: 85, pace: 68 }), // best aerial
        makeMockPlayer('cb2', 'CB', { heading: 82, strength: 78, pace: 48 }), // slowest defender 1
        makeMockPlayer('lb', 'LB', { heading: 60, pace: 75, crossing: 75 }),
        makeMockPlayer('rb', 'RB', { heading: 60, pace: 72 }),
        makeMockPlayer('dm', 'DM', { heading: 70, strength: 75, pace: 50 }), // slowest defender 2
        makeMockPlayer('cm', 'CM', { heading: 65, longShots: 88, composure: 75 }), // best long shooter
        makeMockPlayer('lm', 'LM', { crossing: 80, setPieces: 85, pace: 78 }),
        makeMockPlayer('rm', 'RM', { crossing: 78, pace: 80 }),
        makeMockPlayer('st1', 'ST', { heading: 84, strength: 80, pace: 72 }), // 2nd best aerial
        makeMockPlayer('st2', 'ST', { heading: 74, finishing: 78, pace: 74 }),
      ];

      const jobs = generateAutoCornerJobs(lineup, 'Near');

      // Check capacity bounds
      const jobCounts: Record<string, number> = {};
      for (const j of Object.values(jobs)) {
        jobCounts[j] = (jobCounts[j] ?? 0) + 1;
      }

      expect(jobCounts['nearPost'] ?? 0).toBeLessThanOrEqual(2);
      expect(jobCounts['farPost'] ?? 0).toBeLessThanOrEqual(2);
      expect(jobCounts['penaltySpot'] ?? 0).toBeLessThanOrEqual(2);
      expect(jobCounts['keeperScreen'] ?? 0).toBeLessThanOrEqual(1);
      expect(jobCounts['edge'] ?? 0).toBeLessThanOrEqual(2);
      expect(jobCounts['short'] ?? 0).toBeLessThanOrEqual(1);
      expect(jobCounts['stayBack'] ?? 0).toBeLessThanOrEqual(3);

      // Best aerial player (cb1) should go to target nearPost
      expect(jobs[1]).toBe('nearPost');
      // 2 slowest defenders should be stayBack
      expect(jobs[2]).toBe('stayBack'); // cb2 pace 48
      expect(jobs[5]).toBe('stayBack'); // dm pace 50
      // Best long range shooter should be on edge
      expect(jobs[6]).toBe('edge'); // cm longShots 88
    });
  });

  describe('§13.20.2 Routines & Predictability & Sharpness', () => {
    it('caps predictability duel bonus at +0.12', () => {
      expect(calculateRoutinePredictability(1)).toBeCloseTo(0.0, 4);
      expect(calculateRoutinePredictability(2)).toBeCloseTo(0.04, 4);
      expect(calculateRoutinePredictability(3)).toBeCloseTo(0.08, 4);
      expect(calculateRoutinePredictability(4)).toBeCloseTo(0.12, 4);
      expect(calculateRoutinePredictability(5)).toBeCloseTo(0.12, 4);
      expect(calculateRoutinePredictability(10)).toBeCloseTo(0.12, 4);
    });

    it('calculates sharpness delivery context accurately', () => {
      expect(calculateRoutineSharpnessCtx(70)).toBeCloseTo(0.0, 4);
      expect(calculateRoutineSharpnessCtx(100)).toBeCloseTo(0.1, 4);
      expect(calculateRoutineSharpnessCtx(40)).toBeCloseTo(-0.1, 4);
      expect(calculateRoutineSharpnessCtx(85)).toBeCloseTo(0.05, 4);
    });
  });

  describe('§13.20.3 Takers & Swing From Foot', () => {
    it('computes natural inswinger from footedness and corner side', () => {
      // Right-footed taker from Left corner -> Inswinger
      const rLeft = computeCornerSwing('left', 'Right', 'Auto');
      expect(rLeft.effectiveSwing).toBe('Inswinger');
      expect(rLeft.deliveryCtxMod).toBe(0);

      // Left-footed taker from Right corner -> Inswinger
      const rRight = computeCornerSwing('right', 'Left', 'Auto');
      expect(rRight.effectiveSwing).toBe('Inswinger');
      expect(rRight.deliveryCtxMod).toBe(0);

      // Left-footed taker from Left corner in Auto -> Outswinger
      const rLeftOut = computeCornerSwing('left', 'Left', 'Auto');
      expect(rLeftOut.effectiveSwing).toBe('Outswinger');
      expect(rLeftOut.deliveryCtxMod).toBe(0);

      // Both-footed taker uses requested swing without penalty
      const rBoth = computeCornerSwing('left', 'Both', 'In');
      expect(rBoth.effectiveSwing).toBe('Inswinger');
      expect(rBoth.deliveryCtxMod).toBe(0);
    });

    it('applies -0.08 penalty when forcing swing against foot', () => {
      // Left corner forced In with Left foot (outswinger foot)
      const forcedIn = computeCornerSwing('left', 'Left', 'In');
      expect(forcedIn.effectiveSwing).toBe('Inswinger');
      expect(forcedIn.forcedPenalty).toBe(true);
      expect(forcedIn.deliveryCtxMod).toBeCloseTo(K.sp.swing.forcedPenaltyDeliveryCtx, 4);

      // Right corner forced In with Right foot (outswinger foot)
      const forcedRightIn = computeCornerSwing('right', 'Right', 'In');
      expect(forcedRightIn.effectiveSwing).toBe('Inswinger');
      expect(forcedRightIn.forcedPenalty).toBe(true);
      expect(forcedRightIn.deliveryCtxMod).toBeCloseTo(K.sp.swing.forcedPenaltyDeliveryCtx, 4);
    });
  });

  describe('§13.20.4 Free Kicks By Area', () => {
    it('handles central, wide, and deep free kick tactical choices', () => {
      const rng = createRng(42);

      // Central dummy option (ax >= 75 and center)
      const fkDummy = determineFoulRestart({ ax: 80, ay: 34 }, rng, {
        central: 'Dummy',
        wide: 'Mixed',
        deep: 'Keep',
      });
      expect(fkDummy).toBe('DUMMY_FK');

      // Central shoot option: 85% DIRECT_FK, 15% CROSS_FK
      let directCount = 0;
      for (let i = 0; i < 50; i++) {
        const testRng = createRng(100 + i);
        const res = determineFoulRestart({ ax: 82, ay: 34 }, testRng, {
          central: 'Shoot',
          wide: 'Mixed',
          deep: 'Keep',
        });
        if (res === 'DIRECT_FK') directCount++;
      }
      expect(directCount).toBeGreaterThan(30); // ~85% on average

      // Wide option (ax >= 70, ay not center)
      const fkWide = determineFoulRestart({ ax: 78, ay: 10 }, rng, {
        central: 'Mixed',
        wide: 'CrossNear',
        deep: 'Keep',
      });
      expect(fkWide).toBe('CROSS_FK');

      // Deep quick option (ax < 70)
      const fkQuick = determineFoulRestart({ ax: 50, ay: 34 }, rng, {
        central: 'Mixed',
        wide: 'Mixed',
        deep: 'Quick',
      });
      expect(fkQuick).toBe('QUICK_FK');

      // Deep long option
      const fkLong = determineFoulRestart({ ax: 45, ay: 34 }, rng, {
        central: 'Mixed',
        wide: 'Mixed',
        deep: 'Long',
      });
      expect(fkLong).toBe('LONG_FK');
    });
  });

  describe('§13.20.5 & §13.20.6 Defending Set Pieces & Wall Options', () => {
    it('computes wall effect for Auto, Small, and Big walls', () => {
      // 50-rated defenders give mean z = 0, so base block chances apply
      const neutralDefenders = [
        makeMockPlayer('cb1', 'CB', { heading: 50, strength: 50 }),
        makeMockPlayer('cb2', 'CB', { heading: 50, strength: 50 }),
      ];

      const autoWall = calculateWallEffect('Auto', neutralDefenders);
      expect(autoWall.blockProb).toBeCloseTo(0.2, 2);
      expect(autoWall.xgRefAdd).toBe(0);

      const smallWall = calculateWallEffect('Small', neutralDefenders);
      expect(smallWall.blockProb).toBeCloseTo(0.12, 2);
      expect(smallWall.oppCrossHeaderDuelAdd).toBe(-0.05);

      const bigWall = calculateWallEffect('Big', neutralDefenders);
      expect(bigWall.blockProb).toBeCloseTo(0.26, 2);
      expect(bigWall.oppCrossHeaderDuelAdd).toBe(0.05);
    });

    it('resolves corner with edge second balls and forwardsUp mechanics', () => {
      const rng = createRng(12345);
      const routine: CornerRoutine = {
        id: 'r1',
        name: 'Spot routine',
        target: 'Spot',
        swing: 'Auto',
        familiarity: 85,
        jobs: {
          1: 'penaltySpot',
          2: 'edge',
          3: 'stayBack',
        },
      };

      const taker: SetPiecePlayer = {
        id: 't1' as PlayerId,
        name: 'Taker',
        attributes: createMockAttributes(78),
        condition: 100,
        morale: 80,
        foot: 'Right',
        slot: 7,
      };

      const goalkeeper: SetPiecePlayer = {
        id: 'gk' as PlayerId,
        name: 'Keeper',
        attributes: createMockAttributes(70),
        condition: 100,
        morale: 80,
        foot: 'Right',
        slot: 0,
      };

      const attackersInBox: SetPiecePlayer[] = [
        {
          id: 'p1' as PlayerId,
          name: 'Attacker 1',
          attributes: createMockAttributes(75),
          condition: 100,
          morale: 80,
          foot: 'Right',
          slot: 1,
        },
        {
          id: 'p2' as PlayerId,
          name: 'Attacker 2',
          attributes: createMockAttributes(70),
          condition: 100,
          morale: 80,
          foot: 'Right',
          slot: 2,
        },
      ];

      const defendersInBox: SetPiecePlayer[] = [
        {
          id: 'd1' as PlayerId,
          name: 'Defender 1',
          attributes: createMockAttributes(70),
          condition: 100,
          morale: 80,
          foot: 'Right',
          slot: 2,
        },
      ];

      const res = resolveCorner({
        taker,
        goalkeeper,
        attackersInBox,
        defendersInBox,
        trainingBonusAttack: 0,
        trainingBonusSetPieces: 0,
        homeAdvantage: 0,
        defenderHomeAdvantage: 0,
        routine,
        routineUsesInMatch: 1,
        edgeGuard: true,
        forwardsUp: 2,
        markMainManId: null,
        cornerSide: 'left',
        rng,
      });

      expect(res).toBeDefined();
      expect(['SHOT', 'CLEARANCE', 'CLAIM', 'SHORT', 'CORNER_AGAIN', 'PENALTY']).toContain(
        res.outcome,
      );
      if (res.outcome === 'SHOT' && res.shotResult) {
        expect(['GOAL', 'SAVED', 'OFF_TARGET', 'BLOCKED']).toContain(res.shotResult.outcome);
        expect(typeof res.shotResult.xg).toBe('number');
        expect(res.shotResult.xg).toBeGreaterThan(0);
      }
    });
  });

  describe('Default set piece tactics creation', () => {
    it('creates fully initialized defaults for all phases and sides', () => {
      const sp = createDefaultSetPieceTactics();
      expect(sp.leftCorners.routines).toHaveLength(3);
      expect(sp.rightCorners.routines).toHaveLength(3);
      expect(sp.leftCorners.routines[0]!.target).toBe('Near');
      expect(sp.leftCorners.routines[1]!.target).toBe('Far');
      expect(sp.leftCorners.routines[2]!.target).toBe('Short');
      expect(sp.freeKicks.central).toBe('Mixed');
      expect(sp.freeKicks.wide).toBe('Mixed');
      expect(sp.freeKicks.deep).toBe('Keep');
      expect(sp.defending.wall).toBe('Auto');
      expect(sp.defending.forwardsUp).toBe(1);
      expect(sp.defending.lineHeight).toBe('Normal');
    });
  });

  describe('§13.20.2 Weekly Routine Familiarity Update', () => {
    it('updates familiarity during weekly processing based on training sessions and in-use routines', () => {
      const state = createNewGame({ userClubId: 'c01' as any, seed: 12345 });
      const club = state.clubs['c01']!;

      // Ensure tactics has setPieces
      club.tactics.setPieces = createDefaultSetPieceTactics();
      // Initially all routines have familiarity 70
      expect(club.tactics.setPieces.leftCorners.routines[0]!.familiarity).toBe(70);
      expect(club.tactics.setPieces.leftCorners.routines[1]!.familiarity).toBe(70);

      // Scenario 1: Training schedule has 1 set_pieces session (balanced schedule has d5_pm: 'set_pieces')
      // Pick 1 on left, pick 1 on right (2 routines in use)
      club.tactics.setPieces.leftCorners.rotate = false;
      club.tactics.setPieces.leftCorners.activeRoutine = 0;
      club.tactics.setPieces.rightCorners.rotate = false;
      club.tactics.setPieces.rightCorners.activeRoutine = 0;

      const updatedState = runWeeklyProcessing(state);
      const updatedClub = updatedState.clubs['c01']!;

      // In use: left routine 0 and right routine 0 (+7.5 each)
      // Unpractised: left routines 1, 2 and right routines 1, 2 (-5 each)
      expect(updatedClub.tactics.setPieces!.leftCorners.routines[0]!.familiarity).toBeCloseTo(
        77.5,
        1,
      );
      expect(updatedClub.tactics.setPieces!.rightCorners.routines[0]!.familiarity).toBeCloseTo(
        77.5,
        1,
      );
      expect(updatedClub.tactics.setPieces!.leftCorners.routines[1]!.familiarity).toBeCloseTo(
        65,
        1,
      );
      expect(updatedClub.tactics.setPieces!.rightCorners.routines[1]!.familiarity).toBeCloseTo(
        65,
        1,
      );

      // Scenario 2: Week with 0 set_pieces sessions -> all routines lose 5
      updatedClub.trainingPlan!.schedule = {
        ...updatedClub.trainingPlan!.schedule!,
        d5_pm: 'rest',
      };
      const updatedState2 = runWeeklyProcessing(updatedState);
      const updatedClub2 = updatedState2.clubs['c01']!;

      expect(updatedClub2.tactics.setPieces!.leftCorners.routines[0]!.familiarity).toBeCloseTo(
        72.5,
        1,
      );
      expect(updatedClub2.tactics.setPieces!.leftCorners.routines[1]!.familiarity).toBeCloseTo(
        60,
        1,
      );
    });
  });
});
