// Implements unit tests for SPEC §17 Audio Subsystem
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BALANCE } from '@/config/balance';
import {
  AudioEngine,
  DuckingManager,
  MatchAudioController,
  VoiceQueue,
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
  createNoiseBuffer,
  dbToGain,
} from '@/audio';
import { MatchEvent } from '@/core/types';

// Mock Web Audio API implementation for Node/Vitest
class MockAudioParam {
  public value: number;
  public targets: Array<{ target: number; time: number; tau?: number }> = [];

  constructor(defaultValue = 1.0) {
    this.value = defaultValue;
  }

  setValueAtTime(v: number) {
    this.value = v;
  }

  setTargetAtTime(target: number, time: number, tau: number) {
    this.value = target;
    this.targets.push({ target, time, tau });
  }

  linearRampToValueAtTime(target: number, time: number) {
    this.value = target;
    this.targets.push({ target, time });
  }

  exponentialRampToValueAtTime(target: number, time: number) {
    this.value = target;
    this.targets.push({ target, time });
  }
}

class MockAudioNode {
  public connections: MockAudioNode[] = [];
  public context: MockAudioContext;

  constructor(ctx: MockAudioContext) {
    this.context = ctx;
  }

  connect(dest: MockAudioNode) {
    this.connections.push(dest);
    return dest;
  }

  disconnect() {
    this.connections = [];
  }
}

class MockGainNode extends MockAudioNode {
  public gain: MockAudioParam;

  constructor(ctx: MockAudioContext) {
    super(ctx);
    this.gain = new MockAudioParam(1.0);
  }
}

class MockOscillatorNode extends MockAudioNode {
  public frequency = new MockAudioParam(440);
  public detune = new MockAudioParam(0);
  public type: OscillatorType = 'sine';
  public started = false;
  public stopped = false;

  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  public frequency = new MockAudioParam(350);
  public Q = new MockAudioParam(1);
  public type: BiquadFilterType = 'lowpass';
}

class MockStereoPannerNode extends MockAudioNode {
  public pan = new MockAudioParam(0);
}

class MockAudioBufferSourceNode extends MockAudioNode {
  public buffer: any = null;
  public loop = false;
  public started = false;
  public stopped = false;

  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}

class MockAudioContext {
  public currentTime = 10.0;
  public sampleRate = 44100;
  public state: AudioContextState = 'running';
  public destination: MockAudioNode;

  constructor() {
    this.destination = new MockAudioNode(this);
  }

  createGain(): MockGainNode {
    return new MockGainNode(this);
  }

  createOscillator(): MockOscillatorNode {
    return new MockOscillatorNode(this);
  }

  createBiquadFilter(): MockBiquadFilterNode {
    return new MockBiquadFilterNode(this);
  }

  createStereoPanner(): MockStereoPannerNode {
    return new MockStereoPannerNode(this);
  }

  createBufferSource(): MockAudioBufferSourceNode {
    return new MockAudioBufferSourceNode(this);
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: () => new Float32Array(length),
    };
  }

  async resume() {
    this.state = 'running';
  }
}

describe('SPEC §17 Audio Subsystem', () => {
  let mockCtx: MockAudioContext;
  let engine: AudioEngine;

  beforeEach(() => {
    mockCtx = new MockAudioContext();
    engine = new AudioEngine();
    engine.setupGraph(mockCtx as unknown as AudioContext);
  });

  describe('Audio Engine & Routing Buses (§17.1)', () => {
    it('constructs master, music, crowd, commentary, and sfx bus hierarchy', () => {
      const master = engine.getBusGain('master') as unknown as MockGainNode;
      const music = engine.getBusGain('music') as unknown as MockGainNode;
      const crowd = engine.getBusGain('crowd') as unknown as MockGainNode;
      const commentary = engine.getBusGain('commentary') as unknown as MockGainNode;
      const sfx = engine.getBusGain('sfx') as unknown as MockGainNode;

      expect(master).toBeDefined();
      expect(music).toBeDefined();
      expect(crowd).toBeDefined();
      expect(commentary).toBeDefined();
      expect(sfx).toBeDefined();

      // Master connects to destination
      expect(master.connections).toContain(mockCtx.destination);
    });

    it('synchronizes bus volumes from game settings', () => {
      engine.updateSettings({
        master: 70,
        music: 40,
        crowd: 85,
        commentary: 60,
        effects: 75,
        voice: true,
        speed: 'Key highlights',
        autoContinue: false,
        confirmInstant: true,
        quality: 'Medium',
        fps: false,
        reduceMotion: false,
        largerText: false,
        colorblind: false,
      });

      const master = engine.getBusGain('master') as unknown as MockGainNode;
      const music = engine.getBusGain('music') as unknown as MockGainNode;
      const crowd = engine.getBusGain('crowd') as unknown as MockGainNode;
      const commentary = engine.getBusGain('commentary') as unknown as MockGainNode;
      const sfx = engine.getBusGain('sfx') as unknown as MockGainNode;

      expect(master.gain.value).toBeCloseTo(0.7, 2);
      expect(music.gain.value).toBeCloseTo(0.4, 2);
      expect(crowd.gain.value).toBeCloseTo(0.85, 2);
      expect(commentary.gain.value).toBeCloseTo(0.6, 2);
      expect(sfx.gain.value).toBeCloseTo(0.75, 2);
    });

    it('mutes commentary bus when voice setting is disabled while preserving volume', () => {
      engine.updateSettings({
        master: 80,
        music: 50,
        crowd: 70,
        commentary: 90,
        effects: 70,
        voice: false, // Voice disabled
        speed: 'Key highlights',
        autoContinue: false,
        confirmInstant: true,
        quality: 'Medium',
        fps: false,
        reduceMotion: false,
        largerText: false,
        colorblind: false,
      });

      const commentary = engine.getBusGain('commentary') as unknown as MockGainNode;
      expect(commentary.gain.value).toBe(0);
    });
  });

  describe('Voice Ducking Manager (§17.4)', () => {
    it('ducks crowd by -6 dB and music by -10 dB and restores to unity', () => {
      const crowdDuck = mockCtx.createGain();
      const musicDuck = mockCtx.createGain();
      const ducking = new DuckingManager(
        crowdDuck as unknown as GainNode,
        musicDuck as unknown as GainNode,
      );

      // Duck
      ducking.duck();
      const expectedCrowd = dbToGain(BALANCE.audio.duckingCrowdDb); // -6 dB ~= 0.501
      const expectedMusic = dbToGain(BALANCE.audio.duckingMusicDb); // -10 dB ~= 0.316

      expect(crowdDuck.gain.value).toBeCloseTo(expectedCrowd, 2);
      expect(musicDuck.gain.value).toBeCloseTo(expectedMusic, 2);

      // Unduck
      ducking.unduck();
      expect(crowdDuck.gain.value).toBeCloseTo(1.0, 2);
      expect(musicDuck.gain.value).toBeCloseTo(1.0, 2);
    });
  });

  describe('Procedural Synthesis & Audio Fallback (§17.1, §17.3)', () => {
    it('creates noise buffers for procedural synthesis', () => {
      const buf = createNoiseBuffer(mockCtx as unknown as AudioContext, 0.5, true);
      expect(buf).toBeDefined();
      expect(buf.numberOfChannels).toBe(2);
    });

    it('clamps spatial panner strictly within ±0.6', () => {
      const p1 = createClampedPanner(
        mockCtx as unknown as AudioContext,
        0.8,
      ) as unknown as MockStereoPannerNode;
      expect(p1.pan.value).toBe(0.6);

      const p2 = createClampedPanner(
        mockCtx as unknown as AudioContext,
        -0.9,
      ) as unknown as MockStereoPannerNode;
      expect(p2.pan.value).toBe(-0.6);

      const p3 = createClampedPanner(
        mockCtx as unknown as AudioContext,
        0.25,
      ) as unknown as MockStereoPannerNode;
      expect(p3.pan.value).toBe(0.25);
    });

    it('synthesizes short, long, and fulltime whistles without throwing', () => {
      const dest = mockCtx.createGain();
      expect(() => {
        synthWhistle(mockCtx as unknown as AudioContext, dest as unknown as AudioNode, 'short');
        synthWhistle(mockCtx as unknown as AudioContext, dest as unknown as AudioNode, 'long');
        synthWhistle(mockCtx as unknown as AudioContext, dest as unknown as AudioNode, 'fulltime');
      }).not.toThrow();
    });

    it('synthesizes ball kicks (pass vs shot) with spatial pan', () => {
      const dest = mockCtx.createGain();
      expect(() => {
        synthKick(mockCtx as unknown as AudioContext, dest as unknown as AudioNode, false, -0.3);
        synthKick(mockCtx as unknown as AudioContext, dest as unknown as AudioNode, true, 0.4);
      }).not.toThrow();
    });

    it('synthesizes woodwork post, net, header, goal roar, groan, ooh, and boo', () => {
      const dest = mockCtx.createGain();
      expect(() => {
        synthPost(mockCtx as unknown as AudioContext, dest as unknown as AudioNode, 0.1);
        synthNet(mockCtx as unknown as AudioContext, dest as unknown as AudioNode);
        synthHeader(mockCtx as unknown as AudioContext, dest as unknown as AudioNode, -0.2);
        synthGoalRoar(mockCtx as unknown as AudioContext, dest as unknown as AudioNode, true);
        synthGoalRoar(mockCtx as unknown as AudioContext, dest as unknown as AudioNode, false);
        synthGroan(mockCtx as unknown as AudioContext, dest as unknown as AudioNode);
        synthOoh(mockCtx as unknown as AudioContext, dest as unknown as AudioNode);
        synthBoo(mockCtx as unknown as AudioContext, dest as unknown as AudioNode);
      }).not.toThrow();
    });

    it('synthesizes all UI motion and feedback sounds', () => {
      const dest = mockCtx.createGain();
      const uis = [
        'ui_click',
        'ui_confirm',
        'ui_error',
        'ui_whoosh',
        'ui_tick',
        'ui_clack',
        'ui_paper',
        'ui_stamp',
        'notification',
        'camera_shutter',
      ] as const;

      uis.forEach((id) => {
        expect(() => {
          synthUiSound(mockCtx as unknown as AudioContext, dest as unknown as AudioNode, id);
        }).not.toThrow();
      });
    });
  });

  describe('Crowd Danger Mix & Spatial Panning (§17.3)', () => {
    const controller = new MatchAudioController();

    it('computes spatial pan relative to camera center clamped at ±0.6', () => {
      // Camera at center 52.5
      expect(controller.computeSpatialPan(52.5, 52.5)).toBe(0);
      expect(controller.computeSpatialPan(105.0, 52.5)).toBe(0.6);
      expect(controller.computeSpatialPan(0.0, 52.5)).toBe(-0.6);
      // Beyond pitch clamps strictly at ±0.6
      expect(controller.computeSpatialPan(150.0, 52.5)).toBe(0.6);
      expect(controller.computeSpatialPan(-30.0, 52.5)).toBe(-0.6);
    });

    it('computes crowd danger progression from own defensive third to opponent box', () => {
      // 1. Own defensive third (x in [0, 35])
      const def = controller.computeDanger(20.0, 34.0, 'home');
      expect(def.danger).toBeGreaterThanOrEqual(0.0);
      expect(def.danger).toBeLessThanOrEqual(0.15);
      expect(def.isHomeAttacking).toBe(true);

      // 2. Middle third (x in [35, 70])
      const mid = controller.computeDanger(52.5, 34.0, 'home');
      expect(mid.danger).toBeGreaterThanOrEqual(0.15);
      expect(mid.danger).toBeLessThanOrEqual(0.45);

      // 3. Attacking third (x in [70, 88.5])
      const att = controller.computeDanger(80.0, 34.0, 'home');
      expect(att.danger).toBeGreaterThanOrEqual(0.45);
      expect(att.danger).toBeLessThanOrEqual(0.75);

      // 4. Opponent box (x in [88.5, 105] and y in [13.84, 54.16])
      const box = controller.computeDanger(95.0, 34.0, 'home');
      expect(box.danger).toBeGreaterThanOrEqual(0.85);
      expect(box.danger).toBeLessThanOrEqual(1.0);

      // 5. Away team attacking in reverse direction
      const awayInBox = controller.computeDanger(8.0, 34.0, 'away');
      expect(awayInBox.danger).toBeGreaterThanOrEqual(0.85);
      expect(awayInBox.isHomeAttacking).toBe(false);
    });

    it('dispatches match simulation events to corresponding audio cues', () => {
      const matchCtrl = new MatchAudioController(engine);
      const playSfxSpy = vi.spyOn(engine, 'playSfx');
      const playCrowdSpy = vi.spyOn(engine, 'playCrowd');

      const passEv: MatchEvent = {
        type: 'PASS',
        seq: 1,
        t: 10,
        minuteLabel: '10',
        half: 1,
        scoreAfter: { home: 0, away: 0 },
        side: 'home',
        from: { x: 45, y: 30 },
        to: { x: 55, y: 32 },
        duration: 1.0,
        importance: 1,
      };
      matchCtrl.onEvent(passEv, 'home');
      expect(playSfxSpy).toHaveBeenCalledWith('kick_pass', expect.any(Object));

      const shotEv: MatchEvent = {
        type: 'SHOT',
        seq: 2,
        t: 25,
        minuteLabel: '25',
        half: 1,
        scoreAfter: { home: 0, away: 0 },
        side: 'home',
        from: { x: 92, y: 34 },
        duration: 0.8,
        importance: 3,
      };
      matchCtrl.onEvent(shotEv, 'home');
      expect(playSfxSpy).toHaveBeenCalledWith('kick_shot', expect.any(Object));

      const goalEv: MatchEvent = {
        type: 'GOAL',
        seq: 3,
        t: 30,
        minuteLabel: '30',
        half: 1,
        scoreAfter: { home: 1, away: 0 },
        side: 'home',
        from: { x: 96, y: 34 },
        duration: 2.0,
        importance: 3,
      };
      matchCtrl.onEvent(goalEv, 'home');
      expect(playSfxSpy).toHaveBeenCalledWith('net');
      expect(playSfxSpy).toHaveBeenCalledWith('whistle_long');
      expect(playCrowdSpy).toHaveBeenCalledWith('goal_roar', { isHome: true });

      const woodworkEv: MatchEvent = {
        type: 'POST',
        seq: 4,
        t: 40,
        minuteLabel: '40',
        half: 1,
        scoreAfter: { home: 1, away: 0 },
        side: 'home',
        from: { x: 95, y: 33 },
        duration: 1.0,
        importance: 2,
      };
      matchCtrl.onEvent(woodworkEv, 'home');
      expect(playSfxSpy).toHaveBeenCalledWith('post', expect.any(Object));
      expect(playCrowdSpy).toHaveBeenCalledWith('groan_miss');

      const fullTimeEv: MatchEvent = {
        type: 'FULL_TIME',
        seq: 5,
        t: 5400,
        minuteLabel: '90',
        half: 2,
        scoreAfter: { home: 1, away: 0 },
        side: 'home',
        duration: 1.5,
        importance: 3,
      };
      matchCtrl.onEvent(fullTimeEv, 'home');
      expect(playSfxSpy).toHaveBeenCalledWith('whistle_fulltime');
    });
  });

  describe('Offline & Asset Fallback (§17.1)', () => {
    it('plays sound effects and crowd one-shots seamlessly without assets', async () => {
      await expect(engine.playSfx('whistle_short')).resolves.not.toThrow();
      await expect(engine.playSfx('kick_pass')).resolves.not.toThrow();
      await expect(engine.playSfx('ui_click')).resolves.not.toThrow();
      await expect(engine.playCrowd('goal_roar')).resolves.not.toThrow();
      await expect(engine.playCrowd('groan_miss')).resolves.not.toThrow();
    });

    it('starts and stops match audio without throwing when asset files are absent', async () => {
      await expect(engine.startMatchAudio()).resolves.not.toThrow();
      expect(() => engine.setMatchDanger(0.85, true)).not.toThrow();
      expect(() => engine.stopMatchAudio()).not.toThrow();
    });

    it('plays and stops music loop with crossfade without throwing', async () => {
      await expect(engine.playMusic('title_theme')).resolves.not.toThrow();
      expect(() => engine.stopMusic()).not.toThrow();
    });
  });

  describe('VoiceQueue, Chaining & Ducking (§17.4)', () => {
    let vq: VoiceQueue;

    beforeEach(() => {
      vq = new VoiceQueue(engine);
    });

    it('enqueues commentary and updates active caption for listeners', () => {
      let latestCaption: any = null;
      const unsubscribe = vq.subscribe((cap) => {
        latestCaption = cap;
      });

      vq.enqueue({
        id: 'c1',
        text: 'And we are underway!',
        importance: 1,
        simTime: 10,
      });

      expect(latestCaption).toBeDefined();
      expect(latestCaption?.text).toBe('And we are underway!');
      expect(latestCaption?.importance).toBe(1);

      unsubscribe();
    });

    it('preempts lower-importance line with 150ms fade when higher importance event arrives', () => {
      const duckSpy = vi.spyOn(engine, 'duck');

      vq.enqueue({
        id: 'routine_pass',
        text: 'Passed across the backline.',
        importance: 0,
        simTime: 15,
      });

      expect(vq.getActiveCaption()?.id).toBe('routine_pass');

      // Higher-importance goal arrives immediately
      vq.enqueue({
        id: 'spectacular_goal',
        text: 'What an absolute screamer into the top corner!',
        importance: 3,
        simTime: 16,
      });

      // Triggers ducking
      expect(duckSpy).toHaveBeenCalled();
    });

    it('drops stale lines older than 3 sim seconds (§17.4)', () => {
      vq.updateSimTime(100);

      // Task with simTime = 90 (10 seconds old, > 3.0s threshold)
      vq.enqueue({
        id: 'stale_event',
        text: 'Ancient history.',
        importance: 1,
        simTime: 90,
      });

      expect(vq.getActiveCaption()).toBeNull();
    });

    it('supports assistant stingers, press questions, and coach voice lines', () => {
      expect(() => vq.speakAssistantStinger(2)).not.toThrow();
      expect(vq.getActiveCaption()?.text).toBe('Boss, a word.');

      vq.cancel();

      expect(() =>
        vq.speakPressQuestion('q1', 'Will you start him?', 'Will you start him?'),
      ).not.toThrow();
      expect(vq.getActiveCaption()?.text).toBe('Will you start him?');

      vq.cancel();

      expect(() =>
        vq.speakCoachLine('talk_win', 'Good shift today.', 'p01', 'start'),
      ).not.toThrow();
      expect(vq.getActiveCaption()?.text).toBe('Good shift today.');

      vq.cancel();
    });

    it('unducks crowd and music when cancelled', () => {
      const unduckSpy = vi.spyOn(engine, 'unduck');

      vq.enqueue({
        id: 'c2',
        text: 'A dangerous attack building.',
        importance: 2,
        simTime: 50,
      });

      vq.cancel();
      expect(unduckSpy).toHaveBeenCalled();
      expect(vq.getActiveCaption()).toBeNull();
    });
  });
});
