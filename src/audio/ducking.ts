// Implements SPEC §17.4 Voice Ducking
import { BALANCE } from '@/config/balance';
import { dbToGain } from './synth';

export class DuckingManager {
  private crowdDuckingGain: GainNode;
  private musicDuckingGain: GainNode;
  private activeDucks = 0;
  private restoreTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(crowdDuckingGain: GainNode, musicDuckingGain: GainNode) {
    this.crowdDuckingGain = crowdDuckingGain;
    this.musicDuckingGain = musicDuckingGain;
  }

  /**
   * Ducks the crowd by -6 dB and music by -10 dB per SPEC §17.4
   * @param durationSec Optional duration after which to automatically restore
   */
  public duck(durationSec?: number): void {
    if (this.restoreTimeout) {
      clearTimeout(this.restoreTimeout);
      this.restoreTimeout = null;
    }

    this.activeDucks++;

    const crowdTarget = dbToGain(BALANCE.audio.duckingCrowdDb);
    const musicTarget = dbToGain(BALANCE.audio.duckingMusicDb);

    const ctx = this.crowdDuckingGain.context as AudioContext;
    const now = ctx.currentTime;

    // Smooth fast attack (~80 ms)
    this.crowdDuckingGain.gain.setTargetAtTime(crowdTarget, now, 0.08);
    this.musicDuckingGain.gain.setTargetAtTime(musicTarget, now, 0.08);

    if (durationSec && durationSec > 0) {
      this.restoreTimeout = setTimeout(() => {
        this.unduck();
      }, durationSec * 1000);
    }
  }

  /**
   * Restores crowd and music gains back to unity (0 dB)
   */
  public unduck(): void {
    this.activeDucks = Math.max(0, this.activeDucks - 1);
    if (this.activeDucks > 0) return;

    if (this.restoreTimeout) {
      clearTimeout(this.restoreTimeout);
      this.restoreTimeout = null;
    }

    const ctx = this.crowdDuckingGain.context as AudioContext;
    const now = ctx.currentTime;

    // Smooth release (~150 ms)
    this.crowdDuckingGain.gain.setTargetAtTime(1.0, now, 0.15);
    this.musicDuckingGain.gain.setTargetAtTime(1.0, now, 0.15);
  }

  /**
   * Forces an immediate reset to unity gain
   */
  public reset(): void {
    this.activeDucks = 0;
    if (this.restoreTimeout) {
      clearTimeout(this.restoreTimeout);
      this.restoreTimeout = null;
    }
    const ctx = this.crowdDuckingGain.context as AudioContext;
    const now = ctx.currentTime;
    this.crowdDuckingGain.gain.setValueAtTime(1.0, now);
    this.musicDuckingGain.gain.setValueAtTime(1.0, now);
  }
}
