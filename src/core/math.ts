// Implements SPEC §6 and §13.4 Shared mathematical functions and formatting
import { CURRENCY } from '@/config/constants';

/**
 * Normalises an attribute 1–99 to z-units (SPEC §13.4): (a - 50) / 25
 */
export function z(attr: number): number {
  return (attr - 50) / 25;
}

/**
 * Standard logistic sigmoid σ(x) = 1 / (1 + e^-x)
 */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Inverse sigmoid logit(p) = ln(p / (1 - p))
 */
export function logit(p: number): number {
  const safeP = Math.max(0.0001, Math.min(0.9999, p));
  return Math.log(safeP / (1 - safeP));
}

/**
 * Clamps value between min and max
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Rounds a number to a given number of decimal places
 */
export function roundTo(val: number, decimals: number = 0): number {
  const factor = 10 ** decimals;
  return Math.round(val * factor) / factor;
}

/**
 * Formats money integers per SPEC §6: €12.4M, €850K, €9,500
 */
export function formatMoney(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 1_000_000) {
    const val = (abs / 1_000_000).toFixed(1);
    const cleanVal = val.endsWith('.0') ? val.slice(0, -2) : val;
    return `${sign}${CURRENCY}${cleanVal}M`;
  }
  if (abs >= 10_000) {
    const val = Math.round(abs / 1_000);
    return `${sign}${CURRENCY}${val}K`;
  }
  return `${sign}${CURRENCY}${abs.toLocaleString('en-US')}`;
}
