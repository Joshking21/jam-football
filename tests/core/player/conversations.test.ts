import { describe, it, expect } from 'vitest';
import {
  checkConversationTriggers,
  applyConversationReply,
  evaluatePromisesAfterMatch,
} from '@/core/player/conversations';
import {
  Club,
  Player,
  PlayerId,
  Fixture,
  ActiveConversation,
  Attributes,
  PlayerSeasonStats,
} from '@/core/types';
import conversationsData from '@/content/conversations.json';

function createMockClub(id = 'c01'): Club {
  return {
    id,
    name: 'Port Calloway FC',
    shortName: 'Port Calloway',
    code: 'PCW',
    city: 'Port Calloway',
    stadium: { name: 'Harbour Ground', capacity: 12000 },
    reputation: 3,
    balance: 5_000_000,
    transferBudget: 2_000_000,
    wageBudget: 45_000,
    boardConfidence: 65,
    fanMood: 60,
    seasonStats: {
      gateIncome: 0,
      tvIncome: 0,
      sponsorIncome: 0,
      prizeMoney: 0,
      wagesPaid: 0,
      transferIn: 0,
      transferOut: 0,
      operating: 0,
    },
    rivals: ['c02'],
    colors: { primary: '#0A2540', secondary: '#F4B400', text: '#FFFFFF' },
    tactics: {
      formation: '4-3-3',
      lineup: ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p09', 'p10', 'p11'],
      bench: ['p12', 'p13', 'p14', 'p15'],
      roles: [],
      playerInstructions: [],
      duties: [],
      instructions: {} as any,
      captain: 'p01',
      takers: {
        penalty: 'p01',
        freeKick: 'p01',
        corner: 'p02',
        longThrow: null,
      },
      opposition: [],
    },
    trainingPlan: { intensity: 'Normal', focus: 'Balanced', individual: {} },
    style: {
      formation: '4-3-3',
      mentality: 'Balanced',
      tempo: 'Normal',
      passing: 'Mixed',
      line: 'Normal',
      pressing: 'Mid',
      width: 'Normal',
      focus: 'Mixed',
      onLoss: 'Regroup',
      onWin: 'KeepIt',
      distribution: 'Mixed',
    } as any,
    formationFamiliarity: { '4-3-3': 80 } as any,
    expectation: { target: 4, acceptable: 7, label: 'Mid-table finish' },
    squad: ['p01', 'p02', 'p03'],
  } as unknown as Club;
}

function createMockAttributes(overrides: Partial<Attributes> = {}): Attributes {
  return {
    finishing: 15,
    longShots: 12,
    passing: 11,
    crossing: 10,
    firstTouch: 13,
    dribbling: 12,
    tackling: 6,
    heading: 13,
    setPieces: 8,
    pace: 14,
    stamina: 14,
    strength: 13,
    offTheBall: 14,
    positioning: 14,
    decisions: 12,
    composure: 13,
    workRate: 14,
    reflexes: 3,
    handling: 2,
    oneOnOnes: 2,
    aerialCommand: 2,
    ...overrides,
  };
}

function createMockStats(overrides: Partial<PlayerSeasonStats> = {}): PlayerSeasonStats {
  return {
    apps: 4,
    starts: 4,
    goals: 2,
    assists: 1,
    yellow: 0,
    red: 0,
    cleanSheets: 0,
    minutes: 360,
    ratingSum: 28.5,
    ratedApps: 4,
    motm: 0,
    shots: 10,
    shotsOnTarget: 6,
    keyPasses: 4,
    tacklesWon: 2,
    interceptions: 1,
    saves: 0,
    goalsConceded: 0,
    ...overrides,
  };
}

function createMockPlayer(id: PlayerId, overrides: Partial<Player> = {}): Player {
  return {
    id,
    firstName: 'Marcus',
    lastName: 'Vance',
    age: 26,
    nationality: 'ENG',
    heightCm: 182,
    foot: 'Right',
    squadNumber: 9,
    positions: [{ pos: 'ST', familiarity: 100 }],
    attributes: createMockAttributes(overrides.attributes),
    morale: 65,
    condition: 100,
    fatigue: 10,
    form: [7.0, 7.2, 7.1],
    injury: null,
    suspendedMatches: 0,
    contract: {
      wagePerWeek: 3500,
      yearsLeft: 2,
      role: 'Starter',
      promisedRole: 'Starter',
    },
    personality: 'Professional',
    clubId: 'c01',
    growth: 0,
    potential: 78,
    stats: createMockStats(overrides.stats),
    ...overrides,
  } as unknown as Player;
}

describe('Player Conversations System (SPEC §12.9, §16.4)', () => {
  describe('Content Validation & v1.7 Guidelines', () => {
    it('contains all 4 required conversation types with >= 3 openings and 3 replies each', () => {
      const types = ['playing_time', 'contract', 'unhappy', 'praise'] as const;
      for (const type of types) {
        const typeData = (conversationsData as any)[type];
        expect(typeData, `Missing conversation type ${type}`).toBeDefined();
        expect(typeData.openings.length).toBeGreaterThanOrEqual(3);

        for (const opening of typeData.openings) {
          expect(opening.id).toBeDefined();
          expect(opening.text.length).toBeGreaterThan(0);
          expect(opening.voText.length).toBeGreaterThan(0);
          expect(opening.voText).not.toContain('{player}');
          expect(opening.replies.length).toBe(3);

          for (const rep of opening.replies) {
            expect(rep.id).toBeDefined();
            expect(rep.tone).toBeDefined();
            expect(rep.text.length).toBeGreaterThan(0);
            expect(rep.voText.length).toBeGreaterThan(0);
            expect(rep.voText).not.toContain('{player}');
            expect(rep.playerReaction.length).toBeGreaterThan(0);

            // Coach lines with nameSlot must have {player} at start or end
            if (rep.nameSlot) {
              expect(['start', 'end']).toContain(rep.nameSlot);
              expect(rep.text).toContain('{player}');
              if (rep.nameSlot === 'start') {
                expect(rep.text.startsWith('{player}')).toBe(true);
              } else {
                expect(rep.text.endsWith('{player}.') || rep.text.endsWith('{player}')).toBe(true);
              }
            }
          }
        }
      }
    });

    it('ensures at least 1 reply option per opening names a player via nameSlot (SPEC 1.7)', () => {
      const types = ['playing_time', 'contract', 'unhappy', 'praise'] as const;
      for (const type of types) {
        const typeData = (conversationsData as any)[type];
        for (const opening of typeData.openings) {
          const namedReplies = opening.replies.filter((r: any) => r.nameSlot != null);
          expect(
            namedReplies.length,
            `Expected opening ${opening.id} to have at least 1 reply naming the player`,
          ).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });

  describe('Trigger Logic (SPEC §12.9)', () => {
    it('triggers playing_time when a key player starts < 50% of the last 4 matches while fit', () => {
      const club = createMockClub('c01');
      const p1 = createMockPlayer('p01', {
        contract: { wagePerWeek: 3000, yearsLeft: 2, role: 'Starter', promisedRole: 'Starter' },
        stats: createMockStats({
          apps: 2,
          starts: 0,
          minutes: 30,
          ratingSum: 12.0,
          ratedApps: 2,
        }),
      });
      const players: Record<PlayerId, Player> = { p01: p1 };

      const fixtures: Fixture[] = [
        {
          id: 'f1',
          matchday: 1,
          homeId: 'c01',
          awayId: 'c02',
          isDerby: false,
          weather: 'Clear',
          kickoff: 'Afternoon',
          result: {
            homeGoals: 1,
            awayGoals: 0,
            scorers: [],
            attendance: 5000,
            motm: 'p02' as PlayerId,
            stats: {} as any,
          },
        },
        {
          id: 'f2',
          matchday: 2,
          homeId: 'c03',
          awayId: 'c01',
          isDerby: false,
          weather: 'Clear',
          kickoff: 'Afternoon',
          result: {
            homeGoals: 0,
            awayGoals: 0,
            scorers: [],
            attendance: 4000,
            motm: 'p03' as PlayerId,
            stats: {} as any,
          },
        },
      ];

      // Always pass random check (rng = 0.1)
      const res = checkConversationTriggers(club, players, fixtures, 3, [], () => 0.1);
      expect(res).not.toBeNull();
      expect(res?.conversation.type).toBe('playing_time');
      expect(res?.conversation.playerId).toBe('p01');
      expect(res?.inboxItem.requiresAction).toBe(true);
      expect(res?.inboxItem.action?.type).toBe('conversation');
    });

    it('triggers unhappy morale when player morale < 30', () => {
      const club = createMockClub('c01');
      const p1 = createMockPlayer('p01', { morale: 25 });
      const players: Record<PlayerId, Player> = { p01: p1 };

      const res = checkConversationTriggers(club, players, [], 3, [], () => 0.1);
      expect(res).not.toBeNull();
      expect(res?.conversation.type).toBe('unhappy');
      expect(res?.conversation.playerId).toBe('p01');
    });

    it('triggers contract discussion when player is Ambitious with 1 year remaining', () => {
      const club = createMockClub('c01');
      const p1 = createMockPlayer('p01', {
        personality: 'Ambitious',
        contract: { wagePerWeek: 2000, yearsLeft: 1, role: 'Rotation' },
      });
      const players: Record<PlayerId, Player> = { p01: p1 };

      const res = checkConversationTriggers(club, players, [], 3, [], () => 0.1);
      expect(res).not.toBeNull();
      expect(res?.conversation.type).toBe('contract');
      expect(res?.conversation.playerId).toBe('p01');
    });

    it('triggers praise when player average rating over last 3 matches >= 7.5', () => {
      const club = createMockClub('c01');
      const p1 = createMockPlayer('p01', {
        form: [7.8, 8.2, 7.6],
      });
      const players: Record<PlayerId, Player> = { p01: p1 };

      const res = checkConversationTriggers(club, players, [], 3, [], () => 0.1);
      expect(res).not.toBeNull();
      expect(res?.conversation.type).toBe('praise');
      expect(res?.conversation.playerId).toBe('p01');
    });

    it('returns null if random rolls exceed threshold', () => {
      const club = createMockClub('c01');
      const p1 = createMockPlayer('p01', { morale: 25 });
      const players: Record<PlayerId, Player> = { p01: p1 };

      // rng() = 0.9 exceeds 0.4 threshold for unhappy morale
      const res = checkConversationTriggers(club, players, [], 3, [], () => 0.9);
      expect(res).toBeNull();
    });
  });

  describe('Reply Application (SPEC §12.9, §16.4)', () => {
    it('applies morale effect, creates promise, and sets promisedRole', () => {
      const club = createMockClub('c01');
      const player = createMockPlayer('p01', { morale: 40 });

      const activeConv: ActiveConversation = {
        id: 'conv_p01_md2',
        type: 'playing_time',
        playerId: 'p01',
        opening: {
          id: 'opt_1',
          text: 'Boss, I need more minutes.',
          voText: 'Boss, I need more minutes.',
          replies: [
            {
              id: 'rep_promise',
              tone: 'Supportive',
              text: 'Marcus, you will start the next matches.',
              voText: 'You will start the next matches.',
              moraleDelta: 8,
              promise: { kind: 'Starter', matches: 4, targetStarts: 2 },
              playerReaction: 'Thank you boss, I will prove it.',
            },
          ],
        },
      };

      const result = applyConversationReply(player, club, activeConv, 'rep_promise', 2);
      expect(result).not.toBeNull();
      expect(result?.updatedPlayer.morale).toBe(48);
      expect(result?.updatedPlayer.promise).toEqual({
        kind: 'Starter',
        matchesRemaining: 4,
        startsCount: 0,
        targetStarts: 2,
      });
      expect(result?.updatedPlayer.contract?.promisedRole).toBe('Starter');
      expect(result?.inboxNotice.kind).toBe('Player');
    });

    it('extends contract (+20% wage, 3 years left) on renewal reply', () => {
      const club = createMockClub('c01');
      const player = createMockPlayer('p01', {
        contract: { wagePerWeek: 5000, yearsLeft: 1, role: 'Starter' },
      });

      const activeConv: ActiveConversation = {
        id: 'conv_p01_md3',
        type: 'contract',
        playerId: 'p01',
        opening: {
          id: 'oc_1',
          text: 'My contract expires next summer.',
          voText: 'My contract expires next summer.',
          replies: [
            {
              id: 'rep_renew',
              tone: 'Supportive',
              text: 'We are preparing a new deal for you.',
              voText: 'We are preparing a new deal for you.',
              moraleDelta: 12,
              contractRenewal: true,
              playerReaction: 'Delighted to hear that.',
            },
          ],
        },
      };

      const result = applyConversationReply(player, club, activeConv, 'rep_renew', 3);
      expect(result).not.toBeNull();
      expect(result?.updatedPlayer.contract?.yearsLeft).toBe(3);
      expect(result?.updatedPlayer.contract?.wagePerWeek).toBe(6000); // 5000 * 1.2
    });

    it('places player on transfer list when transferList flag is true', () => {
      const club = createMockClub('c01');
      const player = createMockPlayer('p01', { transferListed: false, morale: 50 });

      const activeConv: ActiveConversation = {
        id: 'conv_p01_md4',
        type: 'unhappy',
        playerId: 'p01',
        opening: {
          id: 'ou_1',
          text: 'I cannot see my future here.',
          voText: 'I cannot see my future here.',
          replies: [
            {
              id: 'rep_sell',
              tone: 'Critical',
              text: 'If that is how you feel, we will look for buyers.',
              voText: 'If that is how you feel, we will look for buyers.',
              moraleDelta: -6,
              transferList: true,
              playerReaction: 'Fine by me.',
            },
          ],
        },
      };

      const result = applyConversationReply(player, club, activeConv, 'rep_sell', 4);
      expect(result).not.toBeNull();
      expect(result?.updatedPlayer.transferListed).toBe(true);
      expect(result?.updatedPlayer.morale).toBe(44);
    });
  });

  describe('Promise Fulfillment & Penalty Tracking (SPEC §12.9)', () => {
    it('fulfills promise with +10 morale when player starts >= targetStarts in 4 matches', () => {
      const p1 = createMockPlayer('p01', {
        morale: 50,
        promise: {
          kind: 'Starter',
          matchesRemaining: 1, // Final match of the 4-match window
          startsCount: 1,
          targetStarts: 2,
        },
      });
      const players: Record<PlayerId, Player> = { p01: p1 };

      // Player starts this matchday!
      const checkResult = evaluatePromisesAfterMatch(players, 'c01', ['p01'], 5);
      const updated = checkResult.updatedPlayers['p01']!;

      expect(updated.promise).toBeNull();
      expect(updated.morale).toBe(60); // +10 morale
      expect(updated.transferListed).toBeFalsy();
      expect(checkResult.notifications.length).toBe(1);
      expect(checkResult.notifications[0]!.title).toContain('Promise kept');
    });

    it('breaks promise with -15 morale and transfer list request when player starts < targetStarts', () => {
      const p1 = createMockPlayer('p01', {
        morale: 50,
        transferListed: false,
        promise: {
          kind: 'Starter',
          matchesRemaining: 1, // Final match of the window
          startsCount: 1,
          targetStarts: 2,
        },
      });
      const players: Record<PlayerId, Player> = { p01: p1 };

      // Player benched this matchday (not in userStartingLineupIds)
      const checkResult = evaluatePromisesAfterMatch(players, 'c01', ['p02', 'p03'], 5);
      const updated = checkResult.updatedPlayers['p01']!;

      expect(updated.promise).toBeNull();
      expect(updated.morale).toBe(35); // -15 morale
      expect(updated.transferListed).toBe(true); // demanded transfer listing
      expect(checkResult.notifications.length).toBe(1);
      expect(checkResult.notifications[0]!.title).toContain('Broken promise');
    });

    it('decrements matchesRemaining and preserves promise if window is still open', () => {
      const p1 = createMockPlayer('p01', {
        promise: {
          kind: 'Starter',
          matchesRemaining: 3,
          startsCount: 0,
          targetStarts: 2,
        },
      });
      const players: Record<PlayerId, Player> = { p01: p1 };

      const checkResult = evaluatePromisesAfterMatch(players, 'c01', ['p01'], 2);
      const updated = checkResult.updatedPlayers['p01']!;

      expect(updated.promise).toEqual({
        kind: 'Starter',
        matchesRemaining: 2,
        startsCount: 1,
        targetStarts: 2,
      });
      expect(checkResult.notifications.length).toBe(0);
    });
  });
});
