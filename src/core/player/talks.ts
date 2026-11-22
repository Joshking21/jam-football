// Implements SPEC §12.8 & §16.3 Team Talks, Morale Dynamics, and In-Match Focus Boost
import { Player, Personality, PlayerId } from '../types';
import { Rng } from '../rng';
import { clamp, roundTo } from '../math';
import rawTalks from '@/content/talks.json';

export type TalkTone = 'Calm' | 'Motivate' | 'Demand' | 'Praise' | 'Disappoint' | 'Focus';

export type TalkContext =
  | 'PRE_FAV'
  | 'PRE_DOG'
  | 'PRE_EVEN'
  | 'HT_WIN'
  | 'HT_DRAW'
  | 'HT_LOSE'
  | 'FT_WIN'
  | 'FT_DRAW'
  | 'FT_LOSE';

export interface ManagerLine {
  id: string;
  text: string;
  voText: string;
  nameSlot?: 'start' | 'end';
}

export interface TalkContentEntry {
  managerLines: ManagerLine[];
  reactions: {
    positive: string;
    neutral: string;
    negative: string;
    mixed: string;
  };
}

export type TalksContent = Record<TalkContext, Record<TalkTone, TalkContentEntry>>;

export const TALKS_DATA: TalksContent = rawTalks as TalksContent;

export const TALK_BASE_EFFECTS: Record<TalkContext, Record<TalkTone, number>> = {
  PRE_FAV: { Calm: 2, Motivate: 1, Demand: 3, Praise: 0, Disappoint: -3, Focus: 3 },
  PRE_DOG: { Calm: 3, Motivate: 4, Demand: -2, Praise: 1, Disappoint: -4, Focus: 2 },
  PRE_EVEN: { Calm: 2, Motivate: 3, Demand: 1, Praise: 1, Disappoint: -3, Focus: 3 },
  HT_WIN: { Calm: 2, Motivate: 0, Demand: 2, Praise: 3, Disappoint: -4, Focus: 3 },
  HT_DRAW: { Calm: 1, Motivate: 3, Demand: 2, Praise: 0, Disappoint: -1, Focus: 2 },
  HT_LOSE: { Calm: 1, Motivate: 3, Demand: 2, Praise: -2, Disappoint: 1, Focus: 1 },
  FT_WIN: { Calm: 1, Motivate: 0, Demand: -1, Praise: 5, Disappoint: -5, Focus: 1 },
  FT_DRAW: { Calm: 2, Motivate: 1, Demand: 0, Praise: 1, Disappoint: -1, Focus: 1 },
  FT_LOSE: { Calm: 2, Motivate: 1, Demand: 1, Praise: -3, Disappoint: 3, Focus: 0 },
};

export type TalkPredictedReaction = 'Most will respond well' | 'Mixed' | 'Likely to backfire';

export function getPreMatchTalkContext(userAvgOvr: number, oppAvgOvr: number): TalkContext {
  const gap = userAvgOvr - oppAvgOvr;
  if (gap >= 3) return 'PRE_FAV';
  if (gap <= -3) return 'PRE_DOG';
  return 'PRE_EVEN';
}

export function getHalfTimeTalkContext(userGoals: number, oppGoals: number): TalkContext {
  if (userGoals > oppGoals) return 'HT_WIN';
  if (userGoals < oppGoals) return 'HT_LOSE';
  return 'HT_DRAW';
}

export function getFullTimeTalkContext(userGoals: number, oppGoals: number): TalkContext {
  if (userGoals > oppGoals) return 'FT_WIN';
  if (userGoals < oppGoals) return 'FT_LOSE';
  return 'FT_DRAW';
}

/**
 * Predicts the squad reaction for UI display per SPEC §12.8:
 * "Most will respond well / Mixed / Likely to backfire"
 */
export function predictTalkReaction(context: TalkContext, tone: TalkTone): TalkPredictedReaction {
  const base = TALK_BASE_EFFECTS[context]?.[tone] ?? 0;
  if (base >= 1.5) return 'Most will respond well';
  if (base >= -0.5) return 'Mixed';
  return 'Likely to backfire';
}

/**
 * Calculates morale change for a single player given context, tone, and personality per SPEC §12.8
 */
export function calculatePlayerTalkMorale(
  context: TalkContext,
  tone: TalkTone,
  personality: Personality,
  rng: Rng,
): number {
  let val = TALK_BASE_EFFECTS[context]?.[tone] ?? 0;

  switch (personality) {
    case 'Professional':
      // ×1.0, and never below 0 for Demand/Focus
      if ((tone === 'Demand' || tone === 'Focus') && val < 0) {
        val = 0;
      }
      break;

    case 'Ambitious':
      // ×1.2 for Demand/Focus, ×0.8 for Calm
      if (tone === 'Demand' || tone === 'Focus') {
        val *= 1.2;
      } else if (tone === 'Calm') {
        val *= 0.8;
      }
      break;

    case 'Leader':
      // ×1.3 for all positive
      if (val > 0) {
        val *= 1.3;
      }
      break;

    case 'Relaxed':
      // negative effects ×0.5, positive ×0.8
      if (val < 0) {
        val *= 0.5;
      } else if (val > 0) {
        val *= 0.8;
      }
      break;

    case 'Temperamental':
      // Demand and Disappoint flip sign with 40% chance (roll per player), all ×1.3
      if ((tone === 'Demand' || tone === 'Disappoint') && rng.chance(0.4)) {
        val = -val;
      }
      val *= 1.3;
      break;

    case 'Loyal':
      // Praise ×1.3, others ×1.0
      if (tone === 'Praise') {
        val *= 1.3;
      }
      break;
  }

  return Math.round(val);
}

export interface TeamTalkResult {
  updatedPlayers: Record<PlayerId, Player>;
  averageMoraleDelta: number;
  focusBoost: number;
  managerSpeech: string;
  squadReaction: string;
  playerDeltas: Record<PlayerId, number>;
}

/**
 * Applies a team talk to a squad of players per SPEC §12.8
 */
export function applyTeamTalk(
  players: Record<PlayerId, Player>,
  squadIds: PlayerId[],
  context: TalkContext,
  tone: TalkTone,
  rng: Rng,
): TeamTalkResult {
  const content = TALKS_DATA[context]?.[tone];
  const speechLines: ManagerLine[] = content?.managerLines ?? [
    {
      id: 'fallback_01',
      text: 'Let us give everything on the pitch today.',
      voText: 'Let us give everything on the pitch today.',
    },
  ];
  const chosenLine = speechLines[rng.int(0, speechLines.length - 1)]!;
  const managerSpeech = chosenLine.text;

  const updatedPlayers: Record<PlayerId, Player> = {};
  const playerDeltas: Record<PlayerId, number> = {};
  let totalDelta = 0;
  let count = 0;

  for (const id of squadIds) {
    const p = players[id];
    if (!p) continue;

    const delta = calculatePlayerTalkMorale(context, tone, p.personality, rng);
    const updated = JSON.parse(JSON.stringify(p)) as Player;
    updated.morale = clamp(updated.morale + delta, 0, 100);

    updatedPlayers[id] = updated;
    playerDeltas[id] = delta;
    totalDelta += delta;
    count++;
  }

  const avgDelta = count > 0 ? roundTo(totalDelta / count, 2) : 0;

  // In-match effect: pre-match and half-time talks grant team-wide focusBoost = avg / 100 (in z-units)
  const isPreOrHt = context.startsWith('PRE_') || context.startsWith('HT_');
  const focusBoost = isPreOrHt ? Math.max(0, roundTo(avgDelta / 100, 4)) : 0;

  let reactionKey: 'positive' | 'neutral' | 'negative' | 'mixed' = 'neutral';
  if (avgDelta >= 2.0) reactionKey = 'positive';
  else if (avgDelta >= 0.5) reactionKey = 'neutral';
  else if (avgDelta <= -1.5) reactionKey = 'negative';
  else reactionKey = 'mixed';

  const squadReaction =
    content?.reactions[reactionKey] ?? 'The squad acknowledges the manager address.';

  return {
    updatedPlayers,
    averageMoraleDelta: avgDelta,
    focusBoost,
    managerSpeech,
    squadReaction,
    playerDeltas,
  };
}
