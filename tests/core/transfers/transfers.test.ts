import { describe, it, expect } from 'vitest';
import { createNewGame } from '../../../src/core/game/newGame';
import {
  calculateAskingPrice,
  evaluateBid,
  evaluatePlayerContract,
  completeTransfer,
  runAiAiTransfers,
  generateAiIncomingBids,
  advanceWindowRound,
} from '../../../src/core/transfers/transfers';
import {
  queueScoutPlayer,
  resolveScoutingQueue,
  isPlayerScouted,
  getScoutedOvr,
  canScoutPlayer,
} from '../../../src/core/transfers/scouting';
import { valueOf, wageFor } from '../../../src/core/player/value';
import { Club, TransferOffer } from '../../../src/core/types';

describe('Transfers System (SPEC §12.12, §12.13)', () => {
  const gameState = createNewGame({ seed: 12345, userClubId: 'c01', managerName: 'Test Manager' });
  const clubs = Object.values(gameState.clubs);
  const clubA = clubs[0] as Club;
  const clubB = clubs[1] as Club;

  it('calculates asking prices correctly based on player importance, rep, and window factor', () => {
    const playerA = gameState.players[clubA.squad[0]!]!;
    const baseVal = valueOf(playerA);
    const ask = calculateAskingPrice(playerA, clubA, clubB, false, gameState.players);

    // Should be at least base value
    expect(ask).toBeGreaterThanOrEqual(baseVal);

    // Free agents have 0 asking price
    const freeAsk = calculateAskingPrice(playerA, null, clubB, false, gameState.players);
    expect(freeAsk).toBe(0);

    // Deadline day multiplies asking price by factor (1.1)
    const deadlineAsk = calculateAskingPrice(playerA, clubA, clubB, true, gameState.players);
    expect(deadlineAsk).toBeGreaterThan(ask);
  });

  it('evaluates bids according to ask threshold and counter ratio', () => {
    const playerA = gameState.players[clubA.squad[0]!]!;
    const ask = 100000;

    // Full ask or higher is accepted
    const acceptRes = evaluateBid(100000, ask, playerA, clubA, 123, gameState.players);
    expect(acceptRes.status).toBe('Accepted');

    // 85% to 99% triggers a counter offer
    const counterRes = evaluateBid(88000, ask, playerA, clubA, 123, gameState.players);
    expect(counterRes.status).toBe('Countered');
    expect(counterRes.counterFee).toBeGreaterThanOrEqual(ask * 0.9);

    // Under 80% is rejected
    const rejectRes = evaluateBid(50000, ask, playerA, clubA, 123, gameState.players);
    expect(rejectRes.status).toBe('Rejected');
  });

  it('evaluates player contract acceptance and personality checks', () => {
    const player = gameState.players[clubA.squad[0]!]!;
    const highWage = wageFor(valueOf(player)) * 2;

    // Generous wage accepted
    const offerGood = { wagePerWeek: highWage, years: 3 as const, role: 'Starter' as const };
    const resGood = evaluatePlayerContract(player, clubA, clubB, offerGood, 999);
    expect(resGood.accepted).toBe(true);

    // Extremely low wage rejected
    const offerLow = { wagePerWeek: 50, years: 3 as const, role: 'Backup' as const };
    const resLow = evaluatePlayerContract(player, clubA, clubB, offerLow, 999);
    expect(resLow.accepted).toBe(false);
  });

  it('completes transfers cleanly adjusting squad, finances, contracts, and fan mood', () => {
    const player = gameState.players[clubA.squad[0]!]!;
    const fee = 500000;
    const offer: TransferOffer = {
      id: 'offer_test_1',
      playerId: player.id,
      fromClubId: clubA.id,
      toClubId: clubB.id,
      fee,
      status: 'Accepted',
      createdRound: 1,
      bidsMade: 1,
      contractOffer: {
        wagePerWeek: 5000,
        years: 3,
        role: 'Starter',
      },
    };

    const initialBuyerBal = clubB.balance;
    const initialSellerBal = clubA.balance;

    const nextState = completeTransfer(gameState, offer);

    // Buyer balance decreased
    expect(nextState.clubs[clubB.id]!.balance).toBe(initialBuyerBal - fee);
    // Seller balance increased
    expect(nextState.clubs[clubA.id]!.balance).toBe(initialSellerBal + fee);

    // Player moved squad
    expect(nextState.clubs[clubB.id]!.squad).toContain(player.id);
    expect(nextState.clubs[clubA.id]!.squad).not.toContain(player.id);
    expect(nextState.players[player.id]!.clubId).toBe(clubB.id);
    expect(nextState.players[player.id]!.contract?.wagePerWeek).toBe(5000);

    // News generated
    expect(nextState.news.length).toBeGreaterThan(0);
    expect(nextState.news[0]!.clubIds).toContain(clubB.id);
  });

  it('handles scouting queue and knowledge progression (§12.12)', () => {
    const targetPlayer = gameState.players[clubB.squad[0]!]!;
    let state = JSON.parse(JSON.stringify(gameState));
    state.phase = 'TransferWindow';
    state.window = {
      kind: 'Preseason',
      round: 1,
      offers: [],
      scoutingQueue: [],
      scoutingDoneThisRound: 0,
      boardWageRequestUsed: false,
    };

    // Initially unscouted
    expect(isPlayerScouted(targetPlayer, state.userClubId)).toBe(false);
    const bandBefore = getScoutedOvr(targetPlayer, state.userClubId);
    expect(bandBefore.isExact).toBe(false);

    // Can queue scouting
    const canScout = canScoutPlayer(state, targetPlayer.id);
    expect(canScout.allowed).toBe(true);

    state = queueScoutPlayer(state, targetPlayer.id);
    expect(state.window.scoutingQueue).toContain(targetPlayer.id);

    // Resolving scouting queue scouts the player
    state = resolveScoutingQueue(state);
    expect(isPlayerScouted(state.players[targetPlayer.id]!, state.userClubId)).toBe(true);

    const bandAfter = getScoutedOvr(state.players[targetPlayer.id]!, state.userClubId);
    expect(bandAfter.isExact).toBe(true);
  });

  it('runs AI-to-AI transfer activity during window rounds (§12.13.5)', () => {
    let state = JSON.parse(JSON.stringify(gameState));
    state.window = {
      kind: 'Preseason',
      round: 1,
      offers: [],
      scoutingQueue: [],
      scoutingDoneThisRound: 0,
      boardWageRequestUsed: false,
    };

    const nextState = runAiAiTransfers(state, 12345);
    expect(nextState.window?.offers.length).toBeGreaterThanOrEqual(1);

    const bidsState = generateAiIncomingBids(state, 12345);
    expect(bidsState).toBeDefined();

    const advanced = advanceWindowRound(state, 12345);
    expect(advanced.window?.round).toBe(2);
  });
});
