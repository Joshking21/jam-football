// Implements SPEC §13.18.11 Familiarity per area
import {
  Familiarity,
  Formation,
  Mentality,
  PassingStyle,
  Pressing,
  Tactics,
  TeamInstructions,
} from '../types';

const FOUR_BACK_FORMATIONS: Formation[] = ['4-4-2', '4-3-3', '4-2-3-1', '4-1-4-1'];
const THREE_FIVE_BACK_FORMATIONS: Formation[] = ['3-5-2', '5-3-2', '3-4-3'];

const ALL_FORMATIONS: Formation[] = [
  '4-4-2',
  '4-3-3',
  '4-2-3-1',
  '3-5-2',
  '5-3-2',
  '4-1-4-1',
  '3-4-3',
];
const ALL_MENTALITIES: Mentality[] = [
  'VeryDefensive',
  'Defensive',
  'Balanced',
  'Attacking',
  'VeryAttacking',
];
const ALL_PASSINGS: PassingStyle[] = ['Short', 'Mixed', 'Direct'];
const ALL_PRESSINGS: Pressing[] = ['Low', 'Mid', 'High'];

export function createStartingFamiliarity(
  style?: Partial<TeamInstructions & { formation: Formation }>,
  preferredFormation: Formation = '4-4-2',
): Familiarity {
  const isFourBack = FOUR_BACK_FORMATIONS.includes(preferredFormation);

  const formation: Familiarity['formation'] = {
    '4-4-2': 40,
    '4-3-3': 40,
    '4-2-3-1': 40,
    '3-5-2': 40,
    '5-3-2': 40,
    '4-1-4-1': 40,
    '3-4-3': 40,
  };

  for (const f of ALL_FORMATIONS) {
    if (f === preferredFormation) {
      formation[f] = 90;
    } else if (
      (isFourBack && FOUR_BACK_FORMATIONS.includes(f)) ||
      (!isFourBack && THREE_FIVE_BACK_FORMATIONS.includes(f))
    ) {
      formation[f] = 65;
    } else {
      formation[f] = 40;
    }
  }

  const prefMentality = style?.mentality ?? 'Balanced';
  const prefMentIdx = ALL_MENTALITIES.indexOf(prefMentality);
  const mentality: Familiarity['mentality'] = {
    VeryDefensive: 45,
    Defensive: 45,
    Balanced: 45,
    Attacking: 45,
    VeryAttacking: 45,
  };
  for (let i = 0; i < ALL_MENTALITIES.length; i++) {
    const m = ALL_MENTALITIES[i]!;
    const dist = Math.abs(i - (prefMentIdx >= 0 ? prefMentIdx : 2));
    if (dist === 0) mentality[m] = 90;
    else if (dist === 1) mentality[m] = 65;
    else mentality[m] = 45;
  }

  const prefPassing = style?.passing ?? 'Mixed';
  const prefPassIdx = ALL_PASSINGS.indexOf(prefPassing);
  const passing: Familiarity['passing'] = {
    Short: 45,
    Mixed: 45,
    Direct: 45,
  };
  for (let i = 0; i < ALL_PASSINGS.length; i++) {
    const p = ALL_PASSINGS[i]!;
    const dist = Math.abs(i - (prefPassIdx >= 0 ? prefPassIdx : 1));
    if (dist === 0) passing[p] = 90;
    else if (dist === 1) passing[p] = 65;
    else passing[p] = 45;
  }

  const prefPressing = style?.pressing ?? 'Mid';
  const prefPressIdx = ALL_PRESSINGS.indexOf(prefPressing);
  const pressing: Familiarity['pressing'] = {
    Low: 45,
    Mid: 45,
    High: 45,
  };
  for (let i = 0; i < ALL_PRESSINGS.length; i++) {
    const pr = ALL_PRESSINGS[i]!;
    const dist = Math.abs(i - (prefPressIdx >= 0 ? prefPressIdx : 1));
    if (dist === 0) pressing[pr] = 90;
    else if (dist === 1) pressing[pr] = 65;
    else pressing[pr] = 45;
  }

  return {
    formation,
    mentality,
    passing,
    pressing,
  };
}

export function updateClubFamiliarity(
  fam: Familiarity,
  tactics: Tactics,
  isTacticalTraining: boolean = false,
): Familiarity {
  const boost = isTacticalTraining ? 12 : 6;
  const decay = 2;
  const floor = 40;
  const cap = 100;

  const usedFormation = tactics.formation;
  const usedMentality = tactics.instructions.mentality;
  const usedPassing = tactics.instructions.passing;
  const usedPressing = tactics.instructions.pressing;

  const nextFam: Familiarity = {
    formation: { ...fam.formation },
    mentality: { ...fam.mentality },
    passing: { ...fam.passing },
    pressing: { ...fam.pressing },
  };

  for (const f of ALL_FORMATIONS) {
    const current = nextFam.formation[f] ?? floor;
    if (f === usedFormation) {
      nextFam.formation[f] = Math.min(cap, current + boost);
    } else {
      nextFam.formation[f] = Math.max(floor, current - decay);
    }
  }

  for (const m of ALL_MENTALITIES) {
    const current = nextFam.mentality[m] ?? floor;
    if (m === usedMentality) {
      nextFam.mentality[m] = Math.min(cap, current + boost);
    } else {
      nextFam.mentality[m] = Math.max(floor, current - decay);
    }
  }

  for (const p of ALL_PASSINGS) {
    const current = nextFam.passing[p] ?? floor;
    if (p === usedPassing) {
      nextFam.passing[p] = Math.min(cap, current + boost);
    } else {
      nextFam.passing[p] = Math.max(floor, current - decay);
    }
  }

  for (const pr of ALL_PRESSINGS) {
    const current = nextFam.pressing[pr] ?? floor;
    if (pr === usedPressing) {
      nextFam.pressing[pr] = Math.min(cap, current + boost);
    } else {
      nextFam.pressing[pr] = Math.max(floor, current - decay);
    }
  }

  return nextFam;
}
