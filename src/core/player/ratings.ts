// Implements SPEC §9.5 OVR Weight Tables and Calculations
import { Attributes, AttributeKey, Position, PositionGroup, Player } from '../types';

export const POSITION_GROUPS: Record<Position, PositionGroup> = {
  GK: 'GK',
  CB: 'DEF',
  LB: 'DEF',
  RB: 'DEF',
  LWB: 'DEF',
  RWB: 'DEF',
  DM: 'MID',
  CM: 'MID',
  AM: 'MID',
  LM: 'MID',
  RM: 'MID',
  LW: 'FWD',
  RW: 'FWD',
  ST: 'FWD',
};

export const OVR_WEIGHTS: Record<
  PositionGroup | 'WIDE' | 'FB',
  Partial<Record<AttributeKey, number>>
> = {
  GK: {
    reflexes: 0.3,
    handling: 0.2,
    oneOnOnes: 0.2,
    aerialCommand: 0.15,
    decisions: 0.05,
    composure: 0.05,
    passing: 0.05,
  },
  DEF: {
    // CB weights
    tackling: 0.22,
    positioning: 0.25,
    heading: 0.18,
    strength: 0.12,
    pace: 0.08,
    decisions: 0.08,
    composure: 0.07,
  },
  FB: {
    tackling: 0.16,
    positioning: 0.16,
    pace: 0.18,
    stamina: 0.12,
    crossing: 0.14,
    passing: 0.1,
    workRate: 0.08,
    dribbling: 0.06,
  },
  MID: {
    // CM weights default for MID group
    passing: 0.24,
    decisions: 0.16,
    firstTouch: 0.12,
    stamina: 0.12,
    workRate: 0.1,
    tackling: 0.08,
    positioning: 0.06,
    longShots: 0.06,
    composure: 0.06,
  },
  WIDE: {
    pace: 0.18,
    dribbling: 0.2,
    crossing: 0.16,
    firstTouch: 0.1,
    offTheBall: 0.12,
    finishing: 0.08,
    stamina: 0.08,
    passing: 0.08,
  },
  FWD: {
    // ST weights
    finishing: 0.26,
    offTheBall: 0.18,
    composure: 0.14,
    firstTouch: 0.1,
    heading: 0.1,
    pace: 0.1,
    strength: 0.06,
    dribbling: 0.06,
  },
};

export function getPositionWeights(pos: Position): Partial<Record<AttributeKey, number>> {
  switch (pos) {
    case 'GK':
      return OVR_WEIGHTS.GK;
    case 'CB':
      return OVR_WEIGHTS.DEF;
    case 'LB':
    case 'RB':
    case 'LWB':
    case 'RWB':
      return OVR_WEIGHTS.FB;
    case 'DM':
      return {
        tackling: 0.18,
        positioning: 0.2,
        passing: 0.18,
        decisions: 0.14,
        stamina: 0.1,
        strength: 0.1,
        workRate: 0.1,
      };
    case 'CM':
      return OVR_WEIGHTS.MID;
    case 'AM':
      return {
        passing: 0.2,
        dribbling: 0.16,
        firstTouch: 0.14,
        decisions: 0.14,
        offTheBall: 0.12,
        longShots: 0.1,
        composure: 0.08,
        finishing: 0.06,
      };
    case 'LM':
    case 'RM':
    case 'LW':
    case 'RW':
      return OVR_WEIGHTS.WIDE;
    case 'ST':
      return OVR_WEIGHTS.FWD;
  }
}

/**
 * Computes the raw unadjusted OVR at a position given an attributes object
 */
export function rawOvr(attributes: Attributes, pos: Position): number {
  const weights = getPositionWeights(pos);
  let sum = 0;
  for (const [key, w] of Object.entries(weights) as [AttributeKey, number][]) {
    sum += (attributes[key] || 1) * w;
  }
  return Math.round(sum);
}

/**
 * Computes a player's actual OVR at a slot, factoring in positional familiarity (SPEC §9.5)
 */
export function ovrAt(player: Pick<Player, 'attributes' | 'positions'>, slotPos: Position): number {
  const raw = rawOvr(player.attributes, slotPos);

  // Check if position is listed in familiarity list
  const listed = player.positions.find((p) => p.pos === slotPos);
  if (listed) {
    return Math.round(raw * (listed.familiarity / 100));
  }

  const primaryPos = player.positions[0]?.pos || 'CM';
  const playerGroup = POSITION_GROUPS[primaryPos];
  const slotGroup = POSITION_GROUPS[slotPos];

  // Specific goalkeeper crossover penalties
  if (primaryPos !== 'GK' && slotPos === 'GK') {
    return Math.round(raw * 0.2);
  }
  if (primaryPos === 'GK' && slotPos !== 'GK') {
    return Math.round(raw * 0.3);
  }

  // Same position group
  if (playerGroup === slotGroup) {
    return Math.round(raw * 0.8);
  }

  // Adjacent groups (DEF ↔ MID, MID ↔ FWD)
  const isAdjacent =
    (playerGroup === 'DEF' && slotGroup === 'MID') ||
    (playerGroup === 'MID' && slotGroup === 'DEF') ||
    (playerGroup === 'MID' && slotGroup === 'FWD') ||
    (playerGroup === 'FWD' && slotGroup === 'MID');

  if (isAdjacent) {
    return Math.round(raw * 0.65);
  }

  return Math.round(raw * 0.45);
}

/**
 * Primary position OVR (at 100% familiarity)
 */
export function getPrimaryOvr(player: Pick<Player, 'attributes' | 'positions'>): number {
  const primaryPos = player.positions[0]?.pos || 'CM';
  return rawOvr(player.attributes, primaryPos);
}
