// Implements SPEC §9.1 Meridian League Table and Tiebreakers
import { TableRow, ClubId, Fixture, Club } from '../types';

export function createInitialTable(clubIds: ClubId[]): TableRow[] {
  return clubIds.map((clubId) => ({
    clubId,
    p: 0,
    w: 0,
    d: 0,
    l: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    pts: 0,
    form: [],
  }));
}

/**
 * Sorts table rows strictly following SPEC §9.1 tiebreakers:
 * 1. Points
 * 2. Goal difference
 * 3. Goals for
 * 4. Head-to-head points
 * 5. Head-to-head goal difference
 * 6. Club name A→Z
 */
export function sortTable(
  table: TableRow[],
  fixtures: Fixture[] = [],
  clubs: Record<ClubId, Pick<Club, 'name'>> = {},
): TableRow[] {
  return [...table].sort((a, b) => {
    // 1. Points
    if (b.pts !== a.pts) return b.pts - a.pts;

    // 2. Goal difference
    if (b.gd !== a.gd) return b.gd - a.gd;

    // 3. Goals for
    if (b.gf !== a.gf) return b.gf - a.gf;

    // 4 & 5. Head-to-head between a and b
    const h2hMatches = fixtures.filter(
      (f) =>
        f.result !== null &&
        ((f.homeId === a.clubId && f.awayId === b.clubId) ||
          (f.homeId === b.clubId && f.awayId === a.clubId)),
    );

    if (h2hMatches.length > 0) {
      let aH2hPts = 0;
      let bH2hPts = 0;
      let aH2hGf = 0;
      let bH2hGf = 0;

      for (const m of h2hMatches) {
        if (!m.result) continue;
        const aIsHome = m.homeId === a.clubId;
        const aGoals = aIsHome ? m.result.homeGoals : m.result.awayGoals;
        const bGoals = aIsHome ? m.result.awayGoals : m.result.homeGoals;

        aH2hGf += aGoals;
        bH2hGf += bGoals;

        if (aGoals > bGoals) aH2hPts += 3;
        else if (bGoals > aGoals) bH2hPts += 3;
        else {
          aH2hPts += 1;
          bH2hPts += 1;
        }
      }

      if (bH2hPts !== aH2hPts) return bH2hPts - aH2hPts;

      const aH2hGd = aH2hGf - bH2hGf;
      const bH2hGd = bH2hGf - aH2hGf;
      if (bH2hGd !== aH2hGd) return bH2hGd - aH2hGd;
    }

    // 6. Club name A→Z
    const aName = clubs[a.clubId]?.name || a.clubId;
    const bName = clubs[b.clubId]?.name || b.clubId;
    return aName.localeCompare(bName);
  });
}
