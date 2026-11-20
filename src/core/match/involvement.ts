// Implements SPEC §13.5 Involvement Weights and Player Selection
import { ZoneKey, getMirroredZoneKey, isInBox, Third } from './frames';
import {
  Duty,
  Formation,
  Mentality,
  Width,
  PlayerId,
  Side,
  RoleId,
  PlayerInstruction,
} from '../types';
import { FORMATIONS } from '@/config/formations';
import { Rng } from '../rng';

export type ZoneWeights = Record<ZoneKey, number>;

const BASE_INVOLVEMENT_ROWS: Record<string, ZoneWeights> = {
  GK: { DL: 0, DC: 1.0, DR: 0, ML: 0, MC: 0, MR: 0, AL: 0, AC: 0, AR: 0 },
  CB_L: { DL: 0.3, DC: 0.6, DR: 0, ML: 0, MC: 0.1, MR: 0, AL: 0, AC: 0, AR: 0 },
  CB_C: { DL: 0, DC: 0.8, DR: 0, ML: 0, MC: 0.2, MR: 0, AL: 0, AC: 0, AR: 0 },
  LB: { DL: 0.45, DC: 0, DR: 0, ML: 0.4, MC: 0, MR: 0, AL: 0.15, AC: 0, AR: 0 },
  LWB: { DL: 0.3, DC: 0, DR: 0, ML: 0.4, MC: 0, MR: 0, AL: 0.3, AC: 0, AR: 0 },
  DM: { DL: 0, DC: 0.35, DR: 0, ML: 0.075, MC: 0.5, MR: 0.075, AL: 0, AC: 0, AR: 0 },
  CM_L: { DL: 0, DC: 0.1, DR: 0, ML: 0.2, MC: 0.45, MR: 0, AL: 0.1, AC: 0.15, AR: 0 },
  CM_C: { DL: 0, DC: 0.1, DR: 0, ML: 0.1, MC: 0.55, MR: 0.1, AL: 0, AC: 0.15, AR: 0 },
  AM: { DL: 0, DC: 0, DR: 0, ML: 0, MC: 0.25, MR: 0, AL: 0.125, AC: 0.5, AR: 0.125 },
  LM: { DL: 0.15, DC: 0, DR: 0, ML: 0.5, MC: 0, MR: 0, AL: 0.35, AC: 0, AR: 0 },
  LW: { DL: 0, DC: 0, DR: 0, ML: 0.3, MC: 0, MR: 0, AL: 0.55, AC: 0.15, AR: 0 },
  ST_L: { DL: 0, DC: 0, DR: 0, ML: 0, MC: 0.15, MR: 0, AL: 0.2, AC: 0.65, AR: 0 },
  ST_C: { DL: 0, DC: 0, DR: 0, ML: 0, MC: 0.15, MR: 0, AL: 0.1, AC: 0.65, AR: 0.1 },
};

function mirrorRow(row: ZoneWeights): ZoneWeights {
  return {
    DL: row.DR,
    DC: row.DC,
    DR: row.DL,
    ML: row.MR,
    MC: row.MC,
    MR: row.ML,
    AL: row.AR,
    AC: row.AC,
    AR: row.AL,
  };
}

export function getBaseRoleWeights(role: string): ZoneWeights {
  switch (role) {
    case 'GK':
      return BASE_INVOLVEMENT_ROWS.GK!;
    case 'LB':
      return BASE_INVOLVEMENT_ROWS.LB!;
    case 'RB':
      return mirrorRow(BASE_INVOLVEMENT_ROWS.LB!);
    case 'LWB':
      return BASE_INVOLVEMENT_ROWS.LWB!;
    case 'RWB':
      return mirrorRow(BASE_INVOLVEMENT_ROWS.LWB!);
    case 'LCB':
      return BASE_INVOLVEMENT_ROWS['CB_L']!;
    case 'RCB':
      return mirrorRow(BASE_INVOLVEMENT_ROWS['CB_L']!);
    case 'CB':
      return BASE_INVOLVEMENT_ROWS['CB_C']!;
    case 'DM':
    case 'LDM':
      return BASE_INVOLVEMENT_ROWS.DM!;
    case 'RDM':
      return mirrorRow(BASE_INVOLVEMENT_ROWS.DM!);
    case 'LCM':
      return BASE_INVOLVEMENT_ROWS['CM_L']!;
    case 'RCM':
      return mirrorRow(BASE_INVOLVEMENT_ROWS['CM_L']!);
    case 'CM':
      return BASE_INVOLVEMENT_ROWS['CM_C']!;
    case 'AM':
      return BASE_INVOLVEMENT_ROWS.AM!;
    case 'LM':
      return BASE_INVOLVEMENT_ROWS.LM!;
    case 'RM':
      return mirrorRow(BASE_INVOLVEMENT_ROWS.LM!);
    case 'LW':
      return BASE_INVOLVEMENT_ROWS.LW!;
    case 'RW':
      return mirrorRow(BASE_INVOLVEMENT_ROWS.LW!);
    case 'LST':
      return BASE_INVOLVEMENT_ROWS['ST_L']!;
    case 'RST':
      return mirrorRow(BASE_INVOLVEMENT_ROWS['ST_L']!);
    case 'ST':
    default:
      return BASE_INVOLVEMENT_ROWS['ST_C']!;
  }
}

export interface PlayerInvolvementParams {
  role: string;
  roleId?: RoleId;
  fit?: number;
  playerInstructions?: PlayerInstruction[];
  duty?: Duty;
  mentality: Mentality;
  width: Width;
}

export function computePlayerInvolvementFull(params: PlayerInvolvementParams): ZoneWeights {
  const {
    role,
    roleId,
    fit = 1.0,
    playerInstructions = [],
    duty = 'Support',
    mentality,
    width,
  } = params;

  const base = { ...getBaseRoleWeights(role) };
  if (role === 'GK') return base;

  const isCB = role.includes('CB');
  const mentFactor = isCB ? 0.075 : 0.15;

  // 1. Mentality Modifiers (SPEC §13.5)
  if (mentality === 'Attacking') {
    for (const lane of ['L', 'C', 'R'] as const) {
      const dKey = `D${lane}` as ZoneKey;
      const mKey = `M${lane}` as ZoneKey;
      const aKey = `A${lane}` as ZoneKey;

      const dMove = base[dKey] * mentFactor;
      const mMove = base[mKey] * mentFactor;
      base[dKey] -= dMove;
      base[mKey] += dMove - mMove;
      base[aKey] += mMove;
    }
  } else if (mentality === 'Defensive') {
    for (const lane of ['L', 'C', 'R'] as const) {
      const dKey = `D${lane}` as ZoneKey;
      const mKey = `M${lane}` as ZoneKey;
      const aKey = `A${lane}` as ZoneKey;

      const aMove = base[aKey] * mentFactor;
      const mMove = base[mKey] * mentFactor;
      base[aKey] -= aMove;
      base[mKey] += aMove - mMove;
      base[dKey] += mMove;
    }
  }

  // 2. Role Involvement Modifiers (SPEC §13.17.1 & §13.17.2)
  const gainScale = 0.4 + 0.6 * fit;
  const lane: 'L' | 'C' | 'R' = role.includes('L') ? 'L' : role.includes('R') ? 'R' : 'C';

  if (
    roleId &&
    roleId !== 'gk' &&
    roleId !== 'cb' &&
    roleId !== 'fb' &&
    roleId !== 'dm' &&
    roleId !== 'cm' &&
    roleId !== 'am' &&
    roleId !== 'wm' &&
    roleId !== 'wf' &&
    roleId !== 'st'
  ) {
    switch (roleId) {
      case 'fb_defensive': {
        for (const l of ['L', 'C', 'R'] as const) {
          const aMove = base[`A${l}` as ZoneKey] * 0.6;
          base[`A${l}` as ZoneKey] -= aMove;
          base[`D${l}` as ZoneKey] += aMove;

          const mMove = base[`M${l}` as ZoneKey] * 0.15;
          base[`M${l}` as ZoneKey] -= mMove;
          base[`D${l}` as ZoneKey] += mMove;
        }
        break;
      }
      case 'fb_overlapping': {
        for (const l of ['L', 'C', 'R'] as const) {
          const shift = base[`M${l}` as ZoneKey] * 0.25 * gainScale;
          base[`M${l}` as ZoneKey] -= shift;
          base[`A${l}` as ZoneKey] += shift;
        }
        break;
      }
      case 'fb_inverted': {
        const fromKey = `M${lane}` as ZoneKey;
        const shift = base[fromKey] * 0.4 * gainScale;
        base[fromKey] -= shift;
        base['MC'] += shift;
        break;
      }
      case 'anchor': {
        for (const l of ['L', 'C', 'R'] as const) {
          const mMove = base[`M${l}` as ZoneKey] * 0.2;
          base[`M${l}` as ZoneKey] -= mMove;
          base[`D${l}` as ZoneKey] += mMove;

          const aMove = base[`A${l}` as ZoneKey] * 0.5;
          base[`A${l}` as ZoneKey] -= aMove;
          base[`M${l}` as ZoneKey] += aMove;
        }
        break;
      }
      case 'box_to_box': {
        for (const l of ['L', 'C', 'R'] as const) {
          const shiftA = base[`M${l}` as ZoneKey] * 0.1 * gainScale;
          const shiftD = base[`M${l}` as ZoneKey] * 0.1 * gainScale;
          base[`M${l}` as ZoneKey] -= shiftA + shiftD;
          base[`A${l}` as ZoneKey] += shiftA;
          base[`D${l}` as ZoneKey] += shiftD;
        }
        break;
      }
      case 'runner': {
        for (const l of ['L', 'C', 'R'] as const) {
          const shift = base[`M${l}` as ZoneKey] * 0.25 * gainScale;
          base[`M${l}` as ZoneKey] -= shift;
          base['AC'] += shift;
        }
        break;
      }
      case 'shadow_striker': {
        for (const l of ['L', 'C', 'R'] as const) {
          const shift = base[`M${l}` as ZoneKey] * 0.3 * gainScale;
          base[`M${l}` as ZoneKey] -= shift;
          base[`A${l}` as ZoneKey] += shift;
        }
        break;
      }
      case 'wm_defensive': {
        for (const l of ['L', 'C', 'R'] as const) {
          const aMove = base[`A${l}` as ZoneKey] * 0.3;
          base[`A${l}` as ZoneKey] -= aMove;
          base[`M${l}` as ZoneKey] += aMove;

          const mMove = base[`M${l}` as ZoneKey] * 0.15;
          base[`M${l}` as ZoneKey] -= mMove;
          base[`D${l}` as ZoneKey] += mMove;
        }
        break;
      }
      case 'wide_playmaker': {
        const fromKey = `M${lane}` as ZoneKey;
        const shift = base[fromKey] * 0.25 * gainScale;
        base[fromKey] -= shift;
        base['MC'] += shift;
        break;
      }
      case 'winger': {
        for (const t of ['D', 'M', 'A'] as const) {
          const shift = base[`${t}C` as ZoneKey] * 0.25 * gainScale;
          base[`${t}C` as ZoneKey] -= shift;
          base[`${t}${lane}` as ZoneKey] += shift;
        }
        break;
      }
      case 'inside_forward': {
        const fromKey = `A${lane}` as ZoneKey;
        const shift = base[fromKey] * 0.3 * gainScale;
        base[fromKey] -= shift;
        base['AC'] += shift;
        break;
      }
      case 'poacher': {
        for (const l of ['L', 'C', 'R'] as const) {
          const shift = base[`M${l}` as ZoneKey] * 0.5 * gainScale;
          base[`M${l}` as ZoneKey] -= shift;
          base[`A${l}` as ZoneKey] += shift;
        }
        if (lane !== 'C') {
          const shiftLane = base[`A${lane}` as ZoneKey] * 0.2 * gainScale;
          base[`A${lane}` as ZoneKey] -= shiftLane;
          base['AC'] += shiftLane;
        }
        break;
      }
      case 'false_nine': {
        const shift = base['AC'] * 0.35 * gainScale;
        base['AC'] -= shift;
        base['MC'] += shift;
        break;
      }
    }
  } else {
    // 2b. Legacy Duty Modifiers
    const isForward = role.includes('ST') || role.includes('LW') || role.includes('RW');
    if (duty === 'Attack') {
      for (const l of ['L', 'C', 'R'] as const) {
        const mKey = `M${l}` as ZoneKey;
        const aKey = `A${l}` as ZoneKey;
        const shift = base[mKey] * 0.1;
        base[mKey] -= shift;
        base[aKey] += shift;
      }
    } else if (duty === 'Defend') {
      for (const l of ['L', 'C', 'R'] as const) {
        const dKey = `D${l}` as ZoneKey;
        const mKey = `M${l}` as ZoneKey;
        const aKey = `A${l}` as ZoneKey;
        const mShift = base[mKey] * 0.1;
        base[mKey] -= mShift;
        base[dKey] += mShift;
        if (isForward) {
          const aShift = base[aKey] * 0.1;
          base[aKey] -= aShift;
          base[mKey] += aShift;
        }
      }
    }
  }

  // 3. Player Instructions Involvement (SPEC §13.17.11)
  if (playerInstructions.includes('getForward')) {
    for (const l of ['L', 'C', 'R'] as const) {
      const mShift = base[`M${l}` as ZoneKey] * 0.2;
      base[`M${l}` as ZoneKey] -= mShift;
      base[`A${l}` as ZoneKey] += mShift;

      const dShift = base[`D${l}` as ZoneKey] * 0.15;
      base[`D${l}` as ZoneKey] -= dShift;
      base[`M${l}` as ZoneKey] += dShift;
    }
  }

  if (playerInstructions.includes('holdPosition')) {
    const mainThird: 'D' | 'M' | 'A' = role.includes('B')
      ? 'D'
      : role.includes('ST') || role.includes('W')
        ? 'A'
        : 'M';
    const otherThirds: ('D' | 'M' | 'A')[] = (['D', 'M', 'A'] as const).filter(
      (t) => t !== mainThird,
    );
    for (const ot of otherThirds) {
      for (const l of ['L', 'C', 'R'] as const) {
        const shift = base[`${ot}${l}` as ZoneKey] * 0.5;
        base[`${ot}${l}` as ZoneKey] -= shift;
        base[`${mainThird}${l}` as ZoneKey] += shift;
      }
    }
  }

  if (playerInstructions.includes('stayWider')) {
    if (lane !== 'C') {
      for (const t of ['D', 'M', 'A'] as const) {
        const shift = base[`${t}C` as ZoneKey] * 0.25;
        base[`${t}C` as ZoneKey] -= shift;
        base[`${t}${lane}` as ZoneKey] += shift;
      }
    }
  }

  // 4. Width Modifiers (SPEC §13.5)
  const isWide = ['LB', 'RB', 'LWB', 'RWB', 'LM', 'RM', 'LW', 'RW'].includes(role);
  if (isWide) {
    const l = role.startsWith('R') ? 'R' : 'L';
    if (width === 'Wide') {
      for (const t of ['D', 'M', 'A'] as const) {
        const cKey = `${t}C` as ZoneKey;
        const lKey = `${t}${l}` as ZoneKey;
        const shift = base[cKey] * 0.2;
        base[cKey] -= shift;
        base[lKey] += shift;
      }
    } else if (width === 'Narrow') {
      for (const t of ['D', 'M', 'A'] as const) {
        const cKey = `${t}C` as ZoneKey;
        const lKey = `${t}${l}` as ZoneKey;
        const shift = base[lKey] * 0.2;
        base[lKey] -= shift;
        base[cKey] += shift;
      }
    }
  }

  // 5. Renormalise to sum to 1.0 (SPEC §13.5)
  let total = 0;
  for (const v of Object.values(base)) {
    total += v;
  }
  if (total > 0) {
    for (const k of Object.keys(base) as ZoneKey[]) {
      base[k] = base[k] / total;
    }
  }

  return base;
}

export function computePlayerInvolvement(
  role: string,
  duty: Duty,
  mentality: Mentality,
  width: Width,
): ZoneWeights {
  return computePlayerInvolvementFull({
    role,
    duty,
    mentality,
    width,
  });
}

/**
 * Returns receiver weight multiplier based on roles, fit, player instructions and opposition orders
 */
export function getReceiverWeightMultiplier(params: {
  roleId: RoleId;
  fit: number;
  third: Third;
  isThroughBall?: boolean;
  playerInstructions?: PlayerInstruction[];
  isTightMarked?: boolean;
}): number {
  const {
    roleId,
    fit,
    third,
    isThroughBall = false,
    playerInstructions = [],
    isTightMarked = false,
  } = params;

  let mult = 1.0;
  const gainScale = 0.4 + 0.6 * fit;

  // Role receiver multipliers (SPEC §13.17.2)
  switch (roleId) {
    case 'deep_playmaker':
      if (third === 'DEF' || third === 'MID') {
        mult *= 1.0 + 0.3 * gainScale;
      }
      break;
    case 'playmaker':
      mult *= 1.0 + 0.25 * gainScale;
      break;
    case 'poacher':
      if (third !== 'ATT') {
        mult *= 0.5;
      }
      break;
    case 'false_nine':
      if (third === 'MID') {
        mult *= 1.0 + 0.2 * gainScale;
      }
      break;
    case 'advanced_forward':
      if (isThroughBall) {
        mult *= 1.0 + 0.4 * gainScale;
      }
      if (third === 'MID') {
        mult *= 0.7;
      }
      break;
  }

  // Opposition order: tightMark (SPEC §13.17.3)
  if (isTightMarked) {
    mult *= 0.55;
  }

  // Player Instruction: holdPosition (SPEC §13.17.11)
  if (playerInstructions.includes('holdPosition')) {
    mult *= 0.9;
  }

  return mult;
}

export function pickReceiver(
  zone: ZoneKey,
  onPitchPlayers: Array<{ id: PlayerId; role: string; duty: Duty }>,
  involvements: Map<PlayerId, ZoneWeights>,
  passerId: PlayerId | null,
  rng: Rng,
): PlayerId {
  const candidates = onPitchPlayers.filter((p) => p.id !== passerId);
  if (candidates.length === 0) return onPitchPlayers[0]!.id;

  const weights = candidates.map((p) => {
    const inv = involvements.get(p.id);
    return inv ? inv[zone] : 0.01;
  });

  return rng.weighted(candidates, (p) => {
    const idx = candidates.indexOf(p);
    return Math.max(0.0001, weights[idx]!);
  }).id;
}

export function pickPrimaryDefender(
  attackerZone: ZoneKey,
  inBox: boolean,
  onPitchDefenders: Array<{ id: PlayerId; role: string; duty: Duty }>,
  defenderInvolvements: Map<PlayerId, ZoneWeights>,
  rng: Rng,
): PlayerId {
  const mirroredZone = getMirroredZoneKey(attackerZone);

  // GK is only eligible if action is in the box (SPEC §13.5)
  const eligibleDefenders = onPitchDefenders.filter((p) => {
    if (p.role === 'GK') return inBox;
    return true;
  });

  if (eligibleDefenders.length === 0) return onPitchDefenders[0]!.id;

  return rng.weighted(eligibleDefenders, (p) => {
    const inv = defenderInvolvements.get(p.id);
    const w = inv ? inv[mirroredZone] : 0.01;
    return Math.max(0.0001, w);
  }).id;
}

export function getInvolvementWeights(params: {
  role: string;
  mentality: Mentality;
  duty: Duty;
  width: Width;
}): Record<'DEF' | 'MID' | 'ATT', Record<'Left' | 'Centre' | 'Right', number>> {
  const inv = computePlayerInvolvement(params.role, params.duty, params.mentality, params.width);
  return {
    DEF: { Left: inv.DL, Centre: inv.DC, Right: inv.DR },
    MID: { Left: inv.ML, Centre: inv.MC, Right: inv.MR },
    ATT: { Left: inv.AL, Centre: inv.AC, Right: inv.AR },
  };
}

export function selectReceiver(
  candidates: Array<{ id: PlayerId; weight: number }>,
  rng: Rng,
): PlayerId {
  if (candidates.length === 0) throw new Error('No receiver candidates');
  return rng.weighted(candidates, (c) => Math.max(0.0001, c.weight)).id;
}

export function selectPrimaryDefender(
  candidates: Array<{ id: PlayerId; weight: number; isGk: boolean }>,
  inBox: boolean,
  rng: Rng,
): PlayerId | null {
  const eligible = candidates.filter((c) => !c.isGk || inBox);
  if (eligible.length === 0) return candidates[0]?.id ?? null;
  return rng.weighted(eligible, (c) => Math.max(0.0001, c.weight)).id;
}
