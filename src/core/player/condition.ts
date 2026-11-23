// Implements SPEC §12.1 Condition and §12.2 Fatigue calculations
import { Intensity, Pressing, Tempo, TrainingPlan } from '../types';
import { BALANCE } from '@/config/balance';
import { clamp } from '../math';

export type TrainingFocus = TrainingPlan['focus'];

/**
 * Calculates in-match condition drain per minute on the pitch per SPEC §12.1:
 * drain = 0.22 × staminaFactor × pressingFactor × tempoFactor
 * where staminaFactor = 1.25 − stamina/200
 */
export function calculateConditionDrainPerMinute(
  stamina: number,
  pressing: Pressing = 'Mid',
  tempo: Tempo = 'Normal',
): number {
  const base = BALANCE.condition.drainPerMinuteBase; // 0.22
  const staminaFactor =
    BALANCE.condition.staminaBaseFactor - stamina / BALANCE.condition.staminaDivisor;

  const pressingFactors: Record<Pressing, number> = {
    High: 1.12,
    Mid: 1.0,
    Low: 0.92,
  };
  const tempoFactors: Record<Tempo, number> = {
    Fast: 1.05,
    Normal: 1.0,
    Slow: 0.96,
  };

  const pFactor = pressingFactors[pressing] ?? 1.0;
  const tFactor = tempoFactors[tempo] ?? 1.0;

  return base * staminaFactor * pFactor * tFactor;
}

/**
 * Calculates weekly condition recovery between matchdays per SPEC §12.1 & §12.2:
 * recovery = (18 + stamina/10) × intensityRecovery
 * + 4 if Fitness focus
 * + 6 if did not play (playedMinutes === 0)
 * if fatigue > 60: recovery × 0.85
 * Capped at 100
 */
export function calculateWeeklyConditionRecovery(params: {
  stamina: number;
  intensity: Intensity;
  focus: TrainingFocus;
  playedMinutes: number;
  fatigue: number;
  weekLoad?: number;
  workloadConditionDelta?: number;
}): number {
  const { stamina, intensity, focus, playedMinutes, fatigue, weekLoad, workloadConditionDelta } =
    params;

  const intMult = BALANCE.condition.intensityRecoveryMultipliers[intensity] ?? 1.0;
  let recovery =
    (BALANCE.condition.weeklyRecoveryBase +
      stamina / BALANCE.condition.weeklyRecoveryStaminaDivisor) *
    intMult;

  if (focus === 'Fitness') {
    recovery += BALANCE.condition.fitnessFocusBonus; // +4
  }

  if (playedMinutes <= 0) {
    recovery += BALANCE.condition.restBonus; // +6
  }

  // Fatigue > 60 reduces weekly condition recovery by 15% (× 0.85) per SPEC §12.2
  if (fatigue > BALANCE.fatigue.hazardThreshold) {
    recovery *= 0.85;
  }

  // SPEC §12.18.3: Weekly recovery gets + K.train.loadCond * (12 - weekLoad)
  if (weekLoad !== undefined) {
    recovery += BALANCE.training.loadCond * (BALANCE.training.baselineLoad - weekLoad);
  }

  if (workloadConditionDelta !== undefined) {
    recovery += workloadConditionDelta;
  }

  return recovery;
}

/**
 * Calculates weekly fatigue recovery per SPEC §12.2:
 * Base −6 (Light −9, Hard −4)
 */
export function calculateWeeklyFatigueRecovery(intensity: Intensity): number {
  return BALANCE.fatigue.weeklyRecoveryIntensity[intensity] ?? BALANCE.fatigue.weeklyRecoveryBase;
}

/**
 * Calculates post-match fatigue accumulated per SPEC §12.2:
 * + minutes / 9
 */
export function calculateMatchFatigue(minutes: number): number {
  return Math.round(minutes / BALANCE.fatigue.minutesDivisor);
}

/**
 * Calculates skill penalty in z-units when condition < 70 per SPEC §12.1:
 * −(70 − condition) / 100
 */
export function getConditionSkillPenalty(condition: number): number {
  if (condition >= BALANCE.condition.dropPenaltyThreshold) {
    return 0;
  }
  return -(BALANCE.condition.dropPenaltyThreshold - condition) / 100;
}

/**
 * Checks if a player cannot be selected due to low condition per SPEC §12.1 (< 40)
 */
export function isConditionDisqualified(condition: number): boolean {
  return condition < BALANCE.condition.selectionMinimum;
}

/**
 * Checks if fatigue is elevated (> 60, hazard × 1.5, recovery × 0.85)
 */
export function isFatigueElevated(fatigue: number): boolean {
  return fatigue > BALANCE.fatigue.hazardThreshold;
}

/**
 * Checks if fatigue is severe (> 80, red warning / rest suggested)
 */
export function isFatigueSevere(fatigue: number): boolean {
  return fatigue > BALANCE.fatigue.severeThreshold;
}
