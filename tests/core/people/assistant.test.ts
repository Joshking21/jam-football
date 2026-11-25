// Tests for SPEC §15 Assistant Coach Advice Engine (Theo Vance)
import { describe, it, expect } from 'vitest';
import { createNewGame } from '@/core/game/newGame';
import { createRng } from '@/core/rng';
import {
  advise,
  adviseWeek,
  adviseInMatch,
  adviseHalfTime,
  advisePostMatch,
} from '@/core/people/assistant';
import { buildTeamSheet } from '@/core/game/advance';
import { createMatch } from '@/core/match/engine';
import { MatchEvent } from '@/core/types';

function makeEvent(
  partial: Partial<MatchEvent> & {
    seq: number;
    t: number;
    type: MatchEvent['type'];
    side: MatchEvent['side'];
  },
): MatchEvent {
  return {
    minuteLabel: String(Math.floor(partial.t / 60)),
    half: partial.t < 2700 ? 1 : 2,
    duration: 2,
    importance: 1,
    scoreAfter: { home: 0, away: 0 },
    ...partial,
  };
}

describe('SPEC §15.2 Pre-Match Assistant Rules', () => {
  it('picks at most 3 advices, highest priority first, and supports OVR gap + high line rules', () => {
    const game = createNewGame({ userClubId: 'c01', managerName: 'Boss', seed: 42 });
    const userClub = game.clubs.c01!;
    const oppClub = game.clubs.c02!;

    oppClub.style = {
      ...oppClub.style,
      line: 'High',
      pressing: 'High',
      width: 'Wide',
    };
    for (const id of oppClub.tactics.lineup) {
      if (id && game.players[id]) {
        const p = game.players[id]!;
        p.attributes.finishing = 90;
        p.attributes.passing = 90;
        p.attributes.tackling = 90;
        p.attributes.positioning = 90;
        p.attributes.pace = 90;
      }
    }
    const fwdId = userClub.tactics.lineup[9];
    if (fwdId && game.players[fwdId]) {
      game.players[fwdId]!.attributes.pace = 85;
    }

    const advices = advise(
      { kind: 'preMatch', userClub, oppClub, players: game.players },
      createRng(1),
    );
    expect(advices.length).toBeGreaterThan(0);
    expect(advices.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < advices.length; i++) {
      expect(advices[i]!.priority).toBeGreaterThanOrEqual(advices[i - 1]!.priority);
    }
    expect(
      advices.some((a) => a.ruleId === 'pre_stay_compact' || a.ruleId === 'pre_go_in_behind'),
    ).toBe(true);
  });
});

describe('SPEC §15.3 Week Tips', () => {
  it('prioritises resting a player with fatigue > 80', () => {
    const game = createNewGame({ userClubId: 'c01', managerName: 'Boss', seed: 43 });
    const userClub = game.clubs.c01!;
    const tiredId = userClub.squad[0]!;
    game.players[tiredId]!.fatigue = 88;

    const tips = adviseWeek(
      { kind: 'week', userClub, players: game.players, matchday: 3 },
      createRng(2),
    );
    expect(tips).toHaveLength(1);
    expect(tips[0]!.ruleId).toBe('week_rest');
    expect(tips[0]!.apply).toEqual({ type: 'restPlayer', playerId: tiredId });
  });

  it('suggests tactical training when formation familiarity < 50', () => {
    const game = createNewGame({ userClubId: 'c01', managerName: 'Boss', seed: 44 });
    const userClub = game.clubs.c01!;
    for (const id of userClub.squad) {
      game.players[id]!.fatigue = 10;
    }
    userClub.formationFamiliarity[userClub.tactics.formation] = 40;

    const tips = adviseWeek(
      { kind: 'week', userClub, players: game.players, matchday: 3 },
      createRng(3),
    );
    expect(tips).toHaveLength(1);
    expect(tips[0]!.ruleId).toBe('week_train_tactical');
    expect(tips[0]!.apply).toEqual({ type: 'setTrainingTemplate', templateId: 'tactical' });
  });
});

describe('SPEC §15.4 In-Match Rules, Cooldowns, Cap, and Engine Application', () => {
  it('fires flank exposed, drop press, tired player, and respects 6-per-match cap & 20-min cooldown', () => {
    const game = createNewGame({ userClubId: 'c01', managerName: 'Boss', seed: 45 });
    const userClub = game.clubs.c01!;
    const oppClub = game.clubs.c02!;
    const oppSheet = buildTeamSheet(oppClub, game.players, 'away');

    const liveCondition: Record<string, number> = {};
    for (const id of userClub.tactics.lineup) {
      if (id) liveCondition[id] = 55;
    }

    const res1 = adviseInMatch(
      {
        kind: 'inMatch',
        currentT: 1800,
        minute: 30,
        ourSide: 'home',
        ourScore: 0,
        oppScore: 0,
        ourInstructions: { ...userClub.tactics.instructions, pressing: 'High' },
        ourLineup: userClub.tactics.lineup,
        ourBench: userClub.tactics.bench,
        ourRoles: userClub.tactics.roles ?? [],
        subsUsed: 0,
        windowsUsed: 0,
        liveCondition,
        ourYellows: {},
        events: [],
        players: game.players,
        oppSheet,
        firedHistory: {},
        totalFiredInMatch: 0,
      },
      createRng(10),
    );
    expect(res1).toHaveLength(1);
    expect(res1[0]!.ruleId).toBe('im_tired_player');
    expect(res1[0]!.apply?.type).toBe('substitute');

    const res2 = adviseInMatch(
      {
        kind: 'inMatch',
        currentT: 2100,
        minute: 35,
        ourSide: 'home',
        ourScore: 0,
        oppScore: 0,
        ourInstructions: { ...userClub.tactics.instructions, pressing: 'High' },
        ourLineup: userClub.tactics.lineup,
        ourBench: userClub.tactics.bench,
        ourRoles: userClub.tactics.roles ?? [],
        subsUsed: 0,
        windowsUsed: 0,
        liveCondition,
        ourYellows: {},
        events: [],
        players: game.players,
        oppSheet,
        firedHistory: { im_tired_player: 30 },
        totalFiredInMatch: 1,
      },
      createRng(11),
    );
    expect(res2).toHaveLength(1);
    expect(res2[0]!.ruleId).toBe('im_drop_press');
    expect(res2[0]!.apply).toEqual({
      type: 'setInstructions',
      instructions: { pressing: 'Mid' },
    });

    const resCapped = adviseInMatch(
      {
        kind: 'inMatch',
        currentT: 4800,
        minute: 80,
        ourSide: 'home',
        ourScore: 0,
        oppScore: 1,
        ourInstructions: userClub.tactics.instructions,
        ourLineup: userClub.tactics.lineup,
        ourBench: userClub.tactics.bench,
        ourRoles: userClub.tactics.roles ?? [],
        subsUsed: 0,
        windowsUsed: 0,
        liveCondition,
        ourYellows: {},
        events: [],
        players: game.players,
        oppSheet,
        firedHistory: {},
        totalFiredInMatch: 6,
      },
      createRng(12),
    );
    expect(resCapped).toHaveLength(0);
  });

  it('detects flank exposed from opponent events and recommends fb_defensive', () => {
    const game = createNewGame({ userClubId: 'c01', managerName: 'Boss', seed: 46 });
    const userClub = game.clubs.c01!;
    const oppSheet = buildTeamSheet(game.clubs.c02!, game.players, 'away');

    const events: MatchEvent[] = [
      makeEvent({
        seq: 1,
        t: 1200,
        type: 'DRIBBLE',
        side: 'away',
        to: { x: 80, y: 10 },
        importance: 0,
      }),
      makeEvent({
        seq: 2,
        t: 1250,
        type: 'CROSS',
        side: 'away',
        to: { x: 88, y: 8 },
        importance: 0,
      }),
      makeEvent({
        seq: 3,
        t: 1300,
        type: 'SHOT',
        side: 'away',
        to: { x: 85, y: 12 },
        importance: 1,
      }),
      makeEvent({
        seq: 4,
        t: 1400,
        type: 'SHOT',
        side: 'away',
        to: { x: 84, y: 15 },
        importance: 1,
      }),
      makeEvent({
        seq: 5,
        t: 1500,
        type: 'SHOT',
        side: 'away',
        to: { x: 86, y: 11 },
        importance: 1,
      }),
    ];

    const res = adviseInMatch(
      {
        kind: 'inMatch',
        currentT: 1600,
        minute: 26,
        ourSide: 'home',
        ourScore: 0,
        oppScore: 0,
        ourInstructions: userClub.tactics.instructions,
        ourLineup: userClub.tactics.lineup,
        ourBench: userClub.tactics.bench,
        ourRoles: userClub.tactics.roles ?? [],
        subsUsed: 0,
        windowsUsed: 0,
        liveCondition: {},
        ourYellows: {},
        events,
        players: game.players,
        oppSheet,
        firedHistory: {},
        totalFiredInMatch: 0,
      },
      createRng(15),
    );
    expect(res).toHaveLength(1);
    expect(res[0]!.ruleId).toBe('im_flank_exposed');
    expect(res[0]!.apply).toBeDefined();
  });

  it('applying an in-match instruction advice changes the live match engine state', () => {
    const game = createNewGame({ userClubId: 'c01', managerName: 'Boss', seed: 47 });
    const userClub = game.clubs.c01!;
    const awayClub = game.clubs.c02!;
    const sheetHome = buildTeamSheet(userClub, game.players, 'home');
    sheetHome.tactics.instructions = { ...userClub.tactics.instructions, pressing: 'High' };
    const sheetAway = buildTeamSheet(awayClub, game.players, 'away');

    const sim = createMatch(
      {
        fixtureId: 'f_test',
        isDerby: false,
        userSide: 'home',
        home: sheetHome,
        away: sheetAway,
        weather: 'Clear',
        aiControls: [],
      },
      777,
    );

    sim.runUntil(1200);
    sim.applyCommand({
      kind: 'instructions',
      side: 'home',
      instructions: {
        ...userClub.tactics.instructions,
        pressing: 'Mid',
        mentality: 'Attacking',
      },
      issuedAtT: 1200,
    });
    const nextEvs = sim.runUntil(1300);
    expect(nextEvs.some((e) => e.type === 'TACTIC_CHANGE')).toBe(true);
    expect((sim as any).homeTeam.instructions.pressing).toBe('Mid');
    expect((sim as any).homeTeam.instructions.mentality).toBe('Attacking');
  });
});

describe('SPEC §15.5 Half-Time & Post-Match Analysis', () => {
  it('generates half-time bullets (xG, danger man, worst starter sub)', () => {
    const game = createNewGame({ userClubId: 'c01', managerName: 'Boss', seed: 48 });
    const userClub = game.clubs.c01!;
    const oppSheet = buildTeamSheet(game.clubs.c02!, game.players, 'away');
    const worstId = userClub.tactics.lineup[5]!;
    const dangerId = oppSheet.tactics.lineup[9]!;

    const bullets = adviseHalfTime(
      {
        kind: 'halfTime',
        ourSide: 'home',
        homeStats: {
          goals: 0,
          shots: 3,
          shotsOnTarget: 1,
          xg: 0.4,
          possessionSec: 1215,
          passes: 180,
          passesCompleted: 145,
          corners: 1,
          fouls: 5,
          yellow: 0,
          red: 0,
          offsides: 0,
          tackles: 0,
          interceptions: 0,
          saves: 0,
          bigChances: 0,
        },
        awayStats: {
          goals: 1,
          shots: 9,
          shotsOnTarget: 4,
          xg: 1.35,
          possessionSec: 1485,
          passes: 220,
          passesCompleted: 190,
          corners: 4,
          fouls: 4,
          yellow: 1,
          red: 0,
          offsides: 1,
          tackles: 0,
          interceptions: 0,
          saves: 0,
          bigChances: 0,
        },
        events: [
          makeEvent({
            seq: 1,
            t: 500,
            type: 'SHOT',
            side: 'away',
            playerId: dangerId,
            importance: 1,
          }),
          makeEvent({
            seq: 2,
            t: 900,
            type: 'GOAL',
            side: 'away',
            playerId: dangerId,
            importance: 2,
          }),
        ],
        ourLineup: userClub.tactics.lineup,
        ourBench: userClub.tactics.bench,
        ourRatings: { [worstId]: 5.6 },
        oppSheet,
        players: game.players,
      },
      createRng(20),
    );

    expect(bullets.length).toBe(3);
    expect(bullets.some((b) => b.ruleId === 'ht_xg')).toBe(true);
    expect(bullets.some((b) => b.ruleId === 'ht_danger_man')).toBe(true);
    expect(
      bullets.some((b) => b.ruleId === 'ht_worst_starter' && b.apply?.type === 'substitute'),
    ).toBe(true);
  });

  it('generates post-match summary and training recommendation with Apply action', () => {
    const game = createNewGame({ userClubId: 'c01', managerName: 'Boss', seed: 49 });
    const userClub = game.clubs.c01!;
    const oppClub = game.clubs.c02!;

    const analysis = advisePostMatch(
      {
        kind: 'postMatch',
        userClub,
        oppClub,
        isHome: true,
        result: {
          fixtureId: 'f001',
          homeGoals: 0,
          awayGoals: 1,
          stats: {
            home: {
              goals: 0,
              shots: 14,
              shotsOnTarget: 4,
              xg: 2.1,
              possessionSec: 2916,
              passes: 380,
              passesCompleted: 320,
              corners: 6,
              fouls: 9,
              yellow: 1,
              red: 0,
              offsides: 1,
              tackles: 12,
              interceptions: 8,
              saves: 2,
              bigChances: 2,
            },
            away: {
              goals: 1,
              shots: 5,
              shotsOnTarget: 3,
              xg: 0.6,
              possessionSec: 2484,
              passes: 310,
              passesCompleted: 250,
              corners: 2,
              fouls: 11,
              yellow: 2,
              red: 0,
              offsides: 2,
              tackles: 14,
              interceptions: 10,
              saves: 4,
              bigChances: 1,
            },
          },
          events: [],
          players: [],
          motm: oppClub.tactics.lineup[0]!,
          injuries: [],
        },
        players: game.players,
      },
      createRng(30),
    );

    expect(analysis.recommendedTraining).toBe('attacking');
    expect(analysis.advices[0]?.apply).toEqual({
      type: 'setTrainingTemplate',
      templateId: 'attacking',
    });
  });
});
