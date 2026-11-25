// Implements SPEC §17 Audio Engine, Buses, Routing & Manifest caching
import { BALANCE } from '@/config/balance';
import { GameSettings } from '@/state/settings';
import { assetUrl } from '@/assets/registry';
import {
  AudioBusName,
  SfxId,
  CrowdOneShotId,
  MusicTrackId,
  RoomId,
  PlaySfxOptions,
  PlayCrowdOptions,
} from './types';
import {
  synthWhistle,
  synthKick,
  synthPost,
  synthNet,
  synthHeader,
  synthGoalRoar,
  synthGroan,
  synthOoh,
  synthBoo,
  synthUiSound,
  createClampedPanner,
  ProceduralCrowdLoop,
  ProceduralMusicLoop,
  dbToGain,
} from './synth';
import { DuckingManager } from './ducking';
import { RoomAmbienceManager } from './ambience';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private isUnlocked = false;

  // Master & Bus Gain Nodes
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private crowdGain: GainNode | null = null;
  private commentaryGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  // Ducking intermediate gains
  private musicDuckGain: GainNode | null = null;
  private crowdDuckGain: GainNode | null = null;

  // Subsystem managers
  private duckingManager: DuckingManager | null = null;
  private roomAmbience: RoomAmbienceManager | null = null;
  private proceduralCrowd: ProceduralCrowdLoop | null = null;
  private proceduralMusic: ProceduralMusicLoop | null = null;

  // Audio buffer cache
  private bufferCache: Map<string, AudioBuffer> = new Map();

  // Active music tracking
  private currentMusicSource: AudioBufferSourceNode | null = null;
  private currentMusicGain: GainNode | null = null;
  private currentMusicTrack: MusicTrackId | null = null;

  // Active crowd loop tracking
  private crowdSourceCalm: AudioBufferSourceNode | null = null;
  private crowdSourceTense: AudioBufferSourceNode | null = null;
  private crowdCalmGain: GainNode | null = null;
  private crowdTenseGain: GainNode | null = null;
  private crowdSwellGain: GainNode | null = null;
  private isMatchAudioRunning = false;

  // Chant interval timer
  private chantTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Lazy unlock attached on browser window if available
    this.attachUnlockListeners();
  }

  /**
   * Attaches gesture listeners to unlock AudioContext on first user interaction
   */
  private attachUnlockListeners(): void {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      this.ensureContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          this.isUnlocked = true;
        });
      } else {
        this.isUnlocked = true;
      }

      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('click', unlock);
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('click', unlock, { passive: true });
  }

  /**
   * Ensures AudioContext and graph are initialized
   */
  public ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return null;

    try {
      this.ctx = new AudioContextClass();
      this.setupGraph(this.ctx);
    } catch (err) {
      console.warn('Failed to initialize AudioContext:', err);
      return null;
    }

    return this.ctx;
  }

  /**
   * Constructs the bus routing graph:
   * destination <- masterGain
   *   <- musicDuckGain <- musicGain
   *   <- crowdDuckGain <- crowdGain
   *   <- commentaryGain
   *   <- sfxGain
   */
  public setupGraph(ctx: AudioContext): void {
    this.ctx = ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.8, ctx.currentTime);
    this.masterGain.connect(ctx.destination);

    // Music routing with ducking
    this.musicDuckGain = ctx.createGain();
    this.musicDuckGain.gain.setValueAtTime(1.0, ctx.currentTime);
    this.musicDuckGain.connect(this.masterGain);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.setValueAtTime(0.5, ctx.currentTime);
    this.musicGain.connect(this.musicDuckGain);

    // Crowd routing with ducking
    this.crowdDuckGain = ctx.createGain();
    this.crowdDuckGain.gain.setValueAtTime(1.0, ctx.currentTime);
    this.crowdDuckGain.connect(this.masterGain);

    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.setValueAtTime(0.7, ctx.currentTime);
    this.crowdGain.connect(this.crowdDuckGain);

    // Commentary & Voice routing
    this.commentaryGain = ctx.createGain();
    this.commentaryGain.gain.setValueAtTime(0.85, ctx.currentTime);
    this.commentaryGain.connect(this.masterGain);

    // SFX routing
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.setValueAtTime(0.7, ctx.currentTime);
    this.sfxGain.connect(this.masterGain);

    // Subsystems
    this.duckingManager = new DuckingManager(this.crowdDuckGain, this.musicDuckGain);
    this.roomAmbience = new RoomAmbienceManager(ctx, this.sfxGain);
    this.proceduralCrowd = new ProceduralCrowdLoop(ctx, this.crowdGain);
    this.proceduralMusic = new ProceduralMusicLoop(ctx, this.musicGain);
  }

  /**
   * Synchronize bus volumes from game settings
   */
  public updateSettings(settings: GameSettings): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const setGain = (node: GainNode | null, vol: number) => {
      if (!node) return;
      const target = Math.max(0, Math.min(1, vol / 100));
      node.gain.setTargetAtTime(target, now, 0.05);
    };

    setGain(this.masterGain, settings.master);
    setGain(this.musicGain, settings.music);
    setGain(this.crowdGain, settings.crowd);
    setGain(this.commentaryGain, settings.voice ? settings.commentary : 0);
    setGain(this.sfxGain, settings.effects);
  }

  /**
   * Retrieves or decodes an audio buffer from an asset path
   */
  private async loadBuffer(path: string): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    if (this.bufferCache.has(path)) {
      return this.bufferCache.get(path)!;
    }

    const url = assetUrl(path);
    if (!url) return null;

    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
      this.bufferCache.set(path, audioBuf);
      return audioBuf;
    } catch {
      return null;
    }
  }

  /**
   * Plays a sound effect with spatial panning and volume scaling
   */
  public async playSfx(id: SfxId, options: PlaySfxOptions = {}): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    // Check if asset is available in manifest
    const assetPath = this.resolveSfxAssetPath(id);
    if (assetPath) {
      const buffer = await this.loadBuffer(assetPath);
      if (buffer) {
        this.playBuffer(buffer, this.sfxGain, options.pan ?? 0, options.volume ?? 1.0);
        return;
      }
    }

    // Procedural fallback
    this.playProceduralSfx(id, options);
  }

  /**
   * Plays a crowd one-shot (goal roar, cheer, groan, save ooh, boo)
   */
  public async playCrowd(id: CrowdOneShotId, options: PlayCrowdOptions = {}): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx || !this.crowdGain) return;

    const assetPath = this.resolveCrowdAssetPath(id);
    if (assetPath) {
      const buffer = await this.loadBuffer(assetPath);
      if (buffer) {
        const mult = options.isHome === false ? dbToGain(BALANCE.audio.awayGoalDb) : 1.0;
        this.playBuffer(buffer, this.crowdGain, 0, (options.volume ?? 1.0) * mult);
        return;
      }
    }

    // Procedural fallback
    switch (id) {
      case 'goal_roar':
        synthGoalRoar(ctx, this.crowdGain, options.isHome ?? true);
        break;
      case 'away_cheer':
        synthGoalRoar(ctx, this.crowdGain, false);
        break;
      case 'groan_miss':
        synthGroan(ctx, this.crowdGain);
        break;
      case 'ooh_save':
        synthOoh(ctx, this.crowdGain);
        break;
      case 'boo_foul':
        synthBoo(ctx, this.crowdGain);
        break;
      case 'chant':
        synthOoh(ctx, this.crowdGain);
        break;
    }
  }

  /**
   * Plays a decoded AudioBuffer through a destination node with optional panning
   */
  private playBuffer(buffer: AudioBuffer, dest: AudioNode, pan = 0, volume = 1.0): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(volume, now);

    const panner = createClampedPanner(this.ctx, pan);

    source.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(dest);

    source.start(now);
  }

  /**
   * Dispatches procedural synthesis for sound effects
   */
  private playProceduralSfx(id: SfxId, options: PlaySfxOptions = {}): void {
    if (!this.ctx || !this.sfxGain) return;

    switch (id) {
      case 'whistle_short':
        synthWhistle(this.ctx, this.sfxGain, 'short');
        break;
      case 'whistle_long':
        synthWhistle(this.ctx, this.sfxGain, 'long');
        break;
      case 'whistle_fulltime':
        synthWhistle(this.ctx, this.sfxGain, 'fulltime');
        break;
      case 'kick_pass':
        synthKick(this.ctx, this.sfxGain, false, options.pan ?? 0);
        break;
      case 'kick_shot':
        synthKick(this.ctx, this.sfxGain, true, options.pan ?? 0);
        break;
      case 'header':
        synthHeader(this.ctx, this.sfxGain, options.pan ?? 0);
        break;
      case 'post':
        synthPost(this.ctx, this.sfxGain, options.pan ?? 0);
        break;
      case 'net':
        synthNet(this.ctx, this.sfxGain);
        break;
      default:
        synthUiSound(this.ctx, this.sfxGain, id);
        break;
    }
  }

  /**
   * Maps SFX ID to candidate asset path
   */
  private resolveSfxAssetPath(id: SfxId): string | null {
    switch (id) {
      case 'whistle_short':
        return 'sfx/whistle_short.mp3';
      case 'whistle_long':
      case 'whistle_fulltime':
        return 'sfx/whistle_long.mp3';
      case 'kick_pass':
        return 'sfx/kick_1.mp3';
      case 'kick_shot':
        return 'sfx/kick_2.mp3';
      case 'post':
        return 'sfx/post.mp3';
      case 'net':
        return 'sfx/net.mp3';
      case 'header':
        return 'sfx/header.mp3';
      case 'ui_click':
        return 'sfx/ui_click.mp3';
      case 'ui_confirm':
        return 'sfx/ui_confirm.mp3';
      case 'ui_error':
        return 'sfx/ui_error.mp3';
      case 'notification':
        return 'sfx/notification.mp3';
      case 'camera_shutter':
        return 'sfx/camera_shutter.mp3';
      case 'ui_whoosh':
        return 'sfx/ui_whoosh.mp3';
      case 'ui_cut':
        return 'sfx/ui_cut.mp3';
      case 'ui_tick':
        return 'sfx/ui_tick.mp3';
      case 'ui_clack':
        return 'sfx/ui_clack.mp3';
      case 'ui_paper':
        return 'sfx/ui_paper.mp3';
      case 'ui_stamp':
        return 'sfx/ui_stamp.mp3';
      default:
        return null;
    }
  }

  /**
   * Maps Crowd ID to candidate asset path
   */
  private resolveCrowdAssetPath(id: CrowdOneShotId): string | null {
    switch (id) {
      case 'goal_roar':
        return 'crowd/goal_roar.mp3';
      case 'away_cheer':
        return 'crowd/away_cheer.mp3';
      case 'groan_miss':
        return 'crowd/groan_miss.mp3';
      case 'ooh_save':
        return 'crowd/ooh_save.mp3';
      case 'boo_foul':
        return 'crowd/boo_foul.mp3';
      case 'chant':
        return 'crowd/chant_1.mp3';
      default:
        return null;
    }
  }

  /**
   * Plays music track with 1.5s crossfade per SPEC §17.2
   */
  public async playMusic(track: MusicTrackId): Promise<void> {
    if (this.currentMusicTrack === track) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.musicGain) return;

    this.currentMusicTrack = track;
    const fadeDuration = BALANCE.audio.crossfadeDurationMusic; // 1.5 s

    // Stop current music with fade
    if (this.currentMusicGain) {
      this.currentMusicGain.gain.setTargetAtTime(0.0001, ctx.currentTime, fadeDuration * 0.4);
      const oldSource = this.currentMusicSource;
      setTimeout(
        () => {
          try {
            oldSource?.stop();
            oldSource?.disconnect();
          } catch {
            // ignore
          }
        },
        fadeDuration * 1000 + 100,
      );
    }
    this.proceduralMusic?.stop();

    // Check asset
    const assetPath = `music/${track}.mp3`;
    const buffer = await this.loadBuffer(assetPath);

    if (buffer) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const trackGain = ctx.createGain();
      trackGain.gain.setValueAtTime(0.0001, ctx.currentTime);

      const targetVol = track === 'menu_loop' ? dbToGain(BALANCE.audio.menuMusicDb) : 1.0;
      trackGain.gain.setTargetAtTime(targetVol, ctx.currentTime, fadeDuration * 0.4);

      source.connect(trackGain);
      trackGain.connect(this.musicGain);
      source.start();

      this.currentMusicSource = source;
      this.currentMusicGain = trackGain;
    } else {
      // Procedural music pad fallback
      this.proceduralMusic?.start(track === 'title_theme');
    }
  }

  /**
   * Stops music track with 1.5s fade out
   */
  public stopMusic(): void {
    if (!this.ctx) return;
    const fadeDuration = BALANCE.audio.crossfadeDurationMusic;

    if (this.currentMusicGain) {
      this.currentMusicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, fadeDuration * 0.4);
      const oldSource = this.currentMusicSource;
      setTimeout(
        () => {
          try {
            oldSource?.stop();
            oldSource?.disconnect();
          } catch {
            // ignore
          }
        },
        fadeDuration * 1000 + 100,
      );
      this.currentMusicSource = null;
      this.currentMusicGain = null;
    }

    this.proceduralMusic?.stop();
    this.currentMusicTrack = null;
  }

  /**
   * Starts match audio (crowd ambience loops) and stops music (§17.2, §17.3)
   */
  public async startMatchAudio(): Promise<void> {
    this.stopMusic();
    if (this.isMatchAudioRunning) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.crowdGain) return;

    this.isMatchAudioRunning = true;

    // Check calm and tense crowd loops
    const calmBuf = await this.loadBuffer('crowd/ambience_calm.mp3');
    const tenseBuf = await this.loadBuffer('crowd/ambience_tense.mp3');

    if (calmBuf && tenseBuf) {
      this.crowdSourceCalm = ctx.createBufferSource();
      this.crowdSourceCalm.buffer = calmBuf;
      this.crowdSourceCalm.loop = true;

      this.crowdSourceTense = ctx.createBufferSource();
      this.crowdSourceTense.buffer = tenseBuf;
      this.crowdSourceTense.loop = true;

      this.crowdCalmGain = ctx.createGain();
      this.crowdTenseGain = ctx.createGain();
      this.crowdSwellGain = ctx.createGain();

      this.crowdCalmGain.gain.setValueAtTime(0.7, ctx.currentTime);
      this.crowdTenseGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      this.crowdSwellGain.gain.setValueAtTime(1.0, ctx.currentTime);

      this.crowdSourceCalm.connect(this.crowdCalmGain);
      this.crowdSourceTense.connect(this.crowdTenseGain);

      this.crowdCalmGain.connect(this.crowdSwellGain);
      this.crowdTenseGain.connect(this.crowdSwellGain);
      this.crowdSwellGain.connect(this.crowdGain);

      this.crowdSourceCalm.start();
      this.crowdSourceTense.start();
    } else {
      // Procedural crowd fallback
      this.proceduralCrowd?.start();
    }

    this.scheduleNextChant();
  }

  /**
   * Stops match audio
   */
  public stopMatchAudio(): void {
    if (!this.isMatchAudioRunning) return;
    this.isMatchAudioRunning = false;

    if (this.chantTimer) {
      clearTimeout(this.chantTimer);
      this.chantTimer = null;
    }

    if (this.crowdCalmGain && this.crowdTenseGain && this.ctx) {
      this.crowdCalmGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4);
      this.crowdTenseGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4);

      const srcCalm = this.crowdSourceCalm;
      const srcTense = this.crowdSourceTense;

      setTimeout(() => {
        try {
          srcCalm?.stop();
          srcTense?.stop();
          srcCalm?.disconnect();
          srcTense?.disconnect();
        } catch {
          // ignore
        }
      }, 500);

      this.crowdSourceCalm = null;
      this.crowdSourceTense = null;
    }

    this.proceduralCrowd?.stop();
  }

  /**
   * Updates crowd danger mix (crossfades calm/tense and applies +3 dB home swell)
   */
  public setMatchDanger(danger: number, isHomeAttacking = false): void {
    if (!this.isMatchAudioRunning) return;

    if (this.crowdCalmGain && this.crowdTenseGain && this.crowdSwellGain && this.ctx) {
      const now = this.ctx.currentTime;
      const tau = BALANCE.audio.dangerSmoothingSec * 0.5;
      const d = Math.max(0, Math.min(1, danger));

      const calmVol = (1.0 - 0.7 * d) * 0.7;
      const tenseVol = Math.pow(d, 1.3) * 0.85;

      this.crowdCalmGain.gain.setTargetAtTime(calmVol, now, tau);
      this.crowdTenseGain.gain.setTargetAtTime(tenseVol, now, tau);

      const swell = isHomeAttacking ? dbToGain(BALANCE.audio.homeAttackSwellDb) : 1.0;
      this.crowdSwellGain.gain.setTargetAtTime(swell, now, 0.4);
    } else {
      this.proceduralCrowd?.setDanger(danger, isHomeAttacking);
    }
  }

  /**
   * Schedules periodic random chants every 60–120s per SPEC §17.3
   */
  private scheduleNextChant(): void {
    if (!this.isMatchAudioRunning) return;
    const minSec = BALANCE.audio.chantIntervalMinSec;
    const maxSec = BALANCE.audio.chantIntervalMaxSec;
    const delayMs = (minSec + Math.random() * (maxSec - minSec)) * 1000;

    this.chantTimer = setTimeout(() => {
      if (this.isMatchAudioRunning) {
        this.playCrowd('chant');
        this.scheduleNextChant();
      }
    }, delayMs);
  }

  /**
   * Voice ducking: crowd -6 dB, music -10 dB
   */
  public duck(durationSec?: number): void {
    this.duckingManager?.duck(durationSec);
  }

  public unduck(): void {
    this.duckingManager?.unduck();
  }

  /**
   * Room ambience (§17.5)
   */
  public setRoom(room: RoomId, isRaining = false): void {
    this.roomAmbience?.setRoom(room, isRaining);
  }

  public stopRoomAmbience(): void {
    this.roomAmbience?.stop();
  }

  // Test inspection getters
  public getContext(): AudioContext | null {
    return this.ctx;
  }

  public getBusGain(bus: AudioBusName): GainNode | null {
    switch (bus) {
      case 'master':
        return this.masterGain;
      case 'music':
        return this.musicGain;
      case 'crowd':
        return this.crowdGain;
      case 'commentary':
        return this.commentaryGain;
      case 'sfx':
        return this.sfxGain;
    }
  }
}

// Global audio engine singleton
export const audioEngine = new AudioEngine();
