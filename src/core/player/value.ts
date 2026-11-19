// Implements SPEC §12.10 Player Market Value and Wage Formulas
import { Player } from '../types';
import { getPrimaryOvr } from './ratings';

/**
 * Rounds a number to a specified count of significant figures
 */
export function roundToSigFigs(n: number, sigFigs = 2): number {
  if (n === 0) return 0;
  const d = Math.ceil(Math.log10(n < 0 ? -n : n));
  const power = sigFigs - d;
  const magnitude = Math.pow(10, power);
  const shifted = Math.round(n * magnitude);
  return shifted / magnitude;
}

export function getAgeFactor(age: number): number {
  if (age <= 21) return 1.4;
  if (age <= 24) return 1.25;
  if (age <= 28) return 1.0;
  if (age <= 30) return 0.75;
  if (age <= 32) return 0.5;
  return 0.3;
}

/**
 * Computes market value in whole currency units (SPEC §12.10)
 */
export function valueOf(
  player: Pick<Player, 'attributes' | 'positions' | 'age' | 'potential' | 'contract'>,
): number {
  const ovr = getPrimaryOvr(player);
  const base = 1_200_000 * Math.pow(1.16, ovr - 60);
  const ageFactor = getAgeFactor(player.age);
  const potentialFactor = 1 + Math.max(0, player.potential - ovr) / 40;
  const contractFactor = player.contract && player.contract.yearsLeft === 1 ? 0.75 : 1;

  const raw = base * ageFactor * potentialFactor * contractFactor;
  const rounded = roundToSigFigs(Math.max(50_000, raw), 2);
  return Math.max(50_000, Math.round(rounded));
}

/**
 * Computes weekly wage for a given player market value (SPEC §12.10)
 */
export function wageFor(value: number): number {
  return Math.max(1_000, Math.round((value * 0.0016) / 500) * 500);
}
