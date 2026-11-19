// Implements SPEC §6 ID format unit tests
import { describe, it, expect } from 'vitest';
import {
  makePlayerId,
  makeClubId,
  makeFixtureId,
  makeNewsId,
  makeInboxId,
  makeOfferId,
} from '@/core/ids';

describe('ID generators', () => {
  it('formats player IDs as p0001..', () => {
    expect(makePlayerId(1)).toBe('p0001');
    expect(makePlayerId(280)).toBe('p0280');
  });

  it('formats club IDs as c01..c10', () => {
    expect(makeClubId(1)).toBe('c01');
    expect(makeClubId(10)).toBe('c10');
  });

  it('formats fixture IDs as f001..', () => {
    expect(makeFixtureId(1)).toBe('f001');
    expect(makeFixtureId(90)).toBe('f090');
  });

  it('formats news and inbox IDs', () => {
    expect(makeNewsId(5)).toBe('n0005');
    expect(makeInboxId(12)).toBe('m0012');
    expect(makeOfferId(3)).toBe('off_0003');
  });
});
