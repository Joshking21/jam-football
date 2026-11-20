// Implements SPEC §12.6 Discipline and §13.8 Fouls / Restarts
import { Personality, Attributes, RoleId, PlayerInstruction } from '../types';
import { Rng } from '../rng';
import { K } from '@/config/balance';
import { isBox } from './frames';

export type FoulCardResult = 'NONE' | 'YELLOW' | 'RED_SECOND_YELLOW' | 'DIRECT_RED';

export interface FoulerInfo {
  personality: Personality;
  attributes: Pick<Attributes, 'tackling'>;
  currentYellows: number; // 0 or 1
}

export function resolveFoulCard(fouler: FoulerInfo, rng: Rng): FoulCardResult {
  // Fouler personality & tackling factors (§12.6)
  let foulerFactor = 1.0;
  if (fouler.personality === 'Temperamental') foulerFactor *= 1.3;
  if (fouler.personality === 'Professional') foulerFactor *= 0.85;
  if (fouler.attributes.tackling < 50) foulerFactor *= 1.15;

  const directRedChance =
    K.fouls.directRedPerFoul * (fouler.personality === 'Temperamental' ? 1.5 : 1.0);

  if (rng.chance(directRedChance)) {
    return 'DIRECT_RED';
  }

  // Referees and cautious players are less likely to issue/commit a second bookable offense
  const secondYellowCautionFactor = fouler.currentYellows >= 1 ? 0.22 : 1.0;
  const yellowChance = K.fouls.yellowPerFoul * foulerFactor * secondYellowCautionFactor;
  if (rng.chance(yellowChance)) {
    if (fouler.currentYellows >= 1) {
      return 'RED_SECOND_YELLOW';
    }
    return 'YELLOW';
  }

  return 'NONE';
}

export type FoulRestartType = 'PENALTY' | 'DIRECT_FK' | 'CROSS_FK' | 'REGULAR_FK';

export function determineFoulRestart(
  attackingPos: { ax: number; ay: number },
  rng: Rng,
): FoulRestartType {
  // Foul by the defending team inside its own box (attacking frame box)
  if (isBox(attackingPos.ax, attackingPos.ay)) {
    return 'PENALTY';
  }

  // Foul in ATT Centre within 30m of goal (ax >= 75)
  // Centre lane: 22.67 <= ay < 45.33
  const isCentre = attackingPos.ay >= 22.67 && attackingPos.ay < 45.33;
  if (attackingPos.ax >= 75 && isCentre) {
    // 50% direct shot, 50% cross delivery
    return rng.chance(0.5) ? 'DIRECT_FK' : 'CROSS_FK';
  }

  // Foul in ATT wide (ax >= 70 && !isCentre)
  if (attackingPos.ax >= 70 && !isCentre) {
    return 'CROSS_FK';
  }

  // Elsewhere
  return 'REGULAR_FK';
}

/**
 * Tactical depth foul probability multiplier (SPEC §13.17)
 */
export function getFoulMultiplier(params: {
  roleId?: RoleId;
  isTightMarkMarker?: boolean;
  playerInstructions?: PlayerInstruction[];
}): number {
  let mult = 1.0;
  if (params.roleId === 'stopper') mult *= 1.2;
  if (params.roleId === 'ball_winner') mult *= 1.5;
  if (params.isTightMarkMarker) mult *= 1.2;
  if (params.playerInstructions?.includes('stayOnFeet')) mult *= 0.5;
  return mult;
}
