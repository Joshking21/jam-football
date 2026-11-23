// Tests for SPEC §9.2, §14.2, REVIEW-M4 S1 Match Kit Selection and Clash Detection (ΔE >= 25)
import { describe, it, expect } from 'vitest';
import { colorDeltaE } from '../../../src/core/math';
import { resolveMatchKits } from '../../../src/core/match/kits';
import { CLUBS_DATA } from '../../../src/core/world/clubs.data';
import { Club } from '../../../src/core/types';

describe('Match Kit Clash & Selection (SPEC §9.2, REVIEW-M4 S1)', () => {
  it('correctly computes ΔE between standard colors', () => {
    const whiteVsBlack = colorDeltaE('#FFFFFF', '#000000');
    expect(whiteVsBlack).toBeCloseTo(100, 0);

    // Port Calloway navy (#0B1F3A) vs Corvallen black (#111111) clashes (ΔE < 25)
    const navyVsBlack = colorDeltaE('#0B1F3A', '#111111');
    expect(navyVsBlack).toBeLessThan(25);

    // Port Calloway navy vs Corvallen away white (#FFFFFF) has clear separation (ΔE >= 25)
    const navyVsWhite = colorDeltaE('#0B1F3A', '#FFFFFF');
    expect(navyVsWhite).toBeGreaterThanOrEqual(25);
  });

  it('selects away kit when home shirts clash (c01 vs c10)', () => {
    const c01 = CLUBS_DATA.find((c) => c.id === 'c01') as unknown as Club;
    const c10 = CLUBS_DATA.find((c) => c.id === 'c10') as unknown as Club;

    const assignment = resolveMatchKits(c01, c10);
    expect(assignment.isAwayKitUsed).toBe(true);
    expect(assignment.awayOutfield.shirt).toBe(c10.kits.away.shirt);
    expect(assignment.shirtDeltaE).toBeGreaterThanOrEqual(25);
  });

  it('guarantees ΔE >= 25 between opposing outfield shirts across all pairwise club matchups', () => {
    const clubs = CLUBS_DATA as unknown as Club[];

    for (let i = 0; i < clubs.length; i++) {
      for (let j = 0; j < clubs.length; j++) {
        if (i === j) continue;
        const homeClub = clubs[i]!;
        const awayClub = clubs[j]!;

        const assignment = resolveMatchKits(homeClub, awayClub);
        const delta = colorDeltaE(assignment.homeOutfield.shirt, assignment.awayOutfield.shirt);

        expect(delta).toBeGreaterThanOrEqual(25);
        expect(assignment.shirtDeltaE).toBeGreaterThanOrEqual(25);
      }
    }
  });

  it('ensures goalkeepers contrast with outfield shirts (ΔE >= 25)', () => {
    const c01 = CLUBS_DATA.find((c) => c.id === 'c01') as unknown as Club;
    const c02 = CLUBS_DATA.find((c) => c.id === 'c02') as unknown as Club;

    const assignment = resolveMatchKits(c01, c02);

    const hGkDelta = colorDeltaE(assignment.homeGk.shirt, assignment.homeOutfield.shirt);
    const aGkDelta = colorDeltaE(assignment.awayGk.shirt, assignment.awayOutfield.shirt);

    expect(hGkDelta).toBeGreaterThanOrEqual(25);
    expect(aGkDelta).toBeGreaterThanOrEqual(25);
  });
});
