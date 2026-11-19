// Implements SPEC §7.4 Match Worker Protocol
import { MatchInput, MatchCommand, MatchEvent, MatchResult } from '../core/types';
import { createMatch, MatchSim } from '../core/match/engine';

export type WorkerToClientMessage =
  | { type: 'events'; events: MatchEvent[]; simulatedUntil: number }
  | { type: 'rewind'; fromSeq: number }
  | { type: 'result'; result: MatchResult }
  | { type: 'error'; message: string };

export type ClientToWorkerMessage =
  | { type: 'start'; input: MatchInput; seed: number; lookaheadSec?: number }
  | { type: 'command'; command: MatchCommand }
  | { type: 'need'; untilT: number }
  | { type: 'finishInstant' }
  | { type: 'dispose' };

let sim: MatchSim | null = null;
let currentLookaheadSec = 300;
let currentSimulatedUntil = 0;

self.onmessage = (e: MessageEvent<ClientToWorkerMessage>) => {
  const msg = e.data;

  try {
    switch (msg.type) {
      case 'start': {
        sim = createMatch(msg.input, msg.seed);
        currentLookaheadSec = msg.lookaheadSec ?? 300;
        currentSimulatedUntil = currentLookaheadSec;

        const events = sim.runUntil(currentSimulatedUntil);
        self.postMessage({
          type: 'events',
          events,
          simulatedUntil: currentSimulatedUntil,
        } satisfies WorkerToClientMessage);

        if (sim.isFinished()) {
          self.postMessage({
            type: 'result',
            result: sim.result(),
          } satisfies WorkerToClientMessage);
        }
        break;
      }

      case 'need': {
        if (!sim) return;
        const targetT = msg.untilT + currentLookaheadSec;
        if (targetT > currentSimulatedUntil && !sim.isFinished()) {
          currentSimulatedUntil = targetT;
          const events = sim.runUntil(targetT);
          self.postMessage({
            type: 'events',
            events,
            simulatedUntil: targetT,
          } satisfies WorkerToClientMessage);
        }

        if (sim.isFinished()) {
          self.postMessage({
            type: 'result',
            result: sim.result(),
          } satisfies WorkerToClientMessage);
        }
        break;
      }

      case 'command': {
        if (!sim) return;
        const rewindRes = sim.applyCommandWithRewind(msg.command);
        if (rewindRes.rewound && rewindRes.fromSeq != null) {
          self.postMessage({
            type: 'rewind',
            fromSeq: rewindRes.fromSeq,
          } satisfies WorkerToClientMessage);

          // Re-simulate to catch back up
          const events = sim.runUntil(currentSimulatedUntil);
          self.postMessage({
            type: 'events',
            events,
            simulatedUntil: currentSimulatedUntil,
          } satisfies WorkerToClientMessage);
        }
        break;
      }

      case 'finishInstant': {
        if (!sim) return;
        const events = sim.runToEnd();
        if (events.length > 0) {
          self.postMessage({
            type: 'events',
            events,
            simulatedUntil: 6000,
          } satisfies WorkerToClientMessage);
        }
        self.postMessage({
          type: 'result',
          result: sim.result(),
        } satisfies WorkerToClientMessage);
        break;
      }

      case 'dispose': {
        sim = null;
        break;
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({
      type: 'error',
      message,
    } satisfies WorkerToClientMessage);
  }
};
