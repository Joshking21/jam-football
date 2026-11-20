// Implements SPEC §20.1, §20.3, §20.4 Saves management via IndexedDB (idb-keyval)
import { createStore, get, set, del, entries } from 'idb-keyval';
import { GameState } from '@/core/types';
import { SAVE_VERSION } from '@/config/constants';

const savesStore = typeof window !== 'undefined' ? createStore('touchline', 'saves') : undefined;

let hasRequestedPersist = false;

/**
 * On first successful save, call navigator.storage.persist() once (SPEC §20.1).
 */
async function requestPersistence(): Promise<void> {
  if (hasRequestedPersist) return;
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    hasRequestedPersist = true;
    try {
      await navigator.storage.persist();
    } catch {
      // Ignore errors per SPEC §20.1
    }
  }
}

/**
 * Check if IndexedDB is available (SPEC §20.1 - e.g. some private browsing modes).
 */
export async function isIndexedDbAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.indexedDB) return false;
  try {
    const probe = window.indexedDB.open('__touchline_probe');
    return new Promise((resolve) => {
      probe.onsuccess = () => {
        try {
          probe.result.close();
          window.indexedDB.deleteDatabase('__touchline_probe');
        } catch {}
        resolve(true);
      };
      probe.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export interface SaveMeta {
  clubId: string;
  clubName: string;
  matchday: number;
  managerName: string;
  savedAt: string;
  version: number;
}

export interface SavePayload {
  meta: SaveMeta;
  state: GameState;
}

export type SaveSlotKey = 'slot-1' | 'slot-2' | 'slot-3' | 'autosave';

export async function saveGame(slot: SaveSlotKey, state: GameState): Promise<void> {
  if (!savesStore) return;
  const userClub = state.clubs[state.userClubId];
  const payload: SavePayload = {
    meta: {
      clubId: state.userClubId,
      clubName: userClub ? userClub.name : state.userClubId,
      matchday: state.matchday,
      managerName: state.managerName,
      savedAt: new Date().toISOString(),
      version: SAVE_VERSION,
    },
    state,
  };
  await set(slot, payload, savesStore);
  await requestPersistence();
}

export async function loadGame(slot: SaveSlotKey | string): Promise<GameState | null> {
  if (!savesStore) return null;
  const payload = await get<SavePayload>(slot, savesStore);
  return payload ? payload.state : null;
}

export async function getSaveMeta(slot: SaveSlotKey | string): Promise<SaveMeta | null> {
  if (!savesStore) return null;
  const payload = await get<SavePayload>(slot, savesStore);
  return payload ? payload.meta : null;
}

export async function listAllSaves(): Promise<Array<{ slot: string; meta: SaveMeta }>> {
  if (!savesStore) return [];
  const allEntries = await entries<string, SavePayload>(savesStore);
  return allEntries.map(([slot, payload]) => ({
    slot,
    meta: payload.meta,
  }));
}

export async function deleteSaveSlot(slot: string): Promise<void> {
  if (!savesStore) return;
  await del(slot, savesStore);
}

// --- Debounced Autosave (SPEC §20.3) ---
let autosaveTimer: any = null;
let pendingStateForAutosave: GameState | null = null;

export function triggerDebouncedAutosave(state: GameState): void {
  // Never save during a match per SPEC §20.3
  if (state.phase === 'Match') return;
  pendingStateForAutosave = state;

  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
  }

  autosaveTimer = setTimeout(() => {
    if (pendingStateForAutosave) {
      const stateToSave = pendingStateForAutosave;
      pendingStateForAutosave = null;
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(
          () => {
            saveGame('autosave', stateToSave).catch(() => {});
          },
          { timeout: 1000 },
        );
      } else {
        saveGame('autosave', stateToSave).catch(() => {});
      }
    }
  }, 1000);
}

export function flushAutosaveNow(state: GameState): void {
  if (state.phase === 'Match') return;
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
  pendingStateForAutosave = null;
  saveGame('autosave', state).catch(() => {});
}

// Save on visibilitychange to hidden and pagehide (SPEC §20.3)
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pendingStateForAutosave) {
      flushAutosaveNow(pendingStateForAutosave);
    }
  });

  window.addEventListener('pagehide', () => {
    if (pendingStateForAutosave) {
      flushAutosaveNow(pendingStateForAutosave);
    }
  });
}
