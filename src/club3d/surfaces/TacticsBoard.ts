import * as THREE from 'three';
import { FORMATIONS } from '../../config/formations';
import type { Tactics, Player } from '../../core/types';

const W = 2048;
const H = 1280;
const PAD = 60;
const PITCH_X = W - PAD * 2;
const PITCH_Y = H - PAD * 2;

const PITCH_GREEN = '#1a5c2a';
const LINE_WHITE = 'rgba(255,255,255,0.7)';
const PLAYER_FILL = '#F2B705';
const PLAYER_STROKE = '#1a1a1a';
const TEXT_COLOR = '#ffffff';

export class TacticsBoard {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public texture: THREE.CanvasTexture;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d')!;

    // Draw pitch onto canvas before wrapping in texture
    this.drawPitch();

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
  }

  private drawPitch() {
    const ctx = this.ctx;
    ctx.fillStyle = PITCH_GREEN;
    ctx.fillRect(0, 0, W, H);
    this.drawPitchLines();
    this.drawTitle('TACTICS BOARD');
  }

  update(tactics: Tactics, players: Player[]) {
    const ctx = this.ctx;

    ctx.fillStyle = PITCH_GREEN;
    ctx.fillRect(0, 0, W, H);

    this.drawPitchLines();
    this.drawTitle(tactics.formation);

    const formDef = FORMATIONS[tactics.formation];
    if (!formDef) return;

    for (let i = 0; i < formDef.slots.length; i++) {
      const slot = formDef.slots[i];
      if (!slot) continue;
      const playerId = tactics.lineup[i];
      const player = playerId ? players.find((p) => p.id === playerId) : null;

      const px = PAD + (slot.anchor.x / 105) * PITCH_X;
      const py = PAD + (slot.anchor.y / 68) * PITCH_Y;

      // Player circle
      ctx.beginPath();
      ctx.arc(px, py, 32, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#44aa55' : PLAYER_FILL;
      ctx.fill();
      ctx.strokeStyle = PLAYER_STROKE;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Shirt number
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), px, py);

      // Player name below
      if (player) {
        const name = player.knownAs || player.lastName;
        ctx.fillStyle = TEXT_COLOR;
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(name.toUpperCase(), px, py + 48);
      }

      // Role label above
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '16px sans-serif';
      ctx.fillText(slot.role, px, py - 44);
    }

    // Team instructions summary at bottom
    const instr = tactics.instructions;
    if (instr) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(PAD, H - 90, PITCH_X, 50);

      ctx.fillStyle = TEXT_COLOR;
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'left';
      const parts = [
        instr.mentality?.toUpperCase(),
        instr.passing?.toUpperCase(),
        instr.pressing?.toUpperCase(),
        instr.tempo?.toUpperCase(),
      ].filter(Boolean);
      ctx.fillText(parts.join('  ·  '), PAD + 16, H - 60);
    }

    this.texture.needsUpdate = true;
  }

  private drawPitchLines() {
    const ctx = this.ctx;
    ctx.strokeStyle = LINE_WHITE;
    ctx.lineWidth = 2;

    // Outer boundary
    ctx.strokeRect(PAD, PAD, PITCH_X, PITCH_Y);

    // Centre line
    const midX = PAD + PITCH_X / 2;
    ctx.beginPath();
    ctx.moveTo(midX, PAD);
    ctx.lineTo(midX, PAD + PITCH_Y);
    ctx.stroke();

    // Centre circle
    ctx.beginPath();
    ctx.arc(midX, PAD + PITCH_Y / 2, 80, 0, Math.PI * 2);
    ctx.stroke();

    // Centre spot
    ctx.beginPath();
    ctx.arc(midX, PAD + PITCH_Y / 2, 4, 0, Math.PI * 2);
    ctx.fillStyle = LINE_WHITE;
    ctx.fill();

    // Penalty areas
    const penW = PITCH_X * 0.16;
    const penH = PITCH_Y * 0.6;
    const penTop = PAD + (PITCH_Y - penH) / 2;
    ctx.strokeRect(PAD, penTop, penW, penH);
    ctx.strokeRect(PAD + PITCH_X - penW, penTop, penW, penH);

    // Goal areas
    const goalW = PITCH_X * 0.055;
    const goalH = PITCH_Y * 0.3;
    const goalTop = PAD + (PITCH_Y - goalH) / 2;
    ctx.strokeRect(PAD, goalTop, goalW, goalH);
    ctx.strokeRect(PAD + PITCH_X - goalW, goalTop, goalW, goalH);
  }

  private drawTitle(text: string) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(PAD, PAD - 50, PITCH_X, 42);
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, PAD - 28);
  }

  dispose() {
    this.texture.dispose();
  }
}
