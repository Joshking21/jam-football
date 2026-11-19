// Implements SPEC §8.4, §9.2, §14.3 Formations, slot definitions and anchor coordinates
import { Formation, Position } from '@/core/types';

export interface FormationSlot {
  slot: number; // 0..10
  role: string;
  position: Position;
  anchor: { x: number; y: number }; // own frame, x=0 goal, y=0 left touchline (105x68)
}

export interface FormationDef {
  formation: Formation;
  name: string;
  backLine: 3 | 4 | 5;
  slots: FormationSlot[];
}

export const FORMATIONS: Record<Formation, FormationDef> = {
  '4-4-2': {
    formation: '4-4-2',
    name: '4-4-2 Standard',
    backLine: 4,
    slots: [
      { slot: 0, role: 'GK', position: 'GK', anchor: { x: 5, y: 34 } },
      { slot: 1, role: 'LB', position: 'LB', anchor: { x: 24, y: 8 } },
      { slot: 2, role: 'LCB', position: 'CB', anchor: { x: 19, y: 26 } },
      { slot: 3, role: 'RCB', position: 'CB', anchor: { x: 19, y: 42 } },
      { slot: 4, role: 'RB', position: 'RB', anchor: { x: 24, y: 60 } },
      { slot: 5, role: 'LM', position: 'LM', anchor: { x: 48, y: 9 } },
      { slot: 6, role: 'LCM', position: 'CM', anchor: { x: 44, y: 28 } },
      { slot: 7, role: 'RCM', position: 'CM', anchor: { x: 44, y: 40 } },
      { slot: 8, role: 'RM', position: 'RM', anchor: { x: 48, y: 59 } },
      { slot: 9, role: 'LST', position: 'ST', anchor: { x: 70, y: 28 } },
      { slot: 10, role: 'RST', position: 'ST', anchor: { x: 70, y: 40 } },
    ],
  },
  '4-3-3': {
    formation: '4-3-3',
    name: '4-3-3 Wide',
    backLine: 4,
    slots: [
      { slot: 0, role: 'GK', position: 'GK', anchor: { x: 5, y: 34 } },
      { slot: 1, role: 'LB', position: 'LB', anchor: { x: 24, y: 8 } },
      { slot: 2, role: 'LCB', position: 'CB', anchor: { x: 19, y: 26 } },
      { slot: 3, role: 'RCB', position: 'CB', anchor: { x: 19, y: 42 } },
      { slot: 4, role: 'RB', position: 'RB', anchor: { x: 24, y: 60 } },
      { slot: 5, role: 'DM', position: 'DM', anchor: { x: 36, y: 34 } },
      { slot: 6, role: 'LCM', position: 'CM', anchor: { x: 48, y: 22 } },
      { slot: 7, role: 'RCM', position: 'CM', anchor: { x: 48, y: 46 } },
      { slot: 8, role: 'LW', position: 'LW', anchor: { x: 72, y: 10 } },
      { slot: 9, role: 'ST', position: 'ST', anchor: { x: 78, y: 34 } },
      { slot: 10, role: 'RW', position: 'RW', anchor: { x: 72, y: 58 } },
    ],
  },
  '4-2-3-1': {
    formation: '4-2-3-1',
    name: '4-2-3-1 Modern',
    backLine: 4,
    slots: [
      { slot: 0, role: 'GK', position: 'GK', anchor: { x: 5, y: 34 } },
      { slot: 1, role: 'LB', position: 'LB', anchor: { x: 24, y: 8 } },
      { slot: 2, role: 'LCB', position: 'CB', anchor: { x: 19, y: 26 } },
      { slot: 3, role: 'RCB', position: 'CB', anchor: { x: 19, y: 42 } },
      { slot: 4, role: 'RB', position: 'RB', anchor: { x: 24, y: 60 } },
      { slot: 5, role: 'LDM', position: 'DM', anchor: { x: 38, y: 27 } },
      { slot: 6, role: 'RDM', position: 'DM', anchor: { x: 38, y: 41 } },
      { slot: 7, role: 'LW', position: 'LW', anchor: { x: 64, y: 10 } },
      { slot: 8, role: 'AM', position: 'AM', anchor: { x: 62, y: 34 } },
      { slot: 9, role: 'RW', position: 'RW', anchor: { x: 64, y: 58 } },
      { slot: 10, role: 'ST', position: 'ST', anchor: { x: 80, y: 34 } },
    ],
  },
  '3-5-2': {
    formation: '3-5-2',
    name: '3-5-2 Wingbacks',
    backLine: 3,
    slots: [
      { slot: 0, role: 'GK', position: 'GK', anchor: { x: 5, y: 34 } },
      { slot: 1, role: 'LCB', position: 'CB', anchor: { x: 19, y: 18 } },
      { slot: 2, role: 'CB', position: 'CB', anchor: { x: 17, y: 34 } },
      { slot: 3, role: 'RCB', position: 'CB', anchor: { x: 19, y: 50 } },
      { slot: 4, role: 'LWB', position: 'LWB', anchor: { x: 46, y: 6 } },
      { slot: 5, role: 'DM', position: 'DM', anchor: { x: 36, y: 34 } },
      { slot: 6, role: 'LCM', position: 'CM', anchor: { x: 50, y: 24 } },
      { slot: 7, role: 'RCM', position: 'CM', anchor: { x: 50, y: 44 } },
      { slot: 8, role: 'RWB', position: 'RWB', anchor: { x: 46, y: 62 } },
      { slot: 9, role: 'LST', position: 'ST', anchor: { x: 72, y: 28 } },
      { slot: 10, role: 'RST', position: 'ST', anchor: { x: 72, y: 40 } },
    ],
  },
  '5-3-2': {
    formation: '5-3-2',
    name: '5-3-2 Solid',
    backLine: 5,
    slots: [
      { slot: 0, role: 'GK', position: 'GK', anchor: { x: 5, y: 34 } },
      { slot: 1, role: 'LWB', position: 'LWB', anchor: { x: 30, y: 6 } },
      { slot: 2, role: 'LCB', position: 'CB', anchor: { x: 19, y: 20 } },
      { slot: 3, role: 'CB', position: 'CB', anchor: { x: 17, y: 34 } },
      { slot: 4, role: 'RCB', position: 'CB', anchor: { x: 19, y: 48 } },
      { slot: 5, role: 'RWB', position: 'RWB', anchor: { x: 30, y: 62 } },
      { slot: 6, role: 'LCM', position: 'CM', anchor: { x: 44, y: 22 } },
      { slot: 7, role: 'CM', position: 'CM', anchor: { x: 42, y: 34 } },
      { slot: 8, role: 'RCM', position: 'CM', anchor: { x: 44, y: 46 } },
      { slot: 9, role: 'LST', position: 'ST', anchor: { x: 70, y: 28 } },
      { slot: 10, role: 'RST', position: 'ST', anchor: { x: 70, y: 40 } },
    ],
  },
  '4-1-4-1': {
    formation: '4-1-4-1',
    name: '4-1-4-1 Shield',
    backLine: 4,
    slots: [
      { slot: 0, role: 'GK', position: 'GK', anchor: { x: 5, y: 34 } },
      { slot: 1, role: 'LB', position: 'LB', anchor: { x: 24, y: 8 } },
      { slot: 2, role: 'LCB', position: 'CB', anchor: { x: 19, y: 26 } },
      { slot: 3, role: 'RCB', position: 'CB', anchor: { x: 19, y: 42 } },
      { slot: 4, role: 'RB', position: 'RB', anchor: { x: 24, y: 60 } },
      { slot: 5, role: 'DM', position: 'DM', anchor: { x: 34, y: 34 } },
      { slot: 6, role: 'LM', position: 'LM', anchor: { x: 54, y: 9 } },
      { slot: 7, role: 'LCM', position: 'CM', anchor: { x: 50, y: 26 } },
      { slot: 8, role: 'RCM', position: 'CM', anchor: { x: 50, y: 42 } },
      { slot: 9, role: 'RM', position: 'RM', anchor: { x: 54, y: 59 } },
      { slot: 10, role: 'ST', position: 'ST', anchor: { x: 78, y: 34 } },
    ],
  },
  '3-4-3': {
    formation: '3-4-3',
    name: '3-4-3 Attacking',
    backLine: 3,
    slots: [
      { slot: 0, role: 'GK', position: 'GK', anchor: { x: 5, y: 34 } },
      { slot: 1, role: 'LCB', position: 'CB', anchor: { x: 19, y: 18 } },
      { slot: 2, role: 'CB', position: 'CB', anchor: { x: 17, y: 34 } },
      { slot: 3, role: 'RCB', position: 'CB', anchor: { x: 19, y: 50 } },
      { slot: 4, role: 'LM', position: 'LM', anchor: { x: 48, y: 8 } },
      { slot: 5, role: 'LCM', position: 'CM', anchor: { x: 44, y: 27 } },
      { slot: 6, role: 'RCM', position: 'CM', anchor: { x: 44, y: 41 } },
      { slot: 7, role: 'RM', position: 'RM', anchor: { x: 48, y: 60 } },
      { slot: 8, role: 'LW', position: 'LW', anchor: { x: 72, y: 12 } },
      { slot: 9, role: 'ST', position: 'ST', anchor: { x: 78, y: 34 } },
      { slot: 10, role: 'RW', position: 'RW', anchor: { x: 72, y: 56 } },
    ],
  },
};

/**
 * Computes initial formation familiarities for a club per SPEC §9.2:
 * - The club's style formation: 85
 * - Formations sharing its back line: 60
 * - All others: 40
 */
export function getInitialFormationFamiliarity(
  styleFormation: Formation,
): Record<Formation, number> {
  const styleDef = FORMATIONS[styleFormation];
  const allFormations = Object.keys(FORMATIONS) as Formation[];
  const result: Partial<Record<Formation, number>> = {};

  for (const f of allFormations) {
    if (f === styleFormation) {
      result[f] = 85;
    } else if (FORMATIONS[f].backLine === styleDef.backLine) {
      result[f] = 60;
    } else {
      result[f] = 40;
    }
  }

  return result as Record<Formation, number>;
}
