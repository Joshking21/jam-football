// Implements SPEC §7.1, §7.2, §11.0, §20 Zustand store for GameState and UI state
import { create } from 'zustand';
import { GameState, PlayerId } from '@/core/types';
import { GameSettings, loadSettings, saveSettings } from './settings';
import { getSaveMeta, loadGame, SaveMeta } from './saves';

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
  checkAutosave: () => Promise<void>;
  continueAutosave: () => Promise<boolean>;
}

export const useStore = create<AppState>((set, get) => {
  const initialSettings = loadSettings();

  const isDevGallery =
    typeof window !== 'undefined' && window.location.search.includes('dev=gallery');

  return {
    screen: isDevGallery ? 'devGallery' : 'title',
    gameState: null,
    settings: initialSettings,
    isSettingsOpen: false,
    isCreditsOpen: false,
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

    setGameState: (gameState: GameState | null) => set({ gameState }),

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
        set({
          gameState: state,
          screen: state.phase === 'Preseason' ? 'hub' : 'hub',
        });
        return true;
      }
      return false;
    },
  };
});
