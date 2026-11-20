// Implements SPEC §13.18 Tactical Depth Pass 2 Tests (M3b)
import { describe, it, expect } from 'vitest';
import { K } from '@/config/balance';
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
import { getFoulMultiplier, determineFoulRestart, resolveFoulCard } from '@/core/match/fouls';
import { resolveCorner } from '@/core/match/setPieces';
import { createStartingFamiliarity, updateClubFamiliarity } from '@/core/game/familiarity';
import { migrateTactics } from '@/core/game/migrations';
import { MatchEngine } from '@/core/match/engine';
import { createRng } from '@/core/rng';

describe('Tactical Depth Pass 2 (SPEC §13.18, M3b)', () => {
  describe('13.18.1: Mentality 5-Step System', () => {
    it('applies utility row modifiers scaled by 1.6 for VeryAttacking and VeryDefensive', () => {
      const rng = createRng(100);
      const baseCtx: ActionSelectionContext = {
        ax: 80,
        ay: 34,
        opponentLine: 'Normal',
        isUnderPressure: false,
        isCounterPhase: false,
        isLosingLate: false,
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
          finalThird: 'Mixed',
          crossStyle: 'Mixed',
          offsideTrap: false,
          tackling: 'Mixed',
          forceOpp: 'Mixed',
          timeWasting: 'Never',
          freeKicks: 'Mixed',
          cornerSwing: 'Mixed',
          menBack: 2,
          postMen: 'None',
        },
        holderRole: 'cm',
        holderFit: 1.0,
      };

      // In ATT Centre, compare VeryAttacking vs Attacking action selection:
      let veryAttShots = 0;
      let attShots = 0;
      for (let i = 0; i < 200; i++) {
        if (
          selectAction(
            'ATT',
            'Centre',
            { ...baseCtx, instructions: { ...baseCtx.instructions, mentality: 'VeryAttacking' } },
            createRng(i),
          ) === 'shot'
        ) {
          veryAttShots++;
        }
        if (
          selectAction(
            'ATT',
            'Centre',
            { ...baseCtx, instructions: { ...baseCtx.instructions, mentality: 'Attacking' } },
            createRng(i),
          ) === 'shot'
        ) {
          attShots++;
        }
      }
      expect(veryAttShots).toBeGreaterThanOrEqual(attShots);
    });

    it('shifts involvement weights for VeryAttacking and VeryDefensive', () => {
      // VeryAttacking: inv MID->ATT 15% except CBs
      const stVeryAtt = computePlayerInvolvementFull({
        role: 'ST',
        roleId: 'poacher',
        fit: 1.0,
        mentality: 'VeryAttacking',
        width: 'Normal',
      });
      const stBal = computePlayerInvolvementFull({
        role: 'ST',
        roleId: 'poacher',
        fit: 1.0,
        mentality: 'Balanced',
        width: 'Normal',
      });
      // ST in MID third should have 15% shifted to ATT
      expect(stVeryAtt['AC']).toBeGreaterThan(stBal['AC']);

      // VeryDefensive: inv ATT->MID 15% except STs
      const amVeryDef = computePlayerInvolvementFull({
        role: 'AM',
        roleId: 'playmaker',
        fit: 1.0,
        mentality: 'VeryDefensive',
        width: 'Normal',
      });
      const amBal = computePlayerInvolvementFull({
        role: 'AM',
        roleId: 'playmaker',
        fit: 1.0,
        mentality: 'Balanced',
        width: 'Normal',
      });
      expect(amVeryDef['MC']).toBeGreaterThan(amBal['MC']);
    });
  });

  describe('13.18.2: Final Third (WorkIntoBox vs ShootOnSight)', () => {
    it('WorkIntoBox lowers outside-box shot utility and boosts progress/dribble', () => {
      const baseCtx: ActionSelectionContext = {
        ax: 72, // Outside box in ATT Centre
        ay: 34,
        opponentLine: 'Normal',
        isUnderPressure: false,
        isCounterPhase: false,
        isLosingLate: false,
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
          finalThird: 'WorkIntoBox',
          crossStyle: 'Mixed',
          offsideTrap: false,
          tackling: 'Mixed',
          forceOpp: 'Mixed',
          timeWasting: 'Never',
          freeKicks: 'Mixed',
          cornerSwing: 'Mixed',
          menBack: 2,
          postMen: 'None',
        },
        holderRole: 'cm',
        holderFit: 1.0,
      };

      let wibShots = 0;
      let sosShots = 0;
      for (let i = 0; i < 200; i++) {
        if (
          selectAction(
            'ATT',
            'Centre',
            { ...baseCtx, instructions: { ...baseCtx.instructions, finalThird: 'WorkIntoBox' } },
            createRng(i),
          ) === 'shot'
        ) {
          wibShots++;
        }
        if (
          selectAction(
            'ATT',
            'Centre',
            { ...baseCtx, instructions: { ...baseCtx.instructions, finalThird: 'ShootOnSight' } },
            createRng(i),
          ) === 'shot'
        ) {
          sosShots++;
        }
      }
      expect(wibShots).toBeLessThan(sosShots);
    });

    it('ShootOnSight applies lower xG and blocks to defender clearance', () => {
      const rng = createRng(42);
      const att = createMockTeamSheet('c1', 'home', 75).players['home_p9']!;
      const gk = createMockTeamSheet('c2', 'away', 70).players['away_p0']!;

      const shotNormal = resolveShot({
        context: 'OUTSIDE_CENTRAL',
        attacker: att,
        goalkeeper: gk,
        defender: null,
        trainingBonus: 0,
        homeAdvantage: 0,
        shootOnSight: false,
        rng: createRng(42),
      });

      const shotSos = resolveShot({
        context: 'OUTSIDE_CENTRAL',
        attacker: att,
        goalkeeper: gk,
        defender: null,
        trainingBonus: 0,
        homeAdvantage: 0,
        shootOnSight: true,
        rng: createRng(42),
      });

      expect(shotSos.xg).toBeLessThan(shotNormal.xg);
    });
  });

  describe('13.18.4: Offside Trap', () => {
    it('adds beaten 1v1 bonus and failed through ball offside boost', () => {
      expect(K.d2.offsideTrap.beatenTrapOneOnOneAdd).toBe(0.08);
      expect(K.d2.offsideTrap.failedThroughOffsideProbAdd).toBe(0.2);
      expect(K.d2.offsideTrap.failedThroughOffsideCap).toBe(0.7);
      expect(K.d2.offsideTrap.oppLongBallAttOffsideChance).toBe(0.1);
    });
  });

  describe('13.18.5: Team Tackling', () => {
    it('scales foul multiplier and yellow risk for GetStuckIn vs StayOnFeet', () => {
      const stuckInMult = getFoulMultiplier({
        roleId: 'cb',
        teamTackling: 'GetStuckIn',
      });
      const stayOnFeetMult = getFoulMultiplier({
        roleId: 'cb',
        teamTackling: 'StayOnFeet',
      });
      expect(stuckInMult).toBe(1.35);
      expect(stayOnFeetMult).toBe(0.6);

      // Player PI stayOnFeet overrides team tackling
      const overrideMult = getFoulMultiplier({
        roleId: 'cb',
        playerInstructions: ['stayOnFeet'],
        teamTackling: 'GetStuckIn',
      });
      expect(overrideMult).toBe(0.5);
    });

    it('increases yellow card chance for GetStuckIn', () => {
      const p = createMockTeamSheet('c1', 'home', 70).players['home_p1']!;
      let yellowsStuck = 0;
      let yellowsNormal = 0;
      const N = 1000;

      for (let i = 0; i < N; i++) {
        const rng1 = createRng(i);
        const card1 = resolveFoulCard(
          {
            personality: p.personality,
            attributes: p.attributes,
            currentYellows: 0,
            teamTackling: 'GetStuckIn',
          },
          rng1,
        );
        if (card1 === 'YELLOW') yellowsStuck++;

        const rng2 = createRng(i);
        const card2 = resolveFoulCard(
          {
            personality: p.personality,
            attributes: p.attributes,
            currentYellows: 0,
            teamTackling: 'Mixed',
          },
          rng2,
        );
        if (card2 === 'YELLOW') yellowsNormal++;
      }

      expect(yellowsStuck).toBeGreaterThanOrEqual(yellowsNormal);
    });
  });

  describe('13.18.6: Force Opposition', () => {
    it('shifts opponent cross vs shot utility when forcing Inside vs Outside', () => {
      const baseCtx: ActionSelectionContext = {
        ax: 80,
        ay: 10, // Wide lane in ATT
        opponentLine: 'Normal',
        isUnderPressure: false,
        isCounterPhase: false,
        isLosingLate: false,
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
          finalThird: 'Mixed',
          crossStyle: 'Mixed',
          offsideTrap: false,
          tackling: 'Mixed',
          forceOpp: 'Mixed',
          timeWasting: 'Never',
          freeKicks: 'Mixed',
          cornerSwing: 'Mixed',
          menBack: 2,
          postMen: 'None',
        },
        holderRole: 'inside_forward',
        holderFit: 1.0,
      };

      let insideCrosses = 0;
      let insideShots = 0;
      let outsideCrosses = 0;
      let outsideShots = 0;

      for (let i = 0; i < 300; i++) {
        const actInside = selectAction(
          'ATT',
          'Left',
          { ...baseCtx, defendingTeamForceOpp: 'Inside' },
          createRng(i),
        );
        if (actInside === 'cross') insideCrosses++;
        if (actInside === 'shot') insideShots++;

        const actOutside = selectAction(
          'ATT',
          'Left',
          { ...baseCtx, defendingTeamForceOpp: 'Outside' },
          createRng(i),
        );
        if (actOutside === 'cross') outsideCrosses++;
        if (actOutside === 'shot') outsideShots++;
      }

      expect(outsideCrosses).toBeGreaterThan(insideCrosses);
      expect(insideShots).toBeGreaterThan(outsideShots);
    });
  });

  describe('13.18.8: Extended Set Pieces', () => {
    it('determines foul restart based on freeKicks instruction', () => {
      const rng = createRng(1);
      const pos = { ax: 80, ay: 34 }; // ATT Centre within 30m

      const shootFk = determineFoulRestart(pos, rng, 'Shoot');
      expect(shootFk).toBe('DIRECT_FK');

      const shortFk = determineFoulRestart(pos, rng, 'Short');
      expect(shortFk).toBe('SHORT_FK');
    });

    it('resolveCorner handles cornerSwing, menBack, and postMen', () => {
      const rng = createRng(10);
      const team = createMockTeamSheet('c1', 'home', 70);
      const opp = createMockTeamSheet('c2', 'away', 70);

      const res = resolveCorner({
        taker: {
          id: 'home_p7',
          attributes: team.players['home_p7']!.attributes,
          condition: 100,
          morale: 80,
          isCbOrSt: false,
        },
        goalkeeper: {
          id: 'away_p0',
          attributes: opp.players['away_p0']!.attributes,
          condition: 100,
          morale: 80,
          isCbOrSt: false,
        },
        attackersInBox: [
          {
            id: 'home_p9',
            attributes: team.players['home_p9']!.attributes,
            condition: 100,
            morale: 80,
            isCbOrSt: true,
          },
        ],
        defendersInBox: [
          {
            id: 'away_p4',
            attributes: opp.players['away_p4']!.attributes,
            condition: 100,
            morale: 80,
            isCbOrSt: true,
          },
        ],
        trainingBonusAttack: 0,
        trainingBonusSetPieces: 0,
        homeAdvantage: 0.1,
        cornersFor: 'Mixed',
        cornersAgainst: 'Mixed',
        cornerSwing: 'Inswinger',
        menBack: 1,
        postMen: 'Both',
        rng,
      });

      expect(res).toBeDefined();
      expect(['CLAIM', 'CLEARANCE', 'CORNER_AGAIN', 'SHOT', 'SHORT']).toContain(res.outcome);
    });
  });

  describe('13.18.9: New Player Instructions', () => {
    it('implements roam: spread involvement and receiving multiplier', () => {
      const roamInv = computePlayerInvolvementFull({
        role: 'CM',
        roleId: 'cm',
        fit: 1.0,
        playerInstructions: ['roam'],
        mentality: 'Balanced',
        width: 'Normal',
      });
      const normInv = computePlayerInvolvementFull({
        role: 'CM',
        roleId: 'cm',
        fit: 1.0,
        playerInstructions: [],
        mentality: 'Balanced',
        width: 'Normal',
      });

      // Adjacent zones should receive more weight
      expect(roamInv['AL']).toBeGreaterThan(normInv['AL']);

      // Receiving multiplier x1.15
      const mult = getReceiverWeightMultiplier({
        roleId: 'cm',
        fit: 1.0,
        third: 'MID',
        playerInstructions: ['roam'],
      });
      expect(mult).toBe(1.15);
    });

    it('implements sitNarrower: shifts involvement towards Centre', () => {
      const narrowInv = computePlayerInvolvementFull({
        role: 'LM',
        roleId: 'winger',
        fit: 1.0,
        playerInstructions: ['sitNarrower'],
        mentality: 'Balanced',
        width: 'Normal',
      });
      const normInv = computePlayerInvolvementFull({
        role: 'LM',
        roleId: 'winger',
        fit: 1.0,
        playerInstructions: [],
        mentality: 'Balanced',
        width: 'Normal',
      });

      expect(narrowInv['MC']).toBeGreaterThan(normInv['MC']);
    });
  });

  describe('13.18.10: Tactical Plans & Migration', () => {
    it('migrateTactics populates 3 plans and activePlan', () => {
      const migrated = migrateTactics({ formation: '4-3-3' });
      expect(migrated.plans).toBeDefined();
      expect(migrated.plans!.length).toBe(3);
      expect(migrated.activePlan).toBe(0);
      expect(migrated.plans![0].formation).toBe('4-3-3');
      expect(migrated.plans![1].formation).toBe('4-3-3');
      expect(migrated.plans![2].formation).toBe('4-3-3');
    });

    it('engine switches tactical plan upon plan command', () => {
      const input = createTestMatchInput(70, 70);
      input.home.tactics.plans![1].formation = '3-5-2';

      const engine = new MatchEngine(input, 12345, false);
      engine.step();

      // Issue plan switch command
      engine.applyCommandWithRewind({
        kind: 'plan',
        side: 'home',
        plan: 1,
        issuedAtT: 0,
      });

      // Fast forward past 30s delay so processReadyCommands runs
      while (engine.snapshot().t <= 35) {
        engine.step();
      }
      engine.step();

      const snap = engine.snapshot();
      expect(snap.homeTeam.formation).toBe('3-5-2');
    });
  });

  describe('13.18.11: Familiarity per Area', () => {
    it('creates starting familiarity with 90/65/45 and 90/65/40 gradients', () => {
      const fam = createStartingFamiliarity({ mentality: 'Attacking', passing: 'Short' }, '4-3-3');
      expect(fam.formation['4-3-3']).toBe(90);
      expect(fam.formation['4-4-2']).toBe(65); // Same backline (4-back)
      expect(fam.formation['3-5-2']).toBe(40); // 3-back

      expect(fam.mentality.Attacking).toBe(90);
      expect(fam.mentality.Balanced).toBe(65); // 1 step away
      expect(fam.mentality.VeryDefensive).toBe(45); // >1 step away

      expect(fam.passing.Short).toBe(90);
      expect(fam.passing.Mixed).toBe(65);
      expect(fam.passing.Direct).toBe(45);
    });

    it('updates familiarity weekly: +6 for used (cap 100), -2 for unused (floor 40)', () => {
      const fam = createStartingFamiliarity({ mentality: 'Balanced' }, '4-4-2');
      const tactics = migrateTactics({ formation: '4-4-2' });

      const updated = updateClubFamiliarity(fam, tactics, false);
      expect(updated.formation['4-4-2']).toBe(96);
      expect(updated.formation['4-3-3']).toBe(63); // 65 - 2
      expect(updated.formation['3-5-2']).toBe(40); // floor 40

      // Tactical training boosts by +12
      const tactTrained = updateClubFamiliarity(fam, tactics, true);
      expect(tactTrained.formation['4-4-2']).toBe(100); // capped at 100
    });
  });
});
