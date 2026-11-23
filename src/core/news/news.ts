// Implements SPEC §12.11, §16.6 News and Back Pages
import {
  GameState,
  MatchResult,
  MatchResultSummary,
  Club,
  Player,
  NewsItem,
  InboxItem,
  ClubId,
  PlayerId,
} from '../types';
import newsData from '../../content/news.json';
import { deriveSeed, createRng } from '../rng';
import { formatMoney } from '../math';

function replaceTokens(template: string, tokens: Record<string, string>): string {
  let res = template;
  for (const [key, val] of Object.entries(tokens)) {
    res = res.replaceAll(`{${key}}`, val);
  }
  return res;
}

/**
 * Generates a NewsItem for a completed match fixture.
 */
export function generateMatchNews(
  state: GameState,
  result: MatchResult | MatchResultSummary,
  homeClub: Club,
  awayClub: Club,
  isDerby: boolean,
  fixtureId?: string,
): NewsItem {
  const homeWon = result.homeGoals > result.awayGoals;
  const awayWon = result.awayGoals > result.homeGoals;
  const isDraw = result.homeGoals === result.awayGoals;
  const margin = Math.abs(result.homeGoals - result.awayGoals);

  const winnerClub = homeWon ? homeClub : awayClub;
  const loserClub = homeWon ? awayClub : homeClub;
  const winnerGoals = Math.max(result.homeGoals, result.awayGoals);
  const loserGoals = Math.min(result.homeGoals, result.awayGoals);

  const fixId =
    'fixtureId' in result && result.fixtureId
      ? result.fixtureId
      : fixtureId || `${homeClub.id}_${awayClub.id}_${state.matchday}`;

  // Check for hat-trick from scorers list or events
  const playerGoals: Record<PlayerId, number> = {};
  if ('events' in result && Array.isArray(result.events)) {
    for (const ev of result.events) {
      if (ev.type === 'GOAL' && ev.playerId) {
        playerGoals[ev.playerId] = (playerGoals[ev.playerId] ?? 0) + 1;
      }
    }
  } else if ('scorers' in result && Array.isArray(result.scorers)) {
    for (const sc of result.scorers) {
      if (sc.playerId && !sc.ownGoal) {
        playerGoals[sc.playerId] = (playerGoals[sc.playerId] ?? 0) + 1;
      }
    }
  }
  let hatTrickPlayerId: PlayerId | null = null;
  for (const [pId, goals] of Object.entries(playerGoals)) {
    if (goals >= 3) {
      hatTrickPlayerId = pId as PlayerId;
      break;
    }
  }

  // Check for late winner (goal scored at 85' or later in a 1-goal win)
  let lateGoalPlayerId: PlayerId | null = null;
  let lateGoalMinute = '89';
  if (margin === 1) {
    if ('events' in result && Array.isArray(result.events)) {
      const goals = result.events.filter((e) => e.type === 'GOAL');
      const lastGoal = goals[goals.length - 1];
      if (lastGoal && lastGoal.t >= 85 * 60) {
        lateGoalPlayerId = lastGoal.playerId ?? null;
        lateGoalMinute = lastGoal.minuteLabel || '89';
      }
    } else if ('scorers' in result && Array.isArray(result.scorers) && result.scorers.length > 0) {
      const lastScorer = result.scorers[result.scorers.length - 1];
      if (lastScorer && parseInt(lastScorer.minuteLabel, 10) >= 85) {
        lateGoalPlayerId = lastScorer.playerId ?? null;
        lateGoalMinute = lastScorer.minuteLabel;
      }
    }
  }

  // Check for red card
  const events = 'events' in result && Array.isArray(result.events) ? result.events : [];
  const redEvent = events.find((e) => e.type === 'RED');

  // Check for upset (winner had reputation <= loser rep - 2)
  const isUpset = (homeWon || awayWon) && winnerClub.reputation <= loserClub.reputation - 2;

  // Determine category
  let category: keyof typeof newsData.matchHeadlines = 'win';
  if (hatTrickPlayerId) {
    category = 'hat_trick';
  } else if (isDerby && (homeWon || awayWon)) {
    category = winnerClub.id === state.userClubId ? 'derby_win' : 'derby_loss';
  } else if (isUpset) {
    category = 'upset';
  } else if (lateGoalPlayerId) {
    category = 'late_winner';
  } else if (margin >= 3) {
    category = winnerClub.id === state.userClubId ? 'big_win' : 'heavy_loss';
  } else if (isDraw) {
    category = 'draw';
  } else if (redEvent) {
    category = 'red_card';
  } else if (loserGoals === 0 && (homeWon || awayWon)) {
    category = 'clean_sheet';
  } else if (!homeWon && !awayWon) {
    category = 'draw';
  } else {
    category = winnerClub.id === state.userClubId ? 'win' : 'loss';
  }

  const templates = newsData.matchHeadlines[category] || newsData.matchHeadlines.win;
  const seed = deriveSeed(201, `${fixId}_news_${state.matchday}`);
  const rng = createRng(seed);
  const picked = rng.pick(templates)!;

  const motmPlayer = result.motm ? state.players[result.motm] : null;
  const starPlayer = hatTrickPlayerId
    ? state.players[hatTrickPlayerId]
    : lateGoalPlayerId
      ? state.players[lateGoalPlayerId]
      : motmPlayer;

  const playerName = starPlayer ? `${starPlayer.firstName} ${starPlayer.lastName}` : 'The team';
  const managerName = winnerClub.managerName || 'The manager';
  const scoreStr = `${result.homeGoals}–${result.awayGoals}`;

  const tokens: Record<string, string> = {
    team: winnerClub.name,
    opponent: loserClub.name,
    player: playerName,
    score: scoreStr,
    minute: lateGoalMinute,
    manager: managerName,
    stadium: homeClub.stadium.name,
  };

  const headline = replaceTokens(picked.headline, tokens);
  const body = `${replaceTokens(picked.sub, tokens)} ${replaceTokens(picked.body, tokens)}`;

  return {
    id: `news_${fixId}_${state.matchday}`,
    matchday: state.matchday,
    headline,
    body,
    image: `images/news/${homeClub.id}_celebration.webp`,
    clubIds: [homeClub.id, awayClub.id],
    playerIds: starPlayer ? [starPlayer.id] : [],
  };
}

/**
 * Generates a NewsItem for a completed transfer.
 */
export function generateTransferNews(
  player: Player,
  fromClub: Club | null,
  toClub: Club,
  fee: number,
  isDeadlineDay: boolean,
  matchday: number,
): NewsItem {
  let templates = newsData.transferNews.mega_signing;
  if (isDeadlineDay) {
    templates = newsData.transferNews.deadline_day;
  } else if (!fromClub || fee === 0) {
    templates = newsData.transferNews.free_agent;
  } else if (fee >= 4_000_000) {
    templates = newsData.transferNews.mega_signing;
  } else {
    templates = newsData.transferNews.deadline_day;
  }

  const seed = deriveSeed(301, `${player.id}_${toClub.id}_${fee}_${matchday}`);
  const rng = createRng(seed);
  const picked = rng.pick(templates)!;

  const pName = `${player.firstName} ${player.lastName}`;
  const tokens: Record<string, string> = {
    team: toClub.name,
    opponent: fromClub ? fromClub.name : 'Free Agency',
    player: pName,
    fee: (fee / 1_000_000).toFixed(1) + 'M',
    stadium: toClub.stadium.name,
    manager: toClub.managerName || 'The manager',
  };

  const headline = replaceTokens(picked.headline, tokens);
  const body = `${replaceTokens(picked.sub, tokens)} ${replaceTokens(picked.body, tokens)}`;

  return {
    id: `news_trans_${player.id}_${Date.now()}_${rng.int(100, 999)}`,
    matchday,
    headline,
    body,
    image: `images/news/${toClub.id}_celebration.webp`,
    clubIds: fromClub ? [fromClub.id, toClub.id] : [toClub.id],
    playerIds: [player.id],
  };
}

/**
 * Generates a rival transfer rumour inbox item outside windows (1 per 3 weeks per SPEC §12.11).
 */
export function checkRivalRumour(state: GameState): InboxItem | null {
  // Only outside windows and once per 3 matchdays (e.g. matchday 3, 6, 12, 15)
  if (state.phase === 'TransferWindow' || state.matchday % 3 !== 0 || state.matchday === 0) {
    return null;
  }

  const userClub = state.clubs[state.userClubId];
  if (!userClub || userClub.rivals.length === 0) return null;

  const seed = deriveSeed(401, `rumour_md_${state.matchday}`);
  const rng = createRng(seed);

  // Pick a rival club
  const rivalId = rng.pick(userClub.rivals)!;
  const rivalClub = state.clubs[rivalId];
  if (!rivalClub) return null;

  // Pick a player from user club or another rival
  const userSquad = userClub.squad.map((id) => state.players[id]).filter(Boolean) as Player[];
  if (userSquad.length === 0) return null;
  const targetPlayer = rng.pick(userSquad)!;

  const templates = newsData.inboxTemplates.rumour;
  const picked = rng.pick(templates)!;

  const pName = `${targetPlayer.firstName} ${targetPlayer.lastName}`;
  const tokens = {
    team: userClub.name,
    opponent: rivalClub.name,
    player: pName,
    stadium: userClub.stadium.name,
  };

  return {
    id: `rumour_inbox_${state.matchday}_${targetPlayer.id}`,
    matchday: state.matchday,
    kind: 'Transfer',
    title: replaceTokens(picked.title, tokens),
    body: replaceTokens(picked.body, tokens),
    read: false,
    requiresAction: false,
  };
}
