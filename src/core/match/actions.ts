// Implements SPEC §13.6 Candidate Actions and Action Selection via Softmax
import { TeamInstructions } from '../types';
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

  // Apply tactical modifiers (SPEC §13.6)
  if (instructions.mentality === 'Defensive') {
    if (utilities.recycle !== undefined) utilities.recycle += 0.3;
    if (utilities.progress !== undefined) utilities.progress -= 0.2;
    if (utilities.shot !== undefined) utilities.shot -= 0.2;
    if (utilities.long !== undefined) utilities.long += 0.1;
  } else if (instructions.mentality === 'Attacking') {
    if (utilities.progress !== undefined) utilities.progress += 0.3;
    if (utilities.through !== undefined) utilities.through += 0.2;
    if (utilities.shot !== undefined) utilities.shot += 0.2;
    if (utilities.recycle !== undefined) utilities.recycle -= 0.3;
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
