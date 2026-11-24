// Implements SPEC §13.12 Match Commands (tactics, formations, substitutions)
import { MatchCommand, MatchEventType, Side, PlayerId } from '../types';

export const DEAD_BALL_EVENT_TYPES: Set<MatchEventType> = new Set([
  'THROW_IN',
  'GOAL_KICK',
  'CORNER',
  'FREE_KICK',
  'FOUL',
  'OFFSIDE',
  'GOAL',
  'INJURY',
  'KNOCK',
  'HALF_TIME',
]);

export interface CommandQueueState {
  pendingCommands: MatchCommand[];
}

export function shouldApplyCommand(
  cmd: MatchCommand,
  currentT: number,
  lastEventType: MatchEventType | null,
  isHalfTime: boolean,
): boolean {
  if (
    cmd.kind === 'instructions' ||
    cmd.kind === 'formation' ||
    cmd.kind === 'opposition' ||
    cmd.kind === 'plan'
  ) {
    // Instructions/formation/opposition/plan take effect at first step starting at or after issuedAtT + 30
    return currentT >= cmd.issuedAtT + 30;
  }

  if (cmd.kind === 'sub') {
    // Subs take effect at the first dead ball at or after issuedAtT
    if (currentT < cmd.issuedAtT) return false;
    if (isHalfTime) return true;
    return lastEventType != null && DEAD_BALL_EVENT_TYPES.has(lastEventType);
  }

  if (cmd.kind === 'shout') {
    // Shouts take effect at first step at or after issuedAtT + 10 (§13.21)
    return currentT >= cmd.issuedAtT + 10;
  }

  if (cmd.kind === 'knock') {
    // Knocks take effect at the first dead ball at or after issuedAtT (§12.19.1)
    if (currentT < cmd.issuedAtT) return false;
    if (isHalfTime) return true;
    return lastEventType != null && DEAD_BALL_EVENT_TYPES.has(lastEventType);
  }

  return false;
}

export function canMakeSub(
  side: Side,
  subsUsed: number,
  windowsUsed: number,
  isHalfTime: boolean,
  outId: PlayerId,
  inId: PlayerId,
  lineup: (PlayerId | null)[],
  bench: PlayerId[],
  redCardedPlayers: Set<PlayerId>,
  substitutedPlayers: Set<PlayerId>,
): { allowed: boolean; reason?: string } {
  // Max 5 subs
  if (subsUsed >= 5) {
    return { allowed: false, reason: 'Maximum 5 substitutions reached' };
  }

  // Max 3 windows (half-time does not use a window)
  if (!isHalfTime && windowsUsed >= 3) {
    return { allowed: false, reason: 'Maximum 3 in-play substitution windows reached' };
  }

  // Sent-off player cannot be replaced
  if (redCardedPlayers.has(outId)) {
    return { allowed: false, reason: 'Sent-off player cannot be replaced' };
  }

  // No re-entry
  if (substitutedPlayers.has(inId)) {
    return { allowed: false, reason: 'Substituted players cannot re-enter' };
  }

  // Out player must be on pitch
  if (!lineup.includes(outId)) {
    return { allowed: false, reason: 'Player to substitute out is not on the pitch' };
  }

  // In player must be on bench
  if (!bench.includes(inId)) {
    return { allowed: false, reason: 'Player to substitute in is not on the bench' };
  }

  return { allowed: true };
}
