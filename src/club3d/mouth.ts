// SPEC §14.11.7 The mouth (audio-driven & caption-rhythm mouth animation)
import type { MouthShape } from './types';
import { FACES_CONFIG } from '../config/balance';

export class MouthAnimator {
  private currentShape: MouthShape = 'closed';
  private holdTimerMs = 0;
  private captionSyllableTimer = 0;
  private captionIsOpen = false;

  /**
   * Evaluates mouth shape given an AnalyserNode (Web Audio API)
   * with hysteresis thresholds and a 70ms minimum hold time.
   */
  public updateFromAudio(analyser: AnalyserNode | null, dt: number): MouthShape {
    this.holdTimerMs += dt * 1000;

    if (!analyser) {
      return this.currentShape;
    }

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);

    // Calculate RMS loudness
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const normalized = (data[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / data.length);

    const th = FACES_CONFIG.audioThresholds;
    const h = FACES_CONFIG.hysteresis;

    let targetShape: MouthShape = 'closed';

    if (this.currentShape === 'closed') {
      if (rms > th.wide + h) targetShape = 'wide';
      else if (rms > th.open + h) targetShape = 'open';
      else if (rms > th.small + h) targetShape = 'small';
      else targetShape = 'closed';
    } else if (this.currentShape === 'small') {
      if (rms > th.wide + h) targetShape = 'wide';
      else if (rms > th.open + h) targetShape = 'open';
      else if (rms < th.small - h) targetShape = 'closed';
      else targetShape = 'small';
    } else if (this.currentShape === 'open') {
      if (rms > th.wide + h) targetShape = 'wide';
      else if (rms < th.open - h && rms > th.small) targetShape = 'small';
      else if (rms < th.small - h) targetShape = 'closed';
      else targetShape = 'open';
    } else {
      // wide
      if (rms < th.wide - h && rms > th.open) targetShape = 'open';
      else if (rms < th.open - h) targetShape = 'small';
      else targetShape = 'wide';
    }

    // Apply minimum hold time of 70ms to prevent flickering
    if (targetShape !== this.currentShape) {
      if (this.holdTimerMs >= FACES_CONFIG.minHoldMs) {
        this.currentShape = targetShape;
        this.holdTimerMs = 0;
      }
    }

    return this.currentShape;
  }

  /**
   * Procedural caption-rhythm speech fallback (~5 syllables/s, pauses at commas & periods)
   */
  public updateFromCaption(text: string | null, charIndex: number, dt: number): MouthShape {
    if (!text || text.length === 0 || charIndex >= text.length) {
      this.currentShape = 'closed';
      return 'closed';
    }

    const currentChar = text[charIndex] || '';

    // Pauses at punctuation
    if (currentChar === ',' || currentChar === ';') {
      this.currentShape = 'closed';
      return 'closed';
    }
    if (currentChar === '.' || currentChar === '!' || currentChar === '?') {
      this.currentShape = 'closed';
      return 'closed';
    }

    this.captionSyllableTimer += dt;
    const syllablePeriod = 1 / FACES_CONFIG.captionSyllablesPerSec;

    if (this.captionSyllableTimer >= syllablePeriod) {
      this.captionSyllableTimer = 0;
      this.captionIsOpen = !this.captionIsOpen;
    }

    this.currentShape = this.captionIsOpen ? 'open' : 'small';
    return this.currentShape;
  }

  public getShape(): MouthShape {
    return this.currentShape;
  }

  public reset() {
    this.currentShape = 'closed';
    this.holdTimerMs = 0;
    this.captionSyllableTimer = 0;
    this.captionIsOpen = false;
  }
}
