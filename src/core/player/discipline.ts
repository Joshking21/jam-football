// Implements SPEC §12.6 Discipline, Cards, Bans, and Press Conference Triggers
import { Player, Club, Fixture, MatchResult } from '../types';
import { Rng } from '../rng';
import { BALANCE } from '@/config/balance';

export interface CardUpdateResult {
  player: Player;
  newYellowAccumulation: number;
  newSuspension: number;
  banReason?: 'YELLOW_ACCUMULATION' | 'SECOND_YELLOW' | 'DIRECT_RED';
}

/**
 * Updates a player's card accumulation and suspension based on match bookings
 */
export function processPlayerMatchCards(
  player: Player,
  cards: { yellow: number; red: number; isDirectRed?: boolean },
): CardUpdateResult {
  const nextPlayer: Player = JSON.parse(JSON.stringify(player));
  let banReason: CardUpdateResult['banReason'] = undefined;
  let addedSuspension = 0;

  if (cards.isDirectRed || (cards.red > 0 && cards.yellow === 0)) {
    // Direct red -> 2-match ban per SPEC §12.6
    addedSuspension = 2;
    banReason = 'DIRECT_RED';
  } else if (cards.red > 0) {
    // Second yellow -> red -> 1-match ban
    addedSuspension = 1;
    banReason = 'SECOND_YELLOW';
  }

  if (cards.yellow > 0 && cards.red === 0) {
    nextPlayer.yellowAccumulation = (nextPlayer.yellowAccumulation ?? 0) + cards.yellow;
    if (nextPlayer.yellowAccumulation >= BALANCE.discipline.yellowSuspensionCount) {
      addedSuspension = Math.max(addedSuspension, 1);
      nextPlayer.yellowAccumulation = 0; // reset after each ban
      banReason = 'YELLOW_ACCUMULATION';
    }
  }

  nextPlayer.suspendedMatches = (nextPlayer.suspendedMatches ?? 0) + addedSuspension;

  return {
    player: nextPlayer,
    newYellowAccumulation: nextPlayer.yellowAccumulation,
    newSuspension: nextPlayer.suspendedMatches,
    banReason,
  };
}

export interface PressTriggerCheckParams {
  fixture: Fixture;
  userClub: Club;
  opponentClub: Club;
  result: MatchResult;
  isUserHome: boolean;
  matchday: number;
  streak: { type: 'win' | 'lose' | 'draw' | 'none'; count: number };
  rng: Rng;
}

/**
 * Checks if a post-match press conference is triggered per SPEC §12.6:
 * - Derbies (always)
 * - Matchday 1
 * - Results against a club >= 2 reputation higher (win or draw)
 * - Losses by 3+ goals
 * - A winning/losing streak reaching 3
 * - Otherwise 30% chance
 */
export function shouldTriggerPostMatchPress(params: PressTriggerCheckParams): {
  triggered: boolean;
  reason?: string;
} {
  const { fixture, userClub, opponentClub, result, isUserHome, matchday, streak, rng } = params;

  const isDerby =
    userClub.rivals.includes(opponentClub.id) || opponentClub.rivals.includes(userClub.id);
  if (isDerby) {
    return { triggered: true, reason: 'Derby match' };
  }

  if (matchday === 1) {
    return { triggered: true, reason: 'Season opening matchday' };
  }

  const userGoals = isUserHome ? result.homeGoals : result.awayGoals;
  const oppGoals = isUserHome ? result.awayGoals : result.homeGoals;
  const userWon = userGoals > oppGoals;
  const isDraw = userGoals === oppGoals;
  const userLost = userGoals < oppGoals;
  const margin = Math.abs(userGoals - oppGoals);

  const repGap = opponentClub.reputation - userClub.reputation;
  if (repGap >= 2 && (userWon || isDraw)) {
    return { triggered: true, reason: 'Giant killing / notable result against higher reputation' };
  }

  if (userLost && margin >= 3) {
    return { triggered: true, reason: 'Heavy defeat by 3+ goals' };
  }

  if ((streak.type === 'win' || streak.type === 'lose') && streak.count >= 3) {
    return { triggered: true, reason: `${streak.count}-match ${streak.type} streak reached` };
  }

  if (rng.chance(0.3)) {
    return { triggered: true, reason: 'Standard media interest' };
  }

  return { triggered: false };
}
