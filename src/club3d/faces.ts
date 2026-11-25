// SPEC §14.11.6 Painted face layers (faces.ts)
import * as THREE from 'three';
import type { FaceMood, MouthShape, FaceMoodPreset } from './types';
import { FACES_CONFIG } from '../config/balance';
import { MouthAnimator } from './mouth';

export const MOOD_PRESETS: Record<FaceMood, FaceMoodPreset> = {
  neutral: {
    browShape: 'neutral',
    restingMouth: 'neutral',
    eyeState: 'normal',
  },
  happy: {
    browShape: 'arched',
    restingMouth: 'smile',
    eyeState: 'squint',
  },
  angry: {
    browShape: 'furrowed',
    restingMouth: 'frown',
    eyeState: 'squint',
  },
  worried: {
    browShape: 'raised',
    restingMouth: 'frown',
    eyeState: 'wide',
  },
  shocked: {
    browShape: 'raised',
    restingMouth: 'slack',
    eyeState: 'wide',
  },
};

export class FaceController {
  private mood: FaceMood = 'neutral';
  private mouthAnimator = new MouthAnimator();
  private blinkTimer = 3.0;
  private isBlinking = false;
  private blinkProgress = 0;
  private headTiltDeg = 0;
  private gazeYawDeg = 0;
  private faceMesh: THREE.Mesh | null = null;
  private faceCanvas: HTMLCanvasElement | null = null;
  private faceTexture: THREE.CanvasTexture | null = null;

  constructor() {
    if (typeof document !== 'undefined') {
      this.faceCanvas = document.createElement('canvas');
      this.faceCanvas.width = 128;
      this.faceCanvas.height = 128;
      this.faceTexture = new THREE.CanvasTexture(this.faceCanvas);
    }
    this.scheduleNextBlink();
    this.redrawFace('closed');
  }

  private scheduleNextBlink() {
    const min = FACES_CONFIG.blinkIntervalMin;
    const max = FACES_CONFIG.blinkIntervalMax;
    this.blinkTimer = min + Math.random() * (max - min);
  }

  public setMood(mood: FaceMood) {
    this.mood = mood;
    this.redrawFace(this.mouthAnimator.getShape());
  }

  public getMood(): FaceMood {
    return this.mood;
  }

  public createFaceMesh(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(0.18, 0.22);
    const mat = new THREE.MeshBasicMaterial({
      map: this.faceTexture,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    this.faceMesh = new THREE.Mesh(geo, mat);
    this.faceMesh.name = 'FacePatch';
    return this.faceMesh;
  }

  public update(
    dt: number,
    isSpeaking: boolean,
    analyser: AnalyserNode | null,
    speakerPos: [number, number, number] | null,
    myPos: [number, number, number] | null,
  ) {
    // 1. Blink Update
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.isBlinking = true;
      this.blinkProgress += dt / FACES_CONFIG.blinkDuration;
      if (this.blinkProgress >= 1.0) {
        this.isBlinking = false;
        this.blinkProgress = 0;
        this.scheduleNextBlink();
      }
    }

    // 2. Head Tilt & Gaze Look-At
    if (!isSpeaking) {
      // 3-5° head tilt while listening
      this.headTiltDeg = FACES_CONFIG.headTiltMinDeg + Math.sin(Date.now() * 0.002) * 1.5;
    } else {
      this.headTiltDeg = 0;
    }

    if (speakerPos && myPos) {
      const dx = speakerPos[0] - myPos[0];
      const dz = speakerPos[2] - myPos[2];
      const targetAngleDeg = (Math.atan2(dx, dz) * 180) / Math.PI;
      this.gazeYawDeg = THREE.MathUtils.clamp(
        targetAngleDeg,
        -FACES_CONFIG.gazeMaxYawDeg,
        FACES_CONFIG.gazeMaxYawDeg,
      );
    } else {
      this.gazeYawDeg = 0;
    }

    // 3. Mouth Animation
    let shape: MouthShape = 'closed';
    if (isSpeaking) {
      shape = this.mouthAnimator.updateFromAudio(analyser, dt);
    } else {
      this.mouthAnimator.reset();
      shape = 'closed';
    }

    this.redrawFace(shape);
  }

  private redrawFace(mouthShape: MouthShape) {
    if (!this.faceCanvas) return;
    const ctx = this.faceCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 128, 128);

    const preset = MOOD_PRESETS[this.mood];

    ctx.strokeStyle = '#1a1410';
    ctx.fillStyle = '#1a1410';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // 1. Brows
    ctx.beginPath();
    if (preset.browShape === 'neutral') {
      ctx.moveTo(28, 38);
      ctx.lineTo(54, 38);
      ctx.moveTo(74, 38);
      ctx.lineTo(100, 38);
    } else if (preset.browShape === 'arched') {
      ctx.moveTo(28, 42);
      ctx.quadraticCurveTo(41, 32, 54, 40);
      ctx.moveTo(74, 40);
      ctx.quadraticCurveTo(87, 32, 100, 42);
    } else if (preset.browShape === 'furrowed') {
      ctx.moveTo(28, 36);
      ctx.lineTo(54, 44);
      ctx.moveTo(74, 44);
      ctx.lineTo(100, 36);
    } else if (preset.browShape === 'raised') {
      ctx.moveTo(28, 32);
      ctx.quadraticCurveTo(41, 26, 54, 32);
      ctx.moveTo(74, 32);
      ctx.quadraticCurveTo(87, 26, 100, 32);
    }
    ctx.stroke();

    // 2. Eyes
    if (this.isBlinking) {
      // Slits for blink
      ctx.beginPath();
      ctx.moveTo(34, 56);
      ctx.lineTo(48, 56);
      ctx.moveTo(80, 56);
      ctx.lineTo(94, 56);
      ctx.stroke();
    } else {
      if (preset.eyeState === 'squint') {
        ctx.beginPath();
        ctx.arc(41, 56, 4, 0, Math.PI * 2);
        ctx.arc(87, 56, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (preset.eyeState === 'wide') {
        ctx.beginPath();
        ctx.arc(41, 56, 7, 0, Math.PI * 2);
        ctx.arc(87, 56, 7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // normal
        ctx.beginPath();
        ctx.arc(41, 56, 5.5, 0, Math.PI * 2);
        ctx.arc(87, 56, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Mouth
    ctx.beginPath();
    if (mouthShape === 'closed') {
      if (preset.restingMouth === 'smile') {
        ctx.arc(64, 82, 16, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
      } else if (preset.restingMouth === 'frown') {
        ctx.arc(64, 104, 16, 1.2 * Math.PI, 1.8 * Math.PI);
        ctx.stroke();
      } else if (preset.restingMouth === 'slack') {
        ctx.ellipse(64, 92, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // neutral line
        ctx.moveTo(48, 92);
        ctx.lineTo(80, 92);
        ctx.stroke();
      }
    } else if (mouthShape === 'small') {
      ctx.ellipse(64, 92, 8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (mouthShape === 'open') {
      ctx.ellipse(64, 93, 14, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (mouthShape === 'wide') {
      ctx.ellipse(64, 94, 18, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.faceTexture) {
      this.faceTexture.needsUpdate = true;
    }
  }

  public getHeadRotation(): THREE.Euler {
    return new THREE.Euler(
      (this.headTiltDeg * Math.PI) / 180,
      (this.gazeYawDeg * Math.PI) / 180,
      0,
      'YXZ',
    );
  }
}
