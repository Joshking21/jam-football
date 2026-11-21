// Implements SPEC §14.6 Highlight Selection
import { MatchEvent } from '../types';

export interface HighlightWindow {
  startT: number;
  endT: number;
  reason: string;
  primaryEventSeq?: number;
}

/**
 * Computes merged highlight windows for a stream of match events per SPEC §14.6.
 *
 * Windows:
 * - Every GOAL: from 25 sim-seconds before shot to 6 seconds after.
 * - Every SHOT with xg >= 0.08 or on target: from 15 s before to 3 s after.
 * - PENALTY_AWARDED, RED, INJURY, first YELLOW per player, POST: from 8 s before to 4 s after.
 * - KICKOFF of each half: 6 s.
 * - HALF_TIME / FULL_TIME: whistle moment (from 2 s before to 3 s after).
 * - Extended mode: adds every possession/event that reaches the ATT third (from entry - 6 s to end + 2 s).
 */
export function computeHighlightWindows(
  events: MatchEvent[],
  mode: 'key' | 'extended' = 'key',
): HighlightWindow[] {
  const rawWindows: HighlightWindow[] = [];
  const bookedPlayers = new Set<string>();

  for (let i = 0; i < events.length; i++) {
    const ev = events[i]!;

    if (ev.type === 'GOAL') {
      rawWindows.push({
        startT: Math.max(0, ev.t - 25),
        endT: ev.t + 6,
        reason: 'GOAL',
        primaryEventSeq: ev.seq,
      });
    } else if (ev.type === 'SHOT') {
      const isDangerous = (ev.shot?.xg ?? 0) >= 0.08 || Boolean(ev.shot?.onTarget);
      if (isDangerous) {
        rawWindows.push({
          startT: Math.max(0, ev.t - 15),
          endT: ev.t + 3,
          reason: 'CHANCE',
          primaryEventSeq: ev.seq,
        });
      }
    } else if (
      ev.type === 'PENALTY_AWARDED' ||
      ev.type === 'RED' ||
      ev.type === 'INJURY' ||
      ev.type === 'POST'
    ) {
      rawWindows.push({
        startT: Math.max(0, ev.t - 8),
        endT: ev.t + 4,
        reason: ev.type,
        primaryEventSeq: ev.seq,
      });
    } else if (ev.type === 'YELLOW') {
      if (ev.playerId && !bookedPlayers.has(ev.playerId)) {
        bookedPlayers.add(ev.playerId);
        rawWindows.push({
          startT: Math.max(0, ev.t - 8),
          endT: ev.t + 4,
          reason: 'YELLOW',
          primaryEventSeq: ev.seq,
        });
      }
    } else if (ev.type === 'KICKOFF') {
      rawWindows.push({
        startT: Math.max(0, ev.t),
        endT: ev.t + 6,
        reason: 'KICKOFF',
        primaryEventSeq: ev.seq,
      });
    } else if (ev.type === 'HALF_TIME' || ev.type === 'FULL_TIME') {
      rawWindows.push({
        startT: Math.max(0, ev.t - 2),
        endT: ev.t + 3,
        reason: ev.type,
        primaryEventSeq: ev.seq,
      });
    } else if (mode === 'extended') {
      // Extended adds every possession that reaches the ATT third
      const isAttThird =
        (ev.from && (ev.from.x >= 70 || ev.from.x <= 35)) ||
        (ev.to && (ev.to.x >= 70 || ev.to.x <= 35));
      if (isAttThird && ev.duration > 0) {
        rawWindows.push({
          startT: Math.max(0, ev.t - 6),
          endT: ev.t + ev.duration + 2,
          reason: 'ATTACK',
          primaryEventSeq: ev.seq,
        });
      }
    }
  }

  // Sort windows by start time
  rawWindows.sort((a, b) => a.startT - b.startT);

  // Merge overlapping or adjacent windows
  const merged: HighlightWindow[] = [];
  for (const win of rawWindows) {
    if (merged.length === 0) {
      merged.push({ ...win });
      continue;
    }

    const prev = merged[merged.length - 1]!;
    if (win.startT <= prev.endT + 1.0) {
      // Overlap or close gap: extend previous window
      prev.endT = Math.max(prev.endT, win.endT);
      if (win.reason === 'GOAL') prev.reason = 'GOAL';
    } else {
      merged.push({ ...win });
    }
  }

  return merged;
}

export interface HighlightCheckResult {
  inside: boolean;
  currentWindow?: HighlightWindow;
  nextWindow?: HighlightWindow;
  gapRemaining: number;
}

/**
 * Checks whether presentation time `pt` is inside any highlight window.
 */
export function checkHighlight(pt: number, windows: HighlightWindow[]): HighlightCheckResult {
  for (let i = 0; i < windows.length; i++) {
    const w = windows[i]!;
    if (pt >= w.startT && pt <= w.endT) {
      return {
        inside: true,
        currentWindow: w,
        nextWindow: windows[i + 1],
        gapRemaining: 0,
      };
    }
    if (pt < w.startT) {
      return {
        inside: false,
        nextWindow: w,
        gapRemaining: w.startT - pt,
      };
    }
  }

  return {
    inside: false,
    gapRemaining: 0,
  };
}
