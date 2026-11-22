// Pure module for Player Conversations (SPEC §12.9, §16.4)
// Evaluates triggers, handles reply resolution, and tracks promise progress/fulfillment.
import {
  Club,
  Player,
  PlayerId,
  Fixture,
  ActiveConversation,
  ConversationType,
  ConversationOpening,
  ConversationReplyOption,
  InboxItem,
  PlayerPromise,
} from '../types';
import { Rng } from '../rng';
import conversationsData from '../../content/conversations.json';
import { clamp, roundTo } from '../math';

export interface ConversationResolution {
  updatedPlayer: Player;
  playerReaction: string;
  feedback: string;
  inboxNotice: InboxItem;
}

export interface PromiseCheckResult {
  updatedPlayers: Record<PlayerId, Player>;
  notifications: InboxItem[];
}

/**
 * Checks if any player at the user's club triggers a conversation at WeekSummary.
 * Per SPEC §12.9: At most 1 new conversation per week.
 */
export function checkConversationTriggers(
  club: Club,
  players: Record<PlayerId, Player>,
  fixtures: Fixture[],
  currentMatchday: number,
  conversationsHistory: string[],
  rng: Rng | (() => number),
): { conversation: ActiveConversation; inboxItem: InboxItem } | null {
  const nextFloat = typeof rng === 'function' ? rng : () => rng.next();
  const clubPlayers = Object.values(players).filter((p) => p.clubId === club.id);
  if (clubPlayers.length === 0) return null;

  // Recent completed fixtures for this club
  const completedClubFixtures = fixtures.filter(
    (f) => f.result !== null && (f.homeId === club.id || f.awayId === club.id),
  );
  const matchCount = completedClubFixtures.length;

  type Candidate = {
    player: Player;
    type: ConversationType;
    priority: number;
  };

  const candidates: Candidate[] = [];

  for (const player of clubPlayers) {
    const isFit = player.injury === null;

    // 1. Playing time: role Star/Starter or promisedRole Starter, started < 50% of the last 4 matches while fit -> 60% chance
    const role = player.contract?.role;
    const promisedRole = player.contract?.promisedRole;
    const isKeyRole = role === 'Star' || role === 'Starter' || promisedRole === 'Starter';

    if (isKeyRole && isFit && matchCount >= 2) {
      const startRatio = player.stats.starts / matchCount;
      if (startRatio < 0.5) {
        if (nextFloat() < 0.6) {
          candidates.push({ player, type: 'playing_time', priority: 4 });
          continue; // One trigger per player
        }
      }
    }

    // 2. Unhappy morale: morale < 30 -> 40% chance
    if (player.morale < 30) {
      if (nextFloat() < 0.4) {
        candidates.push({ player, type: 'unhappy', priority: 3 });
        continue;
      }
    }

    // 3. New contract: Ambitious or growth >= 3 this season and yearsLeft = 1 -> 30% chance
    const yearsLeft = player.contract?.yearsLeft ?? 2;
    if (yearsLeft === 1 && (player.personality === 'Ambitious' || player.growth >= 3)) {
      if (nextFloat() < 0.3) {
        candidates.push({ player, type: 'contract', priority: 2 });
        continue;
      }
    }

    // 4. Praise form: avg rating >= 7.5 over last 3 matches -> 20% chance
    if (player.form && player.form.length >= 3) {
      const last3 = player.form.slice(-3);
      const avgLast3 = last3.reduce((a, b) => a + b, 0) / 3;
      if (avgLast3 >= 7.5) {
        if (nextFloat() < 0.2) {
          candidates.push({ player, type: 'praise', priority: 1 });
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  // Sort by priority descending, then randomize among ties
  candidates.sort((a, b) => b.priority - a.priority || nextFloat() - 0.5);
  const chosen = candidates[0]!;

  // Pick opening from content
  const typeData = (conversationsData as any)[chosen.type];
  if (!typeData || !typeData.openings || typeData.openings.length === 0) return null;

  const openings = typeData.openings as ConversationOpening[];
  // Prefer openings not in conversationsHistory
  const unreadOpenings = openings.filter((o) => !conversationsHistory.includes(o.id));
  const pool = unreadOpenings.length > 0 ? unreadOpenings : openings;
  const openingTemplate = pool[Math.floor(nextFloat() * pool.length)]!;

  const playerName = chosen.player.lastName;
  const clubName = club.name;

  // Substitute tokens in text
  const opening: ConversationOpening = {
    id: openingTemplate.id,
    text: openingTemplate.text.replace(/{player}/g, playerName).replace(/{club}/g, clubName),
    voText: openingTemplate.voText,
    replies: openingTemplate.replies.map((rep) => ({
      ...rep,
      text: rep.text.replace(/{player}/g, playerName).replace(/{club}/g, clubName),
      playerReaction: rep.playerReaction
        .replace(/{player}/g, playerName)
        .replace(/{club}/g, clubName),
    })),
  };

  const activeConv: ActiveConversation = {
    id: `conv_${chosen.player.id}_md${currentMatchday}`,
    type: chosen.type,
    playerId: chosen.player.id,
    opening,
  };

  const typeLabels: Record<ConversationType, string> = {
    playing_time: 'playing time and team role',
    contract: 'his contract situation',
    unhappy: 'his morale and squad happiness',
    praise: 'his outstanding recent performances',
  };

  const inboxItem: InboxItem = {
    id: `inbox_${activeConv.id}`,
    matchday: currentMatchday,
    kind: 'Player',
    title: `${chosen.player.lastName}: Knock at the door`,
    body: `"${opening.text}" — ${chosen.player.firstName} ${chosen.player.lastName} has asked to speak with you regarding ${typeLabels[chosen.type]}.`,
    read: false,
    requiresAction: true,
    action: {
      type: 'conversation',
      refId: activeConv.id,
    },
  };

  return { conversation: activeConv, inboxItem };
}

/**
 * Applies the chosen manager reply to the active conversation.
 */
export function applyConversationReply(
  player: Player,
  club: Club,
  conversation: ActiveConversation,
  replyId: string,
  matchday: number,
): ConversationResolution | null {
  const reply = conversation.opening.replies.find((r) => r.id === replyId);
  if (!reply) return null;

  const nextPlayer: Player = JSON.parse(JSON.stringify(player));

  // Morale effect
  nextPlayer.morale = clamp(nextPlayer.morale + reply.moraleDelta, 0, 100);

  // Transfer listing
  if (reply.transferList) {
    nextPlayer.transferListed = true;
  }

  // Contract extension
  if (reply.contractRenewal && nextPlayer.contract) {
    nextPlayer.contract.yearsLeft = 3;
    nextPlayer.contract.wagePerWeek =
      Math.round((nextPlayer.contract.wagePerWeek * 1.2) / 500) * 500;
  }

  // Promise creation
  if (reply.promise) {
    nextPlayer.promise = {
      kind: 'Starter',
      matchesRemaining: reply.promise.matches,
      startsCount: 0,
      targetStarts: reply.promise.targetStarts,
    };
    if (nextPlayer.contract) {
      nextPlayer.contract.promisedRole = 'Starter';
    }
  }

  const feedbackParts: string[] = [];
  if (reply.moraleDelta !== 0) {
    feedbackParts.push(
      `Morale ${reply.moraleDelta > 0 ? '+' : ''}${reply.moraleDelta} (${nextPlayer.morale}%)`,
    );
  }
  if (reply.promise) {
    feedbackParts.push(
      `Promised ${reply.promise.targetStarts} starts in next ${reply.promise.matches} matches`,
    );
  }
  if (reply.contractRenewal) {
    feedbackParts.push('Contract extended through next 3 years (+20% wage)');
  }
  if (reply.transferList) {
    feedbackParts.push('Placed on transfer list');
  }

  const feedback = feedbackParts.join(' · ');

  const inboxNotice: InboxItem = {
    id: `inbox_resolved_${conversation.id}`,
    matchday,
    kind: 'Player',
    title: `${player.lastName}: Conversation resolved`,
    body: `You spoke with ${player.firstName} ${player.lastName}. Response: "${reply.playerReaction}". Result: ${feedback}.`,
    read: true,
    requiresAction: false,
  };

  return {
    updatedPlayer: nextPlayer,
    playerReaction: reply.playerReaction,
    feedback,
    inboxNotice,
  };
}

/**
 * Checks active promises after a match has completed and updates/resolves them.
 * Per SPEC §12.9: Broken promise (< 50% of 4 matches) -> morale -15 and player asks to be transfer listed.
 */
export function evaluatePromisesAfterMatch(
  players: Record<PlayerId, Player>,
  userClubId: string,
  userStartingLineupIds: (PlayerId | null)[],
  currentMatchday: number,
): PromiseCheckResult {
  const updatedPlayers: Record<PlayerId, Player> = { ...players };
  const notifications: InboxItem[] = [];

  for (const [id, player] of Object.entries(players)) {
    if (player.clubId !== userClubId || !player.promise) continue;

    const promise = { ...player.promise };
    const started = userStartingLineupIds.includes(player.id);
    if (started) {
      promise.startsCount += 1;
    }
    promise.matchesRemaining -= 1;

    const nextPlayer = { ...player };

    if (promise.matchesRemaining <= 0) {
      // Promise window concluded
      if (promise.startsCount < promise.targetStarts) {
        // Promise broken!
        nextPlayer.morale = Math.max(0, nextPlayer.morale - 15);
        nextPlayer.transferListed = true;
        nextPlayer.promise = null;

        notifications.push({
          id: `inbox_promise_broken_${player.id}_md${currentMatchday}`,
          matchday: currentMatchday,
          kind: 'Player',
          title: `Broken promise: ${player.lastName}`,
          body: `${player.firstName} ${player.lastName} is furious after starting only ${promise.startsCount} of the agreed ${promise.targetStarts} matches. He has demanded to be placed on the transfer list (morale -15).`,
          read: false,
          requiresAction: false,
        });
      } else {
        // Promise kept!
        nextPlayer.morale = Math.min(100, nextPlayer.morale + 10);
        nextPlayer.promise = null;

        notifications.push({
          id: `inbox_promise_kept_${player.id}_md${currentMatchday}`,
          matchday: currentMatchday,
          kind: 'Player',
          title: `Promise kept: ${player.lastName}`,
          body: `${player.firstName} ${player.lastName} is delighted with his regular starting role and thanked you for keeping your word (morale +10).`,
          read: false,
          requiresAction: false,
        });
      }
    } else {
      nextPlayer.promise = promise;
    }

    updatedPlayers[id] = nextPlayer;
  }

  return { updatedPlayers, notifications };
}
