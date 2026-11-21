import { describe, it, expect } from 'vitest';
import { MatchPlayback } from '../../../src/ui/screens/Match/playback';
import { MatchEvent } from '../../../src/core/types';

describe('MatchPlayback (SPEC §14.1 & §14.7)', () => {
  it('advances presentation time pt by delta * speed', () => {
    const playback = new MatchPlayback();
    playback.setMode('full');
    playback.setFullSpeed(4);

    playback.update(0.1);
    expect(playback.pt).toBeCloseTo(0.4, 2);
  });

  it('pauses and halts time advancement', () => {
    const playback = new MatchPlayback();
    playback.setMode('full');
    playback.pause();

    playback.update(0.1);
    expect(playback.pt).toBe(0);

    playback.resume();
    playback.update(0.1);
    expect(playback.pt).toBeGreaterThan(0);
  });

  it('plays key highlights at 1.25x inside window and fast-forwards gaps at 60x', () => {
    const playback = new MatchPlayback();
    playback.setMode('key');

    const goalEvent: MatchEvent = {
      seq: 1,
      t: 100,
      minuteLabel: '2',
      half: 1,
      type: 'GOAL',
      side: 'home',
      duration: 1.0,
      importance: 3,
      scoreAfter: { home: 1, away: 0 },
    };

    playback.addEvents([goalEvent]);

    // At pt = 0 (before window [75, 106]): gap fast forward
    const gapState = playback.update(0.016);
    expect(gapState.isTimeLapse).toBe(true);
    expect(gapState.speedMultiplier).toBeGreaterThanOrEqual(20);

    // Jump to pt = 80 (inside highlight window)
    playback.pt = 80;
    const highlightState = playback.update(0.016);
    expect(highlightState.isInsideHighlight).toBe(true);
    expect(highlightState.isTimeLapse).toBe(false);
    expect(highlightState.speedMultiplier).toBe(1.25);
  });

  it('triggers slow-motion goal replay and returns to live presentation', () => {
    const playback = new MatchPlayback();
    playback.pt = 105;

    const goalEvent: MatchEvent = {
      seq: 1,
      t: 100,
      minuteLabel: '2',
      half: 1,
      type: 'GOAL',
      side: 'home',
      duration: 1.0,
      importance: 3,
      scoreAfter: { home: 1, away: 0 },
    };

    playback.triggerGoalReplay(goalEvent);
    expect(playback.isReplay).toBe(true);
    expect(playback.pt).toBe(90); // 100 - 10s

    // Final 3 seconds run at 0.6x slow-mo
    playback.pt = 101; // inside final 3s (replayEndT = 103)
    const replayState = playback.update(0.016);
    expect(replayState.speedMultiplier).toBe(0.6);

    // When replay finishes, resumes live pt
    playback.pt = 103.5;
    playback.update(0.016);
    expect(playback.isReplay).toBe(false);
    expect(playback.pt).toBe(105);
  });
});
