// Implements SPEC §20.1, §20.3, §20.4 Saves management via IndexedDB (idb-keyval)
import { createStore, get, set, del, entries } from 'idb-keyval';
import { GameState } from '@/core/types';
import { SAVE_VERSION } from '@/config/constants';

const savesStore = typeof window !== 'undefined' ? createStore('touchline', 'saves') : undefined;

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
