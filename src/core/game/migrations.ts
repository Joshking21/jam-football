// Implements SPEC §20.2 Save game version migrations
import { GameState } from '../types';
import { SAVE_VERSION } from '@/config/constants';

export function migrateSave(raw: unknown): GameState {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Corrupt save: expected an object');
  }

  const obj = raw as Record<string, unknown>;
  const version = typeof obj.version === 'number' ? obj.version : 0;

  if (version > SAVE_VERSION) {
    throw new Error('This save is from a newer version of TOUCHLINE.');
  }

  switch (version) {
    case 1:
      // Current version
      return raw as GameState;
    default:
      throw new Error(`Unsupported save version: ${version}`);
  }
}
