// SPEC §11.25.6 Time of day (timeOfDay.ts)
import * as THREE from 'three';
import type { TimeOfDayBeat } from './types';
import { RENDER_CONFIG, CLUB3D_CONFIG } from '../config/balance';

export class TimeOfDayController {
  private currentBeat: TimeOfDayBeat = 'monday_morning';
  private targetBeat: TimeOfDayBeat = 'monday_morning';
  private transitionTimer = 0;
  private isTransitioning = false;

  private sunLight: THREE.DirectionalLight | null = null;
  private ambientLight: THREE.AmbientLight | null = null;

  public setLights(sun: THREE.DirectionalLight, ambient: THREE.AmbientLight) {
    this.sunLight = sun;
    this.ambientLight = ambient;
    this.applyPreset(this.currentBeat);
  }

  public setBeat(beat: TimeOfDayBeat, instant = false) {
    if (instant) {
      this.currentBeat = beat;
      this.targetBeat = beat;
      this.isTransitioning = false;
      this.applyPreset(beat);
    } else {
      this.targetBeat = beat;
      this.isTransitioning = true;
      this.transitionTimer = 0;
    }
  }

  public getBeat(): TimeOfDayBeat {
    return this.targetBeat;
  }

  public getTopBarChip(): { dayText: string; timeText: string } {
    switch (this.targetBeat) {
      case 'monday_morning':
        return { dayText: 'MON', timeText: 'MORNING' };
      case 'wednesday_afternoon':
        return { dayText: 'WED', timeText: 'AFTERNOON' };
      case 'friday_evening':
        return { dayText: 'FRI', timeText: 'EVENING' };
      case 'matchday':
        return { dayText: 'SAT', timeText: 'MATCHDAY' };
    }
  }

  private applyPreset(beat: TimeOfDayBeat) {
    if (!this.sunLight || !this.ambientLight) return;
    const p = RENDER_CONFIG.tod[beat];
    if (!p) return;

    this.sunLight.color.set(p.sunColor);
    this.sunLight.intensity = p.intensity;
    this.ambientLight.color.set(p.skyColor);
    this.ambientLight.intensity = p.lampLevel;
  }

  public update(dt: number) {
    if (!this.isTransitioning || !this.sunLight || !this.ambientLight) return;

    this.transitionTimer += dt;
    const progress = Math.min(1.0, this.transitionTimer / CLUB3D_CONFIG.todCrossfadeSec);

    const from = RENDER_CONFIG.tod[this.currentBeat];
    const to = RENDER_CONFIG.tod[this.targetBeat];

    if (from && to) {
      const fromSun = new THREE.Color(from.sunColor);
      const toSun = new THREE.Color(to.sunColor);
      this.sunLight.color.copy(fromSun.lerp(toSun, progress));
      this.sunLight.intensity = THREE.MathUtils.lerp(from.intensity, to.intensity, progress);

      const fromSky = new THREE.Color(from.skyColor);
      const toSky = new THREE.Color(to.skyColor);
      this.ambientLight.color.copy(fromSky.lerp(toSky, progress));
      this.ambientLight.intensity = THREE.MathUtils.lerp(from.lampLevel, to.lampLevel, progress);
    }

    if (progress >= 1.0) {
      this.currentBeat = this.targetBeat;
      this.isTransitioning = false;
    }
  }
}
