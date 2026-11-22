// Tests for SPEC §12.3 & §12.5 Injuries
import { describe, it, expect } from 'vitest';
import {
  INJURY_DEFINITIONS,
  MINOR_INJURIES,
  MODERATE_INJURIES,
  MAJOR_INJURIES,
  rollInjury,
  calculateMatchInjuryHazard,
  checkInMatchInjury,
  checkTrainingInjury,
} from '@/core/player/injuries';
import { createRng } from '@/core/rng';

describe('SPEC §12.5 Injuries content & severity', () => {
  it('contains at least 20 injury kinds with valid severity tags', () => {
    expect(INJURY_DEFINITIONS.length).toBeGreaterThanOrEqual(20);
    expect(MINOR_INJURIES.length).toBeGreaterThan(0);
    expect(MODERATE_INJURIES.length).toBeGreaterThan(0);
    expect(MAJOR_INJURIES.length).toBeGreaterThan(0);

    for (const def of INJURY_DEFINITIONS) {
      expect(def.name).toBeTruthy();
      expect(['Minor', 'Moderate', 'Major']).toContain(def.severity);
      expect(def.minMatchdays).toBeGreaterThanOrEqual(1);
      expect(def.maxMatchdays).toBeGreaterThanOrEqual(def.minMatchdays);
      if (def.severity === 'Minor') {
        expect(def.maxMatchdays).toBeLessThanOrEqual(2);
      } else if (def.severity === 'Moderate') {
        expect(def.minMatchdays).toBeGreaterThanOrEqual(3);
        expect(def.maxMatchdays).toBeLessThanOrEqual(5);
      } else if (def.severity === 'Major') {
        expect(def.minMatchdays).toBeGreaterThanOrEqual(6);
        expect(def.maxMatchdays).toBeLessThanOrEqual(12);
      }
    }
  });

  it('rolls injuries adhering to severity constraints', () => {
    const rng = createRng(42);
    const minorInj = rollInjury(rng, 'Minor');
    expect(minorInj.severity).toBe('Minor');
    expect(minorInj.matchdaysOut).toBeGreaterThanOrEqual(1);
    expect(minorInj.matchdaysOut).toBeLessThanOrEqual(2);

    const majorInj = rollInjury(rng, 'Major');
    expect(majorInj.severity).toBe('Major');
    expect(majorInj.matchdaysOut).toBeGreaterThanOrEqual(6);
    expect(majorInj.matchdaysOut).toBeLessThanOrEqual(12);
  });
});

describe('SPEC §12.5 In-match injury hazard rate', () => {
  it('increases hazard rate with lower condition, high fatigue, and opponent high pressing', () => {
    const baseHazard = calculateMatchInjuryHazard(100, 20, 'Mid');
    expect(baseHazard).toBeCloseTo(0.00012, 6);

    // Condition < 70 increases hazard
    const tiredHazard = calculateMatchInjuryHazard(50, 20, 'Mid');
    expect(tiredHazard).toBeGreaterThan(baseHazard);

    // Fatigue > 60 multiplies by 1.5
    const fatiguedHazard = calculateMatchInjuryHazard(100, 70, 'Mid');
    expect(fatiguedHazard).toBeCloseTo(baseHazard * 1.5, 6);

    // Opponent High pressing multiplies by 1.15
    const pressingHazard = calculateMatchInjuryHazard(100, 20, 'High');
    expect(pressingHazard).toBeCloseTo(baseHazard * 1.15, 6);
  });
});

describe('SPEC §12.3 Training injuries', () => {
  it('scales training injury risk with training intensity and fatigue', () => {
    // 1000 simulated checks with high intensity & high fatigue should yield more injuries
    let lightInjuries = 0;
    let hardInjuries = 0;

    for (let i = 0; i < 2000; i++) {
      const rngLight = createRng(i * 13 + 1);
      if (checkTrainingInjury(rngLight, 'Light', 20)) {
        lightInjuries++;
      }

      const rngHard = createRng(i * 13 + 1);
      if (checkTrainingInjury(rngHard, 'Hard', 75)) {
        hardInjuries++;
      }
    }

    expect(hardInjuries).toBeGreaterThan(lightInjuries);
  });
});
