// Implements SPEC §14.1 & §14.7 Match Playback Controller
import { MatchEvent, Side } from '../../../core/types';
import {
  HighlightWindow,
  computeHighlightWindows,
  checkHighlight,
} from '../../../core/match/highlights';

export type PlaybackMode = 'key' | 'extended' | 'full';

export interface PlaybackState {
  pt: number; // presentation time in match clock seconds (0..5400+)
  half: 1 | 2;
  paused: boolean;
  mode: PlaybackMode;
  fullSpeed: 2 | 4 | 8;
  speedMultiplier: number;
  isTimeLapse: boolean;
  timeLapseProgress: number; // 0..1 in current gap
  isInsideHighlight: boolean;
  isReplay: boolean;
  currentEvent: MatchEvent | null;
  score: { home: number; away: number };
  lastGoalEvent: MatchEvent | null;
}

export interface PlaybackCallbacks {
  onEventStarted?: (ev: MatchEvent) => void;
  onGoal?: (ev: MatchEvent) => void;
  onHalfTime?: () => void;
  onFullTime?: () => void;
}

export class MatchPlayback {
  private events: MatchEvent[] = [];
  private highlightWindows: HighlightWindow[] = [];
  private callbacks: PlaybackCallbacks;

  // Playback state
  public pt = 0;
  public half: 1 | 2 = 1;
  public paused = false;
  public mode: PlaybackMode = 'key';
  public fullSpeed: 2 | 4 | 8 = 4;
  public currentEvent: MatchEvent | null = null;
  public score = { home: 0, away: 0 };
  public lastGoalEvent: MatchEvent | null = null;

  // Gap / Time-lapse state
  public isTimeLapse = false;
  public timeLapseProgress = 0;
  public isInsideHighlight = false;

  // Replay state
  public isReplay = false;
  public replayEndT = 0;
  public replayResumePt = 0;
  private goalReplayAllowed = true;
  private seenEventSeqs = new Set<number>();

  constructor(callbacks: PlaybackCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Feeds newly received match events from the worker.
   */
  public addEvents(newEvents: MatchEvent[]) {
    this.events = [...this.events, ...newEvents].sort((a, b) => a.t - b.t || a.seq - b.seq);
    this.recomputeHighlights();
  }

  public setMode(mode: PlaybackMode) {
    this.mode = mode;
    this.recomputeHighlights();
  }

  public setFullSpeed(speed: 2 | 4 | 8) {
    this.fullSpeed = speed;
  }

  public togglePause(): boolean {
    this.paused = !this.paused;
    return this.paused;
  }

  public pause() {
    this.paused = true;
  }

  public resume() {
    this.paused = false;
  }

  public resumeSecondHalf() {
    this.half = 2;
    this.paused = false;
  }

  private recomputeHighlights() {
    this.highlightWindows = computeHighlightWindows(
      this.events,
      this.mode === 'extended' ? 'extended' : 'key',
    );
  }

  /**
   * Triggers a replay of the most recent goal per SPEC §14.7.
   * Replays 10 sim seconds before the goal, slowing to 0.6x for the final 3 seconds.
   */
  public triggerGoalReplay(goalEv: MatchEvent) {
    this.isReplay = true;
    this.replayResumePt = this.pt;
    this.pt = Math.max(0, goalEv.t - 10);
    this.replayEndT = goalEv.t + 3;
  }

  public cancelReplay() {
    if (this.isReplay) {
      this.isReplay = false;
      this.pt = this.replayResumePt;
    }
  }

  /**
   * Main per-frame playback update driven by realDelta seconds.
   */
  public update(realDelta: number): PlaybackState {
    if (this.paused) {
      return this.getState(0);
    }

    // 1. Determine speed multiplier
    let speed = 1.0;

    if (this.isReplay) {
      // Goal replay speed: 1.0x until final 3 seconds, then 0.6x slow-mo
      const distToGoal = this.replayEndT - 3 - this.pt;
      speed = distToGoal <= 0 ? 0.6 : 1.0;
      this.isTimeLapse = false;
      this.isInsideHighlight = true;
    } else if (this.mode === 'full') {
      speed = this.fullSpeed;
      this.isTimeLapse = false;
      this.isInsideHighlight = true;
    } else {
      // Key or Extended mode: evaluate highlight windows
      const check = checkHighlight(this.pt, this.highlightWindows);
      this.isInsideHighlight = check.inside;

      if (check.inside) {
        speed = this.mode === 'key' ? 1.25 : 1.5;
        this.isTimeLapse = false;
        this.timeLapseProgress = 1.0;
      } else {
        // Between highlight windows: 60x (key) or 40x (extended), max 3.5s real time per gap
        const baseGapSpeed = this.mode === 'key' ? 60 : 40;
        const gapLength = check.gapRemaining;
        // Ensure gap takes at most 3.5s real time: min speed = gapLength / 3.5
        speed = Math.max(baseGapSpeed, gapLength / 3.5);
        this.isTimeLapse = true;
        this.timeLapseProgress = gapLength > 0 ? 1 - Math.min(1, gapLength / 120) : 0;
      }
    }

    // 2. Advance Presentation Time (pt)
    this.pt += realDelta * speed;

    // 3. Replay finish check
    if (this.isReplay && this.pt >= this.replayEndT) {
      this.isReplay = false;
      this.pt = this.replayResumePt;
    }

    // 4. Process events at or before current pt
    let activeEvent: MatchEvent | null = null;

    for (let i = 0; i < this.events.length; i++) {
      const ev = this.events[i]!;

      // Check if event has started
      if (ev.t <= this.pt) {
        if (!this.seenEventSeqs.has(ev.seq)) {
          this.seenEventSeqs.add(ev.seq);

          if (ev.scoreAfter) {
            this.score = { ...ev.scoreAfter };
          }

          if (ev.type === 'GOAL') {
            this.lastGoalEvent = ev;
            this.callbacks.onGoal?.(ev);

            // Auto-trigger replay in Key/Extended modes
            if (this.mode !== 'full' && this.goalReplayAllowed && !this.isReplay) {
              this.triggerGoalReplay(ev);
              break;
            }
          } else if (ev.type === 'HALF_TIME' && this.half === 1) {
            this.paused = true;
            this.callbacks.onHalfTime?.();
            break;
          } else if (ev.type === 'FULL_TIME') {
            this.paused = true;
            this.callbacks.onFullTime?.();
            break;
          }

          this.callbacks.onEventStarted?.(ev);
        }
      }

      // Check if this event is currently ongoing
      if (this.pt >= ev.t && this.pt <= ev.t + Math.max(0.2, ev.duration)) {
        activeEvent = ev;
      }
    }

    this.currentEvent = activeEvent;

    return this.getState(speed);
  }

  public getState(speedMultiplier: number): PlaybackState {
    return {
      pt: this.pt,
      half: this.half,
      paused: this.paused,
      mode: this.mode,
      fullSpeed: this.fullSpeed,
      speedMultiplier,
      isTimeLapse: this.isTimeLapse,
      timeLapseProgress: this.timeLapseProgress,
      isInsideHighlight: this.isInsideHighlight,
      isReplay: this.isReplay,
      currentEvent: this.currentEvent,
      score: { ...this.score },
      lastGoalEvent: this.lastGoalEvent,
    };
  }
}
