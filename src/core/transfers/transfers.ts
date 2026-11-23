// Implements SPEC §12.13 Transfers (Windows, Bids, AI Activity, Contracts)
import {
  GameState,
  Club,
  Player,
  PlayerId,
  ClubId,
  TransferOffer,
  TransferWindowState,
  SquadRole,
  InboxItem,
} from '../types';
import { valueOf, wageFor } from '../player/value';
import { getPrimaryOvr } from '../player/ratings';
import { deriveSeed, createRng } from '../rng';
import { clamp, formatMoney } from '../math';
import { BALANCE } from '../../config/balance';
import { resolveScoutingQueue } from './scouting';
import { generateTransferNews } from '../news/news';

function roleRank(role: SquadRole): number {
  switch (role) {
    case 'Star':
      return 5;
    case 'Starter':
      return 4;
    case 'Rotation':
      return 3;
    case 'Backup':
      return 2;
    case 'Prospect':
      return 1;
    default:
      return 2;
  }
}

/**
 * Computes asking price for a player being sold by sellingClub to buyingClub per SPEC §12.13.1.
 */
export function calculateAskingPrice(
  player: Player,
  sellingClub: Club | null,
  buyingClub: Club,
  isDeadlineDay = false,
  allPlayers: Record<PlayerId, Player> = {},
): number {
  if (!sellingClub) return 0; // Free agents require no transfer fee

  const baseVal = valueOf(player);

  // Importance rank inside selling club
  const squadPlayers = sellingClub.squad.map((id) => allPlayers[id]).filter(Boolean) as Player[];
  squadPlayers.sort((a, b) => getPrimaryOvr(b) - getPrimaryOvr(a));

  const rank = squadPlayers.findIndex((p) => p.id === player.id);
  let importance: number = BALANCE.transfers.importanceDefault;
  if (rank >= 0 && rank < 3) {
    importance = BALANCE.transfers.importanceTop3; // 1.6
  } else if (rank >= 3 && rank < 11) {
    importance = BALANCE.transfers.importanceRank4To11; // 1.25
  }

  // Window factor: Deadline Day x1.1
  const windowFactor = isDeadlineDay ? BALANCE.transfers.deadlineDayFactor : 1.0;

  // Rep factor: buyer rep > seller rep x1.05
  const repFactor =
    buyingClub.reputation > sellingClub.reputation ? BALANCE.transfers.buyerRepHigherFactor : 1.0;

  return Math.round(baseVal * importance * windowFactor * repFactor);
}

/**
 * Evaluates whether selling club accepts, counters, or rejects a fee bid per SPEC §12.13.2.
 */
export function evaluateBid(
  fee: number,
  ask: number,
  player: Player,
  sellingClub: Club | null,
  seed: number,
  allPlayers: Record<PlayerId, Player> = {},
): { status: 'Accepted' | 'Countered' | 'Rejected'; counterFee?: number } {
  if (!sellingClub) return { status: 'Accepted' };

  // Check "Not for sale": club's top 1 by OVR at rep-5 clubs (reject bids below 2.5x value)
  if (sellingClub.reputation === 5) {
    const squadPlayers = sellingClub.squad.map((id) => allPlayers[id]).filter(Boolean) as Player[];
    squadPlayers.sort((a, b) => getPrimaryOvr(b) - getPrimaryOvr(a));
    if (squadPlayers[0]?.id === player.id && fee < 2.5 * valueOf(player)) {
      return { status: 'Rejected' };
    }
  }

  if (fee >= ask) {
    return { status: 'Accepted' };
  }

  if (fee >= BALANCE.transfers.bidCounterThreshold * ask) {
    const rng = createRng(seed);
    const counterRatio =
      BALANCE.transfers.bidCounterMin +
      rng.next() * (BALANCE.transfers.bidCounterMax - BALANCE.transfers.bidCounterMin);
    const counterFee = Math.round(ask * counterRatio);
    return { status: 'Countered', counterFee };
  }

  return { status: 'Rejected' };
}

/**
 * Evaluates personal terms & contract decision per SPEC §12.13.3.
 */
export function evaluatePlayerContract(
  player: Player,
  sellingClub: Club | null,
  buyingClub: Club,
  offer: { wagePerWeek: number; years: 1 | 2 | 3 | 4; role: SquadRole },
  seed: number,
): { accepted: boolean; counterWage?: number; reason?: string } {
  // Willingness check
  if (sellingClub) {
    const isWillingRep = buyingClub.reputation >= sellingClub.reputation - 1;
    const isWillingWage = player.contract && offer.wagePerWeek >= 1.3 * player.contract.wagePerWeek;
    if (!isWillingRep && !isWillingWage) {
      return {
        accepted: false,
        reason: `${player.lastName} is unwilling to take a step down in club stature.`,
      };
    }

    if (player.personality === 'Ambitious') {
      if (buyingClub.reputation < sellingClub.reputation) {
        return {
          accepted: false,
          reason: `${player.lastName} is ambitious and will only move to a club of equal or higher reputation.`,
        };
      }
    }

    if (player.personality === 'Loyal') {
      const rng = createRng(deriveSeed(seed, `${player.id}_loyal`));
      if (rng.next() < BALANCE.transfers.loyalRefusalChance) {
        return {
          accepted: false,
          reason: `${player.lastName} feels deep loyalty to ${sellingClub.name} and refuses to depart.`,
        };
      }
    }
  }

  // Wage ask calculation
  const currentWage = player.contract?.wagePerWeek ?? 1000;
  let askWage = Math.max(
    currentWage * BALANCE.transfers.wageIncreaseBase,
    wageFor(valueOf(player)),
  );

  // Downgrade in role increases ask by 20%
  const currentRole = player.contract?.role ?? 'Starter';
  if (roleRank(offer.role) < roleRank(currentRole)) {
    askWage *= BALANCE.transfers.wageIncreaseRoleDowngrade;
  }

  // Role promise discount: Star x0.9, Starter x0.95
  let roleDiscount = 1.0;
  if (offer.role === 'Star') roleDiscount = BALANCE.transfers.roleDiscountStar;
  else if (offer.role === 'Starter') roleDiscount = BALANCE.transfers.roleDiscountStarter;

  const targetWage = Math.round(askWage * roleDiscount);

  if (offer.wagePerWeek >= targetWage) {
    return { accepted: true };
  }

  // Counter offer if close (within 85%)
  if (offer.wagePerWeek >= Math.round(targetWage * 0.85)) {
    const counterWage = Math.round((offer.wagePerWeek + targetWage) / 2);
    return {
      accepted: false,
      counterWage,
      reason: `${player.lastName} countered requesting ${formatMoney(counterWage)}/week.`,
    };
  }

  return {
    accepted: false,
    reason: `Offer of ${formatMoney(offer.wagePerWeek)}/wk is well below ${player.lastName}'s salary expectations.`,
  };
}

/**
 * Finalizes and applies a completed transfer in GameState per SPEC §12.13.3.
 */
export function completeTransfer(state: GameState, offer: TransferOffer): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const player = next.players[offer.playerId];
  if (!player) return state;

  const buyingClub = next.clubs[offer.toClubId];
  if (!buyingClub) return state;

  const sellingClub = offer.fromClubId ? next.clubs[offer.fromClubId] : null;

  const fee = offer.fee;
  const contractOffer = offer.contractOffer ?? {
    wagePerWeek: wageFor(valueOf(player)),
    years: 3,
    role: 'Starter',
  };

  // Financial transfers
  buyingClub.balance -= fee;
  buyingClub.transferBudget -= fee;
  buyingClub.seasonStats.transferOut += fee;

  if (sellingClub) {
    sellingClub.balance += fee;
    sellingClub.transferBudget += Math.round(fee * 0.5); // +50% of fee to transferBudget
    sellingClub.seasonStats.transferIn += fee;

    // Remove from selling club squad and lineup
    sellingClub.squad = sellingClub.squad.filter((id) => id !== player.id);
    sellingClub.tactics.lineup = sellingClub.tactics.lineup.map((id) =>
      id === player.id ? null : id,
    );
    sellingClub.tactics.bench = sellingClub.tactics.bench.filter((id) => id !== player.id);
  }

  // Add to buying club squad
  if (!buyingClub.squad.includes(player.id)) {
    buyingClub.squad.push(player.id);
  }

  // Update player club and contract
  player.clubId = buyingClub.id;
  player.contract = {
    wagePerWeek: contractOffer.wagePerWeek,
    yearsLeft: contractOffer.years,
    role: contractOffer.role,
  };
  player.transferListed = false;

  // Add history record
  player.history.push({
    matchday: next.matchday,
    event: sellingClub
      ? `Transferred from ${sellingClub.name} to ${buyingClub.name} for ${formatMoney(fee)}.`
      : `Signed by ${buyingClub.name} as a free agent on ${formatMoney(contractOffer.wagePerWeek)}/wk.`,
  });

  // Calculate Best XI average of buyer before this signing
  const buyerSquad = buyingClub.squad.map((id) => next.players[id]).filter(Boolean) as Player[];
  buyerSquad.sort((a, b) => getPrimaryOvr(b) - getPrimaryOvr(a));
  const best11 = buyerSquad.slice(0, 11);
  const best11Avg =
    best11.reduce((sum, p) => sum + getPrimaryOvr(p), 0) / Math.max(1, best11.length);

  // Fan mood bonus: if player OVR >= best XI avg + 3 -> +5
  if (getPrimaryOvr(player) >= best11Avg + BALANCE.transfers.fanMoodSigningOvrDiff) {
    buyingClub.fanMood = clamp(buyingClub.fanMood + BALANCE.transfers.fanMoodSigningBonus, 0, 100);
  }

  // Fan mood penalty for user club if star sold: morale >= 60, apps >= 5, top 3 OVR -> -8
  if (sellingClub && sellingClub.id === next.userClubId) {
    const isTop3 = squadPlayersRank(sellingClub, player, next.players) < 3;
    if (player.morale >= 60 && player.stats.apps >= 5 && isTop3) {
      sellingClub.fanMood = clamp(
        sellingClub.fanMood + BALANCE.transfers.fanMoodSellingPenalty,
        0,
        100,
      );
    }
  }

  // Mark offer as Completed
  offer.status = 'Completed';
  if (next.window) {
    const existingIndex = next.window.offers.findIndex((o) => o.id === offer.id);
    if (existingIndex >= 0) {
      next.window.offers[existingIndex] = offer;
    } else {
      next.window.offers.push(offer);
    }
  }

  // Generate news item
  const newsItem = generateTransferNews(
    player,
    sellingClub ?? null,
    buyingClub,
    fee,
    next.window?.round === 3,
    next.matchday,
  );
  next.news.unshift(newsItem);

  // Send inbox notification
  const pName = `${player.firstName} ${player.lastName}`;
  if (buyingClub.id === next.userClubId) {
    next.inbox.unshift({
      id: `inbox_trans_in_${player.id}_${next.matchday}`,
      matchday: next.matchday,
      kind: 'Transfer',
      title: `Transfer Complete: ${pName} Signs`,
      body: `${pName} has successfully completed his move to ${buyingClub.name} for a fee of ${formatMoney(fee)}. Personal terms agreed at ${formatMoney(contractOffer.wagePerWeek)}/week.`,
      read: false,
      requiresAction: false,
    });
  } else if (sellingClub && sellingClub.id === next.userClubId) {
    next.inbox.unshift({
      id: `inbox_trans_out_${player.id}_${next.matchday}`,
      matchday: next.matchday,
      kind: 'Transfer',
      title: `Transfer Complete: ${pName} Departs`,
      body: `${pName} has completed his departure to ${buyingClub.name} for an agreed fee of ${formatMoney(fee)}. Funds have been credited to the club treasury.`,
      read: false,
      requiresAction: false,
    });
  }

  return next;
}

function squadPlayersRank(club: Club, player: Player, players: Record<PlayerId, Player>): number {
  const squad = club.squad.map((id) => players[id]).filter(Boolean) as Player[];
  squad.sort((a, b) => getPrimaryOvr(b) - getPrimaryOvr(a));
  return squad.findIndex((p) => p.id === player.id);
}

/**
 * Generates incoming bids from AI clubs for user players per SPEC §12.13.4.
 */
export function generateAiIncomingBids(state: GameState, seed: number): GameState {
  if (!state.window) return state;

  const next = JSON.parse(JSON.stringify(state)) as GameState;
  if (!next.window) return next;
  const userClub = next.clubs[next.userClubId];
  if (!userClub) return state;

  const rng = createRng(deriveSeed(seed, `ai_bids_rnd_${next.window.round}`));

  for (const [clubId, club] of Object.entries(next.clubs)) {
    if (clubId === next.userClubId || club.transferBudget <= 0) continue;

    // 15% chance to bid (x3 if player is transfer listed)
    const baseChance = BALANCE.transfers.aiBidChance;

    // Find weakest slot in AI club
    const aiSquad = club.squad.map((id) => next.players[id]).filter(Boolean) as Player[];
    aiSquad.sort((a, b) => getPrimaryOvr(a) - getPrimaryOvr(b)); // lowest first
    const weakestPlayer = aiSquad[0];
    const weakestOvr = weakestPlayer ? getPrimaryOvr(weakestPlayer) : 55;

    // Find user players that improve that slot by >= 2
    const candidates = userClub.squad
      .map((id) => next.players[id])
      .filter((p) => {
        if (!p) return false;
        const ovr = getPrimaryOvr(p);
        return ovr >= weakestOvr + 2 && valueOf(p) <= club.transferBudget;
      }) as Player[];

    if (candidates.length === 0) continue;

    for (const cand of candidates) {
      const chance = cand.transferListed
        ? baseChance * BALANCE.transfers.aiBidListedMultiplier
        : baseChance;

      if (rng.next() < chance) {
        // AI makes an offer
        const val = valueOf(cand);
        const feeRatio =
          BALANCE.transfers.aiBidMinOffer +
          rng.next() * (BALANCE.transfers.aiBidMaxOffer - BALANCE.transfers.aiBidMinOffer);
        const fee = Math.round(val * feeRatio);

        const offerId = `offer_ai_${club.id}_${cand.id}_${next.window.round}_${rng.int(100, 999)}`;
        const newOffer: TransferOffer = {
          id: offerId,
          playerId: cand.id,
          fromClubId: userClub.id,
          toClubId: club.id,
          fee,
          status: 'Pending',
          createdRound: next.window.round,
          bidsMade: 1,
        };

        next.window.offers.push(newOffer);

        // Notify user via inbox
        const candName = `${cand.firstName} ${cand.lastName}`;
        next.inbox.unshift({
          id: `inbox_bid_${offerId}`,
          matchday: next.matchday,
          kind: 'Transfer',
          title: `Transfer Bid Received: ${candName}`,
          body: `${club.name} have submitted a formal transfer offer of ${formatMoney(fee)} for ${candName}. Review and respond in the Transfers office before the window advances.`,
          read: false,
          requiresAction: true,
          action: {
            type: 'transferOffer',
            refId: offerId,
          },
        });

        break; // Max 1 bid per AI club per round
      }
    }
  }

  return next;
}

/**
 * Runs AI-to-AI transfer market activity per SPEC §12.13.5.
 */
export function runAiAiTransfers(state: GameState, seed: number): GameState {
  if (!state.window) return state;

  const winRound = state.window.round;
  let next = JSON.parse(JSON.stringify(state)) as GameState;
  const rng = createRng(deriveSeed(seed, `ai_ai_rnd_${winRound}`));

  const aiClubs = Object.values(next.clubs).filter((c) => c.id !== next.userClubId);

  for (const club of aiClubs) {
    if (rng.next() >= BALANCE.transfers.aiMoveChance) continue;
    if (club.squad.length >= BALANCE.transfers.maxSquadSize) continue;

    // Check club mean OVR
    const squadPlayers = club.squad.map((id) => next.players[id]).filter(Boolean) as Player[];
    if (squadPlayers.length === 0) continue;

    const clubMean = squadPlayers.reduce((s, p) => s + getPrimaryOvr(p), 0) / squadPlayers.length;

    squadPlayers.sort((a, b) => getPrimaryOvr(a) - getPrimaryOvr(b));
    const weakest = squadPlayers[0];
    const weakestOvr = weakest ? getPrimaryOvr(weakest) : 55;

    // 1. Try to sign a free agent if weakest slot OVR < clubMean - 6
    if (weakestOvr < clubMean - 6) {
      const freeAgents = Object.values(next.players).filter(
        (p) => p.clubId === null && getPrimaryOvr(p) > clubMean - 6,
      );
      if (freeAgents.length > 0) {
        const pickedFA = rng.pick(freeAgents)!;
        const offer: TransferOffer = {
          id: `fa_ai_${pickedFA.id}_${winRound}`,
          playerId: pickedFA.id,
          fromClubId: null,
          toClubId: club.id,
          fee: 0,
          status: 'Accepted',
          createdRound: winRound,
          bidsMade: 1,
          contractOffer: {
            wagePerWeek: wageFor(valueOf(pickedFA)),
            years: 2,
            role: 'Starter',
          },
        };
        next = completeTransfer(next, offer);
        continue;
      }
    }

    // 2. Buy from a lower-reputation AI club a player improving weakest slot by >= 3
    const targetClubs = aiClubs.filter((c) => c.id !== club.id && c.reputation < club.reputation);
    if (targetClubs.length === 0) continue;

    const seller = rng.pick(targetClubs)!;
    const sellerPlayers = seller.squad
      .map((id) => next.players[id])
      .filter((p) => {
        if (!p) return false;
        const ovr = getPrimaryOvr(p);
        const ask = calculateAskingPrice(p, seller, club, winRound === 3, next.players);
        return ovr >= weakestOvr + 3 && ask <= club.transferBudget;
      }) as Player[];

    if (sellerPlayers.length > 0) {
      const targetPlayer = rng.pick(sellerPlayers)!;
      const ask = calculateAskingPrice(targetPlayer, seller, club, winRound === 3, next.players);
      const offer: TransferOffer = {
        id: `ai_ai_${seller.id}_${club.id}_${targetPlayer.id}_${winRound}`,
        playerId: targetPlayer.id,
        fromClubId: seller.id,
        toClubId: club.id,
        fee: ask,
        status: 'Accepted',
        createdRound: winRound,
        bidsMade: 1,
        contractOffer: {
          wagePerWeek: wageFor(valueOf(targetPlayer)),
          years: 3,
          role: 'Starter',
        },
      };
      next = completeTransfer(next, offer);
    }
  }

  return next;
}

/**
 * Handles board wage budget request per SPEC §12.13.6.
 */
export function requestBoardWageIncrease(state: GameState): {
  success: boolean;
  state: GameState;
  message: string;
} {
  if (!state.window) {
    return {
      success: false,
      state,
      message: 'Board wage requests can only be made during a transfer window.',
    };
  }

  if (state.window.boardWageRequestUsed) {
    return {
      success: false,
      state,
      message: 'A wage budget request has already been submitted for this window.',
    };
  }

  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const userClub = next.clubs[next.userClubId];
  if (!userClub || !next.window)
    return { success: false, state, message: 'Club or window not found' };

  next.window.boardWageRequestUsed = true;

  if (userClub.boardConfidence >= BALANCE.transfers.boardWageRequestMinConfidence) {
    // Granted! +10% wage budget
    const increase = Math.round(userClub.wageBudget * BALANCE.transfers.boardWageRequestBoost);
    userClub.wageBudget += increase;

    next.inbox.unshift({
      id: `inbox_board_wage_granted_${next.matchday}_${next.window.round}`,
      matchday: next.matchday,
      kind: 'Board',
      title: 'Board Decision: Wage Budget Request Granted',
      body: `Following your formal submission, the board has approved a 10% increase to our weekly wage budget (+${formatMoney(increase)}/wk). We expect these funds to be invested prudently in first-team reinforcement.`,
      read: false,
      requiresAction: false,
    });

    return {
      success: true,
      state: next,
      message: `Request granted! The board approved a 10% increase (+${formatMoney(increase)}/wk) to our wage budget.`,
    };
  } else {
    // Denied! Confidence -2
    userClub.boardConfidence = clamp(
      userClub.boardConfidence + BALANCE.transfers.boardWageRequestPenalty,
      0,
      100,
    );

    next.inbox.unshift({
      id: `inbox_board_wage_denied_${next.matchday}_${next.window.round}`,
      matchday: next.matchday,
      kind: 'Board',
      title: 'Board Decision: Wage Budget Request Denied',
      body: `The board has reviewed your request for additional wage budget and concluded that current club performance does not justify expanding payroll. You are expected to work within our established parameters.`,
      read: false,
      requiresAction: false,
    });

    return {
      success: false,
      state: next,
      message: 'Request denied. The board declined the request and confidence slipped by 2 points.',
    };
  }
}

/**
 * Advances the transfer window round (Day 1 -> Day 2 -> Deadline Day -> Close) per SPEC §12.13.
 */
export function advanceWindowRound(state: GameState, seed = 5000): GameState {
  if (!state.window) return state;

  const currentRound = state.window.round;
  let next = JSON.parse(JSON.stringify(state)) as GameState;

  // 1. Resolve scouting queue
  next = resolveScoutingQueue(next);

  // 2. Resolve pending bids from user that were accepted/rejected
  // (Keep completed and active ones in history)

  // 3. AI incoming bids for user players
  next = generateAiIncomingBids(next, seed + currentRound * 13);

  // 4. AI-AI activity
  next = runAiAiTransfers(next, seed + currentRound * 29);

  if (!next.window) return next;

  // 5. Check round progression
  if (next.window.round < BALANCE.transfers.roundsPerWindow) {
    next.window.round += 1;
    const roundName = next.window.round === 3 ? 'Deadline Day' : `Day ${next.window.round}`;

    next.inbox.unshift({
      id: `inbox_window_day_${next.window.round}_${next.matchday}`,
      matchday: next.matchday,
      kind: 'Transfer',
      title: `Transfer Window: ${roundName} Arrives`,
      body: `Market activity intensifies across the division as clubs push to complete registrations before the deadline shuts.`,
      read: false,
      requiresAction: false,
    });
  } else {
    // Deadline Day finished! Close the window
    next.window = null;
    next.inbox.unshift({
      id: `inbox_window_closed_${next.matchday}`,
      matchday: next.matchday,
      kind: 'Transfer',
      title: 'Transfer Window Closed',
      body: `The transfer deadline has expired. All pending and uncompleted deals have lapsed. Teams will now resume matchday preparations with finalized squads.`,
      read: false,
      requiresAction: false,
    });

    // Advance phase back to PreMatch
    if (next.matchday === 0) {
      next.matchday = 1;
      next.phase = 'PreMatch';
    } else {
      next.matchday += 1;
      next.phase = 'PreMatch';
    }
  }

  return next;
}
