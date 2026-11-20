// Implements SPEC §13.7, §13.8 Set Pieces & §13.17.5 Corner Routines
import { PlayerId, ShotContext, Attributes, CornersFor, CornersAgainst } from '../types';
import { z, sigmoid } from '../math';
import { Rng } from '../rng';
import { K } from '@/config/balance';
import { resolveShot, ShotResolutionResult } from './shots';

export interface SetPiecePlayer {
  id: PlayerId;
  name?: string;
  slot?: number;
  attributes: Attributes;
  condition: number;
  morale: number;
  isCbOrSt?: boolean;
}

export interface CornerResult {
  outcome: 'CLAIM' | 'CLEARANCE' | 'CORNER_AGAIN' | 'SHOT' | 'SHORT' | 'PENALTY';
  shotResult?: ShotResolutionResult;
  shotContext?: ShotContext;
  headerAttackerId?: PlayerId;
  defenderId?: PlayerId;
  secondBallSide?: 'ATTACKING' | 'DEFENDING'; // if CLEARANCE
  foulPenalty?: boolean;
}

export function resolveCorner(params: {
  taker: SetPiecePlayer;
  goalkeeper: SetPiecePlayer;
  attackersInBox: SetPiecePlayer[];
  defendersInBox: SetPiecePlayer[];
  trainingBonusAttack: number;
  trainingBonusSetPieces: number;
  homeAdvantage: number;
  defenderHomeAdvantage?: number;
  cornersFor?: CornersFor;
  cornersAgainst?: CornersAgainst;
  rng: Rng;
}): CornerResult {
  const {
    taker,
    goalkeeper,
    attackersInBox,
    defendersInBox,
    trainingBonusAttack,
    trainingBonusSetPieces,
    homeAdvantage,
    defenderHomeAdvantage,
    cornersFor = 'Mixed',
    cornersAgainst = 'Mixed',
    rng,
  } = params;

  // Short corner routine (§13.17.5): keep ball in ATT wide outside box
  if (cornersFor === 'Short') {
    return { outcome: 'SHORT' };
  }

  // Defending routine: Man-mark penalty foul risk in box (§13.17.5)
  if (cornersAgainst === 'ManMark' && rng.chance(K.setp.cornersAgainst.manMark.penaltyFoulRate)) {
    return { outcome: 'PENALTY', foulPenalty: true };
  }

  // 1. GK Claim
  let claimMod = 0;
  if (cornersFor === 'NearPost') claimMod -= 0.04;
  else if (cornersFor === 'FarPost') claimMod += 0.03;

  const pClaim = Math.max(
    0.01,
    K.intercepts.gkClaimBase +
      K.intercepts.gkClaimSlope * z(goalkeeper.attributes.aerialCommand) +
      claimMod,
  );
  if (rng.chance(pClaim)) {
    return { outcome: 'CLAIM' };
  }

  // 2. Delivery
  let delivCtx = 0;
  if (cornersFor === 'NearPost') delivCtx -= 0.1;
  if (cornersAgainst === 'Zonal' && cornersFor === 'NearPost') delivCtx -= 0.15;

  const pDelivery = sigmoid(
    K.intercepts.crossDelivery +
      0.8 * z(taker.attributes.setPieces) +
      trainingBonusSetPieces +
      delivCtx,
  );
  if (!rng.chance(pDelivery)) {
    // 25% of delivery failures become another corner
    if (rng.chance(0.25)) {
      return { outcome: 'CORNER_AGAIN' };
    }
    return { outcome: 'CLEARANCE', secondBallSide: 'DEFENDING' };
  }

  // 3. Header Duel Target Selection
  // Pick attacker
  const attackerWeights = attackersInBox.map((p) => {
    if (cornersFor === 'NearPost') {
      return Math.max(1, p.attributes.heading * 0.5 + p.attributes.pace * 0.5);
    }
    const base = Math.max(1, p.attributes.heading);
    return p.isCbOrSt ? base * 1.3 : base;
  });

  if (cornersFor === 'FarPost') {
    let bestIdx = 0;
    let maxH = -1;
    for (let i = 0; i < attackersInBox.length; i++) {
      if (attackersInBox[i]!.attributes.heading > maxH) {
        maxH = attackersInBox[i]!.attributes.heading;
        bestIdx = i;
      }
    }
    if (attackerWeights[bestIdx] !== undefined) {
      attackerWeights[bestIdx]! *= 1.5;
    }
  }

  const totalAttWeight = attackerWeights.reduce((a, b) => a + b, 0);
  let rollAtt = rng.next() * totalAttWeight;
  let targetAtt = attackersInBox[0]!;
  for (let i = 0; i < attackersInBox.length; i++) {
    rollAtt -= attackerWeights[i]!;
    if (rollAtt <= 0) {
      targetAtt = attackersInBox[i]!;
      break;
    }
  }

  // Pick defender
  let targetDef: SetPiecePlayer | null = defendersInBox[0] ?? null;
  if (cornersAgainst === 'ManMark') {
    // Best header defender matched to their target
    let bestDef = defendersInBox[0] ?? null;
    let maxHeading = -1;
    for (const d of defendersInBox) {
      if (d.attributes.heading > maxHeading) {
        maxHeading = d.attributes.heading;
        bestDef = d;
      }
    }
    targetDef = bestDef;
  } else {
    const defWeights = defendersInBox.map((p) => Math.max(1, p.attributes.heading));
    const totalDefWeight = defWeights.reduce((a, b) => a + b, 0);
    let rollDef = rng.next() * totalDefWeight;
    for (let i = 0; i < defendersInBox.length; i++) {
      rollDef -= defWeights[i]!;
      if (rollDef <= 0) {
        targetDef = defendersInBox[i]!;
        break;
      }
    }
  }

  // Aerial Duel Contest
  let duelMod = 0;
  if (cornersFor === 'FarPost') duelMod += K.setp.cornersFor.farPost.headerDuel;
  if (cornersAgainst === 'Zonal' && cornersFor === 'FarPost')
    duelMod += K.setp.cornersAgainst.zonal.oppFarPostHeaderDuel;
  if (cornersAgainst === 'ManMark') duelMod += K.setp.cornersAgainst.manMark.oppHeaderDuel;

  const sAirAtt =
    0.6 * z(targetAtt.attributes.heading) +
    0.4 * z(targetAtt.attributes.strength) +
    homeAdvantage +
    duelMod;
  const defAdv = defenderHomeAdvantage ?? 0;
  const sAirDef = targetDef
    ? 0.5 * z(targetDef.attributes.heading) +
      0.3 * z(targetDef.attributes.strength) +
      0.2 * z(targetDef.attributes.positioning) +
      defAdv
    : 0;

  const pWin = sigmoid(K.intercepts.crossHeader + 0.8 * sAirAtt - 0.8 * sAirDef);
  if (rng.chance(pWin)) {
    const shotContext: ShotContext = rng.chance(0.4) ? 'BOX_CENTRAL' : 'HEADER';
    const extraXg = cornersFor === 'NearPost' ? 0.02 : 0; // xgRef 0.13 vs 0.11
    const shotResult = resolveShot({
      context: shotContext,
      attacker: targetAtt,
      goalkeeper,
      defender: targetDef,
      trainingBonus: trainingBonusAttack,
      homeAdvantage,
      defenderHomeAdvantage: defAdv,
      extraXgRefAdd: extraXg,
      rng,
    });
    return {
      outcome: 'SHOT',
      shotResult,
      shotContext,
      headerAttackerId: targetAtt.id,
      defenderId: targetDef?.id,
    };
  }

  // Defender cleared
  const secondBallSide = rng.chance(0.4) ? 'ATTACKING' : 'DEFENDING';
  return {
    outcome: 'CLEARANCE',
    defenderId: targetDef?.id,
    secondBallSide,
  };
}
