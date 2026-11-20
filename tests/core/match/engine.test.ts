// Implements SPEC §22.1 Engine Unit Tests & Legality Checks
import { describe, it, expect } from 'vitest';
import { createMatch, simulateInstant } from '@/core/match/engine';
import { createTestMatchInput } from './testHelper';
import { MatchCommand } from '@/core/types';

describe('MatchEngine (SPEC §13, §22.1)', () => {
  it('is completely deterministic: same input + seed produces identical events JSON', () => {
    const input = createTestMatchInput(68, 68);
    const seed = 424242;

    const res1 = simulateInstant(input, seed);
    const res2 = simulateInstant(input, seed);

    expect(JSON.stringify(res1.events)).toBe(JSON.stringify(res2.events));
    expect(res1.homeGoals).toBe(res2.homeGoals);
    expect(res1.awayGoals).toBe(res2.awayGoals);
    expect(res1.stats).toEqual(res2.stats);
    expect(res1.players).toEqual(res2.players);
    expect(res1.motm).toBe(res2.motm);
  });

  it('preserves legality: scores equal GOAL events count', () => {
    const input = createTestMatchInput(72, 65);
    const seed = 12345;

    const res = simulateInstant(input, seed);

    const homeGoalEvents = res.events.filter((e) => e.type === 'GOAL' && e.side === 'home').length;
    const awayGoalEvents = res.events.filter((e) => e.type === 'GOAL' && e.side === 'away').length;

    expect(res.homeGoals).toBe(homeGoalEvents);
    expect(res.awayGoals).toBe(awayGoalEvents);
    expect(res.stats.home.goals).toBe(homeGoalEvents);
    expect(res.stats.away.goals).toBe(awayGoalEvents);
  });

  it('preserves legality: possession seconds sum approximately equals match duration', () => {
    const input = createTestMatchInput(68, 68);
    const seed = 99999;

    const res = simulateInstant(input, seed);
    const totalPossession = res.stats.home.possessionSec + res.stats.away.possessionSec;

    // Full match duration is ~5400s + stoppages (~5600-6000s)
    expect(totalPossession).toBeGreaterThan(5000);
    expect(totalPossession).toBeLessThan(7000);
  });

  it('contains no NaN values anywhere in stats, ratings or events', () => {
    const input = createTestMatchInput(70, 68);
    const seed = 88888;

    const res = simulateInstant(input, seed);

    const scanForNaN = (obj: any, path: string = ''): void => {
      if (typeof obj === 'number') {
        expect(Number.isNaN(obj), `NaN found at ${path}`).toBe(false);
      } else if (Array.isArray(obj)) {
        obj.forEach((item, idx) => scanForNaN(item, `${path}[${idx}]`));
      } else if (obj !== null && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
          scanForNaN(v, `${path}.${k}`);
        }
      }
    };

    scanForNaN(res.stats, 'stats');
    scanForNaN(res.players, 'players');
    scanForNaN(res.events, 'events');
    scanForNaN(res.homeGoals, 'homeGoals');
    scanForNaN(res.awayGoals, 'awayGoals');
  });

  it('command rewind keeps earlier events identical (SPEC §13.12)', () => {
    const input = createTestMatchInput(68, 68);
    const seed = 77777;

    const sim = createMatch(input, seed);
    // Simulate up to 2000s
    const firstEvents = sim.runUntil(2000);

    // Issue tactical command at t = 1000
    const cmd: MatchCommand = {
      kind: 'instructions',
      side: 'home',
      instructions: {
        mentality: 'Attacking',
        passing: 'Direct',
        tempo: 'Fast',
        pressing: 'High',
        line: 'High',
        width: 'Wide',
        focus: 'Centre',
        onLoss: 'Mixed',
        onWin: 'Mixed',
        distribution: 'Mixed',
        cornersFor: 'Mixed',
        cornersAgainst: 'Mixed',
        finalThird: 'Mixed',
        crossStyle: 'Mixed',
        offsideTrap: false,
        tackling: 'Mixed',
        forceOpp: 'Mixed',
        timeWasting: 'Never',
        freeKicks: 'Mixed',
        cornerSwing: 'Mixed',
        menBack: 2,
        postMen: 'None',
      },
      issuedAtT: 1000,
    };

    const rewindRes = sim.applyCommandWithRewind(cmd);
    expect(rewindRes.rewound).toBe(true);
    expect(rewindRes.fromSeq).toBeDefined();

    // Any event with seq < fromSeq must match firstEvents exactly
    const eventsBeforeRewind = firstEvents.filter((e) => e.seq < rewindRes.fromSeq!);
    const snapshotEvents = sim.snapshot().events;
    expect(snapshotEvents).toEqual(eventsBeforeRewind);
  });

  it('fast calibration smoke test (SPEC §22.1): 400 equal matches', () => {
    const input = createTestMatchInput(68, 68);
    let totalGoals = 0;
    let draws = 0;
    const n = 400;

    for (let i = 0; i < n; i++) {
      const res = simulateInstant(input, 300000 + i);
      totalGoals += res.homeGoals + res.awayGoals;
      if (res.homeGoals === res.awayGoals) draws++;
    }

    const avgGoals = totalGoals / n;
    const drawPct = (draws / n) * 100;

    expect(avgGoals).toBeGreaterThanOrEqual(2.2);
    expect(avgGoals).toBeLessThanOrEqual(3.2);
    expect(drawPct).toBeGreaterThanOrEqual(18);
    expect(drawPct).toBeLessThanOrEqual(34);
  });
});
