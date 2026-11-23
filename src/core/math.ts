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

/**
 * Computes CIE76 color difference ΔE between two hex color strings (#RRGGBB).
 */
export function colorDeltaE(hex1: string, hex2: string): number {
  const parseHex = (h: string): [number, number, number] => {
    const clean = h.replace('#', '');
    const num = parseInt(clean, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  };

  const rgbToLab = (rgb: [number, number, number]): [number, number, number] => {
    // 1. Inverse sRGB gamma
    const [r, g, b] = rgb.map((c) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }) as [number, number, number];

    // 2. Linear RGB to CIE XYZ (D65)
    const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
    const y = (r * 0.2126729 + g * 0.7151522 + b * 0.072175) / 1.0;
    const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;

    // 3. XYZ to Lab
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f(x);
    const fy = f(y);
    const fz = f(z);

    const L = 116 * fy - 16;
    const a = 500 * (fx - fy);
    const bLab = 200 * (fy - fz);
    return [L, a, bLab];
  };

  const [L1, a1, b1] = rgbToLab(parseHex(hex1));
  const [L2, a2, b2] = rgbToLab(parseHex(hex2));

  return Math.sqrt((L1 - L2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}
