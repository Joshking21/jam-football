// Implements SPEC §20.2 Save game version migrations & SPEC §23 M3.0
import { GameState, Tactics } from '../types';
import { SAVE_VERSION } from '@/config/constants';
import { FORMATIONS } from '@/config/formations';
import { getDefaultRoleForPos } from '@/config/roles';

export function migrateTactics(t: Partial<Tactics>): Tactics {
  const formation = t.formation ?? '4-4-2';
  const formationDef = FORMATIONS[formation] ?? FORMATIONS['4-4-2'];

  const roles =
    Array.isArray(t.roles) && t.roles.length === 11
      ? t.roles
      : formationDef.slots.map((s) => getDefaultRoleForPos(s.position));

  const playerInstructions =
    Array.isArray(t.playerInstructions) && t.playerInstructions.length === 11
      ? t.playerInstructions
      : Array.from({ length: 11 }, () => []);

  const opposition = Array.isArray(t.opposition) ? t.opposition : [];

  const instructions = {
    mentality: t.instructions?.mentality ?? 'Balanced',
    passing: t.instructions?.passing ?? 'Mixed',
    tempo: t.instructions?.tempo ?? 'Normal',
    pressing: t.instructions?.pressing ?? 'Mid',
    line: t.instructions?.line ?? 'Normal',
    width: t.instructions?.width ?? 'Normal',
    focus: t.instructions?.focus ?? 'Mixed',
    onLoss: t.instructions?.onLoss ?? 'Mixed',
    onWin: t.instructions?.onWin ?? 'Mixed',
    distribution: t.instructions?.distribution ?? 'Mixed',
    cornersFor: t.instructions?.cornersFor ?? 'Mixed',
    cornersAgainst: t.instructions?.cornersAgainst ?? 'Mixed',
  };

  const takers = {
    penalty: t.takers?.penalty ?? null,
    freeKick: t.takers?.freeKick ?? null,
    corner: t.takers?.corner ?? null,
    longThrow: t.takers?.longThrow ?? null,
  };

  return {
    formation,
    lineup: t.lineup ?? new Array(11).fill(null),
    roles,
    duties: t.duties ?? new Array(11).fill('Support'),
    playerInstructions,
    bench: t.bench ?? [],
    captain: t.captain ?? null,
    takers,
    instructions,
    opposition,
  };
}

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
    case 1: {
      const state = raw as GameState;
      if (state.clubs) {
        for (const club of Object.values(state.clubs)) {
          if (club.tactics) {
            club.tactics = migrateTactics(club.tactics);
          }
          if (club.style) {
            club.style = {
              ...club.style,
              onLoss: club.style.onLoss ?? 'Mixed',
              onWin: club.style.onWin ?? 'Mixed',
              distribution: club.style.distribution ?? 'Mixed',
              cornersFor: club.style.cornersFor ?? 'Mixed',
              cornersAgainst: club.style.cornersAgainst ?? 'Mixed',
            };
          }
        }
      }
      return state;
    }
    default:
      throw new Error(`Unsupported save version: ${version}`);
  }
}
