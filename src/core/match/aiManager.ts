// Implements SPEC §13.13 AI Manager (Lineup selection, captain/takers, in-match adjustments)
import { Player, PlayerId, Formation, Tactics, Side, Duty, Position } from '../types';
import { FORMATIONS, FormationDef, FormationSlot } from '@/config/formations';
import { ovrAt, getPrimaryOvr } from '../player/ratings';
import { z } from '../math';

export interface LineupSelectionResult {
  formation: Formation;
  lineup: (PlayerId | null)[]; // 11 slots
  duties: Duty[];
  bench: PlayerId[];
  captain: PlayerId;
  penaltyTaker: PlayerId;
  freeKickTaker: PlayerId;
  cornerTaker: PlayerId;
}

export interface PlayerSelectionCandidate extends Player {
  isInjured?: boolean;
  isSuspended?: boolean;
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

  return {
    formation: chosenFormation,
    lineup,
    duties,
    bench,
    captain,
    penaltyTaker,
    freeKickTaker,
    cornerTaker,
  };
}

export interface InMatchAiDecision {
  instructionChanges?: Partial<Tactics['instructions']>;
  substitutions?: { outId: PlayerId; inId: PlayerId; slot: number }[];
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
    }
  >;
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

  if (Object.keys(instructionChanges).length > 0) {
    decision.instructionChanges = instructionChanges;
  }

  return decision;
}
