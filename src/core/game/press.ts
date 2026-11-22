// Implements SPEC §12.6 Discipline and press triggers & §16.2 Press conferences
import {
  GameState,
  Journalist,
  PendingPressConference,
  PressAnswer,
  PressContext,
  PressQuestion,
  PlayerId,
} from '../types';
import { Rng } from '../rng';
import { clamp } from '../math';
import rawPress from '@/content/press.json';

interface PressDataFile {
  journalists: Journalist[];
  questions: PressQuestion[];
}

const PRESS_DATA = rawPress as PressDataFile;

export function getJournalists(): Journalist[] {
  return PRESS_DATA.journalists;
}

export function getAllPressQuestions(): PressQuestion[] {
  return PRESS_DATA.questions;
}

export interface PostMatchPressTriggerParams {
  isDerby: boolean;
  matchday: number;
  userWonOrDrawnAgainstHighRep: boolean;
  lossByThreeOrMore: boolean;
  streakReachedThree: boolean;
}

/**
 * Evaluates whether a post-match press conference triggers per SPEC §12.6:
 * - Derbies (always)
 * - Matchday 1 (always)
 * - Results against a club >= 2 reputation higher (win or draw)
 * - Losses by 3+
 * - A winning or losing streak reaching 3
 * - Otherwise 30% chance
 */
export function shouldTriggerPostMatchPress(
  params: PostMatchPressTriggerParams,
  rng: Rng,
): boolean {
  if (params.isDerby) return true;
  if (params.matchday === 1) return true;
  if (params.userWonOrDrawnAgainstHighRep) return true;
  if (params.lossByThreeOrMore) return true;
  if (params.streakReachedThree) return true;
  return rng.chance(0.3);
}

/**
 * Pre-match press conference trigger per SPEC §12.6:
 * Pre-match press (optional) before derbies only.
 */
export function shouldTriggerPreMatchPress(isDerby: boolean): boolean {
  return isDerby;
}

export interface PressContextParams {
  isPreMatch?: boolean;
  isDerby?: boolean;
  matchday: number;
  userGoals: number;
  oppGoals: number;
  userRep: number;
  oppRep: number;
  winStreak: number;
  lossStreak: number;
  topRating?: { playerId: PlayerId; rating: number };
  lowRating?: { playerId: PlayerId; rating: number };
}

/**
 * Determines the most fitting PressContext given match events and standings per SPEC §16.2
 */
export function determinePressContext(params: PressContextParams, rng: Rng): PressContext {
  if (params.isPreMatch && params.isDerby) {
    return 'PRE_DERBY';
  }

  if (params.matchday === 1) {
    return 'OPENING_DAY';
  }

  const goalDiff = params.userGoals - params.oppGoals;

  // Upset win: beat team with reputation >= ours + 2
  if (goalDiff > 0 && params.oppRep >= params.userRep + 2) {
    return 'POST_UPSET_WIN';
  }

  // Heavy scoreline
  if (goalDiff <= -3) {
    return 'POST_BIG_LOSS';
  }
  if (goalDiff >= 3) {
    return 'POST_BIG_WIN';
  }

  // Streaks (3 or more)
  if (params.winStreak >= 3 && goalDiff > 0) {
    return 'STREAK_WIN';
  }
  if (params.lossStreak >= 3 && goalDiff < 0) {
    return 'STREAK_LOSS';
  }

  // Player praise / criticism if standout performance occurs
  if (params.topRating && params.topRating.rating >= 8.5 && rng.chance(0.5)) {
    return 'PLAYER_PRAISE';
  }
  if (params.lowRating && params.lowRating.rating <= 5.5 && goalDiff < 0 && rng.chance(0.5)) {
    return 'PLAYER_CRITICISM';
  }

  // Standard match outcome
  if (goalDiff > 0) return 'POST_WIN';
  if (goalDiff === 0) return 'POST_DRAW';
  return 'POST_LOSS';
}

export interface PressTokens {
  opponent: string;
  club: string;
  player?: string;
  score?: string;
}

function replaceTokens(text: string, tokens: PressTokens): string {
  let res = text;
  res = res.replace(/\{opponent\}/g, tokens.opponent);
  res = res.replace(/\{club\}/g, tokens.club);
  if (tokens.player) {
    res = res.replace(/\{player\}/g, tokens.player);
  }
  if (tokens.score) {
    res = res.replace(/\{score\}/g, tokens.score);
  }
  return res;
}

/**
 * Generates a pending press conference per SPEC §16.2:
 * Selects an unasked question for the context, assigns a journalist, replaces tokens.
 */
export function generatePressConference(
  context: PressContext,
  pressHistory: string[],
  tokens: PressTokens,
  rng: Rng,
  targetPlayerId?: PlayerId,
): PendingPressConference {
  const journalists = getJournalists();
  const journalistIndex = rng.int(0, journalists.length - 1);
  const journalist = journalists[journalistIndex] ?? journalists[0]!;

  const allQuestions = getAllPressQuestions();
  let pool = allQuestions.filter((q) => q.context.includes(context));

  if (pool.length === 0) {
    pool = allQuestions.filter((q) => q.context.includes('POST_WIN'));
  }

  // Prioritize questions not in pressHistory for this season (SPEC §19.8: no repeated questions in same season)
  let available = pool.filter((q) => !pressHistory.includes(q.id));
  if (available.length === 0) {
    available = pool; // fallback if season ran through all 4
  }

  const selectedQuestionIndex = rng.int(0, available.length - 1);
  const rawQ = available[selectedQuestionIndex] ?? available[0]!;

  const resolvedQuestion: PressQuestion = {
    id: rawQ.id,
    context: rawQ.context,
    text: replaceTokens(rawQ.text, tokens),
    voText: rawQ.voText,
    answers: rawQ.answers.map((a) => ({
      id: a.id,
      tone: a.tone,
      text: replaceTokens(a.text, tokens),
      voText: a.voText,
      effects: { ...a.effects },
    })),
  };

  return {
    id: `press_${rng.int(10000, 99999)}_${rawQ.id}`,
    context,
    journalist,
    question: resolvedQuestion,
    targetPlayerName: tokens.player,
    targetPlayerId,
  };
}

export interface PressAnswerResult {
  fansDelta: number;
  boardDelta: number;
  squadMoraleDelta: number;
  playerMoraleDelta: number;
  targetPlayerId?: PlayerId;
  managerSpeech: string;
  tone: string;
}

/**
 * Applies the manager's chosen press answer to the GameState per SPEC §16.2
 */
export function applyPressAnswer(
  gameState: GameState,
  pending: PendingPressConference,
  answerId: string,
): PressAnswerResult {
  const userClub = gameState.clubs[gameState.userClubId];
  const answer = pending.question.answers.find((a) => a.id === answerId);

  const fansDelta = answer?.effects.fans ?? 0;
  const boardDelta = answer?.effects.board ?? 0;
  const squadMoraleDelta = answer?.effects.squadMorale ?? 0;
  const playerMoraleDelta = answer?.effects.playerMorale ?? 0;
  const targetPlayerId = pending.targetPlayerId ?? answer?.effects.targetPlayerId;

  if (userClub) {
    userClub.fanMood = clamp(userClub.fanMood + fansDelta, 0, 100);
    userClub.boardConfidence = clamp(userClub.boardConfidence + boardDelta, 0, 100);
  }

  // Squad morale effect
  if (squadMoraleDelta !== 0 && userClub) {
    for (const player of Object.values(gameState.players)) {
      if (player.clubId === userClub.id) {
        player.morale = clamp(player.morale + squadMoraleDelta, 0, 100);
      }
    }
  }

  // Target player morale effect
  if (playerMoraleDelta !== 0 && targetPlayerId && gameState.players[targetPlayerId]) {
    const target = gameState.players[targetPlayerId]!;
    target.morale = clamp(target.morale + playerMoraleDelta, 0, 100);
  }

  // Record conditional risk if applicable
  if (answer?.effects.nextMatchCondition) {
    gameState.activePressCondition = answer.effects.nextMatchCondition;
  }

  // Add question id to pressHistory
  if (!gameState.pressHistory.includes(pending.question.id)) {
    gameState.pressHistory.push(pending.question.id);
  }

  pending.resolvedAnswerId = answerId;
  gameState.pendingPress = null;

  return {
    fansDelta,
    boardDelta,
    squadMoraleDelta,
    playerMoraleDelta,
    targetPlayerId,
    managerSpeech: answer?.text ?? '',
    tone: answer?.tone ?? 'Measured',
  };
}
