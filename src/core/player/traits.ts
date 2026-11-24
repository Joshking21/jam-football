// Implements SPEC §13.23 Player Traits (definitions, eligibility, world gen, clashes, and learning)
import {
  TraitId,
  Player,
  Position,
  Attributes,
  AttributeKey,
  PlayerInstruction,
  RoleId,
} from '../types';
import { Rng, createRng, deriveSeed } from '../rng';
import { clamp } from '../math';
import { K, BALANCE } from '@/config/balance';

export interface TraitDefinition {
  id: TraitId;
  name: string;
  wording: string;
  whoCanHaveIt: string;
  effect: string;
  cost: string;
  keyAttr: AttributeKey;
  needs: number;
  opposingInstruction?: PlayerInstruction;
  matchingRole?: RoleId;
  isEligible: (p: { attributes: Attributes; positions: { pos: Position }[] }) => boolean;
}

const WIDE_POSITIONS: Set<Position> = new Set(['LB', 'RB', 'LWB', 'RWB', 'LM', 'RM', 'LW', 'RW']);
const DEF_MID_POSITIONS: Set<Position> = new Set([
  'CB',
  'LB',
  'RB',
  'LWB',
  'RWB',
  'DM',
  'CM',
  'LM',
  'RM',
  'AM',
]);
const DEF_DM_POSITIONS: Set<Position> = new Set(['CB', 'LB', 'RB', 'LWB', 'RWB', 'DM']);

export const TRAIT_DEFINITIONS: Record<TraitId, TraitDefinition> = {
  cutsInside: {
    id: 'cutsInside',
    name: 'Cuts inside',
    wording: 'Cuts inside from the wing',
    whoCanHaveIt: 'Wide players (dribbling ≥ 60)',
    effect: 'Involvement ATT lane→C 20%; shot utility +0.2 from ATT wide',
    cost: 'Crosses −40%',
    keyAttr: 'dribbling',
    needs: 60,
    matchingRole: 'inside_forward',
    isEligible: (p) => {
      const primary = p.positions[0]?.pos;
      return Boolean(primary && WIDE_POSITIONS.has(primary) && p.attributes.dribbling >= 60);
    },
  },
  shootsFromDistance: {
    id: 'shootsFromDistance',
    name: 'Shoots from distance',
    wording: 'Shoots from distance',
    whoCanHaveIt: 'Long shots ≥ 60',
    effect: 'Shot utility +0.3 outside the box',
    cost: 'Low-xG shots; possession lost on misses',
    keyAttr: 'longShots',
    needs: 60,
    opposingInstruction: 'shootLess',
    isEligible: (p) => p.attributes.longShots >= 60,
  },
  getsForward: {
    id: 'getsForward',
    name: 'Gets forward',
    wording: 'Gets forward whenever possible',
    whoCanHaveIt: 'DEF and MID (stamina ≥ 60)',
    effect: 'Involvement DEF→ATT 10%',
    cost: 'Opponent counter shot context +0.05 down his side',
    keyAttr: 'stamina',
    needs: 60,
    opposingInstruction: 'holdPosition',
    isEligible: (p) => {
      const primary = p.positions[0]?.pos;
      return Boolean(primary && DEF_MID_POSITIONS.has(primary) && p.attributes.stamina >= 60);
    },
  },
  staysBack: {
    id: 'staysBack',
    name: 'Stays back',
    wording: 'Stays back at all times',
    whoCanHaveIt: 'DEF and DM',
    effect: 'Involvement ATT→DEF 15%; opponent counter context −0.04',
    cost: 'Fewer attacking touches',
    keyAttr: 'positioning',
    needs: 50,
    opposingInstruction: 'getForward',
    isEligible: (p) => {
      const primary = p.positions[0]?.pos;
      return Boolean(primary && DEF_DM_POSITIONS.has(primary));
    },
  },
  playsOneTwos: {
    id: 'playsOneTwos',
    name: 'Plays one-twos',
    wording: 'Plays one-twos',
    whoCanHaveIt: 'Passing ≥ 60',
    effect: 'After short pass, return pass receiver weight ×1.4, pass context +0.05',
    cost: 'Dribble utility −0.2',
    keyAttr: 'passing',
    needs: 60,
    isEligible: (p) => p.attributes.passing >= 60,
  },
  killerBalls: {
    id: 'killerBalls',
    name: 'Tries killer balls',
    wording: 'Tries killer balls often',
    whoCanHaveIt: 'Passing ≥ 65',
    effect: 'Through ball utility +0.3',
    cost: 'Interceptions +15% on his passes',
    keyAttr: 'passing',
    needs: 65,
    opposingInstruction: 'playSafe',
    isEligible: (p) => p.attributes.passing >= 65,
  },
  runsWithBall: {
    id: 'runsWithBall',
    name: 'Runs with ball',
    wording: 'Runs with the ball often',
    whoCanHaveIt: 'Dribbling ≥ 60',
    effect: 'Dribble utility +0.25 in MID',
    cost: 'Ball lost in MID +10%',
    keyAttr: 'dribbling',
    needs: 60,
    opposingInstruction: 'dribbleLess',
    isEligible: (p) => p.attributes.dribbling >= 60,
  },
  arrivesLate: {
    id: 'arrivesLate',
    name: 'Arrives late',
    wording: 'Arrives late in the box',
    whoCanHaveIt: 'CM and AM (off the ball ≥ 60)',
    effect: 'Receiver weight ×1.3 on cutbacks and BOX_CENTRAL',
    cost: 'DEF cover −10%',
    keyAttr: 'offTheBall',
    needs: 60,
    isEligible: (p) => {
      const primary = p.positions[0]?.pos;
      return Boolean(
        primary &&
          (primary === 'CM' || primary === 'AM' || primary === 'DM') &&
          p.attributes.offTheBall >= 60,
      );
    },
  },
  holdsUp: {
    id: 'holdsUp',
    name: 'Holds up ball',
    wording: 'Holds up the ball',
    whoCanHaveIt: 'ST (strength ≥ 65)',
    effect: 'Receiver first touch +0.15 on long balls; next step recycle +0.2',
    cost: 'Through-ball receptions −20%',
    keyAttr: 'strength',
    needs: 65,
    isEligible: (p) => {
      const primary = p.positions[0]?.pos;
      return Boolean(primary === 'ST' && p.attributes.strength >= 65);
    },
  },
  comesDeep: {
    id: 'comesDeep',
    name: 'Comes deep',
    wording: 'Comes deep to get the ball',
    whoCanHaveIt: 'ST and AM',
    effect: 'Involvement ATT→MID 15%',
    cost: 'Box receptions −15%',
    keyAttr: 'offTheBall',
    needs: 55,
    isEligible: (p) => {
      const primary = p.positions[0]?.pos;
      return Boolean(primary && (primary === 'ST' || primary === 'AM'));
    },
  },
  attacksAir: {
    id: 'attacksAir',
    name: 'Attacks air',
    wording: 'Attacks the ball in the air',
    whoCanHaveIt: 'Heading ≥ 65',
    effect: 'S_air +0.1 at corners and crosses',
    cost: 'Fouls in aerial duels ×1.2',
    keyAttr: 'heading',
    needs: 65,
    isEligible: (p) => p.attributes.heading >= 65,
  },
  divesIn: {
    id: 'divesIn',
    name: 'Dives into tackles',
    wording: 'Dives into tackles',
    whoCanHaveIt: 'Any outfield',
    effect: 'Defender S_tkl +0.15',
    cost: 'Fouls ×1.4',
    keyAttr: 'tackling',
    needs: 50,
    opposingInstruction: 'stayOnFeet',
    isEligible: (p) => {
      const primary = p.positions[0]?.pos;
      return primary !== 'GK';
    },
  },
};

export const ALL_TRAIT_IDS: TraitId[] = Object.keys(TRAIT_DEFINITIONS) as TraitId[];

/**
 * Checks whether a trait is negated by an active opposing instruction (§13.23)
 */
export function isTraitClashing(
  trait: TraitId,
  instructions?: readonly string[],
): { clashes: boolean; opposingInstruction?: PlayerInstruction } {
  if (!instructions || instructions.length === 0) return { clashes: false };
  const def = TRAIT_DEFINITIONS[trait];
  if (def?.opposingInstruction && instructions.includes(def.opposingInstruction)) {
    return { clashes: true, opposingInstruction: def.opposingInstruction };
  }
  return { clashes: false };
}

/**
 * Rolls traits for a player during world generation (§13.23)
 * Each eligible trait is rolled once with chance 0.08 + 0.25 * clamp((keyAttr - needs) / 20, 0, 1), cap 3
 */
export function rollPlayerTraits(
  player: { attributes: Attributes; positions: { pos: Position; familiarity?: number }[] },
  rng: Rng,
): TraitId[] {
  const eligibleTraits: { id: TraitId; score: number }[] = [];
  const cfg = K.traits.worldGen;

  for (const traitId of ALL_TRAIT_IDS) {
    const def = TRAIT_DEFINITIONS[traitId];
    if (!def.isEligible(player)) continue;

    const keyVal = player.attributes[def.keyAttr];
    const diff = Math.max(0, keyVal - def.needs);
    const score = diff / cfg.divisor;
    const chance = clamp(cfg.baseChance + cfg.bonusSlope * score, 0.05, 0.7);

    if (rng.chance(chance)) {
      eligibleTraits.push({ id: traitId, score });
    }
  }

  // Sort by score descending and cap at maxTraits (3)
  eligibleTraits.sort((a, b) => b.score - a.score);
  return eligibleTraits.slice(0, cfg.maxTraits).map((t) => t.id);
}

/**
 * Calculates weekly trait training progress (§13.23)
 * Progress per week: 8 + (age <= 23 ? 4 : age >= 30 ? -3 : 0) + (decisions >= 70 ? 2 : 0) * coachFactor
 */
export function calculateTraitTrainingProgress(player: Player, coachStars: number): number {
  const cfg = K.traits.learning;
  let base = cfg.baseProgress;
  if (player.age <= 23) base += cfg.youthBonus;
  else if (player.age >= 30) base += cfg.veteranPenalty;

  if (player.attributes.decisions >= 70) {
    base += cfg.decisionsBonus;
  }

  const coachFactor =
    BALANCE.club.coachDevBase + BALANCE.club.coachDevPerStar * Math.max(1, coachStars);
  return Math.round(base * coachFactor);
}

/** Traits belong to the fixed world: the same player has the same traits in every game. */
export const WORLD_TRAIT_SEED = 20261122;

/** The traits a player is born with (own RNG stream per player, so world gen is untouched). */
export function worldTraitsFor(player: {
  id: string;
  attributes: Attributes;
  positions: { pos: Position; familiarity?: number }[];
}): TraitId[] {
  return rollPlayerTraits(player, createRng(deriveSeed(WORLD_TRAIT_SEED, 'traits', player.id)));
}

/**
 * Gives every player without a `traits` field his world traits (§13.23). Used by new games (the
 * frozen world snapshot predates traits) and by save migration. Players who already have a
 * `traits` array, even an empty one, keep it.
 */
export function ensureWorldTraits(players: Record<string, Player>): void {
  for (const p of Object.values(players)) {
    if (!Array.isArray(p.traits)) p.traits = worldTraitsFor(p);
  }
}
