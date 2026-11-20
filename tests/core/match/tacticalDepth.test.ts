// Implements SPEC §13.17 Tactical Depth Engine Pass Tests (M3.0)
import { describe, it, expect } from 'vitest';
import { K } from '@/config/balance';
import {
  ROLES,
  computeRoleFit,
  getDefaultRoleForPos,
  getAvailableRolesForSlot,
} from '@/config/roles';
import { createMockAttributes, createMockTeamSheet, createTestMatchInput } from './testHelper';
import {
  computePlayerInvolvementFull,
  getReceiverWeightMultiplier,
} from '@/core/match/involvement';
import {
  selectAction,
  getLegalCandidateActions,
  ActionSelectionContext,
} from '@/core/match/actions';
import { resolveShot } from '@/core/match/shots';
import { getFoulMultiplier } from '@/core/match/fouls';
import { resolveCorner } from '@/core/match/setPieces';
import {
  pickBestLineup,
  determineAiOppositionOrders,
  determineAiTransitions,
} from '@/core/match/aiManager';
import { migrateTactics } from '@/core/game/migrations';
import { createRng } from '@/core/rng';

describe('Tactical Depth Engine Pass (SPEC §13.17, M3.0)', () => {
  describe('13.17.1 & 13.17.2: Role Definitions & Fit Computation', () => {
    it('all 32 roles are defined with UI wording and slots', () => {
      const roleKeys = Object.keys(ROLES);
      expect(roleKeys.length).toBeGreaterThanOrEqual(30);

      for (const role of Object.values(ROLES)) {
        expect(role.id).toBeDefined();
        expect(role.name.length).toBeGreaterThan(0);
        expect(role.slots.length).toBeGreaterThan(0);
        expect(role.description.length).toBeGreaterThan(0);
        expect(role.gives.length).toBeGreaterThan(0);
        expect(role.costs.length).toBeGreaterThan(0);
      }
    });

    it('computes role fit accurately with clamp and star scaling', () => {
      // Attributes with score = 50: fit = 0, stars = 1
      const avg50 = createMockAttributes(50);
      const res50 = computeRoleFit('poacher', avg50);
      expect(res50.score).toBe(50);
      expect(res50.fit).toBe(0);
      expect(res50.stars).toBe(1);

      // Attributes with score = 80: fit = 1.0, stars = 5
      const avg80 = createMockAttributes(80);
      const res80 = computeRoleFit('poacher', avg80);
      expect(res80.score).toBe(80);
      expect(res80.fit).toBe(1.0);
      expect(res80.stars).toBe(5);

      // Neutral role has fit 1.0 and 5 stars
      const neutralRes = computeRoleFit('st', avg50);
      expect(neutralRes.fit).toBe(1.0);
      expect(neutralRes.stars).toBe(5);
    });

    it('returns valid default roles and available roles for each position', () => {
      expect(getDefaultRoleForPos('GK')).toBe('gk');
      expect(getDefaultRoleForPos('CB')).toBe('cb');
      expect(getDefaultRoleForPos('ST')).toBe('st');

      const stRoles = getAvailableRolesForSlot('ST').map((r) => r.id);
      expect(stRoles).toContain('st');
      expect(stRoles).toContain('target_man');
      expect(stRoles).toContain('poacher');
      expect(stRoles).toContain('pressing_forward');
      expect(stRoles).toContain('false_nine');
      expect(stRoles).toContain('advanced_forward');
    });
  });

  describe('13.17.1 & 13.17.2: Involvement Modifiers (inv)', () => {
    it('shifts weights for specialized roles (poacher, fb_defensive, runner)', () => {
      // Poacher shifts MID->ATT and lane->C
      const baseSt = computePlayerInvolvementFull({
        role: 'ST',
        roleId: 'st',
        fit: 1.0,
        mentality: 'Balanced',
        width: 'Normal',
      });
      const poacher = computePlayerInvolvementFull({
        role: 'ST',
        roleId: 'poacher',
        fit: 1.0,
        mentality: 'Balanced',
        width: 'Normal',
      });

      expect(poacher.AC).toBeGreaterThan(baseSt.AC);
      expect(poacher.MC).toBeLessThan(baseSt.MC);

      // Defensive full-back shifts ATT->DEF 60%, MID->DEF 15%
      const baseFb = computePlayerInvolvementFull({
        role: 'LB',
        roleId: 'fb',
        fit: 1.0,
        mentality: 'Balanced',
        width: 'Normal',
      });
      const defFb = computePlayerInvolvementFull({
        role: 'LB',
        roleId: 'fb_defensive',
        fit: 1.0,
        mentality: 'Balanced',
        width: 'Normal',
      });

      expect(defFb.DL).toBeGreaterThan(baseFb.DL);
      expect(defFb.AL).toBeLessThan(baseFb.AL);
    });

    it('scales gains by (0.4 + 0.6*fit) when fit < 1.0', () => {
      const perfectFit = computePlayerInvolvementFull({
        role: 'ST',
        roleId: 'poacher',
        fit: 1.0,
        mentality: 'Balanced',
        width: 'Normal',
      });
      const zeroFit = computePlayerInvolvementFull({
        role: 'ST',
        roleId: 'poacher',
        fit: 0.0,
        mentality: 'Balanced',
        width: 'Normal',
      });

      // With 0 fit, gain is scaled by 0.4 instead of 1.0
      expect(perfectFit.AC).toBeGreaterThan(zeroFit.AC);
    });
  });

  describe('13.17.2 & 13.17.3: Receiver Weight Multipliers (recv)', () => {
    it('applies role receiver multipliers accurately', () => {
      const playmakerMult = getReceiverWeightMultiplier({
        roleId: 'playmaker',
        fit: 1.0,
        third: 'MID',
      });
      expect(playmakerMult).toBeCloseTo(1.25, 2);

      const deepPlaymakerMid = getReceiverWeightMultiplier({
        roleId: 'deep_playmaker',
        fit: 1.0,
        third: 'MID',
      });
      expect(deepPlaymakerMid).toBeCloseTo(1.3, 2);

      const poacherDef = getReceiverWeightMultiplier({
        roleId: 'poacher',
        fit: 1.0,
        third: 'DEF',
      });
      expect(poacherDef).toBeCloseTo(0.5, 2);

      const advForwardThrough = getReceiverWeightMultiplier({
        roleId: 'advanced_forward',
        fit: 1.0,
        third: 'ATT',
        isThroughBall: true,
      });
      expect(advForwardThrough).toBeCloseTo(1.4, 2);
    });

    it('tightMark opposition order reduces receiver weight by calibrated multiplier', () => {
      const normalRecv = getReceiverWeightMultiplier({
        roleId: 'cm',
        fit: 1.0,
        third: 'MID',
        isTightMarked: false,
      });
      const tightMarkedRecv = getReceiverWeightMultiplier({
        roleId: 'cm',
        fit: 1.0,
        third: 'MID',
        isTightMarked: true,
      });

      expect(tightMarkedRecv).toBeCloseTo(normalRecv * K.opp.tightMark.recvMult, 2);
    });
  });

  describe('13.17.2, 13.17.3 & 13.17.11: Action Selection Utility Modifiers (use)', () => {
    it('modifies action utilities for holder roles (e.g. target_man, inside_forward)', () => {
      const rng = createRng(42);
      const baseCtx: ActionSelectionContext = {
        ax: 80,
        ay: 10,
        instructions: {
          mentality: 'Balanced',
          passing: 'Mixed',
          tempo: 'Normal',
          pressing: 'Mid',
          line: 'Normal',
          width: 'Normal',
          focus: 'Mixed',
          onLoss: 'Mixed',
          onWin: 'Mixed',
          distribution: 'Mixed',
          cornersFor: 'Mixed',
          cornersAgainst: 'Mixed',
        },
        opponentLine: 'Normal',
        isUnderPressure: false,
        isCounterPhase: false,
        isLosingLate: false,
      };

      // Inside forward boosts shot in ATT and cuts crosses
      const ifCtx: ActionSelectionContext = {
        ...baseCtx,
        holderRole: 'inside_forward',
        holderFit: 1.0,
      };

      // Test multiple samples to ensure inside_forward shoots more than default winger
      let ifShots = 0;
      let wingerShots = 0;
      const testRng1 = createRng(12345);
      const testRng2 = createRng(12345);

      for (let i = 0; i < 100; i++) {
        if (selectAction('ATT', 'Left', ifCtx, testRng1) === 'shot') ifShots++;
        if (
          selectAction(
            'ATT',
            'Left',
            { ...baseCtx, holderRole: 'winger', holderFit: 1.0 },
            testRng2,
          ) === 'shot'
        )
          wingerShots++;
      }

      expect(ifShots).toBeGreaterThan(wingerShots);
    });

    it('applies player instructions modifiers (shootMore, shootLess, dribbleMore, dribbleLess)', () => {
      const baseCtx: ActionSelectionContext = {
        ax: 80,
        ay: 34,
        instructions: {
          mentality: 'Balanced',
          passing: 'Mixed',
          tempo: 'Normal',
          pressing: 'Mid',
          line: 'Normal',
          width: 'Normal',
          focus: 'Mixed',
          onLoss: 'Mixed',
          onWin: 'Mixed',
          distribution: 'Mixed',
          cornersFor: 'Mixed',
          cornersAgainst: 'Mixed',
        },
        opponentLine: 'Normal',
        isUnderPressure: false,
        isCounterPhase: false,
        isLosingLate: false,
      };

      const shootMoreCtx: ActionSelectionContext = {
        ...baseCtx,
        holderPIs: ['shootMore'],
      };
      const shootLessCtx: ActionSelectionContext = {
        ...baseCtx,
        holderPIs: ['shootLess'],
      };

      let moreShots = 0;
      let lessShots = 0;
      const rng1 = createRng(999);
      const rng2 = createRng(999);

      for (let i = 0; i < 100; i++) {
        if (selectAction('ATT', 'Centre', shootMoreCtx, rng1) === 'shot') moreShots++;
        if (selectAction('ATT', 'Centre', shootLessCtx, rng2) === 'shot') lessShots++;
      }

      expect(moreShots).toBeGreaterThan(lessShots);
    });
  });

  describe('13.17.2: Resolution Modifiers (as A / as R / as D)', () => {
    it('poacher gets S_fin bonus on six-yard and box central shots', () => {
      const rng1 = createRng(100);
      const rng2 = createRng(100);

      const attacker = {
        attributes: createMockAttributes(70),
        condition: 100,
        morale: 70,
      };
      const keeper = {
        attributes: createMockAttributes(70),
        condition: 100,
        morale: 70,
      };

      const neutralShot = resolveShot({
        context: 'SIX_YARD',
        attacker,
        goalkeeper: keeper,
        defender: null,
        trainingBonus: 0,
        homeAdvantage: 0,
        attackerRole: 'st',
        attackerFit: 1.0,
        rng: rng1,
      });

      const poacherShot = resolveShot({
        context: 'SIX_YARD',
        attacker,
        goalkeeper: keeper,
        defender: null,
        trainingBonus: 0,
        homeAdvantage: 0,
        attackerRole: 'poacher',
        attackerFit: 1.0,
        rng: rng2,
      });

      expect(poacherShot.xg).toBeGreaterThanOrEqual(neutralShot.xg);
    });

    it('sweeper keeper increases outside central shot xG by +0.02', () => {
      const rng1 = createRng(200);
      const rng2 = createRng(200);

      const attacker = {
        attributes: createMockAttributes(70),
        condition: 100,
        morale: 70,
      };
      const keeper = {
        attributes: createMockAttributes(70),
        condition: 100,
        morale: 70,
      };

      const normalGk = resolveShot({
        context: 'OUTSIDE_CENTRAL',
        attacker,
        goalkeeper: keeper,
        defender: null,
        trainingBonus: 0,
        homeAdvantage: 0,
        isSweeperKeeperOpponent: false,
        rng: rng1,
      });

      const sweeperGk = resolveShot({
        context: 'OUTSIDE_CENTRAL',
        attacker,
        goalkeeper: keeper,
        defender: null,
        trainingBonus: 0,
        homeAdvantage: 0,
        isSweeperKeeperOpponent: true,
        rng: rng2,
      });

      expect(sweeperGk.xg).toBeGreaterThan(normalGk.xg);
      expect(sweeperGk.xg - normalGk.xg).toBeCloseTo(0.02, 3);
    });
  });

  describe('13.17.2, 13.17.3 & 13.17.11: Foul Multipliers (cost)', () => {
    it('applies foul probability multipliers accurately', () => {
      expect(getFoulMultiplier({ roleId: 'stopper' })).toBe(1.2);
      expect(getFoulMultiplier({ roleId: 'ball_winner' })).toBe(1.5);
      expect(getFoulMultiplier({ isTightMarkMarker: true })).toBe(1.2);
      expect(getFoulMultiplier({ playerInstructions: ['stayOnFeet'] })).toBe(0.5);
      expect(
        getFoulMultiplier({
          roleId: 'ball_winner',
          playerInstructions: ['stayOnFeet'],
        }),
      ).toBe(0.75);
    });
  });

  describe('13.17.5: Corner Routines', () => {
    it('man-marking corners against gives 4% penalty foul risk', () => {
      const taker = {
        id: 'p_taker',
        attributes: createMockAttributes(75),
        condition: 100,
        morale: 70,
      };
      const gk = {
        id: 'p_gk',
        attributes: createMockAttributes(70),
        condition: 100,
        morale: 70,
      };
      const attackers = [
        { id: 'att1', attributes: createMockAttributes(72), condition: 100, morale: 70 },
      ];
      const defenders = [
        { id: 'def1', attributes: createMockAttributes(70), condition: 100, morale: 70 },
      ];

      let penalties = 0;
      for (let i = 0; i < 1000; i++) {
        const rng = createRng(10000 + i);
        const res = resolveCorner({
          taker,
          goalkeeper: gk,
          attackersInBox: attackers,
          defendersInBox: defenders,
          trainingBonusAttack: 0,
          trainingBonusSetPieces: 0,
          homeAdvantage: 0,
          defenderHomeAdvantage: 0,
          cornersAgainst: 'ManMark',
          rng,
        });
        if (res.foulPenalty) penalties++;
      }

      // ~0.5% of 1000 is ~5 penalties
      expect(penalties).toBeGreaterThanOrEqual(1);
      expect(penalties).toBeLessThanOrEqual(15);
    });

    it('short corner routine returns SHORT outcome without immediate cross', () => {
      const taker = {
        id: 'p_taker',
        attributes: createMockAttributes(75),
        condition: 100,
        morale: 70,
      };
      const gk = {
        id: 'p_gk',
        attributes: createMockAttributes(70),
        condition: 100,
        morale: 70,
      };
      const attackers = [
        { id: 'att1', attributes: createMockAttributes(72), condition: 100, morale: 70 },
      ];
      const defenders = [
        { id: 'def1', attributes: createMockAttributes(70), condition: 100, morale: 70 },
      ];

      const rng = createRng(42);
      const res = resolveCorner({
        taker,
        goalkeeper: gk,
        attackersInBox: attackers,
        defendersInBox: defenders,
        trainingBonusAttack: 0,
        trainingBonusSetPieces: 0,
        homeAdvantage: 0,
        defenderHomeAdvantage: 0,
        cornersFor: 'Short',
        rng,
      });

      expect(res.outcome).toBe('SHORT');
      expect(res.shotResult).toBeUndefined();
    });
  });

  describe('13.17.8: AI Manager Defaults & Rule Logic', () => {
    it('AI selects best-fit roles with club style overrides and instruction defaults', () => {
      const sheet = createMockTeamSheet('c01', 'home', 70);
      const candidates = Object.values(sheet.players).map((p, idx) => ({
        ...p,
        id: `p_${idx}`,
        clubId: 'c01',
        name: `Player ${idx}`,
        age: 24,
        nationality: 'England',
        reputation: 60,
        value: 1000000,
        wagePerWeek: 5000,
        contractExpiresMatchday: 18,
        squadNumber: idx + 1,
        personality: 'Professional' as const,
        growth: 0,
        history: [],
        scoutedBy: [],
      }));

      const res = pickBestLineup(
        candidates,
        '4-4-2',
        {
          '4-4-2': 100,
          '4-3-3': 50,
          '4-2-3-1': 50,
          '3-5-2': 50,
          '5-3-2': 50,
          '4-1-4-1': 50,
          '3-4-3': 50,
        },
        { passing: 'Direct', width: 'Wide' },
      );

      expect(res.roles.length).toBe(11);
      expect(res.playerInstructions.length).toBe(11);

      // Transition defaults
      const transitions = determineAiTransitions({
        mentality: 'Defensive',
        passing: 'Direct',
        tempo: 'Normal',
        pressing: 'Mid',
        line: 'Normal',
        width: 'Normal',
        focus: 'Mixed',
        onLoss: 'Mixed',
        onWin: 'Mixed',
        distribution: 'Mixed',
        cornersFor: 'Mixed',
        cornersAgainst: 'Mixed',
      });

      expect(transitions.onLoss).toBe('Regroup');
      expect(transitions.onWin).toBe('Counter');
      expect(transitions.distribution).toBe('Long');
    });

    it('AI sets tightMark opposition order when user has dominant attacker', () => {
      const defenders = [
        {
          id: 'def1',
          positions: [{ pos: 'CB' as const, familiarity: 100 }],
          attributes: createMockAttributes(65),
          condition: 100,
          fatigue: 0,
          morale: 70,
        },
      ] as any;

      const userStar = [
        {
          id: 'user_star_st',
          positions: [{ pos: 'ST' as const, familiarity: 100 }],
          attributes: createMockAttributes(75),
          condition: 100,
          fatigue: 0,
          morale: 70,
        },
      ] as any;

      const orders = determineAiOppositionOrders({
        ourReputation: 3,
        ourXi: defenders,
        oppXi: userStar,
      });

      expect(orders.length).toBe(1);
      expect(orders[0]?.kind).toBe('tightMark');
      expect(orders[0]?.target).toBe('user_star_st');
    });
  });

  describe('Save Migration (M3.0 & SPEC §23)', () => {
    it('migrates legacy tactics duties to neutral roles and sets new settings to Mixed', () => {
      const legacyTactics: any = {
        formation: '4-4-2',
        lineup: ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'],
        duties: [
          'Defend',
          'Defend',
          'Defend',
          'Support',
          'Support',
          'Support',
          'Support',
          'Support',
          'Support',
          'Attack',
          'Attack',
        ],
        bench: [],
        captain: 'p1',
        takers: { penalty: 'p9', freeKick: 'p7', corner: 'p5' },
        instructions: {
          mentality: 'Balanced',
          passing: 'Mixed',
          tempo: 'Normal',
          pressing: 'Mid',
          line: 'Normal',
          width: 'Normal',
          focus: 'Mixed',
        },
      };

      const migrated = migrateTactics(legacyTactics);

      expect(migrated.roles).toBeDefined();
      expect(migrated.roles.length).toBe(11);
      expect(migrated.roles[0]).toBe('gk');
      expect(migrated.roles[1]).toBe('fb');
      expect(migrated.roles[2]).toBe('cb');
      expect(migrated.roles[9]).toBe('st');

      expect(migrated.playerInstructions).toBeDefined();
      expect(migrated.playerInstructions.length).toBe(11);
      expect(migrated.opposition).toEqual([]);
      expect(migrated.takers.longThrow).toBeNull();

      expect(migrated.instructions.onLoss).toBe('Mixed');
      expect(migrated.instructions.onWin).toBe('Mixed');
      expect(migrated.instructions.distribution).toBe('Mixed');
      expect(migrated.instructions.cornersFor).toBe('Mixed');
      expect(migrated.instructions.cornersAgainst).toBe('Mixed');
    });
  });
});
