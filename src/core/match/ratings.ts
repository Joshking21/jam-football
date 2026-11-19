// Implements SPEC §13.14 Match ratings calculation & MOTM selection
import { PlayerId, PlayerMatchLine, Side } from '../types';
import { clamp, roundTo } from '../math';

export interface PlayerRatingContext {
  line: PlayerMatchLine;
  isGk: boolean;
  isDef: boolean;
  failedDribbles: number;
  errorsLeadingToGoal: number;
  teamGoalsConceded: number;
  isCleanSheet: boolean;
  teamWon: boolean;
  teamLost: boolean;
  scoredWinningGoal: boolean;
}

export function computePlayerRating(ctx: PlayerRatingContext): number {
  const {
    line,
    isGk,
    isDef,
    failedDribbles,
    errorsLeadingToGoal,
    teamGoalsConceded,
    isCleanSheet,
    teamWon,
    teamLost,
    scoredWinningGoal,
  } = ctx;

  // Players with < 10 minutes get no rating (represented as 0)
  if (line.minutes < 10) {
    return 0;
  }

  let r = 6.0;

  // Goal adjustments
  r += line.goals * 1.0;
  if (scoredWinningGoal) {
    r += 0.3;
  }

  // Assists & chances
  r += line.assists * 0.6;
  r += line.keyPasses * 0.15;
  r += line.shotsOnTarget * 0.1;
  r += line.dribbles * 0.05;
  r += (line.tackles + line.interceptions) * 0.08;

  // Pass completion adjustment (only if >= 10 passes)
  if (line.passes >= 10) {
    const pc = line.passesCompleted / line.passes;
    r += (pc - 0.8) * 2.0;
  }

  // Negative actions
  r -= failedDribbles * 0.04;
  // Foul penalty is -0.05 per foul (cards are separate)
  // Cards
  r -= line.yellow * 0.3;
  r -= line.red * 1.0;
  r -= errorsLeadingToGoal * 0.6;

  // Goalkeeper specific
  if (isGk) {
    r += line.saves * 0.25;
    r -= teamGoalsConceded * 0.25;
    if (isCleanSheet && line.minutes >= 60) {
      r += 0.5;
    }
  }

  // Defender specific
  if (isDef) {
    r -= teamGoalsConceded * 0.1;
    if (isCleanSheet && line.minutes >= 60) {
      r += 0.5;
    }
  }

  // Team outcome
  if (teamWon) r += 0.2;
  if (teamLost) r -= 0.2;

  // Clamp 3.0 - 10.0 and round to 1 decimal place
  return roundTo(clamp(r, 3.0, 10.0), 1);
}

export function selectMotm(players: PlayerMatchLine[], winningSide: Side | null): PlayerId {
  // MOTM = highest rating (tie: more goals, then the winning team, then lower id)
  const rated = players.filter((p) => p.minutes >= 10 && p.rating > 0);
  if (rated.length === 0) {
    return players[0]?.playerId ?? ('' as PlayerId);
  }

  const sorted = [...rated].sort((a, b) => {
    // 1. Highest rating
    if (b.rating !== a.rating) return b.rating - a.rating;
    // 2. More goals
    if (b.goals !== a.goals) return b.goals - a.goals;
    // 3. Winning team
    const aWin = a.side === winningSide ? 1 : 0;
    const bWin = b.side === winningSide ? 1 : 0;
    if (bWin !== aWin) return bWin - aWin;
    // 4. Lower id
    return a.playerId.localeCompare(b.playerId);
  });

  return sorted[0]!.playerId;
}
