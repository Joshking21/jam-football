// Implements SPEC §12.3, §12.4 & §12.18 Weekly Player Development and Age Decline
import {
  Player,
  Attributes,
  AttributeKey,
  TrainingPlan,
  Intensity,
  Position,
  WeeklyTrainingSchedule,
} from '../types';
import { Rng } from '../rng';
import { clamp, roundTo } from '../math';
import { BALANCE } from '@/config/balance';
import { getPositionWeights, rawOvr } from './ratings';
import { countTrainingSessions, getWeekAttributeWeights } from '../people/training';

export type TrainingFocus = TrainingPlan['focus'];

export interface DevelopmentOptions {
  focus: TrainingFocus;
  intensity: Intensity;
  minutesLastMatch: number;
  individualFocus?: AttributeKey | null;
  rng: Rng;
  // SPEC §12.18 Detailed Training parameters
  schedule?: WeeklyTrainingSchedule;
  workload?: 'Light' | 'Normal' | 'Heavy';
  extraSessions?: boolean;
  extraSessionsSkipped?: boolean;
  trainingRating?: number;
  isMentee?: boolean;
  isMentor?: boolean;
  oneToOneTechnique?: boolean;
}

export interface DevelopmentResult {
  player: Player;
  growthDelta: number;
  ovrDelta: number;
  oldOvr: number;
  newOvr: number;
  boostedAttributes: AttributeKey[];
  declinedAttributes: AttributeKey[];
}

/**
 * Returns the candidate attribute pool for a given training focus per SPEC §12.3
 */
export function getFocusAttributes(
  focus: TrainingFocus,
  pos: Position,
  age: number,
): AttributeKey[] {
  const isGk = pos === 'GK';

  if (isGk) {
    const gkWeights = Object.keys(getPositionWeights('GK')) as AttributeKey[];
    if (focus === 'Fitness') {
      return age >= 30 ? ['stamina'] : ['stamina', 'pace', 'strength'];
    }
    if (focus === 'Tactical') {
      return ['decisions', 'composure', ...gkWeights];
    }
    return gkWeights;
  }

  switch (focus) {
    case 'Attacking':
      return ['finishing', 'passing', 'firstTouch', 'dribbling', 'offTheBall', 'crossing'];
    case 'Defending':
      return ['tackling', 'positioning', 'heading', 'strength', 'decisions'];
    case 'Fitness':
      return age >= 30 ? ['stamina'] : ['stamina', 'pace', 'strength'];
    case 'SetPieces':
      return ['setPieces', 'heading', 'crossing'];
    case 'Tactical':
      return ['decisions', 'positioning', 'composure', 'workRate'];
    case 'Balanced':
    default: {
      const weights = getPositionWeights(pos);
      return Object.keys(weights) as AttributeKey[];
    }
  }
}

/**
 * Weighted random sample without replacement
 */
function pickWeightedAttributes(
  candidates: AttributeKey[],
  weights: Partial<Record<AttributeKey, number>>,
  count: number,
  rng: Rng,
  forcedFirst?: AttributeKey | null,
): AttributeKey[] {
  const selected: AttributeKey[] = [];
  const pool = [...new Set(candidates)];

  if (forcedFirst && pool.includes(forcedFirst)) {
    selected.push(forcedFirst);
    const idx = pool.indexOf(forcedFirst);
    if (idx >= 0) pool.splice(idx, 1);
  }

  while (selected.length < count && pool.length > 0) {
    const candidateWeights = pool.map((attr) => weights[attr] ?? 0.05);
    const totalWeight = candidateWeights.reduce((a, b) => a + b, 0);

    let roll = rng.next() * totalWeight;
    let chosenIdx = 0;
    for (let i = 0; i < pool.length; i++) {
      roll -= candidateWeights[i]!;
      if (roll <= 0) {
        chosenIdx = i;
        break;
      }
    }

    selected.push(pool[chosenIdx]!);
    pool.splice(chosenIdx, 1);
  }

  return selected;
}

/**
 * Calculates base weekly growth by age per SPEC §12.4
 */
export function getBaseWeeklyGrowth(age: number): number {
  for (const tier of BALANCE.development.ageBaseGrowth) {
    if (age <= tier.maxAge) {
      return tier.growth;
    }
  }
  return -0.25;
}

/**
 * Processes weekly development for a single player per SPEC §12.4
 */
export function processPlayerDevelopment(
  player: Player,
  options: DevelopmentOptions,
): DevelopmentResult {
  const { focus, intensity, minutesLastMatch, individualFocus, rng } = options;
  const nextPlayer: Player = JSON.parse(JSON.stringify(player));
  const primaryPos = nextPlayer.positions[0]?.pos ?? 'CM';
  const oldOvr = Math.round(rawOvr(nextPlayer.attributes, primaryPos));

  // 1. Base growth by age
  const baseGrowth = getBaseWeeklyGrowth(nextPlayer.age);

  // 2. Multipliers
  let growthDelta = baseGrowth;
  if (baseGrowth > 0) {
    // Headroom factor = clamp((potential − OVR)/10, 0, 1)
    const headroomFactor = clamp((nextPlayer.potential - oldOvr) / 10, 0, 1);

    // Minutes factor = 0.6 + 0.4 × min(1, minutesLastMatch / 90) (players who did not play: 0.6)
    const minutesFactor = 0.6 + 0.4 * Math.min(1, Math.max(0, minutesLastMatch) / 90);

    // Intensity factor (§12.3)
    const intensityFactor = BALANCE.training.intensityFactors[intensity]?.growth ?? 1.0;

    // Morale factor: morale ≥ 60 ? 1.1 : morale < 30 ? 0.8 : 1
    const moraleFactor = nextPlayer.morale >= 60 ? 1.1 : nextPlayer.morale < 30 ? 0.8 : 1.0;

    growthDelta = baseGrowth * headroomFactor * minutesFactor * intensityFactor * moraleFactor;

    // SPEC §12.18 Detailed Training volume & multipliers
    if (options.schedule) {
      const trainingSessions = countTrainingSessions(options.schedule);
      const volumeFactor =
        BALANCE.training.volumeBase + BALANCE.training.volumePerSession * trainingSessions;
      growthDelta *= volumeFactor;
    }

    if (options.trainingRating !== undefined) {
      if (options.trainingRating >= BALANCE.training.ratings.highThreshold) {
        growthDelta *= BALANCE.training.ratings.highGrowthMult;
      } else if (options.trainingRating <= BALANCE.training.ratings.lowThreshold) {
        growthDelta *= BALANCE.training.ratings.lowGrowthMult;
      }
    }

    if (options.workload) {
      const wlMult = BALANCE.training.workload[options.workload]?.growth ?? 1.0;
      growthDelta *= wlMult;
    }

    if (options.extraSessions && !options.extraSessionsSkipped) {
      growthDelta *= BALANCE.training.extraSessions.growth;
    }

    if (options.isMentee) {
      growthDelta *= BALANCE.training.mentoring.menteeGrowthMult;
    } else if (options.isMentor) {
      growthDelta *= BALANCE.training.mentoring.mentorGrowthMult;
    }

    if (options.oneToOneTechnique) {
      growthDelta *= BALANCE.training.oneToOne.techniqueGrowthMult;
    }
  } else if (baseGrowth < 0) {
    // Decline can be slightly mitigated by higher intensity or accelerated by low intensity
    // SPEC: Base decline applies directly
    growthDelta = baseGrowth;
  }

  // 3. Add to player.growth
  nextPlayer.growth = roundTo((nextPlayer.growth ?? 0) + growthDelta, 4);

  const boostedAttributes: AttributeKey[] = [];
  const declinedAttributes: AttributeKey[] = [];
  const posWeights = getPositionWeights(primaryPos);

  // 4. While growth >= 1.0 (Positive progression)
  let candidatePool: AttributeKey[];
  let candidateWeights = posWeights;

  if (options.schedule) {
    const weekWeights = getWeekAttributeWeights(options.schedule, primaryPos, nextPlayer.age);
    const keys = Object.keys(weekWeights) as AttributeKey[];
    if (keys.length > 0) {
      candidatePool = keys;
      candidateWeights = weekWeights;
    } else {
      candidatePool = getFocusAttributes(focus, primaryPos, nextPlayer.age);
    }
  } else {
    candidatePool = getFocusAttributes(focus, primaryPos, nextPlayer.age);
  }

  while (nextPlayer.growth >= 1.0) {
    const currentOvr = Math.round(rawOvr(nextPlayer.attributes, primaryPos));
    if (currentOvr >= nextPlayer.potential) {
      // Stop raising once OVR reaches potential
      nextPlayer.growth = Math.min(nextPlayer.growth, 0.99);
      break;
    }

    nextPlayer.growth = roundTo(nextPlayer.growth - 1.0, 4);

    // Pick 3 attributes without repeats
    const picked = pickWeightedAttributes(candidatePool, candidateWeights, 3, rng, individualFocus);

    for (const attr of picked) {
      if (nextPlayer.attributes[attr] < 99) {
        nextPlayer.attributes[attr] += 1;
        boostedAttributes.push(attr);
      }
    }

    // Recompute OVR after each +1 round
    const afterRoundOvr = Math.round(rawOvr(nextPlayer.attributes, primaryPos));
    if (afterRoundOvr >= nextPlayer.potential) {
      nextPlayer.growth = Math.min(nextPlayer.growth, 0.99);
      break;
    }
  }

  // 5. While growth <= -1.0 (Age decline)
  while (nextPlayer.growth <= -1.0) {
    nextPlayer.growth = roundTo(nextPlayer.growth + 1.0, 4);

    // Physical attributes first: pace, stamina, strength
    const physicals: AttributeKey[] = ['pace', 'stamina', 'strength'];
    const candidates = [...physicals, ...(Object.keys(posWeights) as AttributeKey[])];
    const pickedToDecline: AttributeKey[] = [];

    for (const pAttr of physicals) {
      if (nextPlayer.attributes[pAttr] > 1 && pickedToDecline.length < 3) {
        pickedToDecline.push(pAttr);
      }
    }

    // If still need more to reach 3, pick from weighted
    for (const wAttr of candidates) {
      if (pickedToDecline.length >= 3) break;
      if (!pickedToDecline.includes(wAttr) && nextPlayer.attributes[wAttr] > 1) {
        pickedToDecline.push(wAttr);
      }
    }

    for (const attr of pickedToDecline) {
      if (nextPlayer.attributes[attr] > 1) {
        nextPlayer.attributes[attr] -= 1;
        declinedAttributes.push(attr);
      }
    }
  }

  const newOvr = Math.round(rawOvr(nextPlayer.attributes, primaryPos));

  return {
    player: nextPlayer,
    growthDelta,
    ovrDelta: newOvr - oldOvr,
    oldOvr,
    newOvr,
    boostedAttributes,
    declinedAttributes,
  };
}
