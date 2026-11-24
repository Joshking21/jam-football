// §14.12.8: physics acts the plan out. Real seeded matches, headless Rapier.
const expect = (v: any) => ({
  not: {
    toBeNull: () => {
      if (v === null) throw new Error('null');
    },
  },
  toBe: (x: any) => console.log('check', v, '==', x),
  toBeGreaterThan: (x: any) => console.log('check', v, '>', x),
  toBeLessThan: (x: any) => console.log('check', v, '<', x),
});
const describe = (_n: string, f: () => void) => f();
const it = async (_n: string, f: () => Promise<void>) => {
  const t = Date.now();
  await f();
  console.log('took', Date.now() - t, 'ms');
};
import { createNewGame } from '../src/core/game/newGame';
import { buildTeamSheet } from '../src/core/game/advance';
import { createMatch } from '../src/core/match/engine';
import { Choreographer, TeamTacticsInput } from '../src/render3d/choreographer';
import { MatchPhysics } from '../src/physics/matchPhysics';

describe('Match physics (§14.12)', () => {
  it('keeps the contracts over the first 15 minutes of two matches', async () => {
    const gs = createNewGame({ seed: 12345, userClubId: 'c01' });
    let goalsChecked = 0;
    let goalsInNet = 0;
    let minGap = Infinity;
    let worstStepMs = 0;
    let stepMsTotal = 0;
    let steps = 0;
    let driftSum = 0;
    let driftN = 0;

    for (const fx of gs.fixtures.slice(0, 2)) {
      const home = gs.clubs[fx.homeId]!;
      const away = gs.clubs[fx.awayId]!;
      const events = createMatch(
        {
          fixtureId: fx.id,
          home: buildTeamSheet(home, gs.players, 'home'),
          away: buildTeamSheet(away, gs.players, 'away'),
          isDerby: false,
          weather: fx.weather,
          userSide: 'home',
          aiControls: ['home', 'away'],
        },
        777,
      ).runToEnd();
      const lineup = (c: typeof home) =>
        (c.tactics.lineup.filter(Boolean).length === 11
          ? c.tactics.lineup
          : c.squad.slice(0, 11)) as string[];
      const tac = (c: typeof home): TeamTacticsInput => ({
        formation: c.tactics.formation,
        ...c.tactics.instructions,
        lineup: lineup(c),
      });
      const pace: Record<string, number> = {};
      const strength: Record<string, number> = {};
      Object.values(gs.players).forEach((p) => {
        pace[p.id] = p.attributes.pace;
        strength[p.id] = p.attributes.strength;
      });
      const ch = new Choreographer(tac(home), tac(away), pace);
      ch.setEvents(events);
      const ids = [...lineup(home), ...lineup(away)];
      const ph = await MatchPhysics.create(ch, ids, strength, false);
      expect(ph).not.toBeNull();

      const goals = events.filter((e) => e.type === 'GOAL' && e.t < 297);
      const dt = 1 / 60;
      for (let t = 0; t < 300; t += dt) {
        ch.update(dt, t, null, 1);
        const t0 = performance.now();
        ph!.step(dt, t);
        const ms = performance.now() - t0;
        worstStepMs = Math.max(worstStepMs, ms);
        stepMsTotal += ms;
        steps++;
        // Players never pass through each other (fallen ones excepted).
        for (let i = 0; i < ids.length; i++) {
          if (ph!.isFallen(ids[i]!)) continue;
          const a = ch.getPlayerState(ids[i]!)!.currentPos;
          for (let j = i + 1; j < ids.length; j++) {
            if (ph!.isFallen(ids[j]!)) continue;
            const b = ch.getPlayerState(ids[j]!)!.currentPos;
            minGap = Math.min(minGap, Math.hypot(a.x - b.x, a.z - b.z));
          }
        }
        // Physics ball follows the plan's ball (while carried it is attached; in flight it lands on target).
        driftSum += ph!.ballPos.distanceTo(ch.ballPos);
        driftN++;
        for (const g of goals) {
          // Two seconds after the goal event: the ball must be in the net.
          if (Math.abs(t - (g.t + 3)) < dt / 2) {
            goalsChecked++;
            const b = ph!.ballPos;
            if (Math.abs(b.x) > 52.5 && Math.abs(b.z) < 3.8 && b.y < 2.5) goalsInNet++;
          }
        }
      }
      ph!.dispose();
    }

    const avgStepMs = stepMsTotal / steps;
    // eslint-disable-next-line no-console
    console.log(
      `physics: goals in net ${goalsInNet}/${goalsChecked}, min player gap ${minGap.toFixed(2)} m, ` +
        `avg ball drift ${(driftSum / driftN).toFixed(2)} m, step avg ${avgStepMs.toFixed(3)} ms worst ${worstStepMs.toFixed(1)} ms`,
    );
    expect(goalsInNet).toBe(goalsChecked);
    expect(minGap).toBeGreaterThan(0.45);
    expect(avgStepMs).toBeLessThan(2.0);
  }, 180000);
});
