// Implements SPEC §7.1, §7.2, §10, §11.0, §20 Zustand store for GameState and UI state
import { create } from 'zustand';
import { GameState, PlayerId, Tactics, TrainingPlan, Player } from '@/core/types';
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
        const playerIds = Object.keys(initialGameState.players) as PlayerId[];
        initialGameState.matchday = 18;
        initialGameState.awards = {
          playerOfTheSeason: playerIds[0]!,
          goldenBoot: playerIds[1]!,
          playmaker: playerIds[2]!,
          goldenGlove: playerIds[3]!,
          youngPlayer: playerIds[4]!,
          managerOfTheSeason: initialGameState.userClubId,
          teamOfTheSeason: playerIds.slice(0, 11),
        };
      } else if (scr === 'weekSummary') {
        initialGameState.matchday = 1;
        for (const f of initialGameState.fixtures.filter((fix) => fix.matchday === 1)) {
          f.result = {
            homeGoals: 2,
            awayGoals: 1,
            scorers: [],
            attendance: 18000,
            motm: Object.keys(initialGameState.players)[0] as PlayerId,
            stats: {} as any,
          };
        }
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
  };
});

export const useSettings = () => useStore((state) => state.settings);
