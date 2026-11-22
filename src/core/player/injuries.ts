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
 * Checks weekly training injury per SPEC §12.3:
 * 0.004 × intensityInjury × (fatigue > 60 ? 1.5 : 1)
 */
export function checkTrainingInjury(
  rng: Rng,
  intensity: Intensity,
  fatigue: number,
): Injury | null {
  const baseChance = BALANCE.training.baseInjuryChancePerPlayer; // 0.004
  const intFactor = BALANCE.training.intensityFactors[intensity]?.injury ?? 1.0;
  const fatTerm = fatigue > BALANCE.fatigue.hazardThreshold ? BALANCE.fatigue.hazardMultiplier : 1;
  const prob = baseChance * intFactor * fatTerm;

  if (rng.next() < prob) {
    return rollInjury(rng);
  }
  return null;
}
