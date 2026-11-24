import { createNewGame } from '../src/core/game/newGame';
import { buildTeamSheet } from '../src/core/game/advance';
import { createMatch } from '../src/core/match/engine';
import { Choreographer } from '../src/render3d/choreographer';
import { MatchPhysics } from '../src/physics/matchPhysics';
const gs: any = createNewGame({ seed: 12345, userClubId: 'c01' });
let checked = 0,
  inNet = 0;
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
  for (const g of events.filter((e: any) => e.type === 'GOAL')) {
    const ch = new Choreographer(tac(home), tac(away), pace);
    ch.setEvents(events);
    const ph = (await MatchPhysics.create(ch, [...lineup(home), ...lineup(away)], str, false))!;
    const half = g.half;
    let maxDepth = 0;
    let crossed = false;
    for (let t = g.t - 12; t < g.t + 12; t += 1 / 60) {
      ch.update(1 / 60, t, null, half);
      ph.step(1 / 60, t);
      const b = ph.ballPos;
      if (Math.abs(b.x) > 52.6 && Math.abs(b.z) < 3.7 && b.y < 2.45) crossed = true;
      maxDepth = Math.max(maxDepth, Math.abs(b.x) - 52.5);
    }
    const b = ph.ballPos;
    const ok = crossed && Math.abs(b.x) > 52.5;
    checked++;
    if (ok) inNet++;
    console.log(
      `goal t=${g.t} crossed=${crossed} end=(${b.x.toFixed(1)},${b.y.toFixed(2)},${b.z.toFixed(1)}) depth=${maxDepth.toFixed(2)}`,
    );
    ph.dispose();
  }
}
console.log(`goals in net ${inNet}/${checked}`);
