// Test helpers for constructing mock matches and equal team sheets
import {
  MatchInput,
  TeamSheet,
  PlayerId,
  ClubId,
  Side,
  Formation,
  Attributes,
  Tactics,
} from '@/core/types';
import { FORMATIONS } from '@/config/formations';
import { getDefaultRoleForPos } from '@/config/roles';

export function createMockAttributes(ovr: number): Attributes {
  return {
    finishing: ovr,
    longShots: ovr,
    passing: ovr,
    crossing: ovr,
    firstTouch: ovr,
    dribbling: ovr,
    tackling: ovr,
    heading: ovr,
    setPieces: ovr,
    pace: ovr,
    stamina: ovr,
    strength: ovr,
    offTheBall: ovr,
    positioning: ovr,
    decisions: ovr,
    composure: ovr,
    workRate: ovr,
    reflexes: ovr,
    handling: ovr,
    oneOnOnes: ovr,
    aerialCommand: ovr,
  };
}

export function createMockTeamSheet(
  clubId: ClubId,
  side: Side,
  ovr: number = 68,
  formation: Formation = '4-4-2',
  tacticsOverrides: Partial<Tactics> = {},
): TeamSheet {
  const fDef = FORMATIONS[formation];
  const players: TeamSheet['players'] = {};
  const lineup: (PlayerId | null)[] = [];
  const bench: PlayerId[] = [];

  // Create 11 starters matching formation slots
  fDef.slots.forEach((slot, idx) => {
    const id = `${side}_p${idx}` as PlayerId;
    lineup.push(id);
    players[id] = {
      attributes: createMockAttributes(ovr),
      positions: [{ pos: slot.position, familiarity: 100 }],
      condition: 100,
      fatigue: 0,
      morale: 70,
      personality: 'Professional',
      name: `${side.toUpperCase()} Player ${idx + 1}`,
      shirt: idx + 1,
    };
  });

  // Create 7 bench players
  for (let i = 11; i < 18; i++) {
    const id = `${side}_p${i}` as PlayerId;
    bench.push(id);
    players[id] = {
      attributes: createMockAttributes(ovr),
      positions: [{ pos: i === 11 ? 'GK' : 'CM', familiarity: 100 }],
      condition: 100,
      fatigue: 0,
      morale: 70,
      personality: 'Professional',
      name: `${side.toUpperCase()} Bench ${i + 1}`,
      shirt: i + 1,
    };
  }

  const defaultTactics: Tactics = {
    formation,
    lineup,
    roles: fDef.slots.map((s) => getDefaultRoleForPos(s.position)),
    duties: fDef.slots.map((s) =>
      s.position === 'GK' || s.position === 'CB'
        ? 'Defend'
        : s.position === 'ST'
          ? 'Attack'
          : 'Support',
    ),
    playerInstructions: fDef.slots.map(() => []),
    opposition: [],
    bench,
    captain: lineup[1] ?? null,
    takers: {
      penalty: lineup[9] ?? null,
      freeKick: lineup[7] ?? null,
      corner: lineup[5] ?? null,
      longThrow: null,
    },
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
    ...tacticsOverrides,
  };

  return {
    clubId,
    side,
    tactics: defaultTactics,
    familiarity: 100,
    players,
    trainingBonus: { attack: 0, defence: 0, setPieces: 0 },
    focusBoost: 0,
  };
}

export function createTestMatchInput(
  homeOvr: number = 68,
  awayOvr: number = 68,
  homeTacticsOverrides: Partial<Tactics> = {},
  awayTacticsOverrides: Partial<Tactics> = {},
  aiControls: Side[] = ['home', 'away'],
): MatchInput {
  return {
    fixtureId: 'f_test_001',
    home: createMockTeamSheet('c01', 'home', homeOvr, '4-4-2', homeTacticsOverrides),
    away: createMockTeamSheet('c02', 'away', awayOvr, '4-4-2', awayTacticsOverrides),
    isDerby: false,
    weather: 'Clear',
    userSide: null,
    aiControls,
  };
}
