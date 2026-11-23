// Implements SPEC §7.1, §7.2, §10, §11.0, §20 Zustand store for GameState and UI state
import { create } from 'zustand';
import {
  GameState,
  PlayerId,
  Tactics,
  TrainingPlan,
  Player,
  SquadRole,
  TransferOffer,
  MatchPrep,
  IndividualFocus,
  StaffMember,
} from '@/core/types';
import { replaceStaffMember } from '@/core/club/clubDepth';
import { GameSettings, loadSettings, saveSettings } from './settings';
import { getSaveMeta, loadGame, saveGame, SaveMeta, triggerDebouncedAutosave } from './saves';
import { createNewGame, NewGameOptions } from '@/core/game/newGame';
import { advance, validateLineup } from '@/core/game/advance';
import { pickBestLineup } from '@/core/match/aiManager';
import { applyClubTheme } from '@/config/clubThemes';
import { TalkContext, TalkTone, TeamTalkResult, applyTeamTalk } from '@/core/player/talks';
import { applyPressAnswer, PressAnswerResult } from '@/core/game/press';
import { applyConversationReply, ConversationResolution } from '@/core/player/conversations';
import { deriveSeed, createRng } from '@/core/rng';
import { canScoutPlayer, queueScoutPlayer } from '@/core/transfers/scouting';
import {
  calculateAskingPrice,
  evaluateBid,
  evaluatePlayerContract,
  completeTransfer,
  requestBoardWageIncrease as reqWageInc,
} from '@/core/transfers/transfers';
import { formatMoney } from '@/core/math';
import { valueOf, wageFor } from '@/core/player/value';
import { BALANCE } from '@/config/balance';

export type AppScreen =
  | 'title'
  | 'newGame'
  | 'boardMeeting'
  | 'hub'
  | 'squad'
  | 'playerProfile'
  | 'tactics'
  | 'training'
  | 'transfers'
  | 'league'
  | 'fixtures'
  | 'club'
  | 'inbox'
  | 'preMatch'
  | 'match'
  | 'halfTime'
  | 'fullTime'
  | 'weekSummary'
  | 'seasonEnd'
  | 'sacked'
  | 'credits'
  | 'devGallery';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface AppState {
  screen: AppScreen;
  gameState: GameState | null;
  settings: GameSettings;
  isSettingsOpen: boolean;
  isCreditsOpen: boolean;
  isConversationModalOpen: boolean;
  activeModal: string | null;
  selectedPlayerId: PlayerId | null;
  sidebarCollapsed: boolean;
  hasAutosave: boolean;
  autosaveMeta: SaveMeta | null;
  toast: ToastMessage | null;

  // Actions
  setScreen: (screen: AppScreen) => void;
  toggleSidebar: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  openCredits: () => void;
  closeCredits: () => void;
  openPlayerProfile: (id: PlayerId) => void;
  closeModal: () => void;
  updateSettings: (partial: Partial<GameSettings>) => void;
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  clearToast: () => void;
  setGameState: (state: GameState | null) => void;
  startNewGame: (options: NewGameOptions) => Promise<void>;
  advanceGame: (action?: any) => Promise<boolean>;
  updateUserTactics: (partial: Partial<Tactics>) => void;
  updateUserTraining: (partial: Partial<TrainingPlan>) => void;
  autoPickBestLineup: () => void;
  swapLineupSlots: (slotA: number, slotB: number) => void;
  swapLineupWithBench: (lineupSlot: number, benchIndex: number) => void;
  markInboxRead: (id: string) => void;
  performTeamTalk: (context: TalkContext, tone: TalkTone) => TeamTalkResult | null;
  answerPressQuestion: (answerId: string) => PressAnswerResult | null;
  skipPressConference: () => void;
  openConversationModal: () => void;
  closeConversationModal: () => void;
  answerConversation: (replyId: string) => ConversationResolution | null;
  dismissConversation: () => void;
  saveAutosave: () => Promise<void>;
  checkAutosave: () => Promise<void>;
  continueAutosave: () => Promise<boolean>;
  scoutPlayer: (id: PlayerId) => boolean;
  submitTransferBid: (
    playerId: PlayerId,
    fee: number,
  ) => { status: string; message: string; counterFee?: number };
  acceptCounterBid: (offerId: string) => boolean;
  negotiateContract: (
    offerId: string,
    terms: { wagePerWeek: number; years: 1 | 2 | 3 | 4; role: SquadRole },
  ) => { success: boolean; message: string; counterWage?: number };
  respondToIncomingBid: (
    offerId: string,
    action: 'Accept' | 'Reject' | 'Counter',
    counterFee?: number,
  ) => { success: boolean; message: string };
  requestBoardWageIncrease: () => { success: boolean; message: string };
  toggleShortlist: (id: PlayerId) => void;
  isShortlisted: (id: PlayerId) => boolean;
  setMatchPrep: (prep: MatchPrep) => void;
  setPlayerRest: (playerId: PlayerId, rest: boolean) => void;
  setPlayerIndividualFocus: (playerId: PlayerId, focus: IndividualFocus | null) => void;
  hireStaffMember: (newStaff: StaffMember) => { success: boolean; message: string };
}

export const useStore = create<AppState>((set, get) => {
  const initialSettings = loadSettings();

  let initialScreen: AppScreen = 'title';
  let initialGameState: GameState | null = null;

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('dev') === 'gallery') {
      initialScreen = 'devGallery';
    } else if (params.has('screen')) {
      const scr = params.get('screen') as AppScreen;
      initialScreen = scr;
      initialGameState = createNewGame({
        userClubId: (params.get('club') as any) || 'c01',
        managerName: 'Alex Mercer',
        seed: 42,
      });
      applyClubTheme(initialGameState.userClubId);

      if (scr === 'match') {
        const firstFix = initialGameState.fixtures[0];
        if (firstFix) initialGameState.pendingMatch = { fixtureId: firstFix.id };
      } else if (scr === 'seasonEnd') {
        // Run real engine simulation through all 18 matchdays (SPEC §19.8, B3)
        let state = initialGameState;
        state = advance(state); // Preseason
        state = advance(state); // PreMatch MD 1
        while (state.phase !== 'SeasonEnd') {
          state = advance(state);
        }
        initialGameState = state;
      } else if (scr === 'weekSummary') {
        // Run real engine simulation through Matchday 1 (SPEC §19.8, B3)
        let state = initialGameState;
        state = advance(state); // Preseason
        state = advance(state); // PreMatch MD 1
        state = advance(state); // Match MD 1 -> WeekSummary MD 1
        initialGameState = state;
      }
    }
  }

  return {
    screen: initialScreen,
    gameState: initialGameState,
    settings: initialSettings,
    isSettingsOpen: false,
    isCreditsOpen: false,
    isConversationModalOpen: false,
    activeModal: null,
    selectedPlayerId: null,
    sidebarCollapsed: false,
    hasAutosave: false,
    autosaveMeta: null,
    toast: null,

    setScreen: (screen: AppScreen) => set({ screen }),

    toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

    openSettings: () => set({ isSettingsOpen: true }),
    closeSettings: () => set({ isSettingsOpen: false }),

    openCredits: () => set({ isCreditsOpen: true }),
    closeCredits: () => set({ isCreditsOpen: false }),

    openPlayerProfile: (id: PlayerId) =>
      set({ selectedPlayerId: id, activeModal: 'playerProfile' }),
    closeModal: () =>
      set({
        activeModal: null,
        selectedPlayerId: null,
        isSettingsOpen: false,
        isCreditsOpen: false,
      }),

    updateSettings: (partial: Partial<GameSettings>) => {
      const current = get().settings;
      const updated = { ...current, ...partial };
      saveSettings(updated);
      set({ settings: updated });
    },

    showToast: (message: string, type = 'info') => {
      const id = `${Date.now()}-${Math.random()}`;
      set({ toast: { id, message, type } });
      setTimeout(() => {
        const currentToast = get().toast;
        if (currentToast && currentToast.id === id) {
          set({ toast: null });
        }
      }, 4000);
    },

    clearToast: () => set({ toast: null }),

    setGameState: (gameState: GameState | null) => {
      applyClubTheme(gameState?.userClubId ?? null);
      set({ gameState });
    },

    startNewGame: async (options: NewGameOptions) => {
      const state = createNewGame(options);
      applyClubTheme(state.userClubId);
      await saveGame('autosave', state);
      const meta = await getSaveMeta('autosave');
      set({
        gameState: state,
        hasAutosave: true,
        autosaveMeta: meta,
        screen: 'boardMeeting',
      });
    },

    advanceGame: async (action?: any) => {
      const current = get().gameState;
      if (!current) return false;

      try {
        const next = advance(current, action);
        let nextScreen = get().screen;

        // Auto-navigate screen according to new phase
        switch (next.phase) {
          case 'BoardMeeting':
            nextScreen = 'boardMeeting';
            break;
          case 'Preseason':
            nextScreen = 'hub';
            break;
          case 'PreMatch':
            nextScreen = 'preMatch';
            break;
          case 'Match':
            nextScreen = 'match';
            break;
          case 'PostMatch':
            nextScreen = 'fullTime';
            break;
          case 'WeekSummary':
            nextScreen = 'weekSummary';
            break;
          case 'TransferWindow':
            nextScreen = 'transfers';
            break;
          case 'SeasonEnd':
            nextScreen = 'seasonEnd';
            break;
          case 'Sacked':
            nextScreen = 'sacked';
            break;
        }

        // Autosave at WeekSummary, SeasonEnd, or when instructed (SPEC §20.3)
        if (next.phase === 'WeekSummary' || next.phase === 'SeasonEnd') {
          await saveGame('autosave', next);
          const meta = await getSaveMeta('autosave');
          set({ gameState: next, screen: nextScreen, hasAutosave: true, autosaveMeta: meta });
        } else {
          set({ gameState: next, screen: nextScreen });
        }
        return true;
      } catch (err: any) {
        get().showToast(err.message || 'Cannot advance', 'warning');
        return false;
      }
    },

    updateUserTactics: (partial: Partial<Tactics>) => {
      const state = get().gameState;
      if (!state) return;
      const userClub = state.clubs[state.userClubId];
      if (!userClub) return;

      const next = JSON.parse(JSON.stringify(state)) as GameState;
      const curTactics = next.clubs[next.userClubId]!.tactics;
      const updated = {
        ...curTactics,
        ...partial,
      };

      if (updated.plans && updated.plans.length === 3) {
        if (partial.activePlan !== undefined && partial.activePlan !== curTactics.activePlan) {
          const targetPlan = updated.plans[partial.activePlan];
          if (targetPlan) {
            updated.formation = targetPlan.formation;
            updated.roles = [...(targetPlan.roles ?? [])];
            updated.playerInstructions = (targetPlan.playerInstructions ?? []).map((arr) => [
              ...arr,
            ]);
            updated.instructions = { ...targetPlan.instructions };
          }
        } else {
          const activeIdx = updated.activePlan ?? 0;
          if (updated.plans[activeIdx]) {
            updated.plans[activeIdx] = {
              name: updated.plans[activeIdx]!.name,
              formation: updated.formation,
              roles: [...(updated.roles ?? [])],
              playerInstructions: (updated.playerInstructions ?? []).map((arr) => [...arr]),
              instructions: { ...updated.instructions },
            };
          }
        }
      }

      next.clubs[next.userClubId]!.tactics = updated;
      set({ gameState: next });
      triggerDebouncedAutosave(next);
    },

    updateUserTraining: (partial: Partial<TrainingPlan>) => {
      const state = get().gameState;
      if (!state) return;
      const next = JSON.parse(JSON.stringify(state)) as GameState;
      next.clubs[next.userClubId]!.trainingPlan = {
        ...next.clubs[next.userClubId]!.trainingPlan,
        ...partial,
      };
      set({ gameState: next });
      triggerDebouncedAutosave(next);
    },

    autoPickBestLineup: () => {
      const state = get().gameState;
      if (!state) return;
      const userClub = state.clubs[state.userClubId];
      if (!userClub) return;

      const candidates = userClub.squad
        .map((id) => state.players[id])
        .filter((p): p is Player => p != null)
        .map((p) => ({
          ...p,
          isInjured: p.injury !== null,
          isSuspended: p.suspendedMatches > 0,
        }));

      const best = pickBestLineup(
        candidates,
        userClub.style.formation,
        userClub.formationFamiliarity,
      );

      const next = JSON.parse(JSON.stringify(state)) as GameState;
      const targetClub = next.clubs[next.userClubId]!;
      targetClub.tactics.formation = best.formation;
      targetClub.tactics.lineup = [...best.lineup];
      targetClub.tactics.roles = [...best.roles];
      targetClub.tactics.playerInstructions = best.playerInstructions.map((p) => [...p]);
      targetClub.tactics.duties = [...best.duties];
      targetClub.tactics.bench = [...best.bench];

      set({ gameState: next });
      triggerDebouncedAutosave(next);
      get().showToast('Assistant selected the best XI', 'success');
    },

    swapLineupSlots: (slotA: number, slotB: number) => {
      const state = get().gameState;
      if (!state) return;
      const next = JSON.parse(JSON.stringify(state)) as GameState;
      const lineup = next.clubs[next.userClubId]!.tactics.lineup;
      const temp = lineup[slotA];
      lineup[slotA] = lineup[slotB] ?? null;
      lineup[slotB] = temp ?? null;
      set({ gameState: next });
      triggerDebouncedAutosave(next);
    },

    swapLineupWithBench: (lineupSlot: number, benchIndex: number) => {
      const state = get().gameState;
      if (!state) return;
      const next = JSON.parse(JSON.stringify(state)) as GameState;
      const tactics = next.clubs[next.userClubId]!.tactics;
      const starterId = tactics.lineup[lineupSlot];
      const benchId = tactics.bench[benchIndex];
      if (!benchId) return;

      tactics.lineup[lineupSlot] = benchId;
      if (starterId) {
        tactics.bench[benchIndex] = starterId;
      } else {
        tactics.bench.splice(benchIndex, 1);
      }
      set({ gameState: next });
      triggerDebouncedAutosave(next);
    },

    markInboxRead: (id: string) => {
      const state = get().gameState;
      if (!state) return;
      const next = JSON.parse(JSON.stringify(state)) as GameState;
      const item = next.inbox.find((i) => i.id === id);
      if (item) item.read = true;
      set({ gameState: next });
    },

    performTeamTalk: (context: TalkContext, tone: TalkTone) => {
      const state = get().gameState;
      if (!state) return null;
      const userClub = state.clubs[state.userClubId];
      if (!userClub) return null;

      const rng = createRng(
        deriveSeed(state.seed, 'team-talk', `${state.matchday}-${context}-${tone}`),
      );
      const result = applyTeamTalk(state.players, userClub.squad, context, tone, rng);

      const next = JSON.parse(JSON.stringify(state)) as GameState;
      for (const [pId, updatedPlayer] of Object.entries(result.updatedPlayers)) {
        next.players[pId] = updatedPlayer;
      }
      if (result.focusBoost > 0) {
        next.focusBoost = result.focusBoost;
      }

      set({ gameState: next });
      triggerDebouncedAutosave(next);
      return result;
    },

    answerPressQuestion: (answerId: string) => {
      const state = get().gameState;
      if (!state || !state.pendingPress) return null;
      const next = JSON.parse(JSON.stringify(state)) as GameState;
      if (!next.pendingPress) return null;
      const result = applyPressAnswer(next, next.pendingPress, answerId);
      set({ gameState: next });
      triggerDebouncedAutosave(next);
      return result;
    },

    skipPressConference: () => {
      const state = get().gameState;
      if (!state || !state.pendingPress) return;
      const next = JSON.parse(JSON.stringify(state)) as GameState;
      next.pendingPress = null;
      set({ gameState: next });
      triggerDebouncedAutosave(next);
    },

    openConversationModal: () => set({ isConversationModalOpen: true }),
    closeConversationModal: () => set({ isConversationModalOpen: false }),

    answerConversation: (replyId: string) => {
      const state = get().gameState;
      if (!state || !state.activeConversation) return null;
      const active = state.activeConversation;
      const player = state.players[active.playerId];
      const club = state.clubs[state.userClubId];
      if (!player || !club) return null;

      const res = applyConversationReply(player, club, active, replyId, state.matchday);
      if (!res) return null;

      const next = JSON.parse(JSON.stringify(state)) as GameState;
      next.players[res.updatedPlayer.id] = res.updatedPlayer;
      next.conversationsHistory = [...(next.conversationsHistory ?? []), active.opening.id];
      next.inbox.unshift(res.inboxNotice);
      next.activeConversation = null;

      set({ gameState: next });
      triggerDebouncedAutosave(next);
      return res;
    },

    dismissConversation: () => {
      const state = get().gameState;
      if (!state || !state.activeConversation) return;
      const next = JSON.parse(JSON.stringify(state)) as GameState;
      next.activeConversation = null;
      set({ gameState: next, isConversationModalOpen: false });
      triggerDebouncedAutosave(next);
    },

    saveAutosave: async () => {
      const state = get().gameState;
      if (!state) return;
      await saveGame('autosave', state);
      const meta = await getSaveMeta('autosave');
      set({ hasAutosave: true, autosaveMeta: meta });
    },

    checkAutosave: async () => {
      const meta = await getSaveMeta('autosave');
      set({
        hasAutosave: !!meta,
        autosaveMeta: meta,
      });
    },

    continueAutosave: async () => {
      const state = await loadGame('autosave');
      if (state) {
        applyClubTheme(state.userClubId);
        set({
          gameState: state,
          screen: state.phase === 'BoardMeeting' ? 'boardMeeting' : 'hub',
        });
        return true;
      }
      return false;
    },

    scoutPlayer: (id: PlayerId) => {
      const state = get().gameState;
      if (!state) return false;
      const check = canScoutPlayer(state, id);
      if (!check.allowed) {
        get().showToast(check.reason || 'Cannot scout player', 'warning');
        return false;
      }
      const next = queueScoutPlayer(state, id);
      set({ gameState: next });
      get().showToast('Scouting assignment dispatched', 'success');
      triggerDebouncedAutosave(next);
      return true;
    },

    submitTransferBid: (playerId: PlayerId, fee: number) => {
      const state = get().gameState;
      if (!state) return { status: 'Error', message: 'No game state' };
      const player = state.players[playerId];
      const userClub = state.clubs[state.userClubId];
      if (!player || !userClub) return { status: 'Error', message: 'Player/Club not found' };

      if (fee > userClub.transferBudget) {
        get().showToast('Bid exceeds available transfer budget.', 'warning');
        return { status: 'Error', message: 'Bid exceeds available transfer budget.' };
      }

      const sellerClub = player.clubId ? (state.clubs[player.clubId] ?? null) : null;
      const isDeadlineDay = state.window?.round === 3;
      const ask = calculateAskingPrice(player, sellerClub, userClub, isDeadlineDay, state.players);

      const next = JSON.parse(JSON.stringify(state)) as GameState;
      if (!next.window) {
        next.window = {
          kind: 'Midseason',
          round: 1,
          offers: [],
          scoutingQueue: [],
          scoutingDoneThisRound: 0,
          boardWageRequestUsed: false,
        };
      }

      const seed = deriveSeed(next.seed, `bid_${playerId}_${Date.now()}`);
      const evalRes = evaluateBid(fee, ask, player, sellerClub, seed, next.players);

      const offerId = `offer_user_${playerId}_${Date.now()}`;
      const offer: TransferOffer = {
        id: offerId,
        playerId,
        fromClubId: player.clubId,
        toClubId: userClub.id,
        fee: evalRes.status === 'Countered' && evalRes.counterFee ? evalRes.counterFee : fee,
        status: evalRes.status,
        counterFee: evalRes.counterFee,
        createdRound: next.window.round,
        bidsMade: 1,
      };

      next.window.offers.push(offer);
      set({ gameState: next });
      triggerDebouncedAutosave(next);

      if (evalRes.status === 'Accepted') {
        get().showToast(
          `Bid of ${formatMoney(fee)} accepted by ${sellerClub?.name ?? 'Free Agent'}! Ready for personal terms.`,
          'success',
        );
        return {
          status: 'Accepted',
          message: 'Bid accepted by club. Proceed to agree personal terms.',
        };
      } else if (evalRes.status === 'Countered') {
        get().showToast(
          `${sellerClub?.name} countered with asking fee of ${formatMoney(evalRes.counterFee!)}.`,
          'info',
        );
        return {
          status: 'Countered',
          counterFee: evalRes.counterFee,
          message: `${sellerClub?.name} countered at ${formatMoney(evalRes.counterFee!)}.`,
        };
      } else {
        get().showToast(
          `${sellerClub?.name ?? 'Club'} rejected the bid of ${formatMoney(fee)}.`,
          'warning',
        );
        return { status: 'Rejected', message: 'The selling club rejected this bid.' };
      }
    },

    acceptCounterBid: (offerId: string) => {
      const state = get().gameState;
      if (!state || !state.window) return false;
      const next = JSON.parse(JSON.stringify(state)) as GameState;
      const offer = next.window?.offers.find((o) => o.id === offerId);
      if (!offer || offer.status !== 'Countered' || !offer.counterFee) return false;

      offer.fee = offer.counterFee;
      offer.status = 'Accepted';
      set({ gameState: next });
      get().showToast('Counter offer accepted. Ready for personal terms.', 'success');
      triggerDebouncedAutosave(next);
      return true;
    },

    negotiateContract: (
      offerId: string,
      terms: { wagePerWeek: number; years: 1 | 2 | 3 | 4; role: SquadRole },
    ) => {
      const state = get().gameState;
      if (!state || !state.window) return { success: false, message: 'No active window' };
      const offer = state.window.offers.find((o) => o.id === offerId);
      if (!offer) return { success: false, message: 'Offer not found' };

      const player = state.players[offer.playerId];
      const buyer = state.clubs[state.userClubId];
      const seller = offer.fromClubId ? (state.clubs[offer.fromClubId] ?? null) : null;
      if (!player || !buyer) return { success: false, message: 'Data missing' };

      // Check squad size
      if (buyer.squad.length >= BALANCE.transfers.maxSquadSize) {
        return {
          success: false,
          message: `Squad is already at maximum capacity (${BALANCE.transfers.maxSquadSize} players).`,
        };
      }

      // Check wage budget
      let currentPayroll = 0;
      for (const pId of buyer.squad) {
        const p = state.players[pId];
        if (p?.contract) currentPayroll += p.contract.wagePerWeek;
      }
      if (currentPayroll + terms.wagePerWeek > buyer.wageBudget) {
        return { success: false, message: 'Offered wage would exceed total club wage budget.' };
      }

      // Check fee budget
      if (offer.fee > buyer.transferBudget) {
        return { success: false, message: 'Transfer fee exceeds available transfer budget.' };
      }

      const seed = deriveSeed(state.seed, `contract_${offer.id}`);
      const evalContract = evaluatePlayerContract(player, seller, buyer, terms, seed);

      if (evalContract.accepted) {
        offer.contractOffer = terms;
        const next = completeTransfer(state, offer);
        set({ gameState: next });
        get().showToast(
          `Agreement reached! ${player.firstName} ${player.lastName} signs for ${buyer.name}!`,
          'success',
        );
        triggerDebouncedAutosave(next);
        return { success: true, message: 'Personal terms agreed. Deal complete!' };
      } else {
        return {
          success: false,
          message: evalContract.reason || 'Player rejected the proposed terms.',
          counterWage: evalContract.counterWage,
        };
      }
    },

    respondToIncomingBid: (
      offerId: string,
      action: 'Accept' | 'Reject' | 'Counter',
      counterFee?: number,
    ) => {
      const state = get().gameState;
      if (!state || !state.window) return { success: false, message: 'No active window' };
      const next = JSON.parse(JSON.stringify(state)) as GameState;
      const offer = next.window?.offers.find((o) => o.id === offerId);
      if (!offer) return { success: false, message: 'Offer not found' };

      const player = next.players[offer.playerId];
      const buyer = next.clubs[offer.toClubId];
      if (!player || !buyer) return { success: false, message: 'Player/Club not found' };

      if (action === 'Reject') {
        offer.status = 'Rejected';
        set({ gameState: next });
        get().showToast(`Rejected bid from ${buyer.name} for ${player.lastName}.`, 'info');
        triggerDebouncedAutosave(next);
        return { success: true, message: 'Bid rejected.' };
      }

      if (action === 'Accept') {
        offer.status = 'Accepted';
        offer.contractOffer = {
          wagePerWeek: wageFor(valueOf(player)),
          years: 3,
          role: 'Starter',
        };
        const completedState = completeTransfer(next, offer);
        set({ gameState: completedState });
        get().showToast(
          `Sold ${player.lastName} to ${buyer.name} for ${formatMoney(offer.fee)}!`,
          'success',
        );
        triggerDebouncedAutosave(completedState);
        return { success: true, message: 'Bid accepted and sale finalized.' };
      }

      if (action === 'Counter') {
        if (!counterFee) return { success: false, message: 'Counter fee required' };
        const val = valueOf(player);
        if (counterFee <= BALANCE.transfers.aiBidAcceptMaxCounter * val) {
          offer.fee = counterFee;
          offer.status = 'Accepted';
          offer.contractOffer = {
            wagePerWeek: wageFor(valueOf(player)),
            years: 3,
            role: 'Starter',
          };
          const completedState = completeTransfer(next, offer);
          set({ gameState: completedState });
          get().showToast(
            `${buyer.name} accepted your counter-offer of ${formatMoney(counterFee)}! Deal complete.`,
            'success',
          );
          triggerDebouncedAutosave(completedState);
          return { success: true, message: `${buyer.name} accepted the counter-offer!` };
        } else {
          offer.status = 'Rejected';
          set({ gameState: next });
          get().showToast(
            `${buyer.name} deemed ${formatMoney(counterFee)} excessive and walked away.`,
            'warning',
          );
          triggerDebouncedAutosave(next);
          return { success: false, message: `${buyer.name} walked away from negotiations.` };
        }
      }

      return { success: false, message: 'Invalid action' };
    },

    requestBoardWageIncrease: () => {
      const state = get().gameState;
      if (!state) return { success: false, message: 'No game state' };
      const res = reqWageInc(state);
      set({ gameState: res.state });
      get().showToast(res.message, res.success ? 'success' : 'warning');
      triggerDebouncedAutosave(res.state);
      return { success: res.success, message: res.message };
    },

    toggleShortlist: (id: PlayerId) => {
      const state = get().gameState;
      if (!state) return;
      const next = JSON.parse(JSON.stringify(state)) as GameState;
      if (!next.shortlist) next.shortlist = [];
      const idx = next.shortlist.indexOf(id);
      if (idx >= 0) {
        next.shortlist.splice(idx, 1);
        get().showToast('Removed from shortlist', 'info');
      } else {
        next.shortlist.push(id);
        get().showToast('Added to shortlist (TARGET)', 'success');
      }
      set({ gameState: next });
      triggerDebouncedAutosave(next);
    },

    isShortlisted: (id: PlayerId) => {
      const state = get().gameState;
      return state?.shortlist?.includes(id) ?? false;
    },

    setMatchPrep: (prep: MatchPrep) => {
      const state = get().gameState;
      if (!state) return;
      const next = JSON.parse(JSON.stringify(state)) as GameState;
      const club = next.clubs[next.userClubId];
      if (!club) return;
      club.prep = prep;
      club.trainingPlan.prep = prep;
      set({ gameState: next });
      get().showToast(
        prep === 'None' ? 'Match preparation cleared' : `Match preparation set: ${prep}`,
        'info',
      );
      triggerDebouncedAutosave(next);
    },

    setPlayerRest: (playerId: PlayerId, rest: boolean) => {
      const state = get().gameState;
      if (!state) return;
      const next = JSON.parse(JSON.stringify(state)) as GameState;
      const player = next.players[playerId];
      if (!player) return;
      player.rest = rest;
      set({ gameState: next });
      get().showToast(
        rest
          ? `${player.knownAs ?? player.lastName} scheduled for rest days (+8 cond / -6 fat)`
          : `${player.knownAs ?? player.lastName} returned to full training schedule`,
        'info',
      );
      triggerDebouncedAutosave(next);
    },

    setPlayerIndividualFocus: (playerId: PlayerId, focus: IndividualFocus | null) => {
      const state = get().gameState;
      if (!state) return;
      const next = JSON.parse(JSON.stringify(state)) as GameState;
      const club = next.clubs[next.userClubId];
      if (!club) return;
      if (!club.trainingPlan.individualFocus) club.trainingPlan.individualFocus = {};
      club.trainingPlan.individualFocus[playerId] = focus;

      if (focus?.type === 'attribute') {
        club.trainingPlan.individual[playerId] = focus.attribute;
      } else {
        club.trainingPlan.individual[playerId] = null;
      }

      set({ gameState: next });
      const player = next.players[playerId];
      const pName = player?.knownAs ?? player?.lastName ?? 'Player';
      get().showToast(
        focus
          ? `Individual focus set for ${pName}: ${focus.type === 'attribute' ? focus.attribute : focus.type === 'role' ? focus.roleId : focus.position}`
          : `Individual focus cleared for ${pName}`,
        'success',
      );
      triggerDebouncedAutosave(next);
    },

    hireStaffMember: (newStaff: StaffMember) => {
      const state = get().gameState;
      if (!state) return { success: false, message: 'No game state' };
      const next = JSON.parse(JSON.stringify(state)) as GameState;
      const club = next.clubs[next.userClubId];
      if (!club) return { success: false, message: 'Club not found' };

      if (club.staffReplacedThisRound) {
        get().showToast('Staff replacements are limited to one per window round.', 'warning');
        return {
          success: false,
          message: 'Staff replacements are limited to one per window round.',
        };
      }

      const res = replaceStaffMember(club, newStaff, next.matchday);
      next.clubs[next.userClubId] = res.club;
      next.counters.inbox++;
      next.inbox.unshift(res.memo);

      set({ gameState: next });
      get().showToast(
        `Appointed ${newStaff.name} as ${newStaff.role}. Severance paid: ${formatMoney(res.cost)}.`,
        'success',
      );
      triggerDebouncedAutosave(next);
      return { success: true, message: `Appointed ${newStaff.name} successfully.` };
    },
  };
});

export const useSettings = () => useStore((state) => state.settings);
