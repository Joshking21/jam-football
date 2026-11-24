// Implements SPEC §15 Assistant coach advice engine (Theo Vance)
import assistantData from '../../content/assistant.json';
import { BALANCE } from '../../config/balance';
import { rawOvr } from '../player/ratings';
import { Rng } from '../rng';
import {
  Club,
  Formation,
  MatchEvent,
  MatchResult,
  MatchResultSummary,
  Player,
  PlayerId,
  Position,
  RoleId,
  SetPieceTactics,
  ShoutId,
  Side,
  TeamInstructions,
  TeamMatchStats,
  TeamSheet,
  TrainingTemplateId,
} from '../types';

export type AdviceAction =
  | { type: 'setInstructions'; instructions: Partial<TeamInstructions> }
  | { type: 'setFormation'; formation: Formation }
  | { type: 'setPlayerRole'; slot: number; role: RoleId }
  | { type: 'substitute'; outId: PlayerId; inId: PlayerId }
  | { type: 'setTrainingTemplate'; templateId: TrainingTemplateId }
  | { type: 'restPlayer'; playerId: PlayerId }
  | { type: 'openConversation'; playerId: PlayerId }
  | { type: 'setSetPieces'; changes: Partial<SetPieceTactics> }
  | { type: 'issueShout'; shout: ShoutId }
  | { type: 'applyPlanB' };

export interface Advice {
  id: string;
  ruleId: string;
  priority: 1 | 2 | 3;
  text: string;
  reason: string;
  apply?: AdviceAction;
  playerId?: PlayerId;
}

export interface PreMatchAdviceContext {
  kind: 'preMatch';
  userClub: Club;
  oppClub: Club;
  players: Record<PlayerId, Player>;
}

export interface WeekAdviceContext {
  kind: 'week';
  userClub: Club;
  players: Record<PlayerId, Player>;
  matchday: number;
}

export interface InMatchAdviceContext {
  kind: 'inMatch';
  currentT: number;
  minute: number;
  ourSide: Side;
  ourScore: number;
  oppScore: number;
  ourInstructions: TeamInstructions;
  ourLineup: (PlayerId | null)[];
  ourBench: PlayerId[];
  ourRoles: (RoleId | undefined)[];
  subsUsed: number;
  windowsUsed: number;
  liveCondition: Record<PlayerId, number>;
  ourYellows: Record<PlayerId, number>;
  events: MatchEvent[];
  players: Record<PlayerId, Player>;
  oppSheet: TeamSheet;
  firedHistory: Record<string, number>;
  totalFiredInMatch: number;
}

export interface HalfTimeAdviceContext {
  kind: 'halfTime';
  ourSide: Side;
  homeStats: TeamMatchStats;
  awayStats: TeamMatchStats;
  events: MatchEvent[];
  ourLineup: (PlayerId | null)[];
  ourBench: PlayerId[];
  ourRatings: Record<PlayerId, number>;
  oppSheet: TeamSheet;
  players: Record<PlayerId, Player>;
  inMatchContext?: InMatchAdviceContext;
}

export interface PostMatchAdviceContext {
  kind: 'postMatch';
  userClub: Club;
  oppClub: Club;
  isHome: boolean;
  result: MatchResult | MatchResultSummary;
  players: Record<PlayerId, Player>;
}

export type AdviceContext =
  | PreMatchAdviceContext
  | WeekAdviceContext
  | InMatchAdviceContext
  | HalfTimeAdviceContext
  | PostMatchAdviceContext;

type RuleTemplate = {
  variants: string[];
  reason: string;
};

const RULES = assistantData.rules as Record<string, RuleTemplate>;

function playerName(p: Player | undefined): string {
  if (!p) return 'Player';
  return p.knownAs ?? p.lastName;
}

function renderRule(
  ruleId: string,
  rng: Rng,
  tokens: Record<string, string> = {},
  fallbackText = '',
  fallbackReason = '',
): { text: string; reason: string } {
  const tmpl = RULES[ruleId];
  let text = tmpl && tmpl.variants.length > 0 ? rng.pick(tmpl.variants) : fallbackText;
  let reason = tmpl ? tmpl.reason : fallbackReason;

  for (const [k, v] of Object.entries(tokens)) {
    const pattern = new RegExp(`\\{${k}\\}`, 'g');
    text = text.replace(pattern, v);
    reason = reason.replace(pattern, v);
  }
  return { text, reason };
}

function getLineGroup(pos: Position): 'GK' | 'DEF' | 'MID' | 'FWD' {
  if (pos === 'GK') return 'GK';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'DEF';
  if (['ST', 'LW', 'RW'].includes(pos)) return 'FWD';
  return 'MID';
}

function findBestLikeForLikeSub(
  outId: PlayerId,
  bench: PlayerId[],
  players: Record<PlayerId, Player>,
): PlayerId | null {
  const outP = players[outId];
  const outPos = outP?.positions[0]?.pos ?? 'CM';
  const outGroup = getLineGroup(outPos);

  const candidates = bench
    .map((id) => players[id])
    .filter((p): p is Player => p != null && p.injury === null);

  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort((a, b) => {
    const aPos = a.positions[0]?.pos ?? 'CM';
    const bPos = b.positions[0]?.pos ?? 'CM';
    const aExact = a.positions.some((p) => p.pos === outPos)
      ? 2
      : getLineGroup(aPos) === outGroup
        ? 1
        : 0;
    const bExact = b.positions.some((p) => p.pos === outPos)
      ? 2
      : getLineGroup(bPos) === outGroup
        ? 1
        : 0;
    if (aExact !== bExact) return bExact - aExact;
    return rawOvr(b.attributes, bPos) - rawOvr(a.attributes, aPos);
  });

  return sorted[0]?.id ?? null;
}

function getStarters(club: Club, players: Record<PlayerId, Player>): Player[] {
  return club.tactics.lineup
    .filter((id): id is string => Boolean(id))
    .map((id) => players[id])
    .filter((p): p is Player => p != null);
}

function avgTeamOvr(starters: Player[]): number {
  if (starters.length === 0) return 68;
  return (
    starters.reduce((sum, p) => sum + rawOvr(p.attributes, p.positions[0]?.pos ?? 'CM'), 0) /
    starters.length
  );
}

/**
 * §15.2 Pre-match rules (opponent report): pick at most 3 highest priority first.
 */
export function advisePreMatch(ctx: PreMatchAdviceContext, rng: Rng): Advice[] {
  const { userClub, oppClub, players } = ctx;
  const cfg = BALANCE.assistant;
  const results: Advice[] = [];

  const userStarters = getStarters(userClub, players);
  const oppStarters = getStarters(oppClub, players);
  const oppStyle = oppClub.style ?? oppClub.tactics.instructions;

  const userAvgOvr = avgTeamOvr(userStarters);
  const oppAvgOvr = avgTeamOvr(oppStarters);

  const backLine = userStarters.filter((p) =>
    p.positions.some((pos) => ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos.pos)),
  );
  const backLinePaceAvg =
    backLine.length > 0
      ? backLine.reduce((s, p) => s + p.attributes.pace, 0) / backLine.length
      : 60;

  const forwards = userStarters.filter((p) =>
    p.positions.some((pos) => ['ST', 'LW', 'RW'].includes(pos.pos)),
  );
  const bestPaceFwd = [...forwards].sort((a, b) => b.attributes.pace - a.attributes.pace)[0];

  // 1. Opponent avg OVR >= ours + 4 -> Stay compact
  if (oppAvgOvr >= userAvgOvr + cfg.preOvrGapThreshold) {
    const msg = renderRule('pre_stay_compact', rng);
    results.push({
      id: 'pre_stay_compact',
      ruleId: 'pre_stay_compact',
      priority: 1,
      text: msg.text,
      reason: msg.reason,
      apply: {
        type: 'setInstructions',
        instructions: { mentality: 'Defensive', line: 'Deep', pressing: 'Mid' },
      },
    });
  } else if (oppAvgOvr <= userAvgOvr - cfg.preOvrGapThreshold) {
    // 2. Opponent avg OVR <= ours - 4 -> Take the game to them
    const msg = renderRule('pre_take_game', rng);
    results.push({
      id: 'pre_take_game',
      ruleId: 'pre_take_game',
      priority: 2,
      text: msg.text,
      reason: msg.reason,
      apply: {
        type: 'setInstructions',
        instructions: { mentality: 'Attacking' },
      },
    });
  }

  // 3. Opponent line High and our best forward pace >= 75
  if (
    oppStyle.line === 'High' &&
    bestPaceFwd &&
    bestPaceFwd.attributes.pace >= cfg.preForwardPaceThreshold
  ) {
    const pos = bestPaceFwd.positions[0]?.pos ?? 'ST';
    const lane: 'Left' | 'Right' | 'Centre' =
      pos === 'LW' ? 'Left' : pos === 'RW' ? 'Right' : 'Centre';
    const msg = renderRule('pre_go_in_behind', rng, {
      player: playerName(bestPaceFwd),
      lane,
    });
    results.push({
      id: 'pre_go_in_behind',
      ruleId: 'pre_go_in_behind',
      priority: 1,
      text: msg.text,
      reason: msg.reason,
      playerId: bestPaceFwd.id,
      apply: {
        type: 'setInstructions',
        instructions: { passing: 'Direct', focus: lane },
      },
    });
  }

  // 4. Opponent pressing High and our back line pace avg >= 65
  if (oppStyle.pressing === 'High' && backLinePaceAvg >= cfg.preBackLinePaceThreshold) {
    const msg = renderRule('pre_play_out_quick', rng);
    results.push({
      id: 'pre_play_out_quick',
      ruleId: 'pre_play_out_quick',
      priority: 2,
      text: msg.text,
      reason: msg.reason,
      apply: {
        type: 'setInstructions',
        instructions: { passing: 'Mixed', tempo: 'Fast' },
      },
    });
  }

  // 5. Opponent's weakest defender on side X -> Attack their {lane}
  const oppDefenders = oppStarters.filter((p) =>
    p.positions.some((pos) => ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos.pos)),
  );
  if (oppDefenders.length > 0) {
    const weakest = [...oppDefenders].sort(
      (a, b) =>
        rawOvr(a.attributes, a.positions[0]?.pos ?? 'CB') -
        rawOvr(b.attributes, b.positions[0]?.pos ?? 'CB'),
    )[0]!;
    const wPos = weakest.positions[0]?.pos ?? 'CB';
    // Their RB is on our Left; their LB is on our Right
    const attackLane: 'Left' | 'Right' | 'Centre' =
      wPos === 'RB' || wPos === 'RWB'
        ? 'Left'
        : wPos === 'LB' || wPos === 'LWB'
          ? 'Right'
          : 'Centre';
    const laneLabel =
      attackLane === 'Left'
        ? 'left flank'
        : attackLane === 'Right'
          ? 'right flank'
          : 'central defence';
    const msg = renderRule('pre_attack_weak_side', rng, {
      lane: laneLabel,
      player: playerName(weakest),
    });
    results.push({
      id: 'pre_attack_weak_side',
      ruleId: 'pre_attack_weak_side',
      priority: 2,
      text: msg.text,
      reason: msg.reason,
      apply: {
        type: 'setInstructions',
        instructions: { focus: attackLane },
      },
    });
  }

  // 6. Our CBs heading avg >= 72 and opponent crosses-heavy (Width Wide)
  const ourCbs = userStarters.filter((p) => p.positions.some((pos) => pos.pos === 'CB'));
  const cbHeadingAvg =
    ourCbs.length > 0 ? ourCbs.reduce((s, p) => s + p.attributes.heading, 0) / ourCbs.length : 60;
  if (cbHeadingAvg >= cfg.preCbHeadingThreshold && oppStyle.width === 'Wide') {
    const msg = renderRule('pre_cb_reassure', rng);
    results.push({
      id: 'pre_cb_reassure',
      ruleId: 'pre_cb_reassure',
      priority: 3,
      text: msg.text,
      reason: msg.reason,
    });
  }

  return results.sort((a, b) => a.priority - b.priority).slice(0, cfg.preMatchMaxAdvices);
}

/**
 * §15.3 Week tips (Hub and inbox): one tip per week, first matching rule.
 */
export function adviseWeek(ctx: WeekAdviceContext, rng: Rng): Advice[] {
  const { userClub, players, matchday } = ctx;
  const cfg = BALANCE.assistant;
  const squad = userClub.squad.map((id) => players[id]).filter((p): p is Player => p != null);

  // 1. Player with fatigue > 80 -> Rest {player}
  const exhausted = [...squad]
    .filter((p) => p.fatigue > cfg.weekFatigueThreshold && p.injury === null)
    .sort((a, b) => b.fatigue - a.fatigue)[0];
  if (exhausted) {
    const msg = renderRule('week_rest', rng, { player: playerName(exhausted) });
    return [
      {
        id: `week_rest_${matchday}_${exhausted.id}`,
        ruleId: 'week_rest',
        priority: 1,
        text: msg.text,
        reason: msg.reason,
        playerId: exhausted.id,
        apply: { type: 'restPlayer', playerId: exhausted.id },
      },
    ];
  }

  // 2. Formation familiarity < 50 -> Train Tactical
  const currentForm = userClub.tactics.formation;
  const fam = userClub.formationFamiliarity?.[currentForm] ?? 70;
  if (fam < cfg.weekFamiliarityThreshold) {
    const msg = renderRule('week_train_tactical', rng);
    return [
      {
        id: `week_train_tactical_${matchday}`,
        ruleId: 'week_train_tactical',
        priority: 1,
        text: msg.text,
        reason: msg.reason,
        apply: { type: 'setTrainingTemplate', templateId: 'tactical' },
      },
    ];
  }

  // 3. >= 3 players condition < 70 before a match -> Light training this week
  const lowCondCount = squad.filter(
    (p) => p.injury === null && p.condition < cfg.weekTiredConditionThreshold,
  ).length;
  if (lowCondCount >= cfg.weekTiredCountThreshold) {
    const msg = renderRule('week_light_training', rng);
    return [
      {
        id: `week_light_training_${matchday}`,
        ruleId: 'week_light_training',
        priority: 2,
        text: msg.text,
        reason: msg.reason,
        apply: { type: 'setTrainingTemplate', templateId: 'recovery' },
      },
    ];
  }

  // 4. An unhappy Star/Starter -> Talk to {player}
  const unhappyStar = squad.find(
    (p) =>
      p.morale < cfg.weekUnhappyMoraleThreshold &&
      (p.contract?.role === 'Star' || p.contract?.role === 'Starter'),
  );
  if (unhappyStar) {
    const msg = renderRule('week_talk_unhappy', rng, { player: playerName(unhappyStar) });
    return [
      {
        id: `week_talk_unhappy_${matchday}_${unhappyStar.id}`,
        ruleId: 'week_talk_unhappy',
        priority: 2,
        text: msg.text,
        reason: msg.reason,
        playerId: unhappyStar.id,
        apply: { type: 'openConversation', playerId: unhappyStar.id },
      },
    ];
  }

  // 5. Prospect with potential >= 78 and < 2 apps -> Give {player} minutes
  const prospect = squad.find(
    (p) =>
      p.age <= 21 &&
      p.potential >= cfg.weekProspectPotentialThreshold &&
      p.stats.apps < cfg.weekProspectMaxApps &&
      p.injury === null,
  );
  if (prospect) {
    const msg = renderRule('week_give_minutes', rng, { player: playerName(prospect) });
    return [
      {
        id: `week_give_minutes_${matchday}_${prospect.id}`,
        ruleId: 'week_give_minutes',
        priority: 2,
        text: msg.text,
        reason: msg.reason,
        playerId: prospect.id,
      },
    ];
  }

  // 6. Positive note
  const msg = renderRule('week_positive', rng);
  return [
    {
      id: `week_positive_${matchday}`,
      ruleId: 'week_positive',
      priority: 3,
      text: msg.text,
      reason: msg.reason,
    },
  ];
}

/**
 * §15.4 In-match rules: evaluated every 5 match minutes from the last 15 minutes of events.
 * Returns at most 1 new advice per call; respects 6-per-match cap and 20-minute per-rule cooldown.
 */
export function adviseInMatch(ctx: InMatchAdviceContext, rng: Rng): Advice[] {
  const cfg = BALANCE.assistant;
  if (ctx.totalFiredInMatch >= cfg.inMatchMaxPerMatch) return [];

  const canFire = (ruleId: string): boolean => {
    const lastMin = ctx.firedHistory[ruleId];
    if (lastMin === undefined) return true;
    return ctx.minute - lastMin >= cfg.inMatchRepeatCooldownMin;
  };

  const windowStart = Math.max(0, ctx.currentT - cfg.inMatchWindowSec);
  const windowEvents = ctx.events.filter((e) => e.t >= windowStart && e.t <= ctx.currentT);
  const oppSide: Side = ctx.ourSide === 'home' ? 'away' : 'home';
  const subsLeft = ctx.subsUsed < 5 && ctx.windowsUsed < 3 && ctx.ourBench.length > 0;

  const candidates: Advice[] = [];

  // 1. Tired player: condition < 58 and subs left
  if (subsLeft && canFire('im_tired_player')) {
    const tiredId = ctx.ourLineup.find(
      (id) => id != null && (ctx.liveCondition[id] ?? 100) < cfg.inMatchTiredPlayerCondition,
    );
    if (tiredId) {
      const subId = findBestLikeForLikeSub(tiredId, ctx.ourBench, ctx.players);
      if (subId) {
        const p = ctx.players[tiredId];
        const msg = renderRule('im_tired_player', rng, { player: playerName(p) });
        candidates.push({
          id: `im_tired_player_${ctx.minute}`,
          ruleId: 'im_tired_player',
          priority: 1,
          text: msg.text,
          reason: msg.reason,
          playerId: tiredId,
          apply: { type: 'substitute', outId: tiredId, inId: subId },
        });
      }
    }
  }

  // 2. Yellow risk: player on a yellow committed >= 2 more fouls in window
  if (subsLeft && canFire('im_yellow_risk')) {
    const bookedIds = ctx.ourLineup.filter(
      (id): id is string => id != null && (ctx.ourYellows[id] ?? 0) >= 1,
    );
    for (const bId of bookedIds) {
      const yellowEvent = ctx.events.find(
        (e) => e.type === 'YELLOW' && e.side === ctx.ourSide && e.playerId === bId,
      );
      const afterYellowT = yellowEvent ? yellowEvent.t : windowStart;
      const foulsAfter = ctx.events.filter(
        (e) =>
          e.type === 'FOUL' &&
          e.side === ctx.ourSide &&
          e.playerId === bId &&
          e.t > afterYellowT &&
          e.t <= ctx.currentT,
      ).length;
      if (foulsAfter >= cfg.inMatchYellowExtraFouls) {
        const subId = findBestLikeForLikeSub(bId, ctx.ourBench, ctx.players);
        if (subId) {
          const msg = renderRule('im_yellow_risk', rng, { player: playerName(ctx.players[bId]) });
          candidates.push({
            id: `im_yellow_risk_${ctx.minute}`,
            ruleId: 'im_yellow_risk',
            priority: 1,
            text: msg.text,
            reason: msg.reason,
            playerId: bId,
            apply: { type: 'substitute', outId: bId, inId: subId },
          });
          break;
        }
      }
    }
  }

  // 3. Losing at 70'+ -> Need a goal
  if (
    ctx.minute >= cfg.inMatchNeedGoalMinute &&
    ctx.ourScore < ctx.oppScore &&
    canFire('im_need_goal')
  ) {
    if (
      ctx.ourInstructions.mentality !== 'Attacking' &&
      ctx.ourInstructions.mentality !== 'VeryAttacking'
    ) {
      const msg = renderRule('im_need_goal', rng);
      candidates.push({
        id: `im_need_goal_${ctx.minute}`,
        ruleId: 'im_need_goal',
        priority: 1,
        text: msg.text,
        reason: msg.reason,
        apply: {
          type: 'setInstructions',
          instructions: { mentality: 'Attacking', tempo: 'Fast' },
        },
      });
    }
  }

  // 4. Winning by 1 at 80'+ -> See it out
  if (
    ctx.minute >= cfg.inMatchSeeItOutMinute &&
    ctx.ourScore - ctx.oppScore === 1 &&
    canFire('im_see_it_out')
  ) {
    if (
      ctx.ourInstructions.mentality !== 'Defensive' &&
      ctx.ourInstructions.mentality !== 'VeryDefensive'
    ) {
      const msg = renderRule('im_see_it_out', rng);
      candidates.push({
        id: `im_see_it_out_${ctx.minute}`,
        ruleId: 'im_see_it_out',
        priority: 1,
        text: msg.text,
        reason: msg.reason,
        apply: {
          type: 'setInstructions',
          instructions: { mentality: 'Defensive', tempo: 'Slow' },
        },
      });
    }
  }

  // 5. Flank exposed: >= 50% of opp ATT-third entries through one flank and >= 3 shots from it
  if (canFire('im_flank_exposed')) {
    const oppAttacks = windowEvents.filter((e) => {
      const p = e.to ?? e.from;
      return (
        e.side === oppSide &&
        p &&
        p.x >= 70 &&
        (e.type === 'DRIBBLE' ||
          e.type === 'CROSS' ||
          e.type === 'SHOT' ||
          e.type === 'GOAL' ||
          e.type === 'PASS')
      );
    });
    const leftCount = oppAttacks.filter((e) => ((e.to ?? e.from)?.y ?? 34) < 23).length;
    const rightCount = oppAttacks.filter((e) => ((e.to ?? e.from)?.y ?? 34) > 45).length;
    const oppShots = windowEvents.filter(
      (e) => e.side === oppSide && (e.type === 'SHOT' || e.type === 'GOAL'),
    );
    const leftShots = oppShots.filter((e) => ((e.to ?? e.from)?.y ?? 34) < 23).length;
    const rightShots = oppShots.filter((e) => ((e.to ?? e.from)?.y ?? 34) > 45).length;

    const totalAtt = oppAttacks.length;
    let exposedSide: 'Left' | 'Right' | null = null;
    if (
      totalAtt >= 4 &&
      leftCount / totalAtt >= cfg.inMatchFlankEntryShare &&
      leftShots >= cfg.inMatchFlankMinShots
    ) {
      exposedSide = 'Left';
    } else if (
      totalAtt >= 4 &&
      rightCount / totalAtt >= cfg.inMatchFlankEntryShare &&
      rightShots >= cfg.inMatchFlankMinShots
    ) {
      exposedSide = 'Right';
    }

    if (exposedSide) {
      // Opponent's attack on y<23 (Left) faces our LB (or RB depending on coord, check both FB slots)
      const targetPos = exposedSide === 'Left' ? 'LB' : 'RB';
      const fbSlot = ctx.ourLineup.findIndex((id) => {
        if (!id) return false;
        return ctx.players[id]?.positions.some((p) => p.pos === targetPos);
      });
      const fbId = fbSlot >= 0 ? ctx.ourLineup[fbSlot] : null;
      const fb = fbId ? ctx.players[fbId] : undefined;
      const fbRole = fbSlot >= 0 ? ctx.ourRoles[fbSlot] : undefined;
      const laneText = exposedSide === 'Left' ? 'left flank' : 'right flank';
      const msg = renderRule('im_flank_exposed', rng, {
        lane: laneText,
        player: playerName(fb),
      });
      const action: AdviceAction =
        fbSlot >= 0 && fbRole !== 'fb_defensive'
          ? { type: 'setPlayerRole', slot: fbSlot, role: 'fb_defensive' }
          : { type: 'setInstructions', instructions: { width: 'Narrow' } };
      candidates.push({
        id: `im_flank_exposed_${ctx.minute}`,
        ruleId: 'im_flank_exposed',
        priority: 2,
        text: msg.text,
        reason: msg.reason,
        playerId: fbId ?? undefined,
        apply: action,
      });
    }
  }

  // 6. Pressing High and avg condition < 62 -> Drop the press
  if (ctx.ourInstructions.pressing === 'High' && canFire('im_drop_press')) {
    const activeIds = ctx.ourLineup.filter((id): id is string => id != null);
    const avgCond =
      activeIds.length > 0
        ? activeIds.reduce((s, id) => s + (ctx.liveCondition[id] ?? 100), 0) / activeIds.length
        : 100;
    if (avgCond < cfg.inMatchLowAvgCondition) {
      const msg = renderRule('im_drop_press', rng);
      candidates.push({
        id: `im_drop_press_${ctx.minute}`,
        ruleId: 'im_drop_press',
        priority: 2,
        text: msg.text,
        reason: msg.reason,
        apply: { type: 'setInstructions', instructions: { pressing: 'Mid' } },
      });
    }
  }

  // 7. Crosses >= 6 with success < 20% and their CB heading avg > our ST heading avg + 5
  if (canFire('im_keep_floor')) {
    const ourCrosses = windowEvents.filter((e) => e.side === ctx.ourSide && e.type === 'CROSS');
    if (ourCrosses.length >= cfg.inMatchMinCrosses) {
      const successfulCrosses = ourCrosses.filter((e) => e.shot || e.targetId).length;
      const crossRate = successfulCrosses / ourCrosses.length;
      const oppCbs = ctx.oppSheet.tactics.lineup
        .map((id) => (id ? ctx.oppSheet.players[id] : undefined))
        .filter(
          (p): p is NonNullable<typeof p> =>
            p != null && p.positions.some((pos) => pos.pos === 'CB'),
        );
      const ourSts = ctx.ourLineup
        .map((id) => (id ? ctx.players[id] : undefined))
        .filter((p): p is Player => p != null && p.positions.some((pos) => pos.pos === 'ST'));
      const oppCbHead =
        oppCbs.length > 0
          ? oppCbs.reduce((s, p) => s + p.attributes.heading, 0) / oppCbs.length
          : 65;
      const ourStHead =
        ourSts.length > 0
          ? ourSts.reduce((s, p) => s + p.attributes.heading, 0) / ourSts.length
          : 65;
      if (
        crossRate < cfg.inMatchMaxCrossSuccess &&
        oppCbHead > ourStHead + cfg.inMatchCbHeadingAdvantage
      ) {
        const msg = renderRule('im_keep_floor', rng);
        candidates.push({
          id: `im_keep_floor_${ctx.minute}`,
          ruleId: 'im_keep_floor',
          priority: 2,
          text: msg.text,
          reason: msg.reason,
          apply: {
            type: 'setInstructions',
            instructions: { width: 'Narrow', passing: 'Short' },
          },
        });
      }
    }
  }

  // 8. Opponent line High and we had >= 2 offsides -> Go direct
  if (ctx.oppSheet.tactics.instructions.line === 'High' && canFire('im_go_direct')) {
    const offsides = windowEvents.filter(
      (e) => e.side === ctx.ourSide && e.type === 'OFFSIDE',
    ).length;
    if (offsides >= cfg.inMatchMinOffsides && ctx.ourInstructions.passing !== 'Direct') {
      const msg = renderRule('im_go_direct', rng);
      candidates.push({
        id: `im_go_direct_${ctx.minute}`,
        ruleId: 'im_go_direct',
        priority: 2,
        text: msg.text,
        reason: msg.reason,
        apply: { type: 'setInstructions', instructions: { passing: 'Direct' } },
      });
    }
  }

  // 9. Possession < 35% over window and Passing Direct -> Calm it down
  if (ctx.ourInstructions.passing === 'Direct' && canFire('im_calm_down')) {
    const ourTouches = windowEvents.filter((e) => e.side === ctx.ourSide).length;
    const totalTouches = windowEvents.filter((e) => e.side === 'home' || e.side === 'away').length;
    if (totalTouches >= 15 && ourTouches / totalTouches < cfg.inMatchLowPossessionShare) {
      const msg = renderRule('im_calm_down', rng);
      candidates.push({
        id: `im_calm_down_${ctx.minute}`,
        ruleId: 'im_calm_down',
        priority: 3,
        text: msg.text,
        reason: msg.reason,
        apply: {
          type: 'setInstructions',
          instructions: { passing: 'Short', tempo: 'Slow' },
        },
      });
    }
  }

  if (candidates.length === 0) return [];
  candidates.sort((a, b) => a.priority - b.priority);
  return [candidates[0]!];
}

/**
 * §15.5 Half-time analysis: 2-3 bullets (xG/shots comparison, danger man, worst starter, optional §15.4 rule).
 */
export function adviseHalfTime(ctx: HalfTimeAdviceContext, rng: Rng): Advice[] {
  const {
    ourSide,
    homeStats,
    awayStats,
    events,
    ourLineup,
    ourBench,
    ourRatings,
    oppSheet,
    players,
  } = ctx;
  const ourStats = ourSide === 'home' ? homeStats : awayStats;
  const oppStats = ourSide === 'home' ? awayStats : homeStats;
  const oppSide: Side = ourSide === 'home' ? 'away' : 'home';

  const bullets: Advice[] = [];

  // 1. xG & Shots comparison
  const ourXg = ourStats.xg.toFixed(2);
  const oppXg = oppStats.xg.toFixed(2);
  const xgRule = renderRule('ht_xg', rng, { ourXg, oppXg });
  bullets.push({
    id: 'ht_xg',
    ruleId: 'ht_xg',
    priority: 2,
    text: `We've created ${ourXg} xG (${ourStats.shots} shots) to their ${oppXg} xG (${oppStats.shots} shots). ${xgRule.text}`,
    reason: xgRule.reason,
  });

  // 2. Most dangerous opposing player (most involvement in opp shots/goals)
  const oppInvolvement: Record<PlayerId, number> = {};
  for (const e of events) {
    if (e.side === oppSide && (e.type === 'SHOT' || e.type === 'GOAL' || e.type === 'PASS')) {
      if (e.playerId) {
        oppInvolvement[e.playerId] =
          (oppInvolvement[e.playerId] ?? 0) + (e.type === 'SHOT' || e.type === 'GOAL' ? 3 : 1);
      }
    }
  }
  const dangerId = Object.entries(oppInvolvement).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (dangerId && oppSheet.players[dangerId]) {
    const dp = players[dangerId];
    const msg = renderRule('ht_danger_man', rng, { player: playerName(dp) });
    bullets.push({
      id: 'ht_danger_man',
      ruleId: 'ht_danger_man',
      priority: 1,
      text: msg.text,
      reason: msg.reason,
      playerId: dangerId,
      apply: {
        type: 'setInstructions',
        instructions: { pressing: 'High' },
      },
    });
  }

  // 3. Worst-rated starter -> suggest sub
  const ratedStarters = ourLineup
    .filter((id): id is string => id != null)
    .map((id) => ({ id, rating: ourRatings[id] ?? 6.5 }))
    .sort((a, b) => a.rating - b.rating);
  const worst = ratedStarters[0];
  if (
    worst &&
    worst.rating < BALANCE.assistant.halfTimeWorstRatingThreshold &&
    ourBench.length > 0
  ) {
    const subId = findBestLikeForLikeSub(worst.id, ourBench, players);
    if (subId) {
      const msg = renderRule('ht_worst_starter', rng, { player: playerName(players[worst.id]) });
      bullets.push({
        id: 'ht_worst_starter',
        ruleId: 'ht_worst_starter',
        priority: 1,
        text: `${msg.text} (${worst.rating.toFixed(1)} rating)`,
        reason: msg.reason,
        playerId: worst.id,
        apply: { type: 'substitute', outId: worst.id, inId: subId },
      });
    }
  }

  // 4. Optional §15.4 rule if space (< 3 bullets)
  if (bullets.length < 3 && ctx.inMatchContext) {
    const extra = adviseInMatch(ctx.inMatchContext, rng);
    if (extra.length > 0) {
      bullets.push(extra[0]!);
    }
  }

  return bullets.slice(0, 3);
}

/**
 * §15.5 Post-match analysis: result vs expectation, best player, deciding stat, and training focus with Apply.
 */
export function advisePostMatch(
  ctx: PostMatchAdviceContext,
  rng: Rng,
): {
  summary: string;
  advices: Advice[];
  recommendedTraining: TrainingTemplateId;
  decisionStat: string;
} {
  const { userClub, oppClub, isHome, result, players } = ctx;
  const ourGoals = isHome ? result.homeGoals : result.awayGoals;
  const oppGoals = isHome ? result.awayGoals : result.homeGoals;
  const ourStats = isHome ? result.stats.home : result.stats.away;
  const oppStats = isHome ? result.stats.away : result.stats.home;

  const ourAvg = avgTeamOvr(getStarters(userClub, players));
  const oppAvg = avgTeamOvr(getStarters(oppClub, players));

  let expectRuleId = 'pm_met_expectation';
  if (ourGoals > oppGoals && oppAvg >= ourAvg + 2) {
    expectRuleId = 'pm_beat_expectation';
  } else if (
    (ourGoals < oppGoals && ourAvg >= oppAvg - 1) ||
    (ourGoals === oppGoals && ourAvg >= oppAvg + 4)
  ) {
    expectRuleId = 'pm_below_expectation';
  }
  const expectMsg = renderRule(expectRuleId, rng);

  // Best player
  const ourLineupIds = new Set(userClub.tactics.lineup.filter((id): id is string => Boolean(id)));
  const playerLines = 'players' in result ? result.players : [];
  const ourPlayerLines = playerLines.filter(
    (pl) => ourLineupIds.has(pl.playerId) || players[pl.playerId]?.clubId === userClub.id,
  );
  const bestLine = [...ourPlayerLines].sort((a, b) => b.rating - a.rating)[0];
  const bestPlayer = bestLine
    ? players[bestLine.playerId]
    : result.motm && players[result.motm]?.clubId === userClub.id
      ? players[result.motm]
      : undefined;
  const bestMsg = bestPlayer
    ? renderRule('pm_best_player', rng, { player: playerName(bestPlayer) })
    : { text: '', reason: '' };

  // Biggest stat gap & training recommendation
  const shotsTargetGap = oppStats.shotsOnTarget - ourStats.shotsOnTarget;
  const xgGap = oppStats.xg - ourStats.xg;
  const totalPossSec = Math.max(1, ourStats.possessionSec + oppStats.possessionSec);
  const ourPossPct = (ourStats.possessionSec / totalPossSec) * 100;
  const oppPossPct = 100 - ourPossPct;
  const possGap = oppPossPct - ourPossPct;

  let recommendedTraining: TrainingTemplateId = 'balanced';
  let decisionStat = '';
  let workOnText = '';

  if (ourStats.xg >= 1.5 && ourGoals <= 1) {
    recommendedTraining = 'attacking';
    decisionStat = `Created ${ourStats.xg.toFixed(2)} xG for just ${ourGoals} goal${ourGoals === 1 ? '' : 's'}`;
    workOnText = 'We created chances but missed them — drill Attacking & finishing this week.';
  } else if (shotsTargetGap >= 3 || xgGap >= 0.8) {
    recommendedTraining = 'defensive';
    decisionStat = `Conceded ${oppStats.shotsOnTarget} shots on target (${oppStats.xg.toFixed(2)} xG)`;
    workOnText = 'We gave up too many quality looks — work on Defensive shape this week.';
  } else if (possGap >= 15) {
    recommendedTraining = 'tactical';
    decisionStat = `Possession gap: ${ourPossPct.toFixed(0)}% vs ${oppPossPct.toFixed(0)}%`;
    workOnText = 'We chased the ball too long — run Tactical retention sessions this week.';
  } else {
    recommendedTraining = 'balanced';
    decisionStat = `xG: ${ourStats.xg.toFixed(2)} vs ${oppStats.xg.toFixed(2)} · Shots on target: ${ourStats.shotsOnTarget} vs ${oppStats.shotsOnTarget}`;
    workOnText = 'Keep our balanced weekly rhythm going into next matchday.';
  }

  const summary = `${expectMsg.text}${bestMsg.text ? ` ${bestMsg.text}` : ''} ${decisionStat}.`;

  const advices: Advice[] = [
    {
      id: `pm_work_on_${recommendedTraining}`,
      ruleId: 'pm_work_on',
      priority: 1,
      text: workOnText,
      reason: decisionStat,
      apply: { type: 'setTrainingTemplate', templateId: recommendedTraining },
    },
  ];

  return {
    summary,
    advices,
    recommendedTraining,
    decisionStat,
  };
}

/**
 * §15.1 Unified pure entry point: advise(context, rng) -> Advice[]
 */
export function advise(context: AdviceContext, rng: Rng): Advice[] {
  switch (context.kind) {
    case 'preMatch':
      return advisePreMatch(context, rng);
    case 'week':
      return adviseWeek(context, rng);
    case 'inMatch':
      return adviseInMatch(context, rng);
    case 'halfTime':
      return adviseHalfTime(context, rng);
    case 'postMatch':
      return advisePostMatch(context, rng).advices;
  }
}
