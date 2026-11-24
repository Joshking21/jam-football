// Implements SPEC §12.3 & §12.5 In-Match and Training Injury Resolution
import { Injury, Intensity } from '../types';
import { Rng } from '../rng';
import { BALANCE } from '@/config/balance';
import rawInjuries from '@/content/injuries.json';

export interface InjuryDefinition {
  id: string;
  name: string;
  severity: 'Minor' | 'Moderate' | 'Major';
  minMatchdays: number;
  maxMatchdays: number;
}

export const INJURY_DEFINITIONS: InjuryDefinition[] = rawInjuries as InjuryDefinition[];

export const MINOR_INJURIES = INJURY_DEFINITIONS.filter((i) => i.severity === 'Minor');
export const MODERATE_INJURIES = INJURY_DEFINITIONS.filter((i) => i.severity === 'Moderate');
export const MAJOR_INJURIES = INJURY_DEFINITIONS.filter((i) => i.severity === 'Major');

/**
 * Generates an injury given an RNG instance and optional forced severity
 */
export function rollInjury(rng: Rng, forcedSeverity?: 'Minor' | 'Moderate' | 'Major'): Injury {
  let severity = forcedSeverity;
  if (!severity) {
    const roll = rng.next();
    if (roll < BALANCE.injuries.severityDistribution.Minor) {
      severity = 'Minor';
    } else if (
      roll <
      BALANCE.injuries.severityDistribution.Minor + BALANCE.injuries.severityDistribution.Moderate
    ) {
      severity = 'Moderate';
    } else {
      severity = 'Major';
    }
  }

  const pool =
    severity === 'Minor'
      ? MINOR_INJURIES
      : severity === 'Moderate'
        ? MODERATE_INJURIES
        : MAJOR_INJURIES;

  const def = pool[rng.int(0, pool.length - 1)] ?? pool[0]!;
  const matchdaysOut = rng.int(def.minMatchdays, def.maxMatchdays);

  return {
    kind: def.name,
    matchdaysOut,
    severity: def.severity,
  };
}

/**
 * Calculates in-match injury hazard rate lambda per player per minute per SPEC §12.5:
 * λ = 0.00012 × (1 + max(0, 70 − condition)/30) × (fatigue > 60 ? 1.5 : 1) × (opponent pressing High ? 1.15 : 1)
 */
export function calculateMatchInjuryHazard(
  condition: number,
  fatigue: number,
  opponentPressing: 'Low' | 'Mid' | 'High' = 'Mid',
): number {
  const base = BALANCE.injuries.hazardBase; // 0.00012
  const condTerm = 1 + Math.max(0, 70 - condition) / 30;
  const fatTerm = fatigue > BALANCE.fatigue.hazardThreshold ? BALANCE.fatigue.hazardMultiplier : 1;
  const pressTerm = opponentPressing === 'High' ? 1.15 : 1;
  return base * condTerm * fatTerm * pressTerm;
}

/**
 * Checks if a player suffers an injury during a dt minute step in a match.
 * probability = 1 − exp(−λ · dt)
 */
export function checkInMatchInjury(
  rng: Rng,
  dt: number,
  condition: number,
  fatigue: number,
  opponentPressing: 'Low' | 'Mid' | 'High' = 'Mid',
): Injury | null {
  const lambda = calculateMatchInjuryHazard(condition, fatigue, opponentPressing);
  const prob = 1 - Math.exp(-lambda * dt);
  if (rng.next() < prob) {
    return rollInjury(rng);
  }
  return null;
}

/**
 * Checks weekly training injury per SPEC §12.3 & §12.18.3:
 * 0.004 × intensityInjury × (fatigue > 60 ? 1.5 : 1) × (weekLoad / 12) × workload × extraSessions
 */
export function checkTrainingInjury(
  rng: Rng,
  intensity: Intensity,
  fatigue: number,
  weekLoad: number = 12,
  workloadMultiplier: number = 1.0,
  extraSessionsMultiplier: number = 1.0,
): Injury | null {
  const baseChance = BALANCE.training.baseInjuryChancePerPlayer; // 0.004
  const intFactor = BALANCE.training.intensityFactors[intensity]?.injury ?? 1.0;
  const fatTerm = fatigue > BALANCE.fatigue.hazardThreshold ? BALANCE.fatigue.hazardMultiplier : 1;
  const loadFactor = weekLoad / (BALANCE.training.baselineLoad ?? 12);
  const prob =
    baseChance * intFactor * fatTerm * loadFactor * workloadMultiplier * extraSessionsMultiplier;

  if (rng.next() < prob) {
    return rollInjury(rng);
  }
  return null;
}

/**
 * Physio assessment of knock readability (SPEC §12.19.1)
 * "He can carry on. About {pct}%." pct = 70–90, higher with better physio stars.
 */
export function getKnockPhysioRead(physioStars: number = 3): { pct: number; line: string } {
  const pct = Math.min(
    90,
    Math.max(
      70,
      BALANCE.injuryDecisions.knockPhysioBasePct +
        (physioStars - 1) * BALANCE.injuryDecisions.knockPhysioStarStep,
    ),
  );
  return {
    pct,
    line: `He can carry on. About ${pct}%.`,
  };
}

/**
 * Checks for a warm-up scare before matchday (SPEC §12.19.3)
 * One starter has a "tight" muscle with chance 3% (×2 if fatigue > 50, ×0.7 with 4–5★ physio).
 */
export function checkWarmupScare(rng: Rng, fatigue: number, physioStars: number = 3): boolean {
  let chance = BALANCE.injuryDecisions.warmupScareBaseChance;
  if (fatigue > BALANCE.injuryDecisions.warmupScareFatigueThreshold) {
    chance *= BALANCE.injuryDecisions.warmupScareFatigueMultiplier;
  }
  if (physioStars >= 4) {
    chance *= BALANCE.injuryDecisions.warmupScarePhysioDiscount;
  }
  return rng.chance(chance);
}

/**
 * Calculates physio multiplier for rushed-back player hazard (SPEC §12.19.2)
 * (1.2 - 0.08 * stars)
 */
export function calculateRushPhysioFactor(physioStars: number = 3): number {
  return Math.max(
    0.6,
    BALANCE.injuryDecisions.rushPhysioBase -
      BALANCE.injuryDecisions.rushPhysioStarSlope * physioStars,
  );
}
