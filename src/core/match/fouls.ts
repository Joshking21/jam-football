// Implements SPEC §12.6 Discipline and §13.8 Fouls / Restarts & §13.18 & §13.19
import {
  Personality,
  Attributes,
  RoleId,
  DefRoleId,
  PlayerInstruction,
  DefInstruction,
  Tackling,
  FreeKicks,
  FreeKickTactics,
  ShoutId,
  TraitId,
} from '../types';
import { Rng } from '../rng';
import { K } from '@/config/balance';
import { isBox } from './frames';

export type FoulCardResult = 'NONE' | 'YELLOW' | 'RED_SECOND_YELLOW' | 'DIRECT_RED';

export interface FoulerInfo {
  personality: Personality;
  attributes: Pick<Attributes, 'tackling'>;
  currentYellows: number; // 0 or 1
  teamTackling?: Tackling;
  activeShout?: ShoutId | null;
}

export function resolveFoulCard(fouler: FoulerInfo, rng: Rng): FoulCardResult {
  // Fouler personality & tackling factors (§12.6, §13.21)
  let foulerFactor = 1.0;
  if (fouler.personality === 'Temperamental') {
    foulerFactor *= 1.3;
    if (fouler.activeShout === 'getStuckIn') {
      foulerFactor *= K.shouts.getStuckIn.temperamentalCardMult;
    } else if (fouler.activeShout === 'calmDown') {
      foulerFactor *= K.shouts.calmDown.temperamentalCardMult;
    }
  }
  if (fouler.personality === 'Professional') foulerFactor *= 0.85;
  if (fouler.attributes.tackling < 50) foulerFactor *= 1.15;
  if (fouler.teamTackling === 'GetStuckIn') {
    foulerFactor *= K.d2.tackling.getStuckIn.yellowPerFoulMult;
  }

  const directRedChance =
    K.fouls.directRedPerFoul * (fouler.personality === 'Temperamental' ? 1.5 : 1.0);

  if (rng.chance(directRedChance)) {
    return 'DIRECT_RED';
  }

  // Referees and cautious players are less likely to issue/commit a second bookable offense
  const secondYellowCautionFactor = fouler.currentYellows >= 1 ? 0.18 : 1.0;
  const yellowChance = K.fouls.yellowPerFoul * foulerFactor * secondYellowCautionFactor;
  if (rng.chance(yellowChance)) {
    if (fouler.currentYellows >= 1) {
      return 'RED_SECOND_YELLOW';
    }
    return 'YELLOW';
  }

  return 'NONE';
}

export type FoulRestartType =
  | 'PENALTY'
  | 'DIRECT_FK'
  | 'CROSS_FK'
  | 'SHORT_FK'
  | 'DUMMY_FK'
  | 'QUICK_FK'
  | 'LONG_FK'
  | 'REGULAR_FK';

export function determineFoulRestart(
  attackingPos: { ax: number; ay: number },
  rng: Rng,
  freeKicks: FreeKicks | FreeKickTactics = 'Mixed',
): FoulRestartType {
  // Foul by the defending team inside its own box (attacking frame box)
  if (isBox(attackingPos.ax, attackingPos.ay)) {
    return 'PENALTY';
  }

  const fkTactics: FreeKickTactics =
    typeof freeKicks === 'object'
      ? freeKicks
      : {
          central:
            freeKicks === 'Shoot'
              ? 'Shoot'
              : freeKicks === 'Cross'
                ? 'CrossNear'
                : freeKicks === 'Short'
                  ? 'Short'
                  : 'Mixed',
          wide: freeKicks === 'Short' ? 'Short' : freeKicks === 'Cross' ? 'CrossNear' : 'Mixed',
          deep: 'Keep',
        };

  // Foul in ATT Centre within 30m of goal (ax >= 75)
  // Centre lane: 22.67 <= ay < 45.33
  const isCentre = attackingPos.ay >= 22.67 && attackingPos.ay < 45.33;
  if (attackingPos.ax >= 75 && isCentre) {
    const opt = fkTactics.central;
    if (opt === 'Shoot') {
      return rng.chance(K.sp.freeKicks.central.shootDirectChance) ? 'DIRECT_FK' : 'CROSS_FK';
    }
    if (opt === 'Short') {
      return 'SHORT_FK';
    }
    if (opt === 'Dummy') {
      return 'DUMMY_FK';
    }
    if (opt === 'CrossNear' || opt === 'CrossFar') {
      return 'CROSS_FK';
    }
    // 50% direct shot, 50% cross delivery (Mixed)
    return rng.chance(0.5) ? 'DIRECT_FK' : 'CROSS_FK';
  }

  // Foul in ATT wide (ax >= 70 && !isCentre)
  if (attackingPos.ax >= 70 && !isCentre) {
    const opt = fkTactics.wide;
    if (opt === 'Short') {
      return 'SHORT_FK';
    }
    return 'CROSS_FK';
  }

  // Deep (MID third and our half: ax < 70)
  const deepOpt = fkTactics.deep;
  if (deepOpt === 'Quick') {
    return 'QUICK_FK';
  }
  if (deepOpt === 'Long') {
    return 'LONG_FK';
  }

  // Elsewhere
  return 'REGULAR_FK';
}

/**
 * Tactical depth foul probability multiplier (SPEC §13.17, §13.18.5, §13.19.2)
 */
export function getFoulMultiplier(params: {
  roleId?: RoleId;
  defRoleId?: DefRoleId;
  isTightMarkMarker?: boolean;
  playerInstructions?: PlayerInstruction[];
  defInstructions?: DefInstruction[];
  teamTackling?: Tackling;
  activeShout?: ShoutId | null;
  defenderTraits?: TraitId[];
  isAerialDuel?: boolean;
}): number {
  let mult = 1.0;
  if (params.roleId === 'stopper' || params.defRoleId === 'cb_step') mult *= 1.2;
  if (params.roleId === 'ball_winner' || params.defRoleId === 'dm_win') mult *= 1.5;
  if (params.isTightMarkMarker) mult *= 1.2;

  // Touchline shout foul modifiers (§13.21)
  if (params.activeShout === 'getStuckIn') {
    mult *= K.shouts.getStuckIn.foulMult;
  } else if (params.activeShout === 'calmDown') {
    mult *= K.shouts.calmDown.foulMult;
  }

  // Trait foul modifiers (§13.23)
  if (params.defenderTraits?.includes('divesIn')) {
    mult *= K.traits.divesIn.foulsMult;
  }
  if (params.isAerialDuel && params.defenderTraits?.includes('attacksAir')) {
    mult *= K.traits.attacksAir.aerialFoulsMult;
  }

  // A player's own stayOnFeet overrides team tackling setting (§13.18.5)
  if (
    params.playerInstructions?.includes('stayOnFeet') ||
    params.defInstructions?.includes('stayOnFeet')
  ) {
    mult *= 0.5;
  } else if (params.defInstructions?.includes('tackleHarder')) {
    mult *= 1.35;
  } else if (params.teamTackling === 'GetStuckIn') {
    mult *= K.d2.tackling.getStuckIn.foulsMult;
  } else if (params.teamTackling === 'StayOnFeet') {
    mult *= K.d2.tackling.stayOnFeet.foulsMult;
  }

  return mult;
}
