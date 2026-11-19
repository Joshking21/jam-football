// Implements SPEC §10, §22 Game Flow and Advance State Machine Tests
import { describe, it, expect } from 'vitest';
import { createNewGame } from '@/core/game/newGame';
import { advance, validateLineup } from '@/core/game/advance';
import { pickBestLineup } from '@/core/match/aiManager';

describe('advance (SPEC §10 Game Flow)', () => {
  it('advances from BoardMeeting to Preseason', () => {
    const state = createNewGame({ seed: 1234, userClubId: 'c01' });
    expect(state.phase).toBe('BoardMeeting');
    expect(state.matchday).toBe(0);

    const next = advance(state);
    expect(next.phase).toBe('Preseason');
  });

  it('advances from Preseason to Matchday 1 PreMatch', () => {
    let state = createNewGame({ seed: 1234, userClubId: 'c01' });
    state = advance(state); // Preseason
    state = advance(state); // PreMatch

    expect(state.phase).toBe('PreMatch');
    expect(state.matchday).toBe(1);
  });

  it('validates lineup correctly: detects missing starter or injured player', () => {
    const state = createNewGame({ seed: 1234, userClubId: 'c01' });
    const userClub = state.clubs[state.userClubId]!;

    // Valid lineup
    const validRes = validateLineup(userClub.tactics, state.players);
    expect(validRes.valid).toBe(true);

    // Invalid: missing 1 starter
    const badTactics = JSON.parse(JSON.stringify(userClub.tactics));
    badTactics.lineup[10] = null;
    const missingRes = validateLineup(badTactics, state.players);
    expect(missingRes.valid).toBe(false);
    expect(missingRes.reason).toContain('11 starting players');

    // Invalid: injured player in lineup
    const injuredTactics = JSON.parse(JSON.stringify(userClub.tactics));
    const pId = injuredTactics.lineup[1]!;
    state.players[pId]!.injury = {
      kind: 'Hamstring',
      severity: 'Minor',
      matchdaysOut: 2,
    };
    const injRes = validateLineup(injuredTactics, state.players);
    expect(injRes.valid).toBe(false);
    expect(injRes.reason).toContain('injured');
  });

  it('advances through matchday: PreMatch -> Match -> PostMatch -> WeekSummary -> PreMatch', () => {
    let state = createNewGame({ seed: 5555, userClubId: 'c01' });
    state = advance(state); // Preseason
    state = advance(state); // PreMatch (MD1)

    // PreMatch -> Match
    state = advance(state);
    expect(state.phase).toBe('Match');
    expect(state.pendingMatch).toBeDefined();

    // Match -> PostMatch (instant simulation of all fixtures)
    state = advance(state);
    expect(state.phase).toBe('PostMatch');

    // Verify all 5 round fixtures were played and table updated
    const md1Fixtures = state.fixtures.filter((f) => f.matchday === 1);
    expect(md1Fixtures.every((f) => f.result !== null)).toBe(true);
    expect(state.table.every((r) => r.p === 1)).toBe(true);

    // PostMatch -> WeekSummary
    state = advance(state);
    expect(state.phase).toBe('WeekSummary');

    // WeekSummary -> Matchday 2 PreMatch
    state = advance(state);
    expect(state.phase).toBe('PreMatch');
    expect(state.matchday).toBe(2);
  });

  it('can simulate a full 18-matchday season to SeasonEnd', () => {
    let state = createNewGame({ seed: 8888, userClubId: 'c01' });
    state = advance(state); // Preseason
    state = advance(state); // PreMatch (MD1)

    while (state.phase !== 'SeasonEnd' && state.phase !== 'Sacked') {
      if (state.phase === 'PreMatch') {
        const userClub = state.clubs[state.userClubId]!;
        const val = validateLineup(userClub.tactics, state.players);
        if (!val.valid) {
          // Assistant auto-fixes lineup if injuries/bans occurred
          const candidates = userClub.squad
            .map((id) => state.players[id])
            .filter((p): p is any => p != null)
            .map((p) => ({
              ...p,
              isInjured: p.injury !== null,
              isSuspended: p.suspendedMatches > 0,
            }));
          const best = pickBestLineup(
            candidates,
            userClub.style.formation,
            userClub.formationFamiliarity,
          );
          userClub.tactics.formation = best.formation;
          userClub.tactics.lineup = [...best.lineup];
          userClub.tactics.duties = [...best.duties];
          userClub.tactics.bench = [...best.bench];
        }
      }
      state = advance(state);
    }

    expect(state.phase).toBe('SeasonEnd');
    expect(state.matchday).toBe(18);
    expect(state.table.every((r) => r.p === 18)).toBe(true);
    expect(state.awards).toBeDefined();
    expect(state.awards?.goldenBoot).toBeDefined();
    expect(state.awards?.playerOfTheSeason).toBeDefined();
    expect(state.score).toBeGreaterThan(0);
  });
});
