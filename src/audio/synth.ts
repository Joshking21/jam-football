// Implements SPEC §17 Procedural Synthesizer & Audio Fallback
import { BALANCE } from '@/config/balance';
import { SfxId, CrowdOneShotId } from './types';

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Creates a looping noise buffer (pink or white noise)
 */
export function createNoiseBuffer(ctx: AudioContext, durationSec = 3.0, pink = false): AudioBuffer {
  const sampleRate = ctx.sampleRate || 44100;
  const bufferSize = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(2, bufferSize, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (pink) {
        // Paul Kellet's pink noise algorithm
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      } else {
        data[i] = white * 0.2;
      }
    }
  }

  return buffer;
}

/**
 * Creates a stereo panner node clamped to ±0.6 per SPEC §17.3
 */
export function createClampedPanner(ctx: AudioContext, pan = 0): AudioNode {
  const panMax = BALANCE.audio.panMax;
  const clampedPan = clamp(pan, -panMax, panMax);

  if (typeof ctx.createStereoPanner === 'function') {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(clampedPan, ctx.currentTime);
    return panner;
  }

  // Fallback to simple gain node if StereoPanner is not supported
  const passthrough = ctx.createGain();
  return passthrough;
}

/**
 * Procedural Whistle: short, long, or full-time (x3 pattern)
 */
export function synthWhistle(
  ctx: AudioContext,
  dest: AudioNode,
  type: 'short' | 'long' | 'fulltime',
): void {
  const cfg = BALANCE.audio.synth;
  const now = ctx.currentTime;

  const playBlast = (startTime: number, duration: number) => {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(cfg.whistleFreq1, startTime);
    osc2.frequency.setValueAtTime(cfg.whistleFreq2, startTime);

    // Subtle pitch dip at blast end
    osc1.frequency.linearRampToValueAtTime(cfg.whistleFreq1 * 0.96, startTime + duration);
    osc2.frequency.linearRampToValueAtTime(cfg.whistleFreq2 * 0.96, startTime + duration);

    // Envelope
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(0.4, startTime + 0.02);
    gain.gain.setValueAtTime(0.4, startTime + duration - 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(dest);

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + duration + 0.05);
    osc2.stop(startTime + duration + 0.05);
  };

  if (type === 'short') {
    playBlast(now, cfg.whistleShortDuration);
  } else if (type === 'long') {
    playBlast(now, cfg.whistleLongDuration);
  } else if (type === 'fulltime') {
    // x3 pattern for FT per SPEC §17.3
    playBlast(now, 0.22);
    playBlast(now + 0.32, 0.22);
    playBlast(now + 0.64, 0.7);
  }
}

/**
 * Procedural Ball Kick (pass or shot) with spatial panning
 */
export function synthKick(ctx: AudioContext, dest: AudioNode, isShot = false, pan = 0): void {
  const cfg = BALANCE.audio.synth;
  const now = ctx.currentTime;
  const panner = createClampedPanner(ctx, pan);
  panner.connect(dest);

  const freqStart = isShot ? cfg.kickShotFreqStart : cfg.kickPassFreqStart;
  const freqEnd = isShot ? cfg.kickShotFreqEnd : cfg.kickPassFreqEnd;
  const duration = isShot ? cfg.kickShotDuration : cfg.kickPassDuration;
  const peakGain = isShot ? 0.7 : 0.45;

  // 1. Low body sine sweep
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freqStart, now);
  osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration);

  oscGain.gain.setValueAtTime(0.0001, now);
  oscGain.gain.linearRampToValueAtTime(peakGain, now + 0.005);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(oscGain);
  oscGain.connect(panner);

  osc.start(now);
  osc.stop(now + duration + 0.02);

  // 2. Leather contact click / transient noise
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.04);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(isShot ? 800 : 600, now);
  filter.Q.setValueAtTime(2, now);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(isShot ? 0.35 : 0.2, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(panner);

  noise.start(now);
  noise.stop(now + 0.04);
}

/**
 * Procedural Woodwork / Post Ping
 */
export function synthPost(ctx: AudioContext, dest: AudioNode, pan = 0): void {
  const cfg = BALANCE.audio.synth;
  const now = ctx.currentTime;
  const panner = createClampedPanner(ctx, pan);
  panner.connect(dest);

  const duration = cfg.postDuration;

  // Dual resonant metallic frequencies
  [cfg.postFreq1, cfg.postFreq2].forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(panner);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  });

  // Short impact noise
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.06);
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(2000, now);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.25, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(panner);

  noise.start(now);
  noise.stop(now + 0.06);
}

/**
 * Procedural Net Rustle
 */
export function synthNet(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const duration = BALANCE.audio.synth.netDuration;

  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, duration);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2500, now);
  filter.Q.setValueAtTime(1.5, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  noise.start(now);
  noise.stop(now + duration + 0.02);
}

/**
 * Procedural Header
 */
export function synthHeader(ctx: AudioContext, dest: AudioNode, pan = 0): void {
  const now = ctx.currentTime;
  const duration = BALANCE.audio.synth.headerDuration;
  const panner = createClampedPanner(ctx, pan);
  panner.connect(dest);

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(95, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + duration);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.4, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(panner);

  osc.start(now);
  osc.stop(now + duration + 0.02);
}

/**
 * Procedural Goal Roar (full for home, -8 dB for away per SPEC §17.3)
 */
export function synthGoalRoar(ctx: AudioContext, dest: AudioNode, isHome = true): void {
  const now = ctx.currentTime;
  const duration = BALANCE.audio.synth.roarDuration;
  const mult = isHome ? 1.0 : dbToGain(BALANCE.audio.awayGoalDb);

  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, duration, true);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(350, now);
  filter.frequency.exponentialRampToValueAtTime(1600, now + 0.6);
  filter.frequency.linearRampToValueAtTime(1200, now + 1.8);
  filter.frequency.exponentialRampToValueAtTime(300, now + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.65 * mult, now + 0.35);
  gain.gain.setValueAtTime(0.6 * mult, now + 1.6);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  noise.start(now);
  noise.stop(now + duration + 0.05);
}

/**
 * Procedural Groan (woodwork or missed chance)
 */
export function synthGroan(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const duration = BALANCE.audio.synth.groanDuration;

  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, duration, true);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(700, now);
  filter.frequency.exponentialRampToValueAtTime(220, now + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.45, now + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  noise.start(now);
  noise.stop(now + duration + 0.05);
}

/**
 * Procedural Ooh (keeper save)
 */
export function synthOoh(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const duration = BALANCE.audio.synth.oohDuration;

  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, duration, true);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(500, now);
  filter.frequency.linearRampToValueAtTime(1100, now + 0.3);
  filter.frequency.exponentialRampToValueAtTime(550, now + duration);
  filter.Q.setValueAtTime(2.0, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.4, now + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  noise.start(now);
  noise.stop(now + duration + 0.05);
}

/**
 * Procedural Boo (foul or referee complaint)
 */
export function synthBoo(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const duration = BALANCE.audio.synth.booDuration;

  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, duration, true);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(260, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.35, now + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  noise.start(now);
  noise.stop(now + duration + 0.05);
}

/**
 * Procedural UI sound effects (§17.3, §19.7)
 */
export function synthUiSound(ctx: AudioContext, dest: AudioNode, id: SfxId): void {
  const now = ctx.currentTime;

  switch (id) {
    case 'ui_click': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.02);
      break;
    }
    case 'ui_confirm': {
      // Two-tone rising chime (587Hz -> 880Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880.0, now + 0.06);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.24);
      break;
    }
    case 'ui_error': {
      // Two low buzzer hits (140Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.setValueAtTime(0.0001, now + 0.08);
      gain.gain.setValueAtTime(0.25, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.28);
      break;
    }
    case 'ui_whoosh': {
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(ctx, 0.25);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.exponentialRampToValueAtTime(1800, now + 0.12);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.25);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      noise.start(now);
      noise.stop(now + 0.26);
      break;
    }
    case 'ui_tick': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1600, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.008);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.01);
      break;
    }
    case 'ui_clack': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(350, now + 0.02);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.03);
      break;
    }
    case 'ui_paper': {
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(ctx, 0.18);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      noise.start(now);
      noise.stop(now + 0.2);
      break;
    }
    case 'ui_stamp': {
      // Dull low thud + crisp snap
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    }
    case 'notification': {
      // Ascending major third (C5 to E5)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.32);
      break;
    }
    case 'camera_shutter': {
      // Click-whir
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(ctx, 0.12);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      noise.connect(gain);
      gain.connect(dest);
      noise.start(now);
      noise.stop(now + 0.12);
      break;
    }
    default: {
      // Default subtle click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.02);
      break;
    }
  }
}

/**
 * Procedural Crowd Ambience Loop Generator (§17.3)
 * Continuously generates calm and tense crowd textures through dual filters,
 * smoothly crossfading based on match danger and applying home attack swell (+3 dB).
 */
export class ProceduralCrowdLoop {
  private ctx: AudioContext;
  private dest: AudioNode;
  private noiseSource: AudioBufferSourceNode | null = null;
  private calmFilter: BiquadFilterNode;
  private tenseFilter: BiquadFilterNode;
  private calmGain: GainNode;
  private tenseGain: GainNode;
  private swellGain: GainNode;
  private masterGain: GainNode;
  private isRunning = false;

  constructor(ctx: AudioContext, dest: AudioNode) {
    this.ctx = ctx;
    this.dest = dest;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);

    this.swellGain = ctx.createGain();
    this.swellGain.gain.setValueAtTime(1.0, ctx.currentTime);

    // Calm filter: lowpass around 500 Hz
    this.calmFilter = ctx.createBiquadFilter();
    this.calmFilter.type = 'lowpass';
    this.calmFilter.frequency.setValueAtTime(
      BALANCE.audio.synth.crowdCalmCutoffHz,
      ctx.currentTime,
    );
    this.calmFilter.Q.setValueAtTime(0.7, ctx.currentTime);

    this.calmGain = ctx.createGain();
    this.calmGain.gain.setValueAtTime(0.6, ctx.currentTime);

    // Tense filter: bandpass around 2200 Hz
    this.tenseFilter = ctx.createBiquadFilter();
    this.tenseFilter.type = 'bandpass';
    this.tenseFilter.frequency.setValueAtTime(
      BALANCE.audio.synth.crowdTenseCutoffHz,
      ctx.currentTime,
    );
    this.tenseFilter.Q.setValueAtTime(1.2, ctx.currentTime);

    this.tenseGain = ctx.createGain();
    this.tenseGain.gain.setValueAtTime(0.0001, ctx.currentTime);

    // Routing
    this.calmFilter.connect(this.calmGain);
    this.tenseFilter.connect(this.tenseGain);

    this.calmGain.connect(this.swellGain);
    this.tenseGain.connect(this.swellGain);

    this.swellGain.connect(this.masterGain);
    this.masterGain.connect(this.dest);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const noiseBuffer = createNoiseBuffer(this.ctx, 4.0, true);
    this.noiseSource = this.ctx.createBufferSource();
    this.noiseSource.buffer = noiseBuffer;
    this.noiseSource.loop = true;

    this.noiseSource.connect(this.calmFilter);
    this.noiseSource.connect(this.tenseFilter);

    this.noiseSource.start();

    // Smooth fade in
    this.masterGain.gain.setTargetAtTime(0.4, this.ctx.currentTime, 0.8);
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    // Smooth fade out
    this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4);
    setTimeout(() => {
      try {
        this.noiseSource?.stop();
        this.noiseSource?.disconnect();
        this.noiseSource = null;
      } catch {
        // ignore
      }
    }, 600);
  }

  public setDanger(danger: number, isHomeAttacking = false): void {
    const d = clamp(danger, 0, 1);
    const now = this.ctx.currentTime;
    const tau = BALANCE.audio.dangerSmoothingSec;

    // Calm crossfade: decreases with danger
    const calmTarget = (1.0 - 0.75 * d) * 0.6;
    // Tense crossfade: increases with danger
    const tenseTarget = Math.pow(d, 1.4) * 0.8;

    this.calmGain.gain.setTargetAtTime(calmTarget, now, tau * 0.5);
    this.tenseGain.gain.setTargetAtTime(tenseTarget, now, tau * 0.5);

    // Home side swell: +3 dB (x1.41) per SPEC §17.3
    const swellTarget = isHomeAttacking ? dbToGain(BALANCE.audio.homeAttackSwellDb) : 1.0;
    this.swellGain.gain.setTargetAtTime(swellTarget, now, 0.6);
  }
}

/**
 * Procedural Ambient Music Generator (§17.2)
 * Plays a warm, unobtrusive chord drone/pad when music assets are absent.
 */
export class ProceduralMusicLoop {
  private ctx: AudioContext;
  private dest: AudioNode;
  private gainNode: GainNode;
  private filter: BiquadFilterNode;
  private oscillators: OscillatorNode[] = [];
  private isPlaying = false;

  constructor(ctx: AudioContext, dest: AudioNode) {
    this.ctx = ctx;
    this.dest = dest;

    this.gainNode = ctx.createGain();
    this.gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.setValueAtTime(650, ctx.currentTime);

    this.filter.connect(this.gainNode);
    this.gainNode.connect(this.dest);
  }

  public start(isTitle = false): void {
    if (this.isPlaying) return;
    this.isPlaying = true;

    // Warm chords: C minor / Eb major atmospheric pad frequencies
    const chord = isTitle
      ? [130.81, 164.81, 196.0, 261.63] // C3, E3, G3, C4
      : [110.0, 164.81, 220.0, 277.18]; // A2, E3, A3, C#4

    this.oscillators = chord.map((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      // Slight detune for warmth
      osc.detune.setValueAtTime((idx - 1.5) * 4, this.ctx.currentTime);
      osc.connect(this.filter);
      osc.start();
      return osc;
    });

    const targetGain = isTitle ? 0.35 : 0.35 * dbToGain(BALANCE.audio.menuMusicDb);
    this.gainNode.gain.setTargetAtTime(
      targetGain,
      this.ctx.currentTime,
      BALANCE.audio.crossfadeDurationMusic * 0.4,
    );
  }

  public stop(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    this.gainNode.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4);
    setTimeout(() => {
      this.oscillators.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // ignore
        }
      });
      this.oscillators = [];
    }, 600);
  }
}
