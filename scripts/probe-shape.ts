// Probe: does the 3D read as football? Team shape and movement metrics over real matches.
//   npx tsx scripts/probe-shape.ts
import { createNewGame } from '../src/core/game/newGame';
import { buildTeamSheet } from '../src/core/game/advance';
import { createMatch } from '../src/core/match/engine';
import { Choreographer, TeamTacticsInput } from '../src/render3d/choreographer';
import { FORMATIONS } from '../src/config/formations';
import { attacksToward105 } from '../src/core/match/frames';
import type { Side } from '../src/core/types';

const gs = createNewGame({ seed: 12345, userClubId: 'c01' });
const stats = {
  lineStd: [] as number[],
  gap: [] as number[],
  length: [] as number[],
  width: [] as number[],
  sprint: 0,
  moving: 0,
  n: 0,
  behindGoal: 0,
  turnRate: [] as number[],
};

for (const fx of gs.fixtures.slice(0, 3)) {
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
  Object.values(gs.players).forEach((p) => (pace[p.id] = p.attributes.pace));
  const ch = new Choreographer(tac(home), tac(away), pace);
  ch.setEvents(events);
  const teams: { side: Side; c: typeof home }[] = [
    { side: 'home', c: home },
    { side: 'away', c: away },
  ];
  const lastFacing = new Map<string, number>();
  for (let t = 0; t < 600; t += 1 / 30) {
    ch.update(1 / 30, t, null, 1);
    const plan = ch.activePlan;
    const openPlay =
      plan &&
      !['CORNER', 'FREE_KICK', 'THROW_IN', 'GOAL_KICK', 'KICKOFF', 'GOAL', 'FOUL'].includes(
        plan.type,
      );
    for (const { side, c } of teams) {
      const ids = lineup(c);
      const f = FORMATIONS[c.tactics.formation]!;
      const right = attacksToward105(side, 1);
      const own = (x: number) => (right ? x + 52.5 : 52.5 - x);
      const defs: number[] = [];
      const mids: number[] = [];
      const all: number[] = [];
      const zs: number[] = [];
      ids.forEach((pid, slot) => {
        const s = ch.getPlayerState(pid)!;
        const pos = f.slots[slot]?.position;
        if (Math.abs(s.currentPos.x) > 52.6) stats.behindGoal++;
        if (slot === 0) return;
        const ax = own(s.currentPos.x);
        all.push(ax);
        zs.push(s.currentPos.z);
        if (pos === 'CB' || pos === 'LB' || pos === 'RB' || pos === 'LWB' || pos === 'RWB')
          defs.push(ax);
        else if (pos !== 'ST' && pos !== 'LW' && pos !== 'RW') mids.push(ax);
        stats.n++;
        if (s.speed > 0.5) stats.moving++;
        if (s.speed > 7) stats.sprint++;
        const lf = lastFacing.get(pid);
        if (lf !== undefined) {
          let d = Math.abs(s.facingAngle - lf);
          if (d > Math.PI) d = Math.PI * 2 - d;
          stats.turnRate.push(d * 30);
        }
        lastFacing.set(pid, s.facingAngle);
      });
      // Defending shape: the side without the ball, in open play.
      const ballSide = ch.carrierId ? ch.sideOfPlayer(ch.carrierId) : null;
      if (openPlay && ballSide && ballSide !== side && defs.length >= 3) {
        const mean = defs.reduce((a, b) => a + b, 0) / defs.length;
        stats.lineStd.push(Math.sqrt(defs.reduce((a, b) => a + (b - mean) ** 2, 0) / defs.length));
        const midMean = mids.reduce((a, b) => a + b, 0) / Math.max(1, mids.length);
        stats.gap.push(midMean - mean);
        stats.length.push(Math.max(...all) - Math.min(...all));
        stats.width.push(Math.max(...zs) - Math.min(...zs));
      }
    }
  }
}
const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1] ?? NaN;
const p90 = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.9)] ?? NaN;
console.log(
  `defending back line spread (std, m): median ${med(stats.lineStd).toFixed(1)}  p90 ${p90(stats.lineStd).toFixed(1)}   [real: ~1-2]`,
);
console.log(`defence-to-midfield gap (m): median ${med(stats.gap).toFixed(1)}   [real: 8-15]`);
console.log(`team length defending (m): median ${med(stats.length).toFixed(1)}   [real: 25-40]`);
console.log(`team width defending (m): median ${med(stats.width).toFixed(1)}   [real: 35-50]`);
console.log(
  `moving ${((100 * stats.moving) / stats.n).toFixed(0)}%, sprinting ${((100 * stats.sprint) / stats.n).toFixed(1)}%   [real: sprint 3-8%]`,
);
console.log(`body turn rate p90 ${p90(stats.turnRate).toFixed(1)} rad/s   [human: < 8]`);
console.log(`player-frames behind a goal line: ${stats.behindGoal}`);
