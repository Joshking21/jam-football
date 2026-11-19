// Implements SPEC §13.7, §13.8 Set Pieces (Corners, Penalties, Free Kicks, Goal Kicks, Throw-ins, Kick-offs)
import { PlayerId, ShotContext, Attributes } from '../types';
import { z, sigmoid } from '../math';
import { Rng } from '../rng';
import { K } from '@/config/balance';
import { resolveShot, ShotResolutionResult } from './shots';

export interface SetPiecePlayer {
  id: PlayerId;
  name: string;
  slot: number;
  attributes: Attributes;
  condition: number;
  morale: number;
  isCbOrSt?: boolean;
}

export interface CornerResult {
  outcome: 'CLAIM' | 'CLEARANCE' | 'CORNER_AGAIN' | 'SHOT';
  shotResult?: ShotResolutionResult;
  shotContext?: ShotContext;
  headerAttackerId?: PlayerId;
  defenderId?: PlayerId;
  secondBallSide?: 'ATTACKING' | 'DEFENDING'; // if CLEARANCE
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
    rng,
  } = params;

  // 1. GK Claim
  const pClaim =
    K.intercepts.gkClaimBase + K.intercepts.gkClaimSlope * z(goalkeeper.attributes.aerialCommand);
  if (rng.chance(pClaim)) {
    return { outcome: 'CLAIM' };
  }

  // 2. Delivery
  const pDelivery = sigmoid(
    K.intercepts.crossDelivery + 0.8 * z(taker.attributes.setPieces) + trainingBonusSetPieces,
  );
  if (!rng.chance(pDelivery)) {
    // 25% of delivery failures become another corner
    if (rng.chance(0.25)) {
      return { outcome: 'CORNER_AGAIN' };
    }
    return { outcome: 'CLEARANCE', secondBallSide: 'DEFENDING' };
  }

  // 3. Header Duel Target Selection
  // Pick attacker weighted by heading, with CB/ST x1.3
  const attackerWeights = attackersInBox.map((p) => {
    const base = Math.max(1, p.attributes.heading);
    return p.isCbOrSt ? base * 1.3 : base;
  });
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

  // Pick defender weighted by heading
  const defWeights = defendersInBox.map((p) => Math.max(1, p.attributes.heading));
  const totalDefWeight = defWeights.reduce((a, b) => a + b, 0);
  let rollDef = rng.next() * totalDefWeight;
  let targetDef = defendersInBox[0] ?? null;
  for (let i = 0; i < defendersInBox.length; i++) {
    rollDef -= defWeights[i]!;
    if (rollDef <= 0) {
      targetDef = defendersInBox[i]!;
      break;
    }
  }

  // Aerial Duel Contest
  // S_air = heading .6, strength .4
  const sAirAtt =
    0.6 * z(targetAtt.attributes.heading) + 0.4 * z(targetAtt.attributes.strength) + homeAdvantage;
  const defAdv = defenderHomeAdvantage ?? 0;
  const sAirDef = targetDef
    ? 0.5 * z(targetDef.attributes.heading) +
      0.3 * z(targetDef.attributes.strength) +
      0.2 * z(targetDef.attributes.positioning) +
      defAdv
    : 0;

  const pWin = sigmoid(K.intercepts.crossHeader + 0.8 * sAirAtt - 0.8 * sAirDef);
  if (rng.chance(pWin)) {
    // Attacker wins header! 40% on the ground (BOX_CENTRAL), 60% HEADER
    const shotContext: ShotContext = rng.chance(0.4) ? 'BOX_CENTRAL' : 'HEADER';
    const shotResult = resolveShot({
      context: shotContext,
      attacker: targetAtt,
      goalkeeper,
      defender: targetDef,
      trainingBonus: trainingBonusAttack,
      homeAdvantage,
      defenderHomeAdvantage: defAdv,
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

  // Defender cleared: 40% second ball to MID Centre (attackers), 60% defenders
  const secondBallSide = rng.chance(0.4) ? 'ATTACKING' : 'DEFENDING';
  return {
    outcome: 'CLEARANCE',
    defenderId: targetDef?.id,
    secondBallSide,
  };
}
