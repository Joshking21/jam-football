// Implements SPEC §13.8 Shots Resolution, xG, and Outcomes
import { ShotContext, Player, RoleId } from '../types';
import { z, sigmoid, logit, clamp } from '../math';
import { Rng } from '../rng';
import { K } from '@/config/balance';

export interface ShotResolutionResult {
  outcome:
    | 'GOAL'
    | 'SAVE_CATCH'
    | 'SAVE_PARRY_CORNER'
    | 'SAVE_PARRY_REBOUND'
    | 'SAVE_PARRY_CLEAR'
    | 'BLOCK_CORNER'
    | 'BLOCK_RECYCLE'
    | 'BLOCK_CLEAR'
    | 'POST_REBOUND'
    | 'POST_GOAL_KICK'
    | 'MISS';
  xg: number;
  onTarget: boolean;
  bodyPart: 'Foot' | 'Head';
  target: { y: number; z: number };
}

export interface ShotParams {
  context: ShotContext;
  attacker: Pick<Player, 'attributes' | 'condition' | 'morale'>;
  goalkeeper: Pick<Player, 'attributes' | 'condition' | 'morale'>;
  defender: Pick<Player, 'attributes' | 'condition' | 'morale'> | null;
  trainingBonus: number;
  homeAdvantage: number; // +0.06 for home attacker
  defenderHomeAdvantage?: number; // +0.06 for home defender/keeper
  rng: Rng;

  // Tactical Depth (§13.17)
  attackerRole?: RoleId;
  attackerFit?: number;
  isSweeperKeeperOpponent?: boolean;
  extraXgRefAdd?: number;
  attackerCtxModifier?: number;
}

const SHOT_CONTEXT_DATA: Record<
  ShotContext,
  {
    xgRef: number;
    blockProb: number;
    weights: {
      finishing?: number;
      setPieces?: number;
      composure: number;
      heading?: number;
      longShots?: number;
    };
    bodyPart: 'Foot' | 'Head';
  }
> = {
  PENALTY: {
    xgRef: 0.76,
    blockProb: 0,
    weights: { setPieces: 0.4, finishing: 0.3, composure: 0.3 },
    bodyPart: 'Foot',
  },
  ONE_ON_ONE: {
    xgRef: 0.38,
    blockProb: 0.05,
    weights: { finishing: 0.5, composure: 0.5 },
    bodyPart: 'Foot',
  },
  SIX_YARD: {
    xgRef: 0.35,
    blockProb: 0.08,
    weights: { finishing: 0.7, composure: 0.3 },
    bodyPart: 'Foot',
  },
  BOX_CENTRAL: {
    xgRef: 0.16,
    blockProb: 0.18,
    weights: { finishing: 0.6, composure: 0.4 },
    bodyPart: 'Foot',
  },
  BOX_WIDE: {
    xgRef: 0.07,
    blockProb: 0.18,
    weights: { finishing: 0.6, composure: 0.4 },
    bodyPart: 'Foot',
  },
  HEADER: {
    xgRef: 0.11,
    blockProb: 0.1,
    weights: { heading: 0.7, composure: 0.3 },
    bodyPart: 'Head',
  },
  REBOUND: {
    xgRef: 0.25,
    blockProb: 0.1,
    weights: { finishing: 0.6, composure: 0.4 },
    bodyPart: 'Foot',
  },
  OUTSIDE_CENTRAL: {
    xgRef: 0.035,
    blockProb: 0.28,
    weights: { longShots: 0.7, composure: 0.3 },
    bodyPart: 'Foot',
  },
  OUTSIDE_WIDE: {
    xgRef: 0.02,
    blockProb: 0.28,
    weights: { longShots: 0.7, composure: 0.3 },
    bodyPart: 'Foot',
  },
  DIRECT_FK: {
    xgRef: 0.06,
    blockProb: 0.2,
    weights: { setPieces: 0.8, composure: 0.2 },
    bodyPart: 'Foot',
  },
};

function computeAttackerSkill(
  attacker: Pick<Player, 'attributes' | 'condition' | 'morale'>,
  context: ShotContext,
): number {
  const data = SHOT_CONTEXT_DATA[context];
  const { attributes, condition, morale } = attacker;

  let s = 0;
  if (data.weights.finishing) s += data.weights.finishing * z(attributes.finishing);
  if (data.weights.setPieces) s += data.weights.setPieces * z(attributes.setPieces);
  if (data.weights.heading) s += data.weights.heading * z(attributes.heading);
  if (data.weights.longShots) s += data.weights.longShots * z(attributes.longShots);
  s += data.weights.composure * z(attributes.composure);

  // Condition & morale modifiers
  if (condition < 70) s -= (70 - condition) / 100;
  s += 0.1 * ((morale - 50) / 50);

  return s;
}

function computeKeeperSkill(
  gk: Pick<Player, 'attributes' | 'condition' | 'morale'>,
  context: ShotContext,
): number {
  const { attributes, condition, morale } = gk;
  let s = 0;
  if (context === 'ONE_ON_ONE' || context === 'PENALTY') {
    s = 0.6 * z(attributes.oneOnOnes) + 0.4 * z(attributes.reflexes);
  } else if (context === 'HEADER') {
    s = 0.6 * z(attributes.reflexes) + 0.4 * z(attributes.aerialCommand);
  } else {
    s = 0.6 * z(attributes.reflexes) + 0.2 * z(attributes.handling) + 0.2 * z(attributes.oneOnOnes);
  }

  if (condition < 70) s -= (70 - condition) / 100;
  s += 0.1 * ((morale - 50) / 50);

  return s;
}

export function resolveShot(params: ShotParams): ShotResolutionResult {
  const {
    context,
    attacker,
    goalkeeper,
    defender,
    trainingBonus,
    homeAdvantage,
    defenderHomeAdvantage,
    rng,
    attackerRole,
    attackerFit = 1.0,
    isSweeperKeeperOpponent = false,
    extraXgRefAdd = 0,
    attackerCtxModifier = 0,
  } = params;
  const data = SHOT_CONTEXT_DATA[context];

  let xgRef = data.xgRef + extraXgRefAdd;
  if (isSweeperKeeperOpponent && context === 'OUTSIDE_CENTRAL') {
    xgRef += 0.02;
  }

  const defAdv = defenderHomeAdvantage ?? 0;
  let sFin = computeAttackerSkill(attacker, context) + homeAdvantage;

  // Poacher bonus (§13.17.2)
  if (attackerRole === 'poacher' && (context === 'SIX_YARD' || context === 'BOX_CENTRAL')) {
    sFin += 0.15 * (0.4 + 0.6 * attackerFit);
  }

  const sGk = computeKeeperSkill(goalkeeper, context) + defAdv;

  let defCover = 0;
  if (defender && context !== 'PENALTY') {
    defCover = K.coefficients.shotCover * (z(defender.attributes.positioning) + defAdv);
  }

  const ctx = trainingBonus + defCover + attackerCtxModifier;
  const pGoalRaw = sigmoid(
    logit(xgRef) + K.coefficients.shotFinishing * sFin - K.coefficients.shotGoalkeeper * sGk + ctx,
  );

  // 1. Block resolution
  let pBlock = 0;
  if (data.blockProb > 0 && defender) {
    pBlock = Math.max(0, data.blockProb + 0.05 * z(defender.attributes.positioning));
  }

  if (pBlock > 0 && rng.chance(pBlock)) {
    const roll = rng.next();
    const outcome = roll < 0.45 ? 'BLOCK_CORNER' : roll < 0.65 ? 'BLOCK_RECYCLE' : 'BLOCK_CLEAR';
    return {
      outcome,
      xg: xgRef,
      onTarget: false,
      bodyPart: data.bodyPart,
      target: {
        y: rng.normal(0, 1.5),
        z: clamp(rng.normal(0.8, 0.4), 0, 2.0),
      },
    };
  }

  // 2. Goal check
  const pGoalAdjusted = Math.min(0.95, pGoalRaw / (1 - pBlock));
  if (rng.chance(pGoalAdjusted)) {
    return {
      outcome: 'GOAL',
      xg: xgRef,
      onTarget: true,
      bodyPart: data.bodyPart,
      target: {
        y: (rng.chance(0.5) ? -1 : 1) * rng.normal(2.5, 0.6), // placed into corners
        z: clamp(rng.normal(1.2, 0.6), 0.2, 2.3),
      },
    };
  }

  // 3. On-target check (Save)
  const pOnTarget = clamp(0.26 + 0.08 * sFin, 0.2, 0.4);
  if (rng.chance(pOnTarget)) {
    const pCatch = sigmoid(0.0 + 0.8 * z(goalkeeper.attributes.handling));
    if (rng.chance(pCatch)) {
      return {
        outcome: 'SAVE_CATCH',
        xg: xgRef,
        onTarget: true,
        bodyPart: data.bodyPart,
        target: {
          y: rng.normal(0, 1.2),
          z: clamp(rng.normal(1.0, 0.5), 0.2, 2.2),
        },
      };
    }
    // Parry
    const roll = rng.next();
    const outcome =
      roll < 0.55 ? 'SAVE_PARRY_CORNER' : roll < 0.7 ? 'SAVE_PARRY_REBOUND' : 'SAVE_PARRY_CLEAR';
    return {
      outcome,
      xg: xgRef,
      onTarget: true,
      bodyPart: data.bodyPart,
      target: {
        y: (rng.chance(0.5) ? -1 : 1) * rng.normal(2.2, 0.8),
        z: clamp(rng.normal(1.4, 0.5), 0.3, 2.3),
      },
    };
  }

  // 4. Miss / Post
  if (rng.chance(0.06)) {
    const outcome = rng.chance(0.5) ? 'POST_REBOUND' : 'POST_GOAL_KICK';
    const isCrossbar = rng.chance(0.35);
    return {
      outcome,
      xg: xgRef,
      onTarget: false,
      bodyPart: data.bodyPart,
      target: isCrossbar
        ? { y: rng.normal(0, 2.0), z: 2.44 }
        : { y: (rng.chance(0.5) ? -1 : 1) * 3.66, z: clamp(rng.normal(1.2, 0.6), 0.2, 2.4) },
    };
  }

  // Normal off-target miss
  return {
    outcome: 'MISS',
    xg: xgRef,
    onTarget: false,
    bodyPart: data.bodyPart,
    target: {
      y: (rng.chance(0.5) ? -1 : 1) * (3.66 + rng.normal(1.5, 0.8)),
      z: clamp(2.44 + rng.normal(1.0, 0.6), 0, 4.5),
    },
  };
}
