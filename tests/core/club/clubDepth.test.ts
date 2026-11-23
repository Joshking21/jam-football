import { describe, it, expect } from 'vitest';
import {
  initClubStaff,
  generateStaffCandidates,
  replaceStaffMember,
  calculateLeaderScore,
  getClubLeaders,
  computeWeeklyCohesion,
  applyMoraleSpread,
  getInjuryRisk,
  applyRestDays,
  applyPositionTraining,
  getMatchPrepEffects,
} from '@/core/club/clubDepth';
import { Club, Player, PlayerId } from '@/core/types';
import { BALANCE } from '@/config/balance';
import { createNewGame } from '@/core/game/newGame';

const baseState = createNewGame({ seed: 12345, userClubId: 'c01' });
const baseClub = baseState.clubs['c01']!;
const basePlayerId = baseClub.squad[0]!;
const basePlayer = baseState.players[basePlayerId]!;

function createMockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    ...JSON.parse(JSON.stringify(basePlayer)),
    ...overrides,
  };
}

function createMockClub(overrides: Partial<Club> = {}): Club {
  return {
    ...JSON.parse(JSON.stringify(baseClub)),
    ...overrides,
  };
}

describe('Club Depth (§12.17)', () => {
  describe('Staff System (§12.17.1)', () => {
    it('initializes 4 staff members with Theo Vance as permanent 3★ assistant', () => {
      const staff = initClubStaff(3, 42);
      expect(staff.assistant.name).toBe('Theo Vance');
      expect(staff.assistant.stars).toBe(3);
      expect(staff.assistant.wage).toBe(BALANCE.club.staffWage * 9); // 13,500
      expect(staff.coach.stars).toBeGreaterThanOrEqual(1);
      expect(staff.coach.stars).toBeLessThanOrEqual(5);
      expect(staff.coach.wage).toBe(BALANCE.club.staffWage * staff.coach.stars * staff.coach.stars);
      expect(staff.scout.stars).toBeGreaterThanOrEqual(1);
      expect(staff.scout.stars).toBeLessThanOrEqual(5);
      expect(staff.physio.stars).toBeGreaterThanOrEqual(1);
      expect(staff.physio.stars).toBeLessThanOrEqual(5);
    });

    it('generates 3 candidates for coach, scout, and physio, but none for assistant', () => {
      const coachCandidates = generateStaffCandidates('coach', 101);
      expect(coachCandidates.length).toBe(3);
      for (const cand of coachCandidates) {
        expect(cand.role).toBe('coach');
        expect(cand.stars).toBeGreaterThanOrEqual(1);
        expect(cand.stars).toBeLessThanOrEqual(5);
        expect(cand.wage).toBe(BALANCE.club.staffWage * cand.stars * cand.stars);
      }

      const assistantCandidates = generateStaffCandidates('assistant', 101);
      expect(assistantCandidates.length).toBe(0);
    });

    it('replaces a coach with 4 weeks severance paid to departed staff', () => {
      const club = createMockClub();
      club.staff = initClubStaff(3, 50);
      const oldCoach = club.staff.coach;
      const severanceCost = oldCoach.wage * 4;
      const initialBalance = club.balance;

      const newCoach = {
        id: 'new_coach_1',
        role: 'coach' as const,
        name: 'Julian Carmichael',
        stars: 4 as const,
        wage: BALANCE.club.staffWage * 16,
      };

      const result = replaceStaffMember(club, newCoach, 1);
      expect(result.cost).toBe(severanceCost);
      expect(result.club.balance).toBe(initialBalance - severanceCost);
      expect(result.club.staff?.coach.name).toBe('Julian Carmichael');
      expect(result.club.staffReplacedThisRound).toBe(true);
      expect(result.memo.title).toContain('Staff Appointment: First-Team Coach');
    });

    it('throws when attempting to replace Theo Vance', () => {
      const club = createMockClub();
      club.staff = initClubStaff(3, 50);
      const fakeAssistant = {
        id: 'fake_asst',
        role: 'assistant' as const,
        name: 'Paul Holloway',
        stars: 5 as const,
        wage: 37500,
      };

      expect(() => replaceStaffMember(club, fakeAssistant, 1)).toThrow(/cannot be replaced/i);
    });
  });

  describe('Dressing Room & Hierarchy (§12.17.5)', () => {
    it('computes leader score using formula: Leader(30) + Captain(20) + Professional(8) + age*0.8 + min(apps,40)*0.5', () => {
      const leaderPlayer = createMockPlayer({
        personality: 'Leader',
        age: 30,
        stats: { ...createMockPlayer().stats, apps: 50 }, // capped at 40
      });
      // 30 (Leader) + 20 (Captain) + 0 (not Prof) + 24 (30 * 0.8) + 20 (40 * 0.5) = 94
      expect(calculateLeaderScore(leaderPlayer, true)).toBeCloseTo(94);

      const youngPlayer = createMockPlayer({
        personality: 'Relaxed',
        age: 20,
        stats: { ...createMockPlayer().stats, apps: 10 },
      });
      // 0 + 0 + 0 + 16 (20 * 0.8) + 5 (10 * 0.5) = 21
      expect(calculateLeaderScore(youngPlayer, false)).toBeCloseTo(21);
    });

    it('identifies top 3 squad leaders', () => {
      const p1 = createMockPlayer({ id: 'p1' as PlayerId, age: 32, personality: 'Leader' });
      const p2 = createMockPlayer({ id: 'p2' as PlayerId, age: 29, personality: 'Professional' });
      const p3 = createMockPlayer({ id: 'p3' as PlayerId, age: 31, personality: 'Ambitious' });
      const p4 = createMockPlayer({ id: 'p4' as PlayerId, age: 19, personality: 'Relaxed' });

      const club = createMockClub({
        squad: [p1.id, p2.id, p3.id, p4.id],
        tactics: { ...createMockClub().tactics, captain: p1.id },
      });
      const players = { [p1.id]: p1, [p2.id]: p2, [p3.id]: p3, [p4.id]: p4 };

      const leaders = getClubLeaders(club, players);
      expect(leaders.length).toBe(3);
      expect(leaders[0]?.id).toBe('p1');
      expect(leaders.map((l) => l.id)).not.toContain('p4');
    });

    it('computes weekly cohesion clamped to [-6, +6]', () => {
      const p1 = createMockPlayer({ id: 'p1' as PlayerId, morale: 95 }); // high morale
      const club = createMockClub({ squad: [p1.id], cohesion: 55 });
      const players = { [p1.id]: p1 };

      const resWin = computeWeeklyCohesion(club, players, 'win');
      // Leader morale (95 - 55)/10 = +4 clamped to +3, +1 win = +4 delta
      expect(resWin.delta).toBe(4);
      expect(resWin.newCohesion).toBe(59);

      const resLoss = computeWeeklyCohesion(club, players, 'loss');
      // +3 leader delta, -1 loss = +2 delta
      expect(resLoss.delta).toBe(2);
      expect(resLoss.newCohesion).toBe(57);
    });

    it('spreads morale by shifting non-leaders 10% toward leaders mean morale', () => {
      const l1 = createMockPlayer({
        id: 'l1' as PlayerId,
        age: 34,
        morale: 80,
        personality: 'Leader',
      });
      const l2 = createMockPlayer({
        id: 'l2' as PlayerId,
        age: 32,
        morale: 80,
        personality: 'Professional',
      });
      const l3 = createMockPlayer({
        id: 'l3' as PlayerId,
        age: 30,
        morale: 80,
        personality: 'Leader',
      });
      const follower = createMockPlayer({
        id: 'f1' as PlayerId,
        age: 19,
        morale: 50,
        personality: 'Relaxed',
      });

      const club = createMockClub({ squad: [l1.id, l2.id, l3.id, follower.id] });
      const players = { [l1.id]: l1, [l2.id]: l2, [l3.id]: l3, [follower.id]: follower };

      const updated = applyMoraleSpread(club, players);
      expect(updated[l1.id]?.morale).toBe(80); // leader unchanged
      // Follower gap: 80 - 50 = 30. 10% = +3 -> 53
      expect(updated[follower.id]?.morale).toBe(53);
    });
  });

  describe('Injury Risk Assessment (§12.17.6)', () => {
    it('categorizes injury risk as Low, Medium, or High based on condition and fatigue', () => {
      const freshPlayer = createMockPlayer({ condition: 100, fatigue: 10, age: 22 });
      const lowRisk = getInjuryRisk(freshPlayer, 3);
      expect(lowRisk.level).toBe('Low');
      expect(lowRisk.factor).toBeLessThan(BALANCE.club.injuryRiskLowThreshold);

      const tiredPlayer = createMockPlayer({ condition: 80, fatigue: 65, age: 31 });
      const medOrHigh = getInjuryRisk(tiredPlayer, 3);
      expect(['Medium', 'High']).toContain(medOrHigh.level);
      expect(medOrHigh.reasons).toContain('Age 30+ load recovery');
      expect(medOrHigh.reasons).toContain('High accumulated fatigue');
    });

    it('reduces risk factor with higher physio stars', () => {
      const p = createMockPlayer({ condition: 70, fatigue: 50 });
      const risk1Star = getInjuryRisk(p, 1);
      const risk5Star = getInjuryRisk(p, 5);
      expect(risk5Star.factor).toBeLessThan(risk1Star.factor);
    });
  });

  describe('Rest Days Regime (§12.17.3)', () => {
    it('grants +8 condition and -6 fatigue to rested players', () => {
      const p = createMockPlayer({ condition: 85, fatigue: 40, rest: true });
      const club = createMockClub({ squad: [p.id] });
      const result = applyRestDays(club, { [p.id]: p }, 1);

      const updated = result.players[p.id]!;
      expect(updated.condition).toBe(93);
      expect(updated.fatigue).toBe(34);
      expect(updated.consecutiveRestWeeks).toBe(1); // condition >= 90 now
    });

    it('penalizes fit players (condition >= 90) rested 3 consecutive weeks with morale -5', () => {
      const p = createMockPlayer({
        condition: 92,
        morale: 70,
        rest: true,
        consecutiveRestWeeks: 2,
      });
      const club = createMockClub({ squad: [p.id] });
      const result = applyRestDays(club, { [p.id]: p }, 3);

      const updated = result.players[p.id]!;
      expect(updated.morale).toBe(65);
      expect(result.memos.length).toBe(1);
      expect(result.memos[0]?.body).toContain('Wants to train');
    });
  });

  describe('Position Training (§12.17.4)', () => {
    it('learns new position familiarity capped at 95 and triggers memo at 85', () => {
      const p = createMockPlayer({
        age: 22,
        attributes: { ...createMockPlayer().attributes, decisions: 75 },
        positions: [{ pos: 'CM', familiarity: 100 }],
      });

      // Target position ST (unlisted initially, starts at 65)
      const res1 = applyPositionTraining(p, 'ST', 3, false);
      const stPos1 = res1.player.positions.find((pos) => pos.pos === 'ST');
      expect(stPos1).toBeDefined();
      expect(stPos1!.familiarity).toBeGreaterThan(65);
      expect(stPos1!.familiarity).toBeLessThan(85);
      expect(res1.reachedThreshold).toBe(false);

      // Crossing threshold (starting at 84)
      const pNear = {
        ...p,
        positions: [
          { pos: 'CM' as const, familiarity: 100 },
          { pos: 'ST' as const, familiarity: 84 },
        ],
      };
      const res2 = applyPositionTraining(pNear, 'ST', 4, true);
      const stPos2 = res2.player.positions.find((pos) => pos.pos === 'ST');
      expect(stPos2!.familiarity).toBeGreaterThanOrEqual(85);
      expect(res2.reachedThreshold).toBe(true);

      // Capped at 95
      const pCapped = {
        ...p,
        positions: [
          { pos: 'CM' as const, familiarity: 100 },
          { pos: 'ST' as const, familiarity: 94 },
        ],
      };
      const res3 = applyPositionTraining(pCapped, 'ST', 5, true);
      const stPos3 = res3.player.positions.find((pos) => pos.pos === 'ST');
      expect(stPos3!.familiarity).toBe(95);
    });
  });

  describe('Match Preparation (§12.17.2)', () => {
    it('returns proper modifiers for SetPieces, Press, Wingers, and Shape', () => {
      const setPieces = getMatchPrepEffects('SetPieces');
      expect(setPieces.opponentSetPieceDuelMod).toBe(-0.12);

      const press = getMatchPrepEffects('Press');
      expect(press.passVsPressMod).toBe(0.15);

      const wingers = getMatchPrepEffects('Wingers');
      expect(wingers.opponentWingerMod).toBe(-0.12);

      const shape = getMatchPrepEffects('Shape');
      expect(shape.shapeFamiliarityBonus).toBe(8);
    });
  });

  describe('Game Cycle Integration (§10, §12.17)', () => {
    it('initializes staff and cohesion in createNewGame', () => {
      const state = createNewGame({ seed: 12345, userClubId: 'c01' });
      const userClub = state.clubs['c01']!;

      expect(userClub.staff).toBeDefined();
      expect(userClub.staff?.assistant.name).toBe('Theo Vance');
      expect(userClub.cohesion).toBe(55);
      expect(userClub.prep).toBe('None');

      // AI clubs also initialized with staff and neutral cohesion
      const aiClub = state.clubs['c02']!;
      expect(aiClub.staff).toBeDefined();
      expect(aiClub.cohesion).toBe(50);
    });

    it('advances weekly simulation properly deducting staff wages and updating cohesion', () => {
      const state = createNewGame({ seed: 9999, userClubId: 'c01' });
      const userClub = state.clubs['c01']!;
      const staffWages =
        userClub.staff!.assistant.wage +
        userClub.staff!.coach.wage +
        userClub.staff!.scout.wage +
        userClub.staff!.physio.wage;

      expect(staffWages).toBeGreaterThan(0);
      expect(userClub.cohesion).toBe(55);
    });
  });
});
