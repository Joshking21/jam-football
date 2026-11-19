// Implements SPEC §7.1, §10 Season Worker (Instant round simulation & ticker generation)
import { MatchInput, MatchResult } from '../core/types';
import { simulateInstant } from '../core/match/engine';

export interface SeasonWorkerGoalTick {
  fixtureId: string;
  homeClubId: string;
  awayClubId: string;
  scoringSide: 'home' | 'away';
  scorerName: string;
  minute: number;
  minuteLabel: string;
  homeScoreAfter: number;
  awayScoreAfter: number;
  t: number;
}

export type SeasonWorkerToClientMessage =
  | {
      type: 'roundSimulated';
      results: MatchResult[];
      goalTicks: SeasonWorkerGoalTick[];
    }
  | { type: 'error'; message: string };

export type SeasonClientToWorkerMessage = {
  type: 'simulateRound';
  fixtures: { input: MatchInput; seed: number }[];
};

self.onmessage = (e: MessageEvent<SeasonClientToWorkerMessage>) => {
  const msg = e.data;

  try {
    if (msg.type === 'simulateRound') {
      const results: MatchResult[] = [];
      const goalTicks: SeasonWorkerGoalTick[] = [];

      for (const item of msg.fixtures) {
        const res = simulateInstant(item.input, item.seed);
        results.push(res);

        for (const ev of res.events) {
          if (ev.type === 'GOAL') {
            const scorerSheet =
              ev.side === 'home'
                ? item.input.home.players[ev.playerId ?? '']
                : item.input.away.players[ev.playerId ?? ''];

            goalTicks.push({
              fixtureId: item.input.fixtureId,
              homeClubId: item.input.home.clubId,
              awayClubId: item.input.away.clubId,
              scoringSide: ev.side,
              scorerName: scorerSheet?.name ?? 'Unknown',
              minute: Math.floor(ev.t / 60) + 1,
              minuteLabel: ev.minuteLabel,
              homeScoreAfter: ev.scoreAfter.home,
              awayScoreAfter: ev.scoreAfter.away,
              t: ev.t,
            });
          }
        }
      }

      // Sort ticks chronologically by match time t
      goalTicks.sort((a, b) => a.t - b.t);

      self.postMessage({
        type: 'roundSimulated',
        results,
        goalTicks,
      } satisfies SeasonWorkerToClientMessage);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({
      type: 'error',
      message,
    } satisfies SeasonWorkerToClientMessage);
  }
};
