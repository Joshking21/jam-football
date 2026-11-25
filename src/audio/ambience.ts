// Implements SPEC §17.5 Room Ambience
import { BALANCE } from '@/config/balance';
import { RoomId } from './types';
import { dbToGain, createNoiseBuffer } from './synth';
import { assetUrl } from '@/assets/registry';

export class RoomAmbienceManager {
  private ctx: AudioContext;
  private dest: AudioNode;
  private currentRoom: RoomId | null = null;
  private isRaining = false;

  private gainNodeA: GainNode;
  private gainNodeB: GainNode;
  private activeGainSlot: 'A' | 'B' = 'A';

  private sourceA: AudioBufferSourceNode | null = null;
  private sourceB: AudioBufferSourceNode | null = null;

  constructor(ctx: AudioContext, dest: AudioNode) {
    this.ctx = ctx;
    this.dest = dest;

    this.gainNodeA = ctx.createGain();
    this.gainNodeB = ctx.createGain();

    this.gainNodeA.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.gainNodeB.gain.setValueAtTime(0.0001, ctx.currentTime);

    this.gainNodeA.connect(this.dest);
    this.gainNodeB.connect(this.dest);
  }

  public setRoom(room: RoomId, isRaining = false): void {
    if (this.currentRoom === room && this.isRaining === isRaining) return;
    this.currentRoom = room;
    this.isRaining = isRaining;

    const targetGain = dbToGain(BALANCE.audio.roomAmbienceDb); // -18 dB per §17.5
    const now = this.ctx.currentTime;
    const fadeDuration = BALANCE.audio.crossfadeDurationRoom; // 0.6 s per §17.5

    const nextSlot = this.activeGainSlot === 'A' ? 'B' : 'A';
    const activeGain = this.activeGainSlot === 'A' ? this.gainNodeA : this.gainNodeB;
    const nextGain = nextSlot === 'A' ? this.gainNodeA : this.gainNodeB;

    // Crossfade: fade out active, fade in next
    activeGain.gain.setTargetAtTime(0.0001, now, fadeDuration * 0.4);
    nextGain.gain.setTargetAtTime(targetGain, now, fadeDuration * 0.4);

    // Stop old source after fade
    const oldSource = this.activeGainSlot === 'A' ? this.sourceA : this.sourceB;
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

    // Create new source
    const path =
      room === 'office' && isRaining ? 'ambience/office_rain.mp3' : `ambience/${room}.mp3`;

    const url = assetUrl(path);

    if (url) {
      fetch(url)
        .then((res) => res.arrayBuffer())
        .then((buf) => this.ctx.decodeAudioData(buf))
        .then((decoded) => {
          const src = this.ctx.createBufferSource();
          src.buffer = decoded;
          src.loop = true;
          src.connect(nextGain);
          src.start();
          if (nextSlot === 'A') this.sourceA = src;
          else this.sourceB = src;
        })
        .catch(() => {
          this.createProceduralRoomTone(nextGain, room, nextSlot);
        });
    } else {
      this.createProceduralRoomTone(nextGain, room, nextSlot);
    }

    this.activeGainSlot = nextSlot;
  }

  private createProceduralRoomTone(gainNode: GainNode, room: RoomId, slot: 'A' | 'B'): void {
    // Subtle low-level filtered room tone for offline / no-asset play
    const noise = this.ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(this.ctx, 4.0, true);
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(room === 'exterior' ? 400 : 250, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(gainNode);
    noise.start();

    if (slot === 'A') this.sourceA = noise;
    else this.sourceB = noise;
  }

  public stop(): void {
    const now = this.ctx.currentTime;
    this.gainNodeA.gain.setTargetAtTime(0.0001, now, 0.3);
    this.gainNodeB.gain.setTargetAtTime(0.0001, now, 0.3);
    this.currentRoom = null;

    setTimeout(() => {
      try {
        this.sourceA?.stop();
        this.sourceB?.stop();
        this.sourceA?.disconnect();
        this.sourceB?.disconnect();
        this.sourceA = null;
        this.sourceB = null;
      } catch {
        // ignore
      }
    }, 400);
  }
}
