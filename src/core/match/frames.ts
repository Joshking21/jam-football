// Implements SPEC §13.1 Coordinate Frames and Zones
import { Side } from '../types';

export type Third = 'DEF' | 'MID' | 'ATT';
export type Lane = 'Left' | 'Centre' | 'Right';
export type ZoneKey = 'DL' | 'DC' | 'DR' | 'ML' | 'MC' | 'MR' | 'AL' | 'AC' | 'AR';

export interface Point2D {
  x: number;
  y: number;
}

export interface AttackingPoint2D {
  ax: number;
  ay: number;
}

/**
 * Checks if the team is attacking toward x = 105 in the current half.
 * Home attacks toward 105 in half 1 and 0 in half 2.
 * Away attacks toward 0 in half 1 and 105 in half 2.
 */
export function attacksToward105(side: Side, half: 1 | 2): boolean {
  return (side === 'home' && half === 1) || (side === 'away' && half === 2);
}

/**
 * Converts attacking coordinates (ax, ay) to absolute pitch coordinates (x, y).
 */
export function toAbsolute(ax: number, ay: number, side: Side, half: 1 | 2): Point2D {
  if (attacksToward105(side, half)) {
    return { x: ax, y: ay };
  }
  return { x: 105 - ax, y: 68 - ay };
}

/**
 * Converts absolute pitch coordinates (x, y) to attacking coordinates (ax, ay).
 */
export function toAttacking(x: number, y: number, side: Side, half: 1 | 2): AttackingPoint2D {
  if (attacksToward105(side, half)) {
    return { ax: x, ay: y };
  }
  return { ax: 105 - x, ay: 68 - y };
}

/**
 * Returns third: DEF (ax < 35), MID (35 <= ax < 70), ATT (ax >= 70)
 */
export function getThird(ax: number): Third {
  if (ax < 35) return 'DEF';
  if (ax < 70) return 'MID';
  return 'ATT';
}

/**
 * Returns lane: Left (ay < 22.67), Centre (22.67 <= ay < 45.33), Right (ay >= 45.33)
 */
export function getLane(ay: number): Lane {
  if (ay < 22.67) return 'Left';
  if (ay < 45.33) return 'Centre';
  return 'Right';
}

/**
 * Identifies the 3x3 zone key (DL..AR) from attacking coordinates
 */
export function getZoneKey(ax: number, ay: number): ZoneKey {
  const third = getThird(ax);
  const lane = getLane(ay);

  const tCode = third === 'DEF' ? 'D' : third === 'MID' ? 'M' : 'A';
  const lCode = lane === 'Left' ? 'L' : lane === 'Centre' ? 'C' : 'R';
  return `${tCode}${lCode}` as ZoneKey;
}

/**
 * Checks if point is inside the penalty box (ax >= 88.5 && 13.84 <= ay <= 54.16)
 */
export function isInBox(ax: number, ay: number): boolean {
  return ax >= 88.5 && ay >= 13.84 && ay <= 54.16;
}

/**
 * Checks if point is inside the six-yard box (ax >= 99.5 && 24.84 <= ay <= 43.16)
 */
export function isInSixYard(ax: number, ay: number): boolean {
  return ax >= 99.5 && ay >= 24.84 && ay <= 43.16;
}

export const classifyThird = getThird;
export const classifyLane = getLane;
export const isBox = isInBox;
export const isSixYardBox = isInSixYard;

/**
 * Returns the mirrored zone for defensive assignment (SPEC §13.5)
 * Attacker's (T, L) -> Defender's (opposite third, mirrored lane)
 */
export function getMirroredZoneKey(zone: ZoneKey): ZoneKey {
  const map: Record<ZoneKey, ZoneKey> = {
    DL: 'AR',
    DC: 'AC',
    DR: 'AL',
    ML: 'MR',
    MC: 'MC',
    MR: 'ML',
    AL: 'DR',
    AC: 'DC',
    AR: 'DL',
  };
  return map[zone];
}
