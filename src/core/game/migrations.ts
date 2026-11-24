import { ensureWorldTraits } from '../player/traits';
// Implements SPEC §20.2 Save game version migrations & SPEC §23 M3.0
import { GameState, Tactics, TacticPlan } from '../types';
import { SAVE_VERSION } from '@/config/constants';
import { FORMATIONS } from '@/config/formations';
import { getDefaultRoleForPos } from '@/config/roles';
import { createStartingFamiliarity } from './familiarity';
import { createDefaultSetPieceTactics } from '../match/setPieces';

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
    finalThird: t.instructions?.finalThird ?? 'Mixed',
    crossStyle: t.instructions?.crossStyle ?? 'Mixed',
    offsideTrap: t.instructions?.offsideTrap ?? false,
    tackling: t.instructions?.tackling ?? 'Mixed',
    forceOpp: t.instructions?.forceOpp ?? 'Mixed',
    timeWasting: t.instructions?.timeWasting ?? 'Never',
    freeKicks: t.instructions?.freeKicks ?? 'Mixed',
    cornerSwing: t.instructions?.cornerSwing ?? 'Mixed',
    menBack: t.instructions?.menBack ?? 2,
    postMen: t.instructions?.postMen ?? 'None',
  };

  const takers = {
    penalty: t.takers?.penalty ?? null,
    freeKick: t.takers?.freeKick ?? null,
    corner: t.takers?.corner ?? null,
    longThrow: t.takers?.longThrow ?? null,
  };

  const activePlan = t.activePlan ?? 0;
  const createPlan = (name: string, p?: Partial<TacticPlan>): TacticPlan => ({
    name: p?.name ?? name,
    formation: p?.formation ?? formation,
    roles: p?.roles ? [...p.roles] : [...roles],
    playerInstructions: p?.playerInstructions
      ? p.playerInstructions.map((pis) => [...pis])
      : playerInstructions.map((pis) => [...pis]),
    instructions: p?.instructions ? { ...p.instructions } : { ...instructions },
  });

  const planA = createPlan('Plan A', t.plans?.[0]);
  const planB = createPlan('Plan B', t.plans?.[1]);
  const planC = createPlan('Plan C', t.plans?.[2]);

  return {
    formation,
    lineup: t.lineup ?? new Array(11).fill(null),
    roles,
    duties: t.duties ?? new Array(11).fill('Support'),
    playerInstructions,
    bench: t.bench ?? [],
    captain: t.captain ?? null,
    takers,
    setPieces: t.setPieces ?? createDefaultSetPieceTactics(),
    instructions,
    opposition,
    plans: [planA, planB, planC],
    activePlan,
    matchPlans: t.matchPlans ?? [],
    askMeFirst: t.askMeFirst ?? true,
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
          if (!club.familiarity) {
            club.familiarity = createStartingFamiliarity(
              club.style,
              club.tactics?.formation ?? '4-4-2',
            );
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
      // §13.23: saves from before traits get each player's world traits.
      if (state.players) ensureWorldTraits(state.players);
      return state;
    }
    default:
      throw new Error(`Unsupported save version: ${version}`);
  }
}
