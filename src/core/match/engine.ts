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
  RoleId,
  DefRoleId,
  PlayerInstruction,
  DefInstruction,
  OppOrder,
  TraitId,
  ShoutId,
  MatchPlanRule,
} from '../types';
import { isTraitClashing } from '../player/traits';
import { createRng, restoreRng, Rng } from '../rng';
import { z, sigmoid, logit, clamp, roundTo } from '../math';
import { K, BALANCE } from '@/config/balance';
import { FORMATIONS } from '@/config/formations';
import {
  computeRoleFit,
  getDefaultRoleForPos,
  computeDefRoleFit,
  computeInstructionFit,
  getDefaultDefRoleForPos,
  migrateRoleToAttAndDef,
} from '@/config/roles';
import {
  toAbsolute,
  toAttacking,
  classifyThird,
  classifyLane,
  isBox,
  isSixYardBox,
  ZoneKey,
  getMirroredZoneKey,
} from './frames';
import {
  selectReceiver,
  selectPrimaryDefender,
  getInvolvementWeights,
  computePlayerInvolvementFull,
  getReceiverWeightMultiplier,
  ZoneWeights,
} from './involvement';
import { selectAction, CandidateAction, ActionSelectionContext } from './actions';
import { resolveShot, ShotResolutionResult } from './shots';
import { resolveFoulCard, determineFoulRestart, getFoulMultiplier } from './fouls';
import {
  resolveCorner,
  createDefaultSetPieceTactics,
  generateAutoCornerJobs,
  calculateWallEffect,
} from './setPieces';
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
  private lastPassType: 'short' | 'long' | 'through' | 'cross' | null = null;
  private holdsUpRecycleBonus: boolean = false;
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

  // Tactical Depth State (§13.17)
  private stepsAfterRegroupWin: number = 0;
  private stepsAfterKeepItWin: number = 0;
  private pressBeatenSteps: number = 0;
  private firstStepWideDistribution: boolean = false;
  private targetManKnockDownSteps: number = 0;
  private stopperBeatenSteps: number = 0;
  private shortCornerCrossBonus: boolean = false;
  private isLongThrowIn: boolean = false;
  private counterPhaseExtraCtx: number = 0;
  private shortFkProgressBonus: boolean = false;

  // SPEC §13.20 Detailed Set Pieces State
  private cornerRoutineIndices = {
    home: { left: 0, right: 0 },
    away: { left: 0, right: 0 },
  };
  private cornerRoutineUses: {
    home: { left: Record<number, number>; right: Record<number, number> };
    away: { left: Record<number, number>; right: Record<number, number> };
  } = {
    home: { left: {}, right: {} },
    away: { left: {}, right: {} },
  };

  // Tactical Depth involvement and role fit cache
  private roleFitCache = new Map<string, number>();
  private teamInvolvementsCache: {
    home: ZoneWeights[] | null;
    away: ZoneWeights[] | null;
  } = { home: null, away: null };

  private getPlayerRoleFit(roleId: RoleId, playerId: PlayerId): number {
    const key = `${roleId}_${playerId}`;
    const cached = this.roleFitCache.get(key);
    if (cached !== undefined) return cached;
    const sheet = this.getPlayerSheet(playerId);
    const f = computeRoleFit(roleId, sheet.attributes).fit;
    this.roleFitCache.set(key, f);
    return f;
  }

  private getDefRoleFit(defRoleId: DefRoleId, playerId: PlayerId): number {
    const key = `def_${defRoleId}_${playerId}`;
    const cached = this.roleFitCache.get(key);
    if (cached !== undefined) return cached;
    const sheet = this.getPlayerSheet(playerId);
    const f = computeDefRoleFit(sheet.attributes, defRoleId).fit;
    this.roleFitCache.set(key, f);
    return f;
  }

  private getInstructionFit(
    instruction: PlayerInstruction | DefInstruction,
    playerId: PlayerId,
    isDef = false,
  ): number {
    const key = `pi_${isDef ? 'def_' : 'att_'}${instruction}_${playerId}`;
    const cached = this.roleFitCache.get(key);
    if (cached !== undefined) return cached;
    const sheet = this.getPlayerSheet(playerId);
    const f = computeInstructionFit(sheet.attributes, instruction, isDef).fit;
    this.roleFitCache.set(key, f);
    return f;
  }

  private getEffectivePlayerTraits(playerId: PlayerId, slot?: number): TraitId[] {
    const sheet = this.getPlayerSheet(playerId);
    const rawTraits = sheet?.traits ?? [];
    if (rawTraits.length === 0) return [];
    let pis: (PlayerInstruction | DefInstruction)[] = [];
    if (slot !== undefined) {
      const team = this.homeTeam.lineup[slot] === playerId ? this.homeTeam : this.awayTeam;
      pis = [
        ...(team.attInstructions?.[slot] ?? team.playerInstructions[slot] ?? []),
        ...(team.defInstructions?.[slot] ?? []),
      ];
    } else {
      const homeSlot = this.homeTeam.lineup.indexOf(playerId);
      if (homeSlot !== -1) {
        pis = [
          ...(this.homeTeam.attInstructions?.[homeSlot] ??
            this.homeTeam.playerInstructions[homeSlot] ??
            []),
          ...(this.homeTeam.defInstructions?.[homeSlot] ?? []),
        ];
      } else {
        const awaySlot = this.awayTeam.lineup.indexOf(playerId);
        if (awaySlot !== -1) {
          pis = [
            ...(this.awayTeam.attInstructions?.[awaySlot] ??
              this.awayTeam.playerInstructions[awaySlot] ??
              []),
            ...(this.awayTeam.defInstructions?.[awaySlot] ?? []),
          ];
        }
      }
    }
    return rawTraits.filter((t: TraitId) => !isTraitClashing(t, pis).clashes);
  }

  private getOpponentShotCtxModifier(
    defendingSide: Side,
    lane: 'Left' | 'Right' | 'Centre',
  ): number {
    const oppTeam = defendingSide === 'home' ? this.homeTeam : this.awayTeam;
    let mod = 0;
    if (oppTeam.activeShout?.shout === 'keepTight') {
      mod += K.shouts.keepTight.oppShotCtxMod * (oppTeam.activeShout.isHalfEffect ? 0.5 : 1.0);
    }
    if (oppTeam.activeShout?.shout === 'concentrate') {
      mod += K.shouts.concentrate.oppShotCtxMod * (oppTeam.activeShout.isHalfEffect ? 0.5 : 1.0);
    }
    if (this.phase.type === 'COUNTER') {
      const fDef = FORMATIONS[oppTeam.formation];
      for (let slot = 0; slot < oppTeam.lineup.length; slot++) {
        const pId = oppTeam.lineup[slot];
        if (!pId) continue;
        const pos = fDef.slots[slot]?.position || 'CM';
        const traits = this.getEffectivePlayerTraits(pId, slot);
        if (traits.includes('getsForward')) {
          const slotLane = ['LB', 'LWB', 'LM', 'LW'].includes(pos)
            ? 'Left'
            : ['RB', 'RWB', 'RM', 'RW'].includes(pos)
              ? 'Right'
              : 'Centre';
          if (slotLane === lane) {
            mod += K.traits.getsForward.theirCounterShotCtxMod;
            break;
          }
        }
      }
      for (let slot = 0; slot < oppTeam.lineup.length; slot++) {
        const pId = oppTeam.lineup[slot];
        if (!pId) continue;
        const traits = this.getEffectivePlayerTraits(pId, slot);
        if (traits.includes('staysBack')) {
          mod += K.traits.staysBack.theirCounterCtxMod;
          break;
        }
      }
    }
    return mod;
  }

  private getTeamInvolvements(side: Side): ZoneWeights[] {
    const cached = this.teamInvolvementsCache[side];
    if (cached) return cached;

    const team = side === 'home' ? this.homeTeam : this.awayTeam;
    const fDef = FORMATIONS[team.formation];
    const list: ZoneWeights[] = [];

    for (let slot = 0; slot < team.lineup.length; slot++) {
      const id = team.lineup[slot];
      const slotPos = fDef.slots[slot]?.position || 'CM';
      const roleId = team.attRoles?.[slot] ?? team.roles[slot] ?? getDefaultRoleForPos(slotPos);
      const pis = team.attInstructions?.[slot] ?? team.playerInstructions[slot] ?? [];
      const fit = id ? this.getPlayerRoleFit(roleId, id) : 1.0;

      const weights = computePlayerInvolvementFull({
        role: fDef.slots[slot]?.role || slotPos,
        roleId,
        fit,
        playerInstructions: pis,
        mentality: team.instructions.mentality,
        width: team.instructions.width,
        traits: id ? this.getEffectivePlayerTraits(id, slot) : [],
      });
      list.push(weights);
    }

    this.teamInvolvementsCache[side] = list;
    return list;
  }

  private invalidateTeamInvolvements(side?: Side): void {
    if (side) {
      this.teamInvolvementsCache[side] = null;
    } else {
      this.teamInvolvementsCache.home = null;
      this.teamInvolvementsCache.away = null;
    }
  }

  private updateDrainRates(): void {
    const homeLossMult = this.homeTeam.instructions.onLoss === 'CounterPress' ? 1.05 : 1.0;
    const awayLossMult = this.awayTeam.instructions.onLoss === 'CounterPress' ? 1.05 : 1.0;
    const homeWinMult = this.homeTeam.instructions.onWin === 'Counter' ? 1.04 : 1.0;
    const awayWinMult = this.awayTeam.instructions.onWin === 'Counter' ? 1.04 : 1.0;
    const homeVeryAttMult =
      this.homeTeam.instructions.mentality === 'VeryAttacking'
        ? K.d2.mentality.veryAttackingFatigueMult
        : 1.0;
    const awayVeryAttMult =
      this.awayTeam.instructions.mentality === 'VeryAttacking'
        ? K.d2.mentality.veryAttackingFatigueMult
        : 1.0;
    const homeShoutDrain =
      this.homeTeam.activeShout?.shout === 'pushForward'
        ? 1 +
          (K.shouts.pushForward.fatigueDrainMult - 1) *
            (this.homeTeam.activeShout.isHalfEffect ? 0.5 : 1.0)
        : 1.0;
    const awayShoutDrain =
      this.awayTeam.activeShout?.shout === 'pushForward'
        ? 1 +
          (K.shouts.pushForward.fatigueDrainMult - 1) *
            (this.awayTeam.activeShout.isHalfEffect ? 0.5 : 1.0)
        : 1.0;

    this.homeDrainRate =
      BALANCE.condition.drainPerMinuteBase *
      BALANCE.condition.pressingFactors[this.homeTeam.instructions.pressing] *
      BALANCE.condition.tempoFactors[this.homeTeam.instructions.tempo] *
      homeLossMult *
      homeWinMult *
      homeVeryAttMult *
      homeShoutDrain;
    this.awayDrainRate =
      BALANCE.condition.drainPerMinuteBase *
      BALANCE.condition.pressingFactors[this.awayTeam.instructions.pressing] *
      BALANCE.condition.tempoFactors[this.awayTeam.instructions.tempo] *
      awayLossMult *
      awayWinMult *
      awayVeryAttMult *
      awayShoutDrain;
  }

  constructor(input: MatchInput, seed: number, enableSnapshots: boolean = true) {
    this.input = input;
    this.seed = seed;
    this.enableSnapshots = enableSnapshots;
    this.rng = createRng(seed);

    // Initialize home team state
    const homeFDef = FORMATIONS[input.home.tactics.formation];
    const awayFDef = FORMATIONS[input.away.tactics.formation];

    const homeAttRoles: RoleId[] = input.home.tactics.attRoles
      ? [...input.home.tactics.attRoles]
      : input.home.tactics.roles
        ? input.home.tactics.roles.map(
            (r, i) => migrateRoleToAttAndDef(r, homeFDef.slots[i]?.position ?? 'CM').attRole,
          )
        : homeFDef.slots.map((s) => getDefaultRoleForPos(s.position));

    const homeDefRoles: DefRoleId[] = input.home.tactics.defRoles
      ? [...input.home.tactics.defRoles]
      : input.home.tactics.roles
        ? input.home.tactics.roles.map(
            (r, i) => migrateRoleToAttAndDef(r, homeFDef.slots[i]?.position ?? 'CM').defRole,
          )
        : homeFDef.slots.map((s) => getDefaultDefRoleForPos(s.position));

    const homeAttInstructions: PlayerInstruction[][] = input.home.tactics.attInstructions
      ? input.home.tactics.attInstructions.map((p) => [...p])
      : input.home.tactics.playerInstructions
        ? input.home.tactics.playerInstructions.map((pis) =>
            pis.filter((pi) => !['closeDownMore', 'stayOnFeet'].includes(pi)),
          )
        : new Array(11).fill([]);

    const homeDefInstructions: DefInstruction[][] = input.home.tactics.defInstructions
      ? input.home.tactics.defInstructions.map((p) => [...p])
      : input.home.tactics.playerInstructions
        ? input.home.tactics.playerInstructions.map(
            (pis) =>
              pis.filter((pi) => ['closeDownMore', 'stayOnFeet'].includes(pi)) as DefInstruction[],
          )
        : new Array(11).fill([]);

    this.homeTeam = {
      clubId: input.home.clubId,
      side: 'home',
      formation: input.home.tactics.formation,
      lineup: [...input.home.tactics.lineup],
      roles: homeAttRoles,
      attRoles: homeAttRoles,
      defRoles: homeDefRoles,
      playerInstructions: homeAttInstructions,
      attInstructions: homeAttInstructions,
      defInstructions: homeDefInstructions,
      opposition: input.home.tactics.opposition ? [...input.home.tactics.opposition] : [],
      duties: input.home.tactics.duties
        ? [...input.home.tactics.duties]
        : new Array(11).fill('Support'),
      bench: [...input.home.tactics.bench],
      instructions: { ...input.home.tactics.instructions },
      captain: input.home.tactics.captain,
      penaltyTaker: input.home.tactics.takers.penalty,
      freeKickTaker: input.home.tactics.takers.freeKick,
      cornerTaker: input.home.tactics.takers.corner,
      longThrowTaker: input.home.tactics.takers.longThrow ?? null,
      takers: input.home.tactics.takers,
      setPieces: input.home.tactics.setPieces ?? createDefaultSetPieceTactics(),
      subsUsed: 0,
      inPlayWindowsUsed: 0,
      redCardedPlayers: [],
      substitutedPlayers: [],
      focusBoostExpiryT: input.home.focusBoost > 0 ? 1200 : 0,
      activeShout: null,
      lastShoutEndT: {},
      shoutCountThisHalf: {},
      matchPlans: input.home.tactics.matchPlans ? [...input.home.tactics.matchPlans] : [],
      firedMatchPlans: [],
      askMeFirst: input.home.tactics.askMeFirst ?? true,
      playerFocusBoost: {},
      teamFocusBoost: null,
    };

    // Initialize away team state
    const awayAttRoles: RoleId[] = input.away.tactics.attRoles
      ? [...input.away.tactics.attRoles]
      : input.away.tactics.roles
        ? input.away.tactics.roles.map(
            (r, i) => migrateRoleToAttAndDef(r, awayFDef.slots[i]?.position ?? 'CM').attRole,
          )
        : awayFDef.slots.map((s) => getDefaultRoleForPos(s.position));

    const awayDefRoles: DefRoleId[] = input.away.tactics.defRoles
      ? [...input.away.tactics.defRoles]
      : input.away.tactics.roles
        ? input.away.tactics.roles.map(
            (r, i) => migrateRoleToAttAndDef(r, awayFDef.slots[i]?.position ?? 'CM').defRole,
          )
        : awayFDef.slots.map((s) => getDefaultDefRoleForPos(s.position));

    const awayAttInstructions: PlayerInstruction[][] = input.away.tactics.attInstructions
      ? input.away.tactics.attInstructions.map((p) => [...p])
      : input.away.tactics.playerInstructions
        ? input.away.tactics.playerInstructions.map((pis) =>
            pis.filter((pi) => !['closeDownMore', 'stayOnFeet'].includes(pi)),
          )
        : new Array(11).fill([]);

    const awayDefInstructions: DefInstruction[][] = input.away.tactics.defInstructions
      ? input.away.tactics.defInstructions.map((p) => [...p])
      : input.away.tactics.playerInstructions
        ? input.away.tactics.playerInstructions.map(
            (pis) =>
              pis.filter((pi) => ['closeDownMore', 'stayOnFeet'].includes(pi)) as DefInstruction[],
          )
        : new Array(11).fill([]);

    this.awayTeam = {
      clubId: input.away.clubId,
      side: 'away',
      formation: input.away.tactics.formation,
      lineup: [...input.away.tactics.lineup],
      roles: awayAttRoles,
      attRoles: awayAttRoles,
      defRoles: awayDefRoles,
      playerInstructions: awayAttInstructions,
      attInstructions: awayAttInstructions,
      defInstructions: awayDefInstructions,
      opposition: input.away.tactics.opposition ? [...input.away.tactics.opposition] : [],
      duties: input.away.tactics.duties
        ? [...input.away.tactics.duties]
        : new Array(11).fill('Support'),
      bench: [...input.away.tactics.bench],
      instructions: { ...input.away.tactics.instructions },
      captain: input.away.tactics.captain,
      penaltyTaker: input.away.tactics.takers.penalty,
      freeKickTaker: input.away.tactics.takers.freeKick,
      cornerTaker: input.away.tactics.takers.corner,
      longThrowTaker: input.away.tactics.takers.longThrow ?? null,
      takers: input.away.tactics.takers,
      setPieces: input.away.tactics.setPieces ?? createDefaultSetPieceTactics(),
      subsUsed: 0,
      inPlayWindowsUsed: 0,
      redCardedPlayers: [],
      substitutedPlayers: [],
      focusBoostExpiryT: input.away.focusBoost > 0 ? 1200 : 0,
      activeShout: null,
      lastShoutEndT: {},
      shoutCountThisHalf: {},
      matchPlans: input.away.tactics.matchPlans ? [...input.away.tactics.matchPlans] : [],
      firedMatchPlans: [],
      askMeFirst: input.away.tactics.askMeFirst ?? true,
      playerFocusBoost: {},
      teamFocusBoost: null,
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
      c.kind === 'instructions' || c.kind === 'formation' || c.kind === 'plan'
        ? c.issuedAtT + 30
        : c.issuedAtT;

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

    for (let slot = 0; slot < this.homeTeam.lineup.length; slot++) {
      const pId = this.homeTeam.lineup[slot];
      if (!pId) continue;
      const pl = this.playerLines[pId];
      const p = this.players[pId];
      if (pl && p && !p.isRedCarded) {
        pl.minutes += durMins;
        let mult = 1.0;
        const attRole = this.homeTeam.attRoles?.[slot] ?? this.homeTeam.roles[slot];
        const defRole = this.homeTeam.defRoles?.[slot];
        if (attRole === 'fb_overlapping') mult *= 1.08;
        if (attRole === 'box_to_box') mult *= 1.06;
        if (attRole === 'ball_winner' || defRole === 'dm_win') mult *= 1.1;
        if (attRole === 'pressing_forward' || defRole === 'st_press') mult *= 1.15;
        if (defRole === 'cm_press' || defRole === 'am_press' || defRole === 'w_press') mult *= 1.08;
        if (defRole === 'cm_track') mult *= 1.05;

        const attPis =
          this.homeTeam.attInstructions?.[slot] ?? this.homeTeam.playerInstructions[slot] ?? [];
        const defPis = this.homeTeam.defInstructions?.[slot] ?? [];
        if (attPis.includes('getForward')) mult *= 1.06;
        if (defPis.includes('closeDownMore') || attPis.includes('closeDownMore')) mult *= 1.08;
        if (defPis.includes('trackRuns')) mult *= 1.05;

        p.condition = Math.max(1, p.condition - homeDrainRate * mult * durMins);
        pl.conditionEnd = Math.round(p.condition);
        this.checkInjury(p, durMins, this.awayTeam.instructions.pressing);
      }
    }

    for (let slot = 0; slot < this.awayTeam.lineup.length; slot++) {
      const pId = this.awayTeam.lineup[slot];
      if (!pId) continue;
      const pl = this.playerLines[pId];
      const p = this.players[pId];
      if (pl && p && !p.isRedCarded) {
        pl.minutes += durMins;
        let mult = 1.0;
        const attRole = this.awayTeam.attRoles?.[slot] ?? this.awayTeam.roles[slot];
        const defRole = this.awayTeam.defRoles?.[slot];
        if (attRole === 'fb_overlapping') mult *= 1.08;
        if (attRole === 'box_to_box') mult *= 1.06;
        if (attRole === 'ball_winner' || defRole === 'dm_win') mult *= 1.1;
        if (attRole === 'pressing_forward' || defRole === 'st_press') mult *= 1.15;
        if (defRole === 'cm_press' || defRole === 'am_press' || defRole === 'w_press') mult *= 1.08;
        if (defRole === 'cm_track') mult *= 1.05;

        const attPis =
          this.awayTeam.attInstructions?.[slot] ?? this.awayTeam.playerInstructions[slot] ?? [];
        const defPis = this.awayTeam.defInstructions?.[slot] ?? [];
        if (attPis.includes('getForward')) mult *= 1.06;
        if (defPis.includes('closeDownMore') || attPis.includes('closeDownMore')) mult *= 1.08;
        if (defPis.includes('trackRuns')) mult *= 1.05;

        p.condition = Math.max(1, p.condition - awayDrainRate * mult * durMins);
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
      if (cmd.playerInstructions) {
        team.playerInstructions = [...cmd.playerInstructions];
      }
      this.updateDrainRates();
      this.invalidateTeamInvolvements(cmd.side);
      this.emitEvent('TACTIC_CHANGE', 0, {
        side: cmd.side,
        importance: 0,
      });
    } else if (cmd.kind === 'formation') {
      team.formation = cmd.formation;
      team.lineup = [...cmd.lineup];
      if (cmd.duties) team.duties = [...cmd.duties];
      if (cmd.roles) team.roles = [...cmd.roles];
      if (cmd.attRoles) team.attRoles = [...cmd.attRoles];
      if (cmd.defRoles) team.defRoles = [...cmd.defRoles];
      if (cmd.playerInstructions) team.playerInstructions = [...cmd.playerInstructions];
      if (cmd.attInstructions) team.attInstructions = [...cmd.attInstructions];
      if (cmd.defInstructions) team.defInstructions = [...cmd.defInstructions];
      this.invalidateTeamInvolvements(cmd.side);
      this.emitEvent('TACTIC_CHANGE', 0, {
        side: cmd.side,
        importance: 0,
      });
    } else if (cmd.kind === 'opposition') {
      team.opposition = [...cmd.orders];
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
        this.invalidateTeamInvolvements(cmd.side);

        this.emitEvent('SUB', K.durations.substitution, {
          side: cmd.side,
          playerId: cmd.outId,
          targetId: cmd.inId,
          importance: 1,
        });
      }
    } else if (cmd.kind === 'plan') {
      const sheet = cmd.side === 'home' ? this.input.home : this.input.away;
      const plan = sheet.tactics.plans?.[cmd.plan];
      if (plan) {
        team.formation = plan.formation;
        if (plan.roles) team.roles = [...plan.roles];
        if (plan.attRoles) team.attRoles = [...plan.attRoles];
        if (plan.defRoles) team.defRoles = [...plan.defRoles];
        if (plan.playerInstructions) team.playerInstructions = [...plan.playerInstructions];
        if (plan.attInstructions) team.attInstructions = [...plan.attInstructions];
        if (plan.defInstructions) team.defInstructions = [...plan.defInstructions];
        team.instructions = { ...plan.instructions };
        this.updateDrainRates();
        this.invalidateTeamInvolvements(cmd.side);
        this.emitEvent('TACTIC_CHANGE', 0, {
          side: cmd.side,
          importance: 0,
        });
      }
    } else if (cmd.kind === 'shout') {
      const lastEnd = team.lastShoutEndT?.[cmd.shout] ?? -99999;
      const isHalfEffect = this.t - lastEnd < 900;

      // SPEC §13.21: concentrate only after 75' or within 5' of conceding; once per half
      if (cmd.shout === 'concentrate') {
        const after75 = this.t >= 4500;
        const recentConcede =
          team.lastConcededT !== undefined && this.t - team.lastConcededT <= 300;
        const usedThisHalf = (team.shoutCountThisHalf?.['concentrate'] ?? 0) >= 1;
        if ((!after75 && !recentConcede) || usedThisHalf) {
          return; // Ineligible
        }
        team.shoutCountThisHalf = {
          ...team.shoutCountThisHalf,
          concentrate: (team.shoutCountThisHalf?.['concentrate'] ?? 0) + 1,
        };
      }

      if (team.activeShout) {
        team.lastShoutEndT = {
          ...team.lastShoutEndT,
          [team.activeShout.shout]: this.t,
        };
      }

      team.activeShout = {
        shout: cmd.shout,
        issuedAtT: cmd.issuedAtT,
        expiresAtT: this.t + 600,
        isHalfEffect,
      };

      const ourScore = cmd.side === 'home' ? this.score.home : this.score.away;
      const oppScore = cmd.side === 'home' ? this.score.away : this.score.home;
      const goalDiff = ourScore - oppScore;

      if (cmd.shout === 'encourage') {
        if (goalDiff >= 2) {
          // Complacency
          team.teamFocusBoost = {
            boost: -0.01 * (isHalfEffect ? 0.5 : 1.0),
            expiresAtT: this.t + 600,
          };
        } else {
          team.teamFocusBoost = {
            boost: 0.02 * (isHalfEffect ? 0.5 : 1.0),
            expiresAtT: this.t + 600,
          };
          for (const id of team.lineup) {
            if (!id) continue;
            const pl = this.playerLines[id];
            if (pl && pl.rating >= 7.0 && this.players[id]) {
              this.players[id].morale = Math.min(100, this.players[id].morale + 1);
            }
          }
        }
      } else if (cmd.shout === 'demandMore') {
        if (goalDiff > 0) {
          // Morale -1 for all when winning
          for (const id of team.lineup) {
            if (id && this.players[id]) {
              this.players[id].morale = Math.max(0, this.players[id].morale - 1);
            }
          }
          team.teamFocusBoost = null;
        } else {
          team.playerFocusBoost = { ...team.playerFocusBoost };
          for (const id of team.lineup) {
            if (!id) continue;
            const personality = this.getPlayerSheet(id)?.personality;
            let boost = 0.03;
            if (personality === 'Leader' || personality === 'Ambitious') {
              boost = 0.03 * 1.3;
            } else if (personality === 'Relaxed') {
              boost = 0.03 * 0.5;
            } else if (personality === 'Temperamental') {
              boost = this.rng.chance(0.4) ? -0.02 : 0.03;
            }
            if (isHalfEffect) boost *= 0.5;
            team.playerFocusBoost[id] = {
              boost,
              expiresAtT: this.t + 600,
            };
          }
        }
      }

      if (cmd.shout === 'pushForward') {
        this.updateDrainRates();
        this.invalidateTeamInvolvements(cmd.side);
      } else if (cmd.shout === 'keepTight') {
        this.invalidateTeamInvolvements(cmd.side);
      }

      this.emitEvent('SHOUT', 0, {
        side: cmd.side,
        importance: 1,
        data: {
          shout: cmd.shout,
          isHalfEffect,
        },
      });
    }
  }

  private checkShoutExpirations(): void {
    for (const team of [this.homeTeam, this.awayTeam]) {
      if (team.activeShout && this.t >= team.activeShout.expiresAtT) {
        team.lastShoutEndT = {
          ...team.lastShoutEndT,
          [team.activeShout.shout]: this.t,
        };
        const prevShout = team.activeShout.shout;
        team.activeShout = null;
        if (prevShout === 'pushForward') {
          this.updateDrainRates();
        }
        this.invalidateTeamInvolvements(team.side);
      }
    }
  }

  private checkMatchPlans(): void {
    const currentMin = Math.floor(this.t / 60);
    for (const team of [this.homeTeam, this.awayTeam]) {
      const plans = team.matchPlans ?? [];
      if (plans.length === 0) continue;
      const fired = team.firedMatchPlans ?? [];
      const ourScore = team.side === 'home' ? this.score.home : this.score.away;
      const oppScore = team.side === 'home' ? this.score.away : this.score.home;
      const goalDiff = ourScore - oppScore;
      const oppTeam = team.side === 'home' ? this.awayTeam : this.homeTeam;

      for (const rule of plans) {
        if (fired.includes(rule.id)) continue;
        if (currentMin < rule.after) continue;

        let matches = false;
        switch (rule.when) {
          case 'Losing':
            matches = goalDiff < 0;
            break;
          case 'Drawing':
            matches = goalDiff === 0;
            break;
          case 'Winning1':
            matches = goalDiff === 1;
            break;
          case 'Winning2Plus':
            matches = goalDiff >= 2;
            break;
          case 'DownTo10':
            matches = team.redCardedPlayers.length >= 1;
            break;
          case 'OppDownTo10':
            matches = oppTeam.redCardedPlayers.length >= 1;
            break;
        }

        if (matches) {
          if (!team.firedMatchPlans) team.firedMatchPlans = [];
          team.firedMatchPlans.push(rule.id);

          this.emitEvent('MATCH_PLAN_TRIGGERED', 0, {
            side: team.side,
            importance: 1,
            data: {
              ruleId: rule.id,
              when: rule.when,
              after: rule.after,
              then: rule.then,
              askMeFirst: team.askMeFirst ?? true,
            },
          });

          if (rule.then === 'PlanA' || rule.then === 'PlanB' || rule.then === 'PlanC') {
            this.applyCommand({
              kind: 'plan',
              side: team.side,
              plan: rule.then === 'PlanA' ? 0 : rule.then === 'PlanB' ? 1 : 2,
              issuedAtT: this.t,
            });
          } else {
            this.applyCommand({
              kind: 'shout',
              side: team.side,
              shout: rule.then as ShoutId,
              issuedAtT: this.t,
            });
          }
          break; // First rule in the list wins if multiple match at the same step
        }
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
          roles: team.roles,
          playerInstructions: team.playerInstructions,
          opposition: team.opposition,
          duties: team.duties,
          bench: team.bench,
          instructions: team.instructions,
          captain: team.captain,
          takers: {
            penalty: team.penaltyTaker,
            freeKick: team.freeKickTaker,
            corner: team.cornerTaker,
            longThrow: team.longThrowTaker,
          },
        },
        lineup: team.lineup,
        bench: team.bench,
        subsUsed: team.subsUsed,
        windowsUsed: team.inPlayWindowsUsed,
        players: playerMap,
        reputation: (teamSheet as any).reputation ?? 3,
        teamFouls: this.teamStats[side].fouls,
        hasYellowCard: Object.values(this.players).some(
          (p) => p.side === side && p.yellowCards > 0,
        ),
        activeShout: team.activeShout?.shout ?? null,
      });

      if (decision.instructionChanges) {
        team.instructions = { ...team.instructions, ...decision.instructionChanges };
        this.updateDrainRates();
        this.invalidateTeamInvolvements(side);
      }

      if (decision.shout) {
        this.applyCommand({
          kind: 'shout',
          side,
          shout: decision.shout,
          issuedAtT: this.t,
        });
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
        this.homeTeam.shoutCountThisHalf = {};
        this.awayTeam.shoutCountThisHalf = {};

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
    this.checkShoutExpirations();
    this.checkMatchPlans();
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
      const holderId = this.selectOutfielder(team, 'CM');

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
      this.ballPosAttacking = { ...restart.pos };
      this.ballPosAbsolute = toAbsolute(restart.pos.ax, restart.pos.ay, restart.side, this.half);

      // Check long throws (SPEC §13.17.11)
      let longThrowId: PlayerId | null = null;
      if (team.longThrowTaker && team.lineup.includes(team.longThrowTaker)) {
        longThrowId = team.longThrowTaker;
      } else {
        const idx = team.playerInstructions.findIndex((pis) => pis.includes('longThrows'));
        if (idx >= 0 && team.lineup[idx]) longThrowId = team.lineup[idx]!;
      }

      if (longThrowId && restart.pos.ax >= 70) {
        const dur = this.getRestartDuration(K.durations.throwIn + 6, restart.side, longThrowId);
        this.t += dur;
        this.teamStats[restart.side].possessionSec += dur;
        this.updatePlayerMinutes(dur);

        this.ballHolderId = longThrowId;
        this.lastPasserId = null;
        this.emitEvent('THROW_IN', dur, {
          side: restart.side,
          playerId: longThrowId,
          from: this.ballPosAbsolute,
          to: this.ballPosAbsolute,
          importance: 1,
        });
        this.isLongThrowIn = true;
        this.forcedAction = { action: 'cross' };
        return;
      }

      // Taker = closest wide player (LB/RB/LM/RM)
      const takerId = this.findBestTakerForThrowIn(team);
      const dur = this.getRestartDuration(K.durations.throwIn, restart.side, takerId);
      this.t += dur;
      this.teamStats[restart.side].possessionSec += dur;
      this.updatePlayerMinutes(dur);

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
      const gkId = team.lineup[0] ?? null;
      const dur = this.getRestartDuration(K.durations.goalKick, restart.side, gkId);
      this.t += dur;
      this.teamStats[restart.side].possessionSec += dur;
      this.updatePlayerMinutes(dur);

      this.ballHolderId = gkId;
      this.lastPasserId = null;

      // Distribution settings (SPEC §13.17.4)
      const dist = team.instructions.distribution;
      if (dist === 'Short') {
        // to a CB in DEF Centre
        const cbId =
          team.lineup.find((id, idx) => {
            const pos = FORMATIONS[team.formation].slots[idx]?.position;
            return pos === 'CB';
          }) ??
          team.lineup[1] ??
          null;
        this.ballPosAttacking = { ax: 16, ay: 34 };
        this.ballPosAbsolute = toAbsolute(16, 34, restart.side, this.half);
        this.ballHolderId = cbId;
        this.emitEvent('GOAL_KICK', dur, {
          side: restart.side,
          playerId: gkId ?? undefined,
          from: this.ballPosAbsolute,
          to: this.ballPosAbsolute,
          importance: 0,
        });
        this.forcedAction = { action: 'progress' };
      } else if (dist === 'Long') {
        // long ball from GK to MID/ATT Centre
        this.ballPosAttacking = { ax: 65, ay: 34 };
        this.ballPosAbsolute = toAbsolute(65, 34, restart.side, this.half);
        this.emitEvent('GOAL_KICK', dur, {
          side: restart.side,
          playerId: gkId ?? undefined,
          from: this.ballPosAbsolute,
          to: this.ballPosAbsolute,
          importance: 0,
        });
        this.forcedAction = { action: 'long' };
      } else if (dist === 'Wide') {
        // to FB/WB in DEF lane
        const fbId =
          team.lineup.find((id, idx) => {
            const pos = FORMATIONS[team.formation].slots[idx]?.position;
            return pos === 'LB' || pos === 'RB' || pos === 'LWB' || pos === 'RWB';
          }) ??
          team.lineup[1] ??
          null;
        const isLeft = this.rng.chance(0.5);
        this.ballPosAttacking = { ax: 25, ay: isLeft ? 12 : 56 };
        this.ballPosAbsolute = toAbsolute(
          this.ballPosAttacking.ax,
          this.ballPosAttacking.ay,
          restart.side,
          this.half,
        );
        this.ballHolderId = fbId;
        this.firstStepWideDistribution = true;
        this.emitEvent('GOAL_KICK', dur, {
          side: restart.side,
          playerId: gkId ?? undefined,
          from: this.ballPosAbsolute,
          to: this.ballPosAbsolute,
          importance: 0,
        });
        this.forcedAction = { action: 'progress' };
      } else {
        // Mixed: default
        this.ballPosAttacking = { ax: 16, ay: 34 };
        this.ballPosAbsolute = toAbsolute(16, 34, restart.side, this.half);
        this.emitEvent('GOAL_KICK', dur, {
          side: restart.side,
          playerId: gkId ?? undefined,
          from: this.ballPosAbsolute,
          to: this.ballPosAbsolute,
          importance: 0,
        });
        if (team.instructions.passing === 'Direct' && this.rng.chance(0.6)) {
          this.forcedAction = { action: 'long' };
        } else {
          this.forcedAction = { action: 'progress' };
        }
      }
    } else if (restart.type === 'CORNER') {
      this.teamStats[restart.side].corners++;

      // Corner side: left if ay < 34, right if ay >= 34
      const cornerAy = restart.pos.ay < 34 ? 0 : 68;
      const cornerSide: 'left' | 'right' = cornerAy < 34 ? 'left' : 'right';

      // 1. Taker resolution (§13.20.3)
      let takerId: PlayerId | null =
        cornerSide === 'left'
          ? ((team.takers as any)?.leftCorner ?? team.cornerTaker)
          : ((team.takers as any)?.rightCorner ?? team.cornerTaker);

      if (!takerId || !team.lineup.includes(takerId) || team.redCardedPlayers.includes(takerId)) {
        // Auto select: find outfield player with best setPieces, preferring natural inswinger foot
        const candidates = team.lineup.filter(
          (id): id is PlayerId =>
            !!id && !team.redCardedPlayers.includes(id) && team.lineup.indexOf(id) > 0,
        );
        candidates.sort((a, b) => {
          const sheetA = this.getPlayerSheet(a);
          const sheetB = this.getPlayerSheet(b);
          const footA = this.input[restart.side].players[a]?.foot ?? 'Right';
          const footB = this.input[restart.side].players[b]?.foot ?? 'Right';
          const matchFootA = cornerSide === 'left' ? footA !== 'Left' : footA !== 'Right';
          const matchFootB = cornerSide === 'left' ? footB !== 'Left' : footB !== 'Right';
          if (matchFootA !== matchFootB) return matchFootA ? -1 : 1;
          return sheetB.attributes.setPieces - sheetA.attributes.setPieces;
        });
        takerId = candidates[0] ?? this.selectOutfielder(team, 'LM');
      }

      const dur = this.getRestartDuration(K.durations.corner, restart.side, takerId);
      this.t += dur;
      this.teamStats[restart.side].possessionSec += dur;
      this.updatePlayerMinutes(dur);

      this.ballPosAttacking = { ax: 105, ay: cornerAy };
      this.ballPosAbsolute = toAbsolute(105, cornerAy, restart.side, this.half);
      this.ballHolderId = takerId;
      this.lastPasserId = null;

      this.emitEvent('CORNER', 2, {
        side: restart.side,
        playerId: takerId,
        from: this.ballPosAbsolute,
        to: this.ballPosAbsolute,
        importance: 1,
      });

      // 2. Active Routine resolution & Rotation (§13.20.2)
      const sideKey = cornerSide === 'left' ? 'leftCorners' : 'rightCorners';
      const cornerRoutines = team.setPieces?.[sideKey];
      let routine = undefined as any;
      let routineUsesInMatch = 1;

      if (cornerRoutines && cornerRoutines.routines.length > 0) {
        let rIdx = cornerRoutines.activeRoutine;
        if (cornerRoutines.rotate) {
          rIdx = this.cornerRoutineIndices[restart.side][cornerSide];
          this.cornerRoutineIndices[restart.side][cornerSide] =
            (this.cornerRoutineIndices[restart.side][cornerSide] + 1) %
            cornerRoutines.routines.length;
        }
        routine = cornerRoutines.routines[rIdx] ?? cornerRoutines.routines[0];
        if (routine) {
          const prevUses = this.cornerRoutineUses[restart.side][cornerSide][rIdx] ?? 0;
          this.cornerRoutineUses[restart.side][cornerSide][rIdx] = prevUses + 1;
          routineUsesInMatch = prevUses + 1;

          // Populate auto jobs if routine has empty jobs
          if (!routine.jobs || Object.keys(routine.jobs).length === 0) {
            routine.jobs = generateAutoCornerJobs(
              team.lineup.map((id) => (id ? this.getPlayerSheet(id) : null)),
              routine.target,
            );
          }
        }
      }

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
        cornersFor: team.instructions.cornersFor,
        cornersAgainst: oppTeam.instructions.cornersAgainst,
        cornerSwing: team.instructions.cornerSwing,
        menBack: team.instructions.menBack,
        postMen: oppTeam.instructions.postMen,
        routine,
        routineUsesInMatch,
        edgeGuard: oppTeam.setPieces?.defending?.edgeGuard ?? false,
        forwardsUp: oppTeam.setPieces?.defending?.forwardsUp ?? 1,
        markMainManId: oppTeam.setPieces?.defending?.markMainMan ?? 'Auto',
        cornerSide,
        rng: this.rng,
      });

      if (cornerResult.foulPenalty) {
        this.emitEvent('FOUL', 2, {
          side: oppTeam.side,
          playerId: cornerResult.defenderId,
          opponentId: cornerResult.headerAttackerId,
          importance: 2,
        });
        this.pendingRestart = {
          type: 'PENALTY',
          side: restart.side,
          pos: { ax: 94, ay: 34 },
        };
        return;
      }

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
      } else if (cornerResult.outcome === 'SHORT') {
        this.emitEvent('PASS', 2, {
          side: restart.side,
          playerId: takerId,
          targetId: cornerResult.headerAttackerId ?? takerId,
          importance: 0,
        });
        this.ballPosAttacking = { ax: 85, ay: cornerAy < 34 ? 12 : 56 };
        this.ballPosAbsolute = toAbsolute(85, cornerAy < 34 ? 12 : 56, restart.side, this.half);
        this.ballHolderId = cornerResult.headerAttackerId ?? takerId;
        this.shortCornerCrossBonus = true;
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
          // If edge player shot (§13.20.1)
          if (cornerResult.isSecondBallEdgeShot) {
            const edgePlayer = cornerResult.secondBallAttackerId
              ? this.getSetPiecePlayer(cornerResult.secondBallAttackerId)
              : takerP;
            const defP = this.selectPrimaryDefenderId(oppTeam);
            const defSheet = defP ? this.getPlayerSheet(defP) : null;
            const shotRes = resolveShot({
              context: 'OUTSIDE_CENTRAL',
              attacker: edgePlayer,
              goalkeeper: gkP,
              defender: defSheet,
              trainingBonus: this.getTrainingBonus(restart.side, 'setPieces'),
              homeAdvantage: restart.side === 'home' ? K.homeAdvantage : 0,
              defenderHomeAdvantage: restart.side === 'away' ? K.homeAdvantage : 0,
              extraXgRefAdd: oppTeam.setPieces?.defending?.edgeGuard
                ? -K.sp.defendingCorners.edgeGuard.longRangeXGRefReduction
                : 0,
              attackerCtxModifier: K.sp.jobs.edge.shotUtilityAdd,
              rng: this.rng,
            });
            this.processShotResult(
              restart.side,
              edgePlayer.id,
              'OUTSIDE_CENTRAL',
              shotRes,
              defP ?? undefined,
            );
          } else {
            // Attacking keeps ball in MID Centre
            this.ballPosAttacking = { ax: 52.5, ay: 34 };
            this.ballPosAbsolute = toAbsolute(52.5, 34, restart.side, this.half);
            this.ballHolderId =
              cornerResult.secondBallAttackerId ?? this.selectOutfielder(team, 'CM');
          }
        } else {
          // Defenders win possession
          this.possessionSide = oppTeam.side;
          this.ballPosAttacking = { ax: 35, ay: 34 };
          this.ballPosAbsolute = toAbsolute(35, 34, oppTeam.side, this.half);
          this.ballHolderId = this.selectOutfielder(oppTeam, 'CB');

          // Forwards up counter calculation (§13.20.5)
          const fu = oppTeam.setPieces?.defending?.forwardsUp ?? 1;
          let counterChance = K.sp.defendingCorners.forwardsUp[fu]?.clearanceCounterChance ?? 0.18;
          if (fu === 1) {
            const mb = team.instructions.menBack ?? 2;
            counterChance = K.d2.setPieces.menBack[mb]?.clearanceCounterChance ?? 0.18;
          }
          if (this.rng.chance(counterChance)) {
            this.phase = { type: 'COUNTER', remainingSteps: 2 };
            this.teamStats[oppTeam.side].countersStarted =
              (this.teamStats[oppTeam.side].countersStarted ?? 0) + 1;
            this.teamStats[restart.side].countersConceded =
              (this.teamStats[restart.side].countersConceded ?? 0) + 1;
            this.teamStats[restart.side].countersConcededAfterCorner =
              (this.teamStats[restart.side].countersConcededAfterCorner ?? 0) + 1;
          }
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

      // Order of penalty takers (§13.20.3)
      let takerId = team.penaltyTaker;
      const penaltyOrder = (team.takers as any)?.penalties as (PlayerId | null)[] | undefined;
      if (penaltyOrder && penaltyOrder.length > 0) {
        for (const pId of penaltyOrder) {
          if (pId && team.lineup.includes(pId) && !team.redCardedPlayers.includes(pId)) {
            takerId = pId;
            break;
          }
        }
      }
      if (!takerId || !team.lineup.includes(takerId) || team.redCardedPlayers.includes(takerId)) {
        takerId = this.selectOutfielder(team, 'ST');
      }

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
      const isDirectOrDummy =
        restart.shotContext === 'DIRECT_FK' || restart.shotContext === ('DUMMY_FK' as any);
      let takerId = isDirectOrDummy
        ? ((team.takers as any)?.directFreeKick ?? team.freeKickTaker)
        : ((team.takers as any)?.wideFreeKick ?? team.freeKickTaker);

      if (!takerId || !team.lineup.includes(takerId) || team.redCardedPlayers.includes(takerId)) {
        takerId = this.selectOutfielder(team, 'CM');
      }

      const dur = this.getRestartDuration(K.durations.freeKick, restart.side, takerId);
      this.t += dur;
      this.teamStats[restart.side].possessionSec += dur;
      this.updatePlayerMinutes(dur);

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

      if (isDirectOrDummy) {
        const isDummy = restart.shotContext === ('DUMMY_FK' as any);
        let shooterId = takerId;

        if (isDummy) {
          // Dummy: 20% mistimed -> recycle with no shot (§13.20.4)
          if (this.rng.chance(K.sp.freeKicks.central.dummy.mistimedRecycleChance)) {
            this.forcedAction = { action: 'progress' };
            return;
          }
          // Second best setPieces player strikes!
          const candidates = team.lineup.filter(
            (id): id is PlayerId =>
              !!id && !team.redCardedPlayers.includes(id) && team.lineup.indexOf(id) > 0,
          );
          candidates.sort(
            (a, b) =>
              this.getPlayerSheet(b).attributes.setPieces -
              this.getPlayerSheet(a).attributes.setPieces,
          );
          shooterId = candidates[1] ?? candidates[0] ?? takerId;
        }

        const wallDefenders = this.getPlayersInBox(oppTeam, oppTeam.side);
        const wallSetting = oppTeam.setPieces?.defending?.wall ?? 'Auto';
        const wallEffect = calculateWallEffect(wallSetting, wallDefenders);

        const gkId = oppTeam.lineup[0] ?? null;
        const shooterP = this.getPlayerSheet(shooterId);
        const gkP = gkId ? this.getPlayerSheet(gkId) : shooterP;
        const defP = this.selectPrimaryDefenderId(oppTeam);
        const defSheet = defP ? this.getPlayerSheet(defP) : null;

        const extraXg = wallEffect.xgRefAdd + (isDummy ? K.sp.freeKicks.central.dummy.xgRefAdd : 0);
        const blockAdd = isDummy ? K.sp.freeKicks.central.dummy.wallBlockAdd : 0;

        const shotRes = resolveShot({
          context: 'DIRECT_FK',
          attacker: shooterP,
          goalkeeper: gkP,
          defender: defSheet,
          trainingBonus: this.getTrainingBonus(restart.side, 'setPieces'),
          homeAdvantage: restart.side === 'home' ? K.homeAdvantage : 0,
          defenderHomeAdvantage: restart.side === 'away' ? K.homeAdvantage : 0,
          customBlockProb: wallEffect.blockProb,
          blockProbAdd: blockAdd,
          extraXgRefAdd: extraXg,
          rng: this.rng,
        });

        this.processShotResult(restart.side, shooterId, 'DIRECT_FK', shotRes, defP ?? undefined);
      } else if (restart.shotContext === ('QUICK_FK' as any)) {
        // Quick deep FK (§13.20.4): 15% rushed and lost
        if (this.rng.chance(K.sp.freeKicks.deep.quick.rushedLostChance)) {
          this.possessionSide = oppTeam.side;
          this.ballHolderId = this.selectOutfielder(oppTeam, 'CM');
          return;
        }
        this.shortFkProgressBonus = true;
        this.forcedAction = { action: 'progress' };
      } else if (restart.shotContext === ('LONG_FK' as any)) {
        this.forcedAction = { action: 'cross' };
      } else if (restart.shotContext === ('CROSS_FK' as any)) {
        // Wide FK offside trap check (§13.20.6)
        const isWide = restart.pos.ax >= 70 && (restart.pos.ay < 22.67 || restart.pos.ay >= 45.33);
        if (
          isWide &&
          oppTeam.setPieces?.defending?.lineHeight === 'High' &&
          this.rng.chance(K.sp.defendingFreeKicks.lineHeight.high.offsideChance)
        ) {
          this.emitEvent('OFFSIDE', 1, {
            side: restart.side,
            playerId: takerId,
            importance: 1,
          });
          this.pendingRestart = {
            type: 'FREE_KICK',
            side: oppTeam.side,
            pos: { ax: 105 - restart.pos.ax, ay: 68 - restart.pos.ay },
          };
          return;
        }
        this.forcedAction = { action: 'cross' };
      } else if (restart.shotContext === ('SHORT_FK' as any)) {
        this.shortFkProgressBonus = true;
        this.forcedAction = { action: 'progress' };
      } else {
        // Keep ball
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
      let foulHazard = K.fouls.pressingHazard[oppTeam.instructions.pressing];
      if (oppTeam.instructions.tackling === 'GetStuckIn') {
        foulHazard *= K.d2.tackling.getStuckIn.foulsMult;
      } else if (oppTeam.instructions.tackling === 'StayOnFeet') {
        foulHazard *= K.d2.tackling.stayOnFeet.foulsMult;
      }
      if (this.rng.chance(foulHazard)) {
        const presserId = this.selectPressingFouler(oppTeam);
        this.triggerFoul(oppSide, side, this.ballPosAttacking, presserId);
        return;
      }
    }

    // Determine candidate action
    let action: CandidateAction;
    let forcedCtx: ShotContext | undefined;

    const holderId = this.ballHolderId ?? this.selectOutfielder(team, 'CM');
    this.ballHolderId = holderId;
    const holderSheet = this.getPlayerSheet(holderId);

    if (this.shortCornerCrossBonus) {
      action = 'cross';
      this.shortCornerCrossBonus = false;
    } else if (this.forcedAction) {
      action = this.forcedAction.action;
      forcedCtx = this.forcedAction.context;
      this.forcedAction = null;
    } else {
      const currentLane = classifyLane(this.ballPosAttacking.ay);

      const holderSlot = team.lineup.indexOf(holderId);
      const holderRole =
        holderSlot >= 0
          ? (team.attRoles?.[holderSlot] ??
            team.roles[holderSlot] ??
            getDefaultRoleForPos(FORMATIONS[team.formation].slots[holderSlot]?.position ?? 'CM'))
          : 'cm';
      const holderFit = this.getPlayerRoleFit(holderRole, holderId);
      const holderPIs =
        holderSlot >= 0
          ? (team.attInstructions?.[holderSlot] ?? team.playerInstructions[holderSlot] ?? [])
          : [];
      const oppOrdersOnHolder = oppTeam.opposition
        .filter((o) => o.target === holderId)
        .map((o) => o.kind);
      const hasTargetManOnTeam = (team.attRoles ?? team.roles).includes('target_man');
      const targetManSlot =
        team.attRoles?.indexOf('target_man') ?? team.roles.indexOf('target_man');
      const targetManFit =
        targetManSlot >= 0 && team.lineup[targetManSlot]
          ? this.getPlayerRoleFit('target_man', team.lineup[targetManSlot]!)
          : 1.0;

      let insideForwardWithoutOverlap = false;
      if (holderRole === 'inside_forward' && holderSlot >= 0) {
        const slotPos = FORMATIONS[team.formation].slots[holderSlot]?.position;
        const isLeft = slotPos === 'LM' || slotPos === 'LW';
        const fbSlot = team.lineup.findIndex((_, idx) => {
          const p = FORMATIONS[team.formation].slots[idx]?.position;
          return isLeft ? p === 'LB' || p === 'LWB' : p === 'RB' || p === 'RWB';
        });
        if (fbSlot >= 0) {
          const fbRole = team.attRoles?.[fbSlot] ?? team.roles[fbSlot];
          if (fbRole === 'fb_defensive' || fbRole === 'fb_inverted') {
            insideForwardWithoutOverlap = true;
          }
        }
      }

      // Defending role in current lane (mirrored for opponent)
      const defendingDefRoles = oppTeam.defRoles ?? [];
      let defendingLaneDefRole: DefRoleId | undefined;
      if (currentLane !== 'Centre') {
        const oppMirrorPos =
          currentLane === 'Left' ? ['RB', 'RWB', 'RM', 'RW'] : ['LB', 'LWB', 'LM', 'LW'];
        const oppSlot = oppTeam.lineup.findIndex((_, idx) => {
          const p = FORMATIONS[oppTeam.formation].slots[idx]?.position;
          return oppMirrorPos.includes(p ?? '');
        });
        if (oppSlot >= 0 && oppTeam.defRoles) {
          defendingLaneDefRole = oppTeam.defRoles[oppSlot];
        }
      }

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
        holderRole,
        holderFit,
        holderPIs,
        oppOrdersOnHolder,
        hasTargetManOnTeam,
        targetManFit,
        insideForwardWithoutOverlap,
        isStepAfterRegroupWin: this.stepsAfterRegroupWin > 0,
        isStepsAfterKeepItWin: this.stepsAfterKeepItWin > 0,
        isFirstStepWideDistribution: this.firstStepWideDistribution,
        opponentPressingHigh: oppTeam.instructions.pressing === 'High',
        defendingTeamForceOpp: oppTeam.instructions.forceOpp,
        isLeadingLateTimeWasting:
          team.instructions.timeWasting === 'WhenAhead' && this.isTeamLeadingLate(side),
        defendingDefRoles,
        defendingLaneDefRole,
        isPressBeaten: this.pressBeatenSteps > 0,
        holderTraits: this.getEffectivePlayerTraits(holderId),
        activeShout: team.activeShout?.shout ?? null,
        isHalfEffectShout: team.activeShout?.isHalfEffect ?? false,
      };

      if (this.holdsUpRecycleBonus) {
        this.holdsUpRecycleBonus = false;
      }

      action = selectAction(currentThird, currentLane, actionCtx, this.rng);
    }

    if (this.stepsAfterRegroupWin > 0) this.stepsAfterRegroupWin--;
    if (this.stepsAfterKeepItWin > 0) this.stepsAfterKeepItWin--;
    if (this.pressBeatenSteps > 0) this.pressBeatenSteps--;
    if (this.firstStepWideDistribution) this.firstStepWideDistribution = false;

    // Decrement counter phase if active
    if (this.phase.type === 'COUNTER') {
      const remaining = this.phase.remainingSteps - 1;
      this.phase =
        remaining > 0 ? { type: 'COUNTER', remainingSteps: remaining } : { type: 'OPEN' };
      if (this.phase.type === 'OPEN') {
        this.counterPhaseExtraCtx = 0;
      }
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
      const holderSlot = team.lineup.indexOf(holderId);
      const holderRole = holderSlot >= 0 ? (team.roles[holderSlot] ?? 'cm') : 'cm';
      const holderFit = this.getPlayerRoleFit(holderRole, holderId);
      const gainScale = 0.4 + 0.6 * holderFit;
      const holderPIs = holderSlot >= 0 ? (team.playerInstructions[holderSlot] ?? []) : [];

      let sPass =
        0.6 * z(holderSheet.attributes.passing) +
        0.2 * z(holderSheet.attributes.decisions) +
        0.2 * z(holderSheet.attributes.composure) +
        (side === 'home' ? K.homeAdvantage : 0) +
        this.getTrainingBonus(side, 'attack');

      if (holderRole === 'ball_playing_cb') sPass += 0.15 * gainScale;
      if (holderRole === 'deep_playmaker') sPass += 0.1 * gainScale;
      if (holderRole === 'playmaker') sPass += 0.1 * gainScale;
      if (oppTeam.opposition.some((o) => o.kind === 'pressOnBall' && o.target === holderId))
        sPass -= 0.3;
      if (oppTeam.opposition.some((o) => o.kind === 'doubleUp' && o.target === holderId))
        sPass -= 0.1;

      const defSlot = defenderId ? oppTeam.lineup.indexOf(defenderId) : -1;
      const defRole: DefRoleId =
        defSlot >= 0 ? (oppTeam.defRoles?.[defSlot] ?? 'cb_hold') : 'cb_hold';
      const defFit = defenderId ? this.getDefRoleFit(defRole, defenderId) : 1.0;
      const defGainScale = 0.4 + 0.6 * defFit;
      const defPis = defSlot >= 0 ? (oppTeam.defInstructions?.[defSlot] ?? []) : [];
      const oppAttPis =
        defSlot >= 0
          ? (oppTeam.attInstructions?.[defSlot] ?? oppTeam.playerInstructions[defSlot] ?? [])
          : [];

      let sPress = defenderSheet
        ? 0.5 * z(defenderSheet.attributes.positioning) +
          0.3 * z(defenderSheet.attributes.workRate) +
          0.2 * z(defenderSheet.attributes.tackling) +
          (oppTeam.side === 'home' ? K.homeAdvantage : 0) +
          this.getTrainingBonus(oppSide, 'defence')
        : 0;

      const destThird = classifyThird(dest.ax);

      if (defRole === 'cb_step' || (defRole as any) === 'stopper') sPress += 0.25 * defGainScale;
      if (defRole === 'cb_cover' || (defRole as any) === 'covering_cb') sPress -= 0.2;
      if (defRole === 'dm_win' || (defRole as any) === 'ball_winner') sPress += 0.4 * defGainScale;
      if (defRole === 'fb_press' && destThird === 'MID') sPress += 0.3 * defGainScale;
      if (defRole === 'cm_press' && destThird === 'MID') sPress += 0.3 * defGainScale;
      if (defRole === 'am_press' && destThird === 'MID') sPress += 0.3 * defGainScale;
      if (defRole === 'w_press' && destThird === 'DEF') sPress += 0.3 * defGainScale;
      if (defPis.includes('closeDownMore')) {
        const closeFit = defenderId
          ? this.getInstructionFit('closeDownMore', defenderId, true)
          : 1.0;
        sPress += 0.3 * (0.4 + 0.6 * closeFit);
      }
      if (oppAttPis.includes('roam')) sPress += K.d2.pi.roam.slotPressPenalty;
      if (oppTeam.opposition.some((o) => o.kind === 'tightMark' && o.target === holderId))
        sPress += 0.3;
      if (oppTeam.opposition.some((o) => o.kind === 'pressOnBall' && o.target === holderId))
        sPress += 0.4;

      let ctx = 0;
      if (holderPIs.includes('playSafe')) {
        ctx += K.d2.pi.playSafe.passCtxAdd;
      }
      if (this.stepsAfterRegroupWin > 0) {
        ctx += K.trans.regroup.nextStepsPassCtx ?? 0.16;
      }
      if (defPis.includes('standOff')) {
        ctx += 0.15;
      }
      if (defPis.includes('trackRuns')) {
        ctx += 0.1;
      }

      if (
        (destThird === 'DEF' || classifyThird(this.ballPosAttacking.ax) === 'DEF') &&
        (oppTeam.defRoles?.includes('st_press') || oppTeam.roles.includes('pressing_forward'))
      ) {
        const pfSlot =
          oppTeam.defRoles && oppTeam.defRoles.includes('st_press')
            ? oppTeam.defRoles.indexOf('st_press')
            : oppTeam.roles.indexOf('pressing_forward');
        const pfFit =
          pfSlot >= 0 && oppTeam.lineup[pfSlot]
            ? this.getDefRoleFit('st_press', oppTeam.lineup[pfSlot]!)
            : 1.0;
        const pressAdd = oppTeam.defRoles?.includes('st_press')
          ? (K.droles.st_press.teamOppDefPress ?? 0.48)
          : 0.2;
        sPress += pressAdd * (0.4 + 0.6 * pfFit);
        ctx += oppTeam.defRoles?.includes('st_press')
          ? (K.droles.st_press.oppDefPassCtx ?? -0.3)
          : -0.12;
      }
      if (destThird === 'DEF' && oppTeam.roles.includes('poacher')) {
        sPress *= 0.9;
      }
      if (
        destThird === 'DEF' &&
        classifyLane(dest.ay) === 'Centre' &&
        oppTeam.defRoles?.includes('fb_tuck')
      ) {
        ctx -= 0.1;
      }
      if (
        destThird === 'MID' &&
        classifyLane(dest.ay) === 'Centre' &&
        oppTeam.defRoles?.includes('dm_drop')
      ) {
        ctx += 0.15;
      }
      if (
        destThird === 'MID' &&
        classifyLane(dest.ay) === 'Centre' &&
        oppTeam.defRoles?.includes('cm_track')
      ) {
        ctx += 0.1;
      }
      if (destThird === 'ATT') ctx -= 0.6;
      else if (destThird === 'MID') ctx -= 0.2;

      if (oppTeam.instructions.pressing === 'High') ctx -= 0.35;
      else if (oppTeam.instructions.pressing === 'Low') ctx += 0.2;

      if (team.instructions.tempo === 'Fast') ctx -= 0.2;
      else if (team.instructions.tempo === 'Slow') ctx += 0.15;

      if (this.input.weather === 'Rain') ctx -= 0.08;

      if (this.targetManKnockDownSteps > 0 && (action === 'recycle' || action === 'progress')) {
        ctx += 0.2;
      }
      if (this.stepsAfterKeepItWin > 0 && (action === 'recycle' || action === 'progress')) {
        ctx += K.trans.keepIt.firstStepsPassCtx;
      }
      if (
        destThird === 'MID' &&
        team.roles.includes('fb_inverted') &&
        (action === 'recycle' || action === 'progress')
      ) {
        ctx += 0.1;
      }
      if (this.counterPhaseExtraCtx > 0 && this.phase.type === 'COUNTER') {
        ctx += this.counterPhaseExtraCtx;
      }
      if (team.instructions.onWin === 'Counter' && this.phase.type === 'COUNTER') {
        ctx -= 0.25;
      }
      if (this.shortFkProgressBonus && action === 'progress') {
        ctx += K.d2.setPieces.freeKicks.shortNextStepProgress;
        this.shortFkProgressBonus = false;
      }
      if (team.instructions.finalThird === 'WorkIntoBox' && destThird === 'ATT') {
        ctx += K.d2.finalThird.workIntoBox.attPassCtx;
      }
      if (holderPIs.includes('riskyPasses')) {
        ctx += K.d2.pi.riskyPasses.passCtxAdd;
      }
      if (team.activeShout?.shout === 'concentrate') {
        ctx += K.shouts.concentrate.passCtxMod * (team.activeShout.isHalfEffect ? 0.5 : 1.0);
      }
      const isReturnPass = this.lastPassType === 'short' && this.lastPasserId === receiverId;
      const holderTraits = this.getEffectivePlayerTraits(holderId);
      if (holderTraits.includes('playsOneTwos') && isReturnPass) {
        ctx += K.traits.playsOneTwos.passCtxMod;
      }

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
        this.lastPassType = 'short';
        this.ballHolderId = receiverId;
        this.ballPosAttacking = dest;
        this.ballPosAbsolute = destAbs;

        if (oppTeam.opposition.some((o) => o.kind === 'pressOnBall' && o.target === holderId)) {
          this.forcedAction = { action: 'progress' };
        }
        if (defRole === 'cm_press' || defRole === 'am_press') {
          this.pressBeatenSteps = 1;
        }
      } else {
        // Failure
        if (holderRole === 'ball_playing_cb' && oppTeam.instructions.pressing === 'High') {
          this.teamStats[oppSide].interceptions++;
          if (dest.ax <= 70)
            this.teamStats[oppSide].ballWinsMidAtt =
              (this.teamStats[oppSide].ballWinsMidAtt ?? 0) + 1;
          if (defenderId) {
            const defPl = this.playerLines[defenderId];
            if (defPl) defPl.interceptions++;
          }
          this.emitEvent('INTERCEPTION', dur, {
            side: oppSide,
            playerId: defenderId ?? undefined,
            opponentId: holderId,
            from: this.ballPosAbsolute,
            to: destAbs,
            importance: 1,
          });
          this.checkTransition(oppSide, side, dest);
          this.forcedAction = { action: 'shot' };
        } else if (holderRole === 'deep_playmaker' && oppTeam.instructions.pressing === 'High') {
          this.checkTransition(oppSide, side, dest);
          this.phase = { type: 'COUNTER', remainingSteps: 2 };
        } else if (this.rng.chance(0.75) && defenderId) {
          // Ball won by defender: Tackle vs Interception based on tackling style and defensive roles
          let tackleProb = 0.28;
          if (oppTeam.instructions.tackling === 'GetStuckIn') {
            tackleProb = 0.33;
          } else if (oppTeam.instructions.tackling === 'StayOnFeet') {
            tackleProb = 0.26;
          }
          if (defPis.includes('tackleHarder')) {
            tackleProb += 0.05;
          } else if (defPis.includes('stayOnFeet')) {
            tackleProb -= 0.05;
          }
          if (defRole === 'cb_step') {
            tackleProb += 0.08;
          } else if (defRole === 'cb_cover') {
            tackleProb -= 0.05;
          }

          const isTackle = this.rng.chance(tackleProb);

          const defPl = this.playerLines[defenderId];
          if (isTackle) {
            this.teamStats[oppSide].tackles++;
            if (defPl) defPl.tackles++;
            this.emitEvent('TACKLE', dur, {
              side: oppSide,
              playerId: defenderId,
              opponentId: holderId,
              from: this.ballPosAbsolute,
              to: destAbs,
              importance: 1,
            });
          } else {
            this.teamStats[oppSide].interceptions++;
            if (defPl) defPl.interceptions++;
            this.emitEvent('INTERCEPTION', dur, {
              side: oppSide,
              playerId: defenderId,
              opponentId: holderId,
              from: this.ballPosAbsolute,
              to: destAbs,
              importance: 1,
            });
          }

          if (dest.ax <= 70)
            this.teamStats[oppSide].ballWinsMidAtt =
              (this.teamStats[oppSide].ballWinsMidAtt ?? 0) + 1;
          if (dest.ax <= 35)
            this.teamStats[oppSide].ballWinsOppDefThird =
              (this.teamStats[oppSide].ballWinsOppDefThird ?? 0) + 1;

          this.checkTransition(oppSide, side, dest);
          if (holderPIs.includes('riskyPasses') && this.rng.chance(0.1)) {
            this.phase = { type: 'COUNTER', remainingSteps: 2 };
            this.counterPhaseExtraCtx = Math.max(this.counterPhaseExtraCtx, 0.1);
          }
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
        this.lastPasserId = null;
        this.lastPassType = null;
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

      const defSlot = defenderId ? oppTeam.lineup.indexOf(defenderId) : -1;
      const defRole: DefRoleId =
        defSlot >= 0 ? (oppTeam.defRoles?.[defSlot] ?? 'cb_hold') : 'cb_hold';
      const defFit = defenderId ? this.getDefRoleFit(defRole, defenderId) : 1.0;
      const defGainScale = 0.4 + 0.6 * defFit;
      const defPis = defSlot >= 0 ? (oppTeam.defInstructions?.[defSlot] ?? []) : [];
      const oppAttPis =
        defSlot >= 0
          ? (oppTeam.attInstructions?.[defSlot] ?? oppTeam.playerInstructions[defSlot] ?? [])
          : [];
      const isTightMarkMarker = oppTeam.opposition.some(
        (o) => o.kind === 'tightMark' && o.target === holderId,
      );

      let sDrib =
        0.5 * z(holderSheet.attributes.dribbling) +
        0.25 * z(holderSheet.attributes.pace) +
        0.25 * z(holderSheet.attributes.firstTouch) +
        (side === 'home' ? K.homeAdvantage : 0);

      if (oppTeam.opposition.some((o) => o.kind === 'doubleUp' && o.target === holderId)) {
        sDrib -= 0.5;
      }
      if (team.instructions.onWin === 'Counter' && this.phase.type === 'COUNTER') {
        sDrib -= 0.25;
      }

      let sTkl = defenderSheet
        ? 0.5 * z(defenderSheet.attributes.tackling) +
          0.3 * z(defenderSheet.attributes.positioning) +
          0.2 * z(defenderSheet.attributes.strength) +
          (oppTeam.side === 'home' ? K.homeAdvantage : 0)
        : 0;

      if (defRole === 'cb_step' || (defRole as any) === 'stopper') sTkl += 0.35 * defGainScale;
      if (defRole === 'dm_win' || (defRole as any) === 'ball_winner') sTkl += 0.3 * defGainScale;
      if (defRole === 'cb_cover' || (defRole as any) === 'covering_cb') sTkl -= 0.15;
      if (isTightMarkMarker) sTkl += 0.3;
      if (defPis.includes('stayOnFeet')) {
        sTkl -= 0.25;
      } else if (defPis.includes('tackleHarder')) {
        const tklFit = defenderId ? this.getInstructionFit('tackleHarder', defenderId, true) : 1.0;
        sTkl += 0.25 * (0.4 + 0.6 * tklFit);
      } else if (oppTeam.instructions.tackling === 'GetStuckIn') {
        sTkl += K.d2.tackling.getStuckIn.sTklAdd;
      } else if (oppTeam.instructions.tackling === 'StayOnFeet') {
        sTkl += K.d2.tackling.stayOnFeet.sTklAdd;
      }
      if (oppAttPis.includes('sitNarrower') && classifyLane(dest.ay) === 'Centre') {
        sTkl += K.d2.pi.sitNarrower.oppLaneCtxAdd;
      }

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

        if ((defRole as string) === 'stopper' || defRole === 'cb_step') {
          this.stopperBeatenSteps = 1;
        }
        if (defRole === 'cm_press' || defRole === 'am_press' || defRole === 'fb_press') {
          this.pressBeatenSteps = 1;
        }
        if (defPis.includes('closeDownMore')) {
          this.forcedAction = { action: 'progress' };
        }
      } else {
        const liveP = this.players[holderId];
        if (liveP) liveP.failedDribbles++;

        const inBoxNow = isBox(this.ballPosAttacking.ax, this.ballPosAttacking.ay);
        let foulChance = inBoxNow ? K.fouls.boxDribbleFoulChance : K.fouls.failedDribbleChance;
        const foulMult = getFoulMultiplier({
          defRoleId: defRole,
          isTightMarkMarker,
          playerInstructions: oppAttPis,
          defInstructions: defPis,
          teamTackling: oppTeam.instructions.tackling,
        });
        foulChance *= foulMult;

        if (!this.rng.chance(foulChance) && defenderId) {
          this.teamStats[oppSide].tackles++;
          if (dest.ax <= 70)
            this.teamStats[oppSide].ballWinsMidAtt =
              (this.teamStats[oppSide].ballWinsMidAtt ?? 0) + 1;
          if (dest.ax <= 35)
            this.teamStats[oppSide].ballWinsOppDefThird =
              (this.teamStats[oppSide].ballWinsOppDefThird ?? 0) + 1;
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

      if (
        oppTeam.instructions.offsideTrap &&
        dest.ax >= 70 &&
        this.rng.chance(K.d2.offsideTrap.oppLongBallAttOffsideChance)
      ) {
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
        return;
      }

      const recvSlot = team.lineup.indexOf(receiverId);
      const recvRole = recvSlot >= 0 ? (team.roles[recvSlot] ?? 'st') : 'st';
      const recvFit = this.getPlayerRoleFit(recvRole, receiverId);
      const recvGainScale = 0.4 + 0.6 * recvFit;

      const defSlot = defenderId ? oppTeam.lineup.indexOf(defenderId) : -1;
      const defRole = defSlot >= 0 ? (oppTeam.roles[defSlot] ?? 'cb') : 'cb';
      const defFit = defenderId ? this.getPlayerRoleFit(defRole, defenderId) : 1.0;
      const defGainScale = 0.4 + 0.6 * defFit;

      let sAirAtt =
        0.6 * z(receiverSheet.attributes.heading) +
        0.4 * z(receiverSheet.attributes.strength) +
        (side === 'home' ? K.homeAdvantage : 0);

      if (recvRole === 'target_man') sAirAtt += 0.38 * recvGainScale;

      let sAirDef = defenderSheet
        ? 0.5 * z(defenderSheet.attributes.heading) +
          0.3 * z(defenderSheet.attributes.strength) +
          0.2 * z(defenderSheet.attributes.positioning) +
          (oppTeam.side === 'home' ? K.homeAdvantage : 0)
        : 0;

      if (defRole === 'stopper') sAirDef += 0.2 * defGainScale;

      const lineBonus = oppTeam.instructions.line === 'High' ? 0.3 : 0;
      const isDelivered = this.rng.chance(pDelivery);
      const deliveryBonus = isDelivered ? 0.4 : -0.4;
      const pWin = sigmoid(
        K.intercepts.longBallAerial + 0.7 * sAirAtt - 0.7 * sAirDef + lineBonus + deliveryBonus,
      );

      if (this.rng.chance(pWin)) {
        this.teamStats[side].passesCompleted++;
        const recvPl = this.playerLines[receiverId];
        if (recvPl) recvPl.aerialDuelsWon = (recvPl.aerialDuelsWon ?? 0) + 1;
        this.emitEvent('AERIAL_DUEL', 2, {
          side,
          playerId: receiverId,
          opponentId: defenderId ?? undefined,
          importance: 1,
        });

        if (recvRole === 'target_man') {
          this.targetManKnockDownSteps = 1;
        }

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

        if ((defRole as string) === 'stopper' || defRole === 'cb_step') {
          this.stopperBeatenSteps = 1;
        }
        if (defRole === 'cm_press' || defRole === 'am_press' || defRole === 'fb_press') {
          this.pressBeatenSteps = 1;
        }

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

      const receiverId = this.pickReceiverId(team, holderId, dest, true);
      const receiverSheet = this.getPlayerSheet(receiverId);
      const defenderId = this.selectPrimaryDefenderId(oppTeam);
      const defenderSheet = defenderId ? this.getPlayerSheet(defenderId) : null;

      const recvSlot = team.lineup.indexOf(receiverId);
      const recvRole = recvSlot >= 0 ? (team.roles[recvSlot] ?? 'st') : 'st';
      const recvFit = this.getPlayerRoleFit(recvRole, receiverId);
      const recvGainScale = 0.4 + 0.6 * recvFit;

      const sTp =
        0.6 * z(holderSheet.attributes.passing) +
        0.4 * z(holderSheet.attributes.decisions) +
        (side === 'home' ? K.homeAdvantage : 0);

      let sRun =
        0.5 * z(receiverSheet.attributes.offTheBall) + 0.5 * z(receiverSheet.attributes.pace);

      if (recvRole === 'runner' || recvRole === 'shadow_striker') sRun += 0.2 * recvGainScale;
      if (recvRole === 'advanced_forward') sRun += 0.3 * recvGainScale;
      if (recvRole === 'target_man') sRun -= 0.2;

      if (team.roles.includes('false_nine')) {
        const f9Slot = team.roles.indexOf('false_nine');
        const f9Fit =
          f9Slot >= 0 && team.lineup[f9Slot]
            ? this.getPlayerRoleFit('false_nine', team.lineup[f9Slot]!)
            : 1.0;
        sRun += 0.25 * (0.4 + 0.6 * f9Fit);
      }

      const defSlot = defenderId ? oppTeam.lineup.indexOf(defenderId) : -1;
      const defRole: DefRoleId =
        defSlot >= 0 ? (oppTeam.defRoles?.[defSlot] ?? 'cb_hold') : 'cb_hold';
      const defFit = defenderId ? this.getDefRoleFit(defRole, defenderId) : 1.0;
      const defPis = defSlot >= 0 ? (oppTeam.defInstructions?.[defSlot] ?? []) : [];

      let sCover = defenderSheet
        ? 0.6 * z(defenderSheet.attributes.positioning) +
          0.4 * z(defenderSheet.attributes.pace) +
          (oppTeam.side === 'home' ? K.homeAdvantage : 0)
        : 0;

      let lineCtx =
        oppTeam.instructions.line === 'High'
          ? 0.4
          : oppTeam.instructions.line === 'Deep'
            ? -0.4
            : 0;

      if (oppTeam.defRoles?.includes('cb_cover') || oppTeam.roles.includes('covering_cb')) {
        const ccbSlot =
          oppTeam.defRoles?.indexOf('cb_cover') ?? oppTeam.roles.indexOf('covering_cb');
        const ccbFit =
          ccbSlot >= 0 && oppTeam.lineup[ccbSlot]
            ? this.getDefRoleFit('cb_cover', oppTeam.lineup[ccbSlot]!)
            : 1.0;
        lineCtx -= 0.25 * (0.4 + 0.6 * ccbFit);
      }
      if (oppTeam.defRoles?.[0] === 'gk_sweep' || oppTeam.roles[0] === 'sweeper_keeper') {
        const skFit = oppTeam.lineup[0] ? this.getDefRoleFit('gk_sweep', oppTeam.lineup[0]!) : 1.0;
        lineCtx -= 0.3 * (0.4 + 0.6 * skFit);
      }
      if (oppTeam.defRoles?.includes('dm_drop')) {
        lineCtx += K.droles.dm_drop.oppThroughBallsCtx ?? -0.65;
      }
      if (defPis.includes('standOff')) {
        lineCtx -= 0.1;
      }
      if (defPis.includes('markTighter')) {
        lineCtx += 0.15;
      }
      if (defPis.includes('trackRuns')) {
        sRun -= 0.2;
      }
      if ((recvRole as any) === 'st_shoulder') {
        sRun += 0.2;
      }
      if (
        this.stopperBeatenSteps > 0 ||
        defRole === 'cb_step' ||
        oppTeam.defRoles?.includes('cb_step')
      ) {
        lineCtx += 0.38;
      }
      if (
        oppTeam.opposition.some(
          (o) => o.kind === 'tightMark' && classifyThird(this.ballPosAttacking.ax) === 'MID',
        )
      ) {
        lineCtx += 0.2;
      }

      // Sweeper keeper 3% foul outside box
      if (
        (oppTeam.defRoles?.[0] === 'gk_sweep' || oppTeam.roles[0] === 'sweeper_keeper') &&
        this.rng.chance(0.03)
      ) {
        this.triggerFoul(oppSide, side, { ax: 85, ay: 34 }, oppTeam.lineup[0] ?? undefined);
        return;
      }

      if (team.instructions.onWin === 'Counter' && this.phase.type === 'COUNTER') {
        lineCtx -= 0.25;
      }

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

        if (defenderId) {
          const defPl = this.playerLines[defenderId];
          if (defPl) defPl.throughBallsConceded = (defPl.throughBallsConceded ?? 0) + 1;
        }

        this.emitEvent('THROUGH_BALL', dur, {
          side,
          playerId: holderId,
          targetId: receiverId,
          from: this.ballPosAbsolute,
          to: destAbs,
          importance: 1,
        });

        // Forced One-on-one check
        let p1v1 =
          oppTeam.instructions.line === 'High'
            ? 0.35
            : oppTeam.instructions.line === 'Deep'
              ? 0.1
              : 0.2;

        if (oppTeam.defRoles?.[0] === 'gk_sweep' || oppTeam.roles[0] === 'sweeper_keeper') {
          p1v1 *= 0.75;
        }
        if (recvRole === 'advanced_forward') {
          p1v1 += 0.05;
        }
        if (oppTeam.instructions.offsideTrap) {
          p1v1 += K.d2.offsideTrap.beatenTrapOneOnOneAdd;
        }

        if (this.rng.chance(p1v1)) {
          this.forcedAction = { action: 'shot', context: 'ONE_ON_ONE' };
        }
      } else {
        // Failure: Offside or Interception
        let pOffside =
          oppTeam.instructions.line === 'High'
            ? 0.55
            : oppTeam.instructions.line === 'Deep'
              ? 0.15
              : 0.38;

        if (recvRole === 'advanced_forward') {
          pOffside *= 1.25;
        }
        if (oppTeam.instructions.offsideTrap) {
          pOffside = Math.min(
            K.d2.offsideTrap.failedThroughOffsideCap,
            pOffside + K.d2.offsideTrap.failedThroughOffsideProbAdd,
          );
        }

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

      const holderSlot = team.lineup.indexOf(holderId);
      const holderRole = holderSlot >= 0 ? (team.roles[holderSlot] ?? 'cm') : 'cm';
      const holderFit = this.getPlayerRoleFit(holderRole, holderId);
      const gainScale = 0.4 + 0.6 * holderFit;
      const holderPIs = holderSlot >= 0 ? (team.playerInstructions[holderSlot] ?? []) : [];
      const isAttWide =
        this.ballPosAttacking.ax >= 70 && classifyLane(this.ballPosAttacking.ay) !== 'Centre';

      // 0. Low cross block check (§13.18.3)
      if (
        team.instructions.crossStyle === 'Low' &&
        this.rng.chance(K.d2.crossStyle.low.blockChance)
      ) {
        const defId = this.selectPrimaryDefenderId(oppTeam);
        this.emitEvent('BLOCK', 1, {
          side: oppSide,
          playerId: defId ?? undefined,
          importance: 1,
        });
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

      // 1. GK claim
      let pClaim =
        K.intercepts.gkClaimBase + K.intercepts.gkClaimSlope * z(gkSheet.attributes.aerialCommand);

      if (this.isLongThrowIn) {
        pClaim += 0.04;
      }
      if (team.instructions.crossStyle === 'Low') {
        pClaim += K.d2.crossStyle.low.gkClaimAdd;
      } else if (team.instructions.crossStyle === 'Floated') {
        pClaim += K.d2.crossStyle.floated.gkClaimAdd;
      }
      if (holderPIs.includes('crossFromDeep')) {
        pClaim += K.d2.pi.crossFromDeep.gkClaimAdd;
      }

      if (this.rng.chance(pClaim)) {
        this.isLongThrowIn = false;
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
      let crossSkillTerm = 0.8 * z(holderSheet.attributes.crossing);
      if (this.isLongThrowIn) {
        crossSkillTerm = 0.8 * z(holderSheet.attributes.strength);
        this.isLongThrowIn = false;
      } else if (holderRole === 'fb_overlapping') {
        crossSkillTerm += 0.1 * gainScale;
      }
      if (oppTeam.opposition.some((o) => o.kind === 'doubleUp' && o.target === holderId)) {
        crossSkillTerm -= 0.2;
      }
      if (team.instructions.crossStyle === 'Whipped') {
        crossSkillTerm += K.d2.crossStyle.whipped.deliveryCtx;
      } else if (team.instructions.crossStyle === 'Floated') {
        crossSkillTerm += K.d2.crossStyle.floated.deliveryCtx;
      }
      if (holderPIs.includes('crossFromByline') && isAttWide) {
        crossSkillTerm += K.d2.pi.crossFromByline.deliveryCtxAdd;
      }
      if (holderPIs.includes('crossFromDeep')) {
        crossSkillTerm += K.d2.pi.crossFromDeep.deliveryCtxAdd;
      }

      const pDelivery = sigmoid(
        K.intercepts.crossDelivery + crossSkillTerm + this.getTrainingBonus(side, 'attack'),
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

      // 3. Duel Target Selection
      const attInBox = this.getPlayersInBox(team, side);
      const defInBox = this.getPlayersInBox(oppTeam, oppSide);

      const targetWeights = attInBox.map((a) => {
        const aSlot = team.lineup.indexOf(a.id);
        const aRole = aSlot >= 0 ? (team.roles[aSlot] ?? 'st') : 'st';
        let w = Math.max(1, a.attributes.heading);
        if (aRole === 'target_man') w *= 1.4;
        if (aRole === 'false_nine') w *= 0.5;
        return w;
      });
      const totalAttW = targetWeights.reduce((a, b) => a + b, 0);
      let rollAtt = this.rng.next() * totalAttW;
      let targetAtt = attInBox[0] ?? holderSheet;
      for (let i = 0; i < attInBox.length; i++) {
        rollAtt -= targetWeights[i]!;
        if (rollAtt <= 0) {
          targetAtt = attInBox[i]!;
          break;
        }
      }

      const targetAttSlot = team.lineup.indexOf(targetAtt.id);
      const targetAttRole = targetAttSlot >= 0 ? (team.roles[targetAttSlot] ?? 'st') : 'st';
      const targetAttFit = this.getPlayerRoleFit(targetAttRole, targetAtt.id);

      const targetDef = defInBox[0] ?? null;
      const targetDefSlot = targetDef ? oppTeam.lineup.indexOf(targetDef.id) : -1;
      const targetDefRole = targetDefSlot >= 0 ? (oppTeam.roles[targetDefSlot] ?? 'cb') : 'cb';
      const targetDefFit = targetDef ? this.getPlayerRoleFit(targetDefRole, targetDef.id) : 1.0;

      // Ground chance check (Low cross 60% ground or cut-back)
      const isLowCross = team.instructions.crossStyle === 'Low';
      const isCutBack =
        !isLowCross &&
        holderPIs.includes('crossFromByline') &&
        isAttWide &&
        this.rng.chance(K.d2.pi.crossFromByline.cutBackChance);

      if (isLowCross || isCutBack) {
        const isLowCutBack = isLowCross && this.rng.chance(0.4);
        // Ground duel: attacker pace .5 + offTheBall .5 vs def positioning .5 + pace .5
        let sGroundAtt =
          0.5 * z(targetAtt.attributes.pace) +
          0.5 * z(targetAtt.attributes.offTheBall) +
          (side === 'home' ? K.homeAdvantage : 0);
        if (targetAttRole === 'poacher') sGroundAtt += 0.35 * (0.4 + 0.6 * targetAttFit);
        const sGroundDef = targetDef
          ? 0.5 * z(targetDef.attributes.positioning) +
            0.5 * z(targetDef.attributes.pace) +
            (oppSide === 'home' ? K.homeAdvantage : 0)
          : 0;

        const pWinGround = sigmoid(K.intercepts.crossHeader + 0.8 * sGroundAtt - 0.8 * sGroundDef);
        if (this.rng.chance(pWinGround)) {
          const shotCtx: ShotContext =
            isCutBack || isLowCutBack
              ? this.rng.chance(0.4)
                ? 'HEADER'
                : 'BOX_CENTRAL'
              : this.rng.chance(0.6)
                ? 'HEADER'
                : 'BOX_CENTRAL';
          const shotRes = resolveShot({
            context: shotCtx,
            attacker: targetAtt,
            goalkeeper: gkSheet,
            defender: targetDef,
            trainingBonus: this.getTrainingBonus(side, 'attack'),
            homeAdvantage: side === 'home' ? K.homeAdvantage : 0,
            defenderHomeAdvantage: oppSide === 'home' ? K.homeAdvantage : 0,
            attackerRole: targetAttRole,
            attackerFit: targetAttFit,
            defendingPostMen: oppTeam.instructions.postMen,
            shootOnSight: team.instructions.finalThird === 'ShootOnSight',
            workIntoBox: team.instructions.finalThird === 'WorkIntoBox',
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
            this.ballPosAttacking = { ax: 52.5, ay: 34 };
            this.ballPosAbsolute = toAbsolute(52.5, 34, side, this.half);
            this.ballHolderId = this.selectOutfielder(team, 'CM');
          } else {
            this.checkTransition(oppSide, side, { ax: 35, ay: 34 });
          }
        }
        return;
      }

      // Aerial duel
      let sAirAtt =
        0.6 * z(targetAtt.attributes.heading) +
        0.4 * z(targetAtt.attributes.strength) +
        (side === 'home' ? K.homeAdvantage : 0);

      if (targetAttRole === 'target_man') sAirAtt += 0.35 * (0.4 + 0.6 * targetAttFit);

      let sAirDef = targetDef
        ? 0.5 * z(targetDef.attributes.heading) +
          0.3 * z(targetDef.attributes.strength) +
          0.2 * z(targetDef.attributes.positioning) +
          (oppSide === 'home' ? K.homeAdvantage : 0)
        : 0;

      if (targetDefRole === 'stopper' || (targetDefRole as any) === 'cb_step') {
        sAirDef += 0.2 * (0.4 + 0.6 * targetDefFit);
      }
      if (oppTeam.defRoles?.includes('dm_drop')) {
        sAirDef += 0.05;
      }

      if (team.instructions.crossStyle === 'Floated') {
        sAirAtt *= K.d2.crossStyle.floated.headerSkillMult;
        sAirDef *= K.d2.crossStyle.floated.headerSkillMult;
      }

      let pWin = sigmoid(K.intercepts.crossHeader + 0.8 * sAirAtt - 0.8 * sAirDef);
      if (team.roles.includes('false_nine')) {
        pWin = Math.max(0.01, pWin - 0.15);
      }

      if (this.rng.chance(pWin)) {
        const attPl = this.playerLines[targetAtt.id];
        if (attPl) attPl.aerialDuelsWon = (attPl.aerialDuelsWon ?? 0) + 1;
        const shotCtx: ShotContext =
          team.instructions.crossStyle === 'Floated'
            ? this.rng.chance(0.2)
              ? 'BOX_CENTRAL'
              : 'HEADER'
            : this.rng.chance(0.2)
              ? 'BOX_CENTRAL'
              : 'HEADER';
        const isWhipped = team.instructions.crossStyle === 'Whipped';
        const shotRes = resolveShot({
          context: shotCtx,
          attacker: targetAtt,
          goalkeeper: gkSheet,
          defender: targetDef,
          trainingBonus: this.getTrainingBonus(side, 'attack'),
          homeAdvantage: side === 'home' ? K.homeAdvantage : 0,
          defenderHomeAdvantage: oppSide === 'home' ? K.homeAdvantage : 0,
          attackerRole: targetAttRole,
          attackerFit: targetAttFit,
          extraOnTargetAdd:
            isWhipped && shotCtx === 'HEADER' ? K.d2.crossStyle.whipped.onTargetAdd : 0,
          extraXgRefAdd: isWhipped && shotCtx === 'HEADER' ? 0.02 : 0,
          isFloatedCross: team.instructions.crossStyle === 'Floated',
          defendingPostMen: oppTeam.instructions.postMen,
          shootOnSight: team.instructions.finalThird === 'ShootOnSight',
          workIntoBox: team.instructions.finalThird === 'WorkIntoBox',
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

      let ctx: ShotContext = forcedCtx ?? this.determineShotContext(this.ballPosAttacking);
      const holderSlot = team.lineup.indexOf(holderId);
      const holderRole = holderSlot >= 0 ? (team.roles[holderSlot] ?? 'cm') : 'cm';
      const holderFit = this.getPlayerRoleFit(holderRole, holderId);
      const holderPIs = holderSlot >= 0 ? (team.playerInstructions[holderSlot] ?? []) : [];

      const currentLane = classifyLane(this.ballPosAttacking.ay);
      const isOppShowInside = oppTeam.opposition.some(
        (o) => o.kind === 'showInside' && o.target === holderId,
      );
      const isOppShowOutside = oppTeam.opposition.some(
        (o) => o.kind === 'showOutside' && o.target === holderId,
      );

      if (
        currentLane !== 'Centre' &&
        (holderRole === 'inside_forward' || isOppShowInside) &&
        !isOppShowOutside
      ) {
        if (this.rng.chance(0.5)) {
          ctx =
            ctx === 'BOX_WIDE' ? 'BOX_CENTRAL' : ctx === 'OUTSIDE_WIDE' ? 'OUTSIDE_CENTRAL' : ctx;
        }
      }

      let attackerCtxModifier = 0;
      if (oppTeam.opposition.some((o) => o.kind === 'doubleUp' && o.target === holderId)) {
        attackerCtxModifier -= 0.2;
      }
      if (team.instructions.onWin === 'Counter' && this.phase.type === 'COUNTER') {
        attackerCtxModifier -= 0.25;
      }
      if (holderPIs.includes('shootMore') && ctx !== 'BOX_CENTRAL' && ctx !== 'ONE_ON_ONE') {
        attackerCtxModifier -= 0.35;
      }

      const isSweeperKeeperOpponent = oppTeam.roles[0] === 'sweeper_keeper';

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
        attackerRole: holderRole,
        attackerFit: holderFit,
        isSweeperKeeperOpponent,
        attackerCtxModifier,
        shootOnSight: team.instructions.finalThird === 'ShootOnSight',
        workIntoBox: team.instructions.finalThird === 'WorkIntoBox',
        defendingPostMen: oppTeam.instructions.postMen,
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

  /**
   * Where a shot of this context is struck, in the shooting side's attacking frame. Keeps the
   * current ball position when it already lies in the context's zone; otherwise picks a point in
   * the zone from a hash of the event sequence (deterministic, no RNG draw).
   */
  private shotOrigin(context: ShotContext): { ax: number; ay: number } {
    const zones: Record<ShotContext, [number, number, number, number]> = {
      PENALTY: [94, 94, 34, 34],
      SIX_YARD: [99.5, 101.5, 30, 38],
      HEADER: [93, 100.5, 28, 40],
      REBOUND: [93, 100, 27, 41],
      ONE_ON_ONE: [87, 96, 26, 42],
      BOX_CENTRAL: [89, 96, 26, 42],
      BOX_WIDE: [89, 99, 15, 25],
      OUTSIDE_CENTRAL: [76, 86, 24, 44],
      OUTSIDE_WIDE: [78, 88, 10, 22],
      DIRECT_FK: [70, 90, 14, 54],
    };
    const [x0, x1, y0, y1] = zones[context];
    const cur = this.ballPosAttacking;
    const mirrorY = cur.ay > 34; // wide zones are defined on the left; mirror to the ball's side
    const curY =
      context === 'BOX_WIDE' || context === 'OUTSIDE_WIDE'
        ? mirrorY
          ? 68 - cur.ay
          : cur.ay
        : cur.ay;
    if (context === 'DIRECT_FK' || (cur.ax >= x0 && cur.ax <= x1 && curY >= y0 && curY <= y1)) {
      return { ...cur };
    }
    let h = (this.seq * 2654435761 + Math.floor(this.t * 7)) >>> 0;
    const r1 = (h % 1000) / 1000;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    const r2 = (h % 1000) / 1000;
    const ax = x0 + (x1 - x0) * r1;
    let ay = y0 + (y1 - y0) * r2;
    if ((context === 'BOX_WIDE' || context === 'OUTSIDE_WIDE') && mirrorY) ay = 68 - ay;
    return { ax, ay };
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

    // Shot event. The shot starts where its context says it happened (a header from a cross is in
    // the box, not where the cross was hit from). Presentation only: it moves the reported ball
    // position (ballPosAbsolute), never the sim's ballPosAttacking, and draws no RNG, so results and
    // calibration are bit-identical.
    const origin = this.shotOrigin(context);
    this.ballPosAbsolute = toAbsolute(origin.ax, origin.ay, side, this.half);
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
        teamTackling: foulerTeam.instructions.tackling,
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
    const awardedTeam = awardedSide === 'home' ? this.homeTeam : this.awayTeam;
    const restartType = determineFoulRestart(
      attackingPos,
      this.rng,
      awardedTeam.setPieces?.freeKicks ?? awardedTeam.instructions.freeKicks,
    );
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
    } else {
      this.pendingRestart = {
        type: 'FREE_KICK',
        side: awardedSide,
        pos: { ...attackingPos },
        shotContext: restartType as any,
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

    // Transitions: onLoss Counter-press (SPEC §13.17.4)
    // When we lose the ball in open play in our MID or ATT third
    if (loserTeam.instructions.onLoss === 'CounterPress' && loserPosAttacking.ax >= 35) {
      const playerPressValues: number[] = [];
      for (let slot = 1; slot < loserTeam.lineup.length; slot++) {
        const id = loserTeam.lineup[slot];
        if (!id || loserTeam.redCardedPlayers.includes(id)) continue;
        const pSheet = this.getPlayerSheet(id);
        const sPress = 0.6 * z(pSheet.attributes.workRate) + 0.4 * z(pSheet.attributes.tackling);
        playerPressValues.push(sPress);
      }
      playerPressValues.sort((a, b) => b - a);
      const top3 = playerPressValues.slice(0, 3);
      const sPressMean = top3.length > 0 ? top3.reduce((a, b) => a + b, 0) / top3.length : 0;

      const holderId = this.selectOutfielder(winnerTeam, 'CM');
      const holderSheet = this.getPlayerSheet(holderId);
      const sPassHolder = z(holderSheet.attributes.passing);

      const pRegain = sigmoid(-1.25 + 0.8 * sPressMean - 0.6 * sPassHolder);

      if (this.rng.chance(pRegain)) {
        // Regained via tackle!
        this.possessionSide = loserSide;
        this.ballPosAttacking = { ...loserPosAttacking };
        this.ballPosAbsolute = toAbsolute(
          loserPosAttacking.ax,
          loserPosAttacking.ay,
          loserSide,
          this.half,
        );
        this.ballHolderId =
          loserTeam.lineup.find((id) => id && !loserTeam.redCardedPlayers.includes(id)) ?? null;
        this.teamStats[loserSide].tackles++;
        this.teamStats[loserSide].ballWinsMidAtt =
          (this.teamStats[loserSide].ballWinsMidAtt ?? 0) + 1;
        this.emitEvent('TACKLE', 1, {
          side: loserSide,
          playerId: this.ballHolderId ?? undefined,
          from: this.ballPosAbsolute,
          to: this.ballPosAbsolute,
          importance: 1,
        });
        return;
      } else {
        // Failed: opponent gets Counter phase for 2 steps with extra ctx +0.25; team fatigue ×1.05
        if (
          winnerTeam.instructions.mentality === 'VeryDefensive' &&
          winnerTeam.instructions.onWin !== 'Counter'
        ) {
          this.phase = { type: 'OPEN' };
        } else {
          this.counterPhaseExtraCtx = 0.25;
          this.phase = { type: 'COUNTER', remainingSteps: 2 };
          this.teamStats[winnerSide].countersStarted =
            (this.teamStats[winnerSide].countersStarted ?? 0) + 1;
          this.teamStats[loserSide].countersConceded =
            (this.teamStats[loserSide].countersConceded ?? 0) + 1;
        }
        for (const pid of loserTeam.lineup) {
          if (!pid) continue;
          const live = this.players[pid];
          if (live) live.fatigue = Math.min(100, live.fatigue * 1.05);
        }
      }
    }

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

    if (this.phase.type === 'COUNTER') {
      return;
    }

    // Transitions: onLoss Regroup vs onWin KeepIt vs Counter (SPEC §13.17.4)
    const winnerThird = classifyThird(newPos.ax);
    const isWinnerDefOrMid = winnerThird === 'DEF' || winnerThird === 'MID';

    if (winnerTeam.instructions.onWin === 'KeepIt') {
      this.phase = { type: 'OPEN' };
      this.stepsAfterKeepItWin = 2;
      return;
    }

    if (loserTeam.instructions.onLoss === 'Regroup') {
      this.stepsAfterRegroupWin = 3;
      // An opponent Counter phase can only start if our line is High or VeryAttacking (§13.17.4 & §13.18.1)
      if (
        isWinnerDefOrMid &&
        (loserTeam.instructions.line === 'High' ||
          loserTeam.instructions.mentality === 'VeryAttacking')
      ) {
        if (
          winnerTeam.instructions.mentality === 'VeryDefensive' &&
          winnerTeam.instructions.onWin !== 'Counter'
        ) {
          this.phase = { type: 'OPEN' };
          return;
        }
        this.phase = { type: 'COUNTER', remainingSteps: 2 };
        if (loserTeam.instructions.mentality === 'VeryAttacking') {
          this.counterPhaseExtraCtx = Math.max(
            this.counterPhaseExtraCtx,
            K.d2.mentality.veryAttackingOppCounterCtx,
          );
        }
        this.teamStats[winnerSide].countersStarted =
          (this.teamStats[winnerSide].countersStarted ?? 0) + 1;
        this.teamStats[loserSide].countersConceded =
          (this.teamStats[loserSide].countersConceded ?? 0) + 1;
      } else {
        this.phase = { type: 'OPEN' };
      }
      return;
    }

    // Standard counter check (§13.9, §13.18.1, §13.19.2)
    if (isWinnerDefOrMid) {
      if (
        winnerTeam.instructions.mentality === 'VeryDefensive' &&
        winnerTeam.instructions.onWin !== 'Counter'
      ) {
        this.phase = { type: 'OPEN' };
        return;
      }

      let pCounter = K.trans.counter.baselineTurnoverCounterChance ?? 0.22;
      if (loserTeam.instructions.mentality === 'Attacking') {
        pCounter += K.trans.counter.attackingTurnoverCounterAdd ?? 0.18;
      } else if (loserTeam.instructions.mentality === 'VeryAttacking') {
        pCounter += K.trans.counter.veryAttackingTurnoverCounterAdd ?? 0.28;
      }
      if (loserTeam.instructions.line === 'High') {
        pCounter += 0.08;
      }
      if (winnerTeam.instructions.onWin === 'Counter') {
        pCounter += K.trans.counter.bonusTriggerChance;
      }

      // Check w_high on winner team: bonus counter chance per winger with w_high (§13.19.2)
      const winnerDefRoles = winnerTeam.defRoles ?? [];
      const numWHigh = winnerDefRoles.filter((r) => r === 'w_high').length;
      if (numWHigh > 0) {
        pCounter += numWHigh * (K.droles.w_high.counterTriggerBonus ?? 0.045);
      }

      if (this.rng.chance(pCounter)) {
        this.phase = { type: 'COUNTER', remainingSteps: 2 };
        if (loserTeam.instructions.mentality === 'VeryAttacking') {
          this.counterPhaseExtraCtx = Math.max(
            this.counterPhaseExtraCtx,
            K.d2.mentality.veryAttackingOppCounterCtx,
          );
        }
        if (numWHigh > 0) {
          this.counterPhaseExtraCtx = Math.max(this.counterPhaseExtraCtx, 0.2);
        }
        this.teamStats[winnerSide].countersStarted =
          (this.teamStats[winnerSide].countersStarted ?? 0) + 1;
        this.teamStats[loserSide].countersConceded =
          (this.teamStats[loserSide].countersConceded ?? 0) + 1;
        if (winnerTeam.instructions.onWin === 'Counter') {
          for (const pid of winnerTeam.lineup) {
            if (!pid) continue;
            const live = this.players[pid];
            if (live) live.fatigue = Math.min(100, live.fatigue * 1.01);
          }
        }
        return;
      }
    }
    this.phase = { type: 'OPEN' };
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
        const oppTeam = this.possessionSide === 'home' ? this.awayTeam : this.homeTeam;
        if (oppTeam.defRoles?.includes('w_high') && this.rng.chance(0.65)) {
          ay = this.rng.chance(0.5) ? this.rngFloat(6, 20) : this.rngFloat(48, 62);
        } else if (this.rng.chance(0.4)) {
          ay = clamp(ay + this.rngFloat(-12, 12), 5, 63);
        }
      } else if (ax < 70) {
        // MID -> ATT (outside box)
        ax = this.rngFloat(72, 86);
        const oppTeam = this.possessionSide === 'home' ? this.awayTeam : this.homeTeam;
        if (oppTeam.defRoles?.includes('w_high') && this.rng.chance(0.75)) {
          ay = this.rng.chance(0.5) ? this.rngFloat(6, 20) : this.rngFloat(48, 62);
        } else if (this.rng.chance(0.4)) {
          ay = clamp(ay + this.rngFloat(-12, 12), 5, 63);
        }
      } else {
        // ATT -> 45% into box (60% if WorkIntoBox), 55% stay in ATT
        const team = this.possessionSide === 'home' ? this.homeTeam : this.awayTeam;
        const inBoxChance = team?.instructions.finalThird === 'WorkIntoBox' ? 0.6 : 0.45;
        if (this.rng.chance(inBoxChance)) {
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
    isThroughBall: boolean = false,
  ): PlayerId {
    const third = classifyThird(dest.ax);
    const lane = classifyLane(dest.ay);
    const zone: ZoneKey = `${third[0] as 'D' | 'M' | 'A'}${lane[0] as 'L' | 'C' | 'R'}` as ZoneKey;
    const fDef = FORMATIONS[team.formation];
    const oppTeam = team.side === 'home' ? this.awayTeam : this.homeTeam;

    const lineup = team.lineup;
    const redSet = team.redCardedPlayers;

    let totalWeight = 0;
    const candidateIds: PlayerId[] = [];
    const candidateWeights: number[] = [];
    const teamInvWeights = this.getTeamInvolvements(team.side);

    const hasMarkTighter = oppTeam.defInstructions?.some((pis) => pis.includes('markTighter'));
    let isZoneMarkedTighter = false;
    if (hasMarkTighter) {
      const mirroredZone = getMirroredZoneKey(zone);
      const defMarkerId = this.selectDefenderForZone(oppTeam, mirroredZone);
      if (defMarkerId) {
        const dSlot = oppTeam.lineup.indexOf(defMarkerId);
        if (dSlot >= 0 && oppTeam.defInstructions?.[dSlot]?.includes('markTighter')) {
          isZoneMarkedTighter = true;
        }
      }
    }

    for (let slot = 0; slot < lineup.length; slot++) {
      const id = lineup[slot];
      if (!id || id === holderId || redSet.includes(id)) continue;
      const slotPos = fDef.slots[slot]?.position || 'CM';
      const roleId = team.attRoles?.[slot] ?? team.roles[slot] ?? getDefaultRoleForPos(slotPos);
      const pis = team.attInstructions?.[slot] ?? team.playerInstructions[slot] ?? [];
      const fit = this.getPlayerRoleFit(roleId, id);

      const invWeights = teamInvWeights[slot]!;
      const baseW = Math.max(0.0001, invWeights[zone]);
      const isTightMarked = oppTeam.opposition.some(
        (o) => o.kind === 'tightMark' && o.target === id,
      );
      let mult = getReceiverWeightMultiplier({
        roleId,
        fit,
        third,
        isThroughBall,
        playerInstructions: pis,
        isTightMarked,
      });

      if (isZoneMarkedTighter) {
        mult *= 0.85;
      }

      const w = baseW * mult;
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

  private selectDefenderForZone(defTeam: LiveTeamState, zone: ZoneKey): PlayerId | null {
    const defInvWeights = this.getTeamInvolvements(defTeam.side);
    let bestDefId: PlayerId | null = null;
    let bestDefW = -1;
    for (let slot = 1; slot < defTeam.lineup.length; slot++) {
      const defId = defTeam.lineup[slot];
      if (!defId || defTeam.redCardedPlayers.includes(defId)) continue;
      const defInv = defInvWeights[slot];
      if (defInv && defInv[zone] > bestDefW) {
        bestDefW = defInv[zone];
        bestDefId = defId;
      }
    }
    return bestDefId;
  }

  private findMarkerForTarget(defTeam: LiveTeamState, targetId: PlayerId): PlayerId | null {
    const attTeam = defTeam.side === 'home' ? this.awayTeam : this.homeTeam;
    const targetSlot = attTeam.lineup.indexOf(targetId);
    if (targetSlot < 0) return null;
    const attInvWeights = this.getTeamInvolvements(attTeam.side);
    const targetInv = attInvWeights[targetSlot]!;

    let maxZone: ZoneKey = 'AC';
    let maxW = -1;
    for (const [zKey, w] of Object.entries(targetInv)) {
      if (w > maxW) {
        maxW = w;
        maxZone = zKey as ZoneKey;
      }
    }
    const mirrored = getMirroredZoneKey(maxZone);

    const defInvWeights = this.getTeamInvolvements(defTeam.side);
    let bestDefId: PlayerId | null = null;
    let bestDefW = -1;
    for (let slot = 1; slot < defTeam.lineup.length; slot++) {
      const defId = defTeam.lineup[slot];
      if (!defId || defTeam.redCardedPlayers.includes(defId)) continue;
      const defInv = defInvWeights[slot]!;
      if (defInv[mirrored] > bestDefW) {
        bestDefW = defInv[mirrored];
        bestDefId = defId;
      }
    }
    return bestDefId;
  }

  private selectPrimaryDefenderId(
    oppTeam: LiveTeamState,
    targetAttackerId?: PlayerId | null,
  ): PlayerId | null {
    if (targetAttackerId) {
      const tightMarkOrder = oppTeam.opposition.find(
        (o) => o.kind === 'tightMark' && o.target === targetAttackerId,
      );
      if (tightMarkOrder) {
        const markerId = this.findMarkerForTarget(oppTeam, targetAttackerId);
        if (markerId && !oppTeam.redCardedPlayers.includes(markerId)) {
          return markerId;
        }
      }
    }

    const third = classifyThird(this.ballPosAttacking.ax);
    const lane = classifyLane(this.ballPosAttacking.ay);
    const mirroredThird = third === 'ATT' ? 'DEF' : third === 'DEF' ? 'ATT' : 'MID';
    const mirroredLane = lane === 'Left' ? 'Right' : lane === 'Right' ? 'Left' : 'Centre';
    const mirroredZone: ZoneKey =
      `${mirroredThird[0] as 'D' | 'M' | 'A'}${mirroredLane[0] as 'L' | 'C' | 'R'}` as ZoneKey;

    const inBoxNow = isBox(this.ballPosAttacking.ax, this.ballPosAttacking.ay);

    const lineup = oppTeam.lineup;
    const redSet = oppTeam.redCardedPlayers;

    let totalWeight = 0;
    const candidateIds: PlayerId[] = [];
    const candidateWeights: number[] = [];
    const oppInvWeights = this.getTeamInvolvements(oppTeam.side);

    for (let slot = 0; slot < lineup.length; slot++) {
      const id = lineup[slot];
      if (!id || redSet.includes(id)) continue;
      if (slot === 0 && !inBoxNow) continue;

      const invWeights = oppInvWeights[slot]!;
      const w = Math.max(0.0001, invWeights[mirroredZone]);
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
    const oppTeam = team.side === 'home' ? this.awayTeam : this.homeTeam;
    const matching: PlayerId[] = [];
    for (let i = 1; i < team.lineup.length; i++) {
      const id = team.lineup[i];
      if (id && !team.redCardedPlayers.includes(id)) {
        if (this.getPlayerPosition(id) === preferredPos) matching.push(id);
      }
    }
    if (matching.length > 0) {
      const unmarked = matching.filter(
        (id) => !oppTeam.opposition.some((o) => o.kind === 'tightMark' && o.target === id),
      );
      if (unmarked.length > 0 && unmarked.length < matching.length) {
        if (this.rng.chance(0.25)) {
          return unmarked[this.rng.int(0, unmarked.length - 1)]!;
        }
      }
      return matching[this.rng.int(0, matching.length - 1)]!;
    }
    const allOutfield: PlayerId[] = [];
    for (let i = 1; i < team.lineup.length; i++) {
      const id = team.lineup[i];
      if (id && !team.redCardedPlayers.includes(id)) allOutfield.push(id);
    }
    if (allOutfield.length > 0) {
      return allOutfield[this.rng.int(0, allOutfield.length - 1)]!;
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
    const homeSlot = this.homeTeam.lineup.indexOf(id);
    const awaySlot = this.awayTeam.lineup.indexOf(id);
    const slot = homeSlot >= 0 ? homeSlot : awaySlot >= 0 ? awaySlot : 0;
    const foot = this.input.home.players[id]?.foot ?? this.input.away.players[id]?.foot ?? 'Right';
    return {
      id,
      name: sheet.name,
      slot,
      attributes: sheet.attributes,
      condition: live.condition,
      morale: live.morale,
      foot,
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

  private isTeamLeadingLate(side: Side): boolean {
    const oppSide: Side = side === 'home' ? 'away' : 'home';
    return this.t >= K.d2.timeWasting.minMinute * 60 && this.score[side] > this.score[oppSide];
  }

  private getRestartDuration(baseDur: number, side: Side, takerId?: PlayerId | null): number {
    const team = side === 'home' ? this.homeTeam : this.awayTeam;
    if (team.instructions.timeWasting === 'WhenAhead' && this.isTeamLeadingLate(side)) {
      const dur = Math.round(baseDur * K.d2.timeWasting.restartDurationMult);
      const extra = dur - baseDur;
      if (this.half === 2) {
        this.stoppage2 += extra * K.d2.timeWasting.stoppageExtraRatio;
        this.periodEnd += extra * K.d2.timeWasting.stoppageExtraRatio;
      }
      if (takerId && this.rng.chance(K.d2.timeWasting.yellowRiskPerRestart)) {
        this.issueYellowCard(takerId, side);
      }
      return dur;
    }
    return baseDur;
  }

  private issueYellowCard(playerId: PlayerId, side: Side): void {
    const liveP = this.players[playerId];
    const team = side === 'home' ? this.homeTeam : this.awayTeam;
    if (liveP && liveP.yellowCards >= 1) {
      liveP.isRedCarded = true;
      team.redCardedPlayers.push(playerId);
      this.teamStats[side].red++;
      const pl = this.playerLines[playerId];
      if (pl) pl.red = 1;
      this.emitEvent('RED', 0, {
        side,
        playerId,
        importance: 3,
      });
    } else {
      this.teamStats[side].yellow++;
      const pl = this.playerLines[playerId];
      if (pl) pl.yellow = 1;
      if (liveP) liveP.yellowCards = 1;
      this.emitEvent('YELLOW', 0, {
        side,
        playerId,
        importance: 2,
      });
    }
  }

  private getFamiliarityCtxPenalty(side: Side): number {
    const sheet = side === 'home' ? this.input.home : this.input.away;
    const fam = sheet.areaFamiliarity;
    if (!fam) return 0;
    const team = side === 'home' ? this.homeTeam : this.awayTeam;
    let penalty = 0;
    const fFam = fam.formation[team.formation] ?? 100;
    if (fFam < K.d2.familiarity.threshold) {
      penalty -= (K.d2.familiarity.threshold - fFam) / K.d2.familiarity.divisor;
    }
    const mFam = fam.mentality[team.instructions.mentality] ?? 100;
    if (mFam < K.d2.familiarity.threshold) {
      penalty -= (K.d2.familiarity.threshold - mFam) / K.d2.familiarity.divisor;
    }
    const pFam = fam.passing[team.instructions.passing] ?? 100;
    if (pFam < K.d2.familiarity.threshold) {
      penalty -= (K.d2.familiarity.threshold - pFam) / K.d2.familiarity.divisor;
    }
    const prFam = fam.pressing[team.instructions.pressing] ?? 100;
    if (prFam < K.d2.familiarity.threshold) {
      penalty -= (K.d2.familiarity.threshold - prFam) / K.d2.familiarity.divisor;
    }
    return Math.max(K.d2.familiarity.maxPenalty, penalty);
  }

  private getTrainingBonus(side: Side, type: 'attack' | 'defence' | 'setPieces'): number {
    const sheet = side === 'home' ? this.input.home : this.input.away;
    const oppSheet = side === 'home' ? this.input.away : this.input.home;
    let bonus = sheet.trainingBonus[type] || 0;
    bonus += this.getFamiliarityCtxPenalty(side);

    // SPEC §12.17.5 Cohesion match effect: all execution ctx + (cohesion - 50) / 1000
    const cohesion = sheet.cohesion ?? 50;
    bonus += (cohesion - 50) * BALANCE.club.cohesionMatchExecutionFactor;

    // SPEC §12.17.2 Match Prep effects
    if (type === 'setPieces') {
      if (sheet.prep === 'SetPieces') bonus += 0.12;
      if (oppSheet.prep === 'SetPieces') bonus += BALANCE.club.prepBonusSetPieces;
    }

    const oppSide: Side = side === 'home' ? 'away' : 'home';
    const oppTeam = oppSide === 'home' ? this.homeTeam : this.awayTeam;
    if (
      type === 'attack' &&
      oppTeam.instructions.timeWasting === 'WhenAhead' &&
      this.isTeamLeadingLate(oppSide) &&
      this.t >= 85 * 60
    ) {
      bonus += K.d2.timeWasting.oppAttackingCtxAdd85;
    }

    return bonus;
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
