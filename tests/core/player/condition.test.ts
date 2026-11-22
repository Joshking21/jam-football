// Tests for SPEC §12.1 Condition and §12.2 Fatigue
import { describe, it, expect } from 'vitest';
import {
  calculateConditionDrainPerMinute,
  calculateWeeklyConditionRecovery,
  calculateWeeklyFatigueRecovery,
  calculateMatchFatigue,
  getConditionSkillPenalty,
  isConditionDisqualified,
  isFatigueElevated,
  isFatigueSevere,
} from '@/core/player/condition';

describe('SPEC §12.1 Condition drain per minute', () => {
  it('drains ~15-25 points over a 90 minute match', () => {
    // stamina 50 (staminaFactor = 1.25 - 50/200 = 1.0)
    // drain = 0.22 * 1.0 * 1.0 * 1.0 = 0.22/min => 19.8 over 90 mins
    const drainNormal = calculateConditionDrainPerMinute(50, 'Mid', 'Normal');
    const total90Normal = drainNormal * 90;
    expect(total90Normal).toBeGreaterThanOrEqual(15);
    expect(total90Normal).toBeLessThanOrEqual(25);

    // High pressing and Fast tempo increases drain
    const drainHard = calculateConditionDrainPerMinute(40, 'High', 'Fast');
    const total90Hard = drainHard * 90;
    expect(total90Hard).toBeGreaterThan(total90Normal);

    // High stamina reduces drain
    const drainFitter = calculateConditionDrainPerMinute(80, 'Mid', 'Normal');
    expect(drainFitter).toBeLessThan(drainNormal);
  });

  it('calculates weekly condition recovery with modifiers', () => {
    // Normal intensity, 70 stamina => (18 + 7) * 1.0 = 25
    const recBase = calculateWeeklyConditionRecovery({
      stamina: 70,
      intensity: 'Normal',
      focus: 'Balanced',
      playedMinutes: 90,
      fatigue: 20,
    });
    expect(recBase).toBeCloseTo(25, 1);

    // Fitness focus gives +4
    const recFitness = calculateWeeklyConditionRecovery({
      stamina: 70,
      intensity: 'Normal',
      focus: 'Fitness',
      playedMinutes: 90,
      fatigue: 20,
    });
    expect(recFitness).toBeCloseTo(29, 1);

    // Unplayed player gets +6 rest bonus
    const recUnplayed = calculateWeeklyConditionRecovery({
      stamina: 70,
      intensity: 'Normal',
      focus: 'Balanced',
      playedMinutes: 0,
      fatigue: 20,
    });
    expect(recUnplayed).toBeCloseTo(31, 1);

    // Fatigue > 60 reduces recovery by 15% (x 0.85) per SPEC §12.2
    const recFatigued = calculateWeeklyConditionRecovery({
      stamina: 70,
      intensity: 'Normal',
      focus: 'Balanced',
      playedMinutes: 90,
      fatigue: 65,
    });
    expect(recFatigued).toBeCloseTo(25 * 0.85, 1);
  });

  it('calculates skill penalties and selection limits', () => {
    expect(getConditionSkillPenalty(100)).toBe(0);
    expect(getConditionSkillPenalty(70)).toBe(0);
    // Condition 60 -> -(70 - 60)/100 = -0.10 z-units
    expect(getConditionSkillPenalty(60)).toBeCloseTo(-0.1, 2);

    expect(isConditionDisqualified(50)).toBe(false);
    expect(isConditionDisqualified(39)).toBe(true);
  });
});

describe('SPEC §12.2 Fatigue accumulation and recovery', () => {
  it('accumulates fatigue as +minutes/9 after match', () => {
    expect(calculateMatchFatigue(90)).toBe(10);
    expect(calculateMatchFatigue(45)).toBe(5);
    expect(calculateMatchFatigue(0)).toBe(0);
  });

  it('recovers fatigue based on intensity', () => {
    expect(calculateWeeklyFatigueRecovery('Light')).toBe(9);
    expect(calculateWeeklyFatigueRecovery('Normal')).toBe(6);
    expect(calculateWeeklyFatigueRecovery('Hard')).toBe(4);
  });

  it('flags elevated (> 60) and severe (> 80) fatigue', () => {
    expect(isFatigueElevated(50)).toBe(false);
    expect(isFatigueElevated(65)).toBe(true);

    expect(isFatigueSevere(75)).toBe(false);
    expect(isFatigueSevere(85)).toBe(true);
  });
});
