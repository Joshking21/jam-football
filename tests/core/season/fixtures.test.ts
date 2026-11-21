// Implements SPEC §22.1 Fixture list tests
import { describe, it, expect } from 'vitest';
import { generateFixtures, isDerbyMatch } from '@/core/season/fixtures';
import { CLUBS_DATA } from '@/core/world/clubs.data';

describe('Fixtures generator', () => {
  const clubIds = CLUBS_DATA.map((c) => c.id);
  const fixtures = generateFixtures(clubIds);

  it('generates exactly 90 fixtures across 18 matchdays (5 per matchday)', () => {
    expect(fixtures).toHaveLength(90);

    for (let md = 1; md <= 18; md++) {
      const mdFixtures = fixtures.filter((f) => f.matchday === md);
      expect(mdFixtures).toHaveLength(5);

      // Verify all 10 clubs play on every matchday
      const playingClubs = new Set<string>();
      for (const f of mdFixtures) {
        expect(playingClubs.has(f.homeId)).toBe(false);
        expect(playingClubs.has(f.awayId)).toBe(false);
        playingClubs.add(f.homeId);
        playingClubs.add(f.awayId);
      }
      expect(playingClubs.size).toBe(10);
    }
  });

  it('each club plays each other exactly twice: once home, once away', () => {
    for (const c1 of clubIds) {
      for (const c2 of clubIds) {
        if (c1 === c2) continue;
        const homeMatches = fixtures.filter((f) => f.homeId === c1 && f.awayId === c2);
        const awayMatches = fixtures.filter((f) => f.homeId === c2 && f.awayId === c1);
        expect(homeMatches).toHaveLength(1);
        expect(awayMatches).toHaveLength(1);
      }
    }
  });

  it('no derby occurs on matchday 1 (SPEC §10.3)', () => {
    const md1 = fixtures.filter((f) => f.matchday === 1);
    for (const f of md1) {
      expect(isDerbyMatch(f.homeId, f.awayId)).toBe(false);
      expect(f.isDerby).toBe(false);
    }
  });

  it('no club plays the same opponent in consecutive matchdays (SPEC §10.3 / REVIEW B5)', () => {
    for (const clubId of clubIds) {
      for (let md = 1; md < 18; md++) {
        const m1 = fixtures.find(
          (f) => f.matchday === md && (f.homeId === clubId || f.awayId === clubId),
        )!;
        const opp1 = m1.homeId === clubId ? m1.awayId : m1.homeId;

        const m2 = fixtures.find(
          (f) => f.matchday === md + 1 && (f.homeId === clubId || f.awayId === clubId),
        )!;
        const opp2 = m2.homeId === clubId ? m2.awayId : m2.homeId;

        expect(opp1).not.toBe(opp2);
      }
    }
  });

  it('no club has more than 2 consecutive home or away matches (SPEC §10.3)', () => {
    for (const clubId of clubIds) {
      let homeStreak = 0;
      let awayStreak = 0;

      for (let md = 1; md <= 18; md++) {
        const match = fixtures.find(
          (f) => f.matchday === md && (f.homeId === clubId || f.awayId === clubId),
        )!;
        if (match.homeId === clubId) {
          homeStreak++;
          awayStreak = 0;
        } else {
          awayStreak++;
          homeStreak = 0;
        }

        expect(homeStreak).toBeLessThanOrEqual(2);
        expect(awayStreak).toBeLessThanOrEqual(2);
      }
    }
  });
});
