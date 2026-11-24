import { createNewGame } from '../src/core/game/newGame';
import { buildTeamSheet } from '../src/core/game/advance';
import { createMatch } from '../src/core/match/engine';
import { Choreographer } from '../src/render3d/choreographer';
const gs = createNewGame({ seed: 12345, userClubId: 'c01' });
const fx = gs.fixtures[0]!;
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
const lineup = (c: any) =>
  c.tactics.lineup.filter(Boolean).length === 11 ? c.tactics.lineup : c.squad.slice(0, 11);
const tac = (c: any) => ({
  formation: c.tactics.formation,
  ...c.tactics.instructions,
  lineup: lineup(c),
});
const pace: any = {};
Object.values(gs.players).forEach((p) => (pace[p.id] = p.attributes.pace));
const ch = new Choreographer(tac(home), tac(away), pace);
ch.setEvents(events);
const last = ch.ballPos.clone();
for (let t = 0; t < 600; t += 1 / 60) {
  ch.update(1 / 60, t, null, 1);
  const p = ch.activePlan;
  const seg = ch.activeSeg;
  const restart =
    (seg?.kind === 'hold' && !seg.holderId) ||
    (p && ['CORNER', 'THROW_IN', 'GOAL_KICK', 'FREE_KICK', 'KICKOFF'].includes(p.type));
  const d = ch.ballPos.distanceTo(last);
  if (!restart && d > 1.5) {
    const near = events
      .filter((e) => Math.abs(e.t - t) < 4)
      .map((e) => `${e.t}:${e.type}${e.from ? '' : '(nofrom)'}`)
      .join(' ');
    console.log(
      `t=${t.toFixed(2)} jump ${d.toFixed(1)} m plan=${p?.type} seg=${ch.activeSeg?.kind} | ${near}`,
    );
  }
  last.copy(ch.ballPos);
}
