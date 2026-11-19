// Implements SPEC §20 and §22.1 New Game and Save Migration tests
import { describe, it, expect } from 'vitest';
import { createNewGame } from '@/core/game/newGame';
import { migrateSave } from '@/core/game/migrations';
import { SAVE_VERSION } from '@/config/constants';

describe('New Game and Save Migrations (SPEC §20)', () => {
  it('creates initial GameState from snapshot for a chosen club', () => {
    const game = createNewGame({
      seed: 1234567,
      userClubId: 'c01',
      managerName: 'The Gaffer',
    });

    expect(game.version).toBe(SAVE_VERSION);
    expect(game.userClubId).toBe('c01');
    expect(game.managerName).toBe('The Gaffer');
    expect(game.matchday).toBe(0);
    expect(game.phase).toBe('BoardMeeting');
    expect(game.inbox.length).toBeGreaterThanOrEqual(1);
    expect(game.news.length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(game.clubs)).toHaveLength(10);
    expect(Object.keys(game.players)).toHaveLength(280);
  });

  it('migrateSave accepts valid current version state', () => {
    const game = createNewGame({
      seed: 9876543,
      userClubId: 'c02',
    });

    const migrated = migrateSave(game);
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.userClubId).toBe('c02');
  });

  it('migrateSave rejects saves from future versions', () => {
    const futureSave = {
      version: SAVE_VERSION + 1,
      clubs: {},
    };

    expect(() => migrateSave(futureSave)).toThrow(
      'This save is from a newer version of TOUCHLINE.',
    );
  });
});
