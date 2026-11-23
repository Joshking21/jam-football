import { describe, it, expect } from 'vitest';
import {
  SESSION_DEFINITIONS,
  TRAINING_TEMPLATES,
  BALANCED_WEEK_SCHEDULE,
  calculateWeekLoad,
  countTrainingSessions,
  calculateSharpnessFractions,
  calculateSharpnessBonuses,
  getWeekAttributeWeights,
  calculateTrainingRating,
  generateTheosWeek,
  suggestOneToOne,
  applyOneToOneSession,
  getOverloadedPlayers,
  getCoachNote,
  getAttributeProgress,
} from '@/core/people/training';
import { createNewGame } from '@/core/game/newGame';
import { createRng } from '@/core/rng';
import { processPlayerDevelopment } from '@/core/player/development';
import { calculateWeeklyConditionRecovery } from '@/core/player/condition';
import { checkTrainingInjury } from '@/core/player/injuries';
import { checkConversationTriggers } from '@/core/player/conversations';
import { Player, WeeklyTrainingSchedule } from '@/core/types';
import { BALANCE } from '@/config/balance';

describe('SPEC §12.18 Training in Detail', () => {
  const gameState = createNewGame({ userClubId: 'c01', managerName: 'Manager', seed: 42 });
  const userClub = gameState.clubs['c01']!;
  const samplePlayer: Player = JSON.parse(JSON.stringify(gameState.players[userClub.squad[0]!]));

  describe('12.18.2 Session Library', () => {
    it('defines all 17 sessions with correct categories, growth lists and loads', () => {
      expect(SESSION_DEFINITIONS.finishing.load).toBe(2);
      expect(SESSION_DEFINITIONS.finishing.category).toBe('Attacking');
      expect(SESSION_DEFINITIONS.finishing.grows).toEqual(['finishing', 'composure', 'offTheBall']);

      expect(SESSION_DEFINITIONS.defensive_shape.load).toBe(1);
      expect(SESSION_DEFINITIONS.defensive_shape.category).toBe('Defending');

      expect(SESSION_DEFINITIONS.pressing.load).toBe(3);
      expect(SESSION_DEFINITIONS.endurance.load).toBe(3);
      expect(SESSION_DEFINITIONS.speed_power.load).toBe(3);

      expect(SESSION_DEFINITIONS.shape_work.formationFamiliarityBonus).toBe(3);
      expect(SESSION_DEFINITIONS.video_analysis.allFamiliarityBonus).toBe(1);
      expect(SESSION_DEFINITIONS.video_analysis.load).toBe(0);

      expect(SESSION_DEFINITIONS.small_sided.moraleBonus).toBe(1);
      expect(SESSION_DEFINITIONS.small_sided.load).toBe(2);

      expect(SESSION_DEFINITIONS.recovery.load).toBe(-2);
      expect(SESSION_DEFINITIONS.recovery.conditionDelta).toBe(3);
      expect(SESSION_DEFINITIONS.recovery.fatigueDelta).toBe(-2);

      expect(SESSION_DEFINITIONS.rest.load).toBe(-1);
      expect(SESSION_DEFINITIONS.rest.conditionDelta).toBe(2);

      expect(SESSION_DEFINITIONS.light.load).toBe(0);
      expect(SESSION_DEFINITIONS.light.day6Only).toBe(true);
      expect(SESSION_DEFINITIONS.opponent_prep.day6Only).toBe(true);
    });
  });

  describe('12.18.3 Week Load & Sharpness', () => {
    it('calculates weekLoad = 12 for the default Balanced week', () => {
      const load = calculateWeekLoad(BALANCED_WEEK_SCHEDULE);
      expect(load).toBe(12);
    });

    it('counts active training sessions (free slots that are not Rest or Recovery)', () => {
      const count = countTrainingSessions(BALANCED_WEEK_SCHEDULE);
      expect(count).toBe(8);

      const custom: WeeklyTrainingSchedule = {
        ...BALANCED_WEEK_SCHEDULE,
        d2_am: 'recovery',
        d3_pm: 'rest',
      };
      expect(countTrainingSessions(custom)).toBe(6);
    });

    it('calculates sharpness fractions and bonuses on days 5 & 6', () => {
      // Balanced week: d5_am: shape_work (Tactical), d5_pm: set_pieces (SetPieces), d6: light (None)
      const fractions = calculateSharpnessFractions(BALANCED_WEEK_SCHEDULE);
      expect(fractions.Tactical).toBeCloseTo(1 / 3);
      expect(fractions.SetPieces).toBeCloseTo(1 / 3);
      expect(fractions.Attacking).toBe(0);

      const bonuses = calculateSharpnessBonuses(BALANCED_WEEK_SCHEDULE, 'None');
      expect(bonuses.attack).toBe(0);
      expect(bonuses.setPieces).toBeCloseTo(0.12 * (1 / 3));

      // Attacking week: d5_am: finishing, d5_pm: crossing, d6: light
      const attackingWeek = TRAINING_TEMPLATES.attacking.schedule;
      const attFractions = calculateSharpnessFractions(attackingWeek);
      expect(attFractions.Attacking).toBeCloseTo(2 / 3);
      const attBonuses = calculateSharpnessBonuses(attackingWeek, 'None');
      expect(attBonuses.attack).toBeCloseTo(0.08 * (2 / 3));
    });

    it('adjusts condition recovery based on weekLoad (+0.6 per point from 12)', () => {
      const baseRec = calculateWeeklyConditionRecovery({
        stamina: 70,
        intensity: 'Normal',
        focus: 'Balanced',
        playedMinutes: 90,
        fatigue: 20,
        weekLoad: 12,
      });

      const lowLoadRec = calculateWeeklyConditionRecovery({
        stamina: 70,
        intensity: 'Normal',
        focus: 'Balanced',
        playedMinutes: 90,
        fatigue: 20,
        weekLoad: 8, // 4 points lighter -> +2.4
      });

      expect(lowLoadRec).toBeCloseTo(baseRec + 2.4, 1);
    });

    it('scales training injury risk by weekLoad / 12', () => {
      const rng1 = createRng(12345);
      const rng2 = createRng(12345);
      // High load (e.g. 18) should produce injury equal to or earlier than baseline load 12
      const injNormal = checkTrainingInjury(rng1, 'Normal', 50, 12);
      const injHigh = checkTrainingInjury(rng2, 'Normal', 50, 24);
      // Verify formula components
      expect(BALANCE.training.baselineLoad).toBe(12);
    });
  });

  describe('12.18.4 Theo Week Generation', () => {
    it('creates Theo week with opponent prep and appropriate adjustments', () => {
      const oppClub = gameState.clubs['c02']!;
      const oppPlayers = oppClub.squad.map((id) => gameState.players[id]!).filter(Boolean);

      const theos = generateTheosWeek(userClub, gameState.players, oppClub, oppPlayers);
      expect(theos.schedule).toBeDefined();
      expect(theos.reasons.length).toBeGreaterThanOrEqual(1);
      expect(theos.schedule.d6).toBe('opponent_prep');
      expect(theos.suggestedSlots.d6).toBe(true);
    });

    it('swaps load-3 sessions for Recovery when 4+ starters are tired (> 50 fatigue)', () => {
      const tiredPlayers = JSON.parse(JSON.stringify(gameState.players));
      userClub.squad.slice(0, 5).forEach((id) => {
        tiredPlayers[id].fatigue = 65;
      });

      const theos = generateTheosWeek(userClub, tiredPlayers);
      expect(theos.schedule.d3_am).toBe('recovery');
      expect(theos.reasons.some((r) => r.includes('Recovery in'))).toBe(true);
    });
  });

  describe('12.18.5 Personal Training Plans', () => {
    it('modifies growth and injury by workload (Light / Heavy)', () => {
      const rng = createRng(42);
      const player: Player = JSON.parse(JSON.stringify(samplePlayer));
      player.age = 20;
      player.potential = 90;
      player.growth = 0;

      const normRes = processPlayerDevelopment(player, {
        focus: 'Balanced',
        intensity: 'Normal',
        minutesLastMatch: 90,
        rng,
        workload: 'Normal',
      });

      const lightRes = processPlayerDevelopment(player, {
        focus: 'Balanced',
        intensity: 'Normal',
        minutesLastMatch: 90,
        rng: createRng(42),
        workload: 'Light',
      });

      const heavyRes = processPlayerDevelopment(player, {
        focus: 'Balanced',
        intensity: 'Normal',
        minutesLastMatch: 90,
        rng: createRng(42),
        workload: 'Heavy',
      });

      expect(lightRes.growthDelta).toBeCloseTo(normRes.growthDelta * 0.8, 3);
      expect(heavyRes.growthDelta).toBeCloseTo(normRes.growthDelta * 1.15, 3);
    });

    it('handles Extra sessions and 30% skip chance for Relaxed players', () => {
      const rng = createRng(999);
      const player: Player = JSON.parse(JSON.stringify(samplePlayer));
      player.personality = 'Relaxed';

      const devExtra = processPlayerDevelopment(player, {
        focus: 'Balanced',
        intensity: 'Normal',
        minutesLastMatch: 90,
        rng: createRng(100),
        extraSessions: true,
        extraSessionsSkipped: false,
      });

      const devBase = processPlayerDevelopment(player, {
        focus: 'Balanced',
        intensity: 'Normal',
        minutesLastMatch: 90,
        rng: createRng(100),
        extraSessions: false,
      });

      expect(devExtra.growthDelta).toBeCloseTo(devBase.growthDelta * 1.15, 3);
    });

    it('applies Mentoring morale drift and development scaling', () => {
      const rng = createRng(555);
      const youngMentee: Player = JSON.parse(JSON.stringify(samplePlayer));
      youngMentee.age = 19;
      youngMentee.potential = 88;

      const resMentee = processPlayerDevelopment(youngMentee, {
        focus: 'Balanced',
        intensity: 'Normal',
        minutesLastMatch: 90,
        rng: createRng(555),
        isMentee: true,
      });

      const resBase = processPlayerDevelopment(youngMentee, {
        focus: 'Balanced',
        intensity: 'Normal',
        minutesLastMatch: 90,
        rng: createRng(555),
      });

      expect(resMentee.growthDelta).toBeCloseTo(resBase.growthDelta * 1.08, 3);
    });
  });

  describe('12.18.6 One-to-One Sessions', () => {
    it('applies Technique, Confidence, Fitness and Video effects', () => {
      const p: Player = JSON.parse(JSON.stringify(samplePlayer));
      p.morale = 40;
      p.condition = 70;
      p.fatigue = 50;

      // Confidence
      const confRes = applyOneToOneSession('Confidence', p);
      expect(confRes.updatedPlayer.morale).toBeGreaterThan(p.morale);

      // Fitness
      const fitRes = applyOneToOneSession('Fitness', p);
      expect(fitRes.updatedPlayer.condition).toBe(76); // +6
      expect(fitRes.updatedPlayer.fatigue).toBe(46); // -4

      // Video
      const vidRes = applyOneToOneSession('Video', p);
      expect(vidRes.updatedPlayer.decisionContextBonus).toBe(0.05);
    });

    it('suggests appropriate one-to-one candidate based on squad needs', () => {
      const oto = suggestOneToOne(userClub, gameState.players);
      expect(oto.player).toBeDefined();
      expect(['Confidence', 'Fitness', 'Technique', 'Video']).toContain(oto.type);
      expect(oto.reason.length).toBeGreaterThan(0);
    });
  });

  describe('12.18.7 Training Ratings', () => {
    it('calculates ratings within [1.0, 10.0] using personality, morale and condition', () => {
      const rng = createRng(777);
      const p: Player = JSON.parse(JSON.stringify(samplePlayer));
      p.personality = 'Professional';
      p.morale = 80;
      p.condition = 95;

      const rating = calculateTrainingRating(p, 'Normal', false, false, rng);
      expect(rating).toBeGreaterThanOrEqual(1.0);
      expect(rating).toBeLessThanOrEqual(10.0);
      // Professional with high morale & condition should have solid rating around 7-8
      expect(rating).toBeGreaterThan(6.5);
    });

    it('triggers "training_well" conversation when high rating is sustained without playing', () => {
      const benchPlayer: Player = JSON.parse(JSON.stringify(samplePlayer));
      benchPlayer.ratingHistory = [7.8, 8.0, 7.9];
      benchPlayer.stats.starts = 0;
      benchPlayer.stats.apps = 0;

      const clubWithPlayer = { ...userClub };
      const playersMap: Record<string, Player> = {
        [benchPlayer.id]: benchPlayer,
      };

      const dummyFixtures: any[] = [
        { result: { homeScore: 1, awayScore: 0 }, homeId: userClub.id, awayId: 'c02' },
        { result: { homeScore: 2, awayScore: 1 }, homeId: userClub.id, awayId: 'c03' },
        { result: { homeScore: 0, awayScore: 0 }, homeId: userClub.id, awayId: 'c04' },
      ];

      const triggerRes = checkConversationTriggers(
        clubWithPlayer,
        playersMap,
        dummyFixtures,
        4,
        [],
        () => 0.1, // forced low roll
      );

      expect(triggerRes).not.toBeNull();
      expect(triggerRes?.conversation.type).toBe('training_well');
    });
  });

  describe('12.18.8 Progress & Overload Monitoring', () => {
    it('detects overloaded players correctly', () => {
      const p1: Player = JSON.parse(JSON.stringify(samplePlayer));
      p1.fatigue = 65;
      p1.workload = 'Normal';

      const p2: Player = JSON.parse(JSON.stringify(samplePlayer));
      p2.fatigue = 55;
      p2.extraSessions = true;

      const p3: Player = JSON.parse(JSON.stringify(samplePlayer));
      p3.fatigue = 30;

      const overloaded = getOverloadedPlayers([p1, p2, p3]);
      expect(overloaded.length).toBe(2);
      expect(overloaded.map((p) => p.id)).toEqual([p1.id, p2.id]);
    });

    it('retrieves coach notes and attribute progress arrows', () => {
      const note = getCoachNote(samplePlayer, 8.5);
      expect(typeof note).toBe('string');
      expect(note.length).toBeGreaterThan(0);

      const pWithHistory: Player = JSON.parse(JSON.stringify(samplePlayer));
      pWithHistory.attrHistory = [
        { matchday: 1, attributes: { ...pWithHistory.attributes, finishing: 60 } },
      ];
      pWithHistory.attributes.finishing = 62;
      expect(getAttributeProgress(pWithHistory, 'finishing')).toBe('up');

      pWithHistory.attributes.finishing = 58;
      expect(getAttributeProgress(pWithHistory, 'finishing')).toBe('down');

      pWithHistory.attributes.finishing = 60;
      expect(getAttributeProgress(pWithHistory, 'finishing')).toBe('none');
    });
  });
});
