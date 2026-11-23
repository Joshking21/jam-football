// Implements SPEC §13.7, §13.8 Set Pieces, §13.17.5 Corner Routines, §13.18.8 Extended Set Pieces & §13.20 Detailed Set Pieces
import {
  PlayerId,
  ShotContext,
  Attributes,
  CornersFor,
  CornersAgainst,
  CornerSwing,
  MenBack,
  PostMen,
  CornerJob,
  CornerRoutine,
  CornerTarget,
  CornerSwingChoice,
  SetPieceTactics,
  ForwardsUp,
  WallOption,
  LineHeightOption,
  Player,
} from '../types';
import { z, sigmoid, clamp } from '../math';
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
  foot?: 'Left' | 'Right' | 'Both';
  isCbOrSt?: boolean;
}

export interface CornerResult {
  outcome: 'CLAIM' | 'CLEARANCE' | 'CORNER_AGAIN' | 'SHOT' | 'SHORT' | 'PENALTY';
  shotResult?: ShotResolutionResult;
  shotContext?: ShotContext;
  headerAttackerId?: PlayerId;
  defenderId?: PlayerId;
  secondBallSide?: 'ATTACKING' | 'DEFENDING'; // if CLEARANCE
  secondBallAttackerId?: PlayerId;
  isSecondBallEdgeShot?: boolean;
  foulPenalty?: boolean;
}

/**
 * Creates default set piece tactics adhering to SPEC §13.20.
 * Left and right corners have 3 default routines (Near-post flick, Big man far post, Short)
 * with familiarity 70, Auto wall, 1 forward up, and Keep deep free kicks.
 */
export function createDefaultSetPieceTactics(): SetPieceTactics {
  const defaultRoutines = (): CornerRoutine[] => [
    {
      id: 'routine_near',
      name: 'Near-post flick',
      target: 'Near',
      swing: 'Auto',
      jobs: {},
      familiarity: K.sp.sharpness.baselineFamiliarity,
    },
    {
      id: 'routine_far',
      name: 'Big man far post',
      target: 'Far',
      swing: 'Auto',
      jobs: {},
      familiarity: K.sp.sharpness.baselineFamiliarity,
    },
    {
      id: 'routine_short',
      name: 'Short',
      target: 'Short',
      swing: 'Auto',
      jobs: {},
      familiarity: K.sp.sharpness.baselineFamiliarity,
    },
  ];

  return {
    leftCorners: {
      routines: defaultRoutines(),
      activeRoutine: 0,
      rotate: false,
    },
    rightCorners: {
      routines: defaultRoutines(),
      activeRoutine: 0,
      rotate: false,
    },
    freeKicks: {
      central: 'Mixed',
      wide: 'Mixed',
      deep: 'Keep',
    },
    defending: {
      cornersAgainst: 'Mixed',
      markMainMan: 'Auto',
      postMen: 'None',
      edgeGuard: false,
      forwardsUp: 1,
      wall: 'Auto',
      lineHeight: 'Normal',
    },
    takers: {
      leftCorner: null,
      rightCorner: null,
      directFreeKick: null,
      wideFreeKick: null,
      penalties: [null, null, null],
      longThrow: null,
    },
  };
}

/**
 * Generates auto corner jobs for outfield players (slots 1..10) per SPEC §13.20.1:
 * - Best 2 by S_air go to target zone
 * - Next best to the other post
 * - Best long-range shooter to edge
 * - Two slowest defenders to stayBack (2)
 * - Rest stay in their spots outside the box
 */
export function generateAutoCornerJobs(
  lineup: (Pick<Player, 'id' | 'attributes'> | null)[],
  target: CornerTarget,
): Record<number, CornerJob> {
  const jobs: Record<number, CornerJob> = {};

  // Outfield slots (1..10)
  const outfieldSlots: number[] = [];
  for (let i = 1; i <= 10; i++) {
    if (lineup[i]) outfieldSlots.push(i);
  }
  if (outfieldSlots.length === 0) return jobs;

  // 1. Two slowest defenders go to stayBack (2)
  const sortedByPace = [...outfieldSlots].sort((a, b) => {
    const pA = lineup[a]!.attributes.pace;
    const pB = lineup[b]!.attributes.pace;
    return pA - pB;
  });

  const stayBackCount = Math.min(2, sortedByPace.length);
  const stayBackSlots = new Set<number>();
  for (let i = 0; i < stayBackCount; i++) {
    const slot = sortedByPace[i]!;
    jobs[slot] = 'stayBack';
    stayBackSlots.add(slot);
  }

  const remaining = outfieldSlots.filter((s) => !stayBackSlots.has(s));
  if (remaining.length === 0) return jobs;

  // 2. Best long-range shooter to edge (1)
  const sortedByLongShots = [...remaining].sort((a, b) => {
    const scoreA = lineup[a]!.attributes.longShots * 0.7 + lineup[a]!.attributes.composure * 0.3;
    const scoreB = lineup[b]!.attributes.longShots * 0.7 + lineup[b]!.attributes.composure * 0.3;
    return scoreB - scoreA;
  });

  const edgeSlot = sortedByLongShots[0]!;
  jobs[edgeSlot] = 'edge';
  const remainingForBox = remaining.filter((s) => s !== edgeSlot);

  // 3. Aerial ranking (S_air)
  const sortedByAir = [...remainingForBox].sort((a, b) => {
    const airA = 0.6 * lineup[a]!.attributes.heading + 0.4 * lineup[a]!.attributes.strength;
    const airB = 0.6 * lineup[b]!.attributes.heading + 0.4 * lineup[b]!.attributes.strength;
    return airB - airA;
  });

  if (target === 'Near') {
    if (sortedByAir[0] !== undefined) jobs[sortedByAir[0]] = 'nearPost';
    if (sortedByAir[1] !== undefined) jobs[sortedByAir[1]] = 'nearPost';
    if (sortedByAir[2] !== undefined) jobs[sortedByAir[2]] = 'farPost';
  } else if (target === 'Far') {
    if (sortedByAir[0] !== undefined) jobs[sortedByAir[0]] = 'farPost';
    if (sortedByAir[1] !== undefined) jobs[sortedByAir[1]] = 'farPost';
    if (sortedByAir[2] !== undefined) jobs[sortedByAir[2]] = 'nearPost';
  } else if (target === 'Spot') {
    if (sortedByAir[0] !== undefined) jobs[sortedByAir[0]] = 'penaltySpot';
    if (sortedByAir[1] !== undefined) jobs[sortedByAir[1]] = 'penaltySpot';
    if (sortedByAir[2] !== undefined) jobs[sortedByAir[2]] = 'nearPost';
    if (sortedByAir[3] !== undefined) jobs[sortedByAir[3]] = 'farPost';
  } else if (target === 'Short') {
    if (sortedByAir[0] !== undefined) jobs[sortedByAir[0]] = 'short';
    if (sortedByAir[1] !== undefined) jobs[sortedByAir[1]] = 'nearPost';
    if (sortedByAir[2] !== undefined) jobs[sortedByAir[2]] = 'farPost';
  } else {
    // Mixed
    if (sortedByAir[0] !== undefined) jobs[sortedByAir[0]] = 'nearPost';
    if (sortedByAir[1] !== undefined) jobs[sortedByAir[1]] = 'farPost';
    if (sortedByAir[2] !== undefined) jobs[sortedByAir[2]] = 'penaltySpot';
  }

  return jobs;
}

/**
 * Computes corner swing from taker foot and routine swing (§13.20.3):
 * - Auto (default):
 *   - Right foot from Left corner -> Inswinger; Left foot -> Outswinger
 *   - Left foot from Right corner -> Inswinger; Right foot -> Outswinger
 *   - Both-footed -> routine's swing, or Inswinger by default
 * - Forced swing: if routine forces In or Out against taker foot, delivery ctx -0.08
 */
export function computeCornerSwing(
  side: 'left' | 'right',
  foot: 'Left' | 'Right' | 'Both' = 'Right',
  routineSwing: CornerSwingChoice = 'Auto',
): {
  effectiveSwing: CornerSwing;
  forcedPenalty: boolean;
  deliveryCtxMod: number;
} {
  if (routineSwing === 'In') {
    const forced = (side === 'left' && foot === 'Left') || (side === 'right' && foot === 'Right');
    return {
      effectiveSwing: 'Inswinger',
      forcedPenalty: forced,
      deliveryCtxMod: forced ? K.sp.swing.forcedPenaltyDeliveryCtx : 0,
    };
  }

  if (routineSwing === 'Out') {
    const forced = (side === 'left' && foot === 'Right') || (side === 'right' && foot === 'Left');
    return {
      effectiveSwing: 'Outswinger',
      forcedPenalty: forced,
      deliveryCtxMod: forced ? K.sp.swing.forcedPenaltyDeliveryCtx : 0,
    };
  }

  // Auto swing based on foot
  let effectiveSwing: CornerSwing = 'Inswinger';
  if (side === 'left') {
    effectiveSwing = foot === 'Left' ? 'Outswinger' : 'Inswinger';
  } else {
    effectiveSwing = foot === 'Right' ? 'Outswinger' : 'Inswinger';
  }

  return {
    effectiveSwing,
    forcedPenalty: false,
    deliveryCtxMod: 0,
  };
}

/**
 * Predictability modifier (§13.20.2):
 * In a match, the n-th use of the same routine gives defenders header duel +0.04 * (n - 1), capped at +0.12.
 */
export function calculateRoutinePredictability(usesInMatch: number): number {
  if (usesInMatch <= 1) return 0;
  return Math.min(K.sp.predictability.duelCap, K.sp.predictability.duelPerUse * (usesInMatch - 1));
}

/**
 * Routine sharpness delivery context (§13.20.2):
 * delivery ctx (familiarity - 70) / 300 (range ±0.1)
 */
export function calculateRoutineSharpnessCtx(familiarity: number): number {
  const diff = familiarity - K.sp.sharpness.baselineFamiliarity;
  const raw = diff / K.sp.sharpness.deliveryCtxDivisor;
  return clamp(raw, -K.sp.sharpness.deliveryCtxCap, K.sp.sharpness.deliveryCtxCap);
}

/**
 * Resolves wall block probability and cross duel modifier (§13.20.6)
 */
export function calculateWallEffect(
  wall: WallOption,
  wallDefenders: SetPiecePlayer[],
): {
  blockProb: number;
  xgRefAdd: number;
  oppCrossHeaderDuelAdd: number;
} {
  const wallConfig = K.sp.defendingFreeKicks.wall;
  const cfg =
    wall === 'Small' ? wallConfig.small : wall === 'Big' ? wallConfig.big : wallConfig.auto;

  let meanZ = 0;
  if (wallDefenders.length > 0) {
    const sum = wallDefenders.reduce(
      (acc, d) => acc + (z(d.attributes.heading) + z(d.attributes.strength)) * 0.5,
      0,
    );
    meanZ = sum / wallDefenders.length;
  }

  const blockProb = clamp(cfg.blockProb + wallConfig.wallZBonusFactor * meanZ, 0.05, 0.5);

  return {
    blockProb,
    xgRefAdd: cfg.xgRefAdd,
    oppCrossHeaderDuelAdd: cfg.oppCrossHeaderDuelAdd,
  };
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
  cornerSwing?: CornerSwing;
  menBack?: MenBack;
  postMen?: PostMen;
  // SPEC §13.20 additions
  routine?: CornerRoutine;
  routineUsesInMatch?: number;
  edgeGuard?: boolean;
  forwardsUp?: ForwardsUp;
  markMainManId?: PlayerId | 'Auto' | null;
  cornerSide?: 'left' | 'right';
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
    cornersFor: legacyCornersFor = 'Mixed',
    cornersAgainst = 'Mixed',
    cornerSwing: legacyCornerSwing = 'Mixed',
    menBack: legacyMenBack = 2,
    postMen = 'None',
    routine,
    routineUsesInMatch = 1,
    edgeGuard = false,
    forwardsUp = 1,
    markMainManId = 'Auto',
    cornerSide = 'left',
    rng,
  } = params;

  // Resolve routine properties vs legacy options
  const target: CornerTarget = routine
    ? routine.target
    : legacyCornersFor === 'NearPost'
      ? 'Near'
      : legacyCornersFor === 'FarPost'
        ? 'Far'
        : legacyCornersFor === 'Short'
          ? 'Short'
          : 'Mixed';

  const swingResult = routine
    ? computeCornerSwing(cornerSide, taker.foot ?? 'Right', routine.swing)
    : {
        effectiveSwing: legacyCornerSwing,
        forcedPenalty: false,
        deliveryCtxMod: 0,
      };

  const effectiveSwing = swingResult.effectiveSwing;
  const familiarityCtx = routine ? calculateRoutineSharpnessCtx(routine.familiarity) : 0;
  const predictabilityDuelPenalty = routine
    ? calculateRoutinePredictability(routineUsesInMatch)
    : 0;

  // Count stayBack jobs if routine has jobs, else fallback to menBack
  let stayBackCount = legacyMenBack;
  if (routine && routine.jobs) {
    const count = Object.values(routine.jobs).filter((j) => j === 'stayBack').length;
    if (count >= 1 && count <= 3) stayBackCount = count as MenBack;
  }

  // Short corner routine (§13.17.5 & §13.20.1): keep ball in ATT wide outside box
  if (target === 'Short') {
    const shortPlayer =
      attackersInBox.find((a) => a.slot && routine?.jobs?.[a.slot] === 'short') ??
      attackersInBox[0] ??
      taker;
    return { outcome: 'SHORT', headerAttackerId: shortPlayer.id };
  }

  // Defending routine: Man-mark penalty foul risk in box (§13.17.5)
  if (cornersAgainst === 'ManMark' && rng.chance(K.setp.cornersAgainst.manMark.penaltyFoulRate)) {
    return { outcome: 'PENALTY', foulPenalty: true };
  }

  // 1. GK Claim
  let claimMod = 0;
  if (target === 'Near') claimMod -= 0.04;
  else if (target === 'Far') claimMod += 0.03;

  if (effectiveSwing === 'Inswinger') {
    claimMod += K.sp.swing.inswinger.gkClaimAdd;
  } else if (effectiveSwing === 'Outswinger') {
    claimMod += K.sp.swing.outswinger.gkClaimAdd;
  }

  // Check keeperScreen job (§13.20.1): stands on keeper: GK claim -0.04
  const hasKeeperScreen = attackersInBox.some(
    (a) => a.slot && routine?.jobs?.[a.slot] === 'keeperScreen',
  );
  if (hasKeeperScreen) {
    claimMod += K.sp.jobs.keeperScreen.gkClaimAdd;
  }

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
  if (target === 'Near') delivCtx -= 0.1;
  if (cornersAgainst === 'Zonal' && target === 'Near') delivCtx -= 0.15;
  delivCtx += familiarityCtx;
  delivCtx += swingResult.deliveryCtxMod;

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
  // Box jobs: attackers not in a box job cannot win the header (§13.20.1)
  let boxJobAttackers = attackersInBox;
  if (routine && routine.jobs && Object.keys(routine.jobs).length > 0) {
    const filtered = attackersInBox.filter((p) => {
      if (!p.slot) return false;
      const j = routine.jobs[p.slot];
      return j === 'nearPost' || j === 'farPost' || j === 'penaltySpot' || j === 'keeperScreen';
    });
    if (filtered.length > 0) {
      boxJobAttackers = filtered;
    }
  }

  const attackerWeights = boxJobAttackers.map((p) => {
    let base = Math.max(1, p.attributes.heading);
    if (target === 'Near') {
      base = Math.max(1, p.attributes.heading * 0.5 + p.attributes.pace * 0.5);
    } else if (p.isCbOrSt) {
      base *= 1.3;
    }

    // Job weights (§13.20.1)
    if (p.slot && routine?.jobs?.[p.slot]) {
      const job = routine.jobs[p.slot];
      if (job === 'nearPost' && target === 'Near') {
        base *= K.sp.jobs.nearPost.targetMatchWeightMult;
      } else if (job === 'farPost' && target === 'Far') {
        base *= K.sp.jobs.farPost.targetMatchWeightMult;
      } else if (job === 'penaltySpot' && target === 'Spot') {
        base *= K.sp.jobs.penaltySpot.targetMatchWeightMult;
      } else if (job === 'keeperScreen') {
        base *= K.sp.jobs.keeperScreen.headerWeightMult;
      }
    }

    if (stayBackCount === 1) base *= K.d2.setPieces.menBack[1].headerTargetWeightMult;
    else if (stayBackCount === 3) base *= K.d2.setPieces.menBack[3].headerTargetWeightMult;

    return base;
  });

  if (target === 'Far') {
    let bestIdx = 0;
    let maxH = -1;
    for (let i = 0; i < boxJobAttackers.length; i++) {
      if (boxJobAttackers[i]!.attributes.heading > maxH) {
        maxH = boxJobAttackers[i]!.attributes.heading;
        bestIdx = i;
      }
    }
    if (attackerWeights[bestIdx] !== undefined) {
      attackerWeights[bestIdx]! *= 1.5;
    }
  }

  const totalAttWeight = attackerWeights.reduce((a, b) => a + b, 0);
  let rollAtt = rng.next() * totalAttWeight;
  let targetAtt = boxJobAttackers[0]!;
  for (let i = 0; i < boxJobAttackers.length; i++) {
    rollAtt -= attackerWeights[i]!;
    if (rollAtt <= 0) {
      targetAtt = boxJobAttackers[i]!;
      break;
    }
  }

  // 4. Defender Selection
  // Find opposition best aerial threat (best S_air)
  let bestAttAirPlayer = attackersInBox[0]!;
  let maxAttAir = -999;
  for (const a of attackersInBox) {
    const air = 0.6 * z(a.attributes.heading) + 0.4 * z(a.attributes.strength);
    if (air > maxAttAir) {
      maxAttAir = air;
      bestAttAirPlayer = a;
    }
  }

  // Find our designated marker (§13.20.5: Mark their main man)
  let designatedMarker: SetPiecePlayer | null = null;
  if (markMainManId === 'Auto') {
    // Our best S_air defender
    let bestDefAir = -999;
    for (const d of defendersInBox) {
      const air = 0.5 * z(d.attributes.heading) + 0.3 * z(d.attributes.strength);
      if (air > bestDefAir) {
        bestDefAir = air;
        designatedMarker = d;
      }
    }
  } else if (markMainManId) {
    designatedMarker = defendersInBox.find((d) => d.id === markMainManId) ?? null;
  }

  let targetDef: SetPiecePlayer | null = defendersInBox[0] ?? null;
  let isMarkingDuel = false;

  if (designatedMarker && targetAtt.id === bestAttAirPlayer.id) {
    targetDef = designatedMarker;
    isMarkingDuel = true;
  } else if (cornersAgainst === 'ManMark') {
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

  // 5. Aerial Duel Contest
  let duelMod = 0;
  if (target === 'Far') duelMod += K.setp.cornersFor.farPost.headerDuel;
  else if (target === 'Spot') duelMod += K.sp.jobs.penaltySpot.headerDuelAdd;

  if (cornersAgainst === 'Zonal' && target === 'Far') {
    duelMod += K.setp.cornersAgainst.zonal.oppFarPostHeaderDuel;
  }
  if (cornersAgainst === 'ManMark' || isMarkingDuel) {
    duelMod += K.sp.defendingCorners.manMarkDuelMod;
  }

  if (effectiveSwing === 'Inswinger') {
    duelMod += K.sp.swing.inswinger.headerDuelAdd;
  } else if (effectiveSwing === 'Outswinger') {
    duelMod += K.sp.swing.outswinger.headerDuelAdd;
  }

  if (stayBackCount === 1) duelMod += K.d2.setPieces.menBack[1].headerDuelAdd;
  else if (stayBackCount === 3) duelMod += K.d2.setPieces.menBack[3].headerDuelAdd;

  // Defending edge guard cost: one fewer defender in box -> attacker duel +0.04 (§13.20.5)
  if (edgeGuard) {
    duelMod += K.sp.defendingCorners.edgeGuard.oppHeaderDuelAdd;
  }

  // Defending forwards up (§13.20.5)
  if (forwardsUp === 0) {
    duelMod += K.sp.defendingCorners.forwardsUp[0].oppHeaderDuelAdd; // -0.05
  } else if (forwardsUp === 2) {
    duelMod += K.sp.defendingCorners.forwardsUp[2].oppHeaderDuelAdd; // +0.06
  }

  // Predictability penalty: defenders get +0.04 * (n - 1), capped at +0.12 (§13.20.2)
  duelMod -= predictabilityDuelPenalty;

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
    // Shot context resolution (§13.20.1 & §13.20.3)
    let shotContext: ShotContext = rng.chance(0.4) ? 'BOX_CENTRAL' : 'HEADER';

    const isPenaltySpotJob = targetAtt.slot && routine?.jobs?.[targetAtt.slot] === 'penaltySpot';
    if (target === 'Spot' || isPenaltySpotJob) {
      // Won headers here use BOX_CENTRAL instead of HEADER 30% of the time (§13.20.1)
      shotContext = rng.chance(K.sp.jobs.penaltySpot.boxCentralRatio) ? 'BOX_CENTRAL' : 'HEADER';
    } else if (effectiveSwing === 'Inswinger' && rng.chance(0.15)) {
      shotContext = 'SIX_YARD';
    }

    const extraXg = target === 'Near' ? 0.02 : 0; // xgRef 0.13 vs 0.11
    const extraOnTarget =
      target === 'Spot' || isPenaltySpotJob ? K.sp.jobs.penaltySpot.onTargetAdd : 0;

    const shotResult = resolveShot({
      context: shotContext,
      attacker: targetAtt,
      goalkeeper,
      defender: targetDef,
      trainingBonus: trainingBonusAttack,
      homeAdvantage,
      defenderHomeAdvantage: defAdv,
      extraXgRefAdd: extraXg,
      extraOnTargetAdd: extraOnTarget,
      defendingPostMen: postMen,
      isNearPostHeader: target === 'Near',
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

  // 6. Defender cleared: second ball resolution (§13.18.8 & §13.20.1 & §13.20.5)
  // Count edge players
  let edgePlayersCount = 1; // default 1
  if (routine && routine.jobs) {
    edgePlayersCount = Object.values(routine.jobs).filter((j) => j === 'edge').length;
  }

  const secondBallChances = K.sp.jobs.edge.secondBallChances;
  let secondBallAttackerProb =
    edgePlayersCount === 0
      ? secondBallChances[0]
      : edgePlayersCount >= 2
        ? secondBallChances[2]
        : secondBallChances[1];

  if (effectiveSwing === 'Outswinger') {
    secondBallAttackerProb = K.sp.swing.outswinger.secondBallAttackerChance;
  }
  if (postMen === 'Near') {
    secondBallAttackerProb = Math.max(
      secondBallAttackerProb,
      K.d2.setPieces.postMen.near.secondBallAttackerChance,
    );
  } else if (postMen === 'Both') {
    secondBallAttackerProb = Math.max(
      secondBallAttackerProb,
      K.d2.setPieces.postMen.both.secondBallAttackerChance,
    );
  }

  // Defending edge guard reduces second ball to attackers by -10 points (§13.20.5)
  if (edgeGuard) {
    secondBallAttackerProb -= K.sp.defendingCorners.edgeGuard.secondBallReduction;
  }
  secondBallAttackerProb = clamp(secondBallAttackerProb, 0.05, 0.85);

  const attackerWinsSecondBall = rng.chance(secondBallAttackerProb);
  let secondBallAttackerId: PlayerId | undefined;
  let isSecondBallEdgeShot = false;

  if (attackerWinsSecondBall) {
    const edgePlayer = attackersInBox.find((a) => a.slot && routine?.jobs?.[a.slot] === 'edge');
    secondBallAttackerId = edgePlayer?.id ?? attackersInBox[0]?.id;
    // Edge player winning second ball can launch a LONG_RANGE shot (utility +0.3)
    if (edgePlayer && rng.chance(0.6)) {
      isSecondBallEdgeShot = true;
    }
  }

  return {
    outcome: 'CLEARANCE',
    defenderId: targetDef?.id,
    secondBallSide: attackerWinsSecondBall ? 'ATTACKING' : 'DEFENDING',
    secondBallAttackerId,
    isSecondBallEdgeShot,
  };
}
