// Implements SPEC §17.4 Commentary Queue, Priorities, Chaining & Voice Ducking
import { BALANCE } from '@/config/balance';
import { MatchEvent, Player } from '@/core/types';
import { audioEngine, AudioEngine } from './engine';
import { resolveCommentary, ResolvedCommentary } from '@/core/match/commentary';
import { assetUrl } from '@/assets/registry';

export interface VoiceTask {
  id: string;
  key?: string;
  text: string;
  voText?: string;
  voiceAudioPath?: string;
  nameAudioPath?: string;
  nameSlot?: 'none' | 'start' | 'end' | string;
  clubAudioPath?: string;
  importance: number;
  simTime: number;
  speaker?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

export interface ActiveCaption {
  id: string;
  text: string;
  importance: number;
  speaker?: string;
}

export class VoiceQueue {
  private engine: AudioEngine;
  private queue: VoiceTask[] = [];
  private currentTask: VoiceTask | null = null;
  private currentSimTime = 0;

  // Web Audio playback nodes
  private currentSource: AudioBufferSourceNode | null = null;
  private currentGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Active caption & subscribers
  private activeCaption: ActiveCaption | null = null;
  private subscribers: Set<(caption: ActiveCaption | null) => void> = new Set();

  // Procedural caption rhythm fallback state
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private mouthTimer: ReturnType<typeof setInterval> | null = null;
  private mouthOpenness = 0; // 0: closed, 1: small, 2: open, 3: wide

  constructor(engine: AudioEngine = audioEngine) {
    this.engine = engine;
  }

  public setEngine(engine: AudioEngine): void {
    this.engine = engine;
  }

  public updateSimTime(simTime: number): void {
    this.currentSimTime = simTime;
  }

  /**
   * Subscribes to active caption changes for CommentaryStrip or TalkScenes
   */
  public subscribe(listener: (caption: ActiveCaption | null) => void): () => void {
    this.subscribers.add(listener);
    listener(this.activeCaption);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notifyCaption(): void {
    this.subscribers.forEach((fn) => fn(this.activeCaption));
  }

  public getActiveCaption(): ActiveCaption | null {
    return this.activeCaption;
  }

  public getMouthOpenness(): number {
    return this.mouthOpenness;
  }

  /**
   * Enqueues a voice task with priority-based preemption and stale-dropping (§17.4)
   */
  public enqueue(task: VoiceTask): void {
    // Drop lines older than 3 sim seconds at start time (§17.4)
    const maxDropAge = BALANCE.audio.voiceMaxDropAgeSimSec;
    if (this.currentSimTime > 0 && this.currentSimTime - task.simTime > maxDropAge) {
      return;
    }

    if (this.currentTask) {
      // Preemption rule: if higher importance, fade current line out over 150 ms (§17.4)
      if (task.importance > this.currentTask.importance) {
        this.preemptCurrent(task);
        return;
      }

      // Drop lower/equal lines if queue is getting congested
      if (this.queue.length >= 2) {
        return;
      }

      this.queue.push(task);
      // Keep queue sorted by importance descending
      this.queue.sort((a, b) => b.importance - a.importance);
    } else {
      this.play(task);
    }
  }

  /**
   * Fades out current line over 150ms and starts the higher-importance task
   */
  private preemptCurrent(nextTask: VoiceTask): void {
    const fadeMs = BALANCE.audio.voiceFadeOutMs; // 150 ms
    const ctx = this.engine.getContext();

    if (this.currentGain && ctx) {
      try {
        const now = ctx.currentTime;
        this.currentGain.gain.cancelScheduledValues(now);
        this.currentGain.gain.setValueAtTime(this.currentGain.gain.value, now);
        this.currentGain.gain.linearRampToValueAtTime(0.0001, now + fadeMs / 1000);
      } catch {
        // ignore
      }
    }

    this.stopPlaybackInternal();

    setTimeout(() => {
      this.play(nextTask);
    }, fadeMs);
  }

  /**
   * Plays a voice task with voice chaining and ducking
   */
  private async play(task: VoiceTask): Promise<void> {
    // Check stale drop rule before starting
    const maxDropAge = BALANCE.audio.voiceMaxDropAgeSimSec;
    if (this.currentSimTime > 0 && this.currentSimTime - task.simTime > maxDropAge) {
      this.advanceQueue();
      return;
    }

    this.currentTask = task;
    this.activeCaption = {
      id: task.id,
      text: task.text,
      importance: task.importance,
      speaker: task.speaker,
    };
    this.notifyCaption();
    task.onStart?.();

    // Duck crowd by -6 dB and music by -10 dB (§17.4)
    this.engine.duck();

    const ctx = this.engine.ensureContext();
    const commentaryGain = this.engine.getBusGain('commentary');

    // Attempt to load asset audio files
    const lineBuffer = task.voiceAudioPath
      ? await this.engine.loadBuffer(task.voiceAudioPath)
      : null;
    const nameBuffer = task.nameAudioPath ? await this.engine.loadBuffer(task.nameAudioPath) : null;
    const clubBuffer = task.clubAudioPath ? await this.engine.loadBuffer(task.clubAudioPath) : null;

    if (ctx && commentaryGain && lineBuffer) {
      // Audio asset playback path with chaining and AnalyserNode
      this.playChainedAudio(ctx, commentaryGain, task, lineBuffer, nameBuffer, clubBuffer);
    } else {
      // Procedural caption-rhythm fallback (§14.11.7, M6 accept)
      this.playCaptionRhythmFallback(task);
    }
  }

  /**
   * Chains voice clips: [name] + [line] or [line] + [name] or [line] + [club]
   */
  private playChainedAudio(
    ctx: AudioContext,
    dest: GainNode,
    task: VoiceTask,
    lineBuffer: AudioBuffer,
    nameBuffer: AudioBuffer | null,
    clubBuffer: AudioBuffer | null,
  ): void {
    const sequence: AudioBuffer[] = [];

    // Chaining logic per §17.4 and §16.3:
    // If nameSlot is 'start' and nameBuffer exists: name -> line
    // If nameSlot is 'end' and nameBuffer exists: line -> name
    // If name file missing, play line alone (caption still shows name)
    if (task.nameSlot === 'start' && nameBuffer) {
      sequence.push(nameBuffer);
      sequence.push(lineBuffer);
    } else if (task.nameSlot === 'end' && nameBuffer) {
      sequence.push(lineBuffer);
      sequence.push(nameBuffer);
    } else {
      sequence.push(lineBuffer);
    }

    // OTHER_GOAL appends club name audio after the line (§17.4)
    if (clubBuffer) {
      sequence.push(clubBuffer);
    }

    this.analyser = this.engine.createAnalyser();
    this.currentGain = ctx.createGain();
    this.currentGain.gain.setValueAtTime(1.0, ctx.currentTime);

    this.currentGain.connect(this.analyser ?? dest);

    let currentIndex = 0;

    const playNext = () => {
      if (currentIndex >= sequence.length) {
        this.finishCurrentTask();
        return;
      }

      const buf = sequence[currentIndex]!;
      currentIndex++;

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.currentGain!);
      src.onended = () => {
        playNext();
      };
      src.start();
      this.currentSource = src;
    };

    playNext();
  }

  /**
   * Procedural fallback when voice audio files are absent (§14.11.7)
   * Delivers speech rhythm at ~5 syllables/sec with pauses at commas and periods.
   */
  private playCaptionRhythmFallback(task: VoiceTask): void {
    const text = task.voText || task.text;
    // Calculate approximate syllables and duration
    const syllables = Math.max(3, Math.round(text.length / 3));
    const commaCount = (text.match(/,/g) || []).length;
    const periodCount = (text.match(/[.!?]/g) || []).length;

    // ~200ms per syllable + 150ms per comma + 300ms per period
    const durationMs = Math.min(
      5500,
      Math.max(1600, syllables * 200 + commaCount * 150 + periodCount * 300),
    );

    // Mouth animation rhythm
    let step = 0;
    this.mouthTimer = setInterval(() => {
      step++;
      // Oscillate mouth openness between 0 (closed) and 3 (wide)
      this.mouthOpenness = (step % 3) + 1;
    }, 140); // 70ms-140ms hold time per §14.11.7

    this.fallbackTimer = setTimeout(() => {
      this.finishCurrentTask();
    }, durationMs);
  }

  private finishCurrentTask(): void {
    this.stopPlaybackInternal();
    const task = this.currentTask;
    this.currentTask = null;
    this.activeCaption = null;
    this.mouthOpenness = 0;
    this.notifyCaption();

    // Unduck crowd and music (§17.4)
    this.engine.unduck();
    task?.onEnd?.();

    this.advanceQueue();
  }

  private stopPlaybackInternal(): void {
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    if (this.mouthTimer) {
      clearInterval(this.mouthTimer);
      this.mouthTimer = null;
    }
    try {
      this.currentSource?.stop();
      this.currentSource?.disconnect();
      this.currentSource = null;
    } catch {
      // ignore
    }
  }

  private advanceQueue(): void {
    while (this.queue.length > 0) {
      const next = this.queue.shift()!;
      const maxDropAge = BALANCE.audio.voiceMaxDropAgeSimSec;
      // Drop if stale
      if (this.currentSimTime > 0 && this.currentSimTime - next.simTime > maxDropAge) {
        continue;
      }
      this.play(next);
      return;
    }
  }

  /**
   * Resolves and enqueues commentary for a match event
   */
  public speakCommentary(
    event: MatchEvent,
    players?: Record<string, Player>,
    options?: {
      isTimeLapse?: boolean;
      weather?: string;
      isDerby?: boolean;
      homeScore?: number;
      awayScore?: number;
    },
  ): ResolvedCommentary | null {
    // During time-lapse gaps, no PBP except goals in other games (SPEC §17.4)
    if (options?.isTimeLapse && event.type !== 'GOAL') {
      return null;
    }

    const resolved = resolveCommentary(event, players, options);
    if (!resolved) return null;

    const voiceAudioPath = assetUrl(`audio/vo/commentary/${resolved.id}.mp3`)
      ? `audio/vo/commentary/${resolved.id}.mp3`
      : undefined;

    const nameAudioPath =
      resolved.playerId && assetUrl(`audio/vo/names/${resolved.playerId}.mp3`)
        ? `audio/vo/names/${resolved.playerId}.mp3`
        : undefined;

    const clubAudioPath =
      resolved.clubId && assetUrl(`audio/vo/clubs/${resolved.clubId}.mp3`)
        ? `audio/vo/clubs/${resolved.clubId}.mp3`
        : undefined;

    this.enqueue({
      id: resolved.id,
      key: resolved.key,
      text: resolved.text,
      voText: resolved.voText,
      voiceAudioPath,
      nameAudioPath,
      nameSlot: resolved.nameSlot,
      clubAudioPath,
      importance: resolved.importance,
      simTime: event.t,
      speaker: resolved.voice === 'COLOR' ? 'Color Commentary' : 'Commentator',
    });

    return resolved;
  }

  /**
   * Speaks an assistant coach stinger ("Gaffer!", "Boss, a word.")
   */
  public speakAssistantStinger(stingerIndex = 1): void {
    const idx = Math.max(1, Math.min(6, stingerIndex));
    const stingerLines = [
      'Gaffer!',
      'Boss, a word.',
      'Gaffer, look at this.',
      'Quick one, boss.',
      'Boss!',
      'Hang on, gaffer.',
    ];
    const text = stingerLines[idx - 1] ?? 'Boss!';
    const path = `audio/vo/assistant/stinger_${idx}.mp3`;

    this.enqueue({
      id: `assistant_stinger_${idx}`,
      text,
      voText: text,
      voiceAudioPath: assetUrl(path) ? path : undefined,
      importance: 2,
      simTime: this.currentSimTime,
      speaker: 'Theo Vance',
    });
  }

  /**
   * Speaks a voiced question from a press reporter (§17.4)
   */
  public speakPressQuestion(questionId: string, voText: string, text: string): void {
    const path = `audio/vo/press/${questionId}.mp3`;
    this.enqueue({
      id: `press_${questionId}`,
      text,
      voText,
      voiceAudioPath: assetUrl(path) ? path : undefined,
      importance: 2,
      simTime: this.currentSimTime,
      speaker: 'Reporter',
    });
  }

  /**
   * Speaks a coach line with player name chaining (§16.3, §17.4)
   */
  public speakCoachLine(
    lineId: string,
    text: string,
    playerId?: string,
    nameSlot: 'start' | 'end' | 'none' = 'none',
  ): void {
    const linePath = `audio/vo/coach/${lineId}.mp3`;
    const namePath = playerId ? `audio/vo/coach_names/${playerId}.mp3` : undefined;

    this.enqueue({
      id: `coach_${lineId}`,
      text,
      voText: text,
      voiceAudioPath: assetUrl(linePath) ? linePath : undefined,
      nameAudioPath: namePath && assetUrl(namePath) ? namePath : undefined,
      nameSlot,
      importance: 2,
      simTime: this.currentSimTime,
      speaker: 'Manager',
    });
  }

  /**
   * Cancels and stops active voice playback
   */
  public cancel(): void {
    this.queue = [];
    this.stopPlaybackInternal();
    if (this.currentTask) {
      this.currentTask = null;
      this.activeCaption = null;
      this.mouthOpenness = 0;
      this.notifyCaption();
      this.engine.unduck();
    }
  }
}

// Global voice queue singleton
export const voiceQueue = new VoiceQueue();
