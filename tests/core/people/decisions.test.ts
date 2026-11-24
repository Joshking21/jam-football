// Tests for SPEC §12.19 & §12.20 Injury and Discipline Decisions
import { describe, it, expect } from 'vitest';
import { createNewGame } from '@/core/game/newGame';
import { createRng } from '@/core/rng';
import { BALANCE } from '@/config/balance';
import {
  getKnockPhysioRead,
  checkWarmupScare,
  calculateRushPhysioFactor,
} from '@/core/player/injuries';
import {
  checkForWeeklyDisciplineIncident,
  resolveDisciplineIncident,
} from '@/core/people/incidents';
import { createMatch } from '@/core/match/engine';
import { buildTeamSheet, advance, runWeeklyProcessing } from '@/core/game/advance';
import { createDefaultSetPieceTactics } from '@/core/match/setPieces';
import { MatchCommand } from '@/core/types';

describe('SPEC §12.19.1 In-Match Knocks', () => {
  it('calculates physio knock percentage read correctly based on physio stars', () => {
    expect(getKnockPhysioRead(1).pct).toBe(70);
    expect(getKnockPhysioRead(3).pct).toBe(80);
    expect(getKnockPhysioRead(5).pct).toBe(90);
    expect(getKnockPhysioRead(0).pct).toBe(70); // clamped at 70
    expect(getKnockPhysioRead(6).pct).toBe(90); // clamped at 90
    expect(getKnockPhysioRead(3).line).toContain('About 80%');
  });

  it('handles knock command with take_off decision', () => {
    const game = createNewGame({ userClubId: 'c01', managerName: 'Manager', seed: 101 });
    const userClub = game.clubs.c01;
    const starterId = userClub.tactics.lineup[0]!;
    const player = game.players[starterId]!;
    player.condition = 95;

    const sheetHome = buildTeamSheet(userClub, game.players, 1);
    const sheetAway = buildTeamSheet(game.clubs.c02, game.players, 1);
    const match = createMatch(
      {
        home: sheetHome,
        away: sheetAway,
        weather: 'dry',
        matchday: 1,
        homeTactics: userClub.tactics.instructions,
        awayTactics: game.clubs.c02.tactics.instructions,
        homeSetPieces: createDefaultSetPieceTactics(),
        awaySetPieces: createDefaultSetPieceTactics(),
        aiControls: [],
        knocksSetting: 'ask',
      },
      555,
    );

    const liveP = (match as any).players[starterId];
    expect(liveP).toBeDefined();
    liveP.hasKnock = true;

    // Apply knock command: take off
    const cmd: MatchCommand = {
      kind: 'knock',
      side: 'home',
      playerId: starterId,
      decision: 'take_off',
      issuedAtT: 1200,
    };
    (match as any).applySingleCommand(cmd, false);

    expect(liveP.knockDecision).toBe('take_off');
    expect(liveP.condition).toBe(95 + BALANCE.injuryDecisions.knockTakeOffConditionDelta);
    expect((match as any).homeTeam.lineup.includes(starterId)).toBe(false);
    expect((match as any).homeTeam.subsUsed).toBe(1);
    expect((match as any).homeTeam.inPlayWindowsUsed).toBe(1);
  });

  it('handles knock command with play_on and carry_to_ht decisions', () => {
    const game = createNewGame({ userClubId: 'c01', managerName: 'Manager', seed: 102 });
    const userClub = game.clubs.c01;
    const starter1Id = userClub.tactics.lineup[0]!;
    const starter2Id = userClub.tactics.lineup[1]!;

    const sheetHome = buildTeamSheet(userClub, game.players, 1);
    const sheetAway = buildTeamSheet(game.clubs.c02, game.players, 1);
    const match = createMatch(
      {
        home: sheetHome,
        away: sheetAway,
        weather: 'dry',
        matchday: 1,
        homeTactics: userClub.tactics.instructions,
        awayTactics: game.clubs.c02.tactics.instructions,
        homeSetPieces: createDefaultSetPieceTactics(),
        awaySetPieces: createDefaultSetPieceTactics(),
        aiControls: [],
      },
      556,
    );

    const p1 = (match as any).players[starter1Id];
    p1.hasKnock = true;
    (match as any).applySingleCommand(
      {
        kind: 'knock',
        side: 'home',
        playerId: starter1Id,
        decision: 'play_on',
        issuedAtT: 1000,
      },
      false,
    );
    expect(p1.knockDecision).toBe('play_on');
    expect(p1.severityOneLevelUp).toBe(true);
    // Stays on pitch
    expect((match as any).homeTeam.lineup.includes(starter1Id)).toBe(true);

    const p2 = (match as any).players[starter2Id];
    p2.hasKnock = true;
    (match as any).applySingleCommand(
      {
        kind: 'knock',
        side: 'home',
        playerId: starter2Id,
        decision: 'carry_to_ht',
        issuedAtT: 1000,
      },
      false,
    );
    expect(p2.knockDecision).toBe('carry_to_ht');
    // Still in lineup before half-time
    expect((match as any).homeTeam.lineup.includes(starter2Id)).toBe(true);

    // Simulate to half-time whistle
    match.runUntil((match as any).periodEnd + 5);

    // At half-time, p2 should be automatically subbed off without using an in-play window
    expect((match as any).homeTeam.lineup.includes(starter2Id)).toBe(false);
    expect((match as any).homeTeam.subsUsed).toBe(1);
    expect((match as any).homeTeam.inPlayWindowsUsed).toBe(0);
  });
});

describe('SPEC §12.19.2 Rushing Players Back', () => {
  it('calculates rush physio factor from stars', () => {
    expect(calculateRushPhysioFactor(1)).toBeCloseTo(1.12, 5);
    expect(calculateRushPhysioFactor(5)).toBeCloseTo(0.8, 5);
  });

  it('creates rush back offer when matchdaysOut === 1', () => {
    const game = createNewGame({ userClubId: 'c01', managerName: 'Manager', seed: 201 });
    const userClub = game.clubs.c01;
    const injuredPlayerId = userClub.squad[0]!;
    const p = game.players[injuredPlayerId]!;

    // Player with 2 matchdays out decrements to 1 during weekly processing
    p.injury = {
      type: 'Hamstring strain',
      matchdaysOut: 2,
      severity: 'Minor',
    };

    // Advancing week decrements matchdaysOut to 1 and generates rush back offer
    const nextGame = runWeeklyProcessing(game);
    expect(nextGame.pendingRushBack).toBeDefined();
    expect(nextGame.pendingRushBack?.playerId).toBe(injuredPlayerId);
  });
});

describe('SPEC §12.19.3 Warm-Up Scares', () => {
  it('scales warm-up scare risk by fatigue and physio quality', () => {
    // Base starter check (fatigue = 20, physio = 3)
    let scaresBase = 0;
    for (let i = 0; i < 10000; i++) {
      const r = createRng(i * 7 + 1);
      if (checkWarmupScare(r, 20, 3)) scaresBase++;
    }

    // High fatigue (fatigue = 70 > 50, physio = 3)
    let scaresFatigue = 0;
    for (let i = 0; i < 10000; i++) {
      const r = createRng(i * 7 + 1);
      if (checkWarmupScare(r, 70, 3)) scaresFatigue++;
    }

    // High physio (fatigue = 20, physio = 5)
    let scaresPhysio = 0;
    for (let i = 0; i < 10000; i++) {
      const r = createRng(i * 7 + 1);
      if (checkWarmupScare(r, 20, 5)) scaresPhysio++;
    }

    expect(scaresFatigue).toBeGreaterThan(scaresBase * 1.5);
    expect(scaresPhysio).toBeLessThan(scaresBase * 0.9);
  });
});

describe('SPEC §12.20 Discipline Incidents & Consistency Rule', () => {
  it('prioritises sent off over bust up and other incidents', () => {
    const game = createNewGame({ userClubId: 'c01', managerName: 'Manager', seed: 301 });
    const rng = createRng(42);
    const redCardPlayerId = game.clubs.c01.squad[2]!;

    // Both sent off and low cohesion
    game.clubs.c01.cohesion = 30;
    const incident = checkForWeeklyDisciplineIncident(game, rng, [redCardPlayerId]);

    expect(incident).not.toBeNull();
    expect(incident?.type).toBe('sent_off');
    expect(incident?.playerIds[0]).toBe(redCardPlayerId);
  });

  it('triggers bust up when cohesion < 45 and temperamental player exists', () => {
    const game = createNewGame({ userClubId: 'c01', managerName: 'Manager', seed: 302 });
    game.clubs.c01.cohesion = 35;
    const p1 = game.players[game.clubs.c01.squad[0]!]!;
    p1.personality = 'Temperamental';

    let found = false;
    for (let seed = 0; seed < 100; seed++) {
      const rng = createRng(seed);
      const inc = checkForWeeklyDisciplineIncident(game, rng, []);
      if (inc && inc.type === 'bust_up') {
        found = true;
        expect(inc.playerIds.length).toBe(2);
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('applies fines to player and adds to club balance', () => {
    const game = createNewGame({ userClubId: 'c01', managerName: 'Manager', seed: 303 });
    const userClub = game.clubs.c01;
    const initialBalance = userClub.balance;
    const pId = userClub.squad[0]!;
    const p = game.players[pId]!;
    p.contract = { wagePerWeek: 10000, yearsLeft: 2 };

    const incident = {
      id: 'inc_test',
      matchday: 3,
      type: 'sent_off' as const,
      playerIds: [pId],
      title: 'Red card',
      description: 'Test incident',
      resolved: false,
    };

    const rng = createRng(99);
    const result = resolveDisciplineIncident(game, incident, 'fine', rng);
    const updatedClub = result.nextGameState.clubs.c01;
    const updatedPlayer = result.nextGameState.players[pId]!;

    // 1 week fine for first red card offence = €10,000 added to club balance
    expect(updatedClub.balance).toBe(initialBalance + 10000);
    expect(updatedPlayer.disciplineRecord?.length).toBe(1);
    expect(updatedPlayer.disciplineRecord?.[0]?.punishment).toContain('1 week');
  });

  it('enforces 6-week consistency rule: uneven punishments cause cohesion drop and memo', () => {
    const game = createNewGame({ userClubId: 'c01', managerName: 'Manager', seed: 304 });
    const userClub = game.clubs.c01;
    userClub.cohesion = 62;
    const p1Id = userClub.squad[0]!;
    const p2Id = userClub.squad[1]!;

    // First incident at MD 2: p1 fined for red card
    const inc1 = {
      id: 'inc1',
      matchday: 2,
      type: 'sent_off' as const,
      playerIds: [p1Id],
      title: 'Red card p1',
      description: 'First offence',
      resolved: false,
    };
    const res1 = resolveDisciplineIncident(game, inc1, 'fine', createRng(1));
    expect(res1.consistencyViolation).toBe(false);

    // Second incident at MD 5 (3 weeks later, within 6 weeks): p2 let off with warning for same red card offence
    const inc2 = {
      id: 'inc2',
      matchday: 5,
      type: 'sent_off' as const,
      playerIds: [p2Id],
      title: 'Red card p2',
      description: 'Second offence',
      resolved: false,
    };
    const res2 = resolveDisciplineIncident(res1.nextGameState, inc2, 'warn', createRng(2));

    expect(res2.consistencyViolation).toBe(true);
    // Cohesion takes -4 penalty from post-inc1 level (64 - 4 = 60)
    expect(res2.nextGameState.clubs.c01.cohesion).toBe(
      res1.nextGameState.clubs.c01.cohesion +
        BALANCE.disciplineDecisions.consistencyCohesionPenalty,
    );
    // Inbox memo generated by captain / senior players
    expect(res2.memo).toBeDefined();
    expect(res2.memo?.title).toContain('inconsistency');
  });

  it('blocks advance at WeekSummary when active incident is unresolved', () => {
    const game = createNewGame({ userClubId: 'c01', managerName: 'Manager', seed: 305 });
    game.phase = 'WeekSummary';
    game.activeIncident = {
      id: 'inc_block',
      matchday: 1,
      type: 'late_training',
      playerIds: [game.clubs.c01.squad[0]!],
      title: 'Late to training',
      description: 'Unresolved',
      resolved: false,
    };

    // Should throw error when attempting to advance with unresolved incident
    expect(() => advance(game, createRng(1))).toThrow(
      'Active discipline incident must be resolved before continuing.',
    );
  });
});
