// Implements SPEC §10.3 Double Round-Robin Fixture Generation
import { ClubId, Fixture, FixtureId } from '../types';
import { makeFixtureId } from '../ids';
import { deriveSeed, createRng } from '../rng';
import { WORLD_SEED } from '@/config/constants';

const DERBY_PAIRS = new Set([
  'c01-c03',
  'c03-c01',
  'c02-c07',
  'c07-c02',
  'c04-c06',
  'c06-c04',
  'c09-c10',
  'c10-c09',
]);

export function isDerbyMatch(clubA: ClubId, clubB: ClubId): boolean {
  return DERBY_PAIRS.has(`${clubA}-${clubB}`);
}

function getBergerMatches(r: number, clubIds: ClubId[]): Array<[ClubId, ClubId]> {
  const matches: Array<[ClubId, ClubId]> = [];
  // Pivot team is index 9
  if (r % 2 === 0) {
    matches.push([clubIds[r]!, clubIds[9]!]);
  } else {
    matches.push([clubIds[9]!, clubIds[r]!]);
  }
  for (let k = 1; k < 5; k++) {
    const t1 = (r - k + 9) % 9;
    const t2 = (r + k) % 9;
    if (k % 2 === 1) {
      matches.push([clubIds[t1]!, clubIds[t2]!]);
    } else {
      matches.push([clubIds[t2]!, clubIds[t1]!]);
    }
  }
  return matches;
}

/**
 * Generates the fixed 90-fixture schedule for the 10 Meridian League clubs (SPEC §10.3).
 */
export function generateFixtures(
  clubIds: ClubId[] = ['c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07', 'c08', 'c09', 'c10'],
): Fixture[] {
  // First half: 9 rounds of Berger pairings (r = 0..8)
  const firstHalf: Array<Array<[ClubId, ClubId]>> = [];
  for (let r = 0; r < 9; r++) {
    firstHalf.push(getBergerMatches(r, clubIds));
  }

  // Second half: mirrored round order with inverted venues
  // This guarantees no club has more than 2 consecutive home or away matches across all 18 matchdays
  const secondHalfOrder = [8, 7, 6, 5, 4, 3, 2, 1, 0];
  const secondHalf: Array<Array<[ClubId, ClubId]>> = secondHalfOrder.map((rIdx) =>
    firstHalf[rIdx]!.map(([h, a]) => [a, h] as [ClubId, ClubId]),
  );

  const allRounds = [...firstHalf, ...secondHalf];

  // Construct Fixture objects
  const fixtures: Fixture[] = [];
  let fixtureSeq = 1;

  for (let matchday = 1; matchday <= 18; matchday++) {
    const roundMatches = allRounds[matchday - 1]!;
    for (const [homeId, awayId] of roundMatches) {
      const fixtureId: FixtureId = makeFixtureId(fixtureSeq);
      const isDerby = isDerbyMatch(homeId, awayId);

      // Kickoff seed (SPEC §10.3)
      const kickoffSeed = deriveSeed(WORLD_SEED, 'kickoff', fixtureId);
      const kRng = createRng(kickoffSeed);
      let kickoff: Fixture['kickoff'] = 'Night';
      if (!isDerby) {
        const kVal = kRng.next();
        if (kVal < 0.5) kickoff = 'Afternoon';
        else if (kVal < 0.8) kickoff = 'Evening';
        else kickoff = 'Night';
      }

      // Weather seed (SPEC §10.3)
      const weatherSeed = deriveSeed(WORLD_SEED, 'weather', fixtureId);
      const wRng = createRng(weatherSeed);
      const wVal = wRng.next();
      let weather: Fixture['weather'] = 'Clear';
      if (wVal < 0.7) weather = 'Clear';
      else if (wVal < 0.9) weather = 'Overcast';
      else weather = 'Rain';

      fixtures.push({
        id: fixtureId,
        matchday,
        homeId,
        awayId,
        kickoff,
        weather,
        isDerby,
        result: null,
      });

      fixtureSeq++;
    }
  }

  return fixtures;
}
