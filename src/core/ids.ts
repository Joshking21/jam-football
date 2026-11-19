// Implements SPEC §6 ID generation standards
import { PlayerId, ClubId, FixtureId } from './types';

export function makePlayerId(index: number): PlayerId {
  return `p${String(index).padStart(4, '0')}`;
}

export function makeClubId(index: number): ClubId {
  return `c${String(index).padStart(2, '0')}`;
}

export function makeFixtureId(index: number): FixtureId {
  return `f${String(index).padStart(3, '0')}`;
}

export function makeNewsId(counter: number): string {
  return `n${String(counter).padStart(4, '0')}`;
}

export function makeInboxId(counter: number): string {
  return `m${String(counter).padStart(4, '0')}`;
}

export function makeOfferId(counter: number): string {
  return `off_${String(counter).padStart(4, '0')}`;
}
