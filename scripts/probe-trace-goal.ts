import { createNewGame } from '../src/core/game/newGame';
import { buildTeamSheet } from '../src/core/game/advance';
import { createMatch } from '../src/core/match/engine';
import { Choreographer } from '../src/render3d/choreographer';
import { MatchPhysics } from '../src/physics/matchPhysics';
const gs: any = createNewGame({ seed: 12345, userClubId: 'c01' });
const T = Number(process.argv[2] ?? 1330);
for (const fx of gs.fixtures.slice(0, 6)) {
  const home = gs.clubs[fx.homeId],
    away = gs.clubs[fx.awayId];
  const events = createMatch(
    {
      fixtureId: fx.id,
      home: buildTeamSheet(home, gs.players, 'home'),
      away: buildTeamSheet(away, gs.players, 'away'),
      isDerby: false,
      weather: fx.weather,
      userSide: 'home',
      aiControls: ['home', 'away'],
    } as any,
    777,
  ).runToEnd();
  const g = events.find((e: any) => e.type === 'GOAL' && e.t === T);
  if (!g) continue;
  const lineup = (c: any) =>
    c.tactics.lineup.filter(Boolean).length === 11 ? c.tactics.lineup : c.squad.slice(0, 11);
  const tac = (c: any) => ({
    formation: c.tactics.formation,
    ...c.tactics.instructions,
    lineup: lineup(c),
  });
  const pace: any = {},
    str: any = {};
  for (const p of Object.values(gs.players) as any[]) {
    pace[p.id] = p.attributes.pace;
    str[p.id] = p.attributes.strength;
  }
  const ch = new Choreographer(tac(home), tac(away), pace);
  ch.setEvents(events);
  const ph = (await MatchPhysics.create(ch, [...lineup(home), ...lineup(away)], str, false))!;
  const f = (v: any) => `(${v.x.toFixed(1)},${v.y.toFixed(1)},${v.z.toFixed(1)})`;
  for (let t = T - 6; t < T + 8; t += 1 / 60) {
    ch.update(1 / 60, t, null, g.half);
    ph.step(1 / 60, t);
    if (Math.round(t * 60) % 15 === 0 && t > T - 1)
      console.log(
        t.toFixed(2),
        'plan',
        ch.activePlan?.type,
        'seg',
        ch.activeSeg?.kind,
        'dir',
        f(ch.ballPos),
        'phys',
        f(ph.ballPos),
      );
  }
}
