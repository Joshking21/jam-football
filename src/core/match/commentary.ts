import commentaryData from '../../content/commentary.json';
import { MatchEvent, Player } from '../types';

export interface CommentaryLine {
  id: string;
  key: string;
  voice: string;
  text: string;
  voText: string;
  nameSlot: string;
  intensity: number;
  tags?: string[];
}

const linesByKey: Record<string, CommentaryLine[]> = {};
for (const line of commentaryData.lines as CommentaryLine[]) {
  if (!linesByKey[line.key]) {
    linesByKey[line.key] = [];
  }
  linesByKey[line.key]!.push(line);
}

export function resolveCommentary(
  event: MatchEvent,
  players?: Record<string, Player>,
  options?: {
    weather?: string;
    isDerby?: boolean;
    homeScore?: number;
    awayScore?: number;
  },
): { text: string; importance: number } | null {
  let key: string | null = null;
  switch (event.type) {
    case 'KICKOFF':
      key = 'KICKOFF';
      break;
    case 'PASS':
    case 'PASS_FAIL':
      key = 'PASS_RUN';
      break;
    case 'LONG_BALL':
      key = 'LONG_BALL';
      break;
    case 'DRIBBLE':
    case 'DRIBBLE_FAIL':
      key = 'DRIBBLE';
      break;
    case 'TACKLE':
      key = 'TACKLE';
      break;
    case 'INTERCEPTION':
      key = 'INTERCEPTION';
      break;
    case 'CROSS':
      key = 'CROSS';
      break;
    case 'AERIAL_DUEL':
      key = 'HEADER';
      break;
    case 'THROUGH_BALL':
      key = 'THROUGH_BALL';
      break;
    case 'OFFSIDE':
      key = 'OFFSIDE';
      break;
    case 'SAVE':
      key = 'SHOT_SAVE';
      break;
    case 'MISS':
      key = 'SHOT_MISS';
      break;
    case 'BLOCK':
      key = 'SHOT_BLOCK';
      break;
    case 'POST':
      key = 'POST';
      break;
    case 'GOAL': {
      const sCtx = event.shot?.context;
      if (sCtx === 'HEADER') key = 'GOAL_HEADER';
      else if (sCtx === 'PENALTY') key = 'GOAL_PENALTY';
      else if (sCtx === 'OUTSIDE_CENTRAL' || sCtx === 'OUTSIDE_WIDE') key = 'GOAL_LONG_RANGE';
      else key = 'GOAL';
      break;
    }
    case 'PENALTY_AWARDED':
      key = 'PENALTY_AWARDED';
      break;
    case 'FREE_KICK':
      key = 'FREE_KICK';
      break;
    case 'CORNER':
      key = 'CORNER';
      break;
    case 'FOUL':
      key = 'FOUL';
      break;
    case 'YELLOW':
      key = 'YELLOW';
      break;
    case 'RED':
      key = 'RED';
      break;
    case 'INJURY':
      key = 'INJURY';
      break;
    case 'SUB':
      key = 'SUB';
      break;
    case 'HALF_TIME':
      key = 'HALF_TIME';
      break;
    case 'FULL_TIME': {
      const hs = options?.homeScore ?? 0;
      const as = options?.awayScore ?? 0;
      if (hs > as) key = 'FULL_TIME_WIN_HOME';
      else if (as > hs) key = 'FULL_TIME_WIN_AWAY';
      else key = 'FULL_TIME_DRAW';
      break;
    }
    case 'ADDED_TIME':
      key = 'ADDED_TIME';
      break;
    default:
      return null;
  }

  const pool = linesByKey[key];
  if (!pool || pool.length === 0) return null;

  // Filter or prioritize tags
  const matchedLines = pool.filter((l) => {
    if (!l.tags || l.tags.length === 0) return true;
    if (options?.weather && l.tags.includes(options.weather)) return true;
    if (options?.isDerby && l.tags.includes('derby')) return true;
    return false;
  });

  const candidates = matchedLines.length > 0 ? matchedLines : pool;
  const chosen = candidates[event.seq % candidates.length]!;

  let text = chosen.text;
  if (text.includes('{player}')) {
    const targetPlayerId = event.playerId || event.targetId || event.opponentId;
    const playerObj = targetPlayerId && players ? players[targetPlayerId] : null;
    const name = playerObj
      ? playerObj.knownAs || playerObj.lastName || `${playerObj.firstName} ${playerObj.lastName}`
      : 'The player';
    text = text.replace('{player}', name);
  }

  return {
    text,
    importance: chosen.intensity ?? event.importance ?? 0,
  };
}
