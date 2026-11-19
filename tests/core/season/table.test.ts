// Implements SPEC §22.1 Table tiebreaker unit tests
import { describe, it, expect } from 'vitest';
import { sortTable } from '@/core/season/table';
import { TableRow, Fixture } from '@/core/types';

describe('Table tiebreakers (SPEC §9.1)', () => {
  const dummyClubs = {
    c01: { name: 'Port Calloway FC' },
    c02: { name: 'Ironvale Athletic' },
  };

  it('tiebreaker 1: sorts primarily by points', () => {
    const table: TableRow[] = [
      { clubId: 'c01', p: 1, w: 0, d: 1, l: 0, gf: 1, ga: 1, gd: 0, pts: 1, form: ['D'] },
      { clubId: 'c02', p: 1, w: 1, d: 0, l: 0, gf: 2, ga: 0, gd: 2, pts: 3, form: ['W'] },
    ];
    const sorted = sortTable(table);
    expect(sorted[0]!.clubId).toBe('c02');
  });

  it('tiebreaker 2: sorts by goal difference when points are equal', () => {
    const table: TableRow[] = [
      { clubId: 'c01', p: 1, w: 1, d: 0, l: 0, gf: 2, ga: 1, gd: 1, pts: 3, form: ['W'] },
      { clubId: 'c02', p: 1, w: 1, d: 0, l: 0, gf: 3, ga: 0, gd: 3, pts: 3, form: ['W'] },
    ];
    const sorted = sortTable(table);
    expect(sorted[0]!.clubId).toBe('c02');
  });

  it('tiebreaker 3: sorts by goals for when points and GD are equal', () => {
    const table: TableRow[] = [
      { clubId: 'c01', p: 2, w: 1, d: 0, l: 1, gf: 4, ga: 3, gd: 1, pts: 3, form: ['W', 'L'] },
      { clubId: 'c02', p: 2, w: 1, d: 0, l: 1, gf: 2, ga: 1, gd: 1, pts: 3, form: ['W', 'L'] },
    ];
    const sorted = sortTable(table);
    expect(sorted[0]!.clubId).toBe('c01');
  });

  it('tiebreaker 4: sorts by head-to-head points when pts, GD, and GF are equal', () => {
    const table: TableRow[] = [
      { clubId: 'c01', p: 2, w: 1, d: 0, l: 1, gf: 3, ga: 3, gd: 0, pts: 3, form: [] },
      { clubId: 'c02', p: 2, w: 1, d: 0, l: 1, gf: 3, ga: 3, gd: 0, pts: 3, form: [] },
    ];
    // Fixture where c01 beat c02 2-1
    const fixtures: Fixture[] = [
      {
        id: 'f001',
        matchday: 1,
        homeId: 'c01',
        awayId: 'c02',
        kickoff: 'Afternoon',
        weather: 'Clear',
        isDerby: false,
        result: {
          homeGoals: 2,
          awayGoals: 1,
          scorers: [],
          attendance: 30000,
          motm: 'p0001',
          stats: {} as any,
        },
      },
    ];

    const sorted = sortTable(table, fixtures);
    expect(sorted[0]!.clubId).toBe('c01');
  });

  it('tiebreaker 5: sorts by head-to-head goal difference when h2h points are equal', () => {
    const table: TableRow[] = [
      { clubId: 'c01', p: 2, w: 1, d: 0, l: 1, gf: 4, ga: 4, gd: 0, pts: 3, form: [] },
      { clubId: 'c02', p: 2, w: 1, d: 0, l: 1, gf: 4, ga: 4, gd: 0, pts: 3, form: [] },
    ];
    // Two legs: c01 won 3-1 at home, c02 won 1-0 at home (c01 H2H GD is +1)
    const fixtures: Fixture[] = [
      {
        id: 'f001',
        matchday: 1,
        homeId: 'c01',
        awayId: 'c02',
        kickoff: 'Afternoon',
        weather: 'Clear',
        isDerby: false,
        result: {
          homeGoals: 3,
          awayGoals: 1,
          scorers: [],
          attendance: 30000,
          motm: 'p0001',
          stats: {} as any,
        },
      },
      {
        id: 'f010',
        matchday: 10,
        homeId: 'c02',
        awayId: 'c01',
        kickoff: 'Afternoon',
        weather: 'Clear',
        isDerby: false,
        result: {
          homeGoals: 1,
          awayGoals: 0,
          scorers: [],
          attendance: 30000,
          motm: 'p0002',
          stats: {} as any,
        },
      },
    ];

    const sorted = sortTable(table, fixtures);
    expect(sorted[0]!.clubId).toBe('c01');
  });

  it('tiebreaker 6: sorts alphabetically by club name when everything else is tied', () => {
    const table: TableRow[] = [
      { clubId: 'c01', p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, form: [] },
      { clubId: 'c02', p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, form: [] },
    ];
    // Ironvale Athletic (I) precedes Port Calloway FC (P)
    const sorted = sortTable(table, [], dummyClubs);
    expect(sorted[0]!.clubId).toBe('c02');
    expect(sorted[1]!.clubId).toBe('c01');
  });
});
