// Implements SPEC §9 World Generation (fixed world from WORLD_SEED)
import {
  Club,
  ClubId,
  Player,
  PlayerId,
  Position,
  Foot,
  Personality,
  SquadRole,
  NationCode,
  Attributes,
  AttributeKey,
  Tactics,
} from '../types';
import { WORLD_SEED } from '@/config/constants';
import { createRng, Rng } from '../rng';
import { makePlayerId } from '../ids';
import { CLUBS_DATA } from './clubs.data';
import { NATION_NAMES } from './names.data';
import { FAMOUS_PLAYERS_AND_MANAGERS, FAMOUS_SURNAMES } from './blocklist.data';
import { FORMATIONS, getInitialFormationFamiliarity } from '@/config/formations';
import { getDefaultRoleForPos } from '@/config/roles';
import { getPositionWeights, rawOvr, getPrimaryOvr } from '../player/ratings';
import { valueOf, wageFor } from '../player/value';
import { generateFixtures } from '../season/fixtures';
import { createInitialTable, sortTable } from '../season/table';
import { BALANCED_WEEK_SCHEDULE } from '../people/training';
import { createDefaultSetPieceTactics } from '../match/setPieces';

export interface WorldSnapshot {
  seed: number;
  clubs: Record<ClubId, Club>;
  players: Record<PlayerId, Player>;
  freeAgents: PlayerId[];
  fixtures: ReturnType<typeof generateFixtures>;
  table: ReturnType<typeof createInitialTable>;
}

const NATION_WEIGHTS: Array<{ code: NationCode; weight: number }> = [
  { code: 'ENG', weight: 30 },
  { code: 'NGA', weight: 10 },
  { code: 'FRA', weight: 8 },
  { code: 'ESP', weight: 7 },
  { code: 'BRA', weight: 7 },
  { code: 'NED', weight: 5 },
  { code: 'GHA', weight: 5 },
  { code: 'POR', weight: 5 },
  { code: 'GER', weight: 5 },
  { code: 'IRL', weight: 4 },
  { code: 'SEN', weight: 4 },
  { code: 'SCO', weight: 4 },
  { code: 'ARG', weight: 3 },
  { code: 'DEN', weight: 3 },
];

const PERSONALITY_WEIGHTS: Array<{ p: Personality; weight: number }> = [
  { p: 'Professional', weight: 25 },
  { p: 'Ambitious', weight: 20 },
  { p: 'Leader', weight: 10 },
  { p: 'Relaxed', weight: 20 },
  { p: 'Temperamental', weight: 15 },
  { p: 'Loyal', weight: 10 },
];

const SECONDARY_NEIGHBOURS: Partial<Record<Position, Position[]>> = {
  CB: ['DM'],
  DM: ['CB', 'CM'],
  CM: ['DM', 'AM'],
  AM: ['CM', 'ST'],
  LB: ['LWB'],
  LWB: ['LB', 'LM'],
  LM: ['LWB', 'LW'],
  LW: ['LM', 'ST'],
  RB: ['RWB'],
  RWB: ['RB', 'RM'],
  RM: ['RWB', 'RW'],
  RW: ['RM', 'ST'],
  ST: ['AM', 'LW', 'RW'],
};

const FAMOUS_SET = new Set(FAMOUS_PLAYERS_AND_MANAGERS.map((s) => s.toLowerCase()));
const FAMOUS_SURNAME_SET = new Set(FAMOUS_SURNAMES.map((s) => s.toLowerCase()));

function rollNationality(rng: Rng): NationCode {
  return rng.weighted(NATION_WEIGHTS, (n) => n.weight).code;
}

function rollPersonality(rng: Rng): Personality {
  return rng.weighted(PERSONALITY_WEIGHTS, (p) => p.weight).p;
}

function rollFoot(pos: Position, rng: Rng): Foot {
  if (pos === 'LB' || pos === 'LWB' || pos === 'LM' || pos === 'LW') {
    return rng.chance(0.7) ? 'Left' : 'Right';
  }
  if (pos === 'RB' || pos === 'RWB' || pos === 'RM' || pos === 'RW') {
    return rng.chance(0.85) ? 'Right' : 'Left';
  }
  const roll = rng.next();
  if (roll < 0.8) return 'Right';
  if (roll < 0.92) return 'Left';
  return 'Both';
}

function rollHeight(pos: Position, rng: Rng): number {
  if (pos === 'GK') return rng.int(186, 198);
  if (pos === 'CB') return rng.int(183, 196);
  if (pos === 'ST') return rng.int(175, 193);
  return rng.int(168, 188);
}

function rollName(
  nat: NationCode,
  usedFullNames: Set<string>,
  rng: Rng,
): { firstName: string; lastName: string; knownAs?: string } {
  const pool = NATION_NAMES[nat];
  for (let attempt = 0; attempt < 500; attempt++) {
    const firstName = rng.pick(pool.firstNames);
    const lastName = rng.pick(pool.lastNames);
    const fullName = `${firstName} ${lastName}`.toLowerCase();
    const lLower = lastName.toLowerCase();

    // Blocklist checks (SPEC §9.6)
    if (FAMOUS_SET.has(fullName) || FAMOUS_SURNAME_SET.has(lLower)) {
      continue;
    }

    if (!usedFullNames.has(fullName)) {
      usedFullNames.add(fullName);

      let knownAs: string | undefined;
      if (nat === 'BRA' && rng.chance(0.15)) {
        knownAs = firstName;
      } else if (nat === 'POR' && rng.chance(0.1)) {
        knownAs = firstName;
      }

      return { firstName, lastName, knownAs };
    }
  }
  // Fallback unique suffix if collision
  const f = rng.pick(pool.firstNames);
  const l = `${rng.pick(pool.lastNames)}-${rng.int(10, 99)}`;
  usedFullNames.add(`${f} ${l}`.toLowerCase());
  return { firstName: f, lastName: l };
}

function generateAttributes(pos: Position, targetOvr: number, rng: Rng): Attributes {
  const weights = getPositionWeights(pos);
  const attrs: Partial<Record<AttributeKey, number>> = {};
  const allKeys: AttributeKey[] = [
    'finishing',
    'longShots',
    'passing',
    'crossing',
    'firstTouch',
    'dribbling',
    'tackling',
    'heading',
    'setPieces',
    'pace',
    'stamina',
    'strength',
    'offTheBall',
    'positioning',
    'decisions',
    'composure',
    'workRate',
    'reflexes',
    'handling',
    'oneOnOnes',
    'aerialCommand',
  ];

  // 1. Raw attribute roll (SPEC §9.4)
  for (const a of allKeys) {
    const w = weights[a] || 0;
    let raw: number;
    if (w > 0) {
      raw = targetOvr + 2 + 30 * w + rng.normal(0, 4);
    } else if (['reflexes', 'handling', 'oneOnOnes', 'aerialCommand'].includes(a) && pos !== 'GK') {
      raw = rng.int(1, 15);
    } else if (
      pos === 'GK' &&
      [
        'finishing',
        'longShots',
        'crossing',
        'dribbling',
        'tackling',
        'heading',
        'setPieces',
        'pace',
        'offTheBall',
      ].includes(a)
    ) {
      raw = rng.int(8, 35);
    } else {
      raw = targetOvr - 10 + rng.normal(0, 6);
    }
    attrs[a] = Math.max(1, Math.min(99, Math.round(raw)));
  }

  const result = attrs as Attributes;

  // 3. Calibration loop to match target OVR
  for (let iter = 0; iter < 3; iter++) {
    const currentOvr = rawOvr(result, pos);
    const d = targetOvr - currentOvr;
    if (Math.abs(d) <= 1) break;

    for (const [key, w] of Object.entries(weights) as [AttributeKey, number][]) {
      if (w > 0) {
        result[key] = Math.max(1, Math.min(99, result[key] + d));
      }
    }
  }

  // 4. Personal flavour: signature attribute & weakness
  const weightedKeys = (Object.keys(weights) as AttributeKey[]).filter(
    (k) => (weights[k] || 0) > 0,
  );
  if (weightedKeys.length >= 2) {
    const sigKey = rng.pick(weightedKeys);
    let weakKey = rng.pick(weightedKeys);
    while (weakKey === sigKey) {
      weakKey = rng.pick(weightedKeys);
    }
    result[sigKey] = Math.min(99, result[sigKey] + rng.int(4, 9));
    result[weakKey] = Math.max(1, result[weakKey] - rng.int(4, 9));
  }

  return result;
}

export function generateWorld(seed: number = WORLD_SEED): WorldSnapshot {
  const rng = createRng(seed);
  const usedFullNames = new Set<string>();

  // Add AI manager names to used names
  for (const c of CLUBS_DATA) {
    usedFullNames.add(c.managerName.toLowerCase());
  }

  const players: Record<PlayerId, Player> = {};
  const clubs: Record<ClubId, Club> = {};
  const freeAgents: PlayerId[] = [];
  let playerSeq = 1;

  // 1. Generate 24 players for each club (SPEC §9.3)
  for (const cData of CLUBS_DATA) {
    const clubMean =
      cData.reputation === 5 ? 74 : cData.reputation === 4 ? 70 : cData.reputation === 3 ? 66 : 62;

    const squadPlayerDefs: Array<{
      pos: Position;
      secondaries: Array<{ pos: Position; familiarity: number }>;
      isBestXi: boolean;
      isProspect: boolean;
    }> = [
      // 3 GKs (1 best XI, 1 squad, 1 prospect)
      { pos: 'GK', secondaries: [], isBestXi: true, isProspect: false },
      { pos: 'GK', secondaries: [], isBestXi: false, isProspect: false },
      { pos: 'GK', secondaries: [], isBestXi: false, isProspect: true },
      // 5 CBs (2 best XI, 2 squad, 1 prospect)
      { pos: 'CB', secondaries: [], isBestXi: true, isProspect: false },
      { pos: 'CB', secondaries: [], isBestXi: true, isProspect: false },
      { pos: 'CB', secondaries: [], isBestXi: false, isProspect: false },
      { pos: 'CB', secondaries: [], isBestXi: false, isProspect: false },
      { pos: 'CB', secondaries: [], isBestXi: false, isProspect: true },
      // 1 LB (LWB)
      {
        pos: 'LB',
        secondaries: [{ pos: 'LWB', familiarity: 85 }],
        isBestXi: true,
        isProspect: false,
      },
      // 1 RB (RWB)
      {
        pos: 'RB',
        secondaries: [{ pos: 'RWB', familiarity: 85 }],
        isBestXi: true,
        isProspect: false,
      },
      // 1 Full back (primary LB, secondary RB)
      {
        pos: 'LB',
        secondaries: [{ pos: 'RB', familiarity: 82 }],
        isBestXi: false,
        isProspect: false,
      },
      // 2 DMs
      { pos: 'DM', secondaries: [], isBestXi: true, isProspect: false },
      { pos: 'DM', secondaries: [], isBestXi: false, isProspect: false },
      // 3 CMs
      { pos: 'CM', secondaries: [], isBestXi: true, isProspect: false },
      { pos: 'CM', secondaries: [], isBestXi: true, isProspect: false },
      { pos: 'CM', secondaries: [], isBestXi: false, isProspect: true },
      // 1 AM
      { pos: 'AM', secondaries: [], isBestXi: true, isProspect: false },
      // 1 LM (LW)
      {
        pos: 'LM',
        secondaries: [{ pos: 'LW', familiarity: 84 }],
        isBestXi: true,
        isProspect: false,
      },
      // 1 RM (RW)
      {
        pos: 'RM',
        secondaries: [{ pos: 'RW', familiarity: 84 }],
        isBestXi: true,
        isProspect: false,
      },
      // 1 LW
      { pos: 'LW', secondaries: [], isBestXi: false, isProspect: false },
      // 1 RW
      { pos: 'RW', secondaries: [], isBestXi: false, isProspect: false },
      // 3 STs
      { pos: 'ST', secondaries: [], isBestXi: true, isProspect: false },
      { pos: 'ST', secondaries: [], isBestXi: false, isProspect: false },
      { pos: 'ST', secondaries: [], isBestXi: false, isProspect: true },
    ];

    // Pick 2 outfield best-XI players as key players (+6 OVR) (SPEC §9.4)
    const outfieldBestXiIndices = [1, 2, 8, 9, 11, 13, 14, 16, 17, 18, 21];
    const keyPlayer1Idx = rng.pick(outfieldBestXiIndices);
    let keyPlayer2Idx = rng.pick(outfieldBestXiIndices);
    while (keyPlayer2Idx === keyPlayer1Idx) {
      keyPlayer2Idx = rng.pick(outfieldBestXiIndices);
    }

    const clubPlayerIds: PlayerId[] = [];
    const clubPlayers: Player[] = [];

    for (let i = 0; i < squadPlayerDefs.length; i++) {
      const def = squadPlayerDefs[i]!;
      const pid: PlayerId = makePlayerId(playerSeq++);
      clubPlayerIds.push(pid);

      // Target OVR (SPEC §9.4)
      let targetOvr: number;
      let age: number;

      if (def.isProspect) {
        targetOvr = clubMean + rng.normal(-9, 3);
        age = rng.int(17, 20);
      } else if (def.isBestXi) {
        let bonus = rng.normal(2, 3);
        if (i === keyPlayer1Idx || i === keyPlayer2Idx) {
          bonus += 6;
        }
        targetOvr = clubMean + bonus;
        // Age distribution (SPEC §9.4)
        const aRoll = rng.next();
        if (aRoll < 0.3) age = rng.int(22, 24);
        else if (aRoll < 0.7) age = rng.int(25, 28);
        else if (aRoll < 0.92) age = rng.int(29, 31);
        else age = rng.int(32, 33);
      } else {
        targetOvr = clubMean + rng.normal(-3, 3);
        const aRoll = rng.next();
        if (aRoll < 0.3) age = rng.int(22, 24);
        else if (aRoll < 0.7) age = rng.int(25, 28);
        else if (aRoll < 0.92) age = rng.int(29, 31);
        else age = rng.int(32, 33);
      }

      targetOvr = Math.max(45, Math.min(90, Math.round(targetOvr)));

      const nat = rollNationality(rng);
      const { firstName, lastName, knownAs } = rollName(nat, usedFullNames, rng);
      const personality = rollPersonality(rng);
      const foot = rollFoot(def.pos, rng);
      const heightCm = rollHeight(def.pos, rng);

      const attributes = generateAttributes(def.pos, targetOvr, rng);
      const ovr = rawOvr(attributes, def.pos);

      // Headroom & Potential (SPEC §9.4)
      let headroom = 0;
      if (age <= 20) headroom = rng.int(8, 22);
      else if (age <= 23) headroom = rng.int(4, 14);
      else if (age <= 27) headroom = rng.int(0, 8);
      else if (age <= 30) headroom = rng.int(0, 3);
      const potential = Math.min(95, ovr + headroom);

      // Natural neighbour secondary position chance (SPEC §9.4)
      const positionsList: Array<{ pos: Position; familiarity: number }> = [
        { pos: def.pos, familiarity: 100 },
        ...def.secondaries,
      ];
      if (rng.chance(0.35)) {
        const neighbours = SECONDARY_NEIGHBOURS[def.pos];
        if (neighbours && neighbours.length > 0) {
          const nPos = rng.pick(neighbours);
          if (!positionsList.some((p) => p.pos === nPos)) {
            positionsList.push({ pos: nPos, familiarity: rng.int(78, 92) });
          }
        }
      }

      // Contract yearsLeft
      const yRoll = rng.next();
      let yearsLeft: 1 | 2 | 3 | 4 = 2;
      if (yRoll < 0.2) yearsLeft = 1;
      else if (yRoll < 0.55) yearsLeft = 2;
      else if (yRoll < 0.85) yearsLeft = 3;
      else yearsLeft = 4;

      const player: Player = {
        id: pid,
        firstName,
        lastName,
        knownAs,
        nationality: nat,
        age,
        heightCm,
        foot,
        positions: positionsList,
        attributes,
        potential,
        personality,
        clubId: cData.id,
        squadNumber: null, // assigned below
        contract: {
          wagePerWeek: 0, // computed below after squad ranking
          yearsLeft,
          role: def.isProspect ? 'Prospect' : 'Starter',
        },
        condition: rng.int(95, 100),
        fatigue: rng.int(0, 10),
        morale: rng.int(55, 70),
        injury: null,
        suspendedMatches: 0,
        yellowAccumulation: 0,
        form: [7.0, 7.0, 7.0],
        stats: {
          apps: 0,
          starts: 0,
          minutes: 0,
          goals: 0,
          assists: 0,
          yellow: 0,
          red: 0,
          ratingSum: 0,
          ratedApps: 0,
          motm: 0,
          cleanSheets: 0,
          shots: 0,
          shotsOnTarget: 0,
          keyPasses: 0,
          tacklesWon: 0,
          interceptions: 0,
          saves: 0,
          goalsConceded: 0,
        },
        transferListed: false,
        notForSale: false,
        scoutedBy: [cData.id],
        growth: 0,
        history: [{ matchday: 0, event: `Joined ${cData.name}` }],
      };

      clubPlayers.push(player);
    }

    // Rank players within club by primary OVR to assign SquadRole & SquadNumber (SPEC §9.3 & §9.4)
    clubPlayers.sort((a, b) => getPrimaryOvr(b) - getPrimaryOvr(a));

    for (let rank = 0; rank < clubPlayers.length; rank++) {
      const p = clubPlayers[rank]!;
      let role: SquadRole;
      if (p.age <= 20 && p.contract?.role === 'Prospect') {
        role = 'Prospect';
      } else if (rank < 2) {
        role = 'Star';
      } else if (rank < 11) {
        role = 'Starter';
      } else if (rank < 17) {
        role = 'Rotation';
      } else {
        role = 'Backup';
      }

      const val = valueOf(p);
      const wage = wageFor(val);
      p.contract = {
        wagePerWeek: wage,
        yearsLeft: p.contract?.yearsLeft || 2,
        role,
      };
    }

    // Squad numbers assignment (SPEC §9.3)
    const assignedNumbers = new Set<number>();
    const assignSpecificRoleNumber = (pos: Position, num: number, skipFirst = 0) => {
      let count = 0;
      for (const p of clubPlayers) {
        if (p.positions[0]?.pos === pos && p.squadNumber === null) {
          if (count === skipFirst) {
            p.squadNumber = num;
            assignedNumbers.add(num);
            break;
          }
          count++;
        }
      }
    };

    assignSpecificRoleNumber('GK', 1);
    assignSpecificRoleNumber('RB', 2);
    assignSpecificRoleNumber('LB', 3);
    assignSpecificRoleNumber('CB', 4);
    assignSpecificRoleNumber('CB', 5, 1);
    assignSpecificRoleNumber('DM', 6);
    assignSpecificRoleNumber('RW', 7);
    assignSpecificRoleNumber('CM', 8);
    assignSpecificRoleNumber('ST', 9);
    assignSpecificRoleNumber('AM', 10);
    assignSpecificRoleNumber('LW', 11);

    // Remaining players get lowest unused numbers from 12..35
    let nextNum = 12;
    for (const p of clubPlayers) {
      if (p.squadNumber === null) {
        while (assignedNumbers.has(nextNum)) {
          nextNum++;
        }
        p.squadNumber = nextNum;
        assignedNumbers.add(nextNum);
      }
    }

    // Save players to master table
    for (const p of clubPlayers) {
      players[p.id] = p;
    }

    // Weekly wage budget = 108% of weekly wage bill, rounded up to 10,000 (SPEC §9.2)
    const totalWeeklyWage = clubPlayers.reduce((sum, p) => sum + (p.contract?.wagePerWeek || 0), 0);
    const wageBudget = Math.ceil((totalWeeklyWage * 1.08) / 10000) * 10000;

    // Build initial tactics
    const styleFormation = cData.style.formation;
    const formationDef = FORMATIONS[styleFormation];
    const lineup: (PlayerId | null)[] = new Array(11).fill(null);

    // Fill best XI lineup
    const usedInLineup = new Set<PlayerId>();
    for (let slot = 0; slot < 11; slot++) {
      const slotDef = formationDef.slots[slot]!;
      // Find best available player for slot
      let bestP: Player | null = null;
      let bestOvr = -1;
      for (const p of clubPlayers) {
        if (!usedInLineup.has(p.id)) {
          const ovr = rawOvr(p.attributes, slotDef.position);
          if (ovr > bestOvr) {
            bestOvr = ovr;
            bestP = p;
          }
        }
      }
      if (bestP) {
        lineup[slot] = bestP.id;
        usedInLineup.add(bestP.id);
      }
    }

    const bench: PlayerId[] = clubPlayers
      .filter((p) => !usedInLineup.has(p.id))
      .slice(0, 9)
      .map((p) => p.id);

    const defaultRoles = formationDef.slots.map((s) => getDefaultRoleForPos(s.position));

    const initialTactics: Tactics = {
      formation: styleFormation,
      lineup,
      roles: [...defaultRoles],
      duties: new Array(11).fill('Support'),
      playerInstructions: Array.from({ length: 11 }, () => []),
      bench,
      captain: clubPlayers[0]?.id || null,
      takers: {
        penalty: clubPlayers[0]?.id || null,
        freeKick: clubPlayers[0]?.id || null,
        corner: clubPlayers[0]?.id || null,
        longThrow: null,
      },
      setPieces: createDefaultSetPieceTactics(),
      instructions: {
        mentality: cData.style.mentality,
        passing: cData.style.passing,
        tempo: cData.style.tempo,
        pressing: cData.style.pressing,
        line: cData.style.line,
        width: cData.style.width,
        focus: cData.style.focus,
        onLoss: 'Mixed',
        onWin: 'Mixed',
        distribution: 'Mixed',
        cornersFor: 'Mixed',
        cornersAgainst: 'Mixed',
        finalThird: 'Mixed',
        crossStyle: 'Mixed',
        offsideTrap: false,
        tackling: 'Mixed',
        forceOpp: 'Mixed',
        timeWasting: 'Never',
        freeKicks: 'Mixed',
        cornerSwing: 'Mixed',
        menBack: 2,
        postMen: 'None',
      },
      opposition: [],
      plans: [
        {
          name: 'Plan A',
          formation: styleFormation,
          roles: [...defaultRoles],
          playerInstructions: Array.from({ length: 11 }, () => []),
          instructions: {
            mentality: cData.style.mentality,
            passing: cData.style.passing,
            tempo: cData.style.tempo,
            pressing: cData.style.pressing,
            line: cData.style.line,
            width: cData.style.width,
            focus: cData.style.focus,
            onLoss: 'Mixed',
            onWin: 'Mixed',
            distribution: 'Mixed',
            cornersFor: 'Mixed',
            cornersAgainst: 'Mixed',
            finalThird: 'Mixed',
            crossStyle: 'Mixed',
            offsideTrap: false,
            tackling: 'Mixed',
            forceOpp: 'Mixed',
            timeWasting: 'Never',
            freeKicks: 'Mixed',
            cornerSwing: 'Mixed',
            menBack: 2,
            postMen: 'None',
          },
        },
        {
          name: 'Plan B',
          formation: styleFormation,
          roles: [...defaultRoles],
          playerInstructions: Array.from({ length: 11 }, () => []),
          instructions: {
            mentality: cData.style.mentality,
            passing: cData.style.passing,
            tempo: cData.style.tempo,
            pressing: cData.style.pressing,
            line: cData.style.line,
            width: cData.style.width,
            focus: cData.style.focus,
            onLoss: 'Mixed',
            onWin: 'Mixed',
            distribution: 'Mixed',
            cornersFor: 'Mixed',
            cornersAgainst: 'Mixed',
            finalThird: 'Mixed',
            crossStyle: 'Mixed',
            offsideTrap: false,
            tackling: 'Mixed',
            forceOpp: 'Mixed',
            timeWasting: 'Never',
            freeKicks: 'Mixed',
            cornerSwing: 'Mixed',
            menBack: 2,
            postMen: 'None',
          },
        },
        {
          name: 'Plan C',
          formation: styleFormation,
          roles: [...defaultRoles],
          playerInstructions: Array.from({ length: 11 }, () => []),
          instructions: {
            mentality: cData.style.mentality,
            passing: cData.style.passing,
            tempo: cData.style.tempo,
            pressing: cData.style.pressing,
            line: cData.style.line,
            width: cData.style.width,
            focus: cData.style.focus,
            onLoss: 'Mixed',
            onWin: 'Mixed',
            distribution: 'Mixed',
            cornersFor: 'Mixed',
            cornersAgainst: 'Mixed',
            finalThird: 'Mixed',
            crossStyle: 'Mixed',
            offsideTrap: false,
            tackling: 'Mixed',
            forceOpp: 'Mixed',
            timeWasting: 'Never',
            freeKicks: 'Mixed',
            cornerSwing: 'Mixed',
            menBack: 2,
            postMen: 'None',
          },
        },
      ],
      activePlan: 0,
    };

    const club: Club = {
      id: cData.id,
      name: cData.name,
      shortName: cData.shortName,
      code: cData.code,
      nickname: cData.nickname,
      city: cData.city,
      founded: cData.founded,
      stadium: cData.stadium,
      colors: cData.colors,
      kits: cData.kits,
      reputation: cData.reputation,
      style: {
        ...cData.style,
        onLoss: 'Mixed',
        onWin: 'Mixed',
        distribution: 'Mixed',
        cornersFor: 'Mixed',
        cornersAgainst: 'Mixed',
        finalThird: 'Mixed',
        crossStyle: 'Mixed',
        offsideTrap: false,
        tackling: 'Mixed',
        forceOpp: 'Mixed',
        timeWasting: 'Never',
        freeKicks: 'Mixed',
        cornerSwing: 'Mixed',
        menBack: 2,
        postMen: 'None',
      },
      managerName: cData.managerName,
      rivals: cData.rivals,
      balance: cData.balance,
      transferBudget: cData.transferBudget,
      wageBudget,
      expectation: cData.expectation,
      boardConfidence: 65,
      fanMood: 60,
      formationFamiliarity: getInitialFormationFamiliarity(styleFormation),
      tactics: initialTactics,
      squad: clubPlayerIds,
      trainingPlan: {
        focus: 'Balanced',
        intensity: 'Normal',
        individual: {},
        schedule: { ...BALANCED_WEEK_SCHEDULE },
        activeTemplate: 'balanced',
        playerPlans: {},
      },
      seasonStats: {
        gateIncome: 0,
        tvIncome: 0,
        sponsorIncome: 0,
        prizeMoney: 0,
        wagesPaid: 0,
        transferIn: 0,
        transferOut: 0,
        operating: 0,
      },
    };

    clubs[club.id] = club;
  }

  // 2. Generate 40 Free Agents (SPEC §9.3)
  const freeAgentPositions: Position[] = [
    'GK',
    'GK',
    'GK',
    'GK',
    'CB',
    'CB',
    'CB',
    'CB',
    'CB',
    'CB',
    'CB',
    'LB',
    'RB',
    'LB',
    'RB',
    'LB',
    'DM',
    'DM',
    'DM',
    'CM',
    'CM',
    'CM',
    'CM',
    'CM',
    'CM',
    'AM',
    'AM',
    'AM',
    'LM',
    'RM',
    'LW',
    'RW',
    'LM',
    'RM',
    'ST',
    'ST',
    'ST',
    'ST',
    'ST',
    'ST',
  ];

  for (const pos of freeAgentPositions) {
    const pid: PlayerId = makePlayerId(playerSeq++);
    freeAgents.push(pid);

    const targetOvr = rng.int(52, 68);
    const age = rng.int(21, 33);
    const nat = rollNationality(rng);
    const { firstName, lastName, knownAs } = rollName(nat, usedFullNames, rng);
    const personality = rollPersonality(rng);
    const foot = rollFoot(pos, rng);
    const heightCm = rollHeight(pos, rng);

    const attributes = generateAttributes(pos, targetOvr, rng);
    const ovr = rawOvr(attributes, pos);
    const potential = Math.min(95, ovr + (age <= 23 ? rng.int(2, 6) : 0));

    const player: Player = {
      id: pid,
      firstName,
      lastName,
      knownAs,
      nationality: nat,
      age,
      heightCm,
      foot,
      positions: [{ pos, familiarity: 100 }],
      attributes,
      potential,
      personality,
      clubId: null,
      squadNumber: null,
      contract: null,
      condition: rng.int(85, 95),
      fatigue: 0,
      morale: rng.int(45, 60),
      injury: null,
      suspendedMatches: 0,
      yellowAccumulation: 0,
      form: [],
      stats: {
        apps: 0,
        starts: 0,
        minutes: 0,
        goals: 0,
        assists: 0,
        yellow: 0,
        red: 0,
        ratingSum: 0,
        ratedApps: 0,
        motm: 0,
        cleanSheets: 0,
        shots: 0,
        shotsOnTarget: 0,
        keyPasses: 0,
        tacklesWon: 0,
        interceptions: 0,
        saves: 0,
        goalsConceded: 0,
      },
      transferListed: false,
      notForSale: false,
      scoutedBy: [],
      growth: 0,
      history: [{ matchday: 0, event: 'Free agent' }],
    };

    players[pid] = player;
  }

  // 3. Generate 90 fixtures & initial table (SPEC §10.3 & §9.1)
  const clubIds = CLUBS_DATA.map((c) => c.id);
  const fixtures = generateFixtures(clubIds);
  const rawTable = createInitialTable(clubIds);
  const table = sortTable(rawTable, fixtures, clubs);

  return {
    seed,
    clubs,
    players,
    freeAgents,
    fixtures,
    table,
  };
}
