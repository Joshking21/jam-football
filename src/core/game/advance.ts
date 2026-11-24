// Implements SPEC §10, §12 Game Flow, Phase Transitions, and Weekly Processing
import {
  GameState,
  ClubId,
  PlayerId,
  FixtureId,
  Tactics,
  Club,
  Player,
  Fixture,
  MatchResult,
  MatchInput,
  TeamSheet,
  SeasonAwards,
  InboxItem,
  NewsItem,
  Phase,
  CornerRoutine,
} from '../types';
import { createDefaultSetPieceTactics } from '../match/setPieces';
import { sortTable } from '../season/table';
import { pickBestLineup } from '../match/aiManager';
import { simulateInstant } from '../match/engine';
import { deriveSeed, createRng } from '../rng';
import { BALANCE, K } from '@/config/balance';
import { roundTo, clamp } from '../math';
import { updateClubFamiliarity, createStartingFamiliarity } from './familiarity';
import {
  calculateWeeklyConditionRecovery,
  calculateWeeklyFatigueRecovery,
  calculateMatchFatigue,
} from '../player/condition';
import {
  checkTrainingInjury,
  calculateRushPhysioFactor,
  checkWarmupScare,
} from '../player/injuries';
import { checkForWeeklyDisciplineIncident } from '../people/incidents';
import { processPlayerDevelopment } from '../player/development';
import { processPlayerMatchCards } from '../player/discipline';
import { rawOvr } from '../player/ratings';
import {
  BALANCED_WEEK_SCHEDULE,
  calculateWeekLoad,
  calculateSharpnessBonuses,
  calculateTrainingRating,
  generateTheosWeek,
  getOverloadedPlayers,
} from '../people/training';
import {
  shouldTriggerPostMatchPress,
  shouldTriggerPreMatchPress,
  determinePressContext,
  generatePressConference,
} from './press';
import { checkConversationTriggers, evaluatePromisesAfterMatch } from '../player/conversations';
import { generateMatchNews, checkRivalRumour } from '../news/news';
import { advanceWindowRound } from '../transfers/transfers';
import {
  applyPositionTraining,
  computeWeeklyCohesion,
  applyMoraleSpread,
  initClubStaff,
} from '../club/clubDepth';
import {
  TRAIT_DEFINITIONS,
  calculateTraitTrainingProgress,
  isTraitClashing,
} from '../player/traits';

export interface LineupValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates a club's lineup per SPEC §11.8:
 * - Exactly 11 starters
 * - Exactly 1 GK at slot 0
 * - No GK in outfield slots
 * - No injured/suspended players in lineup or bench
 * - Condition >= 40 for starters
 * - No duplicate players
 */
export function validateLineup(
  tactics: Tactics,
  players: Record<PlayerId, Player>,
): LineupValidationResult {
  const { lineup, bench } = tactics;

  if (lineup.length !== 11 || lineup.some((id) => !id)) {
    return { valid: false, reason: 'You must select exactly 11 starting players.' };
  }

  const gkId = lineup[0]!;
  const gk = players[gkId];
  if (!gk || !gk.positions.some((p) => p.pos === 'GK')) {
    return { valid: false, reason: 'A goalkeeper must be selected in slot 1.' };
  }

  for (let i = 1; i < lineup.length; i++) {
    const id = lineup[i]!;
    const p = players[id];
    if (!p) return { valid: false, reason: `Invalid player at slot ${i + 1}.` };
    if (p.positions[0]?.pos === 'GK') {
      return { valid: false, reason: `${p.lastName} is a goalkeeper and cannot play outfield.` };
    }
  }

  const allSelected = [...lineup, ...bench];
  const uniqueSelected = new Set(allSelected);
  if (uniqueSelected.size !== allSelected.length) {
    return { valid: false, reason: 'Duplicate players selected in squad.' };
  }

  for (const id of allSelected) {
    if (!id) continue;
    const p = players[id];
    if (!p) continue;
    if (p.injury !== null) {
      return { valid: false, reason: `${p.lastName} is injured and cannot be selected.` };
    }
    if (p.suspendedMatches > 0) {
      return { valid: false, reason: `${p.lastName} is suspended and cannot be selected.` };
    }
  }

  for (const id of lineup) {
    if (!id) continue;
    const p = players[id];
    if (p && p.condition < BALANCE.condition.selectionMinimum) {
      return {
        valid: false,
        reason: `${p.lastName}'s condition is too low (${Math.round(p.condition)}%). Players below 40% cannot play.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Builds a MatchInput TeamSheet for a club
 */
export function buildTeamSheet(
  club: Club,
  players: Record<PlayerId, Player>,
  side: 'home' | 'away',
  focusBoost: number = 0,
): TeamSheet {
  const sheetPlayers: TeamSheet['players'] = {};

  const physioStars = club.staff?.physio.stars ?? 3;
  for (const pId of club.squad) {
    const p = players[pId];
    if (!p) continue;
    const isRushedBack = (p.rushedBack?.matchesLeft ?? 0) > 0;
    const rushPhysioFactor = isRushedBack ? calculateRushPhysioFactor(physioStars) : undefined;
    const hasWarmupScare = Boolean(p.warmupScare);
    const breakdownInjury = p.rushedBack
      ? { kind: p.rushedBack.injuryKind, matchdaysOut: p.rushedBack.originalMatchdaysOut }
      : null;

    sheetPlayers[pId] = {
      attributes: { ...p.attributes },
      positions: [...p.positions],
      condition: p.condition,
      fatigue: p.fatigue,
      morale: p.morale,
      personality: p.personality,
      name: p.knownAs ?? `${p.firstName[0]}. ${p.lastName}`,
      shirt: p.squadNumber ?? 99,
      foot: p.foot,
      traits: p.traits ?? [],
      isRushedBack,
      rushPhysioFactor,
      hasWarmupScare,
      breakdownInjury,
    };
  }

  const prep = club.prep ?? 'None';
  let familiarity = club.formationFamiliarity[club.tactics.formation] ?? 70;
  if (prep === 'Shape') {
    familiarity = Math.min(100, familiarity + BALANCE.club.prepBonusShapeFamiliarity);
  }

  const schedule = club.trainingPlan?.schedule ?? BALANCED_WEEK_SCHEDULE;
  const sharpness = calculateSharpnessBonuses(schedule, prep);
  const trainingBonus = {
    attack: sharpness.attack,
    defence: sharpness.defence,
    setPieces: sharpness.setPieces,
  };

  return {
    clubId: club.id,
    side,
    tactics: JSON.parse(JSON.stringify(club.tactics)),
    familiarity,
    areaFamiliarity: club.familiarity,
    players: sheetPlayers,
    trainingBonus,
    focusBoost,
    cohesion: club.cohesion ?? 55,
    prep,
    physioStars,
  };
}

/**
 * Applies match results of the current matchday to the GameState
 */
export function applyMatchResults(
  state: GameState,
  results: Record<FixtureId, MatchResult>,
): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const currentMatchday = next.matchday;
  next.focusBoost = 0; // Reset pre-match focus boost after match results are applied

  // Reset minutesLastMatch for all players before applying this round's minutes
  for (const p of Object.values(next.players)) {
    if (p.stats) {
      p.stats.minutesLastMatch = 0;
    }
  }

  // 1. Update fixtures
  const sentOffPlayerIds: PlayerId[] = [];
  for (const f of next.fixtures) {
    if (f.matchday !== currentMatchday) continue;
    const res = results[f.id];
    if (!res) continue;

    const homeClub = next.clubs[f.homeId]!;
    const awayClub = next.clubs[f.awayId]!;

    // Attendance calculation SPEC §12.10
    const ticketPrice = BALANCE.finances.ticketPriceByReputation[homeClub.reputation] ?? 32;
    const isDerby = homeClub.rivals.includes(awayClub.id) || awayClub.rivals.includes(homeClub.id);

    const matchRng = createRng(deriveSeed(next.seed, 'match-meta', f.id));
    const noise = (matchRng.next() - 0.5) * BALANCE.finances.attendanceNoiseRange;
    const attPct = clamp(
      BALANCE.finances.attendanceBase +
        BALANCE.finances.attendanceFanMoodFactor * (homeClub.fanMood / 100) +
        (isDerby ? BALANCE.finances.attendanceDerbyBonus : 0) +
        (awayClub.reputation === 5 ? BALANCE.finances.attendanceRep5Bonus : 0) +
        noise,
      BALANCE.finances.attendanceMin,
      BALANCE.finances.attendanceMax,
    );
    const attendance = Math.round(homeClub.stadium.capacity * attPct);

    // Gate receipts
    const gateIncome = attendance * ticketPrice;
    homeClub.balance += gateIncome;
    homeClub.seasonStats.gateIncome += gateIncome;

    // Events to goals
    const goalEvents = res.events
      .filter((e) => e.type === 'GOAL')
      .map((e) => ({
        minute: Math.floor(e.t / 60),
        playerId: (e.playerId ?? e.targetId) as PlayerId,
        side: e.side,
        minuteLabel: e.minuteLabel ?? `${Math.floor(e.t / 60)}'`,
        penalty: false,
        ownGoal: false,
      }));

    f.result = {
      homeGoals: res.homeGoals,
      awayGoals: res.awayGoals,
      scorers: goalEvents,
      attendance,
      motm: res.motm,
      stats: res.stats,
    };

    // 2. Player match stats & condition update
    for (const pl of res.players) {
      const p = next.players[pl.playerId];
      if (!p) continue;

      p.stats.apps++;
      if (pl.minutes > 0) p.stats.starts++;
      p.stats.minutes += Math.round(pl.minutes);
      p.stats.minutesLastMatch = Math.round(pl.minutes);
      p.stats.goals += pl.goals;
      p.stats.assists += pl.assists;
      p.stats.yellow += pl.yellow;
      if (pl.red > 0) p.stats.red++;
      p.stats.shots += pl.shots;
      p.stats.shotsOnTarget += pl.shotsOnTarget;
      p.stats.keyPasses += pl.keyPasses;
      p.stats.tacklesWon += pl.tackles;

      if (pl.rating > 0) {
        p.stats.ratedApps++;
        p.stats.ratingSum = roundTo(p.stats.ratingSum + pl.rating, 2);
        p.form.push(pl.rating);
        if (p.form.length > 5) p.form.shift();
      }

      if (res.motm === p.id) {
        p.stats.motm++;
        p.morale = Math.min(100, p.morale + 5);
      }

      // Condition drain & fatigue accumulated (§12.1, §12.2)
      p.condition = pl.conditionEnd;
      p.fatigue = clamp(p.fatigue + calculateMatchFatigue(pl.minutes), 0, 100);

      // Cards & Suspensions (§12.6)
      const isDirectRed = pl.red > 0 && pl.yellow === 0;
      if (pl.red > 0 && p.clubId === next.userClubId) {
        sentOffPlayerIds.push(p.id);
      }
      const cardRes = processPlayerMatchCards(p, {
        yellow: pl.yellow,
        red: pl.red,
        isDirectRed,
      });
      p.yellowAccumulation = cardRes.newYellowAccumulation;
      p.suspendedMatches = cardRes.newSuspension;

      // Match result morale adjustment
      const isHome = pl.side === 'home';
      const won = isHome ? res.homeGoals > res.awayGoals : res.awayGoals > res.homeGoals;
      const lost = isHome ? res.homeGoals < res.awayGoals : res.awayGoals < res.homeGoals;
      if (won) {
        p.morale = Math.min(100, p.morale + 4);
      } else if (lost) {
        p.morale = Math.max(1, p.morale - 4);
      }
    }

    // Injuries sustained & decisions logging (§12.19)
    for (const inj of res.injuries) {
      const p = next.players[inj.playerId];
      if (p) {
        const wasRushed = (p.rushedBack?.matchesLeft ?? 0) > 0;
        p.injury = { ...inj.injury };
        if (!p.injuryLog) p.injuryLog = [];
        p.injuryLog.push({
          kind: inj.injury.kind,
          matchdaysOut: inj.injury.matchdaysOut,
          reInjuries: wasRushed ? 1 : 0,
          rushed: wasRushed,
          matchday: currentMatchday,
        });

        if (wasRushed && p.clubId === next.userClubId) {
          const userClub = next.clubs[next.userClubId];
          if (userClub) userClub.fanMood = clamp(userClub.fanMood - 1, 0, 100);
          next.counters.inbox++;
          const pName = p.knownAs ?? `${p.firstName} ${p.lastName}`;
          next.inbox.unshift({
            id: `inbox_${next.counters.inbox}`,
            matchday: currentMatchday,
            kind: 'Medical',
            title: `Medical Setback: ${pName}`,
            body: `${pName} suffered a breakdown after being rushed back early. The setback has sidelined him for ${inj.injury.matchdaysOut} matchdays.`,
            read: false,
            requiresAction: false,
          });
          if (!next.weekDecisionsLog) next.weekDecisionsLog = [];
          next.weekDecisionsLog.push(
            `Risked ${p.lastName}: suffered breakdown (${inj.injury.matchdaysOut} weeks out)`,
          );
        }
      }
    }

    // Knocks recorded (§12.19.1)
    const knockEvents = res.events.filter((e) => e.type === 'KNOCK');
    for (const ke of knockEvents) {
      if (ke.playerId) {
        const kp = next.players[ke.playerId];
        if (kp) {
          kp.carriedKnockWeeks = 2;
          if (kp.clubId === next.userClubId) {
            if (!next.weekDecisionsLog) next.weekDecisionsLog = [];
            const decLabel = ke.knock?.decision === 'take_off' ? 'taken off' : 'played on';
            next.weekDecisionsLog.push(`${kp.lastName} carried a knock: ${decLabel}`);
          }
        }
      }
    }

    // 3. Clean sheets for GKs
    if (res.awayGoals === 0) {
      const homeGkId = homeClub.tactics.lineup[0];
      if (homeGkId && next.players[homeGkId]) next.players[homeGkId].stats.cleanSheets++;
    }
    if (res.homeGoals === 0) {
      const awayGkId = awayClub.tactics.lineup[0];
      if (awayGkId && next.players[awayGkId]) next.players[awayGkId].stats.cleanSheets++;
    }

    // 4. Fan Mood (§12.14) & Board Confidence (§12.7)
    const homeWon = res.homeGoals > res.awayGoals;
    const awayWon = res.awayGoals > res.homeGoals;
    const isDraw = res.homeGoals === res.awayGoals;
    const margin = Math.abs(res.homeGoals - res.awayGoals);

    // Fan Mood (§12.14)
    let homeFanChange = homeWon
      ? BALANCE.fans.homeWin
      : isDraw
        ? BALANCE.fans.draw
        : BALANCE.fans.loss;
    let awayFanChange = awayWon
      ? BALANCE.fans.awayWin
      : isDraw
        ? BALANCE.fans.draw
        : BALANCE.fans.loss;
    if (margin >= 3) {
      if (homeWon) {
        homeFanChange += BALANCE.fans.margin3Extra;
        awayFanChange -= BALANCE.fans.margin3Extra;
      } else if (awayWon) {
        awayFanChange += BALANCE.fans.margin3Extra;
        homeFanChange -= BALANCE.fans.margin3Extra;
      }
    }
    if (isDerby) {
      homeFanChange *= BALANCE.fans.derbyMultiplier;
      awayFanChange *= BALANCE.fans.derbyMultiplier;
    }
    homeClub.fanMood = clamp(homeClub.fanMood + homeFanChange, 0, 100);
    awayClub.fanMood = clamp(awayClub.fanMood + awayFanChange, 0, 100);

    // Board Confidence (§12.7) for participating clubs
    const updateClubBoardConfidence = (
      club: Club,
      opponent: Club,
      won: boolean,
      draw: boolean,
      lost: boolean,
    ) => {
      let confDelta = 0;
      if (won) {
        confDelta =
          opponent.reputation > club.reputation
            ? BALANCE.board.winHigherRep
            : BALANCE.board.winBase;
      } else if (draw) {
        confDelta =
          opponent.reputation > club.reputation
            ? BALANCE.board.drawHigherRep
            : opponent.reputation < club.reputation
              ? BALANCE.board.drawLowerRep
              : 0;
      } else if (lost) {
        confDelta =
          opponent.reputation < club.reputation
            ? BALANCE.board.lossLowerRep
            : BALANCE.board.lossBase;
        if (margin >= 3) confDelta += BALANCE.board.lossMargin3Extra;
      }
      club.boardConfidence = clamp(club.boardConfidence + confDelta, 0, 100);
    };

    updateClubBoardConfidence(homeClub, awayClub, homeWon, isDraw, awayWon);
    updateClubBoardConfidence(awayClub, homeClub, awayWon, isDraw, homeWon);
  }

  // 5. Update and sort table
  for (const f of next.fixtures) {
    if (f.matchday !== currentMatchday || !f.result) continue;
    const homeRow = next.table.find((r) => r.clubId === f.homeId);
    const awayRow = next.table.find((r) => r.clubId === f.awayId);
    if (!homeRow || !awayRow) continue;

    homeRow.p++;
    awayRow.p++;
    homeRow.gf += f.result.homeGoals;
    homeRow.ga += f.result.awayGoals;
    awayRow.gf += f.result.awayGoals;
    awayRow.ga += f.result.homeGoals;
    homeRow.gd = homeRow.gf - homeRow.ga;
    awayRow.gd = awayRow.gf - awayRow.ga;

    if (f.result.homeGoals > f.result.awayGoals) {
      homeRow.w++;
      homeRow.pts += 3;
      homeRow.form.push('W');
      awayRow.l++;
      awayRow.form.push('L');
    } else if (f.result.homeGoals === f.result.awayGoals) {
      homeRow.d++;
      homeRow.pts += 1;
      homeRow.form.push('D');
      awayRow.d++;
      awayRow.pts += 1;
      awayRow.form.push('D');
    } else {
      awayRow.w++;
      awayRow.pts += 3;
      awayRow.form.push('W');
      homeRow.l++;
      homeRow.form.push('L');
    }

    if (homeRow.form.length > 5) homeRow.form.shift();
    if (awayRow.form.length > 5) awayRow.form.shift();
  }

  next.matchRedCardPlayerIds = sentOffPlayerIds;

  next.table = sortTable(next.table, next.fixtures, next.clubs);

  // Position vs expectation check from matchday 4 (§12.7)
  if (currentMatchday >= 4) {
    for (const club of Object.values(next.clubs)) {
      const pos = next.table.findIndex((r) => r.clubId === club.id) + 1;
      let posDelta = 0;
      if (pos <= club.expectation.target) {
        posDelta = BALANCE.board.matchday4TargetMet;
      } else if (pos > club.expectation.acceptable) {
        posDelta = BALANCE.board.matchday4AcceptableExceeded;
        if (pos >= club.expectation.acceptable + 3) {
          posDelta += BALANCE.board.matchday4AcceptablePlus3Extra;
        }
      }
      club.boardConfidence = clamp(club.boardConfidence + posDelta, 0, 100);
    }
  }

  // 6. Handle active press condition from previous match if set (§16.2)
  if (next.activePressCondition) {
    const userFix = next.fixtures.find(
      (f) =>
        f.matchday === currentMatchday &&
        (f.homeId === next.userClubId || f.awayId === next.userClubId),
    );
    if (userFix && userFix.result) {
      const isHome = userFix.homeId === next.userClubId;
      const userWon = isHome
        ? userFix.result.homeGoals > userFix.result.awayGoals
        : userFix.result.awayGoals > userFix.result.homeGoals;
      const userLost = isHome
        ? userFix.result.homeGoals < userFix.result.awayGoals
        : userFix.result.awayGoals < userFix.result.homeGoals;
      const outcome: 'win' | 'lose' | 'draw' = userWon ? 'win' : userLost ? 'lose' : 'draw';

      if (outcome === next.activePressCondition.type) {
        const uClub = next.clubs[next.userClubId];
        if (uClub) {
          uClub.fanMood = clamp(uClub.fanMood + next.activePressCondition.fansDelta, 0, 100);
          uClub.boardConfidence = clamp(
            uClub.boardConfidence + next.activePressCondition.boardDelta,
            0,
            100,
          );
        }
      }
    }
    next.activePressCondition = null;
  }

  // 6b. Evaluate player promises after matchday (§12.9)
  const userClubForPromise = next.clubs[next.userClubId];
  if (userClubForPromise) {
    const userStarters = (userClubForPromise.tactics.lineup ?? []).filter(
      (id): id is PlayerId => id != null,
    );
    const promiseCheck = evaluatePromisesAfterMatch(
      next.players,
      next.userClubId,
      userStarters,
      currentMatchday,
    );
    next.players = promiseCheck.updatedPlayers;
    if (promiseCheck.notifications.length > 0) {
      next.inbox.unshift(...promiseCheck.notifications);
    }
  }

  // 7. Post-match press conference trigger (§12.6, §16.2)
  const userFix = next.fixtures.find(
    (f) =>
      f.matchday === currentMatchday &&
      (f.homeId === next.userClubId || f.awayId === next.userClubId),
  );
  if (userFix && userFix.result) {
    const isUserHome = userFix.homeId === next.userClubId;
    const userClub = next.clubs[next.userClubId]!;
    const oppClub = next.clubs[isUserHome ? userFix.awayId : userFix.homeId]!;
    const userGoals = isUserHome ? userFix.result.homeGoals : userFix.result.awayGoals;
    const oppGoals = isUserHome ? userFix.result.awayGoals : userFix.result.homeGoals;
    const userWon = userGoals > oppGoals;
    const userLost = userGoals < oppGoals;
    const userDrew = userGoals === oppGoals;
    const isDerby = userClub.rivals.includes(oppClub.id) || oppClub.rivals.includes(userClub.id);
    const userWonOrDrawnAgainstHighRep =
      oppClub.reputation >= userClub.reputation + 2 && (userWon || userDrew);
    const lossByThreeOrMore = userLost && oppGoals - userGoals >= 3;

    // Check form streak
    const userRow = next.table.find((r) => r.clubId === next.userClubId);
    const formLast3 = userRow?.form.slice(-3) ?? [];
    const winStreak = formLast3.every((res) => res === 'W') && formLast3.length === 3 ? 3 : 0;
    const lossStreak = formLast3.every((res) => res === 'L') && formLast3.length === 3 ? 3 : 0;
    const streakReachedThree = winStreak >= 3 || lossStreak >= 3;

    const pressRng = createRng(deriveSeed(next.seed, 'post-match-press', currentMatchday));
    const shouldTrigger = shouldTriggerPostMatchPress(
      {
        isDerby,
        matchday: currentMatchday,
        userWonOrDrawnAgainstHighRep,
        lossByThreeOrMore,
        streakReachedThree,
      },
      pressRng,
    );

    if (shouldTrigger) {
      let topRatingPlayer: { playerId: PlayerId; rating: number } | undefined;
      let lowRatingPlayer: { playerId: PlayerId; rating: number } | undefined;

      const fullRes = results[userFix.id];
      const playerResults = (fullRes?.players ?? []).filter((pl) => {
        const p = next.players[pl.playerId];
        return p && p.clubId === next.userClubId;
      });

      playerResults.sort((a, b) => b.rating - a.rating);
      if (playerResults[0] && playerResults[0].rating >= 8.5) {
        topRatingPlayer = { playerId: playerResults[0].playerId, rating: playerResults[0].rating };
      }
      const lowest = playerResults[playerResults.length - 1];
      if (lowest && lowest.rating <= 5.5 && lowest.rating > 0) {
        lowRatingPlayer = { playerId: lowest.playerId, rating: lowest.rating };
      }

      const pressContext = determinePressContext(
        {
          matchday: currentMatchday,
          userGoals,
          oppGoals,
          userRep: userClub.reputation,
          oppRep: oppClub.reputation,
          winStreak,
          lossStreak,
          topRating: topRatingPlayer,
          lowRating: lowRatingPlayer,
        },
        pressRng,
      );

      const targetPlayer =
        pressContext === 'PLAYER_PRAISE' && topRatingPlayer
          ? next.players[topRatingPlayer.playerId]
          : pressContext === 'PLAYER_CRITICISM' && lowRatingPlayer
            ? next.players[lowRatingPlayer.playerId]
            : userFix.result.motm && next.players[userFix.result.motm]?.clubId === next.userClubId
              ? next.players[userFix.result.motm]
              : undefined;

      const targetPlayerName = targetPlayer
        ? (targetPlayer.knownAs ?? `${targetPlayer.firstName} ${targetPlayer.lastName}`)
        : undefined;

      next.pendingPress = generatePressConference(
        pressContext,
        next.pressHistory ?? [],
        {
          opponent: oppClub.name,
          club: userClub.name,
          player: targetPlayerName,
          score: `${userGoals} - ${oppGoals}`,
        },
        pressRng,
        targetPlayer?.id,
      );
    }
  }

  // Reset scouting allowance for new matchday
  next.scoutedThisMatchday = [];

  // Generate Match News (SPEC §16.6)
  if (!next.news) next.news = [];
  const roundFixtures = next.fixtures.filter((f) => f.matchday === currentMatchday);
  for (const fix of roundFixtures) {
    if (!fix.result) continue;
    const homeC = next.clubs[fix.homeId];
    const awayC = next.clubs[fix.awayId];
    if (homeC && awayC) {
      const isDerby = homeC.rivals.includes(awayC.id);
      const matchNews = generateMatchNews(next, fix.result, homeC, awayC, isDerby, fix.id);
      next.news.unshift(matchNews);
    }
  }

  next.phase = 'PostMatch';
  return next;
}

/**
 * Runs 7-day weekly processing at WeekSummary (§10.2, §12.1-§12.10)
 */
export function runWeeklyProcessing(state: GameState): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const currentMatchday = next.matchday;
  next.focusBoost = 0; // Reset pre-match focus boost after match results are applied

  // 1. Process player weekly recovery, development, training injuries & healing
  for (const [idStr, p] of Object.entries(next.players)) {
    const id = idStr as PlayerId;
    const club = p.clubId ? next.clubs[p.clubId] : null;
    const intensity = club?.trainingPlan.intensity ?? 'Normal';
    const focus = club?.trainingPlan.focus ?? 'Balanced';
    const schedule = club?.trainingPlan.schedule ?? BALANCED_WEEK_SCHEDULE;
    const weekLoad = calculateWeekLoad(schedule);
    const playedMinutes = p.stats.minutesLastMatch ?? 0;
    const playerPlan = club?.trainingPlan.playerPlans?.[p.id];
    const workload = p.workload ?? playerPlan?.workload ?? 'Normal';
    const extra = p.extraSessions ?? playerPlan?.extraSessions ?? false;

    const trainRng = createRng(deriveSeed(next.seed, 'training-inj', `${currentMatchday}-${p.id}`));

    // Extra sessions skip chance (§12.18.5)
    let extraSkipped = false;
    if (extra && (p.personality === 'Relaxed' || p.personality === 'Temperamental')) {
      if (trainRng.next() < BALANCE.training.extraSessions.skipChance) {
        extraSkipped = true;
        p.extraSessionsSkipped = true;
        p.morale = clamp(p.morale + BALANCE.training.extraSessions.skipMoralePenalty, 0, 100);
      } else {
        p.extraSessionsSkipped = false;
      }
    } else {
      p.extraSessionsSkipped = false;
    }

    if (extra && !extraSkipped) {
      p.fatigue = clamp(p.fatigue + BALANCE.training.extraSessions.fatigue, 0, 100);
    }

    // Workload condition delta (§12.18.5)
    const workloadCondDelta = BALANCE.training.workload[workload]?.condition ?? 0;

    // Condition recovery (§12.1, §12.2, §12.17.3, §12.18.3)
    if (p.rest) {
      p.condition = clamp(p.condition + BALANCE.club.restConditionGain, 0, 100);
      p.fatigue = clamp(p.fatigue - BALANCE.club.restFatigueReduction, 0, 100);
      if (p.condition >= 90) {
        p.consecutiveRestWeeks = (p.consecutiveRestWeeks ?? 0) + 1;
        if (p.consecutiveRestWeeks >= 3) {
          p.morale = clamp(p.morale + BALANCE.club.restConsecutiveWeeksMoralePenalty, 0, 100);
          if (p.clubId === next.userClubId) {
            next.counters.inbox++;
            const pName = p.knownAs ?? `${p.firstName} ${p.lastName}`;
            next.inbox.unshift({
              id: `inbox_${next.counters.inbox}`,
              matchday: currentMatchday,
              kind: 'Player',
              title: `Player Discontent: ${pName}`,
              body: `${pName} is fully fit but has been given rest days for three consecutive weeks. He has expressed frustration at missing regular training sessions.`,
              read: false,
              requiresAction: false,
            });
          }
        }
      } else {
        p.consecutiveRestWeeks = 0;
      }
    } else {
      p.consecutiveRestWeeks = 0;
      const condRec = calculateWeeklyConditionRecovery({
        stamina: p.attributes.stamina,
        intensity,
        focus,
        playedMinutes,
        fatigue: p.fatigue,
        weekLoad,
        workloadConditionDelta: workloadCondDelta,
      });
      p.condition = clamp(Math.round(p.condition + condRec), 0, 100);

      // Fatigue recovery (§12.2)
      const fatRec = calculateWeeklyFatigueRecovery(intensity);
      p.fatigue = clamp(Math.round(p.fatigue - fatRec), 0, 100);
    }

    // Training injury check per SPEC §12.3 & §12.18.3 (only for healthy players)
    if (!p.injury && p.clubId) {
      const workloadInjMult = BALANCE.training.workload[workload]?.injury ?? 1.0;
      const extraInjMult = extra && !extraSkipped ? BALANCE.training.extraSessions.injury : 1.0;
      const trainingInj = checkTrainingInjury(
        trainRng,
        intensity,
        p.fatigue,
        weekLoad,
        workloadInjMult,
        extraInjMult,
      );
      if (trainingInj) {
        const physioStars = club?.staff?.physio.stars ?? 3;
        const physioFactor =
          BALANCE.club.physioInjuryLenBase - BALANCE.club.physioInjuryLenPerStar * physioStars;
        trainingInj.matchdaysOut = Math.max(1, Math.round(trainingInj.matchdaysOut * physioFactor));
        p.injury = trainingInj;
        if (p.clubId === next.userClubId) {
          next.counters.inbox++;
          next.inbox.unshift({
            id: `inbox_${next.counters.inbox}`,
            matchday: currentMatchday,
            kind: 'Medical',
            title: `Training Injury: ${p.knownAs ?? `${p.firstName} ${p.lastName}`}`,
            body: `${p.knownAs ?? `${p.firstName} ${p.lastName}`} has suffered a ${trainingInj.kind.toLowerCase()} during training and is expected to miss ${trainingInj.matchdaysOut} matchdays.`,
            read: false,
            requiresAction: false,
          });
        }
      }
    }

    // Training rating (§12.18.7)
    const ratingRng = createRng(
      deriveSeed(next.seed, 'training-rating', `${currentMatchday}-${p.id}`),
    );
    const trainRating = calculateTrainingRating(p, workload, extra, extraSkipped, ratingRng);
    p.lastTrainingRating = trainRating;
    p.ratingHistory = [...(p.ratingHistory ?? []), trainRating].slice(-8);
    if (trainRating >= BALANCE.training.ratings.highThreshold) {
      p.morale = clamp(p.morale + BALANCE.training.ratings.highMoraleBonus, 0, 100);
    }

    // Mentoring pairs (§12.18.5)
    const mentorId = p.mentorId ?? playerPlan?.mentorId ?? null;
    let isMentee = false;
    if (mentorId) {
      const mentor = next.players[mentorId];
      if (mentor && p.age <= BALANCE.training.mentoring.menteeMaxAge) {
        isMentee = true;
        const drift = BALANCE.training.mentoring.moraleDriftPct * (mentor.morale - p.morale);
        p.morale = clamp(Math.round(p.morale + drift), 0, 100);
        if (mentor.stats.starts === 0 && currentMatchday >= 3) {
          p.morale = clamp(p.morale + BALANCE.training.mentoring.lostPlacePenalty, 0, 100);
        }
      }
    }
    const isMentor = (club?.squad ?? []).some((sId) => {
      const otherP = next.players[sId];
      const otherPlan = club?.trainingPlan?.playerPlans?.[sId];
      return otherP?.mentorId === p.id || otherPlan?.mentorId === p.id;
    });

    // Injury healing (§12.5)
    if (p.injury) {
      p.injury.matchdaysOut -= 1;
      if (p.injury.matchdaysOut <= 0) {
        p.injury = null;
        p.condition = 75; // condition set to 75 per §12.5
        if (p.clubId === next.userClubId) {
          next.counters.inbox++;
          next.inbox.unshift({
            id: `inbox_${next.counters.inbox}`,
            matchday: currentMatchday,
            kind: 'Medical',
            title: `Returned from Injury: ${p.knownAs ?? `${p.firstName} ${p.lastName}`}`,
            body: `${p.knownAs ?? `${p.firstName} ${p.lastName}`} has recovered from injury and resumed full team training. Condition is at 75%.`,
            read: false,
            requiresAction: false,
          });
        }
      }
    }

    // Suspension decremented if player missed a matchday
    if (p.suspendedMatches > 0) {
      p.suspendedMatches = Math.max(0, p.suspendedMatches - 1);
    }

    // Fractional Development & Age Decline (§12.4, §12.17.4)
    if (!p.rest) {
      const coachStars = club?.staff?.coach.stars ?? 3;
      let coachDevFactor = BALANCE.club.coachDevBase + BALANCE.club.coachDevPerStar * coachStars;
      if (club?.prep && club.prep !== 'None') {
        coachDevFactor *= BALANCE.club.prepDevPenalty;
      }

      // Individual Position Training (SPEC §12.17.4)
      const indFocus = club?.trainingPlan.individualFocus?.[p.id];
      let positionTrained = false;
      if (indFocus?.type === 'position') {
        const posRes = applyPositionTraining(p, indFocus.position, coachStars, playedMinutes > 0);
        p.positions = posRes.player.positions;
        positionTrained = true;
        if (posRes.reachedThreshold && p.clubId === next.userClubId) {
          next.counters.inbox++;
          const pName = p.knownAs ?? `${p.firstName} ${p.lastName}`;
          next.inbox.unshift({
            id: `inbox_${next.counters.inbox}`,
            matchday: currentMatchday,
            kind: 'Player',
            title: `Position Mastery: ${pName}`,
            body: `${pName} has adapted to playing at ${indFocus.position} and is now fully comfortable in that role (familiarity 85+).`,
            read: false,
            requiresAction: false,
          });
        }
      }

      // Individual Trait Training (§13.23)
      let traitTrained = false;
      if (indFocus?.type === 'trait') {
        const tId = indFocus.trait;
        const def = TRAIT_DEFINITIONS[tId];
        const unlearn = Boolean(indFocus.unlearn);
        const weeklyGain = calculateTraitTrainingProgress(p, coachStars);

        const currentProgress = p.traitTraining?.trait === tId ? p.traitTraining.progress : 0;
        const newProgress = currentProgress + weeklyGain;
        p.traitTraining = { trait: tId, progress: newProgress, unlearn };
        traitTrained = true;

        if (newProgress >= K.traits.learning.completionThreshold) {
          const pName = p.knownAs ?? `${p.firstName} ${p.lastName}`;
          if (unlearn) {
            p.traits = (p.traits ?? []).filter((t) => t !== tId);
            if (p.clubId === next.userClubId) {
              next.counters.inbox++;
              next.inbox.unshift({
                id: `inbox_${next.counters.inbox}`,
                matchday: currentMatchday,
                kind: 'Player',
                title: `Trait Unlearned: ${pName}`,
                body: `${pName} has unlearned "${def?.name ?? tId}" through focused training.`,
                read: false,
                requiresAction: false,
              });
            }
          } else {
            p.traits = Array.from(new Set([...(p.traits ?? []), tId]));
            if (p.clubId === next.userClubId) {
              next.counters.inbox++;
              next.inbox.unshift({
                id: `inbox_${next.counters.inbox}`,
                matchday: currentMatchday,
                kind: 'Player',
                title: `New Trait: ${pName}`,
                body: `${pName} now ${def ? def.wording.toLowerCase() : tId}.`,
                read: false,
                requiresAction: false,
              });
            }
          }
          p.traitTraining = undefined;
          if (club?.trainingPlan.individualFocus) {
            delete club.trainingPlan.individualFocus[p.id];
          }
        }
      }

      // Check opposing trait clashes (§13.23)
      if (club && p.traits && p.traits.length > 0) {
        const slotIdx = club.tactics.lineup.findIndex((lineupId) => lineupId === p.id);
        if (slotIdx >= 0) {
          const pis = [
            ...(club.tactics.playerInstructions?.[slotIdx] ?? []),
            ...(club.tactics.attInstructions?.[slotIdx] ?? []),
            ...(club.tactics.defInstructions?.[slotIdx] ?? []),
          ];
          const clashing = p.traits.find((t) => isTraitClashing(t, pis).clashes);
          if (clashing) {
            p.opposedTraitWeeks = (p.opposedTraitWeeks ?? 0) + 1;
            p.morale = clamp(p.morale + K.traits.clashes.moraleWeeklyPenalty, 0, 100);
            if (
              p.opposedTraitWeeks === K.traits.clashes.memoWeeks &&
              p.clubId === next.userClubId
            ) {
              const def = TRAIT_DEFINITIONS[clashing];
              const pName = p.knownAs ?? `${p.firstName} ${p.lastName}`;
              next.counters.inbox++;
              next.inbox.unshift({
                id: `inbox_${next.counters.inbox}`,
                matchday: currentMatchday,
                kind: 'Player',
                title: `Tactical Frustration: ${pName}`,
                body: `${pName} is unhappy playing against his natural game (${def ? def.wording.toLowerCase() : clashing}) for three weeks running.`,
                read: false,
                requiresAction: false,
              });
            }
          } else {
            p.opposedTraitWeeks = 0;
          }
        }
      }

      const devRng = createRng(deriveSeed(next.seed, 'player-dev', `${currentMatchday}-${p.id}`));
      const devRes = processPlayerDevelopment(p, {
        focus,
        intensity,
        minutesLastMatch: playedMinutes,
        individualFocus:
          positionTrained || traitTrained ? null : (club?.trainingPlan?.individual?.[p.id] ?? null),
        rng: devRng,
        schedule,
        workload,
        extraSessions: extra,
        extraSessionsSkipped: extraSkipped,
        trainingRating: trainRating,
        isMentee,
        isMentor,
        oneToOneTechnique: club?.trainingPlan?.lastOneToOnePlayerId === p.id,
      });

      if (positionTrained || traitTrained) coachDevFactor *= K.traits.learning.devFactorMult;
      if (devRes.player.growth > p.growth) {
        const gained = devRes.player.growth - p.growth;
        devRes.player.growth = p.growth + gained * coachDevFactor;
      }

      // Progress snapshots for user club only (§12.18.8)
      if (p.clubId === next.userClubId) {
        const currentOvr = Math.round(
          rawOvr(devRes.player.attributes, devRes.player.positions[0]?.pos ?? 'CM'),
        );
        devRes.player.ovrHistory = [...(devRes.player.ovrHistory ?? []), currentOvr];
        devRes.player.attrHistory = [
          ...(devRes.player.attrHistory ?? []),
          { matchday: currentMatchday, attributes: { ...devRes.player.attributes } },
        ].slice(-4);
      }

      next.players[id] = devRes.player;
    }

    // Decrement decision counters (§12.19, §12.20)
    if (p.rushedBack) {
      p.rushedBack.matchesLeft -= 1;
      if (p.rushedBack.matchesLeft <= 0) p.rushedBack = null;
    }
    if (p.carriedKnockWeeks && p.carriedKnockWeeks > 0) {
      p.carriedKnockWeeks -= 1;
    }
    if (p.offenceMultipliers) {
      p.offenceMultipliers = p.offenceMultipliers
        .map((m) => ({ ...m, weeksLeft: m.weeksLeft - 1 }))
        .filter((m) => m.weeksLeft > 0);
    }
    p.warmupScare = false;

    // Check for rush-back offer (§12.19.2) if 1 week from fit
    if (
      p.clubId === next.userClubId &&
      p.injury &&
      p.injury.matchdaysOut === 1 &&
      !next.pendingRushBack
    ) {
      next.pendingRushBack = {
        playerId: p.id,
        matchday: currentMatchday,
        originalMatchdaysOut: 1,
        injuryKind: p.injury.kind,
        resolved: false,
      };
    }
  }

  // 2. Club Weekly Finances & Fan Mood Drift (§12.10, §12.14)
  for (const club of Object.values(next.clubs)) {
    // Income
    const sponsor = BALANCE.finances.sponsorIncomeWeekly[club.reputation] ?? 400_000;
    club.balance += BALANCE.finances.tvIncomeWeekly + sponsor;
    club.seasonStats.tvIncome += BALANCE.finances.tvIncomeWeekly;
    club.seasonStats.sponsorIncome += sponsor;

    // Expenses: wages + operating + staff
    let squadWages = 0;
    for (const pId of club.squad) {
      const p = next.players[pId];
      if (p?.contract) squadWages += p.contract.wagePerWeek;
    }
    const operating = BALANCE.finances.operatingCostPerReputation * club.reputation;
    let staffWages = 0;
    if (club.staff) {
      staffWages =
        club.staff.assistant.wage +
        club.staff.coach.wage +
        club.staff.scout.wage +
        club.staff.physio.wage;
    }
    club.balance -= squadWages + operating + staffWages;
    club.seasonStats.wagesPaid += squadWages + staffWages;
    club.seasonStats.operating += operating;

    // Fan mood drift towards 60 by 1 per week (§12.14)
    if (club.fanMood > BALANCE.fans.driftTarget) club.fanMood -= BALANCE.fans.driftStep;
    else if (club.fanMood < BALANCE.fans.driftTarget) club.fanMood += BALANCE.fans.driftStep;

    // Board confidence penalties (§12.7)
    if (squadWages > club.wageBudget) {
      club.boardConfidence = Math.max(
        0,
        club.boardConfidence + BALANCE.board.wageOverBudgetPenalty,
      );
    }
    if (club.balance < 0) {
      club.boardConfidence = Math.max(
        0,
        club.boardConfidence + BALANCE.board.balanceNegativePenalty,
      );
    }

    // Dressing room cohesion & morale spread (§12.17.5)
    const cohRes = computeWeeklyCohesion(club, next.players);
    club.cohesion = cohRes.newCohesion;
    if (!club.cohesionHistory) club.cohesionHistory = [];
    for (const r of cohRes.reasons) {
      club.cohesionHistory.unshift({
        matchday: currentMatchday,
        reason: r,
        delta: cohRes.delta,
      });
    }
    if (club.cohesionHistory.length > 5) {
      club.cohesionHistory = club.cohesionHistory.slice(0, 5);
    }
    next.players = applyMoraleSpread(club, next.players);

    // Reset match prep, staff replacement, and one-to-one for the new week
    club.prep = 'None';
    club.staffReplacedThisRound = false;
    if (club.trainingPlan) {
      club.trainingPlan.oneToOneUsedThisWeek = false;
      club.trainingPlan.lastOneToOnePlayerId = null;
    }

    // Auto-apply Theo's week if letTheoPlan is enabled (§12.18.4)
    if (club.id === next.userClubId && club.trainingPlan?.letTheoPlan) {
      const nextFixture = next.fixtures.find(
        (f) => f.matchday === currentMatchday + 1 && (f.homeId === club.id || f.awayId === club.id),
      );
      let oppClub: Club | undefined;
      let oppPlayers: Player[] | undefined;
      if (nextFixture) {
        const oppId = nextFixture.homeId === club.id ? nextFixture.awayId : nextFixture.homeId;
        oppClub = next.clubs[oppId];
        oppPlayers = oppClub?.squad
          .map((pId) => next.players[pId])
          .filter((pl): pl is Player => pl != null);
      }
      const theos = generateTheosWeek(club, next.players, oppClub, oppPlayers);
      club.trainingPlan.schedule = theos.schedule;
      club.trainingPlan.theosMemo = { reasons: theos.reasons, opponentPrep: theos.opponentPrep };
      club.trainingPlan.theoSuggestedSlots = theos.suggestedSlots;
      if (theos.opponentPrep) {
        club.prep = theos.opponentPrep;
      }
    }
  }

  const userClub = next.clubs[next.userClubId];

  // Check physio overload memo (§12.18.9)
  if (userClub) {
    const userClubPlayers = userClub.squad
      .map((pId) => next.players[pId])
      .filter((pl): pl is Player => pl != null);
    const overloaded = getOverloadedPlayers(userClubPlayers, userClub.trainingPlan?.playerPlans);
    if (overloaded.length > 0) {
      const names = overloaded.map((p) => p.lastName).join(', ');
      next.counters.inbox++;
      next.inbox.unshift({
        id: `inbox_${next.counters.inbox}`,
        matchday: currentMatchday,
        kind: 'Medical',
        title: `Overloaded: ${names}. Ease them off?`,
        body: `Physio Sam Oduya reports that ${names} are carrying excessive fatigue levels under their current workload. Consider easing their sessions to Light.`,
        read: false,
        requiresAction: true,
      });
    }

    // 3. User Club Sacking & Board Warnings (§12.7, §12.11)
    if (userClub.boardConfidence < BALANCE.board.warningThreshold && !next.boardWarningSent) {
      next.counters.inbox++;
      next.inbox.unshift({
        id: `inbox_${next.counters.inbox}`,
        matchday: currentMatchday,
        kind: 'Board',
        title: 'Final Warning Regarding Recent Performance',
        body: `The board of ${userClub.name} is deeply concerned by recent performances and results. Immediate improvement is required if you are to retain your position.`,
        read: false,
        requiresAction: false,
      });
      next.boardWarningSent = true;
    }

    // Board praise when confidence >= 80 for the first time (§12.11)
    if (userClub.boardConfidence >= BALANCE.board.praiseThreshold && !next.boardPraiseSent) {
      next.counters.inbox++;
      next.inbox.unshift({
        id: `inbox_${next.counters.inbox}`,
        matchday: currentMatchday,
        kind: 'Board',
        title: 'Board Commendation: Outstanding Management',
        body: `The board of ${userClub.name} wishes to formally express their unanimous satisfaction with recent results. The club is currently exceeding boardroom expectations.`,
        read: false,
        requiresAction: false,
      });
      next.boardPraiseSent = true;
    }

    if (
      currentMatchday >= BALANCE.board.sackingMatchdayStart &&
      userClub.boardConfidence < BALANCE.board.sackingThreshold
    ) {
      next.phase = 'Sacked';
      return next;
    }
  }

  // Update tactical familiarity per area (§13.18.11)
  for (const club of Object.values(next.clubs)) {
    if (!club.familiarity) {
      club.familiarity = createStartingFamiliarity(club.style, club.tactics.formation);
    }
    const isTactical = (club.trainingPlan?.focus as string) === 'Tactical';
    club.familiarity = updateClubFamiliarity(club.familiarity, club.tactics, isTactical);

    // Update set piece routine familiarity (§13.20.2)
    if (!club.tactics.setPieces) {
      club.tactics.setPieces = createDefaultSetPieceTactics();
    }
    const sp = club.tactics.setPieces;
    const sched = club.trainingPlan?.schedule ?? BALANCED_WEEK_SCHEDULE;
    let setPieceSessions = 0;
    const trainSlots = sched ? Object.values(sched) : [];
    for (const slot of trainSlots) {
      if (slot === 'set_pieces') setPieceSessions++;
    }

    const leftInUse = sp.leftCorners.rotate
      ? sp.leftCorners.routines
      : [sp.leftCorners.routines[sp.leftCorners.activeRoutine] ?? sp.leftCorners.routines[0]];
    const rightInUse = sp.rightCorners.rotate
      ? sp.rightCorners.routines
      : [sp.rightCorners.routines[sp.rightCorners.activeRoutine] ?? sp.rightCorners.routines[0]];

    const inUseSet = new Set<CornerRoutine>([
      ...leftInUse.filter((r): r is CornerRoutine => Boolean(r)),
      ...rightInUse.filter((r): r is CornerRoutine => Boolean(r)),
    ]);
    const inUseCount = inUseSet.size;
    const gainPerInUse =
      inUseCount > 0 ? (K.sp.sharpness.practiceWeeklyGainTotal * setPieceSessions) / inUseCount : 0;

    const allRoutines = [...sp.leftCorners.routines, ...sp.rightCorners.routines];
    for (const r of allRoutines) {
      if (inUseSet.has(r)) {
        if (setPieceSessions > 0) {
          r.familiarity = Math.min(K.sp.sharpness.familiarityCeiling, r.familiarity + gainPerInUse);
        } else {
          r.familiarity = Math.max(
            K.sp.sharpness.familiarityFloor,
            r.familiarity - K.sp.sharpness.unpractisedWeeklyLoss,
          );
        }
      } else {
        r.familiarity = Math.max(
          K.sp.sharpness.familiarityFloor,
          r.familiarity - K.sp.sharpness.unpractisedWeeklyLoss,
        );
      }
    }
  }

  // 4. Check player conversation triggers (SPEC §12.9: At most 1 new conversation per week)
  if (!next.activeConversation) {
    const userClub = next.clubs[next.userClubId]!;
    const convRng = createRng(deriveSeed(next.seed, 'player-conv', `${currentMatchday}`));
    const convResult = checkConversationTriggers(
      userClub,
      next.players,
      next.fixtures,
      currentMatchday,
      next.conversationsHistory ?? [],
      convRng,
    );
    if (convResult) {
      next.activeConversation = convResult.conversation;
      next.inbox.unshift(convResult.inboxItem);
    }
  }

  // 5. Rival transfer rumour check (SPEC §12.11: 1 per 3 weeks outside windows)
  const rumourItem = checkRivalRumour(next);
  if (rumourItem) {
    next.inbox.unshift(rumourItem);
  }

  // 6. Check for weekly discipline incident (SPEC §12.20)
  if (!next.activeIncident) {
    const incidentRng = createRng(deriveSeed(next.seed, 'incident', `${currentMatchday}`));
    const incident = checkForWeeklyDisciplineIncident(
      next,
      incidentRng,
      next.matchRedCardPlayerIds ?? [],
    );
    if (incident) {
      next.activeIncident = incident;
    }
  }
  next.matchRedCardPlayerIds = [];

  next.phase = 'WeekSummary';
  return next;
}

/**
 * Computes End of Season Awards, Grade and Score (SPEC §12.15, §12.16)
 */
export function computeSeasonEnd(state: GameState): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const userClub = next.clubs[next.userClubId]!;
  const finalPos = next.table.findIndex((r) => r.clubId === next.userClubId) + 1;
  const target = userClub.expectation.target;
  const delta = target - finalPos;

  // Grade (§12.16)
  let grade: 'A+' | 'A' | 'B' | 'B-' | 'C' | 'D' | 'F' = 'B';
  if (delta >= 2) grade = 'A+';
  else if (delta === 1) grade = 'A';
  else if (delta === 0) grade = 'B';
  else if (finalPos <= userClub.expectation.acceptable) grade = 'B-';
  else if (delta === -1) grade = 'C';
  else if (delta === -2) grade = 'D';
  else grade = 'F';

  // Prize money (§12.10): 1st 20M, then -2M per place (10th: 2M)
  for (let i = 0; i < next.table.length; i++) {
    const row = next.table[i]!;
    const club = next.clubs[row.clubId];
    if (club) {
      const prize = BALANCE.finances.prizeMoney1st - i * BALANCE.finances.prizeMoneyStep;
      club.balance += prize;
      club.seasonStats.prizeMoney += prize;
    }
  }

  // Score (§12.16)
  const userRow = next.table.find((r) => r.clubId === next.userClubId)!;
  const isChampion = finalPos === 1;
  const rawScore =
    userRow.pts * 10 +
    userRow.gd * 2 +
    delta * 50 +
    (isChampion ? 300 : 0) +
    Math.round(userClub.boardConfidence) +
    Math.round(userClub.fanMood);

  next.score = Math.max(0, rawScore);

  // Awards (§12.15)
  const allPlayers = Object.values(next.players);

  // Player of the Season (highest avg rating, >= 12 rated apps)
  const potCandidates = allPlayers
    .filter((p) => p.stats.ratedApps >= 12)
    .sort((a, b) => b.stats.ratingSum / b.stats.ratedApps - a.stats.ratingSum / a.stats.ratedApps);
  const playerOfTheSeason = potCandidates[0]?.id ?? allPlayers[0]!.id;

  // Golden Boot (goals, tiebreak assists, fewer minutes)
  const goldenBoot = [...allPlayers].sort((a, b) => {
    if (b.stats.goals !== a.stats.goals) return b.stats.goals - a.stats.goals;
    if (b.stats.assists !== a.stats.assists) return b.stats.assists - a.stats.assists;
    return a.stats.minutes - b.stats.minutes;
  })[0]!.id;

  // Playmaker (assists)
  const playmaker = [...allPlayers].sort((a, b) => b.stats.assists - a.stats.assists)[0]!.id;

  // Golden Glove (clean sheets, GK >= 12 apps)
  const gkCandidates = allPlayers
    .filter((p) => p.positions[0]?.pos === 'GK' && p.stats.apps >= 12)
    .sort((a, b) => b.stats.cleanSheets - a.stats.cleanSheets);
  const goldenGlove =
    gkCandidates[0]?.id ?? allPlayers.find((p) => p.positions[0]?.pos === 'GK')!.id;

  // Young Player (<= 21, best avg rating, >= 8 apps)
  const ypCandidates = allPlayers
    .filter((p) => p.age <= 21 && p.stats.ratedApps >= 8)
    .sort((a, b) => b.stats.ratingSum / b.stats.ratedApps - a.stats.ratingSum / a.stats.ratedApps);
  const youngPlayer =
    ypCandidates[0]?.id ?? allPlayers.filter((p) => p.age <= 21)[0]?.id ?? allPlayers[0]!.id;

  // Manager of the Season (best delta target - finalPosition)
  const clubsByDelta = Object.values(next.clubs).sort((a, b) => {
    const posA = next.table.findIndex((r) => r.clubId === a.id) + 1;
    const posB = next.table.findIndex((r) => r.clubId === b.id) + 1;
    const deltaA = a.expectation.target - posA;
    const deltaB = b.expectation.target - posB;
    if (deltaB !== deltaA) return deltaB - deltaA;
    const ptsA = next.table.find((r) => r.clubId === a.id)?.pts ?? 0;
    const ptsB = next.table.find((r) => r.clubId === b.id)?.pts ?? 0;
    return ptsB - ptsA;
  });
  const managerOfTheSeason = clubsByDelta[0]!.id;

  next.awards = {
    playerOfTheSeason,
    goldenBoot,
    playmaker,
    goldenGlove,
    youngPlayer,
    managerOfTheSeason,
    teamOfTheSeason: [
      goldenGlove,
      allPlayers[0]!.id,
      allPlayers[1]!.id,
      allPlayers[2]!.id,
      allPlayers[3]!.id,
      allPlayers[4]!.id,
      allPlayers[5]!.id,
      allPlayers[6]!.id,
      allPlayers[7]!.id,
      goldenBoot,
      allPlayers[8]!.id,
    ],
  };

  next.phase = 'SeasonEnd';
  return next;
}

/**
 * Master dispatcher for game loop phase advancement (SPEC §10.1)
 */
function checkPreMatchDerbyPress(state: GameState): void {
  const userFix = state.fixtures.find(
    (f) =>
      f.matchday === state.matchday &&
      (f.homeId === state.userClubId || f.awayId === state.userClubId),
  );
  if (!userFix) return;
  const homeClub = state.clubs[userFix.homeId];
  const awayClub = state.clubs[userFix.awayId];
  if (!homeClub || !awayClub) return;
  const isDerby = homeClub.rivals.includes(awayClub.id) || awayClub.rivals.includes(homeClub.id);
  if (isDerby && shouldTriggerPreMatchPress(true) && !state.pendingPress) {
    const isUserHome = userFix.homeId === state.userClubId;
    const userClub = isUserHome ? homeClub : awayClub;
    const oppClub = isUserHome ? awayClub : homeClub;
    const pressRng = createRng(deriveSeed(state.seed, 'pre-match-derby-press', state.matchday));
    state.pendingPress = generatePressConference(
      'PRE_DERBY',
      state.pressHistory ?? [],
      {
        opponent: oppClub.name,
        club: userClub.name,
      },
      pressRng,
    );
  }
}

function checkPreMatchWarmupScare(state: GameState): void {
  const userClub = state.clubs[state.userClubId];
  if (!userClub) return;
  if (!state.pendingWarmupScare) {
    const userStarters = userClub.tactics.lineup
      .map((id) => (id ? state.players[id] : null))
      .filter((p): p is Player => p != null);
    if (userStarters.length > 0) {
      const scareRng = createRng(deriveSeed(state.seed, 'warmup-scare', `${state.matchday}`));
      const starter = scareRng.pick(userStarters)!;
      const physioStars = userClub.staff?.physio.stars ?? 3;
      if (checkWarmupScare(scareRng, starter.fatigue, physioStars)) {
        state.pendingWarmupScare = {
          playerId: starter.id,
          matchday: state.matchday,
          resolved: false,
        };
      }
    }
  }
}

export function advance(
  state: GameState,
  action?: {
    type: 'ACCEPT_JOB' | 'SKIP_WINDOW' | 'KICK_OFF' | 'FINISH_MATCH' | 'CONTINUE_WEEK';
    userMatchResult?: MatchResult;
  },
): GameState {
  switch (state.phase) {
    case 'BoardMeeting': {
      // User accepts the job -> Preseason
      const next = JSON.parse(JSON.stringify(state)) as GameState;
      next.phase = 'Preseason';
      return next;
    }

    case 'Preseason': {
      // Preseason -> Matchday 1 PreMatch
      const next = JSON.parse(JSON.stringify(state)) as GameState;
      next.matchday = 1;
      next.phase = 'PreMatch';
      checkPreMatchDerbyPress(next);
      checkPreMatchWarmupScare(next);
      return next;
    }

    case 'PreMatch': {
      // Validate user lineup
      const userClub = state.clubs[state.userClubId]!;
      const validation = validateLineup(userClub.tactics, state.players);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      const next = JSON.parse(JSON.stringify(state)) as GameState;

      // Lock AI lineups (§13.13)
      for (const club of Object.values(next.clubs)) {
        if (club.id === next.userClubId) continue;
        const candidates = club.squad
          .map((id) => next.players[id])
          .filter((p): p is Player => p != null)
          .map((p) => ({
            ...p,
            isInjured: p.injury !== null,
            isSuspended: p.suspendedMatches > 0,
          }));

        const bestLineup = pickBestLineup(
          candidates,
          club.style.formation,
          club.formationFamiliarity,
        );
        club.tactics.formation = bestLineup.formation;
        club.tactics.lineup = [...bestLineup.lineup];
        club.tactics.duties = [...bestLineup.duties];
        club.tactics.bench = [...bestLineup.bench];
      }

      // Find user fixture
      const fixture = next.fixtures.find(
        (f) =>
          f.matchday === next.matchday &&
          (f.homeId === next.userClubId || f.awayId === next.userClubId),
      );
      if (!fixture) {
        throw new Error(`Fixture not found for matchday ${next.matchday}`);
      }

      next.pendingMatch = { fixtureId: fixture.id };
      next.phase = 'Match';
      return next;
    }

    case 'Match': {
      // Simulate all 5 fixtures of the matchday
      const currentMatchday = state.matchday;
      const roundFixtures = state.fixtures.filter((f) => f.matchday === currentMatchday);
      const results: Record<FixtureId, MatchResult> = {};

      for (const f of roundFixtures) {
        if (f.id === state.pendingMatch?.fixtureId && action?.userMatchResult) {
          results[f.id] = action.userMatchResult;
        } else {
          // Simulate instant AI match
          const homeClub = state.clubs[f.homeId]!;
          const awayClub = state.clubs[f.awayId]!;
          const homeBoost = f.homeId === state.userClubId ? (state.focusBoost ?? 0) : 0;
          const awayBoost = f.awayId === state.userClubId ? (state.focusBoost ?? 0) : 0;
          const homeSheet = buildTeamSheet(homeClub, state.players, 'home', homeBoost);
          const awaySheet = buildTeamSheet(awayClub, state.players, 'away', awayBoost);

          const input: MatchInput = {
            fixtureId: f.id,
            home: homeSheet,
            away: awaySheet,
            isDerby: homeClub.rivals.includes(awayClub.id),
            weather: f.weather,
            userSide: null,
            aiControls: ['home', 'away'],
          };

          const matchSeed = deriveSeed(state.seed, 'match-sim', f.id);
          results[f.id] = simulateInstant(input, matchSeed);
        }
      }

      return applyMatchResults(state, results);
    }

    case 'PostMatch': {
      return runWeeklyProcessing(state);
    }

    case 'WeekSummary': {
      if (state.activeIncident && !state.activeIncident.resolved) {
        throw new Error('Active discipline incident must be resolved before continuing.');
      }
      if (state.matchday === 9) {
        const next = JSON.parse(JSON.stringify(state)) as GameState;
        next.phase = 'TransferWindow';
        next.window = {
          kind: 'Midseason',
          round: 1,
          offers: [],
          scoutingQueue: [],
          scoutingDoneThisRound: 0,
          boardWageRequestUsed: false,
        };
        next.inbox.unshift({
          id: `inbox_win_open_${next.seed}_${next.matchday}`,
          matchday: 9,
          kind: 'Transfer',
          title: 'Midseason Transfer Window Open',
          body: 'The midseason transfer window has arrived. Clubs may submit bids, scout talent, negotiate contracts, and field incoming enquiries over 3 rounds.',
          read: false,
          requiresAction: false,
        });
        return next;
      }
      if (state.matchday >= 18) {
        return computeSeasonEnd(state);
      }
      const next = JSON.parse(JSON.stringify(state)) as GameState;
      next.matchday += 1;
      next.phase = 'PreMatch';
      checkPreMatchDerbyPress(next);
      checkPreMatchWarmupScare(next);
      return next;
    }

    case 'TransferWindow': {
      return advanceWindowRound(state);
    }

    case 'SeasonEnd':
    case 'Sacked':
    default:
      return state;
  }
}
