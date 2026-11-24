// Implements SPEC §12.20 Discipline Decisions & Consistency Rules
import {
  Player,
  PlayerId,
  Club,
  GameState,
  DisciplineIncident,
  DisciplineIncidentType,
  RecentPunishment,
  InboxItem,
  NewsItem,
} from '../types';
import { Rng } from '../rng';
import { BALANCE } from '../../config/balance';
import { clamp, formatMoney } from '../math';
import { getClubLeaders } from '../club/clubDepth';

export type DisciplineChoice =
  | 'fine'
  | 'drop'
  | 'warn'
  | 'let_go'
  | 'answer_public'
  | 'talk_private'
  | 'side_senior'
  | 'team_meeting';

export interface IncidentResolutionResult {
  nextGameState: GameState;
  memo?: InboxItem;
  news?: NewsItem;
  consistencyViolation: boolean;
}

/**
 * Checks for a weekly discipline incident per SPEC §12.20.1
 * At most one incident per week. Priority: sent_off > bust_up > press_mouth > late_training
 */
export function checkForWeeklyDisciplineIncident(
  gameState: GameState,
  rng: Rng,
  sentOffPlayerIds: PlayerId[] = [],
): DisciplineIncident | null {
  const userClub = gameState.clubs[gameState.userClubId];
  if (!userClub) return null;

  const squadPlayers = userClub.squad
    .map((id) => gameState.players[id])
    .filter((p): p is Player => p != null);

  // 1. Sent off (always triggers, one per red card)
  if (sentOffPlayerIds.length > 0) {
    const pId = sentOffPlayerIds[0]!;
    const p = gameState.players[pId];
    return {
      id: `incident_sent_off_${pId}_md${gameState.matchday}`,
      matchday: gameState.matchday,
      type: 'sent_off',
      playerIds: [pId],
      title: 'Disciplinary: Red Card',
      description: `${p ? p.lastName : 'Player'} was sent off in the match. Disciplinary action is required to maintain standards.`,
      resolved: false,
    };
  }

  // 2. Training-ground bust-up (cohesion < 45, 10% chance, 2 players with at least one Temperamental)
  if (userClub.cohesion < BALANCE.disciplineDecisions.bustUpCohesionThreshold) {
    if (rng.chance(BALANCE.disciplineDecisions.bustUpChance)) {
      const temperamental = squadPlayers.filter((p) => p.personality === 'Temperamental');
      if (temperamental.length > 0 && squadPlayers.length >= 2) {
        const p1 = rng.pick(temperamental)!;
        const otherPlayers = squadPlayers.filter((p) => p.id !== p1.id);
        const p2 = rng.pick(otherPlayers)!;
        return {
          id: `incident_bust_up_${p1.id}_${p2.id}_md${gameState.matchday}`,
          matchday: gameState.matchday,
          type: 'bust_up',
          playerIds: [p1.id, p2.id],
          title: 'Training-Ground Altercation',
          description: `${p1.lastName} and ${p2.lastName} were involved in a heated bust-up during morning drills. Staff had to step in.`,
          resolved: false,
        };
      }
    }
  }

  // 3. Mouthing off in the press (morale < 30 and broken promise or unhappy, 30% chance)
  const unhappyPlayers = squadPlayers.filter(
    (p) => p.morale < 30 && (p.promise != null || p.transferListed || p.morale < 25),
  );
  if (unhappyPlayers.length > 0) {
    if (rng.chance(BALANCE.disciplineDecisions.pressMouthChance)) {
      const p = rng.pick(unhappyPlayers)!;
      return {
        id: `incident_press_${p.id}_md${gameState.matchday}`,
        matchday: gameState.matchday,
        type: 'press_mouth',
        playerIds: [p.id],
        title: 'Player Outburst in Media',
        description: `${p.firstName} ${p.lastName} spoke to local press about frustration with squad role and leadership.`,
        headline: `${p.lastName} criticises manager in bombshell interview`,
        resolved: false,
      };
    }
  }

  // 4. Late for training (per player chance)
  for (const p of squadPlayers) {
    let chance = BALANCE.disciplineDecisions.lateBaseChance;
    if (p.personality === 'Relaxed') {
      chance *= BALANCE.disciplineDecisions.latePersonalityMult.Relaxed ?? 2.0;
    } else if (p.personality === 'Professional') {
      chance *= BALANCE.disciplineDecisions.latePersonalityMult.Professional ?? 0.2;
    }
    if (p.morale < BALANCE.disciplineDecisions.lateLowMoraleThreshold) {
      chance *= BALANCE.disciplineDecisions.lateLowMoraleMult;
    }
    if (p.extraSessions) {
      chance *= BALANCE.disciplineDecisions.lateExtraSessionsMult;
    }

    // Apply active multiplier if player had a previous warning or let-go
    const activeMult = p.offenceMultipliers?.find((m) => m.incident === 'late_training');
    if (activeMult && activeMult.weeksLeft > 0) {
      chance *= activeMult.multiplier;
    }

    if (rng.chance(chance)) {
      return {
        id: `incident_late_${p.id}_md${gameState.matchday}`,
        matchday: gameState.matchday,
        type: 'late_training',
        playerIds: [p.id],
        title: 'Late for Training',
        description: `${p.firstName} ${p.lastName} arrived 45 minutes late for training today without giving notice to staff.`,
        resolved: false,
      };
    }
  }

  return null;
}

/**
 * Resolves a discipline incident choice per SPEC §12.20.2
 */
export function resolveDisciplineIncident(
  gameState: GameState,
  incident: DisciplineIncident,
  choice: DisciplineChoice,
  rng: Rng,
): IncidentResolutionResult {
  const nextState: GameState = JSON.parse(JSON.stringify(gameState));
  const userClub = nextState.clubs[nextState.userClubId];
  if (!userClub) {
    return { nextGameState: gameState, consistencyViolation: false };
  }

  const p1 = incident.playerIds[0] ? nextState.players[incident.playerIds[0]] : null;
  const p2 = incident.playerIds[1] ? nextState.players[incident.playerIds[1]] : null;

  const leaders = getClubLeaders(userClub, nextState.players);
  let punishmentLevel = 1;
  let fineAmount = 0;

  const getPersonalityMoraleMultiplier = (p: Player) => {
    if (p.personality === 'Professional')
      return BALANCE.disciplineDecisions.personalityMoraleMult.Professional ?? 0.5;
    if (p.personality === 'Temperamental')
      return BALANCE.disciplineDecisions.personalityMoraleMult.Temperamental ?? 1.5;
    if (leaders.some((l) => l.id === p.id))
      return BALANCE.disciplineDecisions.personalityMoraleMult.Leader ?? 0.8;
    return 1.0;
  };

  switch (choice) {
    case 'fine': {
      punishmentLevel = 3;
      if (p1) {
        // Check for repeat fine within 8 weeks
        const recentFine = userClub.recentPunishments?.find(
          (rp) =>
            rp.playerId === p1.id &&
            rp.punishmentLevel === 3 &&
            gameState.matchday - rp.matchday <= BALANCE.disciplineDecisions.repeatFineWeeks,
        );
        const weeksWage = recentFine ? 2 : 1;
        fineAmount = (p1.contract?.wagePerWeek ?? 15000) * weeksWage;
        userClub.balance += fineAmount;

        const moraleLoss = Math.round(8 * getPersonalityMoraleMultiplier(p1));
        p1.morale = Math.max(0, p1.morale - moraleLoss);

        // Cohesion +2 for clear offences (late, sent off, bust up)
        if (['late_training', 'sent_off', 'bust_up'].includes(incident.type)) {
          userClub.cohesion = clamp(userClub.cohesion + 2, 0, 100);
        }

        // Temperamental repeat fine transfer demand (30%)
        if (
          recentFine &&
          p1.personality === 'Temperamental' &&
          rng.chance(BALANCE.disciplineDecisions.temperamentalTransferDemandChance)
        ) {
          p1.transferListed = true;
        }

        // Add to player discipline record
        if (!p1.disciplineRecord) p1.disciplineRecord = [];
        p1.disciplineRecord.push({
          matchday: gameState.matchday,
          incident: incident.title,
          punishment: `Fined ${weeksWage} week${weeksWage > 1 ? 's' : ''} wages (${formatMoney(fineAmount)})`,
        });
      }
      break;
    }

    case 'drop': {
      punishmentLevel = 3;
      if (p1) {
        const moraleLoss = Math.round(6 * getPersonalityMoraleMultiplier(p1));
        p1.morale = Math.max(0, p1.morale - moraleLoss);
        p1.suspendedMatches = Math.max(p1.suspendedMatches ?? 0, 1);
        userClub.cohesion = clamp(userClub.cohesion + 1, 0, 100);

        if (!p1.disciplineRecord) p1.disciplineRecord = [];
        p1.disciplineRecord.push({
          matchday: gameState.matchday,
          incident: incident.title,
          punishment: 'Dropped for next match',
        });
      }
      break;
    }

    case 'warn': {
      punishmentLevel = 2;
      if (p1) {
        const moraleLoss = Math.round(2 * getPersonalityMoraleMultiplier(p1));
        p1.morale = Math.max(0, p1.morale - moraleLoss);

        if (!p1.offenceMultipliers) p1.offenceMultipliers = [];
        p1.offenceMultipliers.push({
          incident: incident.type,
          multiplier: BALANCE.disciplineDecisions.repeatOffenceMultiplier.warn ?? 1.5,
          weeksLeft: BALANCE.disciplineDecisions.repeatOffenceDurationWeeks ?? 4,
        });

        if (!p1.disciplineRecord) p1.disciplineRecord = [];
        p1.disciplineRecord.push({
          matchday: gameState.matchday,
          incident: incident.title,
          punishment: 'Official Warning',
        });
      }
      break;
    }

    case 'let_go': {
      punishmentLevel = 1;
      if (p1) {
        // Leaders morale -3, cohesion -2
        for (const l of leaders) {
          const leaderP = nextState.players[l.id];
          if (leaderP) leaderP.morale = Math.max(0, leaderP.morale - 3);
        }
        userClub.cohesion = clamp(userClub.cohesion - 2, 0, 100);

        if (!p1.offenceMultipliers) p1.offenceMultipliers = [];
        p1.offenceMultipliers.push({
          incident: incident.type,
          multiplier: BALANCE.disciplineDecisions.repeatOffenceMultiplier.let_go ?? 2.0,
          weeksLeft: BALANCE.disciplineDecisions.repeatOffenceDurationWeeks ?? 4,
        });

        if (!p1.disciplineRecord) p1.disciplineRecord = [];
        p1.disciplineRecord.push({
          matchday: gameState.matchday,
          incident: incident.title,
          punishment: 'Informal reprimand (Let go)',
        });
      }
      break;
    }

    case 'answer_public': {
      punishmentLevel = 3;
      if (p1) {
        const moraleLoss = Math.round(10 * getPersonalityMoraleMultiplier(p1));
        p1.morale = Math.max(0, p1.morale - moraleLoss);
        if (rng.chance(0.4)) {
          p1.transferListed = true;
        }
        userClub.fanMood = clamp(userClub.fanMood + 2, 0, 100);

        if (!p1.disciplineRecord) p1.disciplineRecord = [];
        p1.disciplineRecord.push({
          matchday: gameState.matchday,
          incident: incident.title,
          punishment: 'Public Rebuke in Media',
        });
      }
      break;
    }

    case 'talk_private': {
      punishmentLevel = 1;
      if (p1) {
        if (!p1.disciplineRecord) p1.disciplineRecord = [];
        p1.disciplineRecord.push({
          matchday: gameState.matchday,
          incident: incident.title,
          punishment: 'Private Discussion',
        });
      }
      break;
    }

    case 'side_senior': {
      punishmentLevel = 2;
      if (p1 && p2) {
        const senior = p1.age >= p2.age ? p1 : p2;
        const younger = p1.age >= p2.age ? p2 : p1;

        senior.morale = Math.min(100, senior.morale + 3);
        const yLoss = Math.round(8 * getPersonalityMoraleMultiplier(younger));
        younger.morale = Math.max(0, younger.morale - yLoss);

        if (!younger.disciplineRecord) younger.disciplineRecord = [];
        younger.disciplineRecord.push({
          matchday: gameState.matchday,
          incident: incident.title,
          punishment: 'Disciplined (Manager sided with senior player)',
        });
      }
      break;
    }

    case 'team_meeting': {
      punishmentLevel = 2;
      if (p1 && p2) {
        const f1 = Math.round((p1.contract?.wagePerWeek ?? 15000) * 0.5);
        const f2 = Math.round((p2.contract?.wagePerWeek ?? 15000) * 0.5);
        fineAmount = f1 + f2;
        userClub.balance += fineAmount;

        p1.morale = Math.max(0, p1.morale - 3);
        p2.morale = Math.max(0, p2.morale - 3);
        userClub.cohesion = clamp(userClub.cohesion + 3, 0, 100);

        if (!p1.disciplineRecord) p1.disciplineRecord = [];
        p1.disciplineRecord.push({
          matchday: gameState.matchday,
          incident: incident.title,
          punishment: `Team meeting fine (${formatMoney(f1)})`,
        });
        if (!p2.disciplineRecord) p2.disciplineRecord = [];
        p2.disciplineRecord.push({
          matchday: gameState.matchday,
          incident: incident.title,
          punishment: `Team meeting fine (${formatMoney(f2)})`,
        });
      }
      break;
    }
  }

  // Consistency Check (§12.20.2)
  // Keeps 6-week record. If two players commit same offence and get different punishment level, cohesion -4.
  if (!userClub.recentPunishments) {
    userClub.recentPunishments = [];
  }

  const primaryPlayerId = p1?.id ?? incident.playerIds[0]!;
  const newPunishment: RecentPunishment = {
    playerId: primaryPlayerId,
    incidentType: incident.type,
    punishmentLevel,
    matchday: gameState.matchday,
  };

  const consistencyViolation = userClub.recentPunishments.some(
    (rp) =>
      rp.incidentType === incident.type &&
      rp.playerId !== primaryPlayerId &&
      gameState.matchday - rp.matchday <= BALANCE.disciplineDecisions.consistencyRecordWeeks &&
      rp.punishmentLevel !== punishmentLevel,
  );

  let consistencyMemo: InboxItem | undefined = undefined;
  if (consistencyViolation) {
    userClub.cohesion = clamp(
      userClub.cohesion + BALANCE.disciplineDecisions.consistencyCohesionPenalty,
      0,
      100,
    );
    consistencyMemo = {
      id: `memo_inconsistency_md${gameState.matchday}`,
      matchday: gameState.matchday,
      kind: 'Assistant',
      title: 'Dressing room grumbles: inconsistency',
      body: "The lads think there's one rule for him and another for them. Several players have raised eyebrows at the uneven discipline.",
      read: false,
      requiresAction: false,
    };
    nextState.inbox.unshift(consistencyMemo);
  }

  userClub.recentPunishments.push(newPunishment);

  // Clear active incident
  nextState.activeIncident = null;

  // News item if fine of a star player (§12.20.2)
  let fineNews: NewsItem | undefined = undefined;
  if (
    choice === 'fine' &&
    p1 &&
    (p1.contract?.role === 'Star' || p1.contract?.role === 'Starter')
  ) {
    fineNews = {
      id: `news_fine_${p1.id}_md${gameState.matchday}`,
      matchday: gameState.matchday,
      headline: `${p1.lastName} hit with internal club fine`,
      body: `${userClub.name} manager has issued an official club fine to ${p1.firstName} ${p1.lastName} following an internal disciplinary review.`,
      clubIds: [userClub.id],
      playerIds: [p1.id],
    };
    nextState.news.unshift(fineNews);
  }

  return {
    nextGameState: nextState,
    memo: consistencyMemo,
    news: fineNews,
    consistencyViolation,
  };
}
