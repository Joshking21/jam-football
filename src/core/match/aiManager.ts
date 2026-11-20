// Implements SPEC §13.13 AI Manager (Lineup selection, captain/takers, in-match adjustments) and §13.17.8
import {
  Player,
  PlayerId,
  Formation,
  Tactics,
  Side,
  Duty,
  Position,
  RoleId,
  PlayerInstruction,
  OppOrder,
  TeamInstructions,
  Attributes,
  Personality,
} from '../types';
import { FORMATIONS, FormationDef, FormationSlot } from '@/config/formations';
import { ovrAt, getPrimaryOvr } from '../player/ratings';
import { z } from '../math';
import { computeRoleFit, getDefaultRoleForPos, getAvailableRolesForSlot } from '@/config/roles';

export interface LineupSelectionResult {
  formation: Formation;
  lineup: (PlayerId | null)[]; // 11 slots
  roles: RoleId[];
  playerInstructions: PlayerInstruction[][];
  opposition: OppOrder[];
  duties: Duty[];
  bench: PlayerId[];
  captain: PlayerId;
  penaltyTaker: PlayerId;
  freeKickTaker: PlayerId;
  cornerTaker: PlayerId;
  longThrowTaker: PlayerId | null;
}

export interface PlayerSelectionCandidate {
  id: PlayerId;
  attributes: Attributes;
  positions: { pos: Position; familiarity: number }[];
  condition: number;
  morale: number;
  name?: string;
  firstName?: string;
  lastName?: string;
  personality?: Personality;
  isInjured?: boolean;
  isSuspended?: boolean;
  [key: string]: any;
}

const SLOT_FILL_ORDER: string[] = [
  'GK',
  'CB',
  'LB',
  'RB',
  'LWB',
  'RWB',
  'DM',
  'CM',
  'AM',
  'LM',
  'RM',
  'LW',
  'RW',
  'ST',
];

function scorePlayerForSlot(player: PlayerSelectionCandidate, slotPos: Position): number {
  const baseOvr = ovrAt(player, slotPos);
  const conditionFactor = 0.7 + 0.3 * (player.condition / 100);
  const moraleFactor = player.morale < 30 ? 0.97 : 1.0;
  return baseOvr * conditionFactor * moraleFactor;
}

export function pickBestLineup(
  players: PlayerSelectionCandidate[],
  clubStyleFormation: Formation,
  familiarities: Record<Formation, number>,
  clubStyle?: Partial<TeamInstructions>,
): LineupSelectionResult {
  // 1. Formation selection:
  // If 2+ slots in club style formation would have fit < 0.8, choose the formation among its familiarity >= 60 with highest total
  let chosenFormation: Formation = clubStyleFormation;

  const testFormationFit = (fName: Formation): { totalScore: number; poorSlots: number } => {
    const fDef = FORMATIONS[fName];
    let poorSlots = 0;
    let totalScore = 0;
    const used = new Set<PlayerId>();

    // Test filling
    for (const slot of fDef.slots) {
      let bestP: PlayerSelectionCandidate | null = null;
      let bestScore = -1;
      for (const p of players) {
        if (used.has(p.id) || p.isInjured || p.isSuspended) continue;
        const score = scorePlayerForSlot(p, slot.position);
        if (score > bestScore) {
          bestScore = score;
          bestP = p;
        }
      }
      if (bestP) {
        used.add(bestP.id);
        totalScore += bestScore;
        const rawOvr = getPrimaryOvr(bestP);
        if (rawOvr > 0 && ovrAt(bestP, slot.position) / rawOvr < 0.8) {
          poorSlots++;
        }
      } else {
        poorSlots++;
      }
    }
    return { totalScore, poorSlots };
  };

  const styleFit = testFormationFit(clubStyleFormation);
  if (styleFit.poorSlots >= 2) {
    let bestAltScore = -1;
    let bestAltFormation = clubStyleFormation;
    const allFormations = Object.keys(FORMATIONS) as Formation[];
    for (const f of allFormations) {
      if ((familiarities[f] ?? 0) >= 60) {
        const fit = testFormationFit(f);
        if (fit.totalScore > bestAltScore) {
          bestAltScore = fit.totalScore;
          bestAltFormation = f;
        }
      }
    }
    chosenFormation = bestAltFormation;
  }

  // 2. Fill slots in order: GK, CBs, FBs/WBs, DM, CM, AM, wide mids/wingers, STs
  const fDef = FORMATIONS[chosenFormation];
  const lineup: (PlayerId | null)[] = new Array(11).fill(null);
  const usedPlayerIds = new Set<PlayerId>();

  // Group slots by category order
  const orderedSlots: FormationSlot[] = [];
  for (const groupName of SLOT_FILL_ORDER) {
    for (const slot of fDef.slots) {
      if (slot.position === groupName) {
        orderedSlots.push(slot);
      }
    }
  }

  for (const slot of orderedSlots) {
    // Find candidate maximizing scorePlayerForSlot
    // excluding injured, suspended and condition < 60 if any alternative >= 0.85 of best score exists
    const available = players.filter(
      (p) => !usedPlayerIds.has(p.id) && !p.isInjured && !p.isSuspended,
    );

    let bestScoreAll = -1;
    let bestPlayerAll: PlayerSelectionCandidate | null = null;
    for (const p of available) {
      const score = scorePlayerForSlot(p, slot.position);
      if (score > bestScoreAll) {
        bestScoreAll = score;
        bestPlayerAll = p;
      }
    }

    if (!bestPlayerAll) continue;

    // Filter condition < 60 if alternative >= 0.85 of best score exists
    let chosenPlayer = bestPlayerAll;
    if (chosenPlayer.condition < 60) {
      const validAlts = available.filter(
        (p) => p.condition >= 60 && scorePlayerForSlot(p, slot.position) >= 0.85 * bestScoreAll,
      );
      if (validAlts.length > 0) {
        validAlts.sort(
          (a, b) => scorePlayerForSlot(b, slot.position) - scorePlayerForSlot(a, slot.position),
        );
        chosenPlayer = validAlts[0]!;
      }
    }

    lineup[slot.slot] = chosenPlayer.id;
    usedPlayerIds.add(chosenPlayer.id);
  }

  // 3. Bench: best remaining by OVR, ensure 1 GK, then fill to 9
  const remaining = players.filter(
    (p) => !usedPlayerIds.has(p.id) && !p.isInjured && !p.isSuspended,
  );
  const bench: PlayerId[] = [];

  // Ensure 1 GK on bench if available
  const backupGk = remaining.find((p) => p.positions[0]?.pos === 'GK');
  if (backupGk) {
    bench.push(backupGk.id);
    usedPlayerIds.add(backupGk.id);
  }

  const remainingOutfield = players
    .filter((p) => !usedPlayerIds.has(p.id) && !p.isInjured && !p.isSuspended)
    .sort((a, b) => getPrimaryOvr(b) - getPrimaryOvr(a));

  for (const p of remainingOutfield) {
    if (bench.length >= 9) break;
    bench.push(p.id);
    usedPlayerIds.add(p.id);
  }

  // 4. Duties: assign default duties based on position
  const duties: Duty[] = fDef.slots.map((slot) => {
    if (slot.position === 'GK' || slot.position === 'CB') return 'Defend';
    if (slot.position === 'ST' || slot.position === 'LW' || slot.position === 'RW') return 'Attack';
    return 'Support';
  });

  // 5. Captain: highest OVR Leader in the XI, else highest OVR
  const xiPlayers = lineup
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is PlayerSelectionCandidate => p != null);

  const leaders = xiPlayers.filter((p) => p.personality === 'Leader');
  leaders.sort((a, b) => getPrimaryOvr(b) - getPrimaryOvr(a));

  let captain = xiPlayers[0]?.id ?? players[0]!.id;
  if (leaders.length > 0) {
    captain = leaders[0]!.id;
  } else {
    const sortedXi = [...xiPlayers].sort((a, b) => getPrimaryOvr(b) - getPrimaryOvr(a));
    if (sortedXi.length > 0) captain = sortedXi[0]!.id;
  }

  // 6. Takers
  // Penalty = best S_fin(PENALTY) (setPieces .4, finishing .3, composure .3)
  const penaltyTakers = [...xiPlayers].sort((a, b) => {
    const sa =
      0.4 * z(a.attributes.setPieces) +
      0.3 * z(a.attributes.finishing) +
      0.3 * z(a.attributes.composure);
    const sb =
      0.4 * z(b.attributes.setPieces) +
      0.3 * z(b.attributes.finishing) +
      0.3 * z(b.attributes.composure);
    return sb - sa;
  });
  const penaltyTaker = penaltyTakers[0]?.id ?? captain;

  // Free kick = best setPieces
  const fkTakers = [...xiPlayers].sort((a, b) => b.attributes.setPieces - a.attributes.setPieces);
  const freeKickTaker = fkTakers[0]?.id ?? captain;

  // Corner = best setPieces among wide/central mids (or anyone except GK/CB if none)
  const midCandidates = xiPlayers.filter((p) => {
    const pos = p.positions[0]?.pos;
    return (
      pos === 'LM' || pos === 'RM' || pos === 'CM' || pos === 'AM' || pos === 'LW' || pos === 'RW'
    );
  });
  const cornerPool =
    midCandidates.length > 0
      ? midCandidates
      : xiPlayers.filter((p) => p.positions[0]?.pos !== 'GK');
  cornerPool.sort((a, b) => b.attributes.setPieces - a.attributes.setPieces);
  const cornerTaker = cornerPool[0]?.id ?? freeKickTaker;

  // 7. Roles & Player Instructions (SPEC §13.17.8)
  let ballPlayingCbAssigned = false;
  const roles: RoleId[] = fDef.slots.map((slot) => {
    const defaultRole = getDefaultRoleForPos(slot.position);
    const pId = lineup[slot.slot];
    const p = pId ? players.find((cand) => cand.id === pId) : null;
    if (!p) return defaultRole;

    const available = getAvailableRolesForSlot(slot.position);
    let bestRole = defaultRole;
    let bestFit = 0;

    for (const r of available) {
      const { fit } = computeRoleFit(r.id, p.attributes);
      if (fit > bestFit) {
        bestFit = fit;
        bestRole = r.id;
      }
    }

    let role = bestFit >= 0.6 ? bestRole : defaultRole;

    // Club style overrides when fit >= 0.5 (§13.17.8)
    if (clubStyle) {
      if (slot.position === 'ST') {
        if (
          clubStyle.passing === 'Direct' &&
          computeRoleFit('target_man', p.attributes).fit >= 0.5
        ) {
          role = 'target_man';
        } else if (
          clubStyle.pressing === 'High' &&
          computeRoleFit('pressing_forward', p.attributes).fit >= 0.5
        ) {
          role = 'pressing_forward';
        }
      } else if (['LM', 'RM', 'LW', 'RW'].includes(slot.position)) {
        if (clubStyle.width === 'Wide' && computeRoleFit('winger', p.attributes).fit >= 0.5) {
          role = 'winger';
        }
      } else if (slot.position === 'CB' && !ballPlayingCbAssigned) {
        if (
          clubStyle.passing === 'Short' &&
          computeRoleFit('ball_playing_cb', p.attributes).fit >= 0.5
        ) {
          role = 'ball_playing_cb';
          ballPlayingCbAssigned = true;
        }
      } else if (slot.position === 'DM') {
        if (
          clubStyle.mentality === 'Defensive' &&
          computeRoleFit('anchor', p.attributes).fit >= 0.5
        ) {
          role = 'anchor';
        }
      } else if (['LB', 'RB', 'LWB', 'RWB'].includes(slot.position)) {
        if (
          clubStyle.mentality === 'Defensive' &&
          computeRoleFit('fb_defensive', p.attributes).fit >= 0.5
        ) {
          role = 'fb_defensive';
        }
      }
    }

    return role;
  });

  // Player Instructions (SPEC §13.17.8: AI uses at most one per player, only shootLess for low-longShots midfielders)
  const playerInstructions: PlayerInstruction[][] = fDef.slots.map((slot) => {
    const pId = lineup[slot.slot];
    const p = pId ? players.find((cand) => cand.id === pId) : null;
    if (!p) return [];
    if (['DM', 'CM', 'AM'].includes(slot.position) && p.attributes.longShots <= 50) {
      return ['shootLess'];
    }
    return [];
  });

  // Long throw taker (outfield player with strength >= 70)
  const outfieldXi = xiPlayers.filter((p) => p.positions[0]?.pos !== 'GK');
  const strongThrowers = outfieldXi.filter((p) => p.attributes.strength >= 70);
  strongThrowers.sort((a, b) => b.attributes.strength - a.attributes.strength);
  const longThrowTaker = strongThrowers[0]?.id ?? null;

  const opposition: OppOrder[] = [];

  return {
    formation: chosenFormation,
    lineup,
    roles,
    playerInstructions,
    opposition,
    duties,
    bench,
    captain,
    penaltyTaker,
    freeKickTaker,
    cornerTaker,
    longThrowTaker,
  };
}

export interface InMatchAiDecision {
  instructionChanges?: Partial<Tactics['instructions']>;
  substitutions?: { outId: PlayerId; inId: PlayerId; slot: number }[];
  oppositionChanges?: OppOrder[];
  playerInstructionChanges?: { slot: number; instructions: PlayerInstruction[] }[];
}

export function determineAiOppositionOrders(params: {
  ourReputation: number;
  ourXi: PlayerSelectionCandidate[];
  oppXi: PlayerSelectionCandidate[];
}): OppOrder[] {
  const { ourReputation, ourXi, oppXi } = params;
  if (ourReputation < 3) return [];

  const attackers = oppXi.filter((p) => {
    const pos = p.positions[0]?.pos;
    return pos === 'ST' || pos === 'LW' || pos === 'RW' || pos === 'AM';
  });
  if (attackers.length === 0) return [];
  attackers.sort((a, b) => getPrimaryOvr(b) - getPrimaryOvr(a));
  const bestAttacker = attackers[0]!;

  const defenders = ourXi.filter((p) => {
    const pos = p.positions[0]?.pos;
    return pos === 'CB' || pos === 'LB' || pos === 'RB' || pos === 'DM';
  });
  if (defenders.length === 0) return [];
  defenders.sort((a, b) => getPrimaryOvr(b) - getPrimaryOvr(a));
  const bestDefender = defenders[0]!;

  if (getPrimaryOvr(bestAttacker) >= getPrimaryOvr(bestDefender) + 5) {
    return [{ kind: 'tightMark', target: bestAttacker.id }];
  }
  return [];
}

export function determineAiTransitions(baseInstructions: TeamInstructions): TeamInstructions {
  const instructions = { ...baseInstructions };
  if (instructions.pressing === 'High' && instructions.mentality === 'Attacking') {
    instructions.onLoss = 'CounterPress';
  } else if (instructions.mentality === 'Defensive') {
    instructions.onLoss = 'Regroup';
    instructions.onWin = 'Counter';
  }
  if (instructions.passing === 'Direct') {
    instructions.distribution = 'Long';
  }
  return instructions;
}

export function evaluateInMatchAi(params: {
  minute: number;
  side: Side;
  ourScore: number;
  oppScore: number;
  currentTactics: Tactics;
  lineup: (PlayerId | null)[];
  bench: PlayerId[];
  subsUsed: number;
  windowsUsed: number;
  players: Record<
    PlayerId,
    Pick<Player, 'id' | 'positions' | 'attributes'> & {
      condition: number;
      rating: number;
      isRedCarded?: boolean;
      yellowCards?: number;
      goals?: number;
      assists?: number;
    }
  >;
  oppLineup?: (PlayerId | null)[];
}): InMatchAiDecision {
  const {
    minute,
    side,
    ourScore,
    oppScore,
    currentTactics,
    lineup,
    bench,
    subsUsed,
    windowsUsed,
    players,
    oppLineup,
  } = params;

  const decision: InMatchAiDecision = {};
  const instructionChanges: Partial<Tactics['instructions']> = {};

  const goalDiff = ourScore - oppScore;

  // Tactical adjustments based on score and time
  if (minute >= 65 && goalDiff < 0) {
    instructionChanges.mentality = 'Attacking';
  }
  if (minute >= 80 && goalDiff < 0) {
    instructionChanges.tempo = 'Fast';
    instructionChanges.line = 'High';
  }
  if (minute >= 80 && goalDiff === 1) {
    instructionChanges.mentality = 'Defensive';
    instructionChanges.tempo = 'Slow';
  }

  // Check substitutions at 60', 70', 78'
  const isSubMinute = minute === 60 || minute === 70 || minute === 78;
  const canSub = subsUsed < 5 && windowsUsed < 3 && bench.length > 0;

  if (isSubMinute && canSub) {
    // Find on-pitch player with lowest condition if < 65, or lowest rating if < 5.8
    let worstPlayer: { id: PlayerId; slot: number; reason: number } | null = null;

    lineup.forEach((id, slot) => {
      if (!id) return;
      const p = players[id];
      if (!p || p.isRedCarded) return;
      if (p.condition < 65) {
        if (!worstPlayer || p.condition < worstPlayer.reason) {
          worstPlayer = { id, slot, reason: p.condition };
        }
      } else if (p.rating > 0 && p.rating < 5.8) {
        if (!worstPlayer || p.rating < worstPlayer.reason) {
          worstPlayer = { id, slot, reason: p.rating };
        }
      }
    });

    if (worstPlayer) {
      const outP = players[(worstPlayer as { id: PlayerId; slot: number }).id];
      const targetPos = outP?.positions[0]?.pos || 'CM';

      // Pick like-for-like position from bench
      let bestBenchP: PlayerId | null = null;
      let bestScore = -1;

      for (const bId of bench) {
        const bp = players[bId];
        if (!bp || bp.isRedCarded) continue;
        const score = ovrAt(bp, targetPos);
        if (score > bestScore) {
          bestScore = score;
          bestBenchP = bId;
        }
      }

      if (bestBenchP) {
        decision.substitutions = [
          {
            outId: (worstPlayer as { id: PlayerId; slot: number }).id,
            inId: bestBenchP,
            slot: (worstPlayer as { id: PlayerId; slot: number }).slot,
          },
        ];
      }
    }
  }

  // Opposition orders: doubleUp on a user player with >= 2 goals + assists in match (once, max 1 doubleUp, max 3 orders)
  if (
    oppLineup &&
    currentTactics.opposition.length < 3 &&
    !currentTactics.opposition.some((o) => o.kind === 'doubleUp')
  ) {
    for (const oppId of oppLineup) {
      if (!oppId) continue;
      const p = players[oppId];
      if (p && (p.goals ?? 0) + (p.assists ?? 0) >= 2) {
        decision.oppositionChanges = [
          ...currentTactics.opposition,
          { kind: 'doubleUp', target: oppId },
        ];
        break;
      }
    }
  }

  // Player instructions:
  // - stayOnFeet for players on a yellow after 60'
  // - getForward when chasing a game at 75'+
  const piChanges: { slot: number; instructions: PlayerInstruction[] }[] = [];
  lineup.forEach((pId, slot) => {
    if (!pId) return;
    const p = players[pId];
    if (!p) return;
    const existing = currentTactics.playerInstructions?.[slot] ?? [];

    if (
      minute >= 60 &&
      (p.yellowCards ?? 0) >= 1 &&
      !existing.includes('stayOnFeet') &&
      existing.length === 0
    ) {
      piChanges.push({ slot, instructions: ['stayOnFeet'] });
    } else if (
      minute >= 75 &&
      goalDiff < 0 &&
      !existing.includes('getForward') &&
      existing.length === 0
    ) {
      const pos = p.positions[0]?.pos;
      if (pos && ['CM', 'AM', 'LM', 'RM', 'LW', 'RW'].includes(pos)) {
        piChanges.push({ slot, instructions: ['getForward'] });
      }
    }
  });

  if (piChanges.length > 0) {
    decision.playerInstructionChanges = piChanges;
  }

  if (Object.keys(instructionChanges).length > 0) {
    decision.instructionChanges = instructionChanges;
  }

  return decision;
}
