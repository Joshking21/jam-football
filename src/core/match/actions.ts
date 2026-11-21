// Implements SPEC §13.6 Candidate Actions and Action Selection via Softmax & §13.17 Tactical Depth
import {
  TeamInstructions,
  RoleId,
  DefRoleId,
  PlayerInstruction,
  OppOrder,
  ForceOpp,
} from '../types';
import { Third, Lane, isInBox } from './frames';
import { Rng } from '../rng';
import { K } from '@/config/balance';

export type ActionType =
  | 'recycle'
  | 'progress'
  | 'long'
  | 'switch'
  | 'dribble'
  | 'through'
  | 'cross'
  | 'shot'
  | 'clear';

export type CandidateAction = ActionType;

export interface ActionSelectionContext {
  ax: number;
  ay: number;
  instructions: TeamInstructions;
  opponentLine: 'Deep' | 'Normal' | 'High';
  isUnderPressure: boolean;
  isCounterPhase: boolean;
  isLosingLate: boolean; // >= 75' and losing

  // Tactical Depth Context (§13.17 & §13.18)
  holderRole?: RoleId;
  holderFit?: number;
  holderPIs?: PlayerInstruction[];
  oppOrdersOnHolder?: OppOrder['kind'][];
  hasTargetManOnTeam?: boolean;
  targetManFit?: number;
  insideForwardWithoutOverlap?: boolean;
  isStepAfterRegroupWin?: boolean;
  isStepsAfterKeepItWin?: boolean;
  isFirstStepWideDistribution?: boolean;
  opponentPressingHigh?: boolean;
  defendingTeamForceOpp?: ForceOpp;
  isLeadingLateTimeWasting?: boolean;
  defendingDefRoles?: DefRoleId[];
  defendingLaneDefRole?: DefRoleId;
  isPressBeaten?: boolean;
}

export function getLegalCandidateActions(
  third: Third,
  lane: Lane,
  inBox: boolean,
  isUnderPressure: boolean,
): Partial<Record<ActionType, number>> {
  if (inBox) {
    return { ...K.utilities.inBox };
  }

  if (third === 'DEF') {
    const base: Partial<Record<ActionType, number>> = { ...K.utilities.def };
    if (!isUnderPressure) {
      delete base.clear;
    }
    return base;
  }

  if (third === 'MID') {
    if (lane === 'Centre') {
      return { ...K.utilities.midCentre };
    } else {
      return { ...K.utilities.midWide };
    }
  }

  // ATT (outside box)
  if (lane === 'Centre') {
    return { ...K.utilities.attCentre };
  } else {
    return { ...K.utilities.attWide };
  }
}

export function selectAction(
  third: Third,
  lane: Lane,
  ctx: ActionSelectionContext,
  rng: Rng,
): ActionType {
  const inBox = isInBox(ctx.ax, ctx.ay);
  const utilities = getLegalCandidateActions(third, lane, inBox, ctx.isUnderPressure);
  const { instructions } = ctx;

  // Apply tactical modifiers (SPEC §13.6 & §13.18.1)
  if (instructions.mentality === 'VeryDefensive') {
    const mult = K.d2.mentality.veryStepMultiplier;
    if (utilities.recycle !== undefined) utilities.recycle += 0.3 * mult;
    if (utilities.progress !== undefined) utilities.progress -= 0.2 * mult;
    if (utilities.shot !== undefined) utilities.shot -= 0.2 * mult;
    if (utilities.long !== undefined) utilities.long += 0.1 * mult;
    if (utilities.shot !== undefined) utilities.shot += K.d2.mentality.veryDefensiveShotUtil;
  } else if (instructions.mentality === 'Defensive') {
    if (utilities.recycle !== undefined) utilities.recycle += 0.3;
    if (utilities.progress !== undefined) utilities.progress -= 0.2;
    if (utilities.shot !== undefined) utilities.shot -= 0.2;
    if (utilities.long !== undefined) utilities.long += 0.1;
  } else if (instructions.mentality === 'Attacking') {
    if (utilities.progress !== undefined) utilities.progress += 0.3;
    if (utilities.through !== undefined) utilities.through += 0.2;
    if (utilities.shot !== undefined) utilities.shot += 0.2;
    if (utilities.recycle !== undefined) utilities.recycle -= 0.3;
  } else if (instructions.mentality === 'VeryAttacking') {
    const mult = K.d2.mentality.veryStepMultiplier;
    if (utilities.progress !== undefined) utilities.progress += 0.3 * mult;
    if (utilities.through !== undefined) utilities.through += 0.2 * mult;
    if (utilities.shot !== undefined) utilities.shot += 0.18 * mult;
    if (utilities.recycle !== undefined) utilities.recycle -= 0.3 * mult;
  }

  // Final Third instructions (SPEC §13.18.2)
  if (instructions.finalThird === 'WorkIntoBox') {
    if (!inBox && utilities.shot !== undefined) {
      utilities.shot += K.d2.finalThird.workIntoBox.shotUtilOutsideBox;
    }
    if (third === 'ATT') {
      if (utilities.progress !== undefined)
        utilities.progress += K.d2.finalThird.workIntoBox.attProgressUtil;
      if (utilities.dribble !== undefined)
        utilities.dribble += K.d2.finalThird.workIntoBox.attDribbleUtil;
    }
  } else if (instructions.finalThird === 'ShootOnSight') {
    if (!inBox) {
      if (third === 'MID' && lane === 'Centre') {
        utilities.shot = (utilities.shot ?? 0) + K.d2.finalThird.shootOnSight.midCentreShotUtil;
      } else {
        utilities.shot = (utilities.shot ?? 0) + K.d2.finalThird.shootOnSight.shotUtilOutsideBox;
      }
    } else {
      if (utilities.shot !== undefined) {
        utilities.shot += K.d2.finalThird.shootOnSight.shotUtilInBox;
      }
    }
  }

  if (instructions.passing === 'Short') {
    if (utilities.recycle !== undefined) utilities.recycle += 0.3;
    if (utilities.progress !== undefined) utilities.progress += 0.1;
    if (utilities.long !== undefined) utilities.long -= 0.5;
    if (utilities.through !== undefined) utilities.through -= 0.1;
  } else if (instructions.passing === 'Direct') {
    if (utilities.long !== undefined) utilities.long += 0.6;
    if (utilities.through !== undefined) utilities.through += 0.3;
    if (utilities.recycle !== undefined) utilities.recycle -= 0.3;
  }

  if (instructions.tempo === 'Slow') {
    if (utilities.recycle !== undefined) utilities.recycle += 0.3;
  } else if (instructions.tempo === 'Fast') {
    if (utilities.progress !== undefined) utilities.progress += 0.2;
    if (utilities.dribble !== undefined) utilities.dribble += 0.1;
  }

  if (instructions.width === 'Narrow') {
    if (utilities.cross !== undefined) utilities.cross -= 0.4;
    if (utilities.switch !== undefined) utilities.switch -= 0.2;
  } else if (instructions.width === 'Wide') {
    if (utilities.cross !== undefined) utilities.cross += 0.4;
    if (utilities.switch !== undefined) utilities.switch += 0.3;
  }

  // Tactical Depth: Holder Role Modifiers (§13.17.2)
  if (ctx.holderRole) {
    const fit = ctx.holderFit ?? 1.0;
    const gainScale = 0.4 + 0.6 * fit;

    switch (ctx.holderRole) {
      case 'ball_playing_cb':
        if (third === 'DEF') {
          if (utilities.progress !== undefined) utilities.progress += 0.3 * gainScale;
          if (utilities.switch !== undefined) utilities.switch += 0.2 * gainScale;
          if (utilities.long !== undefined) utilities.long += 0.1 * gainScale;
        }
        break;
      case 'fb_defensive':
        if (utilities.cross !== undefined) utilities.cross -= 0.3;
        break;
      case 'fb_overlapping':
        if (utilities.cross !== undefined) utilities.cross += 0.4 * gainScale;
        break;
      case 'fb_inverted':
        if (utilities.progress !== undefined) utilities.progress += 0.2 * gainScale;
        if (utilities.cross !== undefined) utilities.cross -= 0.4;
        break;
      case 'anchor':
        if (utilities.recycle !== undefined) utilities.recycle += 0.3 * gainScale;
        if (utilities.progress !== undefined) utilities.progress -= 0.2;
        if (utilities.through !== undefined) utilities.through -= 0.2;
        break;
      case 'deep_playmaker':
        if (utilities.switch !== undefined) utilities.switch += 0.3 * gainScale;
        if (utilities.long !== undefined) utilities.long += 0.2 * gainScale;
        if (utilities.through !== undefined) utilities.through += 0.2 * gainScale;
        break;
      case 'ball_winner':
        if (utilities.through !== undefined) utilities.through -= 0.2;
        break;
      case 'playmaker':
        if (utilities.through !== undefined) utilities.through += 0.35 * gainScale;
        if (utilities.progress !== undefined) utilities.progress += 0.1 * gainScale;
        break;
      case 'runner':
        if (inBox && utilities.shot !== undefined) utilities.shot += 0.3 * gainScale;
        break;
      case 'shadow_striker':
        if ((inBox || (third === 'ATT' && lane === 'Centre')) && utilities.shot !== undefined) {
          utilities.shot += 0.3 * gainScale;
        }
        break;
      case 'wm_defensive':
        if (utilities.cross !== undefined) utilities.cross -= 0.1;
        if (utilities.dribble !== undefined) utilities.dribble -= 0.1;
        break;
      case 'wide_playmaker':
        if (utilities.through !== undefined) utilities.through += 0.3 * gainScale;
        if (utilities.switch !== undefined) utilities.switch += 0.2 * gainScale;
        if (utilities.cross !== undefined) utilities.cross -= 0.3;
        break;
      case 'winger':
        if (utilities.cross !== undefined) utilities.cross += 0.4 * gainScale;
        if (utilities.dribble !== undefined) utilities.dribble += 0.2 * gainScale;
        if (utilities.shot !== undefined) utilities.shot -= 0.2;
        break;
      case 'inside_forward':
        if (third === 'ATT') {
          if (utilities.shot !== undefined) utilities.shot += 0.4 * gainScale;
          if (utilities.dribble !== undefined) utilities.dribble += 0.1 * gainScale;
        }
        if (utilities.cross !== undefined) utilities.cross -= 0.5;
        break;
      case 'target_man':
        if (utilities.dribble !== undefined) utilities.dribble -= 0.3;
        break;
      case 'poacher':
        if (inBox && utilities.shot !== undefined) utilities.shot += 0.3 * gainScale;
        break;
      case 'pressing_forward':
        if (utilities.shot !== undefined) utilities.shot -= 0.15;
        break;
      case 'false_nine':
        if (utilities.through !== undefined) utilities.through += 0.4 * gainScale;
        if (utilities.progress !== undefined) utilities.progress += 0.2 * gainScale;
        break;
    }
  }

  // Tactical Depth: Team Roles Modifiers (§13.17.2)
  if (ctx.hasTargetManOnTeam && utilities.long !== undefined) {
    const tmScale = 0.4 + 0.6 * (ctx.targetManFit ?? 1.0);
    utilities.long += 0.2 * tmScale;
  }

  if (ctx.insideForwardWithoutOverlap && utilities.cross !== undefined) {
    utilities.cross -= 0.3;
  }

  // Tactical Depth: Opposition Orders on Holder (§13.17.3)
  if (ctx.oppOrdersOnHolder && ctx.oppOrdersOnHolder.length > 0) {
    if (ctx.oppOrdersOnHolder.includes('pressOnBall')) {
      if (utilities.recycle !== undefined) utilities.recycle += 0.3;
    }
    if (lane !== 'Centre') {
      if (ctx.oppOrdersOnHolder.includes('showInside')) {
        if (utilities.cross !== undefined) utilities.cross -= 0.5;
        if (utilities.dribble !== undefined) utilities.dribble -= 0.2;
        if (third === 'ATT' && utilities.shot !== undefined) utilities.shot += 0.2;
      }
      if (ctx.oppOrdersOnHolder.includes('showOutside')) {
        if (utilities.shot !== undefined) utilities.shot -= 0.4;
        if (utilities.cross !== undefined) utilities.cross += 0.2;
        if (utilities.dribble !== undefined) utilities.dribble += 0.1;
      }
    }
  }

  // Tactical Depth: Force Opp (SPEC §13.18.6)
  const oppHasShowOrder =
    ctx.oppOrdersOnHolder?.includes('showInside') || ctx.oppOrdersOnHolder?.includes('showOutside');
  if (!oppHasShowOrder && ctx.defendingTeamForceOpp && ctx.defendingTeamForceOpp !== 'Mixed') {
    if (lane !== 'Centre') {
      if (ctx.defendingTeamForceOpp === 'Inside') {
        if (utilities.cross !== undefined) utilities.cross += K.d2.forceOpp.inside.oppWideCrossUtil;
        if (third === 'ATT') {
          utilities.shot = (utilities.shot ?? 0) + K.d2.forceOpp.inside.oppWideShotAttUtil;
        }
      } else if (ctx.defendingTeamForceOpp === 'Outside') {
        if (utilities.shot !== undefined) utilities.shot += K.d2.forceOpp.outside.oppWideShotUtil;
        utilities.cross = (utilities.cross ?? 0) + K.d2.forceOpp.outside.oppWideCrossUtil;
      }
    }
  }

  // Tactical Depth: Defensive Roles Impact on Attacker Actions (§13.19.2)
  if (ctx.defendingDefRoles && ctx.defendingDefRoles.length > 0) {
    if (ctx.defendingDefRoles.includes('dm_drop')) {
      if (third === 'ATT' && !inBox) {
        utilities.shot = (utilities.shot ?? 0) + (K.droles.dm_drop.oppAttCentreShotUtil ?? 0.14);
      }
    }
    if (ctx.defendingDefRoles.includes('st_shoulder') && third === 'DEF') {
      if (utilities.recycle !== undefined) {
        utilities.recycle += K.droles.st_shoulder.oppDefRecycleCtx ?? 0.2;
      }
    }
    if (ctx.defendingDefRoles.includes('w_high')) {
      if (third === 'MID' && lane === 'Centre') {
        if (utilities.switch !== undefined) utilities.switch += 0.45;
      }
      if (lane !== 'Centre') {
        if (utilities.progress !== undefined) utilities.progress += 0.25;
        if (utilities.dribble !== undefined) utilities.dribble += 0.2;
      }
    }
  }

  if (ctx.isPressBeaten && utilities.progress !== undefined) {
    utilities.progress += 0.2;
  }

  if (ctx.defendingLaneDefRole === 'fb_tuck' && lane !== 'Centre') {
    if (utilities.cross !== undefined) {
      utilities.cross += K.droles.fb_tuck.oppLaneCrossUtil ?? 0.2;
    }
  }

  if (ctx.defendingLaneDefRole === 'w_high' && lane !== 'Centre') {
    if (utilities.progress !== undefined) utilities.progress += 0.35;
    if (utilities.through !== undefined) utilities.through += 0.3;
    if (utilities.cross !== undefined) utilities.cross += 0.25;
  }

  // Tactical Depth: Time-Wasting (SPEC §13.18.7)
  if (ctx.isLeadingLateTimeWasting) {
    if (utilities.recycle !== undefined) utilities.recycle += K.d2.timeWasting.recycleUtilAdd;
  }

  // Tactical Depth: Transitions & Distribution (§13.17.4)
  if (ctx.isStepAfterRegroupWin) {
    if (utilities.recycle !== undefined) utilities.recycle += 0.3;
    if (utilities.progress !== undefined) utilities.progress += 0.2;
  }
  if (ctx.isStepsAfterKeepItWin && utilities.recycle !== undefined) {
    utilities.recycle += K.trans.keepIt.firstStepsRecycle;
  }
  if (ctx.isFirstStepWideDistribution && utilities.progress !== undefined) {
    utilities.progress += 0.2;
  }

  // Tactical Depth: Player Instructions (§13.17.11 & §13.18.9)
  if (ctx.holderPIs && ctx.holderPIs.length > 0) {
    if (ctx.holderPIs.includes('shootMore')) {
      if (utilities.shot !== undefined) utilities.shot += 0.25;
      else if ((third === 'MID' && lane === 'Centre') || (third === 'ATT' && lane !== 'Centre')) {
        utilities.shot = 0.25;
      }
      if (utilities.recycle !== undefined) utilities.recycle -= 0.25;
    }
    if (ctx.holderPIs.includes('shootLess')) {
      if (!inBox && utilities.shot !== undefined) utilities.shot -= 0.35;
      if (utilities.progress !== undefined) utilities.progress += 0.15;
    }
    if (ctx.holderPIs.includes('dribbleMore')) {
      if (utilities.dribble !== undefined) utilities.dribble += 0.35;
    }
    if (ctx.holderPIs.includes('dribbleLess')) {
      if (utilities.dribble !== undefined) utilities.dribble -= 0.35;
      if (utilities.recycle !== undefined) utilities.recycle += 0.15;
    }
    if (ctx.holderPIs.includes('crossMore')) {
      if (utilities.cross !== undefined) utilities.cross += 0.4;
      else if (third === 'MID' && lane !== 'Centre') {
        utilities.cross = 0.4;
      }
    }
    if (ctx.holderPIs.includes('crossLess')) {
      if (utilities.cross !== undefined) utilities.cross -= 0.4;
      if (utilities.progress !== undefined) utilities.progress += 0.15;
    }
    if (ctx.holderPIs.includes('sitNarrower')) {
      if (utilities.cross !== undefined) utilities.cross += K.d2.pi.sitNarrower.crossUtilAdd;
    }
    if (ctx.holderPIs.includes('crossFromByline')) {
      if (third === 'MID' && lane !== 'Centre') {
        delete utilities.cross;
      }
    }
    if (ctx.holderPIs.includes('crossFromDeep')) {
      if (third === 'MID' && lane !== 'Centre') {
        utilities.cross = (utilities.cross ?? 0) + K.d2.pi.crossFromDeep.midWideCrossUtilAdd;
      }
    }
    if (ctx.holderPIs.includes('riskyPasses')) {
      utilities.through = (utilities.through ?? 0) + K.d2.pi.riskyPasses.throughUtilAdd;
      if (utilities.progress !== undefined)
        utilities.progress += K.d2.pi.riskyPasses.progressUtilAdd;
    }
    if (ctx.holderPIs.includes('playSafe')) {
      utilities.recycle = (utilities.recycle ?? 0) + K.d2.pi.playSafe.recycleUtilAdd;
      if (utilities.through !== undefined) utilities.through += K.d2.pi.playSafe.throughUtilAdd;
    }
  }

  if (ctx.isCounterPhase) {
    if (utilities.progress !== undefined) utilities.progress += 0.5;
    if (utilities.through !== undefined) utilities.through += 0.5;
    if (utilities.recycle !== undefined) utilities.recycle -= 0.5;
  }

  if (ctx.isLosingLate) {
    if (utilities.progress !== undefined) utilities.progress += 0.2;
    if (utilities.shot !== undefined) utilities.shot += 0.2;
    if (utilities.long !== undefined) utilities.long += 0.2;
  }

  if (ctx.opponentLine === 'Deep' && third === 'ATT' && lane === 'Centre' && !inBox) {
    if (utilities.shot !== undefined) utilities.shot += 0.2;
  }

  // Softmax choice with tau = 0.35 (SPEC §13.4)
  const TAU = 0.35;
  let maxU = -Infinity;
  for (const k in utilities) {
    const u = (utilities as any)[k];
    if (typeof u === 'number' && u > maxU) maxU = u;
  }

  let totalWeight = 0;
  const actions: ActionType[] = [];
  const weights: number[] = [];
  for (const k in utilities) {
    const u = (utilities as any)[k];
    if (typeof u === 'number') {
      const w = Math.exp((u - maxU) / TAU);
      actions.push(k as ActionType);
      weights.push(w);
      totalWeight += w;
    }
  }

  if (actions.length === 0) return 'recycle';
  if (actions.length === 1) return actions[0]!;

  let r = rng.next() * totalWeight;
  for (let i = 0; i < actions.length; i++) {
    const w = weights[i]!;
    if (r <= w) return actions[i]!;
    r -= w;
  }
  return actions[actions.length - 1]!;
}
