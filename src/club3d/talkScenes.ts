// SPEC §11.25.5 Talk scenes: watch, then choose & §14.11.2 Team-talk reactions
import type { TalkSceneBeat, TalkSceneChoice, TeamTalkReaction, FaceMood } from './types';
import { voiceQueue } from '../audio';

export class TalkSceneManager {
  private beats: TalkSceneBeat[] = [];
  private currentBeatIndex = 0;
  private isFinished = false;
  private onBeatChanged?: (beat: TalkSceneBeat | null) => void;
  private onSceneEnded?: () => void;
  private summaryTimeout: number | null = null;

  public startScene(
    beats: TalkSceneBeat[],
    onBeatChanged?: (beat: TalkSceneBeat | null) => void,
    onSceneEnded?: () => void,
  ) {
    this.beats = beats;
    this.currentBeatIndex = 0;
    this.isFinished = false;
    this.onBeatChanged = onBeatChanged;
    this.onSceneEnded = onSceneEnded;

    this.playCurrentBeat();
  }

  private playCurrentBeat() {
    if (this.currentBeatIndex >= this.beats.length) {
      this.isFinished = true;
      if (this.onBeatChanged) this.onBeatChanged(null);
      if (this.onSceneEnded) this.onSceneEnded();
      return;
    }

    const beat = this.beats[this.currentBeatIndex];
    if (!beat) return;
    if (this.onBeatChanged) this.onBeatChanged(beat);

    if (beat.type === 'speaking' && beat.line) {
      // Speak line via voiceQueue
      voiceQueue.speakCoachLine(beat.id, beat.line, beat.targetPersonId, 'none');
    }
  }

  public getCurrentBeat(): TalkSceneBeat | null {
    if (this.isFinished || this.currentBeatIndex >= this.beats.length) {
      return null;
    }
    return this.beats[this.currentBeatIndex] ?? null;
  }

  /** Skips the current spoken line (`Space` or click) */
  public skipLine() {
    const beat = this.getCurrentBeat();
    if (!beat || beat.type !== 'speaking') return;

    voiceQueue.cancel();
    this.advanceBeat();
  }

  /** Skips straight to next choice beat (`Esc`) */
  public skipToChoice() {
    voiceQueue.cancel();
    let nextChoiceIdx = -1;
    for (let i = this.currentBeatIndex; i < this.beats.length; i++) {
      const b = this.beats[i];
      if (b && b.type === 'choice') {
        nextChoiceIdx = i;
        break;
      }
    }

    if (nextChoiceIdx !== -1) {
      this.currentBeatIndex = nextChoiceIdx;
      this.playCurrentBeat();
    } else {
      // No more choices, finish scene
      this.currentBeatIndex = this.beats.length;
      this.playCurrentBeat();
    }
  }

  public selectChoice(choiceId: string) {
    const beat = this.getCurrentBeat();
    if (!beat || beat.type !== 'choice') return;

    if (beat.onChoiceSelected) {
      beat.onChoiceSelected(choiceId);
    }

    this.advanceBeat();
  }

  private advanceBeat() {
    this.currentBeatIndex++;
    this.playCurrentBeat();
  }

  public isSceneActive(): boolean {
    return !this.isFinished && this.beats.length > 0;
  }
}

/**
 * Calculates real team talk reaction clips and moods from morale change (§14.11.2).
 */
export function calculateTeamTalkReaction(
  playerId: string,
  playerName: string,
  moraleDelta: number,
  isTemperamental = false,
): TeamTalkReaction {
  let clip: TeamTalkReaction['clip'] = 'Listen';
  let mood: FaceMood = 'neutral';

  if (isTemperamental && moraleDelta < 0) {
    clip = 'ArmsFolded';
    mood = 'angry';
  } else if (moraleDelta >= 4) {
    clip = 'FistPump';
    mood = 'happy';
  } else if (moraleDelta >= 1) {
    clip = 'SitNod';
    mood = 'happy';
  } else if (moraleDelta === 0) {
    clip = 'Listen';
    mood = 'neutral';
  } else if (moraleDelta >= -3) {
    clip = 'SitHeadDown';
    mood = 'worried';
  } else {
    // <= -4
    clip = 'ArmsFolded';
    mood = 'angry';
  }

  const delaySec = 0.1 + Math.random() * 0.5;

  return {
    playerId,
    playerName,
    moraleDelta,
    clip,
    mood,
    delaySec,
  };
}
