// Implements SPEC §13 Match Engine & Simulation (createMatch, restoreMatch, simulateInstant)
import {
  MatchInput,
  MatchEvent,
  MatchEventType,
  MatchResult,
  MatchCommand,
  ShotContext,
  Side,
  PlayerId,
  Position,
  Duty,
  Injury,
} from '../types';
import { createRng, restoreRng, Rng } from '../rng';
import { z, sigmoid, logit, clamp, roundTo } from '../math';
import { K, BALANCE } from '@/config/balance';
import { FORMATIONS } from '@/config/formations';
import {
  toAbsolute,
  toAttacking,
  classifyThird,
  classifyLane,
  isBox,
  isSixYardBox,
} from './frames';
import { selectReceiver, selectPrimaryDefender, getInvolvementWeights } from './involvement';
import { selectAction, CandidateAction, ActionSelectionContext } from './actions';
import { resolveShot, ShotResolutionResult } from './shots';
import { resolveFoulCard, determineFoulRestart } from './fouls';
import { resolveCorner } from './setPieces';
import { createEmptyTeamStats, createPlayerMatchLine } from './stats';
import { computePlayerRating, selectMotm } from './ratings';
import { evaluateInMatchAi, pickBestLineup } from './aiManager';
import { shouldApplyCommand, canMakeSub } from './commands';
import { MatchSnapshot, LiveTeamState, LivePlayerState, PendingRestart, MatchPhase } from './state';

export interface MatchSim {
  step(): MatchEvent[];
  runUntil(t: number): MatchEvent[];
  runToEnd(): MatchEvent[];
  applyCommand(c: MatchCommand): void;
  applyCommandWithRewind(c: MatchCommand): { rewound: boolean; fromSeq?: number };
  snapshot(): MatchSnapshot;
  isFinished(): boolean;
  result(): MatchResult;
}

export class MatchEngine implements MatchSim {
  private input: MatchInput;
  private seed: number;
  private rng: Rng;

  private t: number = 0;
  private half: 1 | 2 = 1;
  private periodEnd: number = 2700;
  private stoppage1: number = 0;
  private stoppage2: number = 0;
  private addedTimeAnnounced: boolean = false;

  private possessionSide: Side | null = null;
  private ballPosAttacking: { ax: number; ay: number } = { ax: 52.5, ay: 34 };
  private ballPosAbsolute: { x: number; y: number } = { x: 52.5, y: 34 };
  private ballHolderId: PlayerId | null = null;
  private lastPasserId: PlayerId | null = null;
  private forcedAction: { action: CandidateAction; context?: ShotContext } | null = null;

  private phase: MatchPhase = { type: 'OPEN' };
  private pendingRestart: PendingRestart | null = null;

  private homeTeam: LiveTeamState;
  private awayTeam: LiveTeamState;
  private players: Record<PlayerId, LivePlayerState> = {};

  private teamStats = {
    home: createEmptyTeamStats(),
    away: createEmptyTeamStats(),
  };
  private playerLines: Record<PlayerId, ReturnType<typeof createPlayerMatchLine>> = {};
  private score = { home: 0, away: 0 };
  private winningGoalScorerId: PlayerId | null = null;

  private events: MatchEvent[] = [];
  private seq: number = 0;
  private pendingCommands: MatchCommand[] = [];
  private injuries: { playerId: PlayerId; injury: Injury }[] = [];
  private isFinishedState: boolean = false;

  // Ring buffer for snapshots
  private snapshotHistory: { seq: number; snapshot: MatchSnapshot }[] = [];
  private readonly MAX_SNAPSHOTS = 400;
  private enableSnapshots: boolean = true;

  private homeDrainRate: number = 0.22;
  private awayDrainRate: number = 0.22;

  private updateDrainRates(): void {
    this.homeDrainRate =
      BALANCE.condition.drainPerMinuteBase *
      BALANCE.condition.pressingFactors[this.homeTeam.instructions.pressing] *
      BALANCE.condition.tempoFactors[this.homeTeam.instructions.tempo];
    this.awayDrainRate =
      BALANCE.condition.drainPerMinuteBase *
      BALANCE.condition.pressingFactors[this.awayTeam.instructions.pressing] *
      BALANCE.condition.tempoFactors[this.awayTeam.instructions.tempo];
  }

  constructor(input: MatchInput, seed: number, enableSnapshots: boolean = true) {
    this.input = input;
    this.seed = seed;
    this.enableSnapshots = enableSnapshots;
    this.rng = createRng(seed);

    // Initialize home team state
    this.homeTeam = {
      clubId: input.home.clubId,
      side: 'home',
      formation: input.home.tactics.formation,
      lineup: [...input.home.tactics.lineup],
      duties: [...input.home.tactics.duties],
      bench: [...input.home.tactics.bench],
      instructions: { ...input.home.tactics.instructions },
      captain: input.home.tactics.captain,
      penaltyTaker: input.home.tactics.takers.penalty,
      freeKickTaker: input.home.tactics.takers.freeKick,
      cornerTaker: input.home.tactics.takers.corner,
      subsUsed: 0,
      inPlayWindowsUsed: 0,
      redCardedPlayers: [],
      substitutedPlayers: [],
      focusBoostExpiryT: input.home.focusBoost > 0 ? 1200 : 0,
    };

    // Initialize away team state
    this.awayTeam = {
      clubId: input.away.clubId,
      side: 'away',
      formation: input.away.tactics.formation,
      lineup: [...input.away.tactics.lineup],
      duties: [...input.away.tactics.duties],
      bench: [...input.away.tactics.bench],
      instructions: { ...input.away.tactics.instructions },
      captain: input.away.tactics.captain,
      penaltyTaker: input.away.tactics.takers.penalty,
      freeKickTaker: input.away.tactics.takers.freeKick,
      cornerTaker: input.away.tactics.takers.corner,
      subsUsed: 0,
      inPlayWindowsUsed: 0,
      redCardedPlayers: [],
      substitutedPlayers: [],
      focusBoostExpiryT: input.away.focusBoost > 0 ? 1200 : 0,
    };

    this.updateDrainRates();

    // Initialize players
    for (const [idStr, p] of Object.entries(input.home.players)) {
      const id = idStr as PlayerId;
      this.players[id] = {
        id,
        side: 'home',
        name: p.name,
        shirt: p.shirt,
        condition: p.condition,
        fatigue: p.fatigue,
        morale: p.morale,
        yellowCards: 0,
        isRedCarded: false,
        isInjured: false,
        failedDribbles: 0,
        errorsLeadingToGoal: 0,
      };
      this.playerLines[id] = createPlayerMatchLine(id, 'home', p.condition);
    }
    for (const [idStr, p] of Object.entries(input.away.players)) {
      const id = idStr as PlayerId;
      this.players[id] = {
        id,
        side: 'away',
        name: p.name,
        shirt: p.shirt,
        condition: p.condition,
        fatigue: p.fatigue,
        morale: p.morale,
        yellowCards: 0,
        isRedCarded: false,
        isInjured: false,
        failedDribbles: 0,
        errorsLeadingToGoal: 0,
      };
      this.playerLines[id] = createPlayerMatchLine(id, 'away', p.condition);
    }

    // Calculate initial first half stoppage
    this.stoppage1 = clamp(60 * 1 + this.rng.int(0, 60), 60, 300);
    this.periodEnd = 2700 + this.stoppage1;

    // Home starts with kickoff
    this.possessionSide = 'home';
    this.pendingRestart = {
      type: 'KICKOFF',
      side: 'home',
      pos: { ax: 52.5, ay: 34 },
    };
  }

  private rngFloat(min: number, max: number): number {
    return min + this.rng.next() * (max - min);
  }

  public applyCommand(c: MatchCommand): void {
    this.pendingCommands.push(c);
  }

  public applyCommandWithRewind(c: MatchCommand): { rewound: boolean; fromSeq?: number } {
    const effectiveT =
      c.kind === 'instructions' || c.kind === 'formation' ? c.issuedAtT + 30 : c.issuedAtT;

    if (this.t > effectiveT && this.snapshotHistory.length > 0) {
      // Find the latest snapshot taken before or at effectiveT
      let targetIndex = -1;
      for (let i = this.snapshotHistory.length - 1; i >= 0; i--) {
        if (this.snapshotHistory[i]!.snapshot.t <= effectiveT) {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex >= 0) {
        const { snapshot } = this.snapshotHistory[targetIndex]!;
        const fromSeq = snapshot.seq + 1;

        // Restore state
        this.rng = restoreRng(snapshot.rngSnapshot);
        this.t = snapshot.t;
        this.half = snapshot.half;
        this.periodEnd = snapshot.periodEnd;
        this.addedTimeAnnounced = snapshot.addedTimeAnnounced;
        this.possessionSide = snapshot.possessionSide;
        this.ballPosAttacking = { ...snapshot.ballPosAttacking };
        this.ballPosAbsolute = { ...snapshot.ballPosAbsolute };
        this.ballHolderId = snapshot.ballHolderId;
        this.phase = { ...snapshot.phase };
        this.pendingRestart = snapshot.pendingRestart ? { ...snapshot.pendingRestart } : null;
        this.homeTeam = JSON.parse(JSON.stringify(snapshot.homeTeam));
        this.awayTeam = JSON.parse(JSON.stringify(snapshot.awayTeam));
        this.players = JSON.parse(JSON.stringify(snapshot.players));
        this.teamStats = JSON.parse(JSON.stringify(snapshot.teamStats));
        this.playerLines = JSON.parse(JSON.stringify(snapshot.playerLines));
        this.score = { ...snapshot.score };
        this.events = this.events.filter((e) => e.seq <= snapshot.seq);
        this.seq = snapshot.seq;
        this.pendingCommands = [...snapshot.pendingCommands, c];
        this.injuries = [...snapshot.injuries];
        this.isFinishedState = snapshot.isFinished;

        // Truncate history
        this.snapshotHistory = this.snapshotHistory.slice(0, targetIndex + 1);

        return { rewound: true, fromSeq };
      }
    }

    this.applyCommand(c);
    return { rewound: false };
  }

  public isFinished(): boolean {
    return this.isFinishedState;
  }

  public snapshot(): MatchSnapshot {
    return {
      input: this.input,
      seed: this.seed,
      rngSnapshot: this.rng.state(),
      t: this.t,
      half: this.half,
      periodEnd: this.periodEnd,
      addedTimeAnnounced: this.addedTimeAnnounced,
      possessionSide: this.possessionSide,
      ballPosAttacking: { ...this.ballPosAttacking },
      ballPosAbsolute: { ...this.ballPosAbsolute },
      ballHolderId: this.ballHolderId,
      phase: { ...this.phase },
      pendingRestart: this.pendingRestart ? { ...this.pendingRestart } : null,
      homeTeam: JSON.parse(JSON.stringify(this.homeTeam)),
      awayTeam: JSON.parse(JSON.stringify(this.awayTeam)),
      players: JSON.parse(JSON.stringify(this.players)),
      teamStats: JSON.parse(JSON.stringify(this.teamStats)),
      playerLines: JSON.parse(JSON.stringify(this.playerLines)),
      score: { ...this.score },
      events: [...this.events],
      seq: this.seq,
      pendingCommands: [...this.pendingCommands],
      injuries: [...this.injuries],
      isFinished: this.isFinishedState,
    };
  }

  private saveSnapshotToHistory(): void {
    if (this.snapshotHistory.length >= this.MAX_SNAPSHOTS) {
      this.snapshotHistory.shift();
    }
    this.snapshotHistory.push({ seq: this.seq, snapshot: this.snapshot() });
  }

  private getMinuteLabel(t: number, half: 1 | 2): string {
    const mins = Math.floor(t / 60);
    if (half === 1) {
      if (t <= 2700) {
        return `${Math.min(45, mins + 1)}`;
      }
      const added = Math.floor((t - 2700) / 60) + 1;
      return `45+${added}`;
    } else {
      if (t <= 5400) {
        return `${Math.min(90, mins + 1)}`;
      }
      const added = Math.floor((t - 5400) / 60) + 1;
      return `90+${added}`;
    }
  }

  private emitEvent(
    type: MatchEventType,
    duration: number,
    opts: Partial<MatchEvent> = {},
  ): MatchEvent {
    this.seq++;
    const side = opts.side ?? this.possessionSide ?? 'home';
    const event: MatchEvent = {
      seq: this.seq,
      t: this.t,
      minuteLabel: this.getMinuteLabel(this.t, this.half),
      half: this.half,
      type,
      side,
      duration,
      importance: opts.importance ?? 0,
      scoreAfter: { home: this.score.home, away: this.score.away },
      ...opts,
    };

    this.events.push(event);
    return event;
  }

  private updatePlayerMinutes(durationSec: number): void {
    const durMins = durationSec / 60;
    const homeDrainRate = this.homeDrainRate;
    const awayDrainRate = this.awayDrainRate;

    for (const pId of this.homeTeam.lineup) {
      if (!pId) continue;
      const pl = this.playerLines[pId];
      const p = this.players[pId];
      if (pl && p && !p.isRedCarded) {
        pl.minutes += durMins;
        p.condition = Math.max(1, p.condition - homeDrainRate * durMins);
        pl.conditionEnd = Math.round(p.condition);
        this.checkInjury(p, durMins, this.awayTeam.instructions.pressing);
      }
    }

    for (const pId of this.awayTeam.lineup) {
      if (!pId) continue;
      const pl = this.playerLines[pId];
      const p = this.players[pId];
      if (pl && p && !p.isRedCarded) {
        pl.minutes += durMins;
        p.condition = Math.max(1, p.condition - awayDrainRate * durMins);
        pl.conditionEnd = Math.round(p.condition);
        this.checkInjury(p, durMins, this.homeTeam.instructions.pressing);
      }
    }
  }

  private checkInjury(
    p: LivePlayerState,
    dtMinutes: number,
    oppPressing: 'High' | 'Mid' | 'Low',
  ): void {
    if (p.isInjured) return;
    const condFactor = 1 + Math.max(0, 70 - p.condition) / 30;
    const fatFactor = p.fatigue > 60 ? 1.5 : 1.0;
    const pressFactor = oppPressing === 'High' ? 1.15 : 1.0;
    const lambda = BALANCE.injuries.hazardBase * condFactor * fatFactor * pressFactor;
    // Fast Taylor approximation: lambda * dt < 0.001 so 1 - exp(-x) ≈ x
    const pInj = lambda * dtMinutes;

    if (this.rng.chance(pInj)) {
      p.isInjured = true;
      const pl = this.playerLines[p.id];
      if (pl) pl.injured = true;

      // Severity
      const roll = this.rng.next();
      let matchdaysOut = 1;
      let severity: 'Minor' | 'Moderate' | 'Major' = 'Minor';
      if (roll < 0.55) {
        severity = 'Minor';
        matchdaysOut = this.rng.int(1, 2);
      } else if (roll < 0.9) {
        severity = 'Moderate';
        matchdaysOut = this.rng.int(3, 5);
      } else {
        severity = 'Major';
        matchdaysOut = this.rng.int(6, 12);
      }

      const injury: Injury = {
        kind: 'Muscle strain',
        severity,
        matchdaysOut,
      };
      this.injuries.push({ playerId: p.id, injury });

      this.emitEvent('INJURY', K.durations.injury, {
        side: p.side,
        playerId: p.id,
        importance: 1,
      });
    }
  }

  private processReadyCommands(lastEventType: MatchEventType | null): void {
    const isHt = this.t >= 2700 && this.half === 1 && lastEventType === 'HALF_TIME';
    const remaining: MatchCommand[] = [];

    for (const cmd of this.pendingCommands) {
      if (shouldApplyCommand(cmd, this.t, lastEventType, isHt)) {
        this.applySingleCommand(cmd, isHt);
      } else {
        remaining.push(cmd);
      }
    }
    this.pendingCommands = remaining;
  }

  private applySingleCommand(cmd: MatchCommand, isHalfTime: boolean): void {
    const team = cmd.side === 'home' ? this.homeTeam : this.awayTeam;

    if (cmd.kind === 'instructions') {
      team.instructions = { ...team.instructions, ...cmd.instructions };
      this.updateDrainRates();
      this.emitEvent('TACTIC_CHANGE', 0, {
        side: cmd.side,
        importance: 0,
      });
    } else if (cmd.kind === 'formation') {
      team.formation = cmd.formation;
      team.lineup = [...cmd.lineup];
      team.duties = [...cmd.duties];
      this.emitEvent('TACTIC_CHANGE', 0, {
        side: cmd.side,
        importance: 0,
      });
    } else if (cmd.kind === 'sub') {
      const redSet = new Set(team.redCardedPlayers);
      const subSet = new Set(team.substitutedPlayers);
      const check = canMakeSub(
        cmd.side,
        team.subsUsed,
        team.inPlayWindowsUsed,
        isHalfTime,
        cmd.outId,
        cmd.inId,
        team.lineup,
        team.bench,
        redSet,
        subSet,
      );

      if (check.allowed) {
        team.subsUsed++;
        if (!isHalfTime) team.inPlayWindowsUsed++;
        team.lineup[cmd.slot] = cmd.inId;
        team.bench = team.bench.filter((id) => id !== cmd.inId);
        team.substitutedPlayers.push(cmd.outId);

        this.emitEvent('SUB', K.durations.substitution, {
          side: cmd.side,
          playerId: cmd.outId,
          targetId: cmd.inId,
          importance: 1,
        });
      }
    }
  }

  private lastAiCheckT: number = -300;

  private runAiManagerCheck(): void {
    if (this.t - this.lastAiCheckT < 300) return;
    this.lastAiCheckT = this.t;
    const minute = Math.floor(this.t / 60);

    for (const side of this.input.aiControls) {
      const team = side === 'home' ? this.homeTeam : this.awayTeam;
      const ourScore = side === 'home' ? this.score.home : this.score.away;
      const oppScore = side === 'home' ? this.score.away : this.score.home;
      const teamSheet = side === 'home' ? this.input.home : this.input.away;

      const playerMap: Record<
        PlayerId,
        {
          id: PlayerId;
          positions: any;
          attributes: any;
          condition: number;
          rating: number;
          isRedCarded?: boolean;
        }
      > = {};

      for (const [idStr, p] of Object.entries(teamSheet.players)) {
        const id = idStr as PlayerId;
        const live = this.players[id];
        const pl = this.playerLines[id];
        if (live && pl) {
          playerMap[id] = {
            id,
            positions: p.positions,
            attributes: p.attributes,
            condition: live.condition,
            rating: pl.rating,
            isRedCarded: live.isRedCarded,
          };
        }
      }

      const decision = evaluateInMatchAi({
        minute,
        side,
        ourScore,
        oppScore,
        currentTactics: {
          formation: team.formation,
          lineup: team.lineup,
          duties: team.duties,
          bench: team.bench,
          instructions: team.instructions,
          captain: team.captain,
          takers: {
            penalty: team.penaltyTaker,
            freeKick: team.freeKickTaker,
            corner: team.cornerTaker,
          },
        },
        lineup: team.lineup,
        bench: team.bench,
        subsUsed: team.subsUsed,
        windowsUsed: team.inPlayWindowsUsed,
        players: playerMap,
      });

      if (decision.instructionChanges) {
        team.instructions = { ...team.instructions, ...decision.instructionChanges };
        this.updateDrainRates();
      }

      if (decision.substitutions) {
        for (const s of decision.substitutions) {
          this.applyCommand({
            kind: 'sub',
            side,
            outId: s.outId,
            inId: s.inId,
            slot: s.slot,
            issuedAtT: this.t,
          });
        }
      }
    }
  }

  public step(): MatchEvent[] {
    if (this.isFinishedState) return [];

    const stepStartEventsCount = this.events.length;
    if (this.enableSnapshots) {
      this.saveSnapshotToHistory();
    }

    // 1. Half & Clock transitions
    if (this.half === 1) {
      if (this.t >= 2700 && !this.addedTimeAnnounced) {
        this.addedTimeAnnounced = true;
        this.emitEvent('ADDED_TIME', 0, {
          importance: 0,
        });
      }

      if (this.t >= this.periodEnd) {
        const htEvent = this.emitEvent('HALF_TIME', 0, {
          importance: 1,
        });
        this.processReadyCommands('HALF_TIME');

        // Transition to second half
        this.half = 2;
        this.t = 2700;
        this.addedTimeAnnounced = false;

        // Calculate stoppage 2
        const goals2H = this.score.home + this.score.away;
        const subs2H = this.homeTeam.subsUsed + this.awayTeam.subsUsed;
        const inj2H = this.injuries.length;
        const cards2H =
          this.teamStats.home.yellow +
          this.teamStats.home.red +
          this.teamStats.away.yellow +
          this.teamStats.away.red;

        this.stoppage2 = clamp(
          60 * (2 + goals2H * 0.5 + subs2H * 0.5 + inj2H * 1 + cards2H * 0.25) +
            this.rng.int(0, 90),
          180,
          540,
        );
        this.periodEnd = 5400 + this.stoppage2;

        // Away team kicks off second half
        this.possessionSide = 'away';
        this.pendingRestart = {
          type: 'KICKOFF',
          side: 'away',
          pos: { ax: 52.5, ay: 34 },
        };
        return this.enableSnapshots ? this.events.slice(stepStartEventsCount) : [];
      }
    } else {
      // Half 2
      if (this.t >= 5400 && !this.addedTimeAnnounced) {
        this.addedTimeAnnounced = true;
        this.emitEvent('ADDED_TIME', 0, {
          importance: 0,
        });
      }

      if (this.t >= this.periodEnd) {
        this.emitEvent('FULL_TIME', 0, {
          importance: 3,
        });
        this.isFinishedState = true;
        this.finalizeRatings();
        return this.enableSnapshots ? this.events.slice(stepStartEventsCount) : [];
      }
    }

    // 2. Commands & AI check
    if (this.pendingCommands.length > 0) {
      this.processReadyCommands(
        this.events.length > 0 ? this.events[this.events.length - 1]!.type : null,
      );
    }
    this.runAiManagerCheck();

    // 3. Resolve Current Action / Step
    if (this.pendingRestart) {
      this.resolveRestartStep();
    } else {
      this.resolveOpenPlayStep();
    }

    return this.enableSnapshots ? this.events.slice(stepStartEventsCount) : [];
  }

  private resolveRestartStep(): void {
    if (!this.pendingRestart) return;
    const restart = this.pendingRestart;
    this.pendingRestart = null;
    this.possessionSide = restart.side;

    const team = restart.side === 'home' ? this.homeTeam : this.awayTeam;
    const oppTeam = restart.side === 'home' ? this.awayTeam : this.homeTeam;

    if (restart.type === 'KICKOFF') {
      const dur = 4;
      this.t += dur;
      this.teamStats[restart.side].possessionSec += dur;
      this.updatePlayerMinutes(dur);

      // Ball placed in MID Centre
      this.ballPosAttacking = { ax: 52.5, ay: 34 };
      this.ballPosAbsolute = toAbsolute(52.5, 34, restart.side, this.half);

      // Find central midfielder or striker
      const holderId =
        team.lineup.find((id) => {
          if (!id) return false;
          const pos = this.getPlayerPosition(id);
          return pos === 'CM' || pos === 'ST' || pos === 'AM';
        }) ??
        team.lineup[0] ??
        null;

      this.ballHolderId = holderId;
      this.lastPasserId = null;

      this.emitEvent('KICKOFF', dur, {
        side: restart.side,
        playerId: holderId ?? undefined,
        from: this.ballPosAbsolute,
        to: this.ballPosAbsolute,
        importance: 0,
      });

      // Next action is recycle
      this.forcedAction = { action: 'recycle' };
    } else if (restart.type === 'THROW_IN') {
      const dur = K.durations.throwIn;
      this.t += dur;
      this.teamStats[restart.side].possessionSec += dur;
      this.updatePlayerMinutes(dur);

      this.ballPosAttacking = { ...restart.pos };
      this.ballPosAbsolute = toAbsolute(restart.pos.ax, restart.pos.ay, restart.side, this.half);

      // Taker = closest wide player (LB/RB/LM/RM)
      const takerId = this.findBestTakerForThrowIn(team);
      this.ballHolderId = takerId;
      this.lastPasserId = null;

      this.emitEvent('THROW_IN', dur, {
        side: restart.side,
        playerId: takerId ?? undefined,
        from: this.ballPosAbsolute,
        to: this.ballPosAbsolute,
        importance: 0,
      });

      this.forcedAction = { action: 'recycle' };
    } else if (restart.type === 'GOAL_KICK') {
      const dur = K.durations.goalKick;
      this.t += dur;
      this.teamStats[restart.side].possessionSec += dur;
      this.updatePlayerMinutes(dur);

      // Placed in DEF Centre
      this.ballPosAttacking = { ax: 16, ay: 34 };
      this.ballPosAbsolute = toAbsolute(16, 34, restart.side, this.half);

      const gkId = team.lineup[0] ?? null;
      this.ballHolderId = gkId;
      this.lastPasserId = null;

      this.emitEvent('GOAL_KICK', dur, {
        side: restart.side,
        playerId: gkId ?? undefined,
        from: this.ballPosAbsolute,
        to: this.ballPosAbsolute,
        importance: 0,
      });

      // Passing Direct: 60% long instead
      if (team.instructions.passing === 'Direct' && this.rng.chance(0.6)) {
        this.forcedAction = { action: 'long' };
      } else {
        this.forcedAction = { action: 'progress' };
      }
    } else if (restart.type === 'CORNER') {
      this.teamStats[restart.side].corners++;
      const dur = K.durations.corner;
      this.t += dur;
      this.teamStats[restart.side].possessionSec += dur;
      this.updatePlayerMinutes(dur);

      // Corner pos
      const cornerAy = restart.pos.ay < 34 ? 0 : 68;
      this.ballPosAttacking = { ax: 105, ay: cornerAy };
      this.ballPosAbsolute = toAbsolute(105, cornerAy, restart.side, this.half);

      const takerId = team.cornerTaker ?? this.selectOutfielder(team, 'LM');
      this.ballHolderId = takerId;
      this.lastPasserId = null;

      this.emitEvent('CORNER', 2, {
        side: restart.side,
        playerId: takerId,
        from: this.ballPosAbsolute,
        to: this.ballPosAbsolute,
        importance: 1,
      });

      // Resolve corner contest
      const takerP = this.getSetPiecePlayer(takerId);
      const gkId = oppTeam.lineup[0] ?? null;
      const gkP = gkId ? this.getSetPiecePlayer(gkId) : takerP;

      const attInBox = this.getPlayersInBox(team, restart.side);
      const defInBox = this.getPlayersInBox(oppTeam, oppTeam.side);

      const cornerResult = resolveCorner({
        taker: takerP,
        goalkeeper: gkP,
        attackersInBox: attInBox,
        defendersInBox: defInBox,
        trainingBonusAttack: this.getTrainingBonus(restart.side, 'attack'),
        trainingBonusSetPieces: this.getTrainingBonus(restart.side, 'setPieces'),
        homeAdvantage: restart.side === 'home' ? K.homeAdvantage : 0,
        defenderHomeAdvantage: restart.side === 'away' ? K.homeAdvantage : 0,
        rng: this.rng,
      });

      if (cornerResult.outcome === 'CLAIM') {
        this.emitEvent('CLAIM', 3, {
          side: oppTeam.side,
          playerId: gkId ?? undefined,
          importance: 1,
        });
        this.possessionSide = oppTeam.side;
        this.ballHolderId = gkId;
        this.ballPosAttacking = { ax: 16, ay: 34 };
        this.ballPosAbsolute = toAbsolute(16, 34, oppTeam.side, this.half);
      } else if (cornerResult.outcome === 'CORNER_AGAIN') {
        this.emitEvent('CLEARANCE', 2, {
          side: oppTeam.side,
          importance: 0,
        });
        this.pendingRestart = {
          type: 'CORNER',
          side: restart.side,
          pos: { ax: 105, ay: cornerAy },
        };
      } else if (cornerResult.outcome === 'CLEARANCE') {
        this.emitEvent('CLEARANCE', 3, {
          side: oppTeam.side,
          playerId: cornerResult.defenderId,
          importance: 0,
        });
        if (cornerResult.secondBallSide === 'ATTACKING') {
          // Attacking keeps ball in MID Centre
          this.ballPosAttacking = { ax: 52.5, ay: 34 };
          this.ballPosAbsolute = toAbsolute(52.5, 34, restart.side, this.half);
          this.ballHolderId = this.selectOutfielder(team, 'CM');
        } else {
          // Defenders win possession
          this.possessionSide = oppTeam.side;
          this.ballPosAttacking = { ax: 35, ay: 34 };
          this.ballPosAbsolute = toAbsolute(35, 34, oppTeam.side, this.half);
          this.ballHolderId = this.selectOutfielder(oppTeam, 'CB');
        }
      } else if (cornerResult.outcome === 'SHOT' && cornerResult.shotResult) {
        this.processShotResult(
          restart.side,
          cornerResult.headerAttackerId ?? takerId,
          cornerResult.shotContext ?? 'HEADER',
          cornerResult.shotResult,
          cornerResult.defenderId,
        );
      }
    } else if (restart.type === 'PENALTY') {
      const dur = 20;
      this.t += dur;
      this.teamStats[restart.side].possessionSec += dur;
      this.updatePlayerMinutes(dur);

      const takerId = team.penaltyTaker ?? this.selectOutfielder(team, 'ST');
      const gkId = oppTeam.lineup[0] ?? null;
      const takerP = this.getPlayerSheet(takerId);
      const gkP = gkId ? this.getPlayerSheet(gkId) : takerP;

      const shotRes = resolveShot({
        context: 'PENALTY',
        attacker: takerP,
        goalkeeper: gkP,
        defender: null,
        trainingBonus: this.getTrainingBonus(restart.side, 'setPieces'),
        homeAdvantage: restart.side === 'home' ? K.homeAdvantage : 0,
        defenderHomeAdvantage: restart.side === 'away' ? K.homeAdvantage : 0,
        rng: this.rng,
      });

      this.processShotResult(restart.side, takerId, 'PENALTY', shotRes, undefined);
    } else if (restart.type === 'FREE_KICK') {
      const dur = K.durations.freeKick;
      this.t += dur;
      this.teamStats[restart.side].possessionSec += dur;
      this.updatePlayerMinutes(dur);

      const takerId = team.freeKickTaker ?? this.selectOutfielder(team, 'CM');
      this.ballHolderId = takerId;
      this.ballPosAttacking = { ...restart.pos };
      this.ballPosAbsolute = toAbsolute(restart.pos.ax, restart.pos.ay, restart.side, this.half);

      this.emitEvent('FREE_KICK', 2, {
        side: restart.side,
        playerId: takerId,
        from: this.ballPosAbsolute,
        to: this.ballPosAbsolute,
        importance: 0,
      });

      if (restart.shotContext === 'DIRECT_FK') {
        const gkId = oppTeam.lineup[0] ?? null;
        const takerP = this.getPlayerSheet(takerId);
        const gkP = gkId ? this.getPlayerSheet(gkId) : takerP;
        const defP = this.selectPrimaryDefenderId(oppTeam);
        const defSheet = defP ? this.getPlayerSheet(defP) : null;

        const shotRes = resolveShot({
          context: 'DIRECT_FK',
          attacker: takerP,
          goalkeeper: gkP,
          defender: defSheet,
          trainingBonus: this.getTrainingBonus(restart.side, 'setPieces'),
          homeAdvantage: restart.side === 'home' ? K.homeAdvantage : 0,
          defenderHomeAdvantage: restart.side === 'away' ? K.homeAdvantage : 0,
          rng: this.rng,
        });

        this.processShotResult(restart.side, takerId, 'DIRECT_FK', shotRes, defP ?? undefined);
      } else {
        // Cross or keep ball
        this.forcedAction = { action: 'progress' };
      }
    }
  }

  private resolveOpenPlayStep(): void {
    const side = this.possessionSide ?? 'home';
    const oppSide: Side = side === 'home' ? 'away' : 'home';
    const team = side === 'home' ? this.homeTeam : this.awayTeam;
    const oppTeam = oppSide === 'home' ? this.homeTeam : this.awayTeam;

    // Check pressing foul hazard in DEF/MID
    const currentThird = classifyThird(this.ballPosAttacking.ax);
    if (currentThird === 'DEF' || currentThird === 'MID') {
      const foulHazard = K.fouls.pressingHazard[oppTeam.instructions.pressing];
      if (this.rng.chance(foulHazard)) {
        const presserId = this.selectPressingFouler(oppTeam);
        this.triggerFoul(oppSide, side, this.ballPosAttacking, presserId);
        return;
      }
    }

    // Determine candidate action
    let action: CandidateAction;
    let forcedCtx: ShotContext | undefined;

    if (this.forcedAction) {
      action = this.forcedAction.action;
      forcedCtx = this.forcedAction.context;
      this.forcedAction = null;
    } else {
      const currentLane = classifyLane(this.ballPosAttacking.ay);

      const actionCtx: ActionSelectionContext = {
        ax: this.ballPosAttacking.ax,
        ay: this.ballPosAttacking.ay,
        instructions: team.instructions,
        opponentLine: oppTeam.instructions.line,
        isUnderPressure: oppTeam.instructions.pressing === 'High',
        isCounterPhase: this.phase.type === 'COUNTER',
        isLosingLate:
          this.t >= 4500 &&
          (side === 'home' ? this.score.home < this.score.away : this.score.away < this.score.home),
      };

      action = selectAction(currentThird, currentLane, actionCtx, this.rng);
    }

    // Decrement counter phase if active
    if (this.phase.type === 'COUNTER') {
      const remaining = this.phase.remainingSteps - 1;
      this.phase =
        remaining > 0 ? { type: 'COUNTER', remainingSteps: remaining } : { type: 'OPEN' };
    }

    // Resolve specific action
    this.executeAction(action, side, oppSide, forcedCtx);
  }

  private executeAction(
    action: CandidateAction,
    side: Side,
    oppSide: Side,
    forcedCtx?: ShotContext,
  ): void {
    const team = side === 'home' ? this.homeTeam : this.awayTeam;
    const oppTeam = oppSide === 'home' ? this.homeTeam : this.awayTeam;

    // Durations scaled by tempo
    const tempoMultiplier =
      team.instructions.tempo === 'Slow' ? 1.2 : team.instructions.tempo === 'Fast' ? 0.82 : 1.0;

    const holderId = this.ballHolderId ?? this.selectOutfielder(team, 'CM');
    this.ballHolderId = holderId;
    const holderSheet = this.getPlayerSheet(holderId);

    if (action === 'recycle' || action === 'progress' || action === 'switch') {
      // Short passes
      const baseDur = this.rng.int(K.durations[action][0], K.durations[action][1]);
      const dur = Math.round(baseDur * tempoMultiplier);
      this.t += dur;
      this.teamStats[side].possessionSec += dur;
      this.teamStats[side].passes++;
      this.updatePlayerMinutes(dur);

      const pl = this.playerLines[holderId];
      if (pl) pl.passes++;

      // Pick destination
      const dest = this.pickPassDestination(action, this.ballPosAttacking);
      const destAbs = toAbsolute(dest.ax, dest.ay, side, this.half);

      // Receiver & Defender
      const receiverId = this.pickReceiverId(team, holderId, dest);
      const receiverSheet = this.getPlayerSheet(receiverId);
      const defenderId = this.selectPrimaryDefenderId(oppTeam);
      const defenderSheet = defenderId ? this.getPlayerSheet(defenderId) : null;

      // Pass contest
      const sPass =
        0.6 * z(holderSheet.attributes.passing) +
        0.2 * z(holderSheet.attributes.decisions) +
        0.2 * z(holderSheet.attributes.composure) +
        (side === 'home' ? K.homeAdvantage : 0) +
        this.getTrainingBonus(side, 'attack');

      const sPress = defenderSheet
        ? 0.5 * z(defenderSheet.attributes.positioning) +
          0.3 * z(defenderSheet.attributes.workRate) +
          0.2 * z(defenderSheet.attributes.tackling) +
          (oppTeam.side === 'home' ? K.homeAdvantage : 0)
        : 0;

      let ctx = 0;
      const destThird = classifyThird(dest.ax);
      if (destThird === 'ATT') ctx -= 0.6;
      else if (destThird === 'MID') ctx -= 0.2;

      if (oppTeam.instructions.pressing === 'High') ctx -= 0.35;
      else if (oppTeam.instructions.pressing === 'Low') ctx += 0.2;

      if (team.instructions.tempo === 'Fast') ctx -= 0.2;
      else if (team.instructions.tempo === 'Slow') ctx += 0.15;

      if (this.input.weather === 'Rain') ctx -= 0.08;

      const pPass = sigmoid(
        K.passBase[action] +
          K.coefficients.passSkill * sPass +
          K.coefficients.passReceiverFirstTouch * z(receiverSheet.attributes.firstTouch) -
          K.coefficients.passDefenderPress * sPress +
          ctx,
      );

      if (this.rng.chance(pPass)) {
        // Success
        this.teamStats[side].passesCompleted++;
        if (pl) pl.passesCompleted++;

        this.emitEvent('PASS', dur, {
          side,
          playerId: holderId,
          targetId: receiverId,
          from: this.ballPosAbsolute,
          to: destAbs,
          height: 'ground',
          importance: 0,
        });

        this.lastPasserId = holderId;
        this.ballHolderId = receiverId;
        this.ballPosAttacking = dest;
        this.ballPosAbsolute = destAbs;
      } else {
        // Failure
        if (this.rng.chance(0.75) && defenderId) {
          // Interception
          this.teamStats[oppSide].interceptions++;
          const defPl = this.playerLines[defenderId];
          if (defPl) defPl.interceptions++;

          this.emitEvent('INTERCEPTION', dur, {
            side: oppSide,
            playerId: defenderId,
            opponentId: holderId,
            from: this.ballPosAbsolute,
            to: destAbs,
            importance: 1,
          });

          this.checkTransition(oppSide, side, dest);
        } else {
          // Throw-in to opponent
          this.emitEvent('PASS_FAIL', dur, {
            side,
            playerId: holderId,
            from: this.ballPosAbsolute,
            to: destAbs,
            importance: 0,
          });

          this.pendingRestart = {
            type: 'THROW_IN',
            side: oppSide,
            pos: { ax: 105 - dest.ax, ay: dest.ay < 34 ? 0 : 68 },
          };
        }
      }
    } else if (action === 'dribble') {
      const baseDur = this.rng.int(K.durations.dribble[0], K.durations.dribble[1]);
      const dur = Math.round(baseDur * tempoMultiplier);
      this.t += dur;
      this.teamStats[side].possessionSec += dur;
      this.updatePlayerMinutes(dur);

      const pl = this.playerLines[holderId];

      const dest = this.pickDribbleDestination(this.ballPosAttacking);
      const destAbs = toAbsolute(dest.ax, dest.ay, side, this.half);

      const defenderId = this.selectPrimaryDefenderId(oppTeam);
      const defenderSheet = defenderId ? this.getPlayerSheet(defenderId) : null;

      const sDrib =
        0.5 * z(holderSheet.attributes.dribbling) +
        0.25 * z(holderSheet.attributes.pace) +
        0.25 * z(holderSheet.attributes.firstTouch) +
        (side === 'home' ? K.homeAdvantage : 0);

      const sTkl = defenderSheet
        ? 0.5 * z(defenderSheet.attributes.tackling) +
          0.3 * z(defenderSheet.attributes.positioning) +
          0.2 * z(defenderSheet.attributes.strength) +
          (oppTeam.side === 'home' ? K.homeAdvantage : 0)
        : 0;

      const paceDiff = defenderSheet
        ? z(holderSheet.attributes.pace) - z(defenderSheet.attributes.pace)
        : 0;

      const pDribble = sigmoid(
        K.intercepts.dribble +
          K.coefficients.dribbleSkill * sDrib -
          K.coefficients.dribbleTackle * sTkl +
          K.coefficients.dribblePaceDiff * paceDiff,
      );

      if (this.rng.chance(pDribble)) {
        // Success
        if (pl) pl.dribbles++;
        this.emitEvent('DRIBBLE', dur, {
          side,
          playerId: holderId,
          from: this.ballPosAbsolute,
          to: destAbs,
          importance: 0,
        });

        this.ballPosAttacking = dest;
        this.ballPosAbsolute = destAbs;
      } else {
        const liveP = this.players[holderId];
        if (liveP) liveP.failedDribbles++;

        const inBoxNow = isBox(this.ballPosAttacking.ax, this.ballPosAttacking.ay);
        const foulChance = inBoxNow ? K.fouls.boxDribbleFoulChance : K.fouls.failedDribbleChance;

        if (!this.rng.chance(foulChance) && defenderId) {
          this.teamStats[oppSide].tackles++;
          const defPl = this.playerLines[defenderId];
          if (defPl) defPl.tackles++;

          this.emitEvent('TACKLE', dur, {
            side: oppSide,
            playerId: defenderId,
            opponentId: holderId,
            from: this.ballPosAbsolute,
            to: destAbs,
            importance: 1,
          });

          this.checkTransition(oppSide, side, dest);
        } else {
          // Foul by defender
          this.triggerFoul(oppSide, side, this.ballPosAttacking, defenderId ?? undefined);
        }
      }
    } else if (action === 'long') {
      const baseDur = this.rng.int(K.durations.long[0], K.durations.long[1]);
      const dur = Math.round(baseDur * tempoMultiplier);
      this.t += dur;
      this.teamStats[side].possessionSec += dur;
      this.teamStats[side].passes++;
      this.updatePlayerMinutes(dur);

      const dest = {
        ax: clamp(this.ballPosAttacking.ax + this.rng.int(30, 45), 70, 100),
        ay: this.rngFloat(15, 53),
      };
      const destAbs = toAbsolute(dest.ax, dest.ay, side, this.half);

      const receiverId = this.pickReceiverId(team, holderId, dest);
      const receiverSheet = this.getPlayerSheet(receiverId);
      const defenderId = this.selectPrimaryDefenderId(oppTeam);
      const defenderSheet = defenderId ? this.getPlayerSheet(defenderId) : null;

      const pDelivery = sigmoid(
        K.intercepts.longBallDelivery + 0.8 * z(holderSheet.attributes.passing),
      );

      this.emitEvent('LONG_BALL', dur, {
        side,
        playerId: holderId,
        from: this.ballPosAbsolute,
        to: destAbs,
        height: 'lofted',
        importance: 0,
      });

      const sAirAtt =
        0.6 * z(receiverSheet.attributes.heading) +
        0.4 * z(receiverSheet.attributes.strength) +
        (side === 'home' ? K.homeAdvantage : 0);

      const sAirDef = defenderSheet
        ? 0.5 * z(defenderSheet.attributes.heading) +
          0.3 * z(defenderSheet.attributes.strength) +
          0.2 * z(defenderSheet.attributes.positioning) +
          (oppTeam.side === 'home' ? K.homeAdvantage : 0)
        : 0;

      const lineBonus = oppTeam.instructions.line === 'High' ? 0.3 : 0;
      const isDelivered = this.rng.chance(pDelivery);
      const deliveryBonus = isDelivered ? 0.4 : -0.4;
      const pWin = sigmoid(
        K.intercepts.longBallAerial + 0.7 * sAirAtt - 0.7 * sAirDef + lineBonus + deliveryBonus,
      );

      if (this.rng.chance(pWin)) {
        this.teamStats[side].passesCompleted++;
        this.emitEvent('AERIAL_DUEL', 2, {
          side,
          playerId: receiverId,
          opponentId: defenderId ?? undefined,
          importance: 1,
        });

        this.lastPasserId = holderId;
        this.ballHolderId = receiverId;
        this.ballPosAttacking = dest;
        this.ballPosAbsolute = destAbs;
      } else {
        // Lost duel
        this.emitEvent('AERIAL_DUEL', 2, {
          side,
          playerId: receiverId,
          opponentId: defenderId ?? undefined,
          importance: 1,
        });

        if (this.rng.chance(K.fouls.lostAerialDuelChance)) {
          // Foul by receiver
          this.triggerFoul(side, oppSide, dest, receiverId);
        } else {
          this.checkTransition(oppSide, side, dest);
        }
      }
    } else if (action === 'through') {
      const baseDur = this.rng.int(K.durations.through[0], K.durations.through[1]);
      const dur = Math.round(baseDur * tempoMultiplier);
      this.t += dur;
      this.teamStats[side].possessionSec += dur;
      this.teamStats[side].passes++;
      this.updatePlayerMinutes(dur);

      const inBoxDest = this.rng.chance(0.6);
      const dest = {
        ax: inBoxDest ? this.rngFloat(89, 100) : this.rngFloat(72, 85),
        ay: this.rngFloat(24, 44),
      };
      const destAbs = toAbsolute(dest.ax, dest.ay, side, this.half);

      const receiverId = this.pickReceiverId(team, holderId, dest);
      const receiverSheet = this.getPlayerSheet(receiverId);
      const defenderId = this.selectPrimaryDefenderId(oppTeam);
      const defenderSheet = defenderId ? this.getPlayerSheet(defenderId) : null;

      const sTp =
        0.6 * z(holderSheet.attributes.passing) +
        0.4 * z(holderSheet.attributes.decisions) +
        (side === 'home' ? K.homeAdvantage : 0);

      const sRun =
        0.5 * z(receiverSheet.attributes.offTheBall) + 0.5 * z(receiverSheet.attributes.pace);

      const sCover = defenderSheet
        ? 0.6 * z(defenderSheet.attributes.positioning) +
          0.4 * z(defenderSheet.attributes.pace) +
          (oppTeam.side === 'home' ? K.homeAdvantage : 0)
        : 0;

      const lineCtx =
        oppTeam.instructions.line === 'High'
          ? 0.4
          : oppTeam.instructions.line === 'Deep'
            ? -0.4
            : 0;

      const pThrough = sigmoid(
        K.intercepts.throughBall +
          K.coefficients.throughBallPasser * sTp +
          K.coefficients.throughBallRunner * sRun -
          K.coefficients.throughBallCover * sCover +
          lineCtx,
      );

      if (this.rng.chance(pThrough)) {
        // Success
        this.teamStats[side].passesCompleted++;
        this.lastPasserId = holderId;
        this.ballHolderId = receiverId;
        this.ballPosAttacking = dest;
        this.ballPosAbsolute = destAbs;

        this.emitEvent('THROUGH_BALL', dur, {
          side,
          playerId: holderId,
          targetId: receiverId,
          from: this.ballPosAbsolute,
          to: destAbs,
          importance: 1,
        });

        // Forced One-on-one check
        const p1v1 =
          oppTeam.instructions.line === 'High'
            ? 0.35
            : oppTeam.instructions.line === 'Deep'
              ? 0.1
              : 0.2;

        if (this.rng.chance(p1v1)) {
          this.forcedAction = { action: 'shot', context: 'ONE_ON_ONE' };
        }
      } else {
        // Failure: Offside or Interception
        const pOffside =
          oppTeam.instructions.line === 'High'
            ? 0.55
            : oppTeam.instructions.line === 'Deep'
              ? 0.15
              : 0.38;

        if (this.rng.chance(pOffside)) {
          this.teamStats[side].offsides++;
          this.emitEvent('OFFSIDE', K.durations.offside, {
            side,
            playerId: receiverId,
            importance: 1,
          });

          this.pendingRestart = {
            type: 'FREE_KICK',
            side: oppSide,
            pos: { ax: 105 - dest.ax, ay: 68 - dest.ay },
          };
        } else {
          this.emitEvent('INTERCEPTION', dur, {
            side: oppSide,
            playerId: defenderId ?? undefined,
            opponentId: holderId,
            from: this.ballPosAbsolute,
            to: destAbs,
            importance: 0,
          });

          this.checkTransition(oppSide, side, dest);
        }
      }
    } else if (action === 'cross') {
      const baseDur = this.rng.int(K.durations.cross[0], K.durations.cross[1]);
      const dur = Math.round(baseDur * tempoMultiplier);
      this.t += dur;
      this.teamStats[side].possessionSec += dur;
      this.updatePlayerMinutes(dur);

      const gkId = oppTeam.lineup[0] ?? null;
      const gkSheet = gkId ? this.getPlayerSheet(gkId) : holderSheet;

      this.emitEvent('CROSS', dur, {
        side,
        playerId: holderId,
        from: this.ballPosAbsolute,
        to: toAbsolute(95, 34, side, this.half),
        height: 'lofted',
        importance: 1,
      });

      // 1. GK claim
      const pClaim =
        K.intercepts.gkClaimBase + K.intercepts.gkClaimSlope * z(gkSheet.attributes.aerialCommand);

      if (this.rng.chance(pClaim)) {
        this.emitEvent('CLAIM', 3, {
          side: oppSide,
          playerId: gkId ?? undefined,
          importance: 1,
        });

        this.possessionSide = oppSide;
        this.ballHolderId = gkId;
        this.ballPosAttacking = { ax: 16, ay: 34 };
        this.ballPosAbsolute = toAbsolute(16, 34, oppSide, this.half);
        return;
      }

      // 2. Delivery
      const pDelivery = sigmoid(
        K.intercepts.crossDelivery +
          0.8 * z(holderSheet.attributes.crossing) +
          this.getTrainingBonus(side, 'attack'),
      );

      if (!this.rng.chance(pDelivery)) {
        // Clearance (55% corner)
        if (this.rng.chance(0.55)) {
          this.pendingRestart = {
            type: 'CORNER',
            side,
            pos: { ax: 105, ay: this.ballPosAttacking.ay < 34 ? 0 : 68 },
          };
        } else {
          this.emitEvent('CLEARANCE', 2, {
            side: oppSide,
            importance: 0,
          });
          this.checkTransition(oppSide, side, { ax: 35, ay: 34 });
        }
        return;
      }

      // 3. Header duel
      const attInBox = this.getPlayersInBox(team, side);
      const defInBox = this.getPlayersInBox(oppTeam, oppSide);
      const targetAtt = attInBox[0] ?? holderSheet;
      const targetDef = defInBox[0] ?? null;

      const sAirAtt =
        0.6 * z(targetAtt.attributes.heading) +
        0.4 * z(targetAtt.attributes.strength) +
        (side === 'home' ? K.homeAdvantage : 0);

      const sAirDef = targetDef
        ? 0.5 * z(targetDef.attributes.heading) +
          0.3 * z(targetDef.attributes.strength) +
          0.2 * z(targetDef.attributes.positioning) +
          (oppSide === 'home' ? K.homeAdvantage : 0)
        : 0;

      const pWin = sigmoid(K.intercepts.crossHeader + 0.8 * sAirAtt - 0.8 * sAirDef);

      if (this.rng.chance(pWin)) {
        const shotCtx: ShotContext = this.rng.chance(0.4) ? 'BOX_CENTRAL' : 'HEADER';
        const shotRes = resolveShot({
          context: shotCtx,
          attacker: targetAtt,
          goalkeeper: gkSheet,
          defender: targetDef,
          trainingBonus: this.getTrainingBonus(side, 'attack'),
          homeAdvantage: side === 'home' ? K.homeAdvantage : 0,
          defenderHomeAdvantage: oppSide === 'home' ? K.homeAdvantage : 0,
          rng: this.rng,
        });

        this.processShotResult(side, targetAtt.id, shotCtx, shotRes, targetDef?.id);
      } else {
        this.emitEvent('CLEARANCE', 2, {
          side: oppSide,
          playerId: targetDef?.id,
          importance: 0,
        });

        if (this.rng.chance(0.4)) {
          // Attacker wins second ball
          this.ballPosAttacking = { ax: 52.5, ay: 34 };
          this.ballPosAbsolute = toAbsolute(52.5, 34, side, this.half);
          this.ballHolderId = this.selectOutfielder(team, 'CM');
        } else {
          this.checkTransition(oppSide, side, { ax: 35, ay: 34 });
        }
      }
    } else if (action === 'shot') {
      const dur = this.rng.int(K.durations.shot[0], K.durations.shot[1]);
      this.t += dur;
      this.teamStats[side].possessionSec += dur;
      this.updatePlayerMinutes(dur);

      const ctx: ShotContext = forcedCtx ?? this.determineShotContext(this.ballPosAttacking);

      const gkId = oppTeam.lineup[0] ?? null;
      const gkSheet = gkId ? this.getPlayerSheet(gkId) : holderSheet;
      const defId = this.selectPrimaryDefenderId(oppTeam);
      const defSheet = defId ? this.getPlayerSheet(defId) : null;

      const shotRes = resolveShot({
        context: ctx,
        attacker: holderSheet,
        goalkeeper: gkSheet,
        defender: defSheet,
        trainingBonus: this.getTrainingBonus(side, 'attack'),
        homeAdvantage: side === 'home' ? K.homeAdvantage : 0,
        defenderHomeAdvantage: oppSide === 'home' ? K.homeAdvantage : 0,
        rng: this.rng,
      });

      this.processShotResult(side, holderId, ctx, shotRes, defId ?? undefined);
    } else if (action === 'clear') {
      const dur = 3;
      this.t += dur;
      this.teamStats[side].possessionSec += dur;
      this.updatePlayerMinutes(dur);

      const dest = {
        ax: this.rng.chance(0.6) ? 52.5 : 80,
        ay: this.rngFloat(15, 53),
      };

      this.emitEvent('CLEARANCE', dur, {
        side,
        playerId: holderId,
        from: this.ballPosAbsolute,
        to: toAbsolute(dest.ax, dest.ay, side, this.half),
        height: 'high',
        importance: 0,
      });

      if (this.rng.chance(0.5)) {
        // Clearing side keeps
        this.ballHolderId = this.selectOutfielder(team, 'CM');
        this.ballPosAttacking = dest;
        this.ballPosAbsolute = toAbsolute(dest.ax, dest.ay, side, this.half);
      } else {
        this.checkTransition(oppSide, side, dest);
      }
    }
  }

  private processShotResult(
    side: Side,
    attackerId: PlayerId,
    context: ShotContext,
    res: ShotResolutionResult,
    defenderId?: PlayerId,
  ): void {
    const oppSide: Side = side === 'home' ? 'away' : 'home';
    const oppTeam = oppSide === 'home' ? this.homeTeam : this.awayTeam;
    const teamStats = this.teamStats[side];
    const pl = this.playerLines[attackerId];

    teamStats.shots++;
    teamStats.xg += res.xg;
    if (res.xg >= 0.3) teamStats.bigChances++;
    if (pl) {
      pl.shots++;
      if (res.onTarget) pl.shotsOnTarget++;
    }
    if (res.onTarget) teamStats.shotsOnTarget++;

    // Key pass & Assist credit to last passer
    if (this.lastPasserId && this.lastPasserId !== attackerId) {
      const passerPl = this.playerLines[this.lastPasserId];
      if (passerPl) {
        passerPl.keyPasses++;
        if (res.outcome === 'GOAL') {
          passerPl.assists++;
        }
      }
    }

    // Shot event
    this.emitEvent('SHOT', 2, {
      side,
      playerId: attackerId,
      opponentId: defenderId,
      from: this.ballPosAbsolute,
      to: toAbsolute(105, 34 + res.target.y, side, this.half),
      shot: {
        context,
        xg: res.xg,
        onTarget: res.onTarget,
        bodyPart: res.bodyPart,
        target: res.target,
      },
      importance: res.outcome === 'GOAL' ? 3 : 2,
    });

    if (res.outcome === 'GOAL') {
      this.score[side]++;
      teamStats.goals++;
      if (pl) pl.goals++;

      // Track winning goal scorer if this puts team ahead
      if (this.score[side] > this.score[oppSide]) {
        this.winningGoalScorerId = attackerId;
      }

      this.emitEvent('GOAL', K.durations.goal, {
        side,
        playerId: attackerId,
        importance: 3,
      });

      this.t += K.durations.goal;
      this.pendingRestart = {
        type: 'KICKOFF',
        side: oppSide,
        pos: { ax: 52.5, ay: 34 },
      };
    } else if (res.outcome.startsWith('SAVE')) {
      this.teamStats[oppSide].saves++;
      const gkId = oppTeam.lineup[0] ?? null;
      if (gkId) {
        const gkPl = this.playerLines[gkId];
        if (gkPl) gkPl.saves++;
      }

      this.emitEvent('SAVE', 2, {
        side: oppSide,
        playerId: gkId ?? undefined,
        importance: 2,
      });

      if (res.outcome === 'SAVE_CATCH') {
        this.possessionSide = oppSide;
        this.ballHolderId = gkId;
        this.ballPosAttacking = { ax: 16, ay: 34 };
        this.ballPosAbsolute = toAbsolute(16, 34, oppSide, this.half);
      } else if (res.outcome === 'SAVE_PARRY_CORNER') {
        this.pendingRestart = {
          type: 'CORNER',
          side,
          pos: { ax: 105, ay: res.target.y < 0 ? 0 : 68 },
        };
      } else if (res.outcome === 'SAVE_PARRY_REBOUND') {
        // Rebound shot by attacker in next step
        this.forcedAction = { action: 'shot', context: 'REBOUND' };
      } else {
        // Clear
        this.checkTransition(oppSide, side, { ax: 20, ay: 34 });
      }
    } else if (res.outcome.startsWith('BLOCK')) {
      this.emitEvent('BLOCK', 1, {
        side: oppSide,
        playerId: defenderId,
        importance: 1,
      });

      if (res.outcome === 'BLOCK_CORNER') {
        this.pendingRestart = {
          type: 'CORNER',
          side,
          pos: { ax: 105, ay: 0 },
        };
      } else if (res.outcome === 'BLOCK_RECYCLE') {
        this.ballPosAttacking = { ax: 75, ay: 34 };
        this.ballPosAbsolute = toAbsolute(75, 34, side, this.half);
      } else {
        this.checkTransition(oppSide, side, { ax: 30, ay: 34 });
      }
    } else if (res.outcome.startsWith('POST')) {
      this.emitEvent('POST', 1, {
        side,
        playerId: attackerId,
        importance: 2,
      });

      if (res.outcome === 'POST_REBOUND') {
        this.forcedAction = { action: 'shot', context: 'REBOUND' };
      } else {
        this.pendingRestart = {
          type: 'GOAL_KICK',
          side: oppSide,
          pos: { ax: 16, ay: 34 },
        };
      }
    } else {
      // MISS
      this.emitEvent('MISS', 1, {
        side,
        playerId: attackerId,
        importance: 1,
      });

      this.pendingRestart = {
        type: 'GOAL_KICK',
        side: oppSide,
        pos: { ax: 16, ay: 34 },
      };
    }
  }

  private triggerFoul(
    foulerSide: Side,
    awardedSide: Side,
    foulPos: { ax: number; ay: number },
    foulerId?: PlayerId,
    posSide: Side = this.possessionSide ?? 'home',
  ): void {
    this.teamStats[foulerSide].fouls++;
    const foulerTeam = foulerSide === 'home' ? this.homeTeam : this.awayTeam;
    const fId = foulerId ?? this.selectPrimaryDefenderId(foulerTeam) ?? foulerTeam.lineup[0]!;
    const fLive = this.players[fId]!;
    const fSheet = this.getPlayerSheet(fId);

    // Convert foul position to awardedSide's attacking frame
    const attackingPos =
      awardedSide === posSide ? { ...foulPos } : { ax: 105 - foulPos.ax, ay: 68 - foulPos.ay };

    // Resolve card
    const cardResult = resolveFoulCard(
      {
        personality: fSheet.personality,
        attributes: fSheet.attributes,
        currentYellows: fLive.yellowCards,
      },
      this.rng,
    );

    this.emitEvent('FOUL', K.durations.freeKick, {
      side: foulerSide,
      playerId: fId,
      importance: cardResult !== 'NONE' ? 2 : 1,
    });

    if (cardResult === 'YELLOW') {
      fLive.yellowCards = 1;
      this.teamStats[foulerSide].yellow++;
      const pl = this.playerLines[fId];
      if (pl) pl.yellow = 1;

      this.emitEvent('YELLOW', 0, {
        side: foulerSide,
        playerId: fId,
        importance: 2,
      });
    } else if (cardResult === 'RED_SECOND_YELLOW' || cardResult === 'DIRECT_RED') {
      fLive.isRedCarded = true;
      foulerTeam.redCardedPlayers.push(fId);
      this.teamStats[foulerSide].red++;
      const pl = this.playerLines[fId];
      if (pl) pl.red = 1;

      this.emitEvent('RED', 0, {
        side: foulerSide,
        playerId: fId,
        importance: 3,
      });
    }

    // Determine restart
    const restartType = determineFoulRestart(attackingPos, this.rng);
    if (restartType === 'PENALTY') {
      this.emitEvent('PENALTY_AWARDED', 0, {
        side: awardedSide,
        importance: 3,
      });
      this.pendingRestart = {
        type: 'PENALTY',
        side: awardedSide,
        pos: { ax: 94, ay: 34 },
      };
    } else if (restartType === 'DIRECT_FK') {
      this.pendingRestart = {
        type: 'FREE_KICK',
        side: awardedSide,
        pos: { ...attackingPos },
        shotContext: 'DIRECT_FK',
      };
    } else {
      this.pendingRestart = {
        type: 'FREE_KICK',
        side: awardedSide,
        pos: { ...attackingPos },
      };
    }
  }

  private checkTransition(
    winnerSide: Side,
    loserSide: Side,
    loserPosAttacking: { ax: number; ay: number },
  ): void {
    const winnerTeam = winnerSide === 'home' ? this.homeTeam : this.awayTeam;
    const loserTeam = loserSide === 'home' ? this.homeTeam : this.awayTeam;

    // Mirrored point in winner's attacking frame:
    // winner attacks opposite direction, so ax = 105 - loser.ax, ay = 68 - loser.ay
    const newPos = {
      ax: 105 - loserPosAttacking.ax,
      ay: 68 - loserPosAttacking.ay,
    };

    this.possessionSide = winnerSide;
    this.ballPosAttacking = newPos;
    this.ballPosAbsolute = toAbsolute(newPos.ax, newPos.ay, winnerSide, this.half);
    this.ballHolderId = this.selectOutfielder(winnerTeam, 'CM');

    // Counter-attack trigger check (§13.9)
    const winnerThird = classifyThird(newPos.ax);
    const isWinnerDefOrMid = winnerThird === 'DEF' || winnerThird === 'MID';
    const loserAttacking =
      loserTeam.instructions.mentality === 'Attacking' || loserTeam.instructions.line === 'High';

    if (isWinnerDefOrMid && loserAttacking) {
      this.phase = { type: 'COUNTER', remainingSteps: 2 };
    } else {
      this.phase = { type: 'OPEN' };
    }
  }

  private pickPassDestination(
    action: 'recycle' | 'progress' | 'switch',
    currentPos: { ax: number; ay: number },
  ): { ax: number; ay: number } {
    let ax = currentPos.ax;
    let ay = currentPos.ay;

    if (action === 'recycle') {
      // 60% same third, 40% back one third
      if (this.rng.chance(0.4)) {
        ax = Math.max(10, ax - this.rng.int(18, 28));
      } else {
        ax = clamp(ax + this.rng.int(-8, 8), 5, 86);
      }
      // Weighted toward Centre 50%
      ay = this.rng.chance(0.5) ? this.rngFloat(25, 43) : this.rngFloat(5, 63);
    } else if (action === 'progress') {
      // Forward one third (or into box from ATT: 45%) - SPEC §13.7
      if (ax < 35) {
        // DEF -> MID
        ax = this.rngFloat(40, 65);
        if (this.rng.chance(0.4)) ay = clamp(ay + this.rngFloat(-12, 12), 5, 63);
      } else if (ax < 70) {
        // MID -> ATT (outside box)
        ax = this.rngFloat(72, 86);
        if (this.rng.chance(0.4)) ay = clamp(ay + this.rngFloat(-12, 12), 5, 63);
      } else {
        // ATT -> 45% into box, 55% stay in ATT
        if (this.rng.chance(0.45)) {
          ax = this.rngFloat(89, 98);
          ay = this.rngFloat(18, 50);
        } else {
          ax = this.rngFloat(74, 87);
          ay = clamp(ay + this.rngFloat(-10, 10), 5, 63);
        }
      }
    } else if (action === 'switch') {
      // same third, lane Left <-> Right
      if (ay < 22.67) {
        ay = this.rngFloat(46, 62);
      } else if (ay >= 45.33) {
        ay = this.rngFloat(6, 22);
      } else {
        ay = this.rng.chance(0.5) ? this.rngFloat(6, 22) : this.rngFloat(46, 62);
      }
    }

    return { ax, ay };
  }

  private pickDribbleDestination(currentPos: { ax: number; ay: number }): {
    ax: number;
    ay: number;
  } {
    // forward within the third (50%) or next third/box
    const ax = this.rng.chance(0.5)
      ? clamp(currentPos.ax + this.rngFloat(5, 12), 10, 102)
      : clamp(currentPos.ax + this.rngFloat(15, 25), 10, 102);
    const ay = clamp(currentPos.ay + this.rngFloat(-8, 8), 5, 63);
    return { ax, ay };
  }

  private determineShotContext(pos: { ax: number; ay: number }): ShotContext {
    if (isSixYardBox(pos.ax, pos.ay)) return 'SIX_YARD';
    if (isBox(pos.ax, pos.ay)) {
      const lane = classifyLane(pos.ay);
      return lane === 'Centre' ? 'BOX_CENTRAL' : 'BOX_WIDE';
    }
    const lane = classifyLane(pos.ay);
    return lane === 'Centre' ? 'OUTSIDE_CENTRAL' : 'OUTSIDE_WIDE';
  }

  private static involvementCache = new Map<
    string,
    Record<'DEF' | 'MID' | 'ATT', Record<'Left' | 'Centre' | 'Right', number>>
  >();

  private getCachedInvolvement(
    team: LiveTeamState,
    role: string,
    duty: Duty,
  ): Record<'DEF' | 'MID' | 'ATT', Record<'Left' | 'Centre' | 'Right', number>> {
    const key = `${team.formation}_${role}_${team.instructions.mentality}_${duty}_${team.instructions.width}`;
    let cached = MatchEngine.involvementCache.get(key);
    if (!cached) {
      cached = getInvolvementWeights({
        role,
        mentality: team.instructions.mentality,
        duty,
        width: team.instructions.width,
      });
      MatchEngine.involvementCache.set(key, cached);
    }
    return cached;
  }

  private pickReceiverId(
    team: LiveTeamState,
    holderId: PlayerId,
    dest: { ax: number; ay: number },
  ): PlayerId {
    const third = classifyThird(dest.ax);
    const lane = classifyLane(dest.ay);
    const fDef = FORMATIONS[team.formation];

    const lineup = team.lineup;
    const duties = team.duties;
    const redSet = team.redCardedPlayers;

    let totalWeight = 0;
    const candidateIds: PlayerId[] = [];
    const candidateWeights: number[] = [];

    for (let slot = 0; slot < lineup.length; slot++) {
      const id = lineup[slot];
      if (!id || id === holderId || redSet.includes(id)) continue;
      const role = fDef.slots[slot]?.role || 'CM';
      const duty = duties[slot] || 'Support';
      const weights = this.getCachedInvolvement(team, role, duty);
      const w = Math.max(0.0001, weights[third][lane]);
      candidateIds.push(id);
      candidateWeights.push(w);
      totalWeight += w;
    }

    if (candidateIds.length === 0) return lineup[0]!;

    let roll = this.rng.next() * totalWeight;
    for (let i = 0; i < candidateIds.length; i++) {
      roll -= candidateWeights[i]!;
      if (roll <= 0) return candidateIds[i]!;
    }
    return candidateIds[candidateIds.length - 1]!;
  }

  private selectPrimaryDefenderId(oppTeam: LiveTeamState): PlayerId | null {
    // Invert third and mirror lane for defender
    const third = classifyThird(this.ballPosAttacking.ax);
    const lane = classifyLane(this.ballPosAttacking.ay);

    const mirroredThird = third === 'ATT' ? 'DEF' : third === 'DEF' ? 'ATT' : 'MID';
    const mirroredLane = lane === 'Left' ? 'Right' : lane === 'Right' ? 'Left' : 'Centre';

    const inBoxNow = isBox(this.ballPosAttacking.ax, this.ballPosAttacking.ay);
    const fDef = FORMATIONS[oppTeam.formation];

    const lineup = oppTeam.lineup;
    const duties = oppTeam.duties;
    const redSet = oppTeam.redCardedPlayers;

    let totalWeight = 0;
    const candidateIds: PlayerId[] = [];
    const candidateWeights: number[] = [];

    for (let slot = 0; slot < lineup.length; slot++) {
      const id = lineup[slot];
      if (!id || redSet.includes(id)) continue;
      if (slot === 0 && !inBoxNow) continue;
      const role = fDef.slots[slot]?.role || 'CM';
      const duty = duties[slot] || 'Defend';
      const weights = this.getCachedInvolvement(oppTeam, role, duty);
      const w = Math.max(0.0001, weights[mirroredThird][mirroredLane]);
      candidateIds.push(id);
      candidateWeights.push(w);
      totalWeight += w;
    }

    if (candidateIds.length === 0) return lineup[0] ?? null;

    let roll = this.rng.next() * totalWeight;
    for (let i = 0; i < candidateIds.length; i++) {
      roll -= candidateWeights[i]!;
      if (roll <= 0) return candidateIds[i]!;
    }
    return candidateIds[candidateIds.length - 1]!;
  }

  private selectOutfielder(team: LiveTeamState, preferredPos: Position): PlayerId {
    for (let i = 1; i < team.lineup.length; i++) {
      const id = team.lineup[i];
      if (id && !team.redCardedPlayers.includes(id)) {
        if (this.getPlayerPosition(id) === preferredPos) return id;
      }
    }
    for (let i = 1; i < team.lineup.length; i++) {
      const id = team.lineup[i];
      if (id && !team.redCardedPlayers.includes(id)) return id;
    }
    return team.lineup[0]!;
  }

  private selectPressingFouler(foulerTeam: LiveTeamState): PlayerId {
    const eligible: PlayerId[] = [];
    for (let i = 1; i < foulerTeam.lineup.length; i++) {
      const id = foulerTeam.lineup[i];
      if (id && !foulerTeam.redCardedPlayers.includes(id)) {
        eligible.push(id);
      }
    }
    if (eligible.length === 0) return foulerTeam.lineup[0]!;
    return this.rng.pick(eligible);
  }

  private findBestTakerForThrowIn(team: LiveTeamState): PlayerId {
    for (let i = 1; i < team.lineup.length; i++) {
      const id = team.lineup[i];
      if (id && !team.redCardedPlayers.includes(id)) {
        const pos = this.getPlayerPosition(id);
        if (pos === 'LB' || pos === 'RB' || pos === 'LM' || pos === 'RM') {
          return id;
        }
      }
    }
    return this.selectOutfielder(team, 'CM');
  }

  private getPlayersInBox(team: LiveTeamState, side: Side): any[] {
    const players: any[] = [];
    team.lineup.forEach((id, slot) => {
      if (!id || team.redCardedPlayers.includes(id) || slot === 0) return;
      const sheet = this.getPlayerSheet(id);
      const pos = this.getPlayerPosition(id);
      players.push({
        id,
        name: sheet.name,
        slot,
        attributes: sheet.attributes,
        condition: this.players[id]!.condition,
        morale: this.players[id]!.morale,
        isCbOrSt: pos === 'CB' || pos === 'ST',
      });
    });
    return players;
  }

  private getSetPiecePlayer(id: PlayerId): any {
    const sheet = this.getPlayerSheet(id);
    const live = this.players[id]!;
    return {
      id,
      name: sheet.name,
      slot: 0,
      attributes: sheet.attributes,
      condition: live.condition,
      morale: live.morale,
    };
  }

  private getPlayerPosition(id: PlayerId): Position {
    const pHome = this.input.home.players[id];
    if (pHome) return pHome.positions[0]?.pos || 'CM';
    const pAway = this.input.away.players[id];
    if (pAway) return pAway.positions[0]?.pos || 'CM';
    return 'CM';
  }

  private getPlayerSheet(id: PlayerId): any {
    const pHome = this.input.home.players[id];
    if (pHome) return pHome;
    const pAway = this.input.away.players[id];
    if (pAway) return pAway;
    throw new Error(`Player ${id} not found in team sheets`);
  }

  private getTrainingBonus(side: Side, type: 'attack' | 'defence' | 'setPieces'): number {
    const sheet = side === 'home' ? this.input.home : this.input.away;
    return sheet.trainingBonus[type] || 0;
  }

  private finalizeRatings(): void {
    const homeGoals = this.score.home;
    const awayGoals = this.score.away;

    for (const [idStr, pl] of Object.entries(this.playerLines)) {
      const id = idStr as PlayerId;
      const live = this.players[id]!;
      const isGk = this.getPlayerPosition(id) === 'GK';
      const pos = this.getPlayerPosition(id);
      const isDef = pos === 'CB' || pos === 'LB' || pos === 'RB' || pos === 'LWB' || pos === 'RWB';

      const isHome = pl.side === 'home';
      const teamConceded = isHome ? awayGoals : homeGoals;
      const isClean = teamConceded === 0;
      const teamWon = isHome ? homeGoals > awayGoals : awayGoals > homeGoals;
      const teamLost = isHome ? homeGoals < awayGoals : awayGoals < homeGoals;

      pl.rating = computePlayerRating({
        line: pl,
        isGk,
        isDef,
        failedDribbles: live.failedDribbles,
        errorsLeadingToGoal: live.errorsLeadingToGoal,
        teamGoalsConceded: teamConceded,
        isCleanSheet: isClean,
        teamWon,
        teamLost,
        scoredWinningGoal: id === this.winningGoalScorerId,
      });
    }
  }

  public runUntil(targetT: number): MatchEvent[] {
    const startIndex = this.events.length;
    while (this.t < targetT && !this.isFinishedState) {
      this.step();
    }
    return this.events.slice(startIndex);
  }

  public runToEnd(): MatchEvent[] {
    const startIndex = this.events.length;
    while (!this.isFinishedState) {
      this.step();
    }
    return this.events.slice(startIndex);
  }

  public result(): MatchResult {
    if (!this.isFinishedState) {
      this.runToEnd();
    }

    const allLines = Object.values(this.playerLines);
    const winningSide: Side | null =
      this.score.home > this.score.away
        ? 'home'
        : this.score.away > this.score.home
          ? 'away'
          : null;

    const motm = selectMotm(allLines, winningSide);

    return {
      fixtureId: this.input.fixtureId,
      homeGoals: this.score.home,
      awayGoals: this.score.away,
      events: this.events,
      stats: {
        home: { ...this.teamStats.home },
        away: { ...this.teamStats.away },
      },
      players: allLines,
      motm,
      injuries: [...this.injuries],
    };
  }
}

export function createMatch(input: MatchInput, seed: number): MatchSim {
  return new MatchEngine(input, seed);
}

export function restoreMatch(snapshot: MatchSnapshot): MatchSim {
  const engine = new MatchEngine(snapshot.input, snapshot.seed);
  // Re-hydrate snapshot fields
  (engine as any).rng = restoreRng(snapshot.rngSnapshot);
  (engine as any).t = snapshot.t;
  (engine as any).half = snapshot.half;
  (engine as any).periodEnd = snapshot.periodEnd;
  (engine as any).addedTimeAnnounced = snapshot.addedTimeAnnounced;
  (engine as any).possessionSide = snapshot.possessionSide;
  (engine as any).ballPosAttacking = { ...snapshot.ballPosAttacking };
  (engine as any).ballPosAbsolute = { ...snapshot.ballPosAbsolute };
  (engine as any).ballHolderId = snapshot.ballHolderId;
  (engine as any).phase = { ...snapshot.phase };
  (engine as any).pendingRestart = snapshot.pendingRestart ? { ...snapshot.pendingRestart } : null;
  (engine as any).homeTeam = JSON.parse(JSON.stringify(snapshot.homeTeam));
  (engine as any).awayTeam = JSON.parse(JSON.stringify(snapshot.awayTeam));
  (engine as any).players = JSON.parse(JSON.stringify(snapshot.players));
  (engine as any).teamStats = JSON.parse(JSON.stringify(snapshot.teamStats));
  (engine as any).playerLines = JSON.parse(JSON.stringify(snapshot.playerLines));
  (engine as any).score = { ...snapshot.score };
  (engine as any).events = [...snapshot.events];
  (engine as any).seq = snapshot.seq;
  (engine as any).pendingCommands = [...snapshot.pendingCommands];
  (engine as any).injuries = [...snapshot.injuries];
  (engine as any).isFinishedState = snapshot.isFinished;
  return engine;
}

export function simulateInstant(input: MatchInput, seed: number): MatchResult {
  const sim = new MatchEngine(input, seed, false);
  return sim.result();
}
