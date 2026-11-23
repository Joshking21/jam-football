// Implements SPEC §12.18 Training in detail
import {
  TrainingSessionId,
  TrainingCategory,
  TrainingSlotKey,
  WeeklyTrainingSchedule,
  TrainingTemplateId,
  PersonalPlayerPlan,
  Player,
  PlayerId,
  Club,
  AttributeKey,
  Position,
  MatchPrep,
  OneToOneType,
} from '../types';
import { BALANCE } from '@/config/balance';
import { Rng } from '../rng';
import { clamp, roundTo } from '../math';
import { getPositionWeights } from '../player/ratings';
import rawTrainingData from '@/content/training.json';

export interface TrainingSessionDef {
  id: TrainingSessionId;
  name: string;
  category: TrainingCategory;
  grows: AttributeKey[];
  load: number;
  description: string;
  effectNote: string;
  day6Only?: boolean;
  formationFamiliarityBonus?: number;
  allFamiliarityBonus?: number;
  moraleBonus?: number;
  conditionDelta?: number;
  fatigueDelta?: number;
}

export const SESSION_DEFINITIONS: Record<TrainingSessionId, TrainingSessionDef> = {
  finishing: {
    id: 'finishing',
    name: 'Finishing',
    category: 'Attacking',
    grows: ['finishing', 'composure', 'offTheBall'],
    load: 2,
    description: 'Final third shooting and composure drills.',
    effectNote: 'Finishing · composure · off the ball',
  },
  crossing: {
    id: 'crossing',
    name: 'Crossing & delivery',
    category: 'Attacking',
    grows: ['crossing', 'setPieces', 'passing'],
    load: 2,
    description: 'Wing delivery and whipped balls into dangerous areas.',
    effectNote: 'Crossing · set pieces · passing',
  },
  combination: {
    id: 'combination',
    name: 'Combination play',
    category: 'Attacking',
    grows: ['passing', 'firstTouch', 'offTheBall', 'decisions'],
    load: 2,
    description: 'Quick one-twos and third-man runs in tight spaces.',
    effectNote: 'Passing · first touch · off the ball',
  },
  dribbling: {
    id: 'dribbling',
    name: '1v1 dribbling',
    category: 'Attacking',
    grows: ['dribbling', 'firstTouch', 'pace'],
    load: 2,
    description: 'Direct take-ons and acceleration away from markers.',
    effectNote: 'Dribbling · first touch · pace',
  },
  defensive_shape: {
    id: 'defensive_shape',
    name: 'Defensive shape',
    category: 'Defending',
    grows: ['positioning', 'decisions', 'workRate'],
    load: 1,
    description: 'Block distances, compact lines, and shifting as a unit.',
    effectNote: 'Positioning · decisions · work rate',
  },
  defending_box: {
    id: 'defending_box',
    name: 'Defending the box',
    category: 'Defending',
    grows: ['heading', 'tackling', 'strength', 'positioning'],
    load: 2,
    description: 'Aerial clearances, physical duels, and penalty box organisation.',
    effectNote: 'Heading · tackling · strength',
  },
  pressing: {
    id: 'pressing',
    name: 'Pressing',
    category: 'Defending',
    grows: ['workRate', 'stamina', 'decisions'],
    load: 3,
    description: 'High-intensity triggers, traps, and synchronized counter-pressing.',
    effectNote: 'Work rate · stamina · decisions',
  },
  endurance: {
    id: 'endurance',
    name: 'Endurance',
    category: 'Fitness',
    grows: ['stamina'],
    load: 3,
    description: 'Aerobic intervals and sustained cardiovascular conditioning.',
    effectNote: 'Stamina',
  },
  speed_power: {
    id: 'speed_power',
    name: 'Speed & power',
    category: 'Fitness',
    grows: ['pace', 'strength'],
    load: 3,
    description: 'Explosive sprinting, plyometrics, and upper body core strength.',
    effectNote: 'Pace · strength',
  },
  shape_work: {
    id: 'shape_work',
    name: 'Shape work',
    category: 'Tactical',
    grows: ['positioning', 'decisions'],
    load: 1,
    description: 'Shadow play reinforcing tactical structure and passing angles.',
    effectNote: 'Formation familiarity +3',
    formationFamiliarityBonus: 3,
  },
  video_analysis: {
    id: 'video_analysis',
    name: 'Video analysis',
    category: 'Tactical',
    grows: ['decisions', 'composure'],
    load: 0,
    description: 'Classroom breakdown of match phases and tactical errors.',
    effectNote: 'All familiarity areas +1',
    allFamiliarityBonus: 1,
  },
  opponent_prep: {
    id: 'opponent_prep',
    name: 'Opponent prep',
    category: 'Tactical',
    grows: [],
    load: 1,
    day6Only: true,
    description: 'Targeted preparation countering the upcoming opponent style.',
    effectNote: 'Next match opponent tactical prep',
  },
  set_pieces: {
    id: 'set_pieces',
    name: 'Set-piece practice',
    category: 'SetPieces',
    grows: ['setPieces', 'heading', 'crossing'],
    load: 1,
    description: 'Attacking routines and defensive zonal marking setups.',
    effectNote: 'Set pieces · heading · crossing',
  },
  small_sided: {
    id: 'small_sided',
    name: 'Small-sided game',
    category: 'Balanced',
    grows: [],
    load: 2,
    description: 'Competitive mini-matches under match-like pressure.',
    effectNote: 'Primary position weights · morale +1',
    moraleBonus: 1,
  },
  recovery: {
    id: 'recovery',
    name: 'Recovery',
    category: 'Recovery',
    grows: [],
    load: -2,
    description: 'Pool sessions, light stretching, and physio recovery.',
    effectNote: 'Condition +3 · fatigue −2',
    conditionDelta: 3,
    fatigueDelta: -2,
  },
  rest: {
    id: 'rest',
    name: 'Rest',
    category: 'None',
    grows: [],
    load: -1,
    description: 'Full day off the grass for muscle repair and recharge.',
    effectNote: 'Condition +2',
    conditionDelta: 2,
  },
  light: {
    id: 'light',
    name: 'Light session',
    category: 'None',
    grows: [],
    load: 0,
    day6Only: true,
    description: 'Gentle pre-match activation and walkthrough.',
    effectNote: 'Zero fatigue matchday activation',
  },
};

export const BALANCED_WEEK_SCHEDULE: WeeklyTrainingSchedule = {
  d2_am: 'combination',
  d2_pm: 'defensive_shape',
  d3_am: 'endurance',
  d3_pm: 'finishing',
  d4_am: 'small_sided',
  d4_pm: 'defending_box',
  d5_am: 'shape_work',
  d5_pm: 'set_pieces',
  d6: 'light',
};

export const TRAINING_TEMPLATES: Record<
  TrainingTemplateId,
  { name: string; description: string; schedule: WeeklyTrainingSchedule }
> = {
  balanced: {
    name: 'Balanced week',
    description: 'Standard balanced training across all areas (load 12).',
    schedule: { ...BALANCED_WEEK_SCHEDULE },
  },
  tactical: {
    name: 'Tactical week',
    description: 'Heavy emphasis on shape and tactical familiarity; low physical load.',
    schedule: {
      d2_am: 'combination',
      d2_pm: 'shape_work',
      d3_am: 'video_analysis',
      d3_pm: 'defensive_shape',
      d4_am: 'small_sided',
      d4_pm: 'video_analysis',
      d5_am: 'shape_work',
      d5_pm: 'set_pieces',
      d6: 'shape_work',
    },
  },
  physical: {
    name: 'Physical week',
    description: 'High intensity conditioning and aerobic stamina; high physical load.',
    schedule: {
      d2_am: 'endurance',
      d2_pm: 'speed_power',
      d3_am: 'combination',
      d3_pm: 'pressing',
      d4_am: 'endurance',
      d4_pm: 'small_sided',
      d5_am: 'speed_power',
      d5_pm: 'defending_box',
      d6: 'light',
    },
  },
  attacking: {
    name: 'Attacking week',
    description: 'Focus on finishing, combination play, and wide delivery.',
    schedule: {
      d2_am: 'combination',
      d2_pm: 'dribbling',
      d3_am: 'crossing',
      d3_pm: 'finishing',
      d4_am: 'combination',
      d4_pm: 'small_sided',
      d5_am: 'finishing',
      d5_pm: 'crossing',
      d6: 'light',
    },
  },
  defensive: {
    name: 'Defensive week',
    description: 'Structure, box defending, pressing triggers, and set pieces.',
    schedule: {
      d2_am: 'defensive_shape',
      d2_pm: 'defending_box',
      d3_am: 'pressing',
      d3_pm: 'defensive_shape',
      d4_am: 'defending_box',
      d4_pm: 'small_sided',
      d5_am: 'defensive_shape',
      d5_pm: 'set_pieces',
      d6: 'opponent_prep',
    },
  },
  opponent: {
    name: 'Opponent week',
    description: 'Tactical and set-piece counters targeting the next opponent.',
    schedule: {
      d2_am: 'combination',
      d2_pm: 'defensive_shape',
      d3_am: 'small_sided',
      d3_pm: 'finishing',
      d4_am: 'defending_box',
      d4_pm: 'shape_work',
      d5_am: 'set_pieces',
      d5_pm: 'shape_work',
      d6: 'opponent_prep',
    },
  },
  recovery: {
    name: 'Recovery week',
    description: 'Gentle regime for congested schedules and high squad fatigue.',
    schedule: {
      d2_am: 'recovery',
      d2_pm: 'rest',
      d3_am: 'video_analysis',
      d3_pm: 'small_sided',
      d4_am: 'recovery',
      d4_pm: 'rest',
      d5_am: 'video_analysis',
      d5_pm: 'recovery',
      d6: 'light',
    },
  },
  custom: {
    name: 'Custom week',
    description: 'User-customized training plan.',
    schedule: { ...BALANCED_WEEK_SCHEDULE },
  },
};

export const ALL_FREE_SLOTS: TrainingSlotKey[] = [
  'd2_am',
  'd2_pm',
  'd3_am',
  'd3_pm',
  'd4_am',
  'd4_pm',
  'd5_am',
  'd5_pm',
];

/**
 * Calculates total weekLoad per SPEC §12.18.3:
 * Day 1 fixed recovery (-2) + sum of the 8 free slots plus day 6.
 * The default Balanced week has weekLoad = 12.
 */
export function calculateWeekLoad(schedule: WeeklyTrainingSchedule): number {
  let load = SESSION_DEFINITIONS.recovery.load; // Day 1 fixed recovery: -2
  for (const slot of ALL_FREE_SLOTS) {
    const sId = schedule[slot] ?? 'rest';
    load += SESSION_DEFINITIONS[sId]?.load ?? 0;
  }
  const day6Id = schedule.d6 ?? 'light';
  load += SESSION_DEFINITIONS[day6Id]?.load ?? 0;
  return load;
}

/**
 * Counts trainingSessions (free slots that are not Rest or Recovery) per SPEC §12.18.3
 */
export function countTrainingSessions(schedule: WeeklyTrainingSchedule): number {
  let count = 0;
  for (const slot of ALL_FREE_SLOTS) {
    const sId = schedule[slot] ?? 'rest';
    if (sId !== 'rest' && sId !== 'recovery') {
      count++;
    }
  }
  return count;
}

/**
 * Calculates sharpness fractions for the 3 slots on days 5 & 6 per SPEC §12.18.3
 */
export function calculateSharpnessFractions(
  schedule: WeeklyTrainingSchedule,
): Record<TrainingCategory, number> {
  const counts: Record<TrainingCategory, number> = {
    Attacking: 0,
    Defending: 0,
    Fitness: 0,
    Tactical: 0,
    SetPieces: 0,
    Balanced: 0,
    Recovery: 0,
    None: 0,
  };

  const slots: TrainingSlotKey[] = ['d5_am', 'd5_pm', 'd6'];
  for (const slot of slots) {
    const sId = schedule[slot] ?? 'light';
    const def = SESSION_DEFINITIONS[sId];
    if (def) {
      counts[def.category] = (counts[def.category] || 0) + 1;
    }
  }

  const fractions: Record<TrainingCategory, number> = {} as Record<TrainingCategory, number>;
  for (const cat of Object.keys(counts) as TrainingCategory[]) {
    fractions[cat] = (counts[cat] ?? 0) / 3;
  }
  return fractions;
}

/**
 * Returns the sharpness bonuses to apply to the next match
 */
export function calculateSharpnessBonuses(
  schedule: WeeklyTrainingSchedule,
  prep: MatchPrep = 'None',
): { attack: number; defence: number; setPieces: number } {
  const fractions = calculateSharpnessFractions(schedule);
  const prepMultiplier = prep !== 'None' ? 0.5 : 1.0;

  return {
    attack: 0.08 * (fractions.Attacking ?? 0) * prepMultiplier,
    defence: 0.08 * (fractions.Defending ?? 0) * prepMultiplier,
    setPieces: 0.12 * (fractions.SetPieces ?? 0) * prepMultiplier,
  };
}

/**
 * Returns candidate attribute pool and weights for a player's development week per SPEC §12.18.3
 */
export function getWeekAttributeWeights(
  schedule: WeeklyTrainingSchedule,
  pos: Position,
  age: number,
): Record<AttributeKey, number> {
  if (pos === 'GK') {
    return {
      reflexes: 0.35,
      handling: 0.3,
      oneOnOnes: 0.2,
      aerialCommand: 0.15,
    } as Record<AttributeKey, number>;
  }

  const posWeights = getPositionWeights(pos);
  const sessionCounts: Partial<Record<AttributeKey, number>> = {};

  const allSlots: TrainingSlotKey[] = [...ALL_FREE_SLOTS, 'd6'];
  for (const slot of allSlots) {
    const sId = schedule[slot];
    const def = SESSION_DEFINITIONS[sId];
    if (!def) continue;

    if (sId === 'small_sided') {
      // Small-sided game grows the player's primary position weights
      for (const attr of Object.keys(posWeights) as AttributeKey[]) {
        sessionCounts[attr] = (sessionCounts[attr] ?? 0) + 1;
      }
    } else {
      for (const attr of def.grows) {
        if (def.category === 'Fitness' && age >= 30 && (attr === 'pace' || attr === 'strength')) {
          continue; // older players only stamina from fitness
        }
        sessionCounts[attr] = (sessionCounts[attr] ?? 0) + 1;
      }
    }
  }

  const finalWeights: Partial<Record<AttributeKey, number>> = {};
  for (const [attrStr, count] of Object.entries(sessionCounts)) {
    const attr = attrStr as AttributeKey;
    const ovrWeight = posWeights[attr] ?? 0.05;
    const weightVal = ovrWeight > 0 ? ovrWeight : 0.05;
    finalWeights[attr] = count * weightVal;
  }

  return finalWeights as Record<AttributeKey, number>;
}

/**
 * Calculates weekly training rating per SPEC §12.18.7:
 * 6.4 + (Prof +0.6, Amb +0.3, Rel -0.4) + 0.6*(morale-50)/50 + (cond < 80 ? (cond-80)/50 : 0) +
 * workload & extra-session bonuses + rng.normal(0, Temp ? 1.0 : 0.6)
 */
export function calculateTrainingRating(
  player: Player,
  workload: 'Light' | 'Normal' | 'Heavy' = 'Normal',
  extraSessions: boolean = false,
  extraSessionsSkipped: boolean = false,
  rng: Rng,
): number {
  let rating = BALANCE.training.ratings.base; // 6.4

  // Personality bonus
  if (player.personality === 'Professional') {
    rating += BALANCE.training.ratings.profBonus;
  } else if (player.personality === 'Ambitious') {
    rating += BALANCE.training.ratings.ambBonus;
  } else if (player.personality === 'Relaxed') {
    rating += BALANCE.training.ratings.relPenalty;
  }

  // Morale effect
  rating += (0.6 * (player.morale - 50)) / 50;

  // Condition effect
  if (player.condition < 80) {
    rating += (player.condition - 80) / 50;
  }

  // Workload bonus
  if (workload === 'Heavy') {
    rating += BALANCE.training.workload.Heavy.rating;
  }

  // Extra sessions bonus
  if (extraSessions && !extraSessionsSkipped) {
    rating += BALANCE.training.extraSessions.rating;
  }

  // Random noise
  const stdDev =
    player.personality === 'Temperamental'
      ? (BALANCE.training.ratings.tempStdDev ?? 1.0)
      : (BALANCE.training.ratings.normalStdDev ?? 0.6);
  const noise = rng.normal(0, stdDev);
  rating += noise;

  return clamp(roundTo(rating, 1), 1.0, 10.0);
}

/**
 * Suggests MatchPrep according to opponent style per SPEC §12.17.2
 */
export function suggestMatchPrepFromOpponent(
  opponentClub?: Club,
  opponentPlayers?: Player[],
): MatchPrep {
  if (!opponentClub) return 'Shape';

  // Check high pressing
  if (opponentClub.style.pressing === 'High') {
    return 'Press';
  }

  // Check aerial set-piece threat (best header >= 75)
  if (opponentPlayers && opponentPlayers.length > 0) {
    const highestHeader = Math.max(...opponentPlayers.map((p) => p.attributes.heading));
    if (highestHeader >= 75) {
      return 'SetPieces';
    }
  }

  // Check wide play
  if (
    opponentClub.style.width === 'Wide' ||
    opponentClub.style.focus === 'Left' ||
    opponentClub.style.focus === 'Right'
  ) {
    return 'Wingers';
  }

  return 'Shape';
}

/**
 * Generates Theo's Week recommendation per SPEC §12.18.4
 */
export function generateTheosWeek(
  club: Club,
  allPlayers: Record<PlayerId, Player>,
  opponentClub?: Club,
  opponentPlayers?: Player[],
): {
  schedule: WeeklyTrainingSchedule;
  reasons: string[];
  opponentPrep: MatchPrep;
  suggestedSlots: Partial<Record<TrainingSlotKey, boolean>>;
} {
  const schedule: WeeklyTrainingSchedule = { ...BALANCED_WEEK_SCHEDULE };
  const reasons: string[] = [];
  const suggestedSlots: Partial<Record<TrainingSlotKey, boolean>> = {};

  const squadPlayers = club.squad.map((id) => allPlayers[id]).filter((p): p is Player => p != null);
  const starters = squadPlayers.slice(0, 11);

  // 1. If >= 4 starters have fatigue > 50: swap the two load-3 sessions for Recovery
  const tiredStarters = starters.filter((p) => p.fatigue > 50);
  if (tiredStarters.length >= 4) {
    schedule.d3_am = 'recovery';
    schedule.d4_pm = 'recovery';
    suggestedSlots.d3_am = true;
    suggestedSlots.d4_pm = true;

    const names = tiredStarters
      .slice(0, 3)
      .map((p) => p.lastName)
      .join(', ');
    reasons.push(
      `Endurance and Pressing out, Recovery in: ${names} and others are over 50 fatigue.`,
    );
  }

  // 2. If any familiarity area is < 70: add Shape work or Video analysis on day 5
  const formationFam =
    club.formationFamiliarity?.[club.tactics.formation] ??
    club.familiarity?.formation?.[club.tactics.formation] ??
    60;
  const passingFam = club.familiarity?.passing?.[club.tactics.instructions.passing] ?? 60;
  const pressingFam = club.familiarity?.pressing?.[club.tactics.instructions.pressing] ?? 60;
  const mentalityFam = club.familiarity?.mentality?.[club.tactics.instructions.mentality] ?? 60;

  const isFamLow = formationFam < 70 || passingFam < 70 || pressingFam < 70 || mentalityFam < 70;

  if (isFamLow) {
    schedule.d5_am = 'shape_work';
    suggestedSlots.d5_am = true;
    const lowestArea =
      formationFam < passingFam && formationFam < pressingFam
        ? 'formation'
        : passingFam < pressingFam
          ? 'passing'
          : 'pressing';
    const lowestVal = Math.min(formationFam, passingFam, pressingFam, mentalityFam);
    reasons.push(
      `Shape work on day 5: ${lowestArea} familiarity is only ${Math.round(lowestVal)}.`,
    );
  }

  // 3. Opponent set-piece threat (best header >= 75): Set-piece practice on day 5
  let setPieceThreat = false;
  if (opponentPlayers && opponentPlayers.length > 0) {
    const highestHeader = Math.max(...opponentPlayers.map((p) => p.attributes.heading));
    if (highestHeader >= 75) {
      setPieceThreat = true;
      schedule.d5_pm = 'set_pieces';
      suggestedSlots.d5_pm = true;
      reasons.push(
        `Set-piece practice on day 5: ${opponentClub?.shortName ?? 'Opponent'} has significant aerial threat (heading ${highestHeader}).`,
      );
    }
  }

  // 4. Day 6: Opponent prep
  const suggestedPrep = suggestMatchPrepFromOpponent(opponentClub, opponentPlayers);
  schedule.d6 = 'opponent_prep';
  suggestedSlots.d6 = true;
  const oppName = opponentClub?.shortName ?? 'the opponent';
  if (suggestedPrep === 'Wingers') {
    reasons.push(`Day 6, Opponent prep: Wingers. ${oppName} go wide and cross early.`);
  } else if (suggestedPrep === 'Press') {
    reasons.push(`Day 6, Opponent prep: Press. ${oppName} press aggressively in midfield.`);
  } else if (suggestedPrep === 'SetPieces') {
    reasons.push(`Day 6, Opponent prep: SetPieces. Countering ${oppName}'s set plays.`);
  } else {
    reasons.push(
      `Day 6, Opponent prep: Shape. Consolidating our defensive lines against ${oppName}.`,
    );
  }

  return {
    schedule,
    reasons,
    opponentPrep: suggestedPrep,
    suggestedSlots,
  };
}

/**
 * Suggests one-to-one session candidate per SPEC §12.18.6
 */
export function suggestOneToOne(
  club: Club,
  allPlayers: Record<PlayerId, Player>,
): {
  player: Player | null;
  type: OneToOneType;
  reason: string;
} {
  const squadPlayers = club.squad.map((id) => allPlayers[id]).filter((p): p is Player => p != null);
  const starters = squadPlayers.slice(0, 11);

  // 1. Lowest morale among starters if morale < 50
  const lowMoraleStarters = [...starters].sort((a, b) => a.morale - b.morale);
  if (lowMoraleStarters[0] && lowMoraleStarters[0].morale < 50) {
    const p = lowMoraleStarters[0];
    return {
      player: p,
      type: 'Confidence',
      reason: `Theo suggests ${p.lastName}: Confidence talk. Morale ${Math.round(p.morale)}, and his head went down recently.`,
    };
  }

  // 2. Fatigue > 60 starter
  const highFatigueStarter = starters.find((p) => p.fatigue > 60);
  if (highFatigueStarter) {
    return {
      player: highFatigueStarter,
      type: 'Fitness',
      reason: `Theo suggests ${highFatigueStarter.lastName}: Fitness work. High fatigue (${Math.round(highFatigueStarter.fatigue)}), needs targeted recovery.`,
    };
  }

  // 3. Young player with individual focus
  const youngWithFocus = squadPlayers.find(
    (p) => p.age <= 21 && club.trainingPlan.individualFocus?.[p.id],
  );
  if (youngWithFocus) {
    return {
      player: youngWithFocus,
      type: 'Technique',
      reason: `Theo suggests ${youngWithFocus.lastName}: Technique work. Young player showing great promise in individual drills.`,
    };
  }

  // 4. Default to starter who played last match
  const matchStarter = starters.find((p) => (p.stats.minutesLastMatch ?? 0) > 0) ?? starters[0];
  return {
    player: matchStarter ?? squadPlayers[0] ?? null,
    type: 'Video',
    reason: matchStarter
      ? `Theo suggests ${matchStarter.lastName}: Video of his last match to refine tactical positioning.`
      : 'No candidate available for one-to-one session.',
  };
}

/**
 * Applies a One-to-one session per SPEC §12.18.6
 */
export function applyOneToOneSession(
  type: OneToOneType,
  player: Player,
): {
  updatedPlayer: Player;
  appliedEffect: string;
} {
  const p: Player = JSON.parse(JSON.stringify(player));
  let effect = '';

  switch (type) {
    case 'Technique': {
      // positive growth this week x1.25 (stored on player or handled during dev)
      p.growth = roundTo(p.growth + 0.12, 3);
      effect = `${p.lastName} gained extra technique focus (+0.12 growth bonus).`;
      break;
    }
    case 'Confidence': {
      const baseDelta =
        p.morale < 50
          ? BALANCE.training.oneToOne.confidenceLowMorale
          : BALANCE.training.oneToOne.confidenceNormalMorale;
      let multiplier = 1.0;
      if (p.personality === 'Relaxed') {
        multiplier = BALANCE.training.oneToOne.confidenceRelaxedMult;
      } else if (p.personality === 'Leader') {
        multiplier = BALANCE.training.oneToOne.confidenceLeaderMult;
      }
      const delta = Math.round(baseDelta * multiplier);
      p.morale = clamp(p.morale + delta, 0, 100);
      effect = `${p.lastName} took confidence from the conversation (morale +${delta}).`;
      break;
    }
    case 'Fitness': {
      p.condition = clamp(p.condition + BALANCE.training.oneToOne.fitnessCondition, 0, 100);
      p.fatigue = clamp(p.fatigue + BALANCE.training.oneToOne.fitnessFatigue, 0, 100);
      effect = `${p.lastName} completed tailored fitness recovery (condition +6, fatigue -4).`;
      break;
    }
    case 'Video': {
      p.decisionContextBonus =
        (p.decisionContextBonus ?? 0) + BALANCE.training.oneToOne.videoContestsCtx;
      effect = `${p.lastName} reviewed last match footage (+0.05 decision contests bonus next match).`;
      break;
    }
  }

  return { updatedPlayer: p, appliedEffect: effect };
}

/**
 * Finds all overloaded players in squad per SPEC §12.18.9:
 * fatigue > 60 and workload isn't Light, OR Extra sessions with fatigue > 50
 */
export function getOverloadedPlayers(
  players: Player[],
  playerPlans?: Record<PlayerId, PersonalPlayerPlan>,
): Player[] {
  return players.filter((p) => {
    const plan = playerPlans?.[p.id];
    const workload = p.workload ?? plan?.workload ?? 'Normal';
    const extra = p.extraSessions ?? plan?.extraSessions ?? false;

    if (p.fatigue > 60 && workload !== 'Light') {
      return true;
    }
    if (extra && p.fatigue > 50) {
      return true;
    }
    return false;
  });
}

/**
 * Returns coach's note for a player from training.json based on strongest signal per SPEC §12.18.8
 */
export function getCoachNote(
  player: Player,
  latestRating?: number,
  prevRating?: number,
  growthDelta?: number,
): string {
  const notes = (rawTrainingData as { coachNotes?: Record<string, { id: string; text: string }[]> })
    .coachNotes;
  if (!notes) return 'Working hard in training.';

  const r = latestRating ?? player.lastTrainingRating ?? 7.0;
  const prevR = prevRating ?? r;

  // Signal 1: Condition low
  if (player.fatigue > 60 || player.condition < 70) {
    const pool = notes.condition_low;
    if (pool && pool.length > 0) return pool[Math.abs(player.id.charCodeAt(0)) % pool.length]!.text;
  }

  // Signal 2: Rating up
  if (r >= 8.0 || r - prevR >= 0.5) {
    const pool = notes.rating_up;
    if (pool && pool.length > 0) return pool[Math.abs(player.id.charCodeAt(0)) % pool.length]!.text;
  }

  // Signal 3: Rating down
  if (r <= 5.2 || prevR - r >= 0.5) {
    const pool = notes.rating_down;
    if (pool && pool.length > 0) return pool[Math.abs(player.id.charCodeAt(0)) % pool.length]!.text;
  }

  // Signal 4: Workload heavy
  if (player.workload === 'Heavy' || player.extraSessions) {
    const pool = notes.workload_heavy;
    if (pool && pool.length > 0) return pool[Math.abs(player.id.charCodeAt(0)) % pool.length]!.text;
  }

  // Signal 5: Growth
  if (growthDelta && growthDelta > 0.05) {
    const pool = notes.growth;
    if (pool && pool.length > 0) return pool[Math.abs(player.id.charCodeAt(0)) % pool.length]!.text;
  }

  // Signal 6: Age
  if (player.age <= 21 && notes.young && notes.young.length > 0) {
    return notes.young[Math.abs(player.id.charCodeAt(0)) % notes.young.length]!.text;
  }

  if (player.age >= 30 && notes.veteran && notes.veteran.length > 0) {
    return notes.veteran[Math.abs(player.id.charCodeAt(0)) % notes.veteran.length]!.text;
  }

  return 'Applying himself well in sessions.';
}

/**
 * Returns attribute progress indicator ('up' | 'down' | 'none') comparing to 4-week snapshot per SPEC §12.18.8
 */
export function getAttributeProgress(player: Player, attr: AttributeKey): 'up' | 'down' | 'none' {
  if (!player.attrHistory || player.attrHistory.length === 0) {
    return 'none';
  }

  // Compare with the earliest snapshot within the last 4 snapshots
  const snapshot = player.attrHistory[0];
  if (!snapshot || !snapshot.attributes) return 'none';

  const oldVal = snapshot.attributes[attr];
  if (oldVal === undefined) return 'none';

  const currentVal = player.attributes[attr];
  const delta = currentVal - oldVal;

  if (delta >= 1) return 'up';
  if (delta <= -1) return 'down';
  return 'none';
}
