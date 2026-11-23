// Implements SPEC §12.12 Knowledge and Scouting
// - Own players: exact attributes and OVR
// - Others unscouted: 12-point attribute band, 8-point OVR band, deterministic per (playerId, viewerClubId)
// - Scouted: exact values
// - Potential stars: 1 to 5 stars for own/scouted players
// - Queue limits: 2/round in window, 1/matchday outside

import { GameState, Player, PlayerId, ClubId, AttributeKey } from '../types';
import { deriveSeed, createRng } from '../rng';
import { clamp } from '../math';
import { BALANCE } from '../../config/balance';
import { getPrimaryOvr } from '../player/ratings';

export interface AttributeBand {
  low: number;
  high: number;
  isExact: boolean;
}

/**
 * Returns whether a viewer club has full scouting knowledge of a player.
 */
export function isPlayerScouted(player: Player, viewerClubId: ClubId): boolean {
  if (player.clubId === viewerClubId) return true;
  return player.scoutedBy?.includes(viewerClubId) ?? false;
}

/**
 * Computes deterministic attribute band for a player viewed by a specific club.
 * True value is always within [low, high].
 */
export function getScoutedAttribute(
  player: Player,
  attrKey: AttributeKey,
  viewerClubId: ClubId,
): AttributeBand {
  const trueVal = player.attributes[attrKey] ?? 50;
  if (isPlayerScouted(player, viewerClubId)) {
    return { low: trueVal, high: trueVal, isExact: true };
  }

  // Derive stable seed for this player, viewer club, and attribute
  const seed = deriveSeed(101, `${player.id}_${viewerClubId}_${attrKey}`);
  const rng = createRng(seed);
  const offset = rng.int(0, 11);
  const low = clamp(trueVal - offset, 1, 88);
  const high = low + 11;

  return { low, high, isExact: false };
}

/**
 * Computes deterministic OVR band for a player viewed by a specific club.
 * True OVR is always within [low, high].
 */
export function getScoutedOvr(player: Player, viewerClubId: ClubId): AttributeBand {
  const trueOvr = getPrimaryOvr(player);
  if (isPlayerScouted(player, viewerClubId)) {
    return { low: trueOvr, high: trueOvr, isExact: true };
  }

  const seed = deriveSeed(102, `${player.id}_${viewerClubId}_ovr`);
  const rng = createRng(seed);
  const offset = rng.int(0, 7);
  const low = clamp(trueOvr - offset, 1, 92);
  const high = low + 7;

  return { low, high, isExact: false };
}

/**
 * Computes potential stars (1 to 5) for own and scouted players per SPEC §12.12.
 * Unscouted players return null (hidden).
 */
export function getPotentialStars(player: Player, viewerClubId: ClubId): number | null {
  if (!isPlayerScouted(player, viewerClubId)) {
    return null;
  }
  const pot = player.potential;
  if (pot >= 85) return 5;
  if (pot >= 78) return 4;
  if (pot >= 71) return 3;
  if (pot >= 64) return 2;
  return 1;
}

/**
 * Computes deterministic knowledge percentage (0-100) of a player for a viewer club.
 * Own players and fully scouted players return 100%.
 * Unscouted players return a stable base knowledge percentage (15% to 50%).
 */
export function getPlayerKnowledge(player: Player, viewerClubId: ClubId): number {
  if (isPlayerScouted(player, viewerClubId)) {
    return 100;
  }
  const seed = deriveSeed(105, `${player.id}_${viewerClubId}_knowledge`);
  const rng = createRng(seed);
  return 15 + rng.int(0, 35);
}

/**
 * Check if the user club can scout a player at this moment.
 */
export function canScoutPlayer(
  state: GameState,
  playerId: PlayerId,
): { allowed: boolean; reason?: string } {
  const player = state.players[playerId];
  if (!player) return { allowed: false, reason: 'Player not found' };
  if (isPlayerScouted(player, state.userClubId)) {
    return { allowed: false, reason: 'Player is already fully scouted' };
  }

  const isInWindow = state.phase === 'TransferWindow';
  if (isInWindow) {
    const queue = state.window?.scoutingQueue ?? [];
    if (queue.includes(playerId)) {
      return { allowed: false, reason: 'Player is already in scouting queue' };
    }
    const maxPerRound = BALANCE.scouting.maxScoutingPerRoundInWindow;
    if (queue.length >= maxPerRound) {
      return {
        allowed: false,
        reason: `Scouting team at capacity (max ${maxPerRound} per window round)`,
      };
    }
    return { allowed: true };
  } else {
    // Outside windows: 1 per matchday
    const scoutedThisMD = state.scoutedThisMatchday ?? [];
    if (scoutedThisMD.includes(playerId)) {
      return { allowed: false, reason: 'Player already being scouted this matchday' };
    }
    const maxOutside = BALANCE.scouting.maxScoutingPerMatchdayOutside;
    if (scoutedThisMD.length >= maxOutside) {
      return {
        allowed: false,
        reason: `Already dispatched scouts this matchday (max ${maxOutside} per matchday)`,
      };
    }
    return { allowed: true };
  }
}

/**
 * Adds a player to the scouting queue.
 * - If inside transfer window: queued in state.window.scoutingQueue (resolves at advanceWindowRound)
 * - If outside window: immediately scouts or queues for the matchday advance
 */
export function queueScoutPlayer(state: GameState, playerId: PlayerId): GameState {
  const check = canScoutPlayer(state, playerId);
  if (!check.allowed) return state;

  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const isInWindow = next.phase === 'TransferWindow';

  if (isInWindow) {
    if (!next.window) {
      next.window = {
        kind: next.matchday === 0 ? 'Preseason' : 'Midseason',
        round: 1,
        offers: [],
        scoutingQueue: [],
        scoutingDoneThisRound: 0,
        boardWageRequestUsed: false,
      };
    }
    next.window.scoutingQueue.push(playerId);
  } else {
    if (!next.scoutedThisMatchday) {
      next.scoutedThisMatchday = [];
    }
    next.scoutedThisMatchday.push(playerId);
    // Mark player as scouted by user club
    const p = next.players[playerId];
    if (p) {
      if (!p.scoutedBy) p.scoutedBy = [];
      if (!p.scoutedBy.includes(next.userClubId)) {
        p.scoutedBy.push(next.userClubId);
      }
    }
    // Add inbox notice that scout report has landed
    const pName = p ? `${p.firstName} ${p.lastName}` : 'Player';
    next.inbox.unshift({
      id: `scout_report_${playerId}_${next.matchday}`,
      matchday: next.matchday,
      kind: 'Transfer',
      title: `Scout Report: ${pName}`,
      body: `Our scouting team has compiled a comprehensive profile on ${pName}. Exact attributes and potential rating have been filed into the club database.`,
      read: false,
      requiresAction: false,
    });
  }

  return next;
}

/**
 * Resolves scouting queue (invoked on window round advance).
 */
export function resolveScoutingQueue(state: GameState): GameState {
  if (!state.window || state.window.scoutingQueue.length === 0) return state;

  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const queue = [...next.window!.scoutingQueue];
  next.window!.scoutingQueue = [];
  next.window!.scoutingDoneThisRound += queue.length;

  for (const playerId of queue) {
    const p = next.players[playerId];
    if (!p) continue;
    if (!p.scoutedBy) p.scoutedBy = [];
    if (!p.scoutedBy.includes(next.userClubId)) {
      p.scoutedBy.push(next.userClubId);
    }

    const pName = `${p.firstName} ${p.lastName}`;
    next.inbox.unshift({
      id: `scout_report_win_${playerId}_${next.window!.round}`,
      matchday: next.matchday,
      kind: 'Transfer',
      title: `Scout Report: ${pName}`,
      body: `Our scouts have completed an in-depth dossier on ${pName}. Full attributes, positional versatility and estimated potential are now unlocked.`,
      read: false,
      requiresAction: false,
    });
  }

  return next;
}
