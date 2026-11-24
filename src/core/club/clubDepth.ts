// Implements SPEC §12.17 Club Depth
// - Staff: 4 members (assistant, coach, scout, physio), hiring, severance, bonuses
// - Match preparation: SetPieces, Press, Wingers, Shape
// - Rest days: +8 condition, -6 fatigue, fit rest penalty
// - Role & Position training: position familiarity gain capped at 95, memo at 85
// - Dressing room: leaders score, weekly cohesion, morale spread
// - Injury risk: Low / Medium / High

import {
  Club,
  Player,
  PlayerId,
  ClubStaff,
  StaffMember,
  StaffRole,
  MatchPrep,
  Position,
  InboxItem,
} from '../types';
import { BALANCE } from '../../config/balance';
import { deriveSeed, createRng } from '../rng';
import { clamp, formatMoney } from '../math';

const FIRST_NAMES = [
  'Mark',
  'Paul',
  'Graham',
  'David',
  'Nigel',
  'Julian',
  'Simon',
  'Keith',
  'Alan',
  'Colin',
  'Stuart',
  'Gareth',
  'Liam',
  'Owen',
  'Declan',
  'Marcus',
  'Terry',
  'Gary',
  'Trevor',
  'Derek',
];

const LAST_NAMES = [
  'Holloway',
  'Vance',
  'Oduya',
  'Prentice',
  'Whitaker',
  'Rowley',
  'Carmichael',
  'Winter',
  'Broadbent',
  'Fairclough',
  'Gidman',
  'Thornton',
  'Caldwell',
  'Hesketh',
  'Seddon',
  'Molyneux',
  'Kirkland',
  'Blackwood',
  'Standish',
  'Ainsworth',
];

/**
 * Initializes club staff members per SPEC §12.17.1.
 * Assistant: Theo Vance (3★, fixed).
 * Coach, Scout, Physio: stars based on club reputation.
 */
export function initClubStaff(reputation: number, seed: number): ClubStaff {
  const rng = createRng(deriveSeed(seed, 'club-staff-init'));

  const baseStars = clamp(Math.round(reputation * 0.6 + 1) + rng.int(-1, 1), 1, 5) as
    | 1
    | 2
    | 3
    | 4
    | 5;

  const coachStars = clamp(baseStars + rng.int(-1, 1), 1, 5) as 1 | 2 | 3 | 4 | 5;
  const scoutStars = clamp(baseStars + rng.int(-1, 1), 1, 5) as 1 | 2 | 3 | 4 | 5;
  const physioStars = clamp(baseStars + rng.int(-1, 1), 1, 5) as 1 | 2 | 3 | 4 | 5;

  return {
    assistant: {
      id: 'staff_theo_vance',
      role: 'assistant',
      name: 'Theo Vance',
      stars: 3,
      wage: BALANCE.club.staffWage * 9, // 1,500 * 3^2 = 13,500
    },
    coach: {
      id: `staff_coach_${seed}`,
      role: 'coach',
      name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
      stars: coachStars,
      wage: BALANCE.club.staffWage * coachStars * coachStars,
    },
    scout: {
      id: `staff_scout_${seed}`,
      role: 'scout',
      name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
      stars: scoutStars,
      wage: BALANCE.club.staffWage * scoutStars * scoutStars,
    },
    physio: {
      id: `staff_physio_${seed}`,
      role: 'physio',
      name: 'Sam Oduya',
      stars: physioStars,
      wage: BALANCE.club.staffWage * physioStars * physioStars,
    },
  };
}

/**
 * Generates 3 candidate staff members for a role during a transfer window round.
 */
export function generateStaffCandidates(role: StaffRole, seed: number): StaffMember[] {
  if (role === 'assistant') return []; // Assistant not replaceable

  const rng = createRng(deriveSeed(seed, `staff-candidates-${role}`));
  const candidates: StaffMember[] = [];

  for (let i = 0; i < 3; i++) {
    // Weighted stars 1 to 5
    const roll = rng.next();
    let stars: 1 | 2 | 3 | 4 | 5 = 3;
    if (roll < 0.15) stars = 1;
    else if (roll < 0.4) stars = 2;
    else if (roll < 0.75) stars = 3;
    else if (roll < 0.92) stars = 4;
    else stars = 5;

    candidates.push({
      id: `candidate_${role}_${seed}_${i}`,
      role,
      name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
      stars,
      wage: BALANCE.club.staffWage * stars * stars,
    });
  }

  return candidates;
}

/**
 * Replaces a current staff member with a new candidate per SPEC §12.17.1.
 * Pays 4 weeks' wages compensation to departed staff member.
 */
export function replaceStaffMember(
  club: Club,
  newStaff: StaffMember,
  matchday: number,
): { club: Club; cost: number; memo: InboxItem } {
  if (newStaff.role === 'assistant') {
    throw new Error('Theo Vance cannot be replaced.');
  }

  const next = JSON.parse(JSON.stringify(club)) as Club;
  if (!next.staff) {
    next.staff = initClubStaff(next.reputation, matchday * 100);
  }

  const oldStaff = next.staff[newStaff.role];
  const compensation = oldStaff.wage * 4;

  next.balance -= compensation;
  next.staff[newStaff.role] = newStaff;
  next.staffReplacedThisRound = true;

  const roleTitle =
    newStaff.role === 'coach'
      ? 'First-Team Coach'
      : newStaff.role === 'scout'
        ? 'Head of Scouting'
        : 'Club Physio';

  const memo: InboxItem = {
    id: `staff_replacement_${newStaff.role}_${matchday}`,
    matchday,
    kind: 'Board',
    title: `Staff Appointment: ${roleTitle}`,
    body: `${newStaff.name} (${newStaff.stars}★) has been appointed as our new ${roleTitle} on ${formatMoney(newStaff.wage)}/week. Former staff member ${oldStaff.name} has departed with ${formatMoney(compensation)} in severance compensation.`,
    read: false,
    requiresAction: false,
  };

  return { club: next, cost: compensation, memo };
}

/**
 * Computes player leader score per SPEC §12.17.5.
 */
export function calculateLeaderScore(player: Player, isCaptain: boolean): number {
  const leaderBonus = player.personality === 'Leader' ? 30 : 0;
  const captainBonus = isCaptain ? 20 : 0;
  const profBonus = player.personality === 'Professional' ? 8 : 0;
  const ageScore = player.age * 0.8;
  const appsScore = Math.min(player.stats.apps, 40) * 0.5;

  return leaderBonus + captainBonus + profBonus + ageScore + appsScore;
}

/**
 * Returns top 3 dressing room leaders in a club per SPEC §12.17.5.
 */
export function getClubLeaders(club: Club, players: Record<PlayerId, Player>): Player[] {
  const squad = club.squad.map((id) => players[id]).filter(Boolean) as Player[];

  return squad
    .sort((a, b) => {
      const aScore = calculateLeaderScore(a, club.tactics.captain === a.id);
      const bScore = calculateLeaderScore(b, club.tactics.captain === b.id);
      return bScore - aScore;
    })
    .slice(0, 3);
}

/**
 * Computes weekly dressing room cohesion change clamped to [-6, +6] per SPEC §12.17.5.
 */
export function computeWeeklyCohesion(
  club: Club,
  players: Record<PlayerId, Player>,
  matchResult?: 'win' | 'loss' | 'draw',
): { newCohesion: number; delta: number; reasons: string[] } {
  const currentCohesion = club.cohesion ?? BALANCE.club.cohesionInitial;
  const leaders = getClubLeaders(club, players);

  const reasons: string[] = [];
  let totalDelta = 0;

  if (leaders.length > 0) {
    const meanLeaderMorale = leaders.reduce((sum, l) => sum + l.morale, 0) / leaders.length;
    const leaderDelta = clamp(Math.round((meanLeaderMorale - 55) / 10), -3, 3);
    if (leaderDelta !== 0) {
      totalDelta += leaderDelta;
      reasons.push(
        leaderDelta > 0
          ? `Leaders morale uplift (+${leaderDelta})`
          : `Leaders dissatisfaction (${leaderDelta})`,
      );
    }
  }

  if (matchResult === 'win') {
    totalDelta += BALANCE.club.cohesionWinBonus;
    reasons.push('Matchday victory (+1)');
  } else if (matchResult === 'loss') {
    totalDelta += BALANCE.club.cohesionLossPenalty;
    reasons.push('Matchday defeat (-1)');
  }

  const clampedDelta = clamp(
    totalDelta,
    -BALANCE.club.cohesionMaxWeeklyDelta,
    BALANCE.club.cohesionMaxWeeklyDelta,
  );
  const newCohesion = clamp(currentCohesion + clampedDelta, 0, 100);

  return { newCohesion, delta: clampedDelta, reasons };
}

/**
 * Applies weekly morale spread: non-leaders move 10% toward leaders' mean morale.
 */
export function applyMoraleSpread(
  club: Club,
  players: Record<PlayerId, Player>,
): Record<PlayerId, Player> {
  const nextPlayers = JSON.parse(JSON.stringify(players)) as Record<PlayerId, Player>;
  const leaders = getClubLeaders(club, nextPlayers);
  if (leaders.length === 0) return nextPlayers;

  const leaderIds = new Set(leaders.map((l) => l.id));
  const meanLeaderMorale = leaders.reduce((sum, l) => sum + l.morale, 0) / leaders.length;

  for (const pId of club.squad) {
    if (leaderIds.has(pId)) continue;
    const p = nextPlayers[pId];
    if (!p) continue;
    const shift = Math.round((meanLeaderMorale - p.morale) * 0.1);
    p.morale = clamp(p.morale + shift, 0, 100);
  }

  return nextPlayers;
}

/**
 * Evaluates injury risk for a player (display only per SPEC §12.17.6).
 * Thresholds: factor < 1.2 Low, < 1.6 Medium, otherwise High.
 */
export function getInjuryRisk(
  player: Player,
  physioStars = 3,
): { level: 'Low' | 'Medium' | 'High'; factor: number; reasons: string[] } {
  const condDeficit = Math.max(0, 100 - player.condition) / 50;
  const fatigueLoad = player.fatigue / 60;
  const physioMult = BALANCE.club.physioHazardBase - BALANCE.club.physioHazardPerStar * physioStars;

  const factor = (condDeficit + fatigueLoad) * physioMult;
  const reasons: string[] = [];

  if (player.age >= 30) {
    reasons.push('Age 30+ load recovery');
  }
  if (player.fatigue >= 60) {
    reasons.push('High accumulated fatigue');
  }
  if (player.condition < 75) {
    reasons.push('Match conditioning deficit');
  }
  if ((player.rushedBack?.matchesLeft ?? 0) > 0) {
    reasons.push('Rushed back');
  }
  if ((player.carriedKnockWeeks ?? 0) > 0) {
    reasons.push('Carried a knock');
  }

  let level: 'Low' | 'Medium' | 'High' = 'Low';
  if (factor >= BALANCE.club.injuryRiskMedThreshold) {
    level = 'High';
  } else if (factor >= BALANCE.club.injuryRiskLowThreshold) {
    level = 'Medium';
  }

  return { level, factor, reasons };
}

/**
 * Applies rest day effects per SPEC §12.17.3:
 * Rested: condition +8, fatigue -6.
 * If fit (condition >= 90) rested 3 weeks running -> morale -5 ("Wants to train").
 */
export function applyRestDays(
  club: Club,
  players: Record<PlayerId, Player>,
  matchday: number,
): { players: Record<PlayerId, Player>; memos: InboxItem[] } {
  const nextPlayers = JSON.parse(JSON.stringify(players)) as Record<PlayerId, Player>;
  const memos: InboxItem[] = [];

  for (const pId of club.squad) {
    const p = nextPlayers[pId];
    if (!p) continue;

    if (p.rest) {
      p.condition = clamp(p.condition + BALANCE.club.restConditionGain, 0, 100);
      p.fatigue = clamp(p.fatigue - BALANCE.club.restFatigueReduction, 0, 100);

      if (p.condition >= 90) {
        p.consecutiveRestWeeks = (p.consecutiveRestWeeks ?? 0) + 1;
        if (p.consecutiveRestWeeks >= 3) {
          p.morale = clamp(p.morale + BALANCE.club.restConsecutiveWeeksMoralePenalty, 0, 100);
          const pName = p.knownAs ?? `${p.firstName} ${p.lastName}`;
          memos.push({
            id: `rest_dissatisfaction_${p.id}_${matchday}`,
            matchday,
            kind: 'Player',
            title: `Player Discontent: Wants to train (${pName})`,
            body: `${pName} is fully fit but has been given rest days for three consecutive weeks ("Wants to train"). He has expressed frustration at missing regular training sessions.`,
            read: false,
            requiresAction: false,
          });
        }
      } else {
        p.consecutiveRestWeeks = 0;
      }
    } else {
      p.consecutiveRestWeeks = 0;
    }
  }

  return { players: nextPlayers, memos };
}

/**
 * Applies position training progress per SPEC §12.17.4:
 * Increases familiarity by rate, capped at 95. Sends memo when reaches 85.
 */
export function applyPositionTraining(
  player: Player,
  targetPos: Position,
  coachStars = 3,
  playedThere = false,
): { player: Player; reachedThreshold: boolean } {
  const next = JSON.parse(JSON.stringify(player)) as Player;
  let posEntry = next.positions.find((p) => p.pos === targetPos);

  if (!posEntry) {
    // Unlisted position starting familiarity per §9.5
    const primPos = next.positions[0]?.pos ?? 'CM';
    const isSameGroup =
      (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(primPos) &&
        ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(targetPos)) ||
      (['DM', 'CM', 'AM', 'LM', 'RM'].includes(primPos) &&
        ['DM', 'CM', 'AM', 'LM', 'RM'].includes(targetPos)) ||
      (['CF', 'ST', 'LW', 'RW'].includes(primPos) && ['CF', 'ST', 'LW', 'RW'].includes(targetPos));

    const initialFam = isSameGroup ? 80 : 65;
    posEntry = { pos: targetPos, familiarity: initialFam };
    next.positions.push(posEntry);
  }

  const oldFam = posEntry.familiarity;
  const ageBonus = player.age <= 23 ? 2 : player.age >= 30 ? -1 : 0;
  const decBonus = player.attributes.decisions >= 70 ? 1 : 0;
  const coachMult = BALANCE.club.coachDevBase + BALANCE.club.coachDevPerStar * coachStars;
  const playedBonus = playedThere ? 2 : 0;

  const gain = Math.round((3 + ageBonus + decBonus) * coachMult + playedBonus);
  posEntry.familiarity = clamp(posEntry.familiarity + gain, 0, 95);

  const reachedThreshold = oldFam < 85 && posEntry.familiarity >= 85;

  return { player: next, reachedThreshold };
}

/**
 * Returns match preparation description and mechanical bonuses per SPEC §12.17.2.
 */
export function getMatchPrepEffects(prep: MatchPrep): {
  opponentSetPieceDuelMod: number;
  passVsPressMod: number;
  opponentWingerMod: number;
  shapeFamiliarityBonus: number;
  effectDescription: string;
  costDescription: string;
} {
  switch (prep) {
    case 'SetPieces':
      return {
        opponentSetPieceDuelMod: -0.12,
        passVsPressMod: 0,
        opponentWingerMod: 0,
        shapeFamiliarityBonus: 0,
        effectDescription: 'Opponent corner and free-kick header duel success reduced by -0.12.',
        costDescription: 'Weekly focus bonus halved and development reduced by -15%.',
      };
    case 'Press':
      return {
        opponentSetPieceDuelMod: 0,
        passVsPressMod: 0.15,
        opponentWingerMod: 0,
        shapeFamiliarityBonus: 0,
        effectDescription:
          'Our defensive and midfield passing context boosted by +0.15 against High/Mid press.',
        costDescription: 'Weekly focus bonus halved and development reduced by -15%.',
      };
    case 'Wingers':
      return {
        opponentSetPieceDuelMod: 0,
        passVsPressMod: 0,
        opponentWingerMod: -0.12,
        shapeFamiliarityBonus: 0,
        effectDescription:
          "Opposition wide players' dribble and crossing delivery success reduced by -0.12.",
        costDescription: 'Weekly focus bonus halved and development reduced by -15%.',
      };
    case 'Shape':
      return {
        opponentSetPieceDuelMod: 0,
        passVsPressMod: 0,
        opponentWingerMod: 0,
        shapeFamiliarityBonus: 8,
        effectDescription:
          '+8 tactical familiarity bonus for our active formation plan this match.',
        costDescription: 'Weekly focus bonus halved and development reduced by -15%.',
      };
    default:
      return {
        opponentSetPieceDuelMod: 0,
        passVsPressMod: 0,
        opponentWingerMod: 0,
        shapeFamiliarityBonus: 0,
        effectDescription: 'Standard tactical routine without specialized opponent focus.',
        costDescription: 'Full development rate and full training focus bonus.',
      };
  }
}
