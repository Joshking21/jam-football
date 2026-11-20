// Implements SPEC §13.3 Match State and Snapshot Types
import {
  Side,
  PlayerId,
  ShotContext,
  MatchEventType,
  MatchEvent,
  TeamMatchStats,
  PlayerMatchLine,
  MatchInput,
  MatchCommand,
  Formation,
  Tactics,
  Duty,
  TeamInstructions,
  Injury,
  RoleId,
  PlayerInstruction,
  OppOrder,
} from '../types';
import { RngState } from '../rng';

export type MatchPhase =
  | { type: 'OPEN' }
  | { type: 'COUNTER'; remainingSteps: number }
  | {
      type: 'SET_PIECE';
      setPiece: 'CORNER' | 'THROW_IN' | 'GOAL_KICK' | 'FREE_KICK' | 'PENALTY' | 'KICKOFF';
    };

export interface PendingRestart {
  type: 'THROW_IN' | 'GOAL_KICK' | 'CORNER' | 'FREE_KICK' | 'PENALTY' | 'KICKOFF';
  side: Side;
  pos: { ax: number; ay: number }; // Attacking frame of the taking team
  shotContext?: ShotContext;
}

export interface LiveTeamState {
  clubId: string;
  side: Side;
  formation: Formation;
  lineup: (PlayerId | null)[]; // 11 slots
  roles: RoleId[];
  playerInstructions: PlayerInstruction[][];
  opposition: OppOrder[];
  duties: Duty[];
  bench: PlayerId[];
  instructions: TeamInstructions;
  captain: PlayerId | null;
  penaltyTaker: PlayerId | null;
  freeKickTaker: PlayerId | null;
  cornerTaker: PlayerId | null;
  longThrowTaker: PlayerId | null;
  subsUsed: number;
  inPlayWindowsUsed: number;
  redCardedPlayers: PlayerId[];
  substitutedPlayers: PlayerId[];
  focusBoostExpiryT: number;
}

export interface LivePlayerState {
  id: PlayerId;
  side: Side;
  name: string;
  shirt: number;
  condition: number;
  fatigue: number;
  morale: number;
  yellowCards: number;
  isRedCarded: boolean;
  isInjured: boolean;
  failedDribbles: number;
  errorsLeadingToGoal: number;
}

export interface MatchSnapshot {
  input: MatchInput;
  seed: number;
  rngSnapshot: RngState;
  t: number;
  half: 1 | 2;
  periodEnd: number;
  addedTimeAnnounced: boolean;
  possessionSide: Side | null;
  ballPosAttacking: { ax: number; ay: number };
  ballPosAbsolute: { x: number; y: number };
  ballHolderId: PlayerId | null;
  phase: MatchPhase;
  pendingRestart: PendingRestart | null;
  homeTeam: LiveTeamState;
  awayTeam: LiveTeamState;
  players: Record<PlayerId, LivePlayerState>;
  teamStats: { home: TeamMatchStats; away: TeamMatchStats };
  playerLines: Record<PlayerId, PlayerMatchLine>;
  score: { home: number; away: number };
  events: MatchEvent[];
  seq: number;
  pendingCommands: MatchCommand[];
  injuries: { playerId: PlayerId; injury: Injury }[];
  isFinished: boolean;
}
