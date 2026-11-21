import { describe, it, expect } from 'vitest';
import { computeHighlightWindows, checkHighlight } from '../../../src/core/match/highlights';
import { MatchEvent } from '../../../src/core/types';

describe('Highlight Selection (SPEC §14.6)', () => {
  it('extracts GOAL windows from 25s before to 6s after', () => {
    const events: MatchEvent[] = [
      {
        seq: 1,
        t: 120,
        minuteLabel: '2',
        half: 1,
        type: 'GOAL',
        side: 'home',
        playerId: 'p1',
        from: { x: 95, y: 34 },
        to: { x: 105, y: 34 },
        duration: 1.0,
        importance: 3,
        scoreAfter: { home: 1, away: 0 },
      },
    ];

    const windows = computeHighlightWindows(events, 'key');
    expect(windows.length).toBe(1);
    expect(windows[0]?.startT).toBe(95); // 120 - 25
    expect(windows[0]?.endT).toBe(126); // 120 + 6
    expect(windows[0]?.reason).toBe('GOAL');
  });

  it('merges overlapping highlight windows', () => {
    const events: MatchEvent[] = [
      {
        seq: 1,
        t: 100,
        minuteLabel: '2',
        half: 1,
        type: 'SHOT',
        side: 'home',
        shot: { context: 'BOX_CENTRAL', xg: 0.15, onTarget: true, bodyPart: 'Foot' },
        duration: 1.0,
        importance: 2,
        scoreAfter: { home: 0, away: 0 },
      },
      {
        seq: 2,
        t: 110,
        minuteLabel: '2',
        half: 1,
        type: 'GOAL',
        side: 'home',
        duration: 1.0,
        importance: 3,
        scoreAfter: { home: 1, away: 0 },
      },
    ];

    // SHOT window: 100 - 15 = 85 to 100 + 3 = 103
    // GOAL window: 110 - 25 = 85 to 110 + 6 = 116
    // Since they overlap, they should merge into [85, 116]
    const windows = computeHighlightWindows(events, 'key');
    expect(windows.length).toBe(1);
    expect(windows[0]?.startT).toBe(85);
    expect(windows[0]?.endT).toBe(116);
    expect(windows[0]?.reason).toBe('GOAL');
  });

  it('filters out low-xG off-target shots in key highlights', () => {
    const events: MatchEvent[] = [
      {
        seq: 1,
        t: 200,
        minuteLabel: '4',
        half: 1,
        type: 'SHOT',
        side: 'home',
        shot: { context: 'OUTSIDE_CENTRAL', xg: 0.03, onTarget: false, bodyPart: 'Foot' },
        duration: 1.0,
        importance: 1,
        scoreAfter: { home: 0, away: 0 },
      },
    ];

    const windows = computeHighlightWindows(events, 'key');
    expect(windows.length).toBe(0);
  });

  it('only highlights the first yellow card for any individual player', () => {
    const events: MatchEvent[] = [
      {
        seq: 1,
        t: 300,
        minuteLabel: '5',
        half: 1,
        type: 'YELLOW',
        side: 'home',
        playerId: 'p1',
        duration: 2.0,
        importance: 2,
        scoreAfter: { home: 0, away: 0 },
      },
      {
        seq: 2,
        t: 500,
        minuteLabel: '9',
        half: 1,
        type: 'YELLOW',
        side: 'home',
        playerId: 'p1', // second yellow (red)
        duration: 2.0,
        importance: 2,
        scoreAfter: { home: 0, away: 0 },
      },
    ];

    const windows = computeHighlightWindows(events, 'key');
    expect(windows.length).toBe(1);
    expect(windows[0]?.startT).toBe(292); // 300 - 8
    expect(windows[0]?.endT).toBe(304); // 300 + 4
  });

  it('checks if current time is inside highlight or in gap correctly', () => {
    const windows = [
      { startT: 50, endT: 80, reason: 'CHANCE' },
      { startT: 200, endT: 230, reason: 'GOAL' },
    ];

    const at30 = checkHighlight(30, windows);
    expect(at30.inside).toBe(false);
    expect(at30.nextWindow?.startT).toBe(50);
    expect(at30.gapRemaining).toBe(20);

    const at60 = checkHighlight(60, windows);
    expect(at60.inside).toBe(true);
    expect(at60.currentWindow?.reason).toBe('CHANCE');

    const at150 = checkHighlight(150, windows);
    expect(at150.inside).toBe(false);
    expect(at150.nextWindow?.startT).toBe(200);
    expect(at150.gapRemaining).toBe(50);
  });
});
