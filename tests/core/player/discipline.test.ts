// Tests for SPEC §12.6 Discipline and Press triggers
import { describe, it, expect } from 'vitest';
import { processPlayerMatchCards, shouldTriggerPostMatchPress } from '@/core/player/discipline';
import { Player, Club, Fixture, MatchResult } from '@/core/types';
import { createRng } from '@/core/rng';

function createMockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p_disc',
    firstName: 'Jon',
    lastName: 'Tackler',
    nationality: 'ENG',
    age: 26,
    heightCm: 182,
    foot: 'Right',
    positions: [{ pos: 'CB', familiarity: 100 }],
    attributes: {
      tackling: 75,
      positioning: 70,
      heading: 72,
      strength: 78,
      pace: 68,
      decisions: 65,
      composure: 60,
      stamina: 75,
      workRate: 70,
      finishing: 30,
      longShots: 30,
      passing: 55,
      crossing: 40,
      firstTouch: 58,
      dribbling: 50,
      setPieces: 35,
      offTheBall: 45,
      reflexes: 5,
      handling: 5,
      oneOnOnes: 5,
      aerialCommand: 5,
    },
    potential: 78,
    personality: 'Temperamental',
    clubId: 'c01',
    squadNumber: 4,
    contract: null,
    condition: 100,
    fatigue: 0,
    morale: 70,
    injury: null,
    suspendedMatches: 0,
    yellowAccumulation: 0,
    form: [],
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
    ...overrides,
  };
}

function createMockClub(id: string, rep: number, rivals: string[] = []): Club {
  return {
    id,
    name: `Club ${id}`,
    shortName: `C${id}`,
    code: id.toUpperCase().slice(0, 3),
    nickname: 'The Boys',
    city: 'City',
    founded: 1900,
    stadium: { name: 'Park', capacity: 25000 },
    colors: { primary: '#111', secondary: '#fff', text: '#fff' },
    reputation: rep,
    wageBudget: 100000,
    transferBudget: 5000000,
    balance: 10000000,
    boardConfidence: 60,
    fanMood: 60,
    rivals,
    squad: [],
  } as unknown as Club;
}

describe('SPEC §12.6 Cards and bans', () => {
  it('accumulates yellow cards and bans after 5 yellows, resetting accumulation', () => {
    let player = createMockPlayer({ yellowAccumulation: 4 });
    const res = processPlayerMatchCards(player, { yellow: 1, red: 0 });

    expect(res.newSuspension).toBe(1);
    expect(res.newYellowAccumulation).toBe(0);
    expect(res.banReason).toBe('YELLOW_ACCUMULATION');
  });

  it('awards 1-match ban for second yellow red card', () => {
    const player = createMockPlayer({ yellowAccumulation: 2 });
    const res = processPlayerMatchCards(player, { yellow: 1, red: 1, isDirectRed: false });

    expect(res.newSuspension).toBe(1);
    expect(res.banReason).toBe('SECOND_YELLOW');
  });

  it('awards 2-match ban for direct red card', () => {
    const player = createMockPlayer({ yellowAccumulation: 1 });
    const res = processPlayerMatchCards(player, { yellow: 0, red: 1, isDirectRed: true });

    expect(res.newSuspension).toBe(2);
    expect(res.banReason).toBe('DIRECT_RED');
  });
});

describe('SPEC §12.6 Press conference triggers', () => {
  const userClub = createMockClub('c01', 3, ['c02']);
  const oppClub = createMockClub('c02', 3, ['c01']);
  const topClub = createMockClub('c05', 5);

  const mockFixture = {
    id: 'f_test',
    matchday: 2,
    homeId: 'c01',
    awayId: 'c02',
    kickoff: 'Afternoon',
    weather: 'Clear',
  } as unknown as Fixture;

  const mockResult: MatchResult = {
    fixtureId: 'f_test',
    homeGoals: 2,
    awayGoals: 1,
    events: [],
    stats: {
      home: {} as any,
      away: {} as any,
    },
    players: [],
    motm: 'p_test',
    injuries: [],
  };

  it('always triggers press for derby matches', () => {
    const rng = createRng(1);
    const res = shouldTriggerPostMatchPress({
      fixture: mockFixture,
      userClub,
      opponentClub: oppClub,
      result: mockResult,
      isUserHome: true,
      matchday: 5,
      streak: { type: 'none', count: 0 },
      rng,
    });
    expect(res.triggered).toBe(true);
    expect(res.reason).toBe('Derby match');
  });

  it('always triggers press for matchday 1', () => {
    const rng = createRng(1);
    const neutralOpp = createMockClub('c03', 3);
    const res = shouldTriggerPostMatchPress({
      fixture: mockFixture,
      userClub,
      opponentClub: neutralOpp,
      result: mockResult,
      isUserHome: true,
      matchday: 1,
      streak: { type: 'none', count: 0 },
      rng,
    });
    expect(res.triggered).toBe(true);
    expect(res.reason).toBe('Season opening matchday');
  });

  it('triggers when winning or drawing against a club >= 2 reputation higher', () => {
    const rng = createRng(1);
    const res = shouldTriggerPostMatchPress({
      fixture: mockFixture,
      userClub,
      opponentClub: topClub, // rep 5 vs 3
      result: { ...mockResult, homeGoals: 1, awayGoals: 1 },
      isUserHome: true,
      matchday: 4,
      streak: { type: 'none', count: 0 },
      rng,
    });
    expect(res.triggered).toBe(true);
  });

  it('triggers when losing by 3+ goals', () => {
    const rng = createRng(1);
    const neutralOpp = createMockClub('c03', 3);
    const res = shouldTriggerPostMatchPress({
      fixture: mockFixture,
      userClub,
      opponentClub: neutralOpp,
      result: { ...mockResult, homeGoals: 0, awayGoals: 4 },
      isUserHome: true,
      matchday: 6,
      streak: { type: 'none', count: 0 },
      rng,
    });
    expect(res.triggered).toBe(true);
    expect(res.reason).toBe('Heavy defeat by 3+ goals');
  });

  it('triggers when winning or losing streak reaches 3', () => {
    const rng = createRng(1);
    const neutralOpp = createMockClub('c03', 3);
    const res = shouldTriggerPostMatchPress({
      fixture: mockFixture,
      userClub,
      opponentClub: neutralOpp,
      result: { ...mockResult, homeGoals: 1, awayGoals: 0 },
      isUserHome: true,
      matchday: 7,
      streak: { type: 'win', count: 3 },
      rng,
    });
    expect(res.triggered).toBe(true);
    expect(res.reason).toBe('3-match win streak reached');
  });
});
