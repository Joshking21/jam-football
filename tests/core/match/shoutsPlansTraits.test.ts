// SPEC §13.21 touchline shouts, §13.22 match plans, §13.23 player traits.
import { describe, it, expect } from 'vitest';
import { createMatch } from '@/core/match/engine';
import { createTestMatchInput } from './testHelper';
import { createNewGame } from '@/core/game/newGame';
import {
  isTraitClashing,
  worldTraitsFor,
  calculateTraitTrainingProgress,
  TRAIT_DEFINITIONS,
} from '@/core/player/traits';
import type { MatchEvent, MatchPlanRule } from '@/core/types';

const shoutEvents = (evs: MatchEvent[]) => evs.filter((e) => e.type === 'SHOUT');
const planEvents = (evs: MatchEvent[]) => evs.filter((e) => e.type === 'MATCH_PLAN_TRIGGERED');

describe('Touchline shouts (§13.21)', () => {
  it('takes effect 10 s after it is shouted', () => {
    const sim = createMatch(createTestMatchInput(68, 68, {}, {}, []), 11);
    const before = sim.runUntil(1000);
    sim.applyCommand({ kind: 'shout', side: 'home', shout: 'pushForward', issuedAtT: 1000 });
    const early = sim.runUntil(1005);
    const late = sim.runUntil(1030);
    expect(shoutEvents([...before, ...early])).toHaveLength(0);
    const s = shoutEvents(late);
    expect(s).toHaveLength(1);
    expect(s[0]!.t).toBeGreaterThanOrEqual(1010);
    expect(s[0]!.data?.shout).toBe('pushForward');
    expect(s[0]!.data?.isHalfEffect).toBe(false);
  });

  it('has half the effect when repeated within 15 minutes of its last end', () => {
    const sim = createMatch(createTestMatchInput(68, 68, {}, {}, []), 12);
    sim.runUntil(1000);
    sim.applyCommand({ kind: 'shout', side: 'home', shout: 'getStuckIn', issuedAtT: 1000 });
    sim.runUntil(1700); // ends at ~1610
    sim.applyCommand({ kind: 'shout', side: 'home', shout: 'getStuckIn', issuedAtT: 1700 });
    const s = shoutEvents(sim.runUntil(1750));
    expect(s).toHaveLength(1);
    expect(s[0]!.data?.isHalfEffect).toBe(true);
  });

  it("refuses 'Concentrate!' before 75' unless we've just conceded", () => {
    const sim = createMatch(createTestMatchInput(68, 68, {}, {}, []), 13);
    const evs = sim.runUntil(1200);
    const concededRecently = evs.some((e) => e.type === 'GOAL' && e.side === 'away' && e.t > 900);
    sim.applyCommand({ kind: 'shout', side: 'home', shout: 'concentrate', issuedAtT: 1200 });
    const s = shoutEvents(sim.runUntil(1260));
    if (!concededRecently) expect(s).toHaveLength(0);
  });
});

describe('Match plans (§13.22)', () => {
  const rules: MatchPlanRule[] = [
    { id: 'r1', when: 'Drawing', after: 0, then: 'keepTight' },
    { id: 'r2', when: 'Drawing', after: 0, then: 'PlanB' },
    { id: 'r3', when: 'Losing', after: 85, then: 'pushForward' },
  ];

  it('fires each rule once, the higher rule first when two match at the same step', () => {
    const sim = createMatch(createTestMatchInput(68, 68, { matchPlans: rules }, {}, []), 21);
    const evs = sim.runToEnd();
    const fired = planEvents(evs).filter((e) => e.side === 'home');
    const ids = fired.map((e) => e.data?.ruleId);
    expect(ids.filter((x) => x === 'r1')).toHaveLength(1);
    expect(ids.filter((x) => x === 'r2')).toHaveLength(1);
    expect(ids.indexOf('r1')).toBeLessThan(ids.indexOf('r2'));
    expect(fired[0]!.data?.askMeFirst).toBe(true);
  });

  it('is deterministic: the same seed and rules give the same events', () => {
    const run = () =>
      createMatch(
        createTestMatchInput(68, 68, { matchPlans: rules, askMeFirst: false }, {}, []),
        22,
      )
        .runToEnd()
        .map((e) => `${e.seq}|${e.t}|${e.type}|${e.side}|${e.playerId ?? ''}`)
        .join('\n');
    expect(run()).toBe(run());
  });

  it('a shout issued by a plan shows up as that shout', () => {
    const sim = createMatch(createTestMatchInput(68, 68, { matchPlans: [rules[0]!] }, {}, []), 23);
    const evs = sim.runToEnd();
    const shout = shoutEvents(evs).find((e) => e.side === 'home');
    expect(shout?.data?.shout).toBe('keepTight');
  });
});

describe('Player traits (§13.23)', () => {
  it('gives 55–65% of players at least one trait, never more than 3', () => {
    const gs = createNewGame({ seed: 5, userClubId: 'c01' });
    const ps = Object.values(gs.players);
    const share = ps.filter((p) => (p.traits ?? []).length > 0).length / ps.length;
    expect(share).toBeGreaterThanOrEqual(0.55);
    expect(share).toBeLessThanOrEqual(0.65);
    expect(Math.max(...ps.map((p) => (p.traits ?? []).length))).toBeLessThanOrEqual(3);
  });

  it('belongs to the fixed world: the same player has the same traits in every new game', () => {
    const a = createNewGame({ seed: 1, userClubId: 'c01' });
    const b = createNewGame({ seed: 999, userClubId: 'c03' });
    for (const id of Object.keys(a.players).slice(0, 40)) {
      expect(b.players[id]!.traits).toEqual(a.players[id]!.traits);
      expect(a.players[id]!.traits).toEqual(worldTraitsFor(a.players[id]!));
    }
  });

  it('only rolls traits the player is eligible for', () => {
    const gs = createNewGame({ seed: 2, userClubId: 'c01' });
    for (const p of Object.values(gs.players)) {
      for (const t of p.traits ?? []) expect(TRAIT_DEFINITIONS[t].isEligible(p)).toBe(true);
    }
  });

  it('lets an opposing instruction switch a trait off', () => {
    expect(isTraitClashing('shootsFromDistance', ['shootLess']).clashes).toBe(true);
    expect(isTraitClashing('getsForward', ['holdPosition']).clashes).toBe(true);
    expect(isTraitClashing('divesIn', ['stayOnFeet']).clashes).toBe(true);
    expect(isTraitClashing('divesIn', ['shootMore']).clashes).toBe(false);
  });

  it('learns faster when young and clever, slower when old', () => {
    const gs = createNewGame({ seed: 3, userClubId: 'c01' });
    const base = Object.values(gs.players)[0]!;
    const young = { ...base, age: 21, attributes: { ...base.attributes, decisions: 75 } };
    const old = { ...base, age: 32, attributes: { ...base.attributes, decisions: 60 } };
    expect(calculateTraitTrainingProgress(young, 3)).toBeGreaterThan(
      calculateTraitTrainingProgress(old, 3),
    );
  });
});
